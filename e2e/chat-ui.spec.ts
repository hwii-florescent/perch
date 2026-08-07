/**
 * chat-ui.spec.ts — e2e coverage for the jean-parity chat-pane restyle
 * (asymmetric bubbles, per-tool-call timeline, inline Edit diffs, scroll
 * behavior fix, streaming markdown repair, per-code-block copy button).
 *
 * C1 "asymmetric bubbles":
 *   Injects a synthetic user + assistant message directly into the Zustand
 *   store (via `window.usePerchStore`, exposed for exactly this purpose —
 *   see packages/web/src/main.tsx) and asserts on *computed* styles: the
 *   user bubble has a border + background and is right-aligned
 *   (align-self: flex-end); the assistant message has no border/background
 *   and is full-width. Also asserts the per-role hover-copy testids exist.
 *   No real agent turn needed — deterministic, always runs.
 *
 * C2 "tool-call rows render per-call and expand":
 *   Runs a real turn asking the agent to use the Read tool. If a tool row
 *   renders, opens the (auto-collapsing) .message__worked-for wrapper,
 *   asserts the tool-row is collapsed by default, clicks its summary, and
 *   asserts it opens. Tolerates model variance (no tool call / thinking
 *   only / no worked-for at all) by skipping with a documented note,
 *   mirroring restyle.spec.ts's C3 pattern. Skipped if claude unavailable.
 *
 * C3 "scroll behavior fix":
 *   Seeds enough synthetic messages to overflow the chat list (no real
 *   turn), scrolls up, asserts the floating "scroll-bottom-pill" appears
 *   and that appending another message does NOT yank the view back down
 *   (the classic "force scroll" bug this item fixes). Clicking the pill
 *   returns to the bottom and hides it again.
 *
 * C4 "per-code-block copy button":
 *   Runs a real turn asking for an exact fenced code block reply, asserts
 *   a "codeblock-copy" button is injected into the rendered <pre>, and
 *   (with clipboard permissions granted) that clicking it copies the code
 *   text. Skipped if claude unavailable.
 *
 * C5 "inline Edit diff rendering":
 *   perch's tool-call results aren't persisted/replayable without a live
 *   agent turn that happens to call Edit — deterministically forcing that
 *   from a prompt is unreliable. Instead this test injects a synthetic
 *   assistant message with an Edit-shaped tool call directly into the
 *   store (same mechanism as C1) and asserts: a colored diff view renders
 *   (.diff-view / .diff-line--add), a per-file edit badge renders with the
 *   right +/- counts, and clicking the badge opens + scrolls to the
 *   underlying tool-row.
 */

import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";

const BASE_URL = "http://127.0.0.1:7799";
const SHOTS_DIR = "/tmp/perch-chatui-shots";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function freshSession(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

async function selectAgentModel(page: Page, agentId: string, modelId: string): Promise<void> {
  const chip = page.locator('[data-testid="model-chip"]');
  await expect(chip).toBeVisible({ timeout: 10000 });
  await chip.click();
  await page.locator(`[data-testid="agent-option-${agentId}"]`).click();
  await page.locator(`[data-testid="model-option-${modelId}"]`).click();
}

/** Opens a fresh "No project" session and waits for the chat input to be
 * enabled (confirms ChatView, not the connecting placeholder, is mounted)
 * — without sending any message or spending a real agent turn. */
async function seedSessionNoTurn(page: Page): Promise<void> {
  await freshSession(page);
  const newBtn = page.locator('[data-testid="new-session-local"]');
  await expect(newBtn).toBeEnabled({ timeout: 10000 });
  await newBtn.click();
  const noneOpt = page.locator('[data-testid="project-option-none"]');
  await expect(noneOpt).toBeVisible({ timeout: 5000 });
  await noneOpt.click();
  await expect(noneOpt).not.toBeVisible({ timeout: 3000 });
  await expect(page.locator(".chat__input textarea")).toBeEnabled({ timeout: 10000 });
}

/** Appends synthetic ChatMessage-shaped objects directly to the store's
 * `messages` array via `window.usePerchStore` (exposed in main.tsx for
 * exactly this purpose). Lets tests exercise rendering paths — like an
 * Edit-tool diff, or "list is scrollable" — without needing a real agent
 * turn to happen to produce that exact shape. */
async function injectMessages(page: Page, messages: unknown[]): Promise<void> {
  // Injected fixtures race a real `session.history` for the freshly-seeded
  // session: that reply legitimately replaces the bucket with the server's
  // (empty) history and wipes the fixture. The product behaviour is correct —
  // it is the fixture that is synthetic — so retry until the messages are
  // actually in the store rather than assuming the first write survives.
  // Settle first: wait until the session's bucket stops changing, so the
  // history reply has already landed and cannot wipe the fixture afterwards.
  // Retrying after the fact does not work — the write can land and then be
  // overwritten a moment later, which reads as a pass and then fails at the
  // assertion.
  await page.waitForFunction(
    () => {
      const w = window as unknown as { usePerchStore: any; __injectSettle?: { n: number; c: number } };
      const s = w.usePerchStore.getState();
      const n = ((s.sessionId && s.messagesBySession?.[s.sessionId]) || s.messages || []).length;
      const prev = w.__injectSettle;
      // Same length observed on three consecutive polls => quiescent.
      w.__injectSettle = prev && prev.n === n ? { n, c: prev.c + 1 } : { n, c: 0 };
      return w.__injectSettle.c >= 3;
    },
    undefined,
    { timeout: 10000, polling: 150 },
  );
  await page.evaluate(() => {
    delete (window as unknown as { __injectSettle?: unknown }).__injectSettle;
  });
  await injectMessagesOnce(page, messages);
}

async function injectMessagesOnce(page: Page, messages: unknown[]): Promise<void> {
  await page.evaluate((msgs) => {
    const store = (window as unknown as { usePerchStore: { setState: (fn: (s: any) => any) => void } }).usePerchStore;
    // Hosted conversations are stored per session in `messagesBySession`; the
    // flat `messages` array is only a MIRROR of the active session's bucket.
    // Writing `messages` alone therefore renders nothing — the views read the
    // bucket. Write both so the injected fixture is the real source of truth
    // and the mirror stays consistent with it.
    store.setState((s: any) => {
      const sid = s.sessionId;
      const current = (sid && s.messagesBySession?.[sid]) || s.messages || [];
      const next = [...current, ...msgs];
      return sid
        ? { messagesBySession: { ...s.messagesBySession, [sid]: next }, messages: next }
        : { messages: next };
    });
  }, messages);
}

test.beforeAll(() => {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
});

// ---------------------------------------------------------------------------
// Serial block
// ---------------------------------------------------------------------------
test.describe("chat-ui restyle", () => {
  test.describe.configure({ mode: "serial" });

  let claudeAvailable = false;

  test.beforeAll(async () => {
    const { execSync } = await import("child_process");
    try {
      execSync("which claude", { encoding: "utf8" });
      claudeAvailable = true;
    } catch {
      claudeAvailable = false;
    }
  });

  // -------------------------------------------------------------------------
  // C1 — Asymmetric bubbles
  // -------------------------------------------------------------------------
  test("C1. asymmetric bubbles: user bordered/right, assistant plain/full-width", async ({ page }) => {
    await seedSessionNoTurn(page);

    await injectMessages(page, [
      {
        id: "c1-user",
        role: "user",
        text: "hello there, general",
        thinking: "",
        tools: [],
        streaming: false,
      },
      {
        id: "c1-assistant",
        role: "assistant",
        text: "General Kenobi. You are a bold one.",
        thinking: "",
        tools: [],
        streaming: false,
        elapsedSec: 1,
      },
    ]);

    const userBubble = page.locator(".message--user", { hasText: "hello there, general" });
    const assistantBubble = page.locator(".message--assistant", { hasText: "General Kenobi" });
    await expect(userBubble).toBeVisible();
    await expect(assistantBubble).toBeVisible();

    const userStyle = await userBubble.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, borderWidth: cs.borderTopWidth, alignSelf: cs.alignSelf };
    });
    const assistantStyle = await assistantBubble.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, borderWidth: cs.borderTopWidth, alignSelf: cs.alignSelf };
    });

    // User: compact bordered bubble, right-aligned.
    expect(userStyle.borderWidth).not.toBe("0px");
    expect(userStyle.alignSelf).toBe("flex-end");

    // Assistant: no bubble chrome at all.
    expect(assistantStyle.borderWidth).toBe("0px");
    expect(assistantStyle.bg).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);

    // The two roles must not look identical (the old shared-bubble style).
    expect(userStyle.bg).not.toBe(assistantStyle.bg);

    // Hover-reveal copy actions exist for both roles.
    await expect(page.locator('[data-testid="msg-copy-user"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="msg-copy-assistant"]')).toHaveCount(1);

    // "copy to input" actually fills the textarea.
    await page.locator('[data-testid="msg-copy-user"]').click();
    await expect(page.locator(".chat__input textarea")).toHaveValue("hello there, general");

    await page.screenshot({ path: `${SHOTS_DIR}/c1-asymmetric-bubbles.png` });
  });

  // -------------------------------------------------------------------------
  // C2 — Tool-call rows render per-call and expand
  // -------------------------------------------------------------------------
  test("C2. tool-call rows render per-call and expand", async ({ page }) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping C2 tool-row test");
      return;
    }

    await freshSession(page);
    const newBtn = page.locator('[data-testid="new-session-local"]');
    await expect(newBtn).toBeEnabled({ timeout: 10000 });
    await newBtn.click();
    const noneOpt = page.locator('[data-testid="project-option-none"]');
    await expect(noneOpt).toBeVisible({ timeout: 5000 });
    await noneOpt.click();
    await expect(noneOpt).not.toBeVisible({ timeout: 3000 });

    await selectAgentModel(page, "claude", "claude-haiku-4-5");

    const textarea = page.locator(".chat__input textarea");
    await expect(textarea).toBeEnabled({ timeout: 10000 });
    await textarea.fill("Use the Read tool to read the file package.json, then reply with exactly: done");
    await page.locator(".chat__send").click();

    const runningDot = page.locator(".session-item--active .session-status--running");
    await expect(runningDot).toBeVisible({ timeout: 20000 });
    await expect(runningDot).not.toBeVisible({ timeout: 90000 });

    const lastBubble = page.locator(".message--assistant").last();
    await expect(lastBubble).toBeVisible({ timeout: 10000 });

    const workedFor = lastBubble.locator(".message__worked-for");
    if ((await workedFor.count()) === 0) {
      console.log("C2 note: no .message__worked-for on this turn (no thinking/tool_use) — model variance, skipping.");
      test.skip(true, "no worked-for wrapper this turn");
      return;
    }

    // The wrapper auto-collapses once the turn is done — reopen it (same
    // pattern as restyle.spec.ts's C3) so its (also-collapsed-by-default)
    // tool rows are actually in the render tree to interact with.
    await workedFor.evaluate((el) => {
      (el as HTMLDetailsElement).open = true;
    });

    const toolRows = lastBubble.locator('[data-testid^="tool-row-"]');
    const rowCount = await toolRows.count();
    if (rowCount === 0) {
      console.log("C2 note: worked-for present but no tool-row rendered (thinking only, no tool call) — skipping.");
      test.skip(true, "no tool-row this turn");
      return;
    }

    const first = toolRows.first();
    await expect(first).toBeVisible();

    // Collapsed by default (item 2 spec requirement).
    const openBefore = await first.evaluate((el) => (el as HTMLDetailsElement).open);
    expect(openBefore).toBe(false);

    await first.locator("summary").click();
    const openAfter = await first.evaluate((el) => (el as HTMLDetailsElement).open);
    expect(openAfter).toBe(true);

    await page.screenshot({ path: `${SHOTS_DIR}/c2-tool-row-expanded.png` });
  });

  // -------------------------------------------------------------------------
  // C3 — Scroll behavior fix
  // -------------------------------------------------------------------------
  test("C3. scroll: no yank when scrolled up, pill returns to bottom", async ({ page }) => {
    await seedSessionNoTurn(page);

    const seeded = Array.from({ length: 40 }, (_, i) => ({
      id: `c3-seed-${i}`,
      role: i % 2 === 0 ? "user" : "assistant",
      text: `Seed message number ${i} — padding this out so the transcript overflows the visible chat panel height.`,
      thinking: "",
      tools: [],
      streaming: false,
      elapsedSec: 1,
    }));
    await injectMessages(page, seeded);

    const list = page.locator(".chat__list");
    // Sanity: the seeded transcript actually overflows (otherwise there's
    // nothing to scroll and this test would be vacuous).
    await expect
      .poll(async () => list.evaluate((el) => el.scrollHeight > el.clientHeight))
      .toBe(true);

    // Freshly seeded — should auto-stick to the bottom, no pill.
    await expect(page.locator('[data-testid="scroll-bottom-pill"]')).not.toBeVisible();

    // Scroll up away from the bottom.
    await list.evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect(page.locator('[data-testid="scroll-bottom-pill"]')).toBeVisible({ timeout: 3000 });

    const scrollTopBefore = await list.evaluate((el) => el.scrollTop);

    // Append another message (simulates a new streaming chunk arriving)
    // while scrolled up — this must NOT yank the view back to the bottom.
    await injectMessages(page, [
      { id: "c3-late-arrival", role: "assistant", text: "a message that arrives while scrolled up", thinking: "", tools: [], streaming: false },
    ]);
    const scrollTopAfter = await list.evaluate((el) => el.scrollTop);
    expect(scrollTopAfter).toBe(scrollTopBefore);
    await expect(page.locator('[data-testid="scroll-bottom-pill"]')).toBeVisible();

    await page.screenshot({ path: `${SHOTS_DIR}/c3-scroll-pill-visible.png` });

    // Clicking the pill returns to the bottom and hides itself.
    await page.locator('[data-testid="scroll-bottom-pill"]').click();
    await expect(page.locator('[data-testid="scroll-bottom-pill"]')).not.toBeVisible({ timeout: 3000 });
    await expect
      .poll(async () => list.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight))
      .toBeLessThan(48);

    // Stick is re-enabled: one more appended message should NOT bring the
    // pill back.
    await injectMessages(page, [
      { id: "c3-after-return", role: "assistant", text: "stick should be re-enabled now", thinking: "", tools: [], streaming: false },
    ]);
    await expect(page.locator('[data-testid="scroll-bottom-pill"]')).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // C4 — Per-code-block copy button
  // -------------------------------------------------------------------------
  test("C4. per-code-block copy button", async ({ page, context }) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping C4 code-block copy test");
      return;
    }

    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_URL });

    await freshSession(page);
    const newBtn = page.locator('[data-testid="new-session-local"]');
    await expect(newBtn).toBeEnabled({ timeout: 10000 });
    await newBtn.click();
    const noneOpt = page.locator('[data-testid="project-option-none"]');
    await expect(noneOpt).toBeVisible({ timeout: 5000 });
    await noneOpt.click();
    await expect(noneOpt).not.toBeVisible({ timeout: 3000 });

    await selectAgentModel(page, "claude", "claude-haiku-4-5");

    const textarea = page.locator(".chat__input textarea");
    await expect(textarea).toBeEnabled({ timeout: 10000 });
    await textarea.fill(
      "Reply with exactly this markdown (no other text): ```js\nconst answer = 42;\n```",
    );
    await page.locator(".chat__send").click();

    const runningDot = page.locator(".session-item--active .session-status--running");
    await expect(runningDot).toBeVisible({ timeout: 20000 });
    await expect(runningDot).not.toBeVisible({ timeout: 90000 });

    const lastBubble = page.locator(".message--assistant").last();
    const pre = lastBubble.locator(".message__markdown pre").first();
    await expect(pre).toBeVisible({ timeout: 10000 });

    const copyBtn = pre.locator('[data-testid="codeblock-copy"]');
    await expect(copyBtn).toHaveCount(1);

    await copyBtn.click();
    await expect
      .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
      .toContain("const answer = 42;");

    await page.screenshot({ path: `${SHOTS_DIR}/c4-codeblock-copy.png` });
  });

  // -------------------------------------------------------------------------
  // C5 — Inline Edit diff rendering (synthetic injection)
  // -------------------------------------------------------------------------
  test("C5. inline Edit diff renders with per-file badge", async ({ page }) => {
    await seedSessionNoTurn(page);

    await injectMessages(page, [
      {
        id: "c5-edit-msg",
        role: "assistant",
        text: "I updated the greeting.",
        thinking: "",
        tools: [
          {
            name: "Edit",
            input: {
              file_path: "/tmp/example.txt",
              old_string: "hello\nworld\n",
              new_string: "hello\nthere\nworld\n",
            },
            result: "OK",
            done: true,
          },
        ],
        streaming: false,
        elapsedSec: 2,
      },
    ]);

    const lastBubble = page.locator(".message--assistant", { hasText: "I updated the greeting." });
    await expect(lastBubble).toBeVisible();

    // Reopen the (auto-collapsed-when-not-streaming) worked-for wrapper.
    const workedFor = lastBubble.locator(".message__worked-for");
    await expect(workedFor).toHaveCount(1);
    await workedFor.evaluate((el) => {
      (el as HTMLDetailsElement).open = true;
    });

    const toolRow = lastBubble.locator('[data-testid="tool-row-0"]');
    await expect(toolRow).toBeVisible();
    await toolRow.evaluate((el) => {
      (el as HTMLDetailsElement).open = true;
    });

    const diffView = toolRow.locator(".diff-view");
    await expect(diffView).toBeVisible();
    await expect(diffView.locator(".diff-line--add")).toHaveCount(1);
    await expect(diffView.locator(".diff-line--add")).toContainText("there");

    // Per-file badge below the message, with the right +/- counts.
    const badge = lastBubble.locator('[data-testid="diff-badge-/tmp/example.txt"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("+1");
    await expect(badge).toContainText("−0");

    // Clicking the badge (re-)opens the underlying tool-row.
    await toolRow.evaluate((el) => {
      (el as HTMLDetailsElement).open = false;
    });
    await badge.click();
    const isOpen = await toolRow.evaluate((el) => (el as HTMLDetailsElement).open);
    expect(isOpen).toBe(true);

    await page.screenshot({ path: `${SHOTS_DIR}/c5-edit-diff.png` });
  });
});

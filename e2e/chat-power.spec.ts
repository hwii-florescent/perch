/**
 * chat-power.spec.ts — e2e coverage for the three composer "power features"
 * that just landed on top of the chat-ui restyle: slash/skill autocomplete,
 * plan mode, and file attachments (plus a regression guard for the
 * pre-existing codex effort path, to prove the composer rework didn't touch
 * it).
 *
 * P1 "slash autocomplete (no agent turn)":
 *   Seeds a session, types "/" into the composer, and waits for
 *   `composer-slash-popover` to appear with at least one
 *   `composer-slash-item-*` row. `commands.list` is served from a real
 *   `claude -p "/effort" … --no-session-persistence` probe with a 300s
 *   process-global cache (see commands.rs) — the *first* call in a fresh
 *   suite run can take several seconds, so this waits generously rather than
 *   assuming the popover is instant. ArrowDown + Enter must accept a row and
 *   leave the textarea holding `/<name> ` (sigil + bare command name + the
 *   trailing space `applyCommand` appends). No real agent turn is spent —
 *   this only exercises `commands.list` + local autocomplete state.
 *
 * P2 "plan mode round trip (real claude turn)":
 *   Plan cards are claude-only (2.1.x has no ExitPlanMode — agent.rs treats
 *   a `Write` under a session's `.claude/plans/` dir as the plan itself), so this test
 *   pins the agent to claude. Creates a session rooted at a freshly-made
 *   temp dir (via the composer's "type a path" picker — session.create
 *   requires the cwd to already exist server-side, see server.rs's
 *   `SessionCreate` handler), toggles `composer-plan-toggle` on, and asks
 *   the agent to create one specific small file. Asserts a `plan-card`
 *   renders AND the file does not exist on disk (plan mode runs claude with
 *   `--permission-mode plan`, which blocks real writes). Then clicks
 *   `plan-approve` — which always sends with plan mode off regardless of the
 *   composer toggle (see PlanCard.tsx) — and polls for the file to actually
 *   appear.
 *
 * P3 "attachment round trip, no base64 in the DOM (real claude turn)":
 *   Builds a tiny solid-color PNG's bytes in-process (manual PNG chunk/CRC32
 *   encoding — no fetch, no fixture file checked into the repo), stages it
 *   via `page.setInputFiles` against the attachment bar's hidden
 *   `input[type=file]` (the 📎 button only proxies a `.click()` on it — see
 *   AttachmentBar.tsx), and asserts an `attachment-chip-<name>` appears.
 *   Sends a prompt asking what color the image is and asserts the reply
 *   names it. The load-bearing assertion: the full page DOM
 *   (`page.content()`) never contains a `data:image` substring and no single
 *   attribute/text node is an absurdly long blob — AttachmentBar.tsx's own
 *   doc comment says this is deliberate (name-only chips, path-only wire
 *   format) and that an e2e test is expected to hold it to that.
 *
 * P4 "codex low effort still completes (real codex turn)":
 *   Regression guard, not a new-feature test: switches the agent to codex,
 *   sets the Effort chip to "low", sends a trivial prompt, and asserts the
 *   reply arrives and the session status returns to idle — proving the
 *   composer rework (slash popover / plan toggle / attachment bar all now
 *   living in the same input row) didn't regress the pre-existing
 *   agent/model/effort selection path for codex.
 *
 * All tests are headless. P2-P4 run real agent turns against corp's GenAI
 * proxy and are inherently slow — they use the suite's existing
 * composer wait idiom (`.chat__cancel`
 * visible then not-visible), never a fixed `waitForTimeout` sleep for
 * turn completion. P1 has no agent turn in its critical path so it stays
 * fast and reliable; the settling waits it does use are for popover
 * open/close, not agent activity.
 *
 * Nothing here touches the global `~/.perch/settings.json` chat-mode
 * setting (agent/effort selections are per-session client state — see
 * store.ts's `agent`/`effortBySession` — not persisted server-side), so
 * unlike chat-mode.spec.ts / models.spec.ts there is no settings reset
 * needed in beforeAll/afterAll here.
 */

import { test, expect, type Page } from "@playwright/test";
import { createHostedSession } from "./hostedSession";
import { CHEAP_CLAUDE_MODEL, CHEAP_CODEX_MODEL } from "./cheapModel";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as zlib from "zlib";

const BASE_URL = "http://127.0.0.1:7799";
const MODEL_HAIKU = CHEAP_CLAUDE_MODEL;

// ---------------------------------------------------------------------------
// Shared helpers (same conventions as chat-ui.spec.ts / sessions.spec.ts /
// models.spec.ts)
// ---------------------------------------------------------------------------

async function freshPage(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

/** Hosted sessions are created directly; the launcher creates CLI sessions. */
async function seedNoProjectSession(page: Page): Promise<void> {
  await freshPage(page);
  await createHostedSession(page, os.tmpdir());
}

async function seedSessionAtPath(page: Page, cwd: string): Promise<void> {
  await freshPage(page);
  await createHostedSession(page, cwd);
}

/** Select agent + model via the ModelChip popover (same helper shape as
 * models.spec.ts / chat-ui.spec.ts). */
async function selectAgentModel(page: Page, agentId: string, modelId: string): Promise<void> {
  const chip = page.locator('[data-testid="model-chip"]');
  await expect(chip).toBeVisible({ timeout: 10000 });
  await chip.click();
  await page.locator(`[data-testid="agent-option-${agentId}"]`).click();
  await page.locator(`[data-testid="model-option-${modelId}"]`).click();
  await chip.click();
  await expect(page.getByTestId(`model-option-${modelId}`)).toHaveClass(/model-chip__model-btn--active/);
  await page.keyboard.press("Escape");
}

/** Wait for a turn to start then finish: the composer shows Stop only while a
 * message is streaming (the old sidebar running dot is retired). */
async function waitForTurn(page: Page, runningTimeout = 20000, doneTimeout = 90000): Promise<void> {
  const stop = page.locator(".chat__cancel");
  await expect(stop).toBeVisible({ timeout: runningTimeout });
  await expect(stop).toHaveCount(0, { timeout: doneTimeout });
}

async function isCliAvailable(bin: "claude" | "codex"): Promise<boolean> {
  const { execSync } = await import("child_process");
  try {
    execSync(`which ${bin} || [ -x ~/.local/bin/${bin} ]`, { encoding: "utf8", shell: "/bin/sh" });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Minimal solid-color PNG encoder (no external assets, no fetch) — just
// enough of the spec to produce a file real image viewers/agents accept:
// signature, IHDR, one zlib-compressed IDAT (filter-byte-0 scanlines of a
// solid RGB truecolor image), IEND. CRC32 implemented inline (no crypto/zlib
// crc export is exposed by Node for arbitrary buffers).
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/** A solid `width`x`height` truecolor (8-bit RGB, no alpha) PNG of one flat
 * color — small enough to be an obviously-synthetic test fixture, and large
 * enough (8x8, not 1x1) that "what color is this image" is an unambiguous
 * question for the agent. */
function makeSolidPng(width: number, height: number, r: number, g: number, b: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: truecolor
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = pngChunk("IHDR", ihdrData);

  const rowBytes = 1 + width * 3; // filter byte + RGB per pixel
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowBytes;
    raw[rowStart] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 3;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }
  const idat = pngChunk("IDAT", zlib.deflateSync(raw));

  const iend = pngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("chat-power: slash autocomplete, plan mode, attachments, codex effort", () => {
  test.describe.configure({ mode: "serial" });

  let claudeAvailable = false;
  let codexAvailable = false;

  test.beforeAll(async () => {
    claudeAvailable = await isCliAvailable("claude");
    codexAvailable = await isCliAvailable("codex");
  });

  // -------------------------------------------------------------------------
  // P1 — Slash autocomplete (no agent turn)
  // -------------------------------------------------------------------------
  test("P1. slash autocomplete: popover lists commands, ArrowDown+Enter accepts one", async ({ page }) => {
    test.setTimeout(60000);

    await seedNoProjectSession(page);
    // Pin the agent explicitly so the sigil is deterministically "/" (claude)
    // rather than relying on the store's default — see AGENT_SIGIL in
    // composerCommands.ts.
    await selectAgentModel(page, "claude", MODEL_HAIKU);

    const textarea = page.locator(".chat__input textarea");
    await expect(textarea).toBeEnabled({ timeout: 10000 });
    await textarea.click();
    await textarea.type("/");

    // First `commands.list` call in a fresh suite run does a real
    // `claude -p "/effort" … --no-session-persistence` probe (commands.rs) —
    // give it real headroom rather than assuming an instant local answer.
    const popover = page.locator('[data-testid="composer-slash-popover"]');
    await expect(popover).toBeVisible({ timeout: 30000 });

    const items = page.locator('[data-testid^="composer-slash-item-"]');
    const count = await items.count();
    // The probe can legitimately return zero commands in a bare environment
    // (no slash_commands/skills configured for this claude install) — fail
    // with a clear, specific message rather than a confusing popover-timeout
    // if that happens, since the popover only renders at all when
    // `slashEntries.length > 0` (see Chat.tsx's `slashOpen`), so reaching
    // this point already proves count > 0. This assertion documents that
    // invariant rather than duplicating the wait.
    expect(count, "commands.list probe returned zero commands — no slash items to accept").toBeGreaterThan(0);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await expect(popover).not.toBeVisible({ timeout: 5000 });
    const value = await textarea.inputValue();
    // applyCommand always produces "<sigil><name><trailing space>".
    expect(value).toMatch(/^\/\S+ $/);

    await page.screenshot({ path: "artifacts/p1-slash-accepted.png" });
  });

  // -------------------------------------------------------------------------
  // P2 — Plan mode round trip (real claude turn, claude-only feature)
  // -------------------------------------------------------------------------
  test("P2. plan mode: plan-card renders before any write, approve creates the file", async ({ page }) => {
    test.setTimeout(180000);

    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping P2 (plan cards are claude-only, need a real turn)");
      return;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-e2e-plan-"));
    const targetFile = path.join(tmpDir, "plan-output.txt");

    try {
      await seedSessionAtPath(page, tmpDir);
      await selectAgentModel(page, "claude", MODEL_HAIKU);

      await page.locator('[data-testid="composer-plan-toggle"]').click();
      await expect(page.locator('[data-testid="composer-plan-toggle"]')).toHaveClass(/composer-plan-toggle--active/);

      const textarea = page.locator(".chat__input textarea");
      await expect(textarea).toBeEnabled({ timeout: 10000 });
      await textarea.fill(
        `Plan (do not execute yet) creating a new file named plan-output.txt in the current directory ` +
          `containing exactly the text: plan-ok`,
      );
      await page.locator(".chat__send").click();

      await waitForTurn(page);

      const planCard = page.locator('[data-testid="plan-card"]');
      await expect(planCard).toBeVisible({ timeout: 10000 });

      // Plan mode (claude `--permission-mode plan`) must have blocked any
      // real write — the file must not exist yet.
      expect(fs.existsSync(targetFile), "plan mode should not have created the file before approval").toBe(false);

      await page.screenshot({ path: "artifacts/p2-plan-card.png" });

      // Approving always sends with plan mode off (PlanCard.tsx), regardless
      // of the composer toggle's own state — this is the turn that should
      // actually create the file.
      const approveBtn = page.locator('[data-testid="plan-approve"]');
      await expect(approveBtn).toBeEnabled({ timeout: 5000 });
      await approveBtn.click();

      await waitForTurn(page, 20000, 120000);

      await expect
        .poll(() => fs.existsSync(targetFile), {
          message: "expected plan-output.txt to be created after plan approval",
          timeout: 30000,
        })
        .toBe(true);

      await page.screenshot({ path: "artifacts/p2-plan-approved-file-created.png" });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // P3 — Attachment round trip, no base64 ever reaches the DOM
  // -------------------------------------------------------------------------
  test("P3. attachment: chip appears, reply names the color, no base64 blob in the DOM", async ({ page }) => {
    test.setTimeout(150000);

    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping P3 (needs a real turn to describe the image)");
      return;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-e2e-attach-"));
    const pngPath = path.join(tmpDir, "swatch.png");
    // Solid red, 8x8 — big enough to be an unambiguous "what color" question,
    // small enough to keep the fixture trivial.
    fs.writeFileSync(pngPath, makeSolidPng(8, 8, 220, 30, 30));

    try {
      await seedNoProjectSession(page);
      await selectAgentModel(page, "claude", MODEL_HAIKU);

      // The 📎 button only proxies a .click() onto this hidden input (see
      // AttachmentBar.tsx) — target the input directly rather than the button.
      const fileInput = page.locator('.attachment-bar input[type="file"]');
      await fileInput.setInputFiles(pngPath);

      const chip = page.locator('[data-testid="attachment-chip-swatch.png"]');
      await expect(chip).toBeVisible({ timeout: 10000 });

      const textarea = page.locator(".chat__input textarea");
      await expect(textarea).toBeEnabled({ timeout: 10000 });
      await textarea.fill(
        "Look at the attached image and reply with just the single dominant color name, lowercase, one word (e.g. \"red\").",
      );
      await page.locator(".chat__send").click();

      await waitForTurn(page, 20000, 120000);

      const lastBubble = page.locator(".message--assistant").last();
      await expect(lastBubble).toBeVisible({ timeout: 10000 });
      await expect(lastBubble).toContainText(/red/i, { timeout: 10000 });

      // Load-bearing assertion: strip_image_blocks (server) + the name-only
      // chip design (AttachmentBar.tsx) together guarantee the raw image
      // bytes never reach the browser as a data: URI or long inline blob.
      const html = await page.content();
      expect(html).not.toContain("data:image");

      const { maxAttrLen, maxTextLen } = await page.evaluate(() => {
        let maxAttrLen = 0;
        let maxTextLen = 0;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ALL);
        let node: Node | null = walker.currentNode;
        while (node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            for (const attr of Array.from(el.attributes)) {
              if (attr.value.length > maxAttrLen) maxAttrLen = attr.value.length;
            }
          } else if (node.nodeType === Node.TEXT_NODE) {
            const len = node.textContent?.length ?? 0;
            if (len > maxTextLen) maxTextLen = len;
          }
          node = walker.nextNode();
        }
        return { maxAttrLen, maxTextLen };
      });
      // A base64-encoded 8x8 PNG (or any real image) would be at least
      // several hundred characters as a single attribute/text blob; markdown
      // prose and CSS/class attributes never get remotely this long.
      expect(maxAttrLen, "an element attribute is suspiciously long — possible base64 image blob").toBeLessThan(2000);
      expect(maxTextLen, "a text node is suspiciously long — possible base64 image blob").toBeLessThan(2000);

      await page.screenshot({ path: "artifacts/p3-attachment-reply.png" });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // P4 — Codex low effort still completes (regression guard, real codex turn)
  // -------------------------------------------------------------------------
  test("P4. codex with effort=low completes a trivial turn", async ({ page }) => {
    test.setTimeout(120000);

    if (!codexAvailable) {
      test.skip(true, "codex binary not found — skipping P4");
      return;
    }

    await seedNoProjectSession(page);
    await selectAgentModel(page, "codex", CHEAP_CODEX_MODEL);

    const effortChip = page.locator('[data-testid="effort-chip"]');
    await expect(effortChip).toBeVisible({ timeout: 10000 });
    await effortChip.click();
    await page.locator('[data-testid="effort-option-low"]').click();
    await expect(effortChip).toContainText("low");

    const textarea = page.locator(".chat__input textarea");
    await expect(textarea).toBeEnabled({ timeout: 10000 });
    await textarea.fill("Reply with exactly the word: pong");
    await page.locator(".chat__send").click();

    await waitForTurn(page, 20000, 90000);

    // Turn completed and the session status is back to idle: the running
    // dot's disappearance in waitForTurn already proves this, and there must
    // be no lingering running indicator anywhere for this session.
    await expect(page.locator(".chat__cancel")).toHaveCount(0);

    const lastBubble = page.locator(".message--assistant").last();
    await expect(lastBubble).toBeVisible({ timeout: 10000 });
    await expect(lastBubble).toContainText(/pong/i, { timeout: 10000 });

    await page.screenshot({ path: "artifacts/p4-codex-low-effort.png" });
  });
});

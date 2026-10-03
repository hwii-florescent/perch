#!/usr/bin/env node
/**
 * Visual-parity harness for the Tailwind migration (docs/TAILWIND-MIGRATION.md).
 *
 *   node e2e/visual/visual.mjs snap <web-dist-dir> <out-root> [--engines chromium,webkit] [--only <state-substring>]
 *   node e2e/visual/visual.mjs diff <out-root-a> <out-root-b> [--engines chromium,webkit] [--only <s>] [--reviewed <state,state>]
 *   node e2e/visual/visual.mjs states          # expected state names, as JSON
 *   node e2e/visual/selftest.mjs [--with-snap] # proves failed/empty runs cannot pass
 *
 * `snap` boots an isolated headless core on a fixed port against a fixed
 * fixture, serves <web-dist-dir> (PERCH_WEB_DIST), walks the UI through every
 * state in STATES and records, per state: a screenshot, the computed style +
 * box of every element, a hover dump and a keyboard-focus dump. `diff`
 * compares two such runs element by element (class names are ignored: they
 * change during the migration, the computed result must not).
 *
 * It FAILS CLOSED. `snap` exits nonzero on any state failure or page error.
 * `diff` exits nonzero (and never prints IDENTICAL) when either run has
 * failures, an empty or missing capture, or lacks any expected state/engine,
 * and on any screenshot pixel difference unless that state was reviewed
 * (`--reviewed`, after looking at <out-root-b>/review/*.diff.png).
 * Engines: Chromium and WebKit (the Mac app is a WKWebView).
 *
 * Headless only; never touches ~/.perch.
 */
import { chromium, webkit } from "@playwright/test";
import { spawn, execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = 7791;
const URL_ = `http://127.0.0.1:${PORT}`;
const WORK = "/tmp/perch-visual";
const REPO = `${WORK}/repo`;
const pinGitScroll = (page) => page.getByTestId("workspace-git-review").evaluate((root) => { for (const el of [root, ...root.querySelectorAll("*")]) if (el.scrollTop > 0) el.scrollTop = 0; });

const PROPS = [
  "display", "position", "top", "right", "bottom", "left", "z-index", "float",
  "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis", "align-items", "align-self", "align-content",
  "justify-content", "justify-items", "justify-self", "order", "gap", "row-gap", "column-gap",
  "grid-template-columns", "grid-template-rows", "grid-column-start", "grid-column-end", "grid-row-start", "grid-row-end", "grid-auto-flow",
  "width", "height", "min-width", "min-height", "max-width", "max-height", "box-sizing", "aspect-ratio",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
  "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
  "outline-style", "outline-width", "outline-color", "outline-offset", "box-shadow",
  "color", "background-color", "background-image", "opacity", "visibility", "filter", "backdrop-filter", "mix-blend-mode",
  "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-transform", "text-align",
  "text-decoration-line", "text-overflow", "white-space", "word-break", "overflow-wrap", "-webkit-line-clamp", "-webkit-box-orient",
  "overflow-x", "overflow-y", "cursor", "pointer-events", "user-select", "resize", "tab-size",
  "transform", "transition-property", "transition-duration", "transition-timing-function", "animation-name", "accent-color",
  "container-type", "content", "list-style-type", "vertical-align", "object-fit",
];
const HOVER_PROPS = ["color", "background-color", "border-top-color", "box-shadow", "opacity", "visibility", "display", "transform", "outline-style", "text-decoration-line"];

// --------------------------------------------------------------- page side --

/** Everything below runs in the page. */
const DUMP = ({ props, skipSel }) => {
  const out = [];
  const walk = (el, p) => {
    if (["SCRIPT", "STYLE", "LINK", "META", "NOSCRIPT"].includes(el.tagName)) return;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const rec = {
      p,
      tag: el.tagName.toLowerCase(),
      id: el.getAttribute("data-testid") || "",
      cls: el.getAttribute("class") || "",
      rect: [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 100) / 100),
      text: [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).filter(Boolean).join("|")
        .replace(/\d+\/\d+\/\d+, \d+:\d+:\d+ [AP]M/g, "<mtime>").replace(/\b[0-9a-f]{8}\b/g, "<id>"),
      s: {},
    };
    for (const k of props) rec.s[k] = cs.getPropertyValue(k);
    for (const pseudo of ["::before", "::after"]) {
      const ps = getComputedStyle(el, pseudo);
      const c = ps.getPropertyValue("content");
      if (c && c !== "none" && c !== "normal") {
        rec["s" + pseudo] = Object.fromEntries(["content", "display", "position", "width", "height", "top", "right", "bottom", "left", "background-color", "color", "opacity", "border-top-width", "border-top-color", "transform"].map((k) => [k, ps.getPropertyValue(k)]));
      }
    }
    out.push(rec);
    if (el.matches(skipSel)) return; // xterm / dockview internals: container only
    [...el.children].forEach((c, i) => walk(c, p + "/" + i));
  };
  walk(document.body, "body");
  return out;
};

const HOVER_DUMP = (el, props) => {
  const group = el.parentElement?.parentElement || el.parentElement || el;
  const nodes = [el, ...group.querySelectorAll("*")].slice(0, 80);
  return nodes.map((n) => {
    const cs = getComputedStyle(n);
    return Object.fromEntries(props.map((k) => [k, cs.getPropertyValue(k)]));
  });
};

const SKIP_SEL = ".xterm, .dv-render-overlay, .dv-tabs-and-actions-container svg";

// ------------------------------------------------------------------ states --

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const git = (args, cwd) => execSync(`git ${args}`, { cwd, stdio: "pipe", input: "", env: { ...process.env, GIT_AUTHOR_NAME: "v", GIT_AUTHOR_EMAIL: "v@v", GIT_COMMITTER_NAME: "v", GIT_COMMITTER_EMAIL: "v@v", GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z", GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z" } });

async function press(page, k) { await page.keyboard.press(k); await sleep(250); }
async function closeOverlays(page) { await page.keyboard.press("Escape"); await sleep(150); await page.keyboard.press("Escape"); await sleep(150); }

/** Ordered: later states build on earlier ones. A state returns nothing; it
 * leaves the page in the state to capture. */
const STATES = [
  { name: "01-home", run: async () => {} },
  // CLI start panel with provider discovery failed: empty disabled picker, error status + Retry,
  // disabled project / Chats buttons. 01a2 restores the real manifests.
  { name: "01a-cli-start-error", run: async (page) => {
    await page.evaluate(() => {
      const st = window.usePerchStore;
      window.__visManifests = st.getState().agentManifestsByHost;
      st.setState({ agentManifestsByHost: { ...window.__visManifests, local: { ...(window.__visManifests.local ?? {}), state: "error", error: "Provider discovery failed (vis)", manifests: [] } } });
    });
    await page.getByText("Provider discovery failed (vis)").waitFor();
    await sleep(300);
  } },
  { name: "01a2-cli-start-restored", nocapture: true, run: async (page) => {
    await page.evaluate(() => window.usePerchStore.setState({ agentManifestsByHost: window.__visManifests }));
    await sleep(300);
  } },
  // Host switcher: popover (local connected, direct badge, disabled, an injected error row),
  // a remote selected (HOST header, disabled + New session), then back to local.
  { name: "01b-host-switcher", run: async (page) => {
    await page.evaluate(() => window.usePerchStore.setState((st) => ({ hostStates: { ...st.hostStates, "vis-b": { type: "host.info", hostId: "vis-b", name: "vis-b", state: "error", error: "perch not installed on remote (vis-b.example.invalid)" } } })));
    await page.getByTestId("host-switcher").click();
    await page.getByTestId("host-switcher-popover").waitFor();
    await page.getByTestId("host-error-vis-b").waitFor();
    await sleep(300);
  } },
  { name: "01c-host-selected", run: async (page) => {
    await page.getByTestId("host-option-vis-a").click();
    await page.getByTestId("host-switcher-popover").waitFor({ state: "detached" });
    await sleep(400);
  } },
  // The per-host project list (hosts without workspace.snapshot): project rows with an
  // active project's sessions, git branch + ahead/behind, a plain cwd subline, and the
  // hover-revealed delete button. State is injected; the server knows nothing of vis-a.
  { name: "01c2-host-sessions", run: async (page) => {
    await page.evaluate(() => {
      const now = new Date("2026-01-01T12:00:00Z").getTime();
      const mk = (id, title, cwd, ago, extra = {}) => ({ id, title, cwd, createdAt: now - ago, status: "idle", hostId: "vis-a", ...extra });
      window.usePerchStore.setState({
        sessions: [mk("vis-s1", "Fix the parser", "/srv/app", 120000), mk("vis-s2", "", "/srv/app", 7200000, { blocked: true }), mk("vis-s3", "Docs", "/srv/docs", 90000000)],
        workspaceGit: { "vis-a:/srv/app": { branch: "feature/long-branch-name-here", ahead: 2, behind: 1 } },
      });
    });
    await page.locator('[data-testid="project-row"]').first().click();
    await sleep(300);
  } },
  // The CLI start panel of a listed, not-yet-started session: the "Start in <folder>" primary button.
  { name: "01c2b-cli-start-primary", run: async (page) => {
    await page.evaluate(() => { window.__visSid = window.usePerchStore.getState().sessionId; window.usePerchStore.setState({ sessionId: "vis-s1" }); });
    await page.getByTestId("cli-start-here").waitFor();
    await sleep(300);
  } },
  { name: "01c3-session-row-hover", holdHover: "[data-session-id]", run: async () => {} },
  { name: "01c4-session-delete-hover", holdHover: '[data-testid^="session-delete-icon-"]', run: async (page) => {
    await page.locator("[data-session-id]").first().hover(); // reveals the button first
  } },
  { name: "01d-host-local", nocapture: true, run: async (page) => {
    await page.evaluate(() => window.usePerchStore.setState({ sessions: [], workspaceGit: {}, sessionId: window.__visSid ?? null }));
    await page.getByTestId("host-switcher").click();
    await page.getByTestId("host-option-local").click();
    await page.getByTestId("host-switcher-popover").waitFor({ state: "detached" });
    await sleep(400);
  } },
  { name: "02-project-added", run: async (page, ctx) => {
    await page.getByTestId("workspace-add-project").click();
    await page.getByTestId("workspace-add-form").getByTestId("dir-browser-mode-toggle").click();
    await page.getByTestId("workspace-add-form").getByTestId("project-path-input").fill(REPO);
    await page.getByTestId("workspace-add-form").getByTestId("dir-browser-use").click();
    const project = page.locator(".workspace-project").filter({ hasText: "repo" });
    await project.waitFor({ timeout: 15000 });
    const entry = project.locator('[data-testid^="workspace-entry-"]').first();
    await entry.waitFor({ timeout: 15000 });
    ctx.workspaceId = (await entry.getAttribute("data-testid")).slice("workspace-entry-".length);
    ctx.projectId = (await project.locator('[data-testid^="workspace-project-menu-"]').first().getAttribute("data-testid")).slice("workspace-project-menu-".length);
  } },
  { name: "03-add-form", run: async (page) => { await page.getByTestId("workspace-add-project").click(); await sleep(200); } },
  // Directory browser: a directory with git checkouts (badge), a filter that matches nothing,
  // then type-a-path mode (Use disabled, then enabled).
  { name: "03b-dirbrowser-git-badge", run: async (page) => {
    const up = page.getByTestId("dir-browser-up");
    await up.click(); await sleep(250);
    await up.click(); await sleep(250);
    for (const name of ["private", "tmp", "perch-visual"]) { await page.getByTestId(`dir-browser-entry-${name}`).click(); await sleep(250); }
    await page.getByTestId("dir-browser-entry-repo").waitFor();
    await sleep(200);
  } },
  { name: "03c-dirbrowser-filter-empty", run: async (page) => {
    await page.getByTestId("dir-browser-filter").fill("zzzqqq");
    await page.getByText("No subfolders").waitFor();
    await sleep(200);
  } },
  { name: "03d-dirbrowser-type-path", run: async (page) => {
    await page.getByTestId("dir-browser-mode-toggle").click();
    await page.getByTestId("project-path-input").waitFor();
    await sleep(200);
  } },
  { name: "03e-dirbrowser-type-filled", run: async (page) => {
    await page.getByTestId("project-path-input").fill("/tmp/perch-visual/repo");
    await sleep(200);
  } },
  { name: "04-new-session-popover", run: async (page) => {
    await page.getByTestId("workspace-add-project").click().catch(() => {});
    await closeOverlays(page);
    await page.getByTestId("new-session-local").click();
    await page.getByTestId("new-session-popover-agent").waitFor();
  } },
  { name: "05-session-running", run: async (page, ctx) => {
    await page.getByTestId("new-session-popover-agent").selectOption("terminal");
    await page.getByTestId("project-option-0").click();
    await page.getByTestId("persistent-agent-terminal").waitFor({ timeout: 30000 });
    await page.locator('[data-testid="persistent-agent-terminal"][data-terminal-id]').waitFor({ timeout: 30000 });
    await sleep(1500);
    const tab = page.locator('[data-testid^="tab-"]:not([data-testid^="tab-close"]):not([data-testid="tab-bar"]):not([data-testid="tab-new"])').first();
    ctx.tabId = (await tab.getAttribute("data-testid")).slice(4);
  } },
  // Terminal find bar: Cmd+F opens it with the input focused (autoFocus).
  { name: "05b-terminal-search", run: async (page) => {
    await page.locator(".terminal__surface, .xterm").first().click();
    await page.keyboard.press("Meta+F");
    const input = page.getByTestId("term-search-input");
    await input.waitFor({ timeout: 5000 });
    if (!(await input.evaluate((n) => n === document.activeElement))) throw new Error("term-search input not focused");
    await input.fill("sentinel");
    await sleep(300);
  } },
  // Keyboard focus on the find bar's input and Previous/Next/Close buttons.
  { name: "05b2-terminal-search-focus", focusWalk: {
    start: '[data-testid="term-search-input"]',
    targets: ['[data-testid="term-search"] [title^="Previous"]', '[data-testid="term-search"] [title^="Next"]', '[data-testid="term-search"] [title^="Close"]'],
  }, run: async (page) => {
    await page.getByTestId("term-search-input").click();
    await sleep(200);
  } },
  // Close behaviour: Escape closes, and so does the x button.
  { name: "05c-terminal-search-closed", run: async (page) => {
    const bar = page.getByTestId("term-search");
    const step = (what, p) => p.catch((e) => { throw new Error(`${what}: ${e.message.split("\n")[0]}`); });
    await page.getByTestId("term-search-input").click(); // capture ends with the focus walk blurred
    await page.keyboard.press("Escape");
    await step("Escape closes the bar", bar.waitFor({ state: "detached", timeout: 3000 }));
    await page.keyboard.press("Meta+F");
    await step("Cmd+F reopens the bar", page.getByTestId("term-search-input").waitFor({ timeout: 5000 }));
    await bar.getByTitle("Close (Escape)").click();
    await step("x button closes the bar", bar.waitFor({ state: "detached", timeout: 3000 }));
    await sleep(300);
  } },
  // Status bar, reconnecting (red dot) and with the optional ctx/cost items.
  { name: "05d-statusbar-reconnecting-extras", run: async (page) => {
    await page.evaluate(() => {
      const st = window.usePerchStore;
      st.setState({ connected: false, status: { ...(st.getState().status ?? { cwd: "/", branch: "main" }), contextTokens: 12345, costUsd: 0.0421 } });
    });
    await page.getByTitle("reconnecting...").waitFor();
    await sleep(300);
  } },
  { name: "05e-statusbar-restored", run: async (page) => {
    await page.evaluate(() => {
      const st = window.usePerchStore;
      const { contextTokens, costUsd, ...rest } = st.getState().status ?? {};
      st.setState({ connected: true, status: rest.cwd ? rest : st.getState().status });
    });
    await sleep(300);
  }, nocapture: true },
  // Tab strip with two tabs: inactive tab, drag source/target, inline rename.
  // The second session is closed again by 05i so later states are unchanged.
  { name: "05f-two-tabs", run: async (page, ctx) => {
    await page.getByTestId("tab-new").click();
    await page.getByTestId("new-session-popover-agent").selectOption("terminal");
    await page.getByTestId("project-option-0").click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="tab-"]:not([data-testid^="tab-close"]):not([data-testid="tab-bar"]):not([data-testid="tab-new"])').length === 2, null, { timeout: 30000 });
    await page.locator('[data-testid="persistent-agent-terminal"][data-terminal-id]:visible').first().waitFor({ timeout: 30000 });
    const ids = await page.locator('[data-testid^="tab-"]:not([data-testid^="tab-close"]):not([data-testid="tab-bar"]):not([data-testid="tab-new"])').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid").slice(4)));
    if (ids.length !== 2) throw new Error(`expected 2 tabs, got ${ids.length}`);
    ctx.tab2Id = ids.find((i) => i !== ctx.tabId);
    await sleep(1200);
  } },
  { name: "05g-tab-drag-over", run: async (page, ctx) => {
    const dt = await page.evaluateHandle(() => new DataTransfer());
    await page.getByTestId(`tab-${ctx.tabId}`).dispatchEvent("dragstart", { dataTransfer: dt });
    await page.getByTestId(`tab-${ctx.tab2Id}`).dispatchEvent("dragover", { dataTransfer: dt });
    await sleep(200);
    if (!(await page.getByTestId(`tab-${ctx.tabId}`).evaluate((n) => getComputedStyle(n).opacity === "0.5"))) throw new Error("source tab not in dragging state");
  } },
  { name: "05h-tab-rename", run: async (page, ctx) => {
    await page.getByTestId(`tab-${ctx.tabId}`).dispatchEvent("dragend");
    await page.getByTestId(`tab-${ctx.tab2Id}`).dblclick();
    await page.getByTestId("rename-input").waitFor();
    await sleep(200);
  } },
  { name: "05i-two-tabs-closed", nocapture: true, run: async (page, ctx) => {
    // the capture ends by blurring, which already commits the (unchanged) rename
    if (await page.getByTestId("rename-input").count()) await page.getByTestId("rename-input").press("Escape");
    await page.getByTestId(`tab-close-${ctx.tab2Id}`).click();
    await page.getByTestId(`tab-${ctx.tab2Id}`).waitFor({ state: "detached", timeout: 10000 });
    await page.getByTestId(`tab-${ctx.tabId}`).click();
    await sleep(800);
  } },
  { name: "06-tab-hover-menu", run: async (page, ctx) => {
    await page.getByTestId(`tab-${ctx.tabId}`).click({ button: "right" });
    await sleep(300);
  } },
  // Pane menu in its inline-rename mode (input focused), then the plain menu again.
  { name: "06b-pane-menu-rename", run: async (page) => {
    await page.getByTestId("pane-menu-rename").click();
    const input = page.getByTestId("pane-menu-rename-input");
    await input.waitFor();
    await input.fill("renamed pane");
    await sleep(300);
  } },
  { name: "07-settings", run: async (page) => {
    await closeOverlays(page);
    await page.getByTestId("settings-gear").click();
    await page.getByTestId("settings-modal").waitFor();
    await sleep(400);
  } },
  { name: "08-settings-scrolled", run: async (page) => {
    await page.getByTestId("settings-modal").evaluate((m) => { m.querySelectorAll("*").forEach((n) => { if (n.scrollHeight > n.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(n).overflowY)) n.scrollTop = n.scrollHeight; }); });
    await sleep(300);
  } },
  // Settings with a custom model row, a pairing code, then the Agents subpage and back.
  { name: "08b-settings-model-and-pair", run: async (page) => {
    const block = page.locator(".settings-modal__agent-block", { hasText: "claude" });
    await block.getByPlaceholder("Model ID").fill("vis-model-1");
    await block.getByPlaceholder("Label (optional)").fill("Visual model");
    await block.getByRole("button", { name: "Add" }).click();
    await page.locator(".settings-modal__model-row", { hasText: "vis-model-1" }).waitFor();
    await page.getByTestId("pair-start").click();
    const box = page.getByTestId("pair-code");
    await box.waitFor();
    // the code is random and the countdown ticks: swap both for static clones (React updates the detached originals)
    await box.evaluate((b) => { for (const el of b.querySelectorAll("strong, span")) { const c = el.cloneNode(true); c.textContent = el.tagName === "STRONG" ? "ABCD-EFGH" : "Enter it on the other device. Expires in 4:59."; el.replaceWith(c); } });
    await box.scrollIntoViewIfNeeded();
    await sleep(300);
  } },
  { name: "08c-settings-agents", run: async (page) => {
    await page.getByRole("button", { name: "Manage agents" }).click();
    await page.getByTestId("agent-catalog").waitFor();
    await sleep(800);
  } },
  { name: "08c2-agents-search", run: async (page) => {
    await page.getByRole("searchbox", { name: "Search agents" }).fill("cod");
    await sleep(300);
  } },
  { name: "08c3-agents-no-match", run: async (page) => {
    await page.getByRole("searchbox", { name: "Search agents" }).fill("zzzqqq");
    await page.getByText("No agents match your search.").waitFor();
    await sleep(200);
  } },
  { name: "08c4-agents-clear", run: async (page) => {
    await page.getByRole("searchbox", { name: "Search agents" }).fill("");
    await sleep(300);
  } },
  { name: "08d-settings-back", run: async (page) => {
    await page.getByTestId("settings-back").click();
    await page.locator(".settings-modal__model-row", { hasText: "vis-model-1" }).getByRole("button", { name: "Remove" }).click();
    await page.locator(".settings-modal__model-row", { hasText: "vis-model-1" }).waitFor({ state: "detached" });
    await sleep(300);
  } },
  { name: "09-navigator", run: async (page) => {
    await closeOverlays(page);
    await page.keyboard.press("Meta+k");
    await page.getByTestId("navigator").waitFor();
    await sleep(300);
  } },
  { name: "09b-navigator-empty", run: async (page) => {
    await page.getByTestId("navigator-input").fill("zzzqqq");
    await page.getByText("No matches").waitFor();
    await sleep(200);
  } },
  { name: "09c-navigator-chip", run: async (page) => {
    await page.getByTestId("navigator-input").fill("");
    await page.locator('[data-testid^="navigator-filter-"]').nth(1).click();
    await sleep(200);
  } },
  { name: "10-keybind-help", run: async (page) => {
    await closeOverlays(page);
    await page.keyboard.press("Control+Space");
    await page.keyboard.press("?");
    await page.getByTestId("keybind-help").waitFor();
    await sleep(300);
  } },
  { name: "10b-keybind-help-empty", run: async (page) => {
    await page.getByTestId("keybind-help-search").fill("zzzqqq");
    await page.getByText("No matching keybindings").waitFor();
    await sleep(200);
  } },
  { name: "11-drawer-files", run: async (page, ctx) => {
    await closeOverlays(page);
    await page.locator(`[data-testid="workspace-entry-${ctx.workspaceId}"] .workspace-entry__button`).first().click();
    if (!(await page.getByTestId("workspace-tools").count())) await page.getByTestId("workspace-tools-toggle").click();
    await page.getByTestId("workspace-tools-files").click();
    await page.getByTestId("workspace-files-view").waitFor({ timeout: 20000 });
    await sleep(500);
  } },
  // Keyboard focus on the column dividers (focus-visible highlight) and the drawer's buttons.
  { name: "11b-drawer-focus", focusWalk: {
    start: '[data-testid="resize-tools"]',
    targets: ['[data-testid="resize-sidebar"]', '[data-testid="workspace-tools-files"]', '[data-testid="workspace-tools"] button[aria-label="Close Files and Git"]'],
  }, run: async (page) => {
    await page.getByTestId("resize-tools").focus();
    await sleep(200);
  } },
  { name: "12-file-open", run: async (page) => {
    await page.getByTestId("workspace-file-entry-src").click();
    await page.getByTestId("workspace-file-entry-src/main.txt").click();
    await page.getByTestId("workspace-file-editor").waitFor({ timeout: 15000 });
    await sleep(400);
  } },
  // The file editor: dirty draft, wrap + find, preview, reload confirm, on-disk conflict (+ compare), then back to clean.
  { name: "12b-file-edit", run: async (page) => {
    const editor = page.getByTestId("workspace-file-editor");
    await editor.click();
    await page.keyboard.type("edit ");
    await page.getByTitle("Unsaved changes").waitFor();
    await sleep(900);
  } },
  { name: "12c-file-wrap-find", run: async (page) => {
    await page.getByRole("button", { name: "Wrap", exact: true }).click();
    await page.getByTestId("workspace-file-search").fill("sentinel");
    await sleep(300);
  } },
  { name: "12d-file-preview", run: async (page) => {
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page.getByTestId("workspace-file-preview-content").waitFor({ timeout: 15000 });
    await sleep(300);
  } },
  { name: "12e-file-reload-confirm", run: async (page) => {
    await page.getByRole("button", { name: "Reload", exact: true }).click();
    await page.getByTestId("workspace-file-reload-confirm").waitFor();
    await sleep(300);
  } },
  { name: "12f-file-conflict", run: async (page) => {
    await page.getByRole("button", { name: "Keep draft" }).click();
    fs.appendFileSync(`${REPO}/src/main.txt`, "changed on disk\n");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByTestId("workspace-file-conflict").waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: "Compare" }).click();
    await page.getByTestId("workspace-file-compare").waitFor({ timeout: 15000 });
    await sleep(400);
  } },
  { name: "12g-file-clean", nocapture: true, run: async (page) => {
    await page.getByRole("button", { name: "Reload disk" }).click();
    await page.getByRole("button", { name: "Discard and reload" }).click();
    fs.writeFileSync(`${REPO}/src/main.txt`, "modified sentinel with a fairly long line of content\n");
    const PINNED = new Date("2026-01-01T12:00:00Z");
    fs.utimesSync(`${REPO}/src/main.txt`, PINNED, PINNED);
    await page.getByRole("button", { name: "Reload", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="workspace-file-editor"]')?.value === "modified sentinel with a fairly long line of content\n", null, { timeout: 15000 });
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page.getByRole("button", { name: "Wrap", exact: true }).click();
    await page.getByTestId("workspace-file-search").fill("");
    await sleep(500);
  } },
  // More tree rows: symlink glyph, RO badge, an empty folder, an unreadable folder (error + Retry), the HTML preview.
  { name: "12h-tree-extras", run: async (page) => {
    fs.chmodSync(`${REPO}/locked-dir`, 0o000);
    await page.getByTestId("workspace-file-entry-empty-dir").click();
    await page.getByText("Empty folder").waitFor();
    await page.getByTestId("workspace-file-entry-locked-dir").click();
    await page.getByRole("button", { name: "Retry" }).waitFor({ timeout: 15000 });
    await sleep(300);
  } },
  { name: "12i-html-preview", run: async (page) => {
    fs.chmodSync(`${REPO}/locked-dir`, 0o755);
    await page.getByTestId("workspace-file-entry-page.html").click();
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page.locator("iframe[title=\"Sandboxed file preview\"]").waitFor({ timeout: 15000 });
    await sleep(500);
  } },
  { name: "12j-tree-cleanup", nocapture: true, run: async (page) => {
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page.getByTestId("workspace-file-entry-src/main.txt").click();
    await page.getByTestId("workspace-file-entry-empty-dir").click();
    await page.getByTestId("workspace-file-entry-locked-dir").click();
    await sleep(400);
  } },
  { name: "13-drawer-git", run: async (page) => {
    await page.getByTestId("workspace-tools-gitReview").click();
    await page.getByTestId("workspace-git-review").waitFor({ timeout: 20000 });
    await page.getByTestId("git-diff").waitFor({ timeout: 20000 });
    await sleep(600);
  } },
  { name: "14-git-comment", run: async (page) => {
    const line = page.locator('[data-testid="git-diff-line"][data-side="new"]').first();
    await line.hover();
    await line.getByTestId("git-comment-add").click();
    await page.getByTestId("git-comment-composer").waitFor();
    await page.getByTestId("git-comment-body").fill("a review note");
    // focusing the textarea scrolls the panel by an engine-dependent amount: pin the scrollers to the top
    await pinGitScroll(page);
    await sleep(300);
  } },
  // Broken repo -> Refresh -> "Status unavailable" (connection --error, status note); restoring it -> ready again.
  { name: "14b-git-status-error", run: async (page) => {
    fs.renameSync(`${REPO}/.git`, `${REPO}/.git.off`);
    await page.getByTestId("git-refresh").click();
    await page.getByText("Status unavailable").waitFor({ timeout: 20000 });
    await pinGitScroll(page);
    await sleep(500);
  } },
  { name: "14c-git-status-restored", run: async (page) => {
    fs.renameSync(`${REPO}/.git.off`, `${REPO}/.git`);
    await page.getByTestId("git-refresh").click();
    await page.getByText(/^(Clean|Dirty)$/).waitFor({ timeout: 20000 });
    await sleep(500);
    await pinGitScroll(page);
    await sleep(200);
  } },
  // Staged paths, then a branch that is both ahead of and behind its upstream, then everything undone.
  { name: "14d-git-staged-ahead-behind", run: async (page) => {
    git("add src/main.txt", REPO);
    const remote = `${WORK}/remote.git`, other = `${WORK}/other`;
    git(`init -q --bare ${remote}`, WORK);
    git(`remote add origin ${remote}`, REPO);
    git("push -q -u origin HEAD", REPO);
    git(`clone -q ${remote} ${other}`, WORK);
    git("commit -q --allow-empty -m theirs", other);
    git("push -q", other);
    git("commit -q --allow-empty -m ours", REPO);
    git("fetch -q", REPO);
    await page.getByTestId("git-refresh").click();
    await page.getByText("1 behind").waitFor({ timeout: 20000 });
    await pinGitScroll(page);
    await sleep(500);
  } },
  { name: "14e-git-restored", run: async (page) => {
    git("reset -q --soft HEAD~1", REPO);
    git("reset -q", REPO);
    git("branch --unset-upstream", REPO);
    git("remote remove origin", REPO);
    fs.rmSync(`${WORK}/remote.git`, { recursive: true, force: true });
    fs.rmSync(`${WORK}/other`, { recursive: true, force: true });
    await page.getByTestId("git-refresh").click();
    await page.getByText("No upstream configured").waitFor({ timeout: 20000 });
    await pinGitScroll(page);
    await sleep(500);
  } },
  // "Another ref…" opens the base/head inputs and the Clear base button; clearing closes them again.
  { name: "14f-git-compare-open", run: async (page) => {
    await page.getByTestId("git-diff-target").selectOption("compare");
    await page.getByTestId("git-base-selector").waitFor();
    await page.getByTestId("git-base-selector").fill("main");
    await pinGitScroll(page);
    await sleep(500);
  } },
  { name: "14g-git-compare-cleared", run: async (page) => {
    await page.getByRole("button", { name: "Clear base" }).click();
    await page.getByTestId("git-base-selector").waitFor({ state: "detached" });
    await sleep(500);
  } },
  // A saved inline comment: card, edit, resolved, then deleted again so later states match.
  { name: "14h-git-comment-saved", run: async (page) => {
    await page.getByTestId("git-comment-composer").getByRole("button", { name: "Add comment" }).click();
    await page.getByTestId("git-inline-comment").first().waitFor({ timeout: 20000 });
    await pinGitScroll(page);
    await sleep(500);
  } },
  { name: "14i-git-comment-editing", run: async (page) => {
    await page.getByTestId("git-inline-comment").first().getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Edit review comment").fill("an edited review note");
    await sleep(400);
  } },
  { name: "14j-git-comment-edited", run: async (page) => {
    await page.getByRole("button", { name: "Save edit" }).click();
    await page.getByText("an edited review note").waitFor({ timeout: 20000 });
    await pinGitScroll(page);
    await sleep(500);
  } },
  { name: "14k-git-comment-resolved", run: async (page) => {
    await page.getByTestId("git-inline-comment").first().getByRole("button", { name: "Resolve" }).click();
    await page.getByTestId("git-inline-comment").first().getByRole("button", { name: "Reopen" }).waitFor({ timeout: 20000 });
    await pinGitScroll(page);
    await sleep(500);
  } },
  { name: "14l-git-comment-deleted", run: async (page) => {
    await page.getByTestId("git-inline-comment").first().getByRole("button", { name: "Delete" }).click();
    await page.getByTestId("git-inline-comment").first().waitFor({ state: "detached", timeout: 20000 });
    await pinGitScroll(page);
    await sleep(500);
  } },
  { name: "15-worktree-menu", run: async (page) => {
    await page.getByTestId("workspace-tools-toggle").click(); // close drawer
    await sleep(300);
    await page.locator('[data-testid^="worktree-menu-"]').first().click({ force: true });
    await page.locator('[data-testid^="worktree-popover-"]').first().waitFor();
    await sleep(500);
  } },
  { name: "16-worktree-form", run: async (page) => {
    await page.getByTestId("worktree-name-input").fill("feature one");
    await sleep(400);
  } },
  // Create on an existing branch name runs as a background job and fails: the popover closes and the
  // sidebar shows the job row ("Create failed", Retry / Dismiss). 16c dismisses it again.
  { name: "16b-worktree-job-failed", run: async (page) => {
    await page.getByTestId("worktree-branch-input").fill("main");
    await page.getByTestId("worktree-path-input").fill(`${WORK}/wt-err`);
    await page.getByTestId("worktree-create-submit").click();
    await page.getByText("Create failed").waitFor();
    await sleep(300);
  } },
  { name: "16c-worktree-job-dismissed", nocapture: true, run: async (page) => {
    await page.getByRole("button", { name: "Dismiss" }).click();
    await page.getByText("Create failed").waitFor({ state: "detached" });
    await sleep(300);
  } },
  // Sidebar project list under injected state: a sleeping + pinned workspace (Restore), a nested worktree,
  // a running create job, active and long-titled session rows, chat rows. 16l puts the store back.
  { name: "16d-overview-injected", run: async (page, ctx) => {
    await page.evaluate((ctx) => {
      const st = window.usePerchStore, g = st.getState();
      window.__visOv = { workspaces: g.workspaces, sessions: g.sessions, jobs: g.worktreeJobs, projects: g.workspaceProjects, snap: g.workspaceSnapshotByHost, sid: g.sessionId };
      const main = g.workspaces.find((w) => w.id === ctx.workspaceId);
      const chats = g.workspaces.find((w) => w.path.endsWith("/.perch/scratch"));
      const project = g.workspaceProjects.find((p) => p.id === main.projectId);
      const extra = [];
      // a linked worktree of the main checkout, with a worktree nested under it
      const base = { ...main, dirty: false, state: "active", pinned: false, hidden: false };
      extra.push({ ...base, id: "vis-linked", name: "linked-wt", branch: "linked", path: "/tmp/perch-visual/wt-linked", parentWorkspaceId: main.id });
      extra.push({ ...base, id: "vis-nested", name: "nested-child", branch: "nested", path: "/tmp/perch-visual/wt-nested", parentWorkspaceId: "vis-linked" });
      const mk = (id, title, w, n) => ({ id, title, cwd: w.path, workspaceId: w.id, hostId: w.hostId, createdAt: n, status: "idle" });
      st.setState({
        workspaces: [...g.workspaces.map((w) => (w.id === main.id ? { ...w, state: "sleeping", pinned: true } : w)), ...extra],
        sessions: [mk("vis-o1", "Active session", main, 3), mk("vis-o2", "A very long session title that has to be clipped by the sidebar column", main, 2), ...(chats ? [mk("vis-o3", "A chat", chats, 1)] : [])],
        worktreeJobs: [{ jobId: "vis-j1", repoPath: project.repoPath ?? project.path, branch: "job-run", path: "/tmp/perch-visual/wt-job", status: "running", phase: "Checking out", startedAt: 1 }],
        sessionId: "vis-o1",
      });
    }, ctx);
    await page.getByTestId("worktree-job-job-run").waitFor();
    await sleep(400);
  } },
  { name: "16e-overview-hidden-open", run: async (page, ctx) => {
    await page.getByTestId(`workspace-hidden-${ctx.projectId}`).click();
    await sleep(300);
  } },
  { name: "16f-overview-collapsed", run: async (page, ctx) => {
    await page.getByTestId(`workspace-project-collapse-${ctx.projectId}`).click();
    await sleep(300);
  } },
  { name: "16g-overview-expanded", nocapture: true, run: async (page, ctx) => {
    await page.getByTestId(`workspace-project-collapse-${ctx.projectId}`).click();
    await sleep(300);
  } },
  { name: "16h-overview-load-error", run: async (page) => {
    await page.evaluate(() => window.usePerchStore.setState({ workspaceSnapshotByHost: { ...window.usePerchStore.getState().workspaceSnapshotByHost, local: { state: "error", error: "Workspace could not be loaded." } } }));
    await page.getByRole("alert").filter({ hasText: "Workspace could not be loaded." }).waitFor();
    await sleep(300);
  } },
  { name: "16i-overview-loading", run: async (page) => {
    await page.evaluate(() => window.usePerchStore.setState({ workspaceSnapshotByHost: { ...window.usePerchStore.getState().workspaceSnapshotByHost, local: { state: "loading" } } }));
    await page.getByText("Loading workspace…").waitFor();
    await sleep(300);
  } },
  // No projects: the "Register a project" card, then the add form with a pending and an error status.
  { name: "16j-overview-empty", run: async (page) => {
    await page.evaluate(() => window.usePerchStore.setState({ workspaceSnapshotByHost: window.__visOv.snap, workspaceProjects: [] }));
    await page.getByText("Register a project").waitFor();
    await sleep(300);
  } },
  { name: "16k-overview-form-status", run: async (page) => {
    await page.getByTestId("workspace-empty-add").click();
    await page.evaluate(() => window.usePerchStore.setState({ workspaceProjectCreate: { requestId: "vis-r", hostId: "local", path: "/x", status: "error", error: "Could not register this folder." } }));
    await page.getByRole("alert").filter({ hasText: "Could not register" }).waitFor();
    await sleep(300);
  } },
  { name: "16k2-overview-form-pending", run: async (page) => {
    await page.evaluate(() => window.usePerchStore.setState({ workspaceProjectCreate: { requestId: "vis-r", hostId: "local", path: "/x", status: "pending" } }));
    await page.getByText("Registering folder…").waitFor();
    await sleep(300);
  } },
  { name: "16l-overview-restored", nocapture: true, run: async (page) => {
    await page.evaluate(() => {
      const o = window.__visOv;
      window.usePerchStore.setState({ workspaceProjectCreate: null, workspaces: o.workspaces, sessions: o.sessions, worktreeJobs: o.jobs, workspaceProjects: o.projects, workspaceSnapshotByHost: o.snap, sessionId: o.sid });
    });
    await page.getByTestId("workspace-cancel").click().catch(() => {});
    await page.getByRole("button", { name: "Cancel" }).first().click().catch(() => {});
    await sleep(400);
  } },
  { name: "16m-overview-rename-workspace", run: async (page, ctx) => {
    await page.getByTestId(`workspace-entry-${ctx.workspaceId}`).click({ button: "right" });
    await page.getByTestId(`workspace-rename-item-${ctx.workspaceId}`).click();
    await page.getByTestId(`workspace-rename-${ctx.workspaceId}`).waitFor();
    await sleep(300);
  } },
  { name: "16n-overview-rename-project", run: async (page, ctx) => {
    if (await page.getByTestId(`workspace-rename-${ctx.workspaceId}`).count()) await page.getByTestId(`workspace-rename-${ctx.workspaceId}`).press("Escape");
    await page.getByTestId(`workspace-project-menu-${ctx.projectId}`).click({ force: true });
    await page.getByTestId(`workspace-project-rename-${ctx.projectId}`).click();
    await page.getByTestId(`workspace-project-rename-input-${ctx.projectId}`).waitFor();
    await sleep(300);
  } },
  { name: "16o-overview-rename-done", nocapture: true, run: async (page, ctx) => {
    if (await page.getByTestId(`workspace-project-rename-input-${ctx.projectId}`).count()) await page.getByTestId(`workspace-project-rename-input-${ctx.projectId}`).press("Escape");
    await sleep(300);
  } },
  { name: "17-project-menu", run: async (page, ctx) => {
    await closeOverlays(page);
    await page.locator(`[data-testid="workspace-project-${ctx.projectId}"]`).hover();
    await page.getByTestId(`workspace-project-menu-${ctx.projectId}`).click({ force: true });
    await sleep(300);
  } },
  { name: "17b-workspace-context-menu", run: async (page, ctx) => {
    await closeOverlays(page);
    await page.getByTestId(`workspace-entry-${ctx.workspaceId}`).click({ button: "right" });
    await sleep(300);
  } },
  { name: "17c-project-menu-again", run: async (page, ctx) => {
    await closeOverlays(page);
    await page.getByTestId(`workspace-project-menu-${ctx.projectId}`).click({ force: true });
    await sleep(300);
  } },
  { name: "18-confirm", run: async (page, ctx) => {
    await page.getByTestId(`workspace-project-remove-${ctx.projectId}`).click();
    await page.getByTestId("confirm-dialog").waitFor({ timeout: 5000 });
    await sleep(300);
  } },
  { name: "19-theme-alt", run: async (page) => {
    await page.getByTestId("confirm-cancel").click().catch(() => {});
    await closeOverlays(page);
    await page.getByTestId("settings-gear").click();
    await page.getByTestId("settings-modal").waitFor();
    await page.locator('[data-testid^="theme-option-"]').nth(3).click();
    await sleep(400);
    await closeOverlays(page);
  } },
  { name: "20-theme-alt-settings", run: async (page) => {
    await page.getByTestId("settings-gear").click();
    await page.getByTestId("settings-modal").waitFor();
    await sleep(300);
  } },
  { name: "20b-no-session-home", run: async (page, ctx) => {
    await closeOverlays(page);
    await page.getByTestId(`workspace-project-menu-${ctx.projectId}`).click({ force: true });
    await page.getByTestId(`workspace-project-close-all-${ctx.projectId}`).click();
    await page.getByTestId("no-session-panel").waitFor({ timeout: 10000 });
    await sleep(500);
  } },
  // A workspace with no sessions shows its own start picker; then the disconnected placeholder.
  { name: "20b2-workspace-start", run: async (page, ctx) => {
    await page.locator(`[data-testid="workspace-entry-${ctx.workspaceId}"] .workspace-entry__button`).first().click();
    await page.getByText("What do you want to open?").waitFor({ timeout: 10000 });
    await sleep(400);
  } },
  { name: "20b3-no-session-connecting", run: async (page) => {
    await page.evaluate(() => window.usePerchStore.setState({ connected: false }));
    await page.getByText("Connecting…").waitFor({ timeout: 10000 });
    await sleep(300);
  } },
  { name: "20b4-reconnected", nocapture: true, run: async (page) => {
    await page.evaluate(() => window.usePerchStore.setState({ connected: true }));
    await sleep(500);
  } },
  { name: "20c-toast", run: async (page) => {
    await page.evaluate(() => {
      const orig = window.setTimeout.bind(window);
      window.__origSetTimeout = orig;
      window.setTimeout = (fn, ms, ...a) => (ms === 6000 ? 0 : orig(fn, ms, ...a));
      window.usePerchStore.setState({ toasts: [
        { id: "t1", sessionId: "s1", title: "Fix the login bug" },
        { id: "t2", sessionId: "s2", title: "A rather long session title that should be cut off with an ellipsis at the edge" },
      ] });
    });
    await page.getByTestId("toast").waitFor();
    await sleep(500);
  } },
  { name: "20d-toast-cleared", run: async (page) => {
    await page.evaluate(() => { window.setTimeout = window.__origSetTimeout; window.usePerchStore.setState({ toasts: [] }); });
  }, nocapture: true },
  { name: "21b4-phone-settings-agents", viewport: { width: 390, height: 844 }, run: async (page) => {
    await page.getByTestId("settings-gear").click();
    await page.getByTestId("settings-modal").waitFor();
    await page.getByRole("button", { name: "Manage agents" }).click();
    await page.getByTestId("agent-catalog").waitFor();
    await sleep(800);
  } },
  { name: "21-phone-header", viewport: { width: 390, height: 844 }, run: async (page) => {
    await closeOverlays(page);
    await page.getByTestId("settings-gear").click({ trial: true }).catch(() => {});
    await page.getByTestId("mobile-header").waitFor({ timeout: 10000 });
    await sleep(500);
  } },
  // Phone pane tabs: Files, Git, Terminal, the "choose a workspace" placeholder, then back to Chat.
  { name: "21b-phone-pane-files", viewport: { width: 390, height: 844 }, run: async (page) => {
    await page.getByTestId("mobile-pane-files").click();
    await page.getByTestId("mobile-active-pane-files").waitFor();
    await sleep(800);
  } },
  // A file opened on the phone: the single-column editor with its "‹ Explorer" button, then back to the tree.
  { name: "21b2-phone-file-open", viewport: { width: 390, height: 844 }, run: async (page) => {
    await page.getByTestId("workspace-file-entry-README.md").click();
    await page.getByTestId("workspace-file-editor").waitFor({ timeout: 15000 });
    await sleep(600);
  } },
  { name: "21b3-phone-file-explorer", viewport: { width: 390, height: 844 }, run: async (page) => {
    await page.getByRole("button", { name: "‹ Explorer" }).click();
    await sleep(400);
  } },
  { name: "21c-phone-pane-git", viewport: { width: 390, height: 844 }, run: async (page) => {
    await page.getByTestId("mobile-pane-git").click();
    await page.getByTestId("mobile-active-pane-gitReview").waitFor();
    await sleep(800);
  } },
  { name: "21d-phone-pane-terminal", viewport: { width: 390, height: 844 }, run: async (page) => {
    await page.getByTestId("mobile-pane-terminal").click();
    await page.getByTestId("mobile-active-pane-terminal").waitFor();
    await sleep(800);
  } },
  { name: "21e-phone-pane-empty", viewport: { width: 390, height: 844 }, run: async (page, ctx) => {
    await page.evaluate(() => { window.__visWs = window.usePerchStore.getState().activeWorkspaceId; window.usePerchStore.setState({ activeWorkspaceId: null }); });
    await page.getByTestId("mobile-pane-files").click();
    await page.getByText("Choose a workspace from Switch before opening files.").waitFor();
    await sleep(300);
  } },
  { name: "21f-phone-pane-chat", viewport: { width: 390, height: 844 }, run: async (page) => {
    await page.evaluate(() => window.usePerchStore.setState({ activeWorkspaceId: window.__visWs }));
    await page.getByTestId("mobile-pane-chat").click();
    await page.getByTestId("mobile-active-pane-chat").waitFor();
    await sleep(500);
  } },
  { name: "22-phone-switcher", viewport: { width: 390, height: 844 }, run: async (page) => {
    await page.getByTestId("mobile-switch").click();
    await page.getByTestId("mobile-switcher").waitFor();
    await sleep(400);
  } },
  // Without workspace navigation the switcher lists sessions by project instead.
  { name: "22a-phone-switcher-sessions", viewport: { width: 390, height: 844 }, run: async (page) => {
    await page.getByTestId("mobile-switcher-close").click();
    // The harness server keeps no session rows for these panes, so inject two (one active) as 01c2 does.
    await page.evaluate(() => {
      const st = window.usePerchStore;
      window.__visPhone = { caps: st.getState().workspaceCapabilities, sessions: st.getState().sessions, sid: st.getState().sessionId };
      st.setState({ workspaceCapabilities: [], sessionId: "vis-m1", sessions: [
        { id: "vis-m1", title: "Active phone session", cwd: "/tmp/perch-visual/repo", createdAt: 1, status: "idle" },
        { id: "vis-m2", title: "", cwd: "/tmp/perch-visual/repo", createdAt: 2, status: "idle" },
        { id: "vis-m3", title: "A very long session title that has to be clipped by the narrow switcher panel", cwd: "/tmp/perch-visual/other", hostId: "vis-a", createdAt: 3, status: "idle" },
      ] });
    });
    await page.getByTestId("mobile-switch").click();
    await page.locator(".mobile-switcher__project").first().waitFor();
    await sleep(400);
  } },
  { name: "22a2-phone-switcher-closed", nocapture: true, viewport: { width: 390, height: 844 }, run: async (page) => {
    await page.getByTestId("mobile-switcher-close").click();
    await page.evaluate(() => { const p = window.__visPhone; window.usePerchStore.setState({ workspaceCapabilities: p.caps, sessions: p.sessions, sessionId: p.sid }); });
  } },
  // The phone switcher's workspace list (compact overview) with a linked worktree, which gets the
  // Pin / Delete / Hide buttons, and a pinned workspace.
  { name: "22a3-phone-switcher-workspaces", viewport: { width: 390, height: 844 }, run: async (page, ctx) => {
    await page.evaluate((ctx) => {
      const st = window.usePerchStore, g = st.getState();
      window.__visWs2 = g.workspaces;
      const main = g.workspaces.find((w) => w.id === ctx.workspaceId);
      const linked = { ...main, id: "vis-linked", name: "linked-wt", branch: "linked", path: "/tmp/perch-visual/wt-linked", parentWorkspaceId: main.id, dirty: false, state: "active", pinned: true, hidden: false };
      st.setState({ workspaces: [...g.workspaces, linked] });
    }, ctx);
    await page.getByTestId("mobile-switch").click();
    await page.getByTestId("workspace-pin-vis-linked").waitFor();
    await sleep(400);
  } },
  { name: "22a4-phone-switcher-workspaces-closed", nocapture: true, viewport: { width: 390, height: 844 }, run: async (page) => {
    await page.getByTestId("mobile-switcher-close").click();
    await page.evaluate(() => window.usePerchStore.setState({ workspaces: window.__visWs2 }));
  } },
  // The macOS app's title-bar row: brand padded for the traffic lights, then collapsed.
  { name: "22b-mac-desktop-brand", tauri: true, run: async () => {} },
  { name: "22c-mac-desktop-brand-collapsed", tauri: true, run: async (page) => {
    await page.getByTestId("sidebar-collapse-toggle").click();
    await sleep(300);
  } },
  // Device pairing gate (replaces the app): empty, then a rejected code, then phone width.
  { name: "22d-pairing-gate", unpaired: true, run: async (page) => { await page.getByTestId("pairing-gate").waitFor(); } },
  { name: "22e-pairing-gate-error", unpaired: true, run: async (page) => {
    await page.getByTestId("pairing-code").fill("abcd2345");
    await page.getByTestId("pairing-submit").click();
    await page.getByTestId("pairing-error").waitFor();
    await sleep(200);
  } },
  { name: "22f-pairing-gate-phone", unpaired: true, viewport: { width: 390, height: 700 }, run: async (page) => {
    await page.getByTestId("pairing-gate").waitFor();
    await page.getByTestId("pairing-code").fill("ABCD2345");
  } },
  { name: "23-onboarding", fresh: true, run: async () => {} },
  // Narrow and short: width is min(480px, 100vw - 2rem), height capped and scrolling.
  { name: "23b-onboarding-phone", fresh: true, viewport: { width: 390, height: 520 }, run: async (page) => {
    await page.getByTestId("onboarding").waitFor();
    const scrolls = await page.getByTestId("onboarding").evaluate((n) => n.scrollHeight > n.clientHeight);
    if (!scrolls) throw new Error("onboarding panel does not overflow at 390x520; make the viewport shorter");
  } },
];

// -------------------------------------------------------------------- snap --

const ENGINES = { chromium, webkit };
const ALL_ENGINES = Object.keys(ENGINES);
const expectedStates = (only) => STATES.filter((s) => !s.nocapture && (!only || s.name.includes(only))).map((s) => s.name);

async function bootCore(dist) {
  try { fs.chmodSync(`${REPO}/locked-dir`, 0o755); } catch { /* first run */ }
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(`${REPO}/src`, { recursive: true });
  fs.writeFileSync(`${REPO}/src/main.txt`, "committed sentinel\n");
  fs.writeFileSync(`${REPO}/README.md`, "# fixture\n");
  git("-c init.defaultBranch=main init -q", REPO);
  git("add -A", REPO);
  git('commit -q -m "initial"', REPO);
  // A second checkout, so the worktree menu lists a non-primary entry (with its Delete action).
  git(`worktree add -q -b wt-extra ${WORK}/wt-extra`, REPO);
  fs.writeFileSync(`${REPO}/src/main.txt`, "modified sentinel with a fairly long line of content\n");
  fs.writeFileSync(`${REPO}/untracked.txt`, "new\n");
  // Tree variety: an HTML file (sandboxed preview), a symlink, an empty folder, a read-only file, a folder the
  // 12h state makes unreadable.
  fs.writeFileSync(`${REPO}/page.html`, "<h1>fixture page</h1>\n");
  fs.symlinkSync("README.md", `${REPO}/link.md`);
  fs.mkdirSync(`${REPO}/empty-dir`);
  fs.mkdirSync(`${REPO}/locked-dir`);
  fs.writeFileSync(`${REPO}/locked-dir/inside.txt`, "x\n");
  fs.writeFileSync(`${REPO}/readonly.txt`, "ro\n");
  fs.chmodSync(`${REPO}/readonly.txt`, 0o444);
  // Pin mtimes: the file view prints them, and "9:59 PM" vs "10:03 PM" differs by a character's width.
  const PINNED = new Date("2026-01-01T12:00:00Z");
  for (const f of ["src/main.txt", "README.md", "untracked.txt", "page.html", "readonly.txt"]) fs.utimesSync(`${REPO}/${f}`, PINNED, PINNED);
  // Two disabled remotes (never connected, so no ssh): a direct-mode one and a perch-mode one.
  fs.writeFileSync(`${WORK}/hosts.json`, JSON.stringify({ hosts: [
    { id: "vis-a", name: "vis-a", sshHost: "vis-a.example.invalid", remotePort: 7788, enabled: false, mode: "direct" },
    { id: "vis-b", name: "vis-b", sshHost: "vis-b.example.invalid", remotePort: 7788, enabled: false, mode: "perch" },
  ] }));
  const log = [];
  const core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(PORT), "--db-path", `${WORK}/h.sqlite`, "--hosts-path", `${WORK}/hosts.json`, "--cwd", REPO], {
    cwd: root,
    env: { ...process.env, HOME: process.env.HOME, PERCH_NO_LOGIN_PATH: "1", PERCH_WEB_DIST: path.resolve(dist), PERCH_SETTINGS: `${WORK}/settings.json`, PERCHD_DIR: `${WORK}/perchd` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  core.stdout.on("data", (c) => log.push(String(c)));
  core.stderr.on("data", (c) => log.push(String(c)));
  for (let i = 0; i < 100; i++) {
    if (core.exitCode !== null) throw new Error("core exited: " + log.join(""));
    try { if ((await fetch(URL_)).ok) return core; } catch {}
    await sleep(200);
  }
  throw new Error("core did not start: " + log.join(""));
}

async function stopCore(core) {
  const exited = new Promise((r) => core.once("exit", r));
  core.kill("SIGTERM");
  await Promise.race([exited, sleep(5000)]);
  try { execSync(`pkill -f '__perchd serve --dir ${WORK}/perchd'`, { stdio: "ignore" }); } catch {}
}

async function capture(page, outDir, name, state = {}) {
  // `holdHover`: keep the pointer on this element for the screenshot and style dump (hover-revealed UI).
  if (state.holdHover) await page.locator(state.holdHover).first().hover();
  else await page.mouse.move(1, 1);
  await sleep(200);
  const dump = await page.evaluate(DUMP, { props: PROPS, skipSel: SKIP_SEL });
  if (dump.length < 5) throw new Error(`empty capture (${dump.length} elements): the app did not render`);
  fs.writeFileSync(`${outDir}/${name}.dump.json`, JSON.stringify(dump));
  // Volatile text (file mtime, workspace id) and the terminal are masked so
  // that a pixel difference always means a real one.
  // Under the settings modal a mask would paint over the modal itself (the mask
  // sits above everything), so hide the terminal there instead.
  // The same goes for an open file tab, which covers the (still mounted) terminal.
  const modalOpen = (await page.getByTestId("settings-modal").count()) > 0 || (await page.getByTestId("workspace-file-pane").count()) > 0;
  const hideTerm = modalOpen ? await page.addStyleTag({ content: ".xterm{visibility:hidden!important}" }) : null;
  await page.screenshot({
    path: `${outDir}/${name}.png`,
    animations: "disabled",
    caret: "hide",
    mask: [...(modalOpen ? [] : [page.locator(".xterm")]), page.getByText(/\d+ B · \d+\/\d+\/\d+/), page.getByText(/^Workspace\s*[0-9a-f]{8}$/), page.getByText(/^[0-9a-f]{8}$/)],
    maskColor: "#ff00ff",
  });
  if (hideTerm) await hideTerm.evaluate((n) => n.remove());

  // hover/focus read end states: freeze transitions so timing can't leak in
  // An attribute on <html> gates the rule: removing a `*` style tag leaves WebKit with stale `none`
  // transitions on elements behind overlays, and that leaked into the next states' dumps.
  await page.evaluate(() => {
    if (!document.getElementById("vis-freeze-css")) {
      const st = document.createElement("style");
      st.id = "vis-freeze-css";
      st.textContent = "html[data-vis-freeze] *,html[data-vis-freeze] *::before,html[data-vis-freeze] *::after{transition:none!important;animation:none!important}";
      document.head.append(st);
    }
    document.documentElement.setAttribute("data-vis-freeze", "1");
  });
  // hover: each interactive element, plus its surrounding group (reveals)
  const targets = page.locator("button:visible, a:visible, [role=button]:visible, select:visible, input:visible, textarea:visible, [data-testid^=workspace-entry-]:visible, [data-testid^=workspace-project-]:visible, [data-testid^=session-item]:visible");
  const n = Math.min(await targets.count(), 45);
  const hovers = [];
  for (let i = 0; i < n; i++) {
    const t = targets.nth(i);
    try {
      await t.hover({ timeout: 800, force: true });
      await sleep(40);
      hovers.push({ i, id: (await t.getAttribute("data-testid")) || (await t.getAttribute("title")) || (await t.getAttribute("aria-label")) || "", d: await t.evaluate(HOVER_DUMP, HOVER_PROPS) });
    } catch { hovers.push({ i, err: true }); }
  }
  fs.writeFileSync(`${outDir}/${name}.hover.json`, JSON.stringify(hovers));
  await page.mouse.move(1, 1);

  // keyboard focus ring: Tab through, record the focused element's look
  const focus = [];
  const FOCUS_PROPS = [...HOVER_PROPS, "outline-width", "outline-color", "outline-offset", "border-top-width"];
  const readFocus = (via) => page.evaluate(({ props, via }) => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    return { id: el.getAttribute("data-testid") || el.getAttribute("title") || el.getAttribute("aria-label") || "", via, tag: el.tagName.toLowerCase(), s: Object.fromEntries(props.map((k) => [k, cs.getPropertyValue(k)])) };
  }, { props: FOCUS_PROPS, via });
  await page.evaluate(() => document.activeElement?.blur());
  // `state.focusWalk`: also walk from a known start, because the walk from
  // <body> can run out of steps (or, in WebKit, skip buttons) before it gets
  // to an element deep in the page. Real Tab presses first, then each target
  // focused directly, so both engines record the focused look.
  if (state.focusWalk) {
    const { start, targets } = state.focusWalk;
    await page.locator(start).focus();
    focus.push(await readFocus("start"));
    for (let i = 0; i < targets.length + 1; i++) { await page.keyboard.press("Tab"); focus.push(await readFocus("tab")); }
    for (const t of targets) {
      await page.locator(t).focus();
      const rec = await readFocus("focus()");
      if (!rec || !rec.id) throw new Error(`focus walk: ${t} did not take focus`);
      focus.push(rec);
    }
    await page.evaluate(() => document.activeElement?.blur());
  }
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    focus.push(await readFocus("tab"));
  }
  fs.writeFileSync(`${outDir}/${name}.focus.json`, JSON.stringify(focus));
  await page.evaluate(() => { document.activeElement?.blur(); document.documentElement.removeAttribute("data-vis-freeze"); });
}

/** One engine, one fresh core. Returns the list of failures (empty = clean). */
async function snapEngine(engine, dist, outDir, only) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const failures = [];
  let core = null, browser = null;
  try {
    if (!fs.existsSync(path.join(dist, "index.html"))) throw new Error(`no web build at ${dist} (index.html missing)`);
    // Touch coverage: the harness pointer can hover, so it cannot see Tailwind's
    // default `hover:` (wrapped in `@media (hover:hover)`) dropping touch hover.
    // Legacy CSS used a bare :hover; fail closed if any build gates it.
    const assets = path.join(dist, "assets");
    const css = fs.existsSync(assets) ? fs.readdirSync(assets).filter((f) => f.endsWith(".css")) : [];
    if (!css.length) throw new Error(`no built CSS in ${assets}`);
    for (const f of css) if (/@media\s*\(\s*hover\s*:\s*hover\s*\)/.test(fs.readFileSync(path.join(assets, f), "utf8"))) throw new Error(`${f} gates :hover behind @media (hover:hover); touch devices lose hover styles`);
    core = await bootCore(dist);
    browser = await ENGINES[engine].launch();
    const ctx = {};
    const mk = async (fresh, tauri = false, unpaired = false) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: "dark", reducedMotion: "reduce" });
      if (!fresh) await context.addInitScript(() => { try { localStorage.setItem("perch.onboarding.seen", "1"); } catch { /* sandboxed preview frame */ } });
      // The macOS app: App.tsx pads the brand for the traffic lights when this global exists.
      // The pairing gate: the host answers GET /pair with paired:false; a code is rejected with a message.
      // A rejected handshake is what an unpaired device sees; the gate shows while the socket is down.
      if (unpaired) await context.routeWebSocket(/\/ws/, (ws) => ws.close());
      if (unpaired) await context.route("**/pair", (route) => route.request().method() === "POST"
        ? route.fulfill({ status: 400, contentType: "text/plain", body: "that pairing code has expired" })
        : route.fulfill({ json: { paired: false } }));
      if (tauri) await context.addInitScript(() => { window.__TAURI_INTERNALS__ = { invoke: async () => null, transformCallback: () => 0 }; });
      const page = await context.newPage();
      page.setDefaultTimeout(10_000);
      await page.clock.setFixedTime(new Date("2026-01-01T12:00:00Z"));
      page.on("pageerror", (e) => failures.push(`pageerror: ${e.message}`));
      await page.goto(URL_, { waitUntil: "networkidle" });
      await sleep(800);
      return { context, page };
    };
    const { page } = await mk(false);
    // States build on each other (project added, session started), so those
    // before the last requested one still run, but nothing after it does, and
    // the first failure ends the run: later states would only time out on it.
    const lastWanted = STATES.reduce((last, st, i) => (!st.nocapture && (!only || st.name.includes(only)) ? i : last), -1);
    for (const [index, state] of STATES.entries()) {
      if (index > lastWanted) break;
      const wanted = !state.nocapture && (!only || state.name.includes(only));
      try {
        if (state.fresh || state.tauri || state.unpaired) {
          if (!wanted) continue;
          const fresh = await mk(!!state.fresh, !!state.tauri, !!state.unpaired);
          if (state.viewport) { await fresh.page.setViewportSize(state.viewport); await sleep(300); }
          await state.run(fresh.page, ctx);
          await capture(fresh.page, outDir, state.name, state);
          await fresh.context.close();
          continue;
        }
        await page.setViewportSize(state.viewport ?? { width: 1280, height: 800 });
        await state.run(page, ctx);
        if (wanted) await capture(page, outDir, state.name, state);
      } catch (e) {
        failures.push(`${state.name}: ${String(e.message).split("\n").slice(0, process.env.VIS_VERBOSE ? 14 : 1).join(" / ")}`);
        try { await page.screenshot({ path: `${outDir}/${state.name}.FAILED.png` }); } catch {}
        break;
      }
    }
  } catch (e) {
    failures.push(`${engine} run aborted: ${String(e.message).split("\n")[0]}`);
  } finally {
    try { await browser?.close(); } catch {}
    if (core) await stopCore(core);
  }
  for (const name of expectedStates(only)) {
    if (!fs.existsSync(`${outDir}/${name}.dump.json`)) failures.push(`${name}: no capture was written`);
  }
  fs.writeFileSync(`${outDir}/failures.json`, JSON.stringify(failures, null, 2));
  fs.writeFileSync(`${outDir}/manifest.json`, JSON.stringify({ engine, only: only ?? null, states: expectedStates(only) }, null, 2));
  return failures;
}

async function snap(dist, outRoot, engines, only) {
  let bad = 0;
  for (const engine of engines) {
    const failures = await snapEngine(engine, dist, `${outRoot}/${engine}`, only);
    console.log(failures.length ? `snap ${engine}: ${failures.length} FAILURE(S)\n  ` + failures.join("\n  ") : `snap ${engine}: ok`);
    bad += failures.length;
  }
  process.exit(bad ? 1 : 0);
}

// -------------------------------------------------------------------- diff --

// Tailwind's shadow utilities add fully transparent no-op layers
// (`rgba(0,0,0,0) 0 0 0 0`); they render nothing, so drop them before comparing.
const normShadow = (_k, v) => {
  if (typeof v !== "string" || !v.includes("rgba(")) return v;
  const layers = v.match(/rgba?\([^)]*\)(?: -?[\d.]+px){2,4}(?: inset)?/g);
  if (!layers || layers.join(", ") !== v) return v;
  const live = layers.filter((l) => !/^rgba\(\d+, \d+, \d+, 0\)/.test(l));
  return live.length ? live.join(", ") : "none";
};
// random ids (uuids in test ids) differ per run: normalize before comparing
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8").replace(UUID, "<uuid>"), normShadow);

/** Everything that makes a run untrustworthy, as strings. Empty = usable. */
function validateRun(label, dir, expected) {
  const problems = [];
  if (!fs.existsSync(dir)) return [`${label}: directory missing (${dir})`];
  const failuresFile = `${dir}/failures.json`;
  if (!fs.existsSync(failuresFile)) problems.push(`${label}: failures.json missing (incomplete run)`);
  else {
    try {
      const f = JSON.parse(fs.readFileSync(failuresFile, "utf8"));
      if (!Array.isArray(f)) problems.push(`${label}: failures.json is not a list`);
      else for (const x of f) problems.push(`${label}: recorded failure: ${x}`);
    } catch { problems.push(`${label}: failures.json unreadable`); }
  }
  if (!fs.existsSync(`${dir}/manifest.json`)) problems.push(`${label}: manifest.json missing`);
  for (const name of expected) {
    for (const ext of ["dump.json", "hover.json", "focus.json", "png"]) {
      if (!fs.existsSync(`${dir}/${name}.${ext}`)) problems.push(`${label}: missing ${name}.${ext}`);
    }
    if (fs.existsSync(`${dir}/${name}.dump.json`)) {
      try {
        const d = JSON.parse(fs.readFileSync(`${dir}/${name}.dump.json`, "utf8"));
        if (!Array.isArray(d) || d.length < 5) problems.push(`${label}: ${name} captured ${Array.isArray(d) ? d.length : "no"} elements (empty capture)`);
      } catch { problems.push(`${label}: ${name}.dump.json unreadable`); }
    }
  }
  return problems;
}

/** Pixel-compare two PNGs in a real page (no image dependency). Writes a diff image. */
async function pixelDiff(browser, fileA, fileB, outFile) {
  const page = await browser.newPage();
  const b64 = (f) => fs.readFileSync(f).toString("base64");
  const r = await page.evaluate(async ({ a, b }) => {
    const load = (d) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = "data:image/png;base64," + d; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { size: [ia.width, ia.height, ib.width, ib.height] };
    const draw = (i) => { const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const x = c.getContext("2d"); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height); };
    const da = draw(ia), db = draw(ib);
    const out = new ImageData(da.width, da.height);
    let count = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let i = 0; i < da.data.length; i += 4) {
      const same = da.data[i] === db.data[i] && da.data[i + 1] === db.data[i + 1] && da.data[i + 2] === db.data[i + 2] && da.data[i + 3] === db.data[i + 3];
      if (same) { out.data[i] = out.data[i + 1] = out.data[i + 2] = da.data[i] >> 2; out.data[i + 3] = 255; continue; }
      out.data[i] = 255; out.data[i + 1] = 0; out.data[i + 2] = 0; out.data[i + 3] = 255;
      count++;
      const px = (i / 4) % da.width, py = Math.floor(i / 4 / da.width);
      x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
    }
    const c = document.createElement("canvas"); c.width = da.width; c.height = da.height; c.getContext("2d").putImageData(out, 0, 0);
    return { count, box: count ? [x0, y0, x1, y1] : null, png: c.toDataURL("image/png").split(",")[1] };
  }, { a: b64(fileA), b: b64(fileB) });
  await page.close();
  if (r.png && r.count) { fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, Buffer.from(r.png, "base64")); }
  return r;
}

function compareDumps(da, db) {
  const out = [];
  if (da.length !== db.length) out.push(`element count ${da.length} -> ${db.length}`);
  const m = new Map(db.map((e) => [e.p, e]));
  for (const ea of da) {
    const eb = m.get(ea.p);
    if (!eb) { out.push(`gone: ${ea.p} <${ea.tag}> ${ea.id || ea.cls}`); continue; }
    const ch = [];
    if (ea.tag !== eb.tag) ch.push(`tag ${ea.tag}->${eb.tag}`);
    if (ea.text !== eb.text) ch.push(`text "${ea.text}"->"${eb.text}"`);
    if (ea.rect.join() !== eb.rect.join()) ch.push(`rect [${ea.rect}]->[${eb.rect}]`);
    for (const k of Object.keys(ea.s)) if (ea.s[k] !== eb.s[k]) ch.push(`${k}: ${ea.s[k]} -> ${eb.s[k]}`);
    for (const ps of ["s::before", "s::after"]) if (JSON.stringify(ea[ps]) !== JSON.stringify(eb[ps])) ch.push(`${ps} ${JSON.stringify(ea[ps])} -> ${JSON.stringify(eb[ps])}`);
    if (ch.length) out.push(`${ea.p} <${ea.tag}> ${ea.id || ea.cls}\n      ` + ch.join("\n      "));
  }
  return out;
}

async function diff(rootA, rootB, engines, only, reviewed) {
  const expected = expectedStates(only);
  const invalid = [];
  if (!expected.length) invalid.push("no expected states (bad --only filter?)");
  for (const e of engines) {
    invalid.push(...validateRun(`A/${e}`, `${rootA}/${e}`, expected));
    invalid.push(...validateRun(`B/${e}`, `${rootB}/${e}`, expected));
  }
  if (invalid.length) {
    console.log("INVALID RUN — refusing to compare:\n  " + invalid.slice(0, 40).join("\n  ") + (invalid.length > 40 ? `\n  … ${invalid.length - 40} more` : ""));
    process.exit(2);
  }

  let total = 0, reviewedCount = 0;
  const browser = await chromium.launch();
  try {
    for (const engine of engines) {
      const A = `${rootA}/${engine}`, B = `${rootB}/${engine}`;
      for (const n of expected) {
        const out = [];
        out.push(...compareDumps(readJson(`${A}/${n}.dump.json`), readJson(`${B}/${n}.dump.json`)).map((x) => `  ${x}`));
        for (const kind of ["hover", "focus"]) {
          if (JSON.stringify(readJson(`${A}/${n}.${kind}.json`)) !== JSON.stringify(readJson(`${B}/${n}.${kind}.json`))) out.push(`  ${kind} dump differs`);
        }
        const pa = `${A}/${n}.png`, pb = `${B}/${n}.png`;
        if (!fs.readFileSync(pa).equals(fs.readFileSync(pb))) {
          const r = await pixelDiff(browser, pa, pb, `${rootB}/review/${engine}-${n}.diff.png`);
          if (r.size) out.push(`  screenshot size differs ${r.size.join("x")}`);
          else if (r.count) {
            const note = `screenshot: ${r.count} px differ, box [${r.box}], review ${rootB}/review/${engine}-${n}.diff.png`;
            if (reviewed.has(n)) { reviewedCount++; console.log(`  (reviewed) ${engine} ${n}: ${note}`); }
            else out.push(`  ${note}`);
          }
        }
        total += out.length;
        console.log(out.length ? `✗ ${engine} ${n}\n${out.slice(0, 40).join("\n")}${out.length > 40 ? `\n  … ${out.length - 40} more` : ""}` : `✓ ${engine} ${n}`);
      }
    }
  } finally { await browser.close(); }
  if (total) { console.log(`\n${total} difference group(s)`); process.exit(1); }
  console.log(reviewedCount ? `\nIDENTICAL (${reviewedCount} screenshot difference(s) reviewed by name)` : "\nIDENTICAL");
  process.exit(0);
}

// -------------------------------------------------------------------- main --

function opt(argv, name) {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  return argv.splice(i, 2)[1];
}
const argv = process.argv.slice(2);
const cmd = argv.shift();
const engines = (opt(argv, "--engines") ?? ALL_ENGINES.join(",")).split(",").filter(Boolean);
const only = opt(argv, "--only");
const reviewed = new Set((opt(argv, "--reviewed") ?? "").split(",").filter(Boolean));
for (const e of engines) if (!ENGINES[e]) { console.error(`unknown engine ${e}`); process.exit(2); }

if (cmd === "snap" && argv.length === 2) await snap(argv[0], argv[1], engines, only);
else if (cmd === "diff" && argv.length === 2) await diff(argv[0], argv[1], engines, only, reviewed);
else if (cmd === "states") console.log(JSON.stringify(expectedStates(only)));
else { console.error("usage: visual.mjs snap <dist> <out-root> | diff <a> <b> | states   [--engines chromium,webkit] [--only s] [--reviewed a,b]"); process.exit(2); }

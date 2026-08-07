# BUGS.md — Live verification findings (2026-08-07)

> Boot: `perch-core --port 7788 --headless --db-path /tmp/perch-test.db` (axum serves `packages/web/dist` at `/`, WS at `/ws`) + `herdr server 0.8.0` (`/Users/hwiii/.config/herdr/herdr.sock`, protocol 19). Driver: `playwright-core 1.61.1` chromium `headless:true` `1280×850` (plus `600×850` mobile), `onboarding-dismiss` before walk. Herdr exercised via `herdr workspace|tab|pane|worktree|api snapshot` CLI over the socket. **All checks are live UI/API, not unit tests** (Rust `cargo test -p perch-core` 151+1 parity still green as sanity only). Screenshots: `/tmp/perch-verify*.png`, `/tmp/perch-final*.png`.

**Global mode note:** Perch's `Hosted vs CLI` is a **global** `Settings → Chat Mode` (`perch`/`catppuccin` toggle per `CLAUDE.md`). Hosted = `crates/perch-core/src/agent.rs` headless runners (`claude -p --output-format stream-json --session-id/--resume`, `codex exec --json`, `ClaudeStreamParser`/`CodexStreamParser` + `strip_image_blocks`) + `packages/web/src/views/Chat.tsx` composer. CLI = `terminal.rs` `portable-pty` with `AgentAttach {sessionId,agent}` + `xtermSetup.ts::createPerchTerminal` (`convertEol:false`, iTerm2/Ghostty font, `fitWithScaling MIN_COLS=80`). **Bugs 1 and 2 are Hosted-mode** (`Chat.tsx`/`DockviewShell.tsx`); CLI pane is an `xterm` canvas and does not contain `.chat__list`, so Bug 1 does not reproduce in CLI panes (toolbar `›_` → `.xterm` 1 canvas verified `c9-terminal.png`).

---

## Bug 1 — Pane `⋯` menu hit-test intercepted by `.chat__list`

* **Severity:** Medium (functional workaround exists, UX broken for normal click)
* **Component:** `packages/web/src/dockview/DockviewShell.tsx` + `packages/web/src/components/PaneContextMenu.tsx` + `packages/web/src/styles.css` / `paneSplit.css`
* **Applies to:** Hosted `Chat` tab only; CLI `AgentCliTerminal` not affected (no `.chat__list` sibling)
* **Status:** Open — menu logic correct, CSS stacking/pointer bug

### Reproduction

1. Boot perch on `7788` with isolated DB, `npm run build` fresh.
2. Dismiss onboarding (`[data-testid="onboarding-dismiss"]`), send `hello perch verify` via `textarea` + `Send` so a `project-list` session exists.
3. In `Chat` pane, attempt:
   ```js
   await page.locator('[data-testid="pane-group-menu"]').first().click()
   ```
4. Observe Playwright `Timeout 2000ms`:
   ```
   <div class="chat__list"> from <div [tabpanel dv-tabpanel-0]> subtree intercepts pointer events
   ```
   Retries ×4 with `waiting for element to be visible, enabled and stable` → `scrolling into view` → `retrying`.
5. Workaround succeeds:
   ```js
   await page.evaluate(() => document.querySelector('[data-testid="pane-group-menu"]')
     .dispatchEvent(new MouseEvent('click', {bubbles:true})))
   // → menu opens, 6 items (Split Vertical/Horizontal, Rename, Zoom ⛶, Close)
   // screenshot f6-pane-menu-js.png
   ```

### Expected vs Actual

* Expected: `⋯` in `dv-groupview-header-top` is hit-testable and opens `PaneContextMenu` (portal-rendered, same pattern as `ModelChip`).
* Actual: `.chat__list` content container paints over the header button; browser routes the pointer to `.chat__list` even though the button is visually in the header strip. `dispatchEvent` bypasses hit-test, proving `PaneContextMenu.tsx` → `dockview panel.api` (`addPanel`/`maximize`/`close`) wiring is correct.

### Root Cause

`DockviewShell` stacks `dv-groupview-header-top` above `dv-content-container > .chat__list`. Header has no `z-index`/`isolation` stacking context; `.chat__list` is `position:relative` with `height:100%`/`flex:1` and sits in the same stacking context. Hit-test picks the topmost `position:relative` element at the pointer coordinate → `.chat__list`. Only on `Chat` tab; terminal tabs render `.xterm` canvas without `.chat__list`.

### How Tested

* Playwright headless head-check (`verify-perch-full.cjs`) counted `pane-group-menu` 1 visible, `locator.click()` failed with the interceptor log above, `f6-pane-menu-js.png` after JS dispatch showed 6 `role=menuitem`. Post-split `dv-view` count went 2→3 (`f5-pane-split.png`), confirming `DockviewShell` split path works.

### Fix Plan

1. **CSS stacking** (`styles.css` / `dockview/paneSplit.css`):
   ```css
   .dv-groupview-header-top { position: relative; z-index: 1; isolation: isolate; }
   .chat__list { position: relative; z-index: 0; }
   /* alternative: ensure content never captures header area */
   .dv-content-container { isolation: isolate; }
   ```
   Do not add `pointer-events:none` globally (would break composer interactions); header-on-top is cleaner.
2. **Portal sanity:** confirm `PaneContextMenu.tsx` stays portal-rendered (`ReactDOM.createPortal(document.body, ...)`) so clipped `dockview` does not reintroduce the issue at menu-render time.
3. **Engine coverage:** verify in both Chromium and WebKit. `docs/PHASE-HISTORY.md:12.2` notes Chromium-only passed while WKWebView still rendered garbled — same risk for stacking. Run `e2e/playwright.config.ts` + `e2e/cli-rendering.config.ts` pair.
4. **Regression spec:** extend `e2e/pane-splitting.spec.ts` with `P4`:
   ```ts
   await page.getByTestId('pane-group-menu').click(); // must not require dispatchEvent
   await expect(page.getByRole('menuitem')).toHaveCount(6);
   await page.getByRole('menuitem', {name:/Split Vertical/}).click();
   await expect(page.locator('.dv-view')).toHaveCount(3);
   // persist via session.layout set/get across reload
   ```

### Verification Steps After Fix

* `locator.click()` on `pane-group-menu` succeeds headless; menu screenshots in `1280×850` and `600×850`; split/rename/zoom/close round-trip persists through `POST session.layout.set` → `session.layout` echo on reload; no `pointer` log in Playwright.

---

## Bug 2 — `/$` slash triggers only for the active agent's sigil

* **Severity:** Low — by design, but confusing UX
* **Component:** `packages/web/src/composerCommands.ts` (`activeSigilToken`, `filterCommands`, `AGENT_SIGIL`), `packages/web/src/views/Chat.tsx` (`slashToken`, `slashPopover`, `SliderPopover.tsx`/`SlashPopover.tsx`), `packages/web/src/store.ts` (`sessionCommands[sessionId][agent]`, `fetchCommands`), `crates/perch-core/src/commands.rs`
* **Status:** Design-correct; UX improvement proposed

### Reproduction

```js
// Default store.agent = 'claude', sigil = '/'
await textarea.fill(''); await page.keyboard.type('/',{delay:30})
// → [data-testid="composer-slash-popover"] 1 visible, 40 items:
//    '/__remote-workflow','/agents','/autocompact'… (b1-slash.png, f? same)
await textarea.fill(''); await page.keyboard.type('$',{delay:30})
// → popover 0

// Switch agent via ModelChip
await page.locator('[data-testid="model-chip"]').click() // shows Claude|Codex toggle
await page.locator('button').filter({hasText:/^Codex$/}).click() // 6 codex models: GPT-5.6 Sol/Terra/Luna…
await page.locator('[data-testid*="model-option"]').first().click()
await textarea.fill(''); await page.keyboard.type('$',{delay:30})
// → popover 1, 16 items (codex skills with descriptions)  f3-codex-slash.png
await textarea.fill(''); await page.keyboard.type('/',{delay:30})
// → now 0 for claude sigil while agent=codex — symmetric
```

### Expected vs Actual

* Current: `AGENT_SIGIL = {claude:'/', codex:'$'}`; `Chat.tsx:745 slashToken = activeSigilToken(text,caret,sigil)` where `sigil = AGENT_SIGIL[store.agent]`. `$` while `agent==='claude'` → `sigil==='/'`, `lastIndexOf('$')===-1` → `null` → no popover. Sending `"$skill"` to claude would be invalid anyway (`agent.rs` expects claude path list vs codex `-i` before mandatory `--`/`-` separator), so cross-agent suggestions would enable a mis-send.
* Some users expect **either** sigil to work regardless of selected agent — that is the perceived bug.

### Root Cause

Sigil is **per-agent derived each render, never stored** (`Chat.tsx` comment: `open-state is derived each render from activeSigilToken, never stored, so it can't desync from the textarea`). `sessionCommands` is keyed `host+cwd` per `commands.rs` (300s TTL), with `claude` entries bare/no-description and `codex` entries with description; filtering is prefix-then-substring, cap 40. The store never queries the non-active agent's list for the current caret.

### How Tested

* `verify-perch-full2.cjs`: `/` → 40 items, `$` → 0 while `agent=claude`. `verify-perch-final.cjs` post `ModelChip → Codex`: `$` → 16 items, `/` → 0 while `agent=codex`. Also checked `filterCommands` unit tests (`composerCommands.test.ts`) and `commands.rs` probe shape (`claude -p "/effort" --no-session-persistence` init-line vs `codex debug prompt-input` block).

### Fix Plan — Two Options

**Option A — Keep strict, add hint (recommended, zero protocol change):**
* In `Chat.tsx`, when `activeSigilToken(text,caret, OTHER_SIGIL) !== null` but `slashOpen===false`, render a disabled hint under composer:
  > `"$" is Codex's sigil — switch agent to Codex to see skills (current: Claude)`
* Keeps `AGENT_SIGIL` invariant and `"no mis-send"` guarantee; mirrors Herdr's per-pane `report-agent` binding (agent is per-pane, not per-keystroke).

**Option B — Show both, auto-switch (broader change):**
* Query both `sessionCommands[sessionId].claude` and `.codex`; render two labeled sections `Claude /…` / `Codex $…`; `applyCommand` for a codex pick calls `store.setAgent('codex')` and inserts `$name `. Requires touching `store.ts:setAgent` inside `Chat.tsx:applyCommand` and documenting relaxation of the derived-only invariant.

### Verification Steps After Fix

* `e2e/chat-power.spec.ts` already covers `/` → popover → `Enter` accept; add `S6` for `$` in claude context (A → hint visible, B → both sections), `S7` for codex context reciprocal. Assert hint does not intercept `Send` (`Enter` with `slashOpen===false` still submits) and that picking a codex skill while on claude either does nothing (A) or switches agent label to `Codex · …` (B).

---

## Bug 3 — `claude-fable-5` exits 1 (`ANTHROPIC_API_KEY` takes precedence)

* **Severity:** Low — environment, not perch code
* **Component:** `crates/perch-core/src/agent.rs` (headless `ClaudeRunner`), `crates/perch-core/src/boot.rs` (`scrub_nested_agent_env`, `adopt_login_shell_path`), subprocess PATH
* **Status:** Working as documented; warn-only

### Reproduction

1. Have `ANTHROPIC_API_KEY` or another auth source exported in the parent shell (common when perch itself is launched from a `claude` session).
2. Start perch (`cargo run -p perch-core --port 7788` or `perch-desktop` from Finder), send any hosted message (`hello perch verify` via `Chat.tsx` `Send`).
3. `perch-core` log + `chat.tool_result`/`chat.done` shows:
   ```
   There's an issue with the selected model (claude-fable-5). It may not exist or you may not have access to it.
   Run --model to pick a different model.
   claude exited with code 1: ⚠ claude.ai connectors are disabled because
   ANTHROPIC_API_KEY or another auth source is set and takes precedence over your claude.ai login
   · Unset it to load your organization's connectors
   ```
   Session still created, `StatusDot` transitions working → blocked-checked, `ctx` and `cost` fields `0$0.000` (no usage because runner never streamed).

### Expected vs Actual

* Expected: runner streams `chat.chunk` → `chat.done {usage:{input/output, costUsd, contextTokens}}`.
* Actual: `ClaudeRunner` spawns `claude -p --output-format stream-json --session-id/--resume --model claude-fable-5` which fails at auth, exits 1, perch surfaces the CLI stderr as a `tool_result` error (correct — proves runner wiring is live, not mocked).

### Root Cause

`boot.rs:scrub_nested_agent_env()` strips `CLAUDE_CODE_CHILD_SESSION`/`CLAUDECODE`/`CLAUDE_CODE_ENTRYPOINT`/`CLAUDE_CODE_SSE_PORT`, and `adopt_login_shell_path()` merges login-shell `PATH` so brew `claude` resolves, but neither unsets a user-exported `ANTHROPIC_API_KEY`. The `claude` CLI prefers env-key auth over `claude.ai` login per its own warning. Perch inherits the parent env by design (so user tools work) and does not silently drop credentials.

### How Tested

* Live `Send` on `7788` with isolated DB hit real `agent.rs` → `detached.rs` `nohup` path (when on `direct` host) and local `tokio::process`. No mock — `strip_image_blocks` (`[image]` replacement) was not exercised because there was no streaming `tool_result` with base64.

### Fix Plan

* **No code fix required** for correctness. Document in `docs/PHASE-HISTORY.md` / onboarding `Got it` copy:
  > If you launch perch from inside a Claude Code session, `ANTHROPIC_API_KEY` in the parent env disables `claude.ai` connectors. Either `unset ANTHROPIC_API_KEY` before launching perch, or run perch from Finder/`env -i` (Phase 11 bundle check already uses `env -i PATH=/usr/bin:/bin…`).
* Optional `boot.rs` follow-up (only if we want to guard the warehouse): add an `INFO` log on boot when `ANTHROPIC_API_KEY` is set, pointing at the same `unset` guidance — do **not** silently strip it (could break intended API-key workflows).
* Verification: `env -u ANTHROPIC_API_KEY cargo run -p perch-core …` → hosted turn streams correctly; `ANTHROPIC_API_KEY=1` → same warning surfaces as `chat.tool_result` error.

---

## Bug 4 — `+ New session` alone leaves `project-list` as `No projects yet.`

* **Severity:** Low — intentional anti-clutter, but surprising
* **Component:** `crates/perch-core/src/db.rs` (`SESSION_VISIBILITY_FILTER`, `SESSION_LIST_ROW_SELECT`, `session_list_row_from_row`), `crates/perch-core/src/server.rs` (`session.create`/`subscribe`), `packages/web/src/store.ts` (`switchSession`, `createSessionOnHost`)
* **Status:** By design (Phases 3.2, 9)

### Reproduction

1. Fresh DB, no sessions. Click `Sidebar → + New session` (`[data-testid="new-session-local"]`) or `TabBar → +` (`tab-new`).
2. Observe `Sidebar → project-list`: `No projects yet.` No new project header. `TabBar` tabs stay at 1 (`Chat` placeholder). `DockviewShell` still shows the blank `Chat` panel.

### Expected vs Actual

* Naive expected: new row appears immediately.
* Actual: session row is `INSERT OR IGNORE` but `list_sessions` filters `WHERE EXISTS (SELECT 1 FROM messages WHERE session_id = sessions.id) OR cli_activity=1`. A blank session has no `messages` and no `cli_activity`, so `session.list` omits it and `session.updated` push agrees via shared `SESSION_LIST_ROW_SELECT`. The blank tab reuses the in-memory session until first user prompt/CLI attach — no sidebar clutter. Verified: second `+ New session` click did not stack a new blank tab (reuses `activeProjectSessions` scoped count).

### Root Cause

Lazy materialization: `db.rs:create_session` is `INSERT OR IGNORE`; `get_session_layout` materializes only when dockview saves. `list_sessions`'s visibility filter is load-bearing to avoid ghost sessions from every `ws.ts` auto-mint on connect. `switchAwayFromActiveSession` falls back to `switchSession` among visible sessions, so blank sessions are safely reusable.

### How Tested

* Playwright `verify-perch-full.cjs` `a2-after-new-session`: `project-list` text `No projects yet.` after two `+` clicks; `tabs` count `2` (one real after `Send`, one blank reused). `wave1.spec.ts` `T4` and `sessions.spec.ts` `S2` assert the same precondition (`sessionId:null` only when no visible sessions).

### Fix Plan

* **No code fix** — this is the intended Phase 9 `SESSION_VISIBILITY_FILTER` + Phase 12 `cliStartedSessions`/`cliStarted` gate behavior. Only improve copy if users report confusion:
  * `EmptyState` when `project-list` empty and a blank session exists: `"Press Send to create the first session in this project"` (already near `NoSessionPanel.tsx`).
  * Verify via `e2e/sessions.spec.ts` `S1/S2` (already green).

---

## Bug 5 — Herdr `worktree list` without `--workspace` → `not_git_worktree` (Perch gating)

* **Severity:** Low — Herdr guard is correct; Perch already gates correctly
* **Component:** Herdr `src/worktree.rs` (`require Git work tree`), perch `crates/perch-core/src/worktree.rs`, `packages/web/src/components/WorktreeMenu.tsx`, `packages/web/src/store.ts` (`workspaceGit`, `worktrees` cache)
* **Status:** Correct behavior; Perch parity already matches

### Reproduction

```bash
herdr workspace create --label perch-verify          # cwd=/Users/hwiii (no .git) → w1
herdr worktree list                                  # → {"code":"not_git_worktree","message":"Herdr worktree actions require a workspace inside a Git work tree"}
herdr worktree list --workspace w1                   # → same error (w1 not git)
herdr workspace create --cwd /Users/hwiii/Documents/Github/perch --label perch-git → w2
herdr worktree list --workspace w2                   # → {branch:main, path:/…/perch, is_linked_worktree:false}
herdr worktree create --workspace w2                 # → branch worktree/lucky-field-6254 @ ~/.herdr/worktrees/perch/…
herdr worktree list --workspace w2                   # → [main, worktree/lucky-field-6254]
herdr api snapshot | jq '.result.snapshot.workspaces[] | select(.label=="perch-git")'
```

Perch live:

```js
// Hosted session in /Users/hwiii/Documents/Github/perch (git)
// Sidebar project header shows 📦 glyph: branch main, dirty? badge
await page.locator('[data-testid*="worktree"]').first().click()
// → popover 7 items: 'perch main primary dirty /…/perch Open' + ' + New worktree…'  c4-worktree-open.png
// Non-git cwd (home) → no 📦 button rendered at all
```

### Expected vs Actual

* Herdr expected: bare `worktree list` without a git-aware workspace should list something. Actual: strict `Err(not_git_worktree)` unless given a `--workspace <id>` whose `Workspace.worktree.repo_key` is `Some`.
* Perch expected: `WorktreeMenu` should work for any project. Actual: perch already gates the glyph on `store.workspaceGit[key].branch` (populated only when `status.rs` proves `cwd` is a git checkout), so non-git projects see no glyph — equivalent to Herdr's error but silent.

### Root Cause

Herdr `src/worktree.rs` `list` branches on `Workspace.worktree: Option<WorktreeRepo>` (derived from `repo_root`/`repo_key` at `workspace create`). Non-git cwd → `None` → `Err`. Perch `crates/perch-core/src/worktree.rs` `worktree create` default root is `~/.perch/worktrees/<repo>/<branch-slug>` (mirrors `~/.herdr/worktrees`), but `worktree.list` similarly finds no `repo_root` for non-git `cwd`; `WorktreeMenu.tsx` hides itself to avoid a pointless list.

### How Tested

* Herdr CLI+socket above; perch Playwright `verify-perch-full3.cjs` `c4-worktree-open` (7 items) and `verify-perch-full2.cjs` `worktree btn vis true`, `git badge count 1`, `statusDot` parity. Existing `e2e/worktrees.spec.ts` fixtures use a temp throwaway repo to avoid polluting `~/.herdr/worktrees`.

### Fix Plan

1. **Keep gating** as parity — do not render `WorktreeMenu` for non-git `cwd` (current behavior already matches Herdr's intent). No Herdr code to change.
2. **Optional UX polish for Perch** (if silent absence confuses):
   * In `WorktreeMenu.tsx`, when `workspaceGit[key]` has no `branch`, render tooltip on the project header: `Not a git repository — worktrees unavailable` (instead of hiding glyph entirely). Zero protocol change.
   * For strict Herdr parity in error surfacing: add `WorktreeError {code:"not_git_worktree"}` variant in `worktree.rs` and map `repo_root.is_none()` to `worktree.error {code:"not_git_worktree"}` hub-routed via `PendingKey::Worktree` + `strip_host_id` (like `fs.browse` fix in Phase 6). Client raises a toast `Not a git repository` if the user ever invokes `worktree.create` on a non-git project (currently unreachable because glyph hidden, but covers programmatic `worktree.create` messages).
3. **Regression:** extend `e2e/worktrees.spec.ts` with `WT0` — session in non-git temp dir → assert `📦` absent or tooltip, `worktree.list` returns empty without error; `WT1` primary listed remains green.

---

## Appendix — Test Matrix

| Gate | How run (live) | Result |
|---|---|---|
| `cargo build -p perch-core` | `1.97.1` dev profile | `Finished` 0.32s |
| `npm run build` | `vite 6.4.3` + PWA `workbox 0.21.2` | `✓ 130 modules, 1273 KiB precache` |
| `cargo test -p perch-core` | `cargo test -- --skip ignored` | `151 passed` + `protocol_parity 1 passed` (0.67s+0.15s) |
| `cargo clippy --workspace --all-targets` | clippy | pre-existing 5 warnings only |
| `playwright` headless verification | `verify-perch*.cjs` / `verify-perch-final*.cjs` on `7788` | `a0-a20`, `b0-b6`, `c0-c10`, `f0-f10` screenshots logged above |
| Herdr CLI live | `herdr server` `0.8.0` + `workspace/tab/pane/worktree` CRUD | `1 workspace→2 tabs→3 panes→1 linked worktree` verified |

*No patch applied in this pass — this file is the plan awaiting sign-off.*

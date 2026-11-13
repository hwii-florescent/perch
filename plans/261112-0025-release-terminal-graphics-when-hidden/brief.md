# Brief: release terminal graphics while Perch is not visible

Written 2026-11-12 for a long, unattended agent session (ak-atoz or ak-cook). This file is the whole context: read
it, then the files it names. Evidence and numbers come from
`plans/reports/research-261111-2350-perch-memory-optimization.md`; read that report first.

## Outcome

When the Perch desktop window is hidden, minimised, or fully covered by other windows, its terminals hold no WebGL
graphics memory. When the window is visible again, terminals look and behave exactly as before: same grid, same
scrollback, same font scaling, no extra resize sent to the agent.

This must be **proven with measurements**, not assumed. If WebKit does not return the memory after the contexts are
dropped, stop and report that with numbers. That finding is itself a valid result, because it decides the next step
(see "Decision this unlocks").

## Why

Measured in headless WebKit at 2x: showing one terminal adds 75–140 MB, depending on window size, almost all of it in
WebKit's GPU process. The cost is WebGL's one-off setup plus about three copies of the Retina-sized canvas. Today
`xtermSetup.ts` drops a terminal's WebGL context only when the terminal scrolls out of view (an IntersectionObserver).
It doesn't when the whole window is hidden, so Perch keeps that memory all day while it sits in the background.

## Scope

1. **Fix the repo's memory check first.** `node e2e/memory/memory.mjs` currently fails: it times out waiting for
   `.xterm`, because its mocked sessions (the `MOCK` function) no longer make the UI show a terminal. Find why (the
   session shape, the onboarding gate, chat mode, or the `agent.terminal.open` reply) and repair the mock so all of
   its existing checks pass again. Do not weaken any check.
2. **Measure before changing behaviour.** Extend `memory.mjs`, or add one focused probe beside it, that reports the
   WebContent and GPU process footprint (`footprint` or `vmmap -summary`) in four states:
   - a terminal shown,
   - after Perch's window-hidden path runs,
   - after showing it again,
   - after several hide/show cycles, to catch leaks.

   Headless WebKit cannot really hide a window, so drive the same code path the real signal would trigger, for example
   by dispatching `visibilitychange` with a stubbed `document.visibilityState`.
3. **Implement the release in `packages/web/src/xtermSetup.ts`,** next to the existing `onScreen` / `attachWebgl` /
   `dropWebgl` logic. Reuse it; don't build a parallel mechanism.
   - A terminal holds WebGL only if it is on screen **and** the page is visible.
   - Use `document.visibilityState` / `visibilitychange` if WKWebView fires it for minimise, hide and full occlusion.
     **Verify which of those it fires for** in the real desktop app.
   - If WKWebView misses any of them, bridge Tauri window events from `crates/perch-desktop` (it already listens to
     `WindowEvent::Focused` in `shortcuts.rs`). Don't use focus loss alone as "hidden": a visible but unfocused
     window must keep its graphics.
4. **Don't let a hidden terminal fall back to an expensive DOM render.** When WebGL is disposed, xterm falls back to
   its DOM renderer. Under a busy TUI that renderer measured 625–940 MB (see the header comment in `xtermSetup.ts`).
   While the page is hidden, agents keep writing output. Make sure the hidden state does not build per-cell DOM for
   that output; for example, keep the terminal's screen element out of rendering until it is shown again. Measure
   this with a busy TUI writing while hidden.
5. **Verify in the real desktop app,** in a hidden, unfocused test window. Measure the real WKWebView's GPU and
   WebContent footprint in the same states as in step 2.

## Acceptance criteria

- `node e2e/memory/memory.mjs` passes, including its existing WebGL context-loss and kept-terminal checks.
- With one terminal shown at 2x, the hidden state's WebContent+GPU footprint falls by most of the terminal's graphics
  cost (target: at least 70% of the shown-minus-no-terminal difference), measured in both headless WebKit and the real
  desktop app. If WebKit keeps the memory, report the numbers and stop here; don't keep tuning.
- Ten hide/show cycles leave the footprint within 10 MB of the first cycle, and the live WebGL context count is never
  above the number of visible terminals.
- A busy TUI writing while hidden never pushes the footprint above the shown-state peak.
- After showing again: the grid is the same size, scrollback is intact, and no PTY resize is sent for the round trip.
  Assert this in a test.
- A visible but unfocused window keeps its WebGL contexts.
- `npm test`, `npm run build`, `cargo test -p perch-core`, `cargo fmt --check` and
  `cargo clippy --workspace --all-targets` (no new warnings) pass. Add `cargo test -p perch-desktop` if the desktop
  crate changed.
- `docs/TESTING.md` is updated if `memory.mjs`'s behaviour or how to run it changed. The `xtermSetup.ts` header
  comment describes the new rule.

## Non-goals

- Replacing xterm.js, adopting Ghostty, or building a shared WebGL canvas. Those are later decisions.
- Hibernating or stopping agents. The owner rejected this; agent processes are not Perch's to manage.
- Lowering pixel ratio, changing scrollback, or changing the kept-terminal limit (`terminalKeeper.ts` `KEEP`).
- Bundle splitting, service-worker changes, or desktop host profiling. Those are separate items in the report.

## Constraints

- Follow `AGENTS.md`:
  - Keep using `createPerchTerminal` in `xtermSetup.ts`, native input, `convertEol: false`, and the server's terminal
    profile and resize authority.
  - Keep the protocol files field-for-field compatible if they change; this work should not need protocol changes.
- **Isolation for every probe:**
  - Scratch `PERCH_DB`, `PERCH_HOSTS`, `PERCHD_DIR`, `PERCH_SETTINGS` and `HOME`.
  - Never the installed app or its daemon (`~/.perch`).
  - Headless only.
  - Desktop checks may use `PERCH_DESKTOP_TEST=1` (hidden, unfocused window) but must never activate windows, take
    focus or send key events.
- **No paid agent turns.** If a real agent turn is unavoidable, use only `claude-haiku-4-5` or `gpt-5.6-luna` and
  verify the banner first. New sessions start an idle Claude process even with no prompt; prefer mocked sessions.
- **Clean up everything you start:** cores, the `__perchd serve --dir <scratch>` daemon and its children, browsers.
  Verify by PID before finishing. Never use broad `pkill` patterns.
- **Commits:**
  - Commit each verified slice locally with conventional commit messages.
  - Never push.
  - Don't put plan or phase labels in code, test names or commits.
- Work from the current `main` working tree. It has unrelated uncommitted changes; don't commit or revert them.
  Stage only your own files.

## Files to read first

- `AGENTS.md`, `docs/TESTING.md` (the isolated probes and memory sections), `docs/ARCHITECTURE.md` (terminal section)
- `packages/web/src/xtermSetup.ts`: the header (WebGL rationale) and `attachWebgl` / `dropWebgl` / IntersectionObserver
  (~lines 600–660)
- `packages/web/src/terminalKeeper.ts`: parked terminals and `KEEP`
- `e2e/memory/memory.mjs`
- `crates/perch-desktop/src/main.rs` (test mode) and `crates/perch-desktop/src/shortcuts.rs` (window events)
- `plans/reports/research-261111-2350-perch-memory-optimization.md`

## Decision this unlocks

- **If releasing while hidden frees the memory:** it ships. The next question is whether a Ghostty native terminal
  view is worth it for the time Perch is on screen.
- **If WebKit keeps the memory after the contexts are lost:** releasing graphics from the web side cannot fix it.
  Only moving terminal drawing out of WebKit (a native view) can.

## Report at the end

Write `plans/reports/` + a dated report with:
- the footprint table for each state (headless and real desktop),
- which window events WKWebView actually fires,
- what changed, the commits, and the commands run with their results,
- anything left unproven.

End with: Status (DONE, DONE_WITH_CONCERNS, BLOCKED or NEEDS_CONTEXT), a one-line summary, and any blockers.

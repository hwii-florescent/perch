# Brief: native GPUI desktop client with Ghostty terminals

Written 2026-11-12 for a long, unattended `/ak-atoz` run. This file is the starting context. ak-atoz should lock the
scope with the owner once (the open questions at the end), then run without check-ins.

## Outcome

Perch gets a native desktop client written in Rust with GPUI. Its terminals use Ghostty's terminal engine
(libghostty-vt) and are drawn by GPUI, the way herdr does it. The terminal daemon (`perchd`) keeps each terminal's
authoritative screen and scrollback in libghostty-vt instead of the `vt100` crate, so every client (native desktop,
web, phone) attaches to the exact screen.

The existing Tauri app, the web UI and the phone keep working throughout. The native client talks to the same
`perch-core` over the same protocol. It doesn't replace the core and doesn't fork it.

## Decisions already made by the owner (2026-11-12)

1. **Full native app with GPUI**, not a native view inside the Tauri window, and not Ghostty compiled to WebAssembly
   inside the webview.
2. **The server holds the screen.** `perchd` keeps a libghostty-vt screen per terminal, as herdr-core does.
3. **Herdr is the reference** for what a Ghostty terminal needs, so nothing is missed.
4. **No agent hibernation.** Agent processes are not Perch's to manage; optimise Perch itself.

Don't reopen these. If evidence makes one impossible, stop and report it with the evidence.

## Why

Measured 2026-11-11 (`plans/reports/research-261111-2350-perch-memory-optimization.md`):
- Perch's desktop app owns about 270 MB.
- The biggest part is WebKit's WebGL terminal drawing: 75–140 MB per visible terminal at Retina scale.
- WebKit's own fixed cost is about 50 MB, and the Tauri/webview host about 30 MB.
- A native client removes all three.
- Users also prefer native apps.

Herdr shows that the architecture works today: GPUI plus libghostty-vt, with terminals owned by a separate core
process.

## What herdr actually does (verified 2026-11-11 at herdr-app `4c8c622`, Apache-2.0)

- **`crates/ghostty-sys/build.rs`** builds libghostty-vt from a vendored Ghostty submodule (`vendor/ghostty`) with
  Zig, and generates bindings from its headers.
- **`src/vt.rs`** (about 2,700 lines) wraps the C API. It uses:
  - terminal state and render state (rows and cells),
  - the key encoder and mouse encoder,
  - selection gestures,
  - search across scrollback,
  - scrollback capped at 10,000 lines or 10 MB, whichever comes first,
  - grapheme clustering (mode 2027), synchronised output (mode 2026) and bracketed paste,
  - kitty graphics and title callbacks.
- **`src/terminal.rs`** (about 4,300 lines) is the GPUI view. It draws cells with GPUI's text system and handles:
  - font fallback and a symbols font,
  - selection (double and triple click, sub-pixel gestures), scrollbar, links (Cmd-click), select-all,
  - IME composition and hidden-pane focus,
  - attaching with a bounded wait and a full repaint from the core.
- **`src/window.rs`** keeps every tab's terminals attached and draws only the visible ones (`fit_hidden_tabs` sizes
  the hidden ones).
- **GPUI is a vendored, pinned pre-release fork** (`gpui-pre 0.3.8`, plus `gpui-kit`) with platform crates per OS.
- **Mods are JavaScript on a vendored QuickJS JIT runtime.** This brief doesn't cover that (see Non-goals).

Herdr is Apache-2.0. Code adapted from it needs Apache-2.0 attribution (NOTICE and file headers) and must keep its
licence terms. Prefer learning from it and writing Perch's own code. Where code is copied, record it.

## Scope, in phases

ak-atoz should refine these into its Done-means. Each phase ends with local, verified commits.

### Phase 0: prerequisites (collect all before any code)

- **Zig toolchain:** pin the version Ghostty needs.
- **Ghostty:** pin a Ghostty commit as a submodule, and confirm that `libghostty-vt` builds for the macOS targets
  Perch ships (Apple Silicon at least).
- **GPUI source:**
  - upstream Zed `gpui`,
  - the `gpui-pre` crates herdr uses,
  - or vendoring.

  Record the choice and the reason in `docs/DECISIONS.md`.
- **Licensing:** confirm the licence and attribution for GPUI, Ghostty and any herdr-derived code.
- **CI and build impact:** build time, binary size, and whether `npm ci && npm run build` and the existing cargo
  workspace still build without Zig for developers who don't touch the native client. Feature-gate it if needed.

### Phase 1: libghostty-vt in the server

- **Add a `ghostty-sys` crate** to the Perch workspace, modelled on herdr's `build.rs`.
- **Replace `vt100`** in `crates/perchd/src/screen.rs`, and wherever `perch-core` uses `vt100`, with libghostty-vt.
  The screen gets real scrollback with a cap, like herdr's 10,000 lines or 10 MB.
- **Attach repaint:** the repaint bytes an attach sends (`Screen`'s "bytes that recreate them in a fresh emulator")
  are generated from the Ghostty screen.
- **Web and phone clients:** xterm.js must see the same or a better repaint, including scrollback, alternate screen
  and modes.
- **Protocol:** no breaking change. Any new message (for example a structured render-state stream for native
  clients) must be capability-gated and stay field-for-field compatible between `crates/perch-core/src/protocol.rs`
  and `packages/shared/src/protocol.ts`.

### Phase 2: the native client skeleton

- New crate, for example `crates/perch-native`. A GPUI app that:
  - connects to a local `perch-core` with the same local login or token flow the Tauri app uses,
  - lists sessions,
  - opens one terminal pane.
- It reuses the core and the protocol; no domain logic is duplicated in the client.

### Phase 3: terminal parity

Build the native terminal to a written checklist with two parts:

1. **Everything herdr's terminal does.** Inventory `src/vt.rs`, `src/terminal.rs` and the terminal parts of
   `src/window.rs` and `src/commands.rs` yourself; the list above is a starting point, not complete.
2. **Everything Perch's terminal does today.** Read `packages/web/src/xtermSetup.ts`, `terminalKeeper.ts`,
   `docs/CONTEXT-BRIDGE.md` and `docs/ARCHITECTURE.md`. At least:
   - the user's terminal profile and colours (iTerm profile, `iterm_profile.rs`),
   - server resize authority, and keeping at least `MIN_COLS` columns by shrinking the font,
   - native input and IME,
   - OSC 52 clipboard, kitty keyboard, search, links that open browser tabs,
   - input and resize ownership with shared input across devices,
   - agent status integration,
   - Context Bridge's explicit send, never arbitrary paste.

Each item gets a test or a recorded manual check.

### Phase 4: a usable daily client

ak-atoz should agree the minimum set with the owner. At least:
- sessions and projects in a sidebar,
- tabs and splits,
- launching agents,
- attention states (Needs You, done),
- settings needed for terminals.

Follow `docs/DECISIONS.md` for approved UX.

### Phase 5: proof

- **Memory:** measure the native client's physical footprint (`footprint`) against the Tauri app, with the same
  sessions in four states: idle, one terminal shown, four split terminals shown, and a busy TUI.
- **Correctness:** run a terminal stress set (colourful full-screen TUIs, agent CLIs, wide and CJK text, emoji,
  kitty graphics) in both clients and compare.

## Acceptance criteria

- `cargo test -p perch-core`, `cargo test -p perchd`, `npm test`, `npm run build`, `cargo fmt --check` and
  `cargo clippy --workspace --all-targets` (no new warnings) pass. The native crate's own tests also pass.
- The web and phone clients show the same or a better attach repaint after the server switch, with tests for:
  - an alternate-screen TUI attached long after it painted,
  - scrollback beyond one screen,
  - mouse and bracketed-paste modes surviving reattach.
- The native client opens, attaches to an existing agent session, types, resizes, scrolls, selects, searches and
  copies, all checked by tests using GPUI's headless rendering or test support.
- The Phase 3 checklist is complete, each item marked tested, manually checked, or deliberately deferred with the
  owner's approval.
- The native client's footprint with one terminal shown is at least 100 MB below the Tauri app's in the same state.
  Report the actual numbers either way.
- The Tauri app, web UI and phone UI still pass their existing checks.

## Non-goals

- Removing the Tauri app, the web UI or the phone UI.
- Native hot-swappable UI and mods (herdr's QuickJS mods). That is a separate project; don't start it here.
- Windows and Linux builds, unless they come free.
- Agent hibernation or managing agent processes.
- Changing what the terminal looks like by default: the user's own terminal colours and font stay.

## Constraints

- **Follow `AGENTS.md`:**
  - Rust owns domain logic.
  - Unknown runtime state is not exit: never relaunch, destroy bookkeeping or fall back to local execution on
    uncertainty.
  - `perchd` owns PTYs across app and core restarts; the screen change must not break that continuity.
- **Isolation for every probe:**
  - Scratch `PERCH_DB`, `PERCH_HOSTS`, `PERCHD_DIR`, `PERCH_SETTINGS` and `HOME`.
  - Never the installed app or `~/.perch`.
- **No focus stealing.** Never activate windows or send keys to the owner's screen.
  - Prefer GPUI's headless render-to-image and test support for checks.
  - A native window, if needed, must be created hidden and never activate the app.
  - If a real visible window is unavoidable, stop and ask.
- **No paid agent turns.** Prefer mocked sessions. If a real agent is unavoidable, use only `claude-haiku-4-5` or
  `gpt-5.6-luna` and verify the banner first.
- **Clean up everything you start:** cores, `__perchd serve --dir <scratch>` daemons and their children, apps.
  Verify by PID. No broad `pkill`.
- **Commits:**
  - Commit each verified slice locally with conventional commits.
  - Never push.
  - No plan or phase labels in code, test names or commits.
- The working tree on `main` has unrelated uncommitted changes. Work in a worktree or branch, stage only your own
  files, and don't revert others' work.

## Files to read first

- `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/TESTING.md`, `docs/CONTEXT-BRIDGE.md`
- `crates/perchd/src/screen.rs` and where `vt100` is used in `crates/perch-core`
- `crates/perch-core/src/protocol.rs`, `packages/shared/src/protocol.ts`
- `packages/web/src/xtermSetup.ts`, `packages/web/src/terminalKeeper.ts`
- `crates/perch-desktop/src/main.rs` (local login, test mode)
- `plans/reports/research-261111-2350-perch-memory-optimization.md`
- herdr-app, cloned at `4c8c622`: `crates/ghostty-sys/build.rs`, `src/vt.rs`, `src/terminal.rs`, `src/window.rs`,
  `Cargo.toml`. Clone from https://github.com/herdrdev/herdr-app (it has a `vendor/ghostty` submodule).

## Open questions for ak-atoz to settle with the owner up front

1. Which GPUI source: upstream Zed `gpui`, herdr's `gpui-pre` crates, or vendored?
2. What is the minimum Phase 4 feature set for a client the owner would use daily?
3. Should the native client eventually replace the Tauri app on macOS, or live beside it permanently?
4. Should the server also stream structured render state (cells), not just repaint bytes, to native clients? That is
   faster and exact, but adds a capability-gated protocol family.

## Report at the end

Write a dated report in `plans/reports/` with:
- what was built and the commits,
- the parity checklist with each item's status,
- the memory table (Tauri vs native),
- the commands run with their results,
- anything deferred, with the owner's approval.

End with: Status (DONE, DONE_WITH_CONCERNS, BLOCKED or NEEDS_CONTEXT), a one-line summary, and any blockers.

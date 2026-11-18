# perch-native: rules for agents

The macOS GPUI client. Another view of the same `perch-core` as the Tauri app: it owns no
domain data, only this window's layout. Read this whole file before changing anything here;
read a module's `//!` header and its callers before changing that module.

## Shape in one screen

| Piece | Where | Owns |
| --- | --- | --- |
| Core link | `src/client.rs` | sign-in, live projects/sessions, terminal sockets. Frames match `perch_core::protocol` (`frames_match_the_core_protocol`). |
| Facts → model | `src/sidebar.rs`, `src/sidebar/navigation.rs` | reduces core messages; `navigation.rs` ports the web's `navigation.ts` rule for rule. Never guesses state. |
| Tabs and splits | `src/tabs.rs` (no GPUI) | ids and shapes only, per window, per workspace. |
| The window | `src/workspace.rs`, `src/workspace/*` | draws tabs, panes, drawer; runs commands. |
| Keys | `src/keymap.rs`, `src/actions.rs` | key → command, shortcut labels. |
| Terminal | `src/terminal/*` | libghostty-vt per tab, fed the same bytes as xterm.js. |
| Files, Git, diff, editor, browser | `src/files`, `src/git`, `src/diff`, `src/editor`, `src/browser` | native stores and engines behind stock screens. |
| Mod engine | `src/mods.rs`, `src/mods/*`, `vendor/gpui-kit` | runs JS screens on QuickJS. |
| Stock screens | `mods/<id>/` | the web's `packages/web/src/stock-ui/<id>` exported and run natively (`runtime: react`). |

Most visible chrome (sidebar, tab strip, tab drag ghost, status bar, review, files, settings,
dialogs) is a **stock screen**: the same React code as the Tauri app, run on our React runtime
(`mods/react-runtime`, `src/mods/react_host.rs`). Fix its look or behaviour in
`packages/web/src/stock-ui/<id>/` so web and native stay identical, then re-export; fix data or
commands in Rust (`src/mods/perch.rs` is the `@perch/sdk` host module). Never fork a stock screen
inside `mods/`.

## Hard rules

- **Script time budgets** (`vendor/gpui-kit/crates/shell/src/engine/quickjs/sandbox.rs`
  `Budgets`): a `render()` call gets **50 ms**, an event handler 500 ms, module load 5 s. Past
  it the call is cut off and the screen shows the last good render under an error banner.
  QuickJS has no JIT, so treat these as hard ceilings, not targets: a whole-tree re-describe of
  a 40-session sidebar costs ~20-50 ms. Consequences:
  - no work per pointer move in script: hover, drag following and scrolling must be done by the
    Rust side (GPUI hover styles, `tab_drag.rs`, native scroll) with **zero script renders**
    (`tests/mods_responsive.rs` asserts hover);
  - keep props small and stable; memoise rows; never send a whole store to a screen per tick;
  - measure with `tests/screen_engine_measure.rs` before and after anything on a hot path.
- The core owns every fact (sessions, their order, state, cwd). Unknown is shown as unknown,
  never as exited; never relaunch or fall back to local execution on uncertainty
  (root `AGENTS.md`).
- Per-viewer layout (tabs, splits, drawer tab, widths) is this window's, saved on this device;
  it is never written to the core.
- Ordering that the core stores (`workspace.order.set`) is sent as the full list the person
  produced, from the latest core order, never from a stale local copy.
- Mods are trusted code but get no more than a web mod (`ModHost::policy_for`).
- Do not move the GPUI or Ghostty pin, or patch `vendor/gpui-pre*` beyond the `PERCH:`-marked
  patches, without the owner.

## Build and test

```sh
export ZIG=/opt/homebrew/opt/zig@0.16/bin/zig
cargo test -p perch-native --lib            # model, keys, frames: fast
cargo test -p perch-native --test <name>    # one harness from tests/
cargo test -p perch-native                  # all; never together with -p perch-core
npm run build                               # after any stock-ui change, re-exports mods
```

- Tests are headless: GPUI's test platform renders to a texture (`SHOT=<dir>` saves PNGs); keys
  go through `dispatch_keystroke`. `tests/common/mod.rs` has the helpers; harnesses are
  `harness = false` binaries.
- Anything that starts a core or daemon isolates `PERCH_DB`, `PERCH_HOSTS`, `PERCHD_DIR`,
  `PERCH_SETTINGS` and `HOME`, strips `perch-native-*.shell/bin` from `PATH`, and unsets
  `PERCH_SESSION`, `PERCH_SHELL`, `PERCH_TOKEN`, `PERCH_USER_ZDOTDIR`, `TERM_PROGRAM`.
- Never steal focus: no window activation, no posted key or mouse events, no `open -a`.
  `PERCH_NATIVE_TEST=1` orders a window in without the keyboard (`src/test_mode.rs`).
- Parity gate (look matches the web): `node e2e/native-parity/compare.mjs` after the capture
  tests.

More: [docs/NATIVE.md](../../docs/NATIVE.md) (behaviour contracts: workspaces and tabs, drawer,
persistence, screens), [docs/TESTING.md](../../docs/TESTING.md) "Native client",
[docs/MOD-SDK.md](../../docs/MOD-SDK.md).

# Brief: fix the native terminal's input, then give the GPUI client a JS mod engine

Written 2026-11-13 for a long, unattended run (`/ak-atoz`). This file is the starting context. Lock the scope with
the owner once, then run without check-ins. Draft: the owner may edit the decision rule and the screen order
before confirming.

## Where this comes from

`crates/perch-native` (GPUI, Ghostty terminals) is on `main` and passes its headless tests, but a first hands-on
run found input bugs, and the owner judges its layout and design wrong against the Tauri app. The owner's bar for
the native client: it looks and behaves like the Tauri app, and stock UI mods stay hot-swappable. Background (removed 2026-11-15, in git history): the GPUI-or-SwiftUI memo and the 2026-11-12 native plan.

The roadmap the owner chose keeps GPUI and ports one piece at a time: terminal fixes, a mod engine, the window's
chrome as mods, then the stock screens. This run covers the first three. The Rust views for the sidebar, tabs,
palette and settings will be replaced by mods, so **do not polish them**.

## Outcome

1. The five input and listing bugs below each have a proven cause, a test that failed before the fix, and a fix.
2. The native client runs JavaScript mods that draw GPUI elements and reload on save, as herdr's do.
3. The sidebar exists as a mod, built two ways, compared against the web sidebar, and one way is chosen by the
   rule below.
4. With the chosen way, the rest of the chrome is ported as mods, one screen at a time, each replacing its Rust
   view.

## Part A: terminal and listing bugs (prove the cause before any fix)

Found by driving the app with synthetic input, so first decide for each whether it is the client or the tool.

1. `/` types nothing in a terminal pane; letters and Shift+1 work. `terminal/keys.rs:337` maps `/` correctly, so the
   cause is elsewhere and unknown.
2. A posted Unicode key event arrives as `a` for every character. **Cause already read in source:** GPUI builds a
   key's text from the keycode (`gpui-pre-macos-0.3.8/src/events.rs:434-467`), sends a printable key to the view's
   key handler before the system input context (`window.rs:2736`), and `terminal/view.rs:1010` consumes it there,
   so the event's own characters are never read. Confirm with a test, then decide the fix (for example, let
   unmodified printable keys reach the input handler) without breaking kitty keyboard encoding or IME.
3. A click with no mouse-move before it is ignored.
4. Cmd-Shift-P does nothing. Check the palette's real binding against the `keys.json` defaults and the web app.
5. A new session is not listed under its project until the project is expanded.

Then check what can be checked without sending keys to the owner's screen: find, links, tab close, settings.
Leave a short list of what only a person at a keyboard can confirm (Option as Alt left and right, an IME
composition, drag).

## Part B: the mod engine

Reference: herdr-app at `~/Github/perch-refs/herdr-app` (`4c8c622`, Apache-2.0, read-only). Read
`defaults/AGENTS.md` (its mod guide), `src/mods.rs`, `vendor/gpui-kit/crates/shell`, `vendor/quickjs-jit-runtime`
and two or three of `defaults/mods/*`.

- herdr's mods are JavaScript on QuickJS. A mod's `render()` returns a description of elements and Rust turns it
  into GPUI elements; saving a file reloads it. There is no DOM.
- The published `gpui-shell` crate has no release that fits `gpui-pre =0.3.8` (only 0.8.1 and later). herdr vendors
  `gpui-kit` at 0.7.1 with the shell and a patched QuickJS. Do the same, record it in `THIRD_PARTY_NOTICES.md`, and
  keep the GPUI pin where it is.
- Give mods a `perch` module backed by the existing Rust models (`client.rs`, `sidebar.rs`, `tabs.rs`,
  `actions.rs`, `keymap.rs`). Where a concept already exists in `packages/web/src/perch-sdk.d.ts` (data, commands,
  theme tokens, slots, layouts), use the same names.
- Mods live beside the web mods' folder but must not be loaded by the web UI, and web mods must keep working.

### The sidebar, two ways

- **Way 1, element builders:** write the sidebar by hand in JS with `div()`-style builders, as herdr does.
- **Way 2, React:** run the existing source in `packages/web/src/stock-ui/sidebar` through a React renderer that
  creates GPUI elements, with a translator from its Tailwind classes to GPUI styles and a shim for the DOM calls
  it makes. Change the source as little as possible and count the changed lines.

Compare each against the web sidebar rendered headlessly (Playwright, same data, same size, 2x), in these states,
light and dark: by project; by status; a folded project with its rollup; a row that needs you; an offline host.

- **Gate:** every named element's box is within 2 logical pixels of the web one, and every colour that comes from
  a theme token is identical.
- **Report, not gated:** the pixel difference per state, and side-by-side images for the owner.

### Decision rule (so the run can continue)

Choose Way 2 if it passes the gate in all states with fewer than about 200 changed lines in the stock source.
Otherwise choose Way 1 if it passes. If neither passes after two rounds of fixes each, stop and report.

## Part C: the chrome as mods

With the chosen way, port in this order, replacing each Rust view when its mod passes: tabs, status bar, command
palette, pane header and pane menu, dialogs and confirmations, toasts, the New session panel. Each needs the same
gate against its web screen and a behaviour test for its commands. A screen that fails after two attempts stays as
it is and is reported; go on to the next.

## Acceptance

- `cargo test -p perch-core`, `cargo test -p perchd`, `cargo test -p perch-native`, `npm test`, `npm run build`,
  `cargo fmt --check` pass; `cargo clippy --workspace --all-targets` shows no new warnings.
- Each Part A bug: cause with evidence, a test that fails without the fix, the fix.
- A mod edited on disk reloads in the running client without a restart, and a mod that throws leaves the last
  working version showing. Both are tested.
- The comparison table for both ways, the decision, and the images are in the report.
- Each Part C screen is either a passing mod with its Rust view deleted, or listed as not done with the reason.

## Non-goals

Settings, files, Git, chat and the other stock screens. CodeMirror or any web view. A native editor. Packaging,
signing, retiring Tauri. The phone and web UIs. Moving the GPUI or Ghostty pin. Changing the protocol.

## Constraints

- Follow `AGENTS.md`. The terminal stays Rust: mods cannot change how it draws. Unknown runtime state is not exit.
- **Isolation for every probe:** scratch `PERCH_DB`, `PERCH_HOSTS`, `PERCHD_DIR`, `PERCH_SETTINGS` and `HOME`.
  Never the installed app or `~/.perch`.
- **No focus stealing.** Never activate a window or post keys to the owner's screen. Prefer headless
  render-to-image; a real window is allowed only if it never takes focus.
- **No paid agent turns.** Mock sessions. If a real agent is unavoidable, only `claude-haiku-4-5` or
  `gpt-5.6-luna`, banner checked first.
- Build with `ZIG=/opt/homebrew/opt/zig@0.16/bin/zig`.
- Work on a branch in a worktree. Commit each verified slice locally with conventional commits. Never push. No plan
  or phase labels in code, test names or commits.
- Stop every process you start, checked by PID. No broad `pkill`.

## Stop and ask only if

- A fix or the mod engine needs a change inside `gpui-pre` itself.
- A check cannot be done without a focused window or real key presses, and it blocks the rest.
- The decision rule cannot be evaluated, or neither way passes.
- A destructive or irreversible action would be needed.

## Report at the end

`plans/reports/` with: each bug's cause, test and fix; the two-way comparison and the decision; the screens ported
and not ported; commands run with results; the list of checks left for the owner's own keyboard; what is still
open. End with Status (DONE, DONE_WITH_CONCERNS, BLOCKED or NEEDS_CONTEXT), a one-line summary, and blockers.

## Confirmed by the owner (2026-11-13), replacing the matching text above

- **Reference renderer:** the web sidebar and screens are rendered in WebKit (the Tauri app is a WKWebView), not
  Chromium.
- **Gate for text-sized elements** (width set by their own text, such as count badges and status labels):
  position and height within 2 logical pixels; font family, size, weight and line height exact; width within
  2 pixels or 3%, whichever is larger. Every width difference is reported per state. All other elements keep the
  2 pixel box gate, and token colours stay identical.
- **Vendored GPUI:** if the vendored mod shell does not compile against crates.io `gpui-pre 0.3.8`, vendor herdr's
  patched copy of `gpui-pre` at the same version (DECISIONS 2026-11-12). Take only the patches the shell needs,
  list each one in `THIRD_PARTY_NOTICES.md` and the report, and continue.
- **A Part A bug that can only be fixed inside `gpui-pre`:** do not fix it and do not stop. Record the proven cause
  and the patch it would need, and continue with the other bugs and Parts B and C.
- **First stop condition is now:** the mod engine needs a `gpui-pre` change that is not one of herdr's existing
  patches at 0.3.8.
- **Also out of scope:** `perch mod` CLI support for native mods; merging the branch into `main`.

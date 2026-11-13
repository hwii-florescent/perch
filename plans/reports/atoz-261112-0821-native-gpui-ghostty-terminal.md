# Native GPUI client with Ghostty terminals: run report

Date: 2026-11-12. Contract: `plans/261112-0025-native-gpui-ghostty-terminal/brief.md` plus the eight decisions
locked with the owner (`plan.md` in the same folder). Nothing was pushed. No GitHub issue, label or PR was made
(waived).

## Outcome

The daemon now holds every terminal's screen and scrollback in Ghostty's engine, and a native GPUI client
(`crates/perch-native`) with the agreed daily set exists and passes its headless tests. With one terminal shown
the native client uses 44 MB against an estimated 231 MB for the Tauri app. The run ends DONE_WITH_CONCERNS:
nobody has used the native client on a lit screen yet, the Tauri figures beyond idle are estimates, 32 parity rows
are proposed deferrals awaiting approval, and `npm run build` fails at a file that is already broken on the base
commit.

Everything is on the local branch `feat/native-gpui-ghostty` in the worktree `/Users/hwiii/Github/perch-native-gpui`
(HEAD `c453f0a3`, 100 commits over `60dd2c7`, 84 files, about 39,000 lines added). `main` is untouched.

## What was built

| Piece | Where | Key commits |
|---|---|---|
| Ghostty engine bindings, pinned submodule, clear error on the wrong Zig | `crates/ghostty-sys`, `third_party/ghostty` at `291fd05` | `affaaa11` |
| Daemon screen on libghostty-vt with 10,000 lines or 10 MB of scrollback; `vt100` and `vte` removed | `crates/perchd/src/screen.rs` | `b8644f3f`, `647c2a5`, `395b770`, `2b3380d`, `e0208f0a` |
| Repaint keeps skipped cells unpainted and colour-erased cells coloured | `crates/perchd/src/screen.rs` | `33aa9006`, `54a37409` |
| Daemon survives an engine that cannot allocate; grid capped at 1000 x 1000 | `crates/perchd`, `crates/perch-core` | `894ac076`, `60de18bc` |
| Native client: connection, sidebar, tabs, splits, launch, attention, palette, keybindings, terminal settings, remote computers, hand-off | `crates/perch-native/src` | merged at `18461ad8`, then `31bbffdd` to `fef5cfcd` |
| Native terminal: drawing, input, IME, selection, search, links, OSC 52, kitty keyboard and graphics, ownership, reattach, flood protection, uploads | `crates/perch-native/src/terminal` | same range |
| `perch://open` hand-off into the Tauri app (additive) | `crates/perch-desktop/src/open_url.rs`, `packages/web/src/openRequest.ts` | in `18461ad8` |
| xterm.js checks of the repaint and of the native terminal, cell by cell | `packages/web/src/terminalRepaint.test.ts`, `terminalVtParity.test.ts` | `a95ec75a` |
| Test mode and the memory measuring script | `crates/perch-native/src/test_mode.rs`, `scripts/measure-native-memory.sh` | `c6391093` |
| Review fixes in the native client | `crates/perch-native` | `da3dd77b`, `6f5e5c73`, `918b7f50`, `2a1df8d2`, `997844a1`, `9e26e8dd` |
| Docs and licence notices | `docs/DECISIONS.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `TESTING.md`, `THIRD_PARTY_NOTICES.md` | `6d0eccab`, `03428280` |
| Editor spike (not merged) | branch `spike/native-editor` `0a5f60e`, `editor-spike-findings.md` | |

The protocol files (`protocol.rs`, `packages/shared`) have no diff. Changes under `packages/web/src` are additions
only.

## Done-means, with evidence

| # | Item | Result |
|---|---|---|
| 1 | `ghostty-sys`, pinned Ghostty and Zig, `vt100` gone, clear Zig error | Met. No `vt100` in any manifest or lockfile. The pin needs Zig 0.16.x. |
| 2 | Daemon scrollback and repaint tests (old alternate-screen TUI, scrollback beyond a screen, mouse and paste modes) | Met. `cargo test -p perchd`: 83 unit tests plus five suites pass; the three named cases are `a_tui_attached_long_after_it_painted_repaints_exactly`, `scrollback_beyond_one_screen_survives_restore`, `mouse_and_paste_modes_survive_reattach`, and xterm.js replays the same bytes in `terminalRepaint.test.ts`. |
| 3 | No protocol change | Met. No diff in either protocol file. |
| 4 | `crates/perch-native`, out of default builds, daily set and hand-off | Met by headless tests. The hand-off was never run end to end against the real Tauri app. |
| 5 | Headless tests for attach, type, resize, scroll, select, search, copy | Met. `cargo test -p perch-native`: 166 unit tests, 6 test-mode tests, 2 fixture tests and seven headless binaries pass. |
| 6 | Parity checklist fully statused | Met: 306 rows, 245 tested, 18 checked manually, 11 not applicable, 32 proposed deferrals (below). |
| 7 | Feature inventory, nothing removed from Tauri, web or phone | Met. `feature-inventory.md`; web changes are additive. |
| 8 | Editor spike | Met. `gpui-component =0.7.2` draws a highlighted file headlessly and opens a 50,000-line file in 93 ms; typed input and IME are unverified. |
| 9 | Memory table, target 100 MB lower with one terminal | Met against an estimate, not a direct measurement (below). |
| 10 | Checks | Met except `npm run build` (below). |
| 11 | Docs and this report | Met. |
| 12 | Local commits only, nothing left behind | Met. See Cleanup. |

## Memory (MB, median of 5 samples after 20 s)

| State | Tauri measured | Tauri estimated | Native shown | Native plus its core |
|---|---|---|---|---|
| Idle | 146.5 | 146.5 | 41.9 | 56.1 |
| One terminal | not reachable | 231.4 | 44.0 | 58.2 |
| Four terminals | not reachable | 264.6 | 44.2 | 58.4 |
| One busy TUI | not reachable | 466.4 | 43.8 | 58.0 |

- The real Tauri app could only be measured idle: its test window is hidden and choosing a terminal needs an input
  event, which the rules forbid. The other three Tauri figures are the idle figure plus what the same page costs in
  headless WebKit.
- Tauri idle alone is 102 MB above native with one terminal, or 88 MB if the native client's separate core is
  counted.
- The Mac was locked with its display asleep for the whole measurement, so the native client's cost while really
  drawing is not measured. Its figures are a floor.
- Binary sizes: `perch-native` 21.4 MB, `perch-desktop` 33.9 MB, `perch-core` 24.1 MB.
- Full method, commands and limits: `plans/261112-0025-native-gpui-ghostty-terminal/proof-memory-and-correctness.md`.

## Terminal correctness against xterm.js

Seven stress streams are compared cell by cell, fed both the raw stream and the daemon's repaint. The grids agree
except for these pinned differences:
- A flag (two regional indicators) is four cells in Ghostty and two in xterm.js, so the rest of that row shifts.
- A keycap sequence loses U+FE0F in Ghostty's cell text.
- Hidden text is blank in Ghostty and kept invisible by xterm.js; the native cell has no blink or overline.
- Kitty images show only in the native client and do not survive a reattach.

Two repaint defects found by this comparison were fixed in the run (painted gaps, lost coloured erases).

## Commands and results (merged tree)

| Command | Result |
|---|---|
| `cargo test -p perch-core` | 922 passed, 1 ignored |
| `cargo test -p perchd` | 83 unit, then 7, 7, 8, 1, 1 passed |
| `cargo test -p perch-native --no-fail-fast` | 166 unit (1 ignored measurement), 6, 2, and seven headless binaries passed |
| `cargo test -p perch-desktop` | 18 passed |
| `npm test` | 153 files, 1,346 tests passed |
| `npm run build` | **Fails** at `tsc`: `packages/web/src/perch-sdk.d.ts` is syntactically broken on base `60dd2c7` (`TS1005` at lines 2421 and 2438). `vite build` passes. The owner's uncommitted change on `main` appears to fix it; it was not copied. |
| `cargo fmt --check` | clean |
| `cargo clippy --workspace --all-targets` | two warnings, both in files this branch did not touch (`perch-core/src/db/mod.rs:1519`, `perch-desktop/src/browser.rs:309`) |

Every cargo command ran with `ZIG` pointing at a scratch Zig 0.16.0. Run the cargo tests per package: building
`perch-core` together with GPUI or Tauri turns on `serde_json`'s `preserve_order` and fails three order-sensitive
core tests, which already happens with Tauri on the base commit.

## Proposed deferrals (need the owner's approval)

Each row has its evidence in `terminal-parity-checklist.md`.

- **Owner choices:** A-20 and A-21 (grapheme clustering on from the start; built, then reverted because the web and
  phone repaint drifted from the daemon's screen), A-41 (spare height at the bottom or centred), A-112 (a click
  also sends the size), A-201 (attach hidden panes at a guessed size after 100 ms), A-222 (ship readline-style key
  defaults), A-220 and B-70 (pins).
- **No setting exists in the core yet:** A-33, A-227 (line height), A-35, A-36, A-226 (ligatures), A-106, A-231
  (scroll speed), A-219 (right-click target), A-225 (a font size of its own).
- **GPUI 0.3.8 cannot do it:** A-31 (font tables for cell metrics), A-67, A-68, A-232, B-28 (which Option key is
  down, so Left and Right act as Auto).
- **Depends on what is still Tauri-only:** B-33 (navigation history), B-51 (browser pane for a plain click), B-69
  (Files and Git scope), A-214 (settled tabs), A-216 (ending sub-agents is the core's), A-215 (three commands not
  registered).
- **Other:** A-88 (screenshot thumbnail staging cannot be exercised headlessly), A-90 (a clipboard image is refused
  in a remote terminal, as on the web), A-168 (rejoining links a program broke across lines), B-39 (wheel burst
  conversion for TUIs).

## Decisions made on the owner's behalf

- Ghostty is pinned at herdr's commit `291fd05`, which needs **Zig 0.16.x**; Zig 0.17.1 fails. Install it with
  `brew install zig@0.16` or set `ZIG=`.
- `gpui-pre =0.3.8`: later releases need an unstable Rust feature on the toolchain in use.
- Kitty graphics are off on daemon screens, so images do not survive a reattach.
- An attach repaint is bounded at 4 MiB and drops the oldest scrollback first; the core no longer also sends the
  tail when a repaint exists.
- Grapheme clustering stays on request only (see A-20).
- A Symbols Nerd Font (2.5 MB) is bundled for powerline glyphs, and copy-on-select is on by default in the native
  client. Say if either should change.
- Closing a plain terminal's tab ends that shell after the core confirms; closing an agent's tab only puts it away.
  A session with no recorded launch provider is never attached or ended by the native client.
- Terminal links open only `http`, `https` and `mailto`, and plain non-executable files, matching the Tauri app's
  stance.

## Review

An isolated reviewer read `60dd2c7..HEAD` cold. It found the protocol unchanged and the `perch://open` handler,
token handling and web changes clean, and three must-fix defects, all fixed: the native client attached and closed
by the observed provider instead of the launch provider (could start a second agent or end an agent's session);
terminal links ran `open` on any scheme or path; and an engine allocation failure panicked the daemon while it held
its session lock. Also fixed: unbounded PNG decode, sounds in test mode, tab-close bookkeeping, a confirm step
before stopping a terminal from the pane menu, upload length and address checks, and a doubled size marker.

A second isolated reviewer then read only the fixes and confirmed all eight in the code with no must-fix left. Two
of its low follow-ups were applied (`fix(core)` resize bounds, the pane menu closing when the active pane
changes). Left open: the link file-kind check is a denylist (`.jar`, `.webloc` and similar are not on it; an
allowlist or reveal-only would be sturdier, and `mailto:` queries are passed through), and a screen that cannot be
built is logged by the daemon but not by the core.

## Remaining risks and follow-ups

- **No person has used the native client.** Drawing cost on a lit screen, IME, focus behaviour and the hand-off end
  to end are unverified. Whether macOS activates the unbundled test-mode process could not be decided from source;
  under the lock screen the frontmost-app log proves little.
- **Repaint under the session lock.** A full repaint takes 17 to 28 ms in a release build while the session lock is
  held. Moving it out safely needs per-subscriber buffering; left as is.
- **A daemon test hung once.** `cargo test -p perchd --test daemon` stalled with three tests and their scratch
  daemons blocked in read during connect. It did not recur in six later runs, and the connect code is unchanged by
  this branch. Unexplained.
- **Untested:** the release workflow with Zig (`.github/workflows/release.yml` was edited but never run), the musl
  static link of `perchd`, Linux and Windows builds of the native client, a real remote file drop, and real alert
  sounds.
- **Not built in the native client:** layout restore, tab drag and tab menu, closed-tab history, keybinding help, a
  launch on another computer opening automatically (the hub's `session.created` names no request).
- **Licences:** full third-party licence texts for the GPUI dependency tree are not generated.
  `packages/web/src/clipboardImagePaste.ts` (from herdr) and `terminalTuiWheel.ts` (from Orca) predate this run
  and may need attribution.
- **Seen on the machine, not from this run:** 390 `dev.hwii.perch.perchd.*` launchd jobs, and a flaky
  `chat.composer.test.tsx`.
- **Side effect on the main checkout:** `.git/config` gained `submodule.third_party/ghostty.*` entries when the
  submodule was initialised in a worktree.
- The editor spike's dependency (`gpui-component`) pins GPUI tightly: only 0.7.1 and 0.7.2 match `gpui-pre 0.3.8`.

## Cleanup

- Processes: every core, scratch daemon and app the run started was stopped and checked by PID. The only Perch
  processes left are the owner's (the installed app, its daemon PID 7310 and its sessions). The keep-awake
  (`caffeinate`) is stopped. No launchd job was added.
- Worktrees removed: `perch-native-sidebar`, `perch-native-client`, `perch-native-editor-spike`. Kept:
  `/Users/hwiii/Github/perch-native-gpui` on `feat/native-gpui-ghostty` (its `target` was deleted, 38 GB; its
  `node_modules` and web build output remain).
- Branches: the seven merged working branches were deleted. Kept: `feat/native-gpui-ghostty` and
  `spike/native-editor`.
- Scratch (8.6 GB, including the scratch Zig 0.16.0) was emptied. To build the branch, install Zig 0.16.x and run
  `git submodule update --init third_party/ghostty` in the worktree.
- Also left: the reference clone `~/Github/perch-refs/herdr-app`, and `~/.claude/.ckignore` (created with the
  owner's approval so the hooks allow `vendor` and `target`).

## Unresolved questions

1. Do you approve the 32 proposed deferrals, and what do you choose for the owner-choice rows?
2. Should grapheme clustering be on from the start once the web clients can cluster too, or stay on request?
3. Keep or drop the bundled Symbols Nerd Font and the copy-on-select default?
4. Should `perch-sdk.d.ts` be fixed on this branch, or will your pending change on `main` land first?

Status: DONE_WITH_CONCERNS
Summary: The daemon runs on Ghostty's engine and a tested native GPUI client exists on a local branch, using about 44 MB with one terminal against an estimated 231 MB for Tauri.
Blockers: none. Concerns: no hands-on use yet, Tauri figures beyond idle are estimates, 32 deferrals await approval, and `npm run build` fails on a file already broken at the base commit.

## Follow-up after the owner's review (2026-11-12)

The branch is now at `e10b8b16`, 111 commits over `60dd2c7`. This section replaces what the sections above say
about deferrals, grapheme clustering, tab close, copy-on-select and `npm run build`.

- **Deferrals:** the owner decided every row in `../261112-0025-native-gpui-ghostty-terminal/deferrals.md`.
  22 checklist rows remain deferred, all approved; 254 are tested, 18 manual, 12 not applicable.
- **Built on the owner's decisions:** graphemes cluster from the start (`6b6151dd`); closing a tab ends its
  session, asking first for an agent when the warning is on (`04cb2d3d`); copy on select is a core setting with a
  toggle (`5447a4c8`); a session nobody has launched anything in offers the launch choices (`4265d725`); the grid
  is centred vertically (`a8e9a11e`); workspaces can be pinned (`a2153972`); Command with Left, Right and
  Backspace edit the line (`e1c30f7f`); Option as Alt honours Left and Right (`0c21871a`); the size is taken back
  from a phone for one tab or all (`2fc2b459`).
- **`npm run build` passes:** `perch-sdk.d.ts` was fixed on the branch (`5cd4d20b`) with the brace fix from the
  owner's uncommitted copy on `main`, without its new `createFileAt` line. Expect a small conflict there.
- **Checks on `e10b8b16`:** `perch-core` 923 passed, 1 ignored; `perchd` 84 unit plus 7, 7, 8, 1, 1;
  `perch-native` 180 unit (1 ignored), 6, 2, and seven headless suites ok; `npm test` 153 files, 1,347 tests;
  `npm run build` ok; `cargo fmt --check` clean; clippy shows the same two warnings in untouched files.

Still unverified, in addition to the list above:

- Which Option key is down is read from macOS at key time; the left and right bits with a real key held have not
  been seen, because no keys may be sent. If they prove unreliable, the fallback is a patched GPUI crate.
- The phone-held size condition is tested with injected state; no phone was paired.
- A tab with no live terminal attached (failed, disconnected, or parked beyond 12 hidden tabs) closes without
  ending its session, and says so.
- If the core refuses a launch picked for a blank session, the tab shows Failed and does not offer the list again.
- The phone's browser view runs xterm.js, which does not cluster, so emoji sequences can sit in different cells
  there after a repaint (35 cells in the comparison test). The owner accepted this.

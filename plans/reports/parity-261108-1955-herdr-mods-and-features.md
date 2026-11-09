# Perch vs herdr-app: mods and custom UI, section by section

Source compared: the herdr-app agent guide copy (`agents.md`, 1039 lines), read section by section.
**No running herdr-app was available.** The `herdr` on this machine is the 0.8.0 terminal TUI, a different product. So this is a
comparison against the guide's documented contract, not against the live app.

Verification columns name the check that fails if the behavior breaks. "Window" means seen in a real desktop window.

| Guide section | Perch equivalent | Proof |
|---|---|---|
| Mods in `mods/<id>/main.js`, hot reload, cleanup | same file layout and `(el, api) => cleanup?` signature, rescan reload | `e2e/mods.spec.ts` (mod appears, is replaced, is removed from Settings) |
| The `herdr` module (`api`) | `ModApi` in `modApp.ts`, mirrored by `perch-mod.d.ts` | `modApp.test.ts` API parity test |
| Spaces, tabs, terminals | project/workspace = space, session = tab, pane = tile | `docs/DECISIONS.md` mapping; commands tests below |
| Layouts: tree, blocks, stacks, dividers, floats, pane frames, looks, themes, gradient/image backgrounds | `layouts/<name>.json` with the same node kinds and cascading look | `mods.spec.ts` (stack, divider, theme file, draggable boundary; floating block drag and spring) |
| Layouts other people made: clone, switch | `layout.clone`, `mod.clone`, `layout.switch`, `perch mod clone` | `perch-core` mods tests |
| `layout.set` | rewrites the shown layout's file, hot reloads | `mods.spec.ts` overlay + layout.set test |
| Traffic-light position | `trafficLights` root key, `set_traffic_lights` command | Window: native chrome screenshot; `window_chrome_probe` |
| Keys: `keys.json`, `key.bind` | same file, global and scoped bindings, `send:` text | `mods.spec.ts` keys.json test; Window: real key press fired a binding and typed into a terminal |
| Commands (tab, pane, terminal, agent, layout, app, overlay) | `TYPED_COMMANDS` in `modCommands.ts` | `mods.spec.ts` herdr commands test; `modCommands.test.ts` |
| `tab.new {argv, task}` | runs through the core's `workspace.run`, shows the terminal | `mods.spec.ts` (output `ARGV_42` read back) |
| `space.new {argv}` | `project.new {folder, name?, argv?, task?}`: adds the project, runs the program in it once added; a failed or timed-out add is an error toast | `mods.spec.ts` project.new test (program ran with cwd = the new folder; this caught a bug where it ran in the old project); `modCommands.test.ts` (waits, runs once, error path) |
| `terminal.kill`, `scroll`, `copy`, `paste`, `pane.close`, `pane.focus`, `tab.select|rename|move`, `agent.next|prev|focus` | ported with the same names | `mods.spec.ts` herdr commands test; `xtermSetup.test.ts` |
| `terminal.pin` | `terminal.pin {terminal?, pinned?}`, kept on this device, reported as `pinned` by `agents()` and `terminals()`; Perch's own views do not order by it | `pinnedTerminals.test.ts`; `mods.spec.ts` |
| `terminal.show`, `peek`, `keep` | all show the session (perchd keeps every terminal running) | `modCommands.test.ts`; `mods.spec.ts` |
| `terminal.park` | not ported: nothing is ever hidden | n/a |
| settings.json: minimum contrast, clipboard write (OSC 52), pane scrollbars | `minimumContrast`, `clipboardWrite`, `paneScrollbars`, live in open terminals | `settings.rs` test; `xtermSetup.test.ts` |
| `option_as_alt` auto/on/off/left/right | all five values; left/right send ESC plus the base character of the physical key for that Option key only | `xtermSetup.test.ts`, `settings.rs` test. Dead keys (Option+E, I, N, U) are caught before the composition check and cancelled; **not checked in a real window** (the keydown cancel is the WebKit behavior relied on) |
| Sounds (done, blocked) | `soundDone`, `soundBlocked` files under the config folder, tone fallback | `sound.test.ts`, `mods.rs` serving tests |
| `programs.json` and built-in program table, icons, "<Program> finished" toast | `programs.ts` (about 121 programs), icon route | `mods.rs` icon test; `programs` unit tests |
| `hc exec --on <machine>` | `perch exec --on <host> -- cmd` over the agent token (`POST /agent/exec`), host-only | `perch-core` mods route test (refusals, and a happy path through a stand-in `ssh`: output, stderr, exit code 3, cwd), `agent_cli` parse test; not run over real ssh to another computer |
| `hc` (herdr-core CLI): ls, read, send, run, wait, kill | `perch daemon ls\|read\|send\|run\|wait\|kill`, plus `api.perch(...)` from a mod | `crates/perchd/tests/terminal_cli.rs`; `mods.spec.ts` hc test |
| Ask the agent to change the app ("add a todo list") | `perch guide`, `perch mod api/examples/open/check`, layouts | `e2e/agent-mods.spec.ts`: a real haiku agent wrote the mod, the page drew it and adding an item worked (screenshot kept in the run's artifacts) |
| Seeing the window: screenshot | `api.screenshot`, native WKWebView snapshot | `mods.spec.ts` screenshot test; Window: snapshot |

## Compared against herdr-app's source (herdrdev/herdr-app at b721ded)

Replaces "no running herdr-app": the source's own lists were compared name by name with Perch's.

- **Commands** (`docs/commands.md`, 71 actions): 50 exist in Perch under the same name (counting the ones added in this pass), and 6 more map onto Perch's model, since a herdr space is a
  Perch project: `space.new|rename|select|next|prev|close` are `project.new|rename|select|next|prev|close` (the last needs
  `{confirmed: true}`). `terminal.keep|peek|show` show the session, `terminal.open {place}` starts a terminal, and
  `terminal.search` is the `terminal.find` key. Added in this pass: `project.select|next|prev|close` and `terminal.open`.
  Not ported: `space.move` (Perch's project order is the sidebar's drag, owned by the core), `tab.settle|unsettle`
  (no settled-tab state), `terminal.park`, `terminal.paste_image`, `terminal.right_click`, and the OS and update family
  (`app.check_updates|update|update_core|whats_new|feedback|reset|welcome|hide|hide_others|show_all|quit`).
- **Mod API** (`defaults/herdr.d.ts`, 44 exports): 28 had a same-named Perch member. Added in this pass:
  `themes()` and `setAgentOrder(ids)` (which `agent.next|prev` follow). `spaces` is `projects()`/`workspaces()`, `hc` is
  `api.perch(...)`, `openOverlay|closeOverlay` are `overlay()|popup()|window()` (each returns its close function) and
  `mod.open`. Not ported: `fonts()` (a web view cannot list installed fonts), opening a layout with terminal blocks as an
  overlay, and `updates`, `telemetry`, `feedback*`, `presentUpdateNotes`.
- **Settings** (`src/settings.rs`): `minimum_contrast`, `clipboard_write`, `pane_scrollbars`, `option_as_alt`, `sounds`,
  `theme`, `zoom`, and (added in this pass) `terminal_opacity` and `terminal_padding` exist. Not ported: `font*`, `ui_font*`, `font_ligatures`,
  `appearance`, `telemetry` (fonts stay with the server terminal profile by an earlier decision; ligatures are out of scope).
- **Shipped defaults** (`defaults/`): herdr ships 21 mods, 3 layouts and 2 themes as its own UI. Perch ships 3 example mods and 2
  example JSON files (`ide`, `midnight`); its stock UI is React, not mods, so the 21 mods are herdr's own chrome and are not ported.
  Compared in this pass: the two themes. `atom-one-dark.json` already loaded; `win98.json` was refused (its `colors` use herdr's names), and now loads
  with those names mapped onto Perch's tokens. The three layouts are a different file shape (`content: {mod}`, `font_size`, `traffic_lights`, `padding: [x, y]`),
  and Perch's own layout format and `ide`/`midnight` examples cover the same ground, so they are not converted.

## Deliberately not ported

- **Label adoption of daemon terminals.** The core keeps the bookkeeping of what it started; a terminal `perch daemon run` makes
  stays out of the UI, as herdr's unlabeled ones do.
- **Font ligatures.** Needs an xterm addon Perch does not ship.
- **Telemetry.** Perch sends none, so there is nothing to turn off.
- **Updater, feedback, `app.reset`.** Perch has no updater service or feedback form; a reset is deleting the folder.
- **`terminal.park`.** See above.

## Final run

- Web: 1151 tests pass, `tsc` clean. Mods e2e: 11 of 11 pass.
- `perchd`: all pass (35 unit, 7 integration). `protocol_parity` passes. Clippy: no warning in the files this slice touched.
- `perch-core`: 849 of 850 pass. The failure is `native_ui::codex::tests::the_launcher_gives_each_child_only_its_own_arguments`
  in `native_ui/codex.rs`, which has uncommitted changes of yours and which this slice does not touch.
- `cargo fmt --check` is clean (one stale diff in `perch-desktop/src/main.rs` from an earlier slice was formatted).

## Unresolved questions

- Do you want the Option left/right dead-key case checked in a real window? I stopped the windowed probe because it required
  bringing my test window to the front.

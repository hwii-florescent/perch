# Brief: audit of every shortcut and window behaviour, web against native (read-only)

Asked by the owner 2026-11-15. **Read-only**: change no code, build nothing that writes outside a scratch target dir,
commit nothing. Read in `/Users/hwiii/Github/perch-wt/native-mods` (`feat/native-mods`, `cb0d5e14`). A settings port
runs in parallel; the fixes from this audit are done after it merges. Rules otherwise as `agent-rules.md` here.

## What to compare

1. Every command and shortcut in `packages/web/src/keybinds.ts` (55 `shortcut(...)` entries, plus leader and resize
   modes, Settings-derived bindings, `nativeShortcutBindings.fixture.json`, menu keys in the Tauri app) and every
   command `runCommand` accepts (`modApp.ts`), against the native client (`crates/perch-native/src/keymap.rs`,
   `actions.rs`, `workspace.rs` `run_command`). For each: the web's behaviour, the native's, and a verdict
   (same / different / missing / refused), with file:line on both sides.
2. These owner reports, each with the cause found in the code:
   - The Quickchat section does not appear in the sidebar until its first session exists (the web shows it before).
   - Cmd+Shift+T (launcher), Cmd+T and the tab strip's "+" offer agents only: no Terminal, New browser, New file as
     the web's menus do (`stock-ui/tabs/main.tsx` extras, `NewSessionPopover.tsx`, `stock-ui/launcher`). Find what the
     native passes or drops.
   - Switching workspace by shortcut does not work.
   - A tab can be dragged only when it is the focused tab.
   - Dropping a tab on a pane's side to split is not implemented.
   - After the last tab closes, keyboard focus stays on the closed terminal.
   - The start page's "Quickchat" heading clips its last letter.
3. Mouse behaviour the web has that the native lacks (drag, drop, context menus, double-click rename, middle-click
   close, wheel on tabs), found by reading the stock screens' handlers.

## Output

`plans/261113-0037-native-terminal-fixes-and-mod-engine/shortcut-audit.md` in the owner's checkout (that file only):
a table per area, then the owner's reports with causes, then a ranked fix list (what, where, size), marking which
items depend on Settings. Then `perch report` with the path and the counts (same / different / missing).

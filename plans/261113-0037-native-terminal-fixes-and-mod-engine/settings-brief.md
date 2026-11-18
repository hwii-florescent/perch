# Brief: Settings in the native client, as the Tauri app's

Asked by the owner 2026-11-15. Settings come first because the shortcuts (and other behaviour) are loaded from them.
Rules: `agent-rules.md` in this folder. Worktree `/Users/hwiii/Github/perch-wt/settings`, branch `nm/settings`, made
from `feat/native-mods` at `cb0d5e14`. Do not change `packages/web/src` unless a page cannot run otherwise; say why in
the commit and the report.

## Today

- The native client has only a Rust terminal-settings panel (`workspace.rs`, `"global.settings"` toggles
  `SettingsPanel`, drawn by `settings_view`). The sidebar's gear opens that.
- The web's Settings: the window/shell around the pages, then the pages as stock screens `stock-ui/settings-*`
  (general, appearance, terminal, keyboard, notifications, permissions, devices, hosts, agents) routed in
  `packages/web/src/components/settingsRoutes.tsx` (props built there; Agents, Keyboard and Permissions from
  `AgentCatalog.tsx`, `KeybindingsSection.tsx`, `MacPermissions.tsx`; Mods is `ModsSection.tsx`, the recovery page,
  not a stock screen). Find the shell that lists the pages and what opens it (Cmd+, and the gear).

## Outcome

- The gear and Cmd+, open Settings looking and behaving as the Tauri app's: the same shell, page list and order,
  every page above as a stock-screen mod with the same props the web builds, saving through the same core messages.
  The settings a page changes take effect in the native window (theme and appearance, terminal profile, keyboard
  bindings incl. leader/resize, notifications, agents list, hosts, devices/pairing).
- Keyboard: the bindings the person sets in Settings > Keyboard drive the native keymap (`keymap.rs`), the same
  registry and conflict rules as `packages/web/src/keybinds.ts`.
- What the native client cannot do on a page (for example a macOS permission only the Tauri app holds, or Mods)
  shows the web's own wording or a hand-off "Open in Perch", never a dead control.
- The Rust `SettingsPanel` is removed once the Terminal page replaces it.
- Web reference states for each page (the `e2e/native-parity` tooling) with the gate passing for them; differences
  listed with causes as before (two fix rounds per screen, then listed as not done).

## Done means

- `cargo test -p perch-native` (alone), `npm test`, `npm run test:mods-runtime`, `cargo fmt --check`, clippy with no
  new warnings, gate not worse than 314 of 336 plus the new settings states.
- A test that changing a key binding in the Keyboard page changes what the native window does for that key.
- Side-by-sides for each page in `plans/261113-0037-native-terminal-fixes-and-mod-engine/settings/` in the owner's
  checkout (that folder only).
- Local conventional commits on `nm/settings`, merged into `feat/native-mods` in
  `/Users/hwiii/Github/perch-wt/native-mods` (fast-forward or merge commit, no rebase). Another session is only reading
  the code at the same time; nothing else is merging.
- Final `perch report`: pages done and not done, causes, image paths, checks.

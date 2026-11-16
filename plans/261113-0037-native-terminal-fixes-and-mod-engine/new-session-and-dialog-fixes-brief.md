# Brief: Cmd+T, the legacy New session picker, the launcher's wrapped names and the Add project dialog

Asked by the owner 2026-11-15 after using the `feat/native-mods` build (with the window shell, `cad60d78`). Rules:
`agent-rules.md` in this folder. Work in worktree `/Users/hwiii/Github/perch-wt/session-fixes`, branch
`nm/session-fixes` (made from `feat/native-mods`). Do not change `packages/web/src` unless a fix below says so.

## 1. Cmd+T opens the legacy unscoped picker at the window's top-left

Seen: on the start page (no tab open) Cmd+T opens a popup at (0,0), under the traffic lights: an agent select,
"Manage agents...", then the projects and "No project / Quickchat". The owner: this layout is legacy and the Tauri app
never shows it.

Cause: `workspace.rs`, the `"tabs.new" | "tab.new"` command asks the tab strip only when
`self.tabs.visible().is_some()`; with no tab it falls back to the sidebar's `sessions.new`, whose observer
(`cx.observe(&sidebar, ...)` near the top of `Workspace::new`) opens the `new-session` screen with `projectCwds` and
anchor (0,0). That `projects` form of `NewSessionMenu` (`packages/web/src/sdk.ts`) is used by nothing in the web.

Web behaviour to match: Cmd+T always does what the strip's "+" does (`stock-ui/tabs/main.tsx`,
`useNewTabRequest`): `NewSessionMenu` anchored at the "+" button (`data-testid="tab-new"`), scoped to the shown
workspace's `cwd` (`~` with none), with the New browser / New file extras when there is a workspace. The window shell
now draws the strip on the start page too, so ask the strip whenever the `tabs` mod is drawn.

Fix: Cmd+T always goes to the strip when it is drawn. Remove the path that opens the unscoped `new-session` screen
from the sidebar observer: a New session asked from the sidebar opens the launcher (as Cmd+Shift+T does), and
Quickchat (`nests.scratchpad`) starts as the web's `newScratchpad()` does. A floating screen must never open at
(0,0) as a fallback anchor. Delete the native code that only served the unscoped picker. Test: Cmd+T on the start
page and with a tab open both open the strip's menu at the "+"; nothing opens the unscoped picker.

## 2. The launcher (Cmd+Shift+T, the sidebar's New session) wraps a project name

Seen: in "New session in...", the row "perch /Users/hwiii/Github/perch 1" draws the name as "perc" over "h".
Compare `stock-ui/launcher/main.tsx`: the name and path share a row; the web keeps the name on one line and
truncates the path. Find why the native layout gives the name less width than its text (likely the text-width
rounding in `vendor/gpui-pre/src/elements/text.rs:772` together with how the Tailwind translator handles
`truncate`/`min-w-0`/`shrink` in a flex row) and fix it in the translator or the engine, not in the stock source.
Check every other row-with-truncation screen for the same fault (sidebar rows, tab titles, folder browser).
Add a web reference state with a long path for the launcher and make it pass.

## 3. Add project dialog scrolls as a whole

Seen: in "Add project" (folder browser with a name field), scrolling moves the title, the name field and the path
row together with the folder list. The web keeps the head fixed and scrolls only the folder list (read the
folder-browser and its dialog in `packages/web/src/stock-ui/folder-browser/` and the Add project dialog that hosts
it). Fix the native layout (likely `overflow-y-auto` with `min-h-0`/`flex-1` inside a height-limited modal in the
translator) so only the list scrolls. Add a web reference state with more folders than fit and make it pass.

## Done means

- The tests above, plus `cargo test -p perch-native` (alone), `npm test`, `npm run test:mods-runtime`,
  `cargo fmt --check`, clippy with no new warnings, the gate not worse than 310 of 332 (list any state that changes).
- Side-by-sides of the launcher with a long path, the Add project dialog scrolled, and Cmd+T on the start page in
  `plans/261113-0037-native-terminal-fixes-and-mod-engine/session-fixes/` in the owner's checkout (that folder only).
- Local conventional commits on `nm/session-fixes`, merged into `feat/native-mods` in
  `/Users/hwiii/Github/perch-wt/native-mods` (fast-forward or merge commit, no rebase).
- Final `perch report`: what changed, causes found, image paths, check results, anything not done.

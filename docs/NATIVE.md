# Native client (`crates/perch-native`)

The macOS GPUI client: another view of the same `perch-core` as the Tauri app, aiming to look and
behave the same. Agents: start with [`crates/perch-native/AGENTS.md`](../crates/perch-native/AGENTS.md)
(module map, hard rules, test commands). This file holds the behaviour contracts that cross modules.

## How a screen is drawn

- **Rust views:** the window frame (`shell.rs`), terminals (`terminal/`), and the engines under stock
  screens: file browser and editor (`files/`, `editor/`), diff list (`diff/`), Git store (`git/`), browser
  panes (`browser/`, WebKit).
- **Stock screens:** sidebar, tab strip, tab-drag ghost, pane header, status bar, Files, Git/review,
  settings, dialogs, palette and so on are the web's `packages/web/src/stock-ui/<id>/`, exported by
  `npm run build` into `crates/perch-native/mods/<id>/` and run on QuickJS through our React runtime
  (`mods/react-runtime`, `mods-runtime/react`: a DOM shim, a CSS cascade, and `describe` → `gpui.mjs`, which
  builds gpui-kit elements). Same source as the web, so a fix there fixes both.
- **Data:** a screen reads `@perch/sdk`. Natively that is `src/mods/perch.rs`, split into **parts** (`store`,
  `view`, `window`, `sidebar`, `workspaces`, ...). A screen re-renders only when a part it read moves. Put
  fast-changing data (pointer, drag geometry) in its own part, or the whole window re-renders.
- **User mods:** `<data dir>/native-mods/<id>/` replaces the stock screen of that id (hot reload).
  `docs/MOD-SDK.md` is the API.
- **GPUI:** pinned at `gpui-pre =0.3.13` (the release that publishes `gpui-pre-ios`) in perch-native and
  vendored gpui-kit, with `vendor/gpui-pre*` patched where marked `PERCH:` (herdr's API gpui-shell names,
  the idle display-link pause on macOS 12/13, `PERCH_NATIVE_PERF` frame logs); see `THIRD_PARTY_NOTICES.md`.
  Moving the pin moves every `gpui-pre-*` crate and `Cargo.lock` together.

## Performance budgets

| Budget | Value | Where |
| --- | --- | --- |
| Script `render()` call | 50 ms, then cut off (last good render stays, error banner) | `vendor/gpui-kit/crates/shell/src/engine/quickjs/sandbox.rs` `Budgets` |
| Script event handler or task | 500 ms | same |
| Module load | 5 s | same |
| Terminal parse turn | 6 ms live, 250 ms replay | `terminal/view.rs` |
| Product targets | mounted tab switch p95 ≤ 50 ms, restore inactive view p95 ≤ 150 ms | `PRODUCT-STRATEGY.md` |

QuickJS has no JIT. Hover, drag following and scrolling run in Rust with zero script renders
(`tests/mods_responsive.rs`). During a tab drag no screen other than the strip and its ghost
re-renders; their script stays under 4 ms a move with 20 tabs (`tests/tab_order_window.rs`, release). Measure hot paths with `tests/screen_engine_measure.rs`.

## Workspaces and tabs

- **A workspace's strip** shows every session the core lists for that workspace (agents and plain
  terminals, in the core's order with the person's drag order on top), plus this device's file,
  review and browser tabs of that workspace. Parity source: the web's `workspaceTabs.ts`,
  `store/selectors.ts` `activeWorkspaceSessions`, `tabOrder.ts`, `splitSets.ts`. Opening any session
  shows its workspace's strip, with that session active.
- **Shared tabs:** a workspace's strip and splits are the core's (`workspace.tabs`): each change is
  written back, and a change from another device is merged in (`tabs::merge`, as the web's
  `sharedTabs.ts`). Sessions closed here without ending stay out of this window's strip only.
- **Per viewer:** the active tab, zoom, previews, drawer tab and widths are this window's. The
  order the sidebar shows (`workspace.order`) is the core's and is changed only by a person's reorder
  (`workspace.order.set`, the whole list from the latest core order).
- **Closing:** closing a session tab ends the session (as the web's `closeGuard.ts`); a tab only
  watching another view's session just closes, and stays closed after a relaunch.
- **Drawer (Files, Git, Browser):** follows the focused tab. For a local terminal whose current
  directory differs from its workspace's path, Files and Git show that directory through a
  `term:<session>:<b64url dir>` scope (web `terminalScope.ts`; the core verifies it and keeps a
  grant). A file tab opened there belongs to the owning workspace's strip and outlives the terminal.

## Kept on this device

All under the native mods folder (`mods::user_dir()`, beside the core's database). A missing or broken
file gives defaults.

| File | Holds |
| --- | --- |
| `.window.json` | drawer tab, column widths, per-workspace strips (a cache of the core's shared tabs, for a relaunch and offline): non-session tabs and their order, split sets, active tab, tabs closed without ending |
| `.browser.json` | browser pages (URL, title, icon) and the drawer's page |
| `.sidebar.json` | sidebar view settings: organize, sort by attention (off by default), show terminals, folded rows |
| `keys.json` | chosen keys (`keymap.rs`) |

## The installed app

Since 2026-11-18 the native client is `/Applications/perch.app` (owner), built by
`scripts/reinstall-desktop-native.sh`: the window, `perch-core`, the `perch` CLI and the web build in one
bundle with the Tauri app's identifier and signing identity (grants are kept). The window starts the
bundled core when `core.json` names none that is running, on port 47788; the core outlives the window
and serves the phone and terminals. Replaced bundles are kept in `~/.perch/replaced-apps/`.
`scripts/reinstall-desktop.sh` still builds the Tauri app.

Rebuild: `ZIG=/opt/homebrew/opt/zig@0.16/bin/zig sh scripts/reinstall-desktop-native.sh`, from a checkout
that has the gitignored `crates/perch-desktop/tauri.macos.conf.json` (the signing identity; copy it into a
worktree). It builds web, native, `perch-core` and the `perch` CLI, keeps the app's signature, opens the app
with `open -g` (no focus), and restarts the core so it serves the new web build.

## Not yet the same as the Tauri app

- No agent Chat view (agents show as terminals), no permissions page.
- `perch://open?place=<files|changes|browser|chat|settings>[&session=<id>]` is handled here: `Info.plist` declares the
  scheme, the app queues links from the system, and `Workspace::open_link` (`workspace/links.rs`) shows the place
  (session tab; files = the drawer's Files; changes = the review tab; browser = a blank browser tab; settings). The
  grammar is the Tauri receiver's (`handoff::parse_link`). It only navigates. A link whose session the core has not
  listed yet (the window is starting) waits up to 30 s, the latest replacing an older one; a link that is malformed,
  not ours, or names no session is ignored with a log line. Without a session, files/changes/browser use the shown
  workspace (the browser, else the computer's first).
- The install script does not deploy the relay (the phone's web app); the mobile plan covers it.
- Remaining differences and visual gate failures: `plans/261113-0037-native-terminal-fixes-and-mod-engine/next-steps.md`
  and `node e2e/native-parity/compare.mjs`.

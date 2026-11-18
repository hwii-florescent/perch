# Brief: the native window shell as the Tauri app's, and the empty-project block

Asked by the owner 2026-11-15 after using the `feat/native-mods` build by hand. Rules: `agent-rules.md` in this folder
(worktree only, isolation, no focus stealing, local commits without AI references, never push). Work in worktree
`/Users/hwiii/Github/perch-wt/window-shell`, branch `nm/window-shell` (made from `feat/native-mods` at `29935133`).

## What the owner saw

- The native window has the system's grey title bar, and the sidebar, main area and status are drawn flat on one
  background. The stock sidebar's "New session" row looks overlaid on the header in a different colour.
- The Tauri app (the bar): a dark **backdrop**, and each part (left sidebar, main, right drawer) is its own
  **rounded card** in a lighter colour, with 8 px gutters. The traffic lights sit inside the sidebar card's 44 px
  head. The status bar runs along the bottom on the backdrop.
- The native window has **no right sidebar** (Files | Git | Browser drawer).
- The empty sidebar block ("+ Add a project / A project keeps... / Register folder") looks outdated, in Tauri as
  well.

## Cause

The web draws its window with `packages/web/src/components/StockWindow.tsx` (the parts `window:sidebar`,
`window:main` and `window:drawer` of `stock-ui/layouts/main.json`). The native client composes its window in Rust
(`crates/perch-native/src/workspace.rs`, `impl Render for Workspace`, near the end) with no cards, no backdrop, no
toggles and no drawer, and `main.rs` opens a window with the default title bar. The gate compares screens, never
the whole window, so it did not catch this.

## Outcome

1. **Shell as `StockWindow.tsx`, read it first and match it exactly:**
   - Window opened with a transparent title bar (`TitlebarOptions { appears_transparent: true,
     traffic_light_position: ... }`, supported by the vendored `gpui-pre`/`gpui-pre-macos`). Lights placed as the
     Tauri app places them (`crates/perch-desktop/src/glass.rs`: `TITLE_ROW` 44, `LIGHTS_LEFT` 22, `CARD_TOP` 8):
     centred in the sidebar card's 44 px head.
   - Root fills with the theme's `--backdrop` (`backdropFor` in `packages/web/src/themes.ts`; expose it with the
     other theme tokens if the native theme lacks it). Cards: `rounded-[12px]`, `--card-bg` (= panel bg), `GUTTER`
     8 px around and between cards. Status bar below the cards, on the backdrop, full width, as on the web.
   - Sidebar card: 44 px head with the sidebar toggle (`TOGGLE_INSET` 85 px on macOS, glyph as the web's SVG,
     `ICON_BUTTON` look) and the empty strip drags the window (`window.start_window_move()`), then the `sidebar`
     mod. Collapsed: no card; the toggle (with the needs-you count) heads the main card, as the web's.
   - Main card: 44 px head always present (also on the start page): tabs mod, then the drawer toggle while the
     drawer is closed; empty head space drags the window. Canvas below.
   - Drawer card on the right: head with Files | Git | Browser tabs (look as `WorkspaceToolsTabs`) and the drawer
     toggle; open/closed and tab kept per device like the web's `perch.workspaceTools`. Its body hands off for now:
     a short line and an "Open in Perch" action using the existing hand-off (`handoff.rs`) for that tab and the
     active workspace. The Files/Git/Browser screens themselves are the next batch, not this one.
   - Resize handles in the gutters for sidebar (180 to 480, default 240) and drawer (min 280, default
     `min(760, 46% of width)`, main keeps 320), as `ResizeHandle.tsx`, widths kept per device.
   - Remove the Rust fallback "Sidebar" text toggle and the old flat backgrounds this replaces.
2. **Empty-project block refreshed** in `packages/web/src/stock-ui/sidebar/overview.tsx` (the `projectCount === 0`
   block), so both apps get it: use the current shared pieces (`components/ui/`: `buttonClass`, the icon set in
   `icons.tsx` instead of the full-width "＋" glyph, the sidebar's own row/heading styles) so it reads like the rest
   of the sidebar today. Keep its words and its `data-testid`s. The owner explicitly allowed changing this stock
   source; nothing else in `packages/web/src` changes. Rebuild the committed mod bundle (`npm run test:mods-runtime`
   says when it is stale) and update the web reference for the affected sidebar state if the gate has one.

## Done means

- A headless capture of the whole native window (the existing `workspace_render` / test-mode capture pattern) in
  four states: sidebar open with no project (start page), a session open, sidebar collapsed, drawer open. Put each
  beside a WebKit rendering of the web's `StockWindow` in the same state (the `e2e/native-parity` reference tooling)
  and list differences over 2 px or a wrong colour. Save the side-by-sides in
  `plans/261113-0037-native-terminal-fixes-and-mod-engine/window-shell/` in the owner's checkout (that folder only).
- A test that fails if the shell loses its cards, backdrop, head height or drawer.
- `cargo test -p perch-native` (alone), `npm test`, `npm run test:mods-runtime`, `cargo fmt --check`, clippy with no
  new warnings, the gate not worse than 310 of 332.
- Local conventional commits on `nm/window-shell`; then merge it into `feat/native-mods` in
  `/Users/hwiii/Github/perch-wt/native-mods` (fast-forward or a merge commit, no rebase of existing commits).
- Final `perch report`: what changed, the four side-by-sides' paths, the checks with results, anything not done.

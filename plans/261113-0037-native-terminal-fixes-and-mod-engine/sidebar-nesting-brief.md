# Brief: sub-session rows in the sidebar, redesigned

Asked by the owner 2026-11-15 with a reference picture; approved in `docs/DECISIONS.md` (2026-11-15, "Sub-sessions in
the sidebar"; read it). Rules: `agent-rules.md` in this folder. Worktree `/Users/hwiii/Github/perch-wt/sidebar-nesting`,
branch `nm/sidebar-nesting`, made from `feat/native-mods` at `cb0d5e14`. A Settings port runs in parallel on
`nm/settings`; do not touch settings code.

## Today

`packages/web/src/stock-ui/sidebar/overview.tsx` `sessionRow` and `sessionRows` (with `nestSessions`); a nested row
gets `NESTED_ROW = "ml-4 border-l border-surface-1"` (`parts.tsx:42`), and with `rounded-ui` that draws a bracket on
each child. The hover × is `SESSION_CLOSE` with `RowCloseIcon`. The row menu is `openSessionMenu` (right-click, long
press).

## Reference (owner's picture)

Parent: a filled rounded row (surface colour), title, a small chevron right after it that folds/unfolds the
sub-sessions, and "…" at the right edge. Child: indented under the parent, its own filled rounded row, a thin elbow
connector ("└", line down from the parent's icon column then right into the child row) to its left, title, "…" at the
right. Rows have small gaps between them.

## Outcome

- Nested rows as above: the elbow connector replaces the bracket border; children are filled cards; a parent with
  children shows the fold chevron (folded state kept per device like the sidebar's other flags, `saveFlag`/`readFlag`).
  A folded parent with a child that needs you still shows that (the badge or count, as the web does for folded groups).
- "…" replaces the hover × on every session row (tree, Quickchat, By status, list views): shown on hover, keyboard
  focus or on the active row; opens the same menu `openSessionMenu` opens, anchored at the button. Close stays in
  that menu; keep the close shortcut and middle-click working. Keep `data-testid`s that tests and e2e use; update the
  tests that clicked the ×.
- Use `components/ui/` pieces and the sidebar's existing tokens; no new colours.
- Both apps: the web (Tauri) from this source, the native client from the rebuilt mod bundle. Update the web reference
  states for the sidebar (`e2e/native-parity`) including a parent with two children, folded and unfolded, and make the
  native gate pass for them.

## Done means

- `npm test`, `npm run test:mods-runtime` (bundle rebuilt), `cargo test -p perch-native` (alone), `cargo fmt --check`,
  clippy with no new warnings, gate not worse than before plus the new states; any e2e spec that clicked the × updated.
- Side-by-sides (native beside web) of: parent with two children unfolded, folded, and hover on a child showing "…",
  in `plans/261113-0037-native-terminal-fixes-and-mod-engine/sidebar-nesting/` in the owner's checkout (that folder
  only).
- Local conventional commits on `nm/sidebar-nesting`, merged into `feat/native-mods` in
  `/Users/hwiii/Github/perch-wt/native-mods` (fast-forward or merge commit; if `nm/settings` merged first, merge on
  top of it and rebuild the bundle; no rebase).
- Final `perch report`: what changed, image paths, checks.

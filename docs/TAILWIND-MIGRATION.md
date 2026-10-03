# Tailwind migration

Handoff doc. If you are picking this up, read it all, then continue at
**"Next slice"**. Update the **Status** table in the same commit as each slice.

## Goal and ground rules

Decided with the user (2026-10-02): move perch's UI from one hand-written global
stylesheet to **Tailwind v4 + class-variance-authority + tailwind-merge**, with
shared primitives in `packages/web/src/components/ui/` and feature components
that compose them: the structure Orca (`~/Github/orca`) and t3code
(`pingdotgg/t3code`) use. Constraints, all from the user:

- **Zero visible change.** Keyboard/focus, mobile and theme behaviour included.
- **Incremental**, one verified slice per commit. Commit locally; **push only
  when the user asks** (AGENTS.md). Never write employer-internal names.
- **Keep CSS where CSS is right:** global defaults, theme variables (`:root`
  tokens that `themes.ts` rewrites at runtime), and xterm / Dockview overrides.
  Do not force every rule into utilities.
- **Extract a shared primitive only when real repetition warrants it** (rule of
  three), not speculatively. Today: `components/ui/menu.ts` (context menu).
- Preserve e2e hooks (see Rules).

## Status

Baseline = commit `d743211` "Split styles.css into per-section files under
styles/" (last pre-Tailwind state, byte-identical to the old monolithic CSS).

Done:
- `styles/` split out of the old 7,151-line `styles.css` (26 files, same
  cascade order via `styles/index.css`).
- Tailwind infra: `styles/tailwind.css` (no preflight, theme tokens, scan
  config), `src/lib/cn.ts`, `@tailwindcss/vite` in `vite.config.ts`.
- Visual-parity harness `e2e/visual/` (fails closed, Chromium + WebKit).
- **Slice 1: toast** (`components/Toast.tsx`, `toast.css` deleted). Verified
  identical, see "Slice log".
- **Slice 2: status dot** (`components/StatusDot.tsx`, `Sidebar.tsx` project
  dot, `status-dot.css` deleted). See "Slice log".
- **Slice 3: status bar + terminal search** (`StatusBar.tsx`,
  `components/TerminalSearchBar.tsx`, `status-bar.css` deleted). Harness gained
  states `05b`–`05e` first. See "Slice log".
- **Slice 4: onboarding** (`components/Onboarding.tsx`, `onboarding.css`
  deleted). Harness gained `23b-onboarding-phone` first. See "Slice log".
- **Slice 5: pane/row context menu** (`components/ui/menu.ts` = first shared
  primitive; `PaneContextMenu.tsx`, `WorkspaceOverview.tsx` `RowMenu`;
  `pane-menu.css` deleted) plus an infra fix: `hover:` is now a plain `:hover`
  (see slice 5 notes). Harness gained `06b-pane-menu-rename`.
- **Slice 6: navigator + keybind help** (`Navigator.tsx`, `KeybindHelp.tsx`,
  `navigator.css` deleted). Harness gained `09b`, `09c`, `10b`. See "Slice log".
- **Slice 7: workspace tools drawer + resize handle + `.app__body`**
  (`WorkspaceTools.tsx`, `ResizeHandle.tsx`, `App.tsx`; `workspace-tools.css`
  deleted). Harness gained `11b-drawer-focus`. See "Slice log".
- **Slice 8: toolbar + tab bar** (`App.tsx` top row, brand, toggles, `.dock-area`,
  file-tab view; `components/TabBar.tsx`; `toolbar-tabs.css` deleted; two
  `mobile.css` selectors moved). Harness gained `05f`–`05i`, `22b`, `22c`.
- **Slice 9: sidebar shell + host switcher** (`Sidebar.tsx`, new shared
  `components/HostStateDot.tsx` used by Sidebar and SettingsModal;
  `sidebar.css`, `host-switcher.css` deleted). Harness gained `01b`–`01d`, two
  disabled fixture hosts, pinned fixture mtimes.
- **Slice 10: session items, project rows, new-session popover, sidebar footer**
  (`Sidebar.tsx`; `session-picker.css`, `sidebar-projects.css` deleted).
  Harness gained `01c2`-`01c4` (injected per-host session list, row hover,
  delete-button hover) and the `holdHover` state option.
- **Slice 11: pairing gate** (`PairingGate.tsx`; `pairing.css` deleted; its
  `settings-modal__pair-code`, `workspace-git__turn-summary`,
  `mobile-header__gear` rules moved verbatim to their owners' files). Harness
  gained `22d`-`22f` (`unpaired: true` states).
- **Slice 12: worktree menu** (`WorktreeMenu.tsx`; `worktree-menu.css`
  deleted; `components/ui/icon-button.ts` = second shared primitive, used by
  WorktreeMenu, Sidebar and WorkspaceOverview). Harness gained a second git
  worktree in the fixture and `16b`/`16c` (failed create job).

| File in `styles/` | Lines | Status |
|---|---|---|
| tailwind.css | – | infra, done |
| toast.css | – | **migrated and deleted** |
| base.css | 75 | keep: `:root` tokens + reset. Tokens stay (themes.ts). Only `.app` could move. |
| status-dot.css | – | **migrated and deleted** |
| status-bar.css | – | **migrated and deleted** (incl. terminal-search) |
| onboarding.css | – | **migrated and deleted** |
| pane-menu.css | – | **migrated and deleted** |
| navigator.css | – | **migrated and deleted** (Navigator + KeybindHelp) |
| workspace-tools.css | – | **migrated and deleted** (drawer, `.app__body`, `ResizeHandle`) |
| toolbar-tabs.css | – | **migrated and deleted** (top row, tab bar, `.dock-area`, file-tab view) |
| sidebar.css | – | **migrated and deleted** (sidebar shell, env header, + New session) |
| sidebar-projects.css | – | **migrated and deleted** (session items, project rows, footer/gear, git status) |
| host-switcher.css | – | **migrated and deleted** (switcher button, popover, `HostStateDot`); 3 `settings-modal__*` rules moved to the top of `settings.css` |
| settings.css | 309 | not started |
| session-picker.css | – | **migrated and deleted** (session item wrapper + delete, new-session popover) |
| directory-browser.css | 274 | not started |
| cli-start.css | 322 | not started |
| worktree-menu.css | – | **migrated and deleted** (WorktreeMenu popover + the shared `ui/icon-button` glyph button) |
| mobile.css | 325 | not started |
| pairing.css | – | **migrated and deleted** (`PairingGate`); 3 unrelated rules moved to the end of `settings.css`, `git-review.css`, `mobile.css` |
| workspace-overview.css | 641 | not started |
| composer.css | 500 | not started (Hosted chat is frozen: restyle only) |
| chat.css | 536 | not started (frozen, same) |
| workspace-files.css | 692 | not started (big; see font-mono gotcha) |
| git-review.css | 1093 | not started (biggest, last) |
| dockview.css | 105 | **keep as CSS** (Dockview theme overrides) |
| terminal.css | 147 | **keep as CSS** (xterm surface; AGENTS.md invariants) |

A file is done only when it is deleted from `styles/` and from `styles/index.css`.

## Next slice

Smallest leaves first so primitives take shape from real repetition:
`directory-browser.css` → … ; leave
`workspace-files.css`, `chat.css`, `composer.css` and `git-review.css` for last.

Notes for the next ones:
- **Not covered by the harness yet** (add a state in `visual.mjs` *before*
  migrating anything that renders there): Hosted chat + composer + slash/model
  popovers (`window.usePerchStore.setState` can inject messages, as the toast
  state does), pairing gate, directory-browser modal, mobile file/git panes,
  drag-reorder states, disabled/error states. (Terminal-search bar and the
  status bar's reconnecting / ctx / cost states are covered by `05b`–`05d`.)

## Rules for a migrated component

1. **Utilities in the TSX**, merged with `cn()` (`src/lib/cn.ts`). A repeated
   pattern (three or more call sites) becomes a cva primitive in
   `components/ui/`.
2. **Tokens, not values.** Colours are the `@theme inline` tokens in
   `styles/tailwind.css`: `bg-panel-bg`, `bg-surface-0|1|dim`,
   `border-overlay-0|1`, `text-fg`, `text-subtext-0`, `bg-accent`, `text-red`,
   `rounded-ui` (= `--radius`), … They read the `:root` vars at use, so runtime
   themes keep working. Never hardcode a hex. `--font-*` and `--color-*`
   defaults are cleared on purpose.
3. **Pixel parity beats tidiness.** Legacy values are odd rems (`0.42rem`).
   Use the scale when exact (`0.5rem` = `2`), else an arbitrary value
   (`px-[0.42rem]`). Do not round to the scale in a migration slice; that is a
   separate deliberate design pass afterwards. Use arbitrary font sizes
   (`text-[0.68rem]`), never `text-xs`/`text-sm` (they also set line-height).
   `border-radius: 50%` is `rounded-[50%]`, not `rounded-full`.
4. **Remove the legacy rules in the same commit.** An element must never carry
   both: utilities are in `@layer utilities`, the legacy CSS is unlayered, and
   unlayered always wins. If a migrated element is still hit by a legacy
   descendant/context selector (`.workspace-project__header .worktree-menu__btn`),
   move that rule too.
5. **e2e hook classes.** `e2e/` has ~290 locators on legacy class names. For
   each class you remove run `git grep -n "<class>" e2e`. If used, keep that
   exact token on the element as an unstyled hook, or switch the locator to a
   `data-testid` in the same commit. Never leave a spec on a dead class.
6. **State and context selectors:** `:hover` → `hover:`; parent-hover reveals →
   `group` / `group-hover:`; `[aria-expanded="true"]` → `aria-expanded:`;
   `@media (max-width:700px)` → `max-[700px]:`; `@media (hover:none)` →
   `[@media(hover:none)]:`; `@container (max-width:460px)` → `@container` on
   the parent + `@max-[460px]:`; `::before/::after` → `before:` / `after:`.
   Keyframes go in `@theme` in `tailwind.css` as `--animate-*` (see
   `animate-toast-in`).
7. **No new dependency** beyond tailwindcss, @tailwindcss/vite,
   class-variance-authority, tailwind-merge, clsx. Headless primitives
   (Radix/Base UI, which Orca/t3code use) are deliberately not adopted: perch's
   popovers/dialogs are hand-rolled and their keyboard/focus behaviour is
   covered by e2e. Revisit only as its own task.

## Parity check (required before every commit)

`e2e/visual/visual.mjs` boots an isolated headless core on :7791 (state in
`/tmp/perch-visual`, fixed fixture repo, fixed clock, serves any web build via
`PERCH_WEB_DIST`), walks 34 UI states, and records per state a screenshot, the
computed style + box of **every** element, a hover dump and a keyboard-focus
dump, in **Chromium and WebKit** (the Mac app is a WKWebView). It never touches
`~/.perch`.

```sh
# one-time: baseline build of the ORIGINAL look (commit d743211)
cd /Users/hwiii/Github/perch
git worktree add -f /tmp/perch-vis/base-tree d743211
ln -sfn "$PWD/node_modules" /tmp/perch-vis/base-tree/node_modules
ln -sfn "$PWD/packages/web/node_modules" /tmp/perch-vis/base-tree/packages/web/node_modules
(cd /tmp/perch-vis/base-tree/packages/web && npx vite build --outDir /tmp/perch-vis/base-dist --emptyOutDir)
(cd e2e && node visual/visual.mjs snap /tmp/perch-vis/base-dist /tmp/perch-vis/base)   # ~4 min, both engines

# per slice: build the working tree, snap it, diff against the ORIGINAL baseline
(cd packages/web && npx vite build --outDir /tmp/perch-vis/new-dist --emptyOutDir)
(cd e2e && node visual/visual.mjs snap /tmp/perch-vis/new-dist /tmp/perch-vis/new \
        && node visual/visual.mjs diff /tmp/perch-vis/base /tmp/perch-vis/new)
```

The baseline is always the original build, not the previous slice: the bar is
"nothing changed since before the migration". Needs `target/debug/perch-core`
(`cargo build -p perch-core`). Run `snap` in the background (it takes minutes);
no `sleep` loops.

The harness **fails closed** (and `node e2e/visual/selftest.mjs [--with-snap]`
proves it in ~7 s; run it after touching the harness):
- `snap` exits nonzero on any state failure, page error, empty capture, missing
  web build; it stops at the first failed state and after the last requested
  one (`--only <substr>` still runs prerequisite states).
- `diff` prints `INVALID RUN` and exits 2 on a nonempty `failures.json`, empty
  or missing captures, or any missing expected state/engine, even if missing
  from both runs. It prints `IDENTICAL` only with zero differences.
- Computed style, box, text, pseudo-elements, hover and focus dumps are
  compared per element (class names ignored, uuids normalised, no-op transparent
  `box-shadow` layers from Tailwind dropped).
- **Screenshot differences fail** `diff`. Each writes
  `<new>/review/<engine>-<state>.diff.png` (differing pixels red). Open it and
  look. Only after reviewing, accept by name: `--reviewed 03-add-form,…`
  (output then says `IDENTICAL (n screenshot difference(s) reviewed by name)`).
  A difference inside the region you migrated is never "noise"; do not accept it.

Also required per slice: `cd packages/web && npx tsc --noEmit && npm test`
(215 unit tests), the e2e specs that touch the component
(`cd e2e && npx playwright test <spec>`, headless; AGENTS.md has the rules and
known failures), and `git grep` for dead e2e class locators (Rule 5).

## Gotchas found so far

- **Renderer pixel noise.** Snapping the *identical* baseline build twice gives
  3–20 px differences at anti-aliased rounded-corner edges (tab edge x≈479, the
  "+ Add" and "Add project" corners, sidebar x≈9). Computed styles never differ.
  That is why screenshots need human review rather than a zero-tolerance gate.
  Follow-up worth doing: make the capture deterministic (e.g. Chromium
  `--disable-gpu` / raster flags) so the review list shrinks to nothing.
- **`--font-mono` is never defined.** Legacy CSS uses `var(--font-mono)` with
  no fallback in `workspace-files.css` (12× in `font:` shorthands) and in
  `git-review.css` / `pairing.css` with a `monospace` fallback. The no-fallback
  ones are invalid at computed-value time, so the element just inherits its
  font. Faithful migration reproduces the *computed* result, not the source.
  Tailwind must never emit a `--font-mono`: any scanned file containing the
  word `font-mono` makes it (that happened once, from a comment in
  `tailwind.css` itself). `tailwind.css` clears `--font-*` and scans only
  `.ts/.tsx`. Fixing the typo is a deliberate follow-up, not part of a parity
  slice.
- **Invalid legacy declarations** such as `font: 0.68rem/1.1 inherit` (`inherit`
  inside a font shorthand) are dropped by the browser. Read computed values from
  the harness dump (`<out>/<engine>/<state>.dump.json`), not the source.
- **No preflight on purpose** (legacy relies on browser defaults). Tailwind
  still emits a few utilities from English words in TS comments (`flex`,
  `block`, `relative`, `border`, …); they are layered, and no TSX class equals
  them, so they are inert.
- **Shadows:** `shadow-[…]` composes with `--tw-*` layers, so the computed
  `box-shadow` string gains transparent no-op layers. The harness normalises
  them; the rendering is identical.
- `color-mix(in srgb, …)` in legacy vs Tailwind's `/opacity` (oklab) are
  identical when mixing with `transparent`; for a mix of two opaque colours use
  an arbitrary `bg-[color-mix(in_srgb,var(--a)_x%,var(--b))]`.
- `window.usePerchStore` is exposed (main.tsx), so the harness can inject store
  state (toasts, messages) without a real agent turn.
- zsh: unquoted `--include=*.tsx` and `=====` break; use `git grep -- '*.tsx'`.
  A `pkill -f` pattern that appears in your own command line kills your shell;
  use the `[v]isual` bracket trick or kill by PID. The pre-existing process
  `__perchd serve --dir /tmp/perch-e2e-perchd` belongs to the e2e suite: leave it.

## Slice log

| # | Slice | Result |
|---|---|---|
| 0 | Split `styles.css` → `styles/*.css` (d743211) | built CSS byte-identical |
| 1 | Tailwind infra + toast | tsc clean; 215/215 unit tests; harness `IDENTICAL` in Chromium and WebKit (computed styles, boxes, text, hover and focus dumps all equal); 8 Chromium screenshot differences (3–14 px) reviewed, none inside the toast region (its pixels are identical), all at rounded-corner edges that also differ between two runs of the unmodified baseline. `e2e/toasts.spec.ts` needs a real claude turn and was not run. |
| 2 | status dot | tsc clean; 215/215 unit tests; harness: no computed-style, box, text, hover or focus differences in Chromium or WebKit. Screenshot differences (Chromium 03/04/15/20c/22, WebKit 13/14, incl. ~1800 px in the git drawer) all reappear when the unmodified baseline is snapped twice (`base` vs `base2`) and none is on a status dot. `e2e/status-glyphs.spec.ts` 3/3 passed (real haiku-4-5 turns). |
| 3 | status bar + terminal search | tsc clean; 215/215 unit tests; harness vs a baseline re-snapped with the new states: no computed-style, box, text, hover or focus differences in Chromium or WebKit (the two it caught on the way, footer side-border colours and the input's `outline` computed width/colour, are fixed: `border-t-overlay-0`, `[outline:none]`). 7 Chromium corner-speck screenshot diffs reviewed by name (03, 12, 17, 17b, 17c, 20c, 22), none in the status bar or find bar, all in the baseline-vs-baseline noise set. e2e (against a fresh `npm run build`): status-glyphs, worktrees, wave1 (Cmd+F find bar) pass; `workspace-recovery` fails at its `perch.sessionId` assertion on the committed tree too (pre-existing, unrelated). |
| 4 | onboarding | tsc clean; 215/215 unit tests; harness (baseline re-snapped with the new state): `23-onboarding` and `23b-onboarding-phone` (390x520, panel scrolls) identical in Chromium and WebKit including pixels, hover and focus; no computed-style, box, text, hover or focus difference in any of the 33 states. 10 Chromium corner-speck screenshot diffs (03, 04, 06, 13, 14, 16, 17b, 17c, 20c, 22; 1–14 px, none show the modal) reviewed by name. e2e after `npm run build`: wave2 X4 onboarding, workspace-foundation, workspace-review, workspace-files-durable pass (7/7). |
| 5 | pane/row context menu | tsc clean; 215/215 unit tests; harness (baseline re-snapped with `06b`): no computed-style, box, text, hover or focus difference in any of the 34 states in Chromium or WebKit; `06` (pane menu: normal, danger, disabled Close) and `06b` (inline rename) pixel-identical in both; 7 Chromium corner-speck screenshot diffs reviewed by name (03, 13, 14, 16, 17b, 20, 20c; the 17b menu region itself is clean). e2e after `npm run build`: pane-splitting (5/5), native-ui claude/codex/omp (exercise Stop agent) pass. |
| 6 | navigator + keybind help | tsc clean; 215/215 unit tests; harness (baseline re-snapped with `09b`/`09c`/`10b`): no computed-style, box, text, hover or focus difference in any state in Chromium or WebKit; 09, 09b, 09c, 10, 10b pixel-identical. 10 Chromium corner-speck screenshot diffs (03, 13, 14, 16, 17, 17c, 18, 20, 20c, 22; 1-12 px, none in a modal) reviewed by name. e2e after `npm run build`: keybindings (5/5). |
| 7 | workspace tools drawer | tsc clean; 215/215 unit tests; harness (baseline re-snapped with `11b`): no computed-style, box, text, hover, focus or pseudo-element difference in any of the 40 states in Chromium or WebKit, incl. the divider `::after` highlight and the drawer buttons' focus. 11 Chromium corner-speck screenshot diffs (04, 06, 12-17b, 20, 20c; 1-9 px; the drawer ones, 13/14 at x=759 y=41, are the same specks slice 6 showed before the drawer was migrated) reviewed by name. e2e after `npm run build`: workspace-tabs and the layout specs pass (4/4); `toasts` (TN1, TN2, real haiku turns) pass against the migrated build. `workspace-visual-qa` fails at line 258 on the committed tree too (see Pre-existing failures). |
| 8 | toolbar + tab bar | tsc clean; 215/215 unit tests; harness (baseline re-snapped with the new states): no computed-style, box, text, hover, focus or pseudo-element difference in any of the 46 states in Chromium or WebKit, including the new two-tab strip (`05f`), drag source/target (`05g`, opacity + accent edge), inline tab rename (`05h`), and the macOS-app brand padding, expanded and collapsed (`22b`, `22c`). 11 Chromium corner-speck screenshot diffs (03, 12, 13, 14, 16, 17b, 17c, 18, 20c, 22, 22b; 1-24 px, at the tab-edge x=272/479 and sidebar x=9 specks seen before this slice, and the start-picker box corners in 03/22b) reviewed by name; 05f/05g/05h/22c are pixel-identical. e2e after `npm run build`: wave2 (tab drag-reorder, rename), workspace-tabs, responsive, pane-splitting, keybindings pass; `workspace-files-durable` failed once at line 266 in the multi-spec run and passed 2/2 alone (timing flake under load). |
| 9 | sidebar shell + host switcher | tsc clean; 215/215 unit tests; harness (baseline and new both re-snapped with `01b`-`01d` and pinned mtimes): no computed-style, box, text, hover, focus or pseudo-element difference in any of the 49 states in Chromium or WebKit. `01b` (popover: local connected, `direct` badge, disabled, injected error row), `01c` (remote selected: HOST header, disabled + New session) show 10-16 px of ±1-value specks, all at rounded corners of the start picker (x=554/967/968) and the sidebar's Register-folder button (x=13), none inside the popover or header (checked per pixel). 9 Chromium screenshot diffs reviewed by name. e2e after `npm run build`: sidebar, nav, federation (E1, E2, E4-E6: host dots connected/disabled/error), settings (host CRUD), responsive, theme, keybindings: 28/28. |
| 10 | session items + project rows + popover + footer | tsc clean; 215/215 unit tests; harness (baseline re-snapped with `01c2`-`01c4`): no computed-style, box, text, focus or pseudo-element difference in any of the 52 states in Chromium or WebKit; the new states show the per-host project list (git ahead/behind, plain subline, nested sessions, blocked dot), the row under the pointer with the reveal, and the delete button under the pointer (red on `surface-1`). One transient hover-dump difference in `03` (two elements swapped in the group dump) did not reproduce: `--only 03-add` on both builds is IDENTICAL including hover. 9 Chromium corner-speck screenshot diffs (01b, 01c4, 03, 04, 13, 16, 18, 20c, 22; 2-19 px, at the start-picker corners x=554/968, sidebar x=9 and tab edges, none in a migrated region) reviewed by name. e2e after `npm run build`: sessions, federation, remote-git, sidebar, nav, wave1, wave2, wave2.features, worktrees (48 tests) pass. |
| 11 | pairing gate | tsc clean; 215/215 unit tests; harness (baseline re-snapped with `22d`-`22f`): no computed-style, box, text, hover, focus or pseudo-element difference in any of the 55 states in Chromium or WebKit; the gate (empty, rejected code, phone width with a typed code) is pixel-identical in both engines. 8 Chromium corner-speck screenshot diffs (01b, 01c, 01c3, 13, 14, 16, 18, 20c; 1-11 px, none in the gate) reviewed by name. e2e after `npm run build`: device-pairing and settings pass (4/4). |
| 12 | worktree menu + icon button | tsc clean; 215/215 unit tests; harness (baseline and new re-snapped; fixture now has a second checkout `wt-extra`, so the popover lists a non-primary entry with Delete): no computed-style, box, text, hover, focus or pseudo-element difference in any of the 58 states in Chromium or WebKit; popover states 15, 16 and the failed-create job row 16b are pixel-identical except the 4 px tab-edge speck at x=479. 14 Chromium corner-speck screenshot diffs reviewed by name. e2e after `npm run build`: worktrees, remote-git, workspace-git, workspace-foundation (17) and the phase-3 `worktree-lifecycle.config.ts` (11) pass. |

Process notes from slice 1: the harness had a false-positive (two runs with only
capture failures printed IDENTICAL, exit 0) found by an independent review; it
is fixed and covered by `selftest.mjs`. An earlier `--with-snap` check hung for
~10 minutes because `--only` still ran every later state; fixed (see the
fail-closed list above).

Slice 2 notes: the `.agent-status-dot--*` colour rules were dead everywhere
(both call sites set `style={{ color }}` inline), so they were deleted, not
ported. `.session-status*` had no e2e or TSX user left and was dropped;
`.sidebar__project-dot` likewise. `.agent-status-dot` and
`.agent-status-dot--<state>` stay as unstyled hooks (`e2e/status-glyphs.spec.ts`).
Slice 3 notes: the e2e webServer serves `packages/web/dist`, so **run
`npm run build` before any e2e run** or it tests the previous build. New harness
states: `05b-terminal-search` (Cmd+F, input autofocus asserted, query typed),
`05c-terminal-search-closed` (Escape closes, Cmd+F reopens, the x button
closes; throws naming the step if any fails), `05d-statusbar-reconnecting-extras`
(`connected:false` + `contextTokens`/`costUsd` injected via the store),
`05e-statusbar-restored` (nocapture). A state that follows a capture must not
assume focus: the capture ends by blurring (05c clicks the input first). The
baseline had to be re-snapped (`/tmp/perch-vis/base-dist` is still the original
build; only `snap` needs repeating, with the new harness). Mobile safe-area
padding is kept as `pb-[calc(0.4rem+env(safe-area-inset-bottom))]`; headless
`env()` is 0 so the harness cannot see it, the built CSS was checked to contain
it. Hook classes kept: `status-bar`, `status-item--cwd`; the terminal-search
`data-testid`s are untouched. `.status-dot*`, `.status-item` and
`.terminal-search*` had no e2e/TSX users beyond these files and were dropped.

Focus on the find bar (follow-up to slice 3): state `05b2-terminal-search-focus`
uses the new per-state `focusWalk: { start, targets }`: focus the input, Tab
through, then `.focus()` each target, all recorded in `focus.json` (records now
carry `via` and fall back to `title` for an id). Why both: Chromium's Tab walk
reaches Previous/Next/Close, but **WebKit's Tab skips buttons** (it goes
input → `resize-sidebar` …), so only the direct `.focus()` records cover them
there. Hover records also take `title` as an id (the find-bar buttons have no
testid). Re-snapped the baseline (shape change); slice 3 vs baseline: no
computed-style, hover or focus differences in either engine; 6 Chromium
corner-speck screenshot diffs (06, 13, 14, 17b, 20, 20c, 1–9 px, none in the find
bar) reviewed by name.

Slice 4 notes: `border:none` is `[border:none]`, not `border-none` (which only sets
`border-style` and leaves the UA's 2px computed width); likewise
`bg-transparent`, not `bg-none` (that is `background-image`). Five `<kbd>`s share
a local `KBD` string in `Onboarding.tsx`; the `<li>` text styles are a
`[&>li]:` variant on the `<ul>`. No e2e used a legacy onboarding class (only
`data-testid="onboarding"` / `onboarding-dismiss`).

Slice 5 notes: **`hover:` was a behaviour change.** Tailwind v4 emits `hover:`
inside `@media (hover: hover)`, the legacy CSS used a bare `:hover`, so on touch
devices slices 1, 3 and 4 had lost their hover styles. `tailwind.css` now has
`@custom-variant hover (&:hover);` (built CSS checked: no `@media(hover:hover)`).
The harness runs a hover-capable pointer, so it cannot see this; only the CSS
output can. Rule 6 of the component rules stands (`hover:` = legacy `:hover`).
`disabled:` sorts after `hover:` in the output, matching the legacy order
(`:disabled` after `:hover`), and `06` proves it on the disabled Close item.
`pane-context-menu__item` stays as an unstyled hook (`e2e/pane-splitting.spec.ts`
counts the items); the other `pane-context-menu*` classes had no users. `cva`'s
`danger` variant carries `text-red` / `text-fg` as an either/or so no two colour
utilities compete.

Slice 12 notes: `components/ui/icon-button.ts` (`ICON_BUTTON`) is the borderless
dim-until-hovered glyph button: five sites (WorktreeMenu +, the ± git button, the
disabled branch glyph, WorkspaceOverview's +, the project ✕). `worktree-menu__btn`
stays on four of them as a hook because `workspace-overview.css` still has
context rules for it (`.workspace-project__header .worktree-menu__btn`: size,
padding, hover reveal); they are unlayered, so they beat the utilities exactly as
their higher specificity beat the old rule. Remove the hook with that file.
Hooks kept: `worktree-menu__entry`, `__entry-branch`, `__entry-path` (worktrees,
remote-git, workspace-recovery specs). Not covered by a state: the popover's
`worktree-menu__error` line (create now runs as a background job, so a failed
create shows as the sidebar job row, covered by `16b`; the popover error only
appears when listing/removing fails) and the "Loading…" / "No worktrees" rows.
`git worktree add` in the harness fixture also adds a "1 hidden worktree" row to
the sidebar in every later state.

Slice 11 notes: **`--base` is never defined** (second undefined-variable bug
after `--font-mono`; `git-review.css` uses it ~15x: expect the same treatment
there). `.pairing { background: var(--base) }` was invalid at computed-value
time, so the gate has no background of its own, and `.pairing__submit {
color: var(--base) }` computes to `unset`, i.e. the label *inherits* the page
text colour (`text-inherit`; grey on the grey accent, low contrast, preserved).
`font: 600 0.85rem/1 inherit` on the submit is dropped by the browser (inherit
in a shorthand), so it carries no font utilities. The `unpaired: true` harness
states stub the WebSocket (`context.routeWebSocket`) because the gate only shows
while the socket is down, and answer `/pair` with `paired:false` / a 400.
`var(--font-mono, monospace)` was written as `[font:1rem/1.2_monospace]` (the
computed result) so no scanned file mentions the word.

Slice 10 notes: **legacy specificity can differ from the utility order.** The
active project row's `.sidebar__project--active > … > .sidebar__project-select`
(0,3,0) beat `:hover` (0,2,0), so an active row keeps its fill under the
pointer: the migrated row applies `hover:bg-surface-1` only when inactive. The
session item's `--active` (0,1,0) lost to `.session-item:hover` (0,2,0), so there
`hover:` stays on both. The `.sidebar__project .session-item*` descendant rules
became plain padding (SessionItem is only rendered in ProjectRow). `group-hover:`
and `group-focus-within:` honour the custom `hover` variant (no
`@media (hover:hover)` in the build; the harness check passes). Dead rules were
dropped: `new-session-popover__divider|custom|input|create-btn` had no TSX user.
`new-session-popover` stays on the popover as a hook because
`git-review.css:1081` (`.new-session-popover > div:first-child`, the AgentPicker
wrapper) still targets it; move that rule when git-review is done.
`holdHover: <selector>` in a state keeps the pointer on that element for the
screenshot and dump (the capture otherwise parks it at 1,1), needed for
hover-revealed UI. An element hidden until hover must be revealed first (the
`01c4` run hovers the row, then the button).

Slice 9 notes: **Tailwind `/15` colour modifiers mix in oklab**, so a legacy
`color-mix(in srgb, var(--accent) 15%, transparent)` computes to
`color(srgb …)` and the utility to `oklab(…)`: the harness flags it. Use
`bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]` /
`border-[color:color-mix(…)]` (the "identical" claim in the gotchas below holds
for pixels, not computed strings). `--surface-2` is never defined, so the
legacy `.host-switcher-popover__badge` `border: 1px solid var(--surface-2)` was
invalid at computed-value time and the badge has **no border**; the migration
reproduces that. The harness fixture file mtimes are now pinned: the file view
prints the mtime, and a run before vs after 10:00 differed by one character of
width. The two `host-state` call sites (Sidebar, SettingsModal) now share
`HostStateDot`; `host-state`, `host-state--<state>`, `host-switcher-popover__row`,
`sidebar`, `sidebar__env-host|badge|cwd` stay as hooks (federation, nav, sidebar,
remote-git specs). `animate-host-pulse` (the connecting dot) is in `@theme`; the
harness freezes animations, so only the built CSS shows it (`@keyframes
host-connecting-pulse` present). The belt-and-braces `.sidebar{display:none}`
media rule is `max-[700px]:hidden` on the aside.

Slice 8 notes: the harness gained `tauri: true` states (a fresh context that
defines `window.__TAURI_INTERNALS__`, as the macOS app does), the only way to
see `App.tsx`'s `MAC_DESKTOP` brand padding (`pl-[78px]`). Folding
`.toolbar` + `.toolbar--tabs` and `.tab-bar` + `.toolbar--tabs .tab-bar` into
single class lists is safe because each only ever appears together; the legacy
overrides were resolved by hand (e.g. `.tab-bar`'s `flex-shrink:0` is dead:
`flex:1` follows it). `translateY(-50%)` is `[transform:translateY(-50%)]`,
because `-translate-y-1/2` sets the `translate` property and changes the
computed `transform`. The mobile `.tab-bar{display:none}` safety rule became
`max-[700px]:hidden` on the element; `.app--mobile .toolbar__button` min-height
became `min-h-[44px]` on the phone's button (the only one under `.app--mobile`).
`env(safe-area-inset-top)` is 0 headless, so the built CSS was checked to contain
it. Hooks kept: `tab-bar`, `tab-bar__tab`, `tab-bar__tab--active`, `dock-area`.

Slice 7 notes: the harness now falls back to `aria-label` as a record id (hover
and focus dumps) so unlabeled icon buttons (the drawer's ×) can be targets.
`[font:inherit]` + `text-[0.75rem]` is order-unsafe for the same reason as
`[border:none]` (the shorthand is emitted after the size utility and resets
it): the drawer buttons use `[font-family:inherit] [font-weight:inherit]
[line-height:inherit]` instead. Not covered: the "Pick a workspace" empty
message (not reachable in the harness without a no-workspace store state).

Slice 6 notes: **`[border:none]` plus a side utility is order-unsafe.** Tailwind
emits arbitrary properties after the utilities, so `[border:none]` wiped
`border-l-2` / `border-b`. For "one-sided border on a button/input" use
`[border-style:none_none_solid]` (or `none_none_none_solid`), the width utility
(`border-b` / `border-l-2`) and `border-current`: the UA's default border
*colour* on the none sides otherwise shows in computed style (grey instead of
the text colour). Two-property transitions are
`[transition:color_0.12s_ease,background_0.12s_ease]`; `transition-[a,b]` +
`duration-*` computes a different (single-value) duration list. `font-[inherit]`
is ambiguous (weight vs family): write `[font-family:inherit]`. A `[background:none]`
base clashes with a `bg-*` state, so it is applied only in the unselected branch.
No e2e used a legacy navigator/keybind-help class (only testids).

## Pre-existing failures (not caused by the migration)

Tracked here so they are not mistaken for regressions; do not fix inside a slice.

- `e2e/workspace-recovery.spec.ts:62` "mixed workspaces, sessions, terminal,
  draft conflict and comments recover after a core kill" fails at line 247
  (`localStorage perch.sessionId` is not the worktree session after the core
  restart). Verified on 2026-10-02 against the committed tree with the slice
  stashed (and a fresh `npm run build`): same failure, so it predates slice 3.
  Cause not investigated. Not listed in AGENTS.md's known failures yet.

- `e2e/agent-terminal-ownership.spec.ts:6` fails at line 75 ("phone keeps
  control after reload", `data-controlling`). This is the one AGENTS.md lists as
  load-dependent, but it failed 3 of 3 runs here, including on the committed
  tree with the slice stashed, so treat it as consistently failing now.
- `e2e/native-ui.spec.ts` `pi:` fails at line 77: the pi CLI's startup banner
  (`v1.0.0`, `[Context]` …) no longer matches the spec's text regex
  (`/pi v|pi \(|pi coding|…/`). A pi version change, not CSS. Not run against
  the committed tree. The `opencode:` case is the documented not-installed one.

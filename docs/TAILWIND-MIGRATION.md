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
  three), not speculatively. Today there are none in `components/ui/`.
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

| File in `styles/` | Lines | Status |
|---|---|---|
| tailwind.css | – | infra, done |
| toast.css | – | **migrated and deleted** |
| base.css | 75 | keep: `:root` tokens + reset. Tokens stay (themes.ts). Only `.app` could move. |
| status-dot.css | – | **migrated and deleted** |
| status-bar.css | – | **migrated and deleted** (incl. terminal-search) |
| onboarding.css | 93 | not started |
| pane-menu.css | 84 | not started |
| navigator.css | 255 | not started |
| workspace-tools.css | 112 | not started |
| toolbar-tabs.css | 251 | not started |
| sidebar.css | 126 | not started |
| sidebar-projects.css | 246 | not started |
| host-switcher.css | 226 | not started |
| settings.css | 309 | not started |
| session-picker.css | 157 | not started |
| directory-browser.css | 274 | not started |
| cli-start.css | 322 | not started |
| worktree-menu.css | 251 | not started |
| mobile.css | 325 | not started |
| pairing.css | 130 | not started |
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
`onboarding.css` → `pane-menu.css` → `navigator.css` → … ; leave
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
`PERCH_WEB_DIST`), walks 31 UI states, and records per state a screenshot, the
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

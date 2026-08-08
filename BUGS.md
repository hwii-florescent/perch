# BUGS.md — Fixes applied (2026-08-07)

The findings from the live verification pass were re-verified against the code. This file now
records only the changes that were made.

---

## Bug 1 — pane `⋯` menu not clickable (FIXED)

The pane header's `⋯` button (`[data-testid="pane-group-menu"]`, rendered in dockview's
`.dv-tabs-and-actions-container`) had no stacking context, so the Hosted chat column
(`.chat` → `.chat__list-container` → `.chat__list`) won the browser hit-test. A plain click
landed on the chat content instead of the button, and the menu only opened via a synthetic
`dispatchEvent`.

**Fix** (`packages/web/src/styles.css`):

- `.dockview-theme-perch .dv-tabs-and-actions-container { position: relative; z-index: 1; }` —
  gives the header its own stacking context above the content (no offsets, so nothing moves).
- `isolation: isolate` on `.chat` — keeps the chat subtree from ever painting into the
  header's stacking context.

**Regression guard:** `e2e/pane-splitting.spec.ts` P4 — a plain `.click()` on `pane-group-menu`
opens the menu (5 items) and Split Right adds a terminal pane. Confirmed P4 **fails** without
the fix (with the exact `.chat__list` … `intercepts pointer events` error) and **passes** with
it; P1/P2/P4 and the worktrees suite are all green.

---

## Bug 5 — worktree glyph on non-git projects (FIXED)

Non-git projects hid the worktree affordance entirely (`ProjectWorktrees` returned `null`),
leaving users unsure why the branch glyph was missing.

**Fix:**

- `packages/web/src/Sidebar.tsx` — `ProjectWorktrees` now renders a disabled, inert branch
  glyph (class `worktree-menu__btn--disabled`, testid `worktree-menu-disabled-*`) with the
  tooltip `Not a git repository — worktrees unavailable`, instead of rendering nothing.
- `packages/web/src/styles.css` — `.worktree-menu__btn--disabled` (dimmed, no hover, inert).

No protocol change; the backend gating and `WorktreeMenu.tsx` are unchanged, so no doomed
`worktree.list` can fire from a non-git project.

---

## Bug 2 — per-agent slash sigil (BACKLOG — not fixed here)

The composer sigil is per-agent by design (`/` = claude, `$` = codex). It is correct today but
does not generalize to future open-weight models / added MCPs / plugins / skills. Deferred to a
**universal command/skill palette**, tracked in `PLANS.md` ahead of the jean-parity backlog:
on app start, aggregate commands/skills/plugins/MCPs from every agent config dir (`~/.claude`,
`~/.codex`, `~/.agents`, …), dedup, and let any sigil trigger one unified palette regardless of
the selected model — while preserving the no-mis-send routing to the correct runner.

---

*Bugs 3 (`ANTHROPIC_API_KEY` precedence) and 4 (blank-session visibility) were verified as
by-design / environmental — no code change.*

# Handoff — goals.md rework, 2026-09-14

Written for the next agent picking up the `goals.md` / `SPEC.md` rework after the
Codex session **"Follow goals.md with Luna"** (`01a07d3a-0df7-7551-a001-5c99af05744b`,
cwd `/Users/hwiii/Github/perch`). That session was idle at its prompt when this
work started; its last turn landed at 16:01 EDT on 2026-09-14, mid-way through the
isolated-worktree slice.

The authoritative records are unchanged: `goals.md` is the goal packet, `SPEC.md`
is the contract, and `docs/ADE-REWORK-VERIFICATION.md` is the phase/acceptance
record. **Read those first.** This file only covers what moved in this session and
what to do next.

---

## 1. Acceptance matrix as it stands

| Gate | State |
| --- | --- |
| V-01 project registration / reload identity | PASS |
| V-02 two isolated worktrees | **PASS** (moved this session) |
| V-03 two persistent CLI agents | PASS |
| V-04 same-session Chat/CLI switching | PARTIAL — Codex extended + WebKit checks remain |
| V-05 tree, edit, save, disk/status | **PASS** (moved this session) |
| V-06 external-edit conflict recovery | PASS |
| V-07 complete Git and agent change review | PARTIAL — workspace-start / last-agent-turn diff bases remain |
| V-08 anchored comments, exactly-once packet | PARTIAL — Codex review delivery unverified |
| V-09 full host/client recovery | PARTIAL — **blocked on a crash, see §3** |
| V-10 paired mobile interaction and reconnect | UNVERIFIED |
| V-11 populated desktop/mobile visual QA | PARTIAL |
| V-12 safe hibernation and resume | UNVERIFIED |

5 PASS / 5 PARTIAL / 2 UNVERIFIED. The goal is **not** complete, and per
`goals.md` no gate may be marked from a headless statement alone.

---

## 2. What changed in this commit

### Rust — finishing the worktree registration slice

The in-flight work (`register_worktree_listing` in `server/workspace.rs`, the
`ensure_project_workspace_locked` early return in `db/mod.rs`, the retry/branch
guards in `worktree.rs`) was reviewed and two concerns fixed:

- **`worktree.list` no longer writes or broadcasts when nothing moved.** One
  `list_workspaces("local", None)` read builds a path→row map; an entry whose
  stored row already matches is returned untouched. The predicate
  `workspace_matches_worktree` mirrors the real SQL semantics — `dirty` is a plain
  overwrite, `branch`/`base_branch` are `COALESCE`d (a detached-HEAD `None` never
  clears a stored branch), `start_snapshot` is first-write-wins. Steady state is
  now 1 read, 0 writes, 0 fan-out per menu open. Covered by
  `server::workspace::worktree_registration_tests`.
- **A registration failure no longer blanks the worktree menu.** On the read path
  it is a `tracing::warn!` and the listing still goes out. `handle_worktree_create`
  keeps its hard error, since there the user asked for the checkout.

Note this fix is load-bearing in a way worth knowing: **a pre-fix `perch-core`
cannot boot against a database that contains registered worktree workspaces** —
it dies with `workspace path already belongs to another project`. That is the old
guard the early return removes. It makes A/B testing against `HEAD~` awkward; wipe
the fixture DB first.

`cargo fmt` was also run — it fixed four pre-existing formatting breaches in the
in-flight Rust hunks and restores the CLAUDE.md `fmt --check` exit-0 invariant.

### Web — one real UI bug

`Files` and `Git` on every workspace row both carried `.workspace-entry__files`,
which was `position: absolute` at the same `right`/`bottom`. They stacked exactly,
and the later `Git` button covered `Files` completely — clicking Files gave you
Git. Both now sit in one anchored `.workspace-entry__actions` flex row.

### e2e — V-02 and V-05

- **`worktrees.spec.ts` — new WT6** creates `wt-alpha` and `wt-beta` from one repo
  and asserts every axis SPEC.md V-02 names: distinct paths/branches (cross-checked
  with `git rev-parse --abbrev-ref HEAD`), exactly one project card with one
  `.workspace-entry` per branch, different session ids, workspace-scoped tab strips
  (standing in beta only beta's tab exists; navigating to alpha's row swaps strip
  and cwd together), and file isolation (a sentinel in alpha is absent from beta,
  the primary README untouched, only alpha's row goes dirty).
- **`workspace-files-durable.spec.ts`** gained the combined edit → save → **status**
  half of V-05. The fixture is now a real repo with the sentinel committed, and the
  spec asserts the Git surface reports the save: `1 changed path`,
  `modified src/main.txt`, one `git-diff-file` row, `− initial sentinel` /
  `+ saved sentinel` in the diff.
- **`workspace-recovery.spec.ts`** is new — see §3. Registered in `testMatch`.

Three pre-existing spec defects were repaired along the way; all reproduce on a
clean `HEAD`, so none came from the worktree work:

1. **`worktrees.spec.ts` was stale against the native-UI session model.** Its seed
   typed into the Hosted `.chat__input textarea`, but every "New session" launcher
   now passes an explicit `mode: "cli"` (`Sidebar.tsx`, `TabBar.tsx`,
   `NoSessionPanel.tsx`, `CliStartPanel.tsx`) and a CLI-owned session renders
   `native-cli-chat` instead. The seed hung to the 120 s timeout. It was also
   redundant — `cli_activity` alone satisfies db.rs's `SESSION_VISIBILITY_FILTER` —
   so it was deleted rather than ported. The suite went from timing out to **13.8 s**
   and no longer spends a real agent turn.
2. **No worktree affordance at all on a clean database.** The branch glyph hangs
   off a project card, and a project row is minted only lazily by a session that
   has produced a message or CLI activity. A first run against a wiped DB found no
   menu anywhere. The spec now registers the folder through the rail's own "+ Add"
   flow first. *This is arguably a product gap, not just a test gap — see §4.*
3. **The menu helper was not idempotent** — the branch glyph toggles, so
   re-opening an already-open popover closed it.

---

## 3. The open defect — start here

**Reloading a page onto a freshly restarted core, with a restored multi-pane
layout, kills the React tree and renders the app blank.**

`e2e/workspace-recovery.spec.ts` is the guard. It is **currently red on purpose**
and is registered in `testMatch`: hiding a blank-screen-on-restart crash seemed
worse than a visible red test. If you would rather the suite be green while this
is open, pull it from `testMatch` — do not "fix" it by re-adding the control
reload described below.

### Repro

```sh
cd e2e && npx playwright test workspace-recovery.spec.ts
```

The spec boots its own core on a free port with its own DB (never the shared hub
or `~/.perch`), builds: one project with a primary checkout **and** a linked
worktree, a session inside the worktree, a persistent tmux shell with an observable
PID, an unsaved editor draft left in the external-conflict state, and an anchored
review comment. Then `SIGKILL` on the core, re-boot, reload.

### What already works

Everything up to the crash recovers correctly, and the assertions for it pass:
one project card with both checkouts, unchanged session id, the shell reattached
under its **original terminal id with the same PID**, and the durable buffer still
holding the draft with its conflict banner. The structural half of V-09 is sound.

### The failure

React aborts with `Maximum update depth exceeded` (minified #185) and the app
renders blank. A development React build names the cause:

```
The result of getSnapshot should be cached to avoid an infinite loop
```

That is a store selector returning a freshly allocated snapshot on every read —
the same class of bug `views/Chat.tsx` already documents at its `EMPTY_MESSAGES`
constant and its `runtimeModeAvailable` / `nativeUiAvailable` selectors.

### Bisection already done — do not redo this

- **Not a plain-reload bug.** Reloading with exactly the same panes against the
  still-running core is clean. That control assertion was briefly left in the spec
  and made it pass **5/5** — it masks the defect and was removed. Do not put it back.
- **Restart-specific.** Without that extra reload it fails **3/3** against the
  production bundle.
- **Needs the persistent shell.** With the shell terminal left out of the mix, the
  recovered page raised no React error at the same checkpoint.
- **Not found by inspection.** Every selector reached returns a scalar or a stored
  reference: `views/Terminal.tsx:34`, `views/AgentCliTerminal.tsx:41,190`,
  `dockview/DockviewShell.tsx:61`, `components/WorkspaceFiles.tsx:245-255`,
  `components/WorkspaceGitReviewPane.tsx:13-16`, `components/WorktreeMenu.tsx:79-85`,
  `Sidebar.tsx:407`, and Chat.tsx's already-hardened ones.

### Leads worth chasing

1. `views/PersistentTerminal.tsx:74` writes a brand-new `terminals` map **and** a
   brand-new entry object on every attach, unconditionally. No current selector
   reads the map wholesale, so it is not the loop on its own — but it is the kind
   of unconditional churn that turns a marginal selector into a loop, and the
   shell terminal is exactly what the bisect says is required.
2. `dockview/DockviewShell.tsx:467-516` — the layout invalidate/apply pair. The
   apply effect deliberately keeps `sessionLayouts` in its deps while reading via
   `getState()`. It is guarded by `appliedSessionIdRef`, so it should be a no-op
   after the first apply, but the "page loaded once, then core restarts under it"
   shape is exactly its edge. Note `PLANS.md` already flags the `savedPanelIdsRef`
   fix at `:331,393,511` as *passing its unit test but never re-checked against
   `e2e/native-providers.spec.ts`*.

### How to get a readable React error

Production React only gives you `#185`. To get the named warning:

```sh
cd packages/web && NODE_ENV=development npx vite build --mode development --minify false
```

The PWA plugin errors at the end but the bundle is written and `dist/index.html`
points at it. **Rebuild with `npm run build` from the repo root afterwards** — a
development bundle left in `dist/` will silently change behaviour for every other
spec.

---

## 4. Smaller findings, recorded not fixed

- **Duplicate testid window.** `Sidebar.tsx`'s `ProjectWorktrees` suppresses its
  own menu only once the project appears in `workspaceProjects`, so it and
  `WorkspaceOverview`'s copy can both render `worktree-menu-local-<cwd>` at the
  same time. Harmless to users, ambiguous to tests — `openWorktreeMenu` uses
  `.first()` because of it.
- **No worktree affordance until a project is registered.** A session alone does
  not mint a project row (the insert is lazy, gated on a message or CLI activity),
  so a git repo opened as a fresh session shows no branch glyph. Decide whether
  session creation should register eagerly, or whether the rail's "+ Add" is the
  intended only path, and record it in `SPEC.md`.
- **`.git` is listed in the workspace file Explorer.** Visible in
  `files-durable-status.png`. Probably wants hiding, but that changes product
  behaviour and could move other specs, so it was left alone.
- **e2e project pollution.** `workspace-files-durable.spec.ts` registers a
  `V-05 Files <RUN_ID>` project per run and never removes it; the shared
  `/tmp/perch-e2e-hub.sqlite` accumulates them (7 were visible during this work).
  Wipe with `rm -f /tmp/perch-e2e-hub.sqlite*` after killing the servers.
- **`PLANS.md`'s "interrupted Codex session" notes are partly stale.** They say UI
  mode is still a second harness; the native-binding commits (`c2ceac6` through
  `ee7a2e5`) addressed exactly that for Claude, Codex, OMP, Pi and OpenCode. Left
  as written — they are that moment's record, and the verification doc is
  authoritative.
- **`handleOpenWorktree` passing `mode: "cli"` is deliberate.** It matches every
  other explicit launcher in the app; only `keybinds.ts`, `MobileSwitcher.tsx` and
  the internal store call omit it. Do not "fix" it to inherit the global setting
  without deciding that for all launchers at once.

---

## 5. Environment notes that cost time

- **`~/.perch/settings.json` is shared by every instance** (no `--settings-path`).
  It currently reads `"chatMode": "cli"`. Several specs (`cli-sync`, `models`,
  `restyle`, `federation`) restore it to a hardcoded `"hosted"` in their
  `afterAll`, which will silently overwrite a real CLI-mode preference on a full
  suite run. Worth making those save-and-restore the original value.
- **macOS `/var` → `/private/var`.** The server stores canonical paths, so any
  fixture path used in a testid must be `fs.realpathSync`'d. Both new specs do.
- **`execSync` for git needs `input: ""` plus a timeout** — this machine has
  githooks middleware that reads stdin and will otherwise hang the worker.

---

## 6. Commands

```sh
cargo test -p perch-core                 # 260 + 2 protocol parity
cargo fmt --check                        # must stay exit 0
cargo clippy --workspace --all-targets   # exactly 5 baseline warnings, add none
npm run build                            # rebuild dist after ANY web change

cd e2e
npx playwright test worktrees.spec.ts                  # 6/6, ~14 s
npx playwright test workspace-files-durable.spec.ts    # 1/1, ~20 s
npx playwright test workspace-recovery.spec.ts         # RED — see §3
```

Everything headless. Never `--headed` / `--ui`.

---

## 7. Suggested order

1. **Find the uncached selector** (§3). It is a blank-screen crash on a real user
   path — restarting the app under an open window — not merely a test failure, and
   it blocks V-09.
2. **V-07** — workspace-start and last-agent-turn diff bases, plus the full change
   summary. Self-contained; no agent quota needed.
3. **V-11** — populated desktop/mobile QA. The captures in
   `.impeccable/review/` and `e2e/artifacts/` are a starting point.
4. **V-04 / V-08** — the Codex-specific remainders. The verification doc records
   that the Codex account hit its usage limit during the WebKit pass, so these may
   be quota-blocked; check before planning around them.
5. **V-10 and V-12** are still untouched and will need real product work, not just
   test coverage: a pairing flow driven from a phone-sized or real remote client,
   and an idle/hibernation policy that is actually observable.

# Handoff — goals.md rework, 2026-09-15

## Latest handoff — V-07/V-10/V-11/V-12 slices (2026-09-15)

Four gates moved this session, committed as `66ad75a` (not pushed). The
authoritative records are unchanged: `goals.md` is the goal packet, `SPEC.md`
the contract, `docs/ADE-REWORK-VERIFICATION.md` the phase/acceptance record —
each slice below has a full checkpoint there with commands and observations.

### Acceptance matrix as it now stands

| Gate | State |
| --- | --- |
| V-01 project registration / reload identity | PASS |
| V-02 two isolated worktrees | PASS |
| V-03 two persistent CLI agents | PASS |
| V-04 same-session Chat/CLI switching | **PASS in Chromium** — Codex check ran once its quota reset; WebKit re-confirmation blocked by the browser |
| V-05 tree, edit, save, disk/status | PASS |
| V-06 external-edit conflict recovery | PASS |
| V-07 complete Git and agent change review | **PASS** (local workspaces; moved this session) |
| V-08 anchored comments, exactly-once packet | **PASS in Chromium** — Codex delivery observed 2026-09-15 |
| V-09 full host/client recovery | PASS |
| V-10 paired mobile interaction and reconnect | **PASS** (moved this session) |
| V-11 populated desktop/mobile visual QA | **PASS** (moved this session) |
| V-12 safe hibernation and resume | **PASS** (moved this session) |

**12 PASS in Chromium.** Every gate now has observed evidence; the only thing
still missing is WebKit re-confirmation, which is *blocked* rather than failing —
the Codex account is over its usage limit ("try again at 4:10 AM", reported by
the CLI itself), and **every WebKit run on this machine now hangs in
Playwright's browser setup**, including a bare `webkit.launch()` with no perch
involved. `npx playwright install webkit` was already tried and did not
fix it, so treat any WebKit gap as environment, not product.

### What changed

**V-07 — last-agent-turn review.** `agent_change_snapshots` finally has a
runtime caller (`server/agent_history.rs`): one durable before/after boundary
per agent turn, hooked at the session's running/idle transition
(`notify_session_updated`) so a turn typed straight into the CLI counts like
one sent from the UI or a review packet. Both boundaries are *content commits*
from the new `GitService::content_snapshot` — a scratch-index `commit-tree`
covering index, worktree and untracked files, touching no ref, index or
worktree — because agents mostly do not commit and a HEAD-only boundary reports
an empty turn. The Git surface offers it as "Last agent turn" through the
existing compare target plus one optional field on `git.status.result`.
Two shared-function fixes fell out: configured CLI providers had a **no-op
activity callback** in the runtime adapter's terminal registry (so they never
reported working/idle at all), and `GitService::diff` synthesized working-tree
untracked files into *every* non-staged target, attributing post-turn files to
a two-endpoint comparison and double-listing files the endpoint already had.

**V-12 — hibernation and resume.** The machinery existed with no caller.
`spawn_agent_hibernation_task` now hibernates idle agents nobody is watching
(15 min; `PERCH_HIBERNATE_AFTER_SECS` overrides, `0` disables) and the attach
path wakes a sleeping agent by *resuming its recorded provider session* —
never a fresh one. The CLI pane says "sleeping … its conversation is kept" with
a Resume button instead of reporting an exit. Two defects fixed: a CLI agent
could never leave `Working` (nothing moved it, so hibernation was unreachable —
the idle sweep now moves it to Idle after 20s of pty silence), and a hibernated
or crashed CLI left its session permanently "running", which stuck the status
dot and made the next attach fail with "a Chat turn is still running in this
session".

**V-10 — device pairing.** perch binds `0.0.0.0` and had **no authentication
anywhere**. `devices.rs` adds paired devices (`~/.perch/devices.json`,
`--devices-path` / `PERCH_DEVICES` to override) storing only each token's
SHA-256, with in-memory pairing codes that expire in five minutes, work once
and burn after five wrong guesses. `authorize_request` gates the WS upgrade and
both upload routes; **loopback stays exempt** so the desktop shell never pairs
with itself. `GET/POST {base}pair` let an unpaired browser learn that it is
unpaired and claim a token (set as a cookie, so the WS handshake carries it).
New protocol family `device.*`; new UI: `PairingGate` (replaces the whole app
for an unpaired device) and Settings → Devices.
This exposed a live bug: **`crypto.randomUUID` is secure-context only**. Ten
unguarded call sites — plus four home-grown fallbacks whose
`"randomUUID" in crypto` guard is true while the property is not callable —
crashed the entire React tree for a phone on plain http. They now share
`packages/web/src/ids.ts`.

**V-11 — pane-width responsiveness.** The file and Git surfaces' collapse rules
were viewport-keyed, so a narrow dockview pane inside a wide window clipped its
controls (the file pane had a ~490px floor inside a 218px pane; at phone width
the Git file rail rendered *behind* the diff because the viewport and container
rules both applied). They are `@container` rules now — files at 460px, where
the 230px tree rail stops leaving a usable editor.

**V-07 completion.** Implicit (session-created) workspaces now record a
creation ref, but only within a five-minute grace window — an older row stays
"Workspace start (not recorded)" rather than being back-dated to a late HEAD.
The write preserves the row's `dirty` flag (that column is a plain overwrite in
the shared statement) and broadcasts `workspace.updated`, without which clients
keep their cached snapshot-less copy. The Git surface also states whose turn it
was and how many paths it touched, and the rename/delete/empty-comparison
states are now exercised against a real repository.

**V-11 completion — and another dead end fixed.** The QA spec now spans a
narrow desktop pane, a wide desktop viewport and 390px across the Git, file,
terminal and settings surfaces, checking clipped controls *per pane*, page-level
horizontal scroll, a visible focus indicator, readable status text, and phone
reachability of every pane. That last check found a real one: **Settings existed
only in the desktop `<Sidebar/>`**, which is replaced below 700px, so chat mode,
themes, agents, hosts and the new devices panel were unreachable from a phone.
`MobileHeader` now carries the same control.

### Where to pick up

1. **WebKit.** Every gate passes in Chromium; the dual-engine half of V-04 (and
   any other "both engines" claim) waits on WebKit launching again — a bare
   `webkit.launch()` hangs, reinstalling did not help. That is the one
   environment fix worth doing first.
2. **Port the four stale Hosted-composer specs** onto `native-cli-composer`
   (see the section below) so the suite stops producing false negatives.
3. ~~Decide the launcher/mode question~~ — **done this session**: the ordinary
   launchers (`Sidebar`, `TabBar`, `NoSessionPanel`, `WorktreeMenu`) no longer
   hardcode `mode: "cli"`, so a new session inherits the device default that
   goals.md asks for; `CliStartPanel` still starts CLI explicitly. Unchanged on
   a CLI-default machine, which is why the suite stayed green.
4. Optional polish listed under "Explicit remaining scope": direct-host turn
   boundaries, hibernation for remote agents, pairing QR/TLS, a broader focus
   and contrast sweep.

### One thing I started and deliberately dropped

I began a single combined `final-verification.spec.ts` that would run goals.md's
eight-step "Non-negotiable verification" against one host in one pass. Steps 1-3
worked (project + worktree, two different CLI agents plus a shell terminal in
one project, Chat/UI <-> CLI round-trip proven by an unchanged terminal id
across a reload), as did the edit/diff/comment half of step 4. I removed it
rather than leave a red spec, because every step it covers already has dedicated
passing evidence, and two things need real work first:

- **Review delivery needs the provider's native bridge to be live.** Sending the
  packet to a Claude session whose hooks had not yet fired answers "waiting for
  the CLI's native UI bridge timed out". `native-ui.spec.ts` waits for the TUI's
  "bypass permissions on" line before switching to UI mode; a combined run has
  to do the same and prime the bridge with one turn.
- **Claude now shows a folder-trust prompt** ("Yes, I trust this folder") in a
  fresh temp directory, which any spec starting Claude in a new fixture must
  answer with Enter, exactly as `native-ui.spec.ts` already does for Codex.

One real isolation gap found while doing it, worth knowing for any spec that
creates worktrees: **worktrees are created under the developer's real
`~/.perch/worktrees/<repo basename>/`, which `--db-path` does not isolate.** Two
runs using the same repo directory name collide ("fatal: ... already exists"),
and a spec that does not clean up leaves that tree behind.

### New tests (all registered in `e2e/playwright.config.ts` `testMatch`)

```sh
cd e2e
npx playwright test agent-turn-review.spec.ts     # V-07, fixture CLI provider, ~4s
npx playwright test agent-hibernation.spec.ts     # V-12, real Claude, ~41s
npx playwright test device-pairing.spec.ts        # V-10, two origins, ~4s
npx playwright test workspace-visual-qa.spec.ts   # V-11, visual QA, ~2s
```

A full green sweep of everything this session touched, for the next agent to
repeat before changing any of it:

```sh
cd e2e && npx playwright test agent-turn-review.spec.ts device-pairing.spec.ts \
  workspace-visual-qa.spec.ts agent-hibernation.spec.ts workspace-recovery.spec.ts \
  workspace-terminals.spec.ts agent-terminal-ownership.spec.ts \
  workspace-files-durable.spec.ts --project=chromium   # 9/9 PASS, ~1.6 min
cargo test -p perch-core     # 263 + 2 protocol parity
cargo fmt --check            # exit 0
cargo clippy --workspace --all-targets   # exactly the 5 baseline warnings
npm run build && npm test    # bundle + 222 web tests
cargo build -p perch-desktop # the Tauri shell still links
```

`workspace-visual-qa.spec.ts` writes screenshots to `e2e/screenshots-visual-qa/`
(gitignored) — they are meant to be *looked at*, not only asserted on.
`agent-hibernation.spec.ts` sends one short real prompt (a conversation must
exist before `claude --resume` can resume it); everything else is quota-free.

### Four pre-existing e2e failures — root cause found, fix is a port

`responsive.spec.ts` R3, `pane-splitting.spec.ts` P3, `chat-power.spec.ts` P1
and `workspace-git.spec.ts` GB1 drive the Hosted-only composer (`model-chip`,
`.chat__input textarea`). I first assumed the shared `"chatMode": "cli"` setting
was the cause; it is not, and the real answer is worth having:

1. Every "New session" launcher (`Sidebar.tsx`, `TabBar.tsx`,
   `NoSessionPanel.tsx`) passes an explicit `mode: "cli"` — a *session-scoped*
   override, so it beats the device default and the global setting alike.
2. Even with that session flipped to Hosted, `views/Chat.tsx` renders
   `NativeCliChat` whenever `cliReady && nativeUiAvailable`. That is the
   native-binding decision in CLAUDE.md: UI mode is a web view of the CLI-owned
   session, not a second harness.

So the composer those specs need is unreachable **by design**, in any chat
mode — I confirmed it by flipping the session-scoped override in R3 and
watching the pane still render the real Claude TUI. They are **stale, not
flaky**; the fix is to port them onto `native-cli-composer` the way
`native-ui.spec.ts` already does. R3 now carries that explanation in a comment.

One adjacent bug *is* fixed: five specs forced `chatMode` back to a hardcoded
`"hosted"` in `afterAll`, silently overwriting a real CLI-mode preference on the
developer's machine (there is no `--settings-path`). New `e2e/chatMode.ts`
remembers the user's value and restores *that*, and exposes `setChatMode` /
`useHostedSession` so a spec asks through the real UI instead of a file write
the running server never re-reads. `responsive.spec.ts` uses it; converting the
other four hardcoders is a mechanical follow-up.

The product question behind (1) is now settled: the ordinary launchers no
longer hardcode CLI, so a new session inherits the device default (goals.md's
"device default and a per-session override"). It does not rescue these four
specs — point (2) above is still what renders `NativeCliChat` — but it does mean
a Hosted-default user finally gets Hosted sessions.

`native-ui.spec.ts` (claude) also fails pre-existing: it asserts the model chip
contains "haiku" while the CLI reports `claude-opus-5`.

### Explicit remaining scope

- **V-04** passed in Chromium for every built-in provider once the Codex quota
  reset (2026-09-15 07:50 EDT). Its WebKit re-confirmation is still blocked by
  the browser itself; do not read the Chromium pass as covering WebKit.
- **V-07** is PASS for local workspaces. Two limits are recorded rather than
  fixed: a direct-host session's turns are never captured (that workspace's Git
  is not reachable from this process), and the boundary capture is spawned, so a
  turn that edits within its first few milliseconds would land on the before
  side.
- **V-11** is PASS. Two limits recorded rather than fixed: the focus sweep
  samples one control per surface, and contrast was judged by eye rather than
  computed. `workspace-visual-qa.spec.ts` is where to extend either.
- **V-10** pairing has no QR code, no per-device scope, and no TLS: on an
  untrusted network the token crosses the wire in the clear, so the honest
  deployment is still a trusted LAN or an ssh-forwarded port.
- **V-12** covers local CLI agents only; direct-host agents never hibernate
  because their process is not ours to terminate.

---

# Handoff — goals.md rework, 2026-09-14

## Latest handoff — workspace-start comparison (2026-09-14)

User requested an immediate wrap-up because usage is nearly exhausted. Stop
expanding this slice; resume remaining goals from the evidence below. The full
goal remains active and incomplete. All changes are uncommitted.

### Finished since the previous handoff

- Fixed the restart React loop in `NoSessionPanel` by selecting the derived
  project's scalar cwd instead of a fresh object. V-09 mixed recovery passes
  three times each in Chromium and WebKit; exact pane IDs, same shell PID,
  project/worktree identity, draft conflict and review comment all survive.
- Added **Workspace start** to the existing Git comparison selector. It sends
  the existing `compare` target with the stored immutable start revision;
  no new protocol family, dependency or diff implementation was introduced.
  The same path/source revision anchors continue to work for comments.
- `server/workspace.rs::handle_project_create` now resolves HEAD through Git
  before registering/acknowledging a project. The dispatcher spawns this async
  operation; no Git wait occurs while holding the foundation lock.
- `source_control.rs::head_revision` reuses the bounded Git command runner and
  asks Git to resolve `HEAD^{commit}` (including packed refs/linked checkouts).
  Non-repositories, unborn HEADs and unsuccessful lookups return no baseline.
- `HistoryDb::create_project` now accepts an optional start revision, inserted
  only when creating the workspace. Re-registration never replaces it. Its
  existing DB test now asserts that a later supplied ref cannot replace the
  original. All Rust callers were updated for the new argument.
- The Git pane receives `workspace.startSnapshot`. Missing refs show a disabled
  "Workspace start (not recorded)" option rather than silently using HEAD.
- Added a real browser test in `e2e/workspace-review.spec.ts`: register while
  index/worktree/HEAD differ, compare against start, advance HEAD, include an
  untracked file, add an anchored note, reload, and select the same base from
  the 390px mobile Git surface. It checks both visible content and wire targets.
- Review fixtures now get unique canonical temporary paths per test. Reusing
  one path for rebuilt repositories would incorrectly reuse a prior test's
  durable workspace and immutable start ref.

### Verification completed

```text
npm run build                  PASS (production bundle)
cargo test -p perch-core        260 core tests + 2 protocol parity tests PASS
cargo clippy --workspace --all-targets
                               PASS, exactly the 5 baseline warnings
npm test                       222 web tests PASS
cargo fmt --check              PASS
cd e2e && npx playwright test workspace-review.spec.ts -g 'workspace start'
                               1/1 PASS in Chromium (desktop + mobile flow)
```

The final compatibility rerun was launched after making fixture paths unique:
`cd e2e && npx playwright test workspace-review.spec.ts -g 'reads distinct|workspace start|mobile Git'`.
It finished **3/3 PASS in Chromium** (7.3 seconds): existing source/comment
CRUD, workspace-start desktop/reload/mobile, and existing mobile Git/comment
flow. Tool session `98470` is completed; no test process remains to monitor.
No real-provider review-delivery test was included in this rerun.

Desktop and mobile workspace-start screenshots were inspected. The selection,
old/new sentinel lines, untracked file and anchored note render. Existing small
mobile diff navigation/clipping issues remain for V-11. Current screenshots:
`e2e/artifacts/workspace-review-Workspace-743cc-ts-reload-and-mobile-review-chromium/workspace-start-{desktop,mobile}.png`.
This directory is gitignored and gets wiped by the next main e2e run.

### Explicit remaining scope

**V-07 stays PARTIAL.** Workspace-start comparison is implemented for stored
baselines and new explicit project registration. Implicit session-created
workspaces still start without a revision; legacy/worktree discovery can set a
first-observed ref later. Do not call those a proven original creation boundary.
Agent-turn history remains unwired: the existing DB before/after methods have
no runtime callers. Native turns may start from CLI, UI or review input; a
HEAD-only comparison would miss uncommitted edits. Preserve real before/after
content boundaries and earlier turns when implementing this.

V-04/V-08 Codex remaining acceptance, V-10 pairing/mobile, V-11 populated visual
QA and pane-width responsiveness, V-12 hibernation, and measured performance
budgets remain open. See SPEC.md and the verification matrix for full scope.
No goal-complete or blocked status was set. The recovery fix and its detailed
phase record are already in PLAN.md and docs/ADE-REWORK-VERIFICATION.md; this
latest workspace-start slice is documented here first at the user's request.

---

**2026-09-14 continuation:** The §3 crash is fixed in `NoSessionPanel` (the
fallback project selector now returns a scalar cwd). Mixed recovery passes
3/3 in both Chromium and WebKit, including the disconnected screen and exact
pane IDs. V-09 is PASS; see `docs/ADE-REWORK-VERIFICATION.md` for current evidence.
The original investigation below is retained as history.

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
| V-09 full host/client recovery | **PASS** — continuation fixed the selector; 3/3 in Chromium and WebKit |
| V-10 paired mobile interaction and reconnect | UNVERIFIED |
| V-11 populated desktop/mobile visual QA | PARTIAL |
| V-12 safe hibernation and resume | UNVERIFIED |

6 PASS / 4 PARTIAL / 2 UNVERIFIED. The goal is **not** complete, and per
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

## 3. Historical defect — fixed by the continuation above

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
npx playwright test workspace-recovery.spec.ts         # PASS — see continuation above
```

Everything headless. Never `--headed` / `--ui`.

---

## 7. Suggested order

1. **Complete:** uncached selector fixed in `NoSessionPanel`; V-09 passes.
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

## 8. Next-slice code findings (2026-09-14 continuation)

V-07 is implementation work, not only missing assertions:

- `db/prompts.rs` already has bounded `AgentChangeSnapshotStart/Finish` and
  idempotent before/after methods. The only callers are DB tests. There is no
  native/hosted turn-boundary integration or Git/history wire family yet.
- `source_control.rs::DiffTarget::Compare { base, head }` already supplies
  ref-to-worktree and ref-to-ref diffs and matching review source resolution;
  reuse it for concrete revision comparisons.
- `workspaces.start_snapshot` is immutable after first write. Its current
  writers run through `server/workspace.rs::register_worktree_listing`, called
  by worktree list/create. Ordinary `handle_project_create` registers the row
  without Git metadata; opening the worktree menu later can record a later HEAD.
  Capture the actual creation boundary before exposing a Workspace start option;
  do not label a late status poll as the original start.
- Native CLI turns can originate in either UI or terminal. Hook the shared
  native turn events, not only `agent.ui.prompt`, to avoid missing terminal and
  review turns. A HEAD-only before/after comparison loses uncommitted edits;
  the history must honestly cover those too and preserve earlier turns.
- The current mixed-pane screenshots show clipped file/Git controls at narrow
  pane widths even on desktop. V-11 needs pane-width responsiveness, not only
  viewport media queries. No Git or visual implementation was changed yet.

All changes in this continuation are uncommitted. Production `dist` was rebuilt
successfully after the temporary development build. The recovery fixture now
cleans up every tmux session its core logged as launched; the nine leftovers
from this turn's earlier runs were also removed after confirming their fixture
paths were deleted and their creation times belonged to this turn.

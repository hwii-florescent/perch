# ADE rework verification

## V-04 Codex check — PASS, 2026-09-15 07:50 EDT

The Codex account's usage limit had reset, so the check that was blocked
overnight ran:

```text
cd e2e && npx playwright test --config=native-ui.config.ts --project=chromium -g codex
  codex: UI and CLI share native turns across a core crash    1/1 PASS (36.2s)
```

That was V-04's outstanding provider check. Every built-in provider — Claude,
Codex, OMP, Pi, OpenCode — now has observed UI/CLI turn sharing across a core
crash in Chromium, and V-08's Codex delivery passed earlier the same night.

**WebKit is still blocked at the browser.** Retested after the quota reset: a
bare `webkit.launch()` with no perch involved still hangs past three minutes
(Playwright 1.61.1, `webkit-2311`, reinstalled). So V-04 is PASS on Chromium and
its WebKit re-confirmation stays UNVERIFIED-blocked with the reason recorded —
not inferred from the Chromium pass.

## Device default at session creation — 2026-09-15

goals.md requires the Chat/UI ↔ CLI mode to work "with a device default and a
per-session override". It did not: `Sidebar.tsx`, `TabBar.tsx`,
`NoSessionPanel.tsx` and `WorktreeMenu.tsx` each passed an explicit
`mode: "cli"` into `createSessionOnHost`, which is a *session-scoped* override —
so every session a user created ignored the device default, and the default was
effectively dead. (`CliStartPanel` still passes it: starting a CLI agent is that
panel's entire purpose.)

Those four now omit the mode, so a new session inherits the device default and
the per-session override remains available from the pane's own control. On a
machine whose default is CLI — including this one — behaviour is unchanged,
which is why the worktree suite (6/6), the recovery, pairing, turn-review and
visual-QA specs all stay green across the change.

`sidebar.spec.ts` "2. First session listed + active" and `workspace-tabs.spec.ts`
W1 fail either way: they were verified failing with the change **stashed**, and
belong to the stale Hosted-composer family documented above.

## Stale Hosted-composer specs — root cause found, 2026-09-15

`responsive.spec.ts` R3, `pane-splitting.spec.ts` P3, `chat-power.spec.ts` P1
and `workspace-git.spec.ts` GB1 were assumed to be failing because this
machine's shared `~/.perch/settings.json` is in CLI mode. It is deeper than
that, and worth recording precisely so nobody else spends the time:

**The Hosted composer they drive (`model-chip`, `.chat__input textarea`) is
unreachable by design for these sessions, in any chat mode.** Two things
compose:

1. Every "New session" launcher (`Sidebar.tsx`, `TabBar.tsx`,
   `NoSessionPanel.tsx`) passes an explicit `mode: "cli"`, which is a
   *session-scoped* override and therefore beats the device default. Flipping
   the global setting — or the device-scoped toggle — does not move it.
2. Even with the session flipped to Hosted, `views/Chat.tsx` renders
   `NativeCliChat` whenever `cliReady && nativeUiAvailable`, which is true for
   any session that has started a CLI. That is the native-binding decision
   CLAUDE.md states: UI mode is a web view of the same CLI-owned session, not a
   second agent harness.

So these four are **stale, not flaky**: they exercise the pre-native-binding
Hosted-only composer. The fix is to port them to the native UI composer
(`native-cli-composer`, as `native-ui.spec.ts` already does), not to force a
chat mode. Verified by flipping the session-scoped override to Hosted in R3 and
watching the pane still render the real Claude TUI.

One related bug *was* fixed: five specs forced `chatMode` back to a hardcoded
`"hosted"` in `afterAll`, silently overwriting a real CLI-mode preference on the
developer's own machine. `e2e/chatMode.ts` now remembers the user's value and
puts *that* back, and offers `setChatMode` / `useHostedSession` helpers so a
spec asks for a mode through the real UI rather than a file write the running
server never reads.

## V-11 completion — 2026-09-15

`e2e/workspace-visual-qa.spec.ts` now covers both viewports SPEC.md V-11 names
and each of its failure modes, against populated surfaces:

- **No clipped controls** — measured per pane, not per window, so a cramped
  dockview pane inside a wide browser is caught (that is the defect this spec
  was written for). Checked on the Git review, file, terminal and settings
  surfaces at a narrow desktop pane (900px window, three panes), at a wide
  desktop viewport (1440×900) and at 390px.
- **No accidental horizontal scroll** — `documentElement.scrollWidth` against
  `clientWidth` after every surface change.
- **Focus is visible** — a representative control per surface is focused and
  its computed style must show an outline, ring or border change; "we set
  `:focus-visible` somewhere" is not evidence for a given control.
- **Status is readable** — the desktop status bar's cwd and the mobile header
  must be non-empty, at least 11px, and not collapsed to nothing.
- **No desktop-only dead end** — every phone pane (chat, terminal, files, Git)
  is opened from the phone shell, and Settings is reachable at phone width.

**Defect found and fixed: Settings was a desktop-only dead end.** The gear lived
only in `<Sidebar/>`, which is replaced below 700px, so chat mode, theme,
agents, hosts and the new paired-devices panel were unreachable from a phone.
`MobileHeader` now carries the same control (same testid, same modal).

Captures (gitignored, local only): `e2e/screenshots-visual-qa/` —
`git-narrow-desktop`, `files-narrow-desktop`, `git-phone`, `files-phone`,
`settings-wide-desktop`, `settings-phone`. They were inspected, not only
asserted on; the phone settings sheet wraps its theme chips, keeps 44px touch
targets and scrolls cleanly.

**V-11 is PASS.** What is deliberately not claimed: the focus sweep samples one
control per surface rather than every control, and contrast ratios were judged
by eye rather than computed.

## V-07 completion — 2026-09-15

The last three gaps closed, all in `e2e/agent-turn-review.spec.ts` against the
same real repository, plus `e2e/device-pairing.spec.ts` for the implicit case:

- **Implicit workspaces now record a creation ref.** A session mints its
  workspace with no Git metadata; `backfill_implicit_start_snapshots` records
  HEAD for such a row the first time a client asks for a workspace snapshot,
  and only within a five-minute grace window — anything older stays
  "Workspace start (not recorded)" rather than being back-dated to a late HEAD.
  The write preserves the row's `dirty` flag (that column is a plain overwrite
  in the shared statement) and broadcasts `workspace.updated`, without which
  connected clients keep their cached, snapshot-less copy. Observed on the
  phone's session-created workspace in the pairing run.
- **Last-agent-change summary.** The Git surface now states whose turn it was
  and how many paths it touched, and says explicitly when a turn is still open
  and therefore compared against the working tree.
- **Rename, delete and the empty comparison.** The spec renames one tracked
  file, deletes another, and asserts both states in the changed-file rail and
  the status list; it then commits and selects the staged-only comparison,
  where the surface must render its empty state rather than a blank pane.

With the working-tree/staged/HEAD sources, workspace-start and last-agent-turn
bases, line numbers, and anchored comments already recorded, that is every axis
SPEC.md V-07 names. **V-07 is PASS** for local workspaces.

Two limits stay explicit and are not claimed: a direct-host (remote) session's
turns are not recorded, because that workspace's Git is not reachable from this
process; and the boundary capture is spawned, so a turn that edits within its
first few milliseconds would land on the before side. Real providers take
seconds to reach a first edit, so this has not been observed.

## Codex and WebKit status — 2026-09-15

Two of the remaining gates were re-checked against the real providers today.

**V-08 — Codex review delivery: observed.** `native-review.spec.ts` with
`provider=codex` passes in Chromium (10.2s):

```text
cd e2e && npx playwright test --config=native-review.config.ts --project=chromium -g codex
                                                          1/1 PASS
```

That was V-08's last unverified provider for local delivery, so V-08's
"Codex review delivery unverified" remainder is closed for Chromium.

**V-04 — Codex extended checks: blocked on quota, not on perch.** The same
account's `native-ui.spec.ts` codex run reached the composer, sent the turn, and
the CLI itself answered:

> You've hit your usage limit. Upgrade to Pro …, visit
> https://chatgpt.com/codex/settings/usage to purchase more credits or try
> again at 4:10 AM.

Recorded as blocked rather than failed: the app did its part, the provider
refused. Re-run after the quota resets.

**WebKit is currently blocked at the browser, on this machine.** Every WebKit
run — any provider, and a bare `webkit.launch()` with no perch involved — hangs
in Playwright's "setting up page" phase until the 180s timeout. Playwright is
1.61.1 with `webkit-2311` installed. Earlier sessions ran WebKit successfully,
so this is environment drift (most likely an OS/WebKit build mismatch), not a
product regression. `npx playwright install webkit` was run and **did not fix
it** — a bare `webkit.launch()` still hangs past seven minutes. Until someone
gets WebKit launching again no WebKit evidence can be collected, and gates that
name both engines stay partial on that axis. Chromium is unaffected (every spec
in these slices runs there).

## Device pairing checkpoint — 2026-09-15

### V-10 — PASS (pairing, phone operation, reconnect, revocation)

perch's core binds `0.0.0.0`. Until now that meant anything on the same network
could drive real agents on the machine: there was no authentication anywhere in
the HTTP or WebSocket surface. V-10 asked for *secure* pairing, so the gate had
to exist before the phone flows could be called done.

**What was added**

- `crates/perch-core/src/devices.rs` — paired devices in `~/.perch/devices.json`
  (overridable with `--devices-path` / `PERCH_DEVICES`, which tests need for the
  same reason they need `--hosts-path`). Only the SHA-256 of each token is
  stored, so a stolen file cannot be replayed; revoking is deleting a row. A
  pairing code is 8 characters from a 30-symbol alphabet, lives only in memory,
  expires in five minutes, is single-use, and burns after five wrong guesses.
- `authorize_request` in `server/mod.rs` gates every data route — the WS
  upgrade, `POST {base}upload` and `POST {base}clipboard-image` (which writes
  into `~/.perch`, so it is a data route too). **Loopback is exempt**: the
  desktop shell talks to a core on `127.0.0.1` and would otherwise have to pair
  with itself. Static assets stay public; they are only the bundle.
- `GET {base}pair` answers one bit — may this caller reach the data plane —
  because a browser cannot see the status of a rejected WebSocket handshake and
  would otherwise show "reconnecting…" forever instead of a pairing screen.
  `POST {base}pair` exchanges a code for a token and sets it as a cookie, so
  the next WS handshake carries it with no client-side plumbing.
- Protocol (both files): `device.pair.start` / `device.pair.cancel` /
  `device.list` / `device.revoke`, answered by `device.pair.code` and
  `device.list.result`. A successful claim also broadcasts the list, so the
  host window showing the code sees the device appear.
- UI: `PairingGate` replaces the whole app for an unpaired device (a workspace
  behind a banner would just be dead controls), and Settings → Devices issues
  codes, counts them down and revokes access.

**Defect found and fixed: `crypto.randomUUID` is secure-context only.**
Ten call sites used it unguarded, and four modules had each grown their own
copy of a fallback guarded by `"randomUUID" in crypto` — which is *true* in an
insecure context while the property is not callable. A phone opening perch over
plain http on a LAN address therefore crashed the React tree outright
(`crypto.randomUUID is not a function`, observed in this run before the fix).
All of them now share `packages/web/src/ids.ts`, whose guard is
`typeof crypto.randomUUID === "function"` with a `getRandomValues` fallback;
the store's exported `newId` re-exports it rather than keeping a fifth copy.

### Observed result (two origins, real network path)

`e2e/device-pairing.spec.ts` (registered in `testMatch`) boots its own core and
drives *two* origins: the host window on `127.0.0.1` and a 390px "phone"
context, with its own cookie jar, on this machine's real LAN address. It skips
with a recorded reason if the machine has no non-loopback IPv4 rather than
pretending to have tested the gate.

Observed, in one run: the phone gets the pairing screen and no workspace; a
wrong code is refused; the host issues a code from Settings → Devices; the
phone pairs and the app appears; the host's device list shows "e2e phone"; the
phone starts a CLI agent, prompts it and reads the reply; scrollback survives a
phone reload; the Git pane shows the working-tree change and the file tree
lists the repo; the host is SIGKILLed and rebooted and the phone reconnects on
its stored token alone; revoking from the host sends the phone back to the
pairing screen and empties `devices.json`. Captures:
`pairing-gate-phone.png`, `pairing-phone-agent.png`, `pairing-phone-files.png`.

```text
cd e2e && npx playwright test device-pairing.spec.ts     1/1 PASS
npx playwright test workspace-review.spec.ts -g 'reads distinct|workspace start|mobile Git'
                                                         3/3 PASS
npx playwright test workspace-files-durable.spec.ts workspace-terminals.spec.ts
  workspace-recovery.spec.ts agent-terminal-ownership.spec.ts
  workspace-visual-qa.spec.ts agent-turn-review.spec.ts   all PASS
cargo test -p perch-core         263 core + 2 protocol parity PASS
cargo fmt --check / clippy       PASS / exactly the 5 baseline warnings
npm test / npm run build         222 PASS / PASS
```

`workspace-recovery.spec.ts` needed one line: with the host deliberately killed,
the client's pairing probe fails too and Chromium logs it, which is the same
deliberate-disconnect noise its WebSocket filter already ignores.

### Pre-existing failures, one shared cause

`responsive.spec.ts` R3, `pane-splitting.spec.ts` P3, `chat-power.spec.ts` P1
and `workspace-git.spec.ts` GB1 all wait for Hosted-mode chat chrome
(`model-chip`, `.chat__input textarea`). This machine's shared
`~/.perch/settings.json` has `"chatMode": "cli"`, and per CLAUDE.md there is no
`--settings-path`, so that chrome never renders and they time out. Nothing in
these slices touches chat mode. The fix is the one handoff.md §5 already
proposes: those specs should read the current mode, set `"hosted"`, and restore
the original value — not hardcode it.

### Remaining V-10 scope

Pairing is host-local by design: a federated remote manages its own devices,
and this instance's gate only consults its own store. There is no QR code yet
(the code is typed), no per-device scope (a paired device has the same access
as a local one), and no TLS — on an untrusted network the token still crosses
the wire in the clear, so the honest deployment remains a trusted LAN or an
ssh-forwarded port.

## Hibernation and resume checkpoint — 2026-09-15

### V-12 — PASS (local CLI agents)

`HibernationPolicy`, `hibernate` and `wake_cli` existed with no runtime caller,
so no agent ever slept and no attach ever woke one. That is now wired, and the
wiring exposed three genuine defects along the way.

**What was added**

- `spawn_agent_hibernation_task` (`server/mod.rs`) evaluates every live agent
  against `HibernationPolicy` and hibernates the eligible ones. The policy owns
  every safety rule — a viewer, input/resize ownership, an unfinished state, a
  missing resume identity, active typing, a mobile driver each refuse — so the
  task only supplies the clock. The window is 15 minutes, overridable with
  `PERCH_HIBERNATE_AFTER_SECS` (0 disables it).
- The attach path (`server/terminal.rs`) handles `RequiresWake` by calling
  `wake_cli_with_args`, which resumes the recorded provider session. It never
  falls back to a fresh session, so returning to a sleeping agent either
  restores that conversation or fails loudly.
- The CLI pane renders a sleeping agent as "sleeping to save memory — its
  conversation is kept" with a **Resume agent** button, instead of the
  "exited (code 0)" that a terminated pty would otherwise produce.

**Defects found and fixed**

- **A CLI agent could never leave `Working`.** A configured provider has no
  status stream at all, and a native one only reports when its own hooks fire —
  a Claude session that was started and then left alone emitted nothing further,
  so its record stayed Working forever. That broke the explicit
  working/blocked/done/idle states goals.md requires, and made hibernation
  unreachable. The idle sweep now moves a Working agent to Idle when its pty has
  been silent for 20s; a real native snapshot still overrides that instantly.
- **A hibernated or crashed CLI left its session permanently "running".** The
  idle sweep can only clear sessions whose terminal is still registered, and a
  dead one is not — so the running dot stuck, and worse, the next attach was
  refused with "a Chat turn is still running in this session". Both the exit
  listener and the hibernation task now clear it.
- Diagnosing the above showed the policy refusing on `InputOwned`/`ResizeOwned`
  from a second browser page that had silently reopened the same session. That
  one was the test's fault, not the product's — the observer client now runs in
  its own context — but it is worth knowing that any open viewer legitimately
  blocks hibernation.

### Observed result (real Claude CLI, no prompt cost beyond one short turn)

`e2e/agent-hibernation.spec.ts` (registered in `testMatch`) boots its own core
with `PERCH_HIBERNATE_AFTER_SECS=2`, starts a real Claude CLI session, sends one
short prompt so there is a conversation to resume, then closes the client:

- observed `sleeping` on the wire, with the resume identity unchanged;
- the tmux session backing the agent is gone — the process really was released;
- reopening the client resumes **the same** `providerSessionId`, the Claude TUI
  renders again, and the agent is no longer sleeping.

```text
cd e2e && npx playwright test agent-hibernation.spec.ts    1/1 PASS (41s)
npx playwright test agent-terminal-ownership.spec.ts workspace-terminals.spec.ts workspace-recovery.spec.ts
                                                           4/4 PASS
cargo test -p perch-core        261 core + 2 protocol parity PASS
cargo fmt --check / clippy      PASS / exactly the 5 baseline warnings
npm test / npm run build        222 PASS / PASS
```

`native-ui.spec.ts` (claude) fails **pre-existing and unrelated**: it asserts the
native model chip contains "haiku" and the CLI reports `claude-opus-5`. Nothing
in this slice touches model selection.

### Remaining V-12 scope

The gate is met for local CLI agents. Not covered: direct-host (remote) agents
never hibernate, because their process is not ours to terminate; Hosted-mode
turns are unaffected by design; and the window is a constant plus an env
override rather than a setting, which is called out with a `ponytail:` note.

## Pane-width responsiveness checkpoint — 2026-09-15

### V-11 — the narrow-pane defect is fixed and now has a guard

The open V-11 defect was pane-width responsiveness: dockview can hand a pane a
narrow width while the window is wide, so viewport media queries never fire.
Observed at a 900px window with three panes (`screenshots-visual-qa/`, local
only): the Files pane's content had a ~490px floor inside a 218px pane, so
Reload/Save/search were clipped away entirely, and at phone width the Git
pane's file rail rendered *behind* the diff.

Both were the same root cause, and both are fixed at the stylesheet rather
than per-component:

- The file pane's collapse rules were viewport-keyed; they are now
  `@container` rules on `.workspace-files` (which declares
  `container-type: inline-size`) at **460px** — the width where the 230px tree
  rail stops leaving a usable editor. A 600px desktop pane therefore keeps
  both columns; a 218px pane switches to one column with the existing
  "‹ Explorer" toggle, which was previously phone-only.
- The Git pane had *both* the viewport rules (file rail as a horizontal strip)
  and the container rules (file rail as a narrow vertical column) applying at
  phone width, in conflict. The viewport rules are now container rules too, and
  the five that duplicated the container block in a conflicting form were
  deleted. One behaviour, roughly 30 fewer lines of CSS.
- `.workspace-files__editor-actions` now takes its own bounded line; left to
  size itself it kept its content width and the Save button was clipped.

### Guard

`e2e/workspace-visual-qa.spec.ts` (registered in `testMatch`) populates a real
repository, then measures **against each pane's own box, not the window's**:
every visible control outside a scroll container must sit inside its pane, and
no surface may make the page scroll sideways. It checks the Git review pane and
the file pane at a narrow desktop pane width (900px window, three panes) and at
390px, and exercises the review action at the narrow width rather than only
measuring boxes. Screenshots land in `e2e/screenshots-visual-qa/` (gitignored,
they carry real paths) to be looked at, not only asserted on.

```text
cd e2e && npx playwright test workspace-visual-qa.spec.ts          1/1 PASS
npx playwright test workspace-files-durable.spec.ts               1/1 PASS
npx playwright test workspace-review.spec.ts -g 'reads distinct|workspace start|mobile Git'
                                                                  3/3 PASS
npx playwright test workspace-recovery.spec.ts workspace-terminals.spec.ts
                                                                  3/3 PASS
npm test                                                          222 PASS
```

`workspace-files-durable.spec.ts` needed one change, not a workaround: after a
reload restores a draft the pane opens on the editor, so the spec now reopens
the tree through the real "‹ Explorer" control before walking it.

`responsive.spec.ts` R3 fails **pre-existing** — it waits for `model-chip`,
Hosted-mode chat chrome that does not render while the shared
`~/.perch/settings.json` is in CLI mode (handoff.md §5). No selector this slice
touched is involved.

### Remaining V-11 scope

V-11 stays **PARTIAL**: the terminal, chat and settings surfaces have not been
through the same populated narrow-pane pass, and focus/loading/error/empty
states are still only covered incidentally. The new spec is the place to add
them.

## Last-agent-turn review checkpoint — 2026-09-14

### V-07 — agent-turn history now exists and is reviewable

The `agent_change_snapshots` table and its idempotent begin/finish pair had no
runtime caller. `server/agent_history.rs` is that caller. It records one
durable before/after boundary per agent turn and the Git surface offers it as
a diff base ("Last agent turn"), so the gate's remaining implementation piece
— the current agent's last-turn changes — is now real product behavior.

Four decisions worth keeping:

- **The hook is the session's running flag, not the prompt dispatch path.** A
  native turn can begin from the structured UI, from a review packet, or from
  the user typing into the CLI pty; only the first two reserve a prompt
  operation. All three move the session through `running_sessions` and
  therefore through `notify_session_updated`, which is where the transition is
  observed (detected inside `agent_history`, not at the ~8 mutation sites).
- **Both boundaries are content commits, not HEADs.** Agents mostly do not
  commit, so a HEAD-to-HEAD boundary would report an empty turn for exactly
  the work a user wants to review. `GitService::content_snapshot` stages the
  index + worktree + untracked-but-not-ignored files into a scratch index
  (`GIT_INDEX_FILE`) and writes a dangling `commit-tree`: no ref, no index and
  no worktree mutation. The commit is unreferenced, so `git gc` prunes it
  after `gc.pruneExpire`; that ceiling and its upgrade path are marked with a
  `ponytail:` comment.
- **Configured CLI providers had no working/idle signal at all.** The runtime
  adapter owns a second terminal registry (keyed by `agent_runtime::
  terminal_key`) whose activity callback was a no-op, so any provider outside
  the native-UI set never reported running, never went idle, and produced no
  turn boundary. That callback now resolves the key back to its session and
  runs the same bookkeeping as the shared-terminal path, and the idle sweep
  sweeps both registries. This closes a real gap against goals.md's explicit
  working/blocked/done/idle requirement, not only against V-07.
- **Untracked files are no longer synthesized into two-endpoint diffs.**
  `GitService::diff` added working-tree untracked files to every target except
  `Staged`. A `compare` with an explicit head therefore attributed whatever
  was lying around the workspace to that comparison, and listed a file twice
  when the endpoint already contained it. Both were visible in the first run
  of the new browser test.

### Observed result (real browser, real CLI process)

`e2e/agent-turn-review.spec.ts` (registered in `testMatch`) boots its own core
on a free port with its own database and providers file, registers a real
repository, starts a configured CLI provider in it, drives one real turn
through the pty, and then reviews that turn from the Git surface:

- the provider process is a `/bin/sh` fixture (the `provider-config.spec.ts`
  pattern) that edits a tracked file and creates an untracked one per prompt.
  Everything the boundary depends on is real — a pty-owned process, the
  running/idle transitions it produces, Git, SQLite and the browser. The
  agent's *text* is the only fixture, and it is not what V-07 is about; the
  real-provider review-delivery gate is V-08 and is tracked separately.
- observed: "Last agent turn (turnbot)" becomes selectable after the turn
  closes; the diff shows `− BEFORE_TURN` / `+ AGENT_EDIT alpha` and the added
  `AGENT_NEW alpha` file; a file written by a human *after* the turn does not
  appear in it, and does appear under Working tree. After a page reload the
  same boundary is still selectable and still shows the same content.
- capture: `agent-turn-desktop.png` in the spec's artifacts directory.

```text
cd e2e && npx playwright test agent-turn-review.spec.ts   1/1 PASS (3.7s)
npx playwright test workspace-review.spec.ts              3/4 PASS
npx playwright test workspace-git.spec.ts                 0/1
cargo test -p perch-core        261 core + 2 protocol parity PASS
cargo fmt --check               PASS
cargo clippy --workspace --all-targets   exactly the 5 baseline warnings
npm run build / npm test        PASS / 222 web tests PASS
```

Two of those e2e failures are **pre-existing and unrelated to this slice**,
both the stale-Hosted-seed shape handoff.md §2 already recorded for
`worktrees.spec.ts`:

- `workspace-git.spec.ts` GB1 seeds a session by typing into the Hosted
  `.chat__input textarea`, but every "New session" launcher now creates a
  CLI-owned session, so that composer never appears and the seed times out at
  120s. Same fix as `worktrees.spec.ts`: the seed is redundant, delete it.
- `workspace-review.spec.ts`'s "sends two reviewed anchors … to the selected
  real agent" needs a live provider session in its dropdown; it is the
  real-provider delivery test the previous handoff explicitly did not run.

### Remaining V-07 scope

V-07 stays **PARTIAL**. What remains is narrower than before:

- an implicit session-created workspace still has no recorded creation ref
  (only explicit registration and worktree discovery record one);
- turn boundaries only exist for local workspaces — a direct-host session's
  turns are not recorded, because Git for that workspace is not reachable
  from this process;
- a turn that begins before the boundary capture finishes (the capture is
  spawned, a few bounded Git commands) would attribute those first
  milliseconds of edits to the turn's *before* side. Real providers take
  seconds to reach their first edit, so this has not been observed, but it is
  a real ordering ceiling rather than a proof;
- the full "change summary" the gate names (counts/narrative across a turn)
  is stored (`changed_paths`, bounded status JSON) but is not rendered beyond
  the diff itself.

## Workspace-start comparison checkpoint — 2026-09-14

New explicit project registration records its Git HEAD before acknowledgement;
existing workspace refs remain immutable. The Git view offers Workspace start
through the existing compare/anchor path, including mobile. The real Chromium
flow verifies an intervening commit, untracked content, an anchored note and
reload. Three focused Git/review browser checks pass, as do 260 core tests,
two protocol tests, 222 web tests, production build and formatting; Clippy has
only its five baseline warnings. V-07 remains PARTIAL: agent-turn history and
creation-boundary coverage for implicit/legacy workspaces remain unfinished.
See the latest section of handoff.md for changed files, artifacts and next work.


Status: in progress. The complete contract remains `goals.md` and `SPEC.md`.
No acceptance exception has been approved. No rework phase is complete yet.

## Combined file workflow and mixed-recovery checkpoint — 2026-09-14

### V-05 — PASS

`workspace-files-durable.spec.ts` already covered the tree/draft/conflict half.
The gate's missing piece was the *combined* edit → save → **status** path, so the
fixture is now a real repository with the sentinel committed, and the spec asserts
after the save that the Git surface reports the change: `1 changed path`,
`modified src/main.txt` in `git-status`, exactly one `git-diff-file` row for that
path labelled `modified`, and a diff body containing the saved text. Capture:
`files-durable-status.png` (status rail, `− initial sentinel` / `+ saved sentinel`,
Dirty badge). The spec then returns to the editor and finishes the existing
external-conflict flow, so one run now spans nested tree expansion, open, edit,
save, on-disk bytes, Git status/diff, reload, conflict compare/keep/discard, and
the phone-width file surface.

Two defects had to be fixed first; both reproduce on a clean `HEAD`, so neither
came from the worktree work:

1. **"Files" was unclickable wherever a workspace row rendered.** `Files` and
   `Git` both carry `.workspace-entry__files`, which was `position: absolute`
   at `right/bottom: 0.3rem` — so the two buttons stacked in the same corner and
   the later `Git` button covered `Files` completely. Playwright reported it as
   `workspace-entry__git intercepts pointer events`; a user clicking Files would
   simply get Git. Fixed by wrapping both in one anchored `.workspace-entry__actions`
   flex row and dropping the per-button absolute positioning.
2. **The mobile assertions were stale.** The spec resized to 390px and expected
   the desktop editor to still be mounted, but the mobile shell mounts exactly one
   surface (responsive.spec.ts R2b) and opens on Chat. The spec now drives the real
   switcher — `mobile-pane-files`, then walks the nested tree to the file, since
   the mobile surface opens on the Explorer half with no selection.

### V-09 — PASS, mixed recovery correction (2026-09-14)

The crash was in `NoSessionPanel`, mounted during disconnect when `sessionId`
becomes null while the session list remains populated. Its Zustand selector
called `effectiveActiveProject`, whose fallback creates a fresh object on each
read. The selector now returns only the path it consumes. Other helper callers
already derive their results outside store subscriptions; no shared navigation
semantics or terminal/layout behavior needed changing.

The original production repro failed before the fix and passed afterwards.
`workspace-recovery.spec.ts` now also waits for the visible disconnected
"Connecting" panel before restarting, checks for React errors at that boundary,
and compares the complete pane-tab ID set before/after recovery. It retains the
original SIGKILL → reboot → reload sequence without an intervening control
reload. WebKit's expected socket error during the intentional kill is excluded
only for this fixture's WebSocket URL and restart interval; all application
errors remain failures. Cleanup now reaps both the shell and configured CLI
that the isolated core launched.

Observed on macOS, production bundle, headless Chromium and WebKit (Retina):
register project; create/open linked checkout; open shell and set a variable;
edit a primary-checkout file without saving; cause an external conflict; add an
anchored comment; kill core; see Connecting; reboot and reload. The same project
and both checkouts, session ID, pane IDs, shell terminal ID and PID/variable,
unsaved draft, conflict banner, and anchored comment all recover. Together with
the provider-specific recovery checks below, this closes V-09.

```text
npm run build                         # pass; production bundle restored
npm test                              # 222 passed
cd e2e && npx playwright test workspace-recovery.spec.ts  # 1 passed
npx playwright test --config=cli-rendering.config.ts workspace-recovery.spec.ts --repeat-each=3
                                      # 6/6, three per engine
```

Artifacts: `e2e/artifacts-cli-rendering/workspace-recovery-mixed-w-d28fd-s-recover-after-a-core-kill-{webkit,chromium}/recovery-{before-kill,after-restart}.png`.
Both recovery captures were inspected: all four panes are restored and the
shell shows identical before/after PID. The narrow split editor/Git surfaces
still clip controls; that remains a V-11 defect, not visual completion.
Retained private copies: `e2e/screenshots-cli-rendering/{webkit,chromium}/mixed-recovery/recovery-{before-kill,after-restart}.png`.

## Isolated worktree checkpoint — 2026-09-14

V-02 is now exercised end to end in a real browser. `worktrees.spec.ts` gained
**WT6**, which creates two checkouts (`wt-alpha`, `wt-beta`) from one fixture
repo and asserts every axis SPEC.md V-02 names:

- **Paths/branches** — distinct default locations under
  `~/.perch/worktrees/<repo>/<branch>`, confirmed against
  `git rev-parse --abbrev-ref HEAD` in each checkout.
- **One project** — exactly one workspace-project card matches the fixture, and
  it carries one `.workspace-entry` per branch. This is the acceptance for
  `server/workspace.rs::register_worktree_listing`: before it, `worktree.create`
  registered nothing, and creating a session inside a checkout minted a *second*
  standalone project at the checkout path.
- **Sessions** — opening each checkout yields different session ids.
- **Tabs** — the tab strip is scoped to the active workspace. Standing in
  `wt-beta`, only beta's tab exists; navigating to `wt-alpha`'s workspace row
  swaps both the strip and the resolved cwd. The two checkouts never share a
  strip.
- **File changes** — a `sentinel.txt` written into `wt-alpha` is absent from
  `wt-beta` and leaves the primary checkout's `README.md` untouched; only
  `wt-alpha`'s row shows the dirty badge on the next listing.

Capture: `e2e/artifacts/worktrees-wt6-two-worktrees.png` — one project card
holding `main` (primary), `wt-alpha` (dirty), `wt-beta`, each with its own
sessions, and the worktree popover showing the same three rows.

Three defects were fixed to get there, all of them pre-existing and none
introduced by the worktree registration work (confirmed by re-running against a
stashed tree):

1. **The spec was stale against the native-UI session model.** Its seed step
   typed into the Hosted `.chat__input textarea`, but every "New session"
   launcher now passes an explicit `mode: "cli"`, and a CLI-owned session
   renders `native-cli-chat` instead. The seed hung until the 120 s timeout. It
   was also redundant — `cli_activity` alone satisfies db.rs's
   `SESSION_VISIBILITY_FILTER` — so it was removed rather than ported, which
   also drops a real agent turn from the spec.
2. **No worktree affordance on a clean database.** The branch glyph hangs off a
   project card, and a project row is minted only lazily by a session that has
   produced a message or CLI activity, so a first run found no menu at all. The
   spec now registers the folder through the rail's own "+ Add" flow first.
3. **The menu helper was not idempotent.** The glyph toggles, so re-opening an
   already-open popover closed it.

Commands (headless, background, no focused window):

```text
cargo test -p perch-core        # 260 passed + 2 protocol parity
cargo fmt --check               # clean
cargo clippy --workspace --all-targets   # the 5 baseline warnings, no new ones
npm run build
cd e2e && npx playwright test worktrees.spec.ts   # 6/6
```

The suite passes both from a wiped `/tmp/perch-e2e-hub.sqlite` and on a warm
one (13.8 s each), so registration is idempotent across runs.

Open on this gate: a duplicate-testid window exists while a project is
unregistered — `Sidebar.tsx`'s `ProjectWorktrees` suppresses its own menu only
once the project appears in `workspaceProjects`, so both it and
`WorkspaceOverview`'s copy can render `worktree-menu-local-<cwd>` at the same
time. Harmless to users, ambiguous to tests. V-02's recovery half (restart the
host and confirm both checkouts come back separate) is **not** covered by WT6
and remains part of V-09.

## Claude native UI checkpoint — 2026-09-13

Claude Code 2.1.270 now participates through its native hook and transcript
interfaces. `native_ui/claude.rs` adds per-session hooks, keeps bounded private
event files, and follows the native JSONL parent chain. It reads at most 2 MiB
of recent JSONL and retains at most 128 normalized messages / 192 KiB. Hidden
metadata, attachment payloads, and thinking signatures stay out of the web
view. Unchanged native data produces no repeated transcript serialization or
snapshot push. No additional provider process or model loop is launched.

The existing input authority now supplies a guarded terminal writer alongside
the durable dispatch closure. Claude prompt/cancel input verifies the actual
active pane's PID; prompt submission also requires the native empty editor.
This preserves unfinished CLI drafts and refuses dialogs rather than typing
into them. The tmux guard discovers pane identity and supports the host's
nonzero window numbering. Native UserPromptSubmit hooks acknowledge receipt;
uncertain journal operations are never automatically replayed. Review packets
reuse this same input and settlement path. The native session ID updates both
the live handle and persisted Claude continuation. Provider manifests now
control native UI routing and pane badges, including after reload.

Real headless Chromium and WebKit checks verified:

1. A UI prompt reads a unique sentinel with Claude's file tool; the native
   assistant/tool result appears in Perch.
2. A CLI draft survives an attempted UI send. The UI reports the refusal and
   retains its own draft. After explicitly clearing the fixture CLI draft,
   a CLI-typed follow-up recalls the same sentinel in the shared conversation.
3. Core SIGKILL/restart and browser reload preserve the native PID, session
   UUID, and conversation. No additional prompt is sent during recovery.
4. A separate 390 × 844 phone browser observes, takes control after release,
   sends a third prompt, and cancels a fourth turn's native bash `sleep 20`.
   Both views return to Ready within the 10-second check.
5. Two anchored Git notes are sent from a phone. Another browser's ownership
   initially prevents delivery. After release, native receipt and assistant
   acknowledgement arrive. Retrying the same packet yields a correlated
   delivered response with one operation ID and one native copy.

The Git fixture exposed Claude's own workspace-trust dialog. Tests approve
only their disposable workspace through that CLI dialog. Inspection of the
installed 2.1.270 CLI established its 150 ms input cooldown and selection
remount; the test waits 300 ms before selecting Yes, then verifies that row
before Enter. This resolved the intermittent early-confirmation refusal in
six consecutive runs (three per engine). An independent shared title-parser
fix consumes SS3 application-mode arrows across WebSocket frames, preventing
the arrow's final `B` from becoming a session title. Its focused check passes.
Perch's unavailable-UI message now directs the
user to finish startup prompts in CLI view. One initial default-model run
refused the harmless cancellation fixture; final Claude tests use a
process-local `ANTHROPIC_MODEL=claude-haiku-4-5`. An initial `/model` probe
changed the user's native default; it was restored from the existing backup.
The final tests avoid that persistent command and the restored default was
checked afterwards. Test configurations run sequentially because concurrent
Playwright discovery can race another configuration's artifact cleanup.

Validation: 255 core tests plus two protocol tests, 222 web tests, production
build, formatting, and Clippy with the five existing warnings pass. Final
Claude UI checks pass in both engines (33.8 seconds); the final repeated Claude
review checks pass six cases (1 minute). The earlier review regression passed
all four Pi/OMP cases but exposed the Claude cooldown failure fixed above. Pi/OMP
UI/recovery/cancel checks also passed in both engines during this slice.
Private populated phone UI and review-delivery screenshots were inspected;
the transcript, ownership controls, packet, and delivery state are visible.
No page errors occurred in the passing runs.

Logs: `/tmp/perch-claude-native-core-verified.log`,
`/tmp/perch-claude-native-web-tests.log`, `/tmp/perch-claude-native-build.log`,
`/tmp/perch-claude-native-ui-verified.log`, and
`/tmp/perch-claude-native-review-verified.log`,
`/tmp/perch-claude-review-cooldown-verified.log`,
`/tmp/perch-claude-title-check.log`, and
`/tmp/perch-claude-native-clippy-final.log`. Private captures are
`.impeccable/review/native-ui-claude-{chromium,webkit}.png`,
`native-ui-claude-mobile-{chromium,webkit}.png`, and
`native-review-claude-{desktop,mobile}-{chromium,webkit}.png`.

Limits: the input guard recognizes the observed Claude TUI and refuses an
unfamiliar layout. Startup and approval dialogs require CLI view. UI model
selection, attachments, complete queue behavior, native Codex/OpenCode
adapters, legacy Hosted retirement, paired remote access, and the remaining
SPEC gates are still unfinished. These local phone tests do not prove secure
pairing or remote transport. The full goal remains active.

## Native review delivery checkpoint — 2026-09-12

Pi/OMP packets now use the same native connection as the composer. The target
resolver selects the session's CLI owner before legacy message history and
rejects a different requested provider. A Git view borrows input only when no
other browser owns it; enqueue validates the existing lease generation, then
releases a borrowed lease. The existing atomic prompt/packet settlement writes
uncertainty before enqueue and delivery after native acceptance. Retries reuse
the frozen operation and cannot replay its prompt. Unsupported native providers
are rejected during preview, before creating an unusable packet.

`cd e2e && npx playwright test --config=native-review.config.ts` passed all four
real Pi/OMP cases in headless Chromium and WebKit (43.7 seconds). Each case:

1. Registers a disposable Git workspace, opens the native CLI, and sends a
   real initial prompt from UI mode.
2. Adds two line-anchored comments and previews them in a separate 390 × 844
   phone browser. The session picker identifies the native provider.
3. Attempts delivery while the desktop owns input, observes the refusal, and
   confirms no prompt reached the native conversation.
4. Releases desktop control, sends the packet from the phone, and observes
   the CLI acknowledge both notes in the desktop conversation.
5. Retries the same packet and waits for a correlated server receipt. All
   attempts retain one packet/operation ID, and the native user count stays
   at two: the initial prompt and one review packet.
6. Confirms unchanged native PID/session and source bytes, then reacquires
   desktop input, proving the Git view released its temporary control.

Screenshot review covered the populated phone packet/delivery view and desktop
native conversation alongside the diff. Private captures are under
`.impeccable/review/native-review-{pi,omp}-{mobile,desktop}-{chromium,webkit}.png`.
The phone session selector needed an explicit accessible name; this was fixed
at the shared select and the interaction rerun successfully. No page errors
occurred. Tests clean up only their own core, native tmux session, and workspace.

Validation: 254 core tests plus two protocol tests, 222 web tests, production
build, formatting, and Clippy with the five existing warnings passed. Logs:
`/tmp/perch-native-review-final-core.log`,
`/tmp/perch-native-review-web-tests.log`, `/tmp/perch-native-review-build.log`,
`/tmp/perch-native-review-final-clippy.log`, and
`/tmp/perch-native-review-browser-final.log`.

V-08 remains partial across the complete provider requirement: native Pi/OMP
and the Claude/Codex bridge paths are implemented, while complete Codex review
delivery and real OpenCode provider acceptance remain unverified. This
loopback phone check does not establish secure pairing or remote delivery.

## Native Pi/OMP UI checkpoint — 2026-09-12

Implemented directly in the moved checkout after reading `refactor_logs.md`;
no agents were spawned. Testing ran entirely in headless browsers.

`native_ui/pi-extension.ts` loads into the actual interactive Pi/OMP process.
Native session entries and message events supply the transcript, and native
`sendUserMessage`/`abort` APIs control it. Rust validates the existing terminal
input lease, journals each operation before enqueueing, and preserves uncertain
delivery across disconnect. Native receipts deduplicate an operation within
the CLI. History/frame/command/client limits are explicit; streaming no longer
rescans every old turn. Native hidden custom messages are excluded, matching
the CLI's display flag. The bridge does not read or export provider authentication files or environment.

The live continuation capture originally changed only lifecycle state, which
made Pi reattach fail. It now updates the live runtime handle under the same
operation lock. OMP's native follow-up delivery option queued an idle prompt;
the bridge now uses normal prompt flow when idle and follow-up while running.
Native status prevents a terminal repaint from falsely changing Done to
Working. UI mode displays the correct provider and preserves composer drafts
across view changes; stopped CLIs disable the composer.

Observed real interaction for each provider in Chromium and WebKit:

1. Start the installed CLI through Perch's workspace picker.
2. Switch to UI and read a unique sentinel using the provider's real file tool.
   Inspect its native tool call, result, and assistant response in the web view.
3. Switch to CLI, run `/reload`, then type a follow-up that recalls the token.
   Pi reloads its extension and reconnects the bridge. OMP's built-in command
   reports `Plugins reloaded.` and retains CLI extensions. Both preserve the
   native conversation and accept the next turn.
4. Switch repeatedly while preserving an unsent UI draft.
5. Kill only the fixture Perch core with SIGKILL, restart against the same
   isolated DB, and reload the browser. The native PID, native session file,
   conversation, and logical agent key remain identical. The PTY attachment
   ID is allowed to change when the core recreates its transport.
6. Connect a separate 390 × 844 browser to that session. Its composer is
   disabled while the desktop owns input. Release desktop control, take it on
   the phone, and send a third real prompt. Both views show the same native
   response. Release phone control and regain it on desktop.
7. Start a fourth native turn calling bash with `sleep 20`; cancel it through
   the phone's Cancel turn button. Both native UI views return to Ready
   within the 10-second assertion window, without the requested final reply.
8. Confirm no page errors or horizontal overflow and explicitly stop the
   fixture CLI. Cleanup addresses only fixture-owned tmux sessions.

Validation:

- `cargo test -p perch-core`: 253 core tests plus two protocol tests passed.
  The workspace suite also passed before adding the final viewer-scope test.
- `cargo clippy --workspace --all-targets`: five existing warnings; no new
  warning. Formatting and production TypeScript/Vite build passed.
- `npm test -w @perch/web`: 222 tests passed. Added coverage includes native
  hidden messages, bounded tool data, duplicate dispatch, session-scoped
  subscriptions, wrong-session acknowledgements, and no reconnect resend.
- Rust bridge tests cover partial frames interrupted by cancellation, frame
  size rejection, disconnect without replay, subsequent controls after
  reconnect, continuation capture, and stale input-lease rejection.
- `cd e2e && npx playwright test --config=native-ui.config.ts`: four real
  Pi/OMP tests passed in Chromium/WebKit, including phone control/prompt and
  native turn cancellation (final run: 1.4 minutes).
- `cd e2e && npx playwright test --config=provider-config.config.ts`: all four
  native/configured-provider catalog and persistent-pane regressions passed.
  Final captures are `.impeccable/review/native-ui-{pi,omp}-{chromium,webkit}.png`
  and `native-ui-{pi,omp}-mobile-{chromium,webkit}.png`. They remain private.

Logs are in `/tmp/perch-native-ui-{core-final,workspace-tests,clippy,web-final,build}.log`
and `/tmp/perch-native-ui-cancel-verified.log`; the catalog regression log is
`/tmp/perch-native-ui-catalog-regression.log`. Private browser artifacts are
under `e2e/artifacts-native-ui/`. Screenshot review identified hidden custom
messages being shown; the display-flag fix passed its focused test and the
real-browser rerun. The final populated phone screenshot was inspected with
native conversation visible, controls reachable, and no hidden instructions.

Limits: only Pi/OMP have this native UI bridge. Claude/Codex/OpenCode still
need their own native history/control adapters, and the separate local Hosted
path remains to be retired. Attachments/model/approval
controls, queued-message interactions, paired remote access,
hibernation, and full resource measurements are not established by these
checks. V-04 remains partial and V-10 remains unverified; no full goal or ADE
phase is complete.

## Orca catalog and launch checkpoint — 2026-09-11

Read the complete `refactor_logs.md` before resuming in
`/Users/hwiii/Github/perch`. The refactored baseline passed 248 core tests plus
two protocol tests, 216 web tests, build, typecheck, formatting, and Clippy
with five existing warnings. Work continued directly, without new agents.

The 36-entry Orca catalog now supplies the runtime's native registry. The
availability response and actual process launch share the executable/alias
resolver. Host SQLite preferences persist enabled/default state; revisioned
snapshots update every client and prevent an older refresh from undoing a
newer preference. Disabled agents disappear from launch choices, while their
existing sessions remain attachable. Settings → Agents groups installed and
available-to-install entries, shows the public command, supports search and
Refresh, and links official install/docs pages. Install is a documentation
link, as in the adapted Orca UI, not an automatic package installation.

The CLI start screen, sidebar/tab-bar picker, and command palette share the
installed/enabled provider choices. Native OMP and Pi ran in separate
sessions in the same workspace: OMP started through the CLI start screen,
Pi through the sidebar picker. Their drafts stayed isolated, the Pi pane
retained its draft through split and reload, and both terminal identities
remained unchanged. The command palette listed both agents and opened a plain
shell whose `PWD` matched the workspace. Processes were stopped explicitly
and test cleanup addressed only fixture-owned tmux names.

The first native rerun confirmed the Pi layout repair but exposed xterm 5.5's
uncancelled viewport callbacks after disposal. A narrowly scoped compatibility
guard now prevents those callbacks touching a destroyed renderer; terminals
still dispose immediately. The wider regression suite then caught an initial
launch setting a redundant session CLI override. Launch now first resolves
the new session's inherited mode and adds an override only when necessary,
preserving device-mode control on the phone.

Validation and evidence:

- `cargo test --workspace`: 249 core tests + two protocol tests passed.
- `cargo clippy --workspace --all-targets`: the same five baseline warnings.
- `cargo fmt --check`, TypeScript check, `npm run build`: passed.
- `npx vitest run --root packages/web`: 218 passed, including stale catalog
  snapshots and inherited launch mode. The Rust preference test reopens the
  database and checks that the default remains unique and enabled.
- `cd e2e && npx playwright test --config=provider-config.config.ts`: four
  tests passed in Chromium/WebKit, covering the 36 built-ins plus three
  configured test fixtures, installed/available grouping, enable/disable,
  cross-device default updates, search, mobile layout, environment isolation,
  native OMP/Pi panes, command-palette shell launch, and reload persistence.
- `npx playwright test --config=cli-rendering.config.ts`: ten terminal/grid/
  crash-recovery checks passed; two ownership checks exposed the redundant
  mode override. After the fix, rerunning `agent-terminal-ownership.spec.ts`
  with that config passed both engines, followed by all four catalog tests.
- Reviewed wide/narrow screenshots in the private ignored directory
  `.impeccable/review/agent-catalog-{desktop,mobile}-{chromium,webkit}.png`.
  The catalog was widened for readable desktop commands; mobile controls wrap
  and remain usable at 390px. Native pane screenshots are
  `.impeccable/review/native-omp-pi-split-{chromium,webkit}.png`.
- Impeccable detection found no new component findings. Its one CSS finding
  is the pre-existing 3px side-tab border, outside this change.

V-03 is now observed with real OMP and Pi, not only test programs. The catalog
does not prove all 36 external CLIs authenticated and completed turns.
OpenCode is offered for installation when absent. Claude Agent Teams uses
Claude's native in-process mode, not Orca's app-specific pane wrapper.
V-04 remains incomplete: the separate Hosted runner still needs replacement
with a structured view/control connection to the live CLI. Full worktree,
pairing, agent snapshots, hibernation, and resource-budget gates remain open.

## Configured CLI checkpoint — 2026-09-11

Provider manifests load from the default or an explicit configuration file;
the CLI picker uses host discovery, persists the selected provider with the
session, and survives reload before the first keystroke. Environment policies
apply inside the actual tmux-owned child through a private bootstrap. The
real two-process runtime fixture verifies allowed/set/unset variables and
isolated input. Files and environment launch data are bounded.

Completed checks: `cargo test --workspace` (247 core tests and two protocol
tests), `npm test` (216 tests), `npm run build`, formatting, and workspace
Clippy with the five existing warnings. The final isolated browser command
`cd e2e && npx playwright test --config=provider-config.config.ts` passed in
Chromium and WebKit. It exercised desktop and 390px mobile provider selection,
disabled unavailable providers, literal environment values, two separate
provider terminals in one workspace, input isolation, reload before input,
reload after input, exact process/terminal continuity, and explicit stop.
Private screenshots under `.impeccable/review/provider-*` were reviewed;
the final run also verifies the custom-provider badge and clean session title.
The earlier headless WebKit page-creation failure no longer reproduced.

Alpha/Beta in this suite are test programs only. Per the user's clarification,
the shipping provider set is Claude Code, Codex, OMP, Pi, OpenCode, and ordinary
terminals. UI must view and control the same CLI-owned session. The existing
separate Hosted runner and CLI-active send refusal remain migration defects;
these fixture results do not prove V-03 or V-04 for the required real providers.
The native catalog and native event/control connections are in progress.

## Local agent runtime checkpoint — 2026-09-11

Implemented directly, without new agents. Local Claude/Codex CLI panes now
open through the provider/lifecycle adapter. Process identity includes the
workspace, session, and provider; the host retains its output and lifecycle
observer when the last browser view leaves. Request-correlated open/release
messages carry up to 128 KiB of replay, with the opened reply queued under the
same output lock as the snapshot. The client subscribes before live output,
suppresses historical terminal/clipboard responses, and releases late opens.

The visible **Take control**, **Release control**, and **Stop CLI** actions use
connection-owned input/resize leases. Input includes the exact generation;
a different connection cannot write by guessing a terminal id. Control replies
carry lifecycle revisions so stale pushes cannot erase a newly acquired lease.
A failed initial attach has a visible **Retry CLI** action. A bounded periodic
checkpoint persists changed lifecycle state independently of browser viewers. Session deletion stops its concrete processes and frees
lifecycle capacity. Existing legacy processes are detected before a second
provider is launched. A reconnect with neither a live process nor a provider
continuation is refused rather than silently creating a fresh conversation.

Current evidence:

- The two-viewer real-Claude test passed in Chromium and WebKit: the phone
  observed the desktop's terminal and unsubmitted draft; unrelated raw input
  was refused; visible release/take actions transferred authority; phone input
  appeared on desktop; mobile pane changes and reload retained the same
  terminal id and draft; explicit stop showed exit on both clients.
- Reviewed `.impeccable/review/agent-{desktop,mobile}-{chromium,webkit}.png`.
  Mobile has no page overflow and both control actions meet the 44 CSS px
  minimum. These are browser-engine checks, not native desktop acceptance.
- Workspace tests passed 240 core tests and both protocol checks. The runtime
  fixture exercises two real isolated processes under one Perch session,
  rejects stale leases, retains host tracking with zero viewers, and deletes
  one runtime without stopping the other. The desktop target compiles.
- 216 web tests in 17 files and the shared/web build passed. New regressions
  cover reversed provider replies, immediate live output, late opens after
  unmount, and stale lifecycle pushes after a new control lease.
- The complete terminal configuration passed all 12 WebKit/Chromium cases
  before the final recovery guard. The latest Chromium rerun passed all six
  cases, with the ownership test expanded to independent device profiles and
  a visible Chat/CLI round trip that preserves the terminal id and draft.
  The final WebKit rerun failed while setting up Playwright's `page`, before
  executing Perch interactions. Two independent headless WebKit probes also
  failed to create a page; the equivalent Chromium probe succeeded. No
  foreground recovery was attempted. A final WebKit rerun remains pending.
  Formatting and workspace Clippy pass with the same five existing warnings.

Remaining scope is explicit. This does not complete V-03/V-04/V-09/V-10/V-12:
custom manifests are not yet loaded by boot/UI; the browser test uses one real
provider; new Codex CLI thread capture and native-provider core-crash recovery
remain unverified; remote provider multicast and secure pairing are not wired;
full lifecycle status detection and safe automatic hibernation remain open.
Switching views and changing the phone's device mode preserve the process,
but sending a Chat turn while that CLI
is alive is currently refused to prevent a duplicate runner. Seamless Chat/CLI
prompt delivery and transcript synchronization still need implementation.
The full main e2e suite has not been rerun for this checkpoint.

## Persistent shell checkpoint — 2026-09-10

Implemented directly after the user's no-more-agents instruction. Plain shell
panes now use database-owned identities scoped to a session and its actual
workspace path. A host-wide Rust registry owns the process independently of
browser mounts; closing a view releases its subscription. The explicit
**Close shell** action terminates the process and updates every attached view.
Deleting the owning session closes its shells under the same spawn lock.

The request-correlated `terminal.open/list/release/close` protocol carries a
stable pane identity and bounded replay. The registry limits persisted shells
to 64, viewers to 32 per shell, and replay to 128 KiB per shell. Missing process
or tmux backends become visibly unavailable; recovery never silently launches
a replacement command. Existing shells are selectable on desktop and mobile;
desktop selections persist in Dockview parameters. Legacy peers retain the
older terminal path. Persistent shell federation remains explicitly unavailable
until remote multicast subscriptions are implemented.

Actual headless testing caught integration defects and drove fixes:
historical terminal queries were being answered again during replay, polluting
the running shell's input, and explicit close removed subscriptions before the
child waiter could notify other devices. Replay now disables input until the
parser finishes and suppresses historical OSC 52 clipboard writes; close sends
its exit notification before removing subscribers. A separate startup race
left layout restoration and saving inactive when the reply arrived before
Dockview readiness; readiness now triggers application of the pending layout.

Verified directly:

- `workspace-terminals.spec.ts` passed all four WebKit/Chromium cases. A shell
  retained its terminal id, process PID, and shell-local variable across browser
  reload and mobile pane unmount/remount. A second shell did not inherit the
  variable. Closing that shell on the phone updated the desktop's visible exit
  state. Mobile mounted one terminal surface with no horizontal overflow and
  44 CSS px action targets.
- The restart case starts a separate core with a temporary database, kills that
  exact core process, restarts it, and proves the tmux-backed shell retains the
  same terminal id, session id, PID, and variable. Fixture shells and processes
  are explicitly removed afterward.
- `cargo test --workspace`: 238 core unit tests and both protocol parity tests
  passed; the desktop target compiled and has no unit tests. This is not a
  native desktop UI acceptance result.
- `npm test`: 213 tests passed in 16 files, including reversed terminal reply
  ordering, immediate output delivery, unmount-before-open, late replies after
  timeout, and repeated listener cleanup after another view has reattached.
  A Dockview regression test proves an early layout reply is applied when the
  canvas becomes ready. Shared/web build passed.
- The full `cli-rendering.config.ts` run passed all ten checks across WebKit
  and Chromium: six real CLI grid/input/scaling checks plus the four persistent
  shell cases. CLI tests select device mode through visible controls and verify
  fixture terminal exits before teardown, without editing shared settings.
- `cargo fmt --all -- --check` and workspace Clippy passed. Clippy reports the
  same five existing core warnings and no new warnings from this slice.
- The source detector reported only the existing Markdown blockquote border;
  it is a semantic quote indicator, not new terminal decoration. Desktop and
  mobile screenshots in `.impeccable/review/shell-*.png` were inspected directly.

This proves local shell persistence and the terminal portion of recovery. It
still does not establish provider Chat/CLI continuity, general agent lifecycle
integration, explicit input/resize ownership, remote pairing, or the populated
resource budgets. The full goal remains in progress.

## Direct implementation checkpoint — 2026-09-10

The user requested that the orchestrator take over after the existing workers
finish, with no new agents. Subsequent implementation, review, and testing in
this checkpoint were performed directly. All browser runs were headless.

Actual Chromium testing found a cold-start React update loop that unit tests
and builds had missed. The Chat capability selector now returns a boolean
instead of allocating an empty array during the handshake. The server now
advertises the implemented mode get/set and provider manifest handlers. Empty
session identities are persisted before publication, while the existing
visibility filter keeps unstarted sessions out of navigation. This preserves
their identity and mode policy across browser reconnects without starting a
provider. Mode replies include an optional, server-owned workspace association
on both Rust and TypeScript protocol definitions; navigation focus is never
substituted for that association.

The frontend also refreshes every observed affected session after workspace
or device mode invalidation. An invalidation racing an older read records the
required revision and triggers a fresh read instead of accepting stale policy.
Confirmed modes remain mounted during ordinary refetches.

Verification performed directly:

- `npm run build`: shared and web builds passed.
- `npm test`: 206 tests passed in 14 files, including 65 store tests.
- `cargo test -p perch-core`: 235 unit tests and both protocol parity tests
  passed. The real PTY/tmux quiet and hibernation tests now wait for observable
  settling instead of assuming fixed startup delays. Hibernation still refuses
  activity arriving after completion; the test retries only that specific race.
- Headless Chromium `session-mode-policy.spec.ts`: passed against freshly
  rebuilt core servers using the isolated e2e database/hosts configuration.
  Three browser pages represented two distinct blank sessions and two device
  identities. Visible controls exercised device, workspace, and session
  precedence; cross-view invalidation; reload with the same session id; and
  clearing each override back to its inherited policy. The other device did
  not inherit a device-local change. No `terminal.create` request was emitted.
- Headless Chromium responsive checks R1, R2, and R2b passed: the mobile
  switcher opened/closed and pane changes left exactly one mounted content
  surface, with no desktop Dockview mounted.
- The orchestrator inspected `mode-policy-desktop.png` and
  `mode-policy-mobile.png` under `.impeccable/review/`. At 390 × 844, mode,
  scope, clear, pane, and session-switch controls are reachable without
  horizontal overflow. Their tested touch targets are at least 44 CSS px high.

These checks establish mode policy and blank-session behavior, not the complete
same-provider Chat/CLI continuity gate V-04, secure pairing V-10, or populated
performance and recovery gates. Those requirements remain open. The final
full workspace checks and full browser acceptance matrix remain required.

### V-08 actual provider delivery — 2026-09-10

The orchestrator extended `e2e/workspace-review.spec.ts` and ran the real
headless Chromium flow against freshly rebuilt cores, with isolated e2e
database/hosts paths and a unique temporary Git fixture. Through visible UI
controls it registered the project, opened a session in that workspace,
selected Claude Haiku 4.5, and completed a short readiness turn. It added one
inline note to the worktree line and another to the corresponding index line,
edited the first, resolved and reopened it, selected the target session,
and previewed one packet containing both anchors and the edited note.

After one Send click, the real provider returned the fixture's requested
receipt marker. The UI confirmed “Agent received the review packet.” without
another send. A subsequent explicit retry reused the same packet and operation
id. Wire evidence contained exactly two completed provider turns in that
session: readiness and the single review turn. The sentinel remained unchanged.
The test asserts the receipt is visible and the send button becomes enabled
after the retry. The orchestrator inspected the resulting
`.impeccable/review/review-packet-delivered.png` screenshot, which shows the
provider receipt beside the two-note packet and its delivery confirmation.

This verification exposed and fixed two additional UI integration issues:
the delivery status had required a second send to refresh, and a retry of an
already-confirmed packet could leave the button stuck at “Sending…”. A new
Rust/TypeScript `review.batch.delivery` event publishes the durable outcome;
the hub stamps the owning host, and the client rejects unrelated packets or
hosts and prevents stale claimed replies from undoing confirmed delivery.
Send-button progress follows the correlated request promise. The fixture's
unit regressions cover those ordering and ownership boundaries.

Commands and final evidence for this slice:

- `npm run build` passed; `npm test` passed 208 tests across 14 files.
- `cargo test -p perch-core` passed 235 unit tests and two protocol tests.
- `cargo fmt --check` passed.
- `cargo clippy -p perch-core --all-targets` passed with the five documented
  existing warnings and no added warnings.
- `cd e2e && npx playwright test workspace-review.spec.ts --project=chromium`
  passed all three tests. After the last send-button correction,
  `npx playwright test workspace-review.spec.ts --grep 'sends two' --project=chromium`
  passed again (7.6 seconds of test interaction).

Rust and browser server builds used the Command Line Tools SDK and explicit
clang/ar/linker environment. This is V-08 PASS for actual local UI delivery;
full restart recovery, paired remote/mobile delivery, and the other acceptance
gates remain open.

## Checkpoint — 2026-09-07

Implementation and test work is delegated to Luna with maximum reasoning;
the orchestrator independently reviews code and screenshots. All browser
testing must remain headless/background. Desktop testing must use
`PERCH_DESKTOP_TEST=1`; never activate the user's applications.

### Baseline evidence

Luna reported these baseline checks passing before implementation:

- `cargo test -p perch-core`: 151 unit tests and one protocol parity test.
- `npm test`: 168 tests across 11 files.
- `cargo fmt --check`.
- `cargo clippy --workspace --all-targets`: five documented existing warnings.
- `npm run build`.

An isolated core on loopback port 7798 used a temporary database and hosts
file. Reported RSS was 14,592 KB. Headless Chromium measured used JS heap of
5,661,542 bytes at 1280 × 720 and 5,486,319 bytes at 390 × 844. These are
empty/onboarding measurements, not the required populated performance
fixtures or a settled CPU measurement. Baseline screenshots are local review
artifacts; the orchestrator inspected both CDP captures and confirmed that
onboarding was still visible. They do not prove workspace interactions.

### Partial implementation and review

- Durable local project/workspace records, session associations, additive
  protocol negotiation, and navigation are under implementation.
- Filesystem service includes bounded reads/listing, versioned saves,
  descriptor-based path confinement, no-replace file creation, and sandbox
  requirements for HTML previews. Luna most recently reported 11 isolated
  module tests passing. It is not yet an end-to-end editor workflow.
- Frontend build and 57 focused store tests passed before the latest review
  fixes. This is not verification of the final worktree.
- Review found and requested fixes for legacy protocol deserialization,
  revision/event ordering, metadata broadcast, late focus responses,
  filtered snapshot replacement, and registration form error recovery.
- The latest backend work was interrupted before a final integrated test
  run. Recheck current code and tests; earlier passing results are not proof
  that subsequent edits pass.
- The first headless V-01 invalid-folder interaction exposed an actual
  failure: the core serialized error correlation as `request_id`, while the
  view expected `requestId`; registration remained pending and could not be
  corrected. Backend serialization repair and an observed browser retry are
  required before that flow passes.

### V-01 observed result — 2026-09-07

The backend was rebuilt with the `error.requestId` camelCase repair, then an
isolated headless Chromium run exercised the real UI at `http://127.0.0.1:7799`
using a temporary database and hosts file (`/tmp/perch-goal-ui.sqlite` and
`/tmp/perch-goal-ui-hosts.json`). The browser dismissed onboarding, submitted
an invalid folder, verified that the entered path and name remained in the
form after the correlated error, corrected the path, registered the project,
clicked it, and observed its default workspace become active. It registered a
second fixture project and confirmed the first project remained visible after
the scoped snapshot. After reload, the same rendered project id and active
workspace were present. A phone-sized 390 × 844 context opened the mobile
switcher and rendered the same project/workspace/session hierarchy.

The manual reproduction command was `node /tmp/perch-v01.mjs` from `e2e/`.
The checked-in regression is `npx playwright test workspace-foundation.spec.ts
--project chromium`; it uses unique `/tmp` folders and the isolated server
configuration. The manual run logged the durable project id
`82c23d65-2f85-4825-b04a-01993883eadd` before reload and rendered
`data-testid="workspace-project-82c23d65-2f85-4825-b04a-01993883eadd"` after
reload, along with workspace id
`9e24ef91-9cba-4da1-bd05-e76d8735ac35`. Review screenshots are:

- `.impeccable/review/foundation-desktop-registered.png`
- `.impeccable/review/foundation-desktop-two-projects.png`
- `.impeccable/review/foundation-desktop-reload.png`
- `.impeccable/review/foundation-mobile-registered.png`

The manual run measured 162 DOM nodes and 11.4 MB used JS heap at 1440 × 900,
and 161 nodes and 7.0 MB at 390 × 844. These are interaction evidence and
fixture measurements, not a complete performance gate. V-01 is now observed
as PASS; all other acceptance rows remain UNVERIFIED.

### File-view interaction review — 2026-09-07

Luna reported a headless file open/save/external-edit/compare/dirty-reload
interaction and captured `files-desktop-conflict.png` and
`files-mobile-editor.png` under `.impeccable/review/`. The orchestrator
inspected both. The desktop capture visibly preserves a conflicting draft
beside the disk preview. The mobile capture fails the layout requirement:
two desktop panes remain side by side, the editor is extremely narrow, and
toolbar actions are clipped. A reported viewport `scrollWidth` of 390 does
not establish that controls are visible or usable. This requires a mobile
single-pane correction and confirmation screenshot.

The partial file interaction does not yet prove Git/status updates, durable
draft/conflict recovery, or the complete V-05/V-06/V-09 gates. Further file
tests must use an isolated temporary project sentinel, not repository docs.

The subsequent bounded correction run used an isolated temporary project.
Luna replaced the file screenshots with corrected captures, and the
orchestrator inspected the updated desktop conflict and mobile editor images.
The mobile editor now occupies the full active pane, with an Explorer switch
and reachable Wrap/Preview/Reload/Save actions. The material clipping defect
is resolved for this surface. This does not yet prove the complete mobile
resource/mounting policy, pairing, draft persistence, or all visual states.

### Durable file recovery evidence — 2026-09-08

The filesystem listing regression was traced to `dup(directory_fd)`: the
duplicate shares the original directory open-file description and therefore
its `readdir` offset. `read_directory_from_fd` now opens `.` with
`openat(directory_fd, ".", O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC)` for every listing,
leaving the retained descriptor available for metadata checks. The focused Rust
regression covers eight repeated root/nested listings and sixteen concurrent
root/nested listings:

```text
cargo test -p perch-core filesystem::tests::repeated_and_concurrent_listings_use_fresh_directory_offsets -- --nocapture
test result: ok. 1 passed; 0 failed
cargo build -p perch-core
Finished `dev` profile
```

The checked-in headless browser regression is
`cd e2e && npx playwright test workspace-files-durable.spec.ts --project chromium`.
It passed (`1 passed`, 19.8 seconds including isolated server startup) against isolated `/tmp` database and hosts
files. The real UI registered a unique temporary project, refreshed the root
tree five times while retaining `README.md` and `src`, expanded `src`, opened
`src/main.txt`, persisted a draft in the server buffer, verified the
beforeunload handler and delivered/dismissed Chromium's actual leave-warning
dialog, reloaded the page with the selected path and draft, saved a sentinel
to disk, then caused an external edit. The visible conflict
preserved the local draft and offered Compare, Reload disk, and Overwrite disk;
Compare and the explicit Keep draft/Discard and reload paths were exercised.
The test also captured wide and 390 × 844 screenshots and verified that the
mobile editor and Save control were reachable without horizontal overflow.

The separate isolated restart harness `node /tmp/perch-files-durable.mjs`
also stopped and restarted the rebuilt core against the same temporary DB. Its
logged workspace id was `b0715a32-f260-424b-88ca-4592fa857a0e`; the selected
`README.md` and draft `draft survives core restart\n` were restored after the
process restart. Review captures are:

- `.impeccable/review/files-durable-desktop.png`
- `.impeccable/review/files-durable-conflict.png`
- `.impeccable/review/files-durable-mobile.png`

This establishes the file/tree and draft/conflict portions of the recovery
slice. Git/status verification is still required for V-05; sessions,
terminals, comments, and the rest of the host/client recovery contract remain
unverified for V-09.

### Git/review and responsive UI evidence — 2026-09-09

The rebuilt web client passed the current frontend checks:

```text
npm run build
npm test
14 test files passed; 197 tests passed
```

The real headless Chromium Git/review run was
`cd e2e && DEVELOPER_DIR=/Library/Developer/CommandLineTools npx playwright test workspace-review.spec.ts --project=chromium`.
It registered a unique temporary Git repository, whose sentinel file had
distinct `HEAD_ANCHOR`, `INDEX_ANCHOR`, and `WORKTREE_ANCHOR` contents. The
browser observed the working-tree, staged, and current-`HEAD` diffs, checked
that each visible source revision was a server-provided 64-character revision,
and asserted that each outgoing `review.create` used the corresponding exact
`base` and `baseRevision`. It then created comments through the UI and edited,
resolved, reopened, and deleted one of them. The run passed (`2 passed`, with
the current `perch-core` source compiled by Playwright against isolated
servers). Inline placement now also requires the matching target, side-specific
path, server source revision, consistent anchor metadata/range, and a live
anchor state; comments from another target or stale source remain in the review
list with their state. The durable visual captures are
`.impeccable/review/git-review-crud-desktop.png` and
`.impeccable/review/git-review-mobile-comment.png`.

The responsive headless run was
`cd e2e && DEVELOPER_DIR=/Library/Developer/CommandLineTools npx playwright test responsive.spec.ts -g 'R1\\.|R2\\.|R2b\\.' --project=chromium`.
All three tests passed against the current web bundle and freshly compiled
source servers on the isolated ports. R1 confirms that the mobile shell hides
Dockview and mounts one active pane; R2 confirms the mobile switcher; R2b
switches between Files and Chat and confirms only one content surface remains
mounted. Durable captures are
`.impeccable/review/git-review-mobile-header.png`,
`.impeccable/review/git-review-mobile-switcher.png`, and
`.impeccable/review/git-review-mobile-single-pane.png`.

The Git review spec also now exercises a populated 390 × 844 mobile Git pane
through the real mobile switcher, checks visible diff text, both line-number
gutters, and the reachable comment action, creates a mobile anchored comment,
and captures `.impeccable/review/git-review-mobile-comment.png`. The Git
surface uses a container-responsive layout: at a narrow Dockview width the
status summary stacks above the diff canvas and the nested file rail shrinks,
so the diff and review controls remain reachable. The current mobile capture
was captured from the same current-source browser run as the desktop capture.
`DEVELOPER_DIR=/Library/Developer/CommandLineTools cargo check -p perch-core`
also passes. Review batch delivery is intentionally not marked successful:
the provider-acceptance/receipt path still needs an integrated real-agent
verification.

### OpenCode review and native TUI acceptance — 2026-09-14

Review of Luna's HTTP adapter found unsafe PID-based termination before the
live-socket guard, arbitrary selection of saved OpenCode sessions, port
collisions/foreign-server adoption, incompatible launch arguments, unbounded
HTTP reads, incomplete projection bounds, and continuous idle broadcasts.
The HTTP adapter and PID reaper were removed. Commits `cab173f`, `8f87ecd`,
and `e410a79` preserve live native processes and replace the adapter with a
plugin inside the real OpenCode TUI, using Perch's existing private socket
transport. No additional OpenCode server or model loop is started.

Two completed `claude -p ... --model opus` reviews are saved locally as
`.impeccable/review/opencode-native-opus-review.md` and
`.impeccable/review/opencode-tui-opus-review.md`. The older
`opencode-native-review.md` was agent-written after a stopped review process;
that file now records its provenance correction. The second actual review
identified a false shell-mode guard and eager home-screen session creation.
The fixes require positive native keymap evidence of an empty normal prompt,
keep the native home view empty, and let OpenCode create the conversation on
the first real prompt. Empty home snapshots never overwrite the last real
continuation identity. The public prompt ref's missing mode field is not
trusted. A rejected submission clears only this operation's unchanged text
in the same native ref, and its receipt timeout precedes the Rust timeout.
Slash commands remain in CLI mode rather than receiving a guessed receipt.

Validation used OpenCode **1.18.30**, installed only under
`/tmp/perch-opencode-runtime`, with its native Big Pickle default. The app's
provider catalog and the user's model/auth/settings files were not edited
for these tests. All browser interaction was headless and did not focus an
external window. Commands (with the temporary native binary directory on PATH):

```text
cargo test -p perch-core
node crates/perch-core/src/native_ui/opencode-plugin.test.mjs
cargo fmt --check
cargo clippy -p perch-core --all-targets
cargo build -p perch-core
cd e2e
npx playwright test --config=native-ui.config.ts -g 'opencode:'
npx playwright test --config=native-review.config.ts -g 'opencode:'
```

The full Rust run passed **259 core tests and two protocol tests**. The
focused native checks passed after the final startup-diagnostic change.
Formatting passes; Clippy retains exactly the five baseline warnings. The
standalone plugin check covers UTF-8/history bounds, hidden parts, exact TUI
route selection, idle behavior, shell-mode refusal with no `current.mode`,
home view without session creation, first native submission, draft safety,
duplicate receipts, rejected-submit cleanup, and native cancellation results.

The hardened UI suite passed **Chromium (19.1 s) and WebKit (23.1 s)**:
UI-first native file-tool prompt; CLI follow-up in the same conversation;
web prompt refusal while the real CLI is in shell mode; native and web draft
preservation; core SIGKILL/restart with the same native PID/session; phone
ownership transfer and prompt; native `sleep 20` cancellation; `/new` showing
the native home view followed by a new CLI-owned conversation; and Stop CLI
terminating the actual native process. Desktop/mobile captures were visually
inspected, including long-path wrapping and reachable input/control buttons:
`.impeccable/review/native-ui-opencode-chromium.png` and
`.impeccable/review/native-ui-opencode-mobile-webkit.png`.

The final review-packet run passed **Chromium (11.3 s) and WebKit (13.4 s)**
with the hardened adapter; results are in
`/tmp/perch-opencode-reviewed-delivery.json`. It checks two anchored notes
sent from a separate phone browser, refusal while the desktop owns control,
release/retry, native receipt and response, duplicate prevention, unchanged
fixture files, and the same native PID/session. Earlier runs exposed test
races around cross-browser control release and native Escape parsing; the
checks now wait for the observed state before the next action. Fixture paths
are canonical because OpenCode treats macOS's `/var` alias as external to a
`/private/var` workspace and correctly prompts for permission.

Remaining limits: OpenCode versions without this public TUI plugin API,
`--pure`, `--mini`, and explicit custom `OPENCODE_TUI_CONFIG` launches remain
CLI-only. The custom config is preserved and reported in the UI instead of
being replaced. Native approval dialogs, shell mode, and slash commands stay
in the CLI. Full model/attachment/approval/queue controls, Codex's remaining
acceptance, remote compatibility, and the other SPEC gates remain open.

### Acceptance matrix

| Gate | Current disposition |
| --- | --- |
| V-01 project registration and stable reload identity | PASS (headless UI observed) |
| V-02 two isolated worktrees | PASS (headless Chromium observed): two checkouts from one project with separate paths/branches, one project card, separate sessions, workspace-scoped tab strips, and isolated file changes; see the isolated worktree checkpoint above. Restart recovery for worktrees remains part of V-09. |
| V-03 two different persistent CLI agents | PASS: real OMP/Pi, isolated drafts, split and reload, both engines; see catalog checkpoint above |
| V-04 same-session Chat/CLI switching and recovery | PASS in Chromium for every built-in provider: real Claude/Pi/OMP/OpenCode/**Codex** native UI/CLI turns and same-PID core recovery, plus OpenCode's shell-mode refusal and native home/new-session flow. WebKit re-confirmation is UNVERIFIED-blocked: the browser itself will not launch on this machine (recorded 2026-09-15, not a perch defect) |
| V-05 tree, sentinel edit, save, disk/status verification | PASS (headless Chromium observed): one run spans nested tree expansion, open, edit, save, on-disk bytes, Git status/diff of the save, reload, external-conflict compare/keep/discard, and the phone-width file surface; see the combined file workflow checkpoint above. |
| V-06 visible external-edit conflict recovery | PASS (headless UI observed) |
| V-07 complete Git and agent change review | PASS (local workspaces): working-tree/staged/HEAD sources, workspace-start (explicit **and** implicit) and last-agent-turn bases, rename, delete, line numbers, empty state and the last-agent-change summary all observed in real browser runs against real repositories; direct-host turns are out of scope and the capture-ordering ceiling is recorded |
| V-08 anchored comments and exactly-once review packet | PASS in Chromium for every built-in provider: native Claude/Pi/OMP/OpenCode two-note phone delivery, ownership and receipt-confirmed retry, plus **Codex delivery observed 2026-09-15**; WebKit re-confirmation is blocked by the browser-launch failure recorded above |
| V-09 full host/client recovery | PASS: mixed project/worktree, session, exact pane set, same-PID shell, draft conflict and anchored comment recovery passes three times per engine in Chromium/WebKit; see mixed recovery correction above and provider-specific recovery evidence below. |
| V-10 paired mobile interaction and reconnect | PASS (two real origins observed): a phone-sized client on this machine's LAN address pairs with a code issued by the host, drives a CLI agent, reads scrollback after reload, opens files and Git, reconnects across a host restart on its stored token, and loses access when revoked; no QR, no per-device scope, no TLS — see the pairing checkpoint above |
| V-11 populated desktop/mobile visual and interaction QA | PASS: Git, file, terminal and settings surfaces measured per pane at a narrow desktop pane, a wide desktop viewport and 390px — no clipped controls, no horizontal scroll, visible focus, readable status, and no desktop-only dead end (Settings was one; fixed). Screenshots inspected. Focus sampling and contrast limits recorded. |
| V-12 safe hibernation and resume | PASS (local CLI agents, real Claude observed): an unwatched idle agent sleeps, its process is released, and returning resumes the same provider session; remote/direct-host agents are out of scope — see the hibernation checkpoint above |

Full Git/review, provider lifecycle and mode scope, worktree orchestration,
secure pairing, remote/mobile workflows, populated performance budgets, and
the complete automated/UI verification remain required. Update this report
with exact commands, observed actions, artifacts, and current results as each
gate is actually exercised. Never infer a pass from this checkpoint.

### Historical orchestrator review checkpoint — 2026-09-09 17:04 UTC

The orchestrator directly inspected `git-review-crud-desktop.png` and rejected
its cramped nested columns: the diff and action controls were visibly clipped.
The frontend lane subsequently added container-responsive layout and a populated
mobile interaction test. Direct inspection of
`.impeccable/review/git-review-mobile-comment.png` confirms readable index and
working-tree sentinel lines, a visible unresolved comment, and reachable Edit,
Resolve, and Delete controls. This visual observation is limited to that capture;
it does not establish the complete mobile, pairing, or delivery acceptance gates.

The reported frontend checkpoint was 196 tests passing and successful real
Git/comment CRUD, followed by a populated mobile comment interaction. Those
pre-integration browser results were superseded by the current-source runs
recorded above.

All three Luna implementation lanes stopped with a usage-limit error at this
checkpoint, reporting retry at 3:28 PM local time. Backend build repair, durable
provider-acceptance receipts, full runtime persistence/wiring, corrected desktop
layout verification, and the remaining SPEC gates are still outstanding.

Additional orchestrator review while Luna is quota-stopped: the new
`agent_persistence.rs` snapshot upsert currently overwrites existing state
unconditionally. Before integration, add stale-write protection using a
monotonic snapshot revision that covers every persisted mutation, and verify
out-of-order snapshot saves cannot replace newer state or provider identity.
This finding has been sent to the fleet lane for its next resume.

### Orchestrator review checkpoint — 2026-09-09 19:29 UTC

The frontend lane rebuilt current perch-core source and passed both
`workspace-review.spec.ts` browser tests. The tests cover distinct committed,
index, and working-tree source text; source-version-bound comment creation;
comment lifecycle; and populated mobile Git interaction. A subsequent run
also verifies that comments from another diff target stay in the review list
rather than attaching to an unrelated same-numbered line. Focused frontend
Git/review tests passed 16/16. The orchestrator inspected the corrected desktop
capture and reviewed the target/source/anchor checks. This is scoped evidence,
not full V-07 or V-08 acceptance: provider packet delivery remains unverified.

The fleet lane reports native core tests 215 passing and its combined
fleet/runtime/persistence harness 46 passing, including real PTY lifecycle,
stale snapshot saves, mode ordering, and restart revision advancement. Root
reviewed the separate monotonic lifecycle/mode update logic. The runtime and
persistence modules are now exported, but actual server/protocol/UI wiring
and real Claude/Codex acceptance remain outstanding.

At this checkpoint all three Luna lanes stopped with a usage-limit error,
reporting retry at 6:04 PM Eastern. Resume priority: finish current server
runtime/persistence integration and mirrored wire contracts; verify packet
acceptance/durability using real agents; continue actual session mode flows;
then remaining workspace-start/last-turn diff bases, worktrees, pairing,
resource budgets, and the complete SPEC matrix. No gate is complete merely
because a standalone module or fixture test passes.

### Frontend current-source correction — 2026-09-09

The Git/review correction was rerun after the backend source compiled cleanly.
`npx vitest run src/components/WorkspaceGitReview.test.tsx src/gitReviewStore.test.ts`
passed 16/16, `npm run build` passed, and the full web suite now reports 14 test
files and 197 tests passing. The Playwright fixture run rebuilt both isolated
servers from the current source and passed 2/2. It verifies that comments from
working-tree, staged, and HEAD snapshots are inline only for their matching
target and server source revision; other-target comments remain in the review
list. It also verifies the mobile populated Git surface and CRUD path.

The responsive current-source run passed 3/3 for the single mounted mobile
pane, switcher, and Files/Chat pane switch. The corrected captures are
`.impeccable/review/git-review-crud-desktop.png` and
`.impeccable/review/git-review-mobile-comment.png`. The desktop capture shows
the readable status row, HEAD compare control, diff rail, line gutters, and
review actions; the mobile capture shows the status card, controls, populated
diff, and comment actions. Review packet provider delivery is still PARTIAL
until the server's acceptance receipt is exercised with a real agent.

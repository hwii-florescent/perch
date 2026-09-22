# Handoff — 2026-09-22

Current state for the next agent. The full historical record is
[docs/ADE-REWORK-VERIFICATION.md](docs/ADE-REWORK-VERIFICATION.md); this file
is only what you need to pick the work up. `goals.md` + `SPEC.md` remain the
contract, `AGENTS.md` is the project guidance (there is no `CLAUDE.md`).

## Where things stand

- **Committed:** `09d1cde` on `main`, local only, **not pushed**. It carries
  the V-07 honest-turn-state slice plus the previously uncommitted native
  transport / provider environment / two-pane work.
- **Uncommitted:** the V-10 work described below, plus the review-routing and
  workspace-creation-ref, large-turn-count, session-turn selection and terminal
  resize-control slices below.
- V-07, V-10 and V-12 all remain **PARTIAL**. No goal or phase is complete.

## Session turn selection and terminal resize control — 2026-09-22 UTC (latest)

Resumed after the stop checkpoint below. This slice is implemented and verified;
that earlier checkpoint's “not started” statement is historical.

- Git review now has **Turn session**: latest in workspace, or a specific
  session's last recorded turn. `git.status.sessionId` is optional in both
  protocols; the existing DB query filters workspace + session before its
  limit. No schema migration, new endpoint, or content duplication.
- Selection clears stale comparison/path/line state and survives status
  refreshes and desktop/mobile pane changes. Reload can select the same durable
  session again. Superseded responses cannot replace the selected turn; a
  legacy host returning another session's turn is rejected by the view.
- Comments on a recorded turn use that turn's session, even with another
  session active. Verified the saved comment JSON as well as the visible diff.
- The two-session browser test exposed a real blank-terminal defect: the
  server retained an 80x41 grid while a replacement view was 130x33. Acquiring
  resize control called a cached fit, so no resize was sent; the redraw scrolled
  its own text away. `agentTerminals.ts::takeControl` now synchronizes dimensions
  after acquiring the lease; `PersistentAgentTerminal` supplies its current grid.
  Both automatic and manual acquisition share that fix. A unit test checks
  dimensions changed during acquisition and the returned lease generation.
- **Checks:** 278 core + 2 protocol tests, 223 web tests, both builds, format,
  Clippy (five existing warnings). Final two-session browser cases pass in
  WebKit **5.9s** / Chromium **5.4s**, **2 passed (13.9s)**. The other two free
  running/unavailable/513-path cases passed on the final production code in
  the preceding run (19.6s / 17.9s); only the comment test's SQL query changed
  afterward. No claim of a single all-green full-suite run.
- Settled WebKit desktop + 390px screenshots inspected: session choice, actual
  alpha diff while beta is active, and mobile inline comment are readable.
  Keepers: `e2e/screenshots-cli-rendering/session-turn-2026-09-22-final/`.
  Earlier failures and diagnostics are in sibling `session-turn-2026-09-22-*`
  directories. Full commands and logs are in the verification record.
- **Zero paid model calls.** All processes in this slice were free `/bin/sh`
  turnbot fixtures. No live build/test handles remain; no commit or push.
- Next: earlier turns within the *same* session still have no history picker;
  capture ordering/cost/retention and remote capture also remain open. Preserve
  V-10/V-12 and resource-budget scope. Audit older test model costs before any
  blanket run; real sessions must verify Luna/Haiku 4.5 before their first prompt.

## Stop checkpoint — 2026-09-22 (superseded)

User requested an immediate handoff before usage runs out. The completed work
and its verification are recorded in the sections below; preserve the other
agent's review-routing and workspace-creation-ref changes too.

- Since the large-turn-count slice, only read-only resume inspection and this
  handoff update occurred. **No session-history implementation was started**,
  no additional tests or paid harness sessions were run, and no commit/push
  was made. The test totals below belong to the completed slice, not a fresh
  audit of any subsequent edits by another agent.
- Next intended task: V-07 / SPEC GIT-004, session-specific change history.
  Trace `server/agent_history.rs::last_agent_turn`,
  `db/prompts.rs::list_agent_change_snapshots`, `server/git.rs`, both protocol
  definitions, `gitReviewStore.ts`, and the workspace Git review components.
  At the last inspected implementation, review picked the newest workspace
  turn; a session still needs to open its own last changes after later turns
  in another session. Recheck current code before choosing the smallest fix.
- Start with existing free `turnbot` fixtures in
  `e2e/agent-turn-review.spec.ts` for a two-session regression. Any real model
  session must use **GPT-5.6 Luna or Claude Haiku 4.5**, with the actual model
  verified before the first prompt. Unknown/costlier selection stops the test.
- No outstanding build/test handles from the completed slice. Do not poll
  old handles or clean up unrelated processes. Revalidate current files before
  editing because other agents have been working in this checkout.
- `goals.md` already preserves the full objective and cheap-model rule; it
  needs no scope change. V-07, V-10, V-12 and measured resource budgets remain
  open. Continue from this checkpoint and the verification record.

## Honest counts for large agent turns — 2026-09-22 UTC

Preserved the completed baseline/routing work below and advanced the remaining
V-07 summary issue. A turn changing more than 512 paths used to show exactly
512 because the UI counted the bounded stored list.

- `server/agent_history.rs` now stores the exact turn count in the existing
  `after_status` JSON before trimming the list, and records full boundary
  status counts before trimming those lists too. No migration or extra Git scan.
- Optional `AgentTurnSummary.changedPathCount` is defined in both protocols.
  The UI uses that exact count. Legacy capped rows with no total display
  “at least 512 paths”; a shorter legacy list is known to be complete. Older
  peers missing the new field also render a lower bound, never a false total.
- Added a real Git/SQLite regression: 513 files, 512 retained paths, exact total
  after DB reopen; legacy fallback; then a one-file turn with 513 dirty paths
  still reports one. Extended the free turnbot browser fixture with 513-path
  changes, reload, bounded DB-list assertion and legacy metadata simulation.
- Checks: **277 core + 2 protocol tests**, **223 web tests**, both builds,
  format and workspace Clippy (five baseline warnings) pass. Impeccable's
  detector reports no findings for the changed component.
- Headless turnbot WebKit/Chromium: **4 passed (32.9s)**. Added an explicit
  wait for the rendered large diff before screenshots; the two relevant
  confirmation runs pass (**48.7s**, WebKit 23.7s / Chromium 22.3s).
- Inspected settled WebKit desktop/mobile images: exact and lower-bound counts
  are readable, the diff has real content, and the summary fits at 390px.
  Evidence: `e2e/screenshots-cli-rendering/{webkit,chromium}/turn-count-2026-09-22-settled/`.
  First-run evidence remains in the sibling `turn-count-2026-09-22/` directory.
- No paid model calls, active test/build handles, commit or push. Full goal
  remains open. Capture ordering/retention/cost, per-session historical review,
  remote recording, V-10 and broader V-12/resource budgets are still incomplete.

## Review routing + workspace creation refs — 2026-09-22 UTC

Picked up a Codex session ("Document work in handoff.md") that stopped on
`usage_limit_exceeded` mid-`apply_patch`; **it left the tree not compiling**
(two DB signatures changed, call sites and tests not). Finished that slice and
carried it through the real UI. Details and exact numbers are at the top of
[docs/ADE-REWORK-VERIFICATION.md](docs/ADE-REWORK-VERIFICATION.md).

- **Fixed: a worktree refresh invented a workspace start.** Refresh no longer
  writes a creation ref at all; it is recorded at first registration or never.
  The primary checkout is registered before the listing walk, so binding a
  child first can no longer create the parent without one. A newly *discovered*
  entry still records its current head — that is its registration boundary, the
  same rule `project.create` uses. Two DB tests, one of them verified failing
  against the restored back-fill.
- **Fixed: a Hosted session's review packet went to a CLI that does not exist.**
  `review.batch.send` routed on `native_ui::supported(agent)`, which is true for
  claude/codex, so a Hosted target took the native path and delivery never
  settled — the UI sat on "Waiting for the agent…". It now routes on
  `session.cli_provider_id.is_some()`. The hosted branch's `unreachable!` became
  genuinely reachable (client-supplied `target_agent_id`) and is now an error.
- **Closed the oldest e2e blocker.** "sends two reviewed anchors as one packet
  to the selected real agent" now **passes on both engines (~9s)** with a real
  `claude-haiku-4-5` turn. It had never passed. Three separate causes; see the
  record. Native (CLI-owned) review and paired-phone flows still pass.
- **`AGENTS.md` had two false claims** — the tab-bar `+` creates nothing by
  itself, and Hosted/CLI is per-session (`SessionModeControl`), not global.
  Both corrected there.

### Traps this cost time on — read before touching these

- **`toBeDisabled()`/`toBeEnabled()` are vacuous on an `<option>` whose
  `<select>` is inside a `<label>`** (Playwright 1.61.1). The property is
  `true`, Playwright says `enabled`. The diff toolbar's select is label-wrapped,
  so an existing `toBeEnabled()` had been passing for free. Use
  `toHaveJSProperty("disabled", …)`, as `expectWorkspaceStartOffered` now does.
- **The tab-bar `+` opens a launcher and creates nothing.** Clicking it and
  then typing types into the previously active session — in a different
  project, silently. Its sessions are CLI-owned, and UI mode over a CLI-owned
  session renders `NativeCliChat`: no `.chat__input textarea`, no model chip.
  For a Hosted session use `session.create` (`createHostedSession` in
  `workspace-review.spec.ts`).
- **A session with no messages is invisible to `session.list`** (the
  `cli_activity`/message visibility filter), so it never reaches the review
  dropdown. "Empty dropdown" can mean "the turn went somewhere else".
- Combined-run failures rotated again: `workspace-review` 11/12 and
  `paired-phone-flows` 1/2 in a combined run, **both green in isolation**.
  Re-run before calling anything a regression.

### Uncommitted

Everything below plus this slice. Nothing committed, nothing pushed.

## Cheap-model guards and provider recheck — 2026-09-22 UTC

Completed after the Claude recheck below. No production source changed.

- Fixed `e2e/cheapModel.ts`: rebuilding an overlay on core restart hit existing
  symlinks and silently returned `{}`, dropping the model pin. Existing matching
  links now survive restart (including dangling runtime links); setup errors and
  unsupported providers throw instead of inheriting user defaults.
- Added `e2e/cheap-model.spec.ts`, using synthetic config homes and no browser or
  paid calls. It failed before the fix, then passed for Pi/OMP/Codex restarts,
  unchanged original config/extensions, failed setup and unsupported providers.
- Native review now checks the exact model for every provider before its first
  prompt. Native UI no longer exempts OpenCode and checks again after recovery
  and a new conversation. Hibernation checks the actual CLI's Haiku 4.5 label
  before initial and resumed prompts. Its cleanup now uses exact tmux targets.
- OpenCode gets `model` and `small_model` Haiku runtime config overrides, merged
  with existing inline config. This is configuration-only evidence: `opencode`
  is not on PATH, and its bridge currently derives model from transcript rows,
  so a fresh empty session cannot yet satisfy the new pre-prompt model guard.
  Do not remove that guard or run on an unknown model to get a pass.
- Default Playwright discovery now includes native-ui, native-review,
  paired-phone-flows and cheap-model; `--list` confirms 12 tests in four files.
  Native tests retain their focused timeout budgets under the default config.
- Fresh WebKit passes: native review Pi/OMP/Codex **3/3 (28.5s)**; native UI
  Pi **1/1 (18.4s)** and OMP/Codex **2/2 (1.1m)**; Claude hibernation/resume
  **1/1 (9.5s)**. All paid prompts used Luna or Haiku 4.5. One no-cost helper
  check also passed. No new Chromium runs in this slice.
- The first hibernation guard failed before its recall prompt because Claude's
  `SessionStart` resume hook omits `model`; saved hook fields prove it. The
  retry checks the live CLI label rather than inferring from old messages.
  The missing native UI chip after wake remains visible; model is not invented.
- Saved evidence: `e2e/screenshots-cli-rendering/webkit/model-guards-2026-09-22/`,
  including the failed guard and passed hibernation. Earlier artifacts were
  saved to `/tmp/perch-model-guards-before-2026-09-22/`.
- Standalone e2e `tsc` could not run: installed Node type definitions are missing
  (TS2688). No dependency added. Playwright transpilation/execution passed.
- No active handles, commit or push. Full goal remains open.

## Claude acknowledgement recheck — 2026-09-22 UTC

The next-step Claude verification is now complete on the current worktree;
no production or test source changed during this recheck. Read the detailed
commands/results at the top of `docs/ADE-REWORK-VERIFICATION.md`.

- Existing wrapped-prompt regression: **1 passed**; core and web builds pass.
- `native-review.config.ts -g 'claude:'`: **2 passed (21.5s)**, Chromium
  10.9s / WebKit 10.0s. Ownership refusal, acknowledged delivery, actual
  assistant receipt and retry without a duplicate turn all passed.
- `native-ui.config.ts native-ui.spec.ts -g 'claude:'`: **2 passed (33.6s)**,
  Chromium 15.1s / WebKit 17.9s. UI/CLI continuity, core-crash recovery with
  unchanged provider identity/PID, draft protection, phone control transfer,
  cancellation and explicit stop all passed.
- Every fixture used `claude-haiku-4-5`, checked before its first prompt.
  No global settings changed. Fixture cleanup used its recorded tmux names.
- Preserved screenshots, core logs and native snapshots:
  `e2e/screenshots-cli-rendering/{webkit,chromium}/claude-ack-recheck-2026-09-22/`.
  WebKit wide/narrow screenshots inspected. The mobile review capture still
  clips long comment text within the diff viewport; this is not a full V-11
  layout pass. Raw Claude paste wrappers remain visible in user messages.
- Initial sandbox browser launches failed before app startup. The authorized
  escalated headless reruns passed. No live test/build handles remain.
- No commit or push. Full goal remains open; V-07/V-10/V-12 stay partial.

## This session

### V-07 — honest last-turn review state (committed in `09d1cde`)

The Git surface reported an *older* completed turn under the label "Last agent
turn" whenever a newer row was incomplete, and the client never cleared a
cached summary. Now `agent_history::last_agent_turn` reports the **newest** row
plus an `AgentTurnState` (`complete` / `running` / `unavailable`), resolved
against live runtime state because `completed = false` cannot say *why* a row
is open. `git.status.result` always serializes `lastAgentTurn` so an explicit
`null` clears the client; the store keys on **key presence**, not truthiness,
because the synthetic status rebuilt from `git.action.result` omits the key and
must keep preserving the summary. A `source_control` fix drops the phantom
"deleted" entry Git reports for an untracked path the base snapshot carries.

### V-10 — paired-phone flows (uncommitted)

`e2e/paired-phone-flows.spec.ts` (new, registered in `cli-rendering.config.ts`)
covers the two items SPEC.md V-10 names that `device-pairing.spec.ts` cannot:
Chat/UI <-> CLI and the review-note packet, both from a **paired** phone at the
LAN origin. Neither is reachable with a `/bin/sh` fixture — native UI is a
per-provider bridge, and `server/session.rs::resolve_review_target` refuses a
provider without native review controls — so it drives real Claude pinned to
`claude-haiku-4-5` via `cheapModel.ts`, asserting the model chip before either
of its two turns.

**One product defect found and fixed** in `native_ui/claude.rs`. Claude Code
**2.1.278** wraps every bracketed paste — which is how `prepare_input` submits
— in `<pasted_content id="...">` tags with a random id. The acceptance check
compared `event["prompt"] == payload["text"]`, so it could never match and
**no prompt perch sent to a native Claude session was ever acknowledged**: the
10s window in `native_ui.rs` expired and delivery settled `unconfirmed`, which
the UI honestly reports as "Delivery could not be confirmed" for a packet the
agent had actually received. A `submitted()` helper now requires the reported
prompt to *contain* the sent text, still pinned to the same pid, the same
provider session, and a submission newer than the pre-write stamp. Regression
`a_prompt_the_cli_wrapped_in_paste_tags_still_counts_as_submitted` uses the
real captured payload and fails against the old check.

**Claude-only by construction**: Pi/OMP/OpenCode/codex return an explicit
`NativeEvent::Ack` (`native_ui/mod.rs`), so they never inferred acceptance from
a hook payload. It is also why `native-review.spec.ts` recorded a claude PASS
in September and would fail now — the CLI changed under us.

`paired-phone-flows.spec.ts` **passes on WebKit and Chromium** (12.1s / 11.7s),
as do both turnbot specs — 6 passed. Screenshots:
`e2e/screenshots-cli-rendering/{webkit,chromium}/paired-phone-2026-09-22/`.
Verified on the wire after the fix:

```json
{"received":"review.batch.delivery","delivery":"unconfirmed"}   // pre-write settle
{"received":"review.batch.delivery","delivery":"delivered"}     // acknowledged
{"received":"review.batch.send.result","delivery":"delivered"}
```

## Do not re-investigate these — falsified with evidence

Chasing that `unconfirmed` banner, two mechanisms were proposed and **both
disproved**. They cost about an hour; do not repeat them.

1. *"A tty discards writes past `MAX_INPUT`, so large prompts are truncated."*
   False. A 2.4 KB unchunked `write_all` to a real pty master reached the child
   complete. A write-chunking change was written, approved, then **reverted**
   because its own regression test passed with the fix removed.
2. *"The tmux client hop loses large writes."* False. A 3.5 KB single write
   through a pty into `tmux attach` delivered 60/60 lines; only the 12
   bracketed-paste marker bytes were stripped, by tmux, as expected.

The premise behind both was wrong: the review packet is **~750 bytes**, not the
multi-KB payload assumed. It always reached Claude and always fired
`UserPromptSubmit`. Only the acknowledgement was broken.

Technique worth keeping: `/tmp/perch-native-<uid>/` survives fixture cleanup,
so `*.UserPromptSubmit.event` holds exactly what the CLI reported for the last
prompt. Read it before theorising about native Claude delivery.

## Next work

1. The model-guard slice above is done. Audit remaining legacy test costs before
   the full suite: `e2e/cli-sync.spec.ts` deliberately sends a Sonnet prompt and
   was **not run**. Other older hosted/CLI fixtures also need inspection before
   a blanket run. OpenCode runtime/model observability remains unverified; the
   new guard deliberately prevents paid prompts from a fresh unknown model.
2. Remaining V-10 scope, none started: per-device scope and pairing
   versioning/rotation (a paired device has the same access as a local one),
   encrypted non-loopback transport (the token crosses a LAN in the clear, so
   the honest deployment is a trusted LAN or an ssh-forwarded port), and QR
   pairing instead of a typed code.
3. Remaining V-07 scope: capture ordering/cost/retention, earlier-turn selection
   within one session (latest-per-session selection is now verified above),
   prompt-acceptance semantics, and direct-host/remote turn recording
   (architectural — Git for a direct-host workspace is not reachable from this
   process). Implicit-workspace creation refs are **done** — see the top slice:
   a refresh can no longer invent one, and the primary checkout is registered
   with its own before any child can create it without one.
4. V-12: several agents/worktrees, working/blocked/draft/mobile and remote.

## Constraints that still apply

- **Cheapest model, always**: haiku 4.5 for claude, the luna slug for
  codex/pi/omp, via `e2e/cheapModel.ts` per fixture — never a global setting.
  Assert the actual model **before** the first prompt; an unknown or unexpected
  model stops the test. Never substitute a costlier model or another provider.
- Do not change global provider settings or disable user extensions. Fixture
  cleanup stays confined to processes that fixture's own core recorded.
- All browser/app verification is headless/background.
- Commit only when asked; never push. Commits land on `main` in this repo.
- Preserve failure evidence before rerunning — Playwright output directories
  and fixed-name screenshots are overwritten.

## Commands

```sh
cargo test -p perch-core && cargo fmt --check && cargo clippy --workspace --all-targets
npm test -w @perch/web && npm run build
cd e2e && npx playwright test --config=cli-rendering.config.ts agent-turn-review.spec.ts -g 'turnbot' --project=webkit --project=chromium
cd e2e && npx playwright test --config=cli-rendering.config.ts paired-phone-flows.spec.ts --project=chromium
```

Clippy has exactly **five** baseline warnings; add none. New e2e specs must be
added to a config's `testMatch` or they do not run.

## Traps

- A probe that temporarily reverts a fix must not be undone with
  `git checkout -- <file>` when that file has no other working-tree changes —
  it discards the fix and its test too. Copy the file aside first.
- `npx playwright ... | tail` buffers everything until exit, so a backgrounded
  run looks silent while it is perfectly healthy. Check the process, not the
  output file.
- The core also registers the checkout it was launched from as a project, and
  starting a CLI in a folder does not create a project card. Register the
  project explicitly and name fixture repos uniquely, or the phone's Git pane
  opens the wrong repository.
- `git-review-delivery` legitimately shows `unconfirmed` before `delivered`;
  assert the end state, not the first non-waiting state.

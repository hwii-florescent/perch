# ADE rework verification

## Session-specific turn review and terminal resize leases — 2026-09-22 UTC

### Product behavior

`git.status` accepts optional `sessionId` in Rust and TypeScript. The existing
`list_agent_change_snapshots` query filters the workspace and session before
limiting results; an incomplete latest row remains the latest row, with no
fallback to older captured work. The DB regression interleaves two sessions
and another workspace, reopens SQLite, and checks scoped/latest/empty results.

The shared desktop/mobile Git pane adds “Turn session”. It clears the old
comparison and path/line selection when scope changes, then offers the selected
session's last recorded turn. Status refresh keeps the filter. A reloaded
browser can select that same durable session again. The request store discards
superseded responses and rejects another session returned by an older peer
that ignores the filter. Comments on that exact recorded comparison retain
its session ID instead of the globally active chat tab's ID.

### Blank-terminal root cause and fix

The new two-session interaction failed in both engines before it could test
review: the second terminal rendered blank despite live output arriving.
Diagnostics showed a valid 130x33 emulator, while the process retained the
80x41 grid of its first short-lived view. The new view acquired resize control,
but `fit()` had already cached the same local dimensions and emitted no resize.
Tmux's 41-row repaint consequently scrolled its text out of the 33-row viewport.

`openAgentTerminal` now synchronizes the current dimensions immediately after
its resize lease is acquired. The terminal supplies a getter for the live grid;
the native structured view uses its existing fixed dimensions. Both automatic
and manual control acquisition use this path. The lease unit regression changes
dimensions while control is pending and checks the outgoing resize generation.
The browser failure is now green with its original “turnbot ready” assertion.

### Checks and interaction evidence

```sh
cargo test -p perch-core agent_change_history_filters_session
cargo test -p perch-core
cargo build -p perch-core
cargo fmt --check
cargo clippy --workspace --all-targets
npm test -w @perch/web
npm run build
# from e2e/, headless, free shell fixtures only:
npx playwright test --config=cli-rendering.config.ts agent-turn-review.spec.ts -g 'turnbot:' --project=webkit --project=chromium
npx playwright test --config=cli-rendering.config.ts agent-turn-review.spec.ts -g 'turnbot: a real' --project=webkit --project=chromium
```

Core **278 + 2 protocol**, web **223/19 files**, both builds and format pass.
Clippy retains **five baseline warnings**. Logs:
`/tmp/perch-session-turn-tests-2026-09-22.log`,
`/tmp/perch-session-turn-web-tests-2026-09-22.log`,
`/tmp/perch-session-turn-clippy-2026-09-22.log`.
Impeccable's one detector pass for the toolbar returned `[]`; no styling change.

Final two-session cases: **2 passed (13.9s)**, WebKit **5.9s**, Chromium **5.4s**.
Observed two actual shell processes editing the same tracked/untracked files;
workspace latest shows beta, selecting alpha restores its older pinned diff and
excludes beta; refresh and reload preserve access, and the mobile pane can
select either session or return to workspace latest. Created an inline alpha
comment while beta remained active, verified its `comment_json.sessionId` in
SQLite, and observed the comment after mobile navigation.

The other two cases (running turn, failed capture, recovery, 513-path count,
legacy lower bound) passed in the preceding run on the same production code:
WebKit **19.6s**, Chromium **17.9s**. That run's two-session checks stopped on a
new test query incorrectly expecting a `review_comments.session_id` column;
the column is `comment_json`, so the final rerun uses
`json_extract(comment_json, '$.sessionId')`. There was no product change between
these runs. Do not describe the full four-case run as green.

Settled WebKit desktop/mobile screenshots inspected together: selector labels,
actual alpha content, and mobile comment fit the existing surface at 390px.
Final keepers: `e2e/screenshots-cli-rendering/session-turn-2026-09-22-final/`
contains each engine's `agent-turn-review-turnbot--2f222-omes-a-reviewable-diff-base-*`
folder with `turn-session-desktop.png`, `turn-session-mobile.png` and logs.
Earlier evidence directories share `session-turn-2026-09-22-` and end in
`first-failure`, `geometry-failure`, `geometry`, `wire-failure`, `option-wait`,
`pass`, or `comment-query`. `wire-failure/` preserves the terminal-ID-specific
frames proving the old grid and the reattachment sequence. The browser helper
also explicitly waits for the last-turn option's native `disabled` property:
Playwright `selectOption` can dispatch while that option is disabled.

### Limits

No paid model calls, global setting changes, commit or push. This is latest-turn
selection per session, not a picker for arbitrary earlier turns in the same
session. Capture ordering/cost/retention, direct-host/remote capture, V-10,
broader V-12 and measured resource budgets remain unverified/incomplete. The
native paid providers were not rerun for the shared resize-control change.
No active test/build handles remain from these checks. Full goal stays open.


## Exact counts for bounded agent-turn history — 2026-09-22 UTC

### Problem and change

Turn capture trimmed `changed_paths` to `MAX_AGENT_CHANGE_PATHS` (512), and the
review summary displayed that list's length as the number changed. A 513-path
turn therefore claimed 512. The recorder now saves `turnChangedPathCount` in
the existing `after_status` JSON before trimming; boundary status counts are
also computed before their path lists are trimmed. This reuses the existing
Git comparison and JSON storage, with no extra scan or schema migration.

Rust and TypeScript expose optional `changedPathCount` in `AgentTurnSummary`.
The core supplies the exact total for new completed rows. A legacy row below
the cap has a complete list; a capped legacy row has an unknown total. The UI
uses the exact count where available and otherwise says “at least N paths”.
A peer predating the new field is handled conservatively the same way. The
persisted path list stays bounded at 512.

### Automated evidence

```sh
cargo test -p perch-core a_bounded_path_list_keeps_the_full_turn_count_after_reopen
cargo test -p perch-core
cargo build -p perch-core
cargo fmt --check
cargo clippy --workspace --all-targets
npm test -w @perch/web
npm run build
```

**277 core tests + 2 protocol tests pass; 223 web tests pass.** Both builds and
format pass. Clippy retains the five baseline warnings; the web build retains
its existing large-chunk warning. The new real Git/SQLite test captures 513
new files, reopens the DB, verifies a 512-path list and exact total 513, verifies
legacy capped fallback, and then changes one file while all 513 remain dirty:
the next turn correctly reports one, including under legacy uncapped metadata.

Logs: `/tmp/perch-turn-count-tests-2026-09-22.log`,
`/tmp/perch-turn-count-web-tests-2026-09-22.log`,
`/tmp/perch-turn-count-clippy-2026-09-22.log`.
The Impeccable clarify workflow preserved the incumbent component/CSS. Its one
mechanical detector pass returned `[]` for `WorkspaceGitReview.tsx`:
`/tmp/perch-turn-count-design-2026-09-22.json`.

### Actual browser interactions

From `e2e/`, headless, using only a local `/bin/sh` fixture (no paid models):

```sh
npx playwright test --config=cli-rendering.config.ts agent-turn-review.spec.ts -g 'turnbot:' --project=webkit --project=chromium
```

**4 passed (32.9s)**: WebKit 6.5s / 10.4s, Chromium 3.7s / 8.1s.
The state/recovery test now sends `bulk`, creating 511 new files in addition to
the two files the fixture edits. The visible summary reports 513, SQLite keeps
512 paths, browser reload preserves the exact count, and replacing only this
fixture row's `after_status` with legacy `{}` yields “at least 512 paths”. The
phone viewport performs the same selection and verifies the lower-bound text.

Initial screenshots captured the correct summary while the diff was loading.
Added a wait for `AGENT_NEW bulk` in the actual diff before both screenshots,
then ran the two affected cases:

```sh
npx playwright test --config=cli-rendering.config.ts agent-turn-review.spec.ts -g 'uncaptured newest' --project=webkit --project=chromium
```

**2 passed (48.7s)**, WebKit 23.7s / Chromium 22.3s. Inspected the settled
WebKit wide and 390px phone images together: summary text fits, exact/lower-bound
wording is correct, diff lines are rendered and readable. No layout changes.
This is scoped visual evidence, not a full V-11 audit or a performance claim.

Preserved screenshot/core-log artifacts:
`e2e/screenshots-cli-rendering/{webkit,chromium}/turn-count-2026-09-22-settled/`.
First-run artifacts remain in sibling `turn-count-2026-09-22/` directories;
pre-run Playwright output was saved to `/tmp/perch-turn-count-before-2026-09-22/`.

### Limits

Old capped rows cannot recover their exact total from stored metadata alone;
the lower-bound label is deliberate. This does not change retained snapshot
refs, capture ordering, capture cost, prompt-acceptance semantics, per-session
history selection or remote-host recording. V-07/V-10/V-12 and measured resource
budgets remain incomplete. No paid provider calls, commit or push; all handles
completed and fixture-owned processes were cleaned up.


## Review delivery routing and workspace creation refs — 2026-09-22 UTC

Picked up from a Codex session that stopped mid-edit on `usage_limit_exceeded`
(its last `apply_patch` landed, the tree did not compile). Two product defects
fixed, one long-standing e2e blocker closed, two stale `AGENTS.md` claims
corrected.

### D1 — a worktree refresh invented a workspace start

`update_workspace_git_state` and `create_worktree_workspace`'s update branch
both carried `start_snapshot = CASE WHEN start_snapshot IS NULL THEN ?…`, and
`workspace_matches_worktree` treated a row with no creation ref as *not*
current. Opening the worktree menu on a workspace registered before its first
commit therefore back-filled today's HEAD and the UI offered it as "Workspace
start" — a boundary the user never had. Refresh now never writes a creation
ref: it is recorded at first registration or not at all. Registering the
primary checkout up front (`register_worktree_listing`) closes the sibling
case where binding a child first created the parent with no ref. An entry not
yet known is still registered with its current head, which is the honest
registration boundary — the same rule `project.create` follows.

- `db::tests::worktree_refresh_never_invents_a_missing_creation_snapshot`
  (from the Codex session, completed here) FAILS with the old back-fill
  restored, PASSES with the fix. Verified both ways.
- `db::tests::a_child_bound_first_leaves_the_primary_without_a_creation_ref`
  (new) pins the ordering hazard the server-side pre-registration guards.
  `AppState` has no test constructor, so this is the DB-level check.
- Real UI: `workspace-review.spec.ts` "worktree refresh cannot invent a
  workspace start after the first commit" — **PASS webkit 1.3s / chromium
  1.1s**. Against the pre-fix binary it FAILS with the option enabled,
  i.e. perch offering an invented boundary. Both runs recorded.

### D2 — a Hosted session's review packet was delivered to a CLI that did not exist

`review.batch.send` routed to the native path on `native_ui::supported(&agent)`
alone. That is true for claude and codex, so a **Hosted** session (no
`cli_provider_id`) had its packet written to a native CLI it does not own; the
acknowledgement never arrived and `git-review-delivery` sat on "Waiting for the
agent to receive the review packet…" until the test timed out. Routing now keys
on **ownership** — `session.cli_provider_id.is_some() && native_ui::supported()`
— so Hosted sessions take the ordinary prompt path. The hosted branch's
`unreachable!("review target validated")` became reachable as a result
(`target_agent_id` is client-supplied and a Hosted session can name any provider
the target check allows), so it is now a client error, not a panic.

- `workspace-review.spec.ts` "sends two reviewed anchors as one packet to the
  selected real agent" — **PASS chromium 9.5s, webkit 9.8s**, with a real
  Claude turn on `claude-haiku-4-5` asserted from the model chip before the
  first prompt. This test had **never** passed; §"Two of those e2e failures"
  below recorded it as the real-provider delivery test that was never run.
- Native (CLI-owned) delivery is unchanged: `native-review.config.ts -g
  'claude:'` **2 passed (18.9s)**, chromium 8.6s / webkit 9.7s.
- `paired-phone-flows.spec.ts` **PASS webkit 12.8s, chromium 11.0s**.

### The e2e blocker was three separate problems, not one

The spec's own premise had rotted:

1. It clicked the tab-bar `+` and typed. That `+` now opens a launcher and
   creates nothing, so the prompt went to whichever session was already
   active — one in `/Users/hwiii/Github/perch`, not the fixture. Proven from
   the hub DB: the turn's messages belong to a session whose `cwd` is the
   perch checkout, and the fixture's own sessions had 0 messages, which is
   also why `list_sessions`' visibility filter hid them from the dropdown.
2. The launcher only creates **CLI-owned** sessions, and UI mode over one of
   those renders `NativeCliChat` — no Hosted composer, no model chip. The
   test now creates its session with `session.create` (`createHostedSession`,
   shared with `openReview`'s session path).
3. `toBeDisabled()`/`toBeEnabled()` are **vacuous** on this `<option>`:
   Playwright 1.61.1 computes an `<option>`'s state as *enabled* whenever the
   `<select>` sits inside a `<label>`, which the diff toolbar's does. Isolated
   proof: same markup, `option.disabled` property `true`, `isDisabled()`
   `false`; move the `<select>` out of the `<label>` and it reports `true`.
   The pre-existing `toBeEnabled()` assertion in the sibling test had been
   passing for free. Both now go through `expectWorkspaceStartOffered`, which
   reads the DOM property and the user-visible label.

### Checks

```
cargo test -p perch-core             276 passed (+2 new), protocol parity 2 passed
cargo fmt --check                    clean
cargo clippy --workspace --all-targets   exactly the 5 baseline warnings
npm test -w @perch/web               223 passed
npm run build                        PASS
```

`workspace-review.spec.ts` full file, both engines: **11/12**, the twelfth a
WebKit `git-comment-composer` miss inside `addComment` that **passes in
isolation (9.8s)** — the rotating slow-proxy pattern `AGENTS.md` documents.
`paired-phone-flows.spec.ts` showed the same shape (chromium missed its receipt
in the combined run, passed alone). Evidence:
`e2e/screenshots-cli-rendering/workspace-start-2026-09-22/` (including the
pre-fix failure) and `.../review-routing-2026-09-22/`.

### Still open

Unchanged by this slice: V-07's capture-ordering ceiling, rendered change
summary and direct-host turn recording; V-10's per-device scope, pairing
rotation, encrypted non-loopback transport and QR pairing; V-12 entirely.
Codex-provider evidence is blocked until its quota resets (03:41 EDT
2026-09-22); no codex prompt was issued here.

## Cheap-model setup, restart and provider verification — 2026-09-22 UTC

### Changes and regression

`cheapModelEnv()` rebuilt its private home whenever the native UI test restarted
its core. `symlinkSync()` then hit an existing entry, and the broad catch returned
an empty environment. The restarted fixture inherited the user's config home
instead of the intended cheap model pin. Existing matching links now survive
restart, including dangling runtime links; wrong entries, missing config and
unsupported providers stop setup. Original config files and extension directories
remain untouched. An injectable user-home path lets the regression use synthetic
config homes instead of credentials.

`e2e/cheap-model.spec.ts` failed before the fix with a returned `{}` on the second
Pi setup. It now passes for Pi, OMP and Codex restarts, unchanged originals and
extension links, missing config, unknown providers, and Claude/OpenCode pins.
No browser/provider runs are needed by this regression.

Native review checks the exact model before any prompt; native UI checks every
provider, including after core recovery and a fresh conversation. Hibernation
checks the CLI model both before initial input and after wake. Its tmux cleanup
now uses exact names. The default config discovers native-ui, native-review,
paired-phone-flows and cheap-model; native specs retain their focused timeout
budgets. `--list` reports 12 tests across those four specs.

OpenCode's runtime override merges existing inline config while setting both
`model` and `small_model` to `anthropic/claude-haiku-4-5`, following the
[official config documentation](https://dev.opencode.ai/docs/config/). This has
only a config regression check: `command -v opencode` finds no executable here.
The current bridge obtains the model from transcript rows, leaving a fresh
session unknown; the new guard blocks prompts in that state. Actual selected
model observability and OpenCode end-to-end verification remain open.

### Commands and results

All commands below run from `e2e/`; browser runs were headless with the required
process permissions. No global provider settings or extensions changed.

```sh
npx playwright test --config=provider-config.config.ts cheap-model.spec.ts --project=chromium
npx playwright test --list native-ui.spec.ts native-review.spec.ts paired-phone-flows.spec.ts cheap-model.spec.ts
npx playwright test --config=native-ui.config.ts native-ui.spec.ts -g 'pi:' --project=webkit
npx playwright test --config=native-review.config.ts -g '(pi|omp|codex):' --project=webkit
npx playwright test --config=cli-rendering.config.ts agent-hibernation.spec.ts --project=webkit
npx playwright test --config=native-ui.config.ts native-ui.spec.ts -g '(omp|codex):' --project=webkit
```

| Check | Result |
| --- | --- |
| Synthetic config regression | 1 pass, 241ms suite; failed before fix |
| Pi native UI / core crash | 1 pass, 18.4s suite (18.1s test) |
| Pi / OMP / Codex native review | 3 passes, 28.5s suite (9.3s / 10.1s / 8.8s) |
| OMP / Codex native UI / core crash | 2 passes, 1.1m suite (32.9s / 30.8s) |
| Claude idle hibernation / same-session wake | 1 pass, 9.5s suite (9.1s test) |

The seven real WebKit checks used Luna or Haiku 4.5, verified before prompts.
They exercise review ownership/acknowledgement/idempotency, native view changes,
core restart with the same provider PID and identity, phone control transfer,
context recall, cancellation and stop. The hibernation case instead verifies the
old PID exits and a new one resumes the same conversation and recalls its token.
No Chromium interaction reruns or new full Rust/web suite runs in this test-only
slice. Standalone e2e typechecking was attempted and stopped at TS2688: Node type
definitions are not installed in that scope; no new dependency was added.

### Hibernation guard failure and correction

The first run failed before sending its recall prompt: the resumed native UI has
no model chip. The fixture's retained `SessionStart.event` has `source: resume`
and no `model`. This is missing telemetry, not evidence of an expensive model.
The corrected guard checks the resumed CLI's actual `Haiku 4.5` label before
switching to UI and submitting; it does not infer a model from old messages.
The retry passed. The native UI still honestly omits the unknown chip after wake.

Artifacts: `e2e/screenshots-cli-rendering/webkit/model-guards-2026-09-22/`.
This contains screenshots, core logs, native snapshots, the first hibernation
failure with selected hook fields, and the passed hibernation artifacts.
Prior artifacts are in `/tmp/perch-model-guards-before-2026-09-22/`.
Inspected the passed hibernation screenshot (same token recalled, Ready) and the
Codex phone screenshot (Luna chip, same token, control active, no viewport spill).
No claim of a full visual audit.

### Still open

The default suite has older cost assumptions: `cli-sync.spec.ts` explicitly sends
a Sonnet prompt. It was not run. Audit that and other legacy hosted/CLI fixtures
before the final full suite. OpenCode is unverified as above. V-07/V-10/V-12,
remote coverage and measured resource budgets remain partial. No commit/push;
all test handles completed and fixtures cleaned their recorded processes.


## Claude native acknowledgement recheck — 2026-09-22 UTC

Verified the newer handoff's acknowledgement fix against the current source
and rebuilt assets. No production or test source changes in this slice.

### Commands and results

From the repository root:

```sh
cargo test -p perch-core a_prompt_the_cli_wrapped_in_paste_tags_still_counts_as_submitted
cargo build -p perch-core
npm run build
```

The focused Rust regression passes (1 test); both builds pass. The web build
still reports its existing large-bundle warning. This is not a new full-suite
run; previous 274-unit / 223-web totals remain historical evidence.

From `e2e/`, headless with process permissions required for browser startup:

```sh
npx playwright test --config=native-review.config.ts -g 'claude:' --project=webkit --project=chromium
npx playwright test --config=native-ui.config.ts native-ui.spec.ts -g 'claude:' --project=webkit --project=chromium
```

- Review: **2 passed, 21.5s** (Chromium 10.9s, WebKit 10.0s).
- Native UI: **2 passed, 33.6s** (Chromium 15.1s, WebKit 17.9s).

Both specs pin Claude to `claude-haiku-4-5` through the private fixture env and
assert the actual selected model before prompting. They stop their own core
and recorded tmux sessions. No global provider changes, other provider runs,
commit or push. Initial sandbox launches failed at 0ms (Chromium Mach port
permission failure; WebKit startup abort), before fixtures or prompts; approved
escalated headless launches worked. An initial anchored grep `^claude:` matched
no tests because Playwright matches the full test title; use `claude:` above.

### Observed interactions

Review tests verified two anchored comments, a phone's refused send while
another viewer owns control, release/retry, the acknowledged delivery banner,
the assistant's expected acceptance response, and repeated send without an
extra user turn. Provider PID/session identity and fixture files stayed intact.

Native UI tests verified a file-tool turn, CLI follow-up with the same context,
UI draft retention and refusal to append to a CLI draft, core crash/restart
and reload with the same provider PID/session and transcript, phone control
transfer with desktop input disabled, a phone follow-up, cancellation of a
running tool, and explicit CLI stop.

Artifacts (screenshots, core logs and native snapshots) are preserved under:
`e2e/screenshots-cli-rendering/{webkit,chromium}/claude-ack-recheck-2026-09-22/`.
Prior fixed-name artifacts were copied before running to
`/tmp/perch-claude-verification-before-2026-09-21/`.

Inspected the WebKit wide/narrow native UI and review screenshots: Haiku model,
Ready state, expected replies, anchored comments and acknowledged delivery are
visible. Native UI phone controls fit the viewport; the existing assertion
also checks document width. The mobile review capture clips long comment text
inside its horizontally constrained diff area; this run does not prove V-11
layout completeness. Claude's paste wrapper tags are visible in user messages.

### Remaining scope

These loopback phone contexts do not re-prove LAN pairing, encryption, device
scopes or every provider. V-07, V-10 and V-12 remain PARTIAL. The default
Playwright config currently omits native-ui, native-review and paired-phone
specs (focused configs discover them). Before a final full-suite/provider
sweep, register missing specs and close cheap-model guard gaps: native-review
asserts Claude's model only, and native-ui exempts OpenCode. No such unguarded
provider was run here.


## Paired-phone flows and the native Claude acknowledgement — 2026-09-22

### The defect

`native_ui/claude.rs` accepted a prompt only when the `UserPromptSubmit` hook
reported text byte-identical to what perch had sent:

```rust
event["prompt"] == payload["text"]
```

Claude Code **2.1.278** wraps every bracketed paste — which is how
`prepare_input` submits — in `<pasted_content id="...">` tags with a random id.
Captured from the installed CLI, for a prompt perch sent bare:

```
'\n\n<pasted_content id="cafd">\nReply with exactly PHONE_UI_tyrz2w. Do not use tools or modify files.\n</pasted_content id="cafd">\n'
```

So the match could never succeed and **no prompt perch sent to a native Claude
session was ever acknowledged**. The 10s window in `native_ui.rs` expired and
delivery settled `unconfirmed`, which the UI honestly renders as "Delivery
could not be confirmed. Check the agent conversation before starting another
review." — for a packet the agent had in fact received and answered.

Acceptance now requires the reported prompt to *contain* the sent text, still
pinned to the same pid, the same provider session, and a submission newer than
the stamp taken before the write. The real invariant is that the CLI submitted
our text; the CLI is free to decorate it, and containment survives the wrapper
changing shape again. Regression
`a_prompt_the_cli_wrapped_in_paste_tags_still_counts_as_submitted` uses the
captured payload and fails against the old check.

Claude-only by construction: Pi/OMP/OpenCode/codex return an explicit
`NativeEvent::Ack` (`native_ui/mod.rs`), so none of them inferred acceptance
from a hook payload. This is also why `native-review.spec.ts` recorded a claude
PASS on 2026-09-15 and would fail now — the CLI changed under us, which no
perch test would have caught without re-running it.

### Observed

`e2e/paired-phone-flows.spec.ts` (new) drives the two V-10 items
`device-pairing.spec.ts` cannot: Chat/UI <-> CLI and the review-note packet,
from a **paired** phone at the LAN origin. Neither is reachable with a
`/bin/sh` fixture (native UI is a per-provider bridge;
`server/session.rs::resolve_review_target` refuses a provider without native
review controls), so it runs real Claude on `claude-haiku-4-5` via
`cheapModel.ts`, asserting the model chip before either of its two turns.

Observed in a real paired phone context: pairing through the gate; CLI -> Chat/
UI for the same session with `data-native-pid` set and the cheap-model chip; a
real UI turn answered; CLI <-> UI round-trip with the same terminal id and an
unchanged pid; the Git pane; two anchored notes previewing as "2 anchored
notes"; and, after the fix, the packet delivering:

```json
{"received":"review.batch.delivery","delivery":"unconfirmed"}   // pre-write settle
{"received":"review.batch.delivery","delivery":"delivered"}     // acknowledged
{"received":"review.batch.send.result","delivery":"delivered"}
```

`unconfirmed` before `delivered` is correct, not a flicker: the row is settled
before the write and only advances once the CLI reports the submission back.

The spec **passes on WebKit and Chromium** (12.1s / 11.7s) alongside both
turnbot specs — 6 passed, 46.1s. The post-send conversation is asserted from
the `agent.ui.snapshot` frames the phone is already subscribed to rather than
from the DOM: the conversation is server state, and which pane the phone
happens to be showing is not part of this gate. Screenshots inspected:
`e2e/screenshots-cli-rendering/{webkit,chromium}/paired-phone-2026-09-22/`.
Full sweep: 274 unit + 2 protocol tests, 223 web tests, fmt clean, clippy at
its five baseline warnings, both builds pass.

### Investigations that were wrong

Two mechanisms were proposed for the `unconfirmed` banner and **both were
falsified**; they are recorded so they are not repeated.

1. *A tty discards writes past `MAX_INPUT`.* A 2.4 KB unchunked `write_all` to
   a real pty master reached the child complete. A write-chunking change in
   `terminal.rs` was written, approved and then **reverted** when its own
   regression test passed with the fix removed.
2. *The tmux client hop loses large writes.* A 3.5 KB single write through a
   pty into `tmux attach` delivered 60/60 lines; only the 12 bracketed-paste
   marker bytes were stripped, by tmux, as expected.

Both rested on an unmeasured premise: the review packet is **~750 bytes**. It
always reached Claude and always fired `UserPromptSubmit`; only the
acknowledgement was broken. An intermediate claim in this session that "the
packet never arrived" was mistaken — it came from reading the hook file
mid-run, before the send had landed.

### Still open

V-10 stays **PARTIAL**. Closed here: the paired-phone Chat/UI <-> CLI and
review-note flows, and the acknowledgement defect blocking them. Untouched:
per-device scope and pairing versioning/rotation (a paired device has the same
access as a local one), encrypted non-loopback transport (the token crosses a
LAN in the clear), and QR pairing. V-07 and V-12 scope is unchanged.

## Honest last-turn review state — 2026-09-21

Closed the V-07 slice the previous checkpoint traced: the review surface could
present an **older** turn under the label "Last agent turn", and a client could
keep offering a comparison the server no longer had. Both defects are fixed at
their shared source, with a third found while verifying.

### What changed

1. `server/agent_history.rs` — `last_completed_turn` scanned 16 rows for the
   first *completed* one, so a newer failed or open row was skipped and an
   older success was returned under that label. It is now `last_agent_turn`
   and reports the **newest** row plus an explicit state. `completed = false`
   cannot say *why* a row is open, so the live runtime decides: the lifecycle
   registry for managed CLI turns (it owns them; `observe_session` returns
   early for those, so `running_sessions` is not their truth), otherwise
   `running_sessions`. Working/Blocked/Reconnecting is a turn in flight;
   anything else means the capture will never close. No row is rewritten,
   invented or deleted. The decision is split into `summarize_turn(row,
   in_flight)` so it is testable without an `AppState`.
2. Protocol parity — new `AgentTurnState` (`complete` / `running` /
   `unavailable`) on `AgentTurnSummary` in **both** `protocol.rs` and
   `protocol.ts`, `#[serde(default)]` so a peer predating it still parses as a
   finished turn. `GitStatusResult::last_agent_turn` **lost its
   `skip_serializing_if`**: it is now always on the wire, including as `null`,
   because only an explicit `null` can tell a client the server has no turn.
   No existing required field changed type, so older peers keep parsing.
3. `packages/web/src/gitReviewStore.ts` — the merge was
   `...(result.lastAgentTurn ? … : {})`, so an absent summary never cleared a
   cached one. It now applies whenever the **key is present**, `null`
   included. The synthetic status rebuilt from `git.action.result` omits the
   key entirely, so that path still preserves the summary — which is why the
   distinction is "key present", not "value truthy".
4. `packages/web/src/components/WorkspaceGitReview.tsx` — one derived
   `turnBase` gates the selector option, the preset and the diff target.
   Labels are distinct facts: `(none recorded)`, `(agent · running)`,
   `(agent · not captured)`. An effect keeps the preset pointed at whichever
   turn is current and falls back to the working tree when the turn stops
   being reviewable, so an already-loaded diff cannot outlive its summary.
   `unavailable` renders an explicit note instead of an offer.
5. `source_control.rs` (found while verifying the running state) — comparing a
   content snapshot against the working tree made Git report an untracked file
   that the snapshot carries as **deleted**, while the untracked pass added it
   again: one path, two entries, one of them a deletion the user can disprove
   by looking at the disk. The working-tree entry now replaces the phantom.
   The existing guard beside it already named this hazard for the two-endpoint
   targets; this extends it to the base-only compare the turn presets use.
   Marked `ponytail:` — the survivor reads "added" rather than "modified"
   against the base's copy, which needs a temporary index to do properly.

### Runnable checks (each verified failing before its fix)

- `agent_history::tests::an_uncaptured_newest_turn_is_reported_instead_of_an_older_success`
  — real Git/SQLite fixtures: a finished turn, a running one, that same row
  stranded by an injected completion failure, and the next turn restoring
  review. Against the old selection it reports `Complete` where `Running` is
  correct. The stranded row stays incomplete throughout.
- `gitReviewStore.test.ts` "clears a cached agent turn on an explicit null but
  keeps it when the key is absent". Against the old merge it keeps the stale
  summary.
- `source_control::tests::an_untracked_path_is_never_also_reported_deleted_against_a_snapshot`
  — against the old code the diff carries `loose.txt` twice, once `Deleted`.

### Verification

- `cargo test -p perch-core`: **273 unit + 2 protocol tests passed**.
- `cargo build -p perch-core`, `cargo fmt --check`: passed.
- `cargo clippy --workspace --all-targets`: five baseline warnings, unchanged.
- `npm test -w @perch/web`: **223 passed**; `npm run build` passed.
- `cd e2e && npx playwright test --config=cli-rendering.config.ts agent-turn-review.spec.ts -g 'turnbot' --project=webkit --project=chromium`:
  **4 passed (21.2s)**, fixture provider only — **no paid model request**.
  The new spec drives one finished turn, a genuinely running turn (the fixture
  agent gained a `hang` prompt that withholds its completion marker), that row
  losing its end, a reload, and the next turn restoring review.
- `cd e2e && npx playwright test --config=cli-rendering.config.ts workspace-review.spec.ts -g "distinct Git sources|workspace start keeps|mobile Git pane" --project=chromium`:
  **4 passed** — the neighbouring Git/review surfaces the shared diff fix touches.
- Screenshots inspected, both engines:
  `e2e/screenshots-cli-rendering/{webkit,chromium}/turn-state-2026-09-21/`.
  `turn-running.png` shows the selector reading `Last agent turn (turnbot ·
  running)`, the summary "turn in progress, comparing against the working
  tree", and two diff entries with no phantom deletion. `turn-unavailable.png`
  shows Compare fallen back to `Working tree`, the "not captured" note, and no
  turn summary — the stale comparison is gone rather than silently wrong.

### Stated honestly

- The `unavailable` browser state is produced by writing the durable shape a
  failed capture leaves into the test's **own** fixture database. The
  production failure path itself is covered by the Rust regressions, which
  inject real capture failures. No browser fault-injection harness exists.
- `running` is distinguished from `unavailable` by live runtime state, not by
  the database. A core restart that loses an in-flight turn therefore reports
  `unavailable` once nothing is running, which is the honest answer, but it is
  not a claim that the turn *failed* rather than being interrupted.
- An `AgentTurnSummary` carries an empty `beforeRef` in the one case where a
  row exists but its before side was never recorded. `state` gates comparing,
  not `beforeRef`; a client predating `state` would offer a broken base in
  that already-degraded case.

### Remaining V-07 scope

V-07 stays **PARTIAL**. Closed here: honest selection of the newest turn, the
explicit failure state, and stale client state. Still open, unchanged:

- an implicit session-created workspace still has no recorded creation ref;
- turn boundaries only exist for local workspaces — a direct-host session's
  turns are not recorded, because Git for that workspace is not reachable from
  this process;
- the capture-ordering ceiling (a turn beginning before the spawned boundary
  capture finishes would attribute its first milliseconds to the before side);
- the full change summary the gate names (counts/narrative across a turn) is
  stored but is not rendered beyond the diff and the one-line summary;
- accepted/queued/rejected prompt semantics and legacy observer ordering;
- capture cost/retention measurement.

V-10 and V-12 remain PARTIAL and the complete SPEC scope remains active.
No commit or push was performed; no test process remains running.

## Failed completion cannot contaminate the next turn — 2026-09-21

Fixed a remaining V-07 attribution defect in `server/agent_history.rs`.
The previous native-runtime fix recorded the completed lifecycle edge before
capture could fail, but the history recorder still retained its open snapshot
ID on error. A later completion could fill that row with newer files, or the
next prompt could reuse the old before boundary and combine two turns.

The shared recorder now consumes the pending snapshot ID before session/workspace
reads, Git capture/comparison, or final database persistence. If those operations
fail, the durable row stays incomplete and subsequent notifications cannot
recapture a later endpoint for it. A subsequent prompt creates a new baseline.
No existing snapshot data is deleted or fabricated. This applies to all callers
of the shared recorder, not just native UI snapshots.

One runnable regression in the same module uses disposable Git/SQLite fixtures:
`failed_completion_never_reuses_the_previous_turn_boundary`. It injects both a
session-read failure and a completion-write failure, exercises a repeated Ready
and a new prompt immediately after failure, and verifies exactly one of two
rows completes, with only `second.txt` attributed to the second turn. The test
failed before the fix and passes after it.

Verification:

- `cargo test -p perch-core`: **271 unit + 2 protocol tests passed**.
- `cargo build -p perch-core`, `cargo fmt --check`: passed.
- `cargo clippy --workspace --all-targets`: passed with five baseline warnings.
- `cd e2e && npx playwright test --config=cli-rendering.config.ts agent-turn-review.spec.ts -g 'turnbot:' --project=webkit --project=chromium`:
  **2 passed (11.4s)**. These local shell fixtures use no paid model requests.
  They verify the normal rendered agent-turn diff, exclusion of human edits,
  rename/delete and staged-empty comparisons, reload and snapshot survival
  through Git GC. The injected failure is covered by the Rust regression,
  not by a browser fault-injection scenario.
- Artifacts: `e2e/screenshots-cli-rendering/{webkit,chromium}/failed-boundary-2026-09-21/`.
  Logs: `/tmp/perch-failed-boundary-{tests,clippy}-2026-09-21.log`.
  The WebKit agent-turn diff screenshot was inspected.

Only the history recorder and its test changed in production sources for this
slice. No commit/push or paid model turn was performed; no test remains running.
V-07 remains PARTIAL: incomplete-row crash recovery/explicit failure presentation,
accepted/queued/rejected prompt semantics, legacy observer ordering, capture
cost/retention and remote coverage remain. In particular, the selector can
still offer an older completed turn when newer rows are incomplete; this slice
does not add a user-facing failure state. V-10/V-12 and the complete SPEC scope
remain active as described below.

## Two native panes and explicit cheap-model checks — 2026-09-21

The previous goal remains active; no completion or commit/push is claimed.
Read the September 16 checkpoint below for the production fixes already in
this worktree. This continuation added their missing two-pane browser coverage.

- Extended the existing `e2e/native-providers.spec.ts`, registered it in the
  main config and `native-ui.config.ts`, and retained its CLI draft/reload,
  separate-process and shell checks. OMP and Pi now switch to native UI in one
  tab, each submit a real turn, and both show their own complete reply and Ready
  state. The test verifies an unsolicited Pi snapshot reaches the secondary
  session while the connection remains subscribed to OMP and its composer has
  focus; native PIDs remain distinct and unchanged. This exercises the existing
  observer-routing fix through the browser. No production implementation changed.
- Reaffirmed the user's cheapest-model requirement in `goals.md`: verify the
  actual model before any prompt and stop if it is unknown/unexpected. Both
  native panes asserted `gpt-5.6-luna` before this test sent either prompt.
- `cheapModel.ts` now creates a private Pi settings overlay that explicitly pins
  Luna/openai-codex/low reasoning, instead of relying on the user's current
  default. The combined OMP/Pi fixture uses a private Pi launcher to select that
  overlay because both CLIs use `PI_CODING_AGENT_DIR` with incompatible config
  formats. Global provider settings and user extensions were not changed.
- Cleanup uses only tmux names recorded by this fixture's core, and the core log
  and two-pane screenshot are saved as test artifacts.

Verification: `cargo build -p perch-core` passed (production code unchanged).
`cd e2e && npx playwright test --config=native-ui.config.ts native-providers.spec.ts --project=webkit`
passed **1 test (15.1s; test 14.7s)**. Its desktop screenshot shows both native
panes, Luna model chips, distinct replies and Ready states. Evidence:
`e2e/screenshots-cli-rendering/webkit/native-split-2026-09-21/`.

Earlier attempts: sandboxed WebKit aborted before fixture startup; the same
headless test ran with approved broader execution access. Its first model check
then stopped on Pi's `unknown` model before sending any prompts, exposing the
shared config-home problem. After separate overlays, a test assumption that
Dockview focus changes the tab's session subscription failed; current code
keeps the top-level subscription, so the assertion now checks that behavior
and verifies the secondary session's unsolicited update. Earlier evidence is
under `e2e/screenshots-cli-rendering/webkit/native-split-first-2026-09-21/`.
No test process remains running. Chromium was not rerun for this new slice.

Next: retain the full V-07/V-10/V-12 and resource-budget scope below. The
September 16 two-pane browser-test gap is now covered for this OMP/Pi WebKit
flow; it does not prove the complete multi-agent safety, remote or paired-phone
contract. Do not rerun unrelated real-agent suites without cheap-model checks.

## Provider environment delivery and native snapshot transport — 2026-09-16

Three defects, each found from the unresolved Pi freeze and the five-provider
sweep it blocked. All three are in shared paths, so the fixes are one change
each rather than one per caller.

**A failed turn-history capture silently swallowed the live transcript.**
`server/native_ui.rs`'s snapshot callback returned early when
`observe_native_turn` failed, before the `AgentUiSnapshot` broadcast, so any
transient database or Git error on a running→ready edge left the web view
frozen on its last mid-stream snapshot and still showing "Working" while the
CLI had already answered. Bookkeeping now logs and the snapshot always
publishes; a *failed* `session_exists` read is no longer treated as deletion.
This is the exact symptom class of the earlier unexplained Pi WebKit run; it
is **not proven** to have been that run's trigger, whose evidence no longer
exists.

**A failed capture also left the runtime believing the turn was still running.**
`observe_native_turn` set `native_running` only after `record_turn_boundary`
could fail, so the next turn's completion would close the previous turn's open
boundary and report one summary spanning both turns' changes. The edge is now
recorded first. Regression test:
`agent_runtime::tests::a_failed_boundary_capture_still_records_the_completed_native_turn`
(verified failing before the fix, passing after).

**The provider environment never reached a CLI when a tmux server already
existed.** `provider_environment::prepare` short-circuited the default policy
and let the child inherit — but the child is started by `tmux new-session`,
which hands over the *tmux server's* environment. Observed directly:

`PERCH_ENV_PROBE=hello tmux new-session -d -s probe -- sh -c 'printenv PERCH_ENV_PROBE'` → exit 1 (unset)

So the login-shell PATH `boot.rs` works to adopt, and anything the user
exported for their CLI (an API key, `ANTHROPIC_MODEL`, `CODEX_HOME`), silently
never arrived unless perch happened to start the tmux server itself. The
default policy now uses the same private bootstrap the restrictive policies
use, *without* `env -i`, so this core's environment is added on top of the
session's and tmux's own `TMUX`/`TMUX_PANE` survive. Names no shell can export
(bash's `BASH_FUNC_x%%`) are dropped instead of failing the launch. Test:
`provider_environment::tests::the_default_policy_adds_this_environment_without_discarding_tmux_own`.
This is why the Claude fixtures' `ANTHROPIC_MODEL=claude-haiku-4-5` had no
effect, and it is a user-facing bug, not only a test one.

**Every native codex launch exited at startup.** codex-cli 0.154.0 (updated
from the 0.146.0 CLAUDE.md was written against) refuses to bind an app-server
socket whose path contains a symlinked directory, and macOS `/tmp` is a link to
`/private/tmp`, so perch's `/tmp/perch-native-<uid>/<key>.sock` was rejected and
the pane showed `[exited]`. Probed directly:

- `unix:///tmp/...` → `Error: socket directory path exists and is not a directory: /tmp`
- `unix:///private/tmp/codex-probe.sock` → `Error: Operation not permitted` (that directory is world-writable)
- `unix:///private/tmp/<0700 dir>/p.sock` → socket bound, server alive

`native_ui::paths()` now canonicalizes its root *after* the existing
not-a-symlink/0700 ownership check, so the parent chain is resolved without
ever following a symlinked root. Both spellings name the same inode, so a
session started before this still reconnects.

### Cheapest-model pinning for the real-turn suites

The sweep runs real turns against the user's own quota and a previous run died
on a provider usage limit, so `e2e/cheapModel.ts` now pins every fixture to the
cheapest model: `ANTHROPIC_MODEL` for claude, and for codex/omp a private
config home (`CODEX_HOME` / `PI_CODING_AGENT_DIR`) whose entries are symlinks
to the real one with only the config file rewritten — no global provider
setting is changed and no user extension or plugin is disabled. The UI now
asserts the model chip *before* the first turn, so a pin that fails to take
costs nothing; that assertion caught the omp pin failing, which is how the
tmux environment defect above was found.

### Observed runs (WebKit, `--config=native-ui.config.ts --project=webkit`)

| Provider | Result |
| --- | --- |
| pi | **PASS** 22.3s — first WebKit pass of this spec; the two earlier runs failed |
| omp | **PASS** 23.2s — on `gpt-5.6-luna` via the pinned config home |
| claude | **PASS** 17.0s — `haiku` chip now genuinely reflects `ANTHROPIC_MODEL` |
| codex | **PASS** 34.5s — after the socket-path fix below; on `gpt-5.6-luna` |
| opencode | **BLOCKED** — not installed on this machine (`~/.opencode` absent) |

Each passing run exercised, in one native process: UI prompt with a file tool,
CLI follow-up in the same conversation, extension reload, recovery across a
core SIGKILL, phone control transfer and reply, cancellation of a running turn,
and explicit Stop CLI. Screenshots (desktop + phone) are preserved under
`e2e/screenshots-cli-rendering/webkit/native-ui-{pi,omp,claude,codex}-*-2026-09-16/`;
the codex phone shot was inspected at 390px — tabs, model chip, three turns and
composer all legible with no horizontal overflow.

One WebKit-only page error was investigated and is **not** a product defect:
WebKit reports a *caught* fetch rejection as a page error, and `App.tsx` probes
`/pair` on every socket drop while these tests kill the host on purpose
(`isPaired` already treats an unreachable host as still paired — confirmed in
the shipped bundle). The specs now exempt that one message by name and nothing
else. A standalone load+kill probe did not reproduce it, so it is timing
dependent.

### Native review, and a fourth fix: snapshots for more than one agent

`native-review.config.ts --project=webkit` then passed for every installed
provider — pi 12.0s, omp 17.7s, claude 10.3s, codex 11.6s — covering the phone
review packet reaching the native CLI exactly once while control is respected.

Chasing that suite surfaced one more defect, now fixed. `AgentUiSnapshot` was
session-scoped in `should_forward_to_viewer`, and a connection has exactly one
active session (`set_active_session` removes it from the previous session's
viewer set). Two native chat panes for *different* sessions in one browser tab
therefore left the unfocused one frozen on whatever its `agent.ui.get` reply
had returned — directly against "observe several coding agents working in
parallel from one project". The filter now also forwards a snapshot to a
connection that *observes* that agent (`AgentLifecycleRegistry::observes`,
an in-place scan of the bounded map, no `list()` allocation per broadcast).
Failing open was rejected deliberately: it would hand a paired phone the
transcripts of sessions it never opened. The chat stream stays strictly
session-scoped, which the regression test asserts alongside the widening:
`session_viewer_filter_tests::a_native_snapshot_reaches_a_connection_observing_that_agent_elsewhere`.

The two-pane case itself has **no browser test yet** — the fix is covered by
the unit test above plus a full re-run of the pi native UI spec in WebKit to
prove the single-pane path did not regress.

### Local checks

`cargo test -p perch-core`: **270 unit + 2 protocol tests pass** (267 before
this slice, plus the three regression tests above).
`cargo fmt --check`: clean. `cargo clippy --workspace --all-targets`: the same
five baseline warnings, none added. `cargo build -p perch-core` and
`cargo build -p perch-desktop`: both pass.

### Still open

V-07, V-10 and V-12 remain **PARTIAL**, unchanged by this slice: accepted/
queued/rejected turn semantics, crash recovery of open boundaries, measured
capture cost and retention, legacy/direct-host coverage, encrypted non-loopback
transport and the full paired-phone contract, and several-agent resource
evidence. The native *review* suite has not been rerun since these fixes.
One further finding is recorded in the handoff and not addressed: 158
`perch-cli-agent-*` tmux sessions from earlier fixture runs are still alive
here, holding about 11 GB RSS across ~106 processes. They were deliberately
not killed — `goals.md` confines fixture cleanup to a run's own recorded
processes — but they make any resource-budget measurement dishonest until
the user clears them.

## Implicit workspace creation boundary — 2026-09-15

Local `session.create` now reads HEAD before creating the project/workspace and
before announcing the session. It reuses the existing Git resolver and the
idempotent project transaction; existing workspaces retain their original ref
(or their honest missing baseline). Unknown-session recovery follows the same
creation path. This replaces the old missing-baseline behavior for newly
created local session workspaces; legacy/direct-host gaps remain.

Changed `server/session.rs` and parameterized the workspace-start browser check
in `e2e/workspace-review.spec.ts`. The session case creates through the real
WebSocket protocol without launching a CLI, then performs comparison, inline
comment, reload and mobile review through the rendered app. It also creates a
second session after HEAD advances and verifies the workspace ID and baseline
remain unchanged.

Verification: **267 core unit tests passed**; core build and format passed;
workspace Clippy retained five baseline warnings. The two Chromium workspace
start flows passed (11.8s): explicit registration and implicit session creation.
Mobile screenshots inspected: Workspace start is selected, original HEAD and
current worktree lines are visible, and the saved unresolved comment remains.
Evidence: `e2e/screenshots-cli-rendering/chromium/implicit-workspace-2026-09-15/`.
Logs: `/tmp/perch-implicit-workspace-{tests,build,clippy}.log`.


### WebKit recheck and regression coverage

The previous browser setup hang did not reproduce: a stage-logged standalone
WebKit launch/context/page/click/close probe passed (log:
`/tmp/perch-webkit-stage-probe.log`). The two workspace-start flows then passed
in WebKit (7.7s), using:

`cd e2e && npx playwright test --config=cli-rendering.config.ts workspace-review.spec.ts -g 'workspace start keeps' --project=webkit --timeout=90000`

The WebKit mobile comparison screenshot was inspected. Evidence is preserved in
`e2e/screenshots-cli-rendering/webkit/implicit-workspace-2026-09-15/`.
The existing cross-engine config now includes workspace review, agent-turn
review, hibernation and device pairing, making these checks reproducible.

The initial Chromium regression run passed both agent reviews and hibernation,
but pairing failed its old assertion that an implicit workspace has no baseline.
Updated that assertion to select Workspace start and verify both the original
committed line and the phone-visible edit. This reflects the implemented
creation boundary; revocation and quiet-working checks remain intact.
The failed iteration is preserved under
`e2e/screenshots-cli-rendering/chromium/implicit-workspace-regression-first-2026-09-15/`.

Final regression command:

`cd e2e && npx playwright test --config=cli-rendering.config.ts agent-turn-review.spec.ts agent-hibernation.spec.ts device-pairing.spec.ts --timeout=240000`

**8 passed (1.8m): four each in WebKit and Chromium.** Both engines exercised
real Claude turn review and hibernation/resume, the configured-provider review,
and phone pairing/input/reload/creation-baseline/files/host-restart/revocation.
Keepers: `e2e/screenshots-cli-rendering/{webkit,chromium}/implicit-workspace-regression-final-2026-09-15/`.
Desktop build also passed (`/tmp/perch-implicit-workspace-desktop-build.log`).

V-07 remains PARTIAL: accepted/rejected/queued turn semantics, crash recovery,
capture cost/retention, legacy/direct-host behavior and broader provider/remote
verification still need work. V-10/V-12 gaps remain open. WebKit now works
for the focused flows above; broader native-provider/remote checks remain. The full goal is active; nothing was committed/pushed.

## Turn-history audit follow-up — 2026-09-15

This checkpoint supersedes the turn-history failure and next-step list in the
older audit below. **V-07, V-10 and V-12 remain PARTIAL; the full goal is active.**
No commit or push was made.

### Changes completed

- Configured output markers now drive completion/blocked status across split
  PTY reads; native status remains authoritative. Empty markers are rejected.
  Submitted prompts have a distinct lifecycle signal, and an ordered event
  stream preserves rapid Working/Blocked/Done transitions without treating
  startup or repaint as a new turn.
- Managed CLI input and native structured prompts capture their before boundary
  before dispatch. Native running-to-ready, configured completion and actual
  process exit capture the after boundary. Replayed/startup Ready cannot close
  a native turn. Managed sessions skip the legacy asynchronous status observer.
- Content snapshots now have internal Git refs, so garbage collection retains
  recorded comparisons. These capture working-tree content using a scratch
  index without changing the real index, branch or worktree.
- Changed-path summaries compare the actual before/after trees instead of
  unioning dirty paths. Database completion persists that exact path list.
- The browser review test now covers both a configured provider and real Claude:
  two agent-edited paths, pre/post-turn human edits excluded, rename/delete and
  empty staged comparisons, reload, and Git garbage collection. Fixture trust
  prompts are explicitly accepted only for its temporary test repository.

Primary implementation: `agent_fleet.rs`, `agent_runtime.rs`,
`server/{mod,agent_history,native_ui}.rs`, `source_control.rs`, `db/prompts.rs`.
Browser coverage: `e2e/agent-turn-review.spec.ts` plus the prior pairing and
hibernation regressions.

### Verification observed

- `cargo test -p perch-core`: **267 unit + 2 protocol tests passed**.
  The Git timeout fixture now allows two seconds for its child to start under
  build load; it still verifies timeout and descendant process-group cleanup.
- `cargo fmt --check`, `cargo build -p perch-core`, and
  `cargo build -p perch-desktop`: passed.
- `cargo clippy --workspace --all-targets`: passed with the same five baseline
  warnings. No frontend source/protocol shape changed in this slice.
- `cd e2e && npx playwright test agent-turn-review.spec.ts agent-hibernation.spec.ts device-pairing.spec.ts --project=chromium --timeout=240000`:
  **4 passed (1.1m)**. Real Claude review screenshot inspected: Last agent turn
  (claude), exactly two changed paths, added file contents and tracked-file
  diff visible. This proves the tested local paths, not all V-07 requirements.
- Evidence copied to
  `e2e/screenshots-cli-rendering/chromium/turn-history-2026-09-15/`.
  Local check logs: `/tmp/perch-turn-history-tests-final.log` and
  `/tmp/perch-turn-history-clippy-final.log`.
- WebKit remains unverified; the previous standalone setup hang is unresolved.

### Remaining work and caveats

1. V-07: record implicit-workspace baselines at actual creation; support
   crash recovery of open boundaries and correct accepted/queued/rejected
   prompt semantics. Raw CR/LF is still an imperfect submission signal.
   Native enqueue failures can leave a provisional baseline/unconfirmed
   operation. Legacy hosted capture remains asynchronous and uses process-global
   state. Bounded lifecycle overflow is logged, not recovered.
2. Snapshot capture still rehashes a repository using `read-tree HEAD` plus
   `add -A`; measure populated cost before optimizing. The global capture lock,
   cancellation cleanup, storage limits and retained-ref pruning need work.
   Path lists cap at 512 without a visible truncation indicator. Do not claim
   bounded capture cost or complete exact counts for larger changes.
3. V-10: encrypted non-loopback transport, pairing scope/version semantics,
   rename/revoke confirmation and the full native UI/CLI/review/approval phone
   flows remain. V-12 needs several agents/worktrees, working/blocked/draft/
   mobile safety, remote coverage and resume/fallback evidence.
4. Isolate WebKit setup, run remaining provider/remote flows and populated
   resource-budget checks, and address the broader suite's known failures.

## Audit and corrective slice — 2026-09-15

This supersedes the previous claim of **“12 PASS in Chromium.”** `SPEC.md`
still defines the complete scope; no local-only exception was approved.
**V-07, V-10 and V-12 remain PARTIAL. The goal is active.** No commit or push
was made in this audit.

### Fixed and checked

- Removed the 20-second Working → Idle demotion and managed-runtime quiet
  sweep. PTY silence cannot establish completion or authorize hibernation.
  Native status now suppresses repaint-driven running changes, including
  reattachment to an already-recorded provider identity.
- Paired sockets retain their authenticated device identity. Revocation
  notifies live connections, closes them, stops further outbound data and
  rejects reconnects; input ownership carries the paired device ID.
- Device claims/revocations persist under the store mutex before publishing
  their new state. Timestamp writes share that serialization and are throttled
  to once per minute per device, preventing stale writes from restoring a
  revoked token within this server. Failed writes preserve the prior pairing
  state. This does not implement coordination between separate core processes
  sharing one devices file.
- Browser data-plane and pairing requests validate Origin against Host.
  Loopback exemption requires a local Host and no forwarding headers, guarding
  against cross-origin WebSockets and DNS rebinding. Pairing cookies are now
  HttpOnly and SameSite=Strict. Non-loopback encryption remains unfinished.
- Removed the delayed implicit-workspace HEAD backfill: a ref read up to five
  minutes later is not a creation boundary and its stale dirty flag write was
  unsafe. Such workspaces now honestly show “Workspace start (not recorded).”
  Explicit registration retains its existing captured baseline. Existing
  recorded rows were preserved; refs created by the earlier backfill cannot
  retrospectively be proven to be creation refs.
- Last-completed-turn selection requires both before and after refs, so a
  failed after-capture cannot silently compare the turn against today's files.
- Strengthened the hibernation browser test: assistant-only response, Ready
  status, actual tmux name and native PID release, different resumed PID,
  same conversation identity, and a second assistant response recalling the
  earlier token. Tests clean up their own fixture tmux sessions.

### Verification observed

- `cargo test -p perch-core`: final run **266 unit tests + 2 protocol tests
  passed**. An earlier concurrent run failed the existing Git process-timeout
  test before its fixture wrote its PID; isolated retry and final full run
  passed. Keep the intermittent result visible.
- `cargo fmt --check`: passed. `cargo clippy --workspace --all-targets`:
  passed with the same five baseline warnings. `cargo build -p perch-core`
  and `cargo build -p perch-desktop`: passed. No frontend source/protocol shape
  changed; web tests/build were not rerun for this backend slice.
- `cd e2e && npx playwright test device-pairing.spec.ts agent-hibernation.spec.ts --project=chromium --timeout=240000`:
  **2 passed (43.8s)**. Phone flow includes actual paired ownership, a real
  prompt/reply, 22 seconds of quiet while still Working, reload, files/Git,
  host restart, and immediate revocation without reloading the phone. Claude
  completed a real turn, hibernated, released its process and resumed with
  conversation recall. This covers one finished agent, not all of V-12.
  Earlier repeats exposed an immediate-PID-exit assertion race and Playwright's
  disabled-option matcher limitation; assertions now poll process disappearance
  and inspect the actual disabled attribute.
- `cd e2e && RUST_LOG=info npx playwright test agent-turn-review.spec.ts --project=chromium`:
  **FAILED (30.9s)**, expected `Last agent turn (turnbot)`, observed
  `Last agent turn (none recorded)`. Its persistent shell uses ExitStatus but
  never exits; its previous passing result depended on the removed quiet
  heuristic. The test remains enabled and its failure is not waived. Its
  leaked fixture runtime was explicitly cleaned up after this audit run.
- Standalone WebKit launch/page probe hung for over three minutes; terminated
  only its diagnostic processes. The precise browser/page setup stage remains
  unisolated. WebKit is **unverified**, not evidence of a Perch pass or failure.
- Preserved screenshots/logs, including the failed turn-review case, under
  `e2e/screenshots-cli-rendering/chromium/audit-2026-09-15/`. Inspected the
  resumed Claude transcript and phone terminal screenshots. Desktop build is
  not a substitute for WebKit interaction verification.

### Next work (keep the full goal)

1. **V-07:** wire authoritative completion for configured providers, then
   establish ordered before-input/after-completion capture barriers. Runtime
   `StatusDetection::OutputPatterns` is currently only configuration metadata;
   generic terminal output alone cannot determine completion. Fix the shared
   lifecycle/history path and update the fixture to supply a real completion
   event, rather than restoring silence as proof. Capture tasks currently race;
   commits are dangling and can be garbage-collected; changed-path summaries
   union dirty status instead of comparing boundaries; crash recovery of open
   captures and bounded scanning/retention remain incomplete. Implement actual
   creation-boundary recording for implicit workspaces before enabling it.
2. **V-10:** finish encrypted non-loopback transport, pairing versioning/scope
   semantics and device management (including rename/confirmation), plus native
   UI/CLI, review-note and other required phone flows. Pairing a shell fixture
   alone does not establish the full mobile contract.
3. **V-12:** several finished agents/worktrees, working/blocked/draft/mobile
   safety, remote coverage and resume/fallback behavior still require evidence.
4. Recover/isolate WebKit setup; verify remaining desktop/mobile states,
   populated resource budgets and the broader suite's known failures. Do not
   discard or weaken failing tests to declare completion.


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
| V-07 complete Git and agent change review | PARTIAL: the newest turn is now reported honestly (complete/running/unavailable) and stale client state is cleared — see the 2026-09-21 honest-review checkpoint. Implicit-workspace creation refs, the capture-ordering ceiling, the rendered change summary, prompt-acceptance semantics and remote coverage remain open. |
| V-08 anchored comments and exactly-once review packet | PASS in Chromium for every built-in provider: native Claude/Pi/OMP/OpenCode two-note phone delivery, ownership and receipt-confirmed retry, plus **Codex delivery observed 2026-09-15**; WebKit re-confirmation is blocked by the browser-launch failure recorded above |
| V-09 full host/client recovery | PASS: mixed project/worktree, session, exact pane set, same-PID shell, draft conflict and anchored comment recovery passes three times per engine in Chromium/WebKit; see mixed recovery correction above and provider-specific recovery evidence below. |
| V-10 paired mobile interaction and reconnect | PARTIAL: live revocation, Origin checks, durable store mutation and paired input identity verified; the paired-phone Chat/UI <-> CLI and review-note flows are observed as of 2026-09-22, along with the native Claude acknowledgement defect that blocked them. Per-device scope, pairing versioning/rotation and encrypted transport remain open. |
| V-11 populated desktop/mobile visual and interaction QA | PASS: Git, file, terminal and settings surfaces measured per pane at a narrow desktop pane, a wide desktop viewport and 390px — no clipped controls, no horizontal scroll, visible focus, readable status, and no desktop-only dead end (Settings was one; fixed). Screenshots inspected. Focus sampling and contrast limits recorded. |
| V-12 safe hibernation and resume | PARTIAL: unsafe silence demotion removed; real Claude process release and conversation recall verified. Several-agent, working/blocked/draft/mobile and remote coverage remain open. |

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

# perch — Personal AI IDE / Agent App: Full Plan (Rust / Tauri)

## Session-specific last-turn review and resize ownership — 2026-09-22 UTC

Git status accepts an optional session filter, backed by the existing bounded
history query. The shared Git pane can select a session's recorded turn after
another session changes the same files; comments retain the reviewed session.
The free two-session regression also exposed a blank terminal after remount:
resize ownership changed without sending the current grid. The shared control
acquisition now synchronizes dimensions after its lease arrives.

278 core + 2 protocol tests, 223 web tests, builds, format and Clippy (five
baseline warnings) pass. Both browser engines verify two sessions, reload,
mobile selection and comment ownership; the running/unavailable/large-count
checks also pass. Settled wide/narrow screenshots inspected. No paid prompts,
commit or push. Earlier-turn selection within a session, capture policy,
remote recording, V-10/V-12 and measured budgets remain open. See the newest
verification and handoff entries for commands and precise run boundaries.


## Large agent-turn summaries retain exact counts — 2026-09-22 UTC

The 512-entry path-list bound no longer becomes a false total in the review
summary. The core records the full count in existing JSON metadata and exposes
an optional protocol field; the UI reports an exact total when known and a
lower bound for old capped records. Real Git/SQLite coverage includes reopen
and cumulative dirty state; the free shell fixture verifies 513-path summaries,
reload and legacy fallback in WebKit/Chromium. Core 277 + protocol 2, web 223,
builds, format and Clippy (five baseline warnings) pass. Settled wide/narrow
screenshots inspected; no paid calls. V-07 and the full goal remain partial.
See the verification record for commands, artifacts and limits.


## Hosted review delivery and honest workspace starts — 2026-09-22 UTC

Two product defects fixed. A worktree refresh back-filled a missing workspace
creation ref with today's HEAD and offered it as "Workspace start", a boundary
the user never had; a refresh now never writes one, and the primary checkout is
registered with its own before a child can create it without one. `review.batch
.send` routed by provider capability rather than session ownership, so a Hosted
session's packet was written to a native CLI it does not own and the delivery
banner waited forever; it now routes on `cli_provider_id`, and the hosted
branch's newly-reachable `unreachable!` is a client error instead of a panic.

Closed the longest-standing e2e blocker: "sends two reviewed anchors as one
packet to the selected real agent" passes on both engines with a real
`claude-haiku-4-5` turn, having never passed before. Two new DB tests, one
verified failing against the restored defect; the real-UI regression verified
failing against the pre-fix binary. Corrected two false `AGENTS.md` claims
(the tab-bar `+`, and Hosted/CLI being global). Commands, numbers and the
Playwright `<option>`/`<label>` trap are in `docs/ADE-REWORK-VERIFICATION.md`.
No commit, no push. V-07/V-10/V-12 and the full goal remain open.


## Test model pins survive restart — 2026-09-22 UTC

The shared e2e config overlay silently dropped its cheap-model environment on
core restart because existing symlinks threw and a catch returned `{}`. It now
reuses matching links and stops on setup errors. One no-cost regression failed
before the fix and passes after it. Native review/UI and hibernation enforce
actual model checks; omitted native/paired-phone specs now appear in default
Playwright discovery. Seven fresh WebKit interaction tests pass on Luna/Haiku,
including Pi/OMP/Codex review and crash recovery plus Claude hibernation.
OpenCode remains unverified; older full-suite model costs still need audit.
No production source changed. Evidence and limitations are recorded in
`docs/ADE-REWORK-VERIFICATION.md`. Full goal remains open.


## Claude native acknowledgement verification — 2026-09-22 UTC

Rebuilt the current worktree and verified the wrapped-prompt regression plus
Claude native review and native UI in headless Chromium and WebKit: four
browser checks pass. Observed acknowledged exactly-once review delivery,
UI/CLI continuity, core-crash recovery retaining provider identity, phone
control transfer and cancellation, with Haiku 4.5 checked before prompting.
No production/test source changes. Artifacts, exact commands and limits are
in `docs/ADE-REWORK-VERIFICATION.md`; the handoff now marks this recheck done.
Full goal and V-07/V-10/V-12 remain open.


## Paired-phone flows and the native Claude acknowledgement — 2026-09-22

`native_ui/claude.rs` accepted a prompt only when the `UserPromptSubmit` hook
reported text byte-identical to what perch sent. Claude Code 2.1.278 wraps
every bracketed paste in `<pasted_content id="...">`, so that match could never
succeed and **no prompt perch sent to a native Claude session was ever
acknowledged** — a delivered review packet reported "delivery could not be
confirmed". Acceptance now requires the reported prompt to contain the sent
text, still pinned to the same process, provider session and a submission newer
than the pre-write stamp. Claude-only: other providers return an explicit ack.
New `e2e/paired-phone-flows.spec.ts` drives the two V-10 flows a fixture
provider cannot reach — Chat/UI <-> CLI and the review packet — from a paired
phone at the LAN origin on the cheapest model; it passes on WebKit and
Chromium. Core: 274 unit + 2 protocol tests; web: 223; fmt, builds and Clippy
(five baseline warnings) pass. V-10 remains PARTIAL. Details and falsified
investigations: [handoff.md](handoff.md).

## Honest last-turn review state — 2026-09-21

The Git surface reports the **newest** recorded turn plus an explicit state
(`complete` / `running` / `unavailable`) instead of scanning past it for an
older completed one, which used to present the wrong work under the label
"Last agent turn". `git.status.result` now always serializes `lastAgentTurn`,
so an explicit `null` clears a summary a browser cached before a capture
failed, and the review surface re-points or drops a stale diff rather than
letting the summary and the diff describe two different turns. A shared
`source_control` fix drops the phantom "deleted" entry Git reports for an
untracked path that the base content snapshot carries. Three regressions fail
before their fixes. Core: 273 unit + 2 protocol tests; web: 223; format,
builds and Clippy (five baseline warnings) pass. Real browser verification in
WebKit and Chromium with the free fixture provider; no paid model calls.
V-07 remains PARTIAL. Details and open scope: [handoff.md](handoff.md).

## Failed turn capture isolation — 2026-09-21

The shared history recorder consumes a pending boundary before fallible
completion work. A failed capture cannot reuse newer files or merge the next
turn into its old snapshot. The new regression fails before the fix and covers
both read and write failures with real Git/SQLite fixtures. Core: 271 unit +
2 protocol tests, format, build and Clippy (five baseline warnings) pass.
Local-provider review passes in Chromium and WebKit (11.4s); no paid model calls.
V-07 remains PARTIAL. Details and open scope: [handoff.md](handoff.md).

## Two native panes — 2026-09-21

Extended the existing OMP/Pi split-pane fixture to exercise native UI replies
in both mounted sessions, including unsolicited updates to the secondary
session while the primary retains subscription and focus. WebKit passes
(15.1s). Both panes verify GPT-5.6 Luna before prompting; Pi now uses an
explicit private model overlay, and the mixed-provider fixture separates the
CLIs' otherwise conflicting config homes. No production implementation changed.
Full evidence and remaining requirements are in [handoff.md](handoff.md).

## Native transport, provider environment and codex socket — 2026-09-16

Four shared-path defects found by chasing the unresolved Pi freeze and the
five-provider sweep it blocked. A failed turn-history capture no longer
swallows the live `AgentUiSnapshot`, which is what leaves a web transcript
frozen mid-stream on "Working" while the CLI has already answered; a failed
capture also no longer leaves the runtime believing the turn is still running,
which made the next turn close the previous turn's boundary. `tmux
new-session` hands a CLI the *tmux server's* environment, so the default
provider policy now goes through the same private bootstrap the restrictive
ones use (without `env -i`, so tmux's own variables survive) — until now the
login-shell PATH and anything the user exported for their CLI never arrived.
`native_ui::paths()` canonicalizes its socket root because codex-cli 0.154.0
refuses a socket path containing a symlinked directory, and macOS `/tmp` is
one; without it every native codex launch exits at startup.

A fifth fix followed: `AgentUiSnapshot` reached only a connection's single
active session, so a second native chat pane for another session froze; it now
also reaches a connection observing that agent, while the chat stream stays
session-scoped so a paired phone cannot receive sessions it never opened.

**WebKit, all four installed providers PASS both suites** — native UI (pi 22.3s,
omp 23.2s, claude 17.0s, codex 34.5s) and native review (12.0s / 17.7s / 10.3s
/ 11.6s). These are the first WebKit passes of the native UI spec. opencode is
BLOCKED: not installed on this machine. `e2e/cheapModel.ts` pins each fixture
to the cheapest model through a private config home, so the sweep stops
consuming the quota the rest of it needs.

Core: 270 unit + 2 protocol tests, format, and Clippy with the same five
baseline warnings. V-07, V-10 and V-12 remain PARTIAL. See the newest
checkpoint in [handoff.md](handoff.md) and
[the verification record](docs/ADE-REWORK-VERIFICATION.md).

## Implicit workspace creation boundary — 2026-09-15

Local session creation now captures HEAD before publishing its workspace/session
identity, reusing existing Git/project helpers. Stale-session recovery follows
the same path; later sessions cannot replace an existing baseline. Two Chromium
flows verify explicit and implicit creation through commits, repeat creation,
review comments, reload and mobile UI. Core: 267 unit tests, build, format and
Clippy (five baseline warnings) pass; desktop build also passes. The old WebKit
setup hang no longer reproduces: both workspace-start flows pass in WebKit,
and eight agent/pairing regressions pass across Chromium and WebKit. The phone
check now verifies the newly available creation comparison. V-07 remains
PARTIAL; see the current
[handoff](handoff.md) and [verification](docs/ADE-REWORK-VERIFICATION.md).

## Turn-history audit follow-up — 2026-09-15

Wired configured completion markers and ordered provider transitions; managed
turns now capture before dispatch and after completion. Snapshot refs survive
Git GC and changed paths come from the before/after tree comparison. Real
Claude and configured-provider review flows pass alongside hibernation/resume
and pairing/revocation: four Chromium tests. Core checks: 267 unit + 2 protocol
tests, format, core/desktop builds, Clippy with five baseline warnings.

V-07/V-10/V-12 remain PARTIAL. Open-boundary recovery, accepted-prompt semantics,
implicit creation baselines, capture cost/retention, secure/full mobile flows,
multiple-agent hibernation and WebKit remain open. See the newest checkpoint in
[handoff.md](handoff.md) and [verification](docs/ADE-REWORK-VERIFICATION.md).

## Audit corrective checkpoint — 2026-09-15

Audited Claude's latest slices and corrected the acceptance record: V-07,
V-10 and V-12 are PARTIAL; the overall goal remains active. Fixed unsafe
silence-based lifecycle demotion, native repaint authority, live device
revocation, serialized device persistence, browser Origin/Host validation and
paired input identity. Removed inaccurate delayed creation-ref backfill and
required both refs for completed-turn comparisons. Hardened real Claude
hibernation/resume and phone security regressions.

Final evidence: 266 core + 2 protocol tests, format, Clippy (five baseline
warnings), core/desktop builds and two focused Chromium flows pass. The old
agent-turn review fixture now fails because it relied on silence as completion;
this is an open V-07 blocker, not a waived check. WebKit setup remains
unverified. Full audit findings, exact commands, artifacts and next work are in
[handoff.md](handoff.md) and
[the verification report](docs/ADE-REWORK-VERIFICATION.md).


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


## Context

A personal IDE/agent app to **babysit coding agents from anywhere**, including your phone, built to
eventually ship in two flavors (corp-internal + open-source) that borrow the best of **Jean**
(Rust/Tauri native app: chat + terminal + diff + side panel) and **T3/t3code-internal** (web-first, devpod
gateway URLs, remote-ready).

**Product shape:** *Rust app core, TypeScript as the thin view + web-routing layer* — the Jean/Tauri
model. Rust owns all the logic and data (agents, terminals, git, devpod, SQLite) and exposes it over
a single WebSocket API. The TypeScript/React web app is *just the view*: it connects to that WS,
whether it's embedded in the native Tauri window (localhost) or opened from your phone (devpod
gateway URL). One Rust core, one TS view, two delivery modes.

## Why this shape (decision record)

- User wants a **Rust app** with **TS only for minimal routing of app data to the web resource**.
  That is exactly Tauri: Rust backend + web-tech frontend, plus a headless mode that serves the same
  web bundle for the phone.
- **Single WS transport** for both desktop and web (instead of Tauri IPC for desktop + WS for web):
  the Rust core always runs an axum HTTP+WS server; the Tauri window and the phone both connect over
  WS. Keeps TS purely view+routing and Rust the single source of truth.
- **Toolchain reality on this devpod:** Rust installs via `rustup` (verified reachable). `webkit2gtk`
  and a display are **absent** → the **Tauri desktop GUI is built/tested on the Mac**, while the
  **headless axum web mode builds & runs here** and is testable via the gateway URL.

## Repo structure (Cargo workspace + TS packages)

```
perch/
  Cargo.toml                      # Rust workspace
  crates/
    perch-core/                   # PURE Rust core — NO Tauri/webkit dep (builds headless on devpod)
      src/protocol.rs             #   serde types matching the WS contract (tagged by `type`)
      src/agent.rs                #   claude stream-json runner (AgentRunner trait + ClaudeRunner)
      src/terminal.rs             #   portable-pty terminals
      src/db.rs                   #   rusqlite history (~/.perch/history.sqlite)
      src/registry.rs             #   session registry + replay ring buffer
      src/status.rs               #   cwd + branch (parse .git/HEAD, no git shell-out)
      src/server.rs               #   axum HTTP (serve web dist / placeholder) + WS at {base}/ws
      src/lib.rs  src/main.rs     #   lib + headless binary entry
    perch-desktop/                # Tauri app (thin) — depends on perch-core; BUILT ON MAC
      src/main.rs                 #   boots core WS on localhost, opens Tauri window on the web app
      tauri.conf.json
  packages/
    shared/                       # TS WS protocol contract (mirrors protocol.rs) — REUSED
    web/                          # React/TS UI (chat/terminal/PWA), WS client — REUSED PLAN
  reference/node-server-spec/     # the old Node server, kept as an executable spec (not shipped)
```

An `integrations/corp/*` seam (in perch-core) keeps corp-specifics (corp-gateway, devpod gateway, corp-cli,
corp-SSH) swappable so the open-source split is a strip-out, not a rewrite.

## Rust dependencies (perch-core)
`tokio`, `axum`, `tower-http` (serve-dir), `serde`/`serde_json`, `rusqlite` (bundled sqlite),
`portable-pty`, `uuid`, `anyhow`, `tracing`. `perch-desktop`: `tauri` (+ webkit2gtk on Mac).

## WS protocol (defined in Rust `protocol.rs` + TS `shared`, kept field-for-field identical)
- Client→Server: `session.create`, `session.resume` (localStorage-backed, replays history), `session.subscribe`,
  `chat.send` (+`agent`, `model`), `chat.cancel`, `terminal.create` (+optional `agentAttach:
  {sessionId, agent}` to spawn the real interactive CLI instead of a shell), `terminal.input`,
  `terminal.resize`.
- Server→Client: `session.created`, `session.history`, `chat.chunk`, `chat.thinking`, `chat.tool_use`,
  `chat.tool_result`, `chat.done` (usage: input/output tokens, costUsd, contextTokens),
  `terminal.created`, `terminal.data`, `terminal.exit`, `status.update`, `error`.

---

## Phases & Milestones

### Device default at session creation — 2026-09-15

The ordinary "New session" launchers hardcoded `mode: "cli"`, a session-scoped
override that made goals.md's device default unreachable for every session a
user creates. They now omit it and inherit the default; `CliStartPanel` keeps
its explicit CLI start. No behaviour change on a CLI-default machine.

### V-07 and V-11 completion — 2026-09-15

V-07: implicit (session-created) workspaces now record a creation ref within a
five-minute grace window — anything older stays "not recorded" rather than
being back-dated — the Git surface states whose turn it was and how many paths
it touched, and the rename, delete and empty-comparison states are exercised
against a real repository. V-07 is PASS for local workspaces; direct-host turns
stay out of scope.

V-11: the visual QA spec now spans a narrow desktop pane, a wide desktop
viewport and 390px across the Git, file, terminal and settings surfaces,
checking clipped controls per *pane*, page-level horizontal scroll, a visible
focus indicator, readable status text, and phone reachability of every pane.
That last check found a real dead end — Settings existed only in the desktop
sidebar, so it was unreachable from a phone — now fixed in `MobileHeader`.
V-11 is PASS.

### Device pairing — 2026-09-15

perch binds `0.0.0.0` and had no authentication at all, so anything on the LAN
could drive real agents. `devices.rs` adds paired devices (`~/.perch/devices.json`,
`--devices-path` to override) storing only each token's SHA-256, plus in-memory
pairing codes that expire in five minutes, work once, and burn after five wrong
guesses. `authorize_request` gates the WS upgrade and both upload routes;
loopback stays exempt so the desktop shell never pairs with itself. `GET/POST
{base}pair` let an unpaired browser learn it is unpaired and claim a token
(returned as a cookie, so the WS handshake carries it), and `device.*` protocol
messages drive Settings → Devices.

It also exposed a real bug: `crypto.randomUUID` only exists in a secure context,
and ten unguarded call sites (plus four home-grown fallbacks whose
`"randomUUID" in crypto` guard is true-but-uncallable) crashed the whole app for
a phone on plain http. They now share `packages/web/src/ids.ts`.

`e2e/device-pairing.spec.ts` drives two real origins — host on loopback, a 390px
phone on the machine's LAN address — through pairing, a real agent turn,
scrollback after reload, files and Git, a host restart, and revocation. V-10 is
PASS; no QR code, per-device scope or TLS yet.

### Hibernation and resume — 2026-09-15

The hibernation machinery had no runtime caller. `spawn_agent_hibernation_task`
now hibernates idle agents nobody is watching (15 min, `PERCH_HIBERNATE_AFTER_SECS`
to override, 0 to disable) and the attach path wakes a sleeping agent by
resuming its recorded provider session instead of failing — never a fresh one.
The CLI pane says "sleeping … its conversation is kept" with a Resume button
rather than reporting an exit.

Two real defects fell out: a CLI agent could never leave `Working` (a configured
provider has no status stream, a native one only reports when its hooks fire),
so the idle sweep now moves a Working agent to Idle after 20s of pty silence;
and a hibernated or crashed CLI left its session permanently "running", which
stuck the status dot and made the next attach fail with "a Chat turn is still
running in this session".

`e2e/agent-hibernation.spec.ts` verifies it with a real Claude CLI: sleeping
observed on the wire, the tmux session gone, and the same `providerSessionId`
resumed when the client returns. V-12 is PASS for local CLI agents; direct-host
agents stay out of scope.

### Pane-width responsiveness — 2026-09-15

Dockview can give a pane a narrow width inside a wide window, so the file and
Git surfaces' collapse rules are now `@container` rules keyed to the pane's own
inline size instead of the viewport. Files collapse at 460px (where the 230px
tree rail stops leaving a usable editor) rather than the viewport's 700px; the
Git pane's viewport rules became container rules, and the five that contradicted
the existing container block were deleted — at phone width both sets had been
applying, which is why the changed-file rail rendered behind the diff. The
editor action row now takes its own bounded line so Save is no longer clipped.

`e2e/workspace-visual-qa.spec.ts` guards it: populated surfaces measured against
each pane's own box at a narrow desktop pane and at 390px, plus a real review
interaction, with screenshots in `e2e/screenshots-visual-qa/` (gitignored).
`workspace-files-durable.spec.ts` now reopens the tree through the real
"‹ Explorer" control after a reload. V-11 stays PARTIAL — terminal/chat/settings
surfaces and the explicit focus/loading/error/empty pass remain.

### Last-agent-turn review — 2026-09-14

`agent_change_snapshots` finally has a runtime caller: `server/agent_history.rs`
records a durable before/after boundary per agent turn, hooked at the session's
running/idle transition (`notify_session_updated`) so a turn typed straight into
the CLI counts the same as one sent from the UI or a review packet. Both sides
are content commits from `GitService::content_snapshot` — a scratch-index
`commit-tree` covering index, worktree and untracked files, touching no ref,
index or worktree — because agents mostly do not commit and a HEAD-only
boundary would report an empty turn. The Git surface offers it as a
"Last agent turn" diff base via the existing compare target and one optional
field on `git.status.result` (protocol.rs/protocol.ts both updated).

Two defects found on the way, both fixed at the shared function: configured CLI
providers had a no-op activity callback in the runtime adapter's terminal
registry, so they never reported working/idle at all (now resolved back to
their session and swept like shared terminals); and `GitService::diff`
synthesized working-tree untracked files into *every* non-staged target,
which attributed post-turn files to a two-endpoint comparison and double-listed
files the endpoint already had.

Verified in a real browser against a real pty-owned CLI process
(`e2e/agent-turn-review.spec.ts`, 1/1): the turn's edit and new file appear
under "Last agent turn", a later human edit does not, and the boundary survives
a reload. 261 core tests, 2 protocol parity tests, 222 web tests, production
build, `cargo fmt --check` and the 5 baseline clippy warnings all hold. V-07 is
still PARTIAL — implicit-workspace creation refs, direct-host turns and the
rendered change summary remain; see docs/ADE-REWORK-VERIFICATION.md.

### Mixed recovery correction — 2026-09-14

Fixed the disconnected `NoSessionPanel` store selector: the derived fallback
project allocated a new object on each snapshot read, crashing React after
core shutdown. Selecting its scalar cwd preserves navigation and stops the
loop. The mixed-workspace browser check now verifies the disconnected screen
and exact restored pane IDs as well as projects, linked checkout, session,
same-PID shell, draft conflict, and anchored note. It passes three repetitions
each in Chromium and WebKit; 222 web tests and the production build pass.
V-09 is PASS. Populated narrow split controls still need V-11 work. Full goal
and remaining gates stay open; details are in the verification report.

### ADE rework checkpoint — 2026-09-10 (in progress)

Work now continues directly under the user's instruction to finish the current
workers and create no more agents. The full contract remains `goals.md` and
`SPEC.md`; no ADE phase or final acceptance gate is declared complete here.

User clarification, 2026-09-11: ship Claude Code, Codex, OMP, Pi, OpenCode,
and ordinary terminals as first-class choices. UI mode is a web view and
control surface of the same CLI-owned session, not a Perch agent harness.
The CLI retains its tools, instructions, authentication, approvals, and
transcript. Retiring the separate Hosted/print-runner path in favor of this
shared native session is required; refusing UI sends until the CLI is stopped
is an interim defect, not an acceptable final mode-switch contract.
Alpha/Beta are isolated automated-test programs only. Their checks do not
establish real provider support or UI/CLI turn continuity.

Configured-provider loading, environment enforcement inside tmux, durable
provider selection before input, and generic CLI picker/reload are now
implemented. The completed configuration checkpoint passed 247 core tests,
two protocol tests, 216 web tests, build, and the isolated desktop/mobile
provider suite in both Chromium and WebKit. Screenshot review also fixed the
provider pane badge and terminal-response bytes leaking into session titles.
The native UI connection was the next active slice; its Pi/OMP checkpoint follows.

Native CLI UI checkpoint, 2026-09-12: Pi and OMP now load a private native
extension into their existing interactive CLI. The CLI owns conversation,
models, tools, extensions, authentication, and execution. The extension exposes
bounded native history/events and prompt/cancel controls over a private Unix
socket; no second provider process or Perch prompt loop is started. Rust checks
input leases and journals prompt operations before delivery. The web view
renders native messages, thinking, tool calls/results, and visible custom
messages, preserving the CLI's hidden-message flags. Native continuation IDs
update both lifecycle persistence and the live handle, so reattaches preserve
identity. Native status also prevents terminal repaint from marking a settled
agent Working.

Real Pi/OMP tests in Chromium and WebKit exercise a sentinel read from UI,
a follow-up typed in CLI, native /reload, UI/CLI draft retention, core SIGKILL
and restart with the same native PID/session, and a separate 390px phone
browser taking control and sending a third prompt. Pi reloads the native
extension; OMP's built-in /reload refreshes plugins while preserving CLI
extensions. Headless screenshots are private and were reviewed. Final command
results and current limits are recorded in docs/ADE-REWORK-VERIFICATION.md.

Native review checkpoint, 2026-09-12: Pi/OMP review packets now enter the
existing CLI through its native user-input API. A Git view borrows input only
when unowned and releases it after enqueueing; another browser's control is
preserved. Packet and prompt delivery use the existing atomic journal, and a
retry returns the same operation's receipt without sending another prompt.
Four real-provider desktop/phone checks pass in Chromium and WebKit, including
two anchored notes, an ownership refusal, successful delivery after release,
a correlated retry receipt, unchanged native PID/session, and control recovery.
254 core tests, two protocol tests, 222 web tests, production build, formatting,
and Clippy with the five existing warnings pass. Claude's following checkpoint
extends this path; native Codex/OpenCode review still needs its adapters.

Claude native UI checkpoint, 2026-09-13: the interactive CLI now supplies
native hooks and a bounded view of its own JSONL conversation. Additional
hook settings leave Claude responsible for configuration, tools, approvals,
models, and execution. Prompt/cancel input uses the existing terminal lease
and checks the actual active tmux pane's native PID. A prompt is typed only
into a visibly empty Claude editor, preserving any unfinished CLI draft or
dialog. Native prompt hooks confirm receipt; the existing journal prevents
replay. Review packets use this same path. No second provider process starts.

Real Claude checks pass in Chromium/WebKit for UI tool use, a CLI follow-up,
draft refusal and retention, native PID/session continuity across core SIGKILL,
phone control/prompt/cancel, and two-note review delivery with correlated
same-operation retries. The input guard discovers the active pane instead of
assuming tmux window 0. Startup trust remains Claude's own CLI dialog; tests
respect its native input cooldown and pass three repetitions per browser.
Application-mode arrow bytes no longer leak into the shared CLI title parser. Native
UI discovery and pane labels now follow host manifests. Validation and private
artifacts are recorded in docs/ADE-REWORK-VERIFICATION.md.

The full goal is still active. Next: native UI controls
(attachments, model selection, approvals, queue verification), then
Codex/OpenCode native UI connections and retirement of local
Hosted dispatch. Existing remote paths must remain compatible. Worktree
lifecycle, secure pairing, hibernation, combined recovery, and measured resource
budgets still need their complete acceptance evidence. The Pi/OMP slice does
not establish the full V-04 or V-10 gates.

Codex native-interface probe, 2026-09-13: installed CLI 0.154.0 exposes an
app-server Unix socket and a native `codex --remote unix://PATH` terminal.
In a private disposable server, the terminal created a thread; a second API
connection joined that loaded thread, submitted a sentinel-file read, and
received native item/turn events. The terminal displayed that API turn and a
later terminal prompt recalled its result. Reconnecting joined the same thread
and returned all three completed turns. This proves the native interface path,
not a Perch integration or browser acceptance. Implementation is next.

The installed transport rejects WebSocket compression negotiation; disable
per-message deflate. Identify the non-ephemeral user thread rather than the
CLI's ephemeral system thread used for naming. `turn/start` acknowledgements
can precede active status updates, so completion must match the turn ID.
Use native paginated history and the existing bounded Perch snapshot/control
path. Keep the native server and terminal in the same persistent runtime,
preserve native configuration/authentication, and rejoin only its loaded
thread. Perch must never start a parallel thread to implement UI mode.
The private probe and generated installed-version schema are under
`/tmp/perch-codex-native-*` and `/tmp/perch-codex-probe-1Som07/`.

Codex implementation checkpoint, 2026-09-14: the native TUI and the structured
view now join one private native app-server in the persistent terminal runtime.
The adapter reads native history/events, sends native prompt/interrupt requests,
persists the actual thread ID, and uses the existing input lease and delivery
journal. A cold, empty native thread accepts its first real UI prompt before
Codex creates the rollout needed for a history subscription. No synthetic
prompt or parallel provider thread is created. Native system/title threads are
excluded. Messages, tool results, and native errors are bounded; model changes
come from native events. Closing the terminal stops both native children.

The Chromium UI/CLI/core-crash/phone prompt/cancel/stop flow passed. Claude Opus
reviewed the implementation; its actionable fixes include cancellation IDs,
pending thread selection, dynamic tool output, bounded incremental accounting,
stale snapshot invalidation, and preserving Codex's own model choice. The
launcher cleanup has a runnable regression check. Full validation so far:
257 core tests, two protocol tests, 222 web tests, production build, formatting,
and the five baseline Clippy warnings. Extended `/new`, WebKit, and native
Codex review-delivery acceptance are still being finished; this is an
implementation checkpoint, not completion of the full native UI or SPEC gates.

OpenCode review correction, 2026-09-14: the initial HTTP adapter was unsound:
it selected arbitrary saved sessions, could attach to another server, forwarded
TUI flags to `attach`, read responses before applying bounds, and republished
unchanged history. A shared PID-file reaper could also kill a live native
server. The reaper was removed and covered by a live-socket regression check.

The replacement loads a plugin into the real OpenCode 1.18.30 TUI, reusing
Perch's private Unix socket transport. It follows the TUI's active route,
projects bounded native messages and tools, submits through the TUI's own
prompt ref, preserves drafts/dialogs, and confirms delivery from native user
messages. No additional OpenCode server is launched. Global/project native
settings remain native; an explicit custom `OPENCODE_TUI_CONFIG` remains
CLI-only instead of being overwritten. Both independent Opus review output
and real headless provider validation are recorded in the verification report.
This supersedes the initial HTTP-adapter checkpoint; full SPEC gates remain
open.

The hardened OpenCode native UI suite passes in Chromium and WebKit, including
shell-mode refusal, native home/new-session behavior, same-PID core recovery,
phone input ownership, cancellation and process exit. Two-note phone review
delivery and receipt-confirmed duplicate prevention also pass in both engines.
The Rust suite passes 259 core and two protocol tests; the standalone plugin
check covers the native API edge cases and bounds. Formatting is clean and
Clippy remains at its five baseline warnings. See the 2026-09-14 OpenCode
section in `docs/ADE-REWORK-VERIFICATION.md` for commands and evidence.

Orca catalog and launcher checkpoint, 2026-09-11: all 36 MIT-attributed
catalog entries are now wired through the provider registry, the shared
detection/launch resolver, host-persisted enabled/default preferences, and
Settings → Agents. The CLI start view, sidebar/tab-bar pickers, and command
palette use installed, enabled agents; install actions open the official
instructions. The command palette also opens a persistent shell. OMP and Pi
were launched through separate UI entry points in one workspace, retained
their drafts and identities through split/reload, and accepted isolated input.
The four catalog/native checks pass in Chromium and WebKit. The wider terminal
suite found and led to fixes for xterm's disposed-viewport callback and an
unnecessary session mode override; the two desktop/phone ownership checks now
pass again. Rust: 249 core + two parity tests; web: 218 tests; build/typecheck
and formatting clean; Clippy retains five baseline warnings. Details and
private artifact locations are in `docs/ADE-REWORK-VERIFICATION.md`.

CLI-owned UI sequence (updated 2026-09-13):

1. Completed for Claude/Pi/OMP: bounded native events/history and prompt/cancel
   controls inside the same interactive CLI, actual continuation capture,
   view/reload/core-crash continuity, and separate phone control/prompt.
2. Completed for Claude/Pi/OMP: review packets use the native bridge and existing
   input authority, with real-provider delivery and retry verification. Complete
   UI attachments, native model/approval controls, and queued-message checks.
3. Connect Codex and OpenCode through their native session
   events/control paths with equivalent identity and restart guarantees.
   Keep unsupported provider behavior explicit while these adapters are built.
4. Retire the separate local Hosted runner after those paths are verified;
   preserve existing remote behavior until the corresponding transport is
   migrated. Then finish the remaining worktree, pairing, snapshot,
   hibernation, and measured resource gates in SPEC.md.

Implemented and browser-verified mode policy discovery, stable blank-session
identity, server-owned workspace associations, multi-view invalidation, and
session/workspace/device precedence with safe gated CLI start. Fixed a real
cold-start React render loop missed by builds and unit tests. Direct checks:
235 core unit tests, two protocol parity tests, 206 web tests, shared/web build,
and headless Chromium mode-policy plus responsive R1/R2/R2b interactions.
Detailed evidence and remaining gates are in
`docs/ADE-REWORK-VERIFICATION.md`. Plain shell persistence now passes real browser reload, phone view release,
and isolated core-crash recovery in WebKit and Chromium, preserving the same
PID and shell state. Workspace tests pass (238 core plus two protocol checks);
213 web tests, the shared/web build, and all ten WebKit/Chromium terminal
checks pass. Local agent terminals now also attach through the lifecycle adapter, retain
host-owned replay across view release, and expose generation-bound input/resize
control. Real Claude desktop/phone ownership and reconnect checks passed in
both WebKit and Chromium. Latest checks: 240 core tests, two protocol checks,
216 web tests, shared/web build, formatting, and Clippy with the same five
existing warnings. See the 2026-09-11 checkpoint in the verification report for
browser rerun status and explicit limits. Seamless CLI-backed UI
prompt/transcript continuity, complete native-agent recovery,
full worktree/remote pairing flows, mixed workspace recovery, lifecycle-driven
hibernation, and populated resource budgets remain incomplete.

V-08 local review delivery is now observed: the real browser added two exact
inline anchors, edited/resolved/reopened a note, previewed one packet, selected
the session, sent it to Claude, and received one provider turn despite an
explicit same-operation retry. Durable delivery now pushes its confirmation
to the pane and the send button recovers after each correlated request. The
latest checks pass 208 web tests, 235 core unit tests, both protocol tests, and
the real review browser flow; core Clippy retains only the five baseline
warnings. Recovery and remote/mobile gates remain separate and open.

All phases below are **done**. One line each; the full record — root causes, rejected
alternatives, and the reasoning behind each decision — lives in
[`docs/PHASE-HISTORY.md`](docs/PHASE-HISTORY.md). Read that before re-litigating anything here.

| Phase | What shipped |
| --- | --- |
| 0 | Cargo workspace + `perch-core`/`perch-desktop` skeletons; Node server retired to `reference/node-server-spec/`. |
| 1 | Rust core: protocol, claude/codex runners, terminals, SQLite history, axum HTTP+WS. |
| 2 | TS web UI — chat, terminal, PWA. |
| 2.5 | Codex agent + per-agent model selection. |
| 2.6 | Session persistence and resume. |
| 2.7 | Dockable pane shell; Hosted/CLI mode toggle. |
| 2.8 | Session sidebar, agent status dots, environment header. |
| 2.9 | CLI/model sync, model catalogue, Codex-style UI, Settings modal. |
| 3.0 | Hub federation — remote perch instances over an ssh tunnel. |
| 3.1 | Tauri desktop shell (core boots in-process). |
| 3.2 | Session lifecycle + spawn-environment fixes. |
| 3 | Headless devpod + phone integration. |
| 4 | herdr UI/feature parity (Wave 1). |
| 5.W | Wave 2 — git worktree management. |
| 6 | Detached mode: `direct` hosts run turns over ssh+tmux, surviving sleep and restarts. |
| 7 | Hosted composer power features — slash autocomplete, plan mode, attachments. |
| 8 | Optimization pass (DB indices, rAF chunk coalescing, memoised markdown). |
| 9 | Open-item cleanup. |
| 10 | Server-side event scoping; honour codex's configured default model. |
| 11 | `perch.app` bundle — double-clickable Mac app that finds the user's CLIs from a cold GUI launch. |
| 11.1 | Fixed the bundle shipping without a UI in it. |
| 11.2 | Public-repo sanitization (history scrub + repo recreate) and codex catalogue sync. |
| 12 | CLI mode: emulator semantics, gated terminal start, auto session titles from the first prompt. |
| 12.1 | CLI mode: fixed the pty UTF-8 byte path (the real corruption), adopted the user's terminal profile, font scaling instead of reflow. |
| 12.2 | Rendering verified in **WebKit** (the engine the desktop app actually uses) after a Chromium-only pass gave a false pass; added `e2e/cli-rendering.spec.ts`; single-resize fit; PLAN.md condensed into this table. **Confirmed fixed by the user in the installed app.** |
| 13 | herdr CLI-mode parity Wave 3: agent-attach singleton + multi-viewer fan-out (fixed duplicate `--resume` spawns), PTY-activity status detection, OSC 52, clickable links, directional swap + resize mode, protocol-parity test, CLI provider picker, no-session empty state, pane-menu discoverability. |
| 14 | tmux-backed local CLI persistence (agents survive perch restarts) + a real web unit-test layer (Vitest, 113 cases) and `docs/TESTING.md`. |
| 15 | herdr parity Wave 2: cursor style/blink + light/dark palettes from the real terminal, a Ghostty config reader, configurable scrollback, login-shell panes, system-notification click-to-focus, bulk archive-project. |

**Current milestone:** ✅ perch is a double-clickable Mac app whose CLI mode renders the agent
TUIs the way the user's own terminal does — user-confirmed in `/Applications/perch.app` — and
whose CLI-mode agents **survive a perch restart** (tmux-backed, Phase 14), closing the last
structural gap with herdr's detach/reattach. Phase 15 spent the remaining small parity items,
so CLI-mode parity is **~86%** of herdr's user-facing surface (from ~61% → ~71% → ~77%).
What is left is deliberate, not backlog: kitty graphics (no viable xterm.js implementation),
a plugin marketplace, and Windows ConPTY — none of which perch has a use for. Tests:
**151 Rust + 1 parity + 134 web** (all under a second) plus **91 e2e**.
See Phases 13-15 in [`docs/PHASE-HISTORY.md`](docs/PHASE-HISTORY.md); testing strategy in
[`docs/TESTING.md`](docs/TESTING.md).


## How to run

**Devpod headless:**
```bash
source $HOME/.cargo/env
cd /home/user/perch
cargo run -p perch-core -- --port 7788
```
Phone access: run `devpod serve :7788/` on the devpod (with `DEVPOD_NAME` and `DEVPOD_REGION` exported); it assigns a port and prints the gateway URL (`https://devpod-gateway.internal.example.com/proxy/<user>/<assigned-port>/`). The old `/proxy/dev-personal/7788/` static path is no longer used.

**Mac desktop:**
```bash
cargo run -p perch-desktop   # boots core in-process on a free port, opens a window
```
`PERCH_DESKTOP_TEST=1` runs the window hidden and unfocused (for automation).

**Usual federation flow:** run the app locally, add devpod hosts in Settings; the hub auto-starts the remote perch in a tmux session and keeps it connected.

## Verification approach
- **Core:** cargo build + WS smoke test (session/terminal/chat) + real claude turn persisted to SQLite. ✅ done (Phase 1).
- **Web/phone:** gateway URL + chat + terminal + PWA install. ✅ done (Phase 2/3).
- **Desktop (Mac):** hidden-window launch via `PERCH_DESKTOP_TEST=1`; WebView auto-created session over WS. ✅ done (Phase 3.1).
- **Ongoing:** committed Playwright e2e suite in `e2e/` (hub `:7799` + federated remote `:7800`).
- **Terminal rendering:** `e2e/cli-rendering.spec.ts` via its own config, run under **both**
  Chromium and WebKit — the desktop app renders in WKWebView, so a Chromium-only pass proves
  nothing about it (this is exactly how Phase 12.1 shipped a "verified" build that was still
  broken). Screenshots land in `e2e/screenshots-cli-rendering/<engine>/` to be looked at, not
  just asserted on — **gitignored**, because they capture a real agent session and carry the
  account email, machine name and session titles into what is a public repo:
  ```sh
  cd e2e && npx playwright test --config=cli-rendering.config.ts
  ```
- **Bundle:** never trust HTTP 200 — it is also what the "no web client build found"
  placeholder returns. Check the served body for app-shell markers, and cold-launch from `/`
  under `env -i PATH=/usr/bin:/bin:/usr/sbin:/sbin` so neither the CWD fallback nor a rich
  PATH can mask a failure.

## Constraints
- Repo control via `gh` only; no `git`/arc shell-outs (read repo state from `.git/*`). No commit/push
  unless asked. Native app (webkit2gtk/display) is Mac-side; devpod covers the headless web path.

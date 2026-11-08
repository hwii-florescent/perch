# Perch architecture

Current implementation reference. Core sections were refreshed against `8dae768`;
the sub-session sections were added through `3aa0afb` (2026-11-07).
[ROADMAP](ROADMAP.md) tracks what remains; [PUBLIC-ALPHA](PUBLIC-ALPHA.md)
defines acceptance evidence. Source presence is not a release certification.

## Process and data ownership

```text
React / Zustand / Dockview / xterm
  browser, paired phone/PWA, iPhone app (ios/), or Tauri webview
                      │ HTTP + WebSocket
perch-core: axum, Rust domain services, SQLite
       │ private socket              │ OpenSSH
perchd: PTYs, history, VT state       remote perch-core / direct tmux host
       │
shells, real agent CLIs
```

- **Core** owns domain logic, authorization, projects/workspaces, files/drafts,
  Git/review, agent lifecycle and attention. Server adapters dispatch to domain
  services rather than implementing another model in React.
- **Desktop** runs the same core in-process and adds narrow OS integration,
  notifications and native child browser webviews.
- **Web** renders WS-driven state and owns view-local presentation. Do not
  confuse focus/layout with runtime authority.
- **perchd** is detached from core lifetime. Core starts it as
  `<exe> __perchd serve`; a standalone binary is also built for remote use.
  It does not own project/filesystem/Git/agent-product semantics.
- SQLite metadata defaults to `~/.perch/history.sqlite`; settings/hosts are
  atomic JSON files under `~/.perch`. Actual files remain on disk.
- `crates/perch-core/src/usage/` feeds the status-bar usage popover, local-only
  (never relayed to remote hosts): `mod.rs` plan usage through the `claude` /
  `codex` CLIs with an HTTP fallback, `spend.rs` an in-memory ledger of the
  agents' local logs, `prices.rs` the bundled price list, `alerts.rs` in-memory
  threshold/budget alert state, `redeem.rs` the confirmed Codex reset redeem.
- Every protocol change updates Rust and TypeScript together. Optional/default
  fields and capability negotiation preserve older clients and federated peers.

Read module `//!` headers for local details, not a duplicate directory catalogue.

## Terminal continuity and authority

Local persistent launches require perchd. Daemon failure is visible, not an
in-process fallback or permission to launch a duplicate. Core distinguishes
Alive / Exited / Unknown; Unknown cannot authorize restart or cleanup.
Boot/reconnect attaches to surviving execution, preserving dimensions; it does
not restart a conversation. Idle hibernation is off unless
`PERCH_HIBERNATE_AFTER_SECS` is set; explicit wake is a new launch.

Execution survives an **app/core** restart while perchd lives, not daemon death,
reboot or explicit stop. Dead-daemon descriptors/history are retained for seven
days. History is bounded (8 MiB, compacted to its newest half), not an unlimited
transcript or an fsync-per-write guarantee. Replay includes retained output and
a screen/mode repaint; gaps and storage failures are disclosed.

Released-only cleanup is daemon-authoritative (`released-cleanup.v1`). New
runtimes are retained; legacy/restored ownership is unknown. Only an explicit
owner lifecycle release makes a live runtime eligible. Focus, visibility, age,
resource use, disconnect and core death never release it. Attach/input/resize
reclaims a released runtime and invalidates old previews. Cleanup rechecks its
incarnation/revision and reserves that session before signalling its pinned
process group; it preserves history. Known escaped groups require manual review.
This is not a general orphan PID sweep or a production session-close migration.

Output budgets exist across daemon subscribers, client attachments, core WS
outbox and xterm parser writes. A stalled viewer disconnects and replays rather
than growing memory indefinitely. Exact budgets live in those modules; candidate
fault/performance checks still gate release.

Terminal-specific contracts:
- Always use `xtermSetup.ts::createPerchTerminal`; `convertEol` stays false.
  Font/theme come from the server's `terminalProfile`, not UI tokens.
- Production uses visibility-scoped WebGL when available, with bounded context-
  loss retries; unsupported/repeatedly failing GPUs can fall back to DOM.
  WebDriver uses DOM so e2e text assertions work. Parked/inactive views release
  GPU contexts.
- A terminal outlives its mounted pane; switching parks it. Do not let caches
  retain disposed xterm/view callbacks.
- One resize lease owns the PTY dimensions. Other views follow, never fit.
  Shared CLI input does not acquire resize/stop authority. Only the resize
  owner answers terminal queries; replay must not replay live side effects.
- Agent and ordinary shell terminals accept user-dropped files/images up to 1 GiB per file on
  direct connections (64 MiB through the buffered phone relay). Core authorizes
  before reading, streams to disk with a 60-second idle / one-hour total receive
  limit, and removes incomplete local copies. Local paths stay under
  `~/.perch/uploads/<sessionId>/` with the existing 24-hour stale-directory sweep.
  Remote drops require explicit Option/Alt-drop, `upload.scp.v1` on the serving
  core, a configured SSH host and verified session ownership. System SCP/SFTP
  uses the existing SSH config/multiplexing and a private per-drop remote folder;
  only completed paths are pasted. Failed/cancelled transfers attempt bounded
  remote cleanup; successful remote files are retained (no remote sweep), and
  a core crash may leave partial remote staging. Never overwrite project files
  or fall back locally when the remote is unavailable.
  Settings → Terminal can switch dropped paths from safe single quotes to safe
  double quotes; both escape shell expansion. Dropping never submits a turn.
  This gesture uses native xterm paste, not Context Bridge delivery. Support
  does not depend on the launch provider: agents started manually in a shell
  accept the same drops. Agent file/image permissions still apply;
  losing writable input or changing host/terminal during an upload must not
  insert paths into a different terminal.
- Preserve xterm's native input (including kitty keyboard); do not guess or
  re-encode keystrokes. Shortcuts belong in `keybinds.ts::SHORTCUTS`, not
  scattered handlers; plain Ctrl letters must still reach the PTY.

## Resources, drafts and lifecycle

`surfaces.rs` gives Terminal/File/Diff host-qualified identities and per-viewer
presentation (`surface.v1`). Legacy import is idempotent and retains originals.
The web's tab/split stores remain live and `surfaceSync.ts` mirrors/restores
workspace presentation locally and through the hub for compatible remote cores.
Remote file/diff surfaces use the owning core; layouts stay opaque and are
stored there, not imported into the hub's local DB.
Browser tabs exist separately; do not imply they are canonical surface kinds.

Viewer focus/layout are independent across windows. Files/reviews have no
session parent in the resource model, but the current WS client still resumes
or creates a session on connect. Session-free browsing remains unfinished.

FileService owns confined, bounded access and versioned saves. Durable buffers,
save intents/receipts and external-change conflicts protect drafts. Never save
a truncated preview over the original or bypass confinement for a new viewer.
Context Bridge's bounded copy/explicit delivery rules live in
[CONTEXT-BRIDGE](CONTEXT-BRIDGE.md); direct send is currently Claude-only.

Instructions (`instructions.rs`, `db/instructions.rs`) are private text and reference
folders on a Project or Nest, capped at 16,000 characters combined. A session pins
its composed snapshot (with source revisions and a hash) at first launch; wake and
resume reuse the pin, never the current text. Launch paths reach providers only
through append flags (`agent_runtime::with_instructions`, the shell shim, the Codex
app-server launcher); a failed lookup refuses the launch.

Switching/quitting is different from explicit close:
- A global session close stops and deletes it; a watcher only dismisses its
  observation. Keep execution discoverable and confirm stop before forgetting it.
- Closing the final tab leaves the same workspace, never unrelated work.
  Removing a project leaves its folder and provider-owned transcripts on disk.
- Worktree deletion, including force, refuses open work, durable drafts, live
  daemon processes and unknown daemon state; it rechecks before deletion.
  Untransmitted edits from a disconnected viewer cannot be checked by core.
  These are refusal guards, not a distributed edit/delete transaction.
- Reopen currently creates a fresh harness session; it does not resume the old
  conversation. See [DECISIONS](DECISIONS.md) and [ROADMAP](ROADMAP.md).

## Agent observations and attention

CLI harness availability requires a real executable on the owning host; Perch’s
private shell wrappers (including symlinks to them) never count as installations.
Enabling a missing harness in Settings asks for confirmation and offers its setup
instructions when available. This does not run an installer or make the harness
launchable: after installing it on that host, Refresh must detect it first.

`agent_fleet::AgentLifecycleRegistry` is the lifecycle authority, persisted by
`agent_persistence.rs`. Native bridges, configured markers, OSC titles and
fallback output heuristics have different confidence. The transition bridge
`spawn_agent_turn_state_task` projects lifecycle into sidebar running/blocked
sets; do not add a competing state machine.

Local attention persists `attention_events` and feeds the sidebar's By status view. Viewing reads,
never resolves, a question. Silence is not completion; uncertainty stays
labelled. Failures and finished/exited events are distinct. Remote event relay,
per-user read state and notification deep links remain deferred.

Desktop macOS system alerts use `UNUserNotificationCenter`, not the notification
plugin’s unconditional desktop permission grant. Settings → Notifications reads
real authorization and banner settings, requests consent only on explicit opt-in,
and offers System Settings, Refresh and a test alert. Sending never asks for
permission; rejected sends fall back to an in-app toast. Sound is independent.
The retained native delegate presents foreground alerts for other sessions and
opens the session on click; the focused, viewed session stays quiet. Usage/test
alerts only raise Perch. Unbundled developer runs cannot impersonate Terminal.
Focus and notification summaries can still hide an OS-accepted banner.

There is one global view setting, `chatMode`: `ui` or `cli` (default `cli`;
a legacy `hosted` value reads as `ui`). `AgentPane` routes every session by it:
Terminal (`AgentCliTerminal`) by default, or the native chat view
(`NativeCliChat`) when the agent has a native UI. The Hosted chat runners,
`chat.*`/`session.history`/`session.mode*` messages, model catalogues and
detached runs were removed on 2026-11-05; the native view reads provider
sessions, never a Perch-owned transcript.

## Remote and network boundaries

Remote calls go through `ssh.rs` and the OpenSSH CLI, not an SSH crate.
Mode `perch` federates with a remote core; `direct` is reduced SSH/tmux
compatibility. The hub relays project/workspace metadata, bounded text filesystem/draft/search
operations, canonical file/diff surfaces and presentation, and selected
worktree/Git/review families. Browser-facing remote project/workspace IDs are
`remote:` plus a JSON `[stableHostId, owningCoreId]` pair; paths are never routed
by resemblance. These opaque IDs keep cloned remote DB identities separate.
`hub/workspace.rs` validates/decodes at the boundary, stamps authenticated
origins, rewrites request IDs per connection/host and relays metadata events
without another viewer's correlation ID. Pending resource requests are bounded
by count/bytes/time; disconnect reports an unknown outcome, never a retry.
Remote cores retain their own UUIDs and own all resource authorization/storage.

Remote media/downloads, background worktree jobs, attention and the new owned
shell/provider-runtime families remain unadvertised. File tabs remain open on
an unconfirmed canonical close. Resource reconnect reads durable drafts before
resubmitting; it is not proof of runtime start/stop reconciliation. Full remote
workspace ownership remains the target; nothing remote may fall back locally.
`perchd connect` exists, but alone is not a remote workspace service.

Desktop serves loopback by default. Enabling Phone access opens a second
network listener and enables paired tokens; disabling it closes remote access
and device sockets. Headless core is always network-enabled. Proxy headers or
a non-loopback Host are remote even from a loopback socket. Real Tailscale Serve
has not been verified. See `server/phone_access.rs`.

**Nobody is tokenless, loopback included** (`local_ui.rs`, `server::authorize_request`; slice 3a).
Every data route (`/ws`, `workspace-file`, `clipboard-image`, `upload`) needs a paired device's
token or the core's own **local UI token**, accepted only from this machine (loopback peer,
loopback Host, no proxy header, no foreign `Origin`); `/agent/*` needs an agent token and nothing
else. `/pair` stays open by design, and the static app shell stays public so a phone can load the
pairing screen. The desktop mints its token in memory and never writes it to a file or an
environment variable: its webview signs in by redeeming a single-use, ten-minute code at
`GET {base}local-login` (the core answers with an `HttpOnly`, `SameSite=Strict` `perch_local`
cookie and a redirect, and the code never appears in a log). A headless or development core
(`LocalUi::standalone`) writes the token into the 0600 `core.json` as `localToken` and, when its
stdout is a terminal, prints a one-use `local-login` link; a launcher or test may choose the
token in `PERCH_LOCAL_TOKEN` (32 to 256 cookie-safe characters; read once, removed from the
core's environment and from every child's). `PERCH_REQUIRE_PAIRING` is accepted and does nothing:
it existed to cover proxies that rewrite Host to loopback, which now still need a token they
cannot have. **Threat model:** this stops agents and other local processes from getting core
authority by default or by ordinary tool use, and stops other OS users and the network
entirely. It is **not** a boundary against an unsandboxed process of the same user that
deliberately reads that user's files (`core.json` of a headless core, `devices.json`,
`~/.perch/history.sqlite`) or another process's initial environment (`ps eww`); that needs an OS
sandbox. Federation: the hub presents a remote core's local token as a bearer header on the
WebSocket upgrade. For an SSH host it reads the remote `core.json` over the SSH it already
runs, on every (re)connect, and uses it only when the file names the forwarded port; a
`directUrl` host carries whatever `?token=` its user wrote (hidden from logs). **Version skew:**
a newer remote refuses an older hub (401, shown as a host error); a newer hub talking to an
older remote works, since that remote still exempts loopback. A remote **desktop** core
publishes no token, so the hub cannot reach it over SSH: run headless `perch-core` there, or
pair.

The relay (`relay/`, `crates/perch-core/src/relay/`, `packages/web/src/relay/`)
is a third way in. The core dials out to a user-deployed Worker and serves each
phone as an end-to-end sealed session (key in the link fragment, AES-256-GCM,
nonces and counters bound into every frame). Tunnelled requests reach the same
router and `/ws` marked `x-perch-relay`, so they are remote and need a paired
token; only `pair`, `ws`, `workspace-file`, `clipboard-image` and `upload`
are carried. The relay's address is the `relayUrl` setting, changed only from
the computer itself. `relay.json` beside `devices.json` holds its identity.
`wire.rs` and `wire.ts` must change together (`wire.fixture.json`).

Agents are a fourth caller, and the narrowest. Each new local launch of a Claude, Codex, Pi,
OMP or Terminal session gets an incarnation and a bearer token (`PERCH_TOKEN`, with
`PERCH_SESSION`); the core stores only its SHA-256 (`agent_identity.rs`, `db/agent_identity.rs`).
The token opens `/agent/*` (`server/agent.rs`) for its own session and nothing else:
`authorize_request` refuses it on every other route, loopback included, and `/agent/*` takes
no device or local UI token. A reattach never mints (the process
keeps its environment); a confirmed exit, a newer launch, session deletion and a boot-time
check against perchd end a run's token, and the post-exit login shell has none. An agent that
omits its token gets nothing from any route. The `perch`
command finds the core through `<daemon dir>/core.json` (0600, read on every call). It reaches
the agent through a `perch` entry in the session's private shim directory that `exec`s the real
binary by absolute path; **a packaged build must ship `perch` beside the core**, or agents get
neither identity nor pointer. The desktop bundle does (`bundle.macOS.files` and the Linux
`deb`/`rpm`/`appimage` `files` in `crates/perch-desktop/tauri.conf.json` copy
`target/release/perch` next to the app executable, so build it first: the release workflow and
`scripts/reinstall-desktop.sh` do). There is no separate headless package yet; a headless build
has `perch` beside `perch-core` in `target/<profile>/` once `cargo build --workspace` has run, and
any future headless archive must keep the two together (`e2e/packaged-perch.check.mjs`).

**Sub-sessions** (`sub_sessions.rs` rules, `db/sub_sessions.rs` records, `server/sub_sessions.rs`
routes `/agent/spawn`, `list`, `stop`). A lead starts children in its own Workspace with `perch spawn`;
the core, not the agent, decides:

- *Admission before dispatch*, in one transaction that also writes the child's session row
  (`sessions.parent_session_id`) and its record (`sub_sessions`): not a child itself (depth 1),
  a turn a person opened, at most 4 live children and 8 ever, and the key (`--key`, else one per
  invocation) names the spawn, so a retry returns the first child and starts nothing. A refusal
  creates nothing.
- *Person-opened turn*: `AgentRuntimeAdapter` records who opened each session's turn, in memory
  only. A person submitting input (terminal Enter, chat send, Context Bridge send) while no turn is
  running marks it `Person`; an Enter inside a running turn changes nothing; input Perch delivers for
  an agent (a child's first message; slice 5's messages) marks it `Agent`; a new process starts with
  no mark. Spawn needs the lead to be Working or Blocked now **and** the mark to be `Person`. After a
  core restart a running lead's mark is unknown and spawn is refused until a person speaks again.
  A turn that opens before the provider has settled a fresh launch to idle is not marked either.
- *The child* is launched like any session (same registration, Instructions pin, own token and
  native bridge) with nobody viewing it, and its first message is the task: the last argument of
  its command line, so no input lease is taken and nothing is typed into a prompt. Its first turn is
  marked `Agent`. Provider flags go before it and parse after it (checked on all four CLIs).
- *Unknown is not exit.* A launch not confirmed either way is `start_unknown`; a stop not confirmed
  is `stop_unknown`; both, and `starting`/`stopping`, still count against the limits. Only a
  perchd-confirmed exit settles a record (`exited`, or `stopped` after a stop). A launch in flight
  when the core stopped becomes `start_unknown` at boot. A child confirmed never to have started
  leaves nothing behind.
- *Stop* is by the lead for its own children only. The record goes `stopping`, the core terminates the
  process and confirms it is gone (`stop_confirmed`, like session delete), and only then records
  `stopped` and lets the exit be observed. A person stopping a lead (terminal kill) stops its live
  children the same way. Deleting a lead (also what archiving its Workspace does, which deletes the Workspace's
  sessions) first stops its live children, each confirmed; if one cannot be shown stopped (a stop not
  confirmed, a launch still in flight) the delete is refused and the lead and its records are kept. The
  stopped children then remain as ordinary sessions without a parent; deleting a child drops its record.
  **Esc in the chat is not a stop:** it interrupts the lead's own turn (a keystroke into its prompt), and
  its children keep running; only a terminal kill, a delete and `perch stop` stop them.
- *`--worktree`*: after the child is recorded, the core makes a new checkout of the lead's repository,
  registers it as a Nest under the lead's Workspace in the same Project and moves the child's session and
  record there before launching; any failure discards the child, which never started.
- *Reports are claims.* `perch list` returns lifecycle, whether the agent needs a person (Perch's own
  blocked state, never something the agent said), the dispatch record, and a report: the child's own
  `perch report` of its latest turn (kept per run, outliving it), else the running summary a cheap model
  wrote ("Cheap-model reporter", below), else the first 400 characters of its last assistant message,
  labelled a fallback. None marks anything done.
- Local only; a lead on a remote host cannot spawn.

**Messages** (`agent_mail.rs` rules, `db/agent_mail.rs` queue, `server/agent_mail.rs` routes `/agent/send`,
`inbox`, `cancel` and the delivery loop). Written before the code, slice 5; the behaviour below is the
contract the tests hold it to.

- *Who and what.* The members of a run are a lead and its children; a member may message any other
  member of its run, never itself, never another run, and only one with a live identity (its
  incarnation is recorded on the message). A body is at most 64 KiB without control characters; up to
  2,000 characters it travels whole, a longer one is written to a private file under the run's notes folder
  (`/tmp/perch-native-<uid>/notes/<run>/`, 0700/0600) and the receiver gets a 300-character preview and the
  path. Two kinds exist: `message` (an agent's `perch send`) and `note` (Perch's own status line from a
  child to its lead, below). 50 messages per run (notes do not count), 32 pending per receiver, and a key
  (`--key`, else one per invocation) per sender: the same key returns the first message and queues nothing.
  All of it is decided in one transaction before anything is queued; a refusal queues nothing.
- *Receipts.* `queued` (with the reason it is still waiting), `delivered`, `unconfirmed`, `undelivered`
  (with a reason). `delivered` only when the receiver's own bridge or hook confirmed it took the text
  (Claude: the `UserPromptSubmit` event; Pi, OMP, Codex: the bridge's acknowledgement). Bytes written
  without that proof are `unconfirmed`, never `delivered` and never `undelivered`: unknown is not failure.
- *Delivery is idle-only and never steers* (a steer is a separate, explicit action: see "Family strip actions"). A receiver is eligible only when all hold: its recorded
  incarnation is still its live one; its runtime is alive and its native bridge has reported; its
  lifecycle is Idle or Done and the bridge says no turn is running, nothing is blocked and no question or
  approval is open; its input line is readable and empty (a person typing, a dialog or an overlay is not
  empty); and, for a lead, no child is working and fewer than 10 automatic wakes were spent since a person
  last opened a turn on it. Otherwise nothing is written and the message stays `queued` with the reason.
  Nothing wakes a sleeping session, relaunches an exited one or restarts a process.
- *Per provider.* Pi and OMP: the bridge's prompt (their own follow-up queue; the extension queues it if a
  turn started in between). Codex: `turn/start` through the bridge, only on the snapshot above, because
  Codex does not refuse a busy start (it joins the running turn; slice 0). Claude: the bridge's prompt
  plus a paste. Every provider goes through one critical section (`dispatch_under_current_lease`, under
  `agent_operation_lock` and the runtime's authority lock, the one every PTY write and lease change takes):
  the PTY has heard no input from any client for 2 s, the receiver is still idle with nothing open, its
  input line is empty (Claude: its real PID and empty prompt, `claude::prepare_input`; the others: nothing
  typed, no dialog or overlay, `typed::input_ready`), then claim, enqueue the confirmation with the bridge
  and, for Claude only, paste. Typed into a shell (`terminal` provider) cannot receive messages.
- *Lease contention (owner decision, 2026-11-07).* **Any open chat or terminal view of a session takes and
  keeps its input lease while attached** (seen live: a first version that refused to write while a view
  held it never delivered to a lead someone was watching). So delivery writes **under the holder's current
  lease**: the same client and generation, nothing taken, released, recorded or flipped (no "Take control"
  button appears), checked by a unit test. With no holder the core's own client borrows the lease for the
  one call and gives it back before the lock is released. The extra guard is a quiet window: no input bytes
  from any client reached that PTY in the last 2 s (the core stamps every client write at the one place
  input is prepared; a terminal's own reports count; a session never heard from since the core started is
  *recent*, not quiet, until the core is 2 s old). Any failed check leaves the message `queued` with its
  reason ("someone is typing in its terminal, or did a moment ago") and the next pass, every 2 s while
  mail waits, tries again; nothing loops tightly. **Chat composer drafts live in the browser, not the PTY**,
  so a half-typed chat message is invisible to the core and is not protected: a delivery can open a turn
  while the person is mid-sentence in the composer (their draft stays in the box and sends as the next
  message). **Residual risk:** a keystroke typed into the terminal in the same instant between the checks
  and the paste (the lock covers the 250 ms between paste and Enter, so a later keystroke waits behind it
  but is not read first). Confirmation is only Claude's `UserPromptSubmit` (or the bridge's own answer);
  an unconfirmed write is `unconfirmed` and never repeated.
- *Duplicates and restarts.* The claim is one atomic `queued` to `delivering` update before any byte or
  bridge call, so a message is attempted at most once. A core that stops with a message `delivering` finds
  it `unconfirmed` at boot and never retries it blindly. Queued messages survive restarts; before any
  attempt the incarnation is checked again, so a message is never handed to a later launch of the session
  it was not addressed to (the receiver restarted: `undelivered`, "addressed to its previous run").
  A delivery failure before the claim leaves the message queued; after it, `unconfirmed`.
- *Cancel.* The sender may cancel its own message while it is `queued` (`perch cancel <id>`): `undelivered`,
  "cancelled by sender". Once `delivering` it cannot be taken back. Receivers that end (identity revoked on
  a confirmed exit, session deleted) turn their queued mail `undelivered`; deleting a lead deletes the
  run's mail with it (its children become ordinary sessions, like their records).
- *Envelope and neutralising.* The prompt always begins with Perch's own header naming the sender (title,
  provider, session, kind) and saying the text is from another agent, not a person, and approves nothing;
  the body follows as a quoted block, every line prefixed, so a leading `/`, `!` or `#` can never be a
  command or a mode switch (the prompt starts with a `────` rule line, never a character from the
  sender). Peer text is data; the guide tells agents the
  same. A message never answers a dialog and never approves anything: delivery refuses while one is open.
- *Turn origin.* A delivered message opens a turn Perch marks `Agent` (after the change-record barrier,
  which would otherwise mark it a person's), so the person-turn rule refuses `perch spawn` there.
- *Notes from children.* When a child's turn ends, it becomes blocked, or its exit is confirmed, Perch
  queues a `note` for its lead: status words, whether it is waiting on a person (Perch's own state), and
  the first 400 characters of its own `perch report`, else the cheap model's summary (`Summary by <model>`),
  else of its last message, each labelled a claim (a finished turn is noted even when the child said and
  reported nothing: "It has reported nothing"). The summary is kept before the note is queued, so a slow or
  absent model only delays a note, never changes what it can say. A
  newer note from the same child replaces one still queued. Queued notes of a lead go in **one** delivery
  (a roster, one line per child, headed as status rather than instruction); messages go one per delivery.
- *Wake cap.* Delivering anything to a lead spends one of 10 wakes; a person opening a turn on the lead
  (terminal Enter, chat send, Context Bridge send) resets it, durably, through a listener on the same
  `note_person_input` that marks the turn `Person`. A core restart does not reset it.

**Family strip and notes folder** (`crew.rs` read model, `server/crew.rs`, `packages/web/src/crew.ts`,
`views/nativeChat/FamilyStrip.tsx`; slice 6). The read model sends, stops and approves nothing; the
strip's actions are the next section.

- *Protocol.* `crew.get {sessionId}` answered by `crew.state {rows}` (capability `crew.v1`, local
  sessions only; the hub does not relay it), and the optional `SessionSummary.parentSessionId` that the
  sidebar nests by. A session in no run, or a lead with no children, gets no rows.
- *Rows.* A lead sees each child as a `worker`; a child sees its lead as the `manager` and a sibling as a
  `peer` only once they exchanged a message or the sibling is waiting on a person. Rows with the newest
  message come first, the rest in run order. **What a member is doing is four separate records, never one
  status word:** `lifecycle` (Perch's runtime state; unreadable is `unknown`, never idle) with the child's
  `dispatch` record, `needsYou` (a pending approval or question from Perch's own blocked state and
  request, never an agent's claim), the newest message with its delivery `receipt` and reason, and the
  agent's `report` with its source (`report`, `summary` with the `model` that wrote it, or the fallback
  `last-message`). The strip's headline counts working, waiting on you and reported (a report or a summary;
  a fallback does not count).
- *Freshness.* The strip asks again when a family member's session updates. Mail receipts change without
  one, so the mail code calls `notify_session_updated` for both ends when a message is queued, cancelled
  or settled. No polling.
- *Sidebar.* A sub-session's row sits under its lead's wherever both are listed together (By project, in
  compact dots its dot follows its lead's and is set in; By status within one section; Quickchat); in another section it is an ordinary row, so Needs you stays
  complete. "In one list" stays purely chronological. No panel, tab or drawer.
- *Notes folder.* One per run under the private native directory (`/tmp/perch-native-<uid>/notes/<lead
  session id>/`, 0700), created on first use and removed when the lead is deleted. `perch whoami` and the
  end of `perch guide` give the path; the guide says what it is for. Nothing in it is ever injected into a
  prompt, and an agent reading it treats it as a peer's text.
- *Open* goes to that child's chat, where typing needs the input lease like any chat. The phone gets the
  same strip because it is part of the same chat view.

**Family strip actions** (`crew_actions.rs` rules, `server/crew_actions.rs`, `/agent/steer`, `/agent/interrupt`,
`crew.act`; slice 7). Each worker row of a lead's strip offers Message (default), Steer, Interrupt and Stop.

- *Who.* A **person** at the lead's chat (desktop or phone) sends `crew.act` (capability `crew.actions.v1`)
  with the chat's input-lease `generation`, exactly as typing in it needs; without the lease the core
  refuses and sends nothing. The **lead** may steer and interrupt its own children with `perch steer` and
  `perch interrupt` (agent token). A child cannot do either to anyone (403), and a lead cannot reach a
  session that is not its child (404). An agent has no way to message-bypass idle-only delivery: `perch
  send` is unchanged, and a person's Message is the only queued text with a person as sender.
- *One engine.* `crew_actions::availability(action, actor, facts)` decides, with the reason shown on the
  disabled item and in a refusal, and the core decides again under the locks mail delivery uses
  (`agent_operation_lock`, `dispatch_under_current_lease`) before anything is handed to a provider. The
  rows of `crew.state` carry the person's `actions` with each reason. The strip asks again while its menu
  is open, since what can be sent changes with the child's turn without a session update.
- *Message* (person only): the slice 5 queue with sender `person` (`record_person_mail`): same limits
  except that it does not count toward the run's 50, spends no wake and opens a turn that is the person's;
  the banner names the person, still opens with Perch's rule line and leaves the person's words unquoted.
- *Steer* (person or lead): only while a turn runs and never while the child waits on a person's approval
  or answer (a steer cannot answer or approve anything). A `steer` row in `agent_mail` is claimed as it is
  sent (never queued): it gives the receipt and the idempotency key, and counts toward a lead's 50
  messages (a person's does not). Text up to 2,000 characters, control characters refused, never moved to a
  notes file; a lead's steer is quoted under Perch's header like any peer's. Per provider: Codex
  `turn/steer` with `expectedTurnId` (the turn the bridge saw), Pi and OMP `deliverAs: "steer"` through the
  extension, Claude through its own prompt queue: written into a verified empty prompt after 2 s of PTY
  quiet, confirmed by its `UserPromptSubmit` hook and then by its transcript showing the text absorbed
  into the running turn (`queue-operation remove` / `absorbed_mid_turn`, probed 2.1.319); not seen joining
  within 25 s is `not confirmed`.
- *Interrupt*: the chat's Stop path (`queue_cancel`: Claude's Esc into a verified process, Codex
  `turn/interrupt`, Pi/OMP abort), confirmed only when the provider answers **and** reports the turn over.
  A lead's is refused while the child waits on a person and capped at 3 per child between two messages a
  person sends the lead (`agent_interrupts`, reset with the wakes; counted when sent, confirmed or not).
  A person's may also stop a turn that waits on a prompt (as the chat's Stop does).
- *Stop*: `stop_child` unchanged: confirmed by perchd, otherwise `Stop not confirmed`.
- *Receipts, never retried.* `crew.act.result` carries `queued`, `sent` (the provider has it, answer
  awaited), `confirmed`, `not_confirmed` (it may have taken effect) or `refused` (nothing was done). The
  same request id again returns the first result and sends nothing twice; a restart leaves a `delivering`
  steer `unconfirmed`. A lead reads the same words from `perch steer` and `perch interrupt`. Nothing here
  is ever relaunched or typed into a shell, and a provider with no confirmable mechanism has the action
  disabled with the reason.

**Cheap-model reporter** (`reporter.rs` rules, `server/reporter.rs`, `db/reporter.rs`; slice 8). A child's
finished turn is summarised by a small model so the expensive one never writes a report.

- *When.* Once per turn end of a child (never a lead), from the same transition that queues the lead's note,
  after the transcript has caught up with the hook. No timer and no model call between turns: the live
  "working" line is `transcript.rs`'s and costs nothing.
- *Running notes, not history.* The model is shown the child's **previous summary** (at most 400 characters,
  `session_summaries`) and **only the turn that just ended**: the message that opened it, one line per run of
  tool calls (`transcript.rs`'s run sentence), the files its landed edits changed (`turn_diffs`), any question
  it waits on and the last thing it said, at most 12,000 characters in all, never a tool's output or a file's
  contents. What one summary costs therefore stays flat however long the child runs.
- *Which model.* One setting per harness, each run through that harness's own CLI in one-shot mode under the
  user's login, the prompt on stdin, cwd the child's Workspace, 60 s: `claude -p --model <m> --tools ""
  --no-session-persistence --disable-slash-commands --strict-mcp-config --setting-sources ""` with Perch's own
  system prompt; `codex exec -m <m> -s read-only --ephemeral --ignore-user-config --ignore-rules --disable
  shell_tool …`; `pi --print --mode json --model <m> --thinking off --no-session --no-tools --no-extensions
  --no-skills --no-prompt-templates --no-context-files --no-mcp --offline`; `omp --print --mode json --model <m>
  --thinking off --no-session --no-tools --no-extensions --no-skills --no-rules --no-context-files --no-lsp
  --no-title` (the last two read the answer and the usage from the JSON event stream's final assistant
  message). A child is summarised by its own harness when that harness has a reporter, else by the first that
  has one, in the order Claude, Codex, Pi, OMP. A harness has one when its CLI is installed and its model is
  set: defaults are `haiku` (Claude's alias for the current Haiku) and `gpt-6-luna`; **Pi and OMP have no
  default** (`provider/model`, e.g. an OpenRouter model, empty = none). Settings `reporterEnabled`,
  `reporterClaudeModel`, `reporterCodexModel`, `reporterPiModel`, `reporterOmpModel` (Settings,
  Notifications). Nothing runs for a CLI that is not installed, and a signed-out CLI fails like any failed call. (Probed live, Claude Code 2.1.319: a haiku call
  with these flags is about 540 input tokens; Codex 0.166 gpt-5.6-luna about 1,900 in total, mostly its own
  prompt.)
- *Output.* `{status, text}` with status `done`, `blocked`, `needs_you` or `failed`; the object is found in
  the answer (a code fence or a line of talk is tolerated), a bad status or an empty text is refused, a text
  over 400 characters is cut and marked. Refused or failed: the 400-character last-message fallback, stored as
  the notes so an older summary is never shown as the latest.
- *Precedence.* The child's own `perch report` made since the notes were last written (that is, during this
  turn) wins and is stored as the notes without asking a model; else the model's summary; else the last
  message (`sub_sessions::choose_report`). `perch guide` and the first message no longer ask a child to report.
- *Guards.* One call per child at a time (`reporter_in_flight`; a turn that ends meanwhile keeps the last
  message), none for a child that is stopping or stopped, none once the run's agents sent 50 messages, none
  with the setting off, none without a runnable CLI. Never blocks the child. Each call is a `reporter_runs`
  row, counted in the usage popover's spend estimate as "Perch reporter" (`usage::spend::spend_with`; the
  CLIs are run without a saved session, so no agent log holds them). Codex gives one total, counted as input.
- *Not verified:* a summary is the model's reading of a transcript slice, no more than a report is.

**Suggested tasks** (`suggestions.rs` rules, `db/suggestions.rs`, `server/suggestions.rs`, route `/agent/suggest`,
WebSocket `suggestions.get|state|changed` and `suggestion.act|act.result`, capability `suggestions.v1`; slice 9a).
A lead puts tasks in front of the person instead of starting them; nothing starts until a person clicks.

- *Records.* One `suggestions` row per task, grouped by `card_id`; the lead's key names the card, so a retry
  returns it and adds nothing. At most 5 tasks per card and 10 waiting per lead, checked with the insert in one
  transaction. A task is plain text that cannot begin with `/`, `!` or `#`, because Do it here sends it to the
  lead as the person's own message. A sub-session cannot suggest (depth 1, as for spawn); local leads only.
- *`perch spawn` becomes a card* while the setting "Let leads start sub-sessions without asking"
  (`leadsStartWithoutAsking`, default **off**) is off: the same request is stored as a card of one and the verb
  says nothing was started. With it on, `perch spawn` is exactly as before (the person-opened-turn rule).
- *Person's actions* (`suggestion.act`, under the lead chat's input lease, as typing in it): **Start** takes
  `pending` to `starting` once (a second click finds it taken), then runs `sub_sessions::start` with the click
  standing for the person-opened turn: the same depth, limits (4 live, 8 total), key (`suggestion-<id>`),
  worktree and launch as `perch spawn`, and a refusal puts the task back to `pending` with the core's reason.
  A launch that left a record (`start_unknown`) keeps the card following that sub-session; it is never started
  a second time. **Start all** does the same for every waiting task in order, each refusal named. **Options**
  are Start with an agent, model or worktree chosen. **Do it here** is sent by the chat to the lead as the
  person's message through the composer's path, and only then recorded (`handed`); a task that did not reach
  the lead stays on the card. **Dismiss** answers one task or the card. A Start in flight when the core stops
  is `started` at boot if its sub-session was recorded, else waits again.
- *The card* is read from these rows (a card whose tasks are all answered and whose sub-sessions are not live
  leaves), shown above the family strip, and follows a started task's sub-session state. It is not in the
  provider's transcript. Cards go with their lead when it is deleted.

**Inbound control** (`agent_mail::{InboundMode, gate}`, `sessions.inbound_mode`, `db/agent_mail.rs`, `server/inbound.rs`,
`inbound.get|state|act|act.result|changed`, capability `inbound.v1`, web `HeldMessages.tsx`, the session row menu; slice
9d). Each session says what it does with messages other sessions send it: **accept** (default), **hold** for its
person's approval, or **refuse**. It is the person's setting, in the session's row menu and on the card in its chat.

- *Where it applies.* An agent's `perch send` and `perch steer` to the session. **Never** a person's own text through
  the family strip (any kind), and not Perch's status notes from a child to its lead (Perch's own words, not an
  agent's message), and not `perch interrupt` (no text). `agent_mail::gate(mode, kind, from_person)` is the rule.
- *Hold.* The message is admitted as `held` (a seventh receipt, beside `queued`, `delivering`, `delivered`,
  `unconfirmed`, `undelivered`): the delivery engine never sees it, it counts against the receiver's 32 waiting, and
  the sender's receipt says it waits for the receiving person. The sender may still `perch cancel` it. The person's
  chat shows a card (sender, text, **Deliver**, **Discard**, and all of them at once). Deliver moves it to `queued`
  and it is delivered like any other message, when its receiver is idle (the idle-only rules are unchanged);
  Discard makes it `undelivered: discarded by the person using that session`. Both need the chat's input lease
  (they decide text that would be typed into the session); both are done once, so a second click does nothing.
- *Refuse.* The message gets a row at once, `undelivered`, reason `refused: that session does not accept messages
  from other sessions`, so the sender's `perch send` and `perch inbox` say so. It counts toward the run's 50 like
  any message the agent sent.
- *Steers.* A steer is only worth anything while the turn it corrects runs, so it is never held: under Hold or
  Refuse it is refused with words that say which, and nothing is recorded or sent.
- *Changing the mode* applies it to what already waits in one transaction: Hold holds each agent message still
  `queued`; Refuse turns each one away; Accept changes nothing already held (the person still decides it). A message
  already `delivering` or settled is untouched. Setting the mode a session already has moves nothing. Setting a mode
  is a setting, not a keystroke, so it needs no input lease (the sidebar can do it).
- *Hidden from the receiving agent.* `perch inbox` lists what was sent to a session without any held, refused or
  discarded message: what the person holds back or turned away is not for the agent to read. Nothing is hidden
  from the person or from the sender's own view.
- *Not changed:* idle-only delivery, quoting, the envelope, limits, receipts' retry rules.

**Reading a sub-session** (`child_read.rs` rules, `sub_sessions::read`, route `/agent/read`, `perch read <session>
[--turns N]`; slice 9c). A lead reads a bounded tail of its own child's conversation, on demand, with no model call:
the last N turns (default 2, at most 5) from the snapshot the child's native bridge holds, through the same
`transcript::project` the chat and the reporter use. Per turn: what opened it (a delivered message reads as who
sent it), one sentence per run of tool calls, the files its landed edits changed with their line counts, the
last thing the agent said, and a pending question or "still running". **Never** a tool's output or a file's
contents; at most 8,000 characters in all, dropping the oldest turn first (the newest is kept, and a single turn is
cut with a marker). Only a lead may ask, and only about a session it started (`parent_session_id` matches);
another session or a non-existent one is `not one of your sub-sessions`, a sub-session asking is refused, and a
child whose bridge Perch cannot reach (not connected, or after a core restart) says so instead of guessing. It
changes nothing and is not counted against any limit. The text is the child's own account of its work: the CLI
says so and that it is not checked.

**Sender cards** (`agent_mail::parse_envelope`, `native_ui/transcript.rs`, web `SenderCard.tsx`; slice 9b). A
message Perch delivered reaches the receiver as a banner in an ordinary user row (see "Messages"). When the
core projects the transcript it reads that row back: a user row whose text is exactly a banner this module
wrote (header, standing sentence, a closing hint naming the same session, the closing rule, every body line
quoted) gets `sender` on its `message` block, and the chat draws a card (title "Message from codex “title”",
time, the text, a link that opens the sending session, the file a long body went to) instead of the row's
text. Anything that is not exactly that, including an assistant row quoting one, stays plain text. The same
holds for the person's text through the family strip ("You, from the family strip") and a lead's roster of
status notes. It is done in Rust once for all four providers because it reads the snapshot's user rows, which
every bridge produces; nothing about a provider's own transcript format is parsed. Find and the prompt rail
use the card's title; the banner is still what the agent was shown.

Active web content must stay outside privileged app DOM/Tauri authority.
The existing desktop browser uses native child webviews, not an iframe;
its existence is not evidence that every alpha security gate has passed.

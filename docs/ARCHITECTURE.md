# Perch architecture

Current implementation reference, refreshed against `8dae768`.
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
folders on a Birdhouse or Nest, capped at 16,000 characters combined. A session pins
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
routes `/agent/spawn`, `list`, `stop`). A lead starts children in its own Nest with `perch spawn`;
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
  children the same way. Deleting a lead frees its children as ordinary sessions; deleting a child
  drops its record.
- *Reports are claims.* `perch list` returns lifecycle, whether the agent needs a person (Perch's own
  blocked state, never something the agent said), the dispatch record, and a report: the child's own
  `perch report` (kept per run, outliving it), else the first 400 characters of its last assistant
  message, labelled a fallback. Neither marks anything done.
- Local only; a lead on a remote host cannot spawn.

Active web content must stay outside privileged app DOM/Tauri authority.
The existing desktop browser uses native child webviews, not an iframe;
its existence is not evidence that every alpha security gate has passed.

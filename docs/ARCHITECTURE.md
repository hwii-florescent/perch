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
a non-loopback Host are remote even from a loopback socket and require pairing.
A proxy rewriting Host to loopback with no identifying headers is
indistinguishable from local: set `PERCH_REQUIRE_PAIRING=1` behind one.
Real Tailscale Serve has not been verified. See `server/phone_access.rs`.

The relay (`relay/`, `crates/perch-core/src/relay/`, `packages/web/src/relay/`)
is a third way in. The core dials out to a user-deployed Worker and serves each
phone as an end-to-end sealed session (key in the link fragment, AES-256-GCM,
nonces and counters bound into every frame). Tunnelled requests reach the same
router and `/ws` marked `x-perch-relay`, so they are remote and need a paired
token; only `pair`, `ws`, `workspace-file`, `clipboard-image` and `upload`
are carried. The relay's address is the `relayUrl` setting, changed only from
the computer itself. `relay.json` beside `devices.json` holds its identity.
`wire.rs` and `wire.ts` must change together (`wire.fixture.json`).

Active web content must stay outside privileged app DOM/Tauri authority.
The existing desktop browser uses native child webviews, not an iframe;
its existence is not evidence that every alpha security gate has passed.

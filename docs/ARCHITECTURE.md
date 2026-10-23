# Perch architecture

Current implementation reference, refreshed against `8dae768`.
[ROADMAP](ROADMAP.md) tracks what remains; [PUBLIC-ALPHA](PUBLIC-ALPHA.md)
defines acceptance evidence. Source presence is not a release certification.

## Process and data ownership

```text
React / Zustand / Dockview / xterm
  browser, paired phone/PWA, or Tauri webview
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
- Preserve xterm's native input (including kitty keyboard); do not guess or
  re-encode keystrokes. Shortcuts belong in `keybinds.ts::SHORTCUTS`, not
  scattered handlers; plain Ctrl letters must still reach the PTY.

## Resources, drafts and lifecycle

`surfaces.rs` gives Terminal/File/Diff host-qualified identities and per-viewer
presentation (`surface.v1`). Legacy import is idempotent and retains originals.
The web's tab/split stores remain live and `surfaceSync.ts` mirrors/restores
local workspace presentation. Remote surface synchronization is not implemented.
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

`agent_fleet::AgentLifecycleRegistry` is the lifecycle authority, persisted by
`agent_persistence.rs`. Native bridges, configured markers, OSC titles and
fallback output heuristics have different confidence. The transition bridge
`spawn_agent_turn_state_task` projects lifecycle into sidebar running/blocked
sets; do not add a competing state machine.

Local Needs You / Welcome Back persists `attention_events`. Viewing reads,
never resolves, a question. Silence is not completion; uncertainty stays
labelled. Failures and finished/exited events are distinct. Remote event relay,
per-user read state and notification deep links remain deferred.

Hosted/UI chat is frozen. When maintaining legacy message code, call
`flushChunkBuffer()` before reading/replacing messages (see its store comment);
preserve name-only attachments and plan-mode-off approval sends.

## Remote and network boundaries

Remote calls go through `ssh.rs` and the OpenSSH CLI, not an SSH crate.
Mode `perch` federates with a remote core; `direct` is reduced SSH/tmux
compatibility. The hub currently relays selected worktree/Git/review families,
not remote workspace filesystem/metadata/surfaces/attention. Full remote
workspace ownership remains the target; nothing remote may fall back locally.
`perchd connect` exists, but alone is not a remote workspace service.

Desktop serves loopback by default. Enabling Phone access opens a second
network listener and enables paired tokens; disabling it closes remote access
and device sockets. Headless core is always network-enabled. Proxy headers or
a non-loopback Host are remote even from a loopback socket and require pairing.
A proxy rewriting Host to loopback with no identifying headers is
indistinguishable from local: set `PERCH_REQUIRE_PAIRING=1` behind one.
Real Tailscale Serve has not been verified. See `server/phone_access.rs`.

Active web content must stay outside privileged app DOM/Tauri authority.
The existing desktop browser uses native child webviews, not an iframe;
its existence is not evidence that every alpha security gate has passed.

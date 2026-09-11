//! Hub federation — manages WS connections to remote perch instances.
//!
//! Each enabled `SshHost` gets a `connection_task` that runs a state machine:
//! Connecting → (direct_url? skip ssh tunnel) → ws connect → Connected.
//! On connect, the hub sends `session.list` to the remote, caches replies,
//! tags them with a `host_id` and re-broadcasts via `hub_events_tx` so every
//! browser connection gets live federated state.
//!
//! Routing: `server.rs` asks `HubManager` whether a session/terminal belongs
//! to a remote; if yes, it registers a unicast sender for the originating
//! connection and calls `forward(host_id, raw_json)`. The hub relays replies
//! from the remote back through the unicast sender.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use futures::{SinkExt, StreamExt};
use tokio::sync::mpsc::UnboundedSender;
use tokio::sync::{broadcast, watch};
use tokio_tungstenite::tungstenite::Message as WsMessage;

use crate::hosts::SshHost;
use crate::protocol::{ModelEntry, ServerMessage, SessionSummary};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Identifies whose unicast slot holds a pending reply sender.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum PendingKey {
    /// Waiting on session-scoped replies (chat.*, session.history, …).
    Session(String),
    /// Waiting on terminal-scoped replies (terminal.data, terminal.exit).
    Terminal(String),
    /// Waiting on a single `fs.browse` reply, keyed by the request's
    /// `requestId`. Single-shot — unregistered immediately on reply, unlike
    /// `Session`'s multi-message lifecycle.
    Browse(String),
    /// Waiting on a single `worktree.*` reply (`worktree.list.result`,
    /// `worktree.done`, or `worktree.error`), keyed by the request's
    /// `requestId`. Same single-shot lifecycle as `Browse`.
    Worktree(String),
    /// Waiting on a single request-correlated Git/review reply, keyed by the
    /// request id. The remote response is relayed only to the originating
    /// browser connection and consumed immediately.
    Request(String),
}

/// A pending reply sender: the browser connection-id that opened the request
/// plus the channel to send replies back to that connection's out task.
struct PendingUnicast {
    conn_id: String,
    tx: UnboundedSender<ServerMessage>,
}

/// Cached `server.info` metadata from a successfully connected remote.
#[derive(Clone)]
struct RemoteInfo {
    hostname: String,
    platform: String,
    is_ssh: bool,
    claude_models: Vec<ModelEntry>,
    codex_models: Vec<ModelEntry>,
}

/// What the hub knows about a single remote host at any instant.
#[derive(Clone)]
enum HostState {
    Connecting,
    Connected(RemoteInfo),
    Error(String),
    Disabled,
}

impl HostState {
    fn label(&self) -> &'static str {
        match self {
            HostState::Connecting => "connecting",
            HostState::Connected(_) => "connected",
            HostState::Error(_) => "error",
            HostState::Disabled => "disabled",
        }
    }
}

/// One outgoing WS sender to a connected remote, shared by the connection task
/// and `forward()`.
struct HubConnection {
    #[allow(dead_code)] // retained for logging / future diagnostics
    host_id: String,
    /// Sends raw JSON strings to the remote's WS.
    ws_tx: UnboundedSender<String>,
}

/// RAII guard around the ssh tunnel child spawned in `setup_ssh_tunnel`.
///
/// That function has many early-return failure paths (precheck, bounded ssh
/// calls, health polls, shutdown races, …), and used to require a manual
/// `tunnel_child.kill().await` before every single one of them. That's
/// exactly the shape of bug that regresses silently: a newly-added failure
/// path (the "remote precheck fails fast" branch) forgot its kill call and
/// leaked one orphaned `ssh -A -L … sleep infinity` process per retry cycle
/// against any reachable-but-not-provisioned host — observed as dozens of
/// accumulated tunnels in production.
///
/// Wrapping the child here makes that class of bug structurally impossible:
/// any early return while the guard is still armed drops it, and dropping a
/// `tokio::process::Child` created with `kill_on_drop(true)` kills the
/// process. Call [`TunnelGuard::disarm`] exactly once, only on the success
/// path, to hand the child to the long-lived watcher task that owns the
/// tunnel's lifetime for as long as the connection stays up.
///
/// Known limitation (not fixed here): none of this helps if perch-core
/// itself is SIGKILLed — there's no Drop, no async runtime, nothing runs.
/// Tunnels spawned by a SIGKILLed perch-core orphan to `launchd`/`init` and
/// keep running (observed in the wild). Only a graceful shutdown (which
/// drives `shutdown_rx` and hits the paths below) reliably tears them down.
struct TunnelGuard(Option<tokio::process::Child>);

impl TunnelGuard {
    fn new(child: tokio::process::Child) -> Self {
        Self(Some(child))
    }

    /// Access the child for `try_wait()`/polling while the guard stays armed.
    fn get_mut(&mut self) -> &mut tokio::process::Child {
        self.0.as_mut().expect("TunnelGuard used after disarm")
    }

    /// Hand ownership of the child to the caller without killing it — the
    /// tunnel is healthy and a watcher task is about to take over its
    /// lifetime. After this call the guard is inert (its `Drop` is a no-op).
    fn disarm(mut self) -> tokio::process::Child {
        self.0.take().expect("TunnelGuard already disarmed")
    }
}

// No explicit `Drop` impl needed: letting `Option<Child>` drop normally
// already kills the still-armed child, because it was spawned with
// `kill_on_drop(true)`. Keeping this implicit (rather than re-implementing
// kill-on-drop by hand) means we inherit tokio's own kill+reap behavior
// instead of subtly diverging from it.

// ---------------------------------------------------------------------------
// HubManager
// ---------------------------------------------------------------------------

pub struct HubManager {
    /// Live WS senders to remote instances.
    connections: Mutex<HashMap<String, Arc<HubConnection>>>,
    /// session_id → host_id for sessions owned by a remote.
    remote_sessions: Mutex<HashMap<String, String>>,
    /// terminal_id → host_id for terminals owned by a remote.
    remote_terminals: Mutex<HashMap<String, String>>,
    /// Cached `SessionSummary` rows received from remotes (tagged with host_id).
    remote_session_cache: Mutex<HashMap<String, SessionSummary>>,
    /// Per-outstanding-request unicast slot.  Key is Session(id) or Terminal(id).
    pending_unicast: Mutex<HashMap<PendingKey, PendingUnicast>>,
    /// Events broadcast to every browser connection: `host.info`, merged
    /// `session.list`, `session.updated`, `session.created`, relayed chat, …
    pub hub_events_tx: broadcast::Sender<Arc<ServerMessage>>,
    /// Current state of each configured host.
    host_states: Mutex<HashMap<String, HostState>>,
    /// Cached display names for hosts.
    host_names: Mutex<HashMap<String, String>>,
    /// Shutdown-flag channels per host (watch<bool> where `true` = shut down).
    shutdown_flags: Mutex<HashMap<String, watch::Sender<bool>>>,
    /// The `SshHost` config each currently-running connection task was last
    /// spawned with. Compared against incoming `hosts.upsert` configs in
    /// `reload_hosts` so a config change (e.g. `sshHost`) that arrives while
    /// the previous task is still `Connecting`/`Connected` isn't silently
    /// dropped — without this, `reload_hosts` only restarts on
    /// `None`/`Disabled`/`Error` states, so a task spawned moments earlier
    /// (still `Connecting`) would keep probing the *old* target forever.
    running_hosts: Mutex<HashMap<String, SshHost>>,
    /// The port this perch instance is listening on — used for self-connection guard.
    own_port: u16,
}

impl HubManager {
    pub fn new(own_port: u16) -> Arc<Self> {
        let (hub_events_tx, _) = broadcast::channel(128);
        Arc::new(Self {
            connections: Mutex::new(HashMap::new()),
            remote_sessions: Mutex::new(HashMap::new()),
            remote_terminals: Mutex::new(HashMap::new()),
            remote_session_cache: Mutex::new(HashMap::new()),
            pending_unicast: Mutex::new(HashMap::new()),
            hub_events_tx,
            host_states: Mutex::new(HashMap::new()),
            host_names: Mutex::new(HashMap::new()),
            shutdown_flags: Mutex::new(HashMap::new()),
            running_hosts: Mutex::new(HashMap::new()),
            own_port,
        })
    }

    /// Subscribe to hub events (returns a broadcast receiver).
    pub fn subscribe_events(&self) -> broadcast::Receiver<Arc<ServerMessage>> {
        self.hub_events_tx.subscribe()
    }

    /// Snapshot all known host states as `host.info` messages (for sending to
    /// a newly connected browser).
    pub fn snapshot_host_states(&self) -> Vec<ServerMessage> {
        let states = self.host_states.lock().unwrap();
        let names = self.host_names.lock().unwrap();
        states
            .iter()
            .map(|(id, state)| {
                build_host_info(id, names.get(id).map(|s| s.as_str()).unwrap_or(""), state)
            })
            .collect()
    }

    /// Called when `hosts.upsert` / `hosts.delete` is received. Diffs the new
    /// host list against the previous one and starts/stops tasks accordingly.
    pub fn reload_hosts(self: &Arc<Self>, hosts: &[SshHost]) {
        // Collect the new enabled host ids.
        let new_enabled: HashMap<String, SshHost> = hosts
            .iter()
            .filter(|h| h.enabled)
            .map(|h| (h.id.clone(), h.clone()))
            .collect();

        let new_disabled: Vec<String> = hosts
            .iter()
            .filter(|h| !h.enabled)
            .map(|h| h.id.clone())
            .collect();

        // Remove hosts that are completely gone (not in the new list at all).
        let current_ids: Vec<String> = {
            let states = self.host_states.lock().unwrap();
            states.keys().cloned().collect()
        };
        let new_all_ids: std::collections::HashSet<&str> =
            hosts.iter().map(|h| h.id.as_str()).collect();

        for id in &current_ids {
            if !new_all_ids.contains(id.as_str()) {
                let name = self
                    .host_names
                    .lock()
                    .unwrap()
                    .get(id)
                    .cloned()
                    .unwrap_or_default();
                self.stop_host_task(id);
                self.host_states.lock().unwrap().remove(id);
                self.host_names.lock().unwrap().remove(id);
                // Broadcast a "disabled" host.info so browsers remove it from
                // the sidebar.
                let msg = Arc::new(build_host_info(id, &name, &HostState::Disabled));
                let _ = self.hub_events_tx.send(msg);
            }
        }

        // Handle disabled hosts.
        for id in &new_disabled {
            let was_running = {
                let states = self.host_states.lock().unwrap();
                !matches!(states.get(id), Some(HostState::Disabled))
            };
            if was_running {
                self.stop_host_task(id);
                let host = hosts.iter().find(|h| &h.id == id);
                let name = host.map(|h| h.name.clone()).unwrap_or_default();
                // Best-effort: drop this host's ssh control master right
                // away instead of waiting out its ControlPersist window —
                // only possible here (not in the "removed entirely" branch
                // above) because the host's ssh_host is still in hand. See
                // `ssh::close_master`'s doc comment for why there's no
                // equivalent on perch's own process exit.
                if let Some(ssh_host) = host
                    .filter(|h| h.is_direct() && !h.ssh_host.is_empty())
                    .map(|h| h.ssh_host.clone())
                {
                    tokio::spawn(async move {
                        crate::ssh::close_master(&ssh_host).await;
                    });
                }
                self.set_host_state(id, &name, HostState::Disabled);
            }
        }

        // Handle enabled hosts: start task if new or changed.
        for (id, host) in &new_enabled {
            self.host_names
                .lock()
                .unwrap()
                .insert(id.clone(), host.name.clone());
            let current_state = {
                let states = self.host_states.lock().unwrap();
                states.get(id).cloned()
            };
            let should_start = match &current_state {
                None | Some(HostState::Disabled) | Some(HostState::Error(_)) => true,
                Some(HostState::Connecting) | Some(HostState::Connected(_)) => {
                    // The task is still connecting/connected, but its config
                    // may be stale (e.g. `sshHost` just changed underneath
                    // it). Restart if what's actually running differs from
                    // what was just upserted — otherwise the new config is
                    // silently dropped and the old task keeps running
                    // against the old target indefinitely.
                    self.running_hosts.lock().unwrap().get(id) != Some(host)
                }
            };
            if should_start {
                self.stop_host_task(id); // ensure any old task is gone
                self.spawn_connection_task(host.clone());
            } else {
                // Already connecting/connected — re-emit the current state so
                // any newly-connected browser client receives confirmation.
                if let Some(state) = current_state {
                    let msg = Arc::new(build_host_info(id, &host.name, &state));
                    let _ = self.hub_events_tx.send(msg);
                }
            }
        }
    }

    /// Stop the connection task for a host by sending `true` on its shutdown flag.
    fn stop_host_task(&self, host_id: &str) {
        let tx = self.shutdown_flags.lock().unwrap().remove(host_id);
        if let Some(tx) = tx {
            let _ = tx.send(true);
        }
        // Remove the active WS sender so forward() fails cleanly.
        self.connections.lock().unwrap().remove(host_id);
        // Forget the config it was running so a later re-upsert with the
        // same config (after the host was fully removed) is treated as a
        // fresh start rather than a stale no-op comparison.
        self.running_hosts.lock().unwrap().remove(host_id);
    }

    /// Update the state for a host and broadcast a `host.info` event.
    fn set_host_state(&self, host_id: &str, name: &str, state: HostState) {
        self.host_states
            .lock()
            .unwrap()
            .insert(host_id.to_string(), state.clone());
        let msg = Arc::new(build_host_info(host_id, name, &state));
        let _ = self.hub_events_tx.send(msg);
    }

    /// Spawn a background task that manages the WS connection to `host`.
    fn spawn_connection_task(self: &Arc<Self>, host: SshHost) {
        let (shutdown_tx, shutdown_rx) = watch::channel(false);
        self.shutdown_flags
            .lock()
            .unwrap()
            .insert(host.id.clone(), shutdown_tx);
        self.running_hosts
            .lock()
            .unwrap()
            .insert(host.id.clone(), host.clone());

        let hub = self.clone();
        tokio::spawn(async move {
            hub.connection_task(host, shutdown_rx).await;
        });
    }

    /// The connection task state machine for one host.
    async fn connection_task(
        self: &Arc<Self>,
        host: SshHost,
        mut shutdown_rx: watch::Receiver<bool>,
    ) {
        // `mode: "direct"` hosts have no perch on the other end and therefore
        // no WS state machine at all — see `direct_connection_task`.
        if host.is_direct() {
            self.direct_connection_task(host, shutdown_rx).await;
            return;
        }
        let host_id = host.id.clone();
        let host_name = host.name.clone();
        let own_port = self.own_port;

        // Backoff starts at 5s (not aggressive-fast — the auto-start path can
        // be expensive to retry: precheck + 15s health poll) and doubles up
        // to a 60s cap, resetting to the floor on a successful connect. The
        // host state is set to `Error(msg)` before every backoff sleep and
        // only flips back to `Connecting` when the next attempt actually
        // begins (top of the loop) — so the UI shows the real error for the
        // whole backoff window instead of bouncing straight back to
        // "connecting".
        let mut backoff_ms: u64 = 5_000;
        const MIN_BACKOFF_MS: u64 = 5_000;
        const MAX_BACKOFF_MS: u64 = 60_000;

        loop {
            // Check for shutdown before each attempt.
            if *shutdown_rx.borrow() {
                tracing::info!("[hub] {host_id}: shutdown requested");
                return;
            }

            self.set_host_state(&host_id, &host_name, HostState::Connecting);
            tracing::info!("[hub] {host_id}: connecting…");

            // Resolve the WS URL to connect to.
            let ws_url = if let Some(direct) = &host.direct_url {
                // Self-connection guard for direct_url.
                if is_self_url(direct, own_port) {
                    let err = "refusing to connect to self".to_string();
                    tracing::warn!("[hub] {host_id}: {err}");
                    self.set_host_state(&host_id, &host_name, HostState::Error(err));
                    return; // permanent error — don't retry
                }
                direct.clone()
            } else {
                // SSH tunnel path: health-check → tunnel (agent-fwd + symlink)
                //   → auto-start (if needed) → health-poll via local port → connect.
                match self
                    .setup_ssh_tunnel(&host, own_port, &mut shutdown_rx)
                    .await
                {
                    Some(url) => url,
                    None => {
                        // setup_ssh_tunnel already set state or shutdown was requested.
                        if *shutdown_rx.borrow() {
                            return;
                        }
                        // Back off and retry.
                        let sleep =
                            tokio::time::sleep(std::time::Duration::from_millis(backoff_ms));
                        tokio::select! {
                            _ = sleep => {}
                            _ = shutdown_rx.changed() => { return; }
                        }
                        backoff_ms = (backoff_ms * 2).min(MAX_BACKOFF_MS);
                        continue;
                    }
                }
            };

            // Attempt WS connection.
            let connect_result = tokio::select! {
                r = tokio_tungstenite::connect_async(&ws_url) => r,
                _ = shutdown_rx.changed() => { return; }
            };

            let (ws_stream, _) = match connect_result {
                Ok(r) => r,
                Err(e) => {
                    let err = format!("ws connect failed: {e}");
                    tracing::warn!("[hub] {host_id}: {err}");
                    self.set_host_state(&host_id, &host_name, HostState::Error(err));
                    let sleep = tokio::time::sleep(std::time::Duration::from_millis(backoff_ms));
                    tokio::select! {
                        _ = sleep => {}
                        _ = shutdown_rx.changed() => { return; }
                    }
                    backoff_ms = (backoff_ms * 2).min(MAX_BACKOFF_MS);
                    continue;
                }
            };

            tracing::info!("[hub] {host_id}: WS connected to {ws_url}");
            // Reset backoff on successful connect.
            backoff_ms = MIN_BACKOFF_MS;

            let (mut ws_sink, mut ws_stream) = ws_stream.split();

            // Channel for forward() → WS sink.
            let (ws_tx, mut ws_rx) = tokio::sync::mpsc::unbounded_channel::<String>();
            let conn = Arc::new(HubConnection {
                host_id: host_id.clone(),
                ws_tx: ws_tx.clone(),
            });
            self.connections
                .lock()
                .unwrap()
                .insert(host_id.clone(), conn);

            // Sink task: forward queued messages to remote.
            let sink_task = tokio::spawn(async move {
                while let Some(text) = ws_rx.recv().await {
                    if ws_sink.send(WsMessage::Text(text)).await.is_err() {
                        break;
                    }
                }
            });

            // Request session list immediately on connect.
            let _ = ws_tx.send(r#"{"type":"session.list"}"#.to_string());

            // Receive loop.
            let disconnect_reason;
            loop {
                tokio::select! {
                    maybe_msg = ws_stream.next() => {
                        match maybe_msg {
                            Some(Ok(WsMessage::Text(text))) => {
                                self.handle_remote_message(&host_id, &host_name, &text).await;
                            }
                            Some(Ok(WsMessage::Close(_))) | None => {
                                disconnect_reason = "remote closed".to_string();
                                break;
                            }
                            Some(Err(e)) => {
                                disconnect_reason = format!("ws error: {e}");
                                break;
                            }
                            Some(Ok(_)) => {} // ping/pong/binary: ignore
                        }
                    }
                    _ = shutdown_rx.changed() => {
                        sink_task.abort();
                        return;
                    }
                }
            }

            sink_task.abort();
            self.connections.lock().unwrap().remove(&host_id);

            tracing::warn!("[hub] {host_id}: disconnected ({disconnect_reason}), reconnecting…");
            self.set_host_state(&host_id, &host_name, HostState::Error(disconnect_reason));

            let sleep = tokio::time::sleep(std::time::Duration::from_millis(backoff_ms));
            tokio::select! {
                _ = sleep => {}
                _ = shutdown_rx.changed() => { return; }
            }
            backoff_ms = (backoff_ms * 2).min(MAX_BACKOFF_MS);
        }
    }

    /// The connection state machine for a `mode: "direct"` host.
    ///
    /// There is no perch on the other end, so there is nothing to tunnel to,
    /// nothing to auto-start and no WS to hold open — "connected" here means
    /// *"ssh works and the host has the CLIs we need"*. The task therefore
    /// reduces to: probe → publish `host.info` → re-probe periodically so a
    /// devpod that goes away is reflected in the sidebar.
    ///
    /// The claude list published for the host is perch's own static catalogue
    /// (universal aliases — there is no per-machine claude model file), and
    /// each list is dropped entirely when the probe finds no corresponding
    /// CLI: advertising codex models on a box with no `codex` would be a lie
    /// the user only pays for when their turn fails. The **codex** list is
    /// genuinely the remote's own — `~/.codex/config.toml` + its catalogue
    /// JSON are fetched over ssh on the same probe cycle (see
    /// `ssh::fetch_remote_codex_catalog`), so a devpod serving different
    /// models than the laptop shows exactly those. A remote with no readable
    /// catalogue file degrades to perch's built-in codex list.
    ///
    /// Sessions on a direct host are *not* fetched from the remote (it has no
    /// DB); they live in the local DB tagged with this host id, so the normal
    /// `session.list` path already returns them and no `remote_sessions`
    /// routing entry is ever created for them.
    async fn direct_connection_task(
        self: &Arc<Self>,
        host: SshHost,
        mut shutdown_rx: watch::Receiver<bool>,
    ) {
        let host_id = host.id.clone();
        let host_name = host.name.clone();
        let ssh_host = host.ssh_host.clone();

        if ssh_host.is_empty() {
            self.set_host_state(
                &host_id,
                &host_name,
                HostState::Error("no sshHost configured".to_string()),
            );
            return;
        }

        let mut backoff_ms: u64 = 5_000;
        const MIN_BACKOFF_MS: u64 = 5_000;
        const MAX_BACKOFF_MS: u64 = 60_000;
        // Re-probe cadence once healthy. Cheap (one ssh round trip) but not
        // free on a devpod behind a ProxyCommand, hence minutes not seconds.
        const HEALTHY_REPROBE_SECS: u64 = 120;
        let mut healthy = false;

        loop {
            if *shutdown_rx.borrow() {
                return;
            }
            // Only announce "connecting" when we aren't already known-good:
            // the periodic re-probe of a healthy host must not make the
            // sidebar flash back to connecting every two minutes.
            if !healthy {
                self.set_host_state(&host_id, &host_name, HostState::Connecting);
            }

            let probe = crate::ssh::probe_host(&ssh_host);
            let result = tokio::select! {
                r = probe => r,
                _ = shutdown_rx.changed() => return,
            };

            let wait_secs = match result {
                Ok(prereqs) => match prereqs.missing() {
                    Some(missing) => {
                        tracing::warn!("[hub] {host_id}: {missing}");
                        self.set_host_state(&host_id, &host_name, HostState::Error(missing));
                        healthy = false;
                        let wait = backoff_ms / 1000;
                        backoff_ms = (backoff_ms * 2).min(MAX_BACKOFF_MS);
                        wait
                    }
                    None => {
                        let catalogue = crate::models::catalogue();
                        // The remote's own codex catalogue, one extra bounded
                        // ssh exec on the probe cycle (cheap over the shared
                        // control master) — so a catalogue change on the
                        // devpod is picked up by the next re-probe with no
                        // perch restart.
                        let codex_models = if prereqs.codex_version.is_some() {
                            let remote = crate::ssh::fetch_remote_codex_catalog(&ssh_host)
                                .await
                                .map(|payload| crate::models::parse_remote_codex_payload(&payload))
                                .unwrap_or_default();
                            if remote.is_empty() {
                                tracing::info!(
                                    "[hub] {host_id}: no readable codex model catalogue on the \
                                     remote (~/.codex) — falling back to perch's built-in list"
                                );
                                catalogue.codex.clone()
                            } else {
                                tracing::info!(
                                    "[hub] {host_id}: remote codex catalogue: {} entries \
                                     (default {})",
                                    remote.len(),
                                    remote
                                        .iter()
                                        .find(|m| m.is_default)
                                        .unwrap_or(&remote[0])
                                        .id
                                );
                                remote
                            }
                        } else {
                            Vec::new()
                        };
                        let info = RemoteInfo {
                            hostname: if prereqs.hostname.is_empty() {
                                ssh_host.clone()
                            } else {
                                prereqs.hostname.clone()
                            },
                            platform: prereqs.platform.clone(),
                            is_ssh: true,
                            claude_models: if prereqs.claude_version.is_some() {
                                catalogue.claude.clone()
                            } else {
                                Vec::new()
                            },
                            codex_models,
                        };
                        tracing::info!(
                            "[hub] {host_id}: direct host ready (claude={:?} codex={:?} tmux={:?})",
                            prereqs.claude_version,
                            prereqs.codex_version,
                            prereqs.tmux_version,
                        );
                        self.set_host_state(&host_id, &host_name, HostState::Connected(info));
                        healthy = true;
                        backoff_ms = MIN_BACKOFF_MS;
                        // Explicit retention policy for run dirs perch has
                        // already ingested (see `detached.rs`).
                        crate::detached::prune_old_runs(&ssh_host).await;
                        HEALTHY_REPROBE_SECS
                    }
                },
                Err(err) => {
                    tracing::warn!("[hub] {host_id}: direct probe failed: {err}");
                    self.set_host_state(&host_id, &host_name, HostState::Error(err));
                    healthy = false;
                    let wait = backoff_ms / 1000;
                    backoff_ms = (backoff_ms * 2).min(MAX_BACKOFF_MS);
                    wait
                }
            };

            let sleep = tokio::time::sleep(std::time::Duration::from_secs(wait_secs.max(1)));
            tokio::select! {
                _ = sleep => {}
                _ = shutdown_rx.changed() => return,
            }
        }
    }

    /// SSH-path setup: health check, tunnel (with agent forwarding + stable
    /// symlink), optional auto-start, health poll via local port. Returns the
    /// `ws://127.0.0.1:<localPort>/ws` URL to connect to, or `None` on failure.
    ///
    /// New state-machine order (fixes dead SSH_AUTH_SOCK in tmux-spawned perch):
    ///   1. Health check via ssh (is remote perch already up?)
    ///   2. Bind a free local port.
    ///   3. Start tunnel with `-A` — the remote command creates
    ///      `~/.ssh/perch_auth_sock → $SSH_AUTH_SOCK` (stable symlink) and then
    ///      sleeps so the port-forward lifetime equals the process lifetime.
    ///   4. Poll until the local tunnel port accepts TCP (tunnel ready).
    ///   5. If remote was NOT already up:
    ///      - 5a. Cheap remote precheck (prerequisites for the auto-start
    ///        command — see `precheck_remote_prereqs`) so a broken remote
    ///        (e.g. no perch checkout) fails in ~seconds with an
    ///        actionable message instead of silently burning the full
    ///        15s health-poll window every retry.
    ///      - 5b. Auto-start via a separate ssh exec that exports
    ///        SSH_AUTH_SOCK pointing at the stable symlink.
    ///   6. If auto-started: poll health via the LOCAL tunnel port (HTTP GET)
    ///      for up to 15s. On timeout, capture best-effort tmux diagnostics
    ///      (`capture_start_diagnostics`) and fold them into the error.
    ///   7. Return the ws URL.
    ///
    /// Every ssh subprocess spawned in this function is bounded by
    /// `run_ssh_bounded`'s overall `tokio::time::timeout` (in addition to any
    /// `-o ConnectTimeout=`) — devpod ProxyCommand wrappers can stall well
    /// past TCP connect, and a hung ssh child must not wedge the state
    /// machine.
    async fn setup_ssh_tunnel(
        self: &Arc<Self>,
        host: &SshHost,
        own_port: u16,
        shutdown_rx: &mut watch::Receiver<bool>,
    ) -> Option<String> {
        let ssh_host = &host.ssh_host;
        let remote_port = host.remote_port;

        if ssh_host.is_empty() {
            tracing::warn!(
                "[hub] {}: no sshHost and no directUrl — cannot connect",
                host.id
            );
            self.set_host_state(
                &host.id,
                &host.name,
                HostState::Error("no sshHost configured".to_string()),
            );
            return None;
        }

        // 1. Health check: is the remote perch already running?
        tracing::info!("[hub] {}: checking if remote perch is already up", host.id);
        let health_ok = {
            let curl_cmd = format!("curl -s --max-time 3 http://localhost:{remote_port}/");
            let args = [
                "-o",
                "BatchMode=yes",
                "-o",
                "ConnectTimeout=5",
                ssh_host.as_str(),
                curl_cmd.as_str(),
            ];
            let check = run_ssh_bounded(&args, 20, "health check");
            let check_result = tokio::select! {
                r = check => r,
                _ = shutdown_rx.changed() => { return None; }
            };
            matches!(check_result, Ok(out) if out.status.success())
        };

        // 2. Bind a free local port (before spawning the tunnel).
        let local_port = {
            let listener = match std::net::TcpListener::bind("127.0.0.1:0") {
                Ok(l) => l,
                Err(e) => {
                    tracing::warn!("[hub] {}: failed to bind free port: {e}", host.id);
                    self.set_host_state(
                        &host.id,
                        &host.name,
                        HostState::Error(format!("bind failed: {e}")),
                    );
                    return None;
                }
            };
            let addr: SocketAddr = listener.local_addr().ok()?;
            // Drop the listener so SSH can bind to the same port.
            drop(listener);
            addr.port()
        };

        // Self-connection guard for tunnel.
        if local_port == own_port {
            let err = "refusing to connect to self (port collision)".to_string();
            tracing::warn!("[hub] {}: {err}", host.id);
            self.set_host_state(&host.id, &host.name, HostState::Error(err));
            return None;
        }

        // 3. Start the SSH tunnel with agent forwarding (-A).
        //    The remote command:
        //      • creates ~/.ssh/ if needed
        //      • atomically re-points ~/.ssh/perch_auth_sock at the live
        //        SSH_AUTH_SOCK that was forwarded for THIS connection
        //      • then exec-sleeps so the process (and thus the tunnel) lives
        //        until we kill it.
        //    $SSH_AUTH_SOCK is intentionally NOT expanded by the local shell —
        //    the single-quote wrapper around the outer arg and the escaped $
        //    inside ensure the remote shell expands it.
        //
        //    Resulting ssh invocation (tokio::process::Command passes each
        //    element as a separate argv entry — no local shell involved):
        //      ssh -A -L <lp>:127.0.0.1:<rp> \
        //          -o ExitOnForwardFailure=yes -o ConnectTimeout=10 -o BatchMode=yes <host> \
        //          "mkdir -p ~/.ssh; ln -sf \"$SSH_AUTH_SOCK\" ~/.ssh/perch_auth_sock; exec sleep infinity"
        let tunnel_remote_cmd = format!(
            r#"mkdir -p ~/.ssh; ln -sf "$SSH_AUTH_SOCK" ~/.ssh/perch_auth_sock; exec sleep infinity"#
        );
        tracing::info!(
            "[hub] {}: starting SSH tunnel (agent-forwarded) :{}→{}:{}",
            host.id,
            local_port,
            ssh_host,
            remote_port
        );
        // Wrapped in `TunnelGuard` from the moment it exists: every early
        // `return None` below drops the guard, which kills the still-running
        // ssh child automatically (see `TunnelGuard` doc comment) — no
        // per-branch `tunnel_child.kill().await` needed or wanted.
        let mut tunnel_child = match tokio::process::Command::new("ssh")
            .args([
                "-A",
                "-L",
                &format!("{local_port}:127.0.0.1:{remote_port}"),
                "-o",
                "ExitOnForwardFailure=yes",
                // Bounds the initial TCP+handshake phase; the tunnel-ready
                // poll below (step 4) additionally kills the child after ~5s
                // regardless, so this is a defensive backstop against
                // ProxyCommand wrappers that stall past normal TCP connect.
                "-o",
                "ConnectTimeout=10",
                "-o",
                "BatchMode=yes",
                ssh_host,
                &tunnel_remote_cmd,
            ])
            // Defense in depth (belt-and-suspenders alongside `TunnelGuard`):
            // if the whole perch-core process dies in a way that still runs
            // Drop glue (panic unwind, normal exit), this alone would kill
            // the child even without the guard.
            .kill_on_drop(true)
            .spawn()
        {
            Ok(child) => TunnelGuard::new(child),
            Err(e) => {
                tracing::warn!("[hub] {}: tunnel spawn failed: {e}", host.id);
                self.set_host_state(
                    &host.id,
                    &host.name,
                    HostState::Error(format!("tunnel failed: {e}")),
                );
                return None;
            }
        };

        // 4. Poll until the local tunnel port accepts TCP connections (up to 5s).
        {
            let mut tunnel_ready = false;
            for _ in 0..25 {
                // Check for early exit first.
                match tunnel_child.get_mut().try_wait() {
                    Ok(Some(status)) => {
                        let err = format!("SSH tunnel exited early ({})", status);
                        tracing::warn!("[hub] {}: {err}", host.id);
                        self.set_host_state(&host.id, &host.name, HostState::Error(err));
                        return None;
                    }
                    _ => {}
                }
                // Try a non-blocking TCP connect to the local forwarded port.
                if std::net::TcpStream::connect(format!("127.0.0.1:{local_port}")).is_ok() {
                    tunnel_ready = true;
                    break;
                }
                let delay = tokio::time::sleep(std::time::Duration::from_millis(200));
                tokio::select! {
                    _ = delay => {}
                    _ = shutdown_rx.changed() => {
                        return None;
                    }
                }
            }
            if !tunnel_ready {
                let err = "SSH tunnel did not bind local port in time".to_string();
                tracing::warn!("[hub] {}: {err}", host.id);
                self.set_host_state(&host.id, &host.name, HostState::Error(err));
                return None;
            }
            tracing::info!(
                "[hub] {}: SSH tunnel ready on :{local_port} (symlink refreshed)",
                host.id
            );
        }

        // 5. Auto-start if remote perch was not already running.
        //    The tmux inner command exports SSH_AUTH_SOCK pointing at the stable
        //    symlink created by the tunnel above, so the spawned perch (and every
        //    claude/codex it forks) can reach a live agent socket.
        //
        //    $HOME is expanded by the REMOTE shell (ssh passes this as a single
        //    argv element; the remote sh -c receives it verbatim).
        if !health_ok {
            // 5a. Cheap precheck: verify the auto-start command's prerequisites
            //     before burning a 15s health-poll window on a remote that
            //     can never come up (e.g. no perch checkout at all). This is
            //     the fix for the "devpod with no perch checkout" incident:
            //     without it, every retry cycle spent ~15-20s in "connecting"
            //     for one brief "error" flash, making the UI look permanently
            //     stuck instead of showing an actionable message.
            let has_custom_cmd = host.remote_cmd.is_some();
            let precheck = precheck_remote_prereqs(ssh_host, has_custom_cmd);
            let precheck_result = tokio::select! {
                r = precheck => r,
                _ = shutdown_rx.changed() => {
                    return None;
                }
            };
            if let Err(msg) = precheck_result {
                tracing::warn!("[hub] {}: {msg}", host.id);
                self.set_host_state(&host.id, &host.name, HostState::Error(msg));
                return None;
            }

            let remote_cmd_template = host.remote_cmd.clone().unwrap_or_else(|| {
                "cd ~/perch && ./target/debug/perch-core --port {port}".to_string()
            });
            let remote_cmd = remote_cmd_template.replace("{port}", &remote_port.to_string());

            // Prefix with stable-socket export so tmux child inherits a live agent.
            let tmux_inner =
                format!(r#"export SSH_AUTH_SOCK=$HOME/.ssh/perch_auth_sock; {remote_cmd}"#);

            tracing::info!(
                "[hub] {}: auto-starting remote perch via tmux (with agent socket)",
                host.id
            );
            let tmux_cmd = format!("tmux new-session -A -d -s perch-core '{tmux_inner}'");
            let start_args = [
                "-o",
                "BatchMode=yes",
                "-o",
                "ConnectTimeout=10",
                ssh_host.as_str(),
                tmux_cmd.as_str(),
            ];
            let start = run_ssh_bounded(&start_args, 20, "auto-start");
            let start_result = tokio::select! {
                r = start => r,
                _ = shutdown_rx.changed() => {
                    return None;
                }
            };
            if let Err(e) = start_result {
                tracing::warn!("[hub] {}: {e}", host.id);
                self.set_host_state(&host.id, &host.name, HostState::Error(e));
                return None;
            }

            // 6. Poll up to 15 s for the remote to become healthy — via the
            //    LOCAL tunnel port (no extra ssh round-trips needed).
            tracing::info!(
                "[hub] {}: waiting for remote perch to come up on tunnel :{local_port}",
                host.id
            );
            let mut polls = 0u32;
            loop {
                if *shutdown_rx.borrow() {
                    return None;
                }
                polls += 1;
                if polls > 30 {
                    // Prechecks passed but the remote still never came up —
                    // capture best-effort tmux diagnostics (session alive? last
                    // pane output?) and fold a one-line summary into the error
                    // so the failure is actionable instead of a bare timeout.
                    let diag = capture_start_diagnostics(ssh_host);
                    let diag = tokio::select! {
                        d = diag => d,
                        _ = shutdown_rx.changed() => {
                            return None;
                        }
                    };
                    let err = format!("remote perch did not start in time ({diag})");
                    tracing::warn!("[hub] {}: {err}", host.id);
                    self.set_host_state(&host.id, &host.name, HostState::Error(err));
                    return None;
                }
                let delay = tokio::time::sleep(std::time::Duration::from_millis(500));
                tokio::select! {
                    _ = delay => {}
                    _ = shutdown_rx.changed() => {
                        return None;
                    }
                }
                // HTTP health check through the local tunnel port — no ssh needed.
                let health = tokio::process::Command::new("curl")
                    .args([
                        "-s",
                        "--max-time",
                        "2",
                        &format!("http://127.0.0.1:{local_port}/"),
                    ])
                    .output()
                    .await;
                if matches!(health, Ok(out) if out.status.success()) {
                    break;
                }
            }
        }

        // Tunnel confirmed healthy — disarm the guard and hand the child to
        // the watcher task below, which now owns its lifetime for as long as
        // the connection stays up (killed via `stop_host_task`'s shutdown
        // signal driving a future `setup_ssh_tunnel` call's early returns, or
        // by the process exiting on its own and being observed by `.wait()`
        // here).
        let mut tunnel_child = tunnel_child.disarm();

        // Spawn a watcher that triggers state→error when the tunnel exits
        // unexpectedly while we are still connected.
        let hub = self.clone();
        let hid = host.id.clone();
        let hname = host.name.clone();
        let hub_tx = self.hub_events_tx.clone();
        tokio::spawn(async move {
            let _ = tunnel_child.wait().await;
            // If we're still connected, the unexpected exit warrants an error.
            let is_connected = {
                let s = hub.host_states.lock().unwrap();
                matches!(s.get(&hid), Some(HostState::Connected(_)))
            };
            if is_connected {
                tracing::warn!("[hub] {hid}: SSH tunnel exited unexpectedly");
                hub.host_states.lock().unwrap().insert(
                    hid.clone(),
                    HostState::Error("SSH tunnel exited".to_string()),
                );
                let msg = Arc::new(build_host_info(
                    &hid,
                    &hname,
                    &HostState::Error("SSH tunnel exited".to_string()),
                ));
                let _ = hub_tx.send(msg);
            }
        });

        Some(format!("ws://127.0.0.1:{local_port}/ws"))
    }

    /// Process one message received from a remote perch instance.
    pub async fn handle_remote_message(&self, host_id: &str, host_name: &str, text: &str) {
        let msg: ServerMessage = match serde_json::from_str(text) {
            Ok(m) => m,
            Err(e) => {
                tracing::warn!("[hub] {host_id}: unparseable message: {e}");
                return;
            }
        };

        match msg {
            // ----------------------------------------------------------------
            // server.info → cache metadata, transition to Connected
            // ----------------------------------------------------------------
            ServerMessage::ServerInfo {
                hostname,
                is_ssh,
                platform,
                claude_models,
                codex_models,
                // A remote's terminal profile is deliberately ignored: the
                // xterm rendering its output runs in the *local* client, so
                // the local machine's terminal appearance is the one to match.
                ..
            } => {
                let info = RemoteInfo {
                    hostname: hostname.clone(),
                    platform: platform.clone(),
                    is_ssh,
                    claude_models: claude_models.clone(),
                    codex_models: codex_models.clone(),
                };
                self.set_host_state(host_id, host_name, HostState::Connected(info));
            }

            // ----------------------------------------------------------------
            // session.list → tag host_id, update caches, broadcast merged list
            // ----------------------------------------------------------------
            ServerMessage::SessionList { sessions } => {
                {
                    let mut remote_sessions = self.remote_sessions.lock().unwrap();
                    let mut cache = self.remote_session_cache.lock().unwrap();
                    // Remove stale entries for this host.
                    remote_sessions.retain(|_, hid| hid != host_id);
                    cache.retain(|_, s| s.host_id != host_id);
                    for mut session in sessions {
                        session.host_id = host_id.to_string();
                        remote_sessions.insert(session.id.clone(), host_id.to_string());
                        cache.insert(session.id.clone(), session);
                    }
                }
                // Broadcast a merged session.list (hub sends the snapshot;
                // per-connection handler merges with local sessions when it
                // assembles the actual response for `session.list` from the
                // client — here we simply broadcast the remote portion).
                self.broadcast_merged_session_list();
            }

            // ----------------------------------------------------------------
            // session.created → register mapping + relay via unicast + broadcast
            // ----------------------------------------------------------------
            ServerMessage::SessionCreated { ref session_id } => {
                {
                    let mut remote_sessions = self.remote_sessions.lock().unwrap();
                    remote_sessions.insert(session_id.clone(), host_id.to_string());
                }
                // Relay to any unicast that was registered for this session,
                // AND broadcast to all connections so the initiating browser
                // (which forwarded session.create without a registered unicast)
                // also receives session.created.
                self.relay_unicast(
                    &PendingKey::Session(session_id.clone()),
                    Arc::new(msg.clone()),
                );
                let _ = self.hub_events_tx.send(Arc::new(msg));
            }

            // ----------------------------------------------------------------
            // session.updated → tag + cache + broadcast
            // ----------------------------------------------------------------
            ServerMessage::SessionUpdated { mut session } => {
                session.host_id = host_id.to_string();
                {
                    let mut remote_sessions = self.remote_sessions.lock().unwrap();
                    remote_sessions.insert(session.id.clone(), host_id.to_string());
                    let mut cache = self.remote_session_cache.lock().unwrap();
                    cache.insert(session.id.clone(), session.clone());
                }
                let tagged = ServerMessage::SessionUpdated { session };
                let _ = self.hub_events_tx.send(Arc::new(tagged));
            }

            // ----------------------------------------------------------------
            // session.deleted → drop from remote caches + broadcast as-is
            // (sessionId is unambiguous across hosts; no host_id to tag here,
            // same as SessionCreated).
            // ----------------------------------------------------------------
            ServerMessage::SessionDeleted { ref session_id } => {
                self.remote_sessions.lock().unwrap().remove(session_id);
                self.remote_session_cache.lock().unwrap().remove(session_id);
                let _ = self.hub_events_tx.send(Arc::new(msg));
            }

            // ----------------------------------------------------------------
            // session.history → relay via Session unicast
            // ----------------------------------------------------------------
            ServerMessage::SessionHistory { ref session_id, .. } => {
                let key = PendingKey::Session(session_id.clone());
                self.relay_unicast(&key, Arc::new(msg));
            }

            // ----------------------------------------------------------------
            // session.layout → reply to session.layout.get, relay via Session
            // unicast (same key session.subscribe/chat.send already register).
            // ----------------------------------------------------------------
            ServerMessage::SessionLayout { ref session_id, .. } => {
                let key = PendingKey::Session(session_id.clone());
                self.relay_unicast(&key, Arc::new(msg));
            }

            // Mode/lifecycle/control replies are request-correlated.  Keep
            // them on the originating connection instead of broadcasting a
            // device-specific lease or mode result to every browser.
            ServerMessage::SessionMode { ref request_id, .. }
            | ServerMessage::AgentLifecycle { ref request_id, .. }
            | ServerMessage::AgentTerminalOpened { ref request_id, .. }
            | ServerMessage::AgentControl { ref request_id, .. }
            | ServerMessage::TerminalOpened { ref request_id, .. }
            | ServerMessage::TerminalListResult { ref request_id, .. }
            | ServerMessage::TerminalClosed { ref request_id, .. } => {
                let key = PendingKey::Request(request_id.clone());
                self.relay_unicast(&key, Arc::new(msg));
                self.pending_unicast.lock().unwrap().remove(&key);
            }
            ServerMessage::AgentManifestList {
                request_id,
                manifests,
                ..
            } => {
                // The remote cannot choose the origin field. Stamp it from
                // the authenticated hub connection before routing the one
                // response back to the requesting browser.
                let tagged = ServerMessage::AgentManifestList {
                    request_id: request_id.clone(),
                    host_id: Some(host_id.to_string()),
                    manifests,
                };
                let key = PendingKey::Request(request_id);
                self.relay_unicast(&key, Arc::new(tagged));
                self.pending_unicast.lock().unwrap().remove(&key);
            }

            // A mode mutation is broadcast by its owning perch without an
            // effective value: each browser must refetch with its own device
            // identity. Stamp the authenticated remote host so a local client
            // can keep policy caches host-scoped.
            ServerMessage::SessionModeInvalidated {
                session_id,
                workspace_id,
                device_id,
                revision,
                ..
            } => {
                let tagged = ServerMessage::SessionModeInvalidated {
                    session_id,
                    workspace_id,
                    device_id,
                    host_id: Some(host_id.to_string()),
                    revision,
                };
                let _ = self.hub_events_tx.send(Arc::new(tagged));
            }

            ServerMessage::AgentLifecycleChanged { status, .. } => {
                let _ = self
                    .hub_events_tx
                    .send(Arc::new(ServerMessage::AgentLifecycleChanged {
                        host_id: host_id.to_string(),
                        status,
                    }));
            }

            ServerMessage::ReviewBatchDelivery {
                workspace_id,
                packet_id,
                send_operation_id,
                delivery,
                target_session_id,
                target_agent_id,
                ..
            } => {
                let _ = self
                    .hub_events_tx
                    .send(Arc::new(ServerMessage::ReviewBatchDelivery {
                        workspace_id,
                        packet_id,
                        send_operation_id,
                        delivery,
                        host_id: Some(host_id.to_string()),
                        target_session_id,
                        target_agent_id,
                    }));
            }

            // ----------------------------------------------------------------
            // chat.* → relay via Session unicast; chat.done also clears it
            // ----------------------------------------------------------------
            ServerMessage::ChatChunk { ref session_id, .. }
            | ServerMessage::ChatThinking { ref session_id, .. }
            | ServerMessage::ChatToolUse { ref session_id, .. }
            | ServerMessage::ChatPlan { ref session_id, .. }
            | ServerMessage::CommandsList { ref session_id, .. }
            | ServerMessage::ChatToolResult { ref session_id, .. } => {
                let key = PendingKey::Session(session_id.clone());
                self.relay_unicast(&key, Arc::new(msg));
            }
            ServerMessage::ChatDone { ref session_id, .. } => {
                let sid = session_id.clone();
                self.relay_unicast(&PendingKey::Session(sid.clone()), Arc::new(msg));
                // Clear the pending unicast so the sender doesn't leak.
                self.pending_unicast
                    .lock()
                    .unwrap()
                    .remove(&PendingKey::Session(sid));
            }

            // ----------------------------------------------------------------
            // error → relay via whichever unicast makes sense (best-effort)
            // ----------------------------------------------------------------
            ServerMessage::Error {
                ref message,
                ref request_id,
                ..
            } => {
                if let Some(request_id) = request_id {
                    let key = PendingKey::Request(request_id.clone());
                    self.relay_unicast(&key, Arc::new(msg));
                    self.pending_unicast.lock().unwrap().remove(&key);
                } else {
                    // Broadcast uncorrelated errors to hub listeners.
                    tracing::warn!("[hub] {host_id}: remote error: {message}");
                    let _ = self.hub_events_tx.send(Arc::new(msg));
                }
            }

            // ----------------------------------------------------------------
            // status.update → relay via hub broadcast (tagged? ignore for now)
            // ----------------------------------------------------------------
            ServerMessage::StatusUpdate { .. } => {
                // Status updates are per-host; we don't relay them in v1.
            }

            // ----------------------------------------------------------------
            // terminal.created → swap Session→Terminal pending key + relay
            // ----------------------------------------------------------------
            ServerMessage::TerminalCreated { ref terminal_id } => {
                let tid = terminal_id.clone();
                // The session_id that initiated this request was stored as
                // PendingKey::Session(_). We need to find it, swap the key to
                // PendingKey::Terminal, and relay.
                //
                // The server.rs caller must have registered a Session unicast
                // before forwarding the terminal.create.  The session_id is
                // NOT in this message — we look for a session whose Session key
                // was placed by this connection.  Since terminal.create always
                // carries a session_id via agentAttach, server.rs will have
                // set a Session key.  We do the swap atomically under one lock.
                let session_id_for_terminal = {
                    // Find the session_id from remote_sessions that spawned this terminal.
                    // Actually, the session_id was embedded in the forwarded message by server.rs.
                    // We stored it in a "pending terminal create" slot.
                    // For now: find any Session key whose sender this terminal belongs to,
                    // looking at our pending_terminal_creates map.
                    // Simpler approach: server.rs stores PendingKey::Session(session_id)
                    // before forwarding terminal.create. We swap it to Terminal(terminal_id).
                    self.swap_session_to_terminal_key(&tid)
                };
                // Register the remote terminal → host mapping.
                self.remote_terminals
                    .lock()
                    .unwrap()
                    .insert(tid.clone(), host_id.to_string());

                // Relay the terminal.created message.
                if let Some(conn_id_tx) = session_id_for_terminal {
                    let _ = conn_id_tx.send(msg.clone());
                } else {
                    let _ = self.hub_events_tx.send(Arc::new(msg));
                }
            }

            // ----------------------------------------------------------------
            // terminal.data / terminal.exit → relay via Terminal unicast
            // ----------------------------------------------------------------
            ServerMessage::TerminalData {
                ref terminal_id, ..
            } => {
                let key = PendingKey::Terminal(terminal_id.clone());
                self.relay_unicast(&key, Arc::new(msg));
            }
            ServerMessage::TerminalExit {
                ref terminal_id, ..
            } => {
                let tid = terminal_id.clone();
                self.relay_unicast(&PendingKey::Terminal(tid.clone()), Arc::new(msg));
                // Clear the terminal unicast to avoid leaks.
                self.pending_unicast
                    .lock()
                    .unwrap()
                    .remove(&PendingKey::Terminal(tid));
            }

            // ----------------------------------------------------------------
            // workspace.git → rewrite host_id to the federated host's id,
            // then fan out to all connections (host-wide state, like
            // session.updated — NOT a per-connection unicast reply).
            // ----------------------------------------------------------------
            ServerMessage::WorkspaceGit {
                cwd,
                branch,
                ahead,
                behind,
                ..
            } => {
                let tagged = ServerMessage::WorkspaceGit {
                    host_id: host_id.to_string(),
                    cwd,
                    branch,
                    ahead,
                    behind,
                };
                let _ = self.hub_events_tx.send(Arc::new(tagged));
            }

            // Git/review request results are single-shot and preserve the
            // remote payload. The request id is the only routing key needed;
            // workspace ids remain owned by the remote host.
            ServerMessage::GitStatusResult { ref request_id, .. }
            | ServerMessage::GitRefsResult { ref request_id, .. }
            | ServerMessage::GitDiffResult { ref request_id, .. }
            | ServerMessage::GitActionResult { ref request_id, .. }
            | ServerMessage::GitPreviewResult { ref request_id, .. }
            | ServerMessage::ReviewListResult { ref request_id, .. }
            | ServerMessage::ReviewCommentResult { ref request_id, .. }
            | ServerMessage::ReviewDeleteResult { ref request_id, .. }
            | ServerMessage::ReviewBatchPreviewResult { ref request_id, .. }
            | ServerMessage::ReviewBatchSendResult { ref request_id, .. } => {
                let key = PendingKey::Request(request_id.clone());
                self.relay_unicast(&key, Arc::new(msg));
                self.pending_unicast.lock().unwrap().remove(&key);
            }

            // ----------------------------------------------------------------
            // fs.browse.result → single-shot unicast reply, rewriting hostId
            // to the federated host's id (the remote reports "local" from its
            // own point of view, same rationale as workspace.git above).
            // ----------------------------------------------------------------
            ServerMessage::FsBrowseResult {
                ref request_id,
                path,
                parent,
                home,
                entries,
                ..
            } => {
                let rid = request_id.clone();
                let tagged = ServerMessage::FsBrowseResult {
                    request_id: rid.clone(),
                    host_id: host_id.to_string(),
                    path,
                    parent,
                    home,
                    entries,
                };
                self.relay_unicast(&PendingKey::Browse(rid.clone()), Arc::new(tagged));
                self.pending_unicast
                    .lock()
                    .unwrap()
                    .remove(&PendingKey::Browse(rid));
            }

            // ----------------------------------------------------------------
            // worktree.* → single-shot unicast replies, hostId rewritten to
            // the federated host's id (same rationale as fs.browse.result).
            // ----------------------------------------------------------------
            ServerMessage::WorktreeListResult {
                ref request_id,
                repo_path,
                default_root,
                worktrees,
                ..
            } => {
                let rid = request_id.clone();
                self.relay_worktree_reply(
                    rid,
                    ServerMessage::WorktreeListResult {
                        request_id: request_id.clone(),
                        host_id: host_id.to_string(),
                        repo_path,
                        default_root,
                        worktrees,
                    },
                );
            }
            ServerMessage::WorktreeDone {
                ref request_id,
                action,
                path,
                ..
            } => {
                let rid = request_id.clone();
                self.relay_worktree_reply(
                    rid,
                    ServerMessage::WorktreeDone {
                        request_id: request_id.clone(),
                        host_id: host_id.to_string(),
                        action,
                        path,
                        workspace: None,
                    },
                );
            }
            ServerMessage::WorktreeError {
                ref request_id,
                message,
                dirty,
                ..
            } => {
                let rid = request_id.clone();
                self.relay_worktree_reply(
                    rid,
                    ServerMessage::WorktreeError {
                        request_id: request_id.clone(),
                        host_id: host_id.to_string(),
                        message,
                        dirty,
                    },
                );
            }

            // ----------------------------------------------------------------
            // Drop messages that should not propagate to browsers.
            // ----------------------------------------------------------------
            ServerMessage::SettingsCurrent { .. }
            | ServerMessage::HostsList { .. }
            | ServerMessage::HostsUpdated { .. }
            | ServerMessage::HostInfo { .. }
            | ServerMessage::ProjectList { .. }
            | ServerMessage::ProjectUpdated { .. }
            | ServerMessage::ProjectDeleted { .. }
            | ServerMessage::WorkspaceSnapshot { .. }
            | ServerMessage::WorkspaceUpdated { .. }
            | ServerMessage::WorkspaceFocus { .. }
            | ServerMessage::FsTreeResult { .. }
            | ServerMessage::FsReadResult { .. }
            | ServerMessage::FsPreviewResult { .. }
            | ServerMessage::FsWriteResult { .. }
            | ServerMessage::FsBufferListResult { .. }
            | ServerMessage::FsBufferResult { .. }
            | ServerMessage::FsBufferCloseResult { .. }
            | ServerMessage::FsChanged { .. }
            | ServerMessage::FsError { .. } => {
                // Remote settings/hosts are not propagated to our clients.
                // Project/workspace federation is not advertised by this
                // first local-only slice, so do not expose remote metadata or
                // accidentally merge it into the local namespace. The same
                // applies to workspace-scoped fs replies: this slice accepts
                // durable local workspace ids only and has no remote root
                // authorization/relay path.
            }
        }
    }

    /// Broadcast the full merged session list (remote-only portion) on the hub
    /// events channel.  Server.rs merges local sessions on top when responding
    /// to `session.list` client requests; here we broadcast so all connections'
    /// sidebars update.
    fn broadcast_merged_session_list(&self) {
        let sessions: Vec<SessionSummary> = self
            .remote_session_cache
            .lock()
            .unwrap()
            .values()
            .cloned()
            .collect();
        // Sort: by host_id then by createdAt descending.
        let mut sessions = sessions;
        sessions.sort_by(|a, b| {
            a.host_id
                .cmp(&b.host_id)
                .then(b.created_at.cmp(&a.created_at))
        });
        let _ = self
            .hub_events_tx
            .send(Arc::new(ServerMessage::SessionList { sessions }));
    }

    /// Find a Session unicast key that was registered by `register_terminal_create`
    /// and atomically move it to a Terminal key.  Returns the sender for the found entry.
    fn swap_session_to_terminal_key(
        &self,
        terminal_id: &str,
    ) -> Option<UnboundedSender<ServerMessage>> {
        let mut map = self.pending_unicast.lock().unwrap();
        // We look for a key stored as PendingKey::Session("__terminal_create__:<anything>")
        // Actually the convention (set in server.rs) is that for terminal.create the
        // Session key holds the source session_id.  We need to swap it.
        // To find it we stored a sentinel: server.rs calls register_unicast with
        // PendingKey::Session("__tcreate__:<tid_placeholder>"), which we set to
        // a known value.  But since terminal_id is only known after the remote
        // responds, we can't key by it up front.
        //
        // Revised approach: server.rs stores PendingKey::Session("<session_id>__tc")
        // to distinguish terminal-create pending from chat pending, and we find the
        // entry with that suffix.  But that's brittle.
        //
        // Final approach: server.rs uses PendingKey::Terminal("<session_id>") as
        // a "pending terminal create" slot (meaning: swap to Terminal(terminal_id)
        // when terminal.created arrives).  We find ANY Terminal key that doesn't
        // yet have a real terminal_id registered in remote_terminals.
        let pending_tc_key = map
            .keys()
            .find(|k| {
                if let PendingKey::Terminal(ref id) = k {
                    // A real terminal id won't collide with a session_id because
                    // terminal ids generated by remotes are UUIDs, as are session ids —
                    // but we registered this slot BEFORE the remote assigned the terminal_id,
                    // so the stored key contains the session_id.
                    // Heuristic: if it's NOT in remote_terminals, it's a pending-create slot.
                    !self
                        .remote_terminals
                        .lock()
                        .unwrap()
                        .contains_key(id.as_str())
                } else {
                    false
                }
            })
            .cloned();

        if let Some(old_key) = pending_tc_key {
            let entry = map.remove(&old_key)?;
            let tx = entry.tx;
            // Insert under the real terminal_id.
            map.insert(
                PendingKey::Terminal(terminal_id.to_string()),
                PendingUnicast {
                    conn_id: entry.conn_id,
                    tx: tx.clone(),
                },
            );
            Some(tx)
        } else {
            None
        }
    }

    /// Relay a message to the unicast receiver registered for `key`, without
    /// removing the entry (callers that want to clear must do so explicitly).
    fn relay_unicast(&self, key: &PendingKey, msg: Arc<ServerMessage>) {
        let tx = {
            let map = self.pending_unicast.lock().unwrap();
            map.get(key).map(|u| u.tx.clone())
        };
        if let Some(tx) = tx {
            let _ = tx.send((*msg).clone());
        }
    }

    /// Relay a single-shot `worktree.*` reply (already host-tagged) to the
    /// connection that issued the request, then drop the pending slot. Every
    /// `worktree.*` request gets exactly one reply — list result, done, or
    /// error — so the slot is always consumed here.
    fn relay_worktree_reply(&self, request_id: String, msg: ServerMessage) {
        let key = PendingKey::Worktree(request_id);
        self.relay_unicast(&key, Arc::new(msg));
        self.pending_unicast.lock().unwrap().remove(&key);
    }

    // -----------------------------------------------------------------------
    // Public API for server.rs
    // -----------------------------------------------------------------------

    /// Return the host_id for a session known to the hub, or `None` if local.
    pub fn route_for_session(&self, session_id: &str) -> Option<String> {
        self.remote_sessions
            .lock()
            .unwrap()
            .get(session_id)
            .cloned()
    }

    /// Return the host_id for a terminal known to the hub, or `None` if local.
    pub fn route_for_terminal(&self, terminal_id: &str) -> Option<String> {
        self.remote_terminals
            .lock()
            .unwrap()
            .get(terminal_id)
            .cloned()
    }

    /// Whether a request can be forwarded to a live perch peer. Direct hosts
    /// intentionally return false because they have no protocol endpoint.
    pub fn is_connected(&self, host_id: &str) -> bool {
        self.connections.lock().unwrap().contains_key(host_id)
    }

    /// Send raw JSON to a connected remote host.
    pub fn forward(&self, host_id: &str, json: &str) {
        let conn = self.connections.lock().unwrap().get(host_id).cloned();
        if let Some(conn) = conn {
            let _ = conn.ws_tx.send(json.to_string());
        } else {
            tracing::warn!("[hub] forward: host {host_id} not connected");
        }
    }

    /// Register a unicast receiver for the given key.  `conn_id` is the
    /// browser connection that should receive the replies.
    pub fn register_unicast(
        &self,
        key: PendingKey,
        conn_id: String,
        tx: UnboundedSender<ServerMessage>,
    ) {
        self.pending_unicast
            .lock()
            .unwrap()
            .insert(key, PendingUnicast { conn_id, tx });
    }

    /// Remove all unicast registrations for the given connection id (called on
    /// socket close to prevent leaking senders to dead connections).
    pub fn unregister_all_for_connection(&self, conn_id: &str) {
        self.pending_unicast
            .lock()
            .unwrap()
            .retain(|_, u| u.conn_id != conn_id);
    }

    /// Return all remote session summaries (tagged with host_id).
    pub fn remote_sessions_snapshot(&self) -> Vec<SessionSummary> {
        self.remote_session_cache
            .lock()
            .unwrap()
            .values()
            .cloned()
            .collect()
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Bounded ssh subprocess runner — now shared with the direct-host path.
///
/// This used to be defined here; it moved to `ssh.rs` verbatim when
/// `mode: "direct"` hosts arrived, so both host modes bound their ssh children
/// the same way instead of growing two subtly different implementations.
use crate::ssh::run_ssh_bounded;

/// Cheap remote precheck run before auto-starting perch over ssh+tmux. Fails
/// fast (bounded, ~seconds) with an actionable message instead of letting the
/// caller burn a full 15s health-poll window on a remote that can never come
/// up — e.g. a devpod that was added as a host but never got a perch
/// checkout, which used to time out silently and loop back to "connecting"
/// forever.
///
/// For the default auto-start command we check the binary the default
/// command actually runs (`~/perch/target/debug/perch-core`). For a custom
/// `remote_cmd` we can't know its prerequisites, so we only verify `tmux`
/// itself is present (auto-start always goes through `tmux new-session`).
async fn precheck_remote_prereqs(ssh_host: &str, has_custom_cmd: bool) -> Result<(), String> {
    let check_cmd = if has_custom_cmd {
        "command -v tmux >/dev/null 2>&1"
    } else {
        "test -d ~/perch && test -x ~/perch/target/debug/perch-core"
    };
    let args = [
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=5",
        ssh_host,
        check_cmd,
    ];
    let out = run_ssh_bounded(&args, 20, "precheck").await?;
    if out.status.success() {
        Ok(())
    } else if has_custom_cmd {
        Err("tmux not available on remote".to_string())
    } else {
        Err("perch not installed on remote (~/perch/target/debug/perch-core missing)".to_string())
    }
}

/// Best-effort diagnostics gathered when auto-start prechecks passed but the
/// remote still never answered the 15s health poll: is the tmux session
/// even alive, and what did it last print (crash trace, port-in-use, missing
/// dependency, …)? Folded into the timeout error as a one-line summary.
/// Never fails the caller — any ssh error here is itself just folded into the
/// returned string, since this is purely informational.
async fn capture_start_diagnostics(ssh_host: &str) -> String {
    let cmd = "tmux has-session -t perch-core 2>&1; echo ---; tmux capture-pane -pt perch-core -S -5 2>&1";
    let args = [
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=5",
        ssh_host,
        cmd,
    ];
    match run_ssh_bounded(&args, 15, "diagnostics").await {
        Ok(out) => {
            let text = String::from_utf8_lossy(&out.stdout);
            let one_line: String = text
                .lines()
                .map(str::trim)
                .filter(|l| !l.is_empty())
                .collect::<Vec<_>>()
                .join(" | ");
            if one_line.is_empty() {
                "no tmux output captured".to_string()
            } else {
                one_line.chars().take(200).collect()
            }
        }
        Err(e) => format!("diagnostics unavailable: {e}"),
    }
}

/// Build a `host.info` ServerMessage from a state snapshot.
fn build_host_info(host_id: &str, name: &str, state: &HostState) -> ServerMessage {
    match state {
        HostState::Connecting => ServerMessage::HostInfo {
            host_id: host_id.to_string(),
            name: name.to_string(),
            state: state.label().to_string(),
            error: None,
            hostname: None,
            platform: None,
            is_ssh: None,
            claude_models: None,
            codex_models: None,
        },
        HostState::Connected(info) => ServerMessage::HostInfo {
            host_id: host_id.to_string(),
            name: name.to_string(),
            state: state.label().to_string(),
            error: None,
            hostname: Some(info.hostname.clone()),
            platform: Some(info.platform.clone()),
            is_ssh: Some(info.is_ssh),
            claude_models: Some(info.claude_models.clone()),
            codex_models: Some(info.codex_models.clone()),
        },
        HostState::Error(err) => ServerMessage::HostInfo {
            host_id: host_id.to_string(),
            name: name.to_string(),
            state: state.label().to_string(),
            error: Some(err.clone()),
            hostname: None,
            platform: None,
            is_ssh: None,
            claude_models: None,
            codex_models: None,
        },
        HostState::Disabled => ServerMessage::HostInfo {
            host_id: host_id.to_string(),
            name: name.to_string(),
            state: state.label().to_string(),
            error: None,
            hostname: None,
            platform: None,
            is_ssh: None,
            claude_models: None,
            codex_models: None,
        },
    }
}

/// Return `true` if the given URL resolves to this instance's own port on
/// 127.0.0.1 or localhost — prevents the hub from connecting to itself.
fn is_self_url(url: &str, own_port: u16) -> bool {
    // Parse just the host:port part.
    let url = url.trim_start_matches("ws://").trim_start_matches("wss://");
    let host_part = url.split('/').next().unwrap_or("");
    let (host, port_str) = if let Some(idx) = host_part.rfind(':') {
        (&host_part[..idx], &host_part[idx + 1..])
    } else {
        (host_part, "")
    };
    let is_local_host = host == "127.0.0.1" || host == "localhost" || host == "::1";
    if !is_local_host {
        return false;
    }
    if let Ok(port) = port_str.parse::<u16>() {
        port == own_port
    } else {
        false
    }
}

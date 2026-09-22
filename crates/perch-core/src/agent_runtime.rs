//! Runtime adapter between provider manifests, lifecycle state, and the
//! shared CLI terminal registry.
//!
//! [`agent_fleet`](crate::agent_fleet) intentionally does not spawn a process.
//! This module is the small owning seam that does: it turns a validated
//! `ProviderRegistry` plan into the argv handed to
//! [`AgentTerminalRegistry`], publishes PTY/provider lifecycle signals, and
//! keeps the concrete PTY/tmux identity alongside the logical agent key.
//!
//! The identity check is important for hibernation. A session id can be
//! reused after a process exits; a hibernation request must terminate the
//! exact runtime it inspected before allowing the durable record to become
//! `Sleeping`. Wake always uses the provider continuation returned by the
//! lifecycle registry and never substitutes a fresh session silently.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

use crate::agent_fleet::{
    now_millis, AgentKey, AgentLifecycleRegistry, AgentMode, AgentRegistration, AgentSnapshot,
    AgentState, AgentTransition, ClientIdentity, ControlChannel, ControlLease, HibernationError,
    HibernationPolicy, LaunchError, OwnershipError, ProviderCapability, ProviderRegistry,
    ProviderSignal, ResumeAction, WakePlan, MAX_FIXED_ARGUMENTS, MAX_TOKEN_LENGTH,
};
use crate::terminal::{
    AgentTerminalRegistry, AttachOutcome, TerminalAuthorityError, TerminalDataListener,
    TerminalExitListener, TerminalReplay, TerminalRuntimeIdentity,
};

const RUNTIME_VIEWER: &str = "__perch_runtime__";

pub type TurnBoundaryListener = Arc<dyn Fn(&AgentKey, bool) -> anyhow::Result<()> + Send + Sync>;

/// All logical scopes participate in process identity. Length prefixes prevent
/// delimiter collisions, and the digest is safe as an exact tmux target.
pub fn terminal_key(key: &AgentKey) -> String {
    use sha2::{Digest, Sha256};
    let mut hash = Sha256::new();
    for value in [&key.workspace_id, &key.session_id, &key.agent_id] {
        hash.update((value.len() as u64).to_le_bytes());
        hash.update(value.as_bytes());
    }
    format!("agent-{:x}", hash.finalize())
}

/// A live provider runtime owned by one logical agent.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentRuntimeHandle {
    pub key: AgentKey,
    pub provider_id: String,
    pub provider_session_id: Option<String>,
    pub terminal: TerminalRuntimeIdentity,
}

/// Result of attaching a viewer to a provider runtime.
pub struct RuntimeAttach {
    pub outcome: AttachOutcome,
    pub handle: AgentRuntimeHandle,
    pub replay: String,
}

struct ActiveRuntime {
    handle: AgentRuntimeHandle,
    cwd: PathBuf,
    /// Set before an intentional hibernation termination. The terminal
    /// waiter may race the lifecycle transition, so its callback must not
    /// turn a deliberate stop into `Exited` before `hibernate()` commits
    /// `Sleeping`.
    suppress_exit_signal: Arc<AtomicBool>,
    native_status: Arc<AtomicBool>,
    native_running: bool,
    replay: Arc<Mutex<TerminalReplay>>,
    _bootstrap: Option<crate::provider_environment::BootstrapFile>,
}

struct StartReservation {
    key: AgentKey,
    starts: Arc<(Mutex<HashSet<AgentKey>>, Condvar)>,
}

impl Drop for StartReservation {
    fn drop(&mut self) {
        let (starts, wake) = &*self.starts;
        starts.lock().unwrap().remove(&self.key);
        wake.notify_all();
    }
}

/// Errors returned by the provider/terminal/lifecycle bridge.
#[derive(Debug)]
pub enum RuntimeAdapterError {
    Launch(LaunchError),
    Lifecycle(crate::agent_fleet::LifecycleError),
    Hibernation(HibernationError),
    Ownership(OwnershipError),
    Terminal(TerminalAuthorityError),
    Process(anyhow::Error),
    NoRuntime(AgentKey),
    RuntimeIdentityUnavailable(String),
    RuntimeStillAlive(TerminalRuntimeIdentity),
    RuntimeMismatch(AgentKey),
    RequiresWake(AgentKey),
    InteractiveStdinUnsupported,
    FreshSessionRefused(AgentKey),
}

impl std::fmt::Display for RuntimeAdapterError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Launch(error) => error.fmt(f),
            Self::Lifecycle(error) => error.fmt(f),
            Self::Hibernation(error) => error.fmt(f),
            Self::Ownership(error) => error.fmt(f),
            Self::Terminal(error) => error.fmt(f),
            Self::Process(error) => write!(f, "provider terminal failed: {error}"),
            Self::NoRuntime(key) => write!(f, "agent has no live runtime: {key:?}"),
            Self::RuntimeIdentityUnavailable(session_id) => {
                write!(
                    f,
                    "terminal runtime identity unavailable for session {session_id}"
                )
            }
            Self::RuntimeStillAlive(identity) => write!(
                f,
                "runtime {} is still alive for session {}",
                identity.terminal_id, identity.session_id
            ),
            Self::RuntimeMismatch(key) => {
                write!(f, "runtime identity changed for agent {key:?}")
            }
            Self::RequiresWake(key) => write!(f, "agent is sleeping; use the wake path: {key:?}"),
            Self::InteractiveStdinUnsupported => write!(
                f,
                "interactive terminal launch cannot carry a deferred stdin prompt"
            ),
            Self::FreshSessionRefused(key) => write!(
                f,
                "wake for agent {key:?} did not return a provider continuation identity"
            ),
        }
    }
}

impl std::error::Error for RuntimeAdapterError {}

impl From<LaunchError> for RuntimeAdapterError {
    fn from(error: LaunchError) -> Self {
        Self::Launch(error)
    }
}

impl From<crate::agent_fleet::LifecycleError> for RuntimeAdapterError {
    fn from(error: crate::agent_fleet::LifecycleError) -> Self {
        Self::Lifecycle(error)
    }
}

impl From<HibernationError> for RuntimeAdapterError {
    fn from(error: HibernationError) -> Self {
        Self::Hibernation(error)
    }
}

impl From<OwnershipError> for RuntimeAdapterError {
    fn from(error: OwnershipError) -> Self {
        Self::Ownership(error)
    }
}

impl From<TerminalAuthorityError> for RuntimeAdapterError {
    fn from(error: TerminalAuthorityError) -> Self {
        Self::Terminal(error)
    }
}

/// Provider runtime bridge. One instance should be shared by the server's
/// lifecycle registry and `AgentTerminalRegistry`; constructing one per WS
/// connection would reintroduce duplicate provider processes.
pub struct AgentRuntimeAdapter {
    providers: Arc<ProviderRegistry>,
    lifecycle: Arc<AgentLifecycleRegistry>,
    terminals: Arc<AgentTerminalRegistry>,
    active: Arc<Mutex<HashMap<AgentKey, ActiveRuntime>>>,
    starts: Arc<(Mutex<HashSet<AgentKey>>, Condvar)>,
    authority: Mutex<()>,
    turn_boundary: Arc<std::sync::OnceLock<TurnBoundaryListener>>,
}

impl AgentRuntimeAdapter {
    pub fn new(
        providers: Arc<ProviderRegistry>,
        lifecycle: Arc<AgentLifecycleRegistry>,
        terminals: Arc<AgentTerminalRegistry>,
    ) -> Self {
        Self {
            providers,
            lifecycle,
            terminals,
            active: Arc::new(Mutex::new(HashMap::new())),
            starts: Arc::new((Mutex::new(HashSet::new()), Condvar::new())),
            authority: Mutex::new(()),
            turn_boundary: Arc::new(std::sync::OnceLock::new()),
        }
    }

    pub fn providers(&self) -> &Arc<ProviderRegistry> {
        &self.providers
    }

    pub fn set_turn_boundary_listener(&self, listener: TurnBoundaryListener) -> anyhow::Result<()> {
        self.turn_boundary
            .set(listener)
            .map_err(|_| anyhow::anyhow!("turn recorder already installed"))
    }

    /// Complete the persistence barrier before releasing input or completion.
    pub fn record_turn_boundary(&self, key: &AgentKey, before: bool) -> anyhow::Result<()> {
        self.turn_boundary
            .get()
            .map_or(Ok(()), |record| record(key, before))
    }

    /// Only a native running-to-ready edge completes a native turn. Startup
    /// dialogs and replayed ready snapshots do not complete pending input.
    pub fn observe_native_turn(&self, key: &AgentKey, running: bool) -> anyhow::Result<()> {
        let completed = self
            .active
            .lock()
            .unwrap()
            .get(key)
            .is_some_and(|runtime| runtime.native_running && !running);
        // Record the observed edge before the capture can fail. A runtime that
        // still believes a finished turn is running would let the *next* turn's
        // completion close this turn's open boundary, reporting one summary
        // that spans both turns' changes.
        if let Some(runtime) = self.active.lock().unwrap().get_mut(key) {
            runtime.native_running = running;
        }
        if completed {
            self.record_turn_boundary(key, false)?;
        }
        Ok(())
    }

    pub fn lifecycle(&self) -> &Arc<AgentLifecycleRegistry> {
        &self.lifecycle
    }

    pub fn terminals(&self) -> &Arc<AgentTerminalRegistry> {
        &self.terminals
    }

    /// Return the adapter's recorded concrete runtime, if it is still
    /// present. Callers that need a liveness decision should use
    /// [`Self::runtime_alive`] so tmux is queried as well.
    pub fn runtime(&self, key: &AgentKey) -> Option<AgentRuntimeHandle> {
        self.active
            .lock()
            .unwrap()
            .get(key)
            .map(|runtime| runtime.handle.clone())
    }

    /// Capture the continuation chosen by the live CLI. Keep both the
    /// durable lifecycle and live handle in sync before another view attaches.
    pub fn record_provider_session_id(
        &self,
        key: &AgentKey,
        id: String,
    ) -> Result<(), RuntimeAdapterError> {
        let _authority = self.authority.lock().unwrap();
        let mut active = self.active.lock().unwrap();
        let runtime = active
            .get_mut(key)
            .ok_or_else(|| RuntimeAdapterError::NoRuntime(key.clone()))?;
        self.lifecycle
            .set_provider_session_id(key, Some(id.clone()))?;
        runtime.handle.provider_session_id = Some(id);
        runtime.native_status.store(true, Ordering::Release);
        Ok(())
    }

    /// Native session events outrank terminal repaint/activity heuristics.
    pub fn has_native_status(&self, session_id: &str) -> bool {
        self.active.lock().unwrap().iter().any(|(key, runtime)| {
            key.session_id == session_id && runtime.native_status.load(Ordering::Acquire)
        })
    }

    pub fn runtime_cwd(&self, key: &AgentKey) -> Option<PathBuf> {
        self.active
            .lock()
            .unwrap()
            .get(key)
            .map(|runtime| runtime.cwd.clone())
    }

    pub fn runtime_alive(&self, key: &AgentKey) -> bool {
        self.active
            .lock()
            .unwrap()
            .get(key)
            .is_some_and(|runtime| self.terminals.runtime_alive(&runtime.handle.terminal))
    }

    /// Resolve a shared terminal id back to its logical agent key.  The wire
    /// input/resize messages carry only the terminal id, so the server uses
    /// this bounded active-handle map to route those operations through the
    /// same lifecycle/lease authority as attach and hibernate.
    pub fn key_for_terminal(&self, terminal_id: &str) -> Option<AgentKey> {
        self.active
            .lock()
            .unwrap()
            .iter()
            .find(|(_, runtime)| runtime.handle.terminal.terminal_id == terminal_id)
            .map(|(key, _)| key.clone())
    }

    /// Reserve the process-creation boundary for one logical agent. The
    /// terminal registry also serializes its map, but reserving here keeps
    /// lifecycle callback selection and active-handle publication serialized
    /// with the spawn, so concurrent attachers cannot both install a creator
    /// callback or overwrite the handle map.
    fn reserve_start(&self, key: &AgentKey) -> Option<StartReservation> {
        let (starts, wake) = &*self.starts;
        let mut starts_guard = starts.lock().unwrap();
        loop {
            let live = self.active.lock().unwrap().get(key).is_some_and(|runtime| {
                self.terminals.runtime_identity(&terminal_key(key)).as_ref()
                    == Some(&runtime.handle.terminal)
                    && self.terminals.runtime_alive(&runtime.handle.terminal)
            });
            if live {
                return None;
            }
            if !live {
                self.active.lock().unwrap().remove(key);
            }
            if starts_guard.insert(key.clone()) {
                return Some(StartReservation {
                    key: key.clone(),
                    starts: self.starts.clone(),
                });
            }
            starts_guard = wake.wait(starts_guard).unwrap();
        }
    }

    /// Translate a provider manifest's CLI plan into the shell-free argv that
    /// `agentAttach` needs. `CommandPlan::stdin` is intentionally rejected:
    /// an interactive PTY must not race a one-shot prompt write before the
    /// terminal is attached; callers can send user input through the lease
    /// checked [`Self::input`] method instead.
    fn cli_command(
        &self,
        provider_id: &str,
        cwd: &Path,
        provider_session_id: Option<&str>,
        extra_args: &[String],
    ) -> Result<Vec<String>, RuntimeAdapterError> {
        let plan = self.providers.build_launch(
            provider_id,
            cwd,
            AgentMode::Cli,
            None,
            provider_session_id,
        )?;
        if plan.stdin.is_some() {
            return Err(RuntimeAdapterError::InteractiveStdinUnsupported);
        }
        let mut command = Vec::with_capacity(plan.args.len() + 1);
        let executable = crate::agent_catalog::resolve_executable(
            provider_id,
            &plan.executable.to_string_lossy(),
        )
        .map_err(|reason| RuntimeAdapterError::Process(anyhow::anyhow!(reason)))?;
        command.push(executable.to_string_lossy().into_owned());
        command.extend(plan.args);
        if extra_args.len() > MAX_FIXED_ARGUMENTS {
            return Err(RuntimeAdapterError::Launch(LaunchError::InvalidInput(
                "too many dynamic CLI arguments".to_string(),
            )));
        }
        for arg in extra_args {
            if arg.len() > MAX_TOKEN_LENGTH || arg.contains('\0') {
                return Err(RuntimeAdapterError::Launch(LaunchError::InvalidInput(
                    "dynamic CLI argument is not a valid token".to_string(),
                )));
            }
        }
        command.extend(extra_args.iter().cloned());
        Ok(command)
    }

    /// Attach one client to a CLI provider runtime, creating one when this
    /// logical agent has no live terminal. The registry and the active map are
    /// both process-wide, so a second viewer cannot launch a second provider.
    #[allow(clippy::too_many_arguments)]
    pub fn attach_cli(
        &self,
        registration: AgentRegistration,
        cwd: impl AsRef<Path>,
        client: ClientIdentity,
        cols: u16,
        rows: u16,
        on_data: TerminalDataListener,
        on_exit: TerminalExitListener,
    ) -> Result<RuntimeAttach, RuntimeAdapterError> {
        self.attach_cli_with_args(registration, cwd, client, cols, rows, &[], on_data, on_exit)
    }

    /// Variant of [`Self::attach_cli`] for provider-specific dynamic flags
    /// that are already validated by the owning application (for example the
    /// selected Claude/Codex model). The manifest still owns the executable,
    /// mode recipe, and continuation placement; these tokens are appended as
    /// individual argv entries and never interpreted by a shell.
    #[allow(clippy::too_many_arguments)]
    pub fn attach_cli_with_args(
        &self,
        registration: AgentRegistration,
        cwd: impl AsRef<Path>,
        client: ClientIdentity,
        cols: u16,
        rows: u16,
        extra_args: &[String],
        on_data: TerminalDataListener,
        on_exit: TerminalExitListener,
    ) -> Result<RuntimeAttach, RuntimeAdapterError> {
        self.attach_cli_with_ready(
            registration,
            cwd,
            client,
            cols,
            rows,
            extra_args,
            true,
            on_data,
            on_exit,
            |_, _| {},
        )
    }

    /// Publish the initial replay while output fanout is locked. The owning
    /// transport must enqueue its opened reply here so no live bytes overtake
    /// that reply. `resume_existing` is false only for an explicitly allocated
    /// provider identity whose first conversation has not been created yet.
    #[allow(clippy::too_many_arguments)]
    pub fn attach_cli_with_ready(
        &self,
        registration: AgentRegistration,
        cwd: impl AsRef<Path>,
        client: ClientIdentity,
        cols: u16,
        rows: u16,
        extra_args: &[String],
        resume_existing: bool,
        on_data: TerminalDataListener,
        on_exit: TerminalExitListener,
        on_ready: impl FnOnce(&AgentRuntimeHandle, &str),
    ) -> Result<RuntimeAttach, RuntimeAdapterError> {
        let cwd = cwd.as_ref().to_path_buf();
        let key = registration.key.clone();
        let provider_id = registration.provider_id.clone();
        let provider_session_id = registration.provider_session_id.clone();
        // Resumability is mode-specific. In particular, Codex's Hosted
        // `exec --json` recipe is intentionally fresh while its CLI recipe
        // accepts `resume <thread>`. Preserve that distinction at the
        // lifecycle boundary so a caller cannot mark an unsupported mode as
        // wakeable and later fall back to a duplicate fresh session.
        let manifest = self.providers.get(&provider_id).ok_or_else(|| {
            RuntimeAdapterError::Launch(LaunchError::UnknownProvider(provider_id.clone()))
        })?;
        if registration.resumable
            && !manifest.supports_capability(AgentMode::Cli, ProviderCapability::Resume)
        {
            return Err(RuntimeAdapterError::Launch(LaunchError::ResumeUnsupported));
        }

        let snapshot = match self.lifecycle.get(&key) {
            Ok(snapshot) => snapshot,
            Err(crate::agent_fleet::LifecycleError::NotFound(_)) => {
                match self.lifecycle.register(registration.clone()) {
                    Ok(snapshot) => snapshot,
                    // Another attach crossed the registration lock between
                    // our `get` and `register`; continue with that shared
                    // record instead of treating the race as a failed start.
                    Err(crate::agent_fleet::LifecycleError::Duplicate(_)) => {
                        self.lifecycle.get(&key)?
                    }
                    Err(error) => return Err(error.into()),
                }
            }
            Err(error) => return Err(error.into()),
        };
        if snapshot.state == AgentState::Sleeping {
            return Err(RuntimeAdapterError::RequiresWake(key));
        }
        if snapshot.state == AgentState::Reconnecting
            && provider_session_id.is_none()
            && self.runtime(&key).is_none()
            && !crate::daemon::session_alive(&terminal_key(&key))
        {
            return Err(RuntimeAdapterError::FreshSessionRefused(key));
        }
        if snapshot.provider_id != provider_id
            || snapshot.provider_session_id != provider_session_id
        {
            return Err(RuntimeAdapterError::RuntimeMismatch(key));
        }

        // Reserve observer capacity before spawning. If the pty fails, the
        // reservation is removed below, so an error cannot leak a client slot.
        self.lifecycle.attach_observer(&key, &client)?;

        let start_reservation = self.reserve_start(&key);
        if start_reservation.is_none() {
            // Another caller already published the live runtime while this
            // caller was reserving the creation boundary. Reuse it and add
            // only this viewer; lifecycle callbacks remain installed by the
            // creator, avoiding duplicate output/status transitions.
            let (existing, replay) = match self.active.lock().unwrap().get(&key) {
                Some(runtime) if runtime.cwd == cwd => {
                    (runtime.handle.clone(), runtime.replay.clone())
                }
                _ => {
                    let _ = self.lifecycle.detach_observer(&key, &client.id);
                    return Err(RuntimeAdapterError::NoRuntime(key.clone()));
                }
            };
            let mut snapshot = String::new();
            if let Err(error) =
                self.terminals
                    .observe(&existing.terminal, &client.id, on_data, on_exit, || {
                        snapshot = replay.lock().unwrap().text();
                        on_ready(&existing, &snapshot);
                    })
            {
                let _ = self.lifecycle.detach_observer(&key, &client.id);
                return Err(RuntimeAdapterError::Process(error));
            }
            return Ok(RuntimeAttach {
                outcome: AttachOutcome::Reused(existing.terminal.terminal_id.clone()),
                handle: existing,
                replay: snapshot,
            });
        }
        // Keep the reservation through terminal creation, callback
        // installation, active-handle publication, and the initial Started
        // signal. Its Drop wakes a concurrent attach only after all of those
        // steps have completed or failed.
        let _start_reservation = start_reservation.expect("checked above");
        let command = match self.cli_command(
            &provider_id,
            &cwd,
            provider_session_id.as_deref().filter(|_| resume_existing),
            extra_args,
        ) {
            Ok(command) => command,
            Err(error) => {
                let _ = self.lifecycle.detach_observer(&key, &client.id);
                return Err(error);
            }
        };

        let prepared = match (|| {
            let command = match provider_id.as_str() {
                "codex" if crate::native_ui::supported(&provider_id) => {
                    crate::native_ui::codex::launch(&key, command)?
                }
                "opencode" if crate::native_ui::supported(&provider_id) => {
                    crate::native_ui::opencode::launch(&key, command)?
                }
                _ => command,
            };
            crate::provider_environment::prepare(command, &manifest.environment)
        })() {
            Ok(prepared) => prepared,
            Err(error) => {
                let _ = self.lifecycle.detach_observer(&key, &client.id);
                return Err(RuntimeAdapterError::Process(error));
            }
        };

        // A callback is installed only for the first process-backed attach.
        // Reusing an existing runtime adds a viewer, but another lifecycle
        // output callback would double-count every PTY chunk.
        let suppress_exit_signal = Arc::new(AtomicBool::new(false));
        let identity_slot: Arc<Mutex<Option<TerminalRuntimeIdentity>>> = Arc::new(Mutex::new(None));
        let lifecycle = self.lifecycle.clone();
        let terminal_registry = self.terminals.clone();
        let active = self.active.clone();
        let event_key = key.clone();
        let event_identity_slot = identity_slot.clone();
        let event_suppress = suppress_exit_signal.clone();
        let data_suppress = suppress_exit_signal.clone();
        let native_status = Arc::new(AtomicBool::new(false));
        let data_native_status = native_status.clone();
        let replay = Arc::new(Mutex::new(TerminalReplay::default()));
        let replay_for_output = replay.clone();
        let status_detection = manifest.status_detection.clone();
        let status_tail = Mutex::new(String::new());
        let turn_boundary = self.turn_boundary.clone();
        let wrapped_on_data: TerminalDataListener = Arc::new(move |_, text| {
            replay_for_output.lock().unwrap().push(&text);
            if !data_suppress.load(Ordering::Acquire) && !data_native_status.load(Ordering::Acquire)
            {
                if let Some(signal) =
                    output_status_signal(&status_detection, &mut status_tail.lock().unwrap(), &text)
                {
                    if matches!(signal, ProviderSignal::Completed { .. }) {
                        if let Some(record) = turn_boundary.get() {
                            if let Err(error) = record(&event_key, false) {
                                tracing::error!(%error, "could not persist completed provider turn");
                                return;
                            }
                        }
                    }
                    let _ = lifecycle.signal(&event_key, signal, now_millis());
                } else if !text.trim().is_empty() {
                    let _ = lifecycle.signal(
                        &event_key,
                        ProviderSignal::Output { bytes: text.len() },
                        now_millis(),
                    );
                }
            }
        });
        let lifecycle = self.lifecycle.clone();
        let event_key = key.clone();
        let turn_boundary = self.turn_boundary.clone();
        let wrapped_on_exit: TerminalExitListener = Arc::new(move |terminal_id, code| {
            let intentional_stop = event_suppress.load(Ordering::Acquire);
            let identity = event_identity_slot.lock().unwrap().clone();
            if let Some(identity) = identity.as_ref() {
                if active
                    .lock()
                    .unwrap()
                    .get(&event_key)
                    .is_some_and(|runtime| runtime.handle.terminal != *identity)
                {
                    return;
                }
            }
            let alive = identity
                .as_ref()
                .is_some_and(|identity| terminal_registry.runtime_alive(identity));
            if !intentional_stop {
                if !alive {
                    if let Some(record) = turn_boundary.get() {
                        if let Err(error) = record(&event_key, false) {
                            tracing::error!(%error, "could not persist exited provider turn");
                        }
                    }
                }
                // A tmux attach client can exit while the provider itself
                // remains alive. That is a transport loss and is
                // reconnectable; a direct PTY exit is terminal.
                let signal = if alive {
                    ProviderSignal::TransportLost {
                        reason: "terminal transport disconnected; provider runtime remains alive"
                            .to_string(),
                    }
                } else {
                    ProviderSignal::ProcessExited { code: Some(code) }
                };
                let _ = lifecycle.signal(&event_key, signal, now_millis());
            }
            if !alive {
                let mut active = active.lock().unwrap();
                if active.get(&event_key).is_some_and(|runtime| {
                    runtime.handle.terminal
                        == identity.clone().unwrap_or_else(|| TerminalRuntimeIdentity {
                            session_id: terminal_key(&event_key),
                            terminal_id: terminal_id.clone(),
                            process_id: None,
                            daemon_session: None,
                        })
                }) {
                    active.remove(&event_key);
                }
            }
        });

        // Publish start before the reader can deliver a ready/completion
        // marker; a fast provider must not be put back into Working afterward.
        self.lifecycle
            .signal(&key, ProviderSignal::Started, now_millis())?;
        let outcome = match self.terminals.attach(
            &terminal_key(&key),
            RUNTIME_VIEWER,
            cols,
            rows,
            Some(cwd.display().to_string()),
            prepared.argv,
            wrapped_on_data,
            wrapped_on_exit,
        ) {
            Ok(outcome) => outcome,
            Err(error) => {
                let _ = self.lifecycle.signal(
                    &key,
                    ProviderSignal::Error {
                        reason: format!("provider launch failed: {error}"),
                    },
                    now_millis(),
                );
                let _ = self.lifecycle.detach_observer(&key, &client.id);
                return Err(RuntimeAdapterError::Process(error));
            }
        };

        let identity = match self.terminals.runtime_identity(&terminal_key(&key)) {
            Some(identity) => identity,
            None => {
                let _ = self.lifecycle.detach_observer(&key, &client.id);
                self.terminals.kill(&terminal_key(&key));
                return Err(RuntimeAdapterError::RuntimeIdentityUnavailable(
                    key.session_id.clone(),
                ));
            }
        };
        *identity_slot.lock().unwrap() = Some(identity.clone());

        // A very short provider may have exited between `attach()` returning
        // and identity publication. Never publish an active handle for that
        // dead process; the waiter callback can safely report the same exit.
        if !self.terminals.runtime_alive(&identity) {
            let _ = self.lifecycle.signal(
                &key,
                ProviderSignal::ProcessExited { code: None },
                now_millis(),
            );
            let _ = self.lifecycle.detach_observer(&key, &client.id);
            return Err(RuntimeAdapterError::NoRuntime(key));
        }

        let handle = AgentRuntimeHandle {
            key: key.clone(),
            provider_id,
            provider_session_id,
            terminal: identity.clone(),
        };
        {
            self.active.lock().unwrap().insert(
                key.clone(),
                ActiveRuntime {
                    handle: handle.clone(),
                    cwd,
                    suppress_exit_signal,
                    native_status,
                    native_running: false,
                    replay: replay.clone(),
                    _bootstrap: prepared.bootstrap,
                },
            );
        }

        let mut snapshot = String::new();
        if let Err(error) = self
            .terminals
            .observe(&identity, &client.id, on_data, on_exit, || {
                snapshot = replay.lock().unwrap().text();
                on_ready(&handle, &snapshot);
            })
        {
            let _ = self.lifecycle.detach_observer(&key, &client.id);
            return Err(RuntimeAdapterError::Process(error));
        }
        Ok(RuntimeAttach {
            outcome,
            handle,
            replay: snapshot,
        })
    }

    /// Attach to a sleeping record by using the exact provider continuation
    /// identity returned by `wake`. Any provider that cannot accept that
    /// identity fails the wake; this method never launches a fresh session as
    /// a hidden fallback.
    #[allow(clippy::too_many_arguments)]
    pub fn wake_cli(
        &self,
        key: &AgentKey,
        cwd: impl AsRef<Path>,
        client: ClientIdentity,
        cols: u16,
        rows: u16,
        on_data: TerminalDataListener,
        on_exit: TerminalExitListener,
        at_ms: u64,
    ) -> Result<RuntimeAttach, RuntimeAdapterError> {
        self.wake_cli_with_args(key, cwd, client, cols, rows, &[], on_data, on_exit, at_ms)
    }

    /// Wake variant that appends validated provider-specific flags (such as
    /// a selected model) to the continuation command.
    #[allow(clippy::too_many_arguments)]
    pub fn wake_cli_with_args(
        &self,
        key: &AgentKey,
        cwd: impl AsRef<Path>,
        client: ClientIdentity,
        cols: u16,
        rows: u16,
        extra_args: &[String],
        on_data: TerminalDataListener,
        on_exit: TerminalExitListener,
        at_ms: u64,
    ) -> Result<RuntimeAttach, RuntimeAdapterError> {
        let snapshot = self.lifecycle.get(key)?;
        let WakePlan { action, .. } = self.lifecycle.wake(key, at_ms)?;
        let provider_session_id = match action {
            ResumeAction::ExistingSession(id) => id,
            ResumeAction::FreshSession { .. } => {
                return Err(RuntimeAdapterError::FreshSessionRefused(key.clone()))
            }
        };
        let registration = AgentRegistration {
            key: key.clone(),
            provider_id: snapshot.provider_id,
            provider_session_id: Some(provider_session_id),
            resumable: snapshot.resumable,
            now_ms: at_ms,
        };
        match self.attach_cli_with_args(
            registration,
            cwd,
            client,
            cols,
            rows,
            extra_args,
            on_data,
            on_exit,
        ) {
            Ok(attach) => Ok(attach),
            Err(error) => {
                // Leave a typed Error state for a failed reconnect. The
                // provider identity remains in the lifecycle record so a
                // later explicit retry can use the same continuation.
                let _ = self.lifecycle.transition(
                    key,
                    AgentState::Error,
                    format!("wake launch failed: {error}"),
                    at_ms,
                );
                Err(error)
            }
        }
    }

    pub fn signal(
        &self,
        key: &AgentKey,
        signal: ProviderSignal,
        at_ms: u64,
    ) -> Result<AgentTransition, RuntimeAdapterError> {
        Ok(self.lifecycle.signal(key, signal, at_ms)?)
    }

    pub fn snapshot(&self, key: &AgentKey) -> Result<AgentSnapshot, RuntimeAdapterError> {
        Ok(self.lifecycle.get(key)?)
    }

    pub fn detach(
        &self,
        key: &AgentKey,
        client: &ClientIdentity,
    ) -> Result<AgentSnapshot, RuntimeAdapterError> {
        let _authority = self.authority.lock().unwrap();
        self.terminals.detach(&terminal_key(key), &client.id);
        self.terminals
            .clear_control_owner_for_client(&terminal_key(key), &client.id);
        Ok(self.lifecycle.detach_observer(key, &client.id)?)
    }

    pub fn acquire_control(
        &self,
        key: &AgentKey,
        channel: ControlChannel,
        client: ClientIdentity,
        at_ms: u64,
    ) -> Result<ControlLease, RuntimeAdapterError> {
        let _authority = self.authority.lock().unwrap();
        let lease = self
            .lifecycle
            .acquire_control(key, channel, client, at_ms)?;
        let result = match channel {
            ControlChannel::Input => self
                .terminals
                .set_input_owner(&terminal_key(key), Some(lease.clone())),
            ControlChannel::Resize => self
                .terminals
                .set_resize_owner(&terminal_key(key), Some(lease.clone())),
        };
        if let Err(error) = result {
            let _ = self
                .lifecycle
                .release_control(key, channel, &lease.client, lease.generation);
            return Err(error.into());
        }
        Ok(lease)
    }

    pub fn release_control(
        &self,
        key: &AgentKey,
        channel: ControlChannel,
        client: &ClientIdentity,
        generation: u64,
    ) -> Result<AgentSnapshot, RuntimeAdapterError> {
        let _authority = self.authority.lock().unwrap();
        let snapshot = self
            .lifecycle
            .release_control(key, channel, client, generation)?;
        let clear_result = match channel {
            ControlChannel::Input => {
                self.terminals
                    .clear_input_owner(&terminal_key(key), client, generation)
            }
            ControlChannel::Resize => {
                self.terminals
                    .clear_resize_owner(&terminal_key(key), client, generation)
            }
        };
        // The lifecycle release has already succeeded. A missing terminal is
        // harmless during process exit; a real terminal-side error is
        // returned so the caller can reconcile its view.
        if let Err(error) = clear_result {
            if !matches!(
                error,
                TerminalAuthorityError::NoTerminal | TerminalAuthorityError::StaleLease
            ) {
                return Err(error.into());
            }
        }
        Ok(snapshot)
    }

    pub fn input(
        &self,
        key: &AgentKey,
        lease: &ControlLease,
        data: &str,
        at_ms: u64,
        active_for: std::time::Duration,
    ) -> Result<(), RuntimeAdapterError> {
        let _authority = self.authority.lock().unwrap();
        self.lifecycle.record_control_activity(
            key,
            ControlChannel::Input,
            &lease.client,
            lease.generation,
            at_ms,
            active_for,
        )?;
        let native_ready = self.has_native_status(&key.session_id);
        if data.contains(['\r', '\n'])
            && (!crate::native_ui::supported(&key.agent_id) || native_ready)
        {
            self.record_turn_boundary(key, true)
                .map_err(RuntimeAdapterError::Process)?;
            if !native_ready {
                self.lifecycle
                    .signal(key, ProviderSignal::TurnStarted, at_ms)?;
            }
        }
        self.terminals
            .input_owned(&terminal_key(key), &lease.client, lease.generation, data)?;
        Ok(())
    }

    /// Native UI commands share the input lease and its linearization point
    /// with PTY writes. Queue synchronously while authority is held; await
    /// the native acknowledgement only after releasing this lock.
    pub fn dispatch_native_control<R>(
        &self,
        key: &AgentKey,
        lease: &ControlLease,
        dispatch: impl FnOnce(&dyn Fn(&str) -> anyhow::Result<()>) -> anyhow::Result<R>,
    ) -> anyhow::Result<R> {
        let _authority = self.authority.lock().unwrap();
        self.lifecycle.record_control_activity(
            key,
            ControlChannel::Input,
            &lease.client,
            lease.generation,
            now_millis(),
            Duration::from_secs(5),
        )?;
        dispatch(&|data| {
            self.terminals.input_owned(
                &terminal_key(key),
                &lease.client,
                lease.generation,
                data,
            )?;
            Ok(())
        })
    }

    pub fn resize(
        &self,
        key: &AgentKey,
        lease: &ControlLease,
        cols: u16,
        rows: u16,
        at_ms: u64,
    ) -> Result<(), RuntimeAdapterError> {
        let _authority = self.authority.lock().unwrap();
        self.lifecycle.record_control_activity(
            key,
            ControlChannel::Resize,
            &lease.client,
            lease.generation,
            at_ms,
            std::time::Duration::ZERO,
        )?;
        self.terminals.resize_owned(
            &terminal_key(key),
            &lease.client,
            lease.generation,
            cols,
            rows,
        )?;
        Ok(())
    }

    /// The owning session was explicitly deleted. Prove its concrete process
    /// stopped before freeing lifecycle capacity or forgetting its identity.
    pub fn remove(&self, key: &AgentKey) -> Result<(), RuntimeAdapterError> {
        let _authority = self.authority.lock().unwrap();
        if let Some(handle) = self.runtime(key) {
            self.terminals
                .terminate_for_hibernation(&handle.terminal)
                .map_err(RuntimeAdapterError::Process)?;
        }
        self.active.lock().unwrap().remove(key);
        self.lifecycle.remove(key)?;
        Ok(())
    }

    /// Explicit user stop requires current input authority. The terminal
    /// registry checks the concrete identity before killing the process.
    pub fn stop(
        &self,
        key: &AgentKey,
        lease: &ControlLease,
        at_ms: u64,
    ) -> Result<(), RuntimeAdapterError> {
        let _authority = self.authority.lock().unwrap();
        self.lifecycle.record_control_activity(
            key,
            ControlChannel::Input,
            &lease.client,
            lease.generation,
            at_ms,
            std::time::Duration::ZERO,
        )?;
        let handle = self
            .runtime(key)
            .ok_or_else(|| RuntimeAdapterError::NoRuntime(key.clone()))?;
        self.terminals
            .terminate_for_hibernation(&handle.terminal)
            .map_err(RuntimeAdapterError::Process)?;
        Ok(())
    }

    /// Terminate the concrete runtime first, then commit the guarded
    /// lifecycle hibernation. If termination cannot prove the runtime is
    /// gone, the record is left out of `Sleeping`.
    pub fn hibernate(
        &self,
        key: &AgentKey,
        policy: HibernationPolicy,
        at_ms: u64,
    ) -> Result<AgentTransition, RuntimeAdapterError> {
        let (identity, suppress_exit_signal) = {
            let active = self.active.lock().unwrap();
            let runtime = active
                .get(key)
                .ok_or_else(|| RuntimeAdapterError::NoRuntime(key.clone()))?;
            if !self.terminals.runtime_alive(&runtime.handle.terminal) {
                return Err(RuntimeAdapterError::NoRuntime(key.clone()));
            }
            (
                runtime.handle.terminal.clone(),
                runtime.suppress_exit_signal.clone(),
            )
        };

        // Reserve guards and activity under the lifecycle mutex before any
        // kill request. New signals, focus, and ownership attempts fail while
        // this lease is held, so the final commit cannot discover that the
        // provider became Working after the preflight check.
        let hibernation_lease = self.lifecycle.begin_hibernation(key, policy, at_ms)?;
        suppress_exit_signal.store(true, Ordering::Release);
        if let Err(error) = self.terminals.terminate_for_hibernation(&identity) {
            suppress_exit_signal.store(false, Ordering::Release);
            let _ = self.lifecycle.abort_hibernation(hibernation_lease);
            return Err(RuntimeAdapterError::Process(error));
        }
        if self.terminals.runtime_alive(&identity) {
            suppress_exit_signal.store(false, Ordering::Release);
            let _ = self.lifecycle.abort_hibernation(hibernation_lease);
            return Err(RuntimeAdapterError::RuntimeStillAlive(identity));
        }

        let result = self
            .lifecycle
            .commit_hibernation(hibernation_lease, policy, at_ms);
        match result {
            Ok(transition) => {
                let mut active = self.active.lock().unwrap();
                if active
                    .get(key)
                    .is_some_and(|runtime| runtime.handle.terminal == identity)
                {
                    active.remove(key);
                }
                Ok(transition)
            }
            Err(error) => Err(error.into()),
        }
    }
}

/// Match only newly completed literal markers, including markers split across
/// PTY reads. Retain at most the longest marker minus one byte, never a transcript.
/// ponytail: configured markers can be spoofed by provider output; native
/// structured status takes precedence and is the upgrade path for TUIs.
fn output_status_signal(
    detection: &crate::agent_fleet::StatusDetection,
    tail: &mut String,
    text: &str,
) -> Option<ProviderSignal> {
    use crate::agent_fleet::StatusDetection;
    let StatusDetection::OutputPatterns { blocked, done } = detection else {
        return None;
    };
    let previous = tail.len();
    tail.push_str(text);
    let signal = done
        .iter()
        .map(|marker| (marker, false))
        .chain(blocked.iter().map(|marker| (marker, true)))
        .filter_map(|(marker, blocked)| {
            tail.rfind(marker)
                .filter(|start| start + marker.len() > previous)
                .map(|start| (start + marker.len(), blocked))
        })
        .max()
        .map(|(_, blocked)| {
            if blocked {
                ProviderSignal::InputRequested {
                    reason: "configured blocked marker".into(),
                }
            } else {
                ProviderSignal::Completed {
                    reason: "configured completion marker".into(),
                }
            }
        });
    let keep = blocked
        .iter()
        .chain(done)
        .map(String::len)
        .max()
        .unwrap_or(1)
        .saturating_sub(1);
    let mut cut = tail.len().saturating_sub(keep);
    while !tail.is_char_boundary(cut) {
        cut += 1;
    }
    tail.drain(..cut);
    signal
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent_fleet::{
        AgentKey, ClientKind, EnvironmentPolicy, LaunchSpec, ModeLaunchSpec, PromptTransport,
        ProviderCapability, ProviderManifest, Resumability, ResumePlacement, StatusDetection,
    };
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Barrier;
    use std::time::Duration;

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    #[test]
    fn configured_status_markers_survive_split_reads_without_replaying_old_matches() {
        let detection = StatusDetection::OutputPatterns {
            blocked: vec!["WAIT_FOR_APPROVAL".into()],
            done: vec!["TURN_COMPLETE".into()],
        };
        for split in 1.."TURN_COMPLETE".len() {
            let mut tail = String::new();
            assert!(
                output_status_signal(&detection, &mut tail, &"TURN_COMPLETE"[..split]).is_none()
            );
            assert!(matches!(
                output_status_signal(&detection, &mut tail, &"TURN_COMPLETE"[split..]),
                Some(ProviderSignal::Completed { .. })
            ));
            assert!(output_status_signal(&detection, &mut tail, "\r\n").is_none());
        }
        let mut tail = String::new();
        assert!(matches!(
            output_status_signal(&detection, &mut tail, "TURN_COMPLETE WAIT_FOR_APPROVAL"),
            Some(ProviderSignal::InputRequested { .. })
        ));
        assert!(matches!(
            output_status_signal(&detection, &mut tail, "TURN_COMPLETE"),
            Some(ProviderSignal::Completed { .. })
        ));
        output_status_signal(&detection, &mut tail, &"é".repeat(10_000));
        assert!(tail.len() < "WAIT_FOR_APPROVAL".len());
        assert!(
            output_status_signal(&StatusDetection::ExitStatus, &mut tail, "TURN_COMPLETE")
                .is_none()
        );
        let invalid = StatusDetection::OutputPatterns {
            blocked: vec![],
            done: vec![String::new()],
        };
        let mut manifest = fixture_manifest();
        manifest.status_detection = invalid;
        assert!(ProviderRegistry::empty().register(manifest).is_err());
    }

    fn key() -> AgentKey {
        let suffix = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        AgentKey::new(
            "workspace",
            format!("runtime-session-{}-{suffix}", std::process::id()),
            "agent",
        )
        .unwrap()
    }

    fn client(id: &str) -> ClientIdentity {
        ClientIdentity::new(id, format!("device-{id}"), ClientKind::Desktop).unwrap()
    }

    fn fixture_manifest() -> ProviderManifest {
        ProviderManifest {
            id: "fixture".to_string(),
            display_name: "Fixture".to_string(),
            launch: LaunchSpec {
                executable: "/bin/sh".to_string(),
                prefix_args: Vec::new(),
                prompt: PromptTransport::Stdin,
                suffix_args: Vec::new(),
                resume_prefix_args: Vec::new(),
                resume: ResumePlacement::Flag {
                    flag: "--resume".to_string(),
                },
                mode_overrides: [(
                    AgentMode::Cli,
                    ModeLaunchSpec {
                        executable: "/bin/sh".to_string(),
                        prefix_args: vec!["-c".to_string(), "sleep 30".to_string()],
                        prompt: PromptTransport::Stdin,
                        suffix_args: Vec::new(),
                        resume_prefix_args: Vec::new(),
                        resume: ResumePlacement::Flag {
                            flag: "--resume".to_string(),
                        },
                    },
                )]
                .into_iter()
                .collect(),
            },
            supported_modes: [AgentMode::Cli].into_iter().collect(),
            resumability: Resumability::ProviderSession,
            capabilities: [
                ProviderCapability::InteractiveTerminal,
                ProviderCapability::Resume,
            ]
            .into_iter()
            .collect(),
            status_detection: StatusDetection::ExitStatus,
            environment: EnvironmentPolicy::default(),
        }
    }

    fn adapter() -> AgentRuntimeAdapter {
        let providers = Arc::new(ProviderRegistry::empty());
        providers.register(fixture_manifest()).unwrap();
        let lifecycle = Arc::new(AgentLifecycleRegistry::new());
        let terminals = Arc::new(AgentTerminalRegistry::new(Arc::new(|_| {})));
        AgentRuntimeAdapter::new(providers, lifecycle, terminals)
    }

    struct RuntimeCleanup<'a> {
        adapter: &'a AgentRuntimeAdapter,
        keys: Vec<AgentKey>,
    }

    impl Drop for RuntimeCleanup<'_> {
        fn drop(&mut self) {
            for key in &self.keys {
                self.adapter.terminals.kill(&terminal_key(key));
            }
        }
    }

    #[test]
    fn agent_scopes_isolate_input_and_host_tracking_survives_all_viewers() {
        let providers = Arc::new(ProviderRegistry::empty());
        for provider in ["fixture", "fixture-other"] {
            let mut manifest = fixture_manifest();
            manifest.id = provider.to_string();
            manifest.environment.inherit = false;
            manifest
                .environment
                .set
                .insert("PERCH_SCOPE".into(), provider.into());
            manifest.launch.mode_overrides.get_mut(&AgentMode::Cli).unwrap().prefix_args = vec![
                "-c".to_string(),
                "printf 'scope_env:%s home:%s\\n' \"$PERCH_SCOPE\" \"${HOME-unset}\"; while IFS= read -r line; do if [ \"$line\" = delayed ]; then /bin/sleep 0.1; fi; printf 'received_%s\\n' \"$line\"; done".to_string(),
            ];
            providers.register(manifest).unwrap();
        }
        let adapter = AgentRuntimeAdapter::new(
            providers,
            Arc::new(AgentLifecycleRegistry::new()),
            Arc::new(AgentTerminalRegistry::new(Arc::new(|_| {}))),
        );
        let first = key();
        let second = AgentKey::new(&first.workspace_id, &first.session_id, "second-agent").unwrap();
        let _cleanup = RuntimeCleanup {
            adapter: &adapter,
            keys: vec![first.clone(), second.clone()],
        };
        let registration = |key: &AgentKey, provider: &str| AgentRegistration {
            key: key.clone(),
            provider_id: provider.to_string(),
            provider_session_id: Some(format!("provider-{}", key.agent_id)),
            resumable: true,
            now_ms: now_millis(),
        };
        let output_a = Arc::new(Mutex::new(String::new()));
        let output_b = Arc::new(Mutex::new(String::new()));
        let data_a = output_a.clone();
        let data_b = output_b.clone();
        let a = adapter
            .attach_cli(
                registration(&first, "fixture"),
                "/tmp",
                client("desktop-a"),
                80,
                24,
                Arc::new(move |_, data| data_a.lock().unwrap().push_str(&data)),
                Arc::new(|_, _| {}),
            )
            .unwrap();
        let b = adapter
            .attach_cli(
                registration(&second, "fixture-other"),
                "/tmp",
                client("desktop-b"),
                80,
                24,
                Arc::new(move |_, data| data_b.lock().unwrap().push_str(&data)),
                Arc::new(|_, _| {}),
            )
            .unwrap();
        assert_ne!(a.handle.terminal.terminal_id, b.handle.terminal.terminal_id);
        let lease_a = adapter
            .acquire_control(
                &first,
                ControlChannel::Input,
                client("desktop-a"),
                now_millis(),
            )
            .unwrap();
        let lease_b = adapter
            .acquire_control(
                &second,
                ControlChannel::Input,
                client("desktop-b"),
                now_millis(),
            )
            .unwrap();
        adapter
            .input(&first, &lease_a, "alpha\r", now_millis(), Duration::ZERO)
            .unwrap();
        adapter
            .input(&second, &lease_b, "beta\r", now_millis(), Duration::ZERO)
            .unwrap();
        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        while (!output_a.lock().unwrap().contains("received_alpha")
            || !output_b.lock().unwrap().contains("received_beta"))
            && std::time::Instant::now() < deadline
        {
            std::thread::sleep(Duration::from_millis(10));
        }
        assert!(output_a.lock().unwrap().contains("received_alpha"));
        assert!(output_b.lock().unwrap().contains("received_beta"));
        assert!(!output_a.lock().unwrap().contains("received_beta"));
        assert!(!output_b.lock().unwrap().contains("received_alpha"));
        let first_output = format!("{}{}", a.replay, output_a.lock().unwrap());
        let second_output = format!("{}{}", b.replay, output_b.lock().unwrap());
        assert!(first_output.contains("scope_env:fixture home:unset"));
        assert!(second_output.contains("scope_env:fixture-other home:unset"));

        // End the creating browser's observation. Lifecycle callbacks and
        // replay must still be driven by the host, including with zero views.
        adapter
            .input(&first, &lease_a, "delayed\r", now_millis(), Duration::ZERO)
            .unwrap();
        adapter.detach(&first, &client("desktop-a")).unwrap();
        adapter
            .signal(
                &first,
                ProviderSignal::Completed {
                    reason: "fixture paused".into(),
                },
                now_millis(),
            )
            .unwrap();
        let replay = adapter.active.lock().unwrap()[&first].replay.clone();
        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        while !replay.lock().unwrap().text().contains("received_delayed")
            && std::time::Instant::now() < deadline
        {
            std::thread::sleep(Duration::from_millis(10));
        }
        assert!(replay.lock().unwrap().text().contains("received_delayed"));
        assert_eq!(adapter.snapshot(&first).unwrap().state, AgentState::Working);
        let restored = adapter
            .attach_cli(
                registration(&first, "fixture"),
                "/tmp",
                client("mobile"),
                80,
                24,
                Arc::new(|_, _| {}),
                Arc::new(|_, _| {}),
            )
            .unwrap();
        assert_eq!(restored.handle.terminal, a.handle.terminal);
        assert!(restored.replay.contains("received_delayed"));
        assert!(restored.replay.len() <= crate::terminal::MAX_TERMINAL_REPLAY_BYTES);
        assert!(adapter
            .acquire_control(
                &first,
                ControlChannel::Input,
                client("mobile"),
                now_millis()
            )
            .is_ok());
        adapter.remove(&first).unwrap();
        assert!(!adapter.runtime_alive(&first));
        assert!(adapter.snapshot(&first).is_err());
        assert!(adapter.runtime_alive(&second));
        assert_eq!(adapter.lifecycle.list().len(), 1);
    }

    #[test]
    fn reconnect_without_runtime_or_continuation_never_starts_fresh() {
        let adapter = adapter();
        let key = key();
        let _cleanup = RuntimeCleanup {
            adapter: &adapter,
            keys: vec![key.clone()],
        };
        let registration = AgentRegistration {
            key: key.clone(),
            provider_id: "fixture".to_string(),
            provider_session_id: None,
            resumable: true,
            now_ms: now_millis(),
        };
        adapter.lifecycle.register(registration.clone()).unwrap();
        adapter
            .signal(
                &key,
                ProviderSignal::TransportLost {
                    reason: "core restarted".into(),
                },
                now_millis(),
            )
            .unwrap();
        let result = adapter.attach_cli(
            registration,
            "/tmp",
            client("reconnecting"),
            80,
            24,
            Arc::new(|_, _| {}),
            Arc::new(|_, _| {}),
        );
        assert!(matches!(
            result,
            Err(RuntimeAdapterError::FreshSessionRefused(_))
        ));
        assert!(!adapter.runtime_alive(&key));
        assert!(adapter
            .terminals
            .runtime_identity(&terminal_key(&key))
            .is_none());
        assert_eq!(
            adapter.snapshot(&key).unwrap().state,
            AgentState::Reconnecting
        );
    }

    #[test]
    fn cli_attach_uses_manifest_and_hibernation_stops_exact_runtime() {
        let adapter = adapter();
        let key = key();
        let registration = AgentRegistration {
            key: key.clone(),
            provider_id: "fixture".to_string(),
            provider_session_id: Some("provider-session".to_string()),
            resumable: true,
            now_ms: 1,
        };
        let data = Arc::new(Mutex::new(Vec::<String>::new()));
        let data_seen = data.clone();
        let attach = adapter
            .attach_cli(
                registration,
                "/tmp",
                client("desktop"),
                80,
                24,
                Arc::new(move |_, text| data_seen.lock().unwrap().push(text)),
                Arc::new(|_, _| {}),
            )
            .unwrap();
        assert!(adapter.runtime_alive(&key));
        assert!(!attach.handle.terminal.terminal_id.is_empty());

        // A tmux attach/repaint may arrive after completion and correctly
        // make the lifecycle Working again. Retry that specific race until
        // the fixture settles instead of assuming a fixed startup delay.
        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        let transition = loop {
            adapter
                .signal(
                    &key,
                    ProviderSignal::Completed {
                        reason: "fixture complete".to_string(),
                    },
                    2,
                )
                .unwrap();
            match adapter.hibernate(&key, HibernationPolicy::new(Duration::ZERO), 4) {
                Ok(transition) => break transition,
                Err(RuntimeAdapterError::Hibernation(HibernationError::Ineligible(decision)))
                    if decision.blockers.iter().all(|blocker| {
                        matches!(
                            blocker,
                            crate::agent_fleet::HibernationBlocker::StateNotFinished(
                                AgentState::Working
                            )
                        )
                    }) && std::time::Instant::now() < deadline => {}
                Err(error) => {
                    adapter.terminals.kill(&terminal_key(&key));
                    panic!("settled fixture could not hibernate: {error}");
                }
            }
            std::thread::sleep(Duration::from_millis(10));
        };
        assert_eq!(transition.to, AgentState::Sleeping);
        assert!(!adapter.runtime_alive(&key));
        assert_eq!(adapter.snapshot(&key).unwrap().state, AgentState::Sleeping);

        // Wake is required to reuse the opaque provider identity.
        let attach = adapter
            .wake_cli(
                &key,
                "/tmp",
                client("desktop"),
                80,
                24,
                Arc::new(|_, _| {}),
                Arc::new(|_, _| {}),
                4,
            )
            .unwrap();
        assert_eq!(
            attach.handle.provider_session_id.as_deref(),
            Some("provider-session")
        );
        assert!(adapter.runtime_alive(&key));
        adapter.terminals.kill(&terminal_key(&key));
        let _ = data;
    }

    /// A boundary capture can fail for reasons that have nothing to do with
    /// the turn (a busy database, a Git hiccup). The failure must not leave the
    /// runtime believing the finished turn is still running, or the *next*
    /// turn's completion closes this turn's open boundary and the review view
    /// reports one summary spanning both turns' changes.
    #[test]
    fn a_failed_boundary_capture_still_records_the_completed_native_turn() {
        let adapter = adapter();
        let key = key();
        let _cleanup = RuntimeCleanup {
            adapter: &adapter,
            keys: vec![key.clone()],
        };
        adapter
            .attach_cli(
                AgentRegistration {
                    key: key.clone(),
                    provider_id: "fixture".to_string(),
                    provider_session_id: Some("provider-session".to_string()),
                    resumable: true,
                    now_ms: 1,
                },
                "/tmp",
                client("desktop"),
                80,
                24,
                Arc::new(|_, _| {}),
                Arc::new(|_, _| {}),
            )
            .unwrap();
        let captures = Arc::new(AtomicU64::new(0));
        let seen = captures.clone();
        adapter
            .set_turn_boundary_listener(Arc::new(move |_, _| {
                seen.fetch_add(1, Ordering::SeqCst);
                anyhow::bail!("capture failed")
            }))
            .unwrap();
        // A turn starting has no boundary to close.
        adapter.observe_native_turn(&key, true).unwrap();
        assert_eq!(captures.load(Ordering::SeqCst), 0);
        // Completion captures, and the caller still learns it failed.
        assert!(adapter.observe_native_turn(&key, false).is_err());
        assert_eq!(captures.load(Ordering::SeqCst), 1);
        // The running→ready edge is spent: later ready snapshots capture nothing.
        adapter.observe_native_turn(&key, false).unwrap();
        assert_eq!(captures.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn lease_generation_is_enforced_by_runtime_terminal() {
        let adapter = adapter();
        let key = key();
        adapter
            .attach_cli(
                AgentRegistration {
                    key: key.clone(),
                    provider_id: "fixture".to_string(),
                    provider_session_id: Some("provider-session".to_string()),
                    resumable: true,
                    now_ms: 1,
                },
                "/tmp",
                client("desktop"),
                80,
                24,
                Arc::new(|_, _| {}),
                Arc::new(|_, _| {}),
            )
            .unwrap();
        let lease = adapter
            .acquire_control(&key, ControlChannel::Input, client("desktop"), 2)
            .unwrap();
        let stale = ControlLease {
            generation: lease.generation.saturating_add(1),
            ..lease.clone()
        };
        assert!(matches!(
            adapter.input(&key, &stale, "x", 3, Duration::from_millis(100)),
            Err(RuntimeAdapterError::Ownership(OwnershipError::StaleLease {
                channel: ControlChannel::Input
            }))
        ));
        let mut dispatched = false;
        assert!(adapter
            .dispatch_native_control(&key, &stale, |_| {
                dispatched = true;
                Ok(())
            })
            .is_err());
        assert!(!dispatched);
        adapter
            .dispatch_native_control(&key, &lease, |_| {
                dispatched = true;
                Ok(())
            })
            .unwrap();
        assert!(dispatched);
        assert!(adapter.stop(&key, &stale, 4).is_err());
        assert!(adapter.runtime_alive(&key));
        adapter
            .release_control(&key, ControlChannel::Input, &lease.client, lease.generation)
            .unwrap();
        assert!(adapter.stop(&key, &lease, 5).is_err());
        assert!(adapter.runtime_alive(&key));
        adapter.terminals.kill(&terminal_key(&key));
    }

    #[test]
    fn native_continuation_capture_keeps_reattaches_on_the_live_runtime() {
        let adapter = adapter();
        let key = key();
        let mut registration = AgentRegistration {
            key: key.clone(),
            provider_id: "fixture".into(),
            provider_session_id: None,
            resumable: true,
            now_ms: 1,
        };
        let first = adapter
            .attach_cli(
                registration.clone(),
                "/tmp",
                client("desktop"),
                80,
                24,
                Arc::new(|_, _| {}),
                Arc::new(|_, _| {}),
            )
            .unwrap();
        adapter
            .record_provider_session_id(&key, "native-selected-id".into())
            .unwrap();
        assert_eq!(
            adapter
                .snapshot(&key)
                .unwrap()
                .provider_session_id
                .as_deref(),
            Some("native-selected-id")
        );
        assert_eq!(
            adapter
                .runtime(&key)
                .unwrap()
                .provider_session_id
                .as_deref(),
            Some("native-selected-id")
        );
        registration.provider_session_id = Some("native-selected-id".into());
        let second = adapter
            .attach_cli(
                registration,
                "/tmp",
                client("phone"),
                80,
                24,
                Arc::new(|_, _| {}),
                Arc::new(|_, _| {}),
            )
            .unwrap();
        assert_eq!(first.handle.terminal, second.handle.terminal);
        adapter.terminals.kill(&terminal_key(&key));
    }

    #[test]
    fn concurrent_attachers_share_one_runtime_creation_reservation() {
        let adapter = Arc::new(adapter());
        let key = key();
        let barrier = Arc::new(Barrier::new(2));
        let mut workers = Vec::new();
        for id in ["desktop", "mobile"] {
            let adapter = adapter.clone();
            let key = key.clone();
            let barrier = barrier.clone();
            workers.push(std::thread::spawn(move || {
                barrier.wait();
                adapter
                    .attach_cli(
                        AgentRegistration {
                            key,
                            provider_id: "fixture".to_string(),
                            provider_session_id: Some("provider-session".to_string()),
                            resumable: true,
                            now_ms: 1,
                        },
                        "/tmp",
                        client(id),
                        80,
                        24,
                        Arc::new(|_, _| {}),
                        Arc::new(|_, _| {}),
                    )
                    .unwrap()
            }));
        }
        let first = workers.remove(0).join().unwrap();
        let second = workers.remove(0).join().unwrap();
        assert_eq!(first.handle.terminal, second.handle.terminal);
        assert!(matches!(
            (&first.outcome, &second.outcome),
            (AttachOutcome::Created(_), AttachOutcome::Reused(_))
                | (AttachOutcome::Reused(_), AttachOutcome::Created(_))
        ));
        assert_eq!(
            adapter
                .terminals
                .session_for_terminal(&first.handle.terminal.terminal_id),
            Some(terminal_key(&key))
        );
        adapter.terminals.kill(&terminal_key(&key));
    }

    #[test]
    fn builtin_cli_plans_are_interactive_and_shell_free() {
        let registry = ProviderRegistry::new();
        let claude = registry
            .build_launch("claude", Path::new("/tmp"), AgentMode::Cli, None, None)
            .unwrap();
        assert_eq!(claude.executable, PathBuf::from("claude"));
        assert_eq!(claude.args, ["--dangerously-skip-permissions"]);
        assert!(claude.stdin.is_none());
        let codex = registry
            .build_launch("codex", Path::new("/tmp"), AgentMode::Cli, None, None)
            .unwrap();
        assert_eq!(codex.executable, PathBuf::from("codex"));
        assert_eq!(codex.args, ["--dangerously-bypass-approvals-and-sandbox"]);
        assert!(codex.stdin.is_none());
    }
}

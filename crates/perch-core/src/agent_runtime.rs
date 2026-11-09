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

/// Run an agent CLI inside a shell, like an Orca tab: when the agent exits,
/// the pane drops to a login shell in the same folder instead of a dead
/// terminal. The pty, and so the "exited" overlay, ends only with the shell.
/// The no-op INT trap keeps Ctrl+C aimed at the agent from also ending the
/// wrapper; caught (not ignored) signals reset to default in the child.
///
/// If the agent exits while no core is running (`daemon::cores_dir` has no
/// live pid) nobody could have quit it from a pane, so the wrapper drops
/// `marker` and the next core resumes the agent. Agents like pi catch SIGTERM
/// and exit 0, so the exit status can't tell a kill from a quit.
///
/// The agent's Perch identity is unset once the agent is gone: the shell that follows is
/// the person's, and must not hold a credential for a run that has ended. The launcher
/// (`PERCH_LAUNCH`) is the shell's, not the agent's: it is kept out of the agent's environment and
/// given back to the shell, so the next agent typed there is issued its own identity.
fn in_shell(argv: Vec<String>, marker: &Path, cores: &Path) -> Vec<String> {
    [
        "/bin/sh",
        "-c",
        "trap : INT; m=$1; c=$2; shift 2; l=${PERCH_LAUNCH-}; unset PERCH_LAUNCH; \"$@\"; \
         unset PERCH_TOKEN; [ -z \"$l\" ] && unset PERCH_SESSION || export PERCH_LAUNCH=$l; up=; \
         for p in \"$c\"/*; do kill -0 \"${p##*/}\" 2>/dev/null && up=1; done; \
         [ \"$up\" ] || { mkdir -p \"${m%/*}\" && : > \"$m\"; }; \
         exec \"${PERCH_SHELL:-${SHELL:-/bin/sh}}\" -l",
        "perch-agent",
        &marker.display().to_string(),
        &cores.display().to_string(),
    ]
    .into_iter()
    .map(String::from)
    .chain(argv)
    .collect()
}

pub type TurnBoundaryListener = Arc<dyn Fn(&AgentKey, bool) -> anyhow::Result<()> + Send + Sync>;
pub type PersonTurnListener = Arc<dyn Fn(&AgentKey) + Send + Sync>;

/// Add a session's pinned Instructions to a provider's command line, writing its private
/// Instructions file. Returns the command and, for Codex, the arguments for its shared
/// app-server. A provider without Instructions support is returned unchanged.
/// `pinned` is what the session launches with, the Perch pointer included when it has one.
fn with_instructions(
    key: &AgentKey,
    provider_id: &str,
    mut command: Vec<String>,
    pinned: Option<&crate::instructions::Pinned>,
) -> anyhow::Result<(Vec<String>, Vec<String>)> {
    let Some(pin) = pinned.filter(|_| crate::instructions::supported(provider_id)) else {
        return Ok((command, Vec::new()));
    };
    let file = crate::native_ui::write_instructions_file(key, provider_id, pin)?;
    let args = crate::instructions::launch_args(provider_id, pin, &file);
    if provider_id == "codex" {
        // Root flags go before the `resume` subcommand.
        command.splice(1..1, args.cli);
    } else {
        command.extend(args.cli);
    }
    Ok((command, args.codex_server))
}

/// The Instructions snapshot a session launches with: pinned the first time, then returned
/// unchanged. `None` when it has nothing to inject (`db/instructions.rs`).
pub type InstructionsResolver =
    Arc<dyn Fn(&AgentKey) -> anyhow::Result<Option<crate::instructions::Pinned>> + Send + Sync>;

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
    /// The PTY's OSC title has classified at least once, so the title owns
    /// status (below native, above output heuristics); see `agent_title`.
    title_status: Arc<AtomicBool>,
    native_running: bool,
    shell_agent: Option<crate::shell_integration::ShellAgent>,
    observed_provider: String,
    title_tracker: Arc<Mutex<crate::agent_title::TitleTracker>>,
    output_detection: Arc<Mutex<(crate::agent_fleet::StatusDetection, String)>>,
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
    /// Display-only foreground identity; never changes launch/resume ownership.
    current_providers: Mutex<HashMap<String, String>>,
    /// Terminal tab → native agent a shim launched in it (the chat view's provider).
    shell_chats: Mutex<HashMap<String, String>>,
    /// Each terminal's working directories as its root process reported them,
    /// oldest first; the last is current. Display and Files/Git scoping only.
    cwds: Mutex<HashMap<String, Vec<String>>>,
    turn_boundary: Arc<std::sync::OnceLock<TurnBoundaryListener>>,
    /// When each session's PTY last received input from any client, and when this core began
    /// listening (the bound of what "quiet" can mean for a session never heard from).
    last_input: Mutex<HashMap<String, std::time::Instant>>,
    /// The lines clients typed into each session's PTY (`typed_lines.rs`): the proof a person
    /// asked for `perch start` and `perch dismiss`.
    typed: Mutex<HashMap<String, crate::typed_lines::TypedLines>>,
    born: std::time::Instant,
    /// Told once a process's exit is confirmed (never for a lost connection or an intentional stop).
    exit_listener: std::sync::OnceLock<PersonTurnListener>,
    instructions: std::sync::OnceLock<InstructionsResolver>,
    identities: std::sync::OnceLock<Arc<dyn crate::agent_identity::IdentityStore>>,
}

/// A launch's Perch identity (`agent_identity.rs`) and the `perch` binary it runs.
struct LaunchIdentity {
    environment: Vec<(String, String)>,
    cli: PathBuf,
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
            current_providers: Mutex::new(HashMap::new()),
            shell_chats: Mutex::new(HashMap::new()),
            cwds: Mutex::new(HashMap::new()),
            turn_boundary: Arc::new(std::sync::OnceLock::new()),
            last_input: Mutex::new(HashMap::new()),
            typed: Mutex::new(HashMap::new()),
            born: std::time::Instant::now(),
            exit_listener: std::sync::OnceLock::new(),
            instructions: std::sync::OnceLock::new(),
            identities: std::sync::OnceLock::new(),
        }
    }

    pub fn set_exit_listener(&self, listener: PersonTurnListener) -> anyhow::Result<()> {
        self.exit_listener
            .set(listener)
            .map_err(|_| anyhow::anyhow!("exit listener already installed"))
    }

    pub fn set_identity_store(
        &self,
        store: Arc<dyn crate::agent_identity::IdentityStore>,
    ) -> anyhow::Result<()> {
        self.identities
            .set(store)
            .map_err(|_| anyhow::anyhow!("identity store already installed"))
    }

    /// The identity a *new* local launch of `key` carries. None, and nothing minted, when no
    /// store is installed, the provider takes no pointer, no `perch` binary ships beside the
    /// core, or the process may already exist: a reattach reuses the environment the process
    /// started with, so minting here would revoke the token it holds.
    fn launch_identity(
        &self,
        key: &AgentKey,
        provider_id: &str,
        existing_only: bool,
    ) -> anyhow::Result<Option<LaunchIdentity>> {
        let Some(store) = self.identities.get() else {
            return Ok(None);
        };
        if existing_only
            || !(provider_id == crate::agent_fleet::TERMINAL_PROVIDER
                || crate::instructions::supported(provider_id))
            || crate::daemon::session_state(&terminal_key(key))
                != crate::daemon::RuntimeState::Exited
        {
            return Ok(None);
        }
        let Some(cli) = crate::agent_identity::cli_binary() else {
            return Ok(None);
        };
        // A plain shell has no agent yet: it holds only the means to have each agent typed into it
        // issued its own identity (`/agent/launch`). A picker's agent is itself the agent, and its
        // shell afterwards gets the launcher back (`in_shell`).
        let issued = (provider_id != crate::agent_fleet::TERMINAL_PROVIDER)
            .then(|| store.issue(key))
            .transpose()?;
        let launcher = store.issue_launcher(key)?;
        Ok(Some(LaunchIdentity {
            environment: crate::agent_identity::launch_environment(
                &key.session_id,
                issued.as_ref(),
                Some(&launcher),
            ),
            cli,
        }))
    }

    pub fn set_instructions_resolver(&self, resolver: InstructionsResolver) -> anyhow::Result<()> {
        self.instructions
            .set(resolver)
            .map_err(|_| anyhow::anyhow!("Instructions resolver already installed"))
    }

    pub fn providers(&self) -> &Arc<ProviderRegistry> {
        &self.providers
    }

    pub fn current_provider(&self, session_id: &str) -> Option<String> {
        self.current_providers
            .lock()
            .unwrap()
            .get(session_id)
            .cloned()
    }

    /// The native-chat agent running inside this terminal tab right now, if any.
    pub fn shell_chat_provider(&self, session_id: &str) -> Option<String> {
        self.shell_chats.lock().unwrap().get(session_id).cloned()
    }

    /// Where the terminal's shell is now (follows `cd`), once observed.
    pub fn current_cwd(&self, session_id: &str) -> Option<String> {
        self.cwds.lock().unwrap().get(session_id)?.last().cloned()
    }

    /// Whether `path` is a directory this terminal has actually been in.
    pub fn cwd_seen(&self, session_id: &str, path: &str) -> bool {
        self.cwds
            .lock()
            .unwrap()
            .get(session_id)
            .is_some_and(|seen| seen.iter().any(|seen| seen == path))
    }

    /// Observe foreground jobs, including agents typed into a plain shell.
    /// POSIX ps's '+' flag excludes background/suspended agents. Use the
    /// nearest agent ancestor, so its tool subprocesses cannot steal its icon.
    pub async fn refresh_current_providers(&self) -> anyhow::Result<Vec<String>> {
        let text = if self.active.lock().unwrap().is_empty() {
            String::new()
        } else {
            // ponytail: one POSIX ps snapshot per second for all panes; move
            // to daemon foreground-process events if polling becomes costly.
            let mut command = tokio::process::Command::new("ps");
            command
                .args(["-ax", "-o", "pid=,ppid=,stat=,comm=,args="])
                .kill_on_drop(true);
            let output = tokio::time::timeout(Duration::from_secs(2), command.output()).await??;
            anyhow::ensure!(output.status.success(), "foreground process query failed");
            String::from_utf8_lossy(&output.stdout).into_owned()
        };
        let processes = process_snapshot(&text);
        let mut names = HashMap::new();
        for manifest in self.providers.list() {
            if manifest.id == crate::agent_fleet::TERMINAL_PROVIDER {
                continue;
            }
            names.insert(manifest.id.clone(), manifest.id.clone());
            let launch = manifest.launch.mode_overrides.get(&AgentMode::Cli);
            let executable = launch.map_or(manifest.launch.executable.as_str(), |launch| {
                &launch.executable
            });
            let name = Path::new(executable)
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or(executable);
            // Generic interpreters are not agent identities on their own.
            if ![
                "sh", "bash", "zsh", "fish", "dash", "ksh", "node", "bun", "python", "python3",
                "env",
            ]
            .contains(&name)
            {
                // Variants share an executable (claude-agent-teams runs `claude`):
                // the earlier catalog entry keeps the name, or a plain Claude launch
                // would read as its variant and lose its native bridge.
                names.entry(name.to_string()).or_insert(manifest.id);
            }
        }
        // Re-read active handles after awaiting ps: a closed/replaced runtime
        // must not acquire the identity of the process it used to own.
        let mut active = self.active.lock().unwrap();
        for (key, runtime) in active.iter_mut() {
            let Some(root) = runtime
                .handle
                .terminal
                .process_id
                .filter(|_| runtime.handle.terminal.daemon_session.is_some())
            else {
                continue;
            };
            let foreground = foreground_provider(root, &processes, &names);
            if let Some((_, provider)) = &foreground {
                if provider != &runtime.observed_provider {
                    runtime.observed_provider = provider.clone();
                    *runtime.title_tracker.lock().unwrap() =
                        crate::agent_title::TitleTracker::default();
                    runtime.title_status.store(false, Ordering::Release);
                    if let Some(manifest) = self.providers.get(provider) {
                        *runtime.output_detection.lock().unwrap() =
                            (manifest.status_detection, String::new());
                    }
                    runtime.native_status.store(false, Ordering::Release);
                    runtime.native_running = false;
                    if provider == crate::agent_fleet::TERMINAL_PROVIDER
                        && self.lifecycle.get(key).is_ok_and(|snapshot| {
                            matches!(
                                snapshot.state,
                                AgentState::Working | AgentState::Blocked | AgentState::Done
                            )
                        })
                    {
                        self.lifecycle.transition(
                            key,
                            AgentState::Idle,
                            "agent returned to shell",
                            now_millis(),
                        )?;
                    }
                }
            }
            // A tool-launched agent is also a descendant, but only the enclosing
            // foreground agent may own this tab's native status (even for the same provider).
            let launched = crate::shell_integration::launched(key)?.filter(|agent| {
                foreground
                    .as_ref()
                    .is_some_and(|(pid, _)| *pid == agent.pid)
            });
            if runtime.shell_agent != launched {
                if let Some(ended) = runtime.shell_agent.as_ref() {
                    // That invocation's identity ends with it; the shell's launcher stays for
                    // the next one the person starts.
                    if let Some(identities) = self.identities.get() {
                        if let Err(error) = identities.revoke_launch(&key.session_id, ended.pid) {
                            tracing::warn!(%error, "could not retire an ended agent's identity");
                        }
                    }
                    // A successful process snapshot confirmed that invocation
                    // ended or was replaced. This is not a silence timeout.
                    runtime.native_status.store(false, Ordering::Release);
                    runtime.native_running = false;
                    self.lifecycle.transition(
                        key,
                        AgentState::Idle,
                        "terminal agent invocation ended",
                        now_millis(),
                    )?;
                }
                runtime.shell_agent = launched;
            }
        }
        let next: HashMap<_, _> = active
            .values()
            .filter_map(|runtime| {
                let identity = &runtime.handle.terminal;
                // A tmux/SSH attachment is not the remote agent's process tree.
                identity.daemon_session.as_ref()?;
                let (_, provider) = foreground_provider(identity.process_id?, &processes, &names)?;
                Some((runtime.handle.key.session_id.clone(), provider))
            })
            .collect();
        let next_chats: HashMap<_, _> = active
            .iter()
            .filter_map(|(key, runtime)| {
                Some((
                    key.session_id.clone(),
                    runtime.shell_agent.as_ref()?.key.agent_id.clone(),
                ))
            })
            .collect();
        // ponytail: one cheap syscall per terminal per tick; the daemon could push cwd changes instead.
        let mut moved = Vec::new();
        {
            let mut cwds = self.cwds.lock().unwrap();
            for runtime in active.values() {
                let identity = &runtime.handle.terminal;
                if identity.daemon_session.is_none() {
                    continue;
                }
                let Some(cwd) = identity.process_id.and_then(process_cwd) else {
                    continue;
                };
                let seen = cwds
                    .entry(runtime.handle.key.session_id.clone())
                    .or_default();
                if seen.last() == Some(&cwd) {
                    continue;
                }
                seen.retain(|old| old != &cwd);
                seen.push(cwd);
                if seen.len() > 32 {
                    seen.remove(0);
                }
                moved.push(runtime.handle.key.session_id.clone());
            }
        }
        let mut previous = self.current_providers.lock().unwrap();
        let mut chats = self.shell_chats.lock().unwrap();
        let changed = previous
            .keys()
            .chain(next.keys())
            .filter(|id| previous.get(*id) != next.get(*id))
            .chain(
                chats
                    .keys()
                    .chain(next_chats.keys())
                    .filter(|id| chats.get(*id) != next_chats.get(*id)),
            )
            .cloned()
            .chain(moved)
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();
        *previous = next;
        *chats = next_chats;
        Ok(changed)
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
    pub fn observe_native_turn(&self, key: &AgentKey, running: bool) -> anyhow::Result<bool> {
        let started = running
            && self
                .active
                .lock()
                .unwrap()
                .get(key)
                .is_some_and(|runtime| !runtime.native_running);
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
        Ok(started)
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

    /// The session's status comes from its OSC title (`agent_title`).
    pub fn has_title_status(&self, session_id: &str) -> bool {
        self.active.lock().unwrap().iter().any(|(key, runtime)| {
            key.session_id == session_id && runtime.title_status.load(Ordering::Acquire)
        })
    }

    pub(crate) fn native_owner_is_current(&self, key: &AgentKey) -> bool {
        self.active.lock().unwrap().get(key).is_some_and(|runtime| {
            runtime.shell_agent.is_none() && runtime.observed_provider == runtime.handle.provider_id
        })
    }

    /// Runtimes whose own CLI is the foreground agent right now, so its native bridge should be
    /// connected. `observe` runs once at attach; if the first process snapshot caught the launch
    /// wrapper's shell, the bridge gave up for good and the tab never showed Working.
    pub(crate) fn native_owners(&self) -> Vec<AgentKey> {
        self.active
            .lock()
            .unwrap()
            .iter()
            .filter(|(_, runtime)| {
                runtime.shell_agent.is_none()
                    && runtime.observed_provider == runtime.handle.provider_id
                    && crate::native_ui::supported(&runtime.handle.provider_id)
            })
            .map(|(key, _)| key.clone())
            .collect()
    }

    pub(crate) fn shell_agents(&self) -> Vec<(AgentKey, crate::shell_integration::ShellAgent)> {
        self.active
            .lock()
            .unwrap()
            .iter()
            .filter_map(|(key, runtime)| Some((key.clone(), runtime.shell_agent.clone()?)))
            .collect()
    }

    /// Whose native bridge speaks for the tab `key` owns: the agent typed into its shell right now,
    /// else the tab's own while it is still the foreground agent. A tab started as Claude whose CLI
    /// exited and now runs `pi` is `pi`; one back at a bare shell has none (`None`), so a stale bridge
    /// of the agent that left is never written to or read as if it were current.
    pub(crate) fn bridge_key(&self, key: &AgentKey) -> Option<AgentKey> {
        let (typed, owner_current) = {
            let active = self.active.lock().unwrap();
            let runtime = active.get(key);
            (
                runtime.and_then(|runtime| runtime.shell_agent.clone()),
                // The same test as `native_owner_is_current`.
                runtime.map(|runtime| {
                    runtime.shell_agent.is_none()
                        && runtime.observed_provider == runtime.handle.provider_id
                }),
            )
        };
        let typed = typed
            .filter(|agent| self.shell_agent_is_current(key, agent))
            .map(|agent| agent.key);
        pick_bridge(key, typed, owner_current)
    }

    pub(crate) fn shell_agent_is_current(
        &self,
        key: &AgentKey,
        agent: &crate::shell_integration::ShellAgent,
    ) -> bool {
        self.active
            .lock()
            .unwrap()
            .get(key)
            .is_some_and(|runtime| runtime.shell_agent.as_ref() == Some(agent))
            && crate::shell_integration::launched(key)
                .ok()
                .flatten()
                .as_ref()
                == Some(agent)
    }

    /// Whether process `pid` is the agent `provider` just launched through a shim in the tab `owner`
    /// runs, and so may be issued an identity: the shim's own launch marker names exactly this
    /// provider and pid, and the process descends from the tab's shell. Anything uncertain (no
    /// running tab, no marker, an unreadable process table) says no.
    pub fn verify_launch(&self, owner: &AgentKey, provider: &str, pid: u32) -> Result<(), String> {
        let root = self
            .active
            .lock()
            .unwrap()
            .get(owner)
            .and_then(|runtime| {
                let terminal = &runtime.handle.terminal;
                terminal
                    .process_id
                    .filter(|_| terminal.daemon_session.is_some())
            })
            .ok_or("this shell is not running under Perch")?;
        let launched = crate::shell_integration::launched(owner)
            .ok()
            .flatten()
            .ok_or("no agent was started in this shell")?;
        if launched.pid != pid || launched.key.agent_id != provider {
            return Err("that is not the agent this shell just started".into());
        }
        let output = std::process::Command::new("ps")
            .args(["-ax", "-o", "pid=,ppid=,stat=,comm=,args="])
            .output()
            .map_err(|_| "Perch could not read the process table")?;
        let text = String::from_utf8_lossy(&output.stdout).into_owned();
        let processes = process_snapshot(&text);
        let mut ancestor = pid;
        for _ in 0..processes.len() {
            if ancestor == root {
                return Ok(());
            }
            match processes.get(&ancestor) {
                Some(process) => ancestor = process.parent,
                None => break,
            }
        }
        Err("that process is not in this shell".into())
    }

    pub(crate) fn set_native_status(&self, key: &AgentKey) {
        if let Some(runtime) = self.active.lock().unwrap().get(key) {
            runtime.native_status.store(true, Ordering::Release);
        }
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
        if provider_id == crate::agent_fleet::TERMINAL_PROVIDER && !extra_args.is_empty() {
            if extra_args.len() != 1 {
                return Err(RuntimeAdapterError::Launch(LaunchError::InvalidInput(
                    "Run needs exactly one command".into(),
                )));
            }
            // A confirmed command is shell SOURCE by design, passed as one
            // positional argument, never interpolated into this wrapper and
            // never typed/pasted into an agent or an already-running shell.
            return Ok(vec![
                "/bin/sh".into(), "-c".into(),
                "trap : INT; printf '\\033]133;C\\007'; \"${PERCH_SHELL:-${SHELL:-/bin/sh}}\" -c \"$1\"; s=$?; printf '\\033]133;D;%s\\007\\n[exit %s]\\n' \"$s\" \"$s\"; exec \"${PERCH_SHELL:-${SHELL:-/bin/sh}}\" -l".into(),
                "perch-run".into(), extra_args[0].clone(),
            ]);
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
        // A reconnect is not a launch request, even without a continuation ID.
        // A missing daemon process must not become a new conversation.
        if snapshot.state == AgentState::Reconnecting
            && provider_id != crate::agent_fleet::TERMINAL_PROVIDER
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
            let mut snapshot = self.size_marker(&key);
            if let Err(error) =
                self.terminals
                    .observe(&existing.terminal, &client.id, on_data, on_exit, || {
                        snapshot += &replay.lock().unwrap().text();
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

        let existing_only = snapshot.state == AgentState::Exited
            || (snapshot.state == AgentState::Reconnecting && snapshot.reason != "wake requested");
        let prepared = match (|| {
            // The pin is read here, once per launch, and covers wake and resume: it is
            // the session's snapshot, never the current Instructions. A failure refuses
            // the launch rather than starting an agent without what was meant for it.
            let pinned = match self.instructions.get() {
                Some(resolve)
                    if provider_id == crate::agent_fleet::TERMINAL_PROVIDER
                        || crate::instructions::supported(&provider_id) =>
                {
                    resolve(&key)?
                }
                _ => None,
            };
            // The Perch pointer joins what the session pinned, for this launch only; the
            // stored pin is unchanged. It is given only with an identity to go with it.
            let identity = self.launch_identity(&key, &provider_id, existing_only)?;
            // A reattach mints no identity (the process keeps its token) but the shims are
            // rewritten, so they get the pointer whenever a `perch` binary can run.
            let pinned = if identity.is_some()
                || (existing_only && crate::agent_identity::cli_binary().is_some())
            {
                Some(crate::agent_identity::with_pointer(pinned.as_ref()))
            } else {
                pinned
            };
            let (command, server_args) =
                with_instructions(&key, &provider_id, command, pinned.as_ref())?;
            let command = match provider_id.as_str() {
                "codex" if crate::native_ui::supported(&provider_id) => {
                    crate::native_ui::codex::launch(&key, command, &server_args)?
                }
                "opencode" if crate::native_ui::supported(&provider_id) => {
                    crate::native_ui::opencode::launch(&key, command)?
                }
                _ => command,
            };
            let command = if provider_id == crate::agent_fleet::TERMINAL_PROVIDER {
                command
            } else {
                in_shell(
                    command,
                    &crate::daemon::exit_marker(&terminal_key(&key)),
                    &crate::daemon::cores_dir(),
                )
            };
            let command = crate::shell_integration::prepare(
                &key,
                command,
                pinned
                    .as_ref()
                    .filter(|_| provider_id == crate::agent_fleet::TERMINAL_PROVIDER),
                // A reattach issues no new identity, but the running agent still holds its
                // token: keep its `perch` entry instead of removing it from under it.
                identity
                    .as_ref()
                    .map(|identity| identity.cli.clone())
                    .or_else(|| {
                        existing_only
                            .then(crate::agent_identity::cli_binary)
                            .flatten()
                    })
                    .as_deref(),
            )?;
            crate::provider_environment::prepare(
                command,
                &manifest.environment,
                identity
                    .as_ref()
                    .map_or(&[][..], |identity| &identity.environment),
            )
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
        let title_status = Arc::new(AtomicBool::new(false));
        let data_title_status = title_status.clone();
        let title_tracker = Arc::new(Mutex::new(crate::agent_title::TitleTracker::default()));
        let title = title_tracker.clone();
        let replay = Arc::new(Mutex::new(TerminalReplay::new(cols, rows)));
        let replay_for_output = replay.clone();
        let output_detection = Arc::new(Mutex::new((
            manifest.status_detection.clone(),
            String::new(),
        )));
        let data_output_detection = output_detection.clone();
        let turn_boundary = self.turn_boundary.clone();
        let wrapped_on_data: TerminalDataListener = Arc::new(move |_, text| {
            replay_for_output.lock().unwrap().push(&text);
            if !data_suppress.load(Ordering::Acquire) && !data_native_status.load(Ordering::Acquire)
            {
                let emit = |signal: ProviderSignal| {
                    if matches!(signal, ProviderSignal::Completed { .. }) {
                        if let Some(record) = turn_boundary.get() {
                            if let Err(error) = record(&event_key, false) {
                                tracing::error!(%error, "could not persist completed provider turn");
                                return;
                            }
                        }
                    }
                    let _ = lifecycle.signal(&event_key, signal, now_millis());
                };
                // Configured markers, then the OSC title, then "any output
                // means working". The title parser sees every chunk either way.
                let marker = {
                    let mut detection = data_output_detection.lock().unwrap();
                    let (patterns, tail) = &mut *detection;
                    output_status_signal(patterns, tail, &text)
                };
                let title_change = title.lock().unwrap().feed(&text);
                if let Some(signal) = marker {
                    emit(signal);
                } else if let Some((previous, next)) = title_change {
                    data_title_status.store(true, Ordering::Release);
                    if previous.is_none() && next == crate::agent_title::TitleStatus::Idle {
                        let _ = lifecycle.transition(
                            &event_key,
                            AgentState::Idle,
                            "terminal title reports idle",
                            now_millis(),
                        );
                    }
                    crate::agent_title::signals(previous, next)
                        .into_iter()
                        .for_each(emit);
                } else if data_title_status.load(Ordering::Acquire) {
                    // Repaints are not a new turn once the title owns status.
                    if !text.trim().is_empty() {
                        let _ = lifecycle.record_activity(&event_key, now_millis());
                    }
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
        let identities = self.identities.get().cloned();
        let exit_listener = self.exit_listener.get().cloned();
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
                .map_or(code == crate::terminal::TRANSPORT_LOST, |identity| {
                    terminal_registry.runtime_alive(identity)
                });
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
                        reason: "terminal connection lost; process exit is not confirmed. Reconnect to retry"
                            .to_string(),
                    }
                } else {
                    ProviderSignal::ProcessExited { code: Some(code) }
                };
                let _ = lifecycle.signal(&event_key, signal, now_millis());
            }
            if !alive {
                // Only a confirmed exit ends the run's identity; a lost connection is not one.
                if let Some(identities) = identities.as_ref() {
                    if let Err(error) = identities.revoke_session(&event_key) {
                        tracing::error!(%error, "could not revoke the ended run's agent token");
                    }
                }
                if let Some(listener) = exit_listener.as_ref() {
                    listener(&event_key);
                }
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
        let outcome = match self.terminals.attach_inner(
            &terminal_key(&key),
            RUNTIME_VIEWER,
            cols,
            rows,
            Some(cwd.display().to_string()),
            prepared.argv,
            wrapped_on_data,
            wrapped_on_exit,
            existing_only,
        ) {
            Ok(outcome) => outcome,
            Err(error) => {
                let _ = self.lifecycle.signal(
                    &key,
                    if existing_only {
                        ProviderSignal::TransportLost { reason: format!("Reconnect failed: {error}. Retry when perchd is available; no replacement was started") }
                    } else {
                        ProviderSignal::Error { reason: format!("provider launch failed: {error}") }
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
                    title_status,
                    native_running: false,
                    shell_agent: None,
                    observed_provider: handle.provider_id.clone(),
                    title_tracker,
                    output_detection,
                    replay: replay.clone(),
                    _bootstrap: prepared.bootstrap,
                },
            );
        }

        let mut snapshot = self.size_marker(&key);
        if let Err(error) = self
            .terminals
            .observe(&identity, &client.id, on_data, on_exit, || {
                snapshot += &replay.lock().unwrap().text();
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
        self.acquire_control_locked(key, channel, client, at_ms)
    }

    /// Automatic recovery never takes control from another live view, even
    /// when several connections noticed the same vacant lease.
    pub fn acquire_control_if_unowned(
        &self,
        key: &AgentKey,
        channel: ControlChannel,
        client: ClientIdentity,
        at_ms: u64,
    ) -> Result<Option<ControlLease>, RuntimeAdapterError> {
        let _authority = self.authority.lock().unwrap();
        let snapshot = self.lifecycle.get(key)?;
        let owner = match channel {
            ControlChannel::Input => snapshot.input_owner,
            ControlChannel::Resize => snapshot.resize_owner,
        };
        if let Some(owner) = owner {
            return Ok((owner.client == client).then_some(owner));
        }
        self.acquire_control_locked(key, channel, client, at_ms)
            .map(Some)
    }

    fn acquire_control_locked(
        &self,
        key: &AgentKey,
        channel: ControlChannel,
        client: ClientIdentity,
        at_ms: u64,
    ) -> Result<ControlLease, RuntimeAdapterError> {
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
        self.prepare_input(key, data, at_ms)?;
        self.terminals
            .input_owned(&terminal_key(key), &lease.client, lease.generation, data)?;
        Ok(())
    }

    /// All live attached views may type. This does not move resize or stop
    /// authority; the exact PTY identity and attachment are checked at the writer.
    pub fn input_from_view(
        &self,
        key: &AgentKey,
        terminal_id: &str,
        client: &ClientIdentity,
        data: &str,
        at_ms: u64,
    ) -> Result<(), RuntimeAdapterError> {
        let _authority = self.authority.lock().unwrap();
        let handle = self
            .runtime(key)
            .filter(|handle| handle.terminal.terminal_id == terminal_id)
            .ok_or_else(|| RuntimeAdapterError::RuntimeMismatch(key.clone()))?;
        if !self.lifecycle.get(key)?.observers.contains(&client.id) {
            return Err(TerminalAuthorityError::NotOwned.into());
        }
        self.lifecycle.record_activity(key, at_ms)?;
        self.prepare_input(key, data, at_ms)?;
        self.terminals
            .input_for_view(&handle.terminal, client, data)?;
        Ok(())
    }

    /// Remember that some client's bytes are reaching this session's PTY now (a person typing, a
    /// terminal's own reports). Core-originated writes are not recorded: they are checked, not heard.
    pub(crate) fn note_terminal_input(&self, session_id: &str, data: &str) {
        let now = std::time::Instant::now();
        self.last_input
            .lock()
            .unwrap()
            .insert(session_id.to_string(), now);
        self.typed
            .lock()
            .unwrap()
            .entry(session_id.to_string())
            .or_default()
            .feed(data, now);
    }

    /// Did a client type `command` and press Enter in this session's terminal a moment ago? Used
    /// up by the answer: one typed line proves one request. An agent cannot make this true: its
    /// own commands and Perch's writes never pass through here.
    pub fn person_typed(&self, session_id: &str, command: &str) -> bool {
        self.typed
            .lock()
            .unwrap()
            .get_mut(session_id)
            .is_some_and(|typed| {
                typed.take(
                    command,
                    std::time::Instant::now(),
                    crate::typed_lines::FRESH,
                )
            })
    }

    /// Whether no client has sent input to this session's PTY for `window`. Unknown counts as recent:
    /// with nothing heard since this core started, only a core older than the window may say quiet.
    pub fn input_quiet_for(&self, session_id: &str, window: Duration) -> bool {
        let since = self
            .last_input
            .lock()
            .unwrap()
            .get(session_id)
            .copied()
            .unwrap_or(self.born);
        since.elapsed() >= window
    }

    /// Core-originated delivery into a prompt (slice 5 mail), all under the authority lock that every
    /// PTY write and lease change also takes. Needs `quiet` of silence on the PTY first, else the
    /// closure is not called and `None` comes back. Writes under whatever input lease is current: a
    /// view that holds it keeps it unchanged (same client, same generation, nothing taken, released
    /// or recorded); with no holder, `own_client` borrows the lease for this call alone and gives it
    /// back before the lock is released.
    pub fn dispatch_under_current_lease<R>(
        &self,
        key: &AgentKey,
        own_client: &ClientIdentity,
        quiet: Duration,
        dispatch: impl FnOnce(&dyn Fn(&str) -> anyhow::Result<()>) -> anyhow::Result<R>,
    ) -> anyhow::Result<Option<R>> {
        let _authority = self.authority.lock().unwrap();
        if !self.input_quiet_for(&key.session_id, quiet) {
            return Ok(None);
        }
        let before = self.lifecycle.get(key)?;
        let terminal = terminal_key(key);
        if let Some(holder) = before.input_owner {
            let write = |data: &str| -> anyhow::Result<()> {
                self.terminals
                    .input_owned(&terminal, &holder.client, holder.generation, data)?;
                Ok(())
            };
            return dispatch(&write).map(Some);
        }
        let lease = self.acquire_control_locked(
            key,
            ControlChannel::Input,
            own_client.clone(),
            now_millis(),
        )?;
        let result = (|| {
            self.lifecycle.record_control_activity(
                key,
                ControlChannel::Input,
                &lease.client,
                lease.generation,
                now_millis(),
                Duration::from_secs(5),
            )?;
            dispatch(&|data| {
                self.terminals
                    .input_owned(&terminal, &lease.client, lease.generation, data)?;
                Ok(())
            })
        })();
        let _ = self.lifecycle.release_control(
            key,
            ControlChannel::Input,
            &lease.client,
            lease.generation,
        );
        let _ = self
            .terminals
            .clear_input_owner(&terminal, &lease.client, lease.generation);
        if !before.observers.contains(&own_client.id) {
            let _ = self.lifecycle.detach_observer(key, &own_client.id);
        }
        result.map(Some)
    }

    fn prepare_input(
        &self,
        key: &AgentKey,
        data: &str,
        at_ms: u64,
    ) -> Result<(), RuntimeAdapterError> {
        if !data.is_empty() {
            self.note_terminal_input(&key.session_id, data);
        }
        let native_ready = self.has_native_status(&key.session_id);
        if data.contains(['\r', '\n'])
            && (!crate::native_ui::supported(&key.agent_id) || native_ready)
        {
            // Turn review is best-effort; a failed snapshot must never eat
            // the keystroke that submits a prompt or answers a dialog.
            if let Err(error) = self.record_turn_boundary(key, true) {
                tracing::warn!(?key, %error, "could not record turn boundary");
            }
            // A title-owned turn starts when the title says so: an Enter
            // that dismisses a menu must not leave the session running.
            if !native_ready && !self.has_title_status(&key.session_id) {
                self.lifecycle
                    .signal(key, ProviderSignal::TurnStarted, at_ms)?;
            }
        }
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

    /// A replay starts at the PTY's current size, which the replayed bytes
    /// were (mostly) written for; see `terminal::pty_size_marker`.
    fn size_marker(&self, key: &AgentKey) -> String {
        self.terminals
            .size(&terminal_key(key))
            .map(|(cols, rows)| crate::terminal::pty_size_marker(cols, rows))
            .unwrap_or_default()
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
        } else if !crate::daemon::terminate(&terminal_key(key)) {
            return Err(RuntimeAdapterError::Process(anyhow::anyhow!(
                "could not confirm that the daemon process stopped; session retained"
            )));
        }
        self.active.lock().unwrap().remove(key);
        self.lifecycle.remove(key)?;
        Ok(())
    }

    /// Stop a runtime this core started on behalf of its owner, with no input lease: a lead
    /// stopping its own child (`server/sub_sessions.rs`, which checks that authority). Like
    /// [`Self::remove`], it returns `Ok` only once the process is confirmed gone, and it keeps
    /// the lifecycle record, so the exit is observed and the session can be woken later.
    pub fn stop_confirmed(&self, key: &AgentKey) -> Result<(), RuntimeAdapterError> {
        let _authority = self.authority.lock().unwrap();
        if let Some(handle) = self.runtime(key) {
            self.terminals
                .terminate_for_hibernation(&handle.terminal)
                .map_err(RuntimeAdapterError::Process)?;
            if self.terminals.runtime_alive(&handle.terminal) {
                return Err(RuntimeAdapterError::RuntimeStillAlive(handle.terminal));
            }
        } else if !crate::daemon::terminate(&terminal_key(key)) {
            return Err(RuntimeAdapterError::Process(anyhow::anyhow!(
                "could not confirm that the daemon process stopped"
            )));
        }
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

/// Only process names enter the display identity; arguments are never stored
/// or searched for agent names (a command like `echo pi` is not Pi).
struct ForegroundProcess<'a> {
    parent: u32,
    foreground: bool,
    names: Vec<&'a str>,
}

/// A process's current directory, or `None` where the OS will not say.
fn process_cwd(pid: u32) -> Option<String> {
    #[cfg(target_os = "linux")]
    {
        let path = std::fs::read_link(format!("/proc/{pid}/cwd")).ok()?;
        Some(path.to_string_lossy().into_owned())
    }
    #[cfg(target_os = "macos")]
    {
        // SAFETY: a zeroed plain-data struct the kernel fills; the byte count is checked.
        let mut info: libc::proc_vnodepathinfo = unsafe { std::mem::zeroed() };
        let size = std::mem::size_of_val(&info) as libc::c_int;
        let read = unsafe {
            libc::proc_pidinfo(
                pid as libc::c_int,
                libc::PROC_PIDVNODEPATHINFO,
                0,
                (&mut info as *mut libc::proc_vnodepathinfo).cast(),
                size,
            )
        };
        if read != size {
            return None;
        }
        let bytes: Vec<u8> = info
            .pvi_cdir
            .vip_path
            .iter()
            .flatten()
            .map(|byte| *byte as u8)
            .take_while(|byte| *byte != 0)
            .collect();
        Some(String::from_utf8_lossy(&bytes).into_owned())
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        let _ = pid;
        None
    }
}

fn process_snapshot(text: &str) -> HashMap<u32, ForegroundProcess<'_>> {
    text.lines()
        .filter_map(|line| {
            let mut fields = line.split_whitespace();
            let pid = fields.next()?.parse().ok()?;
            let parent = fields.next()?.parse().ok()?;
            let state = fields.next()?;
            let executable = fields.next()?;
            let command = fields.next().unwrap_or(executable);
            let mut names = vec![executable, command];
            // Interpreted entrypoints may retain the interpreter's process name.
            if ["node", "bun", "python", "python3"]
                .contains(&Path::new(command).file_name()?.to_str()?)
            {
                if let Some(script) = fields.next().filter(|script| !script.starts_with('-')) {
                    names.push(script);
                }
            }
            // Claude Code installs a versioned binary (.../claude/versions/2.1.301)
            // whose process name never says "claude"; its install directory does.
            let parts: Vec<_> = Path::new(command).components().collect();
            if let Some(i) = parts
                .iter()
                .rposition(|part| part.as_os_str() == "versions")
            {
                if let Some(name) = i.checked_sub(1).and_then(|i| parts[i].as_os_str().to_str()) {
                    names.push(name);
                }
            }
            // ponytail: ps's text format cannot identify executable paths with
            // whitespace reliably; move names/argv into perchd metadata for those.
            Some((
                pid,
                ForegroundProcess {
                    parent,
                    foreground: state.contains('+') && !state.contains('T') && !state.contains('Z'),
                    names,
                },
            ))
        })
        .collect()
}

/// The bridge that speaks for a tab: the shell-typed agent when one is current, else the tab's own
/// when it still owns the foreground. A runtime we know nothing about (`owner_current` is `None`) keeps
/// the tab's own, as every lookup did before; one known not to own it has no bridge, because the
/// bridge of the agent that left may still be registered for a moment.
fn pick_bridge(
    owner: &AgentKey,
    typed: Option<AgentKey>,
    owner_current: Option<bool>,
) -> Option<AgentKey> {
    typed.or_else(|| (owner_current != Some(false)).then(|| owner.clone()))
}

fn foreground_provider(
    root: u32,
    processes: &HashMap<u32, ForegroundProcess<'_>>,
    providers: &HashMap<String, String>,
) -> Option<(u32, String)> {
    processes.get(&root)?;
    let nearest = processes
        .iter()
        .filter_map(|(&pid, process)| {
            if !process.foreground {
                return None;
            }
            let provider = process
                .names
                .iter()
                .find_map(|name| providers.get(Path::new(name).file_name()?.to_str()?))?;
            let mut ancestor = pid;
            // The bound also rejects malformed/cyclic ancestry without hanging.
            for depth in 0..processes.len() {
                if ancestor == root {
                    return Some((depth, pid, provider));
                }
                ancestor = processes.get(&ancestor)?.parent;
            }
            None
        })
        .min_by_key(|(depth, pid, _)| (*depth, *pid));
    Some(nearest.map_or(
        (root, crate::agent_fleet::TERMINAL_PROVIDER.to_string()),
        |(_, pid, provider)| (pid, provider.clone()),
    ))
}

#[cfg(test)]
mod tests {
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    #[test]
    fn process_cwd_reads_a_live_process_directory() {
        let here = std::env::current_dir().unwrap().canonicalize().unwrap();
        let seen = super::process_cwd(std::process::id()).unwrap();
        assert_eq!(std::path::Path::new(&seen).canonicalize().unwrap(), here);
        assert_eq!(super::process_cwd(u32::MAX - 1), None);
    }

    #[test]
    fn in_shell_keeps_argv_and_falls_back_to_the_login_shell() {
        let dir = std::env::temp_dir().join(format!("perch-in-shell-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let run = |cores: &Path| {
            let argv = super::in_shell(
                vec!["printf".into(), "%s|".into(), "a b".into(), "c".into()],
                &dir.join("agent-exit/k"),
                cores,
            );
            let output = std::process::Command::new(&argv[0])
                .args(&argv[1..])
                .env_remove("PERCH_SHELL") // set when the suite runs inside a Perch terminal
                .env("SHELL", "/bin/echo")
                .output()
                .unwrap();
            assert_eq!(String::from_utf8_lossy(&output.stdout), "a b|c|-l\n");
        };
        // A live core (this test process) means the user was there: no marker.
        let cores = dir.join("cores");
        std::fs::create_dir_all(&cores).unwrap();
        let me = cores.join(std::process::id().to_string());
        std::fs::write(&me, b"").unwrap();
        run(&cores);
        assert!(!dir.join("agent-exit/k").exists());
        // No live core (a dead pid, then no dir at all): the exit is recorded.
        std::fs::remove_file(&me).unwrap();
        std::fs::write(cores.join("2147483646"), b"").unwrap();
        run(&cores);
        assert!(dir.join("agent-exit/k").exists());
        std::fs::remove_file(dir.join("agent-exit/k")).unwrap();
        run(&dir.join("missing"));
        assert!(dir.join("agent-exit/k").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// The agent sees its Perch identity; the login shell that follows it does not.
    #[test]
    fn the_post_exit_shell_holds_no_agent_identity() {
        use std::os::unix::fs::PermissionsExt;
        let dir = std::env::temp_dir().join(format!("perch-in-shell-id-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let shell = dir.join("shell");
        std::fs::write(
            &shell,
            "#!/bin/sh\nprintf 'after:%s:%s' \"${PERCH_SESSION-unset}\" \"${PERCH_TOKEN-unset}\"\n",
        )
        .unwrap();
        std::fs::set_permissions(&shell, std::fs::Permissions::from_mode(0o755)).unwrap();
        let argv = super::in_shell(
            vec![
                "/bin/sh".into(),
                "-c".into(),
                "printf 'agent:%s:%s|' \"$PERCH_SESSION\" \"$PERCH_TOKEN\"".into(),
            ],
            &dir.join("agent-exit/k"),
            &dir.join("cores"),
        );
        let output = std::process::Command::new(&argv[0])
            .args(&argv[1..])
            .env("SHELL", &shell)
            .env_remove("PERCH_SHELL")
            .env("PERCH_SESSION", "s1")
            .env("PERCH_TOKEN", "t1")
            .output()
            .unwrap();
        assert_eq!(
            String::from_utf8_lossy(&output.stdout),
            "agent:s1:t1|after:unset:unset"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    use super::*;
    use crate::agent_fleet::{
        AgentKey, ClientKind, EnvironmentPolicy, LaunchSpec, ModeLaunchSpec, PromptTransport,
        ProviderCapability, ProviderManifest, Resumability, ResumePlacement, StatusDetection,
    };
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Barrier;
    use std::time::Duration;

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    /// Picker-launched Claude tab -> `pi` typed into its shell -> back at a bare shell.
    #[test]
    fn the_bridge_of_a_tab_follows_the_agent_on_screen_and_never_a_stale_one() {
        let tab = AgentKey::new("w", "s", "claude").unwrap();
        let pi = crate::shell_integration::bridge_key(&tab, "pi").unwrap();
        // Claude owns the foreground: its own bridge.
        assert_eq!(pick_bridge(&tab, None, Some(true)), Some(tab.clone()));
        // `pi` is typed into the shell: it, even though Claude's bridge may still be registered.
        assert_eq!(pick_bridge(&tab, Some(pi.clone()), Some(false)), Some(pi));
        // Back at a bare shell: nobody, so nothing reaches Claude's stale bridge.
        assert_eq!(pick_bridge(&tab, None, Some(false)), None);
        // No runtime known (not started here): the tab's own, as before.
        assert_eq!(pick_bridge(&tab, None, None), Some(tab));
    }

    #[test]
    fn foreground_identity_tracks_shell_agents_tools_and_background_jobs() {
        let providers = [
            ("pi".into(), "pi".into()),
            ("codex".into(), "codex".into()),
            ("claude".into(), "claude".into()),
        ]
        .into_iter()
        .collect();
        let cases = [
            ("10 1 S+ /bin/zsh -zsh", Some("terminal")),
            ("10 1 S /bin/zsh -zsh\n11 10 S+ pi pi", Some("pi")),
            // Shell wrapper and agent share the foreground group. A nested
            // agent called by Pi's tools must not steal the enclosing icon.
            (
                "10 1 S+ /bin/sh sh\n11 10 S+ pi pi\n12 11 S+ codex codex",
                Some("pi"),
            ),
            (
                "10 1 S /bin/zsh zsh\n11 10 S+ /usr/bin/node node /usr/local/bin/pi",
                Some("pi"),
            ),
            ("10 1 S+ zsh zsh\n11 10 S pi pi", Some("terminal")),
            ("10 1 S+ zsh zsh\n11 10 T+ pi pi", Some("terminal")),
            ("10 1 S zsh zsh\n11 10 S+ echo echo pi", Some("terminal")),
            (
                "10 1 S zsh zsh\n11 10 S+ vim vim pi\n20 1 S+ pi pi",
                Some("terminal"),
            ),
            ("10 1 S zsh zsh\n11 10 S+ codex codex", Some("codex")),
            (
                "10 1 S zsh zsh\n11 10 S+ /h/.local/share/claude/versions/2.1.301 /h/.local/share/claude/versions/2.1.301 --settings x",
                Some("claude"),
            ),
            // A versions directory that isn't an agent's is not an identity.
            ("10 1 S zsh zsh\n11 10 S+ /opt/tool/versions/1 /opt/tool/versions/1", Some("terminal")),
            // Equal-depth pipeline agents have a stable PID tie-breaker.
            (
                "10 1 S zsh zsh\n11 10 S+ pi pi\n12 10 S+ codex codex",
                Some("pi"),
            ),
            ("11 1 S+ pi pi", None),
            (
                "10 1 S+ zsh zsh\n11 12 S+ pi pi\n12 11 S sh sh",
                Some("terminal"),
            ),
            ("malformed\n10 1 S+ zsh zsh", Some("terminal")),
        ];
        for (text, expected) in cases {
            assert_eq!(
                foreground_provider(10, &process_snapshot(text), &providers)
                    .as_ref()
                    .map(|(_, provider)| provider.as_str()),
                expected,
                "{text}"
            );
        }
        let mut processes = process_snapshot("10 1 S zsh zsh\n11 10 S+ pi pi");
        assert_eq!(
            foreground_provider(10, &processes, &providers),
            Some((11, "pi".into()))
        );
        // Nested agents, including the same provider, cannot own the tab's status.
        for child in ["pi", "codex"] {
            let text = format!("10 1 S+ sh sh\n11 10 S+ pi pi\n12 11 S+ {child} {child}");
            assert_eq!(
                foreground_provider(10, &process_snapshot(&text), &providers),
                Some((11, "pi".into()))
            );
        }
        processes.remove(&11); // Exit with no OSC shell-title update.
        assert_eq!(
            foreground_provider(10, &processes, &providers),
            Some((10, "terminal".into()))
        );
    }

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

    /// Picker launches, wake and resume all go through `with_instructions` with the session's
    /// pin, so the same pin must give the same arguments and the same private file each time.
    #[test]
    fn a_pin_adds_the_same_append_flags_to_every_launch_of_a_session() {
        use crate::instructions::{compose, Instructions, Source};
        use std::os::unix::fs::PermissionsExt;
        let folder = std::env::temp_dir()
            .to_string_lossy()
            .trim_end_matches('/')
            .to_string();
        let pin = compose(&[(
            Source {
                scope: "project".into(),
                id: "p".into(),
                revision: 1,
            },
            Instructions {
                text: "Marker rule\nsecond line".into(),
                folders: vec![folder.clone()],
            },
        )])
        .unwrap();
        let session = format!("instr-{}", uuid::Uuid::new_v4());
        let command = |words: &[&str]| {
            words
                .iter()
                .map(|word| word.to_string())
                .collect::<Vec<_>>()
        };

        let claude = AgentKey::new("w", &session, "claude").unwrap();
        let (first, server) = with_instructions(
            &claude,
            "claude",
            command(&["claude", "--resume", "id"]),
            Some(&pin),
        )
        .unwrap();
        let file = crate::native_ui::paths(&claude)
            .unwrap()
            .extension
            .with_extension("instructions.claude.md");
        assert_eq!(
            first,
            command(&[
                "claude",
                "--resume",
                "id",
                "--append-system-prompt-file",
                file.to_str().unwrap(),
                &format!("--add-dir={folder}")
            ])
        );
        assert!(server.is_empty());
        assert_eq!(
            std::fs::read_to_string(&file).unwrap(),
            "Marker rule\nsecond line"
        );
        assert_eq!(
            std::fs::metadata(&file).unwrap().permissions().mode() & 0o777,
            0o600
        );
        // A wake is the same call with the same pin: same arguments, same bytes.
        let (wake, _) = with_instructions(
            &claude,
            "claude",
            command(&["claude", "--resume", "id"]),
            Some(&pin),
        )
        .unwrap();
        assert_eq!(wake, first);

        let codex = AgentKey::new("w", &session, "codex").unwrap();
        let (argv, server) = with_instructions(
            &codex,
            "codex",
            command(&["codex", "resume", "thread"]),
            Some(&pin),
        )
        .unwrap();
        // The TUI gets nothing (it refuses --add-dir against the shared app-server); the
        // folders ride in the text the app-server hands to the thread.
        assert_eq!(argv, command(&["codex", "resume", "thread"]));
        assert_eq!(
            server,
            command(&[
                "-c",
                &format!(
                    "developer_instructions=\"Marker rule\\nsecond line\\n\\nReference folders you may read:\\n- {folder}\""
                )
            ])
        );

        for (provider, flag) in [("pi", "--append-system-prompt"), ("omp", "")] {
            let key = AgentKey::new("w", &session, provider).unwrap();
            let (argv, _) =
                with_instructions(&key, provider, command(&[provider]), Some(&pin)).unwrap();
            assert!(
                argv.iter()
                    .any(|arg| arg.starts_with("--append-system-prompt") || arg == flag),
                "{argv:?}"
            );
        }

        // Nothing pinned, or a provider without support: the command is untouched.
        let (argv, server) =
            with_instructions(&claude, "claude", command(&["claude"]), None).unwrap();
        assert_eq!((argv, server), (command(&["claude"]), vec![]));
        let other = AgentKey::new("w", &session, "opencode").unwrap();
        let (argv, _) =
            with_instructions(&other, "opencode", command(&["opencode"]), Some(&pin)).unwrap();
        assert_eq!(argv, command(&["opencode"]));
        for provider in ["claude", "pi", "omp"] {
            let _ = std::fs::remove_file(
                crate::native_ui::paths(&AgentKey::new("w", &session, provider).unwrap())
                    .unwrap()
                    .extension
                    .with_extension(format!("instructions.{provider}.md")),
            );
        }
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
    fn lost_attachment_reconnects_to_the_same_process_without_resize() {
        let adapter = adapter();
        let key = key();
        let _cleanup = RuntimeCleanup {
            adapter: &adapter,
            keys: vec![key.clone()],
        };
        let registration = AgentRegistration {
            key: key.clone(),
            provider_id: "fixture".into(),
            provider_session_id: Some("existing-conversation".into()),
            resumable: true,
            now_ms: now_millis(),
        };
        let first = adapter
            .attach_cli(
                registration.clone(),
                "/tmp",
                client("desktop"),
                132,
                40,
                Arc::new(|_, _| {}),
                Arc::new(|_, _| {}),
            )
            .unwrap();
        let daemon = crate::daemon::client().unwrap();
        daemon.detach(&terminal_key(&key)).unwrap(); // same attachment-end path as socket loss
        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        while adapter.snapshot(&key).unwrap().state != AgentState::Reconnecting {
            assert!(
                std::time::Instant::now() < deadline,
                "transport loss was not reconciled"
            );
            std::thread::sleep(Duration::from_millis(10));
        }
        assert!(adapter.runtime_alive(&key));
        let second = adapter
            .attach_cli(
                registration,
                "/tmp",
                client("phone"),
                40,
                12,
                Arc::new(|_, _| {}),
                Arc::new(|_, _| {}),
            )
            .unwrap();
        assert_eq!(
            second.handle.terminal.process_id,
            first.handle.terminal.process_id
        );
        let info = daemon.session(&terminal_key(&key)).unwrap().unwrap();
        assert_eq!((info.cols, info.rows), (132, 40));
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
    fn shared_input_requires_exact_attached_runtime_and_preserves_control_leases() {
        let providers = Arc::new(ProviderRegistry::empty());
        let mut manifest = fixture_manifest();
        manifest
            .launch
            .mode_overrides
            .get_mut(&AgentMode::Cli)
            .unwrap()
            .prefix_args = vec![
            "-c".into(),
            "while IFS= read -r line; do printf 'received_%s\\n' \"$line\"; done".into(),
        ];
        providers.register(manifest).unwrap();
        let adapter = AgentRuntimeAdapter::new(
            providers,
            Arc::new(AgentLifecycleRegistry::new()),
            Arc::new(AgentTerminalRegistry::new(Arc::new(|_| {}))),
        );
        let key = key();
        let _cleanup = RuntimeCleanup {
            adapter: &adapter,
            keys: vec![key.clone()],
        };
        let registration = AgentRegistration {
            key: key.clone(),
            provider_id: "fixture".into(),
            provider_session_id: Some("shared-test".into()),
            resumable: true,
            now_ms: now_millis(),
        };
        let desktop = client("desktop");
        let phone = client("phone");
        let first = adapter
            .attach_cli(
                registration.clone(),
                "/tmp",
                desktop.clone(),
                132,
                40,
                Arc::new(|_, _| {}),
                Arc::new(|_, _| {}),
            )
            .unwrap();
        let second = adapter
            .attach_cli(
                registration,
                "/tmp",
                phone.clone(),
                40,
                20,
                Arc::new(|_, _| {}),
                Arc::new(|_, _| {}),
            )
            .unwrap();
        assert_eq!(first.handle.terminal, second.handle.terminal);
        let input = adapter
            .acquire_control(&key, ControlChannel::Input, desktop.clone(), now_millis())
            .unwrap();
        let resize = adapter
            .acquire_control(&key, ControlChannel::Resize, desktop.clone(), now_millis())
            .unwrap();
        let id = &first.handle.terminal.terminal_id;
        let input_barrier = std::sync::Barrier::new(2);
        std::thread::scope(|scope| {
            let barrier = &input_barrier;
            let writes: Vec<_> = [(&phone, "phone\r"), (&desktop, "desktop\r")]
                .into_iter()
                .map(|(viewer, data)| {
                    let adapter = &adapter;
                    let key = &key;
                    scope.spawn(move || {
                        barrier.wait();
                        adapter
                            .input_from_view(key, id, viewer, data, now_millis())
                            .unwrap();
                    })
                })
                .collect();
            for write in writes {
                write.join().unwrap();
            }
        });
        let snapshot = adapter.snapshot(&key).unwrap();
        assert_eq!(snapshot.input_owner.unwrap().generation, input.generation);
        assert_eq!(snapshot.resize_owner.unwrap().generation, resize.generation);
        assert_eq!(adapter.terminals.size(&terminal_key(&key)), Some((132, 40)));
        assert!(adapter
            .input_from_view(&key, id, &client("stranger"), "BAD\r", now_millis())
            .is_err());
        assert!(adapter
            .input_from_view(&key, "old-terminal-id", &phone, "BAD\r", now_millis())
            .is_err());
        adapter
            .release_control(&key, ControlChannel::Resize, &desktop, resize.generation)
            .unwrap();
        let claim_barrier = std::sync::Barrier::new(2);
        let winners = std::thread::scope(|scope| {
            let barrier = &claim_barrier;
            let claims: Vec<_> = [&desktop, &phone]
                .into_iter()
                .map(|viewer| {
                    let adapter = &adapter;
                    let key = &key;
                    scope.spawn(move || {
                        barrier.wait();
                        adapter
                            .acquire_control_if_unowned(
                                key,
                                ControlChannel::Resize,
                                viewer.clone(),
                                now_millis(),
                            )
                            .unwrap()
                    })
                })
                .collect();
            claims
                .into_iter()
                .filter_map(|claim| claim.join().unwrap())
                .collect::<Vec<_>>()
        });
        assert_eq!(
            winners.len(),
            1,
            "simultaneous automatic claims must not steal from each other"
        );
        assert_eq!(
            adapter
                .snapshot(&key)
                .unwrap()
                .resize_owner
                .unwrap()
                .generation,
            winners[0].generation
        );
        assert_eq!(adapter.terminals.size(&terminal_key(&key)), Some((132, 40)));
        adapter.detach(&key, &phone).unwrap();
        assert!(adapter
            .input_from_view(&key, id, &phone, "BAD\r", now_millis())
            .is_err());
        let replay = adapter.active.lock().unwrap()[&key].replay.clone();
        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        while std::time::Instant::now() < deadline {
            let text = replay.lock().unwrap().text();
            if text.contains("received_desktop") && text.contains("received_phone") {
                break;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
        let text = replay.lock().unwrap().text();
        assert!(text.contains("received_phone"));
        assert!(text.contains("received_desktop"));
        assert!(!text.contains("BAD"));
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
    fn reconnect_without_a_surviving_shell_never_starts_a_replacement() {
        let adapter = adapter();
        adapter
            .providers
            .register(ProviderManifest::terminal())
            .unwrap();
        let key = key();
        let _cleanup = RuntimeCleanup {
            adapter: &adapter,
            keys: vec![key.clone()],
        };
        let registration = AgentRegistration {
            key: key.clone(),
            provider_id: crate::agent_fleet::TERMINAL_PROVIDER.into(),
            provider_session_id: None,
            resumable: false,
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
        assert!(adapter
            .attach_cli(
                registration,
                "/tmp",
                client("desktop"),
                80,
                24,
                Arc::new(|_, _| {}),
                Arc::new(|_, _| {}),
            )
            .is_err());
        assert!(!adapter.runtime_alive(&key));
        assert!(!crate::daemon::session_alive(&terminal_key(&key)));
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

    fn attached(adapter: &AgentRuntimeAdapter, key: &AgentKey) {
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
    }

    /// Mail writes only into a quiet PTY: any client's input (a person typing, a terminal's own
    /// reports) starts the window, a session never heard from counts as recent until the core is
    /// older than the window, and while it is not quiet the delivery closure is never called.
    #[test]
    fn mail_waits_for_a_quiet_pty_and_unknown_counts_as_recent() {
        let adapter = adapter();
        let key = key();
        let _cleanup = RuntimeCleanup {
            adapter: &adapter,
            keys: vec![key.clone()],
        };
        attached(&adapter, &key);
        let mail = client("mail");
        let window = Duration::from_millis(1500);
        // Nothing heard, and the core is younger than the window: unknown is recent. (An hour, so a
        // slow machine cannot age the core past it first.)
        let hour = Duration::from_secs(3600);
        assert!(!adapter.input_quiet_for(&key.session_id, hour));
        let mut called = false;
        assert!(adapter
            .dispatch_under_current_lease(&key, &mail, hour, |_| {
                called = true;
                Ok(())
            })
            .unwrap()
            .is_none());
        assert!(!called, "a PTY not known to be quiet gets no write");
        // A keystroke from any client restarts the window, however old the core is.
        let lease = adapter
            .acquire_control(&key, ControlChannel::Input, client("desktop"), 2)
            .unwrap();
        adapter
            .input(&key, &lease, "x", 3, Duration::from_millis(100))
            .unwrap();
        assert!(!adapter.input_quiet_for(&key.session_id, window));
        assert!(adapter
            .dispatch_under_current_lease(&key, &mail, window, |_| Ok(()))
            .unwrap()
            .is_none());
        std::thread::sleep(window);
        assert!(adapter
            .dispatch_under_current_lease(&key, &mail, window, |_| Ok(()))
            .unwrap()
            .is_some());
    }

    /// Delivery rides the holder's current lease and changes nothing about it: same client, same
    /// generation, no activity recorded for the holder, no observer added, and the write reaches the
    /// PTY under the holder's authority. With no holder the core's own client borrows the lease and
    /// gives it back, leaving no owner and no extra observer.
    #[test]
    fn delivery_under_a_held_lease_leaves_the_lease_untouched() {
        let adapter = adapter();
        let key = key();
        let _cleanup = RuntimeCleanup {
            adapter: &adapter,
            keys: vec![key.clone()],
        };
        attached(&adapter, &key);
        let mail = client("mail");
        let none = Duration::ZERO;
        // No holder: borrowed for the call, returned before the lock is released.
        let borrowed = std::cell::Cell::new(None);
        adapter
            .dispatch_under_current_lease(&key, &mail, none, |_| {
                borrowed.set(adapter.snapshot(&key).unwrap().input_owner);
                Ok(())
            })
            .unwrap()
            .unwrap();
        assert_eq!(borrowed.take().unwrap().client, mail);
        let after = adapter.snapshot(&key).unwrap();
        assert!(after.input_owner.is_none() && !after.observers.contains(&mail.id));

        // A view holds it.
        let holder = adapter
            .acquire_control(&key, ControlChannel::Input, client("desktop"), 2)
            .unwrap();
        let before = adapter.snapshot(&key).unwrap();
        let wrote = std::cell::Cell::new(false);
        adapter
            .dispatch_under_current_lease(&key, &mail, none, |write| {
                // Inside, the holder is still the owner at the same generation.
                let owner = adapter.snapshot(&key).unwrap().input_owner.unwrap();
                assert_eq!(
                    (owner.client, owner.generation),
                    (holder.client.clone(), holder.generation)
                );
                write("")?;
                wrote.set(true);
                Ok(())
            })
            .unwrap()
            .unwrap();
        assert!(wrote.get());
        let after = adapter.snapshot(&key).unwrap();
        let (a, b) = (before.input_owner.unwrap(), after.input_owner.unwrap());
        assert_eq!((a.client, a.generation), (b.client, b.generation));
        assert_eq!(before.observers, after.observers);
        assert_eq!(before.active_typing_until_ms, after.active_typing_until_ms);
        // The holder can still type with its own lease afterwards.
        adapter
            .input(&key, &holder, "y", 4, Duration::from_millis(100))
            .unwrap();
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
        // A failed turn snapshot (e.g. the project was removed) must not eat Enter.
        adapter
            .set_turn_boundary_listener(Arc::new(|_, _| anyhow::bail!("workspace is archived")))
            .unwrap();
        adapter
            .input(&key, &lease, "\r", 3, Duration::from_millis(100))
            .unwrap();
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

    #[test]
    fn osc_titles_drive_turns_for_agents_without_native_status() {
        let providers = Arc::new(ProviderRegistry::empty());
        let mut manifest = fixture_manifest();
        manifest.launch.mode_overrides.get_mut(&AgentMode::Cli).unwrap().prefix_args = vec![
            "-c".to_string(),
            r#"t() { printf '\033]0;%s\007' "$1"; }; t 'aider ready'; while IFS= read -r line; do case $line in go) t '⠋ aider';; ask) t 'aider - action required';; end) t 'aider ready';; esac; printf 'ack_%s\n' "$line"; done"#.to_string(),
        ];
        providers.register(manifest).unwrap();
        let adapter = AgentRuntimeAdapter::new(
            providers,
            Arc::new(AgentLifecycleRegistry::new()),
            Arc::new(AgentTerminalRegistry::new(Arc::new(|_| {}))),
        );
        let key = key();
        let _cleanup = RuntimeCleanup {
            adapter: &adapter,
            keys: vec![key.clone()],
        };
        adapter
            .attach_cli(
                AgentRegistration {
                    key: key.clone(),
                    provider_id: "fixture".into(),
                    provider_session_id: Some("provider-title".into()),
                    resumable: true,
                    now_ms: now_millis(),
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
            .acquire_control(&key, ControlChannel::Input, client("desktop"), now_millis())
            .unwrap();
        let wait_for = |state: AgentState| {
            let deadline = std::time::Instant::now() + Duration::from_secs(3);
            while adapter.snapshot(&key).unwrap().state != state
                && std::time::Instant::now() < deadline
            {
                std::thread::sleep(Duration::from_millis(10));
            }
            assert_eq!(adapter.snapshot(&key).unwrap().state, state);
        };
        let send = |line: &str| {
            adapter
                .input(
                    &key,
                    &lease,
                    &format!("{line}\r"),
                    now_millis(),
                    Duration::ZERO,
                )
                .unwrap()
        };
        // The startup title settles the launch; an Enter alone is no turn.
        wait_for(AgentState::Idle);
        assert!(adapter.has_title_status(&key.session_id));
        send("noop");
        let replay = adapter.active.lock().unwrap()[&key].replay.clone();
        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        while !replay.lock().unwrap().text().contains("ack_noop")
            && std::time::Instant::now() < deadline
        {
            std::thread::sleep(Duration::from_millis(10));
        }
        assert_eq!(adapter.snapshot(&key).unwrap().state, AgentState::Idle);
        send("go");
        wait_for(AgentState::Working);
        send("ask");
        wait_for(AgentState::Blocked);
        send("go");
        wait_for(AgentState::Working);
        send("end");
        wait_for(AgentState::Done);
        send("ask");
        wait_for(AgentState::Blocked);
    }
}

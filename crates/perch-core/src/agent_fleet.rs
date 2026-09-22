//! Provider manifests and the in-memory agent lifecycle boundary.
//!
//! This module deliberately stops at the boundary between the durable perch
//! model and a provider process.  It does not spawn a process, read a shell
//! command, or persist state itself.  A server adapter can use a
//! [`ProviderManifest`] to build an argv/env plan and use
//! [`AgentLifecycleRegistry`] to publish typed, workspace-scoped state.  The
//! separation is useful for two safety properties:
//!
//! * an additional CLI provider is data (a manifest), rather than another
//!   hard-coded branch in the project/session model; and
//! * an observer can never become an input writer accidentally.  Input and
//!   resize ownership are explicit leases with generations, so stale clients
//!   are rejected at the boundary before a byte reaches a terminal.
//!
//! Process execution, database persistence, and WebSocket protocol adapters
//! belong in their existing owning modules.  In particular, adding this file
//! does not change Claude/Codex runner behavior and does not claim to prove
//! real provider execution or restart recovery until an adapter wires those
//! paths together.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap, VecDeque};
use std::ffi::OsStr;
use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, RwLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Maximum number of manifests a registry will retain.  A provider manifest
/// is small, but it is still configuration received from outside the core.
pub const MAX_PROVIDERS: usize = 128;
/// Maximum number of agent records in one runtime registry.
pub const MAX_AGENTS: usize = 512;
/// Maximum number of recent lifecycle transitions retained per agent.
pub const MAX_TRANSITION_HISTORY: usize = 64;
/// Maximum length of a provider/id/display-name token.
pub const MAX_IDENTIFIER_LENGTH: usize = 256;
/// Maximum length of one argv or environment token.
pub const MAX_TOKEN_LENGTH: usize = 4096;
/// Maximum number of fixed arguments in a provider manifest.
pub const MAX_FIXED_ARGUMENTS: usize = 128;
/// Maximum number of explicitly configured environment variables.
pub const MAX_ENVIRONMENT_VARIABLES: usize = 64;
/// Maximum number of distinct connected clients retained per agent.
pub const MAX_OBSERVERS: usize = 128;
const LEGACY_GUARD_CLIENT: &str = "__legacy_guard__";

/// Current wall-clock time in milliseconds, suitable for persisted lifecycle
/// timestamps.  Callers that need deterministic behavior should pass their
/// own timestamp to the mutating APIs instead.
pub fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(u128::from(u64::MAX)) as u64
}

fn initial_snapshot_revision() -> u64 {
    1
}

// ---------------------------------------------------------------------------
// Provider manifests and safe launch plans
// ---------------------------------------------------------------------------

/// A view in which a provider can run.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Ord, PartialOrd, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentMode {
    Hosted,
    Cli,
}

/// Capabilities advertised by a provider manifest.  These describe behavior
/// available to the adapter; they do not grant the provider access to a
/// workspace by themselves.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Ord, PartialOrd, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProviderCapability {
    Streaming,
    InteractiveTerminal,
    Resume,
    PlanMode,
    Attachments,
    ReadOnly,
    StatusEvents,
}

/// How a provider preserves continuity across process invocations.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Resumability {
    /// The provider has no known continuation identity.  A wake must create
    /// a fresh provider session and the UI should explain that choice.
    Unsupported,
    /// The provider owns a stable session/thread identity that can be passed
    /// back on the next launch.
    ProviderSession,
    /// The provider process is kept alive by an external supervisor such as
    /// tmux and can be reattached without a provider session token.
    PersistentProcess,
}

impl Resumability {
    pub fn is_resumable(self) -> bool {
        !matches!(self, Self::Unsupported)
    }
}

/// Where the user prompt is transported.  It is intentionally an enum rather
/// than a shell template: the adapter always receives separate argv tokens.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PromptTransport {
    /// Append the prompt as one positional argv token after the fixed
    /// arguments.  The builder emits an explicit `--` immediately before this
    /// dynamic value unless the fixed arguments already end with `--`.  This
    /// keeps a prompt such as `--help` from being interpreted as another
    /// provider option.
    Argument,
    /// Pass the prompt as the value of an option in `prefix_args` (for
    /// example Claude's `-p`/`--print`).  The prompt is placed immediately
    /// after the prefix, before the remaining fixed options, so an option
    /// parser consumes even a leading-hyphen prompt as its value.  This is
    /// useful for providers whose prompt option is not a positional argument.
    OptionValue,
    /// Send the prompt to stdin after the process starts.
    Stdin,
}

/// How a provider accepts a continuation identity.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResumePlacement {
    Unsupported,
    /// Append `flag` and the opaque provider token as two argv entries.
    Flag {
        flag: String,
    },
    /// Append the opaque provider token as one positional argv entry.
    Positional,
}

impl ResumePlacement {
    fn is_supported(&self) -> bool {
        !matches!(self, Self::Unsupported)
    }
}

/// A fixed, shell-free launch recipe.  `prefix_args` and `suffix_args` are
/// already tokenized; dynamic values are appended as individual tokens by
/// [`LaunchSpec::build`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LaunchSpec {
    /// Executable name or configured absolute path.  This is never passed to
    /// a shell.
    pub executable: String,
    /// Fixed argv tokens before the optional prompt.
    pub prefix_args: Vec<String>,
    /// How a prompt is sent, if the adapter supplies one.
    pub prompt: PromptTransport,
    /// Fixed argv tokens after the optional prompt and before resume args.
    pub suffix_args: Vec<String>,
    /// Fixed argv tokens inserted only when a continuation identity is
    /// supplied.  Codex uses this for its `resume` subcommand.
    #[serde(default)]
    pub resume_prefix_args: Vec<String>,
    /// Optional provider continuation argument.
    pub resume: ResumePlacement,
    /// Optional mode-specific recipes.  When absent, the base recipe applies
    /// to that mode.  Built-in providers use explicit CLI recipes so an
    /// interactive attach can never accidentally launch the hosted JSON
    /// command.
    #[serde(default)]
    pub mode_overrides: BTreeMap<AgentMode, ModeLaunchSpec>,
}

/// A complete mode-specific recipe.  It intentionally has no shell/template
/// fields; the same validation and tokenization rules apply as for the base
/// [`LaunchSpec`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModeLaunchSpec {
    pub executable: String,
    pub prefix_args: Vec<String>,
    pub prompt: PromptTransport,
    pub suffix_args: Vec<String>,
    #[serde(default)]
    pub resume_prefix_args: Vec<String>,
    pub resume: ResumePlacement,
}

impl ModeLaunchSpec {
    fn validate(&self) -> Result<(), ManifestError> {
        validate_executable(&self.executable).map_err(ManifestError::InvalidArgument)?;
        validate_argument_lists(
            &self.prefix_args,
            &self.suffix_args,
            &self.resume_prefix_args,
        )?;
        validate_resume_placement(&self.resume)?;
        Ok(())
    }

    fn as_launch_spec(&self) -> LaunchSpec {
        LaunchSpec {
            executable: self.executable.clone(),
            prefix_args: self.prefix_args.clone(),
            prompt: self.prompt,
            suffix_args: self.suffix_args.clone(),
            resume_prefix_args: self.resume_prefix_args.clone(),
            resume: self.resume.clone(),
            mode_overrides: BTreeMap::new(),
        }
    }
}

impl LaunchSpec {
    fn validate(&self) -> Result<(), ManifestError> {
        validate_executable(&self.executable).map_err(ManifestError::InvalidArgument)?;
        if self.prefix_args.len() > MAX_FIXED_ARGUMENTS
            || self.suffix_args.len() > MAX_FIXED_ARGUMENTS
            || self.resume_prefix_args.len() > MAX_FIXED_ARGUMENTS
        {
            return Err(ManifestError::TooManyArguments);
        }
        for arg in self
            .prefix_args
            .iter()
            .chain(self.suffix_args.iter())
            .chain(self.resume_prefix_args.iter())
        {
            validate_token(arg).map_err(ManifestError::InvalidArgument)?;
        }
        validate_resume_placement(&self.resume)?;
        Ok(())
    }

    /// Build a process plan without invoking anything.  The resulting argv is
    /// safe to pass directly to `std::process::Command` or Tokio's equivalent.
    pub fn build<'a>(&self, request: LaunchRequest<'a>) -> Result<CommandPlan, LaunchError> {
        self.validate().map_err(LaunchError::InvalidManifest)?;
        validate_path(request.cwd).map_err(LaunchError::InvalidInput)?;
        // The mode is selected by `ProviderManifest::build_launch`; retaining
        // it on the request keeps direct `LaunchSpec` callers explicit even
        // though a bare recipe has no mode allowlist to enforce.
        let _mode = request.mode;

        let mut args = self.prefix_args.clone();
        let mut stdin = None;

        // Keep the prompt's placement explicit.  Positional prompts go after
        // every fixed/resume option and are protected by `--`; option values
        // stay beside the option that consumes them; stdin prompts never
        // enter argv at all.
        match (self.prompt, request.prompt) {
            (PromptTransport::OptionValue, Some(prompt)) => {
                validate_token(prompt).map_err(LaunchError::InvalidInput)?;
                args.push(prompt.to_string());
                args.extend(self.suffix_args.iter().cloned());
            }
            (PromptTransport::OptionValue, None) => {
                args.extend(self.suffix_args.iter().cloned());
            }
            (PromptTransport::Argument, _) | (PromptTransport::Stdin, None) => {
                args.extend(self.suffix_args.iter().cloned());
            }
            (PromptTransport::Stdin, Some(prompt)) => {
                validate_token(prompt).map_err(LaunchError::InvalidInput)?;
                args.extend(self.suffix_args.iter().cloned());
                stdin = Some(prompt.to_string());
            }
        }

        if let Some(provider_session_id) = request.provider_session_id {
            validate_provider_session_id(provider_session_id).map_err(LaunchError::InvalidInput)?;
            args.extend(self.resume_prefix_args.iter().cloned());
            match &self.resume {
                ResumePlacement::Unsupported => return Err(LaunchError::ResumeUnsupported),
                ResumePlacement::Flag { flag } => {
                    args.push(flag.clone());
                    args.push(provider_session_id.to_string());
                }
                ResumePlacement::Positional => args.push(provider_session_id.to_string()),
            }
        }

        if self.prompt == PromptTransport::Argument {
            if let Some(prompt) = request.prompt {
                validate_token(prompt).map_err(LaunchError::InvalidInput)?;
                if args.last().is_none_or(|arg| arg != "--") {
                    args.push("--".to_string());
                }
                args.push(prompt.to_string());
            }
        }

        Ok(CommandPlan {
            executable: PathBuf::from(&self.executable),
            args,
            cwd: request.cwd.to_path_buf(),
            stdin,
        })
    }
}

/// Inputs used when a server adapter requests a provider launch plan.
pub struct LaunchRequest<'a> {
    pub cwd: &'a Path,
    pub mode: AgentMode,
    pub prompt: Option<&'a str>,
    pub provider_session_id: Option<&'a str>,
}

impl<'a> LaunchRequest<'a> {
    pub fn new(cwd: &'a Path, mode: AgentMode, prompt: Option<&'a str>) -> Self {
        Self {
            cwd,
            mode,
            prompt,
            provider_session_id: None,
        }
    }

    pub fn with_provider_session(mut self, provider_session_id: &'a str) -> Self {
        self.provider_session_id = Some(provider_session_id);
        self
    }
}

/// A launch plan returned after manifest validation.  No process is started;
/// the owning runtime chooses how to apply `stdin` and invoke the argv.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandPlan {
    pub executable: PathBuf,
    pub args: Vec<String>,
    pub cwd: PathBuf,
    pub stdin: Option<String>,
}

/// Which output/status source the provider adapter should listen to.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum StatusDetection {
    /// The provider emits structured lifecycle records.  The adapter should
    /// translate those records into [`ProviderSignal`] values.
    EventStream,
    /// Process exit status is the only reliable completion signal.
    ExitStatus,
    /// A bounded set of plain-text markers may indicate a waiting prompt.
    OutputPatterns {
        blocked: Vec<String>,
        done: Vec<String>,
    },
}

impl StatusDetection {
    fn validate(&self) -> Result<(), ManifestError> {
        if let Self::OutputPatterns { blocked, done } = self {
            if blocked.len() + done.len() > 128 {
                return Err(ManifestError::TooManyStatusPatterns);
            }
            for pattern in blocked.iter().chain(done.iter()) {
                if pattern.is_empty() {
                    return Err(ManifestError::InvalidStatusPattern(
                        "empty status pattern".into(),
                    ));
                }
                validate_token(pattern).map_err(ManifestError::InvalidStatusPattern)?;
            }
        }
        Ok(())
    }
}

/// A constrained environment policy.  It records intent for the process
/// adapter; it never parses or evaluates shell syntax.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EnvironmentPolicy {
    /// If false, the adapter should call `env_clear()` before applying `set`.
    pub inherit: bool,
    /// Names allowed to be copied from the parent environment.  This is an
    /// allowlist rather than an arbitrary child-provided environment blob.
    pub allow: BTreeSet<String>,
    /// Explicit values to set.  These are validated as plain key/value pairs.
    pub set: BTreeMap<String, String>,
    /// Names to remove after inheritance and before launch.
    pub unset: BTreeSet<String>,
}

impl Default for EnvironmentPolicy {
    fn default() -> Self {
        Self {
            inherit: true,
            allow: BTreeSet::new(),
            set: BTreeMap::new(),
            unset: BTreeSet::new(),
        }
    }
}

impl EnvironmentPolicy {
    fn validate(&self) -> Result<(), ManifestError> {
        if self.allow.len() + self.set.len() + self.unset.len() > MAX_ENVIRONMENT_VARIABLES {
            return Err(ManifestError::TooManyEnvironmentVariables);
        }
        for name in self
            .allow
            .iter()
            .chain(self.set.keys())
            .chain(self.unset.iter())
        {
            validate_env_name(name)?;
        }
        for value in self.set.values() {
            validate_token(value).map_err(ManifestError::InvalidEnvironmentValue)?;
        }
        Ok(())
    }
}

/// A provider's immutable description.  All fields are public so a manifest
/// can be loaded from a settings/host adapter without coupling that adapter
/// to this module's constructors.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProviderManifest {
    pub id: String,
    pub display_name: String,
    pub launch: LaunchSpec,
    pub supported_modes: BTreeSet<AgentMode>,
    pub resumability: Resumability,
    pub capabilities: BTreeSet<ProviderCapability>,
    pub status_detection: StatusDetection,
    pub environment: EnvironmentPolicy,
}

impl ProviderManifest {
    /// The existing Claude provider expressed as data.  The existing runner
    /// remains authoritative for actual flag ordering and stream parsing;
    /// this recipe is for generic CLI/terminal adapters.
    pub fn claude() -> Self {
        Self {
            id: "claude".to_string(),
            display_name: "Claude Code".to_string(),
            launch: LaunchSpec {
                executable: "claude".to_string(),
                prefix_args: vec!["-p".to_string()],
                prompt: PromptTransport::OptionValue,
                suffix_args: vec![
                    "--output-format".to_string(),
                    "stream-json".to_string(),
                    "--verbose".to_string(),
                    "--include-partial-messages".to_string(),
                ],
                resume_prefix_args: Vec::new(),
                resume: ResumePlacement::Flag {
                    flag: "--resume".to_string(),
                },
                mode_overrides: [(
                    AgentMode::Cli,
                    ModeLaunchSpec {
                        executable: "claude".to_string(),
                        prefix_args: Vec::new(),
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
            supported_modes: [AgentMode::Hosted, AgentMode::Cli].into_iter().collect(),
            resumability: Resumability::ProviderSession,
            capabilities: [
                ProviderCapability::Streaming,
                ProviderCapability::InteractiveTerminal,
                ProviderCapability::Resume,
                ProviderCapability::PlanMode,
                ProviderCapability::Attachments,
                ProviderCapability::StatusEvents,
            ]
            .into_iter()
            .collect(),
            status_detection: StatusDetection::EventStream,
            environment: EnvironmentPolicy::default(),
        }
    }

    /// The existing Codex provider expressed as data.  Hosted turns still use
    /// a fresh `exec` process, while the interactive CLI exposes a stable
    /// thread id accepted by `codex resume`; the runtime adapter supplies that
    /// identity only for CLI attaches.
    pub fn codex() -> Self {
        Self {
            id: "codex".to_string(),
            display_name: "Codex".to_string(),
            launch: LaunchSpec {
                executable: "codex".to_string(),
                prefix_args: vec![
                    "exec".to_string(),
                    "--json".to_string(),
                    "--skip-git-repo-check".to_string(),
                ],
                prompt: PromptTransport::Argument,
                suffix_args: Vec::new(),
                resume_prefix_args: Vec::new(),
                resume: ResumePlacement::Unsupported,
                mode_overrides: [(
                    AgentMode::Cli,
                    ModeLaunchSpec {
                        executable: "codex".to_string(),
                        prefix_args: Vec::new(),
                        prompt: PromptTransport::Stdin,
                        suffix_args: Vec::new(),
                        resume_prefix_args: vec!["resume".to_string()],
                        resume: ResumePlacement::Positional,
                    },
                )]
                .into_iter()
                .collect(),
            },
            supported_modes: [AgentMode::Hosted, AgentMode::Cli].into_iter().collect(),
            resumability: Resumability::ProviderSession,
            capabilities: [
                ProviderCapability::Streaming,
                ProviderCapability::InteractiveTerminal,
                ProviderCapability::Resume,
                ProviderCapability::PlanMode,
                ProviderCapability::ReadOnly,
                ProviderCapability::StatusEvents,
            ]
            .into_iter()
            .collect(),
            status_detection: StatusDetection::EventStream,
            environment: EnvironmentPolicy::default(),
        }
    }

    /// The installed OMP CLI retains its own configuration, tools, and TUI.
    pub fn omp() -> Self {
        Self::interactive_cli("omp", "OMP", "--resume")
    }

    pub fn pi() -> Self {
        // Pi's --resume opens a picker; --session takes the exact file/id.
        Self::interactive_cli("pi", "Pi", "--session")
    }

    pub fn opencode() -> Self {
        Self::interactive_cli("opencode", "OpenCode", "--session")
    }

    fn interactive_cli(id: &str, display_name: &str, resume_flag: &str) -> Self {
        Self {
            id: id.into(),
            display_name: display_name.into(),
            launch: LaunchSpec {
                executable: id.into(),
                prefix_args: Vec::new(),
                prompt: PromptTransport::Stdin,
                suffix_args: Vec::new(),
                resume_prefix_args: Vec::new(),
                resume: ResumePlacement::Flag {
                    flag: resume_flag.into(),
                },
                mode_overrides: BTreeMap::new(),
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

    pub fn validate(&self) -> Result<(), ManifestError> {
        validate_identifier(&self.id).map_err(ManifestError::InvalidId)?;
        validate_identifier(&self.display_name).map_err(ManifestError::InvalidDisplayName)?;
        if self.supported_modes.is_empty() {
            return Err(ManifestError::NoSupportedModes);
        }
        self.launch.validate()?;
        for (mode, recipe) in &self.launch.mode_overrides {
            if !self.supported_modes.contains(mode) {
                return Err(ManifestError::ModeRecipeUnsupported(*mode));
            }
            recipe.validate()?;
        }
        self.status_detection.validate()?;
        self.environment.validate()?;
        if self.capabilities.contains(&ProviderCapability::Resume)
            && !self.resumability.is_resumable()
        {
            return Err(ManifestError::ResumeCapabilityMismatch);
        }
        // A provider may expose resumability only in one of its mode
        // recipes. Codex is the built-in example: Hosted launches are fresh
        // `exec` calls, while the interactive CLI recipe resumes a thread.
        // Validate the provider-level resumability declaration against every
        // supported mode instead of requiring the base (usually Hosted)
        // recipe to carry a resume flag. `build_launch` still checks the
        // selected mode's recipe, so a Hosted caller cannot accidentally use
        // the CLI continuation strategy.
        let has_resumable_mode = self.supported_modes.iter().any(|mode| {
            self.launch
                .mode_overrides
                .get(mode)
                .map_or(self.launch.resume.is_supported(), |recipe| {
                    recipe.resume.is_supported()
                })
        });
        if matches!(self.resumability, Resumability::ProviderSession) && !has_resumable_mode {
            return Err(ManifestError::ResumabilityWithoutLaunchStrategy);
        }
        Ok(())
    }

    /// Whether this provider's declared resumability is actually available in
    /// `mode`. Resume placement belongs to the selected launch recipe: a
    /// provider may be resumable for its interactive CLI while its Hosted
    /// recipe intentionally starts a fresh one-shot process.
    pub fn supports_resume(&self, mode: AgentMode) -> bool {
        self.supported_modes.contains(&mode)
            && self.resumability.is_resumable()
            && self
                .launch
                .mode_overrides
                .get(&mode)
                .map_or(self.launch.resume.is_supported(), |recipe| {
                    recipe.resume.is_supported()
                })
    }

    /// Whether one capability is available in the selected mode.  The
    /// manifest's capability set is a provider-wide compatibility field for
    /// older callers; resume is deliberately filtered through the selected
    /// recipe so a provider such as Codex cannot advertise Hosted resume just
    /// because its CLI recipe accepts `resume <thread>`.
    pub fn supports_capability(&self, mode: AgentMode, capability: ProviderCapability) -> bool {
        self.supported_modes.contains(&mode)
            && match capability {
                ProviderCapability::Resume => self.supports_resume(mode),
                capability => self.capabilities.contains(&capability),
            }
    }

    /// Build a launch plan while retaining the provider's mode allowlist.
    pub fn build_launch<'a>(
        &self,
        cwd: &'a Path,
        mode: AgentMode,
        prompt: Option<&'a str>,
        provider_session_id: Option<&'a str>,
    ) -> Result<CommandPlan, LaunchError> {
        self.validate().map_err(LaunchError::InvalidManifest)?;
        if !self.supported_modes.contains(&mode) {
            return Err(LaunchError::UnsupportedMode(mode));
        }
        let request = LaunchRequest {
            cwd,
            mode,
            prompt,
            provider_session_id,
        };
        match self.launch.mode_overrides.get(&mode) {
            Some(recipe) => recipe.as_launch_spec().build(request),
            None => self.launch.build(request),
        }
    }
}

/// Provider availability after resolving an executable on a supplied PATH.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderAvailability {
    pub provider_id: String,
    pub display_name: String,
    pub executable: Option<PathBuf>,
    pub reason: Option<String>,
}

impl ProviderAvailability {
    pub fn available(&self) -> bool {
        self.executable.is_some()
    }
}

/// Registry of immutable provider manifests.  It is thread-safe because the
/// eventual server adapter can share one instance across connection tasks.
pub struct ProviderRegistry {
    manifests: RwLock<HashMap<String, ProviderManifest>>,
}

impl ProviderRegistry {
    /// Construct the native provider registry and validate every built-in
    /// manifest before it is exposed to the server.  Boot uses this fallible
    /// constructor so a future manifest edit produces a startup error instead
    /// of an `expect` panic after the listener has already been created.
    pub fn native() -> Result<Self, RegistryError> {
        let registry = Self::empty();
        for entry in crate::agent_catalog::entries()? {
            registry.register(entry.manifest())?;
        }
        Ok(registry)
    }

    /// Start with the built-in CLI providers. Kept as a
    /// convenient infallible API for tests and callers that want the built-in
    /// constants' invariant, while [`Self::native`] is used at boot.
    pub fn new() -> Self {
        Self::native().expect("built-in provider manifests are valid")
    }

    pub fn empty() -> Self {
        Self {
            manifests: RwLock::new(HashMap::new()),
        }
    }

    pub fn register(&self, manifest: ProviderManifest) -> Result<(), RegistryError> {
        manifest
            .validate()
            .map_err(RegistryError::InvalidManifest)?;
        let mut manifests = self.manifests.write().unwrap();
        if manifests.len() >= MAX_PROVIDERS {
            return Err(RegistryError::Capacity);
        }
        if manifests.contains_key(&manifest.id) {
            return Err(RegistryError::Duplicate(manifest.id));
        }
        manifests.insert(manifest.id.clone(), manifest);
        Ok(())
    }

    pub fn get(&self, provider_id: &str) -> Option<ProviderManifest> {
        self.manifests.read().unwrap().get(provider_id).cloned()
    }

    pub fn contains(&self, provider_id: &str) -> bool {
        self.manifests.read().unwrap().contains_key(provider_id)
    }

    /// Keep built-ins in catalog order, followed by configured providers.
    pub fn list(&self) -> Vec<ProviderManifest> {
        let mut manifests: Vec<_> = self.manifests.read().unwrap().values().cloned().collect();
        let catalog = crate::agent_catalog::entries().unwrap_or_default();
        // ponytail: linear rank lookup for 36 built-ins; precompute ranks if
        // the bounded catalog grows enough to make picker refresh measurable.
        manifests.sort_by_key(|manifest| {
            (
                catalog
                    .iter()
                    .position(|entry| entry.id == manifest.id)
                    .unwrap_or(usize::MAX),
                manifest.id.clone(),
            )
        });
        manifests
    }

    /// Register externally supplied manifests and report whether their
    /// executables are installed.  The caller can load these descriptors from
    /// settings or another discovery source; no project/session code changes
    /// when a new provider is added.
    pub fn discover_configured<I>(
        &self,
        manifests: I,
        search_path: Option<&OsStr>,
    ) -> Result<Vec<ProviderAvailability>, RegistryError>
    where
        I: IntoIterator<Item = ProviderManifest>,
    {
        // Stage at most the remaining registry capacity.  Apart from keeping
        // this adapter bounded, staging before insertion means a duplicate or
        // invalid descriptor cannot leave a partially registered batch.
        let remaining = MAX_PROVIDERS.saturating_sub(self.manifests.read().unwrap().len());
        let mut staged = Vec::with_capacity(remaining);
        let mut staged_ids = BTreeSet::new();
        for (index, manifest) in manifests.into_iter().enumerate() {
            if index >= remaining {
                return Err(RegistryError::Capacity);
            }
            manifest
                .validate()
                .map_err(RegistryError::InvalidManifest)?;
            if self.contains(&manifest.id) || !staged_ids.insert(manifest.id.clone()) {
                return Err(RegistryError::Duplicate(manifest.id.clone()));
            }
            staged.push(manifest);
        }

        let mut availability = Vec::with_capacity(staged.len());
        for manifest in &staged {
            let executable = resolve_executable(&manifest.launch.executable, search_path).ok();
            let reason = executable.is_none().then(|| {
                format!(
                    "executable `{}` is not available on the configured PATH",
                    manifest.launch.executable
                )
            });
            let provider_id = manifest.id.clone();
            let display_name = manifest.display_name.clone();
            availability.push(ProviderAvailability {
                provider_id,
                display_name,
                executable,
                reason,
            });
        }

        // Recheck under the write lock in case another adapter registered a
        // provider while executables were being resolved.  The batch remains
        // all-or-nothing from this registry's perspective.
        let mut registered = self.manifests.write().unwrap();
        if registered.len() + staged.len() > MAX_PROVIDERS {
            return Err(RegistryError::Capacity);
        }
        for manifest in &staged {
            if registered.contains_key(&manifest.id) {
                return Err(RegistryError::Duplicate(manifest.id.clone()));
            }
        }
        for manifest in staged {
            registered.insert(manifest.id.clone(), manifest);
        }
        Ok(availability)
    }

    pub fn resolve_executable(
        &self,
        provider_id: &str,
        search_path: Option<&OsStr>,
    ) -> Result<PathBuf, RegistryError> {
        let manifest = self
            .get(provider_id)
            .ok_or_else(|| RegistryError::UnknownProvider(provider_id.to_string()))?;
        resolve_executable(&manifest.launch.executable, search_path)
            .map_err(RegistryError::ExecutableUnavailable)
    }

    pub fn build_launch<'a>(
        &self,
        provider_id: &str,
        cwd: &'a Path,
        mode: AgentMode,
        prompt: Option<&'a str>,
        provider_session_id: Option<&'a str>,
    ) -> Result<CommandPlan, LaunchError> {
        let manifest = self
            .get(provider_id)
            .ok_or_else(|| LaunchError::UnknownProvider(provider_id.to_string()))?;
        manifest.build_launch(cwd, mode, prompt, provider_session_id)
    }

    /// Query a provider capability after applying its mode-specific recipe.
    pub fn supports_capability(
        &self,
        provider_id: &str,
        mode: AgentMode,
        capability: ProviderCapability,
    ) -> Result<bool, RegistryError> {
        let manifest = self
            .get(provider_id)
            .ok_or_else(|| RegistryError::UnknownProvider(provider_id.to_string()))?;
        Ok(manifest.supports_capability(mode, capability))
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Resolve an executable without invoking a shell or the `which` command.
/// `search_path` is injectable for deterministic tests and isolated hosts;
/// `None` uses the current process's PATH.
pub fn resolve_executable(
    executable: &str,
    search_path: Option<&OsStr>,
) -> Result<PathBuf, ExecutableError> {
    validate_executable(executable).map_err(ExecutableError::Invalid)?;
    let candidate = Path::new(executable);
    if candidate.is_absolute() || executable.contains('/') || executable.contains('\\') {
        return executable_candidate(candidate);
    }

    let path_value = search_path
        .map(OsStr::to_os_string)
        .or_else(|| std::env::var_os("PATH"))
        .ok_or(ExecutableError::MissingPath)?;
    for directory in std::env::split_paths(&path_value) {
        let candidate = directory.join(executable);
        if is_executable_file(&candidate) {
            return Ok(fs::canonicalize(&candidate).unwrap_or(candidate));
        }
    }
    Err(ExecutableError::NotFound(executable.to_string()))
}

fn executable_candidate(candidate: &Path) -> Result<PathBuf, ExecutableError> {
    if !is_executable_file(candidate) {
        return Err(ExecutableError::NotFound(candidate.display().to_string()));
    }
    Ok(fs::canonicalize(candidate).unwrap_or_else(|_| candidate.to_path_buf()))
}

fn is_executable_file(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

fn validate_path(path: &Path) -> Result<(), String> {
    if path.as_os_str().is_empty() {
        return Err("working directory is empty".to_string());
    }
    if path.to_string_lossy().contains('\0') {
        return Err("working directory contains NUL".to_string());
    }
    Ok(())
}

fn validate_identifier(value: &str) -> Result<(), String> {
    if value.is_empty() {
        return Err("value is empty".to_string());
    }
    if value.len() > MAX_IDENTIFIER_LENGTH {
        return Err(format!("value exceeds {MAX_IDENTIFIER_LENGTH} bytes"));
    }
    if value.chars().any(|ch| ch.is_control()) {
        return Err("value contains a control character".to_string());
    }
    Ok(())
}

fn validate_token(value: &str) -> Result<(), String> {
    if value.len() > MAX_TOKEN_LENGTH {
        return Err(format!("token exceeds {MAX_TOKEN_LENGTH} bytes"));
    }
    if value.contains('\0') {
        return Err("token contains NUL".to_string());
    }
    Ok(())
}

fn validate_provider_session_id(value: &str) -> Result<(), String> {
    if value.is_empty() {
        return Err("provider session id is empty".to_string());
    }
    validate_token(value)
}

fn validate_argument_lists(
    prefix_args: &[String],
    suffix_args: &[String],
    resume_prefix_args: &[String],
) -> Result<(), ManifestError> {
    if prefix_args.len() > MAX_FIXED_ARGUMENTS
        || suffix_args.len() > MAX_FIXED_ARGUMENTS
        || resume_prefix_args.len() > MAX_FIXED_ARGUMENTS
    {
        return Err(ManifestError::TooManyArguments);
    }
    for arg in prefix_args
        .iter()
        .chain(suffix_args.iter())
        .chain(resume_prefix_args.iter())
    {
        validate_token(arg).map_err(ManifestError::InvalidArgument)?;
    }
    Ok(())
}

fn validate_resume_placement(resume: &ResumePlacement) -> Result<(), ManifestError> {
    if let ResumePlacement::Flag { flag } = resume {
        validate_token(flag).map_err(ManifestError::InvalidArgument)?;
        if !flag.starts_with('-') {
            return Err(ManifestError::InvalidResumeFlag);
        }
    }
    Ok(())
}

fn validate_executable(value: &str) -> Result<(), String> {
    validate_token(value)?;
    if value.is_empty() || value.starts_with('-') {
        return Err("executable must be a non-empty program name or path".to_string());
    }
    if value.chars().any(|ch| {
        ch.is_control() || ch.is_whitespace() || matches!(ch, ';' | '|' | '&' | '$' | '`')
    }) {
        return Err("executable contains shell syntax or whitespace".to_string());
    }
    Ok(())
}

fn validate_env_name(value: &str) -> Result<(), ManifestError> {
    if value.is_empty()
        || value.len() > MAX_IDENTIFIER_LENGTH
        || !value
            .bytes()
            .next()
            .is_some_and(|byte| byte == b'_' || byte.is_ascii_alphabetic())
        || !value
            .bytes()
            .all(|byte| byte == b'_' || byte.is_ascii_alphanumeric())
    {
        return Err(ManifestError::InvalidEnvironmentName(value.to_string()));
    }
    Ok(())
}

/// Errors found while validating a provider descriptor.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ManifestError {
    InvalidId(String),
    InvalidDisplayName(String),
    InvalidArgument(String),
    InvalidResumeFlag,
    InvalidStatusPattern(String),
    InvalidEnvironmentName(String),
    InvalidEnvironmentValue(String),
    NoSupportedModes,
    TooManyArguments,
    TooManyStatusPatterns,
    TooManyEnvironmentVariables,
    ResumeCapabilityMismatch,
    ResumabilityWithoutLaunchStrategy,
    ModeRecipeUnsupported(AgentMode),
}

impl fmt::Display for ManifestError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidId(reason) => write!(f, "invalid provider id: {reason}"),
            Self::InvalidDisplayName(reason) => {
                write!(f, "invalid provider display name: {reason}")
            }
            Self::InvalidArgument(reason) => write!(f, "invalid provider argument: {reason}"),
            Self::InvalidResumeFlag => write!(f, "resume flag must start with '-'"),
            Self::InvalidStatusPattern(reason) => write!(f, "invalid status pattern: {reason}"),
            Self::InvalidEnvironmentName(name) => write!(f, "invalid environment name `{name}`"),
            Self::InvalidEnvironmentValue(reason) => {
                write!(f, "invalid environment value: {reason}")
            }
            Self::NoSupportedModes => write!(f, "provider has no supported modes"),
            Self::TooManyArguments => write!(f, "provider has too many fixed arguments"),
            Self::TooManyStatusPatterns => write!(f, "provider has too many status patterns"),
            Self::TooManyEnvironmentVariables => {
                write!(f, "provider has too many environment variables")
            }
            Self::ResumeCapabilityMismatch => {
                write!(f, "resume capability requires a resumable provider")
            }
            Self::ResumabilityWithoutLaunchStrategy => {
                write!(f, "resumability requires a resume launch strategy")
            }
            Self::ModeRecipeUnsupported(mode) => {
                write!(f, "launch recipe is present for unsupported {mode:?} mode")
            }
        }
    }
}

impl std::error::Error for ManifestError {}

/// Executable resolution failures.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExecutableError {
    Invalid(String),
    MissingPath,
    NotFound(String),
}

impl fmt::Display for ExecutableError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Invalid(reason) => write!(f, "invalid executable: {reason}"),
            Self::MissingPath => write!(f, "PATH is unavailable"),
            Self::NotFound(name) => write!(f, "executable `{name}` was not found"),
        }
    }
}

impl std::error::Error for ExecutableError {}

/// Registry failures.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RegistryError {
    InvalidManifest(ManifestError),
    Duplicate(String),
    Capacity,
    UnknownProvider(String),
    ExecutableUnavailable(ExecutableError),
    Catalog(String),
}

impl fmt::Display for RegistryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidManifest(error) => error.fmt(f),
            Self::Duplicate(id) => write!(f, "provider `{id}` is already registered"),
            Self::Capacity => write!(f, "provider registry capacity reached"),
            Self::UnknownProvider(id) => write!(f, "unknown provider `{id}`"),
            Self::ExecutableUnavailable(error) => error.fmt(f),
            Self::Catalog(error) => write!(f, "provider catalog is unreadable: {error}"),
        }
    }
}

impl std::error::Error for RegistryError {}

/// Launch-plan failures.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LaunchError {
    UnknownProvider(String),
    InvalidManifest(ManifestError),
    UnsupportedMode(AgentMode),
    ResumeUnsupported,
    InvalidInput(String),
}

impl fmt::Display for LaunchError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnknownProvider(id) => write!(f, "unknown provider `{id}`"),
            Self::InvalidManifest(error) => error.fmt(f),
            Self::UnsupportedMode(mode) => write!(f, "provider does not support {mode:?} mode"),
            Self::ResumeUnsupported => write!(f, "provider does not support resume"),
            Self::InvalidInput(reason) => write!(f, "invalid launch input: {reason}"),
        }
    }
}

impl std::error::Error for LaunchError {}

// ---------------------------------------------------------------------------
// Agent lifecycle, status events, and explicit terminal ownership
// ---------------------------------------------------------------------------

/// Stable key for one provider process/session in one workspace.  Keeping
/// all three scopes in the key prevents input/status leakage between two
/// agents that happen to share a project or provider.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Ord, PartialOrd, Serialize, Deserialize)]
pub struct AgentKey {
    pub workspace_id: String,
    pub session_id: String,
    pub agent_id: String,
}

impl AgentKey {
    pub fn new(
        workspace_id: impl Into<String>,
        session_id: impl Into<String>,
        agent_id: impl Into<String>,
    ) -> Result<Self, LifecycleError> {
        let key = Self {
            workspace_id: workspace_id.into(),
            session_id: session_id.into(),
            agent_id: agent_id.into(),
        };
        key.validate()?;
        Ok(key)
    }

    fn validate(&self) -> Result<(), LifecycleError> {
        for (label, value) in [
            ("workspace", self.workspace_id.as_str()),
            ("session", self.session_id.as_str()),
            ("agent", self.agent_id.as_str()),
        ] {
            validate_identifier(value)
                .map_err(|reason| LifecycleError::InvalidIdentifier { label, reason })?;
        }
        Ok(())
    }
}

/// Lifecycle states exposed to the UI and protocol adapter.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentState {
    Working,
    Blocked,
    Done,
    Idle,
    Sleeping,
    Exited,
    Error,
    Reconnecting,
}

/// Provider-originated events are translated to lifecycle transitions without
/// a polling loop.  A terminal reader, runner callback, or reconnect task can
/// submit these signals as soon as it observes them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProviderSignal {
    Started,
    /// A prompt was submitted to an already-running interactive provider.
    TurnStarted,
    Output {
        bytes: usize,
    },
    InputRequested {
        reason: String,
    },
    Completed {
        reason: String,
    },
    ProcessExited {
        code: Option<i32>,
    },
    TransportLost {
        reason: String,
    },
    Error {
        reason: String,
    },
}

/// Principal that may observe or own a terminal control channel.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ClientIdentity {
    pub id: String,
    pub device_id: String,
    pub kind: ClientKind,
}

impl ClientIdentity {
    pub fn new(
        id: impl Into<String>,
        device_id: impl Into<String>,
        kind: ClientKind,
    ) -> Result<Self, LifecycleError> {
        let identity = Self {
            id: id.into(),
            device_id: device_id.into(),
            kind,
        };
        validate_identifier(&identity.id).map_err(|reason| LifecycleError::InvalidIdentifier {
            label: "client",
            reason,
        })?;
        validate_identifier(&identity.device_id).map_err(|reason| {
            LifecycleError::InvalidIdentifier {
                label: "device",
                reason,
            }
        })?;
        Ok(identity)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClientKind {
    Desktop,
    Mobile,
    Service,
}

/// A generation-bound owner lease.  A client must present the exact lease
/// generation when writing/resizing, so a reconnect cannot replay a stale
/// frame into a terminal now owned by another client.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ControlLease {
    pub client: ClientIdentity,
    pub generation: u64,
    pub acquired_at_ms: u64,
    pub last_activity_ms: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ControlChannel {
    Input,
    Resize,
}

/// Durable registration input for one agent.  The actual provider manifest is
/// referenced by opaque `provider_id`; this keeps the project/session model
/// independent from the built-in Claude/Codex enum.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentRegistration {
    pub key: AgentKey,
    pub provider_id: String,
    pub provider_session_id: Option<String>,
    pub resumable: bool,
    pub now_ms: u64,
}

impl AgentRegistration {
    fn validate(&self) -> Result<(), LifecycleError> {
        self.key.validate()?;
        validate_identifier(&self.provider_id).map_err(|reason| {
            LifecycleError::InvalidIdentifier {
                label: "provider",
                reason,
            }
        })?;
        if let Some(session_id) = &self.provider_session_id {
            validate_provider_session_id(session_id)
                .map_err(|reason| LifecycleError::InvalidProviderSessionId { reason })?;
        }
        Ok(())
    }
}

/// One persisted/readable snapshot of lifecycle state.  The transition list,
/// observers, and ownership values are all bounded by the registry policy.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentSnapshot {
    pub key: AgentKey,
    pub provider_id: String,
    pub provider_session_id: Option<String>,
    pub resumable: bool,
    /// Monotonic revision for every durable lifecycle mutation.  This is
    /// separate from `transition_sequence`: activity, provider identity,
    /// guards, and ownership can change without changing the visible state.
    /// Persistence uses it for compare-and-swap writes after asynchronous
    /// callbacks or restart recovery.
    #[serde(default = "initial_snapshot_revision")]
    pub revision: u64,
    pub state: AgentState,
    pub reason: String,
    pub last_transition_ms: u64,
    pub last_activity_ms: u64,
    pub transition_sequence: u64,
    pub input_owner: Option<ControlLease>,
    pub resize_owner: Option<ControlLease>,
    pub observers: BTreeSet<String>,
    /// Every client currently marking this agent focused.  `focused_by` is a
    /// deterministic compatibility projection of this set; it must never be
    /// treated as the authoritative focus collection.
    pub focused_clients: BTreeSet<String>,
    pub focused_by: Option<String>,
    pub foreground_clients: BTreeSet<String>,
    pub foreground: bool,
    pub mobile_driven_clients: BTreeSet<String>,
    pub mobile_driven: bool,
    pub unsettled: bool,
    pub active_typing_until_ms: Option<u64>,
    pub recent_transitions: VecDeque<AgentTransition>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentTransition {
    pub sequence: u64,
    pub from: AgentState,
    pub to: AgentState,
    pub reason: String,
    pub at_ms: u64,
    pub changed: bool,
}

/// A lifecycle-owned reservation held while the runtime adapter stops one
/// concrete provider process. The record remains in its finished state until
/// [`AgentLifecycleRegistry::commit_hibernation`] confirms that the process is
/// gone; while this lease is held, activity and guard mutations fail closed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HibernationLease {
    key: AgentKey,
    generation: u64,
}

struct AgentRecord {
    key: AgentKey,
    provider_id: String,
    provider_session_id: Option<String>,
    resumable: bool,
    revision: u64,
    state: AgentState,
    reason: String,
    last_transition_ms: u64,
    last_activity_ms: u64,
    transition_sequence: u64,
    input_owner: Option<ControlLease>,
    resize_owner: Option<ControlLease>,
    observers: BTreeSet<String>,
    focused_clients: BTreeSet<String>,
    focused_by: Option<String>,
    foreground_clients: BTreeSet<String>,
    foreground: bool,
    mobile_driven_clients: BTreeSet<String>,
    mobile_driven: bool,
    unsettled: bool,
    active_typing_until_ms: Option<u64>,
    recent_transitions: VecDeque<AgentTransition>,
}

impl AgentRecord {
    fn from_registration(registration: AgentRegistration) -> Self {
        Self {
            key: registration.key,
            provider_id: registration.provider_id,
            provider_session_id: registration.provider_session_id,
            resumable: registration.resumable,
            revision: 1,
            state: AgentState::Idle,
            reason: "registered".to_string(),
            last_transition_ms: registration.now_ms,
            last_activity_ms: registration.now_ms,
            transition_sequence: 0,
            input_owner: None,
            resize_owner: None,
            observers: BTreeSet::new(),
            focused_clients: BTreeSet::new(),
            focused_by: None,
            foreground_clients: BTreeSet::new(),
            foreground: false,
            mobile_driven_clients: BTreeSet::new(),
            mobile_driven: false,
            unsettled: false,
            active_typing_until_ms: None,
            recent_transitions: VecDeque::new(),
        }
    }

    fn snapshot(&self) -> AgentSnapshot {
        AgentSnapshot {
            key: self.key.clone(),
            provider_id: self.provider_id.clone(),
            provider_session_id: self.provider_session_id.clone(),
            resumable: self.resumable,
            revision: self.revision,
            state: self.state,
            reason: self.reason.clone(),
            last_transition_ms: self.last_transition_ms,
            last_activity_ms: self.last_activity_ms,
            transition_sequence: self.transition_sequence,
            input_owner: self.input_owner.clone(),
            resize_owner: self.resize_owner.clone(),
            observers: self.observers.clone(),
            focused_clients: self.focused_clients.clone(),
            focused_by: self.focused_by.clone(),
            foreground_clients: self.foreground_clients.clone(),
            foreground: self.foreground,
            mobile_driven_clients: self.mobile_driven_clients.clone(),
            mobile_driven: self.mobile_driven,
            unsettled: self.unsettled,
            active_typing_until_ms: self.active_typing_until_ms,
            recent_transitions: self.recent_transitions.clone(),
        }
    }

    fn refresh_derived_guards(&mut self) {
        self.focused_by = self.focused_clients.iter().next().cloned();
        self.foreground = !self.foreground_clients.is_empty();
        self.mobile_driven = !self.mobile_driven_clients.is_empty();
    }
}

struct LifecycleInner {
    agents: HashMap<AgentKey, AgentRecord>,
    next_generation: u64,
    next_hibernation_generation: u64,
    hibernating: HashMap<AgentKey, u64>,
}

/// Thread-safe state boundary for a provider fleet.  It stores bounded
/// metadata only; terminal bytes and provider output remain in their owning
/// runtime buffers.
pub struct AgentLifecycleRegistry {
    inner: Mutex<LifecycleInner>,
    max_agents: usize,
    history_limit: usize,
    provider_transitions: tokio::sync::broadcast::Sender<(AgentKey, AgentTransition, bool)>,
}

impl AgentLifecycleRegistry {
    pub fn new() -> Self {
        Self::with_limits(MAX_AGENTS, MAX_TRANSITION_HISTORY)
            .expect("built-in lifecycle limits are valid")
    }

    pub fn with_limits(max_agents: usize, history_limit: usize) -> Result<Self, LifecycleError> {
        if max_agents == 0 || max_agents > MAX_AGENTS {
            return Err(LifecycleError::InvalidLimit("max_agents"));
        }
        if history_limit == 0 || history_limit > MAX_TRANSITION_HISTORY {
            return Err(LifecycleError::InvalidLimit("history_limit"));
        }
        Ok(Self {
            inner: Mutex::new(LifecycleInner {
                agents: HashMap::new(),
                next_generation: 0,
                next_hibernation_generation: 0,
                hibernating: HashMap::new(),
            }),
            max_agents,
            history_limit,
            provider_transitions: tokio::sync::broadcast::channel(1024).0,
        })
    }

    /// Subscribe before starting providers so short turns between snapshot
    /// polls retain both their working and completion events. The final bool
    /// distinguishes a submitted turn from process startup or terminal repaint.
    pub fn subscribe_provider_transitions(
        &self,
    ) -> tokio::sync::broadcast::Receiver<(AgentKey, AgentTransition, bool)> {
        self.provider_transitions.subscribe()
    }

    pub fn register(
        &self,
        registration: AgentRegistration,
    ) -> Result<AgentSnapshot, LifecycleError> {
        registration.validate()?;
        let mut inner = self.inner.lock().unwrap();
        if inner.agents.len() >= self.max_agents {
            return Err(LifecycleError::Capacity);
        }
        if inner.agents.contains_key(&registration.key) {
            return Err(LifecycleError::Duplicate(registration.key));
        }
        let record = AgentRecord::from_registration(registration);
        let snapshot = record.snapshot();
        inner.agents.insert(record.key.clone(), record);
        Ok(snapshot)
    }

    pub fn get(&self, key: &AgentKey) -> Result<AgentSnapshot, LifecycleError> {
        let inner = self.inner.lock().unwrap();
        inner
            .agents
            .get(key)
            .map(AgentRecord::snapshot)
            .ok_or_else(|| LifecycleError::NotFound(key.clone()))
    }

    /// Forget an explicitly deleted agent after the runtime owner has stopped
    /// its process. Late provider callbacks then become harmless NotFounds.
    pub fn remove(&self, key: &AgentKey) -> Result<(), LifecycleError> {
        let mut inner = self.inner.lock().unwrap();
        reject_if_hibernating(&inner, key)?;
        inner
            .agents
            .remove(key)
            .ok_or_else(|| LifecycleError::NotFound(key.clone()))?;
        Ok(())
    }

    /// Whether `client_id` is watching `session_id`'s `agent_id` right now.
    /// The native-snapshot fan-out asks this once per connection per broadcast,
    /// so it scans the bounded map in place instead of building a `list()`.
    pub fn observes(&self, session_id: &str, agent_id: &str, client_id: &str) -> bool {
        self.inner
            .lock()
            .unwrap()
            .agents
            .iter()
            .any(|(key, record)| {
                key.session_id == session_id
                    && key.agent_id == agent_id
                    && record.observers.contains(client_id)
            })
    }

    pub fn list(&self) -> Vec<AgentSnapshot> {
        let inner = self.inner.lock().unwrap();
        let mut records: Vec<_> = inner.agents.values().map(AgentRecord::snapshot).collect();
        records.sort_by(|left, right| left.key.cmp(&right.key));
        records
    }

    pub fn list_workspace(&self, workspace_id: &str) -> Vec<AgentSnapshot> {
        self.list()
            .into_iter()
            .filter(|record| record.key.workspace_id == workspace_id)
            .collect()
    }

    pub fn set_provider_session_id(
        &self,
        key: &AgentKey,
        provider_session_id: Option<String>,
    ) -> Result<AgentSnapshot, LifecycleError> {
        if let Some(session_id) = &provider_session_id {
            validate_provider_session_id(session_id)
                .map_err(|reason| LifecycleError::InvalidProviderSessionId { reason })?;
        }
        let mut inner = self.inner.lock().unwrap();
        reject_if_hibernating(&inner, key)?;
        let record = inner
            .agents
            .get_mut(key)
            .ok_or_else(|| LifecycleError::NotFound(key.clone()))?;
        if record.provider_session_id != provider_session_id {
            record.provider_session_id = provider_session_id;
            bump_revision(record);
        }
        Ok(record.snapshot())
    }

    /// Apply a provider event and return the resulting typed transition.
    pub fn signal(
        &self,
        key: &AgentKey,
        signal: ProviderSignal,
        at_ms: u64,
    ) -> Result<AgentTransition, LifecycleError> {
        let starts_turn = matches!(signal, ProviderSignal::TurnStarted);
        let (state, reason, activity) = match signal {
            ProviderSignal::Started => (AgentState::Working, "provider started".to_string(), true),
            ProviderSignal::TurnStarted => {
                (AgentState::Working, "prompt submitted".to_string(), true)
            }
            ProviderSignal::Output { bytes } => (
                AgentState::Working,
                format!("provider output ({bytes} bytes)"),
                true,
            ),
            ProviderSignal::InputRequested { reason } => (AgentState::Blocked, reason, true),
            ProviderSignal::Completed { reason } => (AgentState::Done, reason, true),
            ProviderSignal::ProcessExited { code } => (
                AgentState::Exited,
                match code {
                    Some(code) => format!("provider exited with code {code}"),
                    None => "provider exited without a status code".to_string(),
                },
                false,
            ),
            ProviderSignal::TransportLost { reason } => (AgentState::Reconnecting, reason, false),
            ProviderSignal::Error { reason } => (AgentState::Error, reason, false),
        };
        let mut inner = self.inner.lock().unwrap();
        reject_if_hibernating(&inner, key)?;
        let record = inner
            .agents
            .get_mut(key)
            .ok_or_else(|| LifecycleError::NotFound(key.clone()))?;
        let transition = transition_record(record, state, reason, at_ms, self.history_limit)?;
        if activity && record.last_activity_ms != at_ms {
            record.last_activity_ms = at_ms;
            // A state transition already advanced the revision.  A same-state
            // output/activity event still needs its own durable revision.
            if !transition.changed {
                bump_revision(record);
            }
        }
        if transition.changed || starts_turn {
            let _ = self
                .provider_transitions
                .send((key.clone(), transition.clone(), starts_turn));
        }
        Ok(transition)
    }

    /// Explicit transition entry point for adapter events that do not map to
    /// one of [`ProviderSignal`]. Sleeping is deliberately reserved for
    /// [`Self::hibernate`] so callers cannot bypass its guards.
    pub fn transition(
        &self,
        key: &AgentKey,
        state: AgentState,
        reason: impl Into<String>,
        at_ms: u64,
    ) -> Result<AgentTransition, LifecycleError> {
        if state == AgentState::Sleeping {
            return Err(LifecycleError::UseHibernationApi);
        }
        let mut inner = self.inner.lock().unwrap();
        reject_if_hibernating(&inner, key)?;
        let record = inner
            .agents
            .get_mut(key)
            .ok_or_else(|| LifecycleError::NotFound(key.clone()))?;
        let transition =
            transition_record(record, state, reason.into(), at_ms, self.history_limit)?;
        if transition.changed {
            let _ = self.provider_transitions.send((
                key.clone(),
                transition.clone(),
                state == AgentState::Working,
            ));
        }
        Ok(transition)
    }

    pub fn record_activity(
        &self,
        key: &AgentKey,
        at_ms: u64,
    ) -> Result<AgentSnapshot, LifecycleError> {
        let mut inner = self.inner.lock().unwrap();
        reject_if_hibernating(&inner, key)?;
        let record = inner
            .agents
            .get_mut(key)
            .ok_or_else(|| LifecycleError::NotFound(key.clone()))?;
        if record.last_activity_ms != at_ms {
            record.last_activity_ms = at_ms;
            bump_revision(record);
        }
        Ok(record.snapshot())
    }

    pub fn attach_observer(
        &self,
        key: &AgentKey,
        client: &ClientIdentity,
    ) -> Result<AgentSnapshot, LifecycleError> {
        validate_client(client)?;
        let mut inner = self.inner.lock().unwrap();
        reject_if_hibernating(&inner, key)?;
        let record = inner
            .agents
            .get_mut(key)
            .ok_or_else(|| LifecycleError::NotFound(key.clone()))?;
        let changed = !record.observers.contains(&client.id);
        add_observer(record, &client.id)?;
        if changed {
            bump_revision(record);
        }
        Ok(record.snapshot())
    }

    pub fn detach_observer(
        &self,
        key: &AgentKey,
        client_id: &str,
    ) -> Result<AgentSnapshot, LifecycleError> {
        validate_identifier(client_id).map_err(|reason| LifecycleError::InvalidIdentifier {
            label: "client",
            reason,
        })?;
        let mut inner = self.inner.lock().unwrap();
        let record = inner
            .agents
            .get_mut(key)
            .ok_or_else(|| LifecycleError::NotFound(key.clone()))?;
        let mut changed = record.observers.remove(client_id);
        changed |= record.focused_clients.remove(client_id);
        changed |= record.foreground_clients.remove(client_id);
        changed |= record.mobile_driven_clients.remove(client_id);
        if record
            .input_owner
            .as_ref()
            .is_some_and(|lease| lease.client.id == client_id)
        {
            record.input_owner = None;
            changed = true;
        }
        if record
            .resize_owner
            .as_ref()
            .is_some_and(|lease| lease.client.id == client_id)
        {
            record.resize_owner = None;
            changed = true;
        }
        record.refresh_derived_guards();
        if changed {
            bump_revision(record);
        }
        Ok(record.snapshot())
    }

    pub fn acquire_control(
        &self,
        key: &AgentKey,
        channel: ControlChannel,
        client: ClientIdentity,
        at_ms: u64,
    ) -> Result<ControlLease, OwnershipError> {
        validate_client(&client).map_err(OwnershipError::Lifecycle)?;
        let mut inner = self.inner.lock().unwrap();
        reject_if_hibernating(&inner, key).map_err(OwnershipError::Lifecycle)?;
        if !inner.agents.contains_key(key) {
            return Err(OwnershipError::NotFound(key.clone()));
        }
        {
            let record = inner.agents.get(key).expect("checked above");
            let current = match channel {
                ControlChannel::Input => record.input_owner.as_ref(),
                ControlChannel::Resize => record.resize_owner.as_ref(),
            };
            if let Some(current) = current {
                if current.client == client {
                    return Ok(current.clone());
                }
                return Err(OwnershipError::AlreadyOwned {
                    channel,
                    owner: current.client.clone(),
                });
            }
        }
        inner.next_generation = inner.next_generation.wrapping_add(1).max(1);
        let lease = ControlLease {
            client: client.clone(),
            generation: inner.next_generation,
            acquired_at_ms: at_ms,
            last_activity_ms: at_ms,
        };
        let record = inner.agents.get_mut(key).expect("checked above");
        add_observer(record, &client.id).map_err(OwnershipError::Lifecycle)?;
        if client.kind == ClientKind::Mobile {
            record.mobile_driven_clients.insert(client.id.clone());
            record.refresh_derived_guards();
        }
        match channel {
            ControlChannel::Input => record.input_owner = Some(lease.clone()),
            ControlChannel::Resize => record.resize_owner = Some(lease.clone()),
        }
        bump_revision(record);
        Ok(lease)
    }

    pub fn release_control(
        &self,
        key: &AgentKey,
        channel: ControlChannel,
        client: &ClientIdentity,
        generation: u64,
    ) -> Result<AgentSnapshot, OwnershipError> {
        validate_client(client).map_err(OwnershipError::Lifecycle)?;
        let mut inner = self.inner.lock().unwrap();
        reject_if_hibernating(&inner, key).map_err(OwnershipError::Lifecycle)?;
        let record = inner
            .agents
            .get_mut(key)
            .ok_or_else(|| OwnershipError::NotFound(key.clone()))?;
        let current = match channel {
            ControlChannel::Input => record.input_owner.as_ref(),
            ControlChannel::Resize => record.resize_owner.as_ref(),
        }
        .ok_or(OwnershipError::NotOwned { channel })?;
        if current.client != *client || current.generation != generation {
            return Err(OwnershipError::StaleLease { channel });
        }
        match channel {
            ControlChannel::Input => record.input_owner = None,
            ControlChannel::Resize => record.resize_owner = None,
        }
        bump_revision(record);
        Ok(record.snapshot())
    }

    /// Validate a write/resize authority and update activity for an input
    /// event.  `active_for` is intentionally supplied by the caller so the
    /// policy can match the UX of the terminal adapter without a hidden timer.
    pub fn record_control_activity(
        &self,
        key: &AgentKey,
        channel: ControlChannel,
        client: &ClientIdentity,
        generation: u64,
        at_ms: u64,
        active_for: Duration,
    ) -> Result<AgentSnapshot, OwnershipError> {
        validate_client(client).map_err(OwnershipError::Lifecycle)?;
        let mut inner = self.inner.lock().unwrap();
        reject_if_hibernating(&inner, key).map_err(OwnershipError::Lifecycle)?;
        let record = inner
            .agents
            .get_mut(key)
            .ok_or_else(|| OwnershipError::NotFound(key.clone()))?;
        let lease = match channel {
            ControlChannel::Input => record.input_owner.as_mut(),
            ControlChannel::Resize => record.resize_owner.as_mut(),
        }
        .ok_or(OwnershipError::NotOwned { channel })?;
        if lease.client != *client || lease.generation != generation {
            return Err(OwnershipError::StaleLease { channel });
        }
        lease.last_activity_ms = at_ms;
        record.last_activity_ms = at_ms;
        if channel == ControlChannel::Input {
            let active_ms = active_for.as_millis().min(u128::from(u64::MAX)) as u64;
            record.active_typing_until_ms = Some(at_ms.saturating_add(active_ms));
            if client.kind == ClientKind::Mobile {
                record.mobile_driven_clients.insert(client.id.clone());
                record.refresh_derived_guards();
            }
        }
        bump_revision(record);
        Ok(record.snapshot())
    }

    /// Mark or clear focus for one client.  Focus is a set: clearing client A
    /// cannot make an agent appear unfocused while client B still has focus.
    pub fn set_focus_for_client(
        &self,
        key: &AgentKey,
        client_id: &str,
        focused: bool,
    ) -> Result<AgentSnapshot, LifecycleError> {
        validate_identifier(client_id).map_err(|reason| LifecycleError::InvalidIdentifier {
            label: "client",
            reason,
        })?;
        let mut inner = self.inner.lock().unwrap();
        reject_if_hibernating(&inner, key)?;
        let record = inner
            .agents
            .get_mut(key)
            .ok_or_else(|| LifecycleError::NotFound(key.clone()))?;
        if focused {
            let observer_added = !record.observers.contains(client_id);
            add_observer(record, client_id)?;
            let focused_added = record.focused_clients.insert(client_id.to_string());
            if observer_added || focused_added {
                bump_revision(record);
            }
        } else {
            if record.focused_clients.remove(client_id) {
                bump_revision(record);
            }
        }
        record.refresh_derived_guards();
        Ok(record.snapshot())
    }

    /// Short alias for adapters that prefer an imperative focus operation.
    pub fn set_focus(
        &self,
        key: &AgentKey,
        client_id: &str,
        focused: bool,
    ) -> Result<AgentSnapshot, LifecycleError> {
        self.set_focus_for_client(key, client_id, focused)
    }

    pub fn set_foreground_for_client(
        &self,
        key: &AgentKey,
        client_id: &str,
        foreground: bool,
    ) -> Result<AgentSnapshot, LifecycleError> {
        validate_identifier(client_id).map_err(|reason| LifecycleError::InvalidIdentifier {
            label: "client",
            reason,
        })?;
        let mut inner = self.inner.lock().unwrap();
        reject_if_hibernating(&inner, key)?;
        let record = inner
            .agents
            .get_mut(key)
            .ok_or_else(|| LifecycleError::NotFound(key.clone()))?;
        if foreground {
            let observer_added = !record.observers.contains(client_id);
            add_observer(record, client_id)?;
            let foreground_added = record.foreground_clients.insert(client_id.to_string());
            if observer_added || foreground_added {
                bump_revision(record);
            }
        } else {
            if record.foreground_clients.remove(client_id) {
                bump_revision(record);
            }
        }
        record.refresh_derived_guards();
        Ok(record.snapshot())
    }

    /// Compatibility helper for a process-wide guard owned by the adapter.
    /// Client-aware code should use [`Self::set_foreground_for_client`].
    pub fn set_foreground(
        &self,
        key: &AgentKey,
        foreground: bool,
    ) -> Result<AgentSnapshot, LifecycleError> {
        self.set_foreground_for_client(key, LEGACY_GUARD_CLIENT, foreground)
    }

    pub fn set_mobile_driven_for_client(
        &self,
        key: &AgentKey,
        client_id: &str,
        mobile_driven: bool,
    ) -> Result<AgentSnapshot, LifecycleError> {
        validate_identifier(client_id).map_err(|reason| LifecycleError::InvalidIdentifier {
            label: "client",
            reason,
        })?;
        let mut inner = self.inner.lock().unwrap();
        reject_if_hibernating(&inner, key)?;
        let record = inner
            .agents
            .get_mut(key)
            .ok_or_else(|| LifecycleError::NotFound(key.clone()))?;
        if mobile_driven {
            let observer_added = !record.observers.contains(client_id);
            add_observer(record, client_id)?;
            let mobile_added = record.mobile_driven_clients.insert(client_id.to_string());
            if observer_added || mobile_added {
                bump_revision(record);
            }
        } else {
            if record.mobile_driven_clients.remove(client_id) {
                bump_revision(record);
            }
        }
        record.refresh_derived_guards();
        Ok(record.snapshot())
    }

    /// Compatibility helper for a process-wide guard owned by the adapter.
    /// Client-aware code should use [`Self::set_mobile_driven_for_client`].
    pub fn set_mobile_driven(
        &self,
        key: &AgentKey,
        mobile_driven: bool,
    ) -> Result<AgentSnapshot, LifecycleError> {
        self.set_mobile_driven_for_client(key, LEGACY_GUARD_CLIENT, mobile_driven)
    }

    pub fn set_unsettled(
        &self,
        key: &AgentKey,
        unsettled: bool,
    ) -> Result<AgentSnapshot, LifecycleError> {
        let mut inner = self.inner.lock().unwrap();
        reject_if_hibernating(&inner, key)?;
        let record = inner
            .agents
            .get_mut(key)
            .ok_or_else(|| LifecycleError::NotFound(key.clone()))?;
        if record.unsettled != unsettled {
            record.unsettled = unsettled;
            bump_revision(record);
        }
        Ok(record.snapshot())
    }

    pub fn hibernation_decision(
        &self,
        key: &AgentKey,
        policy: HibernationPolicy,
        at_ms: u64,
    ) -> Result<HibernationDecision, LifecycleError> {
        let inner = self.inner.lock().unwrap();
        let record = inner
            .agents
            .get(key)
            .ok_or_else(|| LifecycleError::NotFound(key.clone()))?;
        Ok(policy.evaluate(&record.snapshot(), at_ms))
    }

    /// Reserve hibernation while the runtime adapter stops the concrete
    /// provider process. The reservation is held in the same mutex as
    /// lifecycle state, and all activity/ownership/focus/transition mutators
    /// reject changes until it is committed or aborted.
    pub fn begin_hibernation(
        &self,
        key: &AgentKey,
        policy: HibernationPolicy,
        at_ms: u64,
    ) -> Result<HibernationLease, HibernationError> {
        let mut inner = self.inner.lock().unwrap();
        let snapshot = inner
            .agents
            .get(key)
            .map(AgentRecord::snapshot)
            .ok_or_else(|| HibernationError::NotFound(key.clone()))?;
        if inner.hibernating.contains_key(key) {
            return Err(HibernationError::Lifecycle(
                LifecycleError::HibernationInProgress(key.clone()),
            ));
        }
        let decision = policy.evaluate(&snapshot, at_ms);
        if !decision.eligible {
            return Err(HibernationError::Ineligible(decision));
        }
        inner.next_hibernation_generation =
            inner.next_hibernation_generation.wrapping_add(1).max(1);
        let generation = inner.next_hibernation_generation;
        inner.hibernating.insert(key.clone(), generation);
        Ok(HibernationLease {
            key: key.clone(),
            generation,
        })
    }

    /// Commit a previously reserved hibernation after the adapter has stopped
    /// and rechecked the exact runtime identity. The policy is evaluated again
    /// under the lifecycle lock; a guard cannot sneak in between the initial
    /// check and this commit because mutators are blocked by the reservation.
    pub fn commit_hibernation(
        &self,
        lease: HibernationLease,
        policy: HibernationPolicy,
        at_ms: u64,
    ) -> Result<AgentTransition, HibernationError> {
        let mut inner = self.inner.lock().unwrap();
        match inner.hibernating.get(&lease.key).copied() {
            Some(generation) if generation == lease.generation => {}
            _ => {
                return Err(HibernationError::Lifecycle(
                    LifecycleError::HibernationReservationLost(lease.key),
                ))
            }
        }
        let result = {
            let record = inner
                .agents
                .get_mut(&lease.key)
                .ok_or_else(|| HibernationError::NotFound(lease.key.clone()))?;
            let decision = policy.evaluate(&record.snapshot(), at_ms);
            if !decision.eligible {
                Err(HibernationError::Ineligible(decision))
            } else {
                transition_record(
                    record,
                    AgentState::Sleeping,
                    "hibernated by idle resource policy".to_string(),
                    at_ms,
                    self.history_limit,
                )
                .map_err(HibernationError::Lifecycle)
            }
        };
        inner.hibernating.remove(&lease.key);
        result
    }

    /// Abort a reservation when runtime termination fails. No lifecycle state
    /// is changed, so the record cannot claim to be sleeping while its
    /// provider process may still be alive.
    pub fn abort_hibernation(&self, lease: HibernationLease) -> Result<(), LifecycleError> {
        let mut inner = self.inner.lock().unwrap();
        match inner.hibernating.get(&lease.key).copied() {
            Some(generation) if generation == lease.generation => {
                inner.hibernating.remove(&lease.key);
                Ok(())
            }
            _ => Err(LifecycleError::HibernationReservationLost(lease.key)),
        }
    }

    /// Hibernate through the guarded policy path for callers that do not own
    /// a process adapter. Runtime-aware callers should use
    /// `begin_hibernation`/`commit_hibernation` around process termination.
    pub fn hibernate(
        &self,
        key: &AgentKey,
        policy: HibernationPolicy,
        at_ms: u64,
    ) -> Result<AgentTransition, HibernationError> {
        let lease = self.begin_hibernation(key, policy, at_ms)?;
        self.commit_hibernation(lease, policy, at_ms)
    }

    /// Wake a sleeping agent into `Reconnecting`, returning the exact provider
    /// continuation choice for the adapter.  No process is spawned here.
    pub fn wake(&self, key: &AgentKey, at_ms: u64) -> Result<WakePlan, LifecycleError> {
        let mut inner = self.inner.lock().unwrap();
        let record = inner
            .agents
            .get_mut(key)
            .ok_or_else(|| LifecycleError::NotFound(key.clone()))?;
        if record.state != AgentState::Sleeping {
            return Err(LifecycleError::NotSleeping(key.clone()));
        }
        if !record.resumable {
            return Err(LifecycleError::NotResumable(key.clone()));
        }
        let provider_session_id = record
            .provider_session_id
            .clone()
            .ok_or_else(|| LifecycleError::MissingResumeIdentity(key.clone()))?;
        let transition = transition_record(
            record,
            AgentState::Reconnecting,
            "wake requested".to_string(),
            at_ms,
            self.history_limit,
        )?;
        let action = ResumeAction::ExistingSession(provider_session_id);
        Ok(WakePlan { transition, action })
    }

    /// Restore snapshots after a runtime restart.  Transient working/blocked
    /// states become `Reconnecting`, all connection-scoped ownership/focus is
    /// cleared, and durable provider/session identity is retained.  This is a
    /// pure state transformation; the DB adapter decides how snapshots are
    /// loaded and written.
    pub fn restore(
        snapshots: impl IntoIterator<Item = AgentSnapshot>,
        now_ms: u64,
    ) -> Result<Self, LifecycleError> {
        // Consume the source iterator directly.  Collecting snapshots just to
        // detect an over-capacity restore lets a caller temporarily allocate
        // an unbounded amount of durable metadata.  The registry itself has a
        // fixed history policy, so no look-ahead pass is needed.
        let registry = Self::new();
        let mut inner = registry.inner.lock().unwrap();
        for (index, snapshot) in snapshots.into_iter().enumerate() {
            if index >= registry.max_agents {
                return Err(LifecycleError::Capacity);
            }
            if let Some(provider_session_id) = &snapshot.provider_session_id {
                validate_provider_session_id(provider_session_id)
                    .map_err(|reason| LifecycleError::InvalidProviderSessionId { reason })?;
            }
            snapshot.key.validate()?;
            if snapshot.state == AgentState::Sleeping
                && (!snapshot.resumable || snapshot.provider_session_id.is_none())
            {
                return Err(LifecycleError::MissingResumeIdentity(snapshot.key));
            }
            if snapshot.observers.len() > MAX_OBSERVERS
                || snapshot.focused_clients.len() > MAX_OBSERVERS
                || snapshot.foreground_clients.len() > MAX_OBSERVERS
                || snapshot.mobile_driven_clients.len() > MAX_OBSERVERS
            {
                return Err(LifecycleError::SnapshotTooLarge("observers"));
            }
            validate_identifier(&snapshot.provider_id).map_err(|reason| {
                LifecycleError::InvalidIdentifier {
                    label: "provider",
                    reason,
                }
            })?;
            if inner.agents.len() >= registry.max_agents {
                return Err(LifecycleError::Capacity);
            }
            if inner.agents.contains_key(&snapshot.key) {
                return Err(LifecycleError::Duplicate(snapshot.key));
            }
            let transient = matches!(snapshot.state, AgentState::Working | AgentState::Blocked);
            let state = if transient {
                AgentState::Reconnecting
            } else {
                snapshot.state
            };
            let reason = if transient {
                "runtime restarted; reconnect required".to_string()
            } else {
                snapshot.reason.clone()
            };
            let mut recent = snapshot.recent_transitions;
            while recent.len() > registry.history_limit {
                recent.pop_front();
            }
            let record = AgentRecord {
                key: snapshot.key,
                provider_id: snapshot.provider_id,
                provider_session_id: snapshot.provider_session_id,
                resumable: snapshot.resumable,
                // Recovery itself is a durable mutation when a transient
                // provider state is converted to Reconnecting.  Advancing
                // the revision prevents a stale pre-restart snapshot from
                // winning a later compare-and-swap persistence write.
                revision: if transient {
                    snapshot.revision.saturating_add(1)
                } else {
                    snapshot.revision
                },
                state,
                reason,
                last_transition_ms: if transient {
                    now_ms
                } else {
                    snapshot.last_transition_ms
                },
                last_activity_ms: snapshot.last_activity_ms,
                transition_sequence: snapshot.transition_sequence,
                input_owner: None,
                resize_owner: None,
                observers: BTreeSet::new(),
                focused_clients: BTreeSet::new(),
                focused_by: None,
                foreground_clients: BTreeSet::new(),
                foreground: false,
                mobile_driven_clients: BTreeSet::new(),
                mobile_driven: false,
                unsettled: snapshot.unsettled,
                active_typing_until_ms: None,
                recent_transitions: recent,
            };
            inner.agents.insert(record.key.clone(), record);
        }
        drop(inner);
        Ok(registry)
    }
}

impl Default for AgentLifecycleRegistry {
    fn default() -> Self {
        Self::new()
    }
}

fn validate_client(client: &ClientIdentity) -> Result<(), LifecycleError> {
    validate_identifier(&client.id).map_err(|reason| LifecycleError::InvalidIdentifier {
        label: "client",
        reason,
    })?;
    validate_identifier(&client.device_id).map_err(|reason| LifecycleError::InvalidIdentifier {
        label: "device",
        reason,
    })?;
    Ok(())
}

fn reject_if_hibernating(inner: &LifecycleInner, key: &AgentKey) -> Result<(), LifecycleError> {
    if inner.hibernating.contains_key(key) {
        Err(LifecycleError::HibernationInProgress(key.clone()))
    } else {
        Ok(())
    }
}

fn add_observer(record: &mut AgentRecord, client_id: &str) -> Result<(), LifecycleError> {
    if record.observers.contains(client_id) {
        return Ok(());
    }
    if record.observers.len() >= MAX_OBSERVERS {
        return Err(LifecycleError::ObserverCapacity);
    }
    record.observers.insert(client_id.to_string());
    Ok(())
}

fn transition_record(
    record: &mut AgentRecord,
    to: AgentState,
    reason: String,
    at_ms: u64,
    history_limit: usize,
) -> Result<AgentTransition, LifecycleError> {
    if reason.trim().is_empty() {
        return Err(LifecycleError::EmptyTransitionReason);
    }
    if record.state == to {
        return Ok(AgentTransition {
            sequence: record.transition_sequence,
            from: record.state,
            to,
            reason,
            at_ms,
            changed: false,
        });
    }
    if !transition_allowed(record.state, to) {
        return Err(LifecycleError::InvalidTransition {
            from: record.state,
            to,
        });
    }
    record.transition_sequence = record.transition_sequence.saturating_add(1);
    bump_revision(record);
    let transition = AgentTransition {
        sequence: record.transition_sequence,
        from: record.state,
        to,
        reason: reason.clone(),
        at_ms,
        changed: true,
    };
    record.state = to;
    record.reason = reason;
    record.last_transition_ms = at_ms;
    record.recent_transitions.push_back(transition.clone());
    while record.recent_transitions.len() > history_limit {
        record.recent_transitions.pop_front();
    }
    Ok(transition)
}

fn bump_revision(record: &mut AgentRecord) {
    // Saturation is preferable to wrapping: a wrapped revision could let an
    // old asynchronous snapshot pass the persistence compare-and-swap.
    record.revision = record.revision.saturating_add(1);
}

fn transition_allowed(from: AgentState, to: AgentState) -> bool {
    match from {
        AgentState::Working => matches!(
            to,
            AgentState::Blocked
                | AgentState::Done
                | AgentState::Idle
                | AgentState::Exited
                | AgentState::Error
                | AgentState::Reconnecting
        ),
        AgentState::Blocked => matches!(
            to,
            AgentState::Working
                | AgentState::Done
                | AgentState::Idle
                | AgentState::Exited
                | AgentState::Error
                | AgentState::Reconnecting
        ),
        AgentState::Done => matches!(
            to,
            AgentState::Working
                | AgentState::Idle
                | AgentState::Sleeping
                | AgentState::Exited
                | AgentState::Error
                | AgentState::Reconnecting
        ),
        AgentState::Idle => matches!(
            to,
            AgentState::Working
                | AgentState::Blocked
                | AgentState::Done
                | AgentState::Sleeping
                | AgentState::Exited
                | AgentState::Error
                | AgentState::Reconnecting
        ),
        AgentState::Sleeping => matches!(to, AgentState::Reconnecting),
        AgentState::Exited => matches!(
            to,
            AgentState::Working | AgentState::Idle | AgentState::Error | AgentState::Reconnecting
        ),
        AgentState::Error => matches!(
            to,
            AgentState::Working | AgentState::Idle | AgentState::Exited | AgentState::Reconnecting
        ),
        AgentState::Reconnecting => matches!(
            to,
            AgentState::Working
                | AgentState::Blocked
                | AgentState::Done
                | AgentState::Idle
                | AgentState::Exited
                | AgentState::Error
        ),
    }
}

/// Configurable idle policy.  A zero idle window is useful for tests but is
/// still explicit; production callers should select a meaningful duration.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HibernationPolicy {
    pub idle_after_ms: u64,
}

impl HibernationPolicy {
    pub fn new(idle_after: Duration) -> Self {
        Self {
            idle_after_ms: idle_after.as_millis().min(u128::from(u64::MAX)) as u64,
        }
    }

    pub fn evaluate(&self, snapshot: &AgentSnapshot, at_ms: u64) -> HibernationDecision {
        let mut blockers = Vec::new();
        if snapshot.state == AgentState::Sleeping {
            blockers.push(HibernationBlocker::AlreadySleeping);
        } else if !matches!(snapshot.state, AgentState::Done | AgentState::Idle) {
            blockers.push(HibernationBlocker::StateNotFinished(snapshot.state));
        }
        if !snapshot.resumable {
            blockers.push(HibernationBlocker::NotResumable);
        } else if snapshot.provider_session_id.is_none() {
            // A boolean capability alone is not enough to prove that wake can
            // continue the same provider session.  Refuse to hibernate until
            // the adapter has recorded the opaque identity that wake will
            // pass back to the provider.
            blockers.push(HibernationBlocker::MissingResumeIdentity);
        }
        if snapshot.focused_by.is_some() || !snapshot.focused_clients.is_empty() {
            blockers.push(HibernationBlocker::Focused);
        }
        if snapshot.foreground || !snapshot.foreground_clients.is_empty() {
            blockers.push(HibernationBlocker::Foreground);
        }
        if snapshot.input_owner.is_some() {
            blockers.push(HibernationBlocker::InputOwned);
        }
        if snapshot.resize_owner.is_some() {
            blockers.push(HibernationBlocker::ResizeOwned);
        }
        if snapshot
            .active_typing_until_ms
            .is_some_and(|until| until > at_ms)
        {
            blockers.push(HibernationBlocker::ActivelyTyping);
        }
        if snapshot.mobile_driven || !snapshot.mobile_driven_clients.is_empty() {
            blockers.push(HibernationBlocker::MobileDriven);
        }
        if snapshot.unsettled {
            blockers.push(HibernationBlocker::UnsettledOrchestration);
        }
        let idle_for_ms = at_ms.saturating_sub(snapshot.last_activity_ms);
        if idle_for_ms < self.idle_after_ms {
            blockers.push(HibernationBlocker::IdleWindow {
                elapsed_ms: idle_for_ms,
                required_ms: self.idle_after_ms,
            });
        }
        HibernationDecision {
            eligible: blockers.is_empty(),
            blockers,
        }
    }
}

impl Default for HibernationPolicy {
    fn default() -> Self {
        Self::new(Duration::from_secs(15 * 60))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HibernationDecision {
    pub eligible: bool,
    pub blockers: Vec<HibernationBlocker>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HibernationBlocker {
    AlreadySleeping,
    StateNotFinished(AgentState),
    NotResumable,
    MissingResumeIdentity,
    Focused,
    Foreground,
    InputOwned,
    ResizeOwned,
    ActivelyTyping,
    MobileDriven,
    UnsettledOrchestration,
    IdleWindow { elapsed_ms: u64, required_ms: u64 },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ResumeAction {
    ExistingSession(String),
    FreshSession { reason: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WakePlan {
    pub transition: AgentTransition,
    pub action: ResumeAction,
}

/// Lifecycle failures.  They remain typed so a protocol adapter can map
/// ownership conflicts, stale leases, and unsafe hibernation into actionable
/// client errors without parsing strings.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LifecycleError {
    InvalidIdentifier { label: &'static str, reason: String },
    InvalidProviderSessionId { reason: String },
    InvalidLimit(&'static str),
    Capacity,
    ObserverCapacity,
    SnapshotTooLarge(&'static str),
    Duplicate(AgentKey),
    NotFound(AgentKey),
    NotSleeping(AgentKey),
    NotResumable(AgentKey),
    MissingResumeIdentity(AgentKey),
    HibernationInProgress(AgentKey),
    HibernationReservationLost(AgentKey),
    EmptyTransitionReason,
    UseHibernationApi,
    InvalidTransition { from: AgentState, to: AgentState },
}

impl fmt::Display for LifecycleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidIdentifier { label, reason } => write!(f, "invalid {label} id: {reason}"),
            Self::InvalidProviderSessionId { reason } => {
                write!(f, "invalid provider session id: {reason}")
            }
            Self::InvalidLimit(name) => write!(f, "invalid lifecycle limit `{name}`"),
            Self::Capacity => write!(f, "agent lifecycle capacity reached"),
            Self::ObserverCapacity => write!(f, "agent observer capacity reached"),
            Self::SnapshotTooLarge(field) => {
                write!(f, "agent snapshot field `{field}` exceeds its bound")
            }
            Self::Duplicate(key) => write!(f, "agent already registered: {key:?}"),
            Self::NotFound(key) => write!(f, "agent not found: {key:?}"),
            Self::NotSleeping(key) => write!(f, "agent is not sleeping: {key:?}"),
            Self::NotResumable(key) => write!(f, "agent is not resumable: {key:?}"),
            Self::MissingResumeIdentity(key) => {
                write!(f, "agent has no restorable provider identity: {key:?}")
            }
            Self::HibernationInProgress(key) => {
                write!(
                    f,
                    "agent hibernation is already stopping its runtime: {key:?}"
                )
            }
            Self::HibernationReservationLost(key) => {
                write!(f, "agent hibernation reservation was lost: {key:?}")
            }
            Self::EmptyTransitionReason => write!(f, "transition reason is empty"),
            Self::UseHibernationApi => write!(f, "sleeping requires the hibernation policy API"),
            Self::InvalidTransition { from, to } => {
                write!(f, "invalid agent transition {from:?} -> {to:?}")
            }
        }
    }
}

impl std::error::Error for LifecycleError {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OwnershipError {
    Lifecycle(LifecycleError),
    NotFound(AgentKey),
    AlreadyOwned {
        channel: ControlChannel,
        owner: ClientIdentity,
    },
    NotOwned {
        channel: ControlChannel,
    },
    StaleLease {
        channel: ControlChannel,
    },
}

impl fmt::Display for OwnershipError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Lifecycle(error) => error.fmt(f),
            Self::NotFound(key) => write!(f, "agent not found: {key:?}"),
            Self::AlreadyOwned { channel, owner } => {
                write!(f, "{channel:?} is owned by client `{}`", owner.id)
            }
            Self::NotOwned { channel } => write!(f, "{channel:?} has no owner"),
            Self::StaleLease { channel } => write!(f, "stale {channel:?} ownership lease"),
        }
    }
}

impl std::error::Error for OwnershipError {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HibernationError {
    Lifecycle(LifecycleError),
    NotFound(AgentKey),
    Ineligible(HibernationDecision),
}

impl fmt::Display for HibernationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Lifecycle(error) => error.fmt(f),
            Self::NotFound(key) => write!(f, "agent not found: {key:?}"),
            Self::Ineligible(decision) => {
                write!(
                    f,
                    "agent is not eligible for hibernation: {:?}",
                    decision.blockers
                )
            }
        }
    }
}

impl std::error::Error for HibernationError {}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsString;
    use std::fs::OpenOptions;
    use std::io::Write;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

    struct TempDirectory {
        path: PathBuf,
    }

    impl TempDirectory {
        fn new() -> Self {
            let suffix = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir()
                .join(format!("perch-agent-fleet-{}-{suffix}", std::process::id()));
            fs::create_dir(&path).unwrap();
            Self { path }
        }

        fn path(&self) -> &Path {
            &self.path
        }
    }

    impl Drop for TempDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn key(workspace: &str, session: &str, agent: &str) -> AgentKey {
        AgentKey::new(workspace, session, agent).unwrap()
    }

    fn registration(key: AgentKey, provider: &str, resumable: bool) -> AgentRegistration {
        AgentRegistration {
            key,
            provider_id: provider.to_string(),
            provider_session_id: resumable.then(|| "provider-session".to_string()),
            resumable,
            now_ms: 100,
        }
    }

    fn client(id: &str, kind: ClientKind) -> ClientIdentity {
        ClientIdentity::new(id, format!("device-{id}"), kind).unwrap()
    }

    fn custom_manifest(id: &str, executable: &str) -> ProviderManifest {
        ProviderManifest {
            id: id.to_string(),
            display_name: format!("{id} provider"),
            launch: LaunchSpec {
                executable: executable.to_string(),
                prefix_args: vec!["run".to_string()],
                prompt: PromptTransport::Stdin,
                suffix_args: Vec::new(),
                resume_prefix_args: Vec::new(),
                resume: ResumePlacement::Flag {
                    flag: "--resume".to_string(),
                },
                mode_overrides: BTreeMap::new(),
            },
            supported_modes: [AgentMode::Hosted, AgentMode::Cli].into_iter().collect(),
            resumability: Resumability::ProviderSession,
            capabilities: [
                ProviderCapability::Streaming,
                ProviderCapability::InteractiveTerminal,
                ProviderCapability::Resume,
            ]
            .into_iter()
            .collect(),
            status_detection: StatusDetection::OutputPatterns {
                blocked: vec!["approve?".to_string()],
                done: vec!["done".to_string()],
            },
            environment: EnvironmentPolicy::default(),
        }
    }

    #[test]
    fn builtins_are_manifest_data_and_dynamic_args_stay_single_tokens() {
        let registry = ProviderRegistry::new();
        assert!(registry.contains("claude"));
        assert!(registry.contains("codex"));
        let cwd = Path::new("/tmp/perch-provider-fixture");
        let plan = registry
            .build_launch(
                "claude",
                cwd,
                AgentMode::Hosted,
                Some("hello; touch /tmp/should-not-run"),
                Some("session with spaces"),
            )
            .unwrap();
        assert_eq!(plan.executable, PathBuf::from("claude"));
        assert_eq!(plan.args[0], "-p");
        assert_eq!(plan.args[1], "hello; touch /tmp/should-not-run");
        assert_eq!(plan.args.last().unwrap(), "session with spaces");
        assert!(!plan.args.iter().any(|arg| arg == "sh" || arg == "-c"));
    }

    #[test]
    fn cli_mode_uses_interactive_provider_recipes() {
        let registry = ProviderRegistry::new();
        let cwd = Path::new("/tmp/perch-provider-fixture");

        let claude = registry
            .build_launch("claude", cwd, AgentMode::Cli, None, None)
            .unwrap();
        assert_eq!(claude.executable, PathBuf::from("claude"));
        assert_eq!(claude.args, ["--dangerously-skip-permissions"]);
        assert!(claude.stdin.is_none());

        let claude_resume = registry
            .build_launch("claude", cwd, AgentMode::Cli, None, Some("claude-session"))
            .unwrap();
        assert_eq!(
            claude_resume.args,
            [
                "--dangerously-skip-permissions",
                "--resume",
                "claude-session"
            ]
        );

        let codex = registry
            .build_launch("codex", cwd, AgentMode::Cli, None, None)
            .unwrap();
        assert_eq!(codex.executable, PathBuf::from("codex"));
        assert_eq!(codex.args, ["--dangerously-bypass-approvals-and-sandbox"]);

        let codex_resume = registry
            .build_launch("codex", cwd, AgentMode::Cli, None, Some("codex-thread"))
            .unwrap();
        assert_eq!(
            codex_resume.args,
            [
                "--dangerously-bypass-approvals-and-sandbox",
                "resume",
                "codex-thread"
            ]
        );

        for (provider, resume_flag) in [
            ("omp", "--resume"),
            ("pi", "--session"),
            ("opencode", "--session"),
        ] {
            let fresh = registry
                .build_launch(provider, cwd, AgentMode::Cli, None, None)
                .unwrap();
            assert_eq!(fresh.executable, PathBuf::from(provider));
            assert!(
                fresh.args.is_empty(),
                "{provider} must launch its actual interactive CLI"
            );
            assert!(fresh.stdin.is_none());
            let resumed = registry
                .build_launch(provider, cwd, AgentMode::Cli, None, Some("exact-session"))
                .unwrap();
            assert_eq!(resumed.args, [resume_flag, "exact-session"]);
        }
        assert_eq!(registry.list().len(), 36);
    }

    #[test]
    fn builtins_validate_resume_per_supported_mode() {
        let registry = ProviderRegistry::native().expect("native manifests should validate");
        let claude = registry.get("claude").unwrap();
        let codex = registry.get("codex").unwrap();
        assert!(claude.supports_resume(AgentMode::Hosted));
        assert!(claude.supports_resume(AgentMode::Cli));
        assert!(!codex.supports_resume(AgentMode::Hosted));
        assert!(codex.supports_resume(AgentMode::Cli));
        assert!(!codex.supports_capability(AgentMode::Hosted, ProviderCapability::Resume));
        assert!(codex.supports_capability(AgentMode::Cli, ProviderCapability::Resume));
    }

    #[test]
    fn positional_prompts_are_terminated_and_option_values_stay_adjacent() {
        let registry = ProviderRegistry::new();
        let cwd = Path::new("/tmp/perch-provider-fixture");
        let claude = registry
            .build_launch("claude", cwd, AgentMode::Hosted, Some("--help"), None)
            .unwrap();
        assert_eq!(claude.args[0], "-p");
        assert_eq!(claude.args[1], "--help");
        assert!(!claude.args.iter().any(|arg| arg == "--"));

        let mut positional = custom_manifest("positional", "agent");
        positional.launch.prompt = PromptTransport::Argument;
        positional.launch.prefix_args = vec!["run".to_string()];
        positional.launch.suffix_args = vec!["--format".to_string(), "json".to_string()];
        let plan = positional
            .build_launch(cwd, AgentMode::Hosted, Some("--help"), None)
            .unwrap();
        assert_eq!(plan.args, ["run", "--format", "json", "--", "--help"]);
    }

    #[test]
    fn configured_provider_is_discovered_on_an_injected_path() {
        let directory = TempDirectory::new();
        let executable_path = directory.path().join("extra-agent");
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&executable_path)
            .unwrap();
        writeln!(file, "#!/bin/sh\nprintf 'ok'").unwrap();
        drop(file);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = fs::metadata(&executable_path).unwrap().permissions();
            permissions.set_mode(0o700);
            fs::set_permissions(&executable_path, permissions).unwrap();
        }

        let registry = ProviderRegistry::new();
        let report = registry
            .discover_configured(
                [custom_manifest("extra", "extra-agent")],
                Some(OsString::from(directory.path()).as_os_str()),
            )
            .unwrap();
        assert_eq!(report.len(), 1);
        assert!(report[0].available());
        assert_eq!(
            registry.resolve_executable("extra", Some(directory.path().as_os_str())),
            Ok(fs::canonicalize(executable_path).unwrap())
        );
    }

    #[test]
    fn manifests_reject_shell_executables_and_unsafe_environment_names() {
        let mut manifest = custom_manifest("unsafe", "sh -c");
        assert!(matches!(
            manifest.validate(),
            Err(ManifestError::InvalidArgument(_))
        ));
        manifest.launch.executable = "safe-agent".to_string();
        manifest
            .environment
            .set
            .insert("BAD-NAME".to_string(), "value".to_string());
        assert!(matches!(
            manifest.validate(),
            Err(ManifestError::InvalidEnvironmentName(_))
        ));
    }

    #[test]
    fn lifecycle_scopes_two_agents_and_translates_event_driven_status() {
        let registry = AgentLifecycleRegistry::new();
        let mut transitions = registry.subscribe_provider_transitions();
        let first = key("workspace-a", "session-a", "agent-a");
        let second = key("workspace-b", "session-b", "agent-b");
        registry
            .register(registration(first.clone(), "claude", true))
            .unwrap();
        registry
            .register(registration(second.clone(), "codex", false))
            .unwrap();
        registry
            .signal(&first, ProviderSignal::TurnStarted, 200)
            .unwrap();
        registry
            .signal(
                &first,
                ProviderSignal::InputRequested {
                    reason: "approval required".to_string(),
                },
                300,
            )
            .unwrap();
        assert_eq!(registry.get(&first).unwrap().state, AgentState::Blocked);
        assert_eq!(registry.get(&second).unwrap().state, AgentState::Idle);
        assert_eq!(registry.list_workspace("workspace-a").len(), 1);
        assert_eq!(registry.get(&first).unwrap().recent_transitions.len(), 2);
        registry
            .signal(
                &first,
                ProviderSignal::Completed {
                    reason: "finished".into(),
                },
                301,
            )
            .unwrap();
        // Consume only after the entire short turn: sampling the current
        // snapshot here would have lost Working and Blocked.
        for expected in [AgentState::Working, AgentState::Blocked, AgentState::Done] {
            let (event_key, transition, starts_turn) = transitions.try_recv().unwrap();
            assert_eq!(starts_turn, expected == AgentState::Working);
            assert_eq!(event_key, first);
            assert_eq!(transition.to, expected);
        }
        registry
            .signal(
                &first,
                ProviderSignal::Completed {
                    reason: "duplicate".into(),
                },
                302,
            )
            .unwrap();
        assert!(transitions.try_recv().is_err());
    }

    #[test]
    fn ownership_is_explicit_and_stale_generations_are_rejected() {
        let registry = AgentLifecycleRegistry::new();
        let key = key("workspace", "session", "agent");
        registry
            .register(registration(key.clone(), "claude", true))
            .unwrap();
        let desktop = client("desktop", ClientKind::Desktop);
        let mobile = client("mobile", ClientKind::Mobile);
        registry.attach_observer(&key, &desktop).unwrap();
        registry.attach_observer(&key, &mobile).unwrap();
        let lease = registry
            .acquire_control(&key, ControlChannel::Input, desktop.clone(), 200)
            .unwrap();
        assert!(matches!(
            registry.acquire_control(&key, ControlChannel::Input, mobile.clone(), 201),
            Err(OwnershipError::AlreadyOwned { .. })
        ));
        assert!(matches!(
            registry.record_control_activity(
                &key,
                ControlChannel::Input,
                &desktop,
                lease.generation + 1,
                202,
                Duration::from_secs(1),
            ),
            Err(OwnershipError::StaleLease { .. })
        ));
        let snapshot = registry
            .record_control_activity(
                &key,
                ControlChannel::Input,
                &desktop,
                lease.generation,
                202,
                Duration::from_secs(1),
            )
            .unwrap();
        assert!(snapshot.active_typing_until_ms.unwrap() > 202);
        registry
            .release_control(&key, ControlChannel::Input, &desktop, lease.generation)
            .unwrap();
        let mobile_lease = registry
            .acquire_control(&key, ControlChannel::Input, mobile, 204)
            .unwrap();
        assert!(mobile_lease.generation > lease.generation);
        assert!(registry.get(&key).unwrap().observers.contains("desktop"));
    }

    #[test]
    fn snapshot_revision_advances_for_non_transition_mutations() {
        let key = key("workspace-revision", "session-revision", "agent-revision");
        let registry = AgentLifecycleRegistry::new();
        registry
            .register(registration(key.clone(), "claude", true))
            .unwrap();
        let mut previous = registry.get(&key).unwrap().revision;
        let assert_advanced = |registry: &AgentLifecycleRegistry, previous: &mut u64| {
            let current = registry.get(&key).unwrap().revision;
            assert!(
                current > *previous,
                "revision did not advance: {} <= {}",
                current,
                *previous
            );
            *previous = current;
        };

        registry
            .set_provider_session_id(&key, Some("provider-revision".to_string()))
            .unwrap();
        assert_advanced(&registry, &mut previous);
        registry.record_activity(&key, 20).unwrap();
        assert_advanced(&registry, &mut previous);
        let client =
            ClientIdentity::new("revision-client", "revision-device", ClientKind::Desktop).unwrap();
        registry.attach_observer(&key, &client).unwrap();
        assert_advanced(&registry, &mut previous);
        registry
            .set_focus_for_client(&key, &client.id, true)
            .unwrap();
        assert_advanced(&registry, &mut previous);
        registry
            .set_foreground_for_client(&key, &client.id, true)
            .unwrap();
        assert_advanced(&registry, &mut previous);
        registry
            .set_mobile_driven_for_client(&key, &client.id, true)
            .unwrap();
        assert_advanced(&registry, &mut previous);
        registry.set_unsettled(&key, true).unwrap();
        assert_advanced(&registry, &mut previous);
        let lease = registry
            .acquire_control(&key, ControlChannel::Input, client.clone(), 30)
            .unwrap();
        assert_advanced(&registry, &mut previous);
        registry
            .record_control_activity(
                &key,
                ControlChannel::Input,
                &client,
                lease.generation,
                40,
                Duration::from_millis(100),
            )
            .unwrap();
        assert_advanced(&registry, &mut previous);
        registry
            .release_control(&key, ControlChannel::Input, &client, lease.generation)
            .unwrap();
        assert_advanced(&registry, &mut previous);
        registry.set_unsettled(&key, false).unwrap();
        assert_advanced(&registry, &mut previous);
        registry
            .set_mobile_driven_for_client(&key, &client.id, false)
            .unwrap();
        assert_advanced(&registry, &mut previous);
        registry
            .set_foreground_for_client(&key, &client.id, false)
            .unwrap();
        assert_advanced(&registry, &mut previous);
        registry
            .set_focus_for_client(&key, &client.id, false)
            .unwrap();
        assert_advanced(&registry, &mut previous);
        registry.detach_observer(&key, &client.id).unwrap();
        assert_advanced(&registry, &mut previous);
    }

    #[test]
    fn client_scoped_guards_survive_another_client_blurring() {
        let registry = AgentLifecycleRegistry::new();
        let key = key("workspace", "session", "agent");
        registry
            .register(registration(key.clone(), "claude", true))
            .unwrap();

        registry.set_focus(&key, "desktop", true).unwrap();
        registry.set_focus(&key, "mobile", true).unwrap();
        registry.set_focus(&key, "desktop", false).unwrap();
        let snapshot = registry.get(&key).unwrap();
        assert!(snapshot.focused_by.is_some());
        assert_eq!(snapshot.focused_clients, ["mobile".to_string()].into());

        registry
            .set_foreground_for_client(&key, "desktop", true)
            .unwrap();
        registry
            .set_foreground_for_client(&key, "mobile", true)
            .unwrap();
        registry
            .set_foreground_for_client(&key, "desktop", false)
            .unwrap();
        assert!(registry.get(&key).unwrap().foreground);

        registry
            .set_mobile_driven_for_client(&key, "desktop", true)
            .unwrap();
        registry
            .set_mobile_driven_for_client(&key, "mobile", true)
            .unwrap();
        registry
            .set_mobile_driven_for_client(&key, "desktop", false)
            .unwrap();
        let snapshot = registry.get(&key).unwrap();
        assert!(snapshot.mobile_driven);

        registry.set_focus(&key, "mobile", false).unwrap();
        registry
            .set_foreground_for_client(&key, "mobile", false)
            .unwrap();
        registry
            .set_mobile_driven_for_client(&key, "mobile", false)
            .unwrap();
        let snapshot = registry.get(&key).unwrap();
        assert!(!snapshot.foreground);
        assert!(!snapshot.mobile_driven);
    }

    #[test]
    fn observer_and_restore_capacities_are_bounded() {
        let registry = AgentLifecycleRegistry::new();
        let agent_key = key("workspace", "session", "agent");
        registry
            .register(registration(agent_key.clone(), "claude", true))
            .unwrap();
        for index in 0..MAX_OBSERVERS {
            let observer = client(&format!("observer-{index}"), ClientKind::Desktop);
            registry.attach_observer(&agent_key, &observer).unwrap();
        }
        let extra = client("observer-extra", ClientKind::Desktop);
        assert!(matches!(
            registry.attach_observer(&agent_key, &extra),
            Err(LifecycleError::ObserverCapacity)
        ));

        let snapshots = (0..=MAX_AGENTS).map(|index| {
            AgentRecord::from_registration(registration(
                key("workspace", &format!("session-{index}"), "agent"),
                "claude",
                true,
            ))
            .snapshot()
        });
        assert!(matches!(
            AgentLifecycleRegistry::restore(snapshots, 900),
            Err(LifecycleError::Capacity)
        ));
    }

    #[test]
    fn hibernation_fails_closed_for_every_active_guard_then_wakes_same_session() {
        let registry = AgentLifecycleRegistry::new();
        let key = key("workspace", "session", "agent");
        registry
            .register(registration(key.clone(), "claude", true))
            .unwrap();
        let policy = HibernationPolicy::new(Duration::from_millis(100));

        registry.signal(&key, ProviderSignal::Started, 200).unwrap();
        let decision = registry.hibernation_decision(&key, policy, 500).unwrap();
        assert!(decision
            .blockers
            .contains(&HibernationBlocker::StateNotFinished(AgentState::Working)));

        registry
            .signal(
                &key,
                ProviderSignal::Completed {
                    reason: "finished".to_string(),
                },
                300,
            )
            .unwrap();
        registry.set_unsettled(&key, true).unwrap();
        let decision = registry.hibernation_decision(&key, policy, 500).unwrap();
        assert!(decision
            .blockers
            .contains(&HibernationBlocker::UnsettledOrchestration));
        registry.set_unsettled(&key, false).unwrap();
        let owner = client("owner", ClientKind::Desktop);
        let lease = registry
            .acquire_control(&key, ControlChannel::Input, owner.clone(), 301)
            .unwrap();
        let decision = registry.hibernation_decision(&key, policy, 500).unwrap();
        assert!(decision.blockers.contains(&HibernationBlocker::InputOwned));
        registry
            .release_control(&key, ControlChannel::Input, &owner, lease.generation)
            .unwrap();
        registry.set_focus(&key, "owner", true).unwrap();
        assert!(registry
            .hibernation_decision(&key, policy, 500)
            .unwrap()
            .blockers
            .contains(&HibernationBlocker::Focused));
        registry.set_focus(&key, "owner", false).unwrap();
        registry.set_foreground(&key, true).unwrap();
        assert!(registry
            .hibernation_decision(&key, policy, 500)
            .unwrap()
            .blockers
            .contains(&HibernationBlocker::Foreground));
        registry.set_foreground(&key, false).unwrap();
        registry.set_mobile_driven(&key, true).unwrap();
        assert!(registry
            .hibernation_decision(&key, policy, 500)
            .unwrap()
            .blockers
            .contains(&HibernationBlocker::MobileDriven));
        registry.set_mobile_driven(&key, false).unwrap();
        let transition = registry.hibernate(&key, policy, 500).unwrap();
        assert_eq!(transition.to, AgentState::Sleeping);
        let wake = registry.wake(&key, 600).unwrap();
        assert_eq!(wake.transition.to, AgentState::Reconnecting);
        assert_eq!(
            wake.action,
            ResumeAction::ExistingSession("provider-session".to_string())
        );
    }

    #[test]
    fn hibernation_reservation_blocks_new_activity_until_runtime_stop_commits() {
        let registry = AgentLifecycleRegistry::new();
        let key = key("workspace", "reservation-session", "agent");
        registry
            .register(registration(key.clone(), "claude", true))
            .unwrap();
        registry.signal(&key, ProviderSignal::Started, 200).unwrap();
        registry
            .signal(
                &key,
                ProviderSignal::Completed {
                    reason: "finished".to_string(),
                },
                300,
            )
            .unwrap();

        let lease = registry
            .begin_hibernation(&key, HibernationPolicy::new(Duration::ZERO), 400)
            .unwrap();
        assert!(matches!(
            registry.signal(&key, ProviderSignal::Output { bytes: 1 }, 401),
            Err(LifecycleError::HibernationInProgress(_))
        ));
        assert!(matches!(
            registry.set_focus(&key, "late-client", true),
            Err(LifecycleError::HibernationInProgress(_))
        ));
        assert!(matches!(
            registry.acquire_control(
                &key,
                ControlChannel::Input,
                client("late-owner", ClientKind::Desktop),
                402,
            ),
            Err(OwnershipError::Lifecycle(
                LifecycleError::HibernationInProgress(_)
            ))
        ));
        assert!(matches!(
            registry.transition(&key, AgentState::Idle, "late transition", 403),
            Err(LifecycleError::HibernationInProgress(_))
        ));
        let transition = registry
            .commit_hibernation(lease, HibernationPolicy::new(Duration::ZERO), 404)
            .unwrap();
        assert_eq!(transition.to, AgentState::Sleeping);
    }

    #[test]
    fn restore_turns_transient_states_into_reconnecting_and_clears_client_leases() {
        let registry = AgentLifecycleRegistry::new();
        let key = key("workspace", "session", "agent");
        registry
            .register(registration(key.clone(), "claude", true))
            .unwrap();
        registry.signal(&key, ProviderSignal::Started, 200).unwrap();
        let owner = client("owner", ClientKind::Desktop);
        registry
            .acquire_control(&key, ControlChannel::Input, owner, 201)
            .unwrap();
        let snapshot = registry.get(&key).unwrap();
        let restored = AgentLifecycleRegistry::restore([snapshot], 900).unwrap();
        let restored_snapshot = restored.get(&key).unwrap();
        assert_eq!(restored_snapshot.state, AgentState::Reconnecting);
        assert!(restored_snapshot.input_owner.is_none());
        assert!(restored_snapshot.observers.is_empty());
        assert_eq!(
            restored_snapshot.provider_session_id.as_deref(),
            Some("provider-session")
        );
    }

    #[test]
    fn transition_history_is_bounded() {
        let registry = AgentLifecycleRegistry::with_limits(1, 2).unwrap();
        let key = key("workspace", "session", "agent");
        registry
            .register(registration(key.clone(), "claude", true))
            .unwrap();
        for index in 0..8 {
            registry
                .signal(&key, ProviderSignal::Started, 200 + index * 2)
                .unwrap();
            registry
                .signal(
                    &key,
                    ProviderSignal::Completed {
                        reason: format!("turn {index}"),
                    },
                    201 + index * 2,
                )
                .unwrap();
        }
        assert_eq!(registry.get(&key).unwrap().recent_transitions.len(), 2);
    }
}

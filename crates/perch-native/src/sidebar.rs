//! What the sidebar shows, reduced from the core's messages. No GPUI and no I/O: messages go
//! into [`State`], [`State::model`] comes out.
//!
//! The core owns every fact: which sessions exist, their order (`workspace.order`), their
//! state (`session.*`, `attention.snapshot`), their checkouts (`workspace.snapshot`) and whether
//! a remote computer is reachable (`host.info`). Nothing here guesses. When the core cannot be
//! reached, or a computer is not connected, a session keeps its row but claims no state
//! ([`SessionView::attention`] is `None`): last-known state is never shown as current, and nothing
//! is ever marked exited.
//!
//! The rules mirror the web client's `attention.ts`, `statusView.ts`, `sidebarOrder.ts` and
//! `navigation.ts`.

use crate::settings::TerminalSettings;
use perch_core::agent_fleet::TERMINAL_PROVIDER;
use perch_core::protocol::{
    AttentionEvent, ProjectSummary, ServerMessage, SessionStatus, SessionSummary, SshHostEntry,
    WorkspaceState, WorkspaceSummary,
};
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap, HashSet};

/// The host id of the computer the core runs on.
pub const LOCAL: &str = "local";
/// Capability under which the core sends `attention.snapshot`.
const ATTENTION_CAPABILITY: &str = "attention.v1";
/// Capability under which the core answers `workspace.snapshot`.
const WORKSPACE_CAPABILITY: &str = "workspace.snapshot";

/// A session's state, from most to least urgent.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Attention {
    NeedsYou,
    Done,
    Working,
    Idle,
}

impl Attention {
    /// The visible word. Idle is unlabelled.
    pub fn label(self) -> Option<&'static str> {
        match self {
            Attention::NeedsYou => Some("Needs you"),
            Attention::Done => Some("Done"),
            Attention::Working => Some("Working"),
            Attention::Idle => None,
        }
    }

    /// The By status heading, which names every state including Idle.
    pub fn heading(self) -> &'static str {
        match self {
            Attention::NeedsYou => "Needs you",
            Attention::Done => "Done",
            Attention::Working => "Working",
            Attention::Idle => "Idle",
        }
    }
}

/// Something the client asks the core for because of what it just read.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Request {
    /// The mods state, which carries `keys.json`.
    Mods,
    Attention,
    Projects(String),
    Providers(String),
    Workspaces(String),
}

/// What a session's change is worth telling.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Alert {
    /// A session finished a turn.
    Done,
    /// A session is waiting on an answer.
    Blocked,
}

/// How a toast is delivered (`toastDelivery`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Toast {
    Off,
    /// A message in the window.
    App,
    /// A system notification.
    System,
}

impl Toast {
    fn parse(how: &str) -> Self {
        match how {
            "off" => Self::Off,
            "system" => Self::System,
            _ => Self::App,
        }
    }
}

/// A session finished or needs the person while they are not looking at it: the app plays the
/// sound and shows the toast. The follower only reports it; it never plays or shows anything.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Heard {
    pub alert: Alert,
    pub session_id: String,
    pub title: String,
    /// Sounds are on. `file` is the person's own sound for this alert, when they chose one that
    /// can be played; otherwise the system's alert sounds.
    pub sound: bool,
    pub file: Option<std::path::PathBuf>,
    pub toast: Toast,
}

impl Heard {
    /// What the toast says.
    pub fn text(&self) -> String {
        let what = match self.alert {
            Alert::Done => "finished",
            Alert::Blocked => "needs you",
        };
        format!("{} {what}", self.title)
    }
}

/// An agent (or the plain terminal) a session can start with.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Provider {
    pub id: String,
    pub name: String,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct SessionView {
    pub id: String,
    pub host_id: String,
    pub title: String,
    /// Who runs in it: an agent's name, or "Terminal".
    pub provider: String,
    /// The provider the session was launched with (`cliProviderId`), which attaching a terminal
    /// must name again. Not what runs in the terminal now: that is only the name shown. `None`
    /// when the core records none, and then nothing is attached or ended on a guess.
    pub provider_id: Option<String>,
    /// Whether anything was ever started in it (`cliStarted`). With no `provider_id` it tells a
    /// session nobody launched anything in (the tab offers the choices) from one the core
    /// started without recording who (nothing is attached on a guess).
    pub cli_started: bool,
    /// The provider the core sees running in it now (`currentProviderId`): an agent typed into a
    /// shell makes it one. Closing a tab warns by this; attaching never uses it.
    pub current_provider_id: Option<String>,
    /// `None` when the core or the computer cannot be reached.
    pub attention: Option<Attention>,
    pub project_id: Option<String>,
    pub workspace_id: Option<String>,
    /// The lead this is a sub-session of.
    pub parent: Option<String>,
    /// Drawn under its lead, which is listed just above.
    pub nested: bool,
    /// Which checkout, when its project has several.
    pub workspace_label: Option<String>,
    /// Why it needs you, while it does.
    pub need_reason: Option<String>,
}

/// One checkout of a project, shown when the project has more than one.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct WorkspaceView {
    pub id: String,
    pub name: String,
    pub path: String,
    pub branch: Option<String>,
    pub dirty: bool,
    pub pinned: bool,
    pub sleeping: bool,
    /// A linked worktree rather than the main checkout.
    pub linked: bool,
    /// How deep it nests under another worktree.
    pub depth: usize,
    pub sessions: Vec<SessionView>,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct ProjectView {
    pub id: String,
    pub name: String,
    /// Folder on the project's computer; empty for a group of sessions the core lists no project for.
    pub path: String,
    /// Chats: sessions started with no project, all listed.
    pub quickchat: bool,
    pub favorite: bool,
    /// Sessions drawn straight under the project: all of them when the project shows no
    /// checkouts of its own, otherwise the ones that belong to none of them.
    pub sessions: Vec<SessionView>,
    /// The project's checkouts, when it has more than one (or a linked one).
    pub workspaces: Vec<WorkspaceView>,
    /// The most urgent state among every session of the project, `None` when it cannot be stated.
    pub top: Option<Attention>,
    /// How many sessions are in that state.
    pub top_count: usize,
}

/// Chats of one project inside a By status section.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct StatusCluster {
    pub project_id: Option<String>,
    pub name: String,
    pub quickchat: bool,
    pub sessions: Vec<SessionView>,
}

/// A By status section. `attention` is `None` for "Offline: last known", which claims no state.
#[derive(Clone, Debug, PartialEq)]
pub struct StatusSection {
    pub attention: Option<Attention>,
    pub title: String,
    pub note: Option<String>,
    pub count: usize,
    pub clusters: Vec<StatusCluster>,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct HostView {
    pub id: String,
    pub name: String,
    /// `connected`, `connecting`, `error`, `disabled`, or `unknown` while the core is unreachable.
    pub state: String,
    pub reachable: bool,
    /// What the computer is: hostname and platform, or where it is reached.
    pub detail: Option<String>,
    /// Why the connection failed, while it did.
    pub error: Option<String>,
    /// Direct mode: no Perch on the other end.
    pub direct: bool,
    /// Whether a configured computer is turned on; `None` for this one.
    pub enabled: Option<bool>,
    pub projects: Vec<ProjectView>,
    /// By status: sections in fixed order, each split by project.
    pub status: Vec<StatusSection>,
    /// Projects with no listed session, which By status lists last.
    pub empty_projects: Vec<ProjectView>,
    /// Terminal first, then the agents the computer can start.
    pub providers: Vec<Provider>,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct Model {
    /// Whether the connection to the core is up.
    pub connected: bool,
    /// Why it is not, when the last attempt said.
    pub offline_reason: Option<String>,
    /// The core's address as the browser UI uses it, while connected.
    pub core_url: Option<String>,
    /// Sessions that need you on reachable computers, listed or not.
    pub needs_you: usize,
    /// Their ids in the order Next and Previous visit them: questions first, then failures,
    /// longest-waiting first, then any other blocked session.
    pub needing: Vec<String>,
    pub hosts: Vec<HostView>,
    /// The person's key choices by action id (`settings.keybindings`).
    pub keybindings: BTreeMap<String, String>,
    /// `keys.json` as the core checked it, while there is one.
    pub keys_file: Option<Value>,
    /// The terminal settings, once the core has sent them.
    pub terminal: Option<Box<TerminalSettings>>,
}

/// What `host.info` said about a remote computer.
#[derive(Default)]
struct HostFacts {
    state: String,
    error: Option<String>,
}

#[derive(Default)]
pub struct State {
    connected: bool,
    offline_reason: Option<String>,
    /// Set by whoever connects: the address of the core being followed.
    pub core_url: Option<String>,
    /// List plain terminals started inside a project (Show terminals).
    pub show_terminals: bool,
    /// The computers the core is configured with.
    host_entries: Vec<SshHostEntry>,
    host_facts: HashMap<String, HostFacts>,
    /// This computer, from `server.info`: hostname and platform.
    machine: Option<String>,
    local_capabilities: Vec<String>,
    projects: Vec<ProjectSummary>,
    workspaces: Vec<WorkspaceSummary>,
    sessions: Vec<SessionSummary>,
    /// A `session.list` has been read on this connection, so a `session.updated` can be compared
    /// with what was known.
    listed: bool,
    /// Per computer, the core's order of project ids and session ids.
    order: HashMap<String, (Vec<String>, Vec<String>)>,
    needs: HashSet<String>,
    needs_events: Vec<AttentionEvent>,
    providers: HashMap<String, Vec<Provider>>,
    /// The session the window shows, and the one kept in Done while it is read.
    viewing: Option<String>,
    viewed_dot: Option<(String, Option<Dot>)>,
    held: Option<String>,
    sound_enabled: bool,
    window_active: bool,
    alerts: Vec<Heard>,
    /// Where the person's own sound files are: the folder that holds `mods/`.
    sounds_in: Option<std::path::PathBuf>,
    keybindings: BTreeMap<String, String>,
    keys_file: Option<Value>,
    terminal: Option<Box<TerminalSettings>>,
}

/// `statusDot.sessionDotState`: what the session itself reports, before the core's attention facts.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Dot {
    Blocked,
    Working,
    Done,
    Idle,
}

fn dot(session: &SessionSummary) -> Dot {
    // Stale means busy but silent for 30 minutes: read as idle.
    if session.blocked && !session.stale {
        Dot::Blocked
    } else if session.status == SessionStatus::Running && !session.stale {
        Dot::Working
    } else if session.unseen {
        Dot::Done
    } else {
        Dot::Idle
    }
}

/// `statusView.sectionOf`: a blocked or question-asking agent needs you, a running one is
/// working, a finished one nobody has looked at (or that is being read) is done.
fn section(session: &SessionSummary, needs: &HashSet<String>, held: Option<&str>) -> Attention {
    let dot = dot(session);
    if dot == Dot::Blocked || needs.contains(&session.id) {
        Attention::NeedsYou
    } else if dot == Dot::Working {
        Attention::Working
    } else if dot == Dot::Done || held == Some(session.id.as_str()) {
        Attention::Done
    } else {
        Attention::Idle
    }
}

/// `statusView.holdFinished`: the chat to keep in Done while it is on screen. Reading a finished
/// chat marks it seen, which would drop it to Idle under the person's eyes; it stays in Done until
/// they leave it or it starts working again. `previous` is the viewed chat's state at the last
/// call (`None` right after switching to it).
fn hold_finished(
    held: Option<&str>,
    viewed: Option<&str>,
    previous: Option<Dot>,
    state: Option<Dot>,
) -> Option<String> {
    let (viewed, state) = (viewed?, state?);
    if matches!(state, Dot::Working | Dot::Blocked) {
        return None;
    }
    if held == Some(viewed) {
        return held.map(str::to_string);
    }
    let just_finished = matches!(previous, Some(Dot::Working | Dot::Blocked));
    (state == Dot::Done || (state == Dot::Idle && just_finished)).then(|| viewed.to_string())
}

/// `nextNeeding` both ways: the id after (or, with a negative `step`, before) `current`,
/// wrapping; the first (last) when `current` is not among them; `None` when there is nothing to
/// go to but the session already open.
pub fn step_needing(ids: &[String], current: Option<&str>, step: i32) -> Option<String> {
    let len = ids.len() as i32;
    if len == 0 {
        return None;
    }
    let at = current.and_then(|c| ids.iter().position(|id| id == c));
    let to = match (at, step >= 0) {
        (Some(at), true) => (at as i32 + 1) % len,
        (Some(at), false) => (at as i32 - 1 + len) % len,
        (None, true) => 0,
        (None, false) => len - 1,
    };
    let next = &ids[to as usize];
    (Some(next.as_str()) != current).then(|| next.clone())
}

impl State {
    /// The socket is up. What the core sends next replaces what is shown, so nothing from
    /// before the drop outlives its first answer.
    pub fn connect(&mut self) {
        self.connected = true;
        self.offline_reason = None;
        self.host_facts.clear();
        // A change seen against a list from before the drop would be a guess.
        self.listed = false;
    }

    /// The socket is gone, or never came up (`reason`). Rows stay, with no state claimed.
    pub fn disconnect(&mut self, reason: Option<String>) {
        self.connected = false;
        self.offline_reason = reason;
        self.core_url = None;
    }

    /// The session the window shows. It is read: the core clears its Done mark when asked, and
    /// until the person leaves it, it stays in Done.
    pub fn view(&mut self, session_id: &str) {
        self.viewing = Some(session_id.to_string());
        self.track_viewed();
    }

    pub fn viewing(&self) -> Option<&str> {
        self.viewing.as_deref()
    }

    /// Whether the window is the one the person is looking at.
    pub fn set_window_active(&mut self, active: bool) {
        self.window_active = active;
    }

    /// The sounds and toasts due since the last call.
    pub fn take_alerts(&mut self) -> Vec<Heard> {
        std::mem::take(&mut self.alerts)
    }

    /// The frame that turns a configured computer on or off: its entry as the core sent it, with
    /// only `enabled` changed. `None` for this computer or one the core does not list.
    pub fn host_enabled_frame(&self, host_id: &str, enabled: bool) -> Option<Value> {
        let mut host = self.host_entries.iter().find(|h| h.id == host_id)?.clone();
        host.enabled = enabled;
        Some(json!({"type": "hosts.upsert", "host": host}))
    }

    /// Fold one message from the core in. Returns what to ask for next.
    pub fn apply(&mut self, message: &ServerMessage) -> Vec<Request> {
        let mut asks = Vec::new();
        match message {
            ServerMessage::ServerInfo {
                capabilities,
                hostname,
                platform,
                ..
            } => {
                // An older core sends no attention events: only the sessions' own flags speak.
                self.needs.clear();
                self.needs_events.clear();
                self.machine = Some(format!("{hostname} · {platform}"));
                self.local_capabilities.clone_from(capabilities);
                if has(capabilities, ATTENTION_CAPABILITY) {
                    asks.push(Request::Attention);
                }
                if has(capabilities, WORKSPACE_CAPABILITY) {
                    asks.push(Request::Workspaces(LOCAL.into()));
                }
            }
            ServerMessage::SessionList { sessions } => {
                self.sessions = sessions.clone();
                self.listed = true;
            }
            ServerMessage::SessionUpdated { session } => self.session_updated(session),
            ServerMessage::SessionDeleted { session_id } => {
                self.sessions.retain(|s| s.id != *session_id)
            }
            ServerMessage::ProjectList {
                host_id, projects, ..
            } => {
                self.projects.retain(|p| p.host_id != *host_id);
                self.projects.extend(projects.iter().cloned().map(|mut p| {
                    p.host_id.clone_from(host_id);
                    p
                }));
            }
            ServerMessage::ProjectUpdated { project, .. } => {
                match self.projects.iter_mut().find(|p| p.id == project.id) {
                    Some(known) => *known = project.clone(),
                    None => self.projects.push(project.clone()),
                }
            }
            ServerMessage::ProjectDeleted {
                project_id,
                host_id,
                ..
            } => self
                .projects
                .retain(|p| !(p.id == *project_id && p.host_id == *host_id)),
            ServerMessage::WorkspaceSnapshot {
                host_id,
                workspaces,
                ..
            } => {
                self.workspaces.retain(|w| w.host_id != *host_id);
                self.workspaces.extend(workspaces.iter().cloned());
            }
            ServerMessage::WorkspaceUpdated { workspace, .. } => {
                match self.workspaces.iter_mut().find(|w| w.id == workspace.id) {
                    Some(known) => *known = workspace.clone(),
                    None => self.workspaces.push(workspace.clone()),
                }
            }
            ServerMessage::WorkspaceOrder {
                host_id,
                projects,
                sessions,
                ..
            } => {
                self.order
                    .insert(host_id.clone(), (projects.clone(), sessions.clone()));
            }
            ServerMessage::AttentionSnapshot { events } => {
                self.needs = needing(events);
                self.needs_events.clone_from(events);
            }
            ServerMessage::HostsList { hosts } | ServerMessage::HostsUpdated { hosts } => {
                self.host_entries.clone_from(hosts);
            }
            ServerMessage::HostInfo {
                host_id,
                state,
                error,
                capabilities,
                ..
            } => {
                let was = self.host_facts.insert(
                    host_id.clone(),
                    HostFacts {
                        state: state.clone(),
                        error: error.clone(),
                    },
                );
                if state == "connected" && was.is_none_or(|was| was.state != "connected") {
                    asks.push(Request::Projects(host_id.clone()));
                    asks.push(Request::Providers(host_id.clone()));
                    if capabilities
                        .as_deref()
                        .is_some_and(|c| has(c, WORKSPACE_CAPABILITY))
                    {
                        asks.push(Request::Workspaces(host_id.clone()));
                    }
                }
            }
            ServerMessage::SettingsCurrent { settings } => {
                self.sound_enabled = settings.sound_enabled;
                self.keybindings.clone_from(&settings.keybindings);
                self.terminal = Some(Box::new(TerminalSettings::from_wire(settings)));
            }
            ServerMessage::ModsState { keys, folder, .. } => {
                self.keys_file.clone_from(keys);
                self.sounds_in = std::path::Path::new(folder).parent().map(Into::into);
            }
            ServerMessage::ModsChanged {} => asks.push(Request::Mods),
            ServerMessage::AgentManifestList {
                host_id, manifests, ..
            } => {
                let choices = manifests
                    .iter()
                    .filter(|m| {
                        m.available
                            && m.enabled != Some(false)
                            && m.id != TERMINAL_PROVIDER
                            && m.supported_modes.iter().any(|mode| mode == "cli")
                            && m.capabilities.iter().any(|c| c == "interactiveTerminal")
                    })
                    .map(|m| Provider {
                        id: m.id.clone(),
                        name: m.display_name.clone(),
                    })
                    .collect();
                self.providers
                    .insert(host_id.clone().unwrap_or_else(|| LOCAL.into()), choices);
            }
            _ => return asks,
        }
        self.track_viewed();
        asks
    }

    /// A session changed. When it finished a turn or became blocked, and the person is not
    /// already looking at it, that is worth a sound (`store.session.updated`). Only a change to a
    /// session already known on this connection counts: a list or a reconnect says nothing.
    fn session_updated(&mut self, session: &SessionSummary) {
        let previous = self.sessions.iter().position(|s| s.id == session.id);
        if let (true, Some(at)) = (self.listed, previous) {
            let before = &self.sessions[at];
            let blocked = !before.blocked && session.blocked;
            let done =
                before.status == SessionStatus::Running && session.status == SessionStatus::Idle;
            let viewed = self.viewing.as_deref() == Some(session.id.as_str());
            if (blocked || done) && (!viewed || !self.window_active) {
                let alert = if blocked { Alert::Blocked } else { Alert::Done };
                let settings = self.terminal.as_deref();
                let toast = settings.map_or(Toast::App, |t| Toast::parse(&t.toast_delivery));
                let chosen = settings.map(|t| match alert {
                    Alert::Done => t.sound_done.as_str(),
                    Alert::Blocked => t.sound_blocked.as_str(),
                });
                if self.sound_enabled || toast != Toast::Off {
                    self.alerts.push(Heard {
                        alert,
                        session_id: session.id.clone(),
                        title: session.title.clone(),
                        sound: self.sound_enabled,
                        file: self
                            .sounds_in
                            .as_deref()
                            .zip(chosen)
                            .and_then(|(folder, rel)| crate::sound::file_in(folder, rel)),
                        toast,
                    });
                }
            }
        }
        match previous {
            Some(at) => self.sessions[at] = session.clone(),
            None => self.sessions.insert(0, session.clone()),
        }
    }

    /// Re-read the viewed session's state for the Done hold.
    fn track_viewed(&mut self) {
        let Some(viewing) = self.viewing.clone() else {
            self.held = None;
            self.viewed_dot = None;
            return;
        };
        let now = self.sessions.iter().find(|s| s.id == viewing).map(dot);
        let same = self
            .viewed_dot
            .as_ref()
            .is_some_and(|(id, _)| *id == viewing);
        let previous = self
            .viewed_dot
            .as_ref()
            .filter(|_| same)
            .and_then(|(_, d)| *d);
        let held = self.held.take().filter(|_| same);
        self.held = hold_finished(held.as_deref(), Some(&viewing), previous, now);
        self.viewed_dot = Some((viewing, now));
    }

    fn reachable(&self, host_id: &str) -> bool {
        self.connected
            && (host_id == LOCAL
                || self.host_facts.get(host_id).map(|f| f.state.as_str()) == Some("connected"))
    }

    /// Sessions that need you on reachable computers, in the order Next visits them.
    fn needing_ids(&self) -> Vec<String> {
        let live: Vec<&SessionSummary> = self
            .sessions
            .iter()
            .filter(|s| self.reachable(&s.host_id))
            .filter(|s| section(s, &self.needs, None) == Attention::NeedsYou)
            .collect();
        let mut events: Vec<&AttentionEvent> = self
            .needs_events
            .iter()
            .filter(|e| e.requires_action || e.kind == "question")
            .collect();
        // Questions before failures, the longest wait first within each.
        events.sort_by_key(|e| (e.kind != "question", e.occurred_at));
        let mut ids: Vec<String> = Vec::new();
        for id in events.iter().map(|e| &e.session_id) {
            if live.iter().any(|s| s.id == *id) && !ids.contains(id) {
                ids.push(id.clone());
            }
        }
        for session in live {
            if !ids.contains(&session.id) {
                ids.push(session.id.clone());
            }
        }
        ids
    }

    pub fn model(&self) -> Model {
        let mut hosts = vec![(LOCAL.to_string(), "This computer".to_string())];
        hosts.extend(
            self.host_entries
                .iter()
                .filter(|h| h.id != LOCAL)
                .map(|h| (h.id.clone(), h.name.clone())),
        );
        let hosts: Vec<HostView> = hosts
            .into_iter()
            .map(|(id, name)| self.host_view(id, name))
            .collect();
        // Every session on a reachable computer counts, whether or not its row is listed.
        let needing = self.needing_ids();
        Model {
            connected: self.connected,
            offline_reason: self.offline_reason.clone(),
            core_url: self.core_url.clone(),
            needs_you: needing.len(),
            needing,
            hosts,
            keybindings: self.keybindings.clone(),
            keys_file: self.keys_file.clone(),
            terminal: self.terminal.clone(),
        }
    }

    /// A project's live checkouts as the sidebar lists them: pinned first, then active, then the
    /// most recently used (`workspacesForProject`); archived and hidden ones are left out.
    fn shown_workspaces(&self, project_id: &str) -> Vec<&WorkspaceSummary> {
        let mut shown: Vec<&WorkspaceSummary> = self
            .workspaces
            .iter()
            .filter(|w| w.project_id == project_id && w.state != WorkspaceState::Archived)
            .filter(|w| !w.hidden)
            .collect();
        shown.sort_by_key(|w| {
            (
                !w.pinned,
                w.state != WorkspaceState::Active,
                std::cmp::Reverse(w.updated_at),
            )
        });
        shown
    }

    fn host_view(&self, id: String, name: String) -> HostView {
        let reachable = self.reachable(&id);
        let entry = self.host_entries.iter().find(|h| h.id == id);
        let facts = self.host_facts.get(&id);
        // Before the core reports on a configured computer, it is on its way up (or switched off).
        let state = if !self.connected {
            "unknown".to_string()
        } else if id == LOCAL {
            "connected".to_string()
        } else {
            facts.map_or_else(
                || {
                    if entry.is_none_or(|e| e.enabled) {
                        "connecting"
                    } else {
                        "disabled"
                    }
                    .to_string()
                },
                |f| f.state.clone(),
            )
        };
        let detail = match entry {
            _ if id == LOCAL => self.machine.clone(),
            Some(e) if e.mode == "direct" => Some(format!("{} (direct)", e.ssh_host)),
            Some(e) => Some(
                e.direct_url
                    .clone()
                    .filter(|u| !u.is_empty())
                    .unwrap_or_else(|| format!("{}:{}", e.ssh_host, e.remote_port)),
            ),
            None => None,
        };
        let (project_order, session_order) = self
            .order
            .get(&id)
            .map_or((&[][..], &[][..]), |(p, s)| (p, s));
        let mut projects = order_by(
            self.projects.iter().filter(|p| p.host_id == id).collect(),
            project_order,
            |p| &p.id,
        );
        // Favourites first, then the core's order; Chats last.
        projects.sort_by_key(|p| (is_chats(p), !p.favorite));
        let sessions = order_by(
            self.sessions
                .iter()
                .filter(|s| s.host_id == id)
                .collect::<Vec<_>>(),
            session_order,
            |s| &s.id,
        );

        // Every listed session, with the index of its project (`None`: one the core lists no
        // project for, shown under Other).
        let mut rows: Vec<(Option<usize>, &SessionSummary, SessionView)> = Vec::new();
        for session in sessions {
            let at = projects
                .iter()
                .position(|p| Some(p.id.as_str()) == session.project_id.as_deref());
            let quickchat = at.is_some_and(|at| is_chats(projects[at]));
            if quickchat || self.show_terminals || listed(session) {
                rows.push((at, session, self.session_view(session, reachable)));
            }
        }
        let own = |at: Option<usize>| -> Vec<SessionView> {
            rows.iter()
                .filter(|r| r.0 == at)
                .map(|r| r.2.clone())
                .collect()
        };

        let mut views: Vec<ProjectView> = projects
            .iter()
            .enumerate()
            .map(|(at, p)| self.project_view(Some(p), own(Some(at))))
            .collect();
        let other = own(None);
        if !other.is_empty() {
            views.push(self.project_view(None, other));
        }

        let empty_projects = views
            .iter()
            .zip(&projects)
            .filter(|(_, p)| !is_chats(p))
            .filter(|(_, p)| {
                !rows
                    .iter()
                    .any(|r| r.1.project_id.as_deref() == Some(&p.id))
            })
            .map(|(v, _)| v.clone())
            .collect();

        // By status: newest first, from the core's order reversed.
        let mut newest: Vec<&SessionSummary> = rows.iter().map(|r| r.1).collect();
        newest.sort_by_key(|s| std::cmp::Reverse(s.created_at));
        let reversed: Vec<String> = session_order.iter().rev().cloned().collect();
        let newest = order_by(newest, &reversed, |s| &s.id);
        let by_session: HashMap<&str, &(Option<usize>, &SessionSummary, SessionView)> =
            rows.iter().map(|r| (r.1.id.as_str(), r)).collect();
        // Project headings in the sidebar's project order, Other last.
        let clusters = |members: &[&SessionSummary]| -> Vec<StatusCluster> {
            (0..projects.len())
                .map(Some)
                .chain([None])
                .filter_map(|at| {
                    let sessions: Vec<SessionView> = members
                        .iter()
                        .filter_map(|s| by_session.get(s.id.as_str()))
                        .filter(|r| r.0 == at)
                        .map(|r| r.2.clone())
                        .collect();
                    let project = at.map(|at| projects[at]);
                    (!sessions.is_empty()).then(|| StatusCluster {
                        project_id: project.map(|p| p.id.clone()),
                        name: project.map_or_else(|| "Other".into(), project_name),
                        quickchat: project.is_some_and(is_chats),
                        sessions: nest_under_leads(sessions),
                    })
                })
                .collect()
        };
        let status = if !reachable {
            // What these were doing is unknown: shown once, as last known, never as Working.
            let all: Vec<&SessionSummary> = newest.clone();
            if all.is_empty() {
                Vec::new()
            } else {
                vec![StatusSection {
                    attention: None,
                    title: "Offline: last known".into(),
                    note: Some(if id == LOCAL {
                        "Reconnecting…".to_string()
                    } else {
                        format!("{name}: {state}")
                    }),
                    count: all.len(),
                    clusters: clusters(&all),
                }]
            }
        } else {
            [
                Attention::NeedsYou,
                Attention::Done,
                Attention::Working,
                Attention::Idle,
            ]
            .into_iter()
            .filter_map(|wanted| {
                let members: Vec<&SessionSummary> = newest
                    .iter()
                    .copied()
                    .filter(|s| by_session[s.id.as_str()].2.attention == Some(wanted))
                    .collect();
                (!members.is_empty()).then(|| StatusSection {
                    attention: Some(wanted),
                    title: wanted.heading().into(),
                    note: None,
                    count: members.len(),
                    clusters: clusters(&members),
                })
            })
            .collect()
        };

        let mut providers = vec![Provider {
            id: TERMINAL_PROVIDER.into(),
            name: "Terminal".into(),
        }];
        providers.extend(self.providers.get(&id).cloned().unwrap_or_default());
        HostView {
            enabled: entry.map(|e| e.enabled),
            direct: entry.is_some_and(|e| e.mode == "direct"),
            error: facts
                .and_then(|f| f.error.clone())
                .filter(|_| state == "error"),
            detail,
            id,
            name,
            state,
            reachable,
            projects: views,
            status,
            empty_projects,
            providers,
        }
    }

    /// A project row: its sessions and, when it has several checkouts, each checkout's. `None` is
    /// the group of sessions the core lists no project for.
    fn project_view(&self, project: Option<&ProjectSummary>, own: Vec<SessionView>) -> ProjectView {
        let top = own
            .iter()
            .filter_map(|s| s.attention)
            .min_by_key(|a| *a as u8);
        let top_count = own.iter().filter(|s| s.attention == top).count();
        let quickchat = project.is_some_and(is_chats);
        // The tree of checkouts: a worktree under another linked worktree nests under it, up
        // to eight levels. One plain checkout has no row of its own: the project row stands in.
        let shown = match project {
            Some(project) if !quickchat => self.shown_workspaces(&project.id),
            _ => Vec::new(),
        };
        let nested = |w: &WorkspaceSummary| {
            w.parent_workspace_id
                .as_ref()
                .and_then(|p| shown.iter().find(|c| c.id == *p))
                .is_some_and(|p| p.parent_workspace_id.is_some())
        };
        let mut flat: Vec<(&WorkspaceSummary, usize)> = Vec::new();
        fn place<'a>(
            at: &'a WorkspaceSummary,
            depth: usize,
            shown: &[&'a WorkspaceSummary],
            nested: &dyn Fn(&WorkspaceSummary) -> bool,
            flat: &mut Vec<(&'a WorkspaceSummary, usize)>,
        ) {
            flat.push((at, depth));
            if depth < 8 {
                for child in shown
                    .iter()
                    .filter(|c| nested(c) && c.parent_workspace_id.as_deref() == Some(&at.id))
                {
                    place(child, depth + 1, shown, nested, flat);
                }
            }
        }
        for root in shown.iter().filter(|w| !nested(w)) {
            place(root, 0, &shown, &nested, &mut flat);
        }
        let single = flat.len() == 1 && flat[0].0.parent_workspace_id.is_none();
        let (direct, workspaces) = if flat.is_empty() || single {
            (own, Vec::new())
        } else {
            let mut left = own;
            let views = flat
                .iter()
                .map(|(w, depth)| {
                    let (mine, rest): (Vec<_>, Vec<_>) = left
                        .drain(..)
                        .partition(|s| s.workspace_id.as_deref() == Some(&w.id));
                    left = rest;
                    WorkspaceView {
                        id: w.id.clone(),
                        name: w.name.clone(),
                        path: w.path.clone(),
                        branch: w.branch.clone().filter(|b| !b.is_empty()),
                        dirty: w.dirty,
                        pinned: w.pinned,
                        sleeping: w.state == WorkspaceState::Sleeping,
                        linked: w.parent_workspace_id.is_some(),
                        depth: *depth,
                        sessions: nest_under_leads(mine),
                    }
                })
                .collect();
            // A session no listed checkout owns (a hidden worktree's) is never lost.
            (left, views)
        };
        ProjectView {
            id: project.map(|p| p.id.clone()).unwrap_or_default(),
            name: project.map_or_else(|| "Other".into(), project_name),
            path: project.map(|p| p.path.clone()).unwrap_or_default(),
            quickchat,
            favorite: project.is_some_and(|p| p.favorite),
            sessions: nest_under_leads(direct),
            workspaces,
            top,
            top_count,
        }
    }

    fn session_view(&self, session: &SessionSummary, reachable: bool) -> SessionView {
        let id = provider_id(session);
        let name = self
            .providers
            .get(&session.host_id)
            .and_then(|list| list.iter().find(|p| Some(p.id.as_str()) == id))
            .map(|p| p.name.clone())
            .unwrap_or_else(|| match id {
                None | Some(TERMINAL_PROVIDER) => "Terminal".into(),
                Some(other) => other.to_string(),
            });
        let attention = reachable.then(|| self.attention_of(session));
        // The checkout it belongs to, by id or, for an older record, by folder.
        let workspace = self
            .workspaces
            .iter()
            .find(|w| match &session.workspace_id {
                Some(id) => w.id == *id,
                None => w.host_id == session.host_id && w.path == session.cwd,
            });
        let several = session
            .project_id
            .as_deref()
            .is_some_and(|project| self.shown_workspaces(project).len() >= 2);
        SessionView {
            id: session.id.clone(),
            host_id: session.host_id.clone(),
            title: title(session),
            provider: name,
            provider_id: session.cli_provider_id.clone(),
            cli_started: session.cli_started,
            current_provider_id: session.current_provider_id.clone(),
            project_id: session.project_id.clone(),
            workspace_id: workspace.map(|w| w.id.clone()),
            parent: session.parent_session_id.clone(),
            nested: false,
            workspace_label: workspace.filter(|_| several).map(|w| {
                w.branch
                    .clone()
                    .filter(|b| !b.is_empty())
                    .unwrap_or_else(|| w.name.clone())
            }),
            need_reason: (attention == Some(Attention::NeedsYou)).then(|| self.reason(&session.id)),
            attention,
        }
    }

    /// Why a session needs you: the core's own words for its question or failure.
    fn reason(&self, session_id: &str) -> String {
        let Some(event) = self
            .needs_events
            .iter()
            .rev()
            .find(|e| e.session_id == session_id)
        else {
            return "Waiting for you".into();
        };
        let reason = match event.kind.as_str() {
            "question" if event.certainty == "unconfirmed" => {
                "Was waiting for you before restart".to_string()
            }
            "question" => "Waiting for you".to_string(),
            "failed" if event.summary.is_empty() => "Failed".to_string(),
            "finished" if event.count > 1 => format!("{} · {} turns", event.summary, event.count),
            _ => event.summary.clone(),
        };
        let certainty = match event.certainty.as_str() {
            "heuristic" => Some("Guessed from terminal output"),
            "unconfirmed" => Some("Not confirmed since Perch restarted"),
            _ => None,
        };
        [Some(reason.as_str()), certainty]
            .into_iter()
            .flatten()
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>()
            .join(" · ")
    }

    fn attention_of(&self, session: &SessionSummary) -> Attention {
        section(session, &self.needs, self.held.as_deref())
    }
}

fn has(capabilities: &[String], wanted: &str) -> bool {
    capabilities.iter().any(|c| c == wanted)
}

/// Sessions the core says wait on a person: unanswered questions and failures.
fn needing(events: &[AttentionEvent]) -> HashSet<String> {
    events
        .iter()
        .filter(|e| e.requires_action || e.kind == "question")
        .map(|e| e.session_id.clone())
        .collect()
}

fn is_chats(project: &ProjectSummary) -> bool {
    project.path.ends_with("/.perch/scratch")
}

fn project_name(project: &ProjectSummary) -> String {
    if is_chats(project) {
        "Quickchat".into()
    } else {
        project.name.clone()
    }
}

/// The provider shown for a session: what runs in it now, else what it was launched with. For
/// display and listing only; attaching and closing use `cli_provider_id`.
fn provider_id(session: &SessionSummary) -> Option<&str> {
    session
        .current_provider_id
        .as_deref()
        .or(session.cli_provider_id.as_deref())
}

/// `listedInSidebar`: a project lists agents; a plain terminal stays a tab.
fn listed(session: &SessionSummary) -> bool {
    provider_id(session) != Some(TERMINAL_PROVIDER)
}

/// `nestUnderLeads`: each sub-session straight after its lead, in the order given, when both are
/// listed together. A child whose lead is elsewhere stays where it is. One level only.
fn nest_under_leads(rows: Vec<SessionView>) -> Vec<SessionView> {
    let ids: HashSet<String> = rows.iter().map(|r| r.id.clone()).collect();
    let leads: HashSet<String> = rows
        .iter()
        .filter(|r| {
            r.parent
                .as_ref()
                .is_none_or(|p| *p == r.id || !ids.contains(p))
        })
        .map(|r| r.id.clone())
        .collect();
    let is_child = |r: &SessionView| {
        r.parent
            .as_ref()
            .is_some_and(|p| *p != r.id && leads.contains(p))
    };
    if !rows.iter().any(is_child) {
        return rows;
    }
    let (children, rest): (Vec<_>, Vec<_>) = rows.into_iter().partition(|r| is_child(r));
    rest.into_iter()
        .flat_map(|lead| {
            let kids = children
                .iter()
                .filter(|c| c.parent.as_deref() == Some(lead.id.as_str()))
                .cloned()
                .map(|mut c| {
                    c.nested = true;
                    c
                })
                .collect::<Vec<_>>();
            std::iter::once(lead).chain(kids)
        })
        .collect()
}

/// `orderBy`: ids the order does not know come first, as given; the rest in the core's order.
fn order_by<'a, T>(items: Vec<&'a T>, order: &[String], id: impl Fn(&T) -> &String) -> Vec<&'a T> {
    let rank: HashMap<&String, usize> = order
        .iter()
        .enumerate()
        .rev()
        .map(|(i, k)| (k, i))
        .collect();
    let (mut known, mut fresh): (Vec<_>, Vec<_>) = items
        .into_iter()
        .partition(|item| rank.contains_key(id(item)));
    known.sort_by_key(|item| rank[id(item)]);
    fresh.append(&mut known);
    fresh
}

/// The session's title, else the folder its shell is in.
pub fn title(session: &SessionSummary) -> String {
    let title = session.title.trim();
    if !title.is_empty() {
        return title.to_string();
    }
    let cwd = session.current_cwd.as_deref().unwrap_or(&session.cwd);
    std::path::Path::new(cwd)
        .file_name()
        .map_or_else(|| "Terminal".into(), |n| n.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};

    fn message(value: Value) -> ServerMessage {
        serde_json::from_value(value).unwrap_or_else(|e| panic!("{e}"))
    }

    fn session(id: &str, host: &str, project: &str, extra: Value) -> Value {
        let mut value = json!({
            "id": id, "title": id, "cwd": "/work", "createdAt": 0, "status": "idle",
            "hostId": host, "projectId": project, "cliProviderId": "claude",
        });
        for (k, v) in extra.as_object().unwrap() {
            value[k] = v.clone();
        }
        value
    }

    fn project(id: &str, host: &str, name: &str) -> Value {
        json!({"id": id, "hostId": host, "name": name, "path": format!("/{name}"),
               "favorite": false, "createdAt": 0, "updatedAt": 0})
    }

    fn project_list(host: &str, projects: Vec<Value>) -> ServerMessage {
        message(
            json!({"type": "project.list", "requestId": "r", "hostId": host,
                       "snapshotEpoch": "e", "snapshotRevision": 1, "projects": projects}),
        )
    }

    fn session_list(sessions: Vec<Value>) -> ServerMessage {
        message(json!({"type": "session.list", "sessions": sessions}))
    }

    fn updated(session: Value) -> ServerMessage {
        message(json!({"type": "session.updated", "session": session}))
    }

    fn state() -> State {
        let mut state = State::default();
        state.connect();
        state.apply(&project_list(
            LOCAL,
            vec![project("a", LOCAL, "alpha"), project("b", LOCAL, "beta")],
        ));
        state
    }

    fn shown(model: &Model, host: usize, project: usize) -> Vec<(String, Option<Attention>)> {
        model.hosts[host].projects[project]
            .sessions
            .iter()
            .map(|s| (s.id.clone(), s.attention))
            .collect()
    }

    #[test]
    fn follows_session_changes() {
        let mut state = state();
        state.apply(&session_list(vec![session("s1", LOCAL, "a", json!({}))]));
        assert_eq!(
            shown(&state.model(), 0, 0),
            [("s1".into(), Some(Attention::Idle))]
        );

        // A new session lands first; a known one is replaced in place.
        state.apply(&updated(session(
            "s2",
            LOCAL,
            "a",
            json!({"status": "running"}),
        )));
        state.apply(&updated(session(
            "s1",
            LOCAL,
            "a",
            json!({"title": "renamed"}),
        )));
        let model = state.model();
        let rows = &model.hosts[0].projects[0].sessions;
        assert_eq!(
            rows.iter().map(|s| &*s.id).collect::<Vec<_>>(),
            ["s2", "s1"]
        );
        assert_eq!(rows[0].attention, Some(Attention::Working));
        assert_eq!(rows[1].title, "renamed");

        state.apply(&message(
            json!({"type": "session.deleted", "sessionId": "s2"}),
        ));
        assert_eq!(shown(&state.model(), 0, 0).len(), 1);
    }

    #[test]
    fn attention_is_what_the_core_reports() {
        let mut state = state();
        state.apply(&session_list(vec![
            session("blocked", LOCAL, "a", json!({"blocked": true})),
            session(
                "stale",
                LOCAL,
                "a",
                json!({"blocked": true, "stale": true, "status": "running"}),
            ),
            session("working", LOCAL, "a", json!({"status": "running"})),
            session("done", LOCAL, "a", json!({"unseen": true})),
            session("asking", LOCAL, "a", json!({})),
            session("idle", LOCAL, "a", json!({})),
        ]));
        let event = |kind: &str, requires: bool| {
            json!({"id": "e", "sessionId": "asking", "agentId": "claude", "kind": kind,
                   "requiresAction": requires, "certainty": "certain", "summary": "",
                   "occurredAt": 0, "count": 1, "read": false})
        };
        // A finished turn does not need you; a question does.
        state.apply(&message(
            json!({"type": "attention.snapshot", "events": [event("finished", false)]}),
        ));
        assert_eq!(
            state.model().hosts[0].projects[0].sessions[4].attention,
            Some(Attention::Idle)
        );
        state.apply(&message(
            json!({"type": "attention.snapshot", "events": [event("question", false)]}),
        ));

        let model = state.model();
        let by_id: HashMap<_, _> = shown(&model, 0, 0).into_iter().collect();
        assert_eq!(by_id["blocked"], Some(Attention::NeedsYou));
        assert_eq!(by_id["stale"], Some(Attention::Idle));
        assert_eq!(by_id["working"], Some(Attention::Working));
        assert_eq!(by_id["done"], Some(Attention::Done));
        assert_eq!(by_id["asking"], Some(Attention::NeedsYou));
        assert_eq!(by_id["idle"], Some(Attention::Idle));
        assert_eq!(model.needs_you, 2);
        assert_eq!(model.hosts[0].projects[0].top, Some(Attention::NeedsYou));
        assert_eq!(Attention::Idle.label(), None);
    }

    #[test]
    fn disconnect_keeps_rows_and_claims_no_state() {
        let mut state = state();
        state.apply(&session_list(vec![
            session("s1", LOCAL, "a", json!({"blocked": true})),
            session("s2", LOCAL, "a", json!({"status": "running"})),
        ]));
        state.disconnect(Some("connection refused".into()));
        let model = state.model();
        assert!(!model.connected);
        assert_eq!(model.offline_reason.as_deref(), Some("connection refused"));
        assert_eq!(model.needs_you, 0);
        assert_eq!(model.hosts[0].state, "unknown");
        // Last-known rows stay, with no state: not exited, not idle.
        assert_eq!(
            shown(&model, 0, 0),
            [("s1".into(), None), ("s2".into(), None)]
        );
        assert_eq!(model.hosts[0].projects[0].top, None);

        // The core comes back: its first answers replace what was kept.
        state.connect();
        assert_eq!(state.model().offline_reason, None);
        state.apply(&session_list(vec![session("s2", LOCAL, "a", json!({}))]));
        assert_eq!(
            shown(&state.model(), 0, 0),
            [("s2".into(), Some(Attention::Idle))]
        );
    }

    #[test]
    fn a_computer_that_is_not_connected_claims_no_state() {
        let mut state = state();
        state.apply(&message(
            json!({"type": "hosts.list", "hosts": [{"id": "h", "name": "Build box"}]}),
        ));
        // Not reported yet: on its way up, as the web shows it.
        assert_eq!(state.model().hosts[1].state, "connecting");
        assert_eq!(state.model().hosts[1].enabled, Some(true));

        let asks = state.apply(&message(
            json!({"type": "host.info", "hostId": "h", "name": "Build box", "state": "connected"}),
        ));
        assert_eq!(
            asks,
            [
                Request::Projects("h".into()),
                Request::Providers("h".into())
            ]
        );
        // The same state again asks nothing.
        assert!(state
            .apply(&message(
                json!({"type": "host.info", "hostId": "h", "name": "x", "state": "connected"})
            ))
            .is_empty());

        state.apply(&project_list("h", vec![project("h:p", "h", "remote")]));
        state.apply(&session_list(vec![
            session("local", LOCAL, "a", json!({"blocked": true})),
            session("far", "h", "h:p", json!({"blocked": true})),
        ]));
        let model = state.model();
        assert_eq!(model.hosts[1].name, "Build box");
        assert_eq!(
            shown(&model, 1, 0),
            [("far".into(), Some(Attention::NeedsYou))]
        );
        assert_eq!(model.needs_you, 2);

        state.apply(&message(
            json!({"type": "host.info", "hostId": "h", "name": "Build box", "state": "error", "error": "refused"}),
        ));
        let model = state.model();
        assert_eq!(shown(&model, 1, 0), [("far".into(), None)]);
        assert_eq!(
            shown(&model, 0, 0),
            [("local".into(), Some(Attention::NeedsYou))]
        );
        assert_eq!(model.needs_you, 1);
        assert!(!model.hosts[1].reachable);
    }

    #[test]
    fn order_comes_from_the_core() {
        let mut state = state();
        state.apply(&session_list(vec![
            session("s1", LOCAL, "a", json!({})),
            session("s2", LOCAL, "a", json!({})),
            session("s3", LOCAL, "a", json!({})),
        ]));
        state.apply(&message(json!({"type": "workspace.order", "hostId": LOCAL,
                                    "projects": ["b", "a"], "sessions": ["s3", "gone", "s1"]})));
        let model = state.model();
        let names: Vec<_> = model.hosts[0].projects.iter().map(|p| &*p.name).collect();
        assert_eq!(names, ["beta", "alpha"]);
        // s2 is unknown to the order, so it comes first.
        let ids: Vec<_> = model.hosts[0].projects[1]
            .sessions
            .iter()
            .map(|s| &*s.id)
            .collect();
        assert_eq!(ids, ["s2", "s3", "s1"]);

        // A project the core deletes leaves; its sessions go under Other.
        state.apply(&message(
            json!({"type": "project.deleted", "projectId": "a", "hostId": LOCAL,
                                    "snapshotEpoch": "e", "snapshotRevision": 2}),
        ));
        let model = state.model();
        assert_eq!(model.hosts[0].projects.last().unwrap().name, "Other");
    }

    fn state_with_blocked_terminal() -> State {
        let mut state = state();
        state.apply(&session_list(vec![session(
            "t",
            LOCAL,
            "a",
            json!({"cliProviderId": "terminal", "blocked": true}),
        )]));
        state
    }

    #[test]
    fn terminals_in_projects_stay_tabs() {
        let mut state = state();
        state.apply(&project_list(
            LOCAL,
            vec![
                project("a", LOCAL, "alpha"),
                json!({"id": "c", "hostId": LOCAL, "name": "Chats", "path": "/home/me/.perch/scratch",
                       "favorite": false, "createdAt": 0, "updatedAt": 0}),
            ],
        ));
        let shell = |id, project| session(id, LOCAL, project, json!({"cliProviderId": "terminal"}));
        state.apply(&session_list(vec![
            shell("t1", "a"),
            shell("t2", "c"),
            session(
                "agent",
                LOCAL,
                "a",
                json!({"currentProviderId": "claude", "cliProviderId": "terminal"}),
            ),
        ]));
        let model = state.model();
        assert_eq!(
            shown(&model, 0, 0).len(),
            1,
            "only the agent in the project"
        );
        assert_eq!(model.hosts[0].projects[1].name, "Quickchat");
        assert_eq!(shown(&model, 0, 1).len(), 1, "Quickchat lists its terminal");

        state.show_terminals = true;
        assert_eq!(shown(&state.model(), 0, 0).len(), 2);

        // A terminal that needs you counts whether or not its row is shown.
        let blocked = |show| {
            let mut state = state_with_blocked_terminal();
            state.show_terminals = show;
            state.model().needs_you
        };
        assert_eq!((blocked(false), blocked(true)), (1, 1));
    }

    #[test]
    fn a_session_is_attached_with_its_launch_provider_not_the_one_seen_running() {
        let mut state = state();
        state.show_terminals = true;
        state.apply(&session_list(vec![
            // `claude` was typed in a terminal tab.
            session(
                "typed",
                LOCAL,
                "a",
                json!({"cliProviderId": "terminal", "currentProviderId": "claude"}),
            ),
            // An agent whose foreground job reads `terminal`.
            session(
                "agent",
                LOCAL,
                "a",
                json!({"cliProviderId": "claude", "currentProviderId": "terminal"}),
            ),
            // The core records no launch provider.
            session(
                "blank",
                LOCAL,
                "a",
                json!({"cliProviderId": null, "currentProviderId": "claude"}),
            ),
        ]));
        let model = state.model();
        let rows = &model.hosts[0].projects[0].sessions;
        let of = |id: &str| rows.iter().find(|r| r.id == id).unwrap();
        // What the row says it runs is the observed provider...
        assert_eq!(of("typed").provider, "claude");
        assert_eq!(of("agent").provider, "Terminal");
        // ...but what a terminal attaches with is the launch provider, or nothing.
        assert_eq!(of("typed").provider_id.as_deref(), Some("terminal"));
        assert_eq!(of("agent").provider_id.as_deref(), Some("claude"));
        assert_eq!(of("blank").provider_id, None);
    }

    #[test]
    fn launch_choices_are_the_agents_the_core_lists() {
        let mut state = state();
        let manifest = |id: &str, available: bool, enabled: Value, modes: Value| {
            json!({"id": id, "displayName": id.to_uppercase(), "supportedModes": modes,
                   "resumability": "none", "capabilities": ["interactiveTerminal"],
                   "statusDetection": "none", "available": available, "enabled": enabled})
        };
        state.apply(&message(
            json!({"type": "agent.manifest.list", "requestId": "r", "manifests": [
                manifest("claude", true, json!(true), json!(["cli"])),
                manifest("codex", false, json!(true), json!(["cli"])),
                manifest("pi", true, json!(false), json!(["cli"])),
                manifest("omp", true, Value::Null, json!(["chat"])),
                manifest("terminal", true, Value::Null, json!(["cli"])),
            ]}),
        ));
        state.apply(&session_list(vec![session("s1", LOCAL, "a", json!({}))]));
        let model = state.model();
        let ids: Vec<_> = model.hosts[0].providers.iter().map(|p| &*p.id).collect();
        assert_eq!(ids, ["terminal", "claude"]);
        let row = &model.hosts[0].projects[0].sessions[0];
        assert_eq!(
            (row.provider.as_str(), row.provider_id.as_deref()),
            ("CLAUDE", Some("claude"))
        );
    }

    fn workspace(id: &str, project: &str, extra: Value) -> Value {
        let mut value = json!({"id": id, "projectId": project, "hostId": LOCAL, "path": format!("/{id}"),
                               "name": id, "dirty": false, "state": "active", "createdAt": 0,
                               "updatedAt": 0, "pinned": false});
        for (k, v) in extra.as_object().unwrap() {
            value[k] = v.clone();
        }
        value
    }

    fn snapshot(workspaces: Vec<Value>) -> ServerMessage {
        message(
            json!({"type": "workspace.snapshot", "requestId": "r", "hostId": LOCAL,
                       "snapshotEpoch": "e", "snapshotRevision": 1, "projects": [],
                       "workspaces": workspaces}),
        )
    }

    fn ids(sessions: &[SessionView]) -> Vec<(&str, bool)> {
        sessions.iter().map(|s| (&*s.id, s.nested)).collect()
    }

    #[test]
    fn a_project_with_several_checkouts_lists_each_with_its_sessions() {
        let mut state = state();
        state.apply(&session_list(vec![
            session("main", LOCAL, "a", json!({"workspaceId": "w1"})),
            session("feature", LOCAL, "a", json!({"workspaceId": "w2"})),
            session("lost", LOCAL, "a", json!({"workspaceId": "hidden"})),
            session("solo", LOCAL, "b", json!({"workspaceId": "w3"})),
        ]));
        state.apply(&snapshot(vec![
            workspace("w1", "a", json!({"updatedAt": 5})),
            workspace(
                "w2",
                "a",
                json!({"parentWorkspaceId": "w1", "branch": "feat", "dirty": true}),
            ),
            workspace("hidden", "a", json!({"hidden": true})),
            workspace("gone", "a", json!({"state": "archived"})),
            workspace("w3", "b", json!({})),
        ]));
        let model = state.model();
        let alpha = &model.hosts[0].projects[0];
        let rows: Vec<_> = alpha
            .workspaces
            .iter()
            .map(|w| (&*w.id, w.depth, w.linked, ids(&w.sessions)))
            .collect();
        assert_eq!(
            rows,
            [
                ("w1", 0, false, vec![("main", false)]),
                ("w2", 0, true, vec![("feature", false)])
            ]
        );
        assert_eq!(alpha.workspaces[1].branch.as_deref(), Some("feat"));
        assert!(alpha.workspaces[1].dirty);
        // A chat no listed checkout owns is never lost.
        assert_eq!(ids(&alpha.sessions), [("lost", false)]);
        // The checkout is named beside the chat when it tells chats apart.
        assert_eq!(
            alpha.workspaces[1].sessions[0].workspace_label.as_deref(),
            Some("feat")
        );
        // One plain checkout has no row of its own: the project row stands in.
        let beta = &model.hosts[0].projects[1];
        assert!(beta.workspaces.is_empty());
        assert_eq!(ids(&beta.sessions), [("solo", false)]);
        assert_eq!(beta.sessions[0].workspace_label, None);

        // A worktree of a linked worktree nests under it, and a live update reorders nothing else.
        state.apply(&message(json!({"type": "workspace.updated", "workspace":
            workspace("w4", "a", json!({"parentWorkspaceId": "w2"})),
            "snapshotEpoch": "e", "snapshotRevision": 2})));
        let depths: Vec<_> = state.model().hosts[0].projects[0]
            .workspaces
            .iter()
            .map(|w| (w.id.clone(), w.depth))
            .collect();
        assert_eq!(
            depths,
            [("w1".into(), 0), ("w2".into(), 0), ("w4".into(), 1)]
        );
    }

    #[test]
    fn workspaces_are_asked_for_only_where_the_core_has_them() {
        let mut state = State::default();
        state.connect();
        let info = |caps: Value| {
            message(
                json!({"type": "server.info", "hostname": "mac", "isSsh": false,
                           "platform": "darwin", "capabilities": caps}),
            )
        };
        assert!(state.apply(&info(json!([]))).is_empty());
        assert_eq!(
            state.apply(&info(json!(["attention.v1", "workspace.snapshot"]))),
            [Request::Attention, Request::Workspaces(LOCAL.into())]
        );
        let connected = |caps: Value| {
            message(
                json!({"type": "host.info", "hostId": "h", "name": "h", "state": "connected",
                           "capabilities": caps}),
            )
        };
        assert_eq!(
            state.apply(&connected(json!([]))),
            [
                Request::Projects("h".into()),
                Request::Providers("h".into())
            ]
        );
        state.apply(&message(
            json!({"type": "host.info", "hostId": "h", "name": "h", "state": "error"}),
        ));
        assert_eq!(
            state
                .apply(&connected(json!(["workspace.snapshot"])))
                .last(),
            Some(&Request::Workspaces("h".into()))
        );
        assert_eq!(
            state.model().hosts[0].detail.as_deref(),
            Some("mac · darwin")
        );
    }

    #[test]
    fn sub_sessions_sit_under_their_lead() {
        let mut state = state();
        state.apply(&session_list(vec![
            session("child2", LOCAL, "a", json!({"parentSessionId": "lead"})),
            session("other", LOCAL, "a", json!({})),
            session("lead", LOCAL, "a", json!({})),
            session("child1", LOCAL, "a", json!({"parentSessionId": "lead"})),
            // Its lead is not listed here: it stays where it is.
            session(
                "orphan",
                LOCAL,
                "a",
                json!({"parentSessionId": "elsewhere"}),
            ),
            // Perch's depth limit is one: a grandchild is a row of its own.
            session("grand", LOCAL, "a", json!({"parentSessionId": "child1"})),
        ]));
        let model = state.model();
        assert_eq!(
            ids(&model.hosts[0].projects[0].sessions),
            [
                ("other", false),
                ("lead", false),
                ("child2", true),
                ("child1", true),
                ("orphan", false),
                ("grand", false),
            ]
        );
    }

    #[test]
    fn by_status_sorts_chats_by_state_then_project() {
        let mut state = state();
        state.apply(&project_list(
            LOCAL,
            vec![
                project("a", LOCAL, "alpha"),
                project("b", LOCAL, "beta"),
                project("c", LOCAL, "empty"),
                json!({"id": "q", "hostId": LOCAL, "name": "Chats", "path": "/home/.perch/scratch",
                       "favorite": false, "createdAt": 0, "updatedAt": 0}),
            ],
        ));
        state.apply(&session_list(vec![
            session("old-idle", LOCAL, "a", json!({"createdAt": 1})),
            session("new-idle", LOCAL, "a", json!({"createdAt": 9})),
            session("run", LOCAL, "b", json!({"status": "running"})),
            session("chat", LOCAL, "q", json!({"blocked": true})),
            session("ask", LOCAL, "a", json!({"blocked": true})),
            session(
                "lead",
                LOCAL,
                "b",
                json!({"status": "running", "createdAt": 3}),
            ),
            session(
                "kid",
                LOCAL,
                "b",
                json!({"status": "running", "parentSessionId": "lead", "createdAt": 4}),
            ),
        ]));
        let model = state.model();
        let host = &model.hosts[0];
        let sections: Vec<_> = host
            .status
            .iter()
            .map(|s| (s.title.as_str(), s.count))
            .collect();
        assert_eq!(sections, [("Needs you", 2), ("Working", 3), ("Idle", 2)]);
        // Each section keeps its chats under their project, in the sidebar's order: Quickchat last.
        let needs: Vec<_> = host.status[0]
            .clusters
            .iter()
            .map(|c| (c.name.as_str(), ids(&c.sessions)))
            .collect();
        assert_eq!(
            needs,
            [
                ("alpha", vec![("ask", false)]),
                ("Quickchat", vec![("chat", false)])
            ]
        );
        // Newest first within a project, a sub-session under its lead.
        let idle = &host.status[2].clusters[0];
        assert_eq!(
            ids(&idle.sessions),
            [("new-idle", false), ("old-idle", false)]
        );
        let working = &host.status[1].clusters[0];
        assert_eq!(working.name, "beta");
        assert_eq!(
            ids(&working.sessions),
            [("lead", false), ("kid", true), ("run", false)]
        );
        // Projects with no chat are listed last, so none goes missing.
        let empty: Vec<_> = host.empty_projects.iter().map(|p| &*p.name).collect();
        assert_eq!(empty, ["empty"]);

        // A computer that cannot be reached claims no state: one section, as last known.
        state.disconnect(None);
        let host = &state.model().hosts[0];
        assert_eq!(host.status.len(), 1);
        assert_eq!(host.status[0].title, "Offline: last known");
        assert_eq!(host.status[0].attention, None);
        assert_eq!(host.status[0].count, 7);
    }

    #[test]
    fn a_chat_being_read_stays_in_done_until_it_is_left() {
        let mut state = state();
        state.apply(&session_list(vec![
            session("a1", LOCAL, "a", json!({"unseen": true})),
            session("a2", LOCAL, "a", json!({"unseen": true})),
            session("busy", LOCAL, "a", json!({"status": "running"})),
        ]));
        let attention = |state: &State, id: &str| {
            state.model().hosts[0].projects[0]
                .sessions
                .iter()
                .find(|s| s.id == id)
                .unwrap()
                .attention
        };
        // Opening a finished chat reads it; the core clears the mark, the chat stays Done.
        state.view("a1");
        state.apply(&updated(session(
            "a1",
            LOCAL,
            "a",
            json!({"unseen": false}),
        )));
        assert_eq!(attention(&state, "a1"), Some(Attention::Done));
        assert_eq!(attention(&state, "a2"), Some(Attention::Done));

        // The chat being read finishes a turn: Working to Idle also lands in Done...
        state.view("busy");
        assert_eq!(attention(&state, "busy"), Some(Attention::Working));
        state.apply(&updated(session("busy", LOCAL, "a", json!({}))));
        assert_eq!(attention(&state, "busy"), Some(Attention::Done));
        // ...and leaving it lets go. a1 was read, so it falls to Idle; a2 was not.
        state.view("a2");
        assert_eq!(attention(&state, "busy"), Some(Attention::Idle));
        assert_eq!(attention(&state, "a1"), Some(Attention::Idle));
        assert_eq!(attention(&state, "a2"), Some(Attention::Done));

        // Starting to work again lets go too.
        state.apply(&updated(session(
            "a2",
            LOCAL,
            "a",
            json!({"status": "running"}),
        )));
        assert_eq!(attention(&state, "a2"), Some(Attention::Working));
        state.apply(&updated(session("a2", LOCAL, "a", json!({}))));
        assert_eq!(
            attention(&state, "a2"),
            Some(Attention::Done),
            "just finished while read"
        );
    }

    #[test]
    fn hold_finished_matches_the_web_rule() {
        use Dot::*;
        // Nothing viewed, or the viewed chat unknown, or busy: nothing held.
        assert_eq!(hold_finished(None, None, None, Some(Done)), None);
        assert_eq!(hold_finished(None, Some("v"), None, None), None);
        assert_eq!(
            hold_finished(Some("v"), Some("v"), Some(Done), Some(Working)),
            None
        );
        assert_eq!(
            hold_finished(Some("v"), Some("v"), Some(Done), Some(Blocked)),
            None
        );
        // Landing on a finished chat, or one that just finished, holds it; a quiet one does not.
        assert_eq!(
            hold_finished(None, Some("v"), None, Some(Done)).as_deref(),
            Some("v")
        );
        assert_eq!(
            hold_finished(None, Some("v"), Some(Working), Some(Idle)).as_deref(),
            Some("v")
        );
        assert_eq!(
            hold_finished(None, Some("v"), Some(Blocked), Some(Idle)).as_deref(),
            Some("v")
        );
        assert_eq!(hold_finished(None, Some("v"), None, Some(Idle)), None);
        // Once held, it stays through Idle.
        assert_eq!(
            hold_finished(Some("v"), Some("v"), Some(Done), Some(Idle)).as_deref(),
            Some("v")
        );
        // Another chat's hold does not carry over.
        assert_eq!(hold_finished(Some("w"), Some("v"), None, Some(Idle)), None);
    }

    #[test]
    fn needs_you_is_visited_longest_wait_first_and_wraps() {
        let mut state = state();
        state.apply(&session_list(vec![
            session("failed", LOCAL, "a", json!({})),
            session("late", LOCAL, "a", json!({})),
            session("early", LOCAL, "a", json!({})),
            session("blocked", LOCAL, "a", json!({"blocked": true})),
            session("idle", LOCAL, "a", json!({})),
            session("far", "h", "x", json!({"blocked": true})),
        ]));
        let event = |session: &str, kind: &str, requires: bool, at: i64| {
            json!({"id": format!("{session}-{kind}"), "sessionId": session, "agentId": "claude",
                   "kind": kind, "requiresAction": requires, "certainty": "certain",
                   "summary": "Tests failed", "occurredAt": at, "count": 1, "read": false})
        };
        state.apply(&message(json!({"type": "attention.snapshot", "events": [
            event("failed", "failed", true, 1),
            event("late", "question", false, 20),
            event("early", "question", false, 10),
            event("idle", "finished", false, 5),
            event("early", "failed", true, 99),
        ]})));
        let model = state.model();
        // Questions first, oldest first; failures next; a blocked chat without an event last.
        // `far` is on a computer that is not connected.
        assert_eq!(model.needing, ["early", "late", "failed", "blocked"]);
        assert_eq!(model.needs_you, 4);
        let row = |model: &Model, id: &str| {
            model.hosts[0].projects[0]
                .sessions
                .iter()
                .find(|s| s.id == id)
                .cloned()
                .unwrap()
        };
        assert_eq!(
            row(&model, "failed").need_reason.as_deref(),
            Some("Tests failed")
        );
        assert_eq!(
            row(&model, "late").need_reason.as_deref(),
            Some("Waiting for you")
        );
        assert_eq!(
            row(&model, "blocked").need_reason.as_deref(),
            Some("Waiting for you")
        );
        assert_eq!(row(&model, "idle").need_reason, None);

        let list: Vec<String> = model.needing.clone();
        let step = |current: Option<&str>, by: i32| step_needing(&list, current, by);
        assert_eq!(step(None, 1).as_deref(), Some("early"));
        assert_eq!(step(Some("early"), 1).as_deref(), Some("late"));
        assert_eq!(step(Some("blocked"), 1).as_deref(), Some("early"), "wraps");
        assert_eq!(step(None, -1).as_deref(), Some("blocked"));
        assert_eq!(
            step(Some("early"), -1).as_deref(),
            Some("blocked"),
            "wraps back"
        );
        assert_eq!(step(Some("late"), -1).as_deref(), Some("early"));
        // A session that is not in the list (the open one is fine) starts from the ends.
        assert_eq!(step(Some("idle"), 1).as_deref(), Some("early"));
        // Only the open session needs you: nowhere to go. Nothing needs you: nowhere either.
        let one = ["only".to_string()];
        assert_eq!(step_needing(&one, Some("only"), 1), None);
        assert_eq!(step_needing(&one, Some("only"), -1), None);
        assert_eq!(step_needing(&[], None, 1), None);
    }

    #[test]
    fn remote_computers_show_their_state_and_how_they_are_reached() {
        let mut state = state();
        state.apply(&message(json!({"type": "hosts.list", "hosts": [
            {"id": "box", "name": "Build box", "sshHost": "build.example", "remotePort": 7788},
            {"id": "off", "name": "Off", "sshHost": "off.example", "enabled": false},
            {"id": "d", "name": "Direct", "sshHost": "direct.example", "mode": "direct"},
            {"id": "lan", "name": "Lan", "sshHost": "x", "directUrl": "ws://10.0.0.2:7800/ws"},
        ]})));
        let model = state.model();
        let hosts: Vec<_> = model
            .hosts
            .iter()
            .map(|h| (&*h.id, &*h.state, h.detail.as_deref(), h.enabled, h.direct))
            .collect();
        assert_eq!(
            hosts,
            [
                ("local", "connected", None, None, false),
                (
                    "box",
                    "connecting",
                    Some("build.example:7788"),
                    Some(true),
                    false
                ),
                (
                    "off",
                    "disabled",
                    Some("off.example:7788"),
                    Some(false),
                    false
                ),
                (
                    "d",
                    "connecting",
                    Some("direct.example (direct)"),
                    Some(true),
                    true
                ),
                (
                    "lan",
                    "connecting",
                    Some("ws://10.0.0.2:7800/ws"),
                    Some(true),
                    false
                ),
            ]
        );
        state.apply(&message(
            json!({"type": "host.info", "hostId": "box", "name": "Build box", "state": "error", "error": "ssh: refused"}),
        ));
        let model = state.model();
        assert_eq!(model.hosts[1].error.as_deref(), Some("ssh: refused"));
        // An error is only shown while the computer is in error.
        state.apply(&message(
            json!({"type": "host.info", "hostId": "box", "name": "Build box", "state": "connected"}),
        ));
        assert_eq!(state.model().hosts[1].error, None);

        // Turning one off writes its entry back with only `enabled` changed.
        let frame = state.host_enabled_frame("box", false).unwrap();
        assert_eq!(frame["type"], "hosts.upsert");
        assert_eq!(frame["host"]["id"], "box");
        assert_eq!(frame["host"]["enabled"], false);
        assert_eq!(frame["host"]["sshHost"], "build.example");
        assert!(state.host_enabled_frame(LOCAL, false).is_none());
        assert!(state.host_enabled_frame("nobody", false).is_none());
        // The frame is one the core accepts.
        serde_json::from_value::<perch_core::protocol::ClientMessage>(frame).unwrap();
    }

    fn alerts(state: &mut State) -> Vec<Alert> {
        state.take_alerts().iter().map(|h| h.alert).collect()
    }

    #[test]
    fn the_persons_own_sound_is_found_beside_the_mods_folder() {
        let root = std::env::temp_dir().join(format!("perch-heard-{}", std::process::id()));
        std::fs::create_dir_all(root.join("mods")).unwrap();
        std::fs::write(root.join("ding.mp3"), b"x").unwrap();
        let mut state = state();
        state.apply(&message(
            json!({"type": "mods.state", "requestId": "r", "mods": [],
            "layouts": [], "layout": null, "policy": {}, "safeMode": false,
            "folder": root.join("mods").display().to_string(), "keys": null}),
        ));
        state.apply(&message(json!({"type": "settings.current", "settings": {
            "defaultCwd": null, "soundEnabled": true, "soundDone": "ding.mp3",
            "soundBlocked": "missing.mp3"}})));
        state.apply(&session_list(vec![
            session("s1", LOCAL, "a", json!({"status": "running"})),
            session("s2", LOCAL, "a", json!({})),
        ]));
        state.set_window_active(false);
        state.apply(&updated(session("s1", LOCAL, "a", json!({}))));
        state.apply(&updated(session(
            "s2",
            LOCAL,
            "a",
            json!({"blocked": true}),
        )));
        let heard = state.take_alerts();
        assert_eq!(heard.len(), 2);
        assert!(heard[0]
            .file
            .as_ref()
            .is_some_and(|f| f.ends_with("ding.mp3")));
        assert_eq!(
            heard[1].file, None,
            "a file that is not there is the system's alert"
        );
        let _ = std::fs::remove_dir_all(&root);
    }

    fn settings(sound: bool, keys: Value) -> ServerMessage {
        message(json!({"type": "settings.current", "settings":
            {"defaultCwd": null, "soundEnabled": sound, "keybindings": keys}}))
    }

    #[test]
    fn terminal_settings_and_the_keys_file_reach_the_model() {
        let mut state = state();
        assert_eq!(state.model().terminal, None, "unknown until the core says");
        state.apply(&message(json!({"type": "settings.current", "settings": {
            "defaultCwd": null, "terminalScrollback": 4000, "terminalLoginShell": true}})));
        let terminal = state.model().terminal.unwrap();
        assert_eq!(
            (
                terminal.scrollback,
                terminal.login_shell,
                terminal.dropped_path_double_quotes
            ),
            (4000, true, false)
        );
        let keys = json!({"global": {"cmd-t": "tab.next"}});
        let mods = |keys: Value| {
            message(
                json!({"type": "mods.state", "requestId": "r", "mods": [], "layouts": [],
                "layout": null, "policy": {}, "safeMode": false, "folder": "/m", "keys": keys}),
            )
        };
        state.apply(&mods(keys.clone()));
        assert_eq!(state.model().keys_file, Some(keys));
        // The file was removed: the state says no keys and the model follows.
        state.apply(&message(
            json!({"type": "mods.state", "requestId": "r", "mods": [],
            "layouts": [], "policy": {}, "safeMode": false, "folder": "/m"}),
        ));
        assert_eq!(state.model().keys_file, None);
        // A change in the folder is asked about again.
        let asks = state.apply(&message(json!({"type": "mods.changed"})));
        assert!(matches!(asks.as_slice(), [Request::Mods]));
    }

    #[test]
    fn a_finished_or_blocked_chat_is_worth_a_sound_only_when_unseen() {
        let mut state = state();
        state.apply(&settings(true, json!({"global.sidebar": "cmd+shift+b"})));
        assert_eq!(state.model().keybindings["global.sidebar"], "cmd+shift+b");
        state.set_window_active(true);
        state.apply(&session_list(vec![
            session("s1", LOCAL, "a", json!({"status": "running"})),
            session("s2", LOCAL, "a", json!({"status": "running"})),
        ]));
        // A change seen for the first time, or one that is not a finish, is silent.
        state.apply(&updated(session(
            "new",
            LOCAL,
            "a",
            json!({"status": "running"}),
        )));
        state.apply(&updated(session(
            "s1",
            LOCAL,
            "a",
            json!({"status": "running", "title": "t"}),
        )));
        assert!(state.take_alerts().is_empty());

        state.apply(&updated(session("s1", LOCAL, "a", json!({}))));
        assert_eq!(alerts(&mut state), [Alert::Done]);
        state.apply(&updated(session(
            "s2",
            LOCAL,
            "a",
            json!({"status": "running", "blocked": true}),
        )));
        assert_eq!(alerts(&mut state), [Alert::Blocked]);
        assert!(state.take_alerts().is_empty(), "taken once");

        // The chat in front of the person, in the window they are looking at, is silent;
        // an unfocused window alerts for it too.
        state.apply(&updated(session(
            "s1",
            LOCAL,
            "a",
            json!({"status": "running"}),
        )));
        state.view("s1");
        state.apply(&updated(session("s1", LOCAL, "a", json!({}))));
        assert!(state.take_alerts().is_empty());
        state.apply(&updated(session(
            "s1",
            LOCAL,
            "a",
            json!({"status": "running"}),
        )));
        state.set_window_active(false);
        state.apply(&updated(session("s1", LOCAL, "a", json!({}))));
        assert_eq!(alerts(&mut state), [Alert::Done]);

        // Off, or after a reconnect (a list is read again first), nothing sounds.
        state.apply(&updated(session(
            "s1",
            LOCAL,
            "a",
            json!({"status": "running"}),
        )));
        state.apply(&settings(false, json!({})));
        state.apply(&updated(session("s1", LOCAL, "a", json!({}))));
        let heard = state.take_alerts();
        assert_eq!(
            heard.iter().map(|h| (h.sound, h.toast)).collect::<Vec<_>>(),
            [(false, Toast::App)],
            "sound is off: the toast alone is due"
        );
        assert_eq!(heard[0].text(), "s1 finished");
        assert_eq!(heard[0].session_id, "s1");
        // Toasts off as well: nothing is due.
        state.apply(&message(json!({"type": "settings.current", "settings":
            {"defaultCwd": null, "soundEnabled": false, "toastDelivery": "off"}})));
        state.apply(&updated(session(
            "s1",
            LOCAL,
            "a",
            json!({"status": "running"}),
        )));
        state.apply(&updated(session("s1", LOCAL, "a", json!({}))));
        assert!(state.take_alerts().is_empty(), "sound and toasts are off");
        state.apply(&settings(true, json!({})));
        state.apply(&updated(session(
            "s2",
            LOCAL,
            "a",
            json!({"status": "running"}),
        )));
        state.disconnect(None);
        state.connect();
        state.apply(&updated(session("s2", LOCAL, "a", json!({}))));
        assert!(
            state.take_alerts().is_empty(),
            "no list yet on this connection"
        );
    }
}

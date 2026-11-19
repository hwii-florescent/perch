//! The web's navigation, from the same facts: `navigation.ts` (`useNavigation`, `useHosts`) and the
//! helpers it calls (`statusView.ts`, `sidebarOrder.ts`, `workspaceNav.ts`, `workspaceTabs.ts`,
//! `store/selectors.ts`), ported rule for rule so a native mod gets the same [`Navigation`] and
//! [`Hosts`] the web sidebar draws. The shapes serialise to `@perch/sdk`'s (`perch-sdk.d.ts`):
//! camelCase names, an absent optional field left out, `null` where the web says null.
//!
//! What this client does not have is empty, never guessed: no per-viewer tab drag order (a strip
//! is the core's order over creation order), no remembered harness per session, no workspace key
//! hints (`shortcut` is never set).
//!
//! The view (which computer is shown, the session and workspace on screen, the sidebar's options)
//! is the caller's ([`View`]); the facts are the core's ([`Store`]).

use super::{dot, section, Attention, Dot, HostFacts, SnapshotState, LOCAL};
use perch_core::protocol::{
    AttentionEvent, ProjectSummary, SessionStatus, SessionSummary, SshHostEntry, WorkspaceState,
    WorkspaceSummary, WorktreeJob,
};
use serde::Serialize;
use std::collections::{HashMap, HashSet};

const INSTRUCTIONS_CAPABILITY: &str = "instructions.v1";
const MEMORY_CAPABILITY: &str = "memory.v1";
const ORDER_CAPABILITY: &str = "workspace.order.v1";
const SNAPSHOT_CAPABILITY: &str = "workspace.snapshot";
const TERMINAL: &str = "terminal";

/// What the core has said, as the web's store keeps it. Built by `State::store`.
#[derive(Clone, Debug, Default)]
pub struct Store {
    /// Counts changes; two stores of one follower are equal when this is.
    pub revision: u64,
    pub connected: bool,
    /// The core's session list has been read on this connection: a session it does not hold is
    /// gone, not just not heard of yet.
    pub listed: bool,
    pub hostname: Option<String>,
    pub platform: Option<String>,
    pub is_ssh: Option<bool>,
    /// The focused folder and branch (`status.update`).
    pub status: Option<(String, String)>,
    /// The agent's context window use and cost, from `status.update`.
    pub context_tokens: Option<u64>,
    pub cost_usd: Option<f64>,
    /// Plan usage as `usePlanUsage` gives it; null until the core answers `usage.get`.
    pub plan_usage: serde_json::Value,
    pub local_capabilities: Vec<String>,
    pub host_capabilities: HashMap<String, Vec<String>>,
    pub host_entries: Vec<SshHostEntry>,
    pub host_states: HashMap<String, HostFacts>,
    pub snapshots: HashMap<String, SnapshotState>,
    pub projects: Vec<ProjectSummary>,
    pub workspaces: Vec<WorkspaceSummary>,
    pub sessions: Vec<SessionSummary>,
    /// Per computer, the core's order of project ids and session ids.
    pub order: HashMap<String, (Vec<String>, Vec<String>)>,
    /// Each local workspace's shared tabs as the core last sent them (`workspace.tabs`).
    pub shared_tabs: HashMap<String, perch_core::shared_tabs::SharedTabs>,
    /// Goes up on each connect and each `workspace.tabs` answer: a write sent before then may
    /// never have reached the core, so it may be sent again.
    pub tabs_heard: u64,
    pub needs_events: Vec<AttentionEvent>,
    /// The session the window told the core it shows.
    pub viewing: Option<String>,
    /// The chat kept in Done while it is read (`holdFinished`).
    pub held: Option<String>,
    /// The core's settings as it sent them, camelCase as the web reads them; null until it has.
    pub settings: Option<serde_json::Value>,
    /// `settings.theme`.
    pub theme: Option<String>,
    /// `settings.emptyWorkspaceAgent`, once the core has sent it.
    pub empty_agent: Option<String>,
    /// This computer's background worktree creates (`worktree.jobs`).
    pub worktree_jobs: Vec<WorktreeJob>,
    /// The agents each computer can start (`agent.manifest.list`), by host id.
    pub providers: HashMap<String, Vec<super::Provider>>,
    /// Per computer, `isDefault` of each agent whose manifest says.
    pub provider_defaults: HashMap<String, HashMap<String, bool>>,
    /// Per computer, an agent list asked for again or refused; absent once answered.
    pub agent_lists: HashMap<String, AgentList>,
    /// `programs.json` as the core checked it (`mods.state`), while there is one.
    pub programs: Option<serde_json::Value>,
    /// Sessions the core said it deleted (`session.deleted`) while the window followed it: their
    /// tabs close even when no terminal is attached to hear it.
    pub deleted: Vec<String>,
}

/// A computer's agent list while it is not simply answered.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AgentList {
    /// Asked for, not answered yet (the last answer, if any, is still shown).
    Loading,
    /// The core refused it, with its message.
    Failed(String),
}

impl PartialEq for Store {
    fn eq(&self, other: &Self) -> bool {
        self.revision == other.revision
    }
}

/// What the screen shows and how it asked for it (`useNavigation`'s options and the store's
/// active ids).
#[derive(Clone, Debug, PartialEq)]
pub struct View {
    pub host_id: String,
    pub session_id: Option<String>,
    pub workspace_id: Option<String>,
    pub show_terminals: bool,
    pub sort_by_attention: bool,
}

impl Default for View {
    fn default() -> Self {
        Self {
            host_id: LOCAL.into(),
            session_id: None,
            workspace_id: None,
            show_terminals: false,
            sort_by_attention: false,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub id: String,
    pub title: String,
    pub host_id: String,
    pub cwd: String,
    pub created_at: i64,
    pub status: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    /// The branch of the separate checkout it runs in, when that is not its workspace's folder (a
    /// sub-session started with `perch spawn --worktree`, which stays with its lead).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checkout: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    /// `AgentState`: blocked, working, done or idle.
    pub state: &'static str,
    /// `StatusSection`: needs, done, working or idle.
    pub section: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub need_reason: Option<String>,
    pub blocked: bool,
    pub unseen: bool,
    pub active: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeJobInfo {
    pub id: String,
    pub branch: String,
    pub path: String,
    pub status: String,
    pub phase: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    pub dirty: bool,
    pub pinned: bool,
    pub sleeping: bool,
    pub linked: bool,
    pub active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shortcut: Option<String>,
    pub sessions: Vec<SessionInfo>,
    pub children: Vec<WorkspaceInfo>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub id: String,
    pub host_id: String,
    pub name: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repo_path: Option<String>,
    pub favorite: bool,
    pub quickchat: bool,
    pub workspaces: Vec<WorkspaceInfo>,
    pub hidden: Vec<WorkspaceInfo>,
    pub jobs: Vec<WorktreeJobInfo>,
    pub sessions: Vec<SessionInfo>,
    pub has_chats: bool,
    pub top: Option<&'static str>,
    pub instructions: bool,
    pub memory: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusProject {
    pub id: String,
    pub name: String,
    pub project: Option<ProjectInfo>,
    pub sessions: Vec<SessionInfo>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusGroup {
    /// A `StatusSection`, or `offline`.
    pub key: &'static str,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    pub sessions: Vec<SessionInfo>,
    pub projects: Vec<StatusProject>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Navigation {
    pub host_id: String,
    pub reachable: bool,
    pub loading: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub reorderable: bool,
    pub projects: Vec<ProjectInfo>,
    pub quickchat: Option<ProjectInfo>,
    pub sessions: Vec<SessionInfo>,
    pub status: Vec<StatusGroup>,
    pub needs_you: usize,
    pub active_workspace_id: Option<String>,
    pub active_session_id: Option<String>,
    pub shortcuts: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostInfo {
    pub id: String,
    pub name: String,
    pub state: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    pub direct: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHost {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub platform: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_ssh: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Hosts {
    pub active_id: String,
    pub active: HostInfo,
    pub list: Vec<HostInfo>,
    pub local: LocalHost,
    pub connected: bool,
    pub can_create: bool,
    pub workspaces: bool,
}

/// `STATUS_SECTIONS`, most urgent first.
const SECTIONS: [Attention; 4] = [
    Attention::NeedsYou,
    Attention::Done,
    Attention::Working,
    Attention::Idle,
];

fn section_key(attention: Attention) -> &'static str {
    match attention {
        Attention::NeedsYou => "needs",
        Attention::Done => "done",
        Attention::Working => "working",
        Attention::Idle => "idle",
    }
}

fn rank(attention: Attention) -> usize {
    SECTIONS.iter().position(|a| *a == attention).unwrap_or(3)
}

fn dot_word(dot: Dot) -> &'static str {
    match dot {
        Dot::Blocked => "blocked",
        Dot::Working => "working",
        Dot::Done => "done",
        Dot::Idle => "idle",
    }
}

fn basename(path: &str) -> String {
    let trimmed = path.trim_end_matches('/');
    match trimmed.rsplit('/').next() {
        Some(last) if !last.is_empty() => last.to_string(),
        _ => path.to_string(),
    }
}

fn non_empty(text: &Option<String>) -> Option<String> {
    text.clone().filter(|t| !t.is_empty())
}

fn is_chats(project: &ProjectSummary) -> bool {
    super::is_chats(project)
}

fn project_name(project: &ProjectSummary) -> String {
    if is_chats(project) {
        "Quickchat".into()
    } else if project.name.is_empty() {
        basename(&project.path)
    } else {
        project.name.clone()
    }
}

fn provider_of(session: &SessionSummary) -> Option<&str> {
    session
        .current_provider_id
        .as_deref()
        .or(session.cli_provider_id.as_deref())
}

/// `orderBy`: ids the order does not know first, as given, then the known ones in its order.
fn order_by<T: Clone>(items: Vec<T>, order: &[String], id: impl Fn(&T) -> &str) -> Vec<T> {
    if order.is_empty() {
        return items;
    }
    let mut rank: HashMap<&str, usize> = HashMap::new();
    for (at, key) in order.iter().enumerate() {
        rank.entry(key.as_str()).or_insert(at);
    }
    let (mut known, mut fresh): (Vec<T>, Vec<T>) = items
        .into_iter()
        .partition(|item| rank.contains_key(id(item)));
    known.sort_by_key(|item| rank[id(item)]);
    fresh.append(&mut known);
    fresh
}

/// `workspacesForProject`: live (not archived) checkouts, pinned first, then active, then the
/// most recently used.
fn workspaces_for_project<'a>(
    workspaces: &'a [WorkspaceSummary],
    project_id: &str,
) -> Vec<&'a WorkspaceSummary> {
    let mut all: Vec<&WorkspaceSummary> = workspaces
        .iter()
        .filter(|w| w.project_id == project_id && w.state != WorkspaceState::Archived)
        .collect();
    all.sort_by(|a, b| {
        b.pinned
            .cmp(&a.pinned)
            .then_with(|| {
                if a.state == b.state {
                    std::cmp::Ordering::Equal
                } else if a.state == WorkspaceState::Active {
                    std::cmp::Ordering::Less
                } else {
                    std::cmp::Ordering::Greater
                }
            })
            .then_with(|| b.updated_at.cmp(&a.updated_at))
    });
    all
}

/// The id the Quickchat section has on `host_id` before the core has made its project.
pub fn quickchat_placeholder(host_id: &str) -> String {
    format!("quickchat:{host_id}")
}

/// The checkout a new tab of project `project_id` lands in (the web's launcher): the one session
/// `shown` belongs to when it is the project's, else the project's first. `(id, path)`.
pub fn landing_workspace(
    store: &Store,
    project_id: &str,
    shown: Option<&str>,
) -> Option<(String, String)> {
    let mine = workspaces_for_project(&store.workspaces, project_id);
    let session = shown.and_then(|id| store.sessions.iter().find(|s| s.id == id));
    let on_screen = session.and_then(|s| mine.iter().find(|w| in_workspace(s, w)));
    on_screen
        .or(mine.first())
        .map(|w| (w.id.clone(), w.path.clone()))
}

/// Whether `session` belongs to `workspace`: by id, or for an older record by folder.
pub fn in_workspace(session: &SessionSummary, workspace: &WorkspaceSummary) -> bool {
    match &session.workspace_id {
        Some(id) => *id == workspace.id,
        None => session.host_id == workspace.host_id && session.cwd == workspace.path,
    }
}

/// Whether two sessions are of one workspace: by id, or for an older record by folder.
pub fn same_workspace(a: &SessionSummary, b: &SessionSummary) -> bool {
    match (&a.workspace_id, &b.workspace_id) {
        (Some(x), Some(y)) => x == y,
        _ => a.host_id == b.host_id && a.cwd == b.cwd,
    }
}

/// The ids of the sessions of `session`'s workspace in its tab strip's order (the sidebar lists
/// them in it): oldest first, then the core's chat order over them.
pub fn strip_of_workspace(store: &Store, session: &SessionSummary) -> Vec<String> {
    Builder::new(store, &View::default())
        .strip_of(&session.host_id, |s| same_workspace(s, session))
        .into_iter()
        .map(|s| s.id.clone())
        .collect()
}

/// The key of the workspace whose strip shows `session`: the workspace the core records, else
/// for an older record the one at its folder, else `<host>:<folder>`.
pub fn workspace_key(store: &Store, session: &SessionSummary) -> String {
    match &session.workspace_id {
        Some(w) => w.clone(),
        None => store
            .workspaces
            .iter()
            .find(|w| in_workspace(session, w))
            .map_or_else(
                || format!("{}:{}", session.host_id, session.cwd),
                |w| w.id.clone(),
            ),
    }
}

/// Every session of the workspace keyed `key` (see [`workspace_key`]) in its strip's order, as
/// the web's `workspaceTabs` lists them: oldest first, then the core's chat order. Sub-sessions
/// are not moved next to their lead: the strip keeps the order a person dragged into it.
pub fn sessions_of_workspace(store: &Store, key: &str) -> Vec<String> {
    let mine: HashSet<&str> = store
        .sessions
        .iter()
        .filter(|s| workspace_key(store, s) == key)
        .map(|s| s.id.as_str())
        .collect();
    let Some(first) = store.sessions.iter().find(|s| mine.contains(s.id.as_str())) else {
        return Vec::new();
    };
    strip_of_workspace(store, first)
        .into_iter()
        .filter(|id| mine.contains(id.as_str()))
        .collect()
}

/// `terminalScopeId`: the Files and Git scope of a terminal on this computer whose shell is
/// known to be outside its workspace's folder, `term:<session id>:<base64url folder>`; `None`
/// for any other session, which keeps its workspace.
pub fn terminal_scope_id(store: &Store, session: &SessionSummary) -> Option<String> {
    use base64::Engine;
    let cwd = session.current_cwd.as_deref()?;
    let workspace_id = session.workspace_id.as_deref()?;
    if session.host_id != LOCAL {
        return None;
    }
    let workspace = store.workspaces.iter().find(|w| w.id == workspace_id)?;
    (workspace.path != cwd).then(|| {
        let folder = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(cwd);
        format!("term:{}:{folder}", session.id)
    })
}

/// The workspace a Files or Git scope is filed under: a `term:` scope's terminal's (`None` once
/// that terminal is gone), a `dir:` scope's own, and a plain workspace id is itself.
pub fn scope_workspace(store: &Store, scope: &str) -> Option<String> {
    if let Some(rest) = scope.strip_prefix("term:") {
        let session_id = rest.split(':').next()?;
        let session = store.sessions.iter().find(|s| s.id == session_id)?;
        return Some(workspace_key(store, session));
    }
    if let Some(rest) = scope.strip_prefix("dir:") {
        return rest.split(':').next().map(str::to_string);
    }
    Some(scope.to_string())
}

/// `workspaceRecord`: the workspace row a Files or Git id stands for. A `term:` scope is a
/// hidden local row at its folder (its terminal's project and branch while that terminal is
/// there; the core keeps resolving the scope after it closes), a `dir:` scope a hidden row at
/// its folder under its workspace, any other id the core's own row.
pub fn workspace_record(store: &Store, id: &str) -> Option<WorkspaceSummary> {
    use base64::Engine;
    let decode = |text: &str| {
        base64::engine::general_purpose::URL_SAFE_NO_PAD
            .decode(text)
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok())
    };
    let name_of = |path: &str| {
        path.trim_end_matches('/')
            .rsplit('/')
            .next()
            .filter(|name| !name.is_empty())
            .unwrap_or("/")
            .to_string()
    };
    if let Some(rest) = id.strip_prefix("dir:") {
        let (workspace_id, encoded) = rest.split_once(':')?;
        let workspace = store.workspaces.iter().find(|w| w.id == workspace_id)?;
        let path = decode(encoded).filter(|path| !path.is_empty())?;
        return Some(WorkspaceSummary {
            id: id.to_string(),
            name: name_of(&path),
            path,
            branch: None,
            dirty: false,
            hidden: true,
            ..workspace.clone()
        });
    }
    let Some(rest) = id.strip_prefix("term:") else {
        return store.workspaces.iter().find(|w| w.id == id).cloned();
    };
    let (session_id, encoded) = rest.split_once(':')?;
    let path = decode(encoded)?;
    let session = store.sessions.iter().find(|s| s.id == session_id);
    let created = session.map_or(0, |s| s.created_at);
    Some(WorkspaceSummary {
        id: id.to_string(),
        project_id: session
            .and_then(|s| s.project_id.clone())
            .unwrap_or_default(),
        host_id: LOCAL.to_string(),
        name: name_of(&path),
        branch: session
            .filter(|s| s.current_cwd.as_deref() == Some(path.as_str()))
            .and_then(|s| s.current_branch.clone()),
        base_branch: None,
        dirty: false,
        start_snapshot: None,
        parent_workspace_id: None,
        state: WorkspaceState::Active,
        created_at: created,
        updated_at: created,
        pinned: false,
        hidden: true,
        path,
    })
}

/// `sessionsForWorkspace`: newest first.
fn sessions_for_workspace<'a>(
    sessions: &[&'a SessionSummary],
    workspace: &WorkspaceSummary,
) -> Vec<&'a SessionSummary> {
    let mut mine: Vec<&SessionSummary> = sessions
        .iter()
        .copied()
        .filter(|s| in_workspace(s, workspace))
        .collect();
    mine.sort_by_key(|s| std::cmp::Reverse(s.created_at));
    mine
}

/// The facts `info` needs about attention.
struct Facts<'a> {
    /// The last of `needsYou`'s events per session, as the web's map keeps it.
    needs: HashMap<&'a str, &'a AttentionEvent>,
    ids: HashSet<String>,
    held: Option<String>,
}

impl Facts<'_> {
    fn section(&self, session: &SessionSummary) -> Attention {
        section(session, &self.ids, self.held.as_deref())
    }

    /// `topSection`: the most urgent section among `sessions`, `None` for none.
    fn top(&self, sessions: &[&SessionSummary]) -> Option<Attention> {
        sessions
            .iter()
            .map(|s| self.section(s))
            .min_by_key(|a| rank(*a))
    }
}

/// `needsYou`: questions first, then failures, oldest first in each.
fn needs_you(events: &[AttentionEvent]) -> Vec<&AttentionEvent> {
    let mut list: Vec<&AttentionEvent> = events
        .iter()
        .filter(|e| e.requires_action || e.kind == "question")
        .collect();
    list.sort_by_key(|e| (e.kind != "question", e.occurred_at));
    list
}

/// `reasonLabel` and `certaintyNote`, joined.
fn need_reason(event: &AttentionEvent) -> String {
    let reason = match event.kind.as_str() {
        "question" if event.certainty == "unconfirmed" => {
            "Was waiting for you before restart".into()
        }
        "question" => "Waiting for you".into(),
        "failed" if event.summary.is_empty() => "Failed".into(),
        "failed" => event.summary.clone(),
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

fn reachable(store: &Store, host_id: &str) -> bool {
    if host_id == LOCAL {
        store.connected
    } else {
        store
            .host_states
            .get(host_id)
            .is_some_and(|f| f.state == "connected")
    }
}

/// The capabilities of `host_id`'s core: `server.info`'s for this computer, `host.info`'s else.
fn capabilities<'a>(store: &'a Store, host_id: &str) -> Option<&'a [String]> {
    if host_id == LOCAL {
        store
            .hostname
            .as_ref()
            .map(|_| store.local_capabilities.as_slice())
    } else {
        store.host_capabilities.get(host_id).map(Vec::as_slice)
    }
}

fn has(list: Option<&[String]>, wanted: &str) -> bool {
    list.is_some_and(|l| l.iter().any(|c| c == wanted))
}

/// `ids` with `id` moved just before `target`, or just after it; to the end when `target` is not
/// among them (`moveBeside`).
pub fn move_beside(ids: &[String], id: &str, target: &str, after: bool) -> Vec<String> {
    let mut rest: Vec<String> = ids.iter().filter(|other| *other != id).cloned().collect();
    let at = rest
        .iter()
        .position(|other| other == target)
        .map_or(rest.len(), |at| at + usize::from(after));
    if ids.iter().any(|other| other == id) {
        rest.insert(at.min(rest.len()), id.to_string());
    }
    rest
}

/// Above this many ids, an order written is pruned to the live ones (`PRUNE_ABOVE`).
const PRUNE_ABOVE: usize = 256;

/// The core's order `list` with the ids of `scope` written in `scope`'s order into the slots
/// they held, and those it did not hold after the last of them (`writeScope`): the ids out of
/// scope keep their places, so a move in one group changes no other.
pub fn write_scope(
    list: &[String],
    scope: &[String],
    live: Option<&HashSet<String>>,
) -> Vec<String> {
    let in_scope: HashSet<&str> = scope.iter().map(String::as_str).collect();
    let mut seen = HashSet::new();
    let mut next = 0;
    let mut last = None;
    let mut out: Vec<String> = Vec::new();
    for id in list.iter().filter(|id| seen.insert(id.as_str())) {
        if in_scope.contains(id.as_str()) {
            last = Some(out.len());
            out.push(scope[next].clone());
            next += 1;
        } else {
            out.push(id.clone());
        }
    }
    let at = last.map_or(out.len(), |at| at + 1);
    out.splice(at..at, scope[next..].iter().cloned());
    match live {
        Some(live) if out.len() > PRUNE_ABOVE => {
            out.into_iter().filter(|id| live.contains(id)).collect()
        }
        _ => out,
    }
}

/// `useNavigation`: the shown computer's projects, workspaces and sessions with Perch's rules.
pub fn navigation(store: &Store, view: &View) -> Navigation {
    Builder::new(store, view).navigation()
}

struct Builder<'a> {
    store: &'a Store,
    view: &'a View,
    /// The listed sessions (`sessions` in `navigation.ts`), in the store's order.
    sessions: Vec<&'a SessionSummary>,
    listed: HashSet<&'a str>,
    facts: Facts<'a>,
    reachable: bool,
}

impl<'a> Builder<'a> {
    fn new(store: &'a Store, view: &'a View) -> Self {
        let chats: HashSet<&str> = store
            .projects
            .iter()
            .filter(|p| is_chats(p))
            .map(|p| p.id.as_str())
            .collect();
        // Project terminals stay tabs unless asked; Quickchat lists every session.
        let sessions: Vec<&SessionSummary> = store
            .sessions
            .iter()
            .filter(|s| {
                view.show_terminals
                    || s.project_id.as_deref().is_some_and(|p| chats.contains(p))
                    || provider_of(s) != Some(TERMINAL)
            })
            .collect();
        let listed: HashSet<&str> = sessions.iter().map(|s| s.id.as_str()).collect();
        // The hold applies to the session on screen, and only while it is listed.
        let held = store
            .held
            .clone()
            .filter(|h| view.session_id.as_deref() == Some(h.as_str()))
            .filter(|h| listed.contains(h.as_str()));
        let mut needs = HashMap::new();
        for event in needs_you(&store.needs_events) {
            needs.insert(event.session_id.as_str(), event);
        }
        let ids = needs.keys().map(|k| k.to_string()).collect();
        Self {
            store,
            view,
            sessions,
            listed,
            facts: Facts { needs, ids, held },
            reachable: reachable(store, &view.host_id),
        }
    }

    fn workspace_label(&self, session: &SessionSummary) -> Option<String> {
        let own = self
            .store
            .workspaces
            .iter()
            .find(|w| session.workspace_id.as_deref() == Some(w.id.as_str()))?;
        let shown = workspaces_for_project(&self.store.workspaces, &own.project_id)
            .into_iter()
            .filter(|w| !w.hidden)
            .count();
        (shown >= 2).then(|| non_empty(&own.branch).unwrap_or_else(|| own.name.clone()))
    }

    /// The branch of the other checkout `session` runs in (navigation.ts `checkout`).
    fn checkout(&self, session: &SessionSummary) -> Option<String> {
        session.workspace_id.as_ref()?;
        let other = self.store.workspaces.iter().find(|w| {
            session.workspace_id.as_deref() != Some(w.id.as_str())
                && w.host_id == session.host_id
                && w.path == session.cwd
        })?;
        non_empty(&other.branch)
            .or_else(|| (!other.name.is_empty()).then(|| other.name.clone()))
            .or_else(|| {
                std::path::Path::new(&other.path)
                    .file_name()
                    .map(|name| name.to_string_lossy().into_owned())
            })
    }

    fn info(&self, session: &SessionSummary) -> SessionInfo {
        let section = self.facts.section(session);
        let need_reason = (section == Attention::NeedsYou).then(|| {
            self.facts
                .needs
                .get(session.id.as_str())
                .map_or_else(|| "Waiting for you".to_string(), |e| need_reason(e))
        });
        let owner = self
            .store
            .projects
            .iter()
            .find(|p| session.project_id.as_deref() == Some(p.id.as_str()));
        SessionInfo {
            id: session.id.clone(),
            title: session.title.clone(),
            host_id: session.host_id.clone(),
            cwd: session.cwd.clone(),
            created_at: session.created_at,
            status: match session.status {
                SessionStatus::Running => "running",
                SessionStatus::Idle => "idle",
            },
            branch: session.current_branch.clone(),
            project_id: session.project_id.clone(),
            project_name: owner.map(project_name),
            workspace_id: session.workspace_id.clone(),
            workspace_label: self.workspace_label(session),
            parent_id: session.parent_session_id.clone(),
            checkout: self.checkout(session),
            provider: provider_of(session).map(str::to_string),
            state: dot_word(dot(session)),
            section: section_key(section),
            need_reason,
            blocked: session.blocked,
            unseen: session.unseen,
            active: self.view.session_id.as_deref() == Some(session.id.as_str()),
        }
    }

    /// The core's chat order for `host_id`.
    fn session_order(&self, host_id: &str) -> &'a [String] {
        self.store
            .order
            .get(host_id)
            .map_or(&[][..], |(_, sessions)| sessions.as_slice())
    }

    /// `workspaceTabs` for `workspace`, sessions only: every session of the checkout (listed or
    /// not) oldest first, then the core's chat order over them.
    fn strip(&self, workspace: &WorkspaceSummary) -> Vec<&'a SessionSummary> {
        self.strip_of(&workspace.host_id, |s| in_workspace(s, workspace))
    }

    /// [`Self::strip`] for the sessions `of` accepts, on computer `host_id`.
    fn strip_of(
        &self,
        host_id: &str,
        of: impl Fn(&SessionSummary) -> bool,
    ) -> Vec<&'a SessionSummary> {
        let mut mine: Vec<&SessionSummary> = self.store.sessions.iter().filter(|s| of(s)).collect();
        mine.sort_by_key(|s| s.created_at);
        let order = self.session_order(host_id);
        if order.is_empty() {
            return mine;
        }
        // `applySessionOrder`: the sessions the order knows take its order in their own slots.
        let known: HashSet<&str> = order.iter().map(String::as_str).collect();
        let slotted: Vec<&SessionSummary> = mine
            .iter()
            .copied()
            .filter(|s| known.contains(s.id.as_str()))
            .collect();
        let mut fill = order_by(slotted, order, |s| s.id.as_str()).into_iter();
        mine.into_iter()
            .map(|s| {
                if known.contains(s.id.as_str()) {
                    fill.next().unwrap_or(s)
                } else {
                    s
                }
            })
            .collect()
    }

    /// A checkout's listed sessions in its strip's order.
    fn strip_sessions(&self, workspace: &WorkspaceSummary) -> Vec<&'a SessionSummary> {
        self.strip(workspace)
            .into_iter()
            .filter(|s| self.listed.contains(s.id.as_str()))
            .collect()
    }

    /// A checkout's place in the attention order: its most urgent section, Idle when nothing is
    /// known.
    fn urgency(&self, sessions: &[&SessionSummary]) -> usize {
        let top = if self.reachable {
            self.facts.top(sessions)
        } else {
            None
        };
        top.map_or(SECTIONS.len() - 1, rank)
    }

    fn workspace_info(
        &self,
        workspace: &WorkspaceSummary,
        children: &HashMap<&str, Vec<&WorkspaceSummary>>,
        depth: usize,
    ) -> WorkspaceInfo {
        WorkspaceInfo {
            id: workspace.id.clone(),
            project_id: workspace.project_id.clone(),
            name: if workspace.name.is_empty() {
                basename(&workspace.path)
            } else {
                workspace.name.clone()
            },
            path: workspace.path.clone(),
            branch: non_empty(&workspace.branch),
            dirty: workspace.dirty,
            pinned: workspace.pinned,
            sleeping: workspace.state == WorkspaceState::Sleeping,
            linked: workspace.parent_workspace_id.is_some(),
            active: self.view.workspace_id.as_deref() == Some(workspace.id.as_str()),
            shortcut: None,
            sessions: self
                .strip_sessions(workspace)
                .into_iter()
                .map(|s| self.info(s))
                .collect(),
            // Eight levels, as deep as a worktree of a worktree ever reasonably goes.
            children: if depth < 8 {
                children
                    .get(workspace.id.as_str())
                    .map(|list| {
                        list.iter()
                            .map(|child| self.workspace_info(child, children, depth + 1))
                            .collect()
                    })
                    .unwrap_or_default()
            } else {
                Vec::new()
            },
        }
    }

    fn project_info(&self, project: &ProjectSummary) -> ProjectInfo {
        let all = workspaces_for_project(&self.store.workspaces, &project.id);
        let shown: Vec<&WorkspaceSummary> = all.iter().copied().filter(|w| !w.hidden).collect();
        // A worktree whose parent is another linked worktree sits under it; children of the
        // primary checkout stay top level.
        let by_id: HashMap<&str, &WorkspaceSummary> =
            shown.iter().map(|w| (w.id.as_str(), *w)).collect();
        let mut children: HashMap<&str, Vec<&WorkspaceSummary>> = HashMap::new();
        let mut roots: Vec<&WorkspaceSummary> = Vec::new();
        for w in &shown {
            let parent = w
                .parent_workspace_id
                .as_deref()
                .and_then(|p| by_id.get(p).copied());
            match parent {
                Some(parent) if parent.parent_workspace_id.is_some() => {
                    children.entry(parent.id.as_str()).or_default().push(w)
                }
                _ => roots.push(w),
            }
        }
        if self.view.sort_by_attention {
            roots.sort_by_key(|w| {
                (
                    !w.pinned,
                    self.urgency(&sessions_for_workspace(&self.sessions, w)),
                )
            });
        }
        let own: Vec<&SessionSummary> = all.iter().flat_map(|w| self.strip_sessions(w)).collect();
        let local = project.host_id == LOCAL;
        let local_has = |capability| {
            local && self.store.connected && has(capabilities(self.store, LOCAL), capability)
        };
        ProjectInfo {
            id: project.id.clone(),
            host_id: project.host_id.clone(),
            name: project_name(project),
            path: project.path.clone(),
            repo_path: non_empty(&project.repo_path),
            favorite: project.favorite,
            quickchat: is_chats(project),
            workspaces: roots
                .iter()
                .map(|w| self.workspace_info(w, &children, 0))
                .collect(),
            hidden: all
                .iter()
                .filter(|w| w.hidden)
                .map(|w| self.workspace_info(w, &HashMap::new(), 0))
                .collect(),
            jobs: if local {
                let repo = project.repo_path.as_deref().unwrap_or_default();
                self.store
                    .worktree_jobs
                    .iter()
                    .filter(|j| j.repo_path == repo || j.repo_path == project.path)
                    .map(|j| WorktreeJobInfo {
                        id: j.job_id.clone(),
                        branch: j.branch.clone(),
                        path: j.path.clone(),
                        status: j.status.clone(),
                        phase: j.phase.clone(),
                        error: j.error.clone(),
                    })
                    .collect()
            } else {
                Vec::new()
            },
            sessions: own.iter().map(|s| self.info(s)).collect(),
            has_chats: self
                .sessions
                .iter()
                .any(|s| s.project_id.as_deref() == Some(project.id.as_str())),
            top: if self.reachable {
                self.facts.top(&own).map(section_key)
            } else {
                None
            },
            instructions: local_has(INSTRUCTIONS_CAPABILITY),
            memory: local_has(MEMORY_CAPABILITY),
        }
    }

    /// `chatsInStripOrder`: oldest first, each checkout's chats in its strip's order.
    fn chats_in_strip_order(&self, sessions: &[&'a SessionSummary]) -> Vec<&'a SessionSummary> {
        let mut out: Vec<&SessionSummary> = sessions.to_vec();
        out.sort_by_key(|s| s.created_at);
        for workspace in &self.store.workspaces {
            let owner = |s: &SessionSummary| {
                self.store
                    .workspaces
                    .iter()
                    .find(|w| in_workspace(s, w))
                    .map(|w| w.id.as_str())
            };
            let mine: HashSet<&str> = out
                .iter()
                .filter(|s| owner(s) == Some(workspace.id.as_str()))
                .map(|s| s.id.as_str())
                .collect();
            let strip: Vec<&SessionSummary> = self
                .strip(workspace)
                .into_iter()
                .filter(|s| mine.contains(s.id.as_str()))
                .collect();
            if strip.len() == mine.len() {
                let mut fill = strip.into_iter();
                out = out
                    .into_iter()
                    .map(|s| {
                        if mine.contains(s.id.as_str()) {
                            fill.next().unwrap_or(s)
                        } else {
                            s
                        }
                    })
                    .collect();
            }
        }
        out
    }

    fn navigation(&self) -> Navigation {
        let store = self.store;
        let host_id = self.view.host_id.as_str();
        let (project_order, session_order) = store
            .order
            .get(host_id)
            .map_or((&[][..], &[][..]), |(p, s)| (p.as_slice(), s.as_slice()));

        // Favourites first, then the most recently changed, then the core's order (favourites
        // still first); Quickchat is listed apart.
        let mut host_projects: Vec<&ProjectSummary> = store
            .projects
            .iter()
            .filter(|p| p.host_id == host_id)
            .collect();
        host_projects.sort_by(|a, b| {
            b.favorite
                .cmp(&a.favorite)
                .then_with(|| b.updated_at.cmp(&a.updated_at))
        });
        let ordered = order_by(host_projects, project_order, |p| p.id.as_str());
        let (favorites, rest): (Vec<_>, Vec<_>) = ordered.into_iter().partition(|p| p.favorite);
        let host_projects: Vec<&ProjectSummary> = favorites.into_iter().chain(rest).collect();

        let chats = host_projects.iter().copied().find(|p| is_chats(p));
        let visible: Vec<(&ProjectSummary, ProjectInfo)> = host_projects
            .iter()
            .copied()
            .filter(|p| !is_chats(p))
            .map(|p| (p, self.project_info(p)))
            .collect();
        // The web's client makes the Quickchat project as it connects (its blank session); this
        // one does not, so until the first quickchat the section stands for the project the core
        // makes then, with nothing in it, as the web draws it.
        let placeholder = (chats.is_none() && reachable(store, host_id)).then(|| ProjectSummary {
            id: quickchat_placeholder(host_id),
            host_id: host_id.to_string(),
            name: "Chats".into(),
            path: "~/.perch/scratch".into(),
            repo_path: None,
            default_branch: None,
            favorite: false,
            settings: None,
            created_at: 0,
            updated_at: 0,
        });
        let quickchat = chats.or(placeholder.as_ref()).map(|p| self.project_info(p));
        let mut shown: Vec<(usize, bool, usize, &ProjectInfo)> = visible
            .iter()
            .enumerate()
            .map(|(at, (project, info))| {
                let urgent = workspaces_for_project(&store.workspaces, &project.id)
                    .iter()
                    .map(|w| self.urgency(&sessions_for_workspace(&self.sessions, w)))
                    .min()
                    .unwrap_or(SECTIONS.len())
                    .min(SECTIONS.len());
                (at, project.favorite, urgent, info)
            })
            .collect();
        if self.view.sort_by_attention {
            shown.sort_by_key(|e| (!e.1, e.2, e.0));
        }
        let projects: Vec<ProjectInfo> = shown.into_iter().map(|e| e.3.clone()).collect();

        // Every listed session of the computer, newest first; the core's order does not apply.
        let mut host_sessions: Vec<&SessionSummary> = self
            .sessions
            .iter()
            .copied()
            .filter(|s| s.host_id == host_id)
            .collect();
        host_sessions.sort_by_key(|s| std::cmp::Reverse(s.created_at));
        // By status, newest first: the strips' order reversed, then the core's chat order
        // reversed, so chats the core has not listed yet sit on top.
        let mut reversed = self.chats_in_strip_order(&host_sessions);
        reversed.reverse();
        let order_reversed: Vec<String> = session_order.iter().rev().cloned().collect();
        let status_chats = order_by(reversed, &order_reversed, |s| s.id.as_str());

        let in_order: Vec<&ProjectInfo> = visible
            .iter()
            .map(|(_, info)| info)
            .chain(quickchat.as_ref())
            .collect();
        let known: HashSet<&str> = in_order.iter().map(|p| p.id.as_str()).collect();
        let by_project = |list: &[&SessionSummary]| -> Vec<StatusProject> {
            let groups = in_order
                .iter()
                .map(|p| (p.id.clone(), p.name.clone(), Some((*p).clone())))
                .chain([("other".to_string(), "Other".to_string(), None)]);
            groups
                .filter_map(|(id, name, project)| {
                    let rows: Vec<SessionInfo> = list
                        .iter()
                        .filter(|s| {
                            let group = s
                                .project_id
                                .as_deref()
                                .filter(|p| known.contains(p))
                                .unwrap_or("other");
                            group == id
                        })
                        .map(|s| self.info(s))
                        .collect();
                    (!rows.is_empty()).then_some(StatusProject {
                        id,
                        name,
                        project,
                        sessions: rows,
                    })
                })
                .collect()
        };
        let group = |wanted: Attention| -> Vec<&SessionSummary> {
            status_chats
                .iter()
                .copied()
                .filter(|s| self.facts.section(s) == wanted)
                .collect()
        };
        let status: Vec<StatusGroup> = if self.reachable {
            SECTIONS
                .iter()
                .filter_map(|&wanted| {
                    let members = group(wanted);
                    (!members.is_empty()).then(|| StatusGroup {
                        key: section_key(wanted),
                        title: wanted.heading().into(),
                        note: None,
                        sessions: members.iter().map(|s| self.info(s)).collect(),
                        projects: by_project(&members),
                    })
                })
                .collect()
        } else if host_sessions.is_empty() {
            Vec::new()
        } else {
            // What these were doing is unknown: shown once, as last known.
            let note = if host_id == LOCAL {
                "Reconnecting…".to_string()
            } else {
                let name = store
                    .host_entries
                    .iter()
                    .find(|h| h.id == host_id)
                    .map_or(host_id, |h| h.name.as_str());
                let state = store
                    .host_states
                    .get(host_id)
                    .map_or("connecting", |f| f.state.as_str());
                format!("{name}: {state}")
            };
            vec![StatusGroup {
                key: "offline",
                title: "Offline: last known".into(),
                note: Some(note),
                sessions: status_chats.iter().map(|s| self.info(s)).collect(),
                projects: by_project(&status_chats),
            }]
        };

        let snapshot = store.snapshots.get(host_id);
        let can_reorder = self.reachable
            && (host_id != LOCAL || store.hostname.is_some())
            && has(capabilities(store, host_id), ORDER_CAPABILITY);
        Navigation {
            host_id: host_id.to_string(),
            reachable: self.reachable,
            loading: snapshot == Some(&SnapshotState::Loading),
            error: match snapshot {
                Some(SnapshotState::Error(error)) if error.is_empty() => {
                    Some("Workspace could not be loaded.".into())
                }
                Some(SnapshotState::Error(error)) => Some(error.clone()),
                _ => None,
            },
            reorderable: can_reorder && !self.view.sort_by_attention,
            projects,
            quickchat,
            sessions: host_sessions.iter().map(|s| self.info(s)).collect(),
            needs_you: if self.reachable {
                group(Attention::NeedsYou).len()
            } else {
                0
            },
            status,
            active_workspace_id: self.view.workspace_id.clone(),
            active_session_id: self.view.session_id.clone(),
            shortcuts: false,
        }
    }
}

/// `useHosts`: this computer first, then every configured one, and the one shown.
/// One folder of `useSessionFolders`. Its `git` summary is not followed by the native client, so
/// it is absent.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionFolder {
    pub key: String,
    pub cwd: String,
    pub active: bool,
    pub state: &'static str,
    pub sessions: Vec<SessionInfo>,
    pub registered: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub review_workspace_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionFolders {
    pub host_id: String,
    pub folders: Vec<SessionFolder>,
}

/// `useSessionFolders`: the shown computer's sessions by the folder they run in, the folder with
/// the newest session first and each folder's newest session first (`projectsForHost`). The
/// active folder is the shown session's, else the newest. No folder's git state is followed here.
pub fn session_folders(store: &Store, view: &View) -> SessionFolders {
    let builder = Builder::new(store, view);
    let host = view.host_id.as_str();
    let mut groups: Vec<(String, Vec<&SessionSummary>)> = Vec::new();
    for session in store.sessions.iter().filter(|s| s.host_id == host) {
        let cwd = if session.cwd.is_empty() {
            "(unknown)"
        } else {
            session.cwd.as_str()
        };
        match groups.iter_mut().find(|(c, _)| c == cwd) {
            Some((_, list)) => list.push(session),
            None => groups.push((cwd.to_string(), vec![session])),
        }
    }
    for (_, list) in &mut groups {
        list.sort_by_key(|s| std::cmp::Reverse(s.created_at));
    }
    groups.sort_by_key(|g| std::cmp::Reverse(g.1[0].created_at));
    let shown = view
        .session_id
        .as_deref()
        .and_then(|id| {
            store
                .sessions
                .iter()
                .find(|s| s.id == id && s.host_id == host)
        })
        .map(|s| s.cwd.as_str())
        .filter(|cwd| groups.iter().any(|(c, _)| c == cwd));
    let active = shown
        .or_else(|| groups.first().map(|(c, _)| c.as_str()))
        .map(str::to_string);
    let review = has(capabilities(store, host), "git.status");
    let folders = groups
        .iter()
        .map(|(cwd, list)| SessionFolder {
            key: format!("{host}:{cwd}"),
            cwd: cwd.clone(),
            active: active.as_deref() == Some(cwd.as_str()),
            state: list
                .iter()
                .map(|s| dot(s))
                .min_by_key(|d| *d as usize)
                .map_or("unknown", dot_word),
            sessions: list.iter().map(|s| builder.info(s)).collect(),
            registered: store
                .projects
                .iter()
                .any(|p| p.host_id == host && p.repo_path.as_deref() == Some(cwd.as_str())),
            review_workspace_id: review
                .then(|| list.iter().find_map(|s| s.workspace_id.clone()))
                .flatten(),
        })
        .collect();
    SessionFolders {
        host_id: host.to_string(),
        folders,
    }
}

pub fn hosts(store: &Store, active_id: &str) -> Hosts {
    let local = HostInfo {
        id: LOCAL.into(),
        name: store
            .hostname
            .as_ref()
            .map_or_else(|| LOCAL.to_string(), |h| format!("local ({h})")),
        state: if store.connected {
            "connected"
        } else {
            "connecting"
        }
        .into(),
        error: None,
        detail: store.platform.clone(),
        address: None,
        direct: false,
        enabled: None,
    };
    let list: Vec<HostInfo> = std::iter::once(local)
        .chain(store.host_entries.iter().map(|h| {
            let info = store.host_states.get(&h.id);
            let address = format!("{}:{}", h.ssh_host, h.remote_port);
            HostInfo {
                id: h.id.clone(),
                name: h.name.clone(),
                state: info.map_or_else(
                    || if h.enabled { "connecting" } else { "disabled" }.to_string(),
                    |f| f.state.clone(),
                ),
                error: info.and_then(|f| f.error.clone()),
                detail: Some(if h.mode == "direct" {
                    format!("{} (direct)", h.ssh_host)
                } else {
                    non_empty(&h.direct_url).unwrap_or_else(|| address.clone())
                }),
                address: Some(h.direct_url.clone().unwrap_or(address)),
                direct: h.mode == "direct",
                enabled: Some(h.enabled),
            }
        }))
        .collect();
    // A host removed from Settings while shown stays the shown one until another is picked.
    let active = list
        .iter()
        .find(|h| h.id == active_id)
        .cloned()
        .unwrap_or_else(|| {
            let facts = store.host_states.get(active_id);
            HostInfo {
                id: active_id.into(),
                name: active_id.into(),
                state: facts.map_or("disabled", |f| f.state.as_str()).into(),
                error: facts.and_then(|f| f.error.clone()),
                detail: None,
                address: None,
                direct: false,
                enabled: None,
            }
        });
    let (cwd, branch) = store.status.clone().unzip();
    Hosts {
        active_id: active_id.into(),
        can_create: store.connected && (active_id == LOCAL || active.state == "connected"),
        workspaces: has(capabilities(store, active_id), SNAPSHOT_CAPABILITY),
        active,
        list,
        local: LocalHost {
            hostname: store.hostname.clone(),
            platform: store.platform.clone(),
            is_ssh: store.is_ssh,
            cwd,
            branch,
        },
        connected: store.connected,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn session(id: &str, host: &str, cwd: &str, created_at: i64) -> SessionSummary {
        serde_json::from_value(json!({
            "id": id, "title": id, "cwd": cwd, "createdAt": created_at, "status": "idle",
            "hostId": host, "cliProviderId": "claude",
        }))
        .unwrap()
    }

    #[test]
    fn session_folders_group_the_shown_computers_sessions_newest_first() {
        let store = Store {
            sessions: vec![
                session("s1", LOCAL, "/a", 1),
                session("s2", LOCAL, "/b", 3),
                session("s3", LOCAL, "/a", 2),
                session("r1", "remote", "/a", 9),
            ],
            projects: vec![serde_json::from_value(json!({
                "id": "p", "hostId": LOCAL, "name": "a", "path": "/a", "repoPath": "/a",
                "favorite": false, "createdAt": 0, "updatedAt": 0,
            }))
            .unwrap()],
            ..Store::default()
        };
        let folders = |view: &View| {
            session_folders(&store, view)
                .folders
                .into_iter()
                .map(|f| {
                    let ids: Vec<String> = f.sessions.into_iter().map(|s| s.id).collect();
                    (f.cwd, f.active, f.registered, ids)
                })
                .collect::<Vec<_>>()
        };
        // The folder with the newest session first, its newest session first; the newest is active.
        assert_eq!(
            folders(&View::default()),
            [
                ("/b".into(), true, false, vec!["s2".into()]),
                ("/a".into(), false, true, vec!["s3".into(), "s1".into()]),
            ]
        );
        // The shown session's folder is the active one.
        let shown = View {
            session_id: Some("s1".into()),
            ..View::default()
        };
        assert!(folders(&shown)[1].1, "the shown session's folder");
    }

    fn workspace(id: &str, path: &str) -> WorkspaceSummary {
        serde_json::from_value(json!({
            "id": id, "projectId": format!("p-{id}"), "hostId": LOCAL, "path": path, "name": id,
            "dirty": false, "state": "active", "createdAt": 0, "updatedAt": 0,
        }))
        .unwrap()
    }

    /// The vectors of the web's `terminalScope.test.ts`.
    #[test]
    fn a_terminal_is_scoped_only_once_its_shell_leaves_its_workspace_folder() {
        let store = Store {
            workspaces: vec![
                workspace("w-chats", "/home/u/.perch/scratch"),
                workspace("w-proj", "/work/proj"),
            ],
            ..Store::default()
        };
        let term = |workspace: &str, host: &str, cwd: Option<&str>| {
            let mut s = session("s1", host, "/x", 1);
            s.workspace_id = Some(workspace.into());
            s.current_cwd = cwd.map(str::to_string);
            s.current_branch = Some("main".into());
            terminal_scope_id(&store, &s)
        };
        assert_eq!(term("w-proj", LOCAL, Some("/work/proj")), None);
        assert!(term("w-proj", LOCAL, Some("/work/proj/src"))
            .is_some_and(|id| id.starts_with("term:s1:")));
        assert_eq!(term("w-chats", LOCAL, None), None);
        assert_eq!(term("w-chats", "box", Some("/home/u/café")), None);
        let id = term("w-chats", LOCAL, Some("/home/u/café")).unwrap();
        assert_eq!(id, "term:s1:L2hvbWUvdS9jYWbDqQ");

        // Its row: the folder, its terminal's branch while it is there, and still the folder
        // once the terminal has closed; filed under the terminal's workspace.
        let mut open = session("s1", LOCAL, "/x", 1);
        open.workspace_id = Some("w-chats".into());
        open.current_cwd = Some("/home/u/café".into());
        open.current_branch = Some("main".into());
        let live = Store {
            sessions: vec![open],
            ..store.clone()
        };
        let row = workspace_record(&live, &id).unwrap();
        assert_eq!(
            (
                row.path.as_str(),
                row.name.as_str(),
                row.branch.as_deref(),
                row.host_id.as_str()
            ),
            ("/home/u/café", "café", Some("main"), LOCAL)
        );
        assert_eq!(scope_workspace(&live, &id).as_deref(), Some("w-chats"));
        let closed = workspace_record(&store, &id).unwrap();
        assert_eq!(
            (closed.path.as_str(), closed.branch),
            ("/home/u/café", None)
        );
        assert_eq!(scope_workspace(&store, &id), None);
        assert!(workspace_record(&store, "term:s1:***").is_none());
        assert_eq!(
            workspace_record(&store, "w-proj").map(|w| w.id).as_deref(),
            Some("w-proj")
        );
        // A chosen folder, under its workspace.
        let dir = "dir:w-proj:L3RtcC9ub3Rlcw";
        let row = workspace_record(&store, dir).unwrap();
        assert_eq!(
            (
                row.path.as_str(),
                row.name.as_str(),
                row.project_id.as_str(),
                row.hidden
            ),
            ("/tmp/notes", "notes", "p-w-proj", true)
        );
        assert_eq!(scope_workspace(&store, dir).as_deref(), Some("w-proj"));
        assert!(workspace_record(&store, "dir:gone:L3RtcA").is_none());
    }

    /// The strip lists a workspace's sessions in the core's order and leaves a sub-session where
    /// that order puts it, as the web's strip does: a person's drag is not undone.
    #[test]
    fn a_workspace_strip_keeps_the_core_order_without_nesting() {
        let mut lead = session("lead", LOCAL, "/a", 1);
        let mut other = session("other", LOCAL, "/a", 2);
        let mut kid = session("kid", LOCAL, "/a", 3);
        let mut away = session("away", LOCAL, "/b", 4);
        for s in [&mut lead, &mut other, &mut kid] {
            s.workspace_id = Some("w".into());
        }
        away.workspace_id = Some("v".into());
        kid.parent_session_id = Some("lead".into());
        let mut store = Store {
            sessions: vec![lead, other, kid, away],
            ..Store::default()
        };
        assert_eq!(sessions_of_workspace(&store, "w"), ["lead", "other", "kid"]);
        store.order.insert(
            LOCAL.into(),
            (vec![], vec!["other".into(), "kid".into(), "lead".into()]),
        );
        assert_eq!(sessions_of_workspace(&store, "w"), ["other", "kid", "lead"]);
        assert_eq!(sessions_of_workspace(&store, "v"), ["away"]);
        assert!(sessions_of_workspace(&store, "none").is_empty());
    }
}

#[cfg(test)]
mod order_tests {
    use super::{move_beside, write_scope};

    fn ids(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn a_move_lands_beside_its_target_and_writes_only_its_group() {
        let group = ids(&["a", "b", "c"]);
        assert_eq!(move_beside(&group, "a", "c", true), ids(&["b", "c", "a"]));
        assert_eq!(move_beside(&group, "c", "a", false), ids(&["c", "a", "b"]));
        assert_eq!(
            move_beside(&group, "a", "gone", false),
            ids(&["b", "c", "a"])
        );
        // The core's order holds another group (x, y) between: its ids keep their places, and a
        // new id of the group goes after the group's last.
        let core = ids(&["a", "x", "b", "y"]);
        let scope = ids(&["b", "a", "c"]);
        assert_eq!(
            write_scope(&core, &scope, None),
            ids(&["b", "x", "a", "c", "y"])
        );
        assert_eq!(
            write_scope(&[], &scope, None),
            scope,
            "no order yet: the group's"
        );
    }
}

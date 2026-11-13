//! The web's navigation, from the same facts: `navigation.ts` (`useNavigation`, `useHosts`) and the
//! helpers it calls (`statusView.ts`, `sidebarOrder.ts`, `workspaceNav.ts`, `workspaceTabs.ts`,
//! `store/selectors.ts`), ported rule for rule so a native mod gets the same [`Navigation`] and
//! [`Hosts`] the web sidebar draws. The shapes serialise to `@perch/sdk`'s (`perch-sdk.d.ts`):
//! camelCase names, an absent optional field left out, `null` where the web says null.
//!
//! What this client does not have is empty, never guessed: no worktree jobs (`jobs` is `[]`), no
//! per-viewer tab drag order (a strip is the core's order over creation order), no remembered
//! harness per session, no workspace key hints (`shortcut` is never set).
//!
//! The view (which computer is shown, the session and workspace on screen, the sidebar's options)
//! is the caller's ([`View`]); the facts are the core's ([`Store`]).

use super::{dot, section, Attention, Dot, HostFacts, SnapshotState, LOCAL};
use perch_core::protocol::{
    AttentionEvent, ProjectSummary, SessionStatus, SessionSummary, SshHostEntry, WorkspaceState,
    WorkspaceSummary,
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
    pub needs_events: Vec<AttentionEvent>,
    /// The session the window told the core it shows.
    pub viewing: Option<String>,
    /// The chat kept in Done while it is read (`holdFinished`).
    pub held: Option<String>,
    /// `settings.theme`.
    pub theme: Option<String>,
    /// The agents each computer can start (`agent.manifest.list`), by host id.
    pub providers: HashMap<String, Vec<super::Provider>>,
    /// Per computer, `isDefault` of each agent whose manifest says.
    pub provider_defaults: HashMap<String, HashMap<String, bool>>,
    /// Per computer, an agent list asked for again or refused; absent once answered.
    pub agent_lists: HashMap<String, AgentList>,
    /// `programs.json` as the core checked it (`mods.state`), while there is one.
    pub programs: Option<serde_json::Value>,
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

/// Whether `session` belongs to `workspace`: by id, or for an older record by folder.
fn in_workspace(session: &SessionSummary, workspace: &WorkspaceSummary) -> bool {
    match &session.workspace_id {
        Some(id) => *id == workspace.id,
        None => session.host_id == workspace.host_id && session.cwd == workspace.path,
    }
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
        let mut mine: Vec<&SessionSummary> = self
            .store
            .sessions
            .iter()
            .filter(|s| in_workspace(s, workspace))
            .collect();
        mine.sort_by_key(|s| s.created_at);
        let order = self.session_order(&workspace.host_id);
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
            jobs: Vec::new(),
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
        let quickchat = chats.map(|p| self.project_info(p));
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

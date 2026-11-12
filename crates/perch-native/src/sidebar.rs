//! What the sidebar shows, reduced from the core's messages. No GPUI and no I/O: messages go
//! into [`State`], [`State::model`] comes out.
//!
//! The core owns every fact: which sessions exist, their order (`workspace.order`), their
//! state (`session.*`, `attention.snapshot`) and whether a remote computer is reachable
//! (`host.info`). Nothing here guesses. When the core cannot be reached, or a computer is not
//! connected, a session keeps its row but claims no state ([`SessionView::attention`] is
//! `None`): last-known state is never shown as current, and nothing is ever marked exited.
//!
//! The rules mirror the web client's `attention.ts`, `statusView.ts` and `sidebarOrder.ts`.

use perch_core::agent_fleet::TERMINAL_PROVIDER;
use perch_core::protocol::{
    AttentionEvent, ProjectSummary, ServerMessage, SessionStatus, SessionSummary,
};
use std::collections::{HashMap, HashSet};

/// The host id of the computer the core runs on.
pub const LOCAL: &str = "local";
/// Capability under which the core sends `attention.snapshot`.
const ATTENTION_CAPABILITY: &str = "attention.v1";

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
}

/// Something the client asks the core for because of what it just read.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Request {
    Attention,
    Projects(String),
    Providers(String),
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
    /// The provider's id as the core knows it, which attaching a terminal must name again.
    pub provider_id: Option<String>,
    /// `None` when the core or the computer cannot be reached.
    pub attention: Option<Attention>,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct ProjectView {
    pub id: String,
    pub name: String,
    /// Folder on the project's computer; empty for a group of sessions the core lists no project for.
    pub path: String,
    /// Chats: sessions started with no project, all listed.
    pub quickchat: bool,
    pub sessions: Vec<SessionView>,
    /// The most urgent state among the sessions, `None` when it cannot be stated.
    pub top: Option<Attention>,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct HostView {
    pub id: String,
    pub name: String,
    /// `connected`, `connecting`, `error`, `disabled`, or `unknown` while the core is unreachable.
    pub state: String,
    pub reachable: bool,
    pub projects: Vec<ProjectView>,
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
    pub hosts: Vec<HostView>,
}

#[derive(Default)]
pub struct State {
    connected: bool,
    offline_reason: Option<String>,
    /// Set by whoever connects: the address of the core being followed.
    pub core_url: Option<String>,
    /// List plain terminals started inside a project (Show terminals).
    pub show_terminals: bool,
    hosts: Vec<(String, String)>,
    host_states: HashMap<String, String>,
    projects: Vec<ProjectSummary>,
    sessions: Vec<SessionSummary>,
    /// Per computer, the core's order of project ids and session ids.
    order: HashMap<String, (Vec<String>, Vec<String>)>,
    needs: HashSet<String>,
    providers: HashMap<String, Vec<Provider>>,
}

impl State {
    /// The socket is up. What the core sends next replaces what is shown, so nothing from
    /// before the drop outlives its first answer.
    pub fn connect(&mut self) {
        self.connected = true;
        self.offline_reason = None;
        self.host_states.clear();
    }

    /// The socket is gone, or never came up (`reason`). Rows stay, with no state claimed.
    pub fn disconnect(&mut self, reason: Option<String>) {
        self.connected = false;
        self.offline_reason = reason;
        self.core_url = None;
    }

    /// Fold one message from the core in. Returns what to ask for next.
    pub fn apply(&mut self, message: &ServerMessage) -> Vec<Request> {
        match message {
            ServerMessage::ServerInfo { capabilities, .. } => {
                // An older core sends no attention events: only the sessions' own flags speak.
                self.needs.clear();
                if capabilities.iter().any(|c| c == ATTENTION_CAPABILITY) {
                    return vec![Request::Attention];
                }
            }
            ServerMessage::SessionList { sessions } => self.sessions = sessions.clone(),
            ServerMessage::SessionUpdated { session } => {
                match self.sessions.iter_mut().find(|s| s.id == session.id) {
                    Some(known) => *known = session.clone(),
                    None => self.sessions.insert(0, session.clone()),
                }
            }
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
            ServerMessage::WorkspaceOrder {
                host_id,
                projects,
                sessions,
                ..
            } => {
                self.order
                    .insert(host_id.clone(), (projects.clone(), sessions.clone()));
            }
            ServerMessage::AttentionSnapshot { events } => self.needs = needing(events),
            ServerMessage::HostsList { hosts } | ServerMessage::HostsUpdated { hosts } => {
                self.hosts = hosts
                    .iter()
                    .map(|h| (h.id.clone(), h.name.clone()))
                    .collect();
            }
            ServerMessage::HostInfo { host_id, state, .. } => {
                let was = self.host_states.insert(host_id.clone(), state.clone());
                if state == "connected" && was.as_deref() != Some("connected") {
                    return vec![
                        Request::Projects(host_id.clone()),
                        Request::Providers(host_id.clone()),
                    ];
                }
            }
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
            _ => {}
        }
        Vec::new()
    }

    fn reachable(&self, host_id: &str) -> bool {
        self.connected
            && (host_id == LOCAL
                || self.host_states.get(host_id).map(String::as_str) == Some("connected"))
    }

    pub fn model(&self) -> Model {
        let mut hosts = vec![(LOCAL.to_string(), "This computer".to_string())];
        hosts.extend(self.hosts.iter().filter(|(id, _)| id != LOCAL).cloned());
        let hosts: Vec<HostView> = hosts
            .into_iter()
            .map(|(id, name)| self.host_view(id, name))
            .collect();
        // Every session on a reachable computer counts, whether or not its row is listed.
        let needs_you = self
            .sessions
            .iter()
            .filter(|s| self.reachable(&s.host_id))
            .filter(|s| self.attention_of(s) == Attention::NeedsYou)
            .count();
        Model {
            connected: self.connected,
            offline_reason: self.offline_reason.clone(),
            core_url: self.core_url.clone(),
            needs_you,
            hosts,
        }
    }

    fn host_view(&self, id: String, name: String) -> HostView {
        let reachable = self.reachable(&id);
        let state = if !self.connected {
            "unknown".to_string()
        } else if id == LOCAL {
            "connected".to_string()
        } else {
            self.host_states
                .get(&id)
                .cloned()
                .unwrap_or_else(|| "unknown".into())
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
        let mut sessions = order_by(
            self.sessions
                .iter()
                .filter(|s| s.host_id == id)
                .collect::<Vec<_>>(),
            session_order,
            |s| &s.id,
        );
        let mut views: Vec<ProjectView> = projects
            .iter()
            .map(|p| ProjectView {
                id: p.id.clone(),
                name: if is_chats(p) {
                    "Quickchat".into()
                } else {
                    p.name.clone()
                },
                path: p.path.clone(),
                quickchat: is_chats(p),
                ..Default::default()
            })
            .collect();
        let mut other = ProjectView {
            name: "Other".into(),
            ..Default::default()
        };
        for session in sessions.drain(..) {
            let at = views
                .iter()
                .position(|v| Some(v.id.as_str()) == session.project_id.as_deref());
            let target = at.map_or(&mut other, |at| &mut views[at]);
            if target.quickchat || self.show_terminals || listed(session) {
                target.sessions.push(self.session_view(session, reachable));
            }
        }
        if !other.sessions.is_empty() {
            views.push(other);
        }
        for view in &mut views {
            view.top = view
                .sessions
                .iter()
                .filter_map(|s| s.attention)
                .min_by_key(|a| *a as u8);
        }
        let mut providers = vec![Provider {
            id: TERMINAL_PROVIDER.into(),
            name: "Terminal".into(),
        }];
        providers.extend(self.providers.get(&id).cloned().unwrap_or_default());
        HostView {
            id,
            name,
            state,
            reachable,
            projects: views,
            providers,
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
        SessionView {
            id: session.id.clone(),
            host_id: session.host_id.clone(),
            title: title(session),
            provider: name,
            provider_id: id.map(str::to_string),
            attention: reachable.then(|| self.attention_of(session)),
        }
    }

    /// `statusView.sectionOf`: a blocked or question-asking agent needs you, a running one is
    /// working, a finished one nobody has looked at is done. Stale means busy but silent for
    /// 30 minutes: read as idle.
    fn attention_of(&self, session: &SessionSummary) -> Attention {
        if (session.blocked && !session.stale) || self.needs.contains(&session.id) {
            Attention::NeedsYou
        } else if session.status == SessionStatus::Running && !session.stale {
            Attention::Working
        } else if session.unseen {
            Attention::Done
        } else {
            Attention::Idle
        }
    }
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
        // Not reported yet: unknown.
        assert_eq!(state.model().hosts[1].state, "unknown");

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
}

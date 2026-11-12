//! The sidebar's key actions, by the ids the web client binds them under (`keybinds.ts`), and what
//! each one does to the view. No GPUI: [`Nav`] is the view's own state and [`Nav::run`] a handler
//! per action, so a keybinding dispatcher or a command palette can bind [`ACTIONS`] later and the
//! handlers are already tested. Nothing here reads a key.
//!
//! The ids are the web's, so a person's `settings.keybindings` (kept by the core, and in
//! [`Model::keybindings`]) means the same thing in both clients.

use crate::client::Command;
use crate::sidebar::{step_needing, HostView, Model, ProjectView, LOCAL};
use std::collections::HashSet;

/// A named thing the sidebar can do, and the keys the web binds to it by default.
pub struct Action {
    pub id: &'static str,
    pub description: &'static str,
    /// Defaults for macOS, then for other systems; one entry is both and `""` is none there.
    /// `mod` is Command on macOS and Control+Shift elsewhere.
    pub keys: &'static [&'static str],
}

const fn action(
    id: &'static str,
    description: &'static str,
    keys: &'static [&'static str],
) -> Action {
    Action {
        id,
        description,
        keys,
    }
}

pub const ACTIONS: [Action; 17] = [
    action("global.sidebar", "Toggle sidebar", &["mod+b"]),
    action(
        "global.needsYou",
        "Show the sidebar and open the next chat that needs you",
        &["cmd+shift+u", "alt+shift+u"],
    ),
    // The web has no key for going back; the action exists for a palette and for rebinding.
    action(
        "global.needsYouPrev",
        "Show the sidebar and open the previous chat that needs you",
        &[],
    ),
    action(
        "sessions.new",
        "New session: pick a computer, a project, then an agent or terminal",
        &["cmd+shift+t", "alt+shift+t"],
    ),
    action("nests.scratchpad", "New quickchat", &["cmd+shift+n", ""]),
    action(
        "nests.prev",
        "Previous workspace",
        &["ctrl+shift+up", "alt+shift+up"],
    ),
    action(
        "nests.next",
        "Next workspace",
        &["ctrl+shift+down", "alt+shift+down"],
    ),
    action(
        "nests.jump1",
        "Jump to workspace 1",
        &["ctrl+shift+1", "alt+shift+1"],
    ),
    action(
        "nests.jump2",
        "Jump to workspace 2",
        &["ctrl+shift+2", "alt+shift+2"],
    ),
    action(
        "nests.jump3",
        "Jump to workspace 3",
        &["ctrl+shift+3", "alt+shift+3"],
    ),
    action(
        "nests.jump4",
        "Jump to workspace 4",
        &["ctrl+shift+4", "alt+shift+4"],
    ),
    action(
        "nests.jump5",
        "Jump to workspace 5",
        &["ctrl+shift+5", "alt+shift+5"],
    ),
    action(
        "nests.jump6",
        "Jump to workspace 6",
        &["ctrl+shift+6", "alt+shift+6"],
    ),
    action(
        "nests.jump7",
        "Jump to workspace 7",
        &["ctrl+shift+7", "alt+shift+7"],
    ),
    action(
        "nests.jump8",
        "Jump to workspace 8",
        &["ctrl+shift+8", "alt+shift+8"],
    ),
    action(
        "nests.jump9",
        "Jump to workspace 9",
        &["ctrl+shift+9", "alt+shift+9"],
    ),
    action(
        "sidebar.organize",
        "Switch the sidebar between By project and By status",
        &[],
    ),
];

/// How the sidebar lists work: the tree of projects, or sections by state.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Organize {
    #[default]
    Project,
    Status,
}

/// The New session panel: which computer and project it will start in.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NewSession {
    pub host_id: String,
    pub project_id: Option<String>,
}

impl NewSession {
    /// The first place on `host_id` that can start a session: a project before Quickchat.
    pub fn on_host(model: &Model, host_id: &str) -> Self {
        let project = model
            .hosts
            .iter()
            .find(|h| h.id == host_id)
            .and_then(|host| {
                let mut places = host.projects.iter().filter(|p| startable(host, p));
                places
                    .clone()
                    .find(|p| !p.quickchat)
                    .or_else(|| places.next())
            });
        Self {
            host_id: host_id.to_string(),
            project_id: project.map(|p| p.id.clone()),
        }
    }
}

/// What an action asks the window to do beyond changing the view.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Outcome {
    Nothing,
    /// Show this session.
    Open {
        host_id: String,
        session_id: String,
    },
}

/// The sidebar's view state: what is picked, shown or folded. The core's facts live in the
/// [`Model`]; this is only what the person chose to look at.
pub struct Nav {
    /// The session shown, with its computer.
    pub selected: Option<(String, String)>,
    /// A checkout picked with no session in it to show.
    pub workspace: Option<String>,
    pub sidebar_visible: bool,
    pub organize: Organize,
    /// Folded projects, as `host/project`.
    pub collapsed: HashSet<String>,
    pub new_session: Option<NewSession>,
}

impl Default for Nav {
    fn default() -> Self {
        Self {
            selected: None,
            workspace: None,
            sidebar_visible: true,
            organize: Organize::default(),
            collapsed: HashSet::new(),
            new_session: None,
        }
    }
}

/// One stop of the workspace keys: a checkout, or a project that shows none of its own.
struct Stop {
    id: String,
    sessions: Vec<(String, String)>,
}

/// Whether a session can start in this project of this computer: it must be reachable, and the
/// project must have a folder (the catch-all group has none) or be Quickchat.
pub fn startable(host: &HostView, project: &ProjectView) -> bool {
    host.reachable && (project.quickchat || !project.path.is_empty())
}

impl Nav {
    pub fn project_key(host_id: &str, project_id: &str) -> String {
        format!("{host_id}/{project_id}")
    }

    /// Fold or unfold a project.
    pub fn toggle_project(&mut self, host_id: &str, project_id: &str) {
        let key = Self::project_key(host_id, project_id);
        if !self.collapsed.remove(&key) {
            self.collapsed.insert(key);
        }
    }

    /// Run the action called `id`. `None`: this is not one of the sidebar's actions.
    pub fn run(&mut self, id: &str, model: &Model) -> Option<Outcome> {
        let outcome = match id {
            "global.sidebar" => {
                self.sidebar_visible = !self.sidebar_visible;
                Outcome::Nothing
            }
            "global.needsYou" => self.jump_needing(model, 1),
            "global.needsYouPrev" => self.jump_needing(model, -1),
            "sessions.new" => {
                self.sidebar_visible = true;
                self.new_session = Some(self.new_session_target(model, false));
                Outcome::Nothing
            }
            "nests.scratchpad" => {
                self.sidebar_visible = true;
                self.new_session = Some(self.new_session_target(model, true));
                Outcome::Nothing
            }
            "nests.prev" => self.step_workspace(model, -1),
            "nests.next" => self.step_workspace(model, 1),
            "sidebar.organize" => {
                self.organize = match self.organize {
                    Organize::Project => Organize::Status,
                    Organize::Status => Organize::Project,
                };
                Outcome::Nothing
            }
            jump => {
                let n = jump.strip_prefix("nests.jump")?.parse::<usize>().ok()?;
                self.jump_workspace(model, n)
            }
        };
        Some(outcome)
    }

    /// Show the sidebar and open the next (or previous) session that needs you.
    fn jump_needing(&mut self, model: &Model, step: i32) -> Outcome {
        self.sidebar_visible = true;
        let current = self.selected.as_ref().map(|(_, id)| id.as_str());
        let Some(next) = step_needing(&model.needing, current, step) else {
            return Outcome::Nothing;
        };
        match host_of(model, &next) {
            Some(host_id) => Outcome::Open {
                host_id,
                session_id: next,
            },
            None => Outcome::Nothing,
        }
    }

    /// The workspace stops of the shown computer, in the sidebar's order: each project's checkouts
    /// (or the project itself when it shows none), Quickchat among them where it is listed.
    fn stops(&self, model: &Model) -> Vec<Stop> {
        let host_id = self
            .selected
            .as_ref()
            .map_or(LOCAL, |(host, _)| host.as_str());
        let Some(host) = model.hosts.iter().find(|h| h.id == host_id) else {
            return Vec::new();
        };
        let rows = |sessions: &[crate::sidebar::SessionView]| -> Vec<(String, String)> {
            sessions
                .iter()
                .map(|s| (s.host_id.clone(), s.id.clone()))
                .collect()
        };
        host.projects
            .iter()
            // The catch-all group is not a place.
            .filter(|p| !p.id.is_empty())
            .flat_map(|p| {
                if p.workspaces.is_empty() {
                    vec![Stop {
                        id: p.id.clone(),
                        sessions: rows(&p.sessions),
                    }]
                } else {
                    let mut stops: Vec<Stop> = p
                        .workspaces
                        .iter()
                        .map(|w| Stop {
                            id: w.id.clone(),
                            sessions: rows(&w.sessions),
                        })
                        .collect();
                    // Chats no checkout owns belong with the first.
                    stops[0].sessions.extend(rows(&p.sessions));
                    stops
                }
            })
            .collect()
    }

    fn go_to(&mut self, stop: &Stop) -> Outcome {
        self.workspace = Some(stop.id.clone());
        match stop.sessions.first() {
            Some((host_id, session_id)) => Outcome::Open {
                host_id: host_id.clone(),
                session_id: session_id.clone(),
            },
            None => Outcome::Nothing,
        }
    }

    /// A checkout picked in the tree: it becomes the current one, and its first session opens.
    pub fn pick_workspace(&mut self, model: &Model, id: &str) -> Outcome {
        match self.stops(model).iter().find(|s| s.id == id) {
            Some(stop) => {
                let stop = Stop {
                    id: stop.id.clone(),
                    sessions: stop.sessions.clone(),
                };
                self.go_to(&stop)
            }
            None => Outcome::Nothing,
        }
    }

    /// Previous or next workspace, wrapping.
    fn step_workspace(&mut self, model: &Model, step: i32) -> Outcome {
        let stops = self.stops(model);
        if stops.len() < 2 {
            return Outcome::Nothing;
        }
        let here = stops.iter().position(|s| {
            self.selected
                .as_ref()
                .is_some_and(|(_, id)| s.sessions.iter().any(|(_, other)| other == id))
                || self.workspace.as_deref() == Some(s.id.as_str())
        });
        let len = stops.len() as i32;
        let to = match (here, step > 0) {
            (Some(at), true) => (at as i32 + 1) % len,
            (Some(at), false) => (at as i32 - 1 + len) % len,
            (None, true) => 0,
            (None, false) => len - 1,
        };
        self.go_to(&stops[to as usize])
    }

    /// The Nth (1-indexed) workspace. Nothing out of range.
    fn jump_workspace(&mut self, model: &Model, n: usize) -> Outcome {
        let stops = self.stops(model);
        match n.checked_sub(1).and_then(|at| stops.get(at)) {
            Some(stop) => self.go_to(stop),
            None => Outcome::Nothing,
        }
    }

    /// Where a new session starts unless the person says otherwise: the computer and project of
    /// what they are looking at, else the first place that can start one. With `quickchat`, that
    /// computer's Quickchat.
    pub fn new_session_target(&self, model: &Model, quickchat: bool) -> NewSession {
        let open = self
            .selected
            .as_ref()
            .and_then(|(host_id, session_id)| {
                let host = model.hosts.iter().find(|h| h.id == *host_id)?;
                let project = host.projects.iter().find(|p| {
                    p.sessions
                        .iter()
                        .chain(p.workspaces.iter().flat_map(|w| &w.sessions))
                        .any(|s| s.id == *session_id)
                })?;
                Some((host, project))
            })
            .filter(|(host, _)| host.reachable);
        let host = open
            .map(|(host, _)| host)
            .or_else(|| model.hosts.iter().find(|h| h.id == LOCAL && h.reachable))
            .or_else(|| model.hosts.iter().find(|h| h.reachable))
            .or_else(|| model.hosts.first());
        let Some(host) = host else {
            return NewSession {
                host_id: LOCAL.into(),
                project_id: None,
            };
        };
        let places = host.projects.iter().filter(|p| startable(host, p));
        let project = if quickchat {
            places.clone().find(|p| p.quickchat)
        } else {
            open.map(|(_, p)| p)
                .filter(|p| startable(host, p))
                .or_else(|| places.clone().find(|p| !p.quickchat))
                .or_else(|| places.clone().next())
        };
        NewSession {
            host_id: host.id.clone(),
            project_id: project.map(|p| p.id.clone()),
        }
    }
}

/// The computer a session of the model is on.
fn host_of(model: &Model, session_id: &str) -> Option<String> {
    model
        .hosts
        .iter()
        .find(|h| {
            h.projects.iter().any(|p| {
                p.sessions
                    .iter()
                    .chain(p.workspaces.iter().flat_map(|w| &w.sessions))
                    .any(|s| s.id == session_id)
            })
        })
        .map(|h| h.id.clone())
}

/// The command that starts `provider` where the New session panel points, or `None` when that is
/// nowhere a session can start (no project picked, or the computer cannot be reached).
pub fn launch_command(model: &Model, target: &NewSession, provider: &str) -> Option<Command> {
    let host = model.hosts.iter().find(|h| h.id == target.host_id)?;
    let project = host
        .projects
        .iter()
        .find(|p| Some(&p.id) == target.project_id.as_ref())?;
    if !startable(host, project) || !host.providers.iter().any(|p| p.id == provider) {
        return None;
    }
    Some(Command::Launch {
        host_id: host.id.clone(),
        // Quickchat starts in the core's own scratch folder, which the core chooses.
        cwd: (!project.quickchat).then(|| project.path.clone()),
        provider: provider.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sidebar::{Provider, SessionView, WorkspaceView};

    fn session(id: &str) -> SessionView {
        SessionView {
            id: id.into(),
            host_id: LOCAL.into(),
            title: id.into(),
            ..Default::default()
        }
    }

    fn project(id: &str, sessions: &[&str]) -> ProjectView {
        ProjectView {
            id: id.into(),
            name: id.into(),
            path: format!("/{id}"),
            sessions: sessions.iter().map(|s| session(s)).collect(),
            ..Default::default()
        }
    }

    fn host(projects: Vec<ProjectView>) -> HostView {
        HostView {
            id: LOCAL.into(),
            reachable: true,
            projects,
            providers: vec![Provider {
                id: "terminal".into(),
                name: "Terminal".into(),
            }],
            ..Default::default()
        }
    }

    fn model(projects: Vec<ProjectView>, needing: &[&str]) -> Model {
        Model {
            connected: true,
            needing: needing.iter().map(|s| s.to_string()).collect(),
            hosts: vec![host(projects)],
            ..Default::default()
        }
    }

    fn open(session: &str) -> Option<Outcome> {
        Some(Outcome::Open {
            host_id: LOCAL.into(),
            session_id: session.into(),
        })
    }

    #[test]
    fn the_table_uses_the_web_ids_and_keys() {
        let by_id = |id: &str| ACTIONS.iter().find(|a| a.id == id).unwrap();
        assert_eq!(by_id("global.sidebar").keys, ["mod+b"]);
        assert_eq!(
            by_id("global.needsYou").keys,
            ["cmd+shift+u", "alt+shift+u"]
        );
        let mut ids: Vec<_> = ACTIONS.iter().map(|a| a.id).collect();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), ACTIONS.len(), "an id is listed once");
        // Every action has a handler, and an id that is not ours is declined.
        let model = model(vec![project("a", &["s1"])], &[]);
        for action in &ACTIONS {
            assert!(
                Nav::default().run(action.id, &model).is_some(),
                "{} has no handler",
                action.id
            );
        }
        assert_eq!(Nav::default().run("tabs.new", &model), None);
        assert_eq!(Nav::default().run("nests.jumpx", &model), None);
    }

    #[test]
    fn the_sidebar_toggles_and_organize_switches() {
        let model = model(vec![], &[]);
        let mut nav = Nav::default();
        assert!(nav.sidebar_visible);
        nav.run("global.sidebar", &model);
        assert!(!nav.sidebar_visible);
        nav.run("global.sidebar", &model);
        assert!(nav.sidebar_visible);
        nav.run("sidebar.organize", &model);
        assert_eq!(nav.organize, Organize::Status);
        nav.run("sidebar.organize", &model);
        assert_eq!(nav.organize, Organize::Project);
    }

    #[test]
    fn needs_you_shows_the_sidebar_and_opens_the_next_chat() {
        let model = model(
            vec![project("a", &["x", "y", "z"]), project("b", &["w"])],
            &["y", "w"],
        );
        let mut nav = Nav {
            sidebar_visible: false,
            ..Nav::default()
        };
        assert_eq!(nav.run("global.needsYou", &model), open("y"));
        assert!(nav.sidebar_visible, "it shows the sidebar first");
        nav.selected = Some((LOCAL.into(), "y".into()));
        assert_eq!(nav.run("global.needsYou", &model), open("w"));
        nav.selected = Some((LOCAL.into(), "w".into()));
        assert_eq!(nav.run("global.needsYou", &model), open("y"), "wraps");
        assert_eq!(nav.run("global.needsYouPrev", &model), open("y"));
        nav.selected = Some((LOCAL.into(), "y".into()));
        assert_eq!(nav.run("global.needsYouPrev", &model), open("w"));

        // With none, it only shows the sidebar.
        let mut nav = Nav {
            sidebar_visible: false,
            ..Nav::default()
        };
        assert_eq!(
            nav.run("global.needsYou", &self::model(vec![], &[])),
            Some(Outcome::Nothing)
        );
        assert!(nav.sidebar_visible);
    }

    #[test]
    fn workspace_keys_step_and_jump_in_the_sidebars_order() {
        let mut with_checkouts = project("b", &["orphan"]);
        with_checkouts.workspaces = vec![
            WorkspaceView {
                id: "b1".into(),
                sessions: vec![session("s3")],
                ..Default::default()
            },
            WorkspaceView {
                id: "b2".into(),
                ..Default::default()
            },
        ];
        let model = model(
            vec![
                project("a", &["s1", "s2"]),
                with_checkouts,
                // The catch-all group is not a place.
                project("", &["lost"]),
            ],
            &[],
        );
        let mut nav = Nav::default();
        assert_eq!(
            nav.run("nests.next", &model),
            open("s1"),
            "none picked: the first"
        );
        assert_eq!(nav.workspace.as_deref(), Some("a"));
        nav.selected = Some((LOCAL.into(), "s1".into()));
        assert_eq!(nav.run("nests.next", &model), open("s3"));
        nav.selected = Some((LOCAL.into(), "s3".into()));
        // b2 has no session: the key still lands there.
        assert_eq!(nav.run("nests.next", &model), Some(Outcome::Nothing));
        assert_eq!(nav.workspace.as_deref(), Some("b2"));
        nav.selected = None;
        assert_eq!(
            nav.run("nests.next", &model),
            open("s1"),
            "b2 is current, so it wraps to a"
        );
        nav.workspace = Some("b2".into());
        assert_eq!(nav.run("nests.next", &model), open("s1"));
        nav.workspace = Some("a".into());
        assert_eq!(
            nav.run("nests.prev", &model),
            Some(Outcome::Nothing),
            "back to b2"
        );
        assert_eq!(nav.workspace.as_deref(), Some("b2"));
        nav.workspace = None;
        assert_eq!(
            nav.run("nests.prev", &model),
            Some(Outcome::Nothing),
            "none picked: the last"
        );
        assert_eq!(nav.workspace.as_deref(), Some("b2"));

        assert_eq!(nav.run("nests.jump2", &model), open("s3"));
        assert_eq!(
            nav.run("nests.jump9", &model),
            Some(Outcome::Nothing),
            "out of range"
        );
        assert_eq!(nav.run("nests.jump1", &model), open("s1"));

        // One place only: nowhere to step to.
        let single = self::model(vec![project("a", &["s1"])], &[]);
        assert_eq!(
            Nav::default().run("nests.next", &single),
            Some(Outcome::Nothing)
        );
    }

    #[test]
    fn new_session_starts_where_the_person_is_looking() {
        let mut quick = project("q", &[]);
        quick.quickchat = true;
        quick.path = String::new();
        let mut elsewhere = host(vec![project("r", &["far"])]);
        elsewhere.id = "box".into();
        let mut model = model(
            vec![project("a", &["s1"]), project("b", &["s2"]), quick],
            &[],
        );
        model.hosts.push(elsewhere);
        let mut nav = Nav::default();

        let target = |nav: &mut Nav, id: &str, model: &Model| {
            nav.new_session = None;
            nav.run(id, model);
            nav.new_session.clone().unwrap()
        };
        // Nothing open: this computer's first project.
        assert_eq!(
            target(&mut nav, "sessions.new", &model),
            NewSession {
                host_id: LOCAL.into(),
                project_id: Some("a".into())
            }
        );
        // Looking at a chat of project b: there.
        nav.selected = Some((LOCAL.into(), "s2".into()));
        assert_eq!(
            target(&mut nav, "sessions.new", &model)
                .project_id
                .as_deref(),
            Some("b")
        );
        // On another computer: that one, while it can be reached.
        nav.selected = Some(("box".into(), "far".into()));
        model.hosts[1].projects[0].sessions[0].host_id = "box".into();
        assert_eq!(
            target(&mut nav, "sessions.new", &model),
            NewSession {
                host_id: "box".into(),
                project_id: Some("r".into())
            }
        );
        model.hosts[1].reachable = false;
        assert_eq!(target(&mut nav, "sessions.new", &model).host_id, LOCAL);
        // Quickchat: that computer's, which has no folder of its own.
        nav.selected = Some((LOCAL.into(), "s1".into()));
        let chat = target(&mut nav, "nests.scratchpad", &model);
        assert_eq!(chat.project_id.as_deref(), Some("q"));
        assert!(nav.sidebar_visible);

        // The panel's choice becomes the launch; Quickchat has no cwd, a project has its folder.
        let launch = |target: &NewSession, provider: &str| launch_command(&model, target, provider);
        assert!(matches!(
            launch(&chat, "terminal"),
            Some(Command::Launch { host_id, cwd: None, provider }) if host_id == LOCAL && provider == "terminal"
        ));
        let in_a = NewSession {
            host_id: LOCAL.into(),
            project_id: Some("a".into()),
        };
        assert!(matches!(
            launch(&in_a, "terminal"),
            Some(Command::Launch { cwd: Some(cwd), .. }) if cwd == "/a"
        ));
        // Not an agent the computer lists, no project picked, or a computer out of reach: nothing.
        assert!(launch(&in_a, "claude").is_none());
        assert!(launch(
            &NewSession {
                host_id: LOCAL.into(),
                project_id: None
            },
            "terminal"
        )
        .is_none());
        let gone = NewSession {
            host_id: "box".into(),
            project_id: Some("r".into()),
        };
        assert!(launch(&gone, "terminal").is_none());
    }

    #[test]
    fn folding_a_project_is_per_computer() {
        let mut nav = Nav::default();
        nav.toggle_project("local", "a");
        assert!(nav.collapsed.contains("local/a"));
        assert!(!nav.collapsed.contains("box/a"));
        nav.toggle_project("local", "a");
        assert!(nav.collapsed.is_empty());
    }
}

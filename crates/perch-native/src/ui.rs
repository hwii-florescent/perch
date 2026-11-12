//! The window: a [`Sidebar`] of computers, projects and sessions beside the main area.
//!
//! The sidebar only draws the [`Model`] the core's messages reduce to (`sidebar.rs`) and says
//! what the person did: it emits [`OpenSession`] when a row is picked and sends a
//! [`Command`] when a session is started. What the person has chosen to look at (the picked
//! session, folded projects, By status) is the [`Nav`] of `actions.rs`, and every key action
//! runs through [`Sidebar::run_action`]. The main area names the open session above its
//! terminal ([`TerminalView`]); without a core to attach to it is that name alone.

use crate::actions::{launch_command, startable, Nav, NewSession, Organize, Outcome};
use crate::client::{Command, Update};
use crate::sidebar::{
    Attention, HostView, Model, ProjectView, SessionView, StatusCluster, StatusSection,
    WorkspaceView,
};
use futures::channel::mpsc::UnboundedSender;
use gpui::{div, prelude::*, px, rgb, Context, EventEmitter, IntoElement, Subscription, Window};

pub use crate::workspace::Workspace;

/// Sidebar text: a session title is bright, a project name and a hint dim. The render test
/// counts the bright pixels, so nothing else in the window may be this bright.
pub const TITLE_COLOR: u32 = 0xeeeeee;
pub(crate) const DIM_COLOR: u32 = 0x8a8a90;
pub(crate) const SIDEBAR_BG: u32 = 0x1c1c1f;
pub(crate) const MAIN_BG: u32 = 0x131315;
pub(crate) const SELECTED_BG: u32 = 0x2a2a30;
pub const SIDEBAR_WIDTH: f32 = 240.;

/// A state's dot, and the quiet fill behind its label.
pub fn tint(attention: Attention) -> (u32, u32) {
    match attention {
        Attention::NeedsYou => (0xe5484d, 0x40242a),
        Attention::Done => (0x2ec4b6, 0x1c3a3a),
        Attention::Working => (0xf5c542, 0x3a3420),
        Attention::Idle => (0x4caf6a, SIDEBAR_BG),
    }
}

/// A computer's connection dot (the web's `HostStateDot`).
pub fn host_dot(state: &str) -> u32 {
    match state {
        "connected" => 0x4caf6a,
        "connecting" => 0xf5c542,
        "error" => 0xe5484d,
        _ => DIM_COLOR,
    }
}

/// A session was picked; the main area shows it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OpenSession {
    pub host_id: String,
    pub session_id: String,
    pub title: String,
    /// The provider the session runs, which a terminal attaching to it must name again. Known from
    /// the row, or from the launch for a session the core does not list yet.
    pub provider_id: Option<String>,
    /// The core's address, while connected.
    pub core_url: Option<String>,
}

pub struct Sidebar {
    model: Model,
    nav: Nav,
    show_terminals: bool,
    notice: Option<String>,
    /// Where launches and toggles go; without it the sidebar is read-only.
    commands: Option<UnboundedSender<Command>>,
    /// Tells the core whether this window is the one being looked at.
    activation: Option<Subscription>,
    /// The session the last launch made, which the window opens as a tab or a split.
    launched: Option<String>,
}

impl EventEmitter<OpenSession> for Sidebar {}

/// A launch the person asked for did not produce a session.
pub struct LaunchFailed;

impl EventEmitter<LaunchFailed> for Sidebar {}

impl Sidebar {
    pub fn new(model: Model, commands: Option<UnboundedSender<Command>>) -> Self {
        Self {
            model,
            nav: Nav::default(),
            show_terminals: false,
            notice: None,
            commands,
            activation: None,
            launched: None,
        }
    }

    /// Take what the follower learned.
    pub fn apply(&mut self, update: Update, cx: &mut Context<Self>) {
        match update {
            Update::Model(model) => self.model = model,
            Update::Launched {
                host_id,
                session_id,
                provider,
            } => {
                self.launched = Some(session_id.clone());
                self.open(host_id, session_id, Some(provider), cx);
            }
            Update::LaunchFailed(error) => {
                self.notice = Some(error);
                cx.emit(LaunchFailed);
            }
            Update::Requested { host_id } => {
                let name = self
                    .model
                    .hosts
                    .iter()
                    .find(|h| h.id == host_id)
                    .map_or(host_id, |h| h.name.clone());
                self.notice = Some(format!(
                    "Asked {name} to start a session. It is listed once it has activity."
                ));
            }
            // Heard, not seen: the app plays it.
            Update::Alert(_) => {}
        }
        cx.notify();
    }

    /// Whether the sidebar is shown (`global.sidebar`).
    pub fn visible(&self) -> bool {
        self.nav.sidebar_visible
    }

    /// How many sessions need you, for the control that shows a hidden sidebar.
    pub fn needs_you(&self) -> usize {
        self.model.needs_you
    }

    /// Run a key action by its id (see `actions::ACTIONS`). False when it is not one of ours.
    pub fn run_action(&mut self, id: &str, cx: &mut Context<Self>) -> bool {
        match self.nav.run(id, &self.model) {
            None => return false,
            Some(Outcome::Open {
                host_id,
                session_id,
            }) => self.open(host_id, session_id, None, cx),
            Some(Outcome::Nothing) => {}
        }
        cx.notify();
        true
    }

    /// Pick a session: highlight it, mark it read in the core, and tell the window to show it.
    /// `provider` is what it was launched with; a listed session says its own.
    pub fn open(
        &mut self,
        host_id: String,
        session_id: String,
        provider: Option<String>,
        cx: &mut Context<Self>,
    ) {
        let row = self.find_session(&session_id);
        let title = row.map_or_else(|| "New session".to_string(), |s| s.title.clone());
        let provider_id = row.and_then(|s| s.provider_id.clone()).or(provider);
        self.notice = None;
        self.nav.selected = Some((host_id.clone(), session_id.clone()));
        self.nav.workspace = None;
        self.send(Command::View(session_id.clone()));
        cx.emit(OpenSession {
            host_id,
            session_id,
            title,
            provider_id,
            core_url: self.model.core_url.clone(),
        });
        cx.notify();
    }

    /// The session of the model with this id.
    pub fn find_session(&self, id: &str) -> Option<&SessionView> {
        self.model
            .hosts
            .iter()
            .flat_map(|h| &h.projects)
            .flat_map(|p| {
                p.sessions
                    .iter()
                    .chain(p.workspaces.iter().flat_map(|w| &w.sessions))
            })
            .find(|s| s.id == id)
    }

    pub fn model(&self) -> &Model {
        &self.model
    }

    /// The session the last launch made, until another launch makes one.
    pub fn launched(&self) -> Option<&str> {
        self.launched.as_deref()
    }

    /// Start `provider` where the New session panel would point, which is where the session being
    /// looked at lives. Only on this computer: a session started on another is not opened (see
    /// [`Update::Requested`]), so a split or a tab would never show it.
    pub fn launch(&mut self, provider: &str, cx: &mut Context<Self>) -> Result<(), String> {
        let target = self.nav.new_session_target(&self.model, false);
        if target.host_id != crate::sidebar::LOCAL {
            return Err("A session started on another computer is not opened here.".into());
        }
        let command = launch_command(&self.model, &target, provider)
            .ok_or_else(|| "There is no project here to start it in.".to_string())?;
        self.notice = None;
        self.send(command);
        cx.notify();
        Ok(())
    }

    /// Nothing is picked: the last tab was closed.
    pub fn clear_selection(&mut self, cx: &mut Context<Self>) {
        self.nav.selected = None;
        cx.notify();
    }

    pub fn send(&self, command: Command) {
        if let Some(commands) = &self.commands {
            let _ = commands.unbounded_send(command);
        }
    }

    fn header(&self, cx: &mut Context<Self>) -> gpui::Div {
        let mut status = div().id("needs-you").text_xs().text_color(rgb(DIM_COLOR));
        if !self.model.connected {
            status = status.child("Disconnected, trying again");
        } else if self.model.needs_you > 0 {
            // One click to the next chat that needs you.
            status = status
                .cursor_pointer()
                .child(if self.model.needs_you == 1 {
                    "1 needs you".to_string()
                } else {
                    format!("{} need you", self.model.needs_you)
                })
                .on_click(cx.listener(|this, _, _, cx| {
                    this.run_action("global.needsYou", cx);
                }));
        }
        let mut controls = div()
            .flex()
            .justify_between()
            .text_xs()
            .text_color(rgb(DIM_COLOR))
            .child(
                div()
                    .id("organize")
                    .cursor_pointer()
                    .child(match self.nav.organize {
                        Organize::Project => "By project",
                        Organize::Status => "By status",
                    })
                    .on_click(cx.listener(|this, _, _, cx| {
                        this.run_action("sidebar.organize", cx);
                    })),
            );
        if self.commands.is_some() {
            controls = controls
                .child(
                    div()
                        .id("show-terminals")
                        .cursor_pointer()
                        .child(if self.show_terminals {
                            "Hide terminals"
                        } else {
                            "Show terminals"
                        })
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.show_terminals = !this.show_terminals;
                            this.send(Command::ShowTerminals(this.show_terminals));
                            cx.notify();
                        })),
                )
                .child(
                    div()
                        .id("new-session")
                        .cursor_pointer()
                        .child("New")
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.run_action("sessions.new", cx);
                        })),
                );
        }
        div()
            .flex()
            .flex_col()
            .gap_1()
            .child(status)
            .child(controls)
    }

    /// The New session panel: a computer, a project, then what to start in it.
    fn new_session_panel(&self, target: &NewSession, cx: &mut Context<Self>) -> gpui::Div {
        let option = |id: String, label: String, picked: bool| {
            let row = div()
                .id(id)
                .cursor_pointer()
                .px_2()
                .py_1()
                .text_sm()
                .text_color(rgb(DIM_COLOR));
            if picked {
                row.bg(rgb(SELECTED_BG))
            } else {
                row
            }
            .child(label)
        };
        let mut panel = div()
            .flex()
            .flex_col()
            .gap_1()
            .p_2()
            .rounded_sm()
            .bg(rgb(MAIN_BG))
            .child(
                div()
                    .flex()
                    .justify_between()
                    .text_xs()
                    .text_color(rgb(DIM_COLOR))
                    .child("New session")
                    .child(
                        div()
                            .id("new-session-close")
                            .cursor_pointer()
                            .child("Close")
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.nav.new_session = None;
                                cx.notify();
                            })),
                    ),
            );
        let hosts = &self.model.hosts;
        if hosts.len() > 1 {
            for host in hosts.iter().filter(|h| h.reachable) {
                let id = host.id.clone();
                panel = panel.child(
                    option(
                        format!("new-host-{}", host.id),
                        host.name.clone(),
                        host.id == target.host_id,
                    )
                    .on_click(cx.listener(move |this, _, _, cx| {
                        this.nav.new_session = Some(NewSession::on_host(&this.model, &id));
                        cx.notify();
                    })),
                );
            }
        }
        let Some(host) = hosts.iter().find(|h| h.id == target.host_id) else {
            return panel;
        };
        let projects: Vec<&ProjectView> = host
            .projects
            .iter()
            .filter(|p| startable(host, p))
            .collect();
        if projects.is_empty() {
            return panel.child(hint("No project to start in"));
        }
        for project in projects {
            let (host_id, project_id) = (host.id.clone(), project.id.clone());
            panel = panel.child(
                option(
                    format!("new-project-{}-{}", host.id, project.id),
                    project.name.clone(),
                    target.project_id.as_deref() == Some(project.id.as_str()),
                )
                .on_click(cx.listener(move |this, _, _, cx| {
                    this.nav.new_session = Some(NewSession {
                        host_id: host_id.clone(),
                        project_id: Some(project_id.clone()),
                    });
                    cx.notify();
                })),
            );
        }
        for provider in &host.providers {
            let (target, provider_id) = (target.clone(), provider.id.clone());
            panel = panel.child(
                option(
                    format!("new-provider-{}", provider.id),
                    format!("New {}", provider.name),
                    false,
                )
                .text_color(rgb(TITLE_COLOR))
                .on_click(cx.listener(move |this, _, _, cx| {
                    if let Some(launch) = launch_command(&this.model, &target, &provider_id) {
                        this.nav.new_session = None;
                        this.notice = None;
                        this.send(launch);
                        cx.notify();
                    }
                })),
            );
        }
        panel
    }

    fn host(&self, host: &HostView, many: bool, cx: &mut Context<Self>) -> gpui::Div {
        let mut column = div().flex().flex_col().gap_2();
        if many {
            column = column.child(self.host_head(host, cx));
        }
        match self.nav.organize {
            Organize::Project => {
                for project in &host.projects {
                    column = column.child(self.project(host, project, cx));
                }
            }
            Organize::Status => column = column.child(self.status(host, cx)),
        }
        column
    }

    /// A computer's dot, name and state, and how it is reached or why it is not.
    fn host_head(&self, host: &HostView, cx: &mut Context<Self>) -> gpui::Div {
        let caption = if host.reachable {
            host.state.clone()
        } else {
            format!("{}, last known", host.state)
        };
        let mut head = div()
            .flex()
            .items_center()
            .gap_2()
            .text_xs()
            .child(
                div()
                    .flex_none()
                    .size(px(8.))
                    .rounded_full()
                    .bg(rgb(host_dot(&host.state))),
            )
            .child(
                div()
                    .flex_1()
                    .truncate()
                    .text_color(rgb(TITLE_COLOR))
                    .child(host.name.clone()),
            )
            .child(div().text_color(rgb(DIM_COLOR)).child(caption));
        if let (Some(enabled), true) = (host.enabled, self.commands.is_some()) {
            let host_id = host.id.clone();
            head = head.child(
                div()
                    .id(format!("host-enabled-{}", host.id))
                    .cursor_pointer()
                    .text_color(rgb(DIM_COLOR))
                    .child(if enabled { "Turn off" } else { "Turn on" })
                    .on_click(cx.listener(move |this, _, _, _| {
                        this.send(Command::SetHostEnabled {
                            host_id: host_id.clone(),
                            enabled: !enabled,
                        });
                    })),
            );
        }
        let mut column = div().flex().flex_col().child(head);
        // The error replaces the address while there is one.
        if let Some(line) = host.error.as_ref().or(host.detail.as_ref()) {
            column = column.child(
                div()
                    .truncate()
                    .text_xs()
                    .text_color(rgb(DIM_COLOR))
                    .child(line.clone()),
            );
        }
        column
    }

    fn project(&self, host: &HostView, project: &ProjectView, cx: &mut Context<Self>) -> gpui::Div {
        let key = Nav::project_key(&host.id, &project.id);
        let folded = self.nav.collapsed.contains(&key);
        let (toggle_host, toggle_project) = (host.id.clone(), project.id.clone());
        let mut head = div()
            .flex()
            .items_center()
            .gap_1()
            .text_xs()
            .text_color(rgb(DIM_COLOR))
            .child(
                div()
                    .id(format!("project-{key}"))
                    .flex_1()
                    .truncate()
                    .cursor_pointer()
                    .child(format!(
                        "{} {}",
                        if folded { "▸" } else { "▾" },
                        project.name
                    ))
                    .on_click(cx.listener(move |this, _, _, cx| {
                        this.nav.toggle_project(&toggle_host, &toggle_project);
                        cx.notify();
                    })),
            );
        // Folded, a project still says what needs you, and how many.
        if let (true, Some(top), true) = (folded, project.top, project.top_count > 0) {
            head = head.child(badge(top, project.top_count));
        }
        // A project the core does not list (the catch-all group) has nowhere to start a session.
        if self.commands.is_some() && startable(host, project) {
            head = head.child(self.start_here(host, project, cx));
        }
        let mut column = div().flex().flex_col().gap_1().child(head);
        if folded {
            return column;
        }
        for session in &project.sessions {
            column = column.child(self.session(session, 0, false, cx));
        }
        for workspace in &project.workspaces {
            column = column.child(self.workspace(workspace, cx));
        }
        column
    }

    /// The "+" that opens the New session panel on this project.
    fn start_here(
        &self,
        host: &HostView,
        project: &ProjectView,
        cx: &mut Context<Self>,
    ) -> gpui::Stateful<gpui::Div> {
        let target = NewSession {
            host_id: host.id.clone(),
            project_id: Some(project.id.clone()),
        };
        div()
            .id(format!("launch-{}/{}", host.id, project.id))
            .cursor_pointer()
            .child("+")
            .on_click(cx.listener(move |this, _, _, cx| {
                this.nav.new_session = if this.nav.new_session.as_ref() == Some(&target) {
                    None
                } else {
                    Some(target.clone())
                };
                cx.notify();
            }))
    }

    /// A checkout of a project that has several, with its chats below.
    fn workspace(&self, workspace: &WorkspaceView, cx: &mut Context<Self>) -> gpui::Div {
        let id = workspace.id.clone();
        let current = self.nav.workspace.as_deref() == Some(workspace.id.as_str());
        let mut name = div()
            .id(format!("workspace-{}", workspace.id))
            .cursor_pointer()
            .flex()
            .items_center()
            .gap_1()
            .pl(px(8. + 10. * workspace.depth as f32))
            .text_xs()
            .text_color(rgb(DIM_COLOR))
            .child(div().truncate().child(workspace.name.clone()))
            .on_click(cx.listener(move |this, _, _, cx| {
                match this.nav.pick_workspace(&this.model, &id) {
                    Outcome::Open {
                        host_id,
                        session_id,
                    } => this.open(host_id, session_id, None, cx),
                    Outcome::Nothing => cx.notify(),
                }
            }));
        if current {
            name = name.bg(rgb(SELECTED_BG));
        }
        // A branch only when it tells checkouts apart; the path says the rest.
        if let Some(branch) = workspace.branch.as_ref().filter(|b| **b != workspace.name) {
            name = name.child(div().truncate().child(branch.clone()));
        }
        if workspace.dirty {
            name = name.child("●");
        }
        let flags: Vec<&str> = [
            workspace.pinned.then_some("pinned"),
            workspace.sleeping.then_some("sleeping"),
        ]
        .into_iter()
        .flatten()
        .collect();
        if !flags.is_empty() {
            name = name.child(flags.join(" · "));
        }
        let mut column = div().flex().flex_col().gap_1().child(name);
        for session in &workspace.sessions {
            column = column.child(self.session(session, 1 + workspace.depth, false, cx));
        }
        column
    }

    /// By status: sections in fixed order, each split by project, then the projects with no chat.
    fn status(&self, host: &HostView, cx: &mut Context<Self>) -> gpui::Div {
        let mut column = div().flex().flex_col().gap_2();
        for section in &host.status {
            column = column.child(self.status_section(section, cx));
        }
        if !host.empty_projects.is_empty() {
            let mut empty = div().flex().flex_col().gap_1().child(heading(
                None,
                "No sessions",
                host.empty_projects.len(),
                None,
            ));
            for project in &host.empty_projects {
                let mut row = div()
                    .flex()
                    .justify_between()
                    .px_2()
                    .text_xs()
                    .text_color(rgb(DIM_COLOR))
                    .child(div().truncate().child(project.name.clone()));
                if self.commands.is_some() && startable(host, project) {
                    row = row.child(self.start_here(host, project, cx));
                }
                empty = empty.child(row);
            }
            column = column.child(empty);
        }
        column
    }

    fn status_section(&self, section: &StatusSection, cx: &mut Context<Self>) -> gpui::Div {
        let mut column = div().flex().flex_col().gap_1().child(heading(
            section.attention,
            &section.title,
            section.count,
            section.note.as_deref(),
        ));
        for cluster in &section.clusters {
            column = column.child(self.status_cluster(cluster, cx));
        }
        column
    }

    fn status_cluster(&self, cluster: &StatusCluster, cx: &mut Context<Self>) -> gpui::Div {
        let mut column = div().flex().flex_col().gap_1().child(
            div()
                .px_2()
                .truncate()
                .text_xs()
                .text_color(rgb(DIM_COLOR))
                .child(cluster.name.clone()),
        );
        for session in &cluster.sessions {
            column = column.child(self.session(session, 0, true, cx));
        }
        column
    }

    /// One chat. In By status (`compact`) the section already says the state, so the row is the
    /// name, then what it adds (the checkout, or why it needs you), muted.
    fn session(
        &self,
        session: &SessionView,
        depth: usize,
        compact: bool,
        cx: &mut Context<Self>,
    ) -> gpui::Stateful<gpui::Div> {
        let (host_id, session_id) = (session.host_id.clone(), session.id.clone());
        let mut row = div()
            .id(format!("session-{}", session.id))
            .cursor_pointer()
            .flex()
            .items_center()
            .gap_2()
            .pr_2()
            // A sub-session sits one step in from its lead.
            .pl(px(8.
                + 10. * depth as f32
                + if session.nested { 14. } else { 0. }))
            .py_1()
            .text_sm()
            .text_color(rgb(TITLE_COLOR))
            .on_click(cx.listener(move |this, _, _, cx| {
                this.open(host_id.clone(), session_id.clone(), None, cx)
            }));
        if self.is_open(session) {
            row = row.bg(rgb(SELECTED_BG));
        }
        if compact {
            let detail: Vec<&str> = [
                session.workspace_label.as_deref(),
                session.need_reason.as_deref(),
            ]
            .into_iter()
            .flatten()
            .collect();
            row = row.child(div().truncate().child(session.title.clone()));
            if !detail.is_empty() {
                row = row.child(
                    div()
                        .flex_1()
                        .truncate()
                        .text_xs()
                        .text_color(rgb(DIM_COLOR))
                        .child(detail.join(" · ")),
                );
            }
            return row;
        }
        // A state the core cannot vouch for is a grey dot with no word.
        let dot = session.attention.map_or(DIM_COLOR, |a| tint(a).0);
        row = row
            .child(div().flex_none().size(px(8.)).rounded_full().bg(rgb(dot)))
            .child(div().flex_1().truncate().child(session.title.clone()))
            .child(
                div()
                    .text_xs()
                    .text_color(rgb(DIM_COLOR))
                    .child(session.provider.clone()),
            );
        if let Some(attention) = session.attention.filter(|a| a.label().is_some()) {
            row = row.child(label(attention));
        }
        row
    }

    fn is_open(&self, session: &SessionView) -> bool {
        self.nav
            .selected
            .as_ref()
            .is_some_and(|(_, id)| *id == session.id)
    }
}

/// The small tinted word that names a state.
pub(crate) fn label(attention: Attention) -> gpui::Div {
    div()
        .flex_none()
        .px_1()
        .rounded_sm()
        .text_xs()
        .bg(rgb(tint(attention).1))
        .child(attention.label().unwrap_or_default())
}

/// A folded project's most urgent state, and how many chats are in it.
fn badge(attention: Attention, count: usize) -> gpui::Div {
    div()
        .flex_none()
        .px_1()
        .rounded_sm()
        .text_xs()
        .bg(rgb(tint(attention).1))
        .child(format!("{count} {}", attention.label().unwrap_or_default()))
}

/// A By status heading: the state's colour as a dot, then its name in full text colour, and how
/// many. A section that claims no state (Offline, No sessions) gets a grey dot.
fn heading(
    attention: Option<Attention>,
    title: &str,
    count: usize,
    note: Option<&str>,
) -> gpui::Div {
    let dot = attention.map_or(DIM_COLOR, |a| tint(a).0);
    let mut head = div()
        .flex()
        .items_center()
        .gap_2()
        .px_2()
        .text_xs()
        .child(div().flex_none().size(px(8.)).rounded_full().bg(rgb(dot)))
        .child(div().text_color(rgb(TITLE_COLOR)).child(title.to_string()))
        .child(div().text_color(rgb(DIM_COLOR)).child(count.to_string()));
    if let Some(note) = note {
        head = head.child(
            div()
                .truncate()
                .text_color(rgb(DIM_COLOR))
                .child(note.to_string()),
        );
    }
    head
}

impl gpui::Render for Sidebar {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        if self.activation.is_none() {
            self.send(Command::WindowActive(window.is_window_active()));
            self.activation = Some(cx.observe_window_activation(window, |this, window, _| {
                this.send(Command::WindowActive(window.is_window_active()));
            }));
        }
        let mut sidebar = div()
            .id("sidebar")
            .overflow_y_scroll()
            .flex()
            .flex_col()
            .flex_none()
            .w(px(SIDEBAR_WIDTH))
            .h_full()
            .p_3()
            .gap_3()
            .bg(rgb(SIDEBAR_BG))
            .child(self.header(cx));
        if let Some(reason) = self
            .model
            .offline_reason
            .as_ref()
            .filter(|_| !self.model.connected)
        {
            sidebar = sidebar.child(hint(reason.clone()));
        }
        if let Some(notice) = &self.notice {
            sidebar = sidebar.child(hint(notice.clone()));
        }
        if let Some(target) = self.nav.new_session.clone() {
            sidebar = sidebar.child(self.new_session_panel(&target, cx));
        }
        let many = self.model.hosts.len() > 1;
        let hosts = self.model.hosts.clone();
        for host in &hosts {
            sidebar = sidebar.child(self.host(host, many, cx));
        }
        if hosts.iter().all(|h| h.projects.is_empty()) {
            sidebar = sidebar.child(hint(if self.model.connected {
                "No projects"
            } else {
                "Connecting"
            }));
        }
        sidebar
    }
}

pub(crate) fn hint(text: impl Into<gpui::SharedString>) -> gpui::Div {
    div()
        .text_sm()
        .text_color(rgb(DIM_COLOR))
        .child(text.into())
}

//! The window: a [`Sidebar`] of computers, projects and sessions beside the main area.
//!
//! The sidebar only draws the [`Model`] the core's messages reduce to (`sidebar.rs`) and says
//! what the person did: it emits [`OpenSession`] when a row is picked and sends a
//! [`Command::Launch`] when a provider is chosen from a project's "+". The main area is a
//! placeholder naming the open session; the terminal view replaces it there.

use crate::client::{Command, Update};
use crate::sidebar::{Attention, HostView, Model, ProjectView, SessionView};
use futures::channel::mpsc::UnboundedSender;
use gpui::{
    div, prelude::*, px, rgb, Context, Entity, EventEmitter, IntoElement, Subscription, Window,
};

/// Sidebar text: a session title is bright, a project name and a hint dim. The render test
/// counts the bright pixels, so nothing else in the window may be this bright.
pub const TITLE_COLOR: u32 = 0xeeeeee;
const DIM_COLOR: u32 = 0x8a8a90;
const SIDEBAR_BG: u32 = 0x1c1c1f;
const MAIN_BG: u32 = 0x131315;
const SELECTED_BG: u32 = 0x2a2a30;
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

/// A session was picked; the main area shows it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OpenSession {
    pub host_id: String,
    pub session_id: String,
    pub title: String,
}

pub struct Sidebar {
    model: Model,
    selected: Option<String>,
    /// The project whose launch menu is open: (computer, project id).
    launching: Option<(String, String)>,
    show_terminals: bool,
    notice: Option<String>,
    /// Where launches and toggles go; without it the sidebar is read-only.
    commands: Option<UnboundedSender<Command>>,
}

impl EventEmitter<OpenSession> for Sidebar {}

impl Sidebar {
    pub fn new(model: Model, commands: Option<UnboundedSender<Command>>) -> Self {
        Self {
            model,
            selected: None,
            launching: None,
            show_terminals: false,
            notice: None,
            commands,
        }
    }

    /// Take what the follower learned.
    pub fn apply(&mut self, update: Update, cx: &mut Context<Self>) {
        match update {
            Update::Model(model) => self.model = model,
            Update::Launched {
                host_id,
                session_id,
            } => self.open(host_id, session_id, cx),
            Update::LaunchFailed(error) => self.notice = Some(error),
        }
        cx.notify();
    }

    /// Pick a session: highlight it and tell the window to show it.
    pub fn open(&mut self, host_id: String, session_id: String, cx: &mut Context<Self>) {
        let title = self
            .model
            .hosts
            .iter()
            .flat_map(|h| &h.projects)
            .flat_map(|p| &p.sessions)
            .find(|s| s.id == session_id)
            .map_or_else(|| "New session".to_string(), |s| s.title.clone());
        self.notice = None;
        self.selected = Some(session_id.clone());
        cx.emit(OpenSession {
            host_id,
            session_id,
            title,
        });
        cx.notify();
    }

    fn send(&self, command: Command) {
        if let Some(commands) = &self.commands {
            let _ = commands.unbounded_send(command);
        }
    }

    fn header(&self, cx: &mut Context<Self>) -> gpui::Div {
        let status = if !self.model.connected {
            "Disconnected, trying again".to_string()
        } else if self.model.needs_you > 0 {
            format!("{} need you", self.model.needs_you)
        } else {
            String::new()
        };
        let mut header = div()
            .flex()
            .justify_between()
            .text_xs()
            .text_color(rgb(DIM_COLOR))
            .child(status);
        if self.commands.is_some() {
            header = header.child(
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
            );
        }
        header
    }

    fn host(&self, host: &HostView, many: bool, cx: &mut Context<Self>) -> gpui::Div {
        let mut column = div().flex().flex_col().gap_2();
        if many {
            let caption = if host.reachable {
                host.state.clone()
            } else {
                format!("{}, last known", host.state)
            };
            column = column.child(
                div()
                    .flex()
                    .justify_between()
                    .text_xs()
                    .text_color(rgb(TITLE_COLOR))
                    .child(host.name.clone())
                    .child(div().text_color(rgb(DIM_COLOR)).child(caption)),
            );
        }
        for project in &host.projects {
            column = column.child(self.project(host, project, cx));
        }
        column
    }

    fn project(&self, host: &HostView, project: &ProjectView, cx: &mut Context<Self>) -> gpui::Div {
        let key = format!("{}/{}", host.id, project.id);
        let mut head = div()
            .flex()
            .justify_between()
            .text_xs()
            .text_color(rgb(DIM_COLOR))
            .child(project.name.clone());
        // A project the core does not list (the catch-all group) has nowhere to start a session.
        let startable = self.commands.is_some()
            && host.reachable
            && (project.quickchat || !project.path.is_empty());
        if startable {
            let target = (host.id.clone(), project.id.clone());
            head = head.child(
                div()
                    .id(format!("launch-{key}"))
                    .cursor_pointer()
                    .child("+")
                    .on_click(cx.listener(move |this, _, _, cx| {
                        this.launching = if this.launching.as_ref() == Some(&target) {
                            None
                        } else {
                            Some(target.clone())
                        };
                        cx.notify();
                    })),
            );
        }
        let mut column = div().flex().flex_col().gap_1().child(head);
        if startable && self.launching.as_ref() == Some(&(host.id.clone(), project.id.clone())) {
            for provider in &host.providers {
                let (host_id, provider_id) = (host.id.clone(), provider.id.clone());
                let cwd = (!project.quickchat).then(|| project.path.clone());
                column = column.child(
                    div()
                        .id(format!("start-{key}-{}", provider.id))
                        .cursor_pointer()
                        .px_2()
                        .py_1()
                        .text_sm()
                        .text_color(rgb(DIM_COLOR))
                        .child(format!("New {}", provider.name))
                        .on_click(cx.listener(move |this, _, _, cx| {
                            this.launching = None;
                            this.notice = None;
                            this.send(Command::Launch {
                                host_id: host_id.clone(),
                                cwd: cwd.clone(),
                                provider: provider_id.clone(),
                            });
                            cx.notify();
                        })),
                );
            }
        }
        for session in &project.sessions {
            column = column.child(self.session(session, cx));
        }
        column
    }

    fn session(&self, session: &SessionView, cx: &mut Context<Self>) -> gpui::Stateful<gpui::Div> {
        let (host_id, session_id) = (session.host_id.clone(), session.id.clone());
        let mut row = div()
            .id(format!("session-{}", session.id))
            .cursor_pointer()
            .flex()
            .items_center()
            .gap_2()
            .px_2()
            .py_1()
            .text_sm()
            .text_color(rgb(TITLE_COLOR))
            .on_click(cx.listener(move |this, _, _, cx| {
                this.open(host_id.clone(), session_id.clone(), cx)
            }));
        if self.selected.as_deref() == Some(session.id.as_str()) {
            row = row.bg(rgb(SELECTED_BG));
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
        if let Some((attention, label)) = session
            .attention
            .and_then(|a| a.label().map(|label| (a, label)))
        {
            row = row.child(
                div()
                    .flex_none()
                    .px_1()
                    .rounded_sm()
                    .text_xs()
                    .bg(rgb(tint(attention).1))
                    .child(label),
            );
        }
        row
    }
}

impl gpui::Render for Sidebar {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let mut sidebar = div()
            .flex()
            .flex_col()
            .flex_none()
            .w(px(SIDEBAR_WIDTH))
            .h_full()
            .p_3()
            .gap_3()
            .bg(rgb(SIDEBAR_BG))
            .child(self.header(cx));
        if let Some(notice) = &self.notice {
            sidebar = sidebar.child(hint(notice.clone()));
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

pub struct Workspace {
    sidebar: Entity<Sidebar>,
    open: Option<OpenSession>,
    _open_session: Subscription,
}

impl Workspace {
    pub fn new(
        model: Model,
        commands: Option<UnboundedSender<Command>>,
        cx: &mut Context<Self>,
    ) -> Self {
        let sidebar = cx.new(|_| Sidebar::new(model, commands));
        let subscription = cx.subscribe(&sidebar, |this, _, event: &OpenSession, cx| {
            this.open = Some(event.clone());
            cx.notify();
        });
        Self {
            sidebar,
            open: None,
            _open_session: subscription,
        }
    }

    pub fn sidebar(&self) -> &Entity<Sidebar> {
        &self.sidebar
    }

    /// The session the main area shows.
    pub fn open(&self) -> Option<&OpenSession> {
        self.open.as_ref()
    }
}

impl gpui::Render for Workspace {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        // Placeholder for the terminal view: it takes this slot and the session named here.
        let main = match &self.open {
            Some(open) => div().text_color(rgb(TITLE_COLOR)).child(open.title.clone()),
            None => div().text_color(rgb(DIM_COLOR)).child("Select a session"),
        };
        div()
            .flex()
            .size_full()
            .bg(rgb(MAIN_BG))
            .child(self.sidebar.clone())
            .child(
                div()
                    .flex()
                    .flex_1()
                    .items_center()
                    .justify_center()
                    .text_sm()
                    .child(main),
            )
    }
}

fn hint(text: impl Into<gpui::SharedString>) -> gpui::Div {
    div()
        .text_sm()
        .text_color(rgb(DIM_COLOR))
        .child(text.into())
}

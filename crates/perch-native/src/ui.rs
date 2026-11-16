//! The sidebar's state and what the person does with it, without a view of its own: the
//! stock `sidebar` mod draws the sidebar (`mods/sidebar/`, the web's stock sidebar on the native
//! React runtime), reading the same facts through the `perch` module.
//!
//! [`Sidebar`] keeps the [`Model`] the core's messages reduce to (`sidebar.rs`) and what the
//! person has chosen to look at (the [`Nav`] of `actions.rs`: the picked session, a workspace,
//! whether the sidebar is shown). It emits [`OpenSession`] when a session is picked (by a key,
//! the mod, a tab or a launch) and sends the core a [`Command`] when a session is started or
//! opened (marking it read). Every key action runs through [`Sidebar::run_action`].

use crate::actions::{launch_command, pin_command, Nav, Outcome};
use crate::client::{Command, Update};
use crate::sidebar::{Attention, Model, SessionView};
use futures::channel::mpsc::UnboundedSender;
use gpui::{div, prelude::*, rgb, Context, EventEmitter};

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

/// A session was picked; the main area shows it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OpenSession {
    pub host_id: String,
    pub session_id: String,
    pub title: String,
    /// The provider the session was launched with, which a terminal attaching to it must name
    /// again. Known from the row (`cliProviderId`), or from the launch for a session the core
    /// does not list yet. `None` when the core records none: no terminal is attached then.
    pub provider_id: Option<String>,
    /// The core lists the session with no provider and nothing ever started in it, so nobody has
    /// launched anything yet: the tab offers the launch choices and attaches under the one picked.
    /// False for a session the core does not list (unknown is not blank) and for one started
    /// without a recorded provider (never guessed).
    pub blank: bool,
    /// The core's address, while connected.
    pub core_url: Option<String>,
}

pub struct Sidebar {
    model: Model,
    nav: Nav,
    notice: Option<String>,
    /// Where launches and toggles go; without it the sidebar is read-only.
    commands: Option<UnboundedSender<Command>>,
    /// The session the last launch made, which the window opens as a tab or a split.
    launched: Option<String>,
    /// A command that changes something was refused since the window last asked, because the
    /// core was away.
    refused: std::cell::Cell<bool>,
    /// A workspace an action moved to with no session of it to show; the window shows its start
    /// page ([`Self::take_workspace`]).
    workspace: Option<String>,
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
            notice: None,
            commands,
            launched: None,
            refused: Default::default(),
            workspace: None,
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
            // Heard, not seen: the app plays it. Files are the window's, not the sidebar's.
            Update::Alert(_) | Update::Files(_) | Update::Review(_) => {}
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
            Some(Outcome::Workspace(id)) => self.workspace = Some(id),
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
        let blank = provider_id.is_none() && row.is_some_and(|s| !s.cli_started);
        self.notice = None;
        self.nav.selected = Some((host_id.clone(), session_id.clone()));
        self.nav.workspace = None;
        self.send(Command::View(session_id.clone()));
        cx.emit(OpenSession {
            host_id,
            session_id,
            title,
            provider_id,
            blank,
            core_url: self.model.core_url.clone(),
        });
        cx.notify();
    }

    /// What opening `session_id` would show, without opening it: the session as the model lists
    /// it, or `None` when it is not listed.
    pub fn session_to_open(&self, session_id: &str) -> Option<OpenSession> {
        let row = self.find_session(session_id)?;
        Some(OpenSession {
            host_id: row.host_id.clone(),
            session_id: session_id.to_string(),
            title: row.title.clone(),
            provider_id: row.provider_id.clone(),
            blank: row.provider_id.is_none() && !row.cli_started,
            core_url: self.model.core_url.clone(),
        })
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

    /// Pin or unpin a workspace (the current one without an `id`) by asking the core, which
    /// the sidebar then follows.
    pub fn pin_workspace(&self, id: Option<&str>, pinned: Option<bool>) -> Result<(), String> {
        self.send(pin_command(&self.nav, &self.model, id, pinned)?);
        Ok(())
    }

    /// The current workspace, when the core can pin it: whether it is pinned.
    pub fn pinned(&self) -> Option<bool> {
        self.model
            .can_pin_workspace
            .then(|| self.nav.current_workspace(&self.model))
            .flatten()
            .map(|w| w.pinned)
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

    /// Takes the New session panel's target, for a screen drawn in the panel's place.
    /// The workspace the last action moved to with no session of it, which the window opens.
    pub fn take_workspace(&mut self) -> Option<String> {
        self.workspace.take()
    }

    pub fn take_new_session(&mut self) -> Option<crate::actions::NewSession> {
        self.nav.new_session.take()
    }

    /// Nothing is picked: the last tab was closed.
    pub fn clear_selection(&mut self, cx: &mut Context<Self>) {
        self.nav.selected = None;
        cx.notify();
    }

    /// A way to send the follower commands later, from another thread.
    pub fn commands(&self) -> Option<UnboundedSender<Command>> {
        self.commands.clone()
    }

    /// Hands `command` to the follower. While the core is away one that changes something is
    /// refused instead ([`Command::refuse`]), and [`Self::take_refused`] says so.
    pub fn send(&self, command: Command) {
        if !self.model.connected && command.changes_state() {
            self.refused.set(true);
            command.refuse(crate::client::NOT_CONNECTED);
            return;
        }
        if let Some(commands) = &self.commands {
            let _ = commands.unbounded_send(command);
        }
    }

    /// Ask the core to keep this order, and show it at once (the web's `setWorkspaceOrder`): the
    /// strip and the sidebar follow the move before the core's broadcast confirms it. Absent
    /// lists keep what is stored. Nothing changes while the core is away.
    pub fn set_order(
        &mut self,
        host_id: String,
        projects: Option<Vec<String>>,
        sessions: Option<Vec<String>>,
        cx: &mut Context<Self>,
    ) {
        if !self.model.connected {
            self.send(Command::SetOrder {
                host_id,
                projects,
                sessions,
            });
            return;
        }
        let store = std::sync::Arc::make_mut(&mut self.model.store);
        let entry = store.order.entry(host_id.clone()).or_default();
        if let Some(projects) = &projects {
            entry.0.clone_from(projects);
        }
        if let Some(sessions) = &sessions {
            entry.1.clone_from(sessions);
        }
        self.send(Command::SetOrder {
            host_id,
            projects,
            sessions,
        });
        cx.notify();
    }

    /// Whether a command was refused since the last call, because the core was away.
    pub fn take_refused(&self) -> bool {
        self.refused.replace(false)
    }

    /// What the last launch said (it failed, or it was asked of another computer), until a
    /// session is opened or the next launch; the window shows it.
    pub fn notice(&self) -> Option<&str> {
        self.notice.as_deref()
    }
}

/// A quiet line of text.
pub(crate) fn hint(text: impl Into<gpui::SharedString>) -> gpui::Div {
    div()
        .text_sm()
        .text_color(rgb(DIM_COLOR))
        .child(text.into())
}

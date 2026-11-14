//! The window: the [`Sidebar`] beside the main area, which holds the tab strip, the terminals of
//! the tabs and their splits and the terminal settings; the Navigator and the other floating
//! screens are mods'.
//!
//! What a tab, a split and a key mean is decided elsewhere (`tabs`, `keymap`,
//! `settings`); this draws it and runs the commands. A tab is a session shown as a
//! [`TerminalView`]. Only the tabs on screen are drawn: a terminal that is not drawn is not laid
//! out, so it never asks the core for a size, and it keeps the size it last had and keeps
//! following its shell, ready for when its tab is shown again.
//!
//! The layout is this window's alone, as the web's is per viewer: it is not sent to the core.
//! Splitting starts a new terminal session on this computer and shows it beside the focused one.
//! Closing a tab ends its session, as the web does (`closeGuard.ts`): the core is asked to delete
//! it over the terminal's own connection, and the tab goes only when the core says it is deleted.
//! An agent's tab asks first when Settings > Warn before closing an agent is on: the first close
//! arms, the second ends. A tab that only watches a session another view controls, and one this
//! window is not attached to, just close: the session keeps running.
//!
//! `terminal.takeBack` and `terminal.takeBackAll` take the size back from a phone for the terminal on
//! screen or for every terminal this window is attached to whose size a phone holds; none is
//! attached for it.
//!
//! A tab for a blank session (listed, nothing ever launched in it) lists the launch choices of its
//! computer; the one picked attaches that session, after the row is checked to be still blank.
//!
//! A mod may draw a screen in place of its Rust view (`mods::screens`): when one exists for a
//! screen's id, the window places it there, hands it its props and runs what its result asks.
//! With no screen mods, every Rust view is drawn as before.

use crate::client::{Command, Core};
use crate::handoff::{open_in_perch, perch_url, Place};
use crate::keymap::{Context as KeyContext, Hit, Keymap};
use crate::mods::screens::{self, OnResult, Screens, PANE_HEADER_HEIGHT};
use crate::settings::{
    self, next_choice, scrollback_from_text, stepped, Change, CONTRAST, MAX_SCROLLBACK,
    MIN_SCROLLBACK, OPACITY, OPTION_AS_ALT, PADDING, TOAST_DELIVERY,
};
use crate::sidebar::{navigation, Alert, Heard, Provider, LOCAL};
use crate::tab_drag::{self, Drop, TabDrag};
use crate::tabs::{Dir, History, Node, Side, Tabs};
use crate::terminal::actions::{Action, Scroll};
use crate::terminal::attach::FromCore;
use crate::terminal::clipboard::{Clipboard, SystemClipboard};
use crate::terminal::links::{open_in_system, Target};
use crate::terminal::{Status, TerminalEvent, TerminalView};
use crate::ui::{
    hint, LaunchFailed, OpenSession, Sidebar, DIM_COLOR, MAIN_BG, SELECTED_BG, SIDEBAR_BG,
    SIDEBAR_WIDTH, TITLE_COLOR,
};
use crate::zoom::Zoom;
use futures::channel::mpsc::UnboundedSender;
use gpui::{
    canvas, div, point, prelude::*, px, relative, rgb, size, AnyElement, App, Bounds, Context,
    DispatchPhase, Entity, Focusable, KeyDownEvent, Keystroke, MouseButton, MouseDownEvent,
    MouseMoveEvent, MouseUpEvent, Pixels, Point, SharedString, Size, Subscription, Task, Window,
};
use serde_json::{json, Value};
use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::rc::Rc;
use std::time::{Duration, Instant};

/// How long a follow-up key after the leader chord is awaited.
const LEADER_TIMEOUT: Duration = Duration::from_millis(1500);
/// Pixels one resize key grows or shrinks the focused pane by, as the web's.
const RESIZE_STEP: f32 = 60.;
/// How many tabs out of sight keep their terminal attached. A tab beyond them is parked: its
/// terminal lets go of the shell (which keeps running) and attaches again, with the core's
/// repaint, when the tab is shown.
const MAX_PARKED: usize = 12;
/// How long the core has to confirm that a session ended before the tab says it is still running.
const END_WAIT: Duration = Duration::from_secs(5);
/// How long to wait before attaching a dropped terminal to the core again: it doubles from the
/// first wait to the last, and stays there for as long as the core is away.
const REATTACH_FIRST: Duration = Duration::from_millis(250);
const REATTACH_LAST: Duration = Duration::from_secs(5);

/// Whether a tab is a plain terminal: its session was launched as one (or, for a blank session,
/// was started as one from the tab's choices). A session whose launch provider is not known is
/// never taken for one.
fn is_plain(open: &OpenSession) -> bool {
    open.provider_id.as_deref() == Some(perch_core::agent_fleet::TERMINAL_PROVIDER)
}

fn reattach_delay(attempt: u32) -> Duration {
    REATTACH_FIRST
        .saturating_mul(2u32.saturating_pow(attempt.min(8)))
        .min(REATTACH_LAST)
}

/// How long a started split waits for its new session.
const SPLIT_WAIT: Duration = Duration::from_secs(20);
pub const TAB_BAR_HEIGHT: f32 = 30.;
const TAB_BAR_BG: u32 = 0x19191c;
const OVERLAY_BORDER: u32 = 0x3a3a42;
const PANE_FOCUS: u32 = 0x4a4a55;
const PANE_GAP: f32 = 6.;

/// Finds the core to attach a terminal to, each time one is opened: the core may have
/// restarted, and a restart changes its address and credential.
type Locate = Box<dyn Fn() -> anyhow::Result<Core>>;

/// An open tab: the session, and its terminal while there is a core to attach to.
struct Pane {
    open: OpenSession,
    view: Option<Entity<TerminalView>>,
    /// Gates the size a hidden pane is given.
    settle: Settle,
    /// Attaches the terminal again after its connection dropped, and how many tries in a row.
    retry: Option<Task<()>>,
    attempts: u32,
    /// The tab was asked to close and the core has not yet said the session ended; the task
    /// gives up waiting.
    closing: Option<Task<()>>,
    /// When the tab was last on screen, to park the one longest out of sight.
    seen: u64,
    /// The terminal was let go of to stay within [`MAX_PARKED`]; showing the tab attaches it.
    parked: bool,
}

/// Waits for a size to hold still before a hidden pane is given it: a window being dragged or a
/// font being changed passes through many sizes, and each would be sent to a shell that nobody is
/// looking at. The value must repeat on two draws in a row.
struct Settle<T = (Size<Pixels>, (String, u32, u32))> {
    last: Option<T>,
    applied: Option<T>,
}

impl<T> Default for Settle<T> {
    fn default() -> Self {
        Self {
            last: None,
            applied: None,
        }
    }
}

impl<T: Clone + PartialEq> Settle<T> {
    /// The value to apply now, if it has held for two draws and was not applied already.
    fn tick(&mut self, now: T) -> Option<T> {
        let held = self.last.as_ref() == Some(&now);
        self.last = Some(now.clone());
        (held && self.applied.as_ref() != Some(&now)).then(|| {
            self.applied = Some(now.clone());
            now
        })
    }

    /// Forget what was applied: the pane was on screen and sized itself.
    fn reset(&mut self) {
        self.applied = None;
    }
}

#[derive(Default)]
struct SettingsPanel {
    /// The scrollback being typed.
    editing: Option<String>,
}

/// The most notifications kept for a screen to show; the oldest go first.
const MAX_NOTIFICATIONS: usize = 20;

/// A session finished or needs the person, a usage alert, or a mod's `notify`: what the
/// notifications screen lists until it is dismissed or opened (`useNotifications`).
#[derive(Clone, Debug, PartialEq)]
pub struct Notification {
    pub id: String,
    pub heard: Heard,
    /// What a mod's `notify` adds, as the web's toast: none for the window's own.
    pub notice: Option<Notice>,
}

/// A mod's notification beyond its title and body (`perch.notify`).
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Notice {
    /// `info`, `warning` or `error`: the ring's colour.
    pub level: Option<String>,
    /// A short mark drawn in place of the ring.
    pub icon: Option<String>,
    /// The command opening it runs, with its arguments.
    pub action: Option<(String, Option<Value>)>,
    /// How long it stays, in milliseconds.
    pub timeout: Option<u64>,
}

pub struct Workspace {
    sidebar: Entity<Sidebar>,
    locate: Option<Locate>,
    tabs: Tabs,
    panes: HashMap<String, Pane>,
    /// A split that was asked for and waits for its new terminal to be opened.
    pending_split: Option<(Side, Instant)>,
    settings: Option<SettingsPanel>,
    /// The zoom every terminal in the window is at.
    zoom: Zoom,
    /// Counts the changes of what is on screen, for [`Pane::seen`].
    tick: u64,
    /// The window's height as last drawn, which keeps an overlay inside it.
    viewport_height: f32,
    /// The session whose terminal is over the window for a moment (`terminal.peek`), with no tab
    /// of its own unless it is kept.
    peek: Option<String>,
    /// The leader chord was pressed; dropped when its time is up.
    leader: Option<Task<()>>,
    /// Resize mode is armed (the leader's `r`); each of its keys arms it afresh, and it is
    /// dropped when its time is up.
    resizing: Option<Task<()>>,
    /// Back and Forward over the tabs shown.
    history: History,
    /// What the last command could not do, or did instead.
    notice: Option<String>,
    /// The tab whose close the close guard confirmed: the next close of it ends it.
    armed_close: Option<String>,
    /// The room a lone pane has in the main area, as of the last draw: what a hidden pane is
    /// sized for.
    room: Rc<Cell<Option<Size<Pixels>>>>,
    /// Where the terminals copy to and paste from: the system's, unless a test says otherwise.
    clipboard: Rc<dyn Clipboard>,
    /// What runs when a link is clicked: the system's handler, unless a test says otherwise.
    opener: Rc<dyn Fn(&Target)>,
    /// The screens mods draw in place of Rust views.
    screens: Screens,
    /// What has the keyboard while a modal screen is up, unless the mod gives it to a field of its
    /// own: its layer, so keys pass the window on their way to the mod.
    screen_focus: gpui::FocusHandle,
    /// The window's own keyboard focus, held while nothing in it has the keyboard (nothing open),
    /// so its keys still reach the window, as a page's reach the document.
    root_focus: gpui::FocusHandle,
    notifications: Vec<Notification>,
    next_notification: u64,
    /// Cmd+T asks the tab strip mod for a new tab this many times (`perch.requests()`).
    new_tab_asks: u64,
    /// The place the start page's picker chose, for the workspace it was chosen in.
    start_place: Option<(String, String)>,
    /// The last Add project request (`useAddProject`): `{status, error?, hostId?}`.
    add_project: Value,
    /// How many times the sidebar was asked to open its Add project form, and when last.
    add_project_asks: (u64, Option<Instant>),
    /// The last request for a project's worktree menu (the web's `worktreeMenuRequest`):
    /// `{projectKey, nonce, remove?, create?}`, null once the menu took it.
    worktree_request: Value,
    /// How many worktree menu requests were made, each one's `nonce`.
    worktree_requests: u64,
    /// The in-flow mod whose own field has the keyboard (the sidebar's Add project form): the
    /// window leaves the keyboard there and types into it rather than running plain keys.
    keyboard_held: Option<(String, u64)>,
    /// A press on a tab of the strip, which may become a drag (`tab.beginDrag`).
    drag: Option<TabDrag>,
    /// A press a mod follows (`pointer.follow`): its token while the press lasts, and the
    /// pointer last forwarded for it (`pointerFollow()`), which stays after the press ends.
    follow: Option<String>,
    pointer: Value,
    /// Where the strip and each pane on screen were last drawn, for where a drag would drop.
    drop_boxes: Rc<RefCell<DropBoxes>>,
    /// Tells the core whether this window is the one being looked at.
    activation: Option<Subscription>,
    _subscriptions: Vec<Subscription>,
}

/// The strip's box and each shown pane's, as last drawn.
#[derive(Default)]
struct DropBoxes {
    strip: Option<Bounds<Pixels>>,
    panes: HashMap<String, Bounds<Pixels>>,
}

impl Workspace {
    pub fn new(
        model: crate::sidebar::Model,
        commands: Option<UnboundedSender<Command>>,
        cx: &mut Context<Self>,
    ) -> Self {
        let sidebar = cx.new(|_| Sidebar::new(model, commands));
        let opened = cx.subscribe(&sidebar, |this, _, event: &OpenSession, cx| {
            this.on_open(event, cx);
        });
        let failed = cx.subscribe(&sidebar, |this, _, _: &LaunchFailed, cx| {
            this.pending_split = None;
            cx.notify();
        });
        // The sidebar's own changes (hiding it, a count, a session's state) redraw the window. A
        // New session asked for (`sessions.new`, `nests.scratchpad`) opens the `new-session` screen;
        // with no mod drawing one, the window says so.
        let observed = cx.observe(&sidebar, |this, sidebar, cx| {
            let target = sidebar.update(cx, |sidebar, _| sidebar.take_new_session());
            if let Some(target) = target {
                if this.screens.has("new-session", cx) {
                    this.open_new_session(target, None, cx);
                } else {
                    this.notice = Some("No mod draws the New session screen.".into());
                }
            }
            cx.notify()
        });
        Self {
            sidebar,
            locate: None,
            tabs: Tabs::default(),
            panes: HashMap::new(),
            pending_split: None,
            settings: None,
            zoom: Zoom::default(),
            tick: 0,
            viewport_height: 0.0,
            peek: None,
            leader: None,
            resizing: None,
            history: History::default(),
            notice: None,
            armed_close: None,
            room: Rc::new(Cell::new(None)),
            clipboard: Rc::new(SystemClipboard),
            opener: Rc::new(open_in_system),
            screens: Screens::default(),
            screen_focus: cx.focus_handle(),
            root_focus: cx.focus_handle(),
            notifications: Vec::new(),
            next_notification: 0,
            new_tab_asks: 0,
            start_place: None,
            add_project: json!({ "status": "idle" }),
            add_project_asks: (0, None),
            worktree_request: Value::Null,
            worktree_requests: 0,
            keyboard_held: None,
            drag: None,
            follow: None,
            pointer: Value::Null,
            drop_boxes: Rc::default(),
            activation: None,
            _subscriptions: vec![opened, failed, observed],
        }
    }

    /// Attach the terminals of opened sessions to the core `locate` finds. Without it the main
    /// area never touches the network.
    pub fn with_core(mut self, locate: impl Fn() -> anyhow::Result<Core> + 'static) -> Self {
        self.locate = Some(Box::new(locate));
        self
    }

    /// Copy and paste through `clipboard` instead of the system's.
    pub fn with_clipboard(mut self, clipboard: Rc<dyn Clipboard>) -> Self {
        self.clipboard = clipboard;
        self
    }

    /// Open clicked links with `opener` instead of the system's handler.
    pub fn with_opener(mut self, opener: Rc<dyn Fn(&Target)>) -> Self {
        self.opener = opener;
        self
    }

    pub fn sidebar(&self) -> &Entity<Sidebar> {
        &self.sidebar
    }

    pub fn tabs(&self) -> &Tabs {
        &self.tabs
    }

    /// The terminal of the tab with the keyboard, if one was attached.
    pub fn terminal(&self) -> Option<&Entity<TerminalView>> {
        self.panes.get(self.tabs.active()?)?.view.as_ref()
    }

    /// The terminal of any open tab, on screen or not: it stays attached while its tab is kept.
    pub fn view(&self, id: &str) -> Option<&Entity<TerminalView>> {
        self.panes.get(id)?.view.as_ref()
    }

    /// The terminals on screen, in layout order, with their sessions.
    pub fn terminals(&self) -> Vec<(String, Entity<TerminalView>)> {
        self.tabs
            .shown()
            .into_iter()
            .filter_map(|id| {
                let view = self.panes.get(&id)?.view.clone()?;
                Some((id, view))
            })
            .collect()
    }

    /// What is known of each open tab's terminal (`perch.terminals()`' `state`): `running` while
    /// it is attached, `exited` once the core said its shell ended. A tab missing here is unknown:
    /// attaching, reattaching, parked or never attached.
    pub fn terminal_states(&self, cx: &App) -> HashMap<String, &'static str> {
        self.panes
            .iter()
            .filter_map(|(id, pane)| {
                let state = match pane.view.as_ref()?.read(cx).status() {
                    Status::Live => "running",
                    Status::Exited(_) => "exited",
                    _ => return None,
                };
                Some((id.clone(), state))
            })
            .collect()
    }

    /// The session of the tab with the keyboard.
    pub fn open(&self) -> Option<&OpenSession> {
        Some(&self.panes.get(self.tabs.active()?)?.open)
    }

    /// The session peeked at, when there is one.
    pub fn peeked(&self) -> Option<&str> {
        self.peek.as_deref()
    }

    pub fn settings_open(&self) -> bool {
        self.settings.is_some()
    }

    pub fn leader_armed(&self) -> bool {
        self.leader.is_some()
    }

    pub fn resize_armed(&self) -> bool {
        self.resizing.is_some()
    }

    /// What the last command could not do, or did instead.
    pub fn notice(&self) -> Option<&str> {
        self.notice.as_deref()
    }

    /// The terminals' zoom factor (1 is 100%).
    pub fn zoom_factor(&self) -> f32 {
        self.zoom.factor()
    }

    /// How many times the tab strip was asked for a new tab.
    pub fn new_tab_asks(&self) -> u64 {
        self.new_tab_asks
    }

    /// How many times the sidebar was asked for its Add project form, and when last.
    pub fn add_project_asks(&self) -> (u64, Option<Instant>) {
        self.add_project_asks
    }

    /// The last Add project request, as `useAddProject` reads it.
    pub fn add_project_state(&self) -> &Value {
        &self.add_project
    }

    /// Asks the sidebar to open its Add project form (the web's `ADD_PROJECT_EVENT`), showing a
    /// hidden sidebar first. With no sidebar mod there is no form to open.
    fn ask_add_project(&mut self, cx: &mut Context<Self>) -> Result<(), String> {
        if !self.screens.has("sidebar", cx) {
            return Err("No mod draws the sidebar, whose form adds a project.".into());
        }
        if !self.sidebar.read(cx).visible() {
            self.sidebar
                .update(cx, |sidebar, cx| sidebar.run_action("global.sidebar", cx));
        }
        self.add_project_asks = (self.add_project_asks.0 + 1, Some(Instant::now()));
        cx.notify();
        Ok(())
    }

    /// The last request for a project's worktree menu, null once taken.
    pub fn worktree_request(&self) -> &Value {
        &self.worktree_request
    }

    /// The worktree menu took its request.
    pub fn take_worktree_request(&mut self, cx: &mut Context<Self>) {
        if !self.worktree_request.is_null() {
            self.worktree_request = Value::Null;
            cx.notify();
        }
    }

    /// Asks the worktree menu of `project_key` (`host:repoPath`) to open (on its create form with
    /// `create`), or to ask before removing `remove`, showing a hidden sidebar first.
    fn request_worktree_menu(
        &mut self,
        project_key: String,
        remove: Option<Value>,
        create: bool,
        cx: &mut Context<Self>,
    ) {
        if !self.sidebar.read(cx).visible() {
            self.sidebar
                .update(cx, |sidebar, cx| sidebar.run_action("global.sidebar", cx));
        }
        self.worktree_requests += 1;
        let mut request = json!({ "projectKey": project_key, "nonce": self.worktree_requests });
        if let Some(remove) = remove {
            request["remove"] = remove;
        }
        if create {
            request["create"] = json!(true);
        }
        self.worktree_request = request;
        cx.notify();
    }

    /// The git checkout on screen as its worktree menu is keyed (`host:repoPath`): the shown
    /// workspace's project, else the shown session's folder (the web's `activeRepoKey`).
    fn active_repo_key(&self, cx: &App) -> Option<String> {
        let model = self.sidebar.read(cx).model();
        let store = &model.store;
        let session = self
            .tabs
            .active()
            .and_then(|id| store.sessions.iter().find(|s| s.id == id));
        let workspace = screens::mods(cx)
            .and_then(|(_, perch)| perch.shown_place().1)
            .or_else(|| session.and_then(|s| s.workspace_id.clone()))
            .and_then(|id| store.workspaces.iter().find(|w| w.id == id));
        let owner = workspace.and_then(|w| store.projects.iter().find(|p| p.id == w.project_id));
        if let Some(project) = owner {
            if let Some(repo) = project.repo_path.as_deref().filter(|r| !r.is_empty()) {
                return Some(format!("{}:{repo}", project.host_id));
            }
        }
        session
            .filter(|s| !s.cwd.is_empty())
            .map(|s| format!("{}:{}", s.host_id, s.cwd))
    }

    /// Puts a screen's question `frame` ([`crate::client::ask_frame`]) to the core: a folder
    /// listing, Instructions, Project memory. The receiver is dropped unanswered when no core is
    /// followed.
    pub fn ask(
        &self,
        frame: Value,
        cx: &App,
    ) -> futures::channel::oneshot::Receiver<Result<Value, String>> {
        let (reply, answer) = futures::channel::oneshot::channel();
        self.sidebar.read(cx).send(Command::Ask { frame, reply });
        answer
    }

    /// Registers `path` on `host_id` as a project, as the sidebar's Add project form does
    /// (`useAddProject().add`): pending until the core answers, then success or its error. Ignored
    /// while one is pending.
    pub fn add_project(
        &mut self,
        host_id: &str,
        path: &str,
        name: Option<String>,
        cx: &mut Context<Self>,
    ) {
        let path = path.trim().to_string();
        if path.is_empty() || self.add_project["status"] == "pending" {
            return;
        }
        let host_id = host_id.to_string();
        self.add_project = json!({ "status": "pending", "hostId": host_id });
        let (reply, answer) = futures::channel::oneshot::channel();
        self.sidebar.read(cx).send(Command::AddProject {
            host_id: host_id.clone(),
            path,
            name: name.map(|n| n.trim().to_string()).filter(|n| !n.is_empty()),
            reply,
        });
        cx.spawn(async move |this, cx| {
            let state = match answer.await {
                Ok(Ok(_)) => json!({ "status": "success", "hostId": host_id }),
                Ok(Err(error)) => json!({ "status": "error", "hostId": host_id, "error": error }),
                Err(_) => json!({ "status": "error", "hostId": host_id,
                    "error": "Connection lost. Check the server and retry." }),
            };
            let _ = this.update(cx, |this, cx| {
                this.add_project = state;
                cx.notify();
            });
        })
        .detach();
        cx.notify();
    }

    /// Forgets the last Add project answer (`useAddProject().clear`).
    pub fn clear_add_project(&mut self, cx: &mut Context<Self>) {
        self.add_project = json!({ "status": "idle" });
        cx.notify();
    }

    /// The copy of an in-flow mod under key `id`, in its `load`th load, says whether one of its
    /// own fields has the keyboard. The hold goes with that copy: when it is no longer drawn or
    /// loads again, the window lets go of it (see [`Self::let_go_of_stale_hold`]).
    pub fn hold_keyboard(&mut self, id: &str, load: u64, held: bool, cx: &mut Context<Self>) {
        let now = if held {
            Some((id.to_string(), load))
        } else if self
            .keyboard_held
            .as_ref()
            .is_some_and(|(key, _)| key == id)
        {
            None
        } else {
            return;
        };
        if self.keyboard_held != now {
            self.keyboard_held = now;
            cx.notify();
        }
    }

    /// Whether a field of an in-flow mod holds the keyboard.
    pub fn keyboard_held(&self) -> bool {
        self.keyboard_held.is_some()
    }

    /// A hold whose copy is no longer drawn (`wanted`), or has loaded again, holds nothing: the
    /// copy that asked for it cannot let go any more.
    fn let_go_of_stale_hold(&mut self, wanted: &[(&'static str, String, Value)], cx: &App) {
        let stale = self.keyboard_held.as_ref().is_some_and(|(key, load)| {
            !wanted.iter().any(|(_, k, _)| k == key)
                || screens::mods(cx).is_some_and(|(_, perch)| perch.loads(key) != *load)
        });
        if stale {
            self.keyboard_held = None;
        }
    }

    /// The notifications not yet dismissed, oldest first.
    pub fn notifications(&self) -> &[Notification] {
        &self.notifications
    }

    /// The floating screens open, bottom first.
    pub fn screens_open(&self) -> Vec<&'static str> {
        self.screens.floating.iter().map(|f| f.id).collect()
    }

    /// The in-flow screen `key` on screen (`sidebar`, `tabs`, `pane-header#<id>`), when a mod draws it.
    pub fn screen_view(&self, key: &str) -> Option<Entity<crate::mods::ModView>> {
        self.screens.inflow(key)
    }

    /// The props an open floating screen was given.
    pub fn screen_props(&self, id: &str) -> Option<&Value> {
        self.screens.props(id)
    }

    /// Opens floating screen `id` (`dialog`, `confirm`, ...) with `props`, at `at` for a menu;
    /// `on_result` gets what it closes with (`null` when dismissed). False when no mod draws it.
    pub fn open_screen(
        &mut self,
        id: &str,
        props: Value,
        at: Option<Point<Pixels>>,
        on_result: Option<OnResult>,
        cx: &mut Context<Self>,
    ) -> bool {
        let opened = self.screens.open(id, props, at, on_result, cx);
        if opened {
            cx.notify();
        }
        opened
    }

    /// Gives an open floating screen new props; it re-renders. False when it is not open.
    pub fn update_screen(&mut self, id: &str, props: Value, cx: &mut Context<Self>) -> bool {
        self.screens.update(id, props, cx)
    }

    /// A floating screen closed itself with `result`, or was dismissed (`null`): the keyboard
    /// goes back to what had it, then what it was opened for runs.
    pub fn screen_closed(
        &mut self,
        id: &str,
        result: Value,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let Some(open) = self.screens.take(id, cx) else {
            // The start page is in flow: what it closes with is an action, and it stays.
            if id == "start" {
                let outcome = self.start_result(&result, window, cx);
                self.finish(outcome, cx);
            }
            return;
        };
        if let Some(handle) = open.focus_back {
            handle.focus(window, cx);
        }
        if let Some(then) = open.on_result {
            then(self, result, window, cx);
        }
        cx.notify();
    }

    // Screens a mod draws: their props, and what their results do.

    /// `NavigatorScreenProps`, as far as this window has its data.
    fn navigator_props(&self, cx: &App) -> Value {
        let model = self.sidebar.read(cx).model();
        let store = &model.store;
        let current = self.tabs.active().map(str::to_string);
        let session = current
            .as_ref()
            .and_then(|id| store.sessions.iter().find(|s| s.id == *id));
        let workspace = session
            .and_then(|s| s.workspace_id.as_ref())
            .and_then(|id| store.workspaces.iter().find(|w| w.id == *id))
            .map(|w| json!({ "id": w.id, "path": w.path }));
        let cwd = session.map(|s| s.current_cwd.clone().unwrap_or_else(|| s.cwd.clone()));
        let sessions: Vec<Value> = store
            .sessions
            .iter()
            .map(|s| {
                json!({
                    "id": s.id, "title": s.title, "cwd": s.cwd, "hostId": s.host_id,
                    "createdAt": s.created_at, "state": crate::mods::perch::session_state(s),
                })
            })
            .collect();
        let agents: Vec<Value> = self
            .launch_choices(LOCAL, cx)
            .iter()
            .map(|p| json!({ "id": p.id, "label": p.name }))
            .collect();
        json!({
            "open": true,
            "sessions": sessions,
            "currentSessionId": current,
            "connected": model.connected,
            "workspace": workspace,
            "supportsSearch": false,
            "supportsRun": false,
            "agents": agents,
            "agentCwd": cwd,
            "terminalCwd": cwd,
        })
    }

    /// What the Navigator closed with: one of its `actions`, or a command.
    fn navigator_result(
        &mut self,
        result: &Value,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Result<(), String> {
        let (action, args) = action_of(result);
        match action.as_deref() {
            None => match result.get("command").and_then(Value::as_str) {
                Some(command) => {
                    let args = result.get("args").cloned();
                    self.run_command(command, args.as_ref(), window, cx)
                }
                None => Ok(()),
            },
            Some("switchTo") => {
                let id = word(&args, 0).ok_or("switchTo needs a session id.")?;
                self.show_session(&id, cx)
            }
            Some("newTerminal") => self.split(Side::Right, cx),
            Some("startAgent") => {
                let agent = word(&args, 0).ok_or("startAgent needs an agent id.")?;
                self.sidebar
                    .update(cx, |sidebar, cx| sidebar.launch(&agent, cx))
            }
            Some(other) => Err(format!("The native window cannot {other} yet.")),
        }
    }

    /// `PaneMenuScreenProps` for pane `id`.
    fn open_pane_menu(
        &mut self,
        id: &str,
        at: Point<Pixels>,
        can_stop: bool,
        cx: &mut Context<Self>,
    ) {
        let props = json!({
            "panelId": id,
            "title": self.title_of(id, cx),
            "x": f32::from(at.x),
            "y": f32::from(at.y),
            // Every native pane shows a session, so "Show beside an open tab" is offered.
            "sessionId": id,
            "canClose": true,
            "maximized": self.tabs.zoomed(),
            "canStopAgent": can_stop,
        });
        let target = id.to_string();
        self.open_screen(
            "pane-menu",
            props,
            Some(at),
            Some(Box::new(move |this, result, window, cx| {
                let outcome = this.menu_result(&target, at, &result, window, cx);
                this.finish(outcome, cx);
            })),
            cx,
        );
    }

    /// Tab `id`'s menu at `at`, the `tab-menu` screen (`TabSplitMenu`'s props): what may be done
    /// with the tab, and the open tabs a split can take.
    fn open_tab_menu(&mut self, id: &str, at: Point<Pixels>, cx: &mut Context<Self>) {
        if !self.screens.has("tab-menu", cx) {
            self.notice = Some(
                "No mod draws the tab menu. The stock one is restored when the app starts.".into(),
            );
            cx.notify();
            return;
        }
        let extra = crate::mods::perch::inbound_items(&self.sidebar.read(cx).model().store, id);
        let strip = self.tabs.strip().to_vec();
        let props = self.tab_menu_props(id, &strip, at, extra, cx);
        let target = id.to_string();
        self.open_screen(
            "tab-menu",
            props,
            Some(at),
            Some(Box::new(move |this, result, window, cx| {
                let outcome = this.menu_result(&target, at, &result, window, cx);
                this.finish(outcome, cx);
            })),
            cx,
        );
    }

    /// A sidebar row's menu (`SessionMenu`: `{id, x, y, extraItems}`), the tab menu for that
    /// session whether or not it has a tab here. The window runs the tab's actions and the
    /// session's inbound choices; `on_result` then gets the result, so a row of the caller's own
    /// (`{item}`) is the caller's. `false` when no mod draws it or the session is unknown.
    pub fn open_session_menu(
        &mut self,
        menu: &Value,
        on_result: OnResult,
        cx: &mut Context<Self>,
    ) -> bool {
        let Some(id) = menu["id"].as_str().map(str::to_string) else {
            return false;
        };
        let store = self.sidebar.read(cx).model().store.clone();
        if !store.sessions.iter().any(|s| s.id == id) {
            return false;
        }
        let coordinate = |key: &str| px(menu[key].as_f64().unwrap_or(0.) as f32);
        let at = point(coordinate("x"), coordinate("y"));
        let mut extra = menu["extraItems"].as_array().cloned().unwrap_or_default();
        extra.extend(crate::mods::perch::inbound_items(&store, &id));
        let mates = crate::mods::perch::workspace_mates(&store, self.tabs.strip(), &id);
        let props = self.tab_menu_props(&id, &mates, at, extra, cx);
        self.open_screen(
            "tab-menu",
            props,
            Some(at),
            Some(Box::new(move |this, result, window, cx| {
                let outcome = this.menu_result(&id, at, &result, window, cx);
                this.finish(outcome, cx);
                on_result(this, result, window, cx);
            })),
            cx,
        )
    }

    /// The tab menu's props for tab (or session) `id` at `at`, offering `among`, with `extra`
    /// rows.
    fn tab_menu_props(
        &self,
        id: &str,
        among: &[String],
        at: Point<Pixels>,
        extra: Vec<Value>,
        cx: &App,
    ) -> Value {
        let can_stop = self
            .panes
            .get(id)
            .and_then(|p| p.view.as_ref())
            .is_some_and(|view| view.read(cx).can_stop());
        crate::mods::perch::tab_menu_props(
            &self.tabs,
            among,
            id,
            (f32::from(at.x), f32::from(at.y)),
            &|tab| self.title_of(tab, cx),
            can_stop,
            extra,
        )
    }

    /// The Split with session picker (`SessionSplitProps`) at `at`, opened from pane `target`'s
    /// menu: every other session, those with a tab marked open. The one picked shows beside
    /// `target`, on its right.
    fn open_session_split(&mut self, target: &str, at: Point<Pixels>, cx: &mut Context<Self>) {
        let sessions: Vec<Value> = self
            .sidebar
            .read(cx)
            .model()
            .store
            .sessions
            .iter()
            .filter(|s| s.id != target)
            .map(|s| {
                json!({
                    "id": s.id,
                    "title": s.title,
                    "cwd": s.current_cwd.clone().unwrap_or_else(|| s.cwd.clone()),
                    "open": self.tabs.contains(&s.id),
                })
            })
            .collect();
        let props = json!({ "sessions": sessions, "x": f32::from(at.x), "y": f32::from(at.y) });
        let target = target.to_string();
        let opened = self.open_screen(
            "session-split",
            props,
            Some(at),
            Some(Box::new(move |this, result, _, cx| {
                let Some(pick) = result.get("pick").and_then(Value::as_str) else {
                    return;
                };
                let outcome = this.show_beside(&target, pick, Side::Right, cx);
                this.finish(outcome, cx);
            })),
            cx,
        );
        if !opened {
            self.notice = Some("No mod draws the Split with session picker.".into());
            cx.notify();
        }
    }

    /// Opens session `id`'s tab now, shown and active (`show_session` asks the sidebar, which
    /// opens it a turn later): for an action that goes on to arrange it.
    fn open_tab(&mut self, id: &str, cx: &mut Context<Self>) -> Result<(), String> {
        let open = self
            .sidebar
            .read(cx)
            .session_to_open(id)
            .ok_or("That session is gone.")?;
        self.ensure_pane(&open, cx);
        self.tabs.open(id);
        Ok(())
    }

    /// The session `id` names, when the core has it.
    fn known_session(&self, id: Option<&str>, cx: &App) -> Result<String, String> {
        let id = id.ok_or("This command needs {id}.")?;
        let model = self.sidebar.read(cx).model();
        model
            .store
            .sessions
            .iter()
            .any(|s| s.id == id)
            .then(|| id.to_string())
            .ok_or_else(|| format!("There is no session {id}."))
    }

    fn known_project(&self, id: &str, cx: &App) -> Result<(), String> {
        let model = self.sidebar.read(cx).model();
        model
            .store
            .projects
            .iter()
            .any(|p| p.id == id)
            .then_some(())
            .ok_or_else(|| format!("There is no project {id}."))
    }

    fn known_workspace(&self, id: Option<&str>, cx: &App) -> Result<String, String> {
        let id = id.ok_or("This command needs {id}.")?;
        let model = self.sidebar.read(cx).model();
        model
            .store
            .workspaces
            .iter()
            .any(|w| w.id == id)
            .then(|| id.to_string())
            .ok_or_else(|| format!("There is no workspace {id}."))
    }

    /// The pointer moved during a press on a tab: once it is a drag, where a drop would land,
    /// drawn by the `tab-drag` screen.
    /// The tab drag in flight as the strip slides its tabs for it (`TabDrag::slide`).
    pub fn tab_slide(&self) -> Value {
        self.drag.as_ref().map_or(Value::Null, TabDrag::slide)
    }

    /// The pointer as last forwarded for a press a mod follows (`pointerFollow()`).
    pub fn pointer_follow(&self) -> &Value {
        &self.pointer
    }

    /// Forwards the pointer to the mod following the press: `move` while it lasts, then `up`
    /// where it was let go or `cancel`, after which nothing more is forwarded. False when no
    /// press is followed.
    fn forward_pointer(&mut self, phase: &str, at: Point<Pixels>, cx: &mut Context<Self>) -> bool {
        let Some(token) = self.follow.clone() else {
            return false;
        };
        if phase != "move" {
            self.follow = None;
        }
        let seq = self.pointer["seq"].as_u64().map_or(0, |n| n + 1);
        self.pointer = json!({
            "token": token,
            "seq": seq,
            "phase": phase,
            "x": f32::from(at.x),
            "y": f32::from(at.y),
        });
        cx.notify();
        true
    }

    /// A followed press ends with nothing changed (Escape, the window losing focus), where the
    /// pointer last was.
    fn cancel_follow(&mut self, cx: &mut Context<Self>) -> bool {
        let at = point(
            px(self.pointer["x"].as_f64().unwrap_or(0.) as f32),
            px(self.pointer["y"].as_f64().unwrap_or(0.) as f32),
        );
        self.forward_pointer("cancel", at, cx)
    }

    fn drag_moved(&mut self, at: Point<Pixels>, cx: &mut Context<Self>) {
        let Some(drag) = self.drag.as_mut() else {
            return;
        };
        if !drag.moved(at) {
            return;
        }
        let boxes = self.drop_boxes.borrow();
        let on_strip = boxes.strip.is_some_and(|b| b.contains(&at))
            && drag.spans.iter().any(|s| s.id == drag.id);
        drag.drop = if on_strip {
            Drop::Strip(drag.slot(f32::from(at.x)))
        } else {
            let pane = boxes
                .panes
                .iter()
                .find(|(id, b)| **id != drag.id && b.contains(&at));
            match pane {
                Some((target, pane)) => match tab_drag::resolve_zone(*pane, at) {
                    Some(side) => Drop::Pane {
                        target: target.clone(),
                        pane: *pane,
                        side: self.tabs.can_drop(&drag.id, target).then_some(side),
                    },
                    None => Drop::None,
                },
                None => Drop::None,
            }
        };
        let props = drag.props();
        drop(boxes);
        if !self.screens.update("tab-drag", props.clone(), cx) {
            self.screens.open("tab-drag", props, None, None, cx);
        }
        cx.notify();
    }

    /// The press on a tab ends: let go (`apply`), the drop it was over is made; Escape, the
    /// window losing focus or a lost release (`!apply`) changes nothing. A press that never
    /// became a drag is a click, which the strip handles.
    fn drag_ended(&mut self, apply: bool, cx: &mut Context<Self>) -> bool {
        let Some(drag) = self.drag.take() else {
            return false;
        };
        self.screens.take("tab-drag", cx);
        cx.notify();
        // The tab (or the pane it was over) may have closed during the drag.
        if !drag.started || !apply || !self.tabs.contains(&drag.id) {
            return drag.started;
        }
        match drag.drop {
            Drop::Strip(Some(slot)) => {
                self.tabs.move_tab(&drag.id, slot + 1);
            }
            Drop::Pane {
                target,
                side: Some(side),
                ..
            } if self.tabs.contains(&target) && self.tabs.drop_beside(&drag.id, &target, side) => {
                self.after_change(cx);
            }
            _ => {}
        }
        true
    }

    /// Show session `id` on the `side` of tab `target`, its tab opened first when it has none;
    /// it leaves any other split. The keyboard goes to it.
    fn show_beside(
        &mut self,
        target: &str,
        id: &str,
        side: Side,
        cx: &mut Context<Self>,
    ) -> Result<(), String> {
        if !self.tabs.contains(target) {
            return Err(format!("Tab {target} is gone."));
        }
        let full = || Err("A split holds at most four panes.".to_string());
        if self.tabs.contains(id) {
            if !self.tabs.drop_beside(id, target, side) {
                return full();
            }
        } else {
            if !self.tabs.room_beside(target) {
                return full();
            }
            self.open_tab(id, cx)?;
            self.tabs.drop_beside(id, target, side);
        }
        self.after_change(cx);
        Ok(())
    }

    /// What a pane or tab menu closed with, run on tab `id`: one of the web's `actions`
    /// (`{action, args}`), or a row of the tab menu's `extraItems` (`{item}`).
    fn menu_result(
        &mut self,
        id: &str,
        at: Point<Pixels>,
        result: &Value,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Result<(), String> {
        let (action, args) = action_of(result);
        // A row of the session's inbound choices (`extraItems`).
        if let Some(item) = result.get("item").and_then(Value::as_str) {
            let store = self.sidebar.read(cx).model().store.clone();
            if let Some(mode) = crate::mods::perch::inbound_choice(&store, id, item) {
                self.sidebar.read(cx).send(Command::InboundMode {
                    session_id: id.to_string(),
                    mode: mode.to_string(),
                });
            }
            return Ok(());
        }
        let Some(action) = action else {
            return Ok(());
        };
        // A session menu's session may have no tab: renaming and closing need none, a split opens
        // its tab first (the web shows it, then splits); the rest are only offered for a tab.
        if !self.tabs.contains(id) {
            match action.as_str() {
                "rename" | "close" => {}
                "splitNew" | "showBeside" => self.open_tab(id, cx)?,
                _ => return Err(format!("Tab {id} is gone.")),
            }
        }
        // As the web's menus: an action that works on the focused tab gives it the keyboard first;
        // the others (rename, close, the pickers) leave the keyboard where it is.
        let focused = matches!(action.as_str(), "splitNew" | "toggleZoom" | "stopAgent");
        if focused {
            self.focus_pane(id, cx);
        }
        let tab = json!({ "id": id });
        match action.as_str() {
            "splitNew" => match word(&args, 0).as_deref() {
                Some("right") => self.split(Side::Right, cx),
                Some("below") => self.split(Side::Down, cx),
                _ => Err(r#"splitNew takes "right" or "below"."#.into()),
            },
            "toggleZoom" => self.run_command("panes.zoom", None, window, cx),
            "rename" => {
                let name = word(&args, 0).ok_or("rename needs a name.")?;
                self.run_command(
                    "tab.rename",
                    Some(&json!({ "id": id, "name": name })),
                    window,
                    cx,
                )
            }
            // The menu's own tab, whichever has the keyboard by now.
            "stopAgent" => self.run_command("terminal.kill", Some(&tab), window, cx),
            "showFull" => self.run_command("pane.unsplit", Some(&tab), window, cx),
            "splitSession" => {
                self.open_session_split(id, at, cx);
                Ok(())
            }
            "showBesideTab" => {
                let coordinate =
                    |i: usize| args.get(i).and_then(Value::as_f64).map(|v| px(v as f32));
                let at = coordinate(0)
                    .zip(coordinate(1))
                    .map_or(at, |(x, y)| point(x, y));
                self.open_tab_menu(id, at, cx);
                Ok(())
            }
            "showBeside" => {
                let other = word(&args, 0).ok_or("showBeside needs a tab id.")?;
                // A session menu offers its workspace's sessions, with a tab or not.
                if !self.tabs.contains(&other) {
                    self.open_tab(&other, cx)?;
                }
                if !self.tabs.join(id, &other) {
                    return Err("Those tabs cannot be shown together.".into());
                }
                self.tabs.show(id);
                self.after_change(cx);
                Ok(())
            }
            "separateAll" => {
                self.tabs.untile(id);
                self.tabs.show(id);
                self.after_change(cx);
                Ok(())
            }
            "close" if self.tabs.contains(id) => {
                self.run_command("tabs.close", Some(&tab), window, cx)
            }
            "close" => self.run_command("session.request_close", Some(&tab), window, cx),
            other => Err(format!("The native window cannot {other} yet.")),
        }
    }

    /// `StartScreenProps`, as the web's `StartScreen` works them out: `connecting` while the core
    /// is away, the focused workspace's start picker when one is focused with no session of it on
    /// screen, else `home`. The place chosen in the picker is the window's (`start_place`).
    fn start_props(&self, cx: &App) -> Value {
        let model = self.sidebar.read(cx).model();
        let store = &model.store;
        let (host_id, focused) = screens::mods(cx)
            .map(|(_, perch)| perch.shown_place())
            .unwrap_or_else(|| (LOCAL.to_string(), None));
        let host = model.hosts.iter().find(|h| h.id == host_id);
        let choices: Vec<Value> = host
            .map(|h| {
                h.providers
                    .iter()
                    .map(|p| json!({ "id": p.id, "label": p.name }))
                    .collect()
            })
            .unwrap_or_default();
        // The app's logo, from the start mod's folder (written out with it).
        let logo = screens::mods(cx)
            .and_then(|(host, _)| host.file("start", "perch-logo.webp"))
            .map_or(String::new(), |p| p.to_string_lossy().into_owned());
        let base = |kind: &str| {
            json!({
                "kind": kind, "hostId": host_id, "logo": logo, "projectCwds": [],
                "targets": [], "targetKey": "", "choices": [], "discovery": null,
                "disabled": kind == "connecting", "canManageAgents": false,
            })
        };
        if !store.connected {
            return base("connecting");
        }
        let Some(workspace) = focused.and_then(|id| store.workspaces.iter().find(|w| w.id == id))
        else {
            // New session offers the project a session would start in (the sidebar's target).
            let mut props = base("home");
            let project = host.and_then(|host| {
                host.projects
                    .iter()
                    .find(|p| crate::actions::startable(host, p) && !p.quickchat)
            });
            props["projectCwds"] = json!(project.map(|p| vec![p.path.clone()]).unwrap_or_default());
            return props;
        };
        let basename = |path: &str| {
            path.rsplit('/')
                .find(|part| !part.is_empty())
                .unwrap_or(path)
                .to_string()
        };
        let projects: Vec<_> = store
            .projects
            .iter()
            .filter(|p| p.host_id == workspace.host_id)
            .collect();
        let own = projects
            .iter()
            .find(|p| p.id == workspace.project_id && p.path == workspace.path)
            .map(|p| p.name.clone());
        // Quickchat sessions run in the home folder, so that is what it shows.
        let quickchat = workspace.path.ends_with("/.perch/scratch");
        let name = if quickchat {
            "Quickchat".to_string()
        } else {
            Some(workspace.name.clone())
                .filter(|n| !n.is_empty())
                .or(own.filter(|n| !n.is_empty()))
                .unwrap_or_else(|| basename(&workspace.path))
        };
        let path = if quickchat {
            "~"
        } else {
            workspace.path.as_str()
        };
        let mut targets = vec![json!({
            "key": workspace.path, "label": format!("{name} (current folder)"), "name": name, "path": path,
        })];
        for p in projects.iter().filter(|p| p.path != workspace.path) {
            let label = Some(p.name.clone())
                .filter(|n| !n.is_empty())
                .unwrap_or_else(|| basename(&p.path));
            targets.push(json!({ "key": p.path, "label": label, "name": label, "path": p.path }));
        }
        if !quickchat {
            targets.push(json!({
                "key": "~", "label": "No project (Quickchat)", "name": "Quickchat", "path": "~",
            }));
        }
        let key = self
            .start_place
            .as_ref()
            .filter(|(id, key)| *id == workspace.id && targets.iter().any(|t| t["key"] == *key))
            .map_or_else(|| workspace.path.clone(), |(_, key)| key.clone());
        let mut props = base("workspace");
        props["hostId"] = json!(workspace.host_id);
        props["targets"] = json!(targets);
        props["targetKey"] = json!(key);
        props["choices"] = json!(choices);
        props
    }

    /// What the start page did (one of its `actions`).
    fn start_result(
        &mut self,
        result: &Value,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Result<(), String> {
        let (action, args) = action_of(result);
        let props = self.start_props(cx);
        let host = props["hostId"].as_str().unwrap_or(LOCAL).to_string();
        match action.as_deref() {
            None | Some("retry") => Ok(()),
            Some("choose") => {
                let key = word(&args, 0).ok_or("choose needs a place.")?;
                let workspace = screens::mods(cx).and_then(|(_, perch)| perch.shown_place().1);
                self.start_place = workspace.map(|id| (id, key));
                cx.notify();
                Ok(())
            }
            Some("start") => {
                let agent = word(&args, 0).ok_or("start needs an agent.")?;
                let cwd = props["targetKey"].as_str().map(str::to_string);
                self.start_session(&host, cwd, &agent, cx)
            }
            Some("startIn") => {
                let agent = word(&args, 1).ok_or("startIn needs an agent.")?;
                self.start_session(&host, word(&args, 0), &agent, cx)
            }
            Some("openSettings") => self.run_command("global.settings", None, window, cx),
            Some("manageAgents") => self.run_command("agents.manage", None, window, cx),
            Some("addProject") => self.ask_add_project(cx),
            Some(other) => Err(format!("The native window cannot {other} yet.")),
        }
    }

    /// The launcher (`LauncherProps`, as the web's `NewSessionDialog` builds them): `target`'s
    /// computer's projects but its Quickchat, each with the workspace a new tab lands in (the one on
    /// screen when it is the project's, else its first), the project of what is shown marked.
    fn open_launcher(&mut self, target: &crate::actions::NewSession, cx: &mut Context<Self>) {
        if self.screens.is_open("launcher") {
            return;
        }
        let shown = self.tabs.active().map(str::to_string);
        let model = self.sidebar.read(cx).model();
        let host = model.hosts.iter().find(|h| h.id == target.host_id);
        let projects: Vec<Value> = host
            .map(|host| {
                host.projects
                    .iter()
                    .filter(|p| !p.quickchat)
                    .map(|p| {
                        let workspace = crate::sidebar::navigation::landing_workspace(
                            &model.store,
                            &p.id,
                            shown.as_deref(),
                        )
                        .map(|(id, path)| json!({ "id": id, "path": path }));
                        json!({ "id": p.id, "name": p.name, "path": p.path, "workspace": workspace })
                    })
                    .collect()
            })
            .unwrap_or_default();
        let active = target
            .project_id
            .as_ref()
            .filter(|id| projects.iter().any(|p| p["id"] == json!(id)));
        let host_id = target.host_id.clone();
        self.open_screen(
            "launcher",
            json!({ "hostId": host_id, "projects": projects, "activeProjectId": active }),
            None,
            Some(Box::new(move |this, result, _, cx| {
                let outcome = this.launcher_result(&host_id, &result, cx);
                this.finish(outcome, cx);
            })),
            cx,
        );
    }

    /// What the launcher closed with (one of its `actions`), on computer `host_id`.
    fn launcher_result(
        &mut self,
        host_id: &str,
        result: &Value,
        cx: &mut Context<Self>,
    ) -> Result<(), String> {
        let (action, args) = action_of(result);
        match action.as_deref() {
            None => Ok(()),
            Some("start") => {
                let agent = word(&args, 1).ok_or("start needs an agent.")?;
                self.start_session(host_id, word(&args, 0), &agent, cx)
            }
            Some("openBrowser") => {
                Err("A browser tab does not open in the native window yet.".into())
            }
            // New file names the file in the files view's prompt, which this window lacks.
            Some("focusWorkspace") => Err(
                "A new file needs the files view, which the native window does not have yet."
                    .into(),
            ),
            Some("addProject") => self.ask_add_project(cx),
            Some(other) => Err(format!("The native window cannot {other} yet.")),
        }
    }

    /// The New session screen for `target` (`NewSessionScreenProps`), anchored at `at`.
    fn open_new_session(
        &mut self,
        target: crate::actions::NewSession,
        at: Option<Point<Pixels>>,
        cx: &mut Context<Self>,
    ) {
        let model = self.sidebar.read(cx).model();
        let cwds: Vec<String> = model
            .hosts
            .iter()
            .find(|h| h.id == target.host_id)
            .map(|host| {
                host.projects
                    .iter()
                    .filter(|p| crate::actions::startable(host, p) && !p.quickchat)
                    .map(|p| p.path.clone())
                    .collect()
            })
            .unwrap_or_default();
        let anchor = at.map_or(
            json!({ "x": 0, "y": 0, "width": 0, "height": 0 }),
            |at| json!({ "x": f32::from(at.x), "y": f32::from(at.y), "width": 0, "height": 0 }),
        );
        let host = target.host_id.clone();
        self.open_screen(
            "new-session",
            json!({ "hostId": host, "projectCwds": cwds, "anchorRect": anchor }),
            at,
            Some(Box::new(move |this, result, _, cx| {
                let Some(agent) = result.get("agent").and_then(Value::as_str) else {
                    return;
                };
                let cwd = result
                    .get("cwd")
                    .and_then(Value::as_str)
                    .map(str::to_string);
                let outcome = this.start_session(&host, cwd, agent, cx);
                this.finish(outcome, cx);
            })),
            cx,
        );
    }

    /// The web's `startSession`: `agent` in `cwd` on `host_id` (no folder: a Quickchat), over the
    /// launch the New session panel sends.
    fn start_session(
        &mut self,
        host_id: &str,
        cwd: Option<String>,
        agent: &str,
        cx: &mut Context<Self>,
    ) -> Result<(), String> {
        let sidebar = self.sidebar.read(cx);
        let host = sidebar
            .model()
            .hosts
            .iter()
            .find(|h| h.id == host_id)
            .ok_or_else(|| format!("No host {host_id}."))?;
        if !host.reachable {
            return Err(format!("{} cannot be reached now.", host.name));
        }
        if !host.providers.iter().any(|p| p.id == agent) {
            return Err(format!("{} cannot start {agent}.", host.name));
        }
        sidebar.send(Command::Launch {
            host_id: host_id.to_string(),
            cwd: cwd.filter(|c| !c.is_empty() && c != "~"),
            provider: agent.to_string(),
        });
        Ok(())
    }

    /// The in-flow copies a mod draws now: `(screen id, key, props)`.
    fn inflow_wanted(&self, cx: &App) -> Vec<(&'static str, String, Value)> {
        let mut wanted = Vec::new();
        let mut want = |id: &'static str, key: String, props: Value| {
            if self.screens.has(id, cx) {
                wanted.push((id, key, props));
            }
        };
        if self.sidebar.read(cx).visible() {
            want("sidebar", "sidebar".into(), json!({}));
        }
        if self.tabs.visible().is_some() {
            want("tabs", "tabs".into(), json!({}));
        }
        want("status", "status".into(), json!({}));
        if self.tabs.visible().is_none() {
            want("start", "start".into(), self.start_props(cx));
        }
        let shown = self.tabs.shown();
        if shown.len() > 1 {
            for id in &shown {
                want(
                    "pane-header",
                    format!("pane-header#{id}"),
                    json!({ "id": id, "corner": false }),
                );
            }
        }
        // Over each terminal on screen: the agent's chip, error line and ended banner while it
        // has one, its find bar while find is open, and the phone-size notice while a phone
        // holds its size and this window may take it back.
        for id in shown {
            let Some(view) = self.panes.get(&id).and_then(|p| p.view.as_ref()) else {
                continue;
            };
            let view = view.read(cx);
            let mut control = view.agent_control();
            if ["label", "error", "ended"]
                .iter()
                .any(|key| !control[key].is_null())
            {
                control["id"] = json!(id);
                want("agent-control", format!("agent-control#{id}"), control);
            }
            if view.find_open() {
                want(
                    "terminal-search",
                    format!("terminal-search#{id}"),
                    json!({ "id": id, "query": view.find_query() }),
                );
            }
            if view.offers_take_back() {
                want(
                    "phone-size",
                    format!("phone-size#{id}"),
                    json!({ "id": id, "generation": view.phone_holds(), "pending": view.taking() }),
                );
            }
        }
        wanted
    }

    /// A floating screen over the whole window. A modal one is on a layer that keeps the mouse
    /// from what is beneath and holds the keyboard; the mod draws its own backdrop and closes
    /// itself on a press outside its panel. The toast's layer takes nothing: only what the mod
    /// draws, and stops, does.
    fn floating_view(&self, open: &screens::Floating) -> Option<AnyElement> {
        let view = open.view.clone()?;
        let layer = div().absolute().inset_0().child(view);
        if !open.modal() {
            return Some(layer.into_any_element());
        }
        Some(
            layer
                .id(SharedString::from(format!("screen-layer-{}", open.id)))
                .track_focus(&self.screen_focus)
                .occlude()
                .into_any_element(),
        )
    }

    /// The pane for session `event` names, made (its terminal attached) when there is none.
    fn ensure_pane(&mut self, event: &OpenSession, cx: &mut Context<Self>) {
        if self.panes.contains_key(&event.session_id) {
            return;
        }
        let view = self.attach(event, cx);
        self.panes.insert(
            event.session_id.clone(),
            Pane {
                open: event.clone(),
                view,
                settle: Settle::default(),
                retry: None,
                attempts: 0,
                closing: None,
                seen: 0,
                parked: false,
            },
        );
    }

    /// A session was picked in the sidebar, launched, or a tab was chosen: show it.
    fn on_open(&mut self, event: &OpenSession, cx: &mut Context<Self>) {
        let id = event.session_id.clone();
        let side = self
            .pending_split
            .take()
            .filter(|(_, at)| at.elapsed() < SPLIT_WAIT)
            .filter(|_| self.sidebar.read(cx).launched() == Some(id.as_str()))
            .filter(|_| !self.tabs.contains(&id))
            .map(|(side, _)| side);
        self.ensure_pane(event, cx);
        match side {
            Some(side) if self.tabs.split(&id, side) => {}
            Some(_) => {
                self.notice = Some("The split is full: it opened as a tab.".into());
                self.tabs.open(&id);
            }
            None => self.tabs.open(&id),
        }
        self.keep_in_bounds(cx);
        self.note_shown();
        cx.notify();
    }

    /// A terminal for `open`: attached to the core `locate` finds, or showing why it cannot be.
    fn attach(&self, open: &OpenSession, cx: &mut Context<Self>) -> Option<Entity<TerminalView>> {
        let located = self.locate.as_ref()?();
        let clipboard = self.clipboard.clone();
        let view = cx.new(|cx| match located {
            Ok(core) => TerminalView::attach(core, open, cx),
            Err(error) => {
                let mut view = TerminalView::new(cx);
                view.core_said(FromCore::Failed(format!("{error:#}")), cx);
                view
            }
        });
        // Only a window that is on screen copies and pastes with the system's clipboard, and its
        // keymap, not the view, decides what the Command chords do.
        let zoom = self.zoom.factor();
        view.update(cx, |view, cx| {
            view.set_clipboard(clipboard);
            view.set_hosted(true);
            view.set_zoom(zoom, cx);
        });
        view.update(cx, |view, _| view.expect_reconnect(true));
        let choices = self.launch_choices(&open.host_id, cx);
        view.update(cx, |view, cx| view.set_choices(choices, cx));
        let id = open.session_id.clone();
        cx.subscribe(&view, move |this, _, event: &TerminalEvent, cx| {
            this.on_terminal(&id, event, cx)
        })
        .detach();
        Some(view)
    }

    /// The providers a session on `host_id` can start with: the list the Navigator and the New
    /// session menu offer for that computer.
    fn launch_choices(&self, host_id: &str, cx: &App) -> Vec<Provider> {
        self.sidebar
            .read(cx)
            .model()
            .hosts
            .iter()
            .find(|h| h.id == host_id)
            .map(|h| h.providers.clone())
            .unwrap_or_default()
    }

    /// A person picked `provider` for the blank session in tab `id`: attach that session under it,
    /// as the web's `startCli` does. The core records the provider an attach names as the
    /// session's own, so a session another view started while the person was choosing, which the
    /// row now says, is not given a second one.
    fn start_chosen(&mut self, id: &str, provider: &str, cx: &mut Context<Self>) {
        let blank = self
            .sidebar
            .read(cx)
            .find_session(id)
            .is_some_and(|s| s.provider_id.is_none() && !s.cli_started);
        let Some(pane) = self.panes.get_mut(id) else {
            return;
        };
        let Some(view) = pane.view.clone() else {
            return;
        };
        if blank {
            pane.open.provider_id = Some(provider.to_string());
            pane.open.blank = false;
            view.update(cx, |view, cx| view.start_with(provider, cx));
        } else {
            view.update(cx, |view, cx| {
                view.refuse_choice(
                    "This session was started elsewhere while you chose, so nothing was started.",
                    cx,
                )
            });
        }
        cx.notify();
    }

    /// What a terminal tells the window.
    fn on_terminal(&mut self, id: &str, event: &TerminalEvent, cx: &mut Context<Self>) {
        match event {
            // A click on a link is a person's: the window runs the system's handler for it.
            TerminalEvent::OpenLink(target) => (self.opener)(target),
            TerminalEvent::MenuAsked(at) => self.open_menu(id, *at, cx),
            TerminalEvent::Chose(provider) => self.start_chosen(id, provider, cx),
            // Its find bar or phone-size notice comes or goes (`inflow_wanted`).
            TerminalEvent::Chrome => cx.notify(),
            TerminalEvent::Status(Status::Live) => {
                if let Some(pane) = self.panes.get_mut(id) {
                    pane.attempts = 0;
                    pane.retry = None;
                }
            }
            TerminalEvent::Status(Status::Disconnected(_)) => {
                if self.panes.get(id).is_some_and(|p| p.closing.is_some()) {
                    self.close_unconfirmed(
                        id,
                        "the connection to the core dropped before it answered",
                        cx,
                    );
                }
                self.schedule_reattach(id, cx);
            }
            // The core deleted the session: its tab goes, whether this window asked for it, or
            // asked too long ago to be waiting still.
            TerminalEvent::Ended => {
                if self.panes.contains_key(id) {
                    self.tabs.close(id);
                    self.panes.remove(id);
                    self.notice = None;
                    self.after_change(cx);
                }
            }
            TerminalEvent::EndRefused(reason) => {
                self.close_unconfirmed(id, &format!("the core refused: {reason}"), cx)
            }
            _ => {}
        }
        // `perch.terminals()` reports each terminal's state, read from the window on a change.
        if matches!(event, TerminalEvent::Status(_)) {
            cx.notify();
        }
    }

    /// The connection of a terminal dropped. The shell is not known to have ended, so the screen
    /// stays and the window tries to attach to it again, waiting longer between tries up to a
    /// limit for as long as the core is away. A core that is back and says the session is gone
    /// ends the tries with its own reason; nothing is ever started over.
    fn schedule_reattach(&mut self, id: &str, cx: &mut Context<Self>) {
        let Some(pane) = self.panes.get_mut(id) else {
            return;
        };
        let delay = reattach_delay(pane.attempts);
        pane.attempts = pane.attempts.saturating_add(1);
        let id = id.to_string();
        pane.retry = Some(cx.spawn(async move |this, cx| {
            cx.background_executor().timer(delay).await;
            let _ = this.update(cx, |this, cx| this.reattach(&id, cx));
        }));
    }

    fn reattach(&mut self, id: &str, cx: &mut Context<Self>) {
        let Some(view) = self.panes.get(id).and_then(|pane| pane.view.clone()) else {
            return;
        };
        if !matches!(view.read(cx).status(), Status::Disconnected(_)) {
            return;
        }
        // The core may have restarted at another address: look for it afresh each time.
        match self.locate.as_ref().map(|locate| locate()) {
            Some(Ok(core)) => {
                view.update(cx, |view, cx| view.reattach(core, cx));
            }
            _ => self.schedule_reattach(id, cx),
        }
    }

    fn keymap(&self, cx: &App) -> Keymap {
        let model = self.sidebar.read(cx).model();
        Keymap::new(model.keybindings.clone(), model.keys_file.clone())
    }

    /// The tab whose terminal has the keyboard.
    fn focused_terminal(
        &self,
        window: &Window,
        cx: &App,
    ) -> Option<(String, Entity<TerminalView>)> {
        self.terminals()
            .into_iter()
            .find(|(_, view)| view.focus_handle(cx).is_focused(window))
    }

    /// Tell the sidebar which tab is shown, so it is marked read and highlighted.
    fn after_change(&mut self, cx: &mut Context<Self>) {
        self.keep_in_bounds(cx);
        self.note_shown();
        let target = self.tabs.active().and_then(|id| {
            let open = &self.panes.get(id)?.open;
            Some((
                open.host_id.clone(),
                id.to_string(),
                open.provider_id.clone(),
            ))
        });
        self.sidebar.update(cx, |sidebar, cx| match target {
            Some((host, id, provider)) => sidebar.open(host, id, provider, cx),
            None => sidebar.clear_selection(cx),
        });
        cx.notify();
    }

    /// The shown tab is a visit for Back and Forward.
    fn note_shown(&mut self) {
        if let Some(id) = self.tabs.active() {
            self.history.record(id);
        }
    }

    /// Give the keyboard to the pane the person clicked.
    fn focus_pane(&mut self, id: &str, cx: &mut Context<Self>) {
        if self.tabs.active() != Some(id) && self.tabs.show(id) {
            self.after_change(cx);
        }
    }

    /// One key press, before the focused terminal sees it. True when it was handled here.
    fn key(&mut self, keystroke: &Keystroke, window: &mut Window, cx: &mut Context<Self>) -> bool {
        // Escape ends a tab drag, or a press a mod follows, with nothing changed.
        if keystroke.key == "escape" && self.drag.as_ref().is_some_and(|d| d.started) {
            self.drag_ended(false, cx);
            return true;
        }
        if keystroke.key == "escape" && self.cancel_follow(cx) {
            return true;
        }
        let keymap = self.keymap(cx);
        // A modal screen has the keyboard. Escape dismisses it, here and not in each mod, and so
        // does the Navigator's own key while the Navigator is up; every other key is the mod's.
        if let Some(top) = self.screens.top_modal() {
            let toggles = top == "navigator"
                && matches!(
                    keymap.resolve(keystroke, KeyContext { typing: true, ..Default::default() }),
                    Some(Hit::Run { name, .. })
                        if matches!(name.as_str(), "global.navigator" | "global.navigatorAlt")
                );
            let busy = keystroke.key == "escape" && !self.screens.dismissable(top);
            if (keystroke.key == "escape" && !busy) || toggles {
                self.screen_closed(top, Value::Null, window, cx);
                return true;
            }
            if busy {
                return true;
            }
            return false;
        }
        // Escape puts a peek away, unless its terminal has the keyboard: then it is the program's.
        if keystroke.key == "escape" && self.peek.is_some() {
            let typing = self
                .peek
                .as_ref()
                .and_then(|id| self.panes.get(id))
                .and_then(|pane| pane.view.as_ref())
                .is_some_and(|view| view.focus_handle(cx).is_focused(window));
            if !typing {
                self.park_peek(cx);
                return true;
            }
        }
        if let Some(text) = self.settings.as_mut().and_then(|p| p.editing.as_mut()) {
            match settings::edit(text, keystroke) {
                settings::Edit::Ignored => {}
                settings::Edit::Changed => {
                    cx.notify();
                    return true;
                }
                settings::Edit::Escape => {
                    if let Some(panel) = self.settings.as_mut() {
                        panel.editing = None;
                    }
                    cx.notify();
                    return true;
                }
                settings::Edit::Enter => {
                    self.commit_scrollback(cx);
                    return true;
                }
            }
        }
        let context = KeyContext {
            in_terminal: self.focused_terminal(window, cx).is_some(),
            typing: self.keyboard_held.is_some(),
            leader: self.leader.is_some(),
            resize: self.resizing.is_some(),
        };
        let Some(hit) = keymap.resolve(keystroke, context) else {
            return false;
        };
        // While the find field holds the keys, copy, paste and the rest act on the field, which
        // is the view's to handle; only reopening the find bar is the window's.
        if let Hit::Run { name, .. } = &hit {
            let finding = name.starts_with("terminal.")
                && name != "terminal.find"
                && self
                    .focused_terminal(window, cx)
                    .is_some_and(|(_, view)| view.read(cx).find_open());
            if finding {
                return false;
            }
        }
        self.notice = None;
        match hit {
            Hit::Run { name, args } => {
                if name == "leader.arm" {
                    self.arm_leader(cx);
                    return true;
                }
                self.leader = None;
                // A key of resize mode arms it afresh, for the next.
                let resizing = name.starts_with("resize.");
                if !resizing {
                    self.resizing = None;
                }
                if let Err(error) = self.run_command(&name, args.as_ref(), window, cx) {
                    self.notice = Some(error);
                    cx.notify();
                }
                if resizing {
                    self.arm_resize(cx);
                }
                true
            }
            Hit::Send(text) => {
                if let Err(error) = self.send(&text, window, cx) {
                    self.notice = Some(error);
                    cx.notify();
                }
                true
            }
            // Where the program wants the real chord, the key goes down to it as any other.
            Hit::Edit(text) => self
                .focused_terminal(window, cx)
                .is_some_and(|(_, view)| view.update(cx, |view, cx| view.send_edit(text, cx))),
            Hit::Terminal => false,
            Hit::Fault(error) => {
                self.notice = Some(format!("keys.json: {error}"));
                cx.notify();
                true
            }
            Hit::LeaderEnded => {
                self.leader = None;
                self.resizing = None;
                cx.notify();
                // Escape ends it quietly; any other key still reaches the program.
                keystroke.key == "escape"
            }
        }
    }

    /// Arm resize mode, or keep it armed for another [`LEADER_TIMEOUT`] (the web's, as its
    /// leader's).
    fn arm_resize(&mut self, cx: &mut Context<Self>) {
        self.resizing = Some(cx.spawn(async move |this, cx| {
            cx.background_executor().timer(LEADER_TIMEOUT).await;
            let _ = this.update(cx, |this, cx| {
                this.resizing = None;
                cx.notify();
            });
        }));
        cx.notify();
    }

    /// Grow (a positive `delta`) or shrink the focused pane by `delta` pixels, in the split as it
    /// was last drawn. Nothing happens before it is drawn, or with no split.
    fn resize_pane(&mut self, delta: f32, cx: &mut Context<Self>) {
        let area = {
            let boxes = self.drop_boxes.borrow();
            self.tabs
                .shown()
                .iter()
                .filter_map(|id| boxes.panes.get(id).copied())
                .reduce(|a, b| a.union(&b))
        };
        if let Some(area) = area {
            let (width, height) = (f32::from(area.size.width), f32::from(area.size.height));
            if self.tabs.resize(delta, width, height) {
                cx.notify();
            }
        }
    }

    /// Back (`-1`) or Forward (`1`) to a tab shown before, passing over sessions gone since.
    fn step_history(&mut self, by: isize, cx: &mut Context<Self>) -> Result<(), String> {
        let sidebar = self.sidebar.read(cx);
        let panes = &self.panes;
        let place = self.history.step(by, |id| {
            panes.contains_key(id) || sidebar.session_to_open(id).is_some()
        });
        match place {
            Some(id) => self.show_session(&id, cx),
            None => Ok(()),
        }
    }

    /// The web's leader `w`: the newest session of the next folder, folders (computer and
    /// folder) ordered by their newest session, after the shown session's folder. Nothing with
    /// fewer than two folders.
    fn next_project(&mut self, cx: &mut Context<Self>) -> Result<(), String> {
        let store = &self.sidebar.read(cx).model().store;
        let mut folders: Vec<((&str, &str), &perch_core::protocol::SessionSummary)> = Vec::new();
        for session in &store.sessions {
            let key = (session.host_id.as_str(), session.cwd.as_str());
            match folders.iter_mut().find(|(k, _)| *k == key) {
                Some((_, newest)) if newest.created_at >= session.created_at => {}
                Some((_, newest)) => *newest = session,
                None => folders.push((key, session)),
            }
        }
        if folders.len() < 2 {
            return Ok(());
        }
        folders.sort_by_key(|(_, newest)| std::cmp::Reverse(newest.created_at));
        let shown = self
            .tabs
            .active()
            .and_then(|id| store.sessions.iter().find(|s| s.id == id));
        let at = shown.and_then(|s| {
            folders
                .iter()
                .position(|(k, _)| *k == (s.host_id.as_str(), s.cwd.as_str()))
        });
        let target = folders[at.map_or(0, |at| (at + 1) % folders.len())].1;
        if shown.is_some_and(|s| s.id == target.id) {
            return Ok(());
        }
        let (host, id, provider) = (
            target.host_id.clone(),
            target.id.clone(),
            target.cli_provider_id.clone(),
        );
        self.sidebar
            .update(cx, |sidebar, cx| sidebar.open(host, id, provider, cx));
        Ok(())
    }

    fn arm_leader(&mut self, cx: &mut Context<Self>) {
        self.leader = Some(cx.spawn(async move |this, cx| {
            cx.background_executor().timer(LEADER_TIMEOUT).await;
            let _ = this.update(cx, |this, cx| {
                this.leader = None;
                cx.notify();
            });
        }));
        cx.notify();
    }

    /// Type `text` into the focused terminal, as `send:` in `keys.json` asks. It goes through the
    /// terminal's text input, under the same lease as typing, and never as a paste.
    fn send(
        &mut self,
        text: &str,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Result<(), String> {
        let (_, view) = self
            .focused_terminal(window, cx)
            .ok_or("send: types into a terminal, and none has focus.")?;
        view.update(cx, |view, cx| view.send_text(text, cx))
    }

    fn finish(&mut self, result: Result<(), String>, cx: &mut Context<Self>) {
        if let Err(error) = result {
            self.notice = Some(error);
        }
        cx.notify();
    }

    /// Only a person's choice calls this: it brings the Perch app forward.
    fn hand_off(&self, place: Place) -> Result<(), String> {
        let session = self.tabs.active();
        open_in_perch(&perch_url(session, place)).map_err(|e| e.to_string())
    }

    /// A tab's name: the session's title now (a plain terminal is not listed), else the title its
    /// program set, else what it was opened as.
    fn title_of(&self, id: &str, cx: &App) -> String {
        let named = |title: String| Some(title).filter(|t| !t.trim().is_empty());
        let listed = self
            .sidebar
            .read(cx)
            .find_session(id)
            .and_then(|s| named(s.title.clone()));
        let pane = self.panes.get(id);
        let program = pane
            .and_then(|p| p.view.as_ref())
            .and_then(|v| named(v.read(cx).title().to_string()));
        let plain = pane.is_some_and(|p| is_plain(&p.open));
        listed
            .or(program)
            .or_else(|| plain.then(|| "Terminal".to_string()))
            .or_else(|| pane.map(|p| p.open.title.clone()))
            .unwrap_or_else(|| "New session".into())
    }

    /// Run a command by its id: a shortcut's (`tabs.next`) or a typed one's (`tab.next`).
    /// `args` is what a typed command takes (`{direction}`, `{index}`, `{name}`, `{id}`).
    pub fn run_command(
        &mut self,
        name: &str,
        args: Option<&Value>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Result<(), String> {
        let text = |key: &str| args.and_then(|a| a.get(key)).and_then(Value::as_str);
        let number = |key: &str| {
            args.and_then(|a| a.get(key))
                .and_then(Value::as_f64)
                .filter(|n| n.fract() == 0.0 && *n >= 0.0)
                .map(|n| n as usize)
        };
        let side = || {
            text("direction").and_then(Side::parse).ok_or_else(|| {
                r#"This command needs {direction: "left" | "right" | "up" | "down"}."#.to_string()
            })
        };
        self.sidebar.read(cx).take_refused();
        match name {
            "global.navigator" | "global.navigatorAlt" | "app.palette" => {
                self.toggle_palette(window, cx)
            }
            "global.help" | "global.helpPlain" => self.open_keybind_help(cx),
            // As the web's Cmd+Shift+T and the sidebar's New session: the launcher, for the
            // sidebar's target.
            "sessions.new" if self.screens.has("launcher", cx) => {
                let target = self.sidebar.update(cx, |sidebar, cx| {
                    sidebar.run_action("sessions.new", cx);
                    sidebar.take_new_session()
                });
                if let Some(target) = target {
                    self.open_launcher(&target, cx);
                }
            }
            "session.start" => {
                let host = text("hostId").unwrap_or(LOCAL).to_string();
                let agent = text("agent")
                    .ok_or("This command needs {agent}.")?
                    .to_string();
                self.start_session(&host, text("cwd").map(str::to_string), &agent, cx)?;
            }
            "session.rename" => {
                let id = text("id").ok_or("This command needs {id}.")?;
                let title = text("name").ok_or(r#"This command needs {name: "…"}."#)?;
                self.sidebar.update(cx, |sidebar, _| {
                    sidebar.send(Command::Rename {
                        session_id: id.to_string(),
                        title: title.trim().to_string(),
                    })
                });
            }
            "session.request_close" => {
                let id = text("id").ok_or("This command needs {id}.")?.to_string();
                if !self.tabs.contains(&id) {
                    return Err(format!("Session {id} has no tab in this window."));
                }
                self.close(&id, cx);
            }
            // The sidebar's actions on what the core keeps: each names its target, and one the
            // core does not know is refused, so a command never acts on another.
            "session.close" => {
                let id = self.known_session(text("id"), cx)?;
                // The tab goes when the core says the session is deleted.
                self.sidebar
                    .read(cx)
                    .send(Command::DeleteSession { session_id: id });
            }
            "session.move" => {
                let id = self.known_session(text("id"), cx)?;
                let target = self.known_session(text("target"), cx)?;
                let siblings: Vec<String> = args
                    .and_then(|a| a.get("siblings"))
                    .and_then(Value::as_array)
                    .and_then(|list| {
                        list.iter()
                            .map(|v| v.as_str().map(str::to_string))
                            .collect()
                    })
                    .ok_or("This command needs {siblings: [ids…]}.")?;
                let after = args.and_then(|a| a.get("after")) == Some(&Value::Bool(true));
                let store = self.sidebar.read(cx).model().store.clone();
                let host = store
                    .sessions
                    .iter()
                    .find(|s| s.id == id)
                    .map(|s| s.host_id.clone())
                    .unwrap_or_else(|| LOCAL.into());
                let live: std::collections::HashSet<String> = store
                    .sessions
                    .iter()
                    .filter(|s| s.host_id == host)
                    .map(|s| s.id.clone())
                    .collect();
                // ponytail: the group is the sidebar's siblings, not also each workspace's strip
                // order as the web's `moveChat` refills; the native strip keeps no order of its own.
                // Only this computer's sessions go into its order: an unknown id is left out.
                let mut group: Vec<String> =
                    siblings.into_iter().filter(|s| live.contains(s)).collect();
                for extra in [&id, &target] {
                    if !group.contains(extra) {
                        group.push(extra.clone());
                    }
                }
                let core = store
                    .order
                    .get(&host)
                    .map(|o| o.1.clone())
                    .unwrap_or_default();
                let moved = navigation::move_beside(&group, &id, &target, after);
                let sessions = navigation::write_scope(&core, &moved, Some(&live));
                self.sidebar.read(cx).send(Command::SetOrder {
                    host_id: host,
                    projects: None,
                    sessions: Some(sessions),
                });
            }
            "project.move" => {
                let store = self.sidebar.read(cx).model().store.clone();
                let project = |key: &str| {
                    let id = text(key).ok_or(format!("This command needs {{{key}}}."))?;
                    store
                        .projects
                        .iter()
                        .find(|p| p.id == id)
                        .cloned()
                        .ok_or(format!("There is no project {id}."))
                };
                let (moved, target) = (project("id")?, project("target")?);
                let after = args.and_then(|a| a.get("after")) == Some(&Value::Bool(true));
                let view = navigation::View {
                    host_id: moved.host_id.clone(),
                    ..Default::default()
                };
                let shown: Vec<String> = navigation::navigation(&store, &view)
                    .projects
                    .into_iter()
                    .map(|p| p.id)
                    .collect();
                let core = store
                    .order
                    .get(&moved.host_id)
                    .map(|o| o.0.clone())
                    .unwrap_or_default();
                let order = navigation::move_beside(&shown, &moved.id, &target.id, after);
                self.sidebar.read(cx).send(Command::SetOrder {
                    host_id: moved.host_id,
                    projects: Some(navigation::write_scope(&core, &order, None)),
                    sessions: None,
                });
            }
            "project.close" => {
                let id = text("id").ok_or("This command needs {id}.")?.to_string();
                // As the web's: the sidebar asks first, so the command itself needs the answer.
                if args.and_then(|a| a.get("confirmed")) != Some(&Value::Bool(true)) {
                    return Err("This ends the project's agents and shells: pass {confirmed: true} to go ahead.".into());
                }
                self.known_project(&id, cx)?;
                self.sidebar
                    .read(cx)
                    .send(Command::RemoveProject { project_id: id });
            }
            "project.rename" => {
                let id = text("id").ok_or("This command needs {id}.")?.to_string();
                self.known_project(&id, cx)?;
                let name = text("name").unwrap_or_default().trim().to_string();
                self.sidebar.read(cx).send(Command::RenameProject {
                    project_id: id,
                    name,
                });
            }
            "project.new" => {
                let folder = text("folder")
                    .ok_or(r#"This command needs {folder: "/path"}."#)?
                    .to_string();
                if args.is_some_and(|a| a.get("argv").is_some() || a.get("task").is_some()) {
                    return Err(
                        "The native window cannot run a program in a new project yet.".into(),
                    );
                }
                let host = text("hostId").unwrap_or(LOCAL).to_string();
                self.sidebar.read(cx).send(Command::CreateProject {
                    host_id: host,
                    path: folder,
                    name: text("name").map(str::to_string),
                });
            }
            "workspace.open" => {
                let id = self.known_workspace(text("id"), cx)?;
                // Its session last shown here, else the workspace alone (the native window has no
                // start screen).
                let store = self.sidebar.read(cx).model().store.clone();
                let last = self.tabs.strip().iter().rev().find(|tab| {
                    store
                        .sessions
                        .iter()
                        .any(|s| s.id == **tab && s.workspace_id.as_deref() == Some(id.as_str()))
                });
                match last.cloned() {
                    Some(tab) => self.show_session(&tab, cx)?,
                    None => {
                        self.run_command("workspace.focus", Some(&json!({ "id": id })), window, cx)?
                    }
                }
            }
            "workspace.hide" => {
                let id = self.known_workspace(text("id"), cx)?;
                let hidden = args.and_then(|a| a.get("hidden")) != Some(&Value::Bool(false));
                self.sidebar.read(cx).send(Command::HideWorkspace {
                    workspace_id: id,
                    hidden,
                });
            }
            "workspace.restore" => {
                let id = self.known_workspace(text("id"), cx)?;
                self.sidebar
                    .read(cx)
                    .send(Command::RestoreWorkspace { workspace_id: id });
            }
            "workspace.rename" => {
                let id = self.known_workspace(text("id"), cx)?;
                let name = text("name").unwrap_or_default().trim().to_string();
                self.sidebar.read(cx).send(Command::RenameWorkspace {
                    workspace_id: id,
                    name,
                });
            }
            "host.refresh" => {
                let id = text("id").ok_or("This command needs {id}.")?.to_string();
                let store = &self.sidebar.read(cx).model().store;
                if id != LOCAL && !store.host_entries.iter().any(|h| h.id == id) {
                    return Err(format!("No host {id}."));
                }
                self.sidebar.read(cx).send(Command::RefreshHost(id));
            }
            "agent.focus" => {
                let id = text("id")
                    .or_else(|| text("terminal"))
                    .ok_or("This command needs {id}.")?
                    .to_string();
                self.show_session(&id, cx)?;
            }
            "pane.unsplit" => {
                let id = text("id")
                    .map(str::to_string)
                    .or_else(|| self.tabs.active().map(str::to_string))
                    .ok_or("There is no tab to take out of a split.")?;
                if !self.tabs.contains(&id) {
                    return Err(format!("No tab {id}."));
                }
                self.tabs.unsplit(&id);
                self.after_change(cx);
            }
            // The SDK's `beginTabDrag`: a press on tab `id`, with where the strip's tabs are.
            "tab.beginDrag" => {
                let id = text("id").ok_or("This command needs {id}.")?.to_string();
                if !self.tabs.contains(&id) {
                    return Err(format!("No tab {id}."));
                }
                let coordinate = |key: &str| {
                    args.and_then(|a| a.get(key))
                        .and_then(Value::as_f64)
                        .map(|v| px(v as f32))
                };
                let start = coordinate("x")
                    .zip(coordinate("y"))
                    .map(|(x, y)| point(x, y))
                    .ok_or("This command needs {x, y}.")?;
                // One drag at a time, as the web's.
                if self.drag.is_none() {
                    let spans =
                        tab_drag::spans_from(&args.map_or(Value::Null, |a| a["entries"].clone()));
                    let label = text("label").unwrap_or_default().to_string();
                    let mut drag = TabDrag::new(id, label, start, spans);
                    drag.look = tab_drag::look_from(args.map_or(&Value::Null, |a| &a["look"]));
                    self.drag = Some(drag);
                    cx.notify();
                }
            }
            // The SDK's `beginReorderDrag`: a press a mod's own code drags with, which needs the
            // pointer wherever it goes until the press ends. One at a time, and not beside a tab
            // drag.
            "pointer.follow" => {
                let token = text("token")
                    .ok_or("This command needs {token}.")?
                    .to_string();
                let coordinate = |key: &str| args.and_then(|a| a.get(key)).and_then(Value::as_f64);
                let (x, y) = coordinate("x")
                    .zip(coordinate("y"))
                    .ok_or("This command needs {x, y}.")?;
                if self.follow.is_some() || self.drag.is_some() {
                    return Err("The pointer is already followed for another press.".into());
                }
                self.follow = Some(token);
                self.forward_pointer("move", point(px(x as f32), px(y as f32)), cx);
            }
            "tab.menu" => {
                let id = text("id")
                    .map(str::to_string)
                    .or_else(|| self.tabs.active().map(str::to_string))
                    .ok_or("There is no tab to open a menu for.")?;
                if !self.tabs.contains(&id) {
                    return Err(format!("No tab {id}."));
                }
                let coordinate = |key: &str| {
                    args.and_then(|a| a.get(key))
                        .and_then(Value::as_f64)
                        .unwrap_or(0.) as f32
                };
                let at = gpui::point(px(coordinate("x")), px(coordinate("y")));
                self.open_tab_menu(&id, at, cx);
            }
            "host.enable" => {
                let id = text("id").ok_or("This command needs {id}.")?;
                let enabled = args
                    .and_then(|a| a.get("enabled"))
                    .and_then(Value::as_bool)
                    .ok_or("This command needs {enabled: true | false}.")?;
                if id == LOCAL {
                    return Err("This computer is always on.".into());
                }
                self.sidebar.update(cx, |sidebar, _| {
                    sidebar.send(Command::SetHostEnabled {
                        host_id: id.to_string(),
                        enabled,
                    })
                });
            }
            "quickchat.new" => {
                self.sidebar
                    .update(cx, |sidebar, cx| sidebar.run_action("nests.scratchpad", cx));
            }
            "overlay.close" => {
                if let Some(top) = self.screens.top_modal() {
                    self.screen_closed(top, Value::Null, window, cx);
                } else if self.settings.take().is_some() {
                    cx.notify();
                } else {
                    return Err("Nothing is open to close.".into());
                }
            }
            "session.open" => {
                let session = text("id").ok_or("This command needs {id}.")?.to_string();
                let (host, provider) = self
                    .sidebar
                    .read(cx)
                    .model()
                    .store
                    .sessions
                    .iter()
                    .find(|s| s.id == session)
                    .map(|s| (s.host_id.clone(), s.cli_provider_id.clone()))
                    .ok_or_else(|| format!("No session {session}."))?;
                self.sidebar
                    .update(cx, |sidebar, cx| sidebar.open(host, session, provider, cx));
            }
            // The web's leader W and New workspace: the shown project's worktree menu. A folder
            // that is not a git repo has no menu, so the request is left for none to take.
            "leader.resize" => self.arm_resize(cx),
            "resize.left" | "resize.down" | "leader.shrink" => self.resize_pane(-RESIZE_STEP, cx),
            "resize.up" | "resize.right" | "leader.grow" => self.resize_pane(RESIZE_STEP, cx),
            "nav.back" => self.step_history(-1, cx)?,
            "nav.forward" => self.step_history(1, cx)?,
            "leader.nextProject" => self.next_project(cx)?,
            // The web's Cmd+O: the sidebar's Add project form, which picks the folder.
            "nests.addBirdhouse" => self.ask_add_project(cx)?,
            "leader.worktree" | "nests.new" => {
                if let Some(key) = self.active_repo_key(cx) {
                    self.request_worktree_menu(key, None, name == "nests.new", cx);
                }
            }
            // Only asks: the menu confirms and guards the removal, as the web's does.
            "worktree.remove" => {
                let id = text("id").ok_or("This command needs {id}.")?;
                let model = self.sidebar.read(cx).model();
                let store = &model.store;
                let workspace = store
                    .workspaces
                    .iter()
                    .find(|w| w.id == id)
                    .ok_or_else(|| format!("No workspace {id}."))?;
                let key = store
                    .projects
                    .iter()
                    .find(|p| p.id == workspace.project_id)
                    .and_then(|p| Some((p.host_id.clone(), p.repo_path.clone()?)))
                    .filter(|(_, repo)| !repo.is_empty() && workspace.parent_workspace_id.is_some())
                    .map(|(host, repo)| format!("{host}:{repo}"))
                    .ok_or("Only a linked worktree of a git project can be deleted.")?;
                let mut remove = json!({ "path": workspace.path });
                if let Some(branch) = workspace.branch.as_deref().filter(|b| !b.is_empty()) {
                    remove["branch"] = json!(branch);
                }
                self.request_worktree_menu(key, Some(remove), false, cx);
            }
            "worktree.cancel" | "worktree.retry" | "worktree.dismiss" => {
                let id = text("id").ok_or("This command needs {id}.")?.to_string();
                let sidebar = self.sidebar.read(cx);
                if !sidebar
                    .model()
                    .store
                    .worktree_jobs
                    .iter()
                    .any(|j| j.job_id == id)
                {
                    return Err(format!("There is no worktree job {id}."));
                }
                let verb = match name {
                    "worktree.cancel" => "cancel",
                    "worktree.retry" => "retry",
                    _ => "dismiss",
                };
                sidebar.send(Command::WorktreeJob { verb, job_id: id });
            }
            // The web pins the folder as the active project and leaves the shown session; here
            // the active folder is the shown session's, so the folder's newest session is shown.
            "folder.select" => {
                let cwd = text("cwd")
                    .filter(|c| !c.is_empty())
                    .ok_or(r#"This command needs {cwd: "/path"}."#)?
                    .to_string();
                let host = match text("host") {
                    Some(host) => host.to_string(),
                    None => screens::mods(cx)
                        .map_or_else(|| LOCAL.to_string(), |(_, perch)| perch.shown_place().0),
                };
                let session = self
                    .sidebar
                    .read(cx)
                    .model()
                    .store
                    .sessions
                    .iter()
                    .filter(|s| s.host_id == host && s.cwd == cwd)
                    .max_by_key(|s| s.created_at)
                    .map(|s| (s.id.clone(), s.cli_provider_id.clone()))
                    .ok_or_else(|| format!("No sessions in {cwd} on {host}."))?;
                self.sidebar.update(cx, |sidebar, cx| {
                    sidebar.open(host, session.0, session.1, cx)
                });
            }
            "notification.open" | "notification.dismiss" => {
                let id = text("id").ok_or("This command needs {id}.")?;
                let at = self
                    .notifications
                    .iter()
                    .position(|n| n.id == id)
                    .ok_or_else(|| format!("No notification {id}."))?;
                let note = self.notifications.remove(at);
                cx.notify();
                // As the web: its action if it has one, else the session it is about.
                if name == "notification.open" {
                    match note.notice.and_then(|n| n.action) {
                        Some((command, args)) => {
                            self.run_command(&command, args.as_ref(), window, cx)?
                        }
                        None if note.heard.alert != Alert::Usage => {
                            self.show_session(&note.heard.session_id, cx)?
                        }
                        None => {}
                    }
                }
            }
            "global.settings" | "app.settings" => {
                self.settings = match self.settings {
                    Some(_) => None,
                    None => Some(SettingsPanel::default()),
                };
                cx.notify();
            }
            "workspace.pin" => {
                // Bare, it flips the current workspace; with arguments it is the web's, which
                // pins unless `pinned` is false.
                let pinned = args.map(|a| a.get("pinned").and_then(Value::as_bool) != Some(false));
                self.sidebar.read(cx).pin_workspace(text("id"), pinned)?;
            }
            "terminal.show" => {
                let id = text("id").ok_or("This command needs {id}.")?.to_string();
                self.show_session(&id, cx)?;
            }
            "terminal.peek" => {
                let id = text("id").ok_or("This command needs {id}.")?.to_string();
                self.toggle_peek(&id, cx)?;
            }
            "terminal.keep" => {
                let id = text("id")
                    .map(str::to_string)
                    .or_else(|| self.peek.clone())
                    .ok_or("This command needs {id}.")?;
                self.show_session(&id, cx)?;
            }
            "terminal.park" => {
                if !self.park_peek(cx) {
                    return Err(
                        "There is no peek to put away; a session's tab stays until it is closed."
                            .into(),
                    );
                }
            }
            "view.zoomIn" | "view.zoomInShift" | "app.zoom_in" => self.zoom_to(self.zoom.in_(), cx),
            "view.zoomOut" | "app.zoom_out" => self.zoom_to(self.zoom.out(), cx),
            "view.zoomReset" | "app.zoom_reset" => self.zoom_to(self.zoom.reset(), cx),
            "usage.get" => {
                let force = args.and_then(|a| a.get("force")).and_then(Value::as_bool);
                let force = force.unwrap_or(false);
                self.sidebar
                    .update(cx, |sidebar, _| sidebar.send(Command::UsageGet { force }));
            }
            "usage.redeemReset" => {
                let account_id = text("accountId").ok_or("This command needs {accountId}.")?;
                let account_id = account_id.to_string();
                self.sidebar.update(cx, |sidebar, _| {
                    sidebar.send(Command::UsageRedeemReset { account_id })
                });
            }
            // With a New session screen, the sidebar's target opens it instead of its panel.
            // As the web's Cmd+T: the tab strip opens its New session menu at its "+", for the
            // shown workspace. With no strip drawn, the sidebar's target opens the menu.
            "tabs.new" | "tab.new" => {
                if self.tabs.visible().is_some() && self.screens.has("tabs", cx) {
                    self.new_tab_asks += 1;
                    cx.notify();
                } else {
                    self.sidebar
                        .update(cx, |sidebar, cx| sidebar.run_action("sessions.new", cx));
                }
            }
            "tabs.next" | "tab.next" => {
                self.tabs.step(1);
                self.after_change(cx);
            }
            "tabs.prev" | "tab.prev" => {
                self.tabs.step(-1);
                self.after_change(cx);
            }
            "tabs.last" => self.select(None, cx)?,
            "tab.select" => match (number("index"), text("id")) {
                (Some(index), _) => self.select(Some(index), cx)?,
                (None, Some(id)) => {
                    if !self.tabs.show(id) {
                        return Err(format!("No tab {id}."));
                    }
                    self.after_change(cx);
                }
                _ => return Err("This command needs {index} or {id}.".into()),
            },
            "tabs.close" | "tab.close" | "pane.close" => {
                let id = text("id")
                    .map(str::to_string)
                    .or_else(|| self.tabs.active().map(str::to_string))
                    .ok_or("There is no tab to close.")?;
                if !self.tabs.contains(&id) {
                    return Err(format!("No tab {id}."));
                }
                self.close(&id, cx);
            }
            "tab.rename" => {
                let title = text("name").ok_or(r#"This command needs {name: "…"}."#)?;
                let id = text("id")
                    .map(str::to_string)
                    .or_else(|| self.tabs.active().map(str::to_string))
                    .ok_or("There is no tab to rename.")?;
                self.sidebar.update(cx, |sidebar, _| {
                    sidebar.send(Command::Rename {
                        session_id: id,
                        title: title.trim().to_string(),
                    })
                });
            }
            "tab.move" => {
                let index = number("index").ok_or("This command needs {index}.")?;
                let id = text("id")
                    .map(str::to_string)
                    .or_else(|| self.tabs.active().map(str::to_string))
                    .ok_or("There is no tab to move.")?;
                if !self.tabs.move_tab(&id, index) {
                    return Err(format!(
                        "This command needs {{index: 1-{}}}.",
                        self.tabs.strip().len()
                    ));
                }
            }
            "panes.splitRight" => self.split(Side::Right, cx)?,
            "panes.splitDown" => self.split(Side::Down, cx)?,
            "pane.split" => match side()? {
                s @ (Side::Right | Side::Down) => self.split(s, cx)?,
                _ => return Err(r#"{direction} is "right" or "down"."#.into()),
            },
            "panes.next" => {
                self.tabs.cycle(1);
                self.after_change(cx);
            }
            "panes.prev" => {
                self.tabs.cycle(-1);
                self.after_change(cx);
            }
            "panes.zoom" | "pane.zoom" => {
                self.tabs.zoom();
                cx.notify();
            }
            "panes.focus.left" => self.go(Side::Left, cx),
            "panes.focus.right" => self.go(Side::Right, cx),
            "panes.focus.up" => self.go(Side::Up, cx),
            "panes.focus.down" => self.go(Side::Down, cx),
            "pane.go" => self.go(side()?, cx),
            "pane.focus" => {
                let id = text("pane").ok_or("This command needs {pane}.")?;
                if !self.tabs.show(id) {
                    return Err(format!("No pane {id}."));
                }
                self.after_change(cx);
            }
            "pane.swap" => {
                self.tabs.swap_side(side()?);
                cx.notify();
            }
            "pane.swapNext" => {
                self.tabs.swap_next();
                cx.notify();
            }
            "terminal.takeBackAll" => self.take_back_all(cx)?,
            // The agent-control screen's Retry CLI, Restart CLI and Resume agent: the agent of
            // tab `id` starts again, only after the core said its attach failed or its shell
            // ended. A drop is never started over (the window reattaches it instead).
            "terminal.restart" => {
                let view = self.terminal_named(text("id"))?;
                let core = self
                    .locate
                    .as_ref()
                    .ok_or("There is no core to start the agent on.")?()
                .map_err(|error| format!("The core is not reachable: {error:#}"))?;
                if !view.update(cx, |view, cx| view.restart(core, cx)) {
                    return Err("That terminal's agent has not ended or failed to start.".into());
                }
            }
            // The find bar's own (`terminal-search`): the query it holds, find again, close.
            "terminal.findQuery"
            | "terminal.findNext"
            | "terminal.findPrevious"
            | "terminal.findClose" => {
                let view = self.terminal_named(text("id"))?;
                view.update(cx, |view, cx| match name {
                    "terminal.findQuery" => {
                        view.set_find_query(text("query").unwrap_or_default(), cx);
                    }
                    "terminal.findNext" => {
                        view.find_next(cx);
                    }
                    "terminal.findPrevious" => {
                        view.find_previous(cx);
                    }
                    _ => view.close_find(cx),
                });
            }
            _ if name.starts_with("terminal.") => self.terminal_command(name, args, cx)?,
            _ if name.starts_with("tabs.jump") => {
                let n = name["tabs.jump".len()..].parse().ok();
                self.select(Some(n.ok_or_else(|| format!("No command {name}."))?), cx)?;
            }
            _ => {
                // The sidebar's view settings (`sidebar.organize`, `project.fold`, ...) are the
                // `perch` module's, which the sidebar mod reads.
                let own = screens::mods(cx).and_then(|(_, perch)| {
                    let result = perch.run_own(name, args.unwrap_or(&Value::Null))?;
                    perch.flush(cx);
                    Some(result)
                });
                match own {
                    Some(result) => {
                        result?;
                        // The core keeps the theme, for every screen.
                        if name == "app.theme" {
                            let theme = json!({ "theme": text("name") });
                            self.sidebar.read(cx).send(Command::UpdateSettings(theme));
                        }
                    }
                    None => {
                        let handled = self
                            .sidebar
                            .update(cx, |sidebar, cx| sidebar.run_action(name, cx));
                        if !handled {
                            return Err(format!("No command {name}."));
                        }
                    }
                }
            }
        }
        let _ = window;
        // What it would have changed in the core was not sent: the core is away.
        if self.sidebar.read(cx).take_refused() {
            return Err(crate::client::NOT_CONNECTED.into());
        }
        Ok(())
    }

    /// The keybind help (`stock:keybind-help`), as the web opens it: once, until it is closed.
    fn open_keybind_help(&mut self, cx: &mut Context<Self>) {
        if self.screens.is_open("keybind-help") {
            return;
        }
        if self.screens.has("keybind-help", cx) {
            self.open_screen("keybind-help", json!({ "open": true }), None, None, cx);
            return;
        }
        self.notice = Some(
            "No mod draws the keybind help. The stock one is restored when the app starts.".into(),
        );
        cx.notify();
    }

    fn toggle_palette(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        if self.screens.is_open("navigator") {
            self.screen_closed("navigator", Value::Null, window, cx);
            return;
        }
        if self.screens.has("navigator", cx) {
            let props = self.navigator_props(cx);
            self.open_screen(
                "navigator",
                props,
                None,
                Some(Box::new(|this, result, window, cx| {
                    let outcome = this.navigator_result(&result, window, cx);
                    this.finish(outcome, cx);
                })),
                cx,
            );
            return;
        }
        self.notice = Some(
            "No mod draws the Navigator. The stock one is restored when the app starts.".into(),
        );
        cx.notify();
    }

    /// The tab at `index` (1 is first), or the last one.
    fn select(&mut self, index: Option<usize>, cx: &mut Context<Self>) -> Result<(), String> {
        if !self.tabs.jump(index) {
            return Err(match index {
                Some(n) => format!("No tab {n}: there are {}.", self.tabs.strip().len()),
                None => "There are no tabs.".into(),
            });
        }
        self.after_change(cx);
        Ok(())
    }

    fn go(&mut self, side: Side, cx: &mut Context<Self>) {
        if self.tabs.go(side) {
            self.after_change(cx);
        }
    }

    /// Split the focused tab: start a terminal on this computer and show it beside it once the
    /// core has opened it.
    fn split(&mut self, side: Side, cx: &mut Context<Self>) -> Result<(), String> {
        if self.tabs.active().is_none() {
            return Err("Open a session first.".into());
        }
        if !self.tabs.has_room() {
            return Err("A split holds at most four panes.".into());
        }
        if self
            .pending_split
            .is_some_and(|(_, at)| at.elapsed() < SPLIT_WAIT)
        {
            return Err("A split is already starting.".into());
        }
        let provider = perch_core::agent_fleet::TERMINAL_PROVIDER;
        self.sidebar
            .update(cx, |sidebar, cx| sidebar.launch(provider, cx))?;
        self.pending_split = Some((side, Instant::now()));
        Ok(())
    }

    /// Close a tab, which ends its session as in the web (`requestCloseSession`). A tab that only
    /// watches a session another view controls just leaves the view. An agent's tab asks first
    /// while Settings > Warn before closing an agent is on (it is until the core says otherwise),
    /// with the web's close guard drawn by the `confirm` screen (`CloseGuardProps`): stop for
    /// everyone ends it (and may turn the warning off), keep running only puts the tab away, and
    /// cancel keeps it. With no mod to ask through it is not ended. Everything else is ended at
    /// once. Ending asks the core to delete the session over the terminal's own
    /// connection, the one that holds the keyboard, because the core refuses to end a session
    /// another connection controls; the tab goes only when the core confirms it is deleted. If
    /// the core refuses, does not answer in time, or the connection drops, the tab stays and says
    /// the session is still running: an unconfirmed end is never taken for an end. The core
    /// deleting the session later still closes the tab, whatever the wait said. A tab with no
    /// attached terminal has no connection to ask over: it closes, and the session keeps running.
    fn close(&mut self, id: &str, cx: &mut Context<Self>) {
        let Some(pane) = self.panes.get(id) else {
            return;
        };
        if pane.closing.is_some() {
            return;
        }
        let open = pane.open.clone();
        let view = pane.view.clone();
        let watching = view.as_ref().is_some_and(|view| view.read(cx).watching());
        let can_end = view.as_ref().is_some_and(|view| view.read(cx).can_end());
        if watching || !can_end {
            let why = if watching {
                "Another view controls this session, so it keeps running."
            } else {
                "This window is not attached to the session, so it was not ended and keeps running."
            };
            self.put_away(id, why, cx);
            return;
        }
        let armed = self.armed_close.take().is_some_and(|armed| armed == id);
        if !armed && self.warns_before_ending(&open, cx) {
            if !self.screens.has("confirm", cx) {
                self.notice = Some(
                    "No mod draws the confirmation, so the agent was not stopped. The stock one is \
                     restored when the app starts."
                        .into(),
                );
                cx.notify();
                return;
            }
            let target = id.to_string();
            let label = self.title_of(id, cx);
            self.open_screen(
                "confirm",
                json!({ "sessionId": id, "label": label }),
                None,
                Some(Box::new(move |this, result, _, cx| {
                    if result.get("keepRunning").and_then(Value::as_bool) == Some(true) {
                        this.put_away(&target, "It keeps running.", cx);
                    } else if result.get("confirmed").and_then(Value::as_bool) == Some(true) {
                        if result.get("never").and_then(Value::as_bool) == Some(true) {
                            this.change(Change::WarnCloseAgent(false), cx);
                        }
                        this.armed_close = Some(target.clone());
                        this.close(&target, cx);
                    }
                })),
                cx,
            );
            return;
        }
        let id = id.to_string();
        let task = cx.spawn({
            let id = id.clone();
            async move |this, cx| {
                cx.background_executor().timer(END_WAIT).await;
                let _ = this.update(cx, |this, cx| {
                    this.close_unconfirmed(&id, "the core did not answer in time", cx)
                });
            }
        });
        if let Some(view) = view {
            view.update(cx, |view, _| view.end());
        }
        if let Some(pane) = self.panes.get_mut(&id) {
            pane.closing = Some(task);
        }
        self.notice = Some("Ending the session\u{2026}".into());
        cx.notify();
    }

    /// Take tab `id` out of this window without ending its session, saying `why` it keeps running.
    fn put_away(&mut self, id: &str, why: &str, cx: &mut Context<Self>) {
        let Some(pane) = self.panes.remove(id) else {
            return;
        };
        self.tabs.close(id);
        let again = if is_plain(&pane.open) {
            "Turn on Show terminals in the sidebar to open it again."
        } else {
            "It is still in the sidebar."
        };
        self.notice = Some(format!("Closed the tab. {why} {again}"));
        self.after_change(cx);
    }

    /// Whether ending this tab's session asks first: it runs an agent (what the core sees in it,
    /// else what it was launched with, as the web's `isAgentSession`) and the core's warning
    /// setting is on, which it is until the settings arrive.
    fn warns_before_ending(&self, open: &OpenSession, cx: &App) -> bool {
        let sidebar = self.sidebar.read(cx);
        let running = sidebar
            .find_session(&open.session_id)
            .and_then(|s| s.current_provider_id.as_deref())
            .or(open.provider_id.as_deref());
        running.is_some_and(|p| p != perch_core::agent_fleet::TERMINAL_PROVIDER)
            && sidebar
                .model()
                .terminal
                .as_ref()
                .is_none_or(|t| t.warn_close_agent)
    }

    /// Keep the terminals of the tabs out of sight within [`MAX_PARKED`], letting go of the ones
    /// longest unseen, and attach again any shown tab that was parked.
    fn keep_in_bounds(&mut self, cx: &mut Context<Self>) {
        self.tick += 1;
        let shown = self.tabs.shown();
        for id in &shown {
            let Some(pane) = self.panes.get_mut(id) else {
                continue;
            };
            pane.seen = self.tick;
            if pane.parked {
                let open = pane.open.clone();
                let view = self.attach(&open, cx);
                if let Some(pane) = self.panes.get_mut(id) {
                    pane.view = view;
                    pane.parked = false;
                }
            }
        }
        let mut hidden: Vec<(u64, String)> = self
            .panes
            .iter()
            .filter(|(id, pane)| {
                pane.view.is_some()
                    && pane.closing.is_none()
                    && !shown.contains(id)
                    && self.peek.as_ref() != Some(id)
            })
            .map(|(id, pane)| (pane.seen, id.clone()))
            .collect();
        if hidden.len() > MAX_PARKED {
            hidden.sort();
            for (_, id) in hidden.drain(..hidden.len() - MAX_PARKED) {
                if let Some(pane) = self.panes.get_mut(&id) {
                    pane.view = None;
                    pane.retry = None;
                    pane.parked = true;
                }
            }
        }
    }

    /// List a notification for the notifications screen: a session that finished or needs the
    /// person, or a usage alert. The screen says how long each stays.
    pub fn toast(&mut self, heard: Heard, cx: &mut Context<Self>) {
        self.notify(heard, None, cx);
    }

    /// List mod `mod_id`'s notification (`perch.notify`): about no session, so opening it runs
    /// its action, if any, and puts it away.
    pub fn notify_for_mod(
        &mut self,
        mod_id: &str,
        title: String,
        body: Option<String>,
        notice: Notice,
        cx: &mut Context<Self>,
    ) {
        let heard = Heard {
            alert: Alert::Usage,
            session_id: format!("mod:{mod_id}"),
            title,
            sound: false,
            file: None,
            toast: crate::sidebar::Toast::App,
            body,
        };
        self.notify(heard, Some(notice), cx);
    }

    fn notify(&mut self, heard: Heard, notice: Option<Notice>, cx: &mut Context<Self>) {
        self.next_notification += 1;
        self.notifications.push(Notification {
            id: format!("n{}", self.next_notification),
            heard,
            notice,
        });
        if self.notifications.len() > MAX_NOTIFICATIONS {
            self.notifications.remove(0);
        }
        cx.notify();
    }

    /// Open the pane menu at `at` for the pane `id`. A pane in a split takes the keyboard first,
    /// so the commands run on the pane that was clicked.
    fn open_menu(&mut self, id: &str, at: Point<Pixels>, cx: &mut Context<Self>) {
        self.focus_pane(id, cx);
        let Some(view) = self.panes.get(id).and_then(|p| p.view.clone()) else {
            return;
        };
        let can_stop = view.read(cx).can_stop();
        if self.screens.has("pane-menu", cx) {
            self.open_pane_menu(id, at, can_stop, cx);
        } else {
            self.notice = Some(
                "No mod draws the pane menu. The stock one is restored when the app starts.".into(),
            );
            cx.notify();
        }
    }

    /// Go to a session's tab, opening one if it has none: a peek of it becomes that tab.
    fn show_session(&mut self, id: &str, cx: &mut Context<Self>) -> Result<(), String> {
        let open = match self.panes.get(id) {
            Some(pane) => pane.open.clone(),
            None => self
                .sidebar
                .read(cx)
                .session_to_open(id)
                .ok_or("That session is gone.")?,
        };
        if self.peek.as_deref() == Some(id) {
            self.peek = None;
        }
        self.sidebar.update(cx, |sidebar, cx| {
            sidebar.open(open.host_id, open.session_id, open.provider_id, cx)
        });
        Ok(())
    }

    /// Show a session's terminal over the window without going to it. The shell keeps running; a
    /// second peek of the same session, or `terminal.park`, puts it away. A session with a tab
    /// already has its terminal there.
    fn toggle_peek(&mut self, id: &str, cx: &mut Context<Self>) -> Result<(), String> {
        if self.peek.as_deref() == Some(id) {
            self.park_peek(cx);
            return Ok(());
        }
        if self.tabs.contains(id) {
            return Err("That session is open in a tab; terminal.show goes to it.".into());
        }
        let open = self
            .sidebar
            .read(cx)
            .session_to_open(id)
            .ok_or("That session is gone.")?;
        self.park_peek(cx);
        let view = self.attach(&open, cx);
        self.panes.insert(
            id.to_string(),
            Pane {
                open,
                view,
                settle: Settle::default(),
                retry: None,
                attempts: 0,
                closing: None,
                seen: 0,
                parked: false,
            },
        );
        self.peek = Some(id.to_string());
        cx.notify();
        Ok(())
    }

    /// Put the peek away: its terminal lets go of the shell, which keeps running. False when
    /// there was none.
    fn park_peek(&mut self, cx: &mut Context<Self>) -> bool {
        let Some(id) = self.peek.take() else {
            return false;
        };
        if !self.tabs.contains(&id) {
            self.panes.remove(&id);
        }
        cx.notify();
        true
    }

    /// The peek, over the window.
    fn peek_view(&self, cx: &mut Context<Self>) -> Option<AnyElement> {
        let id = self.peek.as_ref()?;
        let view = self.panes.get(id)?.view.clone();
        let title = self.title_of(id, cx);
        let keep = id.clone();
        let link = |id: &'static str, text: &'static str| {
            div()
                .id(id)
                .cursor_pointer()
                .text_xs()
                .text_color(rgb(DIM_COLOR))
                .child(text)
        };
        let body = match view {
            Some(view) => div().flex_1().min_h_0().child(view),
            None => div()
                .flex_1()
                .flex()
                .items_center()
                .justify_center()
                .text_sm()
                .text_color(rgb(TITLE_COLOR))
                .child("No core to show this session"),
        };
        Some(
            div()
                .id("peek")
                .absolute()
                .inset_0()
                .flex()
                .items_center()
                .justify_center()
                .on_mouse_down(
                    MouseButton::Left,
                    cx.listener(|this, _, _, cx| {
                        this.park_peek(cx);
                    }),
                )
                .child(
                    div()
                        .w(relative(0.8))
                        .h(relative(0.7))
                        .flex()
                        .flex_col()
                        .rounded_md()
                        .border_1()
                        .border_color(rgb(OVERLAY_BORDER))
                        .bg(rgb(SIDEBAR_BG))
                        .overflow_hidden()
                        .on_mouse_down(MouseButton::Left, |_, _, cx| cx.stop_propagation())
                        .child(
                            div()
                                .flex()
                                .justify_between()
                                .px_3()
                                .py_1()
                                .child(div().text_sm().text_color(rgb(TITLE_COLOR)).child(title))
                                .child(
                                    div()
                                        .flex()
                                        .gap_3()
                                        .child(link("peek-keep", "Keep as tab").on_click(
                                            cx.listener(move |this, _, _, cx| {
                                                let result = this.show_session(&keep, cx);
                                                this.finish(result, cx);
                                            }),
                                        ))
                                        .child(link("peek-close", "Close").on_click(cx.listener(
                                            |this, _, _, cx| {
                                                this.park_peek(cx);
                                            },
                                        ))),
                                ),
                        )
                        .child(body),
                )
                .into_any_element(),
        )
    }

    /// Zoom every terminal, shown or kept, and say the level.
    fn zoom_to(&mut self, zoom: Zoom, cx: &mut Context<Self>) {
        self.zoom = zoom;
        for view in self.panes.values().filter_map(|pane| pane.view.as_ref()) {
            view.update(cx, |view, cx| view.set_zoom(zoom.factor(), cx));
        }
        self.notice = Some(format!("Zoom {}%", (zoom.factor() * 100.0).round()));
        cx.notify();
    }

    /// The core did not confirm that a closing tab's session ended. The tab stays open, and says
    /// the session is not known to have ended.
    fn close_unconfirmed(&mut self, id: &str, why: &str, cx: &mut Context<Self>) {
        let Some(pane) = self.panes.get_mut(id) else {
            return;
        };
        if pane.closing.take().is_none() {
            return;
        }
        self.notice = Some(format!(
            "The session is still running: {why}. The tab stays open; close it again to retry."
        ));
        cx.notify();
    }

    /// Take the size back from a phone for every terminal this window is attached to whose size a
    /// phone holds, as the web's `takeBackAllSizes` does: each is asked for its size alone, and a
    /// terminal this window already sizes is not asked at all. Nothing is attached for it.
    fn take_back_all(&mut self, cx: &mut Context<Self>) -> Result<(), String> {
        let asked = self
            .panes
            .values()
            .filter_map(|pane| pane.view.as_ref())
            .filter(|view| view.update(cx, |view, cx| view.perform(Action::TakeSize, cx)))
            .count();
        if asked == 0 {
            return Err("No phone holds the size of a terminal in this window.".into());
        }
        Ok(())
    }

    /// Tab `id`'s terminal, else the one on screen.
    fn terminal_named(&self, id: Option<&str>) -> Result<Entity<TerminalView>, String> {
        match id {
            Some(id) => self
                .panes
                .get(id)
                .and_then(|p| p.view.clone())
                .ok_or_else(|| format!("Tab {id} has no terminal.")),
            None => self
                .terminal()
                .cloned()
                .ok_or("No terminal is on screen.".into()),
        }
    }

    /// A terminal's named action (`terminal.find`, `terminal.scroll {pages: -1}`, ...) on the tab
    /// on screen. The key dispatcher and the Navigator both end here.
    fn terminal_command(
        &mut self,
        name: &str,
        args: Option<&Value>,
        cx: &mut Context<Self>,
    ) -> Result<(), String> {
        let id = args.and_then(|a| a.get("id")).and_then(Value::as_str);
        let view = self.terminal_named(id)?;
        // The action, and what to say if the view did nothing.
        let (action, nothing) = match name {
            "terminal.find" => (Action::Find, ""),
            "terminal.clear" => (Action::Clear, ""),
            "terminal.selectAll" => (Action::SelectAll, ""),
            "terminal.copy" => (Action::Copy, "Nothing is selected in that terminal."),
            "terminal.paste" => (
                Action::Paste,
                "Nothing was pasted: this terminal is view only, or the clipboard has no text.",
            ),
            "terminal.prevCommand" => (
                Action::Command(-1),
                "That terminal has no earlier command marked; the shell must report prompts (OSC 133).",
            ),
            "terminal.nextCommand" => (
                Action::Command(1),
                "That terminal is already at its newest command.",
            ),
            "terminal.scrollTop" => (Action::Scroll(Scroll::Top), ""),
            "terminal.scrollBottom" => (Action::Scroll(Scroll::Bottom), ""),
            "terminal.scrollPageUp" => (Action::Scroll(Scroll::Pages(-1.0)), ""),
            "terminal.scrollPageDown" => (Action::Scroll(Scroll::Pages(1.0)), ""),
            "terminal.scroll" => {
                let get = |key: &str| args.and_then(|a| a.get(key));
                let by = Scroll::parse(
                    get("lines").and_then(Value::as_i64),
                    get("pages").and_then(Value::as_f64),
                    get("to").and_then(Value::as_str),
                )?;
                (Action::Scroll(by), "")
            }
            "terminal.takeControl" => (
                Action::TakeControl,
                "Nothing to take: this view already controls the terminal, or it is not attached.",
            ),
            "terminal.takeBack" => (
                Action::TakeBack,
                "No phone holds this terminal's size, or it is not attached.",
            ),
            "terminal.kill" => (
                Action::Kill,
                "This terminal cannot be stopped from here: another view controls it, or it is not attached.",
            ),
            _ => return Err(format!("No command {name}.")),
        };
        if view.update(cx, |view, cx| view.perform(action, cx)) {
            Ok(())
        } else {
            Err(nothing.to_string())
        }
    }

    fn commit_scrollback(&mut self, cx: &mut Context<Self>) {
        let typed = self.settings.as_ref().and_then(|p| p.editing.clone());
        if let Some(n) = typed.as_deref().and_then(scrollback_from_text) {
            self.change(Change::Scrollback(n), cx);
            if let Some(panel) = self.settings.as_mut() {
                panel.editing = None;
            }
        }
        cx.notify();
    }

    fn change(&mut self, change: Change, cx: &mut Context<Self>) {
        self.sidebar.update(cx, |sidebar, _| {
            sidebar.send(Command::UpdateSettings(change.patch()))
        });
    }

    // Drawing

    /// The visible panes: a lone one fills the area, a split is rows and columns of them.
    fn node(
        &self,
        node: &Node,
        focused: Option<&str>,
        split: bool,
        cx: &mut Context<Self>,
    ) -> AnyElement {
        match node {
            Node::Pane(id) => {
                let boxes = self.drop_boxes.clone();
                let key = id.clone();
                let measure = canvas(
                    move |bounds, _, _| {
                        boxes.borrow_mut().panes.insert(key, bounds);
                    },
                    |_, _, _, _| {},
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full();
                div()
                    .relative()
                    .size_full()
                    .child(self.pane(id, focused == Some(id.as_str()) && split, cx))
                    .child(measure)
                    .into_any_element()
            }
            Node::Split { dir, kids, sizes } => {
                let mut row = div().flex().size_full().gap(px(PANE_GAP));
                row = match dir {
                    Dir::Row => row.flex_row(),
                    Dir::Col => row.flex_col(),
                };
                for (kid, size) in kids.iter().zip(sizes) {
                    row = row.child(
                        div()
                            .flex_basis(relative(*size))
                            .flex_grow(1.)
                            .flex_shrink(1.)
                            .min_w_0()
                            .min_h_0()
                            .child(self.node(kid, focused, split, cx)),
                    );
                }
                row.into_any_element()
            }
        }
    }

    fn pane(&self, id: &str, focused: bool, cx: &mut Context<Self>) -> AnyElement {
        let body = self.pane_body(id, focused, cx);
        match self.screens.inflow(&format!("pane-header#{id}")) {
            Some(header) => div()
                .size_full()
                .flex()
                .flex_col()
                .child(div().flex_none().h(px(PANE_HEADER_HEIGHT)).child(header))
                .child(div().flex_1().min_h_0().child(body))
                .into_any_element(),
            None => body,
        }
    }

    fn pane_body(&self, id: &str, focused: bool, cx: &mut Context<Self>) -> AnyElement {
        let target = id.to_string();
        let frame = div()
            .id(format!("pane-{id}"))
            .size_full()
            .overflow_hidden()
            .rounded_md()
            .border_1()
            .border_color(rgb(if focused { PANE_FOCUS } else { MAIN_BG }))
            .on_mouse_down(
                MouseButton::Left,
                cx.listener(move |this, _, _, cx| this.focus_pane(&target, cx)),
            );
        // What a mod draws over the terminal, in the pane's box: the agent's controls, the find
        // bar, the phone-size notice.
        let over = ["agent-control", "terminal-search", "phone-size"]
            .into_iter()
            .filter_map(|screen| self.screens.inflow(&format!("{screen}#{id}")))
            .map(|view| div().absolute().inset_0().child(view));
        match self.panes.get(id).and_then(|p| p.view.clone()) {
            Some(view) => frame
                .relative()
                .child(view)
                .children(over)
                .into_any_element(),
            None => frame
                .flex()
                .items_center()
                .justify_center()
                .text_sm()
                .text_color(rgb(TITLE_COLOR))
                .child(self.title_of(id, cx))
                .into_any_element(),
        }
    }

    fn settings_view(&self, cx: &mut Context<Self>) -> Option<AnyElement> {
        let panel = self.settings.as_ref()?;
        let terminal = self.sidebar.read(cx).model().terminal.clone();
        let row = |title: &str, note: &str| {
            div()
                .flex()
                .flex_col()
                .child(
                    div()
                        .text_sm()
                        .text_color(rgb(TITLE_COLOR))
                        .child(title.to_string()),
                )
                .child(
                    div()
                        .text_xs()
                        .text_color(rgb(DIM_COLOR))
                        .child(note.to_string()),
                )
        };
        let mut body = div().flex().flex_col().gap_3().p_3().child(
            div()
                .flex()
                .justify_between()
                .child(
                    div()
                        .text_color(rgb(TITLE_COLOR))
                        .child("Settings · Terminal"),
                )
                .child(
                    div()
                        .id("settings-close")
                        .cursor_pointer()
                        .text_xs()
                        .text_color(rgb(DIM_COLOR))
                        .child("Close")
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.settings = None;
                            cx.notify();
                        })),
                ),
        );
        let Some(terminal) = terminal else {
            body = body.child(hint("Waiting for the core"));
            return Some(self.overlay(
                "settings",
                520.,
                body,
                |this, cx| {
                    this.settings = None;
                    cx.notify();
                },
                cx,
            ));
        };
        let typed = panel.editing.clone();
        let valid = typed
            .as_deref()
            .is_none_or(|t| scrollback_from_text(t).is_some());
        let scrollback_box = div()
            .id("scrollback")
            .cursor_pointer()
            .px_2()
            .py_1()
            .rounded_sm()
            .bg(rgb(SELECTED_BG))
            .text_sm()
            .text_color(rgb(if valid { TITLE_COLOR } else { 0xe5484d }))
            .child(match &typed {
                Some(text) => format!("{text}▏"),
                None => terminal.scrollback.to_string(),
            })
            .on_click({
                let current = terminal.scrollback.to_string();
                cx.listener(move |this, _, _, cx| {
                    if let Some(panel) = this.settings.as_mut() {
                        panel.editing = Some(current.clone());
                    }
                    cx.notify();
                })
            });
        let sound_file = |file: &str| {
            if file.is_empty() {
                "the system alert".to_string()
            } else {
                file.to_string()
            }
        };
        let [across, down] = terminal.padding;
        body = body
            .child(setting_row(
                "Scrollback (lines)",
                &format!("{MIN_SCROLLBACK}\u{2013}{MAX_SCROLLBACK} lines, Enter to save. Open terminals follow at once."),
                scrollback_box.into_any_element(),
            ))
            .child(self.switch(
                "login-shell",
                "Login shell",
                "Spawn plain terminal panes as a login shell. Only for terminals created afterwards.",
                terminal.login_shell,
                Change::LoginShell(!terminal.login_shell),
                cx,
            ))
            .child(self.switch(
                "double-quotes",
                "Wrap dropped paths in double quotes",
                "Applies to file drops. Off uses single quotes.",
                terminal.dropped_path_double_quotes,
                Change::DroppedPathDoubleQuotes(!terminal.dropped_path_double_quotes),
                cx,
            ))
            .child(self.stepper(
                "contrast",
                "Minimum contrast",
                "Text below this ratio (1 to 21) is pushed toward black or white. 1 leaves colours alone.",
                format!("{:.1}", terminal.minimum_contrast),
                Change::MinimumContrast(stepped(terminal.minimum_contrast, -0.5, CONTRAST)),
                Change::MinimumContrast(stepped(terminal.minimum_contrast, 0.5, CONTRAST)),
                cx,
            ))
            .child(self.switch(
                "clipboard-write",
                "Programs may write the clipboard",
                "A program in a terminal can copy text with OSC 52.",
                terminal.clipboard_write,
                Change::ClipboardWrite(!terminal.clipboard_write),
                cx,
            ))
            .child(self.switch(
                "copy-on-select",
                "Copy on select",
                "Releasing a mouse selection in a terminal copies it.",
                terminal.copy_on_select,
                Change::CopyOnSelect(!terminal.copy_on_select),
                cx,
            ))
            .child(self.switch(
                "scrollbars",
                "Scrollbars",
                "A strip over the text edge while there is history to scroll.",
                terminal.pane_scrollbars,
                Change::PaneScrollbars(!terminal.pane_scrollbars),
                cx,
            ))
            .child(self.stepper(
                "padding-across",
                "Padding across (px)",
                "Space left and right of the text, 0 to 64.",
                format!("{across}"),
                Change::Padding([stepped(across, -2.0, PADDING), down]),
                Change::Padding([stepped(across, 2.0, PADDING), down]),
                cx,
            ))
            .child(self.stepper(
                "padding-down",
                "Padding down (px)",
                "Space above and below the text, 0 to 64.",
                format!("{down}"),
                Change::Padding([across, stepped(down, -2.0, PADDING)]),
                Change::Padding([across, stepped(down, 2.0, PADDING)]),
                cx,
            ))
            .child(self.stepper(
                "opacity",
                "Opacity",
                "0.1 to 1. Below 1, what is behind a terminal shows through.",
                format!("{:.1}", terminal.opacity),
                Change::Opacity(stepped(terminal.opacity, -0.1, OPACITY)),
                Change::Opacity(stepped(terminal.opacity, 0.1, OPACITY)),
                cx,
            ))
            .child(self.choice(
                "option-as-alt",
                "Option as Alt",
                "auto, on, off, left or right. This window treats on, left and right as auto.",
                &terminal.option_as_alt,
                Change::OptionAsAlt(next_choice(&OPTION_AS_ALT, &terminal.option_as_alt)),
                cx,
            ))
            .child(
                div()
                    .pt_2()
                    .text_xs()
                    .text_color(rgb(DIM_COLOR))
                    .child("Alerts"),
            )
            .child(self.switch(
                "sounds",
                "Alert sounds",
                "A sound when a session finishes or needs you and you are not looking at it.",
                terminal.sound_enabled,
                Change::SoundEnabled(!terminal.sound_enabled),
                cx,
            ))
            .child(row(
                "Sound files",
                &format!(
                    "Done: {}. Needs you: {}. Chosen in Perch.",
                    sound_file(&terminal.sound_done),
                    sound_file(&terminal.sound_blocked)
                ),
            ))
            .child(self.choice(
                "toasts",
                "Toasts",
                "app: a message in the window; system: a system notification; off.",
                &terminal.toast_delivery,
                Change::ToastDelivery(next_choice(&TOAST_DELIVERY, &terminal.toast_delivery)),
                cx,
            ))
            .child(
                div()
                    .text_xs()
                    .text_color(rgb(DIM_COLOR))
                    .child("Line height, ligatures and scroll speed have no setting in the core yet."),
            )
            .child(
                div().id("settings-handoff").cursor_pointer().text_xs().text_color(rgb(DIM_COLOR))
                    .child("Every other setting is in Perch: Open Settings in Perch")
                    .on_click(cx.listener(|this, _, _, cx| {
                        let result = this.hand_off(Place::Settings);
                        this.finish(result, cx);
                    })),
            );
        Some(self.overlay(
            "settings",
            520.,
            body,
            |this, cx| {
                this.settings = None;
                cx.notify();
            },
            cx,
        ))
    }

    fn switch(
        &self,
        id: &'static str,
        title: &str,
        note: &str,
        on: bool,
        flip: Change,
        cx: &mut Context<Self>,
    ) -> gpui::Div {
        let button = div()
            .id(id)
            .cursor_pointer()
            .px_2()
            .py_1()
            .rounded_sm()
            .text_sm()
            .bg(rgb(SELECTED_BG))
            .text_color(rgb(if on { 0x4caf6a } else { DIM_COLOR }))
            .child(if on { "On" } else { "Off" })
            .on_click(cx.listener(move |this, _, _, cx| {
                this.change(flip, cx);
                cx.notify();
            }));
        setting_row(title, note, button.into_any_element())
    }

    /// A value with a button either side that move it by one step. Each button saves the value it
    /// would give, so a click is one `settings.update`.
    #[allow(clippy::too_many_arguments)]
    fn stepper(
        &self,
        id: &'static str,
        title: &str,
        note: &str,
        shown: String,
        lower: Change,
        higher: Change,
        cx: &mut Context<Self>,
    ) -> gpui::Div {
        let button = |label: &'static str, id: String, change: Change, cx: &mut Context<Self>| {
            div()
                .id(SharedString::from(id))
                .cursor_pointer()
                .px_2()
                .py_1()
                .rounded_sm()
                .text_sm()
                .bg(rgb(SELECTED_BG))
                .text_color(rgb(TITLE_COLOR))
                .child(label)
                .on_click(cx.listener(move |this, _, _, cx| {
                    this.change(change, cx);
                    cx.notify();
                }))
        };
        let control = div()
            .flex()
            .items_center()
            .gap_1()
            .child(button("\u{2212}", format!("{id}-less"), lower, cx))
            .child(
                div()
                    .min_w(px(44.))
                    .flex()
                    .justify_center()
                    .text_sm()
                    .text_color(rgb(TITLE_COLOR))
                    .child(shown),
            )
            .child(button("+", format!("{id}-more"), higher, cx));
        setting_row(title, note, control.into_any_element())
    }

    /// A value that moves to the next of a few when clicked.
    fn choice(
        &self,
        id: &'static str,
        title: &str,
        note: &str,
        shown: &str,
        next: Change,
        cx: &mut Context<Self>,
    ) -> gpui::Div {
        let button = div()
            .id(id)
            .cursor_pointer()
            .px_2()
            .py_1()
            .rounded_sm()
            .text_sm()
            .bg(rgb(SELECTED_BG))
            .text_color(rgb(TITLE_COLOR))
            .child(shown.to_string())
            .on_click(cx.listener(move |this, _, _, cx| {
                this.change(next, cx);
                cx.notify();
            }));
        setting_row(title, note, button.into_any_element())
    }

    /// A box over the main area; a click outside it closes it.
    fn overlay(
        &self,
        id: &'static str,
        width: f32,
        body: gpui::Div,
        close: impl Fn(&mut Self, &mut Context<Self>) + 'static + Clone,
        cx: &mut Context<Self>,
    ) -> AnyElement {
        // Room above (48) and below (24) it, up to what a box of lists needs.
        let room = if self.viewport_height > 0.0 {
            (self.viewport_height - 72.).clamp(120., 560.)
        } else {
            560.
        };
        div()
            .id(id)
            .absolute()
            .inset_0()
            .flex()
            .justify_center()
            .pt(px(48.))
            .on_mouse_down(
                MouseButton::Left,
                cx.listener(move |this, _, _, cx| close(this, cx)),
            )
            .child(
                div()
                    .w(px(width))
                    .h_auto()
                    .max_h(px(room))
                    .overflow_hidden()
                    .rounded_md()
                    .border_1()
                    .border_color(rgb(OVERLAY_BORDER))
                    .bg(rgb(SIDEBAR_BG))
                    .on_mouse_down(MouseButton::Left, |_, _, cx| cx.stop_propagation())
                    .child(
                        div()
                            .id(SharedString::from(format!("{id}-body")))
                            .max_h(px(room - 2.))
                            .overflow_y_scroll()
                            .child(body),
                    ),
            )
            .into_any_element()
    }
}

/// A screen result's web action: `{action, args}`.
fn action_of(result: &Value) -> (Option<String>, Vec<Value>) {
    let action = result
        .get("action")
        .and_then(Value::as_str)
        .map(str::to_string);
    let args = result
        .get("args")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    (action, args)
}

/// Argument `at` of an action, as text.
fn word(args: &[Value], at: usize) -> Option<String> {
    args.get(at).and_then(Value::as_str).map(str::to_string)
}

/// A setting: its name and what it does on the left, its control on the right.
fn setting_row(title: &str, note: &str, control: AnyElement) -> gpui::Div {
    div()
        .flex()
        .justify_between()
        .items_center()
        .gap_3()
        .child(
            div()
                .flex()
                .flex_col()
                // The words give way to the control, which keeps its size.
                .flex_1()
                .min_w_0()
                .child(
                    div()
                        .text_sm()
                        .text_color(rgb(TITLE_COLOR))
                        .child(title.to_string()),
                )
                .child(
                    div()
                        .text_xs()
                        .text_color(rgb(DIM_COLOR))
                        .child(note.to_string()),
                ),
        )
        .child(div().flex_none().child(control))
}

impl gpui::Render for Workspace {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        self.viewport_height = f32::from(window.viewport_size().height);
        if window.focused(cx).is_none() {
            self.root_focus.focus(window, cx);
        }
        if self.activation.is_none() {
            let send = |active: bool, sidebar: &Entity<Sidebar>, cx: &App| {
                sidebar.read(cx).send(Command::WindowActive(active));
            };
            send(window.is_window_active(), &self.sidebar, cx);
            self.activation = Some(cx.observe_window_activation(
                window,
                move |this, window, cx| {
                    send(window.is_window_active(), &this.sidebar, cx);
                    // As the web's blur: a tab drag, or a press a mod follows, ends with nothing
                    // changed.
                    if !window.is_window_active() {
                        this.drag_ended(false, cx);
                        this.cancel_follow(cx);
                    }
                },
            ));
        }
        // Screens mods draw: the notifications screen is up while there are notifications, the
        // floating ones opened since the last draw get their views, the in-flow ones are placed.
        let toast_up = self.screens.is_open("toast");
        if self.notifications.is_empty() && toast_up {
            self.screens.take("toast", cx);
        } else if !self.notifications.is_empty() && !toast_up {
            self.screens.open("toast", json!({}), None, None, cx);
        }
        self.screens.realize(&self.screen_focus, window, cx);
        let wanted = self.inflow_wanted(cx);
        self.let_go_of_stale_hold(&wanted, cx);
        self.screens.place(wanted, window, cx);
        // A terminal that attaches takes the keyboard when it first draws; the tab that has it in
        // the layout keeps it. A modal screen has the keyboard while it is up.
        if self.settings.is_none()
            && self.screens.top_modal().is_none()
            && self.keyboard_held.is_none()
        {
            let peeked = self
                .peek
                .as_ref()
                .and_then(|id| self.panes.get(id))
                .and_then(|pane| pane.view.as_ref());
            if let Some(view) = peeked.or_else(|| self.terminal()) {
                let handle = view.focus_handle(cx);
                if !handle.is_focused(window) {
                    window.defer(cx, move |window, cx| handle.focus(window, cx));
                }
            }
        } else if self.screens.top_modal().is_some() && window.focused(cx).is_none() {
            // A press on a modal mod's background lets go of the keyboard; the screen's layer
            // takes it back, so Escape still reaches the window.
            let handle = self.screen_focus.clone();
            window.defer(cx, move |window, cx| handle.focus(window, cx));
        }
        // Every kept tab stays attached; the ones not on screen are told so, which ends their
        // focus and their redraws until their tab comes back. Any change to the layout (a tab
        // switch, a close, a zoom, a split) ends here.
        let shown = self.tabs.shown();
        let room = self.room.get();
        // Every pane on screen draws its box afresh below.
        self.drop_boxes.borrow_mut().panes.clear();
        // A blank session's choices follow the computer's launch list as it arrives.
        let choosing: Vec<_> = self
            .panes
            .values()
            .filter_map(|pane| Some((pane.view.clone()?, &pane.open.host_id)))
            .filter(|(view, _)| view.read(cx).choosing())
            .map(|(view, host)| (view, self.launch_choices(host, cx)))
            .collect();
        for (view, choices) in choosing {
            view.update(cx, |view, cx| view.set_choices(choices, cx));
        }
        for (id, pane) in &mut self.panes {
            let Some(view) = &pane.view else { continue };
            let on_screen = shown.contains(id) || self.peek.as_ref() == Some(id);
            view.update(cx, |view, cx| view.set_visible(on_screen, cx));
            if on_screen {
                pane.settle.reset();
            } else if let Some(room) = room {
                // A hidden tab's program redraws for the size its pane would have, once the
                // window and the cell have held still for two draws.
                let key = (room, view.read(cx).cell_key(window));
                if pane.settle.tick(key).is_some() {
                    view.update(cx, |view, _| view.size_while_hidden(room, window));
                }
            }
        }
        let (visible, needs) = {
            let sidebar = self.sidebar.read(cx);
            (sidebar.visible(), sidebar.needs_you())
        };
        let sidebar = if let Some(view) = self.screens.inflow("sidebar").filter(|_| visible) {
            let (width, _) = self.screens.size("sidebar", cx);
            div()
                .flex_none()
                .w(px(width))
                .h_full()
                .child(view)
                .into_any_element()
        } else if visible {
            // The stock `sidebar` mod draws the sidebar; without it its place says why.
            let why = if screens::mods(cx).is_none() {
                "Mods are off in this window, so nothing draws the sidebar."
            } else {
                "No mod draws the sidebar. The stock one is restored when the app starts."
            };
            div()
                .id("sidebar")
                .flex_none()
                .w(px(SIDEBAR_WIDTH))
                .h_full()
                .p_3()
                .bg(rgb(SIDEBAR_BG))
                .child(hint(why))
                .into_any_element()
        } else {
            // Hidden, the sidebar leaves a control that shows it, with the count that needs you.
            let toggle = self.sidebar.clone();
            div()
                .id("show-sidebar")
                .cursor_pointer()
                .p_2()
                .text_xs()
                .text_color(rgb(DIM_COLOR))
                .child(if needs > 0 {
                    format!("Sidebar · {needs}")
                } else {
                    "Sidebar".to_string()
                })
                .on_click(move |_, _, cx| {
                    toggle.update(cx, |sidebar, cx| {
                        sidebar.run_action("global.sidebar", cx);
                    })
                })
                .into_any_element()
        };
        let mut area = div().relative().flex().flex_col().flex_1().min_w_0();
        match self.tabs.visible() {
            Some(node) => {
                let split = matches!(node, Node::Split { .. });
                let focused = self.tabs.active().map(str::to_string);
                // The room one pane would have here, less the gap and the border around it.
                let room = self.room.clone();
                let measure = canvas(
                    move |bounds, _, _| {
                        let around = px(PANE_GAP + 2.);
                        room.set(Some(size(
                            (bounds.size.width - around).max(px(0.)),
                            (bounds.size.height - around).max(px(0.)),
                        )));
                    },
                    |_, _, _, _| {},
                )
                .absolute()
                .size_full();
                let bar = match self.screens.inflow("tabs") {
                    Some(view) => {
                        let (_, height) = self.screens.size("tabs", cx);
                        let boxes = self.drop_boxes.clone();
                        let measure = canvas(
                            move |bounds, _, _| boxes.borrow_mut().strip = Some(bounds),
                            |_, _, _, _| {},
                        )
                        .absolute()
                        .top_0()
                        .left_0()
                        .size_full();
                        div()
                            .relative()
                            .flex_none()
                            .h(px(height))
                            .child(view)
                            .child(measure)
                            .into_any_element()
                    }
                    // The stock `tabs` mod draws the strip; without it its place says why.
                    None => div()
                        .id("tab-strip-missing")
                        .flex_none()
                        .h(px(TAB_BAR_HEIGHT))
                        .px_2()
                        .flex()
                        .items_center()
                        .bg(rgb(TAB_BAR_BG))
                        .child(hint(if screens::mods(cx).is_none() {
                            "Mods are off in this window, so nothing draws the tab strip."
                        } else {
                            "No mod draws the tab strip. The stock one is restored when the app starts."
                        }))
                        .into_any_element(),
                };
                area = area.child(bar).child(
                    div()
                        .relative()
                        .flex_1()
                        .min_h_0()
                        .p(px(PANE_GAP / 2.))
                        .child(measure)
                        .child(self.node(&node, focused.as_deref(), split, cx)),
                );
            }
            // The stock `start` mod draws what the main area shows with nothing open; without it
            // its place says why.
            None => {
                let start = match self.screens.inflow("start") {
                    Some(view) => div()
                        .flex_1()
                        .min_h_0()
                        .w_full()
                        .child(view)
                        .into_any_element(),
                    None => div()
                        .id("start-missing")
                        .flex_1()
                        .flex()
                        .items_center()
                        .justify_center()
                        .child(hint(if screens::mods(cx).is_none() {
                            "Mods are off in this window, so nothing draws the start page."
                        } else {
                            "No mod draws the start page. The stock one is restored when the app starts."
                        }))
                        .into_any_element(),
                };
                area = area.child(start);
            }
        }
        if let Some(view) = self.screens.inflow("status") {
            let (_, height) = self.screens.size("status", cx);
            area = area.child(div().flex_none().w_full().h(px(height)).child(view));
        }
        let notice = self
            .notice
            .clone()
            .or_else(|| self.sidebar.read(cx).notice().map(str::to_string));
        if let Some(notice) = notice {
            area = area.child(
                div()
                    .absolute()
                    .bottom_2()
                    .left_3()
                    .text_xs()
                    .text_color(rgb(DIM_COLOR))
                    .child(notice),
            );
        }
        let floating: Vec<AnyElement> = self
            .screens
            .floating
            .iter()
            .filter_map(|open| self.floating_view(open))
            .collect();
        let overlays = self.settings_view(cx).into_iter().chain(self.peek_view(cx));
        // While a tab is pressed the window follows the pointer wherever it is, before anything
        // under it: what is under a drag does not react to it. While a press a mod follows lasts,
        // the pointer is forwarded to that mod, and only then.
        let follow = (self.drag.is_some() || self.follow.is_some()).then(|| {
            let this = cx.entity().downgrade();
            canvas(
                |_, _, _| {},
                move |_, _, window, _| {
                    let moved = this.clone();
                    window.on_mouse_event(move |event: &MouseMoveEvent, phase, _, cx| {
                        if phase != DispatchPhase::Capture {
                            return;
                        }
                        let _ = moved.update(cx, |this, cx| {
                            if event.pressed_button == Some(MouseButton::Left) {
                                this.drag_moved(event.position, cx);
                                this.forward_pointer("move", event.position, cx);
                            } else {
                                // The release was not seen: nothing changes.
                                this.drag_ended(false, cx);
                                this.forward_pointer("cancel", event.position, cx);
                            }
                        });
                    });
                    // A new press while one is still followed (its release was never seen): the
                    // followed one ends with nothing changed.
                    let pressed = this.clone();
                    window.on_mouse_event(move |_: &MouseDownEvent, phase, _, cx| {
                        if phase == DispatchPhase::Capture {
                            let _ = pressed.update(cx, |this, cx| this.cancel_follow(cx));
                        }
                    });
                    let released = this.clone();
                    window.on_mouse_event(move |event: &MouseUpEvent, phase, _, cx| {
                        if phase != DispatchPhase::Capture || event.button != MouseButton::Left {
                            return;
                        }
                        let dragged = released
                            .update(cx, |this, cx| {
                                this.forward_pointer("up", event.position, cx);
                                this.drag_ended(true, cx)
                            })
                            .unwrap_or(false);
                        // The release after a drag is not a click on what is under it.
                        if dragged {
                            cx.stop_propagation();
                        }
                    });
                },
            )
            .absolute()
            .top_0()
            .left_0()
            .size_full()
        });
        div()
            .relative()
            .flex()
            .size_full()
            .bg(rgb(MAIN_BG))
            .key_context("Workspace")
            .track_focus(&self.root_focus)
            .capture_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                if this.key(&event.keystroke, window, cx) {
                    cx.stop_propagation();
                }
            }))
            .child(sidebar)
            .child(area.children(overlays))
            // Over the whole window: it opens where the pointer was, in window coordinates.
            .children(floating)
            .children(follow)
    }
}

#[cfg(test)]
mod tests {
    use super::Settle;

    #[test]
    fn a_size_is_applied_once_it_holds_for_two_draws() {
        let mut settle = Settle::<(u32, u32)>::default();
        // A window being dragged passes through sizes; none of them holds.
        assert_eq!(settle.tick((100, 50)), None);
        assert_eq!(settle.tick((110, 50)), None);
        assert_eq!(settle.tick((120, 50)), None);
        // It stops: the second draw at the same size applies it, and only once.
        assert_eq!(settle.tick((120, 50)), Some((120, 50)));
        assert_eq!(settle.tick((120, 50)), None);
        // Shown, the pane sizes itself; when hidden again the same size is applied afresh.
        settle.reset();
        assert_eq!(settle.tick((120, 50)), Some((120, 50)));
    }
}

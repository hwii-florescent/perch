//! The window: the [`Sidebar`] beside the main area, which holds the tab strip, the terminals of
//! the tabs and their splits, the command palette and the terminal settings.
//!
//! What a tab, a split and a key mean is decided elsewhere (`tabs`, `keymap`, `palette`,
//! `settings`); this draws it and runs the commands. A tab is a session shown as a
//! [`TerminalView`]. Only the tabs on screen are drawn: a terminal that is not drawn is not laid
//! out, so it never asks the core for a size, and it keeps the size it last had and keeps
//! following its shell, ready for when its tab is shown again.
//!
//! The layout is this window's alone, as the web's is per viewer: it is not sent to the core.
//! Splitting starts a new terminal session on this computer and shows it beside the focused one.
//! Closing a tab ends its session only when it is a plain terminal this window holds the keyboard
//! of; any other tab is only put away, and its session keeps running and stays in the sidebar.

use crate::client::{Command, Core};
use crate::handoff::{open_in_perch, perch_url, Place};
use crate::keymap::{Context as KeyContext, Hit, Keymap};
use crate::palette::{self, Entry, Kind, Outcome, Palette, SessionRef};
use crate::settings::{
    next_choice, scrollback_from_text, stepped, Change, CONTRAST, MAX_SCROLLBACK, MIN_SCROLLBACK,
    OPACITY, OPTION_AS_ALT, PADDING, TOAST_DELIVERY,
};
use crate::sidebar::{Attention, Heard, LOCAL};
use crate::tabs::{Dir, Node, Side, Tabs};
use crate::terminal::actions::{Action, Scroll};
use crate::terminal::attach::FromCore;
use crate::terminal::clipboard::{Clipboard, SystemClipboard};
use crate::terminal::{Status, TerminalEvent, TerminalView};
use crate::ui::{
    hint, label, tint, LaunchFailed, OpenSession, Sidebar, DIM_COLOR, MAIN_BG, SELECTED_BG,
    SIDEBAR_BG, TITLE_COLOR,
};
use crate::zoom::Zoom;
use futures::channel::mpsc::UnboundedSender;
use gpui::{
    canvas, div, prelude::*, px, relative, rgb, size, AnyElement, App, Context, Entity, Focusable,
    KeyDownEvent, Keystroke, MouseButton, Pixels, Point, SharedString, Size, Subscription, Task,
    Window,
};
use serde_json::Value;
use std::cell::Cell;
use std::collections::HashMap;
use std::rc::Rc;
use std::time::{Duration, Instant};

/// How long a follow-up key after the leader chord is awaited.
const LEADER_TIMEOUT: Duration = Duration::from_millis(1500);
/// How many tabs out of sight keep their terminal attached. A tab beyond them is parked: its
/// terminal lets go of the shell (which keeps running) and attaches again, with the core's
/// repaint, when the tab is shown.
const MAX_PARKED: usize = 12;
/// How long a toast stays before it goes by itself.
const TOAST_FOR: Duration = Duration::from_secs(8);
/// How long the core has to confirm that a session ended before the tab says it is still running.
const END_WAIT: Duration = Duration::from_secs(5);
/// How long to wait before attaching a dropped terminal to the core again: it doubles from the
/// first wait to the last, and stays there for as long as the core is away.
const REATTACH_FIRST: Duration = Duration::from_millis(250);
const REATTACH_LAST: Duration = Duration::from_secs(5);

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
const PALETTE_ROWS: usize = 10;

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

/// A message in the window about a session that finished or needs the person.
struct Toast {
    session_id: String,
    text: String,
    /// Takes the toast away after [`TOAST_FOR`].
    _timer: Task<()>,
}

/// The menu a right-click in a pane opens: its entries are commands, run on that pane.
struct PaneMenu {
    at: Point<Pixels>,
    /// The label and the command each runs.
    items: Vec<(&'static str, &'static str)>,
}

pub struct Workspace {
    sidebar: Entity<Sidebar>,
    locate: Option<Locate>,
    tabs: Tabs,
    panes: HashMap<String, Pane>,
    /// A split that was asked for and waits for its new terminal to be opened.
    pending_split: Option<(Side, Instant)>,
    palette: Option<Palette>,
    settings: Option<SettingsPanel>,
    /// The zoom every terminal in the window is at.
    zoom: Zoom,
    /// Counts the changes of what is on screen, for [`Pane::seen`].
    tick: u64,
    menu: Option<PaneMenu>,
    toast: Option<Toast>,
    /// The window's height as last drawn, which keeps an overlay inside it.
    viewport_height: f32,
    /// The session whose terminal is over the window for a moment (`terminal.peek`), with no tab
    /// of its own unless it is kept.
    peek: Option<String>,
    /// The leader chord was pressed; dropped when its time is up.
    leader: Option<Task<()>>,
    /// What the last command could not do, or did instead.
    notice: Option<String>,
    /// The room a lone pane has in the main area, as of the last draw: what a hidden pane is
    /// sized for.
    room: Rc<Cell<Option<Size<Pixels>>>>,
    /// Where the terminals copy to and paste from: the system's, unless a test says otherwise.
    clipboard: Rc<dyn Clipboard>,
    _subscriptions: Vec<Subscription>,
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
        // The sidebar's own changes (hiding it, a count, a session's state) redraw the window.
        let observed = cx.observe(&sidebar, |_, _, cx| cx.notify());
        Self {
            sidebar,
            locate: None,
            tabs: Tabs::default(),
            panes: HashMap::new(),
            pending_split: None,
            palette: None,
            settings: None,
            zoom: Zoom::default(),
            tick: 0,
            menu: None,
            toast: None,
            viewport_height: 0.0,
            peek: None,
            leader: None,
            notice: None,
            room: Rc::new(Cell::new(None)),
            clipboard: Rc::new(SystemClipboard),
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

    /// The session of the tab with the keyboard.
    pub fn open(&self) -> Option<&OpenSession> {
        Some(&self.panes.get(self.tabs.active()?)?.open)
    }

    /// The labels of the pane menu, when it is open.
    pub fn menu_labels(&self) -> Option<Vec<&'static str>> {
        Some(
            self.menu
                .as_ref()?
                .items
                .iter()
                .map(|(label, _)| *label)
                .collect(),
        )
    }

    /// The session peeked at, when there is one.
    pub fn peeked(&self) -> Option<&str> {
        self.peek.as_deref()
    }

    pub fn palette_open(&self) -> bool {
        self.palette.is_some()
    }

    pub fn settings_open(&self) -> bool {
        self.settings.is_some()
    }

    pub fn leader_armed(&self) -> bool {
        self.leader.is_some()
    }

    /// What the last command could not do, or did instead.
    pub fn notice(&self) -> Option<&str> {
        self.notice.as_deref()
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
        if !self.panes.contains_key(&id) {
            let view = self.attach(event, cx);
            self.panes.insert(
                id.clone(),
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
        match side {
            Some(side) if self.tabs.split(&id, side) => {}
            Some(_) => {
                self.notice = Some("The split is full: it opened as a tab.".into());
                self.tabs.open(&id);
            }
            None => self.tabs.open(&id),
        }
        self.keep_in_bounds(cx);
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
        let id = open.session_id.clone();
        cx.subscribe(&view, move |this, _, event: &TerminalEvent, cx| {
            this.on_terminal(&id, event, cx)
        })
        .detach();
        Some(view)
    }

    /// What a terminal tells the window.
    fn on_terminal(&mut self, id: &str, event: &TerminalEvent, cx: &mut Context<Self>) {
        match event {
            // A click on a link is a person's: the window runs the system's handler for it.
            TerminalEvent::OpenLink(target) => crate::terminal::links::open_in_system(target),
            TerminalEvent::MenuAsked(at) => self.open_menu(id, *at, cx),
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
            TerminalEvent::Ended => {
                if self.panes.get(id).is_some_and(|p| p.closing.is_some()) {
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

    /// Give the keyboard to the pane the person clicked.
    fn focus_pane(&mut self, id: &str, cx: &mut Context<Self>) {
        if self.tabs.active() != Some(id) && self.tabs.show(id) {
            self.after_change(cx);
        }
    }

    /// One key press, before the focused terminal sees it. True when it was handled here.
    fn key(&mut self, keystroke: &Keystroke, window: &mut Window, cx: &mut Context<Self>) -> bool {
        let keymap = self.keymap(cx);
        if self.palette.is_some() {
            self.palette_key(keystroke, &keymap, window, cx);
            return true;
        }
        // A menu closes on any key; Escape is only that.
        if self.menu.take().is_some() {
            cx.notify();
            if keystroke.key == "escape" {
                return true;
            }
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
            match palette::edit(text, keystroke) {
                palette::Edit::Ignored => {}
                palette::Edit::Changed => {
                    cx.notify();
                    return true;
                }
                palette::Edit::Escape => {
                    if let Some(panel) = self.settings.as_mut() {
                        panel.editing = None;
                    }
                    cx.notify();
                    return true;
                }
                palette::Edit::Enter => {
                    self.commit_scrollback(cx);
                    return true;
                }
            }
        }
        let context = KeyContext {
            in_terminal: self.focused_terminal(window, cx).is_some(),
            typing: false,
            leader: self.leader.is_some(),
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
                if let Err(error) = self.run_command(&name, args.as_ref(), window, cx) {
                    self.notice = Some(error);
                    cx.notify();
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
            Hit::Terminal => false,
            Hit::Fault(error) => {
                self.notice = Some(format!("keys.json: {error}"));
                cx.notify();
                true
            }
            Hit::LeaderEnded => {
                self.leader = None;
                cx.notify();
                // Escape ends it quietly; any other key still reaches the program.
                keystroke.key == "escape"
            }
        }
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

    fn palette_key(
        &mut self,
        keystroke: &Keystroke,
        keymap: &Keymap,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let m = keystroke.modifiers;
        let navigates = m.control && matches!(keystroke.key.as_str(), "n" | "p" | "j" | "k");
        let toggles = !navigates
            && matches!(
                keymap.resolve(
                    keystroke,
                    KeyContext {
                        typing: true,
                        ..Default::default()
                    }
                ),
                Some(Hit::Run { name, .. }) if matches!(name.as_str(), "global.navigator" | "global.navigatorAlt")
            );
        let Some(palette) = self.palette.as_mut() else {
            return;
        };
        let outcome = if toggles {
            Outcome::Close
        } else {
            palette.key(keystroke)
        };
        match outcome {
            Outcome::Nothing => {}
            Outcome::Close => self.palette = None,
            Outcome::Submit { command, text } => {
                self.palette = None;
                let args = serde_json::json!({ "name": text });
                let result = self.run_command(&command, Some(&args), window, cx);
                self.finish(result, cx);
            }
            Outcome::Run(entry) if entry.kind == Kind::Prompt => {
                let current = self.active_title(cx);
                if let Some(palette) = self.palette.as_mut() {
                    palette.ask(&entry.id, "Rename tab", &current);
                }
            }
            Outcome::Run(entry) => {
                self.palette = None;
                let result = self.run_entry(&entry, window, cx);
                self.finish(result, cx);
            }
        }
        cx.notify();
    }

    fn finish(&mut self, result: Result<(), String>, cx: &mut Context<Self>) {
        if let Err(error) = result {
            self.notice = Some(error);
        }
        cx.notify();
    }

    fn run_entry(
        &mut self,
        entry: &Entry,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Result<(), String> {
        match entry.kind {
            Kind::Command | Kind::Prompt => self.run_command(&entry.id, None, window, cx),
            Kind::Session => {
                let id = entry.id.trim_start_matches("session:").to_string();
                let (host, provider) = self
                    .sidebar
                    .read(cx)
                    .find_session(&id)
                    .map(|s| (s.host_id.clone(), s.provider_id.clone()))
                    .ok_or("That session is gone.")?;
                self.sidebar
                    .update(cx, |sidebar, cx| sidebar.open(host, id, provider, cx));
                Ok(())
            }
            Kind::Launch => {
                let provider = entry.id.trim_start_matches("launch:").to_string();
                self.sidebar
                    .update(cx, |sidebar, cx| sidebar.launch(&provider, cx))
            }
            Kind::HandOff => {
                let place = match entry.id.trim_start_matches("handoff:") {
                    "files" => Place::Files,
                    "changes" => Place::Changes,
                    "browser" => Place::Browser,
                    "chat" => Place::Chat,
                    _ => Place::Settings,
                };
                self.hand_off(place)
            }
        }
    }

    /// Only a person's choice calls this: it brings the Perch app forward.
    fn hand_off(&self, place: Place) -> Result<(), String> {
        let session = self.tabs.active();
        open_in_perch(&perch_url(session, place)).map_err(|e| e.to_string())
    }

    fn active_title(&self, cx: &App) -> String {
        self.tabs
            .active()
            .map(|id| self.title_of(id, cx))
            .unwrap_or_default()
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
        let plain = pane.is_some_and(|p| {
            p.open
                .provider_id
                .as_deref()
                .is_none_or(|id| id == perch_core::agent_fleet::TERMINAL_PROVIDER)
        });
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
        match name {
            "global.navigator" | "global.navigatorAlt" | "app.palette" => self.toggle_palette(cx),
            "global.settings" | "app.settings" => {
                self.settings = match self.settings {
                    Some(_) => None,
                    None => Some(SettingsPanel::default()),
                };
                cx.notify();
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
            "tabs.new" | "tab.new" => {
                self.sidebar
                    .update(cx, |sidebar, cx| sidebar.run_action("sessions.new", cx));
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
            _ if name.starts_with("terminal.") => self.terminal_command(name, args, cx)?,
            _ if name.starts_with("tabs.jump") => {
                let n = name["tabs.jump".len()..].parse().ok();
                self.select(Some(n.ok_or_else(|| format!("No command {name}."))?), cx)?;
            }
            _ => {
                let handled = self
                    .sidebar
                    .update(cx, |sidebar, cx| sidebar.run_action(name, cx));
                if !handled {
                    return Err(format!("No command {name}."));
                }
            }
        }
        let _ = window;
        Ok(())
    }

    fn toggle_palette(&mut self, cx: &mut Context<Self>) {
        if self.palette.take().is_some() {
            cx.notify();
            return;
        }
        let keymap = self.keymap(cx);
        let sidebar = self.sidebar.read(cx);
        let sessions: Vec<SessionRef> = sidebar
            .model()
            .hosts
            .iter()
            .flat_map(|h| &h.projects)
            .flat_map(|p| {
                p.sessions
                    .iter()
                    .chain(p.workspaces.iter().flat_map(|w| &w.sessions))
            })
            .map(|s| SessionRef {
                id: s.id.clone(),
                title: s.title.clone(),
            })
            .collect();
        let providers = sidebar
            .model()
            .hosts
            .iter()
            .find(|h| h.id == LOCAL)
            .map(|h| h.providers.clone())
            .unwrap_or_default();
        self.palette = Some(Palette::new(palette::entries(
            &keymap,
            &sessions,
            &providers,
            self.tabs.active().is_some(),
        )));
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

    /// Close a tab. A plain terminal this window types for ends with its tab, as in the web (the
    /// core reports a shell that was used as working for good, so its state says nothing about
    /// whether a job runs), and the tab goes only when the core confirms that it ended. The
    /// request goes over the terminal's own connection, the one that holds the keyboard, because
    /// the core refuses to end a session another connection controls. If the core refuses, does
    /// not answer in time, or the connection drops, the tab stays and says the terminal is still
    /// running: an unconfirmed stop is never taken for an end.
    /// Anything else, an agent above all, is put away and keeps running; ending it is a choice
    /// made where it can be confirmed.
    fn close(&mut self, id: &str, cx: &mut Context<Self>) {
        let Some(pane) = self.panes.get(id) else {
            return;
        };
        if pane.closing.is_some() {
            return;
        }
        let plain = pane
            .open
            .provider_id
            .as_deref()
            .is_none_or(|p| p == perch_core::agent_fleet::TERMINAL_PROVIDER);
        let asked = plain
            && pane.open.host_id == LOCAL
            && pane
                .view
                .as_ref()
                .is_some_and(|view| view.update(cx, |view, _| view.end()));
        if asked {
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
            if let Some(pane) = self.panes.get_mut(&id) {
                pane.closing = Some(task);
            }
            self.notice = Some("Ending the terminal…".into());
            cx.notify();
            return;
        }
        self.tabs.close(id);
        self.panes.remove(id);
        self.notice = Some(if plain {
            "Closed the tab. The terminal keeps running; turn on Show terminals in the sidebar to open it again."
        } else {
            "Closed the tab. The session keeps running; it is still in the sidebar."
        }
        .into());
        self.after_change(cx);
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

    /// Show a toast for a session that finished or needs the person: it goes by itself, or when
    /// clicked, which also opens the session. Only the newest is kept.
    pub fn toast(&mut self, heard: Heard, cx: &mut Context<Self>) {
        let session_id = heard.session_id.clone();
        let mine = session_id.clone();
        let timer = cx.spawn(async move |this, cx| {
            cx.background_executor().timer(TOAST_FOR).await;
            let _ = this.update(cx, |this, cx| {
                if this.toast.as_ref().is_some_and(|t| t.session_id == mine) {
                    this.toast = None;
                    cx.notify();
                }
            });
        });
        self.toast = Some(Toast {
            session_id,
            text: heard.text(),
            _timer: timer,
        });
        cx.notify();
    }

    /// The toast's text, while one is up.
    pub fn toast_text(&self) -> Option<&str> {
        self.toast.as_ref().map(|t| t.text.as_str())
    }

    fn toast_view(&self, cx: &mut Context<Self>) -> Option<AnyElement> {
        let toast = self.toast.as_ref()?;
        let session = toast.session_id.clone();
        Some(
            div()
                .id("toast")
                .absolute()
                .top(px(TAB_BAR_HEIGHT + 12.))
                .right_3()
                .max_w(px(360.))
                .px_3()
                .py_2()
                .rounded_md()
                .border_1()
                .border_color(rgb(OVERLAY_BORDER))
                .bg(rgb(SIDEBAR_BG))
                .cursor_pointer()
                .text_sm()
                .text_color(rgb(TITLE_COLOR))
                .child(toast.text.clone())
                .on_click(cx.listener(move |this, _, _, cx| {
                    this.toast = None;
                    let result = this.show_session(&session, cx);
                    this.finish(result, cx);
                }))
                .into_any_element(),
        )
    }

    /// Open the pane menu at `at` for the pane `id`. A pane in a split takes the keyboard first,
    /// so the commands run on the pane that was clicked.
    fn open_menu(&mut self, id: &str, at: Point<Pixels>, cx: &mut Context<Self>) {
        self.focus_pane(id, cx);
        let Some(view) = self.panes.get(id).and_then(|p| p.view.clone()) else {
            return;
        };
        let can_stop = view.read(cx).can_stop();
        let mut items = vec![
            ("Copy", "terminal.copy"),
            ("Paste", "terminal.paste"),
            ("Select all", "terminal.selectAll"),
            ("Find\u{2026}", "terminal.find"),
            ("Clear", "terminal.clear"),
            ("Split right", "panes.splitRight"),
            ("Split down", "panes.splitDown"),
        ];
        if self.tabs.zoomed() {
            items.push(("Restore pane", "panes.zoom"));
        } else if self.tabs.shown().len() > 1 {
            items.push(("Zoom pane", "panes.zoom"));
        }
        if can_stop {
            items.push(("Stop the terminal", "terminal.kill"));
        }
        items.push(("Close", "tabs.close"));
        self.menu = Some(PaneMenu { at, items });
        cx.notify();
    }

    fn menu_view(&self, cx: &mut Context<Self>) -> Option<AnyElement> {
        let menu = self.menu.as_ref()?;
        let mut list = div()
            .absolute()
            .left(menu.at.x)
            .top(menu.at.y)
            .min_w(px(180.))
            .py_1()
            .rounded_md()
            .border_1()
            .border_color(rgb(OVERLAY_BORDER))
            .bg(rgb(SIDEBAR_BG))
            .on_mouse_down(MouseButton::Left, |_, _, cx| cx.stop_propagation())
            .on_mouse_down(MouseButton::Right, |_, _, cx| cx.stop_propagation());
        for (at, (label, command)) in menu.items.iter().copied().enumerate() {
            list = list.child(
                div()
                    .id(SharedString::from(format!("menu-{at}")))
                    .cursor_pointer()
                    .px_3()
                    .py_1()
                    .text_sm()
                    .text_color(rgb(TITLE_COLOR))
                    .hover(|row| row.bg(rgb(SELECTED_BG)))
                    .child(label)
                    .on_click(cx.listener(move |this, _, window, cx| {
                        this.menu = None;
                        if let Err(error) = this.run_command(command, None, window, cx) {
                            this.notice = Some(error);
                        }
                        cx.notify();
                    })),
            );
        }
        // A click anywhere else closes it.
        Some(
            div()
                .id("pane-menu")
                .absolute()
                .inset_0()
                .on_mouse_down(
                    MouseButton::Left,
                    cx.listener(|this, _, _, cx| {
                        this.menu = None;
                        cx.notify();
                    }),
                )
                .on_mouse_down(
                    MouseButton::Right,
                    cx.listener(|this, _, _, cx| {
                        this.menu = None;
                        cx.notify();
                    }),
                )
                .child(list)
                .into_any_element(),
        )
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
    /// the terminal is not known to have stopped.
    fn close_unconfirmed(&mut self, id: &str, why: &str, cx: &mut Context<Self>) {
        let Some(pane) = self.panes.get_mut(id) else {
            return;
        };
        if pane.closing.take().is_none() {
            return;
        }
        self.notice = Some(format!(
            "The terminal is still running: {why}. The tab stays open; close it again to retry."
        ));
        cx.notify();
    }

    /// A terminal's named action (`terminal.find`, `terminal.scroll {pages: -1}`, ...) on the tab
    /// on screen. The key dispatcher and the palette both end here.
    fn terminal_command(
        &mut self,
        name: &str,
        args: Option<&Value>,
        cx: &mut Context<Self>,
    ) -> Result<(), String> {
        let view = self
            .terminal()
            .cloned()
            .ok_or("No terminal is on screen.")?;
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

    fn tab_bar(&self, cx: &mut Context<Self>) -> gpui::Div {
        let shown = self.tabs.shown();
        let active = self.tabs.active().map(str::to_string);
        let mut bar = div()
            .flex()
            .flex_none()
            .items_center()
            .gap_1()
            .h(px(TAB_BAR_HEIGHT))
            .px_2()
            .bg(rgb(TAB_BAR_BG))
            .text_sm();
        for id in self.tabs.strip() {
            let is_active = active.as_deref() == Some(id.as_str());
            let in_split = shown.len() > 1 && shown.contains(id);
            let attention = self
                .sidebar
                .read(cx)
                .find_session(id)
                .and_then(|s| s.attention);
            let dot = attention.map_or(DIM_COLOR, |a| tint(a).0);
            let (select, close) = (id.clone(), id.clone());
            let mut tab = div()
                .id(format!("tab-{id}"))
                .cursor_pointer()
                .flex()
                .items_center()
                .gap_2()
                .px_2()
                .h(px(TAB_BAR_HEIGHT - 6.))
                .max_w(px(220.))
                .rounded_sm()
                .text_color(rgb(if is_active { TITLE_COLOR } else { DIM_COLOR }))
                .on_click(cx.listener(move |this, _, _, cx| {
                    if this.tabs.show(&select) {
                        this.after_change(cx);
                    }
                }))
                .child(div().flex_none().size(px(8.)).rounded_full().bg(rgb(dot)))
                .child(div().truncate().child(self.title_of(id, cx)));
            if is_active {
                tab = tab.bg(rgb(SELECTED_BG));
            } else if in_split {
                tab = tab.text_color(rgb(0xb0b0b8));
            }
            if attention == Some(Attention::NeedsYou) {
                tab = tab.child(label(Attention::NeedsYou));
            }
            tab = tab.child(
                div()
                    .id(format!("close-{id}"))
                    .flex_none()
                    .text_color(rgb(DIM_COLOR))
                    .child("×")
                    .on_click(cx.listener(move |this, _, _, cx| {
                        cx.stop_propagation();
                        this.close(&close, cx);
                    })),
            );
            bar = bar.child(tab);
        }
        bar = bar.child(
            div()
                .id("new-tab")
                .cursor_pointer()
                .px_2()
                .text_color(rgb(DIM_COLOR))
                .child("+")
                .on_click(cx.listener(|this, _, window, cx| {
                    let result = this.run_command("tabs.new", None, window, cx);
                    this.finish(result, cx);
                })),
        );
        if self.leader.is_some() {
            bar = bar.child(
                div()
                    .text_xs()
                    .text_color(rgb(DIM_COLOR))
                    .child("Leader… press a key"),
            );
        }
        bar.child(div().flex_1())
            .child(self.bar_link(
                "open-palette",
                "Commands",
                cx.listener(|this, _, _, cx| this.toggle_palette(cx)),
            ))
            .child(self.bar_link(
                "open-settings",
                "Settings",
                cx.listener(|this, _, _, cx| {
                    this.settings = Some(SettingsPanel::default());
                    cx.notify();
                }),
            ))
    }

    fn bar_link(
        &self,
        id: &'static str,
        text: &'static str,
        on_click: impl Fn(&gpui::ClickEvent, &mut Window, &mut App) + 'static,
    ) -> gpui::Stateful<gpui::Div> {
        div()
            .id(id)
            .cursor_pointer()
            .px_2()
            .text_xs()
            .text_color(rgb(DIM_COLOR))
            .child(text)
            .on_click(on_click)
    }

    /// The visible panes: a lone one fills the area, a split is rows and columns of them.
    fn node(
        &self,
        node: &Node,
        focused: Option<&str>,
        split: bool,
        cx: &mut Context<Self>,
    ) -> AnyElement {
        match node {
            Node::Pane(id) => self.pane(id, focused == Some(id.as_str()) && split, cx),
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
        match self.panes.get(id).and_then(|p| p.view.clone()) {
            Some(view) => frame.child(view).into_any_element(),
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

    fn palette_view(&self, cx: &mut Context<Self>) -> Option<AnyElement> {
        let palette = self.palette.as_ref()?;
        let mut list = div().flex().flex_col();
        let header = |text: String| {
            div()
                .px_3()
                .py_2()
                .border_b_1()
                .border_color(rgb(OVERLAY_BORDER))
                .text_color(rgb(TITLE_COLOR))
                .child(text)
        };
        if let Some(prompt) = &palette.prompt {
            list = list
                .child(
                    div()
                        .px_3()
                        .pt_2()
                        .text_xs()
                        .text_color(rgb(DIM_COLOR))
                        .child(prompt.label.clone()),
                )
                .child(header(format!("{}▏", prompt.text)));
        } else {
            list = list.child(header(if palette.query.is_empty() {
                "Type a command, a session or an agent▏".to_string()
            } else {
                format!("{}▏", palette.query)
            }));
            let shown = palette.shown();
            let start = palette.selected.saturating_sub(PALETTE_ROWS - 1);
            for (i, entry) in shown.iter().enumerate().skip(start).take(PALETTE_ROWS) {
                let picked = i == palette.selected;
                let entry_owned = (*entry).clone();
                let mut row = div()
                    .id(format!("palette-{i}"))
                    .cursor_pointer()
                    .flex()
                    .items_center()
                    .gap_2()
                    .px_3()
                    .py_1()
                    .text_sm()
                    .text_color(rgb(if picked { TITLE_COLOR } else { 0xb0b0b8 }))
                    .on_click(cx.listener(move |this, _, window, cx| {
                        this.palette = None;
                        let result = this.run_entry(&entry_owned, window, cx);
                        this.finish(result, cx);
                    }))
                    .child(div().truncate().child(entry.title.clone()))
                    .child(
                        div()
                            .flex_1()
                            .truncate()
                            .text_xs()
                            .text_color(rgb(DIM_COLOR))
                            .child(entry.id.clone()),
                    );
                if let Some(keys) = &entry.keys {
                    row = row.child(
                        div()
                            .flex_none()
                            .text_xs()
                            .text_color(rgb(DIM_COLOR))
                            .child(keys.clone()),
                    );
                }
                if picked {
                    row = row.bg(rgb(SELECTED_BG));
                }
                list = list.child(row);
            }
            if shown.is_empty() {
                list = list.child(
                    div()
                        .px_3()
                        .py_2()
                        .text_sm()
                        .text_color(rgb(DIM_COLOR))
                        .child("Nothing matches"),
                );
            }
        }
        Some(self.overlay(
            "palette",
            560.,
            list,
            |this, cx| {
                this.palette = None;
                cx.notify();
            },
            cx,
        ))
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
        // A terminal that attaches takes the keyboard when it first draws; the tab that has it in
        // the layout keeps it.
        if self.palette.is_none() && self.settings.is_none() {
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
        }
        // Every kept tab stays attached; the ones not on screen are told so, which ends their
        // focus and their redraws until their tab comes back. Any change to the layout (a tab
        // switch, a close, a zoom, a split) ends here.
        let shown = self.tabs.shown();
        let room = self.room.get();
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
        let sidebar = if visible {
            self.sidebar.clone().into_any_element()
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
                area = area.child(self.tab_bar(cx)).child(
                    div()
                        .relative()
                        .flex_1()
                        .min_h_0()
                        .p(px(PANE_GAP / 2.))
                        .child(measure)
                        .child(self.node(&node, focused.as_deref(), split, cx)),
                );
            }
            None => {
                area = area.items_center().justify_center().child(
                    div()
                        .flex()
                        .flex_col()
                        .items_center()
                        .gap_2()
                        .text_sm()
                        .text_color(rgb(DIM_COLOR))
                        .child("Select a session")
                        .child(self.bar_link(
                            "open-palette",
                            "Commands",
                            cx.listener(|this, _, _, cx| this.toggle_palette(cx)),
                        )),
                );
            }
        }
        if let Some(notice) = &self.notice {
            area = area.child(
                div()
                    .absolute()
                    .bottom_2()
                    .left_3()
                    .text_xs()
                    .text_color(rgb(DIM_COLOR))
                    .child(notice.clone()),
            );
        }
        let overlays = self
            .palette_view(cx)
            .or_else(|| self.settings_view(cx))
            .into_iter()
            .chain(self.peek_view(cx))
            .chain(self.toast_view(cx));
        div()
            .relative()
            .flex()
            .size_full()
            .bg(rgb(MAIN_BG))
            .key_context("Workspace")
            .capture_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                if this.key(&event.keystroke, window, cx) {
                    cx.stop_propagation();
                }
            }))
            .child(sidebar)
            .child(area.children(overlays))
            // Over the whole window: it opens where the pointer was, in window coordinates.
            .children(self.menu_view(cx))
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

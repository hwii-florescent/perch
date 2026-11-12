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
use crate::settings::{scrollback_from_text, Change, MAX_SCROLLBACK, MIN_SCROLLBACK};
use crate::sidebar::{Attention, LOCAL};
use crate::tabs::{Dir, Node, Side, Tabs};
use crate::terminal::attach::FromCore;
use crate::terminal::TerminalView;
use crate::ui::{
    hint, label, tint, LaunchFailed, OpenSession, Sidebar, DIM_COLOR, MAIN_BG, SELECTED_BG,
    SIDEBAR_BG, TITLE_COLOR,
};
use futures::channel::mpsc::UnboundedSender;
use gpui::{
    div, prelude::*, px, relative, rgb, AnyElement, App, Context, Entity, EntityInputHandler,
    Focusable, KeyDownEvent, Keystroke, MouseButton, Subscription, Task, Window,
};
use serde_json::Value;
use std::collections::HashMap;
use std::time::{Duration, Instant};

/// How long a follow-up key after the leader chord is awaited.
const LEADER_TIMEOUT: Duration = Duration::from_millis(1500);
/// How long after a tab closes its session is asked to end, and how much later it is asked again.
const END_WAIT: Duration = Duration::from_millis(400);
const END_RETRY: Duration = Duration::from_millis(1100);
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
}

#[derive(Default)]
struct SettingsPanel {
    /// The scrollback being typed.
    editing: Option<String>,
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
    /// The leader chord was pressed; dropped when its time is up.
    leader: Option<Task<()>>,
    /// What the last command could not do, or did instead.
    notice: Option<String>,
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
            leader: None,
            notice: None,
            _subscriptions: vec![opened, failed, observed],
        }
    }

    /// Attach the terminals of opened sessions to the core `locate` finds. Without it the main
    /// area never touches the network.
    pub fn with_core(mut self, locate: impl Fn() -> anyhow::Result<Core> + 'static) -> Self {
        self.locate = Some(Box::new(locate));
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
        cx.notify();
    }

    /// A terminal for `open`: attached to the core `locate` finds, or showing why it cannot be.
    fn attach(&self, open: &OpenSession, cx: &mut Context<Self>) -> Option<Entity<TerminalView>> {
        let located = self.locate.as_ref()?();
        Some(cx.new(|cx| match located {
            Ok(core) => TerminalView::attach(core, open, cx),
            Err(error) => {
                let mut view = TerminalView::new(cx);
                view.core_said(FromCore::Failed(format!("{error:#}")), cx);
                view
            }
        }))
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
        if !view.read(cx).can_type() {
            return Err("This terminal is view only: another view controls it.".into());
        }
        view.update(cx, |view, cx| {
            view.replace_text_in_range(None, text, window, cx)
        });
        Ok(())
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
            "terminal.paste" => self.paste(cx)?,
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
    /// whether a job runs).
    /// Anything else, an agent above all, is put away and keeps running; ending it is a choice
    /// made where it can be confirmed.
    fn close(&mut self, id: &str, cx: &mut Context<Self>) {
        let ends = self.panes.get(id).is_some_and(|pane| {
            let plain = pane
                .open
                .provider_id
                .as_deref()
                .is_none_or(|p| p == perch_core::agent_fleet::TERMINAL_PROVIDER);
            let holds = pane.view.as_ref().is_some_and(|v| v.read(cx).can_type());
            plain && holds && pane.open.host_id == LOCAL
        });
        self.tabs.close(id);
        self.panes.remove(id);
        if ends {
            self.end_session(id.to_string(), cx);
        } else {
            self.notice = Some(
                "Closed the tab. The session keeps running; it is still in the sidebar.".into(),
            );
        }
        self.after_change(cx);
    }

    /// Ask the core to end a session whose tab was just closed. The core refuses to end a session
    /// another connection controls, and the dropped terminal's own connection keeps the shell's
    /// keyboard until it has let go, so the request waits for that, in real time, and is made
    /// once more in case the release was slow. If both are refused the shell keeps running: an
    /// agent stays listed in the sidebar, but a plain terminal has no row there and would run
    /// unseen until the core is asked about it again.
    // ponytail: two fixed waits, not a signal from the terminal's release; upgrade path is the
    // terminal reporting when its connection has let go.
    fn end_session(&self, id: String, cx: &mut Context<Self>) {
        let Some(commands) = self.sidebar.read(cx).commands() else {
            return;
        };
        std::thread::spawn(move || {
            for wait in [END_WAIT, END_RETRY] {
                std::thread::sleep(wait);
                if commands.unbounded_send(Command::Close(id.clone())).is_err() {
                    return;
                }
            }
        });
    }

    fn paste(&mut self, cx: &mut Context<Self>) -> Result<(), String> {
        let view = self
            .terminal()
            .cloned()
            .ok_or("No terminal is on screen.")?;
        let text = cx
            .read_from_clipboard()
            .and_then(|item| item.text())
            .filter(|t| !t.is_empty())
            .ok_or("The clipboard has no text.")?;
        view.update(cx, |view, cx| view.paste(&text, cx));
        Ok(())
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
        body = body
            .child(
                div().flex().justify_between().items_center().child(row(
                    "Scrollback (lines)",
                    &format!(
                        "{MIN_SCROLLBACK}–{MAX_SCROLLBACK} lines, Enter to save. Saved for every Perch window; this window keeps 10,000 lines per terminal for now."
                    ),
                )).child(scrollback_box),
            )
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
                "Applies to file drops, which this window does not do yet.",
                terminal.dropped_path_double_quotes,
                Change::DroppedPathDoubleQuotes(!terminal.dropped_path_double_quotes),
                cx,
            ))
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
        div()
            .flex()
            .justify_between()
            .items_center()
            .child(
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
                    ),
            )
            .child(
                div()
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
                    })),
            )
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
                    .max_h(px(520.))
                    .overflow_hidden()
                    .rounded_md()
                    .border_1()
                    .border_color(rgb(OVERLAY_BORDER))
                    .bg(rgb(SIDEBAR_BG))
                    .on_mouse_down(MouseButton::Left, |_, _, cx| cx.stop_propagation())
                    .child(body),
            )
            .into_any_element()
    }
}

impl gpui::Render for Workspace {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        // A terminal that attaches takes the keyboard when it first draws; the tab that has it in
        // the layout keeps it.
        if self.palette.is_none() && self.settings.is_none() {
            if let Some(view) = self.terminal() {
                let handle = view.focus_handle(cx);
                if !handle.is_focused(window) {
                    window.defer(cx, move |window, cx| handle.focus(window, cx));
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
                area = area.child(self.tab_bar(cx)).child(
                    div()
                        .flex_1()
                        .min_h_0()
                        .p(px(PANE_GAP / 2.))
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
        let overlays = self.palette_view(cx).or_else(|| self.settings_view(cx));
        div()
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
    }
}

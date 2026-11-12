//! [`TerminalView`]: one session's terminal in a GPUI pane.
//!
//! The screen is libghostty-vt run here ([`super::vt`]), fed the bytes the core relays: the
//! repaint of the screen and history first, then live output. Drawing, sizing and input follow
//! the web terminal's rules, which are the core's:
//!
//! - The size of the shell's terminal is the core's. A view that holds the resize lease fits
//!   itself to its pane and says so; every other view takes the size the core announces in the
//!   stream and never sends one. Either way this view's grid is the size the stream last gave
//!   it, so it always matches what the program draws for.
//! - Typing, and anything else the program is told (the mouse, answers to its queries, focus),
//!   needs the input lease.
//! - A dropped connection leaves the screen as it was and says so. It is never taken for the end
//!   of the shell, and nothing here reattaches, which would start the session again.
//!
//!

use super::actions::{Action, Scroll};
use super::attach::{self, AgentInfo, FromCore, Piece, ToCore};
use super::clipboard::{Clipboard, MemoryClipboard};
use super::context::{self, Capture};
use super::fallback;
use super::graphics::Layer;
use super::keys::key_bytes_with;
use super::layout::{self, Fit, Metrics};
use super::links::{self, Target};
use super::scroll;
use super::scrollbar;
use super::select::{Pointer, Step};
use super::settings::Settings;
use super::sprites;
use super::vt::{
    Cell, Event, Frame, KeyInput, MouseAction, MouseButton, MouseInput, Rgb, Underline, Vt,
};
use crate::client::Core;
use crate::ui::OpenSession;
use futures::channel::mpsc::{UnboundedReceiver, UnboundedSender};
use futures::StreamExt;
use ghostty_sys as g;
use gpui::{
    canvas, div, fill, outline, point, prelude::*, px, rgb, size, App, BorderStyle, Bounds,
    Context, Corners, ElementInputHandler, EntityInputHandler, EventEmitter, FocusHandle,
    Focusable, Hsla, KeyDownEvent, Keystroke, Modifiers, MouseButton as GpuiButton, MouseDownEvent,
    MouseMoveEvent, MouseUpEvent, Pixels, Point, RenderImage, ScrollWheelEvent, SharedString, Size,
    Task, TextAlign, TextRun, UTF16Selection, Window, WindowAppearance,
};
use perch_core::agent_fleet::AgentState;
use perch_core::iterm_profile::TerminalProfile;
use perch_core::protocol::SettingsData;
use std::collections::HashMap;
use std::ops::Range;
use std::rc::Rc;
use std::sync::Arc;
use std::time::Instant;

/// How often a held drag past the grid's edge scrolls.
const AUTOSCROLL_TICK: std::time::Duration = std::time::Duration::from_millis(50);

/// How long a blinking cursor stays on, and then off.
const BLINK_HALF_PERIOD: std::time::Duration = std::time::Duration::from_millis(530);

/// The tint of a search match.
const MATCH_COLOR: Rgb = Rgb(0xff, 0xd3, 0x3d);

/// Dim text for what the terminal says about itself.
const NOTE_COLOR: u32 = 0x8a8a90;

/// Where the terminal is with its session.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Status {
    /// Not attached to anything.
    Detached,
    /// Attaching.
    Connecting,
    /// Attached; the screen follows the shell.
    Live,
    /// The connection dropped. The screen is as it was; the shell is not known to have ended.
    Disconnected(String),
    /// Could not attach.
    Failed(String),
    /// The core said the shell ended.
    Exited(i32),
}

/// What the terminal tells whoever shows it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum TerminalEvent {
    Title(String),
    /// The program asks to set the system clipboard. Nothing has been written.
    ClipboardWrite(String),
    Status(Status),
    /// The core confirmed that the session this terminal shows ended (see [`TerminalView::end`]).
    Ended,
    /// The core would not end the session; it keeps running. The reason is the core's.
    EndRefused(String),
    /// A person clicked a link with the link key held. Opening it is the window's: it runs the
    /// system's handler, which the terminal never does itself.
    OpenLink(Target),
    /// A person right-clicked a selection where the Context Bridge is available: the window may
    /// offer "Ask agent about selection…" at this point. Nothing is captured or sent.
    AskAgentOffered(Point<Pixels>),
}

impl EventEmitter<TerminalEvent> for TerminalView {}

/// The find bar: its query, and whether typing replaces it (a reopened bar starts with the last
/// query selected).
#[derive(Default)]
struct Find {
    open: bool,
    query: String,
    replace_on_type: bool,
}

/// How often the search indexes while it has more to do, and while it has not.
const SEARCH_BUSY: std::time::Duration = std::time::Duration::from_millis(33);
const SEARCH_IDLE: std::time::Duration = std::time::Duration::from_millis(200);

/// Where to attach once the pane has a size to attach at.
struct Pending {
    core: Core,
    session_id: String,
    provider: String,
}

/// A frame as painted: read in prepaint, drawn in paint.
struct Painted {
    frame: Frame,
    metrics: Metrics,
    origin: Point<Pixels>,
    scale: f32,
    focused: bool,
    family: String,
    opacity: f32,
    blink_on: bool,
    link: Vec<(u16, u16, u16)>,
    /// The composition: its text, the cell it starts at, and the cells it covers.
    marked: Option<(String, u16, u16, usize)>,
    /// The scrollbar's rail and thumb.
    bar: Option<(Bounds<Pixels>, Bounds<Pixels>)>,
    /// Kitty graphics images, where they go and in which layer.
    images: Vec<(Layer, Bounds<Pixels>, Arc<RenderImage>)>,
}

/// An image as uploaded: the image, the version of its pixels, and the part of it drawn.
type ImageKey = (u32, u64, [u32; 4]);

/// Where the scrollbar is, for clicks: its strip and the thumb in it.
#[derive(Clone, Copy)]
struct BarHit {
    lane: Bounds<Pixels>,
    thumb: Bounds<Pixels>,
}

pub struct TerminalView {
    vt: Vt,
    focus: FocusHandle,
    settings: Settings,
    /// What the core last sent; the settings are made from these, the window's appearance and
    /// the fonts the machine has.
    profile: Option<TerminalProfile>,
    core_settings: Option<SettingsData>,
    /// Set by tests: the appearance the window is taken to have.
    dark_override: Option<bool>,
    applied_dark: Option<bool>,
    agent: Option<AgentInfo>,
    status: Status,
    title: String,
    pending: Option<Pending>,
    to_core: Option<UnboundedSender<ToCore>>,
    _reader: Option<Task<()>>,
    /// The leases this connection holds.
    input_lease: bool,
    resize_lease: bool,
    /// The grid last fitted to the pane, and its cell.
    fitted: Option<Fit>,
    origin: Point<Pixels>,
    scale: f32,
    /// The size last asked of the core. `None`: ask at the next layout.
    requested: Option<(u16, u16)>,
    scrolled: Point<f32>,
    /// The link under the pointer while the link key is held, and where the pointer is.
    hover_link: Option<links::Hit>,
    last_pointer: Option<Point<Pixels>>,
    /// The terminal's folder when the shell has not said (OSC 7), for relative file links.
    cwd: Option<std::path::PathBuf>,
    /// Where the terminal is, for deciding to offer the Context Bridge, and the core that would
    /// prepare and send a packet.
    place: context::Place,
    session_id: String,
    core: Option<Core>,
    /// Uploaded images, kept while some placement on the screen still draws them.
    images: HashMap<ImageKey, Arc<RenderImage>>,
    /// The scrollbar as last drawn, and where in its thumb a drag holds it.
    bar: Option<BarHit>,
    bar_grab: Option<f32>,
    /// Text an input method is composing, drawn at the cursor and not yet sent.
    marked: Option<String>,
    /// The pane is not on screen: it holds no focus and draws nothing.
    hidden: bool,
    find: Find,
    _find_timer: Option<Task<()>>,
    clipboard: Rc<dyn Clipboard>,
    /// A left-button drag is selecting text.
    selecting: bool,
    /// Where the pointer last was in that drag, for scrolling under a held pointer.
    drag_at: Option<Point<Pixels>>,
    _autoscroll: Option<Task<()>>,
    /// Why the last file drop typed nothing, until the next one or the next key.
    drop_notice: Option<String>,
    /// Wakes the view when a synchronised-output block the program never ends must be shown.
    _hold_wake: Option<Task<()>>,
    epoch: Instant,
    /// The blinking cursor is in its visible half.
    blink_on: bool,
    cursor_blinks: bool,
    _blink: Task<()>,
    /// Lay the pane out afresh once, whatever holds the size: the font changed.
    refit: bool,
    /// Where the cursor was at the last frame, hidden or not.
    cursor_cell: Option<(u16, u16)>,
    buttons_down: Vec<GpuiButton>,
    was_focused: bool,
    take_focus: bool,
    /// A window's keymap runs the terminal's commands (find, clear, copy, paste, select all,
    /// scroll to an end); the view then leaves those Command chords to it, so a key the person
    /// moved is not still taken here.
    hosted: bool,
    /// The session and provider this view attaches, kept to attach to again.
    target: Option<(String, String)>,
    /// A window will attach again after a drop, so the note says it is waiting for the core.
    reconnects: bool,
}

impl TerminalView {
    /// A view attached to nothing: a quiet pane that draws what is fed to it.
    pub fn new(cx: &mut Context<Self>) -> Self {
        fallback::install(cx);
        Self {
            vt: Vt::new(80, 24),
            focus: cx.focus_handle(),
            settings: Settings::default(),
            profile: None,
            core_settings: None,
            dark_override: None,
            applied_dark: None,
            agent: None,
            status: Status::Detached,
            title: String::new(),
            pending: None,
            to_core: None,
            _reader: None,
            input_lease: false,
            resize_lease: false,
            fitted: None,
            origin: point(px(0.), px(0.)),
            scale: 1.0,
            requested: None,
            scrolled: Point::default(),
            refit: false,
            hover_link: None,
            last_pointer: None,
            cwd: None,
            place: context::Place::default(),
            session_id: String::new(),
            core: None,
            images: HashMap::new(),
            bar: None,
            bar_grab: None,
            marked: None,
            hidden: false,
            find: Find::default(),
            _find_timer: None,
            clipboard: Rc::new(MemoryClipboard::default()),
            selecting: false,
            drag_at: None,
            _autoscroll: None,
            _hold_wake: None,
            drop_notice: None,
            epoch: Instant::now(),
            blink_on: true,
            cursor_blinks: false,
            _blink: cx.spawn(async move |this, cx| loop {
                cx.background_executor().timer(BLINK_HALF_PERIOD).await;
                if this.update(cx, |this, cx| this.blink_tick(cx)).is_err() {
                    return;
                }
            }),
            cursor_cell: None,
            buttons_down: Vec::new(),
            was_focused: false,
            take_focus: false,
            hosted: false,
            target: None,
            reconnects: false,
        }
    }

    /// Let a window's keymap decide what the Command chords do (see `hosted`). A view on its own
    /// keeps its fixed chords.
    pub fn set_hosted(&mut self, hosted: bool) {
        self.hosted = hosted;
    }

    /// Type `text` into the program exactly as given: no paste wrapping and no newline change,
    /// under the same lease as typing. For a window's explicit sends (`send:` in `keys.json`); it
    /// is not a paste and never goes to the find field. The error says why nothing was typed.
    pub fn send_text(&mut self, text: &str, cx: &mut Context<Self>) -> Result<(), String> {
        if !self.can_type() {
            return Err("This terminal is view only: another view controls it.".into());
        }
        self.type_bytes(text.as_bytes().to_vec(), cx);
        Ok(())
    }

    /// A view that attaches `open`'s session in `core` when its pane first has a size, and takes
    /// the keyboard focus then. Without a provider the session's own terminal is attached.
    pub fn attach(core: Core, open: &OpenSession, cx: &mut Context<Self>) -> Self {
        let mut view = Self::new(cx);
        view.place.local = open.host_id == "local";
        view.core = Some(core.clone());
        view.status = Status::Connecting;
        view.take_focus = true;
        let provider = open
            .provider_id
            .clone()
            .unwrap_or_else(|| perch_core::agent_fleet::TERMINAL_PROVIDER.to_string());
        view.target = Some((open.session_id.clone(), provider.clone()));
        view.pending = Some(Pending {
            core,
            session_id: open.session_id.clone(),
            provider,
        });
        view
    }

    /// Say that a window attaches this view again after the connection drops, so the note says
    /// it is waiting for the core.
    pub fn expect_reconnect(&mut self, reconnects: bool) {
        self.reconnects = reconnects;
    }

    /// Attach to the same session again through `core`, after the connection dropped. The screen
    /// stays as it was until the core's repaint replaces it, a search keeps its query, and
    /// nothing is started over: the core attaches to the shell it still has, or refuses, and a
    /// refusal is a failure to attach, never an exit. False, doing nothing, unless the view is
    /// disconnected from a session it attached.
    pub fn reattach(&mut self, core: Core, cx: &mut Context<Self>) -> bool {
        let (Status::Disconnected(_), Some((session_id, provider))) =
            (&self.status, self.target.clone())
        else {
            return false;
        };
        let (cols, rows) = self.fitted.map_or(self.vt.size(), |f| (f.cols, f.rows));
        self.core = Some(core.clone());
        let (to_core, from_core) = attach::reattach(core, session_id, provider, cols, rows);
        self.link(to_core, from_core, cx);
        true
    }

    /// Join the core's end of a terminal: what the view asks goes to `to_core`, what the core
    /// says arrives on `from_core`.
    pub fn link(
        &mut self,
        to_core: UnboundedSender<ToCore>,
        mut from_core: UnboundedReceiver<FromCore>,
        cx: &mut Context<Self>,
    ) {
        self.to_core = Some(to_core);
        self.set_status(Status::Connecting, cx);
        self._reader = Some(cx.spawn(async move |this, cx| {
            while let Some(event) = from_core.next().await {
                if this
                    .update(cx, |this, cx| this.core_said(event, cx))
                    .is_err()
                {
                    return;
                }
            }
        }));
    }

    pub fn status(&self) -> &Status {
        &self.status
    }

    pub fn title(&self) -> &str {
        &self.title
    }

    pub fn settings(&self) -> &Settings {
        &self.settings
    }

    /// Use `profile` and `settings` (what the core sent) from now on.
    pub fn apply_core(
        &mut self,
        profile: Option<Option<TerminalProfile>>,
        settings: Option<SettingsData>,
        cx: &mut Context<Self>,
    ) {
        if let Some(profile) = profile {
            self.profile = profile;
        }
        if let Some(settings) = settings {
            self.core_settings = Some(settings);
        }
        self.apply_settings(cx);
    }

    /// Take the window to be dark or light whatever the system says (tests).
    pub fn set_dark(&mut self, dark: Option<bool>, cx: &mut Context<Self>) {
        self.dark_override = dark;
        self.apply_settings(cx);
    }

    fn apply_settings(&mut self, cx: &mut Context<Self>) {
        let dark = self.dark_override.unwrap_or_else(|| {
            matches!(
                cx.window_appearance(),
                WindowAppearance::Dark | WindowAppearance::VibrantDark
            )
        });
        self.applied_dark = Some(dark);
        let installed = cx.text_system().all_font_names();
        let settings = Settings::from_core(
            self.profile.as_ref(),
            self.core_settings.as_ref(),
            dark,
            &installed,
        );
        if settings == self.settings {
            return;
        }
        self.vt.set_theme(settings.theme.clone());
        self.vt.set_scrollback_lines(settings.scrollback);
        self.vt
            .set_default_cursor(settings.cursor_shape, settings.cursor_blink);
        self.settings = settings;
        self.refit = true;
        cx.notify();
    }

    /// Flip a blinking cursor to its other half. A cursor that does not blink stays on.
    pub fn blink_tick(&mut self, cx: &mut Context<Self>) {
        if self.cursor_blinks && self.was_focused && !self.hidden {
            self.blink_on = !self.blink_on;
            cx.notify();
        } else if !self.blink_on {
            self.blink_on = true;
            cx.notify();
        }
    }

    /// The grid the screen is at: the size the core last gave it.
    pub fn grid_size(&self) -> (u16, u16) {
        self.vt.size()
    }

    /// The grid that fits the pane, as of the last layout.
    pub fn fitted_size(&self) -> Option<(u16, u16)> {
        self.fitted.map(|f| (f.cols, f.rows))
    }

    /// One cell, as of the last layout.
    pub fn cell_size(&self) -> Option<Size<Pixels>> {
        self.fitted.map(|f| size(f.metrics.width, f.metrics.height))
    }

    /// The font size the last layout chose, which is below the appearance's when the pane is
    /// too narrow for [`layout::MIN_COLS`] columns.
    pub fn font_px(&self) -> Option<f32> {
        self.fitted.map(|f| f.metrics.font_px)
    }

    /// Whether this view can ask the core to end its session: it is attached and holds the input
    /// lease, even if the shell has already exited. The core refuses otherwise.
    pub fn can_end(&self) -> bool {
        self.to_core.is_some()
            && matches!(self.status, Status::Live | Status::Exited(_))
            && self.input_lease
    }

    /// Ask the core to end the session and delete it, over this view's own connection, which
    /// holds the keyboard. Nothing happens here until the core answers with
    /// [`TerminalEvent::Ended`] or [`TerminalEvent::EndRefused`]. False, asking nothing, when the
    /// view cannot ask ([`Self::can_end`]).
    pub fn end(&self) -> bool {
        let can = self.can_end();
        if can {
            self.send(ToCore::End);
        }
        can
    }

    /// What the core advertised on connecting.
    pub fn capabilities(&self) -> &[String] {
        &self.place.capabilities
    }

    /// Whether the core lets a view type without the input lease, as the web's shared typing does.
    fn shared_input(&self) -> bool {
        self.place
            .capabilities
            .iter()
            .any(|c| c == attach::SHARED_INPUT)
    }

    /// Whether this connection may stop the shell: attached, holding the input lease. Typing may
    /// be shared (see [`Self::can_type`]); ending the shell never is.
    pub fn can_stop(&self) -> bool {
        self.to_core.is_some() && self.status == Status::Live && self.input_lease
    }

    /// Whether this connection may type: attached, holding the input lease or, when the core
    /// allows it, watching the terminal and typing alongside the view that holds it.
    pub fn can_type(&self) -> bool {
        self.to_core.is_some()
            && self.status == Status::Live
            && (self.input_lease || self.shared_input())
    }

    /// The rows as they are drawn.
    pub fn frame(&mut self) -> Frame {
        self.vt.frame()
    }

    fn set_status(&mut self, status: Status, cx: &mut Context<Self>) {
        if self.status != status {
            self.status = status.clone();
            cx.emit(TerminalEvent::Status(status));
            cx.notify();
        }
    }

    /// The device size of a cell, for the program's size reports.
    fn cell_px(&self) -> (u32, u32) {
        self.fitted.map_or((8, 16), |f| {
            (
                (f32::from(f.metrics.width) * self.scale).round() as u32,
                (f32::from(f.metrics.height) * self.scale).round() as u32,
            )
        })
    }

    /// What the core said.
    pub fn core_said(&mut self, event: FromCore, cx: &mut Context<Self>) {
        match event {
            FromCore::Attached {
                replay,
                input,
                resize,
                agent,
            } => {
                self.input_lease = input;
                self.resize_lease = resize;
                self.agent = agent;
                // The size is told once after attaching, as the web terminal does, whatever
                // the fit looks like.
                self.requested = None;
                self.vt.set_replaying(true);
                self.output(&replay, cx);
                self.vt.set_replaying(false);
                self.set_status(Status::Live, cx);
            }
            FromCore::Output(data) => self.output(&data, cx),
            FromCore::Profile(profile) => self.apply_core(Some(profile), None, cx),
            FromCore::Capabilities(capabilities) => self.place.capabilities = capabilities,
            FromCore::Place {
                session_id,
                workspace_id,
            } => {
                self.session_id = session_id;
                self.place.workspace_id = Some(workspace_id).filter(|w| !w.is_empty());
            }
            FromCore::Settings(settings) => self.apply_core(None, Some(*settings), cx),
            FromCore::Agent(agent) => {
                // A lease taken from this view ends its typing; one it took starts it, and the
                // size is told again.
                if agent.resize && !self.resize_lease {
                    self.requested = None;
                }
                self.input_lease = agent.input;
                self.resize_lease = agent.resize;
                self.agent = Some(agent);
                cx.notify();
            }
            FromCore::Exited(code) => self.set_status(Status::Exited(code), cx),
            FromCore::Ended => cx.emit(TerminalEvent::Ended),
            FromCore::EndRefused(reason) => cx.emit(TerminalEvent::EndRefused(reason)),
            FromCore::Failed(reason) => self.set_status(Status::Failed(reason), cx),
            FromCore::Disconnected(reason) => {
                // The screen stays; the shell is not known to have ended.
                self.input_lease = false;
                self.resize_lease = false;
                self.agent = None;
                self.set_status(Status::Disconnected(reason), cx);
            }
        }
    }

    /// Feed output to the screen, taking the sizes in it as they come: the core announces every
    /// resize in the stream, in order with the bytes it applies to.
    pub fn output(&mut self, data: &str, cx: &mut Context<Self>) {
        for piece in attach::split_size_markers(data) {
            match piece {
                Piece::Text(text) => self.vt.write(text.as_bytes()),
                Piece::Size { cols, rows } => {
                    let cell = self.cell_px();
                    self.vt.resize(cols, rows, cell);
                }
            }
        }
        // Answers to the program's queries go back only from the view that types for it: the
        // others would answer twice.
        let replies = self.vt.take_replies();
        // With shared typing the holder of the size answers, as the web does.
        let answers = if self.shared_input() {
            self.resize_lease
        } else {
            self.input_lease && self.resize_lease
        };
        if !replies.is_empty() && answers {
            self.send(ToCore::Input(replies));
        }
        for event in self.vt.take_events() {
            match event {
                // The spinner an agent puts in front of its title is not part of it; a title that
                // only spins is not a change.
                Event::Title(title) => {
                    let shown = super::title::shown_title(&title).into_owned();
                    if shown != self.title {
                        self.title = shown.clone();
                        cx.emit(TerminalEvent::Title(shown));
                    }
                }
                // The same switch the web reads: a program may set the clipboard unless the
                // `clipboardWrite` setting is off.
                Event::ClipboardWrite(text) if self.settings.clipboard_write => {
                    self.clipboard.write_text(&text, cx);
                    cx.emit(TerminalEvent::ClipboardWrite(text));
                }
                Event::ClipboardWrite(_) => {}
            }
        }
        // A pane that is not on screen draws nothing, so output to it redraws nothing; it is
        // drawn afresh when it comes back.
        if !self.hidden {
            cx.notify();
        }
        // A block the program began and never ended is shown at its deadline even if no more
        // bytes arrive to prompt a redraw.
        self._hold_wake = self.vt.render_hold_deadline().map(|deadline| {
            cx.spawn(async move |this, cx| {
                cx.background_executor()
                    .timer(deadline.saturating_duration_since(std::time::Instant::now()))
                    .await;
                let _ = this.update(cx, |_, cx| cx.notify());
            })
        });
    }

    fn send(&self, message: ToCore) {
        if let Some(to_core) = &self.to_core {
            let _ = to_core.unbounded_send(message);
        }
    }

    /// Type bytes the program asked to be told: ends a scroll back in history.
    fn type_bytes(&mut self, bytes: Vec<u8>, cx: &mut Context<Self>) {
        if bytes.is_empty() {
            return;
        }
        self.vt.scroll_to_bottom();
        self.vt.clear_selection();
        self.blink_on = true;
        self.drop_notice = None;
        self.send(ToCore::Input(bytes));
        cx.notify();
    }

    /// A key press. Returns whether the terminal took it; the keyboard path of the window calls
    /// this, and so do tests.
    pub fn key_down(&mut self, event: &KeyDownEvent, cx: &mut Context<Self>) -> bool {
        self.keystroke(&event.keystroke, event.is_held, cx)
    }

    pub fn keystroke(
        &mut self,
        keystroke: &Keystroke,
        repeat: bool,
        cx: &mut Context<Self>,
    ) -> bool {
        if self.find.open {
            return self.find_key(keystroke, cx);
        }
        let m = keystroke.modifiers;
        if !self.hosted && m.platform && !m.control && !m.alt && !m.shift {
            match keystroke.key.as_str() {
                "f" => {
                    self.open_find(cx);
                    return true;
                }
                "v" => return self.paste_clipboard(cx),
                // With nothing selected the chord is left to the app, as every Command chord is.
                "c" => return self.copy(cx),
                "a" => {
                    self.select_all(cx);
                    return true;
                }
                // The web terminal's own chords: clear the history, jump to its ends.
                "k" => return self.perform(Action::Clear, cx),
                "up" => return self.perform(Action::Scroll(Scroll::Top), cx),
                "down" => return self.perform(Action::Scroll(Scroll::Bottom), cx),
                _ => {}
            }
        }
        if !self.can_type() {
            return false;
        }
        match key_bytes_with(&mut self.vt, keystroke, repeat, self.settings.option_as_alt) {
            Some(bytes) => {
                self.type_bytes(bytes, cx);
                true
            }
            None => false,
        }
    }

    /// Copy the selection to the clipboard and end it. False, and nothing copied, when there is
    /// none.
    pub fn copy(&mut self, cx: &mut Context<Self>) -> bool {
        let Some(text) = self.vt.selection_text() else {
            return false;
        };
        self.clipboard.write_text(&text, cx);
        self.vt.clear_selection();
        cx.notify();
        true
    }

    /// The selected output as a Context Bridge capture, when the bridge is available here.
    /// Nothing is sent: the capture is plain data for the window's dialog, which previews it with
    /// [`Self::core`] and sends only when the person says so.
    pub fn context_capture(&self) -> Result<Capture, String> {
        let text = self
            .vt
            .selection_text()
            .ok_or_else(|| "Select some text to ask about".to_string())?;
        // One operation per capture: the core refuses a replayed id.
        static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let n = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |d| d.as_nanos());
        let operation = format!("native-{}-{stamp}-{n}", std::process::id());
        Capture::new(&self.place, &self.session_id, &text, operation)
    }

    /// A view joined with [`Self::link`] says whether its session is on this computer; one made
    /// with [`Self::attach`] knows from the session it opens.
    pub fn set_local(&mut self, local: bool) {
        self.place.local = local;
    }

    /// Whether the Context Bridge is offered for this terminal's selection.
    pub fn can_ask_agent(&self) -> bool {
        self.place.available() && self.vt.has_selection()
    }

    /// The core this terminal is attached to, for preparing and sending a context packet.
    pub fn core(&self) -> Option<&Core> {
        self.core.as_ref()
    }

    /// The text selected, if any.
    pub fn selection_text(&self) -> Option<String> {
        self.vt.selection_text()
    }

    /// Select the whole screen and its history. Copies nothing; [`Self::copy`] does that.
    pub fn select_all(&mut self, cx: &mut Context<Self>) {
        self.vt.select_all();
        cx.notify();
    }

    pub fn clear_selection(&mut self, cx: &mut Context<Self>) {
        self.vt.clear_selection();
        cx.notify();
    }

    /// Paste the clipboard's text. False when this view cannot type or the clipboard has none.
    pub fn paste_clipboard(&mut self, cx: &mut Context<Self>) -> bool {
        if !self.can_type() {
            return false;
        }
        // Files copied in the file manager paste as paths, as if dropped.
        if let Some(paths) = self.clipboard.read_paths(cx) {
            return self.drop_paths(&paths, cx);
        }
        match self.clipboard.read_text(cx) {
            Some(text) => {
                self.paste(&text, cx);
                true
            }
            None => false,
        }
    }

    /// Files dropped on the pane, or pasted from the file manager: their quoted paths are typed
    /// as one paste, with no Enter. False, with the reason in [`Self::note`], when nothing was
    /// typed: the terminal is not writable, it is on another machine (that needs an upload this
    /// view does not do), or a path cannot be typed safely.
    pub fn drop_paths(&mut self, paths: &[std::path::PathBuf], cx: &mut Context<Self>) -> bool {
        let refusal = if !self.can_type() {
            Some("File drops need a connected terminal this view may type in".to_string())
        } else if !self.place.local {
            Some("A file dropped on a terminal on another machine needs an upload this view does not do".to_string())
        } else {
            match super::drop::paste_text(paths, self.settings.dropped_path_double_quotes) {
                Ok(text) => {
                    self.paste(&text, cx);
                    return true;
                }
                Err(reason) => Some(reason),
            }
        };
        self.drop_notice = refusal;
        cx.notify();
        false
    }

    /// Where copied and pasted text goes. A view starts with a clipboard of its own, in memory;
    /// the window gives it the system's.
    pub fn set_clipboard(&mut self, clipboard: Rc<dyn Clipboard>) {
        self.clipboard = clipboard;
    }

    /// Where `position` is in the grid, in the terms the selection gesture takes. Positions
    /// outside the grid are held to its edge cell.
    fn pointer(&self, position: Point<Pixels>) -> Option<Pointer> {
        let fit = self.fitted?;
        let (cols, rows) = self.vt.size();
        let local = position - self.origin;
        let (cw, ch) = (f32::from(fit.metrics.width), f32::from(fit.metrics.height));
        let cell = |v: f32, size: f32, count: u16| {
            ((v / size).floor().max(0.0) as u16).min(count.saturating_sub(1))
        };
        Some(Pointer {
            col: cell(f32::from(local.x), cw, cols),
            row: cell(f32::from(local.y), ch, rows),
            x: f32::from(local.x).max(0.0) * self.scale,
            y: f32::from(local.y).max(0.0) * self.scale,
            cell_width: cw * self.scale,
            height: ch * f32::from(rows) * self.scale,
            now_ns: self.epoch.elapsed().as_nanos() as u64 + 1,
        })
    }

    /// A mouse button went down in the pane. The program gets it when it takes the mouse
    /// (ending any selection of ours); otherwise the left button selects, shift extends, and
    /// the middle button pastes.
    pub fn mouse_down(&mut self, event: &MouseDownEvent, cx: &mut Context<Self>) {
        if event.button == GpuiButton::Left && self.bar_press(event.position, cx) {
            return;
        }
        // The link key and a click on a link opens it: no selection, no report to the program.
        if event.button == GpuiButton::Left
            && Self::link_key(event.modifiers)
            && self.open_link_at(event.position, cx)
        {
            return;
        }
        let taken = self.mouse(
            MouseAction::Press,
            Some(event.button),
            event.position,
            event.modifiers,
        );
        if taken {
            self.selecting = false;
            self.vt.clear_selection();
            cx.notify();
            return;
        }
        match event.button {
            GpuiButton::Left => {
                let Some(at) = self.pointer(event.position) else {
                    return;
                };
                if event.modifiers.shift && self.vt.extend_selection(at.col, at.row) {
                    self.selecting = false;
                } else {
                    self.vt.select(Step::Press, at);
                    self.selecting = true;
                }
                cx.notify();
            }
            GpuiButton::Middle => {
                self.paste_clipboard(cx);
            }
            // The program has not taken the click (a mouse-reporting program is given the
            // Shift gesture instead): offer the bridge for what is selected.
            GpuiButton::Right if self.can_ask_agent() => {
                cx.emit(TerminalEvent::AskAgentOffered(event.position));
            }
            _ => {}
        }
    }

    /// The pointer moved over the pane: motion for a program that takes the mouse, a drag for
    /// the selection otherwise.
    pub fn mouse_moved(&mut self, event: &MouseMoveEvent, cx: &mut Context<Self>) {
        if self.bar_grab.is_some() {
            if event.pressed_button == Some(GpuiButton::Left) {
                self.bar_drag(event.position.y, cx);
            } else {
                self.bar_grab = None;
            }
            return;
        }
        self.update_hover(Some(event.position), event.modifiers, cx);
        let held = event.pressed_button;
        if (held.is_some() && !self.buttons_down.is_empty() || held.is_none())
            && self.mouse(MouseAction::Motion, held, event.position, event.modifiers)
        {
            return;
        }
        if self.selecting && held == Some(GpuiButton::Left) {
            self.drag_to(event.position, cx);
        }
    }

    fn drag_to(&mut self, position: Point<Pixels>, cx: &mut Context<Self>) {
        let Some(at) = self.pointer(position) else {
            return;
        };
        self.drag_at = Some(position);
        self.vt.select(Step::Drag, at);
        // Past the top or bottom edge the viewport scrolls under the held pointer.
        if self.vt.drag_autoscroll() != 0 && self._autoscroll.is_none() {
            self._autoscroll = Some(cx.spawn(async move |this, cx| loop {
                cx.background_executor().timer(AUTOSCROLL_TICK).await;
                if this
                    .update(cx, |this, cx| this.autoscroll_step(cx))
                    .is_err()
                {
                    return;
                }
            }));
        }
        cx.notify();
    }

    /// Scroll one to five lines toward where a held drag points, and extend the selection to
    /// the edge. Stops by itself when the drag no longer asks for it.
    pub fn autoscroll_step(&mut self, cx: &mut Context<Self>) {
        let direction = self.vt.drag_autoscroll();
        let (Some(position), true) = (self.drag_at, self.selecting && direction != 0) else {
            self._autoscroll = None;
            return;
        };
        let Some(fit) = self.fitted else { return };
        // The farther past the edge, the faster: a line per cell, up to five.
        let ch = f32::from(fit.metrics.height);
        let local = f32::from((position - self.origin).y);
        let past = if direction < 0 {
            -local
        } else {
            local - ch * f32::from(self.vt.size().1)
        };
        let lines = ((past / ch).ceil() as isize).clamp(1, 5);
        self.vt.scroll_viewport(direction as isize * lines);
        if let Some(at) = self.pointer(position) {
            self.vt.autoscroll_tick(at);
        }
        cx.notify();
    }

    /// A mouse button came up: the report for a program that took the press, the end of a
    /// selection otherwise, which copies it when the user's terminal does.
    pub fn mouse_up(&mut self, event: &MouseUpEvent, cx: &mut Context<Self>) {
        if self.bar_grab.take().is_some() {
            return;
        }
        if self.mouse(
            MouseAction::Release,
            Some(event.button),
            event.position,
            event.modifiers,
        ) {
            return;
        }
        if event.button == GpuiButton::Left && std::mem::take(&mut self.selecting) {
            self._autoscroll = None;
            self.drag_at = None;
            if let Some(at) = self.pointer(event.position) {
                self.vt.select(Step::Release, at);
            }
            // The highlight stays; the text is copied as soon as the button is released.
            if self.settings.copy_on_select {
                if let Some(text) = self.vt.selection_text() {
                    self.clipboard.write_text(&text, cx);
                }
            }
            cx.notify();
        }
    }

    /// The folder relative file links are read against, until the shell reports its own.
    pub fn set_cwd(&mut self, cwd: Option<std::path::PathBuf>) {
        self.cwd = cwd;
    }

    /// Whether the key that turns the pointer over a link into a click on it is held: Command.
    fn link_key(modifiers: Modifiers) -> bool {
        modifiers.platform && !modifiers.alt && !modifiers.shift && !modifiers.control
    }

    /// The link under the pointer, for the underline and the pointing hand.
    pub fn hovered_link(&self) -> Option<&links::Hit> {
        self.hover_link.as_ref()
    }

    fn link_under(&self, position: Point<Pixels>) -> Option<links::Hit> {
        let at = self.pointer(position)?;
        self.vt.link_at(at.col, at.row)
    }

    fn update_hover(
        &mut self,
        position: Option<Point<Pixels>>,
        modifiers: Modifiers,
        cx: &mut Context<Self>,
    ) {
        self.last_pointer = position;
        let hit = position
            .filter(|_| Self::link_key(modifiers))
            .and_then(|p| self.link_under(p));
        if hit != self.hover_link {
            self.hover_link = hit;
            cx.notify();
        }
    }

    /// The link key was pressed or let go with the pointer at rest.
    pub fn modifiers_changed(&mut self, modifiers: Modifiers, cx: &mut Context<Self>) {
        self.update_hover(self.last_pointer, modifiers, cx);
    }

    /// Open the link at `position`, if there is one that leads somewhere: say so, and do
    /// nothing more. A file counts only when it exists here.
    fn open_link_at(&mut self, position: Point<Pixels>, cx: &mut Context<Self>) -> bool {
        let Some(hit) = self.link_under(position) else {
            return false;
        };
        let cwd = self.cwd.clone().or_else(|| self.vt.pwd());
        match links::resolve(&hit.target, cwd.as_deref()) {
            Some(target) => {
                cx.emit(TerminalEvent::OpenLink(target));
                true
            }
            None => false,
        }
    }

    pub fn find_open(&self) -> bool {
        self.find.open
    }

    pub fn find_query(&self) -> &str {
        &self.find.query
    }

    /// Open the find bar. It keeps the last query, selected, so typing replaces it.
    pub fn open_find(&mut self, cx: &mut Context<Self>) {
        self.find.open = true;
        self.find.replace_on_type = !self.find.query.is_empty();
        let query = self.find.query.clone();
        self.vt.search(&query);
        self._find_timer = Some(cx.spawn(async move |this, cx| {
            let mut wait = SEARCH_BUSY;
            loop {
                cx.background_executor().timer(wait).await;
                match this.update(cx, |this, cx| this.search_tick(cx)) {
                    Ok(next) => wait = next,
                    Err(_) => return,
                }
            }
        }));
        cx.notify();
    }

    /// Close the bar and clear the highlights; the query is kept for next time.
    pub fn close_find(&mut self, cx: &mut Context<Self>) {
        self.find.open = false;
        self._find_timer = None;
        self.vt.search("");
        cx.notify();
    }

    /// Replace the query.
    pub fn set_find_query(&mut self, query: &str, cx: &mut Context<Self>) {
        self.find.query = query.to_owned();
        self.find.replace_on_type = false;
        if self.find.open {
            self.vt.search(query);
        }
        cx.notify();
    }

    /// Type into the find field.
    fn find_type(&mut self, text: &str, cx: &mut Context<Self>) {
        let mut query = if std::mem::take(&mut self.find.replace_on_type) {
            String::new()
        } else {
            self.find.query.clone()
        };
        query.push_str(text);
        self.set_find_query(&query, cx);
    }

    pub fn find_next(&mut self, cx: &mut Context<Self>) -> bool {
        let moved = self.vt.search_navigate(false);
        cx.notify();
        moved
    }

    pub fn find_previous(&mut self, cx: &mut Context<Self>) -> bool {
        let moved = self.vt.search_navigate(true);
        cx.notify();
        moved
    }

    /// One bounded step of indexing. Returns how long to wait before the next: soon while there
    /// is more to index, rarely once done.
    pub fn search_tick(&mut self, cx: &mut Context<Self>) -> std::time::Duration {
        if self.vt.search_step() {
            cx.notify();
        }
        if self.vt.search_progress().complete {
            SEARCH_IDLE
        } else {
            SEARCH_BUSY
        }
    }

    /// What the find bar says of the search: `n / total`, `total matches`, `total+` while it
    /// still indexes, `Searching…` before anything is known, `No matches`.
    pub fn find_label(&self) -> String {
        if self.find.query.is_empty() {
            return String::new();
        }
        let p = self.vt.search_progress();
        match (p.total, p.selected, p.complete) {
            (0, _, true) => "No matches".into(),
            (0, _, false) => "Searching…".into(),
            (total, Some(n), true) => format!("{} / {total}", n + 1),
            (total, _, true) => format!("{total} matches"),
            (total, _, false) => format!("{total}+"),
        }
    }

    /// A key while the find bar is open. Nothing reaches the program.
    fn find_key(&mut self, keystroke: &Keystroke, cx: &mut Context<Self>) -> bool {
        let m = keystroke.modifiers;
        match keystroke.key.as_str() {
            "escape" => self.close_find(cx),
            "enter" if m.shift => {
                self.find_previous(cx);
            }
            "enter" => {
                self.find_next(cx);
            }
            "backspace" => {
                let mut query = std::mem::take(&mut self.find.query);
                if std::mem::take(&mut self.find.replace_on_type) {
                    query.clear();
                } else {
                    query.pop();
                }
                self.set_find_query(&query, cx);
            }
            // The copy and paste keys act on the field.
            "v" if m.platform => {
                if let Some(text) = self.clipboard.read_text(cx) {
                    let line = text.lines().next().unwrap_or_default().to_owned();
                    self.find_type(&line, cx);
                }
            }
            "c" if m.platform => {
                let query = self.find.query.clone();
                self.clipboard.write_text(&query, cx);
            }
            _ if m.platform => return false,
            _ => {
                if let Some(text) = keystroke
                    .key_char
                    .as_deref()
                    .filter(|t| !m.control && !t.chars().any(char::is_control))
                {
                    self.find_type(text, cx);
                }
            }
        }
        true
    }

    /// Paste text: bracketed when the program asked for it, newlines as Enter otherwise.
    pub fn paste(&mut self, text: &str, cx: &mut Context<Self>) {
        if self.can_type() {
            let bytes = self.vt.paste_bytes(text);
            self.type_bytes(bytes, cx);
        }
    }

    /// A wheel or trackpad event. The program gets it when it takes the mouse; on the alternate
    /// screen without the mouse it gets arrow keys; otherwise the scrollback moves.
    pub fn scroll_wheel(&mut self, event: &ScrollWheelEvent, cx: &mut Context<Self>) {
        let Some(fit) = self.fitted else { return };
        let (cols, rows) = self.vt.size();
        let steps = scroll::steps(
            &mut self.scrolled,
            event.delta,
            event.touch_phase,
            size(fit.metrics.width, fit.metrics.height),
            cols,
            rows,
        );
        if steps.x == 0 && steps.y == 0 {
            return;
        }
        if self.vt.mouse_tracking() {
            if self.can_type() {
                let mut out = Vec::new();
                for (count, positive, negative) in [
                    (steps.y, MouseButton::WheelUp, MouseButton::WheelDown),
                    (steps.x, MouseButton::WheelRight, MouseButton::WheelLeft),
                ] {
                    let button = if count > 0 { positive } else { negative };
                    for _ in 0..count.unsigned_abs() {
                        out.extend(self.mouse_bytes(
                            MouseAction::Press,
                            Some(button),
                            event.position,
                            event.modifiers,
                            false,
                        ));
                    }
                }
                self.send_unscrolled(out);
            }
        } else if steps.y == 0 {
        } else if self.vt.alt_screen() {
            if self.can_type() {
                let key = if steps.y > 0 {
                    g::GHOSTTY_KEY_ARROW_UP
                } else {
                    g::GHOSTTY_KEY_ARROW_DOWN
                };
                let mut out = Vec::new();
                for _ in 0..steps.y.unsigned_abs() {
                    out.extend(self.vt.encode_key(KeyInput {
                        key,
                        mods: 0,
                        consumed: 0,
                        text: None,
                        unshifted: None,
                        repeat: false,
                    }));
                }
                self.send_unscrolled(out);
            }
        } else {
            self.vt.scroll_viewport(-(steps.y as isize));
        }
        cx.notify();
    }

    /// Bytes for the program that don't end a scroll back in history. The core takes input as
    /// text, so a report that is not valid UTF-8 (an X10 mouse report past column 95, whose
    /// coordinate bytes are 0x80 and up) is dropped: sending U+FFFD instead would put a wrong
    /// position in the program's input. Programs that take the mouse nearly always ask for the
    /// SGR format, which is plain text.
    fn send_unscrolled(&self, bytes: Vec<u8>) {
        if !bytes.is_empty() && std::str::from_utf8(&bytes).is_ok() {
            self.send(ToCore::Input(bytes));
        }
    }

    fn mouse_bytes(
        &mut self,
        action: MouseAction,
        button: Option<MouseButton>,
        position: Point<Pixels>,
        modifiers: Modifiers,
        any_pressed: bool,
    ) -> Vec<u8> {
        let Some(fit) = self.fitted else {
            return Vec::new();
        };
        let local = position - self.origin;
        let scale = self.scale;
        let mut mods = 0;
        for (held, bit) in [
            (modifiers.shift, g::GHOSTTY_MODS_SHIFT),
            (modifiers.alt, g::GHOSTTY_MODS_ALT),
            (modifiers.control, g::GHOSTTY_MODS_CTRL),
        ] {
            if held {
                mods |= bit as g::GhosttyMods;
            }
        }
        self.vt.encode_mouse(MouseInput {
            action,
            button,
            mods,
            x: f32::from(local.x).max(0.0) * scale,
            y: f32::from(local.y).max(0.0) * scale,
            any_pressed,
            cell: (
                f32::from(fit.metrics.width) * scale,
                f32::from(fit.metrics.height) * scale,
            ),
        })
    }

    /// Report a button press, release or motion to a program that takes the mouse. False when
    /// the event is the terminal's own (the program doesn't take the mouse, or Shift keeps it).
    pub fn mouse(
        &mut self,
        action: MouseAction,
        button: Option<GpuiButton>,
        position: Point<Pixels>,
        modifiers: Modifiers,
    ) -> bool {
        let takes = self.can_type() && self.vt.mouse_tracking() && !modifiers.shift;
        match (action, button) {
            // Only a press the program was told of is remembered, so only its release is
            // reported: the program never sees the end of a click it did not see begin.
            (MouseAction::Press, Some(b)) if takes => {
                if !self.buttons_down.contains(&b) {
                    self.buttons_down.push(b);
                }
            }
            (MouseAction::Release, Some(b)) => {
                let Some(at) = self.buttons_down.iter().position(|d| *d == b) else {
                    return false;
                };
                self.buttons_down.remove(at);
            }
            _ => {}
        }
        if !takes && !matches!(action, MouseAction::Release) {
            return false;
        }
        if !self.can_type() {
            return true;
        }
        let raw = button.map(|b| match b {
            GpuiButton::Left => MouseButton::Left,
            GpuiButton::Right => MouseButton::Right,
            _ => MouseButton::Middle,
        });
        let any = !self.buttons_down.is_empty();
        let bytes = self.mouse_bytes(action, raw, position, modifiers, any);
        self.send_unscrolled(bytes);
        true
    }

    /// Tell the view whether its pane is on screen. A pane taken off screen is no longer
    /// focused (the program is told, if it asked), drops any composition, and stops blinking.
    pub fn set_visible(&mut self, visible: bool, cx: &mut Context<Self>) {
        if self.hidden == !visible {
            return;
        }
        self.hidden = !visible;
        if self.hidden {
            self.marked = None;
            if std::mem::take(&mut self.was_focused) && self.can_type() && self.vt.dec_mode(1004) {
                self.send(ToCore::Input(b"\x1b[O".to_vec()));
            }
        }
        cx.notify();
    }

    /// The pane is not on screen (see [`Self::set_visible`]).
    pub fn is_hidden(&self) -> bool {
        self.hidden
    }

    /// Size the shell of a pane that is off screen as a pane of `bounds` would, so a program
    /// redraws for the size it will have when its tab comes back. Does nothing for a pane that
    /// is shown (it sizes itself as it is laid out) or that does not hold the resize lease.
    pub fn size_while_hidden(&mut self, bounds: Size<Pixels>, window: &Window) {
        if !self.hidden || self.status != Status::Live || !self.resize_lease {
            return;
        }
        let (pad_x, pad_y) = self.settings.padding;
        let available = size(
            (bounds.width - px(2. * pad_x)).max(px(0.)),
            (bounds.height - px(2. * pad_y)).max(px(0.)),
        );
        if available.width <= px(0.) || available.height <= px(0.) {
            return;
        }
        let fit = layout::fit(
            window,
            available,
            &self.settings.font_family,
            self.settings.font_px,
        );
        self.fitted = Some(fit);
        if self.requested != Some((fit.cols, fit.rows)) {
            self.requested = Some((fit.cols, fit.rows));
            self.send(ToCore::Resize(fit.cols, fit.rows));
        }
    }

    /// What decides the cell a hidden pane is sized with: the face, its size and the screen.
    pub fn cell_key(&self, window: &Window) -> (String, u32, u32) {
        (
            self.settings.font_family.clone(),
            self.settings.font_px.to_bits(),
            window.scale_factor().to_bits(),
        )
    }

    /// Hand the keyboard to the terminal.
    pub fn focus(&self, window: &mut Window, cx: &mut App) {
        self.focus.focus(window, cx);
    }

    /// Fit the pane, attach if that was waiting for a size, ask the core for the size, and read
    /// the frame.
    fn prepare(
        &mut self,
        bounds: Bounds<Pixels>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Painted {
        self.scale = window.scale_factor();
        let dark = self.dark_override.unwrap_or(matches!(
            window.appearance(),
            WindowAppearance::Dark | WindowAppearance::VibrantDark
        ));
        if self.applied_dark != Some(dark) {
            self.apply_settings(cx);
        }
        let (pad_x, pad_y) = self.settings.padding;
        let family = self.settings.font_family.clone();
        let available = size(
            (bounds.size.width - px(2. * pad_x)).max(px(0.)),
            (bounds.size.height - px(2. * pad_y)).max(px(0.)),
        );
        // A view that doesn't hold the resize lease takes the core's size and draws it at the
        // size it was last laid out at.
        let sizes_itself = self.to_core.is_none()
            || self.resize_lease
            || self.pending.is_some()
            || std::mem::take(&mut self.refit);
        let fit = match self.fitted {
            Some(fit) if !sizes_itself => Fit {
                metrics: layout::metrics(window, &family, fit.metrics.font_px),
                ..fit
            },
            _ => layout::fit(window, available, &family, self.settings.font_px),
        };
        self.fitted = Some(fit);
        let snap = |v: Pixels| px((f32::from(v) * self.scale).round() / self.scale);
        self.origin = point(
            snap(bounds.origin.x + px(pad_x)),
            snap(bounds.origin.y + px(pad_y)),
        );
        // A pane with no room (hidden, or not laid out yet) has no size to tell anyone: the shell
        // would be squeezed to one cell and the attach would start at that.
        let sized = available.width > px(0.) && available.height > px(0.);
        if !sized {
            // Nothing to attach at or to resize to yet.
        } else if let Some(pending) = self.pending.take() {
            // The shell starts at the size of the pane it opens in.
            self.vt.resize(fit.cols, fit.rows, self.cell_px());
            let (to_core, from_core) = attach::attach(
                pending.core,
                pending.session_id,
                pending.provider,
                fit.cols,
                fit.rows,
            );
            self.link(to_core, from_core, cx);
        } else if self.to_core.is_none() {
            // Nothing sizes this terminal but its pane.
            if self.vt.size() != (fit.cols, fit.rows) {
                self.vt.resize(fit.cols, fit.rows, self.cell_px());
            }
        } else if self.resize_lease
            && self.status == Status::Live
            && self.requested != Some((fit.cols, fit.rows))
        {
            self.requested = Some((fit.cols, fit.rows));
            self.send(ToCore::Resize(fit.cols, fit.rows));
        }
        if std::mem::take(&mut self.take_focus) {
            self.focus.focus(window, cx);
        }
        let focused = self.focus.is_focused(window);
        if focused != self.was_focused {
            self.was_focused = focused;
            // Focus reporting, if the program asked for it (mode 1004).
            if self.can_type() && self.vt.dec_mode(1004) {
                self.send(ToCore::Input(
                    if focused { b"\x1b[I" } else { b"\x1b[O" }.to_vec(),
                ));
            }
        }
        let images = self.image_layers(fit.metrics);
        let bar = self.scrollbar_geometry(bounds, fit.metrics);
        self.bar = bar.map(|(hit, _)| hit);
        let frame = self.vt.frame();
        let frame_cursor_cell = frame.cursor_cell;
        self.cursor_cell = frame.cursor_cell;
        self.cursor_blinks = frame.cursor.is_some_and(|c| c.blink);
        Painted {
            frame,
            metrics: fit.metrics,
            origin: self.origin,
            scale: self.scale,
            focused,
            family,
            opacity: self.settings.opacity,
            blink_on: self.blink_on,
            link: self
                .hover_link
                .as_ref()
                .map(|h| h.spans.clone())
                .unwrap_or_default(),
            marked: self
                .marked
                .clone()
                .zip(frame_cursor_cell)
                .map(|(text, (x, y))| {
                    let cells = text_width(&text);
                    (text, x, y, cells)
                }),
            bar: bar.map(|(_, drawn)| drawn),
            images,
        }
    }

    /// How many image versions are uploaded: those some placement on the screen draws.
    pub fn uploaded_images(&self) -> usize {
        self.images.len()
    }

    /// The images on the screen as uploaded and placed: each is uploaded once per version of its
    /// pixels and part drawn, and dropped when no placement draws it.
    fn image_layers(&mut self, metrics: Metrics) -> Vec<(Layer, Bounds<Pixels>, Arc<RenderImage>)> {
        let mut layers = Vec::new();
        let mut keep = std::collections::HashSet::new();
        for placement in self.vt.placements() {
            let key = (placement.image, placement.generation, placement.source);
            keep.insert(key);
            if !self.images.contains_key(&key) {
                let upload = self
                    .vt
                    .image_bgra(placement.image, placement.source)
                    .and_then(|(w, h, bgra)| image::RgbaImage::from_raw(w, h, bgra));
                if let Some(buffer) = upload {
                    self.images.insert(
                        key,
                        Arc::new(RenderImage::new(vec![image::Frame::new(buffer)])),
                    );
                }
            }
            let Some(data) = self.images.get(&key) else {
                continue;
            };
            let [x, y, mut width, mut height] =
                placement.pixel_geometry(f32::from(metrics.width), f32::from(metrics.height));
            if placement.cell_pixels.is_none() {
                // A direct placement is measured in device pixels.
                width /= self.scale;
                height /= self.scale;
            }
            let at = self.origin + point(px(x), px(y));
            layers.push((
                placement.layer(),
                Bounds::new(at, size(px(width), px(height))),
                data.clone(),
            ));
        }
        self.images.retain(|k, _| keep.contains(k));
        layers
    }

    /// The scrollbar, when there is history to scroll on the primary screen of a pane wide
    /// enough for it, and the setting is on: its strip and thumb for clicks, and the rail and
    /// thumb as drawn.
    #[allow(clippy::type_complexity)]
    fn scrollbar_geometry(
        &self,
        bounds: Bounds<Pixels>,
        metrics: Metrics,
    ) -> Option<(BarHit, (Bounds<Pixels>, Bounds<Pixels>))> {
        let (cols, rows) = self.vt.size();
        if !self.settings.scrollbar || self.vt.alt_screen() || cols < scrollbar::MIN_COLS {
            return None;
        }
        let bar = self.vt.scrollbar();
        let track = f32::from(metrics.height) * f32::from(rows);
        let min = f32::from(metrics.height);
        let (top, len) = scrollbar::thumb(bar.total, bar.offset, bar.len, track, min)?;
        let lane = scrollbar::lane(
            bounds,
            self.origin,
            metrics.width * f32::from(cols),
            px(track),
        );
        let width = px(4.0);
        let x = lane.origin.x + lane.size.width - width - px(2.0);
        let rail = Bounds::new(
            point(x + width / 2.0 - px(0.5), self.origin.y),
            size(px(1.0), px(track)),
        );
        let thumb = Bounds::new(point(x, self.origin.y + px(top)), size(width, px(len)));
        let hit = Bounds::new(
            point(lane.origin.x, thumb.origin.y),
            size(lane.size.width, thumb.size.height),
        );
        Some((BarHit { lane, thumb: hit }, (rail, thumb)))
    }

    /// The row the thumb lands the view on when it is held `grab` px from its top and the
    /// pointer is at `y`.
    fn bar_row(&self, lane: Bounds<Pixels>, grab: f32, y: Pixels) -> usize {
        let bar = self.vt.scrollbar();
        let track = f32::from(lane.size.height);
        let min = track / f32::from(self.vt.size().1.max(1));
        let top = f32::from(y - lane.origin.y) - grab;
        scrollbar::row_at(bar.total, bar.len, track, min, top)
    }

    /// A press on the scrollbar: grab the thumb where it was pressed, or centre it on the
    /// pointer when the press was on the track beside it. True when the press was on the bar.
    fn bar_press(&mut self, position: Point<Pixels>, cx: &mut Context<Self>) -> bool {
        let Some(hit) = self.bar else { return false };
        if !hit.lane.contains(&position) {
            return false;
        }
        let grab = scrollbar::grab_at(
            f32::from(hit.thumb.origin.y),
            f32::from(hit.thumb.size.height),
            f32::from(position.y),
        );
        self.bar_grab = Some(grab);
        if !hit.thumb.contains(&position) {
            let row = self.bar_row(hit.lane, grab, position.y);
            self.vt.scroll_to_row(row);
        }
        cx.notify();
        true
    }

    /// A drag of the thumb.
    fn bar_drag(&mut self, y: Pixels, cx: &mut Context<Self>) {
        let (Some(hit), Some(grab)) = (self.bar, self.bar_grab) else {
            return;
        };
        let row = self.bar_row(hit.lane, grab, y);
        self.vt.scroll_to_row(row);
        cx.notify();
    }

    /// What the pane says about the session when it is not simply showing the shell, in the
    /// words the web's agent chip uses.
    pub fn note(&self) -> Option<String> {
        if let Some(reason) = &self.drop_notice {
            return Some(reason.clone());
        }
        let sleeping = self.agent.is_some_and(|a| a.state == AgentState::Sleeping);
        match &self.status {
            Status::Detached => Some("Not connected".into()),
            Status::Connecting => Some("Connecting".into()),
            Status::Live => {
                let Some(agent) = self.agent else {
                    return (!self.can_type()).then(|| "Viewing agent".into());
                };
                if agent.state == AgentState::Reconnecting {
                    Some("Reconnecting\u{2026}".into())
                } else if agent.resize_on_device && !agent.resize {
                    Some("A phone sets this terminal's size".into())
                } else if self.can_type() {
                    None
                } else if agent.input_elsewhere {
                    Some("Another view is typing in this agent".into())
                } else {
                    Some("Viewing agent".into())
                }
            }
            Status::Disconnected(_) if self.reconnects => {
                Some("Disconnected \u{2014} reconnecting to the core\u{2026}".into())
            }
            Status::Disconnected(_) => Some("Disconnected".into()),
            Status::Failed(reason) => Some(format!("Could not open the terminal: {reason}")),
            // A hibernated agent closes its terminal like an exit, but its conversation is kept.
            Status::Exited(_) if sleeping => {
                Some("Sleeping to save memory \u{2014} its conversation is kept".into())
            }
            Status::Exited(code) => Some(format!("Shell exited (code {code})")),
        }
    }

    /// Whether this view may take the input and the size from another view or a phone.
    pub fn can_take_control(&self) -> bool {
        self.to_core.is_some()
            && self.status == Status::Live
            && (!self.input_lease || !self.resize_lease)
    }

    /// Do one of the named actions. False when it did nothing: no selection to copy, nothing to
    /// paste, a view that cannot type, or no terminal to act on.
    pub fn perform(&mut self, action: Action, cx: &mut Context<Self>) -> bool {
        match action {
            Action::Scroll(scroll) => {
                let (_, rows) = self.vt.size();
                match scroll {
                    Scroll::Top => self.vt.scroll_to_top(),
                    Scroll::Bottom => self.vt.scroll_to_bottom(),
                    _ => self
                        .vt
                        .scroll_viewport(scroll.lines(rows).unwrap_or_default()),
                }
                cx.notify();
                true
            }
            Action::Copy => self.copy(cx),
            Action::Paste => self.paste_clipboard(cx),
            Action::SelectAll => {
                self.select_all(cx);
                true
            }
            Action::Clear => {
                // Only this view's history: the program is never told.
                self.vt.write(b"\x1b[3J");
                cx.notify();
                true
            }
            Action::Find => {
                self.open_find(cx);
                true
            }
            Action::TakeControl => {
                if !self.can_take_control() {
                    return false;
                }
                self.send(ToCore::TakeControl);
                true
            }
            Action::Kill => {
                if !self.can_stop() {
                    return false;
                }
                self.send(ToCore::Kill);
                true
            }
        }
    }
}

impl TerminalView {
    /// The find bar over the pane's top right: the query, the match counter and the buttons.
    /// A click on it never reaches the terminal underneath.
    fn find_bar(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let button = |id: &'static str, label: &'static str| {
            div()
                .id(id)
                .w(px(22.))
                .h(px(22.))
                .flex()
                .items_center()
                .justify_center()
                .rounded_sm()
                .bg(rgb(0x3a3a40))
                .text_color(rgb(0xd8d8de))
                .hover(|style| style.bg(rgb(0x4a4a52)))
                .child(label)
        };
        let query = if self.find.query.is_empty() {
            SharedString::from("Find…")
        } else {
            SharedString::from(self.find.query.clone())
        };
        div()
            .id("terminal-find")
            .absolute()
            .top_2()
            .right_3()
            .flex()
            .items_center()
            .gap_1()
            .px_2()
            .py_1()
            .rounded_md()
            .bg(rgb(0x2a2a2e))
            .text_xs()
            .text_color(rgb(0xd8d8de))
            .on_mouse_down(GpuiButton::Left, |_, _, cx| cx.stop_propagation())
            .child(
                div()
                    .w(px(150.))
                    .px_1()
                    .overflow_hidden()
                    .text_color(if self.find.query.is_empty() {
                        rgb(NOTE_COLOR)
                    } else {
                        rgb(0xd8d8de)
                    })
                    .child(query),
            )
            .child(
                div()
                    .min_w(px(56.))
                    .text_color(rgb(NOTE_COLOR))
                    .child(self.find_label()),
            )
            .child(
                button("find-previous", "↑").on_click(cx.listener(|this, _, _, cx| {
                    this.find_previous(cx);
                })),
            )
            .child(
                button("find-next", "↓").on_click(cx.listener(|this, _, _, cx| {
                    this.find_next(cx);
                })),
            )
            .child(
                button("find-close", "×").on_click(cx.listener(|this, _, _, cx| {
                    this.close_find(cx);
                })),
            )
    }
}

impl Focusable for TerminalView {
    fn focus_handle(&self, _: &App) -> FocusHandle {
        self.focus.clone()
    }
}

/// How many cells `text` takes on the screen, by the terminal's own rules for clusters.
fn text_width(text: &str) -> usize {
    let codepoints: Vec<u32> = text.chars().map(u32::from).collect();
    let (mut at, mut total) = (0, 0);
    while at < codepoints.len() {
        let mut width = 0u8;
        // SAFETY: the pointer and length describe the rest of `codepoints`.
        let used = unsafe {
            g::ghostty_unicode_grapheme_width(
                codepoints[at..].as_ptr(),
                codepoints.len() - at,
                &mut width,
            )
        };
        total += usize::from(width);
        at += used.max(1);
    }
    total
}

fn color(c: Rgb) -> Hsla {
    rgb(u32::from(c.0) << 16 | u32::from(c.1) << 8 | u32::from(c.2)).into()
}

/// Cells that draw as one shaped line: the same look, one character each.
fn same_run(a: &Cell, b: &Cell) -> bool {
    !b.wide
        && b.text.chars().count() <= 1
        && b.text.is_ascii()
        && !sprites::is_sprite(&b.text)
        && a.fg == b.fg
        && a.bold == b.bold
        && a.italic == b.italic
        && a.faint == b.faint
        && a.underline == b.underline
        && a.underline_style == b.underline_style
        && a.underline_color == b.underline_color
        && a.strike == b.strike
}

/// An underline of `style` from `from` for `width`, `cell` being one cell's width: straight,
/// two lines, a wave, dots or dashes. A run shares one colour, so the pattern restarts with it.
#[allow(clippy::too_many_arguments)]
fn paint_underline(
    window: &mut Window,
    style: Underline,
    color: Hsla,
    from: Point<Pixels>,
    width: Pixels,
    cell: Pixels,
    thickness: Pixels,
    snap_box: &dyn Fn(Bounds<Pixels>) -> Bounds<Pixels>,
) {
    let mut quad = |x: Pixels, y: Pixels, w: Pixels| {
        let b = Bounds::new(from + point(x, y), size(w, thickness));
        window.paint_quad(fill(snap_box(b), color));
    };
    match style {
        Underline::Double => {
            quad(px(0.), -thickness * 1.5, width);
            quad(px(0.), thickness * 0.5, width);
        }
        Underline::Curly => {
            // A stair-step wave, four steps to the cell.
            let step = cell / 4.0;
            let mut x = px(0.);
            let mut n = 0;
            while x < width {
                let up = [1.0, 0.0, -1.0, 0.0][n % 4];
                quad(x, thickness * up, step.min(width - x));
                x += step;
                n += 1;
            }
        }
        Underline::Dotted | Underline::Dashed => {
            let (on, off) = if style == Underline::Dotted {
                (cell / 4.0, cell / 4.0)
            } else {
                (cell * 0.6, cell * 0.4)
            };
            let mut x = px(0.);
            while x < width {
                quad(x, px(0.), on.min(width - x));
                x += on + off;
            }
        }
        _ => quad(px(0.), px(0.), width),
    }
}

fn paint_frame(bounds: Bounds<Pixels>, painted: Painted, window: &mut Window, cx: &mut App) {
    let Painted {
        frame,
        metrics,
        origin,
        scale,
        focused,
        family,
        opacity,
        blink_on,
        link,
        marked,
        bar,
        images,
    } = painted;
    // ponytail: opacity is applied per colour, not to the pane as a group like the web's CSS
    // opacity, so text over a cell background shows the background through it twice.
    let col = |c: Rgb| {
        let mut h = color(c);
        h.a *= opacity;
        h
    };
    let snap = |v: Pixels| px((f32::from(v) * scale).round() / scale);
    let snap_box = |b: Bounds<Pixels>| {
        let (x0, x1) = (snap(b.origin.x), snap(b.origin.x + b.size.width));
        let (y0, y1) = (snap(b.origin.y), snap(b.origin.y + b.size.height));
        Bounds::new(point(x0, y0), size(x1 - x0, y1 - y0))
    };
    let (cw, ch) = (metrics.width, metrics.height);
    let at = |x: usize, y: usize| origin + point(cw * x as f32, ch * y as f32);
    let thickness = px((metrics.font_px / 14.0 * scale).round().max(1.0) / scale);
    // Where the baseline sits in a cell, and the rules that hang off it.
    let baseline = (ch - (metrics.ascent + metrics.descent)) / 2.0 + metrics.ascent;
    let underline = baseline + thickness;
    let strike = baseline - metrics.ascent * 0.35;

    window.paint_quad(fill(bounds, col(frame.bg)));
    let paint_images = |layer: Layer, window: &mut Window| {
        for (_, area, data) in images.iter().filter(|(l, ..)| *l == layer) {
            let _ = window.paint_image(*area, *area, Corners::default(), data.clone(), 0, false);
        }
    };
    paint_images(Layer::UnderBackground, window);

    // Backgrounds first, a run of one colour as one quad so neighbours meet without a seam.
    for (y, row) in frame.rows.iter().enumerate() {
        let mut x = 0;
        while x < row.len() {
            let Some(bg) = row[x].bg else {
                x += 1;
                continue;
            };
            let start = x;
            while x < row.len() && row[x].bg == Some(bg) {
                x += 1;
            }
            let run = Bounds::new(at(start, y), size(cw * (x - start) as f32, ch));
            window.paint_quad(fill(snap_box(run), col(bg)));
        }
    }

    // Matches of the search: a tint over the cells, brighter on the one navigation is on.
    for span in &frame.search {
        let amount = if span.selected { 0.55 } else { 0.28 };
        let mut tint = color(MATCH_COLOR);
        tint.a = amount * opacity;
        let run = Bounds::new(
            at(usize::from(span.start), usize::from(span.row)),
            size(cw * f32::from(span.end - span.start + 1), ch),
        );
        window.paint_quad(fill(snap_box(run), tint));
    }

    paint_images(Layer::UnderText, window);

    // Glyphs: a run of cells with one look is one line, placed a cell apart; a wide character
    // or a cluster is a run of its own.
    for (y, row) in frame.rows.iter().enumerate() {
        let mut x = 0;
        while x < row.len() {
            let first = &row[x];
            let start = x;
            let ruled = first.underline || first.strike;
            if first.text.is_empty() && !ruled {
                x += 1;
                continue;
            }
            let mut text = String::new();
            let mut glyphs = 0;
            let push = |cell: &Cell, text: &mut String| {
                text.push_str(if cell.text.is_empty() {
                    " "
                } else {
                    &cell.text
                });
            };
            let sprite = sprites::is_sprite(&first.text);
            let first_font = layout::cell_font(&family, first.bold, first.italic);
            let font_px = px(metrics.font_px);
            // An icon the font lacks comes from the bundled symbols font, fitted to its cell.
            let icon = (!sprite && !first.wide)
                .then(|| {
                    fallback::fallback_icon(&first.text, &first_font, window.text_system(), font_px)
                })
                .flatten();
            let mut fitted = font_px;
            if sprite || icon.is_some() {
                // Shapes and icons that fit the cell, not glyphs from the font.
                x += 1;
            } else if first.wide || first.text.chars().count() > 1 || !first.text.is_ascii() {
                push(first, &mut text);
                glyphs = 1;
                x += 1 + usize::from(first.wide);
                // A fallback glyph wider than its cell is scaled to it.
                fitted = fallback::fallback_size(
                    &first.text,
                    first.wide,
                    &first_font,
                    cw,
                    font_px,
                    window.text_system(),
                )
                .unwrap_or(font_px);
            } else {
                push(first, &mut text);
                x += 1;
                while x < row.len() && same_run(first, &row[x]) {
                    if !row[x].text.is_empty() {
                        glyphs = x - start + 1;
                    }
                    push(&row[x], &mut text);
                    x += 1;
                }
                if first.text.chars().count() == 1 {
                    glyphs = glyphs.max(1);
                }
            }
            let end = x.min(row.len());
            let mut fg = col(first.fg);
            if first.faint {
                fg.a = 0.6;
            }
            if sprite {
                sprites::paint(
                    &first.text,
                    Bounds::new(at(start, y), size(cw, ch)),
                    fg,
                    window,
                );
            }
            if let Some(icon) = icon {
                // Two cells of room when a blank follows (a prompt, a file tree), else one.
                let room = if row.get(start + 1).is_none_or(|d| d.text.trim().is_empty()) {
                    2.0
                } else {
                    1.0
                };
                let (offset, icon_px) =
                    fallback::fit_icon(icon, (f32::from(cw), f32::from(ch)), room);
                let symbols = window
                    .text_system()
                    .resolve_font(&gpui::font(fallback::SYMBOLS_FONT));
                let _ = window.paint_glyph(
                    at(start, y) + offset,
                    symbols,
                    gpui::GlyphId(icon.id),
                    icon_px,
                    fg,
                );
            }
            if glyphs > 0 {
                // Trailing blanks carry no ink.
                let kept = text.trim_end_matches(' ').len();
                text.truncate(kept);
                if !text.is_empty() {
                    let run = TextRun {
                        len: text.len(),
                        font: layout::cell_font(&family, first.bold, first.italic),
                        color: fg,
                        background_color: None,
                        underline: None,
                        strikethrough: None,
                    };
                    let line = window.text_system().shape_line(
                        SharedString::from(text),
                        fitted,
                        &[run],
                        Some(cw),
                    );
                    let _ = line.paint(
                        at(start, y) + point(metrics.glyph_x, px(0.)),
                        ch,
                        TextAlign::Left,
                        None,
                        window,
                        cx,
                    );
                }
            }
            if first.underline {
                let line = first.underline_color.map_or(fg, color);
                paint_underline(
                    window,
                    first.underline_style,
                    line,
                    at(start, y) + point(px(0.), underline),
                    cw * (end - start) as f32,
                    cw,
                    thickness,
                    &snap_box,
                );
            }
            if first.strike {
                let rule = Bounds::new(
                    at(start, y) + point(px(0.), strike),
                    size(cw * (end - start) as f32, thickness),
                );
                window.paint_quad(fill(snap_box(rule), fg));
            }
        }
    }

    // The link under the pointer is underlined.
    for (row, first, last) in link {
        let rule = Bounds::new(
            at(usize::from(first), usize::from(row)) + point(px(0.), underline),
            size(cw * f32::from(last - first + 1), thickness),
        );
        window.paint_quad(fill(snap_box(rule), col(frame.fg)));
    }

    paint_images(Layer::OverText, window);

    // The cursor, over the glyph it covers. A blinking one is off half the time while focused.
    if let Some(cursor) = frame.cursor.filter(|c| blink_on || !focused || !c.blink) {
        let (x, y) = (cursor.x as usize, cursor.y as usize);
        let under = frame.rows.get(y).and_then(|r| r.get(x));
        let width = cw * if cursor.wide { 2.0 } else { 1.0 };
        let cell = Bounds::new(at(x, y), size(width, ch));
        let c = col(cursor.color);
        use super::vt::CursorShape::*;
        match (focused, cursor.shape) {
            (true, Block) => {
                window.paint_quad(fill(snap_box(cell), c));
                if let Some(glyph) = under.filter(|c| sprites::is_sprite(&c.text)) {
                    sprites::paint(&glyph.text, cell, col(cursor.text), window);
                } else if let Some(glyph) = under.filter(|c| !c.text.is_empty()) {
                    let run = TextRun {
                        len: glyph.text.len(),
                        font: layout::cell_font(&family, glyph.bold, glyph.italic),
                        color: col(cursor.text),
                        background_color: None,
                        underline: None,
                        strikethrough: None,
                    };
                    let line = window.text_system().shape_line(
                        SharedString::from(glyph.text.clone()),
                        px(metrics.font_px),
                        &[run],
                        Some(cw),
                    );
                    let _ = line.paint(
                        at(x, y) + point(metrics.glyph_x, px(0.)),
                        ch,
                        TextAlign::Left,
                        None,
                        window,
                        cx,
                    );
                }
            }
            (true, Bar) => {
                let bar = Bounds::new(at(x, y), size(px(2.0), ch));
                window.paint_quad(fill(snap_box(bar), c));
            }
            (true, Underline) => {
                let rule =
                    Bounds::new(at(x, y) + point(px(0.), ch - px(2.0)), size(width, px(2.0)));
                window.paint_quad(fill(snap_box(rule), c));
            }
            _ => window.paint_quad(outline(snap_box(cell), c, BorderStyle::Solid)),
        }
    }

    // What an input method is composing: over the cells at the cursor, underlined.
    if let Some((text, x, y, cells)) = marked {
        let (x, y) = (usize::from(x), usize::from(y));
        let run = Bounds::new(at(x, y), size(cw * cells as f32, ch));
        window.paint_quad(fill(snap_box(run), col(frame.bg)));
        // Each cell is placed on its own, so a wide character is followed by its spacer.
        let text: String = text
            .chars()
            .flat_map(|c| {
                let wide = text_width(c.encode_utf8(&mut [0; 4])) == 2;
                [Some(c), wide.then_some(' ')]
            })
            .flatten()
            .collect();
        let run_style = TextRun {
            len: text.len(),
            font: layout::cell_font(&family, false, false),
            color: col(frame.fg),
            background_color: None,
            underline: None,
            strikethrough: None,
        };
        let line = window.text_system().shape_line(
            SharedString::from(text),
            px(metrics.font_px),
            &[run_style],
            Some(cw),
        );
        let _ = line.paint(
            at(x, y) + point(metrics.glyph_x, px(0.)),
            ch,
            TextAlign::Left,
            None,
            window,
            cx,
        );
        let rule = Bounds::new(
            at(x, y) + point(px(0.), underline),
            size(cw * cells as f32, thickness),
        );
        window.paint_quad(fill(snap_box(rule), col(frame.fg)));
    }

    // The scrollbar: a thin rail and a thumb, over the padding.
    if let Some((rail, thumb)) = bar {
        let mut rail_color = color(frame.fg);
        rail_color.a = 0.2 * opacity;
        window.paint_quad(fill(snap_box(rail), rail_color));
        let mut thumb_color = color(frame.fg);
        thumb_color.a = 0.45 * opacity;
        window.paint_quad(fill(snap_box(thumb), thumb_color).corner_radii(px(2.0)));
    }
}

impl gpui::Render for TerminalView {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let view = cx.entity();
        let paint_view = view.clone();
        let focused = self.focus.is_focused(window);
        let mut bg = color(self.vt.background());
        bg.a = self.settings.opacity;
        let note = self.note();
        let take_control = self.can_take_control() && self.status == Status::Live;
        let mut pane = div()
            .id("terminal")
            .track_focus(&self.focus)
            .key_context("Terminal")
            .relative()
            .size_full()
            .overflow_hidden()
            .bg(bg)
            .on_key_down(cx.listener(|this, event: &KeyDownEvent, _, cx| {
                if this.key_down(event, cx) {
                    cx.stop_propagation();
                }
            }))
            .when(self.hover_link.is_some(), |pane| pane.cursor_pointer())
            .on_modifiers_changed(cx.listener(
                |this, event: &gpui::ModifiersChangedEvent, _, cx| {
                    this.modifiers_changed(event.modifiers, cx);
                },
            ))
            .on_drop(cx.listener(|this, dropped: &gpui::ExternalPaths, _, cx| {
                this.drop_paths(dropped.paths(), cx);
            }))
            .on_scroll_wheel(cx.listener(|this, event: &ScrollWheelEvent, _, cx| {
                this.scroll_wheel(event, cx);
                cx.stop_propagation();
            }))
            .on_mouse_move(cx.listener(|this, event: &MouseMoveEvent, _, cx| {
                this.mouse_moved(event, cx);
            }));
        for button in [GpuiButton::Left, GpuiButton::Middle, GpuiButton::Right] {
            pane = pane
                .on_mouse_down(
                    button,
                    cx.listener(|this, event: &MouseDownEvent, window, cx| {
                        this.focus.focus(window, cx);
                        this.mouse_down(event, cx);
                    }),
                )
                .on_mouse_up(
                    button,
                    cx.listener(|this, event: &MouseUpEvent, _, cx| this.mouse_up(event, cx)),
                )
                .on_mouse_up_out(
                    button,
                    cx.listener(|this, event: &MouseUpEvent, _, cx| this.mouse_up(event, cx)),
                );
        }
        pane.child(
            canvas(
                move |bounds, window, cx| {
                    view.update(cx, |this, cx| this.prepare(bounds, window, cx))
                },
                move |bounds, painted, window, cx| {
                    paint_frame(bounds, painted, window, cx);
                    // While focused, the system's text input (dead keys, input methods) types
                    // into this terminal.
                    if focused {
                        let focus = paint_view.read(cx).focus.clone();
                        window.handle_input(
                            &focus,
                            ElementInputHandler::new(bounds, paint_view.clone()),
                            cx,
                        );
                    }
                },
            )
            .size_full(),
        )
        .when(self.find.open, |pane| pane.child(self.find_bar(cx)))
        .when_some(note, |pane, note| {
            pane.child(
                div()
                    .absolute()
                    .bottom_2()
                    .right_3()
                    .flex()
                    .items_center()
                    .gap_2()
                    .text_xs()
                    .text_color(rgb(NOTE_COLOR))
                    .child(note)
                    .when(take_control, |row| {
                        row.child(
                            div()
                                .id("take-control")
                                .px_2()
                                .rounded_sm()
                                .cursor_pointer()
                                .border_1()
                                .border_color(rgb(NOTE_COLOR))
                                .child("Take control")
                                .on_mouse_down(GpuiButton::Left, |_, _, cx| cx.stop_propagation())
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.perform(Action::TakeControl, cx);
                                })),
                        )
                    }),
            )
        })
    }
}

/// Text from the system's input (dead keys, AltGr, input methods) that no key press produced.
/// Composition is drawn at the cursor; what is committed goes to the program as typed.
impl EntityInputHandler for TerminalView {
    fn text_for_range(
        &mut self,
        range: Range<usize>,
        adjusted: &mut Option<Range<usize>>,
        _: &mut Window,
        _: &mut Context<Self>,
    ) -> Option<String> {
        // The only text the input method can ask about is its own composition.
        let marked = self.marked.as_deref().unwrap_or_default();
        let units: Vec<u16> = marked.encode_utf16().collect();
        let end = range.end.min(units.len());
        let start = range.start.min(end);
        *adjusted = Some(start..end);
        Some(String::from_utf16_lossy(&units[start..end]))
    }

    fn selected_text_range(
        &mut self,
        _: bool,
        _: &mut Window,
        _: &mut Context<Self>,
    ) -> Option<UTF16Selection> {
        let end = self
            .marked
            .as_deref()
            .map_or(0, |m| m.encode_utf16().count());
        Some(UTF16Selection {
            range: end..end,
            reversed: false,
        })
    }

    fn marked_text_range(&self, _: &mut Window, _: &mut Context<Self>) -> Option<Range<usize>> {
        self.marked.as_deref().map(|m| 0..m.encode_utf16().count())
    }

    fn unmark_text(&mut self, _: &mut Window, cx: &mut Context<Self>) {
        if self.marked.take().is_some() {
            cx.notify();
        }
    }

    fn replace_text_in_range(
        &mut self,
        _range: Option<Range<usize>>,
        text: &str,
        _: &mut Window,
        cx: &mut Context<Self>,
    ) {
        self.marked = None;
        if self.find.open {
            // The find field holds the keys, composed text included.
            self.find_type(text, cx);
        } else if self.can_type() {
            self.type_bytes(text.as_bytes().to_vec(), cx);
        }
    }

    fn replace_and_mark_text_in_range(
        &mut self,
        _range: Option<Range<usize>>,
        text: &str,
        _selected: Option<Range<usize>>,
        _: &mut Window,
        cx: &mut Context<Self>,
    ) {
        // Composition is shown at the cursor and sent only once committed. While the find field
        // holds the keys, or this view cannot type, nothing is shown.
        let shown = (!text.is_empty() && !self.find.open && self.can_type() && !self.hidden)
            .then(|| text.to_owned());
        if self.marked != shown {
            self.marked = shown;
            cx.notify();
        }
    }

    fn bounds_for_range(
        &mut self,
        range: Range<usize>,
        element: Bounds<Pixels>,
        _: &mut Window,
        _: &mut Context<Self>,
    ) -> Option<Bounds<Pixels>> {
        // The candidate window goes at the cursor, after the text being composed.
        let fit = self.fitted?;
        let (x, y) = self.cursor_cell?;
        let cell = size(fit.metrics.width, fit.metrics.height);
        let before: String = self
            .marked
            .as_deref()
            .map(|m| m.chars().take(range.end).collect())
            .unwrap_or_default();
        let offset = text_width(&before) as f32;
        (element.size.width > px(0.)).then(|| {
            Bounds::new(
                self.origin
                    + point(
                        cell.width * (f32::from(x) + offset),
                        cell.height * f32::from(y),
                    ),
                cell,
            )
        })
    }

    fn character_index_for_point(
        &mut self,
        _: Point<Pixels>,
        _: &mut Window,
        _: &mut Context<Self>,
    ) -> Option<usize> {
        None
    }
}

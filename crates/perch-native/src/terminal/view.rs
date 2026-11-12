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
//! Selection, search, links, IME composition, acting on OSC 52 and the colours of the user's
//! terminal profile are not here yet; [`TerminalEvent`] and [`Appearance`] are where they join.

use super::attach::{self, FromCore, Piece, ToCore};
use super::keys::key_bytes;
use super::layout::{self, Fit, Metrics};
use super::scroll;
use super::vt::{Cell, Event, Frame, KeyInput, MouseAction, MouseButton, MouseInput, Rgb, Vt};
use crate::client::Core;
use crate::ui::OpenSession;
use futures::channel::mpsc::{UnboundedReceiver, UnboundedSender};
use futures::StreamExt;
use ghostty_sys as g;
use gpui::{
    canvas, div, fill, outline, point, prelude::*, px, rgb, size, App, BorderStyle, Bounds,
    Context, ElementInputHandler, EntityInputHandler, EventEmitter, FocusHandle, Focusable, Hsla,
    KeyDownEvent, Keystroke, Modifiers, MouseButton as GpuiButton, MouseDownEvent, MouseMoveEvent,
    MouseUpEvent, Pixels, Point, ScrollWheelEvent, SharedString, Size, Task, TextAlign, TextRun,
    UTF16Selection, Window,
};
use std::ops::Range;

/// Dim text for what the terminal says about itself.
const NOTE_COLOR: u32 = 0x8a8a90;

/// Look of the terminal. The user's terminal profile (font, size, colours) is applied here.
#[derive(Clone, Debug, PartialEq)]
pub struct Appearance {
    pub font_px: f32,
}

impl Default for Appearance {
    fn default() -> Self {
        Self {
            font_px: layout::DEFAULT_FONT_PX,
        }
    }
}

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
}

impl EventEmitter<TerminalEvent> for TerminalView {}

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
}

pub struct TerminalView {
    vt: Vt,
    focus: FocusHandle,
    appearance: Appearance,
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
    /// Where the cursor was at the last frame, hidden or not.
    cursor_cell: Option<(u16, u16)>,
    buttons_down: Vec<GpuiButton>,
    was_focused: bool,
    take_focus: bool,
}

impl TerminalView {
    /// A view attached to nothing: a quiet pane that draws what is fed to it.
    pub fn new(cx: &mut Context<Self>) -> Self {
        Self {
            vt: Vt::new(80, 24),
            focus: cx.focus_handle(),
            appearance: Appearance::default(),
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
            cursor_cell: None,
            buttons_down: Vec::new(),
            was_focused: false,
            take_focus: false,
        }
    }

    /// A view that attaches `open`'s session in `core` when its pane first has a size, and takes
    /// the keyboard focus then. Without a provider the session's own terminal is attached.
    pub fn attach(core: Core, open: &OpenSession, cx: &mut Context<Self>) -> Self {
        let mut view = Self::new(cx);
        view.status = Status::Connecting;
        view.take_focus = true;
        view.pending = Some(Pending {
            core,
            session_id: open.session_id.clone(),
            provider: open
                .provider_id
                .clone()
                .unwrap_or_else(|| perch_core::agent_fleet::TERMINAL_PROVIDER.to_string()),
        });
        view
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

    /// Whether this connection may type: attached, holding the input lease.
    pub fn can_type(&self) -> bool {
        self.to_core.is_some() && self.status == Status::Live && self.input_lease
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
            } => {
                self.input_lease = input;
                self.resize_lease = resize;
                // The size is told once after attaching, as the web terminal does, whatever
                // the fit looks like.
                self.requested = None;
                self.vt.set_replaying(true);
                self.output(&replay, cx);
                self.vt.set_replaying(false);
                self.set_status(Status::Live, cx);
            }
            FromCore::Output(data) => self.output(&data, cx),
            FromCore::Exited(code) => self.set_status(Status::Exited(code), cx),
            FromCore::Failed(reason) => self.set_status(Status::Failed(reason), cx),
            FromCore::Disconnected(reason) => {
                // The screen stays; the shell is not known to have ended.
                self.input_lease = false;
                self.resize_lease = false;
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
        if !replies.is_empty() && self.input_lease && self.resize_lease {
            self.send(ToCore::Input(replies));
        }
        for event in self.vt.take_events() {
            match event {
                Event::Title(title) => {
                    self.title = title.clone();
                    cx.emit(TerminalEvent::Title(title));
                }
                Event::ClipboardWrite(text) => cx.emit(TerminalEvent::ClipboardWrite(text)),
            }
        }
        cx.notify();
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
        if !self.can_type() {
            return false;
        }
        let m = keystroke.modifiers;
        if m.platform && keystroke.key == "v" && !m.control && !m.alt {
            if let Some(text) = cx.read_from_clipboard().and_then(|item| item.text()) {
                self.paste(&text, cx);
            }
            return true;
        }
        match key_bytes(&mut self.vt, keystroke, repeat) {
            Some(bytes) => {
                self.type_bytes(bytes, cx);
                true
            }
            None => false,
        }
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

    /// Bytes for the program that don't end a scroll back in history.
    fn send_unscrolled(&self, bytes: Vec<u8>) {
        if !bytes.is_empty() {
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
        match (action, button) {
            (MouseAction::Press, Some(b)) => {
                if !self.buttons_down.contains(&b) {
                    self.buttons_down.push(b);
                }
            }
            // A release goes only to the program that was told of the press.
            (MouseAction::Release, Some(b)) => {
                let Some(at) = self.buttons_down.iter().position(|d| *d == b) else {
                    return false;
                };
                self.buttons_down.remove(at);
            }
            _ => {}
        }
        if !self.can_type() || !self.vt.mouse_tracking() || modifiers.shift {
            return false;
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
        let available = size(
            (bounds.size.width - px(2. * layout::PAD_X)).max(px(0.)),
            (bounds.size.height - px(2. * layout::PAD_Y)).max(px(0.)),
        );
        // A view that doesn't hold the resize lease takes the core's size and draws it at the
        // size it was last laid out at.
        let sizes_itself = self.to_core.is_none() || self.resize_lease || self.pending.is_some();
        let fit = match self.fitted {
            Some(fit) if !sizes_itself => Fit {
                metrics: layout::metrics(window, fit.metrics.font_px),
                ..fit
            },
            _ => layout::fit(window, available, self.appearance.font_px),
        };
        self.fitted = Some(fit);
        let snap = |v: Pixels| px((f32::from(v) * self.scale).round() / self.scale);
        self.origin = point(
            snap(bounds.origin.x + px(layout::PAD_X)),
            snap(bounds.origin.y + px(layout::PAD_Y)),
        );
        if let Some(pending) = self.pending.take() {
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
        let frame = self.vt.frame();
        self.cursor_cell = frame.cursor_cell;
        Painted {
            frame,
            metrics: fit.metrics,
            origin: self.origin,
            scale: self.scale,
            focused,
        }
    }

    /// What the pane says about the session when it is not simply showing the shell.
    fn note(&self) -> Option<String> {
        match &self.status {
            Status::Detached => Some("Not connected".into()),
            Status::Connecting => Some("Connecting".into()),
            Status::Live if !self.input_lease => {
                Some("View only: another view controls this terminal".into())
            }
            Status::Live => None,
            Status::Disconnected(_) => Some("Disconnected".into()),
            Status::Failed(reason) => Some(format!("Could not open the terminal: {reason}")),
            Status::Exited(code) => Some(format!("Shell exited (code {code})")),
        }
    }
}

impl Focusable for TerminalView {
    fn focus_handle(&self, _: &App) -> FocusHandle {
        self.focus.clone()
    }
}

fn color(c: Rgb) -> Hsla {
    rgb(u32::from(c.0) << 16 | u32::from(c.1) << 8 | u32::from(c.2)).into()
}

/// Cells that draw as one shaped line: the same look, one character each.
fn same_run(a: &Cell, b: &Cell) -> bool {
    !b.wide
        && b.text.chars().count() <= 1
        && a.fg == b.fg
        && a.bold == b.bold
        && a.italic == b.italic
        && a.faint == b.faint
        && a.underline == b.underline
        && a.strike == b.strike
}

fn paint_frame(bounds: Bounds<Pixels>, painted: Painted, window: &mut Window, cx: &mut App) {
    let Painted {
        frame,
        metrics,
        origin,
        scale,
        focused,
    } = painted;
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

    window.paint_quad(fill(bounds, color(frame.bg)));

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
            window.paint_quad(fill(snap_box(run), color(bg)));
        }
    }

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
            if first.wide || first.text.chars().count() > 1 {
                push(first, &mut text);
                glyphs = 1;
                x += 1 + usize::from(first.wide);
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
            let mut fg = color(first.fg);
            if first.faint {
                fg.a = 0.6;
            }
            if glyphs > 0 {
                // Trailing blanks carry no ink.
                let kept = text.trim_end_matches(' ').len();
                text.truncate(kept);
                if !text.is_empty() {
                    let run = TextRun {
                        len: text.len(),
                        font: layout::cell_font(first.bold, first.italic),
                        color: fg,
                        background_color: None,
                        underline: None,
                        strikethrough: None,
                    };
                    let line = window.text_system().shape_line(
                        SharedString::from(text),
                        px(metrics.font_px),
                        &[run],
                        Some(cw),
                    );
                    let _ = line.paint(at(start, y), ch, TextAlign::Left, None, window, cx);
                }
            }
            for (on, offset) in [(first.underline, underline), (first.strike, strike)] {
                if on {
                    let rule = Bounds::new(
                        at(start, y) + point(px(0.), offset),
                        size(cw * (end - start) as f32, thickness),
                    );
                    window.paint_quad(fill(snap_box(rule), fg));
                }
            }
        }
    }

    // The cursor, over the glyph it covers.
    if let Some(cursor) = frame.cursor {
        let (x, y) = (cursor.x as usize, cursor.y as usize);
        let under = frame.rows.get(y).and_then(|r| r.get(x));
        let width = cw
            * if under.is_some_and(|c| c.wide) {
                2.0
            } else {
                1.0
            };
        let cell = Bounds::new(at(x, y), size(width, ch));
        let c = color(cursor.color);
        use super::vt::CursorShape::*;
        match (focused, cursor.shape) {
            (true, Block) => {
                window.paint_quad(fill(snap_box(cell), c));
                if let Some(glyph) = under.filter(|c| !c.text.is_empty()) {
                    let run = TextRun {
                        len: glyph.text.len(),
                        font: layout::cell_font(glyph.bold, glyph.italic),
                        color: color(frame.bg),
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
                    let _ = line.paint(at(x, y), ch, TextAlign::Left, None, window, cx);
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
}

impl gpui::Render for TerminalView {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let view = cx.entity();
        let paint_view = view.clone();
        let focused = self.focus.is_focused(window);
        let bg = color(self.vt.background());
        let note = self.note();
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
            .on_scroll_wheel(cx.listener(|this, event: &ScrollWheelEvent, _, cx| {
                this.scroll_wheel(event, cx);
                cx.stop_propagation();
            }))
            .on_mouse_down(
                GpuiButton::Left,
                cx.listener(|this, event: &MouseDownEvent, window, cx| {
                    this.focus.focus(window, cx);
                    this.mouse(
                        MouseAction::Press,
                        Some(event.button),
                        event.position,
                        event.modifiers,
                    );
                }),
            )
            .on_mouse_down(
                GpuiButton::Middle,
                cx.listener(|this, event: &MouseDownEvent, _, _| {
                    this.mouse(
                        MouseAction::Press,
                        Some(event.button),
                        event.position,
                        event.modifiers,
                    );
                }),
            )
            .on_mouse_down(
                GpuiButton::Right,
                cx.listener(|this, event: &MouseDownEvent, _, _| {
                    this.mouse(
                        MouseAction::Press,
                        Some(event.button),
                        event.position,
                        event.modifiers,
                    );
                }),
            )
            .on_mouse_move(cx.listener(|this, event: &MouseMoveEvent, _, _| {
                let held = event.pressed_button;
                if held.is_some() && !this.buttons_down.is_empty() || held.is_none() {
                    this.mouse(MouseAction::Motion, held, event.position, event.modifiers);
                }
            }));
        for button in [GpuiButton::Left, GpuiButton::Middle, GpuiButton::Right] {
            pane = pane
                .on_mouse_up(
                    button,
                    cx.listener(|this, event: &MouseUpEvent, _, _| {
                        this.mouse(
                            MouseAction::Release,
                            Some(event.button),
                            event.position,
                            event.modifiers,
                        );
                    }),
                )
                .on_mouse_up_out(
                    button,
                    cx.listener(|this, event: &MouseUpEvent, _, _| {
                        this.mouse(
                            MouseAction::Release,
                            Some(event.button),
                            event.position,
                            event.modifiers,
                        );
                    }),
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
        .when_some(note, |pane, note| {
            pane.child(
                div()
                    .absolute()
                    .bottom_2()
                    .right_3()
                    .text_xs()
                    .text_color(rgb(NOTE_COLOR))
                    .child(note),
            )
        })
    }
}

/// Text from the system's input (dead keys, AltGr, input methods) that no key press produced.
/// Composition is not drawn yet; what is committed goes to the program as typed.
impl EntityInputHandler for TerminalView {
    fn text_for_range(
        &mut self,
        _range: Range<usize>,
        adjusted: &mut Option<Range<usize>>,
        _: &mut Window,
        _: &mut Context<Self>,
    ) -> Option<String> {
        *adjusted = Some(0..0);
        Some(String::new())
    }

    fn selected_text_range(
        &mut self,
        _: bool,
        _: &mut Window,
        _: &mut Context<Self>,
    ) -> Option<UTF16Selection> {
        Some(UTF16Selection {
            range: 0..0,
            reversed: false,
        })
    }

    fn marked_text_range(&self, _: &mut Window, _: &mut Context<Self>) -> Option<Range<usize>> {
        None
    }

    fn unmark_text(&mut self, _: &mut Window, _: &mut Context<Self>) {}

    fn replace_text_in_range(
        &mut self,
        _range: Option<Range<usize>>,
        text: &str,
        _: &mut Window,
        cx: &mut Context<Self>,
    ) {
        if self.can_type() {
            self.type_bytes(text.as_bytes().to_vec(), cx);
        }
    }

    fn replace_and_mark_text_in_range(
        &mut self,
        _range: Option<Range<usize>>,
        _text: &str,
        _selected: Option<Range<usize>>,
        _: &mut Window,
        _: &mut Context<Self>,
    ) {
    }

    fn bounds_for_range(
        &mut self,
        _range: Range<usize>,
        element: Bounds<Pixels>,
        _: &mut Window,
        _: &mut Context<Self>,
    ) -> Option<Bounds<Pixels>> {
        // The candidate window goes at the cursor.
        let fit = self.fitted?;
        let (x, y) = self.cursor_cell?;
        let cell = size(fit.metrics.width, fit.metrics.height);
        (element.size.width > px(0.)).then(|| {
            Bounds::new(
                self.origin + point(cell.width * f32::from(x), cell.height * f32::from(y)),
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

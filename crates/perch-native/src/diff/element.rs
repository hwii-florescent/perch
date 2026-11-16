//! `DiffView`: the review's diff drawn natively, as `review.tsx` draws its rows (header per file, header per hunk,
//! one row per line with both numbers, the marker and the code, kind tints, the hover `＋`, the selection, comment
//! threads under their lines), on `gpui::list`: only rows on screen (and a margin) are laid out, each row's height
//! is measured once and cached, and a frame costs the same for 500 lines as for 20,000.
//!
//! The diff and its comments are the host store's ([`DiffView::set_data`]); the screen sends only view state
//! ([`DiffProps`]) and hears what the person did as [`DiffEvent`]s, so no line ever crosses into script. The file
//! header of the file at the top stays pinned there (CSS `sticky top-0`), pushed up by the next file's header; hunk
//! headers do not pin (the web's only stick to the left). Unwrapped, every line shares one width (the widest) and
//! one horizontal offset; wrapped, lines break at the view's width and the list measures them.
//!
//! Keyboard: Up/Down move a row cursor over selectable lines, Enter or Space select (Shift extends), Tab leaves.
//! (The web makes every row a tab stop; 20,000 natively would be worse.)

use super::rows::{self, file_path, file_path_for_side, Row, Rows};
use crate::git::store::DiffSnapshot;
use crate::mods::theme::Theme;
use gpui::{
    div, list, prelude::*, px, AnyElement, App, Bounds, Context, EventEmitter, FocusHandle,
    Focusable, Hsla, KeyDownEvent, ListAlignment, ListState, MouseButton, Pixels, Rgba,
    ScrollWheelEvent, SharedString, Window,
};
use gpui_base::input::{InputEvent, Textarea, TextareaState};
use perch_core::review::{ReviewComment, ReviewSide, ReviewStatus};
use perch_core::source_control::{DiffFileStatus, DiffLineKind};
use std::cell::Cell;
use std::rc::Rc;

/// The web's root font size: `rem` in `review.tsx` is 16 px.
const REM: f32 = 16.;
const CODE_SIZE: f32 = 0.75 * REM;
const LINE_HEIGHT: f32 = CODE_SIZE * 1.5;
const MONO: &str = "Menlo";
/// Under this width the gutters narrow (`@container(max-width:700px)`).
const NARROW: f32 = 700.;

/// What the screen decides: which file, wrap, the selected lines and the comment being edited.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct DiffProps {
    pub path: Option<String>,
    pub wrap: bool,
    pub selection: Option<Selection>,
    pub editing: Option<Editing>,
    /// Whether to offer Ask agent on file headers (the host offers it).
    pub can_ask: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Selection {
    pub path: String,
    pub side: ReviewSide,
    pub start: u32,
    pub end: u32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Editing {
    pub comment: String,
    pub body: String,
}

/// What the person did, for the screen to act on.
#[derive(Clone, Debug, PartialEq)]
pub enum DiffEvent {
    SelectLine {
        path: String,
        side: ReviewSide,
        line: u32,
        extend: bool,
    },
    AddComment {
        path: String,
        side: ReviewSide,
        line: u32,
    },
    AskAgent {
        path: String,
    },
    EditComment {
        comment: String,
    },
    EditBody {
        text: String,
    },
    SaveEdit {
        comment: String,
    },
    CancelEdit,
    Resolve {
        comment: String,
        resolved: bool,
    },
    Delete {
        comment: String,
    },
}

/// The theme's colours the diff draws with (`review.tsx`'s classes).
#[derive(Clone, Copy)]
struct Colors {
    panel: Hsla,
    text: Hsla,
    subtext: Hsla,
    overlay: Hsla,
    accent: Hsla,
    green: Hsla,
    red: Hsla,
    yellow: Hsla,
    surface0: Hsla,
    surface1: Hsla,
    file_header: Hsla,
    hunk_header: Hsla,
}

fn color(hex: &str) -> Rgba {
    let v = u32::from_str_radix(hex.trim_start_matches('#'), 16).unwrap_or(0);
    gpui::rgb(v)
}

/// `color-mix(in srgb, a pct%, b)`.
fn mix(a: &str, pct: f32, b: &str) -> Hsla {
    let (a, b, t) = (color(a), color(b), pct / 100.);
    Rgba {
        r: a.r * t + b.r * (1. - t),
        g: a.g * t + b.g * (1. - t),
        b: a.b * t + b.b * (1. - t),
        a: 1.,
    }
    .into()
}

/// `color-mix(in srgb, c pct%, transparent)`.
fn alpha(hex: &str, pct: f32) -> Hsla {
    let mut c: Hsla = color(hex).into();
    c.a = pct / 100.;
    c
}

impl Colors {
    fn of(theme: &Theme) -> Self {
        let t = |k: &str| theme.token(k).unwrap_or("#000000").to_string();
        let c = |k: &str| Hsla::from(color(&t(k)));
        Self {
            panel: c("panel-bg"),
            text: c("text"),
            subtext: c("subtext-0"),
            overlay: c("overlay-0"),
            accent: c("accent"),
            green: c("green"),
            red: c("red"),
            yellow: c("yellow"),
            surface0: c("surface-0"),
            surface1: c("surface-1"),
            file_header: mix(&t("surface-1"), 70., &t("panel-bg")),
            hunk_header: mix(&t("accent"), 8., &t("panel-bg")),
        }
    }
}

/// Row tints, kept apart from [`Colors`] because they are translucent over the panel.
#[derive(Clone, Copy)]
struct Tints {
    addition: Hsla,
    deletion: Hsla,
    hover_change: Hsla,
    hover_context: Hsla,
    selected: Hsla,
}

impl Tints {
    fn of(theme: &Theme) -> Self {
        let t = |k: &str| theme.token(k).unwrap_or("#000000").to_string();
        Self {
            addition: alpha(&t("green"), 9.),
            deletion: alpha(&t("red"), 9.),
            hover_change: alpha(&t("accent"), 15.),
            hover_context: alpha(&t("accent"), 12.),
            selected: alpha(&t("accent"), 12.),
        }
    }
}

pub struct DiffView {
    focus: FocusHandle,
    list: ListState,
    diff: Option<Rc<DiffSnapshot>>,
    comments: Rc<Vec<ReviewComment>>,
    rows: Rc<Rows>,
    /// For each row, the index of its file's header row (for the pinned header).
    file_row: Rc<Vec<usize>>,
    /// Each row's place among the rows of its kind, for the parity probe's names (`git-diff-line@3`).
    ordinal: Rc<Vec<usize>>,
    props: DiffProps,
    colors: Colors,
    tints: Tints,
    /// Horizontal offset of unwrapped lines.
    offset_x: f32,
    /// The view's width at the last paint.
    width: Rc<Cell<f32>>,
    /// The keyboard's row (an index into rows), drawn with a ring while the view has focus.
    cursor: Option<usize>,
    /// The edit field of the comment being edited, made when editing starts.
    edit: Option<(String, gpui::Entity<TextareaState>)>,
    /// The file whose header was pinned at the last draw.
    pinned: Option<usize>,
    /// Counts row builds (tests read it: a scroll must build none).
    pub builds: u64,
}

impl EventEmitter<DiffEvent> for DiffView {}

impl Focusable for DiffView {
    fn focus_handle(&self, _: &App) -> FocusHandle {
        self.focus.clone()
    }
}

impl DiffView {
    pub fn new(theme: &Theme, cx: &mut Context<Self>) -> Self {
        Self {
            focus: cx.focus_handle(),
            list: ListState::new(0, ListAlignment::Top, px(400.)),
            diff: None,
            comments: Rc::default(),
            rows: Rc::default(),
            file_row: Rc::default(),
            ordinal: Rc::default(),
            props: DiffProps::default(),
            colors: Colors::of(theme),
            tints: Tints::of(theme),
            offset_x: 0.,
            width: Rc::new(Cell::new(0.)),
            cursor: None,
            edit: None,
            pinned: None,
            builds: 0,
        }
    }

    pub fn rows(&self) -> &Rows {
        &self.rows
    }

    /// The file whose header is pinned at the top (as of the last draw).
    pub fn pinned_file(&self) -> Option<usize> {
        self.pinned
    }

    /// The view state the screen last sent.
    pub fn props(&self) -> &DiffProps {
        &self.props
    }

    pub fn list_state(&self) -> &ListState {
        &self.list
    }

    pub fn set_theme(&mut self, theme: &Theme, cx: &mut Context<Self>) {
        self.colors = Colors::of(theme);
        self.tints = Tints::of(theme);
        cx.notify();
    }

    /// The store's diff and comments; rows are rebuilt only when either is a different value.
    pub fn set_data(
        &mut self,
        diff: Option<Rc<DiffSnapshot>>,
        comments: Rc<Vec<ReviewComment>>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let same_diff = match (&self.diff, &diff) {
            (Some(a), Some(b)) => Rc::ptr_eq(a, b),
            (None, None) => true,
            _ => false,
        };
        if same_diff && Rc::ptr_eq(&self.comments, &comments) {
            return;
        }
        let new_file = !same_diff;
        self.diff = diff;
        self.comments = comments;
        self.rebuild(new_file, window, cx);
    }

    pub fn set_props(&mut self, props: DiffProps, window: &mut Window, cx: &mut Context<Self>) {
        if props == self.props {
            return;
        }
        let old = std::mem::replace(&mut self.props, props);
        let editing_changed = old.editing.as_ref().map(|e| &e.comment)
            != self.props.editing.as_ref().map(|e| &e.comment);
        if old.path != self.props.path || editing_changed {
            self.rebuild(old.path != self.props.path, window, cx);
        } else if old.wrap != self.props.wrap {
            self.offset_x = 0.;
            self.list.remeasure();
        }
        // The edit field follows the screen's body (another copy of the screen may have typed it).
        if let (Some(editing), Some((id, field))) = (&self.props.editing, &self.edit) {
            if *id == editing.comment && field.read(cx).value().as_ref() != editing.body {
                let body = editing.body.clone();
                field.update(cx, |f, cx| f.set_value(body, window, cx));
            }
        }
        cx.notify();
    }

    fn rebuild(&mut self, to_top: bool, window: &mut Window, cx: &mut Context<Self>) {
        self.builds += 1;
        let rows = match &self.diff {
            Some(diff) => rows::build(diff, &self.comments, self.props.path.as_deref()),
            None => Rows::default(),
        };
        let mut file_row = Vec::with_capacity(rows.rows.len());
        let mut ordinal = Vec::with_capacity(rows.rows.len());
        let mut counts = [0usize; 5];
        let mut current = 0;
        for (i, row) in rows.rows.iter().enumerate() {
            if matches!(row, Row::File { .. }) {
                current = i;
            }
            file_row.push(current);
            let kind = probe_kind(row);
            ordinal.push(counts[kind]);
            counts[kind] += 1;
        }
        let top = self.list.logical_scroll_top();
        self.list.reset(rows.rows.len());
        if !to_top && top.item_ix < rows.rows.len() {
            self.list.scroll_to(top);
        }
        self.rows = Rc::new(rows);
        self.file_row = Rc::new(file_row);
        self.ordinal = Rc::new(ordinal);
        if self.cursor.is_some_and(|c| c >= self.rows.rows.len()) {
            self.cursor = None;
        }
        self.edit = match &self.props.editing {
            Some(editing) => Some(match self.edit.take() {
                Some((id, field)) if id == editing.comment => (id, field),
                _ => {
                    let body = editing.body.clone();
                    let field = cx.new(|cx| {
                        let mut state = TextareaState::new(window, cx).auto_grow(3, 12);
                        state.set_value(body, window, cx);
                        state
                    });
                    cx.subscribe(&field, |_, field, event: &InputEvent, cx| {
                        if matches!(event, InputEvent::Change) {
                            let text = field.read(cx).value().to_string();
                            cx.emit(DiffEvent::EditBody { text });
                        }
                    })
                    .detach();
                    (editing.comment.clone(), field)
                }
            }),
            None => None,
        };
        cx.notify();
    }

    fn line_at(&self, row: usize) -> Option<(String, ReviewSide, u32)> {
        let diff = self.diff.as_deref()?;
        match self.rows.rows.get(row)? {
            Row::Line {
                file,
                side,
                number: Some(number),
                ..
            } => Some((
                file_path_for_side(&diff.files[*file], *side).to_string(),
                *side,
                *number,
            )),
            _ => None,
        }
    }

    fn select_row(&mut self, row: usize, extend: bool, cx: &mut Context<Self>) {
        if let Some((path, side, line)) = self.line_at(row) {
            self.cursor = Some(row);
            cx.emit(DiffEvent::SelectLine {
                path,
                side,
                line,
                extend,
            });
        }
    }

    fn move_cursor(&mut self, down: bool, cx: &mut Context<Self>) {
        let count = self.rows.rows.len();
        let start = self.cursor.unwrap_or(if down { usize::MAX } else { count });
        let mut at = start;
        loop {
            at = if down {
                at.wrapping_add(1)
            } else {
                at.wrapping_sub(1)
            };
            if at >= count {
                return;
            }
            if self.line_at(at).is_some() {
                break;
            }
        }
        self.cursor = Some(at);
        self.list.scroll_to_reveal_item(at);
        cx.notify();
    }

    fn on_key(&mut self, event: &KeyDownEvent, window: &mut Window, cx: &mut Context<Self>) {
        if self
            .edit
            .as_ref()
            .is_some_and(|(_, field)| field.read(cx).focus_handle(cx).contains_focused(window, cx))
        {
            return;
        }
        let shift = event.keystroke.modifiers.shift;
        match event.keystroke.key.as_str() {
            "down" => self.move_cursor(true, cx),
            "up" => self.move_cursor(false, cx),
            "enter" | "space" => match self.cursor {
                Some(row) => self.select_row(row, shift, cx),
                None => return,
            },
            _ => return,
        }
        cx.stop_propagation();
    }

    fn on_wheel(&mut self, event: &ScrollWheelEvent, window: &mut Window, cx: &mut Context<Self>) {
        if self.props.wrap {
            return;
        }
        let delta = event.delta.pixel_delta(px(LINE_HEIGHT));
        let dx = if event.modifiers.shift && delta.x == px(0.) {
            delta.y
        } else {
            delta.x
        };
        if dx == px(0.) {
            return;
        }
        let max = (self.content_width() - self.width.get()).max(0.);
        let next = (self.offset_x - f32::from(dx)).clamp(0., max);
        if next != self.offset_x {
            self.offset_x = next;
            cx.notify();
        }
        if event.modifiers.shift {
            cx.stop_propagation();
        }
        let _ = window;
    }

    fn gutters(&self) -> (f32, f32) {
        if self.width.get() > 0. && self.width.get() <= NARROW {
            (2.1 * REM, 0.8 * REM)
        } else {
            (2.5 * REM, 0.9 * REM)
        }
    }

    /// The shared width of unwrapped lines: both numbers, the marker and the widest code.
    fn content_width(&self) -> f32 {
        let (number, marker) = self.gutters();
        // ponytail: Menlo's advance is 0.602 em; a measured advance would replace this if the mono face changes.
        2. * number + marker + self.rows.widest as f32 * CODE_SIZE * 0.602
    }
}

fn status_label(status: &DiffFileStatus) -> &'static str {
    match status {
        DiffFileStatus::Added => "added",
        DiffFileStatus::Modified => "modified",
        DiffFileStatus::Deleted => "deleted",
        DiffFileStatus::Renamed => "renamed",
        DiffFileStatus::Copied => "copied",
        DiffFileStatus::TypeChanged => "typeChanged",
        DiffFileStatus::Binary => "binary",
    }
}

fn capitalized(word: &str) -> String {
    let mut chars = word.chars();
    chars
        .next()
        .map(|c| c.to_uppercase().chain(chars).collect())
        .unwrap_or_default()
}

/// What one frame's rows need, cloned once per frame into the list's builder.
#[derive(Clone)]
struct Frame {
    ordinal: Rc<Vec<usize>>,
    view: gpui::WeakEntity<DiffView>,
    diff: Option<Rc<DiffSnapshot>>,
    comments: Rc<Vec<ReviewComment>>,
    rows: Rc<Rows>,
    props: Rc<DiffProps>,
    colors: Colors,
    tints: Tints,
    offset_x: f32,
    content_width: f32,
    gutters: (f32, f32),
    /// The view's width at the last paint (the web's `100cqi`).
    view_width: f32,
    cursor: Option<usize>,
    focused: bool,
    edit: Option<(String, gpui::Entity<TextareaState>)>,
}

/// The web lines up a line's cells on their baselines; an empty number cell (an added line has no
/// old number, a removed one no new number) has no text, so its bottom edge stands in for its
/// baseline, and the line grows by that much above its text: the line height less the text's
/// baseline in it. In the web's mono face (`ui-monospace`, SF Mono) at 12 px on an 18 px line that
/// is 4.47 px. ponytail: a constant taken from the web, because this view draws Menlo (the runtime's
/// mono, `describe.mjs`), whose own metrics give 4.85 px and drift half a pixel per changed line;
/// it is right only for that face and size. Upgrade: draw the diff in SF Mono and measure it.
const EMPTY_CELL_DROP: f32 = 4.47;

/// The row kinds the parity probe names, as an index: file header, hunk header, line, thread, other.
fn probe_kind(row: &Row) -> usize {
    match row {
        Row::File { .. } => 0,
        Row::Hunk { .. } => 1,
        Row::Line { .. } => 2,
        Row::Thread { .. } => 3,
        Row::Binary { .. } => 4,
    }
}

/// `element` named `name` for the parity probe (`gpui_shell::probe`), with the colours the row draws, as a
/// script's `.id(...)` is; as it is when the probe is off.
fn probed(name: String, background: Option<Hsla>, text: Hsla, element: AnyElement) -> AnyElement {
    if !gpui_shell::probing() {
        return element;
    }
    let mut style = gpui::StyleRefinement::default();
    style.text.color = Some(text);
    style.background = background.map(Into::into);
    gpui_shell::probed(name.into(), style, element)
}

impl Frame {
    /// Row `ix` as the list draws it. A line carries the comment thread under it (the web draws the thread inside
    /// the line's grid, so the line's box holds both); the thread's own row is then empty. Each is named for the
    /// parity probe by its place among its kind (`git-diff-line@2`).
    fn named_row(&self, ix: usize) -> AnyElement {
        let rows = &self.rows.rows;
        let name = |base: &str, ix: usize| match self.ordinal.get(ix) {
            Some(0) | None => base.to_string(),
            Some(n) => format!("{base}@{n}"),
        };
        let c = self.colors;
        match &rows[ix] {
            Row::Thread { .. } => div().into_any_element(),
            Row::File { .. } => probed(
                name("git-file-header", ix),
                Some(c.file_header),
                c.text,
                self.row(ix),
            ),
            Row::Hunk { .. } => probed(
                name("git-hunk-header", ix),
                Some(c.hunk_header),
                c.accent,
                self.row(ix),
            ),
            Row::Line { .. } => {
                let line = self.row(ix);
                let tint = self.line_tint(ix);
                let Some(Row::Thread { comments, .. }) = rows.get(ix + 1) else {
                    return probed(name("git-diff-line", ix), tint, c.text, line);
                };
                let thread = probed(
                    name("git-line-comments", ix + 1),
                    None,
                    c.text,
                    self.thread(ix + 1, comments),
                );
                // The line's tint runs behind its thread too, as the web's grid does.
                let both = div()
                    .flex()
                    .flex_col()
                    .w_full()
                    .when_some(tint, |d, tint| d.bg(tint))
                    .child(line)
                    .child(thread)
                    .into_any_element();
                probed(name("git-diff-line", ix), tint, c.text, both)
            }
            Row::Binary { .. } => self.row(ix),
        }
    }

    fn file_header(&self, file: usize) -> AnyElement {
        let Some(diff) = self.diff.as_deref() else {
            return div().into_any_element();
        };
        let f = &diff.files[file];
        let path = file_path(f).to_string();
        let cut = path.rfind('/').map_or(0, |i| i + 1);
        let (dir, name) = (path[..cut].to_string(), path[cut..].to_string());
        let c = self.colors;
        let status = format!(
            "{}{}",
            capitalized(status_label(&f.status)),
            if f.is_binary { " · binary" } else { "" }
        );
        let view = self.view.clone();
        let ask = self.props.can_ask.then(|| {
            let disabled = f.is_binary;
            div()
                .id(("git-ask", file))
                .flex_shrink_0()
                .rounded(px(8.))
                .px(px(8.))
                .py(px(0.3 * REM))
                .text_color(c.text)
                .when(disabled, |d| d.opacity(0.45))
                .when(!disabled, |d| {
                    d.hover(|s| s.bg(c.surface1).text_color(c.accent))
                        .on_click(move |_, _, cx| {
                            let path = path.clone();
                            view.update(cx, |_, cx| cx.emit(DiffEvent::AskAgent { path }))
                                .ok();
                        })
                })
                .child("Ask agent")
        });
        div()
            .id(("git-file-header", file))
            .w_full()
            .flex()
            .items_center()
            .justify_between()
            .gap(px(0.75 * REM))
            .bg(c.file_header)
            .px(px(0.7 * REM))
            .py(px(0.3 * REM))
            .child(
                div()
                    .flex()
                    .flex_1()
                    .min_w_0()
                    .overflow_hidden()
                    .whitespace_nowrap()
                    .font_family(MONO)
                    .text_size(px(CODE_SIZE))
                    .child(
                        div()
                            .min_w_0()
                            .text_ellipsis()
                            .text_color(c.subtext)
                            .child(dir),
                    )
                    .child(
                        div()
                            .min_w_0()
                            .flex_shrink(0.001)
                            .text_ellipsis()
                            .child(name),
                    ),
            )
            .child(
                div()
                    .flex_shrink_0()
                    .text_size(px(0.68 * REM))
                    .text_color(c.subtext)
                    .child(status),
            )
            .children(ask)
            .into_any_element()
    }

    fn row(&self, ix: usize) -> AnyElement {
        let Some(diff) = self.diff.as_deref() else {
            return div().into_any_element();
        };
        let c = self.colors;
        match &self.rows.rows[ix] {
            Row::File { file } => self.file_header(*file),
            Row::Hunk { file, hunk } => {
                let h = &diff.files[*file].hunks[*hunk];
                let header = if h.header.is_empty() {
                    format!(
                        "@@ -{},{} +{},{} @@",
                        h.old_start, h.old_count, h.new_start, h.new_count
                    )
                } else {
                    h.header.clone()
                };
                div()
                    .id(("git-hunk-header", ix))
                    .w_full()
                    .bg(c.hunk_header)
                    .px(px(0.7 * REM))
                    .py(px(2.))
                    .text_color(c.accent)
                    .font_family(MONO)
                    .text_size(px(0.68 * REM))
                    .whitespace_nowrap()
                    .overflow_hidden()
                    .child(header)
                    .into_any_element()
            }
            Row::Binary { .. } => div()
                .min_h(px(10. * REM))
                .flex()
                .flex_col()
                .items_center()
                .justify_center()
                .p(px(1.5 * REM))
                .text_color(c.subtext)
                .child(
                    "Binary content is not rendered. Status and path remain available for review.",
                )
                .into_any_element(),
            Row::Line {
                file,
                hunk,
                line,
                side,
                number,
            } => self.line_row(
                ix,
                &diff.files[*file],
                &diff.files[*file].hunks[*hunk].lines[*line],
                *side,
                *number,
            ),
            Row::Thread { comments, .. } => self.thread(ix, comments),
        }
    }

    /// The background of line row `ix`: its kind's tint, or the selection's on a context line.
    fn line_tint(&self, ix: usize) -> Option<Hsla> {
        let diff = self.diff.as_deref()?;
        let Row::Line {
            file,
            hunk,
            line,
            side,
            number,
        } = &self.rows.rows[ix]
        else {
            return None;
        };
        let f = &diff.files[*file];
        let path = file_path_for_side(f, *side);
        let selected = number.is_some_and(|n| {
            self.props
                .selection
                .as_ref()
                .is_some_and(|s| s.path == path && s.side == *side && s.start <= n && n <= s.end)
        });
        match f.hunks[*hunk].lines[*line].kind {
            DiffLineKind::Addition => Some(self.tints.addition),
            DiffLineKind::Deletion => Some(self.tints.deletion),
            DiffLineKind::Context => selected.then_some(self.tints.selected),
        }
    }

    fn line_row(
        &self,
        ix: usize,
        file: &perch_core::source_control::DiffFile,
        line: &perch_core::source_control::DiffLine,
        side: ReviewSide,
        number: Option<u32>,
    ) -> AnyElement {
        let (c, t) = (self.colors, self.tints);
        let path = file_path_for_side(file, side).to_string();
        let selected = number.is_some_and(|n| {
            self.props
                .selection
                .as_ref()
                .is_some_and(|s| s.path == path && s.side == side && s.start <= n && n <= s.end)
        });
        let (bg, hover) = match line.kind {
            DiffLineKind::Addition => (Some(t.addition), t.hover_change),
            DiffLineKind::Deletion => (Some(t.deletion), t.hover_change),
            DiffLineKind::Context => (selected.then_some(t.selected), t.hover_context),
        };
        let (marker, tone) = match line.kind {
            DiffLineKind::Addition => ("+", c.green),
            DiffLineKind::Deletion => ("−", c.red),
            DiffLineKind::Context => (" ", c.subtext),
        };
        let (number_w, marker_w) = self.gutters;
        let gutter = |n: Option<u32>| {
            div()
                .w(px(number_w))
                .flex_shrink_0()
                .min_h(px(LINE_HEIGHT))
                .pr(px(0.35 * REM))
                .flex()
                .justify_end()
                .text_color(c.overlay)
                .child(
                    n.map(|n| SharedString::from(n.to_string()))
                        .unwrap_or_default(),
                )
        };
        let text: SharedString = if line.content.is_empty() {
            " ".into()
        } else {
            line.content.clone().into()
        };
        let wrap = self.props.wrap;
        let code = div().flex_1().min_w_0().child(text);
        let code = if wrap { code } else { code.whitespace_nowrap() };
        let ring = self.focused && self.cursor == Some(ix);
        let view = self.view.clone();
        let plus = number.map(|n| {
            let (view, path) = (self.view.clone(), path.clone());
            div()
                .id(("git-comment-add", ix))
                .absolute()
                .top(px(0.1 * REM))
                .left(px(0.1 * REM + if wrap { 0. } else { self.offset_x }))
                .size(px(1.2 * REM))
                .rounded_full()
                .bg(c.panel)
                .flex()
                .items_center()
                .justify_center()
                .text_size(px(0.8 * REM))
                .text_color(c.accent)
                .opacity(0.)
                .group_hover("git-line", |s| s.opacity(0.9))
                .hover(|s| s.opacity(1.))
                .child("＋")
                .on_mouse_down(MouseButton::Left, move |_, _, cx| {
                    cx.stop_propagation();
                    let path = path.clone();
                    view.update(cx, |view, cx| {
                        view.cursor = Some(ix);
                        cx.emit(DiffEvent::AddComment {
                            path,
                            side,
                            line: n,
                        });
                    })
                    .ok();
                })
        });
        let inner = div()
            .flex()
            .items_start()
            .font_family(MONO)
            .text_size(px(CODE_SIZE))
            .line_height(px(LINE_HEIGHT))
            .text_color(c.text)
            .when(!wrap, |d| {
                d.w(px(self.content_width)).ml(px(-self.offset_x))
            })
            .when(wrap, |d| d.w_full())
            .child(gutter(line.old_line))
            .child(gutter(line.new_line))
            .child(
                div()
                    .w(px(marker_w))
                    .flex_shrink_0()
                    .flex()
                    .justify_center()
                    .text_color(tone)
                    .child(marker),
            )
            .child(code);
        let drop = if line.old_line.is_none() || line.new_line.is_none() {
            EMPTY_CELL_DROP
        } else {
            0.
        };
        div()
            .id(("git-diff-line", ix))
            .group("git-line")
            .relative()
            .w_full()
            .pt(px(drop))
            .overflow_hidden()
            .when_some(bg, |d, bg| d.bg(bg))
            .hover(move |s| s.bg(hover))
            .child(inner)
            .children(plus)
            // The keyboard's ring is drawn over the row, so it never changes the row's height.
            .when(ring, |d| {
                d.child(div().absolute().inset_0().border_1().border_color(c.accent))
            })
            .on_mouse_down(MouseButton::Left, move |event, window, cx| {
                let extend = event.modifiers.shift;
                view.update(cx, |view, cx| {
                    window.focus(&view.focus, cx);
                    view.select_row(ix, extend, cx);
                })
                .ok();
            })
            .into_any_element()
    }

    fn thread(&self, ix: usize, comments: &[usize]) -> AnyElement {
        // The web's `ml-[6.1rem]` (5.2rem narrow), at most 42rem wide and never past the view's edge, in the
        // line's mono text at its 1.5 line height.
        let narrow = self.view_width > 0. && self.view_width <= NARROW;
        let (left, room) = if narrow {
            (5.2 * REM, 5.6 * REM)
        } else {
            (6.1 * REM, 6.9 * REM)
        };
        let widest = if narrow {
            self.view_width - room
        } else {
            (42. * REM).min(self.view_width - room)
        };
        div()
            .id(("git-line-comments", ix))
            .mt(px(0.2 * REM))
            .mr(px(0.7 * REM))
            .mb(px(0.35 * REM))
            .ml(px(left))
            .when(self.view_width > 0., |d| d.max_w(px(widest.max(0.))))
            .font_family(MONO)
            .text_size(px(CODE_SIZE))
            .line_height(gpui::relative(1.5))
            .children(comments.iter().map(|&i| self.card(&self.comments[i])))
            .into_any_element()
    }

    fn card(&self, comment: &ReviewComment) -> AnyElement {
        let c = self.colors;
        let range = if comment.range.start == comment.range.end {
            format!("Lines {}", comment.range.start)
        } else {
            format!("Lines {}–{}", comment.range.start, comment.range.end)
        };
        let status = match comment.status {
            ReviewStatus::Unresolved => "unresolved",
            ReviewStatus::Resolved => "resolved",
            ReviewStatus::Stale => "stale",
            ReviewStatus::Orphaned => "orphaned",
        };
        let pill_tone = match comment.status {
            ReviewStatus::Resolved => c.green,
            ReviewStatus::Unresolved => c.accent,
            _ => c.yellow,
        };
        let confidence = match comment.anchor_confidence {
            perch_core::review::AnchorConfidence::Exact => String::new(),
            other => format!(
                " · {} anchor",
                serde_json::to_value(other)
                    .ok()
                    .and_then(|v| v.as_str().map(str::to_string))
                    .unwrap_or_default()
            ),
        };
        let id = comment.id.clone();
        let link = |label: &'static str, key: &str, danger: bool, event: DiffEvent| {
            let view = self.view.clone();
            div()
                .id(SharedString::from(format!("{key}:{id}")))
                .px(px(0.3 * REM))
                .py(px(0.2 * REM))
                .text_size(px(0.66 * REM))
                .text_color(c.accent)
                .when(danger, |d| d.hover(|s| s.text_color(c.red)))
                .child(label)
                .on_click(move |_, _, cx| {
                    let event = event.clone();
                    view.update(cx, |_, cx| cx.emit(event)).ok();
                })
        };
        let actions = || div().flex().items_center().justify_end().gap(px(0.3 * REM));
        let editing = self
            .edit
            .as_ref()
            .filter(|(edit_id, _)| *edit_id == comment.id);
        let body = match editing {
            Some((_, field)) => div()
                .child(
                    div()
                        .id(SharedString::from(format!("git-comment-edit:{id}")))
                        .min_h(px(3.2 * REM))
                        .rounded(px(8.))
                        .bg(c.surface1)
                        .p(px(0.4 * REM))
                        .child(Textarea::new(field)),
                )
                .child(
                    actions()
                        .child(link(
                            "Save edit",
                            "git-comment-save",
                            false,
                            DiffEvent::SaveEdit {
                                comment: id.clone(),
                            },
                        ))
                        .child(link(
                            "Cancel",
                            "git-comment-cancel",
                            false,
                            DiffEvent::CancelEdit,
                        )),
                ),
            None => div()
                .child(div().my(px(0.28 * REM)).child(comment.body.clone()))
                .child(
                    actions()
                        .child(link(
                            "Edit",
                            "git-comment-edit",
                            false,
                            DiffEvent::EditComment {
                                comment: id.clone(),
                            },
                        ))
                        .child(link(
                            if comment.status == ReviewStatus::Resolved {
                                "Reopen"
                            } else {
                                "Resolve"
                            },
                            "git-comment-resolve",
                            false,
                            DiffEvent::Resolve {
                                comment: id.clone(),
                                resolved: comment.status != ReviewStatus::Resolved,
                            },
                        ))
                        .child(link(
                            "Delete",
                            "git-comment-delete",
                            true,
                            DiffEvent::Delete {
                                comment: id.clone(),
                            },
                        )),
                ),
        };
        div()
            .id(SharedString::from(format!(
                "git-inline-comment:{}",
                comment.id
            )))
            .mt(px(0.3 * REM))
            .rounded(px(8.))
            .bg(c.surface0)
            .px(px(0.55 * REM))
            .py(px(0.45 * REM))
            .text_color(c.text)
            .when(comment.status == ReviewStatus::Resolved, |d| {
                d.opacity(0.72)
            })
            .child(
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .gap(px(0.5 * REM))
                    .text_size(px(0.66 * REM))
                    .text_color(c.subtext)
                    .child(range)
                    .child(
                        div()
                            .rounded_full()
                            .bg(c.surface1)
                            .px(px(0.3 * REM))
                            .py(px(0.1 * REM))
                            .text_color(pill_tone)
                            .child(format!("{}{confidence}", capitalized(status))),
                    ),
            )
            .child(body)
            .into_any_element()
    }
}

impl Render for DiffView {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let frame = Frame {
            ordinal: self.ordinal.clone(),
            view: cx.entity().downgrade(),
            diff: self.diff.clone(),
            comments: self.comments.clone(),
            rows: self.rows.clone(),
            props: Rc::new(self.props.clone()),
            colors: self.colors,
            tints: self.tints,
            offset_x: self.offset_x,
            content_width: self.content_width(),
            gutters: self.gutters(),
            view_width: self.width.get(),
            cursor: self.cursor,
            focused: self.focus.is_focused(window),
            edit: self.edit.clone(),
        };
        // The pinned header: the file of the row at the top, pushed up by the next file's header when it arrives.
        let top = self.list.logical_scroll_top();
        let pinned = self
            .file_row
            .get(top.item_ix)
            .copied()
            .filter(|_| !self.rows.rows.is_empty())
            .map(|header| {
                let Row::File { file } = self.rows.rows[header] else {
                    unreachable!("file_row names file rows")
                };
                let viewport = self.list.viewport_bounds();
                let next = self.rows.rows[top.item_ix + 1..]
                    .iter()
                    .position(|r| matches!(r, Row::File { .. }))
                    .map(|p| top.item_ix + 1 + p);
                let header_h = self
                    .list
                    .bounds_for_item(header)
                    .map(|b| b.size.height)
                    .unwrap_or(px(1.7 * REM));
                let push = next
                    .and_then(|n| self.list.bounds_for_item(n))
                    .map(|b| (b.origin.y - viewport.origin.y - header_h).min(px(0.)))
                    .unwrap_or(px(0.));
                (file, frame.file_header(file), push)
            });
        self.pinned = pinned.as_ref().map(|(file, _, _)| *file);
        let rows = frame.clone();
        let width = self.width.clone();
        div()
            .id("git-diff")
            .key_context("DiffView")
            .track_focus(&self.focus)
            .relative()
            .size_full()
            .overflow_hidden()
            .on_key_down(cx.listener(Self::on_key))
            .on_scroll_wheel(cx.listener(Self::on_wheel))
            .child(
                gpui::canvas(
                    move |bounds: Bounds<Pixels>, _, _| width.set(f32::from(bounds.size.width)),
                    |_, _, _, _| {},
                )
                .absolute()
                .size_full(),
            )
            .child(list(self.list.clone(), move |ix, _, _| rows.named_row(ix)).size_full())
            .children(pinned.map(|(_, header, push)| {
                div().absolute().top(push).left_0().right_0().child(header)
            }))
    }
}

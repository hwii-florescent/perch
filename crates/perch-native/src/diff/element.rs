//! `DiffView`: the review's diff drawn natively, as `review.tsx` draws its rows (header per file, header per
//! hunk, one row per line, kind tints, the hover `＋`, the selection, comment threads under their lines and the new
//! comment's field under the selection's last line), on
//! `gpui::list`: only rows on screen (and a margin) are laid out, each row's height
//! is measured once and cached, and a frame costs the same for 500 lines as for 20,000.
//!
//! The diff and its comments are the host store's ([`DiffView::set_data`]); the screen sends only view state
//! ([`DiffProps`]) and hears what the person did as [`DiffEvent`]s, so no line ever crosses into script. The file
//! header of the file at the top stays pinned there (CSS `sticky top-0`), pushed up by the next file's header; hunk
//! headers do not pin (the web's only stick to the left). Unwrapped, the lines of one file share one width (that
//! file's widest) and one horizontal offset, and each file scrolls sideways on its own, with a scrollbar of its own at
//! the bottom of its part of the view; wrapped, lines break at the view's width and the list measures them. A wheel or
//! trackpad gesture moves one axis only, the one its first step mostly moved.
//!
//! A line is drawn compactly: one number (the old line's for a deletion, else the new line's) and a colour bar on
//! the edge in place of a second number and a `+`/`−` column. A view at least [`SPLIT_WIDTH`] wide draws each change
//! as the old side beside the new side (`Row::Pair`); narrower, one line per row (`Layout` overrides either way).
//!
//! Keyboard: Up/Down move a row cursor over selectable lines, Enter or Space select (Shift extends), Tab leaves.
//! (The web makes every row a tab stop; 20,000 natively would be worse.)

use super::rows::{self, file_path, file_path_for_side, Row, Rows};
use crate::git::store::DiffSnapshot;
use crate::mods::theme::Theme;
use gpui::{
    div, fill, list, point, prelude::*, px, size, AnyElement, App, Axis, Bounds, Context,
    DispatchPhase, EventEmitter, FocusHandle, Focusable, Hitbox, HitboxBehavior, Hsla,
    KeyDownEvent, ListAlignment, ListOffset, ListState, MouseButton, MouseDownEvent,
    MouseMoveEvent, MouseUpEvent, Pixels, Rgba, ScrollWheelEvent, SharedString, TouchPhase, Window,
};
use gpui_base::input::{InputEvent, Textarea, TextareaState};
use perch_core::review::{ReviewComment, ReviewSide, ReviewStatus};
use perch_core::source_control::{DiffFile, DiffFileStatus, DiffLine, DiffLineKind};
use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::rc::Rc;
use std::time::{Duration, Instant};

/// The web's root font size: `rem` in `review.tsx` is 16 px.
const REM: f32 = 16.;
const CODE_SIZE: f32 = 0.75 * REM;
const LINE_HEIGHT: f32 = CODE_SIZE * 1.5;
/// The web's `ui-monospace`: CoreText's monospaced system face (SF Mono), as the file editor draws.
const MONO: &str = ".AppleSystemUIFontMonospaced";
/// A view this wide or wider shows the old and new side of a change side by side.
const SPLIT_WIDTH: f32 = 1000.;
/// The change bar on a line's edge.
const BAR: f32 = 3.;
/// A file's sideways scrollbar: its height, and the room left at the right for the vertical one.
const HBAR: f32 = 8.;
const HBAR_RIGHT: f32 = 14.;
/// A wheel step this long after the last one starts a new gesture, which latches its own axis (a mouse wheel and a
/// trackpad's momentum report no start).
const LATCH_GAP: Duration = Duration::from_millis(200);

/// How a change is laid out: by the view's width, or always one line per row, or always side by side.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub enum Layout {
    #[default]
    Auto,
    Unified,
    Split,
}

/// What the screen decides: which file, wrap, layout, the selected lines and the comment being edited.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct DiffProps {
    pub path: Option<String>,
    pub wrap: bool,
    pub layout: Layout,
    pub selection: Option<Selection>,
    pub editing: Option<Editing>,
    /// Whether to offer Ask agent on file headers (the host offers it).
    pub can_ask: bool,
    /// Scroll to this file's header; a new number asks again for the same file.
    pub reveal: Option<(String, u64)>,
    /// The new comment's field, drawn under the selection's last line while lines are selected.
    pub composer: Option<Composer>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Composer {
    pub body: String,
    /// The add button's words (the screen names where the comment goes).
    pub label: String,
    /// Offer Ask agent about the selected lines.
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
    /// The new comment's text changed.
    CommentBody {
        text: String,
    },
    SubmitComment,
    CancelComment,
    /// Ask agent about the selected lines.
    AskLines,
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
    /// The side of a split change that has no line.
    empty: Hsla,
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
            empty: alpha(&t("surface-1"), 45.),
        }
    }
}

/// A file's sideways scrollbar as last painted, in window coordinates.
#[derive(Clone, Debug, PartialEq)]
pub struct HBar {
    pub path: String,
    pub track: Bounds<Pixels>,
    pub thumb: Bounds<Pixels>,
    /// The file's largest offset: the thumb at the track's right end.
    pub max: f32,
}

/// A sideways scrollbar being dragged: the file, the pointer's x at the press, the offset then, and offset per
/// pixel of pointer travel.
struct HDrag {
    path: String,
    x: f32,
    offset: f32,
    scale: f32,
    max: f32,
}

/// The diff's vertical scrollbar over its rows. The list measures only the rows it has drawn, so its own height
/// grows as the reader scrolls; this bar instead counts every row as one line high, so the thumb's place and size
/// are the reader's place and share among all rows from the first frame, and a drag lands on the row it points at.
// ponytail: rows taller than a line (headers, threads) count as one line; a running mean of measured heights would
// track a thread-heavy diff more closely.
#[derive(Clone)]
struct RowBar(ListState);

impl gpui_base::ScrollbarHandle for RowBar {
    fn viewport_bounds(&self) -> Bounds<Pixels> {
        self.0.viewport_bounds()
    }
    fn offset(&self) -> gpui::Point<Pixels> {
        let top = self.0.logical_scroll_top();
        point(
            px(0.),
            -(px(LINE_HEIGHT) * top.item_ix as f32 + top.offset_in_item.min(px(LINE_HEIGHT))),
        )
    }
    fn set_offset(&self, offset: gpui::Point<Pixels>) {
        let y = f32::from(-offset.y).max(0.);
        let item_ix = ((y / LINE_HEIGHT) as usize).min(self.0.item_count().saturating_sub(1));
        self.0.scroll_to(ListOffset {
            item_ix,
            offset_in_item: px(y - item_ix as f32 * LINE_HEIGHT),
        });
    }
    fn content_size(&self) -> gpui::Size<Pixels> {
        let view = self.0.viewport_bounds().size;
        size(
            view.width,
            px(LINE_HEIGHT) * self.0.item_count() as f32 + view.height,
        )
    }
}

/// The reader's place by file: kept across a rebuild of the rows.
struct Anchor {
    path: String,
    rows_in: usize,
    offset_in_item: Pixels,
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
    /// Horizontal offset of each file's unwrapped lines, by file path (a file not here is at 0), so a new snapshot
    /// of the same comparison keeps each file where the reader left it.
    offsets: Rc<HashMap<String, f32>>,
    /// The view's width at the last paint.
    width: Rc<Cell<f32>>,
    /// The rows pair the two sides of a change (the view is at least [`SPLIT_WIDTH`] wide).
    split: bool,
    /// The keyboard's row (an index into rows), drawn with a ring while the view has focus.
    cursor: Option<usize>,
    /// The cursor's ring shows: the keyboard moved it (the web's `:focus-visible`), not a click.
    keyed: bool,
    /// The edit field of the comment being edited, made when editing starts.
    edit: Option<(String, gpui::Entity<TextareaState>)>,
    /// The file whose header was pinned at the last draw.
    pinned: Option<usize>,
    /// The axis the wheel gesture under way moves (only that one), and when its last step came.
    latch: Option<(Axis, Instant)>,
    /// The sideways scrollbars at the last paint, one per file on screen that is wider than the view.
    hbars: Rc<RefCell<Vec<HBar>>>,
    hdrag: Option<HDrag>,
    /// A file asked for by `reveal` that the rows do not hold yet (its diff is on its way).
    reveal: Option<String>,
    /// The new comment's field while the composer is open, and the row it is drawn under.
    compose: Option<gpui::Entity<TextareaState>>,
    compose_row: Option<usize>,
    /// The next composer to open takes the keyboard (it was opened with a line's `＋`).
    focus_compose: bool,
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
            offsets: Rc::default(),
            width: Rc::new(Cell::new(0.)),
            split: false,
            cursor: None,
            keyed: false,
            edit: None,
            pinned: None,
            latch: None,
            hbars: Rc::default(),
            hdrag: None,
            reveal: None,
            compose: None,
            compose_row: None,
            focus_compose: false,
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

    /// How far file `path`'s unwrapped lines are scrolled sideways.
    pub fn offset(&self, path: &str) -> f32 {
        self.offsets.get(path).copied().unwrap_or(0.)
    }

    /// The sideways scrollbars as last painted.
    pub fn hbars(&self) -> Vec<HBar> {
        self.hbars.borrow().clone()
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
        // A new snapshot of the same comparison (after a stage, a refresh or any action) keeps the reader's place;
        // another comparison starts at the top.
        let same_comparison = match (&self.diff, &diff) {
            (Some(a), Some(b)) => a.target == b.target,
            (None, None) => true,
            _ => false,
        };
        let anchor = self.top_anchor();
        self.diff = diff;
        self.comments = comments;
        self.rebuild(anchor.filter(|_| same_comparison), window, cx);
    }

    /// Opens, keeps or closes the new comment's field as the props say, and moves it under the selection's last line;
    /// the rows it leaves and joins are measured again.
    fn sync_composer(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let Some(composer) = self.props.composer.clone() else {
            self.compose = None;
            if let Some(row) = self.compose_row.take() {
                self.list.remeasure_items(row..row + 1);
            }
            return;
        };
        let field = match &self.compose {
            Some(field) => {
                if field.read(cx).value().as_ref() != composer.body {
                    field.update(cx, |f, cx| f.set_value(composer.body.clone(), window, cx));
                }
                field.clone()
            }
            None => {
                let field = cx.new(|cx| {
                    let mut state = TextareaState::new(window, cx).auto_grow(3, 12);
                    state.set_value(composer.body.clone(), window, cx);
                    state
                });
                cx.subscribe(&field, |_, field, event: &InputEvent, cx| {
                    if matches!(event, InputEvent::Change) {
                        let text = field.read(cx).value().to_string();
                        cx.emit(DiffEvent::CommentBody { text });
                    }
                })
                .detach();
                self.compose = Some(field.clone());
                field
            }
        };
        if std::mem::take(&mut self.focus_compose) {
            let handle = field.read(cx).focus_handle(cx);
            window.focus(&handle, cx);
        }
        let row = self.selection_end_row();
        if row != self.compose_row {
            for r in [self.compose_row, row].into_iter().flatten() {
                self.list.remeasure_items(r..r + 1);
            }
            self.compose_row = row;
        }
    }

    /// The row of the selection's last line (where the composer goes).
    fn selection_end_row(&self) -> Option<usize> {
        let diff = self.diff.as_deref()?;
        let sel = self.props.selection.as_ref()?;
        let on = |file: usize, hunk: usize, line: usize| {
            let f = &diff.files[file];
            let l = &f.hunks[hunk].lines[line];
            let side = rows::line_side(l);
            side == sel.side
                && rows::line_number(l, side) == Some(sel.end)
                && file_path_for_side(f, side) == sel.path
        };
        self.rows.rows.iter().position(|r| match *r {
            Row::Line {
                file, hunk, line, ..
            } => on(file, hunk, line),
            Row::Pair {
                file,
                hunk,
                left,
                right,
            } => [left, right]
                .into_iter()
                .flatten()
                .any(|line| on(file, hunk, line)),
            _ => false,
        })
    }

    /// Scrolls to the file `reveal` asked for, once the rows hold it.
    fn apply_reveal(&mut self) {
        let Some(diff) = self.diff.as_deref() else {
            return;
        };
        let Some(path) = &self.reveal else {
            return;
        };
        let header = self.rows.rows.iter().position(
            |r| matches!(r, Row::File { file } if file_path(&diff.files[*file]) == path.as_str()),
        );
        if let Some(item_ix) = header {
            self.list.scroll_to(ListOffset {
                item_ix,
                offset_in_item: px(0.),
            });
            self.reveal = None;
        }
    }

    /// Where the reader is, by file rather than row: the top row's file path, how many rows into that file it is,
    /// and how far into that row.
    fn top_anchor(&self) -> Option<Anchor> {
        let diff = self.diff.as_deref()?;
        let top = self.list.logical_scroll_top();
        let header = *self.file_row.get(top.item_ix)?;
        let Row::File { file } = self.rows.rows.get(header)? else {
            return None;
        };
        Some(Anchor {
            path: file_path(diff.files.get(*file)?).to_string(),
            rows_in: top.item_ix - header,
            offset_in_item: top.offset_in_item,
        })
    }

    pub fn set_props(&mut self, props: DiffProps, window: &mut Window, cx: &mut Context<Self>) {
        if props == self.props {
            return;
        }
        let old = std::mem::replace(&mut self.props, props);
        if self.props.reveal != old.reveal {
            self.reveal = self.props.reveal.as_ref().map(|(path, _)| path.clone());
        }
        let editing_changed = old.editing.as_ref().map(|e| &e.comment)
            != self.props.editing.as_ref().map(|e| &e.comment);
        if old.path != self.props.path {
            self.rebuild(None, window, cx);
        } else if editing_changed {
            let anchor = self.top_anchor();
            self.rebuild(anchor, window, cx);
        } else if old.wrap != self.props.wrap {
            self.offsets = Rc::default();
            self.list.remeasure();
        }
        self.apply_reveal();
        self.sync_composer(window, cx);
        // A field that grew or shrank with its text changes its row's height.
        if old.composer.as_ref().map(|c| &c.body) != self.props.composer.as_ref().map(|c| &c.body) {
            if let Some(row) = self.compose_row {
                self.list.remeasure_items(row..row + 1);
            }
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

    /// Rebuilds the rows. With `anchor` the reader stays where they were (that file, that many rows into it); without
    /// one the list and every file's sideways offset go back to the start.
    fn rebuild(&mut self, anchor: Option<Anchor>, window: &mut Window, cx: &mut Context<Self>) {
        self.builds += 1;
        if anchor.is_none() {
            self.offsets = Rc::default();
        }
        let rows = match &self.diff {
            Some(diff) => rows::build(diff, &self.comments, self.props.path.as_deref(), self.split),
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
        if let Some(anchor) = anchor {
            // A change of layout moves every row of a file: its header goes to the top.
            let layout_changed = self.rows.split != rows.split;
            let place = self.diff.as_deref().and_then(|diff| {
                let header = rows.rows.iter().position(|r| {
                    matches!(r, Row::File { file } if file_path(&diff.files[*file]) == anchor.path)
                })?;
                let len = rows.rows[header + 1..]
                    .iter()
                    .position(|r| matches!(r, Row::File { .. }))
                    .map_or(rows.rows.len() - header, |n| n + 1);
                Some(if layout_changed {
                    ListOffset {
                        item_ix: header,
                        offset_in_item: px(0.),
                    }
                } else if anchor.rows_in < len {
                    ListOffset {
                        item_ix: header + anchor.rows_in,
                        offset_in_item: anchor.offset_in_item,
                    }
                } else {
                    ListOffset {
                        item_ix: header + len - 1,
                        offset_in_item: px(0.),
                    }
                })
            });
            match place {
                Some(place) => self.list.scroll_to(place),
                // The file left the diff: stay at the same row, as near as the new rows allow.
                None if !rows.rows.is_empty() => self.list.scroll_to(ListOffset {
                    item_ix: top.item_ix.min(rows.rows.len() - 1),
                    offset_in_item: px(0.),
                }),
                None => {}
            }
        }
        self.rows = Rc::new(rows);
        self.file_row = Rc::new(file_row);
        self.ordinal = Rc::new(ordinal);
        if self.cursor.is_some_and(|c| c >= self.rows.rows.len()) {
            self.cursor = None;
        }
        self.compose_row = None;
        self.sync_composer(window, cx);
        self.apply_reveal();
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

    /// The line a click or key on `row` means. For a pair, `right` picks a half (a context line is the same line in
    /// both); none picks the new side's line, else the old side's.
    fn line_at(&self, row: usize, right: Option<bool>) -> Option<(String, ReviewSide, u32)> {
        let diff = self.diff.as_deref()?;
        let (file, hunk, line) = match self.rows.rows.get(row)? {
            Row::Line {
                file, hunk, line, ..
            } => (*file, *hunk, *line),
            Row::Pair {
                file,
                hunk,
                left,
                right: new,
            } => {
                // A click names its half and an empty half is nothing; a key takes whichever side has a line.
                let picked = match right {
                    Some(false) => *left,
                    Some(true) => *new,
                    None => new.or(*left),
                };
                (*file, *hunk, picked?)
            }
            _ => return None,
        };
        let file = &diff.files[file];
        let line = &file.hunks[hunk].lines[line];
        let side = rows::line_side(line);
        Some((
            file_path_for_side(file, side).to_string(),
            side,
            rows::line_number(line, side)?,
        ))
    }

    fn select_row(
        &mut self,
        row: usize,
        right: Option<bool>,
        extend: bool,
        cx: &mut Context<Self>,
    ) {
        if let Some((path, side, line)) = self.line_at(row, right) {
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
            if self.line_at(at, None).is_some() {
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
        self.keyed = true;
        match event.keystroke.key.as_str() {
            "down" => self.move_cursor(true, cx),
            "up" => self.move_cursor(false, cx),
            "enter" | "space" => match self.cursor {
                Some(row) => self.select_row(row, None, shift, cx),
                None => return,
            },
            _ => return,
        }
        cx.stop_propagation();
    }

    /// A wheel step over a row of `file`. A gesture moves one axis only, the one it mostly moved in its first step:
    /// down the list, or sideways through that file's lines (Shift turns a mouse wheel sideways).
    fn on_wheel(&mut self, file: usize, event: &ScrollWheelEvent, cx: &mut Context<Self>) {
        let delta = event.delta.pixel_delta(px(LINE_HEIGHT));
        let (dx, dy) = if event.modifiers.shift && delta.x == px(0.) {
            (f32::from(delta.y), 0.)
        } else {
            (f32::from(delta.x), f32::from(delta.y))
        };
        if event.touch_phase == TouchPhase::Started {
            self.latch = None;
        }
        if dx == 0. && dy == 0. {
            return;
        }
        let now = Instant::now();
        let axis = match self.latch {
            Some((axis, at)) if now.duration_since(at) < LATCH_GAP => axis,
            _ if dx.abs() > dy.abs() => Axis::Horizontal,
            _ => Axis::Vertical,
        };
        self.latch = Some((axis, now));
        if axis == Axis::Vertical {
            // The list scrolls; the sideways part of the step is dropped.
            return;
        }
        // Sideways: the list must not take the vertical part.
        cx.stop_propagation();
        if self.props.wrap || dx == 0. {
            return;
        }
        let Some(path) = self
            .diff
            .as_deref()
            .and_then(|d| d.files.get(file))
            .map(|f| file_path(f).to_string())
        else {
            return;
        };
        let max = (self.content_width(file) - self.visible_width()).max(0.);
        self.set_offset(path, self.offset_of(file) - dx, max, cx);
    }

    fn offset_of(&self, file: usize) -> f32 {
        self.diff
            .as_deref()
            .and_then(|d| d.files.get(file))
            .map_or(0., |f| self.offset(file_path(f)))
    }

    fn set_offset(&mut self, path: String, offset: f32, max: f32, cx: &mut Context<Self>) {
        let next = offset.clamp(0., max);
        if self.offsets.get(&path).copied().unwrap_or(0.) != next {
            Rc::make_mut(&mut self.offsets).insert(path, next);
            cx.notify();
        }
    }

    /// A press on a file's sideways scrollbar: on the thumb it starts a drag; on the track the thumb's middle jumps
    /// there first.
    fn press_hbar(&mut self, bar: &HBar, x: f32, cx: &mut Context<Self>) {
        let room = f32::from(bar.track.size.width - bar.thumb.size.width).max(1.);
        let scale = bar.max / room;
        let mut offset = self.offset(&bar.path);
        if !(f32::from(bar.thumb.left())..=f32::from(bar.thumb.right())).contains(&x) {
            let left = x - f32::from(bar.track.left()) - f32::from(bar.thumb.size.width) / 2.;
            offset = (left * scale).clamp(0., bar.max);
            self.set_offset(bar.path.clone(), offset, bar.max, cx);
        }
        self.hdrag = Some(HDrag {
            path: bar.path.clone(),
            x,
            offset,
            scale,
            max: bar.max,
        });
    }

    fn drag_hbar(&mut self, x: f32, cx: &mut Context<Self>) {
        if let Some(d) = &self.hdrag {
            let (path, offset, max) = (d.path.clone(), d.offset + (x - d.x) * d.scale, d.max);
            self.set_offset(path, offset, max, cx);
        }
    }

    /// The number column's width, for the largest number the diff shows, and the change bar's.
    fn gutters(&self) -> (f32, f32) {
        let digits = self.rows.max_number.to_string().len().max(2) as f32;
        (digits * CODE_SIZE * 0.6 + 0.9 * REM, BAR)
    }

    /// The width a line's cell shows: the view's, or half of it for each side of a split change.
    fn visible_width(&self) -> f32 {
        if self.rows.split {
            self.width.get() / 2.
        } else {
            self.width.get()
        }
    }

    /// The shared width of `file`'s unwrapped lines: the bar, the number and its widest code.
    fn content_width(&self, file: usize) -> f32 {
        let (number, bar) = self.gutters();
        // ponytail: SF Mono's advance is 0.6 em; a measured advance would replace this if the mono face changes.
        number + bar + self.rows.widest.get(file).copied().unwrap_or(0) as f32 * CODE_SIZE * 0.6
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
    offsets: Rc<HashMap<String, f32>>,
    gutters: (f32, f32),
    /// The view's width at the last paint (the web's `100cqi`).
    view_width: f32,
    cursor: Option<usize>,
    focused: bool,
    edit: Option<(String, gpui::Entity<TextareaState>)>,
    /// The new comment's field and the row it is drawn under.
    compose: Option<(usize, gpui::Entity<TextareaState>)>,
}

/// The row kinds the parity probe names, as an index: file header, hunk header, line, thread, other.
fn probe_kind(row: &Row) -> usize {
    match row {
        Row::File { .. } => 0,
        Row::Hunk { .. } => 1,
        Row::Line { .. } | Row::Pair { .. } => 2,
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
    gpui_shell::probe_wrap(name.into(), style, element)
}

impl Frame {
    /// The sideways scrollbars for the rows the list laid out in `viewport`: one per file on screen wider than the
    /// view, at the bottom of that file's part of the view (the view's bottom while the file runs past it).
    fn hbars(&self, list: &ListState, viewport: Bounds<Pixels>) -> Vec<HBar> {
        let Some(diff) = self.diff.as_deref() else {
            return vec![];
        };
        if self.props.wrap {
            return vec![];
        }
        let visible = if self.rows.split {
            self.view_width / 2.
        } else {
            self.view_width
        };
        // Each file's run of laid-out rows: (file, top, bottom).
        let mut spans: Vec<(usize, Pixels, Pixels)> = vec![];
        for ix in list.logical_scroll_top().item_ix..self.rows.rows.len() {
            let Some(b) = list.bounds_for_item(ix) else {
                break;
            };
            if b.top() >= viewport.bottom() {
                break;
            }
            let file = self.rows.rows[ix].file();
            match spans.last_mut() {
                Some(span) if span.0 == file => span.2 = b.bottom(),
                _ => spans.push((file, b.top(), b.bottom())),
            }
        }
        let width = viewport.size.width - px(HBAR_RIGHT);
        spans
            .into_iter()
            .filter_map(|(file, top, bottom)| {
                let content = self.content_width(file);
                let max = content - visible;
                let (top, bottom) = (top.max(viewport.top()), bottom.min(viewport.bottom()));
                if max <= 0. || bottom - top < px(3. * HBAR) || width <= px(0.) {
                    return None;
                }
                let path = file_path(diff.files.get(file)?).to_string();
                let offset = self.offsets.get(&path).copied().unwrap_or(0.);
                let track = Bounds::new(
                    point(viewport.left(), bottom - px(HBAR)),
                    size(width, px(HBAR)),
                );
                let thumb_w = (width * (visible / content)).max(px(24.)).min(width);
                let thumb_x = (width - thumb_w) * (offset / max).clamp(0., 1.);
                let thumb = Bounds::new(
                    point(track.left() + thumb_x, track.top()),
                    size(thumb_w, px(HBAR)),
                );
                Some(HBar {
                    path,
                    track,
                    thumb,
                    max,
                })
            })
            .collect()
    }

    /// The shared width of `file`'s unwrapped lines: the bar, the number and its widest code.
    fn content_width(&self, file: usize) -> f32 {
        let (number, bar) = self.gutters;
        // ponytail: SF Mono's advance is 0.6 em; a measured advance would replace this if the mono face changes.
        number + bar + self.rows.widest.get(file).copied().unwrap_or(0) as f32 * CODE_SIZE * 0.6
    }

    /// Row `ix` as the list draws it, under a wheel handler that scrolls its file sideways.
    fn named_row(&self, ix: usize) -> AnyElement {
        let file = self.rows.rows[ix].file();
        let view = self.view.clone();
        div()
            .w_full()
            .on_scroll_wheel(move |event, window, cx| {
                let _ = window;
                view.update(cx, |view, cx| view.on_wheel(file, event, cx))
                    .ok();
            })
            .child(self.drawn_row(ix))
            .into_any_element()
    }

    /// Row `ix` as the list draws it. A line carries the comment thread under it (the web draws the thread inside
    /// the line's grid, so the line's box holds both); the thread's own row is then empty. Each is named for the
    /// parity probe by its place among its kind (`git-diff-line@2`).
    fn drawn_row(&self, ix: usize) -> AnyElement {
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
            Row::Line { .. } | Row::Pair { .. } => {
                let line = self.row(ix);
                let tint = self.line_tint(ix);
                let thread = match rows.get(ix + 1) {
                    Some(Row::Thread { comments, .. }) => Some(probed(
                        name("git-line-comments", ix + 1),
                        None,
                        c.text,
                        self.thread(ix + 1, comments),
                    )),
                    _ => None,
                };
                let composer = self
                    .compose
                    .as_ref()
                    .filter(|(row, _)| *row == ix)
                    .map(|(_, field)| self.composer(field));
                let line = match thread {
                    // The line's tint runs behind its thread too, as the web's grid does.
                    Some(thread) => div()
                        .flex()
                        .flex_col()
                        .w_full()
                        .when_some(tint, |d, tint| d.bg(tint))
                        .child(line)
                        .child(thread)
                        .into_any_element(),
                    None => line,
                };
                let line = probed(name("git-diff-line", ix), tint, c.text, line);
                // The new comment's field opens under the line (and its thread), as GitHub's does.
                match composer {
                    Some(composer) => div()
                        .flex()
                        .flex_col()
                        .w_full()
                        .child(line)
                        .child(composer)
                        .into_any_element(),
                    None => line,
                }
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
                file, hunk, line, ..
            } => self.line_row(
                ix,
                &diff.files[*file],
                &diff.files[*file].hunks[*hunk].lines[*line],
            ),
            Row::Pair {
                file,
                hunk,
                left,
                right,
            } => self.pair_row(ix, &diff.files[*file], *hunk, *left, *right),
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

    fn line_row(&self, ix: usize, file: &DiffFile, line: &DiffLine) -> AnyElement {
        self.cell(
            ix,
            None,
            file,
            line,
            self.focused && self.cursor == Some(ix),
        )
    }

    /// A split change: the old side's line beside the new side's, an empty half where a side has no line.
    fn pair_row(
        &self,
        ix: usize,
        file: &DiffFile,
        hunk: usize,
        left: Option<usize>,
        right: Option<usize>,
    ) -> AnyElement {
        let lines = &file.hunks[hunk].lines;
        let half = |side: bool, line: Option<usize>| match line {
            Some(line) => self.cell(ix, Some(side), file, &lines[line], false),
            None => div()
                .flex_1()
                .min_w_0()
                .bg(self.tints.empty)
                .into_any_element(),
        };
        let ring = self.focused && self.cursor == Some(ix);
        div()
            .relative()
            .w_full()
            .flex()
            .child(half(false, left))
            .child(
                div()
                    .flex_1()
                    .min_w_0()
                    .flex()
                    .border_l_1()
                    .border_color(self.colors.surface1)
                    .child(half(true, right)),
            )
            // The keyboard's ring is drawn over the row, so it never changes the row's height.
            .when(ring, |d| {
                d.child(
                    div()
                        .absolute()
                        .inset_0()
                        .border_1()
                        .border_color(self.colors.accent),
                )
            })
            .into_any_element()
    }

    /// One side of a line: the change bar, the number and the code, with the kind's tint, the hover `＋` and the
    /// selection. `half` is which side of a split change it is (none: the whole row).
    fn cell(
        &self,
        ix: usize,
        half: Option<bool>,
        file: &DiffFile,
        line: &DiffLine,
        ring: bool,
    ) -> AnyElement {
        let (c, t) = (self.colors, self.tints);
        let side = rows::line_side(line);
        let number = rows::line_number(line, side);
        let path = file_path_for_side(file, side).to_string();
        let selected = number.is_some_and(|n| {
            self.props
                .selection
                .as_ref()
                .is_some_and(|s| s.path == path && s.side == side && s.start <= n && n <= s.end)
        });
        let (bg, hover, bar) = match line.kind {
            DiffLineKind::Addition => (Some(t.addition), t.hover_change, Some(c.green)),
            DiffLineKind::Deletion => (Some(t.deletion), t.hover_change, Some(c.red)),
            DiffLineKind::Context => (selected.then_some(t.selected), t.hover_context, None),
        };
        let (number_w, bar_w) = self.gutters;
        let text: SharedString = if line.content.is_empty() {
            " ".into()
        } else {
            line.content.clone().into()
        };
        let wrap = self.props.wrap;
        let file_ix = self.rows.rows[ix].file();
        let offset_x = self.offsets.get(file_path(file)).copied().unwrap_or(0.);
        let content_width = self.content_width(file_ix);
        let code = div().flex_1().min_w_0().child(text);
        let code = if wrap { code } else { code.whitespace_nowrap() };
        let view = self.view.clone();
        let plus = number.map(|n| {
            let (view, path) = (self.view.clone(), path.clone());
            div()
                .id(("git-comment-add", ix * 2 + usize::from(half == Some(true))))
                .absolute()
                .top(px(0.1 * REM))
                .left(px(0.1 * REM + if wrap { 0. } else { offset_x }))
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
                        view.focus_compose = true;
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
            .when(!wrap, |d| d.w(px(content_width)).ml(px(-offset_x)))
            .when(wrap, |d| d.w_full())
            .child(
                div()
                    .w(px(bar_w))
                    .flex_shrink_0()
                    .self_stretch()
                    .min_h(px(LINE_HEIGHT))
                    .when_some(bar, |d, bar| d.bg(bar)),
            )
            .child(
                div()
                    .w(px(number_w))
                    .flex_shrink_0()
                    .pr(px(0.5 * REM))
                    .flex()
                    .justify_end()
                    .text_color(c.overlay)
                    .child(
                        number
                            .map(|n| SharedString::from(n.to_string()))
                            .unwrap_or_default(),
                    ),
            )
            .child(code);
        div()
            .id(("git-diff-line", ix * 2 + usize::from(half == Some(true))))
            .group("git-line")
            .relative()
            .when(half.is_none(), |d| d.w_full())
            .when(half.is_some(), |d| d.flex_1().min_w_0())
            .overflow_hidden()
            .when_some(bg, |d, bg| d.bg(bg))
            .hover(move |s| s.bg(hover))
            .child(inner)
            .children(plus)
            .when(ring, |d| {
                d.child(div().absolute().inset_0().border_1().border_color(c.accent))
            })
            .on_mouse_down(MouseButton::Left, move |event, window, cx| {
                let extend = event.modifiers.shift;
                view.update(cx, |view, cx| {
                    window.focus(&view.focus, cx);
                    view.keyed = false;
                    view.select_row(ix, half, extend, cx);
                })
                .ok();
            })
            .into_any_element()
    }

    fn thread(&self, ix: usize, comments: &[usize]) -> AnyElement {
        // Under the code, at the most 42rem wide and never past the view's edge, in the line's mono text at its 1.5
        // line height. A pair's thread spans the row, from the code of the left half.
        let left = self.gutters.0 + self.gutters.1;
        let widest = (42. * REM).min(self.view_width - left - 0.8 * REM);
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

    /// The new comment's field under the selection's last line: the field, Ask agent about lines, add and cancel.
    fn composer(&self, field: &gpui::Entity<TextareaState>) -> AnyElement {
        let c = self.colors;
        let Some(composer) = self.props.composer.as_ref() else {
            return div().into_any_element();
        };
        let selection = self.props.selection.as_ref();
        let range = selection.map_or(String::new(), |s| {
            if s.start == s.end {
                format!("{} line {}", s.side.label(), s.start)
            } else {
                format!("{} lines {}–{}", s.side.label(), s.start, s.end)
            }
        });
        let empty = composer.body.trim().is_empty();
        let action = |label: SharedString, key: &'static str, enabled: bool, event: DiffEvent| {
            let view = self.view.clone();
            div()
                .id(key)
                .rounded(px(8.))
                .px(px(8.))
                .py(px(0.3 * REM))
                .text_size(px(0.66 * REM))
                .text_color(c.accent)
                .when(!enabled, |d| d.opacity(0.45))
                .when(enabled, |d| {
                    d.hover(|s| s.bg(c.surface1)).on_click(move |_, _, cx| {
                        let event = event.clone();
                        view.update(cx, |_, cx| cx.emit(event)).ok();
                    })
                })
                .child(label)
        };
        let left = self.gutters.0 + self.gutters.1;
        let widest = (42. * REM).min(self.view_width - left - 0.8 * REM);
        let body = div()
            .id("git-comment-composer")
            .mt(px(0.2 * REM))
            .mr(px(0.7 * REM))
            .mb(px(0.45 * REM))
            .ml(px(left))
            .when(self.view_width > 0., |d| d.max_w(px(widest.max(0.))))
            .rounded(px(8.))
            .bg(c.surface0)
            .p(px(0.65 * REM))
            .text_color(c.text)
            .child(
                div()
                    .flex()
                    .justify_between()
                    .gap(px(0.5 * REM))
                    .mb(px(0.4 * REM))
                    .text_size(px(0.68 * REM))
                    .text_color(c.subtext)
                    .child(
                        selection
                            .map(|s| format!("Comment on {}", s.path))
                            .unwrap_or_default(),
                    )
                    .child(range),
            )
            .child(
                div()
                    .id("git-comment-body")
                    .min_h(px(3.2 * REM))
                    .rounded(px(8.))
                    .bg(c.surface1)
                    .p(px(0.4 * REM))
                    .child(Textarea::new(field)),
            )
            .child(
                div()
                    .mt(px(0.4 * REM))
                    .flex()
                    .items_center()
                    .justify_end()
                    .gap(px(0.3 * REM))
                    .when(composer.can_ask, |d| {
                        d.child(action(
                            "Ask agent about lines…".into(),
                            "git-comment-ask",
                            true,
                            DiffEvent::AskLines,
                        ))
                    })
                    .child(action(
                        composer.label.clone().into(),
                        "git-comment-submit",
                        !empty,
                        DiffEvent::SubmitComment,
                    ))
                    .child(action(
                        "Cancel".into(),
                        "git-comment-cancel-new",
                        true,
                        DiffEvent::CancelComment,
                    )),
            )
            .into_any_element();
        probed(
            "git-comment-composer".into(),
            Some(c.surface0),
            c.text,
            body,
        )
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
        // Auto goes by last paint's width; a view that grew or shrank across the split width, or a changed layout
        // choice, rebuilds its rows once.
        let split = match self.props.layout {
            Layout::Auto => self.width.get() >= SPLIT_WIDTH,
            Layout::Unified => false,
            Layout::Split => true,
        };
        if split != self.split {
            self.split = split;
            let anchor = self.top_anchor();
            self.rebuild(anchor, window, cx);
            self.offsets = Rc::default();
        }
        let frame = Frame {
            ordinal: self.ordinal.clone(),
            view: cx.entity().downgrade(),
            diff: self.diff.clone(),
            comments: self.comments.clone(),
            rows: self.rows.clone(),
            props: Rc::new(self.props.clone()),
            colors: self.colors,
            tints: self.tints,
            offsets: self.offsets.clone(),
            gutters: self.gutters(),
            view_width: self.width.get(),
            cursor: self.cursor.filter(|_| self.keyed),
            focused: self.focus.is_focused(window),
            edit: self.edit.clone(),
            compose: self.compose_row.zip(self.compose.clone()),
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
        let (bars_list, bars_frame, painted) =
            (self.list.clone(), frame.clone(), self.hbars.clone());
        let bar_view = cx.entity().downgrade();
        let (track_color, thumb_color) = (
            Hsla {
                a: 0.35,
                ..self.colors.surface1
            },
            Hsla {
                a: 0.8,
                ..self.colors.overlay
            },
        );
        div()
            .id("git-diff")
            .key_context("DiffView")
            .track_focus(&self.focus)
            .relative()
            .size_full()
            .overflow_hidden()
            .on_key_down(cx.listener(Self::on_key))
            .child(
                gpui::canvas(
                    move |bounds: Bounds<Pixels>, _, _| width.set(f32::from(bounds.size.width)),
                    |_, _, _, _| {},
                )
                .absolute()
                .size_full(),
            )
            .child(list(self.list.clone(), move |ix, _, _| rows.named_row(ix)).size_full())
            // Where the reader is in the whole diff, and a thumb to drag there.
            .child(
                gpui_base::Scrollbar::vertical(&RowBar(self.list.clone()))
                    .id("git-diff-vbar")
                    .mode(gpui_base::ScrollbarMode::Always),
            )
            .children(pinned.map(|(_, header, push)| {
                div().absolute().top(push).left_0().right_0().child(header)
            }))
            // Each file's sideways scrollbar, laid out after the list has laid out this frame's rows.
            .child(
                gpui::canvas(
                    move |_, window, _| {
                        let bars = bars_frame.hbars(&bars_list, bars_list.viewport_bounds());
                        let hitboxes: Vec<Hitbox> = bars
                            .iter()
                            .map(|bar| window.insert_hitbox(bar.track, HitboxBehavior::BlockMouse))
                            .collect();
                        *painted.borrow_mut() = bars.clone();
                        (bars, hitboxes)
                    },
                    move |_, (bars, hitboxes): (Vec<HBar>, Vec<Hitbox>), window, _| {
                        for bar in &bars {
                            window.paint_quad(fill(bar.track, track_color));
                            window.paint_quad(
                                fill(bar.thumb, thumb_color).corner_radii(px(HBAR / 2.)),
                            );
                        }
                        let view = bar_view.clone();
                        window.on_mouse_event(move |e: &MouseDownEvent, phase, window, cx| {
                            if phase != DispatchPhase::Bubble || e.button != MouseButton::Left {
                                return;
                            }
                            if let Some(bar) = bars
                                .iter()
                                .zip(&hitboxes)
                                .find(|(_, h)| h.is_hovered(window))
                                .map(|(b, _)| b)
                            {
                                cx.stop_propagation();
                                let x = f32::from(e.position.x);
                                view.update(cx, |view, cx| view.press_hbar(bar, x, cx)).ok();
                            }
                        });
                        let view = bar_view.clone();
                        window.on_mouse_event(move |e: &MouseMoveEvent, phase, _, cx| {
                            if phase != DispatchPhase::Bubble
                                || e.pressed_button != Some(MouseButton::Left)
                            {
                                return;
                            }
                            let x = f32::from(e.position.x);
                            view.update(cx, |view, cx| view.drag_hbar(x, cx)).ok();
                        });
                        let view = bar_view.clone();
                        window.on_mouse_event(move |_: &MouseUpEvent, phase, _, cx| {
                            if phase == DispatchPhase::Bubble {
                                view.update(cx, |view, _| view.hdrag = None).ok();
                            }
                        });
                    },
                )
                .absolute()
                .size_full(),
            )
    }
}

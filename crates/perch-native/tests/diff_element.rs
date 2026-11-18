//! The review's native diff (`DiffView`) offscreen: what it draws for a diff and its comments, what a press or a
//! key on it tells the screen, and what it costs. Fed a synthetic diff shaped like the one `measurements.md` timed
//! on the React runtime (hunks of 40 lines: 8 deletions, 8 additions, 24 context; 250 lines a file; 60-character
//! lines). No core, no window shown or focused; every event goes through the window's own dispatch.
//!
//! Budgets (release): open to first drawn frame 500 lines 50 ms, 5,000 150 ms, 20,000 500 ms; a wheel step 8 ms.
//! Checked at twice the budget, at the budget itself under `PERCH_BUDGET_STRICT=1`; `PERCH_DIFF_REPORT=1` prints
//! the numbers. The process's first window (fonts, shaders) is opened apart and not timed.

use gpui::{
    point, px, size, AppContext as _, Entity, HeadlessAppContext, Keystroke, Modifiers,
    MouseButton, MouseDownEvent, MouseMoveEvent, MouseUpEvent, Pixels, PlatformInput, Point,
    ScrollDelta, ScrollWheelEvent, TouchPhase, Window, WindowHandle,
};
use perch_core::review::{
    AnchorConfidence, LineRange, ReviewAnchor, ReviewComment, ReviewSide, ReviewStatus,
};
use perch_core::source_control::{
    DiffFile, DiffFileStatus, DiffHunk, DiffLine, DiffLineKind, DiffTarget,
};
use perch_native::diff::element::{DiffEvent, DiffProps, DiffView, Editing, Layout, Selection};
use perch_native::diff::rows::Row;
use perch_native::git::store::DiffSnapshot;
use perch_native::mods::theme;
use std::cell::RefCell;
use std::rc::Rc;
use std::sync::Arc;
use std::time::{Duration, Instant};

const WIDTH: f32 = 960.;
/// Wide enough for each change to show its old side beside its new side.
const SPLIT: f32 = 1280.;
const HEIGHT: f32 = 800.;

fn synthetic(lines: usize) -> DiffSnapshot {
    let files = (lines / 250).max(1);
    let per_file = lines / files;
    let files = (0..files)
        .map(|f| {
            let hunks = (0..per_file.div_ceil(40))
                .map(|h| {
                    let base = (h * 60 + 1) as u32;
                    let (mut old, mut new) = (base, base);
                    let lines = (0..40.min(per_file - h * 40))
                        .map(|i| {
                            let content = format!(
                                "    let value_{i:03} = compute(input.get({}), {:>3}); // pad",
                                i % 97,
                                i % 13
                            );
                            let (kind, o, n) = match i {
                                0..=7 => {
                                    old += 1;
                                    (DiffLineKind::Deletion, Some(old - 1), None)
                                }
                                8..=15 => {
                                    new += 1;
                                    (DiffLineKind::Addition, None, Some(new - 1))
                                }
                                _ => {
                                    old += 1;
                                    new += 1;
                                    (DiffLineKind::Context, Some(old - 1), Some(new - 1))
                                }
                            };
                            DiffLine {
                                kind,
                                content,
                                old_line: o,
                                new_line: n,
                            }
                        })
                        .collect::<Vec<_>>();
                    DiffHunk {
                        old_start: base,
                        old_count: 32,
                        new_start: base,
                        new_count: 32,
                        header: format!("@@ -{base},32 +{base},32 @@"),
                        lines,
                    }
                })
                .collect();
            let path = format!("src/module_{f}/file.rs");
            DiffFile {
                old_path: Some(path.clone()),
                new_path: Some(path),
                status: DiffFileStatus::Modified,
                hunks,
                is_binary: false,
            }
        })
        .collect();
    DiffSnapshot {
        workspace_id: "w".into(),
        target: DiffTarget::WorkingTree,
        files,
        hunk_count: lines / 40,
        truncated: false,
        source_revision: Some("rev".into()),
        source_revisions: None,
    }
}

fn comment(id: &str, path: &str, line: u32) -> ReviewComment {
    let range = LineRange {
        start: line,
        end: line,
    };
    ReviewComment {
        id: id.into(),
        workspace_id: "w".into(),
        session_id: None,
        agent_id: None,
        path: path.into(),
        base: DiffTarget::WorkingTree,
        base_revision: "rev".into(),
        side: ReviewSide::New,
        range,
        body: "A review note that says something about this line.".into(),
        anchor: ReviewAnchor {
            path: path.into(),
            side: ReviewSide::New,
            base: DiffTarget::WorkingTree,
            base_revision: "rev".into(),
            range,
            before: vec![],
            selected: vec![],
            after: vec![],
        },
        status: ReviewStatus::Unresolved,
        anchor_confidence: AnchorConfidence::Exact,
        created_at: 0,
        updated_at: 0,
        version: 1,
    }
}

/// A comment on a context line of every 100 lines (new side), as threads to draw.
fn comments_for(diff: &DiffSnapshot) -> Vec<ReviewComment> {
    let mut out = vec![];
    let mut n = 0;
    for file in &diff.files {
        for hunk in &file.hunks {
            for line in &hunk.lines {
                n += 1;
                if n % 100 == 50 && line.kind == DiffLineKind::Context {
                    out.push(comment(
                        &format!("c{n}"),
                        file.new_path.as_deref().unwrap(),
                        line.new_line.unwrap(),
                    ));
                }
            }
        }
    }
    out
}

struct Rig {
    cx: HeadlessAppContext,
    window: WindowHandle<DiffView>,
    events: Rc<RefCell<Vec<DiffEvent>>>,
}

impl Rig {
    fn open(
        cx: HeadlessAppContext,
        diff: DiffSnapshot,
        comments: Vec<ReviewComment>,
        props: DiffProps,
    ) -> (Self, Duration) {
        Self::open_sized(cx, diff, comments, props, WIDTH)
    }

    fn open_sized(
        mut cx: HeadlessAppContext,
        diff: DiffSnapshot,
        comments: Vec<ReviewComment>,
        props: DiffProps,
        width: f32,
    ) -> (Self, Duration) {
        let started = Instant::now();
        let window = cx
            .open_window(size(px(width), px(HEIGHT)), |window, cx| {
                cx.new(|cx| {
                    let mut view = DiffView::new(&theme::resolve(theme::DEFAULT), cx);
                    view.set_data(Some(Rc::new(diff)), Rc::new(comments), window, cx);
                    view.set_props(props, window, cx);
                    view
                })
            })
            .unwrap();
        let mut rig = Rig {
            cx,
            window,
            events: Rc::default(),
        };
        rig.draw();
        let opened = started.elapsed();
        let events = rig.events.clone();
        let view = rig.view();
        rig.cx.update(|cx| {
            cx.subscribe(&view, move |_, event: &DiffEvent, _| {
                events.borrow_mut().push(event.clone())
            })
            .detach();
        });
        (rig, opened)
    }

    /// Saves the window's frame as a PNG when `PERCH_DIFF_SHOTS` names a folder.
    fn shot(&mut self, name: &str) {
        let Some(dir) = std::env::var_os("PERCH_DIFF_SHOTS") else {
            return;
        };
        let image = self
            .cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                let _ = window.draw(cx);
                window.render_to_image().expect("offscreen render")
            })
            .unwrap();
        image
            .save(std::path::Path::new(&dir).join(format!("{name}.png")))
            .unwrap();
    }

    fn view(&mut self) -> Entity<DiffView> {
        self.window.entity(&self.cx).unwrap()
    }

    fn draw(&mut self) {
        self.cx.run_until_parked();
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.refresh();
                let _ = window.draw(cx);
            })
            .unwrap();
    }

    fn input(&mut self, input: PlatformInput) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_event(input, cx);
            })
            .unwrap();
        self.draw();
    }

    fn wheel(&mut self, delta: Point<f32>, modifiers: Modifiers) {
        self.input(PlatformInput::ScrollWheel(ScrollWheelEvent {
            position: point(px(WIDTH / 2.), px(HEIGHT / 2.)),
            delta: ScrollDelta::Lines(point(delta.x, delta.y)),
            modifiers,
            touch_phase: TouchPhase::Moved,
        }));
    }

    /// One wheel step at `at`, in lines, as the step of a gesture in `phase`.
    fn wheel_at(&mut self, at: Point<Pixels>, delta: Point<f32>, phase: TouchPhase) {
        self.input(PlatformInput::ScrollWheel(ScrollWheelEvent {
            position: at,
            delta: ScrollDelta::Lines(point(delta.x, delta.y)),
            modifiers: Modifiers::default(),
            touch_phase: phase,
        }));
    }

    /// A move to `from`, a press there, a drag to `to` and a release there.
    fn drag(&mut self, from: Point<Pixels>, to: Point<Pixels>) {
        // The pointer arrives first, as a real one does: what it is over is known before the press.
        self.input(PlatformInput::MouseMove(MouseMoveEvent {
            position: from,
            pressed_button: None,
            modifiers: Modifiers::default(),
        }));
        self.input(PlatformInput::MouseDown(MouseDownEvent {
            button: MouseButton::Left,
            position: from,
            modifiers: Modifiers::default(),
            click_count: 1,
            first_mouse: false,
        }));
        self.input(PlatformInput::MouseMove(MouseMoveEvent {
            position: to,
            pressed_button: Some(MouseButton::Left),
            modifiers: Modifiers::default(),
        }));
        self.input(PlatformInput::MouseUp(MouseUpEvent {
            button: MouseButton::Left,
            position: to,
            modifiers: Modifiers::default(),
            click_count: 1,
        }));
    }

    fn click(&mut self, at: Point<Pixels>, modifiers: Modifiers) {
        self.input(PlatformInput::MouseDown(MouseDownEvent {
            button: MouseButton::Left,
            position: at,
            modifiers,
            click_count: 1,
            first_mouse: false,
        }));
        self.input(PlatformInput::MouseUp(MouseUpEvent {
            button: MouseButton::Left,
            position: at,
            modifiers,
            click_count: 1,
        }));
    }

    fn key(&mut self, spec: &str) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_keystroke(Keystroke::parse(spec).unwrap(), cx);
            })
            .unwrap();
        self.draw();
    }

    /// Where row `ix` is on screen, scrolled into view first when it is not.
    fn row_bounds(&mut self, ix: usize) -> gpui::Bounds<Pixels> {
        let view = self.view();
        let viewport = self
            .cx
            .update(|cx| view.read(cx).list_state().viewport_bounds());
        let shown = self
            .cx
            .update(|cx| view.read(cx).list_state().bounds_for_item(ix));
        if !shown
            .is_some_and(|b| viewport.contains(&b.origin) && viewport.contains(&b.bottom_right()))
        {
            self.cx.update(|cx| {
                view.read(cx).list_state().scroll_to(gpui::ListOffset {
                    item_ix: ix,
                    offset_in_item: px(0.),
                })
            });
            self.draw();
        }
        self.cx
            .update(|cx| view.read(cx).list_state().bounds_for_item(ix))
            .expect("the row is drawn")
    }

    fn rows(&mut self) -> Vec<Row> {
        let view = self.view();
        self.cx.update(|cx| view.read(cx).rows().rows.clone())
    }

    fn set_props(&mut self, props: DiffProps) {
        let view = self.view();
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                view.update(cx, |v, cx| v.set_props(props, window, cx))
            })
            .unwrap();
        self.draw();
    }

    fn set_data(&mut self, diff: DiffSnapshot) {
        let view = self.view();
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                view.update(cx, |v, cx| {
                    v.set_data(Some(Rc::new(diff)), Rc::default(), window, cx)
                })
            })
            .unwrap();
        self.draw();
    }

    fn top(&mut self) -> gpui::ListOffset {
        let view = self.view();
        self.cx
            .update(|cx| view.read(cx).list_state().logical_scroll_top())
    }

    fn close(mut self) -> HeadlessAppContext {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, _| {
                window.remove_window()
            })
            .unwrap();
        self.cx.run_until_parked();
        self.cx
    }
}

fn first_row(rows: &[Row], pick: impl Fn(&Row) -> bool) -> usize {
    rows.iter().position(pick).expect("such a row")
}

fn new_context() -> HeadlessAppContext {
    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    cx.update(gpui_base::init);
    cx
}

fn timings(mut cx: HeadlessAppContext, slack: f32, report: bool) -> HeadlessAppContext {
    // The first window pays for fonts and shaders once; the app has long paid it when a review opens.
    let (warm, _) = Rig::open(cx, synthetic(40), vec![], DiffProps::default());
    cx = warm.close();
    let mut failed = vec![];
    let mut thread_means = vec![];
    for threads in [false, true] {
        for (lines, budget) in [(500, 50.), (5_000, 150.), (20_000, 500.)] {
            let diff = synthetic(lines);
            let comments = if threads { comments_for(&diff) } else { vec![] };
            let (mut rig, opened) = Rig::open(cx, diff, comments, DiffProps::default());
            let builds = {
                let v = rig.view();
                rig.cx.update(|cx| v.read(cx).builds)
            };
            let mut steps = vec![];
            for _ in 0..20 {
                let t = Instant::now();
                rig.wheel(point(0., -3.), Modifiers::default());
                steps.push(t.elapsed());
            }
            let view = rig.view();
            let (top, after) = rig.cx.update(|cx| {
                (
                    view.read(cx).list_state().logical_scroll_top().item_ix,
                    view.read(cx).builds,
                )
            });
            assert!(top > 20, "{lines} lines: the wheel scrolls (top row {top})");
            assert_eq!(after, builds, "scrolling builds no rows");
            let open_ms = opened.as_secs_f64() * 1000.;
            let mean = steps.iter().sum::<Duration>().as_secs_f64() * 1000. / steps.len() as f64;
            let worst = steps.iter().max().unwrap().as_secs_f64() * 1000.;
            if report {
                println!("diff_element: {lines:>6} lines threads {threads:<5}: open {open_ms:6.1} ms (budget {budget}), wheel mean {mean:5.2} ms worst {worst:5.2} ms (budget 8)");
            }
            if open_ms > budget * slack as f64 || mean > 8. * slack as f64 {
                failed.push(format!(
                    "{lines} lines, threads {threads}: open {open_ms:.1} ms, wheel {mean:.2} ms"
                ));
            }
            // Without threads first, then with: entry `i` and `i + 3` are the same size.
            thread_means.push((open_ms, mean));
            cx = rig.close();
        }
    }
    // Threads every 100 lines move neither number by more than 20 % (plus 5 ms: single-digit-millisecond opens are within timer noise).
    for i in 0..3 {
        let ((plain_open, plain_wheel), (thread_open, thread_wheel)) =
            (thread_means[i], thread_means[i + 3]);
        assert!(
            thread_open <= plain_open * 1.2 + 5.,
            "threads cost at open: {thread_open:.1} vs {plain_open:.1} ms"
        );
        assert!(
            thread_wheel <= plain_wheel * 1.2 + 5.,
            "threads cost per wheel step: {thread_wheel:.2} vs {plain_wheel:.2} ms"
        );
    }
    assert!(failed.is_empty(), "over budget (x{slack}): {failed:?}");
    cx
}

fn interactions(cx: HeadlessAppContext) -> HeadlessAppContext {
    let diff = synthetic(500);
    let path = diff.files[0].new_path.clone().unwrap();
    let (mut rig, _) = Rig::open(
        cx,
        diff,
        vec![],
        DiffProps {
            can_ask: true,
            ..DiffProps::default()
        },
    );
    let rows = rig.rows();

    // A click selects the line; shift-click extends.
    let context = first_row(
        &rows,
        |r| matches!(r, Row::Line { number: Some(_), side: ReviewSide::New, line, .. } if *line >= 16),
    );
    let bounds = rig.row_bounds(context);
    rig.click(bounds.center(), Modifiers::default());
    let Row::Line {
        number: Some(n), ..
    } = rows[context]
    else {
        unreachable!()
    };
    assert_eq!(
        rig.events.borrow().last(),
        Some(&DiffEvent::SelectLine {
            path: path.clone(),
            side: ReviewSide::New,
            line: n,
            extend: false
        }),
        "click selects"
    );
    let further = rig.row_bounds(context + 3);
    rig.click(
        further.center(),
        Modifiers {
            shift: true,
            ..Modifiers::default()
        },
    );
    assert!(
        matches!(
            rig.events.borrow().last(),
            Some(DiffEvent::SelectLine { extend: true, .. })
        ),
        "shift-click extends"
    );

    // Keys: Down moves the cursor to the next selectable line, Enter selects it, Shift+Enter extends.
    rig.events.borrow_mut().clear();
    rig.key("down");
    rig.key("enter");
    let Row::Line {
        number: Some(next), ..
    } = rows[context + 4]
    else {
        panic!("the next row is a line")
    };
    assert_eq!(
        rig.events.borrow().last(),
        Some(&DiffEvent::SelectLine {
            path: path.clone(),
            side: ReviewSide::New,
            line: next,
            extend: false
        }),
        "Down then Enter"
    );
    rig.key("shift-space");
    assert!(
        matches!(
            rig.events.borrow().last(),
            Some(DiffEvent::SelectLine { extend: true, .. })
        ),
        "Shift+Space extends"
    );

    // The ＋ asks for a comment on its line and does not also select it.
    rig.events.borrow_mut().clear();
    let bounds = rig.row_bounds(context);
    rig.click(bounds.origin + point(px(6.), px(6.)), Modifiers::default());
    assert_eq!(
        rig.events.borrow().as_slice(),
        &[DiffEvent::AddComment {
            path: path.clone(),
            side: ReviewSide::New,
            line: n
        }],
        "＋ asks to comment"
    );

    // The selection tints a context line (drawn, not asserted by pixel here: the gate compares pictures).
    rig.set_props(DiffProps {
        can_ask: true,
        selection: Some(Selection {
            path: path.clone(),
            side: ReviewSide::New,
            start: n,
            end: n,
        }),
        ..DiffProps::default()
    });

    // Wrap: a narrow view with wrapped lines makes line rows taller than one line.
    let unwrapped = rig.row_bounds(context).size.height;
    let mut cx = rig.close();
    let (mut rig, _) = Rig::open_sized(
        cx,
        synthetic(500),
        vec![],
        DiffProps {
            wrap: true,
            ..DiffProps::default()
        },
        320.,
    );
    // The same context line (the same diff): an added or removed line sits lower by the empty
    // number cell's drop, so only like is compared with like.
    let line = context;
    assert!(
        rig.row_bounds(line).size.height > unwrapped,
        "wrapped lines break at a narrow width"
    );
    rig.set_props(DiffProps::default());
    assert_eq!(
        rig.row_bounds(line).size.height,
        unwrapped,
        "the wrap toggle remeasures"
    );

    // Unwrapped, shift-wheel scrolls sideways (a narrow view is narrower than the widest line).
    rig.wheel(
        point(0., -5.),
        Modifiers {
            shift: true,
            ..Modifiers::default()
        },
    );
    cx = rig.close();

    // The pinned header follows the file at the top.
    let (mut rig, _) = Rig::open(cx, synthetic(1_000), vec![], DiffProps::default());
    let view = rig.view();
    assert_eq!(rig.cx.update(|cx| view.read(cx).pinned_file()), Some(0));
    for _ in 0..120 {
        rig.wheel(point(0., -3.), Modifiers::default());
    }
    let pinned = rig.cx.update(|cx| view.read(cx).pinned_file()).unwrap();
    assert!(
        pinned >= 1,
        "after scrolling past file 0, a later file's header is pinned ({pinned})"
    );
    cx = rig.close();

    // A thread draws under its line, inside the line's row (the web's line box holds its thread);
    // editing it gives a field whose text reaches the screen.
    let diff = synthetic(500);
    let comments = comments_for(&diff);
    let id = comments[0].id.clone();
    let (mut rig, _) = Rig::open(cx, diff, comments, DiffProps::default());
    let rows = rig.rows();
    let thread = first_row(&rows, |r| matches!(r, Row::Thread { .. }));
    assert!(
        matches!(rows[thread - 1], Row::Line { .. }),
        "the thread follows its line"
    );
    let bare = (0..rows.len())
        .find(|&i| {
            matches!(rows[i], Row::Line { .. })
                && !matches!(rows.get(i + 1), Some(Row::Thread { .. }))
        })
        .expect("a line with no thread");
    let line_h = rig.row_bounds(bare).size.height;
    let line = thread - 1;
    let plain = rig.row_bounds(line).size.height;
    assert!(plain > line_h, "the line's row holds its thread");
    rig.set_props(DiffProps {
        editing: Some(Editing {
            comment: id.clone(),
            body: "first".into(),
        }),
        ..DiffProps::default()
    });
    assert!(
        rig.row_bounds(line).size.height > plain,
        "the edit field makes the thread taller"
    );
    let mut field = rig.row_bounds(line);
    field.origin.y += line_h;
    field.size.height -= line_h;
    // The field is the card's body: a press in its middle focuses it.
    rig.click(field.center(), Modifiers::default());
    rig.events.borrow_mut().clear();
    rig.key("x");
    assert!(
        rig.events
            .borrow()
            .iter()
            .any(|e| matches!(e, DiffEvent::EditBody { text } if text.contains('x'))),
        "typing in the edit field reaches the screen: {:?}",
        rig.events.borrow()
    );
    rig.close()
}

/// A view wide enough shows each change as the old side beside the new side, and a click on either half names that
/// half's line; narrowing it again returns to one line per row.
fn split_layout(cx: HeadlessAppContext) -> HeadlessAppContext {
    let diff = synthetic(500);
    let path = diff.files[0].new_path.clone().unwrap();
    let (mut rig, _) = Rig::open_sized(cx, diff, vec![], DiffProps::default(), SPLIT);
    // The first draw measures the view; the rows are rebuilt as pairs for the next.
    rig.draw();
    let rows = rig.rows();
    assert!(
        rows.iter().all(|r| !matches!(r, Row::Line { .. })),
        "a wide view has no one-sided line rows"
    );
    let pair = first_row(&rows, |r| {
        matches!(
            r,
            Row::Pair {
                left: Some(_),
                right: Some(_),
                ..
            }
        )
    });
    let Row::Pair { left, right, .. } = rows[pair] else {
        unreachable!()
    };
    assert_ne!(
        left, right,
        "the first change pairs a deletion with an addition"
    );
    rig.shot("split");
    // The choice overrides the width, both ways.
    rig.set_props(DiffProps {
        layout: Layout::Unified,
        ..DiffProps::default()
    });
    rig.draw();
    assert!(
        rig.rows().iter().all(|r| !matches!(r, Row::Pair { .. })),
        "Unified keeps one line per row in a wide view"
    );
    rig.set_props(DiffProps::default());
    rig.draw();
    assert!(
        rig.rows().iter().any(|r| matches!(r, Row::Pair { .. })),
        "Auto splits a wide view again"
    );
    let bounds = rig.row_bounds(pair);
    let (quarter, three) = (bounds.size.width / 4., bounds.size.width * 3. / 4.);
    rig.events.borrow_mut().clear();
    rig.click(
        point(bounds.origin.x + quarter, bounds.center().y),
        Modifiers::default(),
    );
    assert!(
        matches!(
            rig.events.borrow().last(),
            Some(DiffEvent::SelectLine { side: ReviewSide::Old, path: p, .. }) if *p == path
        ),
        "the left half is the deleted line: {:?}",
        rig.events.borrow()
    );
    rig.click(
        point(bounds.origin.x + three, bounds.center().y),
        Modifiers::default(),
    );
    assert!(
        matches!(
            rig.events.borrow().last(),
            Some(DiffEvent::SelectLine {
                side: ReviewSide::New,
                ..
            })
        ),
        "the right half is the added line"
    );
    rig.close()
}

/// A new snapshot of the same comparison (what a stage, a refresh or any action brings) keeps the reader's place,
/// by file: rows added above it in an earlier file do not move them. Another comparison starts at the top.
fn keeps_place(cx: HeadlessAppContext) -> HeadlessAppContext {
    let (mut rig, _) = Rig::open(cx, synthetic(1_000), vec![], DiffProps::default());
    let rows = rig.rows();
    let header = rows
        .iter()
        .position(|r| *r == Row::File { file: 2 })
        .unwrap();
    let view = rig.view();
    rig.cx.update(|cx| {
        view.read(cx).list_state().scroll_to(gpui::ListOffset {
            item_ix: header + 30,
            offset_in_item: px(4.),
        })
    });
    rig.draw();
    // The same comparison again, with file 0 cut to one hunk: file 2's rows move up, the reader stays on them.
    let mut next = synthetic(1_000);
    next.files[0].hunks.truncate(1);
    rig.set_data(next.clone());
    let rows = rig.rows();
    let moved = rows
        .iter()
        .position(|r| *r == Row::File { file: 2 })
        .unwrap();
    assert!(moved < header, "file 2 starts earlier in the new rows");
    let top = rig.top();
    assert_eq!(
        (top.item_ix, top.offset_in_item),
        (moved + 30, px(4.)),
        "the reader stays 30 rows into file 2"
    );
    // Another comparison of the same files starts at the top.
    next.target = DiffTarget::Staged;
    rig.set_data(next);
    assert_eq!(rig.top().item_ix, 0, "a new comparison starts at the top");
    rig.close()
}

/// A wheel gesture moves one axis: a mostly sideways one scrolls only that file's lines, a mostly vertical one only
/// the list. Each file wider than the view shows a sideways scrollbar at the bottom of its part of the view, and
/// dragging its thumb scrolls that file.
fn one_axis_and_hbars(cx: HeadlessAppContext) -> HeadlessAppContext {
    const NARROW: f32 = 320.;
    let diff = synthetic(500);
    let path = diff.files[0].new_path.clone().unwrap();
    let (mut rig, _) = Rig::open_sized(cx, diff, vec![], DiffProps::default(), NARROW);
    let view = rig.view();
    let offset = |rig: &mut Rig| {
        let path = path.clone();
        rig.cx.update(|cx| view.read(cx).offset(&path))
    };
    let middle = point(px(NARROW / 2.), px(HEIGHT / 2.));
    let top = rig.top();
    rig.wheel_at(middle, point(-6., -1.), TouchPhase::Started);
    rig.wheel_at(middle, point(-6., -2.), TouchPhase::Moved);
    assert!(
        offset(&mut rig) > 0.,
        "a mostly sideways gesture scrolls the file"
    );
    let after = rig.top();
    assert_eq!(
        (after.item_ix, after.offset_in_item),
        (top.item_ix, top.offset_in_item),
        "and does not move the list"
    );
    let sideways = offset(&mut rig);
    rig.wheel_at(middle, point(-1., -6.), TouchPhase::Started);
    rig.wheel_at(middle, point(-2., -6.), TouchPhase::Moved);
    assert!(
        rig.top().item_ix > top.item_ix,
        "a mostly vertical gesture scrolls the list"
    );
    assert_eq!(
        offset(&mut rig),
        sideways,
        "and leaves the file where it was"
    );

    // File 0 runs past the view's bottom: its bar sits there, the thumb where the offset is.
    let bars = rig.cx.update(|cx| view.read(cx).hbars());
    let bar = bars
        .iter()
        .find(|b| b.path == path)
        .expect("file 0 has a sideways bar");
    assert_eq!(bar.track.bottom(), px(HEIGHT), "at the view's bottom");
    assert!(
        bar.thumb.left() > bar.track.left(),
        "the thumb shows the offset"
    );
    let before = offset(&mut rig);
    let (from, to) = (
        bar.thumb.center(),
        bar.thumb.center() - point(px(40.), px(0.)),
    );
    rig.drag(from, to);
    let dragged = offset(&mut rig);
    assert!(
        dragged < before && dragged > 0.,
        "dragging the thumb scrolls the file ({before} to {dragged})"
    );
    rig.close()
}

/// The compact unified layout, saved when `PERCH_DIFF_SHOTS` is set.
fn unified_shot(cx: HeadlessAppContext) -> HeadlessAppContext {
    let (mut rig, _) = Rig::open_sized(cx, synthetic(500), vec![], DiffProps::default(), 520.);
    rig.shot("unified");
    rig.close()
}

fn main() {
    let strict = std::env::var("PERCH_BUDGET_STRICT").is_ok_and(|v| v == "1");
    let report = std::env::var("PERCH_DIFF_REPORT").is_ok_and(|v| v == "1");
    let slack = if strict { 1. } else { 2. };
    let mut cx = new_context();
    // Debug builds are far slower than release; only a release build is held to the budgets.
    if cfg!(debug_assertions) {
        println!("diff_element: debug build, timings not checked (run with --release)");
    } else {
        cx = timings(cx, slack, report);
    }
    let cx = interactions(cx);
    let cx = split_layout(cx);
    let cx = keeps_place(cx);
    let cx = one_axis_and_hbars(cx);
    let _ = unified_shot(cx);
    println!("diff_element: ok");
}

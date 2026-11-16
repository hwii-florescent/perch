//! Spike: can a bare `gpui::list` carry a review diff within the budgets? Rows shaped like the web review's
//! (`review.tsx`: two line numbers, a marker and the code, 0.75rem mono at 1.5 line height, kind tints), with a
//! comment-thread row every 100 lines as the variable-height case, offscreen. Timed: creating the view to its first
//! drawn frame, then wheel steps (3 lines each, dispatched and drawn). `PERCH_SPIKE_LINES`, `PERCH_SPIKE_STEPS`,
//! `PERCH_SPIKE_WRAP=1`. Prints its numbers; fails at twice the budget, at the budget under `PERCH_BUDGET_STRICT=1`.

use gpui::{
    div, list, point, prelude::*, px, rgb, size, AnyElement, App, Context, HeadlessAppContext,
    ListAlignment, ListState, Modifiers, PlatformInput, SharedString, Window,
};
use std::rc::Rc;
use std::sync::Arc;
use std::time::{Duration, Instant};

const WIDTH: f32 = 1280.;
const HEIGHT: f32 = 800.;

enum Row {
    File(usize),
    Hunk(usize),
    Line {
        old: Option<u32>,
        new: Option<u32>,
        kind: u8,
        text: SharedString,
    },
    Thread,
}

fn rows(lines: usize, threads: bool) -> Vec<Row> {
    let mut out = Vec::with_capacity(lines + lines / 40 + lines / 100 + 8);
    let (mut old, mut new) = (1u32, 1u32);
    for i in 0..lines {
        if i % 250 == 0 {
            out.push(Row::File(i / 250));
        }
        if i % 40 == 0 {
            out.push(Row::Hunk(i / 40));
        }
        // 8 deletions, 8 additions, 24 context per hunk of 40, as the measured synthetic diff.
        let kind = match i % 40 {
            0..=7 => 1,
            8..=15 => 2,
            _ => 0,
        };
        let text: SharedString = format!(
            "    let value_{i} = compute(input.get({}), {});",
            i % 97,
            i % 13
        )
        .into();
        let (o, n) = match kind {
            1 => {
                old += 1;
                (Some(old - 1), None)
            }
            2 => {
                new += 1;
                (None, Some(new - 1))
            }
            _ => {
                old += 1;
                new += 1;
                (Some(old - 1), Some(new - 1))
            }
        };
        out.push(Row::Line {
            old: o,
            new: n,
            kind,
            text,
        });
        if threads && i % 100 == 50 {
            out.push(Row::Thread);
        }
    }
    out
}

struct Spike {
    state: ListState,
    rows: Rc<Vec<Row>>,
    wrap: bool,
}

fn number(n: Option<u32>) -> AnyElement {
    div()
        .w(px(40.))
        .pr(px(5.))
        .flex()
        .justify_end()
        .text_color(rgb(0x6c7086))
        .child(
            n.map(|n| SharedString::from(n.to_string()))
                .unwrap_or_default(),
        )
        .into_any_element()
}

impl Render for Spike {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        let rows = self.rows.clone();
        let wrap = self.wrap;
        div().id("diff").size_full().bg(rgb(0x1e1e2e)).text_color(rgb(0xcdd6f4)).font_family("Menlo")
            .text_size(px(12.)).line_height(px(18.))
            .child(list(self.state.clone(), move |ix, _, _| match &rows[ix] {
                Row::File(f) => div().px(px(11.)).py(px(5.)).bg(rgb(0x313244))
                    .child(SharedString::from(format!("src/module_{f}/file.rs"))).into_any_element(),
                Row::Hunk(h) => div().px(px(11.)).py(px(2.)).text_color(rgb(0x89b4fa))
                    .child(SharedString::from(format!("@@ -{h},40 +{h},40 @@"))).into_any_element(),
                Row::Line { old, new, kind, text } => {
                    let row = div().id(ix).flex().w_full()
                        .hover(|s| s.bg(rgb(0x2a2b3d)))
                        .child(number(*old)).child(number(*new))
                        .child(div().w(px(14.)).child(match kind { 1 => "−", 2 => "+", _ => " " }));
                    let row = match kind { 1 => row.bg(rgb(0x3a2530)), 2 => row.bg(rgb(0x253a2e)), _ => row };
                    let code = div().flex_1().min_w_0().child(text.clone());
                    let code = if wrap { code } else { code.whitespace_nowrap() };
                    row.child(code).into_any_element()
                }
                Row::Thread => div().ml(px(98.)).mr(px(11.)).my(px(4.)).p(px(8.)).rounded(px(6.))
                    .bg(rgb(0x313244)).flex().flex_col().gap(px(4.))
                    .child("Lines 50 · unresolved")
                    .child("A review note that says something about this line and wraps when it is long enough to reach the edge.")
                    .child(div().flex().gap(px(6.)).child("Edit").child("Resolve").child("Delete"))
                    .into_any_element(),
            }).size_full())
    }
}

fn env(name: &str, default: &str) -> String {
    std::env::var(name).unwrap_or_else(|_| default.into())
}

fn main() {
    let strict = std::env::var("PERCH_BUDGET_STRICT").is_ok_and(|v| v == "1");
    let slack = if strict { 1. } else { 2. };
    let steps: usize = env("PERCH_SPIKE_STEPS", "20").parse().unwrap();
    let wrap = env("PERCH_SPIKE_WRAP", "0") == "1";
    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    // The process's first window pays for fonts and shaders once (about 0.5 s cold); the app has paid it long
    // before a review opens, so it is timed apart and not held to the budget.
    let cold = Instant::now();
    let warm = cx
        .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
            cx.new(|_| Spike {
                state: ListState::new(1, ListAlignment::Top, px(400.)),
                rows: Rc::new(rows(1, false)),
                wrap,
            })
        })
        .unwrap();
    cx.update_window(warm.into(), |_, window: &mut Window, cx: &mut App| {
        let _ = window.draw(cx);
    })
    .unwrap();
    println!(
        "cold first window: {:.1} ms (not budgeted)",
        cold.elapsed().as_secs_f64() * 1000.
    );
    cx.update_window(warm.into(), |_, window: &mut Window, _| {
        window.remove_window()
    })
    .unwrap();
    let mut failed = Vec::new();
    for threads in [false, true] {
        for lines in env("PERCH_SPIKE_LINES", "500,5000,20000")
            .split(',')
            .map(|n| n.trim().parse::<usize>().unwrap())
        {
            let budget_open = match lines {
                0..=500 => 50.,
                501..=5000 => 150.,
                _ => 500.,
            };
            let started = Instant::now();
            let window = cx
                .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
                    cx.new(|_| {
                        let rows = Rc::new(rows(lines, threads));
                        let state = ListState::new(rows.len(), ListAlignment::Top, px(400.));
                        Spike { state, rows, wrap }
                    })
                })
                .unwrap();
            cx.update_window(window.into(), |_, window: &mut Window, cx: &mut App| {
                let _ = window.draw(cx);
            })
            .unwrap();
            let open = started.elapsed();
            let mut each: Vec<Duration> = Vec::with_capacity(steps);
            for _ in 0..steps {
                let t = Instant::now();
                cx.update_window(window.into(), |_, window: &mut Window, cx: &mut App| {
                    window.dispatch_event(
                        PlatformInput::ScrollWheel(gpui::ScrollWheelEvent {
                            position: point(px(WIDTH / 2.), px(HEIGHT / 2.)),
                            delta: gpui::ScrollDelta::Lines(point(0., -3.)),
                            modifiers: Modifiers::default(),
                            touch_phase: gpui::TouchPhase::Moved,
                        }),
                        cx,
                    );
                    let _ = window.draw(cx);
                })
                .unwrap();
                each.push(t.elapsed());
            }
            let top = cx
                .update_window(window.into(), |root, _, cx: &mut App| {
                    root.downcast::<Spike>()
                        .unwrap()
                        .read(cx)
                        .state
                        .logical_scroll_top()
                        .item_ix
                })
                .unwrap();
            assert!(
                top > steps,
                "{lines} lines: the wheel did not scroll (top row {top})"
            );
            let mean = each.iter().sum::<Duration>().as_secs_f64() * 1000. / steps as f64;
            let worst = each.iter().max().unwrap().as_secs_f64() * 1000.;
            let open_ms = open.as_secs_f64() * 1000.;
            println!("lines {lines:>6} threads {threads:<5} wrap {wrap:<5}: open {open_ms:7.1} ms (budget {budget_open}), wheel mean {mean:5.2} ms worst {worst:5.2} ms (budget 8)");
            if open_ms > budget_open * slack || mean > 8. * slack {
                failed.push(format!("{lines} lines threads {threads}"));
            }
            cx.update_window(window.into(), |_, window: &mut Window, _| {
                window.remove_window()
            })
            .unwrap();
            cx.run_until_parked();
        }
    }
    assert!(failed.is_empty(), "over budget (x{slack}): {failed:?}");
}

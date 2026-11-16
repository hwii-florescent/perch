//! The stock sidebar's budget at the owner's shape (10 projects, 44 sessions, 10 of them
//! sub-sessions of one lead) on the React runtime, offscreen, no core. Prints first draw, a status
//! update that re-sorts a row, a refresh frame, and RSS with the sidebar and Settings.
//!
//! A release measurement (`cargo test --release -p perch-native --test screen_engine_measure`); a
//! debug build only says so, as its unoptimised glue cannot meet the shipped script budgets at
//! this shape. Asserted: the sidebar loads within the shipped budgets and draws every row, status
//! changes stay within them, a frame that changes nothing runs no script, and the times stay under
//! ceilings that catch a regression. The owner's targets are printed as met or missed.

use futures::channel::mpsc::unbounded;
use gpui::{px, size, AppContext as _, HeadlessAppContext, Window, WindowHandle};
use gpui_shell::probe::{self, ProbeRecord};
use perch_core::protocol::ServerMessage;
use perch_native::client::Update;
use perch_native::mods::{self, WindowMods, POLL};
use perch_native::sidebar::State;
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

const WIDTH: f32 = 1100.;
const HEIGHT: f32 = 1400.;
const SESSIONS: usize = 44;
const PROJECTS: usize = 10;
const KIDS: usize = 10;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

fn project(p: usize) -> Value {
    json!({"id": format!("p{p}"), "hostId": "local", "name": format!("project-{p}"),
           "path": format!("/code/project-{p}"), "favorite": p < 2, "createdAt": p, "updatedAt": 0})
}

/// `tick` moves which sessions are running, so each tick is one status change for the sidebar.
fn state(sessions: usize, tick: usize) -> State {
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "server.info", "hostname": "studio", "isSsh": false, "platform": "macOS",
        "capabilities": ["workspace.snapshot"]})));
    let projects: Vec<Value> = (0..PROJECTS).map(project).collect();
    state.apply(&message(json!({
        "type": "project.list", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": projects})));
    let mut checkouts = vec![];
    for p in 0..PROJECTS {
        for w in 0..(if p < 3 { 2 } else { 1 }) {
            let path = format!("/code/project-{p}{}", if w == 1 { "-wt" } else { "" });
            checkouts.push(
                json!({"id": format!("w{p}-{w}"), "projectId": format!("p{p}"),
                "hostId": "local", "path": path, "name": format!("w{p}-{w}"), "dirty": w == 0,
                "state": "active", "createdAt": 0, "updatedAt": 0, "pinned": false}),
            );
        }
    }
    state.apply(&message(json!({
        "type": "workspace.snapshot", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": projects, "workspaces": checkouts})));
    let list: Vec<Value> = (0..sessions)
        .map(|n| {
            let p = if n <= KIDS { 0 } else { n % PROJECTS };
            let cwd = format!(
                "/code/project-{p}{}",
                if p < 3 && n % 2 == 1 { "-wt" } else { "" }
            );
            let busy = n == 12 + tick % 20 || n.is_multiple_of(4);
            let mut session = json!({
                "id": format!("s{n}"), "title": format!("Session {n} doing some real work here"),
                "cwd": cwd, "createdAt": n, "status": if busy { "running" } else { "idle" },
                "hostId": "local", "projectId": format!("p{p}"),
                "cliProviderId": if n % 3 == 0 { "codex" } else { "claude" }});
            if (1..=KIDS).contains(&n) {
                session["parentSessionId"] = json!("s0");
            }
            session
        })
        .collect();
    state.apply(&message(json!({"type": "session.list", "sessions": list})));
    state
}

struct Rig {
    cx: HeadlessAppContext,
    window: WindowHandle<Workspace>,
}

impl Rig {
    fn ws<R>(
        &mut self,
        f: impl FnOnce(&mut Workspace, &mut Window, &mut gpui::Context<Workspace>) -> R,
    ) -> R {
        self.window
            .update(&mut self.cx, |ws, window, cx| f(ws, window, cx))
            .unwrap()
    }

    fn settle(&mut self) -> Vec<ProbeRecord> {
        for _ in 0..3 {
            self.cx.advance_clock(POLL);
            self.cx.run_until_parked();
            self.draw_frame(true);
        }
        probe::records().into_values().collect()
    }

    fn draw_frame(&mut self, refresh: bool) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                probe::clear();
                if refresh {
                    window.refresh();
                }
                let _ = window.draw(cx);
            })
            .unwrap();
    }

    /// Session rows drawn: by parity name, or (names off, as a release build) by test id.
    fn rows(&self) -> usize {
        probe::records()
            .keys()
            .filter(|name| {
                name.starts_with("session-button:")
                    || (name.contains(":workspace-session-s") && !name.contains("-close-"))
            })
            .count()
    }

    fn metrics(&mut self) -> gpui_shell::RuntimeMetrics {
        self.cx
            .update(|cx| cx.global::<WindowMods>().host.metrics())
    }
}

fn rss_mb() -> f64 {
    let out = std::process::Command::new("ps")
        .args(["-o", "rss=", "-p", &std::process::id().to_string()])
        .output()
        .unwrap();
    String::from_utf8_lossy(&out.stdout)
        .trim()
        .parse::<f64>()
        .unwrap()
        / 1024.
}

fn ms(d: Duration) -> String {
    format!("{:.1} ms", d.as_secs_f64() * 1000.)
}

fn main() {
    if cfg!(debug_assertions) {
        println!("screen_engine_measure: a release measurement; run it with --release");
        return;
    }
    let sessions: usize = std::env::var("PERCH_MEASURE_SESSIONS")
        .ok()
        .and_then(|n| n.parse().ok())
        .unwrap_or(SESSIONS);
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-screen-measure-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    let user = scratch.join("native-mods");
    // A patched copy of a stock screen (a user override), for measurement probes.
    if let Some(dir) = std::env::var_os("PERCH_MEASURE_OVERRIDE") {
        std::fs::create_dir_all(&user).unwrap();
        let status = std::process::Command::new("cp")
            .arg("-R")
            .arg(&dir)
            .arg(user.join("sidebar"))
            .status()
            .unwrap();
        assert!(status.success());
    }

    // A release build works out no parity names (`gpui_shell::probing`); time that unless asked.
    probe::set_named(std::env::var_os("PERCH_MEASURE_NAMES").is_some());
    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let (tx, _asked) = unbounded();
    let model = state(sessions, 0).model();
    let window = cx
        .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    let mut rig = Rig { cx, window };
    rig.draw_frame(true);
    let rss_window = rss_mb();
    let started = Instant::now();
    rig.cx
        .update(|cx| mods::start_in(user.clone(), &workspace, window.into(), cx));
    let loaded = started.elapsed();
    let before = rig.metrics();
    let (mut timers, mut frames, mut rounds) = (Duration::ZERO, Duration::ZERO, 0);
    loop {
        rounds += 1;
        let t = Instant::now();
        rig.cx.advance_clock(POLL);
        rig.cx.run_until_parked();
        timers += t.elapsed();
        let t = Instant::now();
        rig.draw_frame(false);
        frames += t.elapsed();
        if rig.rows() == sessions || rounds > 20 {
            break;
        }
    }
    let first = started.elapsed();
    let spent = rig.metrics().since(&before);
    assert_eq!(rig.rows(), sessions, "every session has a row");
    let error = rig.ws(|ws, _, cx| ws.screen_error("sidebar", cx));
    assert_eq!(error, None, "the sidebar loads within the shipped budgets");
    let rss_sidebar = rss_mb();
    println!(
        "sessions {sessions}: first draw {} in {rounds} rounds (mods start {}, timers/tasks {}, frames {}); \
         script renders {}, script render {} (slowest {}), materialize {} ({}); error {error:?}",
        ms(first),
        ms(loaded),
        ms(timers),
        ms(frames),
        spent.script_renders(),
        ms(spent.script_render_time()),
        ms(spent.slowest_script_render()),
        ms(spent.materialize_time()),
        spent.materializations()
    );

    type Row = (
        Duration,
        Duration,
        Duration,
        Duration,
        Duration,
        Duration,
        u64,
    );
    let mut out: Vec<Row> = vec![];
    for tick in 1..=20 {
        let model = state(sessions, tick).model();
        let before = rig.metrics();
        let t = Instant::now();
        rig.ws(|ws, _, cx| {
            ws.sidebar()
                .update(cx, |sidebar, cx| sidebar.apply(Update::Model(model), cx))
        });
        rig.draw_frame(false);
        let notice = t.elapsed();
        let t2 = Instant::now();
        rig.cx.advance_clock(Duration::from_millis(1));
        rig.cx.run_until_parked();
        let timer = t2.elapsed();
        let t3 = Instant::now();
        rig.draw_frame(false);
        let drawn = t3.elapsed();
        let spent = rig.metrics().since(&before);
        out.push((
            t.elapsed(),
            notice,
            timer,
            drawn,
            spent.script_render_time(),
            spent.materialize_time(),
            spent.script_renders(),
        ));
    }
    let med = |f: fn(&Row) -> Duration| {
        let mut v: Vec<Duration> = out.iter().map(f).collect();
        v.sort();
        v[v.len() / 2]
    };
    println!(
        "update (median of 20): {} = notice frame {} + catch-up timer (React + describe) {} + draw frame {}; \
         script render {} over {} renders, materialize {}; worst {}",
        ms(med(|r| r.0)),
        ms(med(|r| r.1)),
        ms(med(|r| r.2)),
        ms(med(|r| r.3)),
        ms(med(|r| r.4)),
        out[0].6,
        ms(med(|r| r.5)),
        ms(out.iter().map(|r| r.0).max().unwrap())
    );
    let error = rig.ws(|ws, _, cx| ws.screen_error("sidebar", cx));
    assert_eq!(
        error, None,
        "status changes stay within the shipped budgets"
    );
    let before = rig.metrics();
    let t = Instant::now();
    for _ in 0..10 {
        rig.draw_frame(true);
    }
    let spent = rig.metrics().since(&before);
    assert_eq!(
        spent.script_renders(),
        0,
        "a frame that changes nothing runs no script"
    );
    let refresh = t.elapsed() / 10;
    println!(
        "refresh frame (mean of 10): {}; script render {}, materialize {} per frame; error {error:?}",
        ms(refresh),
        ms(spent.script_render_time() / 10),
        ms(spent.materialize_time() / 10)
    );
    rig.ws(|ws, window, cx| ws.run_command("global.settings", None, window, cx))
        .unwrap();
    let t = Instant::now();
    rig.settle();
    let settings = t.elapsed();
    let rss_settings = rss_mb();
    println!(
        "settings open {}; RSS MB: window {rss_window:.1}, + sidebar {rss_sidebar:.1}, + settings {rss_settings:.1}",
        ms(settings)
    );
    let _ = std::fs::remove_dir_all(&scratch);

    let update = med(|r| r.0);
    for (what, took, target) in [
        ("first draw", first, 150),
        ("update", update, 8),
        ("refresh frame", refresh, 16),
    ] {
        let met = took <= Duration::from_millis(target);
        println!(
            "target {what} under {target} ms: {}",
            if met { "met" } else { "missed" }
        );
    }
    // Regression ceilings, about twice what an M4 Pro measures today: tighten them as the engine
    // gets faster.
    if sessions == SESSIONS {
        for (what, took, ceiling) in [
            ("first draw", first, 1300),
            ("update", update, 110),
            ("refresh frame", refresh, 25),
        ] {
            assert!(
                took <= Duration::from_millis(ceiling),
                "{what} took {} (ceiling {ceiling} ms)",
                ms(took)
            );
        }
    }
}

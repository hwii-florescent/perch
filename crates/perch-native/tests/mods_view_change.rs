//! What a view change costs on the main thread with the stock screens at the owner's shape (10
//! projects, 44 sessions, 7 tabs open, plain terminals listed): switching a tab, opening a session
//! and a file, closing a tab, folding and unfolding every project, Show terminals, and Settings.
//! Each action is timed from the command to the window settled (the React catch-up timers run and
//! the next frame drawn); the median of several repeats must stay under the budget.
//!
//! A release measurement (`cargo test --release -p perch-native --test mods_view_change`); a debug
//! build only says so. Offscreen, no core.

use futures::channel::mpsc::unbounded;
use gpui::{px, size, AppContext as _, HeadlessAppContext, Window, WindowHandle};
use perch_core::protocol::ServerMessage;
use perch_native::mods::{self, WindowMods, POLL};
use perch_native::sidebar::State;
use perch_native::ui::Workspace;
use serde_json::{json, Value};
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

/// The owner's target for each action's main-thread time.
const BUDGET: Duration = Duration::from_millis(50);
const REPEATS: usize = 5;

struct Rig {
    cx: HeadlessAppContext,
    window: WindowHandle<Workspace>,
}

impl Rig {
    fn draw(&mut self) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                let _ = window.draw(cx);
            })
            .unwrap();
    }

    /// Runs what is due and draws, until a turn has nothing left to do.
    fn settle(&mut self) {
        for _ in 0..4 {
            self.cx.advance_clock(Duration::from_millis(1));
            self.cx.run_until_parked();
            self.draw();
        }
    }

    fn command(&mut self, name: &str, args: Value) {
        let result = self
            .window
            .update(&mut self.cx, |ws, window, cx| {
                ws.run_command(name, Some(&args), window, cx)
            })
            .unwrap();
        assert!(result.is_ok(), "{name} {args}: {result:?}");
    }

    fn sidebar(&mut self, patch: impl FnOnce(&mut perch_native::mods::perch::SidebarSettings)) {
        self.cx.update(|cx| {
            let perch = cx.global::<WindowMods>().perch.clone();
            let mut settings = perch.sidebar();
            patch(&mut settings);
            perch.set_sidebar(settings);
            perch.flush(cx);
        });
    }

    fn metrics(&mut self) -> gpui_shell::RuntimeMetrics {
        self.cx
            .update(|cx| cx.global::<WindowMods>().host.metrics())
    }

    /// The action's script time on the main thread and its wall time, from the call to the
    /// window settled (the frames drawn on the way included).
    fn time(&mut self, action: impl FnOnce(&mut Self)) -> (Duration, Duration) {
        self.settle();
        let before = self.metrics();
        let started = Instant::now();
        action(self);
        self.draw();
        self.settle();
        let wall = started.elapsed();
        (self.metrics().since(&before).script_time(), wall)
    }

    fn error(&mut self, id: &str) -> Option<String> {
        self.window
            .update(&mut self.cx, |ws, _, cx| ws.screen_error(id, cx))
            .unwrap()
    }
}

fn main() {
    if cfg!(debug_assertions) {
        println!("mods_view_change: a release measurement; run it with --release");
        return;
    }
    let scratch = std::env::temp_dir().join(format!("perch-view-change-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    // A release build of the app works out no parity names (`gpui_shell::probing`): time what it does.
    gpui_shell::probe::set_named(std::env::var_os("PERCH_VIEW_CHANGE_NAMES").is_some());
    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let (tx, _asked) = unbounded();
    let model = state(SESSIONS, 0).model();
    let window = cx
        .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    let user = scratch.join("native-mods");
    cx.update(|cx| mods::start_in(user, &workspace, window.into(), cx));
    let mut rig = Rig { cx, window };
    for _ in 0..8 {
        rig.cx.advance_clock(POLL);
        rig.cx.run_until_parked();
        rig.draw();
    }
    let tabs: Vec<String> = (0..7).map(|n| format!("s{n}")).collect();
    for id in &tabs {
        rig.command("session.open", json!({"id": id}));
        rig.settle();
    }
    rig.sidebar(|s| s.show_terminals = true);
    rig.settle();
    // A sub-session opens in its parent's tab: switch between the tabs the strip has.
    let tabs: Vec<String> = rig
        .window
        .update(&mut rig.cx, |ws, _, _| ws.tabs().strip().to_vec())
        .unwrap();
    println!("tabs open: {}", tabs.len());

    let mut results: Vec<(&str, Vec<(Duration, Duration)>)> = vec![];
    let trace = std::env::var_os("PERCH_VIEW_CHANGE_TRACE").is_some();
    let mut record = |name: &'static str, took: (Duration, Duration)| {
        if trace {
            eprintln!(
                "== {name} script {:.1} ms, wall {:.1} ms",
                took.0.as_secs_f64() * 1000.,
                took.1.as_secs_f64() * 1000.
            );
        }
        match results.iter_mut().find(|(n, _)| *n == name) {
            Some((_, v)) => v.push(took),
            None => results.push((name, vec![took])),
        }
    };
    let projects: Vec<String> = (0..PROJECTS).map(|p| format!("p{p}")).collect();
    for i in 0..REPEATS {
        let id = tabs[(i + 1) % tabs.len()].clone();
        record(
            "tab switch",
            rig.time(|r| r.command("tab.select", json!({"id": id}))),
        );
        let other = format!("s{}", 20 + i);
        record(
            "session open",
            rig.time(|r| r.command("session.open", json!({"id": other}))),
        );
        record(
            "close tab",
            rig.time(|r| r.command("tab.close", json!({"id": other}))),
        );
        let all = projects.clone();
        record(
            "fold all",
            rig.time(|r| r.sidebar(|s| s.collapsed_projects = all)),
        );
        record(
            "unfold all",
            rig.time(|r| r.sidebar(|s| s.collapsed_projects = vec![])),
        );
        record(
            "hide terminals",
            rig.time(|r| r.sidebar(|s| s.show_terminals = false)),
        );
        record(
            "show terminals",
            rig.time(|r| r.sidebar(|s| s.show_terminals = true)),
        );
        record(
            "open file",
            rig.time(|r| {
                r.command(
                    "file.open",
                    json!({"workspaceId": "w0-0", "path": "src/main.rs"}),
                )
            }),
        );
        record(
            "close file",
            rig.time(|r| r.command("tab.close", json!({}))),
        );
        record(
            "settings",
            rig.time(|r| r.command("global.settings", json!({}))),
        );
        record(
            "settings close",
            rig.time(|r| r.command("overlay.close", json!({}))),
        );
    }
    let _ = std::fs::remove_dir_all(&scratch);
    for id in ["sidebar", "tabs", "status"] {
        assert_eq!(rig.error(id), None, "{id} stays loaded");
    }
    let ms = |d: Duration| d.as_secs_f64() * 1000.;
    // The screens are loaded and answer a tab switch at all (a mod that failed to load runs no script).
    let switched = results.iter().find(|(n, _)| *n == "tab switch").unwrap();
    assert!(
        switched.1.iter().filter(|t| t.0 > Duration::ZERO).count() > switched.1.len() / 2,
        "the screens run on a tab switch"
    );
    let mut over = vec![];
    for (name, times) in results {
        let median = |f: fn(&(Duration, Duration)) -> Duration| {
            let mut v: Vec<Duration> = times.iter().map(f).collect();
            v.sort();
            v[v.len() / 2]
        };
        let script = median(|t| t.0);
        println!(
            "{name:>15}: script median {:6.1} ms (worst {:6.1}), wall median {:6.1} ms",
            ms(script),
            ms(times.iter().map(|t| t.0).max().unwrap()),
            ms(median(|t| t.1))
        );
        if script > BUDGET {
            over.push(format!("{name} {:.1} ms", ms(script)));
        }
    }
    assert!(
        over.is_empty(),
        "over the {} ms budget: {}",
        BUDGET.as_millis(),
        over.join(", ")
    );
}

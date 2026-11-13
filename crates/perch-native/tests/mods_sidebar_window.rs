//! The sidebar in a real window: the stock `sidebar` mod takes the sidebar's place and shows what the
//! core's messages say. Titles are listed, a state is a badge (none for idle), a disconnected computer
//! keeps its rows with no state claimed, a picked session opens with its provider, a sub-session sits
//! under its lead, By status lists Needs you first, and a project header folds only a project with
//! checkouts to fold away. A user copy of the stock folder replaces it and reloads on save; a sidebar
//! that cannot load leaves the window usable, with the reason in the sidebar's place.
//!
//! Offscreen, as the other render tests: no window is shown or focused, no core runs, and every event
//! goes through the window's own dispatch.

use futures::channel::mpsc::{unbounded, UnboundedReceiver};
use gpui::{
    px, size, AppContext as _, HeadlessAppContext, Modifiers, MouseButton, MouseDownEvent,
    MouseUpEvent, PlatformInput, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_core::protocol::ServerMessage;
use perch_native::client::{Command, Update};
use perch_native::mods::{self, WindowMods, POLL};
use perch_native::sidebar::State;
use perch_native::ui::{OpenSession, Workspace, SIDEBAR_WIDTH};
use serde_json::{json, Value};
use std::cell::RefCell;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::sync::Arc;
use std::time::Duration;

const WIDTH: f32 = 900.;
const HEIGHT: f32 = 600.;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

fn project() -> Value {
    json!({"id": "p", "hostId": "local", "name": "Work", "path": "/work", "favorite": false,
           "createdAt": 0, "updatedAt": 0})
}

/// One project, holding a session per `(title, flags)`.
fn state(sessions: &[(&str, Value)]) -> State {
    let mut state = State::default();
    state.connect();
    // The core says it keeps workspaces, as every current core does; the sidebar lists projects then.
    state.apply(&message(json!({
        "type": "server.info", "hostname": "studio", "isSsh": false, "platform": "macOS",
        "capabilities": ["workspace.snapshot"]})));
    state.apply(&message(json!({
        "type": "project.list", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [project()]})));
    state.apply(&message(json!({
        "type": "workspace.snapshot", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [project()], "workspaces": [checkout("w1", json!({}))]})));
    let sessions: Vec<Value> = sessions
        .iter()
        .map(|(title, flags)| {
            let mut session = json!({
                "id": title, "title": title, "cwd": "/work", "createdAt": 0, "status": "idle",
                "hostId": "local", "projectId": "p", "cliProviderId": "claude"});
            for (key, value) in flags.as_object().unwrap() {
                session[key] = value.clone();
            }
            session
        })
        .collect();
    state.apply(&message(
        json!({"type": "session.list", "sessions": sessions}),
    ));
    state
}

fn idle(titles: &[&'static str]) -> Vec<(&'static str, Value)> {
    titles.iter().map(|t| (*t, json!({}))).collect()
}

/// A checkout of project `p`, at `/work` unless `extra` says otherwise.
fn checkout(id: &str, extra: Value) -> Value {
    let mut value = json!({"id": id, "projectId": "p", "hostId": "local", "path": "/work",
        "name": id, "dirty": false, "state": "active", "createdAt": 0, "updatedAt": 0,
        "pinned": false});
    for (k, v) in extra.as_object().unwrap() {
        value[k] = v.clone();
    }
    value
}

/// `alpha` and `bravo` in project `p`, whose checkouts are `checkouts`.
fn with_checkouts(checkouts: Vec<Value>) -> State {
    let mut listed = state(&idle(&["alpha", "bravo"]));
    listed.apply(&message(json!({
        "type": "workspace.snapshot", "requestId": "r", "hostId": "local",
        "snapshotEpoch": "e", "snapshotRevision": 2, "projects": [project()],
        "workspaces": checkouts})));
    listed
}

struct Rig {
    cx: HeadlessAppContext,
    window: WindowHandle<Workspace>,
    asked: UnboundedReceiver<Command>,
    user: PathBuf,
    opened: Rc<RefCell<Vec<OpenSession>>>,
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

    /// The window's sidebar follows `state`, as it follows the core.
    fn show(&mut self, state: &State) {
        let model = state.model();
        self.ws(|ws, _, cx| {
            ws.sidebar()
                .update(cx, |sidebar, cx| sidebar.apply(Update::Model(model), cx))
        });
    }

    /// Draws the window afresh, letting mod loads, React's commits and deferred calls settle
    /// first, and returns what the mod named.
    fn draw(&mut self) -> Vec<ProbeRecord> {
        for _ in 0..3 {
            self.cx.advance_clock(POLL);
            self.cx.run_until_parked();
            self.cx
                .update_window(self.window.into(), |_, window: &mut Window, cx| {
                    probe::clear();
                    window.refresh();
                    let _ = window.draw(cx);
                })
                .unwrap();
        }
        probe::records().into_values().collect()
    }

    fn record(&mut self, name: &str) -> Option<ProbeRecord> {
        self.draw().into_iter().find(|r| r.name == name)
    }

    /// The keys of the records named `name:<key>`, top to bottom.
    fn keys(&mut self, name: &str) -> Vec<String> {
        let prefix = format!("{name}:");
        let mut found: Vec<(f32, String)> = self
            .draw()
            .into_iter()
            .filter_map(|r| {
                let key = r.name.strip_prefix(prefix.as_str())?.to_string();
                Some((f32::from(r.bounds.origin.y), key))
            })
            .collect();
        found.sort_by(|a, b| a.0.total_cmp(&b.0));
        found.into_iter().map(|(_, key)| key).collect()
    }

    /// A left press and release in the middle of `name`, through the window's dispatch.
    fn click(&mut self, name: &str) {
        let at = self
            .record(name)
            .unwrap_or_else(|| panic!("{name} is drawn"))
            .bounds
            .center();
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_event(
                    PlatformInput::MouseDown(MouseDownEvent {
                        button: MouseButton::Left,
                        position: at,
                        modifiers: Modifiers::default(),
                        click_count: 1,
                        first_mouse: false,
                    }),
                    cx,
                );
                window.dispatch_event(
                    PlatformInput::MouseUp(MouseUpEvent {
                        button: MouseButton::Left,
                        position: at,
                        modifiers: Modifiers::default(),
                        click_count: 1,
                    }),
                    cx,
                );
            })
            .unwrap();
        self.cx.run_until_parked();
    }

    /// Pixels in the sidebar's place within 2 of `color`, in the window's last frame.
    fn sidebar_pixels(&mut self, color: u32) -> usize {
        self.draw();
        let (image, scale) = self
            .cx
            .update_window(self.window.into(), |_, window: &mut Window, _| {
                (
                    window.render_to_image().expect("offscreen render"),
                    window.scale_factor(),
                )
            })
            .unwrap();
        let edge = (SIDEBAR_WIDTH * scale) as usize;
        let width = image.width() as usize;
        let want = [(color >> 16) as u8, (color >> 8) as u8, color as u8];
        image
            .into_raw()
            .chunks_exact(4)
            .enumerate()
            .filter(|(i, p)| {
                i % width < edge && p[..3].iter().zip(want).all(|(a, b)| a.abs_diff(b) <= 2)
            })
            .count()
    }

    /// The window's sidebar: the mod view in its place.
    fn sidebar_view(&mut self) -> gpui::Entity<mods::ModView> {
        self.ws(|ws, _, _| ws.screen_view("sidebar"))
            .expect("the sidebar mod is placed")
    }

    fn sidebar_error(&mut self) -> Option<String> {
        let view = self.sidebar_view();
        self.cx.update(|cx| view.read(cx).error(cx))
    }

    /// Waits out the poll the window looks at mod folders with.
    fn settle_files(&mut self) {
        std::thread::sleep(POLL + Duration::from_millis(20));
        self.draw();
    }
}

fn copy_dir(from: &Path, to: &Path) {
    std::fs::create_dir_all(to).unwrap();
    for entry in std::fs::read_dir(from).unwrap().flatten() {
        let path = entry.path();
        if path.is_dir() {
            copy_dir(&path, &to.join(entry.file_name()));
        } else {
            std::fs::copy(&path, to.join(entry.file_name())).unwrap();
        }
    }
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-sidebar-window-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    let user = scratch.join("native-mods");

    // A user sidebar that throws while loading is in place before the window opens.
    std::fs::create_dir_all(user.join("sidebar")).unwrap();
    std::fs::write(
        user.join("sidebar/main.js"),
        "throw new Error(\"broken on purpose\");\n",
    )
    .unwrap();

    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let (tx, asked) = unbounded();
    let model = state(&idle(&["alpha"])).model();
    let window = cx
        .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user.clone(), &workspace, window.into(), cx));
    let opened: Rc<RefCell<Vec<OpenSession>>> = Rc::default();
    let _opened = cx.update(|cx| {
        let opened = opened.clone();
        let sidebar = workspace.read(cx).sidebar().clone();
        cx.subscribe(&sidebar, move |_, event: &OpenSession, _| {
            opened.borrow_mut().push(event.clone())
        })
    });
    let mut rig = Rig {
        cx,
        window,
        asked,
        user,
        opened,
    };

    // The window tells the core whether it is the one being looked at, with no sidebar view.
    rig.draw();
    let asked: Vec<Command> = std::iter::from_fn(|| rig.asked.try_recv().ok()).collect();
    assert!(
        asked.iter().any(|c| matches!(c, Command::WindowActive(_))),
        "window activation reaches the core: {asked:?}"
    );

    // A sidebar that never loaded: its place says why, in the error colour, and the window works.
    let error = rig.sidebar_error().expect("the broken sidebar's error");
    assert!(error.contains("broken on purpose"), "{error}");
    assert!(
        rig.sidebar_pixels(0xe5484d) > 50,
        "the reason is drawn in the sidebar's place"
    );
    rig.ws(|ws, _, cx| {
        ws.sidebar().update(cx, |s, cx| {
            s.open("local".into(), "alpha".into(), Some("claude".into()), cx)
        })
    });
    rig.draw();
    assert_eq!(
        rig.ws(|ws, _, _| ws.tabs().strip().to_vec()),
        ["alpha"],
        "a session still opens"
    );
    // Removing the broken copy brings the stock sidebar back without a restart.
    std::fs::remove_dir_all(rig.user.join("sidebar")).unwrap();
    rig.settle_files();
    assert_eq!(rig.sidebar_error(), None, "the stock sidebar loads");
    let root = rig.record("sidebar-root").expect("the stock sidebar draws");
    assert_eq!(
        (root.bounds.origin.x, root.bounds.size.width),
        (px(0.), px(SIDEBAR_WIDTH)),
        "in the sidebar's place"
    );
    println!("mods_sidebar_window: failure and recovery ok");

    // Titles are listed: none, one, three, and each by its own title.
    rig.show(&state(&[]));
    assert_eq!(rig.keys("session-title"), Vec::<String>::new());
    rig.show(&state(&idle(&["alpha"])));
    assert_eq!(rig.keys("session-title"), ["alpha"]);
    rig.show(&state(&idle(&["alpha", "bravo", "charlie"])));
    assert_eq!(rig.keys("session-title").len(), 3);
    rig.show(&state(&idle(&["bravo"])));
    assert_eq!(rig.keys("session-title"), ["bravo"]);

    // A state is a badge of its own: needs you, done and working each have one, in their own
    // colours, and idle has none.
    rig.show(&state(&[
        ("ask", json!({"blocked": true})),
        ("seen", json!({"unseen": true})),
        ("busy", json!({"status": "running"})),
        ("quiet", json!({})),
    ]));
    let mut badges = rig.keys("session-state-badge");
    badges.sort();
    assert_eq!(badges, ["ask", "busy", "seen"], "idle has no badge");
    let fills: Vec<_> = ["ask", "seen", "busy"]
        .iter()
        .map(|id| {
            rig.record(&format!("session-state-badge:{id}"))
                .unwrap()
                .background
                .unwrap_or_else(|| panic!("{id}'s badge is filled"))
        })
        .collect();
    assert!(
        fills[0] != fills[1] && fills[1] != fills[2] && fills[0] != fills[2],
        "each state has its own fill: {fills:?}"
    );

    // The Needs you button opens the session that needs you.
    rig.opened.borrow_mut().clear();
    rig.click("needs-you-button");
    assert_eq!(
        rig.opened.borrow().last().map(|o| o.session_id.clone()),
        Some("ask".into()),
        "global.needsYou reached the window"
    );

    // Disconnected: the row is still there, with no state claimed.
    let mut dropped = state(&[("ask", json!({"blocked": true}))]);
    dropped.disconnect(Some("connection refused".into()));
    rig.show(&dropped);
    assert_eq!(
        rig.keys("session-title"),
        ["ask"],
        "the last-known row is listed"
    );
    assert!(
        rig.keys("session-state-badge").is_empty(),
        "no state claimed"
    );

    // Picking a session opens it, with the provider it runs.
    rig.show(&state(&idle(&["alpha", "bravo"])));
    rig.opened.borrow_mut().clear();
    rig.click("session-button:bravo");
    let picked = rig.opened.borrow().last().cloned().expect("bravo opened");
    assert_eq!(
        (
            picked.session_id.as_str(),
            picked.title.as_str(),
            picked.provider_id.as_deref()
        ),
        ("bravo", "bravo", Some("claude"))
    );
    assert_eq!(
        rig.ws(|ws, _, _| ws.open().map(|o| o.session_id.clone())),
        Some("bravo".into())
    );
    // A session just launched is not listed yet: the launch says what it runs.
    rig.ws(|ws, _, cx| {
        ws.sidebar().update(cx, |s, cx| {
            s.open("local".into(), "new".into(), Some("codex".into()), cx)
        })
    });
    let fresh = rig.opened.borrow().last().cloned().unwrap();
    assert_eq!(
        (fresh.title.as_str(), fresh.provider_id.as_deref()),
        ("New session", Some("codex"))
    );

    // A sub-session sits indented under its lead; two sessions side by side line up.
    let x = |rig: &mut Rig, id: &str| {
        f32::from(
            rig.record(&format!("session-title:{id}"))
                .unwrap_or_else(|| panic!("{id} is listed"))
                .bounds
                .origin
                .x,
        )
    };
    rig.show(&state(&[
        ("lead", json!({})),
        ("kid", json!({"parentSessionId": "lead"})),
    ]));
    let (lead, kid) = (x(&mut rig, "lead"), x(&mut rig, "kid"));
    assert!(
        kid >= lead + 8.,
        "the sub-session is indented: {lead} {kid}"
    );
    rig.show(&state(&idle(&["lead", "kid"])));
    let (lead, kid) = (x(&mut rig, "lead"), x(&mut rig, "kid"));
    assert!((kid - lead).abs() <= 3., "two chats line up: {lead} {kid}");

    // By status regroups the same chats by state, Needs you first, whatever order the core
    // listed them in; the project view (sorted by attention off) keeps the core's order.
    let perch = rig.cx.update(|cx| cx.global::<WindowMods>().perch.clone());
    let mut settings = perch.sidebar();
    settings.sort_by_attention = false;
    perch.set_sidebar(settings);
    rig.cx.update(|cx| perch.flush(cx));
    rig.show(&state(&[
        ("busy", json!({"status": "running"})),
        ("quiet", json!({})),
        ("stuck", json!({"blocked": true})),
    ]));
    assert!(rig.record("status-view").is_none());
    assert_eq!(rig.keys("session-title"), ["busy", "quiet", "stuck"]);
    rig.ws(|ws, window, cx| ws.run_command("sidebar.organize", None, window, cx))
        .expect("sidebar.organize runs from the window");
    assert_eq!(perch.sidebar().organize, "status");
    assert!(rig.record("status-view").is_some(), "By status is shown");
    let sections = rig.keys("status-section");
    assert_eq!(
        sections.first().map(String::as_str),
        Some("needs"),
        "Needs you is first: {sections:?}"
    );
    assert_eq!(
        rig.keys("session-button").first().map(String::as_str),
        Some("stuck")
    );
    rig.ws(|ws, window, cx| ws.run_command("sidebar.organize", None, window, cx))
        .unwrap();
    assert!(rig.record("status-view").is_none(), "back to By project");

    // A project header folds only a project with checkouts to fold away. With one plain checkout,
    // which has no row of its own, the sessions stay listed (as on the web), so a session created
    // there is never hidden until the project is unfolded.
    rig.show(&with_checkouts(vec![checkout("w1", json!({}))]));
    assert_eq!(rig.keys("session-title").len(), 2);
    rig.click("project-header:p");
    assert_eq!(
        rig.keys("session-title").len(),
        2,
        "one plain checkout: its sessions are still listed"
    );
    assert!(perch.sidebar().collapsed_projects.is_empty());
    rig.show(&with_checkouts(vec![
        checkout("w1", json!({})),
        checkout("w2", json!({"parentWorkspaceId": "w1", "path": "/work-2"})),
    ]));
    assert!(rig.record("project-workspaces:p").is_some());
    rig.click("project-header:p");
    assert!(
        rig.record("project-workspaces:p").is_none(),
        "a project with checkouts folds its rows away"
    );
    assert_eq!(perch.sidebar().collapsed_projects, ["p"]);
    rig.click("project-header:p");
    assert!(rig.record("project-workspaces:p").is_some(), "and unfolds");
    println!("mods_sidebar_window: sidebar behaviour ok");

    // The gear opens Settings.
    rig.click("settings-gear");
    assert!(
        rig.ws(|ws, _, _| ws.settings_open()),
        "app.settings reached the window"
    );
    rig.ws(|ws, window, cx| ws.run_command("overlay.close", None, window, cx))
        .unwrap();

    // New session: the stock New session screen opens for the sidebar's target.
    rig.ws(|ws, window, cx| ws.run_command("sessions.new", None, window, cx))
        .unwrap();
    rig.draw();
    assert_eq!(rig.ws(|ws, _, _| ws.screens_open()), ["new-session"]);
    rig.ws(|ws, window, cx| ws.run_command("overlay.close", None, window, cx))
        .unwrap();

    // A user copy of the stock folder replaces it and reloads on save.
    let stock = rig.user.join(".stock/sidebar");
    let mine = rig.user.join("sidebar");
    copy_dir(&stock, &mine);
    let main = std::fs::read_to_string(mine.join("main.js")).unwrap();
    assert!(main.contains("width: \"100%\""));
    std::fs::write(
        mine.join("main.js"),
        main.replacen("width: \"100%\"", "width: \"50%\"", 1),
    )
    .unwrap();
    rig.settle_files();
    let view = rig.sidebar_view();
    let source = rig
        .cx
        .update(|cx| view.read(cx).source().map(Path::to_path_buf));
    assert_eq!(
        source.as_deref(),
        Some(mine.as_path()),
        "the user copy is shown"
    );
    assert_eq!(
        rig.record("sidebar-root").unwrap().bounds.size.width,
        px(SIDEBAR_WIDTH / 2.),
        "the edit is drawn"
    );
    // A save that breaks it keeps the last good version on screen and says why.
    std::fs::write(mine.join("main.js"), "export default class {\n").unwrap();
    rig.settle_files();
    assert!(rig.sidebar_error().is_some(), "the broken save is reported");
    assert_eq!(
        rig.record("sidebar-root").unwrap().bounds.size.width,
        px(SIDEBAR_WIDTH / 2.),
        "the last good version stays"
    );
    // Removing the copy brings the stock one back.
    std::fs::remove_dir_all(&mine).unwrap();
    rig.settle_files();
    assert_eq!(rig.sidebar_error(), None);
    assert_eq!(
        rig.record("sidebar-root").unwrap().bounds.size.width,
        px(SIDEBAR_WIDTH)
    );
    println!("mods_sidebar_window: user copy ok");

    rig.cx
        .update_window(rig.window.into(), |_, window, _| window.remove_window())
        .unwrap();
    rig.cx.run_until_parked();
    let _ = std::fs::remove_dir_all(&scratch);
    println!("mods_sidebar_window: ok");
}

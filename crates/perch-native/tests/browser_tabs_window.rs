//! Browser tabs in an offscreen window, with recording page views (WebKit cannot run headless): `browser.open` opens
//! a tab whose page is made where its pane is drawn, another tab hides it and keeps it, closing the tab ends it, and
//! the page's address goes into the core's history once per change.

use futures::channel::mpsc::{unbounded, UnboundedReceiver};
use gpui::{px, size, AppContext, HeadlessAppContext, Window, WindowHandle};
use perch_native::browser::fake::{browsers, Calls};
use perch_native::browser::PageEvent;
use perch_native::client::Command;
use perch_native::sidebar::State;
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::cell::RefCell;
use std::rc::Rc;
use std::sync::Arc;

fn message(value: Value) -> perch_core::protocol::ServerMessage {
    serde_json::from_value(value).unwrap()
}

fn model() -> perch_native::sidebar::Model {
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "server.info", "hostname": "studio", "isSsh": false, "platform": "macOS",
        "capabilities": ["workspace.snapshot"]})));
    let project = json!({"id": "p", "hostId": "local", "name": "Work", "path": "/work",
        "favorite": false, "createdAt": 0, "updatedAt": 0});
    let checkout = json!({"id": "w1", "projectId": "p", "hostId": "local", "path": "/work",
        "name": "w1", "dirty": false, "state": "active", "createdAt": 0, "updatedAt": 0,
        "pinned": false});
    state.apply(&message(json!({
        "type": "workspace.snapshot", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [project], "workspaces": [checkout]})));
    state.model()
}

struct Rig {
    cx: HeadlessAppContext,
    window: WindowHandle<Workspace>,
    calls: Rc<RefCell<Calls>>,
    commands: UnboundedReceiver<Command>,
}

impl Rig {
    fn new() -> Self {
        let mut cx = HeadlessAppContext::with_platform(
            gpui_platform::current_platform(true).text_system(),
            Arc::new(()),
            gpui_platform::current_headless_renderer,
        );
        let (pages, calls) = browsers();
        let (tx, commands) = unbounded();
        let window = cx
            .open_window(size(px(1000.), px(700.)), |_, cx| {
                cx.new(|cx| Workspace::new(model(), Some(tx), cx).with_browser_pages(pages))
            })
            .unwrap();
        let mut rig = Rig {
            cx,
            window,
            calls,
            commands,
        };
        rig.draw();
        rig
    }

    fn draw(&mut self) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                let _ = window.draw(cx);
            })
            .unwrap();
        self.cx.run_until_parked();
    }

    fn run(&mut self, name: &str, args: Value) -> Result<(), String> {
        let result = self
            .window
            .update(&mut self.cx, |ws, window, cx| {
                ws.run_command(name, Some(&args), window, cx)
            })
            .unwrap();
        self.draw();
        result
    }

    fn take(&self) -> Vec<String> {
        std::mem::take(&mut self.calls.borrow_mut().log)
    }

    fn shown(&mut self) -> Vec<String> {
        self.window
            .read_with(&self.cx, |ws, _| ws.tabs().shown())
            .unwrap()
    }

    /// The frames the window sent the core since last asked.
    fn sent(&mut self) -> Vec<Value> {
        let mut sent = Vec::new();
        while let Ok(command) = self.commands.try_recv() {
            match command {
                Command::Send(frame) => sent.push(frame),
                Command::Ask { frame, .. } => sent.push(json!({"asked": frame})),
                _ => {}
            }
        }
        sent
    }

    fn event(&mut self, key: &str, url: &str, title: &str) {
        let event = PageEvent::Location {
            url: url.into(),
            title: title.into(),
            icon: String::new(),
        };
        self.window
            .update(&mut self.cx, |ws, _, cx| ws.page_event(key, event, cx))
            .unwrap();
        self.draw();
    }
}

const PAGE: &str = "w1\n\0browser\nhttps://example.com/";

fn a_tab_opens_its_page_where_its_pane_is_drawn() {
    let mut rig = Rig::new();
    assert!(rig.take().is_empty(), "no page before a browser tab");
    rig.run(
        "browser.open",
        json!({"url": "example.com", "workspaceId": "w1"}),
    )
    .unwrap();
    assert_eq!(rig.shown(), [PAGE]);
    assert!(perch_native::workspace::is_browser_tab(PAGE));
    assert_eq!(
        perch_native::workspace::file_tab(PAGE),
        None,
        "a browser tab is never a file's"
    );
    let log = rig.take();
    assert!(
        log[0].starts_with(&format!("{PAGE} create https://example.com/ zoom 1")),
        "{log:?}"
    );
    assert!(log.iter().any(|l| l.contains(" frame ")), "{log:?}");
    assert!(log.contains(&format!("{PAGE} show")), "{log:?}");
    assert!(
        log.contains(&format!("{PAGE} focus")),
        "a new page takes the keyboard: {log:?}"
    );
    assert!(
        rig.run(
            "browser.open",
            json!({"url": "javascript:alert(1)", "workspaceId": "w1"})
        )
        .is_err(),
        "only addresses a page may load"
    );
    // Test mode's `browser <url>` names no workspace: with none shown, the computer's first.
    rig.run("tabs.close", json!({"id": PAGE})).unwrap();
    rig.run("browser.open", json!({"url": "example.com"}))
        .unwrap();
    assert_eq!(rig.shown(), [PAGE]);
}

fn another_tab_hides_the_page_and_closing_ends_it() {
    let mut rig = Rig::new();
    rig.run(
        "browser.open",
        json!({"url": "example.com", "workspaceId": "w1"}),
    )
    .unwrap();
    rig.run("browser.open", json!({"workspaceId": "w1"}))
        .unwrap();
    let blank = rig.shown().pop().unwrap();
    assert!(blank.starts_with("w1\n\0browser\nblank:"), "{blank:?}");
    let log = rig.take();
    assert!(log.contains(&format!("{PAGE} hide")), "{log:?}");
    assert!(
        !log.iter().any(|l| l.starts_with(&blank)),
        "an empty tab makes no view: {log:?}"
    );
    rig.run("tabs.close", json!({"id": PAGE})).unwrap();
    assert_eq!(rig.take(), [format!("{PAGE} close")]);
    assert!(rig.shown().iter().all(|id| id != PAGE));
}

fn the_address_goes_into_the_history_once_per_change() {
    let mut rig = Rig::new();
    rig.run(
        "browser.open",
        json!({"url": "example.com", "workspaceId": "w1"}),
    )
    .unwrap();
    rig.sent();
    rig.event(PAGE, "https://example.com/", "Example");
    rig.event(PAGE, "https://example.com/", "Example");
    rig.event(PAGE, "https://example.com/", "Example Domain");
    rig.event(PAGE, "https://example.com/b", "B");
    let records: Vec<_> = rig
        .sent()
        .into_iter()
        .filter(|f| f["type"] == "browser.history.record")
        .map(|f| {
            (
                f["url"].as_str().unwrap().to_string(),
                f["visit"].as_bool().unwrap(),
            )
        })
        .collect();
    assert_eq!(
        records,
        [
            ("https://example.com/".into(), true),
            ("https://example.com/".into(), false),
            ("https://example.com/b".into(), true),
        ]
    );
    rig.run(
        "browser.addressChange",
        json!({"key": PAGE, "value": "exa"}),
    )
    .unwrap();
    let asked = rig.sent();
    assert_eq!(
        asked,
        [json!({"asked": {"type": "browser.history.search", "query": "exa"}})]
    );
}

/// The probe record whose name ends with `:<testid>`.
fn probed(rig: &mut Rig, testid: &str) -> Option<gpui::Bounds<gpui::Pixels>> {
    for _ in 0..3 {
        rig.cx.advance_clock(perch_native::mods::POLL);
        rig.cx.run_until_parked();
        rig.cx
            .update_window(rig.window.into(), |_, window: &mut Window, cx| {
                gpui_shell::probe::clear();
                window.refresh();
                let _ = window.draw(cx);
            })
            .unwrap();
    }
    let suffix = format!(":{testid}");
    gpui_shell::probe::records()
        .into_values()
        .find(|r| r.name == testid || r.name.ends_with(&suffix))
        .map(|r| r.bounds)
}

/// A left press and release at the middle of the element `testid`, through the window's dispatch.
fn click(rig: &mut Rig, testid: &str) {
    let at = probed(rig, testid)
        .unwrap_or_else(|| panic!("{testid} is drawn"))
        .center();
    rig.cx
        .update_window(rig.window.into(), |_, window: &mut Window, cx| {
            for input in [
                gpui::PlatformInput::MouseDown(gpui::MouseDownEvent {
                    button: gpui::MouseButton::Left,
                    position: at,
                    modifiers: Default::default(),
                    click_count: 1,
                    first_mouse: false,
                }),
                gpui::PlatformInput::MouseUp(gpui::MouseUpEvent {
                    button: gpui::MouseButton::Left,
                    position: at,
                    modifiers: Default::default(),
                    click_count: 1,
                }),
            ] {
                window.dispatch_event(input, cx);
            }
        })
        .unwrap();
    probed(rig, testid);
}

fn type_keys(rig: &mut Rig, keys: &[&str]) {
    for key in keys {
        rig.cx
            .update_window(rig.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_keystroke(gpui::Keystroke::parse(key).unwrap(), cx)
            })
            .unwrap();
        probed(rig, "none");
    }
}

/// A window with the stock mods running, in a scratch home.
fn with_mods(name: &str) -> (Rig, std::path::PathBuf) {
    let scratch = std::env::temp_dir().join(format!("perch-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    let mut rig = Rig::new();
    let workspace = rig.window.entity(&rig.cx).unwrap();
    let handle = rig.window.into();
    rig.cx.update(|cx| {
        perch_native::mods::start_in(scratch.join("native-mods"), &workspace, handle, cx)
    });
    (rig, scratch)
}

/// An empty browser tab's address field takes the keyboard on a press and what is typed reaches the window's draft.
fn typing_in_an_empty_tabs_address() {
    let (mut rig, scratch) = with_mods("browser-typing");
    rig.run("browser.open", json!({"workspaceId": "w1"}))
        .unwrap();
    let blank = rig.shown().pop().unwrap();
    click(&mut rig, "browser-address");
    type_keys(&mut rig, &["a", ".", "b"]);
    let draft = rig
        .window
        .read_with(&rig.cx, |ws, _| {
            ws.browser_pages()
                .and_then(|p| p.borrow().address(&blank).map(|a| a.draft.clone()))
        })
        .unwrap();
    assert_eq!(draft.as_deref(), Some("a.b"), "typed into the address");
    // Enter goes there: the empty tab's page is made at the address.
    rig.take();
    type_keys(&mut rig, &["enter"]);
    let log = rig.take();
    assert!(
        log.iter().any(|l| l.contains("create https://a.b/")),
        "Enter loads the address: {log:?}"
    );
    let _ = std::fs::remove_dir_all(&scratch);
}

/// New file from the tab strip's "+" menu: the name prompt outlives the menu, and Create reaches the window's files.
fn new_file_from_the_strip() {
    let (mut rig, scratch) = with_mods("new-file");
    rig.run("browser.open", json!({"workspaceId": "w1"}))
        .unwrap();
    rig.run("workspace.focus", json!({"id": "w1"})).unwrap();
    click(&mut rig, "tab-new");
    click(&mut rig, "launcher-option:new-tab-file");
    assert!(
        probed(&mut rig, "dialog-input").is_some(),
        "the name prompt is up"
    );
    type_keys(&mut rig, &["n", ".", "t", "x", "t", "enter"]);
    // The prompt closed with its answer and the window asked the core to make the file (before, the answer was
    // dropped and nothing was asked).
    assert!(
        probed(&mut rig, "dialog-input").is_none(),
        "the prompt closed"
    );
    let made: Vec<Value> = rig
        .sent()
        .into_iter()
        .filter(|f| f["type"] == "fs.mutate")
        .collect();
    assert_eq!(made.len(), 1, "{made:?}");
    assert_eq!(
        (&made[0]["op"], &made[0]["path"], &made[0]["workspaceId"]),
        (&json!("createFile"), &json!("n.txt"), &json!("w1"))
    );
    let _ = std::fs::remove_dir_all(&scratch);
}

fn main() {
    typing_in_an_empty_tabs_address();
    new_file_from_the_strip();
    a_tab_opens_its_page_where_its_pane_is_drawn();
    another_tab_hides_the_page_and_closing_ends_it();
    the_address_goes_into_the_history_once_per_change();
    println!("browser_tabs_window: ok");
}

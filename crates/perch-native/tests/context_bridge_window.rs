//! Context Bridge in a real window against a real perch-core: a right-click on selected terminal output opens the
//! stock `context-bridge` screen's Ask agent menu (and not the pane menu), its Ask agent turns the selection into the
//! dialog, Preview is prepared by the core (the packet names the selection and the workspace), Send goes to the core
//! once on the target's own terminal connection (it holds that shell's input) and comes back with the core's
//! answer, and a second Send is refused by the window. The Files entry's Ask agent opens the dialog on the file, and
//! the core prepares it from disk. Escape and Cancel close it.
//!
//! No agent runs and nothing is delivered: the target is a plain shell, which the core refuses to send to (only an
//! agent's CLI takes a packet). Everything else is `common`'s: the core is a child of this test, private to a scratch
//! directory, and stopped and checked gone by PID.

mod common;

use common::{Harness, Rig};
use gpui::{
    point, px, Modifiers, MouseButton, MouseDownEvent, MouseUpEvent, PlatformInput, Window,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_core::context_bridge::ContextSource;
use perch_native::client::follow;
use perch_native::mods;
use perch_native::terminal::TerminalEvent;
use serde_json::{json, Value};
use std::time::Duration;

const SCREEN: &str = "context-bridge";

fn main() {
    common::run("context_bridge_window", window);
}

fn props(h: &mut Harness) -> Option<Value> {
    h.ws(|ws, _| ws.screen_props(SCREEN).cloned())
}

fn open(h: &mut Harness) -> Vec<&'static str> {
    h.ws(|ws, _| ws.screens_open())
}

/// Draws and returns what the screens named.
fn records(h: &mut Harness) -> Vec<ProbeRecord> {
    h.cx.run_until_parked();
    h.cx.update_window(h.window.into(), |_, window: &mut Window, cx| {
        probe::clear();
        window.refresh();
        let _ = window.draw(cx);
    })
    .unwrap();
    probe::records().into_values().collect()
}

fn named(h: &mut Harness, name: &str) -> Option<ProbeRecord> {
    records(h).into_iter().find(|r| r.name.as_ref() == name)
}

fn click(h: &mut Harness, name: &str) {
    let at = named(h, name)
        .unwrap_or_else(|| panic!("{name} is drawn"))
        .bounds
        .center();
    h.cx.update_window(h.window.into(), |_, window: &mut Window, cx| {
        for input in [
            PlatformInput::MouseDown(MouseDownEvent {
                button: MouseButton::Left,
                position: at,
                modifiers: Modifiers::default(),
                click_count: 1,
                first_mouse: false,
            }),
            PlatformInput::MouseUp(MouseUpEvent {
                button: MouseButton::Left,
                position: at,
                modifiers: Modifiers::default(),
                click_count: 1,
            }),
        ] {
            window.dispatch_event(input, cx);
        }
    })
    .unwrap();
    h.cx.run_until_parked();
}

fn escape(h: &mut Harness) {
    h.cx.update_window(h.window.into(), |_, window: &mut Window, cx| {
        window.dispatch_keystroke(gpui::Keystroke::parse("escape").unwrap(), cx)
    })
    .unwrap();
    h.cx.run_until_parked();
}

/// The answer to a window request, waited for with the window running.
fn answer(
    h: &mut Harness,
    what: &str,
    mut rx: futures::channel::oneshot::Receiver<Result<Value, String>>,
) -> Result<Value, String> {
    let mut got = None;
    h.wait(what, |_| {
        if let Ok(Some(outcome)) = rx.try_recv() {
            got = Some(outcome);
        }
        got.is_some()
    });
    got.unwrap()
}

fn screen_ok(h: &mut Harness) {
    let error = h.ws(|ws, cx| ws.screen_error(SCREEN, cx));
    assert!(
        error.is_none(),
        "the context-bridge screen failed: {error:?}"
    );
}

fn window(rig: &mut Rig) {
    let folder = rig.scratch.join("work");
    std::fs::create_dir_all(&folder).unwrap();
    std::fs::write(folder.join("notes.txt"), "remember the bridge\n").unwrap();
    let folder = folder.to_string_lossy().into_owned();

    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    let (_, core) = rig.start_core(&runtime);
    let shell = runtime.block_on(async {
        let mut connection = core.connect().await.expect("connect");
        connection.create_project(&folder).await.expect("project");
        let session_id = connection
            .create_session(Some(&folder), None)
            .await
            .expect("create");
        // Opened once, so the core lists it.
        let terminal = connection
            .open_terminal(&session_id, 80, 24)
            .await
            .expect("open terminal");
        connection.release_terminal(&terminal).await.unwrap();
        session_id
    });

    let (commands, command_rx) = futures::channel::mpsc::unbounded();
    let (update_tx, updates) = futures::channel::mpsc::unbounded();
    let followed = core.clone();
    let _follower = runtime.spawn(follow(
        move || Ok(followed.clone()),
        command_rx,
        update_tx,
        Duration::from_millis(100),
    ));
    let mut h = Harness::new(core, commands, updates);
    let user = rig.scratch.join("native-mods");
    let workspace = h.window.entity(&h.cx).unwrap();
    let handle = h.window.into();
    h.cx.update(|cx| mods::start_in(user, &workspace, handle, cx));

    let mut workspace_id = None;
    h.wait("the session's workspace", |h| {
        workspace_id = h.ws(|ws, cx| {
            let store = ws.sidebar().read(cx).model().store.clone();
            store
                .sessions
                .iter()
                .find(|s| s.id == shell)
                .and_then(|s| s.workspace_id.clone())
                .filter(|w| perch_native::workspace::bridge_available(&store, w))
        });
        workspace_id.is_some()
    });
    let workspace_id = workspace_id.unwrap();
    h.show_tab(&shell);
    h.wait("the shell", |h| h.ready(&shell));
    h.type_text("echo bridge-$((40+2))");
    h.wait("the output", |h| h.has_row(&shell, "bridge-42"));

    // A right-click on the selection opens the menu, and the pane menu stays shut.
    let view = h.pane(&shell).unwrap();
    h.view_cx(&shell, |v, cx| v.select_all(cx));
    let at = point(px(300.), px(200.));
    view.update(&mut h.cx, |_, cx| {
        cx.emit(TerminalEvent::AskAgentOffered(at));
        cx.emit(TerminalEvent::MenuAsked(at));
    });
    h.draw();
    assert_eq!(open(&mut h), [SCREEN], "only the bridge's menu");
    let menu = props(&mut h).unwrap();
    assert_eq!(menu["menu"]["sessionId"], json!(shell));
    assert_eq!(menu["menu"]["workspaceId"], json!(workspace_id));
    assert!(menu["menu"]["selection"]
        .as_str()
        .unwrap()
        .contains("bridge-42"));
    assert!(menu["capture"].is_null());
    screen_ok(&mut h);

    // Ask agent: the dialog on the selection. Nothing is sent.
    click(&mut h, "context-bridge-ask");
    h.wait("the dialog", |h| {
        props(h).is_some_and(|p| p["menu"].is_null() && p["capture"].is_object())
    });
    let capture = props(&mut h).unwrap()["capture"].clone();
    assert_eq!(capture["source"]["kind"], "terminal");
    assert!(named(&mut h, "context-bridge-dialog").is_some());
    screen_ok(&mut h);
    // The screen prepares the packet itself (its Preview through the window to the core): Copy context is enabled
    // once the packet is there.
    let copy_enabled = |h: &mut Harness| {
        named(h, "context-bridge-copy").is_some_and(|r| r.opacity.is_none_or(|o| o > 0.9))
    };
    assert!(
        !copy_enabled(&mut h),
        "nothing to copy before the core prepared it"
    );
    h.wait("the screen's preview", |h| copy_enabled(h));
    screen_ok(&mut h);

    // Preview: the core prepares the packet from the selection, and lists no agent (a shell is not one).
    let rx = h
        .window
        .update(&mut h.cx, |ws, _, cx| ws.bridge_preview("why?".into(), cx))
        .unwrap();
    let preview = answer(&mut h, "the preview", rx).expect("the core prepares the packet");
    let markdown = preview["packet"]["markdown"].as_str().unwrap();
    assert!(markdown.contains("bridge-42"), "{markdown}");
    assert!(markdown.contains("why?"), "{markdown}");
    assert_eq!(preview["packet"]["workspaceId"], json!(workspace_id));
    assert_eq!(preview["agents"], json!([]), "a shell is no agent");
    let digest = preview["packet"]["digest"].as_str().unwrap().to_string();

    // Send: once, on the shell's own connection (it holds the input), and the core's refusal comes back.
    let rx = h
        .window
        .update(&mut h.cx, |ws, _, cx| {
            ws.bridge_send(
                "why?".into(),
                digest.clone(),
                shell.clone(),
                preview.clone(),
                cx,
            )
        })
        .unwrap();
    let state = props(&mut h).unwrap()["sendState"].clone();
    assert_eq!(
        (&state["attempted"], &state["sending"]),
        (&json!(true), &json!(true)),
        "{state}"
    );
    assert_eq!(props(&mut h).unwrap()["busy"], true);
    let refused = answer(&mut h, "the send's answer", rx).expect_err("a shell takes no packet");
    assert!(
        !refused.contains("not confirmed"),
        "the core answered: {refused}"
    );
    assert!(
        !refused.contains("Another view"),
        "sent on the connection holding the input: {refused}"
    );
    let state = props(&mut h).unwrap()["sendState"].clone();
    assert_eq!(state["sending"], false, "{state}");
    assert_eq!(state["delivered"], false, "{state}");
    assert_eq!(state["error"], json!(refused));
    assert_eq!(state["sent"]["targetSessionId"], json!(shell));
    println!("the core refused the send to a shell: {refused}");
    // A second Send of this capture is refused by the window.
    let rx = h
        .window
        .update(&mut h.cx, |ws, _, cx| {
            ws.bridge_send(
                "why?".into(),
                digest.clone(),
                shell.clone(),
                preview.clone(),
                cx,
            )
        })
        .unwrap();
    let again = answer(&mut h, "the second send", rx).unwrap_err();
    assert!(again.contains("already sent once"), "{again}");
    screen_ok(&mut h);

    // Escape closes it, and the bridge forgets the capture.
    escape(&mut h);
    h.draw();
    assert!(open(&mut h).is_empty(), "Escape closed it");

    // The Files entry's Ask agent: the dialog on the file, prepared from disk; Cancel closes it.
    h.window
        .update(&mut h.cx, |ws, _, cx| {
            ws.ask_agent_about_file(&workspace_id, "notes.txt", cx)
        })
        .unwrap()
        .expect("Ask agent about file");
    h.draw();
    assert_eq!(open(&mut h), [SCREEN]);
    let capture = props(&mut h).unwrap()["capture"].clone();
    assert_eq!(
        capture["source"],
        json!({"kind": "file", "path": "notes.txt"})
    );
    assert_eq!(
        props(&mut h).unwrap()["sendState"]["attempted"],
        false,
        "a new intent"
    );
    let rx = h
        .window
        .update(&mut h.cx, |ws, _, cx| ws.bridge_preview(String::new(), cx))
        .unwrap();
    let preview = answer(&mut h, "the file's preview", rx).expect("prepared");
    assert!(preview["packet"]["markdown"]
        .as_str()
        .unwrap()
        .contains("remember the bridge"));
    click(&mut h, "context-bridge-cancel");
    h.draw();
    assert!(open(&mut h).is_empty(), "Cancel closed it");

    // A workspace the bridge does not know is refused.
    let refused = h
        .window
        .update(&mut h.cx, |ws, _, cx| {
            ws.ask_agent("nope", ContextSource::File { path: "x".into() }, cx)
        })
        .unwrap();
    assert!(refused.is_err());
    assert!(open(&mut h).is_empty());

    h.close();
}

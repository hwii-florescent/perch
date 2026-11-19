//! While the core is away, what would change something there is refused with a reason the screen
//! can show, and nothing of it is sent once the core is back: a session's delete and a forced
//! worktree removal, the two a person confirms. A listing is still asked.
//!
//! Offscreen, as the other render tests: no window is shown or focused and no core runs.

use futures::channel::mpsc::{unbounded, UnboundedReceiver};
use gpui::{px, size, AppContext as _, HeadlessAppContext, Window, WindowHandle};
use perch_core::protocol::ServerMessage;
use perch_native::client::{Command, Update, NOT_CONNECTED};
use perch_native::sidebar::State;
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::sync::Arc;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

/// `alpha` in project `p`, as a core says it.
fn state() -> State {
    let project = json!({"id": "p", "hostId": "local", "name": "Work", "path": "/work",
        "repoPath": "/work", "favorite": false, "createdAt": 0, "updatedAt": 0});
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "project.list", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [project]})));
    state.apply(&message(json!({"type": "session.list", "sessions": [
        {"id": "alpha", "title": "alpha", "cwd": "/work", "createdAt": 0, "status": "idle",
         "hostId": "local", "projectId": "p", "cliProviderId": "claude"}]})));
    state
}

/// What the window asked of the core that changes something there, or puts a question to it
/// (the window's own focus and view state left out).
fn asked(rx: &mut UnboundedReceiver<Command>) -> Vec<Command> {
    std::iter::from_fn(|| rx.try_recv().ok())
        .filter(|c| c.changes_state() || matches!(c, Command::Ask { .. }))
        .collect()
}

fn ws<R>(
    cx: &mut HeadlessAppContext,
    window: &WindowHandle<Workspace>,
    f: impl FnOnce(&mut Workspace, &mut Window, &mut gpui::Context<Workspace>) -> R,
) -> R {
    window
        .update(cx, |ws, window, cx| f(ws, window, cx))
        .unwrap()
}

fn main() {
    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let (tx, mut rx) = unbounded();
    let mut offline = state();
    offline.disconnect(Some("the core stopped".into()));
    let model = offline.model();
    let window = cx
        .open_window(size(px(1000.), px(700.)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
            })
        })
        .unwrap();

    // The core is away: the delete is refused with the reason, and nothing goes out.
    let deleted = ws(&mut cx, &window, |ws, window, cx| {
        ws.run_command("session.close", Some(&json!({"id": "alpha"})), window, cx)
    });
    assert_eq!(deleted, Err(NOT_CONNECTED.to_string()));
    // A forced removal a screen asks for is answered with the refusal; a listing is still asked.
    let remove = json!({"type": "worktree.remove", "repoPath": "/work", "path": "/wt/a",
        "force": true, "deleteBranch": false});
    let mut removal = ws(&mut cx, &window, |ws, _, cx| ws.ask(remove, cx));
    assert_eq!(
        removal.try_recv().unwrap(),
        Some(Err(NOT_CONNECTED.to_string()))
    );
    let _listing = ws(&mut cx, &window, |ws, _, cx| {
        ws.ask(json!({"type": "fs.browse"}), cx)
    });
    let sent = asked(&mut rx);
    assert!(
        matches!(&sent[..], [Command::Ask { frame, .. }] if frame["type"] == "fs.browse"),
        "only the listing: {sent:?}"
    );

    // The core is back: nothing that was refused is sent, and a delete asked now goes.
    ws(&mut cx, &window, |ws, _, cx| {
        ws.sidebar()
            .update(cx, |s, cx| s.apply(Update::Model(state().model()), cx))
    });
    cx.run_until_parked();
    assert!(asked(&mut rx).is_empty(), "nothing carried over");
    ws(&mut cx, &window, |ws, window, cx| {
        ws.run_command("session.close", Some(&json!({"id": "alpha"})), window, cx)
    })
    .expect("the core is back");
    let sent = asked(&mut rx);
    assert!(
        matches!(&sent[..], [Command::DeleteSession { session_id, .. }] if session_id == "alpha"),
        "{sent:?}"
    );

    cx.update_window(window.into(), |_, window, _| window.remove_window())
        .unwrap();
    cx.run_until_parked();
    println!("workspace_offline_window: ok");
}

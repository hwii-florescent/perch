//! Renaming a session from its tab, in a real window against a real perch-core: a double-click on the tab turns it
//! into a field holding the title, all of it selected, with the keyboard in it. Typing replaces the title; Enter
//! renames the session in the core and the tab comes back; Escape drops the edit; a click on the terminal ends it and
//! keeps what was typed, as the field losing the keyboard does on the web.
//!
//! No agent runs: the session is a plain shell. Everything else is `common`'s: the core is a child of this test,
//! private to a scratch directory, and stopped and checked gone by PID.

mod common;

use common::{Harness, Rig};
use gpui::{
    point, px, Keystroke, Modifiers, MouseButton, MouseDownEvent, MouseUpEvent, Pixels,
    PlatformInput, Point, Window,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_native::client::follow;
use perch_native::mods;
use std::time::Duration;

fn main() {
    common::run("tab_rename_window", window);
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

/// The session's tab label, when the tab is drawn as a tab (not as the rename field).
fn label(h: &mut Harness) -> Option<ProbeRecord> {
    records(h)
        .into_iter()
        .find(|r| r.name.starts_with("tab-label"))
}

/// Presses at `at` `count` times in a row, as a double-click is.
fn clicks(h: &mut Harness, at: Point<Pixels>, count: usize) {
    for n in 1..=count {
        h.cx.update_window(h.window.into(), |_, window: &mut Window, cx| {
            for input in [
                PlatformInput::MouseDown(MouseDownEvent {
                    button: MouseButton::Left,
                    position: at,
                    modifiers: Modifiers::default(),
                    click_count: n,
                    first_mouse: false,
                }),
                PlatformInput::MouseUp(MouseUpEvent {
                    button: MouseButton::Left,
                    position: at,
                    modifiers: Modifiers::default(),
                    click_count: n,
                }),
            ] {
                window.dispatch_event(input, cx);
            }
        })
        .unwrap();
        h.cx.run_until_parked();
    }
}

fn typed(h: &mut Harness, text: &str) {
    for c in text.chars() {
        h.key(Keystroke {
            modifiers: Modifiers::default(),
            key: c.to_string(),
            key_char: Some(c.to_string()),
        });
    }
}

fn title(h: &mut Harness, id: &str) -> Option<String> {
    h.ws(|ws, cx| {
        ws.sidebar()
            .read(cx)
            .model()
            .store
            .sessions
            .iter()
            .find(|s| s.id == id)
            .map(|s| s.title.clone())
    })
}

/// Double-clicks the tab and waits for the rename field in its place.
fn start_rename(h: &mut Harness) {
    let at = label(h).expect("the tab is drawn").bounds.center();
    clicks(h, at, 2);
    h.wait("the rename field", |h| label(h).is_none());
}

fn window(rig: &mut Rig) {
    let folder = rig.scratch.join("work");
    std::fs::create_dir_all(&folder).unwrap();
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

    h.wait("the session in its workspace", |h| {
        h.ws(|ws, cx| {
            ws.sidebar()
                .read(cx)
                .model()
                .store
                .sessions
                .iter()
                .any(|s| s.id == shell && s.workspace_id.is_some())
        })
    });
    h.show_tab(&shell);
    h.wait("the shell", |h| h.ready(&shell));
    h.wait("the tab", |h| label(h).is_some());

    // Enter: the typed name replaces the selected title and the core renames the session.
    start_rename(&mut h);
    typed(&mut h, "renamed");
    h.press("enter");
    h.wait("the core to rename the session", |h| {
        title(h, &shell).as_deref() == Some("renamed")
    });
    h.wait("the tab back", |h| label(h).is_some());
    assert!(
        !h.rows(&shell).iter().any(|row| row.contains("renamed")),
        "the name went to the field, not the shell"
    );

    // Escape: the edit is dropped.
    start_rename(&mut h);
    typed(&mut h, "dropped");
    h.press("escape");
    h.wait("the tab back after Escape", |h| label(h).is_some());
    h.settle();
    assert_eq!(title(&mut h, &shell).as_deref(), Some("renamed"));

    // A click on the terminal ends it, keeping what was typed (the field lost the keyboard).
    start_rename(&mut h);
    typed(&mut h, "elsewhere");
    clicks(
        &mut h,
        point(px(common::WIDTH / 2.), px(common::HEIGHT / 2.)),
        1,
    );
    h.wait("the tab back after a click elsewhere", |h| {
        label(h).is_some()
    });
    h.wait("the core to keep the typed name", |h| {
        title(h, &shell).as_deref() == Some("elsewhere")
    });

    h.close();
    drop(runtime);
}

//! The window against a real perch-core: a shell in a tab, a second shell split beside it, typing
//! that reaches only the pane with the keyboard, the size each pane gives its own shell, and the
//! terminal settings changed through the core.
//!
//! The core and the teardown are in `common`: the core is a child of this test with everything it
//! touches private to a scratch directory, and the core, the shells and the daemon are stopped and
//! checked gone by PID before the test returns.

mod common;

use common::{Harness, Rig};
use perch_native::client::{follow, Command as Order};
use perch_native::settings::Change;
use perch_native::terminal::Status;
use std::time::Duration;

fn main() {
    common::run("workspace_session", window);
}

fn window(rig: &mut Rig) {
    // The core reads `keys.json` beside its database when a client asks for the mods state.
    std::fs::write(
        rig.scratch.join("keys.json"),
        r#"{"terminal": {"cmd-shift-y": "send:echo from-keys-$((6*7))"}}"#,
    )
    .unwrap();
    let scratch = rig.scratch.clone();

    // The follower runs on this runtime's threads; the window is driven from this one.
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    let (_, core) = rig.start_core(&runtime);
    let first = runtime.block_on(async {
        let mut connection = core.connect().await.expect("connect");
        let session_id = connection.create_session(None, None).await.expect("create");
        let terminal = connection
            .open_terminal(&session_id, 80, 24)
            .await
            .expect("open terminal");
        // The session is listed once its terminal is open; the window's view takes the leases.
        connection.release_terminal(&terminal).await.unwrap();
        session_id
    });

    let (commands, command_rx) = futures::channel::mpsc::unbounded();
    let (update_tx, updates) = futures::channel::mpsc::unbounded();
    let followed = core.clone();
    let follower = runtime.spawn(follow(
        move || Ok(followed.clone()),
        command_rx,
        update_tx,
        Duration::from_millis(100),
    ));
    let mut h = Harness::new(core, commands, updates);

    // The terminal settings come from the core, and a change goes through the core's settings
    // route: it is saved, and the follower learns the new value from the core's broadcast.
    h.wait("the terminal settings", |h| h.settings().is_some());
    let before = h.settings().unwrap();
    let scrollback = if before.scrollback == 4321 {
        4322
    } else {
        4321
    };
    h.send(Order::UpdateSettings(
        Change::Scrollback(scrollback).patch(),
    ));
    h.send(Order::UpdateSettings(
        Change::DroppedPathDoubleQuotes(!before.dropped_path_double_quotes).patch(),
    ));
    h.wait("the changed settings", |h| {
        h.settings().is_some_and(|s| {
            s.scrollback == scrollback
                && s.dropped_path_double_quotes == !before.dropped_path_double_quotes
        })
    });
    let after = h.settings().unwrap();
    assert_eq!(after.login_shell, before.login_shell, "only what changed");
    let saved: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(scratch.join("settings.json")).expect("the core saved settings"),
    )
    .unwrap();
    assert_eq!(saved["terminalScrollback"], scrollback);

    // The first shell in a tab, filling the main area.
    h.wait("the session to be listed", |h| {
        h.attention(&first).is_some()
    });
    h.show_tab(&first);
    h.wait("the first shell", |h| h.ready(&first));
    let single = h.fitted(&first);
    h.type_text("echo ready-$((40+2))");
    h.wait("the first shell to answer", |h| {
        h.has_row(&first, "ready-42")
    });

    // A `send:` key in keys.json, which the core served, is typed into the focused shell through
    // its text input; Enter is the person's.
    h.wait("keys.json", |h| {
        h.ws(|ws, cx| ws.sidebar().read(cx).model().keys_file.is_some())
    });
    assert!(h.press("cmd-shift-y"), "the send key is taken");
    assert!(!h.has_row(&first, "from-keys-42"), "typed, not yet run");
    assert!(h.press("enter"));
    h.wait("the sent text to run", |h| {
        h.has_row(&first, "from-keys-42")
    });

    // Splitting right starts a second shell through the core and shows it beside the first.
    assert!(h.press("cmd-d"), "panes.splitRight is taken");
    h.wait("the split", |h| h.shown().len() == 2);
    let second = h.shown()[1].clone();
    assert_eq!(h.shown()[0], first);
    assert_ne!(second, first);
    assert_eq!(
        h.active().as_deref(),
        Some(second.as_str()),
        "the new pane has the keyboard"
    );
    h.wait("both panes", |h| h.ready(&first) && h.ready(&second));

    // Each pane gives its shell its own area: narrower than the whole, and not more than that.
    let (first_size, second_size) = (h.fitted(&first), h.fitted(&second));
    for (name, fit) in [("first", first_size), ("second", second_size)] {
        assert!(
            fit.0 < single.0,
            "{name} pane {fit:?} is narrower than the whole {single:?}"
        );
        assert!(fit.0 > 40, "{name} pane {fit:?} still holds a terminal");
        assert_eq!(fit.1, single.1, "{name} pane keeps the height");
    }
    h.wait("the shells to be sized to their panes", |h| {
        h.grid(&first) == first_size && h.grid(&second) == second_size
    });

    // Typing reaches only the pane with the keyboard.
    h.type_text("echo only-bravo-$((1+1))");
    h.wait("the second shell to answer", |h| {
        h.has_row(&second, "only-bravo-2")
    });
    h.settle();
    assert!(
        !h.rows(&first).iter().any(|r| r.contains("only-bravo")),
        "the first pane never saw it: {:?}",
        h.rows(&first)
    );
    assert!(h.press("cmd-alt-left"));
    h.wait("the keyboard to move", |h| {
        h.active().as_deref() == Some(first.as_str())
    });
    h.type_text("echo only-alpha-$((2+1))");
    h.wait("the first shell to answer", |h| {
        h.has_row(&first, "only-alpha-3")
    });
    h.settle();
    assert!(
        !h.rows(&second).iter().any(|r| r.contains("only-alpha")),
        "the second pane never saw it: {:?}",
        h.rows(&second)
    );

    // Each shell reports the size of its own pane.
    h.type_text("stty size");
    let want = format!("{} {}", first_size.1, first_size.0);
    h.wait("the first shell's size", |h| h.has_row(&first, &want));
    assert!(h.press("cmd-alt-right"));
    h.wait("the keyboard to move", |h| {
        h.active().as_deref() == Some(second.as_str())
    });
    h.type_text("stty size");
    let want = format!("{} {}", second_size.1, second_size.0);
    h.wait("the second shell's size", |h| h.has_row(&second, &want));

    // Closing a plain shell's tab ends its session; the other pane takes the whole area and its
    // shell is told.
    assert!(h.press("cmd-alt-left"));
    h.wait("the keyboard to move", |h| {
        h.active().as_deref() == Some(first.as_str())
    });
    assert!(h.press("cmd-w"));
    h.wait("the tab to close", |h| h.shown() == [second.clone()]);
    h.wait("the session to end", |h| h.attention(&first).is_none());
    h.wait("the remaining pane to refit", |h| {
        h.ready(&second) && h.fitted(&second) == single && h.grid(&second) == single
    });
    h.type_text("stty size");
    let want = format!("{} {}", single.1, single.0);
    h.wait("the remaining shell's size", |h| h.has_row(&second, &want));

    // Paste goes through the terminal's own paste, from the clipboard the window was given, and
    // the shell hears it as typed.
    h.clipboard.write_text_for_test("echo pasted-$((5+5))");
    assert!(h.press("cmd-v"));
    assert!(h.press("enter"));
    h.wait("the pasted text to run", |h| {
        h.has_row(&second, "pasted-10")
    });

    // A new terminal from the palette is a tab; the one it covers is kept and hidden. When the
    // room changes (the sidebar goes), the hidden shell is still given the size its pane would
    // have, without anyone looking at it.
    h.press("cmd-p");
    h.type_text("new terminal");
    h.wait("the new tab", |h| {
        h.ws(|ws, _| ws.tabs().strip().len() == 2)
    });
    let third = h.active().expect("the new tab has the keyboard");
    assert_ne!(third, second);
    h.wait("the new shell", |h| h.ready(&third));
    assert_eq!(h.shown(), std::slice::from_ref(&third));
    assert_eq!(h.view(&second, |v| v.is_hidden()), Some(true));
    assert!(h.press("cmd-b"), "global.sidebar is taken");
    h.wait("the hidden shell to follow the wider room", |h| {
        h.view(&second, |v| v.grid_size().0 > single.0)
            .unwrap_or(false)
    });
    assert_eq!(
        h.view(&second, |v| v.is_hidden()),
        Some(true),
        "still unseen"
    );
    assert_eq!(h.shown(), std::slice::from_ref(&third));

    // Stopping a shell from the palette: its process ends and the view says so.
    h.press("cmd-p");
    h.type_text("stop the terminal");
    h.wait("the shell to end", |h| {
        h.view(&third, |v| matches!(v.status(), Status::Exited(_)))
            .unwrap_or(false)
    });

    h.close();
    follower.abort();
    drop(runtime);
}

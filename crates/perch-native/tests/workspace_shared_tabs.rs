//! The window's tabs are the core's shared tabs (`workspace.tabs`): a file opened in the window
//! reaches the core's list, and a change written by another device (a second follower of the same
//! core, as the phone is) shows in the window, without moving the window's keyboard there.
//!
//! The core and the teardown are in `common`: the core is a child of this test with everything it
//! touches private to a scratch directory.

mod common;

use common::{Harness, Rig};
use perch_native::client::{follow, Command as Order};
use serde_json::json;
use std::time::Duration;

fn main() {
    common::run("workspace_shared_tabs", window);
}

fn window(rig: &mut Rig) {
    let folder = rig.scratch.join("project");
    std::fs::create_dir_all(&folder).unwrap();
    std::fs::write(folder.join("a.txt"), "a\n").unwrap();
    std::fs::write(folder.join("b.txt"), "b\n").unwrap();
    let folder = folder.to_string_lossy().to_string();

    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    let (_, core) = rig.start_core(&runtime);
    let session = runtime.block_on(async {
        let mut connection = core.connect().await.expect("connect");
        connection.create_project(&folder).await.expect("project");
        let session = connection
            .create_session(Some(&folder), None)
            .await
            .expect("create");
        let terminal = connection
            .open_terminal(&session, 80, 24)
            .await
            .expect("open terminal");
        connection.release_terminal(&terminal).await.unwrap();
        session
    });

    let follower = |core: perch_native::client::Core| {
        let (commands, command_rx) = futures::channel::mpsc::unbounded();
        let (update_tx, updates) = futures::channel::mpsc::unbounded();
        let task = runtime.spawn(follow(
            move || Ok(core.clone()),
            command_rx,
            update_tx,
            Duration::from_millis(100),
        ));
        (commands, updates, task)
    };
    let (commands, updates, desktop) = follower(core.clone());
    // The other device: its own connection to the same core.
    let (phone, _phone_updates, phone_task) = follower(core.clone());
    let mut h = Harness::new(core, commands, updates);

    let store = |h: &mut Harness| h.ws(|ws, cx| ws.sidebar().read(cx).model().store.clone());
    h.wait("the session in its workspace", |h| {
        store(h)
            .sessions
            .iter()
            .any(|s| s.id == session && s.workspace_id.is_some())
    });
    let workspace = store(&mut h)
        .sessions
        .iter()
        .find(|s| s.id == session)
        .and_then(|s| s.workspace_id.clone())
        .unwrap();
    h.show_tab(&session);
    h.wait("the session's tab", |h| {
        h.active().as_deref() == Some(session.as_str())
    });

    // A file opened here is in the core's list, which every device reads.
    let a = format!("{workspace}\na.txt");
    h.window
        .update(&mut h.cx, |ws, _, cx| {
            ws.open_file(&workspace, "a.txt", false, cx)
        })
        .unwrap();
    h.wait("the core to list the file", |h| {
        store(h)
            .shared_tabs
            .get(&workspace)
            .is_some_and(|t| t.strip == [session.clone(), a.clone()])
    });
    let revision = store(&mut h).shared_tabs[&workspace].revision;
    h.show_tab(&session);
    h.wait("the session shown again", |h| {
        h.active().as_deref() == Some(session.as_str())
    });

    // The other device closes the file and opens another one beside the session.
    let b = format!("{workspace}\nb.txt");
    phone
        .unbounded_send(Order::Send(json!({
            "type": "workspace.tabs.set", "requestId": "phone-1", "workspaceId": workspace,
            "baseRevision": revision, "strip": [b, session], "sets": [],
        })))
        .unwrap();
    h.wait("the window to show the other device's tabs", |h| {
        h.ws(|ws, _| ws.tabs().strip().to_vec()) == [b.clone(), session.clone()]
    });
    assert_eq!(
        h.active().as_deref(),
        Some(session.as_str()),
        "the other device does not move this window's keyboard"
    );
    // Nothing differs from the core now, so the window writes nothing back.
    h.settle();
    assert_eq!(
        store(&mut h).shared_tabs[&workspace].revision,
        revision + 1,
        "no write followed the other device's"
    );

    h.close();
    desktop.abort();
    phone_task.abort();
    drop(runtime);
}

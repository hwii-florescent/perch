//! `perch://open` links handed to the window (`Workspace::open_link`, what the app's URL handler
//! calls) against a real core child with everything private to a scratch directory: a link that
//! arrives while the window has not heard from the core yet is kept and applied once the session
//! is listed; chat goes to the session's tab, files to the drawer's Files, changes to the review
//! tab; links that are not ours, or name a session that does not exist, change nothing.

mod common;

use common::{Harness, Rig};
use perch_native::client::follow;
use perch_native::shell::Tools;
use std::time::Duration;

fn main() {
    common::run("perch_links_window", window);
}

fn window(rig: &mut Rig) {
    let folder = rig.scratch.join("project");
    std::fs::create_dir_all(&folder).unwrap();
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
    let (commands, command_rx) = futures::channel::mpsc::unbounded();
    let (update_tx, updates) = futures::channel::mpsc::unbounded();
    let follower = core.clone();
    let task = runtime.spawn(follow(
        move || Ok(follower.clone()),
        command_rx,
        update_tx,
        Duration::from_millis(100),
    ));
    let mut h = Harness::new(core, commands, updates);
    let link = |h: &mut Harness, url: &str| {
        let url = url.to_string();
        h.window
            .update(&mut h.cx, |ws, window, cx| ws.open_link(&url, window, cx))
            .unwrap();
    };

    // The window has heard nothing from the core: the link waits for the session, then shows it.
    assert!(h.ws(|ws, _| ws.tabs().shown().is_empty()));
    link(
        &mut h,
        &format!("perch://open?place=files&session={session}"),
    );
    h.wait("the link's session shown with the drawer's Files", |h| {
        h.active().as_deref() == Some(session.as_str())
            && h.ws(|ws, _| ws.drawer()) == Some(Tools::Files)
    });
    let workspace = h
        .ws(|ws, cx| ws.sidebar().read(cx).model().store.clone())
        .sessions
        .iter()
        .find(|s| s.id == session)
        .and_then(|s| s.workspace_id.clone())
        .expect("the session's workspace");

    link(
        &mut h,
        &format!("perch://open?place=changes&session={session}"),
    );
    let review = format!("{workspace}\n\0review");
    h.wait("the review tab", |h| {
        h.ws(|ws, _| ws.tabs().strip().contains(&review))
    });
    assert_eq!(h.active().as_deref(), Some(review.as_str()));

    link(
        &mut h,
        &format!("perch://open?place=chat&session={session}"),
    );
    h.wait("chat shows the session's tab", |h| {
        h.active().as_deref() == Some(session.as_str())
    });

    // Not ours, or naming nothing the core has: nothing moves, nothing crashes.
    let before = h.ws(|ws, _| ws.tabs().strip().to_vec());
    for url in [
        "https://example.com/",
        "perch://open?place=terminal",
        "perch://open?place=files&run=ls",
        "perch://open?place=chat&session=no-such-session",
    ] {
        link(&mut h, url);
    }
    h.settle();
    assert_eq!(h.ws(|ws, _| ws.tabs().strip().to_vec()), before);
    assert_eq!(h.active().as_deref(), Some(session.as_str()));

    h.close();
    task.abort();
    drop(runtime);
}

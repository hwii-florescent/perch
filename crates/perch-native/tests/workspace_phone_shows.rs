//! A phone showing a tab takes that terminal's size and gives it back after, against a real
//! perch-core: a second client connects as a phone (`?viewer=phone`, as the web's phone page and
//! a native phone client do), takes tab A's size from the window with no typing, and when it
//! releases it or drops, the window holds A's size again at its own grid. Tab B, which the phone
//! never shows, keeps its size and its lease throughout. Everything else is `common`'s: the core
//! is a child of this test, private to a scratch directory, and stopped and checked gone by PID.

mod common;

use common::{Harness, Rig};
use perch_native::client::follow;
use std::time::Duration;

fn main() {
    common::run("workspace_phone_shows", window);
}

fn window(rig: &mut Rig) {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    let (_, core) = rig.start_core(&runtime);
    let [tab_a, tab_b] = runtime.block_on(async {
        let mut connection = core.connect().await.expect("connect");
        let mut shells = Vec::new();
        for _ in 0..2 {
            let session_id = connection.create_session(None, None).await.expect("create");
            let terminal = connection
                .open_terminal(&session_id, 80, 24)
                .await
                .expect("open terminal");
            connection.release_terminal(&terminal).await.unwrap();
            shells.push(session_id);
        }
        [shells[0].clone(), shells[1].clone()]
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
    let phone_core = core.clone().phone();
    let mut h = Harness::new(core, commands, updates);
    for tab in [&tab_b, &tab_a] {
        h.wait("the session to be listed", |h| h.attention(tab).is_some());
        h.show_tab(tab);
        h.wait("the shell", |h| h.ready(tab));
    }
    let (own_a, own_b) = (h.fitted(&tab_a), h.fitted(&tab_b));
    h.wait("both shells sized by the window", |h| {
        h.grid(&tab_a) == own_a
            && h.grid(&tab_b) == own_b
            && h.view(&tab_a, |v| v.holds_size()) == Some(true)
            && h.view(&tab_b, |v| v.holds_size()) == Some(true)
    });
    assert_ne!(
        own_a,
        (40, 20),
        "the phone's grid differs from the window's"
    );
    let b_untouched = |h: &mut Harness| {
        assert_eq!(h.grid(&tab_b), own_b, "tab B keeps its size");
        assert_eq!(
            h.view(&tab_b, |v| v.holds_size()),
            Some(true),
            "and its lease"
        );
    };

    // The phone shows tab A: it takes A's size from the window, with no typing.
    let (mut phone, mut shown) = runtime.block_on(async {
        let mut phone = phone_core.connect().await.expect("the phone connects");
        let mut shown = phone
            .open_terminal(&tab_a, 40, 20)
            .await
            .expect("the phone shows tab A");
        phone.take_resize(&mut shown).await.expect("take the size");
        assert!(shown.owns_resize(), "the phone holds A's size");
        phone
            .terminal_resize(&shown, 40, 20)
            .await
            .expect("size the shell");
        (phone, shown)
    });
    h.wait("the phone's size in the window", |h| {
        h.grid(&tab_a) == (40, 20) && h.view(&tab_a, |v| v.holds_size()) == Some(false)
    });
    b_untouched(&mut h);

    // The phone shows another tab: A's size is the window's again, at the window's grid.
    runtime.block_on(async {
        phone
            .release_resize(&mut shown)
            .await
            .expect("give the size back");
    });
    h.wait("the window holds A's size again", |h| {
        h.grid(&tab_a) == own_a && h.view(&tab_a, |v| v.holds_size()) == Some(true)
    });
    b_untouched(&mut h);

    // Back on A, then the phone drops without a word: the core gives the size back all the same.
    runtime.block_on(async {
        phone.take_resize(&mut shown).await.expect("take it again");
        phone
            .terminal_resize(&shown, 40, 20)
            .await
            .expect("size the shell");
    });
    h.wait("the phone's size again", |h| h.grid(&tab_a) == (40, 20));
    drop(phone);
    h.wait("the window holds A's size after the drop", |h| {
        h.grid(&tab_a) == own_a && h.view(&tab_a, |v| v.holds_size()) == Some(true)
    });
    b_untouched(&mut h);

    h.close();
    follower.abort();
    drop(runtime);
}

//! Two windows of this computer on one shell, against a real perch-core: the other window (the Tauri app, here a
//! second plain client) takes the shell's size and sizes it wider than this window's pane; this window becoming
//! active takes the size back, and the shell itself (`stty size`, not only the grid this window draws) is then the
//! pane's. Going inactive gives the size up, and the other window sizes the shell again.
//!
//! Everything else is `common`'s: the core is a child of this test, private to a scratch directory, and stopped and
//! checked gone by PID.

mod common;

use common::{Harness, Rig};
use perch_native::client::follow;
use std::time::Duration;

fn main() {
    common::run("workspace_window_size", window);
}

/// The size the shell reports for itself, read back from its screen.
fn stty(h: &mut Harness, id: &str, mark: &str) -> Option<(u16, u16)> {
    h.type_text(&format!("echo {mark} $(stty size)"));
    let mut found = None;
    h.wait("the shell's own size", |h| {
        found = h.rows(id).iter().rev().find_map(|row| {
            let rest = row.strip_prefix(&format!("{mark} "))?;
            let mut it = rest.split_whitespace().map(|n| n.parse::<u16>().ok());
            let (rows, cols) = (it.next()??, it.next()??);
            Some((cols, rows))
        });
        found.is_some()
    });
    found
}

fn window(rig: &mut Rig) {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    let (_base, core) = rig.start_core(&runtime);
    let shell = runtime.block_on(async {
        let mut connection = core.connect().await.expect("connect");
        let session_id = connection.create_session(None, None).await.expect("create");
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
    let follower = runtime.spawn(follow(
        move || Ok(followed.clone()),
        command_rx,
        update_tx,
        Duration::from_millis(100),
    ));
    let mut h = Harness::new(core.clone(), commands, updates);
    h.wait("the session to be listed", |h| {
        h.attention(&shell).is_some()
    });
    h.show_tab(&shell);
    h.wait("the shell", |h| h.ready(&shell));
    let own = h.fitted(&shell);
    h.wait("the shell sized to its pane", |h| h.grid(&shell) == own);
    let wide = (own.0 + 50, own.1);

    // The other window takes the size and sizes the shell wider, as the Tauri app in front would.
    let (mut other, mut held) = runtime.block_on(async {
        let mut other = core.connect().await.expect("the other window connects");
        let mut held = other
            .open_terminal(&shell, wide.0, wide.1)
            .await
            .expect("the other window watches the shell");
        other.take_resize(&mut held).await.expect("take the size");
        assert!(held.owns_resize(), "the other window holds the size");
        other
            .terminal_resize(&held, wide.0, wide.1)
            .await
            .expect("size the shell");
        (other, held)
    });
    // This window is told it is not the active one, so it leaves the size where it is.
    h.view(&shell, |v| v.window_active(false));
    h.wait("the other window's size here", |h| h.grid(&shell) == wide);
    assert_eq!(
        stty(&mut h, &shell, "wide"),
        Some(wide),
        "the shell is the other window's size"
    );

    // This window becomes active: it takes the size, and the shell is the pane's again.
    h.view(&shell, |v| v.window_active(true));
    h.wait("the size back in this window", |h| {
        h.grid(&shell) == own && h.view(&shell, |v| v.holds_size()) == Some(true)
    });
    assert_eq!(
        stty(&mut h, &shell, "own"),
        Some(own),
        "the shell is this pane's size"
    );
    // A line a program pads with a background to the terminal's width is one even band on one row: no cell of it
    // runs over into the next row, and none is left from the wider size.
    h.type_text("printf '\\033[48;5;238m%-*s\\033[0m\\n' $(tput cols) BAND");
    h.wait("the band", |h| h.has_row(&shell, "BAND"));
    let (band, below) = h
        .view(&shell, |v| {
            let frame = v.frame();
            let y = (0..frame.rows.len())
                .rev()
                .find(|&y| frame.row_text(y) == "BAND")
                .unwrap();
            let count = |y: usize| {
                frame
                    .rows
                    .get(y)
                    .map_or(0, |row| row.iter().filter(|c| c.bg.is_some()).count())
            };
            (count(y), count(y + 1))
        })
        .unwrap();
    assert_eq!(band, usize::from(own.0), "the band fills its row");
    assert_eq!(below, 0, "nothing of the band on the next row");
    runtime.block_on(async {
        // The other window hears that it lost the size.
        let deadline = std::time::Instant::now() + Duration::from_secs(5);
        while held.owns_resize() && std::time::Instant::now() < deadline {
            if let Ok(Ok(message)) =
                tokio::time::timeout(Duration::from_millis(200), other.next()).await
            {
                if let perch_core::protocol::ServerMessage::AgentLifecycleChanged {
                    status, ..
                } = message
                {
                    held.follow_owners(&status);
                }
            }
        }
        assert!(
            !held.owns_resize(),
            "the other window no longer holds the size"
        );
    });

    // Inactive again: the size is given up, so the other window may take it as the web does when nobody holds it.
    h.view(&shell, |v| v.window_active(false));
    h.wait("the size given up", |h| {
        h.view(&shell, |v| v.holds_size()) == Some(false)
    });

    runtime.block_on(async {
        other.release_terminal(&held).await.unwrap();
    });
    drop(other);
    h.close();
    follower.abort();
    drop(runtime);
}

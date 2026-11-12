//! How the window treats a terminal whose connection or shell goes away, against a real
//! perch-core: a shell that ended before anyone attached, and a core that drops and returns while
//! the shell keeps running in the terminal daemon.
//!
//! The core and the teardown are in `common`. Plain shells only; no agent runs.

mod common;

use common::{Harness, Rig};
use perch_native::client::{follow, Core};
use perch_native::terminal::Status;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

fn main() {
    common::run("workspace_lifecycle", scenario);
}

/// The shells the daemon has, as `(pid, alive)`.
fn shells(rig: &Rig) -> Vec<(u64, bool)> {
    let text = common::daemon_tool(&rig.daemon_dir, &["ps"]).expect("the daemon lists its shells");
    let list: serde_json::Value = serde_json::from_str(&text).unwrap();
    list.as_array()
        .unwrap()
        .iter()
        .map(|s| {
            (
                s["pid"].as_u64().unwrap_or(0),
                s["alive"].as_bool().unwrap(),
            )
        })
        .collect()
}

fn scenario(rig: &mut Rig) {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    let (_, core) = rig.start_core(&runtime);
    // The core the window and the follower look for, each time they need one.
    let current = Arc::new(Mutex::new(core.clone()));
    let (ended, kept) = runtime.block_on(async {
        let mut connection = core.connect().await.expect("connect");
        let mut ids = Vec::new();
        for _ in 0..2 {
            let id = connection.create_session(None, None).await.expect("create");
            let terminal = connection.open_terminal(&id, 80, 24).await.expect("open");
            connection.release_terminal(&terminal).await.unwrap();
            ids.push(id);
        }
        (ids[0].clone(), ids[1].clone())
    });
    let (commands, command_rx) = futures::channel::mpsc::unbounded();
    let (update_tx, updates) = futures::channel::mpsc::unbounded();
    let for_follower = current.clone();
    let follower = runtime.spawn(follow(
        move || Ok(for_follower.lock().unwrap().clone()),
        command_rx,
        update_tx,
        Duration::from_millis(100),
    ));
    let for_window = current.clone();
    let mut h = Harness::locating(
        move || Ok(for_window.lock().unwrap().clone()),
        commands,
        updates,
    );
    h.wait("the sessions to be listed", |h| {
        h.attention(&ended).is_some() && h.attention(&kept).is_some()
    });

    a_shell_that_ended_before_attach(rig, &mut h, &ended);
    a_core_that_drops_and_returns(rig, &runtime, &current, &mut h, &kept);

    h.close();
    follower.abort();
    drop(runtime);
}

/// The core refuses to attach a shell that is gone; the view says it could not open the terminal,
/// with the core's reason. It does not call that an exit (the core does not say the shell
/// exited) and nothing starts a new shell in its place.
fn a_shell_that_ended_before_attach(rig: &Rig, h: &mut Harness, id: &str) {
    h.show_tab(id);
    h.wait("the shell", |h| h.ready(id));
    h.type_text("exit");
    h.wait("the exit", |h| {
        h.view(id, |v| matches!(v.status(), Status::Exited(0)))
            .unwrap_or(false)
    });
    let alive_before = shells(rig).iter().filter(|s| s.1).count();
    assert!(h.press("cmd-w"), "the tab closes");
    h.wait("the tab to go", |h| h.shown().is_empty());

    h.show_tab(id);
    h.wait("the refusal", |h| {
        h.view(id, |v| matches!(v.status(), Status::Failed(_)))
            .unwrap_or(false)
    });
    let status = h.view(id, |v| v.status().clone()).unwrap();
    let Status::Failed(reason) = status else {
        unreachable!()
    };
    assert!(reason.contains("no longer available"), "{reason}");
    let note = h.view(id, |v| v.note()).flatten().unwrap();
    assert!(note.starts_with("Could not open the terminal"), "{note}");
    // Nothing is retried or started over.
    h.settle();
    assert!(matches!(
        h.view(id, |v| v.status().clone()),
        Some(Status::Failed(_))
    ));
    assert_eq!(
        shells(rig).iter().filter(|s| s.1).count(),
        alive_before,
        "no shell was started in its place"
    );
    assert!(h.press("cmd-w"));
    h.wait("the tab to go", |h| h.shown().is_empty());
}

/// The core goes away and comes back at another address. The pane keeps its screen and says it is
/// waiting, never shows an exit, tries again with growing waits, and attaches to the same shell
/// when the core is back: the screen is repainted once, typing works, a search keeps working.
fn a_core_that_drops_and_returns(
    rig: &mut Rig,
    runtime: &tokio::runtime::Runtime,
    current: &Arc<Mutex<Core>>,
    h: &mut Harness,
    id: &str,
) {
    h.show_tab(id);
    h.wait("the shell", |h| h.ready(id));
    h.type_text("echo pid-$$");
    h.wait("the pid", |h| {
        h.rows(id).iter().any(|r| r.starts_with("pid-"))
    });
    let pid_line = h
        .rows(id)
        .into_iter()
        .find(|r| r.starts_with("pid-"))
        .unwrap();
    let pid: u64 = pid_line.trim_start_matches("pid-").parse().unwrap();
    assert!(shells(rig).contains(&(pid, true)));
    h.view_cx(id, |v, cx| {
        v.open_find(cx);
        v.set_find_query("pid-", cx)
    });
    let found = |h: &mut Harness| {
        // The index is built in steps on a timer; the test takes the steps itself.
        let label = h
            .view_cx(id, |v, cx| {
                v.search_tick(cx);
                v.find_label()
            })
            .unwrap();
        label.contains(" / ") || label.contains("matches")
    };
    h.wait("the search", found);

    let old_core = rig.core_pid().unwrap();
    rig.stop_core().unwrap();
    assert!(common::pid_gone(old_core));
    // Dropped, not ended; the screen stays and the note says the window is waiting.
    let mut seen = Vec::new();
    let until = Instant::now() + Duration::from_millis(2500);
    h.wait("the drop", |h| {
        h.view(id, |v| {
            matches!(v.status(), Status::Disconnected(_) | Status::Connecting)
        })
        .unwrap_or(false)
    });
    // The core stays away for a while: several tries fail, none of them is an exit or a failure.
    while Instant::now() < until {
        h.wait("a quiet moment", |_| true);
        h.settle();
        seen.push(h.view(id, |v| v.status().clone()).unwrap());
    }
    assert!(
        seen.iter()
            .all(|s| matches!(s, Status::Disconnected(_) | Status::Connecting)),
        "{seen:?}"
    );
    assert!(h.rows(id).contains(&pid_line), "the screen is kept");
    let note = h.view(id, |v| v.note()).flatten().unwrap_or_default();
    assert!(
        note.contains("econnect"),
        "the note says the window is waiting: {note:?}"
    );
    assert!(
        shells(rig).contains(&(pid, true)),
        "the shell keeps running"
    );

    // The core comes back, listening elsewhere.
    let (_, core) = rig.start_core(runtime);
    *current.lock().unwrap() = core;
    let mut seen = Vec::new();
    h.wait("the pane to attach again", |h| {
        seen.push(h.view(id, |v| v.status().clone()).unwrap());
        h.ready(id)
    });
    assert!(
        seen.iter()
            .all(|s| !matches!(s, Status::Exited(_) | Status::Failed(_))),
        "never an exit: {seen:?}"
    );
    // The same shell, repainted once: the old screen was replaced, not added to.
    let lines = h.rows(id).iter().filter(|r| **r == pid_line).count();
    assert_eq!(lines, 1, "{:?}", h.rows(id));
    // The find field holds the keys while it is open: close it to type at the shell.
    h.view_cx(id, |v, cx| v.close_find(cx));
    h.type_text("echo again-$$");
    let again = format!("again-{pid}");
    h.wait("the same shell", |h| h.has_row(id, &again));
    let alive: Vec<_> = shells(rig).into_iter().filter(|s| s.1).collect();
    assert_eq!(alive, [(pid, true)], "no second shell was started");
    // The search kept its query across the reattach.
    assert_eq!(h.view(id, |v| v.find_query().to_string()).unwrap(), "pid-");
    h.view_cx(id, |v, cx| v.open_find(cx));
    h.wait("the search to find the repainted line", found);
}

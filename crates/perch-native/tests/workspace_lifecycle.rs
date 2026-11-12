//! How the window treats a terminal whose connection or shell goes away, against a real
//! perch-core: a shell that ended before anyone attached, and a core that drops and returns while
//! the shell keeps running in the terminal daemon.
//!
//! Closing a tab ends a plain terminal only when the core confirms it, and says so when it does
//! not.
//!
//! The core and the teardown are in `common`. Plain shells only; no agent runs.

mod common;

use common::{Harness, Rig};
use perch_native::client::{follow, Core};
use perch_native::terminal::actions::Action;
use perch_native::terminal::Status;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

fn main() {
    common::run("workspace_lifecycle", scenario);
}

/// `count` new plain shells in the core, started and let go again. The first ends at once when
/// `first_exits`, with nobody attached to see it.
fn new_shells(
    runtime: &tokio::runtime::Runtime,
    core: &Core,
    count: usize,
    first_exits: bool,
) -> Vec<String> {
    runtime.block_on(async {
        let mut connection = core.connect().await.expect("connect");
        let mut ids = Vec::new();
        for n in 0..count {
            let id = connection.create_session(None, None).await.expect("create");
            let terminal = connection.open_terminal(&id, 80, 24).await.expect("open");
            if first_exits && n == 0 {
                connection
                    .terminal_input(&terminal, "exit\r", false)
                    .await
                    .unwrap();
            }
            connection.release_terminal(&terminal).await.unwrap();
            ids.push(id);
        }
        ids
    })
}

fn has_tab(h: &mut Harness, id: &str) -> bool {
    h.ws(|ws, _| ws.tabs().contains(id))
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
    let ids = new_shells(&runtime, &core, 2, true);
    let (ended, kept) = (ids[0].clone(), ids[1].clone());
    common::wait_until("the first shell to end", || {
        shells(rig).iter().filter(|s| s.1).count() == 1
    })
    .unwrap();
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
    closing_waits_for_the_core(rig, &runtime, &current, &mut h);
    typing_is_shared_but_stopping_is_not(rig, &runtime, &current, &mut h);

    h.close();
    follower.abort();
    drop(runtime);
}

/// The core refuses to attach a shell that is gone; the view says it could not open the terminal,
/// with the core's reason. It does not call that an exit (the core does not say the shell
/// exited) and nothing starts a new shell in its place.
fn a_shell_that_ended_before_attach(rig: &Rig, h: &mut Harness, id: &str) {
    let alive_before = shells(rig).iter().filter(|s| s.1).count();
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
    // A tab the core never attached has nothing to end: closing it only puts the terminal away,
    // and says it keeps running.
    assert!(h.press("cmd-w"));
    h.wait("the tab to go", |h| h.shown().is_empty());
    let note = h
        .ws(|ws, _| ws.notice().map(str::to_owned))
        .unwrap_or_default();
    assert!(note.contains("keeps running"), "{note}");
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

/// Closing a plain terminal's tab asks the core over the terminal's own connection and keeps the
/// tab until the core says the session ended. A core that does not answer leaves the tab open,
/// saying the terminal is still running; the shell is never taken for ended on a guess.
fn closing_waits_for_the_core(
    rig: &mut Rig,
    runtime: &tokio::runtime::Runtime,
    current: &Arc<Mutex<Core>>,
    h: &mut Harness,
) {
    let core = current.lock().unwrap().clone();
    let ids = new_shells(runtime, &core, 2, false);
    let (confirmed, silent) = (ids[0].clone(), ids[1].clone());
    let alive = |rig: &Rig| shells(rig).iter().filter(|s| s.1).count();

    // The core answers: the shell ends, the session is gone, and then the tab goes.
    h.wait("the sessions to be listed", |h| {
        h.attention(&confirmed).is_some() && h.attention(&silent).is_some()
    });
    h.show_tab(&confirmed);
    h.wait("the shell", |h| h.ready(&confirmed));
    let before = alive(rig);
    assert!(h.press("cmd-w"));
    h.wait("the tab to go", |h| !has_tab(h, &confirmed));
    h.wait("the session to be gone", |h| {
        h.attention(&confirmed).is_none()
    });
    assert_eq!(alive(rig), before - 1, "the shell ended");

    // The core does not answer: frozen, it reads nothing.
    h.show_tab(&silent);
    h.wait("the shell", |h| h.ready(&silent));
    let before = alive(rig);
    let core_pid = rig.core_pid().unwrap() as i32;
    // SAFETY: stops, then resumes, the core process this test started.
    unsafe { libc::kill(core_pid, libc::SIGSTOP) };
    assert!(h.press("cmd-w"));
    h.settle();
    assert!(has_tab(h, &silent), "the tab waits for the core");
    let note = h
        .ws(|ws, _| ws.notice().map(str::to_owned))
        .unwrap_or_default();
    assert!(note.contains("Ending"), "{note}");
    h.cx.advance_clock(Duration::from_secs(6));
    h.settle();
    assert!(has_tab(h, &silent), "the tab stays");
    assert_eq!(alive(rig), before, "nothing was stopped on a guess");
    let note = h
        .ws(|ws, _| ws.notice().map(str::to_owned))
        .unwrap_or_default();
    assert!(
        note.contains("still running") && note.contains("did not answer"),
        "{note}"
    );
    // SAFETY: as above.
    unsafe { libc::kill(core_pid, libc::SIGCONT) };
}

/// Another connection holds a shell's keyboard. The core allows shared typing, so this window
/// types in the same shell; stopping it, and ending its session by closing the tab, need the
/// keyboard and are not offered.
fn typing_is_shared_but_stopping_is_not(
    rig: &mut Rig,
    runtime: &tokio::runtime::Runtime,
    current: &Arc<Mutex<Core>>,
    h: &mut Harness,
) {
    let core = current.lock().unwrap().clone();
    // Kept open for the whole scenario: it is the view that holds the keyboard.
    let (_holder, id) = runtime.block_on(async {
        let mut connection = core.connect().await.expect("connect");
        let id = connection.create_session(None, None).await.expect("create");
        let terminal = connection.open_terminal(&id, 80, 24).await.expect("open");
        assert!(terminal.owns_input(), "the first view holds the keyboard");
        ((connection, terminal), id)
    });
    h.wait("the session to be listed", |h| h.attention(&id).is_some());
    h.show_tab(&id);
    h.wait("the shared view", |h| {
        h.view(&id, |v| v.can_type() && !v.can_stop())
            .unwrap_or(false)
    });
    assert!(
        h.view(&id, |v| v.note()).flatten().is_none(),
        "nothing to warn about"
    );

    h.type_text("echo shared-$((6*7))");
    h.wait("the shell to hear it", |h| h.has_row(&id, "shared-42"));

    // Stopping needs the keyboard.
    assert!(!h.view_cx(&id, |v, cx| v.perform(Action::Kill, cx)).unwrap());
    let alive = shells(rig).iter().filter(|s| s.1).count();
    // Closing only puts the tab away; the session and its shell go on.
    assert!(h.press("cmd-w"));
    h.wait("the tab to go", |h| !has_tab(h, &id));
    h.settle();
    assert!(h.attention(&id).is_some(), "the session is still listed");
    assert_eq!(shells(rig).iter().filter(|s| s.1).count(), alive);
}

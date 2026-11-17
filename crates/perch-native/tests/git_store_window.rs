//! The window's Git store against a real perch-core: a repository registered as a project, its status, its
//! working-tree diff, a line comment kept by the core, and a discard preview whose promise settles with the core's
//! receipt. The window sends through its own connection (`Workspace::ask`); nothing is destroyed (the preview is
//! never confirmed).
//!
//! The core and the teardown are in `common`. No agent runs.

mod common;

use common::{Harness, Rig};
use perch_core::review::ReviewSide;
use perch_core::source_control::DiffTarget;
use perch_native::client::follow;
use perch_native::git::store::{LoadState, NewComment};
use perch_native::sidebar::LOCAL;
use std::path::Path;
use std::process::Command;
use std::time::Duration;

fn main() {
    common::run("git_store_window", scenario);
}

fn git(repo: &Path, args: &[&str]) {
    let status = Command::new("git")
        .args([
            "-c",
            "user.name=Perch Test",
            "-c",
            "user.email=test@perch.invalid",
        ])
        .args(args)
        .current_dir(repo)
        .env("HOME", repo)
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .status()
        .expect("git runs");
    assert!(status.success(), "git {args:?}");
}

fn scenario(rig: &mut Rig) {
    let repo = rig.scratch.join("repo");
    std::fs::create_dir_all(&repo).unwrap();
    git(&repo, &["init", "-q", "-b", "main"]);
    std::fs::write(repo.join("a.txt"), "one\ntwo\n").unwrap();
    git(&repo, &["add", "a.txt"]);
    git(&repo, &["commit", "-q", "-m", "first"]);
    std::fs::write(repo.join("a.txt"), "one\ntwo changed\n").unwrap();

    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    let (_, core) = rig.start_core(&runtime);
    let (commands, command_rx) = futures::channel::mpsc::unbounded();
    let (update_tx, updates) = futures::channel::mpsc::unbounded();
    let for_follower = core.clone();
    let follower = runtime.spawn(follow(
        move || Ok(for_follower.clone()),
        command_rx,
        update_tx,
        Duration::from_millis(100),
    ));
    let mut h = Harness::new(core, commands, updates);
    let workspace = h.window.entity(&h.cx).unwrap();
    let mods_dir = rig.scratch.join("native-mods");
    let window = h.window;
    h.cx.update(|cx| perch_native::mods::start_in(mods_dir, &workspace, window.into(), cx));
    let git_host =
        h.cx.update(|cx| perch_native::git::host(cx))
            .expect("the window keeps Git");

    let path = repo.display().to_string();
    h.wait("the connection", |h| {
        h.ws(|ws, cx| ws.sidebar().read(cx).model().connected)
    });
    h.window
        .update(&mut h.cx, |ws, _, cx| {
            ws.add_project(LOCAL, &path, None, cx)
        })
        .unwrap();
    let mut id = String::new();
    h.wait("the project's workspace, with Git offered", |h| {
        let found = h.ws(|ws, cx| {
            let model = ws.sidebar().read(cx).model();
            model
                .store
                .workspaces
                .iter()
                .find(|w| w.path == path)
                .map(|w| {
                    (
                        w.id.clone(),
                        perch_native::git::can_take(model.connected, &model.store, &w.id),
                    )
                })
        });
        match found {
            Some((found, true)) => {
                id = found;
                true
            }
            _ => {
                let state = h.ws(|ws, _| ws.add_project_state().clone());
                assert_ne!(state["status"], "error", "the project is refused: {state}");
                false
            }
        }
    });

    // Status.
    let ws_id = id.clone();
    h.cx.update(|cx| {
        git_host.run(
            &ws_id,
            |s, ready, out| s.refresh_status(&ws_id, ready, out),
            cx,
        )
    });
    h.wait("the status", |_| {
        git_host.review(&id).status_state != LoadState::Loading
    });
    let review = git_host.review(&id);
    assert_eq!(
        review.status_state,
        LoadState::Ready,
        "status: {:?}",
        review.status_error
    );
    let status = review.status.expect("a status");
    assert!(
        status.to_string().contains("a.txt"),
        "the changed file is listed: {status}"
    );
    assert_eq!(status["dirty"], true, "a changed file makes the tree dirty");
    println!("ok: the status comes back through the window's connection");

    // Diff.
    let ws_id = id.clone();
    h.cx.update(|cx| {
        git_host.run(
            &ws_id,
            |s, ready, out| {
                s.load_diff(
                    &ws_id,
                    DiffTarget::WorkingTree,
                    None,
                    true,
                    false,
                    3,
                    ready,
                    out,
                )
            },
            cx,
        )
    });
    h.wait("the diff", |_| {
        git_host.review(&id).diff_state != LoadState::Loading
    });
    let review = git_host.review(&id);
    assert_eq!(
        review.diff_state,
        LoadState::Ready,
        "diff: {:?}",
        review.diff_error
    );
    let diff = review.diff.expect("a diff");
    assert_eq!(diff.files.len(), 1);
    assert!(
        diff.source_revision_for("a.txt", ReviewSide::New).is_some(),
        "the core names its revision"
    );
    println!("ok: the working-tree diff carries the core's revision");

    // A comment on the changed line, kept by the core and listed back.
    let ws_id = id.clone();
    h.cx.update(|cx| {
        git_host.run(
            &ws_id,
            |s, ready, out| {
                let input = NewComment {
                    id: "comment-native-test".into(),
                    path: "a.txt".into(),
                    side: ReviewSide::New,
                    start: 2,
                    end: 2,
                    body: "check this".into(),
                };
                s.create_comment(&ws_id, input, None, ready, out)
            },
            cx,
        )
    });
    h.wait("the comment", |_| {
        git_host
            .review(&id)
            .comments
            .iter()
            .any(|c| c.body == "check this")
    });
    println!("ok: a line comment is kept by the core");

    // A discard preview: its promise settles with the core's receipt (never confirmed here).
    let ws_id = id.clone();
    let ticket = h.cx.update(|cx| {
        git_host.run(
            &ws_id,
            |s, ready, out| s.discard_preview(&ws_id, "worktree", vec!["a.txt".into()], ready, out),
            cx,
        )
    });
    let mut receipt = git_host.wait(ticket);
    let mut value = None;
    h.wait("the discard preview", |_| match receipt.try_recv() {
        Ok(Some(v)) => {
            value = Some(v);
            true
        }
        _ => false,
    });
    let value = value.unwrap();
    assert!(
        value["previewId"].as_str().is_some_and(|p| !p.is_empty()),
        "a receipt: {value}"
    );
    assert_eq!(
        std::fs::read_to_string(repo.join("a.txt")).unwrap(),
        "one\ntwo changed\n",
        "a preview changes nothing"
    );
    println!("ok: a preview's promise settles with the core's receipt");

    // The workspace's review as a tab: the stock review runs in the tab's pane, places the native
    // diff by key, and the diff view draws the core's diff from the window's store.
    let tab = perch_native::workspace::review_tab_id(&id);
    h.window
        .update(&mut h.cx, |ws, _, cx| ws.open_review(&id, cx))
        .unwrap();
    let diffs =
        h.cx.update(|cx| cx.global::<perch_native::mods::WindowMods>().diffs.clone());
    let key = format!("diff:{id}");
    let screen = format!("review#{tab}");
    h.wait("the review tab's diff drawn natively", |h| {
        let (shown, error) = h
            .window
            .update(&mut h.cx, |ws, _, cx| {
                (
                    ws.tabs().shown().contains(&tab),
                    ws.screen_error(&screen, cx),
                )
            })
            .unwrap();
        assert!(error.is_none(), "the review screen runs: {error:?}");
        shown
            && diffs
                .view(&key)
                .is_some_and(|view| h.cx.update(|cx| view.read(cx).rows().rows.len()) > 2)
    });
    println!("ok: the review opens as a tab, runs natively and its diff is the native view");

    // `workspace.git` opens the drawer's Git tab with the review of that workspace.
    h.window
        .update(&mut h.cx, |ws, window, cx| {
            ws.run_command(
                "workspace.git",
                Some(&serde_json::json!({ "id": id })),
                window,
                cx,
            )
        })
        .unwrap()
        .expect("workspace.git runs");
    h.wait("the drawer's review", |h| {
        let (placed, error) = h
            .window
            .update(&mut h.cx, |ws, _, cx| {
                (
                    ws.screen_view("review#drawer").is_some(),
                    ws.screen_error("review#drawer", cx),
                )
            })
            .unwrap();
        assert!(error.is_none(), "the drawer's review runs: {error:?}");
        placed
    });
    println!("ok: workspace.git shows the review in the drawer's Git tab");

    h.close();
    follower.abort();
}

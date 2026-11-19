//! A lead's sub-sessions sit with it, whatever checkout they run in: a real core starts one plain
//! sub-session and one with `--worktree`, and the window's strip lists both right after the lead,
//! the sidebar's navigation lists them in that order under the lead's workspace, the worktree child
//! carries no worktree mark, and the checkout is no separate row. The status bar shows the folder
//! of the tab on screen and follows a tab switch.
//!
//! The agent is a stand-in `claude` that only sleeps, found on a PATH of the scratch folder and the
//! system's own directories, so no real agent can start. The core and the teardown are in `common`.

mod common;

use common::{Harness, Rig};
use perch_core::agent_fleet::AgentKey;
use perch_core::agent_identity::IdentityStore;
use perch_native::client::follow;
use perch_native::mods::{self, WindowMods};
use serde_json::{json, Value};
use std::io::{Read, Write};
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::process::Command;
use std::time::Duration;

fn main() {
    common::run("subsession_layout_window", window);
}

fn git(dir: &Path, args: &[&str]) {
    let status = Command::new("git")
        .args(args)
        .current_dir(dir)
        .env("GIT_AUTHOR_NAME", "t")
        .env("GIT_AUTHOR_EMAIL", "t@example.com")
        .env("GIT_COMMITTER_NAME", "t")
        .env("GIT_COMMITTER_EMAIL", "t@example.com")
        .status()
        .unwrap();
    assert!(status.success(), "git {args:?}");
}

/// `POST {base}agent/spawn` as the lead's `perch spawn` sends it.
fn spawn(base: &str, token: &str, body: Value) -> Value {
    let address = base
        .trim_start_matches("http://")
        .trim_end_matches('/')
        .to_string();
    let body = body.to_string();
    let mut stream = std::net::TcpStream::connect(&address).unwrap();
    write!(
        stream,
        "POST /agent/spawn HTTP/1.1\r\nHost: {address}\r\nAuthorization: Bearer {token}\r\n\
         Content-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
    .unwrap();
    let mut answer = String::new();
    stream.read_to_string(&mut answer).unwrap();
    let (head, json) = answer.split_once("\r\n\r\n").unwrap();
    assert!(head.starts_with("HTTP/1.1 200"), "spawn refused: {answer}");
    serde_json::from_str(json).unwrap()
}

fn window(rig: &mut Rig) {
    // Only the stand-in agent and the system's tools: never a real agent from the person's PATH.
    let bin = rig.scratch.join("bin");
    std::fs::create_dir_all(&bin).unwrap();
    let fake = bin.join("claude");
    std::fs::write(
        &fake,
        // Launched as an agent (`--session-id`) it waits to be stopped; any probe of the core's
        // gets an answer at once, so nothing outlives the test.
        "#!/bin/sh\ncase \" $* \" in *\" --session-id \"*) exec sleep 600 ;; esac\necho 2.0.0\n",
    )
    .unwrap();
    std::fs::set_permissions(&fake, std::fs::Permissions::from_mode(0o755)).unwrap();
    std::env::set_var(
        "PATH",
        format!("{}:/usr/bin:/bin:/usr/sbin:/sbin", bin.display()),
    );
    std::env::set_var("PERCH_NO_LOGIN_PATH", "1");

    let folder = rig.scratch.join("project");
    std::fs::create_dir_all(&folder).unwrap();
    git(&folder, &["init", "-q", "-b", "main"]);
    std::fs::write(folder.join("a.txt"), "a\n").unwrap();
    git(&folder, &["add", "."]);
    git(&folder, &["commit", "-q", "-m", "first"]);
    let folder = folder.to_string_lossy().to_string();

    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    let (base, core) = rig.start_core(&runtime);
    let (lead, terminal) = runtime.block_on(async {
        let mut connection = core.connect().await.expect("connect");
        connection.create_project(&folder).await.expect("project");
        let mut open = Vec::new();
        for _ in 0..2 {
            let session = connection
                .create_session(Some(&folder), None)
                .await
                .expect("create");
            let view = connection
                .open_terminal(&session, 80, 24)
                .await
                .expect("open terminal");
            connection.release_terminal(&view).await.unwrap();
            open.push(session);
        }
        (open[0].clone(), open[1].clone())
    });

    let (commands, command_rx) = futures::channel::mpsc::unbounded();
    let (update_tx, updates) = futures::channel::mpsc::unbounded();
    let follower = {
        let core = core.clone();
        runtime.spawn(follow(
            move || Ok(core.clone()),
            command_rx,
            update_tx,
            Duration::from_millis(100),
        ))
    };
    let mut h = Harness::new(core, commands, updates);
    let workspace_entity = h.window.entity(&h.cx).unwrap();
    let window_handle = h.window.into();
    let user = rig.scratch.join("native-mods");
    h.cx.update(|cx| mods::start_in(user, &workspace_entity, window_handle, cx));

    let store = |h: &mut Harness| h.ws(|ws, cx| ws.sidebar().read(cx).model().store.clone());
    h.wait("both sessions in their workspace", |h| {
        let store = store(h);
        [&lead, &terminal].iter().all(|id| {
            store
                .sessions
                .iter()
                .any(|s| s.id == **id && s.workspace_id.is_some())
        })
    });
    let workspace = store(&mut h)
        .sessions
        .iter()
        .find(|s| s.id == lead)
        .and_then(|s| s.workspace_id.clone())
        .unwrap();
    h.show_tab(&lead);
    h.wait("the core to keep the strip", |h| {
        store(h)
            .shared_tabs
            .get(&workspace)
            .is_some_and(|t| t.strip == [lead.clone(), terminal.clone()])
    });

    // The lead's own identity, as the core hands it to the agent it launches.
    let db = perch_core::db::HistoryDb::open(rig.scratch.join("history.sqlite")).unwrap();
    let token = db
        .issue(&AgentKey::new(&workspace, &lead, "claude").unwrap())
        .unwrap()
        .token;
    let started = |answer: Value| answer["session"].as_str().unwrap().to_string();
    let plain = started(spawn(
        &base,
        &token,
        json!({"session": lead, "agent": "claude", "name": "Plain helper", "key": "plain",
               "task": "Look at the tests and say what fails."}),
    ));
    let review = started(spawn(
        &base,
        &token,
        json!({"session": lead, "agent": "claude", "name": "Review shared tabs", "key": "review",
               "worktree": true, "task": "Read and execute the plan in plans/task.md"}),
    ));

    // The strip: each sub-session right after its lead, in the order they were started.
    let placed = vec![
        lead.clone(),
        plain.clone(),
        review.clone(),
        terminal.clone(),
    ];
    h.wait("the strip to list the sub-sessions after their lead", |h| {
        h.ws(|ws, _| ws.tabs().strip().to_vec()) == placed
    });

    // The sidebar: the same order in the lead's workspace, each child naming its lead; the worktree
    // child carries no worktree mark, and the checkout has no row of its own.
    let call = |h: &mut Harness, name: &str, args: Vec<Value>| {
        h.cx.update(|cx| {
            let perch = cx.global::<WindowMods>().perch.clone();
            let module = perch.module("probe");
            let args: Vec<_> = args.iter().map(mods::perch::to_host).collect();
            mods::perch::from_host(
                &module
                    .call(name, &gpui_shell::HostArguments::new(args))
                    .unwrap(),
            )
        })
    };
    let navigation = call(&mut h, "navigation", vec![json!({"showTerminals": true})]);
    let project = navigation["projects"]
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["path"] == json!(folder))
        .unwrap()
        .clone();
    let shown: Vec<&Value> = project["workspaces"].as_array().unwrap().iter().collect();
    assert_eq!(
        shown.len(),
        1,
        "the checkout is no separate row: {shown:#?}"
    );
    let rows: Vec<&Value> = shown[0]["sessions"].as_array().unwrap().iter().collect();
    let ids: Vec<&str> = rows.iter().map(|s| s["id"].as_str().unwrap()).collect();
    assert_eq!(ids, placed.iter().map(String::as_str).collect::<Vec<_>>());
    let row = |id: &str| rows.iter().find(|s| s["id"] == json!(id)).unwrap();
    assert_eq!(row(&plain)["parentId"], json!(lead));
    assert_eq!(row(&review)["parentId"], json!(lead));
    assert!(row(&review).get("checkout").is_none());
    let hidden = project["hidden"].as_array().unwrap();
    assert_eq!(hidden.len(), 1, "the checkout waits in the hidden list");
    let checkout = hidden[0]["path"].as_str().unwrap().to_string();
    assert!(checkout.ends_with("review-shared-tabs"), "{checkout}");
    assert_eq!(row(&review)["cwd"], json!(checkout));

    // The status bar follows the tab on screen: the worktree child's checkout, then the lead's folder.
    h.show_tab(&review);
    h.wait("the sub-session's tab", |h| {
        h.active().as_deref() == Some(review.as_str())
    });
    let line = call(&mut h, "statusLine", vec![]);
    assert_eq!(
        (&line["cwd"], &line["branch"]),
        (&json!(checkout), &json!("review-shared-tabs"))
    );
    h.show_tab(&lead);
    h.wait("the lead's tab", |h| {
        h.active().as_deref() == Some(lead.as_str())
    });
    let line = call(&mut h, "statusLine", vec![]);
    assert_eq!(
        (&line["cwd"], &line["branch"]),
        (&json!(folder), &json!("main"))
    );

    h.close();
    follower.abort();
    drop(runtime);
}

//! The window's tab strip belongs to the workspace on screen, as the web's: switching workspace
//! shows that workspace's own tabs (sessions, files, browser pages), or no strip when it has none,
//! and switching back brings the strip, its active tab and its Back and Forward history as they
//! were left. A Quickchat session is in the Quickchat workspace, never in a project's strip.
//! A strip lists every session the core has for its workspace, and every strip (its files,
//! review and browser tabs, splits and active tab) comes back after a relaunch.
//!
//! Offscreen: no window is shown or focused, no core runs, and every change goes through the
//! window's own commands.

use gpui::{px, size, AppContext as _, HeadlessAppContext};
use perch_core::protocol::ServerMessage;
use perch_native::mods::{self, WindowMods, POLL};
use perch_native::sidebar::State;
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

/// Projects `p` (checkout `w1`: alpha, bravo), `q` (`w2`: delta) and Quickchat (`w3`: chat).
fn state() -> State {
    state_with(|_| {})
}

/// `state`, with `edit` applied to each session as the core lists it.
fn state_with(edit: impl Fn(&mut Value)) -> State {
    let project = |id: &str, path: &str| {
        json!({"id": id, "hostId": "local", "name": id, "path": path,
            "favorite": false, "createdAt": 0, "updatedAt": 0, "quickchat": path == "/home"})
    };
    let checkout = |id: &str, project: &str, path: &str| {
        json!({"id": id, "projectId": project, "hostId": "local", "path": path,
            "name": id, "dirty": false, "state": "active", "createdAt": 0, "updatedAt": 0,
            "pinned": false})
    };
    let projects = vec![
        project("p", "/work"),
        project("q", "/other"),
        project("c", "/home"),
    ];
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "server.info", "hostname": "studio", "isSsh": false, "platform": "macOS",
        "capabilities": ["workspace.snapshot", "workspace.order.v1"]})));
    state.apply(&message(json!({
        "type": "project.list", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": projects.clone()})));
    state.apply(&message(json!({
        "type": "workspace.snapshot", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": projects, "workspaces": [
            checkout("w1", "p", "/work"), checkout("w2", "q", "/other"),
            checkout("w3", "c", "/home")]})));
    let sessions: Vec<Value> = [
        ("alpha", "p", "w1", "/work"),
        ("bravo", "p", "w1", "/work"),
        ("delta", "q", "w2", "/other"),
        ("chat", "c", "w3", "/home"),
    ]
    .iter()
    .enumerate()
    .map(|(i, (id, project, workspace, cwd))| {
        let mut session = json!({"id": id, "title": id, "cwd": cwd, "createdAt": i,
            "status": "idle", "hostId": "local", "projectId": project, "workspaceId": workspace,
            "cliProviderId": "claude"});
        edit(&mut session);
        session
    })
    .collect();
    state.apply(&message(
        json!({"type": "session.list", "sessions": sessions}),
    ));
    state
}

fn strings(list: &[&str]) -> Vec<String> {
    list.iter().map(|s| s.to_string()).collect()
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-workspace-tabs-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    let user = scratch.join("native-mods");
    let kept = user.join(".window.json");

    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let model = state().model();
    let window = cx
        .open_window(size(px(1000.), px(900.)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, None, cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
                    .with_window_state(kept.clone())
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user.clone(), &workspace, window.into(), cx));

    let settle = |cx: &mut HeadlessAppContext| {
        for _ in 0..3 {
            cx.advance_clock(POLL);
            cx.run_until_parked();
        }
    };
    // The strip and the active tab on screen.
    let tabs = |cx: &mut HeadlessAppContext| {
        settle(cx);
        window
            .update(cx, |ws, _, _| {
                (
                    ws.tabs().strip().to_vec(),
                    ws.tabs().active().map(str::to_string),
                )
            })
            .unwrap()
    };
    let open = |cx: &mut HeadlessAppContext, id: &str| {
        window
            .update(cx, |ws, _, cx| {
                ws.sidebar().update(cx, |s, cx| {
                    s.open("local".into(), id.into(), Some("claude".into()), cx)
                })
            })
            .unwrap();
        settle(cx);
    };
    let run = |cx: &mut HeadlessAppContext, name: &str, args: Value| {
        let result = window
            .update(cx, |ws, window, cx| {
                ws.run_command(name, Some(&args), window, cx)
            })
            .unwrap();
        settle(cx);
        result
    };

    // One project's sessions: opening one puts every session of its workspace in the strip.
    open(&mut cx, "alpha");
    assert_eq!(
        tabs(&mut cx),
        (strings(&["alpha", "bravo"]), Some("alpha".into()))
    );
    open(&mut cx, "bravo");
    run(&mut cx, "tab.select", json!({"id": "alpha"})).unwrap();
    assert_eq!(
        tabs(&mut cx),
        (strings(&["alpha", "bravo"]), Some("alpha".into()))
    );
    // A file of this workspace is a tab of its strip.
    window
        .update(&mut cx, |ws, _, cx| {
            ws.open_file("w1", "src/a.rs", false, cx)
        })
        .unwrap();
    let (strip, active) = tabs(&mut cx);
    assert_eq!(strip.len(), 3, "the file joins w1's strip: {strip:?}");
    let file = active.clone().expect("the file is shown");
    assert!(file.starts_with("w1\n"), "{file}");
    // The file on screen is what names the workspace the strip's + works in.
    let perch = cx.update(|cx| cx.global::<WindowMods>().perch.clone());
    assert_eq!(perch.shown_place().1.as_deref(), Some("w1"));

    // Another project: nothing of the first project's strip is there. With no tab yet it shows its
    // newest session, as after a launch, when no workspace has a tab.
    run(&mut cx, "workspace.open", json!({"id": "w2"})).unwrap();
    assert_eq!(tabs(&mut cx), (strings(&["delta"]), Some("delta".into())));
    // Back and Forward stay in this workspace: w1's places are not offered.
    run(&mut cx, "nav.back", json!({})).unwrap();
    assert_eq!(tabs(&mut cx).1.as_deref(), Some("delta"), "history is w2's");

    // A Quickchat session is in the Quickchat workspace, not the project's strip.
    open(&mut cx, "chat");
    assert_eq!(tabs(&mut cx), (strings(&["chat"]), Some("chat".into())));

    // Back to each: the strip, its active tab and the file as they were left.
    run(&mut cx, "workspace.open", json!({"id": "w1"})).unwrap();
    assert_eq!(
        tabs(&mut cx),
        (strip.clone(), Some(file.clone())),
        "w1's tabs and active tab are restored"
    );
    run(&mut cx, "workspace.open", json!({"id": "w2"})).unwrap();
    assert_eq!(tabs(&mut cx), (strings(&["delta"]), Some("delta".into())));
    run(&mut cx, "workspace.open", json!({"id": "w3"})).unwrap();
    assert_eq!(tabs(&mut cx), (strings(&["chat"]), Some("chat".into())));
    // A tab of a workspace that is not on screen is no tab of this strip.
    assert!(run(&mut cx, "tab.select", json!({"id": "alpha"})).is_err());

    // The strips are kept on this device: w1's file and review with its sessions for their places.
    run(&mut cx, "workspace.open", json!({"id": "w1"})).unwrap();
    window
        .update(&mut cx, |ws, _, cx| ws.open_review("w1", cx))
        .unwrap();
    settle(&mut cx);
    window.update(&mut cx, |_, _, cx| cx.notify()).unwrap();
    settle(&mut cx);
    let saved: Value = serde_json::from_slice(&std::fs::read(&kept).unwrap()).unwrap();
    assert_eq!(
        saved["tabs"]["strips"]["w1"]["strip"],
        json!(["alpha", "bravo", "w1\nsrc/a.rs", "w1\n\u{0}review"]),
        "{saved}"
    );
    window
        .update(&mut cx, |_, window, _| window.remove_window())
        .unwrap();
    cx.run_until_parked();

    // A relaunch, with w1's strip as a person left it: a browser tab, a split of a file and a
    // session, the file active, and a session since ended. Clicking w1's second session shows
    // every session of w1 (the owner's repro) and the rest as it was.
    let browser = "w1\n\u{0}browser\nhttps://perch.dev/";
    let left = json!({
        "strip": ["alpha", "w1\nsrc/a.rs", "gone", browser, "w1\n\u{0}review"],
        "sets": [{"Split": {"dir": "Row", "kids": [{"Pane": "alpha"}, {"Pane": "w1\nsrc/a.rs"}],
                  "sizes": [0.5, 0.5]}}],
        "active": "w1\nsrc/a.rs",
        "previews": []
    });
    std::fs::write(
        &kept,
        json!({"tabs": {"strips": {"w1": left}, "putAway": []}}).to_string(),
    )
    .unwrap();
    let model = state().model();
    let window = cx
        .open_window(size(px(1000.), px(900.)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, None, cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
                    .with_window_state(kept.clone())
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user, &workspace, window.into(), cx));
    settle(&mut cx);
    window
        .update(&mut cx, |ws, _, cx| {
            ws.sidebar().update(cx, |s, cx| {
                s.open("local".into(), "bravo".into(), Some("claude".into()), cx)
            })
        })
        .unwrap();
    settle(&mut cx);
    let (strip, active, split) = window
        .update(&mut cx, |ws, _, _| {
            (
                ws.tabs().strip().to_vec(),
                ws.tabs().active().map(str::to_string),
                ws.tabs().in_split("alpha") && ws.tabs().in_split("w1\nsrc/a.rs"),
            )
        })
        .unwrap();
    assert_eq!(
        strip,
        strings(&["alpha", "w1\nsrc/a.rs", browser, "w1\n\u{0}review", "bravo"]),
        "every session of w1 and its kept tabs; the ended one is gone"
    );
    assert_eq!(active.as_deref(), Some("bravo"));
    assert!(split, "the split set comes back");

    // A shell that left its workspace's folder: the drawer's Files follow it, a file opened there
    // joins w1's strip, and stays after the terminal ends; the next file opened from that folder
    // joins the same strip, never one of the folder's own.
    let core_says = |cx: &mut HeadlessAppContext, state: State| {
        let model = state.model();
        window
            .update(cx, |ws, _, cx| {
                ws.sidebar().update(cx, |s, cx| {
                    s.apply(perch_native::client::Update::Model(model), cx)
                })
            })
            .unwrap();
        settle(cx);
    };
    let tabs = |cx: &mut HeadlessAppContext| {
        settle(cx);
        window
            .update(cx, |ws, _, _| {
                (
                    ws.tabs().strip().to_vec(),
                    ws.tabs().active().map(str::to_string),
                )
            })
            .unwrap()
    };
    let away = |s: &mut Value| {
        if s["id"] == "alpha" {
            s["currentCwd"] = json!("/away");
        }
    };
    core_says(&mut cx, state_with(away));
    window
        .update(&mut cx, |ws, window, cx| {
            ws.run_command("tab.select", Some(&json!({"id": "alpha"})), window, cx)
                .unwrap();
            ws.show_files("w1", cx);
        })
        .unwrap();
    settle(&mut cx);
    window.update(&mut cx, |_, _, cx| cx.notify()).unwrap();
    settle(&mut cx);
    let perch = cx.update(|cx| cx.global::<WindowMods>().perch.clone());
    let drawer = |perch: &perch_native::mods::perch::Perch| {
        perch
            .props_of("files#drawer")
            .map(|p| p["workspaceId"].clone())
    };
    let scope = "term:alpha:L2F3YXk"; // `/away`, base64url
    assert_eq!(drawer(&perch), Some(json!(scope)), "Files follow the cd");
    let a = format!("{scope}\na.rs");
    window
        .update(&mut cx, |ws, _, cx| ws.open_file(scope, "a.rs", false, cx))
        .unwrap();
    let (strip, active) = tabs(&mut cx);
    assert_eq!(active.as_deref(), Some(a.as_str()));
    assert!(
        strip.contains(&"bravo".to_string()),
        "still w1's strip: {strip:?}"
    );
    // The core says the terminal ended and was deleted.
    let mut ended = state_with(away);
    ended.apply(&message(
        json!({"type": "session.deleted", "sessionId": "alpha"}),
    ));
    core_says(&mut cx, ended);
    let (strip, _) = tabs(&mut cx);
    assert!(
        !strip.contains(&"alpha".to_string()),
        "alpha ended: {strip:?}"
    );
    assert!(
        strip.contains(&a),
        "the file outlives its terminal: {strip:?}"
    );
    window
        .update(&mut cx, |ws, window, cx| {
            ws.run_command("tab.select", Some(&json!({"id": a.clone()})), window, cx)
        })
        .unwrap()
        .unwrap();
    window.update(&mut cx, |_, _, cx| cx.notify()).unwrap();
    settle(&mut cx);
    assert_eq!(
        drawer(&perch),
        Some(json!(scope)),
        "Files stay on that folder"
    );
    window
        .update(&mut cx, |ws, _, cx| ws.open_file(scope, "b.rs", false, cx))
        .unwrap();
    let (strip, active) = tabs(&mut cx);
    assert_eq!(active, Some(format!("{scope}\nb.rs")));
    assert!(
        strip.contains(&a) && strip.contains(&"bravo".to_string()),
        "the second file joins w1's strip too: {strip:?}"
    );

    window
        .update(&mut cx, |_, window, _| window.remove_window())
        .unwrap();
    cx.run_until_parked();

    // An older window state: open files in `files` and each workspace's last tab in
    // `native-last-tabs.json` beside the mods folder. The first launch files both into w1's strip
    // and writes strips in their place; later launches read the strips only.
    let last_tabs = scratch.join("native-last-tabs.json");
    std::fs::write(
        &kept,
        json!({"tools": "files", "files": ["w1\nsrc/old.rs"]}).to_string(),
    )
    .unwrap();
    std::fs::write(&last_tabs, json!({"w1": "bravo"}).to_string()).unwrap();
    let launch = |cx: &mut HeadlessAppContext| {
        let model = state().model();
        let window = cx
            .open_window(size(px(1000.), px(900.)), |_, cx| {
                cx.new(|cx| {
                    Workspace::new(model, None, cx)
                        .with_core(|| Err(anyhow::anyhow!("no core in this test")))
                        .with_window_state(kept.clone())
                })
            })
            .unwrap();
        settle(cx);
        window
            .update(cx, |ws, window, cx| {
                ws.run_command("workspace.open", Some(&json!({"id": "w1"})), window, cx)
                    .unwrap();
                cx.notify();
            })
            .unwrap();
        settle(cx);
        let shown = window
            .update(cx, |ws, _, _| {
                (
                    ws.tabs().strip().to_vec(),
                    ws.tabs().active().map(str::to_string),
                )
            })
            .unwrap();
        window
            .update(cx, |_, window, _| window.remove_window())
            .unwrap();
        cx.run_until_parked();
        shown
    };
    let (strip, active) = launch(&mut cx);
    assert!(
        strip.contains(&"w1\nsrc/old.rs".to_string()) && strip.contains(&"bravo".to_string()),
        "the old file and last tab are in w1's strip: {strip:?}"
    );
    assert_eq!(active.as_deref(), Some("bravo"), "the last tab is shown");
    let saved: Value = serde_json::from_slice(&std::fs::read(&kept).unwrap()).unwrap();
    assert!(saved.get("files").is_none(), "the old key is gone: {saved}");
    assert_eq!(saved["tools"], json!("files"), "the rest is kept: {saved}");
    let kept_strip = saved["tabs"]["strips"]["w1"]["strip"].clone();
    assert!(
        kept_strip
            .as_array()
            .is_some_and(|s| s.contains(&json!("w1\nsrc/old.rs"))),
        "w1's strip is written: {saved}"
    );
    // The old last-tab file says otherwise now: it is not read again.
    std::fs::write(&last_tabs, json!({"w1": "alpha"}).to_string()).unwrap();
    let (again, active) = launch(&mut cx);
    assert_eq!(again, strip, "the strip comes back from strips");
    assert_eq!(active.as_deref(), Some("bravo"), "not the old file's tab");

    moved_active_session_shows_the_next(&mut cx, &scratch.join("moved.json"));
    let _ = std::fs::remove_dir_all(&scratch);
    println!("workspace_tabs_window: ok");
}

/// The core lists the active session under another workspace: it leaves the strip, and the tab
/// shown in its place has its terminal, as if clicked, not a blank pane.
fn moved_active_session_shows_the_next(cx: &mut HeadlessAppContext, kept: &std::path::Path) {
    let settle = |cx: &mut HeadlessAppContext| {
        for _ in 0..3 {
            cx.advance_clock(POLL);
            cx.run_until_parked();
        }
    };
    let model = state().model();
    let kept = kept.to_path_buf();
    let window = cx
        .open_window(size(px(1000.), px(900.)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, None, cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
                    .with_window_state(kept)
            })
        })
        .unwrap();
    settle(cx);
    window
        .update(cx, |ws, _, cx| {
            ws.sidebar().update(cx, |s, cx| {
                s.open("local".into(), "alpha".into(), Some("claude".into()), cx)
            })
        })
        .unwrap();
    settle(cx);
    let (strip, bravo_view) = window
        .update(cx, |ws, _, _| {
            (ws.tabs().strip().to_vec(), ws.view("bravo").is_some())
        })
        .unwrap();
    assert_eq!(strip, strings(&["alpha", "bravo"]));
    assert!(!bravo_view, "bravo waits, parked, until shown");
    let model = state_with(|s| {
        if s["id"] == "alpha" {
            s["workspaceId"] = json!("w2");
            s["projectId"] = json!("q");
            s["cwd"] = json!("/other");
        }
    })
    .model();
    window
        .update(cx, |ws, _, cx| {
            ws.sidebar().update(cx, |s, cx| {
                s.apply(perch_native::client::Update::Model(model), cx)
            })
        })
        .unwrap();
    settle(cx);
    let (strip, active, bravo_view) = window
        .update(cx, |ws, _, _| {
            (
                ws.tabs().strip().to_vec(),
                ws.tabs().active().map(str::to_string),
                ws.view("bravo").is_some(),
            )
        })
        .unwrap();
    assert_eq!(strip, strings(&["bravo"]), "alpha moved to w2");
    assert_eq!(active.as_deref(), Some("bravo"));
    assert!(bravo_view, "the tab shown in its place has its terminal");
    window
        .update(cx, |_, window, _| window.remove_window())
        .unwrap();
    cx.run_until_parked();
}

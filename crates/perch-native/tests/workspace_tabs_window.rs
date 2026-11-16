//! The window's tab strip belongs to the workspace on screen, as the web's: switching workspace
//! shows that workspace's own tabs (sessions, files, browser pages), or no strip when it has none,
//! and switching back brings the strip, its active tab and its Back and Forward history as they
//! were left. A Quickchat session is in the Quickchat workspace, never in a project's strip.
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
    let project = |id: &str, path: &str| {
        json!({"id": id, "hostId": "local", "name": id, "path": path,
            "favorite": false, "createdAt": 0, "updatedAt": 0})
    };
    let checkout = |id: &str, project: &str, path: &str| {
        json!({"id": id, "projectId": project, "hostId": "local", "path": path,
            "name": id, "dirty": false, "state": "active", "createdAt": 0, "updatedAt": 0,
            "pinned": false})
    };
    let projects = vec![
        project("p", "/work"),
        project("q", "/other"),
        project("c", "/home/.perch/scratch"),
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
            checkout("w3", "c", "/home/.perch/scratch")]})));
    let sessions: Vec<Value> = [
        ("alpha", "p", "w1", "/work"),
        ("bravo", "p", "w1", "/work"),
        ("delta", "q", "w2", "/other"),
        ("chat", "c", "w3", "/home/.perch/scratch"),
    ]
    .iter()
    .enumerate()
    .map(|(i, (id, project, workspace, cwd))| {
        json!({"id": id, "title": id, "cwd": cwd, "createdAt": i, "status": "idle",
            "hostId": "local", "projectId": project, "workspaceId": workspace,
            "cliProviderId": "claude"})
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
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user, &workspace, window.into(), cx));

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

    // One project's sessions: its strip, with the last opened active.
    open(&mut cx, "alpha");
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

    // Another project: nothing of the first project's strip is there. With no tab it shows no
    // strip (its start page); its own session opens its own strip.
    run(&mut cx, "workspace.open", json!({"id": "w2"})).unwrap();
    assert_eq!(tabs(&mut cx), (vec![], None), "w2 has no tabs");
    open(&mut cx, "delta");
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

    window
        .update(&mut cx, |_, window, _| window.remove_window())
        .unwrap();
    cx.run_until_parked();
    let _ = std::fs::remove_dir_all(&scratch);
    println!("workspace_tabs_window: ok");
}

//! The drawer's Files tab against a real perch-core in a scratch directory (`common`): a clone of this repository
//! as a project beside a few small ones, plain shells in it printing, the drawer opened on Files with the drawer key.
//! The explorer must list the repository's root and keep it while the shells print and after the drawer is closed
//! and opened again. No agent runs.

mod common;

use common::{Harness, Rig, TIMEOUT};
use gpui::Window;
use gpui_shell::probe;
use perch_native::client::{follow, Update};
use perch_native::files::store::Load;
use perch_native::mods;
use std::path::Path;
use std::time::{Duration, Instant};

fn main() {
    common::run("files_drawer_core", scenario);
}

/// What the follower learned goes to the window, as the app routes it: `fs.*` to the file store.
fn pump(h: &mut Harness) {
    while let Ok(update) = h.updates.try_recv() {
        h.window
            .update(&mut h.cx, |ws, _, cx| match update {
                Update::Files(message) => ws.on_files_message(&message, cx),
                other => ws
                    .sidebar()
                    .update(cx, |sidebar, cx| sidebar.apply(other, cx)),
            })
            .unwrap();
    }
}

/// Draws a frame and returns the names drawn.
fn frame(h: &mut Harness) -> Vec<String> {
    h.cx.update_window(h.window.into(), |_, window: &mut Window, cx| {
        probe::clear();
        window.refresh();
        let _ = window.draw(cx);
    })
    .unwrap();
    let mut names: Vec<String> = probe::records()
        .into_values()
        .map(|r| r.name.to_string())
        .collect();
    names.sort();
    names
}

fn wait<T>(
    h: &mut Harness,
    what: &str,
    mut done: impl FnMut(&mut Harness, &[String]) -> Option<T>,
) -> T {
    let deadline = Instant::now() + TIMEOUT;
    loop {
        pump(h);
        h.cx.run_until_parked();
        let names = frame(h);
        if let Some(found) = done(h, &names) {
            return found;
        }
        assert!(
            Instant::now() < deadline,
            "timed out waiting for {what}; drawn {names:?}"
        );
        h.cx.advance_clock(Duration::from_millis(25));
        std::thread::sleep(Duration::from_millis(25));
    }
}

fn shot(h: &mut Harness, name: &str) {
    let Some(dir) = std::env::var_os("PERCH_DRAWER_SHOTS") else {
        return;
    };
    let image =
        h.cx.update_window(h.window.into(), |_, window: &mut Window, cx| {
            let _ = window.draw(cx);
            window.render_to_image().expect("offscreen render")
        })
        .unwrap();
    image
        .save(Path::new(&dir).join(format!("{name}.png")))
        .unwrap();
}

fn rows(names: &[String]) -> usize {
    names.iter().filter(|n| n.contains("files-entry:")).count()
}

fn scenario(rig: &mut Rig) {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    // A clone of this repository (its tracked files, as the owner's checkout has them) and a few small projects.
    let repo = rig.scratch.join("perch");
    let source = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let cloned = std::process::Command::new("git")
        .args(["clone", "-q", "--local"])
        .arg(&source)
        .arg(&repo)
        .status()
        .unwrap();
    assert!(cloned.success());
    let repo = repo.to_str().unwrap().to_string();
    let mut folders = vec![repo.clone()];
    for i in 0..4 {
        let folder = rig.scratch.join(format!("p{i}"));
        std::fs::create_dir_all(&folder).unwrap();
        folders.push(folder.to_str().unwrap().to_string());
    }

    let (_, core) = rig.start_core(&runtime);
    let shells = runtime.block_on(async {
        let mut connection = core.connect().await.expect("connect");
        for folder in &folders {
            connection.create_project(folder).await.expect("project");
        }
        let mut shells = Vec::new();
        for i in 0..8 {
            let id = connection
                .create_session(Some(&folders[if i % 2 == 0 { 0 } else { 1 + i % 4 }]), None)
                .await
                .expect("create");
            let terminal = connection
                .open_terminal(&id, 80, 24)
                .await
                .expect("open terminal");
            shells.push((id, terminal));
        }
        (connection, shells)
    });
    let (mut connection, shells) = shells;

    let (commands, command_rx) = futures::channel::mpsc::unbounded();
    let (update_tx, updates) = futures::channel::mpsc::unbounded();
    let for_follower = core.clone();
    let follower = runtime.spawn(async move {
        let _ = follow(
            move || Ok(for_follower.clone()),
            command_rx,
            update_tx,
            Duration::from_millis(100),
        )
        .await;
    });
    let for_window = core.clone();
    let mut h = Harness::locating(move || Ok(for_window.clone()), commands, updates);
    // The window's own home is the scratch one too: nothing of the person's is read.
    let home = rig.scratch.join("window-home");
    std::fs::create_dir_all(&home).unwrap();
    std::env::set_var("HOME", &home);
    std::env::set_var("PERCH_SETTINGS", rig.scratch.join("window-settings.json"));
    let user = rig.scratch.join("native-mods");
    let entity = h.window.entity(&h.cx).unwrap();
    let handle = h.window;
    h.cx.update(|cx| mods::start_in(user, &entity, handle.into(), cx));

    // The repository's workspace, and one of its sessions on screen: a plain shell, which the sidebar does not list.
    let (workspace, session) = wait(&mut h, "the repository's session", |h, _| {
        h.ws(|ws, cx| {
            let store = &ws.sidebar().read(cx).model().store;
            let workspace = store
                .workspaces
                .iter()
                .find(|w| w.path.trim_end_matches('/') == repo)?;
            let session = store
                .sessions
                .iter()
                .find(|s| s.workspace_id.as_deref() == Some(&workspace.id))?;
            Some((workspace.id.clone(), session.id.clone()))
        })
    });
    h.show_tab(&session);
    h.window
        .update(&mut h.cx, |ws, window, cx| {
            ws.run_command("global.drawer", None, window, cx)
        })
        .unwrap()
        .unwrap();
    let started = Instant::now();
    let names = wait(&mut h, "the explorer's rows", |h, names| {
        let ready = h.ws(|ws, _| {
            ws.files()
                .tree(&workspace, "")
                .is_some_and(|t| t.state == Load::Ready)
        });
        (ready && rows(names) > 10).then(|| names.to_vec())
    });
    eprintln!("drawn {} rows in {:?}", rows(&names), started.elapsed());
    shot(&mut h, "core-1-open");

    // The shells print for a while; the explorer keeps its rows.
    for (_, terminal) in &shells {
        runtime
            .block_on(connection.terminal_input(
                terminal,
                "for i in $(seq 1 200); do echo line $i; sleep 0.01; done\r",
                false,
            ))
            .unwrap();
    }
    let started = Instant::now();
    let mut frames = 0;
    while started.elapsed() < Duration::from_secs(6) {
        pump(&mut h);
        h.cx.run_until_parked();
        let names = frame(&mut h);
        frames += 1;
        assert!(
            rows(&names) > 10,
            "the explorer kept its rows while shells print: {names:?}"
        );
        h.cx.advance_clock(Duration::from_millis(16));
        std::thread::sleep(Duration::from_millis(16));
    }
    eprintln!("{frames} frames in 6 s while shells print");
    shot(&mut h, "core-2-busy");
    let error = h.ws(|ws, cx| ws.screen_error("files", cx));
    assert!(error.is_none(), "{error:?}");

    // Closed and opened again: the rows come back.
    for _ in 0..2 {
        h.window
            .update(&mut h.cx, |ws, window, cx| {
                ws.run_command("global.drawer", None, window, cx)
            })
            .unwrap()
            .unwrap();
        frame(&mut h);
    }
    wait(&mut h, "the rows after reopening", |_, names| {
        (rows(names) > 10).then_some(())
    });
    shot(&mut h, "core-3-reopened");

    h.close();
    follower.abort();
    drop(connection);
    drop(runtime);
}

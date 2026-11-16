//! A file's draft survives the core: typed in the window, held by the core's durable buffer, the
//! core killed and started again, a new window that opens the file gets the draft back, and the
//! file on disk is untouched. Against a real perch-core in a scratch directory (`common`); no
//! agent runs.

mod common;

use common::{Harness, Rig, TIMEOUT};
use perch_native::client::{follow, Core, Update};
use perch_native::files::store::DocState;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

fn main() {
    common::run("files_restart", scenario);
}

const DRAFT: &str = "# Note\n\nTyped before the core went down.\n";

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

fn wait<T>(h: &mut Harness, what: &str, mut done: impl FnMut(&mut Harness) -> Option<T>) -> T {
    let deadline = Instant::now() + TIMEOUT;
    loop {
        pump(h);
        h.cx.run_until_parked();
        h.draw();
        if let Some(found) = done(h) {
            return found;
        }
        assert!(Instant::now() < deadline, "timed out waiting for {what}");
        h.cx.advance_clock(Duration::from_millis(25));
        std::thread::sleep(Duration::from_millis(25));
    }
}

/// A window and its follower on the core `current` names; the workspace of `folder` once listed.
fn window(
    runtime: &tokio::runtime::Runtime,
    current: &Arc<Mutex<Core>>,
    folder: &str,
) -> (Harness, tokio::task::JoinHandle<()>, String) {
    let (commands, command_rx) = futures::channel::mpsc::unbounded();
    let (update_tx, updates) = futures::channel::mpsc::unbounded();
    let for_follower = current.clone();
    let follower = runtime.spawn(async move {
        let _ = follow(
            move || Ok(for_follower.lock().unwrap().clone()),
            command_rx,
            update_tx,
            Duration::from_millis(100),
        )
        .await;
    });
    let for_window = current.clone();
    let mut h = Harness::locating(
        move || Ok(for_window.lock().unwrap().clone()),
        commands,
        updates,
    );
    let workspace = wait(&mut h, "the project's workspace", |h| {
        h.ws(|ws, cx| {
            let store = &ws.sidebar().read(cx).model().store;
            store
                .workspaces
                .iter()
                .find(|w| w.path.trim_end_matches('/') == folder)
                .map(|w| w.id.clone())
        })
    });
    (h, follower, workspace)
}

/// Opens `note.md` in a tab, and reads it as the files screen in the tab does on mount (no mods
/// run in this window).
fn open(h: &mut Harness, workspace: &str) {
    h.window
        .update(&mut h.cx, |ws, _, cx| {
            ws.open_file(workspace, "note.md", false, cx);
            ws.with_files(
                |store, _| drop(store.open_file(workspace, "note.md", false)),
                cx,
            );
        })
        .unwrap();
}

/// Opens `note.md` in a tab and waits for its document.
fn open_note(h: &mut Harness, workspace: &str) -> String {
    open(h, workspace);
    wait(h, "the file's document", |h| {
        h.ws(|ws, _| {
            ws.files()
                .document(workspace, "note.md")
                .filter(|d| d.state == DocState::Ready)
                .map(|d| d.content.clone())
        })
    })
}

fn scenario(rig: &mut Rig) {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    let folder = rig.scratch.join("work");
    std::fs::create_dir_all(&folder).unwrap();
    std::fs::write(folder.join("note.md"), "# Note\n").unwrap();
    let folder = folder.to_str().unwrap().to_string();

    let (_, core) = rig.start_core(&runtime);
    runtime
        .block_on(async { core.connect().await?.create_project(&folder).await })
        .expect("the project");
    let current = Arc::new(Mutex::new(core));

    // Typed in the window; the core's buffer holds it (the store's last acknowledged text).
    let (mut h, follower, workspace) = window(&runtime, &current, &folder);
    assert_eq!(open_note(&mut h, &workspace), "# Note\n");
    h.window
        .update(&mut h.cx, |ws, _, cx| {
            ws.with_files(
                |store, now| store.update_draft(&workspace, "note.md", DRAFT.into(), now),
                cx,
            )
        })
        .unwrap();
    wait(&mut h, "the core to hold the draft", |h| {
        h.ws(|ws, _| {
            ws.files().document(&workspace, "note.md").and_then(|d| {
                d.persisted_content
                    .as_deref()
                    .filter(|p| *p == DRAFT)
                    .map(drop)
            })
        })
    });

    // The core is killed with the tab still open, then started again; the window is gone too.
    rig.stop_core().expect("the core stops");
    h.close();
    follower.abort();
    let (_, core) = rig.start_core(&runtime);
    *current.lock().unwrap() = core;

    // A new window opening the file gets the draft back; the file on disk is as it was.
    let (mut h, follower, again) = window(&runtime, &current, &folder);
    assert_eq!(again, workspace, "the same workspace");
    open(&mut h, &workspace);
    let restored = wait(&mut h, "the draft", |h| {
        h.ws(|ws, _| {
            ws.files()
                .document(&workspace, "note.md")
                .filter(|d| d.content == DRAFT)
                .map(|d| (d.dirty(), d.saved_content.clone()))
        })
    });
    assert_eq!(
        restored,
        (true, "# Note\n".to_string()),
        "a draft over the saved file"
    );
    assert_eq!(
        std::fs::read_to_string(std::path::Path::new(&folder).join("note.md")).unwrap(),
        "# Note\n",
        "nothing was written to disk"
    );

    h.close();
    follower.abort();
    drop(runtime);
}

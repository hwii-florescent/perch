//! Clicks in the drawer against a real perch-core and a scratch Git repository, timed against a
//! click on a strip tab (median of several, from the press to the result drawn, the pointer already
//! over the row as a person's is): a row's press costs what a tab's does, a click on a Git change
//! row as much as a tab's, and a click on a Files row that opens its file at most two renders of
//! the tree more. And every click counts: a quick run of clicks on different rows, some wobbling a
//! few pixels between press and release, opens each row it lands on the first time (the press
//! that gave the Files tree the keyboard used to be lost, leaving only its row's hover look).
//!
//! A release measurement (`cargo test --release -p perch-native --test drawer_click_window`); a
//! debug build reports the times without judging them. The core and the teardown are in `common`.

mod common;

use common::{Harness, Rig};
use gpui::{
    point, px, Modifiers, MouseButton, MouseDownEvent, MouseMoveEvent, MouseUpEvent, PlatformInput,
    Window,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_native::client::follow;
use perch_native::sidebar::LOCAL;
use std::path::Path;
use std::process::Command;
use std::time::{Duration, Instant};

const FILES: usize = 12;
const REPEATS: usize = 7;

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

fn name(i: usize) -> String {
    format!("f{i:02}.txt")
}

/// Every probe drawn in one fresh frame.
fn records(h: &mut Harness) -> Vec<ProbeRecord> {
    h.cx.update_window(h.window.into(), |_, window: &mut Window, cx| {
        probe::clear();
        window.refresh();
        let _ = window.draw(cx);
    })
    .unwrap();
    probe::records().into_values().collect()
}

fn center(h: &mut Harness, name: &str) -> (f32, f32) {
    let found = records(h).into_iter().find(|r| r.name == name);
    let at = found
        .unwrap_or_else(|| {
            let mut names: Vec<_> = records(h).into_iter().map(|r| r.name.to_string()).collect();
            names.sort();
            panic!("{name} is drawn: {names:?}")
        })
        .bounds
        .center();
    (f32::from(at.x), f32::from(at.y))
}

fn dispatch(h: &mut Harness, input: PlatformInput) {
    h.cx.update_window(h.window.into(), |_, window: &mut Window, cx| {
        window.dispatch_event(input, cx);
    })
    .unwrap();
}

fn frame(h: &mut Harness) {
    h.cx.update_window(h.window.into(), |_, window: &mut Window, cx| {
        window.refresh();
        let _ = window.draw(cx);
    })
    .unwrap();
}

/// A left press at `at`, a frame drawn, the pointer moved by `wobble` with the button held (when
/// any), then the release there, what is ready run and one frame drawn: the time from the press to
/// its frame, and to the last.
fn click(h: &mut Harness, (x, y): (f32, f32), wobble: f32) -> (Duration, Duration) {
    hover(h, (x, y));
    let started = Instant::now();
    dispatch(
        h,
        PlatformInput::MouseDown(MouseDownEvent {
            button: MouseButton::Left,
            position: point(px(x), px(y)),
            modifiers: Modifiers::default(),
            click_count: 1,
            first_mouse: false,
        }),
    );
    h.cx.run_until_parked();
    frame(h);
    let pressed = started.elapsed();
    let to = point(px(x + wobble), px(y + wobble / 2.));
    if wobble != 0. {
        dispatch(
            h,
            PlatformInput::MouseMove(MouseMoveEvent {
                position: to,
                pressed_button: Some(MouseButton::Left),
                modifiers: Modifiers::default(),
            }),
        );
        h.cx.run_until_parked();
    }
    dispatch(
        h,
        PlatformInput::MouseUp(MouseUpEvent {
            button: MouseButton::Left,
            position: to,
            modifiers: Modifiers::default(),
            click_count: 1,
        }),
    );
    h.cx.run_until_parked();
    frame(h);
    (pressed, started.elapsed())
}

/// The pointer arrives at `at` (as it does before any press) and the window catches up.
fn hover(h: &mut Harness, (x, y): (f32, f32)) {
    dispatch(
        h,
        PlatformInput::MouseMove(MouseMoveEvent {
            position: point(px(x), px(y)),
            pressed_button: None,
            modifiers: Modifiers::default(),
        }),
    );
    h.cx.run_until_parked();
    frame(h);
    h.cx.run_until_parked();
    frame(h);
}

fn active(h: &mut Harness) -> Option<String> {
    h.window
        .update(&mut h.cx, |ws, _, _| ws.tabs().active().map(str::to_string))
        .unwrap()
}

fn median(mut list: Vec<Duration>) -> Duration {
    list.sort();
    list[list.len() / 2]
}

/// Median press and click times of `clicks`.
fn medians(clicks: &[(Duration, Duration)]) -> (Duration, Duration) {
    (
        median(clicks.iter().map(|c| c.0).collect()),
        median(clicks.iter().map(|c| c.1).collect()),
    )
}

/// A row's press costs what a strip tab's does (a press that described the drawer's whole tree
/// again cost about 10 ms more), and its click at most `extra` more than the strip's.
fn judge(
    what: &str,
    clicks: &[(Duration, Duration)],
    strip: &[(Duration, Duration)],
    extra: Duration,
) {
    let ((press, took), (strip_press, strip_took)) = (medians(clicks), medians(strip));
    eprintln!(
        "drawer_click_window: {what}: press {press:?}, click {took:?}; strip press {strip_press:?}, click {strip_took:?}"
    );
    if cfg!(debug_assertions) {
        return;
    }
    let margin = Duration::from_millis(4);
    assert!(
        press <= strip_press + margin,
        "{what}'s press costs {press:?}, a strip tab's {strip_press:?} (+{margin:?} allowed)"
    );
    assert!(
        took <= strip_took + extra,
        "{what} costs {took:?}, the strip's click {strip_took:?} (+{extra:?} allowed)"
    );
}

fn main() {
    common::run("drawer_click_window", scenario);
}

fn scenario(rig: &mut Rig) {
    let repo = rig.scratch.join("repo");
    std::fs::create_dir_all(&repo).unwrap();
    git(&repo, &["init", "-q", "-b", "main"]);
    for i in 0..FILES {
        std::fs::write(repo.join(name(i)), format!("one {i}\ntwo\nthree\n")).unwrap();
    }
    git(&repo, &["add", "."]);
    git(&repo, &["commit", "-q", "-m", "first"]);
    for i in 0..FILES / 2 {
        std::fs::write(repo.join(name(i)), format!("one {i}\ntwo changed\nthree\n")).unwrap();
    }

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
    let window = h.window;
    let mods_dir = rig.scratch.join("native-mods");
    h.cx.update(|cx| perch_native::mods::start_in(mods_dir, &workspace, window.into(), cx));

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
            let w = model.store.workspaces.iter().find(|w| w.path == path)?;
            perch_native::git::can_take(model.connected, &model.store, &w.id).then(|| w.id.clone())
        });
        found.map(|found| id = found).is_some()
    });
    let tab = |path: &str| format!("{id}\n{path}");

    // The strip: two files open as tabs, a click shows the other. Each waits for the core's
    // shared tabs to take the last one first.
    let (a, b) = (tab(&name(10)), tab(&name(11)));
    for (i, t) in [(10, &a), (11, &b)] {
        h.window
            .update(&mut h.cx, |ws, _, cx| {
                ws.open_file(&id, &name(i), false, cx)
            })
            .unwrap();
        h.wait("the file tab in the strip", |h| {
            records(h).iter().any(|r| r.name == format!("tab:{t}"))
        });
        h.settle();
    }
    h.wait("both file tabs in the strip", |h| {
        let names: Vec<_> = records(h).into_iter().map(|r| r.name.to_string()).collect();
        [&a, &b].iter().all(|t| names.contains(&format!("tab:{t}")))
    });
    let mut strip = vec![];
    for n in 0..REPEATS * 2 {
        let to = if n % 2 == 0 { &a } else { &b };
        let at = center(&mut h, &format!("tab:{to}"));
        strip.push(click(&mut h, at, 0.));
        assert_eq!(
            active(&mut h).as_ref(),
            Some(to),
            "a strip click shows {to}"
        );
    }

    // Files: a click on a row opens the file (as the workspace's preview tab).
    h.window
        .update(&mut h.cx, |ws, _, cx| ws.show_files(&id, cx))
        .unwrap();
    h.wait("the file rows", |h| {
        records(h)
            .iter()
            .any(|r| r.name == format!("files-entry:{}", name(FILES - 1)))
    });
    let mut files = vec![];
    for n in 0..REPEATS * 2 {
        let file = name(6 + n % 2);
        let at = center(&mut h, &format!("files-entry:{file}"));
        files.push(click(&mut h, at, 0.));
        assert_eq!(active(&mut h), Some(tab(&file)), "a row click opens {file}");
    }
    // The Files tree draws twice for a click that the strip does not: the cursor moves to the row,
    // then the selection follows the tab the click opened (the web's source).
    judge(
        "a Files row click",
        &files,
        &strip,
        Duration::from_millis(16),
    );

    // A quick run of clicks on different rows, some with the pointer wobbling 1-3 px while held:
    // each opens its row the first time.
    for (n, wobble) in [0., 1., 3., 0., 2., 0., 1., 3., 0., 2., 0., 0.]
        .into_iter()
        .enumerate()
    {
        let file = name(n % FILES);
        let at = center(&mut h, &format!("files-entry:{file}"));
        click(&mut h, at, wobble);
        assert_eq!(
            active(&mut h),
            Some(tab(&file)),
            "click {n} (wobble {wobble} px) opens {file} the first time"
        );
    }

    // Git: a click on a change row shows its diff.
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
    h.wait("the change rows", |h| {
        records(h)
            .iter()
            .any(|r| r.name == format!("git-change:{}", name(FILES / 2 - 1)))
    });
    let mut changes = vec![];
    for n in 0..REPEATS * 2 {
        let file = name(n % 2);
        let at = center(&mut h, &format!("git-change:{file}"));
        changes.push(click(&mut h, at, 0.));
        let error = h.ws(|ws, cx| ws.screen_error("review#drawer", cx));
        assert!(error.is_none(), "the drawer's review runs: {error:?}");
    }
    judge(
        "a Git change row click",
        &changes,
        &strip,
        Duration::from_millis(8),
    );

    h.close();
    follower.abort();
}

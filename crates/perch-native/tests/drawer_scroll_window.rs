//! The drawer keeps its scroll position, against a real perch-core and a scratch Git repository.
//! Scrolled down the Files tree, its rows are drawn down to the bottom of the view (they stopped at
//! the first screenful: the tree measured its list unscrolled), and a click on a file, a folder
//! expanded and collapsed and the tree loaded again leave it where it was (each click put it back
//! at its top). A reveal does scroll, and only as far as its row: the keyboard walking the cursor
//! past the bottom moves it a row. In the Git rail a click on a change row and a refresh leave it
//! where it was, and a fold moves it less than two rows (see `FOLD_SLACK`).
//!
//! Each check reads where a row in view is drawn before and after.

mod common;

use common::{Harness, Rig};
use gpui::{
    point, px, Modifiers, MouseButton, MouseDownEvent, MouseUpEvent, PlatformInput, ScrollDelta,
    ScrollEvent, ScrollSource, TouchPhase, Window,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_native::client::follow;
use perch_native::sidebar::LOCAL;
use std::path::Path;
use std::process::Command;
use std::time::Duration;

const FOLDERS: usize = 30;
const FILES: usize = 60;
/// How far a fold in the Git rail may move it: under two rows (a jump to the top is the whole
/// scroll). The rail draws only the rows around the view, between spacers sized by one row's
/// height, and its folder rows are a few pixels shorter than its file rows, so when a fold moves
/// the drawn window the spacer above is off by a little (3.5 and 28.5 px measured). A browser
/// hides that with scroll anchoring, which the native client has none of.
/// ponytail: equal row heights in the source (`review.tsx`) would make the spacers exact.
const FOLD_SLACK: f32 = 40.;

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

fn dispatch(h: &mut Harness, input: PlatformInput) {
    h.cx.update_window(h.window.into(), |_, window: &mut Window, cx| {
        window.dispatch_event(input, cx);
    })
    .unwrap();
}

/// The box `name` is drawn in (top, centre x, centre y), if it is.
fn place(h: &mut Harness, name: &str) -> Option<(f32, f32, f32)> {
    let found = records(h).into_iter().find(|r| r.name == name)?;
    let (top, center) = (found.bounds.top(), found.bounds.center());
    Some((f32::from(top), f32::from(center.x), f32::from(center.y)))
}

fn click(h: &mut Harness, name: &str) {
    let (_, x, y) = place(h, name).unwrap_or_else(|| panic!("{name} is drawn"));
    let position = point(px(x), px(y));
    dispatch(
        h,
        PlatformInput::MouseDown(MouseDownEvent {
            button: MouseButton::Left,
            position,
            modifiers: Modifiers::default(),
            click_count: 1,
            first_mouse: false,
        }),
    );
    h.settle();
    dispatch(
        h,
        PlatformInput::MouseUp(MouseUpEvent {
            button: MouseButton::Left,
            position,
            modifiers: Modifiers::default(),
            click_count: 1,
        }),
    );
    h.settle();
}

/// The wheel over `area`, `by` pixels down its content.
fn scroll(h: &mut Harness, area: &str, by: f32) {
    let (_, x, y) = place(h, area).unwrap_or_else(|| panic!("{area} is drawn"));
    dispatch(
        h,
        PlatformInput::Scroll(ScrollEvent {
            source: ScrollSource::Pointer,
            position: point(px(x), px(y)),
            delta: ScrollDelta::Pixels(point(px(0.), px(-by))),
            modifiers: Modifiers::default(),
            touch_phase: TouchPhase::Moved,
        }),
    );
    h.settle();
}

/// The rows named `prefix…` drawn wholly inside `area`, top to bottom, with their tops.
fn in_view(h: &mut Harness, area: &str, prefix: &str) -> Vec<(String, f32)> {
    let all = records(h);
    let area = all
        .iter()
        .find(|r| r.name == area)
        .expect("the area is drawn")
        .bounds;
    let mut rows: Vec<_> = all
        .iter()
        .filter(|r| r.name.starts_with(prefix))
        .filter(|r| r.bounds.top() >= area.top() && r.bounds.bottom() <= area.bottom())
        .map(|r| (r.name.to_string(), f32::from(r.bounds.top())))
        .collect();
    rows.sort_by(|a, b| a.1.total_cmp(&b.1));
    rows
}

/// `anchor` is drawn where it was (`top`, within `slack` px) after `what`.
fn stays(h: &mut Harness, (anchor, top): &(String, f32), what: &str, slack: f32) {
    let now = place(h, anchor).map(|(t, _, _)| t);
    eprintln!("drawer_scroll_window: after {what}, {anchor} at {now:?} (was {top})");
    assert!(
        now.is_some_and(|now| (now - top).abs() <= slack),
        "after {what} the list stays where it was scrolled to: {anchor} at {now:?}, was {top}"
    );
}

fn main() {
    common::run("drawer_scroll_window", scenario);
}

fn scenario(rig: &mut Rig) {
    let repo = rig.scratch.join("repo");
    std::fs::create_dir_all(&repo).unwrap();
    git(&repo, &["init", "-q", "-b", "main"]);
    for i in 0..FOLDERS {
        let folder = repo.join(format!("d{i:02}"));
        std::fs::create_dir_all(&folder).unwrap();
        std::fs::write(folder.join("inner.txt"), "inside\n").unwrap();
    }
    for i in 0..FILES {
        std::fs::write(repo.join(format!("f{i:02}.txt")), format!("one {i}\n")).unwrap();
    }
    git(&repo, &["add", "."]);
    git(&repo, &["commit", "-q", "-m", "first"]);
    for i in 0..FILES {
        std::fs::write(
            repo.join(format!("f{i:02}.txt")),
            format!("one {i}\nchanged\n"),
        )
        .unwrap();
    }
    for i in 0..FOLDERS {
        std::fs::write(repo.join(format!("d{i:02}/inner.txt")), "inside\nchanged\n").unwrap();
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

    // Files: scrolled down to the last folders, a row in view is the anchor.
    h.window
        .update(&mut h.cx, |ws, _, cx| ws.show_files(&id, cx))
        .unwrap();
    h.wait("the file rows", |h| {
        records(h).iter().any(|r| r.name == "files-entry:d00")
    });
    // In two steps, as a wheel or a trackpad gives it: on the first the tree has not measured its
    // area yet, and its rows catch up on the next one.
    scroll(&mut h, "files-tree", 300.);
    scroll(&mut h, "files-tree", 300.);
    let rows = in_view(&mut h, "files-tree", "files-entry:");
    assert!(
        rows.first()
            .is_some_and(|(name, _)| name != "files-entry:d00"),
        "the tree scrolled: {rows:?}"
    );
    // The rows follow the scroll: the view is full of them, not blank past the first screenful.
    let tree = records(&mut h)
        .into_iter()
        .find(|r| r.name == "files-tree")
        .unwrap()
        .bounds;
    let row = rows[1].1 - rows[0].1;
    assert!(
        rows.len() as f32 * row >= f32::from(tree.size.height) - 2. * row,
        "the scrolled tree is drawn down to its bottom: {} rows of {row} px in {:?}",
        rows.len(),
        tree.size
    );
    let anchor = rows[0].clone();
    let below = |rows: &[(String, f32)], kind: &str| {
        rows.iter()
            .skip(2)
            .find(|(name, _)| name.starts_with(&format!("files-entry:{kind}")))
            .map(|(name, _)| name.clone())
            .unwrap_or_else(|| panic!("a {kind} row in view below the anchor: {rows:?}"))
    };
    let folder = below(&rows, "d");
    let file = below(&rows, "f");

    click(&mut h, &file);
    let opened = file.trim_start_matches("files-entry:").to_string();
    h.wait("the clicked file open", |h| {
        h.active()
            .is_some_and(|tab| tab.ends_with(&format!("\n{opened}")))
    });
    stays(&mut h, &anchor, "a click on a file", 0.);
    click(&mut h, &folder);
    let inner = format!("{folder}/inner.txt");
    h.wait("the folder expanded", |h| {
        records(h).iter().any(|r| r.name == inner)
    });
    stays(&mut h, &anchor, "expanding a folder", 0.);
    click(&mut h, &folder);
    h.wait("the folder collapsed", |h| {
        !records(h).iter().any(|r| r.name == inner)
    });
    stays(&mut h, &anchor, "collapsing it", 0.);
    click(&mut h, "files-refresh");
    stays(&mut h, &anchor, "loading the tree again", 0.);

    // A reveal does scroll, as far as its row: the keyboard walks the cursor past the bottom of the
    // view, and the tree follows it a row at a time.
    let rows = in_view(&mut h, "files-tree", "files-entry:");
    let shown = rows.len();
    click(&mut h, &anchor.0);
    for _ in 0..shown + 3 {
        assert!(h.press("down"), "the tree takes the arrow key");
        h.settle();
    }
    let after = in_view(&mut h, "files-tree", "files-entry:");
    let moved = after
        .iter()
        .find_map(|(name, top)| {
            rows.iter()
                .find(|(was, _)| was == name)
                .map(|(_, was)| was - top)
        })
        .unwrap_or(f32::INFINITY);
    eprintln!(
        "drawer_scroll_window: {} rows down, the tree moved {moved} px",
        shown + 3
    );
    assert!(
        moved > 0. && moved <= 5. * row,
        "the cursor's row is revealed, the tree moving only that far (a few rows): {moved} px"
    );

    // Git: scrolled down the changed files, a click on one shows its diff, and a refresh.
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
        records(h).iter().any(|r| r.name == "git-dir:d00/")
    });
    scroll(&mut h, "git-changes", 600.);
    let rows = in_view(&mut h, "git-changes", "git-");
    assert!(
        rows.first().is_some_and(|(name, _)| name != "git-dir:d00/"),
        "the change list scrolled: {rows:?}"
    );
    let anchor = rows[0].clone();
    let after = |kind: &str| {
        rows.iter()
            .skip(2)
            .find(|(name, _)| name.starts_with(kind))
            .map(|(name, _)| name.clone())
            .unwrap_or_else(|| panic!("a {kind} row in view below the anchor: {rows:?}"))
    };
    let (folder, change) = (after("git-dir:"), after("git-change:"));
    click(&mut h, &change);
    stays(&mut h, &anchor, "a click on a change row", 0.);
    click(&mut h, "git-refresh");
    stays(&mut h, &anchor, "a Git refresh", 0.);
    let inner = format!(
        "git-change:{}inner.txt",
        folder.trim_start_matches("git-dir:")
    );
    let open = records(&mut h).iter().any(|r| r.name == inner);
    click(&mut h, &folder);
    h.wait("the Git folder folded or unfolded", |h| {
        records(h).iter().any(|r| r.name == inner) != open
    });
    stays(&mut h, &anchor, "folding a Git folder", FOLD_SLACK);
    click(&mut h, &folder);
    h.wait("the Git folder back", |h| {
        records(h).iter().any(|r| r.name == inner) == open
    });
    stays(&mut h, &anchor, "unfolding it", FOLD_SLACK);

    h.close();
    follower.abort();
}

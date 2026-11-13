//! The stock `sidebar-react` mod (the web's unchanged stock sidebar through the native React runtime) in the real
//! mod engine: it draws every sidebar fixture state in light and dark, written for the parity gate to
//! `e2e/artifacts-native-parity/way2/`, and clicks dispatched into the offscreen window work as on the web: a
//! project header folds and unfolds its project, a session row opens the session, a workspace line focuses the
//! workspace, and the organize menu switches the view to By status.
//!
//! Offscreen, as the other render tests: GPUI's test platform draws through Metal into a texture; no window is
//! shown or focused and no core runs.

#[path = "common/parity.rs"]
mod parity;

use gpui::{
    px, size, AppContext as _, HeadlessAppContext, Modifiers, MouseButton, MouseDownEvent,
    MouseUpEvent, PlatformInput, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use gpui_shell::HostArguments;
use perch_native::mods::perch::{from_host, Perch};
use perch_native::mods::{self, ModHost, ModView};
use perch_native::ui::{OpenSession, Workspace};
use serde_json::Value;
use std::cell::RefCell;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::sync::Arc;
use std::time::Instant;

const MOD: &str = "sidebar-react";

/// Where the renderings go, beside the web reference.
fn way2_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../e2e/artifacts-native-parity/way2")
}

/// Draws `window` afresh and returns every probe record (named or not).
fn draw(cx: &mut HeadlessAppContext, window: WindowHandle<ModView>) -> Vec<ProbeRecord> {
    cx.run_until_parked();
    cx.update_window(window.into(), |_, window: &mut Window, cx| {
        probe::clear();
        window.refresh();
        let _ = window.draw(cx);
    })
    .unwrap();
    let error = cx.update(|cx| window.entity(&*cx).unwrap().read(cx).error(cx));
    assert_eq!(error, None, "the mod renders");
    probe::records().into_values().collect()
}

/// The record whose id is `name` (or, for an unnamed node, ends with `:testid`).
fn find(records: &[ProbeRecord], name: &str) -> Option<ProbeRecord> {
    records
        .iter()
        .find(|r| {
            r.name == name || r.name.ends_with(&format!(":{name}")) && r.name.starts_with('~')
        })
        .cloned()
}

/// A left click at the middle of `name`'s box, as the platform would deliver it.
fn click(cx: &mut HeadlessAppContext, window: WindowHandle<ModView>, name: &str) {
    let records = draw(cx, window);
    let target = find(&records, name).unwrap_or_else(|| panic!("{name} is drawn"));
    let at = target.bounds.center();
    cx.update_window(window.into(), |_, window: &mut Window, cx| {
        let down = MouseDownEvent {
            button: MouseButton::Left,
            position: at,
            modifiers: Modifiers::default(),
            click_count: 1,
            first_mouse: false,
        };
        window.dispatch_event(PlatformInput::MouseDown(down), cx);
        let up = MouseUpEvent {
            button: MouseButton::Left,
            position: at,
            modifiers: Modifiers::default(),
            click_count: 1,
        };
        window.dispatch_event(PlatformInput::MouseUp(up), cx);
    })
    .unwrap();
    cx.run_until_parked();
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-sidebar-react-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));

    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    cx.update(mods::init);
    let fixture = parity::Fixture::load(&parity::fixture_path("sidebar"));

    // The ten renderings for the gate.
    let out = way2_dir();
    for state in fixture.states() {
        for theme in [parity::Theme::Light, parity::Theme::Dark] {
            let started = Instant::now();
            let shot = parity::capture(
                &mut cx,
                &parity::Capture {
                    mod_id: MOD,
                    fixture: &fixture,
                    state: &state,
                    theme,
                    out: &out,
                },
            );
            let elements = shot.report["elements"].as_array().unwrap().len();
            assert!(
                elements > 20,
                "{state} {}: {elements} named elements",
                theme.word()
            );
            println!(
                "sidebar-react: {state} {} drawn, {elements} named elements, {:.0} ms with load",
                theme.word(),
                started.elapsed().as_secs_f64() * 1000.
            );
        }
    }

    // Behaviour: the window the module follows, with the fixture's by-project state.
    let state = "by-project";
    let data = fixture.data(state);
    let host = ModHost::new(scratch.join("native-mods")).expect("the mod host starts");
    let perch = Perch::new();
    perch.register(&host);
    let workspace_window = cx
        .open_window(size(px(1000.), px(800.)), |_, cx| {
            cx.new(|cx| Workspace::new(parity::state_from(&data).model(), None, cx))
        })
        .unwrap();
    let workspace = workspace_window.entity(&cx).unwrap();
    let opened: Rc<RefCell<Vec<String>>> = Rc::default();
    let _opened = cx.update(|cx| {
        let opened = opened.clone();
        let sidebar = workspace.read(cx).sidebar().clone();
        cx.subscribe(&sidebar, move |_, event: &OpenSession, _| {
            opened.borrow_mut().push(event.session_id.clone())
        })
    });
    cx.update(|cx| perch.attach(&workspace, workspace_window.into(), cx));
    let text = |key: &str| data[key].as_str().map(str::to_string);
    perch.set_active(text("activeHostId"), None, text("activeWorkspaceId"));
    perch.set_sidebar(fixture.view(state));
    perch.set_theme(parity::Theme::Dark.name());
    cx.update(|cx| perch.flush(cx));

    let started = Instant::now();
    let window = cx
        .open_window(size(px(240.), px(800.)), |window, cx| {
            host.view(MOD, window, cx)
        })
        .unwrap();
    let records = draw(&mut cx, window);
    let first = started.elapsed();
    assert!(find(&records, "sidebar-root").is_some());
    let started = Instant::now();
    cx.update(|cx| host.refresh(None, cx));
    draw(&mut cx, window);
    let again = started.elapsed();
    println!(
        "sidebar-react: first render {:.0} ms (load, mount, describe, layout, paint), re-render {:.1} ms",
        first.as_secs_f64() * 1000.,
        again.as_secs_f64() * 1000.
    );

    // A project with several checkouts folds from its header and unfolds again.
    let project = "p-perch";
    let workspaces = format!("project-workspaces:{project}");
    assert!(find(&draw(&mut cx, window), &workspaces).is_some());
    click(&mut cx, window, &format!("project-header:{project}"));
    assert!(
        find(&draw(&mut cx, window), &workspaces).is_none(),
        "folded"
    );
    assert_eq!(
        perch.sidebar().collapsed_projects,
        [project],
        "the window's sidebar settings"
    );
    click(&mut cx, window, &format!("project-header:{project}"));
    assert!(
        find(&draw(&mut cx, window), &workspaces).is_some(),
        "unfolded"
    );
    assert!(perch.sidebar().collapsed_projects.is_empty());

    // A session row opens its session in the window.
    click(&mut cx, window, "session-button:s-perch-3");
    assert_eq!(
        *opened.borrow(),
        ["s-perch-3"],
        "session.open reached the window"
    );

    // A workspace line focuses the workspace.
    let records = draw(&mut cx, window);
    let line = records
        .iter()
        .find(|r| r.name.starts_with("workspace-button:"))
        .expect("a workspace line is drawn")
        .name
        .to_string();
    let workspace_id = line.trim_start_matches("workspace-button:").to_string();
    click(&mut cx, window, &line);
    let focus = from_host(
        &perch
            .module("behaviour")
            .call("focus", &HostArguments::new([]))
            .unwrap(),
    );
    assert_eq!(
        focus["workspaceId"],
        Value::String(workspace_id),
        "workspace.focus ran"
    );

    // The organize menu switches the view to By status.
    assert!(find(&draw(&mut cx, window), "status-view").is_none());
    click(&mut cx, window, "organize-button");
    click(&mut cx, window, "workspace-organize-status");
    assert_eq!(perch.sidebar().organize, "status");
    let records = draw(&mut cx, window);
    assert!(
        find(&records, "status-view").is_some(),
        "By status is shown"
    );
    assert!(
        find(&records, "workspace-organize-status").is_none(),
        "the menu closed"
    );

    for window in [window.into(), workspace_window.into()] {
        cx.update_window(window, |_, window, _| window.remove_window())
            .unwrap();
    }
    cx.run_until_parked();
    let _ = std::fs::remove_dir_all(&scratch);
    println!("mods_sidebar_react: ok");
}

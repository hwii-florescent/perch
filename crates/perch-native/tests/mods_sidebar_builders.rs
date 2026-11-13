//! The sidebar written by hand with element builders (`mods/sidebar-builders`): drawn from every
//! state of the parity fixture in both themes, for `e2e/native-parity/compare.mjs`.
//!
//! Offscreen, as the other mod tests: GPUI's test platform draws through Metal into a texture; no
//! window is shown or focused and no core runs.

#[path = "common/parity.rs"]
mod parity;

use gpui::{
    point, px, size, AppContext as _, HeadlessAppContext, Modifiers, MouseButton, MouseDownEvent,
    MouseMoveEvent, MouseUpEvent, PlatformInput, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_native::mods::perch::Perch;
use perch_native::mods::{self, theme, ModHost, ModView};
use perch_native::ui::Workspace;
use std::sync::Arc;
use std::time::{Duration, Instant};

/// Draws `window` afresh and returns it; `name` is read from the records of that draw.
fn draw(cx: &mut HeadlessAppContext, window: WindowHandle<ModView>) {
    cx.run_until_parked();
    cx.update_window(window.into(), |_, window: &mut Window, cx| {
        probe::clear();
        window.refresh();
        let _ = window.draw(cx);
    })
    .unwrap();
    let error = cx.update(|cx| window.entity(&*cx).unwrap().read(cx).error(cx));
    assert_eq!(error, None, "the mod renders");
}

fn record(name: &str) -> ProbeRecord {
    probe::record(name).unwrap_or_else(|| panic!("{name} is drawn"))
}

fn event(cx: &mut HeadlessAppContext, window: WindowHandle<ModView>, input: PlatformInput) {
    cx.update_window(window.into(), |_, window: &mut Window, cx| {
        window.dispatch_event(input, cx);
    })
    .unwrap();
}

/// The pointer over the middle of `name`, as drawn now, and the draw after it.
fn hover(cx: &mut HeadlessAppContext, window: WindowHandle<ModView>, name: &str) {
    let position = record(name).bounds.center();
    let input = PlatformInput::MouseMove(MouseMoveEvent {
        position,
        pressed_button: None,
        modifiers: Modifiers::default(),
    });
    event(cx, window, input);
    draw(cx, window);
}

/// A left click on the middle of `name`, then the redraw the click causes.
fn click(cx: &mut HeadlessAppContext, window: WindowHandle<ModView>, perch: &Perch, name: &str) {
    let position = record(name).bounds.center();
    hover(cx, window, name);
    event(
        cx,
        window,
        PlatformInput::MouseDown(MouseDownEvent {
            button: MouseButton::Left,
            position,
            modifiers: Modifiers::default(),
            click_count: 1,
            first_mouse: false,
        }),
    );
    event(
        cx,
        window,
        PlatformInput::MouseUp(MouseUpEvent {
            button: MouseButton::Left,
            position,
            modifiers: Modifiers::default(),
            click_count: 1,
        }),
    );
    cx.run_until_parked();
    cx.update(|cx| perch.flush(cx));
    draw(cx, window);
}

fn hex(color: gpui::Hsla) -> String {
    parity::rgba(color)[..7].to_string()
}

/// What a click on each control of the sidebar does, in a window that follows a `Workspace`: the
/// model, the view settings and the redraw all change, through `perch.run` and
/// `perch.setSidebarSettings` only.
fn behaviour(cx: &mut HeadlessAppContext, user: &std::path::Path) {
    let fixture = parity::Fixture::load(&parity::fixture_path("sidebar"));
    let data = fixture.data("by-project");
    let host = ModHost::new(user.to_path_buf()).expect("the mod host starts");
    let perch = Perch::new();
    perch.register(&host);
    perch.set_sidebar(fixture.view("by-project"));
    let workspace_window = cx
        .open_window(size(px(1000.), px(700.)), |_, cx| {
            cx.new(|cx| Workspace::new(parity::state_from(&data).model(), None, cx))
        })
        .unwrap();
    let workspace = workspace_window.entity(&*cx).unwrap();
    cx.update(|cx| perch.attach(&workspace, workspace_window.into(), cx));
    perch.set_theme("perch");
    cx.update(|cx| perch.flush(cx));
    let tokens = theme::resolve("perch");
    let token = |name: &str| tokens.token(name).unwrap().to_string();

    let window = cx
        .open_window(size(px(240.), px(800.)), |window, cx| {
            host.view("sidebar-builders", window, cx)
        })
        .unwrap();
    // The pointer starts outside the window, so nothing is hovered.
    event(
        cx,
        window,
        PlatformInput::MouseMove(MouseMoveEvent {
            position: point(px(-1.), px(-1.)),
            pressed_button: None,
            modifiers: Modifiers::default(),
        }),
    );
    draw(cx, window);

    // A project header folds its project: the workspaces go, and the sidebar settings say so.
    assert!(probe::record("project-workspaces:p-perch").is_some());
    click(cx, window, &perch, "project-toggle:p-perch");
    assert_eq!(perch.sidebar().collapsed_projects, ["p-perch"]);
    assert!(
        probe::record("project-workspaces:p-perch").is_none(),
        "a folded project shows no workspaces"
    );
    assert!(
        probe::record("project-rollup:p-perch").is_some(),
        "its sessions' state is rolled up"
    );
    click(cx, window, &perch, "project-toggle:p-perch");
    assert!(perch.sidebar().collapsed_projects.is_empty());
    assert!(probe::record("project-workspaces:p-perch").is_some());

    // Controls that are only there under the pointer appear on hover and go with it.
    hover(cx, window, "settings-gear");
    assert!(probe::record("project-menu-button:p-perch").is_none());
    assert!(probe::record("session-close-button:s-perch-1").is_none());
    hover(cx, window, "project-header:p-perch");
    assert!(probe::record("project-menu-button:p-perch").is_some());
    assert!(probe::record("project-add-button:p-perch").is_some());
    assert!(
        probe::record("project-menu-button:p-api").is_none(),
        "only the hovered header's"
    );
    assert_eq!(
        record("project-header:p-perch").bounds.size.width,
        px(234.),
        "the header keeps its size"
    );
    hover(cx, window, "session-row:s-perch-1");
    assert!(probe::record("session-close-button:s-perch-1").is_some());
    assert!(probe::record("project-menu-button:p-perch").is_none());
    hover(cx, window, "settings-gear");
    assert!(probe::record("session-close-button:s-perch-1").is_none());

    // A workspace line focuses its workspace: its name is drawn in the text colour from then on.
    let name_colour =
        |workspace: &str| hex(record(&format!("workspace-name:{workspace}")).text_color);
    assert_eq!(name_colour("w-api-main"), token("subtext-0"));
    click(cx, window, &perch, "workspace-button:w-api-main");
    assert_eq!(name_colour("w-api-main"), token("text"));
    assert_eq!(name_colour("w-api-rate"), token("subtext-0"));

    // A session row opens its session in the window: it is the active row afterwards.
    assert_ne!(
        record("session-row:s-perch-3").background.map(hex),
        Some(token("surface-1"))
    );
    click(cx, window, &perch, "session-button:s-perch-3");
    assert_eq!(
        record("session-row:s-perch-3").background.map(hex),
        Some(token("surface-1")),
        "the opened session is the active row"
    );
    assert_eq!(
        workspace.read_with(&*cx, |ws, _| ws.open().map(|o| o.session_id.clone())),
        Some("s-perch-3".to_string()),
        "and the window opened it"
    );

    // The organize control walks By project, By status, In one list and back.
    assert!(probe::record("status-view").is_none());
    click(cx, window, &perch, "organize-button");
    assert_eq!(perch.sidebar().organize, "status");
    assert!(probe::record("status-view").is_some());
    assert!(probe::record("project-header:p-perch").is_none());
    click(cx, window, &perch, "organize-button");
    assert_eq!(perch.sidebar().organize, "list");
    assert!(probe::record("status-view").is_none());
    assert!(probe::record("session-row:s-perch-3").is_some());
    assert!(probe::record("project-header:p-perch").is_none());
    click(cx, window, &perch, "organize-button");
    assert_eq!(perch.sidebar().organize, "project");
    assert!(probe::record("project-header:p-perch").is_some());

    // The host chip opens the list of computers; choosing one shows that computer.
    assert!(probe::record("new-session-button:local").is_some());
    assert!(probe::record("host-option:buildbox").is_none());
    click(cx, window, &perch, "host-switcher");
    assert!(probe::record("host-option:local").is_some());
    click(cx, window, &perch, "host-option:buildbox");
    assert!(
        probe::record("host-option:buildbox").is_none(),
        "choosing closes the list"
    );
    assert!(
        probe::record("new-session-button:buildbox").is_some(),
        "the shown computer is buildbox"
    );

    for handle in [window.into(), workspace_window.into()] {
        cx.update_window(handle, |_, window, _| window.remove_window())
            .unwrap();
    }
    cx.run_until_parked();
}

const RUNS: usize = 9;

fn median(mut times: Vec<Duration>) -> f64 {
    times.sort();
    times[times.len() / 2].as_secs_f64() * 1000.
}

/// How long the sidebar takes: the first draw of a freshly loaded mod, the draw after a session's
/// state changes in the model, and a fold click through to the redrawn frame. Each is the median of
/// `RUNS` runs, in milliseconds; a draw is layout and paint of the offscreen window, not the image
/// read back. Printed, not asserted.
fn timings(cx: &mut HeadlessAppContext, user: &std::path::Path) {
    let fixture = parity::Fixture::load(&parity::fixture_path("sidebar"));
    let host = ModHost::new(user.to_path_buf()).expect("the mod host starts");
    let perch = Perch::new();
    perch.register(&host);
    parity::publish(&perch, &fixture, "by-project");
    perch.set_theme("perch");
    cx.update(|cx| perch.flush(cx));
    let open = |cx: &mut HeadlessAppContext| {
        cx.open_window(size(px(240.), px(800.)), |window, cx| {
            host.view("sidebar-builders", window, cx)
        })
        .unwrap()
    };

    // The first render after the mod loads: opening the window loads the mod and draws it.
    let mut first = Vec::new();
    for _ in 0..RUNS {
        let started = Instant::now();
        let window = open(cx);
        draw(cx, window);
        first.push(started.elapsed());
        cx.update_window(window.into(), |_, window, _| window.remove_window())
            .unwrap();
        cx.run_until_parked();
    }

    // A re-render after the data changes: the model of By project, then the same with the
    // sessions' states of the needs-you state, then back.
    let window = open(cx);
    draw(cx, window);
    let models =
        ["needs-you", "by-project"].map(|state| parity::state_from(&fixture.data(state)).model());
    let mut change = Vec::new();
    for run in 0..RUNS {
        let model = models[run % 2].clone();
        let started = Instant::now();
        perch.set_model(model);
        cx.update(|cx| perch.flush(cx));
        draw(cx, window);
        change.push(started.elapsed());
    }

    // A fold click through to the redrawn frame (pointer already over the header).
    hover(cx, window, "project-toggle:p-perch");
    let mut fold = Vec::new();
    for _ in 0..RUNS {
        let position = record("project-toggle:p-perch").bounds.center();
        let started = Instant::now();
        for input in [
            PlatformInput::MouseDown(MouseDownEvent {
                button: MouseButton::Left,
                position,
                modifiers: Modifiers::default(),
                click_count: 1,
                first_mouse: false,
            }),
            PlatformInput::MouseUp(MouseUpEvent {
                button: MouseButton::Left,
                position,
                modifiers: Modifiers::default(),
                click_count: 1,
            }),
        ] {
            event(cx, window, input);
        }
        cx.run_until_parked();
        cx.update(|cx| perch.flush(cx));
        draw(cx, window);
        fold.push(started.elapsed());
    }
    cx.update_window(window.into(), |_, window, _| window.remove_window())
        .unwrap();
    cx.run_until_parked();

    let build = if cfg!(debug_assertions) {
        "debug"
    } else {
        "release"
    };
    let bytes: usize = mods::STOCK
        .iter()
        .filter(|(path, _)| path.starts_with("sidebar-builders/"))
        .map(|(_, text)| text.len())
        .sum();
    println!(
        "timings ({build}, median of {RUNS}, ms): first render {:.1}, data change {:.1}, fold click {:.1}; mod {bytes} bytes of JS",
        median(first),
        median(change),
        median(fold)
    );
}

fn main() {
    let scratch =
        std::env::temp_dir().join(format!("perch-sidebar-builders-{}", std::process::id()));
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
    let out = parity::artifacts_dir().join("way1");
    for state in fixture.states() {
        for theme in [parity::Theme::Light, parity::Theme::Dark] {
            let shot = parity::capture(
                &mut cx,
                &parity::Capture {
                    mod_id: "sidebar-builders",
                    fixture: &fixture,
                    state: &state,
                    theme,
                    out: &out,
                },
            );
            println!("{}", shot.png.display());
        }
    }
    behaviour(&mut cx, &scratch.join("behaviour-mods"));
    timings(&mut cx, &scratch.join("timing-mods"));
    let _ = std::fs::remove_dir_all(&scratch);
    println!("mods_sidebar_builders: ok");
}

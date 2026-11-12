//! Renders the window offscreen from the messages a core sends and checks what is drawn.
//!
//! GPUI's test platform draws through the real Metal renderer into a texture
//! (`Window::render_to_image`); no window is created, shown or focused. This is its own
//! binary with a custom `main`, as Zed's headless tests are, so AppKit runs on the main thread.

use gpui::{px, size, AppContext, HeadlessAppContext, Window};
use perch_core::protocol::ServerMessage;
use perch_native::sidebar::{Attention, State};
use perch_native::ui::{tint, OpenSession, Workspace, SIDEBAR_WIDTH};
use serde_json::{json, Value};
use std::sync::Arc;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

/// A sidebar state with one project, holding a session per `(title, flags)`.
fn state(sessions: &[(&str, Value)]) -> State {
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "project.list", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [{
            "id": "p", "hostId": "local", "name": "Work", "path": "/work", "favorite": false,
            "createdAt": 0, "updatedAt": 0}]})));
    let sessions: Vec<Value> = sessions
        .iter()
        .map(|(title, flags)| {
            let mut session = json!({
                "id": title, "title": title, "cwd": "/work", "createdAt": 0, "status": "idle",
                "hostId": "local", "projectId": "p", "cliProviderId": "claude"});
            for (key, value) in flags.as_object().unwrap() {
                session[key] = value.clone();
            }
            session
        })
        .collect();
    state.apply(&message(
        json!({"type": "session.list", "sessions": sessions}),
    ));
    state
}

struct Frame {
    /// What the main area was told to show.
    opened: Option<OpenSession>,
    /// RGBA, row by row.
    raw: Vec<u8>,
    width: usize,
    sidebar_edge: usize,
}

impl Frame {
    /// Pixels of `color` (within rounding) in the sidebar, or in the main area.
    fn count(&self, color: u32, sidebar: bool) -> usize {
        let want = [(color >> 16) as u8, (color >> 8) as u8, color as u8];
        self.pixels(sidebar, |p| {
            p[..3].iter().zip(want).all(|(a, b)| a.abs_diff(b) <= 2)
        })
    }

    /// Near-white pixels: title text. The background, dim hints and state fills never get this bright.
    fn bright(&self, sidebar: bool) -> usize {
        self.pixels(sidebar, |p| p[..3].iter().all(|c| *c >= 0xc0))
    }

    fn pixels(&self, sidebar: bool, matches: impl Fn(&[u8; 4]) -> bool) -> usize {
        self.raw
            .chunks_exact(4)
            .enumerate()
            .filter(|(i, p)| {
                (i % self.width < self.sidebar_edge) == sidebar
                    && matches(&[p[0], p[1], p[2], p[3]])
            })
            .count()
    }
}

/// Draw the window for `state`, with `open` picked first when given.
fn draw(cx: &mut HeadlessAppContext, state: &State, open: Option<(&str, Option<&str>)>) -> Frame {
    let model = state.model();
    let window = cx
        .open_window(size(px(640.), px(360.)), |_, cx| {
            cx.new(|cx| Workspace::new(model, None, cx))
        })
        .unwrap();
    if let Some((id, launched_with)) = open {
        window
            .update(cx, |workspace, _, cx| {
                workspace.sidebar().update(cx, |sidebar, cx| {
                    sidebar.open("local".into(), id.into(), launched_with.map(Into::into), cx)
                })
            })
            .unwrap();
    }
    let opened = window
        .update(cx, |workspace, _, _| workspace.open().cloned())
        .unwrap();
    let (image, scale) = cx
        .update_window(window.into(), |_, window: &mut Window, cx| {
            let _ = window.draw(cx);
            (
                window.render_to_image().expect("offscreen render"),
                window.scale_factor(),
            )
        })
        .unwrap();
    Frame {
        opened,
        width: image.width() as usize,
        raw: image.into_raw(),
        sidebar_edge: (SIDEBAR_WIDTH * scale) as usize,
    }
}

fn main() {
    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let idle = |titles: &[&'static str]| -> Vec<(&'static str, Value)> {
        titles.iter().map(|t| (*t, json!({}))).collect()
    };

    // Titles are drawn, and only titles.
    let none = draw(&mut cx, &state(&[]), None);
    let one = draw(&mut cx, &state(&idle(&["alpha"])), None);
    let three = draw(&mut cx, &state(&idle(&["alpha", "bravo", "charlie"])), None);
    let bravo = draw(&mut cx, &state(&idle(&["bravo"])), None);
    assert_eq!(
        none.bright(true),
        0,
        "a sidebar with no sessions has no title text"
    );
    assert!(one.bright(true) > 20, "one session title should be drawn");
    assert!(
        three.bright(true) > one.bright(true),
        "three titles draw more than one"
    );
    assert_eq!(
        none.bright(false) + one.bright(false),
        0,
        "the main area stays quiet"
    );
    assert_ne!(one.raw, bravo.raw, "the title text is what differs");

    // A state is drawn as its fill and nothing else is: needs you, done and working each
    // have their own, and idle has none.
    let states: [(Attention, Value); 3] = [
        (Attention::NeedsYou, json!({"blocked": true})),
        (Attention::Done, json!({"unseen": true})),
        (Attention::Working, json!({"status": "running"})),
    ];
    let mut counts = Vec::new();
    for (attention, flags) in &states {
        let frame = draw(&mut cx, &state(&[("session", flags.clone())]), None);
        let fills: Vec<usize> = states
            .iter()
            .map(|(other, _)| frame.count(tint(*other).1, true))
            .collect();
        for (i, (other, _)) in states.iter().enumerate() {
            let own = other == attention;
            assert_eq!(
                fills[i] > 30,
                own,
                "{attention:?} drew {other:?}'s fill ({fills:?})"
            );
        }
        assert!(
            frame.count(tint(*attention).0, true) > 10,
            "{attention:?} has a dot"
        );
        counts.push(frame);
    }
    let quiet = draw(&mut cx, &state(&idle(&["session"])), None);
    for (attention, _) in &states {
        assert_eq!(
            quiet.count(tint(*attention).1, true),
            0,
            "idle has no label fill"
        );
    }

    // Disconnected: the row is still there, with no state claimed.
    let mut dropped = state(&[("session", json!({"blocked": true}))]);
    dropped.disconnect(Some("connection refused".into()));
    let dropped = draw(&mut cx, &dropped, None);
    assert_eq!(dropped.count(tint(Attention::NeedsYou).1, true), 0);
    assert_eq!(dropped.count(tint(Attention::NeedsYou).0, true), 0);
    assert!(
        dropped.bright(true) > 20,
        "the last-known title is still drawn"
    );

    // Picking a session shows its title in the main area.
    let picked = draw(&mut cx, &state(&idle(&["alpha"])), Some(("alpha", None)));
    assert!(
        picked.bright(false) > 20,
        "the open session's title is drawn in the main area"
    );
    // The seam to the terminal view: which session, and the provider to attach with.
    let opened = picked.opened.unwrap();
    assert_eq!(
        (opened.session_id.as_str(), opened.title.as_str()),
        ("alpha", "alpha")
    );
    assert_eq!(opened.provider_id.as_deref(), Some("claude"));
    // A session just launched is not listed yet: the launch says what it runs.
    let fresh = draw(&mut cx, &state(&[]), Some(("new", Some("codex"))))
        .opened
        .unwrap();
    assert_eq!(
        (fresh.title.as_str(), fresh.provider_id.as_deref()),
        ("New session", Some("codex"))
    );

    println!(
        "sidebar_render: ok (title pixels {}, {}; fills {:?})",
        one.bright(true),
        three.bright(true),
        counts
            .iter()
            .zip(&states)
            .map(|(f, (a, _))| f.count(tint(*a).1, true))
            .collect::<Vec<_>>()
    );
}

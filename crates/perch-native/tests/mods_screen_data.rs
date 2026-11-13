//! What a native screen mod reads from `perch` is what the web screen was fed: for every chrome
//! screen and every state of its parity fixture, the fixture is fed to the Rust models (the
//! core's messages, and the window's tabs, split, zoom and notifications) and each value the web
//! recorded under `sdk` (`e2e/native-parity/fixtures/sdk/<screen>.<state>.json`) is compared
//! field for field with the module's answer. Where the native client does not have what the web
//! value depends on, the field is listed in [`EXCEPTIONS`] with the reason; any other
//! difference fails. No core, no window.

#[path = "common/parity.rs"]
mod parity;
#[path = "common/parity_screens.rs"]
mod parity_screens;

use parity_screens::{Difference, Exception, ScreenFixture};
use perch_native::mods::perch::Perch;
use serde_json::json;

const SCREENS: [&str; 9] = [
    "tabs",
    "status",
    "navigator",
    "pane-header",
    "pane-menu",
    "confirm",
    "dialog",
    "toast",
    "new-session",
];

const NO_FILE_TABS: &str =
    "the native strip holds sessions only: no file, review or browser tabs, and so no file tab \
     on screen";

/// Every difference the native client cannot remove, and why.
const EXCEPTIONS: &[Exception] = &[
    Exception {
        screen: "tabs",
        states: &["files-and-pages"],
        path: "workspaceTabs",
        reason: NO_FILE_TABS,
    },
    Exception {
        screen: "pane-header",
        states: &["corner"],
        path: "workspaceTabs",
        reason: NO_FILE_TABS,
    },
    Exception {
        screen: "tabs",
        states: &["round-shape"],
        path: "workspaceTabs.tabShape",
        reason: "the native client reads no tab shape setting; its strip is square",
    },
    Exception {
        screen: "toast",
        states: &["*"],
        path: "notifications[*].timeout",
        reason: "the web reference holds every toast for 10 minutes to measure it; the native \
                 window keeps the real 6 s (10 s blocked)",
    },
    Exception {
        screen: "toast",
        states: &["usage-alert", "over-limit"],
        path: "notifications[*].level",
        reason: "the fixture gives the core's usage alert a warning level; `usage.alert` carries \
                 none and the web's store sets none (a usage card's ring is yellow either way)",
    },
    Exception {
        screen: "new-session",
        states: &["*"],
        path: "agentChoices.lastChoice",
        reason: "the native client remembers no last agent pick",
    },
];

/// The differences of `screen` in `state` that no exception covers, and the exceptions used.
fn compare(
    perch: &Perch,
    fixture: &ScreenFixture,
    state: &str,
    expected: &serde_json::Value,
    used: &mut [bool],
) -> Vec<Difference> {
    let mut web = expected.clone();
    parity_screens::fill_wire_defaults(&mut web);
    let props = fixture.props(state);
    let native = parity_screens::native_sdk(perch, &web, props.as_ref());
    let mut found = Vec::new();
    for key in native.as_object().unwrap().keys() {
        parity_screens::diff(key, &web[key], &native[key], &mut found);
    }
    found.retain(|d| {
        let covering = EXCEPTIONS
            .iter()
            .position(|e| e.covers(&fixture.screen, state, &d.path));
        if let Some(at) = covering {
            used[at] = true;
        }
        covering.is_none()
    });
    found
}

#[test]
fn every_screen_value_matches_what_the_web_screen_was_fed() {
    let mut used = vec![false; EXCEPTIONS.len()];
    let mut failures = Vec::new();
    let mut compared = 0;
    for screen in SCREENS {
        let fixture = ScreenFixture::load(screen);
        for state in fixture.states() {
            let perch = Perch::new();
            parity_screens::publish(&perch, &fixture, &state);
            let expected = fixture.expected(&state);
            compared += expected
                .as_object()
                .unwrap()
                .keys()
                .filter(|k| *k != "props" && *k != "steps")
                .count();
            let found = compare(&perch, &fixture, &state, &expected, &mut used);
            if !found.is_empty() {
                let lines: Vec<String> = found.iter().map(ToString::to_string).collect();
                failures.push(format!("{screen}.{state}:\n  {}", lines.join("\n  ")));
            }
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
    let unused: Vec<&str> = EXCEPTIONS
        .iter()
        .zip(&used)
        .filter(|(_, used)| !**used)
        .map(|(e, _)| e.path)
        .collect();
    assert!(unused.is_empty(), "exceptions nothing needs: {unused:?}");
    assert!(compared >= 30, "values compared: {compared}");
}

/// The comparison fails on a field no exception covers: one expected value changed.
#[test]
fn a_changed_expected_value_fails() {
    let fixture = ScreenFixture::load("status");
    let perch = Perch::new();
    parity_screens::publish(&perch, &fixture, "connected");
    let mut expected = fixture.expected("connected");
    let mut used = vec![false; EXCEPTIONS.len()];
    assert!(compare(&perch, &fixture, "connected", &expected, &mut used).is_empty());
    expected["statusLine"]["cwd"] = json!("/somewhere/else");
    let found = compare(&perch, &fixture, "connected", &expected, &mut used);
    assert_eq!(
        found,
        [Difference {
            path: "statusLine.cwd".into(),
            web: json!("/somewhere/else"),
            native: json!("/Users/dev/code/perch"),
        }]
    );
}

#[test]
fn exception_paths_cover_indices_and_what_is_under_them() {
    let e = Exception {
        screen: "toast",
        states: &["*"],
        path: "notifications[*].timeout",
        reason: "",
    };
    assert!(e.covers("toast", "done", "notifications[0].timeout"));
    assert!(e.covers("toast", "done", "notifications[12].timeout"));
    assert!(!e.covers("toast", "done", "notifications[0].title"));
    assert!(!e.covers("toast", "done", "notifications"));
    assert!(!e.covers("tabs", "done", "notifications[0].timeout"));
    let whole = Exception {
        screen: "tabs",
        states: &["x"],
        path: "workspaceTabs",
        reason: "",
    };
    assert!(whole.covers("tabs", "x", "workspaceTabs.tabs[3].kind"));
    assert!(!whole.covers("tabs", "y", "workspaceTabs.tabs[3].kind"));
    assert!(!whole.covers("tabs", "x", "workspaceTabsX"));
}

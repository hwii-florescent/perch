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
use serde_json::{json, Value};

const SCREENS: [&str; 16] = [
    "tabs",
    "status",
    "navigator",
    "pane-header",
    "pane-menu",
    "confirm",
    "dialog",
    "toast",
    "new-session",
    "keybind-help",
    "launcher",
    "start",
    "folder-browser",
    "instructions",
    "memory",
    "worktree",
];

/// The states whose web strip also holds review and browser tabs, which the native strip does not
/// hold yet: there only the web's session and file tabs are compared; the rest of `workspaceTabs`
/// is compared as everywhere else.
const SESSIONS_AND_FILES: &[(&str, &str)] =
    &[("tabs", "files-and-pages"), ("pane-header", "corner")];

/// Every difference the native client cannot remove, and why.
const EXCEPTIONS: &[Exception] = &[
    Exception {
        screen: "worktree",
        states: &["*"],
        path: "agentChoices.lastChoice",
        reason: "the last agent picked is the screen's own storage (`perch.lastAgentChoice`), not \
                 the window's data, and the worktree menu does not read it",
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
    Exception {
        screen: "launcher",
        states: &["*"],
        path: "agentChoices.lastChoice",
        reason: "the native client remembers no last agent pick",
    },
    Exception {
        screen: "start",
        states: &["*"],
        path: "agentChoices.lastChoice",
        reason: "the native client remembers no last agent pick",
    },
    Exception {
        screen: "keybind-help",
        states: &["*"],
        path: "keybindings",
        reason: "the native window lists the bindings it answers, a subset of the web's \
                 (`keybind_help_lists_the_web_rows_the_window_answers` checks which)",
    },
];

/// The web's keybind help rows the native window has no command for, by description.
const WEB_ONLY_BINDINGS: &[&str] = &[
    // No files, editor or Git in this window.
    "Toggle the right drawer (files and Git)",
    "Save file",
    "Find in file",
    "Replace in file",
    "Replace in file (alternate)",
    "Next file match (while Find is open)",
    "Previous file match (while Find is open)",
    "Next file match (alternate)",
    "Previous file match (alternate)",
    "Go to line",
    "Keep the preview tab open (make it a regular tab)",
    // No resize mode, project cycling or tab history.
    "Enter resize mode (Escape or timeout exits)",
    "Grow the focused pane",
    "Shrink the focused pane",
    "Resize pane down (shrink)",
    "Resize pane left (shrink)",
    "Resize pane right (grow)",
    "Resize pane up (grow)",
    "Next project's most recent session",
    "Back to where you were",
    "Forward",
    // No key yet for adding a project or a worktree.
    "Add project",
    "New workspace (worktree)",
    "Open this project's worktree menu",
    // Worded for the web's launcher, which also offers files and browsers.
    "New session: pick a project, then an agent, terminal or file",
];

/// The native window's rows the web's help has not: its wording of New session and its terminal
/// select-all.
const NATIVE_ONLY_BINDINGS: &[&str] = &[
    "New session: pick a computer, a project, then an agent or terminal",
    "Select all of the terminal's text",
];

/// Every native row is a web row (keys, words and group alike) unless it is listed above, and
/// every web row the native window leaves out is listed, in every state of the fixture.
#[test]
fn keybind_help_lists_the_web_rows_the_window_answers() {
    let fixture = ScreenFixture::load("keybind-help");
    let row = |r: &Value| format!("{} | {} | {}", r["group"], r["keys"], r["description"]);
    for state in fixture.states() {
        let perch = Perch::new();
        parity_screens::publish(&perch, &fixture, &state);
        let expected = fixture.expected(&state);
        let native = parity_screens::native_sdk(&perch, &expected, None);
        let web: Vec<String> = expected["keybindings"]
            .as_array()
            .unwrap()
            .iter()
            .map(row)
            .collect();
        let native: Vec<String> = native["keybindings"]
            .as_array()
            .unwrap()
            .iter()
            .map(row)
            .collect();
        let listed =
            |r: &String, list: &[&str]| list.iter().any(|d| r.ends_with(&format!("| \"{d}\"")));
        let extra: Vec<&String> = native
            .iter()
            .filter(|r| !web.contains(r) && !listed(r, NATIVE_ONLY_BINDINGS))
            .collect();
        let missing: Vec<&String> = web
            .iter()
            .filter(|r| !native.contains(r) && !listed(r, WEB_ONLY_BINDINGS))
            .collect();
        assert!(
            extra.is_empty(),
            "{state}: native rows the web has not: {extra:?}"
        );
        assert!(
            missing.is_empty(),
            "{state}: web rows the native window lacks: {missing:?}"
        );
    }
}

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
    if SESSIONS_AND_FILES.contains(&(fixture.screen.as_str(), state)) {
        let tabs = web["workspaceTabs"]["tabs"].as_array_mut().unwrap();
        tabs.retain(|t| t["kind"] == "session" || t["kind"] == "file");
    }
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

/// Beside the web's file tabs, its session tabs are still compared field for field.
#[test]
fn session_tabs_beside_file_tabs_are_compared() {
    let fixture = ScreenFixture::load("tabs");
    let perch = Perch::new();
    parity_screens::publish(&perch, &fixture, "files-and-pages");
    let mut expected = fixture.expected("files-and-pages");
    let mut used = vec![false; EXCEPTIONS.len()];
    assert!(compare(&perch, &fixture, "files-and-pages", &expected, &mut used).is_empty());
    expected["workspaceTabs"]["tabs"][0]["label"] = json!("Another session");
    let found = compare(&perch, &fixture, "files-and-pages", &expected, &mut used);
    assert_eq!(
        found.iter().map(|d| d.path.as_str()).collect::<Vec<_>>(),
        ["workspaceTabs.tabs[0].label"]
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

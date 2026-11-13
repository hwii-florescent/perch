//! The stock chrome screens on the React runtime (`tabs`, `status`, `pane-header`: the web's stock
//! source, unchanged) drawn in every state of their parity fixtures, light and dark, as the window
//! places them, into `e2e/artifacts-native-parity/native/` for the gate (`compare.mjs`).
//!
//! Offscreen: no window is shown or focused and no core runs.

#[path = "common/parity.rs"]
mod parity;
#[path = "common/parity_screens.rs"]
mod parity_screens;

use parity_screens::ScreenFixture;
use std::time::Instant;

const SCREENS: [&str; 6] = [
    "tabs",
    "status",
    "pane-header",
    "start",
    "folder-browser",
    "worktree",
];

fn main() {
    let scratch = std::env::temp_dir().join(format!("perch-chrome-capture-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    // `PERCH_PARITY_SCREENS=tabs,status`: only those.
    let only: Option<Vec<String>> = std::env::var("PERCH_PARITY_SCREENS")
        .ok()
        .map(|list| list.split(',').map(str::to_string).collect());
    let mut cx = parity_screens::headless();
    let out = parity::native_dir();
    for screen in SCREENS {
        if only
            .as_ref()
            .is_some_and(|o| !o.iter().any(|s| s == screen))
        {
            continue;
        }
        let fixture = ScreenFixture::load(screen);
        for state in fixture.states() {
            for theme in [parity::Theme::Dark, parity::Theme::Light] {
                let started = Instant::now();
                let shot = parity_screens::capture(
                    &mut cx,
                    &parity_screens::ScreenCapture {
                        fixture: &fixture,
                        state: &state,
                        theme,
                        mods: None,
                        out: &out,
                    },
                );
                let elements = shot.report["elements"].as_array().unwrap().len();
                println!(
                    "{screen}: {state} {} drawn, {elements} named elements, {:.0} ms",
                    theme.word(),
                    started.elapsed().as_secs_f64() * 1000.
                );
            }
        }
    }
    let _ = std::fs::remove_dir_all(&scratch);
    println!("mods_chrome_capture: ok");
}

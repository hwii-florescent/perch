//! The stock floating screens (the web's own Navigator, pane menu, confirmation, dialog,
//! notifications and New session menu, unchanged, through the native React runtime) drawn in
//! every state of their parity fixtures, light and dark, as the window places them, and written
//! to `e2e/artifacts-native-parity/native/` for the gate:
//!
//! ```sh
//! node e2e/native-parity/compare.mjs --web-dir e2e/artifacts-native-parity/web \
//!   --native-dir e2e/artifacts-native-parity/native
//! ```
//!
//! `PERCH_GATE_SCREENS=navigator,confirm` draws only those. Offscreen, as the other render
//! tests: no window is shown or focused and no core runs.

#[path = "common/parity.rs"]
mod parity;
#[path = "common/parity_screens.rs"]
mod parity_screens;

use perch_native::mods;
use std::time::Instant;

/// The floating screens a stock React mod draws.
const SCREENS: &[&str] = &["navigator", "pane-menu"];

fn main() {
    let scratch = std::env::temp_dir().join(format!("perch-floating-gate-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));

    let only = std::env::var("PERCH_GATE_SCREENS").ok();
    let mut cx = parity_screens::headless();
    cx.update(mods::init);
    let out = parity::native_dir();
    for screen in SCREENS {
        if only
            .as_deref()
            .is_some_and(|list| !list.split(',').any(|s| s == *screen))
        {
            continue;
        }
        let fixture = parity_screens::ScreenFixture::load(screen);
        for state in fixture.states() {
            for theme in [parity::Theme::Light, parity::Theme::Dark] {
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
                let elements = shot.report["elements"].as_array().map_or(0, Vec::len);
                assert!(
                    elements > 0,
                    "{screen} {state} {}: nothing named",
                    theme.word()
                );
                println!(
                    "{screen}: {state} {} drawn, {elements} named elements, {:.0} ms",
                    theme.word(),
                    started.elapsed().as_secs_f64() * 1000.
                );
            }
        }
    }
    let _ = std::fs::remove_dir_all(&scratch);
    println!("mods_floating_gate: ok");
}

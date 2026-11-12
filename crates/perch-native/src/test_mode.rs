//! Test mode (`PERCH_NATIVE_TEST=1`): the window opens without taking the keyboard or activating
//! the app, and a script from the environment sets up what it shows, so a state can be reached
//! and measured with no input event.
//!
//! - `PERCH_NATIVE_SIZE=1280x800`: the window's size in points.
//! - `PERCH_NATIVE_HIDDEN=1`: the window is created but never ordered in.
//! - `PERCH_NATIVE_SCRIPT` (or `PERCH_NATIVE_SCRIPT_FILE`): steps separated by `;` or new lines,
//!   run in order once the core has been heard from: `open <session id>` shows that session as a
//!   tab, `split right|down` starts a terminal beside the focused one, `pause <ms>` waits.
//!   Blank lines and lines starting with `#` are skipped.

use gpui::{AsyncApp, WindowHandle};
use perch_native::sidebar::LOCAL;
use perch_native::ui::Workspace;
use std::time::{Duration, Instant};

const STEP_TIMEOUT: Duration = Duration::from_secs(30);
const POLL: Duration = Duration::from_millis(100);

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Step {
    Open(String),
    Split(Direction),
    Pause(Duration),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Direction {
    Right,
    Down,
}

impl Direction {
    fn command(self) -> &'static str {
        match self {
            Direction::Right => "panes.splitRight",
            Direction::Down => "panes.splitDown",
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct TestMode {
    /// Window size in points.
    pub size: Option<(f32, f32)>,
    pub hidden: bool,
    pub steps: Vec<Step>,
}

impl TestMode {
    /// `None` unless `PERCH_NATIVE_TEST=1`.
    pub fn from_env() -> Result<Option<Self>, String> {
        Self::from_vars(|name| std::env::var(name).ok())
    }

    pub fn from_vars(get: impl Fn(&str) -> Option<String>) -> Result<Option<Self>, String> {
        if get("PERCH_NATIVE_TEST").as_deref() != Some("1") {
            return Ok(None);
        }
        let text = match (get("PERCH_NATIVE_SCRIPT"), get("PERCH_NATIVE_SCRIPT_FILE")) {
            (Some(text), _) => text,
            (None, Some(path)) => std::fs::read_to_string(&path)
                .map_err(|e| format!("could not read the script {path}: {e}"))?,
            (None, None) => String::new(),
        };
        Ok(Some(Self {
            size: get("PERCH_NATIVE_SIZE")
                .map(|text| parse_size(&text))
                .transpose()?,
            hidden: get("PERCH_NATIVE_HIDDEN").as_deref() == Some("1"),
            steps: parse_script(&text)?,
        }))
    }
}

fn parse_size(text: &str) -> Result<(f32, f32), String> {
    let bad = || format!("PERCH_NATIVE_SIZE must be <width>x<height>, not {text:?}");
    let (w, h) = text.split_once('x').ok_or_else(bad)?;
    let (w, h): (f32, f32) = (
        w.trim().parse().map_err(|_| bad())?,
        h.trim().parse().map_err(|_| bad())?,
    );
    if w >= 200. && h >= 200. && w.is_finite() && h.is_finite() {
        Ok((w, h))
    } else {
        Err(bad())
    }
}

pub fn parse_script(text: &str) -> Result<Vec<Step>, String> {
    text.split([';', '\n'])
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .map(|line| {
            let words: Vec<&str> = line.split_whitespace().collect();
            match words.as_slice() {
                ["open", id] if id.bytes().all(|b| b.is_ascii_graphic()) => {
                    Ok(Step::Open((*id).to_string()))
                }
                ["split", "right"] => Ok(Step::Split(Direction::Right)),
                ["split", "down"] => Ok(Step::Split(Direction::Down)),
                ["pause", ms] => ms
                    .parse()
                    .map(|ms| Step::Pause(Duration::from_millis(ms)))
                    .map_err(|_| format!("pause takes milliseconds, not {ms:?}")),
                _ => Err(format!("not a step: {line:?}")),
            }
        })
        .collect()
}

/// Run the steps against the window. Reports each step and the end on stderr; a step that does
/// not happen within [`STEP_TIMEOUT`] ends the process with status 1.
pub async fn run(steps: Vec<Step>, window: WindowHandle<Workspace>, cx: &mut AsyncApp) {
    for (number, step) in steps.iter().enumerate() {
        let done = match step {
            Step::Pause(wait) => {
                cx.background_executor().timer(*wait).await;
                true
            }
            Step::Open(id) => open(id, window, cx).await,
            Step::Split(direction) => split(*direction, window, cx).await,
        };
        if !done {
            eprintln!(
                "perch-native-test: step {} ({step:?}) did not happen",
                number + 1
            );
            std::process::exit(1);
        }
        eprintln!("perch-native-test: step {} done", number + 1);
    }
    eprintln!("perch-native-test: script done");
}

/// Poll `check` until it holds or the step's time is up.
async fn until(cx: &mut AsyncApp, mut check: impl FnMut(&mut AsyncApp) -> bool) -> bool {
    let start = Instant::now();
    while start.elapsed() < STEP_TIMEOUT {
        if check(cx) {
            return true;
        }
        cx.background_executor().timer(POLL).await;
    }
    false
}

fn shown(window: WindowHandle<Workspace>, cx: &mut AsyncApp) -> Vec<String> {
    window
        .read_with(cx, |workspace, _| workspace.tabs().shown())
        .unwrap_or_default()
}

async fn open(id: &str, window: WindowHandle<Workspace>, cx: &mut AsyncApp) -> bool {
    // The follower lists the session before the window can show it.
    let listed = until(cx, |cx| {
        window
            .read_with(cx, |workspace, cx| {
                workspace.sidebar().read(cx).find_session(id).is_some()
            })
            .unwrap_or(false)
    })
    .await;
    if !listed {
        return false;
    }
    let provider = perch_core::agent_fleet::TERMINAL_PROVIDER.to_string();
    let asked = window.update(cx, |workspace, _, cx| {
        workspace.sidebar().update(cx, |sidebar, cx| {
            sidebar.open(LOCAL.into(), id.to_string(), Some(provider), cx)
        })
    });
    asked.is_ok() && until(cx, |cx| shown(window, cx).iter().any(|s| s == id)).await
}

async fn split(direction: Direction, window: WindowHandle<Workspace>, cx: &mut AsyncApp) -> bool {
    let before = shown(window, cx).len();
    // The launch needs the core's project list; until it has arrived the command says no.
    let started = until(cx, |cx| {
        window
            .update(cx, |workspace, window, cx| {
                workspace
                    .run_command(direction.command(), None, window, cx)
                    .is_ok()
            })
            .unwrap_or(false)
    })
    .await;
    started && until(cx, |cx| shown(window, cx).len() > before).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vars(pairs: &[(&str, &str)]) -> impl Fn(&str) -> Option<String> {
        let pairs: Vec<(String, String)> = pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        move |name| {
            pairs
                .iter()
                .find(|(k, _)| k == name)
                .map(|(_, v)| v.clone())
        }
    }

    #[test]
    fn the_script_is_steps_split_on_semicolons_and_lines() {
        let steps =
            parse_script("open abc-1; split right\n# a note\n\nsplit down;pause 250").unwrap();
        assert_eq!(
            steps,
            [
                Step::Open("abc-1".into()),
                Step::Split(Direction::Right),
                Step::Split(Direction::Down),
                Step::Pause(Duration::from_millis(250)),
            ]
        );
        assert_eq!(parse_script("").unwrap(), []);
    }

    #[test]
    fn a_step_that_is_not_understood_is_refused() {
        for bad in ["open", "open a b", "split left", "pause soon", "dance"] {
            assert!(parse_script(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn test_mode_needs_the_switch() {
        assert_eq!(
            TestMode::from_vars(vars(&[("PERCH_NATIVE_SCRIPT", "open a")])).unwrap(),
            None
        );
        let mode = TestMode::from_vars(vars(&[
            ("PERCH_NATIVE_TEST", "1"),
            ("PERCH_NATIVE_SIZE", "1280x800"),
            ("PERCH_NATIVE_HIDDEN", "1"),
            ("PERCH_NATIVE_SCRIPT", "open a"),
        ]))
        .unwrap()
        .unwrap();
        assert_eq!(mode.size, Some((1280., 800.)));
        assert!(mode.hidden);
        assert_eq!(mode.steps, [Step::Open("a".into())]);
    }

    #[test]
    fn a_bad_size_or_script_stops_the_start() {
        for size in ["1280", "axb", "10x10", "-5x800"] {
            let result = TestMode::from_vars(vars(&[
                ("PERCH_NATIVE_TEST", "1"),
                ("PERCH_NATIVE_SIZE", size),
            ]));
            assert!(result.is_err(), "{size}");
        }
        assert!(TestMode::from_vars(vars(&[
            ("PERCH_NATIVE_TEST", "1"),
            ("PERCH_NATIVE_SCRIPT", "nonsense"),
        ]))
        .is_err());
    }

    #[test]
    fn the_script_can_come_from_a_file() {
        let path = std::env::temp_dir().join(format!("perch-native-script-{}", std::process::id()));
        std::fs::write(&path, "open one\nsplit right\n").unwrap();
        let mode = TestMode::from_vars(vars(&[
            ("PERCH_NATIVE_TEST", "1"),
            ("PERCH_NATIVE_SCRIPT_FILE", path.to_str().unwrap()),
        ]))
        .unwrap()
        .unwrap();
        std::fs::remove_file(&path).unwrap();
        assert_eq!(mode.steps.len(), 2);
    }
}

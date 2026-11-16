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
//! - Files, review and browser steps: `files <workspace id>` shows that workspace's files,
//!   `file <workspace id> <path> [preview]` opens a file (relative to the workspace) as a tab,
//!   `review <workspace id>` opens its review, `browser <http(s) url>` opens a browser pane, and
//!   `close [<tab id>]` closes that tab or the focused one. Each is carried out by its own function
//!   below; until the feature behind it is built, that function reports the step as missing.
//!
//! The terminal never asks the system which Option key is down in this mode (it sees none), so a
//! run does not depend on the real keyboard.

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
    Files {
        workspace: String,
    },
    File {
        workspace: String,
        path: String,
        preview: bool,
    },
    Review {
        workspace: String,
    },
    Browser {
        url: String,
    },
    Close {
        tab: Option<String>,
    },
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
                ["files", workspace] => Ok(Step::Files {
                    workspace: workspace.to_string(),
                }),
                ["file", workspace, path, rest @ ..] if matches!(rest, [] | ["preview"]) => {
                    Ok(Step::File {
                        workspace: workspace.to_string(),
                        path: path.to_string(),
                        preview: !rest.is_empty(),
                    })
                }
                ["review", workspace] => Ok(Step::Review {
                    workspace: workspace.to_string(),
                }),
                ["browser", url] if url.starts_with("http://") || url.starts_with("https://") => {
                    Ok(Step::Browser {
                        url: url.to_string(),
                    })
                }
                ["browser", url] => Err(format!("browser takes an http(s) address, not {url:?}")),
                ["close"] => Ok(Step::Close { tab: None }),
                ["close", tab] => Ok(Step::Close {
                    tab: Some(tab.to_string()),
                }),
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
            Step::Files { workspace } => show_files(workspace, window, cx).await,
            Step::File {
                workspace,
                path,
                preview,
            } => open_file(workspace, path, *preview, window, cx).await,
            Step::Review { workspace } => open_review(workspace, window, cx).await,
            Step::Browser { url } => open_browser(url, window, cx).await,
            Step::Close { tab } => close_tab(tab.as_deref(), window, cx).await,
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

// The openers for files, review and browser steps. Each feature fills in its own function; until
// then the step is reported as missing and the run fails, so a measurement never passes by
// silently skipping the state it was asked for.

fn missing(step: &str) -> bool {
    eprintln!("perch-native-test: the {step} step is not in this build");
    false
}

/// `files <workspace id>`: that workspace's files are shown.
async fn show_files(
    _workspace: &str,
    _window: WindowHandle<Workspace>,
    _cx: &mut AsyncApp,
) -> bool {
    missing("files")
}

/// `file <workspace id> <path> [preview]`: the file is open as a tab (a preview tab if asked) and
/// its content is drawn.
async fn open_file(
    _workspace: &str,
    _path: &str,
    _preview: bool,
    _window: WindowHandle<Workspace>,
    _cx: &mut AsyncApp,
) -> bool {
    missing("file")
}

/// `review <workspace id>`: the workspace's review is open with its diff drawn.
async fn open_review(
    _workspace: &str,
    _window: WindowHandle<Workspace>,
    _cx: &mut AsyncApp,
) -> bool {
    missing("review")
}

/// `browser <url>`: a browser pane shows the page.
async fn open_browser(url: &str, window: WindowHandle<Workspace>, cx: &mut AsyncApp) -> bool {
    // A workspace must be known (the core's lists) before a tab can be opened in it.
    let args = serde_json::json!({ "url": url });
    let opened = until(cx, |cx| {
        window
            .update(cx, |workspace, window, cx| {
                workspace
                    .run_command("browser.open", Some(&args), window, cx)
                    .is_ok()
            })
            .unwrap_or(false)
    })
    .await;
    // The page is made where its pane is drawn. A window that gets no display frames (hidden, or the display
    // asleep) never draws on its own, so draw one each time it is looked at, until the page lives.
    opened
        && until(cx, |cx| {
            let _ = gpui::AppContext::update_window(cx, window.into(), |_, window, cx| {
                let _ = window.draw(cx);
            });
            window
                .read_with(cx, |workspace, _| {
                    let tab = workspace
                        .tabs()
                        .shown()
                        .iter()
                        .any(|id| perch_native::workspace::is_browser_tab(id));
                    let live = workspace
                        .browser_pages()
                        .is_some_and(|pages| pages.borrow().live_views() > 0);
                    tab && live
                })
                .unwrap_or(false)
        })
        .await
}

/// `close [<tab id>]`: that tab, or the focused one, is closed and gone from the strip.
async fn close_tab(tab: Option<&str>, window: WindowHandle<Workspace>, cx: &mut AsyncApp) -> bool {
    let Some(id) = tab.map(str::to_string).or_else(|| {
        window
            .read_with(cx, |workspace, _| {
                workspace.tabs().active().map(str::to_string)
            })
            .ok()
            .flatten()
    }) else {
        return false;
    };
    let args = serde_json::json!({ "id": id });
    let closed = window
        .update(cx, |workspace, window, cx| {
            workspace
                .run_command("tabs.close", Some(&args), window, cx)
                .is_ok()
        })
        .unwrap_or(false);
    closed
        && until(cx, |cx| {
            window
                .read_with(cx, |workspace, _| !workspace.tabs().contains(&id))
                .unwrap_or(false)
        })
        .await
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
        for bad in [
            "open",
            "open a b",
            "split left",
            "pause soon",
            "dance",
            "files",
            "file w",
            "file w a.rs pinned",
            "review",
            "browser file:///etc/hosts",
            "browser",
            "close a b",
        ] {
            assert!(parse_script(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn parses_file_review_browser_close_steps() {
        let steps = parse_script(
            "files w1; file w1 src/main.rs; file w1 README.md preview\nreview w1\nbrowser http://127.0.0.1:9/page.html; close; close t-2",
        )
        .unwrap();
        let file = |path: &str, preview| Step::File {
            workspace: "w1".into(),
            path: path.into(),
            preview,
        };
        assert_eq!(
            steps,
            [
                Step::Files {
                    workspace: "w1".into()
                },
                file("src/main.rs", false),
                file("README.md", true),
                Step::Review {
                    workspace: "w1".into()
                },
                Step::Browser {
                    url: "http://127.0.0.1:9/page.html".into()
                },
                Step::Close { tab: None },
                Step::Close {
                    tab: Some("t-2".into())
                },
            ]
        );
    }

    #[test]
    fn rejects_browser_step_without_http_url() {
        for url in [
            "file:///etc/hosts",
            "perch://x",
            "127.0.0.1:9",
            "javascript:alert(1)",
        ] {
            assert!(parse_script(&format!("browser {url}")).is_err(), "{url}");
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

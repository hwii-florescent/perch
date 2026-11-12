//! Attaches the terminal view to a shell in a real perch-core and checks the screen it draws:
//! what the shell had already printed, what is typed, the size the shell is given, and history.
//!
//! The core runs as a child of this test, as in `terminal_session`: the same executable re-run as
//! `__core <scratch>`, booted in-process, with everything it touches (database, hosts, settings,
//! the terminal daemon, `HOME`) private to the scratch directory. GPUI draws offscreen; no window
//! is created, shown or focused. The core, the shell and the daemon are stopped and checked gone
//! by PID before the test returns.

use gpui::{
    point, px, size, AppContext, HeadlessAppContext, KeyDownEvent, Keystroke, Modifiers,
    ScrollDelta, ScrollWheelEvent, TouchPhase, Window, WindowHandle,
};
use perch_core::server::CliArgs;
use perch_native::client::Core;
use perch_native::terminal::{Status, TerminalView};
use perch_native::ui::OpenSession;
use perchd::proto::SessionInfo;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::time::{Duration, Instant};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        // The daemon and the cleanup commands below are this executable run as perchd.
        Some("__perchd") => perch_core::daemon::run_if_requested(),
        Some("__core") => return run_core(Path::new(&args[2])),
        _ => {}
    }
    let scratch = scratch_dir();
    let owner = cleanup_owner(&scratch);
    let daemon_dir = scratch.join("daemon");
    let mut core = Command::new(std::env::current_exe().unwrap())
        .arg("__core")
        .arg(&scratch)
        .stdout(Stdio::piped())
        .spawn()
        .expect("start the core");
    let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        view(&mut core, &scratch);
    }));
    // The shell must not be released while a core is still attached to it, so stop the core first.
    let stopped = stop_core(&mut core).and_then(|()| stop_runtimes(&daemon_dir, &owner));
    match (outcome, stopped) {
        (Ok(()), Ok(())) => {
            let _ = std::fs::remove_dir_all(&scratch);
            println!("terminal_view: ok");
        }
        (outcome, stopped) => {
            eprintln!("scratch kept at {}", scratch.display());
            if let Err(error) = stopped {
                eprintln!("cleanup failed: {error}");
            }
            match outcome {
                Err(panic) => std::panic::resume_unwind(panic),
                Ok(()) => std::process::exit(1),
            }
        }
    }
}

fn cleanup_owner(scratch: &Path) -> String {
    format!("native-test:{}", scratch.display())
}

/// The core process: boots like the desktop app and prints `<port> <sign-in code>`.
fn run_core(scratch: &Path) {
    let home = scratch.join("home");
    std::fs::create_dir_all(&home).unwrap();
    // An empty startup file keeps zsh from offering its first-run setup menu.
    std::fs::write(home.join(".zshrc"), "").unwrap();
    std::env::set_var("HOME", &home);
    std::env::set_var("PERCH_SETTINGS", scratch.join("settings.json"));
    std::env::set_var("PERCHD_DIR", scratch.join("daemon"));
    std::env::set_var("PERCHD_IDLE_EXIT_SECS", "1");
    std::env::set_var("PERCH_CLEANUP_OWNER", cleanup_owner(scratch));
    std::env::remove_var("PERCH_LOCAL_TOKEN");
    // Records the owner so every runtime this core starts is released by name afterwards.
    perch_core::daemon::run_if_requested();

    let args = CliArgs {
        port: 0,
        headless: true,
        base_path: "/".into(),
        public_base_url: None,
        db_path: Some(scratch.join("history.sqlite")),
        hosts_path: Some(scratch.join("hosts.json")),
        providers_path: None, // defaults under the scratch HOME
        devices_path: Some(scratch.join("devices.json")),
    };
    let local_ui = perch_core::local_ui::LocalUi::in_process();
    let (ready_tx, ready_rx) = tokio::sync::oneshot::channel();
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    runtime.block_on(async {
        let boot = tokio::spawn(perch_core::boot::boot(
            args,
            scratch.join("web"),
            Some(ready_tx),
            local_ui.clone(),
        ));
        match ready_rx.await {
            Ok(address) => println!("{} {}", address.port(), local_ui.issue_login_code()),
            Err(_) => panic!("core exited while starting: {:?}", boot.await),
        }
        let _ = boot.await;
    });
}

fn scratch_dir() -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    // Canonical, so paths compare equal to what the core and the shell report (/var -> /private/var).
    let base = std::fs::canonicalize(std::env::temp_dir()).unwrap();
    let dir = base.join(format!("perch-native-test-{}-{nanos}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

const TIMEOUT: Duration = Duration::from_secs(20);

/// A shell that has already printed something, then the view attached to it.
fn view(core_process: &mut Child, scratch: &Path) {
    let (line_tx, line_rx) = std::sync::mpsc::channel();
    let stdout = core_process.stdout.take().unwrap();
    std::thread::spawn(move || {
        let mut line = String::new();
        let _ = BufReader::new(stdout).read_line(&mut line);
        let _ = line_tx.send(line);
    });
    let line = line_rx
        .recv_timeout(Duration::from_secs(30))
        .expect("the core did not start");
    let (port, code) = line.trim().split_once(' ').expect("the core's ready line");
    let base = format!("http://127.0.0.1:{port}/");

    let setup = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    let core = setup.block_on(Core::login(&base, code)).expect("sign in");
    let session_id = setup.block_on(async {
        let mut connection = core.connect().await.expect("connect");
        let session_id = connection.create_session(None, None).await.expect("create");
        let terminal = connection
            .open_terminal(&session_id, 80, 24)
            .await
            .expect("open terminal");
        connection
            .terminal_input(&terminal, "echo before-the-view\n")
            .await
            .unwrap();
        let mut screen = terminal.replay.clone();
        let wait = async {
            while !has_line(&screen, "before-the-view") {
                if let perch_core::protocol::ServerMessage::TerminalData { terminal_id, data } =
                    connection.next().await.expect("connection")
                {
                    if terminal_id == terminal.id {
                        screen.push_str(&data);
                    }
                }
            }
        };
        tokio::time::timeout(TIMEOUT, wait)
            .await
            .unwrap_or_else(|_| panic!("the shell never printed; it showed {screen:?}"));
        // Hand the shell over: this connection lets go of its leases so the view can hold them.
        connection.release_terminal(&terminal).await.unwrap();
        session_id
    });

    let mut h = Harness::open(core, &session_id, 900., 420.);

    // The screen the shell already had is repainted when the view attaches.
    h.wait("the printed line to be repainted", |h| {
        h.rows().iter().any(|row| row == "before-the-view")
    });
    assert_eq!(h.status(), Status::Live);
    assert!(h.can_type(), "the first view holds the input lease");
    let home = scratch.join("home").display().to_string();

    // Typing goes through the keyboard path and the shell's answer is drawn.
    h.type_text("printf '%s\\n' \"$HOME\"");
    h.wait("the shell's answer", |h| h.rows().contains(&home));
    h.type_text("echo typed-$((20+22))");
    h.wait("the arithmetic", |h| {
        h.rows().iter().any(|row| row == "typed-42")
    });

    // The pane's size is the shell's: resizing the window changes what `stty size` reports.
    let (cols, rows) = h.fitted().expect("laid out");
    assert_eq!(h.grid(), (cols, rows), "the shell was sized to the pane");
    h.resize(700., 300.);
    h.wait("a new fit", |h| h.fitted() != Some((cols, rows)));
    let (cols, rows) = h.fitted().unwrap();
    h.type_text("stty size");
    let want = format!("{rows} {cols}");
    h.wait("the shell to report the new size", |h| {
        h.rows().contains(&want)
    });
    assert_eq!(h.grid(), (cols, rows));

    // More output than the screen holds: the wheel reads it back from history.
    h.type_text("seq 1 300");
    h.wait("the sequence to finish", |h| {
        h.rows().iter().any(|row| row == "300")
    });
    for _ in 0..3 {
        h.wheel(20.);
    }
    let shown = h.rows();
    let numbers: Vec<u32> = shown.iter().filter_map(|row| row.parse().ok()).collect();
    assert!(
        !numbers.is_empty() && numbers.iter().all(|n| *n < 290),
        "scrolled back into history: {shown:?}"
    );
    // Typing returns to the live screen.
    h.type_text("echo back-at-the-bottom");
    h.wait("the live screen", |h| {
        h.rows().iter().any(|row| row == "back-at-the-bottom")
    });

    // Dropping the view lets go of the shell without ending it.
    h.close();
}

struct Harness {
    cx: HeadlessAppContext,
    window: WindowHandle<TerminalView>,
}

impl Harness {
    fn open(core: Core, session_id: &str, width: f32, height: f32) -> Self {
        let mut cx = HeadlessAppContext::with_platform(
            gpui_platform::current_platform(true).text_system(),
            Arc::new(()),
            gpui_platform::current_headless_renderer,
        );
        let open = OpenSession {
            host_id: "local".into(),
            session_id: session_id.into(),
            title: "shell".into(),
            provider_id: None,
            core_url: None,
        };
        let window = cx
            .open_window(size(px(width), px(height)), |_, cx| {
                cx.new(|cx| TerminalView::attach(core, &open, cx))
            })
            .unwrap();
        Self { cx, window }
    }

    /// Let the view and its worker thread run, and draw, until `done` holds.
    fn wait(&mut self, what: &str, done: impl Fn(&mut Self) -> bool) {
        let deadline = Instant::now() + TIMEOUT;
        loop {
            self.cx.run_until_parked();
            self.draw();
            if done(self) {
                return;
            }
            if Instant::now() > deadline {
                panic!(
                    "timed out waiting for {what}; the screen showed {:#?} ({:?})",
                    self.rows(),
                    self.status()
                );
            }
            std::thread::sleep(Duration::from_millis(25));
        }
    }

    fn draw(&mut self) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                let _ = window.draw(cx);
            })
            .unwrap();
    }

    fn view<R>(
        &mut self,
        f: impl FnOnce(&mut TerminalView, &mut gpui::Context<TerminalView>) -> R,
    ) -> R {
        self.window
            .update(&mut self.cx, |view, _, cx| f(view, cx))
            .unwrap()
    }

    /// The rows as drawn, trailing blanks dropped.
    fn rows(&mut self) -> Vec<String> {
        self.view(|v, _| {
            let frame = v.frame();
            (0..frame.rows.len()).map(|y| frame.row_text(y)).collect()
        })
    }

    fn status(&mut self) -> Status {
        self.view(|v, _| v.status().clone())
    }

    fn can_type(&mut self) -> bool {
        self.view(|v, _| v.can_type())
    }

    fn fitted(&mut self) -> Option<(u16, u16)> {
        self.view(|v, _| v.fitted_size())
    }

    fn grid(&mut self) -> (u16, u16) {
        self.view(|v, _| v.grid_size())
    }

    /// `text` and Enter, one key at a time, as the keyboard sends them.
    fn type_text(&mut self, text: &str) {
        for c in text.chars().chain(['\n']) {
            let key = if c == '\n' {
                Keystroke::parse("enter").unwrap()
            } else {
                let mut key = Keystroke::parse(&c.to_string()).unwrap_or_else(|_| {
                    // Keys GPUI's parser has no name for (space, punctuation) are typed as text.
                    Keystroke {
                        modifiers: Modifiers::default(),
                        key: c.to_string(),
                        key_char: None,
                    }
                });
                key.key_char = Some(c.to_string());
                key
            };
            let event = KeyDownEvent {
                keystroke: key,
                is_held: false,
                prefer_character_input: false,
            };
            assert!(
                self.view(|v, cx| v.key_down(&event, cx)),
                "the terminal took {c:?}"
            );
        }
    }

    fn wheel(&mut self, lines: f32) {
        let event = ScrollWheelEvent {
            position: point(px(100.), px(100.)),
            delta: ScrollDelta::Lines(point(0., lines)),
            modifiers: Modifiers::default(),
            touch_phase: TouchPhase::Moved,
        };
        self.view(|v, cx| v.scroll_wheel(&event, cx));
    }

    fn resize(&mut self, width: f32, height: f32) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.resize(size(px(width), px(height)));
                window.bounds_changed(cx);
            })
            .unwrap();
    }

    /// Drop the view and wait for the worker thread to let go of the terminal.
    fn close(self) {
        let Self { mut cx, window } = self;
        cx.update_window(window.into(), |_, window: &mut Window, _| {
            window.remove_window();
        })
        .unwrap();
        cx.run_until_parked();
        drop(cx);
    }
}

/// Whether some line of the terminal output is exactly `wanted`. The typed command echoes
/// back as `echo hi`, so a substring match would pass without the command ever running.
fn has_line(output: &str, wanted: &str) -> bool {
    strip_escapes(output)
        .split(['\r', '\n'])
        .any(|line| line.trim() == wanted)
}

/// Terminal output without CSI and OSC control sequences.
fn strip_escapes(output: &str) -> String {
    let mut plain = String::new();
    let mut chars = output.chars().peekable();
    while let Some(c) = chars.next() {
        if c != '\u{1b}' {
            plain.push(c);
            continue;
        }
        match chars.next() {
            Some('[') => {
                for c in chars.by_ref() {
                    if ('\u{40}'..='\u{7e}').contains(&c) {
                        break;
                    }
                }
            }
            Some(']') => {
                while let Some(c) = chars.next() {
                    if c == '\u{7}' || (c == '\u{1b}' && chars.next() == Some('\\')) {
                        break;
                    }
                }
            }
            _ => {}
        }
    }
    plain
}

fn pid_gone(pid: u32) -> bool {
    // SAFETY: signal 0 only probes whether the process exists.
    let missing = unsafe { libc::kill(pid as i32, 0) } != 0;
    missing && std::io::Error::last_os_error().raw_os_error() == Some(libc::ESRCH)
}

fn wait_until(what: &str, mut check: impl FnMut() -> bool) -> Result<(), String> {
    let deadline = Instant::now() + TIMEOUT;
    while !check() {
        if Instant::now() > deadline {
            return Err(format!("timed out waiting for {what}"));
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    Ok(())
}

/// This executable as the daemon's command line tool, aimed at the scratch daemon only.
fn daemon_tool(daemon_dir: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new(std::env::current_exe().unwrap())
        .arg("__perchd")
        .args(args)
        .arg("--dir")
        .arg(daemon_dir)
        .arg("--json")
        // `release` refuses the default daemon, which this variable would name.
        .env_remove("PERCHD_DIR")
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "{args:?}: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Kill the core and confirm by PID that it is gone.
fn stop_core(core: &mut Child) -> Result<(), String> {
    let pid = core.id();
    let _ = core.kill();
    core.wait().map_err(|e| e.to_string())?;
    wait_until(&format!("core {pid} to exit"), || pid_gone(pid))
}

/// Release and stop the shells this test's core started, then wait for the daemon to exit on
/// its own, checking every process by PID.
fn stop_runtimes(daemon_dir: &Path, owner: &str) -> Result<(), String> {
    if !daemon_dir.join("daemon-v1.pid").exists() {
        return Ok(());
    }
    let result = (|| {
        let sessions = |tool: &str| -> Result<Vec<SessionInfo>, String> {
            let text = daemon_tool(daemon_dir, &[tool])?;
            serde_json::from_str(&text).map_err(|e| format!("{tool}: {e}: {text}"))
        };
        let shells: Vec<u32> = sessions("ps")?.iter().filter_map(|s| s.pid).collect();
        daemon_tool(
            daemon_dir,
            &["release", "--owner", owner, "--reason", "test teardown"],
        )?;
        daemon_tool(daemon_dir, &["cleanup", "--yes"])?;
        for session in sessions("ps")? {
            if session.alive || !session.cleanup.group_stopped {
                return Err(format!("shell not confirmed stopped: {session:?}"));
            }
        }
        for pid in &shells {
            wait_until(&format!("shell {pid} to exit"), || pid_gone(*pid))?;
        }
        let pid: u32 = std::fs::read_to_string(daemon_dir.join("daemon-v1.pid"))
            .map_err(|e| e.to_string())?
            .trim()
            .parse()
            .map_err(|_| "daemon pid file is unreadable".to_string())?;
        // With no live shell the daemon exits by itself after its idle second.
        wait_until(&format!("daemon {pid} to exit"), || pid_gone(pid))
    })();
    unload_daemon_job(daemon_dir);
    result
}

#[cfg(not(target_os = "macos"))]
fn unload_daemon_job(_: &Path) {}

/// On macOS the daemon runs as a launchd job named in a plist inside its directory. Unload
/// this test's job; it is the only one whose plist is there.
#[cfg(target_os = "macos")]
fn unload_daemon_job(daemon_dir: &Path) {
    let Ok(entries) = std::fs::read_dir(daemon_dir) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if let Some(label) = name
            .strip_suffix(".plist")
            .filter(|l| l.starts_with(perch_core::daemon_host::JOB_PREFIX))
        {
            // SAFETY: getuid cannot fail.
            let target = format!("gui/{}/{label}", unsafe { libc::getuid() });
            let _ = Command::new("/bin/launchctl")
                .args(["bootout", &target])
                .output();
        }
    }
}

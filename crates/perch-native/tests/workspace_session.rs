//! The window against a real perch-core: a shell in a tab, a second shell split beside it, typing
//! that reaches only the pane with the keyboard, the size each pane gives its own shell, and the
//! terminal settings changed through the core.
//!
//! The core runs as a child of this test, as in `terminal_view`: the same executable re-run as
//! `__core <scratch>`, with everything it touches (database, hosts, settings, the terminal
//! daemon, `HOME`) private to the scratch directory. Plain shells only; no agent runs. GPUI draws
//! offscreen: no window is created, shown or focused, and every key goes through the window's own
//! key path with `dispatch_keystroke`. The core, the shells and the daemon are stopped and checked
//! gone by PID before the test returns.

use futures::channel::mpsc::{UnboundedReceiver, UnboundedSender};
use gpui::{
    px, size, AppContext, Entity, HeadlessAppContext, Keystroke, Modifiers, Window, WindowHandle,
};
use perch_core::server::CliArgs;
use perch_native::client::{follow, Command as Order, Core, Update};
use perch_native::settings::Change;
use perch_native::sidebar::Attention;
use perch_native::terminal::{Status, TerminalView};
use perch_native::ui::Workspace;
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
        window(&mut core, &scratch);
    }));
    // The shell must not be released while a core is still attached to it, so stop the core first.
    let stopped = stop_core(&mut core).and_then(|()| stop_runtimes(&daemon_dir, &owner));
    match (outcome, stopped) {
        (Ok(()), Ok(())) => {
            let _ = std::fs::remove_dir_all(&scratch);
            println!("workspace_session: ok");
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
/// Wide enough that two panes each hold a normal terminal.
const WIDTH: f32 = 2000.;
const HEIGHT: f32 = 700.;

fn window(core_process: &mut Child, scratch: &Path) {
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

    // The core reads `keys.json` beside its database when a client asks for the mods state.
    std::fs::write(
        scratch.join("keys.json"),
        r#"{"terminal": {"cmd-shift-y": "send:echo from-keys-$((6*7))"}}"#,
    )
    .unwrap();

    // The follower runs on this runtime's threads; the window is driven from this one.
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    let core = runtime.block_on(Core::login(&base, code)).expect("sign in");
    let first = runtime.block_on(async {
        let mut connection = core.connect().await.expect("connect");
        let session_id = connection.create_session(None, None).await.expect("create");
        let terminal = connection
            .open_terminal(&session_id, 80, 24)
            .await
            .expect("open terminal");
        // The session is listed once its terminal is open; the window's view takes the leases.
        connection.release_terminal(&terminal).await.unwrap();
        session_id
    });

    let (commands, command_rx) = futures::channel::mpsc::unbounded();
    let (update_tx, updates) = futures::channel::mpsc::unbounded();
    let followed = core.clone();
    let follower = runtime.spawn(follow(
        move || Ok(followed.clone()),
        command_rx,
        update_tx,
        Duration::from_millis(100),
    ));
    let mut h = Harness::new(core, commands, updates);

    // The terminal settings come from the core, and a change goes through the core's settings
    // route: it is saved, and the follower learns the new value from the core's broadcast.
    h.wait("the terminal settings", |h| h.settings().is_some());
    let before = h.settings().unwrap();
    let scrollback = if before.scrollback == 4321 {
        4322
    } else {
        4321
    };
    h.send(Order::UpdateSettings(
        Change::Scrollback(scrollback).patch(),
    ));
    h.send(Order::UpdateSettings(
        Change::DroppedPathDoubleQuotes(!before.dropped_path_double_quotes).patch(),
    ));
    h.wait("the changed settings", |h| {
        h.settings().is_some_and(|s| {
            s.scrollback == scrollback
                && s.dropped_path_double_quotes == !before.dropped_path_double_quotes
        })
    });
    let after = h.settings().unwrap();
    assert_eq!(after.login_shell, before.login_shell, "only what changed");
    let saved: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(scratch.join("settings.json")).expect("the core saved settings"),
    )
    .unwrap();
    assert_eq!(saved["terminalScrollback"], scrollback);

    // The first shell in a tab, filling the main area.
    h.wait("the session to be listed", |h| {
        h.attention(&first).is_some()
    });
    h.show_tab(&first);
    h.wait("the first shell", |h| h.ready(&first));
    let single = h.fitted(&first);
    h.type_text("echo ready-$((40+2))");
    h.wait("the first shell to answer", |h| {
        h.has_row(&first, "ready-42")
    });

    // A `send:` key in keys.json, which the core served, is typed into the focused shell through
    // its text input; Enter is the person's.
    h.wait("keys.json", |h| {
        h.ws(|ws, cx| ws.sidebar().read(cx).model().keys_file.is_some())
    });
    assert!(h.press("cmd-shift-y"), "the send key is taken");
    assert!(!h.has_row(&first, "from-keys-42"), "typed, not yet run");
    assert!(h.press("enter"));
    h.wait("the sent text to run", |h| {
        h.has_row(&first, "from-keys-42")
    });

    // Splitting right starts a second shell through the core and shows it beside the first.
    assert!(h.press("cmd-d"), "panes.splitRight is taken");
    h.wait("the split", |h| h.shown().len() == 2);
    let second = h.shown()[1].clone();
    assert_eq!(h.shown()[0], first);
    assert_ne!(second, first);
    assert_eq!(
        h.active().as_deref(),
        Some(second.as_str()),
        "the new pane has the keyboard"
    );
    h.wait("both panes", |h| h.ready(&first) && h.ready(&second));

    // Each pane gives its shell its own area: narrower than the whole, and not more than that.
    let (first_size, second_size) = (h.fitted(&first), h.fitted(&second));
    for (name, fit) in [("first", first_size), ("second", second_size)] {
        assert!(
            fit.0 < single.0,
            "{name} pane {fit:?} is narrower than the whole {single:?}"
        );
        assert!(fit.0 > 40, "{name} pane {fit:?} still holds a terminal");
        assert_eq!(fit.1, single.1, "{name} pane keeps the height");
    }
    h.wait("the shells to be sized to their panes", |h| {
        h.grid(&first) == first_size && h.grid(&second) == second_size
    });

    // Typing reaches only the pane with the keyboard.
    h.type_text("echo only-bravo-$((1+1))");
    h.wait("the second shell to answer", |h| {
        h.has_row(&second, "only-bravo-2")
    });
    h.settle();
    assert!(
        !h.rows(&first).iter().any(|r| r.contains("only-bravo")),
        "the first pane never saw it: {:?}",
        h.rows(&first)
    );
    assert!(h.press("cmd-alt-left"));
    h.wait("the keyboard to move", |h| {
        h.active().as_deref() == Some(first.as_str())
    });
    h.type_text("echo only-alpha-$((2+1))");
    h.wait("the first shell to answer", |h| {
        h.has_row(&first, "only-alpha-3")
    });
    h.settle();
    assert!(
        !h.rows(&second).iter().any(|r| r.contains("only-alpha")),
        "the second pane never saw it: {:?}",
        h.rows(&second)
    );

    // Each shell reports the size of its own pane.
    h.type_text("stty size");
    let want = format!("{} {}", first_size.1, first_size.0);
    h.wait("the first shell's size", |h| h.has_row(&first, &want));
    assert!(h.press("cmd-alt-right"));
    h.wait("the keyboard to move", |h| {
        h.active().as_deref() == Some(second.as_str())
    });
    h.type_text("stty size");
    let want = format!("{} {}", second_size.1, second_size.0);
    h.wait("the second shell's size", |h| h.has_row(&second, &want));

    // Closing a plain shell's tab ends its session; the other pane takes the whole area and its
    // shell is told.
    assert!(h.press("cmd-alt-left"));
    h.wait("the keyboard to move", |h| {
        h.active().as_deref() == Some(first.as_str())
    });
    assert!(h.press("cmd-w"));
    h.wait("the tab to close", |h| h.shown() == [second.clone()]);
    h.wait("the session to end", |h| h.attention(&first).is_none());
    h.wait("the remaining pane to refit", |h| {
        h.ready(&second) && h.fitted(&second) == single && h.grid(&second) == single
    });
    h.type_text("stty size");
    let want = format!("{} {}", single.1, single.0);
    h.wait("the remaining shell's size", |h| h.has_row(&second, &want));

    h.close();
    follower.abort();
    drop(runtime);
}

struct Harness {
    cx: HeadlessAppContext,
    window: WindowHandle<Workspace>,
    commands: UnboundedSender<Order>,
    updates: UnboundedReceiver<Update>,
}

impl Harness {
    fn new(
        core: Core,
        commands: UnboundedSender<Order>,
        updates: UnboundedReceiver<Update>,
    ) -> Self {
        let mut cx = HeadlessAppContext::with_platform(
            gpui_platform::current_platform(true).text_system(),
            Arc::new(()),
            gpui_platform::current_headless_renderer,
        );
        let sender = commands.clone();
        let window = cx
            .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
                cx.new(|cx| {
                    Workspace::new(Default::default(), Some(sender), cx)
                        .with_core(move || Ok(core.clone()))
                })
            })
            .unwrap();
        Self {
            cx,
            window,
            commands,
            updates,
        }
    }

    fn send(&self, order: Order) {
        self.commands.unbounded_send(order).unwrap();
    }

    /// Hand what the follower learned to the window, as the app does.
    fn pump(&mut self) {
        while let Ok(update) = self.updates.try_recv() {
            self.window
                .update(&mut self.cx, |ws, _, cx| {
                    ws.sidebar()
                        .update(cx, |sidebar, cx| sidebar.apply(update, cx))
                })
                .unwrap();
        }
    }

    /// Let the window, the follower and the terminals run, and draw, until `done` holds.
    fn wait(&mut self, what: &str, done: impl Fn(&mut Self) -> bool) {
        let deadline = Instant::now() + TIMEOUT;
        loop {
            self.pump();
            self.cx.run_until_parked();
            self.draw();
            if done(self) {
                return;
            }
            if Instant::now() > deadline {
                let shown = self.shown();
                let screens: Vec<_> = shown.iter().map(|id| (id.clone(), self.rows(id))).collect();
                panic!("timed out waiting for {what}; on screen {screens:#?}");
            }
            std::thread::sleep(Duration::from_millis(25));
        }
    }

    /// Keep running a moment, for what must not happen.
    fn settle(&mut self) {
        let until = Instant::now() + Duration::from_millis(400);
        while Instant::now() < until {
            self.pump();
            self.cx.run_until_parked();
            self.draw();
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

    fn ws<R>(&mut self, f: impl FnOnce(&Workspace, &gpui::App) -> R) -> R {
        self.window
            .update(&mut self.cx, |ws, _, cx| f(ws, cx))
            .unwrap()
    }

    fn settings(&mut self) -> Option<perch_native::settings::TerminalSettings> {
        self.ws(|ws, cx| ws.sidebar().read(cx).model().terminal.clone())
    }

    fn attention(&mut self, id: &str) -> Option<Attention> {
        self.ws(|ws, cx| {
            ws.sidebar()
                .read(cx)
                .find_session(id)
                .and_then(|s| s.attention)
        })
    }

    fn show_tab(&mut self, id: &str) {
        let id = id.to_string();
        self.window
            .update(&mut self.cx, |ws, _, cx| {
                ws.sidebar().update(cx, |sidebar, cx| {
                    sidebar.open("local".into(), id, Some("terminal".into()), cx)
                })
            })
            .unwrap();
    }

    fn shown(&mut self) -> Vec<String> {
        self.ws(|ws, _| ws.tabs().shown())
    }

    fn active(&mut self) -> Option<String> {
        self.ws(|ws, _| ws.tabs().active().map(str::to_string))
    }

    fn pane(&mut self, id: &str) -> Option<Entity<TerminalView>> {
        self.ws(|ws, _| {
            ws.terminals()
                .into_iter()
                .find(|(i, _)| i == id)
                .map(|(_, v)| v)
        })
    }

    fn view<R>(&mut self, id: &str, f: impl FnOnce(&mut TerminalView) -> R) -> Option<R> {
        let view = self.pane(id)?;
        Some(
            self.window
                .update(&mut self.cx, |_, _, cx| view.update(cx, |v, _| f(v)))
                .unwrap(),
        )
    }

    /// Attached, holding the keyboard of its shell, and laid out.
    fn ready(&mut self, id: &str) -> bool {
        self.view(id, |v| {
            *v.status() == Status::Live && v.can_type() && v.fitted_size().is_some()
        })
        .unwrap_or(false)
    }

    fn fitted(&mut self, id: &str) -> (u16, u16) {
        self.view(id, |v| v.fitted_size())
            .flatten()
            .expect("a laid out pane")
    }

    fn grid(&mut self, id: &str) -> (u16, u16) {
        self.view(id, |v| v.grid_size()).expect("a pane")
    }

    /// The rows as drawn, trailing blanks dropped.
    fn rows(&mut self, id: &str) -> Vec<String> {
        self.view(id, |v| {
            let frame = v.frame();
            (0..frame.rows.len()).map(|y| frame.row_text(y)).collect()
        })
        .unwrap_or_default()
    }

    fn has_row(&mut self, id: &str, wanted: &str) -> bool {
        self.rows(id).iter().any(|row| row == wanted)
    }

    /// A key through the window's own path. True when the window took it.
    fn press(&mut self, spec: &str) -> bool {
        self.key(Keystroke::parse(spec).unwrap())
    }

    fn key(&mut self, keystroke: Keystroke) -> bool {
        let taken = self
            .cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_keystroke(keystroke, cx)
            })
            .unwrap();
        self.cx.run_until_parked();
        taken
    }

    /// `text` and Enter, one key at a time, as the keyboard sends them.
    fn type_text(&mut self, text: &str) {
        for c in text.chars() {
            let key = Keystroke {
                modifiers: Modifiers::default(),
                key: c.to_string(),
                key_char: Some(c.to_string()),
            };
            assert!(self.key(key), "the window took {c:?}");
        }
        assert!(self.press("enter"), "the window took Enter");
    }

    /// Drop the window and with it the views, which let go of their shells without ending them.
    fn close(self) {
        let Self { mut cx, window, .. } = self;
        cx.update_window(window.into(), |_, window: &mut Window, _| {
            window.remove_window();
        })
        .unwrap();
        cx.run_until_parked();
        drop(cx);
    }
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

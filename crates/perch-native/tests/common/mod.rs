//! What the tests that run the window against a real perch-core share: the core as a child
//! process of the test, its scratch directory, the harness that drives the window offscreen, and
//! the teardown that stops every process by PID.
//!
//! The core is the same executable re-run as `__core <scratch>`, with everything it touches
//! (database, hosts, settings, the terminal daemon, `HOME`) private to the scratch directory.
//! Plain shells only; no agent runs. GPUI draws offscreen: no window is created, shown or
//! focused, and every key goes through the window's own key path with `dispatch_keystroke`.

#![allow(dead_code)]

use futures::channel::mpsc::{UnboundedReceiver, UnboundedSender};
use gpui::{
    px, size, AppContext, Entity, HeadlessAppContext, Keystroke, Modifiers, Window, WindowHandle,
};
use perch_core::server::CliArgs;
use perch_native::client::{Command as Order, Core, Update};
use perch_native::sidebar::Attention;
use perch_native::terminal::clipboard::MemoryClipboard;
use perch_native::terminal::{Status, TerminalView};
use perch_native::ui::Workspace;
use perchd::proto::SessionInfo;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::rc::Rc;
use std::sync::Arc;
use std::time::{Duration, Instant};

pub const TIMEOUT: Duration = Duration::from_secs(20);

pub fn cleanup_owner(scratch: &Path) -> String {
    format!("native-test:{}", scratch.display())
}

/// A core running as a child of the test, in a scratch directory of its own.
pub struct Rig {
    pub scratch: PathBuf,
    pub daemon_dir: PathBuf,
    owner: String,
    core: Option<Child>,
}

impl Rig {
    /// Start the core and sign in to it. Returns its address and a signed-in [`Core`].
    pub fn start_core(&mut self, runtime: &tokio::runtime::Runtime) -> (String, Core) {
        let mut child = Command::new(std::env::current_exe().unwrap())
            .arg("__core")
            .arg(&self.scratch)
            .stdout(Stdio::piped())
            .spawn()
            .expect("start the core");
        let (line_tx, line_rx) = std::sync::mpsc::channel();
        let stdout = child.stdout.take().unwrap();
        std::thread::spawn(move || {
            let mut line = String::new();
            let _ = BufReader::new(stdout).read_line(&mut line);
            let _ = line_tx.send(line);
        });
        self.core = Some(child);
        let line = line_rx
            .recv_timeout(Duration::from_secs(30))
            .expect("the core did not start");
        let (port, code) = line.trim().split_once(' ').expect("the core's ready line");
        let base = format!("http://127.0.0.1:{port}/");
        let core = runtime.block_on(Core::login(&base, code)).expect("sign in");
        (base, core)
    }

    /// The core's process id, while it runs.
    pub fn core_pid(&self) -> Option<u32> {
        self.core.as_ref().map(Child::id)
    }

    /// Kill the core and confirm by PID that it is gone. Its shells keep running in the daemon.
    pub fn stop_core(&mut self) -> Result<(), String> {
        match self.core.take() {
            Some(mut core) => stop_core(&mut core),
            None => Ok(()),
        }
    }
}

/// Run `scenario` against a core in a scratch directory, then stop the core, release and stop
/// every shell and the daemon, and check each process gone by PID. `name` is printed on success.
pub fn run(name: &str, scenario: impl FnOnce(&mut Rig)) {
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
    let mut rig = Rig {
        scratch: scratch.clone(),
        daemon_dir: daemon_dir.clone(),
        owner: owner.clone(),
        core: None,
    };
    let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| scenario(&mut rig)));
    // The shell must not be released while a core is still attached to it, so stop the core first.
    let stopped = rig
        .stop_core()
        .and_then(|()| stop_runtimes(&daemon_dir, &owner));
    match (outcome, stopped) {
        (Ok(()), Ok(())) => {
            let _ = std::fs::remove_dir_all(&scratch);
            println!("{name}: ok");
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

/// The core process: boots like the desktop app and prints `<port> <sign-in code>`.
pub fn run_core(scratch: &Path) {
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

/// Wide enough that two panes each hold a normal terminal.
pub const WIDTH: f32 = 2000.;
pub const HEIGHT: f32 = 700.;

pub struct Harness {
    pub cx: HeadlessAppContext,
    pub window: WindowHandle<Workspace>,
    pub commands: UnboundedSender<Order>,
    pub updates: UnboundedReceiver<Update>,
    pub clipboard: Rc<MemoryClipboard>,
}

impl Harness {
    pub fn new(
        core: Core,
        commands: UnboundedSender<Order>,
        updates: UnboundedReceiver<Update>,
    ) -> Self {
        Self::locating(move || Ok(core.clone()), commands, updates)
    }

    /// A window that finds the core to attach each terminal to by calling `locate`, as the app
    /// does after a core restart.
    pub fn locating(
        locate: impl Fn() -> anyhow::Result<Core> + 'static,
        commands: UnboundedSender<Order>,
        updates: UnboundedReceiver<Update>,
    ) -> Self {
        let mut cx = HeadlessAppContext::with_platform(
            gpui_platform::current_platform(true).text_system(),
            Arc::new(()),
            gpui_platform::current_headless_renderer,
        );
        let sender = commands.clone();
        // The window copies and pastes through this, never the system's clipboard.
        let clipboard = Rc::new(MemoryClipboard::default());
        let held = clipboard.clone();
        let window = cx
            .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
                cx.new(|cx| {
                    Workspace::new(Default::default(), Some(sender), cx)
                        .with_core(locate)
                        .with_clipboard(held)
                })
            })
            .unwrap();
        Self {
            cx,
            window,
            commands,
            updates,
            clipboard,
        }
    }

    pub fn send(&self, order: Order) {
        self.commands.unbounded_send(order).unwrap();
    }

    /// Hand what the follower learned to the window, as the app does.
    pub fn pump(&mut self) {
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
    pub fn wait(&mut self, what: &str, mut done: impl FnMut(&mut Self) -> bool) {
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
            // The executor's clock is the test's own: let it follow the real one.
            self.cx.advance_clock(Duration::from_millis(25));
            std::thread::sleep(Duration::from_millis(25));
        }
    }

    /// Keep running a moment, for what must not happen.
    pub fn settle(&mut self) {
        let until = Instant::now() + Duration::from_millis(400);
        while Instant::now() < until {
            self.pump();
            self.cx.run_until_parked();
            self.draw();
            self.cx.advance_clock(Duration::from_millis(25));
            std::thread::sleep(Duration::from_millis(25));
        }
    }

    pub fn draw(&mut self) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                let _ = window.draw(cx);
            })
            .unwrap();
    }

    pub fn ws<R>(&mut self, f: impl FnOnce(&Workspace, &gpui::App) -> R) -> R {
        self.window
            .update(&mut self.cx, |ws, _, cx| f(ws, cx))
            .unwrap()
    }

    pub fn settings(&mut self) -> Option<perch_native::settings::TerminalSettings> {
        self.ws(|ws, cx| ws.sidebar().read(cx).model().terminal.clone())
    }

    pub fn attention(&mut self, id: &str) -> Option<Attention> {
        self.ws(|ws, cx| {
            ws.sidebar()
                .read(cx)
                .find_session(id)
                .and_then(|s| s.attention)
        })
    }

    pub fn show_tab(&mut self, id: &str) {
        let id = id.to_string();
        self.window
            .update(&mut self.cx, |ws, _, cx| {
                ws.sidebar().update(cx, |sidebar, cx| {
                    sidebar.open("local".into(), id, Some("terminal".into()), cx)
                })
            })
            .unwrap();
    }

    pub fn shown(&mut self) -> Vec<String> {
        self.ws(|ws, _| ws.tabs().shown())
    }

    pub fn active(&mut self) -> Option<String> {
        self.ws(|ws, _| ws.tabs().active().map(str::to_string))
    }

    /// The terminal of an open tab, on screen or kept.
    pub fn pane(&mut self, id: &str) -> Option<Entity<TerminalView>> {
        self.ws(|ws, _| ws.view(id).cloned())
    }

    pub fn view<R>(&mut self, id: &str, f: impl FnOnce(&mut TerminalView) -> R) -> Option<R> {
        let view = self.pane(id)?;
        Some(
            self.window
                .update(&mut self.cx, |_, _, cx| view.update(cx, |v, _| f(v)))
                .unwrap(),
        )
    }

    /// [`Self::view`] with the view's context, for what needs one.
    pub fn view_cx<R>(
        &mut self,
        id: &str,
        f: impl FnOnce(&mut TerminalView, &mut gpui::Context<TerminalView>) -> R,
    ) -> Option<R> {
        let view = self.pane(id)?;
        Some(
            self.window
                .update(&mut self.cx, |_, _, cx| view.update(cx, f))
                .unwrap(),
        )
    }

    /// Attached, holding the keyboard of its shell, and laid out.
    pub fn ready(&mut self, id: &str) -> bool {
        self.view(id, |v| {
            *v.status() == Status::Live && v.can_type() && v.fitted_size().is_some()
        })
        .unwrap_or(false)
    }

    pub fn fitted(&mut self, id: &str) -> (u16, u16) {
        self.view(id, |v| v.fitted_size())
            .flatten()
            .expect("a laid out pane")
    }

    pub fn grid(&mut self, id: &str) -> (u16, u16) {
        self.view(id, |v| v.grid_size()).expect("a pane")
    }

    /// The rows as drawn, trailing blanks dropped.
    pub fn rows(&mut self, id: &str) -> Vec<String> {
        self.view(id, |v| {
            let frame = v.frame();
            (0..frame.rows.len()).map(|y| frame.row_text(y)).collect()
        })
        .unwrap_or_default()
    }

    pub fn has_row(&mut self, id: &str, wanted: &str) -> bool {
        self.rows(id).iter().any(|row| row == wanted)
    }

    /// A key through the window's own path. True when the window took it.
    pub fn press(&mut self, spec: &str) -> bool {
        self.key(Keystroke::parse(spec).unwrap())
    }

    pub fn key(&mut self, keystroke: Keystroke) -> bool {
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
    pub fn type_text(&mut self, text: &str) {
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
    pub fn close(self) {
        let Self { mut cx, window, .. } = self;
        cx.update_window(window.into(), |_, window: &mut Window, _| {
            window.remove_window();
        })
        .unwrap();
        cx.run_until_parked();
        drop(cx);
    }
}

pub fn pid_gone(pid: u32) -> bool {
    // SAFETY: signal 0 only probes whether the process exists.
    let missing = unsafe { libc::kill(pid as i32, 0) } != 0;
    missing && std::io::Error::last_os_error().raw_os_error() == Some(libc::ESRCH)
}

pub fn wait_until(what: &str, mut check: impl FnMut() -> bool) -> Result<(), String> {
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
pub fn daemon_tool(daemon_dir: &Path, args: &[&str]) -> Result<String, String> {
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
pub fn stop_core(core: &mut Child) -> Result<(), String> {
    let pid = core.id();
    let _ = core.kill();
    core.wait().map_err(|e| e.to_string())?;
    wait_until(&format!("core {pid} to exit"), || pid_gone(pid))
}

/// Release and stop the shells this test's core started, then wait for the daemon to exit on
/// its own, checking every process by PID.
pub fn stop_runtimes(daemon_dir: &Path, owner: &str) -> Result<(), String> {
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

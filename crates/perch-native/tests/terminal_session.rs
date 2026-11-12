//! Signs in to a real perch-core, types into a shell it runs, and checks the sidebar's follower
//! sees the sessions come and change live and can start one.
//!
//! The core runs as a child of this test: the same executable re-run as `__core <scratch>`,
//! booted in-process like the desktop app, so a sign-in code is the only way in. Everything it
//! touches is private to the scratch directory: database, hosts, devices, settings, the
//! terminal daemon and `HOME`. This is its own binary with a custom `main` because the core
//! starts its daemon by re-running the executable with `__perchd`, which `run_if_requested`
//! must answer first. The core, the shell and the daemon are stopped and checked gone by PID
//! before the test returns.

use futures::StreamExt;
use perch_core::server::CliArgs;
use perch_native::client::{follow, Command as Order, Core, Update};
use perch_native::sidebar::{Attention, Model, SessionView, LOCAL};
use perchd::proto::SessionInfo;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
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
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        runtime.block_on(session(&mut core, &scratch));
    }));
    // The shell must not be released while a core is still attached to it, so stop the core first.
    let stopped = stop_core(&mut core).and_then(|()| stop_runtimes(&daemon_dir, &owner));
    match (outcome, stopped) {
        (Ok(()), Ok(())) => {
            let _ = std::fs::remove_dir_all(&scratch);
            println!("terminal_session: ok");
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
    // Same as the desktop app: the credential stays in memory and a sign-in code opens it.
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

async fn session(core_process: &mut Child, scratch: &Path) {
    let home = scratch.join("home");
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

    let core = Core::login(&base, code).await.expect("sign in");
    assert!(
        Core::login(&base, code).await.is_err(),
        "a sign-in code works once"
    );
    assert!(Core::login(&base, "0000").await.is_err());

    let mut connection = core.connect().await.expect("connect");
    let session_id = connection.create_session(None, None).await.expect("create");
    let terminal = connection
        .open_terminal(&session_id, 80, 24)
        .await
        .expect("open terminal");
    // A session is listed once its terminal is open.
    let snapshot = connection.snapshot().await.expect("snapshot");
    let session = snapshot
        .sessions
        .iter()
        .find(|s| s.id == session_id)
        .expect("the new session is listed");
    assert!(
        Path::new(&session.cwd).starts_with(&home),
        "session cwd {} should be under {}",
        session.cwd,
        home.display()
    );
    assert!(
        snapshot
            .projects
            .iter()
            .any(|p| Some(&p.id) == session.project_id.as_ref()),
        "the session's project is listed"
    );

    // The sidebar's follower is a second connection: what it learns arrives as broadcasts.
    let mut watch = Watch::follow(core.clone());
    watch
        .model_where(|m| m.connected && m.hosts[0].projects.is_empty())
        .await;

    // The session the shell opened appears in the sidebar, live, with the state the core reports.
    let model = watch
        .model_where(|m| sessions_of(m).iter().any(|s| s.id == session_id))
        .await;
    let row = sessions_of(&model)
        .into_iter()
        .find(|s| s.id == session_id)
        .unwrap();
    assert_eq!(row.attention, Some(Attention::Idle));
    assert!(model.hosts[0].projects[0].quickchat);
    assert!(
        model.hosts[0].providers.iter().any(|p| p.id == "terminal"),
        "the core lists the terminal as something to start"
    );

    let mut screen = terminal.replay.clone();
    // Typed ahead of the prompt: the pty keeps it until the shell reads.
    connection
        .terminal_input(&terminal, "echo hi\n")
        .await
        .unwrap();
    read_until(&mut connection, &terminal.id, &mut screen, |text| {
        has_line(text, "hi")
    })
    .await;

    // The shell itself runs under the scratch HOME, not only the core.
    connection
        .terminal_input(&terminal, "printf '%s\\n' \"$HOME\"\n")
        .await
        .unwrap();
    let home_line = home.display().to_string();
    read_until(&mut connection, &terminal.id, &mut screen, |text| {
        has_line(text, &home_line)
    })
    .await;

    connection
        .terminal_resize(&terminal, 100, 30)
        .await
        .unwrap();
    connection
        .terminal_input(&terminal, "stty size\n")
        .await
        .unwrap();
    read_until(&mut connection, &terminal.id, &mut screen, |text| {
        has_line(text, "30 100")
    })
    .await;

    // A command running in the shell is a state change the sidebar follows.
    connection
        .terminal_input(&terminal, "sleep 2; echo slept-$((1+1))\n")
        .await
        .unwrap();
    watch
        .model_where(|m| {
            sessions_of(m)
                .iter()
                .any(|s| s.id == session_id && s.attention == Some(Attention::Working))
        })
        .await;

    // Let it finish: teardown refuses a shell that still has a job running.
    read_until(&mut connection, &terminal.id, &mut screen, |text| {
        has_line(text, "slept-2")
    })
    .await;

    // Starting a session from the sidebar: the core makes it, and it shows up live.
    watch.launch(LOCAL, None, "terminal");
    let launched = watch.launched().await;
    watch
        .model_where(|m| sessions_of(m).iter().any(|s| s.id == launched))
        .await;
    assert_ne!(launched, session_id);

    // A folder the core was not given is refused at once, and nothing is created.
    watch.launch(LOCAL, Some("/not/a/project"), "terminal");
    let refused = watch.launch_error().await;
    assert!(refused.contains("not a project"), "{refused}");
    watch.task.abort();
}

/// The sidebar's follower, as the window runs it.
struct Watch {
    commands: futures::channel::mpsc::UnboundedSender<Order>,
    updates: futures::channel::mpsc::UnboundedReceiver<Update>,
    latest: Model,
    launched: std::collections::VecDeque<Result<String, String>>,
    task: tokio::task::JoinHandle<()>,
}

impl Watch {
    fn follow(core: Core) -> Self {
        let (commands, command_rx) = futures::channel::mpsc::unbounded();
        let (update_tx, updates) = futures::channel::mpsc::unbounded();
        let task = tokio::spawn(follow(
            move || Ok(core.clone()),
            command_rx,
            update_tx,
            Duration::from_millis(100),
        ));
        Self {
            commands,
            updates,
            latest: Model::default(),
            launched: Default::default(),
            task,
        }
    }

    fn launch(&self, host_id: &str, cwd: Option<&str>, provider: &str) {
        self.commands
            .unbounded_send(Order::Launch {
                host_id: host_id.into(),
                cwd: cwd.map(Into::into),
                provider: provider.into(),
            })
            .unwrap();
    }

    /// The next update, folded into what is known.
    async fn step(&mut self) {
        match self.updates.next().await.expect("the follower ended") {
            Update::Model(model) => self.latest = model,
            Update::Launched { session_id, .. } => self.launched.push_back(Ok(session_id)),
            Update::LaunchFailed(error) => self.launched.push_back(Err(error)),
        }
    }

    async fn model_where(&mut self, want: impl Fn(&Model) -> bool) -> Model {
        let wait = async {
            while !want(&self.latest) {
                self.step().await;
            }
        };
        if tokio::time::timeout(Duration::from_secs(20), wait)
            .await
            .is_err()
        {
            panic!("no matching sidebar; it showed {:?}", self.latest);
        }
        self.latest.clone()
    }

    async fn launch_result(&mut self) -> Result<String, String> {
        let wait = async {
            while self.launched.is_empty() {
                self.step().await;
            }
        };
        tokio::time::timeout(Duration::from_secs(20), wait)
            .await
            .expect("the launch was never answered");
        self.launched.pop_front().unwrap()
    }

    async fn launched(&mut self) -> String {
        self.launch_result().await.expect("the launch failed")
    }

    async fn launch_error(&mut self) -> String {
        self.launch_result().await.expect_err("the launch worked")
    }
}

fn sessions_of(model: &Model) -> Vec<SessionView> {
    model.hosts[0]
        .projects
        .iter()
        .flat_map(|p| p.sessions.clone())
        .collect()
}

/// Append this terminal's output to `screen` until `done` holds for what it shows.
async fn read_until(
    connection: &mut perch_native::client::Connection,
    terminal_id: &str,
    screen: &mut String,
    done: impl Fn(&str) -> bool,
) {
    let wait = async {
        while !done(screen) {
            if let perch_core::protocol::ServerMessage::TerminalData {
                terminal_id: id,
                data,
            } = connection.next().await.expect("connection")
            {
                if id == terminal_id {
                    screen.push_str(&data);
                }
            }
        }
    };
    if tokio::time::timeout(Duration::from_secs(20), wait)
        .await
        .is_err()
    {
        panic!("timed out; terminal showed {:?}", strip_escapes(screen));
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
    let deadline = Instant::now() + Duration::from_secs(20);
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

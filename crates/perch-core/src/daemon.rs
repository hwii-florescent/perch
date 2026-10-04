//! The runtime's handle on perchd, the terminal daemon (`crates/perchd`).
//!
//! Every persistent terminal (agent CLIs, workspace shells) lives in the
//! daemon, keyed by its stable perch key, so it survives this process exiting.
//! One shared client multiplexes them; it reconnects (starting the daemon if
//! needed) the next time it is asked for after the connection drops.

use perchd::client::Client;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

static CLIENT: Mutex<Option<Client>> = Mutex::new(None);

/// If this process was started as the daemon (`<exe> __perchd serve …`, see
/// [`connect`]), run it and exit. Call first thing in `main`, before any async
/// runtime or window exists.
pub fn run_if_requested() {
    perchd::raise_fd_limit(); // for the core and the daemon alike
    let mut args = std::env::args();
    let _exe = args.next();
    if args.next().as_deref() != Some("__perchd") {
        return;
    }
    let rest: Vec<String> = args.collect();
    let exe = std::env::current_exe()
        .map(|p| p.display().to_string())
        .unwrap_or_default();
    std::process::exit(perchd::cli_main(&rest, vec![exe, "__perchd".into()]));
}

pub fn dir() -> PathBuf {
    #[cfg(test)]
    {
        std::env::temp_dir().join(format!("perch-core-test-{}", std::process::id()))
    }
    #[cfg(not(test))]
    {
        perchd::server::default_dir()
    }
}

/// The shared client, connecting (and starting the daemon) on first use or
/// after the previous connection was lost.
pub fn client() -> anyhow::Result<Client> {
    let mut slot = CLIENT.lock().unwrap();
    if let Some(client) = slot.as_ref().filter(|c| !c.is_closed()) {
        return Ok(client.clone());
    }
    let client = connect()?;
    *slot = Some(client.clone());
    Ok(client)
}

#[cfg(not(test))]
fn connect() -> anyhow::Result<Client> {
    let dir = dir();
    // The daemon is this very binary re-run with `__perchd` (see main.rs), so
    // the desktop app needs no extra executable. Inside an AppImage the exe
    // lives on a FUSE mount that vanishes when the app quits, so re-run the
    // AppImage itself: its runtime then keeps a mount alive for the daemon.
    let exe = match std::env::var_os("APPIMAGE") {
        Some(appimage) => PathBuf::from(appimage),
        None => std::env::current_exe()?,
    }
    .display()
    .to_string();
    Ok(Client::connect_or_spawn(&dir, || {
        let command = perchd::spawn_command(&[exe, "__perchd".into()], &dir);
        #[cfg(target_os = "macos")]
        let command = launchd_job(&command, &dir);
        command
    })?)
}

/// macOS keeps an app "running in the background" while anything it spawned
/// is alive in its coalition, so a forked daemon (setsid or not) keeps a quit
/// perch.app alive. Only launchd starts a process in a coalition of its own:
/// run perchd as a per-user launchd job. Not a LaunchAgent (no plist in
/// ~/Library), so like before it never starts at login. The label is per
/// (exe, dir): a job already loaded under it has these exact arguments, and
/// `kickstart` starts it again once it has exited.
#[cfg(all(target_os = "macos", not(test)))]
fn launchd_job(daemon: &std::process::Command, dir: &std::path::Path) -> std::process::Command {
    use std::hash::{Hash, Hasher};
    let argv: Vec<String> = std::iter::once(daemon.get_program())
        .chain(daemon.get_args())
        .map(|arg| arg.to_string_lossy().into_owned())
        .collect();
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    argv.hash(&mut hasher);
    let label = format!("dev.hwii.perch.perchd.{:016x}", hasher.finish());
    let plist = dir.join(format!("{label}.plist"));
    let _ = std::fs::write(
        &plist,
        launchd_plist(&label, &argv, &dir.join("daemon.log")),
    );
    let domain = format!("gui/{}", unsafe { libc::getuid() });
    let mut command = std::process::Command::new("/bin/sh");
    command.args([
        "-c",
        r#"launchctl bootstrap "$1" "$2" 2>/dev/null || exec launchctl kickstart "$1/$3""#,
        "sh",
        &domain,
        &plist.display().to_string(),
        &label,
    ]);
    command
}

/// The job: started once on load and never restarted by launchd (perchd
/// exits on its own terms), its children (the agents) never killed with it.
#[cfg(any(target_os = "macos", test))]
fn launchd_plist(label: &str, argv: &[String], log: &std::path::Path) -> String {
    let xml = |s: &str| {
        s.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
    };
    let args: String = argv
        .iter()
        .map(|arg| format!("<string>{}</string>", xml(arg)))
        .collect();
    let log = xml(&log.display().to_string());
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>{label}</string>
<key>ProgramArguments</key><array>{args}</array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><false/>
<key>AbandonProcessGroup</key><true/>
<key>ProcessType</key><string>Interactive</string>
<key>StandardOutPath</key><string>{log}</string>
<key>StandardErrorPath</key><string>{log}</string>
</dict></plist>
"#
    )
}

/// Tests run the daemon on a thread of the test process, in a per-process
/// directory, so they never touch the user's real daemon.
#[cfg(test)]
fn connect() -> anyhow::Result<Client> {
    static STARTED: std::sync::Once = std::sync::Once::new();
    let dir = dir();
    STARTED.call_once(|| {
        let _ = std::fs::remove_dir_all(&dir);
        let dir = dir.clone();
        std::thread::spawn(move || {
            perchd::server::run(perchd::server::Config {
                dir,
                idle_exit: None,
            })
        });
    });
    let socket = perchd::server::socket_path(&dir);
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        match Client::connect(&socket) {
            Ok(client) => return Ok(client),
            Err(e) if Instant::now() > deadline => return Err(e.into()),
            Err(_) => std::thread::sleep(Duration::from_millis(10)),
        }
    }
}

/// Is `key`'s process running in the daemon? `false` when the daemon can't be
/// reached — callers use this to decide whether to resume, never to kill.
pub fn session_alive(key: &str) -> bool {
    client()
        .and_then(|c| Ok(c.session(key)?))
        .is_ok_and(|s| s.is_some_and(|s| s.alive))
}

/// Terminate `key`'s process group and wait for the daemon to confirm the
/// exit, escalating from SIGHUP (what closing a terminal sends) to SIGKILL.
/// Returns whether the process is confirmed gone.
pub fn terminate(key: &str) -> bool {
    let Ok(client) = client() else { return false };
    for signal in [libc::SIGHUP, libc::SIGKILL] {
        if client.kill(key, signal).is_err() {
            return !session_alive(key);
        }
        let deadline = Instant::now() + Duration::from_millis(1500);
        while Instant::now() < deadline {
            if !session_alive(key) {
                return true;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
    }
    !session_alive(key)
}

/// Terminate `key` and delete its history — for terminals closed for good.
pub fn discard(key: &str) {
    terminate(key);
    if let Ok(client) = client() {
        let _ = client.remove(key);
    }
}

/// The environment a terminal child gets: this process's own (already fixed
/// up by `boot.rs`) plus the terminal overrides. Sent in full with every
/// create, so a daemon started by an older runtime can't hand out stale env.
pub fn terminal_env() -> Vec<(String, String)> {
    let mut env: Vec<(String, String)> = std::env::vars().collect();
    env.extend(crate::terminal::terminal_env_overrides());
    env
}

#[cfg(test)]
mod tests {
    /// launchd silently refuses a malformed job, which would leave perch
    /// with no daemon; `plutil` is the same parser launchctl uses.
    #[cfg(target_os = "macos")]
    #[test]
    fn launchd_plist_parses() {
        let dir = std::env::temp_dir().join(format!("perch-plist-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("job.plist");
        let argv = ["/Apps/a & <b>.app/perch".to_string(), "__perchd".into()];
        std::fs::write(&path, super::launchd_plist("x.y", &argv, &dir.join("log"))).unwrap();
        let out = std::process::Command::new("plutil")
            .args(["-extract", "ProgramArguments.0", "raw"])
            .arg(&path)
            .output()
            .unwrap();
        let _ = std::fs::remove_dir_all(&dir);
        assert_eq!(String::from_utf8_lossy(&out.stdout).trim(), argv[0]);
    }
}

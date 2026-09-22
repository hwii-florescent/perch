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
    let exe = std::env::current_exe()?.display().to_string();
    // The daemon is this very binary re-run with `__perchd` (see main.rs), so
    // the desktop app needs no extra executable.
    Ok(Client::connect_or_spawn(&dir, || {
        perchd::spawn_command(&[exe, "__perchd".into()], &dir)
    })?)
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

//! macOS upkeep of the running perchd: is it still attributed to the app, a
//! user-confirmed way to replace a daemon that is not, and cleanup of what
//! daemons and host copies (`daemon::stable_exe`) leave behind.
//!
//! Safety contract: nothing here stops a terminal or a daemon on its own.
//! `restart_severed` runs only for an explicit confirmation naming the daemon
//! pid and the number of live sessions the user was shown, re-verifies both,
//! and refuses on any mismatch or uncertainty. The launchd and staging sweeps
//! touch only jobs and directories that are provably dead.

use crate::daemon;
use crate::permissions::{Attribution, HostStatus};
use perchd::client::Client;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};

pub const JOB_PREFIX: &str = "dev.hwii.perch.perchd.";

/// The daemon behind this runtime's socket, or `None` when there is none.
/// Never starts a daemon.
pub fn status() -> Option<HostStatus> {
    let client = Client::connect(&perchd::server::socket_path(&daemon::dir())).ok()?;
    let health = client.health().ok()?;
    Some(HostStatus {
        pid: health.pid,
        attribution: attribution(health.pid),
        live_sessions: health.alive,
    })
}

/// A process whose executable no longer exists on disk (an app update deleted
/// it) is no longer matched to the app's privacy grants. Anything that cannot
/// be read is `Unknown`, which never authorizes replacement.
pub fn attribution(pid: u32) -> Attribution {
    classify(pid_alive(pid), exe_path(pid).as_deref())
}

fn classify(alive: bool, exe: Option<&Path>) -> Attribution {
    match exe {
        Some(path) if alive && path.exists() => Attribution::Intact,
        Some(path) if alive && !path.exists() => Attribution::Severed,
        _ => Attribution::Unknown,
    }
}

fn pid_alive(pid: u32) -> bool {
    // SAFETY: signal 0 only probes existence.
    if unsafe { libc::kill(pid as i32, 0) } == 0 {
        return true;
    }
    std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
}

/// `proc_pidpath` fails for a process running from a deleted file, so fall
/// back to the path of its text mapping, which still names where it was.
fn exe_path(pid: u32) -> Option<PathBuf> {
    let mut buf = vec![0u8; 4096];
    // SAFETY: the buffer is valid for its stated length.
    let n = unsafe { libc::proc_pidpath(pid as i32, buf.as_mut_ptr().cast(), buf.len() as u32) };
    if n > 0 {
        return Some(PathBuf::from(
            String::from_utf8_lossy(&buf[..n as usize]).into_owned(),
        ));
    }
    let out = Command::new("/usr/sbin/lsof")
        .args(["-nP", "-a", "-d", "txt", "-Fn", "-p"])
        .arg(pid.to_string())
        .output()
        .ok()?;
    first_text_path(&String::from_utf8_lossy(&out.stdout))
}

/// `lsof -Fn` prints `f<fd>` then `n<name>` per file; the first `ftxt` is the
/// executable.
fn first_text_path(lsof: &str) -> Option<PathBuf> {
    let mut lines = lsof.lines();
    while let Some(line) = lines.next() {
        if line == "ftxt" {
            return lines.next()?.strip_prefix('n').map(PathBuf::from);
        }
    }
    None
}

/// Replace the daemon `expected_pid`, which must still be severed and still
/// hold exactly `expected_alive` live sessions: they end (each confirmed),
/// then the daemon itself stops. Sessions cannot move to a new daemon, so this
/// is the one operation that ends them; it only ever runs on the user's say-so.
pub fn restart_severed(expected_pid: u32, expected_alive: usize) -> Result<(), String> {
    // Tests host the daemon in-process; never signal ourselves.
    if expected_pid == std::process::id() {
        return Err("The terminal host is this process; nothing was restarted.".into());
    }
    let client = Client::connect(&perchd::server::socket_path(&daemon::dir()))
        .map_err(|e| format!("Terminal host unavailable; nothing was changed: {e}"))?;
    restart_with(
        &client,
        expected_pid,
        expected_alive,
        attribution,
        stop_daemon,
    )?;
    sweep_dead_jobs(JOB_PREFIX);
    Ok(())
}

fn restart_with(
    client: &Client,
    expected_pid: u32,
    expected_alive: usize,
    attribution: impl Fn(u32) -> Attribution,
    stop: impl FnOnce(u32) -> Result<(), String>,
) -> Result<(), String> {
    let refuse = |why: &str| Err(format!("{why}; nothing was restarted."));
    let verified = |client: &Client| -> Result<usize, String> {
        let attributed = attribution(expected_pid);
        // Read last, so the live count is the freshest fact.
        let health = client.health().map_err(|e| e.to_string())?;
        if health.pid != expected_pid {
            return Err("The terminal host changed".into());
        }
        if attributed != Attribution::Severed {
            return Err("The terminal host is not confirmed stale".into());
        }
        Ok(health.alive)
    };
    match verified(client) {
        Ok(alive) if alive == expected_alive => {}
        Ok(_) => return refuse("The running sessions changed since you were shown them"),
        Err(why) => return refuse(&why),
    }
    let live: Vec<String> = client
        .list()
        .map_err(|e| format!("Could not list sessions; nothing was restarted: {e}"))?
        .into_iter()
        .filter(|s| s.alive)
        .map(|s| s.id)
        .collect();
    if live.len() != expected_alive {
        return refuse("The running sessions changed since you were shown them");
    }
    for id in &live {
        if !daemon::terminate_with(client, id) {
            return Err(format!(
                "Could not confirm session {id} stopped; the terminal host was left running."
            ));
        }
    }
    // Last look before the daemon goes: a terminal opened meanwhile, or a
    // daemon that is no longer the one the user confirmed, must survive.
    match verified(client) {
        Ok(0) => {}
        Ok(_) => {
            return Err("A terminal started meanwhile; the terminal host was left running.".into())
        }
        Err(why) => return Err(format!("{why}; the terminal host was left running.")),
    }
    stop(expected_pid)
}

/// SIGTERM, then SIGKILL, of a pid the caller just verified is the daemon.
fn stop_daemon(pid: u32) -> Result<(), String> {
    for signal in [libc::SIGTERM, libc::SIGKILL] {
        // SAFETY: pid was read from the daemon's own health reply an instant ago.
        unsafe { libc::kill(pid as i32, signal) };
        let deadline = Instant::now() + Duration::from_secs(3);
        while Instant::now() < deadline {
            if !pid_alive(pid) {
                return Ok(());
            }
            std::thread::sleep(Duration::from_millis(50));
        }
    }
    Err("The terminal host did not stop".into())
}

/// Unload launchd jobs of perchd daemons that have exited. A job lingers in
/// launchd after its process is gone (one per host copy and test directory).
/// Only a job with no pid that has run and exited is touched; a running job,
/// or one launchd is still starting, never is. Booting out a dead job leaves
/// its abandoned children (the agents) alone, and the next spawn bootstraps a
/// fresh job from the plist it rewrites. Returns how many were unloaded.
pub fn sweep_dead_jobs(prefix: &str) -> usize {
    let Ok(list) = Command::new("launchctl").arg("list").output() else {
        return 0;
    };
    let domain = format!("gui/{}", unsafe { libc::getuid() });
    let mut removed = 0;
    for label in dead_labels(&String::from_utf8_lossy(&list.stdout), prefix) {
        let target = format!("{domain}/{label}");
        let Ok(print) = Command::new("launchctl").args(["print", &target]).output() else {
            continue;
        };
        if exited_job(&String::from_utf8_lossy(&print.stdout))
            && Command::new("launchctl")
                .args(["bootout", &target])
                .status()
                .is_ok_and(|s| s.success())
        {
            removed += 1;
        }
    }
    removed
}

/// Labels from `launchctl list` (`PID\tSTATUS\tLABEL`) that have no pid.
fn dead_labels<'a>(list: &'a str, prefix: &str) -> Vec<&'a str> {
    list.lines()
        .filter_map(|line| {
            let mut cols = line.split_whitespace();
            let (pid, _status, label) = (cols.next()?, cols.next()?, cols.next()?);
            (pid == "-" && label.starts_with(prefix)).then_some(label)
        })
        .collect()
}

/// `launchctl print` of a job that ran at least once and has exited. A job
/// just bootstrapped shows a pid, or `(never exited)`, and is not dead.
fn exited_job(print: &str) -> bool {
    let field = |name: &str| {
        print
            .lines()
            .find_map(|l| l.trim().strip_prefix(name).map(str::to_owned))
    };
    let runs = field("runs = ").and_then(|v| v.parse::<u32>().ok());
    let exit = field("last exit code = ");
    field("pid = ").is_none()
        && print.lines().any(|l| l.trim() == "state = not running")
        && runs.is_some_and(|r| r >= 1)
        && exit.is_some_and(|e| e != "(never exited)")
}

/// Remove `<hash>.staging-<pid>` directories whose publishing process is
/// gone, left by a crash while copying a host bundle.
pub fn clean_stale_staging(root: &Path) {
    let Ok(entries) = std::fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if staging_pid(&name).is_some_and(|pid| pid != std::process::id() && !pid_alive(pid)) {
            let _ = std::fs::remove_dir_all(entry.path());
        }
    }
}

fn staging_pid(name: &str) -> Option<u32> {
    name.split_once(".staging-")?.1.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_a_missing_exe_of_a_live_process_is_severed() {
        let here = std::env::current_exe().unwrap();
        let gone = Path::new("/private/var/folders/x/tmp.dead/perch.app/Contents/MacOS/p");
        assert_eq!(classify(true, Some(&here)), Attribution::Intact);
        assert_eq!(classify(true, Some(gone)), Attribution::Severed);
        // No evidence is never severed.
        assert_eq!(classify(true, None), Attribution::Unknown);
        assert_eq!(classify(false, Some(gone)), Attribution::Unknown);
        assert_eq!(attribution(std::process::id()), Attribution::Intact);
        // The real daemon on a deleted bundle: lsof still names the old path.
        assert_eq!(
            first_text_path(
                "p41639\nfcwd\nn/\nftxt\nn/private/tmp/x/perch.app/p\nftxt\nn/usr/lib/dyld\n"
            ),
            Some(PathBuf::from("/private/tmp/x/perch.app/p"))
        );
        assert_eq!(first_text_path("p1\nfcwd\nn/\n"), None);
    }

    #[test]
    fn launchd_output_picks_only_exited_jobs() {
        let list = "PID\tStatus\tLabel\n-\t0\tdev.hwii.perch.perchd.aaa\n123\t0\tdev.hwii.perch.perchd.bbb\n-\t-15\tcom.apple.thing\n-\t0\tdev.hwii.perch.perchd.ccc\n";
        assert_eq!(
            dead_labels(list, JOB_PREFIX),
            ["dev.hwii.perch.perchd.aaa", "dev.hwii.perch.perchd.ccc"]
        );
        let exited =
            "x = {\n\tstate = not running\n\truns = 1\n\tlast exit code = 0\n\t\tstate = active\n}";
        assert!(exited_job(exited));
        // Starting or running: has a pid / never exited / never ran.
        assert!(!exited_job(
            "\tstate = running\n\truns = 1\n\tpid = 5\n\tlast exit code = (never exited)"
        ));
        assert!(!exited_job(
            "\tstate = not running\n\truns = 0\n\tlast exit code = (never exited)"
        ));
        assert!(!exited_job(
            "\tstate = not running\n\truns = 1\n\tpid = 9\n\tlast exit code = 0"
        ));
        assert!(!exited_job(""));
    }

    #[test]
    fn staging_dirs_of_dead_publishers_are_removed_and_live_or_published_ones_kept() {
        let root = std::env::temp_dir().join(format!("perch-staging-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let mut sleeper = Command::new("sleep").arg("30").spawn().unwrap();
        let dead = root.join("abc.staging-999999");
        let live = root.join(format!("abc.staging-{}", sleeper.id()));
        let published = root.join("terminal-host-abc");
        for dir in [&dead, &live, &published] {
            std::fs::create_dir_all(dir).unwrap();
        }
        assert_eq!(staging_pid("abc.staging-42"), Some(42));
        assert_eq!(staging_pid("terminal-host-abc"), None);
        clean_stale_staging(&root);
        let (dead_left, live_left, published_left) =
            (dead.exists(), live.exists(), published.exists());
        let _ = sleeper.kill();
        let _ = sleeper.wait();
        let _ = std::fs::remove_dir_all(&root);
        assert!(!dead_left && live_left && published_left);
    }

    /// A real launchd job: the sweep must unload the exited one and leave a
    /// running one, and the children an exited daemon abandoned must survive.
    #[test]
    fn sweep_unloads_only_exited_jobs_and_spares_abandoned_children() {
        let tag = format!("dev.hwii.perch.perchd.test{}", std::process::id());
        let dir = std::env::temp_dir().join(format!("perch-sweep-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let domain = format!("gui/{}", unsafe { libc::getuid() });
        let load = |suffix: &str, script: &str| {
            let label = format!("{tag}{suffix}");
            let plist = dir.join(format!("{label}.plist"));
            let argv = ["/bin/sh".to_string(), "-c".into(), script.into()];
            std::fs::write(
                &plist,
                crate::daemon::launchd_plist(&label, &argv, &dir.join("log")),
            )
            .unwrap();
            assert!(Command::new("launchctl")
                .args(["bootstrap", &domain])
                .arg(&plist)
                .status()
                .unwrap()
                .success());
            label
        };
        let loaded = |label: &str| {
            Command::new("launchctl")
                .args(["print", &format!("{domain}/{label}")])
                .output()
                .unwrap()
                .status
                .success()
        };
        let marker = dir.join("child-pid");
        // Exits at once, leaving an abandoned child in its own process group.
        let dead = load(
            "dead",
            &format!("sleep 4343 & echo $! > {}; exit 0", marker.display()),
        );
        let running = load("running", "exec sleep 4344");
        let deadline = Instant::now() + Duration::from_secs(5);
        while Instant::now() < deadline
            && !(marker.exists() && !dead_labels(&launchctl_list(), &dead).is_empty())
        {
            std::thread::sleep(Duration::from_millis(50));
        }
        let child: i32 = std::fs::read_to_string(&marker)
            .unwrap()
            .trim()
            .parse()
            .unwrap();
        let removed = sweep_dead_jobs(&tag);
        let (dead_loaded, running_loaded) = (loaded(&dead), loaded(&running));
        // SAFETY: probing/cleaning up the sleep we started.
        let child_alive = unsafe { libc::kill(child, 0) } == 0;
        let _ = Command::new("launchctl")
            .args(["bootout", &format!("{domain}/{running}")])
            .status();
        unsafe { libc::kill(child, libc::SIGKILL) };
        let _ = std::fs::remove_dir_all(&dir);
        assert_eq!(removed, 1);
        assert!(!dead_loaded && running_loaded && child_alive);
    }

    fn launchctl_list() -> String {
        String::from_utf8_lossy(
            &Command::new("launchctl")
                .arg("list")
                .output()
                .unwrap()
                .stdout,
        )
        .into_owned()
    }

    /// A daemon of its own on a thread of this process (the shared test
    /// daemon belongs to other tests), so its health pid is ours.
    fn own_daemon() -> Client {
        static N: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
        let dir = std::env::temp_dir().join(format!(
            "perch-rs-{}-{}",
            std::process::id(),
            N.fetch_add(1, std::sync::atomic::Ordering::SeqCst)
        ));
        let _ = std::fs::remove_dir_all(&dir);
        let run_dir = dir.clone();
        std::thread::spawn(move || {
            perchd::server::run(perchd::server::Config {
                dir: run_dir,
                idle_exit: None,
            })
        });
        let socket = perchd::server::socket_path(&dir);
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            match Client::connect(&socket) {
                Ok(client) => return client,
                Err(e) if Instant::now() > deadline => panic!("{e}"),
                Err(_) => std::thread::sleep(Duration::from_millis(10)),
            }
        }
    }

    fn sleeper(client: &Client, id: &str) {
        let argv = vec!["/bin/sh".into(), "-c".into(), "sleep 60".into()];
        client
            .create(id, argv, Some("/".into()), vec![], 80, 24)
            .unwrap();
    }

    fn alive(client: &Client, id: &str) -> bool {
        client.session(id).unwrap().is_some_and(|s| s.alive)
    }

    #[test]
    fn restart_ends_sessions_only_for_the_confirmed_severed_daemon() {
        let client = own_daemon();
        let me = std::process::id();
        let (a, b) = ("restart-a", "restart-b");
        sleeper(&client, a);
        sleeper(&client, b);
        let stops = std::cell::Cell::new(0);
        let stop = |pid: u32| {
            assert_eq!(pid, me);
            stops.set(stops.get() + 1);
            Ok(())
        };
        let untouched = || alive(&client, a) && alive(&client, b) && stops.get() == 0;
        // Not the daemon the user confirmed, or not the sessions they saw.
        assert!(restart_with(&client, me + 1, 2, |_| Attribution::Severed, stop).is_err());
        assert!(restart_with(&client, me, 1, |_| Attribution::Severed, stop).is_err());
        assert!(restart_with(&client, me, 3, |_| Attribution::Severed, stop).is_err());
        // Intact or unreadable attribution never authorizes a restart.
        assert!(restart_with(&client, me, 2, |_| Attribution::Intact, stop).is_err());
        assert!(restart_with(&client, me, 2, |_| Attribution::Unknown, stop).is_err());
        assert!(untouched());
        // A terminal opened while the confirmed sessions were stopping keeps
        // the daemon and is itself never touched; the confirmed ones are gone.
        let calls = std::cell::Cell::new(0);
        let opens = |_: u32| {
            calls.set(calls.get() + 1);
            if calls.get() == 2 {
                sleeper(&client, "restart-late");
            }
            Attribution::Severed
        };
        assert!(restart_with(&client, me, 2, opens, stop).is_err());
        assert_eq!(stops.get(), 0);
        assert!(alive(&client, "restart-late") && !alive(&client, a) && !alive(&client, b));
        // Fresh confirmation for exactly the sessions that are live now.
        assert!(restart_with(&client, me, 1, |_| Attribution::Severed, stop).is_ok());
        assert!(!alive(&client, "restart-late"));
        assert_eq!(stops.get(), 1);
        // And nothing at all when the entry point is asked to stop ourselves.
        assert!(restart_severed(me, 0).is_err());
    }
}

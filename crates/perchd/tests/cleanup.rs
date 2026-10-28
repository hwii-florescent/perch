//! Deterministic cleanup safety checks. Private daemons only; no real agent turns.
use perchd::client::Client;
use perchd::proto::{Retention, SessionInfo, CLEANUP_OWNER_ENV};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

struct Fixture {
    dir: PathBuf,
    daemon: Child,
    client: Client,
    extra_pids: Vec<i32>,
}
impl Fixture {
    fn new() -> Self {
        static NEXT: AtomicUsize = AtomicUsize::new(0);
        let dir = std::env::temp_dir().join(format!(
            "perch-cleanup-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let daemon = Command::new(env!("CARGO_BIN_EXE_perchd"))
            .args(["serve", "--no-idle-exit", "--dir"])
            .arg(&dir)
            .env("PERCH_DB", dir.join("history.sqlite"))
            .env("PERCH_HOSTS", dir.join("hosts.json"))
            .env("PERCH_SETTINGS", dir.join("settings.json"))
            .env("PERCHD_DIR", &dir)
            .env_remove(CLEANUP_OWNER_ENV)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::inherit())
            .spawn()
            .unwrap();
        let deadline = Instant::now() + Duration::from_secs(5);
        let client = loop {
            if let Ok(client) = Client::connect(&perchd::server::socket_path(&dir)) {
                break client;
            }
            assert!(Instant::now() < deadline, "private daemon did not start");
            std::thread::sleep(Duration::from_millis(10));
        };
        Self {
            dir,
            daemon,
            client,
            extra_pids: vec![],
        }
    }
    fn create(&self, id: &str, script: &str, owner: Option<&str>) -> SessionInfo {
        self.client
            .create(
                id,
                vec!["/bin/sh".into(), "-c".into(), script.into()],
                Some(self.dir.display().to_string()),
                owner
                    .map(|owner| vec![(CLEANUP_OWNER_ENV.into(), owner.into())])
                    .unwrap_or_default(),
                80,
                24,
            )
            .unwrap();
        self.session(id)
    }
    fn session(&self, id: &str) -> SessionInfo {
        self.client.session(id).unwrap().unwrap()
    }
    fn cli(&self, command: &str) -> Command {
        let mut cmd = Command::new(env!("CARGO_BIN_EXE_perch"));
        cmd.arg(command)
            .arg("--dir")
            .arg(&self.dir)
            .arg("--json")
            .stdin(Stdio::null());
        cmd
    }
    fn release(&self, id: &str) -> SessionInfo {
        let session = self.session(id);
        self.client
            .release(&session, "fixture-owner", "fixture finished")
            .unwrap();
        self.session(id)
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        // These are exclusively this test's freshly created process identities.
        if let Ok(sessions) = self.client.list() {
            for session in sessions.into_iter().filter(|session| session.alive) {
                if let Some(pid) = session.pid {
                    unsafe {
                        libc::kill(-(pid as i32), libc::SIGKILL);
                    }
                }
            }
        }
        for pid in &self.extra_pids {
            unsafe {
                libc::kill(*pid, libc::SIGKILL);
            }
        }
        let _ = self.daemon.kill();
        let _ = self.daemon.wait();
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}
fn until(mut condition: impl FnMut() -> bool) {
    let deadline = Instant::now() + Duration::from_secs(6);
    while !condition() {
        assert!(Instant::now() < deadline, "condition did not settle");
        std::thread::sleep(Duration::from_millis(15));
    }
}
const WAIT: &str = "trap '' HUP; echo ready > ready; while :; do sleep 1; done";

#[test]
fn only_explicit_release_is_eligible_and_cli_preserves_history() {
    let fixture = Fixture::new();
    let sibling = Fixture::new();
    fixture.create("released", WAIT, Some("fixture-owner"));
    fixture.create("retained", WAIT, Some("other-core"));
    fixture.create("anonymous", WAIT, None);
    let sibling_session = sibling.create("sibling", WAIT, Some("fixture-owner"));
    until(|| fixture.dir.join("ready").exists());
    let original = fixture.session("released");
    assert!(fixture
        .client
        .release(&original, "wrong-owner", "closed")
        .is_err());
    assert!(fixture.client.cleanup(&original).is_err());
    assert!(fixture
        .client
        .cleanup(&fixture.session("anonymous"))
        .is_err());
    let (_, reader, _) = fixture.client.attach("released", None).unwrap();
    assert!(fixture
        .client
        .release(&fixture.session("released"), "fixture-owner", "closed")
        .is_err());
    fixture.client.detach("released").unwrap();
    drop(reader);
    fixture.release("released");
    let preview = fixture.cli("cleanup").arg("--dry-run").output().unwrap();
    assert!(
        preview.status.success(),
        "{}",
        String::from_utf8_lossy(&preview.stderr)
    );
    let preview: serde_json::Value = serde_json::from_slice(&preview.stdout).unwrap();
    assert_eq!(preview["candidates"].as_array().unwrap().len(), 1);
    assert_eq!(preview["candidates"][0]["id"], "released");
    assert!(fixture.session("released").alive, "preview must not signal");
    let unconfirmed = fixture.cli("cleanup").output().unwrap();
    assert!(
        !unconfirmed.status.success(),
        "noninteractive cleanup needs --yes"
    );
    assert!(fixture.session("released").alive);
    let output = fixture.cli("cleanup").arg("--yes").output().unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(!fixture.session("released").alive);
    assert!(fixture.dir.join("history/released.json").exists());
    assert!(fixture.dir.join("history/released.log").exists());
    assert!(fixture.session("retained").alive);
    assert!(fixture.session("anonymous").alive);
    assert_eq!(sibling.session("sibling").pid, sibling_session.pid);
    assert!(sibling.session("sibling").alive);
}

#[test]
fn reattach_and_input_invalidate_the_preview_without_following_new_releases() {
    let fixture = Fixture::new();
    fixture.create("shell", WAIT, Some("fixture-owner"));
    until(|| fixture.dir.join("ready").exists());
    let stale = fixture.release("shell");
    let (_, reader, _) = fixture.client.attach("shell", None).unwrap();
    assert_eq!(
        fixture.session("shell").cleanup.retention,
        Retention::Retained
    );
    fixture.client.detach("shell").unwrap();
    drop(reader);
    let fresh = fixture.release("shell");
    assert!(fixture.client.cleanup(&stale).is_err());
    fixture.client.input("shell", b" ").unwrap();
    until(|| fixture.session("shell").cleanup.retention == Retention::Retained);
    assert!(fixture.client.cleanup(&fresh).is_err());
    assert!(fixture.session("shell").alive);
}

#[test]
fn stopping_is_per_runtime_and_confirms_a_hup_resistant_group() {
    let fixture = Fixture::new();
    // The leader exits on HUP, but its child does not. Leader-only confirmation
    // would return early and leave the child executing.
    fixture.create(
        "shell",
        "trap 'exit 0' HUP; /bin/sh -c 'trap \"\" HUP; echo ready > ready; exec sleep 60' & wait",
        Some("fixture-owner"),
    );
    until(|| fixture.dir.join("ready").exists());
    let released = fixture.release("shell");
    let other = Client::connect(&perchd::server::socket_path(&fixture.dir)).unwrap();
    let client = fixture.client.clone();
    let stop = std::thread::spawn(move || client.cleanup(&released));
    // One connection dispatches in order. Other viewers must stay responsive.
    until(|| other.session("shell").unwrap().unwrap().cleanup.stopping);
    let started = Instant::now();
    assert!(other.health().is_ok());
    other
        .create(
            "unrelated",
            vec!["/bin/sleep".into(), "60".into()],
            None,
            vec![],
            80,
            24,
        )
        .unwrap();
    assert!(
        started.elapsed() < Duration::from_secs(1),
        "one stopping session blocked unrelated operations"
    );
    assert!(other.attach("shell", None).is_err());
    assert!(other
        .create("shell", vec!["/bin/sh".into()], None, vec![], 80, 24)
        .is_err());
    stop.join().unwrap().unwrap();
    assert!(!fixture.session("shell").alive);
    assert!(fixture.session("unrelated").alive);
    assert!(!fixture.session("shell").cleanup.stopping);
    assert!(fixture.session("shell").cleanup.group_stopped);
}

#[test]
fn natural_leader_exit_is_not_process_group_confirmation() {
    let mut fixture = Fixture::new();
    fixture.create(
        "shell",
        "trap '' HUP; sleep 60 & echo $! > child; exit 0",
        Some("fixture-owner"),
    );
    until(|| fixture.dir.join("child").exists());
    let child = std::fs::read_to_string(fixture.dir.join("child"))
        .unwrap()
        .trim()
        .parse::<i32>()
        .unwrap();
    fixture.extra_pids.push(child);
    until(|| !fixture.session("shell").alive);
    assert!(!fixture.session("shell").cleanup.group_stopped);
    assert!(!fixture.session("shell").cleanup_candidate());
    assert!(
        fixture.client.remove("shell").is_err(),
        "unconfirmed group bookkeeping must survive"
    );
    assert!(fixture
        .client
        .create("shell", vec!["/bin/sh".into()], None, vec![], 80, 24)
        .is_err());
    assert_eq!(unsafe { libc::kill(child, 0) }, 0);
    unsafe {
        libc::kill(child, libc::SIGKILL);
    }
    until(|| fixture.session("shell").cleanup.group_stopped);
    fixture.extra_pids.clear();
}

#[test]
fn escaped_children_are_review_only_not_a_successful_cleanup() {
    let mut fixture = Fixture::new();
    let session = fixture.create(
        "shell",
        "set -m; sleep 60 & echo $! > escaped; wait",
        Some("fixture-owner"),
    );
    until(|| fixture.dir.join("escaped").exists());
    let pid: i32 = std::fs::read_to_string(fixture.dir.join("escaped"))
        .unwrap()
        .trim()
        .parse()
        .unwrap();
    fixture.extra_pids.push(pid);
    assert_ne!(unsafe { libc::getpgid(pid) }, session.pid.unwrap() as i32);
    let released = fixture.release("shell");
    assert!(fixture
        .client
        .cleanup(&released)
        .unwrap_err()
        .to_string()
        .contains("detached"));
    assert!(fixture.session("shell").alive);
    assert_eq!(
        unsafe { libc::kill(pid, 0) },
        0,
        "review-only child was signalled"
    );
}

#[test]
fn owner_context_is_not_inherited_and_runtime_incarnations_are_unique() {
    let fixture = Fixture::new();
    let old = fixture.create(
        "shell",
        "printf '%s' \"${PERCH_CLEANUP_OWNER-unset}\" > owner-env",
        Some("fixture-owner"),
    );
    until(|| !fixture.session("shell").alive);
    assert!(
        fixture.session("shell").cleanup.group_stopped,
        "natural exit without children must be confirmed"
    );
    assert_eq!(
        std::fs::read_to_string(fixture.dir.join("owner-env")).unwrap(),
        "unset"
    );
    let new = fixture.create("shell", "sleep 60", Some("fixture-owner"));
    assert_ne!(old.cleanup.incarnation, new.cleanup.incarnation);
    assert!(fixture
        .client
        .release(&old, "fixture-owner", "closed")
        .is_err());
    assert!(fixture.session("shell").alive);
}

#[test]
fn missing_daemon_is_read_only_and_invalid_cli_options_fail_closed() {
    let dir = std::env::temp_dir().join(format!("perch-cleanup-missing-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    let output = Command::new(env!("CARGO_BIN_EXE_perch"))
        .args(["cleanup", "--dry-run", "--json", "--dir"])
        .arg(&dir)
        .output()
        .unwrap();
    assert!(output.status.success());
    assert!(
        !dir.exists(),
        "cleanup must not create a daemon or state directory"
    );
    let output = Command::new(env!("CARGO_BIN_EXE_perch"))
        .args(["cleanup", "--all", "--yes", "--dir"])
        .arg(&dir)
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(!dir.exists());
}

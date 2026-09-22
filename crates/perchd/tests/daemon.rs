//! End-to-end against the real `perchd` binary with `/bin/sh` sessions.

use perchd::client::{AttachEnd, AttachReader, Client};
use std::io::Read;
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::{Duration, Instant};

fn test_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("perchd-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn connect(dir: &std::path::Path) -> Client {
    Client::connect_or_spawn(dir, || {
        perchd::spawn_command(&[env!("CARGO_BIN_EXE_perchd").to_string()], dir)
    })
    .expect("daemon starts")
}

/// Read in the background so a missing needle fails instead of hanging.
fn collector(mut reader: AttachReader) -> mpsc::Receiver<Vec<u8>> {
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        while let Ok(n) = reader.read(&mut buf) {
            if n == 0 || tx.send(buf[..n].to_vec()).is_err() {
                break;
            }
        }
    });
    rx
}

fn wait_for(rx: &mpsc::Receiver<Vec<u8>>, seen: &mut Vec<u8>, needle: &str) {
    let deadline = Instant::now() + Duration::from_secs(10);
    while !String::from_utf8_lossy(seen).contains(needle) {
        let left = deadline.saturating_duration_since(Instant::now());
        match rx.recv_timeout(left) {
            Ok(chunk) => seen.extend(chunk),
            Err(_) => panic!(
                "never saw {needle:?}; got {:?}",
                String::from_utf8_lossy(seen)
            ),
        }
    }
}

fn sh(client: &Client, id: &str) {
    let env = vec![("PS1".to_string(), "$ ".to_string())];
    client
        .create(id, vec!["/bin/sh".into()], Some("/".into()), env, 100, 30)
        .unwrap();
}

#[test]
fn sessions_outlive_clients_and_replay_their_output() {
    let dir = test_dir("outlive");
    let a = connect(&dir);
    sh(&a, "shell-1");
    let (attached, reader, _) = a.attach("shell-1", None).unwrap();
    assert!(attached.alive);
    let rx = collector(reader);
    a.input("shell-1", b"echo perch-$((6*7))\n").unwrap();
    let mut seen = Vec::new();
    wait_for(&rx, &mut seen, "perch-42");

    // A duplicate create is refused, not a second process.
    let dup = a
        .create("shell-1", vec!["/bin/sh".into()], None, vec![], 80, 24)
        .unwrap_err();
    assert!(dup.is(perchd::proto::ERR_EXISTS), "{dup}");

    // The runtime "crashes": its connection goes away without detaching.
    drop(rx);
    drop(a);

    let b = connect(&dir);
    let info = b.session("shell-1").unwrap().expect("still listed");
    assert!(info.alive, "a lost client must not kill the session");
    let (attached, reader, waiter) = b.attach("shell-1", None).unwrap();
    assert_eq!(attached.start, 0);
    let rx = collector(reader);
    let mut seen = Vec::new();
    wait_for(&rx, &mut seen, "perch-42"); // replayed from the history log

    // Live output continues on the new attachment, and the screen follows.
    b.input("shell-1", b"echo second-$((1+1))\n").unwrap();
    wait_for(&rx, &mut seen, "second-2");
    let snap = b.snapshot("shell-1").unwrap();
    assert!(snap.text.contains("second-2"), "{:?}", snap.text);

    // `since` resumes at an exact byte offset.
    let offset = String::from_utf8_lossy(&seen).find("second-2").unwrap() as u64;
    let c = connect(&dir);
    let (resumed, reader2, _) = c.attach("shell-1", Some(offset)).unwrap();
    assert_eq!(resumed.start, offset);
    let rx2 = collector(reader2);
    let mut tail = Vec::new();
    wait_for(&rx2, &mut tail, "second-2");
    assert!(String::from_utf8_lossy(&tail).starts_with("second-2"));

    b.resize("shell-1", 120, 40).unwrap();
    assert_eq!(b.session("shell-1").unwrap().unwrap().cols, 120);

    // Exit codes reach every subscriber.
    b.input("shell-1", b"exit 3\n").unwrap();
    assert_eq!(waiter.wait(), AttachEnd::Exited(3));
    let info = b.session("shell-1").unwrap().unwrap();
    assert!(!info.alive);
    assert_eq!(info.exit_code, Some(3));

    // An exited session can be recreated under the same id.
    sh(&b, "shell-1");
    assert!(b.session("shell-1").unwrap().unwrap().alive);
    b.kill("shell-1", libc::SIGKILL).unwrap();
    let _ = std::fs::remove_dir_all(&dir);
    let pid = b.health().unwrap().pid;
    unsafe { libc::kill(pid as i32, libc::SIGKILL) };
}

#[test]
fn a_restarted_daemon_keeps_scrollback_of_lost_sessions() {
    let dir = test_dir("restart");
    let a = connect(&dir);
    sh(&a, "agent-9");
    let (_, reader, _) = a.attach("agent-9", None).unwrap();
    let rx = collector(reader);
    a.input("agent-9", b"echo before-$((2*2))\n").unwrap();
    let mut seen = Vec::new();
    wait_for(&rx, &mut seen, "before-4");

    let pid = a.health().unwrap().pid;
    unsafe { libc::kill(pid as i32, libc::SIGKILL) };
    let deadline = Instant::now() + Duration::from_secs(5);
    while !a.is_closed() && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(10));
    }

    let b = connect(&dir);
    assert_ne!(b.health().unwrap().pid, pid, "a new daemon took over");
    let info = b.session("agent-9").unwrap().expect("reloaded from disk");
    assert!(!info.alive, "its process died with the old daemon");
    let (attached, reader, waiter) = b.attach("agent-9", None).unwrap();
    assert!(!attached.alive);
    let rx = collector(reader);
    let mut replay = Vec::new();
    wait_for(&rx, &mut replay, "before-4");
    assert!(matches!(waiter.wait(), AttachEnd::Exited(_)));

    b.remove("agent-9").unwrap();
    assert!(b.session("agent-9").unwrap().is_none());
    let pid = b.health().unwrap().pid;
    unsafe { libc::kill(pid as i32, libc::SIGKILL) };
    let _ = std::fs::remove_dir_all(&dir);
}

/// The remote transport: a client speaking only through `perchd connect`'s
/// stdin/stdout — exactly the bytes `ssh host perchd connect` would carry.
#[test]
fn a_client_over_connect_stdio_drives_sessions() {
    let dir = test_dir("stdio");
    let mut bridge = std::process::Command::new(env!("CARGO_BIN_EXE_perchd"))
        .args(["connect", "--dir"])
        .arg(&dir)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .unwrap();
    let client =
        Client::from_transport(bridge.stdout.take().unwrap(), bridge.stdin.take().unwrap());
    sh(&client, "remote-1");
    let (_, reader, _) = client.attach("remote-1", None).unwrap();
    let rx = collector(reader);
    client.input("remote-1", b"echo over-$((3*3))\n").unwrap();
    let mut seen = Vec::new();
    wait_for(&rx, &mut seen, "over-9");
    assert!(client.snapshot("remote-1").unwrap().text.contains("over-9"));

    // Losing the transport (ssh dropping) leaves the session running.
    let pid = client.health().unwrap().pid;
    drop(client);
    let _ = bridge.kill();
    let _ = bridge.wait();
    let local = connect(&dir);
    assert!(local.session("remote-1").unwrap().unwrap().alive);
    unsafe { libc::kill(pid as i32, libc::SIGKILL) };
    let _ = std::fs::remove_dir_all(&dir);
}

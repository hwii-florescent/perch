//! `perch daemon run|read|send|wait|kill` against a private daemon: no core, no app, no agent.
use perchd::client::Client;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

struct Daemon {
    dir: PathBuf,
    child: Child,
    client: Client,
}
impl Daemon {
    fn new() -> Self {
        let dir = std::env::temp_dir().join(format!("perch-terminal-cli-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let child = Command::new(env!("CARGO_BIN_EXE_perchd"))
            .args(["serve", "--no-idle-exit", "--dir"])
            .arg(&dir)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
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
        Self { dir, child, client }
    }
    /// stdout on success, stderr on failure.
    fn perch(&self, args: &[&str]) -> Result<String, String> {
        let out = Command::new(env!("CARGO_BIN_EXE_perchd"))
            .arg(args[0])
            .arg("--dir")
            .arg(&self.dir)
            .args(&args[1..])
            .output()
            .unwrap();
        let text = |bytes: &[u8]| String::from_utf8_lossy(bytes).trim().to_string();
        if out.status.success() {
            Ok(text(&out.stdout))
        } else {
            Err(text(&out.stderr))
        }
    }
}
impl Drop for Daemon {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

#[test]
fn a_program_can_start_read_type_into_wait_for_and_stop_a_terminal() {
    let d = Daemon::new();
    // `perch()` puts `--dir` right after the verb, before a program's own words.
    let id = d
        .perch(&[
            "run",
            "--cwd",
            "/tmp",
            "--",
            "/bin/sh",
            "-c",
            "echo hello; read x; echo got:$x",
        ])
        .unwrap();
    let screen = loop {
        let text = d.perch(&["read", &id]).unwrap();
        if text.contains("hello") {
            break text;
        }
        std::thread::sleep(Duration::from_millis(50));
    };
    assert!(!screen.contains("got:"));
    d.perch(&["send", &id, "abc", "--enter"]).unwrap();
    assert_eq!(
        d.perch(&["wait", &id, "--timeout", "10"]).unwrap(),
        "exited 0"
    );
    let json: serde_json::Value =
        serde_json::from_str(&d.perch(&["read", &id, "--lines", "5", "--json"]).unwrap()).unwrap();
    assert!(json["text"].as_str().unwrap().contains("got:abc"), "{json}");
    assert_eq!(json["alive"], false);
    assert!(d
        .perch(&["send", &id, "x"])
        .unwrap_err()
        .contains("has exited"));

    // A terminal that is still running is stopped only if `run` made it.
    let sleeper = d
        .perch(&["run", "--json", "--", "/bin/sleep", "60"])
        .unwrap();
    let sleeper = serde_json::from_str::<serde_json::Value>(&sleeper).unwrap()["id"]
        .as_str()
        .unwrap()
        .to_string();
    assert!(d
        .perch(&["wait", &sleeper, "--timeout", "1"])
        .unwrap_err()
        .contains("still running"));
    assert_eq!(
        d.perch(&["wait", &sleeper, "--quiet", "1"]).unwrap(),
        "quiet"
    );
    d.perch(&["kill", &sleeper]).unwrap();
    assert!(d
        .perch(&["wait", &sleeper, "--timeout", "10"])
        .unwrap()
        .starts_with("exited"));

    d.client
        .create(
            "apps-own",
            vec!["/bin/sleep".into(), "60".into()],
            None,
            vec![],
            80,
            24,
        )
        .unwrap();
    assert!(d
        .perch(&["kill", "apps-own"])
        .unwrap_err()
        .contains("its app owns it"));
    assert!(d.client.session("apps-own").unwrap().unwrap().alive);
    d.client.kill("apps-own", 15).unwrap();
    assert!(d
        .perch(&["read", "nope"])
        .unwrap_err()
        .contains("no terminal nope"));
}

//! The `perch` command's own behaviour: agent verbs and the daemon aliases. No agent, no daemon.
use perchd::agent_cli::{write_core_file, CoreAddress, CORE_FILE};
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Command, Output};

const TOKEN: &str = "perch_agent_test-token-0123456789";

fn temp(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("perch-cli-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn perch(dir: &std::path::Path, args: &[&str], identity: bool) -> Output {
    let mut command = Command::new(env!("CARGO_BIN_EXE_perch"));
    command
        .args(args)
        .env("PERCHD_DIR", dir)
        .env_remove("PERCH_SESSION")
        .env_remove("PERCH_TOKEN");
    if identity {
        command.env("PERCH_SESSION", "s1").env("PERCH_TOKEN", TOKEN);
    }
    command.output().unwrap()
}

fn text(output: &Output) -> String {
    format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
}

/// A stand-in core that answers one request, and hands back what it was sent.
fn answer_once(body: &'static str) -> (u16, std::thread::JoinHandle<String>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let port = listener.local_addr().unwrap().port();
    let handle = std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        let mut seen = vec![0u8; 8192];
        let n = stream.read(&mut seen).unwrap();
        write!(stream, "HTTP/1.0 200 OK\r\n\r\n{body}").unwrap();
        String::from_utf8_lossy(&seen[..n]).into_owned()
    });
    (port, handle)
}

#[test]
fn guide_is_served_by_the_binary_itself() {
    let dir = temp("guide");
    let output = perch(&dir, &["guide"], false);
    assert!(output.status.success());
    let guide = text(&output);
    assert!(guide.contains("perch whoami") && guide.contains("perch report"));
    assert!(
        guide.contains("never print"),
        "it must tell agents to keep the token private"
    );
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn whoami_without_the_variables_names_them_and_does_not_guess() {
    let dir = temp("novars");
    let output = perch(&dir, &["whoami"], false);
    assert_eq!(output.status.code(), Some(1));
    let message = text(&output);
    assert!(
        message.contains("PERCH_SESSION and PERCH_TOKEN are not set"),
        "{message}"
    );
    assert!(
        message.contains("removed them"),
        "it must say a provider may have scrubbed them"
    );
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn whoami_finds_the_core_through_the_file_on_every_call() {
    let dir = temp("discovery");
    let me = std::process::id();
    for round in 0..2 {
        // A new core on a new port each time, as a desktop launch would be.
        let (port, request) = answer_once(
            r#"{"session":"s1","workspace":"nest","provider":"claude","incarnation":"run-1"}"#,
        );
        write_core_file(
            &dir,
            &CoreAddress {
                pid: me,
                port,
                base_path: "/".into(),
            },
        )
        .unwrap();
        let output = perch(&dir, &["whoami"], true);
        let shown = text(&output);
        assert!(output.status.success(), "round {round}: {shown}");
        assert!(
            shown.contains("session   s1") && shown.contains("provider  claude"),
            "{shown}"
        );
        assert!(!shown.contains(TOKEN), "the token is never printed");
        let request = request.join().unwrap();
        assert!(request.starts_with("POST /agent/whoami HTTP/1.0\r\n"));
        assert!(request.contains(&format!("Authorization: Bearer {TOKEN}\r\n")));
        assert!(request.ends_with(r#"{"session":"s1"}"#), "{request}");
    }
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn a_dead_or_missing_core_is_an_error_not_a_guess() {
    let dir = temp("nocore");
    let missing = perch(&dir, &["whoami"], true);
    assert_eq!(missing.status.code(), Some(1));
    assert!(text(&missing).contains("no running Perch core"));
    write_core_file(
        &dir,
        &CoreAddress {
            pid: 2_147_483_646,
            port: 1,
            base_path: "/".into(),
        },
    )
    .unwrap();
    let dead = perch(&dir, &["whoami"], true);
    assert_eq!(dead.status.code(), Some(1));
    assert!(text(&dead).contains("no longer running"));
    assert!(!text(&dead).contains(TOKEN));
    assert!(
        dir.join(CORE_FILE).exists(),
        "reading never deletes another core's file"
    );
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn report_sends_its_text_and_refuses_empty_or_oversized_ones_locally() {
    let dir = temp("report");
    let (port, request) = answer_once(r#"{"ok":true}"#);
    write_core_file(
        &dir,
        &CoreAddress {
            pid: std::process::id(),
            port,
            base_path: "/".into(),
        },
    )
    .unwrap();
    let output = perch(&dir, &["report", "done", "with", "it"], true);
    assert!(output.status.success(), "{}", text(&output));
    assert!(request
        .join()
        .unwrap()
        .ends_with(r#"{"session":"s1","text":"done with it"}"#));
    let empty = perch(&dir, &["report"], true);
    assert_eq!(empty.status.code(), Some(1));
    assert!(text(&empty).contains("needs text"));
    let long = "x".repeat(perchd::agent_cli::REPORT_MAX_CHARS + 1);
    let too_long = perch(&dir, &["report", &long], true);
    assert_eq!(too_long.status.code(), Some(1));
    assert!(text(&too_long).contains("limited to"));
    let _ = std::fs::remove_dir_all(dir);
}

/// `perch daemon <verb>` is the home of the daemon verbs and the bare verbs still work. Both
/// are connect-only: with no daemon they report nothing and create no directory.
#[test]
fn daemon_verbs_work_under_daemon_and_as_the_old_aliases() {
    let dir = std::env::temp_dir().join(format!("perch-cli-alias-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    let path = dir.to_string_lossy().into_owned();
    for args in [
        vec!["ps", "--json", "--dir", &path],
        vec!["daemon", "ps", "--json", "--dir", &path],
        vec!["list", "--json", "--dir", &path],
        vec!["daemon", "list", "--json", "--dir", &path],
        vec!["cleanup", "--dry-run", "--json", "--dir", &path],
        vec!["daemon", "cleanup", "--dry-run", "--json", "--dir", &path],
    ] {
        let output = perch(&dir, &args, false);
        assert!(output.status.success(), "{args:?}: {}", text(&output));
        assert!(!dir.exists(), "{args:?} must not create state");
    }
    let plain = perch(&dir, &["ps", "--json", "--dir", &path], false);
    let nested = perch(&dir, &["daemon", "ps", "--json", "--dir", &path], false);
    assert_eq!(plain.stdout, nested.stdout);
    let unknown = perch(&dir, &["daemon", "no-such-verb"], false);
    assert_eq!(unknown.status.code(), Some(2));
}

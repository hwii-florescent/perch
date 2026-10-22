//! Desktop permission diagnostics. A foreground check is not proof that a
//! launchd-hosted terminal has the same grants. Verification launches one bounded
//! shell PTY through the real daemon, never touches a user's terminal, and removes
//! only that diagnostic's process and history. No requests for consent happen here.

use perchd::client::Client;
pub use perchd::permissions::allow;
use perchd::permissions::{PermissionSnapshot, PermissionState};
use serde::Serialize;
use std::time::{Duration, Instant};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionReport {
    pub supported: bool,
    pub app: PermissionSnapshot,
    pub daemon: Option<PermissionSnapshot>,
    pub terminal: Option<PermissionSnapshot>,
    pub comparison: Comparison,
    pub note: Option<String>,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Comparison {
    Unknown,
    Match,
    Different,
}

pub fn status() -> PermissionReport {
    let mut report = PermissionReport {
        supported: cfg!(target_os = "macos"),
        app: perchd::permissions::snapshot(),
        daemon: None,
        terminal: None,
        comparison: Comparison::Unknown,
        note: None,
    };
    if !report.supported {
        return report;
    }
    // Do not start a daemon just because Settings or onboarding opened.
    match Client::connect(&perchd::server::socket_path(&crate::daemon::dir()))
        .and_then(|c| c.permission_health())
    {
        Ok(health) => {
            report.daemon = health.permissions;
            if report.daemon.is_none() {
                report.note = Some("The running terminal host predates permission diagnostics. No sessions were restarted. Verify terminals to check a fresh child process.".into());
            }
        }
        Err(_) => report.note = Some("Terminal host unavailable. Verify terminals starts a short diagnostic without changing existing sessions.".into()),
    }
    report
}

pub fn verify() -> Result<PermissionReport, String> {
    let client = crate::daemon::client().map_err(|e| e.to_string())?;
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let terminal = probe(
        &client,
        vec![
            "/bin/sh".into(),
            "-c".into(),
            "exec \"$1\" __perchd permissions".into(),
            "perch-permission-probe".into(),
            exe.display().to_string(),
        ],
        Duration::from_secs(5),
    )?;
    let mut report = status();
    report.comparison = compare(&report.app, &terminal);
    report.terminal = Some(terminal);
    Ok(report)
}

fn compare(app: &PermissionSnapshot, terminal: &PermissionSnapshot) -> Comparison {
    let mut unknown = app.checks.is_empty() || app.checks.len() != terminal.checks.len();
    for check in &app.checks {
        let Some(other) = terminal.checks.iter().find(|c| c.id == check.id) else {
            unknown = true;
            continue;
        };
        if check.state == PermissionState::Unknown || other.state == PermissionState::Unknown {
            unknown = true;
        } else if check.state != other.state {
            return Comparison::Different;
        }
    }
    if unknown {
        Comparison::Unknown
    } else {
        Comparison::Match
    }
}

fn parse_probe(text: &str) -> Result<PermissionSnapshot, String> {
    let json = text
        .split_once("PERCH_PERMISSIONS_BEGIN")
        .and_then(|(_, rest)| rest.split_once("PERCH_PERMISSIONS_END"))
        .map(|(json, _)| json.trim())
        .ok_or("Terminal permission probe returned no complete result")?;
    serde_json::from_str(json).map_err(|e| format!("Invalid terminal permission result: {e}"))
}

struct ProbeGuard<'a> {
    client: &'a Client,
    id: String,
}

impl Drop for ProbeGuard<'_> {
    fn drop(&mut self) {
        // A failed check must never leave a live diagnostic or retained history.
        // Only our unique id is ever signalled or removed.
        if self
            .client
            .session(&self.id)
            .ok()
            .flatten()
            .is_some_and(|s| s.alive)
        {
            let _ = self.client.kill(&self.id, libc::SIGKILL);
        }
        let deadline = Instant::now() + Duration::from_secs(2);
        while self
            .client
            .session(&self.id)
            .ok()
            .flatten()
            .is_some_and(|s| s.alive)
            && Instant::now() < deadline
        {
            std::thread::sleep(Duration::from_millis(20));
        }
        if let Err(error) = self.client.remove(&self.id) {
            tracing::warn!(
                "Could not clean up permission diagnostic {}: {error}",
                self.id
            );
        }
    }
}

fn probe(
    client: &Client,
    argv: Vec<String>,
    timeout: Duration,
) -> Result<PermissionSnapshot, String> {
    let id = format!("permission-probe-{}", uuid::Uuid::new_v4());
    let _guard = ProbeGuard {
        client,
        id: id.clone(),
    };
    // ponytail: the six fixed, pretty-printed checks fit this screen; a larger
    // diagnostic payload should use bounded stream capture instead.
    client
        .create(&id, argv, Some("/".into()), vec![], 240, 160)
        .map_err(|e| e.to_string())?;
    let deadline = Instant::now() + timeout;
    loop {
        let session = client
            .session(&id)
            .map_err(|e| e.to_string())?
            .ok_or("Permission diagnostic disappeared")?;
        if !session.alive {
            if session.exit_code != Some(0) {
                return Err(
                    "Terminal permission diagnostic failed; no existing sessions were changed"
                        .into(),
                );
            }
            return parse_probe(&client.snapshot(&id).map_err(|e| e.to_string())?.text);
        }
        if Instant::now() >= deadline {
            return Err("Terminal permission diagnostic timed out; cleanup was requested for its process only".into());
        }
        std::thread::sleep(Duration::from_millis(30));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use perchd::permissions::PermissionCheck;

    fn sample(state: PermissionState) -> PermissionSnapshot {
        PermissionSnapshot {
            pid: 1,
            checks: vec![PermissionCheck {
                id: "accessibility".into(),
                title: "Accessibility".into(),
                description: String::new(),
                state,
            }],
        }
    }

    #[test]
    fn matching_denials_are_not_misreported_as_grants_and_unknown_is_not_a_match() {
        let denied = sample(PermissionState::NotGranted);
        assert_eq!(compare(&denied, &denied), Comparison::Match);
        assert_eq!(
            compare(&denied, &sample(PermissionState::Granted)),
            Comparison::Different
        );
        assert_eq!(
            compare(&denied, &sample(PermissionState::Unknown)),
            Comparison::Unknown
        );
        assert!(parse_probe("incomplete").is_err());
    }

    #[test]
    fn real_daemon_pty_probe_cleans_up_success_failure_and_timeout() {
        // daemon::client uses a process-isolated in-thread daemon under cfg(test).
        let client = crate::daemon::client().unwrap();
        let sentinel = format!("permission-sentinel-{}", uuid::Uuid::new_v4());
        client
            .create(
                &sentinel,
                vec!["/bin/sh".into(), "-c".into(), "sleep 30".into()],
                Some("/".into()),
                vec![],
                80,
                24,
            )
            .unwrap();
        let _sentinel_guard = ProbeGuard {
            client: &client,
            id: sentinel.clone(),
        };
        let json = serde_json::to_string_pretty(&sample(PermissionState::NotGranted)).unwrap();
        let output = format!("noise\nPERCH_PERMISSIONS_BEGIN\n{json}\nPERCH_PERMISSIONS_END\n");
        let result = probe(
            &client,
            vec![
                "/bin/sh".into(),
                "-c".into(),
                "printf '%s' \"$1\"".into(),
                "probe".into(),
                output,
            ],
            Duration::from_secs(2),
        )
        .unwrap();
        assert_eq!(result.checks[0].state, PermissionState::NotGranted);
        assert!(probe(
            &client,
            vec!["/bin/sh".into(), "-c".into(), "exit 1".into()],
            Duration::from_secs(2)
        )
        .is_err());
        assert!(probe(
            &client,
            vec!["/bin/sh".into(), "-c".into(), "sleep 30".into()],
            Duration::from_millis(50)
        )
        .is_err());
        let untouched = client.session(&sentinel).unwrap().unwrap();
        assert!(untouched.alive);
        assert_eq!((untouched.cols, untouched.rows), (80, 24));
        assert!(!client
            .list()
            .unwrap()
            .iter()
            .any(|s| s.id.starts_with("permission-probe-")));
    }
}

//! Connect-only session inspection and released-runtime cleanup. No GUI/core boot,
//! process-name sweeps, implicit release, or daemon auto-start.

use crate::client::{Client, Error};
use crate::proto::{Retention, SessionInfo, RELEASED_CLEANUP_CAPABILITY};
use std::io::{self, IsTerminal, Write};
use std::path::PathBuf;

pub fn run(command: &str, args: &[String]) -> Result<(), String> {
    let mut dir = crate::server::default_dir();
    let mut explicit_dir = false;
    let mut dry_run = false;
    let mut yes = false;
    let mut json = false;
    let mut owner = None;
    let mut reason = None;
    let mut rest = args.iter();
    while let Some(arg) = rest.next() {
        match arg.as_str() {
            "--dir" | "--daemon-dir" => {
                dir = PathBuf::from(rest.next().ok_or("missing daemon directory")?);
                explicit_dir = true;
            }
            "--dry-run" if command == "cleanup" => dry_run = true,
            "--yes" if command == "cleanup" => yes = true,
            "--json" => json = true,
            "--owner" if command == "release" => {
                owner = Some(rest.next().ok_or("missing owner")?.as_str())
            }
            "--reason" if command == "release" => {
                reason = Some(rest.next().ok_or("missing reason")?.as_str())
            }
            _ => return Err(format!("unknown option {arg:?}")),
        }
    }
    if dry_run && yes {
        return Err("--dry-run and --yes are mutually exclusive".into());
    }
    // Release is an owner lifecycle operation for private fixtures, not a way
    // for the public cleanup command to declare an arbitrary session orphaned.
    if command == "release" {
        if !explicit_dir || owner.is_none() || reason.is_none() {
            return Err("release requires --dir, --owner and --reason".into());
        }
        if let (Ok(selected), Ok(default)) = (
            dir.canonicalize(),
            crate::server::default_dir().canonicalize(),
        ) {
            if selected == default {
                return Err(
                    "release refuses the default daemon; use a private fixture directory".into(),
                );
            }
        }
    }
    let client = match Client::connect(&crate::server::socket_path(&dir)) {
        Ok(client) => client,
        Err(Error::Io(error)) if error.kind() == io::ErrorKind::NotFound => {
            if json {
                println!(
                    "{}",
                    if command == "ps" || command == "list" {
                        "[]"
                    } else {
                        "{\"candidates\":[],\"stopped\":[]}"
                    }
                );
            } else {
                println!("No daemon socket; nothing was started or stopped.");
            }
            return Ok(());
        }
        Err(error) => return Err(error.to_string()),
    };
    let mut sessions = client.list().map_err(|e| e.to_string())?;
    sessions.sort_by(|a, b| a.id.cmp(&b.id));
    if command == "ps" || command == "list" {
        if json {
            println!("{}", serde_json::to_string(&sessions).unwrap());
        } else {
            for session in &sessions {
                print_session(session);
            }
        }
        return Ok(());
    }
    if !client
        .health()
        .map_err(|e| e.to_string())?
        .capabilities
        .iter()
        .any(|cap| cap == RELEASED_CLEANUP_CAPABILITY)
    {
        return Err("daemon lacks released-only cleanup support; no processes were stopped. Upgrade the daemon during a planned session shutdown, not by restarting it now".into());
    }
    if command == "release" {
        let owner = owner.unwrap();
        let live: Vec<_> = sessions.iter().filter(|session| session.alive).collect();
        if live
            .iter()
            .any(|session| session.cleanup.owner.as_deref() != Some(owner))
        {
            return Err(
                "fixture contains unowned or differently owned runtimes; refusing release".into(),
            );
        }
        for session in &live {
            client
                .release(session, owner, reason.unwrap())
                .map_err(|e| e.to_string())?;
        }
        println!("{}", serde_json::json!({ "released": live.len() }));
        return Ok(());
    }
    // Never let a cleanup command terminate the terminal from which it runs.
    // SAFETY: getsid(0) queries this process's own session.
    let caller_session = unsafe { libc::getsid(0) };
    if caller_session < 0 {
        return Err("cannot establish caller terminal identity".into());
    }
    let candidates: Vec<_> = sessions
        .into_iter()
        .filter(|session| session.cleanup_candidate() && session.pid != Some(caller_session as u32))
        .collect();
    if !json {
        for session in &candidates {
            print_session(session);
        }
        println!(
            "{} explicitly released runtime(s); retained and unknown sessions are protected.",
            candidates.len()
        );
    }
    if dry_run || candidates.is_empty() {
        if json {
            println!(
                "{}",
                serde_json::json!({ "candidates": candidates, "stopped": [] })
            );
        }
        return Ok(());
    }
    if !yes {
        if json {
            return Err("--json cleanup requires --dry-run or explicit --yes".into());
        }
        if !io::stdin().is_terminal() {
            return Err("preview only: use --dry-run or explicitly confirm with --yes".into());
        }
        eprint!("Stop these released runtimes, retaining history? [y/N] ");
        io::stderr().flush().map_err(|e| e.to_string())?;
        let mut answer = String::new();
        io::stdin()
            .read_line(&mut answer)
            .map_err(|e| e.to_string())?;
        if !matches!(answer.trim(), "y" | "Y" | "yes") {
            if json {
                println!(
                    "{}",
                    serde_json::json!({ "candidates": candidates, "stopped": [] })
                );
            }
            return Ok(());
        }
    }
    let mut stopped = Vec::new();
    for session in &candidates {
        // Never rediscover/re-release after a race: fail with the original preview.
        client.cleanup(session).map_err(|error| {
            format!("{}: {error}; cleanup halted, history retained", session.id)
        })?;
        stopped.push(&session.id);
    }
    if json {
        println!(
            "{}",
            serde_json::json!({ "candidates": candidates, "stopped": stopped })
        );
    } else {
        println!("Confirmed {} stopped process group(s). History retained. Detached processes are not swept.", stopped.len());
    }
    Ok(())
}

fn print_session(session: &SessionInfo) {
    let retention = match session.cleanup.retention {
        Retention::Unknown => "unknown/protected",
        Retention::Retained => "retained/protected",
        Retention::Released => "released",
    };
    // Debug escaping prevents terminal output/control injection from argv/cwd/reasons.
    println!(
        "{:?}\tpid={}\t{}\t{}\tprogram={:?}\tcwd={:?}\treason={:?}",
        session.id,
        session.pid.map_or("?".into(), |pid| pid.to_string()),
        if session.alive { "alive" } else { "exited" },
        retention,
        session.argv.first(),
        session.cwd,
        session.cleanup.reason
    );
}

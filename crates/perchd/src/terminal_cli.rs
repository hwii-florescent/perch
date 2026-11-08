//! The terminal verbs of `perch daemon` (herdr-core's `hc read|send|run|wait|kill`): drive the
//! daemon's terminals from any program, with no core, window or agent identity. Connect-only,
//! like `cleanup_cli`: a missing daemon is an error, never a start. `kill` stops only terminals
//! `run` made (owner [`CLI_OWNER`]); every other terminal belongs to its app and is left alone.

use crate::client::Client;
use crate::proto::CLEANUP_OWNER_ENV;
use std::path::PathBuf;
use std::time::{Duration, Instant};

const CLI_OWNER: &str = "perch-cli";

/// The last `lines` lines of a screen, without the empty rows under the last output.
fn last_lines(text: &str, lines: usize) -> String {
    let all: Vec<&str> = text.trim_end().lines().collect();
    all[all.len().saturating_sub(lines.max(1))..].join("\n")
}

pub fn run(command: &str, args: &[String]) -> Result<(), String> {
    let mut dir = crate::server::default_dir();
    let (mut json, mut enter, mut lines) = (false, false, 50usize);
    let (mut timeout, mut quiet, mut cwd) = (None::<u64>, None::<u64>, None::<String>);
    let mut words: Vec<&String> = vec![];
    let mut rest = args.iter();
    while let Some(arg) = rest.next() {
        let mut value = |name: &str| rest.next().ok_or(format!("missing {name}"));
        match arg.as_str() {
            "--" if command == "run" => {
                words.extend(rest.by_ref());
                break;
            }
            "--dir" | "--daemon-dir" => dir = PathBuf::from(value("directory")?),
            "--json" => json = true,
            "--enter" if command == "send" => enter = true,
            "--lines" if command == "read" => {
                lines = value("count")?.parse().map_err(|_| "--lines is a number")?
            }
            "--timeout" if command == "wait" => {
                timeout = Some(
                    value("seconds")?
                        .parse()
                        .map_err(|_| "--timeout is seconds")?,
                )
            }
            "--quiet" if command == "wait" => {
                quiet = Some(
                    value("seconds")?
                        .parse()
                        .map_err(|_| "--quiet is seconds")?,
                )
            }
            "--cwd" if command == "run" => cwd = Some(value("folder")?.clone()),
            _ if command == "send" || !arg.starts_with("--") => words.push(arg),
            _ => return Err(format!("unknown option {arg:?}")),
        }
    }
    let client = Client::connect(&crate::server::socket_path(&dir))
        .map_err(|e| format!("no daemon at {}: {e}", dir.display()))?;
    if command == "run" {
        if words.is_empty() {
            return Err(
                "run needs a program: perch daemon run [--cwd dir] -- <program> [args]".into(),
            );
        }
        let mut random = [0u8; 8];
        std::io::Read::read_exact(
            &mut std::fs::File::open("/dev/urandom").map_err(|e| e.to_string())?,
            &mut random,
        )
        .map_err(|e| e.to_string())?;
        let id = format!(
            "cli-{}",
            random
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect::<String>()
        );
        let cwd = cwd.or_else(|| {
            std::env::current_dir()
                .ok()
                .map(|d| d.display().to_string())
        });
        let env = vec![(CLEANUP_OWNER_ENV.to_string(), CLI_OWNER.to_string())];
        client
            .create(
                &id,
                words.iter().map(|w| w.to_string()).collect(),
                cwd,
                env,
                120,
                40,
            )
            .map_err(|e| e.to_string())?;
        println!(
            "{}",
            if json {
                serde_json::json!({ "id": id }).to_string()
            } else {
                id
            }
        );
        return Ok(());
    }
    let id = words
        .first()
        .ok_or_else(|| format!("{command} needs a terminal id (see `perch daemon ls`)"))?
        .as_str();
    let session = client
        .session(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("no terminal {id}"))?;
    match command {
        "read" => {
            let snapshot = client.snapshot(id).map_err(|e| e.to_string())?;
            let text = last_lines(&snapshot.text, lines);
            println!(
                "{}",
                if json {
                    serde_json::json!({ "id": id, "text": text, "title": snapshot.title, "alive": session.alive }).to_string()
                } else {
                    text
                }
            );
        }
        "send" => {
            if !session.alive {
                return Err(format!("terminal {id} has exited"));
            }
            let mut text = words[1..]
                .iter()
                .map(|w| w.as_str())
                .collect::<Vec<_>>()
                .join(" ");
            if enter {
                text.push('\r');
            }
            client
                .input(id, text.as_bytes())
                .map_err(|e| e.to_string())?;
        }
        "wait" => {
            let deadline = timeout.map(|s| Instant::now() + Duration::from_secs(s));
            let (mut seq, mut since) = (session.seq, Instant::now());
            loop {
                let now = client
                    .session(id)
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| format!("terminal {id} is gone"))?;
                if !now.alive {
                    println!(
                        "{}",
                        if json {
                            serde_json::json!({ "id": id, "exit_code": now.exit_code }).to_string()
                        } else {
                            format!(
                                "exited {}",
                                now.exit_code.map_or("?".into(), |c| c.to_string())
                            )
                        }
                    );
                    return Ok(());
                }
                if now.seq != seq {
                    (seq, since) = (now.seq, Instant::now());
                }
                if quiet.is_some_and(|s| since.elapsed() >= Duration::from_secs(s)) {
                    println!(
                        "{}",
                        if json {
                            serde_json::json!({ "id": id, "quiet": true }).to_string()
                        } else {
                            "quiet".to_string()
                        }
                    );
                    return Ok(());
                }
                if deadline.is_some_and(|d| Instant::now() >= d) {
                    return Err(format!(
                        "terminal {id} still running after {}s",
                        timeout.unwrap()
                    ));
                }
                std::thread::sleep(Duration::from_millis(150));
            }
        }
        "kill" => {
            if session.cleanup.owner.as_deref() != Some(CLI_OWNER) {
                return Err(format!("terminal {id} is not one `perch daemon run` started; its app owns it, so it is left running"));
            }
            client.kill(id, libc::SIGTERM).map_err(|e| e.to_string())?;
        }
        _ => unreachable!("cli_main routes only terminal verbs here"),
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::last_lines;

    #[test]
    fn the_empty_rows_under_the_output_are_not_lines() {
        assert_eq!(last_lines("a\nb\nc\n\n\n", 2), "b\nc");
        assert_eq!(last_lines("a\nb", 50), "a\nb");
        assert_eq!(last_lines("\n\n", 5), "");
    }
}

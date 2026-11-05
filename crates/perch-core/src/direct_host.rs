//! Direct-host CLI helpers for `mode: "direct"` hosts.
//!
//! A direct host is a machine with **no perch on it** — only the agent CLIs and
//! `tmux`. perch attaches a local pty to a tmux session over `ssh`, so the TUI
//! survives the laptop sleeping, and browses the remote file tree over `ssh`.
//! There is no Perch-run turn loop here: the agent is always the real CLI.

use crate::protocol::{AgentKind, FsEntry};
use crate::ssh;

/// argv for a CLI-mode attach to a session on a direct host.
///
/// The local pty's child is `ssh -tt`, and the remote command is a
/// `tmux new-session -A` (attach-or-create, the same idempotent trick the hub
/// uses for `perch-core`), so the TUI survives the laptop sleeping and a
/// reattach re-renders from tmux's own screen buffer — no perch-side replay.
/// `terminal.resize` on the local pty propagates through ssh's `SIGWINCH`
/// automatically, so `terminal.rs` needs no changes at all.
///
/// Two perch clients attaching the same session share one tmux window (tmux
/// mirrors input as well as output). That is a deliberate accepted behaviour,
/// matching what `tmux attach` does everywhere else.
///
/// Rides the same shared control master as every other operation on this
/// host (`ssh::mux_opts`) — an attach right after a browse/probe/launch
/// skips the handshake entirely. Unlike the tail path this has no automatic
/// no-mux fallback if the master's `MaxSessions` cap is saturated: it is a
/// one-shot, user-triggered action (not a retry loop), so a failure here
/// just surfaces ssh's own error text in the terminal, which the user can
/// read and retry.
pub fn cli_attach_argv(
    ssh_host: &str,
    session_id: &str,
    cwd: &str,
    agent: AgentKind,
    provider_id: Option<&str>,
) -> Vec<String> {
    let q = ssh::shell_quote;
    let cli = match agent {
        AgentKind::Claude => {
            let mut s = String::from("exec claude");
            if let Some(id) = provider_id {
                s.push_str(&format!(" --resume {}", q(id)));
            }
            s
        }
        AgentKind::Codex => match provider_id {
            Some(id) => format!("exec codex resume {}", q(id)),
            None => "exec codex".to_string(),
        },
    };
    let inner = format!("{} cd {} || exit 1; {cli}", ssh::REMOTE_PATH_PREFIX, q(cwd));
    let tmux = format!(
        "tmux new-session -A -s {} {}",
        q(&format!("perch-cli-{session_id}")),
        q(&inner)
    );
    let mut argv = vec![
        "ssh".to_string(),
        "-tt".to_string(),
        "-o".to_string(),
        "BatchMode=yes".to_string(),
        "-o".to_string(),
        "ServerAliveInterval=15".to_string(),
    ];
    argv.extend(ssh::mux_opts());
    argv.push(ssh_host.to_string());
    argv.push(tmux);
    argv
}

/// Kill the CLI-mode tmux session for `session_id` on a direct host —
/// the remote counterpart of `TerminalManager::kill`, wired into the
/// session-delete teardown path.
pub async fn kill_cli_session(ssh_host: &str, session_id: &str) {
    let cmd = format!(
        "tmux kill-session -t {} 2>/dev/null; true",
        ssh::shell_quote(&format!("perch-cli-{session_id}"))
    );
    let _ = ssh::run_remote(ssh_host, &cmd, 20, "cli cleanup").await;
}

// ---------------------------------------------------------------------------
// Remote directory browsing (fs.browse for direct hosts)
// ---------------------------------------------------------------------------

/// `fs.browse` over ssh: one round trip listing the directories under `path`
/// (plus whether each is a git checkout), matching the local implementation's
/// contract exactly — hidden entries skipped, files skipped, never hard-fails
/// (an unreadable path falls back to `$HOME`).
///
/// Returns `(resolved_path, parent, home, entries)`.
pub async fn browse_remote(
    ssh_host: &str,
    path: Option<&str>,
    timeout_secs: u64,
) -> Result<(String, Option<String>, String, Vec<FsEntry>), String> {
    let target = match path {
        Some(p) if !p.is_empty() => ssh::shell_quote(p),
        _ => "\"$HOME\"".to_string(),
    };
    // `-maxdepth 1 -mindepth 1 -type d` is one syscall pass; the `.git` probe
    // is bounded to the entries actually listed, never recursive.
    let script = format!(
        r#"echo "$HOME"; d={target}; if [ ! -d "$d" ]; then d="$HOME"; fi; \
           cd "$d" || exit 1; p=$(pwd -P); echo "$p"; \
           for e in */; do e=${{e%/}}; case "$e" in '*') continue;; .*) continue;; esac; \
           if [ -e "$p/$e/.git" ]; then echo "G $e"; else echo "D $e"; fi; done"#
    );
    let out = ssh::run_remote(ssh_host, &script, timeout_secs, "browse").await?;
    let mut lines = out.lines();
    let home = lines.next().unwrap_or("").trim().to_string();
    let resolved = lines.next().unwrap_or("").trim().to_string();
    if resolved.is_empty() {
        return Err("remote browse returned no path".to_string());
    }
    let mut entries: Vec<FsEntry> = lines
        .filter_map(|l| {
            let (flag, name) = l.split_once(' ')?;
            let name = name.trim();
            if name.is_empty() {
                return None;
            }
            let base = resolved.trim_end_matches('/');
            Some(FsEntry {
                name: name.to_string(),
                path: format!("{base}/{name}"),
                is_git_repo: flag == "G",
            })
        })
        .collect();
    entries.sort_by(|a, b| a.name.cmp(&b.name));
    let parent = std::path::Path::new(&resolved)
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .map(|p| p.to_string_lossy().to_string());
    Ok((resolved, parent, home, entries))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cli_attach_goes_through_tmux_attach_or_create() {
        let argv = cli_attach_argv("pod", "sess-1", "/tmp/w", AgentKind::Claude, Some("cs-1"));
        assert_eq!(argv[0], "ssh");
        assert!(argv.contains(&"-tt".to_string()));
        let remote = argv.last().unwrap();
        assert!(remote.starts_with("tmux new-session -A -s 'perch-cli-sess-1'"));
        // The tmux command argument is itself single-quoted, so every quote
        // inside it is escaped POSIX-style (`'` → `'\''`). Assert on the
        // unescaped form to keep the test readable.
        let unescaped = remote.replace(r"'\''", "'");
        assert!(unescaped.contains("--resume 'cs-1'"), "{unescaped}");
        assert!(unescaped.contains("cd '/tmp/w'"), "{unescaped}");
        assert!(unescaped.contains("exec claude"), "{unescaped}");
    }
}

//! Bounded `ssh` subprocess plumbing shared by the two remote host modes.
//!
//! perch talks to remote machines in exactly one way: by spawning the **`ssh`
//! CLI** (never an ssh library crate — the CLI is what carries the corporate SSH
//! integration, `ProxyCommand` wrappers and the user's own `~/.ssh/config`).
//! Both host modes lean on this module:
//!
//! * `mode: "perch"` (`hub.rs`) — federation to a full perch install on the
//!   remote, over an `ssh -A -L` tunnel.
//! * `mode: "direct"` (`detached.rs`) — **no perch on the remote at all**,
//!   just `claude`/`codex` + `tmux`. Every operation is a bounded `ssh`
//!   invocation from here.
//!
//! Everything is bounded. [`run_ssh_bounded`] wraps each child in an overall
//! `tokio::time::timeout` on top of whatever `-o ConnectTimeout=` was passed,
//! because devpod `ProxyCommand` wrappers routinely stall well past TCP
//! connect and a hung ssh child must never wedge a state machine. It was
//! originally private to `hub.rs`; it lives here now so the direct path shares
//! one implementation rather than growing a second, subtly different one.

use std::process::Stdio;

use tokio::io::AsyncWriteExt;

/// Prepended to `PATH` for every remote command perch runs.
///
/// `claude` and `codex` install to `~/.local/bin`, which is on a *login*
/// shell's PATH but not on the PATH of a non-interactive `ssh host '<cmd>'`
/// (which is how every call in this module runs). Rather than pay for a
/// `$SHELL -l -i` wrapper per call — slow, and noisy with MOTD/rc output that
/// then has to be filtered back out — perch prefixes the two directories it
/// actually needs. This mirrors `boot.rs`, which does the same for locally
/// spawned CLIs under minimal-PATH launches (tmux, launchd, Tauri).
pub const REMOTE_PATH_PREFIX: &str = r#"export PATH="$HOME/.local/bin:$HOME/bin:$PATH";"#;

/// Standard options for every non-interactive ssh perch runs: never prompt
/// (a password prompt would hang the bounded child until its timeout), and
/// give up on TCP connect quickly.
fn base_args(ssh_host: &str) -> Vec<String> {
    vec![
        "-o".into(),
        "BatchMode=yes".into(),
        "-o".into(),
        "ConnectTimeout=5".into(),
        ssh_host.into(),
    ]
}

/// Run an `ssh <args>` subprocess bounded by an overall `timeout_secs`, on top
/// of whatever `-o ConnectTimeout=` the caller passed in `args`. Devpod
/// `ProxyCommand` wrappers can stall well past normal TCP connect, so relying
/// on `ConnectTimeout` alone isn't enough — this is the backstop that
/// guarantees a connection state machine never wedges on a hung ssh child.
///
/// On timeout the child is killed (`kill_on_drop`) and `Err("ssh timed out
/// (<phase>)")` is returned; `phase` is a short label folded into both this
/// and the spawn-failure error message so logs/UI show which step stalled.
pub async fn run_ssh_bounded(
    args: &[&str],
    timeout_secs: u64,
    phase: &str,
) -> Result<std::process::Output, String> {
    let mut cmd = tokio::process::Command::new("ssh");
    cmd.args(args);
    cmd.kill_on_drop(true);
    match tokio::time::timeout(std::time::Duration::from_secs(timeout_secs), cmd.output()).await {
        Ok(Ok(out)) => Ok(out),
        Ok(Err(e)) => Err(format!("ssh failed ({phase}): {e}")),
        Err(_) => Err(format!("ssh timed out ({phase})")),
    }
}

/// Run one shell command on `ssh_host` with perch's standard options and the
/// remote PATH prefix applied, bounded by `timeout_secs`. Returns the trimmed
/// stdout on success; on a non-zero exit the (trimmed, truncated) stderr is
/// folded into the error so callers can surface something actionable.
pub async fn run_remote(
    ssh_host: &str,
    command: &str,
    timeout_secs: u64,
    phase: &str,
) -> Result<String, String> {
    let full = format!("{REMOTE_PATH_PREFIX} {command}");
    let mut owned = base_args(ssh_host);
    owned.push(full);
    let args: Vec<&str> = owned.iter().map(String::as_str).collect();
    let out = run_ssh_bounded(&args, timeout_secs, phase).await?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        let err: String = String::from_utf8_lossy(&out.stderr)
            .trim()
            .chars()
            .take(400)
            .collect();
        let code = out.status.code().unwrap_or(-1);
        if err.is_empty() {
            Err(format!("remote command failed ({phase}, exit {code})"))
        } else {
            Err(format!("remote command failed ({phase}, exit {code}): {err}"))
        }
    }
}

/// Write `content` to `path` on the remote, creating parent directories.
///
/// The payload goes over ssh **stdin** rather than being interpolated into the
/// command line: prompts contain arbitrary user text (quotes, `$`, backticks,
/// newlines, megabytes of it) and shell-quoting that into an argv is both a
/// correctness and an injection hazard. `cat > file` sidesteps quoting
/// entirely.
pub async fn write_remote_file(
    ssh_host: &str,
    path: &str,
    content: &str,
    timeout_secs: u64,
) -> Result<(), String> {
    let dir = path.rsplit_once('/').map(|(d, _)| d).unwrap_or(".");
    let command = format!(
        "mkdir -p {} && cat > {}",
        shell_quote(dir),
        shell_quote(path)
    );
    let mut owned = base_args(ssh_host);
    owned.push(command);

    let mut cmd = tokio::process::Command::new("ssh");
    cmd.args(&owned)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("ssh failed (write {path}): {e}"))?;
    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(content.as_bytes()).await;
        let _ = stdin.shutdown().await;
    }
    let out = match tokio::time::timeout(
        std::time::Duration::from_secs(timeout_secs),
        child.wait_with_output(),
    )
    .await
    {
        Ok(Ok(out)) => out,
        Ok(Err(e)) => return Err(format!("ssh failed (write {path}): {e}")),
        Err(_) => return Err(format!("ssh timed out (write {path})")),
    };
    if out.status.success() {
        Ok(())
    } else {
        let err: String = String::from_utf8_lossy(&out.stderr).trim().chars().take(300).collect();
        Err(format!("failed writing {path}: {err}"))
    }
}

/// Single-quote `s` for safe interpolation into a remote `sh -c` command line.
/// (`'` is closed, escaped, and reopened — the standard POSIX trick.)
pub fn shell_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', r"'\''"))
}

// ---------------------------------------------------------------------------
// Prereq / version probe
// ---------------------------------------------------------------------------

/// What a direct-mode host actually offers, gathered in **one** ssh round trip
/// (probes are cheap individually but the round trip is not — on a devpod each
/// `ssh` costs ~1-2s through the ProxyCommand wrapper).
///
/// Recording the CLI versions here is deliberate: detached mode is coupled to
/// the remote `claude`/`codex` stream-json schema and flag set, so the header
/// line of every run log carries the version that produced it (prior-art
/// convention B8 — "record `claude --version` per host in the log header").
#[derive(Debug, Clone, Default)]
pub struct HostPrereqs {
    pub hostname: String,
    pub platform: String,
    pub claude_version: Option<String>,
    pub codex_version: Option<String>,
    pub tmux_version: Option<String>,
    pub home: String,
}

impl HostPrereqs {
    /// Direct mode needs tmux plus at least one of the two agent CLIs.
    /// Missing pieces are reported as one actionable sentence.
    pub fn missing(&self) -> Option<String> {
        let mut missing: Vec<&str> = Vec::new();
        if self.tmux_version.is_none() {
            missing.push("tmux");
        }
        if self.claude_version.is_none() && self.codex_version.is_none() {
            missing.push("claude or codex");
        }
        if missing.is_empty() {
            None
        } else {
            Some(format!(
                "direct host is missing {} (install on the remote and re-enable)",
                missing.join(" + ")
            ))
        }
    }
}

/// One-round-trip prerequisite + identity probe for a direct-mode host.
///
/// Deliberately does *not* probe model lists: per `models.rs`'s philosophy the
/// catalogue is static and not version-gated or probed per host.
pub async fn probe_host(ssh_host: &str) -> Result<HostPrereqs, String> {
    // Each field on its own line, in a fixed order, with an empty line for
    // anything absent — parsed positionally below so a chatty MOTD prepended
    // by the remote shell can't be mistaken for data (we scan for the sentinel).
    let script = concat!(
        r#"echo '__PERCH_PROBE__';"#,
        r#"hostname; uname -s; echo "$HOME";"#,
        r#"(command -v claude >/dev/null 2>&1 && claude --version 2>/dev/null | head -1) || echo;"#,
        r#"(command -v codex  >/dev/null 2>&1 && codex  --version 2>/dev/null | head -1) || echo;"#,
        r#"(command -v tmux   >/dev/null 2>&1 && tmux -V 2>/dev/null | head -1) || echo;"#,
    );
    let stdout = run_remote(ssh_host, script, 30, "prereq probe").await?;
    let all: Vec<&str> = stdout.lines().collect();
    let start = all
        .iter()
        .position(|l| l.trim() == "__PERCH_PROBE__")
        .map(|i| i + 1)
        .ok_or_else(|| "prereq probe produced no output".to_string())?;
    let field = |i: usize| all.get(start + i).map(|s| s.trim().to_string()).unwrap_or_default();
    let opt = |i: usize| {
        let v = field(i);
        if v.is_empty() {
            None
        } else {
            Some(v)
        }
    };
    Ok(HostPrereqs {
        hostname: field(0),
        platform: field(1),
        home: field(2),
        claude_version: opt(3),
        codex_version: opt(4),
        tmux_version: opt(5),
    })
}

// ---------------------------------------------------------------------------
// Remote file tail primitive
// ---------------------------------------------------------------------------

/// Identity + size of a remote file, the other half of a tail cursor.
///
/// A bare byte offset is **never** a valid cursor (log-shipper convention, see
/// Filebeat's registry entries): inode reuse after a rotation would resume you
/// into the middle of a different file, and truncation would leave you reading
/// past the end forever. [`TailCursor`] pairs the offset with these.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct RemoteFileId {
    pub inode: u64,
    pub size: u64,
}

/// `stat` a remote file. `Ok(None)` means the file does not exist (yet) — an
/// expected state while a just-launched turn is still starting up, not an
/// error. Uses BSD `stat -f` as a fallback so a macOS remote works too.
pub async fn stat_remote_file(ssh_host: &str, path: &str) -> Result<Option<RemoteFileId>, String> {
    let q = shell_quote(path);
    let cmd = format!(
        "if [ -f {q} ]; then stat -c '%i %s' {q} 2>/dev/null || stat -f '%i %z' {q}; else echo MISSING; fi"
    );
    let out = run_remote(ssh_host, &cmd, 20, "stat").await?;
    let line = out.lines().last().unwrap_or("").trim();
    if line == "MISSING" || line.is_empty() {
        return Ok(None);
    }
    let mut parts = line.split_whitespace();
    let inode = parts.next().and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
    let size = parts.next().and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
    Ok(Some(RemoteFileId { inode, size }))
}

/// A resumable position in a remote append-only log.
///
/// `offset` is a byte count from the start of the file; `file` is the identity
/// it was taken against. [`TailCursor::validate`] re-`stat`s and decides
/// whether the offset is still meaningful.
#[derive(Debug, Clone, Copy, Default)]
pub struct TailCursor {
    pub offset: u64,
    pub file: RemoteFileId,
}

/// What [`TailCursor::validate`] decided.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TailResume {
    /// File is missing — nothing to read yet.
    Missing,
    /// Resume at `offset`.
    Resume(u64),
    /// The file was truncated or replaced (`offset > size`, or the inode
    /// changed): restart from byte 0 and let the consumer de-duplicate.
    /// Filebeat's rule, imported wholesale.
    Restart,
}

impl TailCursor {
    pub async fn validate(&self, ssh_host: &str, path: &str) -> Result<TailResume, String> {
        let Some(current) = stat_remote_file(ssh_host, path).await? else {
            return Ok(TailResume::Missing);
        };
        if self.offset > current.size {
            return Ok(TailResume::Restart); // truncated
        }
        if self.file.inode != 0 && current.inode != self.file.inode {
            return Ok(TailResume::Restart); // rotated / replaced
        }
        Ok(TailResume::Resume(self.offset))
    }
}

/// Build the remote command that follows `path` from byte `offset`.
///
/// `tail -c +N` is 1-based (`+1` == start of file), and `-F` (rather than
/// `-f`) keeps following across a re-create, which matters because a run
/// directory can be recreated by a retry. The command is used as the argument
/// to a long-lived `ssh` child whose stdout perch streams.
pub fn tail_command(path: &str, offset: u64) -> String {
    format!("tail -c +{} -F {}", offset + 1, shell_quote(path))
}

/// Spawn the long-lived tail child. Keepalives are set so a dead network is
/// noticed in ~1 minute rather than hanging forever — the caller then
/// re-validates its cursor and re-tails.
pub fn spawn_tail(ssh_host: &str, path: &str, offset: u64) -> std::io::Result<tokio::process::Child> {
    let command = format!("{REMOTE_PATH_PREFIX} {}", tail_command(path, offset));
    let mut cmd = tokio::process::Command::new("ssh");
    cmd.args([
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=5",
        "-o",
        "ServerAliveInterval=15",
        "-o",
        "ServerAliveCountMax=4",
        ssh_host,
        &command,
    ])
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::null())
    .kill_on_drop(true);
    cmd.spawn()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shell_quote_escapes_single_quotes() {
        assert_eq!(shell_quote("plain"), "'plain'");
        assert_eq!(shell_quote("it's"), r"'it'\''s'");
        // A quoting escape would otherwise let a crafted cwd run commands.
        assert_eq!(shell_quote("a'; rm -rf /; '"), r"'a'\''; rm -rf /; '\'''");
    }

    #[test]
    fn tail_command_is_one_based() {
        // `-c +N` is 1-based, and `-F` (not `-f`) keeps following across a
        // re-create — both are load-bearing, hence asserted verbatim.
        assert_eq!(tail_command("/tmp/x", 0), "tail -c +1 -F '/tmp/x'");
        assert_eq!(tail_command("/tmp/x", 4096), "tail -c +4097 -F '/tmp/x'");
    }

    #[test]
    fn missing_prereqs_are_reported() {
        let none = HostPrereqs::default();
        assert!(none.missing().unwrap().contains("tmux"));
        let claude_only = HostPrereqs {
            claude_version: Some("2.1.219".into()),
            tmux_version: Some("tmux 3.3a".into()),
            ..Default::default()
        };
        assert!(claude_only.missing().is_none());
        let no_cli = HostPrereqs {
            tmux_version: Some("tmux 3.3a".into()),
            ..Default::default()
        };
        assert!(no_cli.missing().unwrap().contains("claude or codex"));
    }
}

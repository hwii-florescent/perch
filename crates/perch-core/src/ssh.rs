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

use std::path::PathBuf;
use std::process::Stdio;
use std::sync::OnceLock;

use tokio::io::{AsyncReadExt, AsyncWriteExt};

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

// ---------------------------------------------------------------------------
// Connection multiplexing (ControlMaster)
// ---------------------------------------------------------------------------
//
// Every direct-mode operation — `fs.browse`, the prereq probe, a detached
// launch, a liveness check, cancel, CLI attach — was paying the *full*
// `ProxyCommand` handshake through the devpod's corp-SSH proxy on every single
// `ssh` invocation: ~4.5s measured cold against a real devpod
// (`dev-claude.devpod-us-or`), confirmed with `time ssh -o BatchMode=yes
// ... true` run three times back to back with no improvement — there is no
// implicit reuse. That is what made directory browsing feel broken: every
// click a user made in the folder picker was a full new TCP+TLS-equivalent
// SSH negotiation plus the proxy hop.
//
// `ControlMaster=auto` fixes this the standard OpenSSH way: the first `ssh`
// to a host becomes a background "master" holding the authenticated
// connection open, and every subsequent `ssh` to the same
// (user, host, port) — even a completely separate process — hands its
// command to the master over a local unix socket instead of reconnecting.
// Measured against the same devpod: second and third calls dropped to
// ~0.5s, a ~9x reduction, and that number is dominated by ssh's own
// process-spawn/exec overhead, not the network. This is transparent to
// callers: multiplexing rides along with `base_args`, so `run_remote`,
// `write_remote_file` and the prereq probe all get it for free, and it
// composes with the devpod `ProxyCommand` chain exactly as normal OpenSSH
// multiplexing always has (the proxy only runs once, to establish the
// master; the mux socket is a plain local IPC after that).
fn control_dir() -> &'static PathBuf {
    static DIR: OnceLock<PathBuf> = OnceLock::new();
    DIR.get_or_init(|| {
        // `~/.ssh` (not `/tmp`): it already exists with `0700` permissions
        // for every ssh user, so the control socket inherits a private
        // directory without perch having to reason about a shared,
        // world-writable `/tmp` on a multi-user box.
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let dir = PathBuf::from(home).join(".ssh").join("perch-cm");
        if let Err(e) = std::fs::create_dir_all(&dir) {
            tracing::warn!("[ssh] failed to create control dir {}: {e}", dir.display());
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700));
        }
        dir
    })
}

/// How long an idle control master lingers before ssh tears itself down
/// (`ControlPersist`). 10 minutes: long enough that clicking through several
/// directories in the folder picker, or a detached launch immediately
/// followed by a browse, always lands on a warm connection — the entire
/// point of this change — but short enough that walking away from perch
/// doesn't leave an authenticated channel to a devpod sitting open all day.
/// Masters are not pinned processes perch tracks: they self-expire on this
/// timer with no perch-side bookkeeping required, which is deliberate (see
/// `close_master`'s doc comment for what *is* cleaned up eagerly, and why
/// perch-process-exit cleanup is *not* implemented).
const CONTROL_PERSIST_SECS: &str = "600";

/// The three `-o` pairs that turn any `ssh` invocation into a multiplexed
/// one. Shared by every call site in this module plus `detached.rs`'s CLI
/// attach (`cli_attach_argv`), so a `-tt` tmux attach rides the same master
/// as the tails and one-shot commands for that host rather than paying its
/// own handshake.
///
/// `%C` is ssh's own hash of `(local user, host, port)` — a fixed 16 hex
/// characters — which is what keeps the resulting socket path comfortably
/// under macOS's ~104-byte `sun_path` limit regardless of how long the
/// configured `sshHost` string is (spelling the hostname out instead would
/// risk overflowing it on nested/long devpod names).
pub fn mux_opts() -> Vec<String> {
    let path = control_dir().join("%C");
    vec![
        "-o".into(),
        "ControlMaster=auto".into(),
        "-o".into(),
        format!("ControlPath={}", path.display()),
        "-o".into(),
        format!("ControlPersist={CONTROL_PERSIST_SECS}"),
    ]
}

/// True if `stderr` shows ssh refusing to open a new multiplexed channel
/// because the remote sshd's `MaxSessions` (default 10) is already
/// saturated by other channels sharing this host's control master —
/// several long-lived tails plus a browse/probe/liveness call can add up on
/// a busy session. Unlike a dropped TCP connection, `ControlMaster=auto`
/// does **not** transparently fall back to a fresh connection when this
/// happens — the client just errors — so every call site that shares the
/// master (`run_remote`, `write_remote_file`, `spawn_tail_checked`) checks
/// for this specific failure and retries once over a dedicated
/// (`ControlMaster=no`) connection rather than surfacing it to the user.
fn is_session_limit_error(stderr: &str) -> bool {
    stderr.contains("mux_client_request_session") || stderr.contains("Session open refused by peer")
}

/// Best-effort teardown of a host's control master (`ssh -O exit`).
///
/// Called when a direct-mode host is explicitly disabled (`hub.rs`'s
/// `reload_hosts`) — not on every disconnect, since `ControlPersist` above
/// already reclaims an idle master on its own; this just avoids leaving an
/// authenticated channel open the instant the user turns a host off, rather
/// than making them wait out the 10-minute window.
///
/// There is deliberately no equivalent hook on perch's own process exit:
/// `boot.rs`/`main.rs` register no signal handler at all today (the process
/// just dies on SIGINT/SIGTERM, same as every other subprocess it owns), so
/// there is nowhere clean to hang a "close every master" step without adding
/// a new shutdown-handling subsystem. `ControlPersist=600` is the intended
/// backstop for that case — a perch restart leaves its old masters to expire
/// on their own timer, which is a few stray idle `ssh` processes for at most
/// 10 minutes, not a leak.
pub async fn close_master(ssh_host: &str) {
    let mut owned = vec!["-O".to_string(), "exit".to_string()];
    owned.extend(mux_opts());
    owned.push(ssh_host.to_string());
    let args: Vec<&str> = owned.iter().map(String::as_str).collect();
    // "no master running for this host" is the common case (exits non-zero)
    // and is not worth surfacing — this is cleanup, not a user-facing op.
    let _ = run_ssh_bounded(&args, 5, "close control master").await;
}

/// Standard options for every non-interactive ssh perch runs: never prompt
/// (a password prompt would hang the bounded child until its timeout), give
/// up on TCP connect quickly, and multiplex over a shared control master
/// (see above).
fn base_args(ssh_host: &str) -> Vec<String> {
    let mut args = vec![
        "-o".into(),
        "BatchMode=yes".into(),
        "-o".into(),
        "ConnectTimeout=5".into(),
    ];
    args.extend(mux_opts());
    args.push(ssh_host.into());
    args
}

/// Same as [`base_args`] but with multiplexing explicitly disabled — the
/// fallback used when the shared master has hit the remote's `MaxSessions`
/// cap (see [`is_session_limit_error`]). Explicit `ControlMaster=no` rather
/// than just omitting the mux options, so a user's own `~/.ssh/config`
/// turning multiplexing on for this host can't reintroduce the same
/// failure.
fn base_args_plain(ssh_host: &str) -> Vec<String> {
    vec![
        "-o".into(),
        "BatchMode=yes".into(),
        "-o".into(),
        "ConnectTimeout=5".into(),
        "-o".into(),
        "ControlMaster=no".into(),
        ssh_host.into(),
    ]
}

/// Run one already-fully-formed remote `command` (the `PATH` prefix, if any,
/// is the caller's responsibility) with multiplexing, retrying once over a
/// dedicated connection if the shared master turns out to be saturated. This
/// is the one place the mux/no-mux choice is made for bounded one-shot
/// commands, so `run_remote` and `write_remote_file` don't each reimplement
/// the retry.
async fn exec_with_fallback(
    ssh_host: &str,
    command: &str,
    timeout_secs: u64,
    phase: &str,
) -> Result<std::process::Output, String> {
    let mut owned = base_args(ssh_host);
    owned.push(command.to_string());
    let args: Vec<&str> = owned.iter().map(String::as_str).collect();
    let out = run_ssh_bounded(&args, timeout_secs, phase).await?;
    if !out.status.success() && is_session_limit_error(&String::from_utf8_lossy(&out.stderr)) {
        tracing::debug!(
            "[ssh] {ssh_host}: control master saturated, retrying '{phase}' without multiplexing"
        );
        let mut owned = base_args_plain(ssh_host);
        owned.push(command.to_string());
        let args: Vec<&str> = owned.iter().map(String::as_str).collect();
        return run_ssh_bounded(&args, timeout_secs, phase).await;
    }
    Ok(out)
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
    let out = exec_with_fallback(ssh_host, &full, timeout_secs, phase).await?;
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
    match write_remote_file_ex(ssh_host, path, content, timeout_secs, true).await {
        Err(e) if is_session_limit_error(&e) => {
            tracing::debug!(
                "[ssh] {ssh_host}: control master saturated, retrying write of {path} without multiplexing"
            );
            write_remote_file_ex(ssh_host, path, content, timeout_secs, false).await
        }
        other => other,
    }
}

async fn write_remote_file_ex(
    ssh_host: &str,
    path: &str,
    content: &str,
    timeout_secs: u64,
    mux: bool,
) -> Result<(), String> {
    let dir = path.rsplit_once('/').map(|(d, _)| d).unwrap_or(".");
    let command = format!(
        "mkdir -p {} && cat > {}",
        shell_quote(dir),
        shell_quote(path)
    );
    let mut owned = if mux {
        base_args(ssh_host)
    } else {
        base_args_plain(ssh_host)
    };
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

/// Spawn the long-lived tail child, multiplexed over the host's shared
/// control master (fast startup — no ProxyCommand handshake if a master is
/// already up from a preceding browse/probe/launch). Keepalives are set so a
/// dead network is noticed in ~1 minute rather than hanging forever — the
/// caller then re-validates its cursor and re-tails.
///
/// Most callers want [`spawn_tail_checked`] instead, which additionally
/// falls back to [`spawn_tail_plain`] if the master turns out to be
/// saturated (`MaxSessions`). This function is the mux-only building block,
/// kept `pub` for tests and for that fallback logic to call directly.
pub fn spawn_tail(
    ssh_host: &str,
    path: &str,
    offset: u64,
) -> std::io::Result<tokio::process::Child> {
    spawn_tail_ex(ssh_host, path, offset, true)
}

/// Same as [`spawn_tail`] with multiplexing explicitly disabled — the
/// fallback for when the shared master has hit the remote's `MaxSessions`
/// cap. A long tail *does* count against that cap for its entire lifetime
/// (unlike a one-shot command), which is exactly the scenario `MaxSessions`
/// exists to bound, so a busy host with several concurrent turns is the
/// realistic way to hit this.
pub fn spawn_tail_plain(
    ssh_host: &str,
    path: &str,
    offset: u64,
) -> std::io::Result<tokio::process::Child> {
    spawn_tail_ex(ssh_host, path, offset, false)
}

fn spawn_tail_ex(
    ssh_host: &str,
    path: &str,
    offset: u64,
    mux: bool,
) -> std::io::Result<tokio::process::Child> {
    let command = format!("{REMOTE_PATH_PREFIX} {}", tail_command(path, offset));
    let mut owned = vec![
        "-o".to_string(),
        "BatchMode=yes".to_string(),
        "-o".to_string(),
        "ConnectTimeout=5".to_string(),
        "-o".to_string(),
        "ServerAliveInterval=15".to_string(),
        "-o".to_string(),
        "ServerAliveCountMax=4".to_string(),
    ];
    if mux {
        owned.extend(mux_opts());
    } else {
        owned.push("-o".to_string());
        owned.push("ControlMaster=no".to_string());
    }
    owned.push(ssh_host.to_string());
    owned.push(command);
    let mut cmd = tokio::process::Command::new("ssh");
    cmd.args(&owned)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        // Piped (not null) so a fast failure caused by the control master
        // rejecting a new channel (`MaxSessions` saturated) can be
        // diagnosed by `spawn_tail_checked`; drained in the background
        // otherwise so a chatty remote can never backpressure-stall the
        // tail itself.
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    cmd.spawn()
}

/// Spawn a tail, watching a short grace period for the one mux-specific
/// failure mode `ControlMaster=auto` cannot recover from on its own: the
/// remote sshd's `MaxSessions` cap already saturated by other channels on
/// this host's master (long tails plus a browse/probe/liveness call add up
/// on a busy session). `tail -F` never exits on its own, so a child that
/// *does* exit within the grace window — and whose stderr names this
/// specific failure — is unambiguously "the master refused us", not
/// "legitimately no new log lines yet". On that signal only, retry once
/// over [`spawn_tail_plain`]; any other outcome (still running, or exited
/// for an unrelated reason) is handed back exactly as before, so the
/// existing reattach/backoff loop in `detached.rs::tail_run` is unaffected.
pub async fn spawn_tail_checked(
    ssh_host: &str,
    path: &str,
    offset: u64,
) -> std::io::Result<tokio::process::Child> {
    let mut child = spawn_tail(ssh_host, path, offset)?;
    let grace = tokio::time::timeout(std::time::Duration::from_millis(300), child.wait()).await;
    match grace {
        Ok(Ok(status)) if !status.success() => {
            let mut stderr = String::new();
            if let Some(mut se) = child.stderr.take() {
                let _ = se.read_to_string(&mut stderr).await;
            }
            if is_session_limit_error(&stderr) {
                tracing::warn!(
                    "[ssh] {ssh_host}: control master session limit hit, \
                     retrying tail without multiplexing"
                );
                let mut plain = spawn_tail_plain(ssh_host, path, offset)?;
                drain_stderr_background(&mut plain, ssh_host);
                return Ok(plain);
            }
            if !stderr.trim().is_empty() {
                tracing::debug!("[ssh] {ssh_host}: tail exited early: {}", stderr.trim());
            }
            Ok(child)
        }
        _ => {
            // Still running (the overwhelmingly common case) or the grace
            // window simply elapsed with no news either way.
            drain_stderr_background(&mut child, ssh_host);
            Ok(child)
        }
    }
}

/// Drain a still-running child's stderr in the background so a piped (not
/// null) stderr pipe can never fill up and backpressure-stall the process —
/// `tail -F` is normally silent on stderr, but this is cheap insurance.
/// Logged at `debug` only if it actually said something.
fn drain_stderr_background(child: &mut tokio::process::Child, ssh_host: &str) {
    if let Some(mut se) = child.stderr.take() {
        let host = ssh_host.to_string();
        tokio::spawn(async move {
            let mut buf = String::new();
            let _ = se.read_to_string(&mut buf).await;
            if !buf.trim().is_empty() {
                tracing::debug!("[ssh] tail stderr ({host}): {}", buf.trim());
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mux_control_path_stays_under_the_macos_sun_path_limit() {
        // macOS's sockaddr_un.sun_path is ~104 bytes; %C is ssh's own fixed
        // 16-hex-char hash, so the path length only depends on `$HOME`, not
        // on how long a configured `sshHost` string is. Guard the specific
        // failure this exists to avoid: a long-enough control dir silently
        // breaking multiplexing with an "unix_listener: too long for Unix
        // domain socket" error from ssh itself.
        let opts = mux_opts();
        let control_path = opts
            .iter()
            .find_map(|s| s.strip_prefix("ControlPath="))
            .expect("ControlPath option present");
        assert!(
            control_path.len() < 100,
            "control path {control_path} ({} bytes) is too close to the sun_path limit",
            control_path.len()
        );
        assert!(control_path.ends_with("/perch-cm/%C"));
    }

    #[test]
    fn mux_opts_are_present_in_every_bounded_invocation() {
        let args = base_args("myhost");
        assert!(args.iter().any(|a| a == "ControlMaster=auto"));
        assert!(args.iter().any(|a| a.starts_with("ControlPath=")));
        assert!(args.iter().any(|a| a == "ControlPersist=600"));
        assert_eq!(args.last().map(String::as_str), Some("myhost"));
    }

    #[test]
    fn plain_fallback_explicitly_disables_multiplexing() {
        let args = base_args_plain("myhost");
        assert!(args.iter().any(|a| a == "ControlMaster=no"));
        assert!(!args.iter().any(|a| a.starts_with("ControlPath=")));
        assert_eq!(args.last().map(String::as_str), Some("myhost"));
    }

    #[test]
    fn session_limit_error_is_recognised() {
        assert!(is_session_limit_error(
            "mux_client_request_session: session request failed: Session open refused by peer"
        ));
        assert!(is_session_limit_error("Session open refused by peer"));
        assert!(!is_session_limit_error("Permission denied (publickey)."));
        assert!(!is_session_limit_error(""));
    }

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

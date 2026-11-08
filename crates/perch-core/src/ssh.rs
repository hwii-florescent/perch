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
/// Where the control socket lives for a given `$HOME`. Split out of
/// [`control_dir`] as a *pure* function so the sun_path-length guard below can
/// be tested without touching the process environment: `control_dir` memoises
/// into a `OnceLock`, and other tests in this crate (`uploads`, `clipboard_image`)
/// point `$HOME` at a uuid-named temp dir, so whichever test happened to win
/// the race decided the cached value and the guard failed at random.
fn control_dir_for_home(home: &str) -> PathBuf {
    // `~/.ssh` (not `/tmp`): it already exists with `0700` permissions
    // for every ssh user, so the control socket inherits a private
    // directory without perch having to reason about a shared,
    // world-writable `/tmp` on a multi-user box.
    PathBuf::from(home).join(".ssh").join("perch-cm")
}

fn control_dir() -> &'static PathBuf {
    static DIR: OnceLock<PathBuf> = OnceLock::new();
    DIR.get_or_init(|| {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let dir = control_dir_for_home(&home);
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
pub async fn exec_with_fallback(
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
            Err(format!(
                "remote command failed ({phase}, exit {code}): {err}"
            ))
        }
    }
}

/// Single-quote `s` for safe interpolation into a remote `sh -c` command line.
/// (`'` is closed, escaped, and reopened — the standard POSIX trick.)
pub fn shell_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', r"'\''"))
}

/// Transfer an existing file without buffering or base64-encoding it in memory.
/// System scp uses SFTP (-s), the user's SSH config and our bounded mux policy.
pub async fn copy_file(
    ssh_host: &str,
    local: &std::path::Path,
    remote: &str,
) -> Result<(), String> {
    validate_upload_host(ssh_host)?;
    let dir = remote.rsplit_once('/').map(|(dir, _)| dir).unwrap_or(".");
    run_remote(
        ssh_host,
        &format!("umask 077; mkdir -p {}", shell_quote(dir)),
        15,
        "prepare upload",
    )
    .await?;
    scp_file(ssh_host, local, remote).await
}

fn validate_upload_host(host: &str) -> Result<(), String> {
    if host.is_empty()
        || host.starts_with('-')
        || !host
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "_-.@[]:".contains(c))
    {
        return Err("invalid configured SSH host for SCP".into());
    }
    Ok(())
}

fn scp_command(
    host: &str,
    local: &std::path::Path,
    remote: &str,
    mux: bool,
) -> Result<tokio::process::Command, String> {
    validate_upload_host(host)?;
    if !local.is_absolute() || !remote.starts_with('/') || remote.chars().any(char::is_control) {
        return Err("SCP upload requires absolute, safe paths".into());
    }
    // scp requires brackets around IPv6 addresses, unlike ssh's destination.
    let (user, address) = host
        .rsplit_once('@')
        .map(|(u, h)| (format!("{u}@"), h))
        .unwrap_or_else(|| (String::new(), host));
    let address = if address.contains(':') && !address.starts_with('[') {
        format!("[{address}]")
    } else {
        address.to_string()
    };
    let mut command = tokio::process::Command::new("scp");
    command.args([
        "-s",
        "-p",
        "-B",
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=5",
    ]);
    if mux {
        command.args(mux_opts());
    } else {
        command.args(["-o", "ControlMaster=no", "-o", "ControlPath=none"]);
    }
    command
        .arg("--")
        .arg(local)
        .arg(format!("{user}{address}:{remote}"));
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    Ok(command)
}

async fn scp_file(host: &str, local: &std::path::Path, remote: &str) -> Result<(), String> {
    for mux in [true, false] {
        let mut command = scp_command(host, local, remote, mux)?;
        let output = tokio::time::timeout(std::time::Duration::from_secs(3600), command.output())
            .await
            .map_err(|_| "SCP upload timed out after one hour".to_string())?
            .map_err(|error| format!("could not start SCP: {error}"))?;
        if output.status.success() {
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&output.stderr);
        if mux && is_session_limit_error(&stderr) {
            continue;
        }
        return Err(format!(
            "SCP upload failed: {}",
            stderr.trim().chars().take(300).collect::<String>()
        ));
    }
    unreachable!()
}

/// Only these two files in a freshly minted directory belong to this transfer.
/// Cancellation/error cleanup never touches another upload or a workspace file.
struct RemoteUpload {
    host: String,
    directory: String,
    path: String,
    committed: bool,
}

impl Drop for RemoteUpload {
    fn drop(&mut self) {
        if self.committed {
            return;
        }
        let host = self.host.clone();
        let command = format!(
            "rm -f -- {} {}; rmdir -- {}",
            shell_quote(&format!("{}/.partial", self.directory)),
            shell_quote(&self.path),
            shell_quote(&self.directory)
        );
        if let Ok(runtime) = tokio::runtime::Handle::try_current() {
            runtime.spawn(async move {
                if let Err(error) =
                    run_remote(&host, &command, 15, "remove incomplete upload").await
                {
                    tracing::warn!("could not remove incomplete SCP upload: {error}");
                }
            });
        }
    }
}

/// Upload to a fresh per-session remote directory; return only a completed path.
/// ponytail: successful remote drops are retained, and a core crash can leave
/// a partial directory. Add an owning-core retention service before sweeping remotely.
pub async fn stage_upload(
    host: &str,
    session_id: &str,
    name: &str,
    local: &std::path::Path,
) -> Result<String, String> {
    validate_upload_host(host)?;
    let session = crate::uploads::sanitize_filename(session_id);
    let command = format!(
        "umask 077; root=\"$HOME/.perch/uploads\"; mkdir -p \"$root/{session}\" && chmod 700 \"$root\" \"$root/{session}\" && mktemp -d \"$root/{session}/drop.XXXXXXXXXX\""
    );
    let directory = run_remote(host, &command, 15, "prepare remote staging").await?;
    if !directory.starts_with('/')
        || directory.chars().any(char::is_control)
        || !directory
            .rsplit_once("/drop.")
            .is_some_and(|(parent, suffix)| {
                parent.ends_with(&format!("/.perch/uploads/{session}"))
                    && suffix.len() == 10
                    && suffix.chars().all(|c| c.is_ascii_alphanumeric())
            })
    {
        return Err("SSH returned an unsafe staging directory".into());
    }
    let path = format!("{directory}/{}", crate::uploads::sanitize_filename(name));
    let mut upload = RemoteUpload {
        host: host.into(),
        directory,
        path,
        committed: false,
    };
    scp_file(host, local, &format!("{}/.partial", upload.directory)).await?;
    run_remote(
        host,
        &format!(
            "chmod 600 {} && mv -- {} {}",
            shell_quote(&format!("{}/.partial", upload.directory)),
            shell_quote(&format!("{}/.partial", upload.directory)),
            shell_quote(&upload.path)
        ),
        15,
        "finish remote upload",
    )
    .await?;
    upload.committed = true;
    Ok(upload.path.clone())
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
/// Deliberately does *not* probe *claude* model lists: those are bare aliases
/// with no machine-local file to read, so `models.rs`'s static list applies
/// everywhere. The *codex* list is machine-specific and is fetched separately
/// by [`fetch_remote_codex_catalog`], on the same probe cycle.
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
    let field = |i: usize| {
        all.get(start + i)
            .map(|s| s.trim().to_string())
            .unwrap_or_default()
    };
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
        //
        // Deliberately goes through `control_dir_for_home` with a fixed,
        // realistic `$HOME` rather than through `mux_opts()`: `mux_opts` reads
        // the `control_dir()` `OnceLock`, whose value is decided by whichever
        // test initialised it first, and sibling tests here repoint `$HOME` at
        // a uuid-named temp dir — which made this assertion fail at random
        // depending on test order.
        let control_path = control_dir_for_home("/Users/a-fairly-long-mac-username")
            .join("%C")
            .display()
            .to_string();
        assert!(
            control_path.len() < 100,
            "control path {control_path} ({} bytes) is too close to the sun_path limit",
            control_path.len()
        );
        assert!(control_path.ends_with("/perch-cm/%C"));
    }

    /// `mux_opts()` is what actually reaches ssh, so keep asserting on its
    /// shape — just not on a length that depends on the ambient `$HOME`.
    #[test]
    fn mux_opts_control_path_points_at_the_perch_control_dir() {
        let opts = mux_opts();
        let control_path = opts
            .iter()
            .find_map(|s| s.strip_prefix("ControlPath="))
            .expect("ControlPath option present");
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

    #[test]
    fn scp_is_noninteractive_streamed_and_keeps_paths_as_separate_arguments() {
        let command = scp_command(
            "user@example.test",
            std::path::Path::new("/tmp/a file.bin"),
            "/home/a user/upload.bin",
            false,
        )
        .unwrap();
        let args: Vec<_> = command
            .as_std()
            .get_args()
            .map(|s| s.to_str().unwrap())
            .collect();
        assert!(args.contains(&"-s"));
        assert!(args.contains(&"BatchMode=yes"));
        assert!(args.contains(&"ControlPath=none"));
        assert_eq!(
            &args[args.len() - 3..],
            &[
                "--",
                "/tmp/a file.bin",
                "user@example.test:/home/a user/upload.bin"
            ]
        );
        assert!(scp_command(
            "-oProxyCommand=bad",
            std::path::Path::new("/tmp/file"),
            "/tmp/file",
            true
        )
        .is_err());
        assert!(scp_command(
            "example.test",
            std::path::Path::new("/tmp/file"),
            "/tmp/bad\npath",
            true
        )
        .is_err());
        let ipv6 = scp_command(
            "user@::1",
            std::path::Path::new("/tmp/file"),
            "/tmp/file",
            false,
        )
        .unwrap();
        assert_eq!(
            ipv6.as_std().get_args().last().unwrap(),
            "user@[::1]:/tmp/file"
        );
    }
}

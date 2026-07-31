//! Shared boot logic used by both the headless `perch-core` binary and the
//! `perch-desktop` Tauri shell.  Keeping it here avoids duplicating the
//! db-open / registry / server-run plumbing across two crates.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;

use crate::db::HistoryDb;
use crate::registry::SessionRegistry;
use crate::server::{run, CliArgs, ServerOptions};

/// Remove Claude Code nesting markers from the current process environment
/// so that any agent subprocess or PTY terminal spawned by perch does NOT
/// inherit them. Without this, `claude` CLIs spawned inside a perch session
/// that was itself started from inside a Claude Code shell would print
/// "⚠ Transcript saving is off — inherited CLAUDE_CODE_CHILD_SESSION marker".
///
/// Must be called before any subprocess is spawned (including the axum
/// server which later forks terminals/agents). Idempotent — calling it more
/// than once is safe.
pub fn scrub_nested_agent_env() {
    let vars = [
        "CLAUDE_CODE_CHILD_SESSION",
        "CLAUDECODE",
        "CLAUDE_CODE_ENTRYPOINT",
        "CLAUDE_CODE_SSE_PORT",
    ];
    let mut removed = Vec::new();
    for var in vars {
        if std::env::var(var).is_ok() {
            std::env::remove_var(var);
            removed.push(var);
        }
    }
    if !removed.is_empty() {
        tracing::info!(
            "[perch] scrubbed Claude Code nesting env vars: {}",
            removed.join(", ")
        );
    }
}

/// Ensure `~/.local/bin` is on `PATH` so tools like `claude` and `codex`
/// installed there are reachable from headless launches (tmux auto-start,
/// launchd, Tauri) that inherit a minimal PATH without sourcing
/// `~/.zshrc` / `~/.bashrc`.
///
/// Idempotent: calling it more than once is safe.
pub fn augment_path_with_local_bin() {
    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => return,
    };
    let local_bin = format!("{home}/.local/bin");
    if !std::path::Path::new(&local_bin).is_dir() {
        return;
    }
    let current_path = std::env::var("PATH").unwrap_or_default();
    let already_present = current_path.split(':').any(|seg| seg == local_bin);
    if !already_present {
        let new_path = format!("{local_bin}:{current_path}");
        std::env::set_var("PATH", &new_path);
    }
}

/// Merge a login shell's `PATH` with the current process `PATH`.
///
/// The login entries come first (in their original order), then every entry
/// of the current `PATH` that the login shell didn't already provide, also in
/// order. Empty segments are dropped and no entry appears twice.
///
/// Appending — rather than prepending — the current entries is deliberate:
/// an explicitly-provided launcher `PATH` (e.g. an `env PATH=… perch-core`
/// recipe) still resolves, but cannot shadow system binaries. In particular
/// the ssh-wrapper shim directory that Claude Code tool shells inject ends up
/// *after* `/usr/bin`, so `/usr/bin/ssh` wins and the hub's child-process
/// tracking of ssh tunnels stays reliable.
pub fn merge_login_path(login: &str, current: &str) -> String {
    let mut merged: Vec<&str> = Vec::new();
    for segment in login.split(':').chain(current.split(':')) {
        if segment.is_empty() || merged.contains(&segment) {
            continue;
        }
        merged.push(segment);
    }
    merged.join(":")
}

/// Adopt the user's login-shell `PATH` so subprocesses (claude, codex, ssh,
/// auth helpers, brew-installed tools) resolve the same way they do in a
/// normal terminal.
///
/// Launching perch from Finder/Dock gives it the bare
/// `/usr/bin:/bin:/usr/sbin:/sbin`, which is missing `/opt/homebrew/bin`,
/// `~/.local/bin` and friends. To recover the real environment we ask the
/// user's shell: `<shell> -lic 'echo __PERCH_PATH__$PATH'`. The shell is run
/// **interactive as well as login** because on real machines the interesting
/// `PATH` additions live in `~/.zshrc`, which a non-interactive `-lc` shell
/// does not source. The child is given a forced bare `PATH` so the answer is
/// deterministic regardless of what launched perch — critically, this stops a
/// poisoned parent `PATH` from being echoed straight back.
///
/// The result is merged via [`merge_login_path`] (see its doc comment for why
/// current entries are appended rather than prepended).
///
/// Best-effort by design: escape hatch `PERCH_NO_LOGIN_PATH`, a hard 5-second
/// timeout, and any failure simply leaves `PATH` as it was.
#[cfg(unix)]
pub fn adopt_login_shell_path() {
    use std::io::Read;
    use std::process::{Command, Stdio};
    use std::time::{Duration, Instant};

    const MARKER: &str = "__PERCH_PATH__";

    if std::env::var_os("PERCH_NO_LOGIN_PATH").is_some() {
        tracing::info!("[perch] PERCH_NO_LOGIN_PATH set — keeping the inherited PATH");
        return;
    }

    let shell = std::env::var("SHELL")
        .ok()
        .filter(|s| !s.is_empty() && std::path::Path::new(s).exists())
        .unwrap_or_else(|| {
            if cfg!(target_os = "macos") {
                "/bin/zsh".to_string()
            } else {
                "/bin/bash".to_string()
            }
        });

    let mut child = match Command::new(&shell)
        .arg("-lic")
        .arg(format!("echo {MARKER}$PATH"))
        // Forced bare base: makes the login shell's answer independent of how
        // perch itself was launched.
        .env("PATH", "/usr/bin:/bin:/usr/sbin:/sbin")
        .env("TERM", "dumb")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(child) => child,
        Err(e) => {
            tracing::warn!("[perch] could not run login shell {shell} for PATH discovery: {e}");
            return;
        }
    };

    // Runs before/outside the tokio runtime, so poll std::process by hand.
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    tracing::warn!(
                        "[perch] login shell {shell} did not answer within 5s — keeping the inherited PATH"
                    );
                    return;
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => {
                let _ = child.kill();
                let _ = child.wait();
                tracing::warn!("[perch] login shell {shell} failed while discovering PATH: {e}");
                return;
            }
        }
    }

    let mut stdout = String::new();
    if let Some(mut pipe) = child.stdout.take() {
        let _ = pipe.read_to_string(&mut stdout);
    }

    // rc files can print banners; the marker plus last-match rule survives it.
    let login_path = stdout
        .lines()
        .rev()
        .find_map(|line| line.split_once(MARKER).map(|(_, rest)| rest.trim()))
        .filter(|p| !p.is_empty());
    let Some(login_path) = login_path else {
        tracing::warn!(
            "[perch] login shell {shell} produced no {MARKER} line — keeping the inherited PATH"
        );
        return;
    };

    let current = std::env::var("PATH").unwrap_or_default();
    let merged = merge_login_path(login_path, &current);
    std::env::set_var("PATH", &merged);
    tracing::info!("[perch] adopted login-shell PATH from {shell}: {merged}");
}

/// Non-unix builds have no login shell to consult — no-op.
#[cfg(not(unix))]
pub fn adopt_login_shell_path() {}

/// Resolve the web dist directory.
///
/// Priority order:
/// 1. `PERCH_WEB_DIST` environment variable (if set and non-empty).
/// 2. Exe-relative `../../../packages/web/dist` canonicalized (works when the
///    binary lives in `target/debug/` or `target/release/`).
/// 3. Fallback: `packages/web/dist` relative to the working directory.
pub fn resolve_web_dist_dir() -> PathBuf {
    // 1. Env override.
    if let Ok(v) = std::env::var("PERCH_WEB_DIST") {
        if !v.is_empty() {
            return PathBuf::from(v);
        }
    }

    // 2. Exe-relative candidate.
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()));
    if let Some(dir) = exe_dir {
        let candidate = dir.join("../../../packages/web/dist");
        if let Ok(canonical) = candidate.canonicalize() {
            return canonical;
        }
    }

    // 3. CWD-relative fallback.
    PathBuf::from("packages/web/dist")
}

/// Core boot sequence shared by the headless binary and the Tauri shell.
///
/// * `args`       — parsed CLI arguments (port, paths, flags).
/// * `web_dist_dir` — resolved path to the compiled web client.
/// * `ready_tx`   — if `Some`, the server fires this with the bound
///   `SocketAddr` immediately after the TCP listener is created (before
///   `axum::serve` blocks).  The Tauri shell uses this to learn the
///   actual port when port 0 is requested.  The headless binary passes
///   `None`.
pub async fn boot(
    args: CliArgs,
    web_dist_dir: PathBuf,
    ready_tx: Option<tokio::sync::oneshot::Sender<SocketAddr>>,
) -> Result<()> {
    // Open the db at the override path (--db-path / PERCH_DB) or default.
    let db = Arc::new(if let Some(p) = args.db_path.clone() {
        HistoryDb::open(p)?
    } else {
        HistoryDb::open_default()?
    });

    let registry = Arc::new(SessionRegistry::new());
    let default_cwd = std::env::current_dir()?.display().to_string();

    if args.headless {
        tracing::info!("[perch] running headless");
    }
    if let Some(url) = &args.public_base_url {
        tracing::info!("[perch] public URL: {url}");
    }
    if let Some(p) = &args.db_path {
        tracing::info!("[perch] db path override: {:?}", p);
    }
    if let Some(p) = &args.hosts_path {
        tracing::info!("[perch] hosts path override: {:?}", p);
    }

    run(
        ServerOptions {
            port: args.port,
            base_path: args.base_path,
            web_dist_dir,
            db_path: args.db_path,
            hosts_path: args.hosts_path,
            ready_tx,
        },
        registry,
        db,
        default_cwd,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::merge_login_path;

    #[test]
    fn login_entries_come_first_and_current_only_entries_are_appended() {
        assert_eq!(
            merge_login_path("/opt/homebrew/bin:/usr/bin:/bin", "/usr/bin:/custom/tools"),
            "/opt/homebrew/bin:/usr/bin:/bin:/custom/tools"
        );
    }

    #[test]
    fn duplicates_are_dropped_in_both_directions() {
        // Repeats within the login list.
        assert_eq!(merge_login_path("/a:/b:/a", ""), "/a:/b");
        // Repeats within the current list.
        assert_eq!(merge_login_path("/a", "/b:/b:/a"), "/a:/b");
        // A shim dir already on the current PATH lands after the login entries.
        assert_eq!(
            merge_login_path("/usr/bin:/bin", "/tmp/ssh-shim:/usr/bin"),
            "/usr/bin:/bin:/tmp/ssh-shim"
        );
    }

    #[test]
    fn empty_segments_are_dropped() {
        assert_eq!(merge_login_path("/a::/b:", ":/c::"), "/a:/b:/c");
        assert_eq!(merge_login_path("", ""), "");
    }

    #[test]
    fn order_is_preserved_within_each_list() {
        assert_eq!(
            merge_login_path("/1:/2:/3", "/3:/4:/2:/5"),
            "/1:/2:/3:/4:/5"
        );
    }

    #[test]
    fn either_side_may_be_empty() {
        assert_eq!(merge_login_path("", "/only/current"), "/only/current");
        assert_eq!(merge_login_path("/only/login", ""), "/only/login");
    }
}

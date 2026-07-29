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

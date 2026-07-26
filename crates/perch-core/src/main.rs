use std::path::PathBuf;
use std::sync::Arc;

use perch_core::db::HistoryDb;
use perch_core::registry::SessionRegistry;
use perch_core::server::{run, CliArgs, ServerOptions};

/// Ensure ~/.local/bin is on PATH so tools like `claude` and `codex` installed
/// there are reachable from headless launches (tmux auto-start, launchd, Tauri)
/// that inherit a minimal PATH without sourcing ~/.zshrc or ~/.bashrc.
/// Called once at startup, before any subprocess is spawned.
fn augment_path_with_local_bin() {
    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => return,
    };
    let local_bin = format!("{home}/.local/bin");
    if !std::path::Path::new(&local_bin).is_dir() {
        return;
    }
    let current_path = std::env::var("PATH").unwrap_or_default();
    // Check if already present (avoid duplicates in repeated restarts).
    let already_present = current_path
        .split(':')
        .any(|seg| seg == local_bin);
    if !already_present {
        let new_path = format!("{local_bin}:{current_path}");
        std::env::set_var("PATH", &new_path);
        // Log after tracing is initialised — caller logs this line.
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env().add_directive("perch_core=info".parse()?))
        .init();

    // Prepend ~/.local/bin to PATH before any subprocess spawning so that
    // tools like claude/codex are found under minimal-PATH launches (tmux,
    // launchd, Tauri). Safe to call multiple times; idempotent.
    let had_local_bin = std::env::var("PATH")
        .map(|p| {
            let home = std::env::var("HOME").unwrap_or_default();
            p.split(':').any(|s| s == format!("{home}/.local/bin"))
        })
        .unwrap_or(false);
    augment_path_with_local_bin();
    if !had_local_bin {
        if let Ok(home) = std::env::var("HOME") {
            let local_bin = format!("{home}/.local/bin");
            if std::path::Path::new(&local_bin).is_dir() {
                tracing::info!("[perch] prepended {local_bin} to PATH (was missing; ensures claude/codex are found in headless launches)");
            }
        }
    }

    let argv: Vec<String> = std::env::args().skip(1).collect();
    let args = CliArgs::parse(&argv);

    // target/debug/perch-core -> ../../packages/web/dist == packages/web/dist
    // (mirrors the Node build's dist/index.js -> ../../web/dist)
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()));
    let web_dist_dir = exe_dir
        .and_then(|dir| {
            let candidate = dir.join("../../../packages/web/dist");
            candidate.canonicalize().ok()
        })
        .unwrap_or_else(|| PathBuf::from("packages/web/dist"));

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
        },
        registry,
        db,
        default_cwd,
    )
    .await
}

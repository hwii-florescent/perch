use std::path::PathBuf;
use std::sync::Arc;

use perch_core::db::HistoryDb;
use perch_core::registry::SessionRegistry;
use perch_core::server::{run, CliArgs, ServerOptions};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env().add_directive("perch_core=info".parse()?))
        .init();

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

    let db = Arc::new(HistoryDb::open_default()?);
    let registry = Arc::new(SessionRegistry::new());
    let default_cwd = std::env::current_dir()?.display().to_string();

    if args.headless {
        tracing::info!("[perch] running headless");
    }
    if let Some(url) = &args.public_base_url {
        tracing::info!("[perch] public URL: {url}");
    }

    run(
        ServerOptions {
            port: args.port,
            base_path: args.base_path,
            web_dist_dir,
        },
        registry,
        db,
        default_cwd,
    )
    .await
}

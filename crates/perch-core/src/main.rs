use perch_core::boot::{augment_path_with_local_bin, boot, resolve_web_dist_dir};
use perch_core::server::CliArgs;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("perch_core=info".parse()?),
        )
        .init();

    // Prepend ~/.local/bin to PATH before any subprocess spawning so that
    // tools like claude/codex are found under minimal-PATH launches (tmux,
    // launchd, Tauri).  Safe to call multiple times; idempotent.
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
                tracing::info!(
                    "[perch] prepended {local_bin} to PATH \
                     (was missing; ensures claude/codex are found in headless launches)"
                );
            }
        }
    }

    let argv: Vec<String> = std::env::args().skip(1).collect();
    let args = CliArgs::parse(&argv);

    let web_dist_dir = resolve_web_dist_dir();

    // Headless binary always passes None for ready_tx.
    boot(args, web_dist_dir, None).await
}

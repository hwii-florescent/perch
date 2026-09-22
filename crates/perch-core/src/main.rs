use perch_core::boot::{
    adopt_login_shell_path, augment_path_with_local_bin, boot, resolve_web_dist_dir,
    scrub_nested_agent_env,
};
use perch_core::server::CliArgs;

fn main() -> anyhow::Result<()> {
    perch_core::daemon::run_if_requested();
    serve()
}

#[tokio::main]
async fn serve() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("perch_core=info".parse()?),
        )
        .init();

    // PATH/env fixups must all happen before any subprocess spawning.
    // Scrub Claude Code nesting markers so spawned agents/terminals don't
    // inherit them and print transcript-saving warnings.
    scrub_nested_agent_env();
    // Adopt the user's login-shell PATH so brew tools and auth helpers are
    // found even when perch is launched with a bare PATH (Finder, launchd).
    adopt_login_shell_path();
    // Then prepend ~/.local/bin as the final guarantee that claude/codex
    // resolve.  Safe to call multiple times; idempotent.
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

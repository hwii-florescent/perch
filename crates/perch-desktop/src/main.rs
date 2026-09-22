//! perch-desktop — Tauri v2 desktop shell for perch.
//!
//! Boots the `perch-core` axum server in-process on a free localhost port,
//! waits for it to be ready, then opens a native Tauri window pointed at
//! `http://127.0.0.1:<port>/`.  All logic lives in perch-core; Tauri only
//! supplies the native window chrome.

use perch_core::boot::{
    adopt_login_shell_path, augment_path_with_local_bin, boot, resolve_web_dist_dir,
    scrub_nested_agent_env,
};
use perch_core::server::CliArgs;

fn main() {
    // `<exe> __perchd …` is the terminal daemon, not the app (see daemon.rs).
    perch_core::daemon::run_if_requested();
    // Initialise tracing before anything else so early errors are visible.
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("perch_core=info".parse().unwrap()),
        )
        .init();

    // PATH/env fixups first — a Dock/Finder launch gives us a bare PATH and
    // nothing may spawn a subprocess before these run.
    // Scrub Claude Code nesting markers so spawned agents/terminals don't
    // inherit them and print transcript-saving warnings.
    scrub_nested_agent_env();
    // Adopt the user's real login-shell PATH (brew tools, auth helpers).
    adopt_login_shell_path();
    // Prepend ~/.local/bin so claude/codex are found in minimal-PATH launches.
    augment_path_with_local_bin();

    // Build CliArgs from env vars only (no CLI argv in a GUI app).
    // CliArgs::parse reads PERCH_PORT / PERCH_DB / PERCH_HOSTS etc. from env;
    // passing an empty slice means no argv overrides, which is correct here.
    let empty: Vec<String> = vec![];
    let mut args = CliArgs::parse(&empty);
    // Force port 0 so the OS assigns a free loopback port.
    args.port = 0;

    let web_dist_dir = resolve_web_dist_dir();

    // Create a dedicated tokio runtime for the core server (Tauri owns the
    // main thread's event loop, so we can't use #[tokio::main] here).
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("failed to build tokio runtime");

    // Channel: core fires ready_tx with the bound SocketAddr right after bind.
    let (ready_tx, ready_rx) = tokio::sync::oneshot::channel::<std::net::SocketAddr>();

    // Spawn the core server on the background runtime.
    let web_dist_dir_clone = web_dist_dir.clone();
    runtime.spawn(async move {
        if let Err(e) = boot(args, web_dist_dir_clone, Some(ready_tx)).await {
            tracing::error!("[perch-desktop] core exited with error: {e:#}");
        }
    });

    // Block (on the tokio runtime) until the core signals it is ready, with a
    // 10-second timeout.  If the core fails to start we exit non-zero.
    let bound_addr = match runtime.block_on(async {
        tokio::time::timeout(std::time::Duration::from_secs(10), ready_rx).await
    }) {
        Ok(Ok(addr)) => addr,
        Ok(Err(_)) => {
            eprintln!("[perch-desktop] core channel closed before ready signal");
            std::process::exit(1);
        }
        Err(_) => {
            eprintln!("[perch-desktop] core did not become ready within 10 seconds");
            std::process::exit(1);
        }
    };

    let url_str = format!("http://127.0.0.1:{}/", bound_addr.port());
    // Verification grep target — printed before Tauri::run so it's always visible.
    println!("perch-desktop: core ready at {url_str}");

    // Test mode: PERCH_DESKTOP_TEST=1 → create a hidden, unfocused window so
    // automated verification never steals user focus or flashes a window.
    let test_mode = std::env::var("PERCH_DESKTOP_TEST").as_deref() == Ok("1");

    let url: tauri::WebviewUrl =
        tauri::WebviewUrl::External(url_str.parse().expect("invalid server URL"));

    tauri::Builder::default()
        .setup(move |app| {
            let mut builder = tauri::WebviewWindowBuilder::new(app, "main", url)
                .title("perch")
                .inner_size(1280.0, 800.0)
                .min_inner_size(800.0, 600.0);

            if test_mode {
                builder = builder.visible(false).focused(false);
            }

            builder.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running perch-desktop");

    // Keep the runtime alive until Tauri exits (runtime drop joins all tasks).
    drop(runtime);
}

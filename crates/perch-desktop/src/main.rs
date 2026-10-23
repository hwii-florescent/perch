//! perch-desktop — Tauri v2 desktop shell for perch.
//!
//! Boots the `perch-core` axum server in-process on a free localhost port,
//! waits for it to be ready, then opens a native Tauri window pointed at
//! `http://127.0.0.1:<port>/`.  All logic lives in perch-core; Tauri only
//! supplies the native window chrome.

mod browser;
mod permissions;

use perch_core::boot::{
    adopt_login_shell_path, augment_path_with_local_bin, boot, resolve_web_dist_dir,
    scrub_nested_agent_env,
};
use perch_core::server::CliArgs;

/// The app menu. Tauri's default one binds Cmd+W to "Close Window", which macOS
/// handles before the web view sees the key; perch uses Cmd+W to close a tab
/// (`keybinds.ts`), so this is the default minus that item. The window still
/// closes with its red button and Cmd+Q quits.
#[cfg(target_os = "macos")]
fn app_menu(app: &tauri::AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{Menu, PredefinedMenuItem as P, Submenu};
    let sep = || P::separator(app);
    Menu::with_items(
        app,
        &[
            &Submenu::with_items(
                app,
                "perch",
                true,
                &[
                    &P::about(app, None, None)?,
                    &sep()?,
                    &P::services(app, None)?,
                    &sep()?,
                    &P::hide(app, None)?,
                    &P::hide_others(app, None)?,
                    &P::show_all(app, None)?,
                    &sep()?,
                    &P::quit(app, None)?,
                ],
            )?,
            &Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &P::undo(app, None)?,
                    &P::redo(app, None)?,
                    &sep()?,
                    &P::cut(app, None)?,
                    &P::copy(app, None)?,
                    &P::paste(app, None)?,
                    &P::select_all(app, None)?,
                ],
            )?,
            &Submenu::with_items(app, "View", true, &[&P::fullscreen(app, None)?])?,
            &Submenu::with_items(
                app,
                "Window",
                true,
                &[&P::minimize(app, None)?, &P::maximize(app, None)?],
            )?,
        ],
    )
}

/// Opens a terminal link in the OS default browser. The UI passes whatever the terminal
/// printed, so only http(s) goes through (and `open` never sees a leading `-`).
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("only http(s) links can be opened".into());
    }
    let opener = if cfg!(target_os = "macos") {
        "open"
    } else {
        "xdg-open"
    };
    std::process::Command::new(opener)
        .arg(&url)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Explicit explorer action, with Finder semantics: the OS association decides what
/// opens (including launching executable documents or application bundles).
/// Only the trusted main webview has this IPC; never accept URLs or relative paths.
#[tauri::command]
async fn open_in_default_app(path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(path);
    if !path.is_absolute() || !path.exists() {
        return Err("not an existing absolute path".into());
    }
    let opener = if cfg!(target_os = "macos") {
        "open"
    } else if cfg!(target_os = "linux") {
        "xdg-open"
    } else {
        return Err("opening files is not supported on this platform".into());
    };
    // Some Linux handlers keep xdg-open alive until the app closes. Stop waiting
    // after five seconds, but keep the task alive to drain output and reap it.
    let launch = tokio::spawn(async move {
        let output = tokio::process::Command::new(opener)
            .arg(path)
            .output()
            .await
            .map_err(|e| e.to_string())?;
        if output.status.success() {
            Ok(())
        } else {
            let detail = String::from_utf8_lossy(&output.stderr);
            Err(format!(
                "Could not open in the default app ({}). {}",
                output.status,
                detail.trim()
            ))
        }
    });
    match tokio::time::timeout(std::time::Duration::from_secs(5), launch).await {
        Ok(result) => result.map_err(|e| e.to_string())?,
        Err(_) => Ok(()),
    }
}

/// Shows a file in Finder (macOS) or its folder in the file manager. The UI sends the
/// absolute path of an explorer entry; anything else is refused (and `open` never sees a
/// leading `-`).
#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(path);
    if !path.is_absolute() || std::fs::symlink_metadata(&path).is_err() {
        return Err("not an existing absolute path".into());
    }
    let mut command;
    if cfg!(target_os = "macos") {
        command = std::process::Command::new("open");
        command.arg("-R").arg(&path);
    } else {
        command = std::process::Command::new("xdg-open");
        command.arg(path.parent().unwrap_or(&path));
    }
    command.spawn().map(|_| ()).map_err(|e| e.to_string())
}

/// The loopback port the app serves its UI on (see `main`).
const DESKTOP_PORT: u16 = 47788;

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
    // The web view's saved state (tab order, splits, open files, which window it
    // is) is keyed by its origin, port included, so the port must survive a
    // restart: ask for the same loopback port every launch, and take any free one
    // only when it is busy (a second app, or a test: it then starts clean).
    // Test mode always takes a free port, so it never shares the real app's state.
    args.port = if std::env::var("PERCH_DESKTOP_TEST").as_deref() == Ok("1") {
        0
    } else {
        let wanted = std::env::var("PERCH_DESKTOP_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(DESKTOP_PORT);
        // ponytail: probe-then-bind can race another process taking the port in between; boot then fails and the app exits.
        match std::net::TcpListener::bind(("127.0.0.1", wanted)) {
            Ok(_) => wanted,
            Err(_) => 0,
        }
    };

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
        // Replaces the web view's `window.Notification` with native OS
        // notifications; the UI's existing toast code needs no change.
        .plugin(tauri_plugin_notification::init())
        // Native folder picker for "Add project" on the local host.
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_external,
            open_in_default_app,
            reveal_in_finder,
            permissions::permissions_status,
            permissions::permissions_allow,
            permissions::permissions_verify,
            browser::browser_show,
            browser::browser_hide,
            browser::browser_close,
            browser::browser_go,
            browser::browser_action,
            browser::browser_url
        ])
        .setup(move |app| {
            #[cfg(target_os = "macos")]
            app.set_menu(app_menu(app.handle())?)?;

            let mut builder = tauri::WebviewWindowBuilder::new(app, "main", url)
                .title("perch")
                .inner_size(1280.0, 800.0)
                .min_inner_size(800.0, 600.0)
                // Tauri's native file-drop handler swallows every drag over the
                // web view on macOS, so in-page HTML5 drags (tab reorder) never
                // drop. perch doesn't use Tauri's drag-drop events.
                .disable_drag_drop_handler();

            // Orca-style: no separate title bar. The web view's top row (tabs
            // + ›_) runs under the traffic lights; it pads 78px for them and
            // is a drag region. The lights centre in a container `14 + y` tall,
            // so y = 22 centres them on that 36px row (`.app--mac-desktop`).
            #[cfg(target_os = "macos")]
            {
                builder = builder
                    .title_bar_style(tauri::TitleBarStyle::Overlay)
                    .hidden_title(true)
                    .traffic_light_position(tauri::LogicalPosition::new(14.0, 22.0));
            }

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

#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn default_app_refuses_relative_paths_urls_and_missing_files_without_launching() {
        for path in [
            "",
            "relative/file.txt",
            "-a",
            "https://example.com/file.pdf",
            "file:///tmp/file.pdf",
            "/dev/null/perch-missing-file",
        ] {
            assert_eq!(
                super::open_in_default_app(path.into()).await,
                Err("not an existing absolute path".into()),
                "{path}"
            );
        }
    }
}

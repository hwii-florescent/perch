//! perch's built-in browser: one native child webview per browser tab, laid over the
//! main window at the rectangle the UI reports for its tab body.
//!
//! A native webview is a real browser (no `X-Frame-Options` / `frame-ancestors` refusals,
//! real history, cookies), unlike an iframe. The UI owns the toolbar and the rectangle;
//! these commands only create, move, hide, navigate and close. Commands are `async` on
//! purpose: a sync command runs on the main thread, and `add_child` waits on it.
//!
//! Isolation: the capability grants IPC to the `main` webview only (`capabilities/main.json`
//! `webviews`), so a page here has no app commands even if it is served from loopback.

use tauri::webview::{NewWindowResponse, WebviewBuilder};
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl};

/// `id` comes from the UI: letters, digits and `-` only, so it cannot name another webview.
fn label(id: &str) -> Result<String, String> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err("invalid browser id".into());
    }
    Ok(format!("browser-{id}"))
}

fn web_url(url: &str) -> Result<tauri::Url, String> {
    let url: tauri::Url = url.parse().map_err(|e| format!("{e}"))?;
    match url.scheme() {
        "http" | "https" => Ok(url),
        _ => Err("only http(s) pages can be shown".into()),
    }
}

/// Show the tab's page at this rectangle (window-relative CSS px), creating it on first use.
#[tauri::command]
pub async fn browser_show(
    app: AppHandle,
    id: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    // The UI's zoom factor (Cmd/Ctrl +/-); None leaves the page's own zoom alone.
    zoom: Option<f64>,
) -> Result<(), String> {
    let label = label(&id)?;
    let (position, size) = (LogicalPosition::new(x, y), LogicalSize::new(width, height));
    if let Some(view) = app.get_webview(&label) {
        view.set_position(position).map_err(|e| e.to_string())?;
        view.set_size(size).map_err(|e| e.to_string())?;
        if let Some(zoom) = zoom {
            view.set_zoom(zoom).map_err(|e| e.to_string())?;
        }
        return view.show().map_err(|e| e.to_string());
    }
    let window = app.get_window("main").ok_or("no main window")?;
    let (handle, own_label) = (app.clone(), label.clone());
    let builder = WebviewBuilder::new(&label, WebviewUrl::External(web_url(&url)?))
        // target=_blank / window.open stay in this tab instead of vanishing.
        .on_new_window(move |url, _| {
            if let Some(view) = handle.get_webview(&own_label) {
                let _ = view.navigate(url);
            }
            NewWindowResponse::Deny
        });
    let view = window
        .add_child(builder, position, size)
        .map_err(|e| e.to_string())?;
    // The page is an 8px-rounded card like the panes beside it (CSS cannot clip a child web view).
    #[cfg(target_os = "macos")]
    crate::glass::round_webview(&view);
    if let Some(zoom) = zoom {
        view.set_zoom(zoom).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Hide the page (its tab is not on screen, or something is drawn over it); it keeps its state.
#[tauri::command]
pub async fn browser_hide(app: AppHandle, id: String) -> Result<(), String> {
    match app.get_webview(&label(&id)?) {
        Some(view) => view.hide().map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

/// Destroy the page (its tab was closed).
#[tauri::command]
pub async fn browser_close(app: AppHandle, id: String) -> Result<(), String> {
    match app.get_webview(&label(&id)?) {
        Some(view) => view.close().map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

#[tauri::command]
pub async fn browser_go(app: AppHandle, id: String, url: String) -> Result<(), String> {
    let url = web_url(&url)?;
    match app.get_webview(&label(&id)?) {
        Some(view) => view.navigate(url).map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

/// `back`, `forward` or `reload`.
#[tauri::command]
pub async fn browser_action(app: AppHandle, id: String, action: String) -> Result<(), String> {
    let Some(view) = app.get_webview(&label(&id)?) else {
        return Ok(());
    };
    match action.as_str() {
        "back" => view.eval("history.back()"),
        "forward" => view.eval("history.forward()"),
        "reload" => view.reload(),
        _ => return Err("unknown browser action".into()),
    }
    .map_err(|e| e.to_string())
}

/// The page's current address, for the toolbar; None before it exists.
#[tauri::command]
pub async fn browser_url(app: AppHandle, id: String) -> Result<Option<String>, String> {
    match app.get_webview(&label(&id)?) {
        Some(view) => view
            .url()
            .map(|u| Some(u.to_string()))
            .map_err(|e| e.to_string()),
        None => Ok(None),
    }
}

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

/// Menu id of File > Close Tab.
#[cfg(target_os = "macos")]
const CLOSE_TAB_ID: &str = "close-tab";

/// The File menu. A native browser page is its own web view, so while it has focus the main
/// document never sees Cmd+W. A menu accelerator does reach it first (the app menu has no Close
/// Window item, see `main.rs::app_menu`); `on_menu_event` forwards it to the UI (`CLOSE_TAB_EVENT`).
#[cfg(target_os = "macos")]
pub fn file_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Submenu<tauri::Wry>> {
    use tauri::menu::{MenuItem, Submenu};
    let close = MenuItem::with_id(app, CLOSE_TAB_ID, "Close Tab", true, Some("CmdOrCtrl+W"))?;
    Submenu::with_items(app, "File", true, &[&close])
}

#[cfg(target_os = "macos")]
pub fn on_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    if event.id().as_ref() == CLOSE_TAB_ID {
        let app = app.clone();
        tauri::async_runtime::spawn(close_tab(app));
    }
}

/// The UI event for a close request: `id` is the focused browser page's webview id, "" for the
/// main view. None for an id that is not a plain webview id, so nothing is injected.
fn close_tab_script(id: &str) -> Option<String> {
    id.chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-')
        .then(|| {
            format!(
                "window.dispatchEvent(new CustomEvent('perch:close-tab', {{ detail: '{id}' }}))"
            )
        })
}

/// Whether the window's first responder is `view` (a WKWebView) or inside it.
#[cfg(target_os = "macos")]
unsafe fn responder_in(view: *mut objc2::runtime::AnyObject) -> bool {
    use objc2::{
        class, msg_send,
        runtime::{AnyObject, Bool},
    };
    if view.is_null() {
        return false;
    }
    // SAFETY: `view` is a live NSView and this runs on the main thread; every result is nil-checked.
    unsafe {
        let window: *mut AnyObject = msg_send![view, window];
        if window.is_null() {
            return false;
        }
        let responder: *mut AnyObject = msg_send![window, firstResponder];
        if responder.is_null() {
            return false;
        }
        let is_view: Bool = msg_send![responder, isKindOfClass: class!(NSView)];
        is_view.as_bool() && {
            let inside: Bool = msg_send![responder, isDescendantOf: view];
            inside.as_bool()
        }
    }
}

/// Close Tab from the menu: tell the main view which browser page has focus (or that none does).
/// A page whose focus cannot be read leaves the request undone: closing the session tab instead
/// would be a guess.
#[cfg(target_os = "macos")]
async fn close_tab(app: AppHandle) {
    let mut target = String::new();
    let mut unknown = false;
    for (label, view) in app.webviews() {
        let Some(id) = label.strip_prefix("browser-") else {
            continue;
        };
        let (send, receive) = tokio::sync::oneshot::channel();
        let asked = view.with_webview(move |platform| {
            // SAFETY: with_webview runs on the main thread with a live WKWebView.
            let _ = send.send(unsafe { responder_in(platform.inner().cast()) });
        });
        let focused = match asked {
            Ok(()) => tokio::time::timeout(std::time::Duration::from_millis(300), receive).await,
            Err(_) => {
                unknown = true;
                continue;
            }
        };
        match focused {
            Ok(Ok(true)) => {
                target = id.to_string();
                break;
            }
            Ok(Ok(false)) => {}
            _ => unknown = true,
        }
    }
    if target.is_empty() && unknown {
        return;
    }
    if let (Some(main), Some(script)) = (app.get_webview("main"), close_tab_script(&target)) {
        let _ = main.eval(script);
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

/// WKWebView.URL is nil until a navigation commits (and can stay nil after a failed first
/// load). Wry 0.55's url() unwraps it, aborting the app instead of returning an error.
#[cfg(target_os = "macos")]
unsafe fn nsurl_string(url: *mut objc2::runtime::AnyObject) -> Option<String> {
    use objc2::{msg_send, runtime::AnyObject};
    if url.is_null() {
        return None;
    }
    // SAFETY: the caller supplies a live NSURL on its owning thread; copy the NSString
    // bytes before the autoreleased objects can be released, checking every nullable result.
    unsafe {
        let text: *mut AnyObject = msg_send![url, absoluteString];
        if text.is_null() {
            return None;
        }
        let bytes: *const std::ffi::c_char = msg_send![text, UTF8String];
        if bytes.is_null() {
            return None;
        }
        Some(
            std::ffi::CStr::from_ptr(bytes)
                .to_string_lossy()
                .into_owned(),
        )
    }
}

/// The page's current address, for the toolbar; None before it exists or commits.
#[tauri::command]
pub async fn browser_url(app: AppHandle, id: String) -> Result<Option<String>, String> {
    let Some(view) = app.get_webview(&label(&id)?) else {
        return Ok(None);
    };
    #[cfg(target_os = "macos")]
    {
        let (send, receive) = tokio::sync::oneshot::channel();
        view.with_webview(move |platform| {
            use objc2::{msg_send, runtime::AnyObject};
            // SAFETY: with_webview runs on the main thread with a live WKWebView.
            let url = unsafe {
                let view = platform.inner().cast::<AnyObject>();
                let url: *mut AnyObject = msg_send![view, URL];
                nsurl_string(url)
            };
            let _ = send.send(url);
        })
        .map_err(|e| e.to_string())?;
        // A closing window must not leave the shared UI command queue waiting forever.
        tokio::time::timeout(std::time::Duration::from_secs(5), receive)
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    view.url()
        .map(|u| Some(u.to_string()))
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod script_tests {
    #[test]
    fn close_script_only_carries_plain_webview_ids() {
        assert!(super::close_tab_script("").unwrap().contains("detail: ''"));
        assert!(super::close_tab_script("6a-0F")
            .unwrap()
            .contains("detail: '6a-0F'"));
        for bad in ["'", "a'b", "a b", "a);alert(1", "a\n"] {
            assert!(super::close_tab_script(bad).is_none(), "{bad:?}");
        }
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    #[test]
    fn missing_native_url_is_not_a_crash_and_committed_urls_are_copied() {
        use objc2::{class, msg_send, runtime::AnyObject};
        objc2::rc::autoreleasepool(|_| unsafe {
            assert_eq!(super::nsurl_string(std::ptr::null_mut()), None);
            let text: *mut AnyObject = msg_send![class!(NSString), stringWithUTF8String: c"https://example.com/path?q=1".as_ptr()];
            let url: *mut AnyObject = msg_send![class!(NSURL), URLWithString: text];
            assert!(!url.is_null());
            assert_eq!(
                super::nsurl_string(url).as_deref(),
                Some("https://example.com/path?q=1")
            );
        });
    }
}

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

#[cfg(target_os = "macos")]
struct CloseTabMenu {
    file: tauri::menu::Submenu<tauri::Wry>,
    binding: std::sync::Mutex<(String, u64, bool)>,
}

/// One native owner for Close Tab, including main-view and blank-browser focus. The UI installs
/// the effective Settings > Keyboard binding; until then no accelerator steals keys from the DOM.
#[cfg(target_os = "macos")]
pub fn file_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Submenu<tauri::Wry>> {
    use tauri::menu::{MenuItem, Submenu};
    let close = MenuItem::with_id(app, CLOSE_TAB_ID, "Close Tab", false, None::<&str>)?;
    let file = Submenu::with_items(app, "File", true, &[&close])?;
    app.manage(CloseTabMenu {
        file: file.clone(),
        binding: std::sync::Mutex::new((String::new(), 0, false)),
    });
    Ok(file)
}

#[cfg(target_os = "macos")]
pub fn on_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    if event.id().as_ref() == CLOSE_TAB_ID {
        // Match the DOM shortcut's !e.repeat guard: holding the key must not close many tabs.
        // SAFETY: menu callbacks run on the main thread; currentEvent is nil-checked.
        unsafe {
            use objc2::{
                class, msg_send,
                runtime::{AnyObject, Bool},
            };
            let application: *mut AnyObject = msg_send![class!(NSApplication), sharedApplication];
            let event: *mut AnyObject = msg_send![application, currentEvent];
            if !event.is_null() {
                let kind: usize = msg_send![event, type];
                if kind == 10 {
                    let repeated: Bool = msg_send![event, isARepeat];
                    if repeated.as_bool() {
                        return;
                    }
                }
            }
        }
        let Some(menu) = app.try_state::<CloseTabMenu>() else {
            return;
        };
        let binding = menu.binding.lock().unwrap();
        if !binding.2 {
            return;
        }
        let epoch = binding.0.clone();
        let generation = binding.1;
        let app = app.clone();
        tauri::async_runtime::spawn(close_tab(app, epoch, generation));
    }
}

/// Apply synchronously in the native IPC callback: no old-document Tokio task can apply a
/// binding after a reload. The per-document epoch lets the UI restart its counter safely.
/// This command remains main-view-only; browser pages gain no IPC.
#[tauri::command]
pub fn browser_close_shortcut(
    app: AppHandle,
    accelerator: Option<String>,
    generation: u64,
    epoch: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let _main =
            objc2::MainThreadMarker::new().ok_or("Close Tab config must run on the main thread")?;
        let menu = app.try_state::<CloseTabMenu>().ok_or("no Close Tab menu")?;
        let mut binding = menu.binding.lock().unwrap();
        if !accepts_close_binding(&binding.0, binding.1, &epoch, generation) {
            return Err("invalid or stale Close Tab binding".into());
        }
        if let Some(spec) = &accelerator {
            spec.parse::<muda::accelerator::Accelerator>()
                .map_err(|e| e.to_string())?;
        }
        // Muda 0.19.3's set_key_accelerator(None) leaves the native key equivalent
        // installed, even on disabled items. Replace it until upstream clears it.
        let item = tauri::menu::MenuItem::with_id(
            &app,
            CLOSE_TAB_ID,
            "Close Tab",
            accelerator.is_some(),
            accelerator.as_deref(),
        )
        .map_err(|e| e.to_string())?;
        let index = menu
            .file
            .items()
            .map_err(|e| e.to_string())?
            .iter()
            .position(|item| item.id().as_ref() == CLOSE_TAB_ID)
            .ok_or("missing Close Tab item")?;
        let old = menu
            .file
            .remove_at(index)
            .map_err(|e| e.to_string())?
            .ok_or("missing Close Tab item")?;
        if let Err(error) = menu.file.insert(&item, index) {
            menu.file
                .insert(&old, index)
                .map_err(|e| format!("{error}; restoring Close Tab: {e}"))?;
            return Err(error.to_string());
        }
        *binding = (epoch, generation, accelerator.is_some());
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, accelerator, generation, epoch);
        Ok(())
    }
}

#[cfg(any(target_os = "macos", test))]
fn valid_close_epoch(epoch: &str) -> bool {
    epoch.len() == 36 && epoch.bytes().all(|c| c.is_ascii_hexdigit() || c == b'-')
}

#[cfg(any(target_os = "macos", test))]
fn accepts_close_binding(current_epoch: &str, current: u64, epoch: &str, next: u64) -> bool {
    valid_close_epoch(epoch) && next > 0 && (epoch != current_epoch || next > current)
}

/// Main maps to the normal close path; only a known native browser label maps to a page.
#[cfg(any(target_os = "macos", test))]
fn close_target(name: &str) -> Option<&str> {
    if name == "main" {
        return Some("");
    }
    let id = name.strip_prefix("browser-")?;
    label(id).ok()?;
    Some(id)
}

/// Only checked identifiers and a numeric counter may be carried into the main DOM.
#[cfg(any(target_os = "macos", test))]
fn close_tab_script(id: &str, epoch: &str, generation: u64) -> Option<String> {
    if !valid_close_epoch(epoch) {
        return None;
    }
    id.chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-')
        .then(|| {
            format!(
                "window.dispatchEvent(new CustomEvent('perch:close-tab', {{ detail: {{ id: '{id}', generation: {generation}, epoch: '{epoch}' }} }}))"
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

/// Resolve actual focus, including the main view. Unknown focus never guesses at a session.
#[cfg(target_os = "macos")]
async fn close_tab(app: AppHandle, epoch: String, generation: u64) {
    let mut target = None;
    for (name, view) in app.webviews() {
        let Some(id) = close_target(&name) else {
            continue;
        };
        let (send, receive) = tokio::sync::oneshot::channel();
        let asked = view.with_webview(move |platform| {
            // SAFETY: with_webview runs on the main thread with a live WKWebView.
            let _ = send.send(unsafe { responder_in(platform.inner().cast()) });
        });
        let focused = match asked {
            Ok(()) => tokio::time::timeout(std::time::Duration::from_millis(300), receive).await,
            Err(_) => continue,
        };
        if matches!(focused, Ok(Ok(true))) {
            target = Some(id.to_string());
            break;
        }
    }
    let Some(target) = target else {
        return;
    };
    if let (Some(main), Some(script)) = (
        app.get_webview("main"),
        close_tab_script(&target, &epoch, generation),
    ) {
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
    const EPOCH: &str = "00000000-0000-4000-8000-000000000000";
    #[test]
    fn close_binding_counter_is_document_scoped_and_identifiers_are_checked() {
        let next_epoch = "00000000-0000-4000-8000-000000000001";
        assert!(super::accepts_close_binding(EPOCH, 50, next_epoch, 1));
        assert!(super::accepts_close_binding(EPOCH, 50, EPOCH, 51));
        for counter in [0, 1, 49, 50] {
            assert!(!super::accepts_close_binding(EPOCH, 50, EPOCH, counter));
        }
        for epoch in [
            "",
            "bad",
            "00000000-0000-4000-8000-00000000000'",
            "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz",
        ] {
            assert!(!super::accepts_close_binding(EPOCH, 50, epoch, 51));
            assert!(super::close_tab_script("", epoch, 51).is_none());
        }
    }
    #[test]
    fn close_script_only_carries_plain_webview_ids() {
        assert_eq!(super::close_target("main"), Some(""));
        assert_eq!(super::close_target("browser-6a-0F"), Some("6a-0F"));
        for name in ["other", "browser-", "browser-a'b"] {
            assert_eq!(super::close_target(name), None);
        }
        assert!(super::close_tab_script("", EPOCH, 9)
            .unwrap()
            .contains("id: '', generation: 9"));
        assert!(super::close_tab_script("6a-0F", EPOCH, 7)
            .unwrap()
            .contains("id: '6a-0F', generation: 7"));
        for bad in ["'", "a'b", "a b", "a);alert(1", "a\n"] {
            assert!(super::close_tab_script(bad, EPOCH, 7).is_none(), "{bad:?}");
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

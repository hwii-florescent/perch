//! The glass shell (macOS only; docs/DECISIONS.md 2026-10-24).
//!
//! The window is transparent and its content view is an `NSVisualEffectView`
//! (vibrancy). The web view stays transparent too: the page paints the shell
//! as one translucent layer (`--shell-bg`, base.css) only when `__PERCH_GLASS__`
//! is set, so web mode, other platforms and a failed vibrancy all keep today's
//! opaque shell. macOS draws the effect view opaque under Reduce Transparency,
//! which leaves the page's tint as a plain solid, the same fallback.
//!
//! A native browser page is a child web view above the DOM that CSS cannot
//! round; `round_webview` rounds its layer instead.

use tauri::WebviewWindow;

/// Script run before the page (main window only; native browser pages are separate webviews
/// built without it): tells the UI the window is glass.
// ponytail: the flag is set before vibrancy is applied, so the failure fallback in `apply` is a
// best-effort eval that can lose a race with page load. `apply_vibrancy` only fails off-macOS
// (this module is macOS-only); upgrade to a managed flag read by `on_page_load` if that changes.
pub const INIT_SCRIPT: &str = "window.__PERCH_GLASS__ = true;";
/// Corner radius of the window's vibrancy layer; macOS windows are ~10pt.
const WINDOW_RADIUS: f64 = 10.0;
/// Matches `--radius-pane` in base.css.
const PANE_RADIUS: f64 = 8.0;

/// Apply vibrancy to the window. If it fails the page is told to drop back to the opaque shell.
pub fn apply(window: &WebviewWindow) {
    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
    let applied = apply_vibrancy(
        window,
        NSVisualEffectMaterial::UnderWindowBackground,
        None,
        Some(WINDOW_RADIUS),
    );
    if let Err(error) = applied {
        tracing::warn!("[perch-desktop] vibrancy unavailable, keeping the opaque shell: {error}");
        let _ = window.eval("window.__PERCH_GLASS__ = false; document.documentElement.removeAttribute('data-glass');");
    }
}

/// Round (and clip) a child web view's layer so a native browser page matches the panes.
pub fn round_webview(webview: &tauri::Webview) {
    let _ = webview.with_webview(|platform| {
        use objc2::{msg_send, runtime::AnyObject};
        let view = platform.inner().cast::<AnyObject>();
        if view.is_null() {
            return;
        }
        // SAFETY: `inner()` is the live WKWebView (an NSView) and this closure runs on the main thread.
        unsafe {
            let _: () = msg_send![view, setWantsLayer: true];
            let layer: *mut AnyObject = msg_send![view, layer];
            if !layer.is_null() {
                let _: () = msg_send![layer, setCornerRadius: PANE_RADIUS];
                let _: () = msg_send![layer, setMasksToBounds: true];
            }
        }
    });
}

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

/// Height of the web view's top row (`h-11` in App.tsx) and the left edge of the close button.
const TITLE_ROW: f64 = 44.0;
const LIGHTS_LEFT: f64 = 14.0;

// AppKit geometry as plain C structs (CGFloat is f64 on every Mac perch runs on).
#[derive(Clone, Copy)]
#[repr(C)]
struct Point {
    x: f64,
    y: f64,
}
#[derive(Clone, Copy)]
#[repr(C)]
struct Size {
    width: f64,
    height: f64,
}
#[derive(Clone, Copy)]
#[repr(C)]
struct Rect {
    origin: Point,
    size: Size,
}
// SAFETY: these are layout-identical to CGPoint / CGSize / CGRect.
unsafe impl objc2::Encode for Point {
    const ENCODING: objc2::Encoding = objc2::Encoding::Struct(
        "CGPoint",
        &[objc2::Encoding::Double, objc2::Encoding::Double],
    );
}
unsafe impl objc2::Encode for Size {
    const ENCODING: objc2::Encoding = objc2::Encoding::Struct(
        "CGSize",
        &[objc2::Encoding::Double, objc2::Encoding::Double],
    );
}
unsafe impl objc2::Encode for Rect {
    const ENCODING: objc2::Encoding =
        objc2::Encoding::Struct("CGRect", &[Point::ENCODING, Size::ENCODING]);
}

/// Centre the close / minimise / zoom buttons on the 44px top row.
///
/// Same approach as tao's `traffic_light_position` (resize the title bar container, then place the
/// buttons), but centred explicitly: with the vibrancy content view tao's offset left the lights
/// ~6pt above the row's centre line. Call it again whenever macOS may re-lay the title bar.
pub fn position_traffic_lights(window: &WebviewWindow) {
    use objc2::{msg_send, runtime::AnyObject};
    let handle = window.clone();
    let _ = window.run_on_main_thread(move || {
        let Ok(ns_window) = handle.ns_window() else {
            return;
        };
        let ns_window = ns_window.cast::<AnyObject>();
        // SAFETY: `ns_window` is the live NSWindow and this closure runs on the main thread; every
        // receiver below is checked for nil first and each selector is a public AppKit one.
        unsafe {
            let buttons: [*mut AnyObject; 3] =
                [0isize, 1, 2].map(|kind| msg_send![ns_window, standardWindowButton: kind]);
            if buttons.iter().any(|button| button.is_null()) {
                return;
            }
            let bar: *mut AnyObject = msg_send![buttons[0], superview];
            if bar.is_null() {
                return;
            }
            let container: *mut AnyObject = msg_send![bar, superview];
            if container.is_null() {
                return;
            }
            let window_frame: Rect = msg_send![ns_window, frame];
            let mut container_frame: Rect = msg_send![container, frame];
            container_frame.size.height = TITLE_ROW;
            container_frame.origin.y = window_frame.size.height - TITLE_ROW;
            let _: () = msg_send![container, setFrame: container_frame];
            let first: Rect = msg_send![buttons[0], frame];
            let second: Rect = msg_send![buttons[1], frame];
            let step = second.origin.x - first.origin.x;
            for (index, button) in buttons.into_iter().enumerate() {
                let frame: Rect = msg_send![button, frame];
                let origin = Point {
                    x: LIGHTS_LEFT + index as f64 * step,
                    y: (TITLE_ROW - frame.size.height) / 2.0,
                };
                let _: () = msg_send![button, setFrameOrigin: origin];
            }
        }
    });
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

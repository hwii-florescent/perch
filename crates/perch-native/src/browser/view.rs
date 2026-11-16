//! A browser page as a real WebKit view (wry 0.55's `WKWebView`) laid over the window's GPUI view, macOS only.
//!
//! Ported from the Tauri app's `perch-desktop/src/browser.rs` and `glass.rs` (focus hand-off, the nil-URL guard,
//! the title and icon script, the snapshot, local files), without Tauri. What the window needs from AppKit that
//! wry does not offer is here, and nowhere else: first responder, `_close`, the snapshot, the rounded layer.
//!
//! A page gets no IPC handler, no initialization script and no custom protocol: it is any site on the web and
//! must reach nothing of Perch's. Every call runs on the main thread (GPUI's), where wry and AppKit require it.

use super::{navigable, Action, Frame, PageEvent, PageFactory, PageView};
use futures::channel::mpsc::UnboundedSender;
use objc2::rc::Retained;
use objc2::runtime::{AnyObject, Bool};
use objc2::{class, msg_send, sel};
use raw_window_handle::{
    AppKitWindowHandle, HandleError, HasWindowHandle, RawWindowHandle, WindowHandle,
};
use std::cell::RefCell;
use std::ffi::c_void;
use std::path::{Path, PathBuf};
use std::ptr::NonNull;
use std::rc::{Rc, Weak};
use std::sync::Arc;
use wry::dpi::{LogicalPosition, LogicalSize};
use wry::{NewWindowResponse, WebViewBuilder, WebViewExtMacOS};

/// Each page's later answers, tagged with its key.
pub type Events = UnboundedSender<(String, PageEvent)>;

/// The window's GPUI `NSView`, which pages are children of and which takes the keyboard back.
#[derive(Clone, Copy)]
struct Parent(NonNull<c_void>);

impl HasWindowHandle for Parent {
    fn window_handle(&self) -> Result<WindowHandle<'_>, HandleError> {
        let raw = RawWindowHandle::AppKit(AppKitWindowHandle::new(self.0));
        // SAFETY: the view outlives every page: the window closes its pages before it goes.
        Ok(unsafe { WindowHandle::borrow_raw(raw) })
    }
}

/// Makes [`WryPage`]s over one window.
pub struct WryFactory {
    parent: Parent,
    events: Events,
}

impl WryFactory {
    /// `window`: the GPUI window pages go over. `None` where it has no AppKit view.
    pub fn new(window: &impl HasWindowHandle, events: Events) -> Option<Self> {
        let RawWindowHandle::AppKit(handle) = window.window_handle().ok()?.as_raw() else {
            return None;
        };
        Some(WryFactory {
            parent: Parent(handle.ns_view),
            events,
        })
    }
}

fn rect(frame: Frame) -> wry::Rect {
    wry::Rect {
        position: LogicalPosition::new(frame.x as f64, frame.y as f64).into(),
        size: LogicalSize::new(frame.width as f64, frame.height as f64).into(),
    }
}

/// The folder downloads go to: the person's Downloads.
fn downloads() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|home| PathBuf::from(home).join("Downloads"))
}

/// Whether a download may be written to `dest`: a plain file name directly in `folder` (wry joins the site's
/// suggested name, which could carry `..`).
pub(super) fn download_allowed(dest: &Path, folder: &Path) -> bool {
    dest.parent() == Some(folder)
        && dest
            .file_name()
            .and_then(|n| n.to_str())
            .is_some_and(|n| !n.is_empty() && n != ".." && !n.starts_with('.'))
}

/// Which navigations a page (or a frame in it) may make: the web, a blank or inline frame, and a local file
/// [`navigable`] allows. Other schemes (custom app links, `perch:`) are refused.
pub(super) fn frame_navigation_allowed(url: &str) -> bool {
    let scheme = url.split(':').next().unwrap_or("").to_ascii_lowercase();
    match scheme.as_str() {
        "http" | "https" | "about" | "data" | "blob" => true,
        "file" => navigable(url),
        _ => false,
    }
}

impl PageFactory for WryFactory {
    fn create(&mut self, key: &str, url: &str, frame: Frame, zoom: f64) -> Box<dyn PageView> {
        let file = super::address::web_url(url).is_none() && url != "about:blank";
        let first = if file { "about:blank" } else { url };
        // target=_blank and window.open stay in this page instead of vanishing.
        let navigate_to: Rc<RefCell<Weak<wry::WebView>>> = Default::default();
        let opener = navigate_to.clone();
        let builder = WebViewBuilder::new()
            .with_url(first)
            .with_bounds(rect(frame))
            .with_focused(false)
            .with_navigation_handler(|url| frame_navigation_allowed(&url))
            .with_new_window_req_handler(move |url, _| {
                if frame_navigation_allowed(&url) {
                    if let Some(view) = opener.borrow().upgrade() {
                        let _ = view.load_url(&url);
                    }
                }
                NewWindowResponse::Deny
            })
            .with_download_started_handler(|_, dest| {
                downloads().is_some_and(|folder| download_allowed(dest, &folder))
            });
        let view = match builder.build_as_child(&self.parent) {
            Ok(view) => Rc::new(view),
            Err(error) => {
                eprintln!("perch-native: a browser page could not be made: {error}");
                return Box::new(Gone);
            }
        };
        *navigate_to.borrow_mut() = Rc::downgrade(&view);
        let web = view.webview();
        let mut page = WryPage {
            key: key.into(),
            view,
            web,
            parent: self.parent,
            events: self.events.clone(),
        };
        // wry gives a new page the keyboard even when told not to: the window keeps it until asked.
        page.release_focus();
        page.round_bottom();
        let _ = page.view.zoom(zoom);
        if file {
            page.navigate(url);
        }
        Box::new(page)
    }
}

/// A view that could not be made: every call is nothing.
struct Gone;

impl PageView for Gone {
    fn set_frame(&mut self, _: Frame) {}
    fn set_visible(&mut self, _: bool) {}
    fn set_zoom(&mut self, _: f64) {}
    fn navigate(&mut self, _: &str) {}
    fn act(&mut self, _: Action) {}
    fn focus(&mut self) {}
    fn has_focus(&self) -> bool {
        false
    }
    fn release_focus(&mut self) -> bool {
        false
    }
    fn snapshot(&mut self) {}
    fn poll_location(&mut self) {}
    fn close(self: Box<Self>) {}
}

pub struct WryPage {
    key: String,
    view: Rc<wry::WebView>,
    /// The `WKWebView`, for the AppKit calls wry does not make.
    web: Retained<wry::WryWebView>,
    parent: Parent,
    events: Events,
}

/// Whether the window's first responder is `view` or inside it.
///
/// # Safety
/// `view` is a live `NSView`; main thread.
pub(super) unsafe fn responder_in(view: *mut AnyObject) -> bool {
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

/// Copy an NSString's bytes; `None` for nil.
///
/// # Safety
/// `text` is nil or a live NSString; main thread.
unsafe fn nsstring(text: *mut AnyObject) -> Option<String> {
    if text.is_null() {
        return None;
    }
    unsafe {
        let bytes: *const std::ffi::c_char = msg_send![text, UTF8String];
        (!bytes.is_null()).then(|| {
            std::ffi::CStr::from_ptr(bytes)
                .to_string_lossy()
                .into_owned()
        })
    }
}

/// The page's declared icon, else the site's /favicon.ico; "" for a page with no origin (the desktop's).
const ICON_SCRIPT: &std::ffi::CStr = c"(() => { if (!location.origin.startsWith('http')) return ''; const link = document.querySelector('link[rel~=\"icon\"]') || document.querySelector('link[rel=\"apple-touch-icon\"]'); return link && link.href ? link.href : location.origin + '/favicon.ico'; })()";

/// A pane's corner radius (DECISIONS: `--radius-pane`).
const PANE_RADIUS: f64 = 8.;

impl WryPage {
    fn web(&self) -> *mut AnyObject {
        Retained::as_ptr(&self.web) as *mut AnyObject
    }

    fn send(&self, event: PageEvent) {
        let _ = self.events.unbounded_send((self.key.clone(), event));
    }

    /// The page sits under its toolbar: square at the top, rounded at the bottom like the panes beside it.
    fn round_bottom(&self) {
        // SAFETY: `web` is the live WKWebView; main thread; the layer is nil-checked.
        unsafe {
            let _: () = msg_send![self.web(), setWantsLayer: true];
            let layer: *mut AnyObject = msg_send![self.web(), layer];
            if layer.is_null() {
                return;
            }
            let flipped: Bool = msg_send![self.web(), isFlipped];
            // kCALayerMinXMinYCorner 1, MaxXMinY 2, MinXMaxY 4, MaxXMaxY 8; a flipped view's bottom is MaxY.
            let bottom: usize = if flipped.as_bool() { 4 | 8 } else { 1 | 2 };
            let _: () = msg_send![layer, setCornerRadius: PANE_RADIUS];
            let _: () = msg_send![layer, setMaskedCorners: bottom];
            let _: () = msg_send![layer, setMasksToBounds: true];
        }
    }

    /// WKWebView refuses a `file:` URL given to `loadRequest` (what wry navigates with); it needs `loadFileURL`
    /// with a read root, the file's folder, so the page's relative styles and images load.
    fn load_file(&self, url: &str) {
        let Some(path) = url::Url::parse(url)
            .ok()
            .and_then(|u| u.to_file_path().ok())
        else {
            return;
        };
        let dir = path.parent().unwrap_or(&path).to_path_buf();
        // SAFETY: main thread, live WKWebView; NSURL and NSString are made here and retained by the call.
        unsafe {
            let file: *mut AnyObject = msg_send![class!(NSURL), fileURLWithPath: ns(&path.to_string_lossy()), isDirectory: false];
            let root: *mut AnyObject = msg_send![class!(NSURL), fileURLWithPath: ns(&dir.to_string_lossy()), isDirectory: true];
            let _: *mut AnyObject =
                msg_send![self.web(), loadFileURL: file, allowingReadAccessToURL: root];
        }
    }
}

fn ns(text: &str) -> *mut AnyObject {
    let text = std::ffi::CString::new(text.replace('\0', "")).unwrap_or_default();
    // SAFETY: a valid C string; the result is autoreleased and used at once.
    unsafe { msg_send![class!(NSString), stringWithUTF8String: text.as_ptr()] }
}

impl PageView for WryPage {
    fn set_frame(&mut self, frame: Frame) {
        let _ = self.view.set_bounds(rect(frame));
    }

    fn set_visible(&mut self, visible: bool) {
        let _ = self.view.set_visible(visible);
    }

    fn set_zoom(&mut self, zoom: f64) {
        let _ = self.view.zoom(zoom);
    }

    fn navigate(&mut self, url: &str) {
        if !navigable(url) {
            return;
        }
        if super::address::web_url(url).is_some() || url == "about:blank" {
            let _ = self.view.load_url(url);
        } else if let Some(file) = super::address::file_url(url) {
            self.load_file(&file);
        }
    }

    fn act(&mut self, action: Action) {
        let _ = match action {
            Action::Back => self.view.evaluate_script("history.back()"),
            Action::Forward => self.view.evaluate_script("history.forward()"),
            Action::Reload => self.view.reload(),
        };
    }

    fn focus(&mut self) {
        // SAFETY: main thread, live WKWebView; the window is nil-checked; a hidden page is never given keys.
        unsafe {
            if responder_in(self.web()) {
                return;
            }
            let hidden: Bool = msg_send![self.web(), isHiddenOrHasHiddenAncestor];
            let window: *mut AnyObject = msg_send![self.web(), window];
            if !hidden.as_bool() && !window.is_null() {
                let _: Bool = msg_send![window, makeFirstResponder: self.web()];
            }
        }
    }

    fn has_focus(&self) -> bool {
        // SAFETY: main thread, live WKWebView.
        unsafe { responder_in(self.web()) }
    }

    fn release_focus(&mut self) -> bool {
        // SAFETY: main thread; both views are live (the parent outlives its pages).
        unsafe {
            if !responder_in(self.web()) {
                return false;
            }
            let window: *mut AnyObject = msg_send![self.web(), window];
            let _: Bool =
                msg_send![window, makeFirstResponder: self.parent.0.as_ptr() as *mut AnyObject];
            true
        }
    }

    fn snapshot(&mut self) {
        let (events, key) = (self.events.clone(), self.key.clone());
        let done = block2::RcBlock::new(move |image: *mut AnyObject, _error: *mut AnyObject| {
            // SAFETY: WebKit calls this once on the main thread with an NSImage or nil; every result is nil-checked.
            let png = unsafe {
                if image.is_null() {
                    return;
                }
                let tiff: *mut AnyObject = msg_send![image, TIFFRepresentation];
                let rep: *mut AnyObject =
                    msg_send![class!(NSBitmapImageRep), imageRepWithData: tiff];
                if rep.is_null() {
                    return;
                }
                let empty: *mut AnyObject = msg_send![class!(NSDictionary), dictionary];
                // NSBitmapImageFileTypePNG = 4
                let data: *mut AnyObject =
                    msg_send![rep, representationUsingType: 4usize, properties: empty];
                if data.is_null() {
                    return;
                }
                let length: usize = msg_send![data, length];
                let bytes: *const u8 = msg_send![data, bytes];
                std::slice::from_raw_parts(bytes, length).to_vec()
            };
            let _ = events.unbounded_send((key.clone(), PageEvent::Snapshot(Arc::new(png))));
        });
        // SAFETY: main thread, live WKWebView; WebKit copies the block.
        unsafe {
            let _: () = msg_send![self.web(), takeSnapshotWithConfiguration: std::ptr::null_mut::<AnyObject>(), completionHandler: &*done];
        }
    }

    fn poll_location(&mut self) {
        // WKWebView.URL is nil until a navigation commits; wry 0.55's `url()` unwraps it and aborts, so read it here.
        // SAFETY: main thread, live WKWebView; each result is nil-checked and copied at once.
        let (url, title) = unsafe {
            let url: *mut AnyObject = msg_send![self.web(), URL];
            let url = if url.is_null() {
                None
            } else {
                nsstring(msg_send![url, absoluteString])
            };
            (
                url,
                nsstring(msg_send![self.web(), title]).unwrap_or_default(),
            )
        };
        let Some(url) = url else { return };
        if super::address::web_url(&url).is_none() {
            self.send(PageEvent::Location {
                url,
                title,
                icon: String::new(),
            });
            return;
        }
        let (events, key) = (self.events.clone(), self.key.clone());
        let done = block2::RcBlock::new(move |result: *mut AnyObject, _error: *mut AnyObject| {
            // SAFETY: WebKit calls this on the main thread with the script's string result or nil.
            let icon = unsafe { nsstring(result) }.unwrap_or_default();
            let event = PageEvent::Location {
                url: url.clone(),
                title: title.clone(),
                icon,
            };
            let _ = events.unbounded_send((key.clone(), event));
        });
        // SAFETY: main thread, live WKWebView; WebKit copies the block and retains the script.
        unsafe {
            let script: *mut AnyObject =
                msg_send![class!(NSString), stringWithUTF8String: ICON_SCRIPT.as_ptr()];
            let _: () =
                msg_send![self.web(), evaluateJavaScript: script, completionHandler: &*done];
        }
    }

    fn close(mut self: Box<Self>) {
        self.release_focus();
        // A released WKWebView leaves its WebContent process (tens of MB) running for the life of the app; the
        // private `_close` ends it within a second (measured). Guarded: without it the view is just released.
        // SAFETY: main thread, live WKWebView; the selector takes no arguments and returns nothing.
        unsafe {
            let responds: Bool = msg_send![self.web(), respondsToSelector: sel!(_close)];
            if responds.as_bool() {
                let _: () = msg_send![self.web(), _close];
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn downloads_stay_directly_in_the_folder() {
        let folder = Path::new("/Users/x/Downloads");
        assert!(download_allowed(&folder.join("report (1).pdf"), folder));
        assert!(!download_allowed(&folder.join("../evil.sh"), folder));
        assert!(!download_allowed(&folder.join("sub/file"), folder));
        assert!(!download_allowed(&folder.join(".zshrc"), folder));
        assert!(!download_allowed(Path::new("/tmp/file"), folder));
    }

    #[test]
    fn frames_may_load_the_web_and_inline_content_only() {
        for ok in [
            "https://a.test/",
            "http://localhost:3000/",
            "about:blank",
            "about:srcdoc",
            "data:text/html,x",
            "blob:https://a.test/1",
        ] {
            assert!(frame_navigation_allowed(ok), "{ok}");
        }
        for refused in [
            "perch://open?x",
            "mailto:a@b",
            "javascript:alert(1)",
            "file:///no/such/file",
            "slack://open",
            "ftp://x/",
        ] {
            assert!(!frame_navigation_allowed(refused), "{refused}");
        }
    }
}

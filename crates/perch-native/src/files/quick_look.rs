//! Quick Look's panel for one file, macOS only.
//!
//! `QLPreviewPanel` takes its data source from a controller it finds on the key window's
//! responder chain (`acceptsPreviewPanelControl:`); setting one without a controller is
//! deprecated. GPUI's window has no such method and is not patched, so a small `NSResponder`
//! of ours is put on the chain right after the `NSWindow` (standard AppKit: a window's next
//! responder may be any responder) and answers for the panel. It is added once per window and
//! stays; it only ever answers the panel.
//!
//! Called only from a person's click, so the panel may take the keyboard.

use objc2::rc::Retained;
use objc2::runtime::{AnyClass, AnyObject};
use objc2::{define_class, msg_send, DefinedClass, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::NSResponder;
use objc2_foundation::{NSString, NSURL};
use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use std::cell::RefCell;
use std::path::Path;

// `QLPreviewPanel` lives in Quartz's QuickLookUI; linking it makes the class findable.
#[link(name = "Quartz", kind = "framework")]
extern "C" {}

#[derive(Default)]
struct Item {
    url: RefCell<Option<Retained<NSURL>>>,
}

define_class!(
    #[unsafe(super(NSResponder))]
    #[thread_kind = MainThreadOnly]
    #[name = "PerchPreviewController"]
    #[ivars = Item]
    struct Controller;

    impl Controller {
        #[unsafe(method(acceptsPreviewPanelControl:))]
        fn accepts(&self, _panel: &AnyObject) -> bool {
            self.ivars().url.borrow().is_some()
        }

        #[unsafe(method(beginPreviewPanelControl:))]
        fn begin(&self, panel: &AnyObject) {
            let _: () = unsafe { msg_send![panel, setDataSource: self] };
        }

        #[unsafe(method(endPreviewPanelControl:))]
        fn end(&self, panel: &AnyObject) {
            let _: () = unsafe { msg_send![panel, setDataSource: std::ptr::null::<AnyObject>()] };
        }

        #[unsafe(method(numberOfPreviewItemsInPreviewPanel:))]
        fn count(&self, _panel: &AnyObject) -> isize {
            isize::from(self.ivars().url.borrow().is_some())
        }

        #[unsafe(method(previewPanel:previewItemAtIndex:))]
        fn item(&self, _panel: &AnyObject, _index: isize) -> *mut NSURL {
            self.ivars()
                .url
                .borrow()
                .as_ref()
                .map_or(std::ptr::null_mut(), |url| Retained::as_ptr(url).cast_mut())
        }
    }
);

thread_local! {
    /// The controller on each window's chain, by `NSWindow` address.
    static CONTROLLERS: RefCell<Vec<(usize, Retained<Controller>)>> = RefCell::default();
}

/// The `NSWindow` behind a GPUI window.
fn ns_window(window: &gpui::Window) -> Option<Retained<AnyObject>> {
    let RawWindowHandle::AppKit(handle) = HasWindowHandle::window_handle(window).ok()?.as_raw()
    else {
        return None;
    };
    let view = handle.ns_view.as_ptr().cast::<AnyObject>();
    unsafe { msg_send![view, window] }
}

/// Shows `path` in Quick Look over `window`. False when there is no panel or no AppKit window
/// (the caller then opens the default app).
pub fn show(path: &Path, window: &gpui::Window) -> bool {
    let Some(mtm) = MainThreadMarker::new() else {
        return false;
    };
    let (Some(ns_window), Some(panel_class)) =
        (ns_window(window), AnyClass::get(c"QLPreviewPanel"))
    else {
        return false;
    };
    let key = Retained::as_ptr(&ns_window) as usize;
    let controller = CONTROLLERS.with(|all| {
        let mut all = all.borrow_mut();
        if let Some((_, controller)) = all.iter().find(|(at, _)| *at == key) {
            return controller.clone();
        }
        let controller: Retained<Controller> = unsafe {
            msg_send![
                super(Controller::alloc(mtm).set_ivars(Item::default())),
                init
            ]
        };
        unsafe {
            let next: *mut AnyObject = msg_send![&*ns_window, nextResponder];
            let _: () = msg_send![&*controller, setNextResponder: next];
            let _: () = msg_send![&*ns_window, setNextResponder: &*controller];
        }
        all.push((key, controller.clone()));
        controller
    });
    let path = NSString::from_str(&path.to_string_lossy());
    *controller.ivars().url.borrow_mut() = Some(NSURL::fileURLWithPath(&path));
    unsafe {
        let panel: *mut AnyObject = msg_send![panel_class, sharedPreviewPanel];
        if panel.is_null() {
            return false;
        }
        let _: () = msg_send![panel, updateController];
        let visible: bool = msg_send![panel, isVisible];
        if visible {
            let _: () = msg_send![panel, reloadData];
        } else {
            let _: () = msg_send![panel, makeKeyAndOrderFront: std::ptr::null::<AnyObject>()];
        }
    }
    true
}

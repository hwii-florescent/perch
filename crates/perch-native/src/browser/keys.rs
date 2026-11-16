//! The window's shortcuts and click-to-focus while a browser page has the keyboard, macOS only.
//!
//! A page is a `WKWebView` over GPUI's view; when it is first responder AppKit hands it every key, window
//! shortcuts included, and GPUI never hears of them (measured). So, as the Tauri app does (`shortcuts.rs`), a
//! local `NSEvent` monitor, installed with the first page and removed with the last, looks at each key-down first:
//! a press that resolves to one of the window's own commands is taken from the page and handed to the window;
//! anything else (typing, Escape, the site's own keys) reaches the page untouched. A key during IME composition is
//! never a shortcut.
//!
//! The same monitor gives the keyboard to whatever a press lands on: a page, or GPUI's view. AppKit's own
//! click-to-focus is not relied on (it cannot be proven headless, and GPUI never asks for first responder back).
//!
//! All AppKit focus juggling for pages is here and in `view.rs`; nothing else touches first responder.

use crate::keymap::Hit;
use gpui::{Keystroke, Modifiers};
use objc2::runtime::{AnyObject, Bool};
use objc2::{class, msg_send, Encode, Encoding};
use std::rc::Rc;

#[repr(C)]
#[derive(Clone, Copy)]
struct Point {
    x: f64,
    y: f64,
}

// SAFETY: the layout of `CGPoint` (two doubles), as AppKit passes it.
unsafe impl Encode for Point {
    const ENCODING: Encoding = Encoding::Struct("CGPoint", &[Encoding::Double, Encoding::Double]);
}

const KEY_DOWN: usize = 10;
const LEFT_MOUSE_DOWN: usize = 1;
const SHIFT: usize = 1 << 17;
const CONTROL: usize = 1 << 18;
const OPTION: usize = 1 << 19;
const COMMAND: usize = 1 << 20;
const FUNCTION: usize = 1 << 23;

/// GPUI's name for a key AppKit reports by virtual key code, for keys that type no character.
fn named(code: u16) -> Option<&'static str> {
    Some(match code {
        36 | 76 => "enter",
        48 => "tab",
        49 => "space",
        51 => "backspace",
        53 => "escape",
        117 => "delete",
        123 => "left",
        124 => "right",
        125 => "down",
        126 => "up",
        115 => "home",
        119 => "end",
        116 => "pageup",
        121 => "pagedown",
        122 => "f1",
        120 => "f2",
        99 => "f3",
        118 => "f4",
        96 => "f5",
        97 => "f6",
        98 => "f7",
        100 => "f8",
        101 => "f9",
        109 => "f10",
        103 => "f11",
        111 => "f12",
        _ => return None,
    })
}

/// The press as GPUI would report it: `base` is the key's character with no modifiers applied (AppKit's
/// `charactersByApplyingModifiers: 0`), `typed` what it would type (`characters`).
pub fn keystroke(base: &str, typed: &str, code: u16, flags: usize) -> Keystroke {
    let modifiers = Modifiers {
        control: flags & CONTROL != 0,
        alt: flags & OPTION != 0,
        shift: flags & SHIFT != 0,
        platform: flags & COMMAND != 0,
        // The arrows and other named keys carry the function flag on their own; GPUI drops it for them.
        function: flags & FUNCTION != 0 && named(code).is_none(),
    };
    let key = named(code)
        .map(str::to_string)
        .unwrap_or_else(|| base.to_lowercase());
    let key_char =
        (!typed.is_empty() && named(code).is_none() && !modifiers.control && !modifiers.platform)
            .then(|| typed.to_string());
    Keystroke {
        modifiers,
        key,
        key_char,
    }
}

/// Whether the window takes a press from the page: what the window's keymap made of it, in a page's context
/// (not a terminal; plain keys are typing). Commands, a broken binding and the leader's own Escape are the
/// window's; text a binding would type into a terminal, and everything unbound, are the page's.
pub fn window_takes(hit: Option<&Hit>, key: &str) -> bool {
    match hit {
        Some(Hit::Run { .. } | Hit::Fault(_)) => true,
        Some(Hit::LeaderEnded) => key == "escape",
        Some(Hit::Send(_) | Hit::Edit(_) | Hit::Terminal) | None => false,
    }
}

/// The installed monitor; removed when dropped.
pub struct Monitor {
    token: *mut AnyObject,
}

impl Drop for Monitor {
    fn drop(&mut self) {
        // SAFETY: `token` is the monitor AppKit returned; main thread.
        unsafe {
            let _: () = msg_send![class!(NSEvent), removeMonitor: self.token];
        }
    }
}

/// Whether `view` is a `WKWebView` or inside one; that view.
///
/// # Safety
/// `view` is nil or a live `NSView`; main thread.
unsafe fn page_of(mut view: *mut AnyObject) -> Option<*mut AnyObject> {
    unsafe {
        while !view.is_null() {
            let is_page: Bool = msg_send![view, isKindOfClass: class!(WKWebView)];
            if is_page.as_bool() {
                return Some(view);
            }
            view = msg_send![view, superview];
        }
    }
    None
}

/// Watch key-downs and presses for the window whose GPUI view is `parent`. `take` gets each key-down made while
/// a page has the keyboard and says whether the window takes it (it then runs it later, on its own turn).
///
/// # Safety
/// `parent` is the live GPUI `NSView` pages are children of, alive until the monitor is dropped; main thread.
pub unsafe fn install(parent: *mut AnyObject, take: Rc<dyn Fn(&Keystroke) -> bool>) -> Monitor {
    let parent_addr = parent as usize;
    let block = block2::RcBlock::new(move |event: *mut AnyObject| -> *mut AnyObject {
        let parent = parent_addr as *mut AnyObject;
        // SAFETY: AppKit hands a live NSEvent on the main thread; every object reached is nil-checked.
        unsafe {
            let window: *mut AnyObject = msg_send![parent, window];
            let target: *mut AnyObject = msg_send![event, window];
            if window.is_null() || target != window {
                return event;
            }
            let kind: usize = msg_send![event, type];
            let responder: *mut AnyObject = msg_send![window, firstResponder];
            let is_view: Bool = msg_send![responder, isKindOfClass: class!(NSView)];
            let in_page = if is_view.as_bool() {
                page_of(responder)
            } else {
                None
            };
            if kind == LEFT_MOUSE_DOWN {
                let content: *mut AnyObject = msg_send![window, contentView];
                let frame: *mut AnyObject = msg_send![content, superview];
                let at: Point = msg_send![event, locationInWindow];
                let local: Point =
                    msg_send![frame, convertPoint: at, fromView: std::ptr::null_mut::<AnyObject>()];
                let hit: *mut AnyObject = msg_send![frame, hitTest: local];
                match page_of(hit) {
                    Some(page) if in_page != Some(page) => {
                        let _: Bool = msg_send![window, makeFirstResponder: page];
                    }
                    None if in_page.is_some() => {
                        let _: Bool = msg_send![window, makeFirstResponder: parent];
                    }
                    _ => {}
                }
                return event;
            }
            if kind != KEY_DOWN || in_page.is_none() {
                return event;
            }
            let has_marked: Bool =
                msg_send![responder, respondsToSelector: objc2::sel!(hasMarkedText)];
            if has_marked.as_bool() {
                let composing: Bool = msg_send![responder, hasMarkedText];
                if composing.as_bool() {
                    return event;
                }
            }
            let flags: usize = msg_send![event, modifierFlags];
            let code: u16 = msg_send![event, keyCode];
            let base: *mut AnyObject = msg_send![event, charactersByApplyingModifiers: 0usize];
            let typed: *mut AnyObject = msg_send![event, characters];
            let text = |s: *mut AnyObject| -> String {
                if s.is_null() {
                    return String::new();
                }
                let bytes: *const std::ffi::c_char = msg_send![s, UTF8String];
                if bytes.is_null() {
                    String::new()
                } else {
                    std::ffi::CStr::from_ptr(bytes)
                        .to_string_lossy()
                        .into_owned()
                }
            };
            if take(&keystroke(&text(base), &text(typed), code, flags)) {
                std::ptr::null_mut()
            } else {
                event
            }
        }
    });
    // SAFETY: main thread; AppKit copies the block. Mask: key down (1 << 10) and left mouse down (1 << 1).
    let token: *mut AnyObject = unsafe {
        msg_send![class!(NSEvent), addLocalMonitorForEventsMatchingMask: (1u64 << 10) | (1u64 << 1), handler: &*block]
    };
    Monitor { token }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keystrokes_read_like_gpuis() {
        let k = keystroke("t", "t", 17, COMMAND);
        assert_eq!(
            (k.key.as_str(), k.modifiers.platform, k.key_char),
            ("t", true, None)
        );
        // Shift with a symbol: the base key and the shift flag, as GPUI binds `cmd-shift-]`.
        let k = keystroke("]", "}", 30, COMMAND | SHIFT);
        assert_eq!((k.key.as_str(), k.modifiers.shift), ("]", true));
        let k = keystroke("", "", 123, FUNCTION | CONTROL);
        assert_eq!(
            (k.key.as_str(), k.modifiers.function, k.modifiers.control),
            ("left", false, true)
        );
        let k = keystroke("a", "A", 0, SHIFT);
        assert_eq!((k.key.as_str(), k.key_char.as_deref()), ("a", Some("A")));
        assert_eq!(keystroke("\u{1b}", "\u{1b}", 53, 0).key, "escape");
    }

    #[test]
    fn window_takes_commands_but_not_typing_or_unbound_keys() {
        let run = Hit::Run {
            name: "tabs.next".into(),
            args: None,
        };
        assert!(window_takes(Some(&run), "]"));
        assert!(window_takes(Some(&Hit::Fault("bad".into())), "k"));
        assert!(window_takes(Some(&Hit::LeaderEnded), "escape"));
        assert!(
            !window_takes(Some(&Hit::LeaderEnded), "x"),
            "any other key still reaches the page"
        );
        assert!(!window_takes(Some(&Hit::Send("ls\n".into())), "l"));
        assert!(!window_takes(Some(&Hit::Edit("\u{1}")), "left"));
        assert!(!window_takes(Some(&Hit::Terminal), "c"));
        assert!(!window_takes(None, "escape"), "Escape is the page's");
    }
}

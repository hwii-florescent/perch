//! Native browser keyboard bridge. The main document supplies the effective keymap; this
//! module only translates AppKit events and forwards matched commands. Browser pages receive
//! no IPC. Main-view keys stay with the DOM/native menus; unmatched page input is untouched.
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

/// [command id, KeyboardEvent.code, optional layout letter, Cmd/Ctrl/Alt/Shift bitmask].
pub type Binding = crate::browser::NativeBinding;
#[derive(Default)]
pub struct Bindings(pub Mutex<(String, u64, Vec<Binding>, Option<String>)>);

pub fn configure(app: &AppHandle, epoch: &str, generation: u64, bindings: Vec<Binding>) {
    *app.state::<Bindings>().0.lock().unwrap() = (epoch.into(), generation, bindings, None);
}

pub fn validate(bindings: &[Binding]) -> Result<(), String> {
    if bindings.len() > 512
        || bindings.iter().any(|(id, code, letter, mods)| {
            id.is_empty()
                || id.len() > 128
                || !id
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || b".-_".contains(&c))
                || code.is_empty()
                || code.len() > 32
                || !code.bytes().all(|c| c.is_ascii_alphanumeric())
                || letter
                    .as_ref()
                    .is_some_and(|s| s.len() != 1 || !s.bytes().all(|c| c.is_ascii_lowercase()))
                || *mods > 15
        })
    {
        return Err("invalid native shortcut table".into());
    }
    Ok(())
}

fn matches(binding: &Binding, code: &str, key: &str, mods: u8) -> bool {
    binding.3 == mods
        && (binding.1 == code
            || (mods & 4 == 0
                && binding
                    .2
                    .as_ref()
                    .is_some_and(|letter| key.eq_ignore_ascii_case(letter))))
}

/// Apple's virtual key codes -> KeyboardEvent.code. These are hardware identities, NOT
/// shortcut defaults. Layout letters use the same fallback as keyCombo.ts::comboMatches.
fn physical_code(key: u16) -> &'static str {
    match key {
        0 => "KeyA",
        1 => "KeyS",
        2 => "KeyD",
        3 => "KeyF",
        4 => "KeyH",
        5 => "KeyG",
        6 => "KeyZ",
        7 => "KeyX",
        8 => "KeyC",
        9 => "KeyV",
        11 => "KeyB",
        12 => "KeyQ",
        13 => "KeyW",
        14 => "KeyE",
        15 => "KeyR",
        16 => "KeyY",
        17 => "KeyT",
        18 => "Digit1",
        19 => "Digit2",
        20 => "Digit3",
        21 => "Digit4",
        22 => "Digit6",
        23 => "Digit5",
        24 => "Equal",
        25 => "Digit9",
        26 => "Digit7",
        27 => "Minus",
        28 => "Digit8",
        29 => "Digit0",
        30 => "BracketRight",
        31 => "KeyO",
        32 => "KeyU",
        33 => "BracketLeft",
        34 => "KeyI",
        35 => "KeyP",
        36 => "Enter",
        37 => "KeyL",
        38 => "KeyJ",
        39 => "Quote",
        40 => "KeyK",
        41 => "Semicolon",
        42 => "Backslash",
        43 => "Comma",
        44 => "Slash",
        45 => "KeyN",
        46 => "KeyM",
        47 => "Period",
        48 => "Tab",
        49 => "Space",
        50 => "Backquote",
        51 => "Backspace",
        53 => "Escape",
        96 => "F5",
        97 => "F6",
        98 => "F7",
        99 => "F3",
        100 => "F8",
        101 => "F9",
        103 => "F11",
        109 => "F10",
        111 => "F12",
        115 => "Home",
        116 => "PageUp",
        117 => "Delete",
        118 => "F4",
        119 => "End",
        120 => "F2",
        121 => "PageDown",
        122 => "F1",
        123 => "ArrowLeft",
        124 => "ArrowRight",
        125 => "ArrowDown",
        126 => "ArrowUp",
        _ => "",
    }
}

thread_local! {
    static MONITOR: std::cell::RefCell<Option<objc2::rc::Retained<objc2::runtime::AnyObject>>> = const { std::cell::RefCell::new(None) };
}

pub fn install(app: &AppHandle) {
    use objc2::{class, msg_send, runtime::AnyObject};
    app.manage(Bindings::default());
    let handle = app.clone();
    let block = block2::RcBlock::new(move |event: *mut AnyObject| -> *mut AnyObject {
        // SAFETY: AppKit local event monitors run on the main thread with a live event.
        if unsafe { handle_key(&handle, event) } {
            std::ptr::null_mut()
        } else {
            event
        }
    });
    MONITOR.with_borrow_mut(|monitor| unsafe {
        if let Some(old) = monitor.take() { let _: () = msg_send![class!(NSEvent), removeMonitor: &*old]; }
        let token: *mut AnyObject = msg_send![class!(NSEvent), addLocalMonitorForEventsMatchingMask: (1u64 << 10) | (1u64 << 1) | (1u64 << 3) | (1u64 << 25), handler: &*block];
        *monitor = objc2::rc::Retained::retain(token);
    });
}

/// Mark native browser views without retaining raw view pointers across close/recreation.
/// A web page cannot change its enclosing NSView's identifier.
pub fn tag_browser(view: &tauri::Webview, id: &str) -> tauri::Result<()> {
    let identifier =
        std::ffi::CString::new(format!("perch-browser-{id}")).expect("validated browser id");
    view.with_webview(move |platform| unsafe {
        use objc2::{class, msg_send, runtime::AnyObject};
        let identifier: *mut AnyObject =
            msg_send![class!(NSString), stringWithUTF8String: identifier.as_ptr()];
        let view = platform.inner().cast::<AnyObject>();
        let _: () = msg_send![view, setIdentifier: identifier];
    })
}

unsafe fn string(object: *mut objc2::runtime::AnyObject) -> String {
    use objc2::msg_send;
    if object.is_null() {
        return String::new();
    }
    unsafe {
        let bytes: *const std::ffi::c_char = msg_send![object, UTF8String];
        if bytes.is_null() {
            String::new()
        } else {
            std::ffi::CStr::from_ptr(bytes)
                .to_string_lossy()
                .into_owned()
        }
    }
}

/// Exposed to the hidden AppKit probe so it tests the installed monitor's actual path.
/// # Safety
/// Call only on the main thread with a live NSEvent.
pub unsafe fn handle_key(app: &AppHandle, event: *mut objc2::runtime::AnyObject) -> bool {
    use objc2::{
        class, msg_send,
        runtime::{AnyObject, Bool},
        sel,
    };
    if event.is_null() {
        return false;
    }
    unsafe {
        let kind: usize = msg_send![event, type];
        if kind != 10 {
            app.state::<Bindings>().0.lock().unwrap().3 = None;
            return false; // A pointer focus gesture starts a fresh native focus context.
        }
        let window: *mut AnyObject = msg_send![event, window];
        if window.is_null() {
            return false;
        }
        let responder: *mut AnyObject = msg_send![window, firstResponder];
        if responder.is_null() {
            return false;
        }
        let view: Bool = msg_send![responder, isKindOfClass: class!(NSView)];
        if !view.as_bool() {
            return false;
        }
        let marked: Bool = msg_send![responder, respondsToSelector: sel!(hasMarkedText)];
        if marked.as_bool() {
            let marked: Bool = msg_send![responder, hasMarkedText];
            if marked.as_bool() {
                return false;
            }
        }
        let mut ancestor = responder;
        let mut browser = String::new();
        while !ancestor.is_null() {
            let webview: Bool = msg_send![ancestor, isKindOfClass: class!(WKWebView)];
            if webview.as_bool() {
                let identifier: *mut AnyObject = msg_send![ancestor, identifier];
                if let Some(id) = string(identifier).strip_prefix("perch-browser-") {
                    browser = id.into();
                }
                break;
            }
            ancestor = msg_send![ancestor, superview];
        }
        if browser.is_empty()
            || !browser
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'-')
            || app.get_webview(&format!("browser-{browser}")).is_none()
        {
            app.state::<Bindings>().0.lock().unwrap().3 = None;
            return false;
        }
        let hidden: Bool = msg_send![ancestor, isHiddenOrHasHiddenAncestor];
        if hidden.as_bool() {
            return false;
        }
        let flags: usize = msg_send![event, modifierFlags];
        let mods = u8::from(flags & (1 << 20) != 0)
            | (u8::from(flags & (1 << 18) != 0) << 1)
            | (u8::from(flags & (1 << 19) != 0) << 2)
            | (u8::from(flags & (1 << 17) != 0) << 3);
        let hardware: u16 = msg_send![event, keyCode];
        let text: *mut AnyObject = msg_send![event, charactersIgnoringModifiers];
        let key = string(text);
        let bindings = app.state::<Bindings>();
        let script = {
            let mut config = bindings.0.lock().unwrap();
            let Some((index, _)) = config
                .2
                .iter()
                .enumerate()
                .find(|(_, binding)| matches(binding, physical_code(hardware), &key, mods))
            else {
                return false;
            };
            let repeat: Bool = msg_send![event, isARepeat];
            if repeat.as_bool() {
                return true;
            }
            let focused = config.3.as_deref() != Some(&browser);
            config.3 = Some(browser.clone());
            // Select a newly focused pane once, not again for queued tab-cycle commands.
            format!("window.dispatchEvent(new CustomEvent('perch:command', {{ detail: {{ index: {index}, id: '{browser}', epoch: '{}', generation: {}, focused: {focused} }} }}))", config.0, config.1)
        };
        if let Some(main) = app.get_webview("main") {
            return main.eval(script).is_ok();
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn binding(id: &str, code: &str, letter: Option<&str>, mods: u8) -> Binding {
        (id.into(), code.into(), letter.map(Into::into), mods)
    }
    #[test]
    fn compiled_bindings_use_physical_digits_exact_modifiers_and_layout_letters() {
        assert!(matches(
            &binding("tabs.jump1", "Digit1", None, 1),
            physical_code(18),
            "1",
            1
        ));
        assert!(matches(
            &binding("nests.jump1", "Digit1", None, 10),
            physical_code(18),
            "!",
            10
        ));
        assert!(!matches(
            &binding("nests.jump1", "Digit1", None, 10),
            physical_code(18),
            "1",
            2
        ));
        assert!(matches(
            &binding("tabs.close", "KeyW", Some("w"), 1),
            physical_code(6),
            "W",
            1
        ));
        assert!(!matches(
            &binding("panes.test", "KeyW", Some("w"), 5),
            physical_code(6),
            "w",
            5
        ));
        assert!(!matches(
            &binding("tabs.close", "KeyW", Some("w"), 1),
            physical_code(500),
            "",
            1
        ));
    }
    #[test]
    fn malformed_native_tables_are_rejected() {
        assert!(validate(&[binding("tabs.close", "KeyW", Some("w"), 1)]).is_ok());
        for invalid in [
            binding("a'b", "KeyW", None, 1),
            binding("tabs.close", "'", None, 1),
            binding("tabs.close", "KeyW", Some("xx"), 1),
            binding("tabs.close", "KeyW", None, 16),
        ] {
            assert!(validate(&[invalid]).is_err());
        }
    }
}

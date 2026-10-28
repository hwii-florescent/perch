//! Native browser keyboard bridge. The main document supplies the effective keymap; this
//! module only translates AppKit events and forwards matched commands. Browser pages receive
//! no IPC. Main-view keys stay with the DOM/native menus; unmatched page input is untouched.
use std::{
    collections::{HashMap, HashSet},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};

/// [command id, KeyboardEvent.code, optional layout letter, Cmd/Ctrl/Alt/Shift bitmask].
pub type Binding = crate::browser::NativeBinding;
pub type Mode = crate::browser::NativeMode;
#[derive(Default)]
pub struct Bindings(Mutex<Keymap>);
#[derive(Default)]
struct Keymap {
    epoch: String,
    generation: u64,
    keys: Vec<Binding>,
    modes: HashMap<String, (Option<String>, Option<String>, bool)>,
    timeout: Duration,
    mode: Option<(String, Instant)>,
    page: Option<String>,
    observed: Option<String>,
    watched: Option<(usize, isize)>,
}
#[derive(Debug, PartialEq)]
enum Resolution {
    Pass,
    Consume,
    Invoke(usize),
}
impl Keymap {
    fn reset(&mut self) {
        self.mode = None;
        self.page = None;
        self.observed = None;
    }
    fn normal_bound(&self, code: &str, key: &str, mods: u8) -> bool {
        self.keys.iter().any(|b| {
            matches(b, code, key, mods) && self.modes.get(&b.0).is_none_or(|m| m.0.is_none())
        })
    }
    fn resolve(
        &mut self,
        code: &str,
        key: &str,
        mods: u8,
        repeat: bool,
        composing: bool,
        now: Instant,
    ) -> Resolution {
        if composing {
            self.mode = None;
            return if self.normal_bound(code, key, mods) {
                Resolution::Consume
            } else {
                Resolution::Pass
            };
        }
        if key.is_empty() && !code.starts_with('F') {
            return if self.normal_bound(code, key, mods) {
                Resolution::Consume
            } else {
                Resolution::Pass
            };
        }
        if self
            .mode
            .as_ref()
            .is_some_and(|(_, deadline)| now >= *deadline)
        {
            self.mode = None;
        }
        let context = self.mode.as_ref().map(|(name, _)| name.clone());
        if context.is_some() && code == "Escape" && mods == 0 {
            self.mode = None;
            return Resolution::Consume;
        }
        let found = self.keys.iter().position(|b| {
            matches(b, code, key, mods)
                && self.modes.get(&b.0).and_then(|m| m.0.as_ref()) == context.as_ref()
        });
        let Some(index) = found else {
            // Holding the prefix is not a new follow-up and must not extend its deadline.
            if repeat
                && context.is_some()
                && self.keys.iter().any(|b| {
                    matches(b, code, key, mods)
                        && self
                            .modes
                            .get(&b.0)
                            .is_some_and(|m| m.0.is_none() && m.1.as_ref() == context.as_ref())
                })
            {
                return Resolution::Consume;
            }
            if context.is_some() {
                self.mode = None;
                // Cancel without running an app/menu command behind the chord. Otherwise
                // ordinary text/editing is left untouched, matching DOM cancellation.
                if self.keys.iter().any(|b| {
                    matches(b, code, key, mods)
                        && self.modes.get(&b.0).is_none_or(|m| m.0.is_none())
                }) {
                    return Resolution::Consume;
                }
            }
            return Resolution::Pass;
        };
        let (_, next, invoke) = self
            .modes
            .get(&self.keys[index].0)
            .cloned()
            .unwrap_or((None, None, true));
        if repeat && context.as_deref() != Some("resize") {
            return Resolution::Consume;
        }
        self.mode = next.map(|name| (name, now + self.timeout));
        if invoke {
            Resolution::Invoke(index)
        } else {
            Resolution::Consume
        }
    }
}
pub fn configure(
    app: &AppHandle,
    epoch: &str,
    generation: u64,
    keys: Vec<Binding>,
    modes: Vec<Mode>,
    timeout_ms: u64,
) {
    let state = app.state::<Bindings>();
    let mut current = state.0.lock().unwrap();
    let watched = current.watched;
    *current = Keymap {
        epoch: epoch.into(),
        generation,
        keys,
        modes: modes
            .into_iter()
            .map(|(id, scope, next, invoke)| (id, (scope, next, invoke)))
            .collect(),
        timeout: Duration::from_millis(timeout_ms),
        watched,
        ..Keymap::default()
    };
}

/// Track the actual main-window instance, not a process-wide "registered" bit.
pub fn watch_window(app: &AppHandle) -> Result<(), String> {
    let window = app.get_window("main").ok_or("no main shortcut window")?;
    let native = window.ns_window().map_err(|e| e.to_string())?;
    let number: isize =
        unsafe { objc2::msg_send![native.cast::<objc2::runtime::AnyObject>(), windowNumber] };
    let identity = (native as usize, number);
    let state = app.state::<Bindings>();
    let mut current = state.0.lock().unwrap();
    if current.watched == Some(identity) {
        return Ok(());
    }
    current.watched = Some(identity);
    current.reset();
    drop(current);
    let app = app.clone();
    window.on_window_event(move |event| {
        if matches!(
            event,
            tauri::WindowEvent::Focused(false) | tauri::WindowEvent::Destroyed
        ) {
            let state = app.state::<Bindings>();
            let mut current = state.0.lock().unwrap();
            if current.watched != Some(identity) {
                return;
            }
            current.reset();
            if matches!(event, tauri::WindowEvent::Destroyed) {
                current.watched = None;
            }
        }
    });
    Ok(())
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

pub fn validate_modes(keys: &[Binding], modes: &[Mode], timeout_ms: u64) -> Result<(), String> {
    let mut seen = HashSet::new();
    if modes.len() > keys.len()
        || (!modes.is_empty() && !(1..=5000).contains(&timeout_ms))
        || modes.iter().any(|(id, scope, next, invoke)| {
            !seen.insert(id)
                || !keys.iter().any(|b| &b.0 == id)
                || scope
                    .as_deref()
                    .is_some_and(|s| s != "leader" && s != "resize")
                || next
                    .as_deref()
                    .is_some_and(|s| s != "leader" && s != "resize")
                || if !invoke {
                    !matches!(
                        (scope.as_deref(), next.as_deref()),
                        (None, Some("leader" | "resize")) | (Some("leader"), Some("resize"))
                    )
                } else {
                    next.is_some()
                        && !(scope.as_deref() == Some("resize")
                            && next.as_deref() == Some("resize"))
                }
        })
        || keys.iter().any(|b| {
            b.3 & 7 == 0
                && !b.1.starts_with('F')
                && !modes.iter().any(|m| m.0 == b.0 && m.1.is_some())
        })
    {
        return Err("invalid native shortcut modes".into());
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
pub(crate) fn physical_code(key: u16) -> &'static str {
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
            app.state::<Bindings>().0.lock().unwrap().reset();
            return false;
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
            app.state::<Bindings>().0.lock().unwrap().reset();
            return false;
        }
        let hidden: Bool = msg_send![ancestor, isHiddenOrHasHiddenAncestor];
        if hidden.as_bool() {
            // Recovery only, never dispatch against the stale page or deliver invisible input.
            // Normal hide/close hands focus back before hiding; AppKit may restore an old
            // responder when a window re-keys. Do not replay this key and risk a double action.
            app.state::<Bindings>().0.lock().unwrap().reset();
            if let Some(main) = app.get_webview("main") {
                let _ = main.set_focus();
            }
            return true;
        }
        let state = app.state::<Bindings>();
        let notice = {
            let mut c = state.0.lock().unwrap();
            if c.observed.as_deref() != Some(&browser) {
                c.observed = Some(browser.clone());
                Some(format!(
                    "window.dispatchEvent(new CustomEvent('perch:browser-focus', {{detail: {{id: '{browser}', epoch: '{}', generation: {} }} }}))",
                    c.epoch, c.generation
                ))
            } else {
                None
            }
        };
        if let (Some(main), Some(notice)) = (app.get_webview("main"), notice) {
            let _ = main.eval(notice);
        }
        let client: Bool = msg_send![responder, respondsToSelector: sel!(hasMarkedText)];
        let composing = client.as_bool() && {
            let marked: Bool = msg_send![responder, hasMarkedText];
            marked.as_bool()
        };
        let flags: usize = msg_send![event, modifierFlags];
        let mods = u8::from(flags & (1 << 20) != 0)
            | (u8::from(flags & (1 << 18) != 0) << 1)
            | (u8::from(flags & (1 << 19) != 0) << 2)
            | (u8::from(flags & (1 << 17) != 0) << 3);
        let hardware: u16 = msg_send![event, keyCode];
        let text: *mut AnyObject = msg_send![event, charactersIgnoringModifiers];
        let key = string(text);
        let repeated: Bool = msg_send![event, isARepeat];
        let script = {
            let mut c = state.0.lock().unwrap();
            let index = match c.resolve(
                physical_code(hardware),
                &key,
                mods,
                repeated.as_bool(),
                composing,
                Instant::now(),
            ) {
                Resolution::Pass => return false,
                Resolution::Consume => return true,
                Resolution::Invoke(index) => index,
            };
            let focused = c.page.as_deref() != Some(&browser);
            c.page = Some(browser.clone());
            // Mode-only keys stay native. Only resolved actions cross the bridge, so a late
            // delivery never arms a JS mode or rechecks a different clock.
            format!(
                "window.dispatchEvent(new CustomEvent('perch:command', {{ detail: {{ index: {index}, command: '{}', id: '{browser}', epoch: '{}', generation: {}, focused: {focused} }} }}))",
                c.keys[index].0, c.epoch, c.generation
            )
        };
        app.get_webview("main")
            .is_some_and(|main| main.eval(script).is_ok())
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
    fn keymap(timeout: u64) -> Keymap {
        let keys = vec![
            binding("leader.arm", "Space", None, 2),
            binding("leader.navigator", "KeyG", Some("g"), 0),
            binding("leader.resize", "KeyR", Some("r"), 0),
            binding("resize.left", "KeyH", Some("h"), 0),
            binding("global.settings", "Comma", None, 1),
        ];
        let modes = [
            ("leader.arm", None, Some("leader"), false),
            ("leader.navigator", Some("leader"), None, true),
            ("leader.resize", Some("leader"), Some("resize"), false),
            ("resize.left", Some("resize"), Some("resize"), true),
        ];
        let modes: Vec<Mode> = modes
            .into_iter()
            .map(|(i, s, n, v)| (i.into(), s.map(Into::into), n.map(Into::into), v))
            .collect();
        validate_modes(&keys, &modes, timeout).unwrap();
        Keymap {
            keys,
            modes: modes
                .into_iter()
                .map(|(i, s, n, v)| (i, (s, n, v)))
                .collect(),
            timeout: Duration::from_millis(timeout),
            ..Keymap::default()
        }
    }
    #[test]
    fn native_modes_follow_settings_deadline_repeat_cancel_and_ime_rules() {
        let t = Instant::now();
        let ms = |n| t + Duration::from_millis(n);
        let mut k = keymap(1500);
        assert_eq!(k.resolve("KeyG", "g", 0, false, false, t), Resolution::Pass); // ordinary page typing
        assert_eq!(
            k.resolve("Space", " ", 2, false, false, t),
            Resolution::Consume
        );
        assert_eq!(
            k.resolve("Space", " ", 2, true, false, ms(10)),
            Resolution::Consume
        );
        assert_eq!(
            k.resolve("KeyG", "g", 0, false, false, ms(1499)),
            Resolution::Invoke(1)
        );
        assert_eq!(
            k.resolve("KeyG", "g", 0, false, false, ms(1500)),
            Resolution::Pass
        ); // disarmed
        k.resolve("Space", " ", 2, false, false, t);
        assert_eq!(
            k.resolve("KeyG", "g", 0, false, false, ms(1500)),
            Resolution::Pass
        ); // expired
        k.resolve("Space", " ", 2, false, false, t);
        assert_eq!(
            k.resolve("KeyR", "r", 0, false, false, t),
            Resolution::Consume
        );
        assert_eq!(
            k.resolve("KeyH", "h", 0, false, false, t),
            Resolution::Invoke(3)
        );
        assert_eq!(
            k.resolve("KeyH", "h", 0, true, false, ms(1000)),
            Resolution::Invoke(3)
        ); // repeat re-arms
        assert_eq!(
            k.resolve("KeyH", "h", 0, false, false, ms(2400)),
            Resolution::Invoke(3)
        );
        assert_eq!(
            k.resolve("Escape", "\u{1b}", 0, false, false, ms(2401)),
            Resolution::Consume
        );
        assert_eq!(
            k.resolve("KeyH", "h", 0, false, false, ms(2402)),
            Resolution::Pass
        );
        k.resolve("Space", " ", 2, false, false, t);
        // No app command may run behind a cancelled prefix; plain text stays typeable.
        assert_eq!(
            k.resolve("Comma", ",", 1, false, false, t),
            Resolution::Consume
        );
        k.resolve("Space", " ", 2, false, false, t);
        assert_eq!(k.resolve("KeyA", "a", 0, false, false, t), Resolution::Pass);
        assert_eq!(k.resolve("KeyG", "g", 0, false, false, t), Resolution::Pass);
        k.resolve("Space", " ", 2, false, false, t);
        assert_eq!(k.resolve("KeyG", "g", 0, false, true, t), Resolution::Pass); // composition never completes a chord
        assert_eq!(k.resolve("KeyG", "g", 0, false, false, t), Resolution::Pass);
    }
    #[test]
    fn focus_loss_reset_disarms_the_prefix_and_pending_focus_context() {
        let t = Instant::now();
        let mut k = keymap(1500);
        k.resolve("Space", " ", 2, false, false, t);
        k.page = Some("probe".into());
        k.reset();
        assert_eq!(k.resolve("KeyG", "g", 0, false, false, t), Resolution::Pass);
        assert!(k.page.is_none() && k.observed.is_none());
    }
    #[test]
    fn native_mode_tables_reject_typing_traps_and_contradictions() {
        let mode = |scope: Option<&str>, next: Option<&str>, invoke| -> Vec<Mode> {
            vec![(
                "leader.arm".into(),
                scope.map(Into::into),
                next.map(Into::into),
                invoke,
            )]
        };
        let trap = vec![
            binding("a.b", "KeyG", Some("g"), 0),
            binding("leader.arm", "Space", None, 2),
        ];
        assert!(validate_modes(&trap, &mode(None, Some("leader"), false), 1500).is_err());
        let keys = vec![binding("leader.arm", "Space", None, 2)];
        assert!(validate_modes(&keys, &mode(None, Some("leader"), false), 1500).is_ok());
        assert!(validate_modes(&keys, &mode(None, Some("leader"), true), 1500).is_err());
        assert!(validate_modes(&keys, &mode(None, Some("loop"), false), 1500).is_err());
        assert!(validate_modes(&keys, &mode(None, Some("leader"), false), 0).is_err());
        assert!(validate_modes(&keys, &mode(None, Some("leader"), false), 5001).is_err());
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

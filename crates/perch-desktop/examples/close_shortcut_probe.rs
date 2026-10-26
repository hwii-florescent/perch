//! Headless macOS regression: production native shortcut handler/menu, WKWebView focus and IPC ACLs.
//! Run: cargo run -p perch-desktop --example close_shortcut_probe
//! No core, daemon, shells, installed app, visible window or external network is used.
#[cfg(target_os = "macos")]
#[path = "../src/browser.rs"]
#[allow(dead_code, clippy::too_many_arguments)]
// Production module; its existing lints are checked by the app target.
mod browser;
#[cfg(target_os = "macos")]
#[path = "../src/glass.rs"]
#[allow(dead_code)]
mod glass;
#[cfg(target_os = "macos")]
#[path = "../src/menu.rs"]
mod menu;
#[cfg(target_os = "macos")]
#[path = "../src/shortcuts.rs"]
mod shortcuts;

#[cfg(target_os = "macos")]
mod probe {
    use super::browser;
    use std::{
        io::{Read, Write},
        net::TcpListener,
        sync::{
            atomic::{AtomicBool, Ordering},
            Arc,
        },
        time::Duration,
    };
    use tauri::{AppHandle, Manager};
    use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};

    struct Reports(UnboundedSender<String>);
    // Use an existing main-only command permission as the probe's report channel.
    #[tauri::command]
    fn browser_url(id: String, reports: tauri::State<'_, Reports>) {
        let _ = reports.0.send(id);
    }

    async fn report(rx: &mut UnboundedReceiver<String>, expected: &str) -> anyhow::Result<()> {
        let actual = tokio::time::timeout(Duration::from_secs(8), rx.recv())
            .await
            .map_err(|error| anyhow::anyhow!("waiting for {expected:?}: {error}"))?;
        anyhow::ensure!(
            actual.as_deref() == Some(expected),
            "expected {expected:?}, got {actual:?}"
        );
        Ok(())
    }

    async fn configure(
        app: &AppHandle,
        rx: &mut UnboundedReceiver<String>,
        spec: Option<&str>,
        generation: u64,
    ) -> anyhow::Result<()> {
        let accelerator = spec
            .map(|s| format!("'{s}'"))
            .unwrap_or_else(|| "null".into());
        // Shared golden wire fixture is checked against nativeShortcutBindings() by Vitest.
        let fixture = include_str!("../../../packages/web/src/nativeShortcutBindings.fixture.json");
        app.get_webview("main").unwrap().eval(format!(
            "window.probeFixture = {fixture}; window.probeBindings = [...window.probeFixture.global, ...window.probeFixture.modeKeys, ...(window.probeFixture.close[{accelerator}] ? [window.probeFixture.close[{accelerator}]] : [])]; window.__TAURI_INTERNALS__.invoke('browser_shortcuts', {{accelerator: {accelerator}, generation: {generation}, epoch: window.epoch, bindings: window.probeBindings, modes: window.probeFixture.modes, chordTimeoutMs: window.probeFixture.chordTimeoutMs}}).then(() => report('configured:{generation}')).catch(e => report('ERROR:' + e))"
        ))?;
        report(rx, &format!("configured:{generation}")).await?;
        let file = file_menu(app);
        anyhow::ensure!(
            file.items()?.len() == 2 && file.get("probe-other").is_some(),
            "Close Tab replacement lost or duplicated a menu item"
        );
        Ok(())
    }

    fn file_menu(app: &AppHandle) -> tauri::menu::Submenu<tauri::Wry> {
        app.menu()
            .unwrap()
            .items()
            .unwrap()
            .into_iter()
            .filter_map(|item| item.as_submenu().cloned())
            .find(|menu| menu.text().ok().as_deref() == Some("File"))
            .unwrap()
    }

    // AppKit CGPoint ABI (all supported Macs use 64-bit CGFloat).
    #[derive(Clone, Copy)]
    #[repr(C)]
    struct Point {
        x: f64,
        y: f64,
    }
    unsafe impl objc2::Encode for Point {
        const ENCODING: objc2::Encoding = objc2::Encoding::Struct(
            "CGPoint",
            &[objc2::Encoding::Double, objc2::Encoding::Double],
        );
    }

    async fn press(
        app: &AppHandle,
        view: &str,
        key: &'static std::ffi::CStr,
        modifiers: usize,
    ) -> anyhow::Result<bool> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        let app_handle = app.clone();
        app.get_webview(view).unwrap().with_webview(move |platform| {
            let app_handle = &app_handle;
            use objc2::{class, msg_send, runtime::{AnyObject, Bool}};
            // SAFETY: main-thread live WKWebView; all AppKit objects below are local to the call.
            // This sets only the hidden window's first responder, never the app/key-window focus.
            let handled = unsafe {
                let view = platform.inner().cast::<AnyObject>();
                let window: *mut AnyObject = msg_send![view, window];
                let focused: Bool = msg_send![window, makeFirstResponder: view];
                if !focused.as_bool() { let _ = tx.send(false); return; }
                let chars: *mut AnyObject = msg_send![class!(NSString), stringWithUTF8String: key.as_ptr()];
                let number: isize = msg_send![window, windowNumber];
                let hardware: u16 = match key.to_bytes() { b"w" => 13, b"j" => 38, b"1" | b"!" => 18, b"p" => 35, b" " => 49, b"g" => 5, b"r" => 15, b"h" => 4, _ => 0 };
                let event: *mut AnyObject = msg_send![class!(NSEvent), keyEventWithType: 10usize, location: Point { x: 0., y: 0. }, modifierFlags: modifiers, timestamp: 0f64, windowNumber: number, context: std::ptr::null_mut::<AnyObject>(), characters: chars, charactersIgnoringModifiers: chars, isARepeat: false, keyCode: hardware];
                if crate::shortcuts::handle_key(app_handle, event) { let _ = tx.send(true); return; }
                let application: *mut AnyObject = msg_send![class!(NSApplication), sharedApplication];
                let menu: *mut AnyObject = msg_send![application, mainMenu];
                let result: Bool = msg_send![menu, performKeyEquivalent: event];
                result.as_bool()
            };
            let _ = tx.send(handled);
        })?;
        Ok(tokio::time::timeout(Duration::from_secs(3), rx).await??)
    }

    async fn run(
        app: AppHandle,
        mut rx: UnboundedReceiver<String>,
        child_url: String,
    ) -> anyhow::Result<()> {
        const CMD: usize = 1 << 20;
        const SHIFT: usize = 1 << 17;
        const CTRL: usize = 1 << 18;
        report(&mut rx, "ready").await?;
        let other = tauri::menu::MenuItem::with_id(
            &app,
            "probe-other",
            "Probe Action",
            true,
            None::<&str>,
        )?;
        file_menu(&app).insert(&other, 0)?; // Locate Close Tab by id, not position.
        configure(&app, &mut rx, Some("Super+KeyW"), 1).await?;
        // No native browser exists: covers ordinary tabs and browsers that are still blank.
        anyhow::ensure!(
            press(&app, "main", c"w", CMD).await?,
            "main shortcut was not consumed"
        );
        report(&mut rx, "close::1").await?;
        app.get_window("main").unwrap().add_child(
            tauri::webview::WebviewBuilder::new(
                "browser-probe",
                tauri::WebviewUrl::External(child_url.parse()?),
            )
            .incognito(true),
            tauri::LogicalPosition::new(0., 0.),
            tauri::LogicalSize::new(400., 300.),
        )?;
        crate::shortcuts::tag_browser(&app.get_webview("browser-probe").unwrap(), "probe")?;
        // The tab strip's title and favicon come from the real page once it has loaded.
        let icon = child_url
            .parse::<tauri::Url>()?
            .join("/icon.png")?
            .to_string();
        let mut info = None;
        for _ in 0..30 {
            info = browser::browser_info(app.clone(), "probe".into())
                .await
                .ok()
                .flatten();
            if info.as_ref().is_some_and(|(title, _)| !title.is_empty()) {
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
        anyhow::ensure!(
            info == Some(("Probe page".into(), icon)),
            "browser_info returned {info:?}"
        );
        anyhow::ensure!(
            !press(&app, "browser-probe", c"g", 0).await?,
            "unprefixed leader letter stole page typing"
        );
        anyhow::ensure!(
            press(&app, "browser-probe", c" ", CTRL).await?,
            "native prefix not consumed"
        );
        anyhow::ensure!(
            press(&app, "browser-probe", c"g", 0).await?,
            "native follow-up missed"
        );
        report(&mut rx, "command:leader.navigator:probe:1").await?;
        anyhow::ensure!(
            !press(&app, "browser-probe", c"g", 0).await?,
            "leader did not disarm"
        );
        for (key, modifiers, command) in [
            (c"1", CMD, "tabs.jump1"),
            (c"!", CTRL | SHIFT, "nests.jump1"),
            (c"p", CMD, "global.navigator"),
        ] {
            anyhow::ensure!(
                press(&app, "browser-probe", key, modifiers).await?,
                "universal browser shortcut missed"
            );
            report(&mut rx, &format!("command:{command}:probe:1")).await?;
        }
        // Main-view input resets the native source context, without changing the keymap.
        anyhow::ensure!(
            !press(&app, "main", c"a", CTRL).await?,
            "unbound main key consumed"
        );
        anyhow::ensure!(
            press(&app, "browser-probe", c"p", CMD).await?,
            "refocused page shortcut missed"
        );
        report(&mut rx, "command:global.navigator:probe:1").await?;
        app.get_webview("main")
            .unwrap()
            .eval("report('focus:' + window.focusMarks.join(','))")?;
        report(&mut rx, "focus:true,false,false,false,true").await?;
        anyhow::ensure!(
            !press(&app, "browser-probe", c"a", CTRL).await?,
            "unbound PTY/page key consumed"
        );
        anyhow::ensure!(
            press(&app, "browser-probe", c"w", CMD).await?,
            "page shortcut was not consumed"
        );
        report(&mut rx, "close:probe:1").await?;
        configure(&app, &mut rx, Some("Super+Shift+KeyJ"), 2).await?;
        anyhow::ensure!(
            !press(&app, "main", c"w", CMD).await?,
            "old default still consumed"
        );
        for view in ["main", "browser-probe"] {
            anyhow::ensure!(
                press(&app, view, c"j", CMD | SHIFT).await?,
                "rebound shortcut not consumed"
            );
            report(
                &mut rx,
                if view == "main" {
                    "close::2"
                } else {
                    "close:probe:2"
                },
            )
            .await?;
        }
        // An explicitly configured Ctrl key works too; unbound terminal Ctrl keys stay untouched.
        configure(&app, &mut rx, Some("Control+KeyW"), 3).await?;
        anyhow::ensure!(
            press(&app, "browser-probe", c"w", CTRL).await?,
            "configured Ctrl key not consumed"
        );
        report(&mut rx, "close:probe:3").await?;
        configure(&app, &mut rx, None, 4).await?;
        for modifiers in [CMD, CTRL] {
            anyhow::ensure!(
                !press(&app, "main", c"w", modifiers).await?,
                "disabled shortcut consumed"
            );
        }
        // Replace the item repeatedly (including a disabled -> enabled round trip).
        configure(&app, &mut rx, Some("Super+KeyW"), 5).await?;
        anyhow::ensure!(press(&app, "main", c"w", CMD).await?);
        report(&mut rx, "close::5").await?;
        configure(&app, &mut rx, Some("Super+Shift+KeyJ"), 6).await?;
        for (spec, generation) in [("invalid+key", 7), ("Super+KeyW", 2)] {
            app.get_webview("main").unwrap().eval(format!(
                "window.__TAURI_INTERNALS__.invoke('browser_shortcuts', {{accelerator: '{spec}', generation: {generation}, epoch: window.epoch}}).then(() => report('unexpected success')).catch(() => report('rejected'))"
            ))?;
            report(&mut rx, "rejected").await?;
        }
        anyhow::ensure!(
            !press(&app, "main", c"w", CMD).await?,
            "stale update reclaimed CmdW"
        );
        anyhow::ensure!(press(&app, "browser-probe", c"j", CMD | SHIFT).await?);
        report(&mut rx, "close:probe:6").await?;
        // Reload resets the JS counter, but not the native menu. A fresh document must still
        // be able to configure its binding; no old async config task may win afterwards.
        configure(&app, &mut rx, Some("Super+KeyW"), 7).await?;
        app.get_webview("main").unwrap().eval(
            "window.__TAURI_INTERNALS__.invoke('browser_shortcuts', {accelerator: 'Super+Shift+KeyJ', generation: 8, epoch: window.epoch}); location.reload()"
        )?;
        report(&mut rx, "ready").await?;
        configure(&app, &mut rx, Some("Super+KeyW"), 1).await?;
        anyhow::ensure!(press(&app, "main", c"w", CMD).await?);
        report(&mut rx, "close::1").await?;
        anyhow::ensure!(!press(&app, "main", c"j", CMD | SHIFT).await?);
        configure(&app, &mut rx, None, 2).await?;
        anyhow::ensure!(!press(&app, "main", c"w", CMD).await?);
        anyhow::ensure!(
            tokio::time::timeout(Duration::from_millis(200), rx.recv())
                .await
                .is_err(),
            "duplicate/unexpected close event"
        );
        Ok(())
    }

    pub fn main() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/", listener.local_addr().unwrap());
        listener.set_nonblocking(true).unwrap();
        let stop = Arc::new(AtomicBool::new(false));
        let stopped = stop.clone();
        let server = std::thread::spawn(move || {
            while !stopped.load(Ordering::Relaxed) {
                if let Ok((mut stream, _)) = listener.accept() {
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(1)));
                    let mut bytes = [0; 2048];
                    let count = stream.read(&mut bytes).unwrap_or(0);
                    let child = String::from_utf8_lossy(&bytes[..count]).contains("/child");
                    let body = if child {
                        "<!doctype html><title>Probe page</title><link rel=\"icon\" href=\"/icon.png\"><p>page</p>"
                    } else {
                        "<!doctype html><title>Shortcut probe</title><script>window.focusMarks = []; window.epoch = crypto.randomUUID(); window.report = id => window.__TAURI_INTERNALS__.invoke('browser_url', {id}); window.addEventListener('perch:close-tab', e => report('close:' + e.detail.id + ':' + e.detail.generation)); window.addEventListener('perch:command', e => { window.focusMarks.push(e.detail.focused); const id = window.probeBindings[e.detail.index][0]; report((id === 'tabs.close' ? 'close:' : 'command:' + id + ':') + e.detail.id + ':' + e.detail.generation); }); report('ready');</script>"
                    };
                    let _ = write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
                } else {
                    std::thread::sleep(Duration::from_millis(5));
                }
            }
        });
        let (tx, rx) = tokio::sync::mpsc::unbounded_channel();
        let passed = Arc::new(AtomicBool::new(false));
        let succeeded = passed.clone();
        let mut context = tauri::generate_context!();
        context.config_mut().identifier = "dev.perch.shortcut-probe".into();
        let app = tauri::Builder::default().manage(Reports(tx))
            .invoke_handler(tauri::generate_handler![browser_url, browser::browser_shortcuts])
            .on_menu_event(browser::on_menu_event)
            .setup(move |app| {
                app.set_activation_policy(tauri::ActivationPolicy::Prohibited);
                app.set_menu(crate::menu::app_menu(app.handle())?)?;
                tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::External(url.parse()?))
                    .visible(false).focused(false).incognito(true).build()?;
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let result = run(handle.clone(), rx, format!("{url}child")).await;
                    succeeded.store(result.is_ok(), Ordering::Relaxed);
                    match result {
                        Ok(()) => println!("PASS: universal browser commands, focus-once routing, Close Tab rebinding/disable/reload, IPC and no duplicate"),
                        Err(ref error) => eprintln!("FAIL: {error:#}"),
                    }
                    handle.exit(if result.is_ok() { 0 } else { 1 });
                });
                Ok(())
            }).build(context).unwrap();
        let exit = app.run_return(|_, _| {});
        stop.store(true, Ordering::Relaxed);
        server.join().unwrap();
        assert_eq!(exit, 0, "native shortcut probe exit");
        assert!(
            passed.load(Ordering::Relaxed),
            "native shortcut probe failed"
        );
    }
}

fn main() {
    #[cfg(target_os = "macos")]
    probe::main();
    #[cfg(not(target_os = "macos"))]
    println!("SKIP: native shortcut probe is macOS-only");
}

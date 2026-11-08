//! Headless macOS regression: the glass window's traffic lights, a layout's `trafficLights`
//! position, and the window-control IPC (minimize, toggle-maximize, close) under the production
//! capability file. The window is built with the app's own options but hidden and unfocused.
//! Run: cargo run -p perch-desktop --example window_chrome_probe
//! No core, daemon, shells, installed app or external network is used.
#[cfg(target_os = "macos")]
#[path = "../src/glass.rs"]
#[allow(dead_code)]
mod glass;

#[cfg(target_os = "macos")]
mod probe {
    use std::{
        io::{Read, Write},
        net::TcpListener,
        sync::{
            atomic::{AtomicBool, Ordering},
            Arc,
        },
        time::Duration,
    };
    use tauri::{AppHandle, Manager, WebviewWindow};
    use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};

    struct Reports(UnboundedSender<String>);
    // An existing main-only command permission doubles as the page's report channel.
    #[tauri::command]
    fn browser_url(id: String, reports: tauri::State<'_, Reports>) {
        let _ = reports.0.send(id);
    }
    // The app's own command (src/main.rs), so the capability file's permission is exercised.
    #[tauri::command]
    async fn capture_window(window: WebviewWindow) -> Result<String, String> {
        use base64::Engine;
        let png = super::glass::snapshot_png(&window).await?;
        Ok(base64::engine::general_purpose::STANDARD.encode(png))
    }
    #[tauri::command]
    fn set_traffic_lights(window: WebviewWindow, at: Option<(f64, f64)>) {
        super::glass::set_lights_at(at, &window);
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

    /// The close button's left edge and vertical centre, measured from the window's top-left.
    fn lights(window: &WebviewWindow) -> anyhow::Result<(f64, f64, f64)> {
        use objc2::{msg_send, runtime::AnyObject};
        #[derive(Clone, Copy)]
        #[repr(C)]
        struct P {
            x: f64,
            y: f64,
        }
        #[derive(Clone, Copy)]
        #[repr(C)]
        struct S {
            w: f64,
            h: f64,
        }
        #[derive(Clone, Copy)]
        #[repr(C)]
        struct R {
            o: P,
            s: S,
        }
        unsafe impl objc2::Encode for P {
            const ENCODING: objc2::Encoding = objc2::Encoding::Struct(
                "CGPoint",
                &[objc2::Encoding::Double, objc2::Encoding::Double],
            );
        }
        unsafe impl objc2::Encode for S {
            const ENCODING: objc2::Encoding = objc2::Encoding::Struct(
                "CGSize",
                &[objc2::Encoding::Double, objc2::Encoding::Double],
            );
        }
        unsafe impl objc2::Encode for R {
            const ENCODING: objc2::Encoding =
                objc2::Encoding::Struct("CGRect", &[P::ENCODING, S::ENCODING]);
        }
        let (tx, rx) = std::sync::mpsc::channel();
        let handle = window.clone();
        window.run_on_main_thread(move || {
            let ns_window = handle.ns_window().unwrap().cast::<AnyObject>();
            // SAFETY: the live NSWindow, on the main thread; public AppKit selectors only.
            let out = unsafe {
                let close: *mut AnyObject = msg_send![ns_window, standardWindowButton: 0isize];
                let second: *mut AnyObject = msg_send![ns_window, standardWindowButton: 1isize];
                let frame: R = msg_send![ns_window, frame];
                let local: R = msg_send![close, bounds];
                let in_window: R =
                    msg_send![close, convertRect: local, toView: std::ptr::null_mut::<AnyObject>()];
                let next: R = msg_send![second, bounds];
                let next: R =
                    msg_send![second, convertRect: next, toView: std::ptr::null_mut::<AnyObject>()];
                let top = frame.s.h - (in_window.o.y + in_window.s.h / 2.0);
                (in_window.o.x, top, next.o.x - in_window.o.x)
            };
            let _ = tx.send(out);
        })?;
        Ok(rx.recv_timeout(Duration::from_secs(5))?)
    }

    /// Re-measure until the lights are where `check` wants them (AppKit applies the move on the main thread).
    async fn lights_settle(
        window: &WebviewWindow,
        what: &str,
        check: impl Fn(f64, f64) -> bool,
    ) -> anyhow::Result<()> {
        let mut last = (0.0, 0.0);
        for _ in 0..40 {
            let (x, y, _) = lights(window)?;
            last = (x, y);
            if check(x, y) {
                return Ok(());
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        anyhow::bail!(
            "{what}: the close button sits at x={:.1} centre-y={:.1}",
            last.0,
            last.1
        )
    }

    async fn until(what: &str, mut ok: impl FnMut() -> bool) -> anyhow::Result<()> {
        for _ in 0..80 {
            if ok() {
                return Ok(());
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        anyhow::bail!("timed out: {what}")
    }

    async fn run(app: AppHandle, mut rx: UnboundedReceiver<String>) -> anyhow::Result<()> {
        report(&mut rx, "ready").await?;
        let window = app
            .get_webview_window("main")
            .ok_or_else(|| anyhow::anyhow!("no main window"))?;
        super::glass::apply(&window);
        super::glass::position_traffic_lights(&window);

        // The glass window's default: the lights sit 22pt in, centred on the 44pt row under the 8pt gutter (30pt down).
        lights_settle(&window, "default lights", |x, y| {
            (x - 22.0).abs() < 1.0 && (y - 30.0).abs() < 1.0
        })
        .await?;
        let (_, _, step) = lights(&window)?;
        anyhow::ensure!(
            step > 10.0 && step < 40.0,
            "the three buttons keep their spacing, got {step}"
        );

        // A layout's `trafficLights: [40, 30]`, through the page's IPC and the capability file.
        let page = window.clone();
        page.eval("window.__TAURI_INTERNALS__.invoke('set_traffic_lights', {at: [40, 30]}).then(() => report('lights:set')).catch(e => report('ERROR:' + e))")?;
        report(&mut rx, "lights:set").await?;
        lights_settle(&window, "moved lights", |x, y| {
            (x - 40.0).abs() < 1.0 && (y - 38.0).abs() < 1.0
        })
        .await?;

        // None puts them back.
        page.eval("window.__TAURI_INTERNALS__.invoke('set_traffic_lights', {at: null}).then(() => report('lights:reset')).catch(e => report('ERROR:' + e))")?;
        report(&mut rx, "lights:reset").await?;
        lights_settle(&window, "reset lights", |x, y| {
            (x - 22.0).abs() < 1.0 && (y - 30.0).abs() < 1.0
        })
        .await?;

        // The window buttons a layout can draw itself.
        page.eval("window.__TAURI_INTERNALS__.invoke('plugin:window|toggle_maximize', {label: 'main'}).then(() => report('max:ok')).catch(e => report('ERROR:' + e))")?;
        report(&mut rx, "max:ok").await?;
        until("the window is maximized", || {
            window.is_maximized().unwrap_or(false)
        })
        .await?;
        page.eval("window.__TAURI_INTERNALS__.invoke('plugin:window|toggle_maximize', {label: 'main'}).then(() => report('unmax:ok')).catch(e => report('ERROR:' + e))")?;
        report(&mut rx, "unmax:ok").await?;
        until("the window is restored", || {
            !window.is_maximized().unwrap_or(true)
        })
        .await?;
        page.eval("window.__TAURI_INTERNALS__.invoke('plugin:window|minimize', {label: 'main'}).then(() => report('min:ok')).catch(e => report('ERROR:' + e))")?;
        report(&mut rx, "min:ok").await?;
        until("the window is minimized", || {
            window.is_minimized().unwrap_or(false)
        })
        .await?;
        window.unminimize()?;

        // The OS's own picture of the web view (what `api.screenshot()` returns in the app).
        page.eval("window.__TAURI_INTERNALS__.invoke('capture_window').then((b64) => report('shot:' + atob(b64).length + ':' + atob(b64).slice(0, 4).split('').map((c) => c.charCodeAt(0)).join(','))).catch(e => report('ERROR:' + e))")?;
        let shot = tokio::time::timeout(Duration::from_secs(12), rx.recv())
            .await?
            .unwrap_or_default();
        let mut parts = shot.split(':');
        anyhow::ensure!(parts.next() == Some("shot"), "capture failed: {shot}");
        let size: usize = parts.next().unwrap_or("0").parse()?;
        anyhow::ensure!(size > 2000, "a PNG with content, got {size} bytes");
        anyhow::ensure!(
            parts.next() == Some("137,80,78,71"),
            "PNG signature, got {shot}"
        );

        // Anything the capability does not name stays refused.
        page.eval("window.__TAURI_INTERNALS__.invoke('plugin:window|destroy', {label: 'main'}).then(() => report('unexpected success')).catch(() => report('refused'))")?;
        report(&mut rx, "refused").await?;
        anyhow::ensure!(
            app.get_webview_window("main").is_some(),
            "a refused call must not close the window"
        );

        // Close ends the window.
        page.eval("window.__TAURI_INTERNALS__.invoke('plugin:window|close', {label: 'main'})")?;
        until("the window is closed", || {
            app.get_webview_window("main").is_none()
        })
        .await?;
        Ok(())
    }

    pub fn main() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let url = format!(
            "http://127.0.0.1:{}/",
            listener.local_addr().unwrap().port()
        );
        let stop = Arc::new(AtomicBool::new(false));
        let stopper = stop.clone();
        let server = std::thread::spawn(move || {
            while !stopper.load(Ordering::Relaxed) {
                if let Ok((mut stream, _)) = listener.accept() {
                    let mut bytes = [0u8; 2048];
                    let _ = stream.read(&mut bytes);
                    let body = "<!doctype html><title>Window probe</title><script>window.report = id => window.__TAURI_INTERNALS__.invoke('browser_url', {id}); report('ready');</script>";
                    let _ = write!(
                        stream,
                        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        body.len(),
                        body
                    );
                } else {
                    std::thread::sleep(Duration::from_millis(5));
                }
            }
        });
        let (tx, rx) = tokio::sync::mpsc::unbounded_channel();
        let passed = Arc::new(AtomicBool::new(false));
        let succeeded = passed.clone();
        let mut context = tauri::generate_context!();
        context.config_mut().identifier = "dev.perch.window-chrome-probe".into();
        let app = tauri::Builder::default()
            .manage(Reports(tx))
            .invoke_handler(tauri::generate_handler![browser_url, set_traffic_lights, capture_window])
            .setup(move |app| {
                app.set_activation_policy(tauri::ActivationPolicy::Prohibited);
                // The production window options (src/main.rs), hidden and unfocused.
                tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::External(url.parse()?))
                    .title_bar_style(tauri::TitleBarStyle::Overlay)
                    .hidden_title(true)
                    .transparent(true)
                    .inner_size(1280.0, 800.0)
                    .visible(false)
                    .focused(false)
                    .incognito(true)
                    .build()?;
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let result = run(handle.clone(), rx).await;
                    succeeded.store(result.is_ok(), Ordering::Relaxed);
                    match result {
                        Ok(()) => println!("PASS: traffic lights, a layout trafficLights, toggle-maximize, minimize, native web view capture, refused destroy and close"),
                        Err(ref error) => eprintln!("FAIL: {error:#}"),
                    }
                    handle.exit(if result.is_ok() { 0 } else { 1 });
                });
                Ok(())
            })
            .build(context)
            .unwrap();
        // Closing the last window asks to exit; the probe exits itself once it has reported.
        let exit = app.run_return(|_, event| {
            if let tauri::RunEvent::ExitRequested {
                api, code: None, ..
            } = event
            {
                api.prevent_exit();
            }
        });
        stop.store(true, Ordering::Relaxed);
        server.join().unwrap();
        assert_eq!(exit, 0, "window chrome probe exit");
        assert!(passed.load(Ordering::Relaxed), "window chrome probe failed");
    }
}

fn main() {
    #[cfg(target_os = "macos")]
    probe::main();
    #[cfg(not(target_os = "macos"))]
    println!("SKIP: window chrome probe is macOS-only");
}

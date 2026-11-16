//! Real WebKit pages in a hidden window (never shown, the app never activated): a local file loads, its
//! address and title come back, a cover's still picture arrives, the key monitor takes a window shortcut from
//! the page and leaves typing to it, a press beside the page takes the keyboard back, and closing the last page
//! ends its WebContent process. Prints the helpers' pids and footprints.
//!
//! Starts WebKit, so it runs only with `PERCH_WEBKIT_PROBE=1` (macOS); otherwise it says so and passes. Events are
//! built in this process and given to the app (`-[NSApplication sendEvent:]`); nothing is posted to the screen.

#[cfg(not(target_os = "macos"))]
fn main() {
    println!("browser_webkit: macOS only");
}

#[cfg(target_os = "macos")]
fn main() {
    if std::env::var("PERCH_WEBKIT_PROBE").as_deref() != Ok("1") {
        println!("browser_webkit: skipped (set PERCH_WEBKIT_PROBE=1 to start WebKit)");
        return;
    }
    probe::run();
}

#[cfg(target_os = "macos")]
mod probe {
    use gpui::{
        div, prelude::*, px, rgb, size, App, Bounds, Context, Keystroke, Window, WindowBounds,
        WindowOptions,
    };
    use objc2::runtime::{AnyObject, Bool};
    use objc2::{class, msg_send, Encode, Encoding};
    use perch_native::browser::slot::{page_slot, reconcile, Look, Shared};
    use perch_native::browser::view::WryFactory;
    use perch_native::browser::{keys, Browsers, PageEvent};
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    use std::cell::RefCell;
    use std::rc::Rc;
    use std::time::{Duration, Instant};

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct Point {
        x: f64,
        y: f64,
    }
    unsafe impl Encode for Point {
        const ENCODING: Encoding =
            Encoding::Struct("CGPoint", &[Encoding::Double, Encoding::Double]);
    }

    struct Host {
        pages: Shared,
        cover: bool,
    }

    impl Render for Host {
        fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
            self.pages.borrow_mut().begin_frame();
            let look = Look {
                fill: rgb(0x202020).into(),
                hint: rgb(0x808080).into(),
            };
            div()
                .size_full()
                .flex()
                .flex_row()
                .child(div().w(px(200.)).h_full())
                .child(page_slot(&self.pages, "page", self.cover, look))
                .child(reconcile(&self.pages, self.cover, 1.0))
        }
    }

    fn webkit() -> Vec<u32> {
        let out = std::process::Command::new("pgrep")
            .args(["-f", "com.apple.WebKit"])
            .output()
            .unwrap();
        String::from_utf8_lossy(&out.stdout)
            .split_whitespace()
            .filter_map(|p| p.parse().ok())
            .collect()
    }

    fn describe(pid: u32) -> String {
        let name = std::process::Command::new("ps")
            .args(["-o", "comm=", "-p", &pid.to_string()])
            .output()
            .unwrap();
        let name = String::from_utf8_lossy(&name.stdout)
            .trim()
            .rsplit('.')
            .next()
            .unwrap_or("")
            .to_string();
        let foot = std::process::Command::new("footprint")
            .args(["-p", &pid.to_string()])
            .output();
        let mb = foot
            .ok()
            .and_then(|o| {
                String::from_utf8_lossy(&o.stdout)
                    .lines()
                    .find(|l| l.contains("phys_footprint:"))
                    .map(|l| l.split_whitespace().skip(1).collect::<Vec<_>>().join(""))
            })
            .unwrap_or_else(|| "?".into());
        format!("{pid}:{name}:{mb}")
    }

    fn check(what: &str, ok: bool) {
        if !ok {
            eprintln!("browser_webkit: FAILED: {what}");
            std::process::exit(1);
        }
        println!("browser_webkit: {what}");
    }

    unsafe fn key(number: isize, base: &str, code: u16, cmd: bool) -> *mut AnyObject {
        let text = |s: &str| -> *mut AnyObject {
            let c = std::ffi::CString::new(s).unwrap();
            unsafe { msg_send![class!(NSString), stringWithUTF8String: c.as_ptr()] }
        };
        let flags: usize = if cmd { 1 << 20 } else { 0 };
        unsafe {
            msg_send![class!(NSEvent), keyEventWithType: 10usize, location: Point { x: 0., y: 0. }, modifierFlags: flags,
                timestamp: 0.0f64, windowNumber: number, context: std::ptr::null_mut::<AnyObject>(), characters: text(base),
                charactersIgnoringModifiers: text(base), isARepeat: Bool::NO, keyCode: code]
        }
    }

    unsafe fn press(number: isize, kind: usize, x: f64, y: f64) -> *mut AnyObject {
        unsafe {
            msg_send![class!(NSEvent), mouseEventWithType: kind, location: Point { x, y }, modifierFlags: 0usize,
                timestamp: 0.0f64, windowNumber: number, context: std::ptr::null_mut::<AnyObject>(), eventNumber: 0isize,
                clickCount: 1isize, pressure: 1.0f32]
        }
    }

    unsafe fn send(event: *mut AnyObject) {
        unsafe {
            let app: *mut AnyObject = msg_send![class!(NSApplication), sharedApplication];
            let _: () = msg_send![app, sendEvent: event];
        }
    }

    pub fn run() {
        let dir = std::env::temp_dir().join(format!("perch-webkit-probe-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let page = dir.join("page.html");
        std::fs::write(
            &page,
            "<title>Probe page</title><input autofocus><script>document.addEventListener('keydown', e => document.title = 'key ' + e.key)</script>",
        )
        .unwrap();
        let url = url::Url::from_file_path(&page).unwrap().to_string();
        let before = webkit();
        gpui_platform::application()
            .with_activation_policy(gpui::ActivationPolicy::Prohibited)
            .run(move |cx: &mut App| {
                let bounds = Bounds::new(gpui::point(px(0.), px(0.)), size(px(800.), px(600.)));
                let options = WindowOptions {
                    window_bounds: Some(WindowBounds::Windowed(bounds)),
                    focus: false,
                    show: false,
                    ..Default::default()
                };
                let (tx, mut rx) = futures::channel::mpsc::unbounded();
                let pages: Rc<RefCell<Option<Shared>>> = Rc::default();
                let slot = pages.clone();
                let handle = cx
                    .open_window(options, move |window, cx| {
                        let factory = WryFactory::new(&*window, tx).expect("an AppKit window");
                        let mut ids = 0;
                        let b = Browsers::new(
                            Box::new(factory),
                            Box::new(move || {
                                ids += 1;
                                format!("{ids}")
                            }),
                        );
                        let shared: Shared = Rc::new(RefCell::new(b));
                        *slot.borrow_mut() = Some(shared.clone());
                        cx.new(|_| Host {
                            pages: shared,
                            cover: false,
                        })
                    })
                    .unwrap();
                let pages = pages.borrow().clone().unwrap();
                let (url, dir) = (url.clone(), dir.clone());
                cx.spawn(async move |cx| {
                    let exec = cx.background_executor().clone();
                    let pause = move |ms| exec.timer(Duration::from_millis(ms));
                    let redraw = |cx: &mut gpui::AsyncApp, cover: bool| {
                        // A window never shown gets no display frames: draw one here.
                        handle
                            .update(cx, |host, _, cx| {
                                host.cover = cover;
                                cx.notify();
                            })
                            .unwrap();
                        cx.update_window(handle.into(), |_, window, cx| {
                            let _ = window.draw(cx);
                        })
                        .unwrap();
                    };
                    pages.borrow_mut().ensure("page", &url);
                    pages.borrow_mut().focus("page");
                    redraw(cx, false);
                    pause(2500).await;
                    let made: Vec<u32> = webkit()
                        .into_iter()
                        .filter(|p| !before.contains(p))
                        .collect();
                    println!(
                        "browser_webkit: helpers with a page: {:?}",
                        made.iter().map(|p| describe(*p)).collect::<Vec<_>>()
                    );
                    check("a page starts WebKit helpers", !made.is_empty());
                    check(
                        "the shown page has the keyboard",
                        pages.borrow().page_has_keyboard(),
                    );

                    // Address and title follow the page.
                    pages.borrow_mut().poll();
                    let deadline = Instant::now() + Duration::from_secs(5);
                    let mut title = String::new();
                    while title.is_empty() && Instant::now() < deadline {
                        if let Ok((key, event)) = rx.try_recv() {
                            pages.borrow_mut().on_event(&key, event);
                        }
                        title = pages.borrow().meta("page").title;
                        pause(50).await;
                    }
                    check("the local file's title comes back", title == "Probe page");
                    check(
                        "its address is the file's",
                        pages.borrow().meta("page").url == url,
                    );

                    // The key monitor: a window shortcut is taken, typing reaches the page.
                    let (parent, number) = handle
                        .update(cx, |_, window, _| {
                            let RawWindowHandle::AppKit(h) =
                                HasWindowHandle::window_handle(&*window).unwrap().as_raw()
                            else {
                                unreachable!()
                            };
                            let view = h.ns_view.as_ptr() as *mut AnyObject;
                            let number: isize = unsafe {
                                let w: *mut AnyObject = msg_send![view, window];
                                msg_send![w, windowNumber]
                            };
                            (view, number)
                        })
                        .unwrap();
                    let taken: Rc<RefCell<Vec<Keystroke>>> = Rc::default();
                    let offered: Rc<RefCell<Vec<String>>> = Rc::default();
                    let (seen, asked) = (taken.clone(), offered.clone());
                    let monitor = unsafe {
                        keys::install(
                            parent,
                            Rc::new(move |k: &Keystroke| {
                                asked.borrow_mut().push(k.key.clone());
                                let take = k.modifiers.platform && k.key == "t";
                                if take {
                                    seen.borrow_mut().push(k.clone());
                                }
                                take
                            }),
                        )
                    };
                    unsafe { send(key(number, "t", 17, true)) };
                    unsafe { send(key(number, "x", 7, false)) };
                    // The app hands keys to its key window, which a never-shown window is not: once the monitor
                    // has let `x` through, give it to the window as AppKit would.
                    unsafe {
                        let w: *mut AnyObject = msg_send![parent, window];
                        let _: () = msg_send![w, sendEvent: key(number, "x", 7, false)];
                    }
                    pause(500).await;
                    pages.borrow_mut().poll();
                    pause(500).await;
                    while let Ok((key, event)) = rx.try_recv() {
                        pages.borrow_mut().on_event(&key, event);
                    }
                    check("cmd-t is the window's", taken.borrow().len() == 1);
                    check(
                        "the monitor saw x and let it through",
                        *offered.borrow() == ["t", "x"],
                    );
                    check(
                        "x reaches the page",
                        pages.borrow().meta("page").title == "key x",
                    );

                    // A press beside the page takes the keyboard back; one on the page gives it again.
                    unsafe { send(press(number, 1, 100., 300.)) };
                    check(
                        "a press beside the page takes the keyboard back",
                        !pages.borrow().page_has_keyboard(),
                    );
                    unsafe { send(press(number, 1, 500., 300.)) };
                    check(
                        "a press on the page gives it the keyboard",
                        pages.borrow().page_has_keyboard(),
                    );
                    drop(monitor);

                    // A cover: the page hides and its still picture arrives.
                    redraw(cx, true);
                    let deadline = Instant::now() + Duration::from_secs(5);
                    let mut picture = None;
                    while picture.is_none() && Instant::now() < deadline {
                        if let Ok((key, event)) = rx.try_recv() {
                            if let PageEvent::Snapshot(png) = &event {
                                picture = Some(png.len());
                            }
                            pages.borrow_mut().on_event(&key, event);
                        }
                        pause(50).await;
                    }
                    println!("browser_webkit: still picture {picture:?} bytes");
                    check(
                        "a covered page's still picture arrives",
                        picture.is_some_and(|n| n > 100),
                    );
                    check(
                        "a covered page does not keep the keyboard",
                        !pages.borrow().page_has_keyboard(),
                    );

                    // Closing the last page ends its content process.
                    pages.borrow_mut().close("page");
                    check("no view is left", pages.borrow().live_views() == 0);
                    let closed = Instant::now();
                    let mut left = made.clone();
                    for _ in 0..50 {
                        let now = webkit();
                        left = made.iter().copied().filter(|p| now.contains(p)).collect();
                        if left.len() < made.len() {
                            break;
                        }
                        pause(100).await;
                    }
                    pause(1000).await;
                    let now = webkit();
                    left.retain(|p| now.contains(p));
                    let described: Vec<_> = left.iter().map(|p| describe(*p)).collect();
                    println!(
                        "browser_webkit: left {:.1}s after the last close: {described:?}",
                        closed.elapsed().as_secs_f32()
                    );
                    check(
                        "the WebContent process ended",
                        !described.iter().any(|d| d.contains("WebContent")),
                    );
                    for at in [5u64, 10] {
                        pause((at * 1000).saturating_sub(closed.elapsed().as_millis() as u64))
                            .await;
                        let now = webkit();
                        let still: Vec<_> = made
                            .iter()
                            .filter(|p| now.contains(p))
                            .map(|p| describe(*p))
                            .collect();
                        println!("browser_webkit: {at}s after the last close: {still:?}");
                    }
                    let _ = std::fs::remove_dir_all(&dir);
                    println!("browser_webkit: ok");
                    cx.update(|cx| cx.quit());
                })
                .detach();
            });
    }
}

//! Browser page slots in an offscreen window, with recording views (WebKit cannot run headless): the views
//! follow where slots paint, a cover draws the page's still picture in its place, and a slot not drawn hides
//! its view.

use gpui::{
    div, prelude::*, px, rgb, size, AppContext, Context, HeadlessAppContext, Window, WindowHandle,
};
use perch_native::browser::fake::{browsers, Calls};
use perch_native::browser::slot::{page_slot, reconcile, Look, Shared};
use perch_native::browser::PageEvent;
use std::cell::RefCell;
use std::rc::Rc;
use std::sync::Arc;

const WIDTH: f32 = 600.;
const HEIGHT: f32 = 400.;
const LEFT: f32 = 200.;

struct Host {
    pages: Shared,
    cover: bool,
    shown: bool,
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
            .child(div().w(px(LEFT)).h_full())
            .children(
                self.shown
                    .then(|| page_slot(&self.pages, "a", self.cover, look)),
            )
            .child(reconcile(&self.pages, self.cover, 1.0))
    }
}

struct Rig {
    cx: HeadlessAppContext,
    window: WindowHandle<Host>,
    pages: Shared,
    calls: Rc<RefCell<Calls>>,
}

impl Rig {
    fn new(url: &str) -> Self {
        let mut cx = HeadlessAppContext::with_platform(
            gpui_platform::current_platform(true).text_system(),
            Arc::new(()),
            gpui_platform::current_headless_renderer,
        );
        let (b, calls) = browsers();
        let pages: Shared = Rc::new(RefCell::new(b));
        pages.borrow_mut().ensure("a", url);
        let held = pages.clone();
        let window = cx
            .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
                cx.new(|_| Host {
                    pages: held,
                    cover: false,
                    shown: true,
                })
            })
            .unwrap();
        Rig {
            cx,
            window,
            pages,
            calls,
        }
    }

    fn set(&mut self, f: impl FnOnce(&mut Host)) {
        self.cx
            .update_window(self.window.into(), |root, _, cx| {
                let host = root.downcast::<Host>().unwrap();
                host.update(cx, |host, cx| {
                    f(host);
                    cx.notify();
                });
            })
            .unwrap();
    }

    /// Draw a frame and let the views follow; the frame's pixels (RGBA) and width.
    fn draw(&mut self) -> (Vec<u8>, usize, f32) {
        let shot = self
            .cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                let _ = window.draw(cx);
                (
                    window.render_to_image().expect("offscreen render"),
                    window.scale_factor(),
                )
            })
            .unwrap();
        self.cx.run_until_parked();
        let (image, scale) = shot;
        let width = image.width() as usize;
        (image.into_raw(), width, scale)
    }

    fn take(&self) -> Vec<String> {
        std::mem::take(&mut self.calls.borrow_mut().log)
    }
}

fn pixel(shot: &(Vec<u8>, usize, f32), x: f32, y: f32) -> [u8; 3] {
    let (raw, width, scale) = shot;
    let at = ((y * scale) as usize * width + (x * scale) as usize) * 4;
    [raw[at], raw[at + 1], raw[at + 2]]
}

fn red_png() -> Arc<Vec<u8>> {
    let image = image::RgbaImage::from_pixel(8, 8, image::Rgba([255, 0, 0, 255]));
    let mut png = Vec::new();
    image
        .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
        .unwrap();
    Arc::new(png)
}

fn views_follow_where_slots_paint() {
    let mut rig = Rig::new("https://a.test/");
    rig.draw();
    assert_eq!(
        rig.take(),
        [
            "a create https://a.test/ zoom 1",
            "a frame 200,0,400,400",
            "a zoom 1",
            "a show"
        ],
        "made on its first show, at the slot's painted bounds"
    );
    rig.draw();
    assert!(
        rig.take().is_empty(),
        "an unchanged frame tells the view nothing"
    );
}

fn a_cover_draws_the_still_picture_in_the_pages_place() {
    let mut rig = Rig::new("https://a.test/");
    rig.draw();
    rig.take();
    rig.set(|h| h.cover = true);
    let shot = rig.draw();
    assert_eq!(rig.take(), ["a snapshot", "a hide"]);
    assert_eq!(
        pixel(&shot, 400., 200.),
        [0x20, 0x20, 0x20],
        "the plain fill until the picture arrives"
    );
    rig.pages
        .borrow_mut()
        .on_event("a", PageEvent::Snapshot(red_png()));
    let shot = rig.draw();
    assert_eq!(
        pixel(&shot, 400., 200.),
        [255, 0, 0],
        "the picture in the page's place"
    );
    assert_ne!(pixel(&shot, 100., 200.), [255, 0, 0], "and only there");
    rig.set(|h| h.cover = false);
    rig.draw();
    assert_eq!(rig.take(), ["a show"]);
}

fn a_slot_not_drawn_hides_its_view_and_keeps_it() {
    let mut rig = Rig::new("https://a.test/");
    rig.draw();
    rig.take();
    rig.set(|h| h.shown = false);
    rig.draw();
    assert_eq!(rig.take(), ["a hide"]);
    assert_eq!(rig.pages.borrow().live_views(), 1);
    rig.set(|h| h.shown = true);
    rig.draw();
    assert_eq!(rig.take(), ["a show"]);
}

fn an_empty_bar_makes_no_view() {
    let mut rig = Rig::new("");
    rig.draw();
    rig.draw();
    assert!(rig.take().is_empty());
    assert_eq!(rig.pages.borrow().live_views(), 0);
}

fn main() {
    views_follow_where_slots_paint();
    a_cover_draws_the_still_picture_in_the_pages_place();
    a_slot_not_drawn_hides_its_view_and_keeps_it();
    an_empty_bar_makes_no_view();
    println!("browser_pane: ok");
}

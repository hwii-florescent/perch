//! Where a browser page goes in the layout, as GPUI elements.
//!
//! [`page_slot`] fills its box and records, as it paints, where the page is; under a cover it draws, in the page's
//! place, its still picture (an element named `browser-snapshot#<key>`, the plain fill until the picture arrives).
//! [`reconcile`], painted after every slot, then has the views follow (`Browsers::end_frame`). The view calls
//! wait for GPUI's paint to end (`App::defer`): AppKit's first-responder changes must not run inside it.
//!
//! The window's pages are found by window ([`attach`]), so the `browser` engine a screen places and the
//! Rust-drawn browser tab reach the same pages.

use super::{Browsers, Frame};
use gpui::{
    canvas, div, img, prelude::*, AnyElement, App, Bounds, Hsla, Pixels, RenderImage, SharedString,
    Window, WindowId,
};
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use std::sync::Arc;

/// A window's pages, shared by the window and the slots it draws.
pub type Shared = Rc<RefCell<Browsers>>;

thread_local! {
    static WINDOWS: RefCell<HashMap<WindowId, Shared>> = RefCell::default();
    /// Each page's decoded picture, by the PNG it came from.
    static PICTURES: RefCell<HashMap<String, (usize, Arc<RenderImage>)>> = RefCell::default();
}

/// `window`'s pages are `pages` from now on.
pub fn attach(window: WindowId, pages: Shared) {
    WINDOWS.with(|w| w.borrow_mut().insert(window, pages));
}

/// The window is going: its pages are no longer reachable from a slot.
pub fn detach(window: WindowId) {
    WINDOWS.with(|w| w.borrow_mut().remove(&window));
}

/// The pages of the window being drawn.
pub fn pages(window: &Window) -> Option<Shared> {
    let id = window.window_handle().window_id();
    WINDOWS.with(|w| w.borrow().get(&id).cloned())
}

fn frame(bounds: Bounds<Pixels>) -> Frame {
    Frame {
        x: f32::from(bounds.origin.x),
        y: f32::from(bounds.origin.y),
        width: f32::from(bounds.size.width),
        height: f32::from(bounds.size.height),
    }
}

/// The PNG as GPUI draws images (BGRA), decoded once per picture.
fn picture(key: &str, png: &Arc<Vec<u8>>) -> Option<Arc<RenderImage>> {
    let id = Arc::as_ptr(png) as usize;
    if let Some(found) = PICTURES.with(|p| {
        p.borrow()
            .get(key)
            .filter(|(at, _)| *at == id)
            .map(|(_, i)| i.clone())
    }) {
        return Some(found);
    }
    let mut rgba = image::load_from_memory_with_format(png, image::ImageFormat::Png)
        .ok()?
        .to_rgba8();
    for pixel in rgba.pixels_mut() {
        pixel.0.swap(0, 2);
    }
    let decoded = Arc::new(RenderImage::new(vec![image::Frame::new(rgba)]));
    PICTURES.with(|p| {
        p.borrow_mut()
            .insert(key.to_string(), (id, decoded.clone()))
    });
    Some(decoded)
}

/// The colours a slot uses: the page's backdrop and the hint's text.
#[derive(Clone, Copy)]
pub struct Look {
    pub fill: Hsla,
    pub hint: Hsla,
}

/// Page `key`'s place. `cover`: a menu, dialog or other floating screen is open over the window.
pub fn page_slot(pages: &Shared, key: &str, cover: bool, look: Look) -> AnyElement {
    let (started, covered, png) = {
        let b = pages.borrow();
        (
            !b.meta(key).url.is_empty(),
            b.covered(key, cover),
            b.snapshot(key),
        )
    };
    let recorder = {
        let (pages, key) = (pages.clone(), key.to_string());
        canvas(
            |_, _, _| (),
            move |bounds, _, _, _| pages.borrow_mut().painted(&key, frame(bounds)),
        )
        .absolute()
        .size_full()
    };
    let mut slot = div()
        .id(SharedString::from(format!("browser-slot#{key}")))
        .relative()
        .flex_1()
        .min_h_0()
        .min_w_0()
        .size_full()
        .child(recorder);
    if !started {
        slot = slot.child(
            div()
                .size_full()
                .flex()
                .items_center()
                .justify_center()
                .p_6()
                .text_size(gpui::px(12.))
                .text_color(look.hint)
                .child("Search or enter an address above to browse."),
        );
    } else if covered {
        let still = png.and_then(|png| picture(key, &png));
        slot = slot.child(
            div()
                .id(SharedString::from(format!("browser-snapshot#{key}")))
                .absolute()
                .size_full()
                .bg(look.fill)
                .children(still.map(|still| img(still).size_full())),
        );
    }
    slot.into_any_element()
}

/// Painted after every slot of the window: the views follow what was drawn, once GPUI's paint is over.
pub fn reconcile(pages: &Shared, cover: bool, zoom: f64) -> AnyElement {
    let pages = pages.clone();
    canvas(
        |_, _, _| (),
        move |_, _, _: &mut Window, cx: &mut App| {
            cx.defer(move |_| pages.borrow_mut().end_frame(cover, zoom));
        },
    )
    .absolute()
    .size_0()
    .into_any_element()
}

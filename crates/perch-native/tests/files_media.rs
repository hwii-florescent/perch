//! The file pane's native image, drawn offscreen: fitted and zoomed sizes, drag to pan, Fit's
//! scale, and a released image gone from the frame. No core runs (a fake gives the bytes), no
//! window is shown or focused, and nothing opens Quick Look or another app.

use gpui::{
    div, point, px, size, AppContext as _, HeadlessAppContext, Modifiers, MouseButton,
    MouseDownEvent, MouseMoveEvent, MouseUpEvent, ParentElement as _, PlatformInput, Point, Render,
    Styled as _, Window, WindowHandle,
};
use perch_native::files::media::{self, Fetch, MediaFile};
use std::sync::Arc;

const W: f32 = 400.;
const H: f32 = 300.;
const KEY: &str = "pane";

struct Pane;

impl Render for Pane {
    fn render(&mut self, _: &mut Window, _: &mut gpui::Context<Self>) -> impl gpui::IntoElement {
        div()
            .size_full()
            .bg(gpui::rgb(0x000000))
            .child(media::element(KEY))
    }
}

struct Bytes(Vec<u8>);
impl Fetch for Bytes {
    fn fetch(&self, _: &str, _: &str, _: u64) -> anyhow::Result<Vec<u8>> {
        Ok(self.0.clone())
    }
}

fn png(w: u32, h: u32) -> Vec<u8> {
    let mut out = std::io::Cursor::new(Vec::new());
    image::RgbaImage::from_pixel(w, h, image::Rgba([255, 0, 0, 255]))
        .write_to(&mut out, image::ImageFormat::Png)
        .unwrap();
    out.into_inner()
}

/// Opens a `w`×`h` red PNG under [`KEY`] and waits for it to decode.
fn open(cx: &mut HeadlessAppContext, w: u32, h: u32) {
    let svg = cx.update(|cx| cx.svg_renderer());
    let file = MediaFile {
        workspace_id: "w".into(),
        path: "red.png".into(),
        media_type: "image/png".into(),
        size: 100,
    };
    let natural = media::open(KEY, file, Arc::new(Bytes(png(w, h))), svg)().unwrap();
    assert_eq!(natural, Some((w, h)));
}

/// The frame as RGB rows, and its scale.
fn draw(cx: &mut HeadlessAppContext, window: WindowHandle<Pane>) -> (image::RgbaImage, f32) {
    cx.update_window(window.into(), |_, window: &mut Window, cx| {
        window.refresh();
        let _ = window.draw(cx);
        (
            window.render_to_image().expect("offscreen render"),
            window.scale_factor(),
        )
    })
    .unwrap()
}

/// How many logical pixels across the red picture is on the row through `y`.
fn red_width(frame: &(image::RgbaImage, f32), y: f32) -> f32 {
    let (image, scale) = frame;
    let row = (y * scale) as u32;
    let red = (0..image.width())
        .filter(|x| {
            let p = image.get_pixel(*x, row);
            p[0] > 200 && p[1] < 50 && p[2] < 50
        })
        .count();
    red as f32 / scale
}

fn mouse(cx: &mut HeadlessAppContext, window: WindowHandle<Pane>, events: Vec<PlatformInput>) {
    cx.update_window(window.into(), |_, window: &mut Window, cx| {
        for event in events {
            window.dispatch_event(event, cx);
        }
    })
    .unwrap();
    cx.run_until_parked();
}

fn drag(from: Point<gpui::Pixels>, to: Point<gpui::Pixels>) -> Vec<PlatformInput> {
    vec![
        PlatformInput::MouseDown(MouseDownEvent {
            button: MouseButton::Left,
            position: from,
            modifiers: Modifiers::default(),
            click_count: 1,
            first_mouse: false,
        }),
        PlatformInput::MouseMove(MouseMoveEvent {
            position: to,
            pressed_button: Some(MouseButton::Left),
            modifiers: Modifiers::default(),
        }),
        PlatformInput::MouseUp(MouseUpEvent {
            button: MouseButton::Left,
            position: to,
            modifiers: Modifiers::default(),
            click_count: 1,
        }),
    ]
}

fn main() {
    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let window = cx
        .open_window(size(px(W), px(H)), |_, cx| cx.new(|_| Pane))
        .unwrap();

    // A small image is drawn at its own size when fitted (Fit never enlarges), centred.
    open(&mut cx, 64, 48);
    let frame = draw(&mut cx, window);
    assert!(
        (red_width(&frame, H / 2.) - 64.).abs() <= 1.,
        "64 px wide when fitted"
    );
    assert_eq!(media::fit_scale(KEY), Some(1.));

    // Zoomed: drawn at its scaled size. Past the pane: drawn at its scaled size, and a drag pans it (Fit does not pan).
    media::set_zoom(KEY, Some(2.));
    let frame = draw(&mut cx, window);
    assert!(
        (red_width(&frame, H / 2.) - 128.).abs() <= 2.,
        "2x is 128 px wide"
    );
    media::set_zoom(KEY, Some(10.));
    let frame = draw(&mut cx, window);
    let wide = red_width(&frame, H / 2.);
    assert!(wide >= W - 24. - 1., "8x (the cap) fills the pane: {wide}");
    mouse(
        &mut cx,
        window,
        drag(point(px(200.), px(150.)), point(px(150.), px(110.))),
    );
    assert_eq!(
        media::scroll_offset(KEY),
        Some(point(px(-50.), px(-40.))),
        "dragging left and up scrolls right and down"
    );
    mouse(
        &mut cx,
        window,
        drag(point(px(100.), px(100.)), point(px(400.), px(400.))),
    );
    assert_eq!(
        media::scroll_offset(KEY),
        Some(point(px(0.), px(0.))),
        "panning stops at the edge"
    );

    // A large image fits the pane less its padding, keeping its shape.
    open(&mut cx, 800, 600);
    let frame = draw(&mut cx, window);
    let fit = media::fit_scale(KEY).unwrap();
    assert!((fit - (H - 24.) / 600.).abs() < 0.001, "fit {fit}");
    assert!((red_width(&frame, H / 2.) - 800. * fit).abs() <= 1.5);

    // Released: forgotten and no longer drawn.
    cx.update_window(window.into(), |_, window: &mut Window, cx| {
        media::release(KEY, Some(window), cx)
    })
    .unwrap();
    assert!(!media::is_open(KEY));
    let frame = draw(&mut cx, window);
    assert_eq!(red_width(&frame, H / 2.), 0., "nothing drawn after release");

    println!("files_media: ok");
}

//! Media in the file pane: the `perch-media` host module behind the native `FileAsset`.
//!
//! The screen side (header, toolbar, cards, the web's Fit / 100% / zoom arithmetic and keys) is
//! `FileAsset` in `@perch/sdk`, so its boxes are named for the parity gate as the web's are. What
//! JavaScript cannot do is here:
//!
//! - `open(key, file)` fetches an image's bytes from the core (`workspace-file`, inside the
//!   workspace's confinement) and decodes them off the UI thread with GPUI's own decoder: png,
//!   jpeg, gif (every frame), webp, svg (usvg, no script), bmp, tiff, ico. It resolves with the
//!   natural size (`null` for an SVG without `width`/`height`, which only fits) or rejects with
//!   `too-large` (over [`MAX_IMAGE_BYTES`] or a side over [`MAX_SIDE`]) or the reason it failed.
//!   A later `open` or a `release` of the same key makes an earlier result stale; it is dropped.
//! - `Image.new(key)` draws that image filling its box: fitted (scaled down only, as the web's
//!   `max-w-full max-h-full`) or at `setZoom(key, scale)`, centred, in a box that scrolls and pans
//!   by mouse drag. `fitScale(key)` is the scale Fit came to in the last layout.
//! - `release(key)` forgets the image and frees its GPU tiles.
//! - `quickLook(path)` and `openDefault(path)` open an existing absolute path (the workspace's real
//!   file, so edits in the other app land in it) through the [`MediaOpener`] global, which tests
//!   replace. Only a person's click calls them.

use crate::client::Core;
use crate::mods::ModHost;
use gpui::{
    canvas, div, img, prelude::*, px, AnyElement, App, Bounds, CursorStyle, DispatchPhase, Global,
    Image, ImageFormat, MouseButton, MouseMoveEvent, MouseUpEvent, ObjectFit, Pixels, Point,
    RenderImage, ScrollHandle, SvgRenderer, Window,
};
use gpui_shell::{HostError, HostModule, HostValue};
use std::cell::RefCell;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::sync::{Arc, Mutex};

/// Images larger than this are not fetched or decoded (the web's `MAX_IMAGE_BYTES`).
pub const MAX_IMAGE_BYTES: u64 = 50 * 1024 * 1024;
/// The longest side decoded (the web's `MAX_SIDE`, and Metal's texture limit).
pub const MAX_SIDE: u32 = 16_384;
/// The pane's padding around the image (the web's `p-3`).
const PAD: f32 = 12.;
/// What `open` rejects with for an image too large to preview.
pub const TOO_LARGE: &str = "too-large";

const DECLARATIONS: &str = "export const Image: { new(key: string, props: {}): any };
export function open(key: string, file: { workspaceId: string; path: string; mediaType: string; size: number }): Promise<{ width: number; height: number } | null>;
export function setZoom(key: string, zoom: number | null): void;
export function fitScale(key: string): number | null;
export function release(key: string): void;
export function quickLook(path: string): void;
export function openDefault(path: string): void;";

/// Reads a workspace file's bytes. [`Core`] reads them from the core; tests give their own.
pub trait Fetch: Send + Sync {
    fn fetch(&self, workspace_id: &str, path: &str, max: u64) -> anyhow::Result<Vec<u8>>;
}

impl Fetch for Core {
    fn fetch(&self, workspace_id: &str, path: &str, max: u64) -> anyhow::Result<Vec<u8>> {
        self.fetch_file(workspace_id, path, max)
    }
}

/// Opens a file outside Perch. [`SystemOpener`] is the app's; tests install one that records.
pub trait MediaOpener {
    fn quick_look(&self, path: &Path, window: Option<&mut Window>, cx: &mut App);
    fn open_default(&self, path: &Path, cx: &mut App);
}

/// The installed [`MediaOpener`].
#[derive(Clone)]
pub struct Opener(pub Rc<dyn MediaOpener>);
impl Global for Opener {}

/// The system: Quick Look's panel, and the file's default app (`open -- path`).
pub struct SystemOpener;

impl MediaOpener for SystemOpener {
    fn quick_look(&self, path: &Path, window: Option<&mut Window>, cx: &mut App) {
        #[cfg(target_os = "macos")]
        if let Some(window) = window {
            if super::quick_look::show(path, &*window) {
                return;
            }
        }
        let _ = window;
        self.open_default(path, cx);
    }

    fn open_default(&self, path: &Path, cx: &mut App) {
        cx.open_with_system(path);
    }
}

/// `path` if it may be handed to another app: absolute and an existing file (the Tauri app's
/// `open_in_default_app` rule). An absolute path never starts with `-`, so `open` cannot take it
/// for an option.
pub fn checked_path(path: &str) -> Result<PathBuf, &'static str> {
    let path = PathBuf::from(path);
    if !path.is_absolute() || path.as_os_str().to_string_lossy().starts_with('-') {
        return Err("not an absolute path");
    }
    if !path.is_file() {
        return Err("not an existing file");
    }
    Ok(path)
}

/// The decoder for a media type, if GPUI has one.
pub fn format_for(media_type: &str) -> Option<ImageFormat> {
    Some(match media_type {
        "image/png" => ImageFormat::Png,
        "image/jpeg" => ImageFormat::Jpeg,
        "image/gif" => ImageFormat::Gif,
        "image/webp" => ImageFormat::Webp,
        "image/svg+xml" => ImageFormat::Svg,
        "image/bmp" => ImageFormat::Bmp,
        "image/tiff" => ImageFormat::Tiff,
        "image/x-icon" | "image/vnd.microsoft.icon" => ImageFormat::Ico,
        _ => return None,
    })
}

/// A decoded image and its natural size in pixels (`None`: an SVG that only fits).
#[derive(Clone)]
pub struct Decoded {
    pub image: Arc<RenderImage>,
    pub natural: Option<(u32, u32)>,
}

/// Why an image is not shown.
#[derive(Debug, PartialEq, Eq)]
pub enum Failure {
    TooLarge,
    Unavailable(String),
}

impl Failure {
    fn message(&self) -> String {
        match self {
            Failure::TooLarge => TOO_LARGE.to_string(),
            Failure::Unavailable(reason) => reason.clone(),
        }
    }
}

/// Whether an SVG's root element gives both `width` and `height` (else a browser reports no
/// natural size, and the web viewer offers only Fit).
fn svg_has_size(bytes: &[u8]) -> bool {
    let text = String::from_utf8_lossy(&bytes[..bytes.len().min(64 * 1024)]);
    let Some(start) = text.find("<svg") else {
        return false;
    };
    let tag = &text[start
        ..text[start..]
            .find('>')
            .map_or(text.len(), |end| start + end)];
    let has = |name: &str| {
        tag.split(|c: char| c.is_whitespace())
            .any(|attr| attr.starts_with(&format!("{name}=")))
    };
    has("width") && has("height")
}

/// Decodes `bytes` as `format`, refusing a side over [`MAX_SIDE`] before decoding a pixel.
pub fn decode(bytes: Vec<u8>, format: ImageFormat, svg: &SvgRenderer) -> Result<Decoded, Failure> {
    let unavailable = |error: &dyn std::fmt::Display| Failure::Unavailable(error.to_string());
    if format == ImageFormat::Svg {
        let tree = usvg::Tree::from_data(&bytes, &usvg::Options::default())
            .map_err(|e| unavailable(&e))?;
        let (w, h) = (tree.size().width().ceil(), tree.size().height().ceil());
        if w > MAX_SIDE as f32 || h > MAX_SIDE as f32 {
            return Err(Failure::TooLarge);
        }
        let natural = svg_has_size(&bytes).then_some((w as u32, h as u32));
        // Rasterised at twice its size so it stays sharp on a Retina screen and when zoomed.
        let image = svg
            .render_single_frame(&bytes, 2.0)
            .map_err(|e| unavailable(&e))?;
        return Ok(Decoded { image, natural });
    }
    let (w, h) = image::ImageReader::new(std::io::Cursor::new(&bytes))
        .with_guessed_format()
        .map_err(|e| unavailable(&e))?
        .into_dimensions()
        .map_err(|e| unavailable(&e))?;
    if w > MAX_SIDE || h > MAX_SIDE {
        return Err(Failure::TooLarge);
    }
    let image = Image::from_bytes(format, bytes)
        .to_image_data(svg.clone())
        .map_err(|e| unavailable(&e))?;
    Ok(Decoded {
        image,
        natural: Some((w, h)),
    })
}

/// What `open` reads: a workspace file and what the core said it is.
#[derive(Clone, Debug)]
pub struct MediaFile {
    pub workspace_id: String,
    pub path: String,
    pub media_type: String,
    pub size: u64,
}

/// Fetches and decodes `file` (blocking; call it off the UI thread). Nothing is fetched for a file
/// already known to be too large or of a type GPUI cannot decode.
pub fn load(fetch: &dyn Fetch, file: &MediaFile, svg: &SvgRenderer) -> Result<Decoded, Failure> {
    if file.size > MAX_IMAGE_BYTES {
        return Err(Failure::TooLarge);
    }
    let format = format_for(&file.media_type)
        .ok_or_else(|| Failure::Unavailable(format!("{} cannot be shown here", file.media_type)))?;
    let bytes = fetch
        .fetch(&file.workspace_id, &file.path, MAX_IMAGE_BYTES)
        .map_err(|e| Failure::Unavailable(format!("{e:#}")))?;
    decode(bytes, format, svg)
}

/// One key's image, shared with the background work that decodes it.
#[derive(Default)]
struct Entry {
    generation: u64,
    decoded: Option<Decoded>,
    zoom: Option<f32>,
}

/// One key's view state, which only the UI thread touches.
#[derive(Default)]
struct Pane {
    scroll: ScrollHandle,
    drag: Option<(Point<Pixels>, Point<Pixels>)>,
    bounds: Option<Bounds<Pixels>>,
}

static IMAGES: Mutex<Option<HashMap<String, Entry>>> = Mutex::new(None);
static GENERATION: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

thread_local! {
    static PANES: RefCell<HashMap<String, Pane>> = RefCell::default();
}

fn images<R>(f: impl FnOnce(&mut HashMap<String, Entry>) -> R) -> R {
    let mut guard = IMAGES.lock().unwrap_or_else(|e| e.into_inner());
    f(guard.get_or_insert_with(HashMap::new))
}

/// Starts loading `file` under `key`; the returned work (to run off the UI thread) stores the image
/// unless `key` was opened again or released meanwhile, and gives its natural size.
pub fn open(
    key: &str,
    file: MediaFile,
    fetch: Arc<dyn Fetch>,
    svg: SvgRenderer,
) -> impl FnOnce() -> Result<Option<(u32, u32)>, Failure> + Send + 'static {
    let generation = GENERATION.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
    images(|all| {
        let entry = all.entry(key.to_string()).or_default();
        entry.generation = generation;
        entry.zoom = None;
    });
    let key = key.to_string();
    move || {
        let decoded = load(fetch.as_ref(), &file, &svg)?;
        let natural = decoded.natural;
        images(|all| match all.get_mut(&key) {
            Some(entry) if entry.generation == generation => {
                entry.decoded = Some(decoded);
                Ok(natural)
            }
            _ => Err(Failure::Unavailable("closed".into())),
        })
    }
}

/// Shows `key` at `zoom` (a scale, `None`: fitted). Scales are kept between 1 % and 8x.
pub fn set_zoom(key: &str, zoom: Option<f32>) {
    images(|all| {
        if let Some(entry) = all.get_mut(key) {
            entry.zoom = zoom.filter(|z| z.is_finite()).map(|z| z.clamp(0.01, 8.));
        }
    });
}

/// The scale Fit came to in `key`'s last layout (never above 1, as the web's fitted image).
pub fn fit_scale(key: &str) -> Option<f32> {
    let natural = images(|all| all.get(key)?.decoded.as_ref()?.natural)?;
    let bounds = PANES.with(|p| p.borrow().get(key)?.bounds)?;
    let (w, h) = (
        f32::from(bounds.size.width) - 2. * PAD,
        f32::from(bounds.size.height) - 2. * PAD,
    );
    Some(
        (w / natural.0 as f32)
            .min(h / natural.1 as f32)
            .clamp(0., 1.),
    )
}

/// Forgets `key`'s image and frees its tiles in every window.
pub fn release(key: &str, window: Option<&mut Window>, cx: &mut App) {
    let decoded = images(|all| all.remove(key)).and_then(|entry| entry.decoded);
    PANES.with(|p| p.borrow_mut().remove(key));
    if let Some(decoded) = decoded {
        cx.drop_image(decoded.image, window);
    }
}

/// Whether `key` holds a decoded image (for tests and the screen's own checks).
pub fn is_open(key: &str) -> bool {
    images(|all| all.get(key).is_some_and(|e| e.decoded.is_some()))
}

/// The scroll offset of `key`'s pane (negative as it scrolls), for tests.
pub fn scroll_offset(key: &str) -> Option<Point<Pixels>> {
    PANES.with(|p| p.borrow().get(key).map(|pane| pane.scroll.offset()))
}

fn clamp_offset(scroll: &ScrollHandle, offset: Point<Pixels>) -> Point<Pixels> {
    let max = scroll.max_offset();
    Point::new(
        offset.x.clamp(-max.x.max(px(0.)), px(0.)),
        offset.y.clamp(-max.y.max(px(0.)), px(0.)),
    )
}

/// The `Image` element: `key`'s picture in a box that fills its parent, or an empty box while it
/// loads.
pub fn element(key: &str) -> AnyElement {
    let Some((decoded, zoom)) = images(|all| {
        all.get(key)
            .and_then(|e| Some((e.decoded.clone()?, e.zoom)))
    }) else {
        return div().size_full().into_any_element();
    };
    let scroll = PANES.with(|p| p.borrow_mut().entry(key.into()).or_default().scroll.clone());
    let picture = img(decoded.image);
    let (picture, zoomed) = match (zoom, decoded.natural) {
        (Some(zoom), Some((w, h))) => (
            picture
                .object_fit(ObjectFit::Fill)
                .w(px(w as f32 * zoom))
                .h(px(h as f32 * zoom))
                .flex_none(),
            true,
        ),
        _ => (picture.object_fit(ObjectFit::ScaleDown).size_full(), false),
    };
    let (down, moved, laid) = (key.to_string(), key.to_string(), key.to_string());
    let content = div().flex().items_center().justify_center().child(picture);
    // Zoomed, the box is as large as the picture (a flex item that does not shrink) and at least
    // the pane, so the picture is centred when smaller and scrolls edge to edge when larger.
    let content = if zoomed {
        content.flex_none().min_w_full().min_h_full()
    } else {
        content.size_full()
    };
    div()
        .id(gpui::SharedString::from(format!("~media:{key}")))
        .relative()
        .size_full()
        .flex()
        .items_start()
        .p(px(PAD))
        .overflow_scroll()
        .track_scroll(&scroll)
        .when(zoomed, |d| d.cursor(CursorStyle::OpenHand))
        .on_mouse_down(MouseButton::Left, move |event, _, _| {
            if !zoomed {
                return;
            }
            PANES.with(|p| {
                if let Some(pane) = p.borrow_mut().get_mut(&down) {
                    pane.drag = Some((event.position, pane.scroll.offset()));
                }
            });
        })
        .child(
            canvas(
                move |bounds, _, _| {
                    PANES.with(|p| {
                        if let Some(pane) = p.borrow_mut().get_mut(&laid) {
                            pane.bounds = Some(bounds);
                        }
                    })
                },
                // Window-wide, as the web's pointer capture: a drag keeps panning outside the pane.
                move |_, _, window, _| {
                    let up = moved.clone();
                    window.on_mouse_event(move |event: &MouseMoveEvent, phase, window, _| {
                        if phase != DispatchPhase::Bubble {
                            return;
                        }
                        let moved_to = PANES.with(|p| {
                            let panes = p.borrow();
                            let pane = panes.get(&moved)?;
                            let (start, offset) = pane.drag?;
                            let to = clamp_offset(&pane.scroll, offset + (event.position - start));
                            pane.scroll.set_offset(to);
                            Some(())
                        });
                        if moved_to.is_some() {
                            window.refresh();
                        }
                    });
                    window.on_mouse_event(move |_: &MouseUpEvent, _, _, _| {
                        PANES.with(|p| {
                            if let Some(pane) = p.borrow_mut().get_mut(&up) {
                                pane.drag = None;
                            }
                        });
                    });
                },
            )
            .absolute()
            .inset_0(),
        )
        .child(content)
        .into_any_element()
}

/// Where `open` reads bytes from: the window's core, asked when an image opens (none: not connected).
pub type FetchSource = Rc<dyn Fn(&App) -> Option<Arc<dyn Fetch>>>;

/// The `image` engine kind: `data-perch-engine="image"` draws [`element`] for its key.
pub struct ImageEngine;

impl crate::mods::engines::EngineKind for ImageEngine {
    fn draw(&self, key: &str, _: &mut Window, _: &mut App) -> AnyElement {
        element(key)
    }

    fn release(&self, key: &str, cx: &mut App) {
        release(key, None, cx);
    }
}

/// Lends `perch-media` to every mod `host` loads, and places its images as the `image` engine; bytes
/// are read through `source`.
pub fn register(host: &ModHost, source: FetchSource) {
    host.engines().register("image", ImageEngine);
    host.register_module(move |_| module(source.clone()));
}

fn field<'a>(value: Option<&'a HostValue>, key: &str) -> Option<&'a HostValue> {
    value?.get(key)
}

fn module(source: FetchSource) -> HostModule {
    HostModule::new("perch-media")
        .declarations(DECLARATIONS)
        .component("Image", |args, _, _| element(args.id()))
        .async_function("open", move |args| {
            let key = args.string(0)?.to_string();
            let file = args.get(1);
            let text = |name: &str| {
                field(file, name)
                    .and_then(HostValue::as_str)
                    .map(str::to_string)
                    .ok_or_else(|| HostError::new(format!("open: file.{name} is required")))
            };
            let file = MediaFile {
                workspace_id: text("workspaceId")?,
                path: text("path")?,
                media_type: text("mediaType")?,
                size: field(file, "size")
                    .and_then(HostValue::as_number)
                    .unwrap_or(0.) as u64,
            };
            let (svg, fetch) = gpui_shell::with_current_app(|cx| (cx.svg_renderer(), source(cx)))
                .ok_or_else(|| HostError::new("open: no app"))?;
            let fetch =
                fetch.ok_or_else(|| HostError::new("Perch is not connected to its core"))?;
            let work = open(&key, file, fetch, svg);
            Ok(async move {
                match work() {
                    Ok(Some((w, h))) => Ok(HostValue::Object(vec![
                        ("width".into(), HostValue::Number(w as f64)),
                        ("height".into(), HostValue::Number(h as f64)),
                    ])),
                    Ok(None) => Ok(HostValue::Null),
                    Err(failure) => Err(HostError::new(failure.message())),
                }
            })
        })
        .function("setZoom", |args| {
            let zoom = args.get(1).and_then(HostValue::as_number).map(|z| z as f32);
            set_zoom(args.string(0)?, zoom);
            Ok(HostValue::Null)
        })
        .function("fitScale", |args| {
            Ok(fit_scale(args.string(0)?).map_or(HostValue::Null, |s| HostValue::Number(s as f64)))
        })
        .function("release", |args| {
            let key = args.string(0)?.to_string();
            let done = gpui_shell::with_current(|window, cx| release(&key, Some(window), cx))
                .or_else(|| gpui_shell::with_current_app(|cx| release(&key, None, cx)));
            if done.is_none() {
                release_detached(&key);
            }
            Ok(HostValue::Null)
        })
        .function("quickLook", |args| open_outside(args.string(0)?, true))
        .function("openDefault", |args| open_outside(args.string(0)?, false))
}

/// Forgets `key` without a context to free tiles in (they go with the window).
fn release_detached(key: &str) {
    images(|all| all.remove(key));
    PANES.with(|p| p.borrow_mut().remove(key));
}

fn open_outside(path: &str, quick_look: bool) -> Result<HostValue, HostError> {
    let path = checked_path(path).map_err(|why| HostError::new(format!("{path}: {why}")))?;
    let run = |window: Option<&mut Window>, cx: &mut App| {
        let opener = cx
            .try_global::<Opener>()
            .cloned()
            .unwrap_or_else(|| Opener(Rc::new(SystemOpener)));
        if quick_look {
            opener.0.quick_look(&path, window, cx);
        } else {
            opener.0.open_default(&path, cx);
        }
    };
    gpui_shell::with_current(|window, cx| run(Some(window), cx))
        .or_else(|| gpui_shell::with_current_app(|cx| run(None, cx)))
        .ok_or_else(|| HostError::new("no app to open the file with"))?;
    Ok(HostValue::Null)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checked_path_refuses_relative_missing_and_dash_paths() {
        let file = std::env::temp_dir().join(format!("perch-media-check-{}", std::process::id()));
        std::fs::write(&file, b"x").unwrap();
        assert_eq!(checked_path(file.to_str().unwrap()), Ok(file.clone()));
        assert!(checked_path("relative/a.pdf").is_err());
        assert!(checked_path("-n").is_err());
        assert!(checked_path("/no/such/file.pdf").is_err());
        assert!(
            checked_path(std::env::temp_dir().to_str().unwrap()).is_err(),
            "a folder"
        );
        std::fs::remove_file(file).unwrap();
    }

    #[test]
    fn format_for_covers_the_core_image_types() {
        for (mime, format) in [
            ("image/png", ImageFormat::Png),
            ("image/jpeg", ImageFormat::Jpeg),
            ("image/gif", ImageFormat::Gif),
            ("image/webp", ImageFormat::Webp),
            ("image/svg+xml", ImageFormat::Svg),
            ("image/bmp", ImageFormat::Bmp),
            ("image/x-icon", ImageFormat::Ico),
        ] {
            assert_eq!(format_for(mime), Some(format), "{mime}");
        }
        assert_eq!(format_for("image/avif"), None, "GPUI has no AVIF decoder");
        assert_eq!(format_for("application/pdf"), None);
    }

    #[test]
    fn svg_size_needs_both_attributes() {
        assert!(svg_has_size(
            br#"<?xml?><svg xmlns="x" width="10" height="20"><g/></svg>"#
        ));
        assert!(!svg_has_size(
            br#"<svg viewBox="0 0 10 20" width="10"></svg>"#
        ));
        assert!(!svg_has_size(
            br#"<svg viewBox="0 0 10 20"><rect width="1" height="1"/></svg>"#
        ));
    }

    struct Bytes(Vec<u8>, std::sync::atomic::AtomicUsize);
    impl Fetch for Bytes {
        fn fetch(&self, _: &str, _: &str, _: u64) -> anyhow::Result<Vec<u8>> {
            self.1.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            Ok(self.0.clone())
        }
    }

    fn file(media_type: &str, size: u64) -> MediaFile {
        MediaFile {
            workspace_id: "w".into(),
            path: "a".into(),
            media_type: media_type.into(),
            size,
        }
    }

    #[test]
    fn too_large_or_undecodable_types_are_not_fetched() {
        let svg = SvgRenderer::new(Arc::new(()));
        let fetch = Bytes(vec![], Default::default());
        assert_eq!(
            load(&fetch, &file("image/png", MAX_IMAGE_BYTES + 1), &svg).err(),
            Some(Failure::TooLarge)
        );
        assert!(load(&fetch, &file("image/avif", 10), &svg).is_err());
        assert_eq!(fetch.1.load(std::sync::atomic::Ordering::Relaxed), 0);
    }

    fn png(w: u32, h: u32) -> Vec<u8> {
        let mut out = std::io::Cursor::new(Vec::new());
        image::RgbaImage::from_pixel(w, h, image::Rgba([255, 0, 0, 255]))
            .write_to(&mut out, image::ImageFormat::Png)
            .unwrap();
        out.into_inner()
    }

    #[test]
    fn decode_reads_the_natural_size_and_refuses_huge_sides_and_garbage() {
        let svg = SvgRenderer::new(Arc::new(()));
        let decoded = decode(png(64, 48), ImageFormat::Png, &svg).unwrap();
        assert_eq!(decoded.natural, Some((64, 48)));
        assert_eq!(
            decode(png(MAX_SIDE + 1, 1), ImageFormat::Png, &svg).err(),
            Some(Failure::TooLarge)
        );
        assert!(matches!(
            decode(b"\x89PNG\r\n\x1a\nbroken".to_vec(), ImageFormat::Png, &svg),
            Err(Failure::Unavailable(_))
        ));
        let sized = br#"<svg xmlns="http://www.w3.org/2000/svg" width="30" height="10"><rect width="30" height="10"/></svg>"#;
        assert_eq!(
            decode(sized.to_vec(), ImageFormat::Svg, &svg)
                .unwrap()
                .natural,
            Some((30, 10))
        );
        let unsized_ = br#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 10"><rect width="30" height="10"/></svg>"#;
        assert_eq!(
            decode(unsized_.to_vec(), ImageFormat::Svg, &svg)
                .unwrap()
                .natural,
            None
        );
    }

    #[test]
    fn a_reopened_key_drops_the_stale_result() {
        let svg = SvgRenderer::new(Arc::new(()));
        let fetch: Arc<dyn Fetch> = Arc::new(Bytes(png(8, 8), Default::default()));
        let first = open("stale", file("image/png", 10), fetch.clone(), svg.clone());
        let second = open("stale", file("image/png", 10), fetch, svg);
        assert!(first().is_err(), "the first result is stale");
        assert_eq!(second(), Ok(Some((8, 8))));
        assert!(is_open("stale"));
        release_detached("stale");
        assert!(!is_open("stale"));
    }
}

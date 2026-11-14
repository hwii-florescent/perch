//! The `perch-react` module: what a mod running React screens (the stock `sidebar` and any screen on `mods/react-runtime/`) needs from Rust and cannot
//! do in JavaScript. A React screen draws its icons as SVG markup, while gpui-kit's `svg()` and `image()` read a file
//! through the app's asset source, which this window does not give mods. `Icon.new(id, { markup, color })` draws
//! the markup itself, `currentColor` taken as `color` (`#rrggbb` or `#rrggbbaa`), filling its box, rasterised
//! when the frame asks for it. `textWidth(text, font)` is the exact width of a line of text, which the runtime lays
//! rows out with: GPUI rounds a text element's width up to a whole pixel and every authored length to a device
//! pixel, so a row of words (a strip of chips) would drift from the page's, which lays text at its exact width.
//! `bounds(key)` is where an element the runtime marked `.measure(key)` was last laid out (`{x, y, width, height}`,
//! logical pixels from the window's top left, or null before its first layout), for `getBoundingClientRect` and the
//! DOM's measurement properties; `forgetBounds(prefix)` lets a tree's keys go when it unmounts. Both see only the
//! calling mod copy's boxes (`gpui_shell::measure`).
//! Everything else the runtime needs (timers, jobs, storage) the engine already gives.

use super::ModHost;
use gpui::{
    prelude::*, px, AnyElement, App, Font, FontStyle, FontWeight, Hsla, RenderImage, TextRun,
    WindowTextSystem,
};
use gpui_shell::{HostArguments, HostModule, HostResult, HostValue};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

/// The module's TypeScript face.
const DECLARATIONS: &str = "export const Icon: { new(id: string, props: { markup: string; color?: string }): any };
export function textWidth(text: string, font: { size: number; weight?: number; family?: string; italic?: boolean }): number;
export function bounds(key: string): { x: number; y: number; width: number; height: number } | null;
export function forgetBounds(prefix: string): void;";

/// The largest icon markup drawn.
const MAX_MARKUP: usize = 256 * 1024;

/// Icons kept decoded, by markup and colour; cleared whole when it grows past this.
const CACHE: usize = 512;

/// The longest side, in device pixels, an icon is rasterised at (GPUI's own cap is 8192, 256 MB
/// a frame); one drawn larger is scaled up from this.
const MAX_SIDE: f32 = 256.;

/// Text measured before the shaper's cache is started afresh (it keeps every line it laid out).
const MEASURED: usize = 4096;

thread_local! {
    static ICONS: RefCell<HashMap<(String, String, u32), Arc<RenderImage>>> = RefCell::default();
    /// The markup (and colour) already reported as not drawable, so a frame does not repeat it.
    static REPORTED: RefCell<HashSet<u64>> = RefCell::default();
    /// The app's text system, for `textWidth`, with how many lines it has measured.
    static TEXT: RefCell<Option<(Arc<gpui::TextSystem>, WindowTextSystem, usize)>> = const { RefCell::new(None) };
}

/// Gives `textWidth` the app's fonts. Call once per app (`mods::init`).
pub fn init(cx: &App) {
    let system = cx.text_system().clone();
    TEXT.with(|text| *text.borrow_mut() = Some((system.clone(), WindowTextSystem::new(system), 0)));
}

/// Lends `perch-react` to every mod `host` loads.
pub fn register(host: &ModHost) {
    host.register_module(|_| module());
}

fn module() -> HostModule {
    HostModule::new("perch-react")
        .declarations(DECLARATIONS)
        .component("Icon", |args, window, cx| {
            icon(args.props(), window.scale_factor(), cx)
        })
        .function("textWidth", text_width)
        .function("bounds", |args| {
            let key = args.string(0)?;
            Ok(
                gpui_shell::measure::bounds(key).map_or(HostValue::Null, |b| {
                    let field = |v: gpui::Pixels| HostValue::Number(f64::from(f32::from(v)));
                    HostValue::Object(vec![
                        ("x".into(), field(b.origin.x)),
                        ("y".into(), field(b.origin.y)),
                        ("width".into(), field(b.size.width)),
                        ("height".into(), field(b.size.height)),
                    ])
                }),
            )
        })
        .function("forgetBounds", |args| {
            gpui_shell::measure::forget(args.string(0)?);
            Ok(HostValue::Null)
        })
}

/// The icon `props` names, or an empty box when the markup is not one. Rasterised here, at the window's scale, so
/// it is drawn in the frame that asks for it (an image GPUI loads itself appears a frame later).
fn icon(props: &HostValue, scale: f32, cx: &App) -> AnyElement {
    let text = |key: &str| props.get(key).and_then(HostValue::as_str).unwrap_or("");
    match image(text("markup"), text("color"), scale, cx) {
        Ok(image) => gpui::img(image).size_full().into_any_element(),
        Err(error) => {
            if first_report(text("markup"), text("color")) {
                eprintln!("perch-native: perch-react Icon: {error}");
            }
            gpui::div().size_full().into_any_element()
        }
    }
}

/// `textWidth(text, font)`: the width in logical pixels of `text` on one line in `font` (`size`, `weight`, `family`,
/// `italic`), as GPUI shapes it, not rounded.
fn text_width(args: &HostArguments) -> HostResult {
    let words = args
        .get(0)
        .and_then(HostValue::as_str)
        .unwrap_or("")
        .replace('\n', " ");
    let font = args.get(1);
    let field = |key: &str| font.and_then(|f| f.get(key));
    let number = |key: &str| field(key).and_then(HostValue::as_number);
    let size = number("size").filter(|s| *s > 0.).unwrap_or(14.) as f32;
    let run = TextRun {
        len: words.len(),
        font: Font {
            family: field("family")
                .and_then(HostValue::as_str)
                .unwrap_or(".SystemUIFont")
                .to_string()
                .into(),
            weight: FontWeight(number("weight").unwrap_or(400.) as f32),
            style: if field("italic").and_then(HostValue::as_bool) == Some(true) {
                FontStyle::Italic
            } else {
                FontStyle::Normal
            },
            ..Font::default()
        },
        color: Hsla::default(),
        background_color: None,
        underline: None,
        strikethrough: None,
    };
    let width = TEXT.with(|text| {
        let mut text = text.borrow_mut();
        let (system, shaper, count) = text
            .as_mut()
            .ok_or("textWidth: the app's text system is not set (mods::init)")?;
        *count += 1;
        if *count > MEASURED {
            *shaper = WindowTextSystem::new(system.clone());
            *count = 1;
        }
        Ok::<_, String>(f32::from(
            shaper.layout_line(&words, px(size), &[run], None).width,
        ))
    })?;
    Ok(HostValue::Number(f64::from(width)))
}

/// The markup rasterised, `currentColor` drawn in `color`.
fn image(markup: &str, color: &str, scale: f32, cx: &App) -> Result<Arc<RenderImage>, String> {
    let bytes = paint(markup, color)?;
    let key = (markup.to_string(), color.to_string(), scale.to_bits());
    if let Some(image) = ICONS.with(|icons| icons.borrow().get(&key).cloned()) {
        return Ok(image);
    }
    let image = cx
        .svg_renderer()
        .render_single_frame(bytes.as_bytes(), raster_scale(bytes.as_bytes(), scale)?)
        .map_err(|e| format!("the markup is not an SVG GPUI can draw: {e}"))?;
    ICONS.with(|icons| {
        let mut icons = icons.borrow_mut();
        if icons.len() >= CACHE {
            icons.clear();
        }
        icons.insert(key, image.clone());
    });
    Ok(image)
}

/// The scale to rasterise `svg` at for a window at `scale`: that, unless the SVG's own size would
/// make a side longer than [`MAX_SIDE`].
fn raster_scale(svg: &[u8], scale: f32) -> Result<f32, String> {
    let tree = usvg::Tree::from_data(svg, &usvg::Options::default())
        .map_err(|e| format!("the markup is not an SVG GPUI can draw: {e}"))?;
    let size = tree.size();
    let side = size.width().max(size.height()) * scale * gpui::SMOOTH_SVG_SCALE_FACTOR;
    Ok(if side > MAX_SIDE {
        scale * MAX_SIDE / side
    } else {
        scale
    })
}

/// True the first time `markup` in `color` fails to draw.
fn first_report(markup: &str, color: &str) -> bool {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    (markup, color).hash(&mut hasher);
    REPORTED.with(|reported| {
        let mut reported = reported.borrow_mut();
        if reported.len() >= CACHE {
            reported.clear();
        }
        reported.insert(hasher.finish())
    })
}

/// The markup to draw: checked, `currentColor` replaced by `color`.
fn paint(markup: &str, color: &str) -> Result<String, String> {
    if markup.len() > MAX_MARKUP {
        return Err(format!(
            "markup is {} bytes, over {MAX_MARKUP}",
            markup.len()
        ));
    }
    if !markup.trim_start().starts_with("<svg") {
        return Err("markup must be an <svg> element".into());
    }
    Ok(markup.replace("currentColor", &css_color(color)?))
}

/// `#rrggbb` / `#rrggbbaa` as an SVG paint (`rgba(...)`); black when none is given, as SVG's default.
fn css_color(color: &str) -> Result<String, String> {
    if color.is_empty() {
        return Ok("rgba(0,0,0,1)".into());
    }
    let hex = color
        .strip_prefix('#')
        .filter(|h| (h.len() == 6 || h.len() == 8) && h.chars().all(|c| c.is_ascii_hexdigit()))
        .ok_or_else(|| format!("colour {color:?} is not #rrggbb or #rrggbbaa"))?;
    let byte = |at: usize| u8::from_str_radix(&hex[at..at + 2], 16).unwrap_or(255);
    let alpha = if hex.len() == 8 { byte(6) } else { 255 };
    Ok(format!(
        "rgba({},{},{},{:.3})",
        byte(0),
        byte(2),
        byte(4),
        f32::from(alpha) / 255.
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn markup_takes_its_colour_and_is_refused_when_not_an_svg() {
        let markup = r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path stroke="currentColor"/></svg>"#;
        let painted = paint(markup, "#c8c8c826").unwrap();
        assert!(
            painted.contains(r#"stroke="rgba(200,200,200,0.149)""#),
            "{painted}"
        );
        assert!(paint("<script/>", "").is_err());
        assert!(paint(markup, "red").is_err());
        assert!(paint(&format!("<svg>{}</svg>", " ".repeat(MAX_MARKUP)), "").is_err());
        module().validate().expect("declarations and exports agree");
    }

    #[test]
    fn a_huge_svg_is_rasterised_no_larger_than_an_icon_needs() {
        let svg = |w: u32, h: u32| {
            format!(
                r#"<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}"><rect width="1" height="1"/></svg>"#
            )
        };
        let sixteen = raster_scale(svg(16, 16).as_bytes(), 2.).unwrap();
        assert_eq!(sixteen, 2., "a small icon keeps the window's scale");
        for (w, h) in [(100_000, 100_000), (1, 100_000), (100_000, 1)] {
            let scale = raster_scale(svg(w, h).as_bytes(), 2.).unwrap();
            let side = w.max(h) as f32 * scale * gpui::SMOOTH_SVG_SCALE_FACTOR;
            assert!(side <= MAX_SIDE + 0.5, "{w}x{h} drawn {side} px a side");
        }
        assert!(raster_scale(b"<svg", 2.).is_err());
    }

    #[test]
    fn a_markup_that_cannot_be_drawn_is_reported_once() {
        assert!(first_report("<svg broken", "#ffffff"));
        assert!(!first_report("<svg broken", "#ffffff"));
        assert!(
            first_report("<svg broken", "#000000"),
            "another colour is another icon"
        );
    }
}

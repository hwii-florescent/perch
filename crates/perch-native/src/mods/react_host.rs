//! The `perch-react` module: what a mod running React screens (the stock `sidebar-react`) needs from Rust and cannot
//! do in JavaScript. A React screen draws its icons as SVG markup, while gpui-kit's `svg()` and `image()` read a file
//! through the app's asset source, which this window does not give mods. `Icon.new(id, { markup, color })` draws
//! the markup itself, `currentColor` taken as `color` (`#rrggbb` or `#rrggbbaa`), filling its box, rasterised
//! when the frame asks for it. Everything else
//! the runtime needs (timers, jobs, boxes, storage) the engine already gives.

use super::ModHost;
use gpui::{prelude::*, AnyElement, App, RenderImage};
use gpui_shell::{HostModule, HostValue};
use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::Arc;

/// The module's TypeScript face.
const DECLARATIONS: &str =
    "export const Icon: { new(id: string, props: { markup: string; color?: string }): any };";

/// The largest icon markup drawn.
const MAX_MARKUP: usize = 256 * 1024;

/// Icons kept decoded, by markup and colour; cleared whole when it grows past this.
const CACHE: usize = 512;

thread_local! {
    static ICONS: RefCell<HashMap<(String, String, u32), Arc<RenderImage>>> = RefCell::default();
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
}

/// The icon `props` names, or an empty box when the markup is not one. Rasterised here, at the window's scale, so
/// it is drawn in the frame that asks for it (an image GPUI loads itself appears a frame later).
fn icon(props: &HostValue, scale: f32, cx: &App) -> AnyElement {
    let text = |key: &str| props.get(key).and_then(HostValue::as_str).unwrap_or("");
    match image(text("markup"), text("color"), scale, cx) {
        Ok(image) => gpui::img(image).size_full().into_any_element(),
        Err(error) => {
            eprintln!("perch-native: perch-react Icon: {error}");
            gpui::div().size_full().into_any_element()
        }
    }
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
        .render_single_frame(bytes.as_bytes(), scale)
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
}

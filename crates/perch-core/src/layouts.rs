//! Layouts, as in herdr's desktop app: `<root>/layouts/<id>.json` is a whole window as a tree of
//! rows, columns and blocks, and a block is one of Perch's own panes (`sidebar`, `tabs`, `canvas`,
//! `files`, `git`, `status`) or a mod (`mod:<id>`). Stock Perch is the default; one layout can be
//! chosen (`layout-state.json` beside `layouts/`), and mods being off, or a layout that stops
//! parsing, falls back to stock. The core only checks the shape (depth, size, known content); the
//! page draws it. A node has `size`, `hidden`, `gap` and `padding`, and the cascading [`Look`]
//! (`theme`, `colors`, `font`, `radius`, `border`).
//! ponytail: no pane frames; terminals keep the server's font and colors (a layout sets only their
//! padding and opacity).
use crate::mods::{plain_id, Error, Policy};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::Path;

const MAX_DEPTH: usize = 8;
const MAX_NODES: usize = 64;
const MAX_BYTES: u64 = 256 * 1024;
const BUILTIN: [&str; 6] = ["sidebar", "tabs", "canvas", "files", "git", "status"];
/// The palette tokens of `themes.ts` (`Palette`) a layout may override, and the window `backdrop`.
const COLORS: [&str; 17] = [
    "accent",
    "panelBg",
    "surface0",
    "surface1",
    "surfaceDim",
    "overlay0",
    "overlay1",
    "text",
    "subtext0",
    "mauve",
    "green",
    "yellow",
    "red",
    "blue",
    "teal",
    "peach",
    "backdrop",
];

/// `{"px": 240}` (fixed) or `{"weight": 2}` (a share of what fixed siblings leave; the default is 1).
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Size {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub px: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight: Option<f32>,
    /// Along the parent's direction, px: the node never gets smaller or larger than these.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max: Option<u32>,
}

/// A theme name, or one for each system appearance: `{"light": "paper", "dark": "nord"}`.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ThemeRef {
    Name(String),
    Pair { light: String, dark: String },
}

/// What any node may carry besides its look: a name for commands and stack tabs, dragging the window
/// by it, and (on the root) hiding the system title bar and a picture for Settings.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Chrome {
    /// Names the node for commands (`layout.toggle`, `layout.stack`) and, in a stack, its tab.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    /// Dragging this node moves the desktop window; a double-click maximizes it.
    #[serde(rename = "windowDrag", skip_serializing_if = "std::ops::Not::not")]
    pub window_drag: bool,
    /// Root only: `"none"` hides the system title bar so the layout draws its own.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub titlebar: Option<String>,
    /// Root only: where macOS draws the window buttons, px from the window's top-left `[x, y]`.
    #[serde(rename = "trafficLights", skip_serializing_if = "Option::is_none")]
    pub traffic_lights: Option<[u32; 2]>,
    /// Root only: a `.svg` or `.png` beside the layout file that Settings shows for it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>,
}

/// A line between a row's or column's children.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Divider {
    pub width: u32,
    /// `#rrggbb`; the theme's border color when unset.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

/// How a node looks, as in herdr's cascading look properties: set on any node, and the nearest one up
/// the tree wins. On the root it restyles the whole app; on a deeper node, that subtree.
/// `theme` is a name from `themes.ts` (an unknown one shows as the default theme), `colors`
/// overrides single palette tokens (`COLORS`) with `#rrggbb`, `font` is a CSS font-family for the
/// interface, `radius` rounds the cards and `border` outlines them (px).
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Look {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<ThemeRef>,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub colors: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub radius: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub border: Option<u32>,
    /// Behind the node: a CSS color or gradient (no `url(`), `{"gradient": [colors], "angle"}` or
    /// `{"image": "backgrounds/sky.jpg", "fit": "cover"|"contain"}` (a picture in the core's folder). The
    /// page only ever gets the CSS text: [`resolve_backgrounds`] turns the other two into it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background: Option<Background>,
    /// `sm`, `md` or `lg`: a shadow under the cards.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shadow: Option<String>,
    /// Space around every terminal under this node, px.
    #[serde(rename = "terminalPadding", skip_serializing_if = "Option::is_none")]
    pub terminal_padding: Option<u32>,
    /// 0.1..1: below 1 a terminal fades into whatever is behind it (text included).
    #[serde(rename = "terminalOpacity", skip_serializing_if = "Option::is_none")]
    pub terminal_opacity: Option<f32>,
    /// Pane frames in the canvas: corner radius, outline width (px) and the focused pane's outline color.
    #[serde(rename = "paneRadius", skip_serializing_if = "Option::is_none")]
    pub pane_radius: Option<u32>,
    #[serde(rename = "paneBorder", skip_serializing_if = "Option::is_none")]
    pub pane_border: Option<u32>,
    #[serde(rename = "paneFocus", skip_serializing_if = "Option::is_none")]
    pub pane_focus: Option<String>,
    /// Space between the canvas's panes (px, at most 48), and whether a tab's only pane is framed too.
    #[serde(rename = "paneGap", skip_serializing_if = "Option::is_none")]
    pub pane_gap: Option<u32>,
    #[serde(rename = "paneLone", skip_serializing_if = "Option::is_none")]
    pub pane_lone: Option<bool>,
    /// A pane's own background (a color or gradient, same rules as `background`).
    #[serde(rename = "paneBackground", skip_serializing_if = "Option::is_none")]
    pub pane_background: Option<String>,
    /// The pane header: `top` (default) or `bottom`; `always` (default) or `hover` (drawn over the
    /// terminal on pointer-over, so the terminal never resizes); and its height in px (16 to 64).
    #[serde(rename = "paneHeaderAt", skip_serializing_if = "Option::is_none")]
    pub pane_header_at: Option<String>,
    #[serde(rename = "paneHeaderReveal", skip_serializing_if = "Option::is_none")]
    pub pane_header_reveal: Option<String>,
    #[serde(rename = "paneHeaderHeight", skip_serializing_if = "Option::is_none")]
    pub pane_header_height: Option<u32>,
    /// `false` takes away the grip that drags a pane to another place in a split (default true).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub movable: Option<bool>,
}

/// What a layout file may say for `background`.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Background {
    Css(String),
    Gradient {
        gradient: Vec<String>,
        #[serde(default)]
        angle: Option<i32>,
    },
    Image {
        image: String,
        #[serde(default)]
        fit: Option<String>,
    },
}

/// A node taken out of the flow and drawn over the window at this place and size (px).
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Float {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    /// Docks to a window edge (`top`, `right`, `bottom`, `left`) 12 px in, along it at `align`
    /// (`start`, `center`, `end`), instead of sitting at `x`, `y`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edge: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub align: Option<String>,
    /// A drawer: on a left or right edge only this many px show until it is hovered.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub peek: Option<u32>,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Group {
    #[serde(flatten)]
    pub look: Look,
    #[serde(flatten)]
    pub chrome: Chrome,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub divider: Option<Divider>,
    /// Drag the boundary between children (default true); the sizes are kept on this device.
    #[serde(default = "yes", skip_serializing_if = "is_true")]
    pub resizable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub float: Option<Float>,
    pub size: Option<Size>,
    pub hidden: bool,
    pub gap: u32,
    pub padding: u32,
    pub children: Vec<Node>,
}

fn yes() -> bool {
    true
}
fn is_true(value: &bool) -> bool {
    *value
}

/// One child shows at a time: `active` (a child's `id`, else the first), with a `header` that
/// switches: `"tabs"` for a plain strip, or `mod:<id>` for a mod that draws it (it reads the shared
/// `layout.stack.<id>` and runs the `layout.stack` command).
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Stack {
    #[serde(flatten)]
    pub look: Look,
    #[serde(flatten)]
    pub chrome: Chrome,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub float: Option<Float>,
    pub size: Option<Size>,
    pub hidden: bool,
    pub padding: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub header: Option<String>,
    pub children: Vec<Node>,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Block {
    #[serde(flatten)]
    pub look: Look,
    #[serde(flatten)]
    pub chrome: Chrome,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub float: Option<Float>,
    pub size: Option<Size>,
    pub hidden: bool,
    pub padding: u32,
    pub content: String,
    /// For a `mod:<id>` block: a JSON object the mod reads with `api.props()` (at most 4 KiB).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub props: Option<serde_json::Value>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Node {
    Row(Group),
    Column(Group),
    Block(Block),
    Stack(Stack),
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LayoutInfo {
    pub id: String,
    pub name: String,
    pub root: Option<Node>,
    /// The root's `preview` picture as a data URI, if it has one and it reads.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>,
    /// Why the file cannot be used, if it cannot.
    pub error: Option<String>,
}

fn size_ok(size: &Option<Size>) -> bool {
    size.as_ref().is_none_or(|s| {
        s.px.is_none_or(|px| px <= 4000)
            && s.weight.is_none_or(|w| w > 0.0 && w <= 100.0)
            && s.min.is_none_or(|n| n <= 4000)
            && s.max.is_none_or(|n| n <= 4000)
    })
}

fn look_ok(look: &Look) -> Result<(), String> {
    let hex = |text: &str| {
        text.len() == 7 && text.starts_with('#') && text[1..].chars().all(|c| c.is_ascii_hexdigit())
    };
    if let Some((name, value)) = look
        .colors
        .iter()
        .find(|(name, value)| !COLORS.contains(&name.as_str()) || !hex(value))
    {
        return Err(format!(
            "color \"{name}\": \"{value}\" must be #rrggbb and the name one of {}",
            COLORS.join(", ")
        ));
    }
    let text_ok = |text: &Option<String>| {
        text.as_ref()
            .is_none_or(|t| t.len() <= 120 && !t.chars().any(char::is_control))
    };
    let theme = match &look.theme {
        None => None,
        Some(ThemeRef::Name(name)) => Some(vec![name.clone()]),
        Some(ThemeRef::Pair { light, dark }) => Some(vec![light.clone(), dark.clone()]),
    };
    if theme.iter().flatten().any(|t| !text_ok(&Some(t.clone()))) || !text_ok(&look.font) {
        return Err("theme and font must be short plain text".into());
    }
    match &look.background {
        None => {}
        Some(Background::Css(background)) => {
            if !css_background_ok(background) {
                return Err("background is a color or a gradient (no url())".into());
            }
        }
        Some(Background::Gradient { gradient, angle }) => {
            if !(2..=8).contains(&gradient.len())
                || !gradient.iter().all(|c| hex_color(c))
                || angle.is_some_and(|a| !(-360..=360).contains(&a))
            {
                return Err(
                    "a gradient background has 2 to 8 #rrggbb colors and an angle of -360 to 360"
                        .into(),
                );
            }
        }
        Some(Background::Image { image, fit })
            if !image_path_ok(image)
                || fit
                    .as_deref()
                    .is_some_and(|f| f != "cover" && f != "contain") =>
        {
            return Err("an image background is a plain picture path in the core's folder (png, jpg, webp, gif or svg), fit cover or contain".into());
        }
        Some(Background::Image { .. }) => {}
    }
    if look.radius.is_some_and(|r| r > 48) || look.border.is_some_and(|b| b > 8) {
        return Err("radius is at most 48 and border at most 8".into());
    }
    if look
        .shadow
        .as_deref()
        .is_some_and(|s| !matches!(s, "sm" | "md" | "lg"))
    {
        return Err("shadow is sm, md or lg".into());
    }
    if look.pane_radius.is_some_and(|r| r > 48)
        || look.pane_border.is_some_and(|b| b > 8)
        || look.pane_focus.as_deref().is_some_and(|c| !hex(c))
        || look.pane_gap.is_some_and(|g| g > 48)
        || look
            .pane_header_at
            .as_deref()
            .is_some_and(|a| a != "top" && a != "bottom")
        || look
            .pane_header_reveal
            .as_deref()
            .is_some_and(|r| r != "always" && r != "hover")
        || look
            .pane_header_height
            .is_some_and(|h| !(16..=64).contains(&h))
        || look
            .pane_background
            .as_deref()
            .is_some_and(|b| !css_background_ok(b))
    {
        return Err(
            "paneRadius and paneGap are at most 48, paneBorder at most 8 and paneFocus #rrggbb"
                .into(),
        );
    }
    if look.terminal_padding.is_some_and(|p| p > 64)
        || look
            .terminal_opacity
            .is_some_and(|o| !(0.1..=1.0).contains(&o))
    {
        return Err("terminalPadding is at most 64 and terminalOpacity 0.1 to 1".into());
    }
    Ok(())
}

/// The ids, and whether this is the root, for the checks that look across the tree.
struct Walk {
    count: usize,
    ids: std::collections::HashSet<String>,
}

fn check(node: &Node, depth: usize, walk: &mut Walk) -> Result<(), String> {
    walk.count += 1;
    if depth > MAX_DEPTH || walk.count > MAX_NODES {
        return Err(format!(
            "too big: at most {MAX_DEPTH} levels and {MAX_NODES} nodes"
        ));
    }
    let (look, chrome, float) = match node {
        Node::Row(g) | Node::Column(g) => (&g.look, &g.chrome, &g.float),
        Node::Block(b) => (&b.look, &b.chrome, &b.float),
        Node::Stack(s) => (&s.look, &s.chrome, &s.float),
    };
    look_ok(look)?;
    if let Some(id) = &chrome.id {
        if !plain_id(id) || !walk.ids.insert(id.clone()) {
            return Err(format!("node id \"{id}\" must be a plain id, used once"));
        }
    }
    if chrome
        .title
        .as_ref()
        .is_some_and(|t| t.len() > 60 || t.chars().any(char::is_control))
        || chrome.titlebar.as_deref().is_some_and(|t| t != "none")
        || chrome
            .traffic_lights
            .is_some_and(|[x, y]| x > 400 || y > 200)
        || chrome
            .preview
            .as_deref()
            .is_some_and(|p| !preview_name_ok(p))
    {
        return Err("title is short plain text, titlebar is \"none\", preview is a plain .svg or .png file name".into());
    }
    if float.as_ref().is_some_and(|f| {
        f.x.max(f.y) > 10_000
            || !(1..=10_000).contains(&f.width)
            || !(1..=10_000).contains(&f.height)
    }) {
        return Err("float needs x, y, width and height within 10000 px".into());
    }
    if let Some(f) = float {
        let side = f.edge.as_deref();
        if side.is_some_and(|e| !matches!(e, "top" | "right" | "bottom" | "left"))
            || f.align
                .as_deref()
                .is_some_and(|a| !matches!(a, "start" | "center" | "end"))
            || (f.align.is_some() && side.is_none())
            || f.peek
                .is_some_and(|p| !matches!(side, Some("left" | "right")) || p >= f.width)
        {
            return Err(
                "float edge is top, right, bottom or left; align start, center or end; peek needs a left or right edge and less than the width".into(),
            );
        }
    }
    match node {
        Node::Row(g) | Node::Column(g) => {
            let divider_ok = g
                .divider
                .as_ref()
                .is_none_or(|d| d.width <= 16 && d.color.as_deref().is_none_or(hex_color));
            if g.children.is_empty()
                || g.gap > 200
                || g.padding > 200
                || !size_ok(&g.size)
                || !divider_ok
            {
                return Err("a row or column needs children and sane gap, padding, size and divider (at most 16, #rrggbb)".into());
            }
            g.children
                .iter()
                .try_for_each(|c| check(c, depth + 1, walk))
        }
        Node::Stack(s) => {
            let header_ok = s
                .header
                .as_deref()
                .is_none_or(|h| h == "tabs" || h.strip_prefix("mod:").is_some_and(plain_id));
            let active_ok = s.active.as_ref().is_none_or(|a| {
                s.children
                    .iter()
                    .any(|c| node_id(c).is_some_and(|id| id == a))
            });
            if s.children.is_empty()
                || s.padding > 200
                || !size_ok(&s.size)
                || !header_ok
                || !active_ok
            {
                return Err("a stack needs children, a header of \"tabs\" or mod:<id>, and an active that is a child's id".into());
            }
            s.children
                .iter()
                .try_for_each(|c| check(c, depth + 1, walk))
        }
        Node::Block(b) => {
            let known = BUILTIN.contains(&b.content.as_str())
                || b.content.strip_prefix("mod:").is_some_and(plain_id)
                || b.content.strip_prefix("terminal:").is_some_and(plain_id)
                || b.content == "agent:focused";
            if !known || b.padding > 200 || !size_ok(&b.size) {
                return Err(format!(
                    "block content \"{}\" must be one of {}, mod:<id>, terminal:<session id> or agent:focused",
                    b.content,
                    BUILTIN.join(", ")
                ));
            }
            if let Some(props) = &b.props {
                if !props.is_object() || props.to_string().len() > 4096 {
                    return Err("block props are a JSON object of at most 4 KiB".into());
                }
            }
            Ok(())
        }
    }
}

fn node_id(node: &Node) -> Option<&String> {
    match node {
        Node::Row(g) | Node::Column(g) => g.chrome.id.as_ref(),
        Node::Block(b) => b.chrome.id.as_ref(),
        Node::Stack(s) => s.chrome.id.as_ref(),
    }
}

fn hex_color(text: &str) -> bool {
    text.len() == 7 && text.starts_with('#') && text[1..].chars().all(|c| c.is_ascii_hexdigit())
}

/// A color or gradient as CSS text: short, one declaration, nothing that fetches.
fn css_background_ok(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    text.len() <= 200
        && !text
            .chars()
            .any(|c| c.is_control() || matches!(c, ';' | '{' | '}'))
        && !lower.contains("url(")
        && !lower.contains("expression")
}

/// `backgrounds/sky.jpg`: plain names only, no dots up, no absolute path.
fn image_path_ok(path: &str) -> bool {
    let kinds = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"];
    path.len() <= 120
        && kinds.iter().any(|k| path.to_ascii_lowercase().ends_with(k))
        && path.split('/').count() <= 4
        && path.split('/').all(|part| {
            !part.is_empty()
                && !part.starts_with('.')
                && part
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | ' '))
        })
}

/// Turns gradient and image backgrounds into the CSS text the page draws (an image becomes a data URI,
/// so nothing is fetched). An image that is missing or over 1 MiB is no background.
fn resolve_backgrounds(node: &mut Node, root: &Path) {
    use base64::Engine;
    let (look, children) = match node {
        Node::Row(g) | Node::Column(g) => (&mut g.look, Some(&mut g.children)),
        Node::Block(b) => (&mut b.look, None),
        Node::Stack(s) => (&mut s.look, Some(&mut s.children)),
    };
    look.background = match look.background.take() {
        Some(Background::Gradient { gradient, angle }) => Some(Background::Css(format!(
            "linear-gradient({}deg, {})",
            angle.unwrap_or(180),
            gradient.join(", ")
        ))),
        Some(Background::Image { image, fit }) => {
            let path = root.join(&image);
            let bytes = std::fs::symlink_metadata(&path)
                .ok()
                .filter(|m| m.is_file() && m.len() <= 1024 * 1024)
                .and_then(|_| std::fs::read(&path).ok());
            bytes.map(|bytes| {
                let lower = image.to_ascii_lowercase();
                let kind = match lower.rsplit('.').next() {
                    Some("svg") => "image/svg+xml",
                    Some("jpg" | "jpeg") => "image/jpeg",
                    Some("webp") => "image/webp",
                    Some("gif") => "image/gif",
                    _ => "image/png",
                };
                Background::Css(format!(
                    "url(\"data:{kind};base64,{}\") center / {} no-repeat",
                    base64::engine::general_purpose::STANDARD.encode(bytes),
                    fit.as_deref().unwrap_or("cover")
                ))
            })
        }
        other => other,
    };
    for child in children.into_iter().flatten() {
        resolve_backgrounds(child, root);
    }
}

fn preview_name_ok(name: &str) -> bool {
    (name.ends_with(".svg") || name.ends_with(".png"))
        && name.len() <= 64
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        && !name.starts_with('.')
}

/// The root's preview picture as a data URI; a file that is missing, large or not the right kind is
/// simply no picture.
fn read_preview(dir: &Path, node: &Node) -> Option<String> {
    use base64::Engine;
    let chrome = match node {
        Node::Row(g) | Node::Column(g) => &g.chrome,
        Node::Block(b) => &b.chrome,
        Node::Stack(s) => &s.chrome,
    };
    let name = chrome.preview.as_deref().filter(|n| preview_name_ok(n))?;
    let path = dir.join(name);
    let meta = std::fs::symlink_metadata(&path).ok()?;
    if !meta.is_file() || meta.len() > 300 * 1024 {
        return None;
    }
    let kind = if name.ends_with(".svg") {
        "image/svg+xml"
    } else {
        "image/png"
    };
    let bytes = std::fs::read(&path).ok()?;
    Some(format!(
        "data:{kind};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

fn read(path: &Path, id: &str) -> LayoutInfo {
    let loaded = std::fs::metadata(path)
        .map_err(|e| e.to_string())
        .and_then(|m| {
            if m.len() > MAX_BYTES {
                Err("larger than 256 KiB".into())
            } else {
                Ok(())
            }
        })
        .and_then(|()| std::fs::read_to_string(path).map_err(|e| e.to_string()))
        .and_then(|text| {
            serde_json::from_str::<serde_json::Value>(&text).map_err(|e| e.to_string())
        })
        .and_then(|value| {
            let name = value["name"].as_str().unwrap_or(id).to_string();
            let mut node: Node = serde_json::from_value(value).map_err(|e| e.to_string())?;
            check(
                &node,
                1,
                &mut Walk {
                    count: 0,
                    ids: Default::default(),
                },
            )?;
            let preview = path.parent().and_then(|dir| read_preview(dir, &node));
            if let Some(root) = path.parent().and_then(Path::parent) {
                resolve_backgrounds(&mut node, root);
            }
            Ok((name, node, preview))
        });
    match loaded {
        Ok((name, node, preview)) => LayoutInfo {
            id: id.into(),
            name,
            root: Some(node),
            preview,
            error: None,
        },
        Err(error) => LayoutInfo {
            id: id.into(),
            name: id.into(),
            root: None,
            preview: None,
            error: Some(error),
        },
    }
}

/// Every `layouts/*.json`, working or not; nothing when mods are off.
pub fn scan(root: &Path, policy: &Policy) -> Vec<LayoutInfo> {
    let Ok(entries) = std::fs::read_dir(root.join("layouts")) else {
        return Vec::new();
    };
    if policy.is_off() {
        return Vec::new();
    }
    let mut found: Vec<LayoutInfo> = entries
        .filter_map(Result::ok)
        .filter_map(|e| {
            let name = e.file_name().into_string().ok()?;
            let id = name.strip_suffix(".json")?;
            plain_id(id).then(|| read(&e.path(), id))
        })
        .collect();
    found.sort_by(|a, b| a.id.cmp(&b.id));
    found
}

/// A theme file in `<root>/themes/<id>.json`. Two shapes: Perch's own, `{"name", "base"?, "colors":
/// {palette token: "#rrggbb"}}` (tokens are `COLORS` without `backdrop`; `base` is the theme the rest
/// comes from), or herdr's terminal one, `{"name", "background", "foreground", "selection"?,
/// "cursor"?, "ansi": [16 colors]}`, from which the page derives the palette.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct ThemeFile {
    pub name: Option<String>,
    pub base: Option<String>,
    pub colors: BTreeMap<String, String>,
    pub background: Option<String>,
    pub foreground: Option<String>,
    pub selection: Option<String>,
    pub cursor: Option<String>,
    pub ansi: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ThemeInfo {
    pub id: String,
    pub name: String,
    pub theme: Option<ThemeFile>,
    pub error: Option<String>,
}

fn theme_ok(theme: &ThemeFile) -> Result<(), String> {
    let bad = |c: &String| !hex_color(c);
    if theme
        .colors
        .iter()
        .any(|(name, value)| !COLORS.contains(&name.as_str()) || name == "backdrop" || bad(value))
        || [
            &theme.background,
            &theme.foreground,
            &theme.selection,
            &theme.cursor,
        ]
        .into_iter()
        .flatten()
        .any(bad)
        || theme.ansi.iter().any(bad)
        || !(theme.ansi.is_empty() || theme.ansi.len() == 16)
    {
        return Err("colors are #rrggbb, palette tokens are known, and ansi has 16 entries".into());
    }
    let shaped =
        !theme.colors.is_empty() || (theme.background.is_some() && theme.foreground.is_some());
    if !shaped {
        return Err("a theme has colors, or a background and foreground".into());
    }
    if theme
        .name
        .iter()
        .chain(theme.base.iter())
        .any(|t| t.len() > 60 || t.chars().any(char::is_control))
    {
        return Err("name and base are short plain text".into());
    }
    Ok(())
}

/// The theme files in `themes/`, sorted by id; none while mods are off. A file that does not parse
/// is listed with its error and never breaks the rest.
pub fn scan_themes(root: &Path, policy: &Policy) -> Vec<ThemeInfo> {
    if policy.is_off() {
        return Vec::new();
    }
    let Ok(entries) = std::fs::read_dir(root.join("themes")) else {
        return Vec::new();
    };
    let mut ids: Vec<String> = entries
        .filter_map(Result::ok)
        .filter_map(|e| e.file_name().into_string().ok())
        .filter_map(|n| n.strip_suffix(".json").map(String::from))
        .filter(|id| plain_id(id))
        .collect();
    ids.sort();
    ids.into_iter()
        .map(|id| {
            let path = root.join("themes").join(format!("{id}.json"));
            let parsed = std::fs::metadata(&path)
                .map_err(|e| e.to_string())
                .and_then(|m| {
                    if m.len() > 64 * 1024 {
                        Err("larger than 64 KiB".to_string())
                    } else {
                        std::fs::read_to_string(&path).map_err(|e| e.to_string())
                    }
                })
                .and_then(|text| {
                    serde_json::from_str::<ThemeFile>(&text).map_err(|e| e.to_string())
                })
                .and_then(|t| theme_ok(&t).map(|()| t));
            match parsed {
                Ok(theme) => ThemeInfo {
                    name: theme.name.clone().unwrap_or_else(|| id.clone()),
                    id,
                    theme: Some(theme),
                    error: None,
                },
                Err(error) => ThemeInfo {
                    name: id.clone(),
                    id,
                    theme: None,
                    error: Some(error),
                },
            }
        })
        .collect()
}

/// The layout the person chose, if any.
pub fn current(root: &Path) -> Option<String> {
    let text = std::fs::read_to_string(root.join("layout-state.json")).ok()?;
    serde_json::from_str::<serde_json::Value>(&text).ok()?["layout"]
        .as_str()
        .map(String::from)
}

/// Choose a layout, or `None` for stock Perch. Only a layout that parses can be chosen.
pub fn set_current(root: &Path, policy: &Policy, id: Option<&str>) -> Result<(), Error> {
    if let Some(id) = id {
        match scan(root, policy).into_iter().find(|l| l.id == id) {
            None => {
                return Err(Error::NotFound(format!(
                    "no layout \"{id}\" (or mods are off)"
                )))
            }
            Some(l) if l.error.is_some() => {
                return Err(Error::Invalid(l.error.unwrap_or_default()))
            }
            Some(_) => {}
        }
    }
    std::fs::write(
        root.join("layout-state.json"),
        serde_json::json!({ "layout": id }).to_string(),
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn root_with(files: &[(&str, &str)]) -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!("perch-layouts-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("layouts")).unwrap();
        for (name, text) in files {
            std::fs::write(root.join("layouts").join(name), text).unwrap();
        }
        root
    }

    #[test]
    fn a_tree_of_panes_and_mods_loads_and_a_bad_file_never_breaks_the_rest() {
        let ide = r#"{"name":"IDE","type":"row","gap":4,"children":[
            {"type":"block","content":"sidebar","size":{"px":220}},
            {"type":"column","size":{"weight":3},"children":[
                {"type":"block","content":"canvas"},{"type":"block","content":"mod:board","size":{"px":160}}]},
            {"type":"block","content":"files","hidden":true}]}"#;
        let root = root_with(&[
            ("ide.json", ide),
            ("garbage.json", "{"),
            ("unknown.json", r#"{"type":"block","content":"settings"}"#),
            (
                "deep.json",
                &format!(
                    "{}{}{}",
                    r#"{"type":"row","children":["#.repeat(10),
                    r#"{"type":"block","content":"tabs"}"#,
                    "]}".repeat(10)
                ),
            ),
            ("empty.json", r#"{"type":"row","children":[]}"#),
            ("badmod.json", r#"{"type":"block","content":"mod:../x"}"#),
            ("not-json.txt", "x"),
        ]);
        let found = scan(&root, &Policy::default());
        let by = |id: &str| found.iter().find(|l| l.id == id).unwrap();
        assert_eq!(found.len(), 6);
        assert!(by("ide").error.is_none() && by("ide").name == "IDE");
        for broken in ["garbage", "unknown", "deep", "empty", "badmod"] {
            assert!(
                by(broken).error.is_some() && by(broken).root.is_none(),
                "{broken}"
            );
        }
        assert!(scan(&root, &Policy { off: true }).is_empty());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn a_look_cascades_from_any_node_and_bad_values_make_the_layout_unusable() {
        let ok = r##"{"type":"row","theme":"nord","colors":{"accent":"#ff8800","backdrop":"#101010"},
            "font":"Geist, sans-serif","radius":4,"border":1,"children":[
            {"type":"block","content":"canvas","theme":"terminal","radius":0}]}"##;
        let root = root_with(&[
            ("ok.json", ok),
            (
                "name.json",
                r##"{"type":"block","content":"tabs","colors":{"nope":"#000000"}}"##,
            ),
            (
                "hex.json",
                r#"{"type":"block","content":"tabs","colors":{"accent":"red"}}"#,
            ),
            (
                "big.json",
                r#"{"type":"block","content":"tabs","radius":500}"#,
            ),
            (
                "fancy.json",
                r##"{"type":"row","background":"linear-gradient(#111, #222)","children":[
                {"type":"block","content":"terminal:abc-123","float":{"x":20,"y":20,"width":400,"height":300}}]}"##,
            ),
            (
                "url.json",
                r#"{"type":"block","content":"tabs","background":"url(http://x/y.png)"}"#,
            ),
            (
                "flat.json",
                r#"{"type":"block","content":"tabs","float":{"x":0,"y":0,"width":0,"height":10}}"#,
            ),
            ("term.json", r#"{"type":"block","content":"terminal:../x"}"#),
            (
                "term-look.json",
                r#"{"type":"row","shadow":"md","terminalPadding":10,"terminalOpacity":0.5,"children":[
                {"type":"block","content":"canvas","size":{"weight":2,"min":200,"max":900}}]}"#,
            ),
            (
                "drawer.json",
                r#"{"type":"row","children":[{"type":"block","content":"tabs","float":{"x":0,"y":0,"width":300,"height":200,"edge":"left","align":"center","peek":40}}]}"#,
            ),
            (
                "drawer-bad.json",
                r#"{"type":"block","content":"tabs","float":{"x":0,"y":0,"width":300,"height":200,"edge":"top","peek":40}}"#,
            ),
            ("chrome.svg", "<svg xmlns='http://www.w3.org/2000/svg'/>"),
            (
                "chrome.json",
                r##"{"type":"column","id":"root","theme":{"light":"paper","dark":"nord"},"titlebar":"none","trafficLights":[20,24],"preview":"chrome.svg","resizable":false,
                "divider":{"width":1,"color":"#333333"},"children":[
                {"type":"block","id":"bar","content":"tabs","windowDrag":true,"size":{"px":30}},
                {"type":"stack","id":"main","active":"b","header":"tabs","children":[
                  {"type":"block","id":"a","title":"Files","content":"files"},
                  {"type":"block","id":"b","title":"Git","content":"git"}]}]}"##,
            ),
            (
                "stack-bad-active.json",
                r#"{"type":"stack","active":"zz","children":[{"type":"block","content":"tabs"}]}"#,
            ),
            (
                "stack-bad-header.json",
                r#"{"type":"stack","header":"nope","children":[{"type":"block","content":"tabs"}]}"#,
            ),
            ("stack-empty.json", r#"{"type":"stack","children":[]}"#),
            (
                "dup-id.json",
                r#"{"type":"row","children":[{"type":"block","id":"x","content":"tabs"},{"type":"block","id":"x","content":"canvas"}]}"#,
            ),
            (
                "bad-titlebar.json",
                r#"{"type":"block","content":"tabs","titlebar":"fancy"}"#,
            ),
            (
                "bad-preview.json",
                r#"{"type":"block","content":"tabs","preview":"../x.svg"}"#,
            ),
            (
                "bad-divider.json",
                r#"{"type":"row","divider":{"width":3,"color":"red"},"children":[{"type":"block","content":"tabs"}]}"#,
            ),
            (
                "pane-bad.json",
                r#"{"type":"block","content":"tabs","paneFocus":"red"}"#,
            ),
            (
                "pane-ok.json",
                r##"{"type":"block","content":"canvas","paneRadius":2,"paneBorder":1,"paneFocus":"#ff8800","movable":false,"paneGap":10,"paneLone":true,"paneBackground":"linear-gradient(#111, #222)","paneHeaderAt":"bottom","paneHeaderReveal":"hover","paneHeaderHeight":24}"##,
            ),
            (
                "props-ok.json",
                r#"{"type":"block","content":"mod:board","props":{"file":"a.md","n":3}}"#,
            ),
            (
                "props-bad.json",
                r#"{"type":"block","content":"mod:board","props":[1,2]}"#,
            ),
            (
                "pane-gap.json",
                r#"{"type":"block","content":"canvas","paneGap":99}"#,
            ),
            (
                "pane-header.json",
                r#"{"type":"block","content":"canvas","paneHeaderAt":"left"}"#,
            ),
            (
                "pane-bg.json",
                r#"{"type":"block","content":"canvas","paneBackground":"url(http://x/y)"}"#,
            ),
            (
                "shadow.json",
                r#"{"type":"block","content":"tabs","shadow":"huge"}"#,
            ),
            (
                "opaque.json",
                r#"{"type":"block","content":"tabs","terminalOpacity":0}"#,
            ),
            (
                "pad.json",
                r#"{"type":"block","content":"tabs","terminalPadding":500}"#,
            ),
            (
                "minmax.json",
                r#"{"type":"block","content":"tabs","size":{"min":9000}}"#,
            ),
        ]);
        let found = scan(&root, &Policy::default());
        let by = |id: &str| found.iter().find(|l| l.id == id).unwrap();
        assert!(by("ok").error.is_none(), "{:?}", by("ok").error);
        let Some(Node::Row(group)) = &by("ok").root else {
            panic!("a row")
        };
        assert_eq!(group.look.theme, Some(ThemeRef::Name("nord".into())));
        assert_eq!(group.look.colors["accent"], "#ff8800");
        assert_eq!((group.look.radius, group.look.border), (Some(4), Some(1)));
        assert!(by("fancy").error.is_none(), "{:?}", by("fancy").error);
        assert!(by("chrome").error.is_none(), "{:?}", by("chrome").error);
        assert!(by("chrome")
            .preview
            .as_deref()
            .is_some_and(|p| p.starts_with("data:image/svg+xml;base64,")));
        let Some(Node::Column(top)) = &by("chrome").root else {
            panic!("a column")
        };
        assert_eq!(
            top.look.theme,
            Some(ThemeRef::Pair {
                light: "paper".into(),
                dark: "nord".into()
            })
        );
        assert!(!top.resizable && top.divider.as_ref().unwrap().width == 1);
        assert_eq!(top.chrome.traffic_lights, Some([20, 24]));
        let Node::Stack(stack) = &top.children[1] else {
            panic!("a stack")
        };
        assert_eq!(stack.active.as_deref(), Some("b"));
        assert!(by("drawer").error.is_none(), "{:?}", by("drawer").error);
        assert!(by("pane-ok").error.is_none(), "{:?}", by("pane-ok").error);
        let Some(Node::Block(with_props)) = &by("props-ok").root else {
            panic!("a block")
        };
        assert_eq!(with_props.props.as_ref().unwrap()["file"], "a.md");
        let Some(Node::Block(pane)) = &by("pane-ok").root else {
            panic!("a block")
        };
        assert_eq!(
            pane.look.movable,
            Some(false),
            "movable survives to the page"
        );
        assert_eq!(
            (
                pane.look.pane_header_at.as_deref(),
                pane.look.pane_header_reveal.as_deref(),
                pane.look.pane_header_height
            ),
            (Some("bottom"), Some("hover"), Some(24))
        );
        assert_eq!(
            (pane.look.pane_gap, pane.look.pane_lone),
            (Some(10), Some(true))
        );
        let Some(Node::Row(look)) = &by("term-look").root else {
            panic!("a row")
        };
        assert_eq!(
            serde_json::to_value(&look.look).unwrap(),
            serde_json::json!({"shadow":"md","terminalPadding":10,"terminalOpacity":0.5})
        );
        for bad in [
            "name",
            "hex",
            "big",
            "url",
            "flat",
            "term",
            "shadow",
            "opaque",
            "pad",
            "minmax",
            "pane-bad",
            "pane-gap",
            "props-bad",
            "pane-header",
            "pane-bg",
            "drawer-bad",
            "stack-bad-active",
            "stack-bad-header",
            "stack-empty",
            "dup-id",
            "bad-titlebar",
            "bad-preview",
            "bad-divider",
        ] {
            assert!(by(bad).error.is_some(), "{bad}");
        }
        // The page reads the look off the node as camelCase-free flat keys.
        let json = serde_json::to_value(&group.look).unwrap();
        assert_eq!(json["font"], "Geist, sans-serif");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn gradient_and_image_backgrounds_reach_the_page_as_css() {
        let root = std::env::temp_dir().join(format!("perch-bg-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("layouts")).unwrap();
        std::fs::create_dir_all(root.join("backgrounds")).unwrap();
        std::fs::write(root.join("backgrounds/sky.png"), [137, 80, 78, 71]).unwrap();
        let put = |name: &str, text: &str| {
            std::fs::write(root.join("layouts").join(name), text).unwrap();
        };
        put(
            "grad.json",
            r##"{"type":"row","background":{"gradient":["#2a6cbd","#0b2a57"],"angle":165},"children":[
              {"type":"block","content":"tabs","background":{"image":"backgrounds/sky.png","fit":"contain"}},
              {"type":"block","content":"canvas","background":{"image":"backgrounds/gone.png"}}]}"##,
        );
        put(
            "grad-one.json",
            r##"{"type":"block","content":"tabs","background":{"gradient":["#2a6cbd"]}}"##,
        );
        put(
            "grad-name.json",
            r##"{"type":"block","content":"tabs","background":{"gradient":["red","blue"]}}"##,
        );
        put(
            "img-up.json",
            r#"{"type":"block","content":"tabs","background":{"image":"../secret.png"}}"#,
        );
        put(
            "img-abs.json",
            r#"{"type":"block","content":"tabs","background":{"image":"/etc/x.png"}}"#,
        );
        put(
            "img-fit.json",
            r#"{"type":"block","content":"tabs","background":{"image":"a.png","fit":"stretch"}}"#,
        );
        let found = scan(&root, &Policy::default());
        let by = |id: &str| found.iter().find(|l| l.id == id).unwrap();
        let Some(Node::Row(row)) = &by("grad").root else {
            panic!("a row {:?}", by("grad").error)
        };
        assert_eq!(
            row.look.background,
            Some(Background::Css(
                "linear-gradient(165deg, #2a6cbd, #0b2a57)".into()
            ))
        );
        let Node::Block(sky) = &row.children[0] else {
            panic!("a block")
        };
        let Some(Background::Css(css)) = &sky.look.background else {
            panic!("css")
        };
        assert!(
            css.starts_with("url(\"data:image/png;base64,iVBORw==\") center / contain no-repeat"),
            "{css}"
        );
        let Node::Block(gone) = &row.children[1] else {
            panic!("a block")
        };
        assert_eq!(
            gone.look.background, None,
            "a missing picture is no background"
        );
        for bad in ["grad-one", "grad-name", "img-up", "img-abs", "img-fit"] {
            assert!(by(bad).error.is_some(), "{bad}");
        }
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn theme_files_load_in_either_shape_and_a_bad_one_never_breaks_the_rest() {
        let root = std::env::temp_dir().join(format!("perch-themes-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("themes")).unwrap();
        let put =
            |name: &str, text: &str| std::fs::write(root.join("themes").join(name), text).unwrap();
        put(
            "mine.json",
            r##"{"name":"Mine","base":"nord","colors":{"accent":"#ff8800"}}"##,
        );
        let ansi: Vec<String> = (0..16).map(|i| format!("#{i:02x}{i:02x}{i:02x}")).collect();
        put(
            "term.json",
            &format!(
                r##"{{"background":"#101010","foreground":"#eeeeee","ansi":{}}}"##,
                serde_json::json!(ansi)
            ),
        );
        put("bad-hex.json", r#"{"colors":{"accent":"orange"}}"#);
        put("bad-token.json", r##"{"colors":{"nope":"#000000"}}"##);
        put(
            "bad-ansi.json",
            r##"{"background":"#000000","foreground":"#ffffff","ansi":["#000000"]}"##,
        );
        put("empty.json", "{}");
        put("not json.json", "{");
        let found = scan_themes(&root, &Policy::default());
        let by = |id: &str| found.iter().find(|t| t.id == id).unwrap();
        assert_eq!(by("mine").name, "Mine");
        assert!(by("mine").error.is_none() && by("term").error.is_none());
        for bad in ["bad-hex", "bad-token", "bad-ansi", "empty"] {
            assert!(by(bad).error.is_some(), "{bad}");
        }
        assert_eq!(found.len(), 6); // "not json" has a space: not a plain id
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn only_a_working_layout_can_be_chosen_and_stock_is_always_there() {
        let root = root_with(&[
            ("ok.json", r#"{"type":"block","content":"canvas"}"#),
            ("bad.json", "{"),
        ]);
        let policy = Policy::default();
        assert_eq!(current(&root), None);
        assert!(set_current(&root, &policy, Some("bad")).is_err());
        assert!(set_current(&root, &policy, Some("nope")).is_err());
        set_current(&root, &policy, Some("ok")).unwrap();
        assert_eq!(current(&root).as_deref(), Some("ok"));
        set_current(&root, &policy, None).unwrap();
        assert_eq!(current(&root), None);
        let _ = std::fs::remove_dir_all(&root);
    }
}

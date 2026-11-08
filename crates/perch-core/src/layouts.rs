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

/// How a node looks, as in herdr's cascading look properties: set on any node, and the nearest one up
/// the tree wins. On the root it restyles the whole app; on a deeper node, that subtree.
/// `theme` is a name from `themes.ts` (an unknown one shows as the default theme), `colors`
/// overrides single palette tokens (`COLORS`) with `#rrggbb`, `font` is a CSS font-family for the
/// interface, `radius` rounds the cards and `border` outlines them (px).
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Look {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<String>,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub colors: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub radius: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub border: Option<u32>,
    /// A CSS background for the node: a color or a gradient (no `url(`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background: Option<String>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub float: Option<Float>,
    pub size: Option<Size>,
    pub hidden: bool,
    pub gap: u32,
    pub padding: u32,
    pub children: Vec<Node>,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Block {
    #[serde(flatten)]
    pub look: Look,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub float: Option<Float>,
    pub size: Option<Size>,
    pub hidden: bool,
    pub padding: u32,
    pub content: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Node {
    Row(Group),
    Column(Group),
    Block(Block),
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LayoutInfo {
    pub id: String,
    pub name: String,
    pub root: Option<Node>,
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
    if !text_ok(&look.theme) || !text_ok(&look.font) {
        return Err("theme and font must be short plain text".into());
    }
    if let Some(background) = &look.background {
        let lower = background.to_ascii_lowercase();
        if background.len() > 200
            || background
                .chars()
                .any(|c| c.is_control() || matches!(c, ';' | '{' | '}'))
            || lower.contains("url(")
            || lower.contains("expression")
        {
            return Err("background is a color or a gradient (no url())".into());
        }
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
    {
        return Err("paneRadius is at most 48, paneBorder at most 8 and paneFocus #rrggbb".into());
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

fn check(node: &Node, depth: usize, count: &mut usize) -> Result<(), String> {
    *count += 1;
    if depth > MAX_DEPTH || *count > MAX_NODES {
        return Err(format!(
            "too big: at most {MAX_DEPTH} levels and {MAX_NODES} nodes"
        ));
    }
    let (look, float) = match node {
        Node::Row(g) | Node::Column(g) => (&g.look, &g.float),
        Node::Block(b) => (&b.look, &b.float),
    };
    look_ok(look)?;
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
            if g.children.is_empty() || g.gap > 200 || g.padding > 200 || !size_ok(&g.size) {
                return Err("a row or column needs children and sane gap, padding and size".into());
            }
            g.children
                .iter()
                .try_for_each(|c| check(c, depth + 1, count))
        }
        Node::Block(b) => {
            let known = BUILTIN.contains(&b.content.as_str())
                || b.content.strip_prefix("mod:").is_some_and(plain_id)
                || b.content.strip_prefix("terminal:").is_some_and(plain_id);
            if !known || b.padding > 200 || !size_ok(&b.size) {
                return Err(format!(
                    "block content \"{}\" must be one of {}, mod:<id> or terminal:<session id>",
                    b.content,
                    BUILTIN.join(", ")
                ));
            }
            Ok(())
        }
    }
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
            let node: Node = serde_json::from_value(value).map_err(|e| e.to_string())?;
            check(&node, 1, &mut 0)?;
            Ok((name, node))
        });
    match loaded {
        Ok((name, node)) => LayoutInfo {
            id: id.into(),
            name,
            root: Some(node),
            error: None,
        },
        Err(error) => LayoutInfo {
            id: id.into(),
            name: id.into(),
            root: None,
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
            (
                "pane-bad.json",
                r#"{"type":"block","content":"tabs","paneFocus":"red"}"#,
            ),
            (
                "pane-ok.json",
                r##"{"type":"block","content":"canvas","paneRadius":2,"paneBorder":1,"paneFocus":"#ff8800"}"##,
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
        assert_eq!(group.look.theme.as_deref(), Some("nord"));
        assert_eq!(group.look.colors["accent"], "#ff8800");
        assert_eq!((group.look.radius, group.look.border), (Some(4), Some(1)));
        assert!(by("fancy").error.is_none(), "{:?}", by("fancy").error);
        assert!(by("drawer").error.is_none(), "{:?}", by("drawer").error);
        assert!(by("pane-ok").error.is_none(), "{:?}", by("pane-ok").error);
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
            "drawer-bad",
        ] {
            assert!(by(bad).error.is_some(), "{bad}");
        }
        // The page reads the look off the node as camelCase-free flat keys.
        let json = serde_json::to_value(&group.look).unwrap();
        assert_eq!(json["font"], "Geist, sans-serif");
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

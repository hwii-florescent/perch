//! Layouts, as in herdr's desktop app: `<root>/layouts/<id>.json` is a whole window as a tree of
//! rows, columns and blocks, and a block is one of Perch's own panes (`sidebar`, `tabs`, `canvas`,
//! `files`, `git`, `status`) or a mod (`mod:<id>`). Stock Perch is the default; one layout can be
//! chosen (`layout-state.json` beside `layouts/`), and mods being off, or a layout that stops
//! parsing, falls back to stock. The core only checks the shape (depth, size, known content); the
//! page draws it. Look is a mod's business, so a node has only `size`, `hidden`, `gap` and `padding`.
//! ponytail: structure only; a layout cannot yet set colors, borders or floating blocks, which a mod
//! can draw itself. The upgrade path is herdr's cascading look properties on any node.
use crate::mods::{plain_id, Error, Policy};
use serde::{Deserialize, Serialize};
use std::path::Path;

const MAX_DEPTH: usize = 8;
const MAX_NODES: usize = 64;
const MAX_BYTES: u64 = 256 * 1024;
const BUILTIN: [&str; 6] = ["sidebar", "tabs", "canvas", "files", "git", "status"];

/// `{"px": 240}` (fixed) or `{"weight": 2}` (a share of what fixed siblings leave; the default is 1).
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Size {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub px: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight: Option<f32>,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Group {
    pub size: Option<Size>,
    pub hidden: bool,
    pub gap: u32,
    pub padding: u32,
    pub children: Vec<Node>,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Block {
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
        s.px.is_none_or(|px| px <= 4000) && s.weight.is_none_or(|w| w > 0.0 && w <= 100.0)
    })
}

fn check(node: &Node, depth: usize, count: &mut usize) -> Result<(), String> {
    *count += 1;
    if depth > MAX_DEPTH || *count > MAX_NODES {
        return Err(format!(
            "too big: at most {MAX_DEPTH} levels and {MAX_NODES} nodes"
        ));
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
                || b.content.strip_prefix("mod:").is_some_and(plain_id);
            if !known || b.padding > 200 || !size_ok(&b.size) {
                return Err(format!(
                    "block content \"{}\" must be one of {} or mod:<id>",
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

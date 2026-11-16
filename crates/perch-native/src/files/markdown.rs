//! A Markdown file's rendered preview: the `markdown` engine kind behind the native `MarkdownPreview`.
//!
//! The screen side (the scrolling region, its test id, the size notice, the web's `.file-markdown` box) is
//! `MarkdownPreview` in `@perch/sdk`; the document itself is drawn here by gpui-base's `TextView`, which parses on a
//! background thread, lays out only the blocks in view and wraps text with its inline code, links and emphasis. The
//! runtime's own elements could not: it has no inline formatting (a sentence with a `code` span became a row that
//! never wraps), and a long document was thousands of React elements, lexed and described in script past its time
//! budget.
//!
//! The web's sanitiser rules (`renderFilePreview` in `packages/web/src/markdown.ts`) hold: nothing is fetched (every
//! image source is refused, and a Markdown image is drawn as the web's text placeholder `[image: alt] url`), and a
//! link opens only on a click and only for an absolute http(s) address (`link.open`).
//!
//! `perch-markdown`: `show(key, text)` gives key `key` its document; `release(key)` forgets it.

use crate::mods::ModHost;
use gpui::{
    div, prelude::*, px, AnyElement, App, Hsla, ImageCacheError, ImageSource, SharedString, Window,
};
use gpui_base::text::{TextView, TextViewStyle};
use gpui_shell::{HostModule, HostValue};
use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::Arc;

/// The app's line height (`body` in the web's `base.css`).
const LINE_HEIGHT: f32 = 1.3;

const DECLARATIONS: &str = "export function show(key: string, text: string): void;
export function release(key: string): void;";

thread_local! {
    /// The document of each key, as drawn (images already placeholders).
    static DOCUMENTS: RefCell<HashMap<String, SharedString>> = RefCell::new(HashMap::new());
}

/// Every document held now (for tests: what the previews on screen draw).
pub fn documents() -> Vec<String> {
    DOCUMENTS.with(|d| d.borrow().values().map(ToString::to_string).collect())
}

/// The web's text for an image it does not load (`placeholder` in `markdown.ts`): `[image: alt] url`.
fn placeholder(alt: &str, url: &str) -> String {
    let shown = if url.starts_with("data:") {
        "data URL".to_string()
    } else if url.chars().count() > 200 {
        format!("{}…", url.chars().take(200).collect::<String>())
    } else {
        url.to_string()
    };
    let mut text = String::from("[image");
    if !alt.is_empty() {
        text.push_str(": ");
        text.push_str(alt);
    }
    text.push(']');
    if !shown.is_empty() {
        text.push(' ');
        text.push_str(&shown);
    }
    text
}

/// `text` with every inline image `![alt](url "title")` outside code replaced by its placeholder, as an inline code
/// span (the web's dashed placeholder box, drawn in the preview's code style).
/// ponytail: a line scan, not a parse: a reference image (`![alt][ref]`) or one split over lines keeps its Markdown
/// and draws nothing (no source loads); a full parse on the background thread would place those too.
pub fn with_placeholders(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut fence: Option<(char, usize)> = None;
    for line in text.split_inclusive('\n') {
        let trimmed = line.trim_start_matches(' ');
        let indent = line.len() - trimmed.len();
        let run = |c: char| trimmed.chars().take_while(|&x| x == c).count();
        let mark = ['`', '~']
            .into_iter()
            .map(|c| (c, run(c)))
            .find(|&(_, n)| n >= 3 && indent <= 3);
        match (fence, mark) {
            (None, Some(open)) => {
                fence = Some(open);
                out.push_str(line);
                continue;
            }
            (Some((c, n)), Some((m, k))) if c == m && k >= n && trimmed[k..].trim().is_empty() => {
                fence = None;
                out.push_str(line);
                continue;
            }
            (Some(_), _) => {
                out.push_str(line);
                continue;
            }
            _ => {}
        }
        if indent >= 4 || !line.contains("![") {
            out.push_str(line);
            continue;
        }
        out.push_str(&line_placeholders(line));
    }
    out
}

/// One line's images replaced, skipping code spans.
fn line_placeholders(line: &str) -> String {
    let bytes = line.as_bytes();
    let mut out = String::with_capacity(line.len());
    let mut i = 0;
    while i < bytes.len() {
        // A code span: copied as it is, up to the closing run of the same length.
        if bytes[i] == b'`' {
            let n = bytes[i..].iter().take_while(|&&b| b == b'`').count();
            let fence = &line[i..i + n];
            match line[i + n..].find(fence) {
                Some(end) => {
                    let to = i + n + end + n;
                    out.push_str(&line[i..to]);
                    i = to;
                }
                None => {
                    out.push_str(fence);
                    i += n;
                }
            }
            continue;
        }
        if bytes[i] == b'\\' && i + 1 < bytes.len() {
            let next = line[i + 1..].chars().next().unwrap();
            out.push('\\');
            out.push(next);
            i += 1 + next.len_utf8();
            continue;
        }
        if line[i..].starts_with("![") {
            if let Some((alt, url, len)) = image_at(&line[i..]) {
                let text = placeholder(alt, url);
                let ticks = "`".repeat(text.split('`').count().max(1));
                let pad = if text.starts_with('`') || text.ends_with('`') {
                    " "
                } else {
                    ""
                };
                out.push_str(&format!("{ticks}{pad}{text}{pad}{ticks}"));
                i += len;
                continue;
            }
        }
        let c = line[i..].chars().next().unwrap();
        out.push(c);
        i += c.len_utf8();
    }
    out
}

/// `![alt](url "title")` at the start of `s`: its alt, its url and its length.
fn image_at(s: &str) -> Option<(&str, &str, usize)> {
    let mut depth = 0;
    let mut close = None;
    for (at, c) in s.char_indices().skip(2) {
        match c {
            '[' => depth += 1,
            ']' if depth == 0 => {
                close = Some(at);
                break;
            }
            ']' => depth -= 1,
            _ => {}
        }
    }
    let close = close?;
    let rest = s[close + 1..].strip_prefix('(')?;
    let end = rest.find(')')?;
    let inside = rest[..end].trim();
    let url = inside
        .strip_prefix('<')
        .and_then(|u| u.split_once('>'))
        .map_or_else(
            || inside.split_whitespace().next().unwrap_or(""),
            |(u, _)| u,
        );
    Some((&s[2..close], url, close + 2 + end + 1))
}

/// The style of the web's `.message__markdown.file-markdown` (`chat.css`) at `size`, the preview's text size, in the
/// window's colours.
fn style(size: f32, zoom: f32, cx: &App) -> TextViewStyle {
    let theme = gpui_base::Theme::global(cx).clone();
    let colors = &theme.tokens.colors;
    // `--surface-0` is the theme's `secondary`, `--overlay-0` its `border` (`mods::theme::apply`).
    let surface: Hsla = colors.secondary;
    // `pre`: padding 0.6rem 0.75rem, `--radius` (8px), no border; `pre code` 0.85em in the monospace stack.
    let rem = size / 0.8;
    let mut code = gpui::StyleRefinement::default();
    let (vertical, horizontal) = (px(0.6 * rem), px(0.75 * rem));
    code.padding = gpui::EdgesRefinement {
        top: Some(vertical.into()),
        bottom: Some(vertical.into()),
        left: Some(horizontal.into()),
        right: Some(horizontal.into()),
    };
    code.border_widths = gpui::EdgesRefinement {
        top: Some(px(0.).into()),
        bottom: Some(px(0.).into()),
        left: Some(px(0.).into()),
        right: Some(px(0.).into()),
    };
    let radius = px(8. * zoom);
    code.corner_radii = gpui::CornersRefinement {
        top_left: Some(radius.into()),
        top_right: Some(radius.into()),
        bottom_left: Some(radius.into()),
        bottom_right: Some(radius.into()),
    };
    code.text.font_size = Some(px(size * 0.85).into());
    code.text.line_height = Some(gpui::relative(LINE_HEIGHT));
    if cfg!(target_os = "macos") {
        code.text.font_family = Some(".AppleSystemUIFontMonospaced".into());
    }
    // `.file-markdown table`: 0.92em on `--surface-0`; header cells on `--surface-1` in `--subtext-0`, weight 600.
    // ponytail: the web's table is as wide as its content (`display: block`); TextView's fills the column, its
    // columns shared out by content, and its cells keep TextView's padding (a narrower padding makes TextView, which
    // measures columns with its own, wrap a cell's last letters). A content-width table needs a TextView option.
    let table_size = size * 0.92;
    let mut table = gpui::StyleRefinement::default();
    table.text.font_size = Some(px(table_size).into());
    table.background = Some(surface.into());
    let head = gpui::StyleRefinement {
        background: Some(colors.accent.into()),
        text: gpui::TextStyleRefinement {
            color: Some(colors.muted_foreground),
            font_weight: Some(gpui::FontWeight::SEMIBOLD),
            ..Default::default()
        },
        ..Default::default()
    };
    TextViewStyle::from_theme(&theme)
        .with_table(table)
        .with_table_head(head)
        .with_code_block(code)
        .with_code_background(surface)
        .with_inline_code(gpui::HighlightStyle {
            background_color: Some(surface),
            ..Default::default()
        })
        // `p { margin: 0 0 0.5em }` and `> * + * { margin-top: 0.5em }`, which collapse: 0.5em of 0.8rem.
        .with_paragraph_gap(gpui::rems(0.4 * zoom))
        // `h1` 1.25em, `h2` 1.12em, `h3` and `h4` 1em (`h5`, `h6` the browser's), line height 1.25.
        .with_heading(move |level| {
            let scale = match level {
                1 => 1.25,
                2 => 1.12,
                3 | 4 => 1.,
                5 => 0.83,
                _ => 0.67,
            };
            let mut style = gpui::StyleRefinement::default();
            style.text.font_size = Some(px(size * scale).into());
            style.text.line_height = Some(px(size * scale * 1.25).into());
            style.text.font_weight = Some(gpui::FontWeight::BOLD);
            style
        })
}

fn open_link(url: &SharedString) {
    if url.starts_with("http://") || url.starts_with("https://") {
        if let Err(error) = crate::handoff::open_link(url) {
            eprintln!("perch-native: could not open {url}: {error:#}");
        }
    }
}

/// The preview of `key`: its document in the web's text size (0.8rem, by the window's zoom), filling its box. A key
/// with no document draws an empty box.
pub fn element(key: &str, window: &mut Window, cx: &mut App) -> AnyElement {
    let Some(text) = DOCUMENTS.with(|d| d.borrow().get(key).cloned()) else {
        return div().size_full().into_any_element();
    };
    let zoom = cx
        .try_global::<crate::mods::WindowMods>()
        .map_or(1., |mods| mods.editors.zoom());
    let size = 0.8 * window.rem_size().to_f64() as f32 * zoom;
    let view = TextView::markdown(SharedString::from(format!("perch-markdown-{key}")), text)
        .style(style(size, zoom, cx))
        .selectable(true)
        // It scrolls itself and lays out only the blocks in view: a long document is never laid out whole.
        .scrollable(true)
        .image_source(|_| {
            ImageSource::Custom(Arc::new(|_, _| {
                Some(Err(ImageCacheError::Other(Arc::new(anyhow::anyhow!(
                    "a preview fetches nothing"
                )))))
            }))
        })
        .on_link_click(|url, _, _, _| open_link(url))
        // No language label in a code block's corner: the web's preview draws a plain `pre`.
        .code_block_actions(|_, _, _| gpui::Empty);
    div()
        .size_full()
        .text_size(px(size))
        .line_height(gpui::relative(LINE_HEIGHT))
        .child(view)
        .into_any_element()
}

/// The `markdown` engine kind: `data-perch-engine="markdown"` draws [`element`] for its key.
pub struct MarkdownEngine;

impl crate::mods::engines::EngineKind for MarkdownEngine {
    fn draw(&self, key: &str, window: &mut Window, cx: &mut App) -> AnyElement {
        element(key, window, cx)
    }

    fn release(&self, key: &str, _: &mut App) {
        DOCUMENTS.with(|d| d.borrow_mut().remove(key));
    }
}

/// Lends `perch-markdown` to every mod `host` loads, and places its documents as the `markdown` engine.
pub fn register(host: &ModHost) {
    host.engines().register("markdown", MarkdownEngine);
    host.register_module(|_| module());
}

fn module() -> HostModule {
    HostModule::new("perch-markdown")
        .declarations(DECLARATIONS)
        .function("show", |args| {
            let key = args.string(0)?.to_string();
            let text = with_placeholders(args.string(1)?);
            DOCUMENTS.with(|d| {
                let mut documents = d.borrow_mut();
                if documents.get(&key).map(|t| t.as_ref()) != Some(text.as_str()) {
                    documents.insert(key, text.into());
                }
            });
            // The engine slot is drawn by the view that called; it draws again after this turn.
            gpui_shell::with_current(|window, _| window.refresh());
            Ok(HostValue::Null)
        })
        .function("release", |args| {
            let key = args.string(0)?.to_string();
            DOCUMENTS.with(|d| d.borrow_mut().remove(&key));
            Ok(HostValue::Null)
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn images_become_the_webs_placeholders_outside_code() {
        let text = "A ![logo](https://x.dev/a.png \"t\") and `![kept](b.png)`.\n\
                    ```\n![fenced](c.png)\n```\n\
                    ![](data:image/png;base64,AAA)\n    ![indented](d.png)\n";
        assert_eq!(
            with_placeholders(text),
            "A `[image: logo] https://x.dev/a.png` and `![kept](b.png)`.\n\
             ```\n![fenced](c.png)\n```\n\
             `[image] data URL`\n    ![indented](d.png)\n"
        );
    }

    #[test]
    fn a_long_address_is_cut_as_the_web_cuts_it() {
        let url = format!("https://x.dev/{}", "a".repeat(300));
        let shown = placeholder("", &url);
        assert_eq!(shown.chars().count(), "[image] ".len() + 200 + 1);
        assert!(shown.ends_with('…'));
    }
}

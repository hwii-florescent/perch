//! The window's frame, as `StockWindow.tsx` draws it: a sidebar card, a main card and a drawer card
//! on the theme's backdrop, each 12 px round, 8 px apart, with a 44 px head row. This module holds
//! the numbers the web keeps (`GUTTER`, the column bounds, the toggles' inset), which tab the
//! drawer shows and the two column widths, kept on this device in one small file as the web keeps
//! them in `localStorage` (`perch.workspaceTools`, `perch.layout.sidebarWidth`,
//! `perch.layout.toolsWidth`). `Workspace` draws the frame from it.

use crate::handoff::Place;
use crate::mods::theme::Theme;
use gpui::{
    canvas, div, point, prelude::*, px, rgb, App, CursorStyle, Div, FontWeight, IntoElement,
    MouseButton, MouseDownEvent, PathBuilder, Rgba, Stateful, Window,
};
use serde_json::{json, Value};
use std::path::PathBuf;

/// The open gutter between two cards, and around them at the window edge.
pub const GUTTER: f32 = 8.;
/// A card's head row.
pub const HEAD: f32 = 44.;
pub const CARD_RADIUS: f32 = 12.;
pub const SIDEBAR_DEFAULT: f32 = 240.;
pub const SIDEBAR_MIN: f32 = 180.;
pub const SIDEBAR_MAX: f32 = 480.;
pub const TOOLS_MIN: f32 = 280.;
/// The main card keeps at least this much while the drawer grows.
pub const MAIN_MIN: f32 = 320.;
/// Where the traffic lights sit (`glass.rs`): the close button's left edge, and its top so the
/// row of lights is centred in the first card's head (8 + 22 below the window top).
pub const LIGHTS_LEFT: f32 = 22.;
pub const LIGHTS_TOP: f32 = 23.;
/// The sidebar toggle's left inset on macOS, clear of the lights; a plain window has no lights.
pub const TOGGLE_INSET_MAC: f32 = 85.;
pub const TOGGLE_INSET: f32 = 12.;
/// What follows the sidebar toggle in the main card's head while the sidebar is collapsed.
pub const TOGGLE_AFTER: f32 = 3.;

/// The drawer's tabs.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tools {
    Files,
    Git,
    Browser,
}

impl Tools {
    pub const ALL: [Tools; 3] = [Tools::Files, Tools::Git, Tools::Browser];

    /// The name the web stores.
    fn key(self) -> &'static str {
        match self {
            Tools::Files => "files",
            Tools::Git => "gitReview",
            Tools::Browser => "browser",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Tools::Files => "Files",
            Tools::Git => "Git",
            Tools::Browser => "Browser",
        }
    }

    /// Where the Perch app opens for this tab.
    pub fn place(self) -> Place {
        match self {
            Tools::Files => Place::Files,
            Tools::Git => Place::Changes,
            Tools::Browser => Place::Browser,
        }
    }

    /// As `readTools`: any other stored word (an old "terminal" tab) is Files.
    fn parse(word: &str) -> Tools {
        match word {
            "gitReview" => Tools::Git,
            "browser" => Tools::Browser,
            _ => Tools::Files,
        }
    }
}

/// What the window keeps about its own frame.
#[derive(Debug, Default)]
pub struct Chrome {
    /// The drawer's tab, or `None` while it is closed; reopening shows `last`.
    tools: Option<Tools>,
    last: Option<Tools>,
    sidebar_width: Option<f32>,
    tools_width: Option<f32>,
    /// The file the three are kept in; without it they last as long as the window.
    file: Option<PathBuf>,
}

impl Chrome {
    /// Reads `file`, if it is there and whole; a missing or broken one is the defaults.
    pub fn kept_in(file: PathBuf) -> Self {
        let kept: Value = std::fs::read(&file)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default();
        let width = |key: &str| {
            kept[key]
                .as_f64()
                .filter(|v| v.is_finite() && *v > 0.)
                .map(|v| v as f32)
        };
        let tools = kept["tools"].as_str().map(Tools::parse);
        Self {
            tools,
            last: tools,
            sidebar_width: width("sidebarWidth"),
            tools_width: width("toolsWidth"),
            file: Some(file),
        }
    }

    pub fn tools(&self) -> Option<Tools> {
        self.tools
    }

    pub fn set_tools(&mut self, tab: Option<Tools>) {
        self.tools = tab;
        if tab.is_some() {
            self.last = tab;
        }
        self.keep();
    }

    pub fn toggle_drawer(&mut self) {
        let next = match self.tools {
            Some(_) => None,
            None => Some(self.last.unwrap_or(Tools::Files)),
        };
        self.set_tools(next);
    }

    /// The sidebar's width, within its bounds.
    pub fn sidebar(&self) -> f32 {
        self.sidebar_width
            .unwrap_or(SIDEBAR_DEFAULT)
            .clamp(SIDEBAR_MIN, SIDEBAR_MAX)
            .round()
    }

    /// The drawer's width: the stored one, else `min(760, 46%)` of the window, within `TOOLS_MIN`
    /// and what leaves the main card `MAIN_MIN` beside the sidebar (`sidebar` is its width, `None`
    /// while it is collapsed).
    pub fn tools_width(&self, window: f32, sidebar: Option<f32>) -> f32 {
        let wanted = self
            .tools_width
            .unwrap_or_else(|| 760f32.min((window * 0.46).round()));
        let most = (window - sidebar.unwrap_or(0.) - 4. * GUTTER - MAIN_MIN).max(TOOLS_MIN);
        wanted.clamp(TOOLS_MIN, most).round()
    }

    /// The bounds the drawer may be dragged within.
    pub fn tools_range(window: f32, sidebar: Option<f32>) -> (f32, f32) {
        (
            TOOLS_MIN,
            (window - sidebar.unwrap_or(0.) - 4. * GUTTER - MAIN_MIN).max(TOOLS_MIN),
        )
    }

    pub fn set_sidebar_width(&mut self, px: Option<f32>) {
        self.sidebar_width = px.map(|v| v.clamp(SIDEBAR_MIN, SIDEBAR_MAX).round());
    }

    pub fn set_tools_width(&mut self, px: Option<f32>) {
        self.tools_width = px.map(f32::round);
    }

    /// Writes what is kept. A failure is not the person's concern: the widths are a convenience,
    /// as the web's `localStorage` ones are.
    pub fn keep(&self) {
        let Some(file) = &self.file else { return };
        let mut kept = json!({});
        if let Some(tab) = self.tools {
            kept["tools"] = json!(tab.key());
        }
        if let Some(width) = self.sidebar_width {
            kept["sidebarWidth"] = json!(width);
        }
        if let Some(width) = self.tools_width {
            kept["toolsWidth"] = json!(width);
        }
        if let Some(dir) = file.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(file, kept.to_string());
    }
}

/// The theme tokens the frame draws with (`themes.ts`), as colours.
#[derive(Clone, Copy)]
pub struct Tokens {
    pub backdrop: Rgba,
    pub card: Rgba,
    pub surface_0: Rgba,
    pub surface_1: Rgba,
    pub overlay_1: Rgba,
    pub text: Rgba,
    pub subtext: Rgba,
    pub panel: Rgba,
    pub accent: Rgba,
    pub yellow: Rgba,
}

impl Tokens {
    pub fn of(theme: &Theme) -> Self {
        let token = |name: &str| {
            let hex = theme.token(name).unwrap_or("#000000");
            rgb(u32::from_str_radix(hex.trim_start_matches('#'), 16).unwrap_or(0))
        };
        Self {
            backdrop: token("backdrop"),
            card: token("card-bg"),
            surface_0: token("surface-0"),
            surface_1: token("surface-1"),
            overlay_1: token("overlay-1"),
            text: token("text"),
            subtext: token("subtext-0"),
            panel: token("panel-bg"),
            accent: token("accent"),
            yellow: token("yellow"),
        }
    }
}

/// A card: round, in the card colour. GPUI clips to a box, not to rounded corners, so what a mod
/// paints square into a corner (the start page's own fill) shows past the rounding unless the
/// card's last child is [`round_corners`].
pub fn card(tokens: Tokens) -> Div {
    div()
        .relative()
        .flex()
        .flex_col()
        .h_full()
        .overflow_hidden()
        .rounded(px(CARD_RADIUS))
        .bg(tokens.card)
}

/// The four corners of its box with the card's rounding cut away, in `color` (the backdrop's): the
/// last child of a [`card`].
pub fn round_corners(color: Rgba) -> impl IntoElement {
    canvas(
        |_, _, _| {},
        move |bounds, _, window, _| {
            let r = px(CARD_RADIUS);
            let corners = [
                (bounds.origin, 1., 1.),
                (bounds.top_right(), -1., 1.),
                (bounds.bottom_left(), 1., -1.),
                (bounds.bottom_right(), -1., -1.),
            ];
            for (corner, sx, sy) in corners {
                let mut piece = PathBuilder::fill();
                piece.move_to(corner);
                piece.line_to(point(corner.x + r * sx, corner.y));
                // From the card's edge to its other edge, round the way the card is: the arc's
                // centre is `r` in from both.
                piece.arc_to(
                    point(r, r),
                    px(0.),
                    false,
                    sx * sy < 0.,
                    point(corner.x, corner.y + r * sy),
                );
                piece.close();
                if let Ok(piece) = piece.build() {
                    window.paint_path(piece, color);
                }
            }
        },
    )
    .absolute()
    .top_0()
    .left_0()
    .size_full()
}

/// A card's head row.
pub fn head() -> Div {
    div().flex().flex_none().items_center().h(px(HEAD))
}

/// What a press on the empty part of a head does: it drags the window, and a double press zooms it
/// as a title bar's does. Whatever sits on it and takes presses stops them first.
pub fn drags_window(element: Div) -> Div {
    element.on_mouse_down(MouseButton::Left, |event, window, _| {
        if event.click_count == 2 {
            window.titlebar_double_click();
        } else {
            window.start_window_move();
        }
    })
}

/// The sidebar and drawer glyph (the web's 16 px SVG): a rounded rectangle cut by a vertical line,
/// at 6 for the sidebar and 10 for the drawer.
fn panel_glyph(line: f32, color: Rgba) -> Div {
    div()
        .relative()
        .flex_none()
        .size(px(16.))
        .child(
            div()
                .absolute()
                .left(px(0.85))
                .top(px(1.85))
                .w(px(14.3))
                .h(px(12.3))
                .rounded(px(2.65))
                .border(px(1.3))
                .border_color(color),
        )
        .child(
            div()
                .absolute()
                .left(px(line - 0.65))
                .top(px(2.5))
                .w(px(1.3))
                .h(px(11.))
                .bg(color),
        )
}

/// A 28 px button that blends into the head and fills only on hover (`ICON_BUTTON`).
fn icon_button(id: &'static str, tokens: Tokens) -> Stateful<Div> {
    div()
        .id(id)
        .relative()
        .flex()
        .flex_none()
        .items_center()
        .justify_center()
        .size(px(28.))
        .rounded(px(8.))
        .cursor_pointer()
        .text_color(tokens.subtext)
        .hover(move |style| style.bg(tokens.surface_1).text_color(tokens.text))
        // The head under it drags the window: a press here is the button's.
        .on_mouse_down(MouseButton::Left, |_, _, cx| cx.stop_propagation())
}

/// The sidebar toggle. While the sidebar is collapsed, the count of chats that need you rides on
/// it.
pub fn sidebar_toggle(
    tokens: Tokens,
    collapsed: bool,
    needs: usize,
    on_click: impl Fn(&mut Window, &mut App) + 'static,
) -> Stateful<Div> {
    let button = icon_button("sidebar-collapse-toggle", tokens)
        .child(panel_glyph(6., tokens.subtext))
        .on_click(move |_, window, cx| on_click(window, cx));
    if collapsed && needs > 0 {
        button.child(
            div()
                .absolute()
                .top(px(-4.))
                .right(px(-4.))
                .flex()
                .items_center()
                .justify_center()
                .h(px(14.))
                .min_w(px(14.))
                .px(px(3.))
                .rounded_full()
                .bg(tokens.yellow)
                .text_color(tokens.panel)
                .text_size(px(9.))
                .line_height(px(9.))
                .font_weight(FontWeight::SEMIBOLD)
                .child(needs.to_string()),
        )
    } else {
        button
    }
}

/// The drawer toggle.
pub fn drawer_toggle(
    tokens: Tokens,
    on_click: impl Fn(&mut Window, &mut App) + 'static,
) -> Stateful<Div> {
    icon_button("workspace-tools-toggle", tokens)
        .child(panel_glyph(10., tokens.subtext))
        .on_click(move |_, window, cx| on_click(window, cx))
}

/// One of the drawer's tabs (`WorkspaceToolsTabs`): a 28 px pill that fills while it is the one
/// shown.
pub fn tools_tab(
    tab: Tools,
    active: bool,
    tokens: Tokens,
    on_click: impl Fn(&mut Window, &mut App) + 'static,
) -> Stateful<Div> {
    let id = match tab {
        Tools::Files => "workspace-tools-files",
        Tools::Git => "workspace-tools-gitReview",
        Tools::Browser => "workspace-tools-browser",
    };
    div()
        .id(id)
        .flex()
        .items_center()
        .h(px(28.))
        .px(px(12.8))
        .rounded(px(8.))
        .cursor_pointer()
        .text_size(px(12.))
        .when(active, |d| d.bg(tokens.surface_1).text_color(tokens.text))
        .when(!active, |d| {
            d.text_color(tokens.subtext)
                .hover(move |style| style.bg(tokens.surface_0).text_color(tokens.text))
        })
        .on_mouse_down(MouseButton::Left, |_, _, cx| cx.stop_propagation())
        .on_click(move |_, window, cx| on_click(window, cx))
        .child(tab.label())
}

/// The 8 px gutter between a column and the main card, which resizes the column: a short pill
/// shows on hover and while it is dragged (`ResizeHandle.tsx`).
pub fn resize_handle(
    id: &'static str,
    active: bool,
    tokens: Tokens,
    on_press: impl Fn(&MouseDownEvent, &mut Window, &mut App) + 'static,
) -> Stateful<Div> {
    div()
        .id(id)
        .group(id)
        .relative()
        .flex_none()
        .w(px(GUTTER))
        .h_full()
        .cursor(CursorStyle::ResizeLeftRight)
        .on_mouse_down(MouseButton::Left, move |event, window, cx| {
            on_press(event, window, cx);
            cx.stop_propagation();
        })
        .child(
            div()
                .absolute()
                .top_0()
                .bottom_0()
                .left(px((GUTTER - 3.) / 2.))
                .my_auto()
                .h(px(48.))
                .w(px(3.))
                .rounded_full()
                .when(active, |d| d.bg(tokens.accent))
                .group_hover(id, move |style| {
                    style.bg(if active {
                        tokens.accent
                    } else {
                        tokens.overlay_1
                    })
                }),
        )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_drawer_opens_on_the_tab_it_last_showed() {
        let mut chrome = Chrome::default();
        assert_eq!(chrome.tools(), None);
        chrome.toggle_drawer();
        assert_eq!(chrome.tools(), Some(Tools::Files));
        chrome.set_tools(Some(Tools::Browser));
        chrome.toggle_drawer();
        assert_eq!(chrome.tools(), None);
        chrome.toggle_drawer();
        assert_eq!(chrome.tools(), Some(Tools::Browser));
    }

    #[test]
    fn widths_follow_the_web_bounds() {
        let mut chrome = Chrome::default();
        assert_eq!(chrome.sidebar(), 240.);
        chrome.set_sidebar_width(Some(9000.));
        assert_eq!(chrome.sidebar(), 480.);
        chrome.set_sidebar_width(Some(10.));
        assert_eq!(chrome.sidebar(), 180.);
        // 46% of the window, at most 760.
        let chrome = Chrome::default();
        assert_eq!(chrome.tools_width(1100., Some(240.)), 506.);
        // ...less than the main card needs: 1000 - 240 - 32 - 320.
        assert_eq!(chrome.tools_width(1000., Some(240.)), 408.);
        assert_eq!(chrome.tools_width(2400., None), 760.);
        // The main card keeps 320 beside two gutters per card: 700 - 240 - 32 - 320.
        let mut chrome = Chrome::default();
        chrome.set_tools_width(Some(600.));
        assert_eq!(chrome.tools_width(700., Some(240.)), 280.);
        assert_eq!(chrome.tools_width(1100., Some(240.)), 508.);
    }

    #[test]
    fn the_tab_and_widths_are_kept_between_runs_and_a_broken_file_is_defaults() {
        let dir = std::env::temp_dir().join(format!("perch-shell-{}", std::process::id()));
        let file = dir.join("window.json");
        let mut chrome = Chrome::kept_in(file.clone());
        chrome.set_sidebar_width(Some(300.));
        chrome.set_tools_width(Some(500.));
        chrome.set_tools(Some(Tools::Git));
        let again = Chrome::kept_in(file.clone());
        assert_eq!(again.tools(), Some(Tools::Git));
        assert_eq!(again.sidebar(), 300.);
        assert_eq!(again.tools_width(1400., Some(300.)), 500.);
        std::fs::write(&file, "{not json").unwrap();
        let broken = Chrome::kept_in(file);
        assert_eq!(broken.tools(), None);
        assert_eq!(broken.sidebar(), 240.);
        let _ = std::fs::remove_dir_all(dir);
    }
}

//! PERCH: what a test needs to compare a script's elements with another renderer's: for each
//! element the script named with `.id("...")`, its laid-out box in logical pixels, its resolved
//! colours and its font. Only with the `render-test-support` feature.
//!
//! Every named node is wrapped in [`Probe`], which lays out exactly as the element it wraps (it
//! hands back the inner layout id) and, when GPUI prepaints it, records the box GPUI gave it and
//! the style the script set on it, resolved against the text style it inherits there. Records
//! accumulate on the thread until [`clear`]; a frame GPUI replays from its view cache prepaints
//! nothing, so call `window.refresh()` before the draw a test reads.

use std::{cell::RefCell, collections::BTreeMap};

use gpui::{
    AbsoluteLength, AnyElement, App, Bounds, Element, ElementId, FontStyle, FontWeight,
    GlobalElementId, Hsla, InspectorElementId, IntoElement, LayoutId, Pixels, Refineable,
    SharedString, StyleRefinement, Window,
};

/// One named element as GPUI last laid it out.
#[derive(Clone, Debug, PartialEq)]
pub struct ProbeRecord {
    /// The name the script gave with `.id(...)`.
    pub name: SharedString,
    /// Its box, in logical pixels from the window's top left.
    pub bounds: Bounds<Pixels>,
    /// Its own background, when it sets a solid one.
    pub background: Option<Hsla>,
    /// Its own border colour, when it sets one.
    pub border_color: Option<Hsla>,
    /// Its border widths (top, right, bottom, left), resolved.
    pub border_widths: [Pixels; 4],
    /// Its corner radii (top left, top right, bottom right, bottom left), resolved.
    pub corner_radii: [Pixels; 4],
    /// The text style its text is drawn with: inherited, then refined by its own.
    pub text_color: Hsla,
    pub font_family: SharedString,
    pub font_size: Pixels,
    pub font_weight: FontWeight,
    pub font_style: FontStyle,
    /// The line height GPUI draws: the requested one rounded to whole pixels.
    pub line_height: Pixels,
    /// PERCH: the line height the style asks for, before GPUI's rounding.
    pub line_height_requested: Pixels,
    /// Its own opacity, when it sets one.
    pub opacity: Option<f32>,
}

thread_local! {
    static RECORDS: RefCell<BTreeMap<SharedString, ProbeRecord>> = const { RefCell::new(BTreeMap::new()) };
    static NAMED: std::cell::Cell<bool> = const { std::cell::Cell::new(true) };
}

/// Whether scripts name their elements for the probe ([`crate::probing`]); on by default.
pub fn named() -> bool {
    NAMED.with(std::cell::Cell::get)
}

/// Turns naming off (a test timing what a release build does) or back on.
pub fn set_named(on: bool) {
    NAMED.with(|named| named.set(on));
}

/// Forgets every record.
pub fn clear() {
    RECORDS.with(|records| records.borrow_mut().clear());
}

/// The last record for each name, by name.
pub fn records() -> BTreeMap<SharedString, ProbeRecord> {
    RECORDS.with(|records| records.borrow().clone())
}

/// The last record for `name`.
pub fn record(name: &str) -> Option<ProbeRecord> {
    RECORDS.with(|records| records.borrow().get(name).cloned())
}

/// Wraps a named node so its layout is recorded.
pub(crate) fn wrap(name: SharedString, style: StyleRefinement, element: AnyElement) -> AnyElement {
    Probe { name, style: Box::new(style), element }.into_any_element()
}

pub(crate) struct Probe {
    name: SharedString,
    style: Box<StyleRefinement>,
    element: AnyElement,
}

impl IntoElement for Probe {
    type Element = Self;

    fn into_element(self) -> Self {
        self
    }
}

impl Element for Probe {
    type RequestLayoutState = ();
    type PrepaintState = ();

    fn id(&self) -> Option<ElementId> {
        None
    }

    fn source_location(&self) -> Option<&'static core::panic::Location<'static>> {
        None
    }

    fn request_layout(
        &mut self,
        _: Option<&GlobalElementId>,
        _: Option<&InspectorElementId>,
        window: &mut Window,
        cx: &mut App,
    ) -> (LayoutId, ()) {
        (self.element.request_layout(window, cx), ())
    }

    fn prepaint(
        &mut self,
        _: Option<&GlobalElementId>,
        _: Option<&InspectorElementId>,
        bounds: Bounds<Pixels>,
        _: &mut (),
        window: &mut Window,
        cx: &mut App,
    ) {
        let style = &self.style;
        let mut text = window.text_style();
        text.refine(&style.text);
        let rem = window.rem_size();
        let px = |length: Option<AbsoluteLength>| length.map_or(Pixels::ZERO, |l| l.to_pixels(rem));
        let (widths, radii) = (&style.border_widths, &style.corner_radii);
        let record = ProbeRecord {
            name: self.name.clone(),
            bounds,
            background: style
                .background
                .as_ref()
                .and_then(|fill| fill.color())
                .and_then(|background| background.as_solid()),
            border_color: style.border_color,
            border_widths: [px(widths.top), px(widths.right), px(widths.bottom), px(widths.left)],
            corner_radii: [
                px(radii.top_left),
                px(radii.top_right),
                px(radii.bottom_right),
                px(radii.bottom_left),
            ],
            text_color: text.color,
            font_family: text.font_family.clone(),
            font_size: text.font_size.to_pixels(rem),
            font_weight: text.font_weight,
            font_style: text.font_style,
            line_height: text.line_height_in_pixels(rem),
            line_height_requested: text.line_height.to_pixels(text.font_size, rem),
            opacity: style.opacity,
        };
        RECORDS.with(|records| records.borrow_mut().insert(self.name.clone(), record));
        self.element.prepaint(window, cx);
    }

    fn paint(
        &mut self,
        _: Option<&GlobalElementId>,
        _: Option<&InspectorElementId>,
        _: Bounds<Pixels>,
        _: &mut (),
        _: &mut (),
        window: &mut Window,
        cx: &mut App,
    ) {
        self.element.paint(window, cx);
    }
}

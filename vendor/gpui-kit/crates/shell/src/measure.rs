//! PERCH: where an element a script asked about was last laid out. An element given
//! `.measure(key)` is wrapped in [`Measure`], which lays out exactly as the element it wraps (it
//! hands back the inner layout id) and, when GPUI prepaints it, keeps the box GPUI gave it under
//! `key`. A host reads it with [`bounds`] and lets keys go with [`forget`]. Elements without
//! `.measure` are not wrapped and cost nothing. A frame GPUI replays from its view cache
//! prepaints nothing, so the box kept is the one from the last frame that laid the element out,
//! which is where it still is.

use std::{cell::RefCell, collections::HashMap};

use gpui::{
    AnyElement, App, Bounds, Element, ElementId, GlobalElementId, InspectorElementId,
    IntoElement, LayoutId, Pixels, SharedString, Window,
};

thread_local! {
    static BOXES: RefCell<HashMap<SharedString, Bounds<Pixels>>> = RefCell::new(HashMap::new());
}

/// The box the element measured as `key` was last laid out in: logical pixels from the window's
/// top left. None before it has been laid out.
pub fn bounds(key: &str) -> Option<Bounds<Pixels>> {
    BOXES.with(|boxes| boxes.borrow().get(key).copied())
}

/// Forgets every box whose key starts with `prefix` (the elements of a tree that went away).
pub fn forget(prefix: &str) {
    BOXES.with(|boxes| boxes.borrow_mut().retain(|key, _| !key.starts_with(prefix)));
}

/// Wraps `element` so its box is kept under `key`.
pub(crate) fn wrap(key: SharedString, element: AnyElement) -> AnyElement {
    Measure { key, element }.into_any_element()
}

pub(crate) struct Measure {
    key: SharedString,
    element: AnyElement,
}

impl IntoElement for Measure {
    type Element = Self;

    fn into_element(self) -> Self {
        self
    }
}

impl Element for Measure {
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
        BOXES.with(|boxes| boxes.borrow_mut().insert(self.key.clone(), bounds));
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

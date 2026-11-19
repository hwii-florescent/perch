//! PERCH: where an element a script asked about was last laid out. An element given
//! `.measure(key)` is wrapped in [`Measure`], which lays out exactly as the element it wraps (it
//! hands back the inner layout id) and, when GPUI prepaints it, keeps the box GPUI gave it under
//! `key`. A host reads it with [`bounds`] and lets keys go with [`forget`]. Elements without
//! `.measure` are not wrapped and cost nothing. A frame GPUI replays from its view cache
//! prepaints nothing, so the box kept is the one from the last frame that laid the element out,
//! which is where it still is.
//!
//! Boxes are kept per script copy, by the policy its views run under (each load of a script
//! gets its own): a view's elements are kept under the policy of the view that drew them
//! ([`drawing`]), and a script reads and forgets only under its own ([`crate::scope::policy`]).
//! So one copy can neither read nor overwrite another's boxes, and a copy's boxes go once its
//! policy has gone (the copy closed), at the next frame that keeps a box.

use std::{
    cell::{Cell, RefCell},
    collections::HashMap,
    rc::{Rc, Weak},
};

use gpui::{
    AnyElement, App, Bounds, Element, ElementId, GlobalElementId, InspectorElementId, IntoElement,
    LayoutId, Pixels, SharedString, Window,
};

use crate::policy::Policy;

/// A copy's boxes, with the policy that tells the copy apart (and whether it is still open).
type Kept = (Weak<Policy>, HashMap<SharedString, Bounds<Pixels>>);

thread_local! {
    /// By the policy's address; the weak handle confirms the address is still that policy.
    static BOXES: RefCell<HashMap<usize, Kept>> = RefCell::new(HashMap::new());
    /// The policy of the view being drawn now, whose measured elements are its own.
    static DRAWING: RefCell<Option<Weak<Policy>>> = const { RefCell::new(None) };
}

fn owner(policy: &Rc<Policy>) -> usize {
    Rc::as_ptr(policy) as usize
}

/// Runs `draw` (a view's materialize) with the elements it measures kept under `policy`.
pub(crate) fn drawing<R>(policy: &Rc<Policy>, draw: impl FnOnce() -> R) -> R {
    let outer = DRAWING.with(|d| d.replace(Some(Rc::downgrade(policy))));
    let result = draw();
    DRAWING.with(|d| *d.borrow_mut() = outer);
    result
}

/// The box the element the calling script measured as `key` was last laid out in: logical pixels
/// from the window's top left. None before it has been laid out, or outside a script.
pub fn bounds(key: &str) -> Option<Bounds<Pixels>> {
    let policy = crate::scope::current_policy()?;
    BOXES.with(|boxes| {
        let boxes = boxes.borrow();
        let (kept, keys) = boxes.get(&owner(&policy))?;
        Weak::ptr_eq(kept, &Rc::downgrade(&policy))
            .then(|| keys.get(key).copied())
            .flatten()
    })
}

/// Forgets every box of the calling script whose key starts with `prefix` (the elements of a
/// tree that went away).
pub fn forget(prefix: &str) {
    let Some(policy) = crate::scope::current_policy() else {
        return;
    };
    BOXES.with(|boxes| {
        if let Some((_, keys)) = boxes.borrow_mut().get_mut(&owner(&policy)) {
            keys.retain(|key, _| !key.starts_with(prefix));
        }
    });
}

/// How many boxes are kept, across every copy (for a test that a closed copy's go).
pub fn kept() -> usize {
    BOXES.with(|boxes| boxes.borrow().values().map(|(_, keys)| keys.len()).sum())
}

/// Wraps `element` so its box is kept under `key` for the view being drawn. Outside a view's
/// drawing there is no copy to keep it for, and the element is left as it is.
pub(crate) fn wrap(key: SharedString, element: AnyElement) -> AnyElement {
    match DRAWING.with(|d| d.borrow().clone()) {
        Some(policy) => Measure {
            policy,
            key,
            element,
        }
        .into_any_element(),
        None => element,
    }
}

fn keep(policy: &Weak<Policy>, key: &SharedString, bounds: Bounds<Pixels>) {
    let Some(strong) = policy.upgrade() else {
        return;
    };
    BOXES.with(|boxes| {
        let mut boxes = boxes.borrow_mut();
        // A copy whose policy has gone has closed: its boxes go with it.
        boxes.retain(|_, (kept, _)| kept.strong_count() > 0);
        let entry = boxes
            .entry(owner(&strong))
            .or_insert_with(|| (policy.clone(), HashMap::new()));
        if !Weak::ptr_eq(&entry.0, policy) {
            *entry = (policy.clone(), HashMap::new());
        }
        entry.1.insert(key.clone(), bounds);
    });
}

pub(crate) struct Measure {
    policy: Weak<Policy>,
    key: SharedString,
    element: AnyElement,
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
        keep(&self.policy, &self.key, bounds);
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

/// Wraps `element` so the box it is given is written to `seen` when GPUI prepaints it, for an
/// element's pointer listeners. It lays out as the element it wraps, so unlike a canvas child
/// it adds nothing to the element's scrollable content.
pub(crate) fn observe(seen: Rc<Cell<Option<Bounds<Pixels>>>>, element: AnyElement) -> AnyElement {
    Observe { seen, element }.into_any_element()
}

struct Observe {
    seen: Rc<Cell<Option<Bounds<Pixels>>>>,
    element: AnyElement,
}


impl Element for Observe {
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
        self.seen.set(Some(bounds));
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

//! A tab drag's geometry, as the web's (`tabDrag.ts`, `slideDrag.ts`): a press becomes a drag
//! after a few pixels; on the strip the drop is a slot in it, on a pane the side nearest the
//! pointer (the middle of a pane does nothing). The window owns the drag (`Workspace`): it follows
//! the pointer, draws the `tab-drag` screen and makes the move or split once the tab is let go.
//! Escape, the window losing focus or the tab closing ends it with nothing changed.

use crate::tabs::Side;
use gpui::{point, Bounds, Pixels, Point};
use serde_json::{json, Value};

/// Movement before a press becomes a drag, so a click never reorders (`DRAG_START_PX`).
pub const START: f32 = 5.;

/// The middle of a pane, as a fraction of each side, where a drop does nothing (`CENTER`).
const CENTER: f32 = 0.2;

/// A tab entry of the strip as the strip laid it out: its id and its left and right edges.
#[derive(Clone, Debug, PartialEq)]
pub struct Span {
    pub id: String,
    pub start: f32,
    pub end: f32,
}

/// Where a drop lands.
#[derive(Clone, Debug, PartialEq)]
pub enum Drop {
    /// On the strip: slot `index` (0 is first); `None` where the tab already is.
    Strip(Option<usize>),
    /// On `target`'s pane (`pane` its box): the side a split takes, `None` when that pane cannot
    /// take the tab (`blocked`).
    Pane {
        target: String,
        pane: Bounds<Pixels>,
        side: Option<Side>,
    },
    /// Nowhere: a release changes nothing.
    None,
}

/// A press on tab `id` that may become a drag.
#[derive(Clone, Debug)]
pub struct TabDrag {
    pub id: String,
    pub label: String,
    pub start: Point<Pixels>,
    pub at: Point<Pixels>,
    /// The strip's tabs as they were when the press began.
    pub spans: Vec<Span>,
    /// The press moved far enough to be a drag.
    pub started: bool,
    pub drop: Drop,
}

impl TabDrag {
    pub fn new(id: String, label: String, start: Point<Pixels>, spans: Vec<Span>) -> Self {
        Self {
            id,
            label,
            start,
            at: start,
            spans,
            started: false,
            drop: Drop::None,
        }
    }

    /// The pointer moved to `at`: whether the press is (now) a drag.
    pub fn moved(&mut self, at: Point<Pixels>) -> bool {
        self.at = at;
        if !self.started {
            let (dx, dy) = (
                f32::from(at.x - self.start.x),
                f32::from(at.y - self.start.y),
            );
            self.started = dx.hypot(dy) >= START;
        }
        self.started
    }

    /// The slot the tab lands in with the pointer at `x` on the strip; `None` where it is.
    pub fn slot(&self, x: f32) -> Option<usize> {
        let from = self.spans.iter().position(|s| s.id == self.id)?;
        let to = slot_index(&self.spans, from, x);
        (to != from).then_some(to)
    }

    /// What the web's `TabDragLayer` hands its screen (`TabDragProps.drag`). The ghost (`look`)
    /// is a copy of the tab's markup in the web, which a native screen cannot draw: none.
    pub fn props(&self) -> Value {
        let rect = |b: Bounds<Pixels>| {
            json!({ "left": f32::from(b.origin.x), "top": f32::from(b.origin.y),
                    "width": f32::from(b.size.width), "height": f32::from(b.size.height) })
        };
        let drop = match &self.drop {
            Drop::Pane { pane, side, .. } => json!({
                "pane": rect(*pane),
                "zone": side.map(Side::word),
                "box": rect(side.map_or(*pane, |s| zone_box(*pane, s))),
            }),
            _ => Value::Null,
        };
        json!({ "drag": {
            "id": self.id, "label": self.label,
            "x": f32::from(self.at.x), "y": f32::from(self.at.y),
            "overStrip": matches!(self.drop, Drop::Strip(_)),
            "look": Value::Null,
            "drop": drop,
        }})
    }
}

/// The slot (0..n-1 in the final list) the item at `from` lands in when its center is at
/// `point`: how many of the other items' centers lie before it (`slotIndex`).
pub fn slot_index(spans: &[Span], from: usize, point: f32) -> usize {
    spans
        .iter()
        .enumerate()
        .filter(|(i, s)| *i != from && (s.start + s.end) / 2. < point)
        .count()
}

/// The side of `pane` nearest `at` (the diagonal quadrants), `None` in the middle
/// (`resolveZone`).
pub fn resolve_zone(pane: Bounds<Pixels>, at: Point<Pixels>) -> Option<Side> {
    let (w, h) = (f32::from(pane.size.width), f32::from(pane.size.height));
    if w <= 0. || h <= 0. {
        return None;
    }
    let dx = f32::from(at.x - pane.origin.x) / w - 0.5;
    let dy = f32::from(at.y - pane.origin.y) / h - 0.5;
    if dx.abs() < CENTER && dy.abs() < CENTER {
        return None;
    }
    Some(if dx.abs() >= dy.abs() {
        if dx < 0. {
            Side::Left
        } else {
            Side::Right
        }
    } else if dy < 0. {
        Side::Up
    } else {
        Side::Down
    })
}

/// The half of `pane` a split on `side` would take (`zoneBox`).
pub fn zone_box(pane: Bounds<Pixels>, side: Side) -> Bounds<Pixels> {
    let mut half = pane;
    let (w, h) = (pane.size.width / 2., pane.size.height / 2.);
    match side {
        Side::Left => half.size.width = w,
        Side::Right => {
            half.origin = point(pane.origin.x + w, pane.origin.y);
            half.size.width = w;
        }
        Side::Up => half.size.height = h,
        Side::Down => {
            half.origin = point(pane.origin.x, pane.origin.y + h);
            half.size.height = h;
        }
    }
    half
}

/// The strip's tab entries from a `tab.beginDrag` request (`[{id, left, width}]`), in order;
/// those with no box yet are left out.
pub fn spans_from(entries: &Value) -> Vec<Span> {
    entries
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|e| {
            let id = e["id"].as_str()?.to_string();
            let left = e["left"].as_f64()? as f32;
            let width = e["width"].as_f64()? as f32;
            (width > 0.).then_some(Span {
                id,
                start: left,
                end: left + width,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use gpui::{bounds, px, size};

    fn at(x: f32, y: f32) -> Point<Pixels> {
        point(px(x), px(y))
    }

    fn spans() -> Vec<Span> {
        ["a", "b", "c"]
            .iter()
            .enumerate()
            .map(|(i, id)| Span {
                id: id.to_string(),
                start: i as f32 * 100.,
                end: i as f32 * 100. + 90.,
            })
            .collect()
    }

    #[test]
    fn a_press_is_a_drag_after_five_pixels() {
        let mut drag = TabDrag::new("a".into(), "A".into(), at(10., 10.), spans());
        assert!(!drag.moved(at(13., 13.)), "4.2 px is still a press");
        assert!(drag.moved(at(14., 13.)), "5 px is a drag");
        assert!(drag.moved(at(10., 10.)), "and stays one");
    }

    #[test]
    fn the_slot_is_the_count_of_centers_passed() {
        let drag = TabDrag::new("a".into(), "A".into(), at(0., 0.), spans());
        assert_eq!(drag.slot(40.), None, "where it is");
        assert_eq!(drag.slot(150.), Some(1), "past b's center");
        assert_eq!(drag.slot(400.), Some(2), "past the last is the end");
        let drag = TabDrag::new("c".into(), "C".into(), at(0., 0.), spans());
        assert_eq!(drag.slot(0.), Some(0));
        assert_eq!(slot_index(&spans(), 1, 44.), 0, "before a's center");
    }

    #[test]
    fn a_pane_splits_on_the_nearest_side_and_not_in_its_middle() {
        let pane = bounds(at(100., 100.), size(px(200.), px(100.)));
        assert_eq!(resolve_zone(pane, at(200., 150.)), None);
        assert_eq!(resolve_zone(pane, at(110., 150.)), Some(Side::Left));
        assert_eq!(resolve_zone(pane, at(290., 150.)), Some(Side::Right));
        assert_eq!(resolve_zone(pane, at(200., 105.)), Some(Side::Up));
        assert_eq!(resolve_zone(pane, at(200., 195.)), Some(Side::Down));
        assert_eq!(
            zone_box(pane, Side::Right),
            bounds(at(200., 100.), size(px(100.), px(100.)))
        );
        assert_eq!(
            zone_box(pane, Side::Down),
            bounds(at(100., 150.), size(px(200.), px(50.)))
        );
    }
}

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
    /// The ghost a drag off the strip shows: the tab's own markup as the strip's runtime copied
    /// it, with its size and where on it the press was (`TabDragState.look`); null without one.
    pub look: Value,
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
            look: Value::Null,
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

    /// Where in `strip` (the window's tabs now, 1 is first, as `Tabs::move_tab` takes it) a drop
    /// on `slot` puts the tab: beside the tab the strip showed there when the press began, so a
    /// tab the strip did not lay out, or one that opened or moved since, does not shift it.
    /// `None` when the tab or that neighbour is gone from `strip`.
    pub fn landing(&self, slot: usize, strip: &[String]) -> Option<usize> {
        let others: Vec<&str> = self
            .spans
            .iter()
            .map(|s| s.id.as_str())
            .filter(|id| *id != self.id)
            .collect();
        let rest: Vec<&String> = strip.iter().filter(|id| **id != self.id).collect();
        if rest.len() == strip.len() {
            return None;
        }
        let at = |id: &str| rest.iter().position(|r| *r == id);
        let index = match slot.checked_sub(1) {
            None => at(others.first()?)?,
            Some(before) => at(others.get(before)?)? + 1,
        };
        Some(index + 1)
    }

    /// What the strip draws while this is a drag (`tabSlide()`): over the strip the tabs slide
    /// aside for the slot under the pointer and the dragged one follows it; off it they rest.
    /// Null while it is still a press.
    pub fn slide(&self) -> Value {
        let Some(from) = self
            .spans
            .iter()
            .position(|s| s.id == self.id)
            .filter(|_| self.started)
        else {
            return Value::Null;
        };
        let over = matches!(self.drop, Drop::Strip(_));
        let offsets = match self.drop {
            Drop::Strip(slot) => {
                let delta = f32::from(self.at.x - self.start.x);
                slide_offsets(&self.spans, from, slot.unwrap_or(from), delta)
            }
            _ => vec![0.; self.spans.len()],
        };
        let offsets: Vec<Value> = self
            .spans
            .iter()
            .zip(offsets)
            .map(|(s, px)| json!({ "id": s.id, "px": px }))
            .collect();
        json!({ "id": self.id, "overStrip": over, "offsets": offsets })
    }

    /// What the web's `TabDragLayer` hands its screen (`TabDragProps.drag`).
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
            "look": self.look,
            "drop": drop,
        }})
    }
}

/// Each span's offset along the strip while the one at `from` is dragged to slot `to` by
/// `delta` (`slideOffsets`): the spans it passes shift by its size plus the gap, toward the slot
/// it leaves; the dragged one follows the pointer, kept inside the strip.
pub fn slide_offsets(spans: &[Span], from: usize, to: usize, delta: f32) -> Vec<f32> {
    let mut out = vec![0.; spans.len()];
    let Some(dragged) = spans.get(from) else {
        return out;
    };
    let gap = match (
        spans.get(from + 1),
        from.checked_sub(1).and_then(|i| spans.get(i)),
    ) {
        (Some(next), _) => next.start - dragged.end,
        (None, Some(prev)) => dragged.start - prev.end,
        (None, None) => 0.,
    };
    let shift = dragged.end - dragged.start + gap;
    for (i, offset) in out.iter_mut().enumerate() {
        if from < to && i > from && i <= to {
            *offset = -shift;
        } else if to < from && i >= to && i < from {
            *offset = shift;
        }
    }
    let (first, last) = (&spans[0], &spans[spans.len() - 1]);
    out[from] = delta
        .max(first.start - dragged.start)
        .min(last.end - dragged.end);
    out
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

/// The ghost from a `tab.beginDrag` request (`{html, width, height, dx, dy}`), or null when it
/// is not one: markup text and a box that is there.
pub fn look_from(look: &Value) -> Value {
    let number = |key: &str| look[key].as_f64().filter(|v| v.is_finite());
    let sized = number("width")
        .zip(number("height"))
        .is_some_and(|(w, h)| w > 0. && h > 0.);
    if look["html"].is_string() && sized && number("dx").is_some() && number("dy").is_some() {
        json!({
            "html": look["html"], "width": look["width"], "height": look["height"],
            "dx": look["dx"], "dy": look["dy"],
        })
    } else {
        Value::Null
    }
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
    fn a_drop_lands_beside_the_tab_the_strip_showed_there() {
        let strip = |ids: &[&str]| ids.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        let drag = TabDrag::new("c".into(), "C".into(), at(0., 0.), spans());
        assert_eq!(drag.landing(0, &strip(&["a", "b", "c"])), Some(1));
        assert_eq!(drag.landing(1, &strip(&["a", "b", "c"])), Some(2));
        // A tab the strip did not lay out (`x`) stays before a, where it was: c goes before a.
        assert_eq!(drag.landing(0, &strip(&["x", "a", "b", "c"])), Some(2));
        // The strip changed since the press (b moved first): c still lands after a.
        assert_eq!(drag.landing(1, &strip(&["b", "a", "c"])), Some(3));
        let drag = TabDrag::new("a".into(), "A".into(), at(0., 0.), spans());
        assert_eq!(
            drag.landing(2, &strip(&["a", "b", "c", "y"])),
            Some(3),
            "after c"
        );
        assert_eq!(drag.landing(2, &strip(&["a", "b"])), None, "c is gone");
        assert_eq!(drag.landing(1, &strip(&["b", "c"])), None, "a is gone");
    }

    #[test]
    fn the_tabs_passed_slide_aside_and_the_dragged_one_follows() {
        // a b c, 90 px wide with 10 px gaps: a dragged past c shifts b and c left by 100.
        assert_eq!(slide_offsets(&spans(), 0, 2, 230.), [200., -100., -100.]);
        assert_eq!(slide_offsets(&spans(), 2, 0, -150.), [100., 100., -150.]);
        assert_eq!(slide_offsets(&spans(), 1, 1, 7.), [0., 7., 0.]);
        // The dragged one stays inside the strip.
        assert_eq!(slide_offsets(&spans(), 0, 2, 900.)[0], 200.);
        assert_eq!(slide_offsets(&spans(), 0, 0, -50.)[0], 0.);
        let mut drag = TabDrag::new("a".into(), "A".into(), at(10., 10.), spans());
        assert!(drag.slide().is_null(), "a press slides nothing");
        drag.moved(at(160., 10.));
        drag.drop = Drop::Strip(drag.slot(160.));
        assert_eq!(
            drag.slide()["offsets"][1],
            json!({ "id": "b", "px": -100. })
        );
        drag.drop = Drop::None;
        assert_eq!(drag.slide()["overStrip"], false);
        assert_eq!(
            drag.slide()["offsets"][0]["px"],
            0.,
            "off the strip the tabs rest"
        );
    }

    #[test]
    fn a_ghost_is_markup_with_a_box() {
        let look =
            json!({ "html": "x", "width": 256, "height": 32, "dx": 60, "dy": 14, "more": 1 });
        assert_eq!(look_from(&look)["width"], 256);
        assert!(
            look_from(&look).get("more").is_none(),
            "only the ghost's fields"
        );
        assert!(
            look_from(&json!({ "html": "x", "width": 0, "height": 32, "dx": 0, "dy": 0 }))
                .is_null()
        );
        assert!(look_from(&json!({ "width": 9, "height": 9, "dx": 0, "dy": 0 })).is_null());
        assert!(look_from(&Value::Null).is_null());
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

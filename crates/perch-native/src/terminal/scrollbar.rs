// The thumb, lane and drag arithmetic below follows `scrollbar_thumb`, `scrollbar_lane`,
// `scrollbar_grab_at` and `scrollbar_row_at` of `src/terminal.rs` in herdr
// (https://github.com/herdrdev/herdr-app, commit 4c8c622d7965a6f6787f55b1896b70795fc68918),
// licensed under the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0).
// Modified for Perch: only the module path and lint allowances. See THIRD_PARTY_NOTICES.md.

//! The scrollbar at a pane's right edge: where its thumb is, where a click or a drag on it lands
//! in the scrollback, and the strip it draws in, which overlays the padding so showing it never
//! resizes the terminal.

use gpui::{point, px, size, Bounds, Pixels, Point};

/// The panes narrower than this have no room for it.
pub const MIN_COLS: u16 = 5;

/// A scroll thumb's top and length in px inside a `track` px lane: the scrollable area is `total`
/// rows, the `len`-row viewport sits `offset` rows from its top. None when nothing scrolls; `min`
/// keeps a huge scrollback grabbable.
pub fn thumb(total: u64, offset: u64, len: u64, track: f32, min: f32) -> Option<(f32, f32)> {
    if total <= len || len == 0 || track <= 0.0 {
        return None;
    }
    let thumb = (track * len as f32 / total as f32).clamp(min.min(track), track);
    let travel = track - thumb;
    let top = if travel <= 0.0 {
        0.0
    } else {
        offset.min(total - len) as f32 / (total - len) as f32 * travel
    };
    Some((top, thumb))
}

/// The strip the bar and its clicks live in: the padding when there is room, otherwise the last
/// few pixels over the text, so the scrollback appearing never resizes the terminal.
pub fn lane(
    bounds: Bounds<Pixels>,
    origin: Point<Pixels>,
    text_width: Pixels,
    height: Pixels,
) -> Bounds<Pixels> {
    let edge = bounds.origin.x + bounds.size.width;
    let left = (origin.x + text_width)
        .min(edge - px(8.0))
        .max(bounds.origin.x);
    Bounds::new(point(left, origin.y), size(edge - left, height))
}

/// Where in the thumb it was grabbed, or its middle when the click was on the track beside it.
pub fn grab_at(top: f32, len: f32, y: f32) -> f32 {
    if y >= top && y < top + len {
        y - top
    } else {
        len / 2.0
    }
}

/// The scroll position a thumb dragged to `top` px lands on, as a row offset from the
/// scrollback's top.
pub fn row_at(total: u64, len: u64, track: f32, min: f32, top: f32) -> usize {
    let Some((_, thumb)) = thumb(total, 0, len, track, min) else {
        return 0;
    };
    let travel = track - thumb;
    if travel <= 0.0 {
        return 0;
    }
    (top.clamp(0.0, travel) / travel * (total - len) as f32).round() as usize
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_thumb_maps_the_viewport_into_its_track() {
        // No scrollback: no thumb.
        assert_eq!(thumb(40, 0, 40, 100.0, 4.0), None);
        // Half the scrollable area visible: a half-height thumb at the top.
        assert_eq!(thumb(80, 0, 40, 100.0, 4.0), Some((0.0, 50.0)));
        // At the bottom it reaches the track's end.
        assert_eq!(thumb(80, 40, 40, 100.0, 4.0), Some((50.0, 50.0)));
        // A huge scrollback still leaves a grabbable thumb.
        assert_eq!(thumb(10_000, 0, 40, 100.0, 4.0), Some((0.0, 4.0)));
    }

    #[test]
    fn the_lane_survives_zero_and_small_padding_without_resizing() {
        let bounds = Bounds::new(point(px(20.0), px(30.0)), size(px(400.0), px(200.0)));
        for padding in [0.0, 1.0, 2.0, 14.0] {
            for remainder in [0.0, 0.5, 7.0] {
                let origin = bounds.origin + point(px(padding), px(padding));
                let width = px(400.0 - padding * 2.0 - remainder);
                let lane = lane(bounds, origin, width, px(160.0));
                assert!(lane.size.width >= px(8.0));
                assert_eq!(lane.origin.x + lane.size.width, px(420.0));
                assert_eq!(lane.origin.y, origin.y);
                assert_eq!(lane.size.height, px(160.0));
            }
        }
    }

    #[test]
    fn a_track_click_centres_the_thumb_and_a_thumb_grab_is_kept() {
        let (top, len) = thumb(1000, 800, 40, 100.0, 4.0).unwrap();
        assert_eq!(grab_at(top, len, top + 1.0), 1.0);
        let offset = grab_at(top, len, 50.0);
        assert_eq!(offset, len / 2.0);
        assert_eq!(row_at(1000, 40, 100.0, 4.0, 50.0 - offset), 480);
        assert_eq!(row_at(1000, 40, 100.0, 4.0, -offset), 0);
        assert_eq!(row_at(1000, 40, 100.0, 4.0, 100.0 - offset), 960);
    }

    #[test]
    fn a_dragged_thumb_round_trips_to_a_row() {
        let (track, min) = (100.0, 4.0);
        // The track's ends are the scrollback's ends.
        assert_eq!(row_at(80, 40, track, min, 0.0), 0);
        assert_eq!(row_at(80, 40, track, min, track), 40);
        // A thumb's painted top reads back as its own offset.
        let (top, _) = self::thumb(80, 25, 40, track, min).unwrap();
        assert_eq!(row_at(80, 40, track, min, top), 25);
    }
}

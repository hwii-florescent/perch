// The step accumulation (`scroll_steps`, `macos_wheel_steps`) follows
// `src/terminal.rs` of herdr (https://github.com/herdrdev/herdr-app, commit
// 4c8c622d7965a6f6787f55b1896b70795fc68918), licensed under the Apache License,
// Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0). Modified for Perch.
// See THIRD_PARTY_NOTICES.md.

//! How many whole lines a wheel or trackpad event moves.

use gpui::{point, Pixels, Point, ScrollDelta, Size, TouchPhase};

/// Lines per notch of a mouse wheel, as Ghostty scrolls them.
const WHEEL_LINES: f32 = 3.0;

/// Whole steps `delta` moves: `y` positive is toward older output, `x` positive is right.
///
/// A trackpad sends many small moves; they add up in `scrolled` to a line before one scrolls,
/// and each gesture starts from nothing. A wheel notch is a fixed number of lines.
pub fn steps(
    scrolled: &mut Point<f32>,
    delta: ScrollDelta,
    phase: TouchPhase,
    cell: Size<Pixels>,
    cols: u16,
    rows: u16,
) -> Point<i32> {
    match delta {
        ScrollDelta::Lines(p) if cfg!(target_os = "macos") => {
            point(wheel_steps(p.x) / 3, wheel_steps(p.y))
        }
        ScrollDelta::Lines(p) => point(
            accumulate(&mut scrolled.x, phase, p.x, cols as f32),
            accumulate(&mut scrolled.y, phase, p.y, rows as f32),
        ),
        ScrollDelta::Pixels(p) => point(
            accumulate(&mut scrolled.x, phase, p.x / cell.width, cols as f32),
            accumulate(&mut scrolled.y, phase, p.y / cell.height, rows as f32),
        ),
    }
}

/// Whole lines for one event of a gesture. Kept under a screen, so turning back is quick.
fn accumulate(scrolled: &mut f32, phase: TouchPhase, lines: f32, rows: f32) -> i32 {
    match phase {
        TouchPhase::Started => {
            *scrolled = 0.0;
            0
        }
        TouchPhase::Moved => {
            let before = scrolled.trunc() as i32;
            *scrolled += lines;
            let after = scrolled.trunc() as i32;
            *scrolled %= rows.max(1.0);
            after - before
        }
        _ => 0,
    }
}

/// Lines for a macOS mouse wheel event. macOS reports wheel ticks, a slow notch as a fraction
/// of one (often 0.1), so an event counts as at least one tick, times three, fraction dropped.
fn wheel_steps(ticks: f32) -> i32 {
    if ticks == 0.0 {
        return 0;
    }
    (ticks.signum() * ticks.abs().max(1.0) * WHEEL_LINES).trunc() as i32
}

#[cfg(test)]
mod tests {
    use super::*;
    use gpui::{px, size};

    fn cell() -> Size<Pixels> {
        size(px(8.0), px(16.0))
    }

    #[test]
    fn a_wheel_notch_is_three_lines_whatever_its_size() {
        if !cfg!(target_os = "macos") {
            return;
        }
        let mut acc = Point::default();
        let lines = |y: f32, acc: &mut Point<f32>| {
            steps(
                acc,
                ScrollDelta::Lines(point(0.0, y)),
                TouchPhase::Moved,
                cell(),
                80,
                24,
            )
        };
        assert_eq!(lines(0.1, &mut acc).y, 3);
        assert_eq!(lines(-0.1, &mut acc).y, -3);
        assert_eq!(lines(2.0, &mut acc).y, 6);
        assert_eq!(lines(0.0, &mut acc).y, 0);
        // A sideways notch moves one column.
        let sideways = steps(
            &mut acc,
            ScrollDelta::Lines(point(1.0, 0.0)),
            TouchPhase::Moved,
            cell(),
            80,
            24,
        );
        assert_eq!(sideways.x, 1);
    }

    #[test]
    fn trackpad_moves_add_up_to_whole_lines_within_a_gesture() {
        let mut acc = Point::default();
        let mut push = |phase, dy: f32| {
            steps(
                &mut acc,
                ScrollDelta::Pixels(point(px(0.0), px(dy))),
                phase,
                cell(),
                80,
                24,
            )
            .y
        };
        assert_eq!(push(TouchPhase::Started, 0.0), 0);
        // Five pixels is under a 16 px line: nothing yet, then they add up.
        assert_eq!(push(TouchPhase::Moved, 5.0), 0);
        assert_eq!(push(TouchPhase::Moved, 5.0), 0);
        assert_eq!(push(TouchPhase::Moved, 10.0), 1);
        assert_eq!(push(TouchPhase::Moved, 40.0), 2);
        // The next gesture starts from nothing.
        assert_eq!(push(TouchPhase::Started, 0.0), 0);
        assert_eq!(push(TouchPhase::Moved, -17.0), -1);
        assert_eq!(push(TouchPhase::Ended, 100.0), 0);
    }
}

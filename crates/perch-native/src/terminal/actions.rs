//! The things a terminal can be asked to do by name, apart from typing: a command palette or a
//! key dispatcher (neither lives here) maps its entries onto these and calls
//! [`super::TerminalView::perform`]. Moving the view never reaches the program; the program is
//! told only by the actions that say so (paste, kill).

/// Where to move the view of the history, as the web's `terminal.scroll` command says it.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Scroll {
    /// Whole lines; negative goes toward older output.
    Lines(isize),
    /// Pages of the terminal's row count; fractions round to whole lines.
    Pages(f64),
    Top,
    Bottom,
}

impl Scroll {
    /// A scroll from the three optional arguments of the command: exactly one must be given.
    pub fn parse(lines: Option<i64>, pages: Option<f64>, to: Option<&str>) -> Result<Self, String> {
        let given: Vec<&str> = [
            ("lines", lines.is_some()),
            ("pages", pages.is_some()),
            ("to", to.is_some()),
        ]
        .into_iter()
        .filter_map(|(name, given)| given.then_some(name))
        .collect();
        match (lines, pages, to) {
            (None, None, None) => Err("scroll needs one of lines, pages, to".into()),
            (Some(lines), None, None) => isize::try_from(lines)
                .map(Self::Lines)
                .map_err(|_| format!("scroll lines is out of range: {lines}")),
            (None, Some(pages), None) if pages.is_finite() => Ok(Self::Pages(pages)),
            (None, Some(pages), None) => {
                Err(format!("scroll pages is not a finite number: {pages}"))
            }
            (None, None, Some("top")) => Ok(Self::Top),
            (None, None, Some("bottom")) => Ok(Self::Bottom),
            (None, None, Some(other)) => Err(format!(
                "scroll to is \"top\" or \"bottom\", not \"{other}\""
            )),
            _ => Err(format!(
                "scroll takes one of lines, pages, to, not {}",
                given.join(" and ")
            )),
        }
    }

    /// The whole lines this moves a terminal of `rows` rows, or `None` for the ends.
    pub fn lines(self, rows: u16) -> Option<isize> {
        match self {
            Self::Lines(lines) => Some(lines),
            // Halves round up, as the web's Math.round does; `as` saturates, so an absurd page
            // count still lands on an end.
            Self::Pages(pages) => Some((pages * f64::from(rows) + 0.5).floor() as isize),
            Self::Top | Self::Bottom => None,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Action {
    Scroll(Scroll),
    /// Copy the selection, then end it.
    Copy,
    Paste,
    SelectAll,
    /// Empty the history. The rows on the screen belong to the program, which a shell redraws
    /// itself; nothing is sent to it.
    Clear,
    Find,
    /// Take the input and the size from whichever view holds them.
    TakeControl,
    /// End the shell. Needs the input lease.
    Kill,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_scroll_takes_exactly_one_of_lines_pages_or_to() {
        assert_eq!(Scroll::parse(Some(-3), None, None), Ok(Scroll::Lines(-3)));
        assert_eq!(Scroll::parse(None, Some(0.5), None), Ok(Scroll::Pages(0.5)));
        assert_eq!(Scroll::parse(None, None, Some("top")), Ok(Scroll::Top));
        assert_eq!(
            Scroll::parse(None, None, Some("bottom")),
            Ok(Scroll::Bottom)
        );
        assert!(Scroll::parse(None, None, None)
            .unwrap_err()
            .contains("one of"));
        assert!(Scroll::parse(Some(1), Some(1.0), None)
            .unwrap_err()
            .contains("lines and pages"));
        assert!(Scroll::parse(None, None, Some("middle")).is_err());
        assert!(Scroll::parse(None, Some(f64::NAN), None).is_err());
    }

    #[test]
    fn pages_are_rows_rounded_to_whole_lines() {
        assert_eq!(Scroll::Pages(1.0).lines(24), Some(24));
        assert_eq!(Scroll::Pages(-0.5).lines(25), Some(-12));
        assert_eq!(Scroll::Pages(0.5).lines(25), Some(13));
        assert_eq!(Scroll::Pages(0.01).lines(24), Some(0));
        assert_eq!(Scroll::Lines(7).lines(24), Some(7));
        assert_eq!(Scroll::Top.lines(24), None);
    }
}

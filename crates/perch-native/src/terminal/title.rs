// `shown_title` follows `shown_title` of `src/terminal.rs` in herdr
// (https://github.com/herdrdev/herdr-app, commit 4c8c622d7965a6f6787f55b1896b70795fc68918),
// licensed under the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0).
// Modified for Perch. See THIRD_PARTY_NOTICES.md.

//! The title a program sets, as it is shown.

use std::borrow::Cow;

/// A title without the spinner an agent puts in front of it (`✳ Fix the tests`, braille dots),
/// nor braille dots after a short prefix (`π ⠹ task`). A title that spins would otherwise
/// change ten times a second for everything that shows it.
pub fn shown_title(title: &str) -> Cow<'_, str> {
    // Frames agents spin, not status icons (a check mark stays): braille dots, Claude Code's
    // stars and its half circles.
    let spinner = |c: char| matches!(c, '\u{2800}'..='\u{28ff}' | '\u{00b7}' | '\u{2722}' | '\u{2733}' | '\u{2736}' | '\u{273b}' | '\u{273d}' | '\u{25d0}'..='\u{25d3}');
    let rest = title.trim_start_matches(|c: char| spinner(c) || c.is_whitespace());
    let led = title.len() - rest.len();
    if !rest.is_empty()
        && title[..led].chars().any(spinner)
        && title[..led].ends_with(char::is_whitespace)
    {
        return Cow::Borrowed(rest);
    }
    let braille =
        |w: &str| !w.is_empty() && w.chars().all(|c| matches!(c, '\u{2800}'..='\u{28ff}'));
    let mut words = title.splitn(3, ' ');
    match (words.next(), words.next()) {
        (Some(prefix), Some(frame))
            if !prefix.is_empty()
                && prefix.chars().count() <= 3
                && !braille(prefix)
                && braille(frame) =>
        {
            match words.next().map(str::trim_start).filter(|r| !r.is_empty()) {
                Some(rest) => Cow::Owned(format!("{prefix} {rest}")),
                None => Cow::Borrowed(prefix),
            }
        }
        _ => Cow::Borrowed(title),
    }
}

#[cfg(test)]
mod tests {
    use super::shown_title;

    #[test]
    fn a_spinner_in_front_of_a_title_is_not_part_of_it() {
        assert_eq!(shown_title("\u{2733} Fix the tests"), "Fix the tests");
        assert_eq!(shown_title("\u{280b} working"), "working");
        assert_eq!(shown_title("\u{25d0} \u{2733}  two of them"), "two of them");
        assert_eq!(shown_title("\u{2839} fix the tests"), "fix the tests");
        // Folders, letters, status icons and a spinner with nothing after it stay.
        assert_eq!(shown_title("~/Projects/perch"), "~/Projects/perch");
        assert_eq!(shown_title("\u{03c0} - pi"), "\u{03c0} - pi");
        assert_eq!(shown_title("\u{2713} build"), "\u{2713} build");
        assert_eq!(shown_title("\u{2733}"), "\u{2733}");
        assert_eq!(shown_title("\u{2839} \u{2838}"), "\u{2839} \u{2838}");
    }

    #[test]
    fn a_spinner_after_a_short_prefix_is_not_part_of_it() {
        assert_eq!(
            shown_title("\u{03c0} \u{2839} fix the tests"),
            "\u{03c0} fix the tests"
        );
        assert_eq!(shown_title("\u{03c0} \u{2839}"), "\u{03c0}");
        assert_eq!(shown_title("repo \u{00b7} branch"), "repo \u{00b7} branch");
        assert_eq!(
            shown_title("\u{03c0} \u{00b7} task"),
            "\u{03c0} \u{00b7} task"
        );
        assert_eq!(
            shown_title("herdr \u{2839} task"),
            "herdr \u{2839} task",
            "a word is no prefix"
        );
    }
}

//! `perch search <text>`: find what other sessions of the caller's Project said or were asked.
//! Pure: no database, no process. The route that decides which sessions are searched and fetches
//! their snapshots is `server/session_search.rs`; the contract is ARCHITECTURE ("Searching a
//! Project's sessions").
//!
//! Own design, after the behaviour Claude desktop documents for a session that searches other
//! sessions' transcripts; nothing is copied. Only a person's or an agent's own words are searched
//! (user and assistant messages), never a tool's output or a file's contents, so a search cannot
//! surface what `perch read` would not show. Matching is case-insensitive, literal (no patterns),
//! newest message first, and every size here is a bound.

/// The shortest query: one or two letters match nearly everything.
pub const MIN_QUERY: usize = 3;
/// The longest query, in characters.
pub const MAX_QUERY: usize = 200;
/// Hits returned when `--limit` is not given.
pub const DEFAULT_LIMIT: usize = 5;
/// The most hits one search may ask for.
pub const MAX_LIMIT: usize = 10;
/// The characters of a message read; a longer one is searched up to here only.
pub const MESSAGE_CHARS: usize = 20_000;
/// The characters of a snippet around the match.
pub const SNIPPET_CHARS: usize = 240;

/// One match in a session.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Hit {
    /// Position of the message among the session's messages, oldest first, from 0.
    pub index: usize,
    /// `user` or `assistant`.
    pub role: String,
    /// The text around the match, cut and marked.
    pub snippet: String,
}

/// The query, trimmed, or the reason it is refused.
pub fn check_query(query: &str) -> Result<String, String> {
    let query = query.trim();
    let length = query.chars().count();
    if !(MIN_QUERY..=MAX_QUERY).contains(&length) {
        return Err(format!(
            "the search text is {MIN_QUERY} to {MAX_QUERY} characters: perch search <text> [--limit N]"
        ));
    }
    Ok(query.to_string())
}

/// How many hits were asked for: absent means the default, 0 or too many is refused with the limits.
pub fn check_limit(asked: Option<u64>) -> Result<usize, String> {
    match asked {
        None => Ok(DEFAULT_LIMIT),
        Some(limit) if (1..=MAX_LIMIT as u64).contains(&limit) => Ok(limit as usize),
        Some(_) => Err(format!(
            "--limit is 1 to {MAX_LIMIT} (default {DEFAULT_LIMIT}): perch search <text> [--limit N]"
        )),
    }
}

/// One char, lowered. `to_lowercase` can turn one char into several (`İ`); the first is enough to
/// match on and keeps positions in step with the original text.
fn lower(c: char) -> char {
    c.to_lowercase().next().unwrap_or(c)
}

/// Where `needle` (already lowered) first occurs in `hay`, in chars.
fn find_at(hay: &[char], needle: &[char]) -> Option<usize> {
    if needle.is_empty() || hay.len() < needle.len() {
        return None;
    }
    (0..=hay.len() - needle.len()).find(|&start| {
        hay[start..start + needle.len()]
            .iter()
            .zip(needle)
            .all(|(h, n)| lower(*h) == *n)
    })
}

/// The text around a match, [`SNIPPET_CHARS`] at most, with `…` where it was cut.
fn snippet(chars: &[char], at: usize, length: usize) -> String {
    let room = SNIPPET_CHARS.saturating_sub(length);
    let start = at.saturating_sub(room / 2);
    let end = (at + length + room / 2).min(chars.len());
    let mut text: String = chars[start..end].iter().collect();
    text = text.split_whitespace().collect::<Vec<_>>().join(" ");
    format!(
        "{}{}{}",
        if start > 0 { "…" } else { "" },
        text,
        if end < chars.len() { "…" } else { "" }
    )
}

/// Matches of `query` in `messages` (role, text), newest message first, at most `max`. Only user
/// and assistant messages are read.
pub fn find(messages: &[(String, String)], query: &str, max: usize) -> Vec<Hit> {
    let needle: Vec<char> = query.chars().map(lower).collect();
    let mut hits = Vec::new();
    for (index, (role, text)) in messages.iter().enumerate().rev() {
        if hits.len() >= max {
            break;
        }
        if role != "user" && role != "assistant" {
            continue;
        }
        let chars: Vec<char> = text.chars().take(MESSAGE_CHARS).collect();
        if let Some(at) = find_at(&chars, &needle) {
            hits.push(Hit {
                index,
                role: role.clone(),
                snippet: snippet(&chars, at, needle.len()),
            });
        }
    }
    hits
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(role: &str, text: &str) -> (String, String) {
        (role.into(), text.into())
    }

    #[test]
    fn finds_literal_case_insensitive_matches_newest_first_in_user_and_assistant_words_only() {
        let messages = vec![
            message("user", "Fix the Parser please"),
            message("toolResult", "parser output that must never be searched"),
            message("assistant", "I fixed the parser and ran the tests"),
            message("assistant", "unrelated"),
        ];
        let hits = find(&messages, "PARSER", 5);
        assert_eq!(hits.iter().map(|h| h.index).collect::<Vec<_>>(), vec![2, 0]);
        assert_eq!(hits[0].role, "assistant");
        // A pattern is text, not a pattern.
        assert!(find(&messages, "pars.r", 5).is_empty());
        assert_eq!(find(&messages, "parser", 1).len(), 1);
    }

    #[test]
    fn a_snippet_is_bounded_whole_in_chars_and_marks_its_cuts() {
        let long = format!("{} NEEDLE {}", "é".repeat(500), "ü".repeat(500));
        let hits = find(&[message("assistant", &long)], "needle", 5);
        let snippet = &hits[0].snippet;
        assert!(
            snippet.starts_with('…') && snippet.ends_with('…'),
            "{snippet}"
        );
        assert!(snippet.contains("NEEDLE"));
        assert!(snippet.chars().count() <= SNIPPET_CHARS + 2);
        // A short message is shown whole, unmarked.
        assert_eq!(
            find(&[message("user", "see the NEEDLE here")], "needle", 5)[0].snippet,
            "see the NEEDLE here"
        );
    }

    #[test]
    fn the_query_and_limit_are_bounded_with_the_limits_in_the_refusal() {
        assert_eq!(check_query("  parser  ").unwrap(), "parser");
        assert!(check_query("ab").unwrap_err().contains("3 to 200"));
        assert!(check_query(&"x".repeat(201)).is_err());
        assert_eq!(check_limit(None).unwrap(), DEFAULT_LIMIT);
        assert_eq!(check_limit(Some(10)).unwrap(), 10);
        assert!(check_limit(Some(0)).unwrap_err().contains("1 to 10"));
        assert!(check_limit(Some(11)).is_err());
    }

    #[test]
    fn a_match_past_the_read_cap_is_not_found() {
        let text = format!("{}needle", "a".repeat(MESSAGE_CHARS));
        assert!(find(&[message("user", &text)], "needle", 5).is_empty());
    }
}

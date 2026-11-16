//! The editor's keys before `gpui-base` sees them: the editor-scoped shortcuts (`editor.save`, find, go to line;
//! [`crate::keymap::Keymap::editor_shortcut`]) and the typing rules of the web's `editorTyping.ts`, which follow VS
//! Code: brackets and quotes close as the language defines them (`AUTO_CLOSE_BEFORE`), a typed closer goes over only
//! a closer this editor inserted and Backspace removes only such an empty pair, an opener typed over a selection
//! surrounds it, and a `}` typed first on a line re-indents it to its opener's line. Enter stays `gpui-base`'s
//! (its smart indent matches). The cases are shared with the web (`packages/web/src/editorTyping.cases.json`).
//!
//! `gpui-base` pairs brackets itself, but types over closers it did not insert and keeps its list of inserted ones to
//! itself, so Perch turns its pairing off ([`create`](super::host)) and does it here. Every rule is one edit through
//! the engine's own input path (`replace_text_in_range`): one undo step, heard as one change, refused when readonly.

use gpui::{App, Entity, EntityInputHandler as _, Keystroke, Window};
use gpui_base::input::EditorState;
use std::ops::Range;

/// VS Code's `DEFAULT_AUTOCLOSE_BEFORE_LANGUAGE_DEFINED_BRACKETS`: an opener closes before these, whitespace or the
/// end of the text.
pub const AUTO_CLOSE_BEFORE: &str = "'\"`;:.,=}])> \n\t";

/// The pairs a file closes, by its name: none for a file with no known language or over the highlight cap (the web
/// loads no language for either), CodeMirror's default brackets and quotes otherwise, and the backtick too in
/// JavaScript and TypeScript (their language data).
pub fn pairs_for(path: &str, len: usize) -> &'static [(char, char)] {
    const DEFAULT: &[(char, char)] =
        &[('(', ')'), ('[', ']'), ('{', '}'), ('\'', '\''), ('"', '"')];
    const SCRIPT: &[(char, char)] = &[
        ('(', ')'),
        ('[', ']'),
        ('{', '}'),
        ('\'', '\''),
        ('"', '"'),
        ('`', '`'),
    ];
    let name = path.rsplit('/').next().unwrap_or(path);
    if len > super::highlight::MAX_HIGHLIGHT_CHARS || super::highlight::syntax_for(name).is_none() {
        return &[];
    }
    let extension = name.rsplit_once('.').map(|(_, e)| e.to_ascii_lowercase());
    match extension.as_deref() {
        Some("js" | "jsx" | "mjs" | "cjs" | "ts" | "tsx" | "mts" | "cts") => SCRIPT,
        _ => DEFAULT,
    }
}

/// One editor's typing state: the language's pairs and the closers it inserted (byte offsets).
#[derive(Default)]
pub struct Typing {
    pairs: &'static [(char, char)],
    closers: Vec<usize>,
    /// The text's length and the caret when the last key was seen, to follow the edit that key made.
    seen: Option<(usize, usize)>,
}

impl Typing {
    pub fn new(pairs: &'static [(char, char)]) -> Self {
        Self {
            pairs,
            ..Self::default()
        }
    }

    /// Follows the edit since the last key: a key types at the caret, so an insertion of `d` bytes at the old caret
    /// leaves the caret `d` further, Backspace takes the bytes before it and Delete those after it. Inserted closers
    /// after the edit shift with it, one inside a removed range goes, and any other change (a paste, undo, a press
    /// elsewhere) forgets them all. Closers on lines above the caret's are forgotten too, as CodeMirror does.
    ///
    /// ponytail: inferred from the length and caret before and after each key, not from the engine's edits (which it
    /// keeps to itself); a change that fits the pattern by chance keeps closers it should forget. Upgrade path: an
    /// edit observer on `InputBaseState`.
    fn follow(&mut self, len: usize, caret: usize, line_start: usize) {
        if let Some((old_len, old)) = self.seen {
            let grew = len as isize - old_len as isize;
            let typed = grew > 0 && caret as isize == old as isize + grew;
            let back = grew < 0 && caret as isize == old as isize + grew;
            let forward = grew < 0 && caret == old;
            if grew == 0 {
            } else if typed {
                for at in &mut self.closers {
                    if *at >= old {
                        *at += grew as usize;
                    }
                }
            } else if back || forward {
                let removed = if back {
                    caret..old
                } else {
                    old..old + (-grew) as usize
                };
                self.closers.retain(|at| !removed.contains(at));
                for at in &mut self.closers {
                    if *at >= removed.end {
                        *at -= removed.len();
                    }
                }
            } else {
                self.closers.clear();
            }
        }
        self.closers.retain(|at| *at >= line_start);
    }
}

/// What a key does to the text: replace `range` with `text`, then select `select`; `forget` an inserted closer,
/// `track` a new one.
#[derive(Debug, PartialEq)]
struct Edit {
    range: Range<usize>,
    text: String,
    select: Range<usize>,
}

/// The typing rule `key` triggers in `text` with `selected`, if any. Pure, so the rules are tested without a window.
fn rule(
    typing: &mut Typing,
    text: &str,
    selected: Range<usize>,
    key: &str,
) -> Option<(Edit, Option<usize>)> {
    let caret = selected.end;
    let next = text[caret..].chars().next();
    let prev = text[..selected.start].chars().next_back();
    if key == "backspace" {
        if !selected.is_empty() || !typing.closers.contains(&caret) {
            return None;
        }
        let (open, close) = typing
            .pairs
            .iter()
            .find(|(o, c)| Some(*o) == prev && Some(*c) == next)?;
        let start = caret - open.len_utf8();
        typing.closers.retain(|at| *at != caret);
        return Some((
            Edit {
                range: start..caret + close.len_utf8(),
                text: String::new(),
                select: start..start,
            },
            None,
        ));
    }
    let mut chars = key.chars();
    let typed = chars.next()?;
    if chars.next().is_some() {
        return None;
    }
    // A closer this editor inserted, typed again: the caret steps over it.
    if selected.is_empty()
        && next == Some(typed)
        && typing.closers.contains(&caret)
        && typing.pairs.iter().any(|(_, c)| *c == typed)
    {
        typing.closers.retain(|at| *at != caret);
        let after = caret + typed.len_utf8();
        return Some((
            Edit {
                range: caret..caret,
                text: String::new(),
                select: after..after,
            },
            None,
        ));
    }
    if let Some((open, close)) = typing.pairs.iter().find(|(o, _)| *o == typed) {
        if !selected.is_empty() {
            let inner = &text[selected.clone()];
            let start = selected.start + open.len_utf8();
            return Some((
                Edit {
                    range: selected.clone(),
                    text: format!("{open}{inner}{close}"),
                    select: start..start + inner.len(),
                },
                None,
            ));
        }
        let closes_here = next.is_none_or(|c| c.is_whitespace() || AUTO_CLOSE_BEFORE.contains(c));
        let quote = open == close;
        let after_word = prev.is_some_and(|c| c.is_alphanumeric() || c == '_');
        if closes_here && !(quote && after_word) {
            let inside = caret + open.len_utf8();
            return Some((
                Edit {
                    range: caret..caret,
                    text: format!("{open}{close}"),
                    select: inside..inside,
                },
                Some(inside),
            ));
        }
        return None;
    }
    // `}` as the first thing on its line takes the indent of its opener's line (`indentOnInput`).
    if typed == '}' && selected.is_empty() && typing.pairs.iter().any(|(o, _)| *o == '{') {
        let line_start = text[..caret].rfind('\n').map_or(0, |i| i + 1);
        if !text[line_start..caret]
            .chars()
            .all(|c| c == ' ' || c == '\t')
        {
            return None;
        }
        let indent = opener_indent(&text[..line_start])?;
        let end = line_start + indent.len() + 1;
        return Some((
            Edit {
                range: line_start..caret,
                text: format!("{indent}}}"),
                select: end..end,
            },
            None,
        ));
    }
    None
}

/// The leading whitespace of the line holding the `{` that a `}` after `before` would close.
///
/// ponytail: counts braces only, strings and comments included; a brace inside a string can pick the wrong line.
/// Upgrade path: ask the highlighter's scopes.
fn opener_indent(before: &str) -> Option<&str> {
    let mut depth = 0usize;
    for (at, c) in before.char_indices().rev() {
        match c {
            '}' => depth += 1,
            '{' if depth == 0 => {
                let start = before[..at].rfind('\n').map_or(0, |i| i + 1);
                let line = &before[start..];
                let width = line.len() - line.trim_start_matches([' ', '\t']).len();
                return Some(&line[..width]);
            }
            '{' => depth -= 1,
            _ => {}
        }
    }
    None
}

/// Runs the typing rule `keystroke` triggers on `state`; true when it handled the key (the engine must not).
pub fn type_key(
    state: &Entity<EditorState>,
    typing: &mut Typing,
    keystroke: &Keystroke,
    window: &mut Window,
    cx: &mut App,
) -> bool {
    let m = keystroke.modifiers;
    let key = if keystroke.key == "backspace" && !(m.control || m.alt || m.platform) {
        "backspace".to_string()
    } else if m.control || m.platform || m.function {
        String::new()
    } else {
        keystroke.key_char.clone().unwrap_or_default()
    };
    state.update(cx, |state, cx| {
        let (len, caret) = (state.text().len(), state.cursor());
        // The text is copied only for a key a rule may take, or to follow closers it still tracks.
        let relevant = key == "backspace"
            || key.chars().next().is_some_and(|c| {
                c == '}' || typing.pairs.iter().any(|(o, cl)| *o == c || *cl == c)
            });
        if !relevant && typing.closers.is_empty() {
            typing.seen = Some((len, caret));
            return false;
        }
        let text = state.value().to_string();
        let line_start = text[..caret].rfind('\n').map_or(0, |i| i + 1);
        typing.follow(len, caret, line_start);
        typing.seen = Some((len, caret));
        if !relevant || !state.is_editable() || state.marked_text_range(window, cx).is_some() {
            return false;
        }
        let selected = state.selected_range();
        let Some((edit, track)) = rule(typing, &text, selected, &key) else {
            return false;
        };
        if !(edit.range.is_empty() && edit.text.is_empty()) {
            let utf16 = |at: usize| text[..at].encode_utf16().count();
            let range = utf16(edit.range.start)..utf16(edit.range.end);
            state.replace_text_in_range(Some(range), &edit.text, window, cx);
        }
        state.set_selected_range(edit.select.clone(), cx);
        if let Some(at) = track {
            typing.closers.push(at);
        }
        typing.seen = Some((state.text().len(), state.cursor()));
        true
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const JAVA: &[(char, char)] = &[('(', ')'), ('[', ']'), ('{', '}'), ('\'', '\''), ('"', '"')];

    /// Applies `rule` for `key` to `doc` (caret at `|`), following the edit as `type_key` does.
    fn press(typing: &mut Typing, doc: &str, key: &str) -> String {
        let caret = doc.find('|').unwrap();
        let text = doc.replace('|', "");
        typing.follow(
            text.len(),
            caret,
            text[..caret].rfind('\n').map_or(0, |i| i + 1),
        );
        typing.seen = Some((text.len(), caret));
        let Some((edit, track)) = rule(typing, &text, caret..caret, key) else {
            let mut out = text.clone();
            let typed = if key == "backspace" { "" } else { key };
            let start = if key == "backspace" { caret - 1 } else { caret };
            out.replace_range(start..caret, typed);
            let at = start + typed.len();
            // The engine types it; the next key follows that edit.
            return format!("{}|{}", &out[..at], &out[at..]);
        };
        let mut out = text.clone();
        out.replace_range(edit.range.clone(), &edit.text);
        if let Some(at) = track {
            typing.closers.push(at);
        }
        typing.seen = Some((out.len(), edit.select.end));
        format!("{}|{}", &out[..edit.select.end], &out[edit.select.end..])
    }

    #[test]
    fn inserted_closers_shift_with_typing_before_them() {
        let mut typing = Typing::new(JAVA);
        let doc = press(&mut typing, "f|", "(");
        assert_eq!(doc, "f(|)");
        let doc = press(&mut typing, &doc, "x");
        assert_eq!(doc, "f(x|)");
        assert_eq!(
            press(&mut typing, &doc, ")"),
            "f(x)|",
            "the shifted closer is still typed over"
        );
    }

    #[test]
    fn an_edit_over_a_closer_forgets_it() {
        let mut typing = Typing::new(JAVA);
        let doc = press(&mut typing, "f|", "(");
        assert_eq!(typing.closers, vec![2]);
        // Delete takes the closer after the caret: nothing is left to type over.
        typing.follow(2, 2, 0);
        assert!(typing.closers.is_empty(), "{doc}");
    }

    #[test]
    fn an_unexplained_change_forgets_every_closer() {
        let mut typing = Typing::new(JAVA);
        press(&mut typing, "f|", "(");
        typing.follow(10, 0, 0);
        assert!(typing.closers.is_empty());
    }

    #[test]
    fn a_brace_takes_its_openers_indent() {
        assert_eq!(
            opener_indent("class A {\n  void f() {\n    x();\n"),
            Some("  ")
        );
        assert_eq!(opener_indent("a {\n  b { }\n"), Some(""));
        assert_eq!(opener_indent("none\n"), None);
    }

    #[test]
    fn files_without_a_language_pair_nothing() {
        assert!(pairs_for("notes.unknownext", 10).is_empty());
        assert!(pairs_for("a.rs", super::super::highlight::MAX_HIGHLIGHT_CHARS + 1).is_empty());
        assert!(pairs_for("a.ts", 10).iter().any(|(o, _)| *o == '`'));
        assert!(!pairs_for("A.java", 10).iter().any(|(o, _)| *o == '`'));
    }
}

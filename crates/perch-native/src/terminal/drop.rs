//! Files dropped on the terminal, or copied in the file manager, become shell words typed into
//! it: quoted so the shell reads each path literally, separated by spaces, with no Enter.
//!
//! The web terminal uploads a dropped file first and pastes the path of the copy; the native
//! view has the file itself on this machine and pastes its path. A terminal on another machine
//! would need that upload, which this view does not do.

use std::path::PathBuf;

/// `path` as one literal POSIX shell word. Single quotes by default (which also stop history
/// expansion), double quotes with the characters they would expand escaped when the setting asks.
/// A path holding a control character is refused: it could end the paste or type a command.
pub fn quote_path(path: &str, double_quotes: bool) -> Result<String, String> {
    if path.chars().any(|c| c.is_control()) {
        return Err("A dropped path has a control character in it".into());
    }
    if !double_quotes {
        return Ok(format!("'{}'", path.replace('\'', "'\\''")));
    }
    let mut word = String::from("\"");
    for c in path.chars() {
        match c {
            '\\' | '"' | '$' | '`' => {
                word.push('\\');
                word.push(c);
            }
            // Out of the double quotes, a literal bang inside single quotes, back in.
            '!' => word.push_str("\"'!'\""),
            c => word.push(c),
        }
    }
    word.push('"');
    Ok(word)
}

/// The text to paste for `paths`: every path quoted, joined by spaces, and a space after the last
/// so what the person types next is a word of its own.
pub fn paste_text(paths: &[PathBuf], double_quotes: bool) -> Result<String, String> {
    let mut words = Vec::with_capacity(paths.len());
    for path in paths {
        let path = path
            .to_str()
            .ok_or_else(|| "A dropped path is not valid text".to_string())?;
        words.push(quote_path(path, double_quotes)?);
    }
    if words.is_empty() {
        return Err("Nothing was dropped".into());
    }
    Ok(format!("{} ", words.join(" ")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_path_is_one_literal_word_in_either_quoting() {
        assert_eq!(quote_path("/a b/c", false).unwrap(), "'/a b/c'");
        assert_eq!(quote_path("it's", false).unwrap(), r"'it'\''s'");
        assert_eq!(
            quote_path(r#"a"$b`c\d!"#, true).unwrap(),
            r#""a\"\$b\`c\\d"'!'"""#
        );
        assert!(quote_path("a\nb", false).is_err());
        assert!(quote_path("a\u{7f}b", true).is_err());
    }

    #[test]
    fn paths_are_pasted_in_order_with_a_space_after() {
        let paths = [PathBuf::from("/x/one"), PathBuf::from("/x/two words")];
        assert_eq!(
            paste_text(&paths, false).unwrap(),
            "'/x/one' '/x/two words' "
        );
        assert!(paste_text(&[], false).is_err());
    }
}

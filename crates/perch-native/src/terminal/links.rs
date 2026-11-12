// The way a link's text is resolved to a target (a URL, or a file that exists, with a `:line`
// suffix and a sentence's final period dropped) and handed to the system follows `resolve`,
// `file_url_path` and `open` of `src/links.rs` in herdr (https://github.com/herdrdev/herdr-app,
// commit 4c8c622d7965a6f6787f55b1896b70795fc68918), licensed under the Apache License,
// Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0). Modified for Perch: macOS only, and
// the pattern is a scanner of its own, not Ghostty's regular expression. See
// THIRD_PARTY_NOTICES.md.

//! Links in terminal text: URLs and file paths, from the text on screen or from a program's
//! OSC 8 hyperlink, and what opening one means.

use super::vt::Vt;
use ghostty_sys as g;
use std::ops::Range;
use std::path::{Path, PathBuf};

/// Schemes a link may start with, as Ghostty's link pattern lists them.
const SCHEMES: [&str; 14] = [
    "https://", "http://", "mailto:", "ftp://", "file:", "ssh:", "git://", "ssh://", "tel:",
    "magnet:", "ipfs://", "ipns://", "gemini://", "gopher://",
];

/// Characters a link is made of.
fn link_char(c: char) -> bool {
    c.is_alphanumeric()
        || matches!(
            c,
            '_' | '-' | '.' | '~' | ':' | '/' | '?' | '#' | '@' | '!' | '$' | '&' | '*' | '+' | ','
                | ';' | '=' | '%'
        )
}

/// The link in `text` that covers byte `at`: a URL with one of the usual schemes, a rooted path
/// (`/`, `./`, `../`, `~/`, `$VAR/`) or a bare `folder/file`. A period, comma or colon that ends
/// a sentence is not part of it.
///
/// ponytail: a scanner over runs of link characters, not Ghostty's full pattern, so a URL with
/// a bracketed part or a path with spaces is cut short; the upgrade is the pattern itself in a
/// regex engine with look-around.
pub fn find(text: &str, at: usize) -> Option<Range<usize>> {
    if !text.is_char_boundary(at) || !text[at..].chars().next().is_some_and(link_char) {
        return None;
    }
    let start = text[..at]
        .char_indices()
        .rev()
        .find(|(_, c)| !link_char(*c))
        .map_or(0, |(i, c)| i + c.len_utf8());
    let end = text[at..]
        .char_indices()
        .find(|(_, c)| !link_char(*c))
        .map_or(text.len(), |(i, _)| at + i);
    let run = &text[start..end];
    let from = SCHEMES
        .iter()
        .filter_map(|scheme| {
            let i = run.to_ascii_lowercase().find(scheme)?;
            (run.len() > i + scheme.len()).then_some(i)
        })
        .min()
        .or_else(|| path_start(run))?;
    let mut to = run.len();
    // A sentence's end: no trailing period, comma, colon or semicolon.
    while to > from && matches!(run.as_bytes()[to - 1], b'.' | b',' | b':' | b';' | b'!' | b'?') {
        to -= 1;
    }
    let range = start + from..start + to;
    (range.start < range.end && range.contains(&at)).then_some(range)
}

/// Where a path starts in a run of link characters: the run, if it looks like one.
fn path_start(run: &str) -> Option<usize> {
    let rooted = run.starts_with("./")
        || run.starts_with("../")
        || run.starts_with("~/")
        || (run.starts_with('/') && !run.starts_with("//") && run.len() > 1)
        || run.strip_prefix('$').is_some_and(|rest| {
            rest.split_once('/')
                .is_some_and(|(name, _)| !name.is_empty() && name.chars().all(|c| c.is_alphanumeric() || c == '_'))
        });
    let bare = run.split_once('/').is_some_and(|(head, tail)| {
        !tail.is_empty()
            && head.starts_with(|c: char| c.is_alphanumeric() || c == '_' || c == '.')
            && head.chars().all(|c| c.is_alphanumeric() || matches!(c, '_' | '-' | '.'))
    });
    (rooted || bare).then_some(0)
}

/// What a link opens.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Target {
    Url(String),
    File(PathBuf),
}

/// What a link opens. A file path counts only when the file exists here; a relative one needs
/// the terminal's folder.
pub fn resolve(link: &str, cwd: Option<&Path>) -> Option<Target> {
    // `code.rs:12` is a place in a file, not a scheme.
    let scheme = link.split_once(':').is_some_and(|(s, rest)| {
        !rest.starts_with(|c: char| c.is_ascii_digit())
            && s.len() > 1
            && s.starts_with(|c: char| c.is_ascii_alphabetic())
            && s.chars().all(|c| c.is_ascii_alphanumeric() || "+-.".contains(c))
    });
    if scheme {
        if let Some(path) = file_url_path(link).filter(|p| p.exists()) {
            return Some(Target::File(path));
        }
        return Some(Target::Url(link.to_owned()));
    }
    let home = std::env::var_os("HOME").map(PathBuf::from);
    let expanded = if let Some(rest) = link.strip_prefix("~/") {
        home?.join(rest)
    } else if let Some(var) = link.strip_prefix('$') {
        let (name, rest) = var.split_once('/').unwrap_or((var, ""));
        let base = match name {
            "PWD" => cwd?.to_path_buf(),
            "HOME" => home?,
            _ => PathBuf::from(std::env::var_os(name)?),
        };
        base.join(rest)
    } else {
        PathBuf::from(link)
    };
    let full = if expanded.is_absolute() {
        expanded
    } else {
        cwd?.join(expanded)
    };
    if full.exists() {
        return Some(Target::File(full));
    }
    // The period ending a sentence, or `:42` / `:42:7` naming a place in the file.
    let text = full.to_str()?;
    let mut bare = text.strip_suffix('.').unwrap_or(text);
    for _ in 0..2 {
        match bare.rsplit_once(':') {
            Some((head, n)) if !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()) => bare = head,
            _ => break,
        }
    }
    Path::new(bare).exists().then(|| Target::File(PathBuf::from(bare)))
}

/// The path a `file:` URL names on this computer, percent-decoded.
fn file_url_path(link: &str) -> Option<PathBuf> {
    let rest = link.strip_prefix("file://")?;
    let rest = rest.strip_prefix("localhost").unwrap_or(rest);
    if !rest.starts_with('/') {
        return None;
    }
    let rest = rest.split(['?', '#']).next()?;
    let mut bytes = Vec::with_capacity(rest.len());
    let mut i = 0;
    while i < rest.len() {
        if rest.as_bytes()[i] == b'%' {
            bytes.push(u8::from_str_radix(rest.get(i + 1..i + 3)?, 16).ok()?);
            i += 3;
        } else {
            bytes.push(rest.as_bytes()[i]);
            i += 1;
        }
    }
    Some(PathBuf::from(String::from_utf8(bytes).ok()?))
}

/// The folder an OSC 7 report names (`file://host/path`, or a bare path).
pub fn pwd_path(reported: &str) -> Option<PathBuf> {
    if reported.starts_with('/') {
        return Some(PathBuf::from(reported));
    }
    let rest = reported.strip_prefix("file://")?;
    file_url_path(&format!("file://{}", &rest[rest.find('/')?..]))
}

/// Hand a link to the system's default handler. This runs a program, so it is for a person's
/// click only: nothing calls it but the window, and no test does.
pub fn open_in_system(target: &Target) {
    let arg = match target {
        Target::Url(url) => std::ffi::OsStr::new(url),
        Target::File(path) => path.as_os_str(),
    };
    let spawned = std::process::Command::new("open")
        .arg(arg)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn();
    // Reaped off the window's thread so it never lingers as a zombie.
    if let Ok(mut child) = spawned {
        drop(std::thread::spawn(move || child.wait()));
    }
}

/// A link found in the terminal: what it says and where it shows, as `(row, first cell, last
/// cell)` in the viewport.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Hit {
    pub target: String,
    /// The program marked it (OSC 8), rather than the text looking like one.
    pub marked: bool,
    pub spans: Vec<(u16, u16, u16)>,
}

/// One cell's place in the text of a line.
#[derive(Clone)]
struct Spot {
    y: u32,
    x: u16,
    width: u16,
    byte: usize,
    uri: Option<String>,
}

/// A link spanning more rows than this is not one worth finding.
const REACH: u32 = 32;

impl Vt {
    fn screen_ref(&self, x: u16, y: u32) -> Option<g::GhosttyGridRef> {
        let mut r = g::GhosttyGridRef {
            size: std::mem::size_of::<g::GhosttyGridRef>(),
            ..Default::default()
        };
        let mut p = g::GhosttyPoint {
            tag: g::GHOSTTY_POINT_TAG_SCREEN,
            ..Default::default()
        };
        p.value.coordinate = g::GhosttyPointCoordinate { x, y };
        // SAFETY: `p` and `r` are valid for the call.
        (unsafe { g::ghostty_terminal_grid_ref(self.term(), p, &mut r) } == g::GHOSTTY_SUCCESS)
            .then_some(r)
    }

    /// The screen row (counted from the top of the scrollback) the viewport starts at.
    fn viewport_top(&self) -> Option<u32> {
        let mut r = g::GhosttyGridRef {
            size: std::mem::size_of::<g::GhosttyGridRef>(),
            ..Default::default()
        };
        let mut p = g::GhosttyPoint {
            tag: g::GHOSTTY_POINT_TAG_VIEWPORT,
            ..Default::default()
        };
        p.value.coordinate = g::GhosttyPointCoordinate { x: 0, y: 0 };
        let mut out = g::GhosttyPointCoordinate::default();
        // SAFETY: as above; `r` is a fresh snapshot.
        unsafe {
            (g::ghostty_terminal_grid_ref(self.term(), p, &mut r) == g::GHOSTTY_SUCCESS
                && g::ghostty_terminal_point_from_grid_ref(
                    self.term(),
                    &r,
                    g::GHOSTTY_POINT_TAG_SCREEN,
                    &mut out,
                ) == g::GHOSTTY_SUCCESS)
                .then_some(out.y)
        }
    }

    /// Whether the terminal wrapped screen row `y` onto the next.
    fn wraps(&self, y: u32) -> bool {
        let Some(r) = self.screen_ref(0, y) else {
            return false;
        };
        let mut row: g::GhosttyRow = Default::default();
        let mut wrap = false;
        // SAFETY: the keys write the types passed.
        unsafe {
            g::ghostty_grid_ref_row(&r, &mut row) == g::GHOSTTY_SUCCESS
                && g::ghostty_row_get(
                    row,
                    g::GHOSTTY_ROW_DATA_WRAP,
                    (&mut wrap as *mut bool).cast(),
                ) == g::GHOSTTY_SUCCESS
                && wrap
        }
    }

    /// The text of screen row `y`, and where each character shows.
    fn link_row(&self, y: u32, text: &mut String, spots: &mut Vec<Spot>) -> Option<()> {
        let mut r = self.screen_ref(0, y)?;
        for x in 0..self.size().0 {
            r.x = x;
            let (wide, linked) = {
                let mut cell: g::GhosttyCell = Default::default();
                let mut wide: g::GhosttyCellWide = g::GHOSTTY_CELL_WIDE_NARROW;
                let mut linked = false;
                // SAFETY: `r` is a fresh snapshot; the keys write the types passed.
                unsafe {
                    g::ghostty_grid_ref_cell(&r, &mut cell);
                    g::ghostty_cell_get(
                        cell,
                        g::GHOSTTY_CELL_DATA_WIDE,
                        (&mut wide as *mut g::GhosttyCellWide).cast(),
                    );
                    g::ghostty_cell_get(
                        cell,
                        g::GHOSTTY_CELL_DATA_HAS_HYPERLINK,
                        (&mut linked as *mut bool).cast(),
                    );
                }
                (wide, linked)
            };
            if wide == g::GHOSTTY_CELL_WIDE_SPACER_TAIL || wide == g::GHOSTTY_CELL_WIDE_SPACER_HEAD
            {
                continue;
            }
            let byte = text.len();
            let mut codepoints = [0u32; 16];
            let mut len = 0usize;
            // SAFETY: the buffer and its length are valid.
            unsafe {
                g::ghostty_grid_ref_graphemes(&r, codepoints.as_mut_ptr(), codepoints.len(), &mut len)
            };
            text.extend(
                codepoints[..len.min(codepoints.len())]
                    .iter()
                    .filter_map(|c| char::from_u32(*c)),
            );
            if text.len() == byte {
                text.push(' ');
            }
            spots.push(Spot {
                y,
                x,
                width: if wide == g::GHOSTTY_CELL_WIDE_WIDE { 2 } else { 1 },
                byte,
                uri: linked.then(|| hyperlink_uri(&r)).flatten(),
            });
        }
        Some(())
    }

    /// The link at a viewport cell: one the program marked (OSC 8), which opens its own URI, or
    /// a URL or path in the text. A link the terminal wrapped across rows is found whole, also in
    /// rows scrolled out of view.
    ///
    /// ponytail: lines a program broke itself (a long path split at the right edge) are not
    /// rejoined; herdr's `link_at` does, trying the neighbouring rows and keeping the longest.
    pub fn link_at(&self, col: u16, row: u16) -> Option<Hit> {
        let (cols, rows) = self.size();
        if col >= cols || row >= rows {
            return None;
        }
        let top = self.viewport_top()?;
        let hovered = top + u32::from(row);
        let mut first = hovered;
        while first > 0 && hovered - first < REACH && self.wraps(first - 1) {
            first -= 1;
        }
        let mut last = hovered;
        while last - hovered < REACH
            && self.wraps(last)
            && self.screen_ref(0, last + 1).is_some()
        {
            last += 1;
        }
        let (mut text, mut spots) = (String::new(), Vec::new());
        for y in first..=last {
            self.link_row(y, &mut text, &mut spots)?;
        }
        let at = spots
            .iter()
            .position(|s| s.y == hovered && s.x <= col && col < s.x + s.width)?;
        let (target, marked, chosen): (String, bool, Vec<&Spot>) = match spots[at].uri.clone() {
            Some(uri) => {
                let same = |s: &&Spot| s.uri.as_deref() == Some(uri.as_str());
                let start = spots[..at].iter().rposition(|s| !same(&s)).map_or(0, |i| i + 1);
                let end = spots[at..].iter().position(|s| !same(&s)).map_or(spots.len(), |i| at + i);
                (uri, true, spots[start..end].iter().collect())
            }
            None => {
                let range = find(&text, spots[at].byte)?;
                (
                    text[range.clone()].to_owned(),
                    false,
                    spots.iter().filter(|s| range.contains(&s.byte)).collect(),
                )
            }
        };
        let mut spans: Vec<(u16, u16, u16)> = Vec::new();
        for s in chosen {
            let Some(vy) = s.y.checked_sub(top).filter(|vy| *vy < u32::from(rows)) else {
                continue;
            };
            let end = s.x + s.width - 1;
            match spans.last_mut() {
                Some(last) if last.0 == vy as u16 => last.2 = end,
                _ => spans.push((vy as u16, s.x, end)),
            }
        }
        Some(Hit {
            target,
            marked,
            spans,
        })
    }

    /// The working folder the shell reported (OSC 7), as it sent it.
    pub fn pwd(&self) -> Option<PathBuf> {
        let mut value = g::GhosttyString {
            ptr: std::ptr::null(),
            len: 0,
        };
        // SAFETY: the key writes a string that Ghostty owns and that outlives this call.
        let known = unsafe {
            g::ghostty_terminal_get(
                self.term(),
                g::GHOSTTY_TERMINAL_DATA_PWD,
                (&mut value as *mut g::GhosttyString).cast(),
            )
        } == g::GHOSTTY_SUCCESS;
        if !known || value.ptr.is_null() || value.len == 0 {
            return None;
        }
        // SAFETY: ptr/len describe Ghostty's copy.
        let bytes = unsafe { std::slice::from_raw_parts(value.ptr, value.len) };
        pwd_path(std::str::from_utf8(bytes).ok()?)
    }
}

fn hyperlink_uri(r: &g::GhosttyGridRef) -> Option<String> {
    let mut len = 0usize;
    let mut buf = vec![0u8; 512];
    // SAFETY: the buffer and its length are valid.
    let mut result =
        unsafe { g::ghostty_grid_ref_hyperlink_uri(r, buf.as_mut_ptr(), buf.len(), &mut len) };
    if result == g::GHOSTTY_OUT_OF_SPACE {
        buf.resize(len, 0);
        // SAFETY: as above.
        result =
            unsafe { g::ghostty_grid_ref_hyperlink_uri(r, buf.as_mut_ptr(), buf.len(), &mut len) };
    }
    (result == g::GHOSTTY_SUCCESS && len > 0)
        .then(|| String::from_utf8_lossy(&buf[..len]).into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn found(text: &str, needle: &str) -> Option<String> {
        let at = text.find(needle)?;
        find(text, at).map(|r| text[r].to_owned())
    }

    #[test]
    fn urls_and_paths_are_found_and_a_sentences_end_is_not_part_of_them() {
        assert_eq!(
            found("see https://example.com/a/b?x=1#top.", "example").as_deref(),
            Some("https://example.com/a/b?x=1#top")
        );
        assert_eq!(found("(https://a.dev/x), then", "a.dev").as_deref(), Some("https://a.dev/x"));
        assert_eq!(found("mail mailto:me@a.dev now", "me@").as_deref(), Some("mailto:me@a.dev"));
        assert_eq!(found("edit ./src/main.rs:42: here", "main").as_deref(), Some("./src/main.rs:42"));
        assert_eq!(found("open ~/notes/todo.md.", "notes").as_deref(), Some("~/notes/todo.md"));
        assert_eq!(found("at /usr/local/bin ok", "local").as_deref(), Some("/usr/local/bin"));
        assert_eq!(found("crates/perch-native/src/lib.rs", "native").as_deref(), Some("crates/perch-native/src/lib.rs"));
        assert_eq!(found("plain words only", "words"), None);
        assert_eq!(found("a // b", "//"), None);
        assert_eq!(found("see https://a.dev", "see"), None, "only on the link");
    }

    #[test]
    fn resolving_follows_the_scheme_the_file_and_the_line_suffix() {
        assert_eq!(resolve("https://a.dev/x", None), Some(Target::Url("https://a.dev/x".into())));
        let dir = std::env::temp_dir().join(format!("perch-links-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("code.rs"), "").unwrap();
        assert_eq!(resolve("code.rs", Some(&dir)), Some(Target::File(dir.join("code.rs"))));
        assert_eq!(resolve("code.rs:12:3", Some(&dir)), Some(Target::File(dir.join("code.rs"))));
        assert_eq!(resolve("code.rs.", Some(&dir)), Some(Target::File(dir.join("code.rs"))));
        assert_eq!(resolve("missing.rs", Some(&dir)), None);
        assert_eq!(resolve("code.rs", None), None, "a relative path needs a folder");
        let url = format!("file://{}/code.rs", dir.display());
        assert_eq!(resolve(&url, None), Some(Target::File(dir.join("code.rs"))));
        std::fs::remove_dir_all(&dir).unwrap();
        assert_eq!(pwd_path("file://host.local/Users/a%20b"), Some(PathBuf::from("/Users/a b")));
        assert_eq!(pwd_path("/Users/x"), Some(PathBuf::from("/Users/x")));
    }

    #[test]
    fn links_come_from_the_text_from_osc_8_and_across_wrapped_rows() {
        let mut vt = Vt::new(20, 6);
        vt.write(b"go to https://example.com/very/long/path/that/wraps now\r\n");
        vt.write(b"\x1b]8;;https://marked.dev/page\x07shown text\x1b]8;;\x07 plain\r\n");
        // The URL starts at column 6 of row 0 and wraps to rows 1 and 2.
        let hit = vt.link_at(8, 0).expect("a link");
        assert_eq!(hit.target, "https://example.com/very/long/path/that/wraps");
        assert!(!hit.marked);
        assert_eq!(hit.spans[0], (0, 6, 19), "{:?}", hit.spans);
        assert!(hit.spans.len() >= 3);
        // Any cell of a wrapped part finds the whole link.
        assert_eq!(vt.link_at(3, 1).map(|h| h.target), Some(hit.target.clone()));
        assert_eq!(vt.link_at(0, 0), None, "words that are not links");
        // OSC 8 opens its own URI, not the text shown.
        let marked = vt.link_at(2, 3).expect("a marked link");
        assert_eq!(marked.target, "https://marked.dev/page");
        assert!(marked.marked);
        assert_eq!(marked.spans, vec![(3, 0, 9)]);
        assert_eq!(vt.link_at(12, 3), None);
        // Scrolled out of view, the part still on screen finds the whole link.
        for _ in 0..4 {
            vt.write(b"filler\r\n");
        }
        vt.scroll_viewport(-1);
        assert_eq!(
            vt.link_at(3, 0).map(|h| h.target),
            Some("https://example.com/very/long/path/that/wraps".to_owned()),
            "{:?}",
            (0..6).map(|y| vt.frame().row_text(y)).collect::<Vec<_>>()
        );
        // The shell's folder.
        vt.write(b"\x1b]7;file://host/Users/me/work\x07");
        assert_eq!(vt.pwd(), Some(PathBuf::from("/Users/me/work")));
    }
}

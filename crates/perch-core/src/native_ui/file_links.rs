//! Which files a chat message's links name. The chat draws a link as a file pill only when this
//! module resolves it to a file inside the session's workspace and the file exists; anything else
//! stays as written.
//!
//! Ported from Orca's `shared/native-chat/native-chat-href-routing.ts` and
//! `shared/file-links/{file-link-location,explicit-file-link-target,file-link-path-normalization,
//! file-uri-path}.ts` (commit 308b5000, MIT; see THIRD_PARTY_NOTICES.md), with their tests.
//!
//! Not ported: Windows drive and UNC paths (Perch cores run on Unix), a `file:` URL naming another
//! host (not a file on this machine), Orca's `#orca-native-chat-file` href wrapper (it exists for
//! Orca's own markdown rewrite), and backslash as a separator: on Unix a backslash is a filename
//! character, so it is kept. Orca's existence cache and retry machinery
//! (`native-chat-file-link-existence.ts`) is renderer state tied to its runtime hosts; here the core
//! answers `fs.links` from the confined filesystem service and the web asks again per message.
use regex::Regex;
use std::sync::OnceLock;

/// `path`, `path:line` or `path:line:column`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Location {
    pub path_text: String,
    pub line: Option<u32>,
    pub column: Option<u32>,
}

/// A link target once routed: the chat opens files itself and leaves web links to the browser.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Route {
    Web(String),
    File {
        path_text: String,
        line: Option<u32>,
    },
    None,
}

/// A link resolved to an absolute path.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Resolved {
    pub path: String,
    pub line: Option<u32>,
    pub column: Option<u32>,
}

/// Split trailing `:digits` off `text`.
fn split_number(text: &str) -> Option<(&str, &str)> {
    let (rest, digits) = text.rsplit_once(':')?;
    (!digits.is_empty() && digits.bytes().all(|byte| byte.is_ascii_digit()))
        .then_some((rest, digits))
}

/// Orca `parseFileLinkLocation`: agent-style line and column suffixes.
pub fn parse_location(value: &str) -> Option<Location> {
    let mut path = value;
    let mut numbers: Vec<&str> = Vec::new();
    while numbers.len() < 2 {
        let Some((rest, digits)) = split_number(path) else {
            break;
        };
        numbers.push(digits);
        path = rest;
    }
    if path.is_empty() {
        return None;
    }
    numbers.reverse();
    let (line, column) = match numbers.as_slice() {
        [] => (None, None),
        [line] => (Some(line.parse::<u32>().ok()?), None),
        [line, column] => (
            Some(line.parse::<u32>().ok()?),
            Some(column.parse::<u32>().ok()?),
        ),
        _ => return None,
    };
    if line == Some(0) || column == Some(0) {
        return None;
    }
    Some(Location {
        path_text: path.to_string(),
        line,
        column,
    })
}

/// Orca `formatFileLinkLocation`, the inverse of [`parse_location`].
pub fn format_location(location: &Location) -> String {
    match (location.line, location.column) {
        (None, _) => location.path_text.clone(),
        (Some(line), None) => format!("{}:{line}", location.path_text),
        (Some(line), Some(column)) => format!("{}:{line}:{column}", location.path_text),
    }
}

/// A bare root is not a file link; an absolute or `~/` path needs a real segment to name a folder.
fn can_keep_trailing_separator(path_text: &str) -> bool {
    if path_text.chars().all(|c| c == '/') || path_text == "~/" {
        return false;
    }
    path_text.starts_with('/') || path_text.starts_with("~/")
}

/// Orca `parseExplicitFileLinkTarget`, for an agent-authored href.
pub fn parse_explicit_target(value: &str, allow_relative_directory: bool) -> Option<Location> {
    let parsed = parse_location(value)?;
    let has_location = parsed.line.is_some() || parsed.column.is_some();
    let text = parsed.path_text.as_str();
    if text
        .strip_prefix('/')
        .and_then(|rest| rest.chars().next())
        .is_some_and(char::is_whitespace)
    {
        return None;
    }
    if text.ends_with('/') {
        let can_keep_relative_directory = allow_relative_directory && !has_location;
        if has_location || (!can_keep_relative_directory && !can_keep_trailing_separator(text)) {
            return None;
        }
    }
    Some(parsed)
}

fn segments(path: &str) -> Vec<&str> {
    let mut stack: Vec<&str> = Vec::new();
    for segment in path.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                stack.pop();
            }
            other => stack.push(other),
        }
    }
    stack
}

/// Orca `normalizeAbsolutePath` for a Unix path: `.` and `..` resolved, never above `/`.
pub fn normalize_absolute(path: &str) -> Option<String> {
    path.starts_with('/')
        .then(|| format!("/{}", segments(path).join("/")))
}

/// Orca `joinAbsolutePath`: `relative` under `base`, without leaving the filesystem root.
pub fn join_absolute(base: &str, relative: &str) -> Option<String> {
    let base = normalize_absolute(base)?;
    let suffix = relative.trim_start_matches('/');
    normalize_absolute(&format!("{}/{suffix}", base.trim_end_matches('/')))
}

/// Orca `inferHomePathFromCwd`: a work directory under `/Users/x`, `/home/x` or `/root`.
fn infer_home(cwd: &str) -> Option<String> {
    let normalized = normalize_absolute(cwd)?;
    let parts = segments(&normalized);
    match parts.as_slice() {
        [root @ ("Users" | "home"), user, ..] => Some(format!("/{root}/{user}")),
        ["root", ..] => Some("/root".to_string()),
        _ => None,
    }
}

/// Orca `resolveTildePath`: `~/…` against an explicit home, else one inferred from `cwd`.
pub fn resolve_tilde(path: &str, cwd: &str, home: Option<&str>) -> Option<String> {
    let rest = path.strip_prefix("~/")?;
    let home = home
        .map(str::trim)
        .filter(|home| !home.is_empty())
        .and_then(normalize_absolute)
        .or_else(|| infer_home(cwd))?;
    join_absolute(&home, rest)
}

/// Orca `resolveExplicitFileLinkTargetPath`.
pub fn resolve_target_path(path_text: &str, cwd: &str, home: Option<&str>) -> Option<String> {
    if path_text.starts_with("~/") {
        return resolve_tilde(path_text, cwd, home);
    }
    normalize_absolute(path_text).or_else(|| join_absolute(cwd, path_text))
}

/// Orca `resolveExplicitFileLinkTarget`.
pub fn resolve_target(location: &Location, cwd: &str, home: Option<&str>) -> Option<Resolved> {
    Some(Resolved {
        path: resolve_target_path(&location.path_text, cwd, home)?,
        line: location.line,
        column: location.column,
    })
}

fn pattern(cell: &'static OnceLock<Regex>, source: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(source).expect("valid pattern"))
}

/// Orca `decodeURIComponent`: `None` on a malformed escape or bytes that are not UTF-8.
fn percent_decode(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let hex = text.get(index + 1..index + 3)?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            index += 3;
        } else {
            out.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(out).ok()
}

fn parse_line_fragment(hash: &str) -> Option<u32> {
    static LINE: OnceLock<Regex> = OnceLock::new();
    if hash.is_empty() {
        return None;
    }
    let decoded = percent_decode(hash).unwrap_or_else(|| hash.to_string());
    let captures = pattern(&LINE, r"(?i)^(?:L|line-?)([1-9]\d*)\b").captures(&decoded)?;
    captures[1].parse().ok()
}

/// Orca `stripQueryAndHash`.
fn strip_query_and_hash(value: &str) -> (&str, Option<u32>) {
    let hash_index = value.find('#');
    let query_index = value.find('?');
    let suffix_index = match (hash_index, query_index) {
        (None, None) => None,
        (Some(index), None) | (None, Some(index)) => Some(index),
        (Some(hash), Some(query)) => Some(hash.min(query)),
    };
    let path_text = suffix_index.map_or(value, |index| &value[..index]);
    let hash = hash_index.map_or("", |hash| {
        let end = match query_index {
            Some(query) if query > hash => query,
            _ => value.len(),
        };
        &value[hash + 1..end]
    });
    (path_text, parse_line_fragment(hash))
}

/// A `file:` URL's path on this machine and its `#L12` fragment (Orca `fileUriToFilesystemPath`).
fn file_uri(text: &str) -> Option<(String, Option<u32>)> {
    let rest = text.get(5..)?;
    let (rest, fragment) = rest.split_once('#').unwrap_or((rest, ""));
    let rest = rest.split_once('?').map_or(rest, |(path, _)| path);
    let (host, path) = match rest.strip_prefix("//") {
        Some(authority) => match authority.find('/') {
            Some(slash) => (&authority[..slash], authority[slash..].to_string()),
            None => (authority, "/".to_string()),
        },
        None if rest.starts_with('/') => ("", rest.to_string()),
        None => ("", format!("/{rest}")),
    };
    if !host.is_empty() && !host.eq_ignore_ascii_case("localhost") {
        return None;
    }
    Some((percent_decode(&path)?, parse_line_fragment(fragment)))
}

/// Orca `routeNativeChatHref`.
pub fn route_href(href: &str) -> Route {
    static WEB: OnceLock<Regex> = OnceLock::new();
    static FILE_URI: OnceLock<Regex> = OnceLock::new();
    static SCHEME: OnceLock<Regex> = OnceLock::new();
    // `README.md:5` is a file location; the scheme pattern alone reads `README.md:` as a scheme.
    static BARE_LOCATION: OnceLock<Regex> = OnceLock::new();
    let trimmed = href.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return Route::None;
    }
    if pattern(&WEB, r"(?i)^(?:https?|mailto):").is_match(trimmed) {
        return Route::Web(trimmed.to_string());
    }
    if pattern(&FILE_URI, r"(?i)^file:").is_match(trimmed) {
        return match file_uri(trimmed) {
            Some((path_text, line)) if !path_text.is_empty() => Route::File { path_text, line },
            _ => Route::None,
        };
    }
    if !pattern(
        &BARE_LOCATION,
        r"^[^\s:/\\?#]+\.[\p{L}\p{N}_+-]+:\d+(?::\d+)?$",
    )
    .is_match(trimmed)
        && pattern(&SCHEME, r"^[A-Za-z][A-Za-z0-9+.-]*:").is_match(trimmed)
    {
        return Route::None;
    }
    let (path_text, line) = strip_query_and_hash(trimmed);
    let decoded = percent_decode(path_text).unwrap_or_else(|| path_text.to_string());
    if decoded.is_empty() {
        Route::None
    } else {
        Route::File {
            path_text: decoded,
            line,
        }
    }
}

/// The file a link names, as an absolute path: Orca `resolveNativeChatFileLink`. `cwd` is the
/// workspace root and `home` the user's home directory, for `~/` links.
pub fn resolve_link(href: &str, cwd: &str, home: Option<&str>) -> Option<Resolved> {
    let Route::File { path_text, line } = route_href(href) else {
        return None;
    };
    let target = parse_explicit_target(&path_text, true)?;
    let mut resolved = resolve_target(&target, cwd, home)?;
    resolved.line = resolved.line.or(line);
    Some(resolved)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file(path_text: &str, line: Option<u32>) -> Route {
        Route::File {
            path_text: path_text.to_string(),
            line,
        }
    }

    // Orca `file-link-location.test.ts`.
    #[test]
    fn location_suffixes_are_agent_style_line_and_column() {
        let at = |path: &str, line, column| {
            Some(Location {
                path_text: path.to_string(),
                line,
                column,
            })
        };
        assert_eq!(
            parse_location("src/main.ts:12:4"),
            at("src/main.ts", Some(12), Some(4))
        );
        assert_eq!(parse_location("src/main.ts"), at("src/main.ts", None, None));
        assert_eq!(parse_location("a:12:4:5"), at("a:12", Some(4), Some(5)));
        assert_eq!(parse_location(""), None);
        assert_eq!(parse_location("src/main.ts:0"), None);
        assert_eq!(parse_location("src/main.ts:12:0"), None);
        assert_eq!(parse_location(":12"), None);
        let location = parse_location("src/main.ts:12:4").unwrap();
        assert_eq!(format_location(&location), "src/main.ts:12:4");
    }

    // Orca `file-link-path-normalization.test.ts` (the Unix rows).
    #[test]
    fn joining_never_leaves_the_filesystem_root() {
        for (base, relative, expected) in [
            ("/repo", "../sibling/readme.md", "/sibling/readme.md"),
            (
                "/repo/worktree",
                "../../sibling/readme.md",
                "/sibling/readme.md",
            ),
            ("/repo/worktree", "src/../../readme.md", "/repo/readme.md"),
            (
                "/repo/./worktree/..",
                "../sibling/readme.md",
                "/sibling/readme.md",
            ),
            ("/repo", "../../../readme.md", "/readme.md"),
            ("/repo", "..", "/"),
            ("/", "../../readme.md", "/readme.md"),
            ("/", "", "/"),
            ("/", "/readme.md", "/readme.md"),
        ] {
            assert_eq!(join_absolute(base, relative).as_deref(), Some(expected));
        }
        assert_eq!(join_absolute("repo", "../readme.md"), None);
    }

    #[test]
    fn tilde_resolves_against_an_explicit_or_inferred_home() {
        assert_eq!(
            resolve_tilde("~/../shared/readme.md", "/home/me/repo", None).as_deref(),
            Some("/home/shared/readme.md")
        );
        assert_eq!(
            resolve_tilde("~/notes.md", "/srv/app", Some("/home/me")).as_deref(),
            Some("/home/me/notes.md")
        );
        assert_eq!(resolve_tilde("~/notes.md", "/srv/app", None), None);
        assert_eq!(resolve_tilde("notes.md", "/home/me", None), None);
    }

    // Orca `native-chat-href-routing.test.ts` (the rows that apply without the wrapper or Windows).
    #[test]
    fn hrefs_route_to_web_or_file() {
        assert_eq!(
            route_href("https://example.com/docs"),
            Route::Web("https://example.com/docs".into())
        );
        assert_eq!(
            route_href(" mailto:dev@example.com "),
            Route::Web("mailto:dev@example.com".into())
        );
        assert_eq!(
            route_href("docs/plan.md?plain=1#line-7"),
            file("docs/plan.md", Some(7))
        );
        assert_eq!(route_href("docs/plan.md#usage"), file("docs/plan.md", None));
        assert_eq!(
            route_href("docs/release%20notes.md"),
            file("docs/release notes.md", None)
        );
        assert_eq!(
            route_href("file:///Users/me/wt/My%20File.tsx#L12"),
            file("/Users/me/wt/My File.tsx", Some(12))
        );
    }

    #[test]
    fn a_bare_file_name_with_a_line_is_a_file_not_a_scheme() {
        assert_eq!(route_href("README.md:5"), file("README.md:5", None));
        assert_eq!(route_href("App.tsx:12:3"), file("App.tsx:12:3", None));
        assert_eq!(route_href("localhost:3000"), Route::None);
    }

    #[test]
    fn anchors_unknown_schemes_and_malformed_uris_are_not_files() {
        for href in [
            "#section",
            "",
            "   ",
            "editor://file/x.ts",
            "javascript:alert(1)",
            "file:///tmp/%E0%A4%A.txt",
            "file://elsewhere/tmp/x.txt",
        ] {
            assert_eq!(route_href(href), Route::None, "{href:?}");
        }
    }

    #[test]
    fn explicit_targets_refuse_bare_roots_and_located_directories() {
        // Orca keeps a bare root when relative directories are allowed and no location follows.
        assert!(parse_explicit_target("/", false).is_none());
        assert!(parse_explicit_target("~/", false).is_none());
        assert!(parse_explicit_target("/ spaced", true).is_none());
        assert!(parse_explicit_target("src/", false).is_none());
        assert!(parse_explicit_target("src/", true).is_some());
        assert!(parse_explicit_target("src/:3", true).is_none());
        assert!(parse_explicit_target("/etc/", false).is_some());
        assert!(parse_explicit_target("src/main.rs:3:1", false).is_some());
    }

    #[test]
    fn a_link_resolves_against_the_workspace_with_its_location() {
        let resolve = |href: &str| resolve_link(href, "/work/repo", Some("/home/me"));
        let at = |path: &str, line, column| {
            Some(Resolved {
                path: path.to_string(),
                line,
                column,
            })
        };
        assert_eq!(
            resolve("src/main.rs:12:4"),
            at("/work/repo/src/main.rs", Some(12), Some(4))
        );
        assert_eq!(
            resolve("src/main.rs#L9"),
            at("/work/repo/src/main.rs", Some(9), None)
        );
        assert_eq!(resolve("../outside.md"), at("/work/outside.md", None, None));
        assert_eq!(
            resolve("file:///work/repo/a%20b.md"),
            at("/work/repo/a b.md", None, None)
        );
        assert_eq!(resolve("~/notes.md"), at("/home/me/notes.md", None, None));
        assert_eq!(resolve("https://example.com"), None);
        assert_eq!(resolve("#top"), None);
    }
}

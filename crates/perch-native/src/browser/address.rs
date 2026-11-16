//! The address bar's own logic, ported from the web: `links.ts` `browserAddress` (what typed text opens) and
//! `addressSuggestions.ts` `addressRows` (the dropdown under the bar). Both suites read
//! `packages/web/src/addressCases.json`, so the two stay rule for rule. Parsing is the `url` crate, the WHATWG
//! parser the web's `URL` implements.

use serde::{Deserialize, Serialize};
use url::Url;

/// The search engines Settings → General → Browser offers; the first is the default.
pub const SEARCH_ENGINES: [(&str, &str); 4] = [
    ("google", "https://www.google.com/search"),
    ("duckduckgo", "https://duckduckgo.com/"),
    ("bing", "https://www.bing.com/search"),
    ("brave", "https://search.brave.com/search"),
];

fn engine_url(engine: Option<&str>) -> &'static str {
    SEARCH_ENGINES
        .iter()
        .find(|(id, _)| Some(*id) == engine)
        .unwrap_or(&SEARCH_ENGINES[0])
        .1
}

/// The http(s) URL `uri` names, or `None` (`links.ts` `webUrl`).
pub fn web_url(uri: &str) -> Option<String> {
    let url = Url::parse(uri).ok()?;
    matches!(url.scheme(), "http" | "https").then(|| url.to_string())
}

/// A local `file:` URL as an agent prints it (host empty or `localhost`), or a bare absolute path made one
/// (`links.ts` `fileUrl`). Whether the file exists is the page's check, not this one.
pub fn file_url(uri: &str) -> Option<String> {
    let text = if uri.starts_with('/') && !uri.starts_with("//") {
        format!("file://{uri}")
    } else {
        uri.to_string()
    };
    let url = Url::parse(&text).ok()?;
    (url.scheme() == "file" && matches!(url.host_str(), None | Some("" | "localhost")))
        .then(|| url.to_string())
}

/// `^(?:[^\s/:?#]+|\[[^\]]+\]):\d+(?:[/?#]|$)`: a host and a port, which is not a scheme.
fn host_port(value: &str) -> bool {
    let rest = if let Some(inner) = value.strip_prefix('[') {
        match inner.find(']') {
            Some(end) if end > 0 => &inner[end + 1..],
            _ => return false,
        }
    } else {
        let end = value
            .find(|c: char| c.is_whitespace() || matches!(c, '/' | ':' | '?' | '#'))
            .unwrap_or(value.len());
        if end == 0 {
            return false;
        }
        &value[end..]
    };
    let Some(rest) = rest.strip_prefix(':') else {
        return false;
    };
    let digits = rest.bytes().take_while(u8::is_ascii_digit).count();
    digits > 0 && matches!(rest[digits..].chars().next(), None | Some('/' | '?' | '#'))
}

/// `^[a-z][a-z\d+.-]*:` (case-insensitive): the text starts with a scheme.
fn has_scheme(value: &str) -> bool {
    let mut chars = value.chars();
    chars.next().is_some_and(|c| c.is_ascii_alphabetic())
        && chars
            .find(|c| !(c.is_ascii_alphanumeric() || matches!(c, '+' | '.' | '-')))
            .is_some_and(|c| c == ':')
}

fn dotted_quad(host: &str) -> bool {
    let parts: Vec<_> = host.split('.').collect();
    parts.len() == 4
        && parts
            .iter()
            .all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()))
}

/// What typed text in the address bar opens: an address (`https://`, or `http://` for local and dev hosts), a
/// search with `engine`, or `None` for nothing (empty, or another scheme).
pub fn browser_address(input: &str, engine: Option<&str>) -> Option<String> {
    let value = input.trim();
    if value.is_empty() {
        return None;
    }
    let lower = value.to_ascii_lowercase();
    if lower.starts_with("http:") || lower.starts_with("https:") {
        return web_url(value);
    }
    let host_port = host_port(value);
    if has_scheme(value) && !host_port {
        return None;
    }
    if !value.chars().any(char::is_whitespace) {
        if let Ok(url) = Url::parse(&format!("https://{value}")) {
            let host = url.host_str().unwrap_or("");
            if host_port || host.contains('.') || host.starts_with('[') || host == "localhost" {
                // Dev servers and IP literals commonly have no TLS; an explicit https above is kept.
                let local = host == "localhost"
                    || host.ends_with(".localhost")
                    || host.ends_with(".local")
                    || !host.contains('.')
                    || dotted_quad(host);
                return if local {
                    web_url(&format!("http://{value}"))
                } else {
                    Some(url.to_string())
                };
            }
        }
    }
    let mut search = Url::parse(engine_url(engine)).expect("engine URLs parse");
    search.query_pairs_mut().append_pair("q", value);
    Some(search.to_string())
}

/// A page the core's history returned.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct HistoryEntry {
    pub url: String,
    pub title: String,
}

/// One line of the dropdown: the typed text's own action (`go` or `search`), an engine `suggest`ion, or a
/// remembered `page`.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
pub struct AddressRow {
    pub kind: String,
    pub url: String,
    pub title: String,
}

fn row(kind: &str, url: String, title: &str) -> AddressRow {
    AddressRow {
        kind: kind.into(),
        url,
        title: title.into(),
    }
}

/// The URL's `host` as the web reads it: the host name, and the port when it is not the scheme's default.
fn url_host(url: &str) -> Option<String> {
    let url = Url::parse(url).ok()?;
    let host = url.host_str()?;
    Some(match url.port() {
        Some(port) => format!("{host}:{port}"),
        None => host.to_string(),
    })
}

/// The dropdown, as Firefox composes it: the typed action first, up to 4 engine suggestions, then history (3
/// beside suggestions, all the room without them). `history` is already ranked by the core.
pub fn address_rows(
    typed: &str,
    history: &[HistoryEntry],
    suggestions: &[String],
    engine: Option<&str>,
) -> Vec<AddressRow> {
    const LIMIT: usize = 8;
    let text = typed.trim();
    let target = if text.is_empty() {
        None
    } else {
        browser_address(text, engine)
    };
    let mut rows = Vec::new();
    if let Some(target) = &target {
        let kind = if target.starts_with(&format!("{}?", engine_url(engine))) {
            "search"
        } else {
            "go"
        };
        rows.push(row(kind, target.clone(), text));
    }
    let mut seen = vec![text.to_lowercase()];
    let mut suggested = 0;
    for suggestion in suggestions {
        let lower = suggestion.to_lowercase();
        if seen.contains(&lower) || suggested >= 4 {
            continue;
        }
        let Some(search) = browser_address(suggestion, engine) else {
            continue;
        };
        seen.push(lower);
        suggested += 1;
        rows.push(row("suggest", search, suggestion));
    }
    let room = if suggestions.is_empty() { LIMIT } else { 3 };
    for page in history
        .iter()
        .filter(|page| Some(&page.url) != target.as_ref())
        .take(room)
    {
        let title = if page.title.is_empty() {
            url_host(&page.url).unwrap_or_else(|| page.url.clone())
        } else {
            page.title.clone()
        };
        rows.push(row("page", page.url.clone(), &title));
    }
    rows.truncate(LIMIT);
    rows
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn cases() -> Value {
        serde_json::from_str(include_str!(
            "../../../../packages/web/src/addressCases.json"
        ))
        .unwrap()
    }

    #[test]
    fn addresses_match_the_shared_table() {
        for case in cases()["addresses"].as_array().unwrap() {
            let input = case["input"].as_str().unwrap();
            let engine = case["engine"].as_str();
            assert_eq!(
                browser_address(input, engine).as_deref(),
                case["expected"].as_str(),
                "{input:?} with {engine:?}"
            );
        }
    }

    #[test]
    fn rows_match_the_shared_table() {
        for case in cases()["rows"].as_array().unwrap() {
            let history: Vec<HistoryEntry> =
                serde_json::from_value(case["history"].clone()).unwrap();
            let suggestions: Vec<String> =
                serde_json::from_value(case["suggestions"].clone()).unwrap();
            let expected: Vec<AddressRow> =
                serde_json::from_value(case["expected"].clone()).unwrap();
            let typed = case["typed"].as_str().unwrap();
            assert_eq!(
                address_rows(typed, &history, &suggestions, case["engine"].as_str()),
                expected,
                "{typed:?}"
            );
        }
    }

    #[test]
    fn file_urls_are_local_only() {
        assert_eq!(
            file_url("/tmp/a b.html").as_deref(),
            Some("file:///tmp/a%20b.html")
        );
        assert_eq!(
            file_url("file://localhost/tmp/x.pdf").as_deref(),
            Some("file:///tmp/x.pdf")
        );
        assert_eq!(file_url("file://server/share/x"), None);
        assert_eq!(file_url("//tmp/x"), None);
        assert_eq!(file_url("https://example.com/"), None);
    }
}

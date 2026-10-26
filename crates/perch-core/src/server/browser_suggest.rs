//! Address-bar search suggestions: what the user's search engine would complete the
//! typed words to (Firefox's "Provide search suggestions", Vivaldi's "Allow Search
//! Suggestions"). Everything typed is sent to the engine, so this is off unless the
//! `browserSearchSuggestions` setting is on, and an address-shaped input is never sent.
//!
//! The core asks, not the UI: the engines send no CORS headers a page here could use, and
//! the request carries no cookies, referrer or account. Like `usage.rs` it uses `curl`;
//! the query travels on stdin (not in the process list) and the answer is size-bounded.

use super::*;
use std::process::Stdio;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

/// Suggestions kept from one answer.
const MAX_SUGGESTIONS: usize = 8;
const MAX_QUERY_CHARS: usize = 100;
const MAX_SUGGESTION_CHARS: usize = 200;
/// Concurrent lookups across all connections; the UI debounces, this bounds a flood.
const MAX_IN_FLIGHT: usize = 4;
static IN_FLIGHT: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(MAX_IN_FLIGHT);

/// The engine's OpenSearch suggestion endpoint; the encoded query is appended. Every one
/// answers `["query", ["completion", ...]]`. None of the four sets CORS for a page here.
fn endpoint(engine: &str) -> &'static str {
    match engine {
        "duckduckgo" => "https://duckduckgo.com/ac/?type=list&q=",
        "bing" => "https://www.bing.com/osjson.aspx?query=",
        "brave" => "https://search.brave.com/api/suggest?q=",
        _ => "https://suggestqueries.google.com/complete/search?client=firefox&q=",
    }
}

/// The words to ask about, or None when nothing should leave the machine: empty, too long,
/// or shaped like an address (a scheme, or one dotted word like `example.com`).
fn worth_asking(query: &str) -> Option<String> {
    let query = query.split_whitespace().collect::<Vec<_>>().join(" ");
    let address = query.contains("://")
        || (!query.contains(' ') && (query.contains('.') || query.contains('/')));
    (!query.is_empty()
        && query.chars().count() <= MAX_QUERY_CHARS
        && !address
        && !query.chars().any(char::is_control))
    .then_some(query)
}

fn percent_encode(text: &str) -> String {
    let mut out = String::new();
    for byte in text.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

/// The completions of an OpenSearch answer, trimmed, bounded and without repeats.
fn parse(body: &[u8]) -> Vec<String> {
    let Ok(serde_json::Value::Array(parts)) = serde_json::from_slice(body) else {
        return Vec::new();
    };
    let mut out: Vec<String> = Vec::new();
    for item in parts
        .get(1)
        .and_then(|v| v.as_array())
        .into_iter()
        .flatten()
    {
        let Some(text) = item.as_str().map(str::trim) else {
            continue;
        };
        if !text.is_empty()
            && text.chars().count() <= MAX_SUGGESTION_CHARS
            && !out.iter().any(|seen| seen.eq_ignore_ascii_case(text))
        {
            out.push(text.to_string());
        }
        if out.len() == MAX_SUGGESTIONS {
            break;
        }
    }
    out
}

async fn fetch(url: &str) -> Option<Vec<u8>> {
    let mut child = Command::new("curl")
        .args([
            "-q", // ignore ~/.curlrc
            "-sSf",
            "--max-time",
            "3",
            "--max-filesize",
            "65536",
            "--proto",
            "=https",
            "--max-redirs",
            "0",
            "-A",
            "Mozilla/5.0 (compatible; perch)",
            "-H",
            "Accept: application/json",
            "-K",
            "-",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .ok()?;
    let mut stdin = child.stdin.take()?;
    // `url` holds only unreserved characters and percent escapes, so it needs no config quoting.
    stdin
        .write_all(format!("url = \"{url}\"\n").as_bytes())
        .await
        .ok()?;
    drop(stdin);
    let out = child.wait_with_output().await.ok()?;
    out.status.success().then_some(out.stdout)
}

pub(super) fn handle_suggest(state: &Arc<ConnState>, request_id: String, query: String) {
    let settings = state.app.settings.get();
    let asked = settings
        .browser_search_suggestions
        .then(|| worth_asking(&query))
        .flatten();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let mut suggestions = Vec::new();
        if let (Some(query), Ok(_permit)) = (asked, IN_FLIGHT.try_acquire()) {
            let url = format!(
                "{}{}",
                endpoint(&settings.browser_search_engine),
                percent_encode(&query)
            );
            suggestions = fetch(&url)
                .await
                .map(|body| parse(&body))
                .unwrap_or_default();
        }
        let _ = out_tx.send(ServerMessage::BrowserSuggestResult {
            request_id,
            suggestions,
        });
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_search_words_are_sent_and_they_are_encoded() {
        assert_eq!(
            worth_asking("  rust   lifetimes ").as_deref(),
            Some("rust lifetimes")
        );
        assert_eq!(worth_asking("perch").as_deref(), Some("perch"));
        for no in [
            "",
            "   ",
            "https://example.com/x",
            "example.com",
            "localhost:3000/a",
            "a\u{0007}b",
            &"x".repeat(101),
        ] {
            assert_eq!(worth_asking(no), None, "{no:?}");
        }
        // A phrase that merely contains a dot is still a search.
        assert_eq!(
            worth_asking("node.js tutorial").as_deref(),
            Some("node.js tutorial")
        );
        assert_eq!(percent_encode("a b&c=d/é"), "a%20b%26c%3Dd%2F%C3%A9");
    }

    #[test]
    fn answers_are_parsed_trimmed_bounded_and_deduplicated() {
        let body = br#"["perch",[" perchance ","Perchance","","perch fish",7,"perch parking"],[],{"x":1}]"#;
        assert_eq!(parse(body), ["perchance", "perch fish", "perch parking"]);
        for bad in [&b"not json"[..], b"{}", b"[]", b"[\"q\"]", b"[\"q\",\"x\"]"] {
            assert!(parse(bad).is_empty());
        }
        let many = format!(
            "[\"q\",[{}]]",
            (0..20)
                .map(|i| format!("\"s{i}\""))
                .collect::<Vec<_>>()
                .join(",")
        );
        assert_eq!(parse(many.as_bytes()).len(), MAX_SUGGESTIONS);
    }

    #[test]
    fn each_engine_has_its_own_https_endpoint() {
        for engine in ["google", "duckduckgo", "bing", "brave", "unknown"] {
            assert!(endpoint(engine).starts_with("https://"));
        }
        assert!(endpoint("brave").contains("brave.com"));
        assert!(endpoint("unknown").contains("google.com"));
    }
}

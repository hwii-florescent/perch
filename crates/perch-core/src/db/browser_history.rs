//! Pages visited in perch's built-in browser (`browser_history`), behind the
//! address bar's suggestions (`server/browser_history.rs`).
//!
//! Browsing history belongs to the user, not to a window or workspace, so it
//! lives here (like Chrome's `History` or Firefox's `places.sqlite`) and every
//! connected viewer shares it. URLs are untrusted input: only bounded http(s)
//! addresses are stored, and fragments are dropped because they can carry
//! tokens (and perch's own `#pair` links).

use super::*;

/// Rows kept; the least recently visited are pruned on write.
pub const MAX_BROWSER_HISTORY_ROWS: i64 = 5000;
const MAX_URL_BYTES: usize = 2048;
const MAX_TITLE_CHARS: usize = 200;
/// Rows a search considers before ranking: the most recently visited matches.
const SEARCH_CANDIDATES: i64 = 300;
const MAX_SEARCH_WORDS: usize = 8;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BrowserHistoryRow {
    pub url: String,
    pub title: String,
}

/// The address as stored: http(s) only, bounded, no whitespace, no fragment.
pub fn clean_history_url(url: &str) -> Option<String> {
    let url = url.split('#').next()?.trim();
    let lower = url.to_ascii_lowercase();
    let web = lower.starts_with("http://") || lower.starts_with("https://");
    let bare = lower.split_once("://").map_or("", |(_, rest)| rest);
    (web && !bare.is_empty()
        && url.len() <= MAX_URL_BYTES
        && !url.chars().any(|c| c.is_whitespace() || c.is_control()))
    .then(|| url.to_string())
}

/// Address without scheme and `www.`, lowercase: what the user types against.
fn bare(url: &str) -> String {
    let lower = url.to_ascii_lowercase();
    let rest = lower.split_once("://").map_or(lower.as_str(), |(_, r)| r);
    rest.strip_prefix("www.").unwrap_or(rest).to_string()
}

impl HistoryDb {
    pub(super) fn migrate_browser_history(conn: &Connection) -> anyhow::Result<()> {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS browser_history (
                url TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '',
                visits INTEGER NOT NULL DEFAULT 1,
                last_visit INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS browser_history_last_visit
                ON browser_history(last_visit DESC);",
        )?;
        Ok(())
    }

    /// Note that `url` is on screen. `visit` counts a new visit; otherwise only
    /// a non-empty title refreshes the row. Anything not a plain web address is ignored.
    pub fn record_browser_page(
        &self,
        url: &str,
        title: &str,
        visit: bool,
        now: i64,
    ) -> anyhow::Result<()> {
        let Some(url) = clean_history_url(url) else {
            return Ok(());
        };
        let title: String = title.trim().chars().take(MAX_TITLE_CHARS).collect();
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO browser_history (url, title, visits, last_visit) VALUES (?1, ?2, 1, ?3)
             ON CONFLICT(url) DO UPDATE SET
                title = CASE WHEN ?2 != '' THEN ?2 ELSE title END,
                visits = visits + ?4,
                last_visit = CASE WHEN ?4 = 1 THEN ?3 ELSE last_visit END",
            params![url, title, now, visit as i64],
        )?;
        conn.execute(
            "DELETE FROM browser_history WHERE url IN
                (SELECT url FROM browser_history ORDER BY last_visit DESC LIMIT -1 OFFSET ?1)",
            params![MAX_BROWSER_HISTORY_ROWS],
        )?;
        Ok(())
    }

    pub fn remove_browser_page(&self, url: &str) -> anyhow::Result<()> {
        self.conn
            .lock()
            .unwrap()
            .execute("DELETE FROM browser_history WHERE url = ?1", params![url])?;
        Ok(())
    }

    pub fn clear_browser_history(&self) -> anyhow::Result<()> {
        self.conn
            .lock()
            .unwrap()
            .execute("DELETE FROM browser_history", [])?;
        Ok(())
    }

    /// Pages matching every word of `query` in their address or title, best first:
    /// addresses that start with the query, then frequent and recent pages. An
    /// empty query is the most recently visited pages.
    pub fn search_browser_history(
        &self,
        query: &str,
        limit: usize,
        now: i64,
    ) -> anyhow::Result<Vec<BrowserHistoryRow>> {
        let query = bare(query.trim());
        let words: Vec<&str> = query.split_whitespace().take(MAX_SEARCH_WORDS).collect();
        let conn = self.conn.lock().unwrap();
        // The SQL filter is a superset (it sees the scheme too); ranking re-checks on `bare`.
        let filter = words
            .iter()
            .map(|_| "instr(lower(url || ' ' || title), ?) > 0")
            .collect::<Vec<_>>()
            .join(" AND ");
        let sql = format!(
            "SELECT url, title, visits, last_visit FROM browser_history {}
             ORDER BY last_visit DESC LIMIT {}",
            if filter.is_empty() {
                String::new()
            } else {
                format!("WHERE {filter}")
            },
            if words.is_empty() {
                limit as i64
            } else {
                SEARCH_CANDIDATES
            }
        );
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(words.iter()), |row| {
                Ok((
                    BrowserHistoryRow {
                        url: row.get(0)?,
                        title: row.get(1)?,
                    },
                    row.get::<_, i64>(2)?,
                    row.get::<_, i64>(3)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        if words.is_empty() {
            return Ok(rows.into_iter().map(|(row, ..)| row).collect());
        }
        let prefix = words.join(" ");
        let mut scored: Vec<(f64, BrowserHistoryRow)> = rows
            .into_iter()
            .filter_map(|(row, visits, last)| {
                let address = bare(&row.url);
                let haystack = format!("{address} {}", row.title.to_lowercase());
                if !words.iter().all(|word| haystack.contains(word)) {
                    return None;
                }
                let days = (now - last).max(0) as f64 / 86_400_000.0;
                let score = if address.trim_end_matches('/').starts_with(&prefix) {
                    100.0
                } else {
                    0.0
                } + (1.0 + visits as f64).log2() * 10.0
                    + 10.0 / (1.0 + days);
                Some((score, row))
            })
            .collect();
        scored.sort_by(|a, b| b.0.total_cmp(&a.0));
        Ok(scored.into_iter().take(limit).map(|(_, row)| row).collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> HistoryDb {
        let dir = std::env::temp_dir().join(format!("perch-browser-history-{}", Uuid::new_v4()));
        HistoryDb::open(dir.join("history.sqlite")).unwrap()
    }

    fn urls(rows: Vec<BrowserHistoryRow>) -> Vec<String> {
        rows.into_iter().map(|row| row.url).collect()
    }

    #[test]
    fn only_plain_bounded_web_addresses_are_stored_without_fragments() {
        assert_eq!(
            clean_history_url("https://a.test/x?y=1#token=secret").as_deref(),
            Some("https://a.test/x?y=1")
        );
        for bad in [
            "",
            "javascript:alert(1)",
            "file:///etc/passwd",
            "https://",
            "https://a b.test/",
            "http://a.test/\nx",
        ] {
            assert_eq!(clean_history_url(bad), None, "{bad:?}");
        }
        assert_eq!(
            clean_history_url(&format!("https://a.test/{}", "x".repeat(3000))),
            None
        );
    }

    #[test]
    fn ranks_by_prefix_then_frequency_and_counts_visits_once() {
        let db = db();
        let now = 1_000_000_000;
        db.record_browser_page("https://github.com/perch", "Perch repo", true, now)
            .unwrap();
        db.record_browser_page("https://example.com/github-notes", "Notes", true, now)
            .unwrap();
        db.record_browser_page("https://github.com/perch", "Perch repo", true, now)
            .unwrap();
        db.record_browser_page("about:blank", "", true, now)
            .unwrap();
        assert_eq!(
            urls(db.search_browser_history("git", 6, now).unwrap()),
            [
                "https://github.com/perch",
                "https://example.com/github-notes"
            ]
        );
        assert_eq!(
            db.search_browser_history("perch repo", 6, now)
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            urls(
                db.search_browser_history("https://www.github.com", 6, now)
                    .unwrap()
            ),
            ["https://github.com/perch"]
        );
        assert_eq!(db.search_browser_history("", 6, now).unwrap().len(), 2);
        // A title refresh is not a visit; a visit that has no title keeps the old one.
        db.record_browser_page("https://a.test/", "", true, 1)
            .unwrap();
        db.record_browser_page("https://a.test/", "A", false, 2)
            .unwrap();
        db.record_browser_page("https://a.test/", "", true, 3)
            .unwrap();
        let conn = db.conn.lock().unwrap();
        let row: (String, i64, i64) = conn
            .query_row(
                "SELECT title, visits, last_visit FROM browser_history WHERE url = 'https://a.test/'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();
        assert_eq!(row, ("A".to_string(), 2, 3));
    }

    #[test]
    fn an_existing_database_without_the_table_gains_it_and_keeps_its_rows() {
        let path = std::env::temp_dir()
            .join(format!("perch-browser-history-{}", Uuid::new_v4()))
            .join("history.sqlite");
        let old = HistoryDb::open(path.clone()).unwrap();
        old.record_browser_page("https://kept.test/", "Kept", true, 1)
            .unwrap();
        // A database from before this feature has no such table.
        old.conn
            .lock()
            .unwrap()
            .execute("DROP TABLE browser_history", [])
            .unwrap();
        drop(old);
        let db = HistoryDb::open(path).unwrap();
        assert!(db.search_browser_history("", 6, 2).unwrap().is_empty());
        db.record_browser_page("https://new.test/", "", true, 3)
            .unwrap();
        assert_eq!(
            urls(db.search_browser_history("", 6, 4).unwrap()),
            ["https://new.test/"]
        );
        // Reopening an upgraded database keeps what it has.
        drop(db);
    }

    #[test]
    fn remove_clear_and_pruning_keep_the_newest() {
        let db = db();
        db.record_browser_page("https://gone.test/", "Gone", true, 1)
            .unwrap();
        db.remove_browser_page("https://gone.test/").unwrap();
        assert!(db.search_browser_history("gone", 6, 2).unwrap().is_empty());
        {
            let conn = db.conn.lock().unwrap();
            for i in 0..MAX_BROWSER_HISTORY_ROWS {
                conn.execute(
                    "INSERT INTO browser_history (url, title, visits, last_visit) VALUES (?1, '', 1, ?2)",
                    params![format!("https://old.test/{i}"), i + 10],
                )
                .unwrap();
            }
        }
        db.record_browser_page("https://new.test/", "", true, 1_000_000)
            .unwrap();
        let count: i64 = db
            .conn
            .lock()
            .unwrap()
            .query_row("SELECT COUNT(*) FROM browser_history", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, MAX_BROWSER_HISTORY_ROWS);
        assert_eq!(
            urls(db.search_browser_history("", 1, 0).unwrap()),
            ["https://new.test/"]
        );
        assert!(db
            .search_browser_history("old.test/0", 6, 0)
            .unwrap()
            .is_empty());
        db.clear_browser_history().unwrap();
        assert!(db.search_browser_history("", 6, 0).unwrap().is_empty());
    }
}

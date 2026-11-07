//! "API-equivalent spend": what the agents' local logs say you used, priced
//! at API list prices (`prices.rs`). It is an estimate beside the plan-usage
//! windows, not a bill.
//!
//! Ported from Vorssaint (GPL-3.0-or-later): the log parsers
//! (`Engine/src/agent/{claude,codex}.rs`, `AgentOpenCodeReader.swift`,
//! `CopilotReader.swift`), the incremental reader, the dedupe/merge rules and
//! the aggregation (`AgentUsageSummary.swift`).
//!
//! - Sources: Claude `<config dir>/projects/**/*.jsonl` (+ `~/.config/claude`),
//!   Codex `<CODEX_HOME>/{sessions,archived_sessions}/**/*.jsonl`, OpenCode's
//!   SQLite db, Copilot `~/.copilot/session-state/*/events.jsonl`. Usage only:
//!   turn tracking and limits stay with `mod.rs`.
//! - Dedupe: each record has a provider key (Claude `message.id:requestId`,
//!   Codex `response_id` or cumulative total, ...). Streamed Claude repeats
//!   merge by per-field max; a key is dropped only when no source file holds it.
//! - Horizon: files untouched for 31 days are not read; aggregation covers
//!   30 local days, so a rescan after midnight cannot resurrect old records.
//! - The ledger is in memory and rebuilt on core start (ponytail: Vorssaint
//!   persists a binary archive; a cold scan of the horizon is cheap enough
//!   here). Files are then read incrementally: only complete appended lines.
//! - Cost is computed at aggregation time from the current price list, so a
//!   price change reprices history. OpenCode's recorded cost is used only for
//!   models the list does not price.

use super::prices::{self, Billable, PriceList, Tokens};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{hash_map::Entry as MapEntry, HashMap};
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const HORIZON_DAYS: f64 = 31.0;
const PERIOD_DAYS: [u32; 3] = [1, 7, 30];
const MAX_LINE: u64 = 32 << 20;
const BLOCK_SECS: f64 = 5.0 * 3600.0;
const BURN_WINDOW_SECS: f64 = 30.0 * 60.0;
const TOP_SHARES: usize = 5;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpendSummary {
    /// Today, 7 and 30 local days (calendar days, today included).
    pub periods: Vec<SpendPeriod>,
    /// The Claude 5-hour block that is still open, when there is one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub block: Option<SpendBlock>,
    /// API-equivalent dollars per hour at the last 30 minutes' pace.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub burn_per_hour_usd: Option<f64>,
    /// `updated` day of the price list used.
    pub prices_updated: String,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpendPeriod {
    pub days: u32,
    pub cost_usd: f64,
    /// Dollars the cache reads avoided versus plain input rates.
    pub saved_usd: f64,
    /// Input, cache and output tokens; reasoning is not added.
    pub tokens: u64,
    /// Records with neither a list price nor a recorded cost.
    pub unpriced: u32,
    pub providers: Vec<SpendShare>,
    /// Top 5.
    pub models: Vec<SpendShare>,
    /// Top 5.
    pub projects: Vec<SpendShare>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpendShare {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    pub cost_usd: f64,
    pub tokens: u64,
}

/// Epoch seconds.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpendBlock {
    pub start: f64,
    pub end: f64,
    pub cost_usd: f64,
    pub tokens: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
enum Provider {
    Claude,
    Codex,
    OpenCode,
    Copilot,
}

impl Provider {
    fn name(self) -> &'static str {
        match self {
            Provider::Claude => "claude",
            Provider::Codex => "codex",
            Provider::OpenCode => "opencode",
            Provider::Copilot => "copilot",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
struct Record {
    provider: Provider,
    /// Unix seconds.
    date: f64,
    model: Arc<str>,
    project: Arc<str>,
    session: Arc<str>,
    billable: Billable,
    reported_cost: Option<f64>,
}

// ---- parsing helpers -------------------------------------------------------

/// `YYYY-MM-DDThh:mm:ss[.fff]` with `Z` or `±hh:mm`, as the agents write it
/// (Vorssaint `Engine/src/timestamp.rs`). Anything else is `None`.
fn parse_iso(b: &[u8]) -> Option<f64> {
    if b.len() < 20
        || b[4] != b'-'
        || b[7] != b'-'
        || b[10] != b'T'
        || b[13] != b':'
        || b[16] != b':'
    {
        return None;
    }
    let number = |from: usize, to: usize| -> Option<i64> {
        b[from..to].iter().try_fold(0i64, |value, &c| {
            c.is_ascii_digit().then(|| value * 10 + (c - b'0') as i64)
        })
    };
    let (year, month, day) = (number(0, 4)?, number(5, 7)?, number(8, 10)?);
    let (hour, minute, second) = (number(11, 13)?, number(14, 16)?, number(17, 19)?);
    if !(1..=12).contains(&month)
        || !(1..=31).contains(&day)
        || hour >= 24
        || minute >= 60
        || second >= 61
    {
        return None;
    }
    let mut index = 19;
    let mut fraction = 0.0f64;
    if b[index] == b'.' {
        let mut scale = 0.1f64;
        index += 1;
        while index < b.len() && b[index].is_ascii_digit() {
            fraction += (b[index] - b'0') as f64 * scale;
            scale /= 10.0;
            index += 1;
        }
    }
    if index >= b.len() {
        return None;
    }
    let mut offset = 0i64;
    match b[index] {
        b'Z' if index == b.len() - 1 => {}
        b'+' | b'-' if b.len() == index + 6 && b[index + 3] == b':' => {
            let (hours, minutes) = (number(index + 1, index + 3)?, number(index + 4, index + 6)?);
            offset = (hours * 3600 + minutes * 60) * if b[index] == b'+' { 1 } else { -1 };
        }
        _ => return None,
    }
    // Days since 1970 from the civil date, valid for every Gregorian year.
    let y = if month <= 2 { year - 1 } else { year };
    let era = (if y >= 0 { y } else { y - 399 }) / 400;
    let yoe = y - era * 400;
    let doy = (153 * (month + if month > 2 { -3 } else { 9 }) + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146_097 + doe - 719_468;
    Some((days * 86_400 + hour * 3600 + minute * 60 + second - offset) as f64 + fraction)
}

/// Epoch seconds; a value above 1e11 is milliseconds.
fn seconds(raw: f64) -> Option<f64> {
    (raw.is_finite() && raw > 0.0).then(|| if raw > 1e11 { raw / 1000.0 } else { raw })
}

/// An ISO string or a number of seconds/milliseconds; unparsable is `None`
/// (the record is skipped, never dated "now").
pub(super) fn timestamp(v: &Value) -> Option<f64> {
    match v {
        Value::String(s) => parse_iso(s.as_bytes()),
        Value::Number(n) => seconds(n.as_f64()?),
        _ => None,
    }
}

fn int(v: &Value) -> u64 {
    v.as_f64()
        .filter(|n| n.is_finite() && *n > 0.0)
        .map_or(0, |n| n.min(1e12) as u64)
}

fn non_empty(v: &Value) -> Option<&str> {
    v.as_str().filter(|s| !s.is_empty())
}

fn project_name(path: &str) -> String {
    let mut p = path
        .find("/.claude/worktrees/")
        .map_or(path, |i| &path[..i]);
    while p.len() > 1 && p.ends_with('/') {
        p = &p[..p.len() - 1];
    }
    if p == "/" {
        return "/".into();
    }
    p.rsplit('/').next().unwrap_or(p).to_string()
}

// ---- per-file parser state -------------------------------------------------

/// What one log file's parser carries between lines.
#[derive(Default)]
struct State {
    session: Arc<str>,
    project: Arc<str>,
    model: Arc<str>,
    /// Codex: a `token_usage_record` was seen, so `token_count` is ignored.
    saw_usage_records: bool,
    last_total: Option<Tokens>,
    fast: bool,
    codex_header_read: bool,
    codex_totals_session: String,
    copilot_totals: HashMap<String, Tokens>,
}

fn set(slot: &mut Arc<str>, value: &str) {
    if **slot != *value {
        *slot = value.into();
    }
}

impl State {
    fn record(&self, provider: Provider, date: f64, billable: Billable) -> Record {
        Record {
            provider,
            date,
            model: self.model.clone(),
            project: self.project.clone(),
            session: self.session.clone(),
            billable,
            reported_cost: None,
        }
    }
}

type Parsed = Vec<(String, Record)>;

fn parse_line(provider: Provider, line: &str, st: &mut State) -> Parsed {
    match provider {
        Provider::Claude => parse_claude(line, st),
        Provider::Codex => parse_codex(line, st),
        Provider::Copilot => parse_copilot(line, st),
        Provider::OpenCode => vec![],
    }
}

fn parse_claude(line: &str, st: &mut State) -> Parsed {
    if !line.contains("\"type\":\"assistant\"") {
        return vec![];
    }
    let Ok(v) = serde_json::from_str::<Value>(line) else {
        return vec![];
    };
    if v["type"] != "assistant" {
        return vec![];
    }
    if let Some(session) = non_empty(&v["sessionId"]) {
        set(&mut st.session, session);
    }
    if let Some(cwd) = non_empty(&v["cwd"]) {
        set(&mut st.project, &project_name(cwd));
    }
    let message = &v["message"];
    let usage = &message["usage"];
    // `<synthetic>` and friends are the CLI talking, not a model.
    let Some(model) = non_empty(&message["model"]).filter(|m| !m.starts_with('<')) else {
        return vec![];
    };
    if !message.is_object() || !usage.is_object() {
        return vec![];
    }
    set(&mut st.model, model);
    let Some(date) = timestamp(&v["timestamp"]) else {
        return vec![];
    };
    let billable = Billable {
        tokens: Tokens {
            input: int(&usage["input_tokens"]),
            cache_write: int(&usage["cache_creation_input_tokens"]),
            cache_read: int(&usage["cache_read_input_tokens"]),
            output: int(&usage["output_tokens"]),
            reasoning: int(&usage["output_tokens_details"]["thinking_tokens"]),
        },
        long_cache_write: int(&usage["cache_creation"]["ephemeral_1h_input_tokens"]),
        fast: usage["speed"] == "fast",
        domestic: usage["inference_geo"] == "us",
        web_searches: int(&usage["server_tool_use"]["web_search_requests"]),
        is_aggregate: false,
    };
    let (id, request) = (
        message["id"].as_str().unwrap_or(""),
        v["requestId"].as_str().unwrap_or(""),
    );
    let key = if id.is_empty() && request.is_empty() {
        format!("claude:{}:{date}", st.session)
    } else {
        format!("claude:{id}:{request}")
    };
    vec![(key, st.record(Provider::Claude, date, billable))]
}

fn codex_tokens(usage: &Value) -> Tokens {
    Tokens::codex(
        int(&usage["input_tokens"]),
        int(&usage["cached_input_tokens"]),
        int(&usage["cache_write_input_tokens"]),
        int(&usage["output_tokens"]),
        int(&usage["reasoning_output_tokens"]),
    )
}

fn fast_tier(tier: &Value) -> bool {
    tier.as_str()
        .is_some_and(|t| matches!(t.to_lowercase().as_str(), "fast" | "priority"))
}

fn parse_codex(line: &str, st: &mut State) -> Parsed {
    const EVENTS: [&str; 5] = [
        "session_meta",
        "turn_context",
        "token_count",
        "token_usage_record",
        "thread_settings_applied",
    ];
    if !EVENTS.iter().any(|e| line.contains(e)) {
        return vec![];
    }
    let Ok(v) = serde_json::from_str::<Value>(line) else {
        return vec![];
    };
    let payload = &v["payload"];
    if !payload.is_object() {
        return vec![];
    }
    let billable = |tokens| Billable {
        tokens,
        fast: st.fast,
        ..Default::default()
    };
    match v["type"].as_str().unwrap_or("") {
        "session_meta" => {
            if let Some(id) = non_empty(&payload["id"]) {
                st.codex_totals_session = id.to_string();
            }
            if !st.codex_header_read {
                st.codex_header_read = true;
                if let Some(id) = non_empty(&payload["id"]) {
                    set(&mut st.session, id);
                }
                if let Some(cwd) = non_empty(&payload["cwd"]) {
                    set(&mut st.project, &project_name(cwd));
                }
            }
        }
        "turn_context" => {
            if let Some(model) = non_empty(&payload["model"]) {
                set(&mut st.model, model);
            }
            if let Some(cwd) = non_empty(&payload["cwd"]) {
                set(&mut st.project, &project_name(cwd));
            }
            if let Some(tier) = payload.get("service_tier") {
                st.fast = fast_tier(tier);
            }
        }
        "token_usage_record" => {
            let usage = &payload["usage"];
            if !usage.is_object() {
                return vec![];
            }
            st.saw_usage_records = true;
            if let Some(session) = non_empty(&payload["session_id"]) {
                if st.session.is_empty() {
                    set(&mut st.session, session);
                }
            }
            let Some(date) = timestamp(&v["timestamp"]) else {
                return vec![];
            };
            let key = match non_empty(&payload["response_id"]) {
                Some(id) => format!("codex:{id}"),
                None => format!("codex:{}:{date}", st.session),
            };
            let record = st.record(Provider::Codex, date, billable(codex_tokens(usage)));
            return vec![(key, record)];
        }
        "event_msg" => match payload["type"].as_str().unwrap_or("") {
            "thread_settings_applied" => {
                if let Some(tier) = payload["thread_settings"].get("service_tier") {
                    st.fast = fast_tier(tier);
                }
            }
            "token_count" if !st.saw_usage_records => {
                let info = &payload["info"];
                if !info["total_token_usage"].is_object() {
                    return vec![];
                }
                let total = codex_tokens(&info["total_token_usage"]);
                let previous = st.last_total;
                let grew =
                    Some(total) != previous && total.total() > previous.map_or(0, |p| p.total());
                st.last_total = Some(total);
                let date = timestamp(&v["timestamp"]);
                if let (true, Some(date)) = (grew, date) {
                    let delta = if info["last_token_usage"].is_object() {
                        codex_tokens(&info["last_token_usage"])
                    } else {
                        let p = previous.unwrap_or_default();
                        Tokens {
                            input: total.input.saturating_sub(p.input),
                            cache_write: total.cache_write.saturating_sub(p.cache_write),
                            cache_read: total.cache_read.saturating_sub(p.cache_read),
                            output: total.output.saturating_sub(p.output),
                            reasoning: total.reasoning.saturating_sub(p.reasoning),
                        }
                    };
                    let key = format!("codex:{}:total:{}", st.codex_totals_session, total.total());
                    return vec![(key, st.record(Provider::Codex, date, billable(delta)))];
                }
            }
            _ => {}
        },
        _ => {}
    }
    vec![]
}

fn copilot_project(data: &Value) -> Option<String> {
    let context = data.get("context").unwrap_or(data);
    ["gitRoot", "cwd", "repository"]
        .iter()
        .find_map(|k| non_empty(&context[k]))
        .map(project_name)
}

/// ponytail: session-shutdown model totals only (no per-request activity
/// records or request-count reconciliation); a session that never shut down
/// cleanly has no usage until it does.
fn parse_copilot(line: &str, st: &mut State) -> Parsed {
    if ![
        "session.start",
        "session.context_changed",
        "session.shutdown",
    ]
    .iter()
    .any(|e| line.contains(e))
    {
        return vec![];
    }
    let Ok(v) = serde_json::from_str::<Value>(line) else {
        return vec![];
    };
    // Subagent events share the root log; only the root's context counts.
    if non_empty(&v["agentId"]).is_some() {
        return vec![];
    }
    let data = &v["data"];
    match v["type"].as_str().unwrap_or("") {
        "session.start" => {
            if let Some(session) = non_empty(&data["sessionId"]) {
                set(&mut st.session, session);
            }
            if let Some(project) = copilot_project(data) {
                set(&mut st.project, &project);
            }
        }
        "session.context_changed" => {
            if let Some(project) = copilot_project(data) {
                set(&mut st.project, &project);
            }
        }
        "session.shutdown" => {
            let (Some(metrics), Some(date)) =
                (data["modelMetrics"].as_object(), timestamp(&v["timestamp"]))
            else {
                return vec![];
            };
            let checkpoint = non_empty(&v["id"]).map_or_else(|| date.to_string(), String::from);
            let mut out = vec![];
            for (model, metric) in metrics.iter().filter(|(_, m)| m.is_object()) {
                let total = copilot_tokens(metric);
                let growth = match st.copilot_totals.insert(model.clone(), total) {
                    Some(p) if total.total() >= p.total() => Tokens {
                        input: total.input.saturating_sub(p.input),
                        cache_write: total.cache_write.saturating_sub(p.cache_write),
                        cache_read: total.cache_read.saturating_sub(p.cache_read),
                        output: total.output.saturating_sub(p.output),
                        reasoning: total.reasoning.saturating_sub(p.reasoning),
                    },
                    _ => total,
                };
                if growth.total() == 0 {
                    continue;
                }
                let billable = Billable {
                    tokens: growth,
                    is_aggregate: true,
                    ..Default::default()
                };
                let mut record = st.record(Provider::Copilot, date, billable);
                record.model = model.as_str().into();
                out.push((
                    format!("copilot:{}:{checkpoint}:{model}", st.session),
                    record,
                ));
            }
            return out;
        }
        _ => {}
    }
    vec![]
}

fn copilot_tokens(metric: &Value) -> Tokens {
    let (details, usage) = (&metric["tokenDetails"], &metric["usage"]);
    let count = |detail: &str, fallback: &str| match details[detail].get("tokenCount") {
        Some(n) => int(n),
        None => int(&usage[fallback]),
    };
    Tokens {
        input: count("input", "inputTokens"),
        cache_write: count("cache_write", "cacheWriteTokens"),
        cache_read: count("cache_read", "cacheReadTokens"),
        output: count("output", "outputTokens"),
        reasoning: int(&usage["reasoningTokens"]),
    }
}

// ---- OpenCode --------------------------------------------------------------

/// Assistant messages created since `since_ms`, from OpenCode's SQLite db
/// (v2: `session_message`/`session_v2`, role in `type`; v1: `message`/`session`,
/// role in the JSON). `None` when the db cannot be read right now.
///
/// ponytail: a full re-query of the horizon whenever the db changed; fine for
/// small dbs. Upgrade: a rowid cursor plus tracking of replies still open. The
/// model comes from the assistant row only (not from the user message).
fn opencode_rows(path: &Path, since_ms: f64) -> Option<Parsed> {
    use rusqlite::{types::ValueRef, Connection, OpenFlags};
    let db = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .ok()?;
    db.busy_timeout(Duration::from_secs(2)).ok()?;
    let v2 = db
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='session_v2'",
            [],
            |_| Ok(()),
        )
        .is_ok();
    let (messages, sessions, role) = if v2 {
        ("session_message", "session_v2", "m.type")
    } else {
        ("message", "session", "json_extract(m.data,'$.role')")
    };
    let sql = format!(
        "SELECT m.id, m.session_id, m.time_created, s.directory, m.data \
         FROM {messages} m JOIN {sessions} s ON m.session_id = s.id \
         WHERE {role} = 'assistant' AND m.time_created >= ?1"
    );
    let mut stmt = db.prepare(&sql).ok()?;
    let rows = stmt
        .query_map([since_ms], |r| {
            let data = match r.get_ref(4)? {
                ValueRef::Text(t) | ValueRef::Blob(t) => String::from_utf8_lossy(t).into_owned(),
                _ => String::new(),
            };
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, f64>(2)?,
                r.get::<_, Option<String>>(3)?,
                data,
            ))
        })
        .ok()?;
    let mut out = vec![];
    for (id, session, created, directory, data) in rows.flatten() {
        let Ok(d) = serde_json::from_str::<Value>(&data) else {
            continue;
        };
        let reasoning = int(&d["tokens"]["reasoning"]);
        let tokens = Tokens {
            input: int(&d["tokens"]["input"]),
            cache_write: int(&d["tokens"]["cache"]["write"]),
            cache_read: int(&d["tokens"]["cache"]["read"]),
            // OpenCode's output includes reasoning (unlike Claude/Codex).
            output: int(&d["tokens"]["output"]) + reasoning,
            reasoning,
        };
        let reported_cost = d["cost"].as_f64().filter(|c| c.is_finite());
        if tokens.total() == 0 && reported_cost.unwrap_or(0.0) <= 0.0 {
            continue;
        }
        let model = ["model_id", "modelID"]
            .iter()
            .find_map(|k| non_empty(&d[k]))
            .or_else(|| non_empty(&d["model"]["modelID"]))
            .or_else(|| non_empty(&d["model"]["id"]))
            .or_else(|| non_empty(&d["model"]))
            .unwrap_or("");
        let cwd = non_empty(&d["path"]["cwd"]).or(directory.as_deref().filter(|s| !s.is_empty()));
        let date = d["time"]["created"]
            .as_f64()
            .and_then(seconds)
            .or_else(|| seconds(created));
        let Some(date) = date else { continue };
        out.push((
            format!("opencode:{session}:{id}"),
            Record {
                provider: Provider::OpenCode,
                date,
                model: model.into(),
                project: cwd.map(project_name).unwrap_or_default().into(),
                session: session.as_str().into(),
                billable: Billable {
                    tokens,
                    ..Default::default()
                },
                reported_cost,
            },
        ));
    }
    Some(out)
}

// ---- ledger ----------------------------------------------------------------

struct Entry {
    record: Record,
    /// Ids of the source files holding this key.
    holders: Vec<u32>,
}

/// A source file's reading position and parser state. OpenCode's db has no
/// byte offset: its `offset` holds the db's modification stamp (ms).
#[derive(Default)]
struct Cursor {
    id: u32,
    inode: u64,
    offset: u64,
    state: State,
    keys: Vec<Arc<str>>,
}

#[derive(Default)]
struct Ledger {
    records: HashMap<Arc<str>, Entry>,
    files: HashMap<PathBuf, Cursor>,
    last_id: u32,
}

fn max_tokens(a: Tokens, b: Tokens) -> Tokens {
    Tokens {
        input: a.input.max(b.input),
        cache_write: a.cache_write.max(b.cache_write),
        cache_read: a.cache_read.max(b.cache_read),
        output: a.output.max(b.output),
        reasoning: a.reasoning.max(b.reasoning),
    }
}

impl Ledger {
    fn cursor(&mut self, path: &Path) -> Cursor {
        self.files.remove(path).unwrap_or_else(|| {
            self.last_id += 1;
            Cursor {
                id: self.last_id,
                ..Default::default()
            }
        })
    }

    fn add(&mut self, cursor: &mut Cursor, key: String, record: Record) {
        let key: Arc<str> = key.into();
        match self.records.entry(key.clone()) {
            MapEntry::Vacant(slot) => {
                slot.insert(Entry {
                    record,
                    holders: vec![cursor.id],
                });
                cursor.keys.push(key);
            }
            MapEntry::Occupied(slot) => {
                let entry = slot.into_mut();
                if !entry.holders.contains(&cursor.id) {
                    entry.holders.push(cursor.id);
                    cursor.keys.push(key);
                }
                if record.provider == Provider::Claude {
                    // A streamed reply repeats with growing counts.
                    let (old, new) = (&mut entry.record, record);
                    old.billable.tokens = max_tokens(old.billable.tokens, new.billable.tokens);
                    old.billable.long_cache_write = old
                        .billable
                        .long_cache_write
                        .max(new.billable.long_cache_write);
                    old.billable.web_searches =
                        old.billable.web_searches.max(new.billable.web_searches);
                    old.billable.fast = new.billable.fast;
                    old.billable.domestic = new.billable.domestic;
                    old.model = new.model;
                } else {
                    entry.record = record;
                }
            }
        }
    }

    /// Takes back every key this file held; a key goes when no file holds it.
    fn forget(&mut self, cursor: &mut Cursor) {
        for key in cursor.keys.drain(..) {
            if let Some(entry) = self.records.get_mut(&*key) {
                entry.holders.retain(|h| *h != cursor.id);
                if entry.holders.is_empty() {
                    self.records.remove(&*key);
                }
            }
        }
    }

    /// Reads the complete lines appended since the last call. A replaced file
    /// (other inode) or a shorter one starts over, taking its records back.
    fn read_jsonl(&mut self, path: &Path, provider: Provider) {
        let Ok(meta) = std::fs::metadata(path) else {
            return;
        };
        if !meta.is_file() {
            return;
        }
        let mut cursor = self.cursor(path);
        let inode = inode(&meta);
        if cursor.inode != inode || meta.len() < cursor.offset {
            self.forget(&mut cursor);
            cursor.inode = inode;
            cursor.offset = 0;
            cursor.state = State::default();
        }
        if meta.len() > cursor.offset {
            self.read_from_offset(path, provider, &mut cursor);
        }
        self.files.insert(path.to_path_buf(), cursor);
    }

    fn read_from_offset(&mut self, path: &Path, provider: Provider, cursor: &mut Cursor) {
        let Ok(mut file) = std::fs::File::open(path) else {
            return;
        };
        if file.seek(SeekFrom::Start(cursor.offset)).is_err() {
            return;
        }
        let mut reader = BufReader::with_capacity(1 << 20, file);
        let mut line = Vec::new();
        loop {
            line.clear();
            let Ok(n) = (&mut reader)
                .take(MAX_LINE + 1)
                .read_until(b'\n', &mut line)
            else {
                return;
            };
            if n == 0 {
                return;
            }
            if line.ends_with(b"\n") {
                cursor.offset += n as u64;
                if let Ok(text) = std::str::from_utf8(&line) {
                    for (key, record) in parse_line(provider, text, &mut cursor.state) {
                        self.add(cursor, key, record);
                    }
                }
            } else if n as u64 > MAX_LINE {
                // Too long to be a log record: skip through its newline.
                let mut skipped = n as u64;
                loop {
                    line.clear();
                    match (&mut reader).take(1 << 20).read_until(b'\n', &mut line) {
                        Ok(m) if m > 0 => {
                            skipped += m as u64;
                            if line.ends_with(b"\n") {
                                break;
                            }
                        }
                        _ => return,
                    }
                }
                cursor.offset += skipped;
            } else {
                return; // an unfinished last line is read again next time
            }
        }
    }

    fn read_opencode(&mut self, path: &Path, stamp_ms: u64, since_ms: f64) {
        let mut cursor = self.cursor(path);
        if cursor.offset != stamp_ms {
            if let Some(rows) = opencode_rows(path, since_ms) {
                self.forget(&mut cursor);
                for (key, record) in rows {
                    self.add(&mut cursor, key, record);
                }
                cursor.offset = stamp_ms;
            }
        }
        self.files.insert(path.to_path_buf(), cursor);
    }
}

#[cfg(unix)]
fn inode(meta: &std::fs::Metadata) -> u64 {
    std::os::unix::fs::MetadataExt::ino(meta)
}

#[cfg(not(unix))]
fn inode(_: &std::fs::Metadata) -> u64 {
    0
}

fn walk_jsonl(dir: &Path, cutoff: SystemTime, out: &mut Vec<PathBuf>) {
    for entry in std::fs::read_dir(dir).into_iter().flatten().flatten() {
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        let path = entry.path();
        if kind.is_dir() {
            walk_jsonl(&path, cutoff, out);
        } else if kind.is_file()
            && path.extension().is_some_and(|e| e == "jsonl")
            && entry
                .metadata()
                .and_then(|m| m.modified())
                .is_ok_and(|m| m >= cutoff)
        {
            out.push(path);
        }
    }
}

fn modified_ms(path: &Path) -> Option<u64> {
    let m = std::fs::metadata(path).ok()?.modified().ok()?;
    Some(m.duration_since(UNIX_EPOCH).ok()?.as_millis() as u64)
}

/// Every source file inside the horizon, with the OpenCode db's stamp.
fn discover(now: f64) -> Vec<(PathBuf, Provider)> {
    let Some(home) = super::home() else {
        return vec![];
    };
    let cutoff = UNIX_EPOCH + Duration::from_secs_f64((now - HORIZON_DAYS * 86_400.0).max(0.0));
    let accounts = super::accounts();
    let mut roots: Vec<(PathBuf, Provider)> =
        vec![(home.join(".config/claude/projects"), Provider::Claude)];
    for a in &accounts {
        match a.provider {
            "claude" => roots.push((a.dir.join("projects"), Provider::Claude)),
            "codex" => {
                roots.push((a.dir.join("sessions"), Provider::Codex));
                roots.push((a.dir.join("archived_sessions"), Provider::Codex));
            }
            _ => {}
        }
    }
    roots.sort();
    roots.dedup();
    let mut found = vec![];
    for (root, provider) in roots {
        let mut files = vec![];
        walk_jsonl(&root, cutoff, &mut files);
        found.extend(files.into_iter().map(|f| (f, provider)));
    }
    let copilot = home.join(".copilot/session-state");
    for entry in std::fs::read_dir(copilot).into_iter().flatten().flatten() {
        let events = entry.path().join("events.jsonl");
        let fresh = std::fs::metadata(&events)
            .and_then(|m| m.modified())
            .is_ok_and(|m| m >= cutoff);
        if !entry.file_name().to_string_lossy().starts_with('.') && fresh {
            found.push((events, Provider::Copilot));
        }
    }
    found.sort();
    found.dedup();
    found
}

fn opencode_db(home: &Path) -> PathBuf {
    std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .filter(|p| p.is_absolute())
        .unwrap_or_else(|| home.join(".local/share"))
        .join("opencode/opencode.db")
}

/// Brings the ledger up to date with what is on disk.
fn refresh(ledger: &mut Ledger, now: f64) {
    let mut found = discover(now);
    let since_ms = (now - HORIZON_DAYS * 86_400.0) * 1000.0;
    let mut opencode = None;
    if let Some(home) = super::home() {
        let db = opencode_db(&home);
        let wal = db.with_file_name("opencode.db-wal");
        let stamp = [modified_ms(&db), modified_ms(&wal)]
            .into_iter()
            .flatten()
            .max();
        if let Some(stamp) = stamp.filter(|s| *s as f64 >= since_ms) {
            found.push((db.clone(), Provider::OpenCode));
            opencode = Some((db, stamp));
        }
    }
    // A file that left the horizon (or disappeared) gives its records back.
    let present: std::collections::HashSet<&PathBuf> = found.iter().map(|(p, _)| p).collect();
    let gone: Vec<PathBuf> = ledger
        .files
        .keys()
        .filter(|p| !present.contains(p))
        .cloned()
        .collect();
    for path in gone {
        if let Some(mut cursor) = ledger.files.remove(&path) {
            ledger.forget(&mut cursor);
        }
    }
    for (path, provider) in &found {
        match (provider, &opencode) {
            (Provider::OpenCode, Some((db, stamp))) if db == path => {
                ledger.read_opencode(path, *stamp, since_ms)
            }
            (Provider::OpenCode, _) => {}
            _ => ledger.read_jsonl(path, *provider),
        }
    }
}

// ---- aggregation -----------------------------------------------------------

#[cfg(unix)]
fn utc_offset(secs: i64) -> i64 {
    let t = secs as libc::time_t;
    // SAFETY: `tm` is plain data that `localtime_r` fills; a null result leaves it unused.
    let mut tm: libc::tm = unsafe { std::mem::zeroed() };
    if unsafe { libc::localtime_r(&t, &mut tm) }.is_null() {
        0
    } else {
        tm.tm_gmtoff as i64
    }
}

#[cfg(not(unix))]
fn utc_offset(_: i64) -> i64 {
    0
}

/// Local calendar day number (days since 1970 in the local time zone).
pub(super) fn local_day(t: f64) -> i64 {
    let secs = t.floor() as i64;
    (secs + utc_offset(secs)).div_euclid(86_400)
}

#[derive(Default)]
struct Totals {
    cost: f64,
    saved: f64,
    tokens: u64,
    unpriced: u32,
    providers: HashMap<(Option<&'static str>, String), (f64, u64)>,
    models: HashMap<(Option<&'static str>, String), (f64, u64)>,
    projects: HashMap<(Option<&'static str>, String), (f64, u64)>,
}

fn shares(
    map: HashMap<(Option<&'static str>, String), (f64, u64)>,
    by_cost: bool,
) -> Vec<SpendShare> {
    let mut list: Vec<SpendShare> = map
        .into_iter()
        .map(|((provider, name), (cost_usd, tokens))| SpendShare {
            name,
            provider: provider.map(Into::into),
            cost_usd,
            tokens,
        })
        .collect();
    let weight = |s: &SpendShare| if by_cost { s.cost_usd } else { s.tokens as f64 };
    list.sort_by(|a, b| {
        weight(b)
            .total_cmp(&weight(a))
            .then_with(|| a.name.cmp(&b.name))
    });
    list
}

/// Today / 7 / 30 local days (`day_of` maps epoch seconds to a day number),
/// the open Claude 5-hour block and the last half hour's pace.
fn summarize<'a>(
    records: impl IntoIterator<Item = &'a Record>,
    prices: &PriceList,
    now: f64,
    day_of: impl Fn(f64) -> i64,
) -> SpendSummary {
    let today = day_of(now);
    let mut periods: Vec<Totals> = PERIOD_DAYS.iter().map(|_| Totals::default()).collect();
    let mut by_model: HashMap<Arc<str>, (Option<&prices::Price>, String)> = HashMap::new();
    let mut claude_recent: Vec<(f64, f64, u64)> = vec![];
    let mut burn = 0.0;
    for r in records {
        let day = day_of(r.date);
        if day > today || day <= today - i64::from(PERIOD_DAYS[2]) {
            continue;
        }
        let (price, display) = by_model
            .entry(r.model.clone())
            .or_insert_with(|| (prices.price(&r.model), PriceList::display_name(&r.model)));
        let priced = prices.cost_with(*price, &r.billable);
        let cost = priced.map(|c| c.usd).or(r.reported_cost);
        let tokens = r.billable.tokens.total();
        let model_name = if display.is_empty() {
            "Unknown"
        } else {
            display.as_str()
        };
        for (totals, &days) in periods.iter_mut().zip(&PERIOD_DAYS) {
            if day <= today - i64::from(days) {
                continue;
            }
            totals.cost += cost.unwrap_or(0.0);
            totals.saved += priced.map_or(0.0, |c| c.saved);
            totals.tokens += tokens;
            totals.unpriced += u32::from(cost.is_none());
            let add = |map: &mut HashMap<_, (f64, u64)>, key: (Option<&'static str>, String)| {
                let slot = map.entry(key).or_default();
                slot.0 += cost.unwrap_or(0.0);
                slot.1 += tokens;
            };
            add(&mut totals.providers, (None, r.provider.name().to_string()));
            add(
                &mut totals.models,
                (Some(r.provider.name()), model_name.to_string()),
            );
            if !r.project.is_empty() {
                add(&mut totals.projects, (None, r.project.to_string()));
            }
        }
        if r.date <= now {
            if r.provider == Provider::Claude && r.date > now - 86_400.0 {
                claude_recent.push((r.date, cost.unwrap_or(0.0), tokens));
            }
            if r.date >= now - BURN_WINDOW_SECS {
                burn += cost.unwrap_or(0.0);
            }
        }
    }
    claude_recent.sort_by(|a, b| a.0.total_cmp(&b.0));
    // A block starts at the first request after the previous one ended
    // (not clock-aligned) and holds everything inside its 5 hours.
    let mut block: Option<SpendBlock> = None;
    for (date, cost, tokens) in claude_recent {
        match block.as_mut() {
            Some(b) if date < b.end => {
                b.cost_usd += cost;
                b.tokens += tokens;
            }
            _ => {
                block = Some(SpendBlock {
                    start: date,
                    end: date + BLOCK_SECS,
                    cost_usd: cost,
                    tokens,
                })
            }
        }
    }
    SpendSummary {
        periods: periods
            .into_iter()
            .zip(PERIOD_DAYS)
            .map(|(t, days)| {
                // Shares rank by dollars only when every record has a price.
                let by_cost = t.unpriced == 0;
                let top = |mut list: Vec<SpendShare>| {
                    list.truncate(TOP_SHARES);
                    list
                };
                SpendPeriod {
                    days,
                    cost_usd: t.cost,
                    saved_usd: t.saved,
                    tokens: t.tokens,
                    unpriced: t.unpriced,
                    providers: shares(t.providers, by_cost),
                    models: top(shares(t.models, by_cost)),
                    projects: top(shares(t.projects, by_cost)),
                }
            })
            .collect(),
        block: block.filter(|b| b.end > now),
        burn_per_hour_usd: (burn > 0.0).then(|| burn * 3600.0 / BURN_WINDOW_SECS),
        prices_updated: prices.updated.clone(),
    }
}

static LEDGER: OnceLock<Mutex<Ledger>> = OnceLock::new();

/// The current spend, after bringing the in-memory ledger up to date. All file
/// and SQLite work runs on a blocking thread; the first call scans the horizon.
pub async fn spend() -> SpendSummary {
    spend_with(Vec::new()).await
}

/// A model call Perch made itself (the reporter), which no agent's log holds.
#[derive(Debug, Clone, PartialEq)]
pub struct OwnCall {
    pub at_ms: i64,
    /// `claude`, `codex`, `pi` or `omp`: whose CLI answered.
    pub provider: String,
    pub model: String,
    pub session: String,
    pub input: u64,
    pub cache_read: u64,
    pub cache_write: u64,
    pub output: u64,
    pub cost_usd: Option<f64>,
}

impl OwnCall {
    fn record(&self) -> Record {
        let tokens = Tokens {
            input: self.input,
            cache_write: self.cache_write,
            cache_read: self.cache_read,
            output: self.output,
            reasoning: 0,
        };
        Record {
            // Pi and OMP route to any provider; their price is the CLI's own reported cost, and
            // the bucket follows the model family.
            provider: if self.provider == "codex" || self.model.to_lowercase().contains("gpt") {
                Provider::Codex
            } else {
                Provider::Claude
            },
            date: self.at_ms as f64 / 1000.0,
            model: self.model.as_str().into(),
            project: "Perch reporter".into(),
            session: self.session.as_str().into(),
            billable: Billable {
                tokens,
                ..Default::default()
            },
            reported_cost: self.cost_usd,
        }
    }
}

/// The current spend with Perch's own model calls counted beside what the agents' logs hold.
pub async fn spend_with(own: Vec<OwnCall>) -> SpendSummary {
    tokio::task::spawn_blocking(move || {
        let now = super::now_secs();
        let prices = prices::current();
        let mut ledger = LEDGER
            .get_or_init(Default::default)
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        refresh(&mut ledger, now);
        let own: Vec<Record> = own.iter().map(OwnCall::record).collect();
        summarize(
            ledger.records.values().map(|e| &e.record).chain(own.iter()),
            &prices,
            now,
            local_day,
        )
    })
    .await
    .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("perch-spend-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn append(path: &Path, lines: &[&str]) {
        let mut f = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .unwrap();
        for line in lines {
            writeln!(f, "{line}").unwrap();
        }
    }

    fn claude_line(id: &str, output: u64, extra: &str) -> String {
        format!(
            r#"{{"type":"assistant","timestamp":"2026-11-05T00:35:59.464Z","sessionId":"s1","requestId":"req_{id}"{extra},"message":{{"id":"msg_{id}","model":"claude-sonnet-5-5","usage":{{"input_tokens":2,"cache_creation_input_tokens":100,"cache_read_input_tokens":200,"output_tokens":{output},"output_tokens_details":{{"thinking_tokens":22}},"cache_creation":{{"ephemeral_1h_input_tokens":60}},"server_tool_use":{{"web_search_requests":1}},"inference_geo":"us","speed":"fast"}}}}}}"#
        )
    }

    fn records(ledger: &Ledger) -> Vec<&Record> {
        let mut all: Vec<_> = ledger.records.values().map(|e| &e.record).collect();
        all.sort_by(|a, b| {
            a.date
                .total_cmp(&b.date)
                .then(a.billable.tokens.output.cmp(&b.billable.tokens.output))
        });
        all
    }

    #[test]
    fn iso_timestamps_follow_the_agent_shapes_and_numbers_the_seconds_rule() {
        assert_eq!(parse_iso(b"1970-01-01T00:00:00Z"), Some(0.0));
        assert_eq!(parse_iso(b"2026-09-21T23:42:45Z"), Some(1_790_034_165.0));
        assert_eq!(
            parse_iso(b"2026-09-22T01:42:45+02:00"),
            Some(1_790_034_165.0)
        );
        assert_eq!(
            parse_iso(b"2026-09-21T20:42:45-03:00"),
            Some(1_790_034_165.0)
        );
        assert_eq!(parse_iso(b"2000-02-29T12:00:00Z"), Some(951_825_600.0));
        let ms = parse_iso(b"2026-09-21T23:42:45.078Z").unwrap();
        assert!((ms - 1_790_034_165.078).abs() < 1e-6);
        for bad in [
            "2026-09-21 23:42:45Z",
            "2026-13-21T23:42:45Z",
            "2026-09-21T23:42:45",
            "2026-09-21T23:42:45+0200",
            "2026-09-21",
        ] {
            assert_eq!(parse_iso(bad.as_bytes()), None, "{bad}");
        }
        assert_eq!(
            timestamp(&serde_json::json!(1_790_034_165)),
            Some(1_790_034_165.0)
        );
        assert_eq!(
            timestamp(&serde_json::json!(1_790_034_165_000u64)),
            Some(1_790_034_165.0)
        );
        assert_eq!(timestamp(&serde_json::json!("garbage")), None);
        assert_eq!(timestamp(&serde_json::json!(0)), None);
    }

    #[test]
    fn project_names_drop_worktree_suffixes_and_trailing_slashes() {
        assert_eq!(project_name("/Users/me/proj"), "proj");
        assert_eq!(
            project_name("/Users/me/proj/.claude/worktrees/feat-x"),
            "proj"
        );
        assert_eq!(project_name("/Users/me/proj///"), "proj");
        assert_eq!(project_name("/"), "/");
    }

    #[test]
    fn claude_lines_merge_streamed_repeats_and_skip_synthetic_models() {
        let dir = temp_dir();
        let log = dir.join("a.jsonl");
        let worktree = r#","cwd":"/Users/me/proj/.claude/worktrees/x""#;
        let sidechain = r#","isSidechain":true"#;
        let synthetic = claude_line("syn", 5, "").replace("claude-sonnet-5-5", "<synthetic>");
        append(
            &log,
            &[
                &claude_line("1", 10, worktree),
                &claude_line("1", 278, worktree),
                &claude_line("1", 50, worktree),
                &claude_line("2", 7, sidechain),
                &synthetic,
                r#"{"type":"user","message":{"content":"hi"}}"#,
                &claude_line("3", 9, "").replace("2026-11-05T00:35:59.464Z", "not a time"),
                "{broken json",
            ],
        );
        let mut ledger = Ledger::default();
        ledger.read_jsonl(&log, Provider::Claude);
        let all = records(&ledger);
        assert_eq!(
            all.len(),
            2,
            "one streamed reply, one sidechain; synthetic and undated skipped"
        );
        let streamed = all
            .iter()
            .find(|r| r.billable.tokens.output == 278)
            .unwrap();
        assert_eq!(&*streamed.project, "proj");
        assert_eq!(&*streamed.session, "s1");
        assert_eq!(&*streamed.model, "claude-sonnet-5-5");
        assert_eq!(
            streamed.date,
            parse_iso(b"2026-11-05T00:35:59.464Z").unwrap()
        );
        let t = streamed.billable;
        assert_eq!(
            (
                t.tokens.input,
                t.tokens.cache_write,
                t.tokens.cache_read,
                t.tokens.reasoning
            ),
            (2, 100, 200, 22)
        );
        assert_eq!(
            (t.long_cache_write, t.web_searches, t.fast, t.domestic),
            (60, 1, true, true)
        );
        assert!(
            all.iter().any(|r| r.billable.tokens.output == 7),
            "sidechain usage counts"
        );
        std::fs::remove_dir_all(dir).ok();
    }

    fn codex_log(lines: &[&str]) -> Vec<(String, Record)> {
        let dir = temp_dir();
        let log = dir.join("rollout.jsonl");
        append(&log, lines);
        let mut ledger = Ledger::default();
        ledger.read_jsonl(&log, Provider::Codex);
        std::fs::remove_dir_all(dir).ok();
        let mut out: Vec<_> = ledger
            .records
            .into_iter()
            .map(|(k, e)| (k.to_string(), e.record))
            .collect();
        out.sort_by(|a, b| a.1.date.total_cmp(&b.1.date));
        out
    }

    const META: &str = r#"{"timestamp":"2026-11-05T00:00:00.000Z","type":"session_meta","payload":{"id":"sess-1","cwd":"/Users/me/proj"}}"#;
    const CONTEXT: &str = r#"{"timestamp":"2026-11-05T00:00:01.000Z","type":"turn_context","payload":{"model":"gpt-6-luna","cwd":"/Users/me/proj","service_tier":null}}"#;

    fn token_count(
        second: u32,
        total_in: u64,
        total_cached: u64,
        total_out: u64,
        last: Option<(u64, u64, u64)>,
    ) -> String {
        let last = last.map_or(String::new(), |(i, c, o)| {
            format!(r#","last_token_usage":{{"input_tokens":{i},"cached_input_tokens":{c},"output_tokens":{o}}}"#)
        });
        format!(
            r#"{{"timestamp":"2026-11-05T00:00:{second:02}.000Z","type":"event_msg","payload":{{"type":"token_count","info":{{"total_token_usage":{{"input_tokens":{total_in},"cached_input_tokens":{total_cached},"output_tokens":{total_out}}}{last}}},"rate_limits":{{}}}}}}"#
        )
    }

    #[test]
    fn codex_token_counts_use_last_usage_else_the_cumulative_delta_and_split_cached_input() {
        let rows = codex_log(&[
            META,
            CONTEXT,
            // Cached input is carved out of input: 1000 - 400 = 600 fresh.
            &token_count(2, 1000, 400, 50, Some((1000, 400, 50))),
            // The same total again adds nothing.
            &token_count(3, 1000, 400, 50, Some((1000, 400, 50))),
            // `last_token_usage` wins over the cumulative difference.
            &token_count(4, 1500, 400, 80, Some((300, 0, 20))),
            // Without it the delta is total minus the previous total.
            &token_count(5, 1800, 500, 100, None),
        ]);
        assert_eq!(rows.len(), 3);
        let tokens: Vec<_> = rows.iter().map(|(_, r)| r.billable.tokens).collect();
        assert_eq!(
            (tokens[0].input, tokens[0].cache_read, tokens[0].output),
            (600, 400, 50)
        );
        assert_eq!(
            (tokens[1].input, tokens[1].cache_read, tokens[1].output),
            (300, 0, 20)
        );
        // Cumulative fallback: input 1800-500 = 1300 vs 1500-400 = 1100 fresh; read +100; output +20.
        assert_eq!(
            (tokens[2].input, tokens[2].cache_read, tokens[2].output),
            (200, 100, 20)
        );
        assert_eq!(&*rows[0].1.model, "gpt-6-luna");
        assert_eq!(&*rows[0].1.project, "proj");
        assert_eq!(&*rows[0].1.session, "sess-1");
        assert!(rows[0].0.starts_with("codex:sess-1:total:"));
        assert!(!rows[0].1.billable.fast);
    }

    #[test]
    fn codex_usage_records_suppress_token_counts_and_fast_tier_is_remembered() {
        let fast = CONTEXT.replace("null", "\"priority\"");
        let record = r#"{"timestamp":"2026-11-05T00:00:03.000Z","type":"token_usage_record","payload":{"session_id":"sess-1","response_id":"resp_1","usage":{"input_tokens":100,"cached_input_tokens":40,"cache_write_input_tokens":10,"output_tokens":5,"reasoning_output_tokens":3}}}"#;
        let rows = codex_log(&[
            META,
            &fast,
            record,
            &token_count(4, 1000, 0, 50, Some((1000, 0, 50))),
        ]);
        assert_eq!(rows.len(), 1);
        let (key, r) = &rows[0];
        assert_eq!(key, "codex:resp_1");
        let t = r.billable.tokens;
        assert_eq!(
            (t.input, t.cache_write, t.cache_read, t.output, t.reasoning),
            (50, 10, 40, 5, 3)
        );
        assert!(r.billable.fast);
    }

    #[test]
    fn opencode_rows_come_from_the_v2_or_v1_schema_and_keep_recorded_cost_for_unpriced_models() {
        let dir = temp_dir();
        for v2 in [true, false] {
            let path = dir.join(format!("opencode-{v2}.db"));
            let db = rusqlite::Connection::open(&path).unwrap();
            let (messages, sessions, role_col) = if v2 {
                ("session_message", "session_v2", "type")
            } else {
                ("message", "session", "unused")
            };
            db.execute_batch(&format!(
                "CREATE TABLE {sessions} (id TEXT, directory TEXT);
                 CREATE TABLE {messages} (id TEXT, session_id TEXT, time_created INTEGER, {role_col} TEXT, data TEXT);
                 INSERT INTO {sessions} VALUES ('ses_1', '/Users/me/proj');"
            ))
            .unwrap();
            let insert = |id: &str, role: &str, created: i64, data: &str| {
                let role = if v2 { role.to_string() } else { String::new() };
                let data = if v2 {
                    data.to_string()
                } else {
                    data.replacen(
                        '{',
                        &format!(
                            "{{\"role\":\"{}\",",
                            if id.starts_with('a') {
                                "assistant"
                            } else {
                                "user"
                            }
                        ),
                        1,
                    )
                };
                db.execute(
                    &format!("INSERT INTO {messages} (id, session_id, time_created, {role_col}, data) VALUES (?1, 'ses_1', ?2, ?3, ?4)"),
                    rusqlite::params![id, created, role, data],
                )
                .unwrap();
            };
            let now_ms = 1_790_034_165_000i64;
            insert(
                "a1",
                "assistant",
                now_ms,
                r#"{"modelID":"claude-sonnet-4-5","tokens":{"input":10,"output":20,"reasoning":5,"cache":{"read":7,"write":3}},"cost":9.0}"#,
            );
            insert(
                "a2",
                "assistant",
                now_ms + 1,
                r#"{"model":{"id":"kimi-k2"},"tokens":{"input":1,"output":2},"cost":0.5,"path":{"cwd":"/Users/me/other"}}"#,
            );
            insert(
                "a3",
                "assistant",
                now_ms + 2,
                r#"{"modelID":"kimi-k2","tokens":{"input":0,"output":0},"cost":0}"#,
            );
            insert(
                "a4",
                "assistant",
                1000,
                r#"{"modelID":"kimi-k2","tokens":{"input":5,"output":5}}"#,
            );
            insert("u1", "user", now_ms, r#"{"tokens":{"input":50}}"#);

            let rows = opencode_rows(&path, now_ms as f64 - 1000.0).expect("db readable");
            assert_eq!(
                rows.len(),
                2,
                "v2={v2}: user, empty and pre-horizon rows are skipped"
            );
            let first = &rows
                .iter()
                .find(|(k, _)| k == "opencode:ses_1:a1")
                .unwrap()
                .1;
            // Output includes reasoning for OpenCode.
            assert_eq!(
                (
                    first.billable.tokens.output,
                    first.billable.tokens.reasoning,
                    first.billable.tokens.cache_write
                ),
                (25, 5, 3)
            );
            assert_eq!((&*first.project, first.reported_cost), ("proj", Some(9.0)));
            assert_eq!(first.date, 1_790_034_165.0);
            let other = &rows
                .iter()
                .find(|(k, _)| k == "opencode:ses_1:a2")
                .unwrap()
                .1;
            assert_eq!(
                (&*other.model, &*other.project, other.reported_cost),
                ("kimi-k2", "other", Some(0.5))
            );

            // The listed model is priced from the list; the unpriced one keeps the recorded cost.
            let list = PriceList::parse(include_str!("agent-prices.json")).unwrap();
            let summary = summarize(rows.iter().map(|(_, r)| r), &list, 1_790_034_200.0, |t| {
                (t / 86_400.0).floor() as i64
            });
            let today = &summary.periods[0];
            assert_eq!(today.unpriced, 0);
            let listed = list.cost(&first.billable, "claude-sonnet-4-5").unwrap().usd;
            assert!(
                (today.cost_usd - (listed + 0.5)).abs() < 1e-9,
                "listed model ignores recorded $9"
            );
        }
        assert!(opencode_rows(&dir.join("missing.db"), 0.0).is_none());
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn copilot_shutdown_records_only_growth_since_the_previous_shutdown() {
        let dir = temp_dir();
        let log = dir.join("events.jsonl");
        let shutdown = |id: &str, second: u32, input: u64, output: u64| {
            format!(
                r#"{{"type":"session.shutdown","id":"{id}","timestamp":"2026-11-05T00:00:{second:02}.000Z","data":{{"modelMetrics":{{"gpt-5.5":{{"usage":{{"inputTokens":{input},"outputTokens":{output},"cacheReadTokens":0}}}}}}}}}}"#
            )
        };
        append(
            &log,
            &[
                r#"{"type":"session.start","id":"e0","timestamp":"2026-11-05T00:00:00.000Z","data":{"sessionId":"cop-1","context":{"cwd":"/Users/me/proj"}}}"#,
                &shutdown("e1", 5, 1000, 100),
                &shutdown("e2", 9, 1500, 160),
                &shutdown("e3", 10, 1500, 160),
                r#"{"type":"session.shutdown","id":"sub","agentId":"a","timestamp":"2026-11-05T00:00:11.000Z","data":{"modelMetrics":{"x":{"usage":{"inputTokens":9}}}}}"#,
            ],
        );
        let mut ledger = Ledger::default();
        ledger.read_jsonl(&log, Provider::Copilot);
        let all = records(&ledger);
        let growth: Vec<_> = all
            .iter()
            .map(|r| (r.billable.tokens.input, r.billable.tokens.output))
            .collect();
        assert_eq!(growth, [(1000, 100), (500, 60)]);
        assert!(all
            .iter()
            .all(|r| r.billable.is_aggregate && &*r.project == "proj" && &*r.session == "cop-1"));
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn incremental_reads_count_only_new_lines_and_a_rewritten_file_starts_over() {
        let dir = temp_dir();
        let (a, b) = (dir.join("a.jsonl"), dir.join("b.jsonl"));
        let mut ledger = Ledger::default();
        append(&a, &[&claude_line("1", 10, ""), &claude_line("2", 20, "")]);
        // The same message also lives in a second file (a resumed session).
        append(&b, &[&claude_line("2", 20, "")]);
        ledger.read_jsonl(&a, Provider::Claude);
        ledger.read_jsonl(&b, Provider::Claude);
        assert_eq!(ledger.records.len(), 2);
        let first_offset = ledger.files[&a].offset;

        // A partial last line is not consumed until its newline arrives.
        let mut f = std::fs::OpenOptions::new().append(true).open(&a).unwrap();
        let line3 = claude_line("3", 30, "");
        write!(f, "{}", &line3[..40]).unwrap();
        ledger.read_jsonl(&a, Provider::Claude);
        assert_eq!(ledger.records.len(), 2);
        assert_eq!(ledger.files[&a].offset, first_offset);
        writeln!(f, "{}", &line3[40..]).unwrap();
        ledger.read_jsonl(&a, Provider::Claude);
        assert_eq!(ledger.records.len(), 3);
        // Nothing appended: nothing re-counted (a re-read would merge by max anyway).
        ledger.read_jsonl(&a, Provider::Claude);
        assert_eq!(ledger.records.len(), 3);

        // Truncated and rewritten: its keys go back, except the one `b` still holds.
        std::fs::write(&a, format!("{}\n", claude_line("9", 1, ""))).unwrap();
        ledger.read_jsonl(&a, Provider::Claude);
        let mut keys: Vec<_> = ledger.records.keys().map(|k| k.to_string()).collect();
        keys.sort();
        assert_eq!(keys, ["claude:msg_2:req_2", "claude:msg_9:req_9"]);
        std::fs::remove_dir_all(dir).ok();
    }

    /// 1 day = 86400 s; day numbers are UTC days so the test is timezone-free.
    fn utc_day(t: f64) -> i64 {
        (t / 86_400.0).floor() as i64
    }

    fn rec(
        provider: Provider,
        model: &str,
        project: &str,
        date: f64,
        input: u64,
        reported: Option<f64>,
    ) -> Record {
        Record {
            provider,
            date,
            model: model.into(),
            project: project.into(),
            session: "s".into(),
            billable: Billable {
                tokens: Tokens {
                    input,
                    ..Default::default()
                },
                ..Default::default()
            },
            reported_cost: reported,
        }
    }

    fn list() -> PriceList {
        PriceList::parse(include_str!("agent-prices.json")).unwrap()
    }

    #[test]
    fn the_reporters_own_calls_are_counted_beside_the_agents_logs() {
        let list = list();
        let day = 86_400.0;
        let now = 100.0 * day + 12.0 * 3600.0;
        let call = |provider: &str, model: &str, input| OwnCall {
            at_ms: (now - 60.0) as i64 * 1000,
            provider: provider.into(),
            model: model.into(),
            session: "child".into(),
            input,
            cache_read: 0,
            cache_write: 0,
            output: 0,
            cost_usd: None,
        };
        // claude-opus-5 is $5 per million input tokens.
        let records = [
            call("claude", "claude-opus-5", 1_000_000).record(),
            call("codex", "unpriced-model", 500).record(),
        ];
        let s = summarize(&records, &list, now, utc_day);
        let today = s.periods.iter().find(|p| p.days == 1).unwrap();
        assert_eq!(today.tokens, 1_000_500);
        assert!((today.cost_usd - 5.0).abs() < 1e-9);
        assert_eq!(today.unpriced, 1, "a call the list cannot price says so");
        assert!(today
            .projects
            .iter()
            .any(|share| share.name == "Perch reporter"));
        let providers: Vec<_> = today
            .providers
            .iter()
            .map(|share| share.name.as_str())
            .collect();
        assert!(providers.contains(&"claude") && providers.contains(&"codex"));
    }

    #[test]
    fn periods_cover_local_days_including_today_and_rank_shares_by_cost_when_fully_priced() {
        let list = list();
        let day = 86_400.0;
        let now = 100.0 * day + 12.0 * 3600.0;
        // claude-opus-5 is $5 per million input tokens.
        let opus = "claude-opus-5";
        let records = [
            rec(
                Provider::Claude,
                opus,
                "alpha",
                now - 3600.0,
                1_000_000,
                None,
            ),
            rec(Provider::Claude, opus, "beta", 100.0 * day, 2_000_000, None), // today, 00:00 sharp
            rec(
                Provider::Claude,
                opus,
                "alpha",
                99.0 * day + 1.0,
                1_000_000,
                None,
            ), // yesterday
            rec(Provider::Claude, opus, "alpha", 94.0 * day, 1_000_000, None), // 6 days back: in the 7
            rec(Provider::Claude, opus, "alpha", 93.0 * day, 1_000_000, None), // 7 days back: out of the 7
            rec(Provider::Claude, opus, "alpha", 71.0 * day, 1_000_000, None), // 29 days back: in the 30
            rec(Provider::Claude, opus, "alpha", 70.0 * day, 1_000_000, None), // 30 days back: out
            rec(
                Provider::Claude,
                opus,
                "alpha",
                now + 2.0 * day,
                1_000_000,
                None,
            ), // future
        ];
        let s = summarize(&records, &list, now, utc_day);
        let by_days = |d: u32| s.periods.iter().find(|p| p.days == d).unwrap();
        assert_eq!(by_days(1).tokens, 3_000_000);
        assert!((by_days(1).cost_usd - 15.0).abs() < 1e-9);
        assert_eq!(by_days(7).tokens, 5_000_000);
        assert_eq!(by_days(30).tokens, 7_000_000);
        assert_eq!(s.prices_updated, list.updated);
        // Today's projects: beta (2M) outranks alpha (1M); one provider share.
        let names: Vec<_> = by_days(1)
            .projects
            .iter()
            .map(|p| p.name.as_str())
            .collect();
        assert_eq!(names, ["beta", "alpha"]);
        assert_eq!(by_days(1).providers.len(), 1);
        assert_eq!(by_days(1).models[0].name, "Opus 5");
        assert_eq!(by_days(1).models[0].provider.as_deref(), Some("claude"));

        // An unpriced record flips ranking to tokens; a recorded cost is not "unpriced".
        let mixed = [
            rec(
                Provider::OpenCode,
                "kimi-k2",
                "cheap",
                now - 10.0,
                10_000_000,
                None,
            ),
            rec(Provider::Claude, opus, "dear", now - 10.0, 1_000_000, None),
            rec(
                Provider::OpenCode,
                "kimi-k2",
                "reported",
                now - 10.0,
                1,
                Some(2.0),
            ),
        ];
        let s = summarize(&mixed, &list, now, utc_day);
        assert_eq!(s.periods[0].unpriced, 1);
        assert!((s.periods[0].cost_usd - 7.0).abs() < 1e-9);
        let names: Vec<_> = s.periods[0]
            .projects
            .iter()
            .map(|p| p.name.as_str())
            .collect();
        assert_eq!(names, ["cheap", "dear", "reported"]);
        // Ties break by name.
        let tied = [
            rec(Provider::Claude, opus, "b", now - 1.0, 100, None),
            rec(Provider::Claude, opus, "a", now - 1.0, 100, None),
        ];
        let names: Vec<_> = summarize(&tied, &list, now, utc_day).periods[0]
            .projects
            .iter()
            .map(|p| p.name.clone())
            .collect();
        assert_eq!(names, ["a", "b"]);
        // Top 5 only.
        let many: Vec<_> = (0..8)
            .map(|i| {
                rec(
                    Provider::Claude,
                    opus,
                    &format!("p{i}"),
                    now - 1.0,
                    100 + i,
                    None,
                )
            })
            .collect();
        assert_eq!(
            summarize(&many, &list, now, utc_day).periods[0]
                .projects
                .len(),
            5
        );
    }

    #[test]
    fn the_claude_block_starts_at_the_first_request_after_the_last_block_ended_and_burn_is_hourly()
    {
        let list = list();
        let hour = 3600.0;
        let now = 1_000_000.0;
        let opus = "claude-opus-5";
        let claude = |ago: f64| rec(Provider::Claude, opus, "p", now - ago, 1_000_000, None);
        // 20h old (own block, ended); 7h, 6.5h and 4h old share one block that
        // ended 2h ago; 1h and 45min old open the block that is still running.
        let records = [
            claude(20.0 * hour),
            claude(7.0 * hour),
            claude(6.5 * hour),
            claude(4.0 * hour),
            claude(1.0 * hour),
            claude(0.75 * hour),
            rec(Provider::Codex, "gpt-5.5", "p", now - 3600.0, 1, None),
        ];
        let s = summarize(&records, &list, now, |t| (t / 86_400.0 / 365.0) as i64);
        let block = s.block.expect("a block is open");
        assert_eq!((block.start, block.end), (now - hour, now + 4.0 * hour));
        assert_eq!(block.tokens, 2_000_000);
        assert!((block.cost_usd - 10.0).abs() < 1e-9);
        // Nothing in the last 30 minutes: no pace; the block ended: none.
        assert_eq!(s.burn_per_hour_usd, None);
        let old = [claude(6.0 * hour)];
        assert!(summarize(&old, &list, now, |_| 0).block.is_none());
        // 30 minutes ago: $5 in half an hour is $10/h.
        let recent = [
            rec(Provider::Claude, opus, "p", now - 600.0, 1_000_000, None),
            rec(Provider::Claude, opus, "p", now - 2400.0, 1_000_000, None),
        ];
        let burn = summarize(&recent, &list, now, |_| 0)
            .burn_per_hour_usd
            .unwrap();
        assert!((burn - 10.0).abs() < 1e-9);
    }

    #[test]
    fn wire_names_are_camel_case_and_unset_fields_stay_off_the_wire() {
        let json = serde_json::to_value(SpendSummary {
            periods: vec![SpendPeriod {
                days: 1,
                ..Default::default()
            }],
            prices_updated: "2026-10-09".into(),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(json["pricesUpdated"], "2026-10-09");
        assert!(json.get("block").is_none() && json.get("burnPerHourUsd").is_none());
        assert_eq!(json["periods"][0]["costUsd"], 0.0);
    }

    /// Real-home timing probe; prints counts and costs only (no paths, models or projects).
    /// `cargo test -p perch-core --release spend_scan_timing -- --ignored --nocapture`
    #[tokio::test]
    #[ignore]
    async fn spend_scan_timing() {
        let cold = std::time::Instant::now();
        let first = spend().await;
        let cold = cold.elapsed();
        let warm = std::time::Instant::now();
        let second = spend().await;
        let warm = warm.elapsed();
        let records = LEDGER.get().map_or(0, |l| l.lock().unwrap().records.len());
        let costs = |s: &SpendSummary| {
            s.periods
                .iter()
                .map(|p| format!("{}d ${:.2}", p.days, p.cost_usd))
                .collect::<Vec<_>>()
                .join(", ")
        };
        println!("cold scan {cold:?}: {}", costs(&first));
        println!("incremental {warm:?}: {}", costs(&second));
        println!(
            "{records} records; tokens (30d): {}, unpriced (30d): {}",
            second.periods[2].tokens, second.periods[2].unpriced
        );
    }
}

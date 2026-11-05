//! Plan usage for the status bar: rolling rate-limit windows (5h, 7d, ...)
//! per provider *account*, the same sources Orca reads
//! (`orca/src/main/rate-limits`). Local host only.
//!
//! - Claude: the CLI's own `get_usage` control request over stream-json stdio
//!   (`claude --print --input-format stream-json ...`, see `cli.rs`), so the
//!   CLI owns auth and token refresh. `get_usage` silently answers from a
//!   cache up to an hour old after a failed fetch, so the account's
//!   `.claude.json` is checked before/after (same organization, fetched just
//!   now); a stale reading counts as a failure. Failure (missing, outdated,
//!   unreachable, stale) falls back to `api.anthropic.com/api/oauth/usage` with
//!   the CLI's OAuth token (macOS keychain, else `<config dir>/.credentials.json`;
//!   re-read once on 401, never refreshed by Perch). A signed-out CLI skips the
//!   fallback. The plan name comes from `.claude.json` whichever source worked.
//! - Codex: `codex app-server` JSON-RPC (`account/read`, `account/rateLimits/read`)
//!   for windows, plan and banked rate-limit resets. Failure falls back to
//!   `chatgpt.com/backend-api/wham/usage` with `<CODEX_HOME>/auth.json`; signed
//!   out skips the fallback.
//! - Kimi Code: `<KIMI_CODE_HOME or ~/.kimi-code>/credentials/kimi-code.json`
//!   -> `api.kimi.com/coding/v1/usages`. Read-only: the CLI owns token refresh.
//! - Grok: `<GROK_HOME or ~/.grok>/auth.json` -> `cli-chat-proxy.grok.com/v1/billing`.
//!
//! Not ported from Orca: Gemini (needs OAuth client secrets scraped from the
//! installed CLI), OpenCode Go and MiniMax (need a pasted cookie / API key),
//! Antigravity.
//!
//! Accounts are config dirs: the default one (`$CLAUDE_CONFIG_DIR`/`~/.claude`,
//! `$CODEX_HOME`/`~/.codex`, ...), sibling dirs `~/.claude-*` / `~/.codex-*` that
//! hold credentials, and entries in `~/.perch/usage-accounts.json`:
//! `[{"provider":"claude","dir":"~/work-claude","label":"work"}]`.
//!
//! To add a provider: one `fetch_*(&Account) -> Option<AccountUsage>` and an
//! arm in `fetch`. HTTP goes through the `curl` CLI (as `hub.rs` does; no HTTP
//! crate), with headers on stdin so tokens never show in `ps`. Results are
//! cached because the endpoints rate-limit. An account whose credentials were
//! found but whose fetch failed is returned with `error` rather than dropped.

mod cli;

use cli::{with_deadline, Conversation, Failure};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

const CACHE_TTL: Duration = Duration::from_secs(180);
const CLAUDE_DEADLINE: Duration = Duration::from_secs(25);
const CLAUDE_EXIT_GRACE: Duration = Duration::from_secs(3);
const CODEX_DEADLINE: Duration = Duration::from_secs(20);
/// `get_usage` older than this before we asked is a cached answer, not a fetch.
const CLAUDE_MAX_CACHE_AGE_MS: f64 = 60_000.0;

const CLAUDE_USAGE_ARGS: [&str; 16] = [
    "--print",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--no-session-persistence",
    "--tools",
    "",
    "--strict-mcp-config",
    "--mcp-config",
    "{\"mcpServers\":{}}",
    "--setting-sources",
    "",
    "--settings",
    "{\"disableAllHooks\":true}",
];

/// `resets_at` is passed through as the provider gave it: an ISO string
/// (Claude) or epoch seconds (Codex). The client turns it into a `Date`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UsageWindow {
    /// Short name derived from the duration: `5h`, `7d`, ...
    pub label: String,
    pub used_percent: f64,
    pub window_minutes: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resets_at: Option<Value>,
    /// What a narrower limit applies to (a model name), when it is not the
    /// account-wide window.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AccountUsage {
    pub provider: String,
    /// Which account, when it can be told (email, dir suffix, configured label).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    /// The subscription tier ("Max 5×", "Plus"), when the provider says.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plan: Option<String>,
    pub windows: Vec<UsageWindow>,
    /// Banked Codex rate-limit resets the user can still redeem.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reset_credits: Option<u32>,
    /// A provider-specific failure that explains why no windows are available.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
struct Account {
    provider: &'static str,
    dir: PathBuf,
    label: Option<String>,
    /// The provider's default login: Claude keeps it under the unscoped
    /// keychain service.
    is_default: bool,
}

/// Cached result. The lock is only held to read/write the cache; provider I/O
/// and CLI conversations run without holding it.
pub async fn current(force_refresh: bool) -> Vec<AccountUsage> {
    type Cached = Option<(Instant, Vec<AccountUsage>)>;
    static CACHE: OnceLock<tokio::sync::Mutex<Cached>> = OnceLock::new();
    let started = Instant::now();
    {
        let cache = CACHE.get_or_init(Default::default).lock().await;
        if !force_refresh {
            if let Some((at, usage)) = cache.as_ref() {
                if at.elapsed() < CACHE_TTL {
                    return usage.clone();
                }
            }
        }
    }
    let usage: Vec<AccountUsage> = futures::future::join_all(accounts().iter().map(fetch))
        .await
        .into_iter()
        .flatten()
        .collect();
    let has_windows = |accounts: &[AccountUsage]| accounts.iter().any(|a| !a.windows.is_empty());
    let mut cache = CACHE.get_or_init(Default::default).lock().await;
    if let Some((at, cached)) = cache.as_ref() {
        if *at > started {
            if has_windows(&usage) && !has_windows(cached) {
                // A later overlapping failure must not erase a successful result.
            } else {
                return cached.clone();
            }
        }
    }
    *cache = Some((Instant::now(), usage.clone()));
    usage
}

async fn fetch(a: &Account) -> Option<AccountUsage> {
    match a.provider {
        "claude" => Some(fetch_claude(a).await),
        "codex" => fetch_codex(a).await,
        "kimi" => fetch_kimi(a).await,
        "grok" => fetch_grok(a).await,
        _ => None,
    }
}

/// An account whose credentials exist but whose usage could not be read.
fn failed(provider: &str, label: Option<String>, error: &str) -> AccountUsage {
    AccountUsage {
        provider: provider.into(),
        label,
        error: Some(error.into()),
        ..Default::default()
    }
}

fn accounts() -> Vec<Account> {
    let Some(home) = home() else { return vec![] };
    let env_dir = |var: &str, fallback: &str| {
        std::env::var_os(var)
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(fallback))
    };
    let mut out: Vec<Account> = [
        ("claude", "CLAUDE_CONFIG_DIR", ".claude"),
        ("codex", "CODEX_HOME", ".codex"),
        ("kimi", "KIMI_CODE_HOME", ".kimi-code"),
        ("grok", "GROK_HOME", ".grok"),
    ]
    .into_iter()
    .map(|(provider, var, dir)| Account {
        provider,
        dir: env_dir(var, dir),
        label: None,
        is_default: true,
    })
    .collect();
    // Sibling dirs that look logged in: `~/.claude-work` -> label "work".
    for entry in std::fs::read_dir(&home).into_iter().flatten().flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        for (provider, prefix, marker) in [
            ("claude", ".claude", ".credentials.json"),
            ("claude", ".claude", ".claude.json"),
            ("codex", ".codex", "auth.json"),
        ] {
            let suffix = name
                .strip_prefix(prefix)
                .and_then(|r| r.strip_prefix(['-', '_']));
            if suffix.is_some_and(|s| !s.is_empty()) && entry.path().join(marker).is_file() {
                out.push(Account {
                    provider,
                    dir: entry.path(),
                    label: suffix.map(Into::into),
                    is_default: false,
                });
            }
        }
    }
    let configured = std::fs::read_to_string(home.join(".perch/usage-accounts.json")).ok();
    out.extend(
        configured
            .and_then(|raw| configured_accounts(&raw, &home))
            .unwrap_or_default(),
    );
    // The same dir may arrive twice (default + sibling, or file + sibling).
    let mut seen = std::collections::HashSet::new();
    out.retain(|a| seen.insert((a.provider, a.dir.clone())));
    out
}

fn configured_accounts(raw: &str, home: &Path) -> Option<Vec<Account>> {
    let list: Vec<Value> = serde_json::from_str(raw).ok()?;
    Some(
        list.iter()
            .filter_map(|e| {
                let provider = ["claude", "codex", "kimi", "grok"]
                    .into_iter()
                    .find(|p| Some(*p) == e["provider"].as_str())?;
                let dir = e["dir"].as_str()?;
                let dir = dir
                    .strip_prefix("~/")
                    .map_or_else(|| PathBuf::from(dir), |r| home.join(r));
                Some(Account {
                    provider,
                    dir,
                    label: e["label"].as_str().map(Into::into),
                    is_default: false,
                })
            })
            .collect(),
    )
}

fn window(label_minutes: u64, used_percent: f64, resets_at: Option<&Value>) -> UsageWindow {
    let m = label_minutes;
    let label = if m.is_multiple_of(1440) {
        format!("{}d", m / 1440)
    } else if m.is_multiple_of(60) {
        format!("{}h", m / 60)
    } else {
        format!("{m}m")
    };
    UsageWindow {
        label,
        used_percent: used_percent.clamp(0.0, 100.0),
        window_minutes: m,
        resets_at: resets_at.filter(|v| !v.is_null()).cloned(),
        scope: None,
    }
}

async fn curl_json(url: &str, headers: &[String]) -> Option<Value> {
    let mut child = Command::new("curl")
        .args(["-sSf", "--max-time", "10", "-H", "@-", url])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .ok()?;
    let mut stdin = child.stdin.take()?;
    stdin.write_all(headers.join("\n").as_bytes()).await.ok()?;
    drop(stdin);
    let out = child.wait_with_output().await.ok()?;
    serde_json::from_slice(&out.stdout).ok()
}

/// The status is needed only to recognize an expired Claude OAuth token. The
/// response body and bearer token stay out of process arguments and logs.
async fn curl_json_status(url: &str, headers: &[String]) -> Result<Value, u16> {
    let mut child = Command::new("curl")
        .args([
            "-sS",
            "--max-time",
            "10",
            "-w",
            "\\n%{http_code}",
            "-H",
            "@-",
            url,
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|_| 0u16)?;
    let mut stdin = child.stdin.take().ok_or(0u16)?;
    stdin
        .write_all(headers.join("\n").as_bytes())
        .await
        .map_err(|_| 0u16)?;
    drop(stdin);
    let out = child.wait_with_output().await.map_err(|_| 0u16)?;
    if !out.status.success() {
        return Err(0u16);
    }
    parse_curl_json_status(&out.stdout)
}

fn parse_curl_json_status(stdout: &[u8]) -> Result<Value, u16> {
    let text = String::from_utf8_lossy(stdout);
    let (body, status) = text.rsplit_once('\n').ok_or(0u16)?;
    let status: u16 = status.trim().parse().map_err(|_| 0u16)?;
    if !(200..300).contains(&status) {
        return Err(status);
    }
    serde_json::from_str(body).map_err(|_| 0u16)
}

fn home() -> Option<PathBuf> {
    std::env::var_os("HOME").map(Into::into)
}

fn now_secs() -> f64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0.0, |d| d.as_secs_f64())
}

/// "max 5x" -> "Max 5x": underscores to spaces, first letter capitalized.
fn humanize(raw: &str) -> Option<String> {
    let text = raw.replace('_', " ");
    let text = text.trim();
    let mut chars = text.chars();
    let first = chars.next()?;
    Some(first.to_uppercase().chain(chars).collect())
}

/// Claude Code 2.1+ scopes the keychain item by config dir:
/// `Claude Code-credentials-<first 8 hex of sha256(dir)>`.
// ponytail: hashes the path as written (no Unicode NFC normalisation); a
// non-ASCII config dir may miss its keychain item and fall back to the file.
fn claude_keychain_services(a: &Account) -> Vec<String> {
    let mut services = vec![];
    let canonical = a.dir.canonicalize().ok();
    for dir in std::iter::once(a.dir.clone()).chain(canonical) {
        let hash = Sha256::digest(dir.to_string_lossy().as_bytes());
        let service = format!("Claude Code-credentials-{}", &format!("{hash:x}")[..8]);
        if !services.contains(&service) {
            services.push(service);
        }
    }
    if a.is_default {
        services.push("Claude Code-credentials".into());
    }
    services
}

async fn claude_token(a: &Account) -> Option<String> {
    let parse = |raw: &str| -> Option<String> {
        let v: Value = serde_json::from_str(raw.trim()).ok()?;
        Some(v["claudeAiOauth"]["accessToken"].as_str()?.to_string())
    };
    if cfg!(target_os = "macos") {
        for service in claude_keychain_services(a) {
            let mut command = Command::new("security");
            command
                .args(["find-generic-password", "-s", &service, "-w"])
                .stderr(Stdio::null())
                .kill_on_drop(true);
            if let Ok(Ok(out)) =
                tokio::time::timeout(Duration::from_secs(3), command.output()).await
            {
                if let Some(t) = parse(&String::from_utf8_lossy(&out.stdout)) {
                    return Some(t);
                }
            }
        }
    }
    parse(&std::fs::read_to_string(a.dir.join(".credentials.json")).ok()?)
}

/// The CLI's own state file (the default dir's lives beside it as
/// `~/.claude.json`).
fn claude_state(a: &Account) -> Option<Value> {
    let state = if a.is_default {
        home()?.join(".claude.json")
    } else {
        a.dir.join(".claude.json")
    };
    serde_json::from_str(&std::fs::read_to_string(state).ok()?).ok()
}

/// The signed-in email's local part.
fn claude_email(a: &Account) -> Option<String> {
    let email = claude_state(a)?["oauthAccount"]["emailAddress"]
        .as_str()?
        .to_string();
    Some(email.split('@').next()?.to_string())
}

fn claude_organization(state: Option<&Value>) -> Option<String> {
    Some(
        state?["oauthAccount"]["organizationUuid"]
            .as_str()?
            .to_string(),
    )
}

fn claude_plan(a: &Account) -> Option<String> {
    let state = claude_state(a)?;
    let account = &state["oauthAccount"];
    claude_plan_name(
        account["organizationType"].as_str(),
        account["organizationRateLimitTier"]
            .as_str()
            .or(account["userRateLimitTier"].as_str()),
    )
}

fn claude_plan_name(org_type: Option<&str>, tier: Option<&str>) -> Option<String> {
    let haystack = format!("{} {}", tier.unwrap_or(""), org_type.unwrap_or("")).to_lowercase();
    for (needle, name) in [
        ("max_20x", "Max 20×"),
        ("max_5x", "Max 5×"),
        ("max", "Max"),
        ("enterprise", "Enterprise"),
        ("team", "Team"),
        ("pro", "Pro"),
    ] {
        if haystack.contains(needle) {
            return Some(name.into());
        }
    }
    humanize(&org_type?.replace("claude_", ""))
}

/// Whether `get_usage` was a live fetch for the same account, not the cached
/// copy it serves (up to an hour old) after a failed fetch.
fn claude_reading_fresh(
    org_before: Option<&str>,
    org_after: Option<&str>,
    fetched_ms: Option<f64>,
    started_ms: f64,
) -> bool {
    org_before == org_after
        && fetched_ms.is_none_or(|fetched| started_ms - fetched <= CLAUDE_MAX_CACHE_AGE_MS)
}

/// Claude Code's own failure text for `get_usage`.
fn classify_claude_error(error: &str) -> Failure {
    let error = error.to_lowercase();
    if error.contains("supported") || error.contains("unknown") {
        Failure::Outdated
    } else if ["auth", "login", "sign in"]
        .iter()
        .any(|s| error.contains(s))
    {
        Failure::SignedOut
    } else {
        Failure::Unreachable
    }
}

/// `get_usage` over the CLI's stream-json protocol; the CLI owns auth.
async fn claude_cli_usage(a: &Account) -> Result<Vec<UsageWindow>, Failure> {
    let org_before = claude_organization(claude_state(a).as_ref());
    let started_ms = now_secs() * 1000.0;
    let mut command = Command::new("claude");
    command
        .args(CLAUDE_USAGE_ARGS)
        .env_remove("CLAUDECODE")
        .env("DISABLE_AUTOUPDATER", "1");
    match claude_probe_config_dir(a, std::env::var_os("CLAUDE_CONFIG_DIR").is_some()) {
        Some(dir) => command.env("CLAUDE_CONFIG_DIR", dir),
        None => command.env_remove("CLAUDE_CONFIG_DIR"),
    };
    let reply = with_deadline(CLAUDE_DEADLINE, async {
        let mut chat = Conversation::spawn(command)?;
        let mut reply = Value::Null;
        for (id, request) in [
            ("initialize", json!({"subtype": "initialize"})),
            (
                "usage",
                json!({"subtype": "get_usage", "skip_behaviors": true}),
            ),
        ] {
            chat.send(&json!({"type": "control_request", "request_id": id, "request": request}))
                .await?;
            reply = chat
                .read_until(|v| {
                    v["type"] == "control_response" && v["response"]["request_id"] == id
                })
                .await?;
        }
        chat.finish(CLAUDE_EXIT_GRACE).await;
        Ok(reply)
    })
    .await?;
    let response = &reply["response"];
    if response["subtype"] != "success" {
        return Err(classify_claude_error(
            response["error"].as_str().unwrap_or(""),
        ));
    }
    if response["response"]["rate_limits_available"] != true {
        return Err(Failure::SignedOut);
    }
    let state = claude_state(a);
    let fetched_ms = state.as_ref().and_then(|s| {
        s["cachedUsageUtilization"]["fetchedAtMs"]
            .as_f64()
            .filter(|ms| *ms > 0.0)
    });
    if !claude_reading_fresh(
        org_before.as_deref(),
        claude_organization(state.as_ref()).as_deref(),
        fetched_ms,
        started_ms,
    ) {
        return Err(Failure::Stale);
    }
    let windows = claude_cli_windows(&response["response"]);
    if windows.is_empty() {
        Err(Failure::Unreachable)
    } else {
        Ok(windows)
    }
}

/// Windows of a `get_usage` response: the typed `limits[]` list, else the
/// legacy per-key shape. A scoped window at 0% is noise.
fn claude_cli_windows(response: &Value) -> Vec<UsageWindow> {
    let limits = &response["rate_limits"];
    let mut windows = match limits["limits"].as_array() {
        Some(items) => items
            .iter()
            .filter_map(|item| {
                let minutes = if item["kind"] == "session" {
                    300
                } else if item["group"] == "weekly" {
                    10080
                } else {
                    return None;
                };
                let mut w = window(minutes, item["percent"].as_f64()?, item.get("resets_at"));
                w.scope = item["scope"]["model"]["display_name"]
                    .as_str()
                    .map(Into::into);
                Some(w)
            })
            .collect(),
        None => claude_legacy_windows(limits),
    };
    windows.retain(|w| w.scope.is_none() || w.used_percent > 0.0);
    windows
}

async fn fetch_claude(a: &Account) -> AccountUsage {
    let (windows, error) = match claude_cli_usage(a).await {
        Ok(windows) => (windows, None),
        Err(Failure::SignedOut) => (
            vec![],
            Some("Claude Code is signed out. Run claude and sign in, then refresh."),
        ),
        Err(_) => match fetch_claude_http(a).await {
            Some(windows) => (windows, None),
            None => (
                vec![],
                Some("Claude usage unavailable. Refresh, then check Claude Code's sign-in if it persists."),
            ),
        },
    };
    AccountUsage {
        provider: "claude".into(),
        label: a.label.clone().or_else(|| claude_email(a)),
        plan: claude_plan(a),
        windows,
        error: error.map(Into::into),
        ..Default::default()
    }
}

/// Fallback when the CLI cannot answer. Another Claude process may rotate the
/// token, so a 401 re-reads it once; Perch never refreshes it itself.
async fn fetch_claude_http(a: &Account) -> Option<Vec<UsageWindow>> {
    let token = claude_token(a).await?;
    let body = match fetch_claude_token(&token).await {
        Err(401) => fetch_claude_token(&claude_token(a).await.filter(|t| t != &token)?).await,
        other => other,
    };
    Some(body.ok()??.windows)
}

async fn fetch_claude_token(token: &str) -> Result<Option<AccountUsage>, u16> {
    let body = curl_json_status(
        "https://api.anthropic.com/api/oauth/usage",
        &[
            format!("Authorization: Bearer {token}"),
            "anthropic-beta: oauth-2025-04-20".into(),
            "User-Agent: claude-code/2.1.0".into(),
        ],
    )
    .await?;
    Ok(claude_from_json(&body))
}

fn claude_probe_config_dir(account: &Account, inherited_override: bool) -> Option<&Path> {
    (!account.is_default || inherited_override).then_some(account.dir.as_path())
}

/// The per-key shape shared by the OAuth usage endpoint and `get_usage`'s
/// `rate_limits` before it grew `limits[]`.
fn claude_legacy_windows(body: &Value) -> Vec<UsageWindow> {
    [
        ("five_hour", 300, None),
        ("seven_day", 10080, None),
        ("seven_day_opus", 10080, Some("Opus")),
        ("seven_day_sonnet", 10080, Some("Sonnet")),
    ]
    .into_iter()
    .filter_map(|(key, minutes, scope)| {
        let used = body[key]["utilization"].as_f64()?;
        let mut w = window(minutes, used, body[key].get("resets_at"));
        w.scope = scope.map(Into::into);
        Some(w)
    })
    .collect()
}

fn claude_from_json(body: &Value) -> Option<AccountUsage> {
    let mut windows = claude_legacy_windows(body);
    windows.retain(|w| w.scope.is_none() || w.used_percent > 0.0);
    (!windows.is_empty()).then(|| AccountUsage {
        provider: "claude".into(),
        windows,
        ..Default::default()
    })
}

/// One JSON-RPC call to `codex app-server`; notifications and other ids are
/// skipped.
async fn codex_rpc(
    chat: &mut Conversation,
    id: u64,
    method: &str,
    params: Option<Value>,
) -> Result<Value, Failure> {
    let mut request = json!({"id": id, "method": method});
    if let Some(params) = params {
        request["params"] = params;
    }
    chat.send(&request).await?;
    let reply = chat
        .read_until(|v| v.get("method").is_none() && v["id"] == id)
        .await?;
    if let Some(error) = reply.get("error") {
        return Err(classify_codex_error(
            error["code"].as_i64(),
            error["message"].as_str().unwrap_or(""),
        ));
    }
    reply.get("result").cloned().ok_or(Failure::Unreachable)
}

fn classify_codex_error(code: Option<i64>, message: &str) -> Failure {
    let message = message.to_lowercase();
    if code == Some(-32601)
        || message.contains("method not found")
        || message.contains("unknown variant")
    {
        Failure::Outdated
    } else if message.contains("authentication") || message.contains("not logged in") {
        Failure::SignedOut
    } else {
        Failure::Unreachable
    }
}

async fn codex_cli_usage(a: &Account) -> Result<AccountUsage, Failure> {
    let mut command = Command::new("codex");
    command.args(["-c", "features.plugins=false", "app-server"]);
    if !a.is_default {
        command.env("CODEX_HOME", &a.dir);
    }
    let (account, limits) = with_deadline(CODEX_DEADLINE, async {
        let mut chat = Conversation::spawn(command)?;
        let client = json!({
            "clientInfo": {"name": "perch", "title": "Perch", "version": env!("CARGO_PKG_VERSION")},
            "capabilities": null
        });
        codex_rpc(&mut chat, 1, "initialize", Some(client)).await?;
        chat.send(&json!({"method": "initialized"})).await?;
        let account = codex_rpc(
            &mut chat,
            2,
            "account/read",
            Some(json!({"refreshToken": false})),
        )
        .await?;
        if account["account"]["type"] != "chatgpt" {
            return Err(Failure::SignedOut);
        }
        let limits = codex_rpc(&mut chat, 3, "account/rateLimits/read", None).await?;
        Ok((account, limits))
    })
    .await?;
    let windows = codex_rpc_windows(&limits);
    if windows.is_empty() {
        return Err(Failure::Unreachable);
    }
    Ok(AccountUsage {
        provider: "codex".into(),
        plan: account["account"]["planType"].as_str().and_then(humanize),
        windows,
        reset_credits: codex_reset_credits(&limits, now_secs()),
        ..Default::default()
    })
}

/// `account/rateLimits/read`: the `codex` bucket when buckets are reported,
/// else the legacy single snapshot.
fn codex_rpc_windows(result: &Value) -> Vec<UsageWindow> {
    let by_id = &result["rateLimitsByLimitId"]["codex"];
    let snapshot = if by_id.is_object() {
        by_id
    } else {
        &result["rateLimits"]
    };
    let mut windows: Vec<_> = ["primary", "secondary"]
        .into_iter()
        .enumerate()
        .filter_map(|(i, key)| {
            let slot = &snapshot[key];
            let minutes =
                slot["windowDurationMins"]
                    .as_u64()
                    .unwrap_or(if i == 1 { 10080 } else { 300 });
            Some(window(
                minutes,
                slot["usedPercent"].as_f64()?,
                slot.get("resetsAt"),
            ))
        })
        .collect();
    if windows.is_empty() {
        if let Some(remaining) = snapshot["individualLimit"]["remainingPercent"].as_f64() {
            windows.push(UsageWindow {
                label: "limit".into(),
                ..window(0, 100.0 - remaining, None)
            });
        }
    }
    windows
}

/// Redeemable banked resets. Only reported when the payload carries the key.
fn codex_reset_credits(result: &Value, now: f64) -> Option<u32> {
    let block = result["rateLimitResetCredits"].as_object()?;
    let live = block
        .get("credits")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter(|credit| {
            credit["status"].as_str().unwrap_or("available") == "available"
                && credit["expiresAt"].as_f64().is_none_or(|at| at > now)
        })
        .count() as u64;
    let available = block
        .get("availableCount")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    Some(live.max(available) as u32)
}

async fn fetch_codex(a: &Account) -> Option<AccountUsage> {
    let discovered = a.dir.join("auth.json").is_file();
    let mut usage = match codex_cli_usage(a).await {
        Ok(usage) => usage,
        Err(Failure::SignedOut) => {
            return discovered.then(|| {
                failed(
                    "codex",
                    a.label.clone(),
                    "Codex is signed out. Run codex login, then refresh.",
                )
            })
        }
        Err(_) => match fetch_codex_http(a).await {
            Some(usage) => usage,
            None => {
                return discovered.then(|| {
                    failed(
                        "codex",
                        a.label.clone(),
                        "Codex usage unavailable. Refresh to retry.",
                    )
                })
            }
        },
    };
    usage.label = a.label.clone();
    Some(usage)
}

async fn fetch_codex_http(a: &Account) -> Option<AccountUsage> {
    let auth: Value =
        serde_json::from_str(&std::fs::read_to_string(a.dir.join("auth.json")).ok()?).ok()?;
    let mut headers = vec![
        format!(
            "Authorization: Bearer {}",
            auth["tokens"]["access_token"].as_str()?
        ),
        "User-Agent: codex-cli".into(),
        "OpenAI-Beta: codex-1".into(),
    ];
    if let Some(id) = auth["tokens"]["account_id"].as_str() {
        headers.push(format!("ChatGPT-Account-Id: {id}"));
    }
    codex_from_json(&curl_json("https://chatgpt.com/backend-api/wham/usage", &headers).await?)
}

fn codex_from_json(body: &Value) -> Option<AccountUsage> {
    let mut windows = vec![];
    for (i, key) in ["primary_window", "secondary_window"]
        .into_iter()
        .enumerate()
    {
        let w = &body["rate_limit"][key];
        let Some(used) = w["used_percent"].as_f64() else {
            continue;
        };
        // Free plans report a single weekly window as `primary`, so go by
        // the duration; with none, primary = 5h, secondary = 7d.
        let minutes = w["limit_window_seconds"].as_u64().map(|s| s.div_ceil(60));
        windows.push(window(
            minutes.unwrap_or(if i == 1 { 10080 } else { 300 }),
            used,
            w.get("reset_at"),
        ));
    }
    (!windows.is_empty()).then(|| AccountUsage {
        provider: "codex".into(),
        plan: body["plan_type"].as_str().and_then(humanize),
        windows,
        ..Default::default()
    })
}

async fn fetch_kimi(a: &Account) -> Option<AccountUsage> {
    let creds = std::fs::read_to_string(a.dir.join("credentials/kimi-code.json")).ok()?;
    let mut usage = kimi_usage(&creds)
        .await
        .unwrap_or_else(|error| failed("kimi", None, error));
    usage.label = a.label.clone();
    Some(usage)
}

async fn kimi_usage(creds: &str) -> Result<AccountUsage, &'static str> {
    const UNAVAILABLE: &str = "Kimi usage unavailable. Refresh to retry.";
    let creds: Value = serde_json::from_str(creds).map_err(|_| UNAVAILABLE)?;
    let token = creds["access_token"]
        .as_str()
        .filter(|t| !t.is_empty())
        .ok_or(UNAVAILABLE)?;
    // The CLI owns the token lifecycle (rotating refresh tokens): never
    // refresh here, just report until the CLI has rewritten the file.
    if creds["expires_at"].as_f64().ok_or(UNAVAILABLE)? <= now_secs() + 5.0 {
        return Err("Kimi Code sign-in expired. Run kimi to refresh.");
    }
    let base = std::env::var("KIMI_CODE_BASE_URL")
        .unwrap_or_else(|_| "https://api.kimi.com/coding/v1".into());
    let body = curl_json(
        &format!("{}/usages", base.trim_end_matches('/')),
        &[
            format!("Authorization: Bearer {token}"),
            "Accept: application/json".into(),
        ],
    )
    .await
    .ok_or(UNAVAILABLE)?;
    kimi_from_json(&body).ok_or(UNAVAILABLE)
}

fn json_num(v: &Value) -> Option<f64> {
    v.as_f64().or_else(|| v.as_str()?.parse().ok())
}

fn kimi_window(detail: &Value, minutes: u64) -> Option<UsageWindow> {
    let limit = json_num(&detail["limit"])?;
    let used =
        json_num(&detail["used"]).or_else(|| Some(limit - json_num(&detail["remaining"])?))?;
    let reset = detail.get("resetTime").or_else(|| detail.get("resetAt"));
    (limit > 0.0).then(|| window(minutes, used / limit * 100.0, reset))
}

fn kimi_from_json(body: &Value) -> Option<AccountUsage> {
    // `usage` is the weekly quota; `limits[]` are shorter rolling windows,
    // of which the one nearest 5h is the session view.
    let weekly = kimi_window(&body["usage"], 10080);
    let mut session: Option<UsageWindow> = None;
    for limit in body["limits"].as_array().into_iter().flatten() {
        let w = &limit["window"];
        let minutes = json_num(&w["duration"]).map_or(300, |d| {
            let d = d as u64;
            let unit = w["timeUnit"].as_str().unwrap_or("").to_uppercase();
            if unit.contains("HOUR") {
                d * 60
            } else if unit.contains("DAY") {
                d * 1440
            } else if unit.contains("SECOND") {
                d.div_ceil(60)
            } else {
                d // minutes, or unknown
            }
        });
        let Some(mapped) = kimi_window(&limit["detail"], minutes) else {
            continue;
        };
        if session
            .as_ref()
            .is_none_or(|s| minutes.abs_diff(300) < s.window_minutes.abs_diff(300))
        {
            session = Some(mapped);
        }
    }
    let windows: Vec<_> = session.into_iter().chain(weekly).collect();
    (!windows.is_empty()).then(|| AccountUsage {
        provider: "kimi".into(),
        windows,
        ..Default::default()
    })
}

const GROK_PREFERRED_ISSUER: &str = "https://auth.x.ai";

async fn fetch_grok(a: &Account) -> Option<AccountUsage> {
    let auth = std::fs::read_to_string(a.dir.join("auth.json")).ok()?;
    Some(grok_usage(a, &auth).await.unwrap_or_else(|| {
        failed(
            "grok",
            a.label.clone(),
            "Grok usage unavailable. Refresh to retry.",
        )
    }))
}

async fn grok_usage(a: &Account, auth: &str) -> Option<AccountUsage> {
    let auth: Value = serde_json::from_str(auth).ok()?;
    let entries = auth.as_object()?;
    // The default xAI issuer wins; other issuers only when it's absent.
    // ponytail: `expires_at` isn't checked (no date parser in the tree); an
    // expired token just 401s and the account shows the generic error until
    // the CLI refreshes.
    let preferred = |k: &String| {
        k == GROK_PREFERRED_ISSUER || k.starts_with(&format!("{GROK_PREFERRED_ISSUER}::"))
    };
    let has_token = |e: &Value| e["key"].as_str().is_some_and(|t| !t.is_empty());
    let any_preferred = entries.keys().any(preferred);
    let entry = entries
        .iter()
        .find(|(k, e)| preferred(k) && has_token(e))
        .or_else(|| entries.iter().find(|(_, e)| !any_preferred && has_token(e)))?
        .1;
    let mut headers = vec![
        format!("Authorization: Bearer {}", entry["key"].as_str()?),
        "X-XAI-Token-Auth: xai-grok-cli".into(),
        "Accept: application/json".into(),
    ];
    if let Some(id) = entry["user_id"].as_str() {
        headers.push(format!("x-userid: {id}"));
    }
    let base = std::env::var("GROK_CLI_CHAT_PROXY_BASE_URL")
        .ok()
        .map(|b| b.trim().trim_end_matches('/').to_string())
        .filter(|b| !b.is_empty())
        .unwrap_or_else(|| "https://cli-chat-proxy.grok.com/v1".into());
    let config_of =
        |body: &Value| -> Value { body.get("config").cloned().unwrap_or_else(|| body.clone()) };
    let credits = config_of(&curl_json(&format!("{base}/billing?format=credits"), &headers).await?);
    let window = match grok_window(&credits) {
        Some(w) => w,
        // Some unified-billing accounts only expose the monthly budget in the default view.
        None => grok_monthly(&config_of(
            &curl_json(&format!("{base}/billing"), &headers).await?,
        ))?,
    };
    Some(AccountUsage {
        provider: "grok".into(),
        label: a
            .label
            .clone()
            .or_else(|| entry["email"].as_str().map(Into::into)),
        windows: vec![window],
        ..Default::default()
    })
}

fn money(v: &Value) -> Option<f64> {
    json_num(&v["val"])
}

fn grok_end(c: &Value) -> Option<Value> {
    c["currentPeriod"]["end"]
        .as_str()
        .or(c["billingPeriodEnd"].as_str())
        .map(|s| Value::String(s.into()))
}

fn grok_monthly(c: &Value) -> Option<UsageWindow> {
    let (limit, used) = (money(&c["monthlyLimit"])?, money(&c["used"])?);
    (limit > 0.0).then(|| window(43200, used / limit * 100.0, grok_end(c).as_ref()))
}

/// The weekly credit window, else the monthly budget. proto3 JSON drops
/// zeros, so an absent percent counts as 0% only when nothing else in the
/// payload shows consumption (an explicit zero scalar means the encoder
/// keeps zeros, so absence means "not reported") and the current period is
/// confirmed to be the weekly billing period.
fn grok_window(c: &Value) -> Option<UsageWindow> {
    if let Some(reported) = c.get("creditUsagePercent") {
        return json_num(reported).map(|p| window(10080, p, grok_end(c).as_ref()));
    }
    if let Some(m) = grok_monthly(c) {
        return Some(m);
    }
    let explicit_zero = [
        "onDemandCap",
        "onDemandUsed",
        "prepaidBalance",
        "monthlyLimit",
        "used",
    ]
    .iter()
    .any(|k| money(&c[k]) == Some(0.0));
    let p = &c["currentPeriod"];
    let confirmed = p["type"] == "USAGE_PERIOD_TYPE_WEEKLY"
        && p["start"].is_string()
        && p["start"] == c["billingPeriodStart"]
        && p["end"] == c["billingPeriodEnd"];
    (!explicit_zero && confirmed).then(|| window(10080, 0.0, grok_end(c).as_ref()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn curl_status_parser_distinguishes_expired_tokens_and_json_errors() {
        assert_eq!(
            parse_curl_json_status(b"{\"message\":\"expired\"}\n401"),
            Err(401)
        );
        assert_eq!(
            parse_curl_json_status(b"{\"five_hour\":{\"utilization\":1}}\n200"),
            Ok(json!({"five_hour":{"utilization":1}}))
        );
        assert_eq!(parse_curl_json_status(b"no status line"), Err(0));
    }

    #[test]
    fn default_claude_probe_uses_default_keychain_unless_config_dir_was_overridden() {
        let default = Account {
            provider: "claude",
            dir: PathBuf::from("/home/test/.claude"),
            label: None,
            is_default: true,
        };
        let extra = Account {
            provider: "claude",
            dir: PathBuf::from("/home/test/.claude-work"),
            label: Some("work".into()),
            is_default: false,
        };
        assert_eq!(claude_probe_config_dir(&default, false), None);
        assert_eq!(
            claude_probe_config_dir(&default, true),
            Some(default.dir.as_path())
        );
        assert_eq!(
            claude_probe_config_dir(&extra, false),
            Some(extra.dir.as_path())
        );
    }

    #[test]
    fn claude_windows() {
        let u = claude_from_json(&json!({
            "five_hour": {"utilization": 23.0, "resets_at": "2026-01-01T00:00:00Z"},
            "seven_day": {"utilization": 140.0, "resets_at": null}
        }))
        .unwrap();
        assert_eq!(
            (u.windows[0].label.as_str(), u.windows[0].used_percent),
            ("5h", 23.0)
        );
        assert_eq!(
            (
                u.windows[1].label.as_str(),
                u.windows[1].used_percent,
                &u.windows[1].resets_at
            ),
            ("7d", 100.0, &None)
        );
        assert!(claude_from_json(&json!({})).is_none());
    }

    #[test]
    fn claude_get_usage_windows_come_from_limits_or_the_legacy_keys() {
        // Trimmed from a real claude 2.1.318 `get_usage` response.
        let typed = json!({"rate_limits": {
            "five_hour": {"utilization": 6},
            "limits": [
                {"kind": "session", "group": "session", "percent": 6, "resets_at": "2026-11-05T05:10:00+00:00", "scope": null},
                {"kind": "weekly_all", "group": "weekly", "percent": 24, "resets_at": "2026-11-09T10:00:00+00:00", "scope": null},
                {"kind": "weekly_scoped", "group": "weekly", "percent": 0, "resets_at": null, "scope": {"model": {"display_name": "Fable", "id": null}, "surface": null}},
                {"kind": "weekly_scoped", "group": "weekly", "percent": 9, "resets_at": null, "scope": {"model": {"display_name": "Haiku", "id": null}, "surface": null}},
                {"kind": "monthly_credits", "group": "monthly", "percent": 50, "resets_at": null, "scope": null}
            ]
        }});
        let windows = claude_cli_windows(&typed);
        let shape: Vec<_> = windows
            .iter()
            .map(|w| (w.label.as_str(), w.used_percent, w.scope.as_deref()))
            .collect();
        assert_eq!(
            shape,
            [
                ("5h", 6.0, None),
                ("7d", 24.0, None),
                ("7d", 9.0, Some("Haiku"))
            ]
        );
        assert_eq!(
            windows[0].resets_at,
            Some(json!("2026-11-05T05:10:00+00:00"))
        );

        let legacy = json!({"rate_limits": {
            "five_hour": {"utilization": 6, "resets_at": "2026-11-05T05:10:00+00:00"},
            "seven_day": {"utilization": 24},
            "seven_day_opus": {"utilization": 3},
            "seven_day_sonnet": {"utilization": 0}
        }});
        let shape: Vec<_> = claude_cli_windows(&legacy)
            .iter()
            .map(|w| (w.label.clone(), w.scope.clone()))
            .collect();
        assert_eq!(
            shape,
            [
                ("5h".to_string(), None),
                ("7d".to_string(), None),
                ("7d".to_string(), Some("Opus".to_string()))
            ]
        );
        assert!(claude_cli_windows(&json!({})).is_empty());
    }

    #[test]
    fn claude_plan_names_follow_tier_then_type() {
        for (org_type, tier, expected) in [
            (
                Some("claude_max"),
                Some("default_claude_max_5x"),
                Some("Max 5×"),
            ),
            (
                Some("claude_max"),
                Some("default_claude_max_20x"),
                Some("Max 20×"),
            ),
            (Some("claude_max"), None, Some("Max")),
            (Some("claude_pro"), Some("default_claude_ai"), Some("Pro")),
            (Some("claude_team"), None, Some("Team")),
            (Some("claude_enterprise"), None, Some("Enterprise")),
            (Some("claude_free_trial"), None, Some("Free trial")),
            (Some("claude_"), None, None),
            (None, None, None),
        ] {
            assert_eq!(
                claude_plan_name(org_type, tier).as_deref(),
                expected,
                "{org_type:?} {tier:?}"
            );
        }
    }

    #[test]
    fn stale_claude_readings_are_rejected() {
        let (a, b) = (Some("org-1"), Some("org-2"));
        assert!(claude_reading_fresh(a, a, None, 1_000_000.0));
        assert!(claude_reading_fresh(a, a, Some(990_000.0), 1_000_000.0));
        assert!(claude_reading_fresh(a, a, Some(1_000_500.0), 1_000_000.0));
        assert!(!claude_reading_fresh(a, a, Some(900_000.0), 1_000_000.0));
        assert!(!claude_reading_fresh(a, b, Some(1_000_500.0), 1_000_000.0));
        assert!(!claude_reading_fresh(None, a, None, 1_000_000.0));
    }

    #[test]
    fn cli_error_text_maps_to_the_fallback_decision() {
        assert_eq!(
            classify_claude_error("Unknown subtype get_usage"),
            Failure::Outdated
        );
        assert_eq!(classify_claude_error("not supported"), Failure::Outdated);
        assert_eq!(
            classify_claude_error("Please login again"),
            Failure::SignedOut
        );
        assert_eq!(
            classify_claude_error("Not authenticated"),
            Failure::SignedOut
        );
        assert_eq!(classify_claude_error("boom"), Failure::Unreachable);
        assert_eq!(classify_codex_error(Some(-32601), "x"), Failure::Outdated);
        assert_eq!(
            classify_codex_error(None, "Unknown variant `account/rateLimits/read`"),
            Failure::Outdated
        );
        assert_eq!(
            classify_codex_error(Some(-32000), "codex account authentication required"),
            Failure::SignedOut
        );
        assert_eq!(
            classify_codex_error(Some(-32603), "not logged in"),
            Failure::SignedOut
        );
        assert_eq!(
            classify_codex_error(Some(-32603), "backend down"),
            Failure::Unreachable
        );
    }

    #[test]
    fn codex_app_server_limits_plan_and_banked_resets() {
        // Trimmed from a real codex-cli 0.166.0 `account/rateLimits/read` result.
        let result = json!({
            "rateLimits": {"primary": {"usedPercent": 99, "windowDurationMins": 300, "resetsAt": 1}},
            "rateLimitsByLimitId": {"codex": {
                "limitId": "codex",
                "primary": {"usedPercent": 20, "windowDurationMins": 300, "resetsAt": 1793843878},
                "secondary": {"usedPercent": 3, "windowDurationMins": 10080, "resetsAt": 1794407915},
                "individualLimit": null, "planType": "plus"
            }},
            "rateLimitResetCredits": {"availableCount": 1, "credits": [
                {"status": "available", "expiresAt": 1794008954},
                {"status": "available", "expiresAt": 1796070597},
                {"status": "available", "expiresAt": 1796165740},
                {"status": "available", "expiresAt": 1000},
                {"status": "redeemed", "expiresAt": 1796165740},
                {"expiresAt": null}
            ]}
        });
        let windows = codex_rpc_windows(&result);
        let shape: Vec<_> = windows
            .iter()
            .map(|w| (w.label.as_str(), w.used_percent))
            .collect();
        assert_eq!(shape, [("5h", 20.0), ("7d", 3.0)]);
        assert_eq!(windows[0].resets_at, Some(json!(1793843878)));
        // The expired and the redeemed credit are excluded.
        assert_eq!(codex_reset_credits(&result, 1_793_000_000.0), Some(4));
        assert_eq!(
            codex_reset_credits(
                &json!({"rateLimitResetCredits": {"availableCount": 2}}),
                0.0
            ),
            Some(2)
        );
        assert_eq!(codex_reset_credits(&json!({}), 0.0), None);

        // Without buckets: the single snapshot; with no slots: the individual limit.
        let single = json!({"rateLimits": {"secondary": {"usedPercent": 7}}});
        assert_eq!(codex_rpc_windows(&single)[0].label, "7d");
        let limit = codex_rpc_windows(
            &json!({"rateLimits": {"individualLimit": {"remainingPercent": 40}}}),
        );
        assert_eq!(
            (
                limit[0].label.as_str(),
                limit[0].used_percent,
                limit[0].window_minutes
            ),
            ("limit", 60.0, 0)
        );
        assert!(codex_rpc_windows(&json!({})).is_empty());

        assert_eq!(humanize("plus").as_deref(), Some("Plus"));
        assert_eq!(
            humanize("self_serve_business").as_deref(),
            Some("Self serve business")
        );
        assert_eq!(humanize(" "), None);
    }

    #[test]
    fn usage_fields_stay_off_the_wire_when_unset() {
        let json = serde_json::to_value(AccountUsage {
            provider: "codex".into(),
            windows: vec![window(300, 1.0, None)],
            ..Default::default()
        })
        .unwrap();
        assert_eq!(
            json,
            json!({"provider": "codex", "windows": [{"label": "5h", "usedPercent": 1.0, "windowMinutes": 300}]})
        );
    }

    #[test]
    fn codex_windows_go_by_duration() {
        let u = codex_from_json(&json!({"rate_limit": {
            "primary_window": {"used_percent": 7.0, "limit_window_seconds": 604800, "reset_at": 1}
        }}))
        .unwrap();
        assert_eq!((u.windows.len(), u.windows[0].label.as_str()), (1, "7d"));
        let u = codex_from_json(&json!({"rate_limit": {
            "primary_window": {"used_percent": 1.0, "limit_window_seconds": 18000},
            "secondary_window": {"used_percent": 2.0}
        }}))
        .unwrap();
        assert_eq!(
            (u.windows[0].label.as_str(), u.windows[1].label.as_str()),
            ("5h", "7d")
        );
    }

    #[test]
    fn configured_accounts_expand_home_and_skip_unknown_providers() {
        let list = configured_accounts(
            r#"[{"provider":"claude","dir":"~/w","label":"work"},{"provider":"gemini","dir":"/x"},{"provider":"codex","dir":"/abs"}]"#,
            Path::new("/home/u"),
        )
        .unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(
            (list[0].dir.as_path(), list[0].label.as_deref()),
            (Path::new("/home/u/w"), Some("work"))
        );
        assert_eq!(list[1].dir, Path::new("/abs"));
    }

    #[test]
    fn scoped_keychain_service_is_sha256_prefix() {
        let a = Account {
            provider: "claude",
            dir: "/nonexistent/cfg".into(),
            label: None,
            is_default: false,
        };
        let s = claude_keychain_services(&a);
        assert_eq!(s.len(), 1);
        assert!(
            s[0].starts_with("Claude Code-credentials-")
                && s[0].len() == "Claude Code-credentials-".len() + 8
        );
        let d = Account {
            is_default: true,
            ..a
        };
        assert_eq!(
            claude_keychain_services(&d).last().unwrap(),
            "Claude Code-credentials"
        );
    }

    #[test]
    fn kimi_picks_session_nearest_5h_and_weekly() {
        let u = kimi_from_json(&json!({
            "usage": {"limit": "100", "remaining": "75", "resetTime": "2026-01-08T00:00:00Z"},
            "limits": [
                {"window": {"duration": 1, "timeUnit": "TIME_UNIT_DAY"}, "detail": {"limit": 10, "used": 1}},
                {"window": {"duration": 300, "timeUnit": "TIME_UNIT_MINUTE"}, "detail": {"limit": 10, "used": 5}}
            ]
        }))
        .unwrap();
        assert_eq!(
            (u.windows[0].label.as_str(), u.windows[0].used_percent),
            ("5h", 50.0)
        );
        assert_eq!(
            (u.windows[1].label.as_str(), u.windows[1].used_percent),
            ("7d", 25.0)
        );
        assert!(kimi_from_json(&json!({})).is_none());
    }

    #[tokio::test]
    async fn an_expired_kimi_token_is_reported_not_dropped() {
        let error = kimi_usage(r#"{"access_token":"t","expires_at":1}"#)
            .await
            .unwrap_err();
        assert_eq!(error, "Kimi Code sign-in expired. Run kimi to refresh.");
        assert_eq!(
            kimi_usage("not json").await.unwrap_err(),
            "Kimi usage unavailable. Refresh to retry."
        );
    }

    #[test]
    fn grok_weekly_percent_monthly_budget_and_dropped_zero() {
        let w = grok_window(
            &json!({"creditUsagePercent": 12.5, "billingPeriodEnd": "2026-01-08T00:00:00Z"}),
        )
        .unwrap();
        assert_eq!((w.label.as_str(), w.used_percent), ("7d", 12.5));
        let m = grok_window(&json!({"monthlyLimit": {"val": "200"}, "used": {"val": 50}})).unwrap();
        assert_eq!((m.label.as_str(), m.used_percent), ("30d", 25.0));
        let period = json!({"type": "USAGE_PERIOD_TYPE_WEEKLY", "start": "a", "end": "b"});
        let dropped =
            json!({"currentPeriod": period, "billingPeriodStart": "a", "billingPeriodEnd": "b"});
        assert_eq!(grok_window(&dropped).unwrap().used_percent, 0.0);
        // An explicit zero elsewhere means the encoder keeps zeros: absent = unknown.
        let mut explicit = dropped.clone();
        explicit["onDemandUsed"] = json!({"val": 0});
        assert!(grok_window(&explicit).is_none());
    }
}

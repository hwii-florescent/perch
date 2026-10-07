//! Plan usage for the status bar: rolling rate-limit windows (5h, 7d, ...)
//! per provider *account*, the same sources Orca reads
//! (`orca/src/main/rate-limits`). Local host only.
//!
//! - Claude: `api.anthropic.com/api/oauth/usage` with the CLI's OAuth token
//!   (macOS keychain, else `<config dir>/.credentials.json`). On 401, Perch
//!   asks a hidden Claude Code PTY to refresh its own rotating credentials. It
//!   preserves an inherited `CLAUDE_CONFIG_DIR` override; otherwise the default
//!   probe leaves it unset so Claude Code uses the unscoped Keychain item. The
//!   probe cooldown is process-local; detached CLI grandchildren may outlive
//!   the PTY process group.
//! - Codex: `chatgpt.com/backend-api/wham/usage` with `<CODEX_HOME>/auth.json`.
//!
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
//! cached because the endpoints rate-limit; failed Claude usage is surfaced.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Mutex as StdMutex, OnceLock};
use std::time::{Duration, Instant};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

const CACHE_TTL: Duration = Duration::from_secs(180);
const CLAUDE_REFRESH_COOLDOWN: Duration = Duration::from_secs(600);
const CLAUDE_REFRESH_TIMEOUT: Duration = Duration::from_secs(30);

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
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AccountUsage {
    pub provider: String,
    /// Which account, when it can be told (email, dir suffix, configured label).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub windows: Vec<UsageWindow>,
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
/// and the Claude CLI probe run without holding it.
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
        "claude" => Some(fetch_claude(a).await.unwrap_or_else(|| AccountUsage {
            provider: a.provider.into(),
            label: a.label.clone(),
            windows: vec![],
            error: Some("Claude usage unavailable. Refresh, then check Claude Code's sign-in if it persists.".into()),
        })),
        "codex" => fetch_codex(a).await,
        "kimi" => fetch_kimi(a).await,
        "grok" => fetch_grok(a).await,
        _ => None,
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

/// The signed-in email's local part, from the CLI's own state file (the
/// default dir's lives beside it as `~/.claude.json`).
fn claude_email(a: &Account) -> Option<String> {
    let state = if a.is_default {
        home()?.join(".claude.json")
    } else {
        a.dir.join(".claude.json")
    };
    let v: Value = serde_json::from_str(&std::fs::read_to_string(state).ok()?).ok()?;
    let email = v["oauthAccount"]["emailAddress"].as_str()?;
    Some(email.split('@').next()?.to_string())
}

async fn fetch_claude(a: &Account) -> Option<AccountUsage> {
    let token = claude_token(a).await?;
    match fetch_claude_token(&token).await {
        Ok(Some(usage)) => return Some(label_claude_usage(a, usage)),
        Err(401) => {}
        _ => return None,
    }

    // Another Claude process may already have refreshed the rotating token.
    if let Some(latest) = claude_token(a).await.filter(|latest| latest != &token) {
        if let Ok(Some(usage)) = fetch_claude_token(&latest).await {
            return Some(label_claude_usage(a, usage));
        }
    }

    if !claim_claude_cli_refresh(&a.dir) || !refresh_claude_via_cli(a).await {
        return None;
    }
    let refreshed = claude_token(a).await?;
    let body = fetch_claude_token(&refreshed).await.ok()??;
    Some(label_claude_usage(a, body))
}

fn label_claude_usage(a: &Account, mut usage: AccountUsage) -> AccountUsage {
    usage.label = a.label.clone().or_else(|| claude_email(a));
    usage
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

/// One probe per account per core process; separate core processes do not share this cooldown.
fn claim_claude_cli_refresh(dir: &Path) -> bool {
    static LAST_REFRESH: OnceLock<StdMutex<std::collections::HashMap<PathBuf, Instant>>> =
        OnceLock::new();
    let mut last = LAST_REFRESH
        .get_or_init(Default::default)
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    if last
        .get(dir)
        .is_some_and(|at| at.elapsed() < CLAUDE_REFRESH_COOLDOWN)
    {
        return false;
    }
    last.insert(dir.to_owned(), Instant::now());
    true
}

#[derive(Clone, Copy)]
struct CliProbeTiming {
    startup_delay: Duration,
    timeout: Duration,
    settle_delay: Duration,
    poll_interval: Duration,
}

const CLI_PROBE_TIMING: CliProbeTiming = CliProbeTiming {
    startup_delay: Duration::from_secs(2),
    timeout: CLAUDE_REFRESH_TIMEOUT,
    settle_delay: Duration::from_secs(2),
    poll_interval: Duration::from_millis(250),
};

struct ProbeChild(Box<dyn portable_pty::Child + Send + Sync>, Option<u32>);

impl Drop for ProbeChild {
    fn drop(&mut self) {
        // portable-pty starts a new session on Unix. Terminate the whole process
        // group even if the CLI leader exited: helper children can retain the PTY.
        // ponytail: descendants that detach with their own setsid escape this; use
        // a process supervisor if Claude Code ever requires detached helpers.
        #[cfg(unix)]
        if let Some(pid) = self.1.and_then(|pid| i32::try_from(pid).ok()) {
            // SAFETY: negative pid targets only the PTY child's own process group.
            unsafe { libc::kill(-pid, libc::SIGTERM) };
            let deadline = Instant::now() + Duration::from_millis(200);
            while Instant::now() < deadline {
                // SAFETY: signal 0 only probes whether this process group still exists.
                if unsafe { libc::kill(-pid, 0) } != 0 {
                    break;
                }
                std::thread::sleep(Duration::from_millis(10));
            }
            // SAFETY: same owned PTY process group; escalation bounds cleanup time.
            unsafe { libc::kill(-pid, libc::SIGKILL) };
        }
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

/// Let Claude Code refresh and persist its own rotating credentials. Never
/// call its undocumented OAuth endpoint or write its keychain item ourselves.
async fn refresh_claude_via_cli(account: &Account) -> bool {
    let account = account.clone();
    tokio::task::spawn_blocking(move || {
        run_claude_usage_probe(&account, Path::new("claude"), CLI_PROBE_TIMING)
    })
    .await
    .unwrap_or(false)
}

fn claude_usage_probe_dir(account: &Account) -> Option<PathBuf> {
    let base = home()?.join(".perch/usage-trust");
    claude_usage_probe_dir_under(account, &base)
}

fn claude_usage_probe_dir_under(account: &Account, base: &Path) -> Option<PathBuf> {
    use std::os::unix::fs::{DirBuilderExt, MetadataExt, PermissionsExt};

    // Keep Claude Code's folder-trust entry stable without placing a
    // predictable path in a shared temp directory.
    let uid = unsafe { libc::geteuid() };
    let parent = base.parent()?;
    for (path, private) in [(parent, false), (base, true)] {
        match std::fs::DirBuilder::new().mode(0o700).create(path) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
            Err(_) => return None,
        }
        let metadata = std::fs::symlink_metadata(path).ok()?;
        let mode = metadata.permissions().mode() & 0o777;
        if !metadata.file_type().is_dir()
            || metadata.uid() != uid
            || (private && mode != 0o700)
            || (!private && mode & 0o022 != 0)
        {
            return None;
        }
    }
    let digest = format!(
        "{:x}",
        Sha256::digest(account.dir.as_os_str().as_encoded_bytes())
    );
    let account_dir = base.join(&digest[..16]);
    match std::fs::DirBuilder::new().mode(0o700).create(&account_dir) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
        Err(_) => return None,
    }
    let metadata = std::fs::symlink_metadata(&account_dir).ok()?;
    if !metadata.file_type().is_dir()
        || metadata.uid() != uid
        || metadata.permissions().mode() & 0o777 != 0o700
    {
        return None;
    }
    Some(account_dir)
}

fn run_claude_usage_probe(account: &Account, executable: &Path, timing: CliProbeTiming) -> bool {
    let Some(probe_dir) = claude_usage_probe_dir(account) else {
        return false;
    };
    run_claude_usage_probe_in(account, executable, timing, &probe_dir)
}

fn claude_probe_config_dir(account: &Account, inherited_override: bool) -> Option<&Path> {
    (!account.is_default || inherited_override).then_some(account.dir.as_path())
}

fn run_claude_usage_probe_in(
    account: &Account,
    executable: &Path,
    timing: CliProbeTiming,
    probe_dir: &Path,
) -> bool {
    use portable_pty::{native_pty_system, CommandBuilder, PtySize};
    use std::sync::mpsc;
    use std::thread;

    if std::fs::create_dir(probe_dir)
        .is_err_and(|error| error.kind() != std::io::ErrorKind::AlreadyExists)
    {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if std::fs::set_permissions(probe_dir, std::fs::Permissions::from_mode(0o700)).is_err() {
            return false;
        }
    }
    let pair = match native_pty_system().openpty(PtySize {
        rows: 40,
        cols: 120,
        pixel_width: 0,
        pixel_height: 0,
    }) {
        Ok(pair) => pair,
        Err(_) => return false,
    };
    let reader = match pair.master.try_clone_reader() {
        Ok(reader) => reader,
        Err(_) => return false,
    };
    let mut writer = match pair.master.take_writer() {
        Ok(writer) => writer,
        Err(_) => return false,
    };
    let mut command = CommandBuilder::new(executable.as_os_str());
    if let Some(config_dir) =
        claude_probe_config_dir(account, std::env::var_os("CLAUDE_CONFIG_DIR").is_some())
    {
        command.env("CLAUDE_CONFIG_DIR", config_dir);
    } else {
        command.env_remove("CLAUDE_CONFIG_DIR");
    }
    command.env("TERM", "xterm-256color");
    command.cwd(probe_dir);
    let child = match pair.slave.spawn_command(command) {
        Ok(child) => child,
        Err(_) => return false,
    };
    drop(pair.slave);
    let process_id = child.process_id();
    let _child = ProbeChild(child, process_id);
    let (tx, rx) = mpsc::channel();
    if thread::Builder::new()
        .name("perch-claude-usage-reader".into())
        .spawn(move || {
            let mut reader = reader;
            let mut bytes = [0; 4096];
            while let Ok(n) = reader.read(&mut bytes) {
                if n == 0 || tx.send(bytes[..n].to_vec()).is_err() {
                    break;
                }
            }
        })
        .is_err()
    {
        return false;
    }

    let start = Instant::now();
    let mut output = String::new();
    let mut usage_sent = false;
    let mut trust_accepted = false;
    let mut palette_accepted = false;
    let mut last_output = Instant::now();
    let mut ready = false;
    while start.elapsed() < timing.timeout {
        if !usage_sent && start.elapsed() >= timing.startup_delay {
            if writer.write_all(b"/usage\r").is_err() {
                break;
            }
            usage_sent = true;
        }
        match rx.recv_timeout(timing.poll_interval) {
            Ok(bytes) => {
                last_output = Instant::now();
                output.push_str(&String::from_utf8_lossy(&bytes));
                if output.len() > 512_000 {
                    output.drain(..output.len() - 512_000);
                }
                let clean = strip_terminal_sequences(&output);
                let lower = clean.to_lowercase();
                if !trust_accepted && lower.contains("do you trust") {
                    trust_accepted = writer.write_all(b"y\r").is_ok();
                } else if usage_sent
                    && !palette_accepted
                    && lower.contains("show plan usage limits")
                {
                    palette_accepted = writer.write_all(b"\r").is_ok();
                }
                ready = lower.contains("current session")
                    && (lower.contains("current week") || lower.contains("weekly limits"));
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if ready && last_output.elapsed() >= timing.settle_delay {
                    break;
                }
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
    ready
}

fn strip_terminal_sequences(raw: &str) -> String {
    static ANSI: OnceLock<Option<regex::Regex>> = OnceLock::new();
    match ANSI.get_or_init(|| {
        regex::Regex::new(r"\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07]*(?:\x07|\x1b\\)").ok()
    }) {
        Some(ansi) => ansi.replace_all(raw, "").into_owned(),
        None => raw.to_owned(),
    }
}

fn claude_from_json(body: &Value) -> Option<AccountUsage> {
    let windows: Vec<_> = [("five_hour", 300), ("seven_day", 10080)]
        .into_iter()
        .filter_map(|(key, minutes)| {
            let used = body[key]["utilization"].as_f64()?;
            Some(window(minutes, used, body[key].get("resets_at")))
        })
        .collect();
    (!windows.is_empty()).then(|| AccountUsage {
        provider: "claude".into(),
        label: None,
        windows,
        error: None,
    })
}

async fn fetch_codex(a: &Account) -> Option<AccountUsage> {
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
    let mut usage =
        codex_from_json(&curl_json("https://chatgpt.com/backend-api/wham/usage", &headers).await?)?;
    usage.label = a.label.clone();
    Some(usage)
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
        label: None,
        windows,
        error: None,
    })
}

async fn fetch_kimi(a: &Account) -> Option<AccountUsage> {
    let creds: Value = serde_json::from_str(
        &std::fs::read_to_string(a.dir.join("credentials/kimi-code.json")).ok()?,
    )
    .ok()?;
    let token = creds["access_token"].as_str().filter(|t| !t.is_empty())?;
    // The CLI owns the token lifecycle (rotating refresh tokens): never
    // refresh here, just skip until the CLI has rewritten the file.
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?
        .as_secs();
    if creds["expires_at"].as_u64()? <= now + 5 {
        return None;
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
    .await?;
    let mut usage = kimi_from_json(&body)?;
    usage.label = a.label.clone();
    Some(usage)
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
        label: None,
        windows,
        error: None,
    })
}

const GROK_PREFERRED_ISSUER: &str = "https://auth.x.ai";

async fn fetch_grok(a: &Account) -> Option<AccountUsage> {
    let auth: Value =
        serde_json::from_str(&std::fs::read_to_string(a.dir.join("auth.json")).ok()?).ok()?;
    let entries = auth.as_object()?;
    // The default xAI issuer wins; other issuers only when it's absent.
    // ponytail: `expires_at` isn't checked (no date parser in the tree); an
    // expired token just 401s and the account is omitted until the CLI refreshes.
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
        error: None,
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
    use serde_json::json;

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
    fn cli_refresh_attempts_are_cooled_down_even_when_usage_cache_is_forced() {
        let path = std::env::temp_dir().join(format!("perch-usage-test-{}", uuid::Uuid::new_v4()));
        assert!(claim_claude_cli_refresh(&path));
        assert!(!claim_claude_cli_refresh(&path));

        let concurrent_path =
            std::env::temp_dir().join(format!("perch-usage-test-{}", uuid::Uuid::new_v4()));
        let barrier = std::sync::Arc::new(std::sync::Barrier::new(8));
        let claims: Vec<_> = (0..8)
            .map(|_| {
                let barrier = barrier.clone();
                let path = concurrent_path.clone();
                std::thread::spawn(move || {
                    barrier.wait();
                    claim_claude_cli_refresh(&path)
                })
            })
            .collect();
        assert_eq!(
            claims
                .into_iter()
                .map(|claim| claim.join().unwrap())
                .filter(|won| *won)
                .count(),
            1
        );
    }

    #[cfg(unix)]
    #[test]
    fn hidden_cli_probe_is_bounded_isolated_and_cleans_up_each_process_mode() {
        use std::os::unix::fs::PermissionsExt;

        let root =
            std::env::temp_dir().join(format!("perch-cli-probe-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        let config = root.join("custom-claude-config");
        std::fs::create_dir(&config).unwrap();
        let account = Account {
            provider: "claude",
            dir: config.clone(),
            label: Some("work".into()),
            is_default: false,
        };
        let probe_dir = root.join("isolated-probe");
        let stable_base = root.join("stable-trust");
        let stable_probe = claude_usage_probe_dir_under(&account, &stable_base).unwrap();
        assert_eq!(
            claude_usage_probe_dir_under(&account, &stable_base).unwrap(),
            stable_probe
        );
        assert_eq!(
            std::fs::metadata(&stable_probe)
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o700
        );
        std::fs::remove_dir_all(stable_probe).unwrap();
        let timing = CliProbeTiming {
            startup_delay: Duration::from_millis(20),
            timeout: Duration::from_millis(300),
            settle_delay: Duration::from_millis(20),
            poll_interval: Duration::from_millis(5),
        };

        for (name, body, expected_ready, expect_child) in [
            ("ready", "printf '\\033[31mCurrent session\\033[0m\\nCurrent week\\n'; sleep 30 & echo $! > child-pid; wait", true, true),
            ("timeout", "sleep 30 & echo $! > child-pid; wait", false, true),
            ("leader-exit", "sleep 30 & echo $! > child-pid; exit 0", false, true),
            ("exit", "exit 0", false, false),
        ] {
            let mode = root.join(name);
            std::fs::create_dir(&mode).unwrap();
            let result = mode.join("result");
            let pid = mode.join("pid");
            let child_pid_path = mode.join("child-pid");
            let script = mode.join("claude-fake");
            let body = body.replace("child-pid", &child_pid_path.to_string_lossy());
            let script_text = format!(
                r#"#!/bin/sh
printf '%s\n%s\n' "$CLAUDE_CONFIG_DIR" "$(pwd)" > '{}'
echo $$ > '{}'
{}
"#,
                result.display(), pid.display(), body
            );
            std::fs::write(&script, script_text).unwrap();
            let mut permissions = std::fs::metadata(&script).unwrap().permissions();
            permissions.set_mode(0o700);
            std::fs::set_permissions(&script, permissions).unwrap();

            assert_eq!(run_claude_usage_probe_in(&account, &script, timing, &probe_dir), expected_ready, "{name}");
            let output = std::fs::read_to_string(&result).unwrap();
            let mut lines = output.lines();
            assert_eq!(lines.next(), Some(config.to_string_lossy().as_ref()));
            let cwd = PathBuf::from(lines.next().unwrap());
            let temp_dir = std::env::temp_dir().canonicalize().unwrap();
            let app_dir = std::env::current_dir().unwrap().canonicalize().unwrap();
            assert!(cwd.starts_with(&temp_dir), "{name}: cwd={cwd:?}, temp={temp_dir:?}");
            assert!(!cwd.starts_with(app_dir), "probe must not run in the app repo");
            assert_eq!(cwd, probe_dir.canonicalize().unwrap());
            assert_ne!(cwd, config.canonicalize().unwrap());
            if expect_child {
                assert_process_stopped(std::fs::read_to_string(child_pid_path).unwrap().trim());
            }
            assert_process_stopped(std::fs::read_to_string(pid).unwrap().trim());
        }
        std::fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    fn assert_process_stopped(pid: &str) {
        let pid: libc::pid_t = pid.parse().unwrap();
        for _ in 0..100 {
            // SAFETY: signal 0 only probes whether this process id still exists.
            if unsafe { libc::kill(pid, 0) } != 0 {
                return;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
        panic!("probe process {pid} survived cleanup");
    }

    #[test]
    fn terminal_control_sequences_are_removed_from_cli_output() {
        assert_eq!(
            strip_terminal_sequences("\u{1b}[31mCurrent session\u{1b}[0m"),
            "Current session"
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

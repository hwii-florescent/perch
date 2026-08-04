//! Detached agent turns on `mode: "direct"` hosts.
//!
//! A direct host is a machine with **no perch on it** — only `claude`/`codex`
//! and `tmux`. perch drives the CLIs itself over `ssh`, and the defining
//! property is that a hosted turn **outlives the ssh connection, the laptop
//! lid, and perch itself**:
//!
//! ```text
//!   perch                          remote host
//!   -----                          -----------
//!   ssh (bounded) ───────────────► set -m; nohup sh -c '… claude -p … >> run.jsonl' &
//!                 ◄─────────────── pgid + process start-time identity
//!   ssh (long-lived) ────────────► tail -c +<offset> -F run.jsonl
//!                 ◄─────────────── NDJSON, parsed by agent.rs's shared parsers
//! ```
//!
//! Design notes, and where each one comes from (survey of prior art in
//! `jean`, `herdr`, the Codex app, VS Code Remote-SSH and log shippers):
//!
//! * **Process-group isolation.** The launcher runs under `bash -c 'set -m'`,
//!   so the detached job is its own process-group leader; the pgid is then
//!   read back from `ps` rather than assumed. Cancel is `kill -TERM -<pgid>` —
//!   a *group* signal, so a `claude` that shelled out doesn't leak children.
//!   (jean does exactly this; `setsid` alone would give a new group but perch
//!   would still have to record and use its id.)
//! * **In-band terminal marker.** The authoritative "turn is over" signal is
//!   the CLI's own `{"type":"result"}` / `{"type":"turn.completed"}` line, and
//!   the launcher appends a synthetic `{"type":"perch.exit","code":N}` line to
//!   the *same* log if the process dies without one. A single `tail` therefore
//!   sees completion — no second round trip to poll an out-of-band `exit`
//!   file (which is still written, purely as a record for the reaper).
//! * **Self-describing header.** The first line of every run log is a
//!   `{"type":"perch.meta",…}` record carrying run/session/host/cwd/model and
//!   the remote CLI's version. It guarantees the file is never empty (so
//!   "exists but empty" is unambiguous) and makes an orphaned run directory
//!   self-explanatory. Both parsers ignore unknown `type`s, so it costs
//!   nothing at read time.
//! * **Cursor = offset + file identity + truncation check.** A bare byte
//!   offset is not a cursor ([`crate::ssh::TailCursor`]). Re-attaching within
//!   one perch lifetime re-`stat`s the file first and restarts from 0 if the
//!   inode changed or the file shrank.
//! * **Recovery re-reads from byte 0, deliberately.** The accumulated text of
//!   an in-flight turn lives in the tail task's memory (it is only written to
//!   SQLite when the turn ends), so a perch restart *must* re-read the whole
//!   log to persist a complete transcript. That is safe precisely because a
//!   restart also means no client holds partial state: WS connections are new
//!   and the replay ring buffer is empty. The persisted cursor is therefore a
//!   diagnostic/reaper aid, not the recovery mechanism.
//! * **Tri-state recovery.** For each run still marked `running`: process
//!   alive → re-tail; dead **and** the log has a terminal marker → finalize
//!   normally and scrape the provider's own session id out of the log so the
//!   conversation isn't orphaned; dead with **no** marker → crashed (and, for
//!   claude, fall back to the CLI's own transcript at
//!   `~/.claude/projects/<slug>/<sessionId>.jsonl`, which is a second durable
//!   copy nobody in the survey exploits).
//! * **Single-tailer guard.** perch has many WS clients and any of them
//!   reconnecting could otherwise start a second tail for the same run,
//!   duplicating every event. [`DetachedManager::active_tails`] is the
//!   compare-and-swap set that makes a second tail a no-op.
//! * **Cancel-before-spawn.** The launch round trip is hundreds of
//!   milliseconds over ssh, so a cancel can arrive before there is anything to
//!   kill; [`DetachedManager::pending_cancels`] holds it and the launcher
//!   applies it the instant it learns the pgid (jean's `PENDING_CANCELS`).
//! * **Permissions.** Headless `-p`/`exec` has no approval channel at all, so
//!   detached turns run `--permission-mode bypassPermissions` exactly like
//!   perch's local hosted turns. This is the ecosystem norm for headless
//!   execution, but for a *remote* turn running unattended it is a materially
//!   different risk posture — which is why the host editor labels direct mode
//!   explicitly rather than making it a silent default.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex, OnceLock};

use serde_json::Value;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use uuid::Uuid;

use crate::agent::{self, AgentEvent, ClaudeStreamParser, CodexStreamParser};
use crate::db::{DetachedRunRow, HistoryDb};
use crate::protocol::{AgentKind, ChatUsage, FsEntry, ServerMessage};
use crate::ssh;

/// Root of every run directory on the remote: `~/.perch-direct/<sid>/<rid>/`.
const RUN_ROOT: &str = ".perch-direct";

/// Run directories older than this are swept on host connect. Long enough to
/// cover a weekend laptop-closed gap (VS Code ships a 3 h grace, gemini-cli 30
/// days; a week is the middle ground for logs perch has already ingested).
const RETENTION_DAYS: u32 = 7;

// ---------------------------------------------------------------------------
// Sink
// ---------------------------------------------------------------------------

/// How a detached turn reaches the rest of the server.
///
/// Implemented by `server.rs` over its `AppState`. It exists as a trait rather
/// than a pile of `Arc` fields so this module owns none of the server's
/// session bookkeeping semantics (running set, unseen dots, `session.updated`
/// fan-out, SQLite writes) — it just reports what happened.
pub trait TurnSink: Send + Sync {
    /// Stream one wire message for `session_id` to every connected client and
    /// record it in the replay ring buffer.
    fn emit(&self, session_id: &str, msg: ServerMessage);
    /// Mark the session running (or not) and broadcast `session.updated`.
    fn set_running(&self, session_id: &str, running: bool);
    /// Persist the finished assistant turn.
    fn persist_turn(&self, session_id: &str, turn: FinishedTurn);
}

/// The completed assistant turn handed to [`TurnSink::persist_turn`].
pub struct FinishedTurn {
    pub agent: AgentKind,
    pub model: Option<String>,
    pub text: String,
    pub thinking: String,
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/// Everything needed to launch one detached turn.
pub struct TurnRequest {
    pub session_id: String,
    pub host_id: String,
    pub ssh_host: String,
    pub cwd: String,
    pub agent: AgentKind,
    pub model: Option<String>,
    pub prompt: String,
    /// Claude's own session id for this perch session, when a previous turn
    /// already established one (`--resume`); `None` mints a fresh uuid and
    /// passes `--session-id`, exactly like the local `ClaudeRunner`.
    pub claude_session_id: Option<String>,
    /// Codex's own thread id, when known (`codex exec resume <id>`).
    pub codex_thread_id: Option<String>,
    /// Run this turn in plan mode (claude `--permission-mode plan` / codex
    /// `--sandbox read-only`).
    pub plan_mode: bool,
    /// Reasoning effort for this turn; `None` omits the flag.
    pub effort: Option<String>,
    /// **Local** absolute paths of files the user attached. They are copied
    /// into this run's remote directory before launch and the CLI is given
    /// the *remote* paths — a local path would be meaningless on the host.
    pub attachments: Vec<String>,
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

pub struct DetachedManager {
    db: Arc<HistoryDb>,
    sink: OnceLock<Arc<dyn TurnSink>>,
    /// run ids with a live tail task — the double-attach guard.
    active_tails: Mutex<HashSet<String>>,
    /// Session ids cancelled while their launch was still in flight.
    pending_cancels: Mutex<HashSet<String>>,
    /// run ids whose turn was explicitly cancelled, so finalization reports
    /// `cancelled` rather than `failed` for the missing terminal marker.
    cancelled_runs: Mutex<HashSet<String>>,
    /// `ssh_host` → remote `$HOME`, so run paths are absolute (a `tail` of
    /// `~/…` would be expanded by whichever shell ssh happens to use).
    host_home: Mutex<HashMap<String, String>>,
}

impl DetachedManager {
    pub fn new(db: Arc<HistoryDb>) -> Arc<Self> {
        Arc::new(Self {
            db,
            sink: OnceLock::new(),
            active_tails: Mutex::new(HashSet::new()),
            pending_cancels: Mutex::new(HashSet::new()),
            cancelled_runs: Mutex::new(HashSet::new()),
            host_home: Mutex::new(HashMap::new()),
        })
    }

    /// Wire up the server-side sink. Called once, immediately after
    /// `AppState` exists (the sink needs `AppState`, and `AppState` holds the
    /// manager — hence the deferred set rather than a constructor argument).
    pub fn attach_sink(&self, sink: Arc<dyn TurnSink>) {
        let _ = self.sink.set(sink);
    }

    fn sink(&self) -> Option<&Arc<dyn TurnSink>> {
        self.sink.get()
    }

    /// Resolve (and cache) the remote `$HOME`.
    async fn home_for(&self, ssh_host: &str) -> Result<String, String> {
        if let Some(home) = self.host_home.lock().unwrap().get(ssh_host) {
            return Ok(home.clone());
        }
        let home = ssh::run_remote(ssh_host, r#"echo "$HOME""#, 20, "home").await?;
        let home = home.lines().last().unwrap_or("").trim().to_string();
        if home.is_empty() {
            return Err("could not resolve remote $HOME".to_string());
        }
        self.host_home
            .lock()
            .unwrap()
            .insert(ssh_host.to_string(), home.clone());
        Ok(home)
    }

    // -----------------------------------------------------------------------
    // Launch
    // -----------------------------------------------------------------------

    /// Launch a detached turn and start tailing it. Returns immediately; all
    /// work happens on a spawned task, and every outcome (including launch
    /// failure) is reported through the sink so the session never sticks in
    /// "running".
    pub fn start_turn(self: &Arc<Self>, req: TurnRequest) {
        let this = self.clone();
        tokio::spawn(async move {
            let session_id = req.session_id.clone();
            let agent = req.agent;
            let model = req.model.clone();
            if let Err(err) = this.clone().launch_and_tail(req).await {
                if let Some(sink) = this.sink() {
                    sink.emit(&session_id, ServerMessage::Error { message: err });
                    sink.emit(
                        &session_id,
                        ServerMessage::ChatDone {
                            session_id: session_id.clone(),
                            usage: None,
                        },
                    );
                    sink.persist_turn(
                        &session_id,
                        FinishedTurn {
                            agent,
                            model,
                            text: String::new(),
                            thinking: String::new(),
                        },
                    );
                    sink.set_running(&session_id, false);
                }
            }
        });
    }

    async fn launch_and_tail(self: Arc<Self>, req: TurnRequest) -> Result<(), String> {
        let home = self.home_for(&req.ssh_host).await?;
        let run_id = Uuid::new_v4().to_string();
        let run_dir = format!("{home}/{RUN_ROOT}/{}/{}", req.session_id, run_id);
        let log_path = format!("{run_dir}/run.jsonl");
        let prompt_path = format!("{run_dir}/prompt.txt");

        // Provider continuity id for this turn. Claude's is minted by perch
        // (so CLI mode and recovery can both find the transcript before the
        // first line of output exists); codex's is minted by codex.
        let claude_id = match req.agent {
            AgentKind::Claude => Some(
                req.claude_session_id
                    .clone()
                    .unwrap_or_else(|| Uuid::new_v4().to_string()),
            ),
            AgentKind::Codex => None,
        };
        if let (AgentKind::Claude, Some(id)) = (req.agent, claude_id.as_ref()) {
            if req.claude_session_id.is_none() {
                let _ = self.db.set_claude_session_id(&req.session_id, id);
            }
        }

        // Attachments live inside this run's directory, so they are named
        // deterministically *before* anything is uploaded — the prompt note
        // has to quote the remote paths, and the note is part of the prompt
        // file that gets written first.
        let remote_attachments: Vec<String> = req
            .attachments
            .iter()
            .enumerate()
            .map(|(i, local)| {
                format!(
                    "{run_dir}/attachments/{i}-{}",
                    sanitize_attachment_name(local)
                )
            })
            .collect();
        // claude reads every attachment itself off the text note; codex takes
        // images through `-i` and only needs the note for the rest.
        let (image_paths, note_paths): (Vec<String>, Vec<String>) = match req.agent {
            AgentKind::Claude => (Vec::new(), remote_attachments.clone()),
            AgentKind::Codex => remote_attachments
                .iter()
                .cloned()
                .partition(|p| agent::is_image_path(p)),
        };
        let prompt = agent::append_attachment_note(&req.prompt, &note_paths);

        let cli_cmd = match req.agent {
            AgentKind::Claude => claude_command(
                req.model.as_deref(),
                claude_id.as_deref().unwrap_or_default(),
                req.claude_session_id.is_some(),
                req.plan_mode,
                req.effort.as_deref(),
            ),
            AgentKind::Codex => codex_command(
                req.model.as_deref(),
                req.codex_thread_id.as_deref(),
                req.plan_mode,
                req.effort.as_deref(),
                &image_paths,
            ),
        };

        let meta = serde_json::json!({
            "type": "perch.meta",
            "runId": run_id,
            "sessionId": req.session_id,
            "hostId": req.host_id,
            "cwd": req.cwd,
            "agent": agent_str(req.agent),
            "model": req.model,
            "startedAt": chrono_millis(),
        })
        .to_string();

        // ------------------------------------------------------------------
        // Durability barrier. The row is written *before* anything is spawned
        // on the remote, with `pid`/`pgid` still NULL.
        //
        // The bug this fixes: the row used to be written only after the prompt
        // write and the launch round trip had both returned — a 2-4 s window
        // on a devpod. A perch killed inside that window left a turn that was
        // genuinely running (and would run to completion) on the remote with
        // *no record of it anywhere in perch*, so `recover_all` had nothing to
        // find and the reply was lost for good. Observed exactly that way:
        // a completed remote run dir with 29 lines and `exit 0`, a user
        // message in SQLite, no assistant reply, and no `detached_runs` row.
        //
        // Writing first inverts the failure: the worst case is now a row whose
        // job may or may not have been spawned, which recovery can resolve by
        // looking at the remote (see `recover_one`), rather than an orphan
        // nothing knows about. `run_dir`/`log_path` are deterministic and
        // derived above, so they are already correct in this pre-launch row.
        //
        // This sits ahead of the *prompt upload* too, not just the launch: the
        // upload is itself an ssh round trip, and a kill during it must leave
        // the same recoverable trace (recovery finds no log and no process,
        // and tells the user the turn never started) instead of a silent hole.
        // ------------------------------------------------------------------
        let mut row = DetachedRunRow {
            run_id: run_id.clone(),
            session_id: req.session_id.clone(),
            host_id: req.host_id.clone(),
            ssh_host: req.ssh_host.clone(),
            agent: agent_str(req.agent).to_string(),
            model: req.model.clone(),
            cwd: req.cwd.clone(),
            run_dir: run_dir.clone(),
            log_path: log_path.clone(),
            pid: None,
            pgid: None,
            proc_start: None,
            cursor_offset: 0,
            cursor_inode: 0,
            provider_session_id: claude_id.clone(),
            status: "running".to_string(),
            created_at: chrono_millis(),
        };
        self.db
            .insert_detached_run(&row)
            .map_err(|e| format!("failed recording detached run: {e}"))?;

        // The prompt goes over ssh *stdin*, never the command line: it is
        // arbitrary user text and shell-quoting megabytes of it into an argv
        // is both a correctness and an injection hazard.
        if let Err(e) = ssh::write_remote_file(&req.ssh_host, &prompt_path, &prompt, 60).await {
            let _ = self.db.finish_detached_run(&run_id, "failed", None);
            return Err(e);
        }

        // Attachments follow the prompt, same run directory. A failed upload
        // aborts the turn rather than launching a CLI that would be told to
        // read a file that isn't there.
        for (local, remote) in req.attachments.iter().zip(remote_attachments.iter()) {
            let bytes = match std::fs::read(local) {
                Ok(b) => b,
                Err(e) => {
                    let _ = self.db.finish_detached_run(&run_id, "failed", None);
                    return Err(format!("could not read attachment {local}: {e}"));
                }
            };
            if let Err(e) = ssh::write_remote_bytes(&req.ssh_host, remote, &bytes, 120).await {
                let _ = self.db.finish_detached_run(&run_id, "failed", None);
                return Err(e);
            }
        }

        let launched = match self
            .launch_remote(&req, &run_dir, &log_path, &prompt_path, &cli_cmd, &meta)
            .await
        {
            Ok(launched) => launched,
            Err(e) => {
                // The row exists now, so a failed launch has to close it out
                // explicitly or recovery would retry it forever.
                let _ = self.db.finish_detached_run(&run_id, "failed", None);
                return Err(e);
            }
        };

        row.pid = Some(launched.pid);
        row.pgid = Some(launched.pgid);
        row.proc_start = launched.proc_start.clone();
        let _ = self.db.attach_detached_pid(
            &run_id,
            launched.pid,
            launched.pgid,
            launched.proc_start.as_deref(),
        );

        // Cancel-before-spawn: a cancel that arrived while the launch round
        // trip was in flight had nothing to kill. Apply it now.
        if self.pending_cancels.lock().unwrap().remove(&req.session_id) {
            self.cancelled_runs.lock().unwrap().insert(run_id.clone());
            let _ = kill_pgid(&req.ssh_host, launched.pgid).await;
        }

        self.spawn_tail(row, false);
        Ok(())
    }

    /// One bounded ssh round trip: create the run dir, write the header line,
    /// start the detached job under `set -m`, and report its pgid plus a
    /// start-time identity for that pgid.
    async fn launch_remote(
        &self,
        req: &TurnRequest,
        run_dir: &str,
        log_path: &str,
        prompt_path: &str,
        cli_cmd: &str,
        meta: &str,
    ) -> Result<Launched, String> {
        let q = ssh::shell_quote;
        // The inner script is what actually survives: it owns the redirection
        // into the run log, the in-band exit marker, and the numeric `exit`
        // record. It is single-quoted into `sh -c` by `shell_quote`, which
        // escapes the quotes it contains.
        let inner = format!(
            "cd {cwd} || exit 127; {cli} < {prompt} >> {log} 2>> {stderr}; c=$?; \
             printf '{{\"type\":\"perch.exit\",\"code\":%d}}\\n' \"$c\" >> {log}; echo \"$c\" > {exit_file}",
            cwd = q(&req.cwd),
            cli = cli_cmd,
            prompt = q(prompt_path),
            log = q(log_path),
            stderr = q(&format!("{run_dir}/stderr.log")),
            exit_file = q(&format!("{run_dir}/exit")),
        );
        // The launcher runs under **bash** when available, because that is the
        // only widely-available shell whose non-interactive `set -m` actually
        // puts a background job in its own process group. The remote login
        // shell can't be relied on: zsh refuses `set -m` outright
        // ("can't change option: -m") and dash reports "can't access tty; job
        // control turned off" and leaves the job in the *parent's* group —
        // which would make cancel signal the ssh session's group instead of
        // the turn's. The pgid is then read back from `ps` rather than assumed
        // to equal `$!`, so even the `sh` fallback path cancels the right
        // group.
        let launcher = format!(
            "set -m 2>/dev/null; nohup sh -c {inner} >/dev/null 2>&1 & \
             p=$!; \
             g=$(ps -o pgid= -p $p 2>/dev/null | tr -d ' '); \
             [ -n \"$g\" ] || g=$p; \
             echo \"PERCH_PID $p\"; echo \"PERCH_PGID $g\"; \
             s=$(awk '{{print $22}}' /proc/$p/stat 2>/dev/null || ps -o lstart= -p $p 2>/dev/null | head -1); \
             echo \"PERCH_START $s\"",
            inner = q(&inner),
        );
        let script = format!(
            "mkdir -p {dir} || exit 1; printf '%s\\n' {meta} > {log}; : > {stderr}; \
             launcher={launcher}; \
             sh_bin=$(command -v bash || command -v sh); \
             \"$sh_bin\" -c \"$launcher\"",
            dir = q(run_dir),
            meta = q(meta),
            log = q(log_path),
            stderr = q(&format!("{run_dir}/stderr.log")),
            launcher = q(&launcher),
        );
        let out = ssh::run_remote(&req.ssh_host, &script, 45, "launch").await?;
        let field = |key: &str| -> Option<String> {
            out.lines()
                .find_map(|l| l.strip_prefix(key))
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty())
        };
        let pid = field("PERCH_PID ")
            .and_then(|v| v.parse::<i64>().ok())
            .ok_or_else(|| "remote launch did not report a pid".to_string())?;
        let pgid = field("PERCH_PGID ")
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(pid);
        let proc_start = field("PERCH_START ");
        tracing::info!(
            "[detached] {}: launched {} turn pid={pid} pgid={pgid}",
            req.host_id,
            agent_str(req.agent)
        );
        Ok(Launched {
            pid,
            pgid,
            proc_start,
        })
    }

    // -----------------------------------------------------------------------
    // Cancel
    // -----------------------------------------------------------------------

    /// Cancel the in-flight detached turn for `session_id`, if any, by
    /// signalling its **process group** over ssh. If the launch round trip is
    /// still in flight the cancel is queued and applied the moment the pgid is
    /// known.
    pub fn cancel(self: &Arc<Self>, session_id: &str) {
        let run = self
            .db
            .running_detached_run_for_session(session_id)
            .ok()
            .flatten();
        let Some(run) = run else {
            // Nothing launched yet — remember it (jean's PENDING_CANCELS).
            self.pending_cancels
                .lock()
                .unwrap()
                .insert(session_id.to_string());
            return;
        };
        let Some(pgid) = run.pgid else {
            // A row exists but the launch round trip hasn't reported a pid
            // yet. Queue the cancel the same way — `launch_and_tail` applies
            // it the instant it learns the pgid.
            self.pending_cancels
                .lock()
                .unwrap()
                .insert(session_id.to_string());
            return;
        };
        self.cancelled_runs
            .lock()
            .unwrap()
            .insert(run.run_id.clone());
        let ssh_host = run.ssh_host.clone();
        tokio::spawn(async move {
            if let Err(e) = kill_pgid(&ssh_host, pgid).await {
                tracing::warn!("[detached] cancel failed: {e}");
            }
        });
    }

    // -----------------------------------------------------------------------
    // Recovery
    // -----------------------------------------------------------------------

    /// Re-attach to every detached turn this perch believes is still running.
    /// Called once at startup, before any client connects.
    ///
    /// The re-attach is a *replay*, not a resume-from-cursor: `tail_run`
    /// starts at byte 0 and pushes every line back through the same parser and
    /// the same [`TurnSink`] a live tail uses, so assistant text, thinking,
    /// tool calls and agent/model attribution all reach the registry and
    /// SQLite exactly as if the tail had never broken. Nothing is skipped
    /// between the persisted cursor and current EOF; the cursor is a
    /// diagnostic, not the recovery mechanism.
    pub fn recover_all(self: &Arc<Self>) {
        let runs = match self.db.unfinished_detached_runs() {
            Ok(runs) => runs,
            Err(e) => {
                tracing::warn!("[detached] recovery query failed: {e}");
                return;
            }
        };
        if runs.is_empty() {
            return;
        }
        tracing::info!("[detached] recovering {} unfinished run(s)", runs.len());
        for run in runs {
            if let Some(sink) = self.sink() {
                // Show the dot again straight away: the turn really is still
                // in flight on the remote, and the UI should say so before
                // the first re-tailed byte arrives. Every exit path from
                // `finalize` clears it again, so a turn that finished while
                // perch was gone can't get stuck "running".
                sink.set_running(&run.session_id, true);
            }
            let this = self.clone();
            tokio::spawn(async move {
                this.recover_one(run).await;
            });
        }
    }

    /// Resolve one unfinished run before handing it to the tail loop.
    ///
    /// The interesting case is a row with **no pid**: it was written by the
    /// durability barrier in `launch_and_tail` and perch died before the
    /// launch round trip answered. The job may nevertheless be running (or
    /// already finished) on the remote, so look for it by run id and adopt its
    /// process identity — that turns what used to be an unrecoverable orphan
    /// into an ordinary recovery.
    async fn recover_one(self: Arc<Self>, mut run: DetachedRunRow) {
        if run.pid.is_none() {
            match find_run_process(&run.ssh_host, &run.run_id).await {
                Some((pid, pgid)) => {
                    tracing::info!(
                        "[detached] {}: adopted orphaned job pid={pid} pgid={pgid}",
                        run.run_id
                    );
                    run.pid = Some(pid);
                    run.pgid = Some(pgid);
                    let _ = self.db.attach_detached_pid(&run.run_id, pid, pgid, None);
                }
                None => {
                    // Not running. Either it finished (the log has a terminal
                    // marker and the tail below will ingest the whole thing)
                    // or it never started at all.
                    let exists = ssh::stat_remote_file(&run.ssh_host, &run.log_path)
                        .await
                        .ok()
                        .flatten()
                        .is_some();
                    if !exists {
                        tracing::warn!(
                            "[detached] {}: no run log and no process — launch never happened",
                            run.run_id
                        );
                        let _ = self.db.finish_detached_run(&run.run_id, "failed", None);
                        if let Some(sink) = self.sink() {
                            sink.emit(
                                &run.session_id,
                                ServerMessage::Error {
                                    message: format!(
                                        "the turn never started on {} (perch stopped mid-launch); send it again",
                                        run.host_id
                                    ),
                                },
                            );
                            sink.emit(
                                &run.session_id,
                                ServerMessage::ChatDone {
                                    session_id: run.session_id.clone(),
                                    usage: None,
                                },
                            );
                            sink.set_running(&run.session_id, false);
                        }
                        return;
                    }
                }
            }
        }
        self.spawn_tail(run, true);
    }

    // -----------------------------------------------------------------------
    // Tail
    // -----------------------------------------------------------------------

    fn spawn_tail(self: &Arc<Self>, run: DetachedRunRow, recovering: bool) {
        // Compare-and-swap double-attach guard: exactly one tail per run id,
        // no matter how many clients reconnect.
        if !self.active_tails.lock().unwrap().insert(run.run_id.clone()) {
            tracing::debug!("[detached] tail already active for {}", run.run_id);
            return;
        }
        let this = self.clone();
        tokio::spawn(async move {
            let run_id = run.run_id.clone();
            this.clone().tail_run(run, recovering).await;
            this.active_tails.lock().unwrap().remove(&run_id);
        });
    }

    async fn tail_run(self: Arc<Self>, run: DetachedRunRow, recovering: bool) {
        let agent = match run.agent.as_str() {
            "codex" => AgentKind::Codex,
            _ => AgentKind::Claude,
        };
        let mut parser = Parser::new(agent);
        let mut acc = Accumulator::default();
        // Always from byte 0: within one perch lifetime this *is* the start of
        // the run, and after a restart the in-memory transcript is gone and
        // must be rebuilt (see the module doc). Re-emitting is safe because a
        // restart also means no client holds partial state.
        let mut offset: u64 = 0;
        let mut inode: u64 = 0;
        let mut idle_rounds = 0u32;

        'outer: loop {
            // Cursor validation before every (re-)attach: identity + the
            // `offset > size` truncation check, Filebeat's rule.
            match ssh::stat_remote_file(&run.ssh_host, &run.log_path).await {
                Ok(Some(id)) => {
                    let rotated = inode != 0 && id.inode != inode;
                    if offset > id.size || rotated {
                        tracing::warn!(
                            "[detached] {}: log truncated/rotated, restarting from 0",
                            run.run_id
                        );
                        offset = 0;
                        parser = Parser::new(agent);
                        acc = Accumulator::default();
                    }
                    inode = id.inode;
                }
                Ok(None) => {
                    // The launcher writes the header line before backgrounding
                    // the job, so a missing file this early means the run dir
                    // was swept or the launch lost a race — check liveness.
                    if !self.is_alive(&run).await {
                        break 'outer;
                    }
                }
                Err(e) => tracing::debug!("[detached] {}: stat failed: {e}", run.run_id),
            }

            let mut child =
                match ssh::spawn_tail_checked(&run.ssh_host, &run.log_path, offset).await {
                    Ok(c) => c,
                    Err(e) => {
                        tracing::warn!("[detached] {}: tail spawn failed: {e}", run.run_id);
                        break 'outer;
                    }
                };
            let Some(stdout) = child.stdout.take() else {
                break 'outer;
            };
            let mut lines = BufReader::new(stdout).lines();

            // Ends on EOF (`Ok(None)` — the ssh child exited) or a read error;
            // both mean "this tail is over", and the outer loop then decides
            // whether to re-attach or finalize.
            while let Ok(Some(line)) = lines.next_line().await {
                idle_rounds = 0;
                offset += line.len() as u64 + 1;
                if self.ingest_line(&run, &mut parser, &mut acc, &line) {
                    break;
                }
            }
            let _ = child.kill().await;
            let _ = self.db.update_detached_cursor(&run.run_id, offset, inode);

            if parser.saw_terminal() || acc.exit_code.is_some() {
                break 'outer;
            }

            // The tail child ended without a terminal marker: either the
            // network dropped (process still running → re-attach from the
            // cursor) or the process is gone (→ crashed).
            if !self.is_alive(&run).await {
                break 'outer;
            }
            idle_rounds += 1;
            let backoff = std::cmp::min(1 + idle_rounds as u64, 10);
            tokio::time::sleep(std::time::Duration::from_secs(backoff)).await;
        }

        self.finalize(run, parser, acc, agent, recovering).await;
    }

    /// Feed one run-log line through the parser and drain whatever it produced
    /// into the sink and the turn accumulator. Returns `true` when the line
    /// ended the turn.
    ///
    /// This is deliberately the *only* place a run-log line is interpreted, so
    /// a live tail and a recovery replay cannot drift apart: recovery replays
    /// the log through exactly this function, which is what makes a recovered
    /// turn persist identically to one that streamed live.
    fn ingest_line(
        &self,
        run: &DetachedRunRow,
        parser: &mut Parser,
        acc: &mut Accumulator,
        line: &str,
    ) -> bool {
        if let Some(code) = perch_exit_code(line) {
            acc.exit_code = Some(code);
            return true;
        }
        let (tx, mut rx) = unbounded_channel::<AgentEvent>();
        parser.handle_line(line, &tx);
        drop(tx);
        while let Ok(event) = rx.try_recv() {
            self.dispatch(run, event, acc);
        }
        parser.saw_terminal()
    }

    /// Convert one parsed [`AgentEvent`] into wire traffic + accumulated turn
    /// text. `Done` is *captured* rather than emitted: finalization emits
    /// exactly one `chat.done`, whichever way the turn ended.
    fn dispatch(&self, run: &DetachedRunRow, event: AgentEvent, acc: &mut Accumulator) {
        let sid = run.session_id.clone();
        // Accumulate first, emit second, and never make accumulation
        // conditional on having a sink: the accumulator is what ends up in
        // SQLite, so dropping into it because there's no live listener would
        // silently lose the turn's content — the exact failure mode this
        // module exists to prevent.
        match &event {
            AgentEvent::Chunk(text) => acc.text.push_str(text),
            AgentEvent::Thinking(text) => acc.thinking.push_str(text),
            AgentEvent::Done(usage) => acc.usage = usage.clone(),
            AgentEvent::Error(message) => acc.error = Some(message.clone()),
            AgentEvent::Plan { .. }
            | AgentEvent::ToolUse { .. }
            | AgentEvent::ToolResult { .. } => {}
        }
        let Some(sink) = self.sink() else { return };
        match event {
            AgentEvent::Chunk(text) => {
                sink.emit(
                    &sid,
                    ServerMessage::ChatChunk {
                        session_id: sid.clone(),
                        text,
                    },
                );
            }
            AgentEvent::Thinking(text) => {
                sink.emit(
                    &sid,
                    ServerMessage::ChatThinking {
                        session_id: sid.clone(),
                        text,
                    },
                );
            }
            AgentEvent::ToolUse { name, input } => sink.emit(
                &sid,
                ServerMessage::ChatToolUse {
                    session_id: sid.clone(),
                    name,
                    input,
                },
            ),
            AgentEvent::ToolResult { name, result } => sink.emit(
                &sid,
                ServerMessage::ChatToolResult {
                    session_id: sid.clone(),
                    name,
                    result,
                },
            ),
            AgentEvent::Done(_) => {}
            AgentEvent::Plan { content } => sink.emit(
                &sid,
                ServerMessage::ChatPlan {
                    session_id: sid.clone(),
                    content,
                },
            ),
            AgentEvent::Error(message) => {
                sink.emit(&sid, ServerMessage::Error { message });
            }
        }
    }

    /// Liveness with identity (prior-art B3): `kill -0` alone would be fooled
    /// by a recycled pid, so the process's start time is compared against the
    /// value captured at launch.
    async fn is_alive(&self, run: &DetachedRunRow) -> bool {
        let Some(pid) = run.pid.or(run.pgid) else {
            // No process identity was ever recorded (perch died between the
            // durability barrier and the launch reply). Fall back to finding
            // the job by run id, which appears in its argv via the run
            // directory path.
            return find_run_process(&run.ssh_host, &run.run_id).await.is_some();
        };
        let cmd = format!(
            "if kill -0 {pid} 2>/dev/null; then \
               s=$(awk '{{print $22}}' /proc/{pid}/stat 2>/dev/null || ps -o lstart= -p {pid} 2>/dev/null | head -1); \
               echo \"ALIVE $s\"; else echo DEAD; fi"
        );
        match ssh::run_remote(&run.ssh_host, &cmd, 20, "liveness").await {
            Ok(out) => {
                let line = out.lines().last().unwrap_or("").trim().to_string();
                let Some(start) = line.strip_prefix("ALIVE ") else {
                    return false;
                };
                match (&run.proc_start, start.trim()) {
                    (Some(expected), actual)
                        if !expected.is_empty() && !actual.is_empty() && expected != actual =>
                    {
                        tracing::warn!(
                            "[detached] {}: pid {pid} was recycled — treating as dead",
                            run.run_id
                        );
                        false
                    }
                    // Identities match, or no identity was recorded on either
                    // side — in the latter case fall back to the bare `kill -0`
                    // answer rather than declaring a live turn dead.
                    _ => true,
                }
            }
            // An ssh failure is not evidence the process died; assume alive so
            // the loop re-attaches rather than truncating a live turn.
            Err(e) => {
                tracing::debug!("[detached] {}: liveness probe failed: {e}", run.run_id);
                true
            }
        }
    }

    async fn finalize(
        self: Arc<Self>,
        run: DetachedRunRow,
        parser: Parser,
        mut acc: Accumulator,
        agent: AgentKind,
        recovering: bool,
    ) {
        let cancelled = self.cancelled_runs.lock().unwrap().remove(&run.run_id);
        let clean = parser.saw_terminal();

        // Scrape the provider's own continuity id out of the log so a turn
        // that completed while perch was away stays attached to its
        // conversation (this is the part people forget).
        let provider_id = parser
            .provider_id()
            .or_else(|| run.provider_session_id.clone());
        if let Some(id) = provider_id.as_deref() {
            match agent {
                AgentKind::Claude => {
                    let _ = self.db.set_claude_session_id(&run.session_id, id);
                }
                AgentKind::Codex => {
                    let _ = self.db.set_codex_thread_id(&run.session_id, id);
                }
            }
        }

        // Second recovery path: Claude Code already keeps a complete, durable
        // transcript on the remote. If our own log gave us nothing (crash,
        // truncated write) we can still reconstruct the reply from it.
        if !clean && acc.text.is_empty() && agent == AgentKind::Claude {
            if let Some(id) = provider_id.as_deref() {
                if let Some(text) = scrape_claude_transcript(&run.ssh_host, id).await {
                    tracing::info!(
                        "[detached] {}: recovered reply from the claude transcript",
                        run.run_id
                    );
                    if let Some(sink) = self.sink() {
                        sink.emit(
                            &run.session_id,
                            ServerMessage::ChatChunk {
                                session_id: run.session_id.clone(),
                                text: text.clone(),
                            },
                        );
                    }
                    acc.text = text;
                }
            }
        }

        let status = if cancelled {
            "cancelled"
        } else if clean {
            "done"
        } else {
            "failed"
        };
        let _ = self
            .db
            .finish_detached_run(&run.run_id, status, provider_id.as_deref());

        if let Some(sink) = self.sink() {
            if !clean && !cancelled && acc.error.is_none() {
                let detail = match acc.exit_code {
                    Some(code) => format!("remote {} exited with code {code}", run.agent),
                    None => format!("remote {} stopped without completing the turn", run.agent),
                };
                let hint = if acc.text.is_empty() {
                    format!(" (see {}/stderr.log on {})", run.run_dir, run.ssh_host)
                } else {
                    String::new()
                };
                sink.emit(
                    &run.session_id,
                    ServerMessage::Error {
                        message: format!("{detail}{hint}"),
                    },
                );
            }
            sink.emit(
                &run.session_id,
                ServerMessage::ChatDone {
                    session_id: run.session_id.clone(),
                    usage: acc.usage.clone(),
                },
            );
            sink.persist_turn(
                &run.session_id,
                FinishedTurn {
                    agent,
                    model: run.model.clone(),
                    text: acc.text.clone(),
                    thinking: acc.thinking.clone(),
                },
            );
            sink.set_running(&run.session_id, false);
        }
        tracing::info!(
            "[detached] {}: turn {status}{} ({} chars)",
            run.run_id,
            if recovering { " (recovered)" } else { "" },
            acc.text.len()
        );
    }
}

// ---------------------------------------------------------------------------
// CLI mode (Phase E): a local PTY whose child is ssh, not the agent
// ---------------------------------------------------------------------------

/// argv for a CLI-mode attach to a session on a direct host.
///
/// The local pty's child is `ssh -tt`, and the remote command is a
/// `tmux new-session -A` (attach-or-create, the same idempotent trick the hub
/// uses for `perch-core`), so the TUI survives the laptop sleeping and a
/// reattach re-renders from tmux's own screen buffer — no perch-side replay.
/// `terminal.resize` on the local pty propagates through ssh's `SIGWINCH`
/// automatically, so `terminal.rs` needs no changes at all.
///
/// Two perch clients attaching the same session share one tmux window (tmux
/// mirrors input as well as output). That is a deliberate accepted behaviour,
/// matching what `tmux attach` does everywhere else.
///
/// Rides the same shared control master as every other operation on this
/// host (`ssh::mux_opts`) — an attach right after a browse/probe/launch
/// skips the handshake entirely. Unlike the tail path this has no automatic
/// no-mux fallback if the master's `MaxSessions` cap is saturated: it is a
/// one-shot, user-triggered action (not a retry loop), so a failure here
/// just surfaces ssh's own error text in the terminal, which the user can
/// read and retry.
pub fn cli_attach_argv(
    ssh_host: &str,
    session_id: &str,
    cwd: &str,
    agent: AgentKind,
    provider_id: Option<&str>,
    model: Option<&str>,
) -> Vec<String> {
    let q = ssh::shell_quote;
    let cli = match agent {
        AgentKind::Claude => {
            let mut s = String::from("exec claude");
            if let Some(id) = provider_id {
                s.push_str(&format!(" --resume {}", q(id)));
            }
            // Always explicit: without it claude falls back to the dated
            // snapshot id in the transcript, which the GenAI proxy rejects.
            if let Some(m) = model {
                s.push_str(&format!(" --model {}", q(m)));
            }
            s
        }
        AgentKind::Codex => match provider_id {
            Some(id) => {
                let mut s = format!("exec codex resume {}", q(id));
                if let Some(m) = model {
                    s.push_str(&format!(" -m {}", q(m)));
                }
                s
            }
            None => "exec codex".to_string(),
        },
    };
    let inner = format!("{} cd {} || exit 1; {cli}", ssh::REMOTE_PATH_PREFIX, q(cwd));
    let tmux = format!(
        "tmux new-session -A -s {} {}",
        q(&format!("perch-cli-{session_id}")),
        q(&inner)
    );
    let mut argv = vec![
        "ssh".to_string(),
        "-tt".to_string(),
        "-o".to_string(),
        "BatchMode=yes".to_string(),
        "-o".to_string(),
        "ServerAliveInterval=15".to_string(),
    ];
    argv.extend(ssh::mux_opts());
    argv.push(ssh_host.to_string());
    argv.push(tmux);
    argv
}

/// Kill the CLI-mode tmux session for `session_id` on a direct host —
/// the remote counterpart of `TerminalManager::kill`, wired into the
/// session-delete teardown path.
pub async fn kill_cli_session(ssh_host: &str, session_id: &str) {
    let cmd = format!(
        "tmux kill-session -t {} 2>/dev/null; true",
        ssh::shell_quote(&format!("perch-cli-{session_id}"))
    );
    let _ = ssh::run_remote(ssh_host, &cmd, 20, "cli cleanup").await;
}

// ---------------------------------------------------------------------------
// Remote directory browsing (fs.browse for direct hosts)
// ---------------------------------------------------------------------------

/// `fs.browse` over ssh: one round trip listing the directories under `path`
/// (plus whether each is a git checkout), matching the local implementation's
/// contract exactly — hidden entries skipped, files skipped, never hard-fails
/// (an unreadable path falls back to `$HOME`).
///
/// Returns `(resolved_path, parent, home, entries)`.
pub async fn browse_remote(
    ssh_host: &str,
    path: Option<&str>,
    timeout_secs: u64,
) -> Result<(String, Option<String>, String, Vec<FsEntry>), String> {
    let target = match path {
        Some(p) if !p.is_empty() => ssh::shell_quote(p),
        _ => "\"$HOME\"".to_string(),
    };
    // `-maxdepth 1 -mindepth 1 -type d` is one syscall pass; the `.git` probe
    // is bounded to the entries actually listed, never recursive.
    let script = format!(
        r#"echo "$HOME"; d={target}; if [ ! -d "$d" ]; then d="$HOME"; fi; \
           cd "$d" || exit 1; p=$(pwd -P); echo "$p"; \
           for e in */; do e=${{e%/}}; case "$e" in '*') continue;; .*) continue;; esac; \
           if [ -e "$p/$e/.git" ]; then echo "G $e"; else echo "D $e"; fi; done"#
    );
    let out = ssh::run_remote(ssh_host, &script, timeout_secs, "browse").await?;
    let mut lines = out.lines();
    let home = lines.next().unwrap_or("").trim().to_string();
    let resolved = lines.next().unwrap_or("").trim().to_string();
    if resolved.is_empty() {
        return Err("remote browse returned no path".to_string());
    }
    let mut entries: Vec<FsEntry> = lines
        .filter_map(|l| {
            let (flag, name) = l.split_once(' ')?;
            let name = name.trim();
            if name.is_empty() {
                return None;
            }
            let base = resolved.trim_end_matches('/');
            Some(FsEntry {
                name: name.to_string(),
                path: format!("{base}/{name}"),
                is_git_repo: flag == "G",
            })
        })
        .collect();
    entries.sort_by(|a, b| a.name.cmp(&b.name));
    let parent = std::path::Path::new(&resolved)
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .map(|p| p.to_string_lossy().to_string());
    Ok((resolved, parent, home, entries))
}

/// Sweep run directories perch has already ingested. Called on direct-host
/// connect — the explicit retention policy every long-lived agent system in
/// the survey ships, and the cheap half of an orphan reaper.
pub async fn prune_old_runs(ssh_host: &str) {
    let cmd = format!(
        "find $HOME/{RUN_ROOT} -mindepth 2 -maxdepth 2 -type d -mtime +{RETENTION_DAYS} \
         -exec rm -rf {{}} + 2>/dev/null; true"
    );
    let _ = ssh::run_remote(ssh_host, &cmd, 30, "prune").await;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

struct Launched {
    pid: i64,
    pgid: i64,
    proc_start: Option<String>,
}

#[derive(Default)]
struct Accumulator {
    text: String,
    thinking: String,
    usage: Option<ChatUsage>,
    error: Option<String>,
    exit_code: Option<i32>,
}

/// Thin dispatcher over the two shared stream-json parsers in `agent.rs`.
/// Detached turns emit byte-for-byte the same NDJSON as local ones — reusing
/// the exact same parsers is what makes a remote turn render identically.
enum Parser {
    Claude(Box<ClaudeStreamParser>),
    Codex(CodexStreamParser),
}

impl Parser {
    fn new(agent: AgentKind) -> Self {
        match agent {
            AgentKind::Claude => Parser::Claude(Box::default()),
            AgentKind::Codex => Parser::Codex(CodexStreamParser::new()),
        }
    }
    fn handle_line(&mut self, line: &str, tx: &UnboundedSender<AgentEvent>) {
        match self {
            Parser::Claude(p) => p.handle_line(line, tx),
            Parser::Codex(p) => p.handle_line(line, tx),
        }
    }
    fn saw_terminal(&self) -> bool {
        match self {
            Parser::Claude(p) => p.saw_terminal,
            Parser::Codex(p) => p.saw_terminal,
        }
    }
    fn provider_id(&self) -> Option<String> {
        match self {
            Parser::Claude(p) => p.session_id.clone(),
            Parser::Codex(p) => p.thread_id.clone(),
        }
    }
}

/// Recognise the launcher's synthetic in-band terminal marker.
fn perch_exit_code(line: &str) -> Option<i32> {
    let trimmed = line.trim();
    if !trimmed.contains("perch.exit") {
        return None;
    }
    let v: Value = serde_json::from_str(trimmed).ok()?;
    if v.get("type").and_then(Value::as_str) != Some("perch.exit") {
        return None;
    }
    Some(v.get("code").and_then(Value::as_i64).unwrap_or(-1) as i32)
}

fn agent_str(agent: AgentKind) -> &'static str {
    match agent {
        AgentKind::Claude => "claude",
        AgentKind::Codex => "codex",
    }
}

fn chrono_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Reduce a local attachment path to a safe remote *file name*.
///
/// The name comes from a browser upload, so it is fully attacker-controlled:
/// anything outside `[A-Za-z0-9._-]` is folded to `_`, which incidentally
/// removes `/` and `..` and so pins the file inside the run directory. The
/// index prefix the caller adds keeps two same-named attachments distinct.
fn sanitize_attachment_name(path: &str) -> String {
    let base = path.rsplit('/').next().unwrap_or(path);
    let cleaned: String = base
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let cleaned = cleaned.trim_matches('.').to_string();
    if cleaned.is_empty() {
        "attachment".to_string()
    } else {
        cleaned
    }
}

/// The remote `claude` invocation for one detached turn — the same flag set
/// `ClaudeRunner::run_once` uses locally, with the prompt on stdin instead of
/// argv (a turn's prompt can be megabytes; argv can't).
pub(crate) fn claude_command(
    model: Option<&str>,
    session_id: &str,
    resume: bool,
    plan_mode: bool,
    effort: Option<&str>,
) -> String {
    let q = ssh::shell_quote;
    let mut s = String::new();
    // `effort: "none"` is an env knob, not a flag (see `claude_effort_env`);
    // as a `VAR=v cmd` prefix it applies to just this child.
    if let Some((k, v)) = agent::claude_effort_env(effort) {
        s.push_str(&format!("{k}={v} "));
    }
    s.push_str("claude -p");
    for flag in agent::claude_turn_flags("bypassPermissions", plan_mode, model, effort) {
        s.push(' ');
        s.push_str(&q(&flag));
    }
    if resume {
        s.push_str(&format!(" --resume {}", q(session_id)));
    } else {
        s.push_str(&format!(" --session-id {}", q(session_id)));
    }
    s
}

/// The remote `codex` invocation. `codex exec resume <id>` gives the thread
/// continuity the local `CodexRunner` never needed (it starts a fresh process
/// per turn); the trailing `-` makes codex read the prompt from stdin.
///
/// `-` must come **after** every `-i <path>`: `-i/--image` is variadic, so a
/// `-` placed before it would be eaten as an image filename. (`--` cannot be
/// used here — the stdin form needs `-` as a real positional.)
pub(crate) fn codex_command(
    model: Option<&str>,
    thread_id: Option<&str>,
    plan_mode: bool,
    effort: Option<&str>,
    image_paths: &[String],
) -> String {
    let q = ssh::shell_quote;
    let model = model.unwrap_or("gpt-5.4-mini");
    let flags = agent::codex_exec_flags(model, plan_mode, effort, image_paths);
    // `codex exec resume <id> …` — the subcommand+id sit right after `exec`.
    let mut parts: Vec<String> = vec!["codex".to_string()];
    for (i, flag) in flags.iter().enumerate() {
        parts.push(q(flag));
        if i == 0 {
            if let Some(id) = thread_id {
                parts.push("resume".to_string());
                parts.push(q(id));
            }
        }
    }
    parts.push("-".to_string());
    parts.join(" ")
}

/// Find a detached job on the remote by **run id** rather than by pid, and
/// return its `(pid, pgid)`.
///
/// Used when perch has a run row with no process identity — it died between
/// writing the row and hearing back from the launch. The run id is part of the
/// run directory path, which appears in the job's argv (the shell command
/// redirects into `<run_dir>/run.jsonl`), so `ps` can find it.
///
/// The first character of the run id is wrapped in a character class
/// (`[9]5a0b…`) — the classic `ps | grep` self-match trick. Without it the
/// probe's own shell, whose argv contains the run id verbatim, matches itself
/// and every orphan looks alive.
async fn find_run_process(ssh_host: &str, run_id: &str) -> Option<(i64, i64)> {
    let mut chars = run_id.chars();
    let first = chars.next()?;
    let pattern = format!("[{first}]{}", chars.as_str());
    let cmd = format!(
        "ps -eo pid,pgid,args 2>/dev/null | grep -E {} | grep -v ' tail -c ' | head -1",
        ssh::shell_quote(&pattern)
    );
    let out = ssh::run_remote(ssh_host, &cmd, 20, "find run").await.ok()?;
    let line = out.lines().next_back()?.trim();
    let mut parts = line.split_whitespace();
    let pid = parts.next()?.parse::<i64>().ok()?;
    let pgid = parts.next()?.parse::<i64>().ok()?;
    Some((pid, pgid))
}

/// `kill -TERM -<pgid>` then, after a grace period, `kill -KILL -<pgid>`.
/// The leading `-` is what makes these *process-group* signals, so a `claude`
/// that shelled out doesn't leave orphans behind.
async fn kill_pgid(ssh_host: &str, pgid: i64) -> Result<(), String> {
    let cmd =
        format!("kill -TERM -{pgid} 2>/dev/null; sleep 2; kill -KILL -{pgid} 2>/dev/null; true");
    ssh::run_remote(ssh_host, &cmd, 30, "cancel")
        .await
        .map(|_| ())
}

/// Claude Code's own durable transcript, used only when perch's run log gave
/// us nothing. Located by name rather than by reproducing the CLI's cwd
/// slugification, which is an implementation detail we shouldn't depend on.
async fn scrape_claude_transcript(ssh_host: &str, claude_session_id: &str) -> Option<String> {
    let cmd = format!(
        "f=$(find $HOME/.claude/projects -maxdepth 2 -name {} 2>/dev/null | head -1); \
         [ -n \"$f\" ] && tail -c 400000 \"$f\"",
        ssh::shell_quote(&format!("{claude_session_id}.jsonl"))
    );
    let out = ssh::run_remote(ssh_host, &cmd, 30, "transcript")
        .await
        .ok()?;
    let lines: Vec<&str> = out.lines().collect();
    // Only the text produced after the last user message — earlier assistant
    // turns are already persisted in perch's own DB.
    let start = lines
        .iter()
        .rposition(|l| l.contains(r#""type":"user""#))
        .map(|i| i + 1)
        .unwrap_or(0);
    let mut text = String::new();
    for line in &lines[start..] {
        let Ok(v) = serde_json::from_str::<Value>(line.trim()) else {
            continue;
        };
        if v.get("type").and_then(Value::as_str) != Some("assistant") {
            continue;
        }
        let Some(blocks) = v.pointer("/message/content").and_then(Value::as_array) else {
            continue;
        };
        for block in blocks {
            if block.get("type").and_then(Value::as_str) == Some("text") {
                if let Some(t) = block.get("text").and_then(Value::as_str) {
                    text.push_str(t);
                }
            }
        }
    }
    if text.trim().is_empty() {
        None
    } else {
        Some(text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------------
    // Remote command construction
    // -----------------------------------------------------------------------

    #[test]
    fn detached_claude_command_defaults_are_unchanged() {
        assert_eq!(
            claude_command(Some("claude-haiku-4-5"), "sid-1", false, false, None),
            "claude -p '--output-format' 'stream-json' '--verbose' '--include-partial-messages' \
             '--permission-mode' 'bypassPermissions' '--model' 'claude-haiku-4-5' --session-id 'sid-1'"
        );
    }

    #[test]
    fn detached_claude_command_carries_plan_mode_and_effort() {
        let cmd = claude_command(None, "sid-2", true, true, Some("xhigh"));
        assert!(cmd.starts_with("claude -p "), "{cmd}");
        assert!(cmd.contains("'--permission-mode' 'plan'"), "{cmd}");
        assert!(!cmd.contains("bypassPermissions"), "{cmd}");
        assert!(cmd.contains("'--effort' 'xhigh'"), "{cmd}");
        assert!(cmd.contains("--resume 'sid-2'"), "{cmd}");
    }

    #[test]
    fn detached_claude_command_prefixes_the_thinking_env_for_effort_none() {
        let cmd = claude_command(None, "sid-3", false, false, Some("none"));
        assert!(cmd.starts_with("MAX_THINKING_TOKENS=0 claude -p "), "{cmd}");
        assert!(cmd.contains("'--effort' 'none'"), "{cmd}");
    }

    #[test]
    fn detached_codex_command_defaults_are_unchanged() {
        assert_eq!(
            codex_command(Some("gpt-5.4-mini"), None, false, None, &[]),
            "codex 'exec' '--json' '--skip-git-repo-check' '-m' 'gpt-5.4-mini' -"
        );
        assert_eq!(
            codex_command(Some("gpt-5.4-mini"), Some("th-1"), false, None, &[]),
            "codex 'exec' resume 'th-1' '--json' '--skip-git-repo-check' '-m' 'gpt-5.4-mini' -"
        );
    }

    #[test]
    fn detached_codex_command_puts_the_stdin_dash_after_every_image() {
        let images = vec!["/run/a.png".to_string()];
        let cmd = codex_command(Some("gpt-5.4-mini"), None, true, Some("low"), &images);
        assert_eq!(
            cmd,
            "codex 'exec' '--json' '--skip-git-repo-check' '-m' 'gpt-5.4-mini' \
             '-c' 'model_reasoning_effort=\"low\"' '--sandbox' 'read-only' '-i' '/run/a.png' -"
        );
        assert!(cmd.ends_with("'/run/a.png' -"), "{cmd}");
    }

    #[test]
    fn attachment_names_cannot_escape_the_run_directory() {
        assert_eq!(
            sanitize_attachment_name("/tmp/x/../../etc/passwd"),
            "passwd"
        );
        assert_eq!(sanitize_attachment_name("my shot.png"), "my_shot.png");
        assert_eq!(sanitize_attachment_name("..."), "attachment");
    }

    // -----------------------------------------------------------------------
    // Recording sink + fixtures for the replay tests
    // -----------------------------------------------------------------------

    #[derive(Default)]
    struct Recorded {
        emitted: Vec<String>,
        persisted: Vec<(String, String, String)>, // (text, thinking, agent)
        running: Vec<bool>,
    }

    #[derive(Default)]
    struct RecordingSink(Mutex<Recorded>);

    impl TurnSink for RecordingSink {
        fn emit(&self, _session_id: &str, msg: ServerMessage) {
            let label = match &msg {
                ServerMessage::ChatChunk { text, .. } => format!("chunk:{text}"),
                ServerMessage::ChatThinking { .. } => "thinking".to_string(),
                ServerMessage::ChatToolUse { name, .. } => format!("tool_use:{name}"),
                ServerMessage::ChatDone { .. } => "done".to_string(),
                ServerMessage::Error { message } => format!("error:{message}"),
                _ => "other".to_string(),
            };
            self.0.lock().unwrap().emitted.push(label);
        }
        fn set_running(&self, _session_id: &str, running: bool) {
            self.0.lock().unwrap().running.push(running);
        }
        fn persist_turn(&self, _session_id: &str, turn: FinishedTurn) {
            self.0.lock().unwrap().persisted.push((
                turn.text,
                turn.thinking,
                agent_str(turn.agent).to_string(),
            ));
        }
    }

    /// A manager backed by a throwaway on-disk SQLite file plus a recording
    /// sink, so tests exercise the real `db` writes too.
    fn test_manager() -> (Arc<DetachedManager>, Arc<RecordingSink>, std::path::PathBuf) {
        let path =
            std::env::temp_dir().join(format!("perch-detached-test-{}.sqlite", Uuid::new_v4()));
        let db = Arc::new(HistoryDb::open(&path).expect("open test db"));
        let mgr = DetachedManager::new(db);
        let sink = Arc::new(RecordingSink::default());
        mgr.attach_sink(sink.clone());
        (mgr, sink, path)
    }

    fn test_run(agent: &str) -> DetachedRunRow {
        DetachedRunRow {
            run_id: Uuid::new_v4().to_string(),
            session_id: "sess-replay".to_string(),
            host_id: "pod".to_string(),
            ssh_host: "pod.invalid".to_string(),
            agent: agent.to_string(),
            model: Some("claude-haiku-4-5".to_string()),
            cwd: "/tmp".to_string(),
            run_dir: "/home/user/.perch-direct/sess-replay/run".to_string(),
            log_path: "/home/user/.perch-direct/sess-replay/run/run.jsonl".to_string(),
            pid: Some(1234),
            pgid: Some(1234),
            proc_start: Some("999".to_string()),
            cursor_offset: 0,
            cursor_inode: 0,
            provider_session_id: None,
            status: "running".to_string(),
            created_at: 0,
        }
    }

    /// The exact line shape a real `claude -p --output-format stream-json`
    /// run writes to `run.jsonl`, captured from a devpod (hook/system noise,
    /// a thinking block, text deltas split across lines, the `result` line,
    /// and the launcher's synthetic exit marker).
    fn claude_run_log() -> Vec<String> {
        vec![
            r#"{"type":"perch.meta","runId":"r1","sessionId":"sess-replay"}"#.to_string(),
            r#"{"type":"system","subtype":"hook_started"}"#.to_string(),
            r#"{"type":"system","subtype":"init","session_id":"claude-sid-1"}"#.to_string(),
            r#"{"type":"stream_event","event":{"type":"message_start"}}"#.to_string(),
            r#"{"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"thinking"}}}"#.to_string(),
            r#"{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"hmm"}}}"#.to_string(),
            r#"{"type":"stream_event","event":{"type":"content_block_stop","index":0}}"#.to_string(),
            r#"{"type":"stream_event","event":{"type":"content_block_start","index":1,"content_block":{"type":"text"}}}"#.to_string(),
            r#"{"type":"stream_event","event":{"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"orch-direct-"}}}"#.to_string(),
            r#"{"type":"stream_event","event":{"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"ok"}}}"#.to_string(),
            r#"{"type":"stream_event","event":{"type":"content_block_stop","index":1}}"#.to_string(),
            r#"{"type":"result","subtype":"success","session_id":"claude-sid-1","result":"orch-direct-ok","usage":{"input_tokens":10,"output_tokens":5}}"#.to_string(),
            r#"{"type":"perch.exit","code":0}"#.to_string(),
        ]
    }

    /// Replay a whole log through the same `ingest_line` a live tail uses,
    /// then finalize — i.e. exactly what recovery does.
    async fn replay(
        mgr: &Arc<DetachedManager>,
        run: &DetachedRunRow,
        agent: AgentKind,
        lines: &[String],
    ) {
        let mut parser = Parser::new(agent);
        let mut acc = Accumulator::default();
        for line in lines {
            if mgr.ingest_line(run, &mut parser, &mut acc, line) {
                break;
            }
        }
        mgr.clone()
            .finalize(run.clone(), parser, acc, agent, true)
            .await;
    }

    /// Regression test for the bug that made a recovered turn vanish: a turn
    /// that completed while perch was dead must persist its assistant content
    /// to SQLite, not merely be marked `done`.
    #[tokio::test]
    async fn recovery_replay_persists_the_assistant_turn() {
        let (mgr, sink, path) = test_manager();
        let run = test_run("claude");
        mgr.db.create_session(&run.session_id, &run.cwd).unwrap();
        mgr.db.insert_detached_run(&run).unwrap();

        replay(&mgr, &run, AgentKind::Claude, &claude_run_log()).await;

        let rec = sink.0.lock().unwrap();
        // Content reached the sink as normal streaming traffic…
        assert!(
            rec.emitted.contains(&"chunk:orch-direct-".to_string()),
            "{:?}",
            rec.emitted
        );
        assert!(
            rec.emitted.contains(&"chunk:ok".to_string()),
            "{:?}",
            rec.emitted
        );
        assert!(
            rec.emitted.contains(&"thinking".to_string()),
            "{:?}",
            rec.emitted
        );
        assert!(
            rec.emitted.contains(&"done".to_string()),
            "{:?}",
            rec.emitted
        );
        // …and, the part that regressed, as a persisted assistant turn with
        // full agent attribution.
        assert_eq!(rec.persisted.len(), 1, "{:?}", rec.persisted);
        assert_eq!(rec.persisted[0].0, "orch-direct-ok");
        assert_eq!(rec.persisted[0].1, "hmm");
        assert_eq!(rec.persisted[0].2, "claude");
        // The session must not be left looking like it's still running.
        assert_eq!(rec.running.last(), Some(&false), "{:?}", rec.running);
        drop(rec);

        // The provider session id is scraped out of the log so the recovered
        // conversation isn't orphaned, and the run is closed out as done.
        let row = mgr.db.get_session(&run.session_id).unwrap().unwrap();
        assert_eq!(row.claude_session_id.as_deref(), Some("claude-sid-1"));
        assert!(mgr.db.unfinished_detached_runs().unwrap().is_empty());
        let _ = std::fs::remove_file(path);
    }

    /// The same guarantee for codex, whose terminal event and continuity id
    /// live in different fields.
    #[tokio::test]
    async fn recovery_replay_persists_a_codex_turn() {
        let (mgr, sink, path) = test_manager();
        let mut run = test_run("codex");
        run.model = Some("gpt-5.4-mini".to_string());
        mgr.db.create_session(&run.session_id, &run.cwd).unwrap();
        mgr.db.insert_detached_run(&run).unwrap();

        let lines = vec![
            r#"{"type":"perch.meta","runId":"r1"}"#.to_string(),
            r#"{"type":"thread.started","thread_id":"th-9"}"#.to_string(),
            r#"{"type":"item.completed","item":{"type":"agent_message","text":"CODEX_OK"}}"#
                .to_string(),
            r#"{"type":"turn.completed","usage":{"input_tokens":5,"output_tokens":1}}"#.to_string(),
            r#"{"type":"perch.exit","code":0}"#.to_string(),
        ];
        replay(&mgr, &run, AgentKind::Codex, &lines).await;

        let rec = sink.0.lock().unwrap();
        assert_eq!(rec.persisted.len(), 1, "{:?}", rec.persisted);
        assert_eq!(rec.persisted[0].0, "CODEX_OK");
        assert_eq!(rec.persisted[0].2, "codex");
        assert_eq!(rec.running.last(), Some(&false));
        drop(rec);
        let row = mgr.db.get_session(&run.session_id).unwrap().unwrap();
        assert_eq!(row.codex_thread_id.as_deref(), Some("th-9"));
        let _ = std::fs::remove_file(path);
    }

    /// A turn killed mid-stream (no terminal marker) still persists whatever
    /// text arrived, reports an error, and clears the running flag — it must
    /// never leave the session spinning forever.
    #[tokio::test]
    async fn a_crashed_run_persists_partial_text_and_stops_running() {
        let (mgr, sink, path) = test_manager();
        let run = test_run("claude");
        mgr.db.create_session(&run.session_id, &run.cwd).unwrap();
        mgr.db.insert_detached_run(&run).unwrap();

        let mut lines = claude_run_log();
        lines.truncate(10); // cut before content_block_stop / result
        lines.push(r#"{"type":"perch.exit","code":137}"#.to_string());
        replay(&mgr, &run, AgentKind::Claude, &lines).await;

        let rec = sink.0.lock().unwrap();
        assert_eq!(rec.persisted.len(), 1, "{:?}", rec.persisted);
        assert_eq!(rec.persisted[0].0, "orch-direct-ok");
        assert!(
            rec.emitted
                .iter()
                .any(|e| e.starts_with("error:") && e.contains("137")),
            "{:?}",
            rec.emitted
        );
        assert_eq!(rec.running.last(), Some(&false));
        drop(rec);
        let _ = std::fs::remove_file(path);
    }

    /// The durability barrier: a run row is written before the remote launch,
    /// so it is recoverable with no pid yet, and the pid is attached after.
    #[test]
    fn a_run_row_is_recoverable_before_its_pid_is_known() {
        let path =
            std::env::temp_dir().join(format!("perch-detached-test-{}.sqlite", Uuid::new_v4()));
        let db = HistoryDb::open(&path).expect("open test db");
        let mut run = test_run("claude");
        run.pid = None;
        run.pgid = None;
        run.proc_start = None;
        db.insert_detached_run(&run).unwrap();

        // Visible to recovery even though nothing has been spawned yet — this
        // is what makes a perch killed mid-launch recoverable instead of
        // leaving an orphan nothing knows about.
        let pending = db.unfinished_detached_runs().unwrap();
        assert_eq!(pending.len(), 1);
        assert!(pending[0].pid.is_none());

        db.attach_detached_pid(&run.run_id, 4242, 4242, Some("777"))
            .unwrap();
        let after = db.unfinished_detached_runs().unwrap();
        assert_eq!(after[0].pid, Some(4242));
        assert_eq!(after[0].pgid, Some(4242));
        assert_eq!(after[0].proc_start.as_deref(), Some("777"));
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn claude_command_uses_resume_after_the_first_turn() {
        let first = claude_command(Some("claude-haiku-4-5"), "abc", false, false, None);
        assert!(first.contains("--session-id 'abc'"));
        assert!(!first.contains("--resume"));
        assert!(first.contains("'--model' 'claude-haiku-4-5'"));
        // bypassPermissions is mandatory: `-p` has no approval channel.
        assert!(first.contains("'--permission-mode' 'bypassPermissions'"));
        let later = claude_command(Some("claude-haiku-4-5"), "abc", true, false, None);
        assert!(later.contains("--resume 'abc'"));
        assert!(!later.contains("--session-id"));
    }

    #[test]
    fn codex_command_resumes_a_known_thread() {
        assert_eq!(
            codex_command(Some("gpt-5.4-mini"), None, false, None, &[]),
            "codex 'exec' '--json' '--skip-git-repo-check' '-m' 'gpt-5.4-mini' -"
        );
        let resumed = codex_command(Some("gpt-5.4-mini"), Some("t-1"), false, None, &[]);
        assert!(resumed.starts_with("codex 'exec' resume 't-1' '--json'"));
        assert!(resumed.ends_with(" -"));
    }

    #[test]
    fn perch_exit_marker_is_recognised() {
        assert_eq!(
            perch_exit_code(r#"{"type":"perch.exit","code":0}"#),
            Some(0)
        );
        assert_eq!(
            perch_exit_code(r#"{"type":"perch.exit","code":137}"#),
            Some(137)
        );
        assert_eq!(
            perch_exit_code(r#"{"type":"result","subtype":"success"}"#),
            None
        );
        assert_eq!(perch_exit_code("not json"), None);
    }

    #[test]
    fn cli_attach_goes_through_tmux_attach_or_create() {
        let argv = cli_attach_argv(
            "pod",
            "sess-1",
            "/tmp/w",
            AgentKind::Claude,
            Some("cs-1"),
            Some("claude-haiku-4-5"),
        );
        assert_eq!(argv[0], "ssh");
        assert!(argv.contains(&"-tt".to_string()));
        let remote = argv.last().unwrap();
        assert!(remote.starts_with("tmux new-session -A -s 'perch-cli-sess-1'"));
        // The tmux command argument is itself single-quoted, so every quote
        // inside it is escaped POSIX-style (`'` → `'\''`). Assert on the
        // unescaped form to keep the test readable.
        let unescaped = remote.replace(r"'\''", "'");
        assert!(unescaped.contains("--resume 'cs-1'"), "{unescaped}");
        assert!(
            unescaped.contains("--model 'claude-haiku-4-5'"),
            "{unescaped}"
        );
        assert!(unescaped.contains("cd '/tmp/w'"), "{unescaped}");
        assert!(unescaped.contains("exec claude"), "{unescaped}");
    }

    #[test]
    fn claude_stream_json_parses_the_same_as_a_local_turn() {
        // The whole point of factoring the parsers out of agent.rs: a
        // detached turn's NDJSON is byte-for-byte a local turn's NDJSON.
        let mut parser = Parser::new(AgentKind::Claude);
        let (tx, mut rx) = unbounded_channel::<AgentEvent>();
        parser.handle_line(r#"{"type":"perch.meta","runId":"r1"}"#, &tx);
        parser.handle_line(
            r#"{"type":"system","subtype":"init","session_id":"sid-9"}"#,
            &tx,
        );
        parser.handle_line(
            r#"{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hi"}}}"#,
            &tx,
        );
        assert!(!parser.saw_terminal());
        parser.handle_line(
            r#"{"type":"result","subtype":"success","session_id":"sid-9","usage":{"input_tokens":3,"output_tokens":4}}"#,
            &tx,
        );
        assert!(parser.saw_terminal());
        assert_eq!(parser.provider_id().as_deref(), Some("sid-9"));
        let mut chunks = Vec::new();
        let mut done = false;
        while let Ok(e) = rx.try_recv() {
            match e {
                AgentEvent::Chunk(t) => chunks.push(t),
                AgentEvent::Done(_) => done = true,
                _ => {}
            }
        }
        assert_eq!(chunks, vec!["hi".to_string()]);
        assert!(done);
    }

    #[test]
    fn codex_stream_json_parses_and_scrapes_the_thread_id() {
        let mut parser = Parser::new(AgentKind::Codex);
        let (tx, mut rx) = unbounded_channel::<AgentEvent>();
        parser.handle_line(r#"{"type":"thread.started","thread_id":"th-7"}"#, &tx);
        parser.handle_line(
            r#"{"type":"item.completed","item":{"type":"agent_message","text":"CODEX_OK"}}"#,
            &tx,
        );
        assert!(!parser.saw_terminal());
        parser.handle_line(
            r#"{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":2}}"#,
            &tx,
        );
        assert!(parser.saw_terminal());
        assert_eq!(parser.provider_id().as_deref(), Some("th-7"));
        let mut text = String::new();
        let mut usage_seen = false;
        while let Ok(e) = rx.try_recv() {
            match e {
                AgentEvent::Chunk(t) => text.push_str(&t),
                AgentEvent::Done(u) => usage_seen = u.is_some(),
                _ => {}
            }
        }
        assert_eq!(text, "CODEX_OK");
        assert!(usage_seen);
    }
}

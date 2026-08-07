//! Local tmux-backed persistence for CLI-mode (`agentAttach`) terminals.
//!
//! Phase 6 already solved this for *remote* direct-mode hosts:
//! `detached::cli_attach_argv` runs `ssh -tt <host> tmux new-session -A -s
//! perch-cli-<sessionId> '<cli>'`, so the real `claude`/`codex` process lives
//! in tmux on the remote box and a dropped ssh connection (or a quit perch)
//! only loses the *client*, never the agent. Local CLI mode never got the
//! same treatment: `AgentTerminalRegistry::attach` (Phase 13) spawned the CLI
//! itself directly as the pty's child, so killing perch — or even just losing
//! every viewer for long enough — killed the interactive `claude --resume` /
//! `codex resume` process along with it. This module closes that gap using
//! the identical trick, applied locally instead of over ssh:
//!
//! - The pty's child is no longer the CLI. It's `tmux attach-session -t
//!   <name>` — a thin client.
//! - The CLI itself is launched via `tmux new-session -d -s <name> -- <cli
//!   argv>`, run as its own headless step *before* the pty is opened, so the
//!   session exists (or already existed) by the time the attach client starts.
//! - `AgentTerminalRegistry`'s existing session-id-keyed singleton and
//!   viewer fan-out are untouched; this module only changes what command the
//!   registry hands to `spawn_pty` for the *local* branch, and what "kill"
//!   means for a tmux-backed entry (see `kill_tmux_session`'s doc comment).
//!
//! **Why not `tmux new-session -A -d` (the one-shot attach-or-create idiom
//! the brief and `detached::cli_attach_argv` both use)?** Verified
//! experimentally (see the module's dev notes / phase report): run without a
//! controlling tty of its own — which is exactly how this function is
//! invoked, as a plain `Command::output()` bookkeeping call, not a pty child —
//! `tmux new-session -A -d` on a session that *already exists* falls through
//! to `attach-session -d`, which requires opening a terminal and fails with
//! `open terminal failed: not a terminal`. Remote mode dodges this because
//! `ssh -tt` already allocates a real pty for the *whole* ssh invocation, so
//! there is a controlling tty by the time tmux's `-A` reattach branch runs.
//! Locally there is no such tty at this step (the pty is opened *after*, for
//! the attach client only) so this module does the existence check itself
//! (`tmux has-session`) and only ever calls plain `new-session -d` (never
//! `-A`) to create. Two attaches racing to create the same session both lose
//! to `AgentTerminalRegistry::attach`'s own `entries` mutex (held across the
//! whole create-or-reuse decision, see that function), which is already the
//! single-tailer guard within one perch process; the self-heal branch below
//! (re-check existence if `new-session` itself fails) covers any race outside
//! that guard defensively, without ever needing `-A`.
//!
//! **Kill vs detach**, the whole reason this module exists:
//! - A **viewer disconnecting** (dropped ws connection, tab closed) must
//!   *never* kill the agent. `AgentTerminalRegistry::detach`'s existing
//!   last-viewer-kills-the-child logic composes for free here: the "child" it
//!   kills is now the attach client, not the CLI, and killing an attach
//!   client only detaches it (identical to a user typing the tmux detach
//!   key) — the tmux session, and the CLI running inside it, keep running.
//! - An **explicit user kill** (Restart CLI, session delete) must kill the
//!   real agent, or "restart" leaves an orphan running forever that the next
//!   attach silently reattaches to. `AgentTerminalRegistry::kill` is changed
//!   to also call `kill_tmux_session` before killing the attach client.
//!
//! **tmux missing**: detected once per process (`tmux_available`, cached in
//! a `OnceLock`) and threaded through as a plain `bool` rather than read
//! ambiently everywhere, so the fallback path (`resolve_agent_spawn(false,
//! ..)`) is pure and unit-testable without a real tmux binary at all — it
//! just returns the original argv unchanged, which is exactly
//! pre-this-module behaviour.
//!
//! **Leaked sessions**: if perch's db/session for a tmux-backed CLI session
//! is deleted while perch is *not running*, nothing reaps the orphaned tmux
//! session (`SessionDelete`'s `agent_terminals.kill` only runs while perch is
//! up). Deliberately not adding a periodic local sweep for this phase: unlike
//! remote run directories (which accumulate silently on a shared devpod other
//! users might notice), an orphaned local tmux session is on the user's own
//! machine, `tmux ls` immediately reveals it, and it costs nothing while
//! idle. A boot-time sweep (`tmux ls` filtered to `perch-cli-*`, killing any
//! whose session id no longer has a live sessions-table row) would be a
//! reasonable half-day follow-up; flagged here rather than implemented
//! half-heartedly under this phase's time budget.

use std::process::Command;
use std::sync::OnceLock;

/// Derive a stable, legal tmux session name from a perch session id.
///
/// Session ids are always UUIDs (see `Uuid::new_v4()` call sites in
/// `server.rs`), which are already tmux-safe, and this uses the exact same
/// `perch-cli-<sessionId>` scheme `detached::cli_attach_argv` uses for the
/// remote case, so the two are visually consistent (a `tmux ls` on either
/// side of a federation link shows the same naming). Sanitized defensively
/// anyway, since nothing enforces the UUID assumption at the type level.
pub fn tmux_session_name(session_id: &str) -> String {
    let sanitized: String = session_id
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    format!("perch-cli-{sanitized}")
}

static TMUX_AVAILABLE: OnceLock<bool> = OnceLock::new();

/// Whether the `tmux` binary is on `PATH`, probed once per process and
/// cached — cheap enough to call on every `agentAttach` without a fresh
/// subprocess spawn each time.
pub fn tmux_available() -> bool {
    *TMUX_AVAILABLE.get_or_init(|| {
        Command::new("tmux")
            .arg("-V")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    })
}

/// Whether `name` currently exists on the local tmux server.
pub fn tmux_session_exists(name: &str) -> bool {
    Command::new("tmux")
        .args(["has-session", "-t", name])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Create-or-confirm outcome of [`ensure_tmux_session`]. Purely informational
/// (logged, not sent over the wire) — see the module doc comment on why this
/// phase makes zero protocol change.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionAction {
    /// A session with this name was already running; nothing was spawned.
    /// This is the restart-recovery path.
    Reused,
    /// No session existed; `argv` was just launched inside a fresh one.
    Created,
}

/// Pure decision step, factored out so the create-or-attach branch is
/// directly testable without a real tmux: given whether `name` already
/// exists, what should happen?
fn decide_session_action(exists: bool) -> SessionAction {
    if exists {
        SessionAction::Reused
    } else {
        SessionAction::Created
    }
}

/// Make sure `name`'s tmux session is running `argv` (spawning it under
/// `cwd`, sized `cols`x`rows`, with the status bar off) if it wasn't already.
/// Idempotent and safe to call on every local `agentAttach`, including after
/// a perch restart — that's the entire recovery story: if the session
/// already exists, this is a no-op read plus a cheap `has-session` check.
pub fn ensure_tmux_session(
    name: &str,
    cols: u16,
    rows: u16,
    cwd: Option<&str>,
    argv: &[String],
) -> anyhow::Result<SessionAction> {
    if tmux_session_exists(name) {
        return Ok(SessionAction::Reused);
    }

    let mut cmd = Command::new("tmux");
    cmd.args([
        "new-session",
        "-d",
        "-s",
        name,
        "-x",
        &cols.to_string(),
        "-y",
        &rows.to_string(),
    ]);
    if let Some(cwd) = cwd {
        cmd.args(["-c", cwd]);
    }
    cmd.arg("--");
    cmd.args(argv);
    let output = cmd.output()?;
    if !output.status.success() {
        // Someone else created it in the gap between the check above and
        // this call — self-heal by re-checking rather than treating this as
        // fatal (see the module doc comment for why this checks-then-creates
        // rather than using tmux's own `-A` reattach idiom).
        if tmux_session_exists(name) {
            return Ok(SessionAction::Reused);
        }
        anyhow::bail!(
            "tmux new-session failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        );
    }

    // Disable the status bar unconditionally: it steals a row from the grid
    // perch already told the CLI about via `-x`/`-y` (and every later
    // `terminal.resize`), and a TUI painting into a one-row-short pty is
    // exactly the class of bug Phase 12.1/12.2 spent two phases fixing.
    let _ = Command::new("tmux")
        .args(["set-option", "-t", name, "status", "off"])
        .output();

    Ok(decide_session_action(false))
}

/// The argv for the local pty's child once `name`'s session is known to be
/// running: attach a real interactive client to it. Never spawns anything by
/// itself — call [`ensure_tmux_session`] first.
pub fn tmux_attach_argv(name: &str) -> Vec<String> {
    vec![
        "tmux".to_string(),
        "attach-session".to_string(),
        "-t".to_string(),
        name.to_string(),
    ]
}

/// Kill `name`'s tmux session outright, terminating whatever CLI is running
/// inside it. Used only for explicit user kill (Restart CLI, session
/// delete) — see the module doc comment's kill-vs-detach audit. A plain
/// viewer disconnect must never call this.
pub fn kill_tmux_session(name: &str) {
    let _ = Command::new("tmux")
        .args(["kill-session", "-t", name])
        .output();
}

/// Decide what the local pty's child command should be for a CLI-attach, and
/// perform the tmux create-or-reattach side effect when `use_tmux` is true.
///
/// `use_tmux` is a plain argument (not read ambiently from
/// [`tmux_available`] inside this function) specifically so the mandatory
/// tmux-missing fallback is a pure, unit-testable branch: `resolve_agent_spawn
/// (false, ..)` needs no tmux binary anywhere and just returns `argv`
/// unchanged with no tmux session name — exactly `AgentTerminalRegistry`'s
/// pre-this-module behaviour, so a machine without tmux sees zero change.
///
/// Returns the final argv to hand to `spawn_pty`, and — when tmux-backed —
/// the session name, so the caller can remember it for `kill_tmux_session`
/// later (see `AgentTerminalEntry::tmux_session` in `terminal.rs`).
pub fn resolve_agent_spawn(
    use_tmux: bool,
    session_id: &str,
    cols: u16,
    rows: u16,
    cwd: Option<&str>,
    argv: Vec<String>,
) -> anyhow::Result<(Vec<String>, Option<String>)> {
    if !use_tmux {
        return Ok((argv, None));
    }
    let name = tmux_session_name(session_id);
    let action = ensure_tmux_session(&name, cols, rows, cwd, &argv)?;
    tracing::info!(
        session_id,
        tmux_session = %name,
        recovered = matches!(action, SessionAction::Reused),
        "local CLI-mode terminal is tmux-backed"
    );
    Ok((tmux_attach_argv(&name), Some(name)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_names_are_stable_and_prefixed() {
        assert_eq!(
            tmux_session_name("abc-123"),
            "perch-cli-abc-123",
            "a UUID-shaped id should pass through unchanged apart from the prefix"
        );
    }

    #[test]
    fn session_names_sanitize_illegal_characters() {
        // tmux target specs give `.` and `:` special meaning (window/pane
        // separators); anything not alphanumeric/dash/underscore must be
        // scrubbed so a stray character can never turn into an unintended
        // target reference.
        let name = tmux_session_name("weird session:name.with spaces");
        assert_eq!(name, "perch-cli-weird_session_name_with_spaces");
        assert!(!name.contains(':'));
        assert!(!name.contains('.'));
        assert!(!name.contains(' '));
    }

    #[test]
    fn same_session_id_always_derives_the_same_name() {
        let a = tmux_session_name("11111111-1111-1111-1111-111111111111");
        let b = tmux_session_name("11111111-1111-1111-1111-111111111111");
        assert_eq!(
            a, b,
            "naming must be pure and deterministic for recovery to work"
        );
    }

    /// The create-or-attach decision, isolated from any real tmux process:
    /// given "does a session by this name already exist", what should
    /// happen? This is the crux of restart recovery — an existing session
    /// must always be reused, never recreated.
    #[test]
    fn create_or_attach_decision_given_existence() {
        assert_eq!(decide_session_action(false), SessionAction::Created);
        assert_eq!(decide_session_action(true), SessionAction::Reused);
    }

    /// The mandatory tmux-missing fallback: with `use_tmux: false` this must
    /// behave exactly like a machine that has never heard of tmux — argv
    /// passes through untouched, no tmux session name is produced, and
    /// nothing here ever shells out. Runs on every machine, tmux installed
    /// or not.
    #[test]
    fn fallback_path_is_a_pure_passthrough_when_tmux_is_unavailable() {
        let argv = vec![
            "claude".to_string(),
            "--resume".to_string(),
            "abc".to_string(),
        ];
        let (resolved, tmux_session) =
            resolve_agent_spawn(false, "session-x", 80, 24, None, argv.clone()).unwrap();
        assert_eq!(resolved, argv, "fallback must not alter the command at all");
        assert_eq!(tmux_session, None, "fallback must not claim a tmux session");
    }

    /// Two derived names for different sessions must never collide, or two
    /// unrelated CLI sessions could end up sharing one tmux session (input
    /// from one bleeding into the other's conversation).
    #[test]
    fn distinct_session_ids_never_collide() {
        let a = tmux_session_name("session-one");
        let b = tmux_session_name("session-two");
        assert_ne!(a, b);
    }

    // --- Integration tests against a real tmux, gated on availability -----
    //
    // These spawn real tmux sessions; every test cleans up its own session
    // even on assertion failure via a small drop guard, so a failed run
    // never leaves `perch-cli-test-*` sessions behind.

    struct KillOnDrop(String);
    impl Drop for KillOnDrop {
        fn drop(&mut self) {
            kill_tmux_session(&self.0);
        }
    }

    #[test]
    fn ensure_tmux_session_creates_then_reuses_on_next_call() {
        if !tmux_available() {
            eprintln!("skipping: tmux not installed");
            return;
        }
        let name = "perch-cli-test-create-reuse";
        kill_tmux_session(name); // in case a previous failed run left it
        let _guard = KillOnDrop(name.to_string());

        let argv = vec![
            "/bin/sh".to_string(),
            "-c".to_string(),
            "sleep 30".to_string(),
        ];
        let first = ensure_tmux_session(name, 80, 24, None, &argv).unwrap();
        assert_eq!(first, SessionAction::Created);
        assert!(tmux_session_exists(name));

        // The restart-recovery case: calling again against the same name
        // must find the live session and must NOT relaunch the command.
        let second = ensure_tmux_session(name, 80, 24, None, &argv).unwrap();
        assert_eq!(second, SessionAction::Reused);
    }

    /// A viewer detaching (killing only the attach client, never the tmux
    /// session directly) must leave the real process alive; only
    /// `kill_tmux_session` may take it down. This is the hermetic proxy for
    /// "dropping a viewer doesn't kill the agent" without going through the
    /// full `AgentTerminalRegistry`/pty plumbing.
    #[test]
    fn tmux_session_survives_until_explicitly_killed() {
        if !tmux_available() {
            eprintln!("skipping: tmux not installed");
            return;
        }
        let name = "perch-cli-test-survive";
        kill_tmux_session(name);
        let argv = vec![
            "/bin/sh".to_string(),
            "-c".to_string(),
            "sleep 30".to_string(),
        ];
        ensure_tmux_session(name, 80, 24, None, &argv).unwrap();
        assert!(tmux_session_exists(name));

        // Simulate every viewer disconnecting: nothing about that should
        // touch the tmux session itself in this module (that guarantee is
        // `AgentTerminalRegistry::detach` only ever killing the attach
        // client's own pty child, never calling `kill_tmux_session`).
        assert!(
            tmux_session_exists(name),
            "session must still be alive with no viewers attached"
        );

        kill_tmux_session(name);
        assert!(!tmux_session_exists(name), "explicit kill must remove it");
    }
}

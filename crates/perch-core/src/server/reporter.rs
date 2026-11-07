//! Keeps a child's running notes when one of its turns ends (`crate::reporter` has the rules).
//!
//! Called once per turn end of a child, before the lead's status note is queued, so the note and
//! the family strip read what is stored here. What is kept is always the notes of the turn that
//! just ended:
//! - the child's own `perch report` of the turn, when it made one: no model is asked;
//! - else a model's summary of the previous notes plus this turn (`Summary by <model>`);
//! - else the start of its last message, when no model was asked or it did not answer.
//!
//! Nothing here blocks the child or runs between turns. One model call per child at a time, none for
//! a stopped child, none once the run is over its message limit, none when the setting is off, and
//! none for a CLI the user does not have. A call that fails or answers in the wrong shape leaves the
//! last-message fallback, never nothing.
use super::*;
use crate::agent_fleet::AgentKey;
use crate::db::{ReporterRun, StoredSummary};
use crate::reporter::{self, Reply, Runner};
use crate::sub_sessions::{self, SubState};
use std::future::Future;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncWriteExt;

/// A summary call is given this long; slower is a failed call.
const TIMEOUT: Duration = Duration::from_secs(60);

/// Why no model was asked for a turn, for the log.
#[derive(Debug, PartialEq, Eq)]
enum Skip {
    Stopped,
    RunLimit,
    InFlight,
    NoRunner,
    NoFacts,
}

/// A running notes row from what the child said last, so a summary of an earlier turn is never
/// shown as the latest.
fn fallback(said: Option<&str>, as_of: i64) -> Option<StoredSummary> {
    Some(StoredSummary {
        text: sub_sessions::fallback_report(said?)?,
        status: String::new(),
        source: "last-message".into(),
        model: None,
        as_of,
    })
}

/// Whether `program` is an executable file on the PATH the core runs with.
pub(super) fn installed(program: &str) -> bool {
    std::env::var_os("PATH").is_some_and(|path| {
        std::env::split_paths(&path).any(|dir| {
            let file = dir.join(program);
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                file.metadata()
                    .is_ok_and(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0)
            }
            #[cfg(not(unix))]
            {
                file.is_file()
            }
        })
    })
}

/// The provider's CLI in its one-shot mode, the prompt on stdin, under [`TIMEOUT`].
async fn ask_cli(runner: Runner, model: &str, prompt: &str, cwd: &Path) -> Result<Reply, String> {
    let invocation = reporter::invocation(runner, model);
    let mut command = tokio::process::Command::new(invocation.program);
    command
        .args(&invocation.args)
        .current_dir(cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    let mut child = command
        .spawn()
        .map_err(|error| format!("could not start {}: {error}", invocation.program))?;
    let mut stdin = child.stdin.take().ok_or("no stdin")?;
    let prompt = prompt.to_string();
    let output = tokio::time::timeout(TIMEOUT, async {
        let write = tokio::spawn(async move {
            let _ = stdin.write_all(prompt.as_bytes()).await;
            let _ = stdin.shutdown().await;
        });
        let output = child.wait_with_output().await;
        let _ = write.await;
        output
    })
    .await
    .map_err(|_| format!("{} did not answer in time", invocation.program))?
    .map_err(|error| format!("{} failed: {error}", invocation.program))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !output.status.success() {
        let why: String = stderr
            .lines()
            .rev()
            .find(|line| !line.trim().is_empty())
            .unwrap_or("")
            .chars()
            .take(200)
            .collect();
        return Err(format!(
            "{} exited with {}: {why}",
            invocation.program, output.status
        ));
    }
    match runner {
        Runner::Claude => reporter::parse_claude(&stdout),
        Runner::Codex => reporter::parse_codex(&stdout, &stderr),
        Runner::Pi | Runner::Omp => reporter::parse_pi_json(&stdout),
    }
}

/// Removes the child from the in-flight set however the call ends.
struct InFlight<'a> {
    app: &'a AppState,
    session: String,
}

impl<'a> InFlight<'a> {
    fn take(app: &'a AppState, session: &str) -> Option<Self> {
        app.reporter_in_flight
            .lock()
            .unwrap()
            .insert(session.to_string())
            .then(|| Self {
                app,
                session: session.to_string(),
            })
    }
}

impl Drop for InFlight<'_> {
    fn drop(&mut self) {
        self.app
            .reporter_in_flight
            .lock()
            .unwrap()
            .remove(&self.session);
    }
}

/// Keep the notes of the turn of `child` that ended at `ended_ms`. `snapshot` is its transcript
/// then, `ask` the model call (the real one is [`ask_cli`]).
pub(super) async fn summarise_turn(
    app: &AppState,
    child: &AgentKey,
    snapshot: Option<&crate::protocol::NativeUiSnapshot>,
    ended_ms: i64,
) {
    summarise_with(
        app,
        child,
        snapshot,
        ended_ms,
        installed,
        |runner, model, prompt, cwd| async move { ask_cli(runner, &model, &prompt, &cwd).await },
    )
    .await
}

async fn summarise_with<F, Fut>(
    app: &AppState,
    child: &AgentKey,
    snapshot: Option<&crate::protocol::NativeUiSnapshot>,
    ended_ms: i64,
    is_installed: impl Fn(&str) -> bool,
    ask: F,
) where
    F: FnOnce(Runner, String, String, PathBuf) -> Fut,
    Fut: Future<Output = Result<Reply, String>>,
{
    let settings = app.settings.get();
    if !settings.reporter_enabled {
        return;
    }
    let session = &child.session_id;
    let said = snapshot.and_then(super::agent_mail::last_assistant_text);
    let store = |row: Option<StoredSummary>| {
        if let Some(row) = row {
            if let Err(error) = app.db.store_summary(session, &row) {
                tracing::warn!(%error, "could not keep a sub-session's notes");
            }
        }
    };
    let previous = app.db.session_summary(session).ok().flatten();
    // The child said something itself this turn: that is the note, and no model is asked.
    if let Ok(Some((text, at))) = app.db.latest_session_report(session) {
        if previous.as_ref().is_none_or(|row| at > row.as_of) {
            if let Some(text) = sub_sessions::fallback_report(&text) {
                store(Some(StoredSummary {
                    text,
                    status: String::new(),
                    source: "report".into(),
                    model: None,
                    as_of: ended_ms,
                }));
                return;
            }
        }
    }
    let plan = plan(app, child, snapshot, &settings, &is_installed);
    let (runner, model, facts) = match plan {
        Ok(plan) => plan,
        Err(skip) => {
            tracing::info!(child = %session, ?skip, "no summary asked for; keeping the last message");
            store(fallback(said.as_deref(), ended_ms));
            return;
        }
    };
    let Some(_flight) = InFlight::take(app, session) else {
        tracing::info!(child = %session, skip = ?Skip::InFlight, "no summary asked for; keeping the last message");
        store(fallback(said.as_deref(), ended_ms));
        return;
    };
    let prompt = reporter::prompt(previous.as_ref().map(|row| row.text.as_str()), &facts);
    let cwd = app
        .db
        .get_session(session)
        .ok()
        .flatten()
        .map(|row| PathBuf::from(row.cwd))
        .filter(|dir| dir.is_dir())
        .unwrap_or_else(std::env::temp_dir);
    let answer = ask(runner, model.clone(), prompt, cwd).await;
    let summary = match answer {
        Ok(reply) => {
            if let Err(error) = app.db.record_reporter_run(&ReporterRun {
                at: ended_ms,
                provider: runner.provider().into(),
                model: model.clone(),
                session_id: session.clone(),
                input: reply.usage.input,
                cache_read: reply.usage.cache_read,
                cache_write: reply.usage.cache_write,
                output: reply.usage.output,
                cost_usd: reply.usage.cost_usd,
            }) {
                tracing::warn!(%error, "could not record a reporter call");
            }
            reporter::parse_output(&reply.text)
        }
        Err(error) => Err(error),
    };
    match summary {
        Ok(summary) => store(Some(StoredSummary {
            text: summary.text,
            status: summary.status.as_str().into(),
            source: "summary".into(),
            model: Some(model),
            as_of: ended_ms,
        })),
        Err(error) => {
            tracing::warn!(child = %session, %error, "the reporter gave no summary; keeping the last message");
            store(fallback(said.as_deref(), ended_ms));
        }
    }
}

/// What to ask of whom, or why not.
fn plan(
    app: &AppState,
    child: &AgentKey,
    snapshot: Option<&crate::protocol::NativeUiSnapshot>,
    settings: &crate::settings::Settings,
    is_installed: &impl Fn(&str) -> bool,
) -> Result<(Runner, String, reporter::TurnFacts), Skip> {
    let session = &child.session_id;
    let record = app.db.sub_session(session).ok().flatten();
    if record.is_none_or(|row| {
        matches!(
            row.state,
            SubState::Stopping | SubState::StopUnknown | SubState::Stopped
        )
    }) {
        return Err(Skip::Stopped);
    }
    let sent = app.db.run_agent_messages(session).unwrap_or(usize::MAX);
    if sent >= crate::agent_mail::MAX_MESSAGES_PER_RUN {
        return Err(Skip::RunLimit);
    }
    let model_of = |runner: Runner| match runner {
        Runner::Claude => settings.reporter_claude_model.as_str(),
        Runner::Codex => settings.reporter_codex_model.as_str(),
        Runner::Pi => settings.reporter_pi_model.as_str(),
        Runner::Omp => settings.reporter_omp_model.as_str(),
    };
    let runner = reporter::runner_for(&child.agent_id, |runner| {
        !model_of(runner).is_empty() && is_installed(runner.provider())
    })
    .ok_or(Skip::NoRunner)?;
    let facts = snapshot
        .and_then(reporter::turn_facts)
        .ok_or(Skip::NoFacts)?;
    Ok((runner, model_of(runner).to_string(), facts))
}

#[cfg(test)]
mod tests {
    use super::super::sub_sessions::tests::{boot, lead_with_child};
    use super::*;
    use crate::protocol::{NativeUiMessage, NativeUiSnapshot};
    use std::sync::Arc;

    fn snapshot(answer: &str) -> NativeUiSnapshot {
        let message = |id: &str, role: &str, text: &str| NativeUiMessage {
            id: id.into(),
            role: role.into(),
            text: text.into(),
            ..Default::default()
        };
        NativeUiSnapshot {
            messages: vec![
                message("u", "user", "do the task"),
                message("a", "assistant", answer),
            ],
            ..Default::default()
        }
    }

    fn reply(text: &str) -> Result<Reply, String> {
        Ok(Reply {
            text: text.into(),
            usage: reporter::Usage {
                input: 10,
                output: 5,
                cost_usd: Some(0.001),
                ..Default::default()
            },
        })
    }

    struct Fixture {
        app: AppState,
        key: AgentKey,
        _root: PathBuf,
    }

    /// A running core with a lead and a running Codex child (`child`), whose provider the
    /// runner follows; Claude is the fallback runner a Codex child never gets.
    async fn fixture(child_state: SubState) -> Fixture {
        let root = std::env::temp_dir().join(format!("perch-reporter-core-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let (address, db) = boot(&root).await;
        let (workspace, _) = lead_with_child(&db, &nest, child_state);
        let app = super::super::booted_state(address);
        Fixture {
            app,
            key: AgentKey::new(&workspace.id, "child", "codex").unwrap(),
            _root: root,
        }
    }

    /// One turn end. Returns the prompts the model was shown (one per call).
    async fn run_turn(
        fixture: &Fixture,
        answer: &str,
        ended: i64,
        installed: bool,
        reply: Result<Reply, String>,
    ) -> Vec<String> {
        let shown = Arc::new(std::sync::Mutex::new(Vec::new()));
        let seen = shown.clone();
        summarise_with(
            &fixture.app,
            &fixture.key,
            Some(&snapshot(answer)),
            ended,
            move |_| installed,
            move |_, _, prompt, _| async move {
                seen.lock().unwrap().push(prompt);
                reply
            },
        )
        .await;
        let shown = shown.lock().unwrap().clone();
        shown
    }

    fn stored(fixture: &Fixture) -> Option<StoredSummary> {
        fixture.app.db.session_summary("child").unwrap()
    }

    #[test]
    fn a_missing_program_is_not_installed() {
        assert!(!installed("perch-no-such-program-4f9a"));
    }

    /// Which harness answers for a child, and with which of the settings' models.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_child_is_asked_of_its_own_harness_when_it_has_a_model_else_the_first_that_does() {
        let f = fixture(SubState::Running).await;
        let pi_child = AgentKey::new(&f.key.workspace_id, "child", "pi").unwrap();
        let snap = snapshot("Done.");
        let ask = |settings: &crate::settings::Settings, child: &AgentKey, have: &[&str]| {
            plan(&f.app, child, Some(&snap), settings, &|name: &str| {
                have.contains(&name)
            })
            .map(|(runner, model, _)| (runner, model))
        };
        let mut settings = crate::settings::Settings::default();
        // Pi has no default model: its child is summarised by Claude (haiku), else Codex.
        assert_eq!(
            ask(&settings, &pi_child, &["claude", "codex", "pi"]),
            Ok((Runner::Claude, "haiku".to_string()))
        );
        assert_eq!(
            ask(&settings, &pi_child, &["codex", "pi"]),
            Ok((Runner::Codex, "gpt-6-luna".to_string()))
        );
        assert_eq!(ask(&settings, &pi_child, &["pi"]), Err(Skip::NoRunner));
        // Once Pi has a model its own children use it, and only while it is installed.
        settings.reporter_pi_model = "openrouter/some-model".into();
        assert_eq!(
            ask(&settings, &pi_child, &["claude", "pi"]),
            Ok((Runner::Pi, "openrouter/some-model".to_string()))
        );
        assert_eq!(
            ask(&settings, &pi_child, &["claude"]),
            Ok((Runner::Claude, "haiku".to_string()))
        );
        // A Codex child is still asked of Codex, and Claude's model is the setting's.
        settings.reporter_claude_model = "claude-haiku-4-5".into();
        assert_eq!(
            ask(&settings, &f.key, &["claude", "codex", "pi"]),
            Ok((Runner::Codex, "gpt-6-luna".to_string()))
        );
        // Pi alone serves a Codex child whose own CLI is gone.
        assert_eq!(
            ask(&settings, &f.key, &["pi"]),
            Ok((Runner::Pi, "openrouter/some-model".to_string()))
        );
    }

    /// A finished turn is summarised, the next turn is shown that summary and only its own events,
    /// and every call is kept for the spend estimate.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn each_turn_is_summarised_from_the_previous_summary_and_its_own_events() {
        let f = fixture(SubState::Running).await;
        let model = f.app.settings.get().reporter_codex_model;
        let first = run_turn(
            &f,
            "Parser fixed.",
            1_000,
            true,
            reply(r#"{"status":"blocked","text":"Fixed the parser; tests next."}"#),
        )
        .await;
        assert_eq!(first.len(), 1);
        assert!(
            first[0].starts_with("Notes so far: none yet"),
            "{}",
            first[0]
        );
        let kept = stored(&f).unwrap();
        assert_eq!(kept.text, "Fixed the parser; tests next.");
        assert_eq!(
            (kept.source.as_str(), kept.status.as_str()),
            ("summary", "blocked")
        );
        assert_eq!(kept.model.as_deref(), Some(model.as_str()));
        assert_eq!(kept.as_of, 1_000);

        let second = run_turn(
            &f,
            "Tests added.",
            2_000,
            true,
            reply(r#"{"status":"done","text":"Parser fixed and tested."}"#),
        )
        .await;
        assert!(
            second[0].starts_with("Notes so far: Fixed the parser; tests next."),
            "{}",
            second[0]
        );
        assert!(second[0].contains("Tests added."));
        assert!(
            !second[0].contains("Parser fixed."),
            "the earlier turn is not re-sent"
        );
        assert_eq!(stored(&f).unwrap().text, "Parser fixed and tested.");
        assert_eq!(f.app.db.reporter_runs_since(0).unwrap().len(), 2);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_call_that_fails_or_answers_badly_leaves_the_last_message_not_an_old_summary() {
        let f = fixture(SubState::Running).await;
        run_turn(
            &f,
            "One.",
            1_000,
            true,
            reply(r#"{"status":"done","text":"S1"}"#),
        )
        .await;
        for bad in [Err("timed out".to_string()), reply("I think it went well")] {
            run_turn(&f, "The newest thing said.", 2_000, true, bad).await;
            let kept = stored(&f).unwrap();
            assert_eq!(kept.source, "last-message");
            assert_eq!(kept.text, "The newest thing said.");
            assert_eq!(kept.model, None);
            // Put a summary back for the next case.
            f.app
                .db
                .store_summary(
                    "child",
                    &StoredSummary {
                        as_of: 1_000,
                        ..kept
                    },
                )
                .unwrap();
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_child_that_reported_this_turn_is_its_own_summary_and_no_model_is_asked() {
        let f = fixture(SubState::Running).await;
        let identity = {
            use crate::agent_identity::IdentityStore;
            f.app.db.issue(&f.key).unwrap()
        };
        assert!(f
            .app
            .db
            .record_agent_report(&identity.incarnation, "Shipped the fix")
            .unwrap());
        let shown = run_turn(
            &f,
            "Done.",
            wall_clock_millis() + 5_000,
            true,
            reply("unused"),
        )
        .await;
        assert!(shown.is_empty(), "a model was asked: {shown:?}");
        let kept = stored(&f).unwrap();
        assert_eq!(
            (kept.source.as_str(), kept.text.as_str()),
            ("report", "Shipped the fix")
        );
        // The next turn has nothing new from the child, so a model summarises it again.
        let next = run_turn(
            &f,
            "More.",
            wall_clock_millis() + 9_000,
            true,
            reply(r#"{"status":"done","text":"S2"}"#),
        )
        .await;
        assert!(
            next[0].starts_with("Notes so far: Shipped the fix"),
            "{}",
            next[0]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn no_model_is_asked_for_a_stopped_child_a_missing_cli_or_a_call_already_running() {
        let stopped = fixture(SubState::Stopped).await;
        assert!(run_turn(&stopped, "x", 1, true, reply("{}"))
            .await
            .is_empty());
        assert_eq!(stored(&stopped).unwrap().source, "last-message");

        let f = fixture(SubState::Running).await;
        assert!(run_turn(&f, "x", 1, false, reply("{}")).await.is_empty());
        assert_eq!(stored(&f).unwrap().source, "last-message");

        let busy = fixture(SubState::Running).await;
        busy.app
            .reporter_in_flight
            .lock()
            .unwrap()
            .insert("child".into());
        assert!(run_turn(&busy, "x", 1, true, reply("{}")).await.is_empty());
        assert_eq!(stored(&busy).unwrap().source, "last-message");
        // The call that was running frees the child when it ends, whatever its result.
        busy.app.reporter_in_flight.lock().unwrap().clear();
        let ok = run_turn(
            &busy,
            "y",
            2,
            true,
            reply(r#"{"status":"done","text":"S"}"#),
        )
        .await;
        assert_eq!(ok.len(), 1);
        assert!(busy.app.reporter_in_flight.lock().unwrap().is_empty());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_run_over_its_message_limit_asks_no_model() {
        let f = fixture(SubState::Running).await;
        for index in 0..crate::agent_mail::MAX_MESSAGES_PER_RUN {
            let crate::db::Enqueued::New(row) = f
                .app
                .db
                .enqueue_message(&crate::db::NewMail {
                    sender_session_id: "child",
                    sender_provider: "codex",
                    sender_label: "child",
                    target_session_id: "lead",
                    target_provider: "claude",
                    target_is_agent: true,
                    body: "hi",
                    key: &format!("k{index}"),
                })
                .unwrap()
            else {
                panic!("message {index} was refused");
            };
            // Delivered, so the lead's queue never fills before the run's limit does.
            let ids = [row.id];
            assert!(f.app.db.claim_mail(&ids).unwrap());
            f.app
                .db
                .settle_mail(&ids, crate::agent_mail::MailState::Delivered, "")
                .unwrap();
        }
        assert!(run_turn(&f, "x", 1, true, reply("{}")).await.is_empty());
    }
}

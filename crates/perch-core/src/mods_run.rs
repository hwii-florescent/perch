//! Running a mod's commands (`[[actions]]` and `[[events]]` of `mods.rs`). The caller has already
//! checked that the mod is Active; this module only keeps a run from hurting Perch:
//!
//! - **argv, no shell.** The program is a bare name (looked up on `PATH`) or a relative path inside
//!   the mod's folder; an absolute path or `..` is refused, so a manifest cannot name `/bin/sh -c`
//!   by accident of expansion (it may still name `sh` and pass `-c`: a mod runs as the user).
//! - **Bounded.** A timeout kills the command's whole process group, output is capped, stdin is
//!   closed, at most [`MAX_RUNNING`] run at once (more are dropped and recorded), and a failure of
//!   any kind is a [`RunRecord`] with `ok: false`, never an error for the caller.
//! - **Located.** The working directory is the mod's folder; `PERCH_MOD_ID`, `PERCH_MOD_DIR`,
//!   `PERCH_MOD_DATA` (a private per-mod folder that outlives updates), `PERCH_MOD_RUN` (what ran)
//!   and `PERCH_MOD_CONTEXT` (JSON) are set.
//!
//! ponytail: the last [`KEEP`] runs are kept in memory, not on disk, and are lost at restart.
use serde::Serialize;
use std::collections::VecDeque;
use std::os::unix::fs::DirBuilderExt;
use std::path::{Component, Path, PathBuf};
use std::process::Stdio;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tokio::io::AsyncReadExt;
use tokio::sync::Semaphore;

pub const ACTION_TIMEOUT: Duration = Duration::from_secs(60);
pub const EVENT_TIMEOUT: Duration = Duration::from_secs(30);
/// Bytes kept of stdout and of stderr each.
pub const OUTPUT_CAP: usize = 16 * 1024;
const MAX_RUNNING: usize = 4;
const KEEP: usize = 50;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRecord {
    #[serde(rename = "mod")]
    pub mod_id: String,
    /// `action:<id>` or `event:<name>`.
    pub what: String,
    pub ok: bool,
    pub exit_code: Option<i32>,
    pub timed_out: bool,
    /// Why it did not run or did not finish, when it did not.
    pub error: Option<String>,
    pub output: String,
    pub truncated: bool,
    pub at: u64,
    pub millis: u64,
}

pub struct Spec {
    pub mod_id: String,
    pub what: String,
    pub dir: PathBuf,
    pub data_dir: PathBuf,
    pub command: Vec<String>,
    pub context: String,
    pub timeout: Duration,
}

static LOG: Mutex<VecDeque<RunRecord>> = Mutex::new(VecDeque::new());
static SLOTS: OnceLock<Semaphore> = OnceLock::new();

/// The most recent runs, newest last.
pub fn recent() -> Vec<RunRecord> {
    LOG.lock()
        .unwrap_or_else(|e| e.into_inner())
        .iter()
        .cloned()
        .collect()
}

fn remember(record: &RunRecord) {
    let mut log = LOG.lock().unwrap_or_else(|e| e.into_inner());
    if log.len() == KEEP {
        log.pop_front();
    }
    log.push_back(record.clone());
}

fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_millis() as u64)
}

/// The program to start: a bare name stays as is; a relative path is taken from the mod's folder.
fn program(dir: &Path, name: &str) -> Result<PathBuf, String> {
    let path = Path::new(name);
    if name.is_empty() || path.is_absolute() || path.components().any(|c| c == Component::ParentDir)
    {
        return Err(format!(
            "\"{name}\" is not allowed: use a program name or a path inside the mod's folder"
        ));
    }
    Ok(if name.contains('/') {
        dir.join(path)
    } else {
        path.to_path_buf()
    })
}

fn failed(spec: &Spec, error: String, started: Instant) -> RunRecord {
    RunRecord {
        mod_id: spec.mod_id.clone(),
        what: spec.what.clone(),
        ok: false,
        exit_code: None,
        timed_out: false,
        error: Some(error),
        output: String::new(),
        truncated: false,
        at: now_millis(),
        millis: started.elapsed().as_millis() as u64,
    }
}

async fn capped(pipe: Option<impl tokio::io::AsyncRead + Unpin>) -> (Vec<u8>, bool) {
    let Some(mut pipe) = pipe else {
        return (Vec::new(), false);
    };
    let mut kept = Vec::new();
    let _ = (&mut pipe)
        .take(OUTPUT_CAP as u64)
        .read_to_end(&mut kept)
        .await;
    // One more byte tells whether the command had more to say. Dropping the pipe afterwards
    // closes it, so a chatty command gets SIGPIPE instead of filling memory.
    let mut more = [0u8; 1];
    let truncated = matches!(pipe.read(&mut more).await, Ok(n) if n > 0);
    (kept, truncated)
}

/// Runs one command to the end, the timeout, or a failure to start. Always returns a record, which
/// is also remembered for [`recent`].
pub async fn run(spec: Spec) -> RunRecord {
    let started = Instant::now();
    let slots = SLOTS.get_or_init(|| Semaphore::new(MAX_RUNNING));
    let record = match slots.try_acquire() {
        Err(_) => failed(
            &spec,
            format!("{MAX_RUNNING} mod commands are already running; this one was dropped"),
            started,
        ),
        Ok(_slot) => run_one(&spec, started).await,
    };
    remember(&record);
    record
}

async fn run_one(spec: &Spec, started: Instant) -> RunRecord {
    let Some(name) = spec.command.first() else {
        return failed(spec, "the command is empty".into(), started);
    };
    let program = match program(&spec.dir, name) {
        Ok(program) => program,
        Err(error) => return failed(spec, error, started),
    };
    if let Err(error) = std::fs::DirBuilder::new()
        .recursive(true)
        .mode(0o700)
        .create(&spec.data_dir)
    {
        return failed(
            spec,
            format!("could not make the mod's data folder: {error}"),
            started,
        );
    }
    let mut command = tokio::process::Command::new(&program);
    command
        .args(&spec.command[1..])
        .current_dir(&spec.dir)
        .env("PERCH_MOD_ID", &spec.mod_id)
        .env("PERCH_MOD_DIR", &spec.dir)
        .env("PERCH_MOD_DATA", &spec.data_dir)
        .env("PERCH_MOD_RUN", &spec.what)
        .env("PERCH_MOD_CONTEXT", &spec.context)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .process_group(0);
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            return failed(
                spec,
                format!("could not start {}: {error}", program.display()),
                started,
            )
        }
    };
    let pid = child.id();
    let (stdout, stderr) = (child.stdout.take(), child.stderr.take());
    let finished = tokio::time::timeout(spec.timeout, async {
        let ((out, out_more), (err, err_more)) = tokio::join!(capped(stdout), capped(stderr));
        (child.wait().await, out, err, out_more || err_more)
    })
    .await;
    let (status, out, err, truncated, timed_out) = match finished {
        Ok((status, out, err, truncated)) => (status.ok(), out, err, truncated, false),
        Err(_) => {
            // The whole group, so helpers the command started die with it.
            if let Some(pid) = pid.filter(|pid| *pid > 0 && *pid <= i32::MAX as u32) {
                unsafe { libc::kill(-(pid as libc::pid_t), libc::SIGKILL) };
            }
            let _ = child.kill().await;
            (None, Vec::new(), Vec::new(), false, true)
        }
    };
    let mut output = String::from_utf8_lossy(&out).into_owned();
    if !err.is_empty() {
        output += &format!(
            "{}[stderr] {}",
            if output.is_empty() { "" } else { "\n" },
            String::from_utf8_lossy(&err)
        );
    }
    let exit_code = status.and_then(|s| s.code());
    RunRecord {
        mod_id: spec.mod_id.clone(),
        what: spec.what.clone(),
        ok: !timed_out && status.is_some_and(|s| s.success()),
        exit_code,
        timed_out,
        error: timed_out.then(|| format!("stopped after {} seconds", spec.timeout.as_secs())),
        output,
        truncated,
        at: now_millis(),
        millis: started.elapsed().as_millis() as u64,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Dir(PathBuf);

    impl Dir {
        fn new() -> Self {
            let dir = std::env::temp_dir().join(format!("perch-modrun-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir_all(dir.join("mod")).unwrap();
            Self(dir)
        }

        fn spec(&self, command: &[&str], timeout: Duration) -> Spec {
            Spec {
                mod_id: "demo".into(),
                what: "action:go".into(),
                dir: self.0.join("mod"),
                data_dir: self.0.join("data"),
                command: command.iter().map(|word| word.to_string()).collect(),
                context: "{\"x\":1}".into(),
                timeout,
            }
        }
    }

    impl Drop for Dir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    const LONG: Duration = Duration::from_secs(10);

    #[tokio::test]
    async fn a_command_runs_without_a_shell_in_the_mods_folder_with_its_context() {
        let dir = Dir::new();
        let echo = run(dir.spec(&["echo", "$HOME; touch pwned"], LONG)).await;
        assert!(echo.ok, "{echo:?}");
        assert_eq!(
            echo.output.trim(),
            "$HOME; touch pwned",
            "no expansion, no second command"
        );
        assert!(!dir.0.join("mod").join("pwned").exists());
        let env = run(dir.spec(
            &[
                "sh",
                "-c",
                "echo $PERCH_MOD_ID $PERCH_MOD_CONTEXT; pwd; test -d \"$PERCH_MOD_DATA\"",
            ],
            LONG,
        ))
        .await;
        assert!(env.ok, "{env:?}");
        assert!(env.output.starts_with("demo {\"x\":1}\n"), "{}", env.output);
        assert!(
            env.output.contains("perch-modrun-"),
            "runs in the mod's folder: {}",
            env.output
        );
    }

    #[tokio::test]
    async fn failure_timeout_and_a_flood_of_output_are_records_not_problems() {
        let dir = Dir::new();
        let bad = run(dir.spec(&["sh", "-c", "echo oops >&2; exit 3"], LONG)).await;
        assert!(
            !bad.ok && bad.exit_code == Some(3) && bad.output.contains("[stderr] oops"),
            "{bad:?}"
        );
        let missing = run(dir.spec(&["definitely-not-a-program-xyz"], LONG)).await;
        assert!(
            !missing.ok
                && missing
                    .error
                    .as_deref()
                    .is_some_and(|e| e.contains("could not start"))
        );
        // A hang is killed, helpers and all.
        let marker = dir.0.join("still-here");
        let slow = run(dir.spec(
            &[
                "sh",
                "-c",
                &format!("(sleep 3; touch {}) & sleep 30", marker.display()),
            ],
            Duration::from_millis(300),
        ))
        .await;
        assert!(slow.timed_out && !slow.ok, "{slow:?}");
        tokio::time::sleep(Duration::from_millis(3500)).await;
        assert!(!marker.exists(), "the helper it started was killed with it");
        // A flood is cut, and the command is ended rather than buffered.
        let flood = run(dir.spec(&["sh", "-c", "yes | head -c 5000000"], LONG)).await;
        assert!(
            flood.truncated && flood.output.len() <= OUTPUT_CAP + 64,
            "{}",
            flood.output.len()
        );
    }

    #[tokio::test]
    async fn programs_outside_the_mod_are_refused() {
        let dir = Dir::new();
        for name in ["/bin/echo", "../../bin/echo", ""] {
            let refused = run(dir.spec(&[name], LONG)).await;
            assert!(
                !refused.ok && refused.error.is_some(),
                "{name}: {refused:?}"
            );
        }
        std::fs::write(dir.0.join("mod").join("hi.sh"), "#!/bin/sh\necho hi\n").unwrap();
        std::fs::set_permissions(
            dir.0.join("mod").join("hi.sh"),
            std::os::unix::fs::PermissionsExt::from_mode(0o755),
        )
        .unwrap();
        assert_eq!(run(dir.spec(&["./hi.sh"], LONG)).await.output.trim(), "hi");
        assert!(recent().len() <= KEEP);
    }
}

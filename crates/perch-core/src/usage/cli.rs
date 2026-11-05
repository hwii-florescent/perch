//! Plumbing for the local NDJSON conversations with `claude` (stream-json
//! control requests) and `codex app-server` (JSON-RPC): a piped child that
//! dies with its owner, one JSON line out, lines in until a predicate matches,
//! all under one deadline. The CLI owns auth; Perch only asks.

use serde_json::Value;
use std::future::Future;
use std::process::Stdio;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};

/// A longer line is a runaway child, not a reply.
const MAX_LINE_BYTES: u64 = 4 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Failure {
    /// The binary is not installed (or not on PATH).
    Missing,
    SignedOut,
    /// The CLI does not know the request.
    Outdated,
    Unreachable,
    /// Claude answered from a cache that is not this account's fresh reading.
    Stale,
}

pub(super) struct Conversation {
    child: Child,
    stdin: Option<ChildStdin>,
    stdout: BufReader<ChildStdout>,
}

impl Conversation {
    /// Runs in the temp dir so a project's settings never load; stderr is
    /// dropped and the child is killed when the conversation is dropped.
    pub(super) fn spawn(mut command: Command) -> Result<Self, Failure> {
        let mut child = command
            .current_dir(std::env::temp_dir())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| {
                if e.kind() == std::io::ErrorKind::NotFound {
                    Failure::Missing
                } else {
                    Failure::Unreachable
                }
            })?;
        let stdin = child.stdin.take();
        let stdout = child.stdout.take().ok_or(Failure::Unreachable)?;
        Ok(Self {
            child,
            stdin,
            stdout: BufReader::new(stdout),
        })
    }

    pub(super) async fn send(&mut self, message: &Value) -> Result<(), Failure> {
        let mut line = message.to_string();
        line.push('\n');
        let stdin = self.stdin.as_mut().ok_or(Failure::Unreachable)?;
        stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|_| Failure::Unreachable)?;
        stdin.flush().await.map_err(|_| Failure::Unreachable)
    }

    /// Reads lines until one parses as JSON and satisfies `matches`; non-JSON
    /// and unrelated lines are skipped. EOF or an oversized line fails.
    pub(super) async fn read_until(
        &mut self,
        matches: impl Fn(&Value) -> bool,
    ) -> Result<Value, Failure> {
        let mut line = Vec::new();
        loop {
            line.clear();
            let read = (&mut self.stdout)
                .take(MAX_LINE_BYTES + 1)
                .read_until(b'\n', &mut line)
                .await
                .map_err(|_| Failure::Unreachable)?;
            if read == 0 || line.len() as u64 > MAX_LINE_BYTES {
                return Err(Failure::Unreachable);
            }
            if let Ok(value) = serde_json::from_slice::<Value>(&line) {
                if matches(&value) {
                    return Ok(value);
                }
            }
        }
    }

    /// Closes stdin and gives the child `grace` to exit on its own (Claude
    /// saves its state file on the way out); dropping then kills a straggler.
    pub(super) async fn finish(mut self, grace: Duration) {
        drop(self.stdin.take());
        let _ = tokio::time::timeout(grace, self.child.wait()).await;
    }
}

/// Bounds a whole conversation; dropping the future kills the child.
pub(super) async fn with_deadline<T>(
    limit: Duration,
    run: impl Future<Output = Result<T, Failure>>,
) -> Result<T, Failure> {
    tokio::time::timeout(limit, run)
        .await
        .unwrap_or(Err(Failure::Unreachable))
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn conversation_matches_replies_and_deadline_kills_a_hung_child() {
        assert!(matches!(
            Conversation::spawn(Command::new("perch-no-such-binary")),
            Err(Failure::Missing)
        ));

        let pid_file =
            std::env::temp_dir().join(format!("perch-cli-test-{}", uuid::Uuid::new_v4()));
        let script = format!(
            "echo $$ > '{}'; read line; echo 'not json'; echo '{{\"method\":\"note\"}}'; \
             echo '{{\"id\":2,\"result\":0}}'; echo '{{\"id\":1,\"result\":7}}'; exec sleep 30",
            pid_file.display()
        );
        let mut command = Command::new("sh");
        command.args(["-c", &script]);
        let result = with_deadline(Duration::from_millis(1000), async {
            let mut chat = Conversation::spawn(command)?;
            chat.send(&json!({"id": 1, "method": "ping"})).await?;
            let reply = chat
                .read_until(|v| v.get("method").is_none() && v["id"] == 1)
                .await?;
            assert_eq!(reply["result"], 7);
            // Nothing else arrives: the deadline must end this and kill the child.
            chat.read_until(|v| v["id"] == 3).await
        })
        .await;
        assert_eq!(result, Err(Failure::Unreachable));

        let pid: libc::pid_t = std::fs::read_to_string(&pid_file)
            .unwrap()
            .trim()
            .parse()
            .unwrap();
        std::fs::remove_file(&pid_file).unwrap();
        for _ in 0..100 {
            // SAFETY: signal 0 only probes whether this process id still exists.
            if unsafe { libc::kill(pid, 0) } != 0 {
                return;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        panic!("hung child {pid} survived the deadline");
    }
}

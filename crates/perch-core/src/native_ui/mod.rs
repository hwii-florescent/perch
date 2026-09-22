//! Native CLI UI bridges: Pi/OMP extension sockets and Claude hooks/transcripts.
//! Each interactive provider owns its conversation and turn loop. Perch observes
//! native state and forwards explicit controls without a second provider process.
use crate::{agent_fleet::AgentKey, agent_runtime::terminal_key, protocol::NativeUiSnapshot};
use anyhow::{bail, ensure, Context};
use serde::Deserialize;
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    net::UnixStream,
    sync::{mpsc, oneshot, watch},
};

pub mod claude;
pub mod codex;
pub mod opencode;

fn clip(text: &str, limit: usize) -> String {
    let mut end = text.len().min(limit);
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    text[..end].to_string()
}

const MAX_FRAME: usize = 256 * 1024;
const MAX_BRIDGES: usize = 128;

pub fn supported(provider: &str) -> bool {
    cfg!(unix) && matches!(provider, "pi" | "omp" | "claude" | "codex" | "opencode")
}

pub struct NativePaths {
    pub extension: PathBuf,
    pub socket: PathBuf,
}

pub fn paths(key: &AgentKey) -> anyhow::Result<NativePaths> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::{DirBuilderExt, MetadataExt, PermissionsExt};
        let uid = unsafe { libc::geteuid() };
        let root = PathBuf::from(format!("/tmp/perch-native-{uid}"));
        if let Err(error) = std::fs::DirBuilder::new().mode(0o700).create(&root) {
            if error.kind() != std::io::ErrorKind::AlreadyExists {
                return Err(error.into());
            }
        }
        let metadata = std::fs::symlink_metadata(&root)?;
        ensure!(
            metadata.is_dir()
                && !metadata.file_type().is_symlink()
                && metadata.uid() == uid
                && metadata.permissions().mode() & 0o077 == 0,
            "native UI directory must be owned by this user with mode 0700"
        );
        // Resolve the *parent* chain only — the check above already refused a
        // symlinked root, so this cannot follow one into somebody else's
        // directory. codex 0.154.0 refuses to bind an app-server socket whose
        // path contains a symlinked component, and on macOS `/tmp` is exactly
        // that (a link to `/private/tmp`), so the literal path would fail
        // every native codex launch. Both spellings name the same inode, so a
        // session started before this still reconnects.
        let root = std::fs::canonicalize(&root)?;
        let hash = terminal_key(key);
        let name = &hash[6..38];
        Ok(NativePaths {
            extension: root.join(format!(
                "{name}.{}",
                match key.agent_id.as_str() {
                    "claude" => "json",
                    "codex" => "sh",
                    "opencode" => "mjs",
                    _ => "ts",
                }
            )),
            socket: root.join(format!("{name}.sock")),
        })
    }
    #[cfg(not(unix))]
    {
        let _ = key;
        bail!("native CLI UI requires a Unix host")
    }
}

/// Materialize a private extension before launching. A live socket is never
/// replaced, including when another core tries to launch the same identity.
pub fn prepare(key: &AgentKey, provider: &str, fresh: bool) -> anyhow::Result<NativePaths> {
    ensure!(supported(provider), "provider has no native UI bridge");
    let paths = paths(key)?;
    if fresh && paths.socket.exists() {
        match std::os::unix::net::UnixStream::connect(&paths.socket) {
            Ok(_) => bail!("the native CLI session is already running"),
            Err(error)
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::ConnectionRefused | std::io::ErrorKind::NotFound
                ) =>
            {
                let _ = std::fs::remove_file(&paths.socket);
            }
            Err(error) => return Err(error.into()),
        }
    }
    let source = if provider == "codex" {
        codex::LAUNCHER.to_string()
    } else if provider == "opencode" {
        include_str!("opencode-plugin.mjs").replace(
            "\"__PERCH_NATIVE_SOCKET__\"",
            &serde_json::to_string(&paths.socket)?,
        )
    } else if provider == "claude" {
        claude::settings(&paths.extension, fresh)?
    } else {
        include_str!("pi-extension.ts")
            .replace(
                "\"__PERCH_NATIVE_SOCKET__\"",
                &serde_json::to_string(&paths.socket)?,
            )
            .replace(
                "\"__PERCH_NATIVE_PROVIDER__\"",
                &serde_json::to_string(provider)?,
            )
    };
    write_private(&paths.extension, &source)?;
    Ok(paths)
}

fn write_private(path: &std::path::Path, source: &str) -> anyhow::Result<()> {
    use std::io::Write;
    use std::os::unix::fs::OpenOptionsExt;
    let temporary = path.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| -> anyhow::Result<()> {
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&temporary)?;
        file.write_all(source.as_bytes())?;
        file.sync_all()?;
        std::fs::rename(&temporary, path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&temporary);
    }
    result
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum NativeEvent {
    Snapshot {
        #[serde(flatten)]
        snapshot: NativeUiSnapshot,
    },
    Ack {
        #[serde(rename = "requestId")]
        request_id: String,
        accepted: bool,
        #[serde(default)]
        error: Option<String>,
    },
}

struct Command {
    id: String,
    payload: String,
    reply: oneshot::Sender<Result<bool, String>>,
}

pub struct NativeBridge {
    key: AgentKey,
    snapshot: watch::Receiver<Option<NativeUiSnapshot>>,
    commands: mpsc::Sender<Command>,
}
impl NativeBridge {
    pub async fn snapshot(&self) -> anyhow::Result<NativeUiSnapshot> {
        let mut receiver = self.snapshot.clone();
        let result = tokio::time::timeout(Duration::from_secs(10), async {
            loop {
                if let Some(snapshot) = receiver.borrow().clone() {
                    return Ok(snapshot);
                }
                receiver
                    .changed()
                    .await
                    .context("native CLI UI disconnected")?;
            }
        })
        .await;
        if result.is_err() && self.key.agent_id == "opencode" {
            use std::io::Read;
            if let Ok(file) =
                std::fs::File::open(paths(&self.key)?.extension.with_extension("tui.json.error"))
            {
                let mut message = String::new();
                file.take(4096).read_to_string(&mut message)?;
                bail!("{}", message.trim());
            }
        }
        result.context("waiting for the CLI's native UI bridge timed out")?
    }
    // Called while the runtime's input authority lock is held. Once enqueued,
    // this command has the same ordering guarantee as accepted PTY input.
    pub fn enqueue(
        &self,
        id: &str,
        text: Option<&str>,
    ) -> anyhow::Result<oneshot::Receiver<Result<bool, String>>> {
        let (tx, rx) = oneshot::channel();
        let mut payload = match text {
            Some(text) => serde_json::json!({ "type": "prompt", "requestId": id, "text": text }),
            None => serde_json::json!({ "type": "cancel", "requestId": id }),
        };
        if self.key.agent_id == "claude" {
            payload["after"] = claude::prompt_stamp(&paths(&self.key)?.extension).into();
        }
        self.commands
            .try_send(Command {
                id: id.to_string(),
                payload: serde_json::to_string(&payload)? + "\n",
                reply: tx,
            })
            .map_err(|_| {
                anyhow::anyhow!("native CLI is disconnected or its command queue is full")
            })?;
        Ok(rx)
    }
}

#[derive(Default)]
pub struct NativeUiRegistry {
    bridges: Mutex<HashMap<AgentKey, Arc<NativeBridge>>>,
}
impl NativeUiRegistry {
    pub fn get(&self, key: &AgentKey) -> Option<Arc<NativeBridge>> {
        self.bridges.lock().unwrap().get(key).cloned()
    }
    pub fn start(
        self: &Arc<Self>,
        key: AgentKey,
        provider_session_id: Option<String>,
        alive: Arc<dyn Fn() -> bool + Send + Sync>,
        on_snapshot: Arc<dyn Fn(NativeUiSnapshot) + Send + Sync>,
    ) -> anyhow::Result<()> {
        let mut bridges = self.bridges.lock().unwrap();
        if bridges.contains_key(&key) {
            return Ok(());
        }
        ensure!(
            bridges.len() < MAX_BRIDGES,
            "too many native UI connections"
        );
        let socket = paths(&key)?.socket;
        let (snapshot_tx, snapshot) = watch::channel(None);
        let (commands, mut commands_rx) = mpsc::channel::<Command>(16);
        bridges.insert(
            key.clone(),
            Arc::new(NativeBridge {
                key: key.clone(),
                snapshot,
                commands,
            }),
        );
        let registry = Arc::downgrade(self);
        tokio::spawn(async move {
            if matches!(key.agent_id.as_str(), "claude" | "codex") {
                if key.agent_id == "codex" {
                    codex::observe(
                        &key,
                        provider_session_id,
                        alive,
                        on_snapshot,
                        snapshot_tx,
                        commands_rx,
                    )
                    .await;
                } else {
                    claude::observe(&key, alive, on_snapshot, snapshot_tx, commands_rx).await;
                }
                if let Some(registry) = registry.upgrade() {
                    registry.bridges.lock().unwrap().remove(&key);
                }
                return;
            }
            let mut pending = HashMap::<String, oneshot::Sender<Result<bool, String>>>::new();
            while alive() {
                let stream = match UnixStream::connect(&socket).await {
                    Ok(stream) => stream,
                    Err(_) => {
                        tokio::time::sleep(Duration::from_millis(250)).await;
                        continue;
                    }
                };
                let (reader, mut writer) = stream.into_split();
                let mut reader = BufReader::new(reader);
                let mut line = Vec::new();
                loop {
                    pending.retain(|_, reply| !reply.is_closed());
                    tokio::select! {
                        frame = read_frame(&mut reader, &mut line) => {
                            let event = match frame.and_then(|_| serde_json::from_slice::<NativeEvent>(&line).map_err(Into::into)) {
                                Ok(event) => event, Err(_) => break,
                            };
                            match event {
                                NativeEvent::Snapshot { snapshot } => {
                                    if snapshot.version != 1 || (snapshot.provider_session_id.is_empty() && key.agent_id != "opencode") || snapshot.messages.len() > 129 { break; }
                                    on_snapshot(snapshot.clone());
                                    let _ = snapshot_tx.send(Some(snapshot));
                                }
                                NativeEvent::Ack { request_id, accepted, error } => {
                                    if let Some(reply) = pending.remove(&request_id) { let _ = reply.send(error.map_or(Ok(accepted), Err)); }
                                }
                            }
                            line.clear();
                        }
                        command = commands_rx.recv(), if pending.len() < 16 => {
                            let Some(command) = command else { break; };
                            if command.reply.is_closed() { continue; }
                            if !matches!(tokio::time::timeout(Duration::from_secs(2), writer.write_all(command.payload.as_bytes())).await, Ok(Ok(()))) {
                                let _ = command.reply.send(Err("native CLI disconnected before confirming delivery".into()));
                                break;
                            }
                            pending.insert(command.id, command.reply);
                        }
                        _ = tokio::time::sleep(Duration::from_secs(1)) => { if !alive() { break; } }
                    }
                }
                snapshot_tx.send_replace(None);
                for (_, reply) in pending.drain() {
                    let _ = reply.send(Err(
                        "native CLI disconnected before confirming delivery".into()
                    ));
                }
                // Never automatically replay a command across reconnect. A
                // successful write may already have started a provider turn.
                while let Ok(command) = commands_rx.try_recv() {
                    let _ = command.reply.send(Err("native CLI disconnected".into()));
                }
                tokio::time::sleep(Duration::from_millis(250)).await;
            }
            if let Some(registry) = registry.upgrade() {
                registry.bridges.lock().unwrap().remove(&key);
            }
        });
        Ok(())
    }
}

/// Bounded and cancellation-safe line framing: the partial line stays with
/// the reader across select branches, never in a discarded read future.
async fn read_frame(
    reader: &mut BufReader<tokio::net::unix::OwnedReadHalf>,
    line: &mut Vec<u8>,
) -> anyhow::Result<()> {
    loop {
        let available = reader.fill_buf().await?;
        ensure!(!available.is_empty(), "native CLI closed its UI socket");
        let newline = available.iter().position(|byte| *byte == b'\n');
        let count = newline.map_or(available.len(), |index| index + 1);
        ensure!(
            line.len() + count <= MAX_FRAME,
            "native CLI frame too large"
        );
        line.extend_from_slice(&available[..count]);
        reader.consume(count);
        if newline.is_some() {
            return Ok(());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};
    use tokio::net::UnixListener;

    #[test]
    fn prepare_preserves_live_codex_session_even_with_pid_sidecar() {
        let key = AgentKey::new("native-test", uuid::Uuid::new_v4().to_string(), "codex").unwrap();
        let paths = paths(&key).unwrap();
        let listener = std::os::unix::net::UnixListener::bind(&paths.socket).unwrap();
        let pid_path = paths.extension.with_extension("pid");
        std::fs::write(&pid_path, std::process::id().to_string()).unwrap();
        assert!(prepare(&key, "codex", true)
            .err()
            .unwrap()
            .to_string()
            .contains("already running"));
        assert!(pid_path.exists());
        assert!(std::os::unix::net::UnixStream::connect(&paths.socket).is_ok());
        drop(listener);
        std::fs::remove_file(&paths.socket).unwrap();
        std::fs::remove_file(pid_path).unwrap();
    }

    #[tokio::test]
    async fn framing_preserves_partial_data_after_cancellation_and_rejects_oversize() {
        let (client, mut peer) = UnixStream::pair().unwrap();
        let (reader, _) = client.into_split();
        let mut reader = BufReader::new(reader);
        let mut line = Vec::new();
        peer.write_all(b"partial").await.unwrap();
        assert!(tokio::time::timeout(
            Duration::from_millis(10),
            read_frame(&mut reader, &mut line)
        )
        .await
        .is_err());
        assert_eq!(line, b"partial");
        peer.write_all(b" complete\nnext\n").await.unwrap();
        read_frame(&mut reader, &mut line).await.unwrap();
        assert_eq!(line, b"partial complete\n");
        line.clear();
        read_frame(&mut reader, &mut line).await.unwrap();
        assert_eq!(line, b"next\n");
        line.resize(MAX_FRAME, b'x');
        peer.write_all(b"\n").await.unwrap();
        assert!(read_frame(&mut reader, &mut line).await.is_err());
        assert_eq!(line.len(), MAX_FRAME);
    }

    #[tokio::test]
    async fn disconnect_fails_delivery_without_replaying_into_reconnected_cli() {
        let key = AgentKey::new("native-test", uuid::Uuid::new_v4().to_string(), "pi").unwrap();
        let socket = paths(&key).unwrap().socket;
        let listener = UnixListener::bind(&socket).unwrap();
        let alive = Arc::new(AtomicBool::new(true));
        let running = alive.clone();
        let registry = Arc::new(NativeUiRegistry::default());
        registry
            .start(
                key.clone(),
                None,
                Arc::new(move || running.load(Ordering::SeqCst)),
                Arc::new(|_| {}),
            )
            .unwrap();
        let bridge = registry.get(&key).unwrap();
        let (peer, _) = listener.accept().await.unwrap();
        let (reader, mut writer) = peer.into_split();
        let mut reader = BufReader::new(reader);
        let snapshot = serde_json::json!({"type":"snapshot","version":1,"revision":1,"pid":123,"providerSessionId":"/native/session.jsonl","cwd":"/native","model":null,"running":false,"messages":[],"truncated":false}).to_string() + "\n";
        writer.write_all(snapshot.as_bytes()).await.unwrap();
        assert_eq!(bridge.snapshot().await.unwrap().pid, 123);
        let reply = bridge.enqueue("once", Some("exactly one prompt")).unwrap();
        let mut line = Vec::new();
        read_frame(&mut reader, &mut line).await.unwrap();
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&line).unwrap()["requestId"],
            "once"
        );
        drop(reader);
        drop(writer); // Native CLI saw the prompt, but no receipt reached Perch.
        assert!(reply.await.unwrap().is_err());
        let (peer, _) = listener.accept().await.unwrap();
        let (reader, mut writer) = peer.into_split();
        let mut reader = BufReader::new(reader);
        writer.write_all(snapshot.as_bytes()).await.unwrap();
        assert_eq!(
            bridge.snapshot().await.unwrap().provider_session_id,
            "/native/session.jsonl"
        );
        line.clear();
        assert!(tokio::time::timeout(
            Duration::from_millis(30),
            read_frame(&mut reader, &mut line)
        )
        .await
        .is_err());
        // New explicit controls still work after reconnect.
        let reply = bridge.enqueue("cancel", None).unwrap();
        read_frame(&mut reader, &mut line).await.unwrap();
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&line).unwrap()["type"],
            "cancel"
        );
        writer
            .write_all(b"{\"type\":\"ack\",\"requestId\":\"cancel\",\"accepted\":true}\n")
            .await
            .unwrap();
        assert_eq!(reply.await.unwrap(), Ok(true));
        alive.store(false, Ordering::SeqCst);
        drop(reader);
        drop(writer);
        drop(listener);
        tokio::time::timeout(Duration::from_secs(2), async {
            while registry.get(&key).is_some() {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        std::fs::remove_file(socket).unwrap();
    }
}

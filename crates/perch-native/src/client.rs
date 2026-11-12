//! Client for a running perch-core: sign in with the local UI credential, list projects and
//! sessions, and stream a terminal over the core's `/ws` socket. No GPUI types live here.
//!
//! A session's shell is the `terminal` provider's agent terminal: that is what makes it a listed
//! session, and input and size go through the leases `open_terminal` takes.
//!
//! Frames the core sends are parsed into `perch_core::protocol::ServerMessage`. `ClientMessage`
//! only derives `Deserialize`, so outgoing frames are built as JSON; `frames_match_the_core_protocol`
//! checks each one against the real type.

use anyhow::{anyhow, bail, Context, Result};
use futures::{SinkExt, StreamExt};
use perch_core::agent_fleet::TERMINAL_PROVIDER;
use perch_core::protocol::{ProjectSummary, ServerMessage, SessionSummary};
use serde_json::{json, Value};
use std::collections::VecDeque;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::{timeout_at, Instant};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};

/// How long a request waits for the core's answer.
const REPLY_TIMEOUT: Duration = Duration::from_secs(15);

/// A core's address and the local UI token that opens it.
#[derive(Clone)]
pub struct Core {
    /// `host:port`, loopback only: the core accepts its local token from this machine alone.
    authority: String,
    /// The core's base path, always starting and ending with `/`.
    base_path: String,
    token: String,
}

impl Core {
    /// A core whose local UI token is already known (a headless core publishes it in `core.json`).
    pub fn with_token(base_url: &str, token: &str) -> Result<Self> {
        let (authority, base_path) = split_base_url(base_url)?;
        if token.is_empty() || !token.bytes().all(|b| b.is_ascii_graphic() && b != b';') {
            bail!("the local token is not a valid credential");
        }
        Ok(Self {
            authority,
            base_path,
            token: token.to_string(),
        })
    }

    /// The desktop app's flow: spend a one-use sign-in code at `GET {base}local-login` and keep
    /// the `perch_local` cookie it sets as the token.
    pub async fn login(base_url: &str, code: &str) -> Result<Self> {
        let (authority, base_path) = split_base_url(base_url)?;
        if code.is_empty() || !code.bytes().all(|b| b.is_ascii_alphanumeric()) {
            bail!("the sign-in code is not valid");
        }
        let request =
            format!("GET {base_path}local-login?code={code} HTTP/1.0\r\nHost: {authority}\r\n\r\n");
        let mut stream = TcpStream::connect(&authority)
            .await
            .with_context(|| format!("could not reach the core at {authority}"))?;
        stream.write_all(request.as_bytes()).await?;
        let mut response = String::new();
        stream.read_to_string(&mut response).await?;
        let head = response.split("\r\n\r\n").next().unwrap_or_default();
        let status = head.split_whitespace().nth(1).unwrap_or_default();
        // The core answers a good code with a redirect to the app and refuses the rest.
        if status != "303" {
            bail!("the core refused the sign-in code (status {status:?})");
        }
        let token = head
            .lines()
            .filter_map(|line| line.split_once(':'))
            .filter(|(name, _)| name.eq_ignore_ascii_case("set-cookie"))
            .find_map(|(_, value)| value.trim().strip_prefix("perch_local="))
            .and_then(|value| value.split(';').next())
            .ok_or_else(|| anyhow!("the core did not set a local credential"))?;
        Self::with_token(base_url, token)
    }

    /// The core a headless run published in `core.json` under `dir` (a daemon directory).
    pub fn discover(dir: &std::path::Path) -> Result<Self> {
        let address = perchd::agent_cli::read_core_file(dir).map_err(|e| anyhow!(e))?;
        let token = address
            .local_token
            .as_deref()
            .ok_or_else(|| anyhow!("the core publishes no token; sign in with a code instead"))?;
        Self::with_token(
            &format!("http://127.0.0.1:{}{}", address.port, address.base_path),
            token,
        )
    }

    /// Open the core's WebSocket.
    pub async fn connect(&self) -> Result<Connection> {
        let mut request = format!("ws://{}{}ws", self.authority, self.base_path)
            .into_client_request()
            .context("invalid core address")?;
        request.headers_mut().insert(
            "authorization",
            format!("Bearer {}", self.token)
                .parse()
                .context("the local token is not a valid header value")?,
        );
        let (socket, _) = tokio_tungstenite::connect_async(request)
            .await
            .context("the core refused the connection")?;
        Ok(Connection {
            socket,
            queued: VecDeque::new(),
            next_request: 0,
        })
    }
}

/// `http://127.0.0.1:7788/` into `("127.0.0.1:7788", "/")`.
fn split_base_url(base_url: &str) -> Result<(String, String)> {
    let rest = base_url
        .strip_prefix("http://")
        .ok_or_else(|| anyhow!("the core address must start with http://"))?;
    let (authority, path) = rest.split_once('/').unwrap_or((rest, ""));
    let host = authority
        .rsplit_once(':')
        .map_or(authority, |(host, _)| host);
    if authority.is_empty() || !matches!(host, "127.0.0.1" | "localhost" | "[::1]") {
        bail!("the local credential is accepted from this machine only; use a loopback address");
    }
    let path = path.trim_matches('/');
    let base_path = if path.is_empty() {
        "/".to_string()
    } else {
        format!("/{path}/")
    };
    Ok((authority.to_string(), base_path))
}

/// Projects and sessions as the sidebar shows them.
#[derive(Clone, Debug, Default)]
pub struct Snapshot {
    pub projects: Vec<ProjectSummary>,
    pub sessions: Vec<SessionSummary>,
}

/// A session's shell attached in this connection. `replay` is the screen repaint sent on
/// attach; live output then arrives through [`Connection::next`] as `terminal.data`.
pub struct Terminal {
    pub id: String,
    pub replay: String,
    session_id: String,
    /// Names this attachment to the core; the core requires it to equal the open request's id.
    view_id: String,
    /// The generations of the input and resize leases this connection holds. The core accepts
    /// typing and resizing only from the holder; `None` means another view holds it.
    input: Option<u64>,
    resize: Option<u64>,
}

pub struct Connection {
    socket: WebSocketStream<MaybeTlsStream<TcpStream>>,
    /// Frames read while waiting for a reply, kept for `next`.
    queued: VecDeque<ServerMessage>,
    next_request: u64,
}

impl Connection {
    pub async fn snapshot(&mut self) -> Result<Snapshot> {
        let id = self.request_id();
        self.send(json!({"type": "project.list", "requestId": id}))
            .await?;
        let projects = self
            .reply(Some(&id), |m| match m {
                ServerMessage::ProjectList {
                    request_id,
                    projects,
                    ..
                } if *request_id == id => Some(projects.clone()),
                _ => None,
            })
            .await?;
        self.send(json!({"type": "session.list"})).await?;
        let sessions = self
            .reply(None, |m| match m {
                ServerMessage::SessionList { sessions } => Some(sessions.clone()),
                _ => None,
            })
            .await?;
        Ok(Snapshot { projects, sessions })
    }

    /// A new session in `cwd` (a listed project), or in Chats when `None`. Returns its id.
    pub async fn create_session(&mut self, cwd: Option<&str>) -> Result<String> {
        self.send(json!({"type": "session.create", "cwd": cwd}))
            .await?;
        self.reply(None, |m| match m {
            ServerMessage::SessionCreated { session_id } => Some(session_id.clone()),
            _ => None,
        })
        .await
    }

    /// Attach the shell of a session (starting it if needed) and take control of its input
    /// and size, unless another view (the desktop app, say) already holds them.
    pub async fn open_terminal(
        &mut self,
        session_id: &str,
        cols: u16,
        rows: u16,
    ) -> Result<Terminal> {
        let id = self.request_id();
        self.send(open_frame(&id, session_id, cols, rows)).await?;
        let (terminal_id, replay, workspace_id) = self
            .reply(Some(&id), |m| match m {
                ServerMessage::AgentTerminalOpened {
                    request_id,
                    terminal_id,
                    status,
                    replay,
                } if *request_id == id => Some((
                    terminal_id.clone(),
                    replay.clone(),
                    status.key.workspace_id.clone(),
                )),
                _ => None,
            })
            .await?;
        let input = self.acquire(session_id, &workspace_id, "input").await?;
        let resize = self.acquire(session_id, &workspace_id, "resize").await?;
        Ok(Terminal {
            id: terminal_id,
            replay,
            session_id: session_id.to_string(),
            view_id: id,
            input,
            resize,
        })
    }

    async fn acquire(
        &mut self,
        session_id: &str,
        workspace_id: &str,
        channel: &str,
    ) -> Result<Option<u64>> {
        let id = self.request_id();
        self.send(acquire_frame(&id, session_id, workspace_id, channel))
            .await?;
        self.reply(Some(&id), |m| match m {
            ServerMessage::AgentControl {
                request_id, lease, ..
            } if *request_id == id => Some(lease.as_ref().map(|lease| lease.generation)),
            _ => None,
        })
        .await
    }

    pub async fn terminal_input(&mut self, terminal: &Terminal, data: &str) -> Result<()> {
        let generation = terminal
            .input
            .ok_or_else(|| anyhow!("another view controls this terminal's input"))?;
        self.send(input_frame(&terminal.id, generation, data)).await
    }

    pub async fn terminal_resize(
        &mut self,
        terminal: &Terminal,
        cols: u16,
        rows: u16,
    ) -> Result<()> {
        let generation = terminal
            .resize
            .ok_or_else(|| anyhow!("another view controls this terminal's size"))?;
        self.send(resize_frame(&terminal.id, generation, cols, rows))
            .await
    }

    /// Stop watching a terminal. The shell keeps running in the core.
    pub async fn release_terminal(&mut self, terminal: &Terminal) -> Result<()> {
        self.send(
            json!({"type": "agent.terminal.release", "sessionId": terminal.session_id,
                         "providerId": TERMINAL_PROVIDER, "viewId": terminal.view_id}),
        )
        .await
    }

    /// The next frame from the core: live `terminal.data`, broadcasts, anything not yet taken.
    /// Frames this client does not know are skipped. Errors once the socket closes.
    pub async fn next(&mut self) -> Result<ServerMessage> {
        match self.queued.pop_front() {
            Some(message) => Ok(message),
            None => self.read().await,
        }
    }

    fn request_id(&mut self) -> String {
        self.next_request += 1;
        format!("native-{}", self.next_request)
    }

    async fn send(&mut self, frame: Value) -> Result<()> {
        self.socket
            .send(Message::text(frame.to_string()))
            .await
            .context("the core connection is closed")
    }

    async fn read(&mut self) -> Result<ServerMessage> {
        loop {
            let frame = self
                .socket
                .next()
                .await
                .ok_or_else(|| anyhow!("the core closed the connection"))??;
            match frame {
                Message::Text(text) => {
                    if let Ok(message) = serde_json::from_str(&text) {
                        return Ok(message);
                    }
                }
                Message::Close(_) => bail!("the core closed the connection"),
                _ => {}
            }
        }
    }

    /// Wait for the frame `pick` accepts. Other frames stay queued for `next`; an `error`
    /// frame answering `request_id` fails the call.
    async fn reply<T>(
        &mut self,
        request_id: Option<&str>,
        pick: impl Fn(&ServerMessage) -> Option<T>,
    ) -> Result<T> {
        let deadline = Instant::now() + REPLY_TIMEOUT;
        let mut skipped = VecDeque::new();
        let outcome = loop {
            let message = match self.queued.pop_front() {
                Some(message) => message,
                None => match timeout_at(deadline, self.read()).await {
                    Ok(message) => match message {
                        Ok(message) => message,
                        Err(error) => break Err(error),
                    },
                    Err(_) => break Err(anyhow!("the core did not answer in time")),
                },
            };
            if let Some(found) = pick(&message) {
                break Ok(found);
            }
            if let ServerMessage::Error {
                message: text,
                request_id: Some(id),
                ..
            } = &message
            {
                if Some(id.as_str()) == request_id {
                    break Err(anyhow!("the core refused the request: {text}"));
                }
            }
            skipped.push_back(message);
        };
        skipped.append(&mut self.queued);
        self.queued = skipped;
        outcome
    }
}

fn open_frame(request_id: &str, session_id: &str, cols: u16, rows: u16) -> Value {
    json!({"type": "agent.terminal.open", "requestId": request_id, "sessionId": session_id,
           "providerId": TERMINAL_PROVIDER, "viewId": request_id, "cols": cols, "rows": rows})
}

fn acquire_frame(request_id: &str, session_id: &str, workspace_id: &str, channel: &str) -> Value {
    json!({"type": "agent.control.acquire", "requestId": request_id, "sessionId": session_id,
           "workspaceId": workspace_id, "agentId": TERMINAL_PROVIDER, "channel": channel,
           "ifUnowned": true})
}

fn input_frame(terminal_id: &str, generation: u64, data: &str) -> Value {
    json!({"type": "terminal.input", "terminalId": terminal_id, "data": data, "generation": generation})
}

fn resize_frame(terminal_id: &str, generation: u64, cols: u16, rows: u16) -> Value {
    json!({"type": "terminal.resize", "terminalId": terminal_id, "cols": cols, "rows": rows,
           "generation": generation})
}

#[cfg(test)]
mod tests {
    use super::*;
    use perch_core::protocol::ClientMessage;

    #[test]
    fn frames_match_the_core_protocol() {
        for frame in [
            json!({"type": "project.list", "requestId": "r"}),
            json!({"type": "session.list"}),
            json!({"type": "session.create", "cwd": null}),
            json!({"type": "session.create", "cwd": "/tmp"}),
            open_frame("r", "s", 80, 24),
            acquire_frame("r", "s", "w", "input"),
            acquire_frame("r", "s", "w", "resize"),
            input_frame("t", 1, "echo hi\n"),
            resize_frame("t", 1, 100, 30),
            json!({"type": "agent.terminal.release", "sessionId": "s",
                   "providerId": TERMINAL_PROVIDER, "viewId": "r"}),
        ] {
            serde_json::from_value::<ClientMessage>(frame.clone())
                .unwrap_or_else(|e| panic!("{frame}: {e}"));
        }
        // Taking control must never steal it from another view.
        assert!(matches!(
            serde_json::from_value::<ClientMessage>(acquire_frame("r", "s", "w", "input")).unwrap(),
            ClientMessage::AgentControlAcquire {
                if_unowned: true,
                ..
            }
        ));
    }

    #[test]
    fn base_urls_are_loopback_only() {
        assert_eq!(
            split_base_url("http://127.0.0.1:7788").unwrap(),
            ("127.0.0.1:7788".into(), "/".into())
        );
        assert_eq!(
            split_base_url("http://localhost:1/perch").unwrap(),
            ("localhost:1".into(), "/perch/".into())
        );
        assert!(split_base_url("https://127.0.0.1:1/").is_err());
        assert!(split_base_url("http://example.com:80/").is_err());
        assert!(Core::with_token("http://127.0.0.1:1/", "bad token").is_err());
    }
}

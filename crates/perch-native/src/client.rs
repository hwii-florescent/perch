//! Client for a running perch-core: sign in with the local UI credential, follow projects and
//! sessions live, start sessions, and stream a terminal over the core's `/ws` socket. No GPUI
//! types live here.
//!
//! Remote computers need no connection of their own: the core's hub proxies them over this one
//! socket, so requests name a `hostId` and sessions, projects and host states come back tagged
//! with it. The client never reaches a remote computer, and never runs anything, itself.
//!
//! A session's shell is the `terminal` provider's agent terminal: that is what makes it a listed
//! session, and input and size go through the leases `open_terminal` takes.
//!
//! Frames the core sends are parsed into `perch_core::protocol::ServerMessage`. `ClientMessage`
//! only derives `Deserialize`, so outgoing frames are built as JSON; `frames_match_the_core_protocol`
//! checks each one against the real type.

use crate::sidebar::{Heard, Model, Request, State, LOCAL};
use anyhow::{anyhow, bail, Context, Result};
use futures::channel::mpsc::{UnboundedReceiver, UnboundedSender};
use futures::{SinkExt, StreamExt};
use perch_core::agent_fleet::TERMINAL_PROVIDER;
use perch_core::protocol::{AgentLifecycleStatus, ProjectSummary, ServerMessage, SessionSummary};
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
/// What a request that outwaited the core says.
const NO_ANSWER: &str = "the core did not answer in time";
/// What an error from the core starts with when the core read the request and said no.
const REFUSED: &str = "the core refused the request: ";

/// The most the core takes for one uploaded file.
pub const MAX_UPLOAD_BYTES: u64 = 1 << 30;
/// An upload to another computer is staged and then copied; the core allows it an hour.
const UPLOAD_WAIT: Duration = Duration::from_secs(3700);

/// `text` for a URL query: unreserved characters stay, every other byte is `%XX`.
fn percent_encode(text: &str) -> String {
    text.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

/// Whether the core itself said no to a request, as against a connection that could not be made,
/// dropped, or went unanswered: only the first says anything about the session.
pub fn is_refusal(error: &anyhow::Error) -> bool {
    error.to_string().starts_with(REFUSED)
}

/// A prepared Context Bridge packet and the agents it could go to.
#[derive(Debug, Clone)]
pub struct ContextPreview {
    pub packet: perch_core::context_bridge::ContextPacket,
    pub agents: Vec<perch_core::context_bridge::ContextAgent>,
}

fn request_id_of(frame: &Value) -> Result<String> {
    frame["requestId"]
        .as_str()
        .map(str::to_owned)
        .ok_or_else(|| anyhow!("the request has no id"))
}

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

    /// The core's address as the browser UI uses it: `http://host:port/base/`.
    pub fn base_url(&self) -> String {
        format!("http://{}{}", self.authority, self.base_path)
    }

    /// Prepare a Context Bridge packet from a `context.preview` frame (`Capture::preview_request`)
    /// on a connection of its own, so the terminal's connection and its leases are untouched.
    /// Takes no lease and sends nothing to a terminal.
    pub async fn context_preview(&self, frame: Value) -> Result<ContextPreview> {
        let id = request_id_of(&frame)?;
        let mut connection = self.connect().await?;
        connection.send(frame).await?;
        let reply = connection
            .reply(Some(&id), |m| match m {
                ServerMessage::ContextPreviewResult {
                    request_id,
                    packet,
                    agents,
                } if *request_id == id => Some(ContextPreview {
                    packet: packet.clone(),
                    agents: agents.clone(),
                }),
                _ => None,
            })
            .await;
        reply.map_err(|error| match error.to_string() {
            text if text == NO_ANSWER => {
                anyhow!("Context preparation timed out. Try again when connected.")
            }
            _ => error,
        })
    }

    /// Send a `context.send` frame (`Capture::send_request`) once, on a connection of its own.
    /// Never repeated here: a send the core did not confirm in time, or one whose connection
    /// dropped, says so and leaves the user to inspect the agent.
    pub async fn context_send(&self, frame: Value) -> Result<()> {
        let id = request_id_of(&frame)?;
        let target = frame["targetSessionId"]
            .as_str()
            .unwrap_or_default()
            .to_owned();
        let mut connection = self.connect().await?;
        connection.send(frame).await?;
        let result = connection
            .reply(Some(&id), |m| match m {
                ServerMessage::AgentUiResult {
                    request_id,
                    session_id,
                    accepted,
                    ..
                } if *request_id == id && *session_id == target => Some(*accepted),
                _ => None,
            })
            .await;
        match result {
            Ok(true) => Ok(()),
            Ok(false) => {
                bail!("The agent did not accept the message. Inspect the CLI before sending again")
            }
            Err(error) => {
                let text = error.to_string();
                if text == NO_ANSWER {
                    bail!(crate::terminal::context::UNCONFIRMED)
                } else if text.starts_with(REFUSED) {
                    Err(error)
                } else {
                    bail!(crate::terminal::context::DROPPED)
                }
            }
        }
    }

    /// `POST {base}upload`: the file at `path` is staged by the core under its uploads folder, or,
    /// with `host_id` (a computer reached over SSH, which needs `upload.scp.v1`), copied there
    /// with SCP. Returns the file's path on the machine the terminal runs on. The core checks
    /// that the session is on that host and refuses anything else; nothing falls back to a local
    /// copy.
    pub async fn upload(
        &self,
        session_id: &str,
        host_id: Option<&str>,
        path: &std::path::Path,
    ) -> Result<String> {
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| anyhow!("{} has no name that can be sent", path.display()))?;
        let file = tokio::fs::File::open(path)
            .await
            .with_context(|| format!("could not read {name}"))?;
        let meta = file.metadata().await?;
        if !meta.is_file() {
            bail!("{name} is not a file; drop files, not folders");
        }
        if meta.len() == 0 {
            bail!("{name} is empty");
        }
        if meta.len() > MAX_UPLOAD_BYTES {
            bail!("{name} is larger than 1 GiB");
        }
        let mut target = format!(
            "upload?sessionId={}&name={}",
            percent_encode(session_id),
            percent_encode(name)
        );
        if let Some(host) = host_id {
            target += &format!("&hostId={}&scp=1", percent_encode(host));
        }
        self.post(
            &target,
            "application/octet-stream",
            meta.len(),
            file,
            UPLOAD_WAIT,
        )
        .await
    }

    /// `POST {base}clipboard-image`: the core stages an image under its own clipboard folder and
    /// answers with its path. This computer only; the core stages nothing on another.
    pub async fn stage_clipboard_image(&self, extension: &str, bytes: &[u8]) -> Result<String> {
        let target = format!("clipboard-image?ext={}", percent_encode(extension));
        let mime = format!("image/{extension}");
        self.post(&target, &mime, bytes.len() as u64, bytes, REPLY_TIMEOUT)
            .await
    }

    /// One HTTP/1.1 POST of `length` bytes read from `body`, answered with the `path` of the
    /// core's JSON reply. The core's reason is kept when it says no.
    async fn post(
        &self,
        target: &str,
        content_type: &str,
        length: u64,
        mut body: impl tokio::io::AsyncRead + Unpin,
        wait: Duration,
    ) -> Result<String> {
        let mut stream = TcpStream::connect(&self.authority)
            .await
            .with_context(|| format!("could not reach the core at {}", self.authority))?;
        let head = format!(
            "POST {}{target} HTTP/1.1\r\nHost: {}\r\nAuthorization: Bearer {}\r\nContent-Type: {content_type}\r\nContent-Length: {length}\r\nConnection: close\r\n\r\n",
            self.base_path, self.authority, self.token
        );
        let exchange = async {
            stream.write_all(head.as_bytes()).await?;
            // The core may answer (and close) before it has read everything, as it does for a
            // refusal; what it said is worth more than the broken pipe.
            let sent = tokio::io::copy(&mut body, &mut stream).await;
            let mut response = Vec::new();
            let _ = stream.read_to_end(&mut response).await;
            Ok::<_, anyhow::Error>((sent, response))
        };
        let (sent, response) = tokio::time::timeout(wait, exchange)
            .await
            .map_err(|_| anyhow!(NO_ANSWER))??;
        let response = String::from_utf8_lossy(&response);
        let Some((head, text)) = response.split_once("\r\n\r\n") else {
            sent.context("the upload was cut off")?;
            bail!("the core sent no answer");
        };
        let status = head.split_whitespace().nth(1).unwrap_or_default();
        if status != "200" {
            let said: String = text.trim().chars().take(300).collect();
            bail!(
                "the core refused the upload ({status}){}",
                if said.is_empty() {
                    String::new()
                } else {
                    format!(": {said}")
                }
            );
        }
        // ponytail: the core answers with a length; a chunked reply would need decoding here.
        let reply: Value =
            serde_json::from_str(text.trim()).context("the core's answer is not JSON")?;
        reply["path"]
            .as_str()
            .map(str::to_owned)
            .ok_or_else(|| anyhow!("the core returned no path"))
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
    /// The provider whose terminal this is; the controls and the release name it.
    provider: String,
    /// Names this attachment to the core; the core requires it to equal the open request's id.
    view_id: String,
    /// The generations of the input and resize leases this connection holds. The core accepts
    /// typing and resizing only from the holder; `None` means another view holds it.
    input: Option<u64>,
    resize: Option<u64>,
    pub workspace_id: String,
    /// The agent's lifecycle as of the last broadcast this terminal followed.
    pub status: AgentLifecycleStatus,
}

impl Terminal {
    /// Follow a lifecycle status the core broadcast: a lease whose generation the status no
    /// longer names was taken by another view, and this connection no longer holds it. Returns
    /// whether either lease was lost.
    pub fn follow_owners(&mut self, status: &AgentLifecycleStatus) -> bool {
        let key = &status.key;
        if key.session_id != self.session_id || key.agent_id != self.provider {
            return false;
        }
        if status.revision >= self.status.revision {
            self.status = status.clone();
        }
        let mut lost = false;
        for (mine, owner) in [
            (&mut self.input, &status.input_owner),
            (&mut self.resize, &status.resize_owner),
        ] {
            if mine.is_some() && *mine != owner.as_ref().map(|o| o.generation) {
                *mine = None;
                lost = true;
            }
        }
        lost
    }

    /// This connection holds the lease that lets it type.
    pub fn owns_input(&self) -> bool {
        self.input.is_some()
    }

    /// This connection holds the lease that lets it size the shell; the core drops a resize
    /// from any other.
    pub fn owns_resize(&self) -> bool {
        self.resize.is_some()
    }
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

    /// A new session in `cwd` (a project's folder on that computer), or in Chats when `None`,
    /// on `host_id` (`None`: the core's own computer). Returns its id.
    pub async fn create_session(
        &mut self,
        cwd: Option<&str>,
        host_id: Option<&str>,
    ) -> Result<String> {
        self.send(create_frame(cwd, host_id)).await?;
        self.reply(None, |m| match m {
            ServerMessage::SessionCreated { session_id } => Some(session_id.clone()),
            _ => None,
        })
        .await
    }

    /// Ask the core for something; the answer arrives through [`Connection::next`].
    pub async fn request(&mut self, request: &Request) -> Result<()> {
        let id = self.request_id();
        self.send(request_frame(&id, request)).await
    }

    /// Attach the shell of a session (starting it if needed) and take control of its input
    /// and size, unless another view (the desktop app, say) already holds them.
    pub async fn open_terminal(
        &mut self,
        session_id: &str,
        cols: u16,
        rows: u16,
    ) -> Result<Terminal> {
        self.open_terminal_as(session_id, TERMINAL_PROVIDER, cols, rows)
            .await
    }

    /// [`Self::open_terminal`] for the terminal of any provider the session runs.
    pub async fn open_terminal_as(
        &mut self,
        session_id: &str,
        provider: &str,
        cols: u16,
        rows: u16,
    ) -> Result<Terminal> {
        let id = self.request_id();
        self.send(open_frame(&id, session_id, provider, cols, rows))
            .await?;
        let (terminal_id, replay, status) = self
            .reply(Some(&id), |m| match m {
                ServerMessage::AgentTerminalOpened {
                    request_id,
                    terminal_id,
                    status,
                    replay,
                } if *request_id == id => {
                    Some((terminal_id.clone(), replay.clone(), status.clone()))
                }
                _ => None,
            })
            .await?;
        let workspace_id = status.key.workspace_id.clone();
        let input = self
            .acquire(session_id, provider, &workspace_id, "input", true)
            .await?;
        let resize = self
            .acquire(session_id, provider, &workspace_id, "resize", true)
            .await?;
        Ok(Terminal {
            id: terminal_id,
            replay,
            session_id: session_id.to_string(),
            provider: provider.to_string(),
            view_id: id,
            input,
            resize,
            workspace_id,
            status,
        })
    }

    /// Take the input and size of a terminal another view holds, as the web's "Take control"
    /// does: the input first, then the size.
    pub async fn take_control(&mut self, terminal: &mut Terminal) -> Result<()> {
        terminal.input = self
            .acquire(
                &terminal.session_id,
                &terminal.provider,
                &terminal.workspace_id,
                "input",
                false,
            )
            .await?;
        terminal.resize = self
            .acquire(
                &terminal.session_id,
                &terminal.provider,
                &terminal.workspace_id,
                "resize",
                false,
            )
            .await?;
        Ok(())
    }

    /// End the shell. Only the view holding the input lease may.
    pub async fn terminal_kill(&mut self, terminal: &Terminal) -> Result<()> {
        if terminal.input.is_none() {
            bail!("another view controls this terminal's input");
        }
        self.send(json!({"type": "terminal.kill", "terminalId": terminal.id}))
            .await
    }

    /// Ask the core to end a session and delete it. The core answers every connection with
    /// `session.deleted`, or this one with an error (it refuses while another view controls the
    /// session), so the caller waits for one of the two.
    pub async fn delete_session(&mut self, session_id: &str) -> Result<()> {
        self.send(delete_frame(session_id)).await
    }

    async fn acquire(
        &mut self,
        session_id: &str,
        provider: &str,
        workspace_id: &str,
        channel: &str,
        if_unowned: bool,
    ) -> Result<Option<u64>> {
        let id = self.request_id();
        self.send(acquire_frame_as(
            &id,
            session_id,
            provider,
            workspace_id,
            channel,
            if_unowned,
        ))
        .await?;
        self.reply(Some(&id), |m| match m {
            ServerMessage::AgentControl {
                request_id, lease, ..
            } if *request_id == id => Some(lease.as_ref().map(|lease| lease.generation)),
            _ => None,
        })
        .await
    }

    /// Type into a terminal: under the input lease when this connection holds it, otherwise, when
    /// the core allows `shared` typing (it advertises `terminal.sharedInput`), as a view that
    /// watches the terminal. The core refuses shared input from a connection that is not
    /// watching it.
    pub async fn terminal_input(
        &mut self,
        terminal: &Terminal,
        data: &str,
        shared: bool,
    ) -> Result<()> {
        match terminal.input {
            Some(generation) => self.send(input_frame(&terminal.id, generation, data)).await,
            None if shared => self.send(shared_input_frame(&terminal.id, data)).await,
            None => bail!("another view controls this terminal's input"),
        }
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
        self.send(release_frame(
            &terminal.session_id,
            &terminal.provider,
            &terminal.view_id,
        ))
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
                    Err(_) => break Err(anyhow!(NO_ANSWER)),
                },
            };
            if let Some(found) = pick(&message) {
                break Ok(found);
            }
            // The core answers some refusals (a session in a folder it was not given) with an
            // error that names no request; a call that waits on no id takes those as its answer.
            if let ServerMessage::Error {
                message: text,
                request_id: id,
                ..
            } = &message
            {
                if id.as_deref() == request_id {
                    break Err(anyhow!("{REFUSED}{text}"));
                }
            }
            skipped.push_back(message);
        };
        skipped.append(&mut self.queued);
        self.queued = skipped;
        outcome
    }
}

/// What the window asks of the core.
#[derive(Debug)]
pub enum Command {
    /// Start a session running `provider` in `cwd` on `host_id`.
    Launch {
        host_id: String,
        cwd: Option<String>,
        provider: String,
    },
    /// List plain terminals started inside a project.
    ShowTerminals(bool),
    /// The window now shows this session: the core marks it read, and keeps doing so after a
    /// reconnect.
    View(String),
    /// Whether the window is the one the person is looking at, which decides if a sound plays.
    WindowActive(bool),
    /// Turn a configured remote computer on or off, as its Settings switch does.
    SetHostEnabled { host_id: String, enabled: bool },
    /// Give a session a new title, as the sidebar's rename does.
    Rename { session_id: String, title: String },
    /// Change settings: the `settings.update` patch, with only the fields that changed.
    UpdateSettings(Value),
}

/// What the window learns.
#[derive(Debug)]
pub enum Update {
    /// The sidebar changed.
    Model(Model),
    /// A launch the user asked for produced this session.
    Launched {
        host_id: String,
        session_id: String,
        provider: String,
    },
    LaunchFailed(String),
    /// A session was asked for on another computer. Nothing says which session is the one just
    /// made (see [`Launch`]), so none is opened; the core lists it once it has activity.
    Requested {
        host_id: String,
    },
    /// A session finished or needs you and the person should hear it.
    Alert(Heard),
}

/// A launch on the core's own computer, waiting for the core to say it worked.
///
/// The core answers `session.create` with `session.created`, which names no request, and a
/// session created on a remote computer is broadcast to every viewer. A `session.created` is
/// therefore only a candidate. The provider is then started in it under this launch's own request
/// id, and the core refuses that for any session that lives on another computer, so only a session
/// this connection made on the core's own computer is ever opened. Nothing is guessed: a launch
/// that cannot be confirmed fails and opens nothing.
struct Launch {
    host_id: String,
    provider: String,
    /// The request id the provider start travels under.
    open_id: String,
    /// The candidate, once a `session.created` arrived.
    session: Option<String>,
    deadline: Instant,
}

/// What a message changes in a launch: frames to send, and how it ended, if it did.
#[derive(Default)]
struct Step {
    send: Vec<Value>,
    done: Option<Update>,
}

impl Launch {
    fn new(host_id: String, provider: String, open_id: String) -> Self {
        Self {
            host_id,
            provider,
            open_id,
            session: None,
            deadline: Instant::now() + REPLY_TIMEOUT,
        }
    }

    fn fail(message: String) -> Step {
        Step {
            done: Some(Update::LaunchFailed(message)),
            ..Step::default()
        }
    }

    fn on_message(&mut self, message: &ServerMessage) -> Step {
        match (&self.session, message) {
            (None, ServerMessage::SessionCreated { session_id }) => {
                self.session = Some(session_id.clone());
                Step {
                    send: vec![open_frame(
                        &self.open_id,
                        session_id,
                        &self.provider,
                        80,
                        24,
                    )],
                    done: None,
                }
            }
            // The core refuses some creates (a folder it was not given) with an error that
            // names no request.
            (
                None,
                ServerMessage::Error {
                    message,
                    request_id: None,
                    ..
                },
            ) => Self::fail(format!("the core refused the request: {message}")),
            (
                Some(session_id),
                ServerMessage::AgentTerminalOpened {
                    request_id, status, ..
                },
            ) if *request_id == self.open_id => {
                if status.key.session_id != *session_id {
                    return Self::fail("the core started a different session".into());
                }
                Step {
                    send: vec![release_frame(session_id, &self.provider, &self.open_id)],
                    done: Some(Update::Launched {
                        host_id: self.host_id.clone(),
                        session_id: session_id.clone(),
                        provider: self.provider.clone(),
                    }),
                }
            }
            (
                Some(_),
                ServerMessage::Error {
                    message,
                    request_id: Some(id),
                    ..
                },
            ) if *id == self.open_id => {
                Self::fail(format!("the core could not start it: {message}"))
            }
            _ => Step::default(),
        }
    }
}

/// Follow the core until the window is gone: show what it says, and after a drop find it again
/// with `locate` (a restarted core has a new port and token) every `retry`. A launch is sent
/// once; it is never repeated after a reconnect, and a drop shows state as unknown rather than
/// as exited.
pub async fn follow(
    mut locate: impl FnMut() -> Result<Core>,
    mut commands: UnboundedReceiver<Command>,
    updates: UnboundedSender<Update>,
    retry: Duration,
) {
    let mut state = State::default();
    let mut shown = None;
    loop {
        // ponytail: a fixed delay between attempts; back off if a dead core ever gets hammered.
        let ended = attempt(&mut locate, &mut state, &mut shown, &mut commands, &updates).await;
        let Err(error) = ended else { return };
        state.disconnect(Some(format!("{error:#}")));
        if !publish(&state, &mut shown, &updates) {
            return;
        }
        tokio::time::sleep(retry).await;
    }
}

/// Find the core, connect and follow it: `Ok` when the window closed, `Err` for why it is not
/// being followed (not found, refused, or dropped).
async fn attempt(
    locate: &mut impl FnMut() -> Result<Core>,
    state: &mut State,
    shown: &mut Option<Model>,
    commands: &mut UnboundedReceiver<Command>,
    updates: &UnboundedSender<Update>,
) -> Result<()> {
    let core = locate()?;
    let connection = core.connect().await?;
    state.core_url = Some(core.base_url());
    let mut launch = None;
    let ended = live(connection, state, shown, commands, updates, &mut launch).await;
    if launch.is_some() && ended.is_err() {
        // The core may or may not have made the session; it is never started again.
        let lost = Update::LaunchFailed("the connection to the core dropped".into());
        let _ = updates.unbounded_send(lost);
    }
    ended
}

/// Send the model if it changed. False once the window is gone.
fn publish(state: &State, shown: &mut Option<Model>, updates: &UnboundedSender<Update>) -> bool {
    let model = state.model();
    if shown.as_ref() == Some(&model) {
        return !updates.is_closed();
    }
    *shown = Some(model.clone());
    updates.unbounded_send(Update::Model(model)).is_ok()
}

/// One connection's life: `Ok` when the window closed, `Err` when the socket dropped. Requests
/// never wait for their answer here: a launch is a small state machine fed by the same frames
/// as everything else, so the sidebar keeps following the core while one is in flight.
async fn live(
    mut connection: Connection,
    state: &mut State,
    shown: &mut Option<Model>,
    commands: &mut UnboundedReceiver<Command>,
    updates: &UnboundedSender<Update>,
    launch: &mut Option<Launch>,
) -> Result<()> {
    state.connect();
    connection.send(json!({"type": "session.list"})).await?;
    connection.request(&Request::Projects(LOCAL.into())).await?;
    connection
        .request(&Request::Providers(LOCAL.into()))
        .await?;
    // `keys.json` rides on the mods state.
    connection.request(&Request::Mods).await?;
    // What the window was showing is viewed again, so the core still counts it as read.
    if let Some(id) = state.viewing() {
        connection.send(subscribe_frame(id)).await?;
    }
    loop {
        let deadline = launch.as_ref().map(|l| l.deadline);
        let expired = async {
            match deadline {
                Some(at) => tokio::time::sleep_until(at).await,
                None => std::future::pending().await,
            }
        };
        tokio::select! {
            message = connection.next() => {
                let message = message?;
                if let Some(step) = launch.as_mut().map(|l| l.on_message(&message)) {
                    for frame in step.send {
                        connection.send(frame).await?;
                    }
                    if let Some(update) = step.done {
                        *launch = None;
                        if updates.unbounded_send(update).is_err() {
                            return Ok(());
                        }
                    }
                }
                for ask in state.apply(&message) {
                    connection.request(&ask).await?;
                }
                for alert in state.take_alerts() {
                    if updates.unbounded_send(Update::Alert(alert)).is_err() {
                        return Ok(());
                    }
                }
            }
            command = commands.next() => match command {
                None => return Ok(()),
                Some(Command::ShowTerminals(show)) => state.show_terminals = show,
                Some(Command::WindowActive(active)) => state.set_window_active(active),
                Some(Command::View(id)) => {
                    connection.send(subscribe_frame(&id)).await?;
                    state.view(&id);
                }
                Some(Command::Rename { session_id, title }) => {
                    connection.send(rename_frame(&session_id, &title)).await?;
                }
                Some(Command::UpdateSettings(patch)) => {
                    connection.send(settings_frame(patch)).await?;
                }
                Some(Command::SetHostEnabled { host_id, enabled }) => {
                    if let Some(frame) = state.host_enabled_frame(&host_id, enabled) {
                        connection.send(frame).await?;
                    }
                }
                Some(Command::Launch { host_id, cwd, provider }) => {
                    let update = if host_id != LOCAL {
                        connection.send(create_frame(cwd.as_deref(), Some(&host_id))).await?;
                        Update::Requested { host_id }
                    } else if launch.is_some() {
                        Update::LaunchFailed("a session is already starting".into())
                    } else {
                        connection.send(create_frame(cwd.as_deref(), None)).await?;
                        let open_id = connection.request_id();
                        *launch = Some(Launch::new(host_id, provider, open_id));
                        // Nothing to tell the window yet.
                        continue;
                    };
                    if updates.unbounded_send(update).is_err() {
                        return Ok(());
                    }
                }
            },
            _ = expired => {
                *launch = None;
                let late = Update::LaunchFailed("the core did not answer in time".into());
                if updates.unbounded_send(late).is_err() {
                    return Ok(());
                }
            }
        }
        if !publish(state, shown, updates) {
            return Ok(());
        }
    }
}

fn subscribe_frame(session_id: &str) -> Value {
    json!({"type": "session.subscribe", "sessionId": session_id})
}

fn rename_frame(session_id: &str, title: &str) -> Value {
    json!({"type": "session.rename", "sessionId": session_id, "title": title})
}

fn delete_frame(session_id: &str) -> Value {
    json!({"type": "session.delete", "sessionId": session_id})
}

fn settings_frame(patch: Value) -> Value {
    json!({"type": "settings.update", "patch": patch})
}

fn create_frame(cwd: Option<&str>, host_id: Option<&str>) -> Value {
    json!({"type": "session.create", "cwd": cwd, "hostId": host_id})
}

fn open_frame(request_id: &str, session_id: &str, provider: &str, cols: u16, rows: u16) -> Value {
    json!({"type": "agent.terminal.open", "requestId": request_id, "sessionId": session_id,
           "providerId": provider, "viewId": request_id, "cols": cols, "rows": rows})
}

fn release_frame(session_id: &str, provider: &str, view_id: &str) -> Value {
    json!({"type": "agent.terminal.release", "sessionId": session_id,
           "providerId": provider, "viewId": view_id})
}

/// `hostId` is left out for the core's own computer, as the web client does.
fn request_frame(request_id: &str, request: &Request) -> Value {
    let host = |host: &str| (host != LOCAL).then(|| host.to_string());
    match request {
        Request::Mods => json!({"type": "mods.list", "requestId": request_id}),
        Request::Attention => json!({"type": "attention.list"}),
        Request::Projects(h) => {
            json!({"type": "project.list", "requestId": request_id, "hostId": host(h)})
        }
        Request::Providers(h) => {
            json!({"type": "agent.manifest.list", "requestId": request_id, "hostId": host(h)})
        }
        Request::Workspaces(h) => {
            json!({"type": "workspace.snapshot", "requestId": request_id, "hostId": host(h)})
        }
    }
}

#[cfg(test)]
fn acquire_frame(request_id: &str, session_id: &str, workspace_id: &str, channel: &str) -> Value {
    acquire_frame_as(
        request_id,
        session_id,
        TERMINAL_PROVIDER,
        workspace_id,
        channel,
        true,
    )
}

fn acquire_frame_as(
    request_id: &str,
    session_id: &str,
    provider: &str,
    workspace_id: &str,
    channel: &str,
    if_unowned: bool,
) -> Value {
    json!({"type": "agent.control.acquire", "requestId": request_id, "sessionId": session_id,
           "workspaceId": workspace_id, "agentId": provider, "channel": channel,
           "ifUnowned": if_unowned})
}

fn input_frame(terminal_id: &str, generation: u64, data: &str) -> Value {
    json!({"type": "terminal.input", "terminalId": terminal_id, "data": data, "generation": generation})
}

fn shared_input_frame(terminal_id: &str, data: &str) -> Value {
    json!({"type": "terminal.input", "terminalId": terminal_id, "data": data, "shared": true})
}

fn resize_frame(terminal_id: &str, generation: u64, cols: u16, rows: u16) -> Value {
    json!({"type": "terminal.resize", "terminalId": terminal_id, "cols": cols, "rows": rows,
           "generation": generation})
}

#[cfg(test)]
mod tests {
    use super::*;
    use perch_core::protocol::ClientMessage;

    /// A Context Bridge preview and send, as the terminal's capture builds them.
    fn context_frames() -> (Value, Value) {
        use crate::terminal::context::{Capture, Place, CAPABILITY};
        let place = Place {
            capabilities: vec![CAPABILITY.into()],
            workspace_id: Some("w".into()),
            local: true,
            ..Default::default()
        };
        let mut capture = Capture::new(&place, "s", "output", "op".into()).unwrap();
        (
            capture.preview_request("r", "why?").unwrap(),
            capture
                .send_request("r2", "why?", "digest", "agent")
                .unwrap(),
        )
    }

    #[test]
    fn frames_match_the_core_protocol() {
        for frame in [
            json!({"type": "project.list", "requestId": "r"}),
            json!({"type": "session.list"}),
            create_frame(None, None),
            create_frame(Some("/tmp"), Some("build-box")),
            // The terminal and every agent the core lists start the same way.
            open_frame("r", "s", TERMINAL_PROVIDER, 80, 24),
            open_frame("r", "s", "claude", 80, 24),
            release_frame("s", "claude", "r"),
            request_frame("r", &Request::Attention),
            request_frame("r", &Request::Mods),
            rename_frame("s", "a new title"),
            delete_frame("s"),
            settings_frame(json!({"terminalScrollback": 5000})),
            settings_frame(json!({"terminalLoginShell": true, "droppedPathDoubleQuotes": false})),
            request_frame("r", &Request::Projects(LOCAL.into())),
            request_frame("r", &Request::Projects("build-box".into())),
            request_frame("r", &Request::Providers("build-box".into())),
            request_frame("r", &Request::Workspaces(LOCAL.into())),
            request_frame("r", &Request::Workspaces("build-box".into())),
            subscribe_frame("s"),
            acquire_frame("r", "s", "w", "input"),
            acquire_frame("r", "s", "w", "resize"),
            input_frame("t", 1, "echo hi\n"),
            resize_frame("t", 1, 100, 30),
            release_frame("s", TERMINAL_PROVIDER, "r"),
            context_frames().0,
            context_frames().1,
        ] {
            serde_json::from_value::<ClientMessage>(frame.clone())
                .unwrap_or_else(|e| panic!("{frame}: {e}"));
        }
        // Starting an agent names its provider and, on another computer, that computer.
        assert!(matches!(
            serde_json::from_value::<ClientMessage>(open_frame("r", "s", "claude", 80, 24)).unwrap(),
            ClientMessage::AgentTerminalOpen { provider_id, .. } if provider_id == "claude"
        ));
        assert!(matches!(
            serde_json::from_value::<ClientMessage>(create_frame(Some("/p"), Some("h"))).unwrap(),
            ClientMessage::SessionCreate { cwd: Some(_), host_id: Some(h) } if h == "h"
        ));
        assert_eq!(
            request_frame("r", &Request::Projects(LOCAL.into()))["hostId"],
            Value::Null
        );
        // Viewing a session is the request the web makes, not a resume (which would mint a
        // session for an id the core does not own).
        assert!(matches!(
            serde_json::from_value::<ClientMessage>(subscribe_frame("s")).unwrap(),
            ClientMessage::SessionSubscribe { session_id } if session_id == "s"
        ));
        // Taking control must never steal it from another view.
        assert!(matches!(
            serde_json::from_value::<ClientMessage>(acquire_frame("r", "s", "w", "input")).unwrap(),
            ClientMessage::AgentControlAcquire {
                if_unowned: true,
                ..
            }
        ));
    }

    /// A stand-in core: for each accepted connection it sends `frames`, records what the client
    /// sent, then drops the connection.
    async fn fake_core(
        listener: tokio::net::TcpListener,
        rounds: Vec<Vec<Value>>,
        gone: tokio::sync::mpsc::UnboundedSender<Vec<String>>,
        hold: std::sync::Arc<tokio::sync::Notify>,
    ) {
        for frames in rounds {
            let (stream, _) = listener.accept().await.unwrap();
            let mut socket = tokio_tungstenite::accept_async(stream).await.unwrap();
            for frame in frames {
                socket.send(Message::text(frame.to_string())).await.unwrap();
            }
            // Let the client's opening requests arrive, then drop when told to.
            let mut received = Vec::new();
            let release = hold.notified();
            tokio::pin!(release);
            loop {
                tokio::select! {
                    // The client opens with three requests; wait for them all.
                    _ = &mut release, if received.len() >= 3 => break,
                    Some(Ok(Message::Text(text))) = socket.next() => received.push(text.to_string()),
                }
            }
            drop(socket);
            gone.send(received).unwrap();
        }
    }

    fn session_frame(id: &str, extra: Value) -> Value {
        let mut session = json!({"id": id, "title": id, "cwd": "/work", "createdAt": 0,
                                 "status": "idle", "hostId": "local", "projectId": "p",
                                 "cliProviderId": "claude"});
        for (key, value) in extra.as_object().unwrap() {
            session[key] = value.clone();
        }
        session
    }

    /// The model after `want` holds, or a failure showing the last one.
    async fn model_where(
        updates: &mut UnboundedReceiver<Update>,
        want: impl Fn(&Model) -> bool,
    ) -> Model {
        let mut last = None;
        let wait = async {
            loop {
                if let Some(Update::Model(model)) = updates.next().await {
                    if want(&model) {
                        return model;
                    }
                    last = Some(model);
                }
            }
        };
        match tokio::time::timeout(Duration::from_secs(10), wait).await {
            Ok(model) => model,
            Err(_) => panic!("no matching model; last was {last:?}"),
        }
    }

    #[tokio::test]
    async fn follows_the_core_across_a_drop() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let core = Core::with_token(
            &format!("http://{}/", listener.local_addr().unwrap()),
            "token",
        )
        .unwrap();
        let project = json!({"type": "project.list", "requestId": "r", "hostId": "local",
                             "snapshotEpoch": "e", "snapshotRevision": 1, "projects": [
                             {"id": "p", "hostId": "local", "name": "Work", "path": "/work",
                              "favorite": false, "createdAt": 0, "updatedAt": 0}]});
        let list = |blocked| {
            json!({"type": "session.list",
                   "sessions": [session_frame("s1", json!({"blocked": blocked}))]})
        };
        let (gone_tx, mut gone_rx) = tokio::sync::mpsc::unbounded_channel();
        let hold = std::sync::Arc::new(tokio::sync::Notify::new());
        tokio::spawn(fake_core(
            listener,
            vec![
                vec![project.clone(), list(true)],
                vec![project, list(false)],
            ],
            gone_tx,
            hold.clone(),
        ));

        let (_commands_tx, commands) = futures::channel::mpsc::unbounded();
        let (updates_tx, mut updates) = futures::channel::mpsc::unbounded();
        let following = tokio::spawn(follow(
            move || Ok(core.clone()),
            commands,
            updates_tx,
            Duration::from_millis(50),
        ));

        let row = |model: &Model| {
            model.hosts[0]
                .projects
                .first()
                .and_then(|p| p.sessions.first().cloned())
        };
        let model = model_where(&mut updates, |m| {
            row(m).is_some_and(|s| s.attention == Some(crate::sidebar::Attention::NeedsYou))
        })
        .await;
        assert!(model.connected);

        // The core goes away: the row stays, and claims nothing.
        hold.notify_one();
        let model = model_where(&mut updates, |m| !m.connected).await;
        assert_eq!(row(&model).unwrap().attention, None);
        assert_eq!(model.hosts[0].state, "unknown");

        // It comes back with a different answer, and the client asks again, from scratch.
        let model = model_where(&mut updates, |m| {
            m.connected
                && row(m).is_some_and(|s| s.attention == Some(crate::sidebar::Attention::Idle))
        })
        .await;
        assert_eq!(model.needs_you, 0);

        hold.notify_one();
        let first = gone_rx.recv().await.unwrap();
        let second = gone_rx.recv().await.unwrap();
        for received in [&first, &second] {
            let types: Vec<String> = received
                .iter()
                .map(|text| serde_json::from_str::<Value>(text).unwrap()["type"].to_string())
                .collect();
            assert!(types.contains(&"\"session.list\"".to_string()), "{types:?}");
            assert!(types.contains(&"\"project.list\"".to_string()), "{types:?}");
            // Reconnecting never starts or attaches anything.
            assert!(
                !types
                    .iter()
                    .any(|t| t.contains("create") || t.contains("terminal")),
                "{types:?}"
            );
        }
        following.abort();
    }

    #[tokio::test]
    async fn says_why_the_core_cannot_be_followed() {
        let (_commands_tx, commands) = futures::channel::mpsc::unbounded();
        let (updates_tx, mut updates) = futures::channel::mpsc::unbounded();
        let following = tokio::spawn(follow(
            || Err(anyhow!("core.json says the core has no token")),
            commands,
            updates_tx,
            Duration::from_millis(20),
        ));
        let model = model_where(&mut updates, |m| m.offline_reason.is_some()).await;
        assert!(!model.connected);
        assert!(model.offline_reason.unwrap().contains("no token"));
        following.abort();
    }

    fn created(id: &str) -> ServerMessage {
        serde_json::from_value(json!({"type": "session.created", "sessionId": id})).unwrap()
    }

    fn opened(request_id: &str, session_id: &str) -> ServerMessage {
        serde_json::from_value(json!({
            "type": "agent.terminal.opened", "requestId": request_id, "terminalId": "t",
            "replay": "", "status": {
                "key": {"workspaceId": "w", "sessionId": session_id, "agentId": "terminal"},
                "providerId": "terminal", "resumable": false, "state": "idle", "reason": "",
                "lastTransitionMs": 0, "lastActivityMs": 0, "revision": 1,
                "transitionSequence": 1}}))
        .unwrap_or_else(|e| panic!("{e}"))
    }

    fn refused(request_id: Option<&str>, text: &str) -> ServerMessage {
        serde_json::from_value(json!({"type": "error", "message": text, "requestId": request_id}))
            .unwrap()
    }

    fn launch() -> Launch {
        Launch::new(LOCAL.into(), "terminal".into(), "open-1".into())
    }

    #[test]
    fn a_launch_confirmed_by_the_core_is_opened() {
        let mut launch = launch();
        // Nothing the core says about anything else moves it.
        assert!(launch
            .on_message(&refused(Some("other"), "no"))
            .done
            .is_none());
        let step = launch.on_message(&created("s1"));
        assert!(step.done.is_none());
        // It starts the provider in the candidate, under its own request id.
        assert_eq!(step.send, [open_frame("open-1", "s1", "terminal", 80, 24)]);
        // An answer to another request is not its answer.
        assert!(launch.on_message(&opened("other", "s1")).done.is_none());
        let step = launch.on_message(&opened("open-1", "s1"));
        assert!(matches!(
            step.done,
            Some(Update::Launched { ref host_id, ref session_id, ref provider })
                if host_id == LOCAL && session_id == "s1" && provider == "terminal"
        ));
        assert_eq!(step.send, [release_frame("s1", "terminal", "open-1")]);
    }

    #[test]
    fn a_session_another_viewer_made_is_never_opened() {
        // A session made on a remote computer is broadcast to every viewer as `session.created`.
        // Starting the provider in it is refused by the core, so the launch fails: it opens
        // nothing, and the session that really was made is never taken for this one.
        let mut launch = launch();
        launch.on_message(&created("theirs"));
        let step = launch.on_message(&refused(
            Some("open-1"),
            "persistent agent views are not supported by this remote host",
        ));
        match step.done {
            Some(Update::LaunchFailed(text)) => assert!(text.contains("remote host"), "{text}"),
            other => panic!("{other:?}"),
        }
        assert!(step.send.is_empty());

        // The core answering for a different session than the candidate is no confirmation.
        let mut launch = self::launch();
        launch.on_message(&created("s1"));
        let step = launch.on_message(&opened("open-1", "s2"));
        assert!(matches!(step.done, Some(Update::LaunchFailed(_))));
        assert!(
            step.send.is_empty(),
            "nothing is released that was not opened"
        );
    }

    #[test]
    fn a_create_the_core_refuses_fails_at_once() {
        let mut launch = launch();
        let step = launch.on_message(&refused(None, "/x is not a project in perch"));
        match step.done {
            Some(Update::LaunchFailed(text)) => assert!(text.contains("not a project"), "{text}"),
            other => panic!("{other:?}"),
        }
    }

    /// Accepts one connection, sends `frames`, and calls `on_frame` for each text frame the
    /// client sends until it hangs up.
    async fn scripted_core(
        listener: tokio::net::TcpListener,
        frames: Vec<Value>,
        mut on_frame: impl FnMut(&Value) -> Vec<Value> + Send + 'static,
    ) {
        let (stream, _) = listener.accept().await.unwrap();
        let mut socket = tokio_tungstenite::accept_async(stream).await.unwrap();
        for frame in frames {
            socket.send(Message::text(frame.to_string())).await.unwrap();
        }
        while let Some(Ok(Message::Text(text))) = socket.next().await {
            let sent: Value = serde_json::from_str(&text).unwrap();
            for frame in on_frame(&sent) {
                socket.send(Message::text(frame.to_string())).await.unwrap();
            }
        }
    }

    #[tokio::test]
    async fn a_launch_in_flight_does_not_stop_the_sidebar_following_the_core() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let core = Core::with_token(
            &format!("http://{}/", listener.local_addr().unwrap()),
            "token",
        )
        .unwrap();
        let list = |blocked| {
            json!({"type": "session.list",
                   "sessions": [session_frame("s1", json!({"blocked": blocked}))]})
        };
        // The core never answers the create; it keeps talking about everything else.
        tokio::spawn(scripted_core(listener, vec![list(true)], move |sent| {
            if sent["type"] == "session.create" {
                vec![list(false)]
            } else {
                vec![]
            }
        }));
        let (commands_tx, commands) = futures::channel::mpsc::unbounded();
        let (updates_tx, mut updates) = futures::channel::mpsc::unbounded();
        let following = tokio::spawn(follow(
            move || Ok(core.clone()),
            commands,
            updates_tx,
            Duration::from_millis(50),
        ));
        let needs = |model: &Model| model.needs_you == 1;
        model_where(&mut updates, needs).await;

        let start = |commands: &futures::channel::mpsc::UnboundedSender<Command>| {
            commands
                .unbounded_send(Command::Launch {
                    host_id: LOCAL.into(),
                    cwd: None,
                    provider: "terminal".into(),
                })
                .unwrap()
        };
        start(&commands_tx);
        // The launch waits on the core for up to REPLY_TIMEOUT; the sidebar must not.
        let begun = Instant::now();
        model_where(&mut updates, |m| m.needs_you == 0).await;
        assert!(
            begun.elapsed() < Duration::from_secs(5),
            "the follow loop stalled"
        );

        // One launch at a time: a second is refused rather than guessed at.
        start(&commands_tx);
        let wait = async {
            loop {
                if let Some(Update::LaunchFailed(text)) = updates.next().await {
                    return text;
                }
            }
        };
        let text = tokio::time::timeout(Duration::from_secs(5), wait)
            .await
            .unwrap();
        assert!(text.contains("already starting"), "{text}");
        following.abort();
    }

    #[tokio::test]
    async fn a_launch_on_another_computer_opens_nothing() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let core = Core::with_token(
            &format!("http://{}/", listener.local_addr().unwrap()),
            "token",
        )
        .unwrap();
        let (seen_tx, mut seen) = tokio::sync::mpsc::unbounded_channel();
        let hello = json!({"type": "session.list", "sessions": []});
        tokio::spawn(scripted_core(listener, vec![hello], move |sent| {
            seen_tx.send(sent.clone()).unwrap();
            if sent["type"] == "session.create" {
                // The hub's broadcast: it names no request and no computer.
                vec![json!({"type": "session.created", "sessionId": "someone-elses"})]
            } else {
                vec![]
            }
        }));
        let (commands_tx, commands) = futures::channel::mpsc::unbounded();
        let (updates_tx, mut updates) = futures::channel::mpsc::unbounded();
        let following = tokio::spawn(follow(
            move || Ok(core.clone()),
            commands,
            updates_tx,
            Duration::from_millis(50),
        ));
        model_where(&mut updates, |m| m.connected).await;
        commands_tx
            .unbounded_send(Command::Launch {
                host_id: "build-box".into(),
                cwd: Some("/work".into()),
                provider: "terminal".into(),
            })
            .unwrap();
        // The create goes out for that computer, and the window is told it was asked, not
        // handed a session.
        let create = loop {
            let sent = tokio::time::timeout(Duration::from_secs(5), seen.recv())
                .await
                .unwrap()
                .unwrap();
            if sent["type"] == "session.create" {
                break sent;
            }
        };
        assert_eq!(create["hostId"], "build-box");
        let wait = async {
            loop {
                match updates.next().await.unwrap() {
                    Update::Requested { host_id } => return host_id,
                    Update::Launched { .. } => panic!("an uncorrelated create was opened"),
                    _ => {}
                }
            }
        };
        assert_eq!(
            tokio::time::timeout(Duration::from_secs(5), wait)
                .await
                .unwrap(),
            "build-box"
        );
        // And what the core broadcast next opens nothing, and starts nothing.
        tokio::time::sleep(Duration::from_millis(300)).await;
        while let Ok(sent) = seen.try_recv() {
            assert!(
                !sent["type"].as_str().unwrap().starts_with("agent.terminal"),
                "{sent}"
            );
        }
        while let Ok(update) = updates.try_recv() {
            assert!(!matches!(update, Update::Launched { .. }), "{update:?}");
        }
        following.abort();
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

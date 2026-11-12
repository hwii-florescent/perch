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

use crate::sidebar::{Model, Request, State, LOCAL};
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
    workspace_id: String,
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

    /// A new session running `provider` (the terminal, or an agent the computer lists). The core
    /// starts the process and keeps it across this connection; nothing runs here. Only the
    /// core's own computer starts it now: the core cannot open a persistent view of a remote
    /// session, so a remote one starts when a terminal attaches to it.
    pub async fn start_session(
        &mut self,
        host_id: &str,
        cwd: Option<&str>,
        provider: &str,
    ) -> Result<String> {
        let remote = host_id != LOCAL;
        let session_id = self.create_session(cwd, remote.then_some(host_id)).await?;
        if !remote {
            let id = self.request_id();
            self.send(open_frame(&id, &session_id, provider, 80, 24))
                .await?;
            self.reply(Some(&id), |m| match m {
                ServerMessage::AgentTerminalOpened { request_id, .. } if *request_id == id => {
                    Some(())
                }
                _ => None,
            })
            .await?;
            self.send(release_frame(&session_id, provider, &id)).await?;
        }
        Ok(session_id)
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
                    Err(_) => break Err(anyhow!("the core did not answer in time")),
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
    live(connection, state, shown, commands, updates).await
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

/// One connection's life: `Ok` when the window closed, `Err` when the socket dropped.
async fn live(
    mut connection: Connection,
    state: &mut State,
    shown: &mut Option<Model>,
    commands: &mut UnboundedReceiver<Command>,
    updates: &UnboundedSender<Update>,
) -> Result<()> {
    state.connect();
    connection.send(json!({"type": "session.list"})).await?;
    connection.request(&Request::Projects(LOCAL.into())).await?;
    connection
        .request(&Request::Providers(LOCAL.into()))
        .await?;
    loop {
        tokio::select! {
            message = connection.next() => {
                for ask in state.apply(&message?) {
                    connection.request(&ask).await?;
                }
            }
            command = commands.next() => match command {
                None => return Ok(()),
                Some(Command::ShowTerminals(show)) => state.show_terminals = show,
                Some(Command::Launch { host_id, cwd, provider }) => {
                    let update = match connection.start_session(&host_id, cwd.as_deref(), &provider).await {
                        Ok(session_id) => Update::Launched { host_id, session_id, provider },
                        Err(error) => Update::LaunchFailed(format!("{error:#}")),
                    };
                    if updates.unbounded_send(update).is_err() {
                        return Ok(());
                    }
                }
            },
        }
        if !publish(state, shown, updates) {
            return Ok(());
        }
    }
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
        Request::Attention => json!({"type": "attention.list"}),
        Request::Projects(h) => {
            json!({"type": "project.list", "requestId": request_id, "hostId": host(h)})
        }
        Request::Providers(h) => {
            json!({"type": "agent.manifest.list", "requestId": request_id, "hostId": host(h)})
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
            create_frame(None, None),
            create_frame(Some("/tmp"), Some("build-box")),
            // The terminal and every agent the core lists start the same way.
            open_frame("r", "s", TERMINAL_PROVIDER, 80, 24),
            open_frame("r", "s", "claude", 80, 24),
            release_frame("s", "claude", "r"),
            request_frame("r", &Request::Attention),
            request_frame("r", &Request::Projects(LOCAL.into())),
            request_frame("r", &Request::Projects("build-box".into())),
            request_frame("r", &Request::Providers("build-box".into())),
            acquire_frame("r", "s", "w", "input"),
            acquire_frame("r", "s", "w", "resize"),
            input_frame("t", 1, "echo hi\n"),
            resize_frame("t", 1, 100, 30),
            release_frame("s", TERMINAL_PROVIDER, "r"),
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

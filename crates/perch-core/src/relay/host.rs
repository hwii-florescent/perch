//! This computer's end of the relay: one outbound `wss://` connection that
//! carries every phone, each as an end-to-end sealed session (`wire.rs`).
//!
//! A phone's frames are not given any new powers. They are turned back into the
//! requests its browser would have made on the LAN and handed to the same
//! router and `/ws` endpoint, marked `x-perch-relay` so `local_request` treats
//! them as remote: the device token (cookie) is still checked exactly as it is
//! for a phone on Wi-Fi, and `/pair` is still how a phone gets one.
//!
//! Only the five data routes are reachable (`ROUTES`); the phone's page itself
//! comes from the relay's static assets, not from here.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::ConnectInfo;
use axum::http::{header, HeaderValue, Method, Request};
use axum::Router;
use futures::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;
use tower::ServiceExt;

use super::wire::*;

/// What the host serves a phone from: the finished router, the loopback port of
/// the main listener (for `/ws`) and the path they live under.
pub struct Local {
    pub router: Router,
    pub port: u16,
    pub base_path: String,
}

/// Where the relay link stands, for the settings panel.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Link {
    Connecting,
    Online,
    Error(String),
}

const ROUTES: [&str; 5] = ["pair", "ws", "workspace-file", "clipboard-image", "upload"];
/// Phones per computer. A guest costs a task and a loopback socket or two.
const MAX_GUESTS: usize = 8;
/// A guest that has not said hello by now is a stranger holding a room id.
const HELLO_WITHIN: Duration = Duration::from_secs(10);
/// Largest request body taken from a phone (a pasted image or an attachment).
const MAX_BODY: usize = 64 * 1024 * 1024;
const MAX_PENDING_REQUESTS: usize = 16;
/// Plaintext per frame, well under the relay's per-message limit.
const CHUNK: usize = 48 * 1024;

type Out = mpsc::Sender<Message>;

/// A text message as frames of at most `CHUNK` bytes: the relay drops any frame
/// over 1 MiB, and a terminal replay is several MiB. The pieces are bytes, so
/// one may end inside a UTF-8 character; the phone joins them before decoding.
pub(super) fn text_frames(text: &str) -> Vec<(u8, &[u8])> {
    let bytes = text.as_bytes();
    let mut pieces: Vec<_> = bytes
        .chunks(CHUNK)
        .map(|piece| (WS_TEXT_PART, piece))
        .collect();
    match pieces.last_mut() {
        Some(last) => last.0 = WS_TEXT,
        None => pieces.push((WS_TEXT, bytes)),
    }
    pieces
}

/// Connect, serve, and reconnect with backoff until aborted.
pub(super) async fn run(
    url: String,
    key: Key32,
    local: Arc<Local>,
    report: impl Fn(Link) + Send + Sync + 'static,
) {
    let mut backoff = Duration::from_secs(1);
    report(Link::Connecting);
    loop {
        match tokio_tungstenite::connect_async(&url).await {
            Ok((socket, _)) => {
                report(Link::Online);
                backoff = Duration::from_secs(1);
                serve(socket, key, local.clone()).await;
                report(Link::Connecting);
            }
            Err(error) => report(Link::Error(describe(&error))),
        }
        tokio::time::sleep(backoff).await;
        backoff = (backoff * 2).min(Duration::from_secs(30));
    }
}

fn describe(error: &tokio_tungstenite::tungstenite::Error) -> String {
    use tokio_tungstenite::tungstenite::Error;
    match error {
        Error::Http(response) => format!(
            "the relay answered {}: is this a Perch relay?",
            response.status()
        ),
        other => format!("cannot reach the relay: {other}"),
    }
}

async fn serve<S>(socket: tokio_tungstenite::WebSocketStream<S>, key: Key32, local: Arc<Local>)
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send + 'static,
{
    let (mut sink, mut stream) = socket.split();
    let (out, mut out_rx) = mpsc::channel::<Message>(256);
    let writer = tokio::spawn(async move {
        while let Some(message) = out_rx.recv().await {
            if sink.send(message).await.is_err() {
                break;
            }
        }
    });
    let mut guests: HashMap<u32, mpsc::Sender<Vec<u8>>> = HashMap::new();
    let mut ping = tokio::time::interval(Duration::from_secs(25));
    let mut heard = tokio::time::Instant::now();
    loop {
        tokio::select! {
            message = stream.next() => {
                heard = tokio::time::Instant::now();
                match message {
                    Some(Ok(Message::Binary(bytes))) => {
                        route(&mut guests, bytes, key, &out, &local).await;
                    }
                    Some(Ok(Message::Close(_))) | Some(Err(_)) | None => break,
                    Some(Ok(_)) => {}
                }
            }
            _ = ping.tick() => {
                if heard.elapsed() > Duration::from_secs(70) {
                    break;
                }
                guests.retain(|_, tx| !tx.is_closed());
                let _ = out.try_send(Message::Ping(Vec::new()));
            }
        }
    }
    writer.abort();
}

/// `[kind][gid u32 BE][sealed]` from the relay: hand it to that guest's task,
/// starting one for a guest we haven't met.
async fn route(
    guests: &mut HashMap<u32, mpsc::Sender<Vec<u8>>>,
    bytes: Vec<u8>,
    key: Key32,
    out: &Out,
    local: &Arc<Local>,
) {
    let Some((kind, gid, payload)) = parse_frame(&bytes) else {
        return;
    };
    if kind == ENV_LEFT {
        guests.remove(&gid);
        return;
    }
    if kind != ENV_DATA {
        return;
    }
    guests.retain(|_, tx| !tx.is_closed());
    if !guests.contains_key(&gid) {
        if guests.len() >= MAX_GUESTS {
            let _ = out.send(Message::Binary(frame(ENV_LEFT, gid, &[]))).await;
            return;
        }
        let (tx, rx) = mpsc::channel(64);
        tokio::spawn(guest(gid, key, rx, out.clone(), local.clone()));
        guests.insert(gid, tx);
    }
    if let Some(tx) = guests.get(&gid) {
        if tx.try_send(payload.to_vec()).is_err() {
            // A guest that cannot keep up is dropped, not buffered without bound.
            guests.remove(&gid);
            let _ = out.send(Message::Binary(frame(ENV_LEFT, gid, &[]))).await;
        }
    }
}

/// One phone's sealed session: both directions' counters and the writer.
struct Session {
    key: Key32,
    guest: Nonce16,
    host: Nonce16,
    gid: u32,
    out: Out,
    sent: tokio::sync::Mutex<u64>,
}

impl Session {
    /// Seal and queue one frame. The counter and the queue position are taken
    /// together so frames reach the phone in the order they were counted.
    async fn send(&self, kind: u8, id: u32, payload: &[u8]) -> bool {
        let mut sent = self.sent.lock().await;
        let aad = data_aad(&self.guest, &self.host, true, *sent);
        let sealed = seal(&self.key, &aad, &frame(kind, id, payload));
        *sent += 1;
        self.out
            .send(Message::Binary(frame(ENV_DATA, self.gid, &sealed)))
            .await
            .is_ok()
    }

    async fn close_socket(&self, id: u32) {
        self.send(WS_CLOSE, id, &[]).await;
    }
}

async fn guest(gid: u32, key: Key32, rx: mpsc::Receiver<Vec<u8>>, out: Out, local: Arc<Local>) {
    guest_session(gid, key, rx, &out, local).await;
    // However it ended, the relay should not keep this phone's socket open.
    let _ = out.send(Message::Binary(frame(ENV_LEFT, gid, &[]))).await;
}

enum WsIn {
    Text(String),
    Bin(Vec<u8>),
    Close,
}

struct Pending {
    head: serde_json::Value,
    body: Vec<u8>,
}

async fn guest_session(
    gid: u32,
    key: Key32,
    mut rx: mpsc::Receiver<Vec<u8>>,
    out: &Out,
    local: Arc<Local>,
) -> Option<()> {
    let first = tokio::time::timeout(HELLO_WITHIN, rx.recv()).await.ok()??;
    let hello = open(&key, &hello_aad(false, None), &first)?;
    let (kind, _, nonce) = parse_frame(&hello)?;
    let guest: Nonce16 = nonce.try_into().ok().filter(|_| kind == HELLO_GUEST)?;
    let host = random_bytes::<NONCE_LEN>();
    let reply = seal(
        &key,
        &hello_aad(true, Some(&guest)),
        &frame(HELLO_HOST, 0, &host),
    );
    out.send(Message::Binary(frame(ENV_DATA, gid, &reply)))
        .await
        .ok()?;
    let session = Arc::new(Session {
        key,
        guest,
        host,
        gid,
        out: out.clone(),
        sent: tokio::sync::Mutex::new(0),
    });

    let mut received = 0u64;
    let mut requests: HashMap<u32, Pending> = HashMap::new();
    let mut sockets: HashMap<u32, mpsc::Sender<WsIn>> = HashMap::new();
    while let Some(sealed) = rx.recv().await {
        // Any frame that does not open ends the session: it was tampered with,
        // replayed, dropped before, or not from the phone holding the key.
        let plain = open(&key, &data_aad(&guest, &host, false, received), &sealed)?;
        received += 1;
        let (kind, id, payload) = parse_frame(&plain)?;
        match kind {
            REQ_HEAD => {
                if requests.len() >= MAX_PENDING_REQUESTS {
                    return None;
                }
                let head = serde_json::from_slice(payload).ok()?;
                requests.insert(
                    id,
                    Pending {
                        head,
                        body: Vec::new(),
                    },
                );
            }
            REQ_BODY => {
                let pending = requests.get_mut(&id)?;
                if pending.body.len() + payload.len() > MAX_BODY {
                    return None;
                }
                pending.body.extend_from_slice(payload);
            }
            REQ_END => {
                let pending = requests.remove(&id)?;
                tokio::spawn(http(session.clone(), id, pending, local.clone()));
            }
            WS_OPEN => {
                let head = serde_json::from_slice(payload).ok()?;
                let (tx, rx) = mpsc::channel(64);
                sockets.retain(|_, tx| !tx.is_closed());
                sockets.insert(id, tx);
                tokio::spawn(socket(session.clone(), id, head, local.clone(), rx));
            }
            WS_TEXT => {
                if let Some(tx) = sockets.get(&id) {
                    let text = String::from_utf8(payload.to_vec()).ok()?;
                    let _ = tx.send(WsIn::Text(text)).await;
                }
            }
            WS_BIN => {
                if let Some(tx) = sockets.get(&id) {
                    let _ = tx.send(WsIn::Bin(payload.to_vec())).await;
                }
            }
            WS_CLOSE => {
                if let Some(tx) = sockets.remove(&id) {
                    let _ = tx.send(WsIn::Close).await;
                }
            }
            _ => return None,
        }
    }
    Some(())
}

/// A route the phone may ask for, as the path under the base path.
fn allowed(rel: &str) -> bool {
    let name = rel.split(['?', '#']).next().unwrap_or_default();
    ROUTES.contains(&name) && !rel.contains(['\r', '\n', ' '])
}

/// A device token as the core issues it: hex. Anything else is not forwarded.
fn clean_token(head: &serde_json::Value) -> Option<&str> {
    head["token"]
        .as_str()
        .filter(|t| !t.is_empty() && t.bytes().all(|b| b.is_ascii_alphanumeric()))
}

async fn http(session: Arc<Session>, id: u32, pending: Pending, local: Arc<Local>) {
    let head = pending.head;
    let respond = |status: u16| {
        serde_json::to_vec(&serde_json::json!({ "status": status })).unwrap_or_default()
    };
    let rel = head["path"].as_str().unwrap_or_default();
    let method = match head["method"].as_str() {
        Some("GET") => Method::GET,
        Some("POST") => Method::POST,
        _ => {
            session.send(RES_HEAD, id, &respond(405)).await;
            session.send(RES_END, id, &[]).await;
            return;
        }
    };
    if !allowed(rel) {
        session.send(RES_HEAD, id, &respond(404)).await;
        session.send(RES_END, id, &[]).await;
        return;
    }
    let mut request = Request::builder()
        .method(method)
        .uri(format!("{}{rel}", local.base_path))
        .header(header::HOST, "127.0.0.1")
        .header("x-perch-relay", "1");
    if let Some(content_type) = head["contentType"].as_str() {
        request = request.header(header::CONTENT_TYPE, content_type);
    }
    if let Some(token) = clean_token(&head) {
        request = request.header(header::COOKIE, format!("perch_device={token}"));
    }
    let Ok(mut request) = request.body(axum::body::Body::from(pending.body)) else {
        session.send(RES_HEAD, id, &respond(400)).await;
        session.send(RES_END, id, &[]).await;
        return;
    };
    request
        .extensions_mut()
        .insert(ConnectInfo(SocketAddr::from(([127, 0, 0, 1], 0))));
    let Ok(response) = local.router.clone().oneshot(request).await;
    // Built in its own scope: a body is not `Sync`, so nothing borrowing the
    // response may live across the awaits below.
    let head = {
        let header_of = |name: header::HeaderName| {
            response
                .headers()
                .get(name)
                .and_then(|v| v.to_str().ok())
                .map(str::to_string)
        };
        serde_json::json!({
            "status": response.status().as_u16(),
            "contentType": header_of(header::CONTENT_TYPE),
            "contentDisposition": header_of(header::CONTENT_DISPOSITION),
            "setCookie": header_of(header::SET_COOKIE),
        })
    };
    if !session
        .send(RES_HEAD, id, &serde_json::to_vec(&head).unwrap_or_default())
        .await
    {
        return;
    }
    let mut body = response.into_body().into_data_stream();
    while let Some(Ok(bytes)) = body.next().await {
        for chunk in bytes.chunks(CHUNK) {
            if !session.send(RES_BODY, id, chunk).await {
                return;
            }
        }
    }
    session.send(RES_END, id, &[]).await;
}

/// One phone WebSocket: a loopback client socket to our own `/ws`, with frames
/// copied both ways.
async fn socket(
    session: Arc<Session>,
    id: u32,
    head: serde_json::Value,
    local: Arc<Local>,
    mut from_phone: mpsc::Receiver<WsIn>,
) {
    let rel = head["path"].as_str().unwrap_or_default();
    let name = rel.split('?').next().unwrap_or_default();
    let request = (name == "ws" && allowed(rel))
        .then(|| format!("ws://127.0.0.1:{}{}{rel}", local.port, local.base_path))
        .and_then(|url| url.into_client_request().ok())
        .map(|mut request| {
            request
                .headers_mut()
                .insert("x-perch-relay", HeaderValue::from_static("1"));
            if let Some(token) = clean_token(&head) {
                if let Ok(cookie) = HeaderValue::from_str(&format!("perch_device={token}")) {
                    request.headers_mut().insert(header::COOKIE, cookie);
                }
            }
            request
        });
    let connected = match request {
        Some(request) => tokio_tungstenite::connect_async(request).await.ok(),
        None => None,
    };
    let Some((local_socket, _)) = connected else {
        session.close_socket(id).await;
        return;
    };
    if !session.send(WS_OPENED, id, &[]).await {
        return;
    }
    let (mut sink, mut stream) = local_socket.split();
    loop {
        tokio::select! {
            incoming = from_phone.recv() => {
                let message = match incoming {
                    Some(WsIn::Text(text)) => Message::Text(text),
                    Some(WsIn::Bin(bytes)) => Message::Binary(bytes),
                    Some(WsIn::Close) | None => break,
                };
                if sink.send(message).await.is_err() {
                    break;
                }
            }
            outgoing = stream.next() => {
                let sent = match outgoing {
                    Some(Ok(Message::Text(text))) => {
                        let mut sent = true;
                        for (kind, piece) in text_frames(&text) {
                            sent &= session.send(kind, id, piece).await;
                        }
                        sent
                    }
                    Some(Ok(Message::Binary(bytes))) => session.send(WS_BIN, id, &bytes).await,
                    Some(Ok(Message::Ping(_) | Message::Pong(_) | Message::Frame(_))) => true,
                    Some(Ok(Message::Close(_))) | Some(Err(_)) | None => break,
                };
                if !sent {
                    return;
                }
            }
        }
    }
    let _ = sink.close().await;
    session.close_socket(id).await;
}

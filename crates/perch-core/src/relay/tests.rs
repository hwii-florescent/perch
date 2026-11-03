//! The relay path end to end: a real server, a stand-in relay that only routes
//! opaque frames (as `relay/worker` does), and a guest playing the phone.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::extract::ws::{Message as AxumMessage, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::response::IntoResponse;
use axum::routing::get;
use futures::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

use super::wire::*;
use super::*;

/// A secure socket to a real relay panics at the first handshake if rustls has no
/// single provider selected; the local plain-text tests never reach it, so check directly.
#[test]
fn tls_has_exactly_one_crypto_provider() {
    let _ = rustls::ClientConfig::builder();
}

#[test]
fn relay_addresses_are_checked_before_they_are_trusted() {
    let ok = parse_target("relay.example.workers.dev/").unwrap();
    assert_eq!(ok.origin, "https://relay.example.workers.dev");
    assert_eq!(ok.ws_base, "wss://relay.example.workers.dev");
    assert_eq!(
        parse_target("wss://r.example:8443").unwrap().origin,
        "https://r.example:8443"
    );
    // Plain http only for a relay on this machine.
    assert_eq!(
        parse_target("http://127.0.0.1:8787").unwrap().ws_base,
        "ws://127.0.0.1:8787"
    );
    assert!(parse_target("http://relay.example.com").is_err());
    assert!(parse_target("https://relay.example.com/some/path").is_err());
    assert!(parse_target("ftp://relay.example.com").is_err());
    assert!(parse_target("").is_err());
}

#[test]
fn long_text_is_split_into_frames_the_relay_accepts_and_joins_back_exactly() {
    // Multi-byte characters so a piece boundary can fall inside one.
    let text = "café ✓ ".repeat(40_000);
    let frames = host::text_frames(&text);
    assert!(frames.len() > 1 && frames.iter().all(|(_, piece)| piece.len() <= 48 * 1024));
    let (last, rest) = frames.split_last().unwrap();
    assert_eq!(last.0, WS_TEXT);
    assert!(rest.iter().all(|(kind, _)| *kind == WS_TEXT_PART));
    let joined: Vec<u8> = frames.iter().flat_map(|(_, piece)| piece.iter().copied()).collect();
    assert_eq!(String::from_utf8(joined).unwrap(), text);
    // Short and empty messages stay a single plain frame.
    assert_eq!(host::text_frames("{}"), vec![(WS_TEXT, &b"{}"[..])]);
    assert_eq!(host::text_frames(""), vec![(WS_TEXT, &b""[..])]);
}

#[test]
fn identity_is_made_once_private_and_names_the_room_by_hash() {
    let dir = std::env::temp_dir().join(format!("perch-relay-id-{}", uuid::Uuid::new_v4()));
    let path = dir.join("relay.json");
    let first = load_identity(&path).unwrap();
    let again = load_identity(&path).unwrap();
    assert_eq!((first.secret, first.key), (again.secret, again.key));
    assert_ne!(first.secret, first.key);
    assert_eq!(first.room(), again.room());
    // The room id reveals nothing that lets a guest pose as the host.
    assert!(!first.room().contains(&B64.encode(first.secret)));
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = std::fs::metadata(&path).unwrap().permissions().mode();
        assert_eq!(mode & 0o077, 0, "relay.json holds the key: owner only");
    }
    std::fs::remove_dir_all(dir).ok();
}

/// A plain-text socket URL to a server on this machine, the only kind a test makes.
fn loopback(addr: std::net::SocketAddr, path: &str) -> String {
    format!("{}://{addr}{path}", "ws")
}

/// Routes frames between one host and its guests and nothing else.
#[derive(Default)]
struct Room {
    host: Option<mpsc::Sender<AxumMessage>>,
    guests: HashMap<u32, mpsc::Sender<AxumMessage>>,
    next: u32,
}

async fn relay_socket(
    ws: WebSocketUpgrade,
    Query(query): Query<HashMap<String, String>>,
    State(room): State<Arc<Mutex<Room>>>,
) -> impl IntoResponse {
    let host = query.get("role").map(String::as_str) == Some("host");
    ws.on_upgrade(move |socket| async move {
        if host {
            host_socket(socket, room).await
        } else {
            guest_socket(socket, room).await
        }
    })
}

async fn pump(mut socket: WebSocket, mut rx: mpsc::Receiver<AxumMessage>, on: impl Fn(Vec<u8>)) {
    loop {
        tokio::select! {
            out = rx.recv() => match out {
                Some(message) => { if socket.send(message).await.is_err() { break } }
                None => break,
            },
            incoming = socket.recv() => match incoming {
                Some(Ok(AxumMessage::Binary(bytes))) => on(bytes),
                Some(Ok(AxumMessage::Close(_))) | Some(Err(_)) | None => break,
                Some(Ok(_)) => {}
            },
        }
    }
}

async fn host_socket(socket: WebSocket, room: Arc<Mutex<Room>>) {
    let (tx, rx) = mpsc::channel(64);
    room.lock().unwrap().host = Some(tx);
    let routed = room.clone();
    pump(socket, rx, move |bytes| {
        let Some((kind, gid, payload)) = parse_frame(&bytes) else {
            return;
        };
        let mut room = routed.lock().unwrap();
        match kind {
            ENV_DATA => {
                if let Some(guest) = room.guests.get(&gid) {
                    let _ = guest.try_send(AxumMessage::Binary(payload.to_vec()));
                }
            }
            // Dropping the sender ends that guest's socket.
            ENV_LEFT => {
                room.guests.remove(&gid);
            }
            _ => {}
        }
    })
    .await;
    room.lock().unwrap().host = None;
}

async fn guest_socket(socket: WebSocket, room: Arc<Mutex<Room>>) {
    let (tx, rx) = mpsc::channel(64);
    let gid = {
        let mut room = room.lock().unwrap();
        room.next += 1;
        let gid = room.next;
        room.guests.insert(gid, tx);
        gid
    };
    let routed = room.clone();
    pump(socket, rx, move |bytes| {
        if let Some(host) = routed.lock().unwrap().host.clone() {
            let _ = host.try_send(AxumMessage::Binary(frame(ENV_DATA, gid, &bytes)));
        }
    })
    .await;
    let mut room = room.lock().unwrap();
    room.guests.remove(&gid);
    if let Some(host) = &room.host {
        let _ = host.try_send(AxumMessage::Binary(frame(ENV_LEFT, gid, &[])));
    }
}

type Socket =
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

/// The phone's end of a session, written independently of `host.rs`.
struct Phone {
    socket: Socket,
    key: Key32,
    guest: Nonce16,
    host: Nonce16,
    sent: u64,
    received: u64,
}

impl Phone {
    async fn join(relay: std::net::SocketAddr, key: Key32) -> Self {
        let (mut socket, _) =
            tokio_tungstenite::connect_async(loopback(relay, "/r/room?role=guest"))
                .await
                .unwrap();
        let guest = random_bytes::<NONCE_LEN>();
        let hello = seal(
            &key,
            &hello_aad(false, None),
            &frame(HELLO_GUEST, 0, &guest),
        );
        socket.send(Message::Binary(hello)).await.unwrap();
        let Some(Ok(Message::Binary(reply))) = socket.next().await else {
            panic!("no hello from the host")
        };
        let plain = open(&key, &hello_aad(true, Some(&guest)), &reply).expect("host hello");
        let (kind, _, host) = parse_frame(&plain).unwrap();
        assert_eq!(kind, HELLO_HOST);
        Self {
            socket,
            key,
            guest,
            host: host.try_into().unwrap(),
            sent: 0,
            received: 0,
        }
    }

    async fn send(&mut self, kind: u8, id: u32, payload: &[u8]) {
        let aad = data_aad(&self.guest, &self.host, false, self.sent);
        self.sent += 1;
        let sealed = seal(&self.key, &aad, &frame(kind, id, payload));
        self.socket.send(Message::Binary(sealed)).await.unwrap();
    }

    /// `None` once the host or relay closed this session.
    async fn recv(&mut self) -> Option<(u8, u32, Vec<u8>)> {
        loop {
            let message = tokio::time::timeout(Duration::from_secs(5), self.socket.next())
                .await
                .expect("the host went quiet")?;
            let Message::Binary(sealed) = message.ok()? else {
                continue;
            };
            let aad = data_aad(&self.guest, &self.host, true, self.received);
            self.received += 1;
            let plain = open(&self.key, &aad, &sealed).expect("host frame must open");
            let (kind, id, payload) = parse_frame(&plain).unwrap();
            return Some((kind, id, payload.to_vec()));
        }
    }

    /// One request, answered as `(status, head json, body)`.
    async fn http(
        &mut self,
        id: u32,
        head: serde_json::Value,
        body: &[u8],
    ) -> (u64, serde_json::Value, Vec<u8>) {
        self.send(REQ_HEAD, id, head.to_string().as_bytes()).await;
        if !body.is_empty() {
            self.send(REQ_BODY, id, body).await;
        }
        self.send(REQ_END, id, &[]).await;
        let (mut response, mut data) = (serde_json::Value::Null, Vec::new());
        while let Some((kind, got, payload)) = self.recv().await {
            assert_eq!(got, id);
            match kind {
                RES_HEAD => response = serde_json::from_slice(&payload).unwrap(),
                RES_BODY => data.extend(payload),
                RES_END => return (response["status"].as_u64().unwrap(), response, data),
                other => panic!("unexpected frame {other}"),
            }
        }
        panic!("the session closed mid-response")
    }
}

async fn next_json(
    socket: &mut Socket,
    wanted: impl Fn(&serde_json::Value) -> bool,
) -> serde_json::Value {
    tokio::time::timeout(Duration::from_secs(10), async {
        while let Some(Ok(message)) = socket.next().await {
            if let Message::Text(text) = message {
                let value: serde_json::Value = serde_json::from_str(&text).unwrap();
                if wanted(&value) {
                    return value;
                }
            }
        }
        panic!("socket closed")
    })
    .await
    .expect("expected message never arrived")
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_phone_pairs_and_works_through_the_relay_and_tampering_ends_its_session() {
    let root = std::env::temp_dir().join(format!("perch-relay-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&root).unwrap();
    let relay_listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let relay_addr = relay_listener.local_addr().unwrap();
    let relay = tokio::spawn(async move {
        let app = axum::Router::new()
            .route("/r/:room", get(relay_socket))
            .with_state(Arc::new(Mutex::new(Room::default())));
        axum::serve(relay_listener, app).await.unwrap();
    });

    let db_path = root.join("history.sqlite");
    let (ready_tx, ready_rx) = tokio::sync::oneshot::channel();
    let server = tokio::spawn(crate::server::run(
        crate::server::ServerOptions {
            port: 0,
            base_path: "/".into(),
            web_dist_dir: root.join("web"),
            db_path: Some(db_path.clone()),
            hosts_path: Some(root.join("hosts.json")),
            providers_path: None,
            devices_path: Some(root.join("devices.json")),
            ready_tx: Some(ready_tx),
            // The LAN listener stays off: the relay alone must let a phone in.
            phone_access_port: None,
        },
        Arc::new(crate::registry::SessionRegistry::new()),
        Arc::new(crate::db::HistoryDb::open(&db_path).unwrap()),
        root.display().to_string(),
    ));
    let address = tokio::time::timeout(Duration::from_secs(5), ready_rx)
        .await
        .unwrap()
        .unwrap();
    let (mut desktop, _) = tokio_tungstenite::connect_async(loopback(address, "/ws"))
        .await
        .unwrap();

    // Turning the relay on from the desktop reports its link once connected.
    desktop
        .send(Message::Text(
            serde_json::json!({
                "type": "settings.update",
                "patch": { "relayUrl": format!("http://{relay_addr}") },
            })
            .to_string(),
        ))
        .await
        .unwrap();
    let status = next_json(&mut desktop, |m| {
        m["type"] == "phone.access.status" && m["relay"]["state"] == "online"
    })
    .await;
    let link = status["addresses"]
        .as_array()
        .unwrap()
        .iter()
        .find(|a| a["kind"] == "relay")
        .expect("a relay address")["url"]
        .as_str()
        .unwrap()
        .to_string();
    let key: Key32 = B64
        .decode(link.rsplit_once('.').unwrap().1)
        .unwrap()
        .try_into()
        .unwrap();
    assert!(link.starts_with(&format!("http://{relay_addr}/#r=")));

    // A bad address is refused with a reason and changes nothing.
    desktop
        .send(Message::Text(
            serde_json::json!({
                "type": "settings.update",
                "patch": { "relayUrl": "http://not-secure.example" },
            })
            .to_string(),
        ))
        .await
        .unwrap();
    let refused = next_json(&mut desktop, |m| {
        m["type"] == "phone.access.status" && m["error"].is_string()
    })
    .await;
    assert!(refused["error"].as_str().unwrap().contains("https"));
    assert_eq!(refused["relay"]["state"], "online");

    desktop
        .send(Message::Text(
            serde_json::json!({ "type": "device.pair.start", "requestId": "p" }).to_string(),
        ))
        .await
        .unwrap();
    let code = next_json(&mut desktop, |m| m["type"] == "device.pair.code").await["code"]
        .as_str()
        .unwrap()
        .to_string();

    let mut phone = Phone::join(relay_addr, key).await;
    let get_pair = |token: Option<&str>| serde_json::json!({ "method": "GET", "path": "pair", "token": token });
    let (status, _, body) = phone.http(1, get_pair(None), &[]).await;
    assert_eq!(status, 200);
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&body).unwrap()["paired"],
        false,
        "an unpaired phone is turned away exactly as on the LAN"
    );

    let claim = serde_json::json!({
        "method": "POST", "path": "pair", "contentType": "application/json",
    });
    let body = serde_json::json!({ "code": code, "name": "relay phone" }).to_string();
    let (status, head, _) = phone.http(2, claim, body.as_bytes()).await;
    assert_eq!(status, 200);
    let token = head["setCookie"]
        .as_str()
        .and_then(|c| c.strip_prefix("perch_device="))
        .and_then(|c| c.split(';').next())
        .expect("the pairing cookie")
        .to_string();

    let (_, _, body) = phone.http(3, get_pair(Some(&token)), &[]).await;
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&body).unwrap()["paired"],
        true
    );
    // A forged token gets nothing, and the page itself is not served from here.
    let (_, _, body) = phone.http(4, get_pair(Some("deadbeef")), &[]).await;
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&body).unwrap()["paired"],
        false
    );
    let (status, _, _) = phone
        .http(
            5,
            serde_json::json!({ "method": "GET", "path": "index.html" }),
            &[],
        )
        .await;
    assert_eq!(status, 404);

    // The data socket: authenticated by the token, then a normal session.
    phone
        .send(
            WS_OPEN,
            9,
            serde_json::json!({ "path": "ws", "token": token })
                .to_string()
                .as_bytes(),
        )
        .await;
    assert_eq!(phone.recv().await.unwrap().0, WS_OPENED);
    phone.send(WS_TEXT, 9, br#"{"type":"settings.get"}"#).await;
    loop {
        let (kind, id, payload) = phone.recv().await.expect("settings.current");
        assert_eq!(id, 9);
        if kind == WS_TEXT && String::from_utf8_lossy(&payload).contains("settings.current") {
            break;
        }
    }

    // The same socket without a token is refused, not served as local.
    phone
        .send(
            WS_OPEN,
            10,
            serde_json::json!({ "path": "ws" }).to_string().as_bytes(),
        )
        .await;
    loop {
        let (kind, id, _) = phone.recv().await.unwrap();
        if id == 10 {
            assert_eq!(kind, WS_CLOSE);
            break;
        }
    }

    // A frame the relay replayed or altered fails to open: the host ends the
    // session instead of acting on it.
    phone.sent = 0;
    phone.send(REQ_HEAD, 11, b"{}").await;
    let ended = tokio::time::timeout(Duration::from_secs(5), async {
        while let Some(Ok(message)) = phone.socket.next().await {
            if matches!(message, Message::Close(_)) {
                return;
            }
        }
    })
    .await;
    assert!(ended.is_ok(), "the session must close after a bad frame");

    // A phone with the wrong key is never answered.
    let (mut stranger, _) =
        tokio_tungstenite::connect_async(loopback(relay_addr, "/r/room?role=guest"))
            .await
            .unwrap();
    let wrong: Key32 = random_bytes();
    let nonce = random_bytes::<NONCE_LEN>();
    stranger
        .send(Message::Binary(seal(
            &wrong,
            &hello_aad(false, None),
            &frame(HELLO_GUEST, 0, &nonce),
        )))
        .await
        .unwrap();
    let answer = tokio::time::timeout(Duration::from_secs(5), stranger.next()).await;
    assert!(
        !matches!(answer, Ok(Some(Ok(Message::Binary(_))))),
        "a stranger must get no sealed reply"
    );

    relay.abort();
    server.abort();
    let _ = server.await;
    std::fs::remove_dir_all(root).ok();
}

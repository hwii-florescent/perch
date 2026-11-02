//! Remote access through a relay: reaching this computer from a phone that
//! shares no network with it and has nothing installed but a browser.
//!
//! The user deploys `relay/` (a small Cloudflare Worker, see its README) and
//! enters its address in Settings → Devices. This computer then keeps one
//! outbound `wss://` connection to it (`host.rs`); the phone opens
//! `<relay>/#r=<room>.<key>`, which the relay serves as the same web app and
//! which talks back through the relay, sealed with a key the relay never sees
//! (`wire.rs`). The relay is a blind pipe.
//!
//! Identity lives in `relay.json` next to `devices.json` (mode 0600):
//!
//! * `hostSecret`: proves to the relay that this computer owns the room. The
//!   room id is its SHA-256, so the relay needs to store nothing.
//! * `key`: the end-to-end key, handed to phones in the link's `#fragment`.
//!
//! The link grants no access by itself: a phone must still pair (`devices.rs`)
//! and its token is checked on every request as it is on the LAN. What the key
//! protects is confidentiality from the relay and from anyone who sees its
//! traffic. It never changes unless `relay.json` is deleted; ponytail: no reset
//! button yet, so a leaked link is revoked by deleting the file and re-pairing.

mod host;
pub mod wire;

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

use base64::engine::general_purpose::URL_SAFE_NO_PAD as B64;
use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::sync::watch;

pub use host::{Link, Local};
use wire::{random_bytes, Key32, KEY_LEN};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RelayState {
    Off,
    Connecting,
    Online,
    Error(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RelayStatus {
    pub state: RelayState,
    /// What a phone opens (without a pairing code); `None` while off.
    pub link: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Identity {
    host_secret: String,
    key: String,
}

struct Ids {
    secret: [u8; 32],
    key: Key32,
}

impl Ids {
    fn room(&self) -> String {
        B64.encode(Sha256::digest(self.secret))
    }
}

fn load_identity(path: &Path) -> anyhow::Result<Ids> {
    let decode = |text: &str| -> Option<[u8; 32]> { B64.decode(text).ok()?.try_into().ok() };
    if let Ok(text) = std::fs::read_to_string(path) {
        if let Ok(identity) = serde_json::from_str::<Identity>(&text) {
            if let (Some(secret), Some(key)) =
                (decode(&identity.host_secret), decode(&identity.key))
            {
                return Ok(Ids { secret, key });
            }
        }
    }
    let ids = Ids {
        secret: random_bytes::<32>(),
        key: random_bytes::<KEY_LEN>(),
    };
    let text = serde_json::to_string_pretty(&Identity {
        host_secret: B64.encode(ids.secret),
        key: B64.encode(ids.key),
    })?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    write_private(path, &text)?;
    Ok(ids)
}

fn write_private(path: &Path, text: &str) -> std::io::Result<()> {
    use std::io::Write;
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
    options.open(path)?.write_all(text.as_bytes())
}

/// A relay address the user typed, split into the page origin and the
/// WebSocket base.
#[derive(Debug, PartialEq, Eq)]
pub struct Target {
    pub origin: String,
    ws_base: String,
}

/// `relay.example.com`, `https://relay.example.com/` and `wss://…` are all
/// fine; plain `http`/`ws` only to this machine (a relay under development),
/// because the key must not cross a network in the clear and phones need https
/// for WebCrypto anyway.
pub fn parse_target(input: &str) -> Result<Target, String> {
    let input = input.trim();
    let with_scheme = if input.contains("://") {
        input.to_string()
    } else {
        format!("https://{input}")
    };
    let uri: axum::http::Uri = with_scheme
        .parse()
        .map_err(|_| "that is not a web address".to_string())?;
    let authority = uri
        .authority()
        .ok_or_else(|| "that is not a web address".to_string())?;
    if uri.path() != "/" || uri.query().is_some() {
        return Err("use just the relay's address, with no path".into());
    }
    let secure = match uri.scheme_str() {
        Some("https" | "wss") => true,
        Some("http" | "ws") => false,
        _ => return Err("the relay address must start with https://".into()),
    };
    let host = authority.host().trim_matches(['[', ']']);
    let loopback = host.eq_ignore_ascii_case("localhost")
        || host
            .parse::<std::net::IpAddr>()
            .is_ok_and(|ip| ip.is_loopback());
    if !secure && !loopback {
        return Err("the relay address must be https://".into());
    }
    Ok(Target {
        origin: format!("{}://{authority}", if secure { "https" } else { "http" }),
        ws_base: format!("{}://{authority}", if secure { "wss" } else { "ws" }),
    })
}

pub fn default_path() -> PathBuf {
    std::env::var_os("HOME")
        .map(|home| PathBuf::from(home).join(".perch/relay.json"))
        .unwrap_or_else(|| PathBuf::from(".perch/relay.json"))
}

struct Running {
    url: String,
    task: tokio::task::JoinHandle<()>,
}

pub struct RelayAccess {
    path: PathBuf,
    local: OnceLock<Arc<Local>>,
    running: Mutex<Option<Running>>,
    status: watch::Sender<RelayStatus>,
    /// Serializes `apply` so quick edits to the address end on the last one.
    op: tokio::sync::Mutex<()>,
}

impl RelayAccess {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            local: OnceLock::new(),
            running: Mutex::new(None),
            status: watch::channel(RelayStatus {
                state: RelayState::Off,
                link: None,
            })
            .0,
            op: tokio::sync::Mutex::new(()),
        }
    }

    /// The router and loopback port the relay serves phones from, once built.
    pub fn set_local(&self, local: Local) {
        let _ = self.local.set(Arc::new(local));
    }

    pub fn status(&self) -> RelayStatus {
        self.status.borrow().clone()
    }

    pub fn subscribe(&self) -> watch::Receiver<RelayStatus> {
        self.status.subscribe()
    }

    /// Whether an address is set, whether or not the relay answers yet.
    pub fn configured(&self) -> bool {
        self.running.lock().unwrap().is_some()
    }

    /// Bring the relay connection in line with the saved address (`""` = off).
    pub async fn apply(&self, url: &str) -> anyhow::Result<()> {
        let _turn = self.op.lock().await;
        let url = url.trim();
        if url.is_empty() {
            self.stop();
            return Ok(());
        }
        if self
            .running
            .lock()
            .unwrap()
            .as_ref()
            .is_some_and(|r| r.url == url)
        {
            return Ok(());
        }
        let target = parse_target(url).map_err(anyhow::Error::msg)?;
        let ids = load_identity(&self.path)?;
        let local = self
            .local
            .get()
            .ok_or_else(|| anyhow::anyhow!("the server is still starting"))?
            .clone();
        self.stop();
        let room = ids.room();
        let link = format!("{}/#r={room}.{}", target.origin, B64.encode(ids.key));
        let ws_url = format!(
            "{}/r/{room}?role=host&auth={}",
            target.ws_base,
            B64.encode(ids.secret)
        );
        let status = self.status.clone();
        let report_link = link.clone();
        let task = tokio::spawn(host::run(ws_url, ids.key, local, move |link_state| {
            let state = match link_state {
                Link::Connecting => RelayState::Connecting,
                Link::Online => RelayState::Online,
                Link::Error(message) => RelayState::Error(message),
            };
            status.send_replace(RelayStatus {
                state,
                link: Some(report_link.clone()),
            });
        }));
        self.status.send_replace(RelayStatus {
            state: RelayState::Connecting,
            link: Some(link),
        });
        *self.running.lock().unwrap() = Some(Running {
            url: url.to_string(),
            task,
        });
        Ok(())
    }

    fn stop(&self) {
        if let Some(running) = self.running.lock().unwrap().take() {
            running.task.abort();
        }
        self.status.send_replace(RelayStatus {
            state: RelayState::Off,
            link: None,
        });
    }
}

#[cfg(test)]
mod tests;

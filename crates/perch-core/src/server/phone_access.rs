//! Phone access: letting a paired phone reach the desktop app.
//!
//! The desktop app serves its own web view on loopback only, so nothing else
//! can reach it. While the user has "Phone access" on (Settings → Devices),
//! this serves the same router on a second listener bound to every interface.
//! Reaching it is not enough to use it: every request that isn't local still
//! needs a paired device's token (`authorize_request`), and a code is only
//! offered while the user is looking at the pairing dialog.
//!
//! Turning it off drops the listener *and* stops every paired device's token
//! from working (`DeviceStore::set_remote_enabled`), which also closes their
//! open sockets. Aborting the accept loop alone would leave connections that
//! were already accepted running, so until they drop they answer 503 with
//! `Connection: close`: a phone then sees an unreachable laptop, not an
//! unpaired one.
//!
//! The headless `perch-core` binary already listens on every interface, so for
//! it there is nothing to switch (`always_on`).

use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use axum::extract::{Request, State};
use axum::http::{header, StatusCode};
use axum::middleware::{from_fn_with_state, Next};
use axum::response::{IntoResponse, Response};
use axum::Router;
use tokio::net::TcpListener;

use crate::devices::DeviceStore;
use crate::protocol::PhoneAddress;

/// Tried first so a phone's bookmark or home-screen icon keeps working across
/// launches; any free port is used when it is taken. One above the desktop
/// app's own loopback port.
pub const PREFERRED_PORT: u16 = 47789;

struct Running {
    port: u16,
    task: tokio::task::JoinHandle<()>,
    /// Cleared on stop so connections accepted earlier stop being served.
    live: Arc<AtomicBool>,
}

async fn only_while_on(
    State(live): State<Arc<AtomicBool>>,
    request: Request,
    next: Next,
) -> Response {
    if live.load(Ordering::SeqCst) {
        return next.run(request).await;
    }
    (
        StatusCode::SERVICE_UNAVAILABLE,
        [(header::CONNECTION, "close")],
        "phone access is off",
    )
        .into_response()
}

pub struct PhoneAccess {
    /// The main listener already serves the LAN, on this port.
    always_on: Option<u16>,
    base_path: String,
    devices: Arc<DeviceStore>,
    router: OnceLock<Router>,
    running: Mutex<Option<Running>>,
    /// The relay (`relay/`) is on: paired devices must work even with the LAN
    /// listener off. ponytail: turning the LAN off while the relay is on leaves
    /// already-open LAN sockets until they reconnect; a per-connection origin
    /// on the device gate would close them.
    relay_on: AtomicBool,
    /// Port tried first when starting (`0` = any free one).
    preferred_port: u16,
    /// Serializes start/stop so quick on-off-on toggles can't interleave.
    op: tokio::sync::Mutex<()>,
}

impl PhoneAccess {
    pub fn new(
        always_on: Option<u16>,
        base_path: String,
        devices: Arc<DeviceStore>,
        preferred_port: u16,
    ) -> Self {
        // Off until the user (or their saved setting) turns it on.
        if always_on.is_none() {
            devices.set_remote_enabled(false);
        }
        Self {
            always_on,
            base_path,
            devices,
            router: OnceLock::new(),
            running: Mutex::new(None),
            relay_on: AtomicBool::new(false),
            preferred_port,
            op: tokio::sync::Mutex::new(()),
        }
    }

    /// Bring the listener in line with `desired()`, read once it is this
    /// caller's turn so the last toggle always wins.
    pub async fn apply(&self, desired: impl Fn() -> bool) -> anyhow::Result<()> {
        let _turn = self.op.lock().await;
        if desired() {
            self.start().await
        } else {
            self.stop();
            Ok(())
        }
    }

    /// The finished router, once the server has built it.
    pub fn set_router(&self, router: Router) {
        let _ = self.router.set(router);
    }

    pub fn always_on(&self) -> bool {
        self.always_on.is_some()
    }

    pub fn enabled(&self) -> bool {
        self.always_on() || self.running.lock().unwrap().is_some()
    }

    async fn start(&self) -> anyhow::Result<()> {
        if self.enabled() {
            return Ok(());
        }
        let live = Arc::new(AtomicBool::new(true));
        let router = self
            .router
            .get()
            .ok_or_else(|| anyhow::anyhow!("the server is still starting"))?
            .clone()
            .layer(from_fn_with_state(live.clone(), only_while_on));
        let any = Ipv4Addr::UNSPECIFIED;
        let listener = match TcpListener::bind((any, self.preferred_port)).await {
            Ok(listener) => listener,
            Err(_) => TcpListener::bind((any, 0)).await?,
        };
        let port = listener.local_addr()?.port();
        // `ConnectInfo` is what lets `authorize_request` tell a phone from a
        // local client.
        let task = tokio::spawn(async move {
            let _ = axum::serve(
                listener,
                router.into_make_service_with_connect_info::<SocketAddr>(),
            )
            .await;
        });
        *self.running.lock().unwrap() = Some(Running { port, task, live });
        self.sync_remote();
        tracing::info!("[perch] phone access on, port {port}");
        Ok(())
    }

    fn stop(&self) {
        if self.always_on() {
            return;
        }
        if let Some(running) = self.running.lock().unwrap().take() {
            running.live.store(false, Ordering::SeqCst);
            running.task.abort();
            tracing::info!("[perch] phone access off");
        }
        self.sync_remote();
    }

    /// Paired devices work while any way in (LAN listener or relay) is on.
    fn sync_remote(&self) {
        self.devices
            .set_remote_enabled(self.enabled() || self.relay_on.load(Ordering::SeqCst));
    }

    pub fn set_relay_on(&self, on: bool) {
        self.relay_on.store(on, Ordering::SeqCst);
        self.sync_remote();
    }

    /// The URLs a phone can try, best first (Tailscale works from anywhere,
    /// the LAN address only on the same Wi-Fi), and Tailscale's state so the
    /// user can be told what to fix. Empty/`None` while access is off.
    pub async fn addresses(&self) -> (Vec<PhoneAddress>, Option<Tailscale>) {
        let port = match (self.always_on, self.running.lock().unwrap().as_ref()) {
            (Some(port), _) => port,
            (None, Some(running)) => running.port,
            (None, None) => return (Vec::new(), None),
        };
        let url = |ip: IpAddr| format!("http://{ip}:{port}{}", self.base_path);
        let mut found = Vec::new();
        let tailscale = tailscale().await;
        let tailnet = match tailscale {
            Tailscale::Running(ip) => Some(ip),
            _ => None,
        };
        if let Some(ip) = tailnet {
            found.push(PhoneAddress {
                kind: "tailscale".into(),
                url: url(ip),
            });
        }
        // Not twice when the default route is the tailnet itself.
        if let Some(ip) = lan_ip().filter(|ip| Some(*ip) != tailnet) {
            found.push(PhoneAddress {
                kind: "lan".into(),
                url: url(ip),
            });
        }
        (found, Some(tailscale))
    }
}

/// What a phone needs from this machine's Tailscale.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tailscale {
    /// No CLI on the PATH and no app bundle.
    Missing,
    /// Installed, but not signed in (or the machine awaits admin approval).
    NeedsLogin,
    /// Installed but off, starting, or not answering.
    Stopped,
    /// Connected, with this tailnet IPv4 address.
    Running(IpAddr),
}

impl Tailscale {
    pub fn wire(self) -> &'static str {
        match self {
            Self::Missing => "missing",
            Self::NeedsLogin => "needsLogin",
            Self::Stopped => "stopped",
            Self::Running(_) => "running",
        }
    }
}

/// The address this machine uses to reach the internet, found by asking the OS
/// which interface it would pick (a UDP `connect` sends nothing). Whether that
/// is a home Wi-Fi, an office network or carrier-grade NAT (100.64/10, which
/// Tailscale shares) is not guessed at; the user sees the address.
fn lan_ip() -> Option<IpAddr> {
    let socket = std::net::UdpSocket::bind((Ipv4Addr::UNSPECIFIED, 0)).ok()?;
    socket.connect((Ipv4Addr::new(192, 0, 2, 1), 9)).ok()?;
    let ip = socket.local_addr().ok()?.ip();
    (!ip.is_loopback() && !ip.is_unspecified()).then_some(ip)
}

/// This machine's Tailscale state, from `tailscale status --json`. The app
/// bundle's binary is tried too because a GUI-only install doesn't put
/// `tailscale` on the PATH (and its CLI only answers while the app runs).
async fn tailscale() -> Tailscale {
    const APP: &str = "/Applications/Tailscale.app";
    let mut found = if std::path::Path::new(APP).exists() {
        Tailscale::Stopped
    } else {
        Tailscale::Missing
    };
    for program in [
        "tailscale",
        "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
    ] {
        let run = tokio::process::Command::new(program)
            .args(["status", "--json"])
            .kill_on_drop(true)
            .output();
        let output = match tokio::time::timeout(Duration::from_secs(2), run).await {
            Ok(Ok(output)) => output,
            Ok(Err(e)) if e.kind() == std::io::ErrorKind::NotFound => continue,
            // Present but hung or unrunnable: installed, not usable.
            _ => {
                if found == Tailscale::Missing {
                    found = Tailscale::Stopped;
                }
                continue;
            }
        };
        // Not the exit status: a stopped daemon still reports its state.
        match parse_status(&output.stdout) {
            running @ Tailscale::Running(_) => return running,
            Tailscale::NeedsLogin => found = Tailscale::NeedsLogin,
            _ if found == Tailscale::Missing => found = Tailscale::Stopped,
            _ => {}
        }
    }
    found
}

/// The state in one `tailscale status --json` answer. Anything unreadable is
/// an installed CLI that couldn't answer, i.e. stopped.
fn parse_status(json: &[u8]) -> Tailscale {
    let Ok(status) = serde_json::from_slice::<serde_json::Value>(json) else {
        return Tailscale::Stopped;
    };
    match status["BackendState"].as_str() {
        Some("Running") => status["Self"]["TailscaleIPs"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|ip| ip.as_str()?.parse::<IpAddr>().ok())
            .find(IpAddr::is_ipv4)
            .map_or(Tailscale::Stopped, Tailscale::Running),
        Some("NeedsLogin" | "NeedsMachineAuth") => Tailscale::NeedsLogin,
        _ => Tailscale::Stopped,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    async fn get(port: u16) -> std::io::Result<String> {
        let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", port)).await?;
        stream
            .write_all(b"GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
            .await?;
        let mut body = String::new();
        stream.read_to_string(&mut body).await?;
        Ok(body)
    }

    #[tokio::test]
    async fn serves_while_on_and_closes_and_locks_devices_when_off() {
        let dir = std::env::temp_dir().join(format!("perch-phone-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let devices = Arc::new(DeviceStore::load(dir.join("devices.json")));
        let access = PhoneAccess::new(None, "/".into(), devices.clone(), 0);
        access.set_router(Router::new().route("/", axum::routing::get(|| async { "hello phone" })));

        // Off at start: nothing listens, no addresses, tokens refused.
        assert!(!access.enabled());
        assert!(access.addresses().await.0.is_empty());
        let code = devices.start_pairing(std::time::Instant::now());
        let paired = devices
            .claim(&code, "p", std::time::Instant::now(), 1)
            .unwrap();
        assert!(devices.authenticate(&paired.token, 2).is_none());

        access.apply(|| true).await.unwrap();
        // A second "on" is a no-op, not a second listener.
        let port_before = access.running.lock().unwrap().as_ref().unwrap().port;
        access.apply(|| true).await.unwrap();
        assert_eq!(
            access.running.lock().unwrap().as_ref().unwrap().port,
            port_before
        );
        assert!(access.enabled());
        assert!(devices.authenticate(&paired.token, 3).is_some());
        let port = access.running.lock().unwrap().as_ref().unwrap().port;
        assert!(get(port).await.unwrap().contains("hello phone"));

        let revoked = devices.subscribe_revocations();
        access.apply(|| false).await.unwrap();
        assert!(!access.enabled());
        assert!(
            revoked.has_changed().unwrap(),
            "open device sockets must be told to close"
        );
        assert!(devices.authenticate(&paired.token, 4).is_none());
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert!(get(port).await.is_err(), "the port must be closed");
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn reads_tailscale_state_from_status_json() {
        let running = br#"{"BackendState":"Running","Self":{"TailscaleIPs":["fd7a:115c::1","100.101.102.103"]}}"#;
        assert_eq!(
            parse_status(running),
            Tailscale::Running("100.101.102.103".parse().unwrap())
        );
        assert_eq!(
            parse_status(br#"{"BackendState":"NeedsLogin","Self":{}}"#),
            Tailscale::NeedsLogin
        );
        assert_eq!(
            parse_status(br#"{"BackendState":"Stopped"}"#),
            Tailscale::Stopped
        );
        // Running without an IPv4 address yet, or a CLI that printed an error.
        assert_eq!(
            parse_status(br#"{"BackendState":"Running","Self":{"TailscaleIPs":[]}}"#),
            Tailscale::Stopped
        );
        assert_eq!(
            parse_status(b"The Tailscale GUI failed to start"),
            Tailscale::Stopped
        );
    }
}

/// A reverse proxy in front of perch (Tailscale Serve is the expected one)
/// connects from loopback, so the peer address alone would make every phone
/// behind it "local" and skip pairing. These are the requests that must still
/// be treated as remote.
#[cfg(test)]
mod proxy_tests {
    use super::super::local_request;
    use axum::http::{HeaderMap, HeaderName, HeaderValue};
    use std::net::SocketAddr;

    fn headers(pairs: &[(&str, &str)]) -> HeaderMap {
        pairs
            .iter()
            .map(|(k, v)| {
                (
                    HeaderName::from_bytes(k.as_bytes()).unwrap(),
                    HeaderValue::from_str(v).unwrap(),
                )
            })
            .collect()
    }

    #[test]
    fn proxied_and_lan_requests_are_never_local() {
        let loopback: SocketAddr = "127.0.0.1:50000".parse().unwrap();
        let lan: SocketAddr = "192.168.1.9:50000".parse().unwrap();
        let own = [("host", "127.0.0.1:47788")];

        // The desktop web view and a curl on this machine.
        assert!(local_request(&loopback, &headers(&own)));
        assert!(local_request(
            &loopback,
            &headers(&[("host", "localhost:47788")])
        ));

        // Tailscale Serve: loopback peer, the tailnet name as Host, identity headers.
        assert!(!local_request(
            &loopback,
            &headers(&[
                ("host", "mac.tail1234.ts.net"),
                ("tailscale-user-login", "me@example.com"),
            ])
        ));
        // A proxy that rewrites Host to the upstream but still says who called.
        for marker in [
            "x-forwarded-for",
            "x-forwarded-proto",
            "x-forwarded-host",
            "forwarded",
            "x-real-ip",
            "via",
            "cf-connecting-ip",
            "tailscale-user-login",
        ] {
            assert!(
                !local_request(&loopback, &headers(&[own[0], (marker, "100.64.0.2")])),
                "{marker} must mark a request as remote"
            );
        }
        // A LAN peer is remote even when it claims a loopback Host.
        assert!(!local_request(&lan, &headers(&own)));
        // Known limit: a proxy that rewrites Host to loopback and adds no header
        // at all looks exactly like a local client, but it still needs a token:
        // the local UI token is something only this machine's own UI holds.
    }
}

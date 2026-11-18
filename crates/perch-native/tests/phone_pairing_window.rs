//! Pairing a phone from the native window, against a real perch-core: Settings > Devices turns on
//! phone access, "Pair a device" asks the core for a code (`device.pair.start`), a fake phone claims
//! that code over HTTP and holds a WebSocket, the window lists the device, and "Revoke" takes it
//! back (`device.revoke`): the phone's token stops working and its socket closes.
//!
//! The window's requests pass through a tap on their way to the core's connection, so the test reads
//! the code from the core's own answer and checks which questions the window asked. A pairing
//! request the client's whitelist (`client.rs`, `ASKS`) does not carry never reaches the core, so no
//! code comes back and the test fails. The page's buttons carry no probe names, so each is found by
//! clicking across the Devices card until the core has been asked what the button asks.
//!
//! The core is a child of this test, private to a scratch directory, and phone access opens on any
//! free port (`PERCH_PHONE_PORT=0`). Nothing is shown or focused; no agent runs.

mod common;

use common::{Harness, Rig};
use futures::channel::mpsc::unbounded;
use futures::{SinkExt, StreamExt};
use gpui::{
    point, px, Modifiers, MouseButton, MouseDownEvent, MouseUpEvent, PlatformInput, Window,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_native::client::{follow, Command as Order};
use perch_native::mods;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;

fn main() {
    common::run("phone_pairing_window", window);
}

/// What the window asked of the core and what the core answered, in order.
#[derive(Default)]
struct Tap {
    asked: Vec<String>,
    answers: Vec<(String, Result<Value, String>)>,
}

type Taps = Arc<Mutex<Tap>>;

fn asked(tap: &Taps, kind: &str) -> usize {
    tap.lock()
        .unwrap()
        .asked
        .iter()
        .filter(|k| *k == kind)
        .count()
}

/// The latest answer to a question of `kind` that satisfies `pick`.
fn answer(tap: &Taps, kind: &str, pick: impl Fn(&Value) -> bool) -> Option<Value> {
    let tap = tap.lock().unwrap();
    tap.answers
        .iter()
        .rev()
        .filter(|(k, _)| k == kind)
        .filter_map(|(_, a)| a.as_ref().ok())
        .find(|a| pick(a))
        .cloned()
}

fn records(h: &mut Harness) -> Vec<ProbeRecord> {
    h.cx.run_until_parked();
    h.cx.update_window(h.window.into(), |_, window: &mut Window, cx| {
        probe::clear();
        window.refresh();
        let _ = window.draw(cx);
    })
    .unwrap();
    probe::records().into_values().collect()
}

fn click_at(h: &mut Harness, x: f32, y: f32) {
    let at = point(px(x), px(y));
    h.cx.update_window(h.window.into(), |_, window: &mut Window, cx| {
        for input in [
            PlatformInput::MouseDown(MouseDownEvent {
                button: MouseButton::Left,
                position: at,
                modifiers: Modifiers::default(),
                click_count: 1,
                first_mouse: false,
            }),
            PlatformInput::MouseUp(MouseUpEvent {
                button: MouseButton::Left,
                position: at,
                modifiers: Modifiers::default(),
                click_count: 1,
            }),
        ] {
            window.dispatch_event(input, cx);
        }
    })
    .unwrap();
    h.cx.run_until_parked();
}

/// The Devices page's own card: the last Settings group drawn (Phone access is the first).
fn devices_card(h: &mut Harness) -> gpui::Bounds<gpui::Pixels> {
    records(h)
        .into_iter()
        .filter(|r| r.name.starts_with("settings-group-card"))
        .max_by(|a, b| f32::from(a.bounds.origin.y).total_cmp(&f32::from(b.bounds.origin.y)))
        .expect("the Devices page draws its card")
        .bounds
}

/// Click across the Devices card, row by row, until the core has been asked `kind` more times than
/// before. The buttons are the card's only things that answer a click.
fn press_button_asking(h: &mut Harness, tap: &Taps, kind: &str) {
    let before = asked(tap, kind);
    // From the bottom right up and left: Revoke sits at the end of the list's last row, below Cancel and
    // Pair a device, which would otherwise be pressed first and move the card under the sweep.
    for _ in 0..2 {
        let card = devices_card(h);
        let (left, top) = (f32::from(card.origin.x), f32::from(card.origin.y));
        let (width, height) = (f32::from(card.size.width), f32::from(card.size.height));
        let mut y = top + height - 8.;
        while y > top {
            let mut x = left + width - 12.;
            while x > left {
                click_at(h, x, y);
                // The click's request goes through the window's channel and the tap on the runtime.
                std::thread::sleep(Duration::from_millis(2));
                if asked(tap, kind) > before {
                    return;
                }
                x -= 24.;
            }
            h.pump();
            y -= 8.;
        }
    }
    panic!("no button of the Devices page asked the core for {kind}");
}

/// One HTTP/1.0 exchange with the core's phone listener: the status and the JSON body.
async fn http(
    port: u16,
    method: &str,
    path: &str,
    cookie: Option<&str>,
    body: Option<&Value>,
) -> (u16, Value) {
    let body = body.map(Value::to_string).unwrap_or_default();
    let cookie = cookie.map_or(String::new(), |c| format!("Cookie: perch_device={c}\r\n"));
    let request = format!(
        "{method} {path} HTTP/1.0\r\nHost: 127.0.0.1:{port}\r\n{cookie}Content-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
        body.len()
    );
    let mut stream = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
    stream.write_all(request.as_bytes()).await.unwrap();
    let mut response = String::new();
    stream.read_to_string(&mut response).await.unwrap();
    let (head, text) = response.split_once("\r\n\r\n").unwrap_or((&response, ""));
    let status = head.split_whitespace().nth(1).unwrap().parse().unwrap();
    (status, serde_json::from_str(text).unwrap_or(Value::Null))
}

fn window(rig: &mut Rig) {
    // The core opens phone access on any free port, not the one a real install keeps.
    std::env::set_var("PERCH_PHONE_PORT", "0");
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    let (_, core) = rig.start_core(&runtime);

    // The tap sits between the window and the follower.
    let tap = Taps::default();
    let (commands, mut from_window) = unbounded::<Order>();
    let (mut to_core, to_follow) = unbounded::<Order>();
    let log = tap.clone();
    runtime.spawn(async move {
        while let Some(order) = from_window.next().await {
            let order = match order {
                Order::Ask { frame, reply } => {
                    let kind = frame["type"].as_str().unwrap_or_default().to_string();
                    log.lock().unwrap().asked.push(kind.clone());
                    let (mine, theirs) =
                        futures::channel::oneshot::channel::<Result<Value, String>>();
                    let log = log.clone();
                    tokio::spawn(async move {
                        if let Ok(got) = theirs.await {
                            log.lock().unwrap().answers.push((kind, got.clone()));
                            let _ = reply.send(got);
                        }
                    });
                    Order::Ask { frame, reply: mine }
                }
                other => other,
            };
            if to_core.send(order).await.is_err() {
                return;
            }
        }
    });
    let (update_tx, updates) = unbounded();
    let followed = core.clone();
    let _follower = runtime.spawn(follow(
        move || Ok(followed.clone()),
        to_follow,
        update_tx,
        Duration::from_millis(100),
    ));
    let mut h = Harness::new(core, commands, updates);
    let user = rig.scratch.join("native-mods");
    let workspace = h.window.entity(&h.cx).unwrap();
    let handle = h.window.into();
    h.cx.update(|cx| mods::start_in(user, &workspace, handle, cx));

    // Settings > Devices.
    h.wait("the core's settings", |h| h.settings().is_some());
    assert!(h.press("cmd-,"), "Cmd+, is the window's");
    assert_eq!(h.ws(|ws, _| ws.screens_open()), ["settings"]);
    h.wait("the Devices section", |h| {
        records(h).iter().any(|r| r.name == "settings-nav:devices")
    });
    let nav = records(&mut h)
        .into_iter()
        .find(|r| r.name == "settings-nav:devices")
        .unwrap();
    let at = nav.bounds.center();
    click_at(&mut h, f32::from(at.x), f32::from(at.y));
    h.wait("the Devices page asking the core", |_| {
        asked(&tap, "device.list") > 0 && asked(&tap, "phone.access.get") > 0
    });
    assert_eq!(
        h.ws(|ws, cx| ws.screen_error("settings", cx)),
        None,
        "Settings renders"
    );

    // Phone access is off until it is turned on: the core is told, and says where a phone can reach it.
    h.send(Order::UpdateSettings(json!({"phoneAccess": true})));
    let mut status = None;
    h.wait("phone access on, with an address", |_| {
        status = answer(&tap, "phone.access.get", |a| {
            a["enabled"] == json!(true) && a["addresses"].as_array().is_some_and(|a| !a.is_empty())
        });
        status.is_some()
    });
    let url = status.unwrap()["addresses"][0]["url"]
        .as_str()
        .unwrap()
        .to_string();
    let port: u16 = url
        .trim_start_matches("http://")
        .split('/')
        .next()
        .and_then(|authority| authority.rsplit(':').next())
        .and_then(|port| port.parse().ok())
        .unwrap_or_else(|| panic!("a port in the phone address {url}"));

    // "Pair a device": the window asks the core for a code, which the core answers.
    h.settle();
    h.wait("the Pair a device button", |h| {
        h.pump();
        records(h).iter().any(|r| r.name == "settings-group-card@1")
    });
    press_button_asking(&mut h, &tap, "device.pair.start");
    let mut code = None;
    h.wait("the core's pairing code", |_| {
        code = answer(&tap, "device.pair.start", |a| a["code"].is_string());
        code.is_some()
    });
    let code = code.unwrap()["code"].as_str().unwrap().to_string();
    assert_eq!(code.len(), 8, "a code of eight characters: {code}");

    // The fake phone: a wrong code is refused, the right one pairs and opens a socket.
    let (wrong, _) = runtime.block_on(http(
        port,
        "POST",
        "/pair",
        None,
        Some(&json!({"code": "22222222", "name": "fake phone"})),
    ));
    assert_eq!(wrong, 403, "a wrong code is refused");
    let (status, paired) = runtime.block_on(http(
        port,
        "POST",
        "/pair",
        None,
        Some(&json!({"code": code, "name": "fake phone"})),
    ));
    assert_eq!(status, 200, "the phone pairs: {paired}");
    let token = paired["token"]
        .as_str()
        .expect("a device token")
        .to_string();
    let device_id = paired["deviceId"].as_str().unwrap().to_string();
    let (_, gate) = runtime.block_on(http(port, "GET", "/pair", Some(&token), None));
    assert_eq!(
        gate["paired"],
        json!(true),
        "the token opens the phone's gate"
    );
    let mut request = format!("ws://127.0.0.1:{port}/ws")
        .into_client_request()
        .unwrap();
    request
        .headers_mut()
        .insert("cookie", format!("perch_device={token}").parse().unwrap());
    let mut phone = runtime.block_on(async {
        let (socket, _) = tokio_tungstenite::connect_async(request)
            .await
            .expect("the paired phone's socket opens");
        socket
    });
    assert!(
        runtime
            .block_on(async { tokio::time::timeout(Duration::from_secs(10), phone.next()).await })
            .expect("the core greets the phone")
            .is_some(),
        "the core sends the phone something"
    );

    // The window lists the paired device (it asks again while the code shows), by its id.
    h.wait("the paired device in the window's list", |_| {
        answer(&tap, "device.list", |a| {
            a["devices"]
                .as_array()
                .is_some_and(|d| d.iter().any(|d| d["id"] == json!(device_id)))
        })
        .is_some()
    });
    // The page draws a row with its Revoke button once it has the list.
    h.settle();

    // "Revoke": the window asks, the core drops the device, the phone is out.
    press_button_asking(&mut h, &tap, "device.revoke");
    h.wait("the core's answer to the revoke", |_| {
        answer(&tap, "device.revoke", |a| {
            a["devices"].as_array().is_some_and(|d| d.is_empty())
        })
        .is_some()
    });
    let (_, gate) = runtime.block_on(http(port, "GET", "/pair", Some(&token), None));
    assert_eq!(
        gate["paired"],
        json!(false),
        "the revoked token opens nothing"
    );
    let closed = Instant::now();
    runtime.block_on(async {
        loop {
            match tokio::time::timeout(Duration::from_secs(10), phone.next()).await {
                Ok(None) | Ok(Some(Err(_))) | Ok(Some(Ok(Message::Close(_)))) => break,
                Ok(Some(Ok(_))) => continue,
                Err(_) => panic!("the revoked phone's socket is still open"),
            }
        }
    });
    assert!(closed.elapsed() < Duration::from_secs(10));
    h.close();
}

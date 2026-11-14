//! A phone holding a terminal's size, against a real perch-core: a paired device (a second client
//! with a device token) takes the size of the shell the window shows, the window's stock
//! phone-size notice appears over the pane with `pending` following the take-back in flight, and
//! "Take back this tab" and "Take back all tabs" each give the size back to the window.
//!
//! The device is paired in the core's own store before it starts. Paired devices are let in only
//! while a way in for them is on; the relay is set to a loopback address nothing listens on, which
//! turns that on without opening a listener of any kind. Everything else is `common`'s: the core
//! is a child of this test, private to a scratch directory, and stopped and checked gone by PID.

mod common;

use common::{Harness, Rig};
use perch_core::devices::DeviceStore;
use perch_native::client::{follow, Core};
use perch_native::mods::{self, WindowMods};
use serde_json::Value;
use std::time::{Duration, Instant};

fn main() {
    common::run("workspace_phone_hold", window);
}

/// The phone-size notice over tab `id`'s pane, when the window draws it: its props.
fn notice(h: &mut Harness, id: &str) -> Option<Value> {
    let key = format!("phone-size#{id}");
    h.ws(|ws, _| ws.screen_view(&key).is_some())
        .then(|| {
            h.cx.update(|cx| cx.global::<WindowMods>().perch.props_of(&key))
        })
        .flatten()
}

fn window(rig: &mut Rig) {
    // A paired phone, and a way in for it that opens nothing (see the module doc).
    let paired = {
        let devices = DeviceStore::load(rig.scratch.join("devices.json"));
        let code = devices.start_pairing(Instant::now());
        devices
            .claim(&code, "Test phone", Instant::now(), 1)
            .expect("pair the phone")
    };
    std::fs::write(
        rig.scratch.join("settings.json"),
        r#"{"relayUrl": "http://127.0.0.1:9"}"#,
    )
    .unwrap();

    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    let (base, core) = rig.start_core(&runtime);
    let shell = runtime.block_on(async {
        let mut connection = core.connect().await.expect("connect");
        let session_id = connection.create_session(None, None).await.expect("create");
        let terminal = connection
            .open_terminal(&session_id, 80, 24)
            .await
            .expect("open terminal");
        connection.release_terminal(&terminal).await.unwrap();
        session_id
    });

    let (commands, command_rx) = futures::channel::mpsc::unbounded();
    let (update_tx, updates) = futures::channel::mpsc::unbounded();
    let followed = core.clone();
    let follower = runtime.spawn(follow(
        move || Ok(followed.clone()),
        command_rx,
        update_tx,
        Duration::from_millis(100),
    ));
    let mut h = Harness::new(core, commands, updates);
    // The stock mods, so the notice is the window's own screen.
    let user = rig.scratch.join("native-mods");
    let workspace = h.window.entity(&h.cx).unwrap();
    let handle = h.window.into();
    h.cx.update(|cx| mods::start_in(user, &workspace, handle, cx));

    h.wait("the session to be listed", |h| {
        h.attention(&shell).is_some()
    });
    h.show_tab(&shell);
    h.wait("the shell", |h| h.ready(&shell));
    let own = h.fitted(&shell);
    h.wait("the shell sized to its pane", |h| h.grid(&shell) == own);
    assert!(
        notice(&mut h, &shell).is_none(),
        "the window holds the size"
    );

    // The phone watches the same shell and takes its size.
    let phone_core = Core::with_token(&base, &paired.token).expect("the phone's credential");
    let (mut phone, mut held) = runtime.block_on(async {
        let mut phone = phone_core.connect().await.expect("the phone connects");
        let mut held = phone
            .open_terminal(&shell, 40, 20)
            .await
            .expect("the phone watches the shell");
        assert!(!held.owns_resize(), "the window holds the size");
        phone.take_resize(&mut held).await.expect("take the size");
        assert!(held.owns_resize(), "the phone holds the size");
        phone
            .terminal_resize(&held, 40, 20)
            .await
            .expect("size the shell");
        (phone, held)
    });
    h.wait("the phone's size in the window", |h| {
        h.grid(&shell) == (40, 20)
    });
    h.wait("the phone-size notice", |h| notice(h, &shell).is_some());
    let first = notice(&mut h, &shell).unwrap();
    assert_eq!(first["pending"], false, "{first}");
    assert_eq!(
        h.view(&shell, |v| v.can_type()),
        Some(true),
        "typing is shared"
    );

    // Take back this tab: pending while the core has not answered, then the input and the size
    // are the window's and the notice goes.
    h.window
        .update(&mut h.cx, |ws, window, cx| {
            ws.run_command(
                "terminal.takeBack",
                Some(&serde_json::json!({ "id": shell })),
                window,
                cx,
            )
        })
        .unwrap()
        .expect("take back this tab");
    h.draw();
    let asked = notice(&mut h, &shell).expect("the notice stays until the core answers");
    assert_eq!(asked["pending"], true, "{asked}");
    h.wait("the size back in the window", |h| {
        notice(h, &shell).is_none() && h.grid(&shell) == own
    });
    assert_eq!(h.view(&shell, |v| v.taking()), Some(false));

    // The phone takes it again: the notice is back, a new hold. Take back all tabs gives the
    // window the size alone.
    runtime.block_on(async {
        phone
            .take_resize(&mut held)
            .await
            .expect("take the size again");
        phone
            .terminal_resize(&held, 40, 20)
            .await
            .expect("size the shell");
    });
    h.wait("the notice again", |h| notice(h, &shell).is_some());
    let again = notice(&mut h, &shell).unwrap();
    assert!(
        again["generation"].as_u64() > first["generation"].as_u64(),
        "a new hold: {first} then {again}"
    );
    assert_eq!(again["pending"], false);
    h.window
        .update(&mut h.cx, |ws, window, cx| {
            ws.run_command("terminal.takeBackAll", None, window, cx)
        })
        .unwrap()
        .expect("take back all tabs");
    h.wait("the size back for all tabs", |h| {
        notice(h, &shell).is_none() && h.grid(&shell) == own
    });
    // With nothing held, there is nothing to take.
    let none = h
        .window
        .update(&mut h.cx, |ws, window, cx| {
            ws.run_command("terminal.takeBackAll", None, window, cx)
        })
        .unwrap();
    assert!(none.is_err(), "nothing left to take back");

    runtime.block_on(async {
        phone.release_terminal(&held).await.unwrap();
    });
    drop(phone);
    h.close();
    follower.abort();
    drop(runtime);
}

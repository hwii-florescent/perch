//! Engine slots in a real (offscreen) window: a mod places a kind registered from Rust by key through
//! `perch-engine` (`Engine.new(key, { engine })`). Checks the contract every engine builds on: the kind draws the
//! key's element in the slot, `focus(engine, key)` gives it the keyboard and `focused()` says so, keys typed then go
//! to the engine, `release(engine, key)` reaches the kind's release hook, and an unknown kind draws an empty box
//! without failing the screen.

use gpui::{
    px, size, AppContext as _, HeadlessAppContext, Modifiers, PlatformInput, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_native::mods::engines::StubEngine;
use perch_native::mods::{self, WindowMods, POLL};
use perch_native::sidebar::State;
use perch_native::ui::Workspace;
use serde_json::json;
use std::path::PathBuf;
use std::sync::Arc;

const SCREEN: &str = r##"
import { View, div } from "gpui-kit";
import * as engine from "perch-engine";
export default class extends View {
  init() { this.released = false; }
  render() {
    const at = engine.focused();
    const label = at ? `${at.engine}-${at.key}` : "none";
    let root = div().id("root").size_full().flex().flex_col()
      .child(div().id(`focused-${label}`).h(1).w(1))
      .child(div().id("focus-button").h(20).w(100).on_click((_e, cx) => { engine.focus("stub", "k1"); cx.notify(); }))
      .child(div().id("release-button").h(20).w(100).on_click((_e, cx) => { engine.release("stub", "k1"); this.released = true; cx.notify(); }))
      .child(div().id("missing").h(20).w(20).child(engine.Engine.new("x", { engine: "no-such-kind" })));
    if (!this.released) root = root.child(div().id("slot").h(100).w(200).child(engine.Engine.new("k1", { engine: "stub" })));
    return root;
  }
}
"##;

struct Rig {
    cx: HeadlessAppContext,
    window: WindowHandle<Workspace>,
}

impl Rig {
    fn win<R>(&mut self, f: impl FnOnce(&mut Window, &mut gpui::App) -> R) -> R {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                f(window, cx)
            })
            .unwrap()
    }

    fn step(&mut self) -> Vec<ProbeRecord> {
        self.cx.advance_clock(POLL);
        self.cx.run_until_parked();
        self.win(|window, cx| {
            probe::clear();
            window.refresh();
            let _ = window.draw(cx);
        });
        probe::records().into_values().collect()
    }

    fn find(&mut self, name: &str) -> Option<gpui::Bounds<gpui::Pixels>> {
        self.step()
            .into_iter()
            .find(|r| r.name.as_ref() == name)
            .map(|r| r.bounds)
    }

    fn until(&mut self, name: &str) -> gpui::Bounds<gpui::Pixels> {
        for _ in 0..200 {
            if let Some(bounds) = self.find(name) {
                return bounds;
            }
        }
        panic!("{name} is never drawn");
    }

    fn click(&mut self, name: &str) {
        let at = self.until(name).center();
        self.win(|window, cx| {
            for input in [
                PlatformInput::MouseDown(gpui::MouseDownEvent {
                    button: gpui::MouseButton::Left,
                    position: at,
                    modifiers: Modifiers::default(),
                    click_count: 1,
                    first_mouse: false,
                }),
                PlatformInput::MouseUp(gpui::MouseUpEvent {
                    button: gpui::MouseButton::Left,
                    position: at,
                    modifiers: Modifiers::default(),
                    click_count: 1,
                }),
            ] {
                window.dispatch_event(input, cx);
            }
        });
        self.step();
    }

    fn key(&mut self, key: &str) {
        let key = gpui::Keystroke::parse(key).unwrap();
        self.win(|window, cx| {
            window.dispatch_keystroke(key, cx);
        });
        self.step();
    }
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-mods-engines-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    let user = scratch.join("native-mods");
    std::fs::create_dir_all(user.join("instructions")).unwrap();
    std::fs::write(
        user.join("instructions/mod.json"),
        r#"{ "name": "Engine slots" }"#,
    )
    .unwrap();
    std::fs::write(user.join("instructions/main.js"), SCREEN).unwrap();

    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let (tx, _asked) = futures::channel::mpsc::unbounded();
    let mut state = State::default();
    state.connect();
    let model = state.model();
    let window = cx
        .open_window(size(px(1024.), px(600.)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user.clone(), &workspace, window.into(), cx));
    let stub = StubEngine::default();
    cx.update(|cx| {
        cx.global::<WindowMods>()
            .engines
            .register("stub", stub.clone())
    });
    let mut rig = Rig { cx, window };
    let opened = rig
        .window
        .update(&mut rig.cx, |ws, _, cx| {
            ws.open_screen("instructions", json!({}), None, None, cx)
        })
        .unwrap();
    assert!(opened, "the screen is drawn in the instructions slot");

    // The kind draws the key's element in its slot; an unknown kind leaves an empty box and the screen works.
    rig.until("slot");
    assert!(stub.draws("k1") > 0, "the kind draws its key in the slot");
    rig.until("focused-none");
    let error = rig
        .window
        .update(&mut rig.cx, |ws, _, cx| ws.screen_error("instructions", cx))
        .unwrap();
    assert!(
        error.is_none(),
        "an unknown kind does not fail the screen: {error:?}"
    );
    println!("ok: a registered kind draws its key in the slot; an unknown kind draws nothing");

    // `focus(engine, key)` gives it the keyboard, `focused()` reports it, and typed keys reach it.
    rig.click("focus-button");
    rig.until("focused-stub-k1");
    rig.key("a");
    rig.key("b");
    assert_eq!(stub.keys("k1"), 2, "keys typed go to the focused engine");
    println!("ok: focus(engine, key) gives the engine the keyboard and focused() says so");

    rig.click("release-button");
    assert_eq!(
        stub.released(),
        vec!["k1".to_string()],
        "release reaches the kind"
    );
    rig.until("focused-none");
    println!("ok: release(engine, key) reaches the kind's release hook");

    let _ = std::fs::remove_dir_all(&scratch);
    println!("mods_engines: ok");
}

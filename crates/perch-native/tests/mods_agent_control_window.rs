//! The web's agent terminal controls (`stock:agent-control`, unchanged, on the native React
//! runtime) over a terminal pane in a real window, driven by what the core says on the terminal's
//! connection, as the web's `PersistentAgentTerminal` works them out on a desktop:
//!
//! - another view typing: the chip says so with Take control, which asks the core for the leases
//!   and says "Taking control…" (disabled) until the core answers; once this view has them the
//!   chip goes;
//! - a dropped connection the window reattaches: "Reconnecting…", Take control disabled, nothing
//!   restarted;
//! - an attach the core refused: "Agent unavailable" with its reason, and Retry CLI attaches again
//!   only on the click;
//! - the shell ended: the banner with Restart CLI, which attaches again, and Close session, which
//!   asks the core to delete the session (the tab waits for the core); a hibernated agent's banner
//!   offers Resume agent.
//!
//! Offscreen, as the other render tests: no window is shown or focused, and no core runs. The
//! terminal's connection is a pair of channels this test answers on; the core the window finds
//! for a restart refuses connections, so an attach starts and fails without reaching anything.

use futures::channel::mpsc::{unbounded, UnboundedReceiver, UnboundedSender};
use gpui::{
    px, size, AppContext as _, HeadlessAppContext, Modifiers, MouseButton, MouseDownEvent,
    MouseUpEvent, PlatformInput, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_core::agent_fleet::AgentState;
use perch_core::protocol::ServerMessage;
use perch_native::client::{Command, Core};
use perch_native::mods::{self, POLL};
use perch_native::sidebar::State;
use perch_native::terminal::attach::{AgentInfo, FromCore, ToCore};
use perch_native::terminal::view::{Status, TerminalView};
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;

const WIDTH: f32 = 1000.;
const HEIGHT: f32 = 700.;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

/// `alpha`, a Claude session on this computer.
fn state() -> State {
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "server.info", "hostname": "studio", "isSsh": false, "platform": "macOS",
        "capabilities": []})));
    state.apply(&message(json!({"type": "session.list", "sessions": [{
        "id": "alpha", "title": "alpha", "cwd": "/work", "createdAt": 0, "status": "idle",
        "hostId": "local", "cliProviderId": "claude"}]})));
    state
}

struct Rig {
    cx: HeadlessAppContext,
    window: WindowHandle<Workspace>,
    asked: UnboundedReceiver<Command>,
}

impl Rig {
    fn ws<R>(
        &mut self,
        f: impl FnOnce(&mut Workspace, &mut Window, &mut gpui::Context<Workspace>) -> R,
    ) -> R {
        self.window
            .update(&mut self.cx, |ws, window, cx| f(ws, window, cx))
            .unwrap()
    }

    fn view<R>(
        &mut self,
        f: impl FnOnce(&mut TerminalView, &mut gpui::Context<TerminalView>) -> R,
    ) -> R {
        self.ws(|ws, _, cx| {
            let view = ws.terminal().expect("a terminal on screen").clone();
            view.update(cx, f)
        })
    }

    /// Draws the window afresh, letting the mod's loads, React's commits and deferred calls
    /// settle first, and returns what the mod named.
    fn draw(&mut self) -> Vec<ProbeRecord> {
        for _ in 0..4 {
            self.cx.advance_clock(POLL);
            self.cx.run_until_parked();
            self.cx
                .update_window(self.window.into(), |_, window: &mut Window, cx| {
                    probe::clear();
                    window.refresh();
                    let _ = window.draw(cx);
                })
                .unwrap();
        }
        probe::records().into_values().collect()
    }

    /// The names the agent's controls drew.
    fn drawn(&mut self) -> Vec<String> {
        let mut names: Vec<String> = self
            .draw()
            .into_iter()
            .map(|r| r.name.to_string())
            .filter(|n| n.starts_with("agent-control"))
            .collect();
        names.sort();
        names
    }

    fn click(&mut self, name: &str) {
        let at = self
            .draw()
            .into_iter()
            .find(|r| r.name == name)
            .unwrap_or_else(|| panic!("{name} is drawn"))
            .bounds
            .center();
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_event(
                    PlatformInput::MouseDown(MouseDownEvent {
                        button: MouseButton::Left,
                        position: at,
                        modifiers: Modifiers::default(),
                        click_count: 1,
                        first_mouse: false,
                    }),
                    cx,
                );
                window.dispatch_event(
                    PlatformInput::MouseUp(MouseUpEvent {
                        button: MouseButton::Left,
                        position: at,
                        modifiers: Modifiers::default(),
                        click_count: 1,
                    }),
                    cx,
                );
            })
            .unwrap();
        self.cx.run_until_parked();
        self.draw();
    }

    /// What the window asked the core for since the last call.
    fn asked(&mut self) -> Vec<Command> {
        std::iter::from_fn(|| self.asked.try_recv().ok()).collect()
    }

    /// Joins the terminal on screen to channels this test answers on, attached with the leases
    /// and agent given.
    fn link(&mut self, agent: AgentInfo) -> (UnboundedReceiver<ToCore>, UnboundedSender<FromCore>) {
        let (to_core, sent) = unbounded();
        let (core, from_core) = unbounded();
        self.view(|view, cx| view.link(to_core, from_core, cx));
        core.unbounded_send(FromCore::Attached {
            replay: String::new(),
            input: agent.input,
            resize: agent.resize,
            agent: Some(agent),
        })
        .unwrap();
        self.cx.run_until_parked();
        (sent, core)
    }

    fn say(&mut self, core: &UnboundedSender<FromCore>, event: FromCore) {
        core.unbounded_send(event).unwrap();
        self.cx.run_until_parked();
        self.draw();
    }
}

fn agent(state: AgentState, input: bool, input_elsewhere: bool) -> AgentInfo {
    AgentInfo {
        state,
        input,
        resize: input,
        input_elsewhere,
        resize_on_device: false,
    }
}

fn sent(rx: &mut UnboundedReceiver<ToCore>) -> Vec<ToCore> {
    std::iter::from_fn(|| rx.try_recv().ok()).collect()
}

fn label(rig: &mut Rig) -> Value {
    rig.view(|v, _| v.agent_control()["label"].clone())
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-agent-control-window-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    let user = scratch.join("native-mods");

    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let (tx, asked) = unbounded();
    let model = state().model();
    let window = cx
        .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
            cx.new(|cx| {
                // A core that refuses connections: a restart's attach starts and fails here.
                Workspace::new(model, Some(tx), cx)
                    .with_core(|| Core::with_token("http://127.0.0.1:9/", "test"))
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user, &workspace, window.into(), cx));
    let mut rig = Rig { cx, window, asked };
    rig.ws(|ws, _, cx| {
        ws.sidebar().update(cx, |s, cx| {
            s.open("local".into(), "alpha".into(), Some("claude".into()), cx)
        })
    });
    rig.draw();

    // Another view types in this agent: the chip says so, with Take control.
    let (mut to_core, core) = rig.link(agent(AgentState::Idle, false, true));
    let drawn = rig.drawn();
    assert!(
        drawn.iter().any(|n| n == "agent-control-chip")
            && drawn.iter().any(|n| n.starts_with("agent-control-button")),
        "the chip with its button: {drawn:?}"
    );
    assert_eq!(label(&mut rig), "Another view is typing in this agent");
    sent(&mut to_core);
    let button = drawn
        .iter()
        .find(|n| n.starts_with("agent-control-button"))
        .unwrap()
        .clone();
    rig.click(&button);
    assert_eq!(
        sent(&mut to_core),
        [ToCore::TakeControl],
        "Take control asks the core"
    );
    assert_eq!(
        rig.view(|v, _| v.agent_control()["control"].clone()),
        json!({"label": "Taking control\u{2026}", "disabled": true}),
        "until the core answers"
    );
    rig.click(&button);
    assert_eq!(sent(&mut to_core), [], "a disabled button asks nothing");
    // The core gives this view the leases: the chip goes.
    rig.say(&core, FromCore::Agent(agent(AgentState::Idle, true, false)));
    assert_eq!(
        rig.drawn(),
        Vec::<String>::new(),
        "nothing over the terminal"
    );
    assert!(rig.ws(|ws, _, _| ws.screen_view("agent-control#alpha").is_none()));

    // The connection drops and the window will attach again: nothing is restarted, and the chip
    // says the window is waiting, its Take control disabled.
    rig.view(|v, _| v.expect_reconnect(true));
    rig.say(&core, FromCore::Disconnected("the core went away".into()));
    assert_eq!(label(&mut rig), "Reconnecting\u{2026}");
    let control = rig.view(|v, _| v.agent_control());
    assert_eq!(control["control"]["disabled"], true);
    assert_eq!(
        (control["retry"].clone(), control["ended"].clone()),
        (json!(false), Value::Null)
    );
    assert!(rig.drawn().iter().any(|n| n == "agent-control-chip"));
    assert!(
        rig.view(|v, cx| !v.restart(Core::with_token("http://127.0.0.1:9/", "test").unwrap(), cx)),
        "a drop is never started over"
    );

    // An attach the core refused: the chip says the agent is unavailable, with Retry CLI and the
    // core's reason on the error line. Only the click attaches again.
    let (_to_core, core) = rig.link(agent(AgentState::Idle, true, false));
    rig.say(
        &core,
        FromCore::Failed("the session is no longer available".into()),
    );
    assert_eq!(label(&mut rig), "Agent unavailable");
    let drawn = rig.drawn();
    assert!(
        drawn.iter().any(|n| n.starts_with("agent-control-error")),
        "{drawn:?}"
    );
    rig.draw();
    assert!(
        matches!(rig.view(|v, _| v.status().clone()), Status::Failed(_)),
        "nothing retried by itself"
    );
    let retry = drawn
        .iter()
        .find(|n| n.starts_with("agent-control-button"))
        .expect("Retry CLI")
        .clone();
    rig.click(&retry);
    assert!(
        !matches!(rig.view(|v, _| v.status().clone()), Status::Failed(_)),
        "Retry CLI attaches again"
    );

    // The shell ends: the banner, no chip. Close session asks the core to delete the session,
    // and the tab waits for the core; Restart CLI attaches again.
    let (_to_core, core) = rig.link(agent(AgentState::Idle, true, false));
    rig.say(&core, FromCore::Exited(1));
    let drawn = rig.drawn();
    assert!(
        drawn.iter().any(|n| n == "agent-control-ended:cli-exited"),
        "{drawn:?}"
    );
    assert!(!drawn.iter().any(|n| n == "agent-control-chip"));
    rig.asked();
    rig.click("agent-control-ended-button:cli-close-session");
    assert!(
        rig.asked()
            .iter()
            .any(|c| matches!(c, Command::DeleteSession { session_id } if session_id == "alpha")),
        "Close session asks the core"
    );
    assert!(
        rig.ws(|ws, _, _| ws.tabs().contains("alpha")),
        "the tab waits for the core"
    );
    rig.click("agent-control-ended-button:cli-restart");
    assert!(
        !matches!(rig.view(|v, _| v.status().clone()), Status::Exited(_)),
        "Restart CLI attaches again"
    );

    // A hibernated agent's banner offers Resume agent, with no exit code.
    let (_to_core, core) = rig.link(agent(AgentState::Sleeping, true, false));
    rig.say(&core, FromCore::Exited(0));
    let drawn = rig.drawn();
    assert!(
        drawn
            .iter()
            .any(|n| n == "agent-control-ended:cli-sleeping"),
        "{drawn:?}"
    );
    assert!(
        drawn
            .iter()
            .any(|n| n == "agent-control-ended-button:cli-resume"),
        "{drawn:?}"
    );
    rig.click("agent-control-ended-button:cli-resume");
    assert!(
        !matches!(rig.view(|v, _| v.status().clone()), Status::Exited(_)),
        "resumed"
    );

    rig.cx
        .update_window(rig.window.into(), |_, window, _| window.remove_window())
        .unwrap();
    rig.cx.run_until_parked();
    let _ = std::fs::remove_dir_all(&scratch);
    println!("mods_agent_control_window: ok");
}

//! Context Bridge in the window (`docs/CONTEXT-BRIDGE.md`): the terminal selection's Ask agent menu and the dialog
//! that prepares context and sends it to an agent only on Send. The screen is `stock:context-bridge` (the web's
//! `stock-ui/context-bridge`, on the React runtime); the send is the window's, as the web's is `ContextBridge.tsx`'s:
//! one capture is one intent with one operation id, sent at most once and never retried after an uncertain answer, so
//! a copy of the screen swapped in mid-send sees the send as made and cannot send again.
//!
//! Preview goes to the core on the window's connection; it takes no lease. A send goes on the connection of the
//! agent's own terminal when this window shows it and holds its input (each native terminal is a connection of its
//! own, and the core refuses a send from any other while one holds the input, as it refuses another view's);
//! otherwise on the window's, where the core decides.

use super::*;
use crate::sidebar::navigation::Store;
use crate::terminal::context::{CAPABILITY, DROPPED, UNCONFIRMED, WAIT};
use futures::channel::oneshot;
use perch_core::context_bridge::ContextSource;

type Answer = oneshot::Receiver<Result<Value, String>>;

/// The screen's id.
const SCREEN: &str = "context-bridge";

/// The bridge is offered for workspace `workspace_id`: this computer's core can do it and the workspace is a known
/// local one (the web's `contextBridgeAvailable`). Remote workspaces are never guessed from paths.
pub fn bridge_available(store: &Store, workspace_id: &str) -> bool {
    store.local_capabilities.iter().any(|c| c == CAPABILITY)
        && store
            .workspaces
            .iter()
            .any(|w| w.id == workspace_id && w.host_id == LOCAL)
}

#[derive(Default)]
pub(super) struct Bridge {
    menu: Option<Menu>,
    capture: Option<Capture>,
    send: SendState,
    /// The terminal's right-click opened the menu: the pane menu it also asks for is not opened.
    took: bool,
    /// Counts captures, for their ids.
    count: u64,
}

impl Bridge {
    /// Whether the right-click just seen opened the menu (and forget it).
    pub(super) fn took_click(&mut self) -> bool {
        std::mem::take(&mut self.took)
    }
}

/// Selected terminal output a right-click offered the bridge for.
struct Menu {
    x: f32,
    y: f32,
    workspace_id: String,
    session_id: String,
    text: String,
}

/// What is being asked about: one intent.
struct Capture {
    id: String,
    workspace_id: String,
    source: ContextSource,
    /// The one operation of this capture's send: the core refuses a replayed one.
    operation_id: String,
}

/// How far this capture's send got (`ContextBridgeScreenProps.sendState`).
#[derive(Clone, Default)]
struct SendState {
    attempted: bool,
    sending: bool,
    delivered: bool,
    error: Option<String>,
    /// What was sent: `{instruction, preview, targetSessionId}`.
    sent: Option<Value>,
}

impl SendState {
    fn to_json(&self) -> Value {
        let mut state = json!({
            "attempted": self.attempted,
            "sending": self.sending,
            "delivered": self.delivered,
        });
        if let Some(error) = &self.error {
            state["error"] = json!(error);
        }
        if let Some(sent) = &self.sent {
            state["sent"] = sent.clone();
        }
        state
    }
}

/// A new operation id, unique to this process and instant.
fn operation_id(count: u64) -> String {
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_nanos());
    format!("native-{}-{stamp}-{count}", std::process::id())
}

/// `answer`, or `late` once [`WAIT`] has passed, or `gone` when no answer can come (the connection went).
async fn within(
    answer: Answer,
    timer: gpui::Task<()>,
    late: &str,
    gone: &str,
) -> Result<Value, String> {
    match futures::future::select(answer, timer).await {
        futures::future::Either::Left((Ok(outcome), _)) => outcome,
        futures::future::Either::Left((Err(_), _)) => Err(gone.into()),
        futures::future::Either::Right(_) => Err(late.into()),
    }
}

/// An answer already settled.
fn settled(outcome: Result<Value, String>) -> Answer {
    let (tx, rx) = oneshot::channel();
    let _ = tx.send(outcome);
    rx
}

impl Workspace {
    fn bridge_ok(&self, workspace_id: &str, cx: &App) -> bool {
        bridge_available(&self.sidebar.read(cx).model().store, workspace_id)
    }

    /// The terminal in pane `id` offers its selection to the bridge at `at`: the menu opens there. Nothing is captured
    /// or sent. A selection the bridge cannot take leaves the right-click to the pane menu.
    pub(super) fn offer_ask_agent(&mut self, id: &str, at: Point<Pixels>, cx: &mut Context<Self>) {
        let Some(view) = self.panes.get(id).and_then(|p| p.view.clone()) else {
            return;
        };
        let Ok(capture) = view.read(cx).context_capture() else {
            return;
        };
        if self.bridge.send.sending
            || !self.bridge_ok(&capture.workspace_id, cx)
            || !self.screens.has(SCREEN, cx)
        {
            return;
        }
        self.bridge.menu = Some(Menu {
            x: f32::from(at.x),
            y: f32::from(at.y),
            workspace_id: capture.workspace_id.clone(),
            session_id: capture.session_id.clone(),
            text: capture.text.clone(),
        });
        self.bridge.capture = None;
        self.bridge.took = true;
        self.show_bridge(cx);
    }

    /// Ask an agent about `source` in workspace `workspace_id` (the web's `askAgent`): the dialog opens on it. Refused
    /// where the bridge is not offered, and while another capture's send is under way.
    pub fn ask_agent(
        &mut self,
        workspace_id: &str,
        source: ContextSource,
        cx: &mut Context<Self>,
    ) -> Result<(), String> {
        if !self.bridge_ok(workspace_id, cx) {
            return Err("Ask agent is not available for this workspace.".into());
        }
        if self.bridge.send.sending {
            return Err("Wait for the context being sent.".into());
        }
        self.bridge.count += 1;
        self.bridge.capture = Some(Capture {
            id: format!("capture-{}", self.bridge.count),
            workspace_id: workspace_id.to_string(),
            source,
            operation_id: operation_id(self.bridge.count),
        });
        self.bridge.menu = None;
        self.bridge.send = SendState::default();
        self.show_bridge(cx);
        Ok(())
    }

    /// Ask about file `path`: this window's unsaved draft of it when it has one, never an older disk read (the web's
    /// `askAgentAboutFile`).
    pub fn ask_agent_about_file(
        &mut self,
        workspace_id: &str,
        path: &str,
        cx: &mut Context<Self>,
    ) -> Result<(), String> {
        let source = match self.files().document(workspace_id, path) {
            Some(doc) if doc.content != doc.saved_content => ContextSource::Editor {
                path: path.to_string(),
                text: doc.content.clone(),
                start_line: 1,
                end_line: doc.content.split('\n').count() as u32,
                dirty: true,
            },
            _ => ContextSource::File {
                path: path.to_string(),
            },
        };
        self.ask_agent(workspace_id, source, cx)
    }

    /// The menu's Ask agent: its selection becomes the capture the dialog asks about.
    pub fn bridge_ask_from_menu(&mut self, cx: &mut Context<Self>) {
        if let Some(menu) = self.bridge.menu.take() {
            let source = ContextSource::Terminal {
                session_id: menu.session_id,
                text: menu.text,
            };
            if self.ask_agent(&menu.workspace_id, source, cx).is_err() {
                self.refresh_bridge(cx);
            }
        }
    }

    /// `ContextBridgeScreenProps` without its actions; `busy` keeps Escape from closing it mid-send.
    fn bridge_props(&self, cx: &App) -> Value {
        let bridge = &self.bridge;
        let menu = bridge.menu.as_ref().map(|m| {
            json!({ "x": m.x, "y": m.y, "workspaceId": m.workspace_id, "sessionId": m.session_id,
                    "selection": m.text })
        });
        let capture = bridge
            .capture
            .as_ref()
            .map(|c| json!({ "id": c.id, "workspaceId": c.workspace_id, "source": c.source }));
        json!({
            "menu": menu,
            "capture": capture,
            "connected": self.sidebar.read(cx).model().connected,
            "sendState": bridge.send.to_json(),
            "busy": bridge.send.sending,
        })
    }

    /// Opens the screen on the bridge's state, or gives the open one the new state.
    fn show_bridge(&mut self, cx: &mut Context<Self>) {
        let props = self.bridge_props(cx);
        if self.screens.is_open(SCREEN) {
            self.update_screen(SCREEN, props, cx);
            return;
        }
        let opened = self.open_screen(
            SCREEN,
            props,
            None,
            Some(Box::new(|this, _, _, cx| this.bridge_closed(cx))),
            cx,
        );
        if !opened {
            self.bridge = Bridge {
                count: self.bridge.count,
                ..Default::default()
            };
        }
    }

    /// The open screen follows the bridge's state (and the connection).
    pub(super) fn refresh_bridge(&mut self, cx: &mut Context<Self>) {
        if self.screens.is_open(SCREEN) {
            let props = self.bridge_props(cx);
            if self.screens.props(SCREEN).is_none_or(|old| {
                ["menu", "capture", "connected", "sendState", "busy"]
                    .iter()
                    .any(|k| old.get(*k) != props.get(*k))
            }) {
                self.update_screen(SCREEN, props, cx);
            }
        }
    }

    /// The screen closed: the menu and the capture go. A send under way still settles; its capture is gone.
    fn bridge_closed(&mut self, cx: &mut Context<Self>) {
        self.bridge = Bridge {
            count: self.bridge.count,
            ..Default::default()
        };
        cx.notify();
    }

    /// Prepares the capture's packet with `instruction` (`actions.preview`): `{packet, agents}`. Takes no lease and
    /// sends nothing to any terminal.
    pub fn bridge_preview(&mut self, instruction: String, cx: &mut Context<Self>) -> Answer {
        let Some(capture) = &self.bridge.capture else {
            return settled(Err("Nothing is being asked about.".into()));
        };
        let workspace_id = capture.workspace_id.clone();
        let frame = json!({
            "type": "context.preview", "workspaceId": workspace_id, "source": capture.source,
            "instruction": instruction,
        });
        let answer = self.ask(frame, cx);
        let timer = cx.background_executor().timer(WAIT);
        let (tx, rx) = oneshot::channel();
        cx.spawn(async move |_, _| {
            let outcome = within(
                answer,
                timer,
                "Context preparation timed out. Try again when connected.",
                "Reconnect before preparing or sending context.",
            )
            .await
            .and_then(|reply| {
                if reply["packet"]["workspaceId"] == json!(workspace_id) {
                    Ok(reply)
                } else {
                    Err("Perch did not prepare this context.".into())
                }
            });
            let _ = tx.send(outcome);
        })
        .detach();
        rx
    }

    /// Sends the capture's packet (`digest` is the one its preview returned) to the agent in `target`
    /// (`actions.send`): once per capture, never retried. `preview` is what the screen showed, kept to show the send
    /// as it was made.
    pub fn bridge_send(
        &mut self,
        instruction: String,
        digest: String,
        target: String,
        preview: Value,
        cx: &mut Context<Self>,
    ) -> Answer {
        let Some(capture) = &self.bridge.capture else {
            return settled(Err("Nothing is being asked about.".into()));
        };
        if self.bridge.send.attempted {
            return settled(Err(
                "This context was already sent once. Inspect the agent's CLI before asking again."
                    .into(),
            ));
        }
        let frame = json!({
            "type": "context.send", "workspaceId": capture.workspace_id, "source": capture.source,
            "instruction": instruction, "digest": digest, "targetSessionId": target,
            "operationId": capture.operation_id,
        });
        let owner = capture.id.clone();
        self.bridge.send = SendState {
            attempted: true,
            sending: true,
            delivered: false,
            error: None,
            sent: Some(json!({ "instruction": instruction, "preview": preview,
                               "targetSessionId": target })),
        };
        self.refresh_bridge(cx);
        // The agent's own terminal, when this window holds its input; else the window's connection.
        let on_terminal = self
            .panes
            .get(&target)
            .and_then(|p| p.view.as_ref())
            .and_then(|view| view.read(cx).request(frame.clone()));
        let answer = on_terminal.unwrap_or_else(|| self.ask(frame, cx));
        let timer = cx.background_executor().timer(WAIT);
        let (tx, rx) = oneshot::channel();
        cx.spawn(async move |this, cx| {
            let outcome = within(answer, timer, UNCONFIRMED, DROPPED)
                .await
                .and_then(|reply| {
                    if reply["accepted"] == true && reply["sessionId"] == json!(target) {
                        Ok(Value::Null)
                    } else {
                        Err("The agent did not confirm delivery. Inspect its CLI before sending again.".into())
                    }
                });
            let _ = this.update(cx, |ws, cx| {
                if ws.bridge.capture.as_ref().is_some_and(|c| c.id == owner) {
                    ws.bridge.send.sending = false;
                    match &outcome {
                        Ok(_) => ws.bridge.send.delivered = true,
                        Err(error) => ws.bridge.send.error = Some(error.clone()),
                    }
                    ws.refresh_bridge(cx);
                }
            });
            let _ = tx.send(outcome);
        })
        .detach();
        rx
    }

    /// Open agent: goes to the session's tab. False when the session is gone.
    pub fn bridge_open_agent(&mut self, session_id: &str, cx: &mut Context<Self>) -> bool {
        self.show_session(session_id, cx).is_ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_bridge_needs_the_capability_and_a_local_workspace() {
        let workspace = |id: &str, host: &str| {
            serde_json::from_value::<perch_core::protocol::WorkspaceSummary>(json!({
                "id": id, "projectId": "p", "hostId": host, "path": "/w", "name": id,
                "dirty": false, "state": "active", "createdAt": 0, "updatedAt": 0}))
            .unwrap()
        };
        let mut store = Store {
            workspaces: vec![workspace("w1", LOCAL), workspace("w2", "studio")],
            ..Default::default()
        };
        assert!(!bridge_available(&store, "w1"), "no capability");
        store.local_capabilities = vec![CAPABILITY.into()];
        assert!(bridge_available(&store, "w1"));
        assert!(!bridge_available(&store, "w2"), "a remote workspace");
        assert!(!bridge_available(&store, "w3"), "an unknown workspace");
    }
}

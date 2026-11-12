//! The terminal's side of the Context Bridge (`docs/CONTEXT-BRIDGE.md`): selected output captured
//! as a packet an agent can be asked about. A capture is plain data. Preparing one, previewing
//! it and cancelling never send input; sending is a separate, explicit call that happens at most
//! once per capture and is never retried, because a delivery that was not confirmed may still
//! have landed.

use perch_core::context_bridge::ContextSource;
use serde_json::{json, Value};
use std::time::Duration;

/// The capability a core advertises when it can prepare and send packets.
pub const CAPABILITY: &str = "context.bridge.v1";
/// Selected text over this many bytes is refused, never truncated.
pub const MAX_EXCERPT: usize = 32 * 1024;
/// A question over this many bytes is refused.
pub const MAX_QUESTION: usize = 4 * 1024;
/// How long a request waits for the core before it is given up on.
pub const WAIT: Duration = Duration::from_secs(15);
/// What a send says when the core did not confirm it in time.
pub const UNCONFIRMED: &str = "Delivery was not confirmed. Inspect the CLI; do not resend blindly.";
/// What a send says when the connection dropped while it waited.
pub const DROPPED: &str = "Connection lost. Nothing will be retried automatically. If sending, inspect the CLI before sending again.";

/// What the view knows about the place the terminal is in, for deciding to offer the bridge.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Place {
    /// What the core advertised on connecting.
    pub capabilities: Vec<String>,
    /// The workspace the session belongs to, when it has one.
    pub workspace_id: Option<String>,
    /// The workspace is on this computer: remote workspaces are never guessed from paths.
    pub local: bool,
    /// The computer the session runs on, when it is not this one (`local` is true for "local").
    pub host_id: String,
}

impl Place {
    /// The bridge is offered here: the core can do it, and the workspace is a known local one.
    pub fn available(&self) -> bool {
        self.local
            && self.workspace_id.is_some()
            && self.capabilities.iter().any(|c| c == CAPABILITY)
    }
}

/// Selected terminal output, ready to preview and send.
#[derive(Debug)]
pub struct Capture {
    pub workspace_id: String,
    pub session_id: String,
    pub text: String,
    /// One per capture: a replay of the same send cannot dispatch twice.
    operation_id: String,
    sent: bool,
}

impl Capture {
    /// Capture `text` selected in `session_id`. Nothing is sent. Refused when the selection is
    /// empty, over the excerpt limit, or holds control characters (a capture must never become
    /// terminal syntax); the text says what to do.
    pub fn new(
        place: &Place,
        session_id: &str,
        text: &str,
        operation_id: String,
    ) -> Result<Self, String> {
        if !place.available() {
            return Err("Ask agent is not available for this terminal".into());
        }
        let workspace_id = place.workspace_id.clone().unwrap_or_default();
        // The core reads a line break as one `\n`, so a lone carriage return is a control.
        let text = text.replace("\r\n", "\n");
        if text.trim().is_empty() {
            return Err("Select some text to ask about".into());
        }
        if text.len() > MAX_EXCERPT {
            return Err("Context exceeds 32 KiB. Select a smaller excerpt".into());
        }
        refuse_controls(&text)?;
        Ok(Self {
            workspace_id,
            session_id: session_id.to_owned(),
            text,
            operation_id,
            sent: false,
        })
    }

    fn source(&self) -> Value {
        serde_json::to_value(ContextSource::Terminal {
            session_id: self.session_id.clone(),
            text: self.text.clone(),
        })
        .expect("a context source is plain data")
    }

    /// The request that prepares the packet for the user to review. It takes no lease and sends
    /// nothing to any terminal.
    pub fn preview_request(&self, request_id: &str, question: &str) -> Result<Value, String> {
        check_question(question)?;
        Ok(json!({
            "type": "context.preview",
            "requestId": request_id,
            "workspaceId": self.workspace_id,
            "source": self.source(),
            "instruction": question,
        }))
    }

    /// The request that sends the reviewed packet (`digest` is the one the preview returned) to
    /// the agent in `target_session_id`. A capture sends once: a second call is refused, and a
    /// send that failed is not repeated by this type.
    pub fn send_request(
        &mut self,
        request_id: &str,
        question: &str,
        digest: &str,
        target_session_id: &str,
    ) -> Result<Value, String> {
        check_question(question)?;
        if std::mem::replace(&mut self.sent, true) {
            return Err(
                "This context was already sent. Inspect the CLI before sending again".into(),
            );
        }
        Ok(json!({
            "type": "context.send",
            "requestId": request_id,
            "workspaceId": self.workspace_id,
            "source": self.source(),
            "instruction": question,
            "digest": digest,
            "targetSessionId": target_session_id,
            "operationId": self.operation_id,
        }))
    }
}

fn refuse_controls(text: &str) -> Result<(), String> {
    if text
        .chars()
        .any(|c| c.is_control() && c != '\n' && c != '\t')
    {
        return Err("Context contains control characters; select plain text instead".into());
    }
    Ok(())
}

fn check_question(question: &str) -> Result<(), String> {
    if question.len() > MAX_QUESTION {
        return Err("The question exceeds 4 KiB. Shorten it".into());
    }
    refuse_controls(question)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn place() -> Place {
        Place {
            capabilities: vec![CAPABILITY.into()],
            workspace_id: Some("w1".into()),
            local: true,
            ..Default::default()
        }
    }

    fn capture(text: &str) -> Result<Capture, String> {
        Capture::new(&place(), "s1", text, "op-1".into())
    }

    #[test]
    fn the_bridge_needs_the_capability_and_a_local_workspace() {
        assert!(place().available());
        assert!(!Place {
            local: false,
            ..place()
        }
        .available());
        assert!(!Place {
            workspace_id: None,
            ..place()
        }
        .available());
        assert!(!Place {
            capabilities: vec![],
            ..place()
        }
        .available());
        assert!(Capture::new(&Place::default(), "s1", "x", "op".into()).is_err());
    }

    #[test]
    fn a_capture_refuses_what_the_core_would_and_never_trims() {
        assert!(capture("  \n").unwrap_err().contains("Select some text"));
        assert!(capture(&"x".repeat(MAX_EXCERPT)).is_ok());
        assert!(capture(&"x".repeat(MAX_EXCERPT + 1))
            .unwrap_err()
            .contains("32 KiB"));
        assert!(capture("rm -rf\x1b[2J")
            .unwrap_err()
            .contains("control characters"));
        assert!(
            capture("a\tb\nc\r\nd").is_ok(),
            "tabs and line breaks are plain text"
        );
        assert_eq!(
            capture("a\r\nb").unwrap().text,
            "a\nb",
            "line breaks are read as the core reads them"
        );
        assert!(
            capture("a\rb").is_err(),
            "a lone carriage return is a control"
        );
        assert_eq!(capture("kept as is  ").unwrap().text, "kept as is  ");
    }

    #[test]
    fn a_question_is_limited_and_plain() {
        let c = capture("out").unwrap();
        assert!(c.preview_request("r", &"q".repeat(MAX_QUESTION)).is_ok());
        assert!(c
            .preview_request("r", &"q".repeat(MAX_QUESTION + 1))
            .is_err());
        assert!(c.preview_request("r", "bad\x07").is_err());
    }

    #[test]
    fn a_preview_names_the_selection_and_a_send_happens_once() {
        let mut c = capture("error: boom").unwrap();
        let preview = c.preview_request("r1", "why?").unwrap();
        assert_eq!(preview["type"], "context.preview");
        assert_eq!(preview["source"]["kind"], "terminal");
        assert_eq!(preview["source"]["sessionId"], "s1");
        assert_eq!(preview["source"]["text"], "error: boom");
        // Previewing as often as the user likes sends nothing and uses up nothing.
        assert!(c.preview_request("r2", "").is_ok());
        let send = c.send_request("r3", "why?", "digest", "agent").unwrap();
        assert_eq!(send["type"], "context.send");
        assert_eq!(send["operationId"], "op-1");
        assert_eq!(send["targetSessionId"], "agent");
        assert_eq!(send["digest"], "digest");
        assert!(
            c.send_request("r4", "why?", "digest", "agent").is_err(),
            "at most one send"
        );
    }

    #[test]
    fn a_refused_question_does_not_use_up_the_send() {
        let mut c = capture("out").unwrap();
        assert!(c
            .send_request("r", &"q".repeat(MAX_QUESTION + 1), "d", "a")
            .is_err());
        assert!(c.send_request("r", "ok", "d", "a").is_ok());
    }
}

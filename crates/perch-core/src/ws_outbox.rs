//! Bounded browser output. Overflow ends the connection, never drops an
//! arbitrary terminal chunk: the normal reconnect obtains a fresh replay.
use std::sync::Arc;
use tokio::sync::{mpsc, watch, OwnedSemaphorePermit, Semaphore};

// Room for a 4 MiB replay even with JSON escaping, plus live output.
const MAX_BYTES: usize = 32 * 1024 * 1024;
const MAX_MESSAGES: usize = 2048;
type Queued = (String, OwnedSemaphorePermit);

#[derive(Clone)]
pub struct Sender {
    tx: mpsc::Sender<Queued>,
    budget: Arc<Semaphore>,
    failed: watch::Sender<bool>,
}

pub fn channel() -> (Sender, mpsc::Receiver<Queued>) {
    let (tx, rx) = mpsc::channel(MAX_MESSAGES);
    let (failed, _) = watch::channel(false);
    (
        Sender {
            tx,
            budget: Arc::new(Semaphore::new(MAX_BYTES)),
            failed,
        },
        rx,
    )
}

impl Sender {
    pub fn send(&self, message: crate::protocol::ServerMessage) -> Result<(), &'static str> {
        if self.is_closed() {
            return Err("connection closed");
        }
        let text = serde_json::to_string(&message).map_err(|_| "cannot serialize message")?;
        let permit = u32::try_from(text.len())
            .ok()
            .and_then(|len| self.budget.clone().try_acquire_many_owned(len).ok());
        if let Some(permit) = permit {
            if self.tx.try_send((text, permit)).is_ok() {
                return Ok(());
            }
        }
        // Keep producers nonblocking: a stalled phone must not stall a PTY
        // reader or another viewer. Stop this entire connection instead.
        self.failed.send_replace(true);
        Err("slow consumer: reconnect for replay")
    }

    pub fn disconnect(&self) {
        self.failed.send_replace(true);
    }

    pub fn is_closed(&self) -> bool {
        self.tx.is_closed() || *self.failed.borrow()
    }

    pub async fn failed(&self) {
        let mut rx = self.failed.subscribe();
        let _ = rx.wait_for(|failed| *failed).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::ServerMessage;
    fn data(text: String) -> ServerMessage {
        ServerMessage::TerminalData {
            terminal_id: "terminal".into(),
            data: text,
        }
    }

    #[tokio::test]
    async fn stalled_viewer_is_bounded_and_reconnect_has_a_fresh_budget() {
        let (tx, mut rx) = channel();
        let chunk = "x".repeat(64 * 1024);
        let mut accepted = 0;
        while tx.send(data(chunk.clone())).is_ok() {
            accepted += 1;
        }
        assert!(accepted < MAX_BYTES / chunk.len());
        assert!(tx.is_closed());
        tx.failed().await; // also works if the failure preceded the wait
        assert!(rx.try_recv().is_ok());
        assert!(tx.send(data("not silently resumed".into())).is_err());
        drop(rx);
        let (new, mut rx) = channel();
        new.send(data("replay then live".into())).unwrap();
        let (text, _permit) = rx.recv().await.unwrap();
        assert!(text.contains("replay then live"));
    }
}

//! In-memory registry of live chat sessions, mirroring
//! `reference/node-server-spec/src/sessionRegistry.ts`. Each session keeps a
//! small ring buffer of the server-side events it has emitted so a client
//! that reconnects and sends `session.subscribe` can catch up without
//! replaying from SQLite.

use std::collections::{HashMap, VecDeque};
use std::sync::Mutex;

use crate::protocol::ServerMessage;

const RING_BUFFER_SIZE: usize = 500;

struct SessionState {
    #[allow(dead_code)] // kept for parity with the Node registry / future use
    cwd: String,
    buffer: VecDeque<ServerMessage>,
}

pub struct SessionRegistry {
    sessions: Mutex<HashMap<String, SessionState>>,
}

impl SessionRegistry {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    pub fn create(&self, id: &str, cwd: &str) {
        self.sessions.lock().unwrap().insert(
            id.to_string(),
            SessionState {
                cwd: cwd.to_string(),
                buffer: VecDeque::new(),
            },
        );
    }

    pub fn record(&self, session_id: &str, message: ServerMessage) {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(session_id) {
            session.buffer.push_back(message);
            while session.buffer.len() > RING_BUFFER_SIZE {
                session.buffer.pop_front();
            }
        }
    }

    pub fn replay(&self, session_id: &str) -> Vec<ServerMessage> {
        self.sessions
            .lock()
            .unwrap()
            .get(session_id)
            .map(|s| s.buffer.iter().cloned().collect())
            .unwrap_or_default()
    }

    /// Drop a session's ring buffer entirely — called on `session.delete` so
    /// a stale in-memory replay buffer can't outlive the (now-deleted) SQLite
    /// row.
    pub fn remove(&self, session_id: &str) {
        self.sessions.lock().unwrap().remove(session_id);
    }
}

impl Default for SessionRegistry {
    fn default() -> Self {
        Self::new()
    }
}

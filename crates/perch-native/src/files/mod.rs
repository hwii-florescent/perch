//! Workspace files for the window: the store that keeps listings, documents and drafts as the
//! web's `filesystemStore.ts` does ([`store`]), and [`Files`], which ties it to the window: its
//! frames go to the core, the core's `fs.*` messages and connection changes come in, and the
//! draft debounce runs on the window's clock. Media in the file pane is [`media`] (Quick Look on macOS).

pub mod media;
#[cfg(target_os = "macos")]
pub mod quick_look;
pub mod store;

use serde_json::Value;
use std::time::Instant;
use store::FileStore;

/// The window's file store and the clock its debounce waits on.
#[derive(Default)]
pub struct Files {
    pub store: FileStore,
    /// The deadline a timer is already set for, so one is set per deadline.
    armed: Option<Instant>,
}

impl Files {
    /// A store that starts connected when the window opens on a live connection.
    pub fn new(connected: bool) -> Self {
        let mut files = Self::default();
        files.store.set_connected(connected);
        files
    }

    /// What to send now, the workspaces whose snapshot moved, and a deadline that needs a timer
    /// (none when one is already set for it).
    pub fn drain(&mut self) -> (Vec<Value>, Vec<String>, Option<Instant>) {
        let sent = self.store.take_sent();
        let changed = self.store.take_changed().into_iter().collect();
        let next = self.store.next_deadline();
        let arm = next.filter(|at| self.armed.is_none_or(|armed| *at < armed));
        if arm.is_some() {
            self.armed = arm;
        }
        (sent, changed, arm)
    }

    /// A timer set by [`Self::drain`] ran out at `now`.
    pub fn fired(&mut self, now: Instant) {
        if self.armed.is_some_and(|at| at <= now) {
            self.armed = None;
        }
        self.store.tick(now);
    }
}

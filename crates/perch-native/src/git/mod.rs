//! Git and review on the native client: [`store`] keeps each workspace's review (the web's `gitReviewStore`), and
//! [`GitHost`] ties it to the window. The store's frames go to the core through [`Workspace::ask`] (with the
//! workspace's computer as `hostId` when it is not this one), each answer, refusal, lost connection or 30 s timeout
//! goes back into the store, script promises settle with the store's values, and every workspace whose review moved
//! is published to the mods (`Perch::set_git_review`) and to the diff views (`Diffs::set_data`).
//!
//! A host can take a Git request only while the window is connected and the computer advertises `git.status`
//! (`gitCapabilityForWorkspace`); otherwise the store fails the request at once, as the web's does.

pub mod store;

use crate::sidebar::LOCAL;
use crate::workspace::Workspace;
use futures::channel::oneshot;
use gpui::{App, Entity, Global, WeakEntity};
use serde_json::{json, Value};
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use store::{Effect, GitReviewStore, Ticket, TIMEOUT};

/// The capability a computer advertises when it answers Git requests.
pub const GIT_CAPABILITY: &str = "git.status";

struct Git {
    store: GitReviewStore,
    /// Script promises waiting on a ticket.
    waiters: HashMap<Ticket, oneshot::Sender<Value>>,
    /// The revision of each workspace's review as last published.
    published: HashMap<String, u64>,
    workspace: WeakEntity<Workspace>,
}

/// The window's Git store. Cheap to clone; a global of the window's app.
#[derive(Clone)]
pub struct GitHost(Rc<RefCell<Git>>);

impl Global for GitHost {}

/// The computer workspace `id` lives on, by the sidebar's store (this one when it is not listed).
pub fn workspace_host(store: &crate::sidebar::navigation::Store, id: &str) -> String {
    store
        .workspaces
        .iter()
        .find(|w| w.id == id)
        .map_or_else(|| LOCAL.into(), |w| w.host_id.clone())
}

/// `gitCapabilityForWorkspace`: connected, and workspace `id`'s computer advertises Git.
pub fn can_take(connected: bool, store: &crate::sidebar::navigation::Store, id: &str) -> bool {
    let host = workspace_host(store, id);
    let capabilities = if host == LOCAL {
        Some(&store.local_capabilities)
    } else {
        store.host_capabilities.get(&host)
    };
    connected && capabilities.is_some_and(|c| c.iter().any(|c| c == GIT_CAPABILITY))
}

/// Gives the window `workspace` a Git store.
pub fn install(workspace: &Entity<Workspace>, cx: &mut App) {
    cx.set_global(GitHost(Rc::new(RefCell::new(Git {
        store: GitReviewStore::default(),
        waiters: HashMap::new(),
        published: HashMap::new(),
        workspace: workspace.downgrade(),
    }))));
}

/// The window's Git store, once installed.
pub fn host(cx: &App) -> Option<GitHost> {
    cx.try_global::<GitHost>().cloned()
}

impl GitHost {
    /// Workspace `id`'s review as the store has it now.
    pub fn review(&self, id: &str) -> store::WorkspaceReview {
        self.0.borrow().store.workspace_or_default(id)
    }

    /// Runs `change` on the store for workspace `id` (told whether its computer can take Git requests now), then
    /// sends what it asked and publishes what moved.
    pub fn run<R>(
        &self,
        id: &str,
        change: impl FnOnce(&mut GitReviewStore, bool, &mut Vec<Effect>) -> R,
        cx: &mut App,
    ) -> R {
        let ready = self.ready(id, cx);
        let mut out = Vec::new();
        let result = change(&mut self.0.borrow_mut().store, ready, &mut out);
        self.pump(out, cx);
        result
    }

    /// A promise for `ticket`'s value: null at once when there is no ticket (the store refused the request).
    pub fn wait(&self, ticket: Option<Ticket>) -> oneshot::Receiver<Value> {
        let (tx, rx) = oneshot::channel();
        match ticket {
            Some(ticket) => {
                self.0.borrow_mut().waiters.insert(ticket, tx);
            }
            None => {
                let _ = tx.send(Value::Null);
            }
        }
        rx
    }

    /// A `review.batch.delivery` broadcast from the core.
    pub fn on_delivery(&self, message: &perch_core::protocol::ServerMessage, cx: &mut App) {
        let Ok(value) = serde_json::to_value(message) else {
            return;
        };
        let workspace_id = value["workspaceId"].as_str().unwrap_or("").to_string();
        let host = value["hostId"].as_str().unwrap_or(LOCAL).to_string();
        let workspace_host = self.host_of(&workspace_id, cx);
        self.0
            .borrow_mut()
            .store
            .on_delivery(&value, &host, &workspace_host);
        self.publish(cx);
    }

    /// The computer workspace `id` lives on (this one when the window does not know it).
    fn host_of(&self, id: &str, cx: &App) -> String {
        let Some(workspace) = self.0.borrow().workspace.upgrade() else {
            return LOCAL.into();
        };
        workspace_host(&workspace.read(cx).sidebar().read(cx).model().store, id)
    }

    /// Whether workspace `id`'s computer can take a Git request now (`gitCapabilityForWorkspace`).
    fn ready(&self, id: &str, cx: &App) -> bool {
        let Some(workspace) = self.0.borrow().workspace.upgrade() else {
            return false;
        };
        let model = workspace.read(cx).sidebar().read(cx).model();
        can_take(model.connected, &model.store, id)
    }

    fn pump(&self, out: Vec<Effect>, cx: &mut App) {
        for effect in out {
            match effect {
                Effect::Send { ticket, mut frame } => {
                    let id = frame["workspaceId"].as_str().unwrap_or("").to_string();
                    let host = self.host_of(&id, cx);
                    if host != LOCAL {
                        frame["hostId"] = json!(host);
                    }
                    self.send(ticket, frame, cx);
                }
                Effect::Settle { ticket, value } => {
                    if let Some(waiter) = self.0.borrow_mut().waiters.remove(&ticket) {
                        let _ = waiter.send(value);
                    }
                }
            }
        }
        self.publish(cx);
    }

    /// Sends `frame` and feeds its answer, its loss or its timeout back to the store.
    fn send(&self, ticket: Ticket, frame: Value, cx: &mut App) {
        let Some(workspace) = self.0.borrow().workspace.upgrade() else {
            let mut out = Vec::new();
            self.0.borrow_mut().store.on_lost(ticket, &mut out);
            return self.pump(out, cx);
        };
        let id = frame["workspaceId"].as_str().unwrap_or("").to_string();
        let answer = workspace.read(cx).ask(frame, cx);
        let timer = cx.background_executor().timer(TIMEOUT);
        let git = self.clone();
        cx.spawn(async move |cx| {
            use futures::future::{select, Either};
            let outcome = match select(answer, timer).await {
                Either::Left((Ok(answer), _)) => Some(answer),
                Either::Left((Err(_), _)) => None,
                Either::Right(_) => {
                    let _ = cx.update(|cx| {
                        let mut out = Vec::new();
                        git.0.borrow_mut().store.expire(ticket, &mut out);
                        git.pump(out, cx);
                    });
                    return;
                }
            };
            let _ = cx.update(|cx| {
                let ready = git.ready(&id, cx);
                let mut out = Vec::new();
                match outcome {
                    Some(answer) => git
                        .0
                        .borrow_mut()
                        .store
                        .on_answer(ticket, answer, ready, &mut out),
                    None => git.0.borrow_mut().store.on_lost(ticket, &mut out),
                }
                git.pump(out, cx);
            });
        })
        .detach();
    }

    /// Hands every workspace whose review moved to the mods and the diff views.
    fn publish(&self, cx: &mut App) {
        let moved: Vec<(String, store::WorkspaceReview)> = {
            let mut git = self.0.borrow_mut();
            let changed: Vec<(String, u64)> = git
                .store
                .revisions()
                .filter(|(id, revision)| git.published.get(*id) != Some(revision))
                .map(|(id, revision)| (id.to_string(), revision))
                .collect();
            changed
                .into_iter()
                .map(|(id, revision)| {
                    git.published.insert(id.clone(), revision);
                    let review = git.store.workspace_or_default(&id);
                    (id, review)
                })
                .collect()
        };
        if moved.is_empty() {
            return;
        }
        let mods = cx
            .try_global::<crate::mods::WindowMods>()
            .map(|m| (m.perch.clone(), m.diffs.clone()));
        let Some((perch, diffs)) = mods else {
            return;
        };
        for (id, review) in &moved {
            diffs.set_data(id, review.diff.clone(), review.comments.clone(), cx);
            perch.set_git_review(id, review);
        }
        perch.flush(cx);
    }
}

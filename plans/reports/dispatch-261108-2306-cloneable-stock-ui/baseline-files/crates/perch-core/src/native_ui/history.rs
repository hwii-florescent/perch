//! A long Pi/OMP conversation, kept by the core so a viewer can page back through all of it.
//!
//! The CLI's extension sends only the newest messages in each snapshot (the tail) and answers a page
//! request with older ones in a frame of their own, so no frame ever holds the whole conversation.
//! `History` folds the tail into the messages already seen, and shows a viewer the tail plus however
//! many older messages the person has paged in (`extra`): what a viewer receives, and so what each
//! update costs, grows only as far back as they went.
//! ponytail: every update still carries the paged-in messages whole (and the transcript is projected
//! from them), so a viewer that went back thousands of messages pays for it; send deltas if that bites.

use crate::protocol::{NativeUiMessage, NativeUiSnapshot};

/// Older messages revealed per page, as Claude's.
pub const PAGE: usize = 200;
/// Messages kept; the oldest go first. A session this long is reachable in the CLI.
const MAX_STORE: usize = 20_000;

#[derive(Default)]
pub struct History {
    /// The conversation as far back as it is known, oldest first; its end is the newest tail.
    store: Vec<NativeUiMessage>,
    /// Older messages shown beyond the tail.
    extra: usize,
    /// `store` begins at the first message of the conversation.
    at_start: bool,
    session: String,
    tail: Option<NativeUiSnapshot>,
    revision: u64,
}

impl History {
    /// Fold a new tail snapshot in; the snapshot a viewer gets.
    pub fn apply(&mut self, tail: NativeUiSnapshot) -> NativeUiSnapshot {
        if tail.provider_session_id != self.session {
            *self = Self {
                session: tail.provider_session_id.clone(),
                revision: self.revision,
                ..Self::default()
            };
        }
        self.merge(&tail.messages, tail.truncated);
        self.tail = Some(tail);
        self.view().expect("the tail was just set")
    }

    /// Start from what the CLI handed over when the session was joined (its newest turns, oldest first),
    /// before any tail is applied, so messages the tail's own size limit cut are not lost between the
    /// tail and the first older page. `more`: the CLI has still older ones.
    pub fn seed(&mut self, session: &str, rows: Vec<NativeUiMessage>, more: bool) {
        *self = Self {
            store: rows,
            at_start: !more,
            session: session.to_string(),
            revision: self.revision,
            ..Self::default()
        };
    }

    fn merge(&mut self, tail: &[NativeUiMessage], tail_truncated: bool) {
        let Some(first) = tail.first() else { return };
        let position = |id: &str| self.store.iter().rposition(|message| message.id == id);
        if let Some(at) = position(&first.id) {
            // The tail still reaches back to what is known: it replaces everything from there on.
            self.store.truncate(at);
            self.store.extend_from_slice(tail);
        } else if let Some((after, _)) = tail
            .iter()
            .enumerate()
            .rev()
            .find(|(_, message)| position(&message.id).is_some())
        {
            // The window slid past its own start: keep what slid out, then the newer part.
            let at = position(&tail[after].id).unwrap();
            self.store.truncate(at);
            self.store.extend_from_slice(&tail[after..]);
        } else {
            // Nothing in common (a first snapshot, another branch, or more than a window at once).
            self.store = tail.to_vec();
            self.extra = 0;
            self.at_start = !tail_truncated;
        }
        if !tail_truncated && self.store.len() == tail.len() {
            self.at_start = true;
        }
        if self.store.len() > MAX_STORE {
            self.store.drain(..self.store.len() - MAX_STORE);
            self.at_start = false;
        }
    }

    /// What a viewer sees now: the tail and `extra` older messages, and whether more can be asked for.
    fn view(&mut self) -> Option<NativeUiSnapshot> {
        let mut snapshot = self.tail.clone()?;
        let shown = (snapshot.messages.len() + self.extra).min(self.store.len());
        snapshot.messages = self.store[self.store.len() - shown..].to_vec();
        snapshot.truncated = shown < self.store.len() || !self.at_start;
        snapshot.can_load_older = snapshot.truncated;
        // Past the CLI's own count too, so a bridge that restarts its numbering is still increasing.
        self.revision = self.revision.max(snapshot.revision) + 1;
        snapshot.revision = self.revision;
        Some(snapshot)
    }

    /// The snapshot again, after `extra` or the store changed.
    pub fn republish(&mut self) -> Option<NativeUiSnapshot> {
        self.view()
    }

    /// Older messages are already held beyond those shown.
    pub fn held_older(&self) -> usize {
        let tail = self.tail.as_ref().map_or(0, |tail| tail.messages.len());
        self.store.len().saturating_sub(tail + self.extra)
    }

    /// The conversation's first message is held: nothing older exists to ask for.
    pub fn at_start(&self) -> bool {
        self.at_start
    }

    /// The oldest message held: where the next page from the CLI begins.
    pub fn oldest_id(&self) -> Option<&str> {
        self.store.first().map(|message| message.id.as_str())
    }

    /// Show one more page, of what is held. How many were added.
    pub fn widen(&mut self) -> usize {
        let by = self.held_older().min(PAGE);
        self.extra += by;
        by
    }

    /// A page from the CLI (older than `oldest_id` when asked, oldest first); `more` is whether the
    /// CLI has still older ones.
    pub fn page_in(&mut self, mut older: Vec<NativeUiMessage>, more: bool) {
        // Never twice: a page that answers a stale request is dropped by its ids.
        older.retain(|message| !self.store.iter().any(|held| held.id == message.id));
        older.append(&mut self.store);
        self.store = older;
        self.at_start = !more;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(id: usize) -> NativeUiMessage {
        NativeUiMessage {
            id: id.to_string(),
            role: "user".into(),
            ..Default::default()
        }
    }

    fn tail(range: std::ops::Range<usize>, truncated: bool) -> NativeUiSnapshot {
        NativeUiSnapshot {
            version: 1,
            provider_session_id: "s".into(),
            messages: range.map(message).collect(),
            truncated,
            ..Default::default()
        }
    }

    fn ids(snapshot: &NativeUiSnapshot) -> Vec<usize> {
        snapshot
            .messages
            .iter()
            .map(|m| m.id.parse().unwrap())
            .collect()
    }

    #[test]
    fn a_page_is_shown_and_survives_the_tail_sliding_forward() {
        let mut history = History::default();
        let first = history.apply(tail(1000..1128, true));
        assert!(first.can_load_older && first.messages.len() == 128);
        // Nothing older is held yet: ask the CLI, then show what came.
        assert_eq!(history.held_older(), 0);
        assert!(!history.at_start());
        assert_eq!(history.oldest_id(), Some("1000"));
        history.page_in((800..1000).map(message).collect(), true);
        assert_eq!(history.widen(), 200);
        let shown = history.republish().unwrap();
        assert_eq!(
            (shown.messages.len(), shown.messages[0].id.as_str()),
            (328, "800")
        );
        assert!(shown.can_load_older, "the CLI said there is more");
        // The conversation goes on: two messages join the tail, two leave it, the page stays shown.
        let slid = history.apply(tail(1002..1130, true));
        assert_eq!(ids(&slid).first(), Some(&802));
        assert_eq!(ids(&slid).last(), Some(&1129));
        assert_eq!(slid.messages.len(), 328);
    }

    #[test]
    fn a_seeded_history_keeps_what_the_tail_limit_cut() {
        let mut history = History::default();
        // Joined with 300 messages in hand and more behind them; the tail keeps only the newest 128.
        history.seed("s", (0..300).map(message).collect(), true);
        let shown = history.apply(tail(172..300, true));
        assert_eq!(shown.messages.len(), 128);
        assert_eq!(
            history.held_older(),
            172,
            "the cut messages are held, not lost"
        );
        assert_eq!(history.widen(), 172);
        assert_eq!(history.republish().unwrap().messages.len(), 300);
        assert!(!history.at_start(), "the CLI still has older turns");
    }

    #[test]
    fn the_start_of_the_conversation_ends_paging() {
        let mut history = History::default();
        history.apply(tail(300..428, true));
        history.page_in((100..300).map(message).collect(), true);
        history.widen();
        history.page_in((0..100).map(message).collect(), false);
        assert_eq!(history.widen(), 100);
        let shown = history.republish().unwrap();
        assert_eq!(shown.messages.len(), 428);
        assert!(!shown.truncated && !shown.can_load_older);
        assert_eq!(history.widen(), 0);
    }

    #[test]
    fn a_streaming_message_updates_in_place_and_a_new_session_starts_over() {
        let mut history = History::default();
        history.apply(tail(0..3, false));
        let mut next = tail(0..3, false);
        next.messages[2].text = "grown".into();
        let shown = history.apply(next);
        assert_eq!(
            (shown.messages.len(), shown.messages[2].text.as_str()),
            (3, "grown")
        );
        assert!(!shown.truncated);
        let mut other = tail(50..60, true);
        other.provider_session_id = "other".into();
        let shown = history.apply(other);
        assert_eq!((shown.messages.len(), shown.truncated), (10, true));
        assert_eq!(history.oldest_id(), Some("50"));
    }

    #[test]
    fn a_page_that_repeats_held_messages_adds_none_twice() {
        let mut history = History::default();
        history.apply(tail(10..20, true));
        history.page_in((5..12).map(message).collect(), true);
        assert_eq!(history.held_older(), 5);
        assert_eq!(history.oldest_id(), Some("5"));
    }
}

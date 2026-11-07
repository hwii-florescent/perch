//! The family strip's four actions on a child (Message, Steer, Interrupt, Stop) and the rules for
//! when each is offered, to a person or to the child's lead. Pure: no database, no process. The
//! facts are gathered and the actions run by `server/crew_actions.rs`; the contract is ARCHITECTURE
//! ("Family strip actions").
//!
//! The row menu's shape (a default action plus the others, each disabled with its reason) follows
//! Orca's `CrewRowMenu.tsx` (MIT, `stablyai/orca` at `308b5000`, see THIRD_PARTY_NOTICES.md); the
//! rules are Perch's own: which provider mechanism carries each action, what a lead may do that a
//! person may, and the caps.
//!
//! - **Message** is the slice 5 queue: delivered only when the child is idle.
//! - **Steer** goes into the child's *running* turn through the provider's own mechanism (Codex
//!   `turn/steer`, Pi and OMP `deliverAs: "steer"`, Claude's own queue, which feeds text submitted
//!   mid-turn into the turn: probed 2026-11-07). It is refused while nothing runs and while the
//!   child waits on a person: a steer never answers or approves anything.
//! - **Interrupt** stops the current turn and keeps the session (the chat's Stop path).
//! - **Stop** is the confirmed `perch stop`.
//!
//! A lead may steer and interrupt its own children (never message-bypass the idle rule: `perch send`
//! stays idle-only); a child may do neither to anyone. A lead's interrupts are capped per child per
//! person's message to the lead, and neither is allowed while the child waits on a person.

use crate::sub_sessions::SubState;

/// The sender id of a message or steer a person sent from the strip. It is not a session.
pub const PERSON: &str = "person";
/// The longest text of a steer, in characters. A steer is never moved to a notes file.
pub const STEER_MAX_CHARS: usize = 2_000;
/// Interrupts a lead may send one child between two messages a person sent the lead.
pub const MAX_LEAD_INTERRUPTS_PER_CHILD: u32 = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action {
    Message,
    Steer,
    Interrupt,
    Stop,
}

impl Action {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Message => "message",
            Self::Steer => "steer",
            Self::Interrupt => "interrupt",
            Self::Stop => "stop",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        Some(match text {
            "message" => Self::Message,
            "steer" => Self::Steer,
            "interrupt" => Self::Interrupt,
            "stop" => Self::Stop,
            _ => return None,
        })
    }
}

/// Who acts. A person's actions come from the UI over an authenticated client; a lead's from its
/// agent token.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Actor {
    Person,
    Lead,
}

/// What the core read about a child before an action.
#[derive(Debug, Clone)]
pub struct ChildFacts {
    pub provider: String,
    /// The dispatch record of the child.
    pub dispatch: SubState,
    /// Its identity is live and its runtime is alive.
    pub alive: bool,
    /// Its native bridge has reported a snapshot.
    pub reported: bool,
    /// The bridge says a turn is running.
    pub running: bool,
    /// Perch's own state says it waits on a person: a pending approval or question.
    pub blocked: bool,
    /// Interrupts the lead has sent it since a person last wrote to the lead.
    pub lead_interrupts: u32,
}

/// The agents a message, steer or interrupt can reach: those with a native bridge Perch launched.
const RECEIVERS: [&str; 4] = ["claude", "codex", "pi", "omp"];

/// Why `action` is not available to `actor` right now, or `Ok` when it is. The text is what the
/// strip shows beside the disabled action and what a lead reads in a refusal.
pub fn availability(action: Action, actor: Actor, facts: &ChildFacts) -> Result<(), String> {
    if action == Action::Stop {
        return if facts.dispatch.is_live() && facts.dispatch != SubState::Starting {
            Ok(())
        } else if facts.dispatch == SubState::Starting {
            Err("it is still starting".into())
        } else {
            Err("it is not running".into())
        };
    }
    if facts.dispatch != SubState::Running {
        return Err("it is not running".into());
    }
    if !RECEIVERS.contains(&facts.provider.as_str()) {
        return Err("it is not an agent Perch started, so nothing can reach it".into());
    }
    if !facts.alive {
        return Err("it is not running".into());
    }
    match action {
        Action::Message => Ok(()),
        Action::Steer | Action::Interrupt => {
            if !facts.reported {
                return Err("it has not reported its state yet".into());
            }
            if action == Action::Steer {
                if facts.blocked {
                    return Err(
                        "it is waiting on a person (an approval or a question); answer that first"
                            .into(),
                    );
                }
                if !facts.running {
                    return Err("no turn is running in it; use Message".into());
                }
                return Ok(());
            }
            // Interrupt.
            if actor == Actor::Lead {
                if facts.blocked {
                    return Err(
                        "it is waiting on a person (an approval or a question); only a person \
                         answers that"
                            .into(),
                    );
                }
                if facts.lead_interrupts >= MAX_LEAD_INTERRUPTS_PER_CHILD {
                    return Err(format!(
                        "you have interrupted it {MAX_LEAD_INTERRUPTS_PER_CHILD} times since a \
                         person last wrote to you; ask the person"
                    ));
                }
            }
            if !facts.running && !facts.blocked {
                return Err("no turn is running in it".into());
            }
            Ok(())
        }
        Action::Stop => unreachable!("handled above"),
    }
}

/// A steer is plain text, short enough to travel whole.
pub fn check_steer_text(text: &str) -> Result<&str, String> {
    let text = crate::agent_mail::check_body(text)?;
    if text.chars().count() > STEER_MAX_CHARS {
        return Err(format!(
            "a steer is limited to {STEER_MAX_CHARS} characters; use a message for longer text"
        ));
    }
    Ok(text)
}

/// How an action ended, for the receipt on the row.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    /// A message waits in the queue.
    Queued,
    /// Handed to the provider's mechanism; the answer is awaited.
    Sent,
    /// The provider's own event confirmed it (or Perch confirmed the stop).
    Confirmed,
    /// Handed over or attempted, and nothing proved it took effect. Never retried.
    NotConfirmed,
}

impl Outcome {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Queued => "queued",
            Self::Sent => "sent",
            Self::Confirmed => "confirmed",
            Self::NotConfirmed => "not_confirmed",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn facts(provider: &str) -> ChildFacts {
        ChildFacts {
            provider: provider.into(),
            dispatch: SubState::Running,
            alive: true,
            reported: true,
            running: true,
            blocked: false,
            lead_interrupts: 0,
        }
    }

    fn idle(provider: &str) -> ChildFacts {
        ChildFacts {
            running: false,
            ..facts(provider)
        }
    }

    #[test]
    fn a_message_needs_only_a_running_agent_but_a_steer_needs_a_running_turn() {
        for provider in ["claude", "codex", "pi", "omp"] {
            assert!(availability(Action::Message, Actor::Person, &idle(provider)).is_ok());
            assert!(availability(Action::Message, Actor::Person, &facts(provider)).is_ok());
            assert!(availability(Action::Steer, Actor::Person, &facts(provider)).is_ok());
            let refused = availability(Action::Steer, Actor::Person, &idle(provider)).unwrap_err();
            assert!(refused.contains("use Message"), "{refused}");
        }
        let terminal = facts("terminal");
        assert!(availability(Action::Message, Actor::Person, &terminal).is_err());
        assert!(availability(Action::Steer, Actor::Person, &terminal).is_err());
    }

    #[test]
    fn nothing_but_stop_reaches_a_child_that_is_not_running() {
        for dispatch in [
            SubState::Stopped,
            SubState::Exited,
            SubState::Failed,
            SubState::Stopping,
        ] {
            let gone = ChildFacts {
                dispatch,
                ..facts("codex")
            };
            for action in [Action::Message, Action::Steer, Action::Interrupt] {
                assert!(
                    availability(action, Actor::Person, &gone).is_err(),
                    "{dispatch:?}"
                );
            }
        }
        // A stop that could not be confirmed may be tried again; a launch in flight may not be stopped.
        let unknown = ChildFacts {
            dispatch: SubState::StopUnknown,
            ..facts("codex")
        };
        assert!(availability(Action::Stop, Actor::Person, &unknown).is_ok());
        let starting = ChildFacts {
            dispatch: SubState::Starting,
            ..facts("codex")
        };
        assert!(availability(Action::Stop, Actor::Person, &starting).is_err());
        let stopped = ChildFacts {
            dispatch: SubState::Stopped,
            ..facts("codex")
        };
        assert!(availability(Action::Stop, Actor::Person, &stopped).is_err());
    }

    #[test]
    fn nobody_steers_a_child_that_waits_on_a_person() {
        let waiting = ChildFacts {
            blocked: true,
            ..facts("claude")
        };
        for actor in [Actor::Person, Actor::Lead] {
            let refused = availability(Action::Steer, actor, &waiting).unwrap_err();
            assert!(refused.contains("waiting on a person"), "{refused}");
        }
    }

    #[test]
    fn a_lead_cannot_interrupt_a_child_waiting_on_a_person_but_the_person_can() {
        let waiting = ChildFacts {
            blocked: true,
            running: false,
            ..facts("claude")
        };
        assert!(availability(Action::Interrupt, Actor::Lead, &waiting).is_err());
        assert!(availability(Action::Interrupt, Actor::Person, &waiting).is_ok());
    }

    #[test]
    fn a_leads_interrupts_are_capped_per_child_a_persons_are_not() {
        let mut child = facts("codex");
        child.lead_interrupts = MAX_LEAD_INTERRUPTS_PER_CHILD - 1;
        assert!(availability(Action::Interrupt, Actor::Lead, &child).is_ok());
        child.lead_interrupts = MAX_LEAD_INTERRUPTS_PER_CHILD;
        let refused = availability(Action::Interrupt, Actor::Lead, &child).unwrap_err();
        assert!(refused.contains("ask the person"), "{refused}");
        assert!(availability(Action::Interrupt, Actor::Person, &child).is_ok());
    }

    #[test]
    fn an_idle_child_has_nothing_to_interrupt_and_an_unreported_one_is_not_guessed_at() {
        assert!(availability(Action::Interrupt, Actor::Person, &idle("pi")).is_err());
        let silent = ChildFacts {
            reported: false,
            ..facts("pi")
        };
        for action in [Action::Steer, Action::Interrupt] {
            assert!(availability(action, Actor::Person, &silent).is_err());
        }
        // Unknown is not idle, so a message may still be queued for it.
        assert!(availability(Action::Message, Actor::Person, &silent).is_ok());
    }

    #[test]
    fn a_steer_is_short_plain_text() {
        assert_eq!(
            check_steer_text("  use the other file "),
            Ok("use the other file")
        );
        assert!(check_steer_text("   ").is_err());
        assert!(check_steer_text(&"x".repeat(STEER_MAX_CHARS + 1)).is_err());
        assert!(check_steer_text(&"x".repeat(STEER_MAX_CHARS)).is_ok());
        assert!(check_steer_text("a\u{1b}[31mb").is_err());
    }

    #[test]
    fn action_words_round_trip() {
        for action in [
            Action::Message,
            Action::Steer,
            Action::Interrupt,
            Action::Stop,
        ] {
            assert_eq!(Action::parse(action.as_str()), Some(action));
        }
        assert_eq!(Action::parse("approve"), None);
    }
}

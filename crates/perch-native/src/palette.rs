//! The command palette (the web's Navigator, `Navigator.tsx`), with no GPUI: what it lists, how
//! typing narrows it, and what each key does while it is open.
//!
//! It lists the commands this client runs, by the web's ids and wording (the sidebar's actions
//! and the tab, pane and terminal commands), the sessions to go to, what can be started, and the
//! places to hand to Perch. Everything the palette picks is run by the window.

use crate::keymap::{all_shortcuts, Keymap, Scope};
use crate::sidebar::Provider;
use gpui::Keystroke;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Command,
    /// Show this session.
    Session,
    /// Start this agent or terminal.
    Launch,
    /// Open this place in the Perch desktop app.
    HandOff,
    /// Needs a line of text first (rename).
    Prompt,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Entry {
    /// The command's id (`tabs.next`), or `session:<id>`, `launch:<provider>`, `handoff:<place>`.
    pub id: String,
    pub title: String,
    /// The key bound to it, as shown.
    pub keys: Option<String>,
    pub kind: Kind,
}

/// A session the palette can go to.
pub struct SessionRef {
    pub id: String,
    pub title: String,
}

/// The places the palette hands to Perch, with the id `handoff:<place>`.
pub const HAND_OFFS: [(&str, &str); 5] = [
    ("files", "Open Files in Perch"),
    ("changes", "Open Changes in Perch"),
    ("browser", "Open Browser in Perch"),
    ("chat", "Open Chat in Perch"),
    ("settings", "Open Settings in Perch"),
];

/// Every entry, in the order an empty query shows them.
pub fn entries(
    keymap: &Keymap,
    sessions: &[SessionRef],
    providers: &[Provider],
    has_tab: bool,
    pinned: Option<bool>,
) -> Vec<Entry> {
    let mut out: Vec<Entry> = all_shortcuts()
        // The alternate and the leader's follow-ups are other keys for the same commands.
        .filter(|s| {
            matches!(s.scope, Scope::Any | Scope::Terminal)
                && !s.id.ends_with("Alt")
                && s.id != "view.zoomInShift"
        })
        // A terminal's commands act on the tab on screen.
        .filter(|s| has_tab || s.scope != Scope::Terminal)
        .filter(|s| s.id != "leader.arm")
        .map(|s| Entry {
            id: s.id.into(),
            title: s.title.into(),
            keys: keymap.label(s.id),
            kind: Kind::Command,
        })
        .collect();
    if has_tab {
        out.push(Entry {
            id: "tab.rename".into(),
            title: "Rename a session's tab (empty: its own title again)".into(),
            keys: None,
            kind: Kind::Prompt,
        });
    }
    // The current workspace, when there is one the core can pin.
    if let Some(pinned) = pinned {
        out.push(Entry {
            id: "workspace.pin".into(),
            title: if pinned {
                "Unpin workspace"
            } else {
                "Pin workspace"
            }
            .into(),
            keys: None,
            kind: Kind::Command,
        });
    }
    out.extend(sessions.iter().map(|s| Entry {
        id: format!("session:{}", s.id),
        title: format!("Go to {}", s.title),
        keys: None,
        kind: Kind::Session,
    }));
    out.extend(providers.iter().map(|p| Entry {
        id: format!("launch:{}", p.id),
        title: format!("New {}", p.name),
        keys: None,
        kind: Kind::Launch,
    }));
    out.extend(HAND_OFFS.iter().map(|(place, title)| Entry {
        id: format!("handoff:{place}"),
        title: (*title).into(),
        keys: None,
        kind: Kind::HandOff,
    }));
    out
}

/// How well `query` matches `text`: its characters in order, ignoring case. `None` when they
/// are not all there. Runs of consecutive characters, a match at the start of a word and a short
/// text score higher.
pub fn fuzzy(query: &str, text: &str) -> Option<i64> {
    let text: Vec<char> = text.to_lowercase().chars().collect();
    let mut at = 0;
    let (mut score, mut run) = (0i64, 0i64);
    for q in query.to_lowercase().chars().filter(|c| !c.is_whitespace()) {
        let found = text[at..].iter().position(|c| *c == q)? + at;
        run = if found == at && score > 0 { run + 1 } else { 0 };
        let word_start = found == 0 || !text[found - 1].is_alphanumeric();
        score += 10 + run * 8 + if word_start { 12 } else { 0 } - (found - at).min(6) as i64;
        at = found + 1;
    }
    Some(score * 4 - text.len() as i64)
}

/// The entries `query` keeps, best first; an empty query keeps all in their order.
pub fn filter(entries: &[Entry], query: &str) -> Vec<usize> {
    if query.trim().is_empty() {
        return (0..entries.len()).collect();
    }
    let mut hits: Vec<(i64, usize)> = entries
        .iter()
        .enumerate()
        .filter_map(|(i, e)| {
            let by_title = fuzzy(query, &e.title);
            let by_id = fuzzy(query, &e.id);
            by_title.max(by_id).map(|score| (score, i))
        })
        .collect();
    hits.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
    hits.into_iter().map(|(_, i)| i).collect()
}

/// What a key did to a line of text being typed.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Edit {
    Changed,
    Enter,
    Escape,
    Ignored,
}

/// Type into `text`: printable characters, Backspace, Enter and Escape. Commands and the
/// control keys are left alone.
pub fn edit(text: &mut String, keystroke: &Keystroke) -> Edit {
    let m = keystroke.modifiers;
    match keystroke.key.as_str() {
        "enter" if !m.platform && !m.control && !m.alt => return Edit::Enter,
        "escape" => return Edit::Escape,
        "backspace" if !m.platform && !m.control && !m.alt => {
            return if text.pop().is_some() {
                Edit::Changed
            } else {
                Edit::Ignored
            };
        }
        _ => {}
    }
    match &keystroke.key_char {
        Some(typed) if !m.platform && !m.control && typed.chars().all(|c| !c.is_control()) => {
            text.push_str(typed);
            Edit::Changed
        }
        _ => Edit::Ignored,
    }
}

/// A line of text the palette asks for before running a command.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Prompt {
    pub command: String,
    pub label: String,
    pub text: String,
}

/// What a key did to the palette.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Outcome {
    Nothing,
    Close,
    Run(Entry),
    /// A prompt was answered.
    Submit {
        command: String,
        text: String,
    },
}

pub struct Palette {
    pub entries: Vec<Entry>,
    pub query: String,
    pub selected: usize,
    pub prompt: Option<Prompt>,
}

impl Palette {
    pub fn new(entries: Vec<Entry>) -> Self {
        Self {
            entries,
            query: String::new(),
            selected: 0,
            prompt: None,
        }
    }

    /// The entries shown, best first.
    pub fn shown(&self) -> Vec<&Entry> {
        filter(&self.entries, &self.query)
            .into_iter()
            .map(|i| &self.entries[i])
            .collect()
    }

    /// Ask for a line of text before running `command`.
    pub fn ask(&mut self, command: &str, label: &str, text: &str) {
        self.prompt = Some(Prompt {
            command: command.into(),
            label: label.into(),
            text: text.into(),
        });
    }

    /// One key: arrows and `ctrl-n`/`ctrl-p`/`ctrl-j`/`ctrl-k` move, Enter runs, Escape closes,
    /// other keys type.
    pub fn key(&mut self, keystroke: &Keystroke) -> Outcome {
        if let Some(prompt) = &mut self.prompt {
            return match edit(&mut prompt.text, keystroke) {
                Edit::Enter => Outcome::Submit {
                    command: prompt.command.clone(),
                    text: prompt.text.clone(),
                },
                Edit::Escape => Outcome::Close,
                _ => Outcome::Nothing,
            };
        }
        let m = keystroke.modifiers;
        let step = match (keystroke.key.as_str(), m.control) {
            ("down", _) | ("n" | "j", true) => Some(1isize),
            ("up", _) | ("p" | "k", true) => Some(-1),
            _ => None,
        };
        if let Some(step) = step {
            let len = self.shown().len() as isize;
            if len > 0 {
                self.selected = (self.selected as isize + step).rem_euclid(len) as usize;
            }
            return Outcome::Nothing;
        }
        match edit(&mut self.query, keystroke) {
            Edit::Changed => {
                self.selected = 0;
                Outcome::Nothing
            }
            Edit::Escape => Outcome::Close,
            Edit::Enter => self
                .shown()
                .get(self.selected)
                .map_or(Outcome::Nothing, |e| Outcome::Run((*e).clone())),
            Edit::Ignored => Outcome::Nothing,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    fn press(spec: &str) -> Keystroke {
        let mut ks = Keystroke::parse(spec).unwrap();
        // The keyboard sends the character a plain key types.
        if ks.key.chars().count() == 1 && !ks.modifiers.platform && !ks.modifiers.control {
            ks.key_char = Some(ks.key.clone());
        }
        ks
    }

    fn keymap() -> Keymap {
        Keymap::new(BTreeMap::new(), None).with_platform(true)
    }

    fn all() -> Vec<Entry> {
        let sessions = [
            SessionRef {
                id: "s1".into(),
                title: "Fix the build".into(),
            },
            SessionRef {
                id: "s2".into(),
                title: "Write docs".into(),
            },
        ];
        let providers = [Provider {
            id: "claude".into(),
            name: "Claude".into(),
        }];
        entries(&keymap(), &sessions, &providers, true, None)
    }

    fn titles(entries: &[Entry], idx: Vec<usize>) -> Vec<String> {
        idx.into_iter().map(|i| entries[i].id.clone()).collect()
    }

    #[test]
    fn the_pin_entry_names_what_it_will_do() {
        let title = |pinned| {
            entries(&keymap(), &[], &[], true, pinned)
                .into_iter()
                .find(|e| e.id == "workspace.pin")
                .map(|e| e.title)
        };
        assert_eq!(title(Some(false)).as_deref(), Some("Pin workspace"));
        assert_eq!(title(Some(true)).as_deref(), Some("Unpin workspace"));
        // No workspace to pin, or a core that cannot: no entry.
        assert_eq!(title(None), None);
    }

    #[test]
    fn it_lists_the_commands_with_the_webs_ids_titles_and_keys() {
        let all = all();
        let by_id = |id: &str| all.iter().find(|e| e.id == id).unwrap();
        assert_eq!(by_id("tabs.next").title, "Next tab");
        assert_eq!(by_id("tabs.next").keys.as_deref(), Some("⇧⌘]"));
        assert_eq!(by_id("global.navigator").title, "Open Navigator");
        assert_eq!(by_id("global.sidebar").keys.as_deref(), Some("⌘B"));
        assert!(by_id("sessions.new").title.starts_with("New session"));
        assert_eq!(by_id("session:s1").title, "Go to Fix the build");
        assert_eq!(by_id("launch:claude").title, "New Claude");
        assert_eq!(by_id("handoff:files").title, "Open Files in Perch");
        assert_eq!(by_id("tab.rename").kind, Kind::Prompt);
        // Another key for the same command, and the chord's follow-ups, are not listed again.
        assert!(all.iter().all(|e| e.id != "global.navigatorAlt"));
        assert!(all.iter().all(|e| !e.id.starts_with("leader.")));
        // Without a tab there is nothing to rename.
        assert!(entries(&keymap(), &[], &[], false, None)
            .iter()
            .all(|e| e.id != "tab.rename"));
    }

    #[test]
    fn typing_narrows_the_list_by_characters_in_order() {
        let all = all();
        let ids = |q: &str| titles(&all, filter(&all, q));
        assert_eq!(ids("").len(), all.len(), "an empty query keeps everything");
        assert_eq!(ids("splitr")[0], "panes.splitRight");
        assert_eq!(ids("fix bld")[0], "session:s1");
        assert_eq!(
            ids("qqq").len(),
            0,
            "characters that are not all there match nothing"
        );
        // In order: "ext" is in "Next tab", "txe" is in nothing.
        assert!(!ids("ext").is_empty());
        assert!(ids("txe").iter().all(|id| id != "tabs.next"));
        // The command's id matches too.
        assert!(ids("tabs.nex").contains(&"tabs.next".to_string()));
        // Case does not matter.
        assert_eq!(ids("OPEN FILES")[0], "handoff:files");
        // A closer match outranks a looser one.
        let next = ids("next tab");
        assert_eq!(next[0], "tabs.next");
    }

    #[test]
    fn arrows_and_the_navigator_keys_move_and_wrap() {
        let mut p = Palette::new(all());
        let n = p.shown().len();
        assert_eq!(p.key(&press("down")), Outcome::Nothing);
        assert_eq!(p.selected, 1);
        p.key(&press("ctrl-p"));
        p.key(&press("up"));
        assert_eq!(p.selected, n - 1, "up from the first wraps to the last");
        p.key(&press("ctrl-n"));
        p.key(&press("ctrl-j"));
        assert_eq!(p.selected, 1);
        p.key(&press("ctrl-k"));
        assert_eq!(p.selected, 0);
    }

    #[test]
    fn enter_runs_the_selected_entry_and_escape_closes() {
        let mut p = Palette::new(all());
        for c in "restore".chars() {
            p.key(&press(&c.to_string()));
        }
        assert_eq!(p.query, "restore");
        assert_eq!(p.selected, 0, "typing selects the best match");
        let Outcome::Run(entry) = p.key(&press("enter")) else {
            panic!("enter runs")
        };
        assert_eq!(entry.id, "panes.zoom");
        p.key(&press("backspace"));
        assert_eq!(p.query, "restor");
        assert_eq!(p.key(&press("escape")), Outcome::Close);
        // Nothing matches: Enter does nothing.
        let mut none = Palette::new(all());
        for c in "qqqqq".chars() {
            none.key(&press(&c.to_string()));
        }
        assert_eq!(none.key(&press("enter")), Outcome::Nothing);
    }

    #[test]
    fn a_prompt_collects_a_line_and_submits_it() {
        let mut p = Palette::new(all());
        p.ask("tab.rename", "Rename tab", "old");
        for c in "er".chars() {
            p.key(&press(&c.to_string()));
        }
        assert_eq!(
            p.key(&press("enter")),
            Outcome::Submit {
                command: "tab.rename".into(),
                text: "older".into()
            }
        );
        assert_eq!(p.key(&press("escape")), Outcome::Close);
    }

    #[test]
    fn commands_are_not_typed_into_the_query() {
        let mut text = String::new();
        let mut cmd_t = Keystroke::parse("cmd-t").unwrap();
        cmd_t.key_char = None;
        assert_eq!(edit(&mut text, &cmd_t), Edit::Ignored);
        assert_eq!(edit(&mut text, &press("a")), Edit::Changed);
        assert_eq!(text, "a");
    }
}

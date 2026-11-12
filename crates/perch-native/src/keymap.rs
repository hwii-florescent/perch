//! Key bindings: which command a key press runs, from the same two places the web client reads.
//!
//! 1. `settings.keybindings` over the shortcut table (`keybinds.ts`): the table gives each command
//!    its default keys, a person's choice replaces them, an empty choice unbinds, and a choice the
//!    web would not accept (unknown key, reserved by the macOS menu, no modifier) binds nothing.
//! 2. `keys.json` beside `mods/` (`keysFile.ts`), which the core sends in `mods.state`: sections,
//!    of which the more specific wins (`terminal` while a terminal has the keyboard, then
//!    `global`), each key bound to a command (`name` or `name:value`), `send:<text>`, `terminal`
//!    (the program gets the key) or `{command, args}`. It is read first, so the file wins.
//!
//! A key nothing binds goes to the terminal. Nothing here reads the keyboard or runs a command:
//! [`Keymap::resolve`] names what to run and the window runs it.
//!
//! Not built: `layout:<name>` and `mod:<name>` sections (this client shows no layout or mod
//! view), resize mode, and the follow-ups of the leader chord that resize a pane.

use crate::actions::{Action, ACTIONS};
use gpui::Keystroke;
use serde_json::Value;
use std::collections::BTreeMap;

/// Where a shortcut applies (`ShortcutScope` in the web).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Scope {
    Any,
    /// In a terminal the key belongs to the program.
    OutsideTerminal,
    /// A follow-up key after the leader chord.
    Leader,
    /// Run by the terminal itself (find, clear, jumps), not by the window.
    Terminal,
}

/// A named command and its default keys, by the web's id and wording.
#[derive(Clone, Copy, Debug)]
pub struct Shortcut {
    pub id: &'static str,
    pub title: &'static str,
    /// Defaults for macOS, then for other systems. One entry is both; `""` is none there. `mod`
    /// is Command on macOS and Control+Shift elsewhere.
    pub keys: &'static [&'static str],
    pub scope: Scope,
}

const fn s(id: &'static str, title: &'static str, keys: &'static [&'static str]) -> Shortcut {
    Shortcut {
        id,
        title,
        keys,
        scope: Scope::Any,
    }
}

const fn scoped(
    id: &'static str,
    title: &'static str,
    keys: &'static [&'static str],
    scope: Scope,
) -> Shortcut {
    Shortcut {
        id,
        title,
        keys,
        scope,
    }
}

impl From<&Action> for Shortcut {
    fn from(action: &Action) -> Self {
        s(action.id, action.description, action.keys)
    }
}

/// The commands the window runs besides the sidebar's (`actions::ACTIONS`).
pub const SHORTCUTS: &[Shortcut] = &[
    s("global.navigator", "Open Navigator", &["mod+p"]),
    scoped(
        "global.navigatorAlt",
        "Open Navigator (outside terminals)",
        &["cmd+k", "ctrl+k"],
        Scope::OutsideTerminal,
    ),
    s("global.settings", "Open Settings", &["mod+,"]),
    s(
        "tabs.new",
        "New tab (pick a harness) in this workspace",
        &["mod+t"],
    ),
    s(
        "tabs.close",
        "Close the focused pane, file or tab (agents ask first)",
        &["mod+w"],
    ),
    s("tabs.jump1", "Jump to tab 1", &["cmd+1", "alt+1"]),
    s("tabs.jump2", "Jump to tab 2", &["cmd+2", "alt+2"]),
    s("tabs.jump3", "Jump to tab 3", &["cmd+3", "alt+3"]),
    s("tabs.jump4", "Jump to tab 4", &["cmd+4", "alt+4"]),
    s("tabs.jump5", "Jump to tab 5", &["cmd+5", "alt+5"]),
    s("tabs.jump6", "Jump to tab 6", &["cmd+6", "alt+6"]),
    s("tabs.jump7", "Jump to tab 7", &["cmd+7", "alt+7"]),
    s("tabs.jump8", "Jump to tab 8", &["cmd+8", "alt+8"]),
    s("tabs.last", "Jump to the last tab", &["cmd+9", "alt+9"]),
    s("tabs.next", "Next tab", &["cmd+shift+]", "ctrl+pagedown"]),
    s("tabs.prev", "Previous tab", &["cmd+shift+[", "ctrl+pageup"]),
    s("panes.splitRight", "Split right", &["mod+d"]),
    s(
        "panes.splitDown",
        "Split down",
        &["cmd+shift+d", "alt+shift+d"],
    ),
    s("panes.prev", "Previous pane", &["mod+["]),
    s("panes.next", "Next pane", &["mod+]"]),
    s(
        "panes.zoom",
        "Zoom / restore the focused pane",
        &["mod+shift+enter"],
    ),
    s(
        "panes.focus.left",
        "Focus the pane to the left",
        &["cmd+alt+left", "ctrl+shift+alt+left"],
    ),
    s(
        "panes.focus.right",
        "Focus the pane to the right",
        &["cmd+alt+right", "ctrl+shift+alt+right"],
    ),
    s(
        "panes.focus.up",
        "Focus the pane above",
        &["cmd+alt+up", "ctrl+shift+alt+up"],
    ),
    s(
        "panes.focus.down",
        "Focus the pane below",
        &["cmd+alt+down", "ctrl+shift+alt+down"],
    ),
    s(
        "terminal.paste",
        "Paste the clipboard's text into a terminal",
        &[""],
    ),
    scoped(
        "leader.arm",
        "Leader prefix (then a follow-up key)",
        &["ctrl+space"],
        Scope::Any,
    ),
    scoped("leader.navigator", "Open Navigator", &["g"], Scope::Leader),
    scoped("leader.settings", "Open Settings", &["s"], Scope::Leader),
    scoped("leader.sidebar", "Toggle sidebar", &["b"], Scope::Leader),
    scoped("leader.nextTab", "Next tab", &["n"], Scope::Leader),
    scoped("leader.previousTab", "Previous tab", &["p"], Scope::Leader),
    scoped(
        "leader.close",
        "Close the focused pane, file or tab (agents ask first)",
        &["x"],
        Scope::Leader,
    ),
    scoped("leader.splitRight", "Split right", &["v"], Scope::Leader),
    scoped(
        "leader.splitDown",
        "Split down",
        &["shift+-"],
        Scope::Leader,
    ),
    scoped(
        "leader.zoom",
        "Zoom / restore the focused pane",
        &["z"],
        Scope::Leader,
    ),
    scoped("leader.nextPane", "Next pane", &["o"], Scope::Leader),
    scoped(
        "leader.focus.left",
        "Focus the pane to the left",
        &["h"],
        Scope::Leader,
    ),
    scoped(
        "leader.focus.down",
        "Focus the pane below",
        &["j"],
        Scope::Leader,
    ),
    scoped(
        "leader.focus.up",
        "Focus the pane above",
        &["k"],
        Scope::Leader,
    ),
    scoped(
        "leader.focus.right",
        "Focus the pane to the right",
        &["l"],
        Scope::Leader,
    ),
    scoped("leader.jump1", "Jump to tab 1", &["1"], Scope::Leader),
    scoped("leader.jump2", "Jump to tab 2", &["2"], Scope::Leader),
    scoped("leader.jump3", "Jump to tab 3", &["3"], Scope::Leader),
    scoped("leader.jump4", "Jump to tab 4", &["4"], Scope::Leader),
    scoped("leader.jump5", "Jump to tab 5", &["5"], Scope::Leader),
    scoped("leader.jump6", "Jump to tab 6", &["6"], Scope::Leader),
    scoped("leader.jump7", "Jump to tab 7", &["7"], Scope::Leader),
    scoped("leader.jump8", "Jump to tab 8", &["8"], Scope::Leader),
    scoped("leader.jump9", "Jump to tab 9", &["9"], Scope::Leader),
    scoped(
        "leader.newSession",
        "New session in this project",
        &["c"],
        Scope::Leader,
    ),
    scoped(
        "leader.swapNext",
        "Swap with the next pane",
        &["shift+]"],
        Scope::Leader,
    ),
    scoped(
        "leader.swap.left",
        "Swap pane left",
        &["shift+h"],
        Scope::Leader,
    ),
    scoped(
        "leader.swap.down",
        "Swap pane down",
        &["shift+j"],
        Scope::Leader,
    ),
    scoped(
        "leader.swap.up",
        "Swap pane up",
        &["shift+k"],
        Scope::Leader,
    ),
    scoped(
        "leader.swap.right",
        "Swap pane right",
        &["shift+l"],
        Scope::Leader,
    ),
];

/// Every shortcut the window answers: the sidebar's actions, then [`SHORTCUTS`].
pub fn all_shortcuts() -> impl Iterator<Item = Shortcut> {
    ACTIONS
        .iter()
        .map(Shortcut::from)
        .chain(SHORTCUTS.iter().copied())
}

/// The command a leader follow-up runs: `leader.splitRight` runs `panes.splitRight`.
pub fn leader_target(id: &str) -> Option<&'static str> {
    Some(match id.strip_prefix("leader.")? {
        "navigator" => "global.navigator",
        "settings" => "global.settings",
        "sidebar" => "global.sidebar",
        "nextTab" => "tabs.next",
        "previousTab" => "tabs.prev",
        "close" => "tabs.close",
        "splitRight" => "panes.splitRight",
        "splitDown" => "panes.splitDown",
        "zoom" => "panes.zoom",
        "nextPane" => "panes.next",
        "focus.left" => "panes.focus.left",
        "focus.down" => "panes.focus.down",
        "focus.up" => "panes.focus.up",
        "focus.right" => "panes.focus.right",
        "newSession" => "sessions.new",
        "jump1" => "tabs.jump1",
        "jump2" => "tabs.jump2",
        "jump3" => "tabs.jump3",
        "jump4" => "tabs.jump4",
        "jump5" => "tabs.jump5",
        "jump6" => "tabs.jump6",
        "jump7" => "tabs.jump7",
        "jump8" => "tabs.jump8",
        "jump9" => "tabs.last",
        "swapNext" => "pane.swapNext",
        "swap.left" => "pane.swap:left",
        "swap.down" => "pane.swap:down",
        "swap.up" => "pane.swap:up",
        "swap.right" => "pane.swap:right",
        _ => return None,
    })
}

/// The typed commands (`modCommands.ts`) a binding in `keys.json` or the palette may name, with
/// the argument `name:value` fills.
pub const TYPED: &[(&str, Option<&str>)] = &[
    ("tab.new", None),
    ("tab.next", None),
    ("tab.prev", None),
    ("tab.close", Some("id")),
    ("tab.select", Some("index")),
    ("tab.rename", Some("name")),
    ("tab.move", Some("index")),
    ("pane.split", Some("direction")),
    ("pane.close", Some("id")),
    ("pane.zoom", None),
    ("pane.go", Some("direction")),
    ("pane.swap", Some("direction")),
    // The leader chord's swap with the next pane (the web has it as a key only).
    ("pane.swapNext", None),
    ("pane.focus", Some("pane")),
    ("app.settings", None),
    ("app.palette", None),
    ("terminal.paste", None),
];

/// A key as a combination of modifiers and one key. `key` is the base key: `]` for both `]` and
/// `}`, which are the one key with and without Shift.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Chord {
    pub cmd: bool,
    pub ctrl: bool,
    pub alt: bool,
    pub shift: bool,
    pub key: String,
}

/// The characters Shift turns other keys into (US layout), with the key they come from. GPUI
/// reports `cmd-shift-]` as `}` with no Shift, so a chord compares against the base key.
const SHIFTED: [(char, char); 21] = [
    ('{', '['),
    ('}', ']'),
    (':', ';'),
    ('"', '\''),
    ('<', ','),
    ('>', '.'),
    ('?', '/'),
    ('|', '\\'),
    ('_', '-'),
    ('+', '='),
    ('~', '`'),
    ('!', '1'),
    ('@', '2'),
    ('#', '3'),
    ('$', '4'),
    ('%', '5'),
    ('^', '6'),
    ('&', '7'),
    ('*', '8'),
    ('(', '9'),
    (')', '0'),
];

/// `key` as the key it comes from and whether Shift makes it.
fn base_key(key: &str, shift: bool) -> (String, bool) {
    let mut chars = key.chars();
    if let (Some(c), None) = (chars.next(), chars.next()) {
        if let Some((_, base)) = SHIFTED.iter().find(|(shifted, _)| *shifted == c) {
            return (base.to_string(), true);
        }
        if c.is_ascii_uppercase() {
            return (c.to_ascii_lowercase().to_string(), true);
        }
    }
    (key.to_lowercase(), shift)
}

const NAMED: [&str; 12] = [
    "enter",
    "tab",
    "space",
    "backspace",
    "delete",
    "up",
    "down",
    "left",
    "right",
    "pageup",
    "pagedown",
    "home",
];

fn valid_key(token: &str) -> bool {
    let mut chars = token.chars();
    let single = matches!((chars.next(), chars.next()), (Some(c), None)
        if c.is_ascii_lowercase() || c.is_ascii_digit() || "[],./\\-=`;'".contains(c));
    single
        || NAMED.contains(&token)
        || token == "end"
        || token == "escape"
        || token
            .strip_prefix('f')
            .and_then(|n| n.parse::<u8>().ok())
            .is_some_and(|n| (1..=12).contains(&n))
}

/// A combination in the settings' notation: `cmd+shift+]`, `ctrl+alt+left`, `f5`. `mod` is
/// Command on macOS and Control+Shift elsewhere. `None` for an unknown key or modifier.
pub fn parse_combo(spec: &str, mac: bool) -> Option<Chord> {
    let mut chord = Chord::default();
    let mut parts = spec.split('+').peekable();
    while let Some(part) = parts.next() {
        let last = parts.peek().is_none();
        match part {
            "mod" if mac => chord.cmd = true,
            "mod" => (chord.ctrl, chord.shift) = (true, true),
            "cmd" => chord.cmd = true,
            "ctrl" => chord.ctrl = true,
            "shift" => chord.shift = true,
            "alt" => chord.alt = true,
            key if last && valid_key(key) => chord.key = key.to_string(),
            _ => return None,
        }
    }
    (!chord.key.is_empty()).then_some(chord)
}

/// A key in `keys.json`'s notation: `ctrl-shift-t`, `alt-1`, `cmd-shift-]`, `cmd-}`, `ctrl-pagedown`.
pub fn parse_chord(spec: &str) -> Option<Chord> {
    let mut chord = Chord::default();
    let mut rest = spec.trim().to_lowercase();
    while let Some((name, after)) = rest.split_once('-') {
        match name {
            "ctrl" | "control" => chord.ctrl = true,
            "alt" | "option" | "opt" => chord.alt = true,
            "shift" => chord.shift = true,
            "cmd" | "command" | "super" | "meta" => chord.cmd = true,
            _ => break,
        }
        if after.is_empty() {
            break;
        }
        rest = after.to_string();
    }
    let key = match rest.as_str() {
        "return" => "enter",
        "esc" => "escape",
        "plus" => "+",
        "minus" => "-",
        "arrowleft" => "left",
        "arrowright" => "right",
        "arrowup" => "up",
        "arrowdown" => "down",
        other => other,
    };
    if key.is_empty() {
        return None;
    }
    let (key, shift) = base_key(key, chord.shift);
    (chord.key, chord.shift) = (key, shift);
    Some(chord)
}

/// Whether the press is the chord.
pub fn matches(chord: &Chord, keystroke: &Keystroke) -> bool {
    let m = keystroke.modifiers;
    let (key, shift) = base_key(&keystroke.key, m.shift);
    m.platform == chord.cmd
        && m.control == chord.ctrl
        && m.alt == chord.alt
        && shift == chord.shift
        && key == chord.key
}

/// Keys the macOS menu handles before any app (Quit, Hide, Copy, Paste...); no command may take them.
const MAC_RESERVED: [&str; 11] = [
    "cmd+q",
    "cmd+h",
    "cmd+alt+h",
    "cmd+m",
    "cmd+ctrl+f",
    "cmd+z",
    "cmd+shift+z",
    "cmd+x",
    "cmd+c",
    "cmd+v",
    "cmd+a",
];

fn reserved(chord: &Chord, mac: bool) -> bool {
    mac && MAC_RESERVED
        .iter()
        .any(|spec| parse_combo(spec, true).is_some_and(|reserved| reserved == *chord))
}

fn function_key(chord: &Chord) -> bool {
    chord.key.starts_with('f') && chord.key[1..].parse::<u8>().is_ok()
}

/// The combination `shortcut` is bound to: the person's choice, else the default; `None` when it
/// has none. A choice is refused as the web refuses it: empty (unbound), not a key, reserved by
/// the macOS menu, or without Command, Control, Alt or a function key (a plain key would swallow
/// typing, except for a leader follow-up).
pub fn effective_spec(
    shortcut: &Shortcut,
    chosen: &BTreeMap<String, String>,
    mac: bool,
) -> Option<Chord> {
    if let Some(own) = chosen.get(shortcut.id) {
        let chord = parse_combo(own, mac).filter(|c| !reserved(c, mac))?;
        let plain_ok = shortcut.scope == Scope::Leader;
        return (plain_ok || chord.cmd || chord.ctrl || chord.alt || function_key(&chord))
            .then_some(chord);
    }
    let default = match shortcut.keys {
        [both] => both,
        [for_mac, other] => {
            if mac {
                for_mac
            } else {
                other
            }
        }
        _ => return None,
    };
    if default.is_empty() {
        None
    } else {
        parse_combo(default, mac)
    }
}

/// What a press means.
#[derive(Clone, Debug, PartialEq)]
pub enum Hit {
    /// Run this command.
    Run { name: String, args: Option<Value> },
    /// Type this text into the focused terminal (`send:<text>` in `keys.json`).
    Send(String),
    /// `keys.json` says the program gets this key.
    Terminal,
    /// A binding in `keys.json` that cannot run. The press is swallowed and this says why.
    Fault(String),
    /// The leader chord was armed and this press ended it without a follow-up.
    LeaderEnded,
}

/// Where the keyboard is.
#[derive(Clone, Copy, Debug, Default)]
pub struct Context {
    /// A terminal has the keyboard.
    pub in_terminal: bool,
    /// A text field has it, so plain keys are typing.
    pub typing: bool,
    /// The leader chord was pressed and its follow-up is awaited.
    pub leader: bool,
}

#[derive(Clone, Debug)]
pub struct Keymap {
    chosen: BTreeMap<String, String>,
    file: Option<Value>,
    mac: bool,
}

impl Keymap {
    pub fn new(chosen: BTreeMap<String, String>, file: Option<Value>) -> Self {
        Self {
            chosen,
            file,
            mac: cfg!(target_os = "macos"),
        }
    }

    pub fn with_platform(mut self, mac: bool) -> Self {
        self.mac = mac;
        self
    }

    /// The key a command shows in the palette: the person's choice, else the default.
    pub fn label(&self, id: &str) -> Option<String> {
        let shortcut = all_shortcuts().find(|s| s.id == id)?;
        effective_spec(&shortcut, &self.chosen, self.mac).map(|c| self.format(&c))
    }

    /// `cmd+shift+]` as `⇧⌘]` on a Mac, `Ctrl+Shift+]` elsewhere.
    fn format(&self, c: &Chord) -> String {
        let key = match c.key.as_str() {
            "up" => "↑".into(),
            "down" => "↓".into(),
            "left" => "←".into(),
            "right" => "→".into(),
            "enter" => "Enter".into(),
            "pageup" => "PgUp".into(),
            "pagedown" => "PgDn".into(),
            other => other.to_uppercase(),
        };
        if self.mac {
            format!(
                "{}{}{}{}{key}",
                if c.ctrl { "⌃" } else { "" },
                if c.alt { "⌥" } else { "" },
                if c.shift { "⇧" } else { "" },
                if c.cmd { "⌘" } else { "" },
            )
        } else {
            let mods = [
                (c.ctrl, "Ctrl"),
                (c.alt, "Alt"),
                (c.shift, "Shift"),
                (c.cmd, "Super"),
            ];
            let mut parts: Vec<String> = mods
                .iter()
                .filter(|(on, _)| *on)
                .map(|(_, name)| name.to_string())
                .collect();
            parts.push(key);
            parts.join("+")
        }
    }

    /// What `keystroke` means, or `None` when nothing binds it and it goes to the terminal.
    pub fn resolve(&self, keystroke: &Keystroke, context: Context) -> Option<Hit> {
        let m = keystroke.modifiers;
        // Never taken, so a bad binding cannot lock the keyboard.
        if m.control && m.alt && m.shift && keystroke.key == "escape" {
            return None;
        }
        if context.leader {
            return Some(self.follow_up(keystroke));
        }
        if let Some(hit) = self.file_hit(keystroke, context) {
            return Some(hit);
        }
        all_shortcuts()
            .filter(|s| match s.scope {
                Scope::Any => true,
                Scope::OutsideTerminal => !context.in_terminal,
                Scope::Leader | Scope::Terminal => false,
            })
            .find(|s| {
                effective_spec(s, &self.chosen, self.mac).is_some_and(|c| matches(&c, keystroke))
            })
            .map(|s| Hit::Run {
                name: s.id.to_string(),
                args: None,
            })
    }

    /// The press after the leader chord: a follow-up runs, Escape ends it quietly, anything else
    /// ends it and still goes to the terminal.
    fn follow_up(&self, keystroke: &Keystroke) -> Hit {
        let found = all_shortcuts()
            .filter(|s| s.scope == Scope::Leader)
            .find(|s| {
                effective_spec(s, &self.chosen, self.mac).is_some_and(|c| matches(&c, keystroke))
            })
            .and_then(|s| leader_target(s.id));
        match found {
            Some(target) => command_hit(target),
            None => Hit::LeaderEnded,
        }
    }

    fn file_hit(&self, keystroke: &Keystroke, context: Context) -> Option<Hit> {
        let sections = self.file.as_ref()?.as_object()?;
        let order = [context.in_terminal.then_some("terminal"), Some("global")];
        for name in order.into_iter().flatten() {
            let Some(bindings) = sections.get(name).and_then(Value::as_object) else {
                continue;
            };
            for (spec, action) in bindings {
                let Some(chord) = parse_chord(spec).filter(|c| matches(c, keystroke)) else {
                    continue;
                };
                // Plain keys stay with a text field.
                if !(chord.ctrl || chord.alt || chord.cmd) && context.typing {
                    continue;
                }
                return Some(perform(action, context.in_terminal));
            }
        }
        None
    }
}

/// A command written `name` or `pane.swap:left` as a hit.
fn command_hit(action: &str) -> Hit {
    let (name, value) = match action.split_once(':') {
        Some((name, value)) => (name, Some(value)),
        None => (action, None),
    };
    let args = value.and_then(|value| {
        let first = TYPED.iter().find(|(id, _)| *id == name)?.1?;
        let number = value.parse::<f64>().ok().filter(|_| first == "index");
        Some(serde_json::json!({ first: number.map_or_else(|| Value::from(value), Value::from) }))
    });
    Hit::Run {
        name: name.to_string(),
        args,
    }
}

/// `keysFile.perform`: what a bound action does.
fn perform(action: &Value, in_terminal: bool) -> Hit {
    match action {
        Value::String(text) if text == "terminal" => Hit::Terminal,
        Value::String(text) if text.is_empty() => Hit::Fault(
            "An action is a command name, send:<text>, terminal or {command, args}.".into(),
        ),
        Value::String(text) => {
            if let Some(typed) = text.strip_prefix("send:") {
                return if in_terminal {
                    Hit::Send(typed.to_string())
                } else {
                    Hit::Fault("send: types into a terminal, and none has focus.".into())
                };
            }
            if let Some((name, _)) = text.split_once(':') {
                if TYPED
                    .iter()
                    .find(|(id, _)| id == &name)
                    .is_none_or(|t| t.1.is_none())
                {
                    return Hit::Fault(format!("{name} takes no value."));
                }
            }
            command_hit(text)
        }
        Value::Object(map) => match (map.get("command"), map.get("args")) {
            (Some(Value::String(command)), None) if !command.is_empty() => Hit::Run {
                name: command.clone(),
                args: None,
            },
            (Some(Value::String(command)), Some(args))
                if args.is_object() && !command.is_empty() =>
            {
                Hit::Run {
                    name: command.clone(),
                    args: Some(args.clone()),
                }
            }
            (Some(Value::String(_)), Some(_)) => Hit::Fault("args is an object.".into()),
            _ => Hit::Fault("A binding object needs a command.".into()),
        },
        _ => Hit::Fault(
            "An action is a command name, send:<text>, terminal or {command, args}.".into(),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gpui::Modifiers;
    use serde_json::json;

    fn press(spec: &str) -> Keystroke {
        Keystroke::parse(spec).unwrap()
    }

    fn keymap(chosen: &[(&str, &str)], file: Option<Value>) -> Keymap {
        Keymap::new(
            chosen
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
            file,
        )
        .with_platform(true)
    }

    fn run(hit: Option<Hit>) -> String {
        match hit {
            Some(Hit::Run { name, .. }) => name,
            other => format!("{other:?}"),
        }
    }

    const IN_TERMINAL: Context = Context {
        in_terminal: true,
        typing: false,
        leader: false,
    };

    #[test]
    fn the_defaults_are_the_webs_for_each_system() {
        let m = keymap(&[], None);
        assert_eq!(run(m.resolve(&press("cmd-t"), IN_TERMINAL)), "tabs.new");
        assert_eq!(
            run(m.resolve(&press("cmd-b"), IN_TERMINAL)),
            "global.sidebar"
        );
        assert_eq!(
            run(m.resolve(&press("cmd-shift-u"), IN_TERMINAL)),
            "global.needsYou"
        );
        assert_eq!(
            run(m.resolve(&press("cmd-alt-left"), IN_TERMINAL)),
            "panes.focus.left"
        );
        // On another system `mod` is Control+Shift and the second default applies.
        let other = keymap(&[], None).with_platform(false);
        assert_eq!(
            run(other.resolve(&press("ctrl-shift-t"), IN_TERMINAL)),
            "tabs.new"
        );
        assert_eq!(
            run(other.resolve(&press("ctrl-pagedown"), IN_TERMINAL)),
            "tabs.next"
        );
        assert_eq!(other.resolve(&press("cmd-shift-]"), IN_TERMINAL), None);
        // A default for macOS alone is not bound elsewhere.
        assert_eq!(other.label("nests.scratchpad"), None);
        assert_eq!(m.label("nests.scratchpad").as_deref(), Some("⇧⌘N"));
    }

    #[test]
    fn gpui_spells_a_shifted_key_by_what_it_types() {
        // GPUI reports cmd-shift-] as `}` with no Shift; a test or another platform may say `]` + Shift.
        let m = keymap(&[], None);
        let as_typed = Keystroke {
            modifiers: Modifiers {
                platform: true,
                ..Default::default()
            },
            key: "}".into(),
            key_char: None,
        };
        assert_eq!(run(m.resolve(&as_typed, IN_TERMINAL)), "tabs.next");
        assert_eq!(
            run(m.resolve(&press("cmd-shift-]"), IN_TERMINAL)),
            "tabs.next"
        );
        // Not the key without Shift.
        assert_eq!(run(m.resolve(&press("cmd-]"), IN_TERMINAL)), "panes.next");
    }

    #[test]
    fn a_chosen_key_replaces_the_default_and_an_empty_one_unbinds() {
        let m = keymap(&[("global.sidebar", "cmd+shift+b")], None);
        assert_eq!(m.resolve(&press("cmd-b"), IN_TERMINAL), None);
        assert_eq!(
            run(m.resolve(&press("cmd-shift-b"), IN_TERMINAL)),
            "global.sidebar"
        );
        let off = keymap(&[("global.sidebar", "")], None);
        assert_eq!(off.resolve(&press("cmd-b"), IN_TERMINAL), None);
        assert_eq!(off.label("global.sidebar"), None);
    }

    #[test]
    fn a_choice_the_web_would_refuse_binds_nothing() {
        for bad in [
            "cmd+nonsense",
            "b",       // no modifier would swallow typing
            "shift+b", // Shift alone is still typing
            "cmd+c",   // the macOS menu's
            "cmd+shift+z",
        ] {
            let m = keymap(&[("global.sidebar", bad)], None);
            assert_eq!(m.label("global.sidebar"), None, "{bad}");
        }
        // A function key may stand alone.
        let m = keymap(&[("global.sidebar", "f5")], None);
        assert_eq!(run(m.resolve(&press("f5"), IN_TERMINAL)), "global.sidebar");
    }

    #[test]
    fn a_key_outside_terminals_leaves_the_program_its_key() {
        let m = keymap(&[], None);
        assert_eq!(
            run(m.resolve(&press("cmd-k"), Context::default())),
            "global.navigatorAlt"
        );
        assert_eq!(m.resolve(&press("cmd-k"), IN_TERMINAL), None);
    }

    #[test]
    fn the_file_wins_and_the_terminal_section_is_more_specific_than_global() {
        let file = json!({
            "global": {"cmd-t": "pane.split:down", "ctrl-shift-x": "tab.next", "cmd-1": "tab.select:3"},
            "terminal": {"cmd-t": "terminal", "alt-j": "send:ls\r", "cmd-2": {"command": "pane.go", "args": {"direction": "right"}}},
        });
        let m = keymap(&[], Some(file));
        // In a terminal the terminal section is read first: the program gets the key.
        assert_eq!(m.resolve(&press("cmd-t"), IN_TERMINAL), Some(Hit::Terminal));
        // Elsewhere only global applies, and it beats the table's cmd-t.
        assert_eq!(
            m.resolve(&press("cmd-t"), Context::default()),
            Some(Hit::Run {
                name: "pane.split".into(),
                args: Some(json!({"direction": "down"}))
            })
        );
        // The value fills the command's first argument, a number where it is an index.
        assert_eq!(
            m.resolve(&press("cmd-1"), IN_TERMINAL),
            Some(Hit::Run {
                name: "tab.select".into(),
                args: Some(json!({"index": 3.0}))
            })
        );
        assert_eq!(
            m.resolve(&press("cmd-2"), IN_TERMINAL),
            Some(Hit::Run {
                name: "pane.go".into(),
                args: Some(json!({"direction": "right"}))
            })
        );
        assert_eq!(
            m.resolve(&press("ctrl-shift-x"), IN_TERMINAL)
                .map(|h| matches!(h, Hit::Run { .. })),
            Some(true)
        );
    }

    #[test]
    fn send_types_only_where_a_terminal_has_the_keyboard() {
        let file = json!({"global": {"alt-j": "send:ls\r"}});
        let m = keymap(&[], Some(file));
        assert_eq!(
            m.resolve(&press("alt-j"), IN_TERMINAL),
            Some(Hit::Send("ls\r".into()))
        );
        assert!(matches!(
            m.resolve(&press("alt-j"), Context::default()),
            Some(Hit::Fault(_))
        ));
    }

    #[test]
    fn a_bad_binding_swallows_the_key_and_says_why() {
        let file = json!({"global": {
            "cmd-1": 5,
            "cmd-2": "",
            "cmd-3": {"args": {}},
            "cmd-4": {"command": "tab.next", "args": [1]},
            "cmd-5": "tab.next:1",
        }});
        let m = keymap(&[], Some(file));
        for key in ["cmd-1", "cmd-2", "cmd-3", "cmd-4", "cmd-5"] {
            assert!(
                matches!(m.resolve(&press(key), IN_TERMINAL), Some(Hit::Fault(_))),
                "{key}"
            );
        }
    }

    #[test]
    fn plain_keys_stay_with_a_text_field_and_the_escape_hatch_is_never_taken() {
        let file = json!({"global": {"f": "tab.next", "ctrl-alt-shift-escape": "tab.next"}});
        let m = keymap(&[], Some(file));
        assert_eq!(run(m.resolve(&press("f"), IN_TERMINAL)), "tab.next");
        let typing = Context {
            typing: true,
            ..Default::default()
        };
        assert_eq!(m.resolve(&press("f"), typing), None);
        assert_eq!(
            m.resolve(&press("ctrl-alt-shift-escape"), IN_TERMINAL),
            None
        );
    }

    #[test]
    fn the_leader_chord_runs_a_follow_up_or_ends_quietly() {
        let m = keymap(&[], None);
        assert_eq!(
            run(m.resolve(&press("ctrl-space"), IN_TERMINAL)),
            "leader.arm"
        );
        let armed = Context {
            leader: true,
            ..IN_TERMINAL
        };
        assert_eq!(run(m.resolve(&press("v"), armed)), "panes.splitRight");
        assert_eq!(run(m.resolve(&press("shift-_"), armed)), "panes.splitDown");
        assert_eq!(run(m.resolve(&press("3"), armed)), "tabs.jump3");
        assert_eq!(
            m.resolve(&press("shift-h"), armed),
            Some(Hit::Run {
                name: "pane.swap".into(),
                args: Some(json!({"direction": "left"}))
            })
        );
        // Not a follow-up: the leader ends, and no other command runs behind it.
        assert_eq!(m.resolve(&press("cmd-t"), armed), Some(Hit::LeaderEnded));
        assert_eq!(m.resolve(&press("q"), armed), Some(Hit::LeaderEnded));
    }

    #[test]
    fn the_defaults_match_the_ones_the_web_ships_to_the_desktop_app() {
        // [id, KeyboardEvent.code, layout letter, Cmd=1 Ctrl=2 Alt=4 Shift=8]
        let fixture: Value = serde_json::from_str(include_str!(
            "../../../packages/web/src/nativeShortcutBindings.fixture.json"
        ))
        .unwrap();
        let code = |c: &Chord| -> String {
            match c.key.as_str() {
                k if k.len() == 1 && k.as_bytes()[0].is_ascii_lowercase() => {
                    format!("Key{}", k.to_uppercase())
                }
                k if k.len() == 1 && k.as_bytes()[0].is_ascii_digit() => format!("Digit{k}"),
                "[" => "BracketLeft".into(),
                "]" => "BracketRight".into(),
                "," => "Comma".into(),
                "/" => "Slash".into(),
                "-" => "Minus".into(),
                "=" => "Equal".into(),
                "enter" => "Enter".into(),
                "space" => "Space".into(),
                "up" => "ArrowUp".into(),
                "down" => "ArrowDown".into(),
                "left" => "ArrowLeft".into(),
                "right" => "ArrowRight".into(),
                other => other.into(),
            }
        };
        let mut checked = 0;
        for section in ["global", "modeKeys"] {
            for entry in fixture[section].as_array().unwrap() {
                let id = entry[0].as_str().unwrap();
                let Some(shortcut) = all_shortcuts().find(|s| s.id == id) else {
                    continue;
                };
                let chord = effective_spec(&shortcut, &BTreeMap::new(), true)
                    .unwrap_or_else(|| panic!("{id} has no default key here"));
                let mask = u64::from(chord.cmd)
                    | u64::from(chord.ctrl) << 1
                    | u64::from(chord.alt) << 2
                    | u64::from(chord.shift) << 3;
                assert_eq!(code(&chord), entry[1].as_str().unwrap(), "{id}: key");
                assert_eq!(mask, entry[3].as_u64().unwrap(), "{id}: modifiers");
                checked += 1;
            }
        }
        assert!(checked > 60, "only {checked} defaults were compared");
    }

    #[test]
    fn every_leader_follow_up_runs_something_this_window_knows() {
        for s in SHORTCUTS.iter().filter(|s| s.scope == Scope::Leader) {
            let target = leader_target(s.id).unwrap_or_else(|| panic!("{} runs nothing", s.id));
            let name = target.split(':').next().unwrap();
            assert!(
                all_shortcuts().any(|k| k.id == name) || TYPED.iter().any(|(id, _)| *id == name),
                "{} runs {target}, which is not a command",
                s.id
            );
        }
    }
}

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
//! Last, in a terminal on macOS, the editing keys the web never sends the program (Command with
//! Left, Right or Backspace go to the app there) are line start, line end and delete to line start
//! (`LINE_EDITING`, as herdr ships them). A binding above replaces them, and [`Hit::Edit`] is
//! typed only when the program has not asked for the real chords.
//!
//! A key nothing binds goes to the terminal. Nothing here reads the keyboard or runs a command:
//! [`Keymap::resolve`] names what to run and the window runs it.
//!
//! Resize mode is the web's: the leader's follow-up `r` arms it, and each of its keys resizes the
//! focused pane and keeps it armed; any other key, Escape or the timeout ends it.
//!
//! Not built: `layout:<name>` and `mod:<name>` sections (this client shows no layout or mod
//! view).

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
    /// Neither a terminal nor a text field has the keyboard (a plain key there is typing).
    OutsideEditable,
    /// A follow-up key after the leader chord.
    Leader,
    /// A key of resize mode (the leader's follow-up `r`).
    Resize,
    /// A command on the terminal that has the keyboard (find, clear, copy, scroll). It applies only
    /// while a terminal has the keyboard; the window runs it on that terminal.
    Terminal,
    /// The folder browser's own keys: the screen asks for them (`shortcutFor(event, "directory")`),
    /// the window never runs them.
    Directory,
    /// The Navigator's result keys, asked for by its screen as `Directory`'s are.
    Navigator,
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

const fn terminal(
    id: &'static str,
    title: &'static str,
    keys: &'static [&'static str],
) -> Shortcut {
    scoped(id, title, keys, Scope::Terminal)
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
    s("nests.new", "New workspace (worktree)", &["mod+n"]),
    s("nests.addBirdhouse", "Add project", &["mod+o"]),
    scoped(
        "global.navigatorAlt",
        "Open Navigator (outside terminals)",
        &["cmd+k", "ctrl+k"],
        Scope::OutsideTerminal,
    ),
    s("global.settings", "Open Settings", &["mod+,"]),
    s("global.help", "Open this keybind help", &["mod+/"]),
    scoped(
        "global.helpPlain",
        "Open keybind help (outside inputs)",
        &["shift+/"],
        Scope::OutsideEditable,
    ),
    // VS Code's keys, as the web's: Command on a Mac, Control elsewhere.
    s("view.zoomIn", "Zoom in", &["cmd+=", "ctrl+="]),
    s(
        "view.zoomInShift",
        "Zoom in (the + key)",
        &["cmd+shift+=", "ctrl+shift+="],
    ),
    s("view.zoomOut", "Zoom out", &["cmd+-", "ctrl+-"]),
    s("view.zoomReset", "Reset zoom", &["cmd+0", "ctrl+0"]),
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
    s(
        "tabs.keepOpen",
        "Keep the preview tab open (make it a regular tab)",
        &["cmd+alt+enter", "ctrl+alt+enter"],
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
    // History, not position: where you were before and after, as the web's (VS Code's Ctrl+-).
    s(
        "nav.back",
        "Back to where you were",
        &["ctrl+-", "alt+shift+left"],
    ),
    s(
        "nav.forward",
        "Forward",
        &["ctrl+shift+-", "alt+shift+right"],
    ),
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
    // The terminal's own commands. The web runs these in the terminal (`terminalSearch.ts`); here
    // the window's keymap runs them, so a person's choice of key applies and a key bound here
    // never reaches the program. Page up and down, stop, take control and take back have no default key.
    terminal("terminal.find", "Find in the terminal", &["mod+f"]),
    terminal(
        "terminal.clear",
        "Clear the terminal (screen and scrollback)",
        &["mod+k"],
    ),
    terminal("terminal.scrollTop", "Scroll to the top", &["mod+up"]),
    terminal(
        "terminal.scrollBottom",
        "Scroll to the bottom",
        &["mod+down"],
    ),
    terminal(
        "terminal.prevCommand",
        "Jump to the previous command",
        &["cmd+shift+up", "ctrl+shift+pageup"],
    ),
    terminal(
        "terminal.nextCommand",
        "Jump to the next command",
        &["cmd+shift+down", "ctrl+shift+pagedown"],
    ),
    terminal("terminal.scrollPageUp", "Scroll up a page", &[""]),
    terminal("terminal.scrollPageDown", "Scroll down a page", &[""]),
    terminal(
        "terminal.copy",
        "Copy the terminal's selected text to the clipboard",
        &["mod+c"],
    ),
    terminal(
        "terminal.paste",
        "Paste the clipboard's text into a terminal",
        &["mod+v"],
    ),
    terminal(
        "terminal.selectAll",
        "Select all of the terminal's text",
        &["mod+a"],
    ),
    terminal(
        "terminal.takeControl",
        "Take this terminal's input and size from the view that holds them",
        &[""],
    ),
    // The phone-size notice's two choices (`stock:phone-size`); the web gives them no key.
    terminal(
        "terminal.takeBack",
        "Take back this tab's size from a phone",
        &[""],
    ),
    scoped(
        "terminal.takeBackAll",
        "Take back all tabs' sizes from a phone",
        &[""],
        Scope::Any,
    ),
    terminal("terminal.kill", "Stop the terminal's process", &[""]),
    scoped(
        "leader.arm",
        "Leader prefix (then a follow-up key)",
        &["ctrl+space"],
        Scope::Any,
    ),
    scoped("leader.navigator", "Open Navigator", &["g"], Scope::Leader),
    scoped("leader.settings", "Open Settings", &["s"], Scope::Leader),
    scoped(
        "leader.help",
        "Open this keybind help",
        &["shift+/"],
        Scope::Leader,
    ),
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
        "leader.nextProject",
        "Next project's most recent session",
        &["w"],
        Scope::Leader,
    ),
    scoped(
        "leader.worktree",
        "Open this project's worktree menu",
        &["shift+w"],
        Scope::Leader,
    ),
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
        "leader.grow",
        "Grow the focused pane",
        &["shift+="],
        Scope::Leader,
    ),
    scoped(
        "leader.shrink",
        "Shrink the focused pane",
        &["-"],
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
    scoped(
        "leader.resize",
        "Enter resize mode (Escape or timeout exits)",
        &["r"],
        Scope::Leader,
    ),
    scoped(
        "resize.left",
        "Resize pane left (shrink)",
        &["h"],
        Scope::Resize,
    ),
    scoped(
        "resize.down",
        "Resize pane down (shrink)",
        &["j"],
        Scope::Resize,
    ),
    scoped("resize.up", "Resize pane up (grow)", &["k"], Scope::Resize),
    scoped(
        "resize.right",
        "Resize pane right (grow)",
        &["l"],
        Scope::Resize,
    ),
    scoped(
        "navigator.next",
        "Next Navigator result",
        &["ctrl+j"],
        Scope::Navigator,
    ),
    scoped(
        "navigator.nextAlt",
        "Next Navigator result (alternate)",
        &["ctrl+n"],
        Scope::Navigator,
    ),
    scoped(
        "navigator.previous",
        "Previous Navigator result",
        &["ctrl+k"],
        Scope::Navigator,
    ),
    scoped(
        "navigator.previousAlt",
        "Previous Navigator result (alternate)",
        &["ctrl+p"],
        Scope::Navigator,
    ),
    scoped(
        "directory.use",
        "Use this folder",
        &["cmd+enter"],
        Scope::Directory,
    ),
    scoped(
        "directory.useAlt",
        "Use this folder (alternate)",
        &["ctrl+enter"],
        Scope::Directory,
    ),
];

/// Every shortcut the window answers: the sidebar's actions, then [`SHORTCUTS`].
pub fn all_shortcuts() -> impl Iterator<Item = Shortcut> {
    ACTIONS
        .iter()
        .map(Shortcut::from)
        .chain(SHORTCUTS.iter().copied())
}

/// The jump ranges the keybind help lists as one row: id prefix, what is jumped to, the span.
const JUMP_RANGES: [(&str, &str, &str); 3] = [
    ("tabs.jump", "tab", "1…8"),
    ("nests.jump", "workspace", "1…9"),
    ("leader.jump", "tab", "1…9"),
];

/// Whether `id` is one of range `range`'s commands (`tabs.jump3` of `tabs.jump`).
fn range_member(id: &str, range: &str) -> bool {
    id.strip_prefix(range)
        .is_some_and(|n| !n.is_empty() && n.chars().all(|c| c.is_ascii_digit()))
}

/// The keybind help's group of a command, as the web groups its table (`KeybindGroup`).
fn help_group(id: &str) -> &'static str {
    match id.split('.').next().unwrap_or("") {
        "tabs" | "sessions" | "nav" => "tabs",
        "nests" => "nests",
        "panes" => "panes",
        "terminal" => "terminal",
        "leader" => "leader",
        "resize" => "resize",
        "directory" => "directory",
        "navigator" => "navigator",
        _ => "global",
    }
}

/// The command a leader follow-up runs: `leader.splitRight` runs `panes.splitRight`.
pub fn leader_target(id: &str) -> Option<&'static str> {
    Some(match id.strip_prefix("leader.")? {
        "navigator" => "global.navigator",
        "settings" => "global.settings",
        "help" => "global.help",
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
        "newSession" => "leader.newSession",
        // The window runs these itself: the shown project's worktree menu, the next folder's
        // newest session, the focused pane's size and resize mode.
        "worktree" => "leader.worktree",
        "nextProject" => "leader.nextProject",
        "grow" => "leader.grow",
        "shrink" => "leader.shrink",
        "resize" => "leader.resize",
        "jump1" => "tabs.jump1",
        "jump2" => "tabs.jump2",
        "jump3" => "tabs.jump3",
        "jump4" => "tabs.jump4",
        "jump5" => "tabs.jump5",
        "jump6" => "tabs.jump6",
        "jump7" => "tabs.jump7",
        "jump8" => "tabs.jump8",
        "jump9" => "leader.jump9",
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
    ("app.help", None),
    ("key.bind", None),
    ("agent.next", None),
    ("agent.prev", None),
    ("app.zoom_in", None),
    ("app.zoom_out", None),
    ("app.zoom_reset", None),
    ("terminal.paste", None),
    ("terminal.find", None),
    ("terminal.clear", None),
    ("terminal.copy", None),
    ("terminal.selectAll", None),
    ("terminal.scroll", None),
    ("terminal.prevCommand", None),
    ("terminal.nextCommand", None),
    ("terminal.takeControl", None),
    ("terminal.takeBack", None),
    ("terminal.takeBackAll", None),
    ("terminal.kill", None),
    ("terminal.show", Some("id")),
    ("terminal.peek", Some("id")),
    ("terminal.keep", Some("id")),
    ("terminal.park", None),
    ("workspace.pin", Some("id")),
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

/// Whether `combo` (the settings' notation) may be bound to a command, as the web's
/// `bindableCombo`: a key, not reserved by the macOS menu, with Command, Control, Alt or a
/// function key.
pub fn bindable(combo: &str, mac: bool) -> bool {
    parse_combo(combo, mac)
        .is_some_and(|c| !reserved(&c, mac) && (c.cmd || c.ctrl || c.alt || function_key(&c)))
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
        let plain_ok = matches!(shortcut.scope, Scope::Leader | Scope::Resize);
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

/// `chord` in the settings' notation (`cmd+shift+]`), as the web's recorder writes it.
fn chord_spec(chord: &Chord) -> String {
    let mut parts: Vec<&str> = Vec::new();
    if chord.cmd {
        parts.push("cmd");
    }
    if chord.ctrl {
        parts.push("ctrl");
    }
    if chord.alt {
        parts.push("alt");
    }
    if chord.shift {
        parts.push("shift");
    }
    parts.push(&chord.key);
    parts.join("+")
}

/// Whether `shortcut` applies where the keyboard is `context` (`shortcutAppliesTo`).
fn applies_to(shortcut: &Shortcut, context: &str) -> bool {
    match shortcut.scope {
        Scope::Leader => context == "leader",
        Scope::Resize => context == "resize",
        _ if matches!(context, "leader" | "resize") => false,
        Scope::Any => true,
        Scope::OutsideTerminal => !matches!(context, "terminal" | "navigator"),
        Scope::OutsideEditable => context == "global",
        Scope::Terminal => context == "terminal",
        Scope::Directory => context == "directory",
        Scope::Navigator => context == "navigator",
    }
}

/// Whether two commands can fire on one key press (`overlaps`): some context has both.
fn overlaps(a: &Shortcut, b: &Shortcut) -> bool {
    [
        "global",
        "terminal",
        "editor",
        "navigator",
        "directory",
        "leader",
        "resize",
    ]
    .iter()
    .any(|ctx| applies_to(a, ctx) && applies_to(b, ctx))
}

/// The editing keys a terminal gets by default on macOS, in `keys.json`'s notation, and what each
/// types: readline's line start, line end and delete to line start (herdr's `cmd-left`,
/// `cmd-right` and `cmd-backspace`). The Option chords are not here: the web sends the program
/// xterm's own sequence for them, and so does the encoder.
const LINE_EDITING: [(&str, &str); 3] = [
    ("cmd-left", "\u{1}"),
    ("cmd-right", "\u{5}"),
    ("cmd-backspace", "\u{15}"),
];

/// What a press means.
#[derive(Clone, Debug, PartialEq)]
pub enum Hit {
    /// Run this command.
    Run { name: String, args: Option<Value> },
    /// Type this text into the focused terminal (`send:<text>` in `keys.json`).
    Send(String),
    /// A default editing key: type this text unless the program asked for the real chord (the
    /// kitty keyboard protocol or modifyOtherKeys), which only the terminal can tell.
    Edit(&'static str),
    /// `keys.json` says the program gets this key.
    Terminal,
    /// A binding in `keys.json` that cannot run. The press is swallowed and this says why.
    Fault(String),
    /// The leader chord or resize mode was armed and this press ended it without one of its keys.
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
    /// Resize mode is armed: its keys resize, any other ends it.
    pub resize: bool,
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

    /// The keybind help's rows (`keybindEntries` in the web), in table order: every binding the
    /// window answers with its key (a person's choice, else the default), what it does and its
    /// group. A jump range (to tab 1 to 8) is one row while none of its keys is a person's
    /// choice. The bindings in `keys.json` follow, by section, as the window reads them first.
    pub fn help(&self) -> Vec<Value> {
        let row = |keys: String, description: &str, group: &str| serde_json::json!({ "keys": keys, "description": description, "group": group });
        let mut rows = Vec::new();
        let mut ranges = Vec::new();
        // Copy and paste are the fixed row below, as the web lists them.
        let listed =
            all_shortcuts().filter(|s| !matches!(s.id, "terminal.copy" | "terminal.paste"));
        for shortcut in listed {
            let Some(chord) = effective_spec(&shortcut, &self.chosen, self.mac) else {
                continue;
            };
            let Some(prefix) = self.prefix(shortcut.scope) else {
                continue;
            };
            let label = format!("{prefix}{}", self.format(&chord));
            let group = help_group(shortcut.id);
            let range = JUMP_RANGES
                .iter()
                .find(|(id, ..)| range_member(shortcut.id, id))
                .filter(|(id, ..)| !self.chosen.keys().any(|chosen| range_member(chosen, id)));
            match range {
                Some((id, noun, span)) => {
                    if ranges.contains(id) {
                        continue;
                    }
                    ranges.push(*id);
                    let key = self.format(&Chord {
                        key: chord.key.clone(),
                        ..Chord::default()
                    });
                    let keys = format!("{}{span}", label.strip_suffix(&key).unwrap_or(&label));
                    rows.push(row(keys, &format!("Jump to {noun} {span}"), group));
                }
                None => rows.push(row(label, shortcut.title, group)),
            }
        }
        rows.push(row(
            "Esc".into(),
            "Close any open overlay or keyboard mode",
            "global",
        ));
        rows.push(row(
            "↑ / ↓".into(),
            "Move selection in Navigator",
            "navigator",
        ));
        let copy = if self.mac {
            "⌘C / ⌘V"
        } else {
            "Ctrl+Shift+C / V"
        };
        rows.push(row(copy.into(), "Copy / paste", "terminal"));
        let sections = self.file.as_ref().and_then(Value::as_object);
        for name in ["global", "terminal"] {
            let bindings = sections
                .and_then(|s| s.get(name))
                .and_then(Value::as_object);
            for (spec, action) in bindings.into_iter().flatten() {
                let Some(chord) = parse_chord(spec) else {
                    continue;
                };
                let command = match action {
                    Value::String(text) => text.split(':').next().unwrap_or(text).to_string(),
                    Value::Object(map) => map
                        .get("command")
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_string(),
                    _ => continue,
                };
                let title = all_shortcuts()
                    .find(|s| s.id == command)
                    .map(|s| s.title.to_string())
                    .unwrap_or_else(|| match action {
                        Value::String(text) => text.clone(),
                        _ => command.clone(),
                    });
                rows.push(row(self.format(&chord), &title, name));
            }
        }
        rows
    }

    /// Settings > Keyboard's groups (`KeybindingsSection`): every command of the table with its
    /// key as the person has it (`""` for none) and whether they changed it from the default.
    /// The jump ranges are rows of their own here, one per key, as in the web's table.
    pub fn settings_groups(&self) -> Value {
        const GROUPS: [(&str, &str); 9] = [
            ("global", "Global"),
            ("tabs", "Tabs"),
            ("nests", "Workspaces and projects"),
            ("panes", "Splits and panes"),
            ("terminal", "Terminal"),
            ("navigator", "Navigator"),
            ("directory", "Folder picker"),
            ("leader", "Leader and follow-up keys"),
            ("resize", "Resize mode"),
        ];
        let groups: Vec<Value> = GROUPS
            .iter()
            .map(|(id, title)| {
                let rows: Vec<Value> = all_shortcuts()
                    .filter(|s| help_group(s.id) == *id)
                    .map(|s| {
                        let keys = effective_spec(&s, &self.chosen, self.mac)
                            .map(|c| self.format(&c))
                            .unwrap_or_default();
                        serde_json::json!({
                            "id": s.id, "description": s.title, "keys": keys,
                            "edited": self.chosen.contains_key(s.id),
                        })
                    })
                    .collect();
                serde_json::json!({ "id": id, "title": title, "rows": rows })
            })
            .collect();
        Value::Array(groups)
    }

    /// What recording gives command `id` when the person pressed `key` (`recordCombo`, then
    /// `commit` in the web's `KeybindingsSection`): `None` for a modifier alone (keep waiting);
    /// `{kind: "error", text}` for a key that cannot be bound; else `{kind: "saved", note?,
    /// keybindings}`, the choices to save, with the key taken off the commands that had it.
    pub fn record(&self, id: &str, event: &Value) -> Option<Value> {
        let error = |text: &str| Some(serde_json::json!({ "kind": "error", "text": text }));
        let target = all_shortcuts().find(|s| s.id == id)?;
        // The DOM event the page was given: its `key` and four modifier flags.
        let name = event["key"].as_str()?;
        let flag = |field: &str| event[field].as_bool().unwrap_or(false);
        if matches!(name, "Meta" | "Control" | "Shift" | "Alt") {
            return None;
        }
        let named = match name {
            " " => "space",
            "ArrowUp" => "up",
            "ArrowDown" => "down",
            "ArrowLeft" => "left",
            "ArrowRight" => "right",
            "PageUp" => "pageup",
            "PageDown" => "pagedown",
            other => other,
        };
        let (base, shift) = base_key(named, flag("shiftKey"));
        let m = (flag("metaKey"), flag("ctrlKey"), flag("altKey"));
        if !valid_key(&base) || base == "escape" {
            return error("That key can't be used.");
        }
        let chord = Chord {
            cmd: m.0,
            ctrl: m.1,
            alt: m.2,
            shift,
            key: base,
        };
        let plain_ok = matches!(
            target.scope,
            Scope::Leader | Scope::Resize | Scope::OutsideEditable
        );
        if !plain_ok && !chord.cmd && !chord.ctrl && !chord.alt && !function_key(&chord) {
            return error(if self.mac {
                "Include ⌘, ⌃ or ⌥."
            } else {
                "Include Ctrl or Alt."
            });
        }
        if reserved(&chord, self.mac) {
            return error("macOS reserves that key for its menu.");
        }
        let spec = chord_spec(&chord);
        let mut next = self.chosen.clone();
        // The commands that fire with it on the same key lose it (`shortcutsBoundTo`).
        let taken: Vec<Shortcut> = all_shortcuts()
            .filter(|other| other.id != id && overlaps(&target, other))
            .filter(|other| effective_spec(other, &self.chosen, self.mac).as_ref() == Some(&chord))
            .collect();
        for other in &taken {
            next.insert(other.id.to_string(), String::new());
        }
        let builtin = match target.keys {
            [both] => Some(*both),
            [for_mac, other] => Some(if self.mac { *for_mac } else { *other }),
            _ => None,
        };
        let is_builtin = builtin
            .filter(|b| !b.is_empty())
            .and_then(|b| parse_combo(b, self.mac))
            .as_ref()
            == Some(&chord);
        if is_builtin {
            next.remove(id);
        } else {
            next.insert(id.to_string(), spec);
        }
        let note = (!taken.is_empty()).then(|| {
            let names: Vec<&str> = taken.iter().map(|t| t.title).collect();
            format!("Moved from \"{}\".", names.join("\", \""))
        });
        Some(serde_json::json!({ "kind": "saved", "note": note, "keybindings": next }))
    }

    /// What the help writes before a mode's key: the leader chord's (`⌃Space, `), and for resize
    /// mode also the leader's follow-up that arms it (`⌃Space, R, `). `None` when the mode cannot
    /// be reached because a key on the way is unbound.
    fn prefix(&self, scope: Scope) -> Option<String> {
        Some(match scope {
            Scope::Leader => format!("{}, ", self.label("leader.arm")?),
            Scope::Resize => format!(
                "{}{}, ",
                self.prefix(Scope::Leader)?,
                self.label("leader.resize")?
            ),
            _ => String::new(),
        })
    }

    /// `cmd+shift+]` as `⇧⌘]` on a Mac, `Ctrl+Shift+]` elsewhere.
    fn format(&self, c: &Chord) -> String {
        let key = match c.key.as_str() {
            "up" => "↑".into(),
            "down" => "↓".into(),
            "left" => "←".into(),
            "right" => "→".into(),
            "enter" => "Enter".into(),
            "tab" => "Tab".into(),
            "space" => "Space".into(),
            "backspace" => "Backspace".into(),
            "delete" => "Delete".into(),
            "home" => "Home".into(),
            "end" => "End".into(),
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
        if context.resize {
            return Some(self.mode_key(keystroke, Scope::Resize, Some));
        }
        if context.leader {
            return Some(self.mode_key(keystroke, Scope::Leader, leader_target));
        }
        if let Some(hit) = self.file_hit(keystroke, context) {
            return Some(hit);
        }
        let bound = |s: &Shortcut| {
            effective_spec(s, &self.chosen, self.mac).is_some_and(|c| matches(&c, keystroke))
        };
        // The terminal's own commands are the more specific, so they win a key another command
        // shares with them (`ctrl+shift+up` on systems where `mod` is Control+Shift).
        let terminal = context
            .in_terminal
            .then(|| all_shortcuts().find(|s| s.scope == Scope::Terminal && bound(s)))
            .flatten();
        terminal
            .or_else(|| {
                all_shortcuts()
                    .filter(|s| match s.scope {
                        Scope::Any => true,
                        Scope::OutsideTerminal => !context.in_terminal,
                        Scope::OutsideEditable => !context.in_terminal && !context.typing,
                        Scope::Leader
                        | Scope::Resize
                        | Scope::Terminal
                        | Scope::Directory
                        | Scope::Navigator => false,
                    })
                    .find(bound)
            })
            .map(|s| Hit::Run {
                name: s.id.to_string(),
                args: None,
            })
            .or_else(|| {
                LINE_EDITING
                    .iter()
                    .find(|(spec, _)| {
                        self.mac
                            && context.in_terminal
                            && parse_chord(spec).is_some_and(|c| matches(&c, keystroke))
                    })
                    .map(|(_, text)| Hit::Edit(text))
            })
    }

    /// The command of screen scope `scope` (`"directory"`) a DOM key event (`{key, ctrlKey,
    /// metaKey, shiftKey, altKey}`) presses, as the web's `shortcutFor(event, scope)` finds it.
    pub fn screen_shortcut(&self, event: &Value, scope: &str) -> Option<&'static str> {
        let scope = match scope {
            "directory" => Scope::Directory,
            "navigator" => Scope::Navigator,
            _ => return None,
        };
        let flag = |name: &str| event[name].as_bool().unwrap_or(false);
        let key = match event["key"].as_str()? {
            " " => "space".to_string(),
            "ArrowUp" => "up".to_string(),
            "ArrowDown" => "down".to_string(),
            "ArrowLeft" => "left".to_string(),
            "ArrowRight" => "right".to_string(),
            other => other.to_lowercase(),
        };
        let keystroke = Keystroke {
            modifiers: gpui::Modifiers {
                control: flag("ctrlKey"),
                alt: flag("altKey"),
                shift: flag("shiftKey"),
                platform: flag("metaKey"),
                ..Default::default()
            },
            key,
            key_char: None,
        };
        all_shortcuts()
            .filter(|s| s.scope == scope)
            .find(|s| {
                effective_spec(s, &self.chosen, self.mac).is_some_and(|c| matches(&c, &keystroke))
            })
            .map(|s| s.id)
    }

    /// A press while the leader chord or resize mode waits: a key of the mode runs (`target` names
    /// its command), Escape ends the mode quietly, anything else ends it and still goes to the
    /// terminal.
    fn mode_key(
        &self,
        keystroke: &Keystroke,
        scope: Scope,
        target: fn(&'static str) -> Option<&'static str>,
    ) -> Hit {
        let found = all_shortcuts()
            .filter(|s| s.scope == scope)
            .find(|s| {
                effective_spec(s, &self.chosen, self.mac).is_some_and(|c| matches(&c, keystroke))
            })
            .and_then(|s| target(s.id));
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
        resize: false,
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
        assert_eq!(run(m.resolve(&press("cmd-n"), IN_TERMINAL)), "nests.new");
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
        // In a terminal the same key is the terminal's own clear, not the navigator.
        assert_eq!(
            run(m.resolve(&press("cmd-k"), IN_TERMINAL)),
            "terminal.clear"
        );
    }

    /// The palette is the web's Navigator: `mod+p`, which is Command-P on a Mac. The web binds no
    /// Command-Shift-P, and neither does this client until a person chooses it.
    #[test]
    fn the_palettes_key_is_the_webs_and_command_shift_p_is_the_persons_to_choose() {
        let m = keymap(&[], None);
        for context in [IN_TERMINAL, Context::default()] {
            assert_eq!(run(m.resolve(&press("cmd-p"), context)), "global.navigator");
            assert_eq!(m.resolve(&press("cmd-shift-p"), context), None);
        }
        assert_eq!(m.label("global.navigator").as_deref(), Some("⌘P"));
        // Where `mod` is Control+Shift the palette is Ctrl-Shift-P, as in the web.
        let other = keymap(&[], None).with_platform(false);
        assert_eq!(
            run(other.resolve(&press("ctrl-shift-p"), IN_TERMINAL)),
            "global.navigator"
        );

        // A person's choice moves it, in Settings > Keyboard or in keys.json.
        let chosen = keymap(&[("global.navigator", "cmd+shift+p")], None);
        assert_eq!(
            run(chosen.resolve(&press("cmd-shift-p"), IN_TERMINAL)),
            "global.navigator"
        );
        assert_eq!(chosen.resolve(&press("cmd-p"), IN_TERMINAL), None);
        let file = keymap(&[], Some(json!({"global": {"cmd-shift-p": "app.palette"}})));
        assert_eq!(
            run(file.resolve(&press("cmd-shift-p"), IN_TERMINAL)),
            "app.palette"
        );
        assert_eq!(
            run(file.resolve(&press("cmd-p"), IN_TERMINAL)),
            "global.navigator"
        );
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
    fn the_editing_keys_are_a_mac_default_that_any_binding_replaces() {
        let m = keymap(&[], None);
        for (chord, text) in [
            ("cmd-left", "\u{1}"),
            ("cmd-right", "\u{5}"),
            ("cmd-backspace", "\u{15}"),
        ] {
            assert_eq!(m.resolve(&press(chord), IN_TERMINAL), Some(Hit::Edit(text)));
            // Only a terminal has them, and only on a Mac.
            assert_eq!(m.resolve(&press(chord), Context::default()), None);
            assert_eq!(
                keymap(&[], None)
                    .with_platform(false)
                    .resolve(&press(chord), IN_TERMINAL),
                None
            );
        }
        // Another modifier is another chord.
        assert_eq!(m.resolve(&press("cmd-shift-left"), IN_TERMINAL), None);
        assert_eq!(m.resolve(&press("alt-left"), IN_TERMINAL), None);
        // keys.json replaces them, in either section, and `terminal` hands the key to the program.
        let file = json!({
            "terminal": {"cmd-left": "send:\u{1b}b", "cmd-right": "terminal"},
            "global": {"cmd-backspace": "send:x"},
        });
        let m = keymap(&[], Some(file));
        assert_eq!(
            m.resolve(&press("cmd-left"), IN_TERMINAL),
            Some(Hit::Send("\u{1b}b".into()))
        );
        assert_eq!(
            m.resolve(&press("cmd-right"), IN_TERMINAL),
            Some(Hit::Terminal)
        );
        assert_eq!(
            m.resolve(&press("cmd-backspace"), IN_TERMINAL),
            Some(Hit::Send("x".into()))
        );
        // A command a person puts on the key wins too.
        let m = keymap(&[("terminal.scrollTop", "cmd+left")], None);
        assert_eq!(
            run(m.resolve(&press("cmd-left"), IN_TERMINAL)),
            "terminal.scrollTop"
        );
    }

    fn pressed(key: &str, flags: &[&str]) -> Value {
        let mut event = json!({ "key": key });
        for flag in flags {
            event[*flag] = json!(true);
        }
        event
    }

    #[test]
    fn recording_a_key_moves_it_off_the_commands_that_had_it_and_saves_the_choices() {
        let m = keymap(&[], None);
        // Command+T is New tab's: giving it to Open Settings takes it from New tab.
        let saved = m
            .record("global.settings", &pressed("t", &["metaKey"]))
            .unwrap();
        assert_eq!(saved["kind"], "saved");
        assert_eq!(saved["keybindings"]["global.settings"], "cmd+t");
        assert_eq!(saved["keybindings"]["tabs.new"], "");
        assert!(saved["note"].as_str().unwrap().starts_with("Moved from \""));
        // What the person saved is what the window then does for that key.
        let chosen: BTreeMap<String, String> =
            serde_json::from_value(saved["keybindings"].clone()).unwrap();
        let after = Keymap::new(chosen, None).with_platform(true);
        assert_eq!(
            run(after.resolve(&press("cmd-t"), Context::default())),
            "global.settings"
        );
        // The built-in key is not kept as a choice.
        let back = after
            .record("global.settings", &pressed(",", &["metaKey"]))
            .unwrap();
        assert!(back["keybindings"].get("global.settings").is_none());
        // A modifier alone waits; a plain key and a reserved key are refused with the web's words.
        assert_eq!(
            m.record("global.settings", &pressed("Meta", &["metaKey"])),
            None
        );
        assert_eq!(
            m.record("global.settings", &pressed("j", &[])).unwrap()["text"],
            "Include ⌘, ⌃ or ⌥."
        );
        assert_eq!(
            m.record("global.settings", &pressed("q", &["metaKey"]))
                .unwrap()["text"],
            "macOS reserves that key for its menu."
        );
        // A leader follow-up may be a plain key.
        assert_eq!(
            m.record("leader.splitRight", &pressed("v", &[])).unwrap()["kind"],
            "saved"
        );
        // A key is the one it comes from with Shift: Command+Shift+] arrives as `}`.
        let shifted = m
            .record("global.settings", &pressed("}", &["metaKey", "shiftKey"]))
            .unwrap();
        assert_eq!(shifted["keybindings"]["global.settings"], "cmd+shift+]");
    }

    #[test]
    fn settings_rows_show_the_key_each_command_has_and_which_the_person_changed() {
        let m = keymap(&[("global.settings", "cmd+j"), ("tabs.new", "")], None);
        let rows: Vec<Value> = m
            .settings_groups()
            .as_array()
            .unwrap()
            .iter()
            .flat_map(|g| g["rows"].as_array().unwrap().clone())
            .collect();
        let row = |id: &str| rows.iter().find(|r| r["id"] == id).unwrap().clone();
        assert_eq!(row("global.settings")["keys"], "⌘J");
        assert_eq!(row("global.settings")["edited"], true);
        assert_eq!(row("tabs.new")["keys"], "");
        assert_eq!(row("global.navigator")["keys"], "⌘P");
        assert_eq!(row("global.navigator")["edited"], false);
    }

    #[test]
    fn the_two_take_back_choices_are_commands_a_person_can_bind() {
        for id in ["terminal.takeBack", "terminal.takeBackAll"] {
            let shortcut = all_shortcuts().find(|s| s.id == id).expect(id);
            assert_eq!(effective_spec(&shortcut, &BTreeMap::new(), true), None);
            assert!(TYPED.iter().any(|(typed, _)| *typed == id), "{id}");
        }
        let m = keymap(&[("terminal.takeBackAll", "cmd+alt+t")], None);
        assert_eq!(
            run(m.resolve(&press("cmd-alt-t"), IN_TERMINAL)),
            "terminal.takeBackAll"
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
        assert_eq!(run(m.resolve(&press("r"), armed)), "leader.resize");
        assert_eq!(run(m.resolve(&press("w"), armed)), "leader.nextProject");
        assert_eq!(run(m.resolve(&press("shift-+"), armed)), "leader.grow");
        assert_eq!(run(m.resolve(&press("-"), armed)), "leader.shrink");
        // Resize mode: h j k l resize, anything else ends it; its keys mean nothing outside it.
        let resizing = Context {
            resize: true,
            ..IN_TERMINAL
        };
        for (key, id) in [
            ("h", "resize.left"),
            ("j", "resize.down"),
            ("k", "resize.up"),
            ("l", "resize.right"),
        ] {
            assert_eq!(run(m.resolve(&press(key), resizing)), id);
            assert_eq!(m.resolve(&press(key), IN_TERMINAL), None);
        }
        assert_eq!(m.resolve(&press("v"), resizing), Some(Hit::LeaderEnded));
        assert_eq!(
            m.resolve(&press("escape"), resizing),
            Some(Hit::LeaderEnded)
        );
        // History and Add project, as the web binds them on a Mac.
        assert_eq!(run(m.resolve(&press("ctrl--"), IN_TERMINAL)), "nav.back");
        assert_eq!(
            run(m.resolve(&press("ctrl-shift-_"), IN_TERMINAL)),
            "nav.forward"
        );
        assert_eq!(
            run(m.resolve(&press("cmd-o"), IN_TERMINAL)),
            "nests.addBirdhouse"
        );
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
                    // The window has no drawer shortcut yet.
                    assert!(
                        ["global.drawer"].contains(&id),
                        "{id}: the web ships it and this window has no such shortcut"
                    );
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
    fn a_key_is_bindable_as_the_web_allows() {
        assert!(bindable("cmd+shift+y", true));
        assert!(bindable("f5", true));
        assert!(bindable("ctrl+alt+left", false));
        assert!(!bindable("y", true), "no modifier");
        assert!(!bindable("shift+y", true), "Shift alone is typing");
        assert!(!bindable("cmd+q", true), "the macOS menu's");
        assert!(bindable("cmd+q", false));
        assert!(!bindable("cmd+nope", true), "not a key");
        assert!(!bindable("", true));
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

    #[test]
    fn help_lists_every_binding_with_ranges_choices_and_the_keys_file() {
        let find = |rows: &[Value], description: &str| {
            rows.iter()
                .filter(|r| r["description"] == description)
                .map(|r| {
                    format!(
                        "{} {}",
                        r["group"].as_str().unwrap(),
                        r["keys"].as_str().unwrap()
                    )
                })
                .collect::<Vec<_>>()
        };
        let rows = keymap(&[], None).help();
        assert_eq!(
            find(&rows, "Open this keybind help"),
            ["global ⌘/", "leader ⌃Space, ⇧/"]
        );
        assert_eq!(
            find(&rows, "Open keybind help (outside inputs)"),
            ["global ⇧/"]
        );
        assert_eq!(find(&rows, "Jump to tab 1…8"), ["tabs ⌘1…8"]);
        assert_eq!(find(&rows, "Jump to tab 1…9"), ["leader ⌃Space, 1…9"]);
        // Resize mode's keys follow the leader's follow-up that arms it.
        assert_eq!(
            find(&rows, "Resize pane up (grow)"),
            ["resize ⌃Space, R, K"]
        );
        assert_eq!(find(&rows, "Back to where you were"), ["tabs ⌃-"]);
        assert_eq!(find(&rows, "Add project"), ["nests ⌘O"]);
        assert!(
            keymap(&[("leader.resize", "")], None)
                .help()
                .iter()
                .all(|r| r["group"] != "resize"),
            "no way into resize mode, no resize rows"
        );
        assert!(
            find(&rows, "Jump to tab 3").is_empty(),
            "in the range's row"
        );
        assert_eq!(find(&rows, "Copy / paste"), ["terminal ⌘C / ⌘V"]);
        // A person's key for one jump lists the range's keys one by one; an unbound one goes.
        let file = serde_json::json!({"global": {"ctrl-shift-t": "tabs.next", "cmd-j": "send:x"}});
        let rows = keymap(
            &[("tabs.jump3", "cmd+shift+3"), ("global.settings", "")],
            Some(file),
        )
        .help();
        assert_eq!(find(&rows, "Jump to tab 3"), ["tabs ⇧⌘3"]);
        assert_eq!(find(&rows, "Jump to tab 1"), ["tabs ⌘1"]);
        assert!(find(&rows, "Open Settings")
            .iter()
            .all(|r| r.starts_with("leader")));
        assert_eq!(
            find(&rows, "Next tab"),
            ["tabs ⇧⌘]", "leader ⌃Space, N", "global ⌃⇧T"]
        );
        assert_eq!(find(&rows, "send:x"), ["global ⌘J"]);
    }

    #[test]
    fn help_opens_on_its_keys_but_a_plain_question_mark_stays_typing() {
        let map = keymap(&[], None);
        let at = |spec: &str, context: Context| run(map.resolve(&press(spec), context));
        assert_eq!(at("cmd-/", Context::default()), "global.help");
        assert_eq!(at("shift-/", Context::default()), "global.helpPlain");
        let typing = Context {
            typing: true,
            ..Context::default()
        };
        assert_ne!(at("shift-/", typing), "global.helpPlain");
        let terminal = Context {
            in_terminal: true,
            ..Context::default()
        };
        assert_ne!(at("shift-/", terminal), "global.helpPlain");
        let leader = Context {
            leader: true,
            ..Context::default()
        };
        assert_eq!(at("shift-/", leader), "global.help");
    }
}

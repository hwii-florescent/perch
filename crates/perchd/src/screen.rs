//! A terminal's current screen and modes, and the bytes that recreate them in
//! a fresh emulator. A byte tail of the output can't: a TUI that paints once
//! and then redraws only what changed (pi's status line ticks every second)
//! pushes its full paint out of any tail within minutes, and the modes it set
//! at startup (alternate screen, mouse reporting) go with it. A view rebuilt
//! from the tail then shows a near-empty screen and never reports the wheel.
//!
//! The daemon keeps one per session, fed from spawn, so an attach can end in
//! an exact repaint however long ago the app quit; the runtime keeps one per
//! terminal for the views it opens.

pub struct Screen {
    parser: vt100::Parser,
    modes: Modes,
}

impl Screen {
    pub fn new(cols: u16, rows: u16) -> Self {
        Self {
            // vt100 underflows on a 1-row grid.
            parser: vt100::Parser::new(rows.max(2), cols.max(2), 0),
            modes: Modes::default(),
        }
    }

    pub fn process(&mut self, bytes: &[u8]) {
        self.parser.process(bytes);
        self.modes.track(&String::from_utf8_lossy(bytes));
    }

    pub fn set_size(&mut self, cols: u16, rows: u16) {
        self.parser.set_size(rows.max(2), cols.max(2));
    }

    pub fn screen(&self) -> &vt100::Screen {
        self.parser.screen()
    }

    /// Bytes that turn any emulator of this size into this screen: its
    /// contents, cursor and modes. Written after a replay, it repairs
    /// whatever the replay's cut-off start left wrong.
    pub fn restore(&self) -> String {
        // Only entering the alternate screen needs saying: had the program
        // left it, a replay would hold its `?1049l`. vt100's rows assume
        // autowrap, so the program's own setting comes after them.
        let screen = self.parser.screen();
        let mut out = String::from("\x1b[?7h");
        if screen.alternate_screen() {
            out += "\x1b[?1049h";
        }
        out += &String::from_utf8_lossy(&screen.state_formatted());
        out += &self.modes.formatted();
        out
    }
}

/// Modes vt100 0.15 doesn't keep. The kitty keyboard flags and their stack
/// are per screen (main, alternate), as in xterm.
#[derive(Default)]
struct Modes {
    no_autowrap: bool,
    focus_events: bool,
    alternate: bool,
    kitty: [u32; 2],
    kitty_stack: [Vec<u32>; 2],
}

impl Modes {
    // ponytail: misses a sequence split across two reads; the CLIs send
    // these in one write at startup. A vte-based tracker would close that.
    fn track(&mut self, data: &str) {
        for (at, _) in data.match_indices("\x1b[") {
            let rest = &data[at + 2..];
            let Some(end) = rest.find(|c: char| !('\x20'..='\x3f').contains(&c)) else {
                continue;
            };
            let (params, kind) = (&rest[..end], rest[end..].chars().next());
            let screen = usize::from(self.alternate);
            let number = |p: &str| p.split(';').next().and_then(|n| n.parse::<u32>().ok());
            match (params, kind) {
                ("?7", Some(c @ ('h' | 'l'))) => self.no_autowrap = c == 'l',
                ("?1004", Some(c @ ('h' | 'l'))) => self.focus_events = c == 'h',
                ("?1049" | "?1047" | "?47", Some(c @ ('h' | 'l'))) => self.alternate = c == 'h',
                (p, Some('u')) if p.starts_with('>') => {
                    let stack = &mut self.kitty_stack[screen];
                    if stack.len() >= 16 {
                        stack.remove(0);
                    }
                    stack.push(self.kitty[screen]);
                    self.kitty[screen] = number(&p[1..]).unwrap_or(0);
                }
                (p, Some('u')) if p.starts_with('<') => {
                    let stack = &mut self.kitty_stack[screen];
                    for _ in 0..number(&p[1..]).unwrap_or(1).max(1) {
                        let Some(flags) = stack.pop() else { break };
                        self.kitty[screen] = flags;
                    }
                    if stack.is_empty() {
                        self.kitty[screen] = 0;
                    }
                }
                (p, Some('u')) if p.starts_with('=') => {
                    let flags = number(&p[1..]).unwrap_or(0);
                    let current = &mut self.kitty[screen];
                    match p
                        .split(';')
                        .nth(1)
                        .and_then(|m| m.parse().ok())
                        .unwrap_or(1)
                    {
                        2 => *current |= flags,
                        3 => *current &= !flags,
                        _ => *current = flags,
                    }
                }
                _ => {}
            }
        }
    }

    /// Restores these on the screen the repaint left active.
    fn formatted(&self) -> String {
        let mut out = String::new();
        if self.no_autowrap {
            out += "\x1b[?7l";
        }
        if self.focus_events {
            out += "\x1b[?1004h";
        }
        let flags = self.kitty[usize::from(self.alternate)];
        if flags != 0 {
            out += &format!("\x1b[={flags}u");
        }
        out
    }
}

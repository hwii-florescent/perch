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
    mode_parser: vte::Parser,
    modes: Modes,
}

impl Screen {
    pub fn new(cols: u16, rows: u16) -> Self {
        Self {
            // vt100 underflows on a 1-row grid.
            parser: vt100::Parser::new(rows.max(2), cols.max(2), 0),
            mode_parser: vte::Parser::new(),
            modes: Modes::default(),
        }
    }

    pub fn process(&mut self, bytes: &[u8]) {
        self.parser.process(bytes);
        for &byte in bytes {
            self.mode_parser.advance(&mut self.modes, byte);
        }
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
        let screen = self.parser.screen();
        // The tail may leave *any* mode enabled. vt100 formats mouse modes
        // relative to defaults, not the replay's state: clear them first.
        // Do not use RIS here: it would erase the replayed scrollback.
        let mut out = String::from(
            "\x1b[?7h\x1b[?9l\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1005l\x1b[?1006l\x1b[?1016l\x1b[?1004l",
        );
        // Rebuild both keyboard stacks, not just the active flags. A later
        // CLI pop must restore the same flags as before the app restarted.
        out += "\x1b[?1049l";
        out += &self.modes.keyboard_formatted(0);
        out += "\x1b[?1049h";
        out += &self.modes.keyboard_formatted(1);
        if !screen.alternate_screen() {
            out += "\x1b[?1049l";
        }
        // vt100's rows assume autowrap; the CLI's own setting follows them.
        out += &String::from_utf8_lossy(&screen.state_formatted());
        out += &self.modes.formatted();
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restore_clears_stale_input_modes_and_alternate_screen() {
        let mut view = Screen::new(80, 24);
        view.process(b"\x1b[?1049h\x1b[?1003h\x1b[?1006h\x1b[?1004h\x1b[>31u\x1b[?7l");
        let mut shell = Screen::new(80, 24);
        shell.process(b"shell prompt");
        view.process(shell.restore().as_bytes());
        assert!(!view.screen().alternate_screen());
        assert_eq!(
            view.screen().mouse_protocol_mode(),
            vt100::MouseProtocolMode::None
        );
        assert_eq!(
            view.screen().mouse_protocol_encoding(),
            vt100::MouseProtocolEncoding::Default
        );
        assert!(!view.modes.focus_events);
        assert!(!view.modes.no_autowrap);
        assert_eq!(view.modes.kitty, [0, 0]);
        assert!(view.screen().contents().starts_with("shell prompt"));
    }

    #[test]
    fn restore_keeps_keyboard_stacks_for_later_pops() {
        let mut source = Screen::new(80, 24);
        source.process(b"\x1b[>1u\x1b[>3u\x1b[?1049h\x1b[>5u\x1b[>7u");
        let mut view = Screen::new(80, 24);
        view.process(b"\x1b[>31u\x1b[?1049h\x1b[>31u");
        // A daemon repaint can be replayed and repainted again by the core.
        for _ in 0..2 {
            view.process(source.restore().as_bytes());
            assert_eq!(view.modes.kitty, source.modes.kitty);
            assert_eq!(view.modes.kitty_stack, source.modes.kitty_stack);
        }
        for bytes in [
            b"\x1b[<u".as_slice(),
            b"\x1b[?1049l",
            b"\x1b[<u",
            b"\x1b[<u",
        ] {
            source.process(bytes);
            view.process(bytes);
            assert_eq!(view.modes.kitty, source.modes.kitty);
        }
    }

    #[test]
    fn mode_tracking_is_independent_of_read_boundaries() {
        let bytes = b"\x1b[?7;1004h\x1b[>1u\x1b[?1049h\x1b[>3u\x1b[=4;2u";
        let mut whole = Screen::new(80, 24);
        whole.process(bytes);
        assert!(whole.modes.focus_events);
        assert_eq!(whole.modes.kitty, [1, 7]);
        for split in 0..=bytes.len() {
            let mut split_view = Screen::new(80, 24);
            split_view.process(&bytes[..split]);
            split_view.process(&bytes[split..]);
            assert_eq!(split_view.restore(), whole.restore(), "split at {split}");
        }
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

impl vte::Perform for Modes {
    fn csi_dispatch(
        &mut self,
        params: &vte::Params,
        intermediates: &[u8],
        ignore: bool,
        action: char,
    ) {
        if ignore {
            return;
        }
        let mut numbers = params.iter().map(|p| u32::from(p[0]));
        let first = numbers.next().unwrap_or(0);
        let screen = usize::from(self.alternate);
        match (intermediates, action) {
            (b"?", c @ ('h' | 'l')) => {
                for mode in std::iter::once(first).chain(numbers) {
                    match mode {
                        7 => self.no_autowrap = c == 'l',
                        1004 => self.focus_events = c == 'h',
                        1049 | 1047 | 47 => self.alternate = c == 'h',
                        _ => {}
                    }
                }
            }
            (b">", 'u') => {
                let stack = &mut self.kitty_stack[screen];
                if stack.len() >= 16 {
                    stack.remove(0);
                }
                stack.push(self.kitty[screen]);
                self.kitty[screen] = first;
            }
            (b"<", 'u') => {
                let stack = &mut self.kitty_stack[screen];
                for _ in 0..first.max(1) {
                    let Some(flags) = stack.pop() else { break };
                    self.kitty[screen] = flags;
                }
                if stack.is_empty() {
                    self.kitty[screen] = 0;
                }
            }
            (b"=", 'u') => {
                let current = &mut self.kitty[screen];
                match numbers.next().unwrap_or(1) {
                    2 => *current |= first,
                    3 => *current &= !first,
                    _ => *current = first,
                }
            }
            _ => {}
        }
    }

    fn esc_dispatch(&mut self, intermediates: &[u8], ignore: bool, byte: u8) {
        if !ignore && intermediates.is_empty() && byte == b'c' {
            *self = Self::default();
        }
    }
}

impl Modes {
    fn keyboard_formatted(&self, screen: usize) -> String {
        let mut out = String::from("\x1b[<16u");
        for (index, flags) in self.kitty_stack[screen]
            .iter()
            .chain(std::iter::once(&self.kitty[screen]))
            .enumerate()
        {
            out += &format!("\x1b[{}{flags}u", if index == 0 { '=' } else { '>' });
        }
        out
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
        out
    }
}

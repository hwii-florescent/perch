//! Owns the pty processes for one ws connection, mirroring
//! `reference/node-server-spec/src/terminalManager.ts`. Each `terminal.create`
//! message spawns a shell; input/resize/exit are routed by terminalId.
//!
//! `portable-pty`'s reader/writer are blocking (`std::io::Read`/`Write`), so
//! each terminal gets one dedicated OS thread pumping bytes into the async
//! world over an unbounded channel; that's the same shape as node-pty's
//! event-emitter-over-libuv-thread design.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use uuid::Uuid;

pub type TerminalDataListener = Arc<dyn Fn(String, String) + Send + Sync>;
pub type TerminalExitListener = Arc<dyn Fn(String, i32) + Send + Sync>;

struct TerminalHandle {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    /// A killer split off the spawned `Child` via `clone_killer()` *before*
    /// the `Child` itself is moved into the waiter thread's blocking
    /// `.wait()` call (see `create()`). This is exactly what `ChildKiller`
    /// exists for: sending a terminate signal from a thread other than the
    /// one blocked in `.wait()`. Used by `kill()` to force-terminate a single
    /// terminal by id (e.g. `terminal.kill`, or a CLI-attached PTY torn down
    /// on session delete / CLI-mode unmount) without tearing down every
    /// other terminal on this connection.
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
}

/// Split a byte slice into (decodable prefix, incomplete trailing sequence).
///
/// The tail is only ever the *truncated* UTF-8 sequence at the very end — at
/// most 3 bytes. Genuinely invalid bytes in the middle are still replaced
/// lossily, because holding those back would stall the stream forever waiting
/// for a completion that is never coming.
fn split_utf8_tail(bytes: &[u8]) -> (String, &[u8]) {
    match std::str::from_utf8(bytes) {
        Ok(s) => (s.to_string(), &[]),
        Err(err) => {
            let good = err.valid_up_to();
            // `error_len() == None` means "unexpected end of input": the bytes
            // from `good` onward are a valid prefix of a longer sequence, so
            // they are exactly what to carry. `Some(_)` means a real encoding
            // error, which no amount of waiting fixes — decode lossily.
            match err.error_len() {
                None => {
                    let text = String::from_utf8_lossy(&bytes[..good]).into_owned();
                    (text, &bytes[good..])
                }
                Some(_) => (String::from_utf8_lossy(bytes).into_owned(), &[]),
            }
        }
    }
}

/// Describe the pty to the child the way a real terminal emulator would.
///
/// These are set *after* the parent environment is copied in, deliberately
/// overriding whatever was inherited. The inherited values are wrong in both
/// directions:
///
/// - Launched from Finder/Dock (the desktop app's normal case) the process
///   env has **no `TERM` at all**. A CLI that finds no `TERM` treats the
///   stream as a dumb tty: no cursor addressing, no alt-screen, no colour —
///   so the agent TUIs degrade into an unusable append-only smear even though
///   the pty and xterm.js on the other end handle the full escape repertoire.
/// - Launched from a terminal, `TERM` describes *that* terminal (and
///   `TERM_PROGRAM` says iTerm.app/Apple_Terminal), not the xterm.js instance
///   actually rendering the bytes. Inheriting `TERM=xterm-ghostty` or similar
///   makes the child emit sequences the frontend doesn't implement.
///
/// `xterm-256color` is what xterm.js implements. `COLORTERM=truecolor`
/// enables 24-bit SGR, which xterm.js also supports and which the agent CLIs
/// probe for before choosing their palette. The UTF-8 locale hint matters for
/// the same reason the Unicode 11 addon does — box-drawing and emoji width.
fn apply_terminal_env(cmd: &mut CommandBuilder) {
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("TERM_PROGRAM", "perch");
    // Only a hint: if the parent already has a sane UTF-8 locale, keep it
    // (it may carry a region the user cares about for date/number output).
    let has_utf8_locale = std::env::var("LC_ALL")
        .or_else(|_| std::env::var("LANG"))
        .map(|v| {
            let v = v.to_ascii_lowercase();
            v.contains("utf-8") || v.contains("utf8")
        })
        .unwrap_or(false);
    if !has_utf8_locale {
        cmd.env("LANG", "en_US.UTF-8");
    }
}

pub struct TerminalManager {
    /// `Arc` because each terminal's waiter thread holds a handle: when the
    /// child exits it removes its own entry (see `create`), so a dead terminal
    /// never lingers in the map.
    terminals: Arc<Mutex<HashMap<String, TerminalHandle>>>,
    on_data: TerminalDataListener,
    on_exit: TerminalExitListener,
}

impl TerminalManager {
    pub fn new(on_data: TerminalDataListener, on_exit: TerminalExitListener) -> Self {
        Self {
            terminals: Arc::new(Mutex::new(HashMap::new())),
            on_data,
            on_exit,
        }
    }

    pub fn create(
        &self,
        cols: u16,
        rows: u16,
        cwd: Option<String>,
        command: Option<Vec<String>>,
    ) -> anyhow::Result<String> {
        let id = Uuid::new_v4().to_string();

        let pty_system = native_pty_system();
        let pair = pty_system.openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let mut cmd = match command {
            Some(argv) => {
                let mut iter = argv.into_iter();
                let program = iter.next().unwrap_or_else(|| "/bin/zsh".to_string());
                let mut cmd = CommandBuilder::new(program);
                cmd.args(iter);
                cmd
            }
            None => {
                let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
                CommandBuilder::new(&shell)
            }
        };
        if let Some(cwd) = cwd.or_else(|| {
            std::env::current_dir()
                .ok()
                .map(|p| p.display().to_string())
        }) {
            cmd.cwd(cwd);
        }
        for (key, value) in std::env::vars() {
            cmd.env(key, value);
        }
        apply_terminal_env(&mut cmd);

        let mut child = pair.slave.spawn_command(cmd)?;
        drop(pair.slave); // only the master + child are needed after spawn
                          // Split off a killer before `child` is moved into the waiter thread
                          // below — `Child::wait()` blocks that thread, so any later `kill()`
                          // call (from a ws message handler on a different thread) must go
                          // through this independently-clonable handle instead of `child`
                          // itself.
        let killer = child.clone_killer();

        let reader = pair.master.try_clone_reader()?;
        let writer = pair.master.take_writer()?;

        self.terminals.lock().unwrap().insert(
            id.clone(),
            TerminalHandle {
                writer,
                master: pair.master,
                killer: Mutex::new(killer),
            },
        );

        // Reader thread: pump pty output -> terminal.data.
        //
        // The pty is a byte stream with no regard for character boundaries: a
        // read can (and under a repainting TUI constantly does) end in the
        // middle of a multi-byte UTF-8 sequence. Decoding each read
        // independently with `from_utf8_lossy` therefore destroyed one glyph
        // every time that happened — the truncated head became U+FFFD, and the
        // orphaned continuation bytes at the start of the *next* read became
        // one or two more. Since a replacement char is one cell wide where the
        // box-drawing glyph it ate was one cell and an emoji two, every
        // occurrence shifted the remainder of the line and the TUI's columns
        // stopped lining up. That is the "lines randomly rendered" corruption:
        // random because it depends on where the 8 KiB boundary happens to
        // fall in a stream nobody controls.
        //
        // `carry` holds the incomplete tail so it can be decoded together with
        // the bytes that complete it on the next read.
        let on_data = self.on_data.clone();
        let reader_id = id.clone();
        std::thread::spawn(move || {
            let mut reader = reader;
            let mut buf = [0u8; 8192];
            let mut carry: Vec<u8> = Vec::new();
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let bytes: &[u8] = if carry.is_empty() {
                            &buf[..n]
                        } else {
                            carry.extend_from_slice(&buf[..n]);
                            &carry[..]
                        };
                        let (text, tail) = split_utf8_tail(bytes);
                        let tail = tail.to_vec();
                        if !text.is_empty() {
                            on_data(reader_id.clone(), text);
                        }
                        carry = tail;
                    }
                    Err(_) => break,
                }
            }
            // Flush whatever is left. A trailing partial sequence here means
            // the process died mid-character, so lossy is the right call —
            // there is nothing left to complete it with.
            if !carry.is_empty() {
                on_data(reader_id, String::from_utf8_lossy(&carry).into_owned());
            }
        });

        // Waiter thread: pty exit -> terminal.exit.
        let on_exit = self.on_exit.clone();
        let exit_id = id.clone();
        let terminals = self.terminals.clone();
        std::thread::spawn(move || {
            let code = match child.wait() {
                Ok(status) => status.exit_code() as i32,
                Err(_) => -1,
            };
            // Drop the handle first: the child is gone, so keeping its writer
            // + master fds around only leaks them and makes `input()` write
            // into a pty nobody reads (a dead CLI-mode pane silently
            // swallowing keystrokes). Removing here also means `kill()` and
            // `dispose_all()` never touch an already-exited terminal.
            terminals.lock().unwrap().remove(&exit_id);
            on_exit(exit_id, code);
        });

        Ok(id)
    }

    pub fn input(&self, terminal_id: &str, data: &str) {
        if let Some(handle) = self.terminals.lock().unwrap().get_mut(terminal_id) {
            let _ = handle.writer.write_all(data.as_bytes());
        }
    }

    pub fn resize(&self, terminal_id: &str, cols: u16, rows: u16) {
        if let Some(handle) = self.terminals.lock().unwrap().get(terminal_id) {
            let _ = handle.master.resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            });
        }
    }

    pub fn dispose_all(&self) {
        // Dropping each handle closes its writer + master fds, which causes
        // the shell to see EOF/HUP and exit; the waiter thread then fires
        // on_exit. We don't force-kill so in-flight output can still drain.
        self.terminals.lock().unwrap().clear();
    }

    /// Force-terminate a single terminal by id and drop its writer/master fds
    /// (closing the pty, same cleanup `dispose_all` does for every terminal).
    /// Unlike `dispose_all`'s "let it exit naturally via EOF/HUP" approach,
    /// this actively signals the child — needed for CLI-attached processes
    /// (e.g. `claude --resume`) that don't reliably exit just from losing
    /// stdin. The waiter thread spawned in `create()` is still blocked on
    /// this child's `.wait()`, so killing it here still yields a normal
    /// `on_exit` callback once the process dies. No-op if `terminal_id` is
    /// unknown (already exited/removed).
    pub fn kill(&self, terminal_id: &str) {
        if let Some(handle) = self.terminals.lock().unwrap().remove(terminal_id) {
            let _ = handle.killer.lock().unwrap().kill();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::split_utf8_tail;

    /// The regression this exists for: a pty read that ends mid-glyph must
    /// carry the partial bytes forward, not turn them into U+FFFD. Box-drawing
    /// characters are 3 bytes and saturate the agent CLIs' output, so this
    /// fired constantly.
    #[test]
    fn a_split_multibyte_glyph_survives_the_chunk_boundary() {
        let full = "│─┐ok".as_bytes();
        // Cut inside the second glyph (─ = E2 94 80).
        let cut = 4;
        let (text_a, tail) = split_utf8_tail(&full[..cut]);
        assert_eq!(text_a, "│");
        assert_eq!(tail, &full[3..cut]);

        let mut rest = tail.to_vec();
        rest.extend_from_slice(&full[cut..]);
        let (text_b, tail_b) = split_utf8_tail(&rest);
        assert_eq!(text_b, "─┐ok");
        assert!(tail_b.is_empty());
        assert_eq!(format!("{text_a}{text_b}"), "│─┐ok");
    }

    /// Emoji are 4 bytes and two cells wide, so losing one shifts the line by
    /// two columns. Every cut position must round-trip.
    #[test]
    fn every_cut_position_of_a_4_byte_glyph_round_trips() {
        let full = "a🚀b".as_bytes();
        for cut in 1..full.len() {
            let (head, tail) = split_utf8_tail(&full[..cut]);
            let mut rest = tail.to_vec();
            rest.extend_from_slice(&full[cut..]);
            let (rest_text, rest_tail) = split_utf8_tail(&rest);
            assert!(rest_tail.is_empty(), "cut {cut} left a tail");
            assert_eq!(format!("{head}{rest_text}"), "a🚀b", "cut {cut}");
        }
    }

    /// Pure-ASCII output (the common case, and all escape sequences) must pass
    /// straight through with no carry.
    #[test]
    fn ascii_never_carries() {
        let (text, tail) = split_utf8_tail(b"\x1b[2J\x1b[Hhello");
        assert_eq!(text, "\x1b[2J\x1b[Hhello");
        assert!(tail.is_empty());
    }

    /// A genuinely invalid byte must not stall the stream waiting for a
    /// completion that will never arrive.
    #[test]
    fn invalid_bytes_are_decoded_lossily_rather_than_held() {
        let (text, tail) = split_utf8_tail(&[0x41, 0xff, 0x42]);
        assert!(tail.is_empty());
        assert!(text.starts_with('A') && text.ends_with('B'));
    }
}

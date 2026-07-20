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

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use uuid::Uuid;

pub type TerminalDataListener = Arc<dyn Fn(String, String) + Send + Sync>;
pub type TerminalExitListener = Arc<dyn Fn(String, i32) + Send + Sync>;

struct TerminalHandle {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
}

pub struct TerminalManager {
    terminals: Mutex<HashMap<String, TerminalHandle>>,
    on_data: TerminalDataListener,
    on_exit: TerminalExitListener,
}

impl TerminalManager {
    pub fn new(on_data: TerminalDataListener, on_exit: TerminalExitListener) -> Self {
        Self {
            terminals: Mutex::new(HashMap::new()),
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
        if let Some(cwd) = cwd.or_else(|| std::env::current_dir().ok().map(|p| p.display().to_string())) {
            cmd.cwd(cwd);
        }
        for (key, value) in std::env::vars() {
            cmd.env(key, value);
        }

        let mut child = pair.slave.spawn_command(cmd)?;
        drop(pair.slave); // only the master + child are needed after spawn

        let reader = pair.master.try_clone_reader()?;
        let writer = pair.master.take_writer()?;

        self.terminals.lock().unwrap().insert(
            id.clone(),
            TerminalHandle {
                writer,
                master: pair.master,
            },
        );

        // Reader thread: pump pty output -> terminal.data.
        let on_data = self.on_data.clone();
        let reader_id = id.clone();
        std::thread::spawn(move || {
            let mut reader = reader;
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => on_data(reader_id.clone(), String::from_utf8_lossy(&buf[..n]).into_owned()),
                    Err(_) => break,
                }
            }
        });

        // Waiter thread: pty exit -> terminal.exit.
        let on_exit = self.on_exit.clone();
        let exit_id = id.clone();
        std::thread::spawn(move || {
            let code = match child.wait() {
                Ok(status) => status.exit_code() as i32,
                Err(_) => -1,
            };
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
}

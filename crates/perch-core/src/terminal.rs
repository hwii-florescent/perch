//! Owns the pty processes for one ws connection, mirroring
//! `reference/node-server-spec/src/terminalManager.ts`. Each `terminal.create`
//! message spawns a shell; input/resize/exit are routed by terminalId.
//!
//! `portable-pty`'s reader/writer are blocking (`std::io::Read`/`Write`), so
//! each terminal gets one dedicated OS thread pumping bytes into the async
//! world over an unbounded channel; that's the same shape as node-pty's
//! event-emitter-over-libuv-thread design.

use std::collections::{HashMap, VecDeque};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

use crate::agent_fleet::{ClientIdentity, ControlLease};
use anyhow::Context;
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use uuid::Uuid;

pub type TerminalDataListener = Arc<dyn Fn(String, String) + Send + Sync>;
pub type TerminalExitListener = Arc<dyn Fn(String, i32) + Send + Sync>;

pub const MAX_TERMINAL_REPLAY_BYTES: usize = 128 * 1024;

/// Bounded UTF-8 replay shared by shell and provider runtimes.
#[derive(Default)]
pub(crate) struct TerminalReplay {
    chunks: VecDeque<String>,
    bytes: usize,
}

impl TerminalReplay {
    pub(crate) fn push(&mut self, data: &str) {
        if data.is_empty() {
            return;
        }
        let mut start = data.len().saturating_sub(MAX_TERMINAL_REPLAY_BYTES);
        while !data.is_char_boundary(start) {
            start += 1;
        }
        let tail = &data[start..];
        self.bytes += tail.len();
        self.chunks.push_back(tail.to_string());
        while self.bytes > MAX_TERMINAL_REPLAY_BYTES {
            if let Some(chunk) = self.chunks.pop_front() {
                self.bytes -= chunk.len();
            }
        }
    }

    pub(crate) fn text(&self) -> String {
        self.chunks.iter().map(String::as_str).collect()
    }
}

/// The local terminal-side copy of the lease that currently controls input
/// or resize. Keeping it with the writer makes authorization and the write
/// one critical section, so a stale lease cannot pass a check and then write
/// after another client takes control.
struct AgentWriter {
    writer: Box<dyn Write + Send>,
    input_owner: Option<ControlLease>,
    resize_owner: Option<ControlLease>,
}

impl AgentWriter {
    fn new(writer: Box<dyn Write + Send>) -> Self {
        Self {
            writer,
            input_owner: None,
            resize_owner: None,
        }
    }

    fn clear_for_client(&mut self, client_id: &str) {
        if self
            .input_owner
            .as_ref()
            .is_some_and(|lease| lease.client.id == client_id)
        {
            self.input_owner = None;
        }
        if self
            .resize_owner
            .as_ref()
            .is_some_and(|lease| lease.client.id == client_id)
        {
            self.resize_owner = None;
        }
    }

    fn input(&mut self, data: &[u8]) -> anyhow::Result<()> {
        self.writer.write_all(data).context("write terminal input")
    }

    fn input_owned(
        &mut self,
        client: &ClientIdentity,
        generation: u64,
        data: &[u8],
    ) -> std::result::Result<(), TerminalAuthorityError> {
        let Some(owner) = self.input_owner.as_ref() else {
            return Err(TerminalAuthorityError::NotOwned);
        };
        if owner.client.id != client.id {
            return Err(TerminalAuthorityError::NotOwned);
        }
        if owner.generation != generation {
            return Err(TerminalAuthorityError::StaleLease);
        }
        self.writer
            .write_all(data)
            .map_err(|_| TerminalAuthorityError::WriteFailed)
    }

    fn owns_resize(&self, client: &ClientIdentity, generation: u64) -> bool {
        self.resize_owner
            .as_ref()
            .is_some_and(|owner| owner.client.id == client.id && owner.generation == generation)
    }
}

/// Failure returned when a terminal write or resize is attempted without the
/// current generation-bound control lease.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TerminalAuthorityError {
    NoTerminal,
    NotOwned,
    StaleLease,
    WriteFailed,
    ResizeFailed,
}

impl std::fmt::Display for TerminalAuthorityError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NoTerminal => write!(f, "agent terminal is not attached"),
            Self::NotOwned => write!(f, "client does not own terminal control"),
            Self::StaleLease => write!(f, "terminal control lease is stale"),
            Self::WriteFailed => write!(f, "terminal input write failed"),
            Self::ResizeFailed => write!(f, "terminal resize failed"),
        }
    }
}

impl std::error::Error for TerminalAuthorityError {}

/// Identity of one actual PTY/tmux runtime. The terminal/session key alone
/// is insufficient for safe hibernation because a later process can reuse it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TerminalRuntimeIdentity {
    pub session_id: String,
    pub terminal_id: String,
    pub process_id: Option<u32>,
    pub tmux_session: Option<String>,
}

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

/// Pump `reader`'s pty output through `split_utf8_tail`, carrying an
/// incomplete trailing multi-byte sequence across 8 KiB reads so it is
/// decoded together with the bytes that complete it on the next read (see
/// `split_utf8_tail` and the reader-thread comment on `TerminalManager::create`
/// for why this matters). `on_chunk` is called once per non-empty decoded
/// chunk while the pty is alive, and once more with a lossy-decoded flush of
/// anything left over when it closes — a trailing partial sequence there
/// means the process died mid-character, so lossy is the right call.
fn read_pty_into_chunks(mut reader: impl Read, mut on_chunk: impl FnMut(String)) {
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
                    on_chunk(text);
                }
                carry = tail;
            }
            Err(_) => break,
        }
    }
    if !carry.is_empty() {
        on_chunk(String::from_utf8_lossy(&carry).into_owned());
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

/// The pieces of a freshly-spawned pty that every caller needs, factored out
/// of `TerminalManager::create` so [`AgentTerminalRegistry`] (which has a
/// different fan-out story — many viewers, not one fixed callback pair) can
/// spawn a process the exact same way instead of drifting out of sync with
/// it (env, cwd fallback, `apply_terminal_env`, the killer-split-before-move
/// dance).
struct SpawnedPty {
    id: String,
    process_id: Option<u32>,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    reader: Box<dyn Read + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

/// Argv for a plain (no explicit `command`) terminal pane's shell.
///
/// `login_shell` adds `-l`, which is a bigger behavioural change than it
/// looks: it runs the user's *login* rc files (`.zprofile`/`.profile`) rather
/// than only the interactive ones, so the prompt, PATH and anything else those
/// files set can visibly differ from a non-login pane. That is exactly why the
/// setting is opt-in and off by default — the pre-existing behaviour is the
/// bare shell.
///
/// Split out as a pure function so the flag's effect is unit-testable without
/// opening a pty. Note this applies only to plain panes: an agent-attach
/// (CLI-mode) pane always arrives with an explicit `command` and is untouched.
fn shell_argv(shell: &str, login_shell: bool) -> Vec<String> {
    let mut argv = vec![shell.to_string()];
    if login_shell {
        argv.push("-l".to_string());
    }
    argv
}

fn spawn_pty(
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    command: Option<Vec<String>>,
    login_shell: bool,
) -> anyhow::Result<SpawnedPty> {
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
            let mut argv = shell_argv(&shell, login_shell).into_iter();
            let program = argv.next().unwrap_or_else(|| "/bin/zsh".to_string());
            let mut cmd = CommandBuilder::new(program);
            cmd.args(argv);
            cmd
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

    let child = pair.slave.spawn_command(cmd)?;
    drop(pair.slave); // only the master + child are needed after spawn
                      // Split off a killer before `child` is moved into the waiter thread
                      // below — `Child::wait()` blocks that thread, so any later `kill()`
                      // call (from a ws message handler on a different thread) must go
                      // through this independently-clonable handle instead of `child`
                      // itself.
    let killer = child.clone_killer();

    let reader = pair.master.try_clone_reader()?;
    let writer = pair.master.take_writer()?;

    Ok(SpawnedPty {
        id,
        process_id: child.process_id(),
        master: pair.master,
        writer,
        reader,
        killer,
        child,
    })
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
        login_shell: bool,
    ) -> anyhow::Result<String> {
        let SpawnedPty {
            id,
            process_id: _,
            master,
            writer,
            reader,
            killer,
            mut child,
        } = spawn_pty(cols, rows, cwd, command, login_shell)?;

        self.terminals.lock().unwrap().insert(
            id.clone(),
            TerminalHandle {
                writer,
                master,
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
            read_pty_into_chunks(reader, |text| on_data(reader_id.clone(), text));
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

/// Called whenever PTY output arrives on an agent-attached terminal, keyed by
/// session id (not terminal id — every viewer of a shared terminal cares
/// about the same session). Used to derive Task 2's working/idle state.
pub type SessionActivityListener = Arc<dyn Fn(&str) + Send + Sync>;

/// One viewer's callbacks, registered against a shared [`AgentTerminalEntry`].
/// Identical shape to `TerminalManager`'s single fixed `on_data`/`on_exit`
/// pair — the difference is `AgentTerminalRegistry` keeps a *map* of these,
/// one per attached connection, instead of exactly one.
struct AgentViewer {
    on_data: TerminalDataListener,
    on_exit: TerminalExitListener,
}

struct AgentTerminalEntry {
    exited: std::sync::atomic::AtomicBool,
    terminal_id: String,
    process_id: Option<u32>,
    writer: Mutex<AgentWriter>,
    // `Mutex`-wrapped (unlike `TerminalHandle::master`) because this entry is
    // itself shared across threads via `Arc` (reader/waiter threads, plus
    // whichever connection calls `resize`/`kill`) — `MasterPty` is `Send` but
    // not `Sync`, so `Arc<AgentTerminalEntry>` needs every field to be `Sync`
    // on its own, not just reachable through one shared outer lock.
    master: Mutex<Box<dyn MasterPty + Send>>,
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
    /// Keyed by viewer id (the WS connection's `conn_id`). Input and resize
    /// authority are tracked separately in `writer`; the legacy `input()` and
    /// `resize()` methods remain available for protocol compatibility while
    /// the runtime adapter uses the lease-checked methods.
    viewers: Mutex<HashMap<String, AgentViewer>>,
    /// Last time PTY output was observed, for Task 2's quiet-period → idle
    /// transition. Updated by the reader thread on every chunk.
    last_activity: Mutex<std::time::Instant>,
    /// `Some(name)` when this entry's pty child is a `tmux attach-session`
    /// client rather than the CLI itself (see `agent_tmux.rs`) — the local
    /// persistence trick that lets the real `claude`/`codex` process outlive
    /// perch restarts and dropped connections. `None` on a machine without
    /// tmux (the mandatory fallback), in which case the pty child *is* the
    /// CLI, exactly as before this module existed, and `kill()` only ever
    /// needs to signal the child directly.
    tmux_session: Option<String>,
}

/// Registry of agent-attached (`agentAttach`) terminals, one PTY per **session
/// id** rather than per WS connection.
///
/// This is what makes an agent-attached terminal a per-session singleton: a
/// second `attach()` for a session that already has a live entry reuses the
/// existing PTY and just registers another viewer, instead of spawning a
/// second `claude --resume <id>` / `codex resume <id>` against the same
/// on-disk conversation (see the `server.rs` doc comment on `TerminalCreate`
/// for why running two of those at once corrupts the conversation).
///
/// Lives in `AppState` (one instance for the whole process), not `ConnState`
/// — that's the entire point: it must outlive any single connection so a
/// second tab/device can find and share what the first one started.
pub struct AgentTerminalRegistry {
    /// Keyed by session id. `Arc` so the reader/waiter threads spawned in
    /// `attach()` can hold a handle independent of the registry's own lock.
    entries: Arc<Mutex<HashMap<String, Arc<AgentTerminalEntry>>>>,
    on_activity: SessionActivityListener,
}

/// Outcome of [`AgentTerminalRegistry::attach`] — whether it had to spawn a
/// new process or found a live one to share. Both carry the terminal id the
/// caller should reply with in `TerminalCreated`; the wire protocol does not
/// need to (and does not) distinguish the two cases.
pub enum AttachOutcome {
    Created(String),
    Reused(String),
}

impl AgentTerminalRegistry {
    pub fn new(on_activity: SessionActivityListener) -> Self {
        Self {
            entries: Arc::new(Mutex::new(HashMap::new())),
            on_activity,
        }
    }

    /// Observe this exact process without a fallback spawn. The ready hook
    /// runs while output fan-out is locked, so a replay snapshot taken there
    /// ends exactly where this viewer's subsequent live output begins.
    pub fn observe(
        &self,
        identity: &TerminalRuntimeIdentity,
        viewer_id: &str,
        on_data: TerminalDataListener,
        on_exit: TerminalExitListener,
        ready: impl FnOnce(),
    ) -> anyhow::Result<()> {
        let entries = self.entries.lock().unwrap();
        let entry = entries
            .get(&identity.session_id)
            .filter(|entry| {
                entry.terminal_id == identity.terminal_id && entry.process_id == identity.process_id
            })
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("terminal process is no longer available"))?;
        // Exit callbacks may inspect the registry. Never hold its map lock
        // while waiting for fan-out; the exit flag closes the resulting race.
        drop(entries);
        let mut viewers = entry.viewers.lock().unwrap();
        if entry.exited.load(std::sync::atomic::Ordering::Acquire) {
            anyhow::bail!("terminal process has exited");
        }
        ready();
        viewers.insert(viewer_id.to_string(), AgentViewer { on_data, on_exit });
        Ok(())
    }

    /// Attach `viewer_id` to `session_id`'s agent terminal, spawning it if
    /// this is the first viewer. `cols`/`rows`/`cwd`/`command` are only used
    /// when a process actually has to be spawned; a reuse ignores them (the
    /// existing process keeps whatever size it already has — see
    /// `resize()`'s doc comment for what happens when viewers disagree).
    #[allow(clippy::too_many_arguments)]
    pub fn attach(
        &self,
        session_id: &str,
        viewer_id: &str,
        cols: u16,
        rows: u16,
        cwd: Option<String>,
        command: Vec<String>,
        on_data: TerminalDataListener,
        on_exit: TerminalExitListener,
    ) -> anyhow::Result<AttachOutcome> {
        self.attach_inner(
            session_id, viewer_id, cols, rows, cwd, command, on_data, on_exit, false,
        )
    }

    /// Reattach only to an existing tmux process. Recovery must never start
    /// a replacement command when a persisted process has disappeared.
    #[allow(clippy::too_many_arguments)]
    pub fn attach_existing_tmux(
        &self,
        session_id: &str,
        viewer_id: &str,
        cols: u16,
        rows: u16,
        cwd: Option<String>,
        on_data: TerminalDataListener,
        on_exit: TerminalExitListener,
    ) -> anyhow::Result<AttachOutcome> {
        self.attach_inner(
            session_id,
            viewer_id,
            cols,
            rows,
            cwd,
            Vec::new(),
            on_data,
            on_exit,
            true,
        )
    }

    #[allow(clippy::too_many_arguments)]
    fn attach_inner(
        &self,
        session_id: &str,
        viewer_id: &str,
        cols: u16,
        rows: u16,
        cwd: Option<String>,
        command: Vec<String>,
        on_data: TerminalDataListener,
        on_exit: TerminalExitListener,
        existing_only: bool,
    ) -> anyhow::Result<AttachOutcome> {
        let mut entries = self.entries.lock().unwrap();
        if let Some(entry) = entries.get(session_id) {
            entry
                .viewers
                .lock()
                .unwrap()
                .insert(viewer_id.to_string(), AgentViewer { on_data, on_exit });
            return Ok(AttachOutcome::Reused(entry.terminal_id.clone()));
        }

        // Local tmux-backed persistence (see `agent_tmux.rs`): when tmux is
        // present, the pty's child becomes a `tmux attach-session` client
        // against a session that runs `command`, rather than `command`
        // itself — so killing this pty (a viewer detaching, a dropped
        // connection, or perch itself exiting) only loses the attach client;
        // the real CLI keeps running in tmux and a later attach reattaches
        // to it. `use_tmux` is resolved once here (cached probe) so the
        // mandatory no-tmux fallback is a plain, argv-unchanged passthrough.
        let use_tmux = crate::agent_tmux::tmux_available();
        // tmux being *installed* is not the same as tmux *working*: the server
        // can fail to start (socket-dir permissions, resource limits, a version
        // skew). Persistence is a bonus feature — losing it must never cost the
        // user CLI mode itself, which worked before this existed. So a failure
        // here degrades to the exact pre-tmux behavior (spawn the CLI directly)
        // instead of propagating and leaving the user with a dead pane.
        let direct_argv = command.clone();
        let (spawn_argv, tmux_session) = if existing_only {
            let name = crate::agent_tmux::tmux_session_name(session_id);
            if !crate::agent_tmux::tmux_session_exists(&name) {
                anyhow::bail!("persisted terminal process is no longer available");
            }
            (crate::agent_tmux::tmux_attach_argv(&name), Some(name))
        } else {
            match crate::agent_tmux::resolve_agent_spawn(
                use_tmux,
                session_id,
                cols,
                rows,
                cwd.as_deref(),
                command,
            ) {
                Ok(resolved) => resolved,
                Err(err) => {
                    tracing::warn!(
                        session_id,
                        error = %err,
                        "tmux-backed CLI spawn failed; falling back to a direct \
                         (non-persistent) spawn"
                    );
                    (direct_argv, None)
                }
            }
        };

        // The `false` below: an agent-attach pane spawns the CLI (or its tmux
        // client) directly — there is no shell in this pty for `-l` to apply to.
        let SpawnedPty {
            id,
            process_id,
            master,
            writer,
            reader,
            killer,
            mut child,
        } = spawn_pty(cols, rows, cwd, Some(spawn_argv), false)?;

        let mut viewers = HashMap::new();
        viewers.insert(viewer_id.to_string(), AgentViewer { on_data, on_exit });
        let entry = Arc::new(AgentTerminalEntry {
            exited: std::sync::atomic::AtomicBool::new(false),
            terminal_id: id.clone(),
            process_id,
            writer: Mutex::new(AgentWriter::new(writer)),
            master: Mutex::new(master),
            killer: Mutex::new(killer),
            viewers: Mutex::new(viewers),
            last_activity: Mutex::new(std::time::Instant::now()),
            tmux_session,
        });
        entries.insert(session_id.to_string(), entry.clone());
        drop(entries);

        // Reader thread: pump pty output to *every* registered viewer, not
        // just the one that happened to create it — the fan-out this whole
        // registry exists for. Same partial-UTF-8-carry handling as
        // `TerminalManager::create`; see that function's comment for why.
        let reader_id = id.clone();
        let reader_entry = entry.clone();
        let session_id_owned = session_id.to_string();
        let on_activity = self.on_activity.clone();
        std::thread::spawn(move || {
            read_pty_into_chunks(reader, |text| {
                *reader_entry.last_activity.lock().unwrap() = std::time::Instant::now();
                on_activity(&session_id_owned);
                let viewers = reader_entry.viewers.lock().unwrap();
                for viewer in viewers.values() {
                    (viewer.on_data)(reader_id.clone(), text.clone());
                }
            });
        });

        // Waiter thread: pty exit -> fan out terminal.exit to every viewer
        // still registered, then remove the entry. This is the *only* place
        // an entry is ever removed from `entries` — `detach()` and `kill()`
        // both only ever signal the child; removal always happens here, so
        // there is a single writer for "is this session's terminal still
        // alive" and no double-remove race between a disconnecting viewer
        // and an explicit kill.
        let exit_id = id.clone();
        let entries_map = self.entries.clone();
        let session_id_for_exit = session_id.to_string();
        let exit_entry = entry.clone();
        std::thread::spawn(move || {
            let code = match child.wait() {
                Ok(status) => status.exit_code() as i32,
                Err(_) => -1,
            };
            exit_entry
                .exited
                .store(true, std::sync::atomic::Ordering::Release);
            let mut entries = entries_map.lock().unwrap();
            if entries
                .get(&session_id_for_exit)
                .is_some_and(|current| Arc::ptr_eq(current, &exit_entry))
            {
                entries.remove(&session_id_for_exit);
            }
            drop(entries);
            let viewers = exit_entry.viewers.lock().unwrap();
            for viewer in viewers.values() {
                (viewer.on_exit)(exit_id.clone(), code);
            }
        });

        Ok(AttachOutcome::Created(id))
    }

    /// Remove `viewer_id` from `session_id`'s viewer set. If it was the last
    /// viewer, kill the underlying process — the shared terminal dies only
    /// when its last viewer disconnects (or the child exits on its own).
    ///
    /// The kill happens *before* removing the viewer from the map (see the
    /// implementation) so the waiter thread's `on_exit` fan-out still reaches
    /// this viewer's callback — that callback clears process-global state
    /// (`blocked_sessions` in `server.rs`) that must be cleared by *someone*
    /// regardless of which connection is disconnecting.
    ///
    /// For a tmux-backed entry (see `agent_tmux.rs`) this "kill" only ever
    /// reaches the attach client (`entry.killer`), never the tmux session —
    /// that composes automatically with zero special-casing here, because
    /// the pty's child *is* the attach client, not the CLI. Losing it is
    /// exactly equivalent to a tmux detach: the real process keeps running
    /// for the next attach to find. Only `kill()` (explicit user action)
    /// reaches further, into `kill_tmux_session`.
    pub fn detach(&self, session_id: &str, viewer_id: &str) {
        let entry = self.entries.lock().unwrap().get(session_id).cloned();
        let Some(entry) = entry else { return };
        // Decide *and* remove under a single lock acquisition. Splitting the
        // "am I the last viewer?" check from the removal lets two viewers
        // disconnecting concurrently both observe `len == 2`, both take the
        // non-last branch, and both remove — leaving a live PTY with zero
        // viewers that nothing will ever kill.
        //
        // The last viewer is deliberately NOT removed before killing: the
        // waiter thread's `on_exit` runs through the still-registered
        // callbacks, which is what clears process-global `blocked_sessions`
        // state. Removing first would strand that flag set forever.
        let is_last = {
            let mut viewers = entry.viewers.lock().unwrap();
            if !viewers.contains_key(viewer_id) {
                return;
            }
            if viewers.len() <= 1 {
                true
            } else {
                viewers.remove(viewer_id);
                false
            }
        };
        // Dropping a viewer also drops any lease it held. This is done under
        // the same writer lock used by `input_owned`/`resize_owned`, so a
        // disconnect cannot leave a stale client able to write afterward.
        entry.writer.lock().unwrap().clear_for_client(viewer_id);
        if is_last {
            let _ = entry.killer.lock().unwrap().kill();
        }
    }

    /// Write `data` into `session_id`'s terminal using the legacy shared
    /// terminal route. New lifecycle-aware callers should use
    /// [`Self::input_owned`], which checks the current control lease.
    pub fn input(&self, session_id: &str, data: &str) {
        if let Some(entry) = self.entries.lock().unwrap().get(session_id) {
            let _ = entry.writer.lock().unwrap().input(data.as_bytes());
        }
    }

    /// Install or clear the lease that owns keyboard input for this terminal.
    /// The adapter calls this immediately after acquiring/releasing the
    /// corresponding lifecycle lease.
    pub fn set_input_owner(
        &self,
        session_id: &str,
        owner: Option<ControlLease>,
    ) -> std::result::Result<(), TerminalAuthorityError> {
        let entry = self
            .entries
            .lock()
            .unwrap()
            .get(session_id)
            .cloned()
            .ok_or(TerminalAuthorityError::NoTerminal)?;
        let mut writer = entry.writer.lock().unwrap();
        if let (Some(current), Some(next)) = (writer.input_owner.as_ref(), owner.as_ref()) {
            if current != next {
                return Err(TerminalAuthorityError::StaleLease);
            }
        }
        writer.input_owner = owner;
        Ok(())
    }

    /// Clear input authority only if the terminal still carries this exact
    /// lease. A release can race a new acquire after the lifecycle mutex is
    /// dropped; conditional clearing prevents the old release from erasing
    /// the new owner's terminal-side authority.
    pub fn clear_input_owner(
        &self,
        session_id: &str,
        client: &ClientIdentity,
        generation: u64,
    ) -> std::result::Result<(), TerminalAuthorityError> {
        let entry = self
            .entries
            .lock()
            .unwrap()
            .get(session_id)
            .cloned()
            .ok_or(TerminalAuthorityError::NoTerminal)?;
        let mut writer = entry.writer.lock().unwrap();
        match writer.input_owner.as_ref() {
            None => Ok(()),
            Some(owner) if owner.client == *client && owner.generation == generation => {
                writer.input_owner = None;
                Ok(())
            }
            Some(_) => Err(TerminalAuthorityError::StaleLease),
        }
    }

    /// Write terminal input only when `client` still owns the exact lease
    /// generation installed by [`Self::set_input_owner`].
    pub fn input_owned(
        &self,
        session_id: &str,
        client: &ClientIdentity,
        generation: u64,
        data: &str,
    ) -> std::result::Result<(), TerminalAuthorityError> {
        let entry = self
            .entries
            .lock()
            .unwrap()
            .get(session_id)
            .cloned()
            .ok_or(TerminalAuthorityError::NoTerminal)?;
        let result = entry
            .writer
            .lock()
            .unwrap()
            .input_owned(client, generation, data.as_bytes());
        result
    }

    /// Resize `session_id`'s terminal. Last write wins when viewers disagree
    /// on size (e.g. two panes of different widths) — same rule a real
    /// `tmux attach` uses in spirit (the terminal has one size, and whichever
    /// client last reported a size determines it). Getting this "fair" across
    /// viewers is a genuine tmux feature (smallest-common-size) that isn't
    /// implemented here; flagged as a known simplification.
    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) {
        if let Some(entry) = self.entries.lock().unwrap().get(session_id) {
            let _ = entry.master.lock().unwrap().resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            });
        }
    }

    /// Install or clear the lease that owns terminal resize authority.
    pub fn set_resize_owner(
        &self,
        session_id: &str,
        owner: Option<ControlLease>,
    ) -> std::result::Result<(), TerminalAuthorityError> {
        let entry = self
            .entries
            .lock()
            .unwrap()
            .get(session_id)
            .cloned()
            .ok_or(TerminalAuthorityError::NoTerminal)?;
        let mut writer = entry.writer.lock().unwrap();
        if let (Some(current), Some(next)) = (writer.resize_owner.as_ref(), owner.as_ref()) {
            if current != next {
                return Err(TerminalAuthorityError::StaleLease);
            }
        }
        writer.resize_owner = owner;
        Ok(())
    }

    /// Clear resize authority only for the exact lease that was released.
    pub fn clear_resize_owner(
        &self,
        session_id: &str,
        client: &ClientIdentity,
        generation: u64,
    ) -> std::result::Result<(), TerminalAuthorityError> {
        let entry = self
            .entries
            .lock()
            .unwrap()
            .get(session_id)
            .cloned()
            .ok_or(TerminalAuthorityError::NoTerminal)?;
        let mut writer = entry.writer.lock().unwrap();
        match writer.resize_owner.as_ref() {
            None => Ok(()),
            Some(owner) if owner.client == *client && owner.generation == generation => {
                writer.resize_owner = None;
                Ok(())
            }
            Some(_) => Err(TerminalAuthorityError::StaleLease),
        }
    }

    /// Resize the terminal only when `client` still owns the exact resize
    /// lease generation. The writer lock is held while resizing so replacing
    /// the owner cannot race this check.
    pub fn resize_owned(
        &self,
        session_id: &str,
        client: &ClientIdentity,
        generation: u64,
        cols: u16,
        rows: u16,
    ) -> std::result::Result<(), TerminalAuthorityError> {
        let entry = self
            .entries
            .lock()
            .unwrap()
            .get(session_id)
            .cloned()
            .ok_or(TerminalAuthorityError::NoTerminal)?;
        let writer_guard = entry.writer.lock().unwrap();
        if !writer_guard.owns_resize(client, generation) {
            if writer_guard
                .resize_owner
                .as_ref()
                .is_some_and(|owner| owner.client.id == client.id)
            {
                return Err(TerminalAuthorityError::StaleLease);
            }
            return Err(TerminalAuthorityError::NotOwned);
        }
        let result = entry
            .master
            .lock()
            .unwrap()
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|_| TerminalAuthorityError::ResizeFailed);
        result
    }

    /// Force-terminate `session_id`'s terminal regardless of how many viewers
    /// still hold it — used for explicit user actions (restart CLI,
    /// session delete) where "kill it" must mean kill it for everyone, not
    /// just detach the caller. No-op if there is no live entry.
    ///
    /// For a tmux-backed entry this is the one place that must reach past
    /// the attach client to the tmux session itself (`kill_tmux_session`) —
    /// killing only the attach client (what `detach()` does) would just
    /// disconnect it and leave the real CLI running, which is correct for a
    /// viewer disconnect but wrong here: an explicit kill must not leave an
    /// orphan for the next attach to silently reattach to.
    pub fn kill(&self, session_id: &str) {
        if let Some(entry) = self.entries.lock().unwrap().get(session_id) {
            if let Some(name) = &entry.tmux_session {
                crate::agent_tmux::kill_tmux_session(name);
            }
            let _ = entry.killer.lock().unwrap().kill();
        }
    }

    /// Return the concrete PTY/tmux identity currently backing a session.
    /// Callers retain this value and pass it back to [`Self::runtime_alive`]
    /// or [`Self::terminate_for_hibernation`] to avoid acting on a later
    /// runtime that reused the same logical session id.
    pub fn runtime_identity(&self, session_id: &str) -> Option<TerminalRuntimeIdentity> {
        self.entries
            .lock()
            .unwrap()
            .get(session_id)
            .map(|entry| TerminalRuntimeIdentity {
                session_id: session_id.to_string(),
                terminal_id: entry.terminal_id.clone(),
                process_id: entry.process_id,
                tmux_session: entry.tmux_session.clone(),
            })
    }

    /// Check whether the exact runtime identity is still live. For tmux this
    /// checks the persistent server directly, so a dropped attach PTY does
    /// not look like a dead provider process.
    pub fn runtime_alive(&self, identity: &TerminalRuntimeIdentity) -> bool {
        if let Some(name) = identity.tmux_session.as_deref() {
            return crate::agent_tmux::tmux_session_exists(name);
        }
        self.entries
            .lock()
            .unwrap()
            .get(&identity.session_id)
            .is_some_and(|entry| {
                entry.terminal_id == identity.terminal_id && entry.process_id == identity.process_id
            })
    }

    /// Stop the exact runtime represented by `identity` before a lifecycle
    /// record is allowed to enter `Sleeping`. The entry is removed after the
    /// termination signal, preventing a subsequent attach from confusing the
    /// old process with a newly-created one. A tmux session is checked after
    /// the kill request; a still-present session is an error, so callers never
    /// mark an agent sleeping while its provider is demonstrably alive.
    pub fn terminate_for_hibernation(
        &self,
        identity: &TerminalRuntimeIdentity,
    ) -> anyhow::Result<()> {
        let entry = self
            .entries
            .lock()
            .unwrap()
            .get(&identity.session_id)
            .cloned();
        if let Some(entry) = entry.as_ref() {
            if entry.terminal_id != identity.terminal_id || entry.process_id != identity.process_id
            {
                return Err(anyhow::anyhow!(
                    "terminal identity changed for session {}",
                    identity.session_id
                ));
            }
        }

        if let Some(name) = identity.tmux_session.as_deref() {
            crate::agent_tmux::kill_tmux_session(name);
            if crate::agent_tmux::tmux_session_exists(name) {
                return Err(anyhow::anyhow!(
                    "tmux runtime {} is still alive after termination",
                    name
                ));
            }
        }

        if let Some(entry) = entry {
            // The tmux session is the provider process; this additional kill
            // only tears down the local attach client. For direct PTYs it is
            // the provider process itself.
            let _ = entry.killer.lock().unwrap().kill();
            if identity.tmux_session.is_none() {
                // For a direct PTY, the kill signal is asynchronous. Leave
                // the registry entry in place until the waiter observes the
                // child exit; `runtime_alive` therefore remains true while
                // the process can still be running.
                let deadline = std::time::Instant::now() + std::time::Duration::from_secs(1);
                while self.runtime_alive(identity) && std::time::Instant::now() < deadline {
                    std::thread::sleep(std::time::Duration::from_millis(10));
                }
                if self.runtime_alive(identity) {
                    return Err(anyhow::anyhow!(
                        "direct terminal process {} did not stop",
                        identity
                            .process_id
                            .map_or_else(|| "unknown".to_string(), |pid| pid.to_string())
                    ));
                }
            } else {
                let mut entries = self.entries.lock().unwrap();
                if entries.get(&identity.session_id).is_some_and(|current| {
                    current.terminal_id == identity.terminal_id
                        && current.process_id == identity.process_id
                }) {
                    entries.remove(&identity.session_id);
                }
            }
        }
        Ok(())
    }

    /// Remove both control leases held by `client_id` when a protocol client
    /// disconnects without going through the lifecycle adapter.
    pub fn clear_control_owner_for_client(&self, session_id: &str, client_id: &str) {
        if let Some(entry) = self.entries.lock().unwrap().get(session_id).cloned() {
            entry.writer.lock().unwrap().clear_for_client(client_id);
        }
    }

    /// The session id whose shared agent terminal is `terminal_id`, if any.
    /// `server.rs` uses this to decide whether `TerminalInput`/`TerminalResize`/
    /// `TerminalKill` (which only carry a `terminal_id`, not a session id) must
    /// route into this registry rather than the per-connection
    /// `TerminalManager` — a plain shell or a direct-mode (ssh/tmux) terminal
    /// isn't in here at all, so this correctly returns `None` for those. A
    /// linear scan is fine: the number of concurrently live agent terminals is
    /// always tiny (one per actively-CLI-attached session).
    pub fn session_for_terminal(&self, terminal_id: &str) -> Option<String> {
        self.entries
            .lock()
            .unwrap()
            .iter()
            .find(|(_, entry)| entry.terminal_id == terminal_id)
            .map(|(session_id, _)| session_id.clone())
    }

    /// The current terminal id for `session_id`'s live agent terminal, if
    /// any. Used by tests; not needed by `server.rs`, which already gets the
    /// terminal id back from `attach()`.
    #[cfg(test)]
    fn terminal_id_for(&self, session_id: &str) -> Option<String> {
        self.entries
            .lock()
            .unwrap()
            .get(session_id)
            .map(|e| e.terminal_id.clone())
    }

    /// How many viewers `session_id`'s terminal currently has (0 if there is
    /// no live entry). Used by tests to assert a disconnect didn't kill a
    /// terminal another viewer still holds.
    #[cfg(test)]
    fn viewer_count(&self, session_id: &str) -> usize {
        self.entries
            .lock()
            .unwrap()
            .get(session_id)
            .map(|e| e.viewers.lock().unwrap().len())
            .unwrap_or(0)
    }
}

/// How long an agent-attached terminal must go without PTY output before
/// Task 2 considers it idle again.
///
/// herdr's own detector (`src/pane/agent_detection.rs` in the herdr clone)
/// polls at 100ms and caps its idle-confirmation window at 700ms — i.e. about
/// 700ms of visible quiet before it trusts that the agent really has stopped
/// rather than just paused between tool calls or output chunks. perch has no
/// polling loop to reuse that cadence from (activity here is push-driven, one
/// call per PTY read), so the debounce is applied at sweep time instead: the
/// same 700ms is used as the "how quiet is quiet" threshold, which keeps
/// perch's dot exactly as twitchy as herdr's, without perch inventing its own
/// number. Too short and a normal inter-token pause flaps the dot; too long
/// and the "done" toast fires late enough to feel broken.
pub const AGENT_QUIET_THRESHOLD: std::time::Duration = std::time::Duration::from_millis(700);

/// Pure decision function extracted so Task 2's debounce logic is testable
/// without a real PTY: given how long ago output was last seen, has this
/// terminal gone quiet long enough to be considered idle?
pub fn is_quiet_enough_to_idle(
    since_last_activity: std::time::Duration,
    threshold: std::time::Duration,
) -> bool {
    since_last_activity >= threshold
}

impl AgentTerminalRegistry {
    /// One sweep pass for Task 2: return the session ids whose agent terminal
    /// has been quiet for at least `threshold`. Callers (a single shared
    /// sweep task in `server.rs`, not one timer per terminal) cross-reference
    /// this against `AppState::running_sessions` themselves — a session that
    /// is already idle (or was never marked running, e.g. a plain shell) is
    /// harmless to list here again, so this stays a cheap, side-effect-free
    /// query rather than tracking its own "already reported" flag.
    pub fn sessions_quiet_since(&self, threshold: std::time::Duration) -> Vec<String> {
        let now = std::time::Instant::now();
        self.entries
            .lock()
            .unwrap()
            .iter()
            .filter_map(|(session_id, entry)| {
                let last = *entry.last_activity.lock().unwrap();
                is_quiet_enough_to_idle(now.duration_since(last), threshold)
                    .then(|| session_id.clone())
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::{shell_argv, split_utf8_tail};

    /// Off by default is the whole safety story for this setting: a login
    /// shell runs different rc files, so the pre-existing behaviour has to be
    /// what you get when the flag is untouched.
    #[test]
    fn a_plain_pane_spawns_a_bare_shell_unless_login_mode_is_on() {
        assert_eq!(shell_argv("/bin/zsh", false), vec!["/bin/zsh"]);
        assert_eq!(shell_argv("/bin/zsh", true), vec!["/bin/zsh", "-l"]);
    }

    /// `-l` is appended, never substituted for the shell itself — a bug here
    /// would exec `-l` as the program.
    #[test]
    fn login_mode_keeps_the_shell_as_argv0() {
        let argv = shell_argv("/opt/homebrew/bin/fish", true);
        assert_eq!(argv[0], "/opt/homebrew/bin/fish");
        assert_eq!(argv.len(), 2);
    }

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

    use super::{
        is_quiet_enough_to_idle, AgentTerminalRegistry, AttachOutcome, TerminalDataListener,
        TerminalExitListener, AGENT_QUIET_THRESHOLD,
    };
    use std::sync::Arc;
    use std::time::Duration;

    /// The pid of the process running in `name`'s (single) pane, if the
    /// session is alive. Used to prove that a reattach found the *same*
    /// running agent rather than a freshly recreated one.
    fn tmux_pane_pid(name: &str) -> Option<String> {
        let out = std::process::Command::new("tmux")
            .args(["list-panes", "-t", name, "-F", "#{pane_pid}"])
            .output()
            .ok()?;
        if !out.status.success() {
            return None;
        }
        let pid = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if pid.is_empty() {
            None
        } else {
            Some(pid)
        }
    }

    fn noop_listeners() -> (TerminalDataListener, TerminalExitListener) {
        (
            Arc::new(|_id: String, _data: String| {}),
            Arc::new(|_id: String, _code: i32| {}),
        )
    }

    /// Task 1's core correctness fix: a second `agentAttach` for a session
    /// that already has a live terminal must reuse it, not spawn a second
    /// process against the same on-disk conversation.
    #[test]
    fn a_second_attach_for_the_same_session_reuses_the_terminal() {
        let registry = AgentTerminalRegistry::new(Arc::new(|_session_id: &str| {}));
        let (on_data, on_exit) = noop_listeners();
        let command = vec![
            "/bin/sh".to_string(),
            "-c".to_string(),
            "sleep 5".to_string(),
        ];

        let first = registry
            .attach(
                "session-shared",
                "viewer-a",
                80,
                24,
                None,
                command.clone(),
                on_data.clone(),
                on_exit.clone(),
            )
            .expect("first attach spawns");
        let first_id = match first {
            AttachOutcome::Created(id) => id,
            AttachOutcome::Reused(_) => panic!("first attach must create, not reuse"),
        };

        let second = registry
            .attach(
                "session-shared",
                "viewer-b",
                80,
                24,
                None,
                command,
                on_data,
                on_exit,
            )
            .expect("second attach reuses");
        match second {
            AttachOutcome::Reused(id) => assert_eq!(id, first_id, "must be the same terminal"),
            AttachOutcome::Created(_) => panic!("second attach spawned a NEW process — bug"),
        }
        assert_eq!(
            registry.viewer_count("session-shared"),
            2,
            "both viewers should be registered against the one terminal"
        );

        registry.kill("session-shared");
    }

    /// A viewer disconnecting must not kill a terminal another viewer still
    /// holds — only the last viewer leaving (or the child exiting) may do
    /// that.
    #[test]
    fn a_disconnecting_viewer_does_not_kill_a_terminal_another_viewer_holds() {
        let registry = AgentTerminalRegistry::new(Arc::new(|_session_id: &str| {}));
        let (on_data, on_exit) = noop_listeners();
        let command = vec![
            "/bin/sh".to_string(),
            "-c".to_string(),
            "sleep 5".to_string(),
        ];

        registry
            .attach(
                "session-two-viewers",
                "viewer-a",
                80,
                24,
                None,
                command.clone(),
                on_data.clone(),
                on_exit.clone(),
            )
            .unwrap();
        registry
            .attach(
                "session-two-viewers",
                "viewer-b",
                80,
                24,
                None,
                command,
                on_data,
                on_exit,
            )
            .unwrap();

        // The first viewer leaves — the second still holds the terminal.
        registry.detach("session-two-viewers", "viewer-a");
        std::thread::sleep(Duration::from_millis(50));
        assert!(
            registry.terminal_id_for("session-two-viewers").is_some(),
            "terminal must survive while viewer-b still holds it"
        );
        assert_eq!(registry.viewer_count("session-two-viewers"), 1);

        // The last viewer leaves — now it's really gone.
        registry.detach("session-two-viewers", "viewer-b");
        std::thread::sleep(Duration::from_millis(300));
        assert!(
            registry.terminal_id_for("session-two-viewers").is_none(),
            "terminal must die once its last viewer disconnects"
        );
        // Belt-and-braces cleanup: if this machine has tmux, the last
        // detach above only killed the attach client (see
        // `AgentTerminalRegistry::detach`'s doc comment) — the `sleep 5`
        // inside tmux self-terminates shortly on its own, but an explicit
        // kill here means the test never depends on that timing.
        crate::agent_tmux::kill_tmux_session(&crate::agent_tmux::tmux_session_name(
            "session-two-viewers",
        ));
    }

    /// The tmux-persistence feature's core promise, exercised through the
    /// *real* `AgentTerminalRegistry::attach`/`detach`/`kill` path (not just
    /// `agent_tmux.rs`'s direct tmux-command tests): a spawned tmux-backed
    /// terminal's underlying process survives its last viewer detaching —
    /// only an explicit `kill()` may take it down. Gated on tmux being
    /// installed; skips cleanly (not a failure) otherwise, per the phase
    /// brief.
    #[test]
    fn a_tmux_backed_terminal_survives_its_last_viewer_detaching() {
        if !crate::agent_tmux::tmux_available() {
            eprintln!("skipping: tmux not installed");
            return;
        }
        let session_id = "session-tmux-persistence";
        let tmux_name = crate::agent_tmux::tmux_session_name(session_id);
        crate::agent_tmux::kill_tmux_session(&tmux_name); // in case a previous failed run left it

        let registry = AgentTerminalRegistry::new(Arc::new(|_session_id: &str| {}));
        let (on_data, on_exit) = noop_listeners();
        let command = vec![
            "/bin/sh".to_string(),
            "-c".to_string(),
            "sleep 30".to_string(),
        ];

        registry
            .attach(
                session_id,
                "viewer-only",
                80,
                24,
                None,
                command,
                on_data,
                on_exit,
            )
            .expect("attach spawns a tmux-backed terminal");

        // The real CLI (the `sleep 30`) is running inside tmux, not as this
        // pty's direct child — confirm the tmux session actually exists
        // before asserting anything about it surviving.
        assert!(
            crate::agent_tmux::tmux_session_exists(&tmux_name),
            "attach() must have created the tmux session"
        );

        // The only viewer disconnects — this must kill the attach client,
        // not the tmux session underneath it.
        registry.detach(session_id, "viewer-only");
        std::thread::sleep(Duration::from_millis(300));
        assert!(
            registry.terminal_id_for(session_id).is_none(),
            "the registry entry (attach client) must be gone"
        );
        assert!(
            crate::agent_tmux::tmux_session_exists(&tmux_name),
            "the tmux session — the real agent process — must survive a viewer detach"
        );

        // A fresh attach for the same session must reattach to the SAME
        // tmux session (this is the perch-restart recovery path in
        // miniature: a brand-new registry, exactly what exists right after
        // a restart, finding a tmux session that already exists).
        //
        // Record the pane's pid first. Asserting only that *a* session with
        // this name exists afterwards would pass even if it had been torn
        // down and recreated — which is precisely the regression that would
        // silently destroy the user's running agent. The pid is what proves
        // continuity.
        let pane_pid_before = tmux_pane_pid(&tmux_name);
        assert!(
            pane_pid_before.is_some(),
            "expected a live pane pid before the simulated restart"
        );
        let recovering_registry = AgentTerminalRegistry::new(Arc::new(|_session_id: &str| {}));
        let (on_data2, on_exit2) = noop_listeners();
        recovering_registry
            .attach(
                session_id,
                "viewer-after-restart",
                80,
                24,
                None,
                vec![
                    "/bin/sh".to_string(),
                    "-c".to_string(),
                    "echo should-not-run-again".to_string(),
                ],
                on_data2,
                on_exit2,
            )
            .expect("reattach after 'restart' finds the live tmux session");
        assert!(
            crate::agent_tmux::tmux_session_exists(&tmux_name),
            "reattach must still find the same tmux session, not a fresh one"
        );
        assert_eq!(
            tmux_pane_pid(&tmux_name),
            pane_pid_before,
            "reattach must find the SAME running process — a changed pane pid \
             means the agent was killed and relaunched, losing the user's session"
        );

        // Explicit kill (Restart CLI / session delete semantics): THIS must
        // take the tmux session down, unlike the plain detach above.
        recovering_registry.kill(session_id);
        std::thread::sleep(Duration::from_millis(200));
        assert!(
            !crate::agent_tmux::tmux_session_exists(&tmux_name),
            "an explicit kill must remove the tmux session, not just detach"
        );
    }

    /// Pure debounce logic (Task 2): under the threshold stays "working",
    /// at/over it flips to "idle".
    #[test]
    fn quiet_period_debounce_flips_at_the_threshold() {
        assert!(!is_quiet_enough_to_idle(
            Duration::from_millis(100),
            AGENT_QUIET_THRESHOLD
        ));
        assert!(!is_quiet_enough_to_idle(
            Duration::from_millis(699),
            AGENT_QUIET_THRESHOLD
        ));
        assert!(is_quiet_enough_to_idle(
            AGENT_QUIET_THRESHOLD,
            AGENT_QUIET_THRESHOLD
        ));
        assert!(is_quiet_enough_to_idle(
            Duration::from_secs(5),
            AGENT_QUIET_THRESHOLD
        ));
    }

    /// End-to-end (real PTY, no fake clock): a freshly spawned agent terminal
    /// that produces no further output is reported as quiet almost
    /// immediately relative to a short threshold — the plumbing from
    /// `last_activity` through `sessions_quiet_since` actually works, not
    /// just the pure comparison above.
    #[test]
    fn a_silent_terminal_is_reported_quiet_after_the_threshold() {
        let registry = AgentTerminalRegistry::new(Arc::new(|_session_id: &str| {}));
        let session_id = format!("session-quiet-{}", uuid::Uuid::new_v4());
        let (on_data, on_exit) = noop_listeners();
        registry
            .attach(
                &session_id,
                "viewer-a",
                80,
                24,
                None,
                vec![
                    "/bin/sh".to_string(),
                    "-c".to_string(),
                    "sleep 5".to_string(),
                ],
                on_data,
                on_exit,
            )
            .unwrap();

        let short_threshold = Duration::from_millis(20);
        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        let quiet = loop {
            let quiet = registry.sessions_quiet_since(short_threshold);
            if quiet.contains(&session_id) || std::time::Instant::now() >= deadline {
                break quiet;
            }
            std::thread::sleep(Duration::from_millis(10));
        };
        registry.kill(&session_id);
        assert!(
            quiet.contains(&session_id),
            "a silent terminal should show up as quiet: {quiet:?}"
        );
    }
}

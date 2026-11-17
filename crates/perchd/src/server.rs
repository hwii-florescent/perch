//! The daemon: owns every PTY, persists output, fans it out to clients.
//!
//! Threads, no async runtime: one accept loop, one reader + one writer thread
//! per connection, and a reader + waiter thread per live session. Each session
//! has a single lock ([`Session::inner`]) that orders appends to its history log
//! against attaches, which is what makes "replay, then live" gap-free.
//!
//! The history log is the only replay source. Bytes are appended as they are
//! read, an attach reads the requested range back from the file, and the page
//! cache keeps the hot tail in memory. Metadata sits next to it, so a daemon
//! restart (or a reboot) reloads every session as exited-but-replayable.
//!
//! A failure stays local. Locks are parking_lot's and never poison; requests
//! take them with a bound ([`LOCK_WAIT`]) and answer "busy" naming the holder;
//! each request, and each session's output and exit thread, runs under
//! `catch_unwind`; PTY input is written by a per-session thread, never under
//! a lock. The watchdog logs a lock held past [`STUCK_AFTER`], and Health
//! reports it, without ever stopping anything.

use crate::proto::{self, *};
use crate::screen::{clamp_dimension, Screen};
use parking_lot::{Mutex, MutexGuard};
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::os::unix::net::{UnixListener, UnixStream};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::{mpsc, Arc};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

/// A session's log is trimmed to its newest half once it passes this size.
// ponytail: compaction rewrites up to LOG_CAP/2 bytes under the session lock;
// fine at 8 MiB, move to segmented files if caps grow much larger.
pub const LOG_CAP: u64 = 8 * 1024 * 1024;
/// A subscriber this far behind is dropped rather than allowed to buffer
/// without bound; it reattaches from its last seq and loses nothing.
const MAX_QUEUED: usize = 16 * 1024 * 1024;
const CHUNK: usize = 64 * 1024;
/// Exited sessions' history is deleted this long after its last write.
const RETENTION: Duration = Duration::from_secs(7 * 24 * 3600);
/// A request waits this long for a lock, then answers that perchd is busy.
/// Well under the client's own call timeout.
const LOCK_WAIT: Duration = Duration::from_secs(5);
/// A lock held this long is reported by Health and logged by the watchdog.
const STUCK_AFTER: Duration = Duration::from_secs(10);

/// A mutex that remembers what holds it, so a lock that stays held can be
/// named (operation, thread, how long) instead of silently wedging requests.
/// parking_lot never poisons: a panic while holding one releases it.
struct Tracked<T> {
    value: Mutex<T>,
    holder: Mutex<Option<Holder>>,
}

#[derive(Clone)]
struct Holder {
    op: &'static str,
    thread: std::thread::Thread,
    since: Instant,
}

impl std::fmt::Display for Holder {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{} on thread {} ({:?}) for {:.1}s",
            self.op,
            self.thread.name().unwrap_or("unnamed"),
            self.thread.id(),
            self.since.elapsed().as_secs_f64()
        )
    }
}

struct Held<'a, T> {
    guard: MutexGuard<'a, T>,
    holder: &'a Mutex<Option<Holder>>,
}

impl<T> std::ops::Deref for Held<'_, T> {
    type Target = T;
    fn deref(&self) -> &T {
        &self.guard
    }
}

impl<T> std::ops::DerefMut for Held<'_, T> {
    fn deref_mut(&mut self) -> &mut T {
        &mut self.guard
    }
}

impl<T> Drop for Held<'_, T> {
    fn drop(&mut self) {
        *self.holder.lock() = None;
    }
}

impl<T> Tracked<T> {
    fn new(value: T) -> Self {
        Self {
            value: Mutex::new(value),
            holder: Mutex::new(None),
        }
    }

    /// For the daemon's own threads, which have no one to answer "busy" to.
    fn lock(&self, op: &'static str) -> Held<'_, T> {
        self.hold(self.value.lock(), op)
    }

    /// For requests: wait at most `wait`, then say what holds the lock.
    fn lock_within(&self, op: &'static str, wait: Duration) -> Result<Held<'_, T>, String> {
        match self.value.try_lock_for(wait) {
            Some(guard) => Ok(self.hold(guard, op)),
            None => Err(match self.holder.lock().as_ref() {
                Some(holder) => format!("perchd is busy: {holder}"),
                None => "perchd is busy".into(),
            }),
        }
    }

    fn hold<'a>(&'a self, guard: MutexGuard<'a, T>, op: &'static str) -> Held<'a, T> {
        *self.holder.lock() = Some(Holder {
            op,
            thread: std::thread::current(),
            since: Instant::now(),
        });
        Held {
            guard,
            holder: &self.holder,
        }
    }

    fn held_too_long(&self) -> Option<Holder> {
        self.holder
            .lock()
            .clone()
            .filter(|holder| holder.since.elapsed() >= STUCK_AFTER)
    }
}

/// Every lock held past [`STUCK_AFTER`], named by what holds it.
fn stuck_locks(state: &State, sessions: &[Arc<Session>]) -> Vec<String> {
    let map = state
        .sessions
        .held_too_long()
        .map(|holder| format!("session map: {holder}"));
    map.into_iter()
        .chain(sessions.iter().filter_map(|s| {
            s.inner
                .held_too_long()
                .map(|holder| format!("session {}: {holder}", s.id))
        }))
        .collect()
}

/// Start a named thread. A thread that cannot start is logged, never a panic
/// that takes the caller (the accept loop, a create) down with it.
fn spawn_named(name: String, f: impl FnOnce() + Send + 'static) -> bool {
    match std::thread::Builder::new().name(name.clone()).spawn(f) {
        Ok(_) => true,
        Err(error) => {
            eprintln!("perchd: could not start thread {name}: {error}");
            false
        }
    }
}

/// Log every panic with its thread, location and backtrace to stderr (the
/// daemon log), so the cause of a failure is never lost.
fn install_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        let thread = std::thread::current();
        let payload = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "non-string panic payload".into());
        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_default();
        eprintln!(
            "perchd: panic at unix ms {} on thread {} ({:?}) at {location}: {payload}\n{}",
            now_ms(),
            thread.name().unwrap_or("unnamed"),
            thread.id(),
            std::backtrace::Backtrace::force_capture()
        );
    }));
}

pub struct Config {
    pub dir: PathBuf,
    /// Exit after this long with no live sessions and no connections.
    pub idle_exit: Option<Duration>,
}

/// `<dir>/daemon-v<N>.sock`, unless that would overflow the ~104-byte unix
/// socket path limit — then a short per-user, per-directory path under `/tmp`.
pub fn socket_path(dir: &Path) -> PathBuf {
    use std::os::unix::ffi::OsStrExt;
    let path = dir.join(format!("daemon-v{PROTOCOL_VERSION}.sock"));
    if path.as_os_str().len() < 100 {
        return path;
    }
    // FNV-1a: stable across builds, so every client finds the same socket.
    let hash = dir
        .as_os_str()
        .as_bytes()
        .iter()
        .fold(0xcbf29ce484222325u64, |h, &b| {
            (h ^ b as u64).wrapping_mul(0x100000001b3)
        });
    // SAFETY: getuid cannot fail.
    let uid = unsafe { libc::getuid() };
    PathBuf::from(format!(
        "/tmp/perchd-{uid}-{hash:016x}-v{PROTOCOL_VERSION}.sock"
    ))
}

pub fn default_dir() -> PathBuf {
    if let Some(dir) = std::env::var_os("PERCHD_DIR") {
        return PathBuf::from(dir);
    }
    let home = std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| "/tmp".into());
    home.join(".perch").join("daemon")
}

/// Run the daemon until it goes idle. Returns `AddrInUse` if another daemon
/// already owns `dir`.
pub fn run(cfg: Config) -> io::Result<()> {
    fs::create_dir_all(cfg.dir.join("history"))?;
    fs::set_permissions(&cfg.dir, fs::Permissions::from_mode(0o700))?;
    let _lock = lock_dir(&cfg.dir)?;
    let sock = socket_path(&cfg.dir);
    let _ = fs::remove_file(&sock); // stale: we hold the lock, so nobody serves it
    let listener = UnixListener::bind(&sock)?;
    fs::set_permissions(&sock, fs::Permissions::from_mode(0o600))?;
    fs::write(
        cfg.dir.join(format!("daemon-v{PROTOCOL_VERSION}.pid")),
        std::process::id().to_string(),
    )?;

    install_panic_hook();
    let state = Arc::new(State {
        dir: cfg.dir.clone(),
        sessions: Tracked::new(load_sessions(&cfg.dir)),
        conns: AtomicUsize::new(0),
        next_conn: AtomicU64::new(1),
        last_activity: Mutex::new(Instant::now()),
    });

    if let Some(idle) = cfg.idle_exit {
        let state = state.clone();
        let sock = sock.clone();
        spawn_named("perchd-idle".into(), move || loop {
            std::thread::sleep(Duration::from_millis(500));
            // A panic here skips one check; it never ends the thread.
            let _ = catch_unwind(AssertUnwindSafe(|| idle_check(&state, &sock, idle)));
        });
    }
    {
        let state = state.clone();
        spawn_named("perchd-watchdog".into(), move || watchdog(&state));
    }

    for stream in listener.incoming() {
        let Ok(stream) = stream else { continue };
        let state = state.clone();
        let conn = state.next_conn.fetch_add(1, Ordering::SeqCst);
        spawn_named(format!("perchd-conn-{conn}"), move || {
            serve_conn(state, stream, conn)
        });
    }
    Ok(())
}

/// Exit once nothing runs and nobody is connected. Anything uncertain (a
/// lock that cannot be had, a session that cannot be read) is not idle.
fn idle_check(state: &State, sock: &Path, idle: Duration) {
    // Keep the map locked through exit: a create must never slip between the
    // idle check and daemon shutdown, abandoning a PTY.
    let Ok(sessions) = state.sessions.lock_within("idle check", LOCK_WAIT) else {
        return;
    };
    let busy = sessions.values().any(|s| occupied(s).unwrap_or(true));
    if !busy
        && state.conns.load(Ordering::SeqCst) == 0
        && state.last_activity.lock().elapsed() >= idle
    {
        let _ = fs::remove_file(sock);
        std::process::exit(0);
    }
}

/// Logs each lock held past [`STUCK_AFTER`] once, naming its holder. Health
/// reports the same list, which is how a core learns the daemon is wedged.
/// It never stops, kills or restarts anything.
fn watchdog(state: &State) {
    let mut logged: HashMap<String, Instant> = HashMap::new();
    loop {
        std::thread::sleep(Duration::from_secs(2));
        let _ = catch_unwind(AssertUnwindSafe(|| {
            let sessions: Vec<Arc<Session>> = state
                .sessions
                .lock_within("watchdog", Duration::from_millis(500))
                .map(|map| map.values().cloned().collect())
                .unwrap_or_default();
            let mut current = HashMap::new();
            for (what, lock) in std::iter::once(("session map".to_string(), None)).chain(
                sessions
                    .iter()
                    .map(|s| (format!("session {}", s.id), Some(s))),
            ) {
                let holder = match lock {
                    None => state.sessions.held_too_long(),
                    Some(s) => s.inner.held_too_long(),
                };
                if let Some(holder) = holder {
                    if logged.get(&what) != Some(&holder.since) {
                        eprintln!("perchd watchdog: {what} lock stuck: {holder}");
                    }
                    current.insert(what, holder.since);
                }
            }
            logged = current;
        }));
    }
}

fn lock_dir(dir: &Path) -> io::Result<File> {
    use std::os::unix::io::AsRawFd;
    let file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .mode(0o600)
        .open(dir.join(format!("daemon-v{PROTOCOL_VERSION}.lock")))?;
    // SAFETY: flock on a descriptor we own; released when `file` drops.
    if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
        return Err(io::Error::new(
            io::ErrorKind::AddrInUse,
            "another perchd owns this directory",
        ));
    }
    Ok(file)
}

struct State {
    dir: PathBuf,
    sessions: Tracked<HashMap<String, Arc<Session>>>,
    conns: AtomicUsize,
    next_conn: AtomicU64,
    last_activity: Mutex<Instant>,
}

impl State {
    fn touch(&self) {
        *self.last_activity.lock() = Instant::now();
    }
    fn get(&self, id: &str) -> Result<Option<Arc<Session>>, String> {
        Ok(self
            .sessions
            .lock_within("lookup", LOCK_WAIT)?
            .get(id)
            .cloned())
    }
    fn session(&self, id: &str) -> Result<Arc<Session>, String> {
        self.get(id)?.ok_or_else(|| ERR_NOT_FOUND.to_string())
    }
}

struct Session {
    id: String,
    argv: Vec<String>,
    cwd: Option<String>,
    created_ms: u64,
    pid: Option<u32>,
    /// Cleanup pins the unreaped leader so its pid/pgid cannot be reused.
    reap: Mutex<()>,
    inner: Tracked<Inner>,
    /// Input goes to the session's own writer thread, so a program that does
    /// not read its input never blocks a lock (or its own output) on a write.
    writer: Mutex<Option<mpsc::SyncSender<Vec<u8>>>>,
    master: Mutex<Option<Box<dyn MasterPty + Send>>>,
}

struct Inner {
    /// Total bytes ever output == seq of the next byte.
    seq: u64,
    /// Seq of the first byte still in the log file.
    log_start: u64,
    log: Option<File>,
    history_error: Option<String>,
    /// `None` when the terminal engine could not allocate one: the session
    /// runs and keeps its log, and an attach replays the log's tail.
    screen: Option<crate::screen::Screen>,
    cols: u16,
    rows: u16,
    alive: bool,
    exit_code: Option<i32>,
    cleanup: CleanupState,
    subscribers: HashMap<u64, Outbox>,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct Meta {
    id: String,
    argv: Vec<String>,
    cwd: Option<String>,
    created_ms: u64,
    log_start: u64,
    cols: u16,
    rows: u16,
    exit_code: Option<i32>,
    #[serde(default)]
    history_error: Option<String>,
    #[serde(default)]
    seq: Option<u64>,
    #[serde(default)]
    cleanup: CleanupState,
}

/// A connection's outbound queue. `queued` counts payload bytes not yet
/// written to the socket, which is what backpressure is measured against.
#[derive(Clone)]
struct Outbox {
    tx: mpsc::SyncSender<Vec<u8>>,
    queued: Arc<AtomicUsize>,
    socket: Arc<UnixStream>,
}

impl Outbox {
    fn send(&self, frame: &Frame) {
        let bytes = proto::encode(frame);
        let len = bytes.len();
        let reserved = self
            .queued
            .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |queued| {
                (queued + len <= MAX_QUEUED).then_some(queued + len)
            })
            .is_ok();
        if !reserved {
            let _ = self.socket.shutdown(std::net::Shutdown::Both);
        } else if self.tx.try_send(bytes).is_err() {
            self.queued.fetch_sub(len, Ordering::SeqCst);
            let _ = self.socket.shutdown(std::net::Shutdown::Both);
        }
    }
    fn msg(&self, msg: &ServerMsg) {
        self.send(&Frame::Json(serde_json::to_vec(msg).unwrap()));
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Session ids are chosen by clients; file names must not be.
fn file_stem(id: &str) -> String {
    let safe = !id.is_empty()
        && id.len() <= 128
        && !id.starts_with('.')
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_.".contains(&b));
    if safe {
        id.to_string()
    } else {
        id.bytes()
            .map(|b| format!("{b:02x}"))
            .collect::<String>()
            .chars()
            .take(200)
            .collect::<String>()
            + ".x"
    }
}

fn log_path(dir: &Path, id: &str) -> PathBuf {
    dir.join("history").join(format!("{}.log", file_stem(id)))
}
fn meta_path(dir: &Path, id: &str) -> PathBuf {
    dir.join("history").join(format!("{}.json", file_stem(id)))
}

fn write_meta(dir: &Path, s: &Session, inner: &Inner) {
    let _ = save_meta(dir, s, inner);
}

fn save_meta(dir: &Path, s: &Session, inner: &Inner) -> io::Result<()> {
    let meta = Meta {
        id: s.id.clone(),
        argv: s.argv.clone(),
        cwd: s.cwd.clone(),
        created_ms: s.created_ms,
        log_start: inner.log_start,
        cols: inner.cols,
        rows: inner.rows,
        exit_code: inner.exit_code,
        history_error: inner.history_error.clone(),
        seq: Some(inner.seq),
        cleanup: inner.cleanup.clone(),
    };
    let path = meta_path(dir, &s.id);
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_vec(&meta)?)?;
    fs::rename(tmp, path)
}

/// Reload sessions a previous daemon left behind. Their processes died with
/// that daemon (the PTY master closed), so they come back exited — with their
/// scrollback intact.
fn load_sessions(dir: &Path) -> HashMap<String, Arc<Session>> {
    let mut out = HashMap::new();
    let Ok(entries) = fs::read_dir(dir.join("history")) else {
        return out;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let Ok(meta) = fs::read(&path)
            .map_err(|_| ())
            .and_then(|b| serde_json::from_slice::<Meta>(&b).map_err(|_| ()))
        else {
            let _ = fs::remove_file(&path);
            continue;
        };
        let log = log_path(dir, &meta.id);
        let stale = fs::metadata(&log)
            .and_then(|m| m.modified())
            .map(|t| t.elapsed().unwrap_or_default() > RETENTION)
            .unwrap_or(true);
        if stale {
            let _ = fs::remove_file(&log);
            let _ = fs::remove_file(&path);
            continue;
        }
        // A failed append may also have failed to truncate the old file.
        // Never relabel those stale bytes as output after the lost range.
        let invalid = meta.history_error.is_some() && meta.seq == Some(meta.log_start);
        let len = if invalid {
            0
        } else {
            fs::metadata(&log).map(|m| m.len()).unwrap_or(0)
        };
        let (cols, rows) = (clamp_dimension(meta.cols), clamp_dimension(meta.rows));
        let screen = Screen::new(cols, rows);
        if screen.is_none() {
            eprintln!("perchd: {}: no screen; replay is the log's tail", meta.id);
        }
        let session = Session {
            id: meta.id.clone(),
            argv: meta.argv,
            cwd: meta.cwd,
            created_ms: meta.created_ms,
            pid: None,
            reap: Mutex::new(()),
            inner: Tracked::new(Inner {
                seq: meta.seq.unwrap_or(0).max(meta.log_start + len),
                log_start: meta.log_start,
                log: None,
                history_error: meta.history_error,
                screen,
                cols,
                rows,
                alive: false,
                // No recorded code means the process was lost with its daemon.
                exit_code: Some(meta.exit_code.unwrap_or(-1)),
                // A restarted daemon cannot prove ownership of surviving descendants.
                cleanup: CleanupState {
                    retention: Retention::Unknown,
                    stopping: false,
                    ..meta.cleanup
                },
                subscribers: HashMap::new(),
            }),
            writer: Mutex::new(None),
            master: Mutex::new(None),
        };
        out.insert(meta.id, Arc::new(session));
    }
    out
}

fn serve_conn(state: Arc<State>, stream: UnixStream, conn: u64) {
    let (Ok(socket), Ok(mut write_half)) = (stream.try_clone(), stream.try_clone()) else {
        return;
    };
    state.conns.fetch_add(1, Ordering::SeqCst);
    state.touch();
    let (tx, rx) = mpsc::sync_channel::<Vec<u8>>(2048);
    let outbox = Outbox {
        tx,
        queued: Arc::new(AtomicUsize::new(0)),
        socket: Arc::new(socket),
    };

    let writer_queue = outbox.queued.clone();
    let _ = write_half.set_write_timeout(Some(Duration::from_secs(10)));
    let (writer_done_tx, writer_done) = mpsc::channel::<()>();
    spawn_named(format!("perchd-conn-{conn}-out"), move || {
        for bytes in rx {
            let len = bytes.len();
            if write_half.write_all(&bytes).is_err() {
                break;
            }
            writer_queue.fetch_sub(len, Ordering::SeqCst);
        }
        let _ = write_half.shutdown(std::net::Shutdown::Both);
        drop(writer_done_tx);
    });

    let mut read_half = io::BufReader::new(stream);
    while let Ok(Some(frame)) = proto::read_frame(&mut read_half) {
        match frame {
            // Input has no reply: a failure is logged and the input dropped.
            Frame::Data { id, bytes, .. } => {
                let sent = catch_unwind(AssertUnwindSafe(|| input(&state, &id, bytes)));
                match sent {
                    Ok(Ok(())) => {}
                    Ok(Err(error)) => eprintln!("perchd: input for {id} dropped: {error}"),
                    Err(_) => eprintln!("perchd: input for {id} dropped: it panicked"),
                }
            }
            Frame::Json(json) => match serde_json::from_slice::<ClientMsg>(&json) {
                Ok(msg) => {
                    let rid = msg.rid;
                    // One failing request fails alone: the connection, its
                    // other requests and every session carry on.
                    if catch_unwind(AssertUnwindSafe(|| handle(&state, conn, &outbox, msg)))
                        .is_err()
                    {
                        outbox.msg(&ServerMsg::Reply {
                            rid,
                            error: Some(
                                "perchd: the request failed with an internal error (see daemon.log)"
                                    .into(),
                            ),
                            data: Default::default(),
                        });
                    }
                }
                Err(e) => outbox.msg(&ServerMsg::Reply {
                    rid: 0,
                    error: Some(format!("bad request: {e}")),
                    data: Default::default(),
                }),
            },
        }
    }

    let sessions: Vec<Arc<Session>> = state
        .sessions
        .lock_within("disconnect", LOCK_WAIT)
        .map(|map| map.values().cloned().collect())
        .unwrap_or_default();
    for s in sessions {
        // A session that stays locked keeps a subscriber whose sends fail
        // harmlessly on the closed socket.
        if let Ok(mut inner) = s.inner.lock_within("disconnect", LOCK_WAIT) {
            inner.subscribers.remove(&conn);
        }
    }
    let _ = outbox.socket.shutdown(std::net::Shutdown::Both);
    drop(outbox);
    let _ = writer_done.recv();
    state.conns.fetch_sub(1, Ordering::SeqCst);
    state.touch();
}

/// Queue input for the session's writer thread. The session lock is only
/// held to check and record state, never across the write.
fn input(state: &State, id: &str, bytes: Vec<u8>) -> Result<(), String> {
    let Some(s) = state.get(id)? else {
        return Ok(());
    };
    let writer = {
        let mut inner = s.inner.lock_within("input", LOCK_WAIT)?;
        if inner.cleanup.stopping {
            return Ok(());
        }
        retain(&state.dir, &s, &mut inner);
        s.writer.lock().clone()
    };
    // ponytail: a program that stops reading its input fills this queue and
    // then blocks this connection's reader (no lock held); a per-connection
    // input queue would isolate it if that is ever seen.
    if let Some(writer) = writer {
        let _ = writer.send(bytes);
    }
    Ok(())
}

/// The session's input thread: owns the PTY writer and performs every
/// (possibly blocking) write outside any lock.
fn spawn_input_writer(id: &str, mut w: Box<dyn Write + Send>) -> mpsc::SyncSender<Vec<u8>> {
    let (tx, rx) = mpsc::sync_channel::<Vec<u8>>(1024);
    spawn_named(format!("perchd-in-{id}"), move || {
        for bytes in rx {
            if w.write_all(&bytes).and_then(|_| w.flush()).is_err() {
                break;
            }
        }
    });
    tx
}

fn handle(state: &Arc<State>, conn: u64, out: &Outbox, msg: ClientMsg) {
    let rid = msg.rid;
    if let Request::Attach { id, since } = msg.req {
        // `attach` writes its own reply so replay frames can follow it under
        // the session lock.
        match state.session(&id) {
            Ok(s) => attach(state, &s, conn, out, rid, since),
            Err(error) => reply(out, rid, Err(error)),
        }
        return;
    }
    reply(out, rid, respond(state, conn, msg.req));
}

fn reply(out: &Outbox, rid: u64, result: Result<serde_json::Value, String>) {
    let (data, error) = match result {
        Ok(v) => (v, None),
        Err(e) => (serde_json::Value::Null, Some(e)),
    };
    out.msg(&ServerMsg::Reply { rid, error, data });
}

fn respond(state: &Arc<State>, conn: u64, req: Request) -> Result<serde_json::Value, String> {
    let null = || Ok(serde_json::Value::Null);
    let json =
        |value: Result<serde_json::Value, serde_json::Error>| value.map_err(|e| e.to_string());
    match req {
        Request::Hello { .. } => Ok(serde_json::json!({ "version": PROTOCOL_VERSION })),
        Request::Health { permissions } => {
            let sessions: Vec<Arc<Session>> = state
                .sessions
                .lock_within("health", LOCK_WAIT)?
                .values()
                .cloned()
                .collect();
            // Health must answer even with one session wedged: a session
            // whose lock cannot be had soon is reported, and counted as alive
            // (unknown is never exit).
            let alive = sessions
                .iter()
                .filter(|s| {
                    s.inner
                        .lock_within("health", Duration::from_millis(200))
                        .map_or(true, |inner| inner.alive)
                })
                .count();
            json(serde_json::to_value(Health {
                version: PROTOCOL_VERSION,
                pid: std::process::id(),
                sessions: sessions.len(),
                alive,
                capabilities: vec![RELEASED_CLEANUP_CAPABILITY.into()],
                permissions: permissions.then(crate::permissions::snapshot),
                stuck: stuck_locks(state, &sessions),
            }))
        }
        Request::List => {
            let sessions: Vec<Arc<Session>> = state
                .sessions
                .lock_within("list", LOCK_WAIT)?
                .values()
                .cloned()
                .collect();
            let list = sessions
                .iter()
                .map(|s| info(s))
                .collect::<Result<Vec<SessionInfo>, String>>()?;
            json(serde_json::to_value(list))
        }
        Request::Create {
            id,
            argv,
            cwd,
            env,
            cols,
            rows,
            cleanup_owner,
        } => create(state, id, argv, cwd, env, cols, rows, cleanup_owner),
        Request::Release {
            id,
            incarnation,
            revision,
            owner,
            reason,
        } => release(state, &id, &incarnation, revision, &owner, &reason).and_then(|_| null()),
        Request::Cleanup {
            id,
            incarnation,
            revision,
        } => cleanup(state, &id, &incarnation, revision).and_then(|_| null()),
        Request::Attach { .. } => unreachable!("handled by `handle`"),
        Request::Detach { id } => {
            if let Some(s) = state.get(&id)? {
                s.inner
                    .lock_within("detach", LOCK_WAIT)?
                    .subscribers
                    .remove(&conn);
            }
            null()
        }
        Request::Resize { id, cols, rows } => {
            let s = state.session(&id)?;
            let (cols, rows) = (clamp_dimension(cols), clamp_dimension(rows));
            let mut inner = s.inner.lock_within("resize", LOCK_WAIT)?;
            if inner.cleanup.stopping {
                return Err("cleanup in progress".into());
            }
            retain(&state.dir, &s, &mut inner);
            let size = PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            };
            if let Some(m) = s.master.lock().as_ref() {
                let _ = m.resize(size);
            }
            inner.cols = cols;
            inner.rows = rows;
            if let Some(screen) = inner.screen.as_mut() {
                screen.set_size(cols, rows);
            }
            null()
        }
        Request::Kill { id, signal } => {
            let s = state.session(&id)?;
            let _reap = s
                .reap
                .try_lock_for(LOCK_WAIT)
                .ok_or("perchd is busy: the session is being reaped or cleaned up")?;
            let inner = s.inner.lock_within("kill", LOCK_WAIT)?;
            if inner.cleanup.stopping {
                Err("cleanup in progress".into())
            } else if inner.alive {
                s.pid
                    .ok_or_else(|| "unknown process identity".into())
                    .and_then(|pid| signal_group(pid, signal))
                    .and_then(|_| null())
            } else {
                null()
            }
        }
        Request::Remove { id } => {
            let mut sessions = state.sessions.lock_within("remove", LOCK_WAIT)?;
            match sessions.get(&id) {
                Some(s) if occupied(s)? => {
                    Err("alive, stopping or process group unconfirmed".into())
                }
                Some(_) => {
                    sessions.remove(&id);
                    let _ = fs::remove_file(log_path(&state.dir, &id));
                    let _ = fs::remove_file(meta_path(&state.dir, &id));
                    null()
                }
                None => Err(ERR_NOT_FOUND.into()),
            }
        }
        Request::Snapshot { id } => {
            let s = state.session(&id)?;
            #[cfg(test)]
            if id == tests::PANIC_ID {
                let _held = s.inner.lock("snapshot");
                panic!("a request that panics holding its session lock");
            }
            let inner = s.inner.lock_within("snapshot", LOCK_WAIT)?;
            let screen = inner.screen.as_ref().ok_or("screen unavailable")?;
            let (cursor_row, cursor_col) = screen.cursor_position();
            json(serde_json::to_value(Snapshot {
                text: screen.contents(),
                title: screen.title(),
                cursor_row,
                cursor_col,
                alternate_screen: screen.alternate_screen(),
            }))
        }
    }
}

fn info(s: &Session) -> Result<SessionInfo, String> {
    let mut inner = s.inner.lock_within("info", LOCK_WAIT)?;
    if !inner.alive && !inner.cleanup.group_stopped && s.pid.is_some_and(group_absent) {
        // A surviving child may have exited since the leader was reaped.
        // Absence is safe to observe; this never permits signalling a stale pid.
        inner.cleanup.group_stopped = true;
    }
    Ok(SessionInfo {
        id: s.id.clone(),
        pid: s.pid,
        alive: inner.alive,
        exit_code: inner.exit_code,
        argv: s.argv.clone(),
        cwd: s.cwd.clone(),
        cols: inner.cols,
        rows: inner.rows,
        seq: inner.seq,
        created_ms: s.created_ms,
        history_error: inner.history_error.clone(),
        cleanup: inner.cleanup.clone(),
    })
}

/// Running, being stopped, or with a process group not yet confirmed gone:
/// such a session must not be replaced, removed or idled away.
fn occupied(s: &Session) -> Result<bool, String> {
    let session = info(s)?;
    Ok(session.alive
        || session.cleanup.stopping
        || (session.pid.is_some() && !session.cleanup.group_stopped))
}

/// Visibility, silence, client disconnect and a dead owner never release a runtime.
fn retain(dir: &Path, s: &Session, inner: &mut Inner) {
    if inner.cleanup.retention == Retention::Released {
        inner.cleanup.retention = Retention::Retained;
        inner.cleanup.reason = None;
        inner.cleanup.revision += 1;
        write_meta(dir, s, inner);
    }
}

fn release(
    state: &State,
    id: &str,
    incarnation: &str,
    revision: u64,
    owner: &str,
    reason: &str,
) -> Result<(), String> {
    if reason.is_empty() || reason.len() > 512 {
        return Err("invalid release reason".into());
    }
    let s = state.session(id)?;
    let mut inner = s.inner.lock_within("release", LOCK_WAIT)?;
    if inner.cleanup.incarnation != incarnation
        || inner.cleanup.revision != revision
        || inner.cleanup.owner.as_deref() != Some(owner)
        || inner.cleanup.retention != Retention::Retained
        || inner.cleanup.stopping
        || !inner.alive
        || !inner.subscribers.is_empty()
    {
        return Err(
            "runtime is changed, observed, unknown or not owned by this release scope".into(),
        );
    }
    let previous = inner.cleanup.clone();
    inner.cleanup.retention = Retention::Released;
    inner.cleanup.reason = Some(reason.into());
    inner.cleanup.revision += 1;
    if let Err(error) = save_meta(&state.dir, &s, &inner) {
        inner.cleanup = previous;
        return Err(format!("release was not saved: {error}"));
    }
    Ok(())
}

fn signal_group(pid: u32, signal: i32) -> Result<(), String> {
    if pid <= 1 || pid > i32::MAX as u32 {
        return Err("invalid process group".into());
    }
    // SAFETY: the caller pins the daemon's unreaped child, reserving its pgid.
    if unsafe { libc::kill(-(pid as i32), signal) } == 0 {
        return Ok(());
    }
    let error = io::Error::last_os_error();
    if error.raw_os_error() == Some(libc::ESRCH) {
        Ok(())
    } else {
        Err(format!("group signal unconfirmed: {error}"))
    }
}

fn group_absent(pid: u32) -> bool {
    // This is only an absence probe, never permission to signal a reaped pid.
    // A zombie or EPERM remains unconfirmed; only ESRCH confirms an empty group.
    (unsafe { libc::kill(-(pid as i32), 0) }) != 0
        && io::Error::last_os_error().raw_os_error() == Some(libc::ESRCH)
}

/// Only inspect identities/state, never command arguments or directory resemblance.
fn group_live(pid: u32, check_descendants: bool) -> Result<bool, String> {
    // ponytail: explicit cleanup scans the local process table (O(processes));
    // replace ps with platform process APIs if cleanup becomes frequent.
    let output = std::process::Command::new("/bin/ps")
        .args(["-axo", "pid=,ppid=,pgid=,stat="])
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err("cannot verify process group state".into());
    }
    let text = std::str::from_utf8(&output.stdout).map_err(|e| e.to_string())?;
    let mut rows = Vec::new();
    for line in text.lines() {
        let columns: Vec<_> = line.split_whitespace().collect();
        if columns.len() != 4 {
            return Err("unknown process table format".into());
        }
        let number = |i: usize| columns[i].parse::<u32>().map_err(|e| e.to_string());
        rows.push((
            number(0)?,
            number(1)?,
            number(2)?,
            columns[3].starts_with('Z'),
        ));
    }
    if check_descendants {
        let mut descendants = std::collections::HashSet::from([pid]);
        loop {
            let before = descendants.len();
            for (child, parent, _, _) in &rows {
                if descendants.contains(parent) {
                    descendants.insert(*child);
                }
            }
            if descendants.len() == before {
                break;
            }
        }
        if rows.iter().any(|(child, _, group, zombie)| {
            descendants.contains(child) && *group != pid && !zombie
        }) {
            return Err(
                "owned runtime has a detached process group; manual review required".into(),
            );
        }
    }
    // The pinned zombie leader keeps the numeric group identity reserved but
    // consumes no executing resources. Reaping it is confirmed separately.
    Ok(rows
        .iter()
        .any(|(_, _, group, zombie)| *group == pid && !zombie))
}

fn cleanup(state: &State, id: &str, incarnation: &str, revision: u64) -> Result<(), String> {
    let s = state.session(id)?;
    let reap = s
        .reap
        .try_lock_for(LOCK_WAIT)
        .ok_or("perchd is busy: the session is being reaped or cleaned up")?;
    let pid = s.pid.ok_or("unknown process identity")?;
    let unchanged = |inner: &Inner| {
        if !inner.alive
            || inner.cleanup.incarnation != incarnation
            || inner.cleanup.revision != revision
            || inner.cleanup.retention != Retention::Released
            || inner.cleanup.stopping
            || !inner.subscribers.is_empty()
        {
            return Err("cleanup preview is stale or runtime is protected".to_string());
        }
        Ok(())
    };
    unchanged(&*s.inner.lock_within("cleanup", LOCK_WAIT)?)?;
    // The process table scan runs outside the session lock; the state is
    // checked again before the reservation is taken.
    group_live(pid, true)?;
    {
        let mut inner = s.inner.lock_within("cleanup", LOCK_WAIT)?;
        unchanged(&inner)?;
        // This per-session reservation excludes attach/input/recreate, without
        // blocking health, output or operations on unrelated sessions.
        inner.cleanup.stopping = true;
        inner.cleanup.revision += 1;
    }
    let result = (|| {
        for signal in [libc::SIGHUP, libc::SIGKILL] {
            signal_group(pid, signal)?;
            let deadline = Instant::now() + Duration::from_millis(1500);
            while Instant::now() < deadline {
                if !group_live(pid, false)? {
                    return Ok(());
                }
                std::thread::sleep(Duration::from_millis(25));
            }
        }
        Err("process group shutdown unconfirmed".to_string())
    })();
    drop(reap); // allow the waiter to reap the exact leader
    let result = result.and_then(|()| {
        let deadline = Instant::now() + Duration::from_secs(2);
        loop {
            let inner = s.inner.lock_within("cleanup", LOCK_WAIT)?;
            if !inner.alive && group_absent(pid) {
                return Ok(());
            }
            drop(inner);
            if Instant::now() >= deadline {
                return Err("leader/process group exit unconfirmed".into());
            }
            std::thread::sleep(Duration::from_millis(10));
        }
    });
    // The reservation must always be lifted, so this waits as long as it takes.
    let mut inner = s.inner.lock("cleanup");
    inner.cleanup.stopping = false;
    inner.cleanup.group_stopped = result.is_ok();
    if result.is_err() {
        inner.cleanup.retention = Retention::Unknown;
    }
    write_meta(&state.dir, &s, &inner);
    result
}

#[allow(clippy::too_many_arguments)]
fn create(
    state: &Arc<State>,
    id: String,
    argv: Vec<String>,
    cwd: Option<String>,
    env: Vec<(String, String)>,
    cols: u16,
    rows: u16,
    cleanup_owner: Option<String>,
) -> Result<serde_json::Value, String> {
    if cleanup_owner
        .as_ref()
        .is_some_and(|owner| owner.is_empty() || owner.len() > 256)
    {
        return Err("invalid cleanup owner".into());
    }
    let mut random = [0u8; 16];
    File::open("/dev/urandom")
        .and_then(|mut file| file.read_exact(&mut random))
        .map_err(|error| format!("runtime identity: {error}"))?;
    let incarnation = random.iter().map(|byte| format!("{byte:02x}")).collect();
    if id.is_empty() || id.len() > 256 {
        return Err("invalid id".into());
    }
    let program = argv.first().ok_or("empty argv")?.clone();
    let (cols, rows) = (clamp_dimension(cols), clamp_dimension(rows));
    // Built before the map lock and the child: nothing between here and the
    // registration can fail on it. Without one the session still runs.
    let screen = Screen::new(cols, rows);
    if screen.is_none() {
        eprintln!("perchd: {id}: no screen; replay is the log's tail");
    }
    // The whole create runs under the map lock, so two creates for one id
    // cannot both spawn.
    let mut sessions = state.sessions.lock_within("create", LOCK_WAIT)?;
    if let Some(existing) = sessions.get(&id) {
        if occupied(existing)? {
            return Err(ERR_EXISTS.into());
        }
    }
    let pair = native_pty_system()
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("openpty: {e}"))?;
    let mut cmd = CommandBuilder::new(program);
    cmd.args(&argv[1..]);
    if let Some(dir) = cwd.as_deref().filter(|d| Path::new(d).is_dir()) {
        cmd.cwd(dir);
    }
    for (k, v) in &env {
        cmd.env(k, v);
    }
    // A nested core/tool must not inherit its parent's cleanup scope.
    cmd.env_remove(CLEANUP_OWNER_ENV);
    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    // Acquire storage and PTY handles before any child can be launched. An
    // unwritable disk must not leave an unregistered invisible process.
    let log = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .mode(0o600)
        .open(log_path(&state.dir, &id))
        .map_err(|e| format!("history log: {e}; no process started"))?;
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("spawn: {e}"))?;
    drop(pair.slave);
    let session = Arc::new(Session {
        id: id.clone(),
        argv,
        cwd,
        created_ms: now_ms(),
        pid: child.process_id(),
        reap: Mutex::new(()),
        inner: Tracked::new(Inner {
            seq: 0,
            log_start: 0,
            log: Some(log),
            history_error: None,
            screen,
            cols,
            rows,
            alive: true,
            exit_code: None,
            cleanup: CleanupState {
                incarnation,
                revision: 1,
                retention: Retention::Retained,
                owner: cleanup_owner,
                reason: None,
                stopping: false,
                group_stopped: false,
            },
            subscribers: HashMap::new(),
        }),
        writer: Mutex::new(Some(spawn_input_writer(&id, writer))),
        master: Mutex::new(Some(pair.master)),
    });
    write_meta(&state.dir, &session, &session.inner.lock("create"));
    sessions.insert(id, session.clone());
    drop(sessions);
    state.touch();

    let (done_tx, done_rx) = mpsc::channel::<()>();
    {
        let session = session.clone();
        let dir = state.dir.clone();
        spawn_named(format!("perchd-out-{}", session.id), move || {
            let mut reader = reader;
            // A panic while handling output (the screen, most likely) must
            // not stop the output: the program would block on a full PTY.
            // The panic hook has logged it; the screen is dropped, since its
            // state is unknown, and reading goes on.
            for _ in 0..100 {
                match catch_unwind(AssertUnwindSafe(|| {
                    pump_output(&dir, &session, &mut *reader)
                })) {
                    Ok(()) => break,
                    Err(_) => {
                        eprintln!(
                            "perchd: {}: output handling panicked; continuing without a screen",
                            session.id
                        );
                        session.inner.lock("output").screen = None;
                    }
                }
            }
            let _ = done_tx.send(());
        });
    }
    {
        let session = session.clone();
        let state = state.clone();
        spawn_named(format!("perchd-wait-{}", session.id), move || {
            let id = session.id.clone();
            // If this panics the session is never marked exited: unknown is
            // not exit, so it stays protected rather than being cleaned up.
            let waited = catch_unwind(AssertUnwindSafe(|| {
                wait_for_exit(&state, &session, child, done_rx)
            }));
            if waited.is_err() {
                eprintln!("perchd: {id}: exit tracking panicked; the session stays marked alive");
            }
        });
    }
    Ok(serde_json::to_value(Created { pid: session.pid }).unwrap())
}

fn wait_for_exit(
    state: &State,
    session: &Session,
    mut child: Box<dyn portable_pty::Child + Send + Sync>,
    done_rx: mpsc::Receiver<()>,
) {
    // Observe exit without reaping first. Cleanup can pin this exact
    // leader while signalling its group, even if it exits before a child.
    if let Some(pid) = session.pid {
        loop {
            let mut status = std::mem::MaybeUninit::<libc::siginfo_t>::zeroed();
            // SAFETY: valid child id and writable siginfo; WNOWAIT retains its pid.
            let result = unsafe {
                libc::waitid(
                    libc::P_PID,
                    pid as libc::id_t,
                    status.as_mut_ptr(),
                    libc::WEXITED | libc::WNOWAIT,
                )
            };
            if result == 0 || io::Error::last_os_error().kind() != io::ErrorKind::Interrupted {
                break;
            }
        }
    }
    let _reap = session.reap.lock();
    let code = child.wait().map(|s| s.exit_code() as i32).unwrap_or(-1);
    let group_stopped = session.pid.is_some_and(group_absent);
    // Let the reader drain what the process wrote before it exited, so
    // Exit reaches subscribers after the last output byte. A grandchild
    // holding the PTY open must not keep the session alive, hence the
    // bound.
    let _ = done_rx.recv_timeout(Duration::from_millis(1000));
    let mut inner = session.inner.lock("exit");
    inner.alive = false;
    inner.exit_code = Some(code);
    inner.cleanup.group_stopped = group_stopped;
    if let Some(log) = inner.log.as_mut() {
        let _ = log.flush();
    }
    write_meta(&state.dir, session, &inner);
    for out in inner.subscribers.values() {
        out.msg(&ServerMsg::Exit {
            id: session.id.clone(),
            code,
        });
    }
    inner.subscribers.clear();
    drop(inner);
    *session.writer.lock() = None;
    *session.master.lock() = None; // closes the PTY
    state.touch();
}

fn pump_output(dir: &Path, s: &Session, reader: &mut dyn Read) {
    let mut buf = vec![0u8; CHUNK];
    loop {
        let n = match reader.read(&mut buf) {
            // Nothing writes to the log after EOF; an exited session must not
            // hold its fd (replay reads the log by path).
            Ok(0) | Err(_) => {
                s.inner.lock("output").log = None;
                return;
            }
            Ok(n) => n,
        };
        let bytes = &buf[..n];
        let mut inner = s.inner.lock("output");
        let seq = inner.seq;
        inner.seq += n as u64;
        let retrying = inner.log.is_none();
        if retrying {
            // Retry on actual new output after the user frees disk space.
            inner.log_start = seq;
            inner.log = OpenOptions::new()
                .create(true)
                .write(true)
                .truncate(true)
                .mode(0o600)
                .open(log_path(dir, &s.id))
                .ok();
        }
        let written = inner
            .log
            .as_mut()
            .ok_or_else(|| io::Error::other("history storage unavailable"))
            .and_then(|log| log.write_all(bytes));
        if let Err(error) = written {
            degrade_history(dir, s, &mut inner, error);
        } else if retrying {
            // Mark the newly truncated file valid before a daemon restart.
            write_meta(dir, s, &inner);
        }
        if let Some(screen) = inner.screen.as_mut() {
            screen.process(bytes);
        }
        if inner.seq - inner.log_start > LOG_CAP {
            compact(dir, s, &mut inner);
        }
        let frame = Frame::Data {
            id: s.id.clone(),
            seq,
            bytes: bytes.to_vec(),
        };
        let mut dropped = Vec::new();
        for (conn, out) in &inner.subscribers {
            if out.queued.load(Ordering::SeqCst) > MAX_QUEUED {
                dropped.push(*conn);
                out.msg(&ServerMsg::Dropped { id: s.id.clone() });
            } else {
                out.send(&frame);
            }
        }
        for conn in dropped {
            inner.subscribers.remove(&conn);
        }
    }
}

/// A failed append may be partial. Never advertise unwritten bytes as retained.
/// The current screen and live output still work; history retries on new output.
fn degrade_history(dir: &Path, s: &Session, inner: &mut Inner, error: io::Error) {
    inner.log = None;
    inner.log_start = inner.seq;
    // Do not replay an old/partially written file under new sequence offsets.
    let _ = OpenOptions::new()
        .write(true)
        .truncate(true)
        .open(log_path(dir, &s.id));
    let message = format!("Could not save terminal output ({error}). Execution continues; free disk space or restore access");
    if inner.history_error.is_none() {
        eprintln!("perchd: {}: {message}", s.id);
        for out in inner.subscribers.values() {
            out.msg(&ServerMsg::HistoryError {
                id: s.id.clone(),
                message: message.clone(),
            });
        }
    }
    inner.history_error = Some(message);
    write_meta(dir, s, inner);
}

/// Keep the newest half of the log.
fn compact(dir: &Path, s: &Session, inner: &mut Inner) {
    let path = log_path(dir, &s.id);
    let keep = LOG_CAP / 2;
    let new_start = inner.seq - keep;
    let tail = read_range(&path, inner.log_start, new_start, inner.seq);
    let tmp = path.with_extension("log.tmp");
    let result = if tail.len() as u64 != keep {
        Err(io::Error::other("could not read retained terminal history"))
    } else {
        fs::write(&tmp, &tail)
            .and_then(|_| fs::rename(&tmp, &path))
            .and_then(|_| OpenOptions::new().append(true).open(&path))
            .map(|log| {
                inner.log = Some(log);
                inner.log_start = new_start;
            })
    };
    if let Err(error) = result {
        let _ = fs::remove_file(&tmp);
        degrade_history(dir, s, inner, error);
    } else {
        write_meta(dir, s, inner);
    }
}

fn read_range(path: &Path, log_start: u64, from: u64, to: u64) -> Vec<u8> {
    let mut out = Vec::new();
    if to <= from {
        return out;
    }
    if let Ok(mut f) = File::open(path) {
        if f.seek(SeekFrom::Start(from - log_start)).is_ok() {
            let _ = f.take(to - from).read_to_end(&mut out);
        }
    }
    out
}

fn attach(state: &State, s: &Session, conn: u64, out: &Outbox, rid: u64, since: Option<u64>) {
    let mut inner = match s.inner.lock_within("attach", LOCK_WAIT) {
        Ok(inner) => inner,
        Err(error) => return reply(out, rid, Err(error)),
    };
    if inner.cleanup.stopping {
        out.msg(&ServerMsg::Reply {
            rid,
            error: Some("cleanup in progress".into()),
            data: serde_json::Value::Null,
        });
        return;
    }
    retain(&state.dir, s, &mut inner);
    if let Some(log) = inner.log.as_mut() {
        let _ = log.flush();
    }
    let end = inner.seq;
    let mut start = since
        .unwrap_or(end.saturating_sub(DEFAULT_REPLAY))
        .clamp(inner.log_start, end);
    let mut replay = read_range(&log_path(&state.dir, &s.id), inner.log_start, start, end);
    if replay.len() as u64 != end - start {
        degrade_history(
            &state.dir,
            s,
            &mut inner,
            io::Error::other("retained history is missing or unreadable"),
        );
        start = end;
        replay.clear();
    }
    if since.is_none() && start > inner.log_start {
        // A default window starts mid-stream; begin at the next line so the
        // first replayed bytes aren't half an escape sequence or character.
        if let Some(nl) = replay.iter().take(4096).position(|&b| b == b'\n') {
            replay.drain(..=nl);
            start += nl as u64 + 1;
        }
    }
    let attached = Attached {
        history_error: inner.history_error.clone(),
        gap: since.is_some_and(|seq| seq < start),
        start,
        end,
        alive: inner.alive,
        exit_code: inner.exit_code,
        pid: s.pid,
    };
    out.msg(&ServerMsg::Reply {
        rid,
        error: None,
        data: serde_json::to_value(attached).unwrap(),
    });
    // A default window starts mid-stream: end it with the exact screen and
    // modes (see `screen.rs`). It isn't part of the stream, so its seq is
    // whatever makes a client's next seq land back on `end`; an attach
    // `since` a seq resumes the stream itself and never gets it.
    //
    // The oldest scrollback rows are left out of a repaint that would not fit
    // the frame limit or the replay window, so it goes as one frame.
    let restore = if since.is_none() && end > 0 {
        // The frame carries a kind byte, the seq and the id's length and bytes.
        let room = MAX_FRAME - 1 - 8 - 2 - s.id.len();
        inner.screen.as_ref().map_or_else(Vec::new, |screen| {
            screen.restore_bytes_within(room.min(DEFAULT_REPLAY as usize))
        })
    } else {
        Vec::new()
    };
    // The repaint erases the tail, and a client of an exited session ends the
    // attach as soon as its seq reaches `end`, which the tail alone does: the
    // repaint behind it would be dropped unread. Nothing watches an exited
    // session's output, so it gets the repaint alone. A live session keeps
    // the tail for the observers that read it (see `screen.rs`).
    if inner.alive || restore.is_empty() {
        let mut seq = start;
        for chunk in replay.chunks(CHUNK) {
            out.send(&Frame::Data {
                id: s.id.clone(),
                seq,
                bytes: chunk.to_vec(),
            });
            seq += chunk.len() as u64;
        }
    }
    let mut seq = end.saturating_sub(restore.len() as u64);
    // ponytail: only a visible screen too big for one frame by itself (never
    // trimmed) is split, and a client that ends an exited session's attach at
    // `end` may then see it cut. Raise MAX_FRAME or send the screen as its
    // own message if a screen that size ever happens.
    for chunk in restore.chunks(MAX_FRAME - 1 - 8 - 2 - s.id.len()) {
        out.send(&Frame::Data {
            id: s.id.clone(),
            seq,
            bytes: chunk.to_vec(),
        });
        seq += chunk.len() as u64;
    }
    if inner.alive {
        inner.subscribers.insert(conn, out.clone());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::screen::MAX_DIMENSION;

    fn fixture(name: &str) -> State {
        let dir =
            std::env::temp_dir().join(format!("perchd-storage-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("history")).unwrap();
        State {
            dir,
            sessions: Tracked::new(HashMap::new()),
            conns: AtomicUsize::new(0),
            next_conn: AtomicU64::new(1),
            last_activity: Mutex::new(Instant::now()),
        }
    }

    #[test]
    fn failed_history_open_never_launches_a_child() {
        let state = Arc::new(fixture("open"));
        let marker = state.dir.join("child-started");
        // A path collision/unwritable history location is an ordinary storage
        // failure. The command would leave a marker if it were ever spawned.
        fs::create_dir(log_path(&state.dir, "shell")).unwrap();
        let result = create(
            &state,
            "shell".into(),
            vec![
                "/bin/sh".into(),
                "-c".into(),
                format!("touch '{}'", marker.display()),
            ],
            None,
            vec![],
            80,
            24,
            None,
        );
        assert!(result.unwrap_err().contains("no process started"));
        assert!(state.sessions.lock("test").is_empty());
        assert!(!marker.exists());
        fs::remove_dir_all(&state.dir).unwrap();
    }

    #[test]
    fn history_write_failure_is_visible_and_live_output_survives() {
        let state = fixture("append");
        let path = log_path(&state.dir, "shell");
        fs::write(&path, b"").unwrap();
        let session = Session {
            id: "shell".into(),
            argv: vec![],
            cwd: None,
            pid: None,
            created_ms: now_ms(),
            reap: Mutex::new(()),
            writer: Mutex::new(None),
            master: Mutex::new(None),
            inner: Tracked::new(Inner {
                seq: 0,
                log_start: 0,
                // A real failing write, portable to macOS without /dev/full.
                log: Some(File::open(&path).unwrap()),
                history_error: None,
                screen: Screen::new(80, 24),
                cols: 80,
                rows: 24,
                alive: true,
                exit_code: None,
                cleanup: CleanupState::default(),
                subscribers: HashMap::new(),
            }),
        };
        pump_output(&state.dir, &session, &mut io::Cursor::new(b"still running"));
        let inner = session.inner.lock("test");
        assert!(inner.alive);
        assert_eq!(inner.seq, 13);
        assert_eq!(inner.log_start, 13);
        assert!(inner
            .history_error
            .as_ref()
            .unwrap()
            .contains("Execution continues"));
        assert!(inner
            .screen
            .as_ref()
            .unwrap()
            .contents()
            .contains("still running"));
        drop(inner);
        // Even if truncating the old log also failed, daemon restart cannot
        // reinterpret old bytes under a new offset.
        fs::write(&path, b"stale bytes").unwrap();
        let restored = load_sessions(&state.dir);
        assert_eq!(restored["shell"].inner.lock("test").seq, 13);
        // The next actual output retries storage after a user repairs/free space.
        pump_output(&state.dir, &session, &mut io::Cursor::new(b"after repair"));
        let inner = session.inner.lock("test");
        assert_eq!(inner.log_start, 13);
        assert_eq!(fs::read(&path).unwrap(), b"after repair");
        assert!(
            inner.history_error.is_some(),
            "earlier lost output stays disclosed"
        );
        drop(inner);
        let restored = load_sessions(&state.dir);
        assert_eq!(restored["shell"].inner.lock("test").seq, 25);
        fs::remove_dir_all(&state.dir).unwrap();
    }

    #[test]
    fn an_oversized_grid_is_clamped_for_the_pty_and_the_screen() {
        let state = Arc::new(fixture("clamp"));
        create(
            &state,
            "shell".into(),
            vec!["/bin/sh".into(), "-c".into(), "true".into()],
            None,
            vec![],
            u16::MAX,
            u16::MAX,
            None,
        )
        .unwrap();
        let session = state.session("shell").unwrap();
        let deadline = Instant::now() + Duration::from_secs(10);
        loop {
            let inner = session.inner.lock("test");
            if !inner.alive {
                assert_eq!((inner.cols, inner.rows), (MAX_DIMENSION, MAX_DIMENSION));
                assert!(inner.screen.is_some());
                break;
            }
            drop(inner);
            assert!(Instant::now() < deadline, "the child never exited");
            std::thread::sleep(Duration::from_millis(10));
        }
        fs::remove_dir_all(&state.dir).unwrap();
    }

    /// A session whose terminal engine could not allocate a screen keeps
    /// running: output is logged, requests are answered, and an attach replays
    /// the log's tail.
    #[test]
    fn a_session_without_a_screen_still_answers_requests() {
        let state = Arc::new(fixture("no-screen"));
        let path = log_path(&state.dir, "shell");
        let session = Arc::new(Session {
            id: "shell".into(),
            argv: vec![],
            cwd: None,
            pid: None,
            created_ms: now_ms(),
            reap: Mutex::new(()),
            writer: Mutex::new(None),
            master: Mutex::new(None),
            inner: Tracked::new(Inner {
                seq: 0,
                log_start: 0,
                log: Some(File::create(&path).unwrap()),
                history_error: None,
                screen: None,
                cols: 80,
                rows: 24,
                alive: true,
                exit_code: None,
                cleanup: CleanupState::default(),
                subscribers: HashMap::new(),
            }),
        });
        state
            .sessions
            .lock("test")
            .insert("shell".into(), session.clone());
        pump_output(&state.dir, &session, &mut io::Cursor::new(b"still running"));
        assert_eq!(session.inner.lock("test").seq, 13);

        let (tx, rx) = mpsc::sync_channel::<Vec<u8>>(64);
        let (socket, _peer) = UnixStream::pair().unwrap();
        let out = Outbox {
            tx,
            queued: Arc::new(AtomicUsize::new(0)),
            socket: Arc::new(socket),
        };
        let send = |rid, req| handle(&state, 1, &out, ClientMsg { rid, req });
        send(
            1,
            Request::Resize {
                id: "shell".into(),
                cols: u16::MAX,
                rows: 0,
            },
        );
        send(2, Request::Snapshot { id: "shell".into() });
        send(
            3,
            Request::Attach {
                id: "shell".into(),
                since: None,
            },
        );
        send(4, Request::List);

        let bytes: Vec<u8> = rx.try_iter().flatten().collect();
        let mut frames = io::Cursor::new(bytes);
        let mut replies = Vec::new();
        let mut replayed = Vec::new();
        while let Some(frame) = proto::read_frame(&mut frames).unwrap() {
            match frame {
                Frame::Json(json) => {
                    replies.push(serde_json::from_slice::<ServerMsg>(&json).unwrap())
                }
                Frame::Data { bytes, .. } => replayed.extend(bytes),
            }
        }
        let error = |msg: &ServerMsg| match msg {
            ServerMsg::Reply { error, .. } => error.clone(),
            other => panic!("unexpected {other:?}"),
        };
        assert_eq!(replies.len(), 4);
        assert_eq!(error(&replies[0]), None, "resize");
        assert_eq!(error(&replies[1]).as_deref(), Some("screen unavailable"));
        assert_eq!(error(&replies[2]), None, "attach");
        assert_eq!(error(&replies[3]), None, "list: the map is not poisoned");
        assert_eq!(replayed, b"still running");
        let inner = session.inner.lock("test");
        assert_eq!((inner.cols, inner.rows), (MAX_DIMENSION, 1));
        assert!(inner.subscribers.contains_key(&1));
        drop(inner);
        fs::remove_dir_all(&state.dir).unwrap();
    }

    pub(super) const PANIC_ID: &str = "panics-in-snapshot";

    /// A live session with a screen and a history log, registered in `state`.
    fn live_session(state: &State, id: &str) -> Arc<Session> {
        let session = Arc::new(Session {
            id: id.into(),
            argv: vec![],
            cwd: None,
            pid: None,
            created_ms: now_ms(),
            reap: Mutex::new(()),
            writer: Mutex::new(None),
            master: Mutex::new(None),
            inner: Tracked::new(Inner {
                seq: 0,
                log_start: 0,
                log: Some(File::create(log_path(&state.dir, id)).unwrap()),
                history_error: None,
                screen: Screen::new(80, 24),
                cols: 80,
                rows: 24,
                alive: true,
                exit_code: None,
                cleanup: CleanupState::default(),
                subscribers: HashMap::new(),
            }),
        });
        state
            .sessions
            .lock("test")
            .insert(id.into(), session.clone());
        session
    }

    /// A client talking to `serve_conn` over a socket pair, as a core does.
    fn connect(state: &Arc<State>) -> crate::client::Client {
        let (ours, theirs) = UnixStream::pair().unwrap();
        let state = state.clone();
        std::thread::spawn(move || serve_conn(state, theirs, 7));
        crate::client::Client::from_transport(ours.try_clone().unwrap(), ours)
    }

    #[test]
    fn a_panic_holding_a_session_lock_fails_one_request_not_the_daemon() {
        let state = Arc::new(fixture("panic"));
        let shell = live_session(&state, "shell");
        pump_output(&state.dir, &shell, &mut io::Cursor::new(b"still here"));
        live_session(&state, PANIC_ID);
        let client = connect(&state);

        // The request panics while holding its session's lock (and its
        // thread panics again on another session's lock, as the idle thread
        // did): it fails alone, with an answer.
        let error = client.snapshot(PANIC_ID).unwrap_err().to_string();
        assert!(error.contains("internal error"), "{error}");
        std::thread::spawn({
            let (state, shell) = (state.clone(), shell.clone());
            move || {
                let _map = state.sessions.lock("test");
                let _held = shell.inner.lock("test");
                let _reap = shell.reap.lock();
                panic!("an internal thread panics holding the map and a session's locks");
            }
        })
        .join()
        .unwrap_err();

        // Every later request still works, on the same connection, for the
        // panicked session and the others alike.
        let health = client.health().unwrap();
        assert_eq!((health.sessions, health.alive), (2, 2));
        assert!(health.stuck.is_empty(), "{:?}", health.stuck);
        assert_eq!(client.list().unwrap().len(), 2);
        assert!(client
            .snapshot("shell")
            .unwrap()
            .text
            .contains("still here"));
        client.resize(PANIC_ID, 100, 30).unwrap();
        assert_eq!(
            state.session(PANIC_ID).unwrap().inner.lock("test").cols,
            100
        );
        fs::remove_dir_all(&state.dir).unwrap();
    }

    #[test]
    fn a_lock_held_too_long_answers_busy_and_health_names_it() {
        let state = Arc::new(fixture("stuck"));
        let shell = live_session(&state, "shell");
        live_session(&state, "other");
        let (holding, held) = mpsc::channel();
        let (release, released) = mpsc::channel::<()>();
        let holder = std::thread::Builder::new()
            .name("stuck-holder".into())
            .spawn({
                let shell = shell.clone();
                move || {
                    let _inner = shell.inner.lock("a wedged write");
                    // As if it had been held past the threshold already.
                    shell.inner.holder.lock().as_mut().unwrap().since -= STUCK_AFTER;
                    holding.send(()).unwrap();
                    let _ = released.recv();
                }
            })
            .unwrap();
        held.recv().unwrap();
        let client = connect(&state);

        // Health answers at once and names what holds the lock; the session
        // it cannot read counts as alive.
        let started = Instant::now();
        let health = client.health().unwrap();
        assert!(started.elapsed() < Duration::from_secs(2));
        assert_eq!(health.alive, 2);
        assert_eq!(health.stuck.len(), 1, "{:?}", health.stuck);
        assert!(health.stuck[0].contains("session shell: a wedged write on thread stuck-holder"));

        // A request on the wedged session waits a bounded time and says why;
        // the other session is unaffected.
        let started = Instant::now();
        let error = client.snapshot("shell").unwrap_err().to_string();
        assert!(started.elapsed() >= LOCK_WAIT && started.elapsed() < LOCK_WAIT * 2);
        assert!(error.contains("perchd is busy: a wedged write"), "{error}");
        assert!(client.snapshot("other").is_ok());

        release.send(()).unwrap();
        holder.join().unwrap();
        assert!(client.snapshot("shell").is_ok());
        assert!(client.health().unwrap().stuck.is_empty());
        fs::remove_dir_all(&state.dir).unwrap();
    }

    #[test]
    fn a_long_dir_gets_a_socket_path_that_fits() {
        let short = socket_path(Path::new("/home/u/.perch/daemon"));
        assert_eq!(short, Path::new("/home/u/.perch/daemon/daemon-v1.sock"));
        let long_dir = PathBuf::from("/").join("x".repeat(150));
        let long = socket_path(&long_dir);
        assert!(long.as_os_str().len() < 100, "{long:?}");
        assert_eq!(long, socket_path(&long_dir), "stable");
        assert_ne!(long, socket_path(&long_dir.join("y")), "per directory");
    }
}

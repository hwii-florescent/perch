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

use crate::proto::{self, *};
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::{mpsc, Arc, Mutex};
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

    let state = Arc::new(State {
        dir: cfg.dir.clone(),
        sessions: Mutex::new(load_sessions(&cfg.dir)),
        conns: AtomicUsize::new(0),
        next_conn: AtomicU64::new(1),
        last_activity: Mutex::new(Instant::now()),
    });

    if let Some(idle) = cfg.idle_exit {
        let state = state.clone();
        let sock = sock.clone();
        std::thread::spawn(move || loop {
            std::thread::sleep(Duration::from_millis(500));
            let alive = state
                .sessions
                .lock()
                .unwrap()
                .values()
                .any(|s| s.inner.lock().unwrap().alive);
            if !alive
                && state.conns.load(Ordering::SeqCst) == 0
                && state.last_activity.lock().unwrap().elapsed() >= idle
            {
                let _ = fs::remove_file(&sock);
                std::process::exit(0);
            }
        });
    }

    for stream in listener.incoming() {
        let Ok(stream) = stream else { continue };
        let state = state.clone();
        std::thread::spawn(move || serve_conn(state, stream));
    }
    Ok(())
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
    sessions: Mutex<HashMap<String, Arc<Session>>>,
    conns: AtomicUsize,
    next_conn: AtomicU64,
    last_activity: Mutex<Instant>,
}

impl State {
    fn touch(&self) {
        *self.last_activity.lock().unwrap() = Instant::now();
    }
    fn get(&self, id: &str) -> Option<Arc<Session>> {
        self.sessions.lock().unwrap().get(id).cloned()
    }
}

struct Session {
    id: String,
    argv: Vec<String>,
    cwd: Option<String>,
    created_ms: u64,
    pid: Option<u32>,
    inner: Mutex<Inner>,
    writer: Mutex<Option<Box<dyn Write + Send>>>,
    master: Mutex<Option<Box<dyn MasterPty + Send>>>,
}

struct Inner {
    /// Total bytes ever output == seq of the next byte.
    seq: u64,
    /// Seq of the first byte still in the log file.
    log_start: u64,
    log: Option<File>,
    history_error: Option<String>,
    screen: crate::screen::Screen,
    cols: u16,
    rows: u16,
    alive: bool,
    exit_code: Option<i32>,
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
    };
    let path = meta_path(dir, &s.id);
    let tmp = path.with_extension("json.tmp");
    if fs::write(&tmp, serde_json::to_vec(&meta).unwrap()).is_ok() {
        let _ = fs::rename(tmp, path);
    }
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
        let session = Session {
            id: meta.id.clone(),
            argv: meta.argv,
            cwd: meta.cwd,
            created_ms: meta.created_ms,
            pid: None,
            inner: Mutex::new(Inner {
                seq: meta.seq.unwrap_or(0).max(meta.log_start + len),
                log_start: meta.log_start,
                log: None,
                history_error: meta.history_error,
                screen: crate::screen::Screen::new(meta.cols, meta.rows),
                cols: meta.cols,
                rows: meta.rows,
                alive: false,
                // No recorded code means the process was lost with its daemon.
                exit_code: Some(meta.exit_code.unwrap_or(-1)),
                subscribers: HashMap::new(),
            }),
            writer: Mutex::new(None),
            master: Mutex::new(None),
        };
        out.insert(meta.id, Arc::new(session));
    }
    out
}

fn serve_conn(state: Arc<State>, stream: UnixStream) {
    state.conns.fetch_add(1, Ordering::SeqCst);
    state.touch();
    let conn = state.next_conn.fetch_add(1, Ordering::SeqCst);
    let (tx, rx) = mpsc::sync_channel::<Vec<u8>>(2048);
    let outbox = Outbox {
        tx,
        queued: Arc::new(AtomicUsize::new(0)),
        socket: Arc::new(stream.try_clone().unwrap()),
    };

    let writer_queue = outbox.queued.clone();
    let mut write_half = match stream.try_clone() {
        Ok(s) => s,
        Err(_) => return,
    };
    let _ = write_half.set_write_timeout(Some(Duration::from_secs(10)));
    let writer = std::thread::spawn(move || {
        for bytes in rx {
            let len = bytes.len();
            if write_half.write_all(&bytes).is_err() {
                break;
            }
            writer_queue.fetch_sub(len, Ordering::SeqCst);
        }
        let _ = write_half.shutdown(std::net::Shutdown::Both);
    });

    let mut read_half = io::BufReader::new(stream);
    while let Ok(Some(frame)) = proto::read_frame(&mut read_half) {
        match frame {
            Frame::Data { id, bytes, .. } => {
                if let Some(s) = state.get(&id) {
                    if let Some(w) = s.writer.lock().unwrap().as_mut() {
                        let _ = w.write_all(&bytes).and_then(|_| w.flush());
                    }
                }
            }
            Frame::Json(json) => match serde_json::from_slice::<ClientMsg>(&json) {
                Ok(msg) => handle(&state, conn, &outbox, msg),
                Err(e) => outbox.msg(&ServerMsg::Reply {
                    rid: 0,
                    error: Some(format!("bad request: {e}")),
                    data: Default::default(),
                }),
            },
        }
    }

    for s in state.sessions.lock().unwrap().values() {
        s.inner.lock().unwrap().subscribers.remove(&conn);
    }
    let _ = outbox.socket.shutdown(std::net::Shutdown::Both);
    drop(outbox);
    let _ = writer.join();
    state.conns.fetch_sub(1, Ordering::SeqCst);
    state.touch();
}

fn handle(state: &Arc<State>, conn: u64, out: &Outbox, msg: ClientMsg) {
    let rid = msg.rid;
    let reply = |result: Result<serde_json::Value, String>| {
        let (data, error) = match result {
            Ok(v) => (v, None),
            Err(e) => (serde_json::Value::Null, Some(e)),
        };
        out.msg(&ServerMsg::Reply { rid, error, data });
    };
    let not_found = || Err(ERR_NOT_FOUND.to_string());
    match msg.req {
        Request::Hello { .. } => reply(Ok(serde_json::json!({ "version": PROTOCOL_VERSION }))),
        Request::Health => {
            let sessions = state.sessions.lock().unwrap();
            let alive = sessions
                .values()
                .filter(|s| s.inner.lock().unwrap().alive)
                .count();
            reply(Ok(serde_json::to_value(Health {
                version: PROTOCOL_VERSION,
                pid: std::process::id(),
                sessions: sessions.len(),
                alive,
            })
            .unwrap()))
        }
        Request::List => {
            let sessions = state.sessions.lock().unwrap();
            let list: Vec<SessionInfo> = sessions.values().map(|s| info(s)).collect();
            reply(Ok(serde_json::to_value(list).unwrap()))
        }
        Request::Create {
            id,
            argv,
            cwd,
            env,
            cols,
            rows,
        } => reply(create(state, id, argv, cwd, env, cols, rows)),
        Request::Attach { id, since } => match state.get(&id) {
            // `attach` writes its own reply so replay frames can follow it
            // under the session lock.
            Some(s) => attach(state, &s, conn, out, rid, since),
            None => reply(not_found()),
        },
        Request::Detach { id } => {
            if let Some(s) = state.get(&id) {
                s.inner.lock().unwrap().subscribers.remove(&conn);
            }
            reply(Ok(serde_json::Value::Null))
        }
        Request::Resize { id, cols, rows } => match state.get(&id) {
            Some(s) => {
                let size = PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                };
                if let Some(m) = s.master.lock().unwrap().as_ref() {
                    let _ = m.resize(size);
                }
                let mut inner = s.inner.lock().unwrap();
                inner.cols = cols;
                inner.rows = rows;
                inner.screen.set_size(cols, rows);
                reply(Ok(serde_json::Value::Null))
            }
            None => reply(not_found()),
        },
        Request::Kill { id, signal } => match state.get(&id) {
            Some(s) => {
                if s.inner.lock().unwrap().alive {
                    if let Some(pid) = s.pid {
                        // The PTY child is a session leader, so its pid is its
                        // process group: signal the whole group.
                        // SAFETY: plain syscall; a stale pgid only yields ESRCH.
                        unsafe { libc::kill(-(pid as i32), signal) };
                    }
                }
                reply(Ok(serde_json::Value::Null))
            }
            None => reply(not_found()),
        },
        Request::Remove { id } => {
            let mut sessions = state.sessions.lock().unwrap();
            match sessions.get(&id) {
                Some(s) if s.inner.lock().unwrap().alive => reply(Err("alive".into())),
                Some(_) => {
                    sessions.remove(&id);
                    let _ = fs::remove_file(log_path(&state.dir, &id));
                    let _ = fs::remove_file(meta_path(&state.dir, &id));
                    reply(Ok(serde_json::Value::Null))
                }
                None => reply(not_found()),
            }
        }
        Request::Snapshot { id } => match state.get(&id) {
            Some(s) => {
                let inner = s.inner.lock().unwrap();
                let screen = inner.screen.screen();
                let (cursor_row, cursor_col) = screen.cursor_position();
                reply(Ok(serde_json::to_value(Snapshot {
                    text: screen.contents(),
                    title: screen.title().to_string(),
                    cursor_row,
                    cursor_col,
                    alternate_screen: screen.alternate_screen(),
                })
                .unwrap()))
            }
            None => reply(not_found()),
        },
    }
}

fn info(s: &Session) -> SessionInfo {
    let inner = s.inner.lock().unwrap();
    SessionInfo {
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
    }
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
) -> Result<serde_json::Value, String> {
    if id.is_empty() || id.len() > 256 {
        return Err("invalid id".into());
    }
    let program = argv.first().ok_or("empty argv")?.clone();
    // The whole create runs under the map lock, so two creates for one id
    // cannot both spawn.
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(existing) = sessions.get(&id) {
        if existing.inner.lock().unwrap().alive {
            return Err(ERR_EXISTS.into());
        }
    }
    let (cols, rows) = (cols.max(1), rows.max(1));
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
    let mut child = pair
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
        inner: Mutex::new(Inner {
            seq: 0,
            log_start: 0,
            log: Some(log),
            history_error: None,
            screen: crate::screen::Screen::new(cols, rows),
            cols,
            rows,
            alive: true,
            exit_code: None,
            subscribers: HashMap::new(),
        }),
        writer: Mutex::new(Some(writer)),
        master: Mutex::new(Some(pair.master)),
    });
    write_meta(&state.dir, &session, &session.inner.lock().unwrap());
    sessions.insert(id, session.clone());
    drop(sessions);
    state.touch();

    let (done_tx, done_rx) = mpsc::channel::<()>();
    {
        let session = session.clone();
        let dir = state.dir.clone();
        std::thread::spawn(move || {
            pump_output(&dir, &session, reader);
            let _ = done_tx.send(());
        });
    }
    {
        let session = session.clone();
        let state = state.clone();
        std::thread::spawn(move || {
            let code = child.wait().map(|s| s.exit_code() as i32).unwrap_or(-1);
            // Let the reader drain what the process wrote before it exited, so
            // Exit reaches subscribers after the last output byte. A grandchild
            // holding the PTY open must not keep the session alive, hence the
            // bound.
            let _ = done_rx.recv_timeout(Duration::from_millis(1000));
            let mut inner = session.inner.lock().unwrap();
            inner.alive = false;
            inner.exit_code = Some(code);
            if let Some(log) = inner.log.as_mut() {
                let _ = log.flush();
            }
            write_meta(&state.dir, &session, &inner);
            for out in inner.subscribers.values() {
                out.msg(&ServerMsg::Exit {
                    id: session.id.clone(),
                    code,
                });
            }
            inner.subscribers.clear();
            drop(inner);
            *session.writer.lock().unwrap() = None;
            *session.master.lock().unwrap() = None; // closes the PTY
            state.touch();
        });
    }
    Ok(serde_json::to_value(Created { pid: session.pid }).unwrap())
}

fn pump_output(dir: &Path, s: &Session, mut reader: Box<dyn Read + Send>) {
    let mut buf = vec![0u8; CHUNK];
    loop {
        let n = match reader.read(&mut buf) {
            // Nothing writes to the log after EOF; an exited session must not
            // hold its fd (replay reads the log by path).
            Ok(0) | Err(_) => {
                s.inner.lock().unwrap().log = None;
                return;
            }
            Ok(n) => n,
        };
        let bytes = &buf[..n];
        let mut inner = s.inner.lock().unwrap();
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
        inner.screen.process(bytes);
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
    let mut inner = s.inner.lock().unwrap();
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
    let mut seq = start;
    for chunk in replay.chunks(CHUNK) {
        out.send(&Frame::Data {
            id: s.id.clone(),
            seq,
            bytes: chunk.to_vec(),
        });
        seq += chunk.len() as u64;
    }
    // A default window starts mid-stream: end it with the exact screen and
    // modes (see `screen.rs`). It isn't part of the stream, so its seq is
    // whatever makes a client's next seq land back on `end`; an attach
    // `since` a seq resumes the stream itself and never gets it.
    if since.is_none() && end > 0 {
        let restore = inner.screen.restore().into_bytes();
        out.send(&Frame::Data {
            id: s.id.clone(),
            seq: end.saturating_sub(restore.len() as u64),
            bytes: restore,
        });
    }
    if inner.alive {
        inner.subscribers.insert(conn, out.clone());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(name: &str) -> State {
        let dir =
            std::env::temp_dir().join(format!("perchd-storage-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("history")).unwrap();
        State {
            dir,
            sessions: Mutex::new(HashMap::new()),
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
        );
        assert!(result.unwrap_err().contains("no process started"));
        assert!(state.sessions.lock().unwrap().is_empty());
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
            writer: Mutex::new(None),
            master: Mutex::new(None),
            inner: Mutex::new(Inner {
                seq: 0,
                log_start: 0,
                // A real failing write, portable to macOS without /dev/full.
                log: Some(File::open(&path).unwrap()),
                history_error: None,
                screen: crate::screen::Screen::new(80, 24),
                cols: 80,
                rows: 24,
                alive: true,
                exit_code: None,
                subscribers: HashMap::new(),
            }),
        };
        pump_output(
            &state.dir,
            &session,
            Box::new(io::Cursor::new(b"still running")),
        );
        let inner = session.inner.lock().unwrap();
        assert!(inner.alive);
        assert_eq!(inner.seq, 13);
        assert_eq!(inner.log_start, 13);
        assert!(inner
            .history_error
            .as_ref()
            .unwrap()
            .contains("Execution continues"));
        assert!(inner.screen.screen().contents().contains("still running"));
        drop(inner);
        // Even if truncating the old log also failed, daemon restart cannot
        // reinterpret old bytes under a new offset.
        fs::write(&path, b"stale bytes").unwrap();
        let restored = load_sessions(&state.dir);
        assert_eq!(restored["shell"].inner.lock().unwrap().seq, 13);
        // The next actual output retries storage after a user repairs/free space.
        pump_output(
            &state.dir,
            &session,
            Box::new(io::Cursor::new(b"after repair")),
        );
        let inner = session.inner.lock().unwrap();
        assert_eq!(inner.log_start, 13);
        assert_eq!(fs::read(&path).unwrap(), b"after repair");
        assert!(
            inner.history_error.is_some(),
            "earlier lost output stays disclosed"
        );
        drop(inner);
        let restored = load_sessions(&state.dir);
        assert_eq!(restored["shell"].inner.lock().unwrap().seq, 25);
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

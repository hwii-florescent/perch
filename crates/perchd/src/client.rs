//! Blocking client for the daemon protocol.
//!
//! One [`Client`] multiplexes every session over a single stream. Transport is
//! any `Read` + `Write` pair: a local unix socket, or a remote `perchd connect`
//! reached through ssh stdio. A background thread routes replies to callers and
//! output to [`AttachReader`]s.

use crate::proto::{self, *};
use std::collections::HashMap;
use std::io::{self, Read, Write};
use std::os::unix::net::UnixStream;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Condvar, Mutex};
use std::time::{Duration, Instant};

const CALL_TIMEOUT: Duration = Duration::from_secs(15);

#[derive(Debug)]
pub enum Error {
    Io(io::Error),
    /// The daemon refused the request; the string is its error code/message
    /// (see [`ERR_EXISTS`], [`ERR_NOT_FOUND`]).
    Server(String),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Io(e) => write!(f, "perchd: {e}"),
            Error::Server(e) => write!(f, "perchd: {e}"),
        }
    }
}
impl std::error::Error for Error {}
impl From<io::Error> for Error {
    fn from(e: io::Error) -> Self {
        Error::Io(e)
    }
}

impl Error {
    pub fn is(&self, code: &str) -> bool {
        matches!(self, Error::Server(e) if e == code)
    }
}

/// Why an attachment's stream ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AttachEnd {
    /// The process exited with this code.
    Exited(i32),
    /// This client detached.
    Detached,
    /// The daemon dropped a subscriber that fell too far behind.
    Dropped,
    /// The connection to the daemon was lost. The process may well still be
    /// running — this is not evidence of exit.
    Disconnected,
}

#[derive(Default)]
struct EndState {
    end: Mutex<Option<AttachEnd>>,
    cv: Condvar,
}

impl EndState {
    fn set(&self, end: AttachEnd) {
        let mut slot = self.end.lock().unwrap();
        if slot.is_none() {
            *slot = Some(end);
        }
        self.cv.notify_all();
    }
}

struct Sink {
    data: mpsc::Sender<Vec<u8>>,
    end: Arc<EndState>,
    next_seq: Arc<AtomicU64>,
}

struct Inner {
    writer: Mutex<Box<dyn Write + Send>>,
    next_rid: AtomicU64,
    pending: Mutex<HashMap<u64, mpsc::Sender<Result<serde_json::Value, Error>>>>,
    sinks: Mutex<HashMap<String, Sink>>,
    closed: AtomicBool,
}

#[derive(Clone)]
pub struct Client {
    inner: Arc<Inner>,
}

impl Client {
    pub fn connect(socket: &Path) -> Result<Self, Error> {
        let stream = UnixStream::connect(socket)?;
        let reader = stream.try_clone()?;
        let client = Self::from_transport(reader, stream);
        client.hello()?;
        Ok(client)
    }

    /// Connect, starting the daemon with `spawn` if nothing answers. `spawn`
    /// must return a command that runs `perchd serve` for `dir`; it is started
    /// detached in its own session so it outlives the caller.
    pub fn connect_or_spawn(dir: &Path, spawn: impl FnOnce() -> Command) -> Result<Self, Error> {
        let socket = crate::server::socket_path(dir);
        if let Ok(client) = Self::connect(&socket) {
            return Ok(client);
        }
        std::fs::create_dir_all(dir)?;
        let log = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(dir.join("daemon.log"))?;
        let mut cmd = spawn();
        cmd.stdin(Stdio::null())
            .stdout(log.try_clone()?)
            .stderr(log);
        use std::os::unix::process::CommandExt;
        // SAFETY: setsid is async-signal-safe; it detaches the daemon from
        // our session so our exit (or a terminal hangup) never reaches it.
        unsafe {
            cmd.pre_exec(|| {
                libc::setsid();
                Ok(())
            });
        }
        let mut child = cmd.spawn()?;
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            if let Ok(client) = Self::connect(&socket) {
                // Reap it in the background: it is a detached daemon now.
                std::thread::spawn(move || child.wait());
                return Ok(client);
            }
            if let Ok(Some(status)) = child.try_wait() {
                // Lost a race with another starter? Its daemon may be up.
                if let Ok(client) = Self::connect(&socket) {
                    return Ok(client);
                }
                return Err(Error::Io(io::Error::other(format!(
                    "perchd exited during startup ({status})"
                ))));
            }
            if Instant::now() > deadline {
                return Err(Error::Io(io::Error::new(
                    io::ErrorKind::TimedOut,
                    "perchd did not start",
                )));
            }
            std::thread::sleep(Duration::from_millis(20));
        }
    }

    pub fn from_transport(
        reader: impl Read + Send + 'static,
        writer: impl Write + Send + 'static,
    ) -> Self {
        let inner = Arc::new(Inner {
            writer: Mutex::new(Box::new(writer)),
            next_rid: AtomicU64::new(1),
            pending: Mutex::new(HashMap::new()),
            sinks: Mutex::new(HashMap::new()),
            closed: AtomicBool::new(false),
        });
        let routed = inner.clone();
        std::thread::spawn(move || route(routed, reader));
        Self { inner }
    }

    pub fn is_closed(&self) -> bool {
        self.inner.closed.load(Ordering::SeqCst)
    }

    fn send(&self, frame: &Frame) -> Result<(), Error> {
        let mut w = self.inner.writer.lock().unwrap();
        proto::write_frame(&mut *w, frame)?;
        w.flush()?;
        Ok(())
    }

    fn call(&self, req: Request) -> Result<serde_json::Value, Error> {
        if self.is_closed() {
            return Err(Error::Io(io::Error::new(
                io::ErrorKind::NotConnected,
                "daemon connection closed",
            )));
        }
        let rid = self.inner.next_rid.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = mpsc::channel();
        self.inner.pending.lock().unwrap().insert(rid, tx);
        let json = serde_json::to_vec(&ClientMsg { rid, req }).unwrap();
        if let Err(e) = self.send(&Frame::Json(json)) {
            self.inner.pending.lock().unwrap().remove(&rid);
            return Err(e);
        }
        match rx.recv_timeout(CALL_TIMEOUT) {
            Ok(result) => result,
            Err(_) => {
                self.inner.pending.lock().unwrap().remove(&rid);
                Err(Error::Io(io::Error::new(
                    io::ErrorKind::TimedOut,
                    "daemon did not reply",
                )))
            }
        }
    }

    fn call_as<T: serde::de::DeserializeOwned>(&self, req: Request) -> Result<T, Error> {
        let value = self.call(req)?;
        serde_json::from_value(value)
            .map_err(|e| Error::Io(io::Error::new(io::ErrorKind::InvalidData, e)))
    }

    fn hello(&self) -> Result<(), Error> {
        let reply = self.call(Request::Hello {
            version: PROTOCOL_VERSION,
        })?;
        match reply.get("version").and_then(|v| v.as_u64()) {
            Some(v) if v == PROTOCOL_VERSION as u64 => Ok(()),
            other => Err(Error::Server(format!(
                "protocol mismatch: daemon speaks {other:?}"
            ))),
        }
    }

    pub fn create(
        &self,
        id: &str,
        argv: Vec<String>,
        cwd: Option<String>,
        env: Vec<(String, String)>,
        cols: u16,
        rows: u16,
    ) -> Result<Created, Error> {
        self.call_as(Request::Create {
            id: id.into(),
            argv,
            cwd,
            env,
            cols,
            rows,
        })
    }

    /// Subscribe to `id`. The reader yields replay from `since` (default: the
    /// recent tail) and then live output, and returns EOF when the stream ends;
    /// the waiter says why.
    pub fn attach(
        &self,
        id: &str,
        since: Option<u64>,
    ) -> Result<(Attached, AttachReader, AttachWaiter), Error> {
        let (data_tx, data_rx) = mpsc::channel();
        let end = Arc::new(EndState::default());
        let next_seq = Arc::new(AtomicU64::new(0));
        // Registered before the request: replay frames can arrive right
        // behind the reply.
        let previous = self.inner.sinks.lock().unwrap().insert(
            id.to_string(),
            Sink {
                data: data_tx,
                end: end.clone(),
                next_seq: next_seq.clone(),
            },
        );
        if let Some(previous) = previous {
            previous.end.set(AttachEnd::Detached);
        }
        let attached: Attached = match self.call_as(Request::Attach {
            id: id.into(),
            since,
        }) {
            Ok(a) => a,
            Err(e) => {
                self.drop_sink(id, &end);
                return Err(e);
            }
        };
        // Replay frames may already have advanced it; never move it back.
        next_seq.fetch_max(attached.start, Ordering::SeqCst);
        if !attached.alive {
            // No live subscription exists; the stream is only the replay. The
            // replay frames are already queued behind the reply, so end the
            // stream once they've been routed.
            let client = self.clone();
            let id = id.to_string();
            let end_seq = attached.end;
            let code = attached.exit_code.unwrap_or(-1);
            let (seq, end_state) = (next_seq.clone(), end.clone());
            std::thread::spawn(move || {
                let deadline = Instant::now() + CALL_TIMEOUT;
                while seq.load(Ordering::SeqCst) < end_seq
                    && Instant::now() < deadline
                    && !client.is_closed()
                {
                    std::thread::sleep(Duration::from_millis(5));
                }
                client.drop_sink(&id, &end_state);
                end_state.set(AttachEnd::Exited(code));
            });
        }
        Ok((
            attached,
            AttachReader {
                rx: data_rx,
                buf: Vec::new(),
                pos: 0,
            },
            AttachWaiter { end, next_seq },
        ))
    }

    fn drop_sink(&self, id: &str, end: &Arc<EndState>) {
        let mut sinks = self.inner.sinks.lock().unwrap();
        if sinks.get(id).is_some_and(|s| Arc::ptr_eq(&s.end, end)) {
            sinks.remove(id);
        }
    }

    /// Stop receiving `id`'s output. The process keeps running.
    pub fn detach(&self, id: &str) -> Result<(), Error> {
        if let Some(sink) = self.inner.sinks.lock().unwrap().remove(id) {
            sink.end.set(AttachEnd::Detached);
        }
        self.call(Request::Detach { id: id.into() }).map(|_| ())
    }

    pub fn input(&self, id: &str, bytes: &[u8]) -> Result<(), Error> {
        self.send(&Frame::Data {
            id: id.into(),
            seq: 0,
            bytes: bytes.to_vec(),
        })
    }

    pub fn resize(&self, id: &str, cols: u16, rows: u16) -> Result<(), Error> {
        self.call(Request::Resize {
            id: id.into(),
            cols,
            rows,
        })
        .map(|_| ())
    }

    pub fn kill(&self, id: &str, signal: i32) -> Result<(), Error> {
        self.call(Request::Kill {
            id: id.into(),
            signal,
        })
        .map(|_| ())
    }

    pub fn remove(&self, id: &str) -> Result<(), Error> {
        self.call(Request::Remove { id: id.into() }).map(|_| ())
    }

    pub fn list(&self) -> Result<Vec<SessionInfo>, Error> {
        self.call_as(Request::List)
    }

    pub fn session(&self, id: &str) -> Result<Option<SessionInfo>, Error> {
        Ok(self.list()?.into_iter().find(|s| s.id == id))
    }

    pub fn snapshot(&self, id: &str) -> Result<Snapshot, Error> {
        self.call_as(Request::Snapshot { id: id.into() })
    }

    pub fn health(&self) -> Result<Health, Error> {
        self.call_as(Request::Health)
    }
}

fn route(inner: Arc<Inner>, reader: impl Read) {
    let mut reader = io::BufReader::new(reader);
    while let Ok(Some(frame)) = proto::read_frame(&mut reader) {
        match frame {
            Frame::Data { id, seq, bytes } => {
                if let Some(sink) = inner.sinks.lock().unwrap().get(&id) {
                    sink.next_seq
                        .store(seq + bytes.len() as u64, Ordering::SeqCst);
                    let _ = sink.data.send(bytes);
                }
            }
            Frame::Json(json) => match serde_json::from_slice::<ServerMsg>(&json) {
                Ok(ServerMsg::Reply { rid, error, data }) => {
                    if let Some(tx) = inner.pending.lock().unwrap().remove(&rid) {
                        let _ = tx.send(match error {
                            Some(e) => Err(Error::Server(e)),
                            None => Ok(data),
                        });
                    }
                }
                Ok(ServerMsg::Exit { id, code }) => {
                    if let Some(sink) = inner.sinks.lock().unwrap().remove(&id) {
                        sink.end.set(AttachEnd::Exited(code));
                    }
                }
                Ok(ServerMsg::Dropped { id }) => {
                    if let Some(sink) = inner.sinks.lock().unwrap().remove(&id) {
                        sink.end.set(AttachEnd::Dropped);
                    }
                }
                Err(_) => {}
            },
        }
    }
    inner.closed.store(true, Ordering::SeqCst);
    for (_, tx) in inner.pending.lock().unwrap().drain() {
        let _ = tx.send(Err(Error::Io(io::Error::new(
            io::ErrorKind::NotConnected,
            "daemon connection closed",
        ))));
    }
    for (_, sink) in inner.sinks.lock().unwrap().drain() {
        sink.end.set(AttachEnd::Disconnected);
    }
}

/// Output of one attachment. Returns EOF when the attachment ends.
pub struct AttachReader {
    rx: mpsc::Receiver<Vec<u8>>,
    buf: Vec<u8>,
    pos: usize,
}

impl Read for AttachReader {
    fn read(&mut self, out: &mut [u8]) -> io::Result<usize> {
        if self.pos >= self.buf.len() {
            match self.rx.recv() {
                Ok(chunk) => {
                    self.buf = chunk;
                    self.pos = 0;
                }
                Err(_) => return Ok(0),
            }
        }
        let n = out.len().min(self.buf.len() - self.pos);
        out[..n].copy_from_slice(&self.buf[self.pos..self.pos + n]);
        self.pos += n;
        Ok(n)
    }
}

/// Waits for an attachment to end.
pub struct AttachWaiter {
    end: Arc<EndState>,
    next_seq: Arc<AtomicU64>,
}

impl AttachWaiter {
    pub fn wait(&self) -> AttachEnd {
        let mut slot = self.end.end.lock().unwrap();
        loop {
            if let Some(end) = *slot {
                return end;
            }
            slot = self.end.cv.wait(slot).unwrap();
        }
    }

    pub fn try_end(&self) -> Option<AttachEnd> {
        *self.end.end.lock().unwrap()
    }

    /// Seq of the next byte not yet received — pass as `since` to resume.
    pub fn next_seq(&self) -> u64 {
        self.next_seq.load(Ordering::SeqCst)
    }
}

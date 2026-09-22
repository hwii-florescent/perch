//! Wire format shared by the daemon and its clients.
//!
//! A frame is `[u32 BE length][u8 kind][body]`, where `length` counts the kind
//! byte and the body. `kind` is `J` (a JSON [`ClientMsg`] or [`ServerMsg`]) or
//! `D` (terminal bytes: `[u64 BE seq][u16 BE id length][id][bytes]`). Output
//! stays raw bytes so a busy TUI never pays for JSON escaping; `seq` is the byte
//! offset of the chunk's first byte in the session's whole output stream.
//! Client → server `D` frames are input, and their `seq` is ignored.

use serde::{Deserialize, Serialize};
use std::io::{self, Read, Write};

/// Bumped on any incompatible wire change; the socket name carries it.
pub const PROTOCOL_VERSION: u32 = 1;

/// Upper bound on one frame, so a corrupt length can't make a reader allocate
/// gigabytes. Output is chunked well below this.
pub const MAX_FRAME: usize = 4 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq)]
pub enum Frame {
    Json(Vec<u8>),
    Data {
        id: String,
        seq: u64,
        bytes: Vec<u8>,
    },
}

pub fn write_frame(w: &mut impl Write, frame: &Frame) -> io::Result<()> {
    w.write_all(&encode(frame))
}

pub fn encode(frame: &Frame) -> Vec<u8> {
    let mut body = Vec::new();
    match frame {
        Frame::Json(json) => {
            body.push(b'J');
            body.extend_from_slice(json);
        }
        Frame::Data { id, seq, bytes } => {
            body.push(b'D');
            body.extend_from_slice(&seq.to_be_bytes());
            body.extend_from_slice(&(id.len() as u16).to_be_bytes());
            body.extend_from_slice(id.as_bytes());
            body.extend_from_slice(bytes);
        }
    }
    let mut out = Vec::with_capacity(4 + body.len());
    out.extend_from_slice(&(body.len() as u32).to_be_bytes());
    out.extend_from_slice(&body);
    out
}

/// `Ok(None)` on a clean EOF at a frame boundary.
pub fn read_frame(r: &mut impl Read) -> io::Result<Option<Frame>> {
    let mut len = [0u8; 4];
    match r.read_exact(&mut len) {
        Ok(()) => {}
        Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e),
    }
    let len = u32::from_be_bytes(len) as usize;
    if len == 0 || len > MAX_FRAME {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "bad frame length",
        ));
    }
    let mut body = vec![0u8; len];
    r.read_exact(&mut body)?;
    let invalid = || io::Error::new(io::ErrorKind::InvalidData, "bad data frame");
    match body[0] {
        b'J' => Ok(Some(Frame::Json(body[1..].to_vec()))),
        b'D' => {
            if body.len() < 11 {
                return Err(invalid());
            }
            let seq = u64::from_be_bytes(body[1..9].try_into().unwrap());
            let id_len = u16::from_be_bytes(body[9..11].try_into().unwrap()) as usize;
            let id = body.get(11..11 + id_len).ok_or_else(invalid)?;
            let id = String::from_utf8(id.to_vec()).map_err(|_| invalid())?;
            Ok(Some(Frame::Data {
                id,
                seq,
                bytes: body[11 + id_len..].to_vec(),
            }))
        }
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "unknown frame kind",
        )),
    }
}

/// Client → server. Every request carries a `rid` the reply echoes.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClientMsg {
    pub rid: u64,
    #[serde(flatten)]
    pub req: Request,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum Request {
    Hello {
        version: u32,
    },
    /// Spawn `argv` in a new PTY. `env` is applied on top of the daemon's own
    /// environment. Fails with [`ERR_EXISTS`] if `id` is live.
    Create {
        id: String,
        argv: Vec<String>,
        cwd: Option<String>,
        env: Vec<(String, String)>,
        cols: u16,
        rows: u16,
    },
    /// Subscribe to `id`'s output. The reply is followed by replay frames
    /// from `since` (default: the last [`DEFAULT_REPLAY`] bytes), then live
    /// output — no gap, no duplicate.
    Attach {
        id: String,
        since: Option<u64>,
    },
    Detach {
        id: String,
    },
    Resize {
        id: String,
        cols: u16,
        rows: u16,
    },
    /// Signal the session's process group.
    Kill {
        id: String,
        signal: i32,
    },
    /// Forget an exited session and delete its history.
    Remove {
        id: String,
    },
    List,
    Snapshot {
        id: String,
    },
    Health,
}

/// Default replay window for an attach with no `since`.
pub const DEFAULT_REPLAY: u64 = 512 * 1024;

pub const ERR_EXISTS: &str = "exists";
pub const ERR_NOT_FOUND: &str = "not_found";

/// Server → client.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "t", rename_all = "snake_case")]
pub enum ServerMsg {
    Reply {
        rid: u64,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        error: Option<String>,
        #[serde(default)]
        data: serde_json::Value,
    },
    /// The session's process exited. Sent to every subscriber.
    Exit { id: String, code: i32 },
    /// The server dropped this subscription (the client fell too far behind).
    /// Reattach with `since` = the next unseen seq to resume without loss.
    Dropped { id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Created {
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Attached {
    /// First seq the replay starts at (may be later than `since` if history
    /// was trimmed).
    pub start: u64,
    /// Seq where live output begins.
    pub end: u64,
    pub alive: bool,
    pub exit_code: Option<i32>,
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SessionInfo {
    pub id: String,
    pub pid: Option<u32>,
    pub alive: bool,
    pub exit_code: Option<i32>,
    pub argv: Vec<String>,
    pub cwd: Option<String>,
    pub cols: u16,
    pub rows: u16,
    pub seq: u64,
    pub created_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Snapshot {
    pub text: String,
    pub title: String,
    pub cursor_row: u16,
    pub cursor_col: u16,
    pub alternate_screen: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Health {
    pub version: u32,
    pub pid: u32,
    pub sessions: usize,
    pub alive: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frames_round_trip() {
        let frames = [
            Frame::Json(br#"{"rid":1,"op":"list"}"#.to_vec()),
            Frame::Data {
                id: "shell-1".into(),
                seq: 42,
                bytes: b"\x1b[31mhi\xe2\x94".to_vec(),
            },
            Frame::Data {
                id: String::new(),
                seq: 0,
                bytes: Vec::new(),
            },
        ];
        let mut buf = Vec::new();
        for f in &frames {
            write_frame(&mut buf, f).unwrap();
        }
        let mut r = &buf[..];
        for f in &frames {
            assert_eq!(read_frame(&mut r).unwrap().as_ref(), Some(f));
        }
        assert_eq!(read_frame(&mut r).unwrap(), None);
    }

    #[test]
    fn rejects_oversized_length() {
        let mut bad = &(MAX_FRAME as u32 + 1).to_be_bytes()[..];
        assert!(read_frame(&mut bad).is_err());
    }

    #[test]
    fn requests_are_tagged_by_op() {
        let msg = ClientMsg {
            rid: 7,
            req: Request::Kill {
                id: "a".into(),
                signal: 15,
            },
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert_eq!(json, r#"{"rid":7,"op":"kill","id":"a","signal":15}"#);
        assert_eq!(serde_json::from_str::<ClientMsg>(&json).unwrap(), msg);
    }
}

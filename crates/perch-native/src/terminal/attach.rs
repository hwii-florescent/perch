//! A session's terminal, attached from a thread of its own: the connection to the core is async
//! and the view lives on GPUI's thread, so the two talk over channels, in bytes.
//!
//! The thread attaches once. When the socket drops it says so and stops: reopening would start
//! the session again if the core had lost it, and a view cannot tell a dropped socket from a
//! dead shell. Dropping the view's sender detaches (the shell keeps running in the core).

use crate::client::{Core, Terminal};
use futures::channel::mpsc::{unbounded, UnboundedReceiver, UnboundedSender};
use futures::StreamExt;
use perch_core::agent_fleet::AgentState;
use perch_core::iterm_profile::TerminalProfile;
use perch_core::protocol::ServerMessage;
use perch_core::protocol::SettingsData;

/// What the view asks of the core.
#[derive(Debug, PartialEq, Eq)]
pub enum ToCore {
    /// Bytes for the shell's input.
    Input(Vec<u8>),
    /// Size the shell's terminal. Only the holder of the resize lease changes it.
    Resize(u16, u16),
    /// Take the input and the size from whichever view holds them.
    TakeControl,
    /// End the shell. Needs the input lease.
    Kill,
}

/// What the core says about the terminal.
#[derive(Debug)]
pub enum FromCore {
    /// Attached. `replay` repaints the screen and its history; `input` and `resize` say whether
    /// this connection holds the leases that let it type and size the shell.
    Attached {
        replay: String,
        input: bool,
        resize: bool,
        agent: Option<AgentInfo>,
    },
    /// The user's terminal profile, as the core sent it on connecting (`server.info`).
    Profile(Option<TerminalProfile>),
    /// The settings, as the core sent them on connecting and sends them again when they change.
    Settings(Box<SettingsData>),
    /// The agent's lifecycle changed, or another view took a lease this one held.
    Agent(AgentInfo),
    /// Live output, in order after the replay.
    Output(String),
    /// The shell ended; the core said so.
    Exited(i32),
    /// Could not attach.
    Failed(String),
    /// The connection to the core dropped after attaching. The shell is not known to have ended.
    Disconnected(String),
}

/// What the core says about the agent in this terminal and who may type and size it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AgentInfo {
    pub state: AgentState,
    /// This connection holds the lease that lets it type.
    pub input: bool,
    /// This connection holds the lease that lets it size the shell.
    pub resize: bool,
    /// Another view holds the input lease.
    pub input_elsewhere: bool,
    /// A paired device (a phone), not this computer, holds the size.
    pub resize_on_device: bool,
}

impl AgentInfo {
    fn of(terminal: &Terminal) -> Self {
        let status = &terminal.status;
        Self {
            state: status.state,
            input: terminal.owns_input(),
            resize: terminal.owns_resize(),
            input_elsewhere: !terminal.owns_input() && status.input_owner.is_some(),
            // "local" is the device id of this computer's own windows.
            resize_on_device: !terminal.owns_resize()
                && status
                    .resize_owner
                    .as_ref()
                    .is_some_and(|o| o.device_id != "local"),
        }
    }
}

/// Attach `session_id`'s terminal of `provider` at `cols` x `rows` (the size a new shell
/// starts at). Returns the view's end of the channels.
pub fn attach(
    core: Core,
    session_id: String,
    provider: String,
    cols: u16,
    rows: u16,
) -> (UnboundedSender<ToCore>, UnboundedReceiver<FromCore>) {
    let (to_core, commands) = unbounded();
    let (events, from_core) = unbounded();
    let spawned = std::thread::Builder::new()
        .name("perch-terminal".into())
        .spawn({
            let events = events.clone();
            move || {
                let runtime = match tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                {
                    Ok(runtime) => runtime,
                    Err(error) => {
                        let _ = events.unbounded_send(FromCore::Failed(error.to_string()));
                        return;
                    }
                };
                runtime.block_on(run(
                    core, session_id, provider, cols, rows, commands, events,
                ));
            }
        });
    if let Err(error) = spawned {
        let _ = events.unbounded_send(FromCore::Failed(error.to_string()));
    }
    (to_core, from_core)
}

async fn run(
    core: Core,
    session_id: String,
    provider: String,
    cols: u16,
    rows: u16,
    mut commands: UnboundedReceiver<ToCore>,
    events: UnboundedSender<FromCore>,
) {
    let attached = async {
        let mut connection = core.connect().await?;
        let terminal = connection
            .open_terminal_as(&session_id, &provider, cols, rows)
            .await?;
        anyhow::Ok((connection, terminal))
    }
    .await;
    let (mut connection, mut terminal) = match attached {
        Ok(attached) => attached,
        Err(error) => {
            let _ = events.unbounded_send(FromCore::Failed(format!("{error:#}")));
            return;
        }
    };
    let attached = FromCore::Attached {
        replay: terminal.replay.clone(),
        input: terminal.owns_input(),
        resize: terminal.owns_resize(),
        agent: Some(AgentInfo::of(&terminal)),
    };
    if events.unbounded_send(attached).is_err() {
        let _ = connection.release_terminal(&terminal).await;
        return;
    }
    let dropped = loop {
        tokio::select! {
            message = connection.next() => match message {
                Ok(ServerMessage::TerminalData { terminal_id, data }) if terminal_id == terminal.id => {
                    if events.unbounded_send(FromCore::Output(data)).is_err() {
                        break None;
                    }
                }
                Ok(ServerMessage::TerminalExit { terminal_id, code }) if terminal_id == terminal.id => {
                    if events.unbounded_send(FromCore::Exited(code)).is_err() {
                        break None;
                    }
                }
                Ok(ServerMessage::ServerInfo { terminal_profile, .. }) => {
                    if events.unbounded_send(FromCore::Profile(terminal_profile)).is_err() {
                        break None;
                    }
                }
                Ok(ServerMessage::SettingsCurrent { settings }) => {
                    if events.unbounded_send(FromCore::Settings(Box::new(settings))).is_err() {
                        break None;
                    }
                }
                Ok(ServerMessage::AgentLifecycleChanged { host_id, status }) if host_id == "local" => {
                    terminal.follow_owners(&status);
                    if events.unbounded_send(FromCore::Agent(AgentInfo::of(&terminal))).is_err() {
                        break None;
                    }
                }
                Ok(_) => {}
                Err(error) => break Some(format!("{error:#}")),
            },
            command = commands.next() => {
                let sent = match command {
                    // The view is gone: stop watching.
                    None => break None,
                    Some(ToCore::Input(bytes)) => {
                        // ponytail: the core takes input as a JSON string, so a byte that is not
                        // UTF-8 (an X10 mouse report past column 95) becomes U+FFFD. Programs
                        // that ask for the mouse nearly always ask for SGR coordinates.
                        connection
                            .terminal_input(&terminal, &String::from_utf8_lossy(&bytes))
                            .await
                    }
                    Some(ToCore::Resize(cols, rows)) => {
                        connection.terminal_resize(&terminal, cols, rows).await
                    }
                    Some(ToCore::TakeControl) => {
                        let taken = connection.take_control(&mut terminal).await;
                        if taken.is_ok()
                            && events.unbounded_send(FromCore::Agent(AgentInfo::of(&terminal))).is_err()
                        {
                            break None;
                        }
                        taken
                    }
                    Some(ToCore::Kill) => connection.terminal_kill(&terminal).await,
                };
                if let Err(error) = sent {
                    break Some(format!("{error:#}"));
                }
            }
        }
    };
    match dropped {
        Some(reason) => {
            let _ = events.unbounded_send(FromCore::Disconnected(reason));
        }
        None => {
            let _ = connection.release_terminal(&terminal).await;
        }
    }
}

/// A piece of output: text for the terminal, or the PTY's new size.
#[derive(Debug, PartialEq, Eq)]
pub enum Piece<'a> {
    Text(&'a str),
    /// `ESC [ 8 ; rows ; cols t`, which the core puts in the stream, in order with the output,
    /// each time the shell's terminal is resized, and at the start of a replay. It tells the
    /// terminal to take that size; it is not for the emulator.
    Size {
        cols: u16,
        rows: u16,
    },
}

/// Split output around the core's size markers.
pub fn split_size_markers(data: &str) -> Vec<Piece<'_>> {
    const PREFIX: &str = "\x1b[8;";
    let mut pieces = Vec::new();
    let mut rest = data;
    let mut text_from = 0;
    let mut at = 0;
    while let Some(found) = rest[at..].find(PREFIX) {
        let start = at + found;
        match parse_marker(&rest[start..]) {
            Some((cols, rows, len)) => {
                if start > text_from {
                    pieces.push(Piece::Text(&rest[text_from..start]));
                }
                pieces.push(Piece::Size { cols, rows });
                at = start + len;
                text_from = at;
            }
            None => at = start + 1,
        }
    }
    rest = &rest[text_from..];
    if !rest.is_empty() {
        pieces.push(Piece::Text(rest));
    }
    pieces
}

/// `(cols, rows, length)` of a marker at the start of `text`.
fn parse_marker(text: &str) -> Option<(u16, u16, usize)> {
    let body = text.strip_prefix("\x1b[8;")?;
    let (rows, after_rows) = number(body)?;
    let after_rows = after_rows.strip_prefix(';')?;
    let (cols, after_cols) = number(after_rows)?;
    let after_cols = after_cols.strip_prefix('t')?;
    Some((cols, rows, text.len() - after_cols.len()))
}

fn number(text: &str) -> Option<(u16, &str)> {
    let end = text
        .find(|c: char| !c.is_ascii_digit())
        .unwrap_or(text.len());
    Some((text[..end].parse().ok()?, &text[end..]))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn size_markers_are_cut_out_wherever_they_sit() {
        assert_eq!(split_size_markers("plain"), vec![Piece::Text("plain")]);
        assert_eq!(split_size_markers(""), Vec::<Piece>::new());
        assert_eq!(
            split_size_markers("\x1b[8;30;100t"),
            vec![Piece::Size {
                cols: 100,
                rows: 30
            }]
        );
        assert_eq!(
            split_size_markers("\x1b[8;24;80tfirst\x1b[8;30;100tsecond\x1b[1mthird"),
            vec![
                Piece::Size { cols: 80, rows: 24 },
                Piece::Text("first"),
                Piece::Size {
                    cols: 100,
                    rows: 30
                },
                Piece::Text("second\x1b[1mthird"),
            ]
        );
    }

    #[test]
    fn things_that_only_look_like_a_marker_stay_text() {
        for text in [
            "\x1b[8;30;100",
            "\x1b[8;30t",
            "\x1b[8;;100t",
            "\x1b[8;99999;100t",
            "\x1b[8;a;b t",
            "x\x1b[8",
        ] {
            assert_eq!(
                split_size_markers(text),
                vec![Piece::Text(text)],
                "{text:?}"
            );
        }
        // A broken one doesn't hide the real one after it.
        assert_eq!(
            split_size_markers("\x1b[8;3\x1b[8;5;6tz"),
            vec![
                Piece::Text("\x1b[8;3"),
                Piece::Size { cols: 6, rows: 5 },
                Piece::Text("z"),
            ]
        );
    }
}

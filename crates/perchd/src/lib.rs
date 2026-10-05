//! perchd — the perch terminal daemon. See `docs/ARCHITECTURE.md` §3.

pub mod client;
pub mod proto;
pub mod screen;
pub mod server;

use std::path::Path;
use std::process::Command;

/// Lift the open-file soft limit to the hard one. Apps launched from the
/// Dock get 256, and every live terminal costs four (PTY master, reader,
/// writer, history log), so the default caps perch at a few dozen shells.
/// Shells inherit it, as they would from a terminal app.
pub fn raise_fd_limit() {
    // SAFETY: plain syscalls on a local, fully initialised struct.
    unsafe {
        let mut limit: libc::rlimit = std::mem::zeroed();
        if libc::getrlimit(libc::RLIMIT_NOFILE, &mut limit) != 0 {
            return;
        }
        // macOS refuses a soft limit above OPEN_MAX (10240) even when the
        // hard limit is unlimited.
        let want = limit.rlim_max.min(10240);
        if limit.rlim_cur < want {
            limit.rlim_cur = want;
            libc::setrlimit(libc::RLIMIT_NOFILE, &limit);
        }
    }
}

/// Parse `serve`/`connect`/`version` arguments and run. Shared by the `perchd`
/// binary and `perch-core __perchd`, so both expose the same interface.
/// `exe_prefix` is the argv that re-runs this entry point (e.g. `["perch-core",
/// "__perchd"]`), used when `connect` has to start a daemon.
pub fn cli_main(args: &[String], exe_prefix: Vec<String>) -> i32 {
    raise_fd_limit();
    let mut dir = server::default_dir();
    let mut idle = Some(std::time::Duration::from_secs(60));
    let mut rest = args.iter();
    let cmd = rest.next().map(String::as_str).unwrap_or("");
    while let Some(arg) = rest.next() {
        match arg.as_str() {
            "--dir" => dir = rest.next().map(Into::into).unwrap_or(dir),
            "--idle-exit" => {
                idle = rest
                    .next()
                    .and_then(|s| s.parse().ok())
                    .map(std::time::Duration::from_secs)
            }
            "--no-idle-exit" => idle = None,
            _ => {}
        }
    }
    match cmd {
        "serve" => match server::run(server::Config {
            dir,
            idle_exit: idle,
        }) {
            Ok(()) => 0,
            Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => 0, // already running
            Err(e) => {
                eprintln!("perchd: {e}");
                1
            }
        },
        "connect" => match bridge_stdio(&dir, exe_prefix) {
            Ok(()) => 0,
            Err(e) => {
                eprintln!("perchd: {e}");
                1
            }
        },
        "version" => {
            println!("perchd protocol {}", proto::PROTOCOL_VERSION);
            0
        }
        _ => {
            eprintln!(
                "usage: perchd serve|connect|version [--dir DIR] [--idle-exit SECS|--no-idle-exit]"
            );
            2
        }
    }
}

pub fn spawn_command(exe_prefix: &[String], dir: &Path) -> Command {
    let mut cmd = Command::new(&exe_prefix[0]);
    cmd.args(&exe_prefix[1..])
        .arg("serve")
        .arg("--dir")
        .arg(dir);
    cmd
}

/// `perchd connect`: splice stdin/stdout onto the daemon socket, starting the
/// daemon first if needed. This is the remote transport: `ssh host perchd
/// connect` gives the local client the same byte stream a socket would.
fn bridge_stdio(dir: &Path, exe_prefix: Vec<String>) -> std::io::Result<()> {
    client::Client::connect_or_spawn(dir, || spawn_command(&exe_prefix, dir))
        .map_err(|e| std::io::Error::other(e.to_string()))?;
    let sock = std::os::unix::net::UnixStream::connect(server::socket_path(dir))?;
    let mut to_sock = sock.try_clone()?;
    let mut from_sock = sock;
    let up = std::thread::spawn(move || {
        let _ = std::io::copy(&mut std::io::stdin().lock(), &mut to_sock);
        let _ = to_sock.shutdown(std::net::Shutdown::Write);
    });
    // Not io::copy: stdout is line-buffered and frames rarely end in '\n', so
    // every chunk must be flushed or replies sit in the buffer.
    let mut out = std::io::stdout().lock();
    let mut buf = vec![0u8; 64 * 1024];
    loop {
        let n = std::io::Read::read(&mut from_sock, &mut buf)?;
        if n == 0 {
            break;
        }
        std::io::Write::write_all(&mut out, &buf[..n])?;
        std::io::Write::flush(&mut out)?;
    }
    drop(up);
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn raises_a_dock_sized_fd_limit() {
        let current = || unsafe {
            let mut limit: libc::rlimit = std::mem::zeroed();
            libc::getrlimit(libc::RLIMIT_NOFILE, &mut limit);
            limit
        };
        let mut limit = current();
        limit.rlim_cur = 256;
        assert_eq!(unsafe { libc::setrlimit(libc::RLIMIT_NOFILE, &limit) }, 0);
        super::raise_fd_limit();
        assert_eq!(current().rlim_cur, limit.rlim_max.min(10240));
    }
}

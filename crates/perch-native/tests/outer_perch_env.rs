//! A window test run from inside a Perch terminal keeps that terminal's shell integration out of
//! its own shells. The outer session's `PERCH_USER_ZDOTDIR` names a folder whose `.zshrc` notes
//! that it ran and starts a process in a process group of its own, as Homebrew's background
//! download does. A shell of the test's core must not read it: if it did, the note would appear and
//! perchd would rightly halt the teardown's cleanup on the detached group.

mod common;

use common::Rig;

fn main() {
    // What a Perch terminal hands every command run in it. Set before `run`, so the core and the
    // daemon (this executable again) inherit it as they would from `cargo test`.
    if std::env::args().nth(1).is_none() {
        let outer =
            std::env::temp_dir().join(format!("perch-outer-zdotdir-{}", std::process::id()));
        std::fs::create_dir_all(&outer).unwrap();
        std::fs::write(
            outer.join(".zshrc"),
            ": > \"$PERCH_OUTER/sourced\"\n\
             perl -e 'setpgrp(0, 0); sleep 30' &!\n",
        )
        .unwrap();
        std::env::set_var("PERCH_OUTER", &outer);
        std::env::set_var("PERCH_USER_ZDOTDIR", &outer);
        std::env::set_var("ZDOTDIR", &outer);
        std::env::set_var("PERCH_SESSION", "outer-session");
        std::env::set_var("TERM_PROGRAM", "perch");
        std::env::set_var("SHELL", "/bin/zsh");
    }
    common::run("outer_perch_env", shell_ignores_outer_session);
}

fn shell_ignores_outer_session(rig: &mut Rig) {
    let outer = std::path::PathBuf::from(std::env::var_os("PERCH_OUTER").unwrap());
    let ready = rig.scratch.join("ready");
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    let (_, core) = rig.start_core(&runtime);
    runtime.block_on(async {
        let mut connection = core.connect().await.expect("connect");
        let session = connection.create_session(None, None).await.expect("create");
        let terminal = connection
            .open_terminal(&session, 80, 24)
            .await
            .expect("open terminal");
        // The shell reads its startup files before it reads this line.
        let line = format!("touch '{}'\n", ready.display());
        connection
            .terminal_input(&terminal, &line, false)
            .await
            .unwrap();
        common::wait_until("the shell to run a command", || ready.exists()).unwrap();
        connection.release_terminal(&terminal).await.unwrap();
    });
    drop(runtime);
    let sourced = outer.join("sourced").exists();
    let _ = std::fs::remove_dir_all(&outer);
    assert!(
        !sourced,
        "the test's shell read the outer Perch session's .zshrc"
    );
}

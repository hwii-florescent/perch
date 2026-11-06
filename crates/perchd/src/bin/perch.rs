//! The user-facing `perch` command. Agent verbs (`whoami`, `report`, `guide`) talk to the
//! running core as the calling agent (`perchd::agent_cli`); daemon verbs inspect and clean up
//! terminal runtimes without booting a core. `perch daemon <verb>` is the home of the daemon
//! verbs; the bare verbs (`ps`, `list`, `cleanup`, `release`, `serve`, `connect`) remain
//! aliases of it.
fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some(command @ ("whoami" | "report" | "guide")) => {
            std::process::exit(match perchd::agent_cli::run(command, &args[1..]) {
                Ok(()) => 0,
                Err(error) => {
                    eprintln!("perch: {error}");
                    1
                }
            });
        }
        Some("daemon") => std::process::exit(perchd::cli_main(&args[1..], vec!["perchd".into()])),
        _ => std::process::exit(perchd::cli_main(&args, vec!["perchd".into()])),
    }
}

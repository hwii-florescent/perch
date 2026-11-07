//! The user-facing `perch` command. Agent verbs (`whoami`, `report`, `guide`, `spawn`, `suggest`, `list`,
//! `stop`, `send`, `inbox`, `cancel`, `steer`, `interrupt`) talk to the running core as the calling agent (`perchd::agent_cli`); daemon verbs
//! inspect and clean up terminal runtimes without booting a core. `perch daemon <verb>` is the
//! home of the daemon verbs (`list`, `ps`, `cleanup`, `release`, ...); only `ps`, `cleanup` and
//! `release` keep a bare alias. Bare `list` is the agent's own run, and `serve` and `connect`
//! are the daemon's (`perch daemon serve`).
fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some(
            command @ ("whoami" | "report" | "guide" | "spawn" | "suggest" | "list" | "stop"
            | "send" | "inbox" | "cancel" | "steer" | "interrupt"),
        ) => {
            std::process::exit(match perchd::agent_cli::run(command, &args[1..]) {
                Ok(()) => 0,
                Err(error) => {
                    eprintln!("perch: {error}");
                    1
                }
            });
        }
        Some("daemon") => std::process::exit(perchd::cli_main(&args[1..], vec!["perchd".into()])),
        Some("ps" | "cleanup" | "release") => {
            std::process::exit(perchd::cli_main(&args, vec!["perchd".into()]))
        }
        _ => {
            eprintln!(
                "usage: perch whoami|report|guide|spawn|suggest|list|stop|send|inbox|cancel|steer|interrupt  (inside a Perch agent session)\n       perch ps|cleanup|release|daemon <verb>  (terminal runtimes)"
            );
            std::process::exit(2);
        }
    }
}

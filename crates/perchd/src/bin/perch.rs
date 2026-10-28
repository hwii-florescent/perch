//! User-facing, connect-only Perch runtime inspection/cleanup entry point.
fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    std::process::exit(perchd::cli_main(&args, vec!["perchd".into()]));
}

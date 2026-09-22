fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let exe = std::env::current_exe()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|_| "perchd".into());
    std::process::exit(perchd::cli_main(&args, vec![exe]));
}

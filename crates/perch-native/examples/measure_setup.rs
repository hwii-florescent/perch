//! Starts plain shell sessions in the core `PERCHD_DIR` publishes, for the memory measurement
//! (`scripts/measure-native-memory.sh`): `measure_setup create <count>` prints one new session id
//! per line; `measure_setup workspace <dir>` adds that folder as a project, starts one session in
//! it and prints its workspace id,
//! for the steps that open a workspace's files or review. Each shell is opened once so it starts, then let go, and runs whatever the scratch
//! `HOME`'s shell startup file says. Nothing is typed.

use anyhow::{bail, Context, Result};
use perch_native::client::Core;

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let (count, cwd): (usize, Option<&str>) = match args.as_slice() {
        [_, verb, count] if verb == "create" => (count.parse().context("the count")?, None),
        [_, verb, dir] if verb == "workspace" => (1, Some(dir.as_str())),
        [_, verb, provider] if verb == "agent" => return agent(provider),
        [_, verb, id, provider, text] if verb == "type" => return type_into(id, provider, text),
        _ => bail!(
            "usage: measure_setup create <count> | workspace <dir> | agent <provider> | type <session> <provider> <text>"
        ),
    };
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()?
        .block_on(async {
            let core = Core::discover(&perchd::server::default_dir())?;
            let mut connection = core.connect().await?;
            if let Some(dir) = cwd {
                connection.create_project(dir).await?;
            }
            for _ in 0..count {
                let id = connection.create_session(cwd, None).await?;
                let terminal = connection.open_terminal(&id, 100, 30).await?;
                let workspace = terminal.workspace_id.clone();
                connection.release_terminal(&terminal).await?;
                println!("{}", if cwd.is_some() { workspace } else { id });
            }
            Ok(())
        })
}

fn runtime() -> Result<tokio::runtime::Runtime> {
    Ok(tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()?)
}

/// Starts a session running `provider`'s agent, prints its id, and after 15 s prints the screen
/// it shows (its banner names the model) on stderr.
fn agent(provider: &str) -> Result<()> {
    runtime()?.block_on(async {
        let core = Core::discover(&perchd::server::default_dir())?;
        let mut connection = core.connect().await?;
        let id = connection.create_session(None, None).await?;
        let terminal = connection.open_terminal_as(&id, provider, 100, 30).await?;
        println!("{id}");
        tokio::time::sleep(std::time::Duration::from_secs(15)).await;
        connection.release_terminal(&terminal).await?;
        let terminal = connection.open_terminal_as(&id, provider, 100, 30).await?;
        eprintln!("{}", terminal.replay);
        connection.release_terminal(&terminal).await
    })
}

/// Types `text` and Enter into session `id`'s `provider` terminal.
fn type_into(id: &str, provider: &str, text: &str) -> Result<()> {
    runtime()?.block_on(async {
        let core = Core::discover(&perchd::server::default_dir())?;
        let mut connection = core.connect().await?;
        let terminal = connection.open_terminal_as(id, provider, 100, 30).await?;
        connection.terminal_input(&terminal, text, false).await?;
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        connection.terminal_input(&terminal, "\r", false).await?;
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        connection.release_terminal(&terminal).await
    })
}

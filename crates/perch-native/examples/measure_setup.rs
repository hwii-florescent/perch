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
        _ => bail!("usage: measure_setup create <count> | measure_setup workspace <dir>"),
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

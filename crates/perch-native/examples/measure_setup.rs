//! Starts plain shell sessions in the core `PERCHD_DIR` publishes, for the memory measurement
//! (`scripts/measure-native-memory.sh`): `measure_setup create <count>` prints one new session id
//! per line. Each shell is opened once so it starts, then let go, and runs whatever the scratch
//! `HOME`'s shell startup file says. Nothing is typed.

use anyhow::{bail, Context, Result};
use perch_native::client::Core;

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let count: usize = match args.as_slice() {
        [_, verb, count] if verb == "create" => count.parse().context("the count")?,
        _ => bail!("usage: measure_setup create <count>"),
    };
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()?
        .block_on(async {
            let core = Core::discover(&perchd::server::default_dir())?;
            let mut connection = core.connect().await?;
            for _ in 0..count {
                let id = connection.create_session(None, None).await?;
                let terminal = connection.open_terminal(&id, 100, 30).await?;
                connection.release_terminal(&terminal).await?;
                println!("{id}");
            }
            Ok(())
        })
}

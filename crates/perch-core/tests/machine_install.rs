//! `machine::probe` and `machine::install_from` through a stand-in `ssh` that runs the remote command
//! locally under a temporary `$HOME`. Its own test binary, because `PERCH_SSH` and `HOME` are process-wide.

use perch_core::machine::{install_from, probe, Fault, Source};
use std::os::unix::fs::PermissionsExt;
use std::path::Path;

fn executable(path: &Path, text: &str) {
    std::fs::write(path, text).unwrap();
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755)).unwrap();
}

fn sha256(path: &Path) -> String {
    let out = std::process::Command::new("shasum")
        .args(["-a", "256"])
        .arg(path)
        .output()
        .unwrap();
    String::from_utf8(out.stdout)
        .unwrap()
        .split_whitespace()
        .next()
        .unwrap()
        .to_string()
}

#[tokio::test]
async fn a_machine_is_probed_then_gets_the_core_by_upload_or_checked_download() {
    let dir = std::env::temp_dir().join(format!("perch-machine-{}", uuid::Uuid::new_v4()));
    let home = dir.join("home");
    std::fs::create_dir_all(&home).unwrap();
    let shim = dir.join("ssh");
    // The command is the last argument, as the real ssh would hand it to the remote shell.
    executable(
        &shim,
        "#!/bin/sh\nfor last; do :; done\nexec sh -c \"$last\"\n",
    );
    std::env::set_var("PERCH_SSH", &shim);
    std::env::set_var("HOME", &home);
    let home_str = home.display().to_string();

    let before = probe("box").await.unwrap();
    assert_eq!(
        (before.home.as_str(), before.core_path.clone()),
        (home_str.as_str(), None)
    );

    let core = dir.join("perch-core-built");
    executable(
        &core,
        "#!/bin/sh\n[ \"$1\" = --version ] && echo 'perch-core 9.9.9'\n",
    );
    let placed = install_from("box", &before, Source::Upload(core.clone()))
        .await
        .unwrap();
    assert_eq!(placed, format!("{home_str}/.local/bin/perch-core"));
    assert!(!Path::new(&format!("{placed}.part")).exists());
    let after = probe("box").await.unwrap();
    assert_eq!(after.core_path.as_deref(), Some(placed.as_str()));
    assert_eq!(after.core_version.as_deref(), Some("perch-core 9.9.9"));

    // A download is kept only if its published checksum matches.
    let asset = dir.join("perch-core-asset");
    executable(
        &asset,
        "#!/bin/sh\n[ \"$1\" = --version ] && echo 'perch-core 10.0.0'\n",
    );
    std::fs::write(
        dir.join("perch-core-asset.sha256"),
        format!("{}  perch-core-asset\n", sha256(&asset)),
    )
    .unwrap();
    let url = format!("file://{}", asset.display());
    install_from("box", &after, Source::Release { url: url.clone() })
        .await
        .unwrap();
    assert_eq!(
        probe("box").await.unwrap().core_version.as_deref(),
        Some("perch-core 10.0.0")
    );

    std::fs::write(
        dir.join("perch-core-asset.sha256"),
        format!("{}  perch-core-asset\n", "0".repeat(64)),
    )
    .unwrap();
    executable(&asset, "#!/bin/sh\necho tampered\n");
    let refused = install_from("box", &after, Source::Release { url })
        .await
        .unwrap_err();
    assert_eq!(refused.kind, Fault::Failed);
    assert!(refused.message.contains("checksum mismatch"), "{refused:?}");
    assert_eq!(
        probe("box").await.unwrap().core_version.as_deref(),
        Some("perch-core 10.0.0")
    ); // kept the good one
    assert!(!Path::new(&format!("{placed}.part")).exists());

    // A shim that fails the way ssh does when it needs a password.
    executable(
        &shim,
        "#!/bin/sh\necho 'u@box: Permission denied (publickey,password).' >&2\nexit 255\n",
    );
    assert_eq!(probe("box").await.unwrap_err().kind, Fault::NeedsLogin);
    let _ = std::fs::remove_dir_all(&dir);
}

/// The same walk through a real `ssh` to a throwaway sshd (see docs/TESTING.md "Machine add over real ssh").
/// Run alone with `--ignored`, with `PERCH_MACHINE_SSH` (an `ssh` wrapper that reaches host `box`) and `PERCH_MACHINE_HOME`
/// (the `$HOME` the remote shell runs with).
#[tokio::test]
#[ignore = "needs a throwaway sshd: docs/TESTING.md"]
async fn a_real_ssh_probe_and_upload_reach_the_remote_home() {
    let wrapper = std::env::var_os("PERCH_MACHINE_SSH").expect("PERCH_MACHINE_SSH");
    let home = std::env::var("PERCH_MACHINE_HOME").expect("PERCH_MACHINE_HOME");
    std::env::set_var("PERCH_SSH", wrapper);
    let before = probe("box").await.unwrap();
    assert_eq!(before.home, home);
    assert_eq!(before.core_path, None);
    let dir = std::env::temp_dir().join(format!("perch-machine-real-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let core = dir.join("perch-core-built");
    executable(
        &core,
        "#!/bin/sh\n[ \"$1\" = --version ] && echo 'perch-core 7.7.7'\n",
    );
    let placed = install_from("box", &before, Source::Upload(core))
        .await
        .unwrap();
    assert_eq!(placed, format!("{home}/.local/bin/perch-core"));
    assert_eq!(
        probe("box").await.unwrap().core_version.as_deref(),
        Some("perch-core 7.7.7")
    );
    let _ = std::fs::remove_dir_all(&dir);
}

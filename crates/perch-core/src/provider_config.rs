//! Bounded, declarative provider configuration loaded before accepting clients.
//! Executables and arguments remain manifest data until an explicit CLI start.

use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::Deserialize;

use crate::agent_fleet::{ProviderManifest, ProviderRegistry};

pub const MAX_PROVIDER_CONFIG_BYTES: usize = 256 * 1024;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ProviderConfig {
    version: u32,
    providers: Vec<ProviderManifest>,
}

pub fn default_path() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .map(|config_home| PathBuf::from(config_home).join(".perch/providers.json"))
}

/// A missing default file means native providers only. An explicitly named
/// file must exist. Validate the entire batch before registering any provider.
pub fn load_registry(override_path: Option<&Path>) -> Result<ProviderRegistry> {
    let registry = ProviderRegistry::native().context("invalid native provider registry")?;
    let default = default_path();
    let Some(path) = override_path.or(default.as_deref()) else {
        return Ok(registry);
    };
    if let Ok(metadata) = std::fs::metadata(path) {
        anyhow::ensure!(
            metadata.is_file(),
            "provider configuration must be a regular file"
        );
    }
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(error) if override_path.is_none() && error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(registry)
        }
        Err(error) => {
            return Err(error)
                .with_context(|| format!("cannot open provider configuration {}", path.display()))
        }
    };
    anyhow::ensure!(
        file.metadata()?.is_file(),
        "provider configuration must be a regular file"
    );
    let mut bytes = Vec::new();
    (&mut file)
        .take((MAX_PROVIDER_CONFIG_BYTES + 1) as u64)
        .read_to_end(&mut bytes)?;
    anyhow::ensure!(
        bytes.len() <= MAX_PROVIDER_CONFIG_BYTES,
        "provider configuration exceeds {MAX_PROVIDER_CONFIG_BYTES} bytes"
    );
    let config: ProviderConfig = serde_json::from_slice(&bytes)
        .with_context(|| format!("invalid provider configuration {}", path.display()))?;
    anyhow::ensure!(
        config.version == 1,
        "unsupported provider configuration version {}",
        config.version
    );
    registry
        .discover_configured(config.providers, None)
        .with_context(|| format!("invalid providers in {}", path.display()))?;
    Ok(registry)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "perch-provider-config-{}.json",
                uuid::Uuid::new_v4()
            ));
            Self(path)
        }
        fn write(&self, value: serde_json::Value) {
            fs::write(&self.0, value.to_string()).unwrap();
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_file(&self.0);
        }
    }

    #[test]
    fn configured_provider_extends_native_registry_without_launching() {
        let fixture = Fixture::new();
        let mut manifest = ProviderManifest::claude();
        manifest.id = "extra-agent".into();
        manifest.display_name = "Extra Agent".into();
        manifest.launch.executable = "/does/not/exist/provider".into();
        manifest.launch.mode_overrides.clear();
        fixture.write(serde_json::json!({ "version": 1, "providers": [manifest] }));
        let registry = load_registry(Some(&fixture.0)).unwrap();
        assert_eq!(registry.list().len(), 37);
        assert!(registry.contains("claude") && registry.contains("codex"));
        assert_eq!(
            registry.get("extra-agent").unwrap().display_name,
            "Extra Agent"
        );
        assert!(registry.resolve_executable("extra-agent", None).is_err());
    }

    #[test]
    fn missing_explicit_file_and_invalid_batches_fail_with_context() {
        let fixture = Fixture::new();
        assert!(load_registry(Some(&fixture.0))
            .err()
            .unwrap()
            .to_string()
            .contains("cannot open provider configuration"));
        fixture.write(serde_json::json!({ "version": 2, "providers": [] }));
        assert!(load_registry(Some(&fixture.0))
            .err()
            .unwrap()
            .to_string()
            .contains("unsupported provider configuration version"));
        fixture
            .write(serde_json::json!({ "version": 1, "providers": [ProviderManifest::claude()] }));
        assert!(format!("{:#}", load_registry(Some(&fixture.0)).err().unwrap()).contains("claude"));
        fixture.write(serde_json::json!({ "version": 1, "provider": [] }));
        assert!(load_registry(Some(&fixture.0)).is_err());
    }

    #[test]
    fn oversized_configuration_is_rejected_before_json_parsing() {
        let fixture = Fixture::new();
        fs::write(&fixture.0, vec![b' '; MAX_PROVIDER_CONFIG_BYTES + 1]).unwrap();
        assert!(load_registry(Some(&fixture.0))
            .err()
            .unwrap()
            .to_string()
            .contains("exceeds"));
    }

    #[test]
    fn documented_example_is_a_valid_cli_manifest() {
        let fixture = Fixture::new();
        fs::write(
            &fixture.0,
            include_str!("../../../docs/examples/providers.json"),
        )
        .unwrap();
        let registry = load_registry(Some(&fixture.0)).unwrap();
        assert!(registry
            .get("my-cli")
            .unwrap()
            .supported_modes
            .contains(&crate::agent_fleet::AgentMode::Cli));
    }
}

//! Load a TUI plugin into the real OpenCode process. Its own TUI owns the
//! selected session, prompt, model, tools and approvals.
use super::*;

pub fn launch(key: &AgentKey, command: Vec<String>) -> anyhow::Result<Vec<String>> {
    ensure!(!command.is_empty(), "missing OpenCode executable");
    let paths = paths(key)?;
    let config = paths.extension.with_extension("tui.json");
    write_private(
        &config,
        &serde_json::to_string(&serde_json::json!({
            "plugin": [paths.extension.to_string_lossy()]
        }))?,
    )?;
    let mut args = vec![
        "/bin/sh".into(), "-c".into(),
        // Never replace an explicit custom TUI config. Global and project
        // configs are merged by OpenCode itself when this extra file is used.
        // ponytail: custom OPENCODE_TUI_CONFIG remains CLI-only until OpenCode
        // provides an additive plugin flag; do not rewrite user JSONC settings.
        r#"if [ -n "$OPENCODE_TUI_CONFIG" ]; then
printf '%s\n' 'Perch UI is unavailable with a custom OPENCODE_TUI_CONFIG. The CLI keeps your configuration.' >&2
else
export OPENCODE_TUI_CONFIG="$1"
fi
shift
exec "$@""#.into(),
        "perch-opencode".into(), config.to_string_lossy().into_owned(),
    ];
    args.extend(command);
    Ok(args)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn launch_preserves_native_command_and_flags() {
        let key =
            AgentKey::new("native-test", uuid::Uuid::new_v4().to_string(), "opencode").unwrap();
        let command = vec![
            "/native/opencode".into(),
            "--model".into(),
            "provider/model".into(),
            "--auto".into(),
            "--session".into(),
            "literal '$()".into(),
        ];
        let args = launch(&key, command.clone()).unwrap();
        assert_eq!(args[5..], command);
        let config: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&args[4]).unwrap()).unwrap();
        assert_eq!(
            config["plugin"][0],
            paths(&key).unwrap().extension.to_string_lossy().as_ref()
        );
        let probe = launch(
            &key,
            vec![
                "/bin/sh".into(),
                "-c".into(),
                "printf '%s' \"$OPENCODE_TUI_CONFIG\"".into(),
            ],
        )
        .unwrap();
        let run = |custom: Option<&str>| {
            let mut child = std::process::Command::new(&probe[0]);
            child.args(&probe[1..]).env_remove("OPENCODE_TUI_CONFIG");
            if let Some(custom) = custom {
                child.env("OPENCODE_TUI_CONFIG", custom);
            }
            let output = child.output().unwrap();
            assert!(output.status.success());
            String::from_utf8(output.stdout).unwrap()
        };
        assert_eq!(run(None), args[4]);
        assert_eq!(
            run(Some("/custom/tui '$().jsonc")),
            "/custom/tui '$().jsonc"
        );
        std::fs::remove_file(&args[4]).unwrap();
    }
}

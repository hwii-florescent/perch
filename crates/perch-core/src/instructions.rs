//! Instructions: text and reference folders that every new agent session in a Project
//! (project) or a Workspace (workspace) receives at launch. Own design: Orca injects nothing at
//! launch (ROADMAP "Perch's version of Claude Projects and sub-sessions", slice 1).
//!
//! This module is pure: validation, composition (the Project's text, then the Workspace's), the
//! pinned snapshot with its provenance and hash, and the per-provider launch arguments. The
//! store is `db/instructions.rs`; the seams that apply a pin are `agent_runtime.rs` (picker
//! launches and wake) and `shell_integration.rs` (agents typed into a Perch shell).
//!
//! Only append flags are used (never `--system-prompt` or `--no-context-files`), so the repo's
//! own `AGENTS.md`/`CLAUDE.md` keep loading. Providers: Claude, Codex, Pi and OMP; any other
//! provider gets nothing.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;

/// Anthropic's Projects limit; applied to the text a session receives, Project and Workspace together.
pub const MAX_CHARS: usize = 16_000;
pub const MAX_FOLDERS: usize = 16;
const MAX_FOLDER_BYTES: usize = 1024;

/// The providers that take Instructions at launch.
pub fn supported(provider: &str) -> bool {
    matches!(provider, "claude" | "codex" | "pi" | "omp")
}

/// What one Project or Workspace stores.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Instructions {
    pub text: String,
    pub folders: Vec<String>,
}

impl Instructions {
    fn is_empty(&self) -> bool {
        self.text.is_empty() && self.folders.is_empty()
    }
}

/// Check and normalise what a person typed: the text is trimmed and at most [`MAX_CHARS`]
/// characters; each folder is an absolute path on this computer, without repeats.
pub fn validate(text: &str, folders: &[String]) -> Result<Instructions, String> {
    let text = text.replace("\r\n", "\n").trim().to_string();
    if text.contains('\0') {
        return Err("Instructions cannot contain NUL characters.".into());
    }
    if text.chars().count() > MAX_CHARS {
        return Err(format!(
            "Instructions are limited to {MAX_CHARS} characters."
        ));
    }
    let mut kept: Vec<String> = Vec::new();
    for folder in folders {
        let folder = folder.trim();
        if folder.is_empty() {
            continue;
        }
        if !folder.starts_with('/')
            || folder.len() > MAX_FOLDER_BYTES
            || folder.chars().any(char::is_control)
        {
            return Err(format!("\"{folder}\" is not an absolute folder path."));
        }
        let folder = folder.trim_end_matches('/');
        let folder = if folder.is_empty() { "/" } else { folder };
        if !kept.iter().any(|seen| seen == folder) {
            kept.push(folder.to_string());
        }
    }
    if kept.len() > MAX_FOLDERS {
        return Err(format!(
            "At most {MAX_FOLDERS} reference folders are allowed."
        ));
    }
    Ok(Instructions {
        text,
        folders: kept,
    })
}

/// A session receives the Project's text then the Workspace's. The cap applies to both together,
/// so a save that would push any combination over it is refused.
pub fn check_combined(project: &Instructions, workspace: &Instructions) -> Result<(), String> {
    let separator = if project.text.is_empty() || workspace.text.is_empty() {
        0
    } else {
        2
    };
    if project.text.chars().count() + workspace.text.chars().count() + separator > MAX_CHARS {
        return Err(format!(
            "The Project and Workspace Instructions together are limited to {MAX_CHARS} characters."
        ));
    }
    Ok(())
}

/// Where a pinned snapshot came from.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Source {
    /// `"project"` (Project) or `"workspace"` (Workspace).
    pub scope: String,
    pub id: String,
    pub revision: i64,
}

/// The snapshot one session launches with. Wake and resume reuse it; they never read the
/// current Instructions.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Pinned {
    pub text: String,
    pub folders: Vec<String>,
    pub sources: Vec<Source>,
    /// SHA-256 of the text and folders, hex.
    pub hash: String,
}

/// The Project's and the Workspace's Instructions with their stored revisions, broadest first.
/// `None` when neither holds anything.
pub fn compose(layers: &[(Source, Instructions)]) -> Option<Pinned> {
    let used: Vec<_> = layers
        .iter()
        .filter(|(_, instructions)| !instructions.is_empty())
        .collect();
    if used.is_empty() {
        return None;
    }
    let text = used
        .iter()
        .map(|(_, instructions)| instructions.text.as_str())
        .filter(|text| !text.is_empty())
        .collect::<Vec<_>>()
        .join("\n\n");
    let mut folders: Vec<String> = Vec::new();
    for (_, instructions) in &used {
        for folder in &instructions.folders {
            if !folders.contains(folder) {
                folders.push(folder.clone());
            }
        }
    }
    let mut digest = Sha256::new();
    digest.update(text.as_bytes());
    for folder in &folders {
        digest.update([0]);
        digest.update(folder.as_bytes());
    }
    Some(Pinned {
        text,
        hash: digest
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect(),
        folders,
        sources: used.iter().map(|(source, _)| source.clone()).collect(),
    })
}

impl Pinned {
    /// The reference folders that exist now; a folder that went away is skipped, not an error.
    fn present_folders(&self) -> Vec<&str> {
        self.folders
            .iter()
            .map(String::as_str)
            .filter(|folder| Path::new(folder).is_dir())
            .collect()
    }

    /// What `provider` reads as its instructions. Pi has no flag for extra folders and Codex
    /// refuses `--add-dir` when its TUI connects to the shared app-server (checked live,
    /// 0.166), so for both the folders are listed in the text.
    pub fn file_text(&self, provider: &str) -> String {
        let folders = self.present_folders();
        if !matches!(provider, "pi" | "codex") || folders.is_empty() {
            return self.text.clone();
        }
        let list = folders
            .iter()
            .map(|folder| format!("- {folder}"))
            .collect::<Vec<_>>()
            .join("\n");
        if self.text.is_empty() {
            format!("Reference folders you may read:\n{list}")
        } else {
            format!("{}\n\nReference folders you may read:\n{list}", self.text)
        }
    }
}

/// A TOML basic string, for Codex's `-c key=value` (the value is parsed as TOML).
fn toml_string(text: &str) -> String {
    let mut out = String::from("\"");
    for character in text.chars() {
        match character {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            control if (control as u32) < 0x20 || control as u32 == 0x7f => {
                out.push_str(&format!("\\u{:04X}", control as u32))
            }
            other => out.push(other),
        }
    }
    out.push('"');
    out
}

/// Arguments that hand a pin to a provider.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct LaunchArgs {
    /// Appended to the CLI's own command line.
    pub cli: Vec<String>,
    /// For Codex only: arguments of the shared `codex app-server`, which builds each thread's
    /// instructions. The TUI is only a client of it.
    pub codex_server: Vec<String>,
}

/// The flags that give `provider` this pin. `file` is where [`Pinned::file_text`] was written
/// (a private 0600 file, so a long text stays out of the process list). Providers without
/// support get nothing.
pub fn launch_args(provider: &str, pinned: &Pinned, file: &Path) -> LaunchArgs {
    let file = file.to_string_lossy().into_owned();
    let folders = pinned.present_folders();
    let mut args = LaunchArgs::default();
    match provider {
        "claude" => {
            if !pinned.text.is_empty() {
                args.cli
                    .extend(["--append-system-prompt-file".into(), file]);
            }
            // The `=` form keeps Claude's variadic --add-dir from swallowing a prompt argument.
            args.cli
                .extend(folders.iter().map(|folder| format!("--add-dir={folder}")));
        }
        "omp" => {
            if !pinned.text.is_empty() {
                args.cli.push(format!("--append-system-prompt={file}"));
            }
            args.cli
                .extend(folders.iter().map(|folder| format!("--add-dir={folder}")));
        }
        "pi" => {
            if !pinned.text.is_empty() || !folders.is_empty() {
                args.cli.extend(["--append-system-prompt".into(), file]);
            }
        }
        "codex" => {
            let text = pinned.file_text("codex");
            if !text.is_empty() {
                args.codex_server.extend([
                    "-c".into(),
                    format!("developer_instructions={}", toml_string(&text)),
                ]);
            }
        }
        _ => {}
    }
    args
}

#[cfg(test)]
mod tests {
    use super::*;

    fn source(scope: &str, revision: i64) -> Source {
        Source {
            scope: scope.into(),
            id: format!("{scope}-id"),
            revision,
        }
    }
    fn text(text: &str, folders: &[&str]) -> Instructions {
        Instructions {
            text: text.into(),
            folders: folders.iter().map(|f| f.to_string()).collect(),
        }
    }

    #[test]
    fn validation_trims_bounds_and_normalises() {
        let ok = validate(
            "  use tabs \r\n",
            &["/a/b/".into(), "/a/b".into(), " ".into()],
        )
        .unwrap();
        assert_eq!(ok, text("use tabs", &["/a/b"]));
        assert!(validate(&"x".repeat(MAX_CHARS), &[]).is_ok());
        assert!(validate(&"x".repeat(MAX_CHARS + 1), &[]).is_err());
        // The cap counts characters, not bytes.
        assert!(validate(&"é".repeat(MAX_CHARS), &[]).is_ok());
        assert!(validate("a\0b", &[]).is_err());
        assert!(validate("", &["relative/path".into()]).is_err());
        assert!(validate("", &["/bad\npath".into()]).is_err());
        let many: Vec<String> = (0..=MAX_FOLDERS).map(|n| format!("/f{n}")).collect();
        assert!(validate("", &many).is_err());
    }

    #[test]
    fn project_and_nest_share_one_cap() {
        let half = text(&"x".repeat(MAX_CHARS / 2), &[]);
        assert!(check_combined(&half, &text(&"y".repeat(MAX_CHARS / 2 - 2), &[])).is_ok());
        assert!(check_combined(&half, &text(&"y".repeat(MAX_CHARS / 2 - 1), &[])).is_err());
        // With one side empty there is no separator to count.
        assert!(check_combined(&text(&"x".repeat(MAX_CHARS), &[]), &text("", &[])).is_ok());
    }

    #[test]
    fn composition_orders_layers_and_records_provenance() {
        assert_eq!(compose(&[]), None);
        assert_eq!(
            compose(&[
                (source("project", 1), text("", &[])),
                (source("workspace", 4), text("", &[])),
            ]),
            None
        );
        let pinned = compose(&[
            (
                source("project", 3),
                text("Project rule", &["/ref", "/shared"]),
            ),
            (
                source("workspace", 1),
                text("Workspace rule", &["/shared", "/workspace"]),
            ),
        ])
        .unwrap();
        assert_eq!(pinned.text, "Project rule\n\nWorkspace rule");
        assert_eq!(pinned.folders, ["/ref", "/shared", "/workspace"]);
        assert_eq!(
            pinned.sources,
            [source("project", 3), source("workspace", 1)]
        );
        assert_eq!(pinned.hash.len(), 64);
        // An empty layer is not a source; the hash follows content only.
        let only_nest = compose(&[
            (source("project", 9), text("", &[])),
            (source("workspace", 1), text("Workspace rule", &[])),
        ])
        .unwrap();
        assert_eq!(only_nest.sources, [source("workspace", 1)]);
        assert_eq!(
            only_nest.hash,
            compose(&[(source("project", 2), text("Workspace rule", &[]))])
                .unwrap()
                .hash
        );
    }

    #[test]
    fn each_provider_gets_append_flags_only() {
        let dir = std::env::temp_dir().join(format!("perch-instr-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let folder = dir.to_string_lossy().into_owned();
        let pinned = compose(&[(
            source("project", 1),
            text("Say \"hi\"\nnow", &[&folder, "/perch-missing-folder"]),
        )])
        .unwrap();
        let file = Path::new("/private/p.md");

        let claude = launch_args("claude", &pinned, file);
        assert_eq!(
            claude.cli,
            [
                "--append-system-prompt-file".to_string(),
                "/private/p.md".into(),
                format!("--add-dir={folder}")
            ]
        );
        let omp = launch_args("omp", &pinned, file);
        assert_eq!(
            omp.cli,
            [
                "--append-system-prompt=/private/p.md".to_string(),
                format!("--add-dir={folder}")
            ]
        );
        let pi = launch_args("pi", &pinned, file);
        assert_eq!(pi.cli, ["--append-system-prompt", "/private/p.md"]);
        // Pi has no folder flag: the folders go in its file, and only the existing one.
        assert_eq!(
            pinned.file_text("pi"),
            format!("Say \"hi\"\nnow\n\nReference folders you may read:\n- {folder}")
        );
        assert_eq!(pinned.file_text("claude"), "Say \"hi\"\nnow");
        let codex = launch_args("codex", &pinned, file);
        // Codex's TUI refuses --add-dir against the shared app-server, so its folders are text.
        assert_eq!(
            codex.codex_server,
            [
                "-c".to_string(),
                format!(
                    "developer_instructions=\"Say \\\"hi\\\"\\nnow\\n\\nReference folders you may read:\\n- {folder}\""
                )
            ]
        );
        assert!(codex.cli.is_empty());
        // Nothing replaces the base prompt or hides repository instructions.
        for args in [
            &claude.cli,
            &omp.cli,
            &pi.cli,
            &codex.cli,
            &codex.codex_server,
        ] {
            assert!(!args.iter().any(|arg| arg.starts_with("--system-prompt")
                || arg.contains("no-context-files")
                || arg.contains("model_instructions_file")));
        }
        assert_eq!(
            launch_args("opencode", &pinned, file),
            LaunchArgs::default()
        );
        assert!(!supported("opencode") && supported("pi"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn folders_alone_still_launch_and_missing_text_adds_no_prompt_flag() {
        let dir = std::env::temp_dir().join(format!("perch-instr-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let folder = dir.to_string_lossy().into_owned();
        let pinned = compose(&[(source("workspace", 1), text("", &[&folder]))]).unwrap();
        let file = Path::new("/p.md");
        assert_eq!(
            launch_args("claude", &pinned, file).cli,
            [format!("--add-dir={folder}")]
        );
        assert_eq!(
            launch_args("codex", &pinned, file).codex_server,
            [
                "-c".to_string(),
                format!("developer_instructions=\"Reference folders you may read:\\n- {folder}\"")
            ]
        );
        assert_eq!(
            pinned.file_text("pi"),
            format!("Reference folders you may read:\n- {folder}")
        );
        assert_eq!(launch_args("pi", &pinned, file).cli.len(), 2);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn toml_strings_escape_what_toml_forbids() {
        assert_eq!(
            toml_string("a\"b\\c\n\t\u{1}\u{7f}é"),
            "\"a\\\"b\\\\c\\n\\t\\u0001\\u007Fé\""
        );
    }
}

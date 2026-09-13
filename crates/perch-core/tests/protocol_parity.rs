//! Cross-checks `crates/perch-core/src/protocol.rs` against
//! `packages/shared/src/protocol.ts` — the two hand-maintained mirrors of
//! perch's WS wire protocol (CLAUDE.md calls this the repo's #1 invariant).
//!
//! WHY THIS EXISTS: `ServerMessage` derives `Deserialize` *specifically* so
//! the hub (`hub.rs`) can parse another perch instance's WS replies as the
//! same protocol during perch↔perch federation. If the Rust struct and the
//! TS interface silently drift apart — a field renamed on one side, added to
//! only one side, or quietly made non-optional on one side — an old federated
//! peer (or an old web client bundle riding a self-updating PWA one poll
//! cycle behind) will either fail to deserialize a message at all, or
//! silently read `undefined`/miss a field. Nothing else in the repo catches
//! that today; before this test, the only enforcement was a doc comment.
//! Do not delete this as ceremony — it is the only thing standing between a
//! protocol edit and a federation-breaking drift landing unnoticed.
//!
//! ## Approach and its tradeoff
//!
//! The ideal Rust-side check would derive the *actual* wire shape from serde
//! itself (serialize a representative value of every variant, inspect the
//! resulting JSON) rather than parse Rust source — that tests what really
//! goes over the wire, not what the source merely looks like. That approach
//! was used where it's available: **`ServerMessage` does implement
//! `Serialize`** in this crate, so it *could* be derived that way. It is not,
//! here, for one reason: `ClientMessage` derives **only** `Deserialize` (by
//! design — the server never sends a `ClientMessage`), so there is no serde
//! `Serialize` path available for it at all, and this file's job is a
//! symmetric two-directional check. Rather than deriving `ServerMessage` one
//! way and text-parsing `ClientMessage` the other way (two different levels
//! of trust for the two directions, which would read as an inconsistency),
//! this test parses **both** Rust enums the same way it must already parse
//! the TS side (TS has no runtime reflection at all, so text analysis is
//! unavoidable there regardless). The result is one honest, uniform parser
//! instead of a partially-mechanical one — see the limitations list below
//! for exactly what that costs.
//!
//! ## What this test DOES catch
//! - A message `type` discriminant present in one file's `ClientMessage`/
//!   `SessionCreateMessage`-style union but missing from the other, in
//!   either direction.
//! - A field name present on one side of a shared message type but not the
//!   other (compared in **wire** casing, i.e. after mentally applying
//!   `rename_all = "camelCase"` to the Rust snake_case names).
//! - A field the Rust `ClientMessage` side *requires* (no `Option<T>` / no
//!   `#[serde(default)]`) while the TS side marks it `?:` — a client built
//!   against the TS type could omit it and crash the server's deserializer.
//! - A field the Rust `ServerMessage` side may *genuinely omit* from the JSON
//!   (`#[serde(skip_serializing_if = …)]`) while the TS side declares it
//!   required (no `?`) — client code trusting the type would read
//!   `undefined` as if the field were guaranteed present.
//! - The same four checks for a curated list of shared value types embedded
//!   inside messages (`ModelEntry`, `SessionSummary`, `SshHostEntry`, …),
//!   at field-name-set granularity (no optionality direction check there —
//!   see limitations).
//! - A parser regression that silently stops matching anything: each side
//!   asserts a floor on how many variants/interfaces it found, so "the regex
//!   quietly matched zero things and the test vacuously passed" fails loudly
//!   instead.
//!
//! ## What this test explicitly does NOT catch
//! - Anything about the *value* carried by a field beyond its name/
//!   optionality — e.g. a `String` that should have been a `u64`, or a
//!   `Vec<ModelEntry>` that should have been a single `ModelEntry`. Field
//!   *types* are not compared at all.
//! - `SessionStatus` / `AgentKind`'s own enum variant strings (e.g.
//!   `"running"`/`"idle"`, `"claude"`/`"codex"`) against the TS union
//!   literals — only structs embedded in messages are checked, not bare
//!   string enums.
//! - The shape carried by `serde_json::Value` / TS `unknown` fields (`input`,
//!   `result`, `layout`, …) — intentionally opaque on both sides, so there
//!   is nothing to compare.
//! - Field-level `#[serde(rename = "...")]` overrides are honoured if
//!   present, but every *other* serde attribute this parser doesn't
//!   recognise (e.g. a hypothetical `#[serde(flatten)]`) is silently
//!   ignored rather than rejected — it would neither be treated as optional
//!   nor cause a parse failure. None of the protocol structs use one today.
//! - Optionality-direction semantics for the curated value types (unlike the
//!   two message-level checks above) — only field-name-set parity is
//!   checked there, to keep this test from being defeated by legitimate,
//!   harmless `Option<T>` vs `?:` phrasing differences on non-dispatch types.
//! - Anything outside `protocol.rs`/`protocol.ts` — nested types defined
//!   elsewhere (e.g. `TerminalProfile` lives in `iterm_profile.rs` but is
//!   `pub use`d into the protocol; not walked here) are not covered unless
//!   added to `VALUE_TYPES` below.
//! - Source that stops looking like today's formatting: this is a plain text
//!   parser (regex + brace counting), not a real Rust/TS AST parser. It
//!   tolerates the comment placement, multi-line field lists, and attribute
//!   stacking this file already uses, but a sufficiently different style
//!   (e.g. semicolon-separated struct fields, attributes trailing a field on
//!   the same line) could make it misparse silently. The variant/interface
//!   count floors are the backstop for "misparsed to noticeably less".

use std::collections::BTreeMap;
use std::path::PathBuf;

use perch_core::protocol::ServerMessage;
use regex::Regex;

/// Shared value-type names to check for field-name-set parity in both files.
/// These are structs/interfaces embedded *inside* the message payloads,
/// rather than message types themselves — see the module doc's limitations
/// for what's intentionally not checked about them.
const VALUE_TYPES: &[&str] = &[
    "AgentManifestSummary",
    "NativeUiTool",
    "NativeUiMessage",
    "NativeUiSnapshot",
    "WorkspaceTerminal",
    "ModelEntry",
    "ChatUsage",
    "CommandEntry",
    "SessionSummary",
    "FsEntry",
    "WorktreeEntry",
    "HistoryMessage",
    "CustomModelsData",
    "SettingsData",
    "SettingsPatch",
    "SshHostEntry",
    "AgentAttach",
    "ProjectSummary",
    "WorkspaceSummary",
    "GitPreviewReceipt",
];

/// A single field's wire name plus the two independent facts this test
/// tracks about its optionality (see module doc for how each is used).
#[derive(Debug, Clone, Copy)]
struct FieldFlags {
    /// Rust: `Option<T>` or `#[serde(default...)]` — i.e. can be *absent or
    /// null* when deserializing. TS: has a `?:` marker.
    optional: bool,
    /// Rust only: `#[serde(skip_serializing_if = ...)]` — i.e. can be
    /// genuinely *absent* from the serialized JSON (not just present-as-
    /// null). Always `false` for TS fields (no such distinction exists).
    can_be_absent: bool,
}

type FieldMap = BTreeMap<String, FieldFlags>;
type MessageMap = BTreeMap<String, FieldMap>; // wire `type` tag -> fields

fn repo_root() -> PathBuf {
    // crates/perch-core -> crates -> repo root
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("crates/ parent")
        .parent()
        .expect("repo root parent")
        .to_path_buf()
}

fn rust_source() -> String {
    ["protocol.rs", "workspace_terminals.rs"]
        .iter()
        .map(|file| {
            let path = repo_root().join("crates/perch-core/src").join(file);
            std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("reading {path:?}: {e}"))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn ts_source() -> String {
    let path = repo_root().join("packages/shared/src/protocol.ts");
    std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("reading {path:?}: {e}"))
}

/// Finds `marker` in `source`, then returns the text strictly between the
/// next `{` and its balanced closing `}`. Balanced by naive brace counting —
/// safe here because no field-type in this file's structs/interfaces ever
/// contains a literal `{`/`}` (generics use `<>`, not `{}`).
fn extract_block(source: &str, marker: &str) -> Option<String> {
    let idx = source.find(marker)?;
    let after = &source[idx + marker.len()..];
    let brace_start = after.find('{')?;
    let bytes = after.as_bytes();
    let mut depth = 0i32;
    let mut end = None;
    for (i, &b) in bytes.iter().enumerate().skip(brace_start) {
        match b {
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    end = Some(i);
                    break;
                }
            }
            _ => {}
        }
    }
    let end = end?;
    Some(after[brace_start + 1..end].to_string())
}

/// Drops every whole line that is a doc comment (`///`) or plain comment
/// (`//`) before any comma-splitting happens. Necessary because prose like
/// "Absolute, server-side paths of…" contains commas that are not field
/// separators — splitting before stripping comments corrupts the next
/// field's attribute/name.
fn strip_comment_lines(s: &str) -> String {
    s.lines()
        .filter(|l| {
            let t = l.trim();
            !(t.starts_with("///") || t.starts_with("//"))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Splits on commas at bracket-depth 0, treating `<...>` and `(...)` as
/// nesting levels — `Option<Vec<ModelEntry>>` must not split mid-type, and
/// neither must `#[serde(default, skip_serializing_if = "...")]`'s *internal*
/// comma split it from the field it decorates. Commas inside `"..."` string
/// literals are also protected, though none in this file need it today.
/// Callers must run `strip_comment_lines` first — comment prose commas are
/// not bracket-protected and must already be gone.
fn split_top_level_commas(s: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut depth = 0i32;
    let mut in_string = false;
    let mut escaped = false;
    let mut current = String::new();
    for c in s.chars() {
        if in_string {
            current.push(c);
            if c == '"' && !escaped {
                in_string = false;
            }
            escaped = c == '\\' && !escaped;
            continue;
        }
        match c {
            '"' => {
                in_string = true;
                current.push(c);
            }
            '<' | '(' => {
                depth += 1;
                current.push(c);
            }
            '>' | ')' => {
                depth -= 1;
                current.push(c);
            }
            ',' if depth == 0 => {
                parts.push(std::mem::take(&mut current));
            }
            _ => current.push(c),
        }
    }
    if !current.trim().is_empty() {
        parts.push(current);
    }
    parts
}

fn to_camel_case(snake: &str) -> String {
    let mut parts = snake.split('_');
    let mut out = parts.next().unwrap_or("").to_string();
    for p in parts {
        if p.is_empty() {
            continue;
        }
        let mut chars = p.chars();
        if let Some(first) = chars.next() {
            out.push(first.to_ascii_uppercase());
            out.push_str(chars.as_str());
        }
    }
    out
}

/// Parses one Rust struct-field-list chunk (everything between two top-level
/// commas: zero or more `#[...]` attribute lines / doc comments / plain
/// comments, followed by exactly one `[pub] name: Type` line). Returns the
/// wire field name plus its flags, or `None` for an empty/attribute-only
/// trailing chunk.
fn parse_rust_field_chunk(chunk: &str) -> Option<(String, FieldFlags)> {
    let mut optional_from_attr = false;
    let mut can_be_absent = false;
    let mut rename_override: Option<String> = None;
    let mut field_line: Option<String> = None;

    let rename_re = Regex::new(r#"(?:^|[^_])rename\s*=\s*"([^"]+)""#).unwrap();

    for raw in chunk.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with("///") || line.starts_with("//") {
            continue;
        }
        if line.starts_with("#[") {
            if line.contains("default") || line.contains("skip_serializing_if") {
                optional_from_attr = true;
            }
            if line.contains("skip_serializing_if") {
                can_be_absent = true;
            }
            // Only a *field*-level `rename = "..."` (not `rename_all`)
            // overrides the camelCase conversion.
            if !line.contains("rename_all") {
                if let Some(caps) = rename_re.captures(line) {
                    rename_override = Some(caps[1].to_string());
                }
            }
            continue;
        }
        field_line = Some(line.to_string());
    }

    let field_line = field_line?;
    let field_line = field_line.trim_end_matches(',').trim();
    let field_line = field_line.strip_prefix("pub ").unwrap_or(field_line).trim();
    let (name_part, type_part) = field_line.split_once(':')?;
    let name = name_part.trim().to_string();
    let ty = type_part.trim();

    let optional = optional_from_attr || ty.starts_with("Option<") || ty.starts_with("Option ");
    let wire_name = rename_override.unwrap_or_else(|| to_camel_case(&name));
    Some((
        wire_name,
        FieldFlags {
            optional,
            can_be_absent,
        },
    ))
}

fn parse_rust_field_body(body: &str) -> FieldMap {
    let stripped = strip_comment_lines(body);
    let mut fields = FieldMap::new();
    for chunk in split_top_level_commas(&stripped) {
        if let Some((name, flags)) = parse_rust_field_chunk(&chunk) {
            fields.insert(name, flags);
        }
    }
    fields
}

/// Parses every variant of a `#[serde(tag = "type")]` message enum
/// (`ClientMessage` / `ServerMessage`) into wire-`type` -> fields. Matches
/// `#[serde(rename = "...", rename_all = "camelCase")?)] Ident { ...fields... }`
/// — every variant in this file follows exactly this shape (field-less
/// variants like `SessionList {}` have no `rename_all` since there's nothing
/// to case-convert).
fn parse_rust_message_enum(source: &str, enum_name: &str) -> MessageMap {
    let marker = format!("pub enum {enum_name}");
    let raw_body = extract_block(source, &marker)
        .unwrap_or_else(|| panic!("couldn't find `{marker}` in protocol.rs"));
    // Doc comments in this file sometimes contain a literal brace pair (e.g.
    // `` `POST {base}upload` ``, `` `{port}` ``) — strip comment lines before
    // the variant regex runs, or its `[^}]*` field-body capture would stop
    // dead at the comment's `}` and truncate every field after it.
    let body = strip_comment_lines(&raw_body);

    let variant_re = Regex::new(
        r#"#\[serde\(rename\s*=\s*"([^"]+)"(?:\s*,\s*rename_all\s*=\s*"camelCase")?\)\]\s+(\w+)\s*\{([^}]*)\}"#,
    )
    .unwrap();

    let mut result = MessageMap::new();
    for caps in variant_re.captures_iter(&body) {
        let type_tag = caps[1].to_string();
        let field_body = &caps[3];
        result.insert(type_tag, parse_rust_field_body(field_body));
    }
    result
}

fn parse_rust_struct(source: &str, struct_name: &str) -> FieldMap {
    let marker = format!("pub struct {struct_name}");
    let raw_body = extract_block(source, &marker)
        .unwrap_or_else(|| panic!("couldn't find `{marker}` in protocol.rs"));
    let body = strip_comment_lines(&raw_body);
    parse_rust_field_body(&body)
}

// ---------------------------------------------------------------------------
// TypeScript side
// ---------------------------------------------------------------------------

fn extract_ts_union_members(source: &str, union_name: &str) -> Vec<String> {
    let marker = format!("export type {union_name} =");
    let idx = source
        .find(&marker)
        .unwrap_or_else(|| panic!("couldn't find `{marker}` in protocol.ts"));
    let after = &source[idx + marker.len()..];
    let end = after
        .find(';')
        .unwrap_or_else(|| panic!("unterminated `{marker}` union in protocol.ts"));
    after[..end]
        .lines()
        .filter_map(|l| {
            let l = l.trim().trim_start_matches('|').trim();
            if l.is_empty() {
                None
            } else {
                Some(l.to_string())
            }
        })
        .collect()
}

fn parse_ts_field_body(body: &str) -> FieldMap {
    let mut fields = FieldMap::new();
    let field_re = Regex::new(r#"^([A-Za-z_][A-Za-z0-9_]*)(\?)?\s*:\s*.+;\s*$"#).unwrap();
    let mut in_block_comment = false;

    for raw in body.lines() {
        let line = raw.trim();
        if line.is_empty() {
            continue;
        }
        if in_block_comment {
            if line.ends_with("*/") {
                in_block_comment = false;
            }
            continue;
        }
        if line.starts_with("/**") || line.starts_with("/*") {
            if !line.ends_with("*/") {
                in_block_comment = true;
            }
            continue;
        }
        if line.starts_with('*') || line.starts_with("//") {
            continue;
        }
        if let Some(caps) = field_re.captures(line) {
            let name = caps[1].to_string();
            if name == "type" {
                // The discriminant tag itself, not a data field.
                continue;
            }
            let optional = caps.get(2).is_some();
            fields.insert(
                name,
                FieldFlags {
                    optional,
                    can_be_absent: false,
                },
            );
        }
    }
    fields
}

/// Wire `type` literal declared inside an interface body, e.g. `type:
/// "session.created";`.
fn ts_type_tag(body: &str) -> Option<String> {
    let re = Regex::new(r#"type\s*:\s*"([^"]+)"\s*;"#).unwrap();
    re.captures(body).map(|c| c[1].to_string())
}

fn parse_ts_interface_fields(source: &str, interface_name: &str) -> FieldMap {
    let marker = format!("export interface {interface_name}");
    let body = extract_block(source, &marker)
        .unwrap_or_else(|| panic!("couldn't find `{marker}` in protocol.ts"));
    parse_ts_field_body(&body)
}

fn parse_ts_message_union(source: &str, union_name: &str) -> MessageMap {
    let members = extract_ts_union_members(source, union_name);
    let mut result = MessageMap::new();
    for member in members {
        let marker = format!("export interface {member}");
        let body = extract_block(source, &marker)
            .unwrap_or_else(|| panic!("couldn't find `{marker}` in protocol.ts"));
        let tag = ts_type_tag(&body)
            .unwrap_or_else(|| panic!("interface {member} has no `type: \"...\";` literal"));
        result.insert(tag, parse_ts_field_body(&body));
    }
    result
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/// Compares one direction's Rust/TS message maps and appends diff-style
/// failure lines (message name, field name, which side is missing it) to
/// `errors`. `rust_enforces_required` selects which of the two directional
/// optionality checks applies (see module doc): `true` for `ClientMessage`
/// (Rust deserializes what TS sends — a Rust-required field TS marks
/// optional is a bug), `false` for `ServerMessage` (Rust serializes what TS
/// reads — a Rust field that can be genuinely absent from the JSON while TS
/// marks it required is a bug).
fn compare_direction(
    direction: &str,
    rust: &MessageMap,
    ts: &MessageMap,
    rust_enforces_required: bool,
    errors: &mut Vec<String>,
) {
    let rust_types: std::collections::BTreeSet<_> = rust.keys().collect();
    let ts_types: std::collections::BTreeSet<_> = ts.keys().collect();

    for missing in rust_types.difference(&ts_types) {
        errors.push(format!(
            "[{direction}] message \"{missing}\" is defined in protocol.rs but has no matching \
             interface (by its `type` literal) in protocol.ts"
        ));
    }
    for missing in ts_types.difference(&rust_types) {
        errors.push(format!(
            "[{direction}] message \"{missing}\" is defined in protocol.ts but has no matching \
             variant (by its `#[serde(rename = ...)]`) in protocol.rs"
        ));
    }

    for shared_type in rust_types.intersection(&ts_types) {
        let rust_fields = &rust[*shared_type];
        let ts_fields = &ts[*shared_type];
        let rust_names: std::collections::BTreeSet<_> = rust_fields.keys().collect();
        let ts_names: std::collections::BTreeSet<_> = ts_fields.keys().collect();

        for field in rust_names.difference(&ts_names) {
            errors.push(format!(
                "[{direction}] \"{shared_type}\": field `{field}` exists in protocol.rs but is \
                 missing from the matching protocol.ts interface"
            ));
        }
        for field in ts_names.difference(&rust_names) {
            errors.push(format!(
                "[{direction}] \"{shared_type}\": field `{field}` exists in protocol.ts but is \
                 missing from the matching protocol.rs variant"
            ));
        }

        for field in rust_names.intersection(&ts_names) {
            let rf = rust_fields[*field];
            let tf = ts_fields[*field];
            if rust_enforces_required && !rf.optional && tf.optional {
                errors.push(format!(
                    "[{direction}] \"{shared_type}\": field `{field}` is required in \
                     protocol.rs (no Option<T>/#[serde(default)]) but optional (`?:`) in \
                     protocol.ts — a client omitting it would fail to deserialize on the server"
                ));
            }
            if !rust_enforces_required && rf.can_be_absent && !tf.optional {
                errors.push(format!(
                    "[{direction}] \"{shared_type}\": field `{field}` can be omitted from the \
                     wire by protocol.rs (#[serde(skip_serializing_if = ...)]) but is required \
                     (no `?:`) in protocol.ts — client code may read `undefined` as guaranteed \
                     present"
                ));
            }
        }
    }
}

fn compare_value_type(name: &str, rust: &FieldMap, ts: &FieldMap, errors: &mut Vec<String>) {
    let rust_names: std::collections::BTreeSet<_> = rust.keys().collect();
    let ts_names: std::collections::BTreeSet<_> = ts.keys().collect();
    for field in rust_names.difference(&ts_names) {
        errors.push(format!(
            "[value type] \"{name}\": field `{field}` exists in protocol.rs but is missing \
             from protocol.ts"
        ));
    }
    for field in ts_names.difference(&rust_names) {
        errors.push(format!(
            "[value type] \"{name}\": field `{field}` exists in protocol.ts but is missing \
             from protocol.rs"
        ));
    }
}

#[test]
fn protocol_rs_and_protocol_ts_agree() {
    let rust_src = rust_source();
    let ts_src = ts_source();

    let rust_client = parse_rust_message_enum(&rust_src, "ClientMessage");
    let rust_server = parse_rust_message_enum(&rust_src, "ServerMessage");
    let ts_client = parse_ts_message_union(&ts_src, "ClientMessage");
    let ts_server = parse_ts_message_union(&ts_src, "ServerMessage");

    // Sanity floors: if the parser regresses to matching nothing, fail
    // loudly instead of vacuously passing an empty comparison. Current
    // counts are 25 (client) / 28 (server) as of this writing; floors are
    // set comfortably below that so ordinary additions don't need bumping.
    assert!(
        rust_client.len() >= 20,
        "parsed only {} ClientMessage variants from protocol.rs — parser likely broken",
        rust_client.len()
    );
    assert!(
        rust_server.len() >= 20,
        "parsed only {} ServerMessage variants from protocol.rs — parser likely broken",
        rust_server.len()
    );
    assert!(
        ts_client.len() >= 20,
        "parsed only {} ClientMessage members from protocol.ts — parser likely broken",
        ts_client.len()
    );
    assert!(
        ts_server.len() >= 20,
        "parsed only {} ServerMessage members from protocol.ts — parser likely broken",
        ts_server.len()
    );

    let mut errors = Vec::new();
    compare_direction(
        "client->server",
        &rust_client,
        &ts_client,
        true,
        &mut errors,
    );
    compare_direction(
        "server->client",
        &rust_server,
        &ts_server,
        false,
        &mut errors,
    );

    for value_type in VALUE_TYPES {
        let rust_fields = parse_rust_struct(&rust_src, value_type);
        let ts_fields = parse_ts_interface_fields(&ts_src, value_type);
        assert!(
            !rust_fields.is_empty() || value_type == &"AgentAttach",
            "parsed zero fields for struct {value_type} in protocol.rs — parser likely broken"
        );
        compare_value_type(value_type, &rust_fields, &ts_fields, &mut errors);
    }

    assert!(
        errors.is_empty(),
        "protocol.rs and protocol.ts have drifted apart ({} issue(s)):\n{}",
        errors.len(),
        errors.join("\n")
    );
}

/// A rolling upgrade must continue accepting a pre-foundation peer's
/// `server.info`, which has no capability/version fields. Local clients still
/// receive the populated fields from the current server implementation.
#[test]
fn old_server_info_without_foundation_fields_deserializes() {
    let old = r#"{
        "type":"server.info",
        "hostname":"legacy",
        "isSsh":false,
        "platform":"macos",
        "claudeModels":[],
        "codexModels":[]
    }"#;
    let parsed: ServerMessage = serde_json::from_str(old).expect("legacy server.info parses");
    match parsed {
        ServerMessage::ServerInfo {
            protocol_version,
            capabilities,
            snapshot_epoch,
            snapshot_revision,
            ..
        } => {
            assert_eq!(protocol_version, 0);
            assert!(capabilities.is_empty());
            assert!(snapshot_epoch.is_empty());
            assert_eq!(snapshot_revision, 0);
        }
        other => panic!("expected server.info, got {other:?}"),
    }
}

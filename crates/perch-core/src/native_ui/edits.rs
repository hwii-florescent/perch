//! Edit cards: what a landed file edit changed, as rows a card can draw, read from the edit
//! tool's own call and its result.
//!
//! Ported from Orca's `shared/native-chat/tools/native-chat-edit-{normalize,model,lcs,
//! patch-files,cards}.ts`, `native-chat-unified-patch.ts`, `native-chat-begin-patch.ts` and the
//! parts of `native-chat-diff.ts` they use (commit 308b5000, MIT; see THIRD_PARTY_NOTICES.md),
//! with the tests of `native-chat-edit-normalize.test.ts`. Orca's LCS, unified-patch and
//! begin-patch modules have no tests of their own; the ones here are Perch's.
//!
//! Resolved hunks come from Claude's `toolUseResult.structuredPatch` (Orca
//! `main/native-chat/transcript-line-decoders-claude.ts`), which the bridge carries on the
//! result message as `NativeUiMessage::edit_patch`.
//!
//! Not ported, because Perch has no source for them: Orca's structured journal `Diff` tool and
//! its bounded-text markers, and the path-only summaries built from them. Orca's `Edit` and
//! `Write` names are case-sensitive, so Pi and OMP (`edit`, `write`) get no card and keep their
//! generic row. Codex reports a change as a `fileChange` item that the bridge names
//! `file changes` and whose input is the `changes` array itself; that is read like Orca's
//! `apply_patch` `changes` input.
//!
//! Perch's bridges shorten long input strings. An edit tool's input is kept longer, and a string
//! that still had to be cut sets `_perchClipped` on the input object (see `bounded_edit_json`);
//! a card made from such an input says "Diff truncated".
use crate::protocol::{NativeUiEditPatch, NativeUiToolState};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::sync::OnceLock;

pub const MAX_EDIT_LINES: usize = 2_000;
pub const MAX_EDIT_CHARS: usize = 96_000;
/// The LCS table is quadratic; above this a linear prefix/suffix diff is used.
const MAX_EDIT_DIFF_CELLS: usize = 200_000;
/// Input key a bridge sets when it had to cut a long string out of an edit tool's input.
pub const CLIPPED_KEY: &str = "_perchClipped";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EditLineKind {
    Context,
    Add,
    Del,
    /// The break between two regions of a file: no text and no position.
    Gap,
}

/// A removed row has no new number and an added one no old number.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditLine {
    pub kind: EditLineKind,
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub old_line_number: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub new_line_number: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EditChangeKind {
    Added,
    Deleted,
    Edited,
    Renamed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditFile {
    pub path: String,
    /// Set only when the change moved the file.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub old_path: Option<String>,
    pub change_kind: EditChangeKind,
    pub lines: Vec<EditLine>,
    pub added: u32,
    pub removed: u32,
    /// False for snippet-relative positions without resolved file hunk ranges: the rows then
    /// carry no numbers at all.
    pub line_numbers_known: bool,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub truncated: bool,
}

// ---- Model ----------------------------------------------------------------------------------

struct Content {
    lines: Vec<String>,
    truncated: bool,
}

/// CRLF-aware splitting so a stray CR never reaches rows. A body clipped to the cap keeps its
/// last partial line; only a trailing newline of the clipped body is not a row.
fn split_content(content: &str) -> Content {
    if content.is_empty() {
        return Content {
            lines: vec![],
            truncated: false,
        };
    }
    let truncated = content.chars().count() > MAX_EDIT_CHARS;
    let body: String = if truncated {
        content.chars().take(MAX_EDIT_CHARS).collect()
    } else {
        content.to_string()
    };
    let mut lines: Vec<String> = body.split('\n').map(str::to_string).collect();
    let last = lines.len() - 1;
    for line in &mut lines[..last] {
        if line.ends_with('\r') {
            line.pop();
        }
    }
    if body.ends_with('\n') {
        lines.pop();
    }
    Content { lines, truncated }
}

fn push_gap(lines: &mut Vec<EditLine>) {
    if lines
        .last()
        .is_some_and(|last| last.kind != EditLineKind::Gap)
    {
        lines.push(EditLine {
            kind: EditLineKind::Gap,
            text: String::new(),
            old_line_number: None,
            new_line_number: None,
        });
    }
}

struct Draft {
    path: String,
    old_path: Option<String>,
    change_kind: EditChangeKind,
    lines: Vec<EditLine>,
    line_numbers_known: bool,
    truncated: bool,
}

fn finalize(draft: Draft) -> EditFile {
    let Draft {
        path,
        old_path,
        change_kind,
        mut lines,
        line_numbers_known,
        truncated,
    } = draft;
    let over_cap = lines.len() > MAX_EDIT_LINES;
    lines.truncate(MAX_EDIT_LINES);
    // A gap after the final region marks nothing.
    while lines
        .last()
        .is_some_and(|line| line.kind == EditLineKind::Gap)
    {
        lines.pop();
    }
    // Unresolved snippet numbers look like file positions.
    if !line_numbers_known {
        for line in &mut lines {
            line.old_line_number = None;
            line.new_line_number = None;
        }
    }
    let count = |kind| lines.iter().filter(|line| line.kind == kind).count() as u32;
    EditFile {
        added: count(EditLineKind::Add),
        removed: count(EditLineKind::Del),
        path,
        old_path,
        change_kind,
        lines,
        line_numbers_known,
        truncated: truncated || over_cap,
    }
}

fn row(
    kind: EditLineKind,
    text: &str,
    old_line_number: Option<u32>,
    new_line_number: Option<u32>,
) -> EditLine {
    EditLine {
        kind,
        text: text.to_string(),
        old_line_number,
        new_line_number,
    }
}

fn number(index: usize) -> Option<u32> {
    u32::try_from(index + 1).ok()
}

// ---- LCS ------------------------------------------------------------------------------------

/// Line numbers locate the supplied contents; they are file positions only for whole files.
fn lines_from_contents(original: &str, modified: &str) -> (Vec<EditLine>, bool) {
    let original = split_content(original);
    let modified = split_content(modified);
    let lines = if original.lines.len() * modified.lines.len() <= MAX_EDIT_DIFF_CELLS {
        lcs_lines(&original.lines, &modified.lines)
    } else {
        prefix_suffix_lines(&original.lines, &modified.lines)
    };
    (lines, original.truncated || modified.truncated)
}

fn lcs_lines(original: &[String], modified: &[String]) -> Vec<EditLine> {
    let width = modified.len() + 1;
    let mut table = vec![0u32; (original.len() + 1) * width];
    for i in (0..original.len()).rev() {
        for j in (0..modified.len()).rev() {
            table[i * width + j] = if original[i] == modified[j] {
                table[(i + 1) * width + j + 1] + 1
            } else {
                table[(i + 1) * width + j].max(table[i * width + j + 1])
            };
        }
    }
    let mut lines = vec![];
    let (mut old_index, mut new_index) = (0, 0);
    while old_index < original.len() && new_index < modified.len() {
        if original[old_index] == modified[new_index] {
            lines.push(row(
                EditLineKind::Context,
                &original[old_index],
                number(old_index),
                number(new_index),
            ));
            old_index += 1;
            new_index += 1;
        } else if table[(old_index + 1) * width + new_index]
            >= table[old_index * width + new_index + 1]
        {
            lines.push(row(
                EditLineKind::Del,
                &original[old_index],
                number(old_index),
                None,
            ));
            old_index += 1;
        } else {
            lines.push(row(
                EditLineKind::Add,
                &modified[new_index],
                None,
                number(new_index),
            ));
            new_index += 1;
        }
    }
    for (index, text) in original.iter().enumerate().skip(old_index) {
        lines.push(row(EditLineKind::Del, text, number(index), None));
    }
    for (index, text) in modified.iter().enumerate().skip(new_index) {
        lines.push(row(EditLineKind::Add, text, None, number(index)));
    }
    lines
}

fn prefix_suffix_lines(original: &[String], modified: &[String]) -> Vec<EditLine> {
    let mut prefix = 0;
    while prefix < original.len() && prefix < modified.len() && original[prefix] == modified[prefix]
    {
        prefix += 1;
    }
    let mut suffix = 0;
    while suffix + prefix < original.len()
        && suffix + prefix < modified.len()
        && original[original.len() - suffix - 1] == modified[modified.len() - suffix - 1]
    {
        suffix += 1;
    }
    let mut lines = vec![];
    for (index, text) in original.iter().enumerate().take(prefix) {
        lines.push(row(
            EditLineKind::Context,
            text,
            number(index),
            number(index),
        ));
    }
    for (index, text) in original
        .iter()
        .enumerate()
        .take(original.len() - suffix)
        .skip(prefix)
    {
        lines.push(row(EditLineKind::Del, text, number(index), None));
    }
    for (index, text) in modified
        .iter()
        .enumerate()
        .take(modified.len() - suffix)
        .skip(prefix)
    {
        lines.push(row(EditLineKind::Add, text, None, number(index)));
    }
    for index in original.len() - suffix..original.len() {
        let new_index = modified.len() - suffix + (index - (original.len() - suffix));
        lines.push(row(
            EditLineKind::Context,
            &original[index],
            number(index),
            number(new_index),
        ));
    }
    lines
}

// ---- Unified patch --------------------------------------------------------------------------

/// Outside a hunk these are structure; inside one `---`/`+++` may be removed/added content, so
/// they are not here (see `is_file_header_pair`).
fn file_section_start(line: &str) -> bool {
    [
        "diff ",
        "index ",
        "old mode ",
        "new mode ",
        "new file mode ",
        "deleted file mode ",
        "similarity index ",
        "dissimilarity index ",
        "rename ",
        "copy ",
        "Binary files ",
    ]
    .iter()
    .any(|prefix| line.starts_with(prefix))
}

fn is_file_header_pair(rows: &[String], index: usize) -> bool {
    rows.get(index).is_some_and(|row| row.starts_with("--- "))
        && rows
            .get(index + 1)
            .is_some_and(|row| row.starts_with("+++ "))
}

fn hunk_ranges(header: &str) -> Option<(u32, u32)> {
    static RANGES: OnceLock<Regex> = OnceLock::new();
    let ranges =
        RANGES.get_or_init(|| Regex::new(r"^@@+ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@").unwrap());
    let found = ranges.captures(header)?;
    Some((found[1].parse().ok()?, found[3].parse().ok()?))
}

struct UnifiedPatchLines {
    lines: Vec<EditLine>,
    /// True only when every hunk carried real `@@` ranges.
    line_numbers_known: bool,
    /// The patch text was clipped before it became rows.
    truncated: bool,
}

/// Real `@@` ranges give file line numbers; bare context anchors leave rows unnumbered rather
/// than falsely starting at one. `implicit_first_hunk` admits a headerless first chunk.
fn lines_from_unified_patch(text: &str, implicit_first_hunk: bool) -> Option<UnifiedPatchLines> {
    let source = split_content(text);
    let rows = &source.lines;
    let mut lines: Vec<EditLine> = vec![];
    let mut last_was_gap = false;
    let (mut old_no, mut new_no): (Option<u32>, Option<u32>) = (None, None);
    let mut saw_hunk = implicit_first_hunk;
    let mut ranged = true;
    let mut in_hunk = saw_hunk;
    let mut index = 0;
    while index < rows.len() {
        let raw = rows[index].as_str();
        if raw.starts_with("@@") {
            match hunk_ranges(raw) {
                Some((old, new)) => (old_no, new_no) = (Some(old), Some(new)),
                None => (old_no, new_no) = (None, None),
            }
            if !lines.is_empty() && !last_was_gap {
                lines.push(row(EditLineKind::Gap, "", None, None));
                last_was_gap = true;
            }
            saw_hunk = true;
            in_hunk = true;
        } else if raw.starts_with('\\') {
            // "\ No newline at end of file"
        } else if !in_hunk && is_file_header_pair(rows, index) {
            index += 1;
        } else if file_section_start(raw) {
            in_hunk = false;
        } else if in_hunk {
            ranged &= old_no.is_some() || new_no.is_some();
            last_was_gap = false;
            if let Some(text) = raw.strip_prefix('+') {
                lines.push(row(EditLineKind::Add, text, None, new_no));
                new_no = new_no.map(|n| n + 1);
            } else if let Some(text) = raw.strip_prefix('-') {
                lines.push(row(EditLineKind::Del, text, old_no, None));
                old_no = old_no.map(|n| n + 1);
            } else {
                let text = raw.strip_prefix(' ').unwrap_or(raw);
                lines.push(row(EditLineKind::Context, text, old_no, new_no));
                old_no = old_no.map(|n| n + 1);
                new_no = new_no.map(|n| n + 1);
            }
        }
        index += 1;
    }
    (saw_hunk && !lines.is_empty()).then_some(UnifiedPatchLines {
        lines,
        line_numbers_known: ranged,
        truncated: source.truncated,
    })
}

/// Rows for a whole-file add or delete, which legitimately number from 1.
fn lines_from_whole_file(content: &str, kind: EditLineKind) -> (Vec<EditLine>, bool) {
    let body = split_content(content);
    let lines = body
        .lines
        .iter()
        .enumerate()
        .map(|(index, text)| {
            row(
                kind,
                text,
                (kind == EditLineKind::Del).then(|| number(index)).flatten(),
                (kind == EditLineKind::Add).then(|| number(index)).flatten(),
            )
        })
        .collect();
    (lines, body.truncated)
}

struct Section {
    rows: Vec<String>,
    old_path: Option<String>,
    new_path: Option<String>,
    named: bool,
    /// A `--- `/`+++ ` pair already named this section, so the next one is a new file.
    has_header_pair: bool,
    /// Only a `diff --git` header states both sides of a move as such. A bare pair with
    /// differing paths is as likely two directories compared.
    from_git_header: bool,
}

struct PatchSection {
    /// None when the patch text named no file, leaving it to the caller.
    path: Option<String>,
    old_path: Option<String>,
    change_kind: EditChangeKind,
    body: String,
}

fn section_change_kind(section: &Section) -> EditChangeKind {
    if !section.named {
        EditChangeKind::Edited
    } else if section.new_path.is_none() {
        EditChangeKind::Deleted
    } else if section.old_path.is_none() {
        EditChangeKind::Added
    } else if section.old_path == section.new_path || !section.from_git_header {
        EditChangeKind::Edited
    } else {
        EditChangeKind::Renamed
    }
}

/// `--- a/<path>` / `+++ b/<path>`: the absent side is `/dev/null`; a tab introduces the
/// timestamp some producers append.
fn source_header_path(line: &str) -> Option<String> {
    let value = line
        .get(4..)
        .unwrap_or("")
        .split('\t')
        .next()
        .unwrap_or("")
        .trim();
    if value.is_empty() || value == "/dev/null" {
        return None;
    }
    Some(
        value
            .strip_prefix("a/")
            .or_else(|| value.strip_prefix("b/"))
            .unwrap_or(value)
            .to_string(),
    )
}

fn git_header_paths(line: &str) -> (Option<String>, Option<String>) {
    let rest = &line["diff --git ".len()..];
    // Both halves carry the same path unless the file moved, so the second starts at the last
    // ` b/` rather than at the first space.
    let Some(split) = rest.rfind(" b/") else {
        return (None, None);
    };
    let old = &rest[..split];
    let new = &rest[split + 1..];
    (
        Some(old.strip_prefix("a/").unwrap_or(old).to_string()),
        Some(new.strip_prefix("b/").unwrap_or(new).to_string()),
    )
}

/// One section per file; otherwise a multi-file patch would put every row under the first name.
fn unified_patch_sections(text: &str) -> (Vec<PatchSection>, bool) {
    let source = split_content(text);
    let rows = &source.lines;
    let mut sections: Vec<Section> = vec![];
    let mut in_hunk = false;
    let open = |sections: &mut Vec<Section>| {
        sections.push(Section {
            rows: vec![],
            old_path: None,
            new_path: None,
            named: false,
            has_header_pair: false,
            from_git_header: false,
        });
    };
    let mut index = 0;
    while index < rows.len() {
        let raw = rows[index].as_str();
        if raw.starts_with("diff --git ") {
            let (old, new) = git_header_paths(raw);
            open(&mut sections);
            let current = sections.last_mut().unwrap();
            current.old_path = old;
            current.new_path = new;
            current.named = true;
            current.from_git_header = true;
            in_hunk = false;
            index += 1;
            continue;
        }
        // Inside a hunk a header pair ends a file only when a column-zero `@@` follows it;
        // literal removed `--`/added `++` content cannot satisfy that.
        if is_file_header_pair(rows, index)
            && (!in_hunk
                || rows
                    .get(index + 2)
                    .is_some_and(|next| next.starts_with("@@")))
        {
            // The first pair names the current `diff --git` section; later pairs open files in
            // header-only patches.
            if sections
                .last()
                .is_none_or(|current| current.has_header_pair)
            {
                open(&mut sections);
            }
            let current = sections.last_mut().unwrap();
            current.old_path = source_header_path(&rows[index]);
            current.new_path = source_header_path(&rows[index + 1]);
            current.named = true;
            current.has_header_pair = true;
            in_hunk = false;
            index += 2;
            continue;
        }
        if raw.starts_with("@@") {
            in_hunk = true;
        } else if file_section_start(raw) {
            in_hunk = false;
        }
        if sections.is_empty() {
            open(&mut sections);
        }
        sections.last_mut().unwrap().rows.push(raw.to_string());
        index += 1;
    }
    let sections = sections
        .iter()
        .map(|section| {
            let change_kind = section_change_kind(section);
            PatchSection {
                path: section
                    .new_path
                    .clone()
                    .or_else(|| section.old_path.clone()),
                old_path: (change_kind == EditChangeKind::Renamed)
                    .then(|| section.old_path.clone())
                    .flatten(),
                change_kind,
                body: section.rows.join("\n"),
            }
        })
        .collect();
    (sections, source.truncated)
}

// ---- Patch text and begin_patch -------------------------------------------------------------

/// Codex reports a change to several files under the path `N files`, which names no file.
fn is_file_count_path(path: &str) -> bool {
    static COUNT: OnceLock<Regex> = OnceLock::new();
    COUNT
        .get_or_init(|| Regex::new(r"^\d+ files?$").unwrap())
        .is_match(path)
}

/// Strips only a final-line `Moved to:`. Unanchored matching would truncate literal file
/// content and invent renames.
fn split_move_marker(patch: &str) -> (&str, Option<String>) {
    static MARKER: OnceLock<Regex> = OnceLock::new();
    let marker = MARKER.get_or_init(|| Regex::new(r"(?:^|\n)Moved to: (.+)$").unwrap());
    match marker.captures(patch) {
        Some(found) => (
            &patch[..found.get(0).unwrap().start()],
            Some(found[1].trim().to_string()),
        ),
        None => (patch, None),
    }
}

fn files_from_patch_text(patch_text: &str, caller_path: Option<&str>) -> Option<Vec<EditFile>> {
    if caller_path.is_some_and(is_file_count_path) {
        // A file count cannot name a card, whatever the patch says.
        return None;
    }
    let (body, moved_to) = split_move_marker(patch_text);
    // Separate files into cards so later rows never inherit the first file's name.
    let (sections, split_truncated) = unified_patch_sections(body);
    // The caller's path wins for a single-file patch; several files or a rename destination
    // need their headers. Unnamed preambles do not count as files.
    let named_sections = sections
        .iter()
        .filter(|section| section.path.is_some())
        .count();
    let mut files: Vec<EditFile> = sections
        .iter()
        .filter_map(|section| {
            let parsed = lines_from_unified_patch(&section.body, false);
            if parsed.is_none() && section.path.is_none() {
                return None;
            }
            let path = if named_sections <= 1 && section.old_path.is_none() {
                caller_path
                    .map(str::to_string)
                    .or_else(|| section.path.clone())
            } else {
                section
                    .path
                    .clone()
                    .or_else(|| caller_path.map(str::to_string))
            }
            .unwrap_or_else(|| "file".to_string());
            let (lines, known, truncated) = match parsed {
                Some(parsed) => (parsed.lines, parsed.line_numbers_known, parsed.truncated),
                None => (vec![], false, false),
            };
            Some(finalize(Draft {
                path,
                old_path: section.old_path.clone(),
                change_kind: section.change_kind,
                lines,
                line_numbers_known: known,
                truncated: split_truncated || truncated,
            }))
        })
        .collect();
    // The move marker names where the whole patch moved, so it only speaks for one file.
    if let (Some(moved), 1) = (moved_to, files.len()) {
        let only = files.remove(0);
        return Some(vec![EditFile {
            path: moved,
            old_path: Some(only.path),
            change_kind: EditChangeKind::Renamed,
            ..only
        }]);
    }
    (!files.is_empty()).then_some(files)
}

const BEGIN: &str = "*** Begin Patch";
const END: &str = "*** End Patch";

/// Argument names that can carry a patch envelope; other values may be file data quoting an
/// unrelated patch.
const ENVELOPE_ARGUMENTS: [&str; 5] = ["input", "command", "patch", "arguments", "script"];

fn mentions_apply_command(word: &str) -> bool {
    static APPLY: OnceLock<Regex> = OnceLock::new();
    APPLY
        .get_or_init(|| Regex::new(r"apply_?patch").unwrap())
        .is_match(word)
}

fn envelope_argument(record: &Map<String, Value>, require_apply_command: bool) -> Option<String> {
    for key in ENVELOPE_ARGUMENTS {
        let words: Vec<&str> = match record.get(key) {
            Some(Value::String(word)) => vec![word.as_str()],
            Some(Value::Array(entries)) => entries.iter().filter_map(Value::as_str).collect(),
            _ => vec![],
        };
        // An argv element may carry the envelope while another names the apply command.
        if require_apply_command && !words.iter().any(|word| mentions_apply_command(word)) {
            continue;
        }
        if let Some(word) = words.iter().find(|word| word.contains(BEGIN)) {
            return Some((*word).to_string());
        }
    }
    None
}

/// Recovers an envelope from patch or command arguments, including argv words. General command
/// tools must show an apply command: a quoted envelope alone proves no edit occurred.
fn unwrap_begin_patch(input: &Value, require_apply_command: bool) -> Option<String> {
    let source = match input {
        Value::String(text) => {
            let parsed = text
                .trim_start()
                .starts_with('{')
                .then(|| serde_json::from_str::<Value>(text).ok())
                .flatten();
            match parsed {
                Some(Value::Object(record)) => envelope_argument(&record, require_apply_command),
                _ => (!require_apply_command || mentions_apply_command(text)).then(|| text.clone()),
            }
        }
        Value::Object(record) => envelope_argument(record, require_apply_command),
        _ => None,
    }?;
    let start = source.find(BEGIN)?;
    // The end marker is required so trailing shell syntax cannot become file content.
    let end = start + source[start..].find(END)?;
    Some(source[start..end + END.len()].to_string())
}

/// Splits a `*** Begin Patch` envelope into one entry per file it touches.
fn files_from_begin_patch(envelope: &str) -> Vec<EditFile> {
    struct Part {
        kind: &'static str,
        path: String,
        body: Vec<String>,
        moved: Option<String>,
    }
    static FILE_HEADER: OnceLock<Regex> = OnceLock::new();
    static MOVE_HEADER: OnceLock<Regex> = OnceLock::new();
    static CONTROL: OnceLock<Regex> = OnceLock::new();
    let file_header =
        FILE_HEADER.get_or_init(|| Regex::new(r"^\*\*\* (Add|Update|Delete) File: (.+)$").unwrap());
    let move_header = MOVE_HEADER.get_or_init(|| Regex::new(r"^\*\*\* Move to: (.+)$").unwrap());
    let control =
        CONTROL.get_or_init(|| Regex::new(r"^\*\*\* (?:End of File|Environment ID:)").unwrap());
    let mut parts: Vec<Part> = vec![];
    for raw in envelope
        .split('\n')
        .map(|row| row.strip_suffix('\r').unwrap_or(row))
    {
        if let Some(header) = file_header.captures(raw) {
            parts.push(Part {
                kind: match &header[1] {
                    "Add" => "Add",
                    "Delete" => "Delete",
                    _ => "Update",
                },
                path: header[2].trim().to_string(),
                body: vec![],
                moved: None,
            });
        } else if let (Some(found), Some(part)) = (move_header.captures(raw), parts.last_mut()) {
            part.moved = Some(found[1].trim().to_string());
        } else if raw == BEGIN || raw == END || control.is_match(raw) {
        } else if let Some(part) = parts.last_mut() {
            part.body.push(raw.to_string());
        }
    }
    parts
        .into_iter()
        .map(|part| {
            if part.kind != "Update" {
                let add = part.kind == "Add";
                let sign = if add { '+' } else { '-' };
                // Add and Delete bodies carry a sign per line but no hunk header.
                let stripped = part
                    .body
                    .iter()
                    .map(|line| line.strip_prefix(sign).unwrap_or(line).to_string())
                    .collect::<Vec<_>>()
                    .join("\n");
                let (lines, truncated) = lines_from_whole_file(
                    &stripped,
                    if add {
                        EditLineKind::Add
                    } else {
                        EditLineKind::Del
                    },
                );
                return finalize(Draft {
                    path: part.path,
                    old_path: None,
                    change_kind: if add {
                        EditChangeKind::Added
                    } else {
                        EditChangeKind::Deleted
                    },
                    lines,
                    line_numbers_known: true,
                    truncated,
                });
            }
            // A file named by an empty or headerless section is kept: dropping it would
            // misreport a multi-file edit.
            let parsed = lines_from_unified_patch(&part.body.join("\n"), true);
            let (lines, known, truncated) = match parsed {
                Some(parsed) => (parsed.lines, parsed.line_numbers_known, parsed.truncated),
                None => (vec![], false, false),
            };
            let (path, old_path, change_kind) = match part.moved {
                Some(moved) => (moved, Some(part.path), EditChangeKind::Renamed),
                None => (part.path, None, EditChangeKind::Edited),
            };
            finalize(Draft {
                path,
                old_path,
                change_kind,
                lines,
                line_numbers_known: known,
                truncated,
            })
        })
        .collect()
}

// ---- Tool pairs -----------------------------------------------------------------------------

/// `NotebookEdit` has only new cell text, so a diff card would mark unchanged cells added:
/// it keeps the generic row.
/// Pi and OMP name theirs `edit` and `write` (`path`, `oldText`/`newText`, `content`); an input of
/// another shape finds no file here and keeps its plain row.
const CLAUDE_EDIT_TOOLS: [&str; 6] = ["Edit", "MultiEdit", "Write", "str_replace", "edit", "write"];
/// Command tools can quote patches without applying them.
const COMMAND_PATCH_TOOLS: [&str; 3] = ["exec", "shell", "local_shell"];

fn is_patch_envelope_tool(name: &str) -> bool {
    name == "apply_patch" || COMMAND_PATCH_TOOLS.contains(&name)
}

/// Codex's `fileChange` item, as the bridge names it.
const CODEX_CHANGES_TOOL: &str = "file changes";

pub fn is_edit_tool_name(name: &str) -> bool {
    CLAUDE_EDIT_TOOLS.contains(&name) || is_patch_envelope_tool(name) || name == CODEX_CHANGES_TOOL
}

fn text<'a>(value: &'a Map<String, Value>, key: &str) -> Option<&'a str> {
    value.get(key).and_then(Value::as_str)
}

/// The patch sits in its own result as hunks that carry true file positions.
fn lines_from_edit_patch(patch: &NativeUiEditPatch) -> Vec<EditLine> {
    let mut lines = vec![];
    for hunk in &patch.hunks {
        // Hunks are separated so a skipped file region stays visible.
        push_gap(&mut lines);
        let (mut old_no, mut new_no) = (Some(hunk.old_start), Some(hunk.new_start));
        for raw in &hunk.lines {
            if let Some(text) = raw.strip_prefix('+') {
                lines.push(row(EditLineKind::Add, text, None, new_no));
                new_no = new_no.map(|n| n + 1);
            } else if let Some(text) = raw.strip_prefix('-') {
                lines.push(row(EditLineKind::Del, text, old_no, None));
                old_no = old_no.map(|n| n + 1);
            } else {
                let text = raw.strip_prefix(' ').unwrap_or(raw);
                lines.push(row(EditLineKind::Context, text, old_no, new_no));
                old_no = old_no.map(|n| n + 1);
                new_no = new_no.map(|n| n + 1);
            }
        }
    }
    lines
}

/// A whole-file write does not prove creation; an overwrite called new would misreport every
/// existing line. Only positive evidence counts.
fn whole_content_change_kind(input: &Map<String, Value>, output: Option<&str>) -> EditChangeKind {
    if text(input, "command") == Some("create")
        || output.is_some_and(|out| out.trim_start().starts_with("File created successfully"))
    {
        EditChangeKind::Added
    } else {
        EditChangeKind::Edited
    }
}

fn snippet(entry: &Map<String, Value>, snake: &str, camel: &str) -> Option<String> {
    text(entry, snake)
        .or_else(|| text(entry, camel))
        .map(str::to_string)
}

/// `MultiEdit` carries its snippet pairs in `edits[]`.
fn multi_edit_files(input: &Map<String, Value>, path: &str) -> Option<Vec<EditFile>> {
    let mut lines = vec![];
    let mut truncated = false;
    for entry in input.get("edits")?.as_array()? {
        let Some(edit) = entry.as_object() else {
            continue;
        };
        let old = snippet(edit, "old_string", "oldString");
        let new = snippet(edit, "new_string", "newString");
        if old.is_none() && new.is_none() {
            continue;
        }
        // Each entry is its own snippet, so it starts a new region.
        push_gap(&mut lines);
        let (diffed, clipped) =
            lines_from_contents(old.as_deref().unwrap_or(""), new.as_deref().unwrap_or(""));
        lines.extend(diffed);
        truncated |= clipped;
    }
    (!lines.is_empty()).then(|| {
        vec![finalize(Draft {
            path: path.to_string(),
            old_path: None,
            change_kind: EditChangeKind::Edited,
            lines,
            // A snippet pair cannot say where in the file it sits.
            line_numbers_known: false,
            truncated,
        })]
    })
}

fn claude_edit_files(
    name: &str,
    input: &Map<String, Value>,
    output: Option<&str>,
) -> Option<Vec<EditFile>> {
    let path = text(input, "file_path")
        .or_else(|| text(input, "path"))
        .unwrap_or("file");
    if name == "MultiEdit" {
        return multi_edit_files(input, path);
    }
    let old =
        snippet(input, "old_string", "oldString").or_else(|| snippet(input, "oldText", "old_text"));
    let new =
        snippet(input, "new_string", "newString").or_else(|| snippet(input, "newText", "new_text"));
    let content = text(input, "content").or_else(|| text(input, "file_text"));
    if let (None, Some(content)) = (&old, content) {
        let (lines, truncated) = lines_from_whole_file(content, EditLineKind::Add);
        return Some(vec![finalize(Draft {
            path: path.to_string(),
            old_path: None,
            change_kind: whole_content_change_kind(input, output),
            lines,
            line_numbers_known: true,
            truncated,
        })]);
    }
    if old.is_none() && new.is_none() {
        return None;
    }
    let (lines, truncated) = lines_from_contents(
        old.as_deref().unwrap_or(""),
        new.as_deref().or(content).unwrap_or(""),
    );
    Some(vec![finalize(Draft {
        path: path.to_string(),
        old_path: None,
        change_kind: EditChangeKind::Edited,
        lines,
        // A snippet pair cannot say where in the file it sits.
        line_numbers_known: false,
        truncated,
    })])
}

fn codex_change_files(changes: &[Value]) -> Vec<EditFile> {
    changes
        .iter()
        .filter_map(|entry| {
            let change = entry.as_object()?;
            let path = text(change, "path").filter(|path| !path.is_empty())?;
            let diff = text(change, "diff").filter(|diff| !diff.is_empty())?;
            let kind = change.get("kind").and_then(Value::as_object);
            let kind_type = kind
                .and_then(|kind| text(kind, "type"))
                .or_else(|| text(change, "kind"))
                .unwrap_or("update");
            let move_path = kind
                .and_then(|kind| text(kind, "move_path"))
                .or_else(|| text(change, "movePath"));
            if kind_type == "add" || kind_type == "delete" {
                // Add and delete arrive as raw file content, with no hunk header or signs.
                let add = kind_type == "add";
                let (lines, truncated) = lines_from_whole_file(
                    diff,
                    if add {
                        EditLineKind::Add
                    } else {
                        EditLineKind::Del
                    },
                );
                return Some(finalize(Draft {
                    path: path.to_string(),
                    old_path: None,
                    change_kind: if add {
                        EditChangeKind::Added
                    } else {
                        EditChangeKind::Deleted
                    },
                    lines,
                    line_numbers_known: true,
                    truncated,
                }));
            }
            let parsed = lines_from_unified_patch(split_move_marker(diff).0, false)?;
            Some(finalize(Draft {
                path: move_path.unwrap_or(path).to_string(),
                old_path: move_path.map(|_| path.to_string()),
                change_kind: if move_path.is_some() {
                    EditChangeKind::Renamed
                } else {
                    EditChangeKind::Edited
                },
                lines: parsed.lines,
                line_numbers_known: parsed.line_numbers_known,
                truncated: parsed.truncated,
            }))
        })
        .collect()
}

/// A provider's input text as a value: a JSON object or array is parsed, anything else (a Codex
/// shell command) stays a string. Input that is clipped mid-JSON does not parse, so it stays a
/// string and yields no card.
fn parse_input(name: &str, input: &str) -> Value {
    let trimmed = input.trim_start();
    if trimmed.starts_with('{') || trimmed.starts_with('[') {
        match serde_json::from_str::<Value>(input) {
            // Codex's file-change item arrives as the changes array itself.
            Ok(Value::Array(changes)) if name == CODEX_CHANGES_TOOL => {
                return serde_json::json!({ "changes": changes });
            }
            Ok(value @ (Value::Object(_) | Value::Array(_))) => return value,
            _ => {}
        }
    }
    Value::String(input.to_string())
}

/// The result a call's card reads: its text, whether it failed and, for Claude, its hunks.
pub struct EditResult<'a> {
    pub output: &'a str,
    pub is_error: bool,
    pub edit_patch: Option<&'a NativeUiEditPatch>,
}

/// Orca `editFilesFromToolPair`. A card asserts a landed edit, so it needs a completed lifecycle
/// or a result that is not an error; failed, running and unanswered calls keep their generic row.
pub fn files_from_tool_pair(
    name: &str,
    input: &str,
    state: Option<NativeUiToolState>,
    result: Option<&EditResult>,
) -> Option<Vec<EditFile>> {
    if !is_edit_tool_name(name)
        || matches!(
            state,
            Some(NativeUiToolState::Failed | NativeUiToolState::Running)
        )
        || result.is_some_and(|result| result.is_error)
        || (state != Some(NativeUiToolState::Completed) && result.is_none())
    {
        return None;
    }
    let input = parse_input(name, input);
    let record = input.as_object();
    if let Some(patch) = result
        .and_then(|result| result.edit_patch)
        .filter(|patch| !patch.hunks.is_empty())
    {
        return Some(vec![finalize(Draft {
            path: patch
                .file_path
                .clone()
                .or_else(|| {
                    record
                        .and_then(|r| text(r, "file_path"))
                        .map(str::to_string)
                })
                .unwrap_or_else(|| "file".to_string()),
            old_path: None,
            change_kind: EditChangeKind::Edited,
            lines: lines_from_edit_patch(patch),
            line_numbers_known: true,
            truncated: false,
        })]);
    }
    let clipped = record.is_some_and(|r| r.get(CLIPPED_KEY) == Some(&Value::Bool(true)));
    let files = files_from_input(name, &input, record, result.map(|r| r.output))?;
    Some(if clipped {
        files
            .into_iter()
            .map(|file| EditFile {
                truncated: true,
                ..file
            })
            .collect()
    } else {
        files
    })
}

fn files_from_input(
    name: &str,
    input: &Value,
    record: Option<&Map<String, Value>>,
    output: Option<&str>,
) -> Option<Vec<EditFile>> {
    // Search envelopes only in eligible patch tools: a Write's content can quote an unrelated
    // patch and would hide the file actually written.
    if is_patch_envelope_tool(name) {
        if let Some(envelope) = unwrap_begin_patch(input, COMMAND_PATCH_TOOLS.contains(&name)) {
            let files = files_from_begin_patch(&envelope);
            if !files.is_empty() {
                return Some(files);
            }
        }
    }
    if let Some(changes) = record
        .and_then(|r| r.get("changes"))
        .and_then(Value::as_array)
    {
        let files = codex_change_files(changes);
        if !files.is_empty() {
            return Some(files);
        }
    }
    let record = record?;
    if CLAUDE_EDIT_TOOLS.contains(&name) {
        return claude_edit_files(name, record, output);
    }
    if name != "apply_patch" {
        return None;
    }
    let patch = text(record, "patch").or_else(|| text(record, "diff"))?;
    files_from_patch_text(
        patch,
        text(record, "path").or_else(|| text(record, "file_path")),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::NativeUiEditHunk;
    use serde_json::json;

    fn unified_line_number(line: &EditLine) -> Option<u32> {
        if line.kind == EditLineKind::Del {
            line.old_line_number
        } else {
            line.new_line_number.or(line.old_line_number)
        }
    }

    fn gutter(files: &Option<Vec<EditFile>>) -> Vec<Option<u32>> {
        files
            .iter()
            .flatten()
            .flat_map(|file| file.lines.iter().map(unified_line_number))
            .collect()
    }

    /// Cards need landed-edit evidence: these fixtures report completed calls.
    fn settled(name: &str, input: Value) -> Option<Vec<EditFile>> {
        settled_with(name, input, None)
    }

    fn settled_with(name: &str, input: Value, result: Option<EditResult>) -> Option<Vec<EditFile>> {
        let input = match input {
            Value::String(text) => text,
            other => other.to_string(),
        };
        files_from_tool_pair(
            name,
            &input,
            Some(NativeUiToolState::Completed),
            result.as_ref(),
        )
    }

    fn output(text: &str) -> EditResult<'_> {
        EditResult {
            output: text,
            is_error: false,
            edit_patch: None,
        }
    }

    fn kinds(file: &EditFile) -> Vec<EditLineKind> {
        file.lines.iter().map(|line| line.kind).collect()
    }

    fn texts(file: &EditFile) -> Vec<&str> {
        file.lines.iter().map(|line| line.text.as_str()).collect()
    }

    fn unified(text: &str) -> Option<UnifiedPatchLines> {
        lines_from_unified_patch(text, false)
    }

    use EditLineKind::{Add, Context, Del, Gap};

    // ---- Orca native-chat-edit-normalize.test.ts: editLinesFromUnifiedPatch ----

    #[test]
    fn numbers_deletes_from_the_old_side_and_adds_from_the_new_side() {
        let parsed = unified("@@ -12,3 +12,3 @@\n ctx\n-was\n+now\n tail").unwrap();
        assert!(parsed.line_numbers_known);
        let rows: Vec<_> = parsed
            .lines
            .iter()
            .map(|line| (line.kind, unified_line_number(line)))
            .collect();
        assert_eq!(
            rows,
            [
                (Context, Some(12)),
                (Del, Some(13)),
                (Add, Some(13)),
                (Context, Some(14))
            ]
        );
    }

    #[test]
    fn leaves_rows_unnumbered_when_the_hunk_header_carries_no_ranges() {
        let parsed = unified("@@\n ctx\n-was\n+now").unwrap();
        assert!(!parsed.line_numbers_known);
        assert!(parsed
            .lines
            .iter()
            .all(|line| unified_line_number(line).is_none()));
    }

    #[test]
    fn text_with_no_hunk_header_is_not_a_patch() {
        assert!(unified("just prose\n- a bullet").is_none());
    }

    #[test]
    fn a_no_newline_marker_does_not_close_the_hunk() {
        let parsed = unified(
            "@@ -1,2 +1,2 @@\n keep\n-old\n\\ No newline at end of file\n+new\n\\ No newline at end of file",
        )
        .unwrap();
        let rows: Vec<_> = parsed
            .lines
            .iter()
            .map(|l| (l.kind, l.text.as_str()))
            .collect();
        assert_eq!(rows, [(Context, "keep"), (Del, "old"), (Add, "new")]);
    }

    #[test]
    fn a_removed_line_starting_with_dashes_is_content_not_a_file_header() {
        let parsed = unified("@@ -1,4 +1,3 @@\n keep\n--- comment\n-gone\n tail").unwrap();
        let rows: Vec<_> = parsed
            .lines
            .iter()
            .map(|l| (l.kind, l.text.as_str()))
            .collect();
        assert_eq!(
            rows,
            [
                (Context, "keep"),
                (Del, "-- comment"),
                (Del, "gone"),
                (Context, "tail")
            ]
        );
    }

    #[test]
    fn skips_a_real_file_header_pair_outside_a_hunk() {
        let parsed = unified(
            "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1,1 +1,1 @@\n-was\n+now",
        )
        .unwrap();
        let rows: Vec<_> = parsed
            .lines
            .iter()
            .map(|l| (l.kind, l.text.as_str()))
            .collect();
        assert_eq!(rows, [(Del, "was"), (Add, "now")]);
    }

    #[test]
    fn splits_crlf_rows_without_a_carriage_return_or_phantom_row() {
        let parsed = unified("@@ -1,2 +1,2 @@\r\n ctx\r\n-was\r\n+now\r\n").unwrap();
        let rows: Vec<_> = parsed.lines.iter().map(|l| l.text.as_str()).collect();
        assert_eq!(rows, ["ctx", "was", "now"]);
    }

    #[test]
    fn reports_truncation_past_the_character_cap() {
        let body = format!("@@ -1,1 +1,1 @@\n{}", "+x\n".repeat(MAX_EDIT_CHARS));
        assert!(unified(&body).unwrap().truncated);
    }

    #[test]
    fn marks_the_break_between_hunks_and_only_between_them() {
        let parsed =
            unified("@@ -40,2 +40,2 @@\n keep\n-was\n@@ -310,2 +310,2 @@\n+now\n tail").unwrap();
        let rows: Vec<_> = parsed
            .lines
            .iter()
            .map(|line| (line.kind, unified_line_number(line)))
            .collect();
        assert_eq!(
            rows,
            [
                (Context, Some(40)),
                (Del, Some(41)),
                (Gap, None),
                (Add, Some(310)),
                (Context, Some(311))
            ]
        );
    }

    #[test]
    fn reads_a_headerless_body_as_an_unlocatable_hunk_only_when_asked() {
        let parsed = lines_from_unified_patch("-was\n+now", true).unwrap();
        assert_eq!(
            parsed.lines.iter().map(|l| l.kind).collect::<Vec<_>>(),
            [Del, Add]
        );
        assert!(!parsed.line_numbers_known);
        assert!(unified("-was\n+now").is_none());
    }

    // ---- unwrapBeginPatch ----

    #[test]
    fn recovers_an_envelope_carried_in_one_word_of_an_argument_vector() {
        let envelope = "*** Begin Patch\n*** Update File: a.ts\n@@\n-x\n+y\n*** End Patch";
        let input = json!({"command": ["bash", "-lc", format!("apply_patch <<'EOF'\n{envelope}\nEOF")], "workdir": "/repo"});
        assert_eq!(unwrap_begin_patch(&input, false).as_deref(), Some(envelope));
    }

    #[test]
    fn leaves_an_already_decoded_envelope_alone() {
        let plain = "*** Begin Patch\n*** Update File: a.ts\n@@\n-x\n+y\n*** End Patch";
        assert_eq!(
            unwrap_begin_patch(&Value::String(plain.into()), false).as_deref(),
            Some(plain)
        );
    }

    #[test]
    fn input_with_no_envelope_unwraps_to_nothing() {
        assert_eq!(
            unwrap_begin_patch(&Value::String("ls -la".into()), false),
            None
        );
    }

    #[test]
    fn declines_an_envelope_with_no_closing_marker() {
        let command = "bash -c \"*** Begin Patch\n*** Update File: a.ts\n@@\n-x\n+y\" && echo ok";
        assert_eq!(
            unwrap_begin_patch(&Value::String(command.into()), false),
            None
        );
        assert!(settled("shell", json!(command)).is_none());
    }

    // ---- editFilesFromToolPair ----

    #[test]
    fn renders_an_apply_patch_run_through_a_command_tool() {
        let files = settled(
            "exec",
            json!({"command": ["bash", "-lc", "apply_patch <<'EOF'\n*** Begin Patch\n*** Update File: src/a.ts\n@@\n ctx\n-was\n+now\n*** End Patch\nEOF"]}),
        )
        .unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "src/a.ts");
        assert_eq!(files[0].change_kind, EditChangeKind::Edited);
        assert_eq!((files[0].added, files[0].removed), (1, 1));
        // Codex hunk headers are context anchors, so no row may claim a file position.
        assert!(!files[0].line_numbers_known);
    }

    #[test]
    fn numbers_an_added_file_from_one() {
        let files = settled(
            "exec",
            json!("apply_patch <<'EOF'\n*** Begin Patch\n*** Add File: new.ts\n+one\n+two\n*** End Patch\nEOF"),
        );
        assert_eq!(
            files.as_ref().unwrap()[0].change_kind,
            EditChangeKind::Added
        );
        assert!(files.as_ref().unwrap()[0].line_numbers_known);
        assert_eq!(gutter(&files), [Some(1), Some(2)]);
    }

    #[test]
    fn keeps_a_file_whose_update_body_carries_no_hunk_header() {
        let files = settled(
            "apply_patch",
            json!({"input": "*** Begin Patch\n*** Update File: first.ts\n ctx\n-was\n+now\n*** Update File: second.ts\n@@ -1,1 +1,1 @@\n-a\n+b\n*** End Patch"}),
        )
        .unwrap();
        let paths: Vec<_> = files.iter().map(|file| file.path.as_str()).collect();
        assert_eq!(paths, ["first.ts", "second.ts"]);
        assert_eq!(kinds(&files[0]), [Context, Del, Add]);
        assert!(!files[0].line_numbers_known);
    }

    #[test]
    fn does_not_render_envelope_control_lines_as_file_content() {
        let files = settled(
            "apply_patch",
            json!({"input": "*** Begin Patch\n*** Environment ID: abc123\n*** Update File: a.ts\n@@\n-was\n+now\n*** End of File\n*** End Patch"}),
        )
        .unwrap();
        assert_eq!(texts(&files[0]), ["was", "now"]);
    }

    #[test]
    fn reports_a_delete_that_names_the_file_and_carries_no_body() {
        let files = settled(
            "apply_patch",
            json!({"input": "*** Begin Patch\n*** Delete File: gone.ts\n*** End Patch"}),
        )
        .unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].change_kind, EditChangeKind::Deleted);
        assert_eq!(files[0].path, "gone.ts");
        assert!(files[0].lines.is_empty());
    }

    #[test]
    fn reads_a_crlf_envelope() {
        let files = settled(
            "apply_patch",
            json!({"input": "*** Begin Patch\r\n*** Update File: a.ts\r\n@@ -1,2 +1,2 @@\r\n-was\r\n+now\r\n*** End Patch"}),
        )
        .unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "a.ts");
        assert_eq!(texts(&files[0]), ["was", "now"]);
    }

    fn patch_result(hunks: Vec<NativeUiEditHunk>) -> NativeUiEditPatch {
        NativeUiEditPatch {
            file_path: Some("/repo/a.ts".into()),
            hunks,
        }
    }

    fn hunk(start: u32, lines: &[&str]) -> NativeUiEditHunk {
        NativeUiEditHunk {
            old_start: start,
            old_lines: 1,
            new_start: start,
            new_lines: 1,
            lines: lines.iter().map(|line| line.to_string()).collect(),
        }
    }

    #[test]
    fn marks_the_break_between_resolved_hunks_that_sit_far_apart() {
        let patch = patch_result(vec![
            hunk(42, &["-was", "+now"]),
            hunk(310, &["-old", "+new"]),
        ]);
        let result = EditResult {
            output: "",
            is_error: false,
            edit_patch: Some(&patch),
        };
        let files = settled_with("Edit", json!({"file_path": "/repo/a.ts"}), Some(result));
        assert_eq!(
            kinds(&files.as_ref().unwrap()[0]),
            [Del, Add, Gap, Del, Add]
        );
        // A break marks nothing at either end and counts no change of its own.
        assert_eq!(files.as_ref().unwrap()[0].added, 2);
        assert_eq!(files.as_ref().unwrap()[0].removed, 2);
        assert_eq!(
            gutter(&files),
            [Some(42), Some(42), None, Some(310), Some(310)]
        );
    }

    #[test]
    fn reads_a_move_header_as_a_rename() {
        let files = settled(
            "exec",
            json!("apply_patch <<'EOF'\n*** Begin Patch\n*** Update File: old.ts\n*** Move to: new.ts\n@@\n-a\n+b\n*** End Patch\nEOF"),
        )
        .unwrap();
        assert_eq!(files[0].change_kind, EditChangeKind::Renamed);
        assert_eq!(files[0].old_path.as_deref(), Some("old.ts"));
        assert_eq!(files[0].path, "new.ts");
    }

    #[test]
    fn interleaves_a_claude_snippet_pair_without_claiming_line_positions() {
        let files = settled(
            "Edit",
            json!({"file_path": "/repo/a.ts", "old_string": "keep\nwas\ntail", "new_string": "keep\nnow\ntail"}),
        )
        .unwrap();
        assert_eq!(kinds(&files[0]), [Context, Del, Add, Context]);
        assert!(!files[0].line_numbers_known);
    }

    #[test]
    fn prefers_the_resolved_hunks_on_the_result_over_the_snippet_pair() {
        let patch = patch_result(vec![NativeUiEditHunk {
            old_start: 12,
            old_lines: 3,
            new_start: 12,
            new_lines: 3,
            lines: vec![" ctx".into(), "-was".into(), "+now".into(), " tail".into()],
        }]);
        let result = EditResult {
            output: "",
            is_error: false,
            edit_patch: Some(&patch),
        };
        let files = settled_with(
            "Edit",
            json!({"file_path": "/repo/a.ts", "old_string": "was", "new_string": "now"}),
            Some(result),
        );
        assert!(files.as_ref().unwrap()[0].line_numbers_known);
        assert_eq!(gutter(&files), [Some(12), Some(13), Some(13), Some(14)]);
    }

    #[test]
    fn treats_a_write_the_provider_reported_as_a_creation_as_an_added_file() {
        let files = settled_with(
            "Write",
            json!({"file_path": "/repo/new.ts", "content": "one\ntwo\n"}),
            Some(output("File created successfully at: /repo/new.ts")),
        );
        assert_eq!(
            files.as_ref().unwrap()[0].change_kind,
            EditChangeKind::Added
        );
        assert_eq!(gutter(&files), [Some(1), Some(2)]);
    }

    #[test]
    fn does_not_claim_a_creation_for_a_write_over_an_existing_file() {
        let overwrite = settled_with(
            "Write",
            json!({"file_path": "/repo/a.ts", "content": "one\ntwo\n"}),
            Some(output("The file /repo/a.ts has been updated.")),
        );
        assert_eq!(overwrite.unwrap()[0].change_kind, EditChangeKind::Edited);
        let unreported = settled(
            "Write",
            json!({"file_path": "/repo/a.ts", "content": "one\n"}),
        );
        assert_eq!(unreported.unwrap()[0].change_kind, EditChangeKind::Edited);
    }

    #[test]
    fn reads_a_multi_edit_whose_snippet_pairs_sit_in_edits() {
        let files = settled(
            "MultiEdit",
            json!({"file_path": "/repo/a.ts", "edits": [
                {"old_string": "was", "new_string": "now"},
                {"old_string": "gone", "new_string": "kept"}]}),
        )
        .unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "/repo/a.ts");
        // Each entry is its own region, so a break separates them.
        let rows: Vec<_> = files[0]
            .lines
            .iter()
            .map(|l| (l.kind, l.text.as_str()))
            .collect();
        assert_eq!(
            rows,
            [
                (Del, "was"),
                (Add, "now"),
                (Gap, ""),
                (Del, "gone"),
                (Add, "kept")
            ]
        );
        assert_eq!((files[0].added, files[0].removed), (2, 2));
    }

    #[test]
    fn pi_style_lowercase_edit_and_write_make_cards() {
        let edit = settled(
            "edit",
            json!({"path": "src/a.ts", "oldText": "was", "newText": "now"}),
        )
        .unwrap();
        assert_eq!(
            (edit[0].path.as_str(), edit[0].added, edit[0].removed),
            ("src/a.ts", 1, 1)
        );
        let write = settled("write", json!({"path": "b.txt", "content": "x\ny"})).unwrap();
        assert_eq!((write[0].added, write[0].removed), (2, 0));
        // A shape it does not know keeps the plain row.
        assert!(settled("edit", json!({"path": "a", "edits": [{"op": "x"}]})).is_none());
    }

    #[test]
    fn leaves_a_notebook_edit_to_the_generic_tool_view() {
        assert!(!is_edit_tool_name("NotebookEdit"));
    }

    #[test]
    fn drops_gutter_numbers_that_locate_a_snippet_rather_than_the_file() {
        let files = settled(
            "Edit",
            json!({"file_path": "/repo/a.ts", "old_string": "keep\nwas", "new_string": "keep\nnow"}),
        );
        assert!(!files.as_ref().unwrap()[0].line_numbers_known);
        assert_eq!(gutter(&files), [None, None, None]);
    }

    #[test]
    fn renders_no_card_for_an_edit_that_was_rejected_or_has_not_landed() {
        let input =
            json!({"file_path": "/repo/a.ts", "old_string": "missing", "new_string": "now"})
                .to_string();
        let rejected = EditResult {
            output: "String to replace not found in file.",
            is_error: true,
            edit_patch: None,
        };
        assert!(files_from_tool_pair(
            "Edit",
            &input,
            Some(NativeUiToolState::Completed),
            Some(&rejected)
        )
        .is_none());
        let changes = json!({"changes": [{"path": "a.ts", "kind": {"type": "update"}, "diff": "@@ -1 +1 @@\n-a\n+b"}]}).to_string();
        assert!(files_from_tool_pair(
            "apply_patch",
            &changes,
            Some(NativeUiToolState::Failed),
            None
        )
        .is_none());
        assert!(
            files_from_tool_pair("Edit", &input, Some(NativeUiToolState::Running), None).is_none()
        );
    }

    #[test]
    fn does_not_read_a_command_tool_result_as_a_file_edit() {
        let patch = "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-was\n+now";
        assert!(
            settled_with("exec", json!({"command": "git diff"}), Some(output(patch))).is_none()
        );
    }

    #[test]
    fn reports_truncation_when_content_runs_past_the_character_cap() {
        let content = format!("{}\nlast\n", "x".repeat(MAX_EDIT_CHARS));
        let files = settled(
            "Write",
            json!({"file_path": "/repo/a.ts", "content": content}),
        )
        .unwrap();
        assert!(files[0].truncated);
        // The clipped body ends mid-line, so its one row is real and must survive.
        assert_eq!(files[0].lines.len(), 1);
    }

    #[test]
    fn reads_codex_structured_changes_stripping_the_move_marker() {
        let files = settled(
            "apply_patch",
            json!({"changes": [{"path": "old.ts", "kind": {"type": "update", "move_path": "new.ts"}, "diff": "@@ -1,2 +1,2 @@\n-a\n+b\n\nMoved to: new.ts"}]}),
        );
        let file = &files.as_ref().unwrap()[0];
        assert_eq!(file.change_kind, EditChangeKind::Renamed);
        assert!(!file.lines.iter().any(|line| line.text.contains("Moved to")));
        assert_eq!(gutter(&files), [Some(1), Some(1)]);
    }

    #[test]
    fn reads_the_changes_array_the_codex_bridge_sends_under_its_own_name() {
        let input = json!([{"path": "new.ts", "kind": {"type": "add"}, "diff": "one\ntwo"}]);
        let files = files_from_tool_pair(
            "file changes",
            &input.to_string(),
            Some(NativeUiToolState::Completed),
            None,
        )
        .unwrap();
        assert_eq!(files[0].path, "new.ts");
        assert_eq!(files[0].change_kind, EditChangeKind::Added);
    }

    #[test]
    fn reads_a_codex_add_change_which_arrives_as_raw_content() {
        let files = settled(
            "apply_patch",
            json!({"changes": [{"path": "new.ts", "kind": {"type": "add"}, "diff": "one\ntwo"}]}),
        )
        .unwrap();
        assert_eq!(files[0].change_kind, EditChangeKind::Added);
        assert_eq!(files[0].added, 2);
    }

    #[test]
    fn renders_the_file_a_write_wrote_not_one_its_content_quotes() {
        let files = settled_with(
            "Write",
            json!({"file_path": "docs/patch-format.md", "content": "Example:\n\n*** Begin Patch\n*** Update File: src/victim.ts\n@@\n-a\n+b\n*** End Patch\n"}),
            Some(output("File created successfully at: docs/patch-format.md")),
        )
        .unwrap();
        assert_eq!(
            files.iter().map(|f| f.path.as_str()).collect::<Vec<_>>(),
            ["docs/patch-format.md"]
        );
        assert!(files[0]
            .lines
            .iter()
            .any(|line| line.text.contains("Begin Patch")));
    }

    #[test]
    fn finds_an_envelope_in_a_command_payload_that_arrived_as_json_text() {
        let envelope = "*** Begin Patch\n*** Update File: src/a.ts\n@@\n-was\n+now\n*** End Patch";
        let payload = json!({"command": ["bash", "-lc", format!("apply_patch <<'EOF'\n{envelope}\nEOF")], "workdir": "/repo"}).to_string();
        let files = settled("shell", Value::String(payload)).unwrap();
        assert_eq!(files[0].path, "src/a.ts");
        assert_eq!(files[0].added, 1);
    }

    #[test]
    fn renders_no_card_for_a_call_the_turn_never_answered() {
        let input = json!({"file_path": "/repo/a.ts", "old_string": "was", "new_string": "now"})
            .to_string();
        // No lifecycle and no result: nothing says the edit was applied.
        assert!(files_from_tool_pair("Edit", &input, None, None).is_none());
        assert_eq!(
            files_from_tool_pair("Edit", &input, Some(NativeUiToolState::Completed), None)
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            files_from_tool_pair("Edit", &input, None, Some(&output("ok")))
                .unwrap()
                .len(),
            1
        );
    }

    /// Orca's multi-file cases run through its journal `Diff` tool; Perch has none, so the
    /// same patch text arrives as an `apply_patch` call's `patch`.
    fn patch_call(path: Option<&str>, patch: &str) -> Option<Vec<EditFile>> {
        let mut input = json!({"patch": patch});
        if let Some(path) = path {
            input["path"] = json!(path);
        }
        settled("apply_patch", input)
    }

    #[test]
    fn splits_a_multi_file_patch_into_one_card_per_file() {
        let files = patch_call(
            Some("/repo/one.ts"),
            "diff --git a/one.ts b/one.ts\n--- a/one.ts\n+++ b/one.ts\n@@ -1,1 +1,1 @@\n-first\n+FIRST\ndiff --git a/two.ts b/two.ts\n--- a/two.ts\n+++ b/two.ts\n@@ -10,1 +10,1 @@\n-second\n+SECOND",
        );
        let cards = files.as_ref().unwrap();
        assert_eq!(
            cards.iter().map(|f| f.path.as_str()).collect::<Vec<_>>(),
            ["one.ts", "two.ts"]
        );
        assert_eq!(texts(&cards[0]), ["first", "FIRST"]);
        assert_eq!(gutter(&Some(vec![cards[1].clone()])), [Some(10), Some(10)]);
    }

    #[test]
    fn keeps_a_file_whose_envelope_section_carries_no_body_at_all() {
        let files = settled(
            "apply_patch",
            json!({"input": "*** Begin Patch\n*** Update File: first.ts\n@@\n-a\n+b\n*** Update File: second.ts\n*** Update File: third.ts\n@@\n-c\n+d\n*** End Patch"}),
        )
        .unwrap();
        let paths: Vec<_> = files.iter().map(|f| f.path.as_str()).collect();
        assert_eq!(paths, ["first.ts", "second.ts", "third.ts"]);
        assert!(files[1].lines.is_empty());
    }

    #[test]
    fn splits_a_multi_file_patch_written_without_per_file_preamble_lines() {
        let files = patch_call(
            Some("/repo/one.ts"),
            "--- a/one.ts\n+++ b/one.ts\n@@ -1,1 +1,1 @@\n-first\n+FIRST\n--- a/two.ts\n+++ b/two.ts\n@@ -10,1 +10,1 @@\n-second\n+SECOND",
        );
        let cards = files.unwrap();
        assert_eq!(
            cards.iter().map(|f| f.path.as_str()).collect::<Vec<_>>(),
            ["one.ts", "two.ts"]
        );
        assert_eq!(cards[1].lines[0].old_line_number, Some(10));
    }

    #[test]
    fn refuses_a_card_when_the_call_names_a_file_count_instead_of_a_file() {
        assert!(patch_call(Some("2 files"), "@@\n-a\n+b\n@@\n-c\n+d").is_none());
    }

    #[test]
    fn reads_a_move_appended_to_the_patch_body_as_a_rename() {
        let files = patch_call(
            Some("src/old.ts"),
            "@@ -1,1 +1,1 @@\n-a\n+b\n\nMoved to: src/new.ts",
        )
        .unwrap();
        assert_eq!(files[0].change_kind, EditChangeKind::Renamed);
        assert_eq!(files[0].path, "src/new.ts");
        assert_eq!(files[0].old_path.as_deref(), Some("src/old.ts"));
        assert!(!files[0]
            .lines
            .iter()
            .any(|line| line.text.contains("Moved to")));
    }

    #[test]
    fn does_not_read_a_row_that_merely_mentions_a_move_as_one() {
        let body = "@@ -1,2 +1,2 @@\n ctx\n+See Moved to: docs/archive/index.md";
        let from_patch = patch_call(Some("docs/index.md"), body).unwrap();
        let from_changes = settled(
            "apply_patch",
            json!({"changes": [{"path": "docs/index.md", "kind": {"type": "update"}, "diff": body}]}),
        )
        .unwrap();
        for files in [from_patch, from_changes] {
            assert_eq!(files[0].change_kind, EditChangeKind::Edited);
            assert_eq!(files[0].old_path, None);
            assert_eq!(files[0].path, "docs/index.md");
            assert_eq!(
                files[0].lines.last().unwrap().text,
                "See Moved to: docs/archive/index.md"
            );
        }
    }

    #[test]
    fn accepts_either_spelling_of_the_command_that_applies_an_envelope() {
        let envelope = "*** Begin Patch\n*** Update File: src/a.ts\n@@\n-was\n+now\n*** End Patch";
        let files = settled(
            "shell",
            json!({"command": ["bash", "-lc", format!("applypatch <<'EOF'\n{envelope}\nEOF")]}),
        )
        .unwrap();
        assert_eq!(files[0].path, "src/a.ts");
    }

    #[test]
    fn keeps_the_header_destination_for_a_rename_the_call_names_by_its_old_path() {
        let files = patch_call(
            Some("old.txt"),
            "diff --git a/old.txt b/new.txt\n--- a/old.txt\n+++ b/new.txt\n@@ -1,1 +1,1 @@\n-a\n+b",
        )
        .unwrap();
        assert_eq!(files[0].path, "new.txt");
        assert_eq!(files[0].old_path.as_deref(), Some("old.txt"));
    }

    #[test]
    fn does_not_read_a_command_that_only_quotes_an_envelope_as_an_edit() {
        let envelope = "*** Begin Patch\n*** Update File: src/real.ts\n@@\n-a\n+b\n*** End Patch";
        assert!(settled(
            "shell",
            json!({"command": ["bash", "-lc", format!("cat > notes.md <<'EOF'\n{envelope}\nEOF")]}),
        )
        .is_none());
    }

    #[test]
    fn does_not_call_two_compared_directories_a_rename() {
        let files = patch_call(None, "--- d1/x.ts\n+++ d2/x.ts\n@@ -1,1 +1,1 @@\n-a\n+b").unwrap();
        assert_eq!(files[0].change_kind, EditChangeKind::Edited);
        assert_eq!(files[0].old_path, None);
        assert_eq!(files[0].path, "d2/x.ts");
    }

    #[test]
    fn lets_the_call_name_the_file_when_a_preamble_precedes_the_only_header() {
        let files = patch_call(
            Some("/repo/one.ts"),
            "warning: something\ndiff --git a/one.ts b/one.ts\n--- a/one.ts\n+++ b/one.ts\n@@ -1,1 +1,1 @@\n-a\n+b",
        )
        .unwrap();
        // An unnamed preamble must not make a single-file patch look multi-file.
        assert_eq!(
            files.iter().map(|f| f.path.as_str()).collect::<Vec<_>>(),
            ["/repo/one.ts"]
        );
    }

    #[test]
    fn returns_nothing_for_a_tool_that_did_not_edit_a_file() {
        assert!(settled("Bash", json!({"command": "ls"})).is_none());
        assert!(!is_edit_tool_name("Bash"));
        assert!(is_edit_tool_name("Edit"));
    }

    // ---- Perch's own: LCS, prefix/suffix fallback and the clipped-input flag ----

    fn strings(lines: &[&str]) -> Vec<String> {
        lines.iter().map(|line| line.to_string()).collect()
    }

    #[test]
    fn lcs_keeps_common_lines_as_context_with_both_numbers() {
        let lines = lcs_lines(&strings(&["a", "b", "c"]), &strings(&["a", "x", "c", "d"]));
        let rows: Vec<_> = lines
            .iter()
            .map(|l| {
                (
                    l.kind,
                    l.text.as_str(),
                    l.old_line_number,
                    l.new_line_number,
                )
            })
            .collect();
        assert_eq!(
            rows,
            [
                (Context, "a", Some(1), Some(1)),
                (Del, "b", Some(2), None),
                (Add, "x", None, Some(2)),
                (Context, "c", Some(3), Some(3)),
                (Add, "d", None, Some(4)),
            ]
        );
    }

    #[test]
    fn a_huge_pair_falls_back_to_a_prefix_suffix_diff() {
        let side = |middle: &str| -> Vec<String> {
            (0..600)
                .map(|n| format!("head {n}"))
                .chain([middle.to_string()])
                .chain((0..600).map(|n| format!("tail {n}")))
                .collect()
        };
        let (old, new) = (side("was").join("\n"), side("now").join("\n"));
        // 1,201 rows a side is over the LCS table limit, so this takes the linear path.
        const { assert!(1_201 * 1_201 > MAX_EDIT_DIFF_CELLS) };
        let (lines, truncated) = lines_from_contents(&old, &new);
        assert!(!truncated);
        let changed: Vec<_> = lines
            .iter()
            .filter(|l| l.kind != Context)
            .map(|l| (l.kind, l.text.as_str()))
            .collect();
        assert_eq!(changed, [(Del, "was"), (Add, "now")]);
        assert_eq!(lines.len(), 1202);
    }

    #[test]
    fn a_string_the_bridge_had_to_cut_marks_the_card_truncated() {
        let clipped = json!({"file_path": "a.ts", "old_string": "was", "new_string": "now…", CLIPPED_KEY: true});
        assert!(settled("Edit", clipped).unwrap()[0].truncated);
        let whole = json!({"file_path": "a.ts", "old_string": "was", "new_string": "now"});
        assert!(!settled("Edit", whole).unwrap()[0].truncated);
    }

    #[test]
    fn input_cut_mid_json_makes_no_card() {
        let cut = r#"{"file_path":"a.ts","old_string":"was","new_str"#;
        assert!(
            files_from_tool_pair("Edit", cut, Some(NativeUiToolState::Completed), None).is_none()
        );
    }

    #[test]
    fn a_card_is_capped_at_the_row_limit_and_says_so() {
        let content = "x\n".repeat(MAX_EDIT_LINES + 5);
        let files = settled("Write", json!({"file_path": "a.ts", "content": content})).unwrap();
        assert_eq!(files[0].lines.len(), MAX_EDIT_LINES);
        assert!(files[0].truncated);
    }
}

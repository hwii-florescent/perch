//! Pure inline-review models, anchoring, lifecycle helpers, and packet
//! generation.
//!
//! Review comments are intentionally not stored in an in-memory service here.
//! A DB adapter can implement [`ReviewStore`] and an outbox can implement
//! [`ReviewOutbox`] so reconnects and duplicate sends have one durable source
//! of truth.  [`build_batch_packet`] only produces a bounded, deterministic
//! packet from a caller-provided frozen comment set; it does not claim
//! exactly-once delivery on its own.

use std::fmt;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::source_control::DiffTarget;

pub const MAX_COMMENT_BODY_BYTES: usize = 16 * 1024;
pub const MAX_ANCHOR_CONTEXT_LINES: usize = 8;
pub const MAX_PACKET_BYTES: usize = 64 * 1024;
/// Re-anchoring is a user-facing recovery path, so repeated context must
/// never turn into an unbounded candidate list or a quadratic pair search.
/// More matches than this are treated conservatively as ambiguous.
const MAX_REANCHOR_MATCHES: usize = 4096;
const MAX_REANCHOR_SEQUENCE_LINES: usize = 16 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReviewError {
    InvalidId,
    InvalidWorkspace,
    InvalidPath,
    InvalidRange,
    InvalidBody,
    InvalidRevision,
    NoUnresolvedComments,
    PacketTooLarge,
    MixedWorkspace,
    MissingOperationId,
}

impl fmt::Display for ReviewError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::InvalidId => "review id is invalid",
            Self::InvalidWorkspace => "workspace id is invalid",
            Self::InvalidPath => "review path must be a relative file path",
            Self::InvalidRange => "review line range is invalid",
            Self::InvalidBody => "review body is empty, NUL, or oversized",
            Self::InvalidRevision => "review revision is invalid",
            Self::NoUnresolvedComments => "there are no unresolved review comments",
            Self::PacketTooLarge => "review packet exceeds the configured bound",
            Self::MixedWorkspace => "review comments belong to different workspaces",
            Self::MissingOperationId => "a fresh send operation id is required",
        };
        f.write_str(message)
    }
}

impl std::error::Error for ReviewError {}

/// The side of a diff or source file that a line comment refers to.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum ReviewSide {
    Old,
    New,
    File,
}

impl ReviewSide {
    pub fn label(self) -> &'static str {
        match self {
            Self::Old => "old",
            Self::New => "new",
            Self::File => "file",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
pub struct LineRange {
    pub start: u32,
    pub end: u32,
}

impl LineRange {
    pub fn new(start: u32, end: u32) -> Result<Self, ReviewError> {
        if start == 0 || end < start {
            return Err(ReviewError::InvalidRange);
        }
        Ok(Self { start, end })
    }

    fn to_indices(self, line_count: usize) -> Result<(usize, usize), ReviewError> {
        let start = self.start as usize;
        let end = self.end as usize;
        if start == 0 || end < start || end > line_count {
            return Err(ReviewError::InvalidRange);
        }
        Ok((start - 1, end))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReviewAnchor {
    pub path: String,
    pub side: ReviewSide,
    pub base: DiffTarget,
    pub base_revision: String,
    pub range: LineRange,
    pub before: Vec<String>,
    pub selected: Vec<String>,
    pub after: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum AnchorConfidence {
    None,
    Low,
    Medium,
    High,
    Exact,
}

impl AnchorConfidence {
    pub fn score(self) -> f32 {
        match self {
            Self::None => 0.0,
            Self::Low => 0.35,
            Self::Medium => 0.7,
            Self::High => 0.9,
            Self::Exact => 1.0,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ReviewStatus {
    Unresolved,
    Resolved,
    Stale,
    Orphaned,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReviewComment {
    pub id: String,
    pub workspace_id: String,
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    pub path: String,
    pub base: DiffTarget,
    pub base_revision: String,
    pub side: ReviewSide,
    pub range: LineRange,
    pub body: String,
    pub anchor: ReviewAnchor,
    pub status: ReviewStatus,
    pub anchor_confidence: AnchorConfidence,
    pub created_at: i64,
    pub updated_at: i64,
    /// Incremented by a persistence adapter whenever the comment changes.
    /// Batch packets include it so a frozen send operation is distinguishable
    /// from a later legitimate resend after an edit.
    pub version: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewCommentDraft {
    pub id: String,
    pub workspace_id: String,
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    pub path: String,
    pub base: DiffTarget,
    pub base_revision: String,
    pub side: ReviewSide,
    pub range: LineRange,
    pub body: String,
}

/// Create one comment from the exact lines shown to the user.  The caller
/// persists the returned value through [`ReviewStore`].
pub fn create_comment(
    draft: ReviewCommentDraft,
    lines: &[String],
    now: i64,
) -> Result<ReviewComment, ReviewError> {
    validate_comment_fields(
        &draft.id,
        &draft.workspace_id,
        &draft.path,
        &draft.base_revision,
        &draft.body,
    )?;
    let anchor = make_anchor(
        &draft.path,
        draft.side,
        draft.base.clone(),
        draft.range,
        &draft.base_revision,
        lines,
    )?;
    Ok(ReviewComment {
        id: draft.id,
        workspace_id: draft.workspace_id,
        session_id: draft.session_id,
        agent_id: draft.agent_id,
        path: draft.path,
        base: draft.base,
        base_revision: draft.base_revision,
        side: draft.side,
        range: draft.range,
        body: draft.body,
        anchor,
        status: ReviewStatus::Unresolved,
        anchor_confidence: AnchorConfidence::Exact,
        created_at: now,
        updated_at: now,
        version: 1,
    })
}

/// Capture a bounded context window around an exact line range.
pub fn make_anchor(
    path: &str,
    side: ReviewSide,
    base: DiffTarget,
    range: LineRange,
    base_revision: &str,
    lines: &[String],
) -> Result<ReviewAnchor, ReviewError> {
    validate_path(path)?;
    validate_revision(base_revision)?;
    let (start, end) = range.to_indices(lines.len())?;
    let context_start = start.saturating_sub(MAX_ANCHOR_CONTEXT_LINES);
    let context_end = (end + MAX_ANCHOR_CONTEXT_LINES).min(lines.len());
    Ok(ReviewAnchor {
        path: path.to_string(),
        side,
        base,
        base_revision: base_revision.to_string(),
        range,
        before: lines[context_start..start].to_vec(),
        selected: lines[start..end].to_vec(),
        after: lines[end..context_end].to_vec(),
    })
}

/// Update only the body while preserving the current anchor.
pub fn edit_comment(
    comment: &ReviewComment,
    body: impl Into<String>,
    now: i64,
) -> Result<ReviewComment, ReviewError> {
    let body = body.into();
    validate_body(&body)?;
    let mut next = comment.clone();
    next.body = body;
    next.updated_at = now;
    next.version = next.version.saturating_add(1);
    if matches!(next.status, ReviewStatus::Resolved) {
        next.status = ReviewStatus::Unresolved;
    }
    Ok(next)
}

/// Resolve or reopen a comment. Reopening is also allowed for stale/orphaned
/// comments so the UI can make a deliberate correction before another send.
pub fn set_comment_resolved(comment: &ReviewComment, resolved: bool, now: i64) -> ReviewComment {
    let mut next = comment.clone();
    next.status = if resolved {
        ReviewStatus::Resolved
    } else {
        ReviewStatus::Unresolved
    };
    next.updated_at = now;
    next.version = next.version.saturating_add(1);
    next
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ReanchorState {
    Exact,
    Reanchored,
    Stale,
    Ambiguous,
    Orphaned,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ReanchorResult {
    pub state: ReanchorState,
    pub range: Option<LineRange>,
    pub confidence: AnchorConfidence,
    pub score: f32,
}

/// Attempt to move an anchor after the file changes. Exact selected text plus
/// surrounding context is required for a high-confidence move. If more than
/// one candidate remains, the result is ambiguous and retains no new range;
/// callers must never silently move the comment.
pub fn reanchor(anchor: &ReviewAnchor, lines: &[String]) -> ReanchorResult {
    // A malformed or legacy anchor with no selected line has no safe point to
    // move. Return before searching context so repeated empty needles cannot
    // make this path scan or manufacture a line range.
    if anchor.selected.is_empty() {
        return ReanchorResult {
            state: ReanchorState::Orphaned,
            range: None,
            confidence: AnchorConfidence::None,
            score: 0.0,
        };
    }
    if anchor.before.len() > MAX_ANCHOR_CONTEXT_LINES
        || anchor.after.len() > MAX_ANCHOR_CONTEXT_LINES
    {
        return ReanchorResult {
            state: ReanchorState::Ambiguous,
            range: None,
            confidence: AnchorConfidence::None,
            score: 0.0,
        };
    }

    let selected_matches = find_sequence(lines, &anchor.selected);
    if selected_matches.capped {
        return ReanchorResult {
            state: ReanchorState::Ambiguous,
            range: None,
            confidence: AnchorConfidence::None,
            score: 0.0,
        };
    }
    let mut contextual = Vec::with_capacity(2);
    for start in selected_matches.positions {
        let before = context_before_matches(lines, start, &anchor.before);
        let after = context_after_matches(lines, start + anchor.selected.len(), &anchor.after);
        if !before && !after {
            continue;
        }
        let confidence = match (before, after) {
            (true, true) => AnchorConfidence::High,
            _ => AnchorConfidence::Medium,
        };
        contextual.push((start, confidence, confidence.score()));
        if contextual.len() > 1 {
            return ReanchorResult {
                state: ReanchorState::Ambiguous,
                range: None,
                confidence: AnchorConfidence::None,
                score: 0.0,
            };
        }
    }
    if contextual.len() == 1 {
        let (start, confidence, score) = contextual[0];
        let range = range_for(start, anchor.selected.len());
        let state = if range == anchor.range && confidence == AnchorConfidence::High {
            ReanchorState::Exact
        } else {
            ReanchorState::Reanchored
        };
        return ReanchorResult {
            state,
            range: Some(range),
            confidence: if state == ReanchorState::Exact {
                AnchorConfidence::Exact
            } else {
                confidence
            },
            score: if state == ReanchorState::Exact {
                1.0
            } else {
                score
            },
        };
    }
    // The selected lines themselves changed. Both context sides can still
    // identify a unique gap; constrain its size so unrelated distant text is
    // never treated as a re-anchor.
    let before_matches = find_sequence(lines, &anchor.before);
    let after_matches = find_sequence(lines, &anchor.after);
    if before_matches.capped || after_matches.capped {
        return ReanchorResult {
            state: ReanchorState::Ambiguous,
            range: None,
            confidence: AnchorConfidence::None,
            score: 0.0,
        };
    }
    let max_gap = anchor
        .selected
        .len()
        .saturating_add(MAX_ANCHOR_CONTEXT_LINES);
    let mut candidate = None;
    let mut after_cursor = 0;
    for before_start in before_matches.positions {
        let before_end = before_start.saturating_add(anchor.before.len());
        while after_cursor < after_matches.positions.len()
            && after_matches.positions[after_cursor] <= before_end
        {
            after_cursor += 1;
        }
        let Some(&after_start) = after_matches.positions.get(after_cursor) else {
            break;
        };
        let gap = after_start - before_end;
        if gap > max_gap {
            // The after positions are sorted; later occurrences are even
            // farther away for this and every subsequent before occurrence.
            continue;
        }
        if gap == 0 {
            continue;
        }
        if let Some(&next_after) = after_matches.positions.get(after_cursor + 1) {
            let next_gap = next_after - before_end;
            if next_gap <= max_gap {
                return ReanchorResult {
                    state: ReanchorState::Ambiguous,
                    range: None,
                    confidence: AnchorConfidence::None,
                    score: 0.0,
                };
            }
        }
        let next = (before_end, gap);
        if candidate.is_some() {
            return ReanchorResult {
                state: ReanchorState::Ambiguous,
                range: None,
                confidence: AnchorConfidence::None,
                score: 0.0,
            };
        }
        candidate = Some(next);
    }
    if let Some((start, count)) = candidate {
        return ReanchorResult {
            state: ReanchorState::Reanchored,
            range: Some(range_for(start, count)),
            confidence: AnchorConfidence::Medium,
            score: AnchorConfidence::Medium.score(),
        };
    }
    ReanchorResult {
        state: ReanchorState::Stale,
        range: None,
        confidence: AnchorConfidence::None,
        score: 0.0,
    }
}

/// Re-anchor a persisted comment and return a new immutable version. Stale or
/// ambiguous results retain the old line range and expose their state for the
/// UI/persistence adapter to show explicitly.
pub fn reanchor_comment(
    comment: &ReviewComment,
    lines: &[String],
    revision: &str,
    now: i64,
) -> Result<(ReviewComment, ReanchorResult), ReviewError> {
    validate_revision(revision)?;
    let result = reanchor(&comment.anchor, lines);
    let mut next = comment.clone();
    next.updated_at = now;
    next.version = next.version.saturating_add(1);
    match result.state {
        ReanchorState::Exact | ReanchorState::Reanchored => {
            let range = result.range.expect("reanchor range for successful state");
            next.range = range;
            next.base_revision = revision.to_string();
            next.anchor = make_anchor(
                &comment.path,
                comment.side,
                comment.base.clone(),
                range,
                revision,
                lines,
            )?;
            next.anchor_confidence = result.confidence;
            if matches!(next.status, ReviewStatus::Stale | ReviewStatus::Orphaned) {
                next.status = ReviewStatus::Unresolved;
            }
        }
        ReanchorState::Ambiguous | ReanchorState::Stale => {
            next.status = ReviewStatus::Stale;
            next.anchor_confidence = AnchorConfidence::None;
        }
        ReanchorState::Orphaned => {
            next.status = ReviewStatus::Orphaned;
            next.anchor_confidence = AnchorConfidence::None;
        }
    }
    Ok((next, result))
}

/// Frozen input for one user-initiated "send review notes" operation. The
/// operation id must be fresh for a legitimate later resend; it is included
/// in the packet key so a content-only hash cannot suppress that resend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewBatchRequest {
    pub send_operation_id: String,
    pub workspace_id: String,
    pub target_session_id: Option<String>,
    pub target_agent_id: Option<String>,
    pub current_revision: String,
    pub instruction: String,
    pub comments: Vec<ReviewComment>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReviewPacketComment {
    pub comment_id: String,
    pub version: u64,
    pub path: String,
    pub side: ReviewSide,
    pub range: LineRange,
    pub body: String,
    pub snippet_before: Vec<String>,
    pub snippet: Vec<String>,
    pub snippet_after: Vec<String>,
    pub anchor_confidence: AnchorConfidence,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReviewPacket {
    pub packet_id: String,
    pub idempotency_key: String,
    pub send_operation_id: String,
    pub workspace_id: String,
    pub target_session_id: Option<String>,
    pub target_agent_id: Option<String>,
    pub current_revision: String,
    pub comments: Vec<ReviewPacketComment>,
    pub markdown: String,
}

/// Build one bounded coherent packet from unresolved comments. This function
/// does not reserve, send, or mark a packet delivered; those responsibilities
/// belong to a durable [`ReviewOutbox`] and the server-owned session path.
pub fn build_batch_packet(request: ReviewBatchRequest) -> Result<ReviewPacket, ReviewError> {
    validate_id(&request.send_operation_id)?;
    if request.send_operation_id.trim().is_empty() {
        return Err(ReviewError::MissingOperationId);
    }
    validate_workspace(&request.workspace_id)?;
    validate_revision(&request.current_revision)?;
    if request.instruction.len() > MAX_COMMENT_BODY_BYTES || request.instruction.contains('\0') {
        return Err(ReviewError::InvalidBody);
    }
    let mut comments: Vec<ReviewComment> = request
        .comments
        .into_iter()
        .filter(|comment| comment.status == ReviewStatus::Unresolved)
        .collect();
    if comments.is_empty() {
        return Err(ReviewError::NoUnresolvedComments);
    }
    if comments
        .iter()
        .any(|comment| comment.workspace_id != request.workspace_id)
    {
        return Err(ReviewError::MixedWorkspace);
    }
    comments.sort_by(|a, b| {
        a.path
            .cmp(&b.path)
            .then(a.range.cmp(&b.range))
            .then(a.id.cmp(&b.id))
    });
    let packet_comments: Vec<ReviewPacketComment> = comments
        .iter()
        .map(|comment| ReviewPacketComment {
            comment_id: comment.id.clone(),
            version: comment.version,
            path: comment.path.clone(),
            side: comment.side,
            range: comment.range,
            body: comment.body.clone(),
            snippet_before: comment.anchor.before.clone(),
            snippet: comment.anchor.selected.clone(),
            snippet_after: comment.anchor.after.clone(),
            anchor_confidence: comment.anchor_confidence,
        })
        .collect();
    let mut fingerprint = String::new();
    fingerprint.push_str(&request.send_operation_id);
    fingerprint.push('\0');
    fingerprint.push_str(&request.workspace_id);
    fingerprint.push('\0');
    fingerprint.push_str(&request.current_revision);
    for comment in &packet_comments {
        fingerprint.push_str(&format!(
            "\0{}\0{}\0{}\0{}-{}\0{}",
            comment.comment_id,
            comment.version,
            comment.path,
            comment.range.start,
            comment.range.end,
            comment.body
        ));
    }
    let digest = digest(fingerprint.as_bytes());
    let packet_id = format!("review-packet-{}", &digest[..32]);
    let idempotency_key = format!(
        "review-send:{}:{}",
        request.send_operation_id,
        &digest[..24]
    );

    let mut markdown = String::new();
    markdown.push_str(
        "Review notes for the selected workspace. Please revise the code or explain each note.\n\n",
    );
    markdown.push_str(&format!(
        "Workspace revision: `{}`\n",
        request.current_revision
    ));
    if !request.instruction.trim().is_empty() {
        markdown.push_str("Request: ");
        markdown.push_str(&request.instruction);
        markdown.push('\n');
    }
    markdown.push('\n');
    for (index, comment) in packet_comments.iter().enumerate() {
        markdown.push_str(&format!(
            "{}. `{}` ({} lines {}-{}, anchor confidence {:?})\n",
            index + 1,
            comment.path,
            comment.side.label(),
            comment.range.start,
            comment.range.end,
            comment.anchor_confidence
        ));
        markdown.push_str("   Comment: ");
        markdown.push_str(&comment.body);
        markdown.push('\n');
        if !comment.snippet_before.is_empty()
            || !comment.snippet.is_empty()
            || !comment.snippet_after.is_empty()
        {
            markdown.push_str("   Context:\n");
            for line in comment
                .snippet_before
                .iter()
                .chain(comment.snippet.iter())
                .chain(comment.snippet_after.iter())
            {
                markdown.push_str("   | ");
                markdown.push_str(line);
                markdown.push('\n');
            }
        }
        markdown.push_str(&format!(
            "   Comment id: `{}` (version {})\n\n",
            comment.comment_id, comment.version
        ));
    }
    if markdown.len() > MAX_PACKET_BYTES {
        return Err(ReviewError::PacketTooLarge);
    }
    Ok(ReviewPacket {
        packet_id,
        idempotency_key,
        send_operation_id: request.send_operation_id,
        workspace_id: request.workspace_id,
        target_session_id: request.target_session_id,
        target_agent_id: request.target_agent_id,
        current_revision: request.current_revision,
        comments: packet_comments,
        markdown,
    })
}

/// Persistence authority for comment lifecycle operations. The core module
/// supplies models and validation; it does not implement a competing memory
/// cache. Implementations should enforce workspace ownership and versions.
pub trait ReviewStore {
    type Error;

    fn list(&self, workspace_id: &str) -> Result<Vec<ReviewComment>, Self::Error>;
    fn create(&self, comment: &ReviewComment) -> Result<(), Self::Error>;
    fn update(&self, comment: &ReviewComment) -> Result<(), Self::Error>;
    fn delete(&self, workspace_id: &str, comment_id: &str) -> Result<(), Self::Error>;
}

/// Durable outbox authority for exactly-once review packet dispatch. A DB
/// implementation must atomically reserve `idempotency_key`, return the
/// existing packet for a duplicate reserve, and mark delivery after the
/// server-owned session send succeeds.
pub trait ReviewOutbox {
    type Error;

    fn reserve(&self, packet: &ReviewPacket) -> Result<OutboxReservation, Self::Error>;
    fn mark_sent(&self, idempotency_key: &str) -> Result<(), Self::Error>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutboxReservation {
    New,
    AlreadyPending,
    AlreadySent,
}

fn validate_comment_fields(
    id: &str,
    workspace_id: &str,
    path: &str,
    revision: &str,
    body: &str,
) -> Result<(), ReviewError> {
    validate_id(id)?;
    validate_workspace(workspace_id)?;
    validate_path(path)?;
    validate_revision(revision)?;
    validate_body(body)
}

fn validate_id(value: &str) -> Result<(), ReviewError> {
    if value.trim().is_empty() || value.len() > 256 || value.contains('\0') {
        return Err(ReviewError::InvalidId);
    }
    Ok(())
}

fn validate_workspace(value: &str) -> Result<(), ReviewError> {
    if value.trim().is_empty() || value.len() > 256 || value.contains('\0') {
        return Err(ReviewError::InvalidWorkspace);
    }
    Ok(())
}

fn validate_path(path: &str) -> Result<(), ReviewError> {
    if path.is_empty()
        || path.len() > 16 * 1024
        || path.starts_with('/')
        || path.contains('\0')
        || path.split('/').any(|part| part == "..")
    {
        return Err(ReviewError::InvalidPath);
    }
    Ok(())
}

fn validate_revision(value: &str) -> Result<(), ReviewError> {
    if value.trim().is_empty() || value.len() > 1024 || value.contains('\0') {
        return Err(ReviewError::InvalidRevision);
    }
    Ok(())
}

fn validate_body(value: &str) -> Result<(), ReviewError> {
    if value.trim().is_empty() || value.len() > MAX_COMMENT_BODY_BYTES || value.contains('\0') {
        return Err(ReviewError::InvalidBody);
    }
    Ok(())
}

struct SequenceMatches {
    positions: Vec<usize>,
    capped: bool,
}

/// Find exact line sequences with a linear-time prefix-function search. The
/// old `windows(...).filter(...)` implementation repeatedly compared the
/// entire needle at every offset, and the gap recovery then paired every
/// before match with every after match. Keep the result bounded and let the
/// caller fail closed when repetition exceeds the safe review bound.
fn find_sequence(lines: &[String], needle: &[String]) -> SequenceMatches {
    if needle.is_empty() || needle.len() > lines.len() {
        return SequenceMatches {
            positions: Vec::new(),
            capped: false,
        };
    }
    if needle.len() > MAX_REANCHOR_SEQUENCE_LINES {
        return SequenceMatches {
            positions: Vec::new(),
            capped: true,
        };
    }

    let mut prefix = vec![0usize; needle.len()];
    let mut prefix_len = 0usize;
    for index in 1..needle.len() {
        while prefix_len > 0 && needle[index] != needle[prefix_len] {
            prefix_len = prefix[prefix_len - 1];
        }
        if needle[index] == needle[prefix_len] {
            prefix_len += 1;
        }
        prefix[index] = prefix_len;
    }

    let mut positions = Vec::with_capacity(MAX_REANCHOR_MATCHES.min(lines.len()));
    let mut matched = 0usize;
    for (index, line) in lines.iter().enumerate() {
        while matched > 0 && line != &needle[matched] {
            matched = prefix[matched - 1];
        }
        if line == &needle[matched] {
            matched += 1;
        }
        if matched == needle.len() {
            positions.push(index + 1 - needle.len());
            if positions.len() > MAX_REANCHOR_MATCHES {
                positions.truncate(MAX_REANCHOR_MATCHES);
                return SequenceMatches {
                    positions,
                    capped: true,
                };
            }
            matched = prefix[matched - 1];
        }
    }
    SequenceMatches {
        positions,
        capped: false,
    }
}

fn context_before_matches(lines: &[String], start: usize, context: &[String]) -> bool {
    if context.is_empty() {
        return true;
    }
    if start >= context.len() && lines[start - context.len()..start] == *context {
        return true;
    }
    let window_start = start.saturating_sub(MAX_ANCHOR_CONTEXT_LINES + context.len());
    ordered_context_matches(&lines[window_start..start], context)
}

fn context_after_matches(lines: &[String], start: usize, context: &[String]) -> bool {
    if context.is_empty() {
        return true;
    }
    if start + context.len() <= lines.len() && lines[start..start + context.len()] == *context {
        return true;
    }
    let window_end = (start + MAX_ANCHOR_CONTEXT_LINES + context.len()).min(lines.len());
    ordered_context_matches(&lines[start..window_end], context)
}

fn ordered_context_matches(window: &[String], context: &[String]) -> bool {
    let mut cursor = 0;
    for expected in context {
        let Some(offset) = window[cursor..].iter().position(|line| line == expected) else {
            return false;
        };
        cursor += offset + 1;
    }
    true
}

fn range_for(start: usize, count: usize) -> LineRange {
    LineRange {
        start: start as u32 + 1,
        end: start as u32 + count.max(1) as u32,
    }
}

fn digest(bytes: &[u8]) -> String {
    let hash = Sha256::digest(bytes);
    hash.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lines(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_string()).collect()
    }

    fn comment(id: &str, body: &str, range: LineRange, source: &[String]) -> ReviewComment {
        create_comment(
            ReviewCommentDraft {
                id: id.to_string(),
                workspace_id: "workspace".to_string(),
                session_id: Some("session".to_string()),
                agent_id: Some("claude".to_string()),
                path: "src/lib.rs".to_string(),
                base: DiffTarget::WorkingTree,
                base_revision: "abc123".to_string(),
                side: ReviewSide::New,
                range,
                body: body.to_string(),
            },
            source,
            1,
        )
        .unwrap()
    }

    #[test]
    fn exact_anchor_survives_and_insertion_reanchors_uniquely() {
        let original = lines(&["zero", "keep", "target", "after"]);
        let anchor = make_anchor(
            "src/lib.rs",
            ReviewSide::New,
            DiffTarget::WorkingTree,
            LineRange::new(3, 3).unwrap(),
            "r1",
            &original,
        )
        .unwrap();
        let exact = reanchor(&anchor, &original);
        assert_eq!(exact.state, ReanchorState::Exact);
        assert_eq!(exact.range, Some(LineRange::new(3, 3).unwrap()));
        let changed = lines(&["zero", "inserted", "keep", "target", "after"]);
        let moved = reanchor(&anchor, &changed);
        assert_eq!(moved.state, ReanchorState::Reanchored);
        assert_eq!(moved.range, Some(LineRange::new(4, 4).unwrap()));
        assert!(moved.score >= AnchorConfidence::High.score());
    }

    #[test]
    fn ambiguous_anchor_is_not_moved() {
        let original = lines(&["before", "target", "after"]);
        let anchor = make_anchor(
            "src/lib.rs",
            ReviewSide::New,
            DiffTarget::WorkingTree,
            LineRange::new(2, 2).unwrap(),
            "r1",
            &original,
        )
        .unwrap();
        let changed = lines(&["before", "target", "after", "target", "after"]);
        let result = reanchor(&anchor, &changed);
        assert_eq!(result.state, ReanchorState::Ambiguous);
        assert!(result.range.is_none());
        let c = comment("c1", "fix", LineRange::new(2, 2).unwrap(), &original);
        let (updated, _) = reanchor_comment(&c, &changed, "r2", 2).unwrap();
        assert_eq!(updated.status, ReviewStatus::Stale);
        assert_eq!(updated.range, c.range);
    }

    #[test]
    fn empty_selected_context_is_orphaned_without_searching_for_a_gap() {
        let anchor = ReviewAnchor {
            path: "src/lib.rs".to_string(),
            side: ReviewSide::New,
            base: DiffTarget::WorkingTree,
            base_revision: "r1".to_string(),
            range: LineRange::new(1, 1).unwrap(),
            before: lines(&["before"]),
            selected: Vec::new(),
            after: lines(&["after"]),
        };
        let changed = lines(&["before", "replacement", "after"]);
        let result = reanchor(&anchor, &changed);
        assert_eq!(result.state, ReanchorState::Orphaned);
        assert!(result.range.is_none());
    }

    #[test]
    fn repeated_gap_contexts_are_linear_and_fail_closed() {
        let original = lines(&["before", "target", "after"]);
        let anchor = make_anchor(
            "src/lib.rs",
            ReviewSide::New,
            DiffTarget::WorkingTree,
            LineRange::new(2, 2).unwrap(),
            "r1",
            &original,
        )
        .unwrap();
        let mut changed = Vec::with_capacity(4_020);
        changed.extend(std::iter::repeat_n("before".to_string(), 2_000));
        changed.extend(std::iter::repeat_n("replacement".to_string(), 20));
        changed.extend(std::iter::repeat_n("after".to_string(), 2_000));

        // Every before/after pair is farther apart than the bounded gap. The
        // old nested pairing inspected all 4 million combinations; the
        // monotonic search visits each sequence once and returns stale.
        let result = reanchor(&anchor, &changed);
        assert_eq!(result.state, ReanchorState::Stale);
        assert!(result.range.is_none());
    }

    #[test]
    fn excessive_repeated_selected_lines_are_ambiguous_with_a_bounded_search() {
        let original = lines(&["before", "target", "after"]);
        let anchor = make_anchor(
            "src/lib.rs",
            ReviewSide::New,
            DiffTarget::WorkingTree,
            LineRange::new(2, 2).unwrap(),
            "r1",
            &original,
        )
        .unwrap();
        let changed =
            std::iter::repeat_n("target".to_string(), MAX_REANCHOR_MATCHES + 1).collect::<Vec<_>>();
        let result = reanchor(&anchor, &changed);
        assert_eq!(result.state, ReanchorState::Ambiguous);
        assert!(result.range.is_none());
    }

    #[test]
    fn lifecycle_validation_and_versioning_are_explicit() {
        let source = lines(&["one", "two"]);
        let c = comment(
            "c1",
            "Please rename this",
            LineRange::new(2, 2).unwrap(),
            &source,
        );
        let edited = edit_comment(&c, "Use the domain name", 2).unwrap();
        assert_eq!(edited.version, 2);
        assert_eq!(
            set_comment_resolved(&edited, true, 3).status,
            ReviewStatus::Resolved
        );
        assert!(edit_comment(&c, "", 4).is_err());
        assert!(make_anchor(
            "../secret",
            ReviewSide::New,
            DiffTarget::WorkingTree,
            c.range,
            "r1",
            &source
        )
        .is_err());
    }

    #[test]
    fn batch_packet_contains_sorted_unresolved_comments_and_operation_bound_key() {
        let source = lines(&["one", "two", "three"]);
        let mut first = comment("b", "Second", LineRange::new(2, 2).unwrap(), &source);
        let second = comment("a", "First", LineRange::new(1, 1).unwrap(), &source);
        first.status = ReviewStatus::Resolved;
        let unresolved = comment("b", "Second", LineRange::new(2, 2).unwrap(), &source);
        let packet = build_batch_packet(ReviewBatchRequest {
            send_operation_id: "send-1".to_string(),
            workspace_id: "workspace".to_string(),
            target_session_id: Some("session".to_string()),
            target_agent_id: Some("claude".to_string()),
            current_revision: "r2".to_string(),
            instruction: "Please address these notes".to_string(),
            comments: vec![first, second.clone(), unresolved.clone()],
        })
        .unwrap();
        assert_eq!(packet.comments.len(), 2);
        assert_eq!(packet.comments[0].comment_id, "a");
        assert_eq!(packet.comments[1].comment_id, "b");
        assert!(packet.markdown.contains("Please address these notes"));
        let same = build_batch_packet(ReviewBatchRequest {
            send_operation_id: "send-1".to_string(),
            workspace_id: "workspace".to_string(),
            target_session_id: Some("session".to_string()),
            target_agent_id: Some("claude".to_string()),
            current_revision: "r2".to_string(),
            instruction: "Please address these notes".to_string(),
            comments: vec![second.clone(), unresolved.clone()],
        })
        .unwrap();
        assert_eq!(packet.idempotency_key, same.idempotency_key);
        let resend = build_batch_packet(ReviewBatchRequest {
            send_operation_id: "send-2".to_string(),
            workspace_id: "workspace".to_string(),
            target_session_id: Some("session".to_string()),
            target_agent_id: Some("claude".to_string()),
            current_revision: "r2".to_string(),
            instruction: "Please address these notes".to_string(),
            comments: vec![second, unresolved],
        })
        .unwrap();
        assert_ne!(packet.idempotency_key, resend.idempotency_key);
    }
}

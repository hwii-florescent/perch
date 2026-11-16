//! The review diff as rows, with no GPUI: what `review.tsx` maps to elements (a header per file, a header per
//! hunk, a row per line, a note for a binary file, and under each line the comments whose range covers it), in
//! the order the web draws them. Built once per diff, comments, file filter or edit, never per frame.
//!
//! Which comments sit on a line is the web's rule (`commentMatchesDiff`, `isCommentOnLine`): every coordinate the
//! server anchored the comment to (path, side, target, revision, range) must still describe the diff on show. A
//! comment over several lines is drawn under each of them, as the web does.

use crate::git::store::DiffSnapshot;
use perch_core::review::{AnchorConfidence, ReviewComment, ReviewSide, ReviewStatus};
use perch_core::source_control::{DiffFile, DiffLine, DiffLineKind, DiffTarget};

#[derive(Clone, Debug, PartialEq)]
pub enum Row {
    /// File `file`'s header (path, status, Ask agent).
    File { file: usize },
    /// Hunk `hunk` of file `file`'s header.
    Hunk { file: usize, hunk: usize },
    /// Line `line` of hunk `hunk` of file `file`; `number` is the line on `side` (none for a line with no number
    /// there, which cannot be selected or commented).
    Line {
        file: usize,
        hunk: usize,
        line: usize,
        side: ReviewSide,
        number: Option<u32>,
    },
    /// The comments (indexes into the comment list) on the line just above.
    Thread {
        file: usize,
        side: ReviewSide,
        number: u32,
        comments: Vec<usize>,
    },
    /// File `file` is binary: a note in place of its hunks.
    Binary { file: usize },
}

/// The diff's rows and the widest line in characters (the shared width of unwrapped lines).
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Rows {
    pub rows: Vec<Row>,
    pub widest: usize,
}

/// `review.tsx` `filePath`: the new path, else the old one.
pub fn file_path(file: &DiffFile) -> &str {
    file.new_path
        .as_deref()
        .or(file.old_path.as_deref())
        .unwrap_or("(unknown file)")
}

/// `filePathForSide`.
pub fn file_path_for_side(file: &DiffFile, side: ReviewSide) -> &str {
    let (first, second) = match side {
        ReviewSide::Old => (&file.old_path, &file.new_path),
        _ => (&file.new_path, &file.old_path),
    };
    first
        .as_deref()
        .or(second.as_deref())
        .unwrap_or("(unknown file)")
}

/// `lineSide`: a deletion is on the old side, anything else on the new.
pub fn line_side(line: &DiffLine) -> ReviewSide {
    if line.kind == DiffLineKind::Deletion {
        ReviewSide::Old
    } else {
        ReviewSide::New
    }
}

/// `lineNumber`.
pub fn line_number(line: &DiffLine, side: ReviewSide) -> Option<u32> {
    match side {
        ReviewSide::Old => line.old_line,
        ReviewSide::New => line.new_line,
        ReviewSide::File => line.new_line.or(line.old_line),
    }
}

fn same_target(a: &DiffTarget, b: &DiffTarget) -> bool {
    a == b
}

/// `review.tsx` `sourceRevisionFor`: a per-source key, else the scalar.
fn source_revision<'a>(diff: &'a DiffSnapshot, path: &str, side: ReviewSide) -> Option<&'a str> {
    let side = side.label();
    diff.source_revisions
        .as_ref()
        .and_then(|map| {
            map.get(&format!("{path}:{side}"))
                .or_else(|| map.get(&format!("{side}:{path}")))
                .or_else(|| map.get(path))
        })
        .map(String::as_str)
        .or(diff.source_revision.as_deref())
}

/// `commentMatchesDiff`: every server-owned anchor coordinate still describes this diff.
pub fn comment_matches_diff(comment: &ReviewComment, diff: &DiffSnapshot) -> bool {
    if matches!(comment.status, ReviewStatus::Stale | ReviewStatus::Orphaned)
        || comment.anchor_confidence == AnchorConfidence::None
        || comment.side == ReviewSide::File
    {
        return false;
    }
    let anchor = &comment.anchor;
    let anchored = anchor.path == comment.path
        && anchor.side == comment.side
        && same_target(&anchor.base, &comment.base)
        && anchor.base_revision == comment.base_revision
        && anchor.range == comment.range;
    if !same_target(&comment.base, &diff.target) || !anchored {
        return false;
    }
    source_revision(diff, &comment.path, comment.side) == Some(comment.base_revision.as_str())
}

/// The rows of `diff` (only file `path` when given) with `comments` placed under their lines.
pub fn build(diff: &DiffSnapshot, comments: &[ReviewComment], path: Option<&str>) -> Rows {
    let placeable: Vec<usize> = (0..comments.len())
        .filter(|&i| comment_matches_diff(&comments[i], diff))
        .collect();
    let shown = path.filter(|p| diff.files.iter().any(|f| file_path(f) == *p));
    let mut out = Rows::default();
    for (fi, file) in diff.files.iter().enumerate() {
        if shown.is_some_and(|p| file_path(file) != p) {
            continue;
        }
        out.rows.push(Row::File { file: fi });
        if file.is_binary {
            out.rows.push(Row::Binary { file: fi });
            continue;
        }
        for (hi, hunk) in file.hunks.iter().enumerate() {
            out.rows.push(Row::Hunk { file: fi, hunk: hi });
            for (li, line) in hunk.lines.iter().enumerate() {
                let side = line_side(line);
                let number = line_number(line, side);
                out.widest = out.widest.max(line.content.chars().count());
                out.rows.push(Row::Line {
                    file: fi,
                    hunk: hi,
                    line: li,
                    side,
                    number,
                });
                let Some(number) = number else { continue };
                let line_path = file_path_for_side(file, side);
                let on_line: Vec<usize> = placeable
                    .iter()
                    .copied()
                    .filter(|&i| {
                        let c = &comments[i];
                        c.path == line_path
                            && c.side == side
                            && c.range.start <= number
                            && number <= c.range.end
                    })
                    .collect();
                if !on_line.is_empty() {
                    out.rows.push(Row::Thread {
                        file: fi,
                        side,
                        number,
                        comments: on_line,
                    });
                }
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use perch_core::review::{LineRange, ReviewAnchor};
    use perch_core::source_control::{DiffFileStatus, DiffHunk};

    fn line(kind: DiffLineKind, old: Option<u32>, new: Option<u32>, text: &str) -> DiffLine {
        DiffLine {
            kind,
            content: text.into(),
            old_line: old,
            new_line: new,
        }
    }

    fn file(path: &str, binary: bool) -> DiffFile {
        DiffFile {
            old_path: Some(path.into()),
            new_path: Some(path.into()),
            status: DiffFileStatus::Modified,
            is_binary: binary,
            hunks: if binary {
                vec![]
            } else {
                vec![DiffHunk {
                    old_start: 1,
                    old_count: 2,
                    new_start: 1,
                    new_count: 2,
                    header: "@@ -1,2 +1,2 @@".into(),
                    lines: vec![
                        line(DiffLineKind::Context, Some(1), Some(1), "fn main() {"),
                        line(DiffLineKind::Deletion, Some(2), None, "    old();"),
                        line(
                            DiffLineKind::Addition,
                            None,
                            Some(2),
                            "    a_much_longer_new_line();",
                        ),
                    ],
                }]
            },
        }
    }

    fn diff(files: Vec<DiffFile>) -> DiffSnapshot {
        DiffSnapshot {
            workspace_id: "w".into(),
            target: DiffTarget::WorkingTree,
            files,
            hunk_count: 1,
            truncated: false,
            source_revision: Some("rev".into()),
            source_revisions: None,
        }
    }

    fn comment(id: &str, path: &str, side: ReviewSide, start: u32, end: u32) -> ReviewComment {
        let range = LineRange { start, end };
        ReviewComment {
            id: id.into(),
            workspace_id: "w".into(),
            session_id: None,
            agent_id: None,
            path: path.into(),
            base: DiffTarget::WorkingTree,
            base_revision: "rev".into(),
            side,
            range,
            body: "note".into(),
            anchor: ReviewAnchor {
                path: path.into(),
                side,
                base: DiffTarget::WorkingTree,
                base_revision: "rev".into(),
                range,
                before: vec![],
                selected: vec![],
                after: vec![],
            },
            status: ReviewStatus::Unresolved,
            anchor_confidence: AnchorConfidence::Exact,
            created_at: 0,
            updated_at: 0,
            version: 1,
        }
    }

    #[test]
    fn rows_follow_files_hunks_and_lines() {
        let rows = build(
            &diff(vec![file("a.rs", false), file("b.rs", false)]),
            &[],
            None,
        )
        .rows;
        assert_eq!(rows.len(), 2 * (1 + 1 + 3));
        assert_eq!(rows[0], Row::File { file: 0 });
        assert_eq!(rows[1], Row::Hunk { file: 0, hunk: 0 });
        assert_eq!(
            rows[3],
            Row::Line {
                file: 0,
                hunk: 0,
                line: 1,
                side: ReviewSide::Old,
                number: Some(2)
            }
        );
        assert_eq!(
            rows[4],
            Row::Line {
                file: 0,
                hunk: 0,
                line: 2,
                side: ReviewSide::New,
                number: Some(2)
            }
        );
        assert_eq!(rows[5], Row::File { file: 1 });
    }

    #[test]
    fn binary_file_is_one_note_row() {
        let rows = build(&diff(vec![file("img.png", true)]), &[], None).rows;
        assert_eq!(rows, vec![Row::File { file: 0 }, Row::Binary { file: 0 }]);
    }

    #[test]
    fn thread_rows_follow_every_line_in_range() {
        let d = diff(vec![file("a.rs", false)]);
        let rows = build(&d, &[comment("c", "a.rs", ReviewSide::New, 1, 2)], None).rows;
        let threads: Vec<_> = rows
            .iter()
            .filter(|r| matches!(r, Row::Thread { .. }))
            .collect();
        assert_eq!(
            threads.len(),
            2,
            "under new line 1 and new line 2, as the web draws it"
        );
        assert!(
            matches!(rows[3], Row::Thread { number: 1, .. }),
            "right after its line"
        );
    }

    #[test]
    fn stale_or_other_target_comment_is_not_placed() {
        let d = diff(vec![file("a.rs", false)]);
        let mut stale = comment("s", "a.rs", ReviewSide::New, 1, 1);
        stale.status = ReviewStatus::Stale;
        let mut staged = comment("t", "a.rs", ReviewSide::New, 1, 1);
        staged.base = DiffTarget::Staged;
        staged.anchor.base = DiffTarget::Staged;
        let mut moved = comment("r", "a.rs", ReviewSide::New, 1, 1);
        moved.base_revision = "older".into();
        moved.anchor.base_revision = "older".into();
        let mut drifted = comment("d", "a.rs", ReviewSide::New, 1, 1);
        drifted.anchor.range = LineRange { start: 2, end: 2 };
        let rows = build(&d, &[stale, staged, moved, drifted], None).rows;
        assert!(rows.iter().all(|r| !matches!(r, Row::Thread { .. })));
    }

    #[test]
    fn path_filter_keeps_one_file() {
        let d = diff(vec![file("a.rs", false), file("b.rs", false)]);
        let rows = build(&d, &[], Some("b.rs")).rows;
        assert_eq!(rows[0], Row::File { file: 1 });
        assert_eq!(rows.len(), 5);
        assert_eq!(
            build(&d, &[], Some("gone.rs")).rows.len(),
            10,
            "an unknown path shows every file"
        );
    }

    #[test]
    fn widest_line_counts_characters() {
        let mut f = file("a.rs", false);
        f.hunks[0].lines[0].content = "ééé".repeat(20);
        assert_eq!(build(&diff(vec![f]), &[], None).widest, 60);
    }
}

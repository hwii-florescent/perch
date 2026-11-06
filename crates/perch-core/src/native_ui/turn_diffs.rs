//! Per-turn rollup of landed file edits: the files a turn changed, once each, with their totals.
//!
//! Ported from Orca's `shared/native-chat/tools/native-chat-turn-diffs.ts` (commit 308b5000, MIT;
//! see THIRD_PARTY_NOTICES.md) and the cases of `native-chat-turn-diffs.test.ts` that do not
//! depend on Orca's structured `Diff` journal item. A file edited twice is one row with both
//! edits; a rename folds the source's edits into the destination; a delete counts once. Edits
//! outside any turn (history cut off before its prompt) are not rolled up.
//!
//! Unlike Orca, a rollup names its edits by the transcript step that holds the card, so the
//! card's rows are not sent a second time. Orca's reveal targets and subagent sections are not
//! ported. Git stays the truth about what changed on disk (`git.status` `lastAgentTurn`); this
//! says what the agent's own edit calls reported.
use super::edits::EditFile;
use serde::{Deserialize, Serialize};

/// What a landed edit changed in one file, as the rollup needs it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Landed {
    pub path: String,
    pub old_path: Option<String>,
    pub added: u32,
    pub removed: u32,
    pub truncated: bool,
}

impl From<&EditFile> for Landed {
    fn from(file: &EditFile) -> Self {
        Landed {
            path: file.path.clone(),
            old_path: file.old_path.clone(),
            added: file.added,
            removed: file.removed,
            truncated: file.truncated,
        }
    }
}

/// One edit call's file: the transcript step that draws it and which of its cards.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnDiffEdit {
    pub step: String,
    pub file_index: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnDiffFile {
    pub path: String,
    pub added: u32,
    pub removed: u32,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub truncated: bool,
    /// In the order the edits ran.
    pub edits: Vec<TurnDiffEdit>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeUiTurnDiff {
    /// The user message that opened the turn.
    pub turn: String,
    /// The block the rollup is drawn after: the last one of the turn.
    pub after: String,
    pub files: Vec<TurnDiffFile>,
    pub added: u32,
    pub removed: u32,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub truncated: bool,
}

struct Entry {
    file: TurnDiffFile,
    /// Position in the whole transcript's edit order, to keep merged edits in order.
    orders: Vec<usize>,
}

/// `edits` are `(turn, step id, files)` in transcript order. Turns come out in first-edit order;
/// `after` is left empty for the caller to fill with the turn's last block.
pub fn rollups<'a>(
    edits: impl IntoIterator<Item = (&'a str, &'a str, &'a [Landed])>,
) -> Vec<NativeUiTurnDiff> {
    let mut turns: Vec<(String, Vec<Entry>)> = vec![];
    let mut order = 0;
    for (turn, step, files) in edits {
        if turn.is_empty() || files.is_empty() {
            continue;
        }
        let at = match turns.iter().position(|(key, _)| key == turn) {
            Some(at) => at,
            None => {
                turns.push((turn.to_string(), vec![]));
                turns.len() - 1
            }
        };
        let entries = &mut turns[at].1;
        for (file_index, file) in files.iter().enumerate() {
            let find = |entries: &[Entry], path: &str| {
                entries.iter().position(|entry| entry.file.path == path)
            };
            // The source's entry leaves the list; its edits go on under the destination.
            let renamed = file
                .old_path
                .as_deref()
                .filter(|old| *old != file.path)
                .and_then(|old| find(entries, old))
                .map(|index| entries.remove(index));
            // A file edited before keeps its place in the list; a new name goes last.
            let at = match (find(entries, &file.path), renamed) {
                (Some(at), None) => at,
                (Some(at), Some(renamed)) => {
                    let entry = &mut entries[at];
                    entry.file.added += renamed.file.added;
                    entry.file.removed += renamed.file.removed;
                    entry.file.truncated |= renamed.file.truncated;
                    let mut merged: Vec<_> = entry
                        .orders
                        .drain(..)
                        .zip(entry.file.edits.drain(..))
                        .chain(renamed.orders.into_iter().zip(renamed.file.edits))
                        .collect();
                    merged.sort_by_key(|(order, _)| *order);
                    (entry.orders, entry.file.edits) = merged.into_iter().unzip();
                    at
                }
                (None, Some(renamed)) => {
                    entries.push(renamed);
                    entries.len() - 1
                }
                (None, None) => {
                    entries.push(Entry {
                        file: TurnDiffFile {
                            path: file.path.clone(),
                            added: 0,
                            removed: 0,
                            truncated: false,
                            edits: vec![],
                        },
                        orders: vec![],
                    });
                    entries.len() - 1
                }
            };
            let entry = &mut entries[at];
            entry.file.path = file.path.clone();
            entry.file.added += file.added;
            entry.file.removed += file.removed;
            entry.file.truncated |= file.truncated;
            entry.file.edits.push(TurnDiffEdit {
                step: step.to_string(),
                file_index: file_index as u32,
            });
            entry.orders.push(order);
            order += 1;
        }
    }
    turns
        .into_iter()
        .map(|(turn, entries)| {
            let files: Vec<TurnDiffFile> = entries.into_iter().map(|entry| entry.file).collect();
            NativeUiTurnDiff {
                turn,
                after: String::new(),
                added: files.iter().map(|file| file.added).sum(),
                removed: files.iter().map(|file| file.removed).sum(),
                truncated: files.iter().any(|file| file.truncated),
                files,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn landed(path: &str, added: u32, removed: u32) -> Vec<Landed> {
        vec![Landed {
            path: path.into(),
            old_path: None,
            added,
            removed,
            truncated: false,
        }]
    }

    fn renamed(from: &str, to: &str) -> Vec<Landed> {
        vec![Landed {
            path: to.into(),
            old_path: Some(from.into()),
            added: 0,
            removed: 0,
            truncated: false,
        }]
    }

    fn run(edits: &[(&str, &str, Vec<Landed>)]) -> Vec<NativeUiTurnDiff> {
        rollups(
            edits
                .iter()
                .map(|(turn, step, files)| (*turn, *step, files.as_slice())),
        )
    }

    fn steps(file: &TurnDiffFile) -> Vec<&str> {
        file.edits.iter().map(|edit| edit.step.as_str()).collect()
    }

    // ---- Orca native-chat-turn-diffs.test.ts ----

    #[test]
    fn counts_unique_files_and_sums_recorded_edits() {
        let turns = run(&[
            ("turn", "first", landed("a.ts", 1, 1)),
            ("turn", "second", landed("a.ts", 1, 1)),
            ("turn", "third", landed("b.ts", 1, 1)),
        ]);
        let turn = &turns[0];
        assert_eq!(turn.files.len(), 2);
        assert_eq!((turn.added, turn.removed, turn.truncated), (3, 3, false));
        assert_eq!(turn.files[0].path, "a.ts");
        assert_eq!(turn.files[0].added, 2);
        assert_eq!(steps(&turn.files[0]), ["first", "second"]);
    }

    #[test]
    fn folds_edits_through_chained_renames_into_the_destination() {
        let turns = run(&[
            ("turn", "edit", landed("old.ts", 1, 1)),
            ("turn", "rename", renamed("old.ts", "new.ts")),
            ("turn", "rename-again", renamed("new.ts", "final.ts")),
            ("turn", "delete", landed("gone.ts", 0, 1)),
        ]);
        let turn = &turns[0];
        let paths: Vec<_> = turn.files.iter().map(|file| file.path.as_str()).collect();
        assert_eq!(paths, ["final.ts", "gone.ts"]);
        assert_eq!((turn.added, turn.removed), (1, 2));
        assert_eq!(steps(&turn.files[0]), ["edit", "rename", "rename-again"]);
    }

    #[test]
    fn keeps_every_edit_in_order_when_a_rename_joins_two_edited_paths() {
        let turns = run(&[
            ("turn", "destination", landed("new.ts", 1, 1)),
            ("turn", "source", landed("old.ts", 1, 1)),
            ("turn", "rename", renamed("old.ts", "new.ts")),
        ]);
        let turn = &turns[0];
        assert_eq!(turn.files.len(), 1);
        assert_eq!(steps(&turn.files[0]), ["destination", "source", "rename"]);
        assert_eq!((turn.added, turn.removed), (2, 2));
    }

    #[test]
    fn keeps_turns_separate_and_excludes_history_without_a_known_boundary() {
        let turns = run(&[
            ("", "orphan", landed("orphan.ts", 1, 1)),
            ("one", "a", landed("a.ts", 1, 1)),
            ("two", "b", landed("a.ts", 1, 1)),
        ]);
        let keys: Vec<_> = turns.iter().map(|turn| turn.turn.as_str()).collect();
        assert_eq!(keys, ["one", "two"]);
        assert_eq!(turns[0].added, 1);
        assert_eq!(turns[1].files.len(), 1);
    }

    #[test]
    fn a_truncated_file_makes_the_turn_partial() {
        let mut files = landed("a.ts", 1, 1);
        files[0].truncated = true;
        let turns = run(&[("turn", "a", files)]);
        assert!(turns[0].truncated && turns[0].files[0].truncated);
    }

    // ---- Perch's own ----

    #[test]
    fn a_multi_file_call_names_each_card_by_its_index() {
        let both = [landed("a.ts", 1, 1), landed("b.ts", 2, 0)].concat();
        let turns = run(&[("turn", "step", both)]);
        let indexes: Vec<_> = turns[0]
            .files
            .iter()
            .map(|file| (file.path.as_str(), file.edits[0].file_index))
            .collect();
        assert_eq!(indexes, [("a.ts", 0), ("b.ts", 1)]);
    }

    #[test]
    fn an_edit_that_changed_nothing_it_could_name_adds_no_turn() {
        assert!(run(&[("turn", "step", vec![])]).is_empty());
    }
}

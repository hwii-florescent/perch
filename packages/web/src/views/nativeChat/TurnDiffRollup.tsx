import { useState } from "react";
import type { NativeUiEditFile, NativeUiTurnDiff } from "@perch/shared";
import { Chevron } from "../../components/ui/chevron";
import { DiffCard } from "./DiffCard";
import { baseName } from "./editRows";

/** Orca shows this many files, then "Show n more". */
const FILE_LIMIT = 20;

/** What one turn's edits changed, once per file, each opening to its edits' cards. The core counted them
 * (`native_ui/turn_diffs.rs`); the cards are the run steps' own, found by `cards`. Follows Orca's
 * `NativeChatTurnDiffRollup` (MIT, commit 308b5000). */
export function TurnDiffRollup({ diff, cards }: { diff: NativeUiTurnDiff; cards: (step: string, fileIndex: number) => NativeUiEditFile | undefined }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [all, setAll] = useState(false);
  const files = all ? diff.files : diff.files.slice(0, FILE_LIMIT);
  return <section className="rounded-soft bg-surface-0 px-3 py-2 text-[0.85rem]" aria-label="Files changed this turn" data-testid="native-cli-turn-rollup">
    <div className="flex min-w-0 items-center gap-2 pb-1">
      <strong className="min-w-0 truncate font-semibold">{diff.files.length} changed {diff.files.length === 1 ? "file" : "files"}</strong>
      <span className="shrink-0 tabular-nums"><span className="text-green">+{diff.added}</span> <span className="text-red">−{diff.removed}</span></span>
      {diff.truncated && <span className="shrink-0 text-[0.75rem] text-subtext-0">Partial diff</span>}
    </div>
    {files.map((file) => {
      const shown = open.has(file.path);
      return <div key={file.path}>
        <button type="button" aria-expanded={shown} aria-label={`${file.path} +${file.added} -${file.removed}`} title={file.path}
          onClick={() => setOpen((before) => { const next = new Set(before); if (!next.delete(file.path)) next.add(file.path); return next; })}
          className="flex min-h-6 w-full min-w-0 cursor-pointer items-center gap-2 rounded-ui bg-transparent px-[0.4rem] text-left text-subtext-0 [border:0] hover:bg-surface-1 hover:text-fg">
          <Chevron open={shown} className="shrink-0" />
          <span className="min-w-0 truncate font-mono text-fg">{baseName(file.path)}</span>
          <span className="ml-auto shrink-0 tabular-nums"><span className="text-green">+{file.added}</span> <span className="text-red">−{file.removed}</span></span>
        </button>
        {shown && <div className="pl-2">{file.edits.map((edit, index) => {
          const card = cards(edit.step, edit.fileIndex);
          return card ? <DiffCard key={`${edit.step}:${edit.fileIndex}:${index}`} file={card} /> : null;
        })}</div>}
      </div>;
    })}
    {diff.files.length > files.length && <button type="button" onClick={() => setAll(true)} className="cursor-pointer rounded-ui bg-transparent px-[0.4rem] text-subtext-0 [border:0] hover:text-fg">Show {diff.files.length - files.length} more</button>}
  </section>;
}

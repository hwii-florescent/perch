import { useState } from "react";
import type { NativeUiEditFile } from "@perch/shared";
import { Chevron } from "../../components/ui/chevron";
import { cn } from "../../lib/cn";
import { CopyButton } from "./CopyButton";
import { CHANGE_VERB, baseName, editFilePatchText, gutterChars, unifiedLineNumber } from "./editRows";

/** One edited file: what changed and its rows, opened on demand. The core read the edit
 * (`native_ui/edits.rs`); this draws it. Follows Orca's `NativeChatDiffCard` (MIT, commit 308b5000). */
export function DiffCard({ file }: { file: NativeUiEditFile }) {
  const [open, setOpen] = useState(false);
  const hasRows = file.lines.length > 0;
  const gutter = gutterChars(file);
  return <div className="my-0.5 min-w-0 text-[0.83rem]" data-testid="native-cli-diff-card">
    <div className="flex min-w-0 items-center gap-1">
      <button type="button" aria-expanded={hasRows ? open : undefined} disabled={!hasRows} onClick={() => setOpen(!open)}
        className="flex min-h-6 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-ui bg-transparent px-[0.4rem] text-left text-subtext-0 [border:0] enabled:hover:bg-surface-1 enabled:hover:text-fg disabled:cursor-default">
        <span className="shrink-0">{CHANGE_VERB[file.changeKind]}</span>
        {file.oldPath && <><span className="min-w-0 truncate line-through" title={file.oldPath}>{baseName(file.oldPath)}</span><span aria-hidden>→</span></>}
        <span className="min-w-0 truncate text-fg" title={file.path}>{baseName(file.path)}</span>
        <span className="shrink-0 tabular-nums"><span className="text-green">+{file.added}</span> <span className="text-red">−{file.removed}</span></span>
        {file.truncated && <span className="shrink-0 text-[0.75rem]">Diff truncated</span>}
        {hasRows && <Chevron open={open} className="ml-auto shrink-0" />}
      </button>
      <CopyButton text={editFilePatchText(file.lines)} label="Copy diff" />
    </div>
    {open && hasRows && <div tabIndex={0} className="mt-1 ml-[0.4rem] max-h-72 overflow-auto rounded-ui bg-surface-0 py-1 font-mono text-[0.78rem] leading-relaxed text-fg" data-testid="native-cli-diff-rows">
      {file.lines.map((line, index) => line.kind === "gap"
        ? <div key={index} role="separator" aria-label="Lines not shown" className="select-none bg-surface-1 text-center text-subtext-0">⋯</div>
        : <div key={index} className={cn("flex items-start", line.kind === "add" && "bg-green/15", line.kind === "del" && "bg-red/15")}>
          {gutter > 0 && <span aria-hidden className="shrink-0 pr-1.5 text-right text-subtext-0 tabular-nums select-none" style={{ width: `${gutter}ch` }}>{unifiedLineNumber(line) ?? ""}</span>}
          <span aria-hidden className={cn("w-3 shrink-0 text-center select-none", line.kind === "add" && "text-green", line.kind === "del" && "text-red")}>{line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "}</span>
          <span className="min-w-0 pr-2 whitespace-pre-wrap [overflow-wrap:anywhere]">{line.text}</span>
        </div>)}
    </div>}
  </div>;
}

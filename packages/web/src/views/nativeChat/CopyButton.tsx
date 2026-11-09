import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "../../components/ui/icons";
import { cn } from "../../lib/cn";

/** Shows "Copied" for this long. Orca: `NativeChatCopyButton.tsx` (MIT, commit 308b5000). */
const COPIED_MS = 1500;

/** Copies one message's text. The clipboard can refuse when the page is unfocused; then nothing
 * changes and the person can try again. */
export function CopyButton({ text, className, label: idle = "Copy message", testId = "copy-message" }: { text: string; className?: string; label?: string; testId?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const label = copied ? "Copied" : idle;
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      title={label}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
        }, () => { /* refused: stay as is */ });
      }}
      className={cn("flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-ui bg-transparent text-subtext-0 [border:0] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg", copied && "text-green", className)}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

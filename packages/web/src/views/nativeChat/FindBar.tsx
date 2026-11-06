import { useEffect, useRef } from "react";

/** Find in the transcript: Enter/Shift+Enter step through matches, Esc closes. */
export function FindBar({ query, onQuery, count, index, onStep, onClose }: {
  query: string; onQuery: (value: string) => void; count: number; index: number; onStep: (delta: number) => void; onClose: () => void;
}) {
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { field.current?.focus(); field.current?.select(); }, []);
  return <div className="flex items-center gap-2 border-b border-surface-1 px-2 py-1 text-[12px]" role="search" data-testid="native-cli-find">
    <input ref={field} className="min-w-0 flex-1 rounded-ui bg-surface-0 px-2 py-1 text-inherit [border:0] [font:inherit]" aria-label="Find in chat" placeholder="Find in chat" value={query}
      onChange={(event) => onQuery(event.target.value)}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Enter") { event.preventDefault(); onStep(event.shiftKey ? -1 : 1); }
        else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
      }} />
    <span className="text-subtext-0" aria-live="polite" data-testid="native-cli-find-count">{query.trim() ? (count ? `${index + 1} of ${count}` : "No matches") : ""}</span>
    <button type="button" aria-label="Previous match" disabled={!count} onClick={() => onStep(-1)}>↑</button>
    <button type="button" aria-label="Next match" disabled={!count} onClick={() => onStep(1)}>↓</button>
    <button type="button" aria-label="Close find" onClick={onClose}>×</button>
  </div>;
}

/** One tick per prompt, so a long chat can be jumped through without scrolling. */
export function MessageRail({ prompts, onJump }: { prompts: { id: string; text: string }[]; onJump: (id: string) => void }) {
  if (prompts.length < 3) return null;
  return <nav className="absolute top-2 right-1 z-4 flex max-h-[60%] flex-col gap-1 overflow-y-auto" aria-label="Prompts" data-testid="native-cli-rail">
    {prompts.map((prompt) => <button key={prompt.id} type="button" title={prompt.text.slice(0, 120)} aria-label={`Jump to: ${prompt.text.slice(0, 60)}`}
      className="h-1 w-3 shrink-0 cursor-pointer rounded-full bg-surface-2 p-0 [border:0] hover:bg-accent" onClick={() => onJump(prompt.id)} />)}
  </nav>;
}

import { viewerKey } from "../../viewer";

/** Prompt recall and draft persistence for the native chat composer (Orca: `native-chat-sent-prompt-history.ts`,
 * `native-chat-composer-draft-*.ts`). Recall reads the transcript at keypress, so a reload, a remount or a prompt
 * typed in the terminal needs no history of its own. */

export type SentPrompt = { id: string; prompt: string };
export type RecallPosition = { id: string; recalled: string };

/** Oldest first. A prompt repeated back to back is one stop, as in a shell's history. */
export function sentPrompts(messages: readonly { id: string; role: string; text: string }[]): SentPrompt[] {
  const prompts: SentPrompt[] = [];
  for (const message of messages) {
    const prompt = message.role === "user" ? message.text.trim() : "";
    if (!prompt) continue;
    if (prompts.at(-1)?.prompt === prompt) prompts.pop();
    prompts.push({ id: message.id, prompt });
  }
  return prompts;
}

/** Back starts only from an empty draft; it stops at the oldest prompt, and Forward past the newest clears.
 * Null leaves the key to the caret. Recall ends as soon as the text differs from what was recalled. */
export function stepRecall(input: { direction: "back" | "forward"; prompts: readonly SentPrompt[]; position: RecallPosition | null; draft: string }): { position: RecallPosition | null; draft: string } | null {
  const { prompts, position, draft, direction } = input;
  let active = -1;
  if (position && position.recalled === draft) {
    active = prompts.findIndex((prompt) => prompt.id === position.id);
    // The echo of a prompt just sent is replaced by its transcript message: same text, new id.
    if (active < 0) active = prompts.findLastIndex((prompt) => prompt.prompt === position.recalled);
  }
  if (active < 0 && (direction === "forward" || draft !== "")) return null;
  const next = direction === "forward" ? prompts[active + 1] : prompts[active < 0 ? prompts.length - 1 : active - 1];
  if (next) return { position: { id: next.id, recalled: next.prompt }, draft: next.prompt };
  return direction === "forward" ? { position: null, draft: "" } : null;
}

/** The composer text with what was typed on the CLI's own line added, once: a composer that already holds the
 * line (whole lines, so a short draft that is only a word of it still gets it) is left as it is. */
export function withTerminalDraft(draft: string, seed: string): string {
  if (`\n${draft}\n`.includes(`\n${seed}\n`)) return draft;
  return draft ? `${draft}\n${seed}` : seed;
}

const KEY = "perch.nativeDrafts";
const MAX = 50;
const TTL_MS = 7 * 24 * 3_600_000;
type Stored = Record<string, { text: string; at: number }>;

function read(now: number): Stored {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(viewerKey(KEY)) ?? "{}");
    if (!raw || typeof raw !== "object") return {};
    return Object.fromEntries(Object.entries(raw as Stored).filter(([, entry]) => typeof entry?.text === "string" && now - entry.at < TTL_MS));
  } catch { return {}; }
}

/** The text a reload would restore for this chat. Text only: a staged file is a path on the host that may be gone. */
export function loadDraftText(key: string, now = Date.now()): string {
  return read(now)[key]?.text ?? "";
}

/** An empty text forgets the entry. Best effort, bounded to the newest `MAX` drafts for a week. */
export function saveDraftText(key: string, text: string, now = Date.now()): void {
  const stored = read(now);
  if (text.trim()) stored[key] = { text, at: now }; else delete stored[key];
  const newest = Object.entries(stored).sort((a, b) => b[1].at - a[1].at).slice(0, MAX);
  try { localStorage.setItem(viewerKey(KEY), JSON.stringify(Object.fromEntries(newest))); } catch { /* convenience only */ }
}

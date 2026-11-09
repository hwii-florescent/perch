import { viewerKey } from "../../viewer";

/** Draft persistence for the native chat composer (Orca: `native-chat-composer-draft-*.ts`) and the pick-up of a
 * line typed in the CLI. Prompt recall is the screen's own (`stock-ui/chat/recall.ts`). */

/** The composer text with what was typed on the CLI's own line added, once: a composer that already holds the
 * line (whole lines, so a short draft that is only a word of it still gets it) is left as it is. */
export function withTerminalDraft(draft: string, seed: string): string {
  if (`\n${draft}\n`.includes(`\n${seed}\n`)) return draft;
  return draft ? `${draft}\n${seed}` : seed;
}

const KEY = "perch.nativeDrafts";
const MAX = 50;
const TTL_MS = 7 * 24 * 3_600_000;
// `operationId` is the id a send of exactly this text carries, so a send cut off by a page reload is retried as the
// same operation (the core dispatches one id at most once). Absent in drafts saved before it was kept.
type Stored = Record<string, { text: string; at: number; operationId?: string }>;

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

/** The saved draft and its operation id (when it was saved with one). */
export function loadDraft(key: string, now = Date.now()): { text: string; operationId?: string } {
  const entry = read(now)[key];
  return { text: entry?.text ?? "", ...(typeof entry?.operationId === "string" && entry.operationId ? { operationId: entry.operationId } : {}) };
}

/** An empty text forgets the entry. Best effort, bounded to the newest `MAX` drafts for a week. */
export function saveDraftText(key: string, text: string, now = Date.now(), operationId?: string): void {
  const stored = read(now);
  if (text.trim()) stored[key] = { text, at: now, ...(operationId ? { operationId } : {}) }; else delete stored[key];
  const newest = Object.entries(stored).sort((a, b) => b[1].at - a[1].at).slice(0, MAX);
  try { localStorage.setItem(viewerKey(KEY), JSON.stringify(Object.fromEntries(newest))); } catch { /* convenience only */ }
}

//! Prompt recall for the composer (part of `stock:chat`; Orca: `native-chat-sent-prompt-history.ts`). Recall reads
//! the transcript at keypress, so a reload, a remount or a prompt typed in the terminal needs no history of its own.
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


/**
 * Pure helpers behind the Hosted composer's slash-command autocomplete.
 *
 * Invocation itself needs nothing special: sending `"/name args"` as a claude
 * turn runs the command, and codex invokes a skill from a bare `$name` mention
 * — the text goes out as an ordinary `chat.send`. All this module does is
 * decide *when* to offer suggestions and *which* ones, from the lists
 * `commands.list` returns (see `crates/perch-core/src/commands.rs`).
 */
import type { AgentKind, CommandEntry } from "@perch/shared";

/** The sigil each agent's command syntax uses. claude reads `/name`; codex
 * picks up a skill from a `$name` mention. */
export const AGENT_SIGIL: Record<AgentKind, string> = {
  claude: "/",
  codex: "$",
};

export interface SigilToken {
  /** Index of the sigil character in the full text. */
  start: number;
  /** What the user has typed after the sigil, up to the caret. */
  query: string;
}

/**
 * The sigil-prefixed token the caret is currently inside, or `null`.
 *
 * A token only counts when the sigil starts one — i.e. it is at the very
 * beginning of the input or directly after whitespace — so a path like
 * `src/store.ts` or a shell `$HOME` mid-sentence never pops the menu open.
 */
export function activeSigilToken(text: string, caret: number, sigil: string): SigilToken | null {
  const before = text.slice(0, Math.max(0, Math.min(caret, text.length)));
  const sigilIndex = before.lastIndexOf(sigil);
  if (sigilIndex === -1) return null;
  // Anything after the sigil must be a single unbroken token.
  const query = before.slice(sigilIndex + sigil.length);
  if (/\s/.test(query)) return null;
  // The sigil must itself start a token.
  if (sigilIndex > 0 && !/\s/.test(before[sigilIndex - 1]!)) return null;
  return { start: sigilIndex, query };
}

/** Max suggestions shown at once — the claude probe returns ~150 entries and
 * an unbounded list would cover the whole window. */
export const MAX_COMMAND_SUGGESTIONS = 40;

/**
 * Commands matching `query`, prefix matches first (then substring matches),
 * each group alphabetical. An empty query lists everything, so typing just the
 * sigil shows the full menu.
 */
export function filterCommands(entries: CommandEntry[], query: string): CommandEntry[] {
  const q = query.toLowerCase();
  const prefix: CommandEntry[] = [];
  const substring: CommandEntry[] = [];
  for (const entry of entries) {
    const name = entry.name.toLowerCase();
    if (q === "" || name.startsWith(q)) prefix.push(entry);
    else if (name.includes(q)) substring.push(entry);
  }
  const byName = (a: CommandEntry, b: CommandEntry) => a.name.localeCompare(b.name);
  prefix.sort(byName);
  substring.sort(byName);
  return [...prefix, ...substring].slice(0, MAX_COMMAND_SUGGESTIONS);
}

/**
 * Replace the sigil token at `token.start` with the chosen command, returning
 * the new text and where the caret should land. A trailing space is appended
 * so the token is complete — which both closes the popover naturally and
 * leaves the user positioned to type arguments.
 */
export function applyCommand(
  text: string,
  token: SigilToken,
  sigil: string,
  name: string,
): { text: string; caret: number } {
  const head = text.slice(0, token.start);
  const tail = text.slice(token.start + sigil.length + token.query.length);
  const inserted = `${sigil}${name} `;
  return { text: `${head}${inserted}${tail}`, caret: head.length + inserted.length };
}

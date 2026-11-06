/**
 * Pure helpers behind the native chat composer's one autocomplete menu: slash commands and skills
 * (`/name` everywhere, plus `$skill` for Codex) and `@file` mentions. The picked text is only typed
 * into the prompt; the agent itself resolves it, so nothing here needs provider knowledge beyond
 * the sigils and which kinds of entry each one lists.
 */
import { activeSigilToken, applyCommand, type SigilToken } from "../../composerCommands";

type MenuKind = "command" | "file";
export interface ActiveMenu { kind: MenuKind; sigil: string; token: SigilToken }

/** The command sigils per provider; a provider with none gets no command menu. */
const COMMAND_SIGILS: Record<string, readonly string[]> = { claude: ["/"], codex: ["/", "$"], pi: ["/"], omp: ["/"] };

/** Which entries a sigil lists. Codex keeps its built-ins under `/` and its skills under `$`;
 * every other provider's `/` lists everything it offers. */
export function sigilLists(providerId: string, sigil: string, kind: string | undefined): boolean {
  if (providerId !== "codex") return true;
  return sigil === "$" ? kind === "skill" : kind !== "skill";
}

/** The menu the caret is in, or null. `/name` only starts a command at the beginning of the message
 * (that is where the CLIs read it); `$skill` and `@file` may appear anywhere a word starts. */
export function activeMenu(text: string, caret: number, providerId: string): ActiveMenu | null {
  const file = activeSigilToken(text, caret, "@");
  let command: ActiveMenu | null = null;
  for (const sigil of COMMAND_SIGILS[providerId] ?? []) {
    const token = activeSigilToken(text, caret, sigil);
    if (token && (sigil !== "/" || token.start === 0) && (!command || token.start > command.token.start)) command = { kind: "command", sigil, token };
  }
  // The token nearest the caret wins when both could match (`$` after an `@`, say).
  if (file && (!command || file.start > command.token.start)) return { kind: "file", sigil: "@", token: file };
  return command;
}

/** `@path`, quoted when the path has whitespace so it stays one mention. */
export function fileMention(path: string): string {
  return /\s/.test(path) ? `"${path}"` : path;
}

/** Replace the active token with the picked name and leave the caret after it, ready for arguments. */
export function applyMenuItem(text: string, menu: ActiveMenu, name: string): { text: string; caret: number } {
  return applyCommand(text, menu.token, menu.sigil, menu.kind === "file" ? fileMention(name) : name);
}

/** The prompt that goes out: the text, then each staged attachment's absolute path on its own line.
 * Agents read an image or file path in the prompt themselves, as they do for a dragged-in file. */
export function withAttachmentPaths(text: string, paths: readonly string[]): string {
  if (!paths.length) return text;
  return [text.trimEnd(), ...paths].filter((part) => part !== "").join("\n");
}

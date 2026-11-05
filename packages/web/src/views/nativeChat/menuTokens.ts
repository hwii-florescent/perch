/**
 * Pure helpers behind the native chat composer's one autocomplete menu: slash commands and skills
 * (`/name` for Claude, `$name` for Codex) and `@file` mentions. The picked text is only typed into the
 * prompt; the agent itself resolves it, so nothing here needs provider knowledge beyond the sigil.
 */
import { activeSigilToken, applyCommand, type SigilToken } from "../../composerCommands";

type MenuKind = "command" | "file";
export interface ActiveMenu { kind: MenuKind; sigil: string; token: SigilToken }

/** The command sigil per provider; providers with no command list get no command menu. */
const COMMAND_SIGIL: Record<string, string> = { claude: "/", codex: "$" };

/** The menu the caret is in, or null. `/name` only starts a command at the beginning of the message
 * (that is where Claude reads it); `$skill` and `@file` may appear anywhere a word starts. */
export function activeMenu(text: string, caret: number, providerId: string): ActiveMenu | null {
  const file = activeSigilToken(text, caret, "@");
  const sigil = COMMAND_SIGIL[providerId];
  const command = sigil ? activeSigilToken(text, caret, sigil) : null;
  // The token nearest the caret wins when both could match (`$` after an `@`, say).
  if (file && (!command || file.start > command.start)) return { kind: "file", sigil: "@", token: file };
  if (command && sigil && (sigil !== "/" || command.start === 0)) return { kind: "command", sigil, token: command };
  return null;
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

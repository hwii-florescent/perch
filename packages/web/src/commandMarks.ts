/**
 * Command marks from OSC 133 ("semantic prompt") sequences: A = prompt start, C = command output
 * starts, D;<code> = command finished. Shells with integration (Ghostty, iTerm2, VS Code, kitty)
 * emit them, and so does a confirmed Run (`agent_runtime.rs`). This only observes the output stream:
 * it never writes to the PTY, never changes input, and replayed history yields the same marks.
 *
 * It gives a terminal "jump to the previous/next command" and a tick on the scrollbar for every
 * command that failed. A terminal whose shell sends no marks simply has none.
 */
import type { IDecoration, IMarker, Terminal } from "@xterm/xterm";

export interface CommandMark {
  marker: IMarker;
  /** A command actually started (C seen); a bare prompt (A only) is not a command to jump to. */
  ran: boolean;
  exit?: number;
}

/** Newest marks kept; a marker also goes when scrollback drops its line. */
const MAX_MARKS = 500;

/** `133;D;2` → { kind: "D", exit: 2 }. Unknown kinds and a missing/odd code are ignored, not failures. */
export function parseSemanticPrompt(data: string): { kind: "A" | "B" | "C" | "D"; exit?: number } | null {
  const [kind, first] = data.split(";");
  if (kind !== "A" && kind !== "B" && kind !== "C" && kind !== "D") return null;
  const exit = kind === "D" && first !== undefined && /^-?\d{1,4}$/.test(first) ? Number(first) : undefined;
  return exit === undefined ? { kind } : { kind, exit };
}

export interface CommandMarks {
  marks: readonly CommandMark[];
  /** Scroll to the previous (-1) or next (1) command; past the newest goes to the bottom. False when none. */
  jump: (dir: -1 | 1) => boolean;
}

const registry = new WeakMap<Terminal, CommandMarks>();

/** The marks of `term`, if `attachCommandMarks` ran for it. */
export const commandMarksOf = (term: Terminal): CommandMarks | undefined => registry.get(term);

export function jumpToCommand(term: Terminal, dir: -1 | 1): boolean {
  return registry.get(term)?.jump(dir) ?? false;
}

export function attachCommandMarks(term: Terminal, failureColor = () => term.options.theme?.red ?? "#e06c75"): { dispose: () => void } & CommandMarks {
  const marks: CommandMark[] = [];
  const ticks = new Map<CommandMark, IDecoration>();
  let open: CommandMark | undefined;

  const start = (): CommandMark | undefined => {
    const marker = term.registerMarker(0);
    if (!marker) return undefined;
    const mark: CommandMark = { marker, ran: false };
    marker.onDispose(() => {
      const at = marks.indexOf(mark);
      if (at >= 0) marks.splice(at, 1);
      ticks.delete(mark);
      if (open === mark) open = undefined;
    });
    marks.push(mark);
    if (marks.length > MAX_MARKS) marks[0]!.marker.dispose();
    return mark;
  };

  const handler = term.parser.registerOscHandler(133, (data) => {
    const event = parseSemanticPrompt(data);
    if (!event) return true;
    if (event.kind === "A") open = start();
    else if (event.kind === "C") {
      open ??= start(); // no prompt mark (a Run, or a shell without A): the output start is the place
      if (open) open.ran = true;
    } else if (event.kind === "D" && open?.ran) {
      open.exit = event.exit;
      if (event.exit !== undefined && event.exit !== 0) {
        const tick = term.registerDecoration({ marker: open.marker, overviewRulerOptions: { color: failureColor(), position: "full" } });
        if (tick) ticks.set(open, tick);
      }
      open = undefined;
    }
    return true; // consumed: never printed as text
  });

  const jump = (dir: -1 | 1): boolean => {
    const top = term.buffer.active.viewportY;
    const lines = marks.filter((m) => m.ran && !m.marker.isDisposed).map((m) => m.marker.line).sort((a, b) => a - b);
    const target = dir < 0 ? lines.findLast((line) => line < top) : lines.find((line) => line > top);
    if (target !== undefined) term.scrollToLine(target);
    else if (dir > 0 && lines.length > 0) term.scrollToBottom();
    else return false;
    return true;
  };

  const attached = {
    marks, jump,
    dispose: () => { handler.dispose(); for (const tick of ticks.values()) tick.dispose(); ticks.clear(); marks.length = 0; registry.delete(term); },
  };
  registry.set(term, attached);
  return attached;
}

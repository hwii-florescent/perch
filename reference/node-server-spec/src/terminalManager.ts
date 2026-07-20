import * as pty from "node-pty";
import { randomUUID } from "node:crypto";

export type TerminalDataListener = (terminalId: string, data: string) => void;
export type TerminalExitListener = (terminalId: string, code: number) => void;

/**
 * Owns the pty processes for one ws connection. Each `terminal.create`
 * message spawns a shell; input/resize/exit are routed by terminalId.
 */
export class TerminalManager {
  private readonly terminals = new Map<string, pty.IPty>();

  constructor(
    private readonly onData: TerminalDataListener,
    private readonly onExit: TerminalExitListener,
  ) {}

  create(cols: number, rows: number, cwd?: string): string {
    const id = randomUUID();
    const shell = process.env["SHELL"] ?? "/bin/bash";
    const proc = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd: cwd ?? process.cwd(),
      env: process.env as Record<string, string>,
    });

    proc.onData((data) => this.onData(id, data));
    proc.onExit(({ exitCode }) => {
      this.terminals.delete(id);
      this.onExit(id, exitCode);
    });

    this.terminals.set(id, proc);
    return id;
  }

  input(terminalId: string, data: string): void {
    this.terminals.get(terminalId)?.write(data);
  }

  resize(terminalId: string, cols: number, rows: number): void {
    this.terminals.get(terminalId)?.resize(cols, rows);
  }

  disposeAll(): void {
    for (const proc of this.terminals.values()) proc.kill();
    this.terminals.clear();
  }
}

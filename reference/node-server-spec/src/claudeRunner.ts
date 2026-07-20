import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { ChatUsage } from "@perch/shared";
import type { AgentRunner, AgentRunnerEvents } from "./agentRunner.js";

export interface ClaudeRunnerOptions {
  cwd: string;
  /** Path/name of the claude binary. Defaults to "claude" (resolved via PATH). */
  claudeBin?: string;
  /** Permission mode passed to claude. Defaults to "bypassPermissions" since
   * there is no TTY to answer interactive prompts in this headless server. */
  permissionMode?: string;
}

interface PendingToolUse {
  id: string;
  name: string;
  json: string;
}

/**
 * Drives Claude Code headlessly: `claude -p "<text>" --output-format
 * stream-json --verbose --include-partial-messages`, parsing the NDJSON
 * stream on stdout into protocol-shaped callbacks. One process is spawned
 * per turn; multi-turn continuity is achieved via `--session-id` on the
 * first turn and `--resume <id>` on subsequent turns (verified against
 * `claude` 2.1.212 — a fresh process per turn is simpler and just as fast
 * as keeping one alive over `--input-format stream-json` stdin).
 *
 * Observed event shapes (from `claude --output-format stream-json
 * --include-partial-messages`):
 *   - {type:"system", subtype:"init", session_id, cwd, ...}
 *   - {type:"stream_event", event:{type:"message_start"|"content_block_start"
 *     |"content_block_delta"|"content_block_stop"|"message_delta"|"message_stop", ...}}
 *     content_block_start.content_block.type: "text" | "thinking" | "tool_use"
 *     content_block_delta.delta.type: "text_delta" | "thinking_delta"
 *       | "signature_delta" | "input_json_delta"
 *   - {type:"assistant", message:{...}} — full snapshot, redundant with the
 *     accumulated stream_events above; ignored.
 *   - {type:"user", message:{content:[{type:"tool_result", tool_use_id, content, is_error}]}}
 *   - {type:"result", subtype, is_error, result, session_id, total_cost_usd, usage:{...}}
 */
export class ClaudeRunner implements AgentRunner {
  private claudeSessionId: string | undefined;
  private child: ChildProcessWithoutNullStreams | undefined;
  private cancelled = false;

  private readonly cwd: string;
  private readonly claudeBin: string;
  private readonly permissionMode: string;

  constructor(options: ClaudeRunnerOptions) {
    this.cwd = options.cwd;
    this.claudeBin = options.claudeBin ?? "claude";
    this.permissionMode = options.permissionMode ?? "bypassPermissions";
  }

  cancel(): void {
    this.cancelled = true;
    this.child?.kill("SIGTERM");
  }

  send(text: string, events: AgentRunnerEvents): Promise<void> {
    this.cancelled = false;

    const args = [
      "-p",
      text,
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-partial-messages",
      "--permission-mode",
      this.permissionMode,
    ];
    if (this.claudeSessionId) {
      args.push("--resume", this.claudeSessionId);
    } else {
      this.claudeSessionId = randomUUID();
      args.push("--session-id", this.claudeSessionId);
    }

    return new Promise((resolve) => {
      let child: ChildProcessWithoutNullStreams;
      try {
        child = spawn(this.claudeBin, args, { cwd: this.cwd });
      } catch (err) {
        events.onError(`failed to spawn claude: ${(err as Error).message}`);
        resolve();
        return;
      }
      this.child = child;

      let stdoutBuf = "";
      let stderrBuf = "";
      const toolNameById = new Map<string, string>();
      const pendingToolUses = new Map<number, PendingToolUse>();

      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdoutBuf += chunk;
        let newlineIndex: number;
        while ((newlineIndex = stdoutBuf.indexOf("\n")) >= 0) {
          const line = stdoutBuf.slice(0, newlineIndex);
          stdoutBuf = stdoutBuf.slice(newlineIndex + 1);
          this.handleLine(line, events, toolNameById, pendingToolUses);
        }
      });

      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        stderrBuf += chunk;
      });

      child.on("error", (err) => {
        events.onError(`failed to spawn claude: ${err.message}`);
        this.child = undefined;
        resolve();
      });

      child.on("close", (code) => {
        if (stdoutBuf.trim()) {
          this.handleLine(stdoutBuf, events, toolNameById, pendingToolUses);
        }
        if (!this.cancelled && code !== 0 && code !== null) {
          const tail = stderrBuf.trim().slice(0, 2000);
          events.onError(`claude exited with code ${code}${tail ? `: ${tail}` : ""}`);
        }
        this.child = undefined;
        resolve();
      });
    });
  }

  private handleLine(
    line: string,
    events: AgentRunnerEvents,
    toolNameById: Map<string, string>,
    pendingToolUses: Map<number, PendingToolUse>,
  ): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    let evt: Record<string, unknown>;
    try {
      evt = JSON.parse(trimmed);
    } catch {
      return; // ignore malformed / partial lines
    }

    switch (evt["type"]) {
      case "system": {
        if (evt["subtype"] === "init" && typeof evt["session_id"] === "string") {
          this.claudeSessionId = evt["session_id"];
        }
        break;
      }
      case "stream_event": {
        this.handleStreamEvent(evt["event"], events, toolNameById, pendingToolUses);
        break;
      }
      case "user": {
        const message = evt["message"] as { content?: unknown } | undefined;
        const content = message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block && typeof block === "object" && (block as { type?: unknown }).type === "tool_result") {
              const b = block as { tool_use_id?: string; content?: unknown };
              const name = (b.tool_use_id && toolNameById.get(b.tool_use_id)) ?? "unknown";
              events.onToolResult(name, b.content);
            }
          }
        }
        break;
      }
      case "result": {
        if (typeof evt["session_id"] === "string") {
          this.claudeSessionId = evt["session_id"];
        }
        const rawUsage = evt["usage"] as Record<string, number> | undefined;
        const usage: ChatUsage | undefined = rawUsage
          ? {
              inputTokens: rawUsage["input_tokens"] ?? 0,
              outputTokens: rawUsage["output_tokens"] ?? 0,
              costUsd: (evt["total_cost_usd"] as number | undefined) ?? 0,
              contextTokens:
                (rawUsage["input_tokens"] ?? 0) +
                (rawUsage["cache_read_input_tokens"] ?? 0) +
                (rawUsage["cache_creation_input_tokens"] ?? 0),
            }
          : undefined;
        if (evt["is_error"]) {
          const resultText = evt["result"];
          events.onError(typeof resultText === "string" ? resultText : "claude reported an error");
        }
        events.onDone(usage);
        break;
      }
      default:
        break; // assistant snapshots, hook events, etc. — nothing new to report
    }
  }

  private handleStreamEvent(
    event: unknown,
    events: AgentRunnerEvents,
    toolNameById: Map<string, string>,
    pendingToolUses: Map<number, PendingToolUse>,
  ): void {
    if (!event || typeof event !== "object") return;
    const se = event as Record<string, unknown>;

    switch (se["type"]) {
      case "content_block_start": {
        const index = se["index"] as number;
        const block = se["content_block"] as Record<string, unknown> | undefined;
        if (block?.["type"] === "tool_use") {
          pendingToolUses.set(index, {
            id: String(block["id"] ?? ""),
            name: String(block["name"] ?? "unknown"),
            json: "",
          });
        }
        break;
      }
      case "content_block_delta": {
        const index = se["index"] as number;
        const delta = se["delta"] as Record<string, unknown> | undefined;
        switch (delta?.["type"]) {
          case "text_delta":
            events.onChunk(String(delta["text"] ?? ""));
            break;
          case "thinking_delta":
            events.onThinking(String(delta["thinking"] ?? ""));
            break;
          case "input_json_delta": {
            const pending = pendingToolUses.get(index);
            if (pending) pending.json += String(delta["partial_json"] ?? "");
            break;
          }
          default:
            break; // signature_delta etc. — not surfaced
        }
        break;
      }
      case "content_block_stop": {
        const index = se["index"] as number;
        const pending = pendingToolUses.get(index);
        if (pending) {
          pendingToolUses.delete(index);
          toolNameById.set(pending.id, pending.name);
          let input: unknown = {};
          try {
            input = pending.json ? JSON.parse(pending.json) : {};
          } catch {
            input = pending.json;
          }
          events.onToolUse(pending.name, input);
        }
        break;
      }
      default:
        break; // message_start/delta/stop — usage is read off the final "result" event instead
    }
  }
}

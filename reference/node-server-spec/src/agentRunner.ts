import type { ChatUsage } from "@perch/shared";

/**
 * Callbacks an {@link AgentRunner} uses to stream a turn's events back to
 * the caller (the ws handler), which forwards them onto the wire.
 */
export interface AgentRunnerEvents {
  onChunk(text: string): void;
  onThinking(text: string): void;
  onToolUse(name: string, input: unknown): void;
  onToolResult(name: string, result: unknown): void;
  onDone(usage: ChatUsage | undefined): void;
  onError(message: string): void;
}

/**
 * A pluggable chat backend for a single perch session. One instance is
 * created per session and reused across turns so it can carry whatever
 * continuation state the backend needs (e.g. a provider-side session id).
 *
 * {@link ClaudeRunner} is the only implementation today; this interface
 * exists so other backends (e.g. an ACP-speaking agent) can slot in later
 * without touching the ws handler.
 */
export interface AgentRunner {
  /**
   * Start (or continue) a turn. Resolves once the turn has finished
   * emitting events — normally, on error, or because {@link cancel} was
   * called.
   */
  send(text: string, events: AgentRunnerEvents): Promise<void>;

  /** Abort the in-flight turn, if any. Safe to call when idle. */
  cancel(): void;
}

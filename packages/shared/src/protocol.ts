/**
 * Wire protocol between the perch server and its clients (web/desktop).
 *
 * This file is a frozen contract: the web client depends on these exact
 * shapes. Every message carries a `type` discriminant so both unions can be
 * narrowed with a simple `switch (msg.type)`.
 */

// ---------------------------------------------------------------------------
// Shared value types
// ---------------------------------------------------------------------------

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  contextTokens: number;
}

// ---------------------------------------------------------------------------
// Client -> Server
// ---------------------------------------------------------------------------

export interface SessionCreateMessage {
  type: "session.create";
  cwd?: string;
}

export interface SessionSubscribeMessage {
  type: "session.subscribe";
  sessionId: string;
}

/** Resume a previously-known session (e.g. from `localStorage`) after a page
 * reload or PWA reopen. The server replies with `session.created` (echoing
 * the same id) followed by `session.history` if the session still exists in
 * the database, or `session.created` with a brand-new id if it doesn't. */
export interface SessionResumeMessage {
  type: "session.resume";
  sessionId: string;
}

/** Which backend a `chat.send` should be routed to. Defaults to "claude". */
export type AgentKind = "claude" | "codex";

/** Requests that `terminal.create` spawn the given session's *interactive*
 * agent CLI (resumed from whatever conversation state that session already
 * has) instead of a plain shell. The client only names the session + agent;
 * the server alone resolves the provider-internal resume id (claude session
 * id / codex thread id) — that state never crosses the wire. */
export interface AgentAttach {
  sessionId: string;
  agent: AgentKind;
}

export interface ChatSendMessage {
  type: "chat.send";
  sessionId: string;
  text: string;
  agent?: AgentKind;
  model?: string;
}

export interface ChatCancelMessage {
  type: "chat.cancel";
  sessionId: string;
}

export interface TerminalCreateMessage {
  type: "terminal.create";
  cols: number;
  rows: number;
  cwd?: string;
  agentAttach?: AgentAttach;
}

export interface TerminalInputMessage {
  type: "terminal.input";
  terminalId: string;
  data: string;
}

export interface TerminalResizeMessage {
  type: "terminal.resize";
  terminalId: string;
  cols: number;
  rows: number;
}

export type ClientMessage =
  | SessionCreateMessage
  | SessionSubscribeMessage
  | SessionResumeMessage
  | ChatSendMessage
  | ChatCancelMessage
  | TerminalCreateMessage
  | TerminalInputMessage
  | TerminalResizeMessage;

// ---------------------------------------------------------------------------
// Server -> Client
// ---------------------------------------------------------------------------

export interface SessionCreatedMessage {
  type: "session.created";
  sessionId: string;
}

/** A single persisted turn, replayed to a resuming client. */
export interface HistoryMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  agent?: AgentKind;
  model?: string;
  thinking?: string;
  createdAt?: number;
}

/** Sent after `session.created` in response to `session.resume`, when the
 * session already existed in the database. Carries the full prior transcript
 * so the client can rebuild its message list before live events resume. */
export interface SessionHistoryMessage {
  type: "session.history";
  sessionId: string;
  messages: HistoryMessage[];
}

export interface ChatChunkMessage {
  type: "chat.chunk";
  sessionId: string;
  text: string;
}

export interface ChatThinkingMessage {
  type: "chat.thinking";
  sessionId: string;
  text: string;
}

export interface ChatToolUseMessage {
  type: "chat.tool_use";
  sessionId: string;
  name: string;
  input: unknown;
}

export interface ChatToolResultMessage {
  type: "chat.tool_result";
  sessionId: string;
  name: string;
  result: unknown;
}

export interface ChatDoneMessage {
  type: "chat.done";
  sessionId: string;
  usage?: ChatUsage;
}

export interface TerminalCreatedMessage {
  type: "terminal.created";
  terminalId: string;
}

export interface TerminalDataMessage {
  type: "terminal.data";
  terminalId: string;
  data: string;
}

export interface TerminalExitMessage {
  type: "terminal.exit";
  terminalId: string;
  code: number;
}

export interface StatusUpdateMessage {
  type: "status.update";
  cwd: string;
  branch: string;
  contextTokens?: number;
  costUsd?: number;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type ServerMessage =
  | SessionCreatedMessage
  | SessionHistoryMessage
  | ChatChunkMessage
  | ChatThinkingMessage
  | ChatToolUseMessage
  | ChatToolResultMessage
  | ChatDoneMessage
  | TerminalCreatedMessage
  | TerminalDataMessage
  | TerminalExitMessage
  | StatusUpdateMessage
  | ErrorMessage;

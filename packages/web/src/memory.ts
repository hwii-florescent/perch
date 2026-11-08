import type { MemoryFile, MemoryStateMessage } from "@perch/shared";
import { newId } from "./ids";
import { socket } from "./ws";

/** A Project's memory: plain Markdown files that agents and people write for each other. The core
 * owns the rules, the store and the revisions (`crates/perch-core/src/memory.rs`,
 * `server/memory.rs`); this only asks and tells. Nothing is pushed, so a dialog lists again when it
 * opens. Without the capability (an older core) or a connection there is nothing to show. */
export type MemoryState = Omit<MemoryStateMessage, "type" | "requestId">;
export type MemoryFileAnswer = { file?: MemoryFile; error?: string };

const CAPABILITY = "memory.v1";
const TIMEOUT_MS = 5000;
let capabilities: string[] = [];
const pending = new Map<string, (answer: unknown) => void>();

function settle(requestId: string, answer: unknown) {
  pending.get(requestId)?.(answer);
  pending.delete(requestId);
}

socket.onMessage((message) => {
  if (message.type === "server.info") capabilities = message.capabilities ?? [];
  else if (message.type === "memory.state") {
    const { type: _type, requestId, ...state } = message;
    settle(requestId, state);
  } else if (message.type === "memory.file") settle(message.requestId, { file: message.file, error: message.error });
});
// A dropped connection never answers: let waiting requests finish.
socket.onConnectionChange((connected) => {
  if (!connected) for (const id of [...pending.keys()]) settle(id, null);
});

/** Whether the connected core can keep Project memory. */
export const memoryAvailable = () => capabilities.includes(CAPABILITY) && socket.connected;

function ask<T>(build: (requestId: string) => Parameters<typeof socket.send>[0]): Promise<T | null> {
  if (!memoryAvailable()) return Promise.resolve(null);
  const requestId = newId();
  return new Promise((resolve) => {
    pending.set(requestId, resolve as (answer: unknown) => void);
    setTimeout(() => settle(requestId, null), TIMEOUT_MS);
    socket.send(build(requestId));
  });
}

/** The index; `null` when the core did not answer. */
export const listMemory = (projectId: string) =>
  ask<MemoryState>((requestId) => ({ type: "memory.list", requestId, projectId }));

export const getMemory = (projectId: string, name: string) =>
  ask<MemoryFileAnswer>((requestId) => ({ type: "memory.get", requestId, projectId, name }));

/** Create (no `baseRevision`) or replace. The answer carries `conflict` when the file moved on. */
export const saveMemory = (projectId: string, name: string, text: string, baseRevision?: string) =>
  ask<MemoryState>((requestId) => ({ type: "memory.set", requestId, projectId, name, text, baseRevision }));

export const deleteMemory = (projectId: string, name: string, baseRevision: string) =>
  ask<MemoryState>((requestId) => ({ type: "memory.delete", requestId, projectId, name, baseRevision }));

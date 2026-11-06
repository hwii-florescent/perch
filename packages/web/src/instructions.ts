import type { InstructionsStateMessage } from "@perch/shared";
import { newId } from "./ids";
import { socket } from "./ws";

/** Instructions of a Birdhouse (`project`) or Nest (`workspace`): text and reference folders that
 * every new session there launches with. The core owns the rules and the store
 * (`crates/perch-core/src/instructions.rs`, `server/instructions.rs`); this only asks and tells.
 * Without the capability (an older core) or a connection there is nothing to edit. */
export type InstructionsScope = "project" | "workspace";
export type InstructionsState = Omit<InstructionsStateMessage, "type" | "requestId">;

const CAPABILITY = "instructions.v1";
const TIMEOUT_MS = 5000;
let capabilities: string[] = [];
const pending = new Map<string, (answer: InstructionsState | null) => void>();

function settle(requestId: string, answer: InstructionsState | null) {
  pending.get(requestId)?.(answer);
  pending.delete(requestId);
}

socket.onMessage((message) => {
  if (message.type === "server.info") capabilities = message.capabilities ?? [];
  else if (message.type === "instructions.state") {
    const { type: _type, requestId, ...state } = message;
    settle(requestId, state);
  }
});
// A dropped connection never answers: let waiting requests finish.
socket.onConnectionChange((connected) => {
  if (!connected) for (const id of pending.keys()) settle(id, null);
});

/** Whether the connected core can store Instructions. */
export const instructionsAvailable = () => capabilities.includes(CAPABILITY) && socket.connected;

function ask(build: (requestId: string) => Parameters<typeof socket.send>[0]): Promise<InstructionsState | null> {
  if (!instructionsAvailable()) return Promise.resolve(null);
  const requestId = newId();
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
    setTimeout(() => settle(requestId, null), TIMEOUT_MS);
    socket.send(build(requestId));
  });
}

/** What is stored for `id`; `null` when the core did not answer. */
export const loadInstructions = (scope: InstructionsScope, id: string) =>
  ask((requestId) => ({ type: "instructions.get", requestId, scope, id }));

/** Save; the answer carries `error` (and the unchanged content) when the core refused. */
export const saveInstructions = (scope: InstructionsScope, id: string, text: string, folders: string[]) =>
  ask((requestId) => ({ type: "instructions.set", requestId, scope, id, text, folders }));

/** The folder box holds one absolute path per line. */
export const folderLines = (folders: string[]) => folders.join("\n");
export const parseFolderLines = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);

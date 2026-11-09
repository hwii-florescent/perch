import { type NativeUiBlock, type NativeUiSnapshot } from "@perch/sdk";

/** The blocks the chat draws. The core derives them (`native_ui/transcript.rs`); a core that predates
 * the projection sends none, and its messages are then shown as they came, unfolded. */
export function blocksOf(snapshot: NativeUiSnapshot | null): NativeUiBlock[] {
  if (!snapshot) return [];
  if (snapshot.transcript) return snapshot.transcript.blocks;
  return snapshot.messages
    .filter((message) => message.role !== "toolResult" && (message.role === "user" || message.text || message.error))
    .map((message) => ({ kind: "message", id: message.id, turn: "" }));
}

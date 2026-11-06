import type { NativeUiMessage } from "@perch/shared";

/** One piece of agent work shown inside a collapsed run. */
export type Step = { id: string; kind: "thinking" | "tool" | "result"; label: string; body: string };

/** What the transcript renders: a message the user reads, or a run of tool calls and thinking folded into one row. */
export type Block =
  | { kind: "message"; message: NativeUiMessage }
  | { kind: "run"; id: string; steps: Step[] };

/**
 * Fold consecutive thinking, tool calls and tool results into one run, so a long agent turn reads as
 * the user's prompt, a few collapsed "worked" rows and the answer. Text the agent wrote stays visible.
 */
export function toBlocks(messages: readonly NativeUiMessage[]): Block[] {
  const blocks: Block[] = [];
  const work = (step: Step) => {
    const last = blocks[blocks.length - 1];
    if (last?.kind === "run") last.steps.push(step);
    else blocks.push({ kind: "run", id: step.id, steps: [step] });
  };
  for (const message of messages) {
    if (message.role === "toolResult") {
      work({ id: `${message.id}:result`, kind: "result", label: `${message.toolName ?? "Tool"} result`, body: message.text });
      continue;
    }
    if (message.role !== "assistant") {
      blocks.push({ kind: "message", message });
      continue;
    }
    if (message.thinking) work({ id: `${message.id}:thinking`, kind: "thinking", label: "Thinking", body: message.thinking });
    if (message.text || message.error) blocks.push({ kind: "message", message: { ...message, thinking: "", tools: [] } });
    message.tools.forEach((tool, index) => work({ id: `${message.id}:tool:${index}`, kind: "tool", label: tool.name, body: tool.input }));
  }
  return blocks;
}

export const blockId = (block: Block) => (block.kind === "run" ? block.id : block.message.id);

/** Ids of the blocks whose text contains `query` (case-insensitive), in transcript order. */
export function findBlocks(blocks: readonly Block[], query: string): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return blocks
    .filter((block) => (block.kind === "run"
      ? block.steps.map((step) => `${step.label}\n${step.body}`).join("\n")
      : `${block.message.text}\n${block.message.error ?? ""}`).toLowerCase().includes(needle))
    .map(blockId);
}

/** "3 tool calls: read, bash +1", or "Thinking" when no tool ran. */
export function summarizeRun(steps: readonly Step[]): string {
  const tools = steps.filter((step) => step.kind === "tool");
  if (!tools.length) return steps.some((step) => step.kind === "result") ? "Tool results" : "Thinking";
  const names = [...new Set(tools.map((step) => step.label))];
  const shown = names.slice(0, 3).join(", ");
  const more = names.length > 3 ? ` +${names.length - 3}` : "";
  return `${tools.length} tool ${tools.length === 1 ? "call" : "calls"}: ${shown}${more}`;
}

import type { AgentKind, ModelEntry } from "@perch/shared";

export type { ModelEntry };

export interface ModelOption {
  id: string;
  label: string;
}

export const AGENTS: { id: AgentKind; label: string }[] = [
  { id: "claude", label: "Claude" },
  { id: "codex", label: "Codex" },
];

/** First (default) model for an agent given the server-provided available list.
 * Returns "" when the list is empty (server not yet connected). */
export function defaultModel(agent: AgentKind, available: ModelEntry[]): string {
  return available[0]?.id ?? "";
}

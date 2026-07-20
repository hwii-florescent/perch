import type { AgentKind } from "@perch/shared";

export interface ModelOption {
  id: string;
  label: string;
}

/** Per-agent model choices shown in the chat input's model dropdown. */
export const MODELS: Record<AgentKind, ModelOption[]> = {
  claude: [
    { id: "claude-haiku-4-5", label: "Haiku 4.5" },
    { id: "claude-sonnet-5", label: "Sonnet 5" },
  ],
  codex: [
    { id: "gpt-5.4-mini", label: "GPT-5.4 mini" },
    { id: "gpt-5.6-terra", label: "GPT-5.6 terra" },
  ],
};

export const AGENTS: { id: AgentKind; label: string }[] = [
  { id: "claude", label: "Claude" },
  { id: "codex", label: "Codex" },
];

/** First (default) model for an agent — the lists above are never empty. */
export function defaultModel(agent: AgentKind): string {
  return MODELS[agent][0]!.id;
}

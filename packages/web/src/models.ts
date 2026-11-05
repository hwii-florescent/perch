import type { AgentKind } from "@perch/shared";

export const AGENTS: { id: AgentKind; label: string }[] = [
  { id: "claude", label: "Claude" },
  { id: "codex", label: "Codex" },
];

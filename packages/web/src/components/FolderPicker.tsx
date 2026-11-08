import { useEffect, useRef } from "react";
import { cn } from "../lib/cn";
import { requestAddProject } from "../appEvents";
import { usePerchStore } from "../store";
import { AGENT_PICKER } from "./AgentPicker";
import { Select } from "./ui/select";

/** Where a new chat can start. `key` is the cwd it starts in ("~" is Quickchat); the rest is display. */
export interface StartTarget { key: string; label: string; name: string; path: string }

const ADD = "\0add-project";

/** The start screens' folder chip (Codex's project chip): the current folder, the other projects, Quickchat,
 * and "Add project…", which opens the sidebar's add flow and selects the project it creates. */
export function FolderPicker({ targets, value, onChange, testId = "cli-start-target" }: { targets: StartTarget[]; value: string; onChange: (key: string) => void; testId?: string }) {
  // Stops listening for the project the add flow is about to create.
  const stopWaiting = useRef<(() => void) | null>(null);
  useEffect(() => () => stopWaiting.current?.(), []);
  function add() {
    stopWaiting.current?.();
    const known = new Set(usePerchStore.getState().workspaceProjects.map((project) => project.id));
    // Listens on the store, not a render: the sidebar clears the request as soon as it sees success.
    // ponytail: a dismissed dialog keeps this armed until the next project is added or another folder is picked.
    const stop = usePerchStore.subscribe((state) => {
      const request = state.workspaceProjectCreate;
      if (request?.status !== "success") return;
      stop(); stopWaiting.current = null;
      const created = state.workspaceProjects.find((project) => project.hostId === request.hostId && !known.has(project.id))
        ?? state.workspaceProjects.find((project) => project.hostId === request.hostId && project.path === request.path);
      if (created) onChange(created.path);
    });
    stopWaiting.current = stop;
    requestAddProject();
  }
  return <Select
    className={cn(AGENT_PICKER, "max-w-full text-[0.8rem] [--picker-bg:var(--surface-0)]")}
    ariaLabel="Where to open"
    testId={testId}
    value={value}
    onChange={(key) => { if (key === ADD) { add(); return; } stopWaiting.current?.(); stopWaiting.current = null; onChange(key); }}
    options={[...targets.map((target) => ({ value: target.key, label: target.label })), { value: ADD, text: "Add project", label: <span className="text-accent">Add project…</span> }]}
  />;
}

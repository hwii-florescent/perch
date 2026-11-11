/**
 * ProjectHomeTab.tsx: a Project's home as a tab. The screen is `stock:project-home` (`stock-ui/project-home/main.tsx`) or
 * the person's package chosen for it; this binds it to the core (`projectOverview.ts`: the groups are the core's) and to
 * the Instructions and memory dialogs.
 */
import { useState } from "react";
import { useProjectOverview } from "../projectOverview";
import ProjectHome from "../stock-ui/project-home/main";
import { usePerchStore } from "../store";
import { InstructionsDialog } from "./InstructionsDialog";
import { MemoryDialog } from "./MemoryDialog";
import { StockRoute } from "./mod-root";

export function ProjectHomeTab({ projectId, name }: { projectId: string; name: string }) {
  const { groups, error } = useProjectOverview(projectId);
  const [dialog, setDialog] = useState<"instructions" | "memory" | null>(null);
  const props = {
    projectId, name, groups, ...(error ? { error } : {}),
    onOpen: (sessionId: string) => usePerchStore.getState().switchSession(sessionId),
    onInstructions: () => setDialog("instructions"),
    onMemory: () => setDialog("memory"),
  };
  return <>
    <StockRoute name="project-home" props={props} stock={ProjectHome} />
    {dialog === "instructions" && <InstructionsDialog scope="project" id={projectId} name={name} onClose={() => setDialog(null)} />}
    {dialog === "memory" && <MemoryDialog projectId={projectId} name={name} onClose={() => setDialog(null)} />}
  </>;
}

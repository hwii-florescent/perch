import { placeFloat, showStackChild, toggleNode } from "./layoutState";
import { usePerchStore } from "./store";

/** App commands that take arguments, for `api.run(id, args)` (keys cannot run these, so they are not
 * in the keybinding table). Add one here and it is listed by `api.commands()` and the guide. */
const needsId = (args: unknown): string => {
  const id = (args as { id?: unknown } | null | undefined)?.id;
  if (typeof id !== "string" || !id) throw new Error('This command needs {id: "…"}.');
  return id;
};

export const TYPED_COMMANDS: Record<string, { description: string; args: string; run: (args: unknown) => void }> = {
  "session.open": { description: "Go to a session", args: "{id}", run: (args) => usePerchStore.getState().switchSession(needsId(args)) },
  "session.close": { description: "Delete a session", args: "{id}", run: (args) => usePerchStore.getState().deleteSession(needsId(args)) },
  "project.focus": { description: "Focus a project", args: "{id}", run: (args) => usePerchStore.getState().focusWorkspaceProject(needsId(args)) },
  "layout.toggle": { description: "Hide or show a node of the shown layout", args: "{id, hidden?}", run: toggleNode },
  "layout.float": { description: "Move a floating node to an edge and place along it (no edge puts it back)", args: "{id, edge?, align?}", run: placeFloat },
  "layout.stack": { description: "Show one child of a layout's stack", args: "{stack, child}", run: showStackChild },
  "workspace.focus": { description: "Focus a workspace", args: "{id}", run: (args) => usePerchStore.getState().focusWorkspace(needsId(args)) },
};

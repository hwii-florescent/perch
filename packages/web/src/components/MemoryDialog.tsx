/**
 * MemoryDialog.tsx: a Project's memory files. The screen is `stock:memory` (`stock-ui/memory/main.tsx`) or the
 * person's package chosen for it (`perch mod use stock:memory <id>`); this file binds it to the core (`memory.ts`:
 * names, caps and revisions are the core's, and a write based on a stale revision is refused).
 */
import { deleteMemory, getMemory, listMemory, memoryOffAvailable, saveMemory, setMemoryEnabled } from "../memory";
import Memory from "../stock-ui/memory/main";
import { StockRoute } from "./mod-root";

export function MemoryDialog({ projectId, name, onClose }: { projectId: string; name: string; onClose: () => void }) {
  const props = {
    projectId, name, onClose,
    list: () => listMemory(projectId),
    get: (file: string) => getMemory(projectId, file),
    save: (file: string, text: string, baseRevision?: string) => saveMemory(projectId, file, text, baseRevision),
    remove: (file: string, revision: string) => deleteMemory(projectId, file, revision),
    setEnabled: memoryOffAvailable() ? (enabled: boolean) => setMemoryEnabled(projectId, enabled) : undefined,
  };
  return <StockRoute name="memory" props={props} stock={Memory} />;
}

/**
 * InstructionsDialog.tsx: a Project's or Workspace's Instructions. The screen is `stock:instructions`
 * (`stock-ui/instructions/main.tsx`) or the person's package chosen for it (`perch mod use stock:instructions <id>`);
 * this file binds it to the core (`instructions.ts`: the core checks, caps and stores them).
 */
import type { InstructionsScope } from "../instructions";
import { loadInstructions, saveInstructions } from "../instructions";
import Instructions from "../stock-ui/instructions/main";
import { StockRoute } from "./mod-root";

export function InstructionsDialog({ scope, id, name, onClose }: { scope: InstructionsScope; id: string; name: string; onClose: () => void }) {
  const props = {
    scope, id, name, onClose,
    load: () => loadInstructions(scope, id),
    save: (text: string, folders: string[]) => saveInstructions(scope, id, text, folders),
  };
  return <StockRoute name="instructions" props={props} stock={Instructions} />;
}

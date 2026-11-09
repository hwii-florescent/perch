import { createRoot } from "react-dom/client";
import type { LayoutNode } from "@perch/shared";
import { LayoutContent } from "./LayoutRoot";

/** Mounts checked layout content (`modUi.ts` `surfaceLayout`) into a mod's overlay, popup or window; returns the
 * unmount, which lets go of any borrowed terminal (back to where it was) and stops nothing. */
export function mountLayout(el: HTMLElement, node: LayoutNode, scope: string): () => void {
  const root = createRoot(el);
  root.render(<LayoutContent node={node} scope={scope} />);
  // Unmounting inside another render warns, so it waits for the current task to finish.
  return () => { queueMicrotask(() => root.unmount()); };
}

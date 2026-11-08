import { useSyncExternalStore, type CSSProperties } from "react";
import type { LayoutNode, ModInfo } from "@perch/shared";
import { currentMods, subscribeMods } from "../mods";
import { cn } from "../lib/cn";
import { StatusBar } from "../StatusBar";
import { Sidebar } from "../Sidebar";
import { ModView } from "./ModView";
import { SplitCanvas } from "./SplitCanvas";
import { TabBar } from "./TabBar";
import { WorkspaceTools } from "./WorkspaceTools";

// The same card the stock window draws its three panes on.
const CARD = "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[12px] bg-[var(--card-bg)]";

/** One of Perch's own panes, or a mod's view, by the name a layout gives it. */
function Block({ content, mods }: { content: string; mods: ModInfo[] }) {
  switch (content) {
    case "sidebar": return <Sidebar />;
    case "tabs": return <div className="flex h-11 shrink-0 items-center"><TabBar /></div>;
    case "canvas": return <main className="dock-area relative flex min-h-0 min-w-0 flex-1"><SplitCanvas /></main>;
    case "files": return <WorkspaceTools tab="files" />;
    case "git": return <WorkspaceTools tab="gitReview" />;
    case "status": return <StatusBar />;
  }
  const mod = mods.find((candidate) => `mod:${candidate.id}` === content);
  if (!mod?.enabled || mod.error) return <div className="inactive-session-pane">{`${content} is off or gone.`}</div>;
  return <ModView mod={mod} />;
}

function Node({ node, mods, root }: { node: LayoutNode; mods: ModInfo[]; root?: boolean }) {
  if (node.hidden) return null;
  const { px, weight } = node.size ?? {};
  const style: CSSProperties = {
    flex: root ? "1 1 0%" : px != null ? `0 0 ${px}px` : `${weight ?? 1} 1 0%`,
    padding: node.padding || undefined,
  };
  if (node.type === "block") return <div className={CARD} style={style} data-testid={`layout-${node.content}`}><Block content={node.content} mods={mods} /></div>;
  return (
    <div className={cn("flex min-h-0 min-w-0", node.type === "row" ? "flex-row" : "flex-col")} style={{ ...style, gap: node.gap || undefined }}>
      {node.children.map((child, index) => <Node key={index} node={child} mods={mods} />)}
    </div>
  );
}

/** The whole window as a layout file describes it, in the place the stock three cards would be. The
 * core has already checked the shape; a layout that stops parsing is never passed here. */
export function LayoutRoot({ root }: { root: LayoutNode }) {
  const mods = useSyncExternalStore(subscribeMods, currentMods)?.mods ?? [];
  return <div className="flex min-h-0 flex-1 px-2 pt-2" data-testid="layout-root"><Node node={root} mods={mods} root /></div>;
}

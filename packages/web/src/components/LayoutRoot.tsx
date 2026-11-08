import { useEffect, useSyncExternalStore, type CSSProperties } from "react";
import { lookVars, setRootLook } from "../themes";
import type { LayoutNode, ModInfo } from "@perch/shared";
import { currentMods, subscribeMods } from "../mods";
import { cn } from "../lib/cn";
import { StatusBar } from "../StatusBar";
import { Sidebar } from "../Sidebar";
import { ModView } from "./ModView";
import { SplitCanvas } from "./SplitCanvas";
import { TabBar } from "./TabBar";
import { PersistentTerminal } from "../views/PersistentTerminal";
import { WorkspaceTools } from "./WorkspaceTools";

// The same card the stock window draws its three panes on.
const CARD = "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--card-radius,12px)] bg-[var(--card-bg)]";
const OUTLINE: CSSProperties = { borderStyle: "solid", borderWidth: "var(--card-border, 0px)", borderColor: "var(--overlay-0)" };

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
  // A live terminal of a session. A terminal shows in one place at a time: if the session is also in
  // the canvas, put it in this block or the canvas, not both.
  if (content.startsWith("terminal:")) return <PersistentTerminal active sessionId={content.slice("terminal:".length)} />;
  const mod = mods.find((candidate) => `mod:${candidate.id}` === content);
  if (!mod?.enabled || mod.error) return <div className="inactive-session-pane">{`${content} is off or gone.`}</div>;
  return <ModView mod={mod} />;
}

function Node({ node, mods, root }: { node: LayoutNode; mods: ModInfo[]; root?: boolean }) {
  if (node.hidden) return null;
  const { px, weight } = node.size ?? {};
  // The root's look is on <html> (menus and dialogs outside this tree follow it); below it, the
  // custom properties cascade to the children from here.
  const style: CSSProperties = {
    ...(root ? {} : lookVars(node, true)),
    fontFamily: root ? undefined : node.font,
    flex: root ? "1 1 0%" : px != null ? `0 0 ${px}px` : `${weight ?? 1} 1 0%`,
    padding: node.padding || undefined,
    background: node.background,
    // Out of the flow, over the window and under dialogs.
    ...(node.float && !root ? { position: "fixed", left: node.float.x, top: node.float.y, width: node.float.width, height: node.float.height, zIndex: 1500, flex: "none" } : {}),
  };
  if (node.type === "block") return <div className={CARD} style={{ ...style, ...OUTLINE }} data-testid={`layout-${node.content}`}><Block content={node.content} mods={mods} /></div>;
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
  const { theme, colors, font, radius, border } = root;
  const look = JSON.stringify({ theme, colors, font, radius, border });
  // A root background paints the window behind the cards.
  useEffect(() => {
    setRootLook(lookVars(JSON.parse(look), false));
    return () => setRootLook({});
  }, [look]);
  return <div className="flex min-h-0 flex-1 px-2 pt-2" style={{ background: root.background }} data-testid="layout-root"><Node node={{ ...root, background: undefined }} mods={mods} root /></div>;
}

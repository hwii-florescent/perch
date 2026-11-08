import { useEffect, useState, useSyncExternalStore } from "react";
import type { ModInfo } from "@perch/shared";
import { getDockviewController } from "../dockview/dockviewController";
import { approveMod, currentMods, modPanelUrl, onModOpen, subscribeMods } from "../mods";
import { cn } from "../lib/cn";
import { button } from "./ui/button";
import { glass } from "./ui/glass";
import { PanelOverlay } from "./ModPanelFrame";

const SEEN_KEY = "perch.mods.docked";
const readSeen = (): string[] => {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]; } catch { return []; }
};

/** Opens each docked panel of an Active mod once per version of the mod (so a reload never reopens
 * what a person closed, and an edited mod shows again). Returns the keys it has now opened. */
export function dockNewPanels(mods: ModInfo[], seen: string[], dock = getDockviewController()): string[] {
  if (!dock) return seen;
  const next = [...seen];
  for (const mod of mods) {
    if (mod.status.state !== "active") continue;
    for (const panel of mod.panels.filter((p) => p.placement === "dock")) {
      const key = `${mod.id}:${panel.id}:${mod.hash}`;
      if (next.includes(key)) continue;
      dock.openModPanel(mod.id, panel.id, `${mod.name || mod.id}: ${panel.title}`);
      next.push(key);
    }
  }
  return next.slice(-200);
}

/** The main screen's side of mods, in chat and terminal alike: a card for a mod that waits for the
 * person's approval, docked panels opening as soon as their mod is Active, and `perch mod open`.
 * Settings > Mods only lists and removes. The core still decides everything; a click here is the
 * person's approval. */
export function ModsHost() {
  const state = useSyncExternalStore(subscribeMods, currentMods);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [overlay, setOverlay] = useState<{ title: string; src: string; canRead: boolean } | null>(null);

  useEffect(() => {
    if (!state) return;
    const seen = readSeen();
    const next = dockNewPanels(state.mods, seen);
    if (next.length !== seen.length) localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  }, [state]);

  useEffect(() => onModOpen((modId, panelId) => {
    const mod = currentMods()?.mods.find((candidate) => candidate.id === modId);
    const panel = mod?.panels.find((candidate) => candidate.id === panelId);
    if (!mod || !panel || mod.status.state !== "active") return;
    const title = `${mod.name || mod.id}: ${panel.title}`;
    const dock = getDockviewController();
    if (panel.placement === "dock" && dock) dock.openModPanel(mod.id, panel.id, title);
    else setOverlay({ title, src: modPanelUrl(mod.id, panel.id), canRead: mod.required.includes("read-project") });
  }), []);

  const waiting = (state?.mods ?? []).filter((mod) => mod.status.state === "pending" && !dismissed.includes(`${mod.id}:${mod.hash}`));
  return (
    <>
      {waiting.length > 0 && (
        <div className="fixed bottom-10 right-3 z-[2000] flex max-h-[70%] max-w-[min(34rem,calc(100%-1.5rem))] flex-col items-end gap-1" data-testid="mods-waiting">
          {expanded && (
            <div className={cn(glass, "min-h-0 overflow-y-auto rounded-soft p-3")} data-testid="mods-waiting-panel">
              {waiting.map((mod) => (
                <div key={mod.id} className="border-b border-surface-1 py-2 last:border-b-0" data-testid={`mods-waiting-${mod.id}`}>
                  <div className="text-[0.85rem] font-medium text-fg">{mod.name || mod.id} <span className="text-fg-muted">{mod.version}</span></div>
                  {mod.description && <div className="text-[0.8rem] text-fg-muted">{mod.description}</div>}
                  <div className="mt-1 text-[0.75rem] text-fg-muted">Approving lets this run as you:</div>
                  <ul className="m-0 list-none p-0 font-mono text-[0.75rem] text-fg">
                    {mod.preview.map((line) => <li key={line} className="break-all">{line}</li>)}
                  </ul>
                  <div className="text-[0.75rem] text-fg-muted">Needs: {mod.required.join(", ") || "nothing special"}</div>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className={button({ size: "md", variant: "primary" })} disabled={busy} onClick={async () => { setBusy(true); await approveMod(mod.id, mod.hash); setBusy(false); }}>Approve</button>
                    <button type="button" className={button({ size: "md", variant: "soft" })} onClick={() => setDismissed((all) => [...all, `${mod.id}:${mod.hash}`])}>Not now</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button type="button" aria-expanded={expanded} data-testid="mods-waiting-toggle" onClick={() => setExpanded(!expanded)} className={cn(glass, button({ size: "md", variant: "soft" }))}>
            {waiting.length === 1 ? "1 mod waiting for approval" : `${waiting.length} mods waiting for approval`}
          </button>
        </div>
      )}
      {overlay && <PanelOverlay {...overlay} onClose={() => setOverlay(null)} />}
    </>
  );
}

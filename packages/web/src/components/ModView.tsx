import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ModInfo } from "@perch/shared";
import { createSwapper } from "../modApp";
import { currentMods, modFileUrl, reportMod, subscribeMods } from "../mods";
import { GHOST_BUTTON } from "./ui/icon-button";

/** A mod's view: its own JavaScript, run inside Perch with the person's full access. A newer version
 * replaces the old only once it has mounted, so a broken edit leaves the last good one in place and
 * says why. It reloads by itself when the mod's files change. `hidden` is a mod with no view. */
export function ModView({ mod, hidden, props }: { mod: ModInfo; hidden?: boolean; props?: Record<string, unknown> }) {
  const host = useRef<HTMLDivElement>(null);
  const swapper = useRef<ReturnType<typeof createSwapper> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    swapper.current = createSwapper(host.current!, setError);
    return () => swapper.current?.stop();
  }, []);
  // New props load the mod again, like a new revision does.
  const given = JSON.stringify(props ?? {});
  useEffect(() => {
    void swapper.current?.load(modFileUrl(mod.id), mod.id, (problem) => reportMod(mod.id, mod.revision, problem), JSON.parse(given));
  }, [mod.id, mod.revision, given]);
  return (
    <div className={hidden ? "hidden" : "relative h-full w-full min-h-0 flex-1 overflow-auto"} data-testid={`mod-view-${mod.id}`}>
      <div ref={host} className="h-full w-full" />
      {error && <p className="absolute bottom-0 left-0 right-0 m-0 bg-panel-bg p-2 text-[0.75rem] text-red" role="alert" data-testid="mod-error">{error}{hidden ? "" : " The last working version is still showing."}</p>}
    </div>
  );
}

export function ModOverlay({ mod, onClose }: { mod: ModInfo; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[2100] flex flex-col bg-[rgba(0,0,0,0.55)] p-6" role="dialog" aria-modal="true" aria-label={mod.name} data-testid="mod-overlay" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <div className="mx-auto flex min-h-0 w-full max-w-[56rem] flex-1 flex-col gap-2 rounded-ui bg-panel-bg p-3">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-[0.9rem] font-semibold text-fg">{mod.name}</h2>
          <button type="button" className={GHOST_BUTTON} onClick={onClose} autoFocus>Close</button>
        </div>
        <ModView mod={mod} />
      </div>
    </div>
  );
}

/** A mod shown as a tab or a tile of the canvas (`tab.new {mod}`, `pane.split {mod}`). */
export function ModPane({ modId, props }: { modId: string; props?: Record<string, unknown> }) {
  const mod = useSyncExternalStore(subscribeMods, currentMods)?.mods.find((candidate) => candidate.id === modId);
  if (!mod?.enabled || mod.error) return <div className="inactive-session-pane">{`mod ${modId} is off or gone.`}</div>;
  return <div tabIndex={-1} data-mod-pane className="flex h-full w-full min-h-0 flex-1 [outline:none]"><ModView mod={mod} props={props} /></div>;
}

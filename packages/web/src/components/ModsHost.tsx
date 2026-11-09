import { useEffect, useState, useSyncExternalStore } from "react";
import type { ModInfo } from "@perch/shared";
import { getDockviewController } from "../dockview/dockviewController";
import { currentMods, onModOpen, subscribeMods } from "../mods";
import { usePerchStore } from "../store";
import { ModOverlay, ModView } from "./ModView";
import { useIsPhoneDevice } from "../phoneMods";

const SEEN_KEY = "perch.mods.docked";
const readSeen = (): string[] => {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]; } catch { return []; }
};

/** Docks each docked mod once per version of it (so a reload never reopens what a person closed,
 * and an edited mod shows again). Returns the keys it has now opened. */
export function dockNewMods(mods: ModInfo[], seen: string[], dock = getDockviewController()): string[] {
  if (!dock) return seen;
  const next = [...seen];
  for (const mod of mods) {
    const key = `${mod.id}:${mod.revision}`;
    if (!mod.enabled || mod.place !== "dock" || next.includes(key)) continue;
    dock.openModPanel(mod.id, mod.name);
    next.push(key);
  }
  return next.slice(-200);
}

/** The main screen's side of mods, in chat and terminal alike: docked mods open as soon as they
 * exist, mods with no view run hidden, `perch mod open` shows one, and ctrl+alt+shift+Escape turns
 * every mod off (herdr's escape hatch, for a mod that breaks the page). Settings only lists. */
export function ModsHost() {
  // A phone keeps its own screens: the desktop's docked, hidden and overlaid packages never run there (`phoneMods.ts`).
  const phone = useIsPhoneDevice();
  const state = useSyncExternalStore(subscribeMods, currentMods);
  const updateSettings = usePerchStore((s) => s.updateSettings);
  const [overlay, setOverlay] = useState<string | null>(null);

  useEffect(() => {
    if (!state || phone) return;
    const seen = readSeen();
    const next = dockNewMods(state.mods, seen);
    if (next.length !== seen.length) localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  }, [state, phone]);

  useEffect(() => onModOpen((modId) => {
    const mod = currentMods()?.mods.find((candidate) => candidate.id === modId);
    if (!mod?.enabled) return;
    const dock = getDockviewController();
    if (mod.place === "dock" && dock) dock.openModPanel(mod.id, mod.name);
    else setOverlay(mod.id);
  }), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.altKey && event.shiftKey && event.key === "Escape") updateSettings({ mods: { off: true } });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [updateSettings]);

  const mods = phone ? [] : state?.mods ?? [];
  const shown = overlay ? mods.find((mod) => mod.id === overlay && mod.enabled) : undefined;
  return (
    <>
      {mods.filter((mod) => mod.enabled && mod.place === "none").map((mod) => <ModView key={mod.id} mod={mod} hidden instance={`hidden:${mod.id}`} />)}
      {shown && <ModOverlay mod={shown} onClose={() => setOverlay(null)} />}
    </>
  );
}

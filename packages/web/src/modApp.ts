import { getWorkspaceFileUrl } from "./base";
import { isRelayMode, relayBlobUrl } from "./relay/transport";
import { usePerchStore } from "./store";
import { workspaceRecord } from "./terminalScope";
import { socket } from "./ws";

/** What a mod gets: the whole app, as in herdr's desktop app. A mod is trusted code that runs inside
 * Perch's own page with the person's full access (no sandbox, no approval), so `store` and `socket`
 * are the real ones. Everything else here is a convenience over them. */
export interface ModApi {
  modId: string;
  store: typeof usePerchStore;
  socket: typeof socket;
  focusSession(sessionId: string): void;
  /** A text file of the open local project. */
  readFile(path: string): Promise<string>;
}

/** A mod's default export: draws into `el` and may return what to undo when it is replaced. */
export type ModMount = (el: HTMLElement, api: ModApi) => void | (() => void) | Promise<void | (() => void)>;

/** Text from the core, through the relay when that is how this page is connected. */
async function fetchText(url: string): Promise<string> {
  const target = isRelayMode() ? await relayBlobUrl(url) : url;
  try {
    const response = await fetch(target, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`Could not load it (${response.status}).`);
    return await response.text();
  } finally {
    if (target !== url) URL.revokeObjectURL(target);
  }
}

export function modApi(modId: string): ModApi {
  return {
    modId,
    store: usePerchStore,
    socket,
    focusSession: (sessionId) => usePerchStore.getState().switchSession(sessionId),
    readFile: (path) => {
      const state = usePerchStore.getState();
      const workspaceId = state.activeWorkspaceId;
      if (!workspaceId || workspaceRecord(state, workspaceId)?.hostId !== "local") return Promise.reject(new Error("No local project is open."));
      return fetchText(getWorkspaceFileUrl(workspaceId, path));
    },
  };
}

/** Fetches a mod's code and imports it from a blob, so each edit is a fresh module. Nothing is
 * mounted if it fails to load, which is what lets the caller keep the last good version. */
export async function importMod(src: string): Promise<ModMount> {
  const url = URL.createObjectURL(new Blob([await fetchText(src)], { type: "text/javascript" }));
  try {
    const loaded = (await import(/* @vite-ignore */ url)) as { default?: unknown };
    if (typeof loaded.default !== "function") throw new Error("The mod must export a default function (el, api).");
    return loaded.default as ModMount;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Mounts a new version into `host`, and only once it has mounted removes the old one. A version that
 * fails to load or throws leaves the previous one on screen and reports why. */
export function createSwapper(host: HTMLElement, report: (error: string | null) => void, importer: (src: string) => Promise<ModMount> = importMod) {
  let undo: (() => void) | undefined;
  let live = true;
  return {
    async load(src: string, modId: string): Promise<void> {
      const next = document.createElement("div");
      next.style.cssText = "display:none;height:100%;width:100%";
      host.append(next);
      try {
        const cleanup = await (await importer(src))(next, modApi(modId));
        if (!live) { cleanup?.(); next.remove(); return; }
        const previous = undo;
        undo = cleanup || undefined;
        for (const child of [...host.children]) if (child !== next) child.remove();
        next.style.display = "";
        previous?.();
        report(null);
      } catch (error) {
        next.remove();
        report(error instanceof Error ? error.message : String(error));
      }
    },
    stop() {
      live = false;
      undo?.();
      undo = undefined;
    },
  };
}

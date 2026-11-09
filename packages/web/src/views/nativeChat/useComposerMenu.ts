import { useEffect, useMemo, useState } from "react";
import { usePerchStore } from "../../store";
import { filterCommands } from "../../composerCommands";
import { activeMenu, applyMenuItem, sigilLists, type ActiveMenu } from "./menuTokens";
import { useFileSearch } from "./useFileSearch";

const MAX_FILES = 20;

export interface MenuItem { key: string; label: string; detail?: string }

/** The composer's autocomplete: which menu the caret is in, its items and the highlighted one.
 * Esc dismisses it until the token under the caret ends. */
export function useComposerMenu({ text, caret, sessionId, providerId, enabled }: { text: string; caret: number; sessionId: string; providerId: string; enabled: boolean }) {
  const found = enabled ? activeMenu(text, caret, providerId) : null;
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  useEffect(() => { if (!found) setDismissed(null); }, [found]);
  const menu: ActiveMenu | null = found && dismissed !== found.token.start ? found : null;

  const session = usePerchStore((state) => state.sessions.find((entry) => entry.id === sessionId));
  const commands = usePerchStore((state) => state.sessionCommands[sessionId]);
  const fetchCommands = usePerchStore((state) => state.fetchCommands);
  const hostId = session?.hostId ?? "local";
  const capabilities = usePerchStore((state) => (hostId === "local" ? state.serverInfo?.capabilities : state.workspaceCapabilitiesByHost[hostId]));
  useEffect(() => { if (menu?.kind === "command") fetchCommands(sessionId); }, [menu?.kind, sessionId, fetchCommands]);

  const query = menu?.token.query ?? "";
  const files = useFileSearch(session?.workspaceId, menu?.kind === "file" && query !== "" ? query : null, capabilities?.includes("fs.search") === true);
  const items = useMemo<MenuItem[]>(() => {
    if (!menu) return [];
    if (menu.kind === "file") return files.slice(0, MAX_FILES).map((entry) => ({ key: entry.path, label: entry.path }));
    const list = (commands?.[providerId as keyof typeof commands] ?? []).filter((entry) => sigilLists(providerId, menu.sigil, entry.kind));
    return filterCommands(list, query).map((entry) => {
      const detail = [entry.argumentHint, entry.description].filter(Boolean).join("  ");
      return { key: entry.name, label: `${menu.sigil}${entry.name}`, ...(detail ? { detail } : {}) };
    });
  }, [menu, files, commands, providerId, query]);
  useEffect(() => { setActive(0); }, [menu?.kind, query, items.length]);

  const open = menu !== null && items.length > 0;
  return {
    open, items, active, setActive,
    label: menu?.kind === "file" ? "Files" : "Commands",
    dismiss: () => { if (found) setDismissed(found.token.start); },
    move: (step: 1 | -1) => setActive((index) => (index + step + items.length) % items.length),
    /** The text after picking item `index`, or null when no menu is open. */
    pick: (index: number) => (menu && items[index] ? applyMenuItem(text, menu, items[index].key) : null),
  };
}

/**
 * KeybindHelp.tsx — Phase 4 (Keybindings + Navigator) searchable modal
 * listing every binding from `../keybinds.ts`'s `KEYBINDS` table, grouped by
 * `KeybindGroup`. Opened via the Cmd+/ shortcut, plain `?` (outside inputs) or the
 * leader chord `Ctrl+Space, ?`.
 *
 * Portal-rendered into `document.body`, same structural pattern as
 * `Navigator.tsx` (backdrop + centered panel).
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { keybindEntries, type KeybindGroup } from "../keybinds";
import { usePerchStore } from "../store";

export interface KeybindHelpProps {
  open: boolean;
  onClose: () => void;
}

const GROUP_LABELS: Record<KeybindGroup, string> = {
  global: "Global",
  tabs: "Tabs",
  nests: "Nests and birdhouses",
  panes: "Splits and panes",
  terminal: "Terminal",
  leader: "Leader (Ctrl+Space, then a key)",
};

const GROUP_ORDER: KeybindGroup[] = ["global", "tabs", "nests", "panes", "terminal", "leader"];

export function KeybindHelp({ open, onClose }: KeybindHelpProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const overrides = usePerchStore((s) => s.settings?.keybindings);
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = keybindEntries().filter(
      (k) => !q || k.keys.toLowerCase().includes(q) || k.description.toLowerCase().includes(q),
    );
    return GROUP_ORDER.map((group) => ({
      group,
      entries: filtered.filter((k) => k.group === group),
    })).filter((g) => g.entries.length > 0);
  }, [query, overrides]);

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-[rgba(0,0,0,0.55)]" onClick={onClose}>
      <div
        className="flex w-[min(560px,calc(100vw_-_2rem))] max-h-[calc(100dvh_-_4rem)] flex-col overflow-hidden rounded-ui border border-accent bg-panel-bg shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
        data-testid="keybind-help"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-b-overlay-0 px-4 pt-[0.85rem] pb-3">
          <h2 className="m-0 text-[1rem] font-semibold text-fg">Keybindings</h2>
          <button
            type="button"
            className="cursor-pointer rounded-ui bg-transparent px-[0.35rem] py-[0.2rem] text-[1rem] leading-none text-subtext-0 [transition:color_0.12s_ease,background_0.12s_ease] [border:none] hover:bg-surface-1 hover:text-fg"
            aria-label="Close keybind help"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <input
          type="text"
          className="shrink-0 bg-surface-1 px-4 py-[0.6rem] [font-family:inherit] text-[0.85rem] text-fg [border-style:none_none_solid] border-current border-b border-b-overlay-0 [outline:none]"
          data-testid="keybind-help-search"
          placeholder="Search keybindings…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        <div className="flex-1 overflow-y-auto py-2">
          {grouped.length === 0 && <div className="p-4 text-center text-[0.82rem] text-subtext-0">No matching keybindings</div>}
          {grouped.map(({ group, entries }) => (
            <section key={group} className="px-4 py-2">
              <h3 className="mx-0 mt-0 mb-[0.4rem] text-[0.78rem] font-semibold tracking-[0.04em] text-subtext-0 uppercase">{GROUP_LABELS[group]}</h3>
              <ul className="m-0 list-none p-0">
                {entries.map((entry) => (
                  <li key={`${group}-${entry.keys}`} className="flex items-center gap-3 py-[0.3rem]">
                    <kbd className="min-w-36 shrink-0 rounded-ui border border-overlay-0 bg-surface-1 px-[0.45rem] py-[0.1rem] text-center [font-family:ui-monospace,SFMono-Regular,Menlo,monospace] text-[0.72rem] text-accent">{entry.keys}</kbd>
                    <span className="text-[0.8rem] text-fg">{entry.description}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

/**
 * KeybindHelp.tsx — Phase 4 (Keybindings + Navigator) searchable modal
 * listing every binding from `../keybinds.ts`'s `KEYBINDS` table, grouped by
 * `KeybindGroup` (global / navigation / sessions / panes). Opened via plain
 * `?` (outside inputs) or the leader chord `Ctrl+Space, ?`.
 *
 * Portal-rendered into `document.body`, same structural pattern as
 * `Navigator.tsx` (backdrop + centered panel).
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { KEYBINDS, type KeybindGroup } from "../keybinds";

export interface KeybindHelpProps {
  open: boolean;
  onClose: () => void;
}

const GROUP_LABELS: Record<KeybindGroup, string> = {
  global: "Global",
  navigation: "Navigation",
  sessions: "Sessions",
  panes: "Panes",
};

const GROUP_ORDER: KeybindGroup[] = ["global", "navigation", "sessions", "panes"];

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

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = KEYBINDS.filter(
      (k) => !q || k.keys.toLowerCase().includes(q) || k.description.toLowerCase().includes(q),
    );
    return GROUP_ORDER.map((group) => ({
      group,
      entries: filtered.filter((k) => k.group === group),
    })).filter((g) => g.entries.length > 0);
  }, [query]);

  if (!open) return null;

  const modal = (
    <div className="keybind-help__backdrop" onClick={onClose}>
      <div
        className="keybind-help"
        data-testid="keybind-help"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="keybind-help__header">
          <h2 className="keybind-help__title">Keybindings</h2>
          <button
            type="button"
            className="keybind-help__close"
            aria-label="Close keybind help"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <input
          type="text"
          className="keybind-help__search"
          data-testid="keybind-help-search"
          placeholder="Search keybindings…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        <div className="keybind-help__body">
          {grouped.length === 0 && <div className="keybind-help__empty">No matching keybindings</div>}
          {grouped.map(({ group, entries }) => (
            <section key={group} className="keybind-help__group">
              <h3 className="keybind-help__group-title">{GROUP_LABELS[group]}</h3>
              <ul className="keybind-help__list">
                {entries.map((entry) => (
                  <li key={`${group}-${entry.keys}`} className="keybind-help__row">
                    <kbd className="keybind-help__keys">{entry.keys}</kbd>
                    <span className="keybind-help__desc">{entry.description}</span>
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

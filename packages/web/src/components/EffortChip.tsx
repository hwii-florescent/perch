import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePerchStore, EFFORT_OPTIONS } from "../store";
import { computeAnchoredPopoverStyle } from "./popoverPosition";

/**
 * EffortChip — compact pill selecting the reasoning-effort level applied to
 * every turn of the current session, sitting next to the ModelChip in the
 * Hosted composer (and, like it, rendered only in Hosted mode — CLI mode gets
 * no perch chrome at all).
 *
 * The option list is per-agent (claude has `max`, codex doesn't) and comes
 * from `EFFORT_OPTIONS`. `"default"` is a client-side sentinel: picking it
 * means `chat.send` carries no `effort` field and the CLI applies its own
 * default. The selection is per-session client state (`effortBySession`) —
 * nothing about effort is persisted server-side.
 *
 * data-testid="effort-chip" on the pill, "effort-option-<value>" on each row.
 */
export function EffortChip() {
  const agent = usePerchStore((s) => s.agent);
  const sessionId = usePerchStore((s) => s.sessionId);
  const effortBySession = usePerchStore((s) => s.effortBySession);
  const setEffort = usePerchStore((s) => s.setEffort);

  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const pillRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const current = (sessionId ? effortBySession[sessionId] : undefined) ?? "default";
  const options = EFFORT_OPTIONS[agent];

  // Click-outside and Escape to close (same contract as ModelChip).
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const inPill = pillRef.current?.contains(target) ?? false;
      const inPopover = popoverRef.current?.contains(target) ?? false;
      if (!inPill && !inPopover) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handlePillClick() {
    if (open) {
      setOpen(false);
      return;
    }
    if (pillRef.current) {
      setPopoverStyle(computeAnchoredPopoverStyle(pillRef.current, { minWidth: 150 }));
    }
    setOpen(true);
  }

  const popover = open ? (
    <div className="model-chip__popover" ref={popoverRef} style={popoverStyle}>
      <div className="model-chip__models">
        {options.map((value) => (
          <button
            key={value}
            type="button"
            className={
              "model-chip__model-btn" +
              (value === current ? " model-chip__model-btn--active" : "")
            }
            data-testid={`effort-option-${value}`}
            onClick={() => {
              if (sessionId) setEffort(sessionId, value);
              setOpen(false);
            }}
          >
            {value === current && <span className="model-chip__check">✓</span>}
            {value}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="model-chip effort-chip">
      <button
        type="button"
        className={
          "model-chip__pill" + (current !== "default" ? " model-chip__pill--set" : "")
        }
        data-testid="effort-chip"
        ref={pillRef}
        onClick={handlePillClick}
        disabled={!sessionId}
        title={`Reasoning effort · ${current}`}
      >
        effort: {current} ▾
      </button>
      {popover !== null && createPortal(popover, document.body)}
    </div>
  );
}

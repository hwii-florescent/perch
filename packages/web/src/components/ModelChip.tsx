import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePerchStore } from "../store";
import { AGENTS } from "../models";
import { computeAnchoredPopoverStyle, useDismissOnOutsideClick } from "./popoverPosition";
import type { AgentKind } from "@perch/shared";

/** Format helper: get agent display label */
function agentLabel(agentId: AgentKind): string {
  return AGENTS.find((a) => a.id === agentId)?.label ?? agentId;
}

/** Compute fixed popover style from the pill's bounding rect. */
function computePopoverStyle(pill: HTMLButtonElement): React.CSSProperties {
  return computeAnchoredPopoverStyle(pill, { minWidth: 220, align: "right" });
}

/**
 * ModelChip — compact pill showing the current agent · model selection.
 * Clicking opens a popover with agent tabs and model rows.
 * Only rendered in "hosted" mode (caller is responsible for the guard).
 *
 * The popover is rendered via a React portal into document.body and uses
 * position:fixed so it escapes any overflow:hidden ancestor in the input row.
 *
 * data-testid="model-chip" on the pill button.
 * data-testid="agent-option-<id>" on each agent button.
 * data-testid="model-option-<id>" on each model button.
 */
export function ModelChip() {
  const agent = usePerchStore((s) => s.agent);
  const model = usePerchStore((s) => s.model);
  const availableModels = usePerchStore((s) => s.availableModels);
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const hostModels = usePerchStore((s) => s.hostModels);
  const setAgent = usePerchStore((s) => s.setAgent);
  const setModel = usePerchStore((s) => s.setModel);

  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const pillRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Click-outside and Escape to close
  useDismissOnOutsideClick(open, setOpen, pillRef, popoverRef);

  function handlePillClick() {
    if (open) {
      setOpen(false);
      return;
    }
    // Compute position at click time — pill is fully laid out at this point.
    if (pillRef.current) {
      setPopoverStyle(computePopoverStyle(pillRef.current));
    }
    setOpen(true);
  }

  // Prefer hostModels[activeHostId] when available; fall back to the
  // server.info-derived availableModels (which covers the local host and the
  // initial connection before any host.info arrives).
  const hostModelEntry = hostModels[activeHostId];
  const currentModels =
    (hostModelEntry ? hostModelEntry[agent] : undefined) ??
    availableModels[agent] ??
    [];
  const currentModelLabel =
    currentModels.find((m) => m.id === model)?.label ?? model ?? "—";

  const popover = open ? (
    <div
      className="model-chip__popover"
      ref={popoverRef}
      style={popoverStyle}
    >
      {/* Agent row */}
      <div className="model-chip__agents">
        {AGENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={
              "model-chip__agent-btn" +
              (a.id === agent ? " model-chip__agent-btn--active" : "")
            }
            data-testid={`agent-option-${a.id}`}
            onClick={() => setAgent(a.id as AgentKind)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Model list for selected agent */}
      <div className="model-chip__models">
        {currentModels.map((m) => (
          <button
            key={m.id}
            type="button"
            className={
              "model-chip__model-btn" +
              (m.id === model ? " model-chip__model-btn--active" : "")
            }
            data-testid={`model-option-${m.id}`}
            onClick={() => {
              setModel(m.id);
              setOpen(false);
            }}
          >
            {m.id === model && <span className="model-chip__check">✓</span>}
            {m.label}
          </button>
        ))}
        {currentModels.length === 0 && (
          <div className="model-chip__empty">No models available</div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="model-chip">
      <button
        type="button"
        className="model-chip__pill"
        data-testid="model-chip"
        ref={pillRef}
        onClick={handlePillClick}
        title={`${agentLabel(agent)} · ${currentModelLabel}`}
      >
        {agentLabel(agent)} · {currentModelLabel} ▾
      </button>

      {/* Render popover into document.body so it escapes overflow:hidden ancestors */}
      {popover !== null && createPortal(popover, document.body)}
    </div>
  );
}

import { useRef } from "react";

const STEP = 16;

/**
 * A vertical drag handle between two columns. `edge="left"` sits on the
 * panel's right edge (dragging right grows it: the sidebar); `edge="right"`
 * sits on the panel's left edge (dragging left grows it: the drawer).
 * `onChange` fires live while dragging; `onCommit` once when it settles.
 */
export function ResizeHandle({ value, min, max, defaultValue, edge, onChange, onCommit, label, testId }: {
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  edge: "left" | "right";
  onChange: (px: number) => void;
  onCommit: (px: number) => void;
  label: string;
  testId: string;
}) {
  const drag = useRef<{ x: number; start: number; last: number; prevCursor: string; prevSelect: string } | null>(null);
  const sign = edge === "left" ? 1 : -1;
  const clamp = (px: number) => Math.min(max, Math.max(min, Math.round(px)));

  const end = (commit: boolean) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    document.body.style.cursor = d.prevCursor;
    document.body.style.userSelect = d.prevSelect;
    if (commit) onCommit(d.last);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      data-testid={testId}
      className="resize-handle"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = {
          x: e.clientX,
          start: value,
          last: value,
          prevCursor: document.body.style.cursor,
          prevSelect: document.body.style.userSelect,
        };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        d.last = clamp(d.start + sign * (e.clientX - d.x));
        onChange(d.last);
      }}
      onPointerUp={() => end(true)}
      onPointerCancel={() => end(true)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const next = clamp(value + sign * dir * STEP);
        onChange(next);
        onCommit(next);
      }}
      onDoubleClick={() => {
        const next = clamp(defaultValue);
        onChange(next);
        onCommit(next);
      }}
    />
  );
}

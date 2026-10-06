/**
 * Trackpad distance → TUI mouse reports, following Orca's wheel replay approach.
 * xterm dampens small pixel deltas to 30% and sends at most one report per
 * event. Replay whole rows as line-mode events instead, leaving xterm to encode
 * the active mouse protocol, coordinates and modifiers. Ordinary scrollback and
 * notched mouse wheels keep their native handling; no global speed multiplier.
 */
import type { Terminal } from "@xterm/xterm";

type WheelTerminal = Pick<Terminal,
  "attachCustomWheelEventHandler" | "element" | "rows" | "modes" | "options" | "onWriteParsed"
>;

export function attachTerminalTuiWheel(term: WheelTerminal): () => void {
  const replays = new WeakSet<WheelEvent>();
  let pendingRows = 0;
  let direction = 0;
  let pendingReports = 0;
  let pendingEvent: WheelEvent | null = null;
  let pendingTarget: EventTarget | null = null;
  let scheduled = false;
  let disposed = false;
  const active = () => !disposed && !term.options.disableStdin
    && term.modes.mouseTrackingMode !== "none" && term.modes.mouseTrackingMode !== "x10";
  const reset = () => {
    pendingRows = pendingReports = direction = 0;
    pendingEvent = null;
    pendingTarget = null;
  };
  const parsed = term.onWriteParsed(() => { if (!active()) reset(); });

  term.attachCustomWheelEventHandler((event) => {
    if (replays.has(event)) return true;
    // Orca distinguishes notched mice using the legacy wheel delta. Large
    // pixel deltas alone are also produced by fast trackpad gestures.
    const legacy = event as WheelEvent & { wheelDeltaY?: number; wheelDelta?: number };
    const legacyDelta = legacy.wheelDeltaY ?? legacy.wheelDelta ?? 0;
    if (!active() || event.shiftKey || event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL
      || Math.abs(legacyDelta) >= 100 || event.deltaY === 0 || !Number.isFinite(event.deltaY)) {
      reset();
      return true;
    }
    const screen = term.element?.querySelector<HTMLElement>(".xterm-screen");
    const cellHeight = (screen?.getBoundingClientRect().height ?? 0) / term.rows;
    const target = event.currentTarget ?? term.element;
    if (!Number.isFinite(cellHeight) || cellHeight <= 0 || !target) {
      reset();
      return true;
    }
    const nextDirection = Math.sign(event.deltaY);
    if (direction !== nextDirection) reset();
    direction = nextDirection;
    pendingRows += Math.abs(event.deltaY) / cellHeight;
    const reports = Math.trunc(pendingRows);
    pendingRows -= reports;
    pendingReports += reports;
    pendingEvent = event;
    pendingTarget = target;
    event.preventDefault();
    event.stopPropagation();

    if (reports > 0 && !scheduled) {
      scheduled = true;
      // Drain after xterm's original handler, not once per animation frame:
      // inertial trackpad scrolling must reach the PTY during the gesture.
      queueMicrotask(() => {
        scheduled = false;
        const source = pendingEvent;
        const target = pendingTarget;
        const reports = pendingReports;
        pendingReports = 0;
        pendingEvent = null;
        pendingTarget = null;
        if (!active() || !source || !target) { reset(); return; }
        for (let i = 0; i < reports; i++) {
          const replay = new WheelEvent(source.type, {
            bubbles: source.bubbles, cancelable: source.cancelable, composed: source.composed,
            view: source.view, clientX: source.clientX, clientY: source.clientY,
            screenX: source.screenX, screenY: source.screenY,
            ctrlKey: source.ctrlKey, altKey: source.altKey,
            shiftKey: source.shiftKey, metaKey: source.metaKey,
            deltaX: 0, deltaY: direction, deltaMode: WheelEvent.DOM_DELTA_LINE,
          });
          replays.add(replay);
          target.dispatchEvent(replay);
        }
      });
    }
    return false;
  });
  return () => { disposed = true; reset(); parsed.dispose(); };
}

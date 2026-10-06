/**
 * Wheel input → TUI mouse reports, ported from Orca's
 * `pane-terminal-tui-wheel-reports.ts` / `pane-terminal-mouse-wheel.ts` (MIT).
 * xterm dampens small pixel deltas to 30% and sends at most one report per
 * event. Instead we work out how many whole rows a gesture covers and replay
 * that many line-mode events, leaving xterm to encode the active mouse
 * protocol, coordinates and modifiers.
 *
 * - Trackpad (pixel deltas, no notched legacy delta): 1 report per row of
 *   distance, the fractional remainder carried. No cap.
 * - Notched mouse wheel, line and page deltas: distance is log-compressed (so a
 *   big notch doesn't fly) and a fast burst of notches ramps up a bonus, up to
 *   9 rows per event. A single notch always moves at least one row.
 *
 * Ordinary scrollback (no mouse reporting) keeps xterm's native handling.
 */
import type { Terminal } from "@xterm/xterm";

type WheelTerminal = Pick<Terminal,
  "attachCustomWheelEventHandler" | "element" | "rows" | "modes" | "options" | "onWriteParsed"
>;

const DEFAULT_CELL_HEIGHT = 16;
const LEGACY_WHEEL_DELTA_MIN = 100; // a notched mouse reports ±120 per notch
const LEGACY_WHEEL_DELTA_UNIT = 120;
const DISCRETE_PIXEL_DELTA_MIN = 50;
const ACCELERATED_DISTANCE_GAIN = 1.6;
const BURST_FULL_INTERVAL_MS = 16;
const BURST_MAX_INTERVAL_MS = 45;
const BURST_MAX_BONUS_ROWS = 3;
const BURST_RAMP_EVENTS = 4;
const MOMENTUM_TAIL_DECAY_RATIO = 0.85;
const COMPRESSED_MAX_ROWS_PER_EVENT = 6;
const BURST_MAX_ROWS_PER_EVENT = 9;

interface DistanceState {
  fastStreak: number;
  lastDistanceRows: number | null;
  lastInputAt: number | null;
  pendingRows: number;
}

const newDistanceState = (): DistanceState =>
  ({ fastStreak: 0, lastDistanceRows: null, lastInputAt: null, pendingRows: 0 });

function legacyDelta(event: WheelEvent): number | null {
  const legacy = event as WheelEvent & { wheelDeltaY?: number; wheelDelta?: number };
  for (const value of [legacy.wheelDeltaY, legacy.wheelDelta]) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function hasNotchedLegacyDelta(event: WheelEvent): boolean {
  const delta = legacyDelta(event);
  return delta !== null && Math.abs(delta) >= LEGACY_WHEEL_DELTA_MIN;
}

/** Whole rows' worth of distance one event covers (fractional for trackpads). */
function distanceRows(event: WheelEvent, cellHeight: number, rows: number): number {
  const deltaY = Math.abs(event.deltaY);
  let fromDelta = deltaY / cellHeight;
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) fromDelta = deltaY;
  else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) fromDelta = deltaY * Math.max(1, rows);
  const legacy = legacyDelta(event);
  const total = Math.max(fromDelta, legacy === null ? 0 : Math.abs(legacy) / LEGACY_WHEEL_DELTA_UNIT);
  const discrete = event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL
    || deltaY >= DISCRETE_PIXEL_DELTA_MIN || hasNotchedLegacyDelta(event);
  return discrete ? Math.max(1, total) : total;
}

function compress(rows: number): number {
  if (rows <= 1) return rows;
  return Math.min(COMPRESSED_MAX_ROWS_PER_EVENT, 1 + Math.log2(rows) * ACCELERATED_DISTANCE_GAIN);
}

/** Extra rows for a fast run of notches; zero for the first notch, a pause, or a momentum tail. */
function burstRows(event: WheelEvent, state: DistanceState, rows: number): number {
  const stop = (): number => {
    state.fastStreak = 0;
    state.lastDistanceRows = null;
    state.lastInputAt = null;
    return 0;
  };
  if (event.deltaMode === WheelEvent.DOM_DELTA_PIXEL && !hasNotchedLegacyDelta(event)) return stop();
  const now = event.timeStamp;
  if (!Number.isFinite(now)) return stop();
  const elapsed = state.lastInputAt === null ? null : now - state.lastInputAt;
  const momentumTail = state.lastDistanceRows !== null && rows < state.lastDistanceRows * MOMENTUM_TAIL_DECAY_RATIO;
  state.lastDistanceRows = rows;
  state.lastInputAt = now;
  if (momentumTail || elapsed === null || elapsed < 0 || elapsed > BURST_MAX_INTERVAL_MS) {
    state.fastStreak = 0;
    return 0;
  }
  const cadence = elapsed <= BURST_FULL_INTERVAL_MS ? 1
    : (BURST_MAX_INTERVAL_MS - elapsed) / (BURST_MAX_INTERVAL_MS - BURST_FULL_INTERVAL_MS);
  state.fastStreak = Math.min(BURST_RAMP_EVENTS, state.fastStreak + 1);
  return BURST_MAX_BONUS_ROWS * cadence * (state.fastStreak / BURST_RAMP_EVENTS);
}

/** Whole reports this event adds; the fractional remainder stays in `state`. */
function reportCount(event: WheelEvent, state: DistanceState, cellHeight: number, termRows: number): number {
  const distance = distanceRows(event, cellHeight, termRows);
  const trackpad = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL && !hasNotchedLegacyDelta(event);
  const rows = trackpad ? distance
    : Math.min(BURST_MAX_ROWS_PER_EVENT, compress(distance) + burstRows(event, state, distance));
  const total = state.pendingRows + rows;
  const reports = Math.trunc(total);
  state.pendingRows = total - reports;
  return reports;
}

export function attachTerminalTuiWheel(term: WheelTerminal): () => void {
  const replays = new WeakSet<WheelEvent>();
  let state = newDistanceState();
  let direction = 0;
  let pendingReports = 0;
  let pendingEvent: WheelEvent | null = null;
  let pendingTarget: EventTarget | null = null;
  let scheduled = false;
  let disposed = false;
  const active = () => !disposed && !term.options.disableStdin
    && term.modes.mouseTrackingMode !== "none" && term.modes.mouseTrackingMode !== "x10";
  const reset = () => {
    state = newDistanceState();
    pendingReports = direction = 0;
    pendingEvent = null;
    pendingTarget = null;
  };
  const parsed = term.onWriteParsed(() => { if (!active()) reset(); });

  term.attachCustomWheelEventHandler((event) => {
    if (replays.has(event)) return true;
    if (!active() || event.shiftKey || event.deltaY === 0 || !Number.isFinite(event.deltaY)) {
      reset();
      return true;
    }
    const screen = term.element?.querySelector<HTMLElement>(".xterm-screen");
    const measured = (screen?.getBoundingClientRect().height ?? 0) / term.rows;
    const cellHeight = Number.isFinite(measured) && measured > 0 ? measured : DEFAULT_CELL_HEIGHT;
    const target = event.currentTarget ?? term.element;
    if (!target) {
      reset();
      return true;
    }
    const nextDirection = Math.sign(event.deltaY);
    if (direction !== nextDirection) reset();
    direction = nextDirection;
    const reports = reportCount(event, state, cellHeight, term.rows);
    pendingReports += reports;
    pendingEvent = event;
    pendingTarget = target;
    event.preventDefault();
    event.stopPropagation();

    if (reports > 0 && !scheduled) {
      scheduled = true;
      // Drain after xterm's original handler, not once per animation frame:
      // the whole gesture distance must reach the PTY while it happens.
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

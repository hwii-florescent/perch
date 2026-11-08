/** Slots: places where Perch's own interface lets a mod draw instead. A stock component wraps what
 * it draws in `<Slot name=...>` (`components/Slot.tsx`) and hands over plain `data` and `actions`;
 * when a mod has claimed that slot (`api.slot`) the mod draws it, and otherwise (or if the mod
 * throws) the stock component shows. The component keeps its state, keys and timers, so a mod
 * restyles or rebuilds what a row or card looks like without owning how it behaves. */
export const SLOTS = {
  toast: "One notification card. data: {id, kind: 'done'|'blocked'|'usage', title, body?, sessionId, sessionTitle?}. actions: open() (go to the session), dismiss().",
  "session-row": "One session in the sidebar. data: {id, title, status: 'running'|'idle', blocked?, unseen?, createdAt, cwd, branch?, active}. actions: open(), remove().",
  "project-row": "A project's header in the sidebar (its worktree, review and close buttons stay). data: {cwd, name, state, sessionCount, active, hostId}. actions: open(), closeAll().",
  tab: "One session tab in the tab bar (its close button stays). data: {id, title, label, state: 'focused'|'visible'|'hidden', provider?, blocked?, unseen?}. actions: open(), rename(), menu(x, y).",
  "status-bar": "The whole status bar. data: {online, host, cwd, branch?, sessionId?, contextTokens?, costUsd?, zoom}. actions: resetZoom().",
  "terminal-menu": "The menu that opens on a right-click over selected terminal text. data: {x, y, workspaceId, sessionId?, selection?}. actions: ask() (ask an agent about it), close().",
  "pane-header": "The header row of a tiled pane in the canvas (its expand and close buttons stay). data: {id, title, label, state: 'working'|'idle'|'blocked'|'done'|'unknown', provider?, focused}. actions: open(), menu(x, y).",
  confirm: "The confirmation dialog's panel (the backdrop, Enter and Esc stay). data: {message, confirmLabel, cancelLabel, busy}. actions: confirm(), cancel().",
} as const;
export type SlotName = keyof typeof SLOTS;

/** What a mod's slot function receives. `data` is JSON-able and replaces itself on every change; call
 * `actions` for anything that should happen. */
export interface SlotProps {
  data: Record<string, unknown>;
  actions: Record<string, (...args: unknown[]) => void>;
}
/** Draws into `el`; called again (after its cleanup) whenever `data` changes. */
export type SlotRender = (el: HTMLElement, props: SlotProps) => void | (() => void);

let slotError: (modId: string, message: string) => void = () => {};
/** Where a slot function's failure goes (`mods.ts` reports it, so `perch mod check` sees it). */
export const setSlotErrorReporter = (report: typeof slotError) => { slotError = report; };
export const reportSlotError = (modId: string, message: string) => slotError(modId, message);

const claimed = new Map<string, { modId: string; render: SlotRender }>();
const watchers = new Set<() => void>();
const changed = () => watchers.forEach((watch) => watch());

export const subscribeSlots = (watch: () => void) => (watchers.add(watch), () => void watchers.delete(watch));
export const slotFor = (name: string) => claimed.get(name);

/** A mod takes a slot (the latest claim wins). Returns the release, which does nothing if a newer
 * claim has since replaced this one. */
export function claimSlot(name: string, modId: string, render: SlotRender): () => void {
  if (!Object.hasOwn(SLOTS, name)) throw new Error(`No slot "${name}". Slots: ${Object.keys(SLOTS).join(", ")}.`);
  const mine = { modId, render };
  claimed.set(name, mine);
  changed();
  return () => {
    if (claimed.get(name) !== mine) return;
    claimed.delete(name);
    changed();
  };
}

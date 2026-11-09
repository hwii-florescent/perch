/** The floating surfaces a mod can open (herdr's dialog, popup and window overlays), as plain DOM.
 * Each is tracked in the mod's `open` set, so replacing the mod closes them. */
type Draw = (el: HTMLElement, close: () => void) => void | (() => void);
const PANEL = "border-radius:8px;background:var(--panel-bg,#1e1e1e);color:var(--text,#ddd);box-shadow:0 8px 30px rgba(0,0,0,.45);";

/** The dialogs and popups open now, oldest first: Esc, and the `overlay.close` command, close the top one. */
const closable: (() => void)[] = [];
/** Closes the top dialog or popup; false when none is open. */
export const closeTopOverlay = (): boolean => {
  const top = closable[closable.length - 1];
  top?.();
  return !!top;
};

/** Mounts `root` on the page and wires closing; shared by all three surfaces. */
function surface(open: Set<() => void>, root: HTMLElement, draw: Draw, into: HTMLElement, closers: { escape: boolean; outside?: boolean }) {
  let cleanup: void | (() => void);
  const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
  const onDown = (event: MouseEvent) => { if (!root.contains(event.target as Node)) close(); };
  function close() {
    if (!open.delete(close)) return;
    const at = closable.indexOf(close);
    if (at >= 0) closable.splice(at, 1);
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("mousedown", onDown, true);
    root.remove();
    cleanup?.();
  }
  if (closers.escape) document.addEventListener("keydown", onKey);
  if (closers.outside) document.addEventListener("mousedown", onDown, true);
  document.body.append(root);
  open.add(close);
  if (closers.escape) closable.push(close);
  try { cleanup = draw(into, close); } catch (error) { close(); throw error; }
  return close;
}

export function modUi(modId: string, open: Set<() => void>) {
  return {
    /** A modal: Esc or a click outside closes it. */
    overlay(draw: Draw) {
      const shade = document.createElement("div");
      shade.setAttribute("role", "dialog");
      shade.setAttribute("aria-modal", "true");
      shade.setAttribute("data-testid", `mod-api-overlay-${modId}`);
      shade.style.cssText = "position:fixed;inset:0;z-index:2100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55)";
      const panel = document.createElement("div");
      panel.style.cssText = `${PANEL}max-width:56rem;max-height:90vh;overflow:auto;padding:12px;`;
      shade.append(panel);
      shade.addEventListener("mousedown", (event) => { if (event.target === shade) close(); });
      const close = surface(open, shade, draw, panel, { escape: true });
      return close;
    },

    /** A small panel next to `anchor` (an element, or a point `{x, y}`), kept on screen; Esc or a
     * click anywhere else closes it. */
    popup(anchor: HTMLElement | { x: number; y: number }, draw: Draw) {
      const box = document.createElement("div");
      box.setAttribute("data-testid", `mod-api-popup-${modId}`);
      box.style.cssText = `${PANEL}position:fixed;z-index:2150;max-width:min(32rem,95vw);max-height:80vh;overflow:auto;padding:6px;visibility:hidden;`;
      const close = surface(open, box, draw, box, { escape: true, outside: true });
      const at = anchor instanceof HTMLElement ? (({ left, bottom }) => ({ x: left, y: bottom + 4 }))(anchor.getBoundingClientRect()) : anchor;
      const { width, height } = box.getBoundingClientRect();
      box.style.left = `${Math.max(4, Math.min(at.x, window.innerWidth - width - 4))}px`;
      box.style.top = `${Math.max(4, Math.min(at.y, window.innerHeight - height - 4))}px`;
      box.style.visibility = "visible";
      return close;
    },

    /** A window that stays until closed, over the app and under modals: drag it by its title bar, and
     * the one pressed last is on top. A `key` remembers where it was put, and opening the same key
     * again replaces the old one. `frame: "none"` drops the border, shadow and title bar: the mod
     * draws its own, and a press it does not stop (`stopPropagation`) drags the window. */
    window(options: { key?: string; title?: string; width?: number; height?: number; at?: { x: number; y: number }; frame?: "none" }, draw: Draw) {
      const name = options.key && `${modId}:${options.key}`;
      if (name) windows.get(name)?.close();
      const box = document.createElement("div");
      box.setAttribute("data-testid", `mod-api-window-${modId}`);
      const place = (name && spots.get(name)) || options.at || { x: 80 + (zTop % 7) * 24, y: 80 + (zTop % 7) * 24 };
      const bare = options.frame === "none";
      box.style.cssText = `${bare ? "" : PANEL}position:fixed;z-index:${++zTop};left:${place.x}px;top:${place.y}px;width:${options.width ?? 360}px;height:${options.height ?? 240}px;display:flex;flex-direction:column;overflow:hidden;`;
      const bar = bare ? box : document.createElement("div");
      const body = bare ? box : document.createElement("div");
      if (!bare) {
        bar.textContent = options.title ?? "";
        bar.style.cssText = "flex:none;padding:4px 8px;cursor:move;font-size:12px;opacity:.8;user-select:none;background:rgba(255,255,255,.06)";
        body.style.cssText = "flex:1;min-height:0;overflow:auto;padding:8px";
        box.append(bar, body);
      }
      box.addEventListener("mousedown", () => { box.style.zIndex = String(++zTop); }, true);
      bar.addEventListener("mousedown", (down) => {
        const from = { x: down.clientX - box.offsetLeft, y: down.clientY - box.offsetTop };
        const move = (event: MouseEvent) => {
          box.style.left = `${event.clientX - from.x}px`;
          box.style.top = `${Math.max(0, event.clientY - from.y)}px`;
        };
        const stop = () => {
          document.removeEventListener("mousemove", move);
          document.removeEventListener("mouseup", stop);
          if (name) spots.set(name, { x: box.offsetLeft, y: box.offsetTop });
        };
        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", stop);
      });
      const close = surface(open, box, draw, body, { escape: false });
      const entry = { close: () => { open.delete(entry.close); if (name && windows.get(name) === entry) windows.delete(name); close(); } };
      if (name) windows.set(name, entry);
      open.add(entry.close); // the mod being replaced closes it, and closing by this handle forgets the key too
      return entry.close;
    },
  };
}

// Where a keyed window was last put, and the open ones, for the page's lifetime.
const spots = new Map<string, { x: number; y: number }>();
const windows = new Map<string, { close: () => void }>();
let zTop = 2050;

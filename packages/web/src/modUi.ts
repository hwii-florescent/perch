import type { LayoutNode } from "@perch/shared";

/** The floating surfaces a mod can open (herdr's dialog, popup and window overlays), as plain DOM or as layout
 * content. Each is tracked in the mod's `open` set, so replacing the mod closes them. */
type Draw = (el: HTMLElement, close: () => void) => void | (() => void);
/** Layout content instead of drawing: the window layout's nodes (`mod:<id>` blocks with `props`, `terminal:<id>`,
 * `session:<id>`, `agent:focused`, rows, columns, stacks), so a live terminal can sit beside the mod's own view. A
 * terminal already on screen is borrowed (moved in, and back on close); the surface never stops or resizes a process
 * beyond drawing it where it is. `width`/`height` (px) size an overlay's or popup's content. */
export interface SurfaceLayout { layout: unknown; width?: number; height?: number }
type Content = Draw | SurfaceLayout;

// The core's `plain_id` (mods.rs): ASCII letters, digits, `-` and `_`, at most 64.
const BLOCK = /^(?:sidebar|tabs|canvas|files|git|status|agent:focused|mod:(?:stock:)?[A-Za-z0-9_-]{1,64}|(?:terminal|session):[A-Za-z0-9_-]{1,64})$/;
const MAX_DEPTH = 8;
const MAX_CHILDREN = 20;
const num = (value: unknown, min: number, max: number) => (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : undefined);

/**
 * A mod's layout content, checked here because a mod is not the core's layout loader. Only the fields that place and
 * name things are kept (type, id, title, content, props, children, active, header, size, gap, hidden): no look, no
 * float and no background, so a surface cannot restyle the app or fetch anything. Throws on anything else.
 */
export function surfaceLayout(value: unknown, depth = 0): LayoutNode {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("layout is a node object: {type, ...}.");
  if (depth > MAX_DEPTH) throw new Error(`layout is nested deeper than ${MAX_DEPTH}.`);
  const node = value as Record<string, unknown>;
  const str = (key: string) => (typeof node[key] === "string" && (node[key] as string).length <= 200 ? node[key] as string : undefined);
  const base = {
    ...(str("id") !== undefined ? { id: str("id") } : {}),
    ...(str("title") !== undefined ? { title: str("title") } : {}),
    ...(node.hidden === true ? { hidden: true } : {}),
  };
  const size = node.size && typeof node.size === "object" ? node.size as Record<string, unknown> : {};
  const sized = { size: { px: num(size.px, 0, 10_000), weight: num(size.weight, 0, 100), min: num(size.min, 0, 10_000), max: num(size.max, 0, 10_000) } };
  if (node.type === "block") {
    const content = str("content");
    if (!content || !BLOCK.test(content)) throw new Error(`block content "${String(node.content)}" is not one of sidebar, tabs, canvas, files, git, status, mod:<id>, terminal:<session id>, session:<session id> or agent:focused.`);
    const props = node.props;
    if (props !== undefined && (!props || typeof props !== "object" || Array.isArray(props) || JSON.stringify(props).length > 4096)) throw new Error("block props are an object of at most 4 KiB.");
    return { type: "block", ...base, ...sized, content, ...(props ? { props: props as Record<string, unknown> } : {}) };
  }
  if (node.type !== "row" && node.type !== "column" && node.type !== "stack") throw new Error(`layout node type "${String(node.type)}" is not row, column, stack or block.`);
  if (!Array.isArray(node.children) || !node.children.length || node.children.length > MAX_CHILDREN) throw new Error(`a ${node.type} needs 1 to ${MAX_CHILDREN} children.`);
  const children = node.children.map((child) => surfaceLayout(child, depth + 1));
  if (node.type === "stack") {
    const header = str("header");
    return { type: "stack", ...base, ...sized, children, ...(str("active") ? { active: str("active") } : {}), ...(header === "tabs" ? { header } : {}) };
  }
  return { type: node.type, ...base, ...sized, children, ...(num(node.gap, 0, 64) !== undefined ? { gap: num(node.gap, 0, 64) } : {}) };
}

let surfaceSeq = 0;
/** A draw that mounts checked layout content (`LayoutContent`, loaded on first use: it pulls in the React views). */
function layoutDraw(modId: string, content: SurfaceLayout, sizeIt: boolean): Draw {
  const node = surfaceLayout(content.layout);
  const scope = `surface:${modId}:${++surfaceSeq}`;
  return (el) => {
    el.style.display = "flex";
    el.style.minHeight = "0";
    if (sizeIt) {
      el.style.width = `${num(content.width, 120, 4000) ?? Math.min(900, window.innerWidth * 0.9)}px`;
      el.style.height = `${num(content.height, 80, 4000) ?? Math.round(window.innerHeight * 0.7)}px`;
      el.style.maxWidth = "95vw";
      el.style.maxHeight = "90vh";
    }
    let gone = false;
    let unmount: (() => void) | undefined;
    void import("./components/LayoutSurface").then((surface) => {
      if (!gone) unmount = surface.mountLayout(el, node, scope);
    }, (error: unknown) => {
      if (!gone) el.textContent = `This layout could not load: ${error instanceof Error ? error.message : String(error)}`;
    });
    return () => { gone = true; unmount?.(); };
  };
}
const drawOf = (modId: string, content: Content, sizeIt: boolean): Draw => (typeof content === "function" ? content : layoutDraw(modId, content, sizeIt));
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
  // Focus goes back where it was when this closes, unless the person has since put it somewhere else.
  const before = document.activeElement;
  const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
  const onDown = (event: MouseEvent) => { if (!root.contains(event.target as Node)) close(); };
  function close() {
    if (!open.delete(close)) return;
    const at = closable.indexOf(close);
    if (at >= 0) closable.splice(at, 1);
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("mousedown", onDown, true);
    const inside = root.contains(document.activeElement) || document.activeElement === document.body || !document.activeElement;
    root.remove();
    cleanup?.();
    if (inside && before instanceof HTMLElement && before !== document.body && before.isConnected) before.focus();
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
    overlay(content: Content) {
      const draw = drawOf(modId, content, true);
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
    popup(anchor: HTMLElement | { x: number; y: number }, content: Content) {
      const draw = drawOf(modId, content, true);
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

    /** A window that stays until closed, over the app and under modals: drag it by its title bar, size it by its
     * corner, and the one pressed last is on top. A `key` remembers where it was put and how big, on this device and
     * across restarts, and opening the same key again replaces the old one. `frame: "none"` drops the border, shadow
     * and title bar: the mod draws its own, and a press it does not stop (`stopPropagation`) drags the window.
     * `keep` (a key, layout content and a frame are required) keeps the window itself: it belongs to the layout shown
     * when it opened, reopens with that layout (after a restart too), closes while another layout is shown, and is not
     * closed by replacing or removing the package. Its x, or the returned close, forgets it. */
    window(options: WindowOptions, content: Content) {
      if (options.keep) {
        if (!options.key) throw new Error("a kept window needs a key.");
        if (typeof content === "function") throw new Error("a kept window shows layout content ({layout}), which can be reopened without the package.");
        if (options.frame === "none") throw new Error("a kept window has a frame: its x is how a person forgets it.");
      }
      const keptLayout = options.keep ? surfaceLayout((content as SurfaceLayout).layout) : undefined;
      const draw = drawOf(modId, content, false);
      const name = options.key && `${modId}:${options.key}`;
      if (name) windows.get(name)?.shut(false);
      const set = options.keep ? keptOpen : open;
      const box = document.createElement("div");
      box.setAttribute("data-testid", `mod-api-window-${modId}`);
      if (options.key) box.setAttribute("data-window-key", options.key);
      const saved = name ? records().get(name) : undefined;
      const fallback = options.at ?? { x: 80 + (zTop % 7) * 24, y: 80 + (zTop % 7) * 24 };
      const width = saved?.width ?? options.width ?? 360, height = saved?.height ?? options.height ?? 240;
      // A spot saved on a bigger screen is pulled back so the title bar can still be reached.
      const x = Math.max(0, Math.min(saved?.x ?? fallback.x, window.innerWidth - 60));
      const y = Math.max(0, Math.min(saved?.y ?? fallback.y, window.innerHeight - 30));
      const bare = options.frame === "none";
      box.style.cssText = `${bare ? "" : PANEL}position:fixed;z-index:${++zTop};left:${x}px;top:${y}px;width:${width}px;height:${height}px;min-width:120px;min-height:60px;resize:both;display:flex;flex-direction:column;overflow:hidden;`;
      const bar = bare ? box : document.createElement("div");
      const body = bare ? box : document.createElement("div");
      if (!bare) {
        bar.style.cssText = "flex:none;display:flex;align-items:center;gap:6px;padding:4px 8px;cursor:move;font-size:12px;user-select:none;background:rgba(255,255,255,.06)";
        const title = bar.appendChild(document.createElement("span"));
        title.textContent = options.title ?? "";
        title.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.8";
        if (options.keep) {
          const forget = bar.appendChild(document.createElement("button"));
          forget.type = "button";
          forget.textContent = "\u00d7";
          forget.setAttribute("aria-label", `Close ${options.title || "window"}`);
          forget.setAttribute("data-testid", "mod-api-window-close");
          forget.style.cssText = "flex:none;border:0;background:none;color:inherit;cursor:pointer;font-size:14px;line-height:1;padding:0 2px;opacity:.7";
          forget.addEventListener("mousedown", (event) => event.stopPropagation());
          forget.addEventListener("click", () => handle());
        }
        body.style.cssText = "flex:1;min-height:0;overflow:auto;padding:8px";
        box.append(bar, body);
      }
      const remember = () => {
        if (!name || !box.isConnected) return;
        const record = records().get(name);
        // The inline style is the truth: a drag writes left/top, and the corner (CSS resize) writes width/height.
        const px = (value: string) => Math.round(parseFloat(value));
        const now = { x: px(box.style.left), y: px(box.style.top), width: px(box.style.width), height: px(box.style.height) };
        if (!Object.values(now).every(Number.isFinite)) return;
        if (record && record.x === now.x && record.y === now.y && record.width === now.width && record.height === now.height) return;
        putRecord(name, { ...now, kept: record?.kept });
      };
      // A press anywhere raises it; letting go after a drag or a resize (the corner) remembers where it is.
      box.addEventListener("mousedown", () => {
        box.style.zIndex = String(++zTop);
        document.addEventListener("mouseup", remember, { once: true });
      }, true);
      bar.addEventListener("mousedown", (down) => {
        const from = { x: down.clientX - box.offsetLeft, y: down.clientY - box.offsetTop };
        const move = (event: MouseEvent) => {
          box.style.left = `${event.clientX - from.x}px`;
          box.style.top = `${Math.max(0, event.clientY - from.y)}px`;
        };
        const stop = () => {
          document.removeEventListener("mousemove", move);
          document.removeEventListener("mouseup", stop);
        };
        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", stop);
      });
      const close = surface(set, box, draw, body, { escape: false });
      const shut = (forget: boolean) => {
        set.delete(handle);
        if (name && windows.get(name) === entry) windows.delete(name);
        if (forget && name) unkeep(name);
        close();
      };
      /** The package's close (and the person's x): a kept window is forgotten too. */
      const handle = () => shut(true);
      const entry = { shut };
      if (name) {
        windows.set(name, entry);
        putRecord(name, {
          x, y, width, height,
          kept: keptLayout && options.key ? { owner: owner ?? "", mod: modId, key: options.key, ...(options.title ? { title: options.title } : {}), layout: keptLayout } : undefined,
        });
      }
      set.add(handle); // the mod being replaced closes an unkept one; closing by this handle forgets the key's window
      return handle;
    },
  };
}

export interface WindowOptions { key?: string; title?: string; width?: number; height?: number; at?: { x: number; y: number }; frame?: "none"; keep?: boolean }

const windows = new Map<string, { shut: (forget: boolean) => void }>();
/** Kept windows on screen: the layout's, not a package copy's, so replacing a package leaves them open. */
const keptOpen = new Set<() => void>();
const keptUis = new Map<string, ReturnType<typeof modUi>>();
let zTop = 2050;

/** A kept window: what reopens it without the package (its layout content, checked) and the layout it belongs to
 * (a layout id, "" for Perch as shipped). */
export interface KeptWindow { owner: string; mod: string; key: string; title?: string; layout: LayoutNode }
/** A keyed window's geometry in px, and the window itself when it is kept. `used` orders the records for trimming. */
export interface WindowRecord { x: number; y: number; width: number; height: number; used: number; kept?: KeptWindow }

// Keyed windows on this device: one localStorage value, written whole, so a write never leaves half a record. At most
// MAX_WINDOWS keys, the least recently used dropped first. A value this build cannot read is left exactly as it is and
// reported (`windowStoreProblem`, Settings > Mods): until it is reset, windows are remembered for this run only.
// ponytail: one value for every window; per-key values only if the record count ever needs to grow past a few dozen.
export const WINDOWS_KEY = "perch.modWindows";
const MAX_WINDOWS = 64;
let loaded: Map<string, WindowRecord> | null = null;
let problem: string | null = null;
/** The layout shown now (a layout id, "" for Perch as shipped); undefined until the app knows. */
let owner: string | undefined;

const coordinate = (value: unknown) => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 100_000;
const extent = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 20_000;
function readRecord(name: string, value: unknown): WindowRecord {
  const record = value as Record<string, unknown> | null;
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`"${name}" is not an object.`);
  if (!coordinate(record.x) || !coordinate(record.y) || !extent(record.width) || !extent(record.height) || typeof record.used !== "number" || !Number.isFinite(record.used)) throw new Error(`"${name}" has no valid x, y, width, height and used.`);
  const out: WindowRecord = { x: record.x as number, y: record.y as number, width: record.width as number, height: record.height as number, used: record.used as number };
  if (record.kept === undefined) return out;
  const kept = record.kept as Record<string, unknown> | null;
  const text = (key: string, max: number) => typeof kept?.[key] === "string" && (kept[key] as string).length <= max;
  if (!kept || typeof kept !== "object" || !text("owner", 64) || !text("mod", 80) || !text("key", 200) || (kept.title !== undefined && !text("title", 200))) throw new Error(`"${name}" has a malformed kept window.`);
  if (name !== `${kept.mod as string}:${kept.key as string}`) throw new Error(`"${name}" keeps a window under another name.`);
  let layout: LayoutNode;
  try { layout = surfaceLayout(kept.layout); } catch (error) { throw new Error(`"${name}" keeps layout content Perch refuses: ${error instanceof Error ? error.message : String(error)}`); }
  return { ...out, kept: { owner: kept.owner as string, mod: kept.mod as string, key: kept.key as string, ...(kept.title !== undefined ? { title: kept.title as string } : {}), layout } };
}

/** The records, read from storage once. */
function records(): Map<string, WindowRecord> {
  if (loaded) return loaded;
  loaded = new Map();
  let raw: string | null = null;
  try { raw = localStorage.getItem(WINDOWS_KEY); } catch { return loaded; }
  if (raw === null) return loaded;
  try {
    const value = JSON.parse(raw) as { v?: unknown; windows?: unknown };
    if (!value || value.v !== 1 || !value.windows || typeof value.windows !== "object" || Array.isArray(value.windows)) throw new Error("it is not {v: 1, windows: {...}}.");
    const entries = Object.entries(value.windows as Record<string, unknown>);
    if (entries.length > MAX_WINDOWS) throw new Error(`it holds ${entries.length} windows; the most is ${MAX_WINDOWS}.`);
    for (const [name, record] of entries) loaded.set(name, readRecord(name, record));
  } catch (error) {
    loaded = new Map();
    problem = `Saved window positions (${WINDOWS_KEY}) could not be read and were left as they are: ${error instanceof Error ? error.message : String(error)}`;
    console.warn(problem);
  }
  return loaded;
}

function persist() {
  if (problem) return;
  const all = records();
  // ponytail: sort on every write; fine at MAX_WINDOWS records.
  for (const [name] of [...all].sort((a, b) => a[1].used - b[1].used).slice(0, Math.max(0, all.size - MAX_WINDOWS))) all.delete(name);
  try { localStorage.setItem(WINDOWS_KEY, JSON.stringify({ v: 1, windows: Object.fromEntries(all) })); } catch { /* full or private: this run only */ }
}

let usedSeq = 0;
/** Saves a key's record whole; `kept` undefined means the window is not kept. */
function putRecord(name: string, next: Omit<WindowRecord, "used">) {
  usedSeq = Math.max(Date.now(), usedSeq + 1);
  const record: WindowRecord = { x: next.x, y: next.y, width: next.width, height: next.height, used: usedSeq, ...(next.kept ? { kept: next.kept } : {}) };
  records().set(name, record);
  persist();
}

function unkeep(name: string) {
  const record = records().get(name);
  if (!record?.kept) return;
  const { kept: _, ...rest } = record;
  records().set(name, rest);
  persist();
}

/** Why saved window positions could not be read, or null. */
export const windowStoreProblem = () => problem;
/** Drops saved window positions and kept windows (Settings > Mods, after a read problem). */
export function resetWindowStore() {
  try { localStorage.removeItem(WINDOWS_KEY); } catch { /* nothing to drop */ }
  problem = null;
  loaded = new Map();
}

/** Tells the kept windows which layout is shown (a layout id, "" for Perch as shipped): the previous layout's kept
 * windows close and stay kept, and the new one's reopen where they were. */
export function setWindowOwner(next: string) {
  if (next === owner) return;
  owner = next;
  const all = records();
  for (const [name, record] of all) if (record.kept && record.kept.owner !== next) windows.get(name)?.shut(false);
  for (const [name, record] of [...all]) {
    const kept = record.kept;
    if (!kept || kept.owner !== next || windows.has(name)) continue;
    let ui = keptUis.get(kept.mod);
    if (!ui) keptUis.set(kept.mod, (ui = modUi(kept.mod, keptOpen)));
    try { ui.window({ key: kept.key, title: kept.title, keep: true }, { layout: kept.layout }); } catch (error) { console.warn(`kept window ${name} did not reopen`, error); }
  }
}

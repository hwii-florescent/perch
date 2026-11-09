// @vitest-environment jsdom
// Keyed windows remember where they were put and how big across a restart (a fresh module over the same storage);
// kept windows belong to a layout, reopen with it and are forgotten only by their close; storage this build cannot
// read is left as it is and reported.
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("./components/LayoutSurface", () => ({ mountLayout: (el: HTMLElement) => { el.textContent = "layout"; return () => {}; } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;

/** A restart: the module comes back fresh over the same localStorage. */
const boot = async () => { vi.resetModules(); return import("./modUi"); };
const windowsOf = (modId: string) => [...document.querySelectorAll<HTMLElement>(`[data-testid=mod-api-window-${modId}]`)];
const stored = () => JSON.parse(localStorage.getItem("perch.modWindows") ?? "null") as { v: number; windows: Record<string, { x: number; y: number; width: number; height: number; kept?: { owner: string } }> } | null;
/** What a drag or the resize corner leaves behind: new inline geometry, then the press ends. */
function moveAndSize(box: HTMLElement, at: { x: number; y: number; width: number; height: number }) {
  box.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  Object.assign(box.style, { left: `${at.x}px`, top: `${at.y}px`, width: `${at.width}px`, height: `${at.height}px` });
  document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
}
const block = { layout: { type: "block", content: "status" } };

// Node's own (empty, file-less) localStorage hides jsdom's: this test brings a plain one.
const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => void memory.set(key, String(value)),
  removeItem: (key: string) => void memory.delete(key), clear: () => memory.clear(),
});
beforeEach(() => { localStorage.clear(); vi.stubGlobal("innerWidth", 1600); vi.stubGlobal("innerHeight", 1000); });
afterEach(() => { document.body.replaceChildren(); vi.stubGlobal("innerWidth", 1600); });

it("a keyed window comes back where it was put and as big as it was made, after a restart; an unkeyed one does not", async () => {
  let { modUi } = await boot();
  const ui = modUi("m", new Set());
  ui.window({ key: "notes", title: "Notes", width: 300, height: 200 }, () => {});
  moveAndSize(windowsOf("m")[0]!, { x: 500, y: 320, width: 420, height: 260 });
  expect(stored()?.windows["m:notes"]).toMatchObject({ x: 500, y: 320, width: 420, height: 260 });
  expect(stored()?.windows["m:notes"]?.kept).toBeUndefined();
  document.body.replaceChildren();

  ({ modUi } = await boot());
  modUi("m", new Set()).window({ key: "notes", title: "Notes", width: 300, height: 200 }, () => {});
  const box = windowsOf("m")[0]!;
  expect([box.style.left, box.style.top, box.style.width, box.style.height]).toEqual(["500px", "320px", "420px", "260px"]);
  // Pulled back onto a smaller screen so its title bar can be reached.
  vi.stubGlobal("innerWidth", 400);
  modUi("m", new Set()).window({ key: "notes" }, () => {});
  expect(windowsOf("m")).toHaveLength(1); // same key: the old one was replaced
  expect(windowsOf("m")[0]!.style.left).toBe("340px");
});

it("a kept window belongs to its layout: it closes on a switch, reopens with the layout after a restart, survives its package and is forgotten by its x", async () => {
  let ui = await boot();
  ui.setWindowOwner("my-window");
  const packageOpen = new Set<() => void>();
  ui.modUi("m", packageOpen).window({ key: "peek", title: "Peek", keep: true }, block);
  expect(stored()?.windows["m:peek"]?.kept).toMatchObject({ owner: "my-window", mod: "m", key: "peek", layout: { type: "block", content: "status" } });
  // Replacing the package (its disposal closes what is in its set) leaves the layout's window open.
  for (const close of [...packageOpen]) close();
  expect(windowsOf("m")).toHaveLength(1);
  ui.setWindowOwner("");
  expect(windowsOf("m")).toHaveLength(0);
  expect(stored()?.windows["m:peek"]?.kept?.owner).toBe("my-window");
  ui.setWindowOwner("my-window");
  expect(windowsOf("m")).toHaveLength(1);

  ui = await boot();
  document.body.replaceChildren();
  ui.setWindowOwner("");
  expect(windowsOf("m")).toHaveLength(0);
  ui.setWindowOwner("my-window");
  const box = windowsOf("m")[0]!;
  expect(box.textContent).toContain("Peek");
  (box.querySelector("[data-testid=mod-api-window-close]") as HTMLButtonElement).click();
  expect(windowsOf("m")).toHaveLength(0);
  expect(stored()?.windows["m:peek"]?.kept).toBeUndefined();
  ui.setWindowOwner("");
  ui.setWindowOwner("my-window");
  expect(windowsOf("m")).toHaveLength(0);
});

it("refuses a kept window it could not reopen, before opening anything", async () => {
  const { modUi } = await boot();
  const ui = modUi("m", new Set());
  expect(() => ui.window({ keep: true }, block)).toThrow(/key/);
  expect(() => ui.window({ key: "k", keep: true }, () => {})).toThrow(/layout content/);
  expect(() => ui.window({ key: "k", keep: true, frame: "none" }, block)).toThrow(/frame/);
  expect(() => ui.window({ key: "k", keep: true }, { layout: { type: "block", content: "https://x" } })).toThrow(/block content/);
  expect(windowsOf("m")).toHaveLength(0);
  expect(stored()).toBeNull();
});

it("keeps at most 64 keys, dropping the least recently used", async () => {
  const { modUi } = await boot();
  const ui = modUi("m", new Set());
  for (let i = 0; i < 70; i++) ui.window({ key: `w${i}` }, () => {})();
  const names = Object.keys(stored()!.windows);
  expect(names).toHaveLength(64);
  expect(names).not.toContain("m:w0");
  expect(names).toContain("m:w69");
});

it("leaves storage it cannot read exactly as it is, reports it, and remembers for this run only until reset", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  for (const bad of ["{not json", JSON.stringify({ v: 2, windows: {} }), JSON.stringify({ v: 1, windows: { "m:a": { x: "1", y: 0, width: 1, height: 1, used: 1 } } }),
    JSON.stringify({ v: 1, windows: { "m:a": { x: 1, y: 0, width: 1, height: 1, used: 1, kept: { owner: "", mod: "m", key: "a", layout: { type: "block", content: "terminal:../x" } } } } })]) {
    localStorage.setItem("perch.modWindows", bad);
    const ui = await boot();
    const modUi = ui.modUi("m", new Set());
    modUi.window({ key: "a", at: { x: 10, y: 10 } }, () => {});
    moveAndSize(windowsOf("m")[0]!, { x: 50, y: 60, width: 200, height: 100 });
    expect(localStorage.getItem("perch.modWindows"), bad).toBe(bad);
    expect(ui.windowStoreProblem(), bad).toMatch(/could not be read/);
    document.body.replaceChildren();
    if (bad.startsWith("{not")) {
      ui.resetWindowStore();
      expect(ui.windowStoreProblem()).toBeNull();
      modUi.window({ key: "a" }, () => {});
      expect(stored()?.windows["m:a"]).toBeDefined();
      document.body.replaceChildren();
    }
  }
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

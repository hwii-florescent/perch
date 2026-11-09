// @vitest-environment jsdom
// ModRoot's generations and instances with real React: one live tree across a swap (the old one's API and
// effects are gone before the new one's effects start), a swap held while the copy has tracked work, the newest
// requested revision winning, a render failure going back to the last good one, and a layout copy kept while
// hidden. The module graph itself (es-module-shims) needs a browser: e2e/stock-ui-clones.spec.ts.
import { act, useContext, useEffect, type ComponentType, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModInfo } from "@perch/shared";

const h = vi.hoisted(() => ({
  log: [] as string[],
  reports: [] as unknown[][],
  views: new Map<string, unknown>(),
  gates: new Map<string, Promise<void>>(),
  mods: null as { mods: ModInfo[]; uses?: Record<string, string> } | null,
  watchers: new Set<() => void>(),
  refreshed: 0,
  failures: new Map<string, Error>(),
}));
vi.mock("../mods", () => ({
  reportMod: (...args: unknown[]) => void h.reports.push(args),
  currentMods: () => h.mods,
  subscribeMods: (watch: () => void) => (h.watchers.add(watch), () => void h.watchers.delete(watch)),
  refreshMods: () => void h.refreshed++,
}));
vi.mock("../modApp", () => ({
  modApi: (id: string) => {
    const name = `api ${id}#${h.log.filter((l) => l.startsWith("api ")).length + 1}`;
    h.log.push(name);
    return { dispose: () => (h.log.push(`dispose ${name}`), []) };
  },
}));
vi.mock("../mod-runtime", async (actual) => ({
  ...(await actual<typeof import("../mod-runtime")>()),
  stockMod: async (name: string) => ({ id: `stock:${name}`, name, description: "", place: "layout", enabled: true, revision: `stock-${name}`, error: null, format: "esm", files: [], origin: "stock" }),
  importPackage: async (_id: string, revision: string) => {
    await h.gates.get(revision);
    const failure = h.failures.get(revision);
    if (failure) throw failure;
    return { default: h.views.get(revision) };
  },
}));
import { findInstance, InstanceContext, packageReact, PackageUnavailable, retainInstances, trackOperation } from "../mod-runtime";
import { ModRoot, StockRoute, StockView } from "./mod-root";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mod = (revision: string): ModInfo => ({ id: "board", name: "Board", description: "", place: "layout", enabled: true, revision, error: null, format: "esm", files: [] });
let live = 0;
let most = 0;
/** A view that logs its mount and unmount and counts how many of its kind are live at once. */
const view = (name: string): ComponentType => function View() {
  useEffect(() => {
    live++;
    most = Math.max(most, live);
    h.log.push(`mount ${name}`);
    return () => { live--; h.log.push(`unmount ${name}`); };
  }, []);
  return <p data-testid="shown">{name}</p>;
};
const settle = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise((done) => setTimeout(done, 0)); });
const text = (host: HTMLElement) => host.querySelector('[data-testid="shown"]')?.textContent ?? null;

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  h.log.length = 0; h.reports.length = 0; h.views.clear(); h.gates.clear(); live = 0; most = 0; h.mods = null;
  h.watchers.clear(); h.refreshed = 0; h.failures.clear();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); retainInstances("", new Set()); });

describe("a package copy's generations", () => {
  it("swaps one live tree: the old API and effects are gone before the new effects start", async () => {
    h.views.set("r1", view("one")).set("r2", view("two"));
    await act(async () => root.render(<ModRoot mod={mod("r1")} instance="pane:t1" />));
    await settle();
    expect(text(host)).toBe("one");
    await act(async () => root.render(<ModRoot mod={mod("r2")} instance="pane:t1" />));
    await settle();
    expect(text(host)).toBe("two");
    const at = (entry: string) => h.log.indexOf(entry);
    expect(at("dispose api board#1")).toBeGreaterThan(-1);
    expect(at("dispose api board#1")).toBeLessThan(at("mount two"));
    expect(at("unmount one")).toBeLessThan(at("mount two"));
    expect(most).toBe(1);
    expect(h.reports).toContainEqual(["board", "r2", null, { instance: "pane:t1", phase: "render" }]);
  });

  it("holds a new revision while the copy has a tracked operation, then swaps", async () => {
    let finish!: () => void;
    const work = new Promise<void>((done) => { finish = done; });
    h.views.set("r1", function Sending() {
      const context = useContext(InstanceContext)!;
      useEffect(() => void trackOperation(context.instance, work), [context]);
      return <p data-testid="shown">sending</p>;
    }).set("r2", view("two"));
    await act(async () => root.render(<ModRoot mod={mod("r1")} instance="pane:t1" />));
    await settle();
    await act(async () => root.render(<ModRoot mod={mod("r2")} instance="pane:t1" />));
    await settle();
    expect(text(host)).toBe("sending");
    expect(host.querySelector('[data-testid="mod-update-waiting"]')).not.toBeNull();
    await act(async () => finish());
    await settle();
    expect(text(host)).toBe("two");
    expect(host.querySelector('[data-testid="mod-update-waiting"]')).toBeNull();
    expect(h.reports.some((r) => (r[3] as { phase: string }).phase === "swap")).toBe(false);
  });

  it("keeps the newest requested revision when an older load finishes later", async () => {
    let release!: () => void;
    h.gates.set("r2", new Promise<void>((done) => { release = done; }));
    h.views.set("r1", view("one")).set("r2", view("two")).set("r3", view("three"));
    await act(async () => root.render(<ModRoot mod={mod("r1")} instance="pane:t1" />));
    await settle();
    await act(async () => root.render(<ModRoot mod={mod("r2")} instance="pane:t1" />));
    await act(async () => root.render(<ModRoot mod={mod("r3")} instance="pane:t1" />));
    await settle();
    expect(text(host)).toBe("three");
    await act(async () => release());
    await settle();
    expect(text(host)).toBe("three");
    expect(h.log).not.toContain("mount two");
  });

  it("replaces or closes a copy whose effect cleanups throw, reports them, and tears down nothing outside the copy", async () => {
    // `react` as a package imports it: without the guard React sends these to the root, which unmounts the page.
    const leaky = (name: string): ComponentType => function Leaky() {
      packageReact.useEffect(() => () => { throw new Error(`${name} effect cleanup`); }, []);
      packageReact.useLayoutEffect(() => () => { throw new Error(`${name} layout cleanup`); }, []);
      return <p data-testid="shown">{name}</p>;
    };
    h.views.set("r1", leaky("one")).set("r2", leaky("two"));
    const page = (body: ReactNode) => <><p data-testid="outside">Perch</p>{body}</>;
    await act(async () => root.render(page(<ModRoot mod={mod("r1")} instance="pane:t1" />)));
    await settle();
    await act(async () => root.render(page(<ModRoot mod={mod("r2")} instance="pane:t1" />)));
    await settle();
    expect(host.querySelector('[data-testid="outside"]')).not.toBeNull();
    expect(text(host)).toBe("two");
    expect(h.reports).toContainEqual(["board", "r1", "one effect cleanup", { instance: "pane:t1", phase: "disposal" }]);
    expect(h.reports).toContainEqual(["board", "r1", "one layout cleanup", { instance: "pane:t1", phase: "disposal" }]);
    // Closed: the same throws, reported; Perch stays.
    await act(async () => root.render(page(null)));
    await settle();
    expect(host.querySelector('[data-testid="outside"]')).not.toBeNull();
    expect(h.reports).toContainEqual(["board", "r2", "two effect cleanup", { instance: "pane:t1", phase: "disposal" }]);
  });

  it("keeps what it shows when a revision's files cannot be had for now, and loads it on the next mods list", async () => {
    h.views.set("r1", view("one")).set("r2", view("two"));
    h.failures.set("r2", new PackageUnavailable("lib/dep.js: Perch could not be reached (Failed to fetch); it loads again once Perch answers", false));
    await act(async () => root.render(<ModRoot mod={mod("r1")} instance="pane:t1" />));
    await settle();
    await act(async () => root.render(<ModRoot mod={mod("r2")} instance="pane:t1" />));
    await settle();
    expect(text(host)).toBe("one");
    expect(host.querySelector('[data-testid="mod-error"]')?.textContent).toContain("lib/dep.js: Perch could not be reached");
    expect(h.reports).toContainEqual(["board", "r2", expect.stringContaining("could not be reached"), { instance: "pane:t1", phase: "load" }]);
    expect(h.refreshed).toBe(0);
    // Perch answers again (a reconnect lists the mods): the same revision loads.
    h.failures.delete("r2");
    await act(async () => h.watchers.forEach((watch) => watch()));
    await settle();
    expect(text(host)).toBe("two");
    expect(host.querySelector('[data-testid="mod-error"]')).toBeNull();
    // Another list after that loads nothing again.
    const mounts = h.log.filter((l) => l === "mount two").length;
    await act(async () => h.watchers.forEach((watch) => watch()));
    await settle();
    expect(h.log.filter((l) => l === "mount two")).toHaveLength(mounts);
  });

  it("asks for the mods list at once when the core no longer keeps the revision it was loading", async () => {
    h.views.set("r1", view("one"));
    h.failures.set("r2", new PackageUnavailable("main.js: this revision is no longer kept; it loads again from the newest", true));
    await act(async () => root.render(<ModRoot mod={mod("r1")} instance="pane:t1" />));
    await settle();
    await act(async () => root.render(<ModRoot mod={mod("r2")} instance="pane:t1" />));
    await settle();
    expect(text(host)).toBe("one");
    expect(h.refreshed).toBe(1);
    // A broken file (not unavailable) is not asked about again.
    h.failures.set("r3", new Error("main.js: could not load it (404)"));
    await act(async () => root.render(<ModRoot mod={mod("r3")} instance="pane:t1" />));
    await settle();
    expect(h.refreshed).toBe(1);
    expect(findInstance("pane:t1")?.unavailable).toBe(false);
  });

  it("drops a broken or slower revision's load and its error when the shown revision is listed again (the edit undone)", async () => {
    let release!: () => void;
    h.views.set("r1", view("one")).set("r2", view("two"));
    h.failures.set("r3", new Error("main.js: could not load it (404)"));
    await act(async () => root.render(<ModRoot mod={mod("r1")} instance="pane:t1" />));
    await settle();
    await act(async () => root.render(<ModRoot mod={mod("r3")} instance="pane:t1" />));
    await settle();
    expect(host.querySelector('[data-testid="mod-error"]')?.textContent).toContain("could not load it (404)");
    await act(async () => root.render(<ModRoot mod={mod("r1")} instance="pane:t1" />));
    await settle();
    expect(host.querySelector('[data-testid="mod-error"]')).toBeNull();
    // A slow load of r2 overtaken by r1 being listed again never shows.
    h.gates.set("r2", new Promise<void>((done) => { release = done; }));
    await act(async () => root.render(<ModRoot mod={mod("r2")} instance="pane:t1" />));
    await act(async () => root.render(<ModRoot mod={mod("r1")} instance="pane:t1" />));
    await act(async () => release());
    await settle();
    expect(text(host)).toBe("one");
    expect(h.log).not.toContain("mount two");
  });

  it("does not claim a working version is showing when the only revision failed to render", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    h.views.set("r1", () => { throw new Error("x is not defined"); });
    await act(async () => root.render(<ModRoot mod={mod("r1")} instance="pane:t1" />));
    await settle();
    expect(text(host)).toBeNull();
    expect(host.querySelector('[data-testid="mod-error"]')?.textContent).toBe("x is not defined");
    vi.mocked(console.error).mockRestore();
  });

  it("goes back to the last good revision when a new one throws while rendering, and says so", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    h.views.set("r1", view("one")).set("r2", () => { throw new Error("x is not defined"); });
    await act(async () => root.render(<ModRoot mod={mod("r1")} instance="pane:t1" />));
    await settle();
    await act(async () => root.render(<ModRoot mod={mod("r2")} instance="pane:t1" />));
    await settle();
    expect(text(host)).toBe("one");
    expect(host.querySelector('[data-testid="mod-error"]')?.textContent).toContain("x is not defined");
    expect(h.reports).toContainEqual(["board", "r2", "x is not defined", { instance: "pane:t1", phase: "render" }]);
    expect(h.reports).not.toContainEqual(["board", "r2", null, { instance: "pane:t1", phase: "render" }]);
    vi.mocked(console.error).mockRestore();
  });
});

describe("a package copy's instance", () => {
  it("parks a layout copy while it is not shown, keeping its API, and ends it when the layout lets it go", async () => {
    h.views.set("r1", view("one"));
    const key = "layout:main:side";
    await act(async () => root.render(<ModRoot mod={mod("r1")} instance={key} owner="layout" />));
    await settle();
    await act(async () => root.render(<p>another tab</p>));
    await settle();
    const parked = findInstance(key)!;
    expect(parked.current?.revision).toBe("r1");
    expect(h.log).not.toContain("dispose api board#1");
    expect(h.log.filter((l) => l.startsWith("api "))).toHaveLength(1);
    // Shown again: the same copy, no new import or API.
    await act(async () => root.render(<ModRoot mod={mod("r1")} instance={key} owner="layout" />));
    await settle();
    expect(text(host)).toBe("one");
    expect(h.log.filter((l) => l.startsWith("api "))).toHaveLength(1);
    await act(async () => root.render(<p>gone</p>));
    retainInstances("layout:", new Set([key]));
    expect(findInstance(key)).toBe(parked);
    retainInstances("layout:", new Set());
    expect(findInstance(key)).toBeUndefined();
    expect(h.log).toContain("dispose api board#1");
  });

  it("ends any other copy with its view, and never runs a second view of one copy", async () => {
    h.views.set("r1", view("one"));
    await act(async () => root.render(<><ModRoot mod={mod("r1")} instance="pane:t1" /><ModRoot mod={mod("r1")} instance="pane:t1" /></>));
    await settle();
    expect(host.querySelectorAll('[data-testid="shown"]')).toHaveLength(1);
    expect(host.textContent).toContain("already shown elsewhere");
    await act(async () => root.render(<p>closed</p>));
    await settle();
    expect(findInstance("pane:t1")).toBeUndefined();
    expect(h.log).toContain("dispose api board#1");
  });
});

describe("a stock screen where Perch shows it", () => {
  const clone = (over: Partial<ModInfo> = {}): ModInfo => ({ ...mod("clone-r"), id: "my-status", origin: "clone", ...over });
  it("runs the stock package, the person's chosen package in its place, and stock again when the choice goes or breaks", async () => {
    h.views.set("stock-status", view("stock"));
    h.views.set("clone-r", view("clone"));
    act(() => root.render(<StockView name="status" instance="layout:main:status" placeholder={<p data-testid="shown">loading</p>} />));
    expect(text(host)).toBe("loading");
    await settle();
    expect(text(host)).toBe("stock");
    expect(host.querySelector("[data-mod-instance]")?.getAttribute("data-mod-instance")).toBe("layout:main:status");

    // `perch mod use stock:status my-status`: the same place now runs the clone, with the same props.
    h.mods = { mods: [clone()], uses: { "stock:status": "my-status" } };
    act(() => root.render(<StockView name="status" instance="layout:main:status" />));
    await settle();
    expect(text(host)).toBe("clone");
    expect(findInstance("layout:main:status")?.modId).toBe("my-status");
    // A layout's `mod:stock:status` is the stock screen whatever was chosen.
    act(() => root.render(<StockView name="status" exact />));
    await settle();
    expect(text(host)).toBe("stock");

    // A chosen package that is off or cannot load is not shown in stock's place.
    for (const broken of [clone({ enabled: false }), clone({ error: "bad mod.json" }), clone({ format: undefined })]) {
      h.mods = { mods: [broken], uses: { "stock:status": "my-status" } };
      act(() => root.render(<StockView name="status" instance="layout:main:status" />));
      await settle();
      expect(text(host)).toBe("stock");
    }
    expect(most).toBe(1);
  });

  it("gives way to stock, saying why and keeping the choice, when the chosen package cannot load or render; an edit tries it again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    h.views.set("stock-status", view("stock"));
    h.views.set("clone-r", () => { throw new Error("boom at boot"); });
    h.mods = { mods: [clone()], uses: { "stock:status": "my-status" } };
    act(() => root.render(<StockView name="status" />));
    await settle();
    expect(text(host)).toBe("stock");
    const notice = host.querySelector('[data-testid="stock-fallback-status"]');
    expect(notice?.textContent).toContain("Your Board (my-status) could not run in place of Perch's status: boom at boot");
    expect(notice?.textContent).toContain("mods/my-status");
    // A listed error is said too; a fixed revision is tried again.
    h.views.set("clone-r2", view("clone fixed"));
    h.mods = { mods: [clone({ revision: "clone-r2" })], uses: { "stock:status": "my-status" } };
    act(() => root.render(<StockView name="status" />));
    await settle();
    expect(text(host)).toBe("clone fixed");
    expect(host.querySelector('[data-testid="stock-fallback-status"]')).toBeNull();
    h.mods = { mods: [clone({ error: "main.js is missing" })], uses: { "stock:status": "my-status" } };
    act(() => root.render(<StockView name="status" />));
    await settle();
    expect(text(host)).toBe("stock");
    expect(host.textContent).toContain("main.js is missing");
    vi.mocked(console.error).mockRestore();
  });

  it("gives way to stock while the chosen package's files cannot be had, and runs it again on the next mods list", async () => {
    h.views.set("stock-status", view("stock")).set("clone-r", view("clone"));
    h.failures.set("clone-r", new PackageUnavailable("main.js: Perch could not be reached (Failed to fetch); it loads again once Perch answers", false));
    h.mods = { mods: [clone()], uses: { "stock:status": "my-status" } };
    act(() => root.render(<StockView name="status" />));
    await settle();
    expect(text(host)).toBe("stock");
    expect(host.querySelector('[data-testid="stock-fallback-status"]')?.textContent).toContain("main.js: Perch could not be reached");
    // The same revision, listed again after a reconnect.
    h.failures.delete("clone-r");
    h.mods = { mods: [clone()], uses: { "stock:status": "my-status" } };
    await act(async () => { h.watchers.forEach((watch) => watch()); root.render(<StockView name="status" />); });
    await settle();
    expect(text(host)).toBe("clone");
    expect(host.querySelector('[data-testid="stock-fallback-status"]')).toBeNull();
  });

  it("shows stock, with the range, while the chosen copy needs another @perch/sdk, even after it ran; a fixed range runs it again", async () => {
    h.views.set("stock-status", view("stock"));
    h.views.set("clone-r", view("clone"));
    h.mods = { mods: [clone({ api: "^1" })], uses: { "stock:status": "my-status" } };
    act(() => root.render(<StockView name="status" />));
    await settle();
    expect(text(host)).toBe("clone");
    // Its mod.json now asks for a newer SDK (or the page is an older Perch): no last working revision is kept on screen.
    h.mods = { mods: [clone({ api: "^2" })], uses: { "stock:status": "my-status" } };
    act(() => root.render(<StockView name="status" />));
    await settle();
    expect(text(host)).toBe("stock");
    expect(host.querySelector('[data-testid="stock-fallback-status"]')?.textContent).toContain("it needs @perch/sdk ^2; this Perch has");
    h.mods = { mods: [clone({ api: "^1" })], uses: { "stock:status": "my-status" } };
    act(() => root.render(<StockView name="status" />));
    await settle();
    expect(text(host)).toBe("clone");
    expect(host.querySelector('[data-testid="stock-fallback-status"]')).toBeNull();
  });
});

describe("a stock screen Perch opens on demand (a confirmation, the notifications)", () => {
  it("is the compiled stock source, or the chosen package with the caller's current props and callbacks, never reloaded for them", async () => {
    const Stock = ({ message }: { message: string }) => <p data-testid="shown">stock: {message}</p>;
    const confirmed: string[] = [];
    h.views.set("clone-r", ({ message, onConfirm }: { message: string; onConfirm(): void }) => <button type="button" data-testid="shown" onClick={onConfirm}>clone: {message}</button>);
    act(() => root.render(<StockRoute name="confirm" props={{ message: "Close it?", onConfirm: () => {} }} stock={Stock} />));
    expect(text(host)).toBe("stock: Close it?");
    h.mods = { mods: [{ ...mod("clone-r"), id: "my-confirm" }], uses: { "stock:confirm": "my-confirm" } };
    act(() => root.render(<StockRoute name="confirm" props={{ message: "Close it?", onConfirm: () => confirmed.push("first") }} stock={Stock} />));
    await settle();
    expect(text(host)).toBe("clone: Close it?");
    act(() => root.render(<StockRoute name="confirm" props={{ message: "Close both?", onConfirm: () => confirmed.push("second") }} stock={Stock} />));
    await settle();
    expect(text(host)).toBe("clone: Close both?");
    act(() => host.querySelector("button")!.click());
    expect(confirmed).toEqual(["second"]);
    // One import and one API for the whole time it was open.
    expect(h.log.filter((line) => line.startsWith("api my-confirm"))).toHaveLength(1);
  });
});

describe("a phone", () => {
  const narrow = (matches: boolean) => {
    const listeners = new Set<() => void>();
    window.matchMedia = ((query: string) => ({ matches, media: query, addEventListener: (_: string, l: () => void) => listeners.add(l), removeEventListener: (_: string, l: () => void) => listeners.delete(l) })) as unknown as typeof window.matchMedia;
  };
  const stored = new Map<string, string>();
  beforeEach(() => vi.stubGlobal("localStorage", { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => void stored.set(k, v), removeItem: (k: string) => void stored.delete(k) }));
  afterEach(() => { delete (window as { matchMedia?: unknown }).matchMedia; stored.clear(); vi.unstubAllGlobals(); });
  const Stock = ({ label }: { label: string }) => <p data-testid="shown">stock {label}</p>;
  const copy = (id: string): ModInfo => ({ ...mod("clone-r"), id, origin: "clone" });

  it("shows Perch's own desktop screens whatever the computer chose, and its own phone screens until the person turns copies on there; off is at once", async () => {
    const { setPhoneMods } = await import("../phoneMods");
    narrow(true);
    h.views.set("clone-r", ({ label }: { label: string }) => <p data-testid="shown">copy {label}</p>);
    h.mods = { mods: [copy("my-select"), copy("my-header")], uses: { "stock:select": "my-select", "stock:mobile-header": "my-header" } };
    const both = (label: string) => (
      <>
        <div id="desktop"><StockRoute name="select" props={{ label }} stock={Stock} /></div>
        <div id="phone"><StockRoute name="mobile-header" props={{ label }} stock={Stock} /></div>
      </>
    );
    const shown = (id: string) => host.querySelector(`#${id} [data-testid="shown"]`)?.textContent;
    act(() => root.render(both("a")));
    await settle();
    expect([shown("desktop"), shown("phone")]).toEqual(["stock a", "stock a"]);
    expect(h.log.filter((line) => line.startsWith("api "))).toEqual([]); // nothing of the person's ran

    act(() => setPhoneMods(true));
    await settle();
    expect([shown("desktop"), shown("phone")]).toEqual(["stock a", "copy a"]);
    act(() => setPhoneMods(false));
    await settle();
    expect([shown("desktop"), shown("phone")]).toEqual(["stock a", "stock a"]);

    // The same choices on a desktop: the desktop's copy runs; the phone's never does there.
    narrow(false);
    act(() => root.unmount());
    root = createRoot(host);
    act(() => root.render(both("b")));
    await settle();
    expect([shown("desktop"), shown("phone")]).toEqual(["copy b", "stock b"]);
  });

  it("never runs a person's layout block, docked, hidden or overlaid package, but runs Perch's own packages", async () => {
    narrow(true);
    h.views.set("clone-r", view("person's"));
    h.views.set("stock-r", view("perch's"));
    act(() => root.render(<ModRoot mod={copy("board")} instance="layout:x:board" />));
    await settle();
    expect(text(host)).toBeNull();
    expect(host.querySelector('[data-testid="mod-phone-refused-board"]')?.textContent).toContain("runs on the computer, not on this phone");
    act(() => root.render(<ModRoot mod={copy("board")} hidden instance="hidden:board" />));
    await settle();
    expect(host.textContent).toBe("");
    act(() => root.render(<ModRoot mod={{ ...mod("stock-r"), id: "stock:status", origin: "stock" }} instance="stock:status" />));
    await settle();
    expect(text(host)).toBe("perch's");
    expect(h.log).not.toContain("mount person's");
  });
});

describe("a package that freezes the page while it starts", () => {
  it("is still marked starting on the next page load, which turns it off; one that rendered or failed is not", async () => {
    const { resetBootGuard, takeStalledStarts } = await import("../bootGuard");
    const stored = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => void stored.set(k, v), removeItem: (k: string) => void stored.delete(k) });
    resetBootGuard();
    vi.spyOn(console, "error").mockImplementation(() => {});
    h.views.set("ok", view("ok"));
    h.views.set("fails", () => { throw new Error("no"); });
    h.gates.set("hangs", new Promise(() => {})); // never finishes starting, as a frozen page never would
    act(() => root.render(<>
      <ModRoot mod={{ ...mod("ok"), id: "fine" }} instance="a" />
      <ModRoot mod={{ ...mod("fails"), id: "broken" }} instance="b" />
      <ModRoot mod={{ ...mod("hangs"), id: "stuck" }} instance="c" />
      <ModRoot mod={{ ...mod("stock-x"), id: "stock:x", origin: "stock" }} instance="d" />
    </>));
    await settle();
    await settle();
    expect(text(host)).toBe("ok");
    const left = JSON.parse(localStorage.getItem("perch.mods.booting") ?? "{}") as Record<string, unknown>;
    expect(Object.keys(left)).toEqual(["stuck"]);
    // The next page: only what never finished, once.
    resetBootGuard();
    expect(takeStalledStarts()).toEqual([{ id: "stuck", revision: "hangs" }]);
    expect(takeStalledStarts()).toEqual([]);
    vi.mocked(console.error).mockRestore();
    vi.unstubAllGlobals();
  });

  it("is not turned off when the page was left normally (a reload) while it was still starting", async () => {
    const { resetBootGuard, takeStalledStarts } = await import("../bootGuard");
    const stored = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => void stored.set(k, v), removeItem: (k: string) => void stored.delete(k) });
    resetBootGuard();
    h.gates.set("slow", new Promise(() => {})); // still loading when the person reloads
    act(() => root.render(<ModRoot mod={{ ...mod("slow"), id: "slow-copy" }} instance="slow" />));
    await settle();
    expect(Object.keys(JSON.parse(localStorage.getItem("perch.mods.booting") ?? "{}") as object)).toEqual(["slow-copy"]);
    window.dispatchEvent(new Event("pagehide"));
    resetBootGuard();
    expect(takeStalledStarts()).toEqual([]);
    vi.unstubAllGlobals();
  });
});


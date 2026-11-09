// @vitest-environment jsdom
// Unit level only: what the loader fetches, how it rewrites a package's CSS, what it holds per revision and per
// copy. Running real module graphs needs a browser (e2e/stock-ui-clones.spec.ts, e2e/relay.check.mjs).
import { afterEach, describe, expect, it, vi } from "vitest";

const relay = vi.hoisted(() => ({ on: false, active: 0, most: 0, urls: [] as string[] }));
vi.mock("./relay/transport", async (actual) => ({
  ...(await actual<typeof import("./relay/transport")>()),
  isRelayMode: () => relay.on,
  relayRequest: async (url: string) => {
    relay.urls.push(url);
    relay.most = Math.max(relay.most, ++relay.active);
    await new Promise((done) => setTimeout(done, 5));
    relay.active--;
    return new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } });
  },
}));

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); relay.on = false; relay.active = 0; relay.most = 0; relay.urls.length = 0; });

const answer = (body: string, type = "application/json", status = 200) =>
  Promise.resolve(new Response(body, { status, headers: { "content-type": type } }));
const CATALOG = JSON.stringify({ packages: [{ id: "keybind-help", name: "Keybind help", version: "1.0.0", api: "^1", entry: "main.js", files: ["main.js", "mod.json"], revision: "abc" }] });

/** Object URLs jsdom lacks: `blob:n`, and which were revoked. */
function objectUrls() {
  let n = 0;
  const revoked: string[] = [];
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: () => `blob:${++n}`, revokeObjectURL: (url: string) => void revoked.push(url) }));
  return revoked;
}

it("a stock screen is read from this page's own build, as a package in the stock namespace", async () => {
  const fetch = vi.fn(() => answer(CATALOG));
  vi.stubGlobal("fetch", fetch);
  const { stockMod } = await import("./mod-runtime");
  expect(await stockMod("keybind-help")).toMatchObject({ id: "stock:keybind-help", revision: "abc", format: "esm", place: "layout", origin: "stock", api: "^1", entry: "main.js" });
  await stockMod("keybind-help");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String((fetch.mock.calls[0] as unknown[])[0])).toBe(`${window.location.origin}/stock-ui/catalog.json`);
  await expect(stockMod("nope")).rejects.toThrow(/no stock screen "nope"/);
});

it("a build without stock-ui (the SPA fallback page) is an error, asked again next time", async () => {
  const fetch = vi.fn(() => answer("<!doctype html>", "text/html"));
  vi.stubGlobal("fetch", fetch);
  const { stockMod } = await import("./mod-runtime");
  await expect(stockMod("keybind-help")).rejects.toThrow(/no stock-ui\/catalog\.json/);
  fetch.mockImplementation(() => answer(CATALOG));
  expect((await stockMod("keybind-help")).id).toBe("stock:keybind-help");
  expect(fetch).toHaveBeenCalledTimes(2);
});

describe("a package's CSS", () => {
  const urls: Record<string, string> = { "art/dot.svg": "blob:dot", "fonts/a b.woff2": "blob:font" };
  const rewrite = async (css: string, file = "style.css") => (await import("./mod-runtime")).rewriteCss(css, file, (path) => urls[path]);

  it("points every url() naming a package file at that file, read as CSS reads it", async () => {
    expect(await rewrite(`.a { background: url(art/dot.svg) }`)).toBe(`.a { background: url("blob:dot") }`);
    expect(await rewrite(`.a { background: url( "./art/dot.svg#x" ) }`)).toBe(`.a { background: url( "blob:dot#x" ) }`);
    expect(await rewrite(`@font-face { src: url('../fonts/a%20b.woff2') }`, "css/main.css")).toBe(`@font-face { src: url("blob:font") }`);
    // Comments and strings that only look like url(...) are left alone.
    expect(await rewrite(`/* url(nope.png) */ .a::after { content: "url(nope.png)" }`)).toBe(`/* url(nope.png) */ .a::after { content: "url(nope.png)" }`);
  });

  it("keeps data:, absolute and fragment URLs", async () => {
    const css = `.a { background: url(data:image/png;base64,AAAA) } .b { mask: url(#m) } .c { background: url("https://e.example/x.png") }`;
    // The same URLs (an unquoted url token comes back quoted).
    expect(await rewrite(css)).toBe(`.a { background: url("data:image/png;base64,AAAA") } .b { mask: url("#m") } .c { background: url("https://e.example/x.png") }`);
  });

  it("refuses @import and a url() naming no file of the package", async () => {
    await expect(rewrite(`@import "other.css";`)).rejects.toThrow(/@import is not needed/);
    await expect(rewrite(`.a { background: url(missing.png) }`)).rejects.toThrow(/url\(missing\.png\) names no file/);
    await expect(rewrite(`.a { background: url(../../outside.png) }`)).rejects.toThrow(/names no file/);
  });
});

describe("a revision's resources", () => {
  const files = ["main.js", "mod.json", "style.css", "art/dot.svg"];
  const serve = () => vi.fn((url: string) => {
    const path = new URL(url).searchParams.get("path");
    if (path === "style.css") return answer(`.dot { background: url(art/dot.svg) }`, "text/css");
    if (path === "art/dot.svg") return answer("<svg/>", "image/svg+xml");
    return answer("nope", "text/plain", 404);
  });

  it("fetches each asset once, rewrites the CSS, shows it while shown and revokes at the last release", async () => {
    const revoked = objectUrls();
    const fetch = serve();
    vi.stubGlobal("fetch", fetch);
    const { acquireResources, releaseResources, showStyles, assetUrl } = await import("./mod-runtime");
    const mod = { id: "board", revision: "r1", files };
    const [one, two] = await Promise.all([acquireResources(mod), acquireResources(mod)]);
    expect(one).toBe(two);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(one.css).toContain(`url("blob:1")`);
    expect(assetUrl("board", "r1", "./art/dot.svg")).toBe("blob:1");
    expect(() => assetUrl("board", "r1", "art/none.svg")).toThrow(/no such file/);
    const hide = showStyles(one);
    const style = document.head.querySelector('style[data-mod-package="board"][data-mod-revision="r1"]');
    expect(style?.textContent).toContain("blob:1");
    hide();
    expect(style?.isConnected).toBe(false);
    releaseResources(one);
    expect(revoked).toEqual([]);
    releaseResources(two);
    expect(revoked).toEqual(["blob:1"]);
    expect(() => assetUrl("board", "r1", "art/dot.svg")).toThrow(/no such file/);
  });

  it("refuses a file whose content type is not what its extension says (nosniff)", async () => {
    objectUrls();
    vi.stubGlobal("fetch", vi.fn(() => answer("alert(1)", "text/javascript")));
    const { acquireResources } = await import("./mod-runtime");
    await expect(acquireResources({ id: "board", revision: "r1", files })).rejects.toThrow(/art\/dot\.svg: served as "text\/javascript"/);
  });

  it("names the file and says it is only unavailable when Perch does not answer or no longer keeps the revision, and keeps no asset it had fetched", async () => {
    const revoked = objectUrls();
    const { acquireResources, PackageUnavailable } = await import("./mod-runtime");
    // The asset arrives, then the connection drops before the stylesheet.
    vi.stubGlobal("fetch", vi.fn((url: string) => (new URL(url).searchParams.get("path") === "art/dot.svg" ? answer("<svg/>", "image/svg+xml") : Promise.reject(new TypeError("Failed to fetch")))));
    const lost = await acquireResources({ id: "board", revision: "r1", files }).catch((error: unknown) => error);
    expect(lost).toBeInstanceOf(PackageUnavailable);
    expect((lost as Error).message).toBe("style.css: Perch could not be reached (Failed to fetch); it loads again once Perch answers");
    expect((lost as InstanceType<typeof PackageUnavailable>).gone).toBe(false);
    expect(revoked).toEqual(["blob:1"]);
    vi.stubGlobal("fetch", vi.fn(() => answer("revision r1 is no longer kept", "text/plain", 410)));
    const gone = await acquireResources({ id: "board", revision: "r1", files }).catch((error: unknown) => error);
    expect(gone).toBeInstanceOf(PackageUnavailable);
    expect((gone as InstanceType<typeof PackageUnavailable>).gone).toBe(true);
    expect((gone as Error).message).toMatch(/: this revision is no longer kept; it loads again from the newest$/);
    // A file the revision does not have is the package's own error, not "unavailable".
    vi.stubGlobal("fetch", serve());
    const missing = await acquireResources({ id: "board", revision: "r2", files: ["main.js", "art/gone.svg"] }).catch((error: unknown) => error);
    expect(missing).not.toBeInstanceOf(PackageUnavailable);
    expect((missing as Error).message).toBe("art/gone.svg: could not load it (404): nope");
  });

  it("over the relay, fetches only through the tunnel and at most MAX_RELAY_FETCHES at once", async () => {
    objectUrls();
    relay.on = true;
    const fetch = vi.fn(() => answer("nope", "text/plain", 500));
    vi.stubGlobal("fetch", fetch);
    const { acquireResources, MAX_RELAY_FETCHES } = await import("./mod-runtime");
    const many = Array.from({ length: 30 }, (_, i) => `art/${i}.svg`);
    const resources = await acquireResources({ id: "board", revision: "r1", files: many });
    expect(resources.urls.size).toBe(30);
    expect(relay.urls).toHaveLength(30);
    expect(relay.most).toBe(MAX_RELAY_FETCHES);
    expect(MAX_RELAY_FETCHES).toBeLessThan(16);
    expect(fetch).not.toHaveBeenCalled();
  });
});

it("a retried load reads the same revision under fresh module URLs", async () => {
  const { moduleUrl } = await import("./mod-runtime");
  expect(moduleUrl("my pkg", "abc", "lib/a.js")).toBe("https://perch-mod.invalid/my%20pkg/abc/lib/a.js");
  expect(moduleUrl("my pkg", "abc", "lib/a.js", 2)).toBe("https://perch-mod.invalid/my%20pkg/abc~2/lib/a.js");
});

it("relayRequest refuses a URL that is not one of the tunnel's routes", async () => {
  const { relayRequest } = await vi.importActual<typeof import("./relay/transport")>("./relay/transport");
  await expect(relayRequest("https://elsewhere.example/mods/package?id=a")).rejects.toThrow(/cannot go through the relay/);
  await expect(relayRequest(`${window.location.origin}/not-a-route`)).rejects.toThrow(/cannot go through the relay/);
});

describe("a copy's tracked operations", () => {
  it("waits for them to settle, or gives up after the bound", async () => {
    const { acquireInstance, releaseInstance, trackOperation, waitForTracked } = await import("./mod-runtime");
    const copy = acquireInstance("pane:t", "board", "view");
    let finish!: () => void;
    const work = trackOperation(copy, () => new Promise<string>((done) => { finish = () => done("sent"); }));
    expect(await waitForTracked(copy, 20)).toBe(false);
    setTimeout(() => finish(), 5);
    expect(await waitForTracked(copy, 1000)).toBe(true);
    expect(await work).toBe("sent");
    expect(copy.pending.size).toBe(0);
    // A rejected operation counts as settled too.
    void trackOperation(copy, Promise.reject(new Error("no"))).catch(() => {});
    expect(await waitForTracked(copy, 1000)).toBe(true);
    releaseInstance(copy);
  });
});

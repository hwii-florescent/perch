// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { addressRows } from "./addressSuggestions";
import { useBrowserPages } from "./browserPages";

class FakeStorage {
  store = new Map<string, string>();
  getItem = (key: string) => this.store.get(key) ?? null;
  setItem = (key: string, value: string) => void this.store.set(key, value);
  removeItem = (key: string) => void this.store.delete(key);
}
let storage: FakeStorage;
beforeEach(() => { storage = new FakeStorage(); vi.stubGlobal("localStorage", storage); useBrowserPages.setState({ pages: {} }); });

it("puts the typed action first and never repeats it as a page", () => {
  const history = [{ url: "https://example.com/", title: "Example" }, { url: "https://example.com/docs", title: "" }];
  const rows = addressRows("example.com", history, []);
  expect(rows[0]).toMatchObject({ kind: "go", url: "https://example.com/" });
  expect(rows.map((row) => row.title)).toEqual(["example.com", "example.com"]);
  expect(rows[1]).toMatchObject({ kind: "page", url: "https://example.com/docs" });
  expect(addressRows("hello world", [], [], "duckduckgo")[0]).toMatchObject({ kind: "search", url: "https://duckduckgo.com/?q=hello+world" });
  // An empty bar lists recent pages only.
  expect(addressRows("", history, []).map((row) => row.kind)).toEqual(["page", "page"]);
});

it("composes like Firefox: typed action, up to 4 suggestions, then 3 history rows", () => {
  const history = Array.from({ length: 5 }, (_, i) => ({ url: `https://h${i}.test/`, title: `H${i}` }));
  const suggestions = ["perch", "perch fish", "perchance", "perch parking", "perch bird", "perch tree"];
  const rows = addressRows("perch", history, suggestions);
  // The typed words are not repeated as a suggestion; the engine's own results page is the typed row.
  expect(rows.map((row) => row.kind)).toEqual(["search", "suggest", "suggest", "suggest", "suggest", "page", "page", "page"]);
  expect(rows[1]).toMatchObject({ title: "perch fish", url: "https://www.google.com/search?q=perch+fish" });
  // Without suggestions history takes the whole room.
  expect(addressRows("h", history, []).filter((row) => row.kind === "page")).toHaveLength(5);
});

it("remembers a page, drops its title on a new address, and rejects unsafe icons", () => {
  const { remember } = useBrowserPages.getState();
  remember("k", "https://a.test/", "A", "https://a.test/favicon.ico");
  remember("k", "https://a.test/", undefined, undefined);
  expect(useBrowserPages.getState().pages.k).toEqual({ url: "https://a.test/", title: "A", icon: "https://a.test/favicon.ico" });
  remember("k", "https://b.test/", undefined, undefined);
  expect(useBrowserPages.getState().pages.k).toEqual({ url: "https://b.test/", title: "", icon: "" });
  remember("k", "https://b.test/", "B", "javascript:alert(1)");
  expect(useBrowserPages.getState().pages.k?.icon).toBe("");
  expect(JSON.parse([...storage.store].find(([k]) => k.startsWith("perch.browserPages"))![1]).k.title).toBe("B");
});

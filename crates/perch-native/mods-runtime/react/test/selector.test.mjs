import assert from "node:assert/strict";
import { test } from "node:test";
import { SelectorError, matches, parseComplex } from "../selector.mjs";

const el = (tagName, attrs = {}, ...kids) => {
  const e = { tagName, classList: [], parentElement: null, children: kids, getAttribute: (n) => attrs[n] ?? null };
  for (const k of kids) k.parentElement = e;
  return e;
};

test(":has() of a compound sees any descendant, and :not(:has()) is its negation", () => {
  const row = el("div", { "data-setting-row": "" });
  const full = el("section", {}, el("div", {}, row));
  const empty = el("section", {}, el("h3"));
  assert.equal(matches(full, "section:has([data-setting-row])"), true);
  assert.equal(matches(empty, "section:has([data-setting-row])"), false);
  assert.equal(matches(empty, "section:not(*:has([data-setting-row]))"), true);
  assert.equal(matches(full, "section:not(*:has([data-setting-row]))"), false);
  assert.throws(() => parseComplex("section:has(div > p)"), SelectorError);
});

test("a :has() element's version moves when something below it is added or removed", async () => {
  const { HostElement } = await import("../dom.mjs");
  const section = new HostElement("section");
  const inner = new HostElement("div");
  const row = new HostElement("div", { "data-setting-row": true });
  section.appendChild(inner);
  assert.equal(matches(section, "section:has([data-setting-row])"), false);
  const before = section.version;
  inner.appendChild(row);
  assert.ok(section.version > before, "the watcher is touched through its child");
  assert.equal(matches(section, "section:has([data-setting-row])"), true);
});

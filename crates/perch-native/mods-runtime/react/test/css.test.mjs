//! The cascade's value engine on the forms the app's compiled CSS uses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { evalLength, expand, mediaMatches, parseColor, substitute, toHex } from "../css.mjs";

const desktop = { width: 1000, height: 800 };

test("media queries are evaluated for a desktop window", () => {
  assert.equal(mediaMatches("(min-width: 701px)", desktop), true);
  assert.equal(mediaMatches("not all and (min-width: 700px)", desktop), false);
  assert.equal(mediaMatches("(max-width: 700px)", desktop), false);
  assert.equal(mediaMatches("(width < 700px)", desktop), false);
  assert.equal(mediaMatches("(hover: hover)", desktop), true);
  assert.equal(mediaMatches("(hover: none)", desktop), false);
  assert.equal(mediaMatches("(prefers-reduced-motion: reduce)", desktop), false);
});

test("lengths: calc, min/max and Tailwind's infinite radius", () => {
  assert.deepEqual(evalLength("calc(.25rem * 2)", {}), { px: 8, pct: 0, num: 0, unitless: undefined });
  assert.equal(evalLength("calc(100% - 0.6rem)", {}).pct, 100);
  assert.equal(evalLength("max(4px, 1rem)", {}).px, 16);
  assert.equal(evalLength("calc(infinity * 1px)", {}).px, Infinity);
  assert.equal(evalLength("0.62rem", {}).px, 9.92);
});

test("colours keep the theme token through var() and a mix with transparent", () => {
  const theme = (name) => ({ accent: "#c8c8c8ff", teal: "#7fb8b8ff" })[name];
  const lookup = (name) => ({ "--accent": "perchtoken(accent)", "--teal": "perchtoken(teal)" })[name] ?? null;
  const mixed = parseColor(substitute("color-mix(in srgb, var(--accent) 15%, transparent)", lookup), theme);
  assert.deepEqual({ hex: toHex(mixed.rgba), token: mixed.token }, { hex: "#c8c8c826", token: "accent" });
  const fallback = parseColor(substitute("var(--missing, var(--teal))", lookup), theme);
  assert.deepEqual({ hex: toHex(fallback.rgba), token: fallback.token }, { hex: "#7fb8b8ff", token: "teal" });
});

test("font: inherit sets each font longhand to inherit; a full font value is kept", () => {
  assert.deepEqual(expand("font", "inherit").map(([p]) => p), ["font-family", "font-size", "font-weight", "font-style", "line-height"]);
  assert.ok(expand("font", "inherit").every(([, v]) => v === "inherit"));
  assert.deepEqual(expand("font", "12px serif"), [["font", "12px serif"]]);
});

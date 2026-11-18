import { readFileSync } from "node:fs";
import { compile } from "@tailwindcss/node";
import { expect, it } from "vitest";

// `font-mono` is used across the screens; with the default font theme cleared (`--font-*: initial`) Tailwind
// emits no such rule unless tailwind.css defines it, and the text silently falls back to the UI face.
it("builds a font-mono rule that reads the app's mono stack", async () => {
  const base = decodeURIComponent(new URL(".", import.meta.url).pathname);
  const css = readFileSync(`${base}tailwind.css`, "utf8");
  const built = await compile(css, { base, onDependency: () => {} });
  const out = built.build(["font-mono", "font-sans"]);
  expect(out).toMatch(/\.font-mono\s*\{\s*font-family:\s*var\(--font-mono\);?\s*\}/);
  expect(out).not.toMatch(/\.font-sans/);
});

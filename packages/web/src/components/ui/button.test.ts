import { expect, test } from "vitest";
import { button } from "./button";

const has = (cls: string, token: string) => cls.split(" ").includes(token);

test("primary replaces the ghost fill and label colour", () => {
  const cls = button({ variant: "primary" });
  expect(has(cls, "bg-accent")).toBe(true);
  expect(has(cls, "hover:bg-accent")).toBe(true);
  expect(has(cls, "text-panel-bg")).toBe(true);
  expect(has(cls, "hover:bg-surface-1")).toBe(false);
  expect(has(cls, "text-subtext-0")).toBe(false);
  expect(has(cls, "hover:text-fg")).toBe(false);
});

test("a ghost keeps the quiet hover fill and has no border", () => {
  const cls = button();
  expect(has(cls, "hover:bg-surface-1")).toBe(true);
  expect(has(cls, "text-subtext-0")).toBe(true);
  expect(cls).toContain("[border:0]");
});

test("danger and warn only recolour the label", () => {
  expect(has(button({ tone: "danger" }), "hover:text-red")).toBe(true);
  expect(has(button({ tone: "danger" }), "hover:text-fg")).toBe(false);
  expect(has(button({ tone: "danger" }), "hover:bg-surface-1")).toBe(true);
  const warn = button({ tone: "warn" });
  expect(has(warn, "text-yellow")).toBe(true);
  expect(has(warn, "text-subtext-0")).toBe(false);
});

test("a caller colour replaces the label colour but keeps the size", () => {
  const cls = button({ size: "sm", className: "text-fg" });
  expect(has(cls, "text-fg")).toBe(true);
  expect(has(cls, "text-subtext-0")).toBe(false);
  expect(has(cls, "text-[0.7rem]")).toBe(true);
});

test("a caller class wins over size", () => {
  const cls = button({ size: "sm", className: "px-4" });
  expect(has(cls, "px-4")).toBe(true);
  expect(has(cls, "px-[0.4rem]")).toBe(false);
});

// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { usePerchStore } from "./store";
import { KeptTerminal, borrowLentTerminal, forgetSessionTerminals, lendTerminal, showTerminal } from "./terminalKeeper";
import type { PerchTerminal } from "./xtermSetup";

/** A terminal with no xterm: what the keeper does with its element, and whether its process binding was torn down. */
class Fake extends KeptTerminal<null> {
  readonly created = { fit: vi.fn() } as unknown as PerchTerminal;
  stopped = false;
  protected teardown() { this.stopped = true; }
}

const box = () => document.body.appendChild(document.createElement("div"));
beforeEach(() => {
  forgetSessionTerminals("s");
  usePerchStore.setState({ sessions: [{ id: "s" }] as never });
});

it("a borrowing surface moves the same terminal in and gives it back, never a second copy or a stop", () => {
  const canvas = box(), overlay = box();
  const create = vi.fn((into: HTMLElement) => new Fake(null, into));
  const placed = showTerminal("k", "s", canvas, () => create(canvas));
  const borrowed = showTerminal("k", "s", overlay, () => create(overlay), { borrow: true });
  expect(create).toHaveBeenCalledTimes(1);
  expect(borrowed.view).toBe(placed.view);
  expect(overlay.contains(placed.view.host)).toBe(true);
  expect(canvas.contains(placed.view.host)).toBe(false);

  borrowed.hide(); // the overlay closes
  expect(canvas.contains(placed.view.host)).toBe(true);
  expect(placed.view.mounted).toBe(true);
  expect((placed.view as Fake).stopped).toBe(false);
});

it("the place it came from leaving first keeps it in the borrower, which parks it on letting go", () => {
  const canvas = box(), overlay = box();
  const placed = showTerminal("k", "s", canvas, () => new Fake(null, canvas));
  const borrowed = showTerminal("k", "s", overlay, () => new Fake(null, overlay), { borrow: true });
  placed.hide(); // the canvas switched to another session
  expect(overlay.contains(placed.view.host)).toBe(true);
  expect(placed.view.mounted).toBe(true);
  borrowed.hide();
  expect(placed.view.mounted).toBe(false);
  expect((placed.view as Fake).stopped).toBe(false);
  // Shown again later, it is the same kept terminal.
  const again = showTerminal("k", "s", canvas, () => new Fake(null, canvas));
  expect(again.view).toBe(placed.view);
});

it("without borrowing, a second view of an on-screen terminal is a separate, unkept copy (a split)", () => {
  const left = box(), right = box();
  const first = showTerminal("k", "s", left, () => new Fake(null, left));
  const second = showTerminal("k", "s", right, () => new Fake(null, right));
  expect(second.view).not.toBe(first.view);
  second.hide();
  expect((second.view as Fake).stopped).toBe(true);
  expect(left.contains(first.view.host)).toBe(true);
});

it("borrowing a parked terminal shows it, and letting go parks it again", () => {
  const canvas = box(), peek = box();
  const placed = showTerminal("k", "s", canvas, () => new Fake(null, canvas));
  placed.hide();
  const borrowed = showTerminal("k", "s", peek, () => new Fake(null, peek), { borrow: true });
  expect(borrowed.view).toBe(placed.view);
  expect(peek.contains(placed.view.host)).toBe(true);
  borrowed.hide();
  expect(placed.view.mounted).toBe(false);
  expect((placed.view as Fake).stopped).toBe(false);
});

it("dropped while borrowed (the connection went, or its session was deleted), neither place brings it back", () => {
  const canvas = box(), overlay = box();
  const create = vi.fn((into: HTMLElement) => new Fake(null, into));
  const placed = showTerminal("k", "s", canvas, () => create(canvas));
  const borrowed = showTerminal("k", "s", overlay, () => create(overlay), { borrow: true });
  forgetSessionTerminals("s"); // what a disconnect does to every kept terminal: it releases the observation only
  expect((placed.view as Fake).stopped).toBe(true);
  borrowed.hide();
  placed.hide();
  expect(create).toHaveBeenCalledTimes(1);
  expect(overlay.contains(placed.view.host) || canvas.contains(placed.view.host)).toBe(false);
});

it("a view that is not kept (a remote session's) lends its one terminal to a peek and gets it back; none lent is no view", () => {
  const tab = box(), peek = box(), inner = box();
  const surface = tab.appendChild(document.createElement("div"));
  const fit = vi.fn();
  expect(borrowLentTerminal("remote", peek)).toBeNull();
  const withdraw = lendTerminal("remote", tab, surface, fit);
  const release = borrowLentTerminal("remote", peek)!;
  expect(peek.contains(surface) && !tab.contains(surface)).toBe(true);
  // A peek inside the peek takes it next and hands it back to the peek, not the tab.
  const releaseInner = borrowLentTerminal("remote", inner)!;
  expect(inner.contains(surface)).toBe(true);
  releaseInner();
  expect(peek.contains(surface)).toBe(true);
  release();
  expect(tab.contains(surface)).toBe(true);
  expect(fit).toHaveBeenCalledTimes(4);
  // The tab's view ending withdraws it: a later peek gets none, and an open one's release puts nothing back.
  const late = borrowLentTerminal("remote", peek)!;
  withdraw();
  surface.remove();
  late();
  expect(tab.contains(surface) || peek.contains(surface)).toBe(false);
  expect(borrowLentTerminal("remote", peek)).toBeNull();
});

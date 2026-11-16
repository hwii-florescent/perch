// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { claimViewer, viewerId } from "./viewer";

it("takes the id's lock even when something read the id before the claim", async () => {
  const names: string[] = [];
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: { request: vi.fn((name: string, _options: unknown, callback: (lock: unknown) => unknown) => { names.push(name); callback({}); return new Promise(() => {}); }) },
  });
  const early = viewerId(); // a store loading ahead of main.tsx's claim
  const claimed = await claimViewer();
  expect(names).toEqual([`perch.viewer.${claimed}`]);
  expect(claimed).not.toBe(early); // a window with no stored id is a new viewer, not the provisional one
  expect(sessionStorage.getItem("perch.viewerId")).toBe(claimed);
});

it("moves off an id another window holds even when something read it during the wait", async () => {
  sessionStorage.setItem("perch.viewerId", "opener");
  const held = new Set(["perch.viewer.opener"]);
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (name: string, options: { ifAvailable?: boolean }, callback: (lock: unknown) => unknown) => {
        if (!held.has(name)) { held.add(name); callback({}); return new Promise(() => {}); }
        if (options.ifAvailable) { callback(null); return Promise.resolve(); }
        return new Promise((_, reject) => setTimeout(() => { viewerId(); reject(new Error("timed out")); }, 5)); // a read while waiting
      },
    },
  });
  expect(await claimViewer()).not.toBe("opener");
  expect(sessionStorage.getItem("perch.viewerId")).not.toBe("opener");
});

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { freeName } from "./fileOps";

describe("freeName", () => {
  it("keeps a free name and numbers the copies", () => {
    expect(freeName("a.txt", new Set())).toBe("a.txt");
    expect(freeName("a.txt", new Set(["a.txt"]))).toBe("a copy.txt");
    expect(freeName("a.txt", new Set(["a.txt", "a copy.txt"]))).toBe("a copy 2.txt");
    expect(freeName(".env", new Set([".env"]))).toBe(".env copy");
    expect(freeName("dir", new Set(["dir"]))).toBe("dir copy");
  });
});

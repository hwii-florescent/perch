// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { extractPairingCode, takePairingCodeFromUrl } from "./pairing";

describe("extractPairingCode", () => {
  it("takes a bare code, spaced or lowercase", () => {
    expect(extractPairingCode(" abcd 2345\n")).toBe("ABCD2345");
  });
  it("takes the code from a link's hash or query", () => {
    expect(extractPairingCode("https://mac.tail1234.ts.net/#pair=ABCD2345")).toBe("ABCD2345");
    expect(extractPairingCode("http://192.168.1.5:7788/?x=1&pair=ABCD2345")).toBe("ABCD2345");
  });
});

describe("takePairingCodeFromUrl", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));
  it("returns the code and removes it from the address", () => {
    window.history.replaceState(null, "", "/?keep=1#pair=abcd2345");
    expect(takePairingCodeFromUrl()).toBe("ABCD2345");
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("?keep=1");
    expect(takePairingCodeFromUrl()).toBeNull();
  });
});

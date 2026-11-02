import { describe, expect, it } from "vitest";
import fixture from "../../../../crates/perch-core/src/relay/wire.fixture.json";
import { base64urlDecode, dataAad, frame, importKey, open, parseFrame, REQ_HEAD, seal } from "./wire";

const hex = (s: string) => Uint8Array.from(s.match(/../g)!.map((b) => parseInt(b, 16)));
const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

describe("relay wire", () => {
  it("seals to the bytes the Rust host expects and opens what it sealed", async () => {
    const key = await importKey(hex(fixture.key));
    const guest = hex(fixture.guestNonce);
    const host = hex(fixture.hostNonce);
    const plain = frame(REQ_HEAD, 7, new TextEncoder().encode('{"method":"GET"}'));
    const aad = dataAad(guest, host, false, 3);
    expect(toHex(await seal(key, aad, plain, hex(fixture.iv)))).toBe(fixture.sealed);
    expect(await open(key, aad, hex(fixture.sealed))).toEqual(plain);
  });

  it("refuses a frame replayed at another counter, direction or session", async () => {
    const key = await importKey(hex(fixture.key));
    const [g, h] = [hex(fixture.guestNonce), hex(fixture.hostNonce)];
    const sealed = hex(fixture.sealed);
    expect(await open(key, dataAad(g, h, false, 4), sealed)).toBeNull();
    expect(await open(key, dataAad(g, h, true, 3), sealed)).toBeNull();
    expect(await open(key, dataAad(h, g, false, 3), sealed)).toBeNull();
    expect(await open(key, dataAad(g, h, false, 3), sealed.slice(0, 20))).toBeNull();
  });

  it("parses frames and base64url keys", () => {
    expect(parseFrame(frame(9, 0xa1b2c3d4, new Uint8Array([1, 2])))).toMatchObject({ kind: 9, id: 0xa1b2c3d4 });
    expect(parseFrame(new Uint8Array(4))).toBeNull();
    expect(base64urlDecode("AAEC_w")).toEqual(new Uint8Array([0, 1, 2, 255]));
    expect(base64urlDecode("***")).toBeNull();
  });
});

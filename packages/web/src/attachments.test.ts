import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// attachments.ts pulls `getAttachmentUploadUrl` from ./base, which reads
// `window.location` — mocked out here rather than pulling in jsdom just for
// this one file, since all we need is a stable URL string.
vi.mock("./base", () => ({
  getAttachmentUploadUrl: (sessionId: string, name: string) =>
    `http://local.test/upload?sessionId=${sessionId}&name=${encodeURIComponent(name)}`,
}));

import { uploadAttachment, MAX_ATTACHMENT_BYTES } from "./attachments";

function makeFile(name: string, size: number, content = "x"): File {
  const bytes = content.repeat(Math.max(1, size)).slice(0, size);
  return new File([bytes], name, { type: "text/plain" });
}

describe("uploadAttachment", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("rejects an empty file without making a request", async () => {
    const file = makeFile("empty.txt", 0);
    await expect(uploadAttachment("s1", file)).rejects.toThrow(/empty/);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("rejects a file over the size cap without making a request", async () => {
    const file = makeFile("huge.bin", MAX_ATTACHMENT_BYTES + 1);
    await expect(uploadAttachment("s1", file)).rejects.toThrow(/25MB/);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("accepts a file exactly at the size cap", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ path: "/abs/at-cap.bin", name: "at-cap.bin" }),
    });
    const file = makeFile("at-cap.bin", MAX_ATTACHMENT_BYTES);
    const result = await uploadAttachment("s1", file);
    expect(result.path).toBe("/abs/at-cap.bin");
  });

  it("throws a status-coded error when the server responds non-ok", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 413,
      json: async () => ({}),
    });
    const file = makeFile("x.png", 10);
    await expect(uploadAttachment("s1", file)).rejects.toThrow(/413/);
  });

  it("throws when the server response has no path", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ name: "x.png" }),
    });
    const file = makeFile("x.png", 10);
    await expect(uploadAttachment("s1", file)).rejects.toThrow(/no path/);
  });

  it("falls back to the original filename when the server omits name", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ path: "/abs/x.png" }),
    });
    const file = makeFile("original.png", 10);
    const result = await uploadAttachment("s1", file);
    expect(result.name).toBe("original.png");
  });

  it("prefers the server-sanitized name when provided", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ path: "/abs/x.png", name: "sanitized.png" }),
    });
    const file = makeFile("weird name!!.png", 10);
    const result = await uploadAttachment("s1", file);
    expect(result.name).toBe("sanitized.png");
  });

  it("generates a client-side id distinct across calls", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ path: "/abs/x.png", name: "x.png" }),
    });
    const file = makeFile("x.png", 10);
    const a = await uploadAttachment("s1", file);
    const b = await uploadAttachment("s1", file);
    expect(a.id).not.toBe(b.id);
  });
});

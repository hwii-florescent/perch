import { describe, expect, it } from "vitest";
import { assetKind } from "./workspaceFileKind";

describe("assetKind", () => {
  it("maps media types to viewers and leaves text and unknown types alone", () => {
    expect(assetKind("image/svg+xml")).toBe("image");
    expect(assetKind("video/mp4")).toBe("video");
    expect(assetKind("audio/mpeg")).toBe("audio");
    expect(assetKind("application/pdf")).toBe("pdf");
    for (const archive of ["application/zip", "application/x-tar", "application/gzip"]) {
      expect(assetKind(archive)).toBe("archive");
    }
    expect(assetKind("text/plain")).toBeUndefined();
    expect(assetKind("application/pdfx")).toBeUndefined();
    expect(assetKind(undefined)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { activeMenu, applyMenuItem, fileMention, withAttachmentPaths } from "./menuTokens";

describe("activeMenu", () => {
  it("opens the command menu only at the start of a Claude message", () => {
    expect(activeMenu("/rev", 4, "claude")).toMatchObject({ kind: "command", sigil: "/", token: { start: 0, query: "rev" } });
    expect(activeMenu("see /usr/bin", 12, "claude")).toBeNull();
    expect(activeMenu("fix it /rev", 11, "claude")).toBeNull();
  });
  it("opens Codex skills anywhere a word starts", () => {
    expect(activeMenu("use $fr", 7, "codex")).toMatchObject({ kind: "command", sigil: "$", token: { start: 4, query: "fr" } });
    expect(activeMenu("echo a$b", 8, "codex")).toBeNull();
  });
  it("opens the file menu for @ in any provider, and gives other providers no command menu", () => {
    expect(activeMenu("look at @src/ma", 15, "pi")).toMatchObject({ kind: "file", token: { start: 8, query: "src/ma" } });
    expect(activeMenu("/rev", 4, "pi")).toBeNull();
    expect(activeMenu("mail a@b.c", 10, "claude")).toBeNull();
  });
  it("closes once the token is finished", () => {
    expect(activeMenu("@src/main.ts ", 13, "claude")).toBeNull();
  });
  it("prefers the token nearest the caret", () => {
    expect(activeMenu("$skill @fi", 10, "codex")).toMatchObject({ kind: "file" });
  });
});

describe("applyMenuItem", () => {
  it("completes a command with a trailing space", () => {
    const menu = activeMenu("/rev", 4, "claude")!;
    expect(applyMenuItem("/rev", menu, "review")).toEqual({ text: "/review ", caret: 8 });
  });
  it("completes a file mention in the middle of a message, quoting paths with spaces", () => {
    const text = "check @src/ma please";
    const menu = activeMenu(text, 13, "claude")!;
    expect(applyMenuItem(text, menu, "src/main.ts")).toEqual({ text: "check @src/main.ts  please", caret: 19 });
    expect(fileMention("a b.txt")).toBe('"a b.txt"');
  });
});

describe("withAttachmentPaths", () => {
  it("appends one path per line and leaves a bare message alone", () => {
    expect(withAttachmentPaths("look\n", ["/u/a.png", "/u/b.png"])).toBe("look\n/u/a.png\n/u/b.png");
    expect(withAttachmentPaths("", ["/u/a.png"])).toBe("/u/a.png");
    expect(withAttachmentPaths("hi", [])).toBe("hi");
  });
});

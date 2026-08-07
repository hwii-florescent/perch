import { describe, it, expect } from "vitest";
import {
  activeSigilToken,
  applyCommand,
  filterCommands,
  AGENT_SIGIL,
  MAX_COMMAND_SUGGESTIONS,
} from "./composerCommands";
import type { CommandEntry } from "@perch/shared";

function entry(name: string): CommandEntry {
  return { name } as CommandEntry;
}

describe("AGENT_SIGIL", () => {
  it("maps claude to / and codex to $", () => {
    expect(AGENT_SIGIL.claude).toBe("/");
    expect(AGENT_SIGIL.codex).toBe("$");
  });
});

describe("activeSigilToken", () => {
  it("finds a token at the very start of the input", () => {
    expect(activeSigilToken("/foo", 4, "/")).toEqual({ start: 0, query: "foo" });
  });

  it("finds a token starting right after whitespace", () => {
    expect(activeSigilToken("hello /foo", 10, "/")).toEqual({ start: 6, query: "foo" });
  });

  it("returns null when the sigil is mid-word (a path, not a command)", () => {
    expect(activeSigilToken("src/store.ts", 12, "/")).toBeNull();
  });

  it("returns null when there's no sigil before the caret at all", () => {
    expect(activeSigilToken("hello world", 5, "/")).toBeNull();
  });

  it("returns an empty query right after a bare sigil", () => {
    expect(activeSigilToken("/", 1, "/")).toEqual({ start: 0, query: "" });
  });

  it("returns null once whitespace has broken the token", () => {
    expect(activeSigilToken("/foo bar", 8, "/")).toBeNull();
  });

  it("uses the caret position, not the full text, to find the active token", () => {
    // Caret sits right after "/fo", before "o more text" — the token must be
    // "fo", derived from *before the caret*, not the whole string.
    expect(activeSigilToken("/foo more text", 3, "/")).toEqual({ start: 0, query: "fo" });
  });

  it("finds the nearest (last) sigil before the caret, not the first", () => {
    expect(activeSigilToken("/one /two", 9, "/")).toEqual({ start: 5, query: "two" });
  });

  it("clamps an out-of-range caret to the text length", () => {
    expect(activeSigilToken("/foo", 999, "/")).toEqual({ start: 0, query: "foo" });
  });

  it("treats a negative caret as zero", () => {
    expect(activeSigilToken("/foo", -5, "/")).toBeNull();
  });

  it("respects the codex $ sigil independently of /", () => {
    expect(activeSigilToken("hello $bar", 10, "$")).toEqual({ start: 6, query: "bar" });
    expect(activeSigilToken("hello $bar", 10, "/")).toBeNull();
  });

  it("does not treat a $ as a token start when directly preceded by a non-space char", () => {
    // "cost=$5" — the $ sits right after "=", not whitespace/start-of-input,
    // so this must not pop the popover open mid-token like a shell "$HOME".
    expect(activeSigilToken("cost=$5", 7, "$")).toBeNull();
  });
});

describe("filterCommands", () => {
  const entries = [entry("plan"), entry("planner"), entry("explain"), entry("apply-plan"), entry("Deploy")];

  it("returns everything, alphabetical, for an empty query", () => {
    const result = filterCommands(entries, "");
    expect(result.map((e) => e.name)).toEqual(["apply-plan", "Deploy", "explain", "plan", "planner"]);
  });

  it("ranks prefix matches before substring matches", () => {
    const result = filterCommands(entries, "plan");
    expect(result.map((e) => e.name)).toEqual(["plan", "planner", "apply-plan"]);
  });

  it("matches case-insensitively", () => {
    const result = filterCommands(entries, "DEPLOY");
    expect(result.map((e) => e.name)).toEqual(["Deploy"]);
  });

  it("sorts each group alphabetically", () => {
    const result = filterCommands([entry("zeta"), entry("alpha"), entry("zebra")], "");
    expect(result.map((e) => e.name)).toEqual(["alpha", "zebra", "zeta"]);
  });

  it("excludes non-matching entries", () => {
    const result = filterCommands(entries, "xyz");
    expect(result).toEqual([]);
  });

  it("caps results at MAX_COMMAND_SUGGESTIONS", () => {
    const many = Array.from({ length: MAX_COMMAND_SUGGESTIONS + 20 }, (_, i) => entry(`cmd${i}`));
    const result = filterCommands(many, "");
    expect(result.length).toBe(MAX_COMMAND_SUGGESTIONS);
  });
});

describe("applyCommand", () => {
  it("replaces the sigil token with the chosen command plus a trailing space", () => {
    const text = "hello /pl";
    const token = { start: 6, query: "pl" };
    const result = applyCommand(text, token, "/", "plan");
    expect(result.text).toBe("hello /plan ");
    expect(result.caret).toBe("hello /plan ".length);
  });

  it("preserves text after the token untouched", () => {
    // The caret's token is "/pl" (up to the caret); anything the user typed
    // beyond the caret at apply-time is tail content, left alone verbatim.
    const text = "hello /pl!!!";
    const token = { start: 6, query: "pl" };
    const result = applyCommand(text, token, "/", "plan");
    expect(result.text).toBe("hello /plan !!!");
  });

  it("works when the token is at the very end of the text", () => {
    const text = "/pl";
    const token = { start: 0, query: "pl" };
    const result = applyCommand(text, token, "/", "plan");
    expect(result.text).toBe("/plan ");
    expect(result.caret).toBe(6);
  });

  it("works with an empty query (bare sigil)", () => {
    const text = "/";
    const token = { start: 0, query: "" };
    const result = applyCommand(text, token, "/", "explain");
    expect(result.text).toBe("/explain ");
    expect(result.caret).toBe("/explain ".length);
  });

  it("uses the codex sigil when applying a codex command", () => {
    const text = "run $de";
    const token = { start: 4, query: "de" };
    const result = applyCommand(text, token, "$", "deploy");
    expect(result.text).toBe("run $deploy ");
  });
});

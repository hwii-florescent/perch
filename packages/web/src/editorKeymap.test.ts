// @vitest-environment jsdom
import { expect, it } from "vitest";
import { normalizeCombo } from "./keyCombo";
import { appCombos, bindingCombos, collidingBindings, editorKeymap, ownBindings } from "./editorKeymap";

// The editor's own Mod-s lives in CodeEditor.tsx (it needs the save callback).
const ALL = [...editorKeymap, { key: "Mod-s", run: () => true }];

it("no editor key answers to a combo the app owns, on either platform", () => {
  expect(collidingBindings(ALL)).toEqual([]);
  // Sanity: the app really has these (a vacuous pass would hide a broken normalizer).
  expect(appCombos(true).has(normalizeCombo("cmd+alt+up", true))).toBe(true);
  expect(appCombos(true).has(normalizeCombo("cmd+d", true))).toBe(true);
  // Terminal-scoped shortcuts never run in the editor: Cmd+F there is find, not the terminal's.
  expect(appCombos(true).has(normalizeCombo("cmd+f", true))).toBe(false);
});

it("the checker does catch a collision", () => {
  const split = { key: "Mod-d", run: () => true };
  const indent = { key: "Mod-[", run: () => true };
  expect(collidingBindings([split, indent])).toEqual([split, indent]);
});

it("our own bindings do not shadow, or get shadowed by, a default one", () => {
  // CodeMirror's defaults overlap each other in places (mac Ctrl-a vs Ctrl-A); that is not ours to fix.
  const defaults = ALL.filter((binding) => !ownBindings.includes(binding) && binding.key !== "Mod-s");
  for (const mac of [true, false]) {
    const taken = new Set(defaults.flatMap((binding) => bindingCombos(binding, mac)));
    for (const own of [...ownBindings, ALL[ALL.length - 1]!]) {
      for (const combo of bindingCombos(own, mac)) {
        // Escape is shared on purpose: closeSearchPanel declines when no panel is open.
        if (combo === "Escape") continue;
        expect(taken.has(combo), `${mac ? "mac" : "other"} ${combo}`).toBe(false);
      }
    }
  }
});

it("find, go to line and save are bound", () => {
  const macCombos = ALL.flatMap((binding) => bindingCombos(binding, true));
  const otherCombos = ALL.flatMap((binding) => bindingCombos(binding, false));
  for (const spec of ["cmd+f", "cmd+g", "cmd+s", "cmd+alt+f", "ctrl+g"]) expect(macCombos).toContain(normalizeCombo(spec, true));
  for (const spec of ["ctrl+f", "ctrl+s", "ctrl+h", "ctrl+g"]) expect(otherCombos).toContain(normalizeCombo(spec, false));
});

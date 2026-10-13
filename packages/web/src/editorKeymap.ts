/**
 * editorKeymap.ts — the file editor's (CodeMirror) key bindings.
 *
 * `keybinds.ts` listens on `document` for app shortcuts (panes, tabs, nests)
 * and does not look at `defaultPrevented`, so a CodeMirror binding on the same
 * combo would fire both. Every default binding that collides with an app
 * shortcut, on either platform, is therefore dropped here (`editorKeymap.test.ts`
 * proves none is left). ponytail: this checks the built-in shortcut defaults;
 * a user override in Settings > Keyboard that lands on a CodeMirror key is not
 * considered (the app shortcut still wins there only if CodeMirror ignores it).
 *
 * Find/replace/go-to-line are CodeMirror's own panels. `@codemirror/search`'s
 * whole `searchKeymap` is not spread: its Mod-d (next occurrence) is the app's
 * "split right".
 */
import { defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
import { closeSearchPanel, findNext, findPrevious, gotoLine, openSearchPanel } from "@codemirror/search";
import { openReplace, whenOpen } from "./editorSearchPanel";
import type { KeyBinding } from "@codemirror/view";
import { SHORTCUTS } from "./keybinds";
import { normalizeCombo } from "./keyCombo";

const SEARCH_SCOPE = "editor search-panel";

/** Find, replace, go to line: VS Code's keys where they don't clash with the app. */
export const ownBindings: KeyBinding[] = [
  { key: "Mod-f", run: openSearchPanel, scope: SEARCH_SCOPE },
  // Replace: the panel with its replace row unfolded (it is folded when opened with Mod-f).
  { key: "Ctrl-h", mac: "Mod-Alt-f", run: openReplace, scope: SEARCH_SCOPE },
  { mac: "Mod-Shift-f", run: openReplace, scope: SEARCH_SCOPE },
  // Next/previous match only while the panel is open: they never open it.
  { key: "F3", run: whenOpen(findNext), shift: whenOpen(findPrevious), scope: SEARCH_SCOPE, preventDefault: true },
  // macOS Cmd+G; elsewhere Ctrl+G is go to line, as in VS Code.
  { mac: "Mod-g", run: whenOpen(findNext), shift: whenOpen(findPrevious), scope: SEARCH_SCOPE, preventDefault: true },
  { key: "Ctrl-g", run: gotoLine, preventDefault: true },
  { key: "Escape", run: closeSearchPanel, scope: SEARCH_SCOPE },
];

const ARROWS: Record<string, string> = { arrowup: "up", arrowdown: "down", arrowleft: "left", arrowright: "right" };

/** A CodeMirror key ("Shift-Mod-k") as a `keyCombo.ts` spec ("shift+cmd+k"), or null for keys the
 * app has no token for (Escape, F-keys it never binds...). */
function toSpec(key: string, mac: boolean): string | null {
  const parts = key.split("-");
  const raw = parts.pop()!;
  const base = raw.toLowerCase();
  const modAlias: Record<string, string> = { mod: mac ? "cmd" : "ctrl", meta: "cmd" };
  const mods = parts.map((part) => modAlias[part.toLowerCase()] ?? part.toLowerCase());
  // CodeMirror writes Shift+letter as an uppercase letter ("Ctrl-A").
  if (/^[A-Z]$/.test(raw)) mods.push("shift");
  return [...mods, ARROWS[base] ?? base].join("+");
}

/** Every normalized combo a binding answers to on one platform (its shift variant included). */
export function bindingCombos(binding: KeyBinding, mac: boolean): string[] {
  const key = (mac ? binding.mac : binding.linux) ?? binding.key;
  if (!key) return [];
  const specs = [key, ...(binding.shift ? [`Shift-${key}`] : [])];
  return specs.flatMap((spec) => {
    try {
      const converted = toSpec(spec, mac);
      return converted ? [normalizeCombo(converted, mac)] : [];
    } catch {
      return [];
    }
  });
}

/** The app's built-in shortcut combos on one platform. */
export function appCombos(mac: boolean): Set<string> {
  const combos = new Set<string>();
  for (const shortcut of SHORTCUTS) {
    // A terminal-scoped shortcut (Cmd+F, Cmd+K...) never runs outside a terminal, and the editor is not one.
    if (shortcut.scope === "terminal") continue;
    const spec = shortcut.keys[mac ? 0 : 1];
    if (spec) combos.add(normalizeCombo(spec, mac));
  }
  return combos;
}

/** Bindings answering to a combo the app also owns, on either platform. */
export function collidingBindings(bindings: readonly KeyBinding[]): KeyBinding[] {
  const app = { mac: appCombos(true), other: appCombos(false) };
  return bindings.filter((binding) =>
    bindingCombos(binding, true).some((combo) => app.mac.has(combo))
    || bindingCombos(binding, false).some((combo) => app.other.has(combo)));
}

/** The bindings the editor is built with, before its own Mod-s (which needs the save callback). */
export const editorKeymap: KeyBinding[] = (() => {
  const base = [indentWithTab, ...historyKeymap, ...defaultKeymap];
  const drop = new Set(collidingBindings(base));
  return [...ownBindings, ...base.filter((binding) => !drop.has(binding))];
})();

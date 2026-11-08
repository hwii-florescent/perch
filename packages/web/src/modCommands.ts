import { placeFloat, resetLayoutState, resizeNode, showStackChild, toggleNode } from "./layoutState";
import { cloneMod, currentMods, openMod, setLayout } from "./mods";
import { bindKey, runCommand, setPanesSource, setTerminalReader } from "./modApp";
import { terminalText } from "./xtermSetup";
import { focusedSplit, getPaneController, openModTab, splitActiveTab } from "./tiledPanes";
import { currentTabs, entryLabel } from "./workspaceTabs";
import { zoomIn, zoomOut, zoomReset } from "./zoom";
import { tauriInvoke } from "./links";
import { usePerchStore } from "./store";

/** App commands that take arguments, for `api.run(id, args)` (keys cannot run these, so they are not
 * in the keybinding table). Add one here and it is listed by `api.commands()` and the guide. */
const needsId = (args: unknown): string => {
  const id = (args as { id?: unknown } | null | undefined)?.id;
  if (typeof id !== "string" || !id) throw new Error('This command needs {id: "…"}.');
  return id;
};

/** The desktop window's own controls, for a layout that hides the system title bar and draws its own. */
const windowControl = (action: string) => () => {
  if (!tauriInvoke) throw new Error("The window controls are in the desktop app.");
  void tauriInvoke(`plugin:window|${action}`, { label: "main" });
};

/** A command that cannot answer at once (the core is asked): its failure shows as a toast. */
const later = (work: (args: unknown) => Promise<unknown>) => (args: unknown) => {
  void work(args).catch((error: unknown) =>
    usePerchStore.setState((s) => ({ toasts: [...s.toasts, { id: crypto.randomUUID(), sessionId: "mod:app", title: error instanceof Error ? error.message : String(error), level: "error" as const, kind: "usage" as const }] })));
};
const word = (args: unknown, key: string): string | undefined => {
  const value = (args as Record<string, unknown> | null | undefined)?.[key];
  return typeof value === "string" && value ? value : undefined;
};
const direction = (args: unknown) => {
  const d = word(args, "direction");
  if (d !== "left" && d !== "right" && d !== "up" && d !== "down") throw new Error('This command needs {direction: "left" | "right" | "up" | "down"}.');
  return d;
};
/** `layout.switch {name?}`: the named layout, or the next one (after the last, Perch as shipped). */
const switchLayout = later(async (args) => {
  const state = currentMods();
  const names = (state?.layouts ?? []).filter((l) => l.root).map((l) => l.id);
  const wanted = word(args, "name");
  if (wanted && wanted !== "stock" && !names.includes(wanted)) throw new Error(`No layout "${wanted}" (layouts: ${names.join(", ") || "none"}).`);
  const order = [...names, ""];
  const next = wanted ? (wanted === "stock" ? "" : wanted) : order[(order.indexOf(state?.layout ?? "") + 1) % order.length]!;
  await setLayout(next || null);
});
/** `layout.clone` and `mod.clone` copy as `<name>-copy` or `as`; a cloned layout is shown at once. */
const clone = (layout: boolean) => later(async (args) => {
  const name = word(args, "name");
  if (!name) throw new Error('This command needs {name: "…"}.');
  const made = await cloneMod(name, word(args, "as"));
  if (layout) await setLayout(made);
});

setTerminalReader(terminalText);
setPanesSource(() => {
  const { tabs, activeId } = currentTabs();
  const shown = new Set(focusedSplit()?.ids ?? [activeId]);
  return tabs.filter((entry) => shown.has(entry.id)).map((entry) => ({
    id: entry.id,
    kind: entry.kind === "session" ? "session" : entry.tab.kind ?? "file",
    title: entryLabel(entry),
    ...(entry.kind === "resource" && entry.tab.mod ? { mod: entry.tab.mod } : {}),
    focused: entry.id === activeId,
  }));
});

function openModOrThrow(mod: string, args: unknown, side?: "right" | "below") {
  if (!currentMods()?.mods.some((candidate) => candidate.id === mod && candidate.enabled && !candidate.error)) throw new Error(`No working mod named ${mod}.`);
  const props = (args as { props?: unknown }).props;
  if (props !== undefined && (typeof props !== "object" || props === null || Array.isArray(props))) throw new Error("props is an object.");
  if (!openModTab(mod, props as Record<string, unknown> | undefined, side)) throw new Error("Open a project first.");
}

export const TYPED_COMMANDS: Record<string, { description: string; args: string; run: (args: unknown) => void }> = {
  "session.open": { description: "Go to a session", args: "{id}", run: (args) => usePerchStore.getState().switchSession(needsId(args)) },
  "session.close": { description: "Delete a session", args: "{id}", run: (args) => usePerchStore.getState().deleteSession(needsId(args)) },
  "project.focus": { description: "Focus a project", args: "{id}", run: (args) => usePerchStore.getState().focusWorkspaceProject(needsId(args)) },
  "layout.toggle": { description: "Hide or show a node of the shown layout", args: "{id, hidden?}", run: toggleNode },
  "layout.float": { description: "Move a floating node to an edge and place along it (no edge puts it back)", args: "{id, edge?, align?}", run: placeFloat },
  "layout.show": { description: "Show a node of the shown layout", args: "{id}", run: (args) => toggleNode({ id: word(args, "id"), hidden: false }) },
  "layout.hide": { description: "Hide a node of the shown layout", args: "{id}", run: (args) => toggleNode({ id: word(args, "id"), hidden: true }) },
  "layout.select": { description: "Show one child of a layout's stack", args: "{stack, child}", run: showStackChild },
  "layout.resize": { description: "Give a node of the shown layout a size", args: "{id, px | weight}", run: resizeNode },
  "layout.reset": { description: "Forget the clicks on the shown layout (sizes, hidden nodes, picks, float spots)", args: "{}", run: () => resetLayoutState() },
  "layout.switch": { description: "Show the named layout, or the next one", args: "{name?}", run: switchLayout },
  "layout.clone": { description: "Copy a layout and show the copy", args: "{name, as?}", run: clone(true) },
  "mod.clone": { description: "Copy a mod (or an example) as <name>-copy or `as`", args: "{name, as?}", run: clone(false) },
  "key.bind": { description: "Set the key of a command (keys null: back to its default, \"\": none)", args: "{command, keys}", run: (args) => { const { command, keys } = (args ?? {}) as { command?: unknown; keys?: unknown }; if (typeof command !== "string" || !(keys === null || typeof keys === "string")) throw new Error("key.bind needs {command: <id>, keys: \"cmd+shift+y\" | \"\" | null}."); bindKey(command, keys); } },
  "mod.open": { description: "Show a mod's overlay", args: "{name}", run: (args) => openMod(word(args, "name") ?? needsId(args)) },
  "app.theme": { description: "Choose a theme by name", args: "{name}", run: (args) => usePerchStore.getState().updateSettings({ theme: word(args, "name") ?? "" }) },
  "app.zoom_in": { description: "Zoom in", args: "{}", run: () => zoomIn() },
  "app.zoom_out": { description: "Zoom out", args: "{}", run: () => zoomOut() },
  "app.zoom_reset": { description: "Zoom back to 100%", args: "{}", run: () => zoomReset() },
  "tab.new": { description: "A new tab; with `mod`, a tab that shows that mod (props reach it as props())", args: "{mod?, props?}", run: (args) => { const mod = word(args, "mod"); if (mod) openModOrThrow(mod, args); else void runCommand("tabs.new"); } },
  "tab.next": { description: "The next tab", args: "{}", run: () => void runCommand("tabs.next") },
  "tab.prev": { description: "The previous tab", args: "{}", run: () => void runCommand("tabs.prev") },
  "tab.close": { description: "Close the tab", args: "{}", run: () => void runCommand("tabs.close") },
  "pane.split": { description: "Split the tab with a new terminal pane, or with `mod`, a pane that shows that mod", args: "{direction: right | down, mod?, props?}", run: (args) => { const side = word(args, "direction") === "down" ? "below" : "right"; const mod = word(args, "mod"); if (mod) openModOrThrow(mod, args, side); else splitActiveTab(side); } },
  "pane.zoom": { description: "Zoom the focused pane (again: back)", args: "{}", run: () => getPaneController()?.toggleMaximizeActive() },
  "pane.go": { description: "Focus the neighbouring pane", args: "{direction}", run: (args) => getPaneController()?.focusPaneDirection?.(direction(args)) },
  "pane.swap": { description: "Swap the focused pane with its neighbour", args: "{direction}", run: (args) => getPaneController()?.swapPaneDirection?.(direction(args)) },
  "window.minimize": { description: "Minimize the desktop window", args: "{}", run: windowControl("minimize") },
  "window.maximize": { description: "Maximize or restore the desktop window", args: "{}", run: windowControl("toggle_maximize") },
  "window.close": { description: "Close the desktop window", args: "{}", run: windowControl("close") },
  "layout.stack": { description: "Show one child of a layout's stack", args: "{stack, child}", run: showStackChild },
  "workspace.focus": { description: "Focus a workspace", args: "{id}", run: (args) => usePerchStore.getState().focusWorkspace(needsId(args)) },
};

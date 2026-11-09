import { placeFloat, resetLayoutState, resizeNode, showStackChild, toggleNode } from "./layoutState";
import { cloneMod, currentMods, openMod, setLayout } from "./mods";
import { bindKey, inAgentOrder, runCommand, setKeptTerminalsSource, setPanesSource, setTerminalReader } from "./modApp";
import { keptTerminals } from "./terminalKeeper";
import { pasteIntoTerminal, scrollTerminal, terminalSelection, terminalText } from "./xtermSetup";
import { closeTopOverlay, modUi } from "./modUi";
import { writeTextFile } from "./modHost";
import { closeTab, exitSplit, focusedSplit, getPaneController, openModTab, splitActiveTab } from "./tiledPanes";
import { useSplitSets } from "./splitSets";
import { activateTab, currentTabs, entryLabel, moveChat } from "./workspaceTabs";
import { zoomIn, zoomOut, zoomReset } from "./zoom";
import { tauriInvoke } from "./links";
import { useFileTabs } from "./fileTabs";
import { isPinned, setPinned, setTerminalOrder } from "./pinnedTerminals";
import { runInWorkspace } from "./runs";
import { usePerchStore } from "./store";
import { orderProjects, writeScope } from "./sidebarOrder";
import { requestCloseSession } from "./closeGuard";
import { moveBeside } from "./tabOrder";
import { navigateToWorkspace, newScratchpad } from "./workspaceNav";

/** App commands that take arguments, for `api.run(id, args)` (keys cannot run these, so they are not
 * in the keybinding table). Add one here and it is listed by `api.commands()` and the guide. */
const needsId = (args: unknown): string => {
  const id = (args as { id?: unknown } | null | undefined)?.id;
  if (typeof id !== "string" || !id) throw new Error('This command needs {id: "…"}.');
  return id;
};

/** A session this page knows, named by `{terminal}` or `{id}`; the peek/keep/park commands act on no other. */
const knownSession = (args: unknown): string => {
  const id = word(args, "terminal") ?? needsId(args);
  if (!usePerchStore.getState().sessions.some((session) => session.id === id)) throw new Error(`There is no session ${id} on this page.`);
  return id;
};

// Peeks: a session's own view over the app for a moment, one per session. Its terminal is borrowed (`BorrowTerminals`):
// it moves into the peek and back, the same process and input/size owner. Closing a peek never stops anything.
const peekSurfaces = new Set<() => void>();
const peekUi = modUi("terminal-peek", peekSurfaces);
const peeks = new Map<string, () => void>();
/** Closes `id`'s peek; false when it has none open. */
function closePeek(id: string): boolean {
  const close = peeks.get(id);
  peeks.delete(id);
  if (!close || !peekSurfaces.has(close)) return false;
  close();
  return true;
}

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
setKeptTerminalsSource(keptTerminals);
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

/** The tab named by `{id}` (default: the one shown). A pane of a tab strip is a tab here. */
const tabOf = (args: unknown, key = "id") => {
  const { tabs, activeId } = currentTabs();
  const id = word(args, key) ?? activeId;
  const entry = tabs.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`No tab ${id ?? "shown"}.`);
  return { entry, tabs };
};
const sessionTab = (args: unknown) => {
  const { entry, tabs } = tabOf(args);
  if (entry.kind !== "session") throw new Error("Only a session's tab can be renamed or moved.");
  return { entry, tabs };
};
/** The terminal on screen named by `{terminal}` (a terminal or session id), else the one with the keyboard, else the first. */
const terminalOnScreen = (args: unknown): Element => {
  const id = word(args, "terminal");
  const quoted = id && CSS.escape(id);
  const found = id
    ? document.querySelector(`[data-terminal-id="${quoted}"], [data-session-id="${quoted}"][data-terminal-id]`)
    : document.activeElement?.closest("[data-terminal-id]") ?? document.querySelector("[data-terminal-id]");
  if (!found) throw new Error(id ? `Terminal ${id} is not on screen.` : "No terminal is on screen.");
  return found;
};
const numberArg = (args: unknown, key: string) => {
  const value = (args as Record<string, unknown> | null | undefined)?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};
/** `agent.next` / `agent.prev`: the next session that is an agent (not a plain terminal), wrapping round. */
const stepAgent = (step: 1 | -1) => () => {
  const { sessions, sessionId, switchSession } = usePerchStore.getState();
  const agents = inAgentOrder(sessions.filter((session) => session.cliProviderId !== "terminal"));
  if (!agents.length) throw new Error("There are no agents.");
  const at = agents.findIndex((session) => session.id === sessionId);
  switchSession(agents[(at + step + agents.length) % agents.length]!.id);
};
const sessionsByTab = (id: string) => usePerchStore.getState().sessions.find((session) => session.id === id)?.id;

/** The core answers a run before it pushes the new session; show the session once the store lists it (a session the core never lists is dropped after 10 s). */
const showWhenListed = (id: string) => {
  // As the Navigator's Run does: mark the terminal started, show the session strip, then the session.
  usePerchStore.getState().startCli(id, "terminal");
  const show = () => { useFileTabs.getState().showSession(); usePerchStore.getState().switchSession(id); };
  const listed = () => usePerchStore.getState().sessions.some((session) => session.id === id);
  if (listed()) return show();
  const stop = usePerchStore.subscribe(() => {
    if (!listed()) return;
    stop();
    clearTimeout(timer);
    show();
  });
  const timer = setTimeout(stop, 10_000);
};

/** Validate `{argv, task?}` now; the returned start runs that program in a workspace and shows its terminal. */
const programIn = (args: unknown) => {
  const argv = (args as { argv?: unknown } | null)?.argv;
  if (!Array.isArray(argv) || !argv.length || argv.some((part) => typeof part !== "string" || !part)) throw new Error("argv is a list of strings: [program, ...arguments].");
  const quote = (part: string) => `'${part.replace(/'/g, "'\\''")}'`;
  const command = [...argv as string[], ...(word(args, "task") ? [word(args, "task")!] : [])].map(quote).join(" ");
  return async (workspaceId: string) => showWhenListed(await runInWorkspace(workspaceId, command));
};

/** The projects of the computer on screen, in the order the sidebar shows them. */
const projectsOnScreen = () => {
  const { workspaceProjects, activeHostId, workspaceOrderByHost } = usePerchStore.getState();
  return orderProjects(workspaceProjects.filter((project) => project.hostId === activeHostId), workspaceOrderByHost?.[activeHostId]?.projects);
};
/** Show the project `step` away from the shown one (wrapping), or the one at `index` (1 = first) or named by `id`. */
const stepProject = (step: number) => () => {
  const projects = projectsOnScreen();
  if (!projects.length) throw new Error("There are no projects.");
  const at = projects.findIndex((project) => project.id === usePerchStore.getState().activeProjectId);
  usePerchStore.getState().focusWorkspaceProject(projects[(at + step + projects.length) % projects.length]!.id);
};

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
  "tab.new": { description: "A new tab; with `mod`, a tab that shows that mod (props reach it as props()); with `argv`, a terminal running that program (an agent from knownAgents().run) in the shown workspace, `task` as its last argument (most agents take it as the first message)", args: "{mod?, props?, argv?: string[], task?}", run: (args) => {
    const mod = word(args, "mod");
    if (mod) return openModOrThrow(mod, args);
    if ((args as { argv?: unknown } | null)?.argv === undefined) return void runCommand("tabs.new");
    if (!usePerchStore.getState().activeWorkspaceId) throw new Error("Open a project first.");
    const start = programIn(args);
    later(async () => start(usePerchStore.getState().activeWorkspaceId!))(undefined);
  } },
  "tab.next": { description: "The next tab", args: "{}", run: () => void runCommand("tabs.next") },
  "tab.prev": { description: "The previous tab", args: "{}", run: () => void runCommand("tabs.prev") },
  // With an id these act on that tab, shown or not; a session closes through the same guard as its × (owner stop).
  "tab.close": { description: "Close a tab: the one named by {id}, else the shown one", args: "{id?}", run: (args) => (word(args, "id") ? closeTab(tabOf(args).entry.id) : void runCommand("tabs.close")) },
  "tab.pin": { description: "Keep a previewed file's tab (single-click previews are replaced by the next one)", args: "{id}", run: (args) => { const { entry } = tabOf(args); if (entry.kind === "resource") useFileTabs.getState().pin(entry.id); } },
  "tab.menu": { description: "Open a tab's menu (split, zoom, rename, close) at a point of the window", args: "{id, x, y}", run: (args) => {
    const [x, y] = [numberArg(args, "x"), numberArg(args, "y")];
    if (x === undefined || y === undefined) throw new Error("This command needs {id, x, y}.");
    useSplitSets.getState().openMenu(tabOf(args).entry.id, x, y);
  } },
  "pane.unsplit": { description: "Take a tab out of its split and show it full size (its tab stays)", args: "{id}", run: (args) => exitSplit(tabOf(args).entry.id) },
  "pane.split": { description: "Split the tab with a new terminal pane, or with `mod`, a pane that shows that mod", args: "{direction: right | down, mod?, props?}", run: (args) => { const side = word(args, "direction") === "down" ? "below" : "right"; const mod = word(args, "mod"); if (mod) openModOrThrow(mod, args, side); else splitActiveTab(side); } },
  "pane.zoom": { description: "Zoom the focused pane (again: back)", args: "{}", run: () => getPaneController()?.toggleMaximizeActive() },
  "pane.go": { description: "Focus the neighbouring pane", args: "{direction}", run: (args) => getPaneController()?.focusPaneDirection?.(direction(args)) },
  "pane.swap": { description: "Swap the focused pane with its neighbour", args: "{direction}", run: (args) => getPaneController()?.swapPaneDirection?.(direction(args)) },
  "tab.select": { description: "Show a tab by its number (1 is first) or id", args: "{index | id}", run: (args) => {
    const index = numberArg(args, "index");
    const { tabs } = currentTabs();
    const entry = index !== undefined ? tabs[index - 1] : tabOf(args).entry;
    if (!entry) throw new Error(`No tab ${index}: there are ${tabs.length}.`);
    activateTab(entry);
  } },
  "tab.rename": { description: "Rename a session's tab (empty: its own title again)", args: "{id?, name}", run: (args) => {
    const name = (args as { name?: unknown } | null)?.name;
    if (typeof name !== "string") throw new Error('This command needs {name: "…"}.');
    usePerchStore.getState().renameSession(sessionTab(args).entry.id, name);
  } },
  "tab.move": { description: "Move a session's tab to a number in the strip (1 is first)", args: "{id?, index}", run: (args) => {
    const index = numberArg(args, "index");
    const { entry, tabs } = sessionTab(args);
    const target = index !== undefined ? tabs[index - 1] : undefined;
    if (!target) throw new Error(`This command needs {index: 1-${tabs.length}}.`);
    if (target.id !== entry.id) moveChat(entry.id, target.id, tabs.indexOf(entry) < tabs.indexOf(target), tabs.map((tab) => tab.id));
  } },
  "pane.close": { description: "Close a pane (its tab): the one named by {id}, else the focused one", args: "{id?}", run: (args) => (word(args, "id") ? closeTab(tabOf(args).entry.id) : void runCommand("tabs.close")) },
  "pane.focus": { description: "Focus a pane by id, or the pane of a terminal", args: "{pane | terminal}", run: (args) => {
    if (word(args, "pane")) return activateTab(tabOf(args, "pane").entry);
    const session = terminalOnScreen(args).getAttribute("data-session-id");
    if (!session || !sessionsByTab(session)) throw new Error("That terminal has no pane to focus.");
    usePerchStore.getState().switchSession(session);
  } },
  "terminal.kill": { description: "Stop a terminal's process (the one on screen with the keyboard if none is named)", args: "{terminal?}", run: (args) => {
    const id = terminalOnScreen(args).getAttribute("data-terminal-id");
    if (!id) throw new Error("That terminal is still opening.");
    usePerchStore.getState().killTerminal(id);
  } },
  "terminal.pin": { description: "Pin or unpin a terminal on this device: {terminal} is a session id from terminals() (or one on screen); with none, the one with the keyboard. agents() and terminals() report it; Perch's own views do not order by it", args: "{terminal?, pinned?}", run: (args) => {
    const named = word(args, "terminal");
    const id = named && usePerchStore.getState().sessions.some((session) => session.id === named) ? named : terminalOnScreen(args).getAttribute("data-session-id");
    if (!id) throw new Error("That terminal is still opening.");
    const pinned = (args as { pinned?: unknown } | null)?.pinned;
    if (pinned !== undefined && typeof pinned !== "boolean") throw new Error("{pinned} is true or false.");
    setPinned(id, pinned ?? !isPinned(id));
  } },
  // Presentation only: none of these starts, stops or restarts a process (perchd keeps every terminal running).
  "terminal.show": { description: "Go to a terminal's session, as its tab would", args: "{terminal | id}", run: (args) => usePerchStore.getState().switchSession(word(args, "terminal") ?? needsId(args)) },
  "terminal.peek": { description: "Show a session's own view over the app for a moment, without going to it: its terminal moves in and back, still running. A click outside, Esc (unless the terminal has the keyboard: then Esc is the program's), terminal.park or terminal.peek again closes it", args: "{terminal | id}", run: (args) => {
    const id = knownSession(args);
    if (closePeek(id)) return;
    peeks.set(id, peekUi.overlay({ layout: { type: "block", content: `session:${id}` } }));
  } },
  "terminal.keep": { description: "Keep a session where it is meant to be: close its peek and go to its tab", args: "{terminal | id}", run: (args) => {
    const id = knownSession(args);
    closePeek(id);
    usePerchStore.getState().switchSession(id);
  } },
  ...Object.fromEntries(["park", "unkeep"].map((verb) => [`terminal.${verb}`, { description: "Put away a session's peek: its terminal goes back where it was (or off screen) and keeps running. A session's own tab stays until it is closed", args: "{terminal | id}", run: (args: unknown) => {
    const id = knownSession(args);
    if (!closePeek(id)) throw new Error(`${id} has no peek to put away; its tab stays until it is closed, and parking never stops it.`);
  } }])),
  "terminal.order": { description: "Set the order of sessions for a mod's own list, kept on this device: {ids} (session ids); [] goes back to the app's order. agents() and terminals() report it; agent.next and agent.prev follow it", args: "{ids}", run: (args) => setTerminalOrder((args as { ids?: unknown } | null)?.ids) },
  "terminal.scroll": { description: "Move the view of a terminal's history, not the program: lines or pages (negative: toward history), or to top | bottom", args: "{lines | pages | to, terminal?}", run: (args) => {
    const to = word(args, "to");
    if (to !== undefined && to !== "top" && to !== "bottom") throw new Error('{to} is "top" or "bottom".');
    const by = { lines: numberArg(args, "lines"), pages: numberArg(args, "pages"), to } as Parameters<typeof scrollTerminal>[1];
    if (by.lines === undefined && by.pages === undefined && !to) throw new Error("This command needs {lines}, {pages} or {to}.");
    scrollTerminal(terminalOnScreen(args), by);
  } },
  "terminal.copy": { description: "Copy the terminal's selected text to the clipboard", args: "{terminal?}", run: later(async (args) => {
    const text = terminalSelection(terminalOnScreen(args));
    if (!text) throw new Error("Nothing is selected in that terminal.");
    await navigator.clipboard.writeText(text);
  }) },
  "terminal.paste": { description: "Paste the clipboard's text into a terminal", args: "{terminal?}", run: later(async (args) => {
    const text = await navigator.clipboard.readText();
    if (!text) throw new Error("The clipboard has no text.");
    pasteIntoTerminal(terminalOnScreen(args), text);
  }) },
  "overlay.close": { description: "Close the top dialog or popup a mod opened (windows stay until their own close)", args: "{}", run: () => void closeTopOverlay() },
  "project.new": { description: "Add a folder as a project and show it; with `argv` (and `task`), run that program in the new project once it is added", args: "{folder, name?, argv?: string[], task?}", run: (args) => {
    const folder = word(args, "folder");
    if (!folder) throw new Error('This command needs {folder: "/path"}.');
    const start = (args as { argv?: unknown }).argv === undefined ? undefined : programIn(args);
    const known = new Set(usePerchStore.getState().workspaceProjects.map((project) => project.id));
    const requestId = usePerchStore.getState().createWorkspaceProject(folder, word(args, "name"));
    if (!requestId) throw new Error(`Cannot add ${folder} as a project.`);
    const fail = (why: string) => later(async () => { throw new Error(`${why}: ${folder} was not ${start ? "started" : "shown"}.`); })(undefined);
    const stop = usePerchStore.subscribe((state) => {
      const made = state.workspaceProjectCreate;
      if (made?.requestId !== requestId || made.status === "pending") return;
      stop();
      clearTimeout(timer);
      // A successful add does not move focus; the new project is the one that was not listed before (or has the path), as the folder picker finds it.
      const created = state.workspaceProjects.find((project) => project.hostId === made.hostId && !known.has(project.id))
        ?? state.workspaceProjects.find((project) => project.hostId === made.hostId && project.path === made.path);
      if (made.status !== "success" || !created) return fail(made.error ?? "The project could not be added");
      state.focusWorkspaceProject(created.id);
      if (!start) return;
      const workspaceId = usePerchStore.getState().activeWorkspaceId;
      if (workspaceId) later(() => start(workspaceId))(undefined);
      else fail("The new project has no workspace");
    });
    const timer = setTimeout(() => { stop(); fail("The project was not added in time"); }, 30_000);
  } },
  "project.select": { description: "Show a project by position (1 = first, as the sidebar orders them) or id", args: "{index | id}", run: (args) => {
    const index = numberArg(args, "index");
    const project = index !== undefined ? projectsOnScreen()[index - 1] : projectsOnScreen().find((candidate) => candidate.id === word(args, "id"));
    if (!project) throw new Error(index !== undefined ? `There is no project ${index}.` : "This command needs {index} or {id}.");
    usePerchStore.getState().focusWorkspaceProject(project.id);
  } },
  "project.next": { description: "Show the next project", args: "{}", run: stepProject(1) },
  "project.prev": { description: "Show the previous project", args: "{}", run: stepProject(-1) },
  "project.close": { description: "Delete a project and end its sessions (the folder stays on disk); asks nothing, so it needs {confirmed: true}", args: "{id, confirmed: true}", run: (args) => {
    const id = needsId(args);
    if ((args as { confirmed?: unknown }).confirmed !== true) throw new Error("This ends the project's agents and shells: pass {confirmed: true} to go ahead.");
    if (!usePerchStore.getState().workspaceProjects.some((project) => project.id === id)) throw new Error(`There is no project ${id}.`);
    usePerchStore.getState().removeWorkspaceProject(id);
  } },
  "terminal.open": { description: "Start a terminal: as a new tab (place \"tab\", the default), or to the \"right\" or \"down\" of the focused pane", args: "{place?: tab | right | down}", run: (args) => {
    const place = word(args, "place") ?? "tab";
    if (place === "tab") return void runCommand("tabs.new");
    if (place !== "right" && place !== "down") throw new Error('{place} is "tab", "right" or "down".');
    splitActiveTab(place === "down" ? "below" : "right");
  } },
  "layout.set": { description: "Replace the shown layout's tree (the file layouts/<name>.json; it reloads at once). A layout must be shown: layout.switch first", args: "{layout: {type, children, ...}}", run: (args) => {
    const tree = (args as { layout?: unknown } | null)?.layout;
    const state = currentMods();
    if (typeof tree !== "object" || tree === null || Array.isArray(tree) || typeof (tree as { type?: unknown }).type !== "string") throw new Error('This command needs {layout: {type: "column" | "row" | …, …}}.');
    if (!state?.layout || !state.folder) throw new Error("No layout is shown: choose one with layout.switch first.");
    const text = JSON.stringify(tree, null, 2);
    if (text.length > 256 * 1024) throw new Error("A layout is at most 256 KiB.");
    // layouts/ sits beside mods/ in the folder that holds it.
    later(() => writeTextFile(`${state.folder.replace(/[\\/]mods[\\/]?$/, "")}/layouts/${state.layout}.json`, text))(undefined);
  } },
  "agent.focus": { description: "Show an agent's session", args: "{terminal | id}", run: (args) => usePerchStore.getState().switchSession(word(args, "terminal") ?? needsId(args)) },
  "agent.next": { description: "The next agent's session", args: "{}", run: stepAgent(1) },
  "agent.prev": { description: "The previous agent's session", args: "{}", run: stepAgent(-1) },
  "session.rename": { description: "Rename a session", args: "{id, name}", run: (args) => usePerchStore.getState().renameSession(needsId(args), word(args, "name") ?? "") },
  "workspace.rename": { description: "Rename a workspace", args: "{id, name}", run: (args) => usePerchStore.getState().renameWorkspace(needsId(args), word(args, "name") ?? "") },
  "project.rename": { description: "Rename a project", args: "{id, name}", run: (args) => usePerchStore.getState().renameWorkspaceProject(needsId(args), word(args, "name") ?? "") },
  "app.settings": { description: "Open Settings", args: "{}", run: () => usePerchStore.getState().setSettingsOpen(true) },
  "app.help": { description: "Show the keybind help", args: "{}", run: () => void runCommand("global.help") },
  "app.palette": { description: "Open the Navigator (jump to any session or project)", args: "{}", run: () => void runCommand("global.navigator") },
  "window.minimize": { description: "Minimize the desktop window", args: "{}", run: windowControl("minimize") },
  "window.maximize": { description: "Maximize or restore the desktop window", args: "{}", run: windowControl("toggle_maximize") },
  "window.close": { description: "Close the desktop window", args: "{}", run: windowControl("close") },
  "layout.stack": { description: "Show one child of a layout's stack", args: "{stack, child}", run: showStackChild },
  "workspace.focus": { description: "Focus a workspace", args: "{id}", run: (args) => usePerchStore.getState().focusWorkspace(needsId(args)) },
  // Navigation (the sidebar and its clones). Each names its target, as a row does, shown or not.
  "session.request_close": { description: "Close a session as its × does: an agent you started asks first (Settings), one you only watch leaves this view", args: "{id}", run: (args) => requestCloseSession(sessionOf(args)) },
  "session.move": { description: "Move a session beside another in the order the core keeps for every screen; `siblings` are the ids of their group in strip order", args: "{id, target, after, siblings}", run: (args) => {
    const siblings = (args as { siblings?: unknown }).siblings;
    if (!Array.isArray(siblings) || siblings.some((id) => typeof id !== "string")) throw new Error("This command needs {siblings: [ids…]}.");
    moveChat(sessionOf(args), sessionOf(args, "target"), (args as { after?: unknown }).after === true, siblings as string[]);
  } },
  "project.move": { description: "Move a project beside another in the order the core keeps for every screen", args: "{id, target, after}", run: (args) => {
    const project = projectOf(args);
    const target = projectOf(args, "target");
    const state = usePerchStore.getState();
    const order = state.workspaceOrderByHost[project.hostId]?.projects;
    const ids = orderProjects(state.workspaceProjects.filter((p) => p.hostId === project.hostId).sort((a, b) => (a.favorite !== b.favorite ? (a.favorite ? -1 : 1) : b.updatedAt - a.updatedAt)), order).map((p) => p.id);
    state.setWorkspaceOrder(project.hostId, { projects: writeScope(order, moveBeside(ids, project.id, target.id, (args as { after?: unknown }).after === true)) });
  } },
  "workspace.open": { description: "Show a workspace: its last viewed session, else its start screen", args: "{id}", run: (args) => navigateToWorkspace(workspaceOf(args).id) },
  "workspace.pin": { description: "Pin or unpin a workspace (pinned ones list first)", args: "{id, pinned}", run: (args) => usePerchStore.getState().pinWorkspace(workspaceOf(args).id, (args as { pinned?: unknown }).pinned !== false) },
  "workspace.hide": { description: "Hide a linked worktree from the sidebar, or show it again", args: "{id, hidden}", run: (args) => usePerchStore.getState().setWorkspaceHidden(workspaceOf(args).id, (args as { hidden?: unknown }).hidden !== false) },
  "workspace.restore": { description: "Wake a sleeping workspace", args: "{id}", run: (args) => usePerchStore.getState().restoreWorkspace(workspaceOf(args).id) },
  // A remote host's checkout may be known only by its sessions' workspace id, so these take any id.
  "workspace.files": { description: "Open a workspace's files in the drawer", args: "{id}", run: (args) => usePerchStore.getState().openWorkspaceFiles(needsId(args)) },
  "workspace.git": { description: "Open a workspace's Git and review", args: "{id}", run: (args) => usePerchStore.getState().openWorkspaceGitReview(needsId(args)) },
  "worktree.remove": { description: "Ask to delete a linked worktree (its worktree menu confirms and guards the removal)", args: "{id}", run: (args) => {
    const workspace = workspaceOf(args);
    const project = usePerchStore.getState().workspaceProjects.find((p) => p.id === workspace.projectId);
    if (!workspace.parentWorkspaceId || !project?.repoPath) throw new Error("Only a linked worktree of a git project can be deleted.");
    usePerchStore.getState().requestWorktreeMenu(`${project.hostId}:${project.repoPath}`, { path: workspace.path, branch: workspace.branch || undefined });
  } },
  ...Object.fromEntries((["cancel", "retry", "dismiss"] as const).map((verb) => [`worktree.${verb}`, { description: { cancel: "Stop making a worktree", retry: "Try a failed worktree again", dismiss: "Forget a failed worktree" }[verb], args: "{id}", run: (args: unknown) => {
    const id = needsId(args);
    const state = usePerchStore.getState();
    if (!state.worktreeJobs.some((job) => job.jobId === id)) throw new Error(`There is no worktree job ${id}.`);
    ({ cancel: state.cancelWorktreeJob, retry: state.retryWorktreeJob, dismiss: state.dismissWorktreeJob })[verb](id);
  } }])),
  "host.select": { description: "Show a host's projects and sessions (\"local\" is this computer)", args: "{id}", run: (args) => usePerchStore.getState().setActiveHost(hostOf(args)) },
  "host.enable": { description: "Turn a configured host on or off, as its Settings switch does", args: "{id, enabled}", run: (args) => {
    const id = hostOf(args);
    const entry = usePerchStore.getState().hosts.find((h) => h.id === id);
    if (!entry) throw new Error("This computer cannot be turned off.");
    usePerchStore.getState().upsertHost({ ...entry, enabled: (args as { enabled?: unknown }).enabled !== false });
  } },
  "host.refresh": { description: "Ask a host for its projects and workspaces again", args: "{id}", run: (args) => usePerchStore.getState().fetchWorkspaceSnapshot(hostOf(args)) },
  "folder.select": { description: "Show a folder's sessions, on a host without projects", args: "{cwd, host?}", run: (args) => {
    const cwd = word(args, "cwd");
    if (!cwd) throw new Error('This command needs {cwd: "/path"}.');
    usePerchStore.getState().setActiveProject(word(args, "host") ?? usePerchStore.getState().activeHostId, cwd);
  } },
  "quickchat.new": { description: "A new chat in Quickchat: its start screen, or the agent set for empty workspaces", args: "{}", run: () => newScratchpad() },
};

/** The session, project, workspace or host named by `{key}`; a missing one throws, so a command never acts on another. */
function sessionOf(args: unknown, key = "id"): string {
  const id = word(args, key);
  if (!id) throw new Error(`This command needs {${key}: "…"}.`);
  if (!usePerchStore.getState().sessions.some((session) => session.id === id)) throw new Error(`There is no session ${id}.`);
  return id;
}
function projectOf(args: unknown, key = "id") {
  const id = word(args, key);
  const project = usePerchStore.getState().workspaceProjects.find((p) => p.id === id);
  if (!project) throw new Error(id ? `There is no project ${id}.` : `This command needs {${key}: "…"}.`);
  return project;
}
function workspaceOf(args: unknown) {
  const id = needsId(args);
  const workspace = usePerchStore.getState().workspaces.find((w) => w.id === id);
  if (!workspace) throw new Error(`There is no workspace ${id}.`);
  return workspace;
}
function hostOf(args: unknown): string {
  const id = needsId(args);
  if (id !== "local" && !usePerchStore.getState().hosts.some((h) => h.id === id)) throw new Error(`There is no host ${id}.`);
  return id;
}

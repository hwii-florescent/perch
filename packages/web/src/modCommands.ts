import { placeFloat, resetLayoutState, resizeNode, showStackChild, toggleNode } from "./layoutState";
import { cloneMod, currentMods, openMod, setLayout } from "./mods";
import { bindKey, inAgentOrder, runCommand, setPanesSource, setTerminalReader } from "./modApp";
import { pasteIntoTerminal, scrollTerminal, terminalSelection, terminalText } from "./xtermSetup";
import { closeTopOverlay } from "./modUi";
import { writeTextFile } from "./modHost";
import { focusedSplit, getPaneController, openModTab, splitActiveTab } from "./tiledPanes";
import { activateTab, currentTabs, entryLabel, moveChat } from "./workspaceTabs";
import { zoomIn, zoomOut, zoomReset } from "./zoom";
import { tauriInvoke } from "./links";
import { useFileTabs } from "./fileTabs";
import { isPinned, setPinned } from "./pinnedTerminals";
import { runInWorkspace } from "./runs";
import { usePerchStore } from "./store";
import { orderProjects } from "./sidebarOrder";

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
  "tab.close": { description: "Close the tab", args: "{}", run: () => void runCommand("tabs.close") },
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
  "pane.close": { description: "Close the focused pane (its tab)", args: "{}", run: () => void runCommand("tabs.close") },
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
  ...Object.fromEntries(["show", "peek", "keep"].map((verb) => [`terminal.${verb}`, { description: "Show a terminal's session (Perch keeps every terminal running, so there is nothing to un-hide or park; peek, keep and show are the same command)", args: "{terminal | id}", run: (args: unknown) => usePerchStore.getState().switchSession(word(args, "terminal") ?? needsId(args)) }])),
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
};

//! What the runtime's tests share: the stock sidebar exported as the app exports it (unchanged source, plain JS),
//! loaded with its `react`, `react/jsx-runtime`, `react-dom` and `@perch/sdk` imports resolved to `bundle/` as a
//! native host resolves them; a `perch` host double fed from the web reference (`sdk`, `tokens`, `window`) and the
//! fixture's per-viewer view; and a selector adapter over the description, so the reference's named-element
//! selectors run against what the engine would draw.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { querySelectorAll, closest, matches } from "../selector.mjs";
import { MemoryStorage } from "../dom.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const runtimeDir = path.resolve(here, "..");
export const repo = path.resolve(runtimeDir, "../../../..");
const bundle = path.join(runtimeDir, "bundle");
const parity = path.join(repo, "e2e/native-parity");
const referenceDir = path.join(repo, "e2e/artifacts-native-parity/web");

export const named = JSON.parse(fs.readFileSync(path.join(parity, "named-elements.json"), "utf8")).screens.sidebar;
export const fixture = JSON.parse(fs.readFileSync(path.join(parity, "fixtures/sidebar.json"), "utf8"));
export const THEMES = ["light", "dark"];

/** The web reference for one state and theme (`npm run parity:web` in `e2e/` writes it). */
export function reference(state, theme) {
  const file = path.join(referenceDir, `sidebar.${state}.${theme}.json`);
  if (!fs.existsSync(file)) throw new Error(`no web reference ${path.relative(repo, file)}: run \`npm run parity:web\` in e2e/ first`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// The bundle's modules for a screen's bare imports, as the native host maps them (`bundle/imports.json`).
const imports = JSON.parse(fs.readFileSync(path.join(bundle, "imports.json"), "utf8"));
registerHooks({
  resolve(specifier, context, next) {
    const file = imports[specifier];
    if (file && specifier !== "@perch/runtime") return { url: pathToFileURL(path.join(bundle, file)).href, shortCircuit: true, format: "module" };
    return next(specifier, context);
  },
});

/** A host double: the reference's SDK data, its theme, the fixture state's per-viewer storage (as the reference page
 * wrote it), and a record of every command, overlay and render. */
export function perchDouble(ref, view) {
  const storage = new MemoryStorage({
    "perch.sidebar.organize": String(view.organize),
    "perch.sidebar.sort": view.sortByAttention ? "attention" : "manual",
    "perch.sidebar.showTerminals": view.showTerminals ? "1" : "0",
    "perch.sidebar.collapsedProjects": JSON.stringify(view.collapsedProjects ?? []),
  });
  const { navigation, hosts } = ref.sdk;
  const sessions = new Map();
  const collect = (list) => { for (const s of list ?? []) sessions.set(s.id, s); };
  collect(navigation.sessions);
  for (const project of [...navigation.projects, navigation.quickchat].filter(Boolean)) {
    collect(project.sessions);
    const walk = (workspaces) => { for (const w of workspaces ?? []) { collect(w.sessions); walk(w.children); } };
    walk(project.workspaces);
  }
  for (const section of navigation.status ?? []) collect(section.sessions);
  const perch = {
    isMac: true,
    hostname: "localhost",
    storage,
    commands: [],
    overlays: [],
    renders: 0,
    theme: () => ref.tokens,
    viewport: () => ref.window,
    navigation: () => navigation,
    hosts: () => hosts,
    session: (id) => sessions.get(id) ?? null,
    sessionFolders: () => ({ hostId: navigation.hostId, folders: [] }),
    subscribe: () => () => {},
    command: (name, args) => { perch.commands.push([name, args]); return true; },
    openOverlay: (kind, props) => { perch.overlays.push({ kind, props }); return perch.overlays.length; },
    closeOverlay: () => {},
    render: () => { perch.renders++; },
    error: (error) => { throw error; },
  };
  return perch;
}

// The sidebar as the app exports it: `exportStockUi` over the stock source, written where its relative imports work.
let sidebar = null;
export async function loadSidebar() {
  if (sidebar) return sidebar;
  const { exportStockUi } = await import(pathToFileURL(path.join(repo, "packages/web/scripts/export-stock-ui.mjs")).href);
  const files = exportStockUi({ sourceDir: path.join(repo, "packages/web/src/stock-ui"), sdkTypesFile: path.join(repo, "packages/web/src/perch-sdk.d.ts") });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-sidebar-"));
  process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [rel, bytes] of files) {
    if (!rel.startsWith("sidebar/")) continue;
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
  }
  // `@perch/sdk` reads `globalThis.perch` once when the runtime loads (isMac, pickFolder): a host without a folder
  // dialog, like the reference page.
  globalThis.perch ??= { isMac: true };
  const runtime = await import(pathToFileURL(path.join(bundle, "runtime.mjs")).href);
  const main = await import(pathToFileURL(path.join(dir, "sidebar/main.js")).href);
  sidebar = { runtime, Sidebar: main.default };
  return sidebar;
}

/** The card the reference lays the sidebar on (`harness/main.tsx`). */
export const CARD = { display: "flex", flexDirection: "column", width: 240, height: 800, overflow: "hidden", background: "var(--card-bg)" };

/** Mounts the sidebar for one state and theme; returns the handle, the double and the runtime. */
export async function mountSidebar(state, theme) {
  const ref = reference(state, theme);
  const view = fixture.states.find((s) => s.id === state).view;
  const { runtime, Sidebar } = await loadSidebar();
  const perch = perchDouble(ref, view);
  globalThis.perch = perch;
  const handle = runtime.mount(perch, Sidebar, { container: CARD });
  return { ref, perch, handle, runtime };
}

/** A description node as a selector target (tag, classes and attributes from `meta`). */
class Node {
  constructor(node, parent) {
    this.node = node;
    this.parentElement = parent;
    this.tagName = node.meta.tag;
    this.classList = node.meta.classes;
    this.children = (node.children ?? []).filter((c) => c.meta).map((c) => new Node(c, this));
  }
  getAttribute(name) {
    if (name === "class") return this.classList.join(" ") || null;
    return this.node.meta.attrs[name] ?? null;
  }
  get isDocumentRoot() { return false; }
  /** The text as the page has it (before `text-transform`), collapsed: the element's own text nodes (`ownOnly`, a
   * text-range name) or all of its text. */
  text(ownOnly = false) {
    const parts = [];
    const walk = (n) => {
      for (const c of n.children ?? []) {
        if (c.kind === "text") parts.push(c.source ?? c.text);
        else if (!ownOnly) walk(c);
      }
    };
    walk(this.node);
    return parts.join(ownOnly ? " " : "").replace(/\s+/g, " ").trim();
  }
  /** The engine's inherited value of a text key (`text_color`, `text_size`, ...), with its token. */
  inherited(key) {
    for (let n = this; n; n = n.parentElement) if (key in n.node.style) return { value: n.node.style[key], token: n.node.tokens?.[key] ?? null };
    return null;
  }
}

export const tree = (description) => new Node(description.root, null);

/** Hidden as the reference counts it: `display: none`, `opacity: 0` or `visibility: hidden` on it or an ancestor. */
export function hidden(node) {
  for (let n = node; n; n = n.parentElement) {
    const s = n.node.style;
    if (s.display === "hidden" || s.opacity === 0 || s.visibility === "invisible") return true;
  }
  return false;
}
export function opacity(node) {
  let product = 1;
  for (let n = node; n; n = n.parentElement) product *= n.node.style.opacity ?? 1;
  return Math.round(product * 100) / 100;
}

/** Every named element instance of the description, as the reference collects them. */
export function namedInstances(root) {
  const scope = querySelectorAll({ children: [root] }, named.root)[0];
  if (!scope) throw new Error(`no ${named.root} in the description`);
  const instances = [];
  const hiddenCounts = {};
  for (const def of named.elements) {
    let index = 0;
    for (const el of [...(matches(scope, def.selector) ? [scope] : []), ...querySelectorAll(scope, def.selector)]) {
      if (hidden(el)) { hiddenCounts[def.name] = (hiddenCounts[def.name] ?? 0) + 1; continue; }
      instances.push({ def, el, index: index++, key: keyOf(el, def.key) });
    }
  }
  return { instances, hiddenCounts };
}
function keyOf(el, spec) {
  if (!spec) return null;
  const at = spec.self ? el : spec.closest ? closest(el, spec.closest) : spec.find ? querySelectorAll(el, spec.find)[0] : null;
  let value = at?.getAttribute(spec.attr) ?? null;
  if (value && spec.strip && value.startsWith(spec.strip)) value = value.slice(spec.strip.length);
  return value;
}

/** The line height the engine draws an element's text with, in px. */
export function lineHeightPx(node) {
  const size = node.inherited("text_size").value;
  const lh = node.inherited("line_height").value;
  return typeof lh === "number" ? lh * size : parseFloat(lh);
}

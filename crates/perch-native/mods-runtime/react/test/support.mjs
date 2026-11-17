//! What the runtime's tests share: the stock sidebar exported as the app exports it (unchanged source, plain JS),
//! loaded with its `react`, `react/jsx-runtime`, `react-dom` and `@perch/sdk` imports resolved to the stock mod's
//! generated files as the native mod engine resolves them (`mods/react-runtime/`, which the mod host writes into each
//! React screen's folder); a `perch` host double fed from the web reference (`sdk`, `tokens`, `window`) and the
//! fixture's per-viewer view; and a selector adapter over the description, so the reference's named-element
//! selectors run against what the engine would draw.
import * as fs from "node:fs";
import * as path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { querySelectorAll, closest, matches } from "../selector.mjs";
import { MemoryStorage } from "../dom.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const runtimeDir = path.resolve(here, "..");
export const repo = path.resolve(runtimeDir, "../../../..");
const mods = path.join(repo, "crates/perch-native/mods");
const bundle = path.join(mods, "react-runtime");
const parity = path.join(repo, "e2e/native-parity");
const referenceDir = path.join(repo, "e2e/artifacts-native-parity/web");

export const named = JSON.parse(fs.readFileSync(path.join(parity, "named-elements.json"), "utf8")).screens.sidebar;
export const fixture = JSON.parse(fs.readFileSync(path.join(parity, "fixtures/sidebar.json"), "utf8"));
export const THEMES = ["light", "dark"];

/** The option of a test that compares with the web references: without any (`npm run parity:web` in `e2e/` has not run
 * in this checkout) it is skipped with that reason, unless `PERCH_REQUIRE_REFERENCES=1` (a gate run), where it fails. */
export const NEEDS_REFERENCES = {
  skip: fs.existsSync(referenceDir) || process.env.PERCH_REQUIRE_REFERENCES === "1" ? false : "no web references in e2e/artifacts-native-parity/web: run `npm run parity:web` in e2e (see docs/TESTING.md)",
};

/** The web reference for one state and theme (`npm run parity:web` in `e2e/` writes it). */
export function reference(state, theme) {
  const file = path.join(referenceDir, `sidebar.${state}.${theme}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`no web reference ${path.relative(repo, file)}. These tests compare the runtime with the web's own drawing, which the parity capture writes (headless WebKit, about a minute): from the repository root run \`(cd e2e && npm ci && npx playwright install webkit && npm run parity:web)\`, then run these tests again. See docs/TESTING.md, "Native client".`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// A screen's bare imports, as the mod engine resolves them (`<mod>/<specifier>.js`).
const BARE = new Set(["react", "react/jsx-runtime", "react-dom", "@perch/sdk"]);
registerHooks({
  resolve(specifier, context, next) {
    if (BARE.has(specifier)) return { url: pathToFileURL(path.join(bundle, `${specifier}.js`)).href, shortCircuit: true, format: "module" };
    return next(specifier, context);
  },
});

/** Stubs every host module (`perch`, `perch-react`, `perch-markdown`, ...) the bundle's files import: they exist only
 * inside the window's engine. Read from the imports themselves, so a new host module needs no change here. Nothing a
 * test runs calls them; a named import is exported as `0`. */
export function stubHostModules() {
  const names = new Map();
  for (const file of fs.readdirSync(bundle).filter((f) => f.endsWith(".js"))) {
    const source = fs.readFileSync(path.join(bundle, file), "utf8");
    for (const [, what, specifier] of source.matchAll(/import\s+(\*\s+as\s+\w+|\{[^}]*\})\s+from\s+"(perch(?:-[a-z]+)*)"/g)) {
      const set = names.get(specifier) ?? new Set();
      if (what.startsWith("{")) for (const part of what.slice(1, -1).split(",")) { const name = part.trim().split(/\s+as\s+/)[0]; if (name) set.add(name); }
      names.set(specifier, set);
    }
  }
  registerHooks({
    resolve(specifier, context, next) {
      const exported = names.get(specifier);
      if (!exported) return next(specifier, context);
      const body = exported.size ? `export const ${[...exported].map((n) => `${n}=0`).join(",")};` : "export {};";
      return { url: `data:text/javascript,${encodeURIComponent(body)}`, shortCircuit: true, format: "module" };
    },
  });
  return [...names.keys()];
}

/** A host double: the reference's SDK data, its theme, the fixture state's per-viewer storage (as the reference page
 * wrote it), and a record of every command, overlay and render. */
export function perchDouble(ref, view) {
  const storage = new MemoryStorage({
    "perch.sidebar.organize": String(view.organize),
    "perch.sidebar.sort": view.sortByAttention ? "attention" : "manual",
    "perch.sidebar.showTerminals": view.showTerminals ? "1" : "0",
    "perch.sidebar.collapsedProjects": JSON.stringify(view.collapsedProjects ?? []),
    "perch.sidebar.foldedSessions": JSON.stringify(view.foldedSessions ?? []),
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

// The sidebar as the app exports it: the stock mod's copy (`build.mjs` writes it; the bundle test holds it current).
let sidebar = null;
export async function loadSidebar() {
  if (sidebar) return sidebar;
  // `@perch/sdk` reads `globalThis.perch` once when the runtime loads (isMac, pickFolder): a host without a folder
  // dialog, like the reference page.
  globalThis.perch ??= { isMac: true };
  const runtime = await import(pathToFileURL(path.join(bundle, "runtime.mjs")).href);
  const main = await import(pathToFileURL(path.join(mods, "sidebar/sidebar/main.js")).href);
  sidebar = { runtime, Sidebar: main.default };
  return sidebar;
}

/** The card the reference lays the sidebar on (`harness/main.tsx`). */
export const CARD = { display: "flex", flexDirection: "column", width: 240, height: 800, overflow: "hidden", background: "var(--card-bg)" };

/** Mounts the sidebar for one state and theme; returns the handle, the double and the runtime. */
export async function mountSidebar(state, theme, options = {}) {
  const ref = reference(state, theme);
  const view = fixture.states.find((s) => s.id === state).view;
  const { runtime, Sidebar } = await loadSidebar();
  const perch = perchDouble(ref, view);
  globalThis.perch = perch;
  const handle = runtime.mount(perch, Sidebar, { container: CARD, ...options });
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
        // A letter-spaced run (in a box of its own that is no element) is still the element's own text.
        else if (!c.meta) parts.push(c.children.map((ch) => ch.source ?? ch.text).join(""));
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

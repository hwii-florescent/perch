import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import * as JsxRuntime from "react/jsx-runtime";
import { isTokenFunction, isTokenString, isTokenURL, isTokenAtKeyword, isTokenCloseParen, isTokenWhiteSpaceOrComment, stringify, tokenize } from "@csstools/css-tokenizer";
import type { ModInfo } from "@perch/shared";
import { getBasePath } from "./base";
import { isRelayMode, relayRequest } from "./relay/transport";

/** Loads a mod written as a package of ES modules (`format: "esm"`): every file of one revision comes from the
 * core's snapshot of that revision, imports between files resolve inside it, and `react`, `react-dom` and `@perch/sdk`
 * are the copies Perch itself is running (a second React would break hooks and context). No build step: the files
 * are what runs. es-module-shims does the graph work (cycles, lazy imports) and asks us for each file's source, so
 * the fetch goes through the same authenticated path as everything else; on a paired phone it goes through the
 * sealed tunnel only (`relayRequest`), at most `MAX_RELAY_FETCHES` at a time, and a file it cannot send that way
 * is an error, never a plain fetch from the relay's origin. A file that could not be had for now (no answer, or a
 * revision the core no longer keeps) is `PackageUnavailable`, and the load that hit it is retried under fresh module
 * URLs. A package's `react` is Perch's own with guarded effect hooks (`packageReact`): a throwing cleanup is reported,
 * never thrown into Perch's tree.
 *
 * A package's CSS and assets belong to its revision: before the graph runs, every asset is fetched once (an object
 * URL, so it works over the relay too) and every `.css` file is read, its `url(...)`s rewritten by a CSS tokenizer
 * to those URLs. `assetUrl(path)` (from `@perch/sdk`, bound to the importing package's revision) returns them. A
 * revision's styles are on the page while a copy shows it and its URLs live while any copy (or the last good
 * version kept to fall back on) still uses it; then both go.
 *
 * Each copy of a package on screen is an instance, keyed by where it is (`layout:<layout>:<node>`, `pane:<tab>`,
 * …), in the table below. The instance owns what the copy runs: its current generation (revision, component and
 * `ModApi`), its tracked operations and its host-held state (`useInstanceState`). A layout instance outlives its
 * presentation: a hidden stack tab or column parks it (tasks and state stay; keys go only to copies on screen) and
 * only leaving the layout releases it. Other instances are released when their view unmounts.
 *
 * A stock screen (`stock:<id>`) is a package of this page's own build (`stock-ui/`, written by
 * `scripts/export-stock-ui.mjs`), so its files come from the page's origin, never from the core or a mods folder:
 * the same bytes on desktop, browser and a relay phone (whose Worker serves this build), with mods on or off. */

/** Virtual origin the loader resolves package files against; nothing is ever fetched from it. */
const ORIGIN = "https://perch-mod.invalid";
const HOST_PATH = `${ORIGIN}/__host/`;
const SDK_PATH = `${ORIGIN}/__sdk/`;

type ImportShim = <T = unknown>(specifier: string) => Promise<T>;

/** An effect hook as packages get it: an effect's cleanup that throws is reported against the copy it runs in
 * (`InstanceContextValue.cleanupFailed`, phase `disposal`) instead of thrown. React sends a throw from the cleanup of
 * a removed subtree to the nearest boundary still mounted, which is above the copy (or to the root, which unmounts
 * the whole page); a package's cleanup must never take Perch down with it. ponytail: covers the effect hooks only; a
 * package class component's `componentWillUnmount` that throws still escapes (packages are written with hooks). */
const guardEffect = (hook: typeof React.useEffect): typeof React.useEffect => (effect, deps) => {
  const context = React.useContext(InstanceContext);
  hook(() => {
    const cleanup = effect();
    if (typeof cleanup !== "function" || !context?.cleanupFailed) return cleanup;
    return () => {
      try { cleanup(); } catch (error) { context.cleanupFailed!(error); }
    };
  }, deps);
};
/** `react` as a package imports it: Perch's own React, with `guardEffect`ed effect hooks. */
export const packageReact: typeof React = {
  ...React,
  useEffect: guardEffect(React.useEffect),
  useLayoutEffect: guardEffect(React.useLayoutEffect),
  useInsertionEffect: guardEffect(React.useInsertionEffect),
};
(packageReact as unknown as { default: typeof React }).default = packageReact;

const hostModules = new Map<string, Record<string, unknown> | (() => object)>([
  ["react", packageReact as unknown as Record<string, unknown>],
  ["react/jsx-runtime", JsxRuntime as unknown as Record<string, unknown>],
  ["react-dom", ReactDOM as unknown as Record<string, unknown>],
  ["react-dom/client", ReactDOMClient as unknown as Record<string, unknown>],
]);
/** The version of `@perch/sdk` this page runs (`sdk.ts`, contract `perch-sdk.d.ts`). */
export const SDK_VERSION = "1.10.2";

const RANGE = /^(\^|~)?(\d+)(?:\.(\d+|x))?(?:\.(\d+|x))?$/;

/** Whether `version` is inside a package's `api` range: `*`, `^1`, `^1.2`, `~1.2`, `1`, `1.x` or
 * `1.2.3`. Any other form is not understood, so it is refused rather than guessed at. */
export function sdkSatisfies(range: string, version = SDK_VERSION): boolean {
  const text = range.trim();
  if (text === "*" || text === "") return true;
  const match = RANGE.exec(text);
  if (!match) return false;
  const [major, minor, patch] = version.split(".").map(Number);
  const want = [match[2], match[3], match[4]].map((part) => (part === undefined || part === "x" ? undefined : Number(part)));
  if (want[0] !== major) return false;
  const atLeast = (wantMinor = 0, wantPatch = 0) => minor! > wantMinor || (minor === wantMinor && patch! >= wantPatch);
  if (match[1] === "^") return atLeast(want[1], want[2]);
  if (match[1] === "~") return (want[1] === undefined || minor === want[1]) && atLeast(want[1], want[2]);
  return (want[1] === undefined || minor === want[1]) && (want[2] === undefined || patch === want[2]);
}

/** Adds a module every package may import by name (the SDK registers itself here). `exports` may be a function that
 * makes them on first use: the SDK is evaluated inside an import cycle (a stock screen compiled into the page imports
 * `@perch/sdk`), so its object can be built only once every module it names has run. */
export const registerHostModule = (name: string, exports: Record<string, unknown> | (() => object)) => void hostModules.set(name, exports);
/** A host module's exports, made now if it registered a function. */
function hostModule(name: string): Record<string, unknown> | undefined {
  const found = hostModules.get(name);
  if (typeof found !== "function") return found;
  const made = found() as Record<string, unknown>;
  hostModules.set(name, made);
  return made;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
/** A host module's source: its exports, read from the page's own object. `@perch/sdk` imported by a package also
 * gets `assetUrl` bound to that package's revision. */
const hostSource = (name: string, bound?: { id: string; revision: string }): string => {
  const names = Object.keys(hostModule(name) ?? {}).filter((key) => key !== "default" && IDENTIFIER.test(key) && !(bound && key === "assetUrl"));
  const lines = [`const m = globalThis.__perchHostModules[${JSON.stringify(name)}];`, "export default m.default ?? m;"];
  for (const key of names) lines.push(`export const ${key} = m.${key};`);
  if (bound) lines.push(`export const assetUrl = (path) => globalThis.__perchAssetUrl(${JSON.stringify(bound.id)}, ${JSON.stringify(bound.revision)}, path);`);
  return lines.join("\n");
};

export const packageFileUrl = (id: string, revision: string, path: string) =>
  `${window.location.origin}${getBasePath()}mods/package?${new URLSearchParams({ id, rev: revision, path })}`;
export const STOCK_PREFIX = "stock:";
const stockUrl = (path: string) => `${window.location.origin}${getBasePath()}stock-ui/${path}`;

/** Package files fetched at once over the relay. The host takes at most 16 pending requests per phone
 * (`MAX_PENDING_REQUESTS` in relay/host.rs) and ends the session past that; the page's own requests need the rest. */
export const MAX_RELAY_FETCHES = 8;
let relayActive = 0;
const relayWaiting: (() => void)[] = [];
async function oneOfFew<T>(work: () => Promise<T>): Promise<T> {
  while (relayActive >= MAX_RELAY_FETCHES) await new Promise<void>((go) => relayWaiting.push(go));
  relayActive++;
  try {
    return await work();
  } finally {
    relayActive--;
    relayWaiting.shift()?.();
  }
}

/** A file of this page's build; an SPA fallback page (a file the build does not have) is a failure, not source. */
async function fetchBuilt(path: string): Promise<Response> {
  const response = await fetch(stockUrl(path), { credentials: "same-origin" });
  if (!response.ok || (response.headers.get("content-type") ?? "").includes("text/html")) {
    throw new Error(`Perch's web build has no stock-ui/${path} (${response.ok ? "not a stock file" : response.status}); rebuild it with npm run build.`);
  }
  return response;
}

/** Where a file of a package revision is read from. Tests replace it; the app uses the core's package route (or,
 * for a stock screen, this page's build). */
export type PackageFetcher = (id: string, revision: string, path: string) => Promise<Response>;
const defaultFetcher: PackageFetcher = (id, revision, path) => {
  if (id.startsWith(STOCK_PREFIX)) return fetchBuilt(`${encodeURIComponent(id.slice(STOCK_PREFIX.length))}/${path}`);
  const url = packageFileUrl(id, revision, path);
  return isRelayMode() ? oneOfFew(() => relayRequest(url)) : fetch(url, { credentials: "same-origin" });
};
let fetchPackageFile = defaultFetcher;
export const setPackageFetcher = (fetcher: PackageFetcher | null) => { fetchPackageFile = fetcher ?? defaultFetcher; };

/** What a file's content type must say for its extension: the browser's `nosniff`, which a module loaded through
 * a source hook would otherwise skip. */
function expectedType(path: string): RegExp {
  const ext = path.slice(path.lastIndexOf(".") + 1);
  if (ext === "js" || ext === "mjs") return /javascript/;
  if (ext === "css") return /^text\/css/;
  if (ext === "json") return /json/;
  return /^(image|font)\//;
}

/** A file of a revision that could not be had for now: Perch did not answer (a core restart, a dropped relay) or no
 * longer keeps that revision (`gone`). Not the package's fault: the copy keeps what it shows and loads again on the
 * next mods list (`ModRoot`). */
export class PackageUnavailable extends Error {
  constructor(message: string, readonly gone: boolean) {
    super(message);
    this.name = "PackageUnavailable";
  }
}
/** The `PackageUnavailable` a revision's last load hit, by revision key: the module loader may hand back its own
 * error for a failed graph, so the cause is kept here and taken by whoever reports the load. */
const unavailable = new Map<string, PackageUnavailable>();
/** Loads of a revision that hit `PackageUnavailable`: the loader keeps a failed file for good (as a browser's module
 * map does), so each retry reads the revision under fresh module URLs (`moduleUrl`'s `~<n>`). */
const attempts = new Map<string, number>();
function takeUnavailable(key: string): PackageUnavailable | undefined {
  const found = unavailable.get(key);
  if (!found) return undefined;
  unavailable.delete(key);
  attempts.set(key, (attempts.get(key) ?? 0) + 1);
  return found;
}

/** One file of a revision, checked: a failure or a wrong content type is an error naming the file. */
async function packageFile(id: string, revision: string, path: string): Promise<Response> {
  const fail = (error: PackageUnavailable) => (unavailable.set(revisionKey(id, revision), error), error);
  let response: Response;
  try {
    response = await fetchPackageFile(id, revision, path);
  } catch (error) {
    throw fail(new PackageUnavailable(`${path}: Perch could not be reached (${error instanceof Error ? error.message : String(error)}); it loads again once Perch answers`, false));
  }
  if (response.status === 410) throw fail(new PackageUnavailable(`${path}: this revision is no longer kept; it loads again from the newest`, true));
  if (!response.ok) {
    const why = await response.text().catch(() => "");
    throw new Error(`${path}: could not load it (${response.status})${why ? `: ${why.slice(0, 200)}` : ""}`);
  }
  const type = response.headers.get("content-type") ?? "";
  if (!expectedType(path).test(type)) throw new Error(`${path}: served as "${type || "no type"}", not what its extension says`);
  return response;
}

/** The virtual URL of a file: the revision is part of the path, so a new revision is a new set of modules. `attempt`
 * (a retry after `PackageUnavailable`) is another set for the same revision's bytes. */
export const moduleUrl = (id: string, revision: string, path: string, attempt = 0) =>
  `${ORIGIN}/${encodeURIComponent(id)}/${revision}${attempt ? `~${attempt}` : ""}/${path}`;
const parseModuleUrl = (url: string): { id: string; revision: string; path: string } | null => {
  if (!url.startsWith(`${ORIGIN}/`) || url.startsWith(HOST_PATH) || url.startsWith(SDK_PATH)) return null;
  const [id, segment, ...rest] = url.slice(ORIGIN.length + 1).split("/");
  const revision = segment?.split("~")[0];
  return id && revision && rest.length ? { id: decodeURIComponent(id), revision, path: rest.join("/") } : null;
};

let ready: Promise<ImportShim> | undefined;
function shim(): Promise<ImportShim> {
  ready ??= (async () => {
    const scope = globalThis as unknown as { esmsInitOptions?: unknown; importShim?: ImportShim; __perchHostModules?: Record<string, unknown>; __perchAssetUrl?: typeof assetUrl };
    scope.__perchHostModules = new Proxy({}, { get: (_target, name) => hostModule(String(name)) });
    scope.__perchAssetUrl = assetUrl;
    scope.esmsInitOptions = {
      shimMode: true,
      resolve: (id: string, parentUrl: string, defaultResolve: (id: string, parentUrl: string) => string) => {
        const parent = parseModuleUrl(parentUrl);
        // Each package revision gets its own `@perch/sdk` record, the same objects plus its own `assetUrl`.
        if (id === "@perch/sdk" && parent) return `${SDK_PATH}${encodeURIComponent(parent.id)}/${parent.revision}.js`;
        return hostModules.has(id) ? `${HOST_PATH}${encodeURIComponent(id)}.js` : defaultResolve(id, parentUrl);
      },
      source: async (url: string) => {
        if (url.startsWith(HOST_PATH)) return { type: "js", source: hostSource(decodeURIComponent(url.slice(HOST_PATH.length, -3))) };
        if (url.startsWith(SDK_PATH)) {
          const [id, revision] = url.slice(SDK_PATH.length, -3).split("/");
          return { type: "js", source: hostSource("@perch/sdk", { id: decodeURIComponent(id!), revision: revision! }) };
        }
        const file = parseModuleUrl(url);
        if (!file) throw new Error(`A mod can only import its own files, "react", "react-dom" or "@perch/sdk": ${url}`);
        // The host puts every .css file of the package on the page; importing one is allowed and does nothing more.
        if (file.path.endsWith(".css")) return { type: "js", source: "export {};" };
        const response = await packageFile(file.id, file.revision, file.path);
        const source = await response.text();
        if (!file.path.endsWith(".json")) return { type: "js", source };
        try {
          JSON.parse(source);
        } catch (error) {
          throw new Error(`${file.path}: not valid JSON (${error instanceof Error ? error.message : String(error)})`);
        }
        return { type: "json", source };
      },
    };
    await import("es-module-shims");
    if (!scope.importShim) throw new Error("The module loader did not start.");
    return scope.importShim;
  })();
  return ready;
}

type CatalogEntry = { id: string; name: string; version: string; api: string; entry: string; files: string[]; revision: string };
let catalog: Promise<CatalogEntry[]> | undefined;

/** The stock screen `stock:<name>` of this page's build, as the mod it is loaded as. Rejects (and asks again next
 * time) when the build has no catalog or no such screen. */
export async function stockMod(name: string): Promise<ModInfo> {
  catalog ??= fetchBuilt("catalog.json").then(async (response) => (JSON.parse(await response.text()) as { packages: CatalogEntry[] }).packages);
  const entries = await catalog.catch((error: unknown) => { catalog = undefined; throw error; });
  const entry = entries.find((candidate) => candidate.id === name);
  if (!entry) throw new Error(`Perch's web build has no stock screen "${name}".`);
  return {
    id: `${STOCK_PREFIX}${entry.id}`, name: entry.name, description: "", place: "layout", enabled: true, revision: entry.revision, error: null,
    format: "esm", api: entry.api, entry: entry.entry, files: entry.files, origin: "stock", version: entry.version,
  };
}

/** Imports one revision of a package and returns its entry module's exports. Rejects (and runs nothing else) when any file
 * of the graph fails to load, so the caller can keep the last good revision; with `PackageUnavailable` when a file
 * could not be had for now. */
export async function importPackage(id: string, revision: string, entry = "main.js"): Promise<Record<string, unknown>> {
  const importShim = await shim();
  const key = revisionKey(id, revision);
  try {
    return await importShim<Record<string, unknown>>(moduleUrl(id, revision, entry, attempts.get(key)));
  } catch (error) {
    throw takeUnavailable(key) ?? error;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// A revision's CSS and assets.

const CODE = /\.(m?js|json)$/;
const isAsset = (path: string) => !CODE.test(path) && !path.endsWith(".css") && !path.endsWith(".d.ts");

/** What one revision of a package puts on the page. `refs` counts generations (and last-good fallbacks) using
 * it; `shown` counts copies showing it, which is when its stylesheet is in the document. */
export interface RevisionResources {
  readonly key: string;
  refs: number;
  shown: number;
  urls: Map<string, string>;
  css: string;
  style: HTMLStyleElement | null;
}
const revisions = new Map<string, Promise<RevisionResources>>();
const resolvedRevisions = new Map<string, RevisionResources>();
const revisionKey = (id: string, revision: string) => `${id}\n${revision}`;

/** `path` inside the package, `/`-separated, without `./`; null for one that leaves it. */
function packagePath(path: string, from = ""): string | null {
  const base = new URL(from, `${ORIGIN}/p/`);
  const target = new URL(path, base);
  if (target.origin !== ORIGIN || !target.pathname.startsWith("/p/")) return null;
  try {
    return decodeURIComponent(target.pathname.slice(3));
  } catch {
    return null;
  }
}

/** `css` (the file `file` of a package) with every `url(...)` that names a package file replaced by that file's URL,
 * read by a CSS tokenizer: comments, strings and escapes are what CSS says they are. `data:`, `blob:`, `http(s):`
 * and fragment-only URLs stay. An `@import` or a URL naming no file of the package is an error. */
export function rewriteCss(css: string, file: string, urlOf: (path: string) => string | undefined): string {
  const tokens = tokenize({ css });
  const replace = (value: string): string => {
    if (/^([a-z][a-z0-9+.-]*:|#)/i.test(value)) return value;
    const [plain, fragment = ""] = value.split("#", 2) as [string, string?];
    const path = packagePath(plain.split("?")[0]!, file);
    const url = path === null ? undefined : urlOf(path);
    if (!url) throw new Error(`${file}: url(${value}) names no file of this package`);
    return fragment ? `${url}#${fragment}` : url;
  };
  const quoted = (url: string) => `"${url.replace(/["\\\n]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `)}"`;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (isTokenAtKeyword(token) && token[4].value.toLowerCase() === "import") {
      throw new Error(`${file}: @import is not needed: Perch puts every .css file of the package on the page`);
    }
    if (isTokenURL(token)) {
      token[1] = `url(${quoted(replace(token[4].value))})`;
    } else if (isTokenFunction(token) && token[4].value.toLowerCase() === "url") {
      let at = i + 1;
      while (tokens[at] && isTokenWhiteSpaceOrComment(tokens[at]!)) at++;
      const value = tokens[at];
      if (value && isTokenString(value)) {
        value[1] = quoted(replace(value[4].value));
        let end = at + 1;
        while (tokens[end] && isTokenWhiteSpaceOrComment(tokens[end]!)) end++;
        if (!tokens[end] || !isTokenCloseParen(tokens[end]!)) throw new Error(`${file}: a url( "…" ) is not closed`);
      }
    }
  }
  return stringify(...tokens);
}

/** Fetches (once per revision) every asset of a package as an object URL, and its CSS rewritten to them, and holds
 * them for one more user. Release with `releaseResources`. A stock screen's assets are this build's own files. */
export async function acquireResources(mod: Pick<ModInfo, "id" | "revision" | "files">): Promise<RevisionResources> {
  const key = revisionKey(mod.id, mod.revision);
  let loading = revisions.get(key);
  if (!loading) {
    loading = (async () => {
      const files = mod.files ?? [];
      const urls = new Map<string, string>();
      const stock = mod.id.startsWith(STOCK_PREFIX);
      try {
        await Promise.all(files.filter(isAsset).map(async (path) => {
          if (stock) {
            urls.set(path, stockUrl(`${encodeURIComponent(mod.id.slice(STOCK_PREFIX.length))}/${path}`));
            return;
          }
          const blob = await (await packageFile(mod.id, mod.revision, path)).blob();
          urls.set(path, URL.createObjectURL(blob));
        }));
        const sheets = await Promise.all(files.filter((path) => path.endsWith(".css")).sort().map(async (path) =>
          `/* ${path} */\n${rewriteCss(await (await packageFile(mod.id, mod.revision, path)).text(), path, (name) => urls.get(name))}`));
        const made: RevisionResources = { key, refs: 0, shown: 0, urls, css: sheets.join("\n"), style: null };
        resolvedRevisions.set(key, made);
        return made;
      } catch (error) {
        if (!stock) for (const url of urls.values()) URL.revokeObjectURL(url);
        revisions.delete(key);
        throw takeUnavailable(key) ?? error;
      }
    })();
    revisions.set(key, loading);
  }
  const resources = await loading;
  resources.refs++;
  return resources;
}

/** One user is done with a revision's resources; the last one removes its styles and revokes its URLs. */
export function releaseResources(resources: RevisionResources): void {
  if (--resources.refs > 0) return;
  resources.style?.remove();
  resources.style = null;
  resources.shown = 0;
  for (const url of resources.urls.values()) if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  revisions.delete(resources.key);
  resolvedRevisions.delete(resources.key);
}

/** A copy shows this revision: its stylesheet is on the page while any copy does. */
export function showStyles(resources: RevisionResources): () => void {
  if (resources.shown++ === 0 && resources.css && resources.refs > 0) {
    const style = document.createElement("style");
    const [id, revision] = resources.key.split("\n");
    style.dataset.modPackage = id;
    style.dataset.modRevision = revision;
    style.textContent = resources.css;
    document.head.append(style);
    resources.style = style;
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (--resources.shown <= 0) {
      resources.shown = 0;
      resources.style?.remove();
      resources.style = null;
    }
  };
}

/** `assetUrl(path)` as a package revision's `@perch/sdk` gives it: the URL of one of its own files. */
export function assetUrl(id: string, revision: string, path: string): string {
  const resources = resolvedRevisions.get(revisionKey(id, revision));
  const name = packagePath(String(path));
  const url = name === null ? undefined : resources?.urls.get(name);
  if (!url) throw new Error(`assetUrl("${path}"): no such file in this package (a path from its folder, like "art/logo.svg")`);
  return url;
}

// ---------------------------------------------------------------------------------------------------------------
// Instances: each copy of a package on screen.

/** One revision of a package as a copy runs it: what it renders, its API (with what it opened) and its resources. */
export interface Generation {
  revision: string;
  given: string;
  View: React.ComponentType<Record<string, unknown>>;
  api: { dispose(): unknown[] };
  resources: RevisionResources;
  reported?: boolean;
  /** It threw while rendering and nothing older could take its place: the copy shows nothing. */
  failed?: boolean;
}

export interface ModInstance {
  readonly key: string;
  readonly modId: string;
  /** `layout`: kept while its layout keeps the node, shown or not. `view`: released when its view unmounts. */
  readonly owner: "layout" | "view";
  current: Generation | null;
  /** The last generation that rendered, kept (with its resources) to come back to if a newer one fails. */
  lastGood: Omit<Generation, "api"> | null;
  /** The latest load asked for; an older load that finishes later is dropped. */
  requested: number;
  error: string | null;
  waiting: number;
  mounted: boolean;
  released: boolean;
  element: HTMLElement | null;
  /** True when the copy has no view of its own (a mod that only runs): it takes keys while mounted. */
  viewless: boolean;
  /** Its last load hit `PackageUnavailable`: it loads again on the next mods list. */
  unavailable: boolean;
  readonly state: Map<string, unknown>;
  readonly pending: Set<Promise<unknown>>;
  readonly listeners: Set<() => void>;
}

const instances = new Map<string, ModInstance>();

/** The instance at `key`, made when there is none (or the one there belongs to another mod). */
export function acquireInstance(key: string, modId: string, owner: ModInstance["owner"]): ModInstance {
  const found = instances.get(key);
  if (found && found.modId === modId && found.owner === owner && !found.released) return found;
  if (found) releaseInstance(found);
  const made: ModInstance = {
    key, modId, owner, current: null, lastGood: null, requested: 0, error: null, waiting: 0, mounted: false, released: false,
    element: null, viewless: false, unavailable: false, state: new Map(), pending: new Set(), listeners: new Set(),
  };
  instances.set(key, made);
  return made;
}

export const findInstance = (key: string) => instances.get(key);
export const notifyInstance = (instance: ModInstance) => instance.listeners.forEach((listen) => listen());

/** Whether keys go to this copy: mounted and drawn, or a mod with no view. */
export function instanceShown(instance: ModInstance): boolean {
  if (!instance.mounted || instance.released) return false;
  if (instance.viewless) return true;
  const el = instance.element as (HTMLElement & { checkVisibility?: (options?: object) => boolean }) | null;
  if (!el || !el.isConnected) return false;
  return el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : el.getClientRects().length > 0;
}

/** Retires `generation`'s API; returns what its cleanups threw. */
const retire = (generation: Generation | null): unknown[] => {
  if (!generation) return [];
  const errors = generation.api.dispose();
  releaseResources(generation.resources);
  return errors;
};

/** Makes `next` the copy's generation: the one it replaces is disposed first (its commands, subscriptions and
 * timers stop before the new one's effects can start). Returns what the old one's cleanups threw. */
export function commitGeneration(instance: ModInstance, next: Generation): unknown[] {
  const errors = retire(instance.current);
  instance.current = next;
  instance.error = null;
  notifyInstance(instance);
  return errors;
}

/** `generation` rendered: it is what a later failure comes back to. */
export function markGood(instance: ModInstance, generation: Generation): void {
  if (instance.lastGood?.resources === generation.resources && instance.lastGood.View === generation.View) return;
  const previous = instance.lastGood;
  generation.resources.refs++;
  instance.lastGood = { revision: generation.revision, given: generation.given, View: generation.View, resources: generation.resources };
  if (previous) releaseResources(previous.resources);
}

/** Ends a copy: its generation is disposed, its resources and state go. Returns what cleanups threw. */
export function releaseInstance(instance: ModInstance): unknown[] {
  if (instance.released) return [];
  instance.released = true;
  instance.requested++;
  const errors = retire(instance.current);
  instance.current = null;
  if (instance.lastGood) releaseResources(instance.lastGood.resources);
  instance.lastGood = null;
  instance.state.clear();
  instance.pending.clear();
  if (instances.get(instance.key) === instance) instances.delete(instance.key);
  notifyInstance(instance);
  return errors;
}

/** Releases every parked `prefix` instance whose key is not in `keep` (the layout dropped its node or switched). */
export function retainInstances(prefix: string, keep: ReadonlySet<string>): void {
  for (const instance of [...instances.values()]) {
    if (instance.owner === "layout" && instance.key.startsWith(prefix) && !keep.has(instance.key)) releaseInstance(instance);
  }
}

/** Waits until the copy's tracked operations have settled, or `ms` passed; true when none is pending. */
export async function waitForTracked(instance: ModInstance, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  while (instance.pending.size && !instance.released) {
    const left = end - Date.now();
    if (left <= 0) return false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([Promise.allSettled([...instance.pending]), new Promise((done) => { timer = setTimeout(done, left); })]);
    clearTimeout(timer);
  }
  return instance.pending.size === 0;
}

/** `trackOperation` for one copy: a new revision is not swapped in while `work` is pending. */
export function trackOperation<T>(instance: ModInstance, work: Promise<T> | (() => Promise<T>)): Promise<T> {
  const promise = typeof work === "function" ? Promise.resolve().then(work) : Promise.resolve(work);
  if (instance.released) return promise;
  instance.pending.add(promise);
  const done = () => { instance.pending.delete(promise); };
  promise.then(done, done);
  return promise;
}

/** What a package's components get from the copy they run in (`useInstance` in `@perch/sdk`). */
export interface InstanceContextValue {
  instance: ModInstance;
  revision: string;
  /** What one of this revision's effect cleanups threw (`packageReact`); reported, never thrown into Perch's tree. */
  cleanupFailed?(error: unknown): void;
}
export const InstanceContext = React.createContext<InstanceContextValue | null>(null);

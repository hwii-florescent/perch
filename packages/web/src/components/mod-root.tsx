import { Component, createElement, type ComponentType, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ModInfo, ModReportPhase } from "@perch/shared";
import { modApi, type ModApi } from "../modApp";
import {
  acquireInstance, acquireResources, commitGeneration, importPackage, InstanceContext, instanceShown, markGood, notifyInstance, PackageUnavailable,
  releaseInstance, releaseResources, SDK_VERSION, sdkSatisfies, showStyles, STOCK_PREFIX, stockMod, waitForTracked, type Generation, type ModInstance, type RevisionResources,
} from "../mod-runtime";
import { currentMods, refreshMods, reportMod, subscribeMods } from "../mods";
import { guardStart } from "../bootGuard";
import { personCodeAllowed, useIsPhoneDevice, usePhoneModsOn } from "../phoneMods";

/** How long a new revision waits for the copy's tracked operations (`trackOperation`) before it is shown anyway
 * (and the wait reported as a `swap` warning). */
export const SWAP_HOLD_MS = 10_000;

class Boundary extends Component<{ onError(error: unknown): void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Committed after the package's component in the same boundary: it ran its effects only if the component rendered. */
function Rendered({ done }: { done(): void }) {
  useEffect(done, [done]);
  return null;
}

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));
let serials = 0;
const serial = new WeakMap<Generation, number>();
const serialOf = (generation: Generation) => {
  if (!serial.has(generation)) serial.set(generation, ++serials);
  return serial.get(generation)!;
};

/** A mod written as React: its package's default export is a component that gets `api` and the props it is given
 * (functions too; a layout block's props are JSON, and a change to that JSON loads it again with a new `api`).
 *
 * Each `ModRoot` is the view of one instance (`instance`: where it is, e.g. `layout:<layout>:<node>`), which owns
 * what the copy runs (`mod-runtime.ts`). A new revision is imported first and only then swapped in, inside one
 * boundary: the old generation's API is disposed before the new one's effects start, so one tree is ever live. A
 * swap waits (up to `SWAP_HOLD_MS`) while the copy has tracked operations pending. If the new revision fails to
 * load or to render, the last working one comes back and the reason is reported (`load`, `render`, `callback` or
 * `disposal`; an effect cleanup of the package that throws is a `disposal` report too, never a throw into Perch's
 * tree). A load that could not get its files for now (`PackageUnavailable`: Perch restarting, a dropped relay, a
 * revision the core no longer keeps) keeps what is shown and loads again on the next mods list (asked for at once
 * when the revision is gone; after a reconnect, the page asks anyway). A package whose `api` range this page's
 * `@perch/sdk` is outside is not loaded. A `layout` instance is parked, not ended, when this view unmounts (a hidden
 * tab or column); any other ends with its view. */
export function ModRoot(args: ModRootProps) {
  const allowed = usePersonCode(args.mod, args.forScreen ?? null);
  if (!allowed) return <PhoneRefusal mod={args.mod} hidden={args.hidden} />;
  return <AllowedModRoot {...args} />;
}

/** Whether `mod` may run here: Perch's own stock packages always; a person's per `personCodeAllowed` (`phoneMods.ts`). */
export function usePersonCode(mod: ModInfo, forScreen: string | null) {
  const phone = useIsPhoneDevice();
  const optedIn = usePhoneModsOn();
  return mod.origin === "stock" || mod.id.startsWith(STOCK_PREFIX) || personCodeAllowed(phone, optedIn, forScreen);
}

/** In place of a person's package on a phone: it does not run there (phones keep their own screens). Nothing for a
 * package without a view. */
export function PhoneRefusal({ mod, hidden }: { mod: ModInfo; hidden?: boolean }) {
  if (hidden) return null;
  return <p className="m-0 p-3 text-[0.78rem] text-subtext-0" role="status" data-testid={`mod-phone-refused-${mod.id}`}>{mod.name} runs on the computer, not on this phone. A phone runs only copies of its own screens, once turned on in Settings &gt; Mods.</p>;
}

interface ModRootProps {
  mod: ModInfo;
  props?: Record<string, unknown>;
  /** Props passed as they are at each render, without loading the package again when they change (`StockRoute`). */
  live?: Record<string, unknown>;
  hidden?: boolean;
  className?: string;
  instance?: string;
  owner?: ModInstance["owner"];
  /** Called when the package cannot show anything: it failed to load or render with no working revision to keep.
   * `unavailable`: only because its files could not be had for now (`PackageUnavailable`). */
  onFailed?: (error: string, unavailable: boolean) => void;
  /** The stock screen this person's package is chosen for (`useStockChoice`), which decides whether it may run on a
   * phone; none for a layout block, a docked, hidden or overlaid package. */
  forScreen?: string;
}

function AllowedModRoot({ mod, props, live, hidden, className, instance: key, owner = "view", onFailed }: ModRootProps) {
  const fallback = useId();
  const instanceKey = key ?? `view:${mod.id}:${fallback}`;
  const instance = useMemo(() => acquireInstance(instanceKey, mod.id, owner), [instanceKey, mod.id, owner]);
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [twice, setTwice] = useState(false);
  const [retry, setRetry] = useState(0);
  // A load that hit `PackageUnavailable` is tried again on the next mods list.
  useEffect(() => subscribeMods(() => {
    if (!instance.unavailable) return;
    instance.unavailable = false;
    setRetry((n) => n + 1);
  }), [instance]);
  const host = useRef<HTMLDivElement>(null);
  const given = JSON.stringify(props ?? {});
  const report = (revision: string, error: string | null, phase: ModReportPhase) => reportMod(mod.id, revision, error, { instance: instance.key, phase });
  const reportRef = useRef(report);
  reportRef.current = report;
  const failedRef = useRef(onFailed);
  failedRef.current = onFailed;
  // A person's package is guarded while it starts (`bootGuard.ts`): one that freezes the page is turned off next time.
  const guarded = mod.origin !== "stock" && !mod.id.startsWith(STOCK_PREFIX);
  const starting = useRef<(() => void) | null>(null);
  const endStart = (now = false) => {
    const settle = starting.current;
    starting.current = null;
    if (settle) { if (now) settle(); else setTimeout(settle, 0); }
  };
  useEffect(() => () => endStart(true), []);
  const makeApi = (revision: string, json: string) => modApi(mod.id, JSON.parse(json) as Record<string, unknown>, {
    shown: () => instanceShown(instance),
    onError: (phase, error) => reportRef.current(revision, describe(error), phase),
  });

  // This view is the instance's one presentation. A second view of the same instance would run its module twice,
  // so it says why instead.
  useLayoutEffect(() => {
    if (instance.mounted) { setTwice(true); return; }
    setTwice(false);
    if (instance.released) return;
    instance.mounted = true;
    instance.element = host.current;
    instance.viewless = !!hidden;
    instance.listeners.add(refresh);
    refresh();
    return () => {
      instance.listeners.delete(refresh);
      instance.mounted = false;
      instance.element = null;
      // A remount in the same commit (React's StrictMode check, a move) keeps it.
      if (instance.owner === "view") queueMicrotask(() => {
        if (instance.mounted) return;
        const revision = instance.current?.revision;
        const errors = releaseInstance(instance);
        if (errors.length && revision) reportRef.current(revision, describe(errors[0]), "disposal");
      });
    };
  }, [instance, hidden]);

  useEffect(() => {
    if (twice || instance.released) return;
    const now = instance.current;
    const generation = ++instance.requested;
    instance.unavailable = false;
    if (now && now.revision === mod.revision && now.given === given) {
      // Listed again as what is shown (a broken edit undone): a load still in flight is dropped, and so is its error.
      if (instance.error) { instance.error = null; notifyInstance(instance); }
      return;
    }
    const stale = () => generation !== instance.requested || instance.released;
    endStart(true);
    if (guarded) starting.current = guardStart(mod.id, mod.revision);
    void (async () => {
      let resources: RevisionResources | undefined;
      try {
        if (mod.api && !sdkSatisfies(mod.api)) throw new Error(`This package needs @perch/sdk ${mod.api}; this Perch has ${SDK_VERSION}.`);
        resources = await acquireResources(mod);
        const exports = await importPackage(mod.id, mod.revision, mod.entry || "main.js");
        if (typeof exports.default !== "function") throw new Error("The mod must export a default React component.");
        if (stale()) return;
        if (instance.pending.size) {
          instance.waiting = instance.pending.size;
          notifyInstance(instance);
          const settled = await waitForTracked(instance, SWAP_HOLD_MS);
          const left = instance.pending.size;
          instance.waiting = 0;
          notifyInstance(instance);
          if (stale()) return;
          if (!settled) report(mod.revision, `shown after waiting ${SWAP_HOLD_MS / 1000} s with ${left} tracked operation(s) still pending`, "swap");
        }
        const previous = instance.current?.revision;
        const next: Generation = { revision: mod.revision, given, View: exports.default as Generation["View"], resources, api: makeApi(mod.revision, given) };
        resources = undefined;
        const errors = commitGeneration(instance, next);
        if (errors.length && previous) report(previous, describe(errors[0]), "disposal");
      } catch (problem) {
        if (stale()) return;
        endStart();
        const unavailable = problem instanceof PackageUnavailable;
        instance.unavailable = unavailable;
        instance.error = describe(problem);
        notifyInstance(instance);
        report(mod.revision, describe(problem), "load");
        if (!instance.current) failedRef.current?.(describe(problem), unavailable);
        if (unavailable && problem.gone) refreshMods();
      } finally {
        if (resources) releaseResources(resources);
      }
    })();
  }, [instance, twice, mod.id, mod.revision, mod.entry, mod.api, given, retry]);

  const shown = instance.current;
  // A revision's stylesheet is on the page while this copy shows it (swapped before the browser paints).
  useLayoutEffect(() => (shown && !twice && instance.mounted ? showStyles(shown.resources) : undefined), [shown, twice, instance]);
  const context = useMemo(() => (shown ? {
    instance, revision: shown.revision,
    cleanupFailed: (problem: unknown) => reportRef.current(shown.revision, describe(problem), "disposal"),
  } : null), [instance, shown]);

  const rendered = useMemo(() => () => {
    if (!shown || shown.reported || instance.current !== shown) return;
    shown.reported = true;
    endStart();
    markGood(instance, shown);
    reportRef.current(shown.revision, null, "render");
  }, [instance, shown]);

  const failed = (problem: unknown) => {
    const bad = instance.current;
    if (!bad) return;
    endStart();
    report(bad.revision, describe(problem), "render");
    const good = instance.lastGood;
    const back = good && good.View !== bad.View;
    bad.failed = !back;
    if (back) {
      good.resources.refs++;
      commitGeneration(instance, { ...good, api: makeApi(good.revision, good.given), reported: true });
    }
    instance.error = describe(problem);
    notifyInstance(instance);
    if (!back) failedRef.current?.(describe(problem), false);
  };

  const error = twice ? `This copy (${instance.key}) is already shown elsewhere on this screen; one copy runs at a time.` : instance.error;
  return (
    <div ref={host} className={hidden ? "hidden" : className ?? "relative h-full w-full min-h-0 flex-1 overflow-auto"} data-testid={`mod-view-${mod.id}`} data-mod-instance={instance.key}>
      {shown && !twice && context && (
        <InstanceContext.Provider value={context}>
          <Boundary key={serialOf(shown)} onError={failed}>
            {createElement(shown.View, { ...props, ...live, api: shown.api as unknown as ModApi })}
            <Rendered done={rendered} />
          </Boundary>
        </InstanceContext.Provider>
      )}
      {instance.waiting > 0 && !hidden && <p className="absolute top-0 left-0 right-0 m-0 bg-panel-bg p-2 text-[0.75rem] text-subtext-0" role="status" data-testid="mod-update-waiting">A newer version is waiting for {instance.waiting} operation(s) to finish.</p>}
      {error && <p className="absolute bottom-0 left-0 right-0 m-0 bg-panel-bg p-2 text-[0.75rem] text-red" role="alert" data-testid="mod-error">{error}{hidden || !shown || shown.failed ? "" : " The last working version is still showing."}</p>}
    </div>
  );
}

/** The person's package chosen for stock screen `name` (`perch mod use stock:<name> <id>`, `uses` in `mods.state`), if
 * it can run here; otherwise stock, with a notice when the choice is broken. A chosen package that failed to load or
 * render (this revision) gives way to stock, which says why and keeps the choice and its files; an edit (a new
 * revision) tries it again, and so does the next mods list when only its files could not be had for now
 * (`PackageUnavailable`). Mods being off stops a choice (the core then lists none) but never stock. */
function useStockChoice(name: string, exact = false) {
  const state = useSyncExternalStore(subscribeMods, currentMods);
  // A phone runs only copies of its own screens, once turned on there; the desktop's choices never reach it, and a
  // phone screen's choice never runs on the desktop (`phoneMods.ts`).
  const allowed = personCodeAllowed(useIsPhoneDevice(), usePhoneModsOn(), name);
  const chosenId = exact || !allowed ? undefined : state?.uses?.[`${STOCK_PREFIX}${name}`];
  const listed = chosenId ? state?.mods.find((m) => m.id === chosenId) : undefined;
  // A copy whose `api` range excludes this page's SDK (written for a newer Perch, or the page is an older build than
  // the core, as a relay phone's can be) never takes the screen, not even its last working revision.
  const incompatible = listed?.api && !sdkSatisfies(listed.api) ? `it needs @perch/sdk ${listed.api}; this Perch has ${SDK_VERSION}.` : null;
  const usable = listed && listed.enabled && !listed.error && !incompatible && listed.format === "esm" ? listed : undefined;
  const [failure, setFailure] = useState<{ id: string; revision: string; error: string; until?: unknown } | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  // `until`: the mods list the failure was seen under, when it was only `PackageUnavailable`; a newer list tries again.
  const failedNow = !!usable && failure?.id === usable.id && failure.revision === usable.revision && (failure.until === undefined || failure.until === state);
  const chosen = failedNow ? undefined : usable;
  const broken = failedNow ? failure!.error : listed?.error ?? incompatible;
  const failed = (problem: string, unavailable: boolean) => chosen && setFailure({ id: chosen.id, revision: chosen.revision, error: problem, ...(unavailable ? { until: currentMods() } : {}) });
  const notice = listed && broken && dismissed !== `${listed.id}@${listed.revision}` ? (
    <p className="fixed bottom-2 left-2 z-[2200] m-0 flex max-w-[28rem] items-start gap-2 rounded-ui bg-panel-bg p-2 text-[0.75rem] text-red shadow" role="alert" data-testid={`stock-fallback-${name}`}>
      <span>Your {listed.name} ({listed.id}) could not run in place of Perch&apos;s {name}: {broken} Perch&apos;s own is shown; fix mods/{listed.id} or choose Perch&apos;s own in Settings &gt; Mods.</span>
      <button type="button" className="shrink-0 text-subtext-0 underline" onClick={() => setDismissed(`${listed.id}@${listed.revision}`)}>Dismiss</button>
    </p>
  ) : null;
  return { chosen, failed, notice };
}

/** A stock screen (`stock:<name>`) where Perch shows it: the package of this page's own build, run like any React
 * package and given `props`, or, when the person chose one of their packages for it, that package with the same props
 * (`useStockChoice`). `exact` is the stock screen whatever was chosen (a layout's `mod:stock:<name>`). Mount it only
 * while the screen is shown: a stock screen never runs hidden. `instance` is the place (default `stock:<name>`);
 * `placeholder` holds the screen's room while it loads. */
export function StockView({ name, props, className = "contents", instance, exact, placeholder = null }: {
  name: string;
  props?: Record<string, unknown>;
  className?: string;
  instance?: string;
  exact?: boolean;
  placeholder?: ReactNode;
}) {
  const { chosen, failed, notice } = useStockChoice(name, exact);
  const [mod, setMod] = useState<ModInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wantStock = !chosen;
  useEffect(() => {
    if (!wantStock) return;
    let live = true;
    stockMod(name).then((found) => live && setMod(found), (problem: unknown) => live && setError(describe(problem)));
    return () => { live = false; };
  }, [name, wantStock]);
  const key = instance ?? `stock:${name}`;
  if (chosen) return <ModRoot mod={chosen} props={props} className={className} instance={key} onFailed={failed} forScreen={name} />;
  if (error) return <p className="fixed bottom-2 left-2 z-[2200] m-0 rounded-ui bg-panel-bg p-2 text-[0.75rem] text-red" role="alert" data-testid="stock-error">{error}</p>;
  return <>{notice}{mod ? <ModRoot mod={mod} props={props} className={className} instance={key} /> : placeholder}</>;
}

/**
 * A stock screen Perch draws on demand where it is needed (a confirmation, the notifications): every opener, global
 * or nested, renders this, so choosing a package for `stock:<name>` changes them all. Stock is its source compiled into
 * this page (the same source its exported package is made of, so nothing waits for a load while a dialog opens); a
 * chosen package runs from its own files, with `props` as they are at each render (callbacks included) and no reload
 * when they change. A chosen package that cannot run gives way to stock with a notice (`useStockChoice`).
 */
export function StockRoute<P extends object>({ name, props, stock: Stock, exact }: { name: string; props: P; stock: ComponentType<P>; exact?: boolean }) {
  // `exact`: Perch's own whatever was chosen (a phone, which keeps its own screens).
  const { chosen, failed, notice } = useStockChoice(name, exact);
  const place = useId();
  if (chosen) return <ModRoot mod={chosen} live={props as Record<string, unknown>} className="contents" instance={`stock:${name}:${place}`} onFailed={failed} forScreen={name} />;
  return <>{notice}<Stock {...props} /></>;
}

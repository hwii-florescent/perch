import { useCallback, useEffect, useRef, useState } from "react";
import type { ModInfo, ModRun, ModsPolicy } from "@perch/shared";
import { usePerchStore } from "../store";
import { workspaceRecord } from "../terminalScope";
import { answerPanel } from "../modPanelBridge";
import { approveMod, enableMod, listMods, modPanelUrl, modsAvailable, runModAction, type ModsState } from "../mods";
import { SettingsGroup, SettingRow } from "./ui/setting-row";
import { Select } from "./ui/select";
import { Switch } from "./ui/switch";
import { GHOST_BUTTON } from "./ui/icon-button";
import { BTN_PRIMARY, MUTED, SELECT } from "./ui/settings";

const NO_ANSWER = "No answer from Perch. Try again.";

const MODES: { value: ModsPolicy["mode"]; label: string }[] = [
  { value: "ask", label: "Ask me first" },
  { value: "auto-safe", label: "Approve safe mods automatically" },
  { value: "auto-all", label: "Approve every mod automatically" },
];

const statusText = (mod: ModInfo) => {
  switch (mod.status.state) {
    case "active": return `On${mod.approvedBy ? ` · approved by ${mod.approvedBy === "person" ? "you" : mod.approvedBy.replace("policy:", "your policy: ")}` : ""}`;
    case "disabled": return "Off";
    case "pending": return `Waiting for you to approve it: ${mod.status.reason}`;
    case "invalid": return `Cannot load: ${mod.status.error}`;
  }
};

/** A panel is a page the mod wrote. It runs in a sandboxed iframe with no network and no access to
 * this app (`allow-scripts` only, never `allow-same-origin`); the core also sends it a header that
 * says the same, so opening the URL directly is no different. */
function PanelOverlay({ title, src, canRead, onClose }: { title: string; src: string; canRead: boolean; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const workspaceId = usePerchStore((s) => (s.activeWorkspaceId && workspaceRecord(s, s.activeWorkspaceId)?.hostId === "local" ? s.activeWorkspaceId : null));
  // The panel's origin is opaque, so replies go to "*"; only this frame's own messages are answered.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      void answerPanel(event.data, canRead, workspaceId).then((reply) => reply && frame.current?.contentWindow?.postMessage(reply, "*"));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [canRead, workspaceId]);
  return (
    <div className="fixed inset-0 z-[2100] flex flex-col bg-[rgba(0,0,0,0.55)] p-6" role="dialog" aria-modal="true" aria-label={title} data-testid="mod-panel" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <div className="mx-auto flex min-h-0 w-full max-w-[56rem] flex-1 flex-col gap-2 rounded-ui bg-panel-bg p-3">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-[0.9rem] font-semibold text-fg">{title}</h2>
          <button type="button" className={GHOST_BUTTON} onClick={onClose} autoFocus>Close</button>
        </div>
        <iframe ref={frame} title={title} src={src} sandbox="allow-scripts" referrerPolicy="no-referrer" className="min-h-0 flex-1 rounded-ui border-0 bg-white" />
      </div>
    </div>
  );
}

function RunResult({ run }: { run: ModRun }) {
  return (
    <pre className="m-0 mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-ui bg-surface-1 p-2 text-[0.75rem] text-fg" data-testid="mod-run-result">
      {run.ok ? "Done." : `Failed${run.error ? `: ${run.error}` : run.exitCode !== null ? ` (exit ${run.exitCode})` : ""}.`}
      {run.output ? `\n${run.output}` : ""}
      {run.truncated ? "\n[output cut]" : ""}
    </pre>
  );
}

function ModRow({ mod, busy, onApprove, onEnable, onRun, onOpen, run }: {
  mod: ModInfo; busy: boolean; run?: ModRun;
  onApprove: () => void; onEnable: (enabled: boolean) => void; onRun: (action: string) => void; onOpen: (panel: string, title: string) => void;
}) {
  const state = mod.status.state;
  return (
    <div className="border-b border-surface-1 py-[0.8rem] last:border-b-0" data-testid={`mod-${mod.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[0.85rem] font-medium text-fg">{mod.name || mod.id} <span className={MUTED}>{mod.version}</span></div>
          {mod.description && <div className={MUTED}>{mod.description}</div>}
          <div className={MUTED} data-testid={`mod-${mod.id}-status`}>{statusText(mod)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {state === "pending" && <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={onApprove}>Approve</button>}
          {state === "active" && mod.actions.map((action) => (
            <button key={action.id} type="button" className={GHOST_BUTTON} disabled={busy} onClick={() => onRun(action.id)}>{action.title}</button>
          ))}
          {state === "active" && mod.panels.map((panel) => (
            <button key={panel.id} type="button" className={GHOST_BUTTON} onClick={() => onOpen(panel.id, `${mod.name}: ${panel.title}`)}>Open {panel.title}</button>
          ))}
          {(state === "active" || state === "disabled") && (
            <button type="button" className={GHOST_BUTTON} disabled={busy} onClick={() => onEnable(state === "disabled")}>{state === "disabled" ? "Turn on" : "Turn off"}</button>
          )}
        </div>
      </div>
      {mod.preview.length > 0 && (
        <details className="mt-2" open={state === "pending"}>
          <summary className={MUTED}>{state === "pending" ? "Approving lets this run as you" : "What it runs"}</summary>
          <ul className="m-0 mt-1 list-none p-0 font-mono text-[0.75rem] text-fg">
            {mod.preview.map((line) => <li key={line} className="break-all">{line}</li>)}
          </ul>
          <div className={MUTED}>Needs: {mod.required.join(", ") || "nothing special"}</div>
        </details>
      )}
      {run && <RunResult run={run} />}
    </div>
  );
}

/** Settings > Mods: how mods get approved, an off switch, and every mod with what approving it lets
 * run. The core decides; this lists, and a click here is a person's approval. */
export function ModsSection() {
  const settings = usePerchStore((s) => s.settings);
  const updateSettings = usePerchStore((s) => s.updateSettings);
  const [state, setState] = useState<ModsState | null>(null);
  const [loaded, setLoaded] = useState<"loading" | "ready" | "unavailable">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, ModRun>>({});
  const [panel, setPanel] = useState<{ title: string; src: string; canRead: boolean } | null>(null);

  const take = useCallback((next: ModsState | null) => {
    if (!next) { setMessage(NO_ANSWER); return; }
    setState(next);
    setMessage(next.error ?? null);
  }, []);

  // Listed again whenever the policy changes, because it can approve what was waiting.
  const policyKey = `${settings?.mods?.mode ?? "ask"}/${settings?.mods?.off ?? false}`;
  useEffect(() => {
    if (!modsAvailable()) { setLoaded("unavailable"); return; }
    void listMods().then((next) => { take(next); setLoaded(next ? "ready" : "unavailable"); });
  }, [policyKey, take]);

  const policy: ModsPolicy = settings?.mods ?? { mode: "ask", off: false };
  const act = async (id: string, work: () => Promise<ModsState | null>) => {
    setBusy(id);
    take(await work());
    setBusy(null);
  };

  return (
    <>
      <SettingsGroup title="Mods">
        <SettingRow title="When a mod is new or changed" description="A mod is a folder you or an agent wrote that adds panels, actions or reactions to Perch. Nothing of it runs until it is approved. Safe mods only show a panel, react to events and read project files; anything that builds, uses the network or writes project files still asks you.">
          <Select className={SELECT} testId="settings-mods-mode" ariaLabel="When a mod is new or changed" disabled={!settings} value={policy.mode} onChange={(value) => updateSettings({ mods: { ...policy, mode: value as ModsPolicy["mode"] } })} options={MODES} />
        </SettingRow>
        <SettingRow title="Turn all mods off" description="Nothing is shown or run, and nothing can be approved, until you turn them back on. Starting Perch with PERCH_MODS=off does the same when the app will not open.">
          <Switch label="Turn all mods off" testId="settings-mods-off" checked={policy.off} onChange={(checked) => updateSettings({ mods: { ...policy, off: checked } })} />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="Installed mods">
        {loaded === "unavailable" && <p className={`${MUTED} py-3`}>{modsAvailable() ? NO_ANSWER : "This Perch cannot manage mods."}</p>}
        {loaded === "loading" && <p className={`${MUTED} py-3`}>Loading…</p>}
        {state && loaded === "ready" && (
          <>
            {state.mods.length === 0 && <p className={`${MUTED} py-3`}>No mods yet. Ask an agent in a Perch session to make one, or add a folder with a perch-mod.toml to {state.folder}.</p>}
            {state.mods.map((mod) => (
              <ModRow
                key={mod.id}
                mod={mod}
                busy={busy === mod.id}
                run={runs[mod.id]}
                onApprove={() => void act(mod.id, () => approveMod(mod.id, mod.hash))}
                onEnable={(enabled) => void act(mod.id, () => enableMod(mod.id, enabled))}
                onRun={(action) => void act(mod.id, async () => {
                  const answer = await runModAction(mod.id, action);
                  if (answer?.run) setRuns((all) => ({ ...all, [mod.id]: answer.run! }));
                  return answer;
                })}
                onOpen={(panelId, title) => setPanel({ title, src: modPanelUrl(mod.id, panelId), canRead: mod.required.includes("read-project") })}
              />
            ))}
          </>
        )}
        {message && <p className="py-2 text-[0.8rem] text-red" role="alert" data-testid="mods-message">{message}</p>}
      </SettingsGroup>
      {panel && <PanelOverlay title={panel.title} src={panel.src} canRead={panel.canRead} onClose={() => setPanel(null)} />}
    </>
  );
}

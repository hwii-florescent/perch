//! Start, the stock screen `stock:start`: what the main area shows with nothing open. Perch shows it, or the person's
//! package chosen for it (`perch mod use stock:start <id>`), with the same props; `kind` says which page it is:
//!
//! - `connecting`: the connection is down, so nothing can start until it is back;
//! - `home` (Orca's): the name, a hint, Add project and New session, and the keys worth knowing;
//! - `workspace`: the focused workspace's start picker, one button per agent, in its folder or another place;
//! - `cli`: CLI mode before this session has a place to run, with the host's agent list and its loading/error state.
//!
//! Starting is Perch's (`actions.start`, `actions.startIn`): a session is created on the right host in the chosen
//! folder, or this session is resumed in place. Which place is chosen is Perch's too (`targetKey`, `actions.choose`),
//! so it survives a swap to a copy; Add project selects the project it creates.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:start` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside it
//! (docs/MOD-SDK.md).
import { useState } from "react";
import { cn, NewSessionMenu, type StartScreenProps } from "@perch/sdk";
import { FolderPicker, START_HINT, START_LINK, START_NAME, START_PANEL, StartCard, startAction } from "./card";

const FONT = "[font-family:inherit] [font-weight:inherit] [line-height:inherit]";
const KBD = `min-w-6 rounded-ui bg-surface-0 px-[0.35rem] py-[0.1rem] text-center text-[0.75rem] text-fg ${FONT}`;
const STATUS = "flex items-baseline gap-[0.45rem] text-[0.78rem] text-subtext-0";
const STATUS_BUTTON = "cursor-pointer bg-transparent p-0 text-accent underline [border:0] [font:inherit]";

const SHORTCUTS: [string, string[]][] = [
  ["New session", ["Ctrl", "Space", "C"]],
  ["Jump to a session", ["Ctrl", "K"]],
  ["Toggle sidebar", ["Ctrl", "Space", "B"]],
  ["All shortcuts", ["?"]],
];

export default function Start(props: StartScreenProps) {
  if (props.kind === "connecting") {
    return (
      <div className={cn(START_PANEL, "items-start")} data-testid="no-session-panel">
        <div className="flex w-full max-w-[26rem] flex-col gap-3">
          <h2 className="m-0 text-[1rem] font-semibold text-fg">Connecting…</h2>
          <p className="m-0 text-[0.85rem] leading-[1.45] text-subtext-0">Waiting for the connection to perch to come back.</p>
        </div>
      </div>
    );
  }
  if (props.kind === "home") return <Home {...props} />;
  const { kind, targets, targetKey, choices, discovery, disabled, canManageAgents, actions } = props;
  const target = targets.find((candidate) => candidate.key === targetKey) ?? targets[0];
  if (!target) return null;
  const cli = kind === "cli";
  return (
    <StartCard
      name={target.name}
      path={target.path}
      choices={choices}
      idPrefix={cli ? "cli-start-agent" : "workspace-start"}
      testId={cli ? "cli-start-panel" : "no-session-panel"}
      disabled={disabled}
      onPick={actions.start}
      openSettings={actions.openSettings}
      target={<FolderPicker targets={targets} value={target.key} onChange={actions.choose} onAdd={actions.addProject} testId={cli ? "cli-start-target" : "workspace-start-target"} />}
      status={discovery && <>
        {discovery.state === "empty" && (
          <div className={STATUS} role="status">
            No CLI providers are available on this host. Install a provider or check its configuration, then retry.
            <button type="button" className={STATUS_BUTTON} onClick={actions.retry}>Retry</button>
          </div>
        )}
        {discovery.state === "loading" && (
          <div className={STATUS} role="status" data-testid="cli-manifest-loading">
            Checking providers on {discovery.hostLabel}…
          </div>
        )}
        {discovery.state === "error" && (
          <div className={cn(STATUS, "text-red")} role="alert">
            {discovery.error || "Provider discovery failed."}
            <button type="button" className={STATUS_BUTTON} onClick={actions.retry}>Retry</button>
          </div>
        )}
      </>}
      extraLinks={cli && canManageAgents && (
        <button type="button" className={START_LINK} data-testid="cli-manage-agents" onClick={actions.manageAgents}>Manage agents</button>
      )}
    />
  );
}

/** Nothing focused: the name, a hint, the two ways in (Add project, New session) and the keys worth knowing. */
function Home({ hostId, logo, projectCwds, actions }: StartScreenProps) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  return (
    <div className={cn(START_PANEL, "items-center")} data-testid="no-session-panel">
      <div className="flex w-full max-w-[24rem] flex-col items-center gap-4">
        <img src={logo} alt="" width={80} height={80} className="rounded-ui" draggable={false} />
        <h1 className={START_NAME}>perch</h1>
        <p className={START_HINT}>Select a workspace from the sidebar to begin.</p>
        <div className="flex flex-wrap justify-center gap-[0.6rem]">
          <button type="button" className={startAction()} data-testid="home-add-project" onClick={actions.addProject}>
            Add project
          </button>
          <button
            type="button"
            className={startAction()}
            data-testid="no-session-create"
            onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}
          >
            New session
          </button>
        </div>
        <dl className="mx-0 mt-4 mb-0 flex w-full flex-col gap-[0.45rem]">
          {SHORTCUTS.map(([label, keys]) => (
            <div key={label} className="flex items-center justify-between gap-4 text-[0.8rem] text-subtext-0">
              <dt>{label}</dt>
              <dd className="m-0 flex gap-1">{keys.map((key) => <kbd key={key} className={KBD}>{key}</kbd>)}</dd>
            </div>
          ))}
        </dl>
      </div>
      {anchor && (
        <NewSessionMenu
          hostId={hostId}
          cwd={null}
          projects={projectCwds}
          anchorRect={anchor}
          onClose={() => setAnchor(null)}
          onSelect={actions.startIn}
        />
      )}
    </div>
  );
}

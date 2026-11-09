//! The start card (`stock:start`): a place's name and path, the "where" picker, one button per agent, and the link to
//! the setting that skips this page. The home screen and the CLI start panel use the same look.
import type { ReactNode } from "react";
import { buttonClass, cn, Select, type StartTarget } from "@perch/sdk";

export const START_PANEL = "flex min-h-0 min-w-0 flex-1 justify-center overflow-y-auto bg-panel-bg px-4 py-8";
export const START_NAME = "m-0 text-[2.4rem] font-bold tracking-[-0.02em] text-fg";
export const START_HINT = "m-0 text-center text-[0.85rem] text-subtext-0";
/** A start button (called while rendering: an SDK call at module top level would run inside the SDK's import cycle). */
export const startAction = () => buttonClass({ variant: "soft", size: "lg", className: "text-fg" });
export const START_LINK = "cursor-pointer bg-transparent p-0 text-[0.75rem] text-subtext-0 [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] hover:text-fg hover:underline focus-visible:text-fg focus-visible:underline";
const PICKER = "min-h-[32px] [.app--mobile_&]:min-h-[44px] w-full rounded-ui py-[0.3rem] pr-[0.55rem] pl-[0.45rem] text-fg bg-[var(--picker-bg,var(--panel-bg))] [font-family:inherit] focus-visible:[outline:1px_solid_var(--accent)] max-w-full text-[0.8rem] [--picker-bg:var(--surface-0)]";
const ADD = "\0add-project";

/** The folder chip (Codex's project chip): the targets, then "Add project…", which is never a target itself. */
export function FolderPicker({ targets, value, onChange, onAdd, testId = "cli-start-target" }: { targets: StartTarget[]; value: string; onChange: (key: string) => void; onAdd: () => void; testId?: string }) {
  return <Select
    className={PICKER}
    ariaLabel="Where to open"
    testId={testId}
    value={value}
    onChange={(key) => (key === ADD ? onAdd() : onChange(key))}
    options={[...targets.map((target) => ({ value: target.key, label: target.label })), { value: ADD, text: "Add project", label: <span className="text-accent">Add project…</span> }]}
  />;
}

export function StartCard({ name, path, choices, idPrefix, testId, disabled, onPick, target, status, extraLinks, openSettings }: {
  name: string;
  path: string;
  choices: { id: string; label: string }[];
  /** Agent buttons get `data-testid="<idPrefix>-<agent id>"`. */
  idPrefix: string;
  testId: string;
  disabled?: boolean;
  onPick: (agent: string) => void;
  target?: ReactNode;
  status?: ReactNode;
  extraLinks?: ReactNode;
  openSettings: () => void;
}) {
  return (
    <div className={cn(START_PANEL, "items-center")} data-testid={testId}>
      <div className="flex w-full max-w-[24rem] flex-col items-center gap-4">
        <h1 className={cn(START_NAME, "max-w-full overflow-hidden text-[1.6rem] text-ellipsis whitespace-nowrap")}>{name}</h1>
        <p className={START_HINT} title={path}>{path}</p>
        {target}
        <p className={START_HINT}>What do you want to open?</p>
        {status}
        <div className="flex flex-wrap justify-center gap-[0.6rem]">
          {choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className={cn(startAction(), "max-[700px]:min-h-11")}
              disabled={disabled}
              data-testid={`${idPrefix}-${choice.id}`}
              onClick={() => onPick(choice.id)}
            >
              {choice.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          {extraLinks}
          <button type="button" className={START_LINK} onClick={openSettings}>
            Open one automatically: Settings → Empty workspace opens
          </button>
        </div>
      </div>
    </div>
  );
}

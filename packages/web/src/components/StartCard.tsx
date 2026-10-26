import type { ReactNode } from "react";
import { usePerchStore } from "../store";
import { cn } from "../lib/cn";
import { button } from "./ui/button";

/** The "what do you want to open?" screen: the home screen (`NoSessionPanel`), a focused workspace's
 * start picker and the CLI start panel (`CliStartPanel`) all use these, so they look alike. */
export const START_PANEL = "flex min-h-0 min-w-0 flex-1 justify-center overflow-y-auto bg-panel-bg px-4 py-8";
export const START_NAME = "m-0 text-[2.4rem] font-bold tracking-[-0.02em] text-fg";
export const START_HINT = "m-0 text-center text-[0.85rem] text-subtext-0";
export const START_ACTION = button({ variant: "soft", size: "lg", className: "text-fg" });
const LINK = "cursor-pointer bg-transparent p-0 text-[0.75rem] text-subtext-0 [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] hover:text-fg hover:underline focus-visible:text-fg focus-visible:underline";
export const START_LINK = LINK;

export interface StartChoice { id: string; label: string }

/** A place's name and path, an optional `target` picker under them, one button per agent, and the
 * link to the setting that skips this page. `status` carries load and error messages. */
export function StartCard({ name, path, choices, idPrefix, testId, disabled, onPick, target, status, extraLinks }: {
  name: string;
  path: string;
  choices: StartChoice[];
  /** Agent buttons get `data-testid="<idPrefix>-<agent id>"`. */
  idPrefix: string;
  testId: string;
  disabled?: boolean;
  onPick: (agent: string) => void;
  target?: ReactNode;
  status?: ReactNode;
  extraLinks?: ReactNode;
}) {
  const setSettingsOpen = usePerchStore((s) => s.setSettingsOpen);
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
              className={cn(START_ACTION, "max-[700px]:min-h-11")}
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
          <button type="button" className={LINK} onClick={() => setSettingsOpen(true)}>
            Open one automatically: Settings → Empty workspace opens
          </button>
        </div>
      </div>
    </div>
  );
}

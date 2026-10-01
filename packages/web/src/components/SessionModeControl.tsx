import type { SessionMode, SessionModeScope } from "@perch/shared";
import { ModeSwitch } from "./ModeSwitch";

export type SessionModeOverrideScope = Exclude<SessionModeScope, "default">;

export interface SessionModeControlProps {
  mode: SessionMode;
  state: "idle" | "loading" | "ready" | "error";
  error?: string;
  onChange: (mode: SessionMode) => void;
}

/**
 * The session header's UI/CLI switch. It always writes this session's mode;
 * workspace and device defaults live in Settings → Chat Mode.
 */
export function SessionModeControl({ mode, state, error, onChange }: SessionModeControlProps) {
  return (
    <div className="session-mode-control" data-testid="session-mode-control">
      <div className="session-mode-control__main">
        <ModeSwitch mode={mode} onChange={onChange} testId="session-mode-toggle" disabled={state === "loading"} />
        {state === "error" && (
          <span className="session-mode-control__status session-mode-control__status--error" role="alert">
            {error || "Mode could not be saved."}
          </span>
        )}
      </div>
    </div>
  );
}

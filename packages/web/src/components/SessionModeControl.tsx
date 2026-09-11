import { useEffect, useState } from "react";
import type { SessionMode, SessionModeScope } from "@perch/shared";
import { ModeSwitch } from "./ModeSwitch";

export type SessionModeOverrideScope = Exclude<SessionModeScope, "default">;

export interface SessionModeControlProps {
  mode: SessionMode;
  scope: SessionModeScope;
  state: "idle" | "loading" | "ready" | "error";
  error?: string;
  hasWorkspace: boolean;
  /** Runtime mode writes are capability gated by the owning host. */
  canPersist: boolean;
  onChange: (mode: SessionMode, scope: SessionModeOverrideScope) => void;
  onClear: (scope: SessionModeOverrideScope) => void;
}

const OVERRIDE_SCOPES: SessionModeOverrideScope[] = ["session", "workspace", "device"];

function scopeLabel(scope: SessionModeScope): string {
  switch (scope) {
    case "session": return "Session";
    case "workspace": return "Workspace";
    case "device": return "Device";
    default: return "Inherited";
  }
}

/**
 * The mode control is deliberately available in the session surface instead
 * of hiding the important Chat/CLI choice in global settings. The select
 * makes the scope of a write explicit, which prevents a phone or a split
 * pane from accidentally changing every session on a device.
 */
export function SessionModeControl({
  mode,
  scope,
  state,
  error,
  hasWorkspace,
  canPersist,
  onChange,
  onClear,
}: SessionModeControlProps) {
  const [selectedScope, setSelectedScope] = useState<SessionModeOverrideScope>(
    scope === "default" ? "session" : scope,
  );

  useEffect(() => {
    if (scope !== "default") setSelectedScope(scope);
  }, [scope]);

  const pending = state === "loading";
  const scopeIsValid = selectedScope !== "workspace" || hasWorkspace;
  const disabled = !canPersist || pending || !scopeIsValid;
  const effectiveLabel = scopeLabel(scope);

  return (
    <div className="session-mode-control" data-testid="session-mode-control">
      <div className="session-mode-control__main">
        <ModeSwitch
          mode={mode}
          onChange={(next) => onChange(next, selectedScope)}
          testId="session-mode-toggle"
          disabled={disabled}
        />
        <span
          className="session-mode-control__scope"
          data-testid="session-mode-effective-scope"
          title={scope === "default" ? "No session, workspace, or device override" : `${effectiveLabel} override`}
        >
          {effectiveLabel}
        </span>
        {pending && <span className="session-mode-control__status" role="status">Saving…</span>}
        {state === "error" && (
          <span className="session-mode-control__status session-mode-control__status--error" role="alert">
            {error || "Mode could not be saved."}
          </span>
        )}
      </div>

      <label className="session-mode-control__target">
        <span>Apply to</span>
        <select
          value={selectedScope}
          data-testid="session-mode-scope"
          aria-label="Mode override scope"
          disabled={!canPersist || pending}
          onChange={(event) => setSelectedScope(event.target.value as SessionModeOverrideScope)}
        >
          {OVERRIDE_SCOPES.map((candidate) => (
            <option
              key={candidate}
              value={candidate}
              disabled={candidate === "workspace" && !hasWorkspace}
            >
              {scopeLabel(candidate)}
            </option>
          ))}
        </select>
      </label>

      {scope !== "default" && (
        <button
          type="button"
          className="session-mode-control__clear"
          data-testid="session-mode-clear"
          disabled={disabled}
          onClick={() => onClear(scope)}
        >
          Use inherited mode
        </button>
      )}

      {!canPersist && (
        <span className="session-mode-control__hint" data-testid="session-mode-unsupported">
          This host uses the legacy mode setting.
        </span>
      )}
    </div>
  );
}

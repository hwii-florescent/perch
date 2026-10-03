import { cn } from "../lib/cn";
import { MODE_LABEL_CLI, MODE_LABEL_HOSTED, MODE_SWITCH, MODE_THUMB, MODE_TRACK } from "./ui/composer";

export function ModeSwitch({
  mode,
  onChange,
  testId = "mode-switch",
  disabled = false,
}: {
  mode: "hosted" | "cli";
  onChange: (mode: "hosted" | "cli") => void;
  testId?: string;
  disabled?: boolean;
}) {
  const isCli = mode === "cli";
  return (
    <button
      type="button"
      className={MODE_SWITCH}
      data-testid={testId}
      role="switch"
      aria-checked={isCli}
      aria-label="Toggle UI / CLI mode"
      disabled={disabled}
      onClick={() => onChange(isCli ? "hosted" : "cli")}
    >
      <span className={cn("mode-switch__label mode-switch__label--hosted", MODE_LABEL_HOSTED)}>UI</span>
      <span className={cn("mode-switch__track", MODE_TRACK)}>
        <span className={cn("mode-switch__thumb", MODE_THUMB)} />
      </span>
      <span className={cn("mode-switch__label mode-switch__label--cli", MODE_LABEL_CLI)}>CLI</span>
    </button>
  );
}

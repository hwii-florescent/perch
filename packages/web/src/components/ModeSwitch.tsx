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
      className="mode-switch"
      data-testid={testId}
      role="switch"
      aria-checked={isCli}
      aria-label="Toggle Hosted / CLI mode"
      disabled={disabled}
      onClick={() => onChange(isCli ? "hosted" : "cli")}
    >
      <span className="mode-switch__label mode-switch__label--hosted">Hosted</span>
      <span className="mode-switch__track">
        <span className="mode-switch__thumb" />
      </span>
      <span className="mode-switch__label mode-switch__label--cli">CLI</span>
    </button>
  );
}

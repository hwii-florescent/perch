export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: "hosted" | "cli";
  onChange: (mode: "hosted" | "cli") => void;
}) {
  const isCli = mode === "cli";
  return (
    <button
      type="button"
      className="mode-switch"
      role="switch"
      aria-checked={isCli}
      aria-label="Toggle Hosted / CLI mode"
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

/** Toggle switch. A real checkbox underneath (so labels, keyboard and tests
 * work unchanged), drawn as a track and knob. */
export function Switch({ checked, onChange, testId, label }: { checked: boolean; onChange: (checked: boolean) => void; testId?: string; label: string }) {
  return (
    <input
      type="checkbox"
      role="switch"
      aria-label={label}
      data-testid={testId}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="relative h-[1.25rem] w-[2.25rem] shrink-0 cursor-pointer appearance-none rounded-full bg-overlay-0 [transition:background_0.12s_ease] before:absolute before:top-[0.15rem] before:left-[0.15rem] before:h-[0.95rem] before:w-[0.95rem] before:rounded-full before:bg-fg before:content-[''] before:[transition:transform_0.12s_ease] checked:bg-accent checked:before:translate-x-[1rem] checked:before:bg-panel-bg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px]"
    />
  );
}

import { Select, cn, type NativeUiOptions, type NativeUiPicker } from "@perch/sdk";

/** What may change the CLI's options from here: the person holds the input lease, the core offers it
 * (`agent.ui.options`) and no change is already in flight. */
export interface OptionChange {
  enabled: boolean;
  busy: boolean;
  apply: (option: string, value: string) => void;
}

const TRIGGER = "max-w-[14rem] cursor-pointer truncate rounded-ui border-0 bg-transparent px-1 py-0 text-[12px] text-subtext-0 hover:bg-surface-1 hover:text-fg";

function PickerSelect({ picker, change }: { picker: NativeUiPicker; change: OptionChange }) {
  // Approvals off is the one setting worth a standing cue (Codex draws it the same way).
  const tone = picker.id === "mode" && picker.current === "full-access" ? "text-yellow" : undefined;
  const locked = !picker.settable ? "Wait for the turn or the prompt to finish." : !change.enabled ? "Take control to change this." : undefined;
  const title = [picker.label, locked, picker.note].filter(Boolean).join(" · ");
  return <Select
    className={cn(TRIGGER, tone)}
    ariaLabel={picker.label}
    testId={`native-cli-pick-${picker.id}`}
    title={title}
    value={picker.current ?? ""}
    placeholder={picker.label}
    disabled={!picker.settable || !change.enabled || change.busy}
    options={picker.choices.map((choice) => ({ value: choice.value, text: choice.label, label: <span><span>{choice.label}</span>{choice.description && <span className="ml-2 text-subtext-0">{choice.description}</span>}</span> }))}
    onChange={(value) => { if (value !== picker.current) change.apply(picker.id, value); }}
  />;
}

/** The session's model, effort and permission mode. Where the core offers a picker (the value was read
 * back from the CLI) it is one; otherwise the option is plain text as the CLI last reported it, worded
 * by the core (`native_ui/session_options.rs`). */
export function OptionLabels({ options, change, only }: { options?: NativeUiOptions; change?: OptionChange; only?: "effort" | "mode" }) {
  const pickers = change ? options?.pickers ?? [] : [];
  const picked = (id: string) => pickers.find((picker) => picker.id === id);
  const effort = picked("effort"), mode = picked("mode");
  if (!options?.effort && !options?.permissionMode && !pickers.length) return null;
  return <>
    {only !== "mode" && (effort && change ? <PickerSelect picker={effort} change={change} />
      : options?.effort && <span className="text-[12px] text-subtext-0" title="Reasoning effort, as the CLI reports it" data-testid="native-cli-effort">{options.effort}</span>)}
    {only !== "effort" && (mode && change ? <PickerSelect picker={mode} change={change} />
      : options?.permissionMode && <span className="text-[12px] text-subtext-0" title="Permission mode, as of the CLI's last report" data-testid="native-cli-permission-mode">{options.permissionMode}</span>)}
  </>;
}

/** The model picker, when the core offers one. */
export function ModelPicker({ options, change }: { options?: NativeUiOptions; change?: OptionChange }) {
  const picker = change ? options?.pickers?.find((entry) => entry.id === "model") : undefined;
  return picker && change ? <PickerSelect picker={picker} change={change} /> : null;
}

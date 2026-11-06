import type { NativeUiOptions } from "@perch/shared";

/** The session's effort and permission mode as the CLI last reported them (worded by the core,
 * `native_ui/session_options.rs`). Read-only text: nothing here changes a live session. */
export function OptionLabels({ options }: { options?: NativeUiOptions }) {
  if (!options?.effort && !options?.permissionMode) return null;
  return <>
    {options.effort && <span className="text-[12px] text-subtext-0" title="Reasoning effort, as the CLI reports it" data-testid="native-cli-effort">{options.effort}</span>}
    {options.permissionMode && <span className="text-[12px] text-subtext-0" title="Permission mode, as of the CLI's last report" data-testid="native-cli-permission-mode">{options.permissionMode}</span>}
  </>;
}

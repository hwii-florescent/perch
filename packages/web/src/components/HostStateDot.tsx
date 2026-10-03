import type { HostConnectionState } from "@perch/shared";
import { cn } from "../lib/cn";

// `host-state*` stay as unstyled hooks: e2e/federation and e2e/nav match them.
const DOT: Record<HostConnectionState, string> = {
  connected: "host-state--connected bg-accent",
  connecting: "host-state--connecting animate-host-pulse bg-yellow",
  error: "host-state--error bg-red",
  disabled: "host-state--disabled bg-subtext-0",
};

/** Colored dot for a host's connection state; the title carries the error text. */
export function HostStateDot({ state, error }: { state: HostConnectionState; error?: string }) {
  return (
    <span
      className={cn("host-state inline-block h-2 w-2 shrink-0 rounded-[50%]", DOT[state] ?? DOT.disabled)}
      title={state === "error" && error ? error : state}
    />
  );
}

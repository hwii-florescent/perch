import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { slotFor, subscribeSlots, type SlotName, type SlotProps } from "../slots";

/** Shows what a mod drew for this slot (`api.slot`), else `children`, the stock interface. A mod that
 * throws falls back to the stock interface until the mod changes. */
export function Slot({ name, data, actions, className, children }: {
  name: SlotName;
  data: SlotProps["data"];
  actions: SlotProps["actions"];
  className?: string;
  children: ReactNode;
}) {
  const provider = useSyncExternalStore(subscribeSlots, () => slotFor(name));
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(actions);
  latest.current = actions;
  const [failed, setFailed] = useState<unknown>(null);
  const key = JSON.stringify(data);
  useEffect(() => setFailed(null), [provider]);
  const active = provider && failed !== provider;
  useEffect(() => {
    if (!provider || failed === provider || !host.current) return;
    // Actions go through `latest`, so a stale closure never runs after the component moved on.
    const stable = Object.fromEntries(Object.keys(latest.current).map((action) => [action, (...args: unknown[]) => latest.current[action]?.(...args)]));
    try {
      const cleanup = provider.render(host.current, { data: JSON.parse(key), actions: stable });
      return () => {
        try { cleanup?.(); } catch (error) { console.error(`mod ${provider.modId}: slot ${name} cleanup failed`, error); }
        host.current?.replaceChildren();
      };
    } catch (error) {
      console.error(`mod ${provider.modId}: slot ${name} failed, showing the stock one`, error);
      host.current.replaceChildren();
      setFailed(provider);
    }
  }, [provider, key, failed, name]);
  if (!active) return <>{children}</>;
  return <div ref={host} className={className} data-slot={name} data-slot-mod={provider.modId} />;
}

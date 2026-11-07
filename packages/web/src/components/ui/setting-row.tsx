import { createContext, useContext, type ReactNode } from "react";

/** The settings search text. A group whose title matches clears it for its rows (shows them all);
 * otherwise a row renders only when its title or plain-text description contains it. */
export const SettingsQuery = createContext("");
const has = (text: unknown, q: string) => typeof text === "string" && text.toLowerCase().includes(q);

/** A settings page block: a quiet heading (omitted when the page title says it) above one rounded card. */
export function SettingsGroup({ title, children, testId }: { title?: string; children: ReactNode; testId?: string }) {
  const q = useContext(SettingsQuery);
  const titled = q !== "" && has(title, q);
  return (
    // While searching, a group with no matching row (and no matching title) hides itself.
    <section className={q && !titled ? "mb-8 not-has-[[data-setting-row]]:hidden" : "mb-8"} data-testid={testId}>
      {title && <h3 className="m-0 mb-3 text-[0.9rem] font-medium text-fg">{title}</h3>}
      <div className="rounded-ui bg-surface-0 px-4">
        <SettingsQuery.Provider value={titled ? "" : q}>{children}</SettingsQuery.Provider>
      </div>
    </section>
  );
}

/** One setting inside a card: label and description on the left, the control
 * on the right, a hairline between rows. On a phone a control too wide to sit
 * beside its label wraps under it. */
export function SettingRow({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  const q = useContext(SettingsQuery);
  if (q && !has(title, q) && !has(description, q)) return null;
  return (
    <div data-setting-row className="flex items-center justify-between gap-6 py-[0.8rem] max-[700px]:flex-wrap max-[700px]:gap-y-2">
      <div className="min-w-0 max-[700px]:flex-1 max-[700px]:basis-56">
        <div className="text-[0.85rem] text-fg">{title}</div>
        {description && <div className="mt-[0.15rem] text-[0.75rem] text-subtext-0">{description}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

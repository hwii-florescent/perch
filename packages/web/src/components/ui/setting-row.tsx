import { type ReactNode } from "react";

/** A settings page block: a quiet heading (omitted when the page title says it) above one rounded card. */
export function SettingsGroup({ title, children, testId }: { title?: string; children: ReactNode; testId?: string }) {
  return (
    <section className="mb-8" data-testid={testId}>
      {title && <h3 className="m-0 mb-3 text-[0.9rem] font-medium text-fg">{title}</h3>}
      <div className="rounded-ui bg-surface-0 px-4">{children}</div>
    </section>
  );
}

/** One setting inside a card: label and description on the left, the control
 * on the right, a hairline between rows. */
export function SettingRow({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-[0.8rem] [&:not(:last-child)]:border-b [&:not(:last-child)]:border-b-overlay-0">
      <div className="min-w-0">
        <div className="text-[0.85rem] text-fg">{title}</div>
        {description && <div className="mt-[0.15rem] text-[0.75rem] text-subtext-0">{description}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

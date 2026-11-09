//! The sidebar's small icons, drawn in the current text color. Part of the stock screen `stock:sidebar`.
type IconProps = { size?: number; className?: string };

export const PlusIcon = ({ size = 14, className }: IconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <path d="M8 2.5v11M2.5 8h11" />
  </svg>
);

export const EllipsisIcon = ({ size = 14, className }: IconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <circle cx="3.5" cy="8" r="1.1" /><circle cx="8" cy="8" r="1.1" /><circle cx="12.5" cy="8" r="1.1" />
  </svg>
);

/** Settings: a cog outline, so it draws the same on every platform. */
export const GearIcon = ({ size = 16, className }: IconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
    <path d="M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" />
    <circle cx="8" cy="8" r="2" />
  </svg>
);

/** The disclosure arrow: down when open, right when folded. */
export const Chevron = ({ open, size = 12, className }: IconProps & { open: boolean }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={open ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5"} />
  </svg>
);

/** The mark that says a line is a project (a folder; filled for a favourite). */
export const FolderMark = ({ className = "mr-1.5 h-3 w-3 shrink-0 text-subtext-0", filled = false, testId }: { className?: string; filled?: boolean; testId?: string }) => (
  <svg className={className} data-testid={testId} viewBox="0 0 16 16" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M2 5V4a1 1 0 0 1 1-1h3l2 2h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5Z" />
  </svg>
);

/** A session row's ×. */
export const RowCloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true"><path d="m3 3 6 6m0-6-6 6" /></svg>
);

/** New chat: a pencil over a page. */
export const NewChatIcon = () => (
  <svg className="mx-auto" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 3H4.5A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13h7a1.5 1.5 0 0 0 1.5-1.5V8M11.2 2.8a1.2 1.2 0 0 1 1.7 1.7L8.5 8.9 6 9.5l.6-2.5z" />
  </svg>
);

/** A checkout: a diamond for a project's main folder, a branch for a worktree. */
export const CheckoutIcon = ({ linked }: { linked: boolean }) => (
  <svg className="h-3 w-3 shrink-0 text-subtext-0" data-testid="workspace-checkout-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {linked ? <>
      <circle cx="4" cy="3" r="1.5" />
      <circle cx="4" cy="13" r="1.5" />
      <circle cx="12" cy="3" r="1.5" />
      <path d="M4 4.5v7M4 9h4a4 4 0 0 0 4-4v-.5" />
    </> : <path d="M8 3l5 5-5 5-5-5z" />}
  </svg>
);

/** The organize menu's button: three shortening lines. */
export const OrganizeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3" />
  </svg>
);

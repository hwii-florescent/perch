/** The one disclosure arrow: pointing down when open, right when collapsed.
 * Used by every collapsible header (Chats, projects) and the Files tree, so
 * they always look alike. Takes its colour from `currentColor`. */
export function Chevron({ open, size = 12, className }: { open: boolean; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={open ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5"} />
    </svg>
  );
}

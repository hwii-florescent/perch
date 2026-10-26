/** A line plus in `currentColor` (docs/UI-UX-DIRECTION.md Appendix E: never a text
 * character as an icon). */
export function EllipsisIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="3.5" cy="8" r="1.1" /><circle cx="8" cy="8" r="1.1" /><circle cx="12.5" cy="8" r="1.1" />
    </svg>
  );
}

export function PlusIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M8 2.5v11M2.5 8h11" />
    </svg>
  );
}

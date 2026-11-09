//! The tab strip's small icons (a browser page, a file, a review, the tab's ×), drawn in the current
//! text color. Part of the stock screen `stock:tabs`; the launcher (`stock:launcher`) draws its own two.
const ICON = { viewBox: "0 0 16 16", width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
export const BrowserIcon = () => <svg {...ICON}><circle cx="8" cy="8" r="6" /><path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" /></svg>;
export const FileIcon = () => <svg {...ICON}><path d="M9 2H4.5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5.5zM9 2v3.5h3.5" /></svg>;
export const ReviewIcon = () => <svg {...ICON}><circle cx="4" cy="3" r="1.5" /><circle cx="4" cy="13" r="1.5" /><circle cx="12" cy="3" r="1.5" /><path d="M4 4.5v7M4 9h4a4 4 0 0 0 4-4v-.5" /></svg>;
export const TabCloseIcon = () => <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true"><path d="m2 2 6 6m0-6-6 6" /></svg>;

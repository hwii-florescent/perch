import { create } from "zustand";
import { readViewerStored, viewerKey } from "./viewer";

/** What a browser tab or drawer page last showed: kept so a restart reopens the same page and
 * the tab strip can show the site's own title and icon before (or without) its webview. */
export interface PageMeta {
  url: string;
  title: string;
  /** The favicon's address ("" when the page has none). */
  icon: string;
}

/** A favicon address the UI may load: http(s) or an inline image, never anything else. */
export const safeIcon = (icon: string) => (/^https?:\/\//i.test(icon) || /^data:image\//i.test(icon) ? icon : "");

interface BrowserPagesState {
  /** By the page's key: a tab's `fileTabKey` or a drawer page's `drawerPageKey`. */
  pages: Record<string, PageMeta>;
  /** Record the address, and the title/icon when known. A new address drops the old page's title and icon. */
  remember: (key: string, url: string, title?: string, icon?: string) => void;
  forget: (key: string) => void;
}

const STORAGE_KEY = "perch.browserPages";

function load(): Record<string, PageMeta> {
  try {
    const parsed: unknown = JSON.parse(readViewerStored(STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, page]) => typeof page?.url === "string" && typeof page?.title === "string" && typeof page?.icon === "string"));
  } catch {
    return {};
  }
}

export const useBrowserPages = create<BrowserPagesState>((set) => ({
  pages: load(),
  remember: (key, url, title, icon) => set((state) => {
    const old = state.pages[key];
    const same = old?.url === url;
    const next = { url, title: title ?? (same ? old.title : ""), icon: safeIcon(icon ?? (same ? old.icon : "")) };
    return old && old.url === next.url && old.title === next.title && old.icon === next.icon ? state : { pages: { ...state.pages, [key]: next } };
  }),
  forget: (key) => set((state) => {
    if (!(key in state.pages)) return state;
    const { [key]: _gone, ...pages } = state.pages;
    return { pages };
  }),
}));

useBrowserPages.subscribe((state, previous) => {
  if (state.pages === previous.pages) return;
  try { localStorage.setItem(viewerKey(STORAGE_KEY), JSON.stringify(state.pages)); } catch { /* convenience only */ }
});

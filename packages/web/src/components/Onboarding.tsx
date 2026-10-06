/**
 * Onboarding.tsx — Wave 2 item 11: themed first-run modal.
 *
 * Shown once, on first launch (gated by `onboarding.ts`'s localStorage
 * flag) — a brief orientation covering what perch is, how to start (add a
 * project, then `+`), the direct shortcuts and the browser's leader key
 * (`Ctrl+Space`), `Cmd+/` or `?` for the full keybind help, `Cmd+P` (or
 * `Ctrl+K` outside a terminal) for the Navigator, and a link-style action to
 * open Settings. Dismissing it (the
 * only way to close it — no backdrop-click-to-dismiss, so a curious click
 * outside the panel doesn't lose the flag-set before it's been read) marks
 * it seen so it never appears again on this browser/profile.
 *
 * Portal-rendered into `document.body`, same structural pattern as
 * `KeybindHelp.tsx`/`Navigator.tsx` (backdrop + centered panel).
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { usePerchStore } from "../store";

const KBD =
  "rounded-ui border border-overlay-0 bg-surface-1 px-[0.4rem] py-[0.05rem] text-[0.78rem] text-accent [font-family:ui-monospace,SFMono-Regular,Menlo,monospace]";

export interface OnboardingProps {
  onDismiss: () => void;
}

export function Onboarding({ onDismiss }: OnboardingProps) {
  const setSettingsOpen = usePerchStore((s) => s.setSettingsOpen);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  const modal = (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]">
      <div
        className="max-h-[calc(100dvh_-_4rem)] w-[min(480px,calc(100vw_-_2rem))] overflow-y-auto rounded-ui border border-accent bg-panel-bg px-[1.4rem] pt-5 pb-[1.4rem] shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
        data-testid="onboarding"
      >
        <h2 className="m-0 mb-[0.6rem] text-[1.15rem] font-semibold text-fg">Welcome to perch</h2>
        <p className="m-0 mb-[0.9rem] text-[0.85rem] leading-[1.5] text-subtext-0">
          perch runs your coding agents (Claude Code, Codex, pi and more) in real
          terminal tabs, one window for every project and worktree, on this machine
          or over SSH. Agents keep running when you close the app.
        </p>
        <ul className="m-0 mb-[1.1rem] flex list-none flex-col gap-[0.6rem] p-0 [&>li]:text-[0.85rem] [&>li]:leading-[1.5] [&>li]:text-fg">
          <li>
            Add a project (any folder) from the sidebar, then press{" "}
            <kbd className={KBD}>+</kbd> in the top row to start an agent
            or a terminal in it.
          </li>
          <li>
            Use <kbd className={KBD}>Cmd+T</kbd> for a new tab,{" "}
            <kbd className={KBD}>Cmd+D</kbd> to split, <kbd className={KBD}>Cmd+1</kbd>…
            to jump tabs. In a browser (which keeps those keys) press{" "}
            <kbd className={KBD}>Ctrl+Space</kbd> then a letter instead.
          </li>
          <li>
            Press <kbd className={KBD}>Cmd+/</kbd> or <kbd className={KBD}>?</kbd> any time to see the full
            list of keybindings.
          </li>
          <li>
            Press <kbd className={KBD}>Cmd+P</kbd> (or{" "}
            <kbd className={KBD}>Ctrl+K</kbd> outside a terminal) to
            open the Navigator and jump to any session or project.
          </li>
          <li>
            <button
              type="button"
              className="cursor-pointer bg-transparent p-0 text-[0.85rem] text-accent underline [border:none] [font-family:inherit] hover:text-fg"
              onClick={() => {
                setSettingsOpen(true);
                onDismiss();
              }}
            >
              Open Settings
            </button>{" "}
            to switch between CLI and UI mode, pick a theme, add SSH hosts, and set notifications.
          </li>
        </ul>
        <button
          type="button"
          className="cursor-pointer rounded-ui bg-accent px-4 py-[0.45rem] text-[0.85rem] font-semibold text-panel-bg [border:none] [transition:opacity_0.12s_ease] hover:opacity-85"
          data-testid="onboarding-dismiss"
          onClick={onDismiss}
        >
          Got it
        </button>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

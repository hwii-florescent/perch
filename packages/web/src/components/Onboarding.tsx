/**
 * Onboarding.tsx — Wave 2 item 11: themed first-run modal.
 *
 * Shown once, on first launch (gated by `onboarding.ts`'s localStorage
 * flag) — a brief orientation covering what perch is, how to start (add a
 * project, then `+`), the leader key (`Ctrl+Space`), `?` for the full
 * keybind help, `Ctrl/Cmd+K` for the Navigator, and a link-style action to
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
    <div className="onboarding__backdrop">
      <div className="onboarding" data-testid="onboarding">
        <h2 className="onboarding__title">Welcome to perch</h2>
        <p className="onboarding__body">
          perch runs your coding agents (Claude Code, Codex, pi and more) in real
          terminal tabs, one window for every project and worktree, on this machine
          or over SSH. Agents keep running when you close the app.
        </p>
        <ul className="onboarding__tips">
          <li>
            Add a project (any folder) from the sidebar, then press{" "}
            <kbd className="onboarding__kbd">+</kbd> in the top row to start an agent
            or a terminal in it.
          </li>
          <li>
            Press <kbd className="onboarding__kbd">Ctrl+Space</kbd> then a letter for
            quick actions — the <em>leader key</em> for everything from splitting
            panes to jumping sessions.
          </li>
          <li>
            Press <kbd className="onboarding__kbd">?</kbd> any time to see the full
            list of keybindings.
          </li>
          <li>
            Press <kbd className="onboarding__kbd">Ctrl+K</kbd> (
            <kbd className="onboarding__kbd">Cmd+K</kbd> on Mac) to open the
            Navigator and jump to any session or project.
          </li>
          <li>
            <button
              type="button"
              className="onboarding__link"
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
          className="onboarding__dismiss"
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

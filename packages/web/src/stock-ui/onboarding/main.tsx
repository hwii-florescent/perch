//! Welcome, the stock screen `stock:onboarding`: the first-run orientation (what Perch is, how to start, the main
//! keys, where Settings are). Perch shows it once per browser profile; or the person's package chosen for it
//! (`perch mod use stock:onboarding <id>`), with the same props.
//!
//! `onDismiss` marks it seen (the only way to close it: no backdrop click, so a stray click does not lose it before
//! it is read); `openSettings` opens Settings. Key names follow the person's bindings (`shortcutLabel`).
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:onboarding` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside
//! it (docs/MOD-SDK.md).
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { buttonClass as button, shortcutLabel, useKeybindings, type OnboardingProps } from "@perch/sdk";

const KBD =
  "rounded-ui bg-surface-1 px-[0.4rem] py-[0.05rem] text-[0.78rem] text-accent [font-family:ui-monospace,SFMono-Regular,Menlo,monospace]";

export default function Onboarding({ onDismiss, openSettings }: OnboardingProps) {
  // Re-drawn when the person changes a binding.
  useKeybindings();

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
        className="max-h-[calc(100dvh_-_4rem)] w-[min(480px,calc(100vw_-_2rem))] overflow-y-auto rounded-ui bg-panel-bg px-[1.4rem] pt-5 pb-[1.4rem] shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to perch"
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
            New tab: <kbd className={KBD}>{shortcutLabel("tabs.new") ?? "Not set"}</kbd>;{" "}
            split: <kbd className={KBD}>{shortcutLabel("panes.splitRight") ?? "Not set"}</kbd>;{" "}
            first tab: <kbd className={KBD}>{shortcutLabel("tabs.jump1") ?? "Not set"}</kbd>;{" "}
            new session: <kbd className={KBD}>{shortcutLabel("sessions.new") ?? "Not set"}</kbd>.
          </li>
          <li>
            Keybind help: <kbd className={KBD}>{shortcutLabel("global.help") ?? "Not set"}</kbd>.{" "}
            Change any application shortcut in Settings → Keyboard.
          </li>
          <li>
            Navigator: <kbd className={KBD}>{shortcutLabel("global.navigator") ?? "Not set"}</kbd>.{" "}
            Jump to any session or project.
          </li>
          <li>
            <button
              type="button"
              className="cursor-pointer bg-transparent p-0 text-[0.85rem] text-accent underline [border:none] [font-family:inherit] hover:text-fg"
              onClick={() => {
                openSettings();
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
          className={button({ variant: "primary", size: "lg" })}
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

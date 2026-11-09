//! New session menu, the stock screen `stock:new-session`: Perch's agent launcher at a button. Scoped (the tab strip's
//! "+" and Cmd+T): a filterable list of the host's agents, then the strip's extras (a browser, a file). Unscoped (the
//! home screen, a folder project's "+"): an agent, then one of `projectCwds` or Quickchat. Placed by the tab strip,
//! the home screen and a package's `NewSessionMenu` from `@perch/sdk`; or the person's package chosen for it
//! (`perch mod use stock:new-session <id>`) with the same props.
//!
//! The agents the host can start and the last one picked are Perch's (`useAgentChoices`); `onSelect` starts the
//! session. The list, its keys (type to filter, arrows and Enter, 1-9) and the look are this screen's. A press
//! outside or Escape closes it, and focus goes back where it was.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:new-session` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside
//! it (docs/MOD-SDK.md).
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AgentIcon, cn, menuItemClass as menuItem, menuPanel, useAgentChoices, type NewSessionScreenProps } from "@perch/sdk";
import { AgentPicker } from "./agent-picker";

/** Extract the last path segment as a project display name. */
function basename(cwd: string): string {
  const parts = cwd.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || cwd;
}

const POPOVER_PICK = "flex w-full cursor-pointer flex-col bg-transparent px-[0.9rem] py-[0.4rem] text-left text-[12.5px] font-medium text-fg [font-family:inherit] [border:none] [transition:background_0.1s_ease] hover:bg-surface-0";
const POPOVER_PICK_CWD = "mt-[0.1rem] overflow-hidden text-[11px] font-normal text-ellipsis whitespace-nowrap text-subtext-0";

interface LauncherItem { id: string; label: string; icon?: ReactNode; testId: string; disabled?: boolean; muted?: boolean; run: () => void }

export default function NewSessionMenu({ hostId, projectCwds, fixedCwd, anchorRect, onClose, onSelect, extras }: NewSessionScreenProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const { connected, discovery, state: catalogState, error: catalogError, choices, lastChoice, rememberChoice, manage } = useAgentChoices(hostId);
  const [selectedAgent, setSelectedAgent] = useState<string>(lastChoice);

  // Keyboard launcher (scoped branch): a filterable list the user drives without the mouse.
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(0);
  const agentsReady = connected && !(discovery && catalogState !== "ready");
  const items: LauncherItem[] = fixedCwd === undefined ? [] : [
    ...choices.map((choice) => ({
      id: choice.id, label: choice.label, icon: <AgentIcon provider={choice.id} />,
      testId: `new-session-provider-${choice.id}`, disabled: !agentsReady,
      run: () => {
        if (!agentsReady) return;
        rememberChoice(choice.id);
        onSelect(fixedCwd, choice.id);
        onClose();
      },
    })),
    ...(extras ?? []).map((extra) => ({
      id: extra.id, label: extra.label, icon: extra.icon, testId: `new-tab-${extra.id}`,
      run: () => { onClose(); extra.onSelect(); },
    })),
    ...(discovery ? [{ id: "manage", label: "Manage agents…", muted: true, testId: "new-tab-manage", run: () => { onClose(); manage(); } }] : []),
  ];
  const needle = filter.trim().toLowerCase();
  const visible = needle ? items.filter((item) => item.label.toLowerCase().includes(needle)) : items;

  // Dismissing returns focus to where it was (the terminal), not to <body>.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => { if (!document.activeElement || document.activeElement === document.body) previous?.focus?.(); };
  }, []);

  // Position: open below the anchor button, left-aligned. Clamped to the
  // viewport: the project list grows one row per listed project.
  // `.new-session-popover` is a flex column (see styles/session-picker.css); this cap makes
  // the `__projects` list scroll internally.
  const top = anchorRect.bottom + 4;
  const style: CSSProperties = {
    position: "fixed",
    top,
    left: Math.max(12, Math.min(anchorRect.left, window.innerWidth - 344)),
    zIndex: 9999,
    minWidth: 200,
    maxHeight: `min(70vh, calc(100vh - ${top}px - 12px))`,
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current?.contains(e.target as Node)) return;
      onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className={cn(menuPanel, "new-session-popover flex max-w-[min(320px,calc(100vw_-_24px))] min-w-[200px] flex-col py-1")} ref={popoverRef} style={style}>
      {fixedCwd !== undefined ? (
        <div className="min-h-0 overflow-y-auto py-1">
          <input
            type="text"
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="new-tab-launcher-list"
            aria-activedescendant={visible[active] ? `new-tab-launcher-${visible[active].id}` : undefined}
            aria-label="Filter new tab options"
            placeholder="Type to filter, ↑↓ Enter, 1–9"
            data-testid="new-tab-filter"
            className="mx-2 mb-1 w-[calc(100%_-_1rem)] rounded-ui border-0 bg-surface-0 px-2 py-1 text-[0.8rem] text-fg [font-family:inherit] [outline:none] placeholder:text-subtext-0"
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                if (visible.length) setActive((active + (e.key === "ArrowDown" ? 1 : visible.length - 1)) % visible.length);
              } else if (e.key === "Enter") {
                e.preventDefault();
                visible[active]?.run();
              } else if (!filter && /^[1-9]$/.test(e.key) && visible[Number(e.key) - 1]) {
                e.preventDefault();
                visible[Number(e.key) - 1]!.run();
              }
            }}
          />
          <div id="new-tab-launcher-list" role="listbox">
            {visible.map((item, i) => (
              <button type="button" role="option" aria-selected={i === active} tabIndex={-1} key={item.id}
                id={`new-tab-launcher-${item.id}`}
                className={cn(menuItem(), "flex items-center gap-2", item.muted && "text-subtext-0", i === active && "bg-surface-0")}
                data-testid={item.testId}
                disabled={item.disabled}
                onMouseMove={() => setActive(i)}
                onClick={item.run}>
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {!filter && i < 9 && <kbd className="text-[0.7rem] text-subtext-0 [font-family:inherit]">{i + 1}</kbd>}
              </button>
            ))}
          </div>
          {!visible.length && <p className="mx-3 text-[0.75rem] text-subtext-0" role="status">No match.</p>}
          {discovery && catalogState === "loading" && <p className="mx-3 text-[0.75rem] text-subtext-0" role="status">Checking agents…</p>}
          {discovery && catalogState === "error" && <p className="mx-3 text-[0.75rem] text-red" role="alert">{catalogError}</p>}
          {discovery && catalogState === "ready" && !choices.length && <p className="mx-3 text-[0.75rem] text-subtext-0" role="status">Enable or install an agent in Manage agents.</p>}
        </div>
      ) : <>
      <AgentPicker
        hostId={hostId}
        onManage={onClose}
        value={selectedAgent}
        onChange={(a) => {
          setSelectedAgent(a);
          rememberChoice(a);
        }}
        testIdPrefix="new-session-popover-agent"
        className="m-2 mb-1 w-[calc(100%_-_1rem)] [--picker-bg:var(--surface-0)]"
        wrapClassName="max-h-[35vh] shrink-0 overflow-y-auto"
      />
      {projectCwds.length > 0 && (
        <div className="max-h-[190px] min-h-0 shrink overflow-y-auto">
          {projectCwds.map((cwd, i) => (
            <button
              key={cwd}
              type="button"
              className={POPOVER_PICK}
              data-testid={`project-option-${i}`}
              onClick={() => { onSelect(cwd, selectedAgent); onClose(); }}
              title={cwd}
            >
              {basename(cwd)}
              <span className={POPOVER_PICK_CWD}>{cwd}</span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className={cn(POPOVER_PICK, "shrink-0 font-normal text-subtext-0")}
        data-testid="project-option-none"
        onClick={() => { onSelect("~", selectedAgent); onClose(); }}
      >
        No project
        <span className={POPOVER_PICK_CWD}>Quickchat</span>
      </button>
      </>}
    </div>,
    document.body
  );
}

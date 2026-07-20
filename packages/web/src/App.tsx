import { useCallback, useRef } from "react";
import type { DockviewApi } from "dockview-react";
import { StatusBar } from "./StatusBar";
import { DockviewShell } from "./dockview/DockviewShell";

function newPanelId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `terminal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const apiRef = useRef<DockviewApi | null>(null);

  const handleReady = useCallback((api: DockviewApi) => {
    apiRef.current = api;
  }, []);

  const openTerminal = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    api.addPanel({
      id: newPanelId(),
      component: "terminal",
      title: "Terminal",
      position: { referencePanel: "chat", direction: "below" },
    });
  }, []);

  return (
    <div className="app">
      <div className="toolbar">
        <button
          type="button"
          className="toolbar__button"
          title="Open terminal"
          aria-label="Open terminal"
          onClick={openTerminal}
        >
          {"›_"}
        </button>
      </div>

      <main className="dock-area">
        <DockviewShell onReady={handleReady} />
      </main>

      <StatusBar />
    </div>
  );
}

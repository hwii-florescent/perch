import { useCallback, useEffect, useState } from "react";
import {
  DockviewReact,
  themeAbyss,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { ChatView } from "../views/Chat";
import { TerminalView } from "../views/Terminal";

function ChatPanel() {
  return <ChatView />;
}

function TerminalPanel(props: IDockviewPanelProps) {
  const [active, setActive] = useState(props.api.isVisible);

  useEffect(() => {
    setActive(props.api.isVisible);
    const disposable = props.api.onDidVisibilityChange((e) => setActive(e.isVisible));
    return () => disposable.dispose();
  }, [props.api]);

  return <TerminalView active={active} />;
}

const components = {
  chat: ChatPanel,
  terminal: TerminalPanel,
};

export function DockviewShell({ onReady }: { onReady?: (api: DockviewApi) => void }) {
  const handleReady = useCallback(
    (event: DockviewReadyEvent) => {
      event.api.addPanel({ id: "chat", component: "chat", title: "Chat" });
      onReady?.(event.api);
    },
    [onReady],
  );

  return (
    <DockviewReact
      className="dockview-theme-perch"
      theme={themeAbyss}
      components={components}
      onReady={handleReady}
    />
  );
}

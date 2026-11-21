// The web app's stock agent terminal controls, unchanged (`agent-control/` is the app's own export of
// `packages/web/src/stock-ui/agent-control`), on the native React runtime: the window draws this mod over a terminal
// pane while its agent has something to say, one copy per pane (`agent-control#<tab id>`). As the web's
// `PersistentAgentTerminal` it is drawn in two places in the terminal's frame (`.terminal`): `top`, the chip at the
// top right, and `bottom`, the error line and the sleeping banner. The props are the window's
// (`perch.props()`: `id`, the tab, and the web's `AgentControlProps` with each action as a flag); the actions are the
// window's commands: Take control is `terminal.takeControl`, Retry CLI and Resume agent are
// `terminal.restart`. An agent that exited has no banner: the window closes its tab. Every element the
// parity table names (`e2e/native-parity/named-elements.json`) has that name as its id.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder;
// `agent-control/` is written by `mods-runtime/react/build.mjs`. To change it, copy this folder from
// `<native-mods>/.stock/agent-control/` to `<native-mods>/agent-control/` and edit the plain JS there; it reloads on
// save.
import { screen } from "./screen.js";
import { React } from "./runtime.mjs";
import { runningHost } from "./host.js";
import AgentControl from "./agent-control/main.js";

const { createElement } = React;

/** The pane's box: the screen is the pane, its terminal drawn beneath by the window. */
const PANE = { display: "flex", width: "100%", height: "100%" };

function Controls({ id, ...ac }) {
  const run = (command, args) => runningHost().command(command, args);
  const restart = () => run("terminal.restart", { id });
  const props = {
    agent: ac.agent,
    label: ac.label,
    connected: ac.connected,
    pending: ac.pending,
    onRetry: ac.retry ? restart : null,
    control: ac.control ? { ...ac.control, onClick: () => run("terminal.takeControl", { id }) } : null,
    error: ac.error,
    sleeping: ac.sleeping ? { onResume: restart } : null,
    state: ac.state,
  };
  return createElement(
    "div",
    { className: "terminal terminal--persistent", "data-testid": "persistent-agent-terminal" },
    createElement(AgentControl, { ...props, part: "top" }),
    createElement("div", { className: "terminal__surface" }),
    createElement(AgentControl, { ...props, part: "bottom" }),
  );
}

function props(raw) {
  const state = raw.state ?? {};
  const control = raw.control && typeof raw.control === "object" ? raw.control : null;
  const text = (value) => (typeof value === "string" ? value : null);
  return {
    id: String(raw.id ?? ""),
    agent: String(raw.agent ?? ""),
    label: text(raw.label),
    connected: raw.connected !== false,
    pending: raw.pending === true,
    retry: raw.retry === true,
    control: control ? { label: String(control.label ?? ""), disabled: control.disabled === true } : null,
    error: text(raw.error),
    sleeping: raw.sleeping === true,
    state: { controlling: state.controlling === true, shared: state.shared === true, writable: state.writable === true, phone: state.phone === true },
  };
}

export default screen("agent-control", Controls, { container: PANE, props });

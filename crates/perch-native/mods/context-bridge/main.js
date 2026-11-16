// The web app's stock Context Bridge screen, unchanged (`context-bridge/` is the app's own export of
// `packages/web/src/stock-ui/context-bridge`), on the native React runtime: the window opens this mod as its
// `context-bridge` screen over the whole window, with the terminal selection's menu (a right-click on selected output)
// or the dialog on what is asked about (the menu's Ask agent, the Files entry menu's "Ask agent about file…", the
// editor's Ask agent). Its props are the web's `ContextBridgeScreenProps` without the actions (`perch.props()`: `menu`,
// `capture`, `connected`, `sendState`), and the actions are the window's (docs/CONTEXT-BRIDGE.md): Preview asks the core
// for the packet, Send is the window's one send of this capture (one operation id, refused a second time, never
// retried), and `sendState` says how far it got. Cancel, Escape (not while sending) and a press outside close it.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder;
// `context-bridge/` is written by `mods-runtime/react/build.mjs`. To change it, copy this folder from
// `<native-mods>/.stock/context-bridge/` to `<native-mods>/context-bridge/` and edit the plain JS there; it reloads on
// save.
import * as perch from "perch";
import { closeWith, screen } from "./screen.js";
import ContextBridge from "./context-bridge/main.js";

/** The web portals the menu and the dialog into the page: the screen's own box is the whole window and draws nothing. */
const WINDOW = { width: "100%", height: "100%" };
const IDLE = { attempted: false, sending: false, delivered: false };

// One set of actions per menu or capture, as the web's are one per capture: the screen previews again when they change.
let made = { key: null, actions: null };
let sending = false;

function actionsFor(key) {
  if (made.key === key) return made.actions;
  const actions = {
    ask: () => perch.contextAsk(),
    closeMenu: () => closeWith(null),
    preview: (instruction) => perch.contextPreview(instruction),
    send: ({ instruction, preview, targetSessionId }) => perch.contextSend(instruction, preview.packet.digest, targetSessionId, preview),
    openAgent: (sessionId) => perch.contextOpenAgent(sessionId),
    // Never closes while a send is in flight.
    close: () => { if (!sending) closeWith(null); },
  };
  made = { key, actions };
  return actions;
}

function props(raw) {
  const capture = raw.capture ?? null;
  const menu = raw.menu ?? null;
  const sendState = raw.sendState ?? IDLE;
  sending = !!sendState.sending;
  return {
    menu, capture, connected: !!raw.connected, sendState,
    actions: actionsFor(capture ? `capture:${capture.id}` : `menu:${menu?.x}:${menu?.y}`),
  };
}

/** Names of its elements for the window's tests (the parity table has none for this screen). */
const NAMES = [
  { name: "context-bridge-ask", selector: "body > div > button" },
  { name: "context-bridge-dialog", selector: '[data-testid="context-bridge"]' },
  { name: "context-bridge-question", selector: 'textarea[aria-label="Question for agent"]' },
  { name: "context-bridge-cancel", selector: '[data-testid="context-bridge"] .justify-end > button:first-child' },
  { name: "context-bridge-copy", selector: '[data-testid="context-bridge"] .justify-end > button:nth-child(3)' },
  { name: "context-bridge-send", selector: '[data-testid="context-bridge"] .justify-end > button:last-child' },
  { name: "context-bridge-error", selector: '[data-testid="context-bridge"] [role="alert"]' },
];

export default screen("context-bridge", ContextBridge, { container: WINDOW, keyboard: true, props, names: NAMES });

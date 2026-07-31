import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { usePerchStore } from "./store";
import "./styles.css";

// PWA service worker. Registering through virtual:pwa-register (rather than
// the plugin's plain injected register call) matters: in autoUpdate mode this
// helper reloads open tabs as soon as a freshly-deployed build's worker takes
// control. Without it, a tab keeps running the old precached bundle across
// deploys until it happens to be reloaded twice. The periodic update() makes
// even idle tabs notice a deploy (the browser only checks for a new worker on
// navigation otherwise), so a rebuild propagates everywhere within a minute.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) {
      setInterval(() => registration.update(), 60_000);
    }
  },
});

// Expose the Zustand store on window so e2e tests can drive/assert state
// directly (e.g. injecting a synthetic chat message to exercise rendering
// paths — like an Edit-tool diff — that aren't worth spinning up a real
// agent turn for). Harmless in production: it's just a getState/setState/
// subscribe handle, same shape `usePerchStore` already has everywhere else.
declare global {
  interface Window {
    usePerchStore: typeof usePerchStore;
  }
}
window.usePerchStore = usePerchStore;

const container = document.getElementById("root");
if (!container) {
  throw new Error("missing #root element");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

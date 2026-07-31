import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { usePerchStore } from "./store";
import "./styles.css";

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

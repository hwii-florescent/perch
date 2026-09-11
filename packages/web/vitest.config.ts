import { defineConfig } from "vitest/config";

// Separate from vite.config.ts on purpose: the app build config pulls in
// @vitejs/plugin-react and vite-plugin-pwa, neither of which the unit tests
// need, and keeping them out keeps `vitest` startup fast. Default
// environment is "node" (no jsdom) because every module under test either
// has no DOM dependency at all or already guards its DOM/localStorage
// access behind try/catch (see store.ts, ws.ts, tabOrder.ts) — a real
// runner exercising those catch paths in plain Node is exactly the
// "unavailable" case they're written for. DOM-heavy interaction tests opt
// into jsdom at the file level so the rest of the suite stays lightweight.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    reporters: ["default"],
  },
});

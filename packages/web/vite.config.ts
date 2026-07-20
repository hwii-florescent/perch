import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// perch is served under an arbitrary, dynamic base path (either "/" locally
// or "/proxy/<name>/<port>/" behind the devpod gateway). Using a *relative*
// base means every asset URL emitted into index.html is relative to the
// document itself, so the same build works unmodified under any prefix -
// the browser resolves them against wherever index.html was actually
// fetched from. See src/base.ts for the matching runtime WS-URL logic.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Relative start_url/scope so the installed PWA identity works no
      // matter which proxy path it was installed from.
      manifest: {
        id: "./",
        name: "perch",
        short_name: "perch",
        description: "Personal AI IDE / agent app",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#0b0d10",
        theme_color: "#0b0d10",
        icons: [
          {
            // Inline SVG data-URI icon so the manifest is fully
            // self-contained (no extra static asset paths to resolve
            // under a dynamic proxy base).
            src:
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' rx='32' fill='%230b0d10'/%3E%3Ctext x='50%25' y='58%25' font-size='104' text-anchor='middle' fill='%2358e6a8' font-family='monospace'%3E%3F%3E%3C/text%3E%3C/svg%3E",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src:
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' rx='32' fill='%230b0d10'/%3E%3Ctext x='50%25' y='58%25' font-size='104' text-anchor='middle' fill='%2358e6a8' font-family='monospace'%3E%3F%3E%3C/text%3E%3C/svg%3E",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Serve the app shell for any navigation that doesn't hit a real
        // asset, and never intercept the WS endpoint.
        navigateFallbackDenylist: [/\/ws$/],
      },
    }),
  ],
});

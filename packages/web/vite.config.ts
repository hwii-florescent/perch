import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
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
    // Vite's default target (es2020 + firefox78) makes esbuild lower `||=`,
    // and that lowering miscompiles xterm 6.1's DECRQM handler into a
    // ReferenceError that wedges the parser. Every perch client (WKWebView,
    // current Safari/Chrome) runs ES2022 natively.
    target: "es2022",
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
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
            // Relative to the manifest, so icons also work behind a proxy.
            src: "./perch-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "./perch-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,webp}"],
        // Serve the app shell for any navigation that doesn't hit a real
        // asset, and never intercept the WS endpoint.
        navigateFallbackDenylist: [/\/ws$/, /\/workspace-file$/],
      },
    }),
  ],
});

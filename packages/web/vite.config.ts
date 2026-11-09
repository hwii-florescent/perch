import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { exportStockUi } from "./scripts/export-stock-ui.mjs";

const src = (rel: string) => decodeURIComponent(new URL(rel, import.meta.url).pathname);

// perch is served under an arbitrary, dynamic base path (either "/" locally
// or "/proxy/<name>/<port>/" behind the devpod gateway). Using a *relative*
// base means every asset URL emitted into index.html is relative to the
// document itself, so the same build works unmodified under any prefix -
// the browser resolves them against wherever index.html was actually
// fetched from. See src/base.ts for the matching runtime WS-URL logic.
export default defineConfig({
  base: "./",
  // A stock screen's source imports `@perch/sdk`; where the app renders that source directly (the phone, until it
  // gets its own screens) it is the app's own SDK module. Packages get theirs from the loader (`mod-runtime.ts`).
  resolve: { alias: { "@perch/sdk": decodeURIComponent(new URL("./src/sdk.ts", import.meta.url).pathname) } },
  build: {
    outDir: "dist",
    // The desktop serves local assets; suppress only the advisory large-chunk warning.
    chunkSizeWarningLimit: Infinity,
    // Vite's default target (es2020 + firefox78) makes esbuild lower `||=`,
    // and that lowering miscompiles xterm 6.1's DECRQM handler into a
    // ReferenceError that wedges the parser. Every perch client (WKWebView,
    // current Safari/Chrome) runs ES2022 natively.
    target: "es2022",
  },
  plugins: [
    react(),
    tailwindcss(),
    // The stock screens (`stock-ui/`, scripts/export-stock-ui.mjs) are part of the build, written with the app's
    // own files, so the service worker below precaches them with the shell: a cached shell then runs the stock
    // screens of its own build, and a newer build replaces both together.
    {
      name: "perch-stock-ui",
      apply: "build",
      generateBundle() {
        const files = exportStockUi({ sourceDir: src("./src/stock-ui"), sdkTypesFile: src("./src/perch-sdk.d.ts") });
        for (const [rel, bytes] of files) this.emitFile({ type: "asset", fileName: `stock-ui/${rel}`, source: bytes });
      },
    },
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
        // A stock screen's catalog, manifest and assets too (not its copy of the SDK types: no page reads them).
        // A person's own packages are never here: the core serves them `no-store` from `mods/package`.
        globPatterns: ["**/*.{js,css,html,png,webp}", "stock-ui/**/*.{json,svg,jpg,woff,woff2}"],
        // The app shell is one chunk just over Workbox's 2 MiB default; the desktop serves it locally, so precache it anyway (the large-chunk warning is already off).
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Serve the app shell for any navigation that doesn't hit a real
        // asset, and never intercept the WS endpoint or the local sign-in redirect
        // (`/local-login?code=` must reach the core, not be answered with the app shell).
        navigateFallbackDenylist: [/\/ws$/, /\/workspace-file$/, /\/local-login/],
      },
    }),
  ],
});

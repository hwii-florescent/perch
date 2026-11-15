//! The reference page's build: the app's own Vite plugins (React, the Tailwind build), the app's CSS and the app's
//! own `@perch/sdk` module (as the phone runs a stock screen's source directly), with the socket stubbed so the
//! store holds only what the fixture put there. Served on a fixed port by `playwright.config.ts`.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, "../../packages/web");

export default defineConfig({
  root: path.join(here, "harness"),
  base: "./",
  cacheDir: path.resolve(here, "../artifacts-native-parity/.vite"),
  publicDir: false,
  resolve: {
    alias: [
      { find: "@perch/sdk", replacement: path.join(web, "src/sdk.ts") },
      { find: /^(\.{1,2}\/)+ws$/, replacement: path.join(here, "harness/ws-stub.ts") },
      // `StockWindow` and the dock draw their stock screens through `StockView`, which needs the build's catalog.
      { find: /^(\.{1,2}\/)+(components\/)?mod-root$/, replacement: path.join(here, "harness/mod-root-stub.tsx") },
    ],
  },
  server: { host: "127.0.0.1", port: 7810, strictPort: true, fs: { allow: [path.resolve(here, "../..")] } },
  plugins: [react(), tailwindcss()],
});

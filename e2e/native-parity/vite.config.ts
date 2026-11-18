//! The reference page's build: the app's own Vite plugins (React, the Tailwind build), the app's CSS and the app's
//! own `@perch/sdk` module (as the phone runs a stock screen's source directly), with the socket stubbed so the
//! store holds only what the fixture put there. Served on a fixed port by `playwright.config.ts`.
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, "../../packages/web");
const media = path.join(here, "fixtures/media");

/** The core's `workspace-file` for the media states: a fixture's bytes by its name (`path`), nothing else. */
function workspaceFile(): Plugin {
  const types: Record<string, string> = { ".png": "image/png", ".pdf": "application/pdf" };
  return {
    name: "parity-workspace-file",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://parity");
        if (!url.pathname.endsWith("/workspace-file")) return next();
        const name = path.basename(url.searchParams.get("path") ?? "");
        const file = path.join(media, name);
        if (!name || !fs.existsSync(file)) {
          res.statusCode = 404;
          res.end("no such fixture");
          return;
        }
        res.setHeader("Content-Type", types[path.extname(name)] ?? "application/octet-stream");
        res.end(fs.readFileSync(file));
      });
    },
  };
}

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
  server: { host: "127.0.0.1", port: Number(process.env.PERCH_PARITY_PORT ?? 7810), strictPort: true, fs: { allow: [path.resolve(here, "../..")] } },
  plugins: [react(), tailwindcss(), workspaceFile()],
});

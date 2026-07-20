import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { WebSocketServer } from "ws";
import { createWsHandler, type WsHandlerDeps } from "./wsHandler.js";

export interface HttpServerOptions {
  port: number;
  /** e.g. "/" or "/proxy/dev-personal/7788/" when served behind the
   * devpod gateway proxy. */
  basePath: string;
  /** packages/web/dist — served as static files when present. */
  webDistDir: string;
}

export function startHttpServer(options: HttpServerOptions, wsDeps: WsHandlerDeps): http.Server {
  const basePath = normalizeBasePath(options.basePath);
  const wsPath = basePath + "ws";

  const server = http.createServer((req, res) => {
    serveStatic(req, res, basePath, options.webDistDir);
  });

  const wss = new WebSocketServer({ server, path: wsPath });
  wss.on("connection", createWsHandler(wsDeps));

  server.listen(options.port, () => {
    console.log(`[perch] listening on port ${options.port} (base path ${basePath}, ws at ${wsPath})`);
  });

  return server;
}

function normalizeBasePath(basePath: string): string {
  let p = basePath;
  if (!p.startsWith("/")) p = "/" + p;
  if (!p.endsWith("/")) p = p + "/";
  return p;
}

function serveStatic(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  basePath: string,
  webDistDir: string,
): void {
  const url = req.url ?? "/";
  if (!url.startsWith(basePath)) {
    res.writeHead(404).end("not found");
    return;
  }

  const hasWebBuild = fs.existsSync(webDistDir);
  if (hasWebBuild) {
    const rel = (url.slice(basePath.length).split("?")[0] || "index.html").replace(/^\/+/, "");
    const resolved = path.join(webDistDir, rel);
    if (resolved.startsWith(webDistDir) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      res.writeHead(200, { "Content-Type": contentType(resolved) });
      fs.createReadStream(resolved).pipe(res);
      return;
    }
    const indexPath = path.join(webDistDir, "index.html");
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { "Content-Type": "text/html" });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(placeholderHtml(basePath));
}

function contentType(filePath: string): string {
  switch (path.extname(filePath)) {
    case ".html":
      return "text/html";
    case ".js":
      return "text/javascript";
    case ".css":
      return "text/css";
    case ".json":
      return "application/json";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function placeholderHtml(basePath: string): string {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>perch</title></head>
  <body>
    <h1>perch</h1>
    <p>Server is running. No web client build found at this path; the
    WebSocket endpoint is at <code>${basePath}ws</code>.</p>
  </body>
</html>
`;
}

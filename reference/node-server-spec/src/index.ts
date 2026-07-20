import path from "node:path";
import { fileURLToPath } from "node:url";
import { HistoryDb } from "./db.js";
import { startHttpServer } from "./httpServer.js";
import { SessionRegistry } from "./sessionRegistry.js";

interface CliArgs {
  port: number;
  headless: boolean;
  basePath: string;
  publicBaseUrl: string | undefined;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    port: Number(process.env["PERCH_PORT"] ?? 7788),
    headless: false,
    basePath: process.env["PERCH_BASE_PATH"] ?? "/",
    publicBaseUrl: process.env["PERCH_PUBLIC_BASE_URL"],
  };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--port":
        args.port = Number(argv[++i]);
        break;
      case "--headless":
        args.headless = true;
        break;
      case "--base-path":
        args.basePath = argv[++i] ?? args.basePath;
        break;
      case "--public-base-url":
        args.publicBaseUrl = argv[++i];
        break;
      default:
        break;
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // dist/index.js -> ../../web/dist == packages/web/dist
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const webDistDir = path.resolve(__dirname, "../../web/dist");

  const db = await HistoryDb.open();
  const registry = new SessionRegistry();

  startHttpServer(
    { port: args.port, basePath: args.basePath, webDistDir },
    { registry, db, defaultCwd: process.cwd() },
  );

  if (args.headless) {
    console.log("[perch] running headless");
  }
  if (args.publicBaseUrl) {
    console.log(`[perch] public URL: ${args.publicBaseUrl}`);
  }
}

main().catch((err: unknown) => {
  console.error("[perch] fatal error", err);
  process.exit(1);
});

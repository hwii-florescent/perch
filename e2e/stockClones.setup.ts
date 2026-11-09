/**
 * Global setup for running the existing specs on untouched copies of Perch's stock screens instead of the screens
 * themselves: `PERCH_E2E_STOCK_CLONES=sidebar,tabs npx playwright test sidebar.spec.ts nav.spec.ts`. For each name
 * the hub core (:7799) clones `stock:<name>` as `e2e-untouched-<name>` and puts it in Perch's place (`mods.set`
 * `clone`, then `use`: the same route as `perch mod clone`/`perch mod use`), so every spec in the run drives the
 * copy. Before any spec runs, a browser checks that each copy is the one drawn and that its files are the shipped
 * ones byte for byte. Do not include `stock-ui-clones.spec.ts` (it resets `use` after each test) or specs that
 * choose their own copies.
 */
import { chromium, type FullConfig } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { localStorageState, withLocalToken } from "./localAuth";

const CORE = "http://127.0.0.1:7799";
/** Screens a page draws on its own at start, so the check can see the copy without driving the app. */
const DRAWN_AT_START = new Set(["sidebar", "status", "tabs"]);

function modsSet(body: Record<string, unknown>): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(withLocalToken(`${CORE.replace(/^http/, "ws")}/ws`));
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => { ws.close(); reject(new Error(`mods.set ${JSON.stringify(body)} timed out`)); }, 15_000);
    ws.onopen = () => ws.send(JSON.stringify({ type: "mods.set", requestId, ...body }));
    ws.onerror = () => { clearTimeout(timer); reject(new Error("could not reach the hub core")); };
    ws.onmessage = (event) => {
      const answer = JSON.parse(String(event.data));
      if (answer.type !== "mods.state" || answer.requestId !== requestId) return;
      clearTimeout(timer);
      ws.close();
      resolve(answer.error ?? null);
    };
  });
}

export default async function stockClones(_config: FullConfig) {
  const names = (process.env.PERCH_E2E_STOCK_CLONES ?? "").split(",").map((name) => name.trim()).filter(Boolean);
  if (!names.length) return;
  const home = path.join(process.env.PERCH_E2E_STATE ?? "", "hub");
  for (const name of names) {
    const id = `e2e-untouched-${name}`;
    const cloned = await modsSet({ id: `stock:${name}`, op: "clone", as: id });
    if (cloned) throw new Error(`clone stock:${name}: ${cloned}`);
    // The core lists a new package on its next scan; `use` refuses an unknown id until then.
    let used: string | null = "not tried";
    for (let attempt = 0; attempt < 30 && used; attempt++) {
      used = await modsSet({ id: `stock:${name}`, op: "use", target: id });
      if (used) await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (used) throw new Error(`use stock:${name} ${id}: ${used}`);
  }

  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ storageState: localStorageState() })).newPage();
    await page.goto(`${CORE}/`, { waitUntil: "networkidle" });
    for (const name of names) {
      const id = `e2e-untouched-${name}`;
      // Untouched: every file the shipped package has, with the shipped bytes.
      const catalog = (await (await page.request.get(`${CORE}/stock-ui/catalog.json`)).json()) as { packages: { id: string; files: string[] }[] };
      const entry = catalog.packages.find((candidate) => candidate.id === name);
      if (!entry) throw new Error(`no stock:${name} in this build`);
      for (const file of entry.files.filter((file) => file !== "mod.json")) {
        const shipped = await (await page.request.get(`${CORE}/stock-ui/${name}/${file}`)).text();
        if (fs.readFileSync(path.join(home, "mods", id, file), "utf8") !== shipped) throw new Error(`${id}/${file} is not the shipped file`);
      }
      if (DRAWN_AT_START.has(name)) {
        await page.locator(`[data-testid="mod-view-${id}"]`).waitFor({ state: "attached", timeout: 30_000 });
        if (await page.locator(`[data-testid="mod-view-stock:${name}"]`).count()) throw new Error(`stock:${name} is still drawn beside its copy`);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`[stock clones] the run drives untouched copies of: ${names.map((name) => `stock:${name}`).join(", ")}`);
}

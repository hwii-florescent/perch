// Run: node crates/perch-core/src/native_ui/pi-extension.test.mjs (Node >= 23.6 strips the TS types)
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

async function until(predicate) {
  for (let attempt = 0; attempt < 300; attempt++) { if (predicate()) return; await delay(10); }
  throw new Error("pi extension check timed out");
}

// Needs-you for one provider: Pi reports its AskUserQuestion-style tools, OMP
// its own `ask` tool and its policy engine's approval prompts.
async function check(provider) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-pi-check-"));
  const socket = path.join(dir, "native.sock");
  const module = path.join(dir, "extension.ts");
  fs.writeFileSync(module, fs.readFileSync(new URL("./pi-extension.ts", import.meta.url), "utf8")
    .replace('"__PERCH_NATIVE_SOCKET__"', JSON.stringify(socket))
    .replace('"__PERCH_NATIVE_PROVIDER__"', JSON.stringify(provider)));
  const handlers = new Map();
  const pi = { on(name, fn) { handlers.set(name, fn); }, appendEntry() {}, sendUserMessage() {} };
  let idle = true;
  const ctx = {
    cwd: dir, model: { id: "model" }, isIdle: () => idle, hasPendingMessages: () => false, abort() {},
    sessionManager: { getBranch: () => [], getSessionFile: () => path.join(dir, "session.jsonl"), getSessionId: () => "session" },
  };
  (await import(pathToFileURL(module))).default(pi);
  const fire = (name, event = {}) => handlers.get(name)(event, ctx);
  const received = [];
  let peer;
  try {
    await fire("session_start");
    await until(() => fs.existsSync(socket));
    peer = net.connect(socket);
    let buffer = "";
    peer.setEncoding("utf8");
    peer.on("data", data => { buffer += data; let end; while ((end = buffer.indexOf("\n")) >= 0) { received.push(JSON.parse(buffer.slice(0, end))); buffer = buffer.slice(end + 1); } });
    await until(() => received.length > 0);
    assert.equal(received.at(-1).blocked, false);
    idle = false;
    fire("agent_start");
    const ask = provider === "omp" ? "ask" : "AskUserQuestion";
    fire("tool_execution_start", { toolCallId: "other", toolName: provider === "omp" ? "AskUserQuestion" : "ask" });
    fire("tool_execution_start", { toolCallId: "t1", toolName: ask });
    await until(() => received.at(-1).blocked === true);
    assert.equal(received.at(-1).running, true);
    fire("tool_execution_end", { toolCallId: "t1", toolName: ask });
    await until(() => received.at(-1).blocked === false && received.at(-1).running === true);
    if (provider === "omp") {
      fire("tool_approval_requested", { toolName: "bash" });
      await until(() => received.at(-1).blocked === true);
      fire("tool_approval_resolved", { toolName: "bash", approved: true });
      await until(() => received.at(-1).blocked === false);
    } else {
      assert.equal(handlers.has("tool_approval_requested"), false);
    }
    // An interrupted ask never reaches tool_execution_end; the turn's end clears it.
    fire("tool_execution_start", { toolCallId: "t2", toolName: ask });
    await until(() => received.at(-1).blocked === true);
    idle = true;
    fire("agent_end");
    await until(() => received.at(-1).blocked === false && received.at(-1).running === false);
  } finally {
    peer?.destroy();
    await handlers.get("session_shutdown")?.();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

await check("pi");
await check("omp");
console.log("Pi/OMP extension: ask tools and OMP approvals report needs-you until answered or the turn ends");

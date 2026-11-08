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
async function check(provider, thinkingApi = "available") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-pi-check-"));
  const socket = path.join(dir, "native.sock");
  const module = path.join(dir, "extension.ts");
  fs.writeFileSync(module, fs.readFileSync(new URL("./pi-extension.ts", import.meta.url), "utf8")
    .replace('"__PERCH_NATIVE_SOCKET__"', JSON.stringify(socket))
    .replace('"__PERCH_NATIVE_PROVIDER__"', JSON.stringify(provider)));
  const handlers = new Map();
  const sentMessages = [];
  const pi = { on(name, fn) { handlers.set(name, fn); }, appendEntry() {}, sendUserMessage(text, options) { sentMessages.push([text, options]); } };
  let effort = "high";
  if (thinkingApi !== "absent") pi.getThinkingLevel = () => { if (thinkingApi === "throws") throw new Error("unavailable"); return effort; };
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
    peer.on("data", data => { buffer += data; let end; while ((end = buffer.indexOf("\n")) >= 0) { const event = JSON.parse(buffer.slice(0, end)); if (event.type !== "commands") received.push(event); buffer = buffer.slice(end + 1); } });
    await until(() => received.length > 0);
    assert.equal(received.at(-1).blocked, false);
    assert.equal(received.at(-1).effort, thinkingApi === "available" ? "high" : null);
    if (thinkingApi === "available") {
      // Idle CLI changes must publish without waiting for a message or another turn.
      effort = "low";
      fire("model_select");
      await until(() => received.at(-1).effort === "low");
      if (provider === "pi") {
        effort = "off";
        fire("thinking_level_select", { level: effort, previousLevel: "low" });
        await until(() => received.at(-1).effort === "off");
      }
      // An unavailable reading clears the old value rather than inventing a default.
      effort = undefined;
      fire("model_select");
      await until(() => received.at(-1).effort === null);
    }
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
    // A steer joins a running turn through the CLI's steering queue, and is refused on an idle session.
    peer.write(JSON.stringify({ type: "steer", requestId: "s1", text: "use the other file" }) + "\n");
    await until(() => received.some(event => event.requestId === "s1"));
    assert.equal(received.find(event => event.requestId === "s1").accepted, false);
    assert.equal(sentMessages.length, 0);
    idle = false;
    peer.write(JSON.stringify({ type: "steer", requestId: "s2", text: "use the other file" }) + "\n");
    await until(() => received.some(event => event.requestId === "s2"));
    assert.equal(received.find(event => event.requestId === "s2").accepted, true);
    assert.deepEqual(sentMessages, [["use the other file", { deliverAs: "steer" }]]);
    peer.write(JSON.stringify({ type: "steer", requestId: "s2", text: "use the other file" }) + "\n");
    await until(() => received.filter(event => event.requestId === "s2").length === 2);
    assert.equal(sentMessages.length, 1, "a repeated request id is not sent twice");
    // The CLI goes idle with no event after the running snapshot (a missed settle): the extension looks
    // again by itself, so the core never keeps an idle prompt as "working".
    await until(() => received.at(-1).running === true);
    idle = true;
    await until(() => received.at(-1).running === false);
  } finally {
    peer?.destroy();
    await handlers.get("session_shutdown")?.();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

for (const provider of ["pi", "omp"]) {
  for (const api of ["available", "absent", "throws"]) await check(provider, api);
}
console.log("Pi/OMP extension: effort read-back and changes, missing APIs, ask tools and approvals");

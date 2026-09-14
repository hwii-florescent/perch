// Run: node crates/perch-core/src/native_ui/opencode-plugin.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { normalize } from "./opencode-plugin.mjs";

const raw = [{ type: "text", text: "é".repeat(20_000) }, ...Array.from({ length: 100 }, () => ({ type: "reasoning", text: "🤖".repeat(5000) })), { type: "text", text: "hidden", synthetic: true }, { type: "step-start" }, { type: "file", url: "data:image/png;base64,SECRET" }];
const [row] = normalize({ id: "m", role: "assistant" }, raw);
assert.ok(Buffer.byteLength(row.text) <= 16 * 1024);
assert.ok(Buffer.byteLength(row.thinking) <= 8 * 1024);
assert.ok(!JSON.stringify(row).includes("SECRET"));
assert.ok(!JSON.stringify(row).includes("hidden"));
assert.ok(!row.text.includes("�"));
assert.deepEqual(normalize({ id: "m", role: "assistant" }, [{ type: "step-start" }]), []);
assert.ok(normalize({ id: "m", role: "assistant", error: { data: { message: "Native failure" } } }, [])[0].error.includes("Native failure"));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-oc-check-"));
const socket = path.join(dir, "native.sock");
const module = path.join(dir, "plugin.mjs");
fs.writeFileSync(module, fs.readFileSync(new URL("./opencode-plugin.mjs", import.meta.url), "utf8").replace('"__PERCH_NATIVE_SOCKET__"', JSON.stringify(socket)));
const plugin = (await import(pathToFileURL(module))).default;
const rows = [];
const parts = new Map();
const events = new Map();
let dispose;
let submits = 0;
let creates = 0;
let abortResult = false;
let shellMode = false;
let rejectSubmit = false;
let promptRef;
let slots;
const route = { current: { name: "session", params: { sessionID: "ses_current" } }, navigate(name, params) { this.current = { name, params }; } };
const api = {
  route, state: { ready: true, path: { directory: dir }, part: id => parts.get(id) ?? [],
    session: { get: id => ({ id, directory: dir }), messages: () => rows, status: () => ({ type: "idle" }) } },
  ui: { dialog: { open: false }, Slot() {}, Prompt(props) {
    promptRef = { current: { input: "", parts: [] }, set(value) { this.current = value; }, reset() { this.current = { input: "", parts: [] }; }, submit() {
      if (rejectSubmit) return;
      submits++;
      if (route.current.name === "home") {
        creates++;
        rows.length = 0;
        events.get("session.created")?.({ properties: { info: { id: "ses_created_by_tui" } } });
        route.navigate("session", { sessionID: "ses_created_by_tui" });
      }
      const id = `msg_${submits}`;
      rows.push({ id, role: "user" }); parts.set(id, [{ type: "text", text: this.current.input }]);
      this.current = { input: "", parts: [] }; events.get("message.updated")?.();
    } };
    props.ref(promptRef);
  } },
  slots: { register(value) { slots = value.slots; slots.session_prompt({}, { session_id: "ses_current" }); } },
  keymap: { getActiveKeys: () => [{ bindings: [{ attrs: { desc: shellMode ? "Exit shell mode" : "Shell mode" } }] }] },
  event: { on(type, fn) { events.set(type, fn); } },
  client: { session: { create: async () => { creates++; return { data: { id: "ses_new" } }; }, abort: async () => ({ data: abortResult }) } },
  lifecycle: { onDispose(fn) { dispose = fn; } },
};
let peer;
const received = [];
async function until(predicate) {
  for (let attempt = 0; attempt < 900; attempt++) { if (predicate()) return; await delay(10); }
  throw new Error("native plugin check timed out");
}
async function request(requestId, type, text) {
  const start = received.length;
  peer.write(JSON.stringify({ requestId, type, text }) + "\n");
  await until(() => received.slice(start).some(value => value.type === "ack" && value.requestId === requestId));
  return received.slice(start).find(value => value.type === "ack" && value.requestId === requestId);
}
try {
  await plugin.tui(api);
  await until(() => fs.existsSync(socket) && (fs.statSync(socket).mode & 0o777) === 0o600);
  assert.equal(fs.statSync(socket).mode & 0o777, 0o600);
  peer = net.connect(socket);
  let buffer = "";
  peer.setEncoding("utf8");
  peer.on("data", data => { buffer += data; let end; while ((end = buffer.indexOf("\n")) >= 0) { received.push(JSON.parse(buffer.slice(0, end))); buffer = buffer.slice(end + 1); } });
  await until(() => received.some(value => value.type === "snapshot"));
  assert.equal(received.at(-1).providerSessionId, "ses_current");
  assert.equal(creates, 0); // Persisted sessions never become an implicit selection.
  await delay(400);
  const idleCount = received.length;
  await delay(600);
  assert.equal(received.length, idleCount); // No transcript polling while idle.
  promptRef.current.input = "CLI draft";
  assert.equal((await request("draft", "prompt", "web prompt")).accepted, false);
  assert.equal(promptRef.current.input, "CLI draft");
  assert.equal(submits, 0);
  promptRef.current.input = "";
  shellMode = true;
  assert.equal((await request("shell", "prompt", "touch should-not-exist")).accepted, false);
  assert.equal(submits, 0); // ref.current.mode is absent even in native shell mode.
  assert.equal(promptRef.current.input, "");
  shellMode = false;
  assert.equal((await request("escape", "prompt", "bad\x1btext")).accepted, false);
  assert.equal((await request("slash", "prompt", "/new")).accepted, false);
  assert.equal((await request("once", "prompt", "actual prompt")).accepted, true);
  assert.equal((await request("once", "prompt", "actual prompt")).accepted, true);
  assert.equal(submits, 1);
  assert.equal((await request("cancel-false", "cancel")).accepted, false);
  abortResult = true;
  assert.equal((await request("cancel-true", "cancel")).accepted, true);
  route.navigate("session", { sessionID: "ses_other" });
  await until(() => received.some(value => value.providerSessionId === "ses_other"));
  assert.equal(creates, 0);
  assert.equal((await request("changed", "prompt", "wrong prompt ref")).accepted, false);
  assert.equal(submits, 1);
  route.navigate("home");
  await until(() => received.some(value => value.providerSessionId === ""));
  await delay(600);
  assert.equal(creates, 0); // Observing the home route never creates a session.
  slots.home_prompt({}, {});
  assert.equal((await request("home", "prompt", "first\r\nturn")).accepted, true);
  assert.equal(creates, 1);
  assert.equal(route.current.params.sessionID, "ses_created_by_tui");
  assert.equal(parts.get(rows.at(-1).id)[0].text, "first\nturn");
  slots.session_prompt({}, { session_id: "ses_created_by_tui" });
  rejectSubmit = true;
  assert.equal((await request("rejected-native-submit", "prompt", "not sent")).accepted, false);
  assert.equal(promptRef.current.input, "");
  assert.equal(submits, 2);
  console.log("OpenCode plugin: bounds, exact route, home view, shell-mode guard, draft safety, native receipts, retry, rejected-submit cleanup, and cancellation passed");
} finally {
  peer?.destroy(); dispose?.(); fs.rmSync(dir, { recursive: true, force: true });
}

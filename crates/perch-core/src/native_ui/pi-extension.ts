// Loaded into the user's interactive Pi/OMP process with --extension.
// Only observes native messages and forwards explicitly authorized controls.
// Native APIs: Pi docs/extensions.md; oh-my-pi docs/extensions.md.
import net from "node:net";
import fs from "node:fs";

const SOCKET_PATH = "__PERCH_NATIVE_SOCKET__";
const PROVIDER = "__PERCH_NATIVE_PROVIDER__";
const MAX_FRAME = 256 * 1024;
const MAX_TRANSCRIPT = 192 * 1024;
const RECEIPT_TYPE = "dev.perch.ui.operation";

export default function (pi: any) {
  let ctx: any;
  let server: net.Server | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let currentMessage: any;
  let history: any[] = [];
  let historyTruncated = false;
  let historyDirty = true;
  let revision = 0;
  let stopped = false;
  const clients = new Set<net.Socket>();
  const receipts = new Map<string, string>();
  // Needs-you evidence (Orca pi-family-events.ts): an ask tool is running, or
  // OMP's policy engine parked a tool on the human. Pi 0.84 has no generic
  // dialog event, so an extension's own ctx.ui prompt is not seen here.
  const asking = new Set<string>();
  let approvals = 0;
  function isAsk(name: unknown): boolean {
    if (PROVIDER === "omp") return name === "ask";
    const normalized = String(name ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    return normalized === "askuserquestion" || normalized === "requestuserinput";
  }

  function clip(value: unknown, limit = 16 * 1024): string {
    const text = typeof value === "string" ? value : "";
    return text.length <= limit ? text : `${text.slice(0, limit)}\n[truncated in web view]`;
  }
  function json(value: unknown): string {
    try { return clip(JSON.stringify(value), 8 * 1024); } catch { return "[unavailable]"; }
  }
  function message(raw: any, fallbackId: string) {
    if (!raw || !["user", "assistant", "toolResult", "custom"].includes(raw.role)) return null;
    if (raw.role === "custom" && raw.display === false) return null;
    const content = typeof raw.content === "string" ? [{ type: "text", text: raw.content }] : Array.isArray(raw.content) ? raw.content : [];
    const text = content.filter((block: any) => block.type === "text").map((block: any) => block.text).join("\n");
    const thinking = content.filter((block: any) => block.type === "thinking").map((block: any) => block.thinking ?? block.text).join("\n");
    let toolBudget = 8 * 1024;
    const tools = content.filter((block: any) => block.type === "toolCall").slice(0, 32).map((block: any) => {
      const input = clip(json(block.arguments), Math.min(2048, toolBudget));
      toolBudget = Math.max(0, toolBudget - input.length);
      return { name: clip(block.name, 128), input };
    });
    // Image/audio payloads never cross this bridge as base64.
    const attachments = content.filter((block: any) => block.type === "image" || block.type === "audio").length;
    return {
      id: raw.timestamp != null ? `${raw.role}:${raw.timestamp}:${raw.toolCallId ?? ""}` : fallbackId,
      role: raw.role, text: clip(text) + (attachments ? `\n[${attachments} attachment(s) in CLI]` : ""),
      thinking: clip(thinking, 8 * 1024), tools,
      ...(raw.toolName ? { toolName: clip(raw.toolName, 128) } : {}),
      ...(raw.model ? { model: clip(raw.model, 256) } : {}),
      ...(raw.errorMessage ? { error: clip(raw.errorMessage, 4 * 1024) } : {}),
    };
  }
  function boundHistory() {
    let bytes = 0;
    for (let index = history.length - 1; index >= 0; index--) {
      bytes += Buffer.byteLength(JSON.stringify(history[index]));
      if (bytes > MAX_TRANSCRIPT || history.length - index > 128) {
        history = history.slice(index + 1); historyTruncated = true; break;
      }
    }
  }
  function refreshHistory() {
    const branch = ctx.sessionManager.getBranch();
    history = []; historyTruncated = false;
    // Read the native branch once on attach/branch change, then retain only
    // bounded normalized entries. Streaming updates never rescan old turns.
    for (let index = branch.length - 1; index >= 0; index--) {
      const entry = branch[index];
      const normalized = message(entry.type === "custom_message" ? { role: "custom", content: entry.content, display: entry.display } : entry.message, entry.id);
      if (!normalized) continue;
      if (history.length === 128) { historyTruncated = true; break; }
      history.unshift(normalized);
    }
    boundHistory(); historyDirty = false;
  }
  function snapshot() {
    if (historyDirty) refreshHistory();
    const messages = history.slice();
    const streaming = message(currentMessage, "streaming");
    if (streaming) {
      const index = messages.findIndex((entry: any) => entry.id === streaming.id);
      if (index < 0) messages.push(streaming); else messages[index] = streaming;
    }
    let bytes = 0;
    const recent = [];
    for (let index = messages.length - 1; index >= 0; index--) {
      const size = Buffer.byteLength(JSON.stringify(messages[index]));
      if (bytes + size > MAX_TRANSCRIPT) break;
      bytes += size;
      recent.unshift(messages[index]);
    }
    const running = !ctx.isIdle() || ctx.hasPendingMessages();
    return {
      type: "snapshot", version: 1, revision: ++revision, pid: process.pid,
      providerSessionId: ctx.sessionManager.getSessionFile() ?? ctx.sessionManager.getSessionId(),
      cwd: ctx.cwd, model: ctx.model?.id ?? null,
      running,
      blocked: running && (asking.size > 0 || approvals > 0),
      messages: recent, truncated: historyTruncated || messages.length > recent.length,
    };
  }
  function send(client: net.Socket, event: unknown) {
    const line = JSON.stringify(event) + "\n";
    if (Buffer.byteLength(line) > MAX_FRAME || client.writableLength + Buffer.byteLength(line) > MAX_FRAME * 2) { client.destroy(); return; }
    client.write(line);
  }
  function publish() {
    timer = undefined;
    if (stopped || !ctx || !clients.size) return;
    try { const event = snapshot(); for (const client of clients) send(client, event); }
    catch { for (const client of clients) client.destroy(); }
  }
  function schedule(delay = 100) {
    if (!stopped && !timer) { timer = setTimeout(publish, delay); timer.unref?.(); }
  }
  function receipt(id: string, state: string) {
    receipts.set(id, state);
    if (receipts.size > 256) receipts.delete(receipts.keys().next().value!);
    pi.appendEntry(RECEIPT_TYPE, { id, state });
  }
  function command(client: net.Socket, request: any) {
    const requestId = typeof request.requestId === "string" ? request.requestId : "";
    if (!requestId || requestId.length > 128) { client.destroy(); return; }
    try {
      if (request.type === "snapshot") { send(client, snapshot()); return; }
      if (request.type === "cancel") {
        ctx.abort();
        send(client, { type: "ack", requestId, accepted: true });
        schedule();
        return;
      }
      if (request.type !== "prompt" || typeof request.text !== "string" || !request.text.trim() || Buffer.byteLength(request.text) > 64 * 1024) throw new Error("Invalid prompt");
      if (receipts.has(requestId)) {
        send(client, { type: "ack", requestId, accepted: receipts.get(requestId) === "accepted", duplicate: true });
        return;
      }
      receipt(requestId, "dispatching");
      // This is the CLI's native user-input API. It runs its own extensions,
      // tools, context, auth, and approvals. Perch supplies no system prompt.
      const result = pi.sendUserMessage(request.text, ctx.isIdle() ? { expandPromptTemplates: true } : { deliverAs: "followUp", expandPromptTemplates: true });
      Promise.resolve(result).catch(() => schedule(0));
      receipt(requestId, "accepted");
      send(client, { type: "ack", requestId, accepted: true });
      schedule(0);
    } catch (error) {
      send(client, { type: "ack", requestId, accepted: false, error: clip(error instanceof Error ? error.message : String(error)) });
    }
  }
  async function stop() {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = undefined;
    for (const client of clients) client.destroy();
    clients.clear();
    const closing = server;
    server = undefined;
    if (closing) await new Promise<void>((resolve) => { try { closing.close(() => resolve()); } catch { resolve(); } });
  }
  pi.on("session_start", async (_event: any, context: any) => {
    if (server) await stop();
    ctx = context;
    stopped = false;
    currentMessage = undefined;
    historyDirty = true;
    receipts.clear();
    asking.clear();
    approvals = 0;
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "custom" && entry.customType === RECEIPT_TYPE && typeof entry.data?.id === "string") {
        receipts.set(entry.data.id, entry.data.state);
        if (receipts.size > 256) receipts.delete(receipts.keys().next().value!);
      }
    }
    server = net.createServer((client) => {
      if (clients.size >= 4) { client.destroy(); return; }
      clients.add(client);
      let buffer = "";
      client.setEncoding("utf8");
      client.on("error", () => client.destroy());
      client.on("close", () => clients.delete(client));
      client.on("data", (chunk) => {
        buffer += chunk;
        if (Buffer.byteLength(buffer) > MAX_FRAME) { client.destroy(); return; }
        let newline;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
          try { command(client, JSON.parse(line)); } catch { client.destroy(); return; }
        }
      });
      try { send(client, snapshot()); } catch { client.destroy(); }
    });
    server.on("error", () => { void stop(); });
    // The core removes a stale socket only before a fresh native process is
    // launched. Never unlink here: another live CLI may own this endpoint.
    server.listen(SOCKET_PATH, () => { try { fs.chmodSync(SOCKET_PATH, 0o600); } catch { void stop(); } });
    server.unref();
  });
  pi.on("session_shutdown", stop);
  for (const name of ["agent_start", "agent_end", "session_tree", "session_branch", "session_compact"]) {
    pi.on(name, (_event: any, context: any) => {
      ctx = context;
      if (name !== "agent_start") historyDirty = true;
      if (name === "agent_end") { asking.clear(); approvals = 0; }
      schedule();
    });
  }
  pi.on("tool_execution_start", (event: any, context: any) => {
    ctx = context;
    if (isAsk(event.toolName)) { asking.add(String(event.toolCallId)); schedule(0); }
  });
  pi.on("tool_execution_end", (event: any, context: any) => {
    ctx = context;
    if (asking.delete(String(event.toolCallId))) schedule(0);
  });
  if (PROVIDER === "omp") {
    // OMP only emits its approval lifecycle when an extension listens for it.
    pi.on("tool_approval_requested", (_event: any, context: any) => { ctx = context ?? ctx; approvals++; schedule(0); });
    pi.on("tool_approval_resolved", (_event: any, context: any) => { ctx = context ?? ctx; approvals = Math.max(0, approvals - 1); schedule(0); });
  }
  if (PROVIDER === "pi") pi.on("agent_settled", (_event: any, context: any) => { ctx = context; schedule(0); });
  for (const name of ["message_start", "message_update", "message_end"]) {
    pi.on(name, (event: any, context: any) => {
      ctx = context;
      currentMessage = name === "message_end" ? undefined : event.message;
      if (name === "message_end") {
        const normalized = message(event.message, `event:${revision}`);
        if (normalized) {
          const index = history.findIndex((entry: any) => entry.id === normalized.id);
          if (index < 0) history.push(normalized); else history[index] = normalized;
          boundHistory();
        }
      }
      schedule();
    });
  }
}

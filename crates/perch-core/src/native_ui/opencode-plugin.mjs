// OpenCode 1.18 TUI plugin. The native TUI selects the conversation and submits
// prompts with its own model, agent, context, tools and permission settings.
import net from "node:net";
import fs from "node:fs";

const SOCKET_PATH = "__PERCH_NATIVE_SOCKET__";
const MAX_FRAME = 256 * 1024;
const MAX_HISTORY = 192 * 1024;

function clip(value, limit = 16 * 1024) {
  if (typeof value !== "string") return "";
  if (Buffer.byteLength(value) <= limit) return value;
  const bytes = Buffer.from(value.slice(0, limit));
  let end = limit;
  while (end && (bytes[end] & 0xc0) === 0x80) end--;
  return bytes.subarray(0, end).toString();
}

export function normalize(info, parts) {
  if (!info?.id || !["user", "assistant"].includes(info.role)) return [];
  const row = { id: clip(info.id, 256), role: info.role, text: "", thinking: "", tools: [], model: clip(info.modelID ?? info.model?.modelID, 256) || null };
  const results = [];
  let toolBytes = 0;
  for (const part of parts) {
    if (part.ignored || part.synthetic) continue;
    if (part.type === "text" || part.type === "file") {
      row.text += clip(part.type === "file" ? "[attachment in CLI]" : part.text, 16 * 1024 - Buffer.byteLength(row.text));
    } else if (part.type === "reasoning") {
      row.thinking += clip(part.text, 8 * 1024 - Buffer.byteLength(row.thinking));
    } else if (part.type === "tool" && row.tools.length < 32) {
      const name = clip(part.tool, 128);
      const input = clip(JSON.stringify(part.state?.input ?? {}), Math.min(2048, 8 * 1024 - toolBytes));
      toolBytes += Buffer.byteLength(input);
      row.tools.push({ name, input });
      const output = clip(part.state?.output ?? part.state?.error, 2048);
      if (output) results.push({ id: clip(part.id, 256), role: "toolResult", text: output, thinking: "", tools: [], toolName: name });
    }
  }
  if (info.error) row.error = clip(info.error.data?.message ?? info.error.name, 4096);
  if (row.text || row.thinking || row.tools.length || row.error) results.unshift(row);
  return results;
}

export default {
  id: "perch-native-ui",
  async tui(api) {
    let prompt;
    let promptSession;
    let stopped = false;
    let revision = 0;
    let timer;
    let lastIdentity;
    let pending;
    const clients = new Set();
    const receipts = new Map();
    const sessionID = () => api.route.current.name === "session" ? api.route.current.params?.sessionID : undefined;

    // Render OpenCode's own prompt unchanged and retain its public ref. This
    // preserves native model/agent selection, paste handling and slash commands.
    const renderPrompt = (_context, props) => {
      let ownRef;
      return api.ui.Prompt({
        get sessionID() { return props.session_id; },
        get visible() { return props.visible; },
        get disabled() { return props.disabled; },
        get onSubmit() { return props.on_submit; },
        get right() { return api.ui.Slot({ name: props.session_id ? "session_prompt_right" : "home_prompt_right", session_id: props.session_id }); },
        ref(value) {
          if (value) { ownRef = value; prompt = value; promptSession = props.session_id; }
          else if (prompt === ownRef) { prompt = undefined; promptSession = undefined; }
          props.ref?.(value);
        },
      });
    };
    api.slots.register({ slots: { home_prompt: renderPrompt, session_prompt: renderPrompt } });

    function send(client, value) {
      const line = JSON.stringify(value) + "\n";
      const bytes = Buffer.byteLength(line);
      if (bytes > MAX_FRAME || client.writableLength + bytes > MAX_FRAME * 2) return client.destroy();
      client.write(line);
    }
    function receipt(requestId, accepted, error) {
      const result = { type: "ack", requestId, accepted, ...(error ? { error: clip(error, 4096) } : {}) };
      receipts.set(requestId, result);
      if (receipts.size > 256) receipts.delete(receipts.keys().next().value);
      return result;
    }
    function snapshot() {
      const id = sessionID();
      if (!api.state.ready || (id && !api.state.session.get(id))) return;
      const messages = id ? api.state.session.messages(id) : [];
      const rows = [];
      let bytes = 0;
      let truncated = false;
      for (let i = messages.length - 1; i >= 0; i--) {
        const normalized = normalize(messages[i], api.state.part(messages[i].id));
        const size = Buffer.byteLength(JSON.stringify(normalized));
        if (bytes + size > MAX_HISTORY || rows.length + normalized.length > 128) { truncated = true; break; }
        bytes += size;
        rows.unshift(...normalized);
      }
      const status = id ? api.state.session.status(id)?.type : undefined;
      const session = id ? api.state.session.get(id) : undefined;
      return { type: "snapshot", version: 1, revision: ++revision, pid: process.pid,
        providerSessionId: id ?? "", cwd: clip(session?.directory ?? api.state.path.directory, 4096),
        model: rows.findLast(row => row.model)?.model ?? null,
        running: !!status && status !== "idle", messages: rows, truncated };
    }
    function publish() {
      timer = undefined;
      if (stopped || !clients.size) return;
      try { const value = snapshot(); if (value) for (const client of clients) send(client, value); }
      catch { for (const client of clients) client.destroy(); }
    }
    function schedule() {
      if (!stopped && !timer) { timer = setTimeout(publish, 100); timer.unref?.(); }
    }
    function finish(accepted, error) {
      if (!pending) return;
      clearTimeout(pending.timer);
      const { client, requestId } = pending;
      // Only clear text that this operation placed in this exact native ref.
      // A changed draft, a different session, and attachments belong to the user.
      if (!accepted && prompt === pending.prompt && sessionID() === pending.id && prompt.current.input === pending.text && !prompt.current.parts.length) prompt.reset();
      pending = undefined;
      const result = receipt(requestId, accepted, error);
      if (!client.destroyed) send(client, result);
      schedule();
    }
    async function command(client, request) {
      const requestId = request?.requestId;
      if (typeof requestId !== "string" || !requestId || requestId.length > 128) return client.destroy();
      if (receipts.has(requestId)) return send(client, receipts.get(requestId));
      try {
        const id = sessionID();
        if (!api.state.ready || (id ? !api.state.session.get(id) : api.route.current.name !== "home")) throw new Error("OpenCode session is not ready");
        if (request.type === "cancel") {
          if (!id) throw new Error("OpenCode has no active turn");
          const result = await api.client.session.abort({ sessionID: id }, { throwOnError: true });
          if (result.data !== true) throw new Error("OpenCode did not confirm cancellation");
          send(client, receipt(requestId, true));
          schedule();
          return;
        }
        if (request.type !== "prompt" || typeof request.text !== "string" || !request.text.trim() || Buffer.byteLength(request.text) > 64 * 1024) throw new Error("Invalid prompt");
        if (pending) throw new Error("Another prompt is awaiting native confirmation");
        if (!prompt || promptSession !== id || api.ui.dialog.open || prompt.current.input || prompt.current.parts.length) throw new Error("OpenCode has a draft or dialog open; finish it in CLI mode first");
        // OpenCode 1.18's ref.current omits its actual shell mode. The active
        // native 'Shell mode' binding exists ONLY in an empty, focused normal
        // prompt with no autocomplete. Require that positive proof; an unknown
        // keymap is refused rather than submitting user text as a shell command.
        // ponytail: pinned native binding metadata; replace with ref.current.mode
        // when OpenCode exposes that value correctly through its public API.
        if (!api.keymap.getActiveKeys({ includeBindings: true }).some(key => key.bindings?.some(binding => binding.attrs?.desc === "Shell mode"))) throw new Error("OpenCode is not in its normal prompt mode; return to the empty CLI prompt first");
        request.text = request.text.replace(/\r\n?/g, "\n");
        if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(request.text)) throw new Error("Prompt contains terminal control characters");
        if (request.text.startsWith("/")) throw new Error("Run OpenCode slash commands in CLI mode");
        if (["exit", "quit", ":q"].includes(request.text.trim())) throw new Error("Close the session with Stop CLI");
        // A receipt is confirmed only by the resulting native user message.
        // Uncertain delivery is retained so reconnect/retry never resubmits it.
        receipt(requestId, false, "Native prompt delivery has not been confirmed; check the CLI before sending again");
        pending = { client, requestId, id, prompt, text: request.text, created: new Set(), before: new Set((id ? api.state.session.messages(id) : []).map(message => message.id)), timer: setTimeout(() => finish(false, "OpenCode did not confirm the prompt; check the CLI before sending again"), 7000) };
        prompt.set({ input: request.text, parts: [] });
        prompt.submit();
      } catch (error) {
        if (pending?.requestId === requestId) finish(false, error.message);
        else send(client, receipt(requestId, false, error.message));
      }
    }
    for (const type of ["message.updated", "message.part.updated", "message.part.delta", "message.part.removed", "message.removed", "session.status", "session.updated", "session.error", "permission.asked", "permission.replied"]) {
      api.event.on(type, () => schedule());
    }
    api.event.on("session.created", event => {
      if (pending && !pending.id && pending.created.size < 16) pending.created.add(event.properties.info.id);
      schedule();
    });
    // Only route/receipt metadata is polled. Transcript projection is batched
    // on native events; an idle session does not serialize history repeatedly.
    const poll = setInterval(() => {
      if (stopped) return;
      const id = sessionID();
      if (id !== lastIdentity) { lastIdentity = id; schedule(); }
      if (pending) {
        if (!pending.id && id && pending.created.has(id)) pending.id = id;
        if (id !== pending.id) finish(false, "The CLI changed sessions before confirming the prompt");
        else if (id && api.state.session.messages(id).some(message => message.role === "user" && !pending.before.has(message.id) && api.state.part(message.id).filter(part => part.type === "text" && !part.synthetic && !part.ignored).map(part => part.text).join("") === pending.text)) finish(true);
      }
    }, 250);
    poll.unref?.();
    const server = net.createServer(client => {
      if (clients.size >= 4) return client.destroy();
      clients.add(client);
      let buffer = "";
      client.setEncoding("utf8");
      client.on("error", () => client.destroy());
      client.on("close", () => clients.delete(client));
      client.on("data", chunk => {
        buffer += chunk;
        if (Buffer.byteLength(buffer) > MAX_FRAME) return client.destroy();
        let end;
        while ((end = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
          try { void command(client, JSON.parse(line)); } catch { return client.destroy(); }
        }
      });
      schedule();
    });
    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearInterval(poll); clearTimeout(timer);
      if (pending) clearTimeout(pending.timer);
      for (const client of clients) client.destroy();
      clients.clear(); server.close(() => {});
    };
    server.on("error", stop);
    server.listen(SOCKET_PATH, () => { try { fs.chmodSync(SOCKET_PATH, 0o600); } catch { stop(); } });
    server.unref();
    api.lifecycle.onDispose(stop);
  },
};

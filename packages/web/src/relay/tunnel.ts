/**
 * One sealed session to the computer through the relay, carrying the same
 * requests and WebSocket the page would send over the LAN. The host's half is
 * `crates/perch-core/src/relay/host.rs`; frames are defined in `wire.ts`.
 *
 * A closed tunnel is dead, never resumed: its counters are part of what makes
 * each frame valid, so a new connection means a new hello and new nonces.
 */
import * as W from "./wire";
import type { RelayDiagnostics } from "./diagnostics";

/** The page's own WebSocket, kept before `transport.ts` replaces the global. */
const NativeWebSocket = globalThis.WebSocket;
const HELLO_TIMEOUT_MS = 15_000;
const CHUNK = 48 * 1024;
/** Stop queueing frames while this much is waiting to leave the phone. */
const MAX_BUFFERED = 4 * 1024 * 1024;
/** Largest message joined from pieces. ponytail: held whole in memory; a terminal
 * replay is the biggest real case, so past this the session ends instead of growing. */
const MAX_MESSAGE = 64 * 1024 * 1024;

export interface ResponseHead {
  status: number;
  contentType?: string | null;
  contentDisposition?: string | null;
  setCookie?: string | null;
}

export interface SocketHandlers {
  opened(): void;
  text(data: string): void;
  closed(): void;
}

interface Pending {
  resolve(value: { head: ResponseHead; body: Uint8Array }): void;
  reject(error: Error): void;
  head?: ResponseHead;
  chunks: Uint8Array[];
}

const utf8 = new TextEncoder();

export class Tunnel {
  closed = false;
  readonly ready: Promise<void>;
  private ws: WebSocket | undefined;
  private key!: CryptoKey;
  private readonly guest = crypto.getRandomValues(new Uint8Array(W.NONCE_LEN));
  private host = new Uint8Array(0);
  private sent = 0;
  private received = 0;
  private tx: Promise<void> = Promise.resolve();
  private rx: Promise<void> = Promise.resolve();
  private nextId = 1;
  private readonly requests = new Map<number, Pending>();
  private readonly sockets = new Map<number, SocketHandlers>();
  /** Pieces of a text message still arriving, by socket id. */
  private readonly parts = new Map<number, { chunks: Uint8Array[]; size: number }>();

  constructor(keyText: string, wsUrl: string, private readonly report: (update: Partial<Pick<RelayDiagnostics, "stage" | "error" | "closeCode">>) => void = () => undefined) {
    this.report({ stage: "preparing-encryption" });
    this.ready = new Promise<void>((resolve, reject) => {
      const giveUp = setTimeout(() => this.fail("the computer did not answer"), HELLO_TIMEOUT_MS);
      this.onReady = () => { clearTimeout(giveUp); resolve(); };
      this.onFail = (reason) => { clearTimeout(giveUp); reject(new Error(reason)); };
    });
    // Callers that never await it must not see an unhandled rejection.
    this.ready.catch(() => undefined);
    void this.start(keyText, wsUrl).catch(() => this.fail("the browser could not start the encrypted relay connection"));
  }

  private onReady: () => void = () => undefined;
  private onFail: (reason: string) => void = () => undefined;

  private async start(keyText: string, wsUrl: string): Promise<void> {
    const raw = W.base64urlDecode(keyText);
    if (!raw || raw.length !== W.KEY_LEN) return this.fail("the link's key is damaged");
    this.key = await W.importKey(raw);
    if (this.closed) return;
    this.report({ stage: "connecting-relay" });
    const ws = new NativeWebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onopen = () => {
      this.report({ stage: "waiting-for-computer" });
      void W.seal(this.key, W.helloAad(false), W.frame(W.HELLO_GUEST, 0, this.guest))
        .then((hello) => { if (!this.closed) ws.send(hello); })
        .catch(() => this.fail("the browser could not send the encrypted hello"));
    };
    ws.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) return;
      const bytes = new Uint8Array(event.data);
      this.rx = this.rx.then(() => this.receive(bytes)).catch(() => this.fail("the browser could not process an encrypted relay frame"));
    };
    ws.onclose = (event) => {
      // The peer's reason is untrusted and may contain secrets. Use only its code.
      const reasons: Record<number, string> = {
        4004: "the computer is not connected to the relay",
        4005: "the computer closed the encrypted session",
        1009: "the relay rejected an oversized frame",
      };
      const error = reasons[event.code] ?? "the relay WebSocket closed";
      if (this.closed) {
        this.report({ closeCode: event.code });
        if (reasons[event.code]) this.report({ closeCode: event.code, error });
      } else {
        this.fail(error, event.code);
      }
    };
    ws.onerror = () => this.fail("the relay cannot be reached");
  }

  private async receive(sealed: Uint8Array): Promise<void> {
    if (this.closed) return;
    if (this.host.length === 0) {
      const plain = await W.open(this.key, W.helloAad(true, this.guest), sealed);
      const hello = plain && W.parseFrame(plain);
      if (!hello || hello.kind !== W.HELLO_HOST || hello.payload.length !== W.NONCE_LEN) return this.fail("the computer's answer was not valid");
      this.host = new Uint8Array(hello.payload);
      this.report({ stage: "tunnel-ready" });
      this.onReady();
      return;
    }
    const plain = await W.open(this.key, W.dataAad(this.guest, this.host, true, this.received), sealed);
    const frame = plain && W.parseFrame(plain);
    if (!frame) return this.fail("a frame did not verify");
    this.received += 1;
    this.dispatch(frame.kind, frame.id, frame.payload);
  }

  private dispatch(kind: number, id: number, payload: Uint8Array): void {
    const request = this.requests.get(id);
    switch (kind) {
      case W.RES_HEAD:
        if (request) {
          try {
            request.head = JSON.parse(new TextDecoder().decode(payload)) as ResponseHead;
          } catch {
            // The host only sends valid JSON here; anything else is a broken peer.
            this.fail("the computer sent a damaged response");
          }
        }
        break;
      case W.RES_BODY:
        request?.chunks.push(new Uint8Array(payload));
        break;
      case W.RES_END:
        if (request && request.head) request.resolve({ head: request.head, body: W.concat(...request.chunks) });
        this.requests.delete(id);
        break;
      case W.WS_OPENED:
        this.sockets.get(id)?.opened();
        break;
      case W.WS_TEXT_PART: {
        const held = this.parts.get(id) ?? { chunks: [], size: 0 };
        held.chunks.push(new Uint8Array(payload));
        held.size += payload.length;
        this.parts.set(id, held);
        if (held.size > MAX_MESSAGE) this.fail("the computer sent a message that is too large");
        break;
      }
      case W.WS_TEXT: {
        // Pieces are bytes and may split a character: join them, then decode.
        const held = this.parts.get(id);
        this.parts.delete(id);
        const whole = held ? W.concat(...held.chunks, payload) : payload;
        this.sockets.get(id)?.text(new TextDecoder().decode(whole));
        break;
      }
      case W.WS_CLOSE:
        this.parts.delete(id);
        this.sockets.get(id)?.closed();
        this.sockets.delete(id);
        break;
      default:
    }
  }

  private send(kind: number, id: number, payload?: Uint8Array): Promise<void> {
    this.tx = this.tx.then(async () => {
      const ws = this.ws;
      if (this.closed || !ws) return;
      // The counter is taken and the frame leaves in one step, so order holds.
      while (ws.bufferedAmount > MAX_BUFFERED) await new Promise((r) => setTimeout(r, 20));
      const sealed = await W.seal(this.key, W.dataAad(this.guest, this.host, false, this.sent), W.frame(kind, id, payload));
      this.sent += 1;
      if (!this.closed) ws.send(sealed);
    }).catch(() => this.fail("the browser could not send an encrypted relay frame"));
    return this.tx;
  }

  fail(reason: string, closeCode: number | null = null): void {
    if (this.closed) return;
    this.closed = true;
    this.report({ stage: "failed", error: reason, closeCode });
    this.onFail(reason);
    for (const request of this.requests.values()) request.reject(new Error(reason));
    this.requests.clear();
    for (const socket of this.sockets.values()) socket.closed();
    this.sockets.clear();
    this.parts.clear();
    try {
      this.ws?.close();
    } catch {
      // Already closing.
    }
  }

  async request(init: { method: string; path: string; contentType?: string; token?: string | null; body?: Uint8Array }): Promise<{ head: ResponseHead; body: Uint8Array }> {
    await this.ready;
    const id = this.nextId++;
    const done = new Promise<{ head: ResponseHead; body: Uint8Array }>((resolve, reject) => this.requests.set(id, { resolve, reject, chunks: [] }));
    const { body, ...head } = init;
    void this.send(W.REQ_HEAD, id, utf8.encode(JSON.stringify(head)));
    for (let at = 0; body && at < body.length; at += CHUNK) void this.send(W.REQ_BODY, id, body.subarray(at, at + CHUNK));
    void this.send(W.REQ_END, id);
    return done;
  }

  /** Open the page's `/ws` on the computer; frames come back through `handlers`. */
  openSocket(path: string, token: string | null, handlers: SocketHandlers): { text(data: string): void; close(): void } {
    const id = this.nextId++;
    this.sockets.set(id, handlers);
    void this.send(W.WS_OPEN, id, utf8.encode(JSON.stringify({ path, token })));
    return {
      text: (data) => void this.send(W.WS_TEXT, id, utf8.encode(data)),
      close: () => {
        this.sockets.delete(id);
        void this.send(W.WS_CLOSE, id);
      },
    };
  }
}

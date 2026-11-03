/**
 * Relay mode: the page was opened from a relay (`<relay>/#r=<room>.<key>`), so
 * the computer is not at this origin. The app's own `fetch` of its data routes
 * and its `/ws` socket are sent through a sealed tunnel instead
 * (`tunnel.ts`); everything else, including the app's own assets, is the
 * browser's usual. Nothing else in the app knows.
 *
 * What the link holds is only the key. Access still needs the device token that
 * pairing issues (`pairing.ts`); it is kept here because the tunnel has no
 * cookies.
 */
import { useEffect, useState } from "react";
import { getBasePath } from "../base";
import { base64urlDecode, KEY_LEN } from "./wire";
import { Tunnel } from "./tunnel";
import { getRelayDiagnostics, reportConnection } from "./diagnostics";

const LINK_KEY = "perch.relay.link";
const tokenKey = (room: string) => `perch.relay.token.${room}`;
/** The routes `host.rs` will carry; the same set, by name under the base path. */
const ROUTES = new Set(["pair", "ws", "workspace-file", "clipboard-image", "upload"]);
const ROOM = /^[A-Za-z0-9_-]{43}$/;

interface Link {
  room: string;
  key: string;
}

let link: Link | null = null;
let tunnel: Tunnel | null = null;

export function isRelayMode(): boolean {
  return link !== null;
}

function parseLink(text: string): Link | null {
  const [room, key] = text.split(".");
  if (!room || !key || !ROOM.test(room) || base64urlDecode(key)?.length !== KEY_LEN) return null;
  return { room, key };
}

/** The link in this page's address (kept, then removed from the address bar so
 * it isn't left in history), else the one saved by an earlier visit: a
 * home-screen icon opens without the fragment. */
function readLink(): Link | null {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const fromUrl = parseLink(fragment.get("r") ?? "");
  if (fromUrl) {
    localStorage.setItem(LINK_KEY, JSON.stringify(fromUrl));
    reportConnection({ storageAvailable: true });
    fragment.delete("r");
    const rest = fragment.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${rest ? `#${rest}` : ""}`);
    return fromUrl;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(LINK_KEY) ?? "null") as Link | null;
    reportConnection({ storageAvailable: true });
    return saved && parseLink(`${saved.room}.${saved.key}`);
  } catch {
    reportConnection({ storageAvailable: false, error: "the browser could not read the saved relay link" });
    return null;
  }
}

function currentTunnel(): Tunnel {
  if (!link) throw new Error("not in relay mode");
  if (!tunnel || tunnel.closed) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const attempt = getRelayDiagnostics().attempts + 1;
    reportConnection({ attempts: attempt });
    tunnel = new Tunnel(link.key, `${protocol}//${window.location.host}/r/${link.room}?role=guest`, (update) => {
      // An old socket can finish closing after the next attempt has started.
      if (getRelayDiagnostics().attempts === attempt) reportConnection(update);
    });
  }
  return tunnel;
}

/** The route a same-origin URL names (`pair`, `ws?x`, …) or null for the app's own files. */
function routeOf(url: URL): string | null {
  if (url.origin !== window.location.origin) return null;
  const base = getBasePath();
  if (!url.pathname.startsWith(base)) return null;
  const name = url.pathname.slice(base.length);
  return ROUTES.has(name) ? name + url.search : null;
}

function token(): string | null {
  try {
    const value = link ? localStorage.getItem(tokenKey(link.room)) : null;
    reportConnection({ tokenPresent: Boolean(value), storageAvailable: true });
    return value;
  } catch {
    reportConnection({ storageAvailable: false, error: "the browser could not read the paired device token" });
    return null;
  }
}

async function tunnelFetch(route: string, init: RequestInit | undefined): Promise<Response> {
  const headers = new Headers(init?.headers);
  const body = init?.body == null ? undefined : new Uint8Array(await new Response(init.body).arrayBuffer());
  let result;
  try {
    result = await currentTunnel().request({ method: (init?.method ?? "GET").toUpperCase(), path: route, contentType: headers.get("content-type") ?? undefined, token: token(), body });
  } catch {
    throw new TypeError("Failed to fetch");
  }
  const issued = /perch_device=([A-Za-z0-9]+)/.exec(result.head.setCookie ?? "")?.[1];
  if (issued && link) {
    try {
      localStorage.setItem(tokenKey(link.room), issued);
      reportConnection({ tokenPresent: true, storageAvailable: true });
    } catch {
      reportConnection({ storageAvailable: false, error: "the browser could not save the paired device token" });
      throw new Error("Allow site storage so this browser can remember its pairing.");
    }
  }
  const out = new Headers();
  if (result.head.contentType) out.set("content-type", result.head.contentType);
  if (result.head.contentDisposition) out.set("content-disposition", result.head.contentDisposition);
  const empty = [204, 205, 304].includes(result.head.status);
  return new Response(empty ? null : (result.body as BufferSource), { status: result.head.status, headers: out });
}

type Listener = ((event: Event) => void) | null;

/** Enough of `WebSocket` for the app's one socket (`ws.ts`). */
class RelayWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readyState = 0;
  binaryType: BinaryType = "blob";
  bufferedAmount = 0;
  readonly protocol = "";
  readonly extensions = "";
  onopen: Listener = null;
  onmessage: Listener = null;
  onclose: Listener = null;
  onerror: Listener = null;
  private controller: { text(data: string): void; close(): void } | undefined;

  constructor(readonly url: string, route: string) {
    super();
    const t = currentTunnel();
    t.ready.then(
      () => {
        if (this.readyState !== 0) return;
        if (t === tunnel) reportConnection({ stage: "opening-perch" });
        this.controller = t.openSocket(route, token(), {
          opened: () => {
            if (this.readyState !== 0) return;
            this.readyState = 1;
            if (t === tunnel) reportConnection({ stage: "connected" });
            this.emit(new Event("open"));
          },
          text: (data) => this.emit(new MessageEvent("message", { data })),
          closed: () => {
            if (t === tunnel && !t.closed) reportConnection({ stage: "failed", error: "the computer did not keep the Perch data socket open; pairing may be required" });
            this.finish(1006);
          },
        });
      },
      () => {
        this.emit(new Event("error"));
        this.finish(1006);
      },
    );
  }

  send(data: string): void {
    if (this.readyState !== 1) throw new DOMException("not open", "InvalidStateError");
    this.controller?.text(data);
  }

  close(code = 1005): void {
    if (this.readyState >= 2) return;
    this.readyState = 2;
    this.controller?.close();
    setTimeout(() => this.finish(code), 0);
  }

  private finish(code: number): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit(new CloseEvent("close", { code, wasClean: code === 1005 || code === 1000 }));
  }

  private emit(event: Event): void {
    this.dispatchEvent(event);
    const handler = this[`on${event.type}` as "onopen"];
    handler?.call(this, event);
  }
}

/** Take over the app's data routes if this page came from a relay. Call once,
 * before the app makes its first request. */
export function installRelayTransport(): boolean {
  const fragmentPresent = new URLSearchParams(window.location.hash.slice(1)).has("r");
  reportConnection({ secureContext: Boolean(window.isSecureContext), webCrypto: Boolean(window.crypto?.subtle) });
  try {
    link = readLink();
  } catch {
    reportConnection({ mode: "relay", linkPresent: fragmentPresent, storageAvailable: false, stage: "failed", error: "the browser could not save the relay link" });
    return false;
  }
  reportConnection({ mode: link || fragmentPresent ? "relay" : "direct", linkPresent: Boolean(link), stage: link ? "link-ready" : "direct" });
  if (!link) {
    if (fragmentPresent) reportConnection({ stage: "failed", error: "the relay link is incomplete or damaged" });
    return false;
  }
  token();
  if (!window.crypto?.subtle) {
    reportConnection({ stage: "failed", error: "browser encryption is unavailable; a secure HTTPS page is required" });
    return false;
  }
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const route = typeof input === "string" || input instanceof URL ? routeOf(new URL(input, window.location.href)) : null;
    return route ? tunnelFetch(route, init) : nativeFetch(input, init);
  };
  const NativeWebSocket = window.WebSocket;
  // SAFETY: `new Patched(...)` returns either a real WebSocket or a RelayWebSocket,
  // which implements the parts of the interface the app uses (ws.ts: events,
  // send, close, readyState) and nothing else reads.
  const Patched = function (url: string | URL, protocols?: string | string[]) {
    let href: string;
    let route: string | null;
    try {
      href = new URL(url, window.location.href).href;
      route = routeOf(new URL(href.replace(/^ws/, "http")));
    } catch {
      // Not a URL: the real constructor rejects it with the right error.
      return new NativeWebSocket(url, protocols);
    }
    return route ? new RelayWebSocket(href, route) : new NativeWebSocket(url, protocols);
  } as unknown as typeof WebSocket;
  Object.assign(Patched, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  window.WebSocket = Patched;
  return true;
}

/** A file from the computer as an object URL: `<img>`, `<video>` and the like
 * fetch by themselves, which cannot go through the tunnel. */
export async function relayBlobUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return URL.createObjectURL(await response.blob());
}

/** `url` itself on the LAN; in relay mode an object URL once fetched (null
 * until then, and `onError` if it cannot be). */
export function useRelayUrl(url: string, onError: () => void): string | null {
  const relay = isRelayMode();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!relay) return;
    let live = true;
    let made: string | null = null;
    setBlobUrl(null);
    relayBlobUrl(url).then(
      (objectUrl) => {
        if (live) {
          made = objectUrl;
          setBlobUrl(objectUrl);
        } else URL.revokeObjectURL(objectUrl);
      },
      () => live && onError(),
    );
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [relay, url, onError]);
  return relay ? blobUrl : url;
}

/** Save a file from the computer; in relay mode its link cannot be followed. */
export async function relayDownload(url: string, name: string): Promise<void> {
  const objectUrl = await relayBlobUrl(url);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

//! The native chat composer's state that must outlive any one view of it: the unsent draft (text, staged
//! attachments and the operation id a send of exactly that draft carries), the message in flight and the
//! answered-prompt receipts, keyed by chat (session + agent). A view only renders and edits it, so a stock or
//! cloned chat screen being reloaded or swapped, a hidden copy being released, two copies of one chat, or the
//! phone and desktop layouts trading places all see one draft and one send:
//! - a send in flight blocks a second one from any copy, and its outcome lands here even if the view that started
//!   it is gone;
//! - a retry of an unchanged draft reuses its operation id, in memory and (with the text) across a page reload,
//!   and the core dispatches one id at most once (`server/native_ui.rs`, `reserve_prompt_operation`);
//! - an edit makes a different message, so it gets a new id;
//! - an unconfirmed send is never replayed: its text comes back only as a new message (`restoreUnconfirmed`).
import { useCallback, useSyncExternalStore } from "react";
import type { NativeUiSnapshot } from "@perch/shared";
import { newId } from "./ids";
import { NativeUiError, requestNativeUi } from "./nativeUi";
import type { StagedAttachment } from "./attachments";
import { loadDraft, saveDraftText } from "./views/nativeChat/composerDraft";
import { withAttachmentPaths } from "./views/nativeChat/menuTokens";

/** A staged attachment; `file` is the picked file itself, kept so a thumbnail can be drawn again after the chat view was unmounted. */
export type ComposerImage = StagedAttachment & { file?: File };
/** An answered request, shown under the transcript until the CLI moves on. */
export type Receipt = { id: string; title: string; label: string };
export type ChatDraft = { text: string; operationId: string; images: ComposerImage[] };
/** A message sent from this page that the transcript does not show yet. `unconfirmed` means delivery is unknown.
 * `text` is the whole prompt as sent (attachment paths included); `draft` is what returns to the composer. */
export type ChatOutbox = { operationId: string; text: string; draft: Pick<ChatDraft, "text" | "images">; phase: "sending" | "delivered" | "unconfirmed"; baseline: number };
export interface ChatComposer {
  draft: ChatDraft;
  outbox: ChatOutbox | null;
  receipts: Receipt[];
  /** Why the last send failed, until the next send or edit. */
  error: string | null;
}
export type SendOutcome =
  | { kind: "sent" }
  | { kind: "command"; command: string }
  | { kind: "unconfirmed"; error: string }
  | { kind: "failed"; error: string }
  /** Nothing was sent: one is already in flight, or the draft is empty. */
  | { kind: "busy" };

const MAX_CHATS = 128;
const MAX_BYTES = 64 * 1024;
const chats = new Map<string, ChatComposer>();
const listeners = new Map<string, Set<() => void>>();

export const chatKey = (sessionId: string, providerId: string) => JSON.stringify([sessionId, providerId]);

/** How many times `text` appears as the person's message in the transcript: a send counts as shown once that grows. */
export const sentCount = (snapshot: NativeUiSnapshot | null, text: string) =>
  snapshot?.messages.filter((message) => message.role === "user" && message.text.trim() === text.trim()).length ?? 0;

export function chatComposer(key: string): ChatComposer {
  let chat = chats.get(key);
  if (!chat) {
    // A reload keeps the text and its operation id (not staged files: a path on the host may be gone).
    const saved = loadDraft(key);
    chat = { draft: { text: saved.text, operationId: saved.operationId ?? newId(), images: [] }, outbox: null, receipts: [], error: null };
    chats.set(key, chat);
    // ponytail: bounded by chat count, oldest first; a chat dropped here keeps its saved text (not its outbox).
    while (chats.size > MAX_CHATS) {
      const oldest = [...chats].find(([, value]) => !value.outbox || value.outbox.phase !== "sending")?.[0];
      if (!oldest || oldest === key) break;
      chats.delete(oldest);
    }
  }
  return chat;
}

function update(key: string, patch: Partial<ChatComposer>) {
  chats.set(key, { ...chatComposer(key), ...patch });
  for (const listener of [...(listeners.get(key) ?? [])]) listener();
}

/** A React hook: the chat's composer state, shared by every view of it. */
export function useChatComposer(key: string): ChatComposer {
  const subscribe = useCallback((changed: () => void) => {
    const set = listeners.get(key) ?? new Set();
    listeners.set(key, set);
    set.add(changed);
    return () => { set.delete(changed); if (!set.size) listeners.delete(key); };
  }, [key]);
  return useSyncExternalStore(subscribe, () => chatComposer(key));
}

/** A new draft text (and staged files): a different message, so a new operation id. False when it is over 64 KiB. */
export function editDraft(key: string, text: string, images = chatComposer(key).draft.images): boolean {
  if (new TextEncoder().encode(text).length > MAX_BYTES) return false;
  const operationId = newId();
  update(key, { draft: { text, operationId, images }, error: null });
  saveDraftText(key, text, undefined, operationId);
  return true;
}

function settle(key: string, operationId: string) {
  if (chatComposer(key).draft.operationId !== operationId) return;
  update(key, { draft: { text: "", operationId: newId(), images: [] } });
  saveDraftText(key, "");
}

/** Sends the chat's draft once. `generation` is the input lease the view holds; `replaces` the CLI line the
 * composer picked up; `delivery` how a message joins a running turn. `baseline` counts the prompt in the
 * transcript now, so the pending copy goes once the transcript shows one more. */
export async function sendDraft(key: string, input: {
  sessionId: string;
  providerId: string;
  generation: number;
  baseline: (prompt: string) => number;
  delivery?: "steer" | "queue";
  replaces?: string;
}): Promise<SendOutcome> {
  const { draft, outbox } = chatComposer(key);
  if (outbox?.phase === "sending" || (!draft.text.trim() && !draft.images.length)) return { kind: "busy" };
  const prompt = withAttachmentPaths(draft.text, draft.images.map((image) => image.path));
  const sent: ChatOutbox = { operationId: draft.operationId, text: prompt, draft: { text: draft.text, images: draft.images }, phase: "sending", baseline: input.baseline(prompt) };
  update(key, { outbox: sent, error: null });
  const still = () => chatComposer(key).outbox?.operationId === sent.operationId;
  try {
    const reply = await requestNativeUi({
      type: "agent.ui.prompt", requestId: newId(), sessionId: input.sessionId, providerId: input.providerId, generation: input.generation,
      operationId: draft.operationId, text: prompt, ...(input.delivery ? { delivery: input.delivery } : {}), ...(input.replaces ? { replaces: input.replaces } : {}),
    });
    if (reply.type !== "agent.ui.result" || !reply.accepted) throw new Error("The CLI did not accept this action.");
    settle(key, draft.operationId);
    if (reply.command) {
      if (still()) update(key, { outbox: null });
      return { kind: "command", command: draft.text.trim() };
    }
    if (still()) update(key, { outbox: { ...sent, phase: "delivered" } });
    return { kind: "sent" };
  } catch (reason) {
    const error = (reason as Error).message;
    if (reason instanceof NativeUiError && reason.uncertain) {
      settle(key, draft.operationId);
      if (still()) update(key, { outbox: { ...sent, phase: "unconfirmed" }, error });
      return { kind: "unconfirmed", error };
    }
    // Refused or failed before delivery: the draft (and its operation id) stays for a retry.
    update(key, { ...(still() ? { outbox: null } : {}), error });
    return { kind: "failed", error };
  }
}

/** Drops the pending copy of `operationId` (the transcript shows it, or it was dismissed). */
export function clearOutbox(key: string, operationId?: string) {
  const { outbox } = chatComposer(key);
  if (outbox && (!operationId || outbox.operationId === operationId)) update(key, { outbox: null });
}

/** Delivery was unknown: the text comes back as a new message for the person to judge against the transcript. */
export function restoreUnconfirmed(key: string): boolean {
  const { outbox } = chatComposer(key);
  if (!outbox || outbox.phase !== "unconfirmed") return false;
  editDraft(key, outbox.draft.text, outbox.draft.images);
  update(key, { outbox: null, error: null });
  return true;
}

export const clearChatError = (key: string) => { if (chatComposer(key).error !== null) update(key, { error: null }); };

/** An answered prompt, kept under the transcript (the newest 20). */
export function addReceipt(key: string, receipt: Receipt) {
  update(key, { receipts: [...chatComposer(key).receipts, receipt].slice(-20) });
}

/** Tests only: forget every chat held in memory, as a page reload does (saved drafts stay). */
export function resetChatComposersForTest() {
  chats.clear();
}

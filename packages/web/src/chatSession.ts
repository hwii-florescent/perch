//! One native chat as Perch runs it (`useNativeChat`, `@perch/sdk` 1.5), for the stock screen `stock:chat` and its
//! clones. Everything that must have one owner lives here or below, never in the screen: the CLI's transcript
//! subscription, the terminal binding and its input lease (who may type), the draft, its operation id and the send
//! in flight (`chatComposer.ts`), answers to the CLI's requests, option changes, stop, attachments, the pick-up of
//! a line typed in the CLI, and the family, suggestion and inbound actions that ride the same lease. The screen
//! draws what this returns and calls its actions; replacing or reloading the screen therefore cannot drop a draft,
//! send twice or lose a provider approval. Transcript projection and the provider protocol stay in Rust.
//!
//! Call it once per chat view: it opens the CLI's terminal binding for as long as the view is mounted.
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { AgentLifecycleStatus, GitDiffFile, NativeUiSnapshot } from "@perch/shared";
import { usePerchStore } from "./store";
import { agentInputGeneration, openAgentTerminal } from "./agentTerminals";
import { requestNativeUi, subscribeNativeUi } from "./nativeUi";
import { socket } from "./ws";
import { deliveryFor, useSendWhileWorking } from "./chatSend";
import { newId } from "./ids";
import { withTerminalDraft } from "./views/nativeChat/composerDraft";
import { addReceipt, chatKey, clearChatError, clearOutbox, editDraft, restoreUnconfirmed, sendDraft, sentCount, useChatComposer, type ComposerImage } from "./chatComposer";
import { activeMenu } from "./views/nativeChat/menuTokens";
import { useComposerMenu } from "./views/nativeChat/useComposerMenu";
import { useLastTurnChanges, withHost } from "./views/nativeChat/useLastTurnChanges";
import { useOlderHistory } from "./views/nativeChat/useOlderHistory";
import { useFindHits } from "./views/nativeChat/useFindHits";
import { actOnInbound, useInbound, type InboundAction } from "./inbound";
import { actOnChild, useCrew } from "./crew";
import { actOnSuggestion, useSuggestions, type SuggestionAction } from "./suggestions";
import { uploadAttachment } from "./attachments";
import { workspaceRecord } from "./terminalScope";
import type * as Sdk from "@perch/sdk";

/** The CLI's answer to an action, or why it did not take it. */
async function accepted(work: Promise<{ type: string; accepted?: boolean }>, refusal: string): Promise<void> {
  const reply = await work;
  if (reply.type !== "agent.ui.result" || !reply.accepted) throw new Error(refusal);
}

export function useNativeChat({ sessionId, providerId, terminalProviderId = providerId, caret = 0, listRef, find = null }: {
  sessionId: string;
  providerId: string;
  terminalProviderId?: string;
  caret?: number;
  listRef?: RefObject<HTMLElement | null>;
  find?: string | null;
}): Sdk.NativeChat {
  const connected = usePerchStore((state) => state.connected);
  const whileWorking = useSendWhileWorking();
  const draftKey = chatKey(sessionId, providerId);
  const composer = useChatComposer(draftKey);
  const { text, images } = composer.draft;
  const outbox = composer.outbox;
  const [uploading, setUploading] = useState(0);
  const textRef = useRef(text);
  textRef.current = text;
  const imagesRef = useRef(images);
  imagesRef.current = images;
  // What was typed on the CLI's own line when this chat was opened: the next send replaces it (the core clears it first).
  const pickedUp = useRef<string | null>(null);
  const pickupChecked = useRef<string | null>(null);
  const session = usePerchStore((state) => state.sessions.find((entry) => entry.id === sessionId));
  const activeHostId = usePerchStore((state) => state.activeHostId);
  const hostId = session?.hostId ?? activeHostId;
  const workspaceId = session?.workspaceId;
  // Where this chat lives. The folder is fixed when the agent launches (providers key their history to it), so this only names it.
  const folderPath = session?.cwd;
  const folderName = usePerchStore((state) => {
    if (!session?.cwd) return "";
    const workspacePath = session.workspaceId ? workspaceRecord(state, session.workspaceId)?.path : undefined;
    return workspacePath?.endsWith("/.perch/scratch") ? "Quickchat" : session.cwd.replace(/\/+$/, "").split("/").pop() || session.cwd;
  });
  const capabilities = usePerchStore((state) => (hostId === "local" ? state.serverInfo?.capabilities : state.workspaceCapabilitiesByHost[hostId]));
  const canLinkFiles = capabilities?.includes("fs.links") === true;
  const canChangeOptions = capabilities?.includes("agent.ui.options") === true;
  const { rows: family, refresh: refreshFamily } = useCrew(sessionId);
  const canActOnFamily = usePerchStore((state) => state.serverInfo?.capabilities?.includes("crew.actions.v1") === true);
  const { cards: suggestions } = useSuggestions(sessionId);
  const { state: inbound } = useInbound(sessionId);
  const fileLinks = useMemo(() => (canLinkFiles && workspaceId ? { workspaceId, hostId } : undefined), [canLinkFiles, workspaceId, hostId]);
  const [snapshot, setSnapshot] = useState<NativeUiSnapshot | null>(null);
  const [status, setStatus] = useState<AgentLifecycleStatus | null>(null);
  const [controlling, setControlling] = useState(false);
  const [pending, setPending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [changing, setChanging] = useState(false);
  const latest = useRef<NativeUiSnapshot | null>(null);
  latest.current = snapshot;
  const [viewError, setViewError] = useState<string | null>(null);
  // One error line: this view's own, else the chat's last failed send (which outlives the view that sent it).
  const error = viewError ?? composer.error;
  const setError = useCallback((next: string | null) => { setViewError(next); if (next === null) clearChatError(draftKey); }, [draftKey]);
  // A built-in slash command runs in the CLI's terminal: it has no transcript entry to wait for.
  const [ranCommand, setRanCommand] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [exited, setExited] = useState(false);
  const binding = useRef<ReturnType<typeof openAgentTerminal> | null>(null);
  const terminalId = useRef<string | null>(null);
  /** The lease this view holds on the CLI's input; undefined when it holds none. */
  const generation = () => (terminalId.current ? agentInputGeneration(terminalId.current) : undefined);

  useEffect(() => {
    if (!connected) { setControlling(false); return; }
    let disposed = false;
    let initiallyUnowned = false;
    setSnapshot(null); setError(null); setControlling(false); setPending(false); setStopping(false); setExited(false);
    const unsubscribe = subscribeNativeUi(sessionId, providerId, (next) => { if (!disposed) setSnapshot(next); });
    const opened = openAgentTerminal(sessionId, terminalProviderId, 80, 24,
      (id, next) => { terminalId.current = id; initiallyUnowned = !next.inputOwner; },
      () => {},
      (next, owned) => { if (!disposed) { setStatus(next); setControlling(owned); } },
    );
    binding.current = opened;
    const stopExit = socket.onMessage((message) => {
      if (message.type === "terminal.exit" && message.terminalId === terminalId.current && !disposed) {
        setExited(true); setControlling(false); setSnapshot(null);
        setError("The CLI exited. Switch to CLI view to restart it.");
      }
    });
    opened.ready.then(async () => {
      if (disposed) return;
      const history = requestNativeUi({ type: "agent.ui.get", requestId: newId(), sessionId, providerId });
      if (initiallyUnowned) await opened.takeControl().catch((reason: Error) => { if (!disposed) setError(reason.message); });
      await history;
    }).catch((reason: Error) => { if (!disposed) setError(reason.message); });
    return () => { disposed = true; unsubscribe(); stopExit(); opened.release(); binding.current = null; terminalId.current = null; };
  }, [connected, sessionId, providerId, terminalProviderId, retry, setError]);

  // The transcript is the proof of delivery: drop the pending copy once it shows the message (or, if it
  // never does, a while after the CLI confirmed it).
  useEffect(() => {
    if (outbox && outbox.phase !== "sending" && sentCount(snapshot, outbox.text) > outbox.baseline) clearOutbox(draftKey, outbox.operationId);
  }, [snapshot, outbox, draftKey]);
  useEffect(() => {
    if (outbox?.phase !== "delivered") return;
    const timer = setTimeout(() => clearOutbox(draftKey, outbox.operationId), 8000);
    return () => clearTimeout(timer);
  }, [outbox, draftKey]);

  // A new operation id on every edit: a draft that changed is a different message.
  const edit = useCallback((value: string, nextImages: ComposerImage[] = imagesRef.current) => {
    if (!editDraft(draftKey, value, nextImages)) return;
    textRef.current = value; imagesRef.current = nextImages;
  }, [draftKey]);

  // Once per chat opened, when the CLI is idle and ours to type into: a later read could catch a half-typed
  // line of this very composer's own send. Only a readable, one-line draft is picked up.
  const idle = controlling && !!snapshot && !snapshot.running && !snapshot.blocked;
  useEffect(() => {
    if (!idle || pickupChecked.current === draftKey) return;
    pickupChecked.current = draftKey;
    pickedUp.current = null;
    requestNativeUi({ type: "agent.ui.draft", requestId: newId(), sessionId, providerId }).then((reply) => {
      if (reply.type !== "agent.ui.drafted" || !reply.text) return;
      pickedUp.current = reply.text;
      const merged = withTerminalDraft(textRef.current, reply.text);
      if (merged !== textRef.current) edit(merged);
    }).catch(() => { /* nothing to pick up */ });
  }, [idle, draftKey, sessionId, providerId, edit]);

  const menu = useComposerMenu({ text, caret, sessionId, providerId, enabled: connected && controlling && !!snapshot });
  const settled = !!snapshot && !snapshot.running && snapshot.messages.length > 0;
  const lastTurn = useLastTurnChanges(workspaceId, sessionId, hostId, settled);
  const loadTurnDiff = useCallback((path: string) => new Promise<GitDiffFile[]>((resolve, reject) => {
    if (!lastTurn || !workspaceId) { reject(new Error("No turn to compare.")); return; }
    const requestId = newId();
    const stop = socket.onMessage((message) => {
      if (!("requestId" in message) || message.requestId !== requestId) return;
      stop();
      if (message.type === "git.diff.result") resolve(message.files); else reject(new Error("This change could not be loaded."));
    });
    socket.send(withHost({ type: "git.diff", requestId, workspaceId, target: { kind: "compare", base: lastTurn.beforeRef, ...(lastTurn.afterRef ? { head: lastTurn.afterRef } : {}) }, path }, hostId));
  }), [lastTurn, workspaceId, hostId]);
  const fallbackList = useRef<HTMLElement | null>(null);
  const older = useOlderHistory({ sessionId, providerId, available: !!snapshot?.canLoadOlder, list: listRef ?? fallbackList, revision: snapshot?.revision });
  const findHits = useFindHits(sessionId, providerId, find, snapshot?.revision, !!snapshot?.transcript);

  // Files are staged on this computer and their paths go out with the message. Another host's files
  // would need an explicit scp transfer, which stays a terminal action.
  async function attach(files: File[]) {
    if (!files.length) return;
    if (hostId !== "local") { setError("Attachments work for sessions on this computer only."); return; }
    setError(null); setUploading((count) => count + files.length);
    for (const file of files) {
      try {
        const staged = await uploadAttachment(sessionId, file);
        edit(textRef.current, [...imagesRef.current, { ...staged, file }]);
      } catch (reason) { setError((reason as Error).message); }
      finally { setUploading((count) => count - 1); }
    }
  }
  async function takeControl() {
    if (!binding.current || pending) return;
    setPending(true); setError(null);
    try { await binding.current.takeControl(); }
    catch (reason) { setError((reason as Error).message); }
    finally { setPending(false); }
  }
  // Alt/Option+Enter does the other of steer and queue while a turn runs.
  async function send(alt = false) {
    const lease = generation();
    if (lease === undefined || pending || outbox?.phase === "sending" || !connected || uploading || (!textRef.current.trim() && !imagesRef.current.length)) return;
    setError(null); setRanCommand(null);
    const outcome = await sendDraft(draftKey, {
      sessionId, providerId, generation: lease, baseline: (prompt) => sentCount(latest.current, prompt),
      ...(latest.current?.running ? { delivery: deliveryFor(whileWorking, alt) } : {}), ...(pickedUp.current ? { replaces: pickedUp.current } : {}),
    });
    if (outcome.kind === "sent" || outcome.kind === "command" || outcome.kind === "unconfirmed") pickedUp.current = null;
    if (outcome.kind === "command") setRanCommand(outcome.command);
  }
  // "Do it here": the task goes to this session as the person's own message, through the composer's path.
  async function sendHere(task: string): Promise<{ ok: boolean; reason?: string }> {
    const lease = generation();
    if (lease === undefined || !connected) return { ok: false, reason: "Take control of this chat first" };
    try {
      const reply = await requestNativeUi({ type: "agent.ui.prompt", requestId: newId(), sessionId, providerId, generation: lease, operationId: newId(), text: task });
      return reply.type === "agent.ui.result" && reply.accepted ? { ok: true } : { ok: false, reason: "The CLI did not accept the message" };
    } catch (reason) {
      return { ok: false, reason: (reason as Error).message };
    }
  }
  // One digit to the CLI, for exactly the prompt on screen. The card goes away when the CLI's next snapshot drops it.
  async function answer(key: string) {
    const request = latest.current?.request;
    const lease = generation();
    if (!request || lease === undefined || answering || !connected) return;
    setAnswering(true); setError(null);
    try {
      await accepted(requestNativeUi({ type: "agent.ui.answer", requestId: newId(), sessionId, providerId, generation: lease, promptId: request.id, key }), "The CLI did not accept this answer.");
      addReceipt(draftKey, { id: `${request.id}:${Date.now()}`, title: request.title, label: request.options.find((option) => option.key === key)?.label ?? key });
    } catch (reason) { setError((reason as Error).message); }
    finally { setAnswering(false); }
  }
  // The core types the CLI's own command (or steps its mode cycle) and answers with what the CLI then showed.
  async function changeOption(option: string, value: string) {
    const lease = generation();
    if (lease === undefined || changing || !connected) return;
    setChanging(true); setError(null);
    try {
      const reply = await requestNativeUi({ type: "agent.ui.option", requestId: newId(), sessionId, providerId, generation: lease, option, value });
      if (reply.type !== "agent.ui.option.result") throw new Error("The CLI did not answer.");
      if (reply.outcome === "unconfirmed") setError("Sent, but the CLI did not show the change. Check it in CLI view.");
    } catch (reason) { setError((reason as Error).message); }
    finally { setChanging(false); }
  }
  async function stop() {
    const lease = generation();
    if (lease === undefined || stopping || !connected) return;
    setStopping(true); setError(null);
    try { await accepted(requestNativeUi({ type: "agent.ui.cancel", requestId: newId(), sessionId, providerId, generation: lease }), "The CLI did not accept this action."); }
    catch (reason) { setError((reason as Error).message); }
    finally { setStopping(false); }
  }
  const refused = { outcome: "refused", reason: "Take control of this chat first" };

  return {
    connected, controlling, exited, snapshot, error, setError,
    inputElsewhere: !!status?.inputOwner && !controlling, canTakeControl: !!status && connected && !pending && !exited, takingControl: pending,
    reconnect: () => setRetry((value) => value + 1),
    hostId, workspaceId, folder: folderPath ? { path: folderPath, name: folderName } : null, fileLinks,
    whileWorking,
    draft: { text, images }, outbox, receipts: composer.receipts, uploading: uploading > 0,
    edit, send, attach,
    restoreUnconfirmed: () => { if (!restoreUnconfirmed(draftKey)) return false; setError(null); return true; },
    dismissOutbox: (operationId) => clearOutbox(draftKey, operationId),
    ranCommand, dismissRanCommand: () => setRanCommand(null),
    takeControl, answer, answering, stop, stopping,
    options: canChangeOptions ? { changing, change: changeOption } : undefined,
    menu: { ...menu, slashCommands: activeMenu("/", 1, providerId) !== null },
    family: {
      rows: family, refresh: refreshFamily,
      act: canActOnFamily ? (childSessionId, action, body, onProgress) => {
        // Under this chat's input lease, like typing in it; without it the core refuses and nothing is sent.
        const lease = generation();
        if (lease === undefined) return Promise.resolve(refused);
        return actOnChild({ sessionId, childSessionId, action, generation: lease, ...(body ? { text: body } : {}) }, onProgress);
      } : undefined,
    },
    suggestions: {
      cards: suggestions, sendHere,
      act: (cardId, click) => {
        const lease = generation();
        if (lease === undefined) return Promise.resolve(refused);
        return actOnSuggestion({ sessionId, cardId, generation: lease, ...click } as SuggestionAction);
      },
    },
    // Deliver and discard go under this chat's input lease, like typing in it; the mode needs none.
    inbound: { state: inbound, act: (click) => actOnInbound({ sessionId, ...click, generation: generation() } as InboundAction) },
    lastTurn, loadTurnDiff, older, findHits,
    openSession: (id) => usePerchStore.getState().switchSession(id),
  };
}

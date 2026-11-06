import { Fragment, memo, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { AgentLifecycleStatus, FsLink, NativeUiMessage, NativeUiSnapshot, NativeUiTurnDiff } from "@perch/shared";
import { usePerchStore } from "../store";
import { openAgentTerminal, agentInputGeneration } from "../agentTerminals";
import { NativeUiError, requestNativeUi, subscribeNativeUi } from "../nativeUi";
import { socket } from "../ws";
import { renderMarkdown } from "../markdown";
import { newId } from "../ids";
import { PlusIcon } from "../components/ui/icons";
import { loadDraftText, saveDraftText, sentPrompts, stepRecall, withTerminalDraft, type RecallPosition } from "./nativeChat/composerDraft";
import { CHAT_COLUMN, CHAT_INPUT, CHAT_LIST, CHAT_LIST_CONTAINER, MESSAGE_COPY_ASSISTANT, MESSAGE_COPY_USER, MESSAGE_ERROR, MESSAGE_FILE_LINK, MESSAGE_MARKDOWN, NATIVE_TEXTAREA, SCROLL_PILL, SEND_BUTTON_GO, SEND_BUTTON_STOP, messageClass } from "../components/ui/chat";
import { sendState } from "./nativeChat/sendState";
import { withAttachmentPaths } from "./nativeChat/menuTokens";
import { useComposerMenu } from "./nativeChat/useComposerMenu";
import { MenuList, menuOptionId } from "./nativeChat/MenuList";
import { Attachments, type ComposerImage } from "./nativeChat/Attachments";
import { ChangedFiles } from "./nativeChat/ChangedFiles";
import { useLastTurnChanges } from "./nativeChat/useLastTurnChanges";
import { FIND_MARK, RunRow, type FindMark } from "./nativeChat/RunRow";
import { FindBar, MessageRail } from "./nativeChat/FindBar";
import { CopyButton } from "./nativeChat/CopyButton";
import { DockedTasks } from "./nativeChat/DockedTasks";
import { TurnDiffRollup } from "./nativeChat/TurnDiffRollup";
import { OlderHistoryRow } from "./nativeChat/OlderHistoryRow";
import { useOlderHistory } from "./nativeChat/useOlderHistory";
import { couldBeFile, linkTargets, requestFileLinks } from "./nativeChat/fileLinks";
import { useFileTabs } from "../fileTabs";
import { ContextRing } from "./nativeChat/ContextRing";
import { blocksOf } from "./nativeChat/transcript";
import { useFindHits } from "./nativeChat/useFindHits";
import { Receipts, RequestCard, WaitingNotice, type Receipt } from "./nativeChat/RequestCard";
import { uploadAttachment } from "../attachments";
import { cn } from "../lib/cn";

const HINT = "text-[12px] text-subtext-0";

// Keep drafts and retry identities across UI/CLI switches, bounded like the
// transcript. A lost acknowledgement never turns Retry into a new operation.
type Draft = { text: string; operationId: string; images: ComposerImage[] };
const drafts = new Map<string, Draft>();

// A message this view sent that the transcript does not show yet. `unconfirmed` means delivery is unknown:
// it is never replayed as the same message, only restored to the composer as a new one.
// `text` is the whole prompt as sent (attachment paths included); `draft` is what returns to the composer.
type Outbox = { operationId: string; text: string; draft: Pick<Draft, "text" | "images">; phase: "sending" | "delivered" | "unconfirmed"; baseline: number };
// Answered prompts stay under the transcript as receipts, bounded like drafts.
const receiptsBySession = new Map<string, Receipt[]>();
const sentCount = (snapshot: NativeUiSnapshot | null, text: string) => snapshot?.messages.filter((message) => message.role === "user" && message.text.trim() === text.trim()).length ?? 0;
const NativeMessage = memo(function NativeMessage({ message, streaming, turn, find, fileLinkScope }: { message: NativeUiMessage; streaming: boolean; turn: string; find?: FindMark; fileLinkScope?: { workspaceId: string; hostId: string } }) {
  const html = useMemo(() => message.role === "assistant" ? renderMarkdown(message.text, streaming) : "", [message.role, message.text, streaming]);
  const body = useRef<HTMLDivElement>(null);
  const { workspaceId: linkWorkspaceId, hostId: linkHostId } = fileLinkScope ?? {};
  // Links that name a file in the workspace become pills that open it; the core decides which do.
  const [files, setFiles] = useState<ReadonlyMap<string, FsLink>>(new Map());
  useEffect(() => {
    if (!linkWorkspaceId || !linkHostId || streaming) return;
    const targets = linkTargets(html);
    if (!targets.length) return;
    let current = true;
    requestFileLinks(linkWorkspaceId, linkHostId, targets).then((links) => { if (current) setFiles(new Map(links.map((link) => [link.href, link]))); }, () => {});
    return () => { current = false; };
  }, [html, linkWorkspaceId, linkHostId, streaming]);
  useEffect(() => {
    for (const anchor of Array.from(body.current?.querySelectorAll("a[href]") ?? [])) {
      const link = files.get(anchor.getAttribute("href")!.trim());
      if (!link) continue;
      anchor.classList.add(...MESSAGE_FILE_LINK.split(" "));
      anchor.setAttribute("data-file-path", link.path);
      anchor.setAttribute("title", link.line ? `${link.path}:${link.line}` : link.path);
    }
  }, [html, files]);
  const openFileLink = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as Element).closest?.("a[href]");
    const href = anchor?.getAttribute("href")?.trim() ?? "";
    if (!linkWorkspaceId || !couldBeFile(href)) return;
    // A relative link must never navigate the app itself; a file that is not there does nothing.
    event.preventDefault();
    const link = files.get(href);
    if (link) useFileTabs.getState().open(linkWorkspaceId, link.path);
  };
  return <article className={messageClass(message.role === "user" ? "user" : "assistant", FIND_MARK[find ?? "none"])} data-native-role={message.role} data-native-turn={turn} data-block-id={message.id}>
    {message.role === "assistant" ? <div ref={body} onClick={openFileLink} className={cn("message__markdown", MESSAGE_MARKDOWN)} dangerouslySetInnerHTML={{ __html: html }} />
      : <div className="message__text">{message.text}</div>}
    {message.error && <div className={cn("message__error", MESSAGE_ERROR)} role="alert">{message.error}</div>}
    {message.text && !streaming && <CopyButton text={message.text} className={message.role === "user" ? MESSAGE_COPY_USER : MESSAGE_COPY_ASSISTANT} />}
  </article>;
}, (before, after) => before.streaming === after.streaming && before.turn === after.turn && before.find === after.find && before.fileLinkScope?.workspaceId === after.fileLinkScope?.workspaceId && before.fileLinkScope?.hostId === after.fileLinkScope?.hostId && JSON.stringify(before.message) === JSON.stringify(after.message));

/** `providerId` is the agent being shown; `terminalProviderId` is what owns the PTY and leases when
 * that differs: an agent typed into a Terminal tab runs under the tab's own `terminal` runtime. */
export function NativeCliChat({ sessionId, providerId, terminalProviderId = providerId }: { sessionId: string; providerId: string; terminalProviderId?: string }) {
  const connected = usePerchStore((state) => state.connected);
  const draftKey = JSON.stringify([sessionId, providerId]);
  const [text, setText] = useState(() => drafts.get(draftKey)?.text ?? loadDraftText(draftKey));
  const [images, setImages] = useState<ComposerImage[]>(() => drafts.get(draftKey)?.images ?? []);
  const [uploading, setUploading] = useState(0);
  const [caret, setCaret] = useState(0);
  const textRef = useRef(text);
  textRef.current = text;
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const nextCaret = useRef<number | null>(null);
  const recall = useRef<RecallPosition | null>(null);
  // What was typed on the CLI's own line when this chat was opened: the next send replaces it (the core clears it first).
  const pickedUp = useRef<string | null>(null);
  const pickupChecked = useRef<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const hostId = usePerchStore((state) => state.sessions.find((entry) => entry.id === sessionId)?.hostId ?? state.activeHostId);
  const workspaceId = usePerchStore((state) => state.sessions.find((entry) => entry.id === sessionId)?.workspaceId);
  const canLinkFiles = usePerchStore((state) => (hostId === "local" ? state.serverInfo?.capabilities : state.workspaceCapabilitiesByHost[hostId])?.includes("fs.links") === true);
  const fileLinkScope = useMemo(() => canLinkFiles && workspaceId ? { workspaceId, hostId } : undefined, [canLinkFiles, workspaceId, hostId]);
  const [snapshot, setSnapshot] = useState<NativeUiSnapshot | null>(null);
  const [status, setStatus] = useState<AgentLifecycleStatus | null>(null);
  const [controlling, setControlling] = useState(false);
  const [pending, setPending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [outbox, setOutbox] = useState<Outbox | null>(null);
  const [answering, setAnswering] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>(() => receiptsBySession.get(draftKey) ?? []);
  const latest = useRef<NativeUiSnapshot | null>(null);
  latest.current = snapshot;
  const field = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);
  // A built-in slash command runs in the CLI's terminal: it has no transcript entry to wait for.
  const [ranCommand, setRanCommand] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [exited, setExited] = useState(false);
  const binding = useRef<ReturnType<typeof openAgentTerminal> | null>(null);
  const terminalId = useRef<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [showBottom, setShowBottom] = useState(false);
  const [find, setFind] = useState<string | null>(null);
  const [findIndex, setFindIndex] = useState(0);
  useEffect(() => {
    if (!connected) { setControlling(false); return; }
    let disposed = false;
    let initiallyUnowned = false;
    setSnapshot(null); setError(null); setControlling(false); setPending(false); setStopping(false); setExited(false);
    const unsubscribe = subscribeNativeUi(sessionId, providerId, (next) => { if (!disposed) { setSnapshot(next); } });
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
  }, [connected, sessionId, providerId, terminalProviderId, retry]);
  useEffect(() => { if (atBottom.current && list.current) list.current.scrollTop = list.current.scrollHeight; }, [snapshot, outbox]);
  // The transcript is the proof of delivery: drop the pending copy once it shows the message (or, if it
  // never does, a while after the CLI confirmed it).
  useEffect(() => {
    if (outbox && outbox.phase !== "sending" && sentCount(snapshot, outbox.text) > outbox.baseline) setOutbox(null);
  }, [snapshot, outbox]);
  useEffect(() => {
    if (outbox?.phase !== "delivered") return;
    const timer = setTimeout(() => setOutbox(null), 8000);
    return () => clearTimeout(timer);
  }, [outbox]);
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    if (nextCaret.current !== null) { el.setSelectionRange(nextCaret.current, nextCaret.current); nextCaret.current = null; }
  }, [text]);
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
      if (merged !== textRef.current) updateDraft(merged);
    }).catch(() => { /* nothing to pick up */ });
  }, [idle, draftKey, sessionId, providerId]);
  // A new operation id on every edit: a draft that changed is a different message.
  function updateDraft(value: string, nextImages = imagesRef.current) {
    if (new TextEncoder().encode(value).length > 64 * 1024) return;
    setText(value); setImages(nextImages);
    drafts.set(draftKey, { text: value, operationId: newId(), images: nextImages });
    saveDraftText(draftKey, value);
    if (drafts.size > 128) drafts.delete(drafts.keys().next().value!);
  }
  const menu = useComposerMenu({ text, caret, sessionId, providerId, enabled: connected && controlling && !!snapshot });
  function pickMenu(index: number) {
    const picked = menu.pick(index);
    if (!picked) return;
    nextCaret.current = picked.caret;
    updateDraft(picked.text);
    setCaret(picked.caret);
  }
  // Files are staged on this computer and their paths go out with the message. Another host's files
  // would need an explicit scp transfer, which stays a terminal action.
  async function attach(files: File[]) {
    if (!files.length) return;
    if (hostId !== "local") { setError("Attachments work for sessions on this computer only."); return; }
    setError(null); setUploading((count) => count + files.length);
    for (const file of files) {
      try {
        const staged = await uploadAttachment(sessionId, file);
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
        updateDraft(textRef.current, [...imagesRef.current, { ...staged, ...(previewUrl ? { previewUrl } : {}) }]);
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
  async function send() {
    const generation = terminalId.current ? agentInputGeneration(terminalId.current) : undefined;
    if (generation === undefined || pending || outbox?.phase === "sending" || !connected || uploading || (!text.trim() && !images.length)) return;
    const draft: Draft = drafts.get(draftKey) ?? { text, operationId: newId(), images };
    drafts.set(draftKey, draft);
    setError(null); setRanCommand(null);
    const prompt = withAttachmentPaths(draft.text, draft.images.map((image) => image.path));
    const sent: Outbox = { operationId: draft.operationId, text: prompt, draft: { text: draft.text, images: draft.images }, phase: "sending", baseline: sentCount(latest.current, prompt) };
    setOutbox(sent);
    const settled = () => { if (drafts.get(draftKey)?.operationId === draft.operationId) { drafts.delete(draftKey); saveDraftText(draftKey, ""); setText(""); setImages([]); } };
    try {
      const reply = await requestNativeUi({ type: "agent.ui.prompt", requestId: newId(), sessionId, providerId, generation, operationId: draft.operationId, text: prompt, ...(pickedUp.current ? { replaces: pickedUp.current } : {}) });
      if (reply.type !== "agent.ui.result" || !reply.accepted) throw new Error("The CLI did not accept this action.");
      settled(); pickedUp.current = null;
      if (reply.command) { setOutbox(null); setRanCommand(draft.text.trim()); }
      else setOutbox({ ...sent, phase: "delivered" });
    } catch (reason) {
      if (reason instanceof NativeUiError && reason.uncertain) { settled(); pickedUp.current = null; setOutbox({ ...sent, phase: "unconfirmed" }); }
      else { setOutbox(null); }
      setError((reason as Error).message);
    }
  }
  // One digit to the CLI, for exactly the prompt on screen. The card goes away when the CLI's next snapshot drops it.
  async function answer(key: string) {
    const request = latest.current?.request;
    const generation = terminalId.current ? agentInputGeneration(terminalId.current) : undefined;
    if (!request || generation === undefined || answering || !connected) return;
    setAnswering(true); setError(null);
    try {
      const reply = await requestNativeUi({ type: "agent.ui.answer", requestId: newId(), sessionId, providerId, generation, promptId: request.id, key });
      if (reply.type !== "agent.ui.result" || !reply.accepted) throw new Error("The CLI did not accept this answer.");
      const next = [...(receiptsBySession.get(draftKey) ?? []), { id: `${request.id}:${Date.now()}`, title: request.title, label: request.options.find((option) => option.key === key)?.label ?? key }].slice(-20);
      receiptsBySession.set(draftKey, next); setReceipts(next);
    } catch (reason) { setError((reason as Error).message); }
    finally { setAnswering(false); }
  }
  async function stop() {
    const generation = terminalId.current ? agentInputGeneration(terminalId.current) : undefined;
    if (generation === undefined || stopping || !connected) return;
    setStopping(true); setError(null);
    try {
      const reply = await requestNativeUi({ type: "agent.ui.cancel", requestId: newId(), sessionId, providerId, generation });
      if (reply.type !== "agent.ui.result" || !reply.accepted) throw new Error("The CLI did not accept this action.");
    } catch (reason) { setError((reason as Error).message); }
    finally { setStopping(false); }
  }
  // Delivery was unknown, so the text comes back as a new message for the user to judge against the transcript.
  function restoreUnconfirmed() {
    if (!outbox) return;
    // Thumbnails were released with their chips; the staged files are still there.
    updateDraft(outbox.draft.text, outbox.draft.images.map(({ previewUrl: _gone, ...image }) => image));
    setOutbox(null); setError(null);
    field.current?.focus();
  }
  const sendable = sendState({ draft: text, attachments: images.length, uploading: uploading > 0, connected, ready: !!snapshot, controlling, exited, working: !!snapshot?.running, sending: outbox?.phase === "sending", stopping });
  // The snapshot is what this view renders; the lifecycle's blocked state (from title evidence) can lag it.
  const waiting = snapshot?.blocked === true;
  const lastTurn = useLastTurnChanges(workspaceId, sessionId, hostId, !!snapshot && !snapshot.running && snapshot.messages.length > 0);
  const blocks = useMemo(() => blocksOf(snapshot), [snapshot]);
  const older = useOlderHistory({ sessionId, providerId, available: !!snapshot?.canLoadOlder, list, revision: snapshot?.revision });
  const messages = useMemo(() => new Map((snapshot?.messages ?? []).map((message) => [message.id, message])), [snapshot?.messages]);
  // Each rollup is drawn after its turn's last block; a turn's cards are the run steps' own.
  const rollups = useMemo(() => {
    const steps = new Map(blocks.flatMap((block) => block.kind === "run" ? block.steps.map((step) => [step.id, step] as const) : []));
    const after = new Map<string, NativeUiTurnDiff[]>();
    for (const diff of snapshot?.transcript?.turnDiffs ?? []) after.set(diff.after, [...(after.get(diff.after) ?? []), diff]);
    return { after, card: (step: string, fileIndex: number) => steps.get(step)?.tool?.edit?.[fileIndex] };
  }, [blocks, snapshot]);
  const hits = useFindHits(sessionId, providerId, find, snapshot?.revision, !!snapshot?.transcript);
  const current = hits.length ? hits[((findIndex % hits.length) + hits.length) % hits.length] : undefined;
  const mark = (id: string): FindMark | undefined => (id === current ? "current" : hits.includes(id) ? "hit" : undefined);
  const prompts = useMemo(() => blocks.flatMap((block) => {
    const message = block.kind === "message" ? messages.get(block.id) : undefined;
    return message?.role === "user" ? [{ id: message.id, text: message.text }] : [];
  }), [blocks, messages]);
  const jump = (id: string) => {
    atBottom.current = false;
    list.current?.querySelector(`[data-block-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center" });
  };
  useEffect(() => { if (current) jump(current); }, [current, findIndex]);
  const label = !connected ? "Reconnecting…" : exited ? "CLI exited" : !snapshot ? "Connecting to CLI…" : waiting ? "Waiting for you" : snapshot.running ? "Working" : "Ready";
  return <div className="native-cli-chat outline-none flex min-h-0 min-w-0 flex-1 flex-col [&_pre]:whitespace-pre-wrap [&_pre]:[overflow-wrap:anywhere]" data-testid="native-cli-chat" data-provider={providerId} data-native-pid={snapshot?.pid} data-native-session={snapshot?.providerSessionId} tabIndex={-1}
    onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "f") { event.preventDefault(); setFind((value) => value ?? ""); } }}>
    <div className="terminal__toolbar flex-wrap">
      <span role="status">{label}</span>
      {snapshot?.model && <span className="native-cli-chat__model ml-auto max-w-[45%] overflow-hidden text-ellipsis" title={snapshot.model}>{snapshot.model}</span>}
      {snapshot?.context && <span className={snapshot.model ? undefined : "ml-auto"}><ContextRing context={snapshot.context} /></span>}
      {!controlling && <button type="button" disabled={!status || !connected || pending || exited} onClick={() => void takeControl()}>Take control</button>}
    </div>
    {find !== null && <FindBar query={find} onQuery={(value) => { setFind(value); setFindIndex(0); }} count={hits.length} index={hits.length ? ((findIndex % hits.length) + hits.length) % hits.length : 0}
      onStep={(delta) => setFindIndex((value) => value + delta)} onClose={() => { setFind(null); field.current?.focus(); }} />}
    <div className={cn("chat__list-container", CHAT_LIST_CONTAINER)}>
      <MessageRail prompts={prompts} onJump={jump} />
      <div className={cn("chat__list", CHAT_LIST)} ref={list} onScroll={() => { if (list.current) { atBottom.current = list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight < 64; setShowBottom(!atBottom.current); } }}>
        <div className={cn(CHAT_COLUMN, "gap-3")}>
        {snapshot?.canLoadOlder ? <OlderHistoryRow older={older} />
          : snapshot?.truncated && <p className={HINT}>Showing recent messages. The complete conversation remains in the CLI.</p>}
        {snapshot && !snapshot.messages.length && <p className={HINT}>Start a conversation with {providerId === "omp" ? "OMP" : providerId === "claude" ? "Claude Code" : providerId === "codex" ? "Codex" : providerId === "opencode" ? "OpenCode" : "Pi"}. You can switch to CLI at any time.</p>}
        {blocks.map((block) => {
          const row = block.kind === "run" ? <RunRow key={block.id} run={block} find={mark(block.id)} />
            : messages.get(block.id) && <NativeMessage key={block.id} message={messages.get(block.id)!} streaming={!!block.live} turn={block.turn} find={mark(block.id)} fileLinkScope={fileLinkScope} />;
          // Git's changed-files card speaks for the newest turn once it has settled; the rollup is for the others and for no Git.
          const diffs = rollups.after.get(block.id)?.filter((diff) => !(lastTurn && diff.turn === blocks[blocks.length - 1]?.turn));
          return diffs?.length ? <Fragment key={block.id}>{row}{diffs.map((diff) => <TurnDiffRollup key={`${diff.turn}:rollup`} diff={diff} cards={rollups.card} />)}</Fragment> : row;
        })}
        {snapshot?.transcript?.working && <div className={cn(HINT, "px-1")} aria-live="polite" data-testid="native-cli-working">{snapshot.transcript.working}</div>}
        {lastTurn && workspaceId && <ChangedFiles turn={lastTurn} workspaceId={workspaceId} hostId={hostId} />}
        <Receipts items={receipts} />
        {snapshot?.request ? <RequestCard request={snapshot.request} canAnswer={controlling && connected} answering={answering} onAnswer={(key) => void answer(key)} keepFocus={text.length > 0} />
          : waiting && <WaitingNotice />}
        {/* A slash draft may be a terminal command rather than a message: show it only once the reply says it was a message (Orca suppresses these bubbles too). */}
        {outbox && !(outbox.phase === "sending" && outbox.text.trimStart().startsWith("/")) && <article className={messageClass("user", outbox.phase === "unconfirmed" ? "opacity-70" : undefined)} data-native-outbox={outbox.phase}>
          <div className="message__text">{outbox.text}</div>
          {outbox.phase === "sending" && <div className={HINT} role="status">Sending…</div>}
          {outbox.phase === "unconfirmed" && <div className={cn(HINT, "mt-1 flex flex-wrap items-center gap-2")} role="alert">Not confirmed — check the transcript before sending again.
            <button type="button" onClick={restoreUnconfirmed}>Edit and resend</button>
            <button type="button" onClick={() => setOutbox(null)}>Dismiss</button></div>}
        </article>}
        </div>
      </div>
      {showBottom && <button className={cn("scroll-bottom-pill", SCROLL_PILL)} type="button" onClick={() => { atBottom.current = true; setShowBottom(false); if (list.current) list.current.scrollTop = list.current.scrollHeight; }}>↓ Bottom</button>}
    </div>
    {ranCommand && !error && <div className={cn(HINT, "flex flex-wrap items-center gap-2 px-3 py-1")} role="status" data-testid="native-cli-command-ran">Ran <code>{ranCommand}</code> in the CLI. Its output is in CLI view.
      <button type="button" onClick={() => setRanCommand(null)}>Dismiss</button></div>}
    {error && <div className="terminal__cli-error" role="alert">{error} {!snapshot && !exited && <button type="button" onClick={() => setRetry((value) => value + 1)}>Reconnect UI</button>}</div>}
    {snapshot?.transcript?.tasks && <DockedTasks list={snapshot.transcript.tasks} />}
    <div className="shrink-0 px-4 pt-1 pb-3">
    <form className={cn("chat__input relative", CHAT_COLUMN, CHAT_INPUT)} onSubmit={(event) => { event.preventDefault(); if (sendable.action === "stop") void stop(); else void send(); }}
      onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
      onDrop={(event) => { if (event.dataTransfer.files.length) { event.preventDefault(); void attach(Array.from(event.dataTransfer.files)); } }}>
      {menu.open && <MenuList items={menu.items} active={menu.active} label={menu.label} onPick={pickMenu} onHover={menu.setActive} />}
      <Attachments items={images} onRemove={(id) => updateDraft(text, images.filter((image) => image.id !== id))} />
      <textarea ref={field} className={NATIVE_TEXTAREA} aria-label="Message CLI" data-testid="native-cli-composer" value={text} disabled={!connected || !controlling || !snapshot} placeholder={controlling ? "Message this CLI…" : "Take control to send a message"} rows={1}
        role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={menu.open} aria-activedescendant={menu.open ? menuOptionId(menu.active) : undefined}
        onChange={(event) => { updateDraft(event.target.value); setCaret(event.target.selectionStart); }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
        onPaste={(event) => { if (event.clipboardData.files.length) { event.preventDefault(); void attach(Array.from(event.clipboardData.files)); } }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (menu.open) {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); menu.move(event.key === "ArrowDown" ? 1 : -1); return; }
            if (event.key === "Enter" || event.key === "Tab") { event.preventDefault(); pickMenu(menu.active); return; }
            if (event.key === "Escape") { event.preventDefault(); menu.dismiss(); return; }
          }
          if ((event.key === "ArrowUp" || event.key === "ArrowDown") && !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey) {
            const back = event.key === "ArrowUp";
            const { selectionStart, selectionEnd } = event.currentTarget;
            // A recalled multi-line prompt keeps its arrows for the caret until the caret is on the edge.
            const onEdge = selectionStart === selectionEnd && (back ? selectionStart === 0 : selectionStart === text.length);
            const step = (!text || onEdge) && stepRecall({ direction: back ? "back" : "forward", prompts: sentPrompts(snapshot?.messages ?? []), position: recall.current, draft: text });
            if (step) { event.preventDefault(); recall.current = step.position; nextCaret.current = step.draft.length; updateDraft(step.draft); setCaret(step.draft.length); return; }
          }
          if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (!sendable.disabled && sendable.action !== "stop") void send(); }
          else if (event.key === "Escape" && snapshot?.running && controlling) { event.preventDefault(); void stop(); }
        }} />
      <div className="flex items-center gap-2 px-2 pt-1 pb-2">
        <input ref={picker} type="file" multiple hidden data-testid="native-cli-file-input" onChange={(event) => { void attach(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
        <button type="button" className="size-7 shrink-0 cursor-pointer rounded-full bg-transparent flex items-center justify-center text-subtext-0 [border:0] hover:bg-surface-1 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40" aria-label="Attach file" title="Attach file" disabled={!connected || !controlling || !snapshot}
          onMouseDown={(event) => event.preventDefault()} onClick={() => picker.current?.click()}><PlusIcon size={16} /></button>
        <span className={cn(HINT, "flex-1")}>{controlling ? (uploading ? "Uploading…" : snapshot?.running ? "Esc stops the turn" : "") : status?.inputOwner ? "Another view is typing in this agent" : "Viewing agent"}</span>
        <button type="submit" className={sendable.action === "stop" || sendable.action === "stopping" ? SEND_BUTTON_STOP : SEND_BUTTON_GO} aria-label={sendable.label} title={sendable.reason ?? sendable.label} disabled={sendable.disabled}
          onMouseDown={(event) => event.preventDefault()}>
          {sendable.action === "stop" || sendable.action === "stopping"
            ? <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="2" y="2" width="8" height="8" rx="1.5" /></svg>
            : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" /></svg>}
        </button>
      </div>
    </form>
    </div>
  </div>;
}

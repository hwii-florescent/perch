//! The native chat's presentation (`stock:chat`): the toolbar, find, the message list (messages, run rows, sender
//! cards, subagent rosters, turn diffs, the changed files, receipts, request cards, the pending send), the docked
//! tasks, held messages, suggestion cards, the family strip and the composer (autocomplete, attachments, recall,
//! the add menu, folder, mode/model/effort pickers, context ring, send/stop). The chat itself is Perch's
//! (`useNativeChat`): the transcript, the CLI's input lease, the draft and its operation id, the send in flight,
//! answers, option changes and stop all have one owner there, so a reload or a clone of this screen never drops a
//! draft, sends twice or loses an approval. Agent text is drawn only through `Markdown` (Perch's fixed sanitizer).
//! What is this view's own (the caret, recall, find, the scroll position, the full-access confirmation) starts
//! over when it is remounted.
import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";
import { cn, ConfirmDialog, CopyButton, Markdown, SlashPopover, useNativeChat, type NativeUiMessage, type NativeUiSubagentGroup, type NativeUiTurnDiff } from "@perch/sdk";
import { CHAT_COLUMN, CHAT_INPUT, CHAT_LIST, CHAT_LIST_CONTAINER, MESSAGE_COPY_ASSISTANT, MESSAGE_COPY_USER, MESSAGE_ERROR, NATIVE_TEXTAREA, SCROLL_PILL, SEND_BUTTON_GO, SEND_BUTTON_STOP, messageClass } from "./look";
import { sentPrompts, stepRecall, type RecallPosition } from "./recall";
import { sendState } from "./sendState";
import { AddMenu, type AddMenuEntry } from "./AddMenu";
import { Attachments } from "./Attachments";
import { ChangedFiles } from "./ChangedFiles";
import { FIND_MARK, RunRow, type FindMark } from "./RunRow";
import { FindBar, MessageRail } from "./FindBar";
import { DockedTasks } from "./DockedTasks";
import { FamilyStrip } from "./FamilyStrip";
import { SenderCard, senderTitle } from "./SenderCard";
import { HeldMessages } from "./HeldMessages";
import { SuggestionCards } from "./SuggestionCards";
import { TurnDiffRollup } from "./TurnDiffRollup";
import { OlderHistoryRow } from "./OlderHistoryRow";
import { ModelPicker, OptionLabels, type OptionChange } from "./OptionLabels";
import { SubagentRoster } from "./SubagentRoster";
import { blocksOf } from "./transcript";
import { Receipts, RequestCard, WaitingNotice } from "./RequestCard";
import { ContextRing } from "./ContextRing";
import { FolderIcon } from "./icons";

const HINT = "text-[12px] text-subtext-0";
/** The autocomplete row the composer names as its active descendant (`SlashPopover` gives each row this id). */
const menuOptionId = (index: number) => `native-menu-option-${index}`;

/** One message: the person's text as text, an agent's through Perch's `Markdown` (sanitized; links never navigate
 * the app; file links open the file). */
export const NativeMessage = memo(function NativeMessage({ message, streaming, turn, find, fileLinkScope }: { message: NativeUiMessage; streaming: boolean; turn: string; find?: FindMark; fileLinkScope?: { workspaceId: string; hostId: string } }) {
  // A stopped turn: a quiet line between the turns, not a bubble (the core words it; `system` rows carry no prompt or answer).
  if (message.role === "system") return <div className={cn(HINT, "text-center py-1")} data-native-role="system" data-testid="native-cli-status-row" data-native-turn={turn} data-block-id={message.id}>{message.text}</div>;
  return <article className={messageClass(message.role === "user" ? "user" : "assistant", FIND_MARK[find ?? "none"])} data-native-role={message.role} data-native-turn={turn} data-block-id={message.id}>
    {message.role === "assistant" ? <Markdown text={message.text} streaming={streaming} fileLinks={fileLinkScope} />
      : <div className="message__text">{message.text}</div>}
    {message.error && <div className={cn("message__error", MESSAGE_ERROR)} role="alert">{message.error}</div>}
    {message.text && !streaming && <CopyButton text={message.text} className={message.role === "user" ? MESSAGE_COPY_USER : MESSAGE_COPY_ASSISTANT} />}
  </article>;
}, (before, after) => before.streaming === after.streaming && before.turn === after.turn && before.find === after.find && before.fileLinkScope?.workspaceId === after.fileLinkScope?.workspaceId && before.fileLinkScope?.hostId === after.fileLinkScope?.hostId && JSON.stringify(before.message) === JSON.stringify(after.message));

const PROVIDER_NAME: Record<string, string> = { omp: "OMP", claude: "Claude Code", codex: "Codex", opencode: "OpenCode" };

/** `providerId` is the agent being shown; `terminalProviderId` is what owns the PTY and leases when
 * that differs: an agent typed into a Terminal tab runs under the tab's own `terminal` runtime. */
export function NativeCliChat({ sessionId, providerId, terminalProviderId = providerId }: { sessionId: string; providerId: string; terminalProviderId?: string }) {
  const [caret, setCaret] = useState(0);
  const [find, setFind] = useState<string | null>(null);
  const [findIndex, setFindIndex] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const chat = useNativeChat({ sessionId, providerId, terminalProviderId, caret, listRef: list, find });
  const { connected, controlling, exited, snapshot, error, outbox, receipts, menu } = chat;
  const { text, images } = chat.draft;
  const nextCaret = useRef<number | null>(null);
  const recall = useRef<RecallPosition | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const atBottom = useRef(true);
  const [showBottom, setShowBottom] = useState(false);
  const [confirmFull, setConfirmFull] = useState(false);
  useEffect(() => { if (atBottom.current && list.current) list.current.scrollTop = list.current.scrollHeight; }, [snapshot, outbox]);
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    if (nextCaret.current !== null) { el.setSelectionRange(nextCaret.current, nextCaret.current); nextCaret.current = null; }
  }, [text]);
  function pickMenu(index: number) {
    const picked = menu.pick(index);
    if (!picked) return;
    nextCaret.current = picked.caret;
    chat.edit(picked.text);
    setCaret(picked.caret);
  }
  // Delivery was unknown, so the text comes back as a new message for the person to judge against the transcript.
  function restoreUnconfirmed() {
    if (chat.restoreUnconfirmed()) field.current?.focus();
  }
  const sendable = sendState({ draft: text, attachments: images.length, uploading: chat.uploading, connected, ready: !!snapshot, controlling, exited, working: !!snapshot?.running, sending: outbox?.phase === "sending", stopping: chat.stopping, whileWorking: chat.whileWorking });
  // The snapshot is what this view renders; the lifecycle's blocked state (from title evidence) can lag it.
  const waiting = snapshot?.blocked === true;
  const lastTurn = chat.lastTurn;
  const blocks = useMemo(() => blocksOf(snapshot), [snapshot]);
  const messages = useMemo(() => new Map((snapshot?.messages ?? []).map((message) => [message.id, message])), [snapshot?.messages]);
  // Each rollup is drawn after its turn's last block; a turn's cards are the run steps' own.
  const rollups = useMemo(() => {
    const steps = new Map(blocks.flatMap((block) => block.kind === "run" ? block.steps.map((step) => [step.id, step] as const) : []));
    const after = new Map<string, NativeUiTurnDiff[]>();
    for (const diff of snapshot?.transcript?.turnDiffs ?? []) after.set(diff.after, [...(after.get(diff.after) ?? []), diff]);
    return { after, card: (step: string, fileIndex: number) => steps.get(step)?.tool?.edit?.[fileIndex] };
  }, [blocks, snapshot]);
  // A roster of subagents is drawn after the block holding its spawn call.
  const rosters = useMemo(() => {
    const after = new Map<string, NativeUiSubagentGroup[]>();
    for (const group of snapshot?.transcript?.subagents ?? []) after.set(group.after, [...(after.get(group.after) ?? []), group]);
    return after;
  }, [snapshot]);
  const hits = chat.findHits;
  const current = hits.length ? hits[((findIndex % hits.length) + hits.length) % hits.length] : undefined;
  const mark = (id: string): FindMark | undefined => (id === current ? "current" : hits.includes(id) ? "hit" : undefined);
  const prompts = useMemo(() => blocks.flatMap((block) => {
    const message = block.kind === "message" ? messages.get(block.id) : undefined;
    return message?.role === "user" ? [{ id: message.id, text: block.kind === "message" && block.sender ? senderTitle(block.sender) : message.text }] : [];
  }), [blocks, messages]);
  const jump = (id: string) => {
    atBottom.current = false;
    list.current?.querySelector(`[data-block-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center" });
  };
  useEffect(() => { if (current) jump(current); }, [current, findIndex]);
  const optionChange: OptionChange | undefined = chat.options ? { enabled: controlling && connected && !exited, busy: chat.options.changing, apply: (option, value) => { if (option === "mode" && value === "full-access") setConfirmFull(true); else void chat.options?.change(option, value); } } : undefined;
  const canCompose = connected && controlling && snapshot !== null;
  const addEntries: AddMenuEntry[] = [
    { id: "attach", label: "Add files or photos", run: () => picker.current?.click() },
    // `/name` only means a command at the start of a message, so the shortcut needs an empty draft.
    ...(menu.slashCommands ? [{ id: "slash", label: "Slash commands", detail: text ? "Clear the message to start with /" : "Commands and skills", disabled: text !== "", run: () => { nextCaret.current = 1; chat.edit("/"); setCaret(1); field.current?.focus(); } }] : []),
  ];
  const label = !connected ? "Reconnecting…" : exited ? "CLI exited" : !snapshot ? "Connecting to CLI…" : waiting ? "Waiting for you" : snapshot.running ? "Working" : "Ready";
  return <div className="native-cli-chat outline-none flex min-h-0 min-w-0 flex-1 flex-col [&_pre]:whitespace-pre-wrap [&_pre]:[overflow-wrap:anywhere]" data-testid="native-cli-chat" data-provider={providerId} data-native-pid={snapshot?.pid} data-native-session={snapshot?.providerSessionId} tabIndex={-1}
    onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "f") { event.preventDefault(); setFind((value) => value ?? ""); } }}>
    <div className="terminal__toolbar flex-wrap">
      <span role="status">{label}</span>
      {!controlling && <button type="button" className="ml-auto" disabled={!chat.canTakeControl} onClick={() => void chat.takeControl()}>Take control</button>}
    </div>
    {find !== null && <FindBar query={find} onQuery={(value) => { setFind(value); setFindIndex(0); }} count={hits.length} index={hits.length ? ((findIndex % hits.length) + hits.length) % hits.length : 0}
      onStep={(delta) => setFindIndex((value) => value + delta)} onClose={() => { setFind(null); field.current?.focus(); }} />}
    <div className={cn("chat__list-container", CHAT_LIST_CONTAINER)}>
      <MessageRail prompts={prompts} onJump={jump} />
      <div className={cn("chat__list", CHAT_LIST)} ref={list} onScroll={() => { if (list.current) { atBottom.current = list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight < 64; setShowBottom(!atBottom.current); } }}>
        <div className={cn(CHAT_COLUMN, "gap-3")}>
        {snapshot?.canLoadOlder ? <OlderHistoryRow older={chat.older} />
          : snapshot?.truncated && <p className={HINT}>Showing recent messages. The complete conversation remains in the CLI.</p>}
        {snapshot && !snapshot.messages.length && <p className={HINT}>Start a conversation with {PROVIDER_NAME[providerId] ?? "Pi"}. You can switch to CLI at any time.</p>}
        {blocks.map((block) => {
          const row = block.kind === "run" ? <RunRow key={block.id} run={block} find={mark(block.id)} />
            : block.sender && messages.get(block.id) ? <SenderCard key={block.id} envelope={block.sender} blockId={block.id} turn={block.turn} onOpen={chat.openSession} />
            : messages.get(block.id) && <NativeMessage key={block.id} message={messages.get(block.id)!} streaming={!!block.live} turn={block.turn} find={mark(block.id)} fileLinkScope={chat.fileLinks} />;
          // Git's changed-files card speaks for the newest turn once it has settled; the rollup is for the others and for no Git.
          const diffs = rollups.after.get(block.id)?.filter((diff) => !(lastTurn && diff.turn === blocks[blocks.length - 1]?.turn));
          const groups = rosters.get(block.id);
          return diffs?.length || groups?.length ? <Fragment key={block.id}>{row}{groups?.map((group) => <SubagentRoster key={`${group.turn}:subagents`} group={group} />)}{diffs?.map((diff) => <TurnDiffRollup key={`${diff.turn}:rollup`} diff={diff} cards={rollups.card} />)}</Fragment> : row;
        })}
        {snapshot?.transcript?.working && <div className={cn(HINT, "px-1")} aria-live="polite" data-testid="native-cli-working">{snapshot.transcript.working}</div>}
        {lastTurn && chat.workspaceId && <ChangedFiles turn={lastTurn} load={chat.loadTurnDiff} />}
        <Receipts items={receipts} />
        {snapshot?.request ? <RequestCard request={snapshot.request} canAnswer={controlling && connected} answering={chat.answering} onAnswer={(key) => void chat.answer(key)} keepFocus={text.length > 0} />
          : waiting && <WaitingNotice />}
        {/* A slash draft may be a terminal command rather than a message: show it only once the reply says it was a message (Orca suppresses these bubbles too). */}
        {outbox && !(outbox.phase === "sending" && outbox.text.trimStart().startsWith("/")) && <article className={messageClass("user", outbox.phase === "unconfirmed" ? "opacity-70" : undefined)} data-native-outbox={outbox.phase}>
          <div className="message__text">{outbox.text}</div>
          {outbox.phase === "sending" && <div className={HINT} role="status">Sending…</div>}
          {outbox.phase === "unconfirmed" && <div className={cn(HINT, "mt-1 flex flex-wrap items-center gap-2")} role="alert">Not confirmed — check the transcript before sending again.
            <button type="button" onClick={restoreUnconfirmed}>Edit and resend</button>
            <button type="button" onClick={() => chat.dismissOutbox(outbox.operationId)}>Dismiss</button></div>}
        </article>}
        </div>
      </div>
      {showBottom && <button className={cn("scroll-bottom-pill", SCROLL_PILL)} type="button" onClick={() => { atBottom.current = true; setShowBottom(false); if (list.current) list.current.scrollTop = list.current.scrollHeight; }}>↓ Bottom</button>}
    </div>
    {chat.ranCommand && !error && <div className={cn(HINT, "flex flex-wrap items-center gap-2 px-3 py-1")} role="status" data-testid="native-cli-command-ran">Ran <code>{chat.ranCommand}</code> in the CLI. Its output is in CLI view.
      <button type="button" onClick={chat.dismissRanCommand}>Dismiss</button></div>}
    {error && <div className="terminal__cli-error" role="alert">{error} {!snapshot && !exited && <button type="button" onClick={chat.reconnect}>Reconnect UI</button>}</div>}
    {snapshot?.transcript?.tasks && <DockedTasks list={snapshot.transcript.tasks} />}
    <HeldMessages state={chat.inbound.state} canAct={controlling && connected} onOpen={chat.openSession} onAct={chat.inbound.act} />
    <SuggestionCards cards={chat.suggestions.cards} canAct={controlling && connected} onOpen={chat.openSession} onSendHere={chat.suggestions.sendHere} onAct={chat.suggestions.act} />
    <FamilyStrip rows={chat.family.rows} onRefresh={chat.family.refresh} onOpen={chat.openSession} onAct={chat.family.act}
      unavailable={controlling && connected ? undefined : "Take control of this chat to act on a sub-session"} />
    <div className="shrink-0 px-4 pt-1 pb-3">
    <form className={cn("chat__input relative", CHAT_COLUMN, CHAT_INPUT)} onSubmit={(event) => { event.preventDefault(); if (sendable.action === "stop") void chat.stop(); else void chat.send(); }}
      onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
      onDrop={(event) => { if (event.dataTransfer.files.length) { event.preventDefault(); void chat.attach(Array.from(event.dataTransfer.files)); } }}>
      {menu.open && <SlashPopover items={menu.items} active={menu.active} label={menu.label} optionId={menuOptionId} onPick={pickMenu} onHover={menu.setActive} />}
      <Attachments items={images} onRemove={(id) => chat.edit(text, images.filter((image) => image.id !== id))} />
      <textarea ref={field} className={NATIVE_TEXTAREA} aria-label="Message CLI" data-testid="native-cli-composer" value={text} disabled={!connected || !controlling || !snapshot} placeholder={controlling ? "Message this CLI…" : "Take control to send a message"} rows={1}
        role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={menu.open} aria-activedescendant={menu.open ? menuOptionId(menu.active) : undefined}
        onChange={(event) => { chat.edit(event.target.value); setCaret(event.target.selectionStart); }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
        onPaste={(event) => { if (event.clipboardData.files.length) { event.preventDefault(); void chat.attach(Array.from(event.clipboardData.files)); } }}
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
            if (step) { event.preventDefault(); recall.current = step.position; nextCaret.current = step.draft.length; chat.edit(step.draft); setCaret(step.draft.length); return; }
          }
          if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (!sendable.disabled && sendable.action !== "stop") void chat.send(event.altKey); }
          else if (event.key === "Escape" && snapshot?.running && controlling) { event.preventDefault(); void chat.stop(); }
        }} />
      <div className="flex items-center gap-2 px-2 pt-1 pb-2">
        <input ref={picker} type="file" multiple hidden data-testid="native-cli-file-input" onChange={(event) => { void chat.attach(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
        <AddMenu entries={addEntries} disabled={!canCompose} />
        {chat.folder && <span className="flex min-w-0 max-w-[9rem] items-center gap-1 px-1 text-[12px] text-subtext-0" title={chat.folder.path} data-testid="native-cli-folder"><FolderIcon size={13} className="shrink-0" /><span className="truncate">{chat.folder.name}</span></span>}
        <OptionLabels options={snapshot?.options} change={optionChange} only="mode" />
        <span className={cn(HINT, "min-w-0 flex-1 truncate")}>{controlling ? (chat.uploading ? "Uploading…" : "") : chat.inputElsewhere ? "Another view is typing in this agent" : "Viewing agent"}</span>
        {snapshot?.model && (optionChange && snapshot.options?.pickers?.some((option) => option.id === "model")
          ? <span className="native-cli-chat__model" data-model={snapshot.model}><ModelPicker options={snapshot.options} change={optionChange} /></span>
          : <span className="native-cli-chat__model max-w-[14rem] truncate text-[12px] text-subtext-0" title={snapshot.model} data-model={snapshot.model}>{snapshot.options?.model ?? snapshot.model}</span>)}
        <OptionLabels options={snapshot?.options} change={optionChange} only="effort" />
        {snapshot?.context && <ContextRing context={snapshot.context} />}
        <button type="submit" className={sendable.action === "stop" || sendable.action === "stopping" ? SEND_BUTTON_STOP : SEND_BUTTON_GO} aria-label={sendable.label} title={sendable.reason ?? sendable.label} disabled={sendable.disabled}
          onMouseDown={(event) => event.preventDefault()}>
          {sendable.action === "stop" || sendable.action === "stopping"
            ? <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="2" y="2" width="8" height="8" rx="1.5" /></svg>
            : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" /></svg>}
        </button>
      </div>
    </form>
    </div>
    {confirmFull && <ConfirmDialog message="Full access lets the agent edit any file and run commands, with network access, without asking you. It applies to this session only." confirmLabel="Allow full access"
      onCancel={() => setConfirmFull(false)} onConfirm={() => { setConfirmFull(false); void chat.options?.change("mode", "full-access"); }} />}
  </div>;
}

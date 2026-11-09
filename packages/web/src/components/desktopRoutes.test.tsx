// @vitest-environment jsdom
// What Perch binds for the start screen, the editor menu, the terminal's find bar, the slash popover and the
// phone-size notice, whichever copy of their screens shows: the route gets the screen's name and props, each action
// is Perch's own (the editor's transaction, the terminal's search, the session start), and a phone keeps Perch's own.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { history } from "@codemirror/commands";

const h = vi.hoisted(() => ({ routed: [] as { name: string; props: Record<string, any>; exact?: boolean }[], mobile: false }));
vi.mock("./mod-root", () => ({ StockRoute: ({ name, props, exact }: { name: string; props: Record<string, any>; exact?: boolean }) => { h.routed.push({ name, props, exact }); return null; } }));
vi.mock("../ws", () => ({ socket: { send: vi.fn(), connect: vi.fn(), onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));
const { usePerchStore } = await import("../store");
const { ADD_PROJECT_EVENT } = await import("../appEvents");
const { NoSessionPanel } = await import("./StartScreen");
const { EditorContextMenu, editorMenuProps } = await import("./EditorContextMenu");
const { TerminalSearchBar } = await import("./TerminalSearchBar");
const { SlashPopover } = await import("./SlashPopover");
const { PhoneSizeNotice } = await import("./PhoneSizeNotice");
const { SessionSplitPopover } = await import("../dockview/SessionSplitPopover");
const { default: StockSlashPopover } = await import("../stock-ui/slash-popover/main");

let root: Root;
let host: HTMLDivElement;
const last = () => h.routed.at(-1)!;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = (() => ({ matches: h.mobile, addEventListener() {}, removeEventListener() {} })) as never;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  h.routed = []; h.mobile = false;
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

it("routes the empty main area as stock:start: connecting, then home, whose actions start on the active host", () => {
  const createSessionOnHost = vi.fn();
  usePerchStore.setState({ activeHostId: "local", workspaces: [], activeWorkspaceId: null, workspaceProjects: [], sessions: [], sessionId: null, createSessionOnHost });
  act(() => root.render(<NoSessionPanel connected={false} />));
  expect(last()).toMatchObject({ name: "start", exact: false, props: { kind: "connecting", disabled: true } });
  act(() => root.render(<NoSessionPanel connected />));
  const { props } = last();
  expect(props).toMatchObject({ kind: "home", hostId: "local", disabled: false });
  props.actions.startIn("/work/app", "claude");
  expect(createSessionOnHost).toHaveBeenCalledExactlyOnceWith("local", "/work/app", "claude");
  const added = vi.fn();
  window.addEventListener(ADD_PROJECT_EVENT, added);
  props.actions.addProject();
  window.removeEventListener(ADD_PROJECT_EVENT, added);
  expect(added).toHaveBeenCalledOnce();
  h.mobile = true;
  act(() => root.unmount());
  root = createRoot(host);
  act(() => root.render(<NoSessionPanel connected />));
  expect(last().exact).toBe(true);
});

it("routes the editor menu as stock:editor-menu; each action is a transaction on Perch's editor that closes the menu and refocuses it", () => {
  const view = new EditorView({ state: EditorState.create({ doc: "abc", extensions: [history()] }), parent: host });
  const onClose = vi.fn();
  const focus = vi.spyOn(view, "focus");
  expect(editorMenuProps({ view, x: 1, y: 2, readOnly: false, onClose })).toMatchObject({ canUndo: false, canRedo: false, hasSelection: false });
  expect(editorMenuProps({ view, x: 1, y: 2, readOnly: false, onClose }).actions.askAgent).toBeUndefined();
  view.dispatch({ changes: { from: 3, insert: "d" }, selection: { anchor: 0, head: 2 } });
  act(() => root.render(<EditorContextMenu view={view} x={1} y={2} readOnly={false} onClose={onClose} />));
  const { name, props } = last();
  expect(name).toBe("editor-menu");
  expect(props).toMatchObject({ x: 1, y: 2, readOnly: false, canUndo: true, canRedo: false, hasSelection: true });
  props.actions.undo();
  expect(view.state.doc.toString()).toBe("abc");
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(focus).toHaveBeenCalledTimes(1);
  props.actions.selectAll();
  expect(view.state.selection.main).toMatchObject({ from: 0, to: 3 });
  const ask = vi.fn();
  const asked = editorMenuProps({ view, x: 0, y: 0, readOnly: true, onClose, onAskAgent: ask });
  asked.actions.askAgent!();
  expect(ask).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledTimes(3);
  view.destroy();
});

it("routes the terminal's find bar as stock:terminal-search only while open, bound to the terminal's own search", () => {
  const controller = { open: false, query: "x", setQuery: vi.fn(), findNext: vi.fn(), findPrevious: vi.fn(), close: vi.fn() };
  act(() => root.render(<TerminalSearchBar controller={controller} />));
  expect(h.routed).toEqual([]);
  act(() => root.render(<TerminalSearchBar controller={{ ...controller, open: true }} />));
  expect(last()).toMatchObject({ name: "terminal-search", exact: false });
  expect(last().props).toEqual({ query: "x", setQuery: controller.setQuery, findNext: controller.findNext, findPrevious: controller.findPrevious, close: controller.close });
});

it("routes the slash popover and the phone-size notice with the caller's own props", () => {
  const popover = { items: [{ key: "review", label: "/review" }], active: 0, label: "Commands", optionId: (i: number) => `o-${i}`, onPick: vi.fn(), onHover: vi.fn() };
  act(() => root.render(<SlashPopover {...popover} />));
  expect(last()).toEqual({ name: "slash-popover", props: popover, exact: false });
  const notice = { generation: 2, pending: false, onThisTab: vi.fn(), onAllTabs: vi.fn() };
  act(() => root.render(<PhoneSizeNotice {...notice} />));
  expect(last()).toEqual({ name: "phone-size", props: notice, exact: false });
});

it("the stock slash popover keeps the composer's focus: a row's press picks it without taking focus, and rows carry the composer's ids", () => {
  Element.prototype.scrollIntoView = () => {};
  const field = document.createElement("textarea");
  document.body.append(field);
  field.focus();
  const onPick = vi.fn();
  act(() => root.render(<StockSlashPopover items={[{ key: "a", label: "/a" }, { key: "b", label: "/b", detail: "B" }]} active={1} label="Commands" optionId={(i) => `opt-${i}`} onPick={onPick} onHover={() => {}} />));
  const rows = Array.from(host.querySelectorAll<HTMLButtonElement>("[role=option]"));
  expect(rows.map((row) => [row.id, row.getAttribute("aria-selected")])).toEqual([["opt-0", "false"], ["opt-1", "true"]]);
  const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
  act(() => { rows[0]!.dispatchEvent(press); });
  expect(press.defaultPrevented).toBe(true);
  expect(onPick).toHaveBeenCalledExactlyOnceWith(0);
  expect(document.activeElement).toBe(field);
  field.remove();
});

it("routes Split with session as stock:session-split; a pick splits that session with its own title, and an unknown id does nothing", () => {
  const onPick = vi.fn(), onClose = vi.fn();
  const sessions = [{ id: "s2", title: "Two", cwd: "/w" }, { id: "s3", title: "", cwd: "/v" }] as never;
  act(() => root.render(<SessionSplitPopover sessions={sessions} openSessionIds={["s3"]} x={4} y={5} onPick={onPick} onClose={onClose} />));
  const { name, props } = last();
  expect(name).toBe("session-split");
  expect(props).toMatchObject({ x: 4, y: 5, sessions: [{ id: "s2", title: "Two", cwd: "/w", open: false }, { id: "s3", title: "", cwd: "/v", open: true }] });
  props.onPick("s2");
  props.onPick("nope");
  expect(onPick).toHaveBeenCalledExactlyOnceWith("s2", "Two");
  props.onClose();
  expect(onClose).toHaveBeenCalledOnce();
});

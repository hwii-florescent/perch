// @vitest-environment jsdom
import { act, createRef, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OlderHistoryRow } from "./OlderHistoryRow";
import { useOlderHistory } from "./useOlderHistory";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const request = vi.fn();
vi.mock("../../nativeUi", () => ({ requestNativeUi: (message: unknown) => request(message) }));

let host: HTMLDivElement, root: Root;
const list: RefObject<HTMLDivElement | null> = createRef();
type Observe = (entries: { isIntersecting: boolean }[]) => void;
let observers: { callback: Observe; disconnected: boolean }[] = [];

function Harness({ available, revision }: { available: boolean; revision: number }) {
  const older = useOlderHistory({ sessionId: "s", providerId: "claude", available, list, revision });
  return <div ref={list} data-testid="list">{available && <OlderHistoryRow older={older} />}</div>;
}
const render = (available: boolean, revision = 1) => act(() => root.render(<Harness available={available} revision={revision} />));
const reply = (outcome: string) => Promise.resolve({ type: "agent.ui.older.result", outcome });

beforeEach(() => {
  request.mockReset();
  observers = [];
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
    entry: { callback: Observe; disconnected: boolean };
    constructor(callback: Observe) { this.entry = { callback, disconnected: false }; observers.push(this.entry); }
    observe() {}
    disconnect() { this.entry.disconnected = true; }
  };
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver; });

const live = () => observers.filter((observer) => !observer.disconnected);

it("asks the core for a page when the top comes near, and again after a page while the top is still near", async () => {
  request.mockImplementation(() => reply("applied"));
  render(true);
  expect(live()).toHaveLength(1);
  await act(async () => live()[0]!.callback([{ isIntersecting: true }]));
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0]![0]).toMatchObject({ type: "agent.ui.older", sessionId: "s", providerId: "claude" });
  // The page landed: a new observer is made, which reports a top that is still near.
  render(true, 2);
  expect(live()).toHaveLength(1);
  await act(async () => live()[0]!.callback([{ isIntersecting: true }]));
  expect(request).toHaveBeenCalledTimes(2);
});

it("stops loading by itself after a page that added nothing and offers the button instead", async () => {
  request.mockImplementation(() => reply("unchanged"));
  render(true);
  await act(async () => live()[0]!.callback([{ isIntersecting: true }]));
  render(true, 2);
  expect(live()).toHaveLength(0);
  const button = host.querySelector("button")!;
  expect(button.textContent).toBe("Load earlier messages");
  request.mockImplementation(() => reply("applied"));
  await act(async () => button.click());
  expect(request).toHaveBeenCalledTimes(2);
});

it("does not observe, and shows nothing to load, when the core says nothing older can be loaded", () => {
  render(false);
  expect(live()).toHaveLength(0);
  expect(host.querySelector("[data-testid=native-cli-older]")).toBeNull();
});

it("keeps the reader's place by the height a page added above", async () => {
  request.mockImplementation(() => reply("applied"));
  render(true);
  const element = list.current!;
  let height = 1000;
  Object.defineProperty(element, "scrollHeight", { get: () => height, configurable: true });
  element.scrollTop = 40;
  await act(async () => live()[0]!.callback([{ isIntersecting: true }]));
  height = 2600;
  render(true, 2);
  expect(element.scrollTop).toBe(1640);
});

// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { Attachments, type ComposerImage } from "./Attachments";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const urls = { made: 0, revoked: [] as string[] };
URL.createObjectURL = () => `blob:test/${++urls.made}`;
URL.revokeObjectURL = (url) => { urls.revoked.push(url); };

const picture: ComposerImage = { id: "a", name: "shot.png", path: "/up/shot.png", file: new File([new Uint8Array([1])], "shot.png", { type: "image/png" }) };
const doc: ComposerImage = { id: "b", name: "notes.pdf", path: "/up/notes.pdf", file: new File([new Uint8Array([1])], "notes.pdf", { type: "application/pdf" }) };

function mount(node: React.ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return { host, root, done: () => { act(() => root.unmount()); host.remove(); } };
}

it("shows a picture as a thumbnail that opens full size, and any other file as a chip", () => {
  const onRemove = vi.fn();
  const view = mount(<Attachments items={[picture, doc]} onRemove={onRemove} />);
  expect(view.host.querySelector("img")?.getAttribute("src")).toMatch(/^blob:/);
  expect(view.host.querySelectorAll("img")).toHaveLength(1);
  expect(view.host.textContent).toContain("notes.pdf");
  expect(document.body.querySelector("[data-testid=native-cli-image-preview]")).toBeNull();

  act(() => view.host.querySelector<HTMLButtonElement>("[aria-label='Preview shot.png']")!.click());
  const preview = document.body.querySelector("[data-testid=native-cli-image-preview]");
  expect(preview?.querySelector("img")?.getAttribute("alt")).toBe("shot.png");
  act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
  expect(document.body.querySelector("[data-testid=native-cli-image-preview]")).toBeNull();

  act(() => view.host.querySelector<HTMLButtonElement>("[aria-label='Remove shot.png']")!.click());
  expect(onRemove).toHaveBeenCalledExactlyOnceWith("a");
  view.done();
});

it("draws the thumbnail again after a remount: its URL is made on mount, not carried in the draft", () => {
  const first = mount(<Attachments items={[picture]} onRemove={() => {}} />);
  const before = first.host.querySelector("img")!.getAttribute("src")!;
  first.done();
  expect(urls.revoked).toContain(before);
  const second = mount(<Attachments items={[picture]} onRemove={() => {}} />);
  const after = second.host.querySelector("img")!.getAttribute("src")!;
  expect(after).not.toBe(before);
  expect(urls.revoked).not.toContain(after);
  second.done();
});

// @vitest-environment jsdom
import { forwardRef } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { FileMetadata } from "@perch/shared";
import { localImagePath } from "./WorkspaceMarkdownPreview";

vi.mock("../ws", () => ({ socket: { connected: true, send: vi.fn(), connect: vi.fn(), onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));
// CodeMirror is covered by e2e; here the editor is a textarea that edits the same draft the real one does.
vi.mock("./CodeEditor", () => ({
  CodeEditor: forwardRef<unknown, { value: string; onChange: (value: string) => void }>(function CodeEditor({ value, onChange }, _ref) {
    return <textarea data-testid="fake-editor" value={value} onChange={(event) => onChange(event.target.value)} />;
  }),
}));
// Relay pages tunnel media into object URLs (relay/transport.ts); `relay.url` is null while it is fetched.
const relay = vi.hoisted(() => ({ on: false, url: null as string | null }));
vi.mock("../relay/transport", () => ({
  isRelayMode: () => relay.on,
  useRelayUrl: (url: string) => (relay.on ? relay.url : url),
  relayDownload: vi.fn(),
}));
const openWindow = vi.spyOn(window, "open").mockImplementation(() => null);
const { WorkspaceFilesView } = await import("../stock-ui/files/files");
const { WorkspaceFileAsset } = await import("./WorkspaceFileAsset");
const { MAX_IMAGE_BYTES } = await import("./WorkspaceImage");
const { usePerchStore } = await import("../store");
const { useWorkspaceFilesStore } = await import("../filesystemStore");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base = { projectId: "p", path: "/tmp/w", name: "W", branch: "main", dirty: false, state: "active" as const, createdAt: 1, updatedAt: 1 };
const metadata = (path: string, overrides: Partial<FileMetadata> = {}): FileMetadata => ({ path, name: path.split("/").at(-1)!, size: 10, readonly: false, executable: false, kind: "file", ...overrides });
const initialFiles = useWorkspaceFilesStore.getState();
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  relay.on = false;
  relay.url = null;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  usePerchStore.setState({ connected: true, workspaces: [{ ...base, id: "w", hostId: "local" }, { ...base, id: "r", hostId: "remote-1" }] });
});
afterEach(() => { act(() => root.unmount()); host.remove(); useWorkspaceFilesStore.setState(initialFiles, true); });
const get = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const button = (label: string) => Array.from(host.querySelectorAll("button")).find((el) => el.textContent === label || el.getAttribute("aria-label") === label)!;
const click = (el: Element) => act(() => (el as HTMLElement).click());

async function openMarkdown(workspaceId: string, path: string, content: string, savedContent = content) {
  useWorkspaceFilesStore.setState({
    trees: {}, previews: {}, searches: {},
    openFile: vi.fn(), requestPreview: vi.fn(), requestTree: vi.fn(),
    documents: { [workspaceId]: { [path]: { workspaceId, path, metadata: metadata(path, { mediaType: "text/markdown" }), content, savedContent, state: "ready" } } },
  });
  await act(async () => root.render(<WorkspaceFilesView workspaceId={workspaceId} initialPath={path} layout="editor" />));
}

it("localImagePath resolves beside the Markdown file and never leaves the workspace", () => {
  expect(localImagePath("docs/guide.md", "img/a.png")).toBe("docs/img/a.png");
  expect(localImagePath("docs/guide.md", "../a.png?raw#x")).toBe("a.png");
  expect(localImagePath("README.md", "./a%20b.PNG")).toBe("a b.PNG");
  for (const bad of ["../a.png", "../../a.png", "docs/../../a.png", "/etc/a.png", "//evil.test/a.png", "https://evil.test/a.png", "file:///a.png", "a\\b.png", "%2e%2e/a.png", "a%00.png", "notes.txt", "%zz.png"]) {
    expect(localImagePath("README.md", bad), bad).toBeNull();
  }
  expect(localImagePath("docs/guide.md", "%2e%2e/%2e%2e/a.png")).toBeNull();
});

it("Markdown Preview renders the unsaved draft, leaves the editor and draft intact, and Source returns", async () => {
  await openMarkdown("w", "README.md", "# Draft title\n\n![x](pics/a.png) ![y](https://evil.test/y.png)", "# Saved title");
  expect(button("Preview")).toBeDefined();
  expect(get("workspace-markdown-preview")).toBeNull();
  click(button("Preview"));
  const preview = get("workspace-markdown-preview")!;
  expect(preview.querySelector("h1")?.textContent).toBe("Draft title");
  expect(preview.textContent).not.toContain("Saved title");
  expect(preview.querySelector("img")?.getAttribute("src")).toContain("workspace-file?workspaceId=w&path=pics%2Fa.png");
  expect(preview.querySelector(".md-placeholder")?.textContent).toBe("[image: y] https://evil.test/y.png");
  // Still mounted (hidden): caret/undo/draft are untouched, and the store draft is unchanged.
  expect(get("fake-editor")).not.toBeNull();
  expect(useWorkspaceFilesStore.getState().documents.w!["README.md"]!.content).toContain("Draft title");
  expect(button("Preview").getAttribute("aria-pressed")).toBe("true");
  click(button("Source"));
  expect(get("workspace-markdown-preview")).toBeNull();
  expect(button("Source").getAttribute("aria-pressed")).toBe("true");
});

it("Markdown preview follows edits made in Source", async () => {
  await openMarkdown("w", "notes.markdown", "one");
  click(button("Preview"));
  expect(get("workspace-markdown-preview")!.textContent).toContain("one");
  act(() => useWorkspaceFilesStore.setState((state) => ({ documents: { w: { "notes.markdown": { ...state.documents.w!["notes.markdown"]!, content: "two" } } } })));
  expect(get("workspace-markdown-preview")!.textContent).toContain("two");
});

it("non-Markdown files keep the server Preview button and have no toggle", async () => {
  await openMarkdown("w", "main.ts", "const a = 1;");
  expect(button("Preview")).toBeDefined();
  expect(host.querySelector('[aria-label="Markdown view"]')).toBeNull();
});

it("remote-host Markdown renders through the same document store, with local images as placeholders", async () => {
  await openMarkdown("r", "README.md", "# Remote\n\n![x](pics/a.png)");
  click(button("Preview"));
  const preview = get("workspace-markdown-preview")!;
  expect(preview.querySelector("h1")?.textContent).toBe("Remote");
  expect(preview.querySelector("img")).toBeNull();
  expect(preview.querySelector(".md-placeholder")?.textContent).toBe("[image: x] pics/a.png");
});

it("relay pages cannot tunnel <img> fetches, so relative Markdown images stay placeholders", async () => {
  relay.on = true;
  await openMarkdown("w", "README.md", "# Relay\n\n![x](pics/a.png)");
  click(button("Preview"));
  const preview = get("workspace-markdown-preview")!;
  expect(preview.querySelector("img")).toBeNull();
  expect(preview.querySelector(".md-placeholder")?.textContent).toBe("[image: x] pics/a.png");
});

it("links act only on click, never navigate the app, and only http(s) opens", async () => {
  await openMarkdown("w", "README.md", "[web](https://example.com/x) [rel](./a.md) [js](javascript:alert(1))");
  click(button("Preview"));
  const anchors = Array.from(get("workspace-markdown-preview")!.querySelectorAll("a"));
  expect(openWindow).not.toHaveBeenCalled();
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
  act(() => { anchors[0]!.dispatchEvent(event); });
  expect(event.defaultPrevented).toBe(true);
  expect(openWindow).toHaveBeenCalledWith("https://example.com/x", "_blank", "noopener");
  for (const anchor of anchors.slice(1)) {
    expect(anchor.hasAttribute("href")).toBe(false);
    const inert = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => { anchor.dispatchEvent(inert); });
    expect(inert.defaultPrevented).toBe(true);
  }
  expect(openWindow).toHaveBeenCalledTimes(1);
});

const renderAsset = (file: FileMetadata, workspaceId = "w") => act(() => root.render(<WorkspaceFileAsset workspaceId={workspaceId} metadata={file} />));
const picture = metadata("pics/a.png", { mediaType: "image/png" });
const loaded = (width: number, height: number) => {
  const img = get("workspace-file-image") as HTMLImageElement;
  Object.defineProperty(img, "naturalWidth", { value: width, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: height, configurable: true });
  act(() => { img.dispatchEvent(new Event("load")); });
  return img;
};

it("image viewer shows natural dimensions once decoded and has labelled Fit / 100% / zoom controls", () => {
  renderAsset(picture);
  expect(get("workspace-image-info")!.textContent).toBe("");
  const img = loaded(800, 600);
  expect(get("workspace-image-info")!.textContent).toBe("800 × 600 · Fit");
  expect(host.querySelector('[role="toolbar"]')?.getAttribute("aria-label")).toBe("Image view");
  for (const label of ["Zoom in", "Zoom out", "Fit", "100%"]) expect(button(label)).toBeDefined();
  click(button("100%"));
  expect(img.style.width).toBe("800px");
  expect(get("workspace-image-info")!.textContent).toBe("800 × 600 · 100%");
  click(button("Fit"));
  expect(img.style.width).toBe("");
});

it("through the relay the image viewer waits for the tunnelled object URL, then decodes it", () => {
  relay.on = true;
  renderAsset(picture);
  expect(get("workspace-file-image")).toBeNull();
  expect(host.textContent).toContain("Loading…");
  relay.url = "blob:http://relay.test/abc";
  renderAsset(picture);
  expect(get("workspace-file-image")!.getAttribute("src")).toBe("blob:http://relay.test/abc");
  loaded(32, 16);
  expect(get("workspace-image-info")!.textContent).toBe("32 × 16 · Fit");
});

it("image zoom steps are clamped and reachable from the keyboard on the pane", () => {
  renderAsset(picture);
  const img = loaded(20000, 10000);
  const pane = host.querySelector<HTMLElement>("[tabindex='0']")!;
  expect(pane.getAttribute("aria-label")).toContain("Plus and minus zoom");
  // 100% of a 20000px image would exceed the layer cap, so it is clamped; further zoom-in stays at the cap.
  act(() => { pane.dispatchEvent(new KeyboardEvent("keydown", { key: "0", bubbles: true })); });
  expect(parseFloat(img.style.width)).toBeCloseTo(16384);
  act(() => { pane.dispatchEvent(new KeyboardEvent("keydown", { key: "+", bubbles: true })); });
  expect(parseFloat(img.style.width)).toBeCloseTo(16384);
  for (let i = 0; i < 40; i++) act(() => { pane.dispatchEvent(new KeyboardEvent("keydown", { key: "-", bubbles: true })); });
  expect(parseFloat(img.style.width)).toBeCloseTo(1000); // MIN_SCALE 5%
});

it("a zero-size decode (sizeless SVG) offers no dimensions or zoom beyond Fit", () => {
  renderAsset(metadata("logo.svg", { mediaType: "image/svg+xml" }));
  loaded(0, 0);
  expect(get("workspace-image-info")!.textContent).toBe("");
  expect((button("Zoom in") as HTMLButtonElement).disabled).toBe(true);
});

it("corrupt images fall back to a message with the download action, not a broken icon", () => {
  renderAsset(picture);
  act(() => { get("workspace-file-image")!.dispatchEvent(new Event("error")); });
  expect(get("workspace-file-image")).toBeNull();
  expect(host.textContent).toContain("Preview unavailable");
  expect(host.textContent).toContain("corrupt");
  expect(host.querySelector("a[download]")).not.toBeNull();
});

it("oversized images are not decoded and keep the download action", () => {
  renderAsset({ ...picture, size: MAX_IMAGE_BYTES + 1 });
  expect(get("workspace-file-image")).toBeNull();
  expect(host.textContent).toContain("Image too large to preview");
  expect(host.querySelector("a[download]")).not.toBeNull();
});

it("remote-host images still say media is unavailable", () => {
  renderAsset(picture, "r");
  expect(host.textContent).toContain("Remote media is not available yet");
});

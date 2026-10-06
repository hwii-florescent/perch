/** The visible scrollbar overlays the surface: fitting must not reserve a
 * second gutter in the terminal grid. Plain shells only, no model turns. */
import { test, expect, type Page } from "@playwright/test";
import { startChat } from "./projects";

async function geometry(page: Page) {
  return page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const visible = Array.from(document.querySelectorAll('[data-testid="persistent-agent-terminal"]')).find((element) => element.checkVisibility());
    // Same committed React-tree probe as memory/memory.mjs. No production debug API.
    const root = document.getElementById("root") as any;
    const fiber = root[Object.keys(root).find((key) => key.startsWith("__reactContainer$"))!];
    const visited = new Set();
    function find(node: any): any {
      if (!node || visited.has(node)) return;
      visited.add(node);
      for (let hook = node.memoizedState; hook && typeof hook === "object" && "next" in hook; hook = hook.next) {
        const view = hook.memoizedState;
        if (view?.created?.term?.element?.isConnected && visible?.contains(view.created.term.element)) return view;
      }
      return find(node.child) ?? find(node.sibling);
    }
    const view = find(fiber.stateNode?.current ?? fiber);
    if (!view) return null;
    const term = view.created.term;
    const host = term.element.parentElement;
    const surface = host.closest(".terminal__surface");
    const screen = term.screenElement;
    return {
      width: host.clientWidth,
      screenWidth: screen.getBoundingClientRect().width,
      gap: host.getBoundingClientRect().right - screen.getBoundingClientRect().right,
      cellWidth: term.dimensions.css.cell.width,
      cols: term.cols,
      scrollbar: term.options.scrollbar.width,
      padding: getComputedStyle(surface).paddingRight,
      xtermPadding: getComputedStyle(term.element).paddingRight,
      canvas: !!screen.querySelector("canvas"),
      ready: Array.from({ length: Math.min(20, term.buffer.active.length) }, (_, i) => term.buffer.active.getLine(i)?.translateToString(true)).includes("__WIDTH_READY__"),
    };
  });
}

for (const renderer of ["dom", "webgl"] as const) {
  test(`terminal width uses the full surface (${renderer})`, async ({ page }, testInfo) => {
    if (renderer === "webgl") await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));
    await page.setViewportSize({ width: 1272, height: 820 });
    await page.goto("/", { waitUntil: "networkidle" });
    const sessionId = await startChat(page);
    const terminal = page.getByTestId("persistent-agent-terminal");
    await expect(terminal).toHaveAttribute("data-controlling", "true");
    // A real PTY frame, repainted on resize. Direct term.write() would be
    // overwritten by perchd's authoritative screen replay after a resize.
    const command = [
      "import shutil,sys,time,signal",
      'draw=lambda *_: (sys.stdout.write("\\033[2J\\033[H\\033[48;2;44;63;48m" + " terminal width check ".ljust(shutil.get_terminal_size().columns) + "\\033[0m\\r\\n__WIDTH_READY__\\r\\n"), sys.stdout.flush())',
      "signal.signal(signal.SIGWINCH, draw)",
      "draw()",
      "time.sleep(60)",
    ].join("; ");
    const input = terminal.locator(".xterm-helper-textarea");
    await input.pressSequentially(`python3 -c '${command}'`);
    await input.press("Enter");
    await expect.poll(async () => (await geometry(page))?.ready).toBe(true);
    for (const width of [1272, 813]) {
      await page.setViewportSize({ width, height: 820 });
      await expect.poll(async () => (await geometry(page))?.canvas).toBe(renderer === "webgl");
      await expect.poll(async () => {
        const box = await geometry(page);
        return !!box && Math.abs(box.screenWidth - box.cols * box.cellWidth) < 1;
      }).toBe(true);
      const box = (await geometry(page))!;
      console.log(`${testInfo.project.name} ${renderer} ${width}: ${JSON.stringify(box)}`);
      await page.screenshot({ path: testInfo.outputPath(`terminal-width-${width}.png`) });
      expect(box.padding).toBe("0px");
      expect(box.xtermPadding).toBe("0px");
      // Only the fractional remainder of one cell is unavoidable, not a scrollbar gutter too.
      expect(box.cols).toBe(Math.max(2, Math.floor(box.width / box.cellWidth)));
      expect(box.gap).toBeLessThan(box.cellWidth + 1);
    }
    await page.getByTestId(`tab-close-${sessionId}`).click();
  });
}

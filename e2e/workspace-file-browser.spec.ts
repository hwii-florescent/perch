/** Local-only file browsing; no agent/model calls. */
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { addProject } from "./projects";
import { firstWorkspaceId, openWorkspaceTool } from "./workspaceTools";

// Synthetic 16×16 gray H.264 clip, generated with ffmpeg, gzip/base64 for a
// self-contained fixture (no ffmpeg required to run this test).
const VIDEO = "H4sIAAAAAAAAE41UQWskRRSumYm7IeiySkAPOZQa8GAy6e6ZzK7Bxk1icIRVvLgqiE11VfV0O91dlaqaycyeVnDBo6cF95CjqMhePYiaxRwE/4ABEUUQRVBPspfN7KueHmeSRbHoqvde1fe+eq/em0EI4cgMZaJFhlAVWQnTI33qZrLpIlR7PxOijxBKs37M0IlR+xWhyiVUQfabjspJ1Gn7EvrPUYXvc6NIF/Q3Tbe4s3Y/W+V+mv9z7/lyIrTMmdEgl3iqzdTD8s6VvtVGxhICCs7Y6dy9gujVw8JYjVmqJif9hPFZ5BWwRZvkLOUWU/khS/IIlMV+VpDOhrnMxmdLTPFoJo0HeyrFZYD72oQp6F9qo9kM5pYt2r88hY31PGqDbE8Qi5cB32rU3brreDhNwoHXas56PDYawdoE1HaFoYXRT+jRDshPj946eN6WZM4u3zzbvvF6BZ2Jf//52ycO7t65U9wliZZlFHYuhkaVT/zy2Qm7NsXzT6KdLyoPWMhqdt/ONp1iz4735srzBXTSnvhVSzlvZbW0l4CbnuKeL2UTzq7OZG/j+dq+/Kn5CMxzpQ6xUjHlqx2AJD1mbMu8kfFC2vH4bHtASykiZTr71CvJuAeXPzbCEi4xUjgXCUGdokmdbGCR4tBftacyAEGQt848MBp98v3Ob1/8ctT+7MbKd/joyT/+tMXEq5gKxbHbWseq4XkeDhvrLWedwEG7DoC1l17ZeWG1iTevbAOScQoH20IOUx4Z7DlOY9VzvHXYjI2RG2tre3t7ddvdIiV5XajOmr2lHpssBYyQJhG53sCUhIT6LoYO9huY8TAVtOu7G86Gg0lO0qHmvjNobDgD123gjPsxH2DdC0G7gKUegiusgWK+W3fACRacJQPOAsvogkegSN7hvtvCNFYiIwG4utgonqaJBu3i4CKjBhS6m/kOhEDYVZFz33NXXBdHRJtA6m4iLWJMsCsDEUWaG3/VwyZW4GGJUiG6JAYjmO7pNKF8uuHgXBV30CQjxsaR5IarlAAI9sO0p8gwoCKTxIBN4Yngzy3JgQKAilhMpEjGNTxWGMgh6AnzoVYBYUTaLMIgTIi9CTqHF3nt8aQTmxA0IXkedISE0/GmBNcuHwK37607pRrAXw6YWFOec9ozftPBxe32SRXXMbgrGvyTrj1X1Kcqwhn8drlNCwzfa9QdvGuT8Z16C1RpiQtJBn7rGVC04dJv4kRCkaAhoIbARXah/raa6Bp08EP8vXfRhdHx338d17Zu25bevLmcbj93/GOh728Nro9uv2P1yj4xW18dXhvr9G3Q7f65zZudFz/ajD+4PP/a6NgyLGzuX995eOXp0WHp92GBvQfzoXM03wYAAA==";

function pdf(): string {
  let content = "%PDF-1.4\n";
  const stream = "BT /F1 16 Tf 20 100 Td (File preview) Tj ET";
  const offsets = [0];
  for (const [index, object] of [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 7 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream.replace("File preview", "Second page!")}\nendstream`,
  ].entries()) {
    offsets.push(content.length);
    content += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = content.length;
  content += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  content += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  return content + `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

test("search, media tabs, readonly files and safe extraction", async ({ page, request }, testInfo) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "perch-file-browser-"));
  try {
    fs.mkdirSync(path.join(root, "nested"));
    fs.writeFileSync(path.join(root, "nested/note.txt"), "nested file\n");
    fs.writeFileSync(path.join(root, "readonly.txt"), "readonly\n", { mode: 0o444 });
    fs.writeFileSync(path.join(root, "picture.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#666"/></svg>');
    fs.writeFileSync(path.join(root, "document.pdf"), pdf());
    fs.writeFileSync(path.join(root, "clip.mp4"), gunzipSync(Buffer.from(VIDEO, "base64")));
    fs.writeFileSync(path.join(root, "packed.txt.gz"), gzipSync("extracted gzip\n"));
    fs.writeFileSync(path.join(root, "unknown.bin"), Buffer.from([0, 1, 2, 3]));
    fs.symlinkSync(os.tmpdir(), path.join(root, "outside"));
    execFileSync("zip", ["-q", "files.zip", "nested/note.txt"], { cwd: root });
    await page.goto("/");
    await addProject(page, root);
    const project = page.locator(".workspace-project").filter({ hasText: path.basename(root) });
    const workspaceId = await firstWorkspaceId(project);
    await openWorkspaceTool(page, workspaceId, "files");

    const search = page.getByRole("searchbox", { name: "Search workspace files" });
    await search.fill("nested/note");
    await page.getByTestId("workspace-file-entry-nested/note.txt").click();
    await expect(page.getByTestId("file-tab-nested/note.txt")).toHaveClass(/tab-bar__tab--active/);
    await expect(page.getByTestId("workspace-file-editor")).toHaveValue("nested file\n");
    await search.fill("does-not-exist");
    await expect(page.getByText("No matching files", { exact: true })).toBeVisible();
    await search.fill("");
    await page.getByTestId("workspace-file-entry-readonly.txt").click();
    await expect(page.getByTestId("workspace-file-editor")).toHaveValue("readonly\n");
    await expect(page.getByTestId("workspace-file-editor")).toHaveAttribute("readonly", "");
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();

    await page.getByTestId("workspace-file-entry-picture.svg").click();
    await expect.poll(() => page.getByTestId("workspace-file-image").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(240);
    await page.screenshot({ path: testInfo.outputPath("file-browser-desktop.png"), fullPage: true });
    await page.getByTestId("workspace-file-entry-document.pdf").click();
    await expect(page.getByTestId("workspace-file-pdf")).toBeVisible();
    await expect(page.getByTestId("workspace-file-pdf")).toHaveAttribute("data-ready", "true");
    await expect(page.getByRole("document", { name: "PDF page 1 text" })).toHaveText("File preview");
    expect(await page.getByTestId("workspace-pdf-canvas").evaluate((canvas: HTMLCanvasElement) => {
      const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      return pixels.some((value, index) => index % 4 !== 3 && value < 100);
    })).toBe(true);
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(page.getByRole("document", { name: "PDF page 2 text" })).toHaveText("Second page!");
    await page.getByRole("button", { name: "Previous page", exact: true }).click();
    await page.getByRole("combobox", { name: "PDF zoom" }).selectOption("1.5");
    await expect(page.getByTestId("workspace-file-pdf")).toHaveAttribute("data-ready", "true");
    await page.screenshot({ path: testInfo.outputPath("file-browser-pdf.png"), fullPage: true });
    await expect(page.getByTestId("file-tab-document.pdf")).toHaveClass(/tab-bar__tab--active/);
    await page.getByTestId("workspace-file-entry-clip.mp4").click();
    await expect.poll(() => page.getByTestId("workspace-file-video").evaluate((video: HTMLVideoElement) => video.readyState)).toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId("file-tab-clip.mp4")).toHaveClass(/tab-bar__tab--active/);

    const contentUrl = (file: string) => `/workspace-file?${new URLSearchParams({ workspaceId, path: file })}`;
    const range = await request.get(contentUrl("clip.mp4"), { headers: { Range: "bytes=2-5" } });
    expect(range.status()).toBe(206);
    expect((await range.body()).length).toBe(4);
    expect(range.headers()["content-range"]).toMatch(/^bytes 2-5\//);
    expect((await request.get(contentUrl("../outside"))).status()).toBe(400);
    expect((await request.get(contentUrl("outside/anything"))).status()).toBe(400);
    expect((await request.get(contentUrl("clip.mp4"), { headers: { Origin: "https://not-perch.example" } })).status()).toBe(403);
    expect((await request.get(contentUrl("clip.mp4"), { headers: { "x-forwarded-for": "192.0.2.1" } })).status()).toBe(401);

    // A controlled PWA must not serve the app shell in place of a download.
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await page.getByTestId("workspace-file-entry-unknown.bin").click();
    await expect(page.getByText("No preview for this file type", { exact: true })).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Download", exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("unknown.bin");

    for (const [archive, destination, member, text] of [
      ["files.zip", "files-extracted", "nested/note.txt", "nested file\n"],
      ["packed.txt.gz", "packed.txt-extracted", "packed.txt", "extracted gzip\n"],
    ]) {
      await page.getByTestId(`workspace-file-entry-${archive}`).click();
      await page.getByRole("button", { name: "Extract", exact: true }).click();
      await expect(page.getByText(`Extracted to ${destination}. Find it in the file tree.`, { exact: true })).toBeVisible();
      await expect(page.getByTestId(`workspace-file-entry-${destination}`)).toBeVisible();
      expect(fs.readFileSync(path.join(root, destination, member), "utf8")).toBe(text);
    }
    await page.getByRole("button", { name: "Extract", exact: true }).click();
    await expect(page.getByTestId("workspace-file-asset").getByRole("alert")).toContainText("folder exists");
    expect(fs.readFileSync(path.join(root, "packed.txt-extracted/packed.txt"), "utf8")).toBe("extracted gzip\n");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId("mobile-pane-files").click();
    await page.getByRole("searchbox", { name: "Search workspace files" }).fill("picture.svg");
    await page.getByTestId("workspace-file-entry-picture.svg").click();
    await expect(page.getByTestId("workspace-file-image")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("file-browser-mobile.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

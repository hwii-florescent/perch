import { webkit } from "@playwright/test";
const t = Date.now();
const browser = await webkit.launch();
const page = await browser.newPage();
await page.setContent("<h1>ok</h1>");
console.log("webkit ok", await page.textContent("h1"), Date.now() - t, "ms");
await browser.close();

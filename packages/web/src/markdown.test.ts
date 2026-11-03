// @vitest-environment jsdom
import { expect, it } from "vitest";
import { FILE_PREVIEW_MAX_CHARS, renderFilePreview, renderMarkdown } from "./markdown";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

it.each([false, true])("sanitizes chat HTML, including streaming=%s", (streaming) => {
  const html = renderMarkdown('**Hello** <script>alert(1)</script><img src="x" onerror="alert(1)"> [click](javascript:alert(1))', streaming);
  const content = new DOMParser().parseFromString(html, "text/html");
  expect(content.querySelector("strong")?.textContent).toBe("Hello");
  expect(content.querySelector("script")).toBeNull();
  expect(content.querySelector("img")?.hasAttribute("onerror")).toBe(false);
  expect(content.querySelector("a")?.hasAttribute("href")).toBe(false);
});

const REMOTE_INPUTS: Record<string, string> = {
  "markdown image": "![logo](https://evil.test/a.png)",
  "html image": '<img src="https://evil.test/a.png" alt="logo">',
  "protocol-relative image": '<img src="//evil.test/a.png" alt="logo">',
  srcset: '<img srcset="https://evil.test/a.png 2x" alt="logo">',
  "srcset next to a src": '<img src="a.png" srcset="https://evil.test/a.png 2x" alt="logo">',
  picture: '<picture><source srcset="https://evil.test/a.webp"><img src="https://evil.test/a.png" alt="logo"></picture>',
  "video poster": '<video src="https://evil.test/v.mp4" poster="https://evil.test/p.png" controls></video>',
  audio: '<audio src="https://evil.test/a.mp3"></audio>',
  iframe: '<iframe src="https://evil.test/"></iframe>',
  "embed and object": '<embed src="https://evil.test/x.swf"><object data="https://evil.test/x"></object>',
  svg: '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.test/a.png"/><script>alert(1)</script></svg>',
  stylesheet: '<link rel="stylesheet" href="https://evil.test/a.css"><style>@import url(https://evil.test/b.css); p { background: url(https://evil.test/c.png) }</style>',
  "inline css url()": '<div style="background:url(https://evil.test/a.png)">x</div><p style="list-style:url(//evil.test/b.png)">y</p>',
  "svg data image": '<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" alt="logo">',
};

it.each(Object.entries(REMOTE_INPUTS))("file preview never loads anything remote: %s", (_name, markdown) => {
  const content = parse(renderFilePreview(markdown).html);
  expect(content.querySelector("img, svg, style, link, iframe, video, audio, embed, object, source, picture, script")).toBeNull();
  for (const element of Array.from(content.body.querySelectorAll("*"))) {
    for (const attribute of Array.from(element.attributes)) expect(attribute.value).not.toMatch(/evil\.test|url\(|srcset/i);
  }
});

it("shows alt text and the URL as text where an image would have loaded", () => {
  const placeholder = parse(renderFilePreview("![the logo](https://evil.test/a.png)").html).querySelector(".md-placeholder");
  expect(placeholder?.textContent).toBe("[image: the logo] https://evil.test/a.png");
  expect(placeholder?.querySelector("a")).toBeNull();
  expect(parse(renderFilePreview('<img src="//evil.test/a.png">').html).querySelector(".md-placeholder")?.textContent).toContain("//evil.test/a.png");
  expect(parse(renderFilePreview('<picture><img src="https://evil.test/a.png"></picture>').html).querySelector(".md-placeholder")).not.toBeNull();
  expect(parse(renderFilePreview('<video poster="https://evil.test/p.png" src="https://evil.test/v.mp4" title="Demo"></video>').html).querySelector(".md-placeholder")?.textContent).toBe("[video: Demo] https://evil.test/v.mp4");
});

it("file preview removes scripts, handlers and unsafe URLs, and keeps ordinary Markdown", () => {
  const { html } = renderFilePreview('# Title\n\n**bold** <script>alert(1)</script><b onclick="alert(1)" onmouseover="alert(2)">b</b> [js](javascript:alert(1)) [vb](vbscript:x) <a href="data:text/html,x">data</a> [rel](./docs/a.md) [web](https://example.com/x)\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n\n```\ncode\n```');
  const content = parse(html);
  expect(content.querySelector("h1")?.textContent).toBe("Title");
  expect(content.querySelector("strong")?.textContent).toBe("bold");
  expect(content.querySelector("script")).toBeNull();
  expect(html).not.toMatch(/\son\w+=|<script|href="(?!https:)/i);
  expect(Array.from(content.querySelectorAll("a")).map((a) => a.getAttribute("href"))).toEqual([null, null, null, null, "https://example.com/x"]);
  expect(content.querySelector("a[href]")?.getAttribute("rel")).toBe("noopener noreferrer");
  expect(content.querySelectorAll("td")).toHaveLength(2);
  expect(content.querySelector("input")?.hasAttribute("disabled")).toBe(true);
  expect(content.querySelector("pre code")?.textContent).toBe("code\n");
});

it("file preview strips classes so untrusted HTML cannot borrow the app's utility classes", () => {
  const { html } = renderFilePreview('<div class="fixed inset-0 z-50 bg-black">cover</div> <span class="md-placeholder">fake</span> <code class="fixed">x</code>\n\n```js\nlet a\n```\n\n![alt](https://evil.test/a.png)');
  const content = parse(html);
  expect(content.querySelector("div")?.hasAttribute("class")).toBe(false);
  expect(content.querySelectorAll(".md-placeholder")).toHaveLength(1); // ours only, for the image
  expect(content.querySelector(".md-placeholder")?.textContent).toContain("evil.test");
  expect(Array.from(content.querySelectorAll("[class]")).map((el) => `${el.tagName}.${el.className}`).sort()).toEqual(["CODE.language-js", "SPAN.md-placeholder"]);
});

it("file preview keeps only resolver-approved and inline raster images", () => {
  const resolve = (src: string) => (src === "pics/a.png" ? "http://perch.test/workspace-file?path=pics%2Fa.png" : null);
  const content = parse(renderFilePreview("![a](pics/a.png) ![b](other.png) ![c](data:image/png;base64,AAAA) ![d](data:image/svg+xml;base64,AAAA)", resolve).html);
  expect(Array.from(content.querySelectorAll("img")).map((img) => img.getAttribute("src"))).toEqual(["http://perch.test/workspace-file?path=pics%2Fa.png", "data:image/png;base64,AAAA"]);
  expect(content.querySelectorAll(".md-placeholder")).toHaveLength(2);
});

it("file preview bounds very large documents and says so", () => {
  const big = "word\n".repeat(FILE_PREVIEW_MAX_CHARS / 2);
  const { html, truncated } = renderFilePreview(big);
  expect(truncated).toBe(true);
  expect(html.length).toBeLessThan(big.length * 2);
  expect(renderFilePreview("small").truncated).toBe(false);
});

it("leaves the chat renderer unchanged by the file preview's stricter sanitizer", () => {
  const input = '<img src="https://example.com/a.png" alt="x"> [web](https://example.com) <b style="color:red">b</b>';
  const before = renderMarkdown(input, false);
  renderFilePreview(input);
  expect(renderMarkdown(input, false)).toBe(before);
  const chat = parse(before);
  expect(chat.querySelector("img")?.getAttribute("src")).toBe("https://example.com/a.png");
  expect(chat.querySelector("b")?.getAttribute("style")).toBe("color:red");
});

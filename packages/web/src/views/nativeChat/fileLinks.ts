import type { FsLink } from "@perch/shared";
import { socket } from "../../ws";
import { newId } from "../../ids";
import { withHost } from "./useLastTurnChanges";

/** The core answers from the confined filesystem; a slow or lost answer just leaves the links plain. */
const TIMEOUT_MS = 8_000;
const WEB_OR_ANCHOR = /^(?:https?:|mailto:|#)/i;

/** Whether a link's target could name a file: anything but a web, mail or in-page link. The core
 * decides which of them do (`native_ui/file_links.rs`). */
export const couldBeFile = (href: string) => href !== "" && !WEB_OR_ANCHOR.test(href);

/** The link targets of rendered message HTML that could name a file, as written. */
export function linkTargets(html: string): string[] {
  if (!html.includes("href")) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const targets = new Set<string>();
  for (const anchor of Array.from(doc.querySelectorAll("a[href]"))) {
    const href = anchor.getAttribute("href")!.trim();
    if (couldBeFile(href)) targets.add(href);
  }
  return [...targets];
}

/** Ask which of `hrefs` name an existing file in the workspace. Rejects when unanswered. */
export function requestFileLinks(workspaceId: string, hostId: string, hrefs: string[]): Promise<FsLink[]> {
  return new Promise((resolve, reject) => {
    const requestId = newId();
    const timer = setTimeout(() => { stop(); reject(new Error("The file links were not answered.")); }, TIMEOUT_MS);
    const stop = socket.onMessage((message) => {
      if (!("requestId" in message) || message.requestId !== requestId) return;
      clearTimeout(timer);
      stop();
      if (message.type === "fs.links.result") resolve(message.links);
      else reject(new Error("The file links could not be checked."));
    });
    socket.send(withHost({ type: "fs.links", requestId, workspaceId, hrefs }, hostId));
  });
}

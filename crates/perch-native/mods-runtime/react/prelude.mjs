//! Evaluated before anything else in the runtime bundle: React's scheduler reads `setTimeout` and `queueMicrotask`
//! once, when it loads, so an engine without them (QuickJS) gets the host's (`perch.setTimeout`) first.
import { hostTimers } from "./dom.mjs";

const perch = globalThis.perch;
if (typeof globalThis.setTimeout !== "function" && typeof perch?.setTimeout === "function") {
  const timers = hostTimers(perch);
  globalThis.setTimeout = timers.setTimeout;
  globalThis.clearTimeout = timers.clearTimeout;
}
if (typeof globalThis.queueMicrotask !== "function") globalThis.queueMicrotask = (fn) => { Promise.resolve().then(fn); };

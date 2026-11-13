//! The React renderer: React 19 through `react-reconciler` onto the retained host tree of `dom.mjs`, so a stock
//! screen's unchanged source (`useRef`, `createPortal(..., document.body)`, `event.currentTarget.closest(...)`)
//! runs as it does in the page. After every commit the tree is described for the engine (`describe.mjs`) and handed
//! to `perch.render(description)`.
//!
//! The engine talks back through the handle `mount` returns: `dispatch(id, type, init)` runs a DOM event through
//! the tree (capture on `window`, `document` and the ancestors, the target, then bubble, with React's `on<Type>`
//! and `on<Type>Capture` props at their element), `hover(id, on)` and `focus(id)` set the interaction state the
//! cascade reads for group variants, and `flush()` runs pending effects. An event is a discrete update: React
//! commits it before `dispatch` returns.
import Reconciler from "react-reconciler";
import { ConcurrentRoot, DefaultEventPriority, DiscreteEventPriority, NoEventPriority } from "react-reconciler/constants";
import { createElement } from "react";
import { HostElement, HostText, installGlobals } from "./dom.mjs";
import { describe } from "./describe.mjs";
import { styleSheet } from "./sheet.mjs";

let currentPriority = NoEventPriority;

/** Whether new props can change what is described: a re-render passes new handler functions every time, which
 * dispatch reads live, so only a value, a `style` entry or a handler appearing or going counts. */
function styleRelevantChange(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (key === "children") continue;
    const a = before[key], b = after[key];
    if (a === b || (typeof a === "function" && typeof b === "function")) continue;
    if (key === "style" && a && b && typeof a === "object" && typeof b === "object") {
      const styleKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
      if ([...styleKeys].every((k) => a[k] === b[k])) continue;
    }
    return true;
  }
  return false;
}

const hostConfig = {
  rendererPackageName: "perch-native",
  rendererVersion: "1.0.0",
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  supportsMicrotasks: true,
  supportsResources: false,
  supportsSingletons: false,
  supportsTestSelectors: false,
  isPrimaryRenderer: true,
  noTimeout: -1,
  NotPendingTransition: null,
  HostTransitionContext: null,
  scheduleTimeout: (fn, ms) => setTimeout(fn, ms),
  cancelTimeout: (id) => clearTimeout(id),
  scheduleMicrotask: (fn) => queueMicrotask(fn),

  getRootHostContext: () => null,
  getChildHostContext: (parent) => parent,
  getPublicInstance: (instance) => instance,
  prepareForCommit: () => null,
  resetAfterCommit: (container) => container.ownerDocument?.afterCommit?.(),
  preparePortalMount: () => {},
  createInstance: (type, props, root) => new HostElement(type, props, root.ownerDocument),
  createTextInstance: (text, root) => new HostText(text),
  appendInitialChild: (parent, child) => { parent.appendChild(child); },
  finalizeInitialChildren: () => false,
  shouldSetTextContent: () => false,
  appendChild: (parent, child) => { parent.appendChild(child); },
  appendChildToContainer: (container, child) => { container.appendChild(child); },
  insertBefore: (parent, child, before) => { parent.insertBefore(child, before); },
  insertInContainerBefore: (container, child, before) => { container.insertBefore(child, before); },
  removeChild: (parent, child) => { parent.removeChild(child); },
  removeChildFromContainer: (container, child) => { container.removeChild(child); },
  clearContainer: (container) => { for (const child of [...container.childNodes]) container.removeChild(child); },
  commitUpdate: (instance, type, oldProps, newProps) => {
    instance.props = newProps;
    if (styleRelevantChange(oldProps, newProps)) instance.touch();
  },
  commitTextUpdate: (text, oldText, newText) => { text.data = String(newText); },
  commitMount: () => {},
  resetTextContent: () => {},
  hideInstance: (instance) => { instance.hidden = true; instance.touch(); },
  unhideInstance: (instance) => { instance.hidden = false; instance.touch(); },
  hideTextInstance: (text) => { text.hidden = true; },
  unhideTextInstance: (text) => { text.hidden = false; },
  detachDeletedInstance: () => {},
  beforeActiveInstanceBlur: () => {},
  afterActiveInstanceBlur: () => {},
  getInstanceFromNode: () => null,
  getInstanceFromScope: () => null,
  prepareScopeUpdate: () => {},
  setCurrentUpdatePriority: (priority) => { currentPriority = priority; },
  getCurrentUpdatePriority: () => currentPriority,
  resolveUpdatePriority: () => (currentPriority !== NoEventPriority ? currentPriority : DefaultEventPriority),
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,
  shouldAttemptEagerTransition: () => false,
  trackSchedulerEvent: () => {},
  requestPostPaintCallback: () => {},
  maySuspendCommit: () => false,
  maySuspendCommitOnUpdate: () => false,
  maySuspendCommitInSyncRender: () => false,
  preloadInstance: () => true,
  startSuspendingCommit: () => null,
  suspendInstance: () => {},
  waitForCommitToBeReady: () => null,
  getSuspendedCommitReason: () => null,
  resetFormInstance: () => {},
  bindToConsole: (method, args) => Function.prototype.bind.call(console[method], console, ...args),
};

export const reconciler = Reconciler(hostConfig);
export const createPortal = (children, container, key = null) => reconciler.createPortal(children, container, null, key);

/** React's prop for a DOM event type (`click` is `onClick`, `dblclick` `onDoubleClick`). */
const PROP = {
  click: "onClick", dblclick: "onDoubleClick", contextmenu: "onContextMenu", mousedown: "onMouseDown", mouseup: "onMouseUp", mousemove: "onMouseMove",
  pointerdown: "onPointerDown", pointerup: "onPointerUp", pointermove: "onPointerMove", pointercancel: "onPointerCancel",
  keydown: "onKeyDown", keyup: "onKeyUp", focus: "onFocus", blur: "onBlur", input: "onInput", change: "onChange",
};

/** A DOM-shaped event: what a handler in the source reads (`clientX`, `key`, `pointerType`, `currentTarget`). */
class HostEvent {
  constructor(type, init, target) {
    Object.assign(this, { clientX: 0, clientY: 0, button: 0, buttons: 0, pointerType: "mouse", key: "", code: "", shiftKey: false, metaKey: false, ctrlKey: false, altKey: false }, init);
    this.type = type;
    this.target = target;
    this.currentTarget = null;
    this.defaultPrevented = false;
    this.propagationStopped = false;
    this.timeStamp = Date.now();
  }
  get nativeEvent() { return this; }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.propagationStopped = true; }
  stopImmediatePropagation() { this.propagationStopped = true; }
  isDefaultPrevented() { return this.defaultPrevented; }
  isPropagationStopped() { return this.propagationStopped; }
  persist() {}
}

function fire(node, event, capture) {
  event.currentTarget = node;
  for (const { type, listener, capture: own } of [...(node.listeners ?? [])]) {
    if (type === event.type && own === capture) listener.call(node, event);
  }
  if (node instanceof HostElement) {
    const prop = PROP[event.type];
    const handler = prop && node.props[capture ? `${prop}Capture` : prop];
    if (typeof handler === "function") handler(event);
  }
}

/**
 * Mounts `Component` for the `perch` host and returns the engine's handle. `options.container` is the inline style
 * of the box the engine gives the screen (the card it sits on); `options.props` the component's props.
 */
export function mount(perch, Component, options = {}) {
  const { document, window } = installGlobals(perch);
  const container = new HostElement("div", { id: "root", style: options.container ?? {} }, document);
  document.body.appendChild(container);
  const errors = [];
  let description = null;
  const listening = () => [document, window].map((target) => target.listeners.map((l) => `${l.type}:${l.capture}`).sort().join(",")).join("|");
  let described = "";
  const kept = {};
  const render = () => {
    description = describe(document, perch, styleSheet(), kept, options.names);
    described = listening();
    perch.render?.(description);
    return description;
  };
  /** Runs pending effects; describes again when they changed what the source listens for on document/window
   * (a menu's outside-press listener), which the description tells the engine. */
  const settle = () => {
    reconciler.flushPassiveEffects();
    reconciler.flushSyncWork();
    if (listening() !== described) render();
  };
  document.afterCommit = render;
  const report = (error) => { errors.push(error); perch.error?.(error); };
  const root = reconciler.createContainer(container, ConcurrentRoot, null, false, null, "", report, report, report, null);
  reconciler.updateContainerSync(createElement(Component, options.props ?? {}), root, null, null);
  reconciler.flushSyncWork();
  settle();

  const byId = (id) => {
    const walk = (node) => {
      if (node.id === id) return node;
      for (const child of node.children) { const hit = walk(child); if (hit) return hit; }
      return null;
    };
    return walk(document.documentElement);
  };
  const discrete = (fn) => {
    const previous = currentPriority;
    currentPriority = DiscreteEventPriority;
    try { return fn(); } finally {
      currentPriority = previous;
      reconciler.flushSyncWork();
      settle();
    }
  };
  const handle = {
    document,
    window,
    container,
    errors,
    /** The latest description (after the last commit or state change). */
    get description() { return description; },
    describe: render,
    /** Runs a DOM event of `type` at node `id`; false when the node is gone. */
    dispatch(id, type, init = {}) {
      const target = typeof id === "string" ? byId(id) : id;
      if (!target) return false;
      const event = new HostEvent(type, init, target);
      const chain = [];
      for (let node = target; node; node = node.parentNode) chain.push(node);
      const path = [...chain, document, window];
      discrete(() => {
        for (let i = path.length - 1; i > 0 && !event.propagationStopped; i--) fire(path[i], event, true);
        if (!event.propagationStopped) { fire(target, event, true); if (!event.propagationStopped) fire(target, event, false); }
        for (let i = 1; i < path.length && !event.propagationStopped; i++) fire(path[i], event, false);
      });
      return !event.defaultPrevented;
    },
    /** The engine's box for node `id` (window coordinates, logical px), for `getBoundingClientRect`. */
    setBounds(id, box) {
      const node = byId(id);
      if (node) node.bounds = { x: box.x, y: box.y, width: box.width, height: box.height };
    },
    /** A left click as the engine reports one: press then release on the same node. */
    click(id, init = {}) {
      const at = { button: 0, buttons: 1, pointerType: "mouse", ...init };
      for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) handle.dispatch(id, type, at);
    },
    /** The pointer entered (`on`) or left node `id` (one the description marks `track_hover`): its `:hover` state,
     * which a descendant's group variant reads. The element's own `hover:` styles are the engine's hover style. */
    /** Whether the pointer is over node `id`, as `hover` last said. */
    hovered: (id) => !!byId(id)?.state.hover,
    hover(id, on) {
      const node = byId(id);
      if (!node || node.state.hover === on) return;
      node.state.hover = on;
      node.touch();
      render();
    },
    focus(id) {
      const node = byId(id);
      if (!node) return;
      discrete(() => {
        const previous = document.activeElement;
        if (previous && previous !== node && previous !== document.body) handle.dispatch(previous, "blur");
        document.focus(node);
        handle.dispatch(node, "focus");
      });
      render();
    },
    /** Runs effects React has scheduled (the engine calls it after a frame). */
    flush: settle,
    update(props) {
      reconciler.updateContainerSync(createElement(Component, props ?? {}), root, null, null);
      reconciler.flushSyncWork();
      settle();
    },
    unmount() {
      reconciler.updateContainerSync(null, root, null, null);
      reconciler.flushSyncWork();
      reconciler.flushPassiveEffects();
      document.afterCommit = null;
    },
  };
  return handle;
}

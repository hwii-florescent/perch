//! The description as gpui-kit builder chains: every key a sidebar description uses has a builder, and the
//! handlers the chains carry run the source's own handlers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, mountSidebar, THEMES } from "./support.mjs";

/** A gpui-kit stand-in that records each call, and keeps the handlers. */
function recordingKit() {
  const calls = new Map();
  const handlers = new Map();
  const make = (kind, arg) => {
    const record = { kind, arg, id: null, children: [], styles: [] };
    const proxy = new Proxy(record, {
      get(target, name) {
        if (name === "record") return target;
        return (...args) => {
          calls.set(name, (calls.get(name) ?? 0) + 1);
          if (name === "id") target.id = args[0];
          else if (name === "child") target.children.push(args[0]);
          else if (typeof args[args.length - 1] === "function" && name.startsWith("on_")) handlers.set(`${target.id}:${name}${args.length > 1 ? `:${args[0]}` : ""}`, args[args.length - 1]);
          else if (["hover", "focus", "active"].includes(name)) args[0](make("style"));
          else target.styles.push([name, ...args]);
          return proxy;
        };
      },
    });
    return proxy;
  };
  return { kit: { div: () => make("div"), svg: (path) => make("svg", path), image: (path) => make("image", path) }, calls, handlers };
}
const files = { icon: (id, markup, color) => ({ record: { id, children: [], markup, color } }) };
const cx = () => ({ notified: 0, stopped: 0, notify() { this.notified++; }, stop_propagation() { this.stopped++; } });

for (const { id: state } of fixture.states) {
  for (const theme of THEMES) {
    test(`sidebar ${state} ${theme} converts to builder calls`, async () => {
      const { handle, runtime } = await mountSidebar(state, theme);
      try {
        const { kit, calls } = recordingKit();
        runtime.describeToGpui(handle.description, kit, handle, files);
        assert.ok(calls.get("bg") > 0 && calls.get("text_color") > 0 && calls.get("on_click") > 0 && calls.get("hover") > 0);
      } finally {
        handle.unmount();
      }
    });
  }
}

test("a press and click through the builders open the session", async () => {
  const { handle, perch, runtime } = await mountSidebar("by-project", "dark");
  try {
    const { kit, handlers } = recordingKit();
    runtime.describeToGpui(handle.description, kit, handle, files);
    const find = (n) => (n.meta?.attrs["data-testid"] === "workspace-session-s-api-2" ? n : (n.children ?? []).map(find).find(Boolean));
    const button = find(handle.description.root);
    const press = cx();
    const id = `~${button.id}:workspace-session-s-api-2`;
    handlers.get(`${id}:on_mouse_down:left`)({ button: "left", click_count: 1, position: { x: 40, y: 430 }, bounds: { x: 3, y: 419.94, width: 206, height: 32 } }, press);
    assert.equal(press.stopped, 1, "the deepest handler takes the press; the tree bubbles it");
    handlers.get(`${id}:on_click`)({ click_count: 1 }, cx());
    assert.deepEqual(perch.commands, [["session.open", { id: "s-api-2" }]]);
    assert.deepEqual(handle.document.querySelector('[data-testid="workspace-session-s-api-2"]').getBoundingClientRect().toJSON(), { x: 3, y: 419.94, width: 206, height: 32 });
  } finally {
    handle.unmount();
  }
});

test("named elements get their parity names as engine ids; hidden and hover-only ones none", async () => {
  const { handle, runtime } = await mountSidebar("by-project", "dark", { names: (await import("./support.mjs")).named.elements });
  try {
    const { kit } = recordingKit();
    const ids = [];
    const walk = (el) => { if (typeof el === "string") return; const r = el.record; if (r.id) ids.push(r.id); r.children.forEach(walk); };
    const icons = [];
    const walkIcons = (el) => { if (typeof el === "string") return; if (el.record.markup) icons.push(el.record); el.record.children.forEach(walkIcons); };
    walk(runtime.describeToGpui(handle.description, kit, handle, files));
    for (const id of ["sidebar-root", "project-header:p-perch", "session-button:s-perch-3", "new-session-label", "chats-label", "host-badge"]) assert.ok(ids.includes(id), id);
    assert.equal(ids.filter((id) => id === "chats-label").length, 1);
    walkIcons(runtime.describeToGpui(handle.description, kit, handle, files));
    assert.ok(icons.length > 10 && icons.every((icon) => icon.markup.startsWith("<svg") && /^#[0-9a-f]{8}$/.test(icon.color)), "icons are drawn from markup in their text colour");
    assert.ok(!ids.some((id) => id.startsWith("session-close-button:") || id.startsWith("project-menu-button:")), "hover-only buttons at rest are not shown elements");
  } finally {
    handle.unmount();
  }
});

/** The records of a built tree, by engine id. */
function byId(el, out = new Map()) {
  if (typeof el === "string") return out;
  if (el.record.id) out.set(el.record.id, el.record);
  el.record.children.forEach((child) => byId(child, out));
  return out;
}

test("a row item with wrappable text can shrink below its text; nowrap and truncated text cannot", async () => {
  const { handle, runtime } = await mountSidebar("offline-host", "light", { names: (await import("./support.mjs")).named.elements });
  try {
    const records = byId(runtime.describeToGpui(handle.description, recordingKit().kit, handle, files));
    const minW = (id) => records.get(id)?.styles.some(([name, value]) => name === "min_w" && value === 0);
    assert.ok(minW("status-heading-label:status-section-title-offline"), "the offline heading's label wraps as on the web");
    assert.ok(!minW("host-badge"), "a nowrap badge keeps its width");
  } finally {
    handle.unmount();
  }
});

test("an icon takes its button's hover colour while the pointer is over it", async () => {
  const { handle, runtime } = await mountSidebar("by-project", "dark", { names: (await import("./support.mjs")).named.elements });
  try {
    const find = (n) => (n.name === "organize-button" ? n : (n.children ?? []).map(find).find(Boolean));
    const button = find(handle.description.root);
    assert.ok(button?.hover?.text_color, "the organize button changes its text colour on hover");
    const iconColor = () => {
      const { kit, handlers } = recordingKit();
      const record = byId(runtime.describeToGpui(handle.description, kit, handle, files)).get("organize-button");
      const icons = [];
      const walk = (r) => { if (r.markup) icons.push(r.color); r.children.forEach((c) => typeof c !== "string" && walk(c.record)); };
      walk(record);
      return { color: icons[0], hover: handlers.get("organize-button:on_hover") };
    };
    const rest = iconColor();
    assert.ok(rest.hover, "the button reports the pointer");
    assert.notEqual(rest.color, button.hover.text_color);
    rest.hover(true, cx());
    assert.equal(iconColor().color, button.hover.text_color);
  } finally {
    handle.unmount();
  }
});

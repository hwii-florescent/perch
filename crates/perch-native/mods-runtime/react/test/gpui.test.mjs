//! The description as gpui-kit builder chains: every key a sidebar description uses has a builder, and the
//! handlers the chains carry run the source's own handlers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, mountSidebar, THEMES } from "./support.mjs";
import { breakLines, scrollGutters, shrinkWrapBases, snapColumns, snapRows, toGpui } from "../gpui.mjs";

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
          else if (name === "group_hover") { const style = make("style"); args[1](style); target.styles.push([name, args[0], style.record.styles]); }
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
    const { kit, handlers } = recordingKit();
    const record = byId(runtime.describeToGpui(handle.description, kit, handle, files)).get("organize-button");
    const group = record.styles.find(([name]) => name === "group")?.[1];
    assert.ok(group, "the button is a hover group");
    assert.ok(!handlers.has("organize-button:on_hover"), "the pointer is not reported to the script");
    // Each icon is drawn twice: in its colour at rest, and in the hover colour shown while the group is hovered.
    const icons = [];
    const walk = (r, shownOnHover) => {
      if (r.markup) icons.push({ color: r.color, shownOnHover });
      const toggles = r.styles?.find(([name, over]) => name === "group_hover" && over === group);
      const shown = toggles ? toggles[2].some(([name]) => name === "visible") : shownOnHover;
      r.children.forEach((c) => typeof c !== "string" && walk(c.record, shown));
    };
    walk(record, false);
    assert.ok(icons.some((i) => !i.shownOnHover && i.color !== button.hover.text_color), "at rest, its own colour");
    assert.ok(icons.some((i) => i.shownOnHover && i.color === button.hover.text_color), "over it, the hover colour");
  } finally {
    handle.unmount();
  }
});

test("lengths stacked in a column follow the exact running total on device pixels; unknown heights restart it", () => {
  const box = (style, children = []) => ({ kind: "div", style, children });
  const line = (text) => box({ whitespace: "nowrap", text_size: 12.5, line_height: 1.3 }, [{ kind: "text", text }]);
  const rows = Array.from({ length: 10 }, (_, i) => box({ pt: 3, pb: 3 }, [line(`row ${i}`)]));
  const wrapping = box({}, [{ kind: "text", text: "may wrap" }]);
  const root = box({ display: "flex", flex_direction: "col", gap_y: 2 }, [...rows, wrapping, ...rows.slice(0, 2).map((r) => ({ ...r }))]);
  const snapped = snapColumns([root], 2);
  let laid = 0;
  rows.forEach((row, i) => {
    const s = snapped.get(row);
    laid += s.mt + s.h + s.mb;
    const exact = (i + 1) * 22.25 + i * 2;
    assert.ok(Math.abs(laid - exact) <= 0.25, `row ${i}: laid ${laid}, exact ${exact}`);
    assert.equal((s.h * 2) % 1, 0, "on device pixels");
  });
  assert.equal(snapped.get(root).gap_y, 0, "the gap is carried in the margins");
  assert.equal(snapped.get(wrapping)?.h, undefined, "wrapping text keeps its own height");
  assert.equal(snapped.get(root.children[11]).h, 22.5, "the total restarts after it");
});

test("a packed row lays its items on device pixels by their measured text widths", () => {
  const box = (style, children = []) => ({ kind: "div", style, children });
  const text = (t) => ({ kind: "text", text: t });
  // Each character measures 6.3px: a chip of "ab" is 12.6 wide plus 4.25 padding each side.
  const measure = (t) => t.length * 6.3;
  const chip = () => box({ pl: 4.25, pr: 4.25, whitespace: "nowrap", text_size: 12 }, [text("ab")]);
  const chips = [chip(), chip(), chip()];
  const row = box({ display: "flex", gap_x: 3 }, chips);
  const overrides = new Map();
  snapRows([row], 2, measure, overrides);
  assert.equal(overrides.get(row).gap_x, 0, "the gap is carried in the margins");
  let laid = 0;
  chips.forEach((c, i) => {
    const o = overrides.get(c);
    laid += (o.ml ?? 0) + o.w + (o.mr ?? 0);
    assert.equal((o.w * 2) % 1, 0, "on device pixels");
    const exact = (i + 1) * 21.1 + i * 3;
    assert.ok(Math.abs(laid - exact) <= 0.25, `chip ${i}: laid ${laid}, exact ${exact}`);
  });
  // Text that may wrap, or whose width is not known, is left to GPUI.
  const wraps = box({ display: "flex" }, [box({}, [text("two words")]), box({}, [text("x")])]);
  const left = new Map();
  snapRows([wraps], 2, () => NaN, left);
  assert.equal(left.get(wraps.children[0])?.w, undefined);
});

test("a box sized by its own text neither wraps nor shrinks, and an auto margin keeps the row's gap", () => {
  const box = (style, children = []) => ({ kind: "div", style, children });
  const text = (t) => ({ kind: "text", text: t });
  // "perch" measures 36.08px, which a device pixel rounds to 36: under the line GPUI lays the text in.
  const measure = (t) => (t === "perch" ? 36.08 : 7);
  const label = box({ flex_shrink: 0 }, [text("perch")]);
  const key = box({}, [text("1")]);
  const detail = box({ ml: "auto", min_w: 0, text_ellipsis: true }, [text("/Users/dev/code/perch")]);
  const row = box({ display: "flex", gap_x: 8, whitespace: "nowrap", text_size: 12 }, [label, detail, key]);
  const overrides = new Map();
  snapRows([row], 2, measure, overrides);
  assert.equal(overrides.get(label).whitespace, "nowrap", "the label's text cannot break");
  assert.equal(overrides.get(key).whitespace, "nowrap");
  assert.equal(overrides.get(key).flex_shrink, 0, "a squeezed row cannot shrink it below its text");
  assert.equal(overrides.get(detail)?.flex_shrink, undefined, "the item that may shrink still does");
  assert.equal(overrides.get(row).gap_x, undefined, "an auto margin cannot hold the gap, so the row keeps its own");
});

test("a line that ends in an ellipsis lays the boxes inside it on device pixels; its own text is left to GPUI", () => {
  const box = (style, children = []) => ({ kind: "div", style, children });
  const text = (t) => ({ kind: "text", text: t });
  const measure = (t) => t.length * 6.3;
  const row = { display: "flex" };
  // A path's crumbs: "/" then one span per folder holding its button and a "/".
  const crumb = (name) => box(row, [box({}, [text(name)]), text("/")]);
  const crumbs = [crumb("Users"), crumb("dev")];
  const line = box({ ...row, text_ellipsis: true, whitespace: "nowrap", text_size: 11.52, flex_grow: 1 }, [text("/"), ...crumbs]);
  const overrides = new Map();
  snapRows([box(row, [line])], 2, measure, overrides);
  assert.equal(overrides.get(line.children[0])?.w, undefined, "the line's own text may be cut");
  for (const c of crumbs) {
    assert.ok(Number.isFinite(overrides.get(c)?.w), "a crumb's width is known");
    assert.ok(Number.isFinite(overrides.get(c.children[0])?.w), "its button's too");
  }
});

test("a scroller whose known content overflows its room makes room for the scrollbar", () => {
  const box = (style, children = []) => ({ kind: "div", style, children });
  const rows = Array.from({ length: 5 }, () => box({ h: 30 }));
  const list = box({ overflow_y: "scroll", pr: 4 }, rows);
  list.scrollbar = 8;
  const header = box({ h: 40 });
  const panel = box({ display: "flex", flex_direction: "col", max_h: 160 }, [header, list]);
  const heights = new Map([...rows, header].map((n) => [n, n.style.h]));
  const overrides = Object.assign(new Map(), { heights });
  scrollGutters([panel], overrides);
  assert.equal(overrides.get(list)?.pr, 12, "150 of content in 120 of room: the bar's width is added");

  const short = box({ overflow_y: "scroll" }, rows.slice(0, 3));
  short.scrollbar = 8;
  const roomy = box({ display: "flex", flex_direction: "col", max_h: 160 }, [header, short]);
  const fits = Object.assign(new Map(), { heights });
  scrollGutters([roomy], fits);
  assert.equal(fits.get(short), undefined, "content that fits takes no room");
});

test("rows whose wrapping text has no known height still overflow by what is known of them", () => {
  const box = (style, children = []) => ({ kind: "div", style, children });
  // Each row: a 20 px key chip beside a description that may wrap (its height is not known).
  const row = () => box({ display: "flex", pt: 2, pb: 2 }, [box({ h: 20 }), box({}, [{ kind: "text", text: "may wrap here" }])]);
  const chips = (rows) => rows.map((r) => r.children[0]);
  const many = Array.from({ length: 10 }, row);
  const list = box({ overflow_y: "scroll" }, many);
  list.scrollbar = 8;
  const panel = box({ display: "flex", flex_direction: "col", max_h: 200 }, [list]);
  const overrides = Object.assign(new Map(), { heights: new Map(chips(many).map((n) => [n, 20])) });
  scrollGutters([panel], overrides);
  assert.equal(overrides.get(list)?.pr, 8, "at least 240 of content in 200 of room");

  const few = Array.from({ length: 5 }, row);
  const short = box({ overflow_y: "scroll" }, few);
  short.scrollbar = 8;
  const fits = Object.assign(new Map(), { heights: new Map(chips(few).map((n) => [n, 20])) });
  scrollGutters([box({ display: "flex", flex_direction: "col", max_h: 200 }, [short])], fits);
  assert.equal(fits.get(short), undefined, "at least 120 may fit in 200: left alone");
});

test("boxes of wrapping text in whole-pixel lines keep the column's running total", () => {
  const box = (style, children = []) => ({ kind: "div", style, children });
  const items = Array.from({ length: 8 }, () => box({ pt: 7.2, pb: 7.2, line_height: "16px", text_size: 13.12 }, [{ kind: "text", text: "may wrap here" }]));
  const root = box({ pt: 4.8 }, items);
  const snapped = snapColumns([root], 2);
  let laid = snapped.get(root).pt;
  items.forEach((item, i) => {
    const s = snapped.get(item);
    laid += s.pt + 16 + s.pb;
    const exact = 4.8 + (i + 1) * 30.4;
    assert.ok(Math.abs(laid - exact) <= 0.25, `item ${i}: laid ${laid}, exact ${exact}`);
    assert.equal(s.h, undefined, "its height stays GPUI's");
  });
});

test("a row in a box sized by its content sizes a growing item by its content", () => {
  const box = (style, children = []) => ({ kind: "div", style, children });
  const field = { kind: "input", style: { flex_grow: 1, flex_basis: 0, min_w: 0 }, children: [] };
  const row = box({ display: "flex" }, [field, box({})]);
  const menu = box({ position: "absolute", left: 10, top: 10 }, [row]);
  const overrides = new Map();
  shrinkWrapBases([menu], overrides);
  assert.equal(overrides.get(field)?.flex_basis, "auto");
  const sized = box({ position: "absolute", left: 10, top: 10, w: 200 }, [box({ display: "flex" }, [{ ...field }])]);
  const kept = new Map();
  shrinkWrapBases([sized], kept);
  assert.equal(kept.size, 0, "a box with a width of its own leaves the basis alone");
});

test("text that breaks anywhere is broken as a browser does where its box's width is known", () => {
  const text = { kind: "text", text: "Discard all in /a/long-path/xyzxyzxyzxyz?" };
  const message = { kind: "div", break_anywhere: true, style: { text_size: 10, line_height: 1.5 }, children: [text] };
  const panel = { kind: "div", style: { display: "flex", flex_direction: "col", w: 120, pl: 10, pr: 10 }, children: [message] };
  const overrides = new Map();
  // Every character is 6px wide: 16 to a 100px line.
  breakLines([panel], (t) => t.length * 6, overrides);
  // The path moves to its own line, breaks after its hyphen, and a word longer than a line breaks anywhere.
  assert.equal(overrides.get(text).text, "Discard all in\n/a/long-\npath/xyzxyzxyzxy\nz?");
  assert.equal(overrides.get(message).h, 4 * 15, "four lines of CSS line height");
  const unknown = new Map();
  breakLines([{ ...panel, style: { display: "flex", flex_direction: "col" } }], (t) => t.length * 6, unknown);
  assert.equal(unknown.size, 0, "no width, no breaks");
});

test("a named text run in a flex column is as wide as its glyphs, where its alignment puts it", () => {
  const { kit } = recordingKit();
  const column = (text_align) => ({
    kind: "div", id: "b", range_name: "name", style: { display: "flex", flex_direction: "col", text_align },
    children: [{ kind: "text", text: "perch" }, { kind: "div", id: "s", style: {}, children: [{ kind: "text", text: "/work" }] }],
  });
  const runBox = (align) => {
    const built = toGpui(column(align), kit, {}, files, false, false, null, { text_align: align }).record;
    return built.children.map((c) => c.record).find((c) => c?.id === "name");
  };
  assert.deepEqual(runBox("left").styles.map(([name]) => name), ["self_start", "max_w"]);
  assert.deepEqual(runBox("center").styles.map(([name]) => name), ["self_center", "max_w"]);
  const row = toGpui({ ...column("left"), style: { display: "flex" } }, kit, {}, files).record;
  assert.deepEqual(row.children.map((c) => c.record).find((c) => c?.id === "name").styles, [], "a row lays it out as it is");
});

test("a box over the page takes the wheel: an overlay root and a pointer-taking card do, a pass-through overlay does not", () => {
  const wheelOn = (node, overlay) => {
    const { kit, handlers } = recordingKit();
    toGpui({ kind: "div", children: [], style: {}, ...node }, kit, { document: null }, files, overlay);
    return [...handlers.keys()].some((key) => key.endsWith(":on_scroll_wheel"));
  };
  assert.equal(wheelOn({ id: 1 }, true), true, "a dialog's backdrop");
  assert.equal(wheelOn({ id: 2, pointer_none: true }, true), false, "a toast stack lets the wheel through");
  assert.equal(wheelOn({ id: 3, blocks_pointer: true }, false), true, "a toast card");
  assert.equal(wheelOn({ id: 4 }, false), false, "a plain box");
});

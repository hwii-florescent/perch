//! The unchanged stock sidebar on the native runtime, against the web reference: for every fixture state in light
//! and dark, the description has every named element instance the page has (and hides the same ones), with the
//! same text, colours (value and theme token), font size, weight and line height and opacity; and its events work.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, lineHeightPx, mountSidebar, namedInstances, opacity, THEMES, tree } from "./support.mjs";

const COLOUR_KEYS = { backgroundColor: "bg", borderTopColor: "border_t", borderRightColor: "border_r", borderBottomColor: "border_b", borderLeftColor: "border_l" };
const round = (n) => Math.round(n * 100) / 100;

for (const { id: state } of fixture.states) {
  for (const theme of THEMES) {
    test(`sidebar ${state} ${theme} matches the web reference`, async () => {
      const { ref, handle } = await mountSidebar(state, theme);
      try {
        assert.deepEqual(handle.errors, []);
        const { instances, hiddenCounts } = namedInstances(tree(handle.description));
        const id = (name, key, index) => `${name}#${key ?? index}`;
        const got = new Map(instances.map((i) => [id(i.def.name, i.key, i.index), i]));
        assert.deepEqual([...got.keys()].sort(), ref.elements.map((e) => id(e.name, e.key, e.index)).sort(), "named element instances");
        assert.deepEqual(hiddenCounts, ref.hiddenCounts, "hidden instances");

        const problems = [];
        for (const want of ref.elements) {
          const { el, def } = got.get(id(want.name, want.key, want.index));
          const where = id(want.name, want.key, want.index);
          if (want.text !== undefined) {
            const text = el.text(!!def.textRange);
            if (text !== want.text) problems.push(`${where} text ${JSON.stringify(text)}, web ${JSON.stringify(want.text)}`);
          }
          if (opacity(el) !== (want.opacity ?? 1)) problems.push(`${where} opacity ${opacity(el)}, web ${want.opacity ?? 1}`);
          const colours = {};
          if (def.text || el.tagName === "svg") colours.color = el.inherited("text_color");
          for (const [prop, side] of Object.entries(COLOUR_KEYS)) {
            if (prop === "backgroundColor") { if (el.node.style.bg) colours[prop] = { value: el.node.style.bg, token: el.node.tokens.bg ?? null }; continue; }
            if (el.node.style[side]) colours[prop] = { value: el.node.style.border_color, token: el.node.tokens.border_color ?? null };
          }
          for (const prop of new Set([...Object.keys(colours), ...Object.keys(want.colors)])) {
            if (JSON.stringify(colours[prop]) !== JSON.stringify(want.colors[prop])) problems.push(`${where} ${prop} ${JSON.stringify(colours[prop])}, web ${JSON.stringify(want.colors[prop])}`);
          }
          if (want.font) {
            const font = { size: round(el.inherited("text_size").value), weight: el.inherited("font_weight").value, lineHeight: round(lineHeightPx(el)) };
            const web = { size: want.font.size, weight: want.font.weight, lineHeight: want.font.lineHeight };
            if (JSON.stringify(font) !== JSON.stringify(web)) problems.push(`${where} font ${JSON.stringify(font)}, web ${JSON.stringify(web)}`);
            if (el.inherited("font_family").value !== ".SystemUIFont") problems.push(`${where} family ${el.inherited("font_family").value}`);
          }
        }
        assert.deepEqual(problems, []);
        for (const entry of handle.description.unsupported) assert.ok(entry.class && entry.elements.length, `an unsupported entry names its class and element: ${JSON.stringify(entry)}`);
      } finally {
        handle.unmount();
      }
    });
  }
}

/** The description node of a named element instance. */
function find(handle, name, key) {
  const { instances } = namedInstances(tree(handle.description));
  const hit = instances.find((i) => i.def.name === name && (key === undefined || i.key === key));
  assert.ok(hit, `no ${name} ${key ?? ""}`);
  return hit.el;
}

test("a project header click folds the project, and again unfolds it", async () => {
  const { handle, perch } = await mountSidebar("by-project", "dark");
  try {
    assert.ok(find(handle, "project-workspaces", "p-perch"));
    handle.click(find(handle, "project-header", "p-perch").node.id);
    const { instances } = namedInstances(tree(handle.description));
    assert.equal(instances.some((i) => i.def.name === "project-workspaces" && i.key === "p-perch"), false, "folded: its workspaces are gone");
    assert.equal(find(handle, "project-toggle", "p-perch").getAttribute("aria-expanded"), "false");
    assert.deepEqual(JSON.parse(perch.storage.getItem("perch.sidebar.collapsedProjects")), ["p-perch"], "kept per viewer");
    handle.click(find(handle, "project-toggle", "p-perch").node.id);
    assert.ok(find(handle, "project-workspaces", "p-perch"), "unfolded again from the toggle button");
    assert.deepEqual(perch.commands, [], "folding is arrangement, not a command");
  } finally {
    handle.unmount();
  }
});

test("a lead's chevron folds its sub-sessions, keeps the fold per viewer and unfolds them again", async () => {
  const { handle, perch } = await mountSidebar("family-unfolded", "dark");
  try {
    const rows = () => namedInstances(tree(handle.description)).instances.filter((i) => i.def.name === "session-row").map((i) => i.key);
    assert.deepEqual(rows().filter((key) => key.startsWith("s-fam-")).sort(), ["s-fam-kid-1", "s-fam-kid-2", "s-fam-lead"]);
    assert.equal(namedInstances(tree(handle.description)).instances.filter((i) => i.def.name === "session-elbow").length, 2, "an elbow for each sub-session");
    handle.click(find(handle, "session-fold-button", "s-fam-lead").node.id);
    assert.deepEqual(rows().filter((key) => key.startsWith("s-fam-")), ["s-fam-lead"], "folded: only the lead stays");
    assert.equal(find(handle, "session-fold-button", "s-fam-lead").getAttribute("aria-expanded"), "false");
    assert.deepEqual(JSON.parse(perch.storage.getItem("perch.sidebar.foldedSessions")), ["s-fam-lead"], "kept per viewer");
    handle.click(find(handle, "session-fold-button", "s-fam-lead").node.id);
    assert.equal(rows().filter((key) => key.startsWith("s-fam-")).length, 3, "unfolded again");
    assert.deepEqual(JSON.parse(perch.storage.getItem("perch.sidebar.foldedSessions")), []);
    assert.deepEqual(perch.commands, [], "folding is arrangement, not a command");
  } finally {
    handle.unmount();
  }
});

test("a folded lead shows the state of the sub-sessions it hides", async () => {
  const { handle } = await mountSidebar("family-folded", "dark");
  try {
    const rollup = find(handle, "session-rollup", "s-fam-lead");
    assert.equal(rollup.text(), "Needs you");
  } finally {
    handle.unmount();
  }
});

test("a session row's menu button opens the host's session menu for that row, below the button", async () => {
  const { handle, perch } = await mountSidebar("family-open-child", "dark");
  try {
    const button = find(handle, "session-menu-button", "s-fam-kid-1");
    handle.setBounds(button.node.id, { x: 200, y: 100, width: 24, height: 24 });
    handle.click(button.node.id);
    const [open] = perch.overlays;
    assert.equal(open?.kind, "session-menu");
    assert.equal(open.props.id, "s-fam-kid-1");
    assert.deepEqual([open.props.x, open.props.y], [200, 128], "anchored at the button");
    assert.equal(perch.commands.length, 0, "opening the menu closes nothing");
  } finally {
    handle.unmount();
  }
});

test("a session row click opens the session through the host", async () => {
  const { handle, perch } = await mountSidebar("by-project", "dark");
  try {
    handle.click(find(handle, "session-button", "s-perch-3").node.id);
    assert.deepEqual(perch.commands, [["session.open", { id: "s-perch-3" }]]);
  } finally {
    handle.unmount();
  }
});

test("hovering a project header reveals its row actions through a hover group the engine draws", async () => {
  const { handle } = await mountSidebar("by-project", "dark");
  try {
    const header = find(handle, "project-header", "p-api");
    const group = header.node.group;
    assert.ok(group, "the header is a hover group");
    assert.ok(!(header.node.events ?? []).includes("hover"), "the pointer is not reported to the script");
    // The description as the engine draws it while the pointer is over the group: every `group_hover` of it applied.
    const over = (node) => node.kind === "text" ? node : {
      ...node,
      style: { ...node.style, ...Object.assign({}, ...(node.group_hover ?? []).filter((g) => g.group === group).map((g) => g.style)) },
      children: (node.children ?? []).map(over),
    };
    const before = namedInstances(tree(handle.description)).hiddenCounts["project-menu-button"];
    const hovered = namedInstances(tree({ ...handle.description, root: over(handle.description.root) }));
    assert.equal(hovered.hiddenCounts["project-menu-button"] ?? 0, before - 1, "the hovered project's menu button shows");
    assert.equal(namedInstances(tree(handle.description)).hiddenCounts["project-menu-button"], before, "at rest it stays hidden");
  } finally {
    handle.unmount();
  }
});

test("a button's own hover colour is an engine hover style, with its token", async () => {
  const { handle } = await mountSidebar("by-project", "dark");
  try {
    const add = find(handle, "add-project-button");
    assert.deepEqual(add.node.hover, { bg: "#262626ff", text_color: "#d8d8d8ff" });
    assert.deepEqual(add.node.hover_tokens, { bg: "surface-0", text_color: "text" });
  } finally {
    handle.unmount();
  }
});

test("the organize menu opens in the overlay layer and switches the view", async () => {
  const { handle, perch } = await mountSidebar("by-project", "dark");
  try {
    handle.click(find(handle, "organize-button").node.id);
    const [menu] = handle.description.overlays;
    assert.equal(menu?.meta.attrs["data-testid"], "row-menu", "the menu is portalled into the overlay layer");
    assert.equal(menu.style.position, "absolute");
    assert.ok(handle.description.document_events.includes("mouse_down"), "an outside press closes it: the host reports presses");
    const item = (testId) => menu.children.find((child) => child.meta?.attrs["data-testid"] === testId);
    assert.equal(item("workspace-organize-project").children[0].text, "✓ By project");
    handle.click(item("workspace-organize-status").id);
    assert.equal(handle.description.overlays.length, 0, "choosing closes the menu");
    assert.equal(find(handle, "overview-title").text(), "Sessions");
    assert.equal(perch.storage.getItem("perch.sidebar.organize"), "status");
  } finally {
    handle.unmount();
  }
});

test("a session row's drag is the web's: it slides with the forwarded pointer and moves the row once, on release", async () => {
  const { handle, perch } = await mountSidebar("by-project", "dark");
  const navigation = { ...perch.navigation(), reorderable: true };
  perch.navigation = () => navigation;
  const follows = [];
  perch.followPointer = (event) => { follows.push([event.clientX, event.clientY]); return true; };
  try {
    handle.update({});
    const zones = handle.document.querySelectorAll("[data-reorder-id]");
    const groups = new Map();
    for (const zone of zones) {
      const group = zone.dataset.reorderGroup;
      groups.set(group, [...(groups.get(group) ?? []), zone]);
    }
    const rows = [...groups.values()].find((list) => list.length >= 3 && list[0].querySelector("button[data-testid^='workspace-session-']:not([data-testid^='workspace-session-close-'])"));
    assert.ok(rows, `a group of three session rows: ${JSON.stringify([...groups].map(([g, l]) => [g, l.map((z) => z.dataset.reorderId)]))}`);
    // Where the engine laid the rows out, a row every 30 px.
    rows.forEach((row, i) => handle.setBounds(row.id, { x: 0, y: 100 + i * 30, width: 240, height: 28 }));
    handle.setBounds(rows[0].parentElement.id, { x: 0, y: 100, width: 240, height: 30 * rows.length });
    const ids = rows.map((row) => row.dataset.reorderId);
    const button = rows[1].querySelector("button[data-testid^='workspace-session-']:not([data-testid^='workspace-session-close-'])");
    const at = (y, buttons = 1) => ({ clientX: 100, clientY: y, button: 0, buttons, pointerType: "mouse", pointerId: 1 });
    handle.dispatch(button, "pointerdown", at(114));
    assert.deepEqual(follows, [[100, 114]], "the press asks the window to forward the pointer");
    handle.dispatch(handle.document.body, "pointermove", at(116));
    assert.equal(rows[1].style.transform, "", "a few pixels are still a press");
    handle.dispatch(handle.document.body, "pointermove", at(190));
    assert.equal(rows[2].style.transform, "translateY(-30px)", "the next row slides up into its place");
    assert.equal(rows[1].style.transform, "translateY(30px)", "the dragged row follows the pointer, kept inside the list");
    assert.deepEqual(perch.commands, [], "nothing is written while dragging");
    handle.dispatch(handle.document.body, "pointerup", at(190, 0));
    assert.deepEqual(perch.commands.map(([name, args]) => [name, args.id, args.target, args.after]), [["session.move", ids[1], ids[2], true]]);
    assert.equal(rows[1].style.transform, "", "the styles are put back");

    // Escape ends a drag with nothing written.
    perch.commands.length = 0;
    handle.dispatch(button, "pointerdown", at(114));
    handle.dispatch(handle.document.body, "pointermove", at(190));
    handle.dispatch(handle.document.body, "pointercancel", at(190, 0));
    handle.dispatch(handle.document.body, "pointerup", at(190, 0));
    assert.deepEqual(perch.commands, [], "a cancelled drag writes nothing");
    assert.equal(rows[2].style.transform, "");
  } finally {
    handle.unmount();
  }
});

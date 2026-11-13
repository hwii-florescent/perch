// Icons drawn as native paths from the same SVG path data the web's `icons.tsx` and
// `AgentIcon.tsx` use, so a shape is one string in one place. gpui strokes with butt caps and
// miter joins (the web rounds them): a visible but small difference at these sizes.
import { div, PathBuilder } from "gpui-kit";
import { ART, row, mix } from "./kit.js";

const NUMBER = /[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/y;
const ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };

/** The commands of SVG path data `d`, each as [letter, arguments]; arc flags may be unseparated. */
function* commands(d) {
  let at = 0;
  let current = null;
  const skip = () => { while (at < d.length && /[\s,]/.test(d[at])) at++; };
  const number = () => {
    skip();
    NUMBER.lastIndex = at;
    const found = NUMBER.exec(d);
    if (!found) throw new Error(`bad path data near "${d.slice(at, at + 12)}"`);
    at = NUMBER.lastIndex;
    return parseFloat(found[0]);
  };
  const flag = () => {
    skip();
    if (d[at] !== "0" && d[at] !== "1") throw new Error(`bad arc flag near "${d.slice(at, at + 12)}"`);
    return d[at++] === "1" ? 1 : 0;
  };
  for (;;) {
    skip();
    if (at >= d.length) return;
    if (/[a-zA-Z]/.test(d[at])) {
      current = d[at++];
      if (current === "z" || current === "Z") { yield [current, []]; current = null; continue; }
    } else if (!current) {
      throw new Error(`path data without a command near "${d.slice(at, at + 12)}"`);
    }
    const kind = current.toUpperCase();
    const args = kind === "A"
      ? [number(), number(), number(), flag(), flag(), number(), number()]
      : Array.from({ length: ARITY[kind] }, number);
    yield [current, args];
    if (current === "M") current = "L";
    else if (current === "m") current = "l";
  }
}

/** A native path for SVG path data `d`, scaled by `k` (px per path unit). */
function build(d, k, stroke) {
  const b = stroke ? PathBuilder.stroke(stroke * k) : PathBuilder.fill();
  let x = 0, y = 0, startX = 0, startY = 0, ctrlX = 0, ctrlY = 0, last = "";
  for (const [letter, a] of commands(d)) {
    const rel = letter === letter.toLowerCase();
    const kind = letter.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (kind === "Z") { b.close(); x = startX; y = startY; last = kind; continue; }
    if (kind === "M") { x = ox + a[0]; y = oy + a[1]; startX = x; startY = y; b.move_to(x * k, y * k); }
    else if (kind === "L") { x = ox + a[0]; y = oy + a[1]; b.line_to(x * k, y * k); }
    else if (kind === "H") { x = ox + a[0]; b.line_to(x * k, y * k); }
    else if (kind === "V") { y = oy + a[0]; b.line_to(x * k, y * k); }
    else if (kind === "C" || kind === "S") {
      const smooth = kind === "S";
      // The first control point of S is the last one reflected (or the current point).
      const [c1x, c1y] = smooth ? (last === "C" || last === "S" ? [2 * x - ctrlX, 2 * y - ctrlY] : [x, y]) : [ox + a[0], oy + a[1]];
      const n = smooth ? 0 : 2;
      ctrlX = ox + a[n]; ctrlY = oy + a[n + 1];
      x = ox + a[n + 2]; y = oy + a[n + 3];
      b.cubic_bezier_to(x * k, y * k, c1x * k, c1y * k, ctrlX * k, ctrlY * k);
    } else if (kind === "Q") {
      ctrlX = ox + a[0]; ctrlY = oy + a[1]; x = ox + a[2]; y = oy + a[3];
      b.curve_to(x * k, y * k, ctrlX * k, ctrlY * k);
    } else if (kind === "A") {
      x = ox + a[5]; y = oy + a[6];
      b.arc_to(a[0] * k, a[1] * k, a[2], !!a[3], !!a[4], x * k, y * k);
    } else throw new Error(`unsupported path command ${letter}`);
    last = kind;
  }
  return b.build();
}

/** A circle as path data. */
const circle = (cx, cy, r) => `M${cx + r} ${cy}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0Z`;

// Each icon: its viewBox, and its layers (`stroke` is a stroke width in viewBox units, else filled).
const ICONS = {
  plus: { box: 16, layers: [{ d: "M8 2.5v11M2.5 8h11", stroke: 1.5 }] },
  ellipsis: { box: 16, layers: [{ d: circle(3.5, 8, 1.1) + circle(8, 8, 1.1) + circle(12.5, 8, 1.1) }] },
  gear: { box: 16, layers: [{ d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" + circle(8, 8, 2), stroke: 1.3 }] },
  chevronOpen: { box: 12, layers: [{ d: "M2.5 4.5 6 8l3.5-3.5", stroke: 1.3 }] },
  chevronClosed: { box: 12, layers: [{ d: "M4.5 2.5 8 6l-3.5 3.5", stroke: 1.3 }] },
  folder: { box: 16, layers: [{ d: "M2 5V4a1 1 0 0 1 1-1h3l2 2h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5Z", stroke: 1.3 }] },
  close: { box: 12, layers: [{ d: "m3 3 6 6m0-6-6 6", stroke: 1.3 }] },
  newChat: { box: 16, layers: [{ d: "M8 3H4.5A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13h7a1.5 1.5 0 0 0 1.5-1.5V8M11.2 2.8a1.2 1.2 0 0 1 1.7 1.7L8.5 8.9 6 9.5l.6-2.5z", stroke: 1.3 }] },
  diamond: { box: 16, layers: [{ d: "M8 3l5 5-5 5-5-5z", stroke: 1.3 }] },
  branch: { box: 16, layers: [{ d: circle(4, 3, 1.5) + circle(4, 13, 1.5) + circle(12, 3, 1.5) + "M4 4.5v7M4 9h4a4 4 0 0 0 4-4v-.5", stroke: 1.3 }] },
  organize: { box: 16, layers: [{ d: "M2.5 4.5h11M4.5 8h7M6.5 11.5h3", stroke: 1.3 }] },
};

/**
 * The icon `name` at `size` px in `color`: a path element (the web's `svg`, which is exactly its
 * nominal size). `filled` adds the fill under a stroked folder.
 */
export function icon(name, size, color, { filled = false } = {}) {
  const spec = ICONS[name];
  const k = size / spec.box;
  const layers = spec.layers.map((layer) => ({ ...layer }));
  if (filled) layers.unshift({ d: layers[0].d });
  const paint = (layer) => window.paint_path(build(layer.d, k, layer.stroke), color);
  if (layers.length === 1) return paint(layers[0]).w(size).h(size).flex_shrink(0).text_color(color);
  return div().relative().w(size).h(size).flex_shrink(0).text_color(color)
    .children(layers.map((layer) => paint(layer).absolute().top(0).left(0).w(size).h(size)));
}

// The agent artwork (`AgentIcon.tsx`), 24-unit viewBox.
const CLAUDE = "M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z";
const OPENAI = "M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z";

/**
 * The agent's mark at the start of a session row: a round box of `box` px holding the 14 px
 * artwork. `iconName` / `markName` are the parity names of the artwork and of the box; Claude's
 * sits on a dark disc, as on the web; a harness with no artwork of its own gets a letter tile.
 */
export function agentMark(t, provider, box, markName, iconName) {
  const art = (d, color) => window.paint_path(build(d, 14 / 24), color).w(14).h(14).text_color(t.text);
  let inner;
  if (provider === "claude" || provider === "claude-agent-teams") {
    inner = div().w(14).h(14).rounded(7).bg(ART.tile).child(art(CLAUDE, ART.claude).id(iconName));
  } else if (provider === "codex") {
    inner = div().w(14).h(14).child(art(OPENAI, t.text).id(iconName));
  } else {
    const letter = (provider || "?")[0].toUpperCase();
    inner = div().id(iconName).w(14).h(14).rounded(3).bg(mix(t.text, 20)).text_color(t.text)
      .flex().items_center().justify_center().text_size(8.5).font_weight(700).line_height("14px").child(letter);
  }
  return row().id(markName).w(box).h(box).flex_shrink(0).items_center().justify_center().rounded(box / 2).child(inner);
}

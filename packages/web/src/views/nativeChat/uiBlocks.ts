/** The `perch-ui` fenced block an agent can write to show something more than prose: a JSON object, or an array
 * of them, with a `type`. Plain data only: every string is drawn as text, never as HTML or a link, so a block
 * can show nothing but what it says. A block that does not parse or has an unknown shape is `null`, and the
 * message shows it as the code it is. */
export type Tone = "info" | "success" | "warning" | "error";
export type UiBlock =
  | { type: "callout"; tone: Tone; title?: string; text: string }
  | { type: "stats"; items: { label: string; value: string; hint?: string; tone?: Tone }[] }
  | { type: "table"; caption?: string; columns: string[]; rows: string[][] }
  | { type: "steps"; items: { text: string; state: "todo" | "doing" | "done" | "failed" }[] }
  | { type: "bars"; title?: string; items: { label: string; value: number }[] };

export const MAX_UI_ITEMS = 200;
const TONES = ["info", "success", "warning", "error"];
const STATES = ["todo", "doing", "done", "failed"];

const str = (value: unknown): string | undefined => typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : undefined;
const tone = (value: unknown): Tone | undefined => TONES.includes(value as string) ? value as Tone : undefined;
const list = (value: unknown): Record<string, unknown>[] | null =>
  Array.isArray(value) && value.length <= MAX_UI_ITEMS && value.every((item) => item && typeof item === "object" && !Array.isArray(item)) ? value as Record<string, unknown>[] : null;

function block(raw: unknown): UiBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  switch (o.type) {
    case "callout": {
      const text = str(o.text);
      return text === undefined ? null : { type: "callout", tone: tone(o.tone) ?? "info", text, ...(str(o.title) ? { title: str(o.title) } : {}) };
    }
    case "stats": {
      const items = list(o.items);
      if (!items) return null;
      return { type: "stats", items: items.map((i) => ({ label: str(i.label) ?? "", value: str(i.value) ?? "", ...(str(i.hint) ? { hint: str(i.hint) } : {}), ...(tone(i.tone) ? { tone: tone(i.tone) } : {}) })) };
    }
    case "table": {
      if (!Array.isArray(o.columns) || !Array.isArray(o.rows) || o.columns.length > 20 || o.rows.length > MAX_UI_ITEMS) return null;
      if (!o.rows.every(Array.isArray)) return null;
      return { type: "table", columns: o.columns.map((c) => str(c) ?? ""), rows: (o.rows as unknown[][]).map((row) => row.map((cell) => str(cell) ?? "")), ...(str(o.caption) ? { caption: str(o.caption) } : {}) };
    }
    case "steps": {
      const items = list(o.items);
      if (!items) return null;
      return { type: "steps", items: items.map((i) => ({ text: str(i.text) ?? "", state: STATES.includes(i.state as string) ? i.state as "todo" : "todo" })) };
    }
    case "bars": {
      const items = list(o.items);
      if (!items) return null;
      return { type: "bars", items: items.map((i) => ({ label: str(i.label) ?? "", value: Number.isFinite(Number(i.value)) ? Number(i.value) : 0 })), ...(str(o.title) ? { title: str(o.title) } : {}) };
    }
    default:
      return null;
  }
}

export function parseUi(source: string): UiBlock[] | null {
  let data: unknown;
  try { data = JSON.parse(source); } catch { return null; }
  const raw = Array.isArray(data) ? data : [data];
  if (!raw.length || raw.length > 20) return null;
  const blocks = raw.map(block);
  return blocks.every((b): b is UiBlock => b !== null) ? blocks : null;
}

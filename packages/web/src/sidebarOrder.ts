/**
 * The core owns the order of projects and chats (`workspace.order`), so every
 * viewer, the phone included, shows the same sidebar. These helpers are the
 * pure client side of it: apply the list, compute a move, and refill the tab
 * strip's session slots. With no list (an older core, or never reordered) every
 * helper returns its input unchanged.
 */
import { moveBeside } from "./tabOrder";

export interface WorkspaceOrder {
  projects: string[];
  sessions: string[];
}

/** `items` in the core's `order`. Ids the list does not know (new since the
 * last move) come first, in the order given, then the listed ones in list order. */
export function orderBy<T>(items: T[], order: readonly string[] | undefined, id: (item: T) => string): T[] {
  if (!order?.length) return items;
  const rank = new Map<string, number>();
  order.forEach((key, index) => { if (!rank.has(key)) rank.set(key, index); });
  const fresh = items.filter((item) => !rank.has(id(item)));
  const known = items.filter((item) => rank.has(id(item))).sort((a, b) => rank.get(id(a))! - rank.get(id(b))!);
  return [...fresh, ...known];
}

/** Projects in core order, favourites still first: the order only applies inside each group. */
export function orderProjects<T extends { id: string; favorite?: boolean }>(projects: T[], order: readonly string[] | undefined): T[] {
  const ordered = orderBy(projects, order, (project) => project.id);
  return [...ordered.filter((project) => project.favorite), ...ordered.filter((project) => !project.favorite)];
}

/** The full list after moving `moved` right before (or after) `target` in what
 * `ids` currently shows under `order`. Ids not in `ids` are dropped, which is
 * how the core's list loses stale entries. */
export function moveInOrder(ids: string[], order: readonly string[] | undefined, moved: string, target: string, after: boolean): string[] {
  return moveBeside(orderBy(ids, order, (id) => id), moved, target, after);
}

/** One step up (-1) or down (+1) among `siblings` (the ids as shown, in shown
 * order): the move that puts `id` beside its neighbour, or null at the end. */
export function stepTarget(siblings: string[], id: string, step: -1 | 1): { target: string; after: boolean } | null {
  const target = siblings[siblings.indexOf(id) + step];
  return siblings.includes(id) && target ? { target, after: step > 0 } : null;
}

/** `items` with the entries where `isSlot` holds replaced, slot by slot, by `fill`
 * (which must be the same entries, reordered). Everything else stays in place. */
export function refillSlots<T>(items: T[], isSlot: (item: T) => boolean, fill: T[]): T[] {
  let next = 0;
  return items.map((item) => (isSlot(item) ? fill[next++]! : item));
}

/** The tab strip's sessions in the core's order, leaving file tabs and chats the
 * core does not know yet where they are: one chat order across sidebar and strip. */
export function applySessionOrder<T extends { id: string }>(entries: T[], isSession: (entry: T) => boolean, order: readonly string[] | undefined): T[] {
  if (!order?.length) return entries;
  const known = new Set(order);
  const slot = (entry: T) => isSession(entry) && known.has(entry.id);
  return refillSlots(entries, slot, orderBy(entries.filter(slot), order, (entry) => entry.id));
}

// The Perch sidebar, written by hand with element builders: the web sidebar's structure
// (`packages/web/src/stock-ui/sidebar`) element by element, with its Tailwind classes turned into
// builder calls. Data and rules come from `perch.navigation(perch.sidebarSettings())`,
// `perch.hosts()` and `perch.theme()`; actions go through `perch.run` and
// `perch.setSidebarSettings`. Every colour is a theme token (the agent artwork keeps its own).
//
// Named elements (`.id("name")` or `.id("name:key")`) are the parity check's elements; any other
// element has no id, so the check sees exactly the web's set. Hover-only controls (a row's close
// button, a header's menu and plus) take their space always and are named only while the row is
// hovered, as the web's are drawn only on hover.
import { View, div } from "gpui-kit";
import * as perch from "perch";
import { FONT, WORDS, baseline, baselineShift, body, col, line, lineRow, mix, named, row, run, spaced, stateColor, text } from "./kit.js";
import { agentMark, icon } from "./icons.js";

/** `nestSessions`: each sub-session straight after its lead when both are listed. */
function nestSessions(list) {
  const nestedIn = (s) => !!s.parentId && s.parentId !== s.id && list.some((o) => o.id === s.parentId);
  const kids = new Map();
  for (const s of list) if (nestedIn(s)) kids.set(s.parentId, [...(kids.get(s.parentId) ?? []), s]);
  const ordered = kids.size ? list.filter((s) => !nestedIn(s)).flatMap((s) => [s, ...(kids.get(s.id) ?? [])]) : list;
  return ordered.map((session) => ({ session, nested: nestedIn(session) }));
}

/** A project with one plain checkout has no row of its own for it: the project row stands in. */
function singleWorkspaceOf(project) {
  const [only] = project.workspaces;
  return only && project.workspaces.length === 1 && !only.children.length && !only.linked ? only : undefined;
}

const NEXT_ORGANIZE = { project: "status", status: "list", list: "project" };

export default class SidebarBuilders extends View {
  init() {
    /** The row or header the pointer is over, by key. */
    this.hover = null;
    this.hostMenu = false;
    this.hiddenOpen = new Set();
  }

  hoverable(el, key) {
    return el.on_hover((on, cx) => {
      if (on ? this.hover !== key : this.hover === key) {
        this.hover = on ? key : null;
        cx.notify();
      }
    });
  }

  /**
   * A glyph button at the end of a row (the web's `rowActionClass`): its box is always there, and
   * it is drawn (and named) only while `rowKey` is hovered. `action` is left out when the `perch`
   * module has no command for it.
   */
  rowAction(c, rowKey, name, key, glyph, size, action) {
    const box = (el) => el.w(size).h(size).mx(2).self_center().flex_shrink(0);
    if (this.hover !== rowKey) return box(div());
    const el = box(named(row(), name, key)).items_center().justify_center().rounded(8).cursor_pointer()
      .hover((s) => s.bg(c.t["surface-1"])).child(glyph);
    return action ? el.on_click(action) : el;
  }

  // ---- the host chip and its switcher ----------------------------------------------------------

  hostChip(c) {
    const { t, hosts } = c;
    const sub = t["subtext-0"];
    const remote = hosts.activeId !== "local";
    const { active, local } = hosts;
    const [badge, color] = remote ? ["HOST", t.blue] : local.isSsh ? ["SSH", t.blue] : ["LOCAL", t.accent];
    const name = remote ? active.name : local.hostname;
    const meta = remote ? active.state : local.platform;
    const place = remote ? (active.error ?? active.address ?? "") : local.cwd ? local.cwd + (local.branch ? ` (${local.branch})` : "") : "";
    const small = (el) => line(el, 11.2, 400, 13, sub);
    return named(col(), "host-chip").min_w(0).flex_1().px(10.4).pt(9.6).pb(8)
      .child(row().items_center().gap(6.4)
        .child(lineRow(named(row(), "host-badge").flex_shrink(0).rounded(8).px(6.4).py(2.4).bg(mix(color, 15)).child(spaced(badge, 0.624, 10.4)), 10.4, 700, 12, color, 4.8))
        .when(name, (r) => r.child(line(named(div(), "host-name").min_w(0).truncate().child(name), 12, 500, 15, t.text)))
        .when(meta, (r) => r.child(small(named(div(), "host-meta").ml("auto").flex_shrink(0).child(meta)))))
      .when(place, (el) => el.child(small(named(div(), "host-line").mt(4.8).truncate().child(place))));
  }

  hostSwitcher(c) {
    const { t, hosts } = c;
    // The button's own 6 px side and 2/3 px top and bottom padding are the browser's defaults.
    // Tracked by hand rather than with `.hover`: the window's idle pointer is at its corner, which
    // would show this (the first thing there) as hovered before anyone has moved.
    return this.hoverable(named(row(), "host-switcher").flex_shrink(0).items_start().gap(4.8).px(6).pt(2).pb(3).cursor_pointer()
      .when(this.hover === "host", (r) => r.bg(t["surface-1"])), "host")
      .on_click((_e, cx) => { this.hostMenu = !this.hostMenu; cx.notify(); })
      .child(this.hostChip(c))
      .child(line(named(div(), "host-caret").flex_shrink(0).pt(9.6).pr(8).child("▾"), 11.2, 400, 13, t["subtext-0"], 9.6));
  }

  /** The popover under the chip: the computers, the shown one marked, a click selects one. */
  hostPopover(c) {
    const { t, hosts } = c;
    const dot = { connected: t.accent, connecting: t.yellow, error: t.red }; // disabled: subtext-0
    return col().absolute().top(61.2).left(6).min_w(200).max_w(320).rounded(8).overflow_hidden().bg(t["surface-1"])
      .on_mouse_down_out((_e, cx) => { this.hostMenu = false; cx.notify(); })
      .children(hosts.list.map((host) =>
        named(row(), "host-option", host.id).items_center().gap(7.2).px(9.6).py(7.2).cursor_pointer()
          .when(host.id === hosts.activeId, (r) => r.bg(t["surface-0"]))
          .hover((s) => s.bg(t["surface-0"]))
          .on_click((_e, cx) => { run(perch, "host.select", { id: host.id }); this.hostMenu = false; cx.notify(); })
          .child(div().w(8).h(8).rounded(4).flex_shrink(0).bg(dot[host.state] ?? t["subtext-0"]))
          .child(line(div().flex_1().min_w(0).truncate().child(host.name), 12.8, 400, body(12.8), t.text))
          .child(line(div().flex_shrink(0).child(host.state.toUpperCase()), 10.56, 400, body(10.56), t["subtext-0"]))))
      .child(div().h(1).bg(t["overlay-0"]))
      .child(named(row(), "host-manage").px(9.6).py(7.2).cursor_pointer().hover((s) => s.bg(t["surface-0"]))
        .on_click((_e, cx) => { run(perch, "app.settings"); this.hostMenu = false; cx.notify(); })
        .child(line(div().child("Manage hosts…"), 12.8, 400, body(12.8), t.text)));
  }

  // ---- New session -----------------------------------------------------------------------------

  newSession(c) {
    const { t, hosts } = c;
    const sub = t["subtext-0"];
    const shortcut = perch.shortcutLabel("sessions.new");
    const button = named(row(), "new-session-button", hosts.activeId).items_center().gap(8).h(32.6).px(12).rounded(8)
      .text_color(t.text).hover((s) => s.bg(t["surface-0"]))
      .child(named(icon("plus", 14, sub), "new-session-icon"))
      .child(line(named(div(), "new-session-label"), 12.5, 500, 15, t.text).child("New session"))
      .when(shortcut, (r) => r.child(line(named(div(), "new-session-shortcut").ml("auto").child(shortcut), 11.2, 400, 13, sub)));
    if (!hosts.canCreate) return col().flex_shrink(0).px(3).child(button.opacity(0.4));
    return col().flex_shrink(0).px(3).child(button.cursor_pointer().on_click(() => run(perch, "sessions.new")));
  }

  // ---- shared row pieces -----------------------------------------------------------------------

  /** The state at the end of a chat row, in words; idle says nothing. `count` is for a folded project. */
  stateBadge(c, section, count, name, key) {
    if (section === "idle") return null;
    const el = row().flex_shrink(0).items_center().rounded(999).px(6).py(1).whitespace_nowrap()
      .bg(mix(stateColor(c.t, section), 22)).child(WORDS[section])
      .when(count > 1, (r) => r.child(div().ml(4).child(String(count))));
    return lineRow(name ? named(el, name, key) : el, 11, 500, 16, c.t.text, 2);
  }

  sessionRow(c, s, group, nested, variant, detail = "") {
    const { t, nav } = c;
    const sub = t["subtext-0"];
    const active = s.id === nav.activeSessionId;
    const chats = group === "chats";
    const status = variant === "status";
    const title = s.title || (variant === "tree" && !chats ? "New session" : "New chat");
    const pl = status ? 30 : variant === "tree" && !chats ? 30.4 : 10.4;
    const ink = active ? t.text : sub;
    const button = text(named(row(), "session-button", s.id).flex_1().min_w(0).items_center().gap(8)
      .min_h(status ? 24 : 32).pl(pl).pr(10.4).py(status ? 0 : 4).rounded(8).cursor_pointer()
      .on_click(() => run(perch, "session.open", { id: s.id })), 12, 400, 15, ink);
    if (status) {
      button.child(agentMark(t, s.provider, 16, `session-mark:${s.id}`, `session-mark-icon:${s.id}`))
        .child(row().flex_1().min_w(0).items_start().gap(8)
          .child(line(named(div(), "status-row-title", s.id).min_w(0).flex_shrink(2).truncate().child(title), 12, 400, 15, ink))
          // The web puts the two on one text baseline, which puts the smaller one lower.
          .when(detail, (r) => r.child(line(named(div(), "status-row-detail", s.id).min_w(0).flex_1().mt(baselineShift(12, 15, 9.92, 12)).truncate().child(detail), 9.92, 400, 12, sub))));
    } else {
      button.child(agentMark(t, s.provider, 18, `session-mark:${s.id}`, `session-mark-icon:${s.id}`))
        .child(line(named(div(), "session-title", s.id).flex_1().min_w(0).truncate().child(title), 12, 400, 15, ink))
        .when(variant === "list" && s.projectName, (b) => b.child(line(div().min_w(0).max_w("35%").truncate().child(s.projectName), 9.92, 400, 12, sub)))
        .when(nav.reachable && s.provider !== "terminal" && s.section !== "idle", (b) => b.child(this.stateBadge(c, s.section, 1, "session-state-badge", s.id)));
    }
    const key = `row:${s.id}`;
    const el = named(row(), "session-row", s.id).min_w(0).items_stretch().rounded(8)
      .when(nested, (r) => r.ml(16).border_l(1).border_color(t["surface-1"]))
      .when(active, (r) => r.bg(t["surface-1"]))
      .hover((st) => st.bg(t["surface-1"]))
      .child(button)
      .child(this.rowAction(c, key, "session-close-button", s.id, icon("close", 12, sub), 24, null));
    return this.hoverable(el, key);
  }

  sessionRows(c, list, group) {
    return col().gap(2).pt(2).children(nestSessions(list).map(({ session, nested }) => this.sessionRow(c, session, group, nested, "tree")));
  }

  // ---- By project --------------------------------------------------------------------------------

  workspaceNode(c, project, ws) {
    const { t, nav } = c;
    const sub = t["subtext-0"];
    const active = ws.id === nav.activeWorkspaceId;
    const button = text(named(row(), "workspace-button", ws.id).items_center().gap(7.2).min_h(32).py(3).pl(12).pr(48).rounded(8).cursor_pointer()
      .when(active && ws.sessions.length === 0, (r) => r.bg(t["surface-1"]))
      .hover((s) => s.bg(t["surface-1"]))
      .on_click(() => run(perch, "workspace.focus", { id: ws.id })), 12, 400, 15, t.text)
      .child(named(icon(ws.linked ? "branch" : "diamond", 12, sub), "workspace-icon", ws.id))
      .child(row().flex_1().min_w(0).items_center().gap(5.6)
        .child(line(named(div(), "workspace-name", ws.id).min_w(0).truncate().child(ws.name), 12, 500, 15, active ? t.text : sub))
        .when(ws.branch && ws.branch !== ws.name, (r) => r.child(line(named(div(), "workspace-branch", ws.id).min_w(0).flex_shrink(3).truncate().child(ws.branch), 12, 400, 15, sub))))
      .when(ws.dirty, (r) => r.child(line(named(div(), "workspace-dirty-mark", ws.id).flex_shrink(0).child("●"), 9.28, 400, 11, sub)))
      .when(ws.pinned || ws.sleeping, (r) => r.child(line(named(div(), "workspace-pinned-label", ws.id).flex_shrink(0)
        .child([ws.pinned && "pinned", ws.sleeping && "sleeping"].filter(Boolean).join(" · ")), 9.28, 400, 11, sub)));
    return col().gap(2)
      .child(named(col(), "workspace", ws.id).child(button).when(ws.sessions.length > 0, (e) => e.child(this.sessionRows(c, ws.sessions, ws.id))))
      .when(ws.children.length > 0, (e) => e.child(col().gap(2).ml(14.4).children(ws.children.map((child) => this.workspaceNode(c, project, child)))));
  }

  hiddenWorktrees(c, project) {
    const { t } = c;
    const sub = t["subtext-0"];
    const open = this.hiddenOpen.has(project.id);
    const n = project.hidden.length;
    // The web's button is an inline box in a block of the page's 16 px / 1.3 text: it sits on that
    // line's baseline, so the line's taller strut puts it lower.
    const strut = Math.max(0, baseline(16, body(16)) - (4 + baseline(9.92, 12)));
    const button = line(named(div(), "hidden-worktrees-button", project.id).pt(4).pr(7.2).pb(4).pl(23.2).cursor_pointer()
      .on_click((_e, cx) => {
        if (open) this.hiddenOpen.delete(project.id); else this.hiddenOpen.add(project.id);
        cx.notify();
      }).child(`${n} hidden worktree${n === 1 ? "" : "s"}`), 9.92, 400, 12, t["overlay-1"], 8);
    return col().pt(strut).child(button).when(open, (e) => e.children(project.hidden.map((ws) =>
      // Show (`workspace.hide` with hidden: false) is not a command of the perch module yet: drawn, not wired.
      row().items_center().gap(5.6).py(3).pr(12).pl(23.2)
        .child(col().flex_1().min_w(0)
          .child(line(div().truncate().child(ws.branch || ws.name), 12, 500, 15, t.text))
          .child(line(div().truncate().child(ws.path), 12, 400, 15, sub)))
        .child(line(div().px(4.8).py(2.2).rounded(8).child("Show"), 9.6, 400, 11, sub, 4.4)))));
  }

  project(c, p) {
    const { t, nav, settings } = c;
    const sub = t["subtext-0"];
    const single = singleWorkspaceOf(p);
    const folded = settings.collapsedProjects.includes(p.id) && !nav.shortcuts;
    const top = folded ? p.top : null;
    const count = top && top !== "idle" ? p.sessions.filter((s) => s.section === top).length : 0;
    const key = `ph:${p.id}`;
    // With nothing to fold away, the header opens the checkout instead.
    const toggle = text(named(row(), "project-toggle", p.id).flex_1().min_w(0).min_h(32).items_center().gap(7.2).py(3).px(12).rounded(8).cursor_pointer()
      .on_click(() => (single ? run(perch, "workspace.focus", { id: single.id }) : run(perch, "project.fold", { id: p.id }))), 12, 400, 15, t.text)
      .when(!single, (r) => r.child(named(icon(folded ? "chevronClosed" : "chevronOpen", 10, sub), "project-chevron", p.id).ml(-4)))
      .child(named(icon("folder", 12, sub, { filled: p.favorite }), "project-folder-icon", p.id))
      .child(line(named(div(), "project-name", p.id).min_w(0).truncate().child(p.name), 12.5, 500, 15, t.text))
      .when(single?.branch && single.branch !== p.name, (r) => r.child(line(named(div(), "project-branch", p.id).min_w(0).flex_shrink(3).truncate().child(single.branch), 12, 400, 15, sub)))
      .when(single?.dirty, (r) => r.child(line(named(div(), "project-dirty-mark", p.id).flex_shrink(0).child("●"), 9.28, 400, 11, sub)));
    const header = named(row(), "project-header", p.id).items_stretch().rounded(8)
      .when(single && single.id === nav.activeWorkspaceId && (folded || p.sessions.length === 0), (r) => r.bg(t["surface-1"]))
      .hover((s) => s.bg(t["surface-1"]))
      .child(toggle)
      .when(top && count > 0, (r) => r.child(row().items_center().self_center().pr(4)
        .child(named(row(), "project-rollup", p.id).flex_shrink(0).child(this.stateBadge(c, top, count, "project-rollup-badge", p.id)))))
      // The menu and the new-session / worktree menus are the web's popups; the perch module has no command for them yet.
      .child(this.rowAction(c, key, "project-menu-button", p.id, icon("ellipsis", 14, sub), 24, null))
      .child(this.rowAction(c, key, "project-add-button", p.id, icon("plus", 14, sub), 24, null));
    const inside = (!folded || single) && (p.workspaces.length + p.hidden.length > 0 || p.jobs.length > 0);
    return col().gap(2).flex_shrink(0).id(`project:${p.id}`)
      .child(this.hoverable(header, key))
      .when(inside, (e) => e.child(named(col(), "project-workspaces", p.id).gap(2)
        .when(!!single && !folded && single.sessions.length > 0, (b) => b.child(this.sessionRows(c, single.sessions, single.id)))
        .when(!single, (b) => b.child(col().gap(2).children(p.workspaces.map((ws) => this.workspaceNode(c, p, ws)))))
        .children(p.jobs.map((job) => text(row().items_center().gap(7.2).px(12).py(3).child(div().child(job.status === "failed" ? "✕" : "◌"))
          .child(div().child(job.status === "failed" ? `${job.branch}: create failed` : `${job.branch}: ${job.phase}…`)), 12, 400, body(12), sub)))
        .when(p.hidden.length > 0, (b) => b.child(this.hiddenWorktrees(c, p)))));
  }

  quickchat(c) {
    const { t, nav, settings } = c;
    const sub = t["subtext-0"];
    const chat = nav.quickchat;
    const chats = chat.sessions;
    const shown = [...chats].reverse();
    const folded = settings.collapsedProjects.includes(chat.id);
    const key = "ph:chats";
    const header = named(row(), "chats-header").items_stretch().rounded(8).hover((s) => s.bg(t["surface-1"]))
      .child(named(row(), "chats-toggle").flex_1().min_h(32).items_center().gap(5.6).py(4).pl(16).pr(8.8).rounded(8).cursor_pointer()
        .on_click(() => run(perch, "project.fold", { id: chat.id }))
        .child(lineRow(named(row(), "chats-label"), 9.92, 600, 12.9, sub).child(spaced("QUICKCHAT", 0.4464, 9.92)))
        .child(named(icon(folded ? "chevronClosed" : "chevronOpen", 12, sub), "chats-chevron")))
      .when(chats.length > 0, (r) => r.child(this.rowAction(c, key, "chats-menu-button", null, icon("ellipsis", 14, sub), 24, null)))
      // New chat is `quickchat.new` on the web; the perch module has no such command yet.
      .child(named(row(), "chats-new-button").w(24).h(24).mx(2).self_center().flex_shrink(0).items_center().justify_center().rounded(8).cursor_pointer()
        .hover((s) => s.bg(t["surface-1"])).child(named(icon("newChat", 16, sub), "chats-new-icon")));
    return named(col(), "chats").gap(2)
      .child(this.hoverable(header, key))
      .when(!folded && chats.length > 0, (e) => e.child(col().gap(2).pt(2).pr(4.8).pl(6.4)
        .children(nestSessions(shown).map(({ session, nested }) => this.sessionRow(c, session, "chats", nested, "tree")))));
  }

  // ---- By status and In one list -------------------------------------------------------------

  statusHeading(c, id, title, count, note, section) {
    const { t } = c;
    const color = section && section !== "offline" ? stateColor(t, section) : null;
    const dot = named(div(), "status-heading-dot", id).w(8).h(8).flex_shrink(0).rounded(4);
    if (!color) dot.border(1.5).border_color(t["overlay-1"]);
    else if (section === "idle") dot.border(1.5).border_color(color);
    else dot.bg(color);
    return text(named(row(), "status-heading", id).items_center().gap(8).px(12).py(3).mt(12).mb(2), 12, 600, 15.6, t.text)
      .child(dot)
      // With a note beside it the label may be squeezed and wrap onto a second line, so it is as high as its lines.
      .child(note ? named(div(), "status-heading-label", id).min_w(0).child(title) : line(named(div(), "status-heading-label", id).min_w(0).child(title), 12, 600, 15.6, t.text))
      .child(line(named(div(), "status-heading-count", id).child(String(count)), 12, 500, 15.6, t["subtext-0"]))
      .when(note, (r) => r.child(line(named(div(), "status-heading-note", id).min_w(0).truncate().child(note), 9.92, 400, 12.9, t["subtext-0"])));
  }

  statusView(c) {
    const { t, nav } = c;
    const sub = t["subtext-0"];
    const empty = nav.projects.filter((p) => !p.hasChats);
    const sections = nav.status.map((section) => named(col(), "status-section", section.key).gap(2)
      .child(this.statusHeading(c, `status-section-title-${section.key}`, section.title, section.sessions.length, section.note, section.key))
      .children(section.projects.map((cluster) => {
        const id = `${section.key}-${cluster.id}`;
        const real = cluster.project && !cluster.project.quickchat;
        const key = `status:${id}`;
        const header = named(row(), "status-project-header", id).items_center().pr(4).pl(12)
          .child(real ? named(icon("folder", 12, sub), "status-project-icon", id).mr(6) : div().w(12).mr(6).flex_shrink(0))
          .child(line(named(div(), "status-project-title", id).flex_1().min_w(0).truncate().py(3).child(cluster.name), 12.5, 500, body(12.5), t.text, 6))
          .when(real, (r) => r.child(this.rowAction(c, key, "status-project-add", cluster.id, icon("plus", 14, sub), 20, null)));
        return named(col(), "status-project", id).gap(2)
          .child(this.hoverable(header, key))
          .children(nestSessions(cluster.sessions).map(({ session, nested }) => this.sessionRow(c, session, `status:${id}`, nested, "status",
            [session.workspaceLabel, section.key === "needs" ? session.needReason : null].filter(Boolean).join(" · "))));
      })));
    return named(col(), "status-view").gap(2).py(3.2)
      .when(nav.sessions.length === 0, (e) => e.child(line(div().px(4.8).py(8).child("No chats yet."), 11.2, 400, body(11.2), sub, 16)))
      .children(sections)
      .when(empty.length > 0, (e) => e.child(col()
        .child(this.statusHeading(c, "status-no-sessions-title", "No sessions", empty.length, null, null))
        .children(empty.map((p) => {
          const key = `empty:${p.id}`;
          const first = p.workspaces[0];
          const el = named(row(), "status-empty-project", p.id).min_w(0).items_center().rounded(8).hover((s) => s.bg(t["surface-1"]))
            .child(text(row().flex_1().min_w(0).items_center().min_h(24).pl(12).pr(10.4).rounded(8).cursor_pointer()
              .on_click(() => first && run(perch, "workspace.focus", { id: first.id })), 12, 400, 15, t.text)
              .child(named(icon("folder", 12, sub), "status-empty-project-icon", p.id).mr(6))
              .child(line(named(div(), "status-empty-project-title", p.id).flex_1().min_w(0).truncate().child(p.name), 12.5, 500, 15, t.text)))
            .child(this.rowAction(c, key, "status-empty-project-add", p.id, icon("plus", 14, sub), 20, null));
          return this.hoverable(el, key);
        }))));
  }

  listView(c) {
    const { t, nav } = c;
    return col().gap(2).py(3.2)
      .when(nav.sessions.length === 0, (e) => e.child(line(div().px(4.8).py(8).child("No sessions yet."), 11.2, 400, body(11.2), t["subtext-0"], 16)))
      .children(nav.sessions.map((s) => this.sessionRow(c, s, "list", false, "list")));
  }

  // ---- the overview and the whole sidebar ------------------------------------------------------

  overview(c) {
    const { t, nav, settings } = c;
    const sub = t["subtext-0"];
    const projectCount = nav.projects.length;
    const header = named(row(), "overview-header").flex_shrink(0).items_stretch().justify_between().gap(7.2).pl(16).pr(3)
      .child(row().min_w(0).items_center().gap(7.2).py(8.8)
        .child(lineRow(named(row(), "overview-title"), 9.92, 600, 12.9, sub).child(spaced(settings.organize === "project" ? "PROJECTS" : "SESSIONS", 0.4464, 9.92))))
      .child(row().flex_shrink(0).items_stretch()
        .when(nav.needsYou > 0, (r) => r.child(line(named(div(), "needs-you-button").my(3).self_center().rounded(8).px(8).py(2.4).cursor_pointer()
          .hover((s) => s.bg(t["surface-1"]))
          .on_click(() => run(perch, "global.needsYou"))
          .child(`${nav.needsYou} need${nav.needsYou === 1 ? "s" : ""} you`), 10.88, 500, 13, t.accent, 4.8)))
        // The menu the web opens here also has Show terminals and Sort by attention; a click switches the view in turn.
        .child(named(row(), "organize-button").w(36).my(3).items_center().justify_center().rounded(8).cursor_pointer()
          .hover((s) => s.bg(t["surface-0"]))
          .on_click(() => perch.setSidebarSettings({ organize: NEXT_ORGANIZE[settings.organize] ?? "project" }))
          .child(named(icon("organize", 16, sub), "organize-icon")))
        // Add project opens a dialog on the web (project registration is not a perch command yet).
        .child(text(named(row(), "add-project-button").items_center().gap(4).px(9.6).my(3).rounded(8).cursor_pointer()
          .hover((s) => s.bg(t["surface-0"]))
          .child(named(icon("plus", 12, sub), "add-project-icon"))
          .child(line(named(div(), "add-project-label"), 11.52, 500, 13, sub).child("Add")), 11.52, 500, 13, sub)));
    const body = settings.organize !== "project" && !nav.shortcuts
      ? (settings.organize === "list" ? this.listView(c) : this.statusView(c))
      : col().gap(2).children(nav.projects.map((p) => this.project(c, p))).when(nav.quickchat, (e) => e.child(this.quickchat(c)));
    return named(col(), "overview").flex_1().min_h(0).overflow_hidden()
      .child(header)
      .when(nav.loading, (e) => e.child(line(div().flex_shrink(0).px(10.4).py(8.8).child("Loading workspace…"), 11.2, 400, body(11.2), sub, 17.6)))
      .when(!!nav.error, (e) => e.child(text(row().flex_shrink(0).items_center().gap(7.2).px(10.4).py(8.8).child(nav.error), 11.2, 400, body(11.2), t.red)))
      .when(settings.organize === "project" && projectCount === 0 && !nav.loading, (e) => e.child(col().items_start().gap(5.12).px(12).py(17.6)
        .child(line(div().child("＋"), 20.8, 400, 20.8, t.accent))
        .child(line(div().child("Add a project"), 12.32, 700, body(12.32), t.text))
        .child(line(div().child("A project keeps its workspaces, sessions and files together."), 10.88, 400, body(10.88), sub))))
      .child(named(col(), "project-list").flex_1().min_h(0).gap(2).px(3).py(3).overflow_y_scroll()
        // Children keep their size; the list scrolls instead.
        .child(body.flex_shrink(0)));
  }

  render(_cx) {
    const t = perch.theme();
    const settings = perch.sidebarSettings();
    const nav = perch.navigation(settings);
    const hosts = perch.hosts();
    const c = { t, settings, nav, hosts };
    const gear = text(named(row(), "settings-gear").w_full().items_center().justify_end().rounded(8).px(14.4).py(6.4).cursor_pointer()
      .hover((s) => s.bg(t["surface-0"]))
      .on_click(() => run(perch, "app.settings"))
      .child(named(icon("gear", 18, t["subtext-0"]), "settings-gear-icon")), 12, 400, 15, t["subtext-0"]);
    return named(col(), "sidebar-root").relative().size_full().overflow_hidden().bg(t["card-bg"])
      .font_family(FONT).text_size(12).font_weight(400).line_height("15px").text_color(t.text)
      .child(named(col(), "sidebar-content").flex_1().min_h(0)
        // A local-only install has nothing to switch between.
        .when(hosts.list.length > 1 || hosts.activeId !== "local", (e) => e.child(this.hostSwitcher(c)))
        .child(this.newSession(c))
        .child(this.overview(c)))
      .child(named(row(), "settings-bar").flex_shrink(0).items_stretch().p(4).child(gear))
      .when(this.hostMenu, (e) => e.child(this.hostPopover(c)));
  }
}

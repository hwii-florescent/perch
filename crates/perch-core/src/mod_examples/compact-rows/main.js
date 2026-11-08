// Draws Perch's own session rows and notification cards itself, one tight line each, with a status
// colour. The sidebar and toasts keep their behaviour (selection, ordering, timers); this only
// decides what a row or card looks like. If it throws, the stock ones come back.
// Copy this mod (`perch mod clone compact-rows`) and change it: it reloads when you save.
const colour = (s) => (s.blocked ? "#df8c8c" : s.status === "running" ? "#d3b46a" : s.unseen ? "#7fb685" : "#9b9b9b");

export default (el, api) => {
  const row = (box, { data: s, actions }) => {
    const line = document.createElement("div");
    line.style.cssText = `display:flex;gap:6px;align-items:center;padding:2px 8px;cursor:pointer;font-size:12px;border-left:3px solid ${colour(s)};${s.active ? "background:rgba(255,255,255,.08)" : ""}`;
    const title = document.createElement("span");
    title.textContent = s.title || "(new session)";
    title.style.cssText = "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
    const branch = document.createElement("span");
    branch.textContent = s.branch ?? "";
    branch.style.opacity = "0.6";
    line.append(title, branch);
    line.onclick = () => actions.open();
    line.oncontextmenu = (event) => { event.preventDefault(); actions.remove(); };
    box.append(line);
  };

  const toast = (box, { data: t, actions }) => {
    const card = document.createElement("div");
    card.style.cssText = "display:flex;gap:8px;padding:6px 10px;border-radius:6px;background:rgba(0,0,0,.8);color:#eee;font-size:12px;cursor:pointer";
    card.textContent = `${t.title}${t.body ? ` · ${t.body}` : ""}`;
    card.onclick = () => actions.open();
    const close = document.createElement("span");
    close.textContent = "×";
    close.style.marginLeft = "auto";
    close.onclick = (event) => { event.stopPropagation(); actions.dismiss(); };
    card.append(close);
    box.append(card);
  };

  el.textContent = "Session rows and toasts are drawn by this mod.";
  el.style.cssText = "padding:12px;font-size:13px";
  const releases = [api.slot("session-row", row), api.slot("toast", toast)];
  return () => releases.forEach((release) => release());
};

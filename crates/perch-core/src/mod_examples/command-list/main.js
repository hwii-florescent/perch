// A filterable list of every app command; click one to run it. It also adds a command of its own,
// "Show the command list" (mod+shift+y), that opens the same list as a dialog.
// Copy this mod (`perch mod clone command-list`) and change it: it reloads when you save.
export default (el, api) => {
  const draw = (box, after) => {
    const filter = document.createElement("input");
    filter.placeholder = "Filter commands…";
    filter.style.cssText = "width:100%;box-sizing:border-box;margin-bottom:6px;padding:4px 6px";
    const list = document.createElement("div");
    const show = () => {
      const words = filter.value.toLowerCase();
      list.replaceChildren(
        ...api.commands()
          .filter((c) => `${c.id} ${c.description}`.toLowerCase().includes(words))
          .slice(0, 200)
          .map((c) => {
            const row = document.createElement("button");
            row.textContent = c.description;
            row.title = c.id;
            row.style.cssText = "display:block;width:100%;text-align:left;background:none;border:0;color:inherit;padding:4px 6px;cursor:pointer;font:inherit";
            row.onclick = () => { after?.(); api.run(c.id); };
            return row;
          }),
      );
    };
    filter.oninput = show;
    show();
    box.append(filter, list);
    return filter;
  };

  el.style.cssText = "padding:8px;overflow:auto;font-size:13px";
  draw(el);
  const remove = api.command({
    name: "list",
    description: "Show the command list",
    keys: "mod+shift+y",
    run: () => api.overlay((box, close) => { draw(box, close).focus(); }),
  });
  return remove;
};

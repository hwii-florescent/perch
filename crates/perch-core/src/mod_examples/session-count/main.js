// Shows how many sessions exist and tells you when one needs you. It reads Perch's own store
// (`api.store`, a zustand store), so it follows every change live.
// Copy this mod (`perch mod clone session-count`) and change it: it reloads when you save.
export default (el, api) => {
  el.style.cssText = "padding:12px;font-size:14px";
  let blocked = 0;
  const draw = () => {
    const { sessions } = api.store.getState();
    el.textContent = `${sessions.length} sessions`;
    const now = sessions.filter((s) => s.blocked).length;
    if (now > blocked) api.notify({ title: "A session needs you", body: `${now} waiting` });
    blocked = now;
  };
  draw();
  return api.store.subscribe(draw);
};

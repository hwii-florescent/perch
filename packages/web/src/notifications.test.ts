import { expect, test } from "vitest";
import { planNotification } from "./notifications";

const base = { event: true, viewed: false, focused: true, delivery: "app", permission: "granted" as const };

test("focused + other session: toast for app, system for system", () => {
  expect(planNotification(base)).toBe("toast");
  expect(planNotification({ ...base, delivery: "system" })).toBe("system");
});
test("unfocused window escalates to system, even for the viewed session", () => {
  expect(planNotification({ ...base, focused: false })).toBe("system");
  expect(planNotification({ ...base, focused: false, viewed: true })).toBe("system");
});
test("no permission falls back to toast; viewed+focused and off are silent", () => {
  expect(planNotification({ ...base, focused: false, permission: "denied" })).toBe("toast");
  expect(planNotification({ ...base, viewed: true })).toBe("none");
  expect(planNotification({ ...base, delivery: "off", focused: false })).toBe("none");
  expect(planNotification({ ...base, event: false })).toBe("none");
});

import { afterEach, expect, test, vi } from "vitest";
import { getNotificationSettings, hasNativeNotifications, openNotificationSettings, planNotification, requestNotificationPermission, sendSystemNotification } from "./notifications";

afterEach(() => vi.unstubAllGlobals());

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

test("native macOS attempts use native authorization, not a browser/plugin permission", () => {
  const native = { ...base, native: true, permission: "unsupported" as const };
  expect(planNotification({ ...native, focused: false })).toBe("system");
  expect(planNotification({ ...native, delivery: "system" })).toBe("system");
  expect(planNotification({ ...native, viewed: true })).toBe("none");
  expect(planNotification({ ...native, delivery: "off" })).toBe("none");
});

test("macOS settings and explicit consent ignore the plugin’s unconditional grant", async () => {
  const invoke = vi.fn().mockResolvedValue({ permission: "default", alerts: false, alertStyle: "none" });
  const plugin = Object.assign(vi.fn(), { permission: "granted", requestPermission: vi.fn() });
  vi.stubGlobal("Notification", plugin);
  vi.stubGlobal("navigator", { platform: "MacIntel" });
  vi.stubGlobal("window", { __TAURI_INTERNALS__: { invoke } });
  expect(hasNativeNotifications()).toBe(true);
  expect(await getNotificationSettings()).toMatchObject({ permission: "default" });
  expect(invoke).toHaveBeenCalledExactlyOnceWith("notification_status");
  expect(plugin.requestPermission).not.toHaveBeenCalled();
  invoke.mockResolvedValue({ permission: "denied" });
  expect(await requestNotificationPermission()).toEqual({ permission: "denied" });
  expect(invoke).toHaveBeenLastCalledWith("notification_request_permission");
  await openNotificationSettings();
  expect(invoke).toHaveBeenLastCalledWith("notification_open_settings");
});

test("native status/send failures propagate, without retrying the broken plugin or requesting consent", async () => {
  const invoke = vi.fn().mockRejectedValue(new Error("Notifications are blocked"));
  const plugin = Object.assign(vi.fn(), { permission: "granted", requestPermission: vi.fn() });
  vi.stubGlobal("Notification", plugin);
  vi.stubGlobal("navigator", { platform: "MacIntel" });
  vi.stubGlobal("window", { __TAURI_INTERNALS__: { invoke } });
  await expect(getNotificationSettings()).rejects.toThrow("blocked");
  await expect(sendSystemNotification("Done", "task", "session", vi.fn())).rejects.toThrow("blocked");
  expect(invoke.mock.calls.map(([command]) => command)).toEqual(["notification_status", "notify_session"]);
  expect(plugin).not.toHaveBeenCalled();
  expect(plugin.requestPermission).not.toHaveBeenCalled();
});

test("browsers request only from default; unsupported and denied clients are honest", async () => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("navigator", { platform: "Linux" });
  vi.stubGlobal("Notification", undefined);
  expect(await getNotificationSettings()).toEqual({ permission: "unsupported" });
  const browser = { permission: "default", requestPermission: vi.fn(async () => { browser.permission = "granted"; }) };
  vi.stubGlobal("Notification", browser);
  expect(await getNotificationSettings()).toEqual({ permission: "default" });
  expect(browser.requestPermission).not.toHaveBeenCalled();
  expect(await requestNotificationPermission()).toEqual({ permission: "granted" });
  browser.permission = "denied";
  expect(await requestNotificationPermission()).toEqual({ permission: "denied" });
  expect(browser.requestPermission).toHaveBeenCalledTimes(1);
});

// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { fileTabKey, useFileTabs } from "./fileTabs";
import { openProjectHome } from "./modCommands";
import { PROJECT_HOME } from "./projectHome";
import { tabName } from "./workspaceTabs";

beforeEach(() => useFileTabs.setState({ tabs: [], active: null }));

it("shows the Project's open home tab again instead of opening a second, and names it for the Project", () => {
  const key = useFileTabs.getState().openMod("w1", PROJECT_HOME, { projectId: "p1", name: "perch" });
  const other = useFileTabs.getState().openMod("w1", PROJECT_HOME, { projectId: "p2", name: "other" });
  expect(useFileTabs.getState().active).toBe(other);
  expect(openProjectHome("p1", "perch")).toBe(true);
  expect(useFileTabs.getState().active).toBe(key);
  expect(useFileTabs.getState().tabs).toHaveLength(2);
  const tab = useFileTabs.getState().tabs.find((candidate) => fileTabKey(candidate) === key)!;
  expect(tabName(tab)).toBe("perch home");
});

/** Terminals the person (or a mod) pinned, kept on this device. Perch's own views ignore it; a mod's own sidebar reads it through `agents()`. */
const KEY = "perch.pinnedTerminals";

const read = (): string[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
};

export const isPinned = (id: string) => read().includes(id);

export const setPinned = (id: string, pinned: boolean) => {
  const rest = read().filter((other) => other !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(pinned ? [...rest, id] : rest));
  } catch {
    // No storage to keep it in: the pin is not remembered.
  }
};

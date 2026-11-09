import { useEffect, useRef } from "react";
import { useResourceState } from "@perch/sdk";

/** The text being typed for a saved value. Perch keeps it under `key`, so every copy of this page shares it and it
 * stays while the page is away; it ends when it matches what is saved, or when the saved value changes under it.
 * `discard` goes back to the saved value. */
export function useDraft(key: string, saved: string): [text: string, setText: (text: string) => void, discard: () => void] {
  const [draft, setDraft] = useResourceState<string | null>(key, null);
  const seen = useRef(saved);
  useEffect(() => {
    if (seen.current !== saved) { seen.current = saved; setDraft(null); }
    else if (draft !== null && draft === saved) setDraft(null);
  }, [draft, saved, setDraft]);
  return [draft ?? saved, setDraft, () => setDraft(null)];
}

// draft.ts of Perch's stock screen "stock:settings-terminal", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { useEffect, useRef } from "react";
import { useResourceState } from "@perch/sdk";
/** The text being typed for a saved value. Perch keeps it under `key`, so every copy of this page shares it and it
 * stays while the page is away; it ends when it matches what is saved, or when the saved value changes under it.
 * `discard` goes back to the saved value. */
export function useDraft(key, saved) {
    const [draft, setDraft] = useResourceState(key, null);
    const seen = useRef(saved);
    useEffect(() => {
        if (seen.current !== saved) {
            seen.current = saved;
            setDraft(null);
        }
        else if (draft !== null && draft === saved)
            setDraft(null);
    }, [draft, saved, setDraft]);
    return [draft ?? saved, setDraft, () => setDraft(null)];
}

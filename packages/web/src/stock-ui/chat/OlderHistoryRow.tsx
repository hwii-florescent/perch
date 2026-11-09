import { type OlderHistory } from "@perch/sdk";

/** The top of a transcript with more behind it. The sentinel sits right here, so the observer sees the top;
 * the button is offered only when automatic loading has stopped. Follows Orca's `NativeChatOlderHistoryRow`
 * (MIT, commit 308b5000). */
export function OlderHistoryRow({ older }: { older: OlderHistory }) {
  return <div ref={older.sentinelRef} className="flex min-h-6 items-center justify-center text-[12px] text-subtext-0" data-testid="native-cli-older">
    {older.auto
      ? <span role="status" aria-live="polite">{older.loading ? "Loading earlier messages…" : ""}</span>
      : <button type="button" disabled={older.loading} onClick={older.loadNow} className="cursor-pointer rounded-ui bg-transparent px-2 py-0.5 text-subtext-0 [border:0] hover:bg-surface-1 hover:text-fg">
        {older.loading ? "Loading…" : "Load earlier messages"}
      </button>}
  </div>;
}

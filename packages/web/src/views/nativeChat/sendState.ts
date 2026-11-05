/** What the native chat composer's one round button offers, after Orca's
 * `native-chat-composer-send-state.ts`: Stop takes Send's place while the agent
 * works and the draft is empty; a typed draft still sends (the provider queues it). */
export type ComposerAction = "send" | "queue" | "stop" | "sending" | "stopping";

export interface SendStateInput {
  draft: string;
  /** Staged files that will go out with the message. */
  attachments: number;
  /** A file is still uploading: nothing may be sent without it. */
  uploading: boolean;
  connected: boolean;
  /** The first snapshot has arrived. */
  ready: boolean;
  /** This view holds the agent's input lease. */
  controlling: boolean;
  exited: boolean;
  working: boolean;
  /** This view's prompt is in flight. */
  sending: boolean;
  /** This view's stop request is in flight. */
  stopping: boolean;
}

export interface SendState {
  action: ComposerAction;
  /** The accessible name; kept stable (`Send`, `Queue message`, `Cancel turn`) for tests and screen readers. */
  label: string;
  disabled: boolean;
  /** Why the button is disabled, when the user can act on it. */
  reason: string | null;
}

const LABEL: Record<ComposerAction, string> = {
  send: "Send",
  queue: "Queue message",
  stop: "Cancel turn",
  sending: "Sending…",
  stopping: "Stopping…",
};

export function sendState(input: SendStateInput): SendState {
  const reason = !input.connected ? "Reconnecting…"
    : input.exited ? "The CLI exited"
    : !input.ready ? "Connecting to CLI…"
    : !input.controlling ? "Take control to send"
    : input.uploading ? "Uploading attachment…"
    : null;
  const hasDraft = input.draft.trim() !== "" || input.attachments > 0;
  const action: ComposerAction = input.sending ? "sending"
    : input.working && !hasDraft ? (input.stopping ? "stopping" : "stop")
    : input.working ? "queue" : "send";
  const disabled = action === "sending" || action === "stopping" || reason !== null || (action !== "stop" && !hasDraft);
  return { action, label: LABEL[action], disabled, reason: action === "sending" || action === "stopping" ? null : reason };
}

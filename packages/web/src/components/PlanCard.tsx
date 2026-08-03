import { usePerchStore, PLAN_APPROVAL_TEXT, type ChatMessage } from "../store";
import { renderMarkdown } from "../markdown";

/**
 * PlanCard — renders a `chat.plan` artifact (claude only; 2.1.x has no
 * `ExitPlanMode` tool, so `agent.rs` treats a `Write` under `/.claude/plans/`
 * as the plan itself and emits this instead of a normal tool card — see the
 * doc comment on `ClaudeStreamParser` in agent.rs). Deliberately styled as an
 * artifact awaiting a decision rather than another chat bubble: the plan body
 * plus a single "Approve & run" action that hands the turn back to the agent
 * with plan mode off.
 *
 * The button is spent after one click (`message.planApproved`) — a plan can
 * only be approved once, and the card sticks around in the transcript as a
 * record of what was approved and when, rather than disappearing or resetting.
 */
export function PlanCard({ message }: { message: ChatMessage }) {
  const sendChat = usePerchStore((s) => s.sendChat);
  const approvePlan = usePerchStore((s) => s.approvePlan);
  const streamingMessageId = usePerchStore((s) => s.streamingMessageId);

  const disabled = message.planApproved === true || streamingMessageId != null;

  const handleApprove = () => {
    if (disabled) return;
    // Approval always runs with plan mode off, regardless of whether the
    // composer's toggle is still on — otherwise the agent would come back
    // with *another* plan instead of executing this one.
    sendChat(PLAN_APPROVAL_TEXT);
    approvePlan(message.id);
  };

  return (
    <div className="plan-card" data-testid="plan-card">
      <div className="plan-card__header">
        <span className="plan-card__glyph" aria-hidden="true">
          ◇
        </span>
        <span className="plan-card__title">Plan</span>
      </div>
      <div
        className="plan-card__body message__markdown"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.text, false) }}
      />
      <div className="plan-card__footer">
        <button
          type="button"
          className="plan-card__approve"
          data-testid="plan-approve"
          disabled={disabled}
          onClick={handleApprove}
        >
          {message.planApproved ? "Approved" : "Approve & run"}
        </button>
      </div>
    </div>
  );
}

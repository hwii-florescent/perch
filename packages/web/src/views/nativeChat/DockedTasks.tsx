import type { NativeUiTask, NativeUiTaskList } from "@perch/shared";
import { cn } from "../../lib/cn";
import { CheckIcon } from "../../components/ui/icons";
import { CHAT_COLUMN } from "../../components/ui/chat";

const STATUS_WORDS: Record<NativeUiTask["status"], string> = { completed: "Completed", in_progress: "In progress", pending: "Pending" };
/** An in-progress task reads in its present tense when the agent gave one. */
const taskLabel = (task: NativeUiTask) => task.status === "in_progress" && task.activeForm ? task.activeForm : task.content;

function Marker({ status }: { status: NativeUiTask["status"] }) {
  if (status === "completed") return <CheckIcon size={13} className="mt-[0.2rem] shrink-0 text-green" />;
  return <span aria-hidden className={cn("mt-[0.3rem] size-[0.6rem] shrink-0 rounded-full border border-solid", status === "in_progress" ? "border-accent bg-accent" : "border-subtext-0")} />;
}

/** The agent's own to-do list, kept above the composer while it works. The core reads it from the
 * agent's plan calls (`native_ui/tasks.rs`); this only draws it. */
export function DockedTasks({ list }: { list: NativeUiTaskList }) {
  const done = list.tasks.filter((task) => task.status === "completed").length;
  return <div className="shrink-0 px-4 pb-1" data-testid="native-cli-tasks">
    <details open className={cn(CHAT_COLUMN, "rounded-soft bg-surface-0 px-3 py-1.5 text-[0.85rem] [&>summary]:cursor-pointer [&>summary]:select-none")}>
      <summary className="font-semibold">Tasks <span className="font-normal text-subtext-0">{done} of {list.tasks.length} completed</span></summary>
      <ul aria-label="Tasks" className="m-0 flex list-none flex-col gap-1 p-0 pt-1">
        {list.tasks.map((task, index) => <li key={`${task.content}:${index}`} className={cn("flex items-start gap-1.5", task.status === "in_progress" && "font-medium")}>
          <Marker status={task.status} />
          <span className="sr-only">{STATUS_WORDS[task.status]}: </span>
          <span className={cn("min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]", task.status === "completed" && "text-subtext-0 line-through")}>{taskLabel(task)}</span>
        </li>)}
      </ul>
    </details>
  </div>;
}

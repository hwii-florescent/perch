import type { NativeUiEnvelope } from "@perch/shared";
import { cn } from "../../lib/cn";
import { button } from "../../components/ui/button";
import { CopyButton } from "./CopyButton";

/** Who an envelope is from, in words. The core read it out of the delivered banner
 * (`crates/perch-core/src/agent_mail.rs::parse_envelope`); this only draws it. */
export function senderTitle(envelope: NativeUiEnvelope): string {
  if (envelope.sender === "person") return envelope.kind === "steer" ? "You steered this session" : "You, from the family strip";
  if (envelope.sender === "perch") return "Status from your sub-sessions";
  const from = [envelope.provider, envelope.label && `“${envelope.label}”`].filter(Boolean).join(" ");
  return `${envelope.kind === "steer" ? "Steer" : "Message"} from ${from || "another session"}`;
}

/** A message another session (or Perch) delivered to this one, drawn as a card titled with its sender and a link
 * back, never as the envelope's text. It is information from a peer, not the person's words. */
export function SenderCard({ envelope, blockId, turn, onOpen }: { envelope: NativeUiEnvelope; blockId: string; turn: string; onOpen: (sessionId: string) => void }) {
  const fromSession = envelope.sender === "session" ? envelope.session : undefined;
  return <article className={cn("group relative flex min-w-0 flex-col gap-1 rounded-soft bg-surface-0 px-3 py-2 text-[0.88rem] outline-1 outline-solid outline-surface-2")}
    data-native-role="user" data-native-turn={turn} data-block-id={blockId} data-testid="native-cli-sender-card" data-sender={envelope.sender} data-kind={envelope.kind} data-from-session={fromSession}>
    <div className="flex flex-wrap items-center gap-2 text-[0.8rem] text-subtext-0">
      <strong className="font-semibold text-fg" data-testid="native-cli-sender-title">{senderTitle(envelope)}</strong>
      <span>{envelope.at}</span>
      {fromSession && <button type="button" data-testid="native-cli-sender-open" onClick={() => onOpen(fromSession)} className={button({ size: "sm" })}>Open</button>}
    </div>
    <div className="whitespace-pre-wrap [overflow-wrap:anywhere]" data-testid="native-cli-sender-body">{envelope.body}</div>
    {envelope.fullTextPath && <div className="text-[0.78rem] text-subtext-0" data-testid="native-cli-sender-file">Full text ({envelope.chars ?? "more"} characters): <code>{envelope.fullTextPath}</code></div>}
    <CopyButton text={envelope.body} label="Copy text" className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100" />
  </article>;
}

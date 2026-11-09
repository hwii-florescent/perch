import { type NativeUiContext } from "@perch/sdk";

const compact = (tokens: number) => (tokens >= 1_000_000 ? `${+(tokens / 1_000_000).toFixed(1)}M` : tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : String(tokens));

/** "42k of 272k tokens (15%)"; a guessed window says so. Rounded and unclamped, so an over-full session reads above 100. */
export function contextLabel({ usedTokens, windowTokens, estimated }: NativeUiContext): string {
  const percent = Math.round((usedTokens / windowTokens) * 100);
  return `${compact(usedTokens)} of ${estimated ? "about " : ""}${compact(windowTokens)} tokens in context (${percent}%)`;
}

/** How full the model's context is. Quiet until it matters: amber from 70%, red from 90%. */
export function ContextRing({ context }: { context: NativeUiContext }) {
  const fraction = Math.min(1, context.usedTokens / context.windowTokens);
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  const tone = fraction >= 0.9 ? "text-red" : fraction >= 0.7 ? "text-yellow" : "text-subtext-0";
  return <span className={`native-cli-chat__context inline-flex items-center ${tone}`} role="img" aria-label={contextLabel(context)} title={contextLabel(context)} data-testid="native-cli-context" data-percent={Math.round(fraction * 100)}>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" strokeWidth="2" aria-hidden="true">
      <circle cx="8" cy="8" r={radius} stroke="currentColor" opacity="0.25" />
      <circle cx="8" cy="8" r={radius} stroke="currentColor" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - fraction)} transform="rotate(-90 8 8)" />
    </svg>
  </span>;
}

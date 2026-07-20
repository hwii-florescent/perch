import { usePerchStore } from "./store";

function formatTokens(n: number | undefined): string {
  if (n === undefined) return "-";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatCost(n: number | undefined): string {
  if (n === undefined) return "-";
  return `$${n.toFixed(3)}`;
}

export function StatusBar() {
  const connected = usePerchStore((s) => s.connected);
  const status = usePerchStore((s) => s.status);

  return (
    <footer className="status-bar">
      <span
        className={connected ? "status-dot status-dot--ok" : "status-dot status-dot--off"}
        title={connected ? "connected" : "reconnecting..."}
      />
      <span className="status-item status-item--cwd" title={status?.cwd}>
        {status?.cwd ?? "-"}
      </span>
      <span className="status-item">{status?.branch ?? ""}</span>
      <span className="status-item">ctx {formatTokens(status?.contextTokens)}</span>
      <span className="status-item">{formatCost(status?.costUsd)}</span>
    </footer>
  );
}

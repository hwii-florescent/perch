/** On-device evidence when a browser cannot connect. The report is built from
 * allowlisted connection metadata, never the relay link or browser storage. */
import { useState } from "react";
import { connectionReport, useRelayDiagnostics, type ConnectionStage } from "../relay/diagnostics";
import { button } from "./ui/button";

const STAGES: Record<ConnectionStage, string> = {
  direct: "Direct connection (no usable relay link found)",
  "link-ready": "Relay link loaded",
  "preparing-encryption": "Preparing browser encryption",
  "connecting-relay": "Connecting to the relay WebSocket",
  "waiting-for-computer": "Relay reached; waiting for the computer’s encrypted hello",
  "tunnel-ready": "Encrypted tunnel established",
  "opening-perch": "Opening Perch’s paired data socket",
  connected: "Perch data socket connected",
  failed: "Connection attempt failed",
};

export function ConnectionDetails() {
  const diagnostics = useRelayDiagnostics();
  const [notice, setNotice] = useState("");
  const report = connectionReport(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(connectionReport(false));
      setNotice("Diagnostic report copied.");
    } catch {
      setNotice("Clipboard unavailable. Select and copy the report below.");
    }
  }
  return (
    <details className="min-w-0 text-[0.875rem] leading-relaxed text-subtext-0" data-testid="connection-details">
      <summary className="min-h-11 cursor-pointer py-3 text-fg">Connection details</summary>
      <div className="flex max-h-[50dvh] min-w-0 flex-col gap-3 overflow-auto pb-3">
        <p className="m-0" role="status">{STAGES[diagnostics.stage]}</p>
        {diagnostics.error && <p className="m-0 text-fg">Last failure{diagnostics.failureStage ? ` (${STAGES[diagnostics.failureStage]})` : ""}: {diagnostics.error}{diagnostics.closeCode !== null ? ` (close code ${diagnostics.closeCode})` : ""}.</p>}
        <p className="m-0">This report excludes keys, pairing codes, device tokens, and workspace content.</p>
        <button type="button" className={button({ variant: "soft", size: "lg", className: "min-h-11 self-start" })} onClick={() => void copy()}>Copy diagnostic report</button>
        {notice && <p className="m-0" role="status">{notice}</p>}
        <pre className="m-0 select-text whitespace-pre-wrap break-words text-[0.875rem] text-fg" tabIndex={0} aria-label="Connection diagnostic report">{report}</pre>
      </div>
    </details>
  );
}

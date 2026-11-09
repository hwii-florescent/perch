/** The pairing QR. The encoder (`qrcode-generator`) is Perch's, so the Devices page gets this component from `@perch/sdk` rather than carrying a copy. */
import { useMemo } from "react";
import qrcode from "qrcode-generator";

/** Black on white with a quiet zone, whatever the theme: scanners need it. */
export function QrCode({ text }: { text: string }) {
  const { size, path } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    let d = "";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
    }
    return { size: count, path: d };
  }, [text]);
  return (
    <svg
      viewBox={`-4 -4 ${size + 8} ${size + 8}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Pairing QR code"
      data-testid="pair-qr"
      className="h-44 w-44 shrink-0 rounded-ui"
    >
      <rect x={-4} y={-4} width={size + 8} height={size + 8} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}

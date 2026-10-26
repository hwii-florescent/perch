import { useEffect, useState, type ReactNode } from "react";

/** A site's favicon at tab size, or `fallback` when it has none or fails to load (offline, blocked). */
export function PageIcon({ icon, fallback }: { icon: string | undefined; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [icon]);
  if (!icon || failed) return <>{fallback}</>;
  return <img src={icon} alt="" width={14} height={14} className="size-[14px] rounded-[2px] object-contain" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

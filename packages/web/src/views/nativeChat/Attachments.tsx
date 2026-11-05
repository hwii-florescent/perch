import { useEffect } from "react";
import type { StagedAttachment } from "../../attachments";

export type ComposerImage = StagedAttachment & { previewUrl?: string };

/** Revoke a thumbnail's object URL once its chip is gone. */
function Thumb({ url }: { url: string }) {
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt="" className="size-6 shrink-0 rounded-[0.25rem] object-cover" />;
}

/** Staged files above the textarea; each is removable until it is sent. */
export function Attachments({ items, onRemove }: { items: ComposerImage[]; onRemove: (id: string) => void }) {
  if (!items.length) return null;
  return <ul className="m-0 flex list-none flex-wrap gap-1 px-2 pt-2" aria-label="Attachments" data-testid="native-cli-attachments">
    {items.map((item) => <li key={item.id} className="flex max-w-[14rem] items-center gap-1.5 rounded-ui border border-overlay-0 bg-panel-bg py-0.5 pr-1 pl-1 text-[0.78rem] text-subtext-0">
      {item.previewUrl && <Thumb url={item.previewUrl} />}
      <span className="min-w-0 truncate" title={item.path}>{item.name}</span>
      <button type="button" className="cursor-pointer bg-transparent px-1 text-subtext-0 [border:none] hover:text-fg" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.id)}>×</button>
    </li>)}
  </ul>;
}

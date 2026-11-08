import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { StagedAttachment } from "../../attachments";
import { CloseIcon } from "../../components/ui/icons";

/** `file` is the picked image itself, kept so a thumbnail can be drawn again after the chat view was unmounted. */
export type ComposerImage = StagedAttachment & { file?: File };

/** An object URL that lives exactly as long as the component using it (created and revoked in one effect, so a
 * remount or a double effect run never leaves a revoked URL behind). */
function useObjectUrl(file: File): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const made = URL.createObjectURL(file);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [file]);
  return url;
}

/** The picture full size over the page. Escape, a click anywhere or Close dismisses it. */
function Lightbox({ file, name, onClose }: { file: File; name: string; onClose: () => void }) {
  const url = useObjectUrl(file);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(0,0,0,0.7)] p-6" role="dialog" aria-modal="true" aria-label={`Preview of ${name}`} data-testid="native-cli-image-preview" onClick={onClose}>
      {url && <img src={url} alt={name} className="max-h-full max-w-full rounded-ui object-contain shadow-[0_8px_32px_rgba(0,0,0,0.5)]" />}
      <button type="button" className="absolute top-4 right-4 flex size-8 cursor-pointer items-center justify-center rounded-full bg-surface-1 text-fg [border:0] hover:bg-surface-0" aria-label="Close preview" onClick={onClose}><CloseIcon size={14} /></button>
    </div>,
    document.body,
  );
}

function ImageTile({ item, file, onRemove }: { item: ComposerImage; file: File; onRemove: () => void }) {
  const url = useObjectUrl(file);
  const [open, setOpen] = useState(false);
  return <li className="group relative size-14 shrink-0">
    <button type="button" className="size-full cursor-pointer overflow-hidden rounded-ui bg-surface-1 p-0 [border:0]" title={`${item.name}, click to preview`} aria-label={`Preview ${item.name}`} onClick={() => setOpen(true)}>
      {url && <img src={url} alt="" className="size-full object-cover" />}
    </button>
    <button type="button" className="absolute -top-1.5 -right-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full bg-surface-1 text-subtext-0 shadow-[0_1px_4px_rgba(0,0,0,0.4)] [border:0] hover:text-fg" aria-label={`Remove ${item.name}`} onClick={onRemove}><CloseIcon size={10} /></button>
    {open && <Lightbox file={file} name={item.name} onClose={() => setOpen(false)} />}
  </li>;
}

/** Staged files above the textarea; each is removable until it is sent. Pictures are thumbnails you can open, other files a chip. */
export function Attachments({ items, onRemove }: { items: ComposerImage[]; onRemove: (id: string) => void }) {
  if (!items.length) return null;
  return <ul className="m-0 flex list-none flex-wrap items-center gap-2 px-3 pt-2.5" aria-label="Attachments" data-testid="native-cli-attachments">
    {items.map((item) => item.file?.type.startsWith("image/")
      ? <ImageTile key={item.id} item={item} file={item.file} onRemove={() => onRemove(item.id)} />
      : <li key={item.id} className="flex max-w-[14rem] items-center gap-1.5 rounded-ui bg-surface-1 py-0.5 pr-1 pl-2 text-[0.78rem] text-subtext-0">
        <span className="min-w-0 truncate" title={item.path}>{item.name}</span>
        <button type="button" className="cursor-pointer bg-transparent px-1 text-subtext-0 [border:none] hover:text-fg" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.id)}>×</button>
      </li>)}
  </ul>;
}

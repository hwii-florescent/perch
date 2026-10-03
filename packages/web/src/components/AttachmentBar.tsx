import { useRef } from "react";
import type { StagedAttachment } from "../attachments";
import { cn } from "../lib/cn";
import { ATTACH_BAR, ATTACH_BTN, ATTACH_CHIP, ATTACH_CHIPS, ATTACH_ERROR, ATTACH_NAME, ATTACH_REMOVE } from "./ui/composer";

/**
 * AttachmentBar — presentation for the composer's staged-file row: the attach
 * button, one chip per staged upload, and an inline error line when a upload
 * fails. All upload/network state (the actual `uploadAttachment` calls, the
 * staged list itself) lives in `ChatView` so `submit()` can read it directly
 * — this component only renders what it's handed and reports user intent
 * (files picked, chip removed) back up via callbacks.
 *
 * Deliberately name-only: chips never render a thumbnail or preview from the
 * file's bytes (no `FileReader`, no `URL.createObjectURL`). Only the
 * server-staged *path* ever crosses the WS wire (see attachments.ts's doc
 * comment on why), and keeping the DOM itself free of any data: URI / base64
 * blob is part of that guarantee — an e2e test asserts the page never
 * contains one.
 *
 * Testids: `composer-attach` (the button that opens the file picker),
 * `attachment-chip-<name>` (each staged chip), and
 * `attachment-remove-<name>` (that chip's ✕ button). Names are assumed
 * reasonably unique for a single composer's staged set; the server already
 * de-dupes/sanitizes filenames on disk, so collisions here are rare and
 * inconsequential (worst case two chips share a testid).
 */
export function AttachmentBar({
  staged,
  onRemove,
  onFiles,
  error,
  disabled,
}: {
  staged: StagedAttachment[];
  onRemove: (id: string) => void;
  onFiles: (files: FileList | File[]) => void;
  error: string | null;
  disabled: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleAttachClick() {
    fileInputRef.current?.click();
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
    // Reset so picking the exact same file again still fires onChange.
    e.target.value = "";
  }

  return (
    <div className={cn("attachment-bar", ATTACH_BAR)}>
      <button
        type="button"
        className={cn("attachment-bar__attach", ATTACH_BTN)}
        data-testid="composer-attach"
        onClick={handleAttachClick}
        disabled={disabled}
        title="Attach files"
      >
        📎
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="attachment-bar__input hidden"
        onChange={handleFileInputChange}
      />
      {staged.length > 0 && (
        <div className={cn("attachment-bar__chips", ATTACH_CHIPS)}>
          {staged.map((a) => (
            <span key={a.id} className={cn("attachment-chip", ATTACH_CHIP)} data-testid={`attachment-chip-${a.name}`}>
              <span className={cn("attachment-chip__name", ATTACH_NAME)} title={a.name}>
                {a.name}
              </span>
              <button
                type="button"
                className={cn("attachment-chip__remove", ATTACH_REMOVE)}
                data-testid={`attachment-remove-${a.name}`}
                onClick={() => onRemove(a.id)}
                title="Remove attachment"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {error && <div className={cn("attachment-bar__error", ATTACH_ERROR)}>{error}</div>}
    </div>
  );
}

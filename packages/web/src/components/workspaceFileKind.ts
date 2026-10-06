export type AssetKind = "image" | "video" | "audio" | "pdf" | "archive";

const ARCHIVE_MEDIA_TYPES = ["application/zip", "application/x-tar", "application/gzip"];

/** Which non-text viewer a file's media type opens in, if any. The server's
 * `media_type_for_name` assigns the types and `file_content` decides which of
 * them may render inline; keep all three in step. */
export function assetKind(mediaType: string | undefined): AssetKind | undefined {
  const mime = mediaType ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  if (ARCHIVE_MEDIA_TYPES.includes(mime)) return "archive";
  return undefined;
}

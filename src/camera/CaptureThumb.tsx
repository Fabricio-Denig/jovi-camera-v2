import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import type { CapturedMedia } from "../types/camera";

interface CaptureThumbProps {
  media: CapturedMedia | null;
  onOpen: () => void;
}

/** Small preview of the last capture, bottom-left — tapping it opens the full viewer. */
export function CaptureThumb({ media, onOpen }: CaptureThumbProps) {
  const url = useObjectUrl(media?.blob);

  if (!media || !url) {
    return <div className="size-12 rounded-xl border border-white/20" />;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Ver última captura"
      className="size-12 overflow-hidden rounded-xl border border-white/30 active:opacity-80"
    >
      {media.kind === "photo" ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <video src={url} className="size-full object-cover" muted />
      )}
    </button>
  );
}

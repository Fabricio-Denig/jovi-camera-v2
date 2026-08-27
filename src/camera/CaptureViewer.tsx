import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import type { CapturedMedia } from "../types/camera";

interface CaptureViewerProps {
  media: CapturedMedia;
  onClose: () => void;
  /** Absent when the viewer is opened somewhere the capture cannot be edited. */
  onToggleFavorite?: () => void;
  onTrash?: () => void;
}

/**
 * A single capture, full screen.
 *
 * The two actions live here rather than on the thumbnail: a grid where every
 * cell carries buttons is a grid you cannot tap, and both of these want the
 * student to be looking at the thing before they act on it. Throwing away is
 * not confirmed here because it is not final — it goes to the trash, and the
 * trash is one chip away.
 */
export function CaptureViewer({
  media,
  onClose,
  onToggleFavorite,
  onTrash,
}: CaptureViewerProps) {
  const url = useObjectUrl(media.blob);

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 pt-[max(12px,env(safe-area-inset-top))]">
        <span className="font-mono text-xs text-ink-muted">
          {media.kind === "photo" ? "Foto" : "Vídeo"} ·{" "}
          {new Date(media.createdAt).toLocaleTimeString("pt-BR")}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink active:opacity-80"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden">
        {url && media.kind === "photo" && (
          <img
            src={url}
            alt="Captura"
            className="max-h-full max-w-full object-contain"
          />
        )}
        {url && media.kind === "video" && (
          <video
            src={url}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>

      {(onToggleFavorite || onTrash) && (
        <div className="flex items-center justify-center gap-3 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          {onToggleFavorite && (
            <button
              type="button"
              onClick={onToggleFavorite}
              aria-pressed={Boolean(media.favorite)}
              aria-label={
                media.favorite ? "Remover dos favoritos" : "Marcar como favorito"
              }
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[13.5px] font-medium active:opacity-70 ${
                media.favorite
                  ? "bg-accent-soft text-accent"
                  : "bg-surface-2 text-ink"
              }`}
            >
              <span aria-hidden="true">{media.favorite ? "★" : "☆"}</span>
              {media.favorite ? "Favorito" : "Favoritar"}
            </button>
          )}
          {onTrash && (
            <button
              type="button"
              onClick={onTrash}
              aria-label="Mover para a lixeira"
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-surface-2 text-[13.5px] font-medium text-ink active:opacity-70"
            >
              <span aria-hidden="true">🗑</span>
              Apagar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

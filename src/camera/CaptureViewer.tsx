import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import type { CapturedMedia } from "../types/camera";

interface CaptureViewerProps {
  media: CapturedMedia;
  onClose: () => void;
}

/**
 * Minimal full-screen viewer for a single capture — this is the "visualizar
 * depois" requirement for day 1. The real gallery (grid, albums, sessions)
 * is out of scope until day 2.
 */
export function CaptureViewer({ media, onClose }: CaptureViewerProps) {
  const url = useObjectUrl(media.blob);

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3">
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
    </div>
  );
}

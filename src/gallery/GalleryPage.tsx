import { useEffect, useState } from "react";
import { CaptureViewer } from "../camera/CaptureViewer";
import { getAllCaptures } from "../shared/lib/mediaStore";
import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import type { CapturedMedia } from "../types/camera";

interface GalleryPageProps {
  /** Bumped by the shell after each capture so the grid refetches. */
  refreshKey: number;
}

/**
 * Grid of everything captured on this device. Albums, tabs and deletion come
 * with the full gallery; this already reads real persisted media rather than
 * standing in for it.
 */
export function GalleryPage({ refreshKey }: GalleryPageProps) {
  const [items, setItems] = useState<CapturedMedia[] | null>(null);
  const [selected, setSelected] = useState<CapturedMedia | null>(null);

  useEffect(() => {
    let active = true;
    void getAllCaptures().then((media) => {
      if (active) setItems(media);
    });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-canvas">
      <header className="px-5 pb-3 pt-[max(20px,env(safe-area-inset-top))]">
        <h1 className="text-2xl font-semibold text-ink">Galeria</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          {items === null
            ? "Carregando…"
            : items.length === 0
              ? "Nada capturado ainda"
              : `${items.length} ${items.length === 1 ? "captura" : "capturas"} neste dispositivo`}
        </p>
      </header>

      {items !== null && items.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-2xl">
            📷
          </div>
          <p className="text-sm text-ink-muted">
            Suas fotos e vídeos aparecem aqui assim que você capturar o primeiro.
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="grid grid-cols-3 gap-1 px-1 pb-6">
          {items.map((media) => (
            <li key={media.id}>
              <GalleryThumb media={media} onOpen={() => setSelected(media)} />
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <CaptureViewer media={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function GalleryThumb({
  media,
  onOpen,
}: {
  media: CapturedMedia;
  onOpen: () => void;
}) {
  const url = useObjectUrl(media.blob);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir ${media.kind === "photo" ? "foto" : "vídeo"}`}
      className="relative block aspect-square w-full overflow-hidden bg-surface-2 active:opacity-80"
    >
      {url &&
        (media.kind === "photo" ? (
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <video src={url} className="size-full object-cover" muted />
        ))}
      {media.kind === "video" && (
        <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">
          vídeo
        </span>
      )}
    </button>
  );
}

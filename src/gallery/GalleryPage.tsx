import { useEffect, useState } from "react";
import { CaptureViewer } from "../camera/CaptureViewer";
import { getAllCaptures } from "../shared/lib/mediaStore";
import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import type { CapturedMedia } from "../types/camera";

interface GalleryPageProps {
  /** Bumped by the shell after each capture so the grid refetches. */
  refreshKey: number;
  onOpenClass: (classId: string) => void;
}

/**
 * Grid of everything captured on this device. Albums, tabs and deletion come
 * with the full gallery; this already reads real persisted media rather than
 * standing in for it.
 */
export function GalleryPage({ refreshKey, onOpenClass }: GalleryPageProps) {
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
              ? "Nada guardado ainda"
              : `${items.length} ${items.length === 1 ? "item" : "itens"}`}
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
        <div className="pb-6">
          {groupBySession(items).map((group) => (
            <section key={group.key} className="mb-5">
              {group.subject &&
                (group.key === "__loose" ? (
                  <header className="flex items-baseline justify-between px-4 pb-2">
                    <h2 className="text-[15px] font-medium text-ink">
                      {group.subject}
                    </h2>
                    <span className="font-mono text-[11px] text-ink-muted">
                      {group.items.length}{" "}
                      {group.items.length === 1 ? "item" : "itens"}
                    </span>
                  </header>
                ) : (
                  // A class is a thing you open, not a heading over a grid.
                  <button
                    type="button"
                    onClick={() => onOpenClass(group.key)}
                    className="flex min-h-11 w-full items-baseline justify-between px-4 pb-2 text-left active:opacity-70"
                  >
                    <h2 className="text-[15px] font-medium text-ink">
                      {group.subject}
                    </h2>
                    <span className="shrink-0 pl-3 text-[12px] font-medium text-accent">
                      Ver aula ·{" "}
                      {group.items.length === 1
                        ? "1 momento"
                        : `${group.items.length} momentos`}
                    </span>
                  </button>
                ))}
              <ul className="grid grid-cols-3 gap-1 px-1">
                {group.items.map((media) => (
                  <li key={media.id}>
                    <GalleryThumb
                      media={media}
                      onOpen={() => setSelected(media)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {selected && (
        <CaptureViewer media={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

interface Group {
  key: string;
  subject: string | null;
  items: CapturedMedia[];
}

/**
 * SliD captures stay grouped under the class they came from, in the order the
 * class happened. Loose photos and videos fall into a single "Outras" group —
 * keeping a session together is the point, not sorting everything else.
 */
function groupBySession(items: CapturedMedia[]): Group[] {
  const sessions = new Map<string, Group>();
  const loose: CapturedMedia[] = [];

  for (const media of items) {
    if (!media.session) {
      loose.push(media);
      continue;
    }
    const existing = sessions.get(media.session.id);
    if (existing) existing.items.push(media);
    else
      sessions.set(media.session.id, {
        key: media.session.id,
        subject: media.session.subject,
        items: [media],
      });
  }

  for (const group of sessions.values()) {
    group.items.sort((a, b) => (a.session!.atMs ?? 0) - (b.session!.atMs ?? 0));
  }

  const groups = [...sessions.values()];
  if (loose.length > 0) {
    groups.push({
      key: "__loose",
      subject: groups.length > 0 ? "Outras capturas" : null,
      items: loose,
    });
  }
  return groups;
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

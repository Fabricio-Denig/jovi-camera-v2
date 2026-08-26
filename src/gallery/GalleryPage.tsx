import { useEffect, useState } from "react";
import { CaptureViewer } from "../camera/CaptureViewer";
import { getClasses, type ClassRecord } from "../slid/classes";
import { getAllCaptures } from "../shared/lib/mediaStore";
import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import type { CapturedMedia } from "../types/camera";

interface GalleryPageProps {
  /** Bumped by the shell after each capture so the page refetches. */
  refreshKey: number;
  onOpenClass: (classId: string) => void;
}

/**
 * Minhas aulas — the archive, and only that.
 *
 * The unit of this product is a class, not a photograph. A grid of thumbnails
 * says the opposite: it turns a followed lecture back into a camera roll, which
 * is the reading the whole session works to avoid. So classes are what this
 * screen lists, and the frames live inside them.
 *
 * Loose photos and videos still have to go somewhere, so they keep a grid at
 * the bottom — below the classes, where they belong.
 */
export function GalleryPage({ refreshKey, onOpenClass }: GalleryPageProps) {
  const [classes, setClasses] = useState<ClassRecord[] | null>(null);
  const [loose, setLoose] = useState<CapturedMedia[]>([]);
  const [selected, setSelected] = useState<CapturedMedia | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([getClasses(), getAllCaptures()]).then(
      ([records, media]) => {
        if (!active) return;
        setClasses(records);
        setLoose(media.filter((item) => !item.session));
      },
    );
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const count = classes?.length ?? 0;
  const empty = classes !== null && count === 0 && loose.length === 0;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-canvas">
      <header className="px-5 pb-4 pt-[max(20px,env(safe-area-inset-top))]">
        <h1 className="text-2xl font-semibold text-ink">Minhas aulas</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          {classes === null
            ? "Carregando…"
            : count === 0
              ? "Nenhuma aula guardada ainda"
              : `${count} ${count === 1 ? "aula acompanhada" : "aulas acompanhadas"}`}
        </p>
      </header>

      {empty && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-2xl">
            📚
          </div>
          <p className="text-sm text-ink-muted">
            Abra o SliD durante uma aula e ela aparece aqui, organizada sozinha.
          </p>
        </div>
      )}

      {classes && count > 0 && (
        <ul className="flex flex-col gap-2 px-4 pb-2">
          {classes.map((record) => (
            <li key={record.id}>
              <ClassCard record={record} onOpen={() => onOpenClass(record.id)} />
            </li>
          ))}
        </ul>
      )}

      {loose.length > 0 && (
        <section className="mt-4 pb-6">
          <h2 className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Outras capturas
          </h2>
          <ul className="grid grid-cols-3 gap-1 px-1">
            {loose.map((media) => (
              <li key={media.id}>
                <GalleryThumb media={media} onOpen={() => setSelected(media)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {selected && (
        <CaptureViewer media={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

/**
 * A class as it is remembered: the frame it opened with, what it was called,
 * and what the camera found in it.
 */
function ClassCard({
  record,
  onOpen,
}: {
  record: ClassRecord;
  onOpen: () => void;
}) {
  const cover = record.moments[0]?.media.blob;
  const url = useObjectUrl(cover);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir a aula ${record.subject}`}
      className="flex w-full items-center gap-3.5 rounded-2xl bg-surface-2 p-3 text-left active:opacity-70"
    >
      <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-canvas">
        {url && <img src={url} alt="" className="size-full object-cover" />}
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[15.5px] font-medium text-ink">
          {record.subject}
        </h2>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">
          {record.moments.length === 1
            ? "1 momento capturado"
            : `${record.moments.length} momentos capturados`}
        </p>
        <p className="mt-0.5 text-[11.5px] text-ink-muted/70">
          {formatDate(record.savedAt)}
        </p>
      </div>

      <span aria-hidden="true" className="shrink-0 pr-1 text-ink-muted">
        <ChevronIcon />
      </span>
    </button>
  );
}

function formatDate(at: number): string {
  return new Date(at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
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

function ChevronIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

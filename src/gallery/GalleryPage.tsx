import { useEffect, useMemo, useState } from "react";
import { CaptureViewer } from "../camera/CaptureViewer";
import { ClassCard, formatDate } from "./ClassCard";
import { type Chip, FilterChips } from "./FilterChips";
import {
  deleteClassForever,
  getClasses,
  getTrashedClasses,
  restoreClass,
  type ClassRecord,
} from "../slid/classes";
import {
  deleteCapturesForever,
  getAllCaptures,
  getTrashedCaptures,
  restoreCaptures,
  setFavorite,
  trashCaptures,
} from "../shared/lib/mediaStore";
import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import type { CapturedMedia } from "../types/camera";

interface GalleryPageProps {
  /** Bumped by the shell after each capture so the page refetches. */
  refreshKey: number;
  onOpenClass: (classId: string) => void;
  /**
   * Reported so the shell can stand its navigation down. The viewer is a
   * full-screen document, but this page is drawn inside a stacking context of
   * its own — no z-index inside it can reach past the nav bar, which sat over
   * the viewer's actions and ate the taps meant for them.
   */
  onViewerOpenChange?: (open: boolean) => void;
}

/**
 * Galeria — everything the student captured, with SliD as one way of looking
 * at it.
 *
 * This screen used to open on "Minhas aulas", which put the argument before
 * the product: a student who had taken two photos found a library of nothing.
 * A camera's gallery is a gallery. So the roll is what opens, and the chips
 * offer the other readings — including the one where the same captures are
 * classes rather than photographs.
 *
 * The chips are the whole navigation of this screen. There is no second page,
 * no menu and no mode: changing what you are looking at is one tap, and the
 * trash is one of the things you can look at, which is what makes throwing a
 * class away safe.
 */
type View = "todas" | "fotos" | "videos" | "favoritos" | "slid" | "lixeira";

export function GalleryPage({
  refreshKey,
  onOpenClass,
  onViewerOpenChange,
}: GalleryPageProps) {
  const [media, setMedia] = useState<CapturedMedia[] | null>(null);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [trashedMedia, setTrashedMedia] = useState<CapturedMedia[]>([]);
  const [trashedClasses, setTrashedClasses] = useState<ClassRecord[]>([]);
  const [view, setView] = useState<View>("todas");
  const [discipline, setDiscipline] = useState("todas");
  const [selected, setSelected] = useState<CapturedMedia | null>(null);
  /** Bumped by anything on this screen that writes, so the lists reload. */
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all([
      getAllCaptures(),
      getClasses(),
      getTrashedCaptures(),
      getTrashedClasses(),
    ]).then(([items, records, trashed, trashedRecords]) => {
      if (!active) return;
      setMedia(items);
      setClasses(records);
      setTrashedMedia(trashed.filter((item) => !item.session));
      setTrashedClasses(trashedRecords);
    });
    return () => {
      active = false;
    };
  }, [refreshKey, localRefresh]);

  const reload = () => setLocalRefresh((n) => n + 1);

  useEffect(() => {
    onViewerOpenChange?.(selected !== null);
  }, [selected, onViewerOpenChange]);
  // Leaving the tab with a capture open must not leave the navigation hidden.
  useEffect(() => () => onViewerOpenChange?.(false), [onViewerOpenChange]);

  // The open capture has to follow the store, or favouriting from the viewer
  // shows a star that snaps back when it closes.
  useEffect(() => {
    if (!selected || !media) return;
    const fresh = media.find((item) => item.id === selected.id);
    if (fresh && fresh.favorite !== selected.favorite) setSelected(fresh);
  }, [media, selected]);

  const photos = useMemo(
    () => (media ?? []).filter((item) => item.kind === "photo"),
    [media],
  );
  const videos = useMemo(
    () => (media ?? []).filter((item) => item.kind === "video"),
    [media],
  );
  const favorites = useMemo(
    () => (media ?? []).filter((item) => item.favorite),
    [media],
  );

  /** Only matérias that classes are actually filed under get a chip. */
  const disciplines = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of classes) {
      if (!record.discipline) continue;
      counts.set(record.discipline, (counts.get(record.discipline) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [classes]);

  const shownClasses = useMemo(() => {
    if (discipline === "todas") return classes;
    if (discipline === "favoritas") return classes.filter((r) => r.favorite);
    return classes.filter((record) => record.discipline === discipline);
  }, [classes, discipline]);

  const trashCount = trashedMedia.length + trashedClasses.length;

  const chips: Chip[] = [
    { id: "todas", label: "Todas", count: media?.length ?? 0 },
    { id: "fotos", label: "Fotos", count: photos.length },
    { id: "videos", label: "Vídeos", count: videos.length },
    { id: "favoritos", label: "Favoritos", count: favorites.length },
    { id: "slid", label: "SliD", count: classes.length },
    { id: "lixeira", label: "Lixeira", count: trashCount },
  ];

  const grid =
    view === "fotos"
      ? photos
      : view === "videos"
        ? videos
        : view === "favoritos"
          ? favorites
          : (media ?? []);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-canvas">
      <header className="px-5 pb-3 pt-[max(20px,env(safe-area-inset-top))]">
        <h1 className="text-2xl font-semibold text-ink">Galeria</h1>
        <p className="mt-0.5 mb-3 text-[13px] text-ink-muted">
          {media === null ? "Carregando…" : describe(view, grid.length, classes.length, trashCount)}
        </p>
        <FilterChips
          chips={chips}
          active={view}
          onSelect={(id) => setView(id as View)}
          label="Filtrar a galeria"
        />
      </header>

      {media !== null && view === "slid" && (
        <SlidView
          classes={shownClasses}
          total={classes.length}
          disciplines={disciplines}
          active={discipline}
          favorites={classes.filter((r) => r.favorite).length}
          onSelectDiscipline={setDiscipline}
          onOpenClass={onOpenClass}
        />
      )}

      {media !== null && view === "lixeira" && (
        <TrashView
          classes={trashedClasses}
          media={trashedMedia}
          onChanged={reload}
        />
      )}

      {media !== null && view !== "slid" && view !== "lixeira" && (
        <>
          {grid.length === 0 ? (
            <EmptyState view={view} />
          ) : (
            <ul className="grid grid-cols-3 gap-1 px-1 pb-6">
              {grid.map((item) => (
                <li key={item.id}>
                  <GalleryThumb media={item} onOpen={() => setSelected(item)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {selected && (
        <CaptureViewer
          media={selected}
          onClose={() => setSelected(null)}
          onToggleFavorite={async () => {
            await setFavorite(selected.id, !selected.favorite);
            reload();
          }}
          onTrash={async () => {
            await trashCaptures((item) => item.id === selected.id);
            setSelected(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function describe(
  view: View,
  shown: number,
  classes: number,
  trash: number,
): string {
  if (view === "slid")
    return classes === 0
      ? "Nenhuma aula acompanhada ainda"
      : `${classes} ${classes === 1 ? "aula acompanhada" : "aulas acompanhadas"}`;
  if (view === "lixeira")
    return trash === 0 ? "A lixeira está vazia" : `${trash} ${trash === 1 ? "item" : "itens"} na lixeira`;
  return shown === 0
    ? "Nada guardado ainda"
    : `${shown} ${shown === 1 ? "captura" : "capturas"}`;
}

function EmptyState({ view }: { view: View }) {
  const text =
    view === "favoritos"
      ? "Abra uma captura e toque na estrela para guardá-la aqui."
      : view === "videos"
        ? "Nenhum vídeo gravado ainda."
        : view === "fotos"
          ? "Nenhuma foto tirada ainda."
          : "Suas fotos, vídeos e aulas aparecem aqui.";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-2xl">
        {view === "favoritos" ? "★" : "🖼"}
      </div>
      <p className="text-sm text-ink-muted">{text}</p>
    </div>
  );
}

/**
 * The same captures, read as classes. The matéria chips only appear once there
 * is more than one matéria to choose between — a filter with a single option
 * is furniture.
 */
function SlidView({
  classes,
  total,
  disciplines,
  active,
  favorites,
  onSelectDiscipline,
  onOpenClass,
}: {
  classes: ClassRecord[];
  total: number;
  disciplines: [string, number][];
  active: string;
  favorites: number;
  onSelectDiscipline: (id: string) => void;
  onOpenClass: (id: string) => void;
}) {
  const chips: Chip[] = [
    { id: "todas", label: "Todas as aulas", count: total },
    ...(favorites > 0
      ? [{ id: "favoritas", label: "Favoritas", count: favorites }]
      : []),
    ...disciplines.map(([name, count]) => ({ id: name, label: name, count })),
  ];

  if (total === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-2xl">
          📚
        </div>
        <p className="text-sm text-ink-muted">
          Abra o SliD durante uma aula e ela aparece aqui, organizada sozinha.
        </p>
      </div>
    );
  }

  return (
    <>
      {chips.length > 1 && (
        <div className="px-5 pb-3 pt-1">
          <FilterChips
            chips={chips}
            active={active}
            onSelect={onSelectDiscipline}
            label="Filtrar por matéria"
          />
        </div>
      )}
      {classes.length === 0 ? (
        <p className="px-8 py-10 text-center text-sm text-ink-muted">
          Nenhuma aula nesta matéria.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 px-4 pb-6">
          {classes.map((record) => (
            <li key={record.id}>
              <ClassCard record={record} onOpen={() => onOpenClass(record.id)} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * The trash, and the promise that makes deleting safe: everything here can
 * come back whole. Emptying it is the one action in the app with no undo, so
 * it asks first and says exactly what will go.
 */
function TrashView({
  classes,
  media,
  onChanged,
}: {
  classes: ClassRecord[];
  media: CapturedMedia[];
  onChanged: () => void;
}) {
  const [confirming, setConfirming] = useState<
    { kind: "class"; id: string; name: string } | { kind: "media"; id: string } | null
  >(null);

  if (classes.length === 0 && media.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-2xl">
          🗑
        </div>
        <p className="text-sm text-ink-muted">
          A lixeira está vazia. O que você apagar fica aqui até você apagar de
          vez.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      {classes.length > 0 && (
        <ul className="flex flex-col gap-2 px-4">
          {classes.map((record) => (
            <li
              key={record.id}
              className="rounded-2xl bg-surface-2 px-3.5 py-3"
            >
              <p className="truncate text-[15px] font-medium text-ink">
                {record.subject}
              </p>
              <p className="mt-0.5 text-[12px] text-ink-muted">
                {record.discipline ? `${record.discipline} · ` : ""}
                {record.moments.length}{" "}
                {record.moments.length === 1 ? "momento" : "momentos"} ·{" "}
                {formatDate(record.savedAt)}
              </p>
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await restoreClass(record.id);
                    onChanged();
                  }}
                  className="min-h-9 flex-1 rounded-xl bg-accent px-3 text-[13px] font-medium text-accent-ink active:opacity-80"
                >
                  Restaurar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirming({
                      kind: "class",
                      id: record.id,
                      name: record.subject,
                    })
                  }
                  className="min-h-9 flex-1 rounded-xl bg-canvas px-3 text-[13px] font-medium text-danger active:opacity-70"
                >
                  Apagar de vez
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {media.length > 0 && (
        <section>
          <h2 className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Fotos e vídeos
          </h2>
          <ul className="grid grid-cols-3 gap-1 px-1">
            {media.map((item) => (
              <li key={item.id} className="relative">
                <TrashedThumb
                  media={item}
                  onRestore={async () => {
                    await restoreCaptures((m) => m.id === item.id);
                    onChanged();
                  }}
                  onDelete={() => setConfirming({ kind: "media", id: item.id })}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {confirming && (
        <ConfirmDelete
          name={confirming.kind === "class" ? confirming.name : null}
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            if (confirming.kind === "class")
              await deleteClassForever(confirming.id);
            else await deleteCapturesForever((m) => m.id === confirming.id);
            setConfirming(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function ConfirmDelete({
  name,
  onCancel,
  onConfirm,
}: {
  name: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Apagar de vez"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-8 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm animate-[slid-rise_220ms_ease-out] rounded-2xl bg-canvas p-5">
        <h2 className="text-[16px] font-semibold text-ink">
          {name ? `Apagar "${name}" de vez?` : "Apagar de vez?"}
        </h2>
        <p className="mt-1 text-[13px] leading-snug text-ink-muted">
          {name
            ? "Todos os momentos desta aula serão perdidos."
            : "Esta captura será perdida."}{" "}
          Não dá para desfazer.
        </p>
        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-xl bg-accent text-[13.5px] font-medium text-accent-ink active:opacity-80"
          >
            Manter
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 flex-1 rounded-xl bg-surface-2 text-[13.5px] font-medium text-danger active:opacity-70"
          >
            Apagar de vez
          </button>
        </div>
      </div>
    </div>
  );
}

function TrashedThumb({
  media,
  onRestore,
  onDelete,
}: {
  media: CapturedMedia;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const url = useObjectUrl(media.blob);
  return (
    <div className="relative aspect-square w-full overflow-hidden bg-surface-2">
      {url &&
        (media.kind === "photo" ? (
          <img src={url} alt="" className="size-full object-cover opacity-50" />
        ) : (
          <video src={url} className="size-full object-cover opacity-50" muted />
        ))}
      <div className="absolute inset-x-0 bottom-0 flex">
        <button
          type="button"
          onClick={onRestore}
          aria-label="Restaurar"
          className="min-h-9 flex-1 bg-black/65 text-[11px] font-medium text-ink active:opacity-70"
        >
          Restaurar
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Apagar de vez"
          className="min-h-9 flex-1 bg-black/65 text-[11px] font-medium text-danger active:opacity-70"
        >
          Apagar
        </button>
      </div>
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
      {media.favorite && (
        <span
          aria-hidden="true"
          className="absolute left-1 top-1 text-[13px] text-accent drop-shadow"
        >
          ★
        </span>
      )}
      {media.session && (
        <span className="absolute bottom-1 left-1 rounded bg-accent/85 px-1 text-[9.5px] font-medium text-accent-ink">
          SliD
        </span>
      )}
      {media.kind === "video" && (
        <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">
          vídeo
        </span>
      )}
    </button>
  );
}

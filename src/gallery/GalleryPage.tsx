import { useEffect, useMemo, useState } from "react";
import { CaptureViewer } from "../camera/CaptureViewer";
import { formatDate } from "../shared/lib/time";
import { ClassAlbumCard } from "./ClassAlbumCard";
import { type Chip, FilterChips } from "./FilterChips";
import { DisciplineManager } from "../slid/DisciplineManager";
import { CLASS_STATUSES, STATUS_STYLES, type ClassStatus } from "../slid/status";
import {
  deleteClassForever,
  getClasses,
  getTrashedClasses,
  restoreClass,
  setClassDiscipline,
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
  // Abre em Fotos: a galeria de uma câmera é o rolo do usuário, e o que ele
  // tirou com o dedo é o que ele espera encontrar. O SliD é a área especial,
  // alcançada pelo chip — não o que aparece antes de qualquer escolha.
  const [view, setView] = useState<View>("fotos");
  const [discipline, setDiscipline] = useState("todas");
  const [selected, setSelected] = useState<CapturedMedia | null>(null);
  const [managing, setManaging] = useState(false);
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

  /*
   * Fotos e Vídeos são o que o estudante capturou com o dedo, e só isso. Um
   * momento do SliD também é um JPEG, mas ele não tirou aquela foto — a câmera
   * tirou por ele, dentro de uma aula, e é lá que ele pertence. Misturar as
   * duas coisas transforma a aula de volta numa pilha de fotos, que é
   * exatamente a leitura que a sessão inteira trabalha para evitar.
   */
  const photos = useMemo(
    () => (media ?? []).filter((item) => item.kind === "photo" && !item.session),
    [media],
  );
  const videos = useMemo(
    () => (media ?? []).filter((item) => item.kind === "video" && !item.session),
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

  // A matéria filtrada pode deixar de existir debaixo do filtro — a última aula
  // dela foi para a lixeira, ou trocou de matéria. O chip some e a seleção
  // ficaria apontando para o que não está mais lá, com a lista vazia e nenhum
  // chip aceso. Volta para todas.
  /** Quantas aulas há em cada status, para o chip só existir quando serve. */
  const statusCounts = useMemo(() => {
    const counts = new Map<ClassStatus, number>();
    for (const record of classes)
      if (record.status) counts.set(record.status, (counts.get(record.status) ?? 0) + 1);
    return counts;
  }, [classes]);

  const favoriteClasses = useMemo(
    () => classes.filter((record) => record.favorite).length,
    [classes],
  );
  useEffect(() => {
    if (discipline === "todas") return;
    const ainda =
      discipline === "favoritas"
        ? favoriteClasses > 0
        : discipline.startsWith("status:")
          ? (statusCounts.get(discipline.slice(7) as ClassStatus) ?? 0) > 0
          : disciplines.some(([name]) => name === discipline);
    if (!ainda) setDiscipline("todas");
  }, [disciplines, discipline, favoriteClasses, statusCounts]);

  // Um trilho só, com matéria e status juntos. Dois trilhos empilhados sob os
  // chips da galeria seriam três linhas de filtro antes da primeira aula.
  const shownClasses = useMemo(() => {
    if (discipline === "todas") return classes;
    if (discipline === "favoritas") return classes.filter((r) => r.favorite);
    if (discipline.startsWith("status:")) {
      const wanted = discipline.slice(7);
      return classes.filter((record) => record.status === wanted);
    }
    return classes.filter((record) => record.discipline === discipline);
  }, [classes, discipline]);

  const trashCount = trashedMedia.length + trashedClasses.length;

  /*
   * A ordem sai do Figma — SliD · Todas · Favoritos · Vídeos —, com duas
   * ressalvas registradas na auditoria.
   *
   * O Figma não tem chip "Fotos", e a regra de produto é que a galeria abre
   * nele: momento automático de aula nunca se mistura com o que o estudante
   * fotografou. Então Fotos entra na frente e o resto segue a ordem do Figma.
   * A Lixeira também não está no Figma, e fica no fim, onde não disputa
   * atenção com o que o estudante veio ver.
   */
  const chips: Chip[] = [
    { id: "fotos", label: "Fotos", count: photos.length },
    { id: "slid", label: "SliD", count: classes.length },
    { id: "todas", label: "Todas", count: media?.length ?? 0 },
    { id: "favoritos", label: "Favoritos", count: favorites.length },
    { id: "videos", label: "Vídeos", count: videos.length },
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
      <header className="px-6 pb-3 pt-[max(20px,env(safe-area-inset-top))]">
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
          favorites={favoriteClasses}
          statusCounts={statusCounts}
          onSelectDiscipline={setDiscipline}
          onOpenClass={onOpenClass}
          onManage={() => setManaging(true)}
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
            <ul key={view} className="grid grid-cols-3 gap-1 px-1 pb-6">
              {grid.map((item, index) => (
                <li
                  key={item.id}
                  className="animate-[slid-enter_260ms_ease-out_both]"
                  // Escalonado só nas primeiras linhas: depois disso o atraso
                  // vira espera, e ninguém espera para ver a própria galeria.
                  style={{ animationDelay: `${Math.min(index, 8) * 22}ms` }}
                >
                  <GalleryThumb media={item} onOpen={() => setSelected(item)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <DisciplineManager
        open={managing}
        onClose={() => setManaging(false)}
        counts={new Map(disciplines)}
        onRenamed={async (from, to) => {
          // The classes go with the name. A matéria renamed under the lectures
          // filed in it would quietly empty the filter it belongs to.
          for (const record of classes) {
            if (record.discipline === from) await setClassDiscipline(record.id, to);
          }
          if (discipline === from) setDiscipline(to);
          reload();
        }}
        onRemoved={async (name) => {
          for (const record of classes) {
            if (record.discipline === name) await setClassDiscipline(record.id, null);
          }
          if (discipline === name) setDiscipline("todas");
          reload();
        }}
      />

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
  const [title, text] =
    view === "favoritos"
      ? ["Nada favoritado ainda", "Abra uma captura e toque na estrela para guardá-la aqui."]
      : view === "videos"
        ? ["Seus vídeos aparecerão aqui", "Grave um vídeo pela câmera para vê-lo nesta galeria."]
        : view === "fotos"
          ? ["Suas fotos aparecerão aqui", "Tire uma foto pela câmera para vê-la nesta galeria."]
          : ["Nada guardado ainda", "Suas fotos, vídeos e aulas aparecem aqui."];
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
      {/* Uma câmera, não uma moldura: 🖼 é escuro sobre fundo escuro e neste
          tamanho se lê como glifo quebrado, que é a pior coisa possível numa
          tela que já está vazia. */}
      <div className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-2xl">
        {view === "favoritos" ? "★" : view === "videos" ? "🎞" : "📷"}
      </div>
      <p className="text-[15px] font-medium text-ink">{title}</p>
      <p className="max-w-[30ch] text-[13px] leading-snug text-ink-muted">{text}</p>
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
  statusCounts,
  onSelectDiscipline,
  onOpenClass,
  onManage,
}: {
  classes: ClassRecord[];
  total: number;
  disciplines: [string, number][];
  active: string;
  favorites: number;
  statusCounts: Map<ClassStatus, number>;
  onSelectDiscipline: (id: string) => void;
  onOpenClass: (id: string) => void;
  onManage: () => void;
}) {
  // Status antes de matéria: quem volta à galeria para estudar procura o que
  // precisa revisar, não o que era de Física.
  const chips: Chip[] = [
    { id: "todas", label: "Todas as aulas", count: total },
    ...CLASS_STATUSES.filter((status) => (statusCounts.get(status) ?? 0) > 0).map(
      (status) => ({
        id: `status:${status}`,
        label: STATUS_STYLES[status].label,
        count: statusCounts.get(status),
      }),
    ),
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
        <p className="max-w-[30ch] text-sm text-ink-muted">
          Abra o SliD durante uma aula e ela aparece aqui, organizada sozinha.
        </p>
        <button
          type="button"
          onClick={onManage}
          className="mt-1 min-h-10 rounded-full bg-surface-2 px-4 text-[13px] font-medium text-ink transition-transform active:scale-95 active:opacity-70"
        >
          Gerenciar matérias
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Filing lives with the class; the list of names is a different job, and
          it needs somewhere to be. Beside the filters it feeds is the one place
          a student looks for it. */}
      <div className="flex items-center gap-2 px-5 pb-3 pt-1">
        {/* `overflow-hidden` porque o trilho de chips sangra 24 px para os
            dois lados, e do lado direito ele passava por baixo do botão de
            matérias — o chip sumia atrás dele em vez de parar antes. */}
        <div className="min-w-0 flex-1 overflow-hidden">
          <FilterChips
            chips={chips}
            active={active}
            onSelect={onSelectDiscipline}
            label="Filtrar por matéria"
          />
        </div>
        <button
          type="button"
          onClick={onManage}
          aria-label="Gerenciar matérias"
          className="flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-surface-2 px-3 text-[12.5px] font-medium text-ink transition-transform active:scale-95 active:opacity-70"
        >
          <span aria-hidden="true">⚙</span>
          Matérias
        </button>
      </div>
      {classes.length === 0 ? (
        <p className="px-8 py-10 text-center text-sm text-ink-muted">
          {active.startsWith("status:")
            ? "Nenhuma aula com esse status."
            : active === "favoritas"
              ? "Nenhuma aula favoritada."
              : "Nenhuma aula nesta matéria."}
        </p>
      ) : (
        <>
          {/*
           * O rótulo de seção do Figma. Ele não é enfeite: com a aula virando
           * card de imagem, sem um título a grade fica indistinguível do rolo
           * de fotos que vem logo abaixo na mesma tela.
           */}
          <h2 className="px-6 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Álbuns de aula
          </h2>
          {/* Grade de 2 colunas, como no `339:540`: cards de 175×131 com 9 px
              entre colunas e 28 px entre linhas, em margens de 25 px. */}
          <ul className="grid grid-cols-2 gap-x-2 gap-y-4 px-6 pb-6">
            {classes.map((record, index) => (
              <li
                key={record.id}
                className="animate-[slid-enter_280ms_ease-out_both]"
                style={{ animationDelay: `${Math.min(index, 6) * 34}ms` }}
              >
                <ClassAlbumCard record={record} onOpen={() => onOpenClass(record.id)} />
              </li>
            ))}
          </ul>
        </>
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
                  className="min-h-9 flex-1 rounded-xl bg-accent px-3 text-[13px] font-medium text-accent-ink transition-transform duration-150 active:scale-95 active:opacity-80"
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
                  className="min-h-9 flex-1 rounded-xl bg-canvas px-3 text-[13px] font-medium text-danger transition-transform duration-150 active:scale-95 active:opacity-70"
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
            className="min-h-11 flex-1 rounded-xl bg-accent text-[13.5px] font-medium text-accent-ink transition-transform duration-150 active:scale-[0.98] active:opacity-80"
          >
            Manter
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 flex-1 rounded-xl bg-surface-2 text-[13.5px] font-medium text-danger transition-transform duration-150 active:scale-[0.98] active:opacity-70"
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
      className="relative block aspect-square w-full overflow-hidden bg-surface-2 transition-transform duration-150 ease-out active:scale-95 active:opacity-80"
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

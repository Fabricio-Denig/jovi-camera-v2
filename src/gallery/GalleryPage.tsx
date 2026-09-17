import { useEffect, useMemo, useState } from "react";
import { CaptureViewer } from "../camera/CaptureViewer";
import { formatDate } from "../shared/lib/time";
import { ClassAlbumCard } from "./ClassAlbumCard";
import { groupByDay } from "./groupByDay";
import { type Chip, FilterChips } from "./FilterChips";
import { LessonFilterSheet, type FiltroStatus } from "./LessonFilterSheet";
import { DisciplineManager } from "../slid/DisciplineManager";
import { STATUS_STYLES, type ClassStatus } from "../slid/status";
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
  limparAudiosOrfaos,
  getAllCaptures,
  getSessionsWithAudio,
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
  /*
   * Dois filtros, não um. O antigo `discipline` era uma string só que
   * carregava três coisas diferentes ("todas", "status:revisar", "favoritas"
   * ou o nome de uma matéria), e por ser uma só nunca deixava combinar status
   * com matéria. Separados, a combinação sai de graça.
   */
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>(null);
  const [filtroMateria, setFiltroMateria] = useState<string | null>(null);
  const [filtrando, setFiltrando] = useState(false);
  const [selected, setSelected] = useState<CapturedMedia | null>(null);
  const [managing, setManaging] = useState(false);
  /** Bumped by anything on this screen that writes, so the lists reload. */
  const [localRefresh, setLocalRefresh] = useState(0);
  /*
   * O banco recusou.
   *
   * Acontece de verdade: janela privada em alguns navegadores, site com dados
   * bloqueados, cota estourada. Sem este estado a promessa rejeitava sem
   * ninguém escutando, `media` ficava em `null` para sempre, e a galeria
   * mostrava "Carregando…" até a pessoa desistir — que é exatamente a tela
   * morta que não pode existir.
   */
  const [semArmazenamento, setSemArmazenamento] = useState(false);
  /** Quais aulas têm gravação. Só as chaves — os arquivos ficam no banco. */
  const [comAudio, setComAudio] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    void Promise.all([
      getAllCaptures(),
      getClasses(),
      getTrashedCaptures(),
      getTrashedClasses(),
      // Falha sozinho: uma galeria sem o selo de áudio é muito melhor que uma
      // galeria que não abre porque o armazém de áudio não existe ainda.
      getSessionsWithAudio().catch(() => new Set<string>()),
    ])
      .then(([items, records, trashed, trashedRecords, audios]) => {
        if (!active) return;
        setSemArmazenamento(false);
        setComAudio(audios);
        setMedia(items);
        setClasses(records);
        setTrashedMedia(trashed.filter((item) => !item.session));
        setTrashedClasses(trashedRecords);
      })
      .catch(() => {
        if (!active) return;
        setSemArmazenamento(true);
        setMedia([]);
        setClasses([]);
        setTrashedMedia([]);
        setTrashedClasses([]);
      });
    return () => {
      active = false;
    };
  }, [refreshKey, localRefresh]);

  const reload = () => setLocalRefresh((n) => n + 1);

  /*
   * Qualquer painel que cobre a tela precisa avisar o shell — e não adianta
   * subir o z-index.
   *
   * A barra de navegação não é vencida por camada: o `AppShell` simplesmente
   * NÃO A RENDERIZA enquanto algo está aberto por cima. Medido no navegador:
   * a folha de filtros com `z-[70]` ainda aparecia por baixo de "Modos /
   * Câmera / Galeria", com o botão "Ver aulas" inalcançável, porque esta
   * página vive num contexto de empilhamento próprio de onde nenhum z-index
   * alcança a barra. Os três painéis desta tela (a foto aberta, os filtros e
   * as matérias) contam a mesma coisa pelo mesmo canal.
   */
  useEffect(() => {
    onViewerOpenChange?.(selected !== null || filtrando || managing);
  }, [selected, filtrando, managing, onViewerOpenChange]);
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
  /*
   * Um filtro que aponta para algo que deixou de existir prende a galeria num
   * estado vazio sem explicação: a última aula de Física foi apagada e a tela
   * diz "nenhuma aula nesta matéria" para sempre. Some sozinho.
   */
  useEffect(() => {
    if (filtroStatus === null) return;
    const ainda =
      filtroStatus === "favoritas"
        ? favoriteClasses > 0
        : (statusCounts.get(filtroStatus) ?? 0) > 0;
    if (!ainda) setFiltroStatus(null);
  }, [favoriteClasses, filtroStatus, statusCounts]);

  useEffect(() => {
    if (filtroMateria === null) return;
    if (!disciplines.some(([name]) => name === filtroMateria)) setFiltroMateria(null);
  }, [disciplines, filtroMateria]);

  /*
   * Os dois eixos são INDEPENDENTES e se acumulam — era um só, e por isso não
   * dava para perguntar "o que preciso revisar de Cálculo", que é exatamente a
   * pergunta de quem abre a galeria na véspera da prova.
   */
  const shownClasses = useMemo(() => {
    let lista = classes;
    if (filtroStatus === "favoritas") {
      lista = lista.filter((r) => r.favorite);
    } else if (filtroStatus !== null) {
      lista = lista.filter((r) => r.status === filtroStatus);
    }
    if (filtroMateria !== null) {
      lista = lista.filter((r) => r.discipline === filtroMateria);
    }
    return lista;
  }, [classes, filtroStatus, filtroMateria]);

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
      {/*
       * Régua no fim do cabeçalho: a Aula salva (`ClassPage.tsx`) já separa
       * cabeçalho de conteúdo com uma borda, e a Galeria não tinha nada — os
       * chips terminavam e a grade começava sem transição nenhuma, um bloco
       * só de cima a baixo. A mesma régua aqui aproxima as duas telas da
       * mesma gramática visual: controles acima, conteúdo abaixo.
       */}
      <header className="border-b border-line px-6 pb-4 pt-[max(20px,env(safe-area-inset-top))]">
        {/*
          Matérias sobe para o cabeçalho, ao lado do título.

          Ela estava na fileira de filtros, e ali mentia sobre o que é: um chip
          entre "Revisar" e "Cálculo" parece mais um recorte da lista, quando na
          verdade abre o gerenciamento — criar, renomear, excluir. Filtrar POR
          matéria continua existindo, dentro de "Filtrar"; organizar as matérias
          é outra ação e agora mora onde se procura por ações da tela.
        */}
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-ink">Galeria</h1>
          {view === "slid" && (
            <button
              type="button"
              onClick={() => setManaging(true)}
              aria-label="Gerenciar matérias"
              className="-mr-1 mt-0.5 flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[12.5px] font-medium text-ink transition-transform active:scale-95 active:opacity-70"
            >
              <span aria-hidden="true">⚙</span>
              Matérias
            </button>
          )}
        </div>
        <p className="mt-0.5 mb-3 text-[13px] text-ink-muted">
          {semArmazenamento
            ? "Não consegui abrir o armazenamento deste navegador"
            : media === null
              ? "Carregando…"
              : describe(view, grid.length, classes.length, trashCount)}
        </p>
        <FilterChips
          chips={chips}
          active={view}
          onSelect={(id) => setView(id as View)}
          label="Filtrar a galeria"
        />
      </header>

      {/* O que aconteceu, e o que dá para fazer — nunca uma tela que só não
          funciona. A câmera continua inteira: o que falhou foi guardar. */}
      {semArmazenamento && (
        <div className="mx-6 mb-4 rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3.5">
          <p className="text-[13.5px] font-medium text-warn">
            Este navegador não deixou abrir o armazenamento do app.
          </p>
          <p className="mt-1 text-[12.5px] leading-snug text-ink-muted">
            Costuma ser janela anônima, ou dados de site bloqueados nas
            configurações. A câmera e o SliD continuam funcionando — o que não
            dá é guardar entre uma sessão e outra.
          </p>
        </div>
      )}

      {media !== null && view === "slid" && (
        <SlidView
          classes={shownClasses}
          total={classes.length}
          filtroStatus={filtroStatus}
          filtroMateria={filtroMateria}
          comAudio={comAudio}
          onFiltrar={() => setFiltrando(true)}
          onLimparFiltros={() => {
            setFiltroStatus(null);
            setFiltroMateria(null);
          }}
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
            /*
             * Seções por data, com a mais nova chamada "Recentes" — o rótulo
             * que o Figma põe sobre a grade. Um rolo sem divisão é uma parede
             * de miniaturas; a data é a única divisão que um rolo de câmera
             * tem de verdade.
             */
            <div key={view} className="pb-6 pt-1">
              {groupByDay(grid).map((grupo, ordem) => (
                <section key={grupo.id}>
                  <h2 className="px-6 pb-2 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    {grupo.label}
                  </h2>
                  {/* 3 colunas com 8 px de folga, como no `339:540`. */}
                  <ul className="mb-4 grid grid-cols-3 gap-2 px-6">
                    {grupo.items.map((item, index) => (
                      <li
                        key={item.id}
                        className="animate-[slid-enter_260ms_ease-out_both]"
                        // Escalonado só nas primeiras linhas da primeira seção:
                        // depois disso o atraso vira espera, e ninguém espera
                        // para ver a própria galeria.
                        style={{
                          animationDelay:
                            ordem === 0 ? `${Math.min(index, 8) * 22}ms` : "0ms",
                        }}
                      >
                        <GalleryThumb media={item} onOpen={() => setSelected(item)} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {filtrando && (
        <LessonFilterSheet
          status={filtroStatus}
          materia={filtroMateria}
          disciplines={disciplines}
          statusCounts={statusCounts}
          favorites={favoriteClasses}
          total={classes.length}
          onStatus={setFiltroStatus}
          onMateria={setFiltroMateria}
          onLimpar={() => {
            setFiltroStatus(null);
            setFiltroMateria(null);
          }}
          onFechar={() => setFiltrando(false)}
        />
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
          if (filtroMateria === from) setFiltroMateria(to);
          reload();
        }}
        onRemoved={async (name) => {
          for (const record of classes) {
            if (record.discipline === name) await setClassDiscipline(record.id, null);
          }
          if (filtroMateria === name) setFiltroMateria(null);
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
  filtroStatus,
  filtroMateria,
  comAudio,
  onFiltrar,
  onLimparFiltros,
  onOpenClass,
  onManage,
}: {
  classes: ClassRecord[];
  total: number;
  filtroStatus: FiltroStatus;
  filtroMateria: string | null;
  /** Ids das aulas que têm gravação. */
  comAudio: Set<string>;
  onFiltrar: () => void;
  onLimparFiltros: () => void;
  onOpenClass: (id: string) => void;
  onManage: () => void;
}) {
  const filtrosAtivos = [
    filtroStatus === "favoritas"
      ? "Favoritas"
      : filtroStatus
        ? STATUS_STYLES[filtroStatus].label
        : null,
    filtroMateria,
  ].filter((f): f is string => Boolean(f));

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
      {/*
       * O rótulo de seção e o botão de filtrar na MESMA linha — era uma
       * fileira inteira de chips, e antes dela outra. Duas linhas de controle
       * antes da primeira aula faziam a tela ler como painel de filtros, não
       * como a estante de alguém. O estado padrão (sem filtro) não gasta nada
       * explicando que está mostrando tudo: a própria lista já diz.
       */}
      <div className="flex items-center justify-between gap-2 px-6 pb-2.5 pt-1">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          Álbuns de aula
        </h2>
        <button
          type="button"
          onClick={onFiltrar}
          aria-label="Filtrar aulas"
          className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-transform active:scale-95 ${
            filtrosAtivos.length > 0
              ? "bg-accent-soft text-accent"
              : "bg-surface-2 text-ink-muted"
          }`}
        >
          <span aria-hidden="true">☰</span>
          Filtrar
          {filtrosAtivos.length > 0 && (
            <span className="font-mono text-[11px] tabular-nums">
              ({filtrosAtivos.length})
            </span>
          )}
        </button>
      </div>

      {/*
       * O que está filtrando, nomeado e removível — e só quando há algo. Sem
       * esta linha, uma galeria filtrada e uma galeria vazia são a mesma tela,
       * e a pessoa conclui que perdeu as aulas.
       */}
      {filtrosAtivos.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-6 pb-3">
          {filtrosAtivos.map((f) => (
            <span
              key={f}
              className="flex min-h-7 items-center rounded-full bg-accent-soft px-2.5 text-[12px] font-medium text-accent"
            >
              {f}
            </span>
          ))}
          <button
            type="button"
            onClick={onLimparFiltros}
            className="min-h-7 rounded-full px-2 text-[12px] font-medium text-ink-muted underline underline-offset-2 transition-opacity active:opacity-60"
          >
            Limpar
          </button>
        </div>
      )}

      {classes.length === 0 ? (
        <p className="px-8 py-10 text-center text-sm text-ink-muted">
          Nenhuma aula com esse filtro.
        </p>
      ) : (
        <>
          {/* Grade de 2 colunas, como no `339:540`: cards de 175×131 com 9 px
              entre colunas. `gap-y-5`, um pouco além dos 28px do wireframe: o
              card ganhou aro claro (`ClassAlbumCard.tsx`) e precisava de mais
              respiro entre linhas para as bordas não brigarem visualmente. */}
          <ul className="grid grid-cols-2 gap-x-2 gap-y-5 px-6 pb-6">
            {classes.map((record, index) => (
              <li
                key={record.id}
                className="animate-[slid-enter_280ms_ease-out_both]"
                style={{ animationDelay: `${Math.min(index, 6) * 34}ms` }}
              >
                <ClassAlbumCard
                  record={record}
                  temAudio={comAudio.has(record.id)}
                  onOpen={() => onOpenClass(record.id)}
                />
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
    | { kind: "class"; id: string; name: string }
    | { kind: "media"; id: string }
    | { kind: "all"; count: number }
    | null
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

  const total = classes.length + media.length;

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Esvaziar tudo de uma vez, e não item por item — a diferença que
          importa antes de uma demonstração, quando meses de teste deixam a
          lixeira cheia e ninguém vai apagar trinta itens um a um. */}
      <div className="px-4">
        <button
          type="button"
          onClick={() => setConfirming({ kind: "all", count: total })}
          className="min-h-10 w-full rounded-xl bg-surface-2 text-[13px] font-medium text-danger transition-transform duration-150 active:scale-[0.98] active:opacity-70"
        >
          Esvaziar lixeira ({total})
        </button>
      </div>

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
          count={confirming.kind === "all" ? confirming.count : null}
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            if (confirming.kind === "class") {
              await deleteClassForever(confirming.id);
            } else if (confirming.kind === "media") {
              await deleteCapturesForever((m) => m.id === confirming.id);
            } else {
              // Cada aula pelo mesmo caminho de "apagar de vez" — ele também
              // leva o áudio dela, e uma varredura por fora não saberia disso.
              for (const c of classes) await deleteClassForever(c.id);
              await deleteCapturesForever((m) => Boolean(m.deletedAt) && !m.session);
            }
            /*
             * Depois de apagar de vez, varrer as gravações sem aula.
             *
             * Apagar o último momento de uma aula pela grade de mídia faz a
             * aula deixar de existir — ela é definida pelas capturas que a
             * referenciam — e o áudio dela ficaria para sempre, invisível,
             * ocupando a cota do navegador. A varredura conta a lixeira como
             * existência, então nada que ainda possa voltar é tocado.
             */
            await limparAudiosOrfaos().catch(() => {});
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
  count,
  onCancel,
  onConfirm,
}: {
  name: string | null;
  /** Presente só para "esvaziar tudo" — o total de itens que vão junto. */
  count: number | null;
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
          {count != null
            ? `Esvaziar a lixeira?`
            : name
              ? `Apagar "${name}" de vez?`
              : "Apagar de vez?"}
        </h2>
        <p className="mt-1 text-[13px] leading-snug text-ink-muted">
          {count != null
            ? `${count} ${count === 1 ? "item" : "itens"} serão perdidos.`
            : name
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
      // Aro claro em vez de sombra: sobre `--color-canvas` (quase preto) uma
      // sombra preta não pinta nada — o aro é o que de fato separa a
      // miniatura do fundo neste tema.
      className="relative block aspect-square w-full overflow-hidden rounded-lg bg-surface-2 ring-1 ring-white/[0.07] transition-transform duration-150 ease-out active:scale-95 active:opacity-80"
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
      {/* Scanner e SliD nunca coincidem — um documento avulso não é aula —,
          então o mesmo canto serve aos dois sem disputa. Sem o selo, um
          documento recortado só se distinguia de uma foto comum depois de
          aberto. */}
      {media.source === "scanner" && (
        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9.5px] font-medium text-white">
          Documento
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

import {
  deleteCapturesForever,
  deleteLessonAudio,
  getAllCaptures,
  getCapturesBySession,
  getTrashedCaptures,
  restoreCaptures,
  saveCapture,
  trashCaptures,
} from "../shared/lib/mediaStore";
import { reopenOverview } from "./readContent";
import { readStatus, type ClassStatus } from "./status";
import type { CapturedMedia, SummaryManual } from "../types/camera";

/**
 * A followed class, reassembled from the moments it left behind.
 *
 * The session that produced it is long gone by the time a student comes back
 * to review — so everything the class page shows is read from storage, never
 * recomputed. Nothing here reads an image again.
 */
export interface ClassMoment {
  media: CapturedMedia;
  atMs: number;
  label: string;
  detail: string | null;
  category: string | null;
  spanMs: number;
  /** O que a câmera leu neste momento, peneirado. Vazio quando não leu nada. */
  lines: string[];
  /** O título foi escrito pelo estudante — não pode ser sobrescrito. */
  labelManual: boolean;
}

export interface ClassRecord {
  id: string;
  subject: string;
  /** The matéria, when the student filed it under one. */
  discipline: string | null;
  /** Como a aula ficou para o estudante, quando ele disse. */
  status: ClassStatus | null;
  favorite: boolean;
  /** Set while the class is in the trash. */
  deletedAt: number | null;
  savedAt: number;
  durationMs: number;
  skippedDuplicates: number;
  topics: string[];
  kinds: [string, number][];
  overview: string;
  moments: ClassMoment[];
  /** O resumo reescrito pelo estudante, quando existe. Ver `SummaryManual`. */
  summaryManual: SummaryManual | null;
}

/** Classes saved before labels were stored still open — they just say less. */
const LEGACY_LABEL = "Momento da aula";

/**
 * O que um momento se chama quando ninguém escreveu nada e a sessão também
 * não achou título — e o que ele VOLTA a se chamar quando o estudante apaga o
 * que tinha escrito.
 *
 * Neutro de propósito: o SliD captura o momento, o estudante decide o nome.
 * Um título inventado aqui ("Introdução a banco de dados") seria o app
 * afirmando sobre a aula algo que ele não leu em lugar nenhum.
 */
export const MOMENTO_SEM_TITULO = "Momento da aula";

function toRecord(id: string, items: CapturedMedia[]): ClassRecord {
  const moments = items
    .map((media) => ({
      media,
      atMs: media.session?.atMs ?? 0,
      label: media.session?.label || LEGACY_LABEL,
      detail: media.session?.detail ?? null,
      category: media.session?.category ?? null,
      spanMs: media.session?.spanMs ?? 0,
      lines: media.session?.lines ?? [],
      labelManual: media.session?.labelManual ?? false,
    }))
    .sort((a, b) => a.atMs - b.atMs);

  const first = items[0].session;
  return {
    id,
    subject: first?.subject ?? "Aula sem título",
    discipline: first?.discipline ?? null,
    status: readStatus(first?.status),
    favorite: first?.favorite ?? false,
    deletedAt: items[0].deletedAt ?? null,
    savedAt: first?.savedAt ?? items[0].createdAt,
    durationMs: first?.durationMs ?? moments.at(-1)?.atMs ?? 0,
    skippedDuplicates: first?.skippedDuplicates ?? 0,
    topics: first?.topics ?? [],
    kinds: first?.kinds ?? [],
    overview: first?.overview ?? "",
    moments,
    summaryManual: first?.summaryManual ?? null,
  };
}

function group(captures: CapturedMedia[]): ClassRecord[] {
  const bySession = new Map<string, CapturedMedia[]>();
  for (const media of captures) {
    if (!media.session) continue;
    const list = bySession.get(media.session.id);
    if (list) list.push(media);
    else bySession.set(media.session.id, [media]);
  }
  return [...bySession.entries()]
    .map(([id, items]) => toRecord(id, items))
    .sort((a, b) => b.savedAt - a.savedAt);
}

export async function getClasses(): Promise<ClassRecord[]> {
  return group(await getAllCaptures());
}

/** Classes in the trash, so they can be given back whole. */
export async function getTrashedClasses(): Promise<ClassRecord[]> {
  return group(await getTrashedCaptures()).sort(
    (a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0),
  );
}

/**
 * Abre UMA aula, sem ler a galeria inteira.
 *
 * `getClasses()` (usado antes aqui) varre TODAS as capturas de TODAS as
 * aulas para achar uma — medido em aparelho real em ~12s de "Abrindo a
 * aula…", crescendo com o tamanho da galeria, não desta aula. O índice
 * `bySession` (`mediaStore.ts`) devolve só os registros desta sessão.
 */
export async function getClassById(id: string): Promise<ClassRecord | null> {
  const items = (await getCapturesBySession(id)).filter(
    (item) => !item.deletedAt,
  );
  if (items.length === 0) return null;
  return toRecord(id, items);
}

/**
 * Everything below rewrites every moment of the class, because the class-level
 * facts are stored on each of them. That is the cost of a class being one query
 * and no second object store, and it is paid on actions a student takes by hand
 * — renaming, filing, favouriting — never in a loop.
 */
async function editClass(
  id: string,
  change: (session: NonNullable<CapturedMedia["session"]>) => NonNullable<
    CapturedMedia["session"]
  >,
): Promise<void> {
  const captures = [...(await getAllCaptures()), ...(await getTrashedCaptures())];
  for (const media of captures) {
    if (media.session?.id !== id) continue;
    await saveCapture({ ...media, session: change(media.session) });
  }
}

/** The name belongs to the student; a class can be renamed whenever. */
export async function renameClass(id: string, subject: string): Promise<void> {
  await editClass(id, (session) => ({ ...session, subject }));
}

/** Filing a class under a matéria, or taking it back out. */
export async function setClassDiscipline(
  id: string,
  discipline: string | null,
): Promise<void> {
  await editClass(id, (session) => {
    // The stored sentence opens with the matéria, so it has to move with it.
    const overview = reopenOverview(session.overview ?? "", discipline);
    if (!discipline) {
      const { discipline: _removed, ...rest } = session;
      return { ...rest, overview };
    }
    return { ...session, discipline, overview };
  });
}

/** O status é do estudante e muda quando ele mudar de ideia sobre a aula. */
export async function setClassStatus(
  id: string,
  status: ClassStatus | null,
): Promise<void> {
  await editClass(id, (session) => {
    if (!status) {
      const { status: _removed, ...rest } = session;
      return rest;
    }
    return { ...session, status };
  });
}

export async function setClassFavorite(
  id: string,
  favorite: boolean,
): Promise<void> {
  await editClass(id, (session) => ({ ...session, favorite }));
}

/**
 * O resumo que o estudante reescreveu.
 *
 * Substitui o automático por completo na tela — não é um "complemento" nem
 * uma sugestão ao lado. Quem estudou a aula sabe coisas que o áudio não
 * carrega, e o SliD para de opinar a partir daqui.
 */
export async function setClassSummary(
  id: string,
  manual: SummaryManual,
): Promise<void> {
  await editClass(id, (session) => ({ ...session, summaryManual: manual }));
}

/**
 * Volta ao resumo montado pelo app — o campo é REMOVIDO, não zerado.
 *
 * A ausência é o estado "ninguém mexeu", e é ela que o resto do código testa.
 * Guardar um objeto vazio no lugar faria a tela mostrar um resumo em branco e
 * achar que foi o estudante quem quis isso.
 */
export async function restaurarResumoAutomatico(id: string): Promise<void> {
  await editClass(id, (session) => {
    const { summaryManual: _removido, ...resto } = session;
    return resto;
  });
}

/**
 * O título de UM momento, escrito pelo estudante.
 *
 * Diferente de tudo mais neste arquivo: edita um único registro, não a aula
 * inteira. O título do momento é do momento — só os fatos DA AULA (nome,
 * matéria, status) são repetidos em todos.
 *
 * `labelManual` fica gravado junto para nenhum reprocessamento futuro passar
 * por cima: o SliD captura o momento, o estudante decide como ele se chama.
 * Um título apagado volta ao automático, que é a saída natural de quem se
 * arrependeu — por isso a marca sai junto.
 */
export async function renomearMomento(
  classId: string,
  mediaId: string,
  label: string,
): Promise<void> {
  const limpo = label.trim();
  const captures = await getCapturesBySession(classId);
  const alvo = captures.find((media) => media.id === mediaId);
  if (!alvo?.session) return;
  if (!limpo) {
    const { labelManual: _removido, ...resto } = alvo.session;
    await saveCapture({ ...alvo, session: { ...resto, label: "" } });
    return;
  }
  await saveCapture({
    ...alvo,
    session: { ...alvo.session, label: limpo, labelManual: true },
  });
}

/** A class goes to the trash whole, and comes back whole. */
export async function trashClass(id: string): Promise<void> {
  await trashCaptures((media) => media.session?.id === id);
}

export async function restoreClass(id: string): Promise<void> {
  await restoreCaptures((media) => media.session?.id === id);
}

export async function deleteClassForever(id: string): Promise<void> {
  await deleteCapturesForever((media) => media.session?.id === id);
  // A gravação sai junto. Um áudio de quarenta minutos sobrevivendo a uma aula
  // apagada de vez seria, ao mesmo tempo, lixo ocupando espaço e uma gravação
  // guardada depois de a pessoa ter mandado apagar tudo.
  await deleteLessonAudio(id).catch(() => {});
}

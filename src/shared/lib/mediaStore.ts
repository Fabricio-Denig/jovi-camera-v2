import type { CapturedMedia } from "../../types/camera";

/**
 * Minimal IndexedDB wrapper for local media persistence.
 * No external dependency on purpose — this is the only place in the app that
 * touches IndexedDB directly, so a tiny hand-rolled wrapper is cheaper to read
 * and audit than pulling in a library for ~40 lines of logic.
 */

const DB_NAME = "jovi-camera-v2";
/**
 * v2 acrescentou o armazém de áudio. A subida é aditiva — cria o que falta e
 * não toca no que existe —, então uma aula guardada antes do Listen continua
 * abrindo, só que sem gravação.
 */
const DB_VERSION = 2;
const STORE_NAME = "captures";
/**
 * O áudio da aula, num armazém próprio e com a chave da sessão.
 *
 * Fora de `captures` de propósito: os campos de aula são denormalizados em
 * cada momento, e uma gravação de quarenta minutos repetida em doze momentos
 * seriam centenas de megabytes do mesmo áudio. Um objeto por aula, com
 * marcadores de tempo, é o que a aula precisa.
 */
const AUDIO_STORE = "lessonAudio";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, { keyPath: "sessionId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * O erro que o navegador dá quando não cabe mais nada.
 *
 * Ele merece um nome próprio porque a resposta a ele é diferente de todos os
 * outros: "não deu para salvar" é um beco sem saída; "o espaço acabou, apague
 * alguma coisa" é uma instrução. Uma aula de uma hora com áudio, ou um
 * time-lapse longo, chegam lá de verdade.
 */
export class SemEspacoError extends Error {
  constructor() {
    super("O armazenamento deste navegador ficou sem espaço.");
    this.name = "SemEspacoError";
  }
}

function ehCotaEstourada(erro: unknown): boolean {
  if (!erro) return false;
  const nome = (erro as { name?: string }).name ?? "";
  return (
    nome === "QuotaExceededError" ||
    // O Firefox usa outro nome para a mesma coisa.
    nome === "NS_ERROR_DOM_QUOTA_REACHED" ||
    nome === "SemEspacoError"
  );
}

/** Quanto ainda cabe, quando o navegador sabe dizer. */
export async function espacoRestante(): Promise<{
  usadoMB: number;
  totalMB: number;
} | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e || e.quota === undefined || e.usage === undefined) return null;
    return {
      usadoMB: Math.round(e.usage / 1048576),
      totalMB: Math.round(e.quota / 1048576),
    };
  } catch {
    return null;
  }
}

export async function saveCapture(media: CapturedMedia): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(media);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (erro) {
    if (ehCotaEstourada(erro)) throw new SemEspacoError();
    throw erro;
  } finally {
    db.close();
  }
}

async function readAll(): Promise<CapturedMedia[]> {
  const db = await openDb();
  const items = await new Promise<CapturedMedia[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as CapturedMedia[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Everything the student still has. Thrown-away captures stay in the database
 * and are filtered here, in the one place every screen reads from — so nothing
 * downstream has to remember that the trash exists.
 */
export async function getAllCaptures(): Promise<CapturedMedia[]> {
  return (await readAll()).filter((item) => !item.deletedAt);
}

/** What is in the trash, most recently thrown away first. */
export async function getTrashedCaptures(): Promise<CapturedMedia[]> {
  return (await readAll())
    .filter((item) => item.deletedAt)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}

export async function getLatestCapture(): Promise<CapturedMedia | undefined> {
  const items = await getAllCaptures();
  return items[0];
}

/** Applies a change to captures the test picks out, in one pass over the store. */
async function updateWhere(
  match: (media: CapturedMedia) => boolean,
  change: (media: CapturedMedia) => CapturedMedia,
): Promise<void> {
  const items = await readAll();
  for (const media of items) {
    if (!match(media)) continue;
    await saveCapture(change(media));
  }
}

export async function trashCaptures(
  match: (media: CapturedMedia) => boolean,
): Promise<void> {
  const deletedAt = Date.now();
  await updateWhere(match, (media) => ({ ...media, deletedAt }));
}

export async function restoreCaptures(
  match: (media: CapturedMedia) => boolean,
): Promise<void> {
  await updateWhere(match, ({ deletedAt: _discarded, ...media }) => media);
}

export async function setFavorite(
  id: string,
  favorite: boolean,
): Promise<void> {
  await updateWhere(
    (media) => media.id === id,
    (media) => ({ ...media, favorite }),
  );
}

/** The only irreversible operation in the app, and it is always confirmed first. */
export async function deleteCapturesForever(
  match: (media: CapturedMedia) => boolean,
): Promise<void> {
  const items = await readAll();
  const doomed = items.filter(match).map((media) => media.id);
  if (doomed.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const id of doomed) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/**
 * A gravação de uma aula: um arquivo só, com marcadores.
 *
 * Cortar o áudio em trinta pedaços — um por momento — exigiria trinta
 * `MediaRecorder` ou uma remontagem que o navegador não faz sem biblioteca de
 * áudio. Um arquivo com marcadores de tempo dá a mesma experiência ("ouvir
 * deste ponto") sendo muito mais robusto: se a gravação falhar no meio, o que
 * já foi gravado continua inteiro.
 */
export interface LessonAudio {
  sessionId: string;
  blob: Blob;
  mimeType: string;
  /** Quanto tempo de áudio existe, em ms, medido pelo relógio da sessão. */
  durationMs: number;
  /** Quando a gravação começou, em ms desde o início da sessão. */
  startedAtMs: number;
  createdAt: number;
  /**
   * O que foi dito, em trechos ancorados no relógio da sessão.
   *
   * Guardado junto do áudio e não junto dos momentos porque é da aula
   * inteira, como a gravação — e porque os dois só fazem sentido juntos: o
   * trecho diz o que foi falado, o áudio deixa ouvir de novo.
   */
  transcript?: TranscriptSegment[];
  /**
   * Como a transcrição terminou, para a aula reaberta poder dizer a verdade
   * em vez de fingir que ninguém tentou.
   */
  transcriptStatus?: "ok" | "indisponivel" | "desligada";
}

/**
 * Um trecho de fala, ancorado no relógio da sessão.
 *
 * Mora aqui, e não no gancho que o produz, porque o que define a forma é o que
 * precisa sobreviver ao fechar do app. `listen/useTranscript` reexporta daqui.
 */
export interface TranscriptSegment {
  /** Milissegundos desde o início da sessão — o mesmo eixo de `capture.atMs`. */
  startMs: number;
  endMs: number;
  text: string;
  final: boolean;
  confidence?: number;
}

export async function saveLessonAudio(audio: LessonAudio): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, "readwrite");
      tx.objectStore(AUDIO_STORE).put(audio);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (erro) {
    if (ehCotaEstourada(erro)) throw new SemEspacoError();
    throw erro;
  } finally {
    db.close();
  }
}

export async function getLessonAudio(
  sessionId: string,
): Promise<LessonAudio | undefined> {
  const db = await openDb();
  const found = await new Promise<LessonAudio | undefined>(
    (resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, "readonly");
      const request = tx.objectStore(AUDIO_STORE).get(sessionId);
      request.onsuccess = () =>
        resolve(request.result as LessonAudio | undefined);
      request.onerror = () => reject(request.error);
    },
  );
  db.close();
  return found;
}

/**
 * Quais aulas têm gravação — só as chaves, nunca os arquivos.
 *
 * A galeria precisa saber quais aulas foram gravadas para dizer isso no card,
 * e ler os blobs para descobrir carregaria dezenas de megabytes de áudio para
 * desenhar um ícone. `getAllKeys` devolve só os identificadores.
 */
export async function getSessionsWithAudio(): Promise<Set<string>> {
  const db = await openDb();
  const chaves = await new Promise<IDBValidKey[]>((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, "readonly");
    const request = tx.objectStore(AUDIO_STORE).getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return new Set(chaves.map(String));
}

/** Sai junto com a aula, quando a aula sai de vez. */
/**
 * Apaga gravações cuja aula não existe mais em lugar nenhum.
 *
 * Este lixo é invisível por construção: o áudio mora num armazém próprio, com
 * a chave da sessão, e nenhuma tela o lista sozinho. Se a aula some sem passar
 * por `deleteClassForever`, a gravação fica — dezenas de megabytes de uma aula
 * que o estudante não tem mais, ocupando a cota do navegador e aparecendo
 * depois como "não coube o áudio" numa aula nova.
 *
 * O caminho que produz isso é real: apagar de vez o último momento de uma aula
 * pela grade de mídia. A aula deixa de existir — ela é definida pelas capturas
 * que a referenciam — e o áudio nunca é avisado.
 *
 * **Conta a lixeira como existência**, e isso é o detalhe que faz a varredura
 * ser segura: uma aula no lixo ainda pode voltar inteira, e apagar o áudio
 * dela aqui transformaria uma ação reversível numa perda permanente.
 *
 * Devolve quantas gravações foram removidas, para o diagnóstico poder dizer.
 */
export async function limparAudiosOrfaos(): Promise<number> {
  const capturas = await readAll();
  // Toda sessão referenciada, na lixeira ou fora dela.
  const vivas = new Set(
    capturas
      .map((c) => c.session?.id)
      .filter((id): id is string => Boolean(id)),
  );

  const db = await openDb();
  try {
    const chaves = await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, "readonly");
      const q = tx.objectStore(AUDIO_STORE).getAllKeys();
      q.onsuccess = () => resolve(q.result as string[]);
      q.onerror = () => reject(q.error);
    });

    const orfas = chaves.filter((k) => !vivas.has(k));
    if (orfas.length === 0) return 0;

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, "readwrite");
      const store = tx.objectStore(AUDIO_STORE);
      for (const k of orfas) store.delete(k);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return orfas.length;
  } finally {
    db.close();
  }
}

export async function deleteLessonAudio(sessionId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, "readwrite");
    tx.objectStore(AUDIO_STORE).delete(sessionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

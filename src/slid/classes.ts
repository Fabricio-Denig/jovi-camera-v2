import {
  deleteCapturesForever,
  getAllCaptures,
  getTrashedCaptures,
  restoreCaptures,
  saveCapture,
  trashCaptures,
} from "../shared/lib/mediaStore";
import { reopenOverview } from "./readContent";
import type { CapturedMedia } from "../types/camera";

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
}

export interface ClassRecord {
  id: string;
  subject: string;
  /** The matéria, when the student filed it under one. */
  discipline: string | null;
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
}

/** Classes saved before labels were stored still open — they just say less. */
const LEGACY_LABEL = "Momento da aula";

function toRecord(id: string, items: CapturedMedia[]): ClassRecord {
  const moments = items
    .map((media) => ({
      media,
      atMs: media.session?.atMs ?? 0,
      label: media.session?.label || LEGACY_LABEL,
      detail: media.session?.detail ?? null,
      category: media.session?.category ?? null,
      spanMs: media.session?.spanMs ?? 0,
    }))
    .sort((a, b) => a.atMs - b.atMs);

  const first = items[0].session;
  return {
    id,
    subject: first?.subject ?? "Aula sem título",
    discipline: first?.discipline ?? null,
    favorite: first?.favorite ?? false,
    deletedAt: items[0].deletedAt ?? null,
    savedAt: first?.savedAt ?? items[0].createdAt,
    durationMs: first?.durationMs ?? moments.at(-1)?.atMs ?? 0,
    skippedDuplicates: first?.skippedDuplicates ?? 0,
    topics: first?.topics ?? [],
    kinds: first?.kinds ?? [],
    overview: first?.overview ?? "",
    moments,
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

export async function getClassById(id: string): Promise<ClassRecord | null> {
  const classes = await getClasses();
  return classes.find((record) => record.id === id) ?? null;
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

export async function setClassFavorite(
  id: string,
  favorite: boolean,
): Promise<void> {
  await editClass(id, (session) => ({ ...session, favorite }));
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
}

import { getAllCaptures, saveCapture } from "../shared/lib/mediaStore";
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
}

export interface ClassRecord {
  id: string;
  subject: string;
  savedAt: number;
  durationMs: number;
  skippedDuplicates: number;
  topics: string[];
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
    }))
    .sort((a, b) => a.atMs - b.atMs);

  const first = items[0].session;
  return {
    id,
    subject: first?.subject ?? "Aula sem título",
    savedAt: first?.savedAt ?? items[0].createdAt,
    durationMs: first?.durationMs ?? moments.at(-1)?.atMs ?? 0,
    skippedDuplicates: first?.skippedDuplicates ?? 0,
    topics: first?.topics ?? [],
    moments,
  };
}

export async function getClasses(): Promise<ClassRecord[]> {
  const captures = await getAllCaptures();
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

export async function getClassById(id: string): Promise<ClassRecord | null> {
  const classes = await getClasses();
  return classes.find((record) => record.id === id) ?? null;
}

/** The name belongs to the student; a class can be renamed whenever. */
export async function renameClass(id: string, subject: string): Promise<void> {
  const captures = await getAllCaptures();
  for (const media of captures) {
    if (media.session?.id !== id) continue;
    await saveCapture({ ...media, session: { ...media.session, subject } });
  }
}

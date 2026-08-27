/**
 * Matérias — the one thing about a class the camera cannot work out and the
 * student can, in one tap.
 *
 * Deliberately never guessed. A lecture filed under the wrong subject is worse
 * than one filed under none, and inventing "Física" from a formula on a board
 * is exactly the kind of confident wrongness this product avoids everywhere
 * else. So a class has a matéria only when someone said so.
 *
 * The list lives in localStorage rather than in IndexedDB: it is a handful of
 * short strings, it is read on every render of the gallery, and losing it
 * would cost nothing that the classes themselves do not already carry.
 */

const KEY = "slid.materias";

/** What a student is likely to be sitting in. The list is a start, not a cage. */
export const DEFAULT_DISCIPLINES = [
  "Matemática",
  "Física",
  "História",
  "Programação",
  "Biologia",
  "Outra",
];

function readCustom(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    // A browser that refuses storage still gets the defaults.
    return [];
  }
}

/** The defaults plus whatever the student added, in the order they will see. */
export function getDisciplines(): string[] {
  const custom = readCustom().filter(
    (name) => !DEFAULT_DISCIPLINES.includes(name),
  );
  // "Outra" is the way in to a new matéria, so it stays at the end of the list.
  const defaults = DEFAULT_DISCIPLINES.filter((name) => name !== "Outra");
  return [...defaults, ...custom, "Outra"];
}

/** Adds a matéria if it is new, and answers with the name as it was stored. */
export function addDiscipline(name: string): string {
  const trimmed = name.trim().slice(0, 28);
  if (!trimmed) return "";
  const known = getDisciplines();
  const existing = known.find(
    (item) => item.toLocaleLowerCase("pt-BR") === trimmed.toLocaleLowerCase("pt-BR"),
  );
  if (existing) return existing;
  try {
    localStorage.setItem(KEY, JSON.stringify([...readCustom(), trimmed]));
  } catch {
    // Not being able to remember the name is not a reason to refuse it now.
  }
  return trimmed;
}

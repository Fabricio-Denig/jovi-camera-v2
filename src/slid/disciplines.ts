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
/** Defaults the student took off the list. The list is a start, not a cage. */
const HIDDEN_KEY = "slid.materias.ocultas";

/** What a student is likely to be sitting in. The list is a start, not a cage. */
export const DEFAULT_DISCIPLINES = [
  "Matemática",
  "Física",
  "História",
  "Programação",
  "Biologia",
  "Outra",
];

function read(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    // A browser that refuses storage still gets the defaults.
    return [];
  }
}

function write(key: string, names: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(names));
  } catch {
    // Not being able to remember the change is not a reason to refuse it now.
  }
}

const readCustom = () => read(KEY);
const readHidden = () => read(HIDDEN_KEY);

/** The defaults plus whatever the student added, in the order they will see. */
export function getDisciplines(): string[] {
  const hidden = readHidden();
  const custom = readCustom().filter(
    (name) => !DEFAULT_DISCIPLINES.includes(name),
  );
  // "Outra" is the way in to a new matéria, so it stays at the end of the list.
  const defaults = DEFAULT_DISCIPLINES.filter(
    (name) => name !== "Outra" && !hidden.includes(name),
  );
  return [...defaults, ...custom, "Outra"];
}

/** Everything on the list except the "+ Outra" button, which is not a matéria. */
export function getManageableDisciplines(): string[] {
  return getDisciplines().filter((name) => name !== "Outra");
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
  // Adding back a default the student had removed just unhides it.
  if (DEFAULT_DISCIPLINES.includes(trimmed)) {
    write(HIDDEN_KEY, readHidden().filter((name) => name !== trimmed));
    return trimmed;
  }
  write(KEY, [...readCustom(), trimmed]);
  return trimmed;
}

/**
 * Renames a matéria. Every row on the list behaves the same way, defaults
 * included — a list where half the rows have an edit button and half do not is
 * a list that has to be explained. Renaming a default is the default being
 * taken off the list and the new name being added in its place; the classes
 * filed under it are re-filed by the caller.
 *
 * Answers with the stored name, or "" when the name is empty or already taken.
 */
export function renameDiscipline(from: string, to: string): string {
  const trimmed = to.trim().slice(0, 28);
  if (!trimmed || trimmed === from) return "";
  const clash = getDisciplines().some(
    (name) =>
      name !== from &&
      name.toLocaleLowerCase("pt-BR") === trimmed.toLocaleLowerCase("pt-BR"),
  );
  if (clash) return "";

  if (DEFAULT_DISCIPLINES.includes(from)) {
    write(HIDDEN_KEY, [...readHidden(), from]);
    if (!DEFAULT_DISCIPLINES.includes(trimmed)) {
      write(KEY, [...readCustom(), trimmed]);
    } else {
      write(HIDDEN_KEY, readHidden().filter((name) => name !== trimmed).concat(from));
    }
    return trimmed;
  }
  write(KEY, readCustom().map((name) => (name === from ? trimmed : name)));
  return trimmed;
}

/**
 * Forgets a matéria. Only the label goes: the classes filed under it are the
 * student's lectures, and a list of names has no business deleting those. They
 * come back as classes with no matéria, which the caller is responsible for.
 */
export function removeDiscipline(name: string): void {
  if (DEFAULT_DISCIPLINES.includes(name)) {
    if (!readHidden().includes(name)) write(HIDDEN_KEY, [...readHidden(), name]);
    return;
  }
  write(KEY, readCustom().filter((item) => item !== name));
}

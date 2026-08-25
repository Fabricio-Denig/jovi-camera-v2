import type { OcrPage } from "./useOcr";
import type { MomentReason } from "./useSlidSession";

/**
 * Reading the board is a supporting tool, never the product.
 *
 * The student is never shown a transcript. Raw extracted text — with its
 * inevitable OCR slips — is the single clearest tell that a product is a
 * scanner, so what surfaces is what the camera understood: a short label for
 * the moment, and at most one line of the content that justified keeping it.
 */

export interface MomentDescription {
  /** What the camera recognised, in the student's language. */
  label: string;
  /** The one piece of content worth showing, when it reads cleanly. */
  detail: string | null;
}

const FALLBACK_LABELS: Record<MomentReason, string> = {
  "novo-topico": "Novo tópico no quadro",
  "novo-conteudo": "Conteúdo complementar",
  manual: "Você marcou este momento",
};

export function describeMoment(
  reason: MomentReason,
  text?: string,
  previousText?: string,
): MomentDescription {
  if (!text) return { label: FALLBACK_LABELS[reason], detail: null };

  const lines = toLines(text);
  if (lines.length === 0) return { label: FALLBACK_LABELS[reason], detail: null };

  // What this moment added, rather than everything the board still carries.
  const added = previousText
    ? lines.filter(
        (line) =>
          !new Set(toLines(previousText).map(normalise)).has(normalise(line)),
      )
    : lines;

  const focus = added.length > 0 ? added : lines;
  const formula = focus.find(isFormula);
  const prose = focus.find((line) => !isFormula(line) && line.length >= 4);

  if (reason === "manual") {
    return { label: FALLBACK_LABELS.manual, detail: clean(formula ?? prose) };
  }

  // A formula appearing is the most recognisable thing that happens on a board.
  if (formula) {
    return {
      label: previousText ? "Nova fórmula" : "Fórmula no quadro",
      detail: clean(formula),
    };
  }

  if (prose) {
    return {
      label: previousText ? "Novo conceito" : "Início do tópico",
      detail: clean(prose),
    };
  }

  return { label: FALLBACK_LABELS[reason], detail: null };
}

/** Below this, a reading is too shaky to put in the largest text on the screen. */
const NAMING_CONFIDENCE = 72;

/**
 * Names the class from what was on the board.
 *
 * The heading written at the start of a lecture is almost always its subject.
 * The student can always correct it — this only spares them the typing.
 *
 * A shaky reading proposes nothing: the title is the most prominent text on the
 * screen, and a garbled one there undoes the impression that the camera
 * understood the class. An empty field invites a name; a wrong one has to be
 * noticed and deleted first.
 */
export function suggestSubject(pages: OcrPage[]): string {
  if (pages.length === 0) return "";

  // Only readings that produced text carry an opinion. A moment where the board
  // was blank scores near zero and would drag an otherwise solid reading below
  // the bar.
  const read = pages.filter((page) => page.text.trim().length > 0);
  if (read.length === 0) return "";
  const confidence =
    read.reduce((sum, page) => sum + page.confidence, 0) / read.length;
  if (confidence < NAMING_CONFIDENCE) return "";

  const heading = read
    .flatMap((page) => page.text.split("\n"))
    .map((line) => line.trim())
    .find((line) => line.length >= 4 && line.length <= 40 && !isFormula(line));
  if (heading) return capitalise(clean(heading) ?? heading);

  const counts = new Map<string, number>();
  for (const page of read) {
    for (const raw of page.text.split(/[^\p{L}\p{N}]+/u)) {
      const word = raw.toLowerCase();
      if (word.length < 5 || STOPWORDS.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? capitalise(top[0]) : "";
}

function toLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 2);
}

/**
 * Tidies a line enough to be shown once. Deliberately conservative: tightening
 * spacing and dropping stray marks is safe, guessing at misread characters is
 * not — inventing a correction is worse than showing nothing.
 */
function clean(line: string | undefined): string | null {
  if (!line) return null;
  const tidied = line
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}(]+/u, "")
    .replace(/[^\p{L}\p{N})²]+$/u, "")
    .trim();
  if (tidied.length < 3) return null;
  return tidied.length > 58 ? `${tidied.slice(0, 57)}…` : tidied;
}

/** OCR wobbles between readings; compare on a loose key so a re-read isn't "new". */
function normalise(line: string): string {
  return line.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isFormula(line: string): boolean {
  return /[=<>±√∆Δ]/.test(line) || /\d\s*[a-z]\s*[²^]/i.test(line);
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const STOPWORDS = new Set([
  "para", "como", "cada", "quando", "onde", "pelo", "pela", "esse", "essa",
  "isso", "aquele", "aquela", "temos", "sendo", "então", "entao", "mais",
  "menos", "muito", "pode", "deve", "seja", "está", "esta", "sobre", "outro",
  "outra", "todos", "todas", "http", "https", "porque", "assim",
]);

import type { OcrPage } from "./useOcr";

/**
 * Reading the board is a supporting tool, never the product.
 *
 * Its only jobs are to give each saved moment a recognisable label and to let
 * the class name itself. The student is never shown raw extracted text: what
 * they came for is the lecture, in order, already curated.
 */

/**
 * What this moment added to the board.
 *
 * Compared against the previous moment rather than described on its own: a
 * board keeps everything already written on it, so repeating the whole thing
 * makes every moment look identical and makes the camera look like it
 * understood nothing. What was just written is the reason the moment was kept.
 */
export function summariseMoment(
  text: string,
  previousText?: string,
): string | null {
  const lines = toLines(text);
  if (lines.length === 0) return null;

  if (previousText) {
    const seen = new Set(toLines(previousText).map(normalise));
    const added = lines.filter((line) => !seen.has(normalise(line)));
    if (added.length > 0) return added.join(" · ");
  }

  // First moment of the class, or the board was wiped: name it by its heading
  // and the formula on it, which is how a student recognises a topic.
  const formula = lines.find(isFormula);
  const heading = lines.find((line) => line.length <= 46 && !isFormula(line));
  if (heading && formula) return `${heading} — ${formula}`;
  return heading ?? formula ?? lines[0];
}

function toLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 2);
}

/** OCR wobbles between readings; compare on a loose key so a re-read isn't "new". */
function normalise(line: string): string {
  return line.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Names the class from what was on the board.
 *
 * The heading written at the start of a lecture is almost always its subject,
 * so that wins. Repeated terms are the fallback for a board that never got a
 * title. The student can always correct it — this only spares them the typing.
 */
export function suggestSubject(pages: OcrPage[]): string {
  if (pages.length === 0) return "";

  const firstHeading = pages
    .flatMap((page) => page.text.split("\n"))
    .map((line) => line.trim())
    .find(
      (line) => line.length >= 4 && line.length <= 40 && !isFormula(line),
    );
  if (firstHeading) return capitalise(firstHeading);

  const counts = new Map<string, number>();
  for (const page of pages) {
    for (const raw of page.text.split(/[^\p{L}\p{N}]+/u)) {
      const word = raw.toLowerCase();
      if (word.length < 5 || STOPWORDS.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? capitalise(top[0]) : "";
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function isFormula(line: string): boolean {
  return /[=<>±√∆Δ]/.test(line) || /\d\s*[a-z]\s*[²^]/i.test(line);
}

const STOPWORDS = new Set([
  "para", "como", "cada", "quando", "onde", "pelo", "pela", "esse", "essa",
  "isso", "aquele", "aquela", "temos", "sendo", "então", "entao", "mais",
  "menos", "muito", "pode", "deve", "seja", "está", "esta", "sobre", "outro",
  "outra", "todos", "todas", "http", "https", "porque", "assim",
]);

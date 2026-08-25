import type { OcrPage } from "./useOcr";

export interface ReviewTopic {
  atMs: number;
  /** The line that reads like a heading for this capture. */
  title: string;
  /** Lines that look like formulas or definitions worth revisiting. */
  points: string[];
}

export interface Review {
  topics: ReviewTopic[];
  keywords: string[];
  lineCount: number;
  averageConfidence: number;
}

/**
 * Turns extracted text into something a student can revise from.
 *
 * Everything here is derived from what was actually read off the board —
 * nothing is generated or inferred. A language model would write nicer prose,
 * but a summary that invents content it never saw is the fastest way to lose
 * an audience's trust in everything else on screen.
 */
export function buildReview(pages: OcrPage[]): Review {
  const topics: ReviewTopic[] = [];
  const wordCounts = new Map<string, number>();
  let lineCount = 0;
  let confidenceSum = 0;

  for (const page of pages) {
    const lines = page.text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 2);

    lineCount += lines.length;
    confidenceSum += page.confidence;
    if (lines.length === 0) continue;

    // The heading is usually the first short line without maths in it.
    const title =
      lines.find((line) => line.length <= 48 && !looksLikeFormula(line)) ??
      lines[0];

    const points = lines
      .filter((line) => line !== title)
      .filter((line) => looksLikeFormula(line) || line.length > 12)
      .slice(0, 4);

    topics.push({ atMs: page.atMs, title, points });

    for (const word of page.text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (word.length < 4 || STOPWORDS.has(word)) continue;
      wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
    }
  }

  const keywords = [...wordCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);

  return {
    topics,
    keywords,
    lineCount,
    averageConfidence: pages.length ? confidenceSum / pages.length : 0,
  };
}

/** Equations and inequalities are what a student most often needs back. */
function looksLikeFormula(line: string): boolean {
  return /[=<>+±√∆Δ]/.test(line) || /\d\s*[a-z]\s*[²^]/i.test(line);
}

const STOPWORDS = new Set([
  "para", "como", "cada", "quando", "onde", "pelo", "pela", "esse", "essa",
  "isso", "aquele", "aquela", "temos", "sendo", "então", "entao", "mais",
  "menos", "muito", "pode", "deve", "seja", "está", "esta", "sobre", "outro",
  "outra", "todos", "todas", "http", "https",
]);

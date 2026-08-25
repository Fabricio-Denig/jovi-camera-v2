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

/**
 * What kind of thing is on the surface — by its shape, never by its subject.
 *
 * A formula looks like a formula in physics, chemistry and economics alike; a
 * list looks like a list in law and in biology. Recognising structure is what
 * lets one camera follow any class without anybody teaching it the discipline.
 */
export type ContentKind =
  | "formula"
  | "codigo"
  | "datas"
  | "lista"
  | "tabela"
  | "definicao"
  | "esquema"
  | "texto";

interface DescribeOptions {
  text?: string;
  previousText?: string;
  /** Fraction of the frame covered in ink, used when nothing reads as text. */
  ink?: number;
}

const FALLBACK_LABELS: Record<MomentReason, string> = {
  "novo-topico": "Novo tópico no quadro",
  "novo-slide": "Novo slide",
  "novo-conteudo": "Conteúdo acrescentado",
  manual: "Você marcou este momento",
};

/** Ink covering this much of the frame with nothing readable is a drawing. */
const DIAGRAM_INK = 0.006;

const KIND_LABELS: Record<ContentKind, { first: string; added: string }> = {
  formula: { first: "Fórmula no quadro", added: "Nova fórmula" },
  codigo: { first: "Código no quadro", added: "Novo trecho de código" },
  datas: { first: "Datas no quadro", added: "Novas datas" },
  lista: { first: "Lista de tópicos", added: "Itens novos na lista" },
  tabela: { first: "Tabela no quadro", added: "Tabela atualizada" },
  definicao: { first: "Definição no quadro", added: "Nova definição" },
  esquema: { first: "Esquema no quadro", added: "Esquema acrescentado" },
  texto: { first: "Início do tópico", added: "Novo conceito" },
};

export function describeMoment(
  reason: MomentReason,
  { text, previousText, ink }: DescribeOptions = {},
): MomentDescription {
  const lines = text ? toLines(text) : [];

  if (lines.length === 0) {
    // Nothing readable. Plenty of ink still means something was drawn — a
    // diagram, a graph, a circuit — and saying so beats a generic label.
    if (reason !== "manual" && (ink ?? 0) >= DIAGRAM_INK) {
      return { label: KIND_LABELS.esquema.first, detail: null };
    }
    return { label: FALLBACK_LABELS[reason], detail: null };
  }

  // What this moment added, rather than everything the surface still carries.
  const previousLines = previousText ? toLines(previousText) : [];
  const seen = new Set(previousLines.map(normalise));
  const added = previousLines.length
    ? lines.filter((line) => !seen.has(normalise(line)))
    : lines;

  const focus = added.length > 0 ? added : lines;
  const kind = classifyContent(focus);
  const detail = clean(pickLine(focus, kind));

  if (reason === "manual") {
    return { label: FALLBACK_LABELS.manual, detail };
  }

  const labels = KIND_LABELS[kind];
  return {
    label: previousLines.length > 0 ? labels.added : labels.first,
    detail,
  };
}

/**
 * Structure detectors, ordered by how specific they are. Code carries `=` and
 * would read as a formula, so it is asked first; a table's columns survive OCR
 * as runs of spaces or pipes, so it comes before the line-level tests.
 */
function classifyContent(lines: string[]): ContentKind {
  const hits = (test: (line: string) => boolean) => lines.filter(test).length;

  if (hits(isCode) >= 1 && hits(isCode) * 2 >= lines.length) return "codigo";
  if (hits(isTableRow) >= 2) return "tabela";
  if (hits(isFormula) >= 1) return "formula";
  if (hits(hasYear) >= 2) return "datas";
  if (hits(isListItem) >= 2) return "lista";
  if (hits(isDefinition) >= 1) return "definicao";
  return "texto";
}

/** The line worth showing is the one that justified the label. */
function pickLine(lines: string[], kind: ContentKind): string | undefined {
  const test =
    kind === "codigo"
      ? isCode
      : kind === "formula"
        ? isFormula
        : kind === "datas"
          ? hasYear
          : kind === "lista"
            ? isListItem
            : kind === "definicao"
              ? isDefinition
              : kind === "tabela"
                ? isTableRow
                : (line: string) => line.length >= 4;
  return lines.find(test) ?? lines.find((line) => line.length >= 4);
}

function isFormula(line: string): boolean {
  return (
    /[=≠≤≥±√∑∫∆Δπ∞]/.test(line) ||
    /\d\s*[a-z]\s*[²³^]/i.test(line) ||
    /\b\d+\s*[+\-*/×÷]\s*\d+/.test(line)
  );
}

function isCode(line: string): boolean {
  return (
    /[{};]\s*$/.test(line) ||
    /=>|::|!==|===|\+\+|<\/\w+>/.test(line) ||
    /\b(function|const|let|var|def|class|import|from|return|public|static|void|print|console|SELECT|INSERT|WHERE)\b/.test(
      line,
    )
  );
}

function hasYear(line: string): boolean {
  return (
    /\b(1[0-9]{3}|20[0-2][0-9])\b/.test(line) ||
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(line)
  );
}

function isListItem(line: string): boolean {
  return /^\s*([-–—•*·]|\d{1,2}[.)]|[a-z][.)])\s+\S/i.test(line);
}

function isTableRow(line: string): boolean {
  return /\|/.test(line) || (line.match(/ {3,}/g) ?? []).length >= 2;
}

function isDefinition(line: string): boolean {
  return (
    /^[\p{Lu}][\p{L} ]{2,28}\s*[:—–]\s+\S/u.test(line) ||
    /\b(é|são|significa|chama-se|define-se|consiste em|trata-se)\b/i.test(line)
  );
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

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const STOPWORDS = new Set([
  "para", "como", "cada", "quando", "onde", "pelo", "pela", "esse", "essa",
  "isso", "aquele", "aquela", "temos", "sendo", "então", "entao", "mais",
  "menos", "muito", "pode", "deve", "seja", "está", "esta", "sobre", "outro",
  "outra", "todos", "todas", "http", "https", "porque", "assim",
]);

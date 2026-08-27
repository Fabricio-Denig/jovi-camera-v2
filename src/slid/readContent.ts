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
  /** The structure recognised, so the class can say what kinds of content it holds. */
  kind: ContentKind | null;
  /** The topic's own name, when the surface carried one. Null means the label is a fallback. */
  heading: string | null;
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
  | "texto";

interface DescribeOptions {
  text?: string;
  previousText?: string;
  /** How well this page read. Below the bar, the moment shows its label alone. */
  confidence?: number;
  /** Where this moment sits in the class, and how many there are in all. */
  position?: number;
  total?: number;
  /** The surface kept growing while this stayed the same topic. */
  refined?: boolean;
}

/**
 * What a moment is called when the surface carried nothing readable.
 *
 * Every one of these has to be true without having read a word, which rules
 * out most of what would sound clever. The rule knows the surface was replaced;
 * it does not know whether that surface was a projector, a whiteboard or a
 * sheet of paper — so "Trecho da apresentação" and "Anotação no quadro" are
 * exactly the confident guess to avoid, wrong a third of the time.
 *
 * What it does know is honest and, usefully, different for each moment: where
 * the moment sits in the class, and whether the surface kept filling up after
 * it was kept. A lecture whose reading failed throughout used to come back as
 * seven identical rows, which reads as a camera that noticed nothing seven
 * times. These say the little that is actually known, and it is enough that no
 * two neighbours land on the same words.
 */
function fallbackLabel(
  reason: MomentReason,
  { position, total, refined }: DescribeOptions,
): string {
  if (reason === "manual") return "Você marcou este momento";
  // The surface grew under the same topic — the one thing the rule saw happen.
  // Two ways of saying it, alternating, because two neighbours that both grew
  // is common and two identical rows is the thing being fixed.
  if (reason === "novo-conteudo" || refined)
    return position !== undefined && position % 2 === 1
      ? "Conteúdo acrescentado"
      : "Desenvolvimento do tópico";
  if (position === 0) return "Início da aula";
  if (total !== undefined && position === total - 1 && total > 2)
    return "Fechamento da aula";
  if (position === undefined) return "Momento importante";
  return position % 2 === 0 ? "Conteúdo para revisão" : "Registro da aula";
}

/**
 * The fallback title, used only when the surface carried no heading of its own.
 *
 * "Nova fórmula" tells the student what the camera noticed changing, which is
 * the camera's experience of the class rather than theirs. A moment is now a
 * topic, so every row is new by construction and saying so adds nothing —
 * these say what kind of thing the topic was.
 */
const KIND_LABELS: Record<ContentKind, string> = {
  formula: "Fórmula apresentada",
  codigo: "Código apresentado",
  datas: "Datas apresentadas",
  lista: "Lista de tópicos",
  tabela: "Tabela apresentada",
  definicao: "Definição apresentada",
  texto: "Conceito apresentado",
};

/** The category shown beside a moment, in one word. */
export const KIND_TAGS: Record<ContentKind, string> = {
  formula: "Fórmula",
  codigo: "Código",
  datas: "Datas",
  lista: "Lista",
  tabela: "Tabela",
  definicao: "Definição",
  texto: "Conceito",
};

export function describeMoment(
  reason: MomentReason,
  options: DescribeOptions = {},
): MomentDescription {
  const { text, previousText, confidence } = options;
  const lines = text ? toLines(text) : [];

  // Nothing read cleanly. Handwriting defeats OCR routinely, so the honest
  // answer is the reason the moment was kept — never a guess at what it was.
  if (lines.length === 0)
    return {
      label: fallbackLabel(reason, options),
      detail: null,
      kind: null,
      heading: null,
    };

  // What this moment added, rather than everything the surface still carries.
  const previousLines = previousText ? toLines(previousText) : [];
  const seen = new Set(previousLines.map(normalise));
  const added = previousLines.length
    ? lines.filter((line) => !seen.has(normalise(line)))
    : lines;

  const focus = added.length > 0 ? added : lines;
  const kind = classifyContent(focus);

  // The label comes from structure and survives a shaky reading; the line
  // itself does not. Showing "(x) =axr2 + bx + c k" under a moment is the same
  // failure as a garbled topic, one level down — the student sees a camera
  // that misread their class rather than one that understood it.
  // The structure survives a shaky reading and the exact characters do not: a
  // formula misread character by character still carries "=" and digits, so
  // calling it a formula stays right where quoting it would be wrong. The gate
  // belongs on the line, not on the label.
  const picked = clean(
    kind === "formula" ? trimStrayToken(pickLine(focus, kind)) : pickLine(focus, kind),
  );
  const detail =
    (confidence ?? 100) >= DETAIL_CONFIDENCE && picked && readsAsDetail(picked)
      ? picked
      : null;

  if (reason === "manual") {
    return { label: "Você marcou este momento", detail, kind, heading: null };
  }


  // A slide or a board almost always names its own topic, and that heading is
  // a far better title than any category ever is: "Leis de Newton" instead of
  // "Nova fórmula". It is a line the lecturer wrote, so nothing is invented.
  const heading = pickHeading(lines);

  // The same words twice running are not two topics. A lecturer works through
  // one slide for two minutes, or four moments in a row are all formulas, and
  // the timeline came back saying "Funcao do 20 grau" twice and "Fórmula
  // apresentada" four times — which reads as a camera that saw the same thing
  // and filed it again. It is the same topic with more on it, and that is what
  // the row should say. Working out what the row before was called is enough to
  // catch both cases with one rule.
  const previousHeading = previousLines.length ? pickHeading(previousLines) : null;
  const title = heading ?? KIND_LABELS[kind];
  const previousTitle = previousLines.length
    ? (previousHeading ?? KIND_LABELS[classifyContent(previousLines)])
    : null;
  const continued = Boolean(
    previousTitle && normalise(title) === normalise(previousTitle),
  );

  return {
    label: continued ? fallbackLabel(reason, { ...options, refined: true }) : title,
    detail: heading && detail === heading ? null : detail,
    kind,
    heading,
  };
}

/** How a recognised structure is named when the class counts them up. */
export const KIND_NAMES: Record<ContentKind, [one: string, many: string]> = {
  formula: ["fórmula", "fórmulas"],
  codigo: ["trecho de código", "trechos de código"],
  datas: ["marco no tempo", "marcos no tempo"],
  lista: ["lista", "listas"],
  tabela: ["tabela", "tabelas"],
  definicao: ["definição", "definições"],
  texto: ["anotação", "anotações"],
};

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

/**
 * The topic's own name, when the surface carries one.
 *
 * A heading sits at the top and reads as language: short, no operators, no
 * bullet marker. Taking the first line that qualifies matches how slides and
 * boards are written, and anything that fails simply leaves the title to the
 * category.
 */
/** Long enough for a real lecture heading, short enough to still be a title. */
const HEADING_MAX = 54;

function pickHeading(lines: string[]): string | null {
  for (const line of lines.slice(0, 3)) {
    // Structure is tested on the raw line: tidying collapses the runs of
    // spaces that are the only sign a line came out of a table, and a column
    // header then reads as a perfectly good heading.
    if (isTableRow(line) || isListItem(line)) continue;
    const tidied = clean(line);
    if (!tidied) continue;
    if (tidied.length < 6 || tidied.length > HEADING_MAX) continue;
    if (isFormula(tidied) || isCode(tidied)) continue;
    if (!readsAsLanguage(tidied)) continue;
    return capitalise(tidied);
  }
  return null;
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
    /[=<>≠≤≥±√∑∫∆Δπ∞]/.test(line) ||
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

/**
 * What the class was about, as a handful of topics.
 *
 * These are lines the lecturer actually wrote — never a synthesis written on
 * their behalf. The bar to appear here is deliberately high: OCR on handwriting
 * garbles routinely, and a bullet reading "Ás. NTE OR PR" does more damage than
 * an empty section ever could. A misread line does not merely look sloppy, it
 * tells the student the camera did not understand their class.
 *
 * So a line has to survive three questions: was the page read confidently, does
 * the line read as language, and is it something new. Whatever fails is
 * dropped, and an empty list is a perfectly good answer.
 */
export function summariseTopics(pages: OcrPage[], limit = 5): string[] {
  const kept: { text: string; tokens: Set<string> }[] = [];

  for (const page of pages) {
    if (page.confidence < TOPIC_CONFIDENCE) continue;

    for (const raw of page.text.split("\n")) {
      const line = raw.trim();
      if (line.length < 10 || line.length > 52) continue;
      // Formulas, code and table rows are content, and belong to the moment
      // that captured them rather than to the list of what the class covered.
      if (isFormula(line) || isCode(line) || isTableRow(line)) continue;

      const tidied = clean(line);
      if (!tidied || !readsAsLanguage(tidied)) continue;

      // OCR re-reads the same line differently on every frame, so exact
      // matching lets the same topic through twice, garbled two ways.
      const tokens = wordSet(tidied);
      if (kept.some((k) => overlap(k.tokens, tokens) >= TOPIC_SAME)) continue;

      kept.push({ text: capitalise(tidied), tokens });
      if (kept.length >= limit) return kept.map((k) => k.text);
    }
  }
  return kept.map((k) => k.text);
}

/** A page read below this is not allowed to name anything on the screen. */
const TOPIC_CONFIDENCE = 78;
/** Below this, a moment shows what it recognised but not the line it read. */
const DETAIL_CONFIDENCE = 76;
/** Word overlap at which two readings are the same line, read twice. */
const TOPIC_SAME = 0.5;

/**
 * Does this read like something a person wrote, or like OCR debris?
 *
 * Garbled readings share a shape: stray single letters, punctuation where
 * letters should be, capitals scattered mid-line. Real writing does not.
 */
function readsAsLanguage(line: string): boolean {
  const letters = (line.match(/\p{L}/gu) ?? []).length;
  if (letters / line.length < 0.62) return false;

  const words = line.split(/\s+/).filter(Boolean);
  const solid = words.filter((w) => (w.match(/\p{L}/gu) ?? []).length >= 3);
  // Two real words is the shortest thing that reads as a topic.
  if (solid.length < 2) return false;
  // More debris than words: "Ás. NTE OR PR" fails here.
  if (solid.length < words.length / 2) return false;

  // Capitals scattered after the first word are the signature of a bad read.
  const shouty = words
    .slice(1)
    .filter((w) => w.length >= 2 && w === w.toUpperCase() && /\p{L}/u.test(w));
  return shouty.length <= 1;
}

/**
 * A formula that has already closed does not pick up a lone letter afterwards:
 * "f(x) = ax2 + bx + c s" is a clean reading with one character of debris stuck
 * to the end. Prose is left alone — "concavidade depende de a" ends in a lone
 * letter and means it.
 */
function trimStrayToken(line: string | undefined): string | undefined {
  if (!line || !line.includes("=")) return line;
  // Only when the expression has already closed: a lone letter after "+" is a
  // term of the formula, a lone letter after "c" or ")" is debris.
  return line.replace(/(?<=[\p{L}\p{N})])\s+[\p{L}\p{N}]\s*$/u, "");
}

/**
 * Is this line safe to put on the screen as what was written?
 *
 * Prose has to read as prose; a formula has to read as a formula. Anything
 * else — "ao do 20 grau LÁ" — is a reading that fell apart, and showing it
 * tells the student the camera misread their class rather than understood it.
 */
function readsAsDetail(line: string): boolean {
  if (readsAsLanguage(line)) return true;
  if (!isFormula(line) && !isCode(line)) return false;

  // A formula that lost a bracket lost more than a bracket.
  let depth = 0;
  for (const ch of line) {
    if (ch === "(") depth++;
    else if (ch === ")" && --depth < 0) return false;
  }
  if (depth !== 0) return false;

  // Shouty fragments mid-line are the signature of a bad read, in a formula
  // just as much as in a sentence.
  return !line
    .split(/\s+/)
    .slice(1)
    .some((w) => w.length >= 2 && /^\p{Lu}+$/u.test(w));
}

function wordSet(line: string): Set<string> {
  return new Set(
    line
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of b) if (a.has(word)) shared++;
  return shared / Math.min(a.size, b.size);
}

/**
 * The class in a sentence, assembled from what was actually captured.
 *
 * Every clause is backed by a number or by a line that was on the surface: how
 * many moments, how long, which structures were recognised, which topics the
 * class moved through. Nothing here knows the subject, the teacher or the
 * course, and nothing here guesses at them.
 *
 * When the reading was too weak to name topics, the sentence says so and
 * describes what it does have. That is the honest version of this screen, and
 * it is also the one that survives a lecture hall with bad light.
 */
export interface ClassOverview {
  moments: number;
  durationMs: number;
  /** Topic names in the order they appeared, already filtered for quality. */
  headings: string[];
  /** Recognised structures with how often each appeared. */
  kinds: [ContentKind, number][];
  /**
   * The matéria, when the student chose one. The only fact in this sentence
   * that did not come from the surface — and it is here precisely because a
   * person put it there. Left out, the sentence reads exactly as before.
   */
  discipline?: string | null;
}

export function summariseClass({
  moments,
  durationMs,
  headings,
  kinds,
  discipline,
}: ClassOverview): string {
  if (moments === 0) return "";

  const count =
    moments === 1 ? "1 momento importante" : `${moments} momentos importantes`;
  // Arredondar meio minuto para cima dava "em 1 minuto" a uma aula de 26
  // segundos — pequeno, mas é a primeira frase da tela, e ela não pode
  // arredondar nada para cima.
  const minutes = Math.round(durationMs / 60000);
  const span =
    minutes < 1
      ? "menos de um minuto"
      : `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  // "Esta aula de Física" — the matéria belongs to the class, so it belongs to
  // the sentence about the class. "Outra" is the button for naming one, not a
  // name, and never reaches the text.
  const named = discipline && discipline !== "Outra" ? discipline : null;
  const subject = named ? `Esta aula de ${named}` : "Esta aula";

  // Nothing read cleanly. Say what the class does have rather than dressing up
  // an absence — the captures are still in order, and that is worth something.
  if (headings.length === 0) {
    return (
      `${subject} registrou ${count} em ${span}. ` +
      "Alguns textos não foram reconhecidos com confiança, mas as capturas " +
      "ficaram organizadas em ordem para revisão."
    );
  }

  const focus = describeFocus(kinds);
  const opening = focus
    ? `${subject} teve ${count} em ${span}, com foco em ${focus}.`
    : `${subject} teve ${count} em ${span}.`;

  const unique = [...new Set(headings)];
  if (unique.length === 1) {
    return `${opening} O conteúdo girou em torno de ${unique[0]}.`;
  }
  if (unique.length === 2) {
    return `${opening} Começou com ${unique[0]} e terminou com ${unique[1]}.`;
  }
  return (
    `${opening} Começou com ${unique[0]}, passou por ${unique[1]} ` +
    `e terminou com ${unique[unique.length - 1]}.`
  );
}

/**
 * The class's own sentence, re-opened under a different matéria.
 *
 * The sentence is written once and stored, because reopening a class months
 * later must not depend on reading the board again. But the matéria is the one
 * part of it a student can change afterwards — and a class that says "Esta aula
 * de Física" under a matéria that no longer exists is the app contradicting
 * itself on the screen where it explains what it understood.
 *
 * Only the opening clause is touched. Everything after it came from the
 * surface and stays exactly as it was read.
 */
const OPENING = /^Esta aula(?: de .+?)? (teve|registrou) /;

export function reopenOverview(
  overview: string,
  discipline: string | null,
): string {
  if (!overview || !OPENING.test(overview)) return overview;
  const named = discipline && discipline !== "Outra" ? ` de ${discipline}` : "";
  return overview.replace(OPENING, `Esta aula${named} $1 `);
}

/**
 * The one or two structures that dominated, named the way a student would.
 * A structure seen once is not a focus — mentioning it produced "fórmulas e
 * anotação", which reads as a sentence assembled by a machine.
 */
function describeFocus(kinds: [ContentKind, number][]): string | null {
  const ranked = [...kinds].sort((a, b) => b[1] - a[1]);
  const strong = ranked.filter(([, count]) => count >= 2).slice(0, 2);
  const chosen = strong.length > 0 ? strong : ranked.slice(0, 1);
  if (chosen.length === 0) return null;
  const names = chosen.map(([kind, count]) => KIND_NAMES[kind][count === 1 ? 0 : 1]);
  return names.length === 1 ? names[0] : `${names[0]} e ${names[1]}`;
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

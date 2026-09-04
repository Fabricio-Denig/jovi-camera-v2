/**
 * "Isso parece uma aula?"
 *
 * The question this file answers, and the one it deliberately does not answer,
 * are the whole design. An earlier version asked "does this look like a
 * professional whiteboard?" — it scored a frame on absolute brightness, on how
 * sparse the writing was, and on how uniform the panel was. Measured against
 * real study material, that classifier rejected every single one:
 *
 *   folha A4 escrita     score 0.038   (escrita densa demais, página não uniforme)
 *   caderno aberto       score 0.000   (sombra da lombada)
 *   slide escuro         score 0.000   (fundo escuro)
 *   lousa verde com giz  score 0.000   (fundo escuro)
 *
 * Every one of those thresholds encoded the same wrong assumption. What study
 * material actually has in common is not brightness and not sparsity: it is a
 * clean surface with marks arranged on it, with space left between them.
 * Paper, a chalkboard and a projected slide all share that; a face, a room and
 * an empty table do not.
 *
 * These are heuristics, not a trained classifier — deliberately, because a
 * heavy model that stutters the viewfinder during a live demo is worse than a
 * suggestion that occasionally stays quiet.
 */

/**
 * 128×96 rather than something smaller: at 64×48 the downscale blurs thin
 * handwriting into the page itself — measured on a test board, the darkest
 * pixel went from 26 to 123 and the ink signal all but vanished. This is the
 * smallest sample that still preserves writing.
 */
const SAMPLE_W = 128;
const SAMPLE_H = 96;

let sampler: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null =
  null;

function getSampler() {
  if (!sampler) {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_W;
    canvas.height = SAMPLE_H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    sampler = { canvas, ctx };
  }
  return sampler;
}

/**
 * The windows the frame is read through, as multiples of the preview's own crop.
 *
 * One window was the single biggest reason the camera missed a real projector.
 * A line of writing needs three of the ninety-six sample rows to register as a
 * line, which is 3.1 % of the frame's height; a slide across a lecture hall
 * fills maybe a third of the width, so its six lines land under 1 % each and
 * nothing forms. Measured on the same slide at different apparent sizes, only
 * one narrow band of scale worked at all:
 *
 *   ocupa 95 % da largura   as linhas colam numa faixa só  → não sugere
 *   ocupa 70 % da largura   6 faixas                       → sugere
 *   ocupa 50 % da largura   1 faixa                        → não sugere
 *   ocupa 35 % / 25 % / 18 %                               → não sugere
 *
 * Both ends fail, which is the tell: the classifier is not wrong about what it
 * sees, it is looking at the wrong scale. So it stops choosing one. The same
 * classifier runs over a few concentric windows and the strongest reading wins
 * — the wide shot catches a board filling the room, the tighter ones catch the
 * slide across the hall, and cropping also concentrates the ink enough for the
 * contrast rescue to find it.
 */
export const ANALYSIS_SCALES = [1, 1.7, 2.6];

/**
 * O segundo limiar de tinta, tentado quando o primeiro não achou nada.
 *
 * O resgate por percentil que existia aqui nunca disparava, e o painel de
 * diagnóstico foi quem mostrou: o limiar saía 22 até nas cenas de sala clara
 * para as quais ele tinha sido feito. A causa é que o percentil alto de um
 * quadro com um slide iluminado contra uma sala escura mede a *borda da tela*,
 * que é a maior variação da cena — e não a tinta dentro dela, que é o que
 * importa. Nenhum percentil separa as duas: onde a tinta cai, depende do
 * tamanho do slide, que é justamente o que não se sabe.
 *
 * Então o limiar deixa de ser calculado e passa a ser procurado, do mesmo jeito
 * que a escala. Medido: com 11, o slide a 50 % da largura com 45 % de contraste
 * passa a ser visto, o de 32 % com 50 % também, e nenhuma das vinte cenas
 * adversárias entra junto — porque quem rejeita textura são as provas de
 * estrutura, e elas funcionam igual em qualquer limiar.
 */
const RESCUE_DELTA = 11;

/**
 * Downscaled grayscale snapshot of the current frame.
 *
 * `zoom` is the crop the preview is applying on its own — the part the camera
 * hardware did not do. The session has to read the same window the student is
 * looking at, or it would answer questions about a frame nobody is seeing.
 */
export function sampleFrame(
  video: HTMLVideoElement,
  zoom = 1,
): Uint8Array | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const s = getSampler();
  if (!s) return null;

  const scale = Math.max(1, zoom);
  const sw = video.videoWidth / scale;
  const sh = video.videoHeight / scale;
  s.ctx.drawImage(
    video,
    (video.videoWidth - sw) / 2,
    (video.videoHeight - sh) / 2,
    sw,
    sh,
    0,
    0,
    SAMPLE_W,
    SAMPLE_H,
  );
  const { data } = s.ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);

  const gray = new Uint8Array(SAMPLE_W * SAMPLE_H);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }
  return gray;
}

/**
 * Radius of the local background estimate, in sample pixels — roughly the
 * height of a line of writing at this scale. Large enough that a stroke never
 * becomes its own background, small enough to follow a shadow across a page.
 */
const BACKGROUND_RADIUS = 6;

/*
 * How far a pixel must depart from the surface behind it to count as a mark.
 *
 * Compared against a *local* background, never a global one: a vignette, a
 * shadow falling across the page or a lamp being switched on all move the
 * background and the pixel together, so the mask does not move at all.
 *
 * The threshold itself used to be 22 out of 255, fixed, and that is what a
 * projector in a lit room fails. Measured on the same slide as the room lights
 * come up, the ink pulls away from the screen by less and less:
 *
 *   contraste 100%   p90 36        contraste 50%   p90 18
 *   contraste  75%   p90 27        contraste 35%   p90 13   ← 0 linhas em 22
 *
 * So the bar moves with the scene. It cannot move with brightness alone —
 * measured across the adversarial scenes, contrast is not what separates study
 * material from a room: a venetian blind pulls away harder (p90 57) than a real
 * projected slide does (p90 55). Texture out-contrasts writing routinely.
 *
 * That is the whole reason this is only a normalisation. It puts a page under a
 * lamp and a slide across a dim hall on the same footing, and then the tests
 * that actually decide — runs, bands, stroke width — do their work on a mask of
 * comparable density either way. The floor is what keeps a blank wall blank:
 * below it there is nothing to normalise, only sensor noise to amplify.
 */
/** The bar for a scene with light to spare. Unchanged, and it stays the ceiling. */
const MARK_DELTA = 22;
/** How much of what a faint scene does offer counts as ink. */
const MARK_DELTA_SHARE = 0.8;
/*
 * The percentile that stands for the ink, and it has to be a high one. Writing
 * is sparse — a few per cent of the pixels — so the 90th percentile is still
 * describing the paper. Tried there first, and it dragged the bar down on
 * scenes that were working: an open notebook reads p90 12 and p98 25, and
 * rescuing it at 10 flooded the page until fifty of the ninety-six rows counted
 * as written. At the 98th the two cases separate cleanly — the notebook keeps
 * the full bar, and the projector losing to daylight (p98 21, then 15) is the
 * one that steps down.
 */
/** Never go below this: a smooth wall would turn its own noise into writing. */
const MARK_DELTA_FLOOR = 8;

/**
 * A row of writing breaks into many short runs of marks — letters, strokes,
 * symbols. Everything else that crosses a frame horizontally does not: the
 * edge of a sheet against a desk, a ruled line, the lid of a laptop are all
 * one long run. Counting runs rather than marked pixels is what separates
 * writing from the objects around it.
 */
const MIN_RUNS = 4;
/** A row needs some marks to be a line of writing, and cannot be solid ink. */
const MIN_ROW_COVER = 0.02;
const MAX_ROW_COVER = 0.6;
/** A line of writing is several sample rows tall; a single row is a coincidence. */
const MIN_BAND = 3;

/** Local mean via an integral image: O(n) whatever the radius. */
function localBackground(gray: Uint8Array, radius: number): Float64Array {
  const stride = SAMPLE_W + 1;
  const sums = new Float64Array(stride * (SAMPLE_H + 1));
  for (let y = 0; y < SAMPLE_H; y++) {
    for (let x = 0; x < SAMPLE_W; x++) {
      sums[(y + 1) * stride + x + 1] =
        gray[y * SAMPLE_W + x] +
        sums[y * stride + x + 1] +
        sums[(y + 1) * stride + x] -
        sums[y * stride + x];
    }
  }

  const out = new Float64Array(SAMPLE_W * SAMPLE_H);
  for (let y = 0; y < SAMPLE_H; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(SAMPLE_H - 1, y + radius);
    for (let x = 0; x < SAMPLE_W; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(SAMPLE_W - 1, x + radius);
      const area = (y1 - y0 + 1) * (x1 - x0 + 1);
      out[y * SAMPLE_W + x] =
        (sums[(y1 + 1) * stride + x1 + 1] -
          sums[y0 * stride + x1 + 1] -
          sums[(y1 + 1) * stride + x0] +
          sums[y0 * stride + x0]) /
        area;
    }
  }
  return out;
}

/**
 * The marks on the surface: writing, print, chalk, projected text.
 *
 * Departure from the local background in *either* direction, so dark ink on
 * paper and white chalk on a green board are the same thing to the rest of the
 * pipeline. This is what makes one classifier work for a notebook and for a
 * dark slide.
 */
/** O limiar que a última máscara usou. Lido só pelo diagnóstico. */
let lastInkThreshold = MARK_DELTA;
export function inkThresholdOfLastMask(): number {
  return lastInkThreshold;
}

export function markMask(gray: Uint8Array, forced?: number): Uint8Array {
  const background = localBackground(gray, BACKGROUND_RADIUS);

  const departure = new Float64Array(gray.length);
  // A 256-bucket histogram rather than a sort: the percentile is wanted every
  // tick, and the values are already bytes.
  const histogram = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) {
    const value = Math.abs(gray[i] - background[i]);
    departure[i] = value;
    histogram[Math.min(255, Math.round(value))]++;
  }

  const target = gray.length * 0.98;
  let seen = 0;
  let ink = 0;
  for (let level = 0; level < 256; level++) {
    seen += histogram[level];
    if (seen >= target) {
      ink = level;
      break;
    }
  }
  // One-sided on purpose. Adapting in both directions was tried first and cost
  // more than it bought: raising the bar on a bright slide thinned its strokes
  // until the lines merged into one band, and green chalk lost its density. A
  // scene with contrast to spare is already handled — the only broken case is
  // the scene whose ink never reaches the bar at all, so that is the only case
  // that moves it.
  const delta =
    forced ??
    (ink >= MARK_DELTA
      ? MARK_DELTA
      : Math.max(MARK_DELTA_FLOOR, ink * MARK_DELTA_SHARE));

  lastInkThreshold = delta;

  const mask = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    if (departure[i] > delta) mask[i] = 1;
  }
  return mask;
}

/**
 * Por que este quadro foi ou não considerado uma aula.
 *
 * O classificador é uma conjunção de condições, e quando ele diz não, dizer
 * *qual* delas falhou é a diferença entre "não detectou" e "o slide está pequeno
 * demais, use 2x". Esta é a informação que faltava para o teste em sala virar
 * relatório em vez de impressão.
 */
export type SceneVerdict =
  | "aula"
  | "sem-marcas"
  | "poucas-linhas"
  | "uma-faixa-so"
  | "cena-cheia"
  | "pouco-quebrado"
  | "marcas-grossas"
  | "trama-uniforme";

export const VERDICT_LABELS: Record<SceneVerdict, string> = {
  aula: "aula",
  "sem-marcas": "nenhuma escrita",
  "poucas-linhas": "escrita pequena demais",
  "uma-faixa-so": "só uma linha",
  "cena-cheia": "quadro cheio, parece cena",
  "pouco-quebrado": "marcas pouco quebradas",
  "marcas-grossas": "barras, não traços",
  "trama-uniforme": "trama, todo traço igual",
};

export interface SceneSignals {
  /** Sample rows belonging to a band of writing. */
  writtenRows: number;
  /** How many separate bands — lines of writing with clean surface between them. */
  lines: number;
  /** Share of the marks in those bands that are stroke-thin rather than bars. */
  thinShare: number;
  /** Average number of mark runs across those rows — how broken up the writing is. */
  runDensity: number;
  /** Whether this frame holds study material. Gate for capturing during a session. */
  isStudy: boolean;
  /**
   * Whether this frame holds enough evidence to *offer* SliD unprompted, which
   * is a stricter question than whether it holds study material. See below.
   */
  looksLikeClass: boolean;
  /**
   * Where the writing sits, as fractions of the frame. Measured over the bands
   * alone, so a slide across a room is framed on the slide rather than on the
   * laptop, the desk and the wall behind it.
   */
  bounds: ContentBounds | null;
  /** Qual condição decidiu. "aula" quando todas passaram. */
  verdict: SceneVerdict;
  /** O limiar de tinta que esta cena mereceu — quanto contraste ela tinha. */
  inkThreshold: number;
}

export interface ContentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/*
 * Measured across every reference scene at 128×96:
 *
 *                            linhas em faixa   runs/linha
 *   folha só com o título            5            14.8
 *   folha A4 densa                  34            11.4
 *   caderno aberto escrito          19            11.1
 *   folha escrita sobre a mesa      19             9.5
 *   slide num notebook              15             7.9
 *   slide escuro em tela cheia      28            10.2
 *   lousa verde com giz             17             8.8
 *   lousa branca escrita            19            11.8
 *   ──────────────────────────────────────────────────
 *   rosto                            9             4.3
 *   ambiente movimentado            96             8.8
 *   folha vazia sobre a mesa         0               —
 *   caderno vazio com pauta          0               —
 *   lousa vazia, parede              0               —
 *
 * Run density is what tells a line of writing from the band of a face: eyes and
 * brows make a wide, contiguous band too, but a sparse one. And a frame where
 * every row is written is not a document being read, it is a scene.
 */

/** A band has to exist before anything can be read from it. */
const MIN_WRITTEN_ROWS = 3;
/** Writing over most of the frame is a busy scene, not a surface with text. */
const MAX_WRITTEN_ROWS = Math.round(SAMPLE_H * 0.6);
/** Below this, the band is too sparse to be writing. */
const MIN_RUN_DENSITY = 6;

/*
 * Offering SliD is a stricter question than capturing during a session, and it
 * used to be the same question — both loops called isStudy. That is what let a
 * wall offer a class: isStudy accepts a single band of three rows, because
 * during a session, pointed at a page the student chose, one line is genuinely
 * a line. Unprompted, over a surface nobody said anything about, one band of
 * texture is not evidence of a lecture.
 *
 * So the suggestion asks for what a page, a slide and a board all have and
 * what a wall, a table and a lit screen do not: several lines, with clean
 * surface between them. The band count is the load-bearing part — texture
 * (plaster, wood grain, sensor noise on a flat wall) marks one solid block of
 * rows with no gaps, because there is nothing there to leave a gap. Writing is
 * lines with space between them, whatever the surface.
 *
 * Being wrong in the two directions costs different things. Staying quiet over
 * a real board costs one tap on the SliD mode, and the student is already
 * looking at their phone. Offering a class over a wall costs the whole claim
 * that the camera understands what it is seeing.
 */
/** Two lines and a gap. One band is texture as easily as it is a title. */
const SUGGEST_MIN_LINES = 2;
/** Enough writing to be a surface being used, not an edge caught at an angle. */
const SUGGEST_MIN_ROWS = 8;
/** Broken up more than the session gate asks, since nobody vouched for this frame. */
const SUGGEST_MIN_RUN_DENSITY = 7;
/** Half the frame written is already closer to a busy room than to a document. */
const SUGGEST_MAX_ROWS = Math.round(SAMPLE_H * 0.5);

/**
 * A mark this wide or narrower is a stroke. At this scale a pen stroke, a
 * letter stem and a stroke of chalk are one or two sample pixels across —
 * that is what writing is made of, on any surface.
 */
const STROKE_WIDTH = 2;
/**
 * How much of the writing has to be strokes.
 *
 * The band count alone was not enough, and it took running the scenes through
 * the browser's own decoder and scaler to see it: a laptop keyboard and a
 * curtain both produce several bands of many short runs, and both offered a
 * class. They are built from bars, not strokes — evenly spaced keys, evenly
 * folded cloth — and the difference is plain once measured over the bands:
 *
 *   teclado do notebook    0.19–0.21        cortina com dobras     0.09–0.10
 *   ─────────────────────────────────────────────────────────────────────────
 *   slide num notebook     0.38             lousa verde com giz    0.68–0.70
 *   folha escrita          0.55–0.58        folha A4               0.71–0.72
 *   slide escuro           0.59–0.60        lousa branca escrita   0.75
 *   caderno aberto         0.64–0.65        título e fórmula       0.78–0.80
 */
const SUGGEST_MIN_THIN = 0.28;
/**
 * A ceiling that applies to the cropped windows alone.
 *
 * A fine weave — carpet, fabric — has no structure at all in the wide shot, so
 * it is exactly the case where the tighter windows get consulted, and magnified
 * enough its threads form bands of short runs that pass every other test. What
 * gives it away is that nearly *every* run is a hairline. Measured through the
 * browser's own decoder and scaler, which is the only measurement that has ever
 * been right about this:
 *
 *   carpete @1.7x        0.966 – 0.977      slide a 50 % @2.6x     0.770
 *   parede rebocada      0.975 – 0.995      slide a 35 % @1.7x     0.550
 *                                           slide a 25 % @1.7x     0.481
 *
 * It belongs to the crops and not to the wide shot, and that is the honest
 * reason rather than a convenience: the uniformity is manufactured by
 * magnifying a weave past the point where its threads are threads. At native
 * framing an open notebook legitimately reads 0.96 — every stroke thin because
 * every stroke *is* thin — and there is no texture in the adversarial set that
 * reaches the wide shot and passes, because the wide shot keeps the last word.
 */
const CROP_MAX_THIN = 0.93;
/**
 * E o teto só vale quando há faixas o bastante para aquilo ser uma trama.
 *
 * Medido pelo navegador, escrita fraca e tecido se encostam no valor: o carpete
 * lê 0,966 e um slide de sala clara, visto num recorte, lê 0,96. O que os
 * separa não é quão finos os traços são, é quantos. A trama enche o quadro —
 * treze faixas, quarenta linhas — porque ela é a superfície inteira. A escrita
 * fraca de um slide são duas faixas soltas num campo claro.
 *
 * Sem isto, o teto criado para o carpete estava reprovando o caso que este
 * ciclo existe para consertar.
 */
const WEAVE_MIN_LINES = 5;

export function readScene(gray: Uint8Array, forcedDelta?: number): SceneSignals {
  const mask = markMask(gray, forcedDelta);

  const rowRuns = new Int32Array(SAMPLE_H);
  const written = new Uint8Array(SAMPLE_H);
  for (let y = 0; y < SAMPLE_H; y++) {
    let runs = 0;
    let covered = 0;
    let previous = 0;
    for (let x = 0; x < SAMPLE_W; x++) {
      const mark = mask[y * SAMPLE_W + x];
      if (mark) {
        covered++;
        if (!previous) runs++;
      }
      previous = mark;
    }
    const cover = covered / SAMPLE_W;
    rowRuns[y] = runs;
    written[y] =
      runs >= MIN_RUNS && cover >= MIN_ROW_COVER && cover <= MAX_ROW_COVER
        ? 1
        : 0;
  }

  // Only rows inside a band count. One row on its own is the edge of something,
  // not a line of writing.
  const inBand = new Uint8Array(SAMPLE_H);
  let writtenRows = 0;
  let runsTotal = 0;
  let lines = 0;
  let run = 0;
  for (let y = 0; y <= SAMPLE_H; y++) {
    if (y < SAMPLE_H && written[y]) {
      run++;
      continue;
    }
    if (run >= MIN_BAND) {
      for (let k = y - run; k < y; k++) {
        inBand[k] = 1;
        runsTotal += rowRuns[k];
      }
      writtenRows += run;
      lines++;
    }
    run = 0;
  }

  // The proportions of the writing itself, so the desk, the bezel and the wall
  // behind it never get a say in what the writing is made of.
  let strokes = 0;
  let marksRuns = 0;
  for (let y = 0; y < SAMPLE_H; y++) {
    if (!inBand[y]) continue;
    let width = 0;
    for (let x = 0; x <= SAMPLE_W; x++) {
      if (x < SAMPLE_W && mask[y * SAMPLE_W + x]) {
        width++;
        continue;
      }
      if (width) {
        marksRuns++;
        if (width <= STROKE_WIDTH) strokes++;
      }
      width = 0;
    }
  }
  const thinShare = marksRuns ? strokes / marksRuns : 0;

  const runDensity = writtenRows ? runsTotal / writtenRows : 0;
  const isStudy =
    writtenRows >= MIN_WRITTEN_ROWS &&
    writtenRows <= MAX_WRITTEN_ROWS &&
    runDensity >= MIN_RUN_DENSITY;
  const looksLikeClass =
    isStudy &&
    lines >= SUGGEST_MIN_LINES &&
    writtenRows >= SUGGEST_MIN_ROWS &&
    writtenRows <= SUGGEST_MAX_ROWS &&
    runDensity >= SUGGEST_MIN_RUN_DENSITY &&
    thinShare >= SUGGEST_MIN_THIN;

  // Na ordem em que as condições contam uma história: primeiro se há escrita,
  // depois se há bastante dela, depois de que ela é feita.
  const verdict: SceneVerdict = looksLikeClass
    ? "aula"
    : writtenRows === 0
      ? "sem-marcas"
      : writtenRows > SUGGEST_MAX_ROWS
        ? "cena-cheia"
        : lines < SUGGEST_MIN_LINES
          ? "uma-faixa-so"
          : writtenRows < SUGGEST_MIN_ROWS
            ? "poucas-linhas"
            : runDensity < SUGGEST_MIN_RUN_DENSITY
              ? "pouco-quebrado"
              : thinShare < SUGGEST_MIN_THIN
                ? "marcas-grossas"
                : "poucas-linhas";

  let bounds: ContentBounds | null = null;
  if (isStudy) {
    let top = SAMPLE_H;
    let bottom = -1;
    let left = SAMPLE_W;
    let right = -1;
    for (let y = 0; y < SAMPLE_H; y++) {
      if (!inBand[y]) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      for (let x = 0; x < SAMPLE_W; x++) {
        if (!mask[y * SAMPLE_W + x]) continue;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
    if (bottom >= top && right >= left) {
      bounds = {
        x: left / SAMPLE_W,
        y: top / SAMPLE_H,
        width: (right - left + 1) / SAMPLE_W,
        height: (bottom - top + 1) / SAMPLE_H,
      };
    }
  }

  return {
    writtenRows,
    lines,
    thinShare,
    runDensity,
    isStudy,
    looksLikeClass,
    bounds,
    verdict,
    inkThreshold: lastInkThreshold,
  };
}

export interface SceneReading extends SceneSignals {
  /** Which window this reading came from, as a multiple of the preview crop. */
  scale: number;
}

export interface ScaledScene extends SceneReading {
  /** Todas as janelas que chegaram a ser lidas, na ordem. Para o diagnóstico. */
  readings: SceneReading[];
  /**
   * Há sinal de escrita, mas não no tamanho que este enquadramento entrega.
   *
   * É o que separa "não tem aula aqui" de "tem, e está longe". Só liga quando
   * uma janela recortada encontrou material de estudo e a vista aberta não —
   * então parede e mesa, que não têm marca nenhuma em escala alguma, nunca
   * disparam a dica, e a trama do carpete fica de fora pelo veredito dela.
   */
  tooSmall: boolean;
}

/**
 * How much a reading is worth, for picking between the cropped windows.
 *
 * Bands first, because bands are what a page has and a wall does not, and a
 * reading with more of them is a reading that found more of the writing. Rows
 * break the tie so that between two windows showing the same number of lines,
 * the one holding more of them wins.
 */
function evidence(scene: SceneSignals): number {
  if (!scene.isStudy) return 0;
  return scene.lines * 100 + Math.min(scene.writtenRows, 60);
}

/**
 * Quando a vista aberta tem material suficiente para a recusa dela valer.
 *
 * Eram só duas faixas, e isso vetava cedo demais: um slide ocupando metade da
 * largura dá sete linhas em duas faixas na vista aberta — quase nada — e mesmo
 * assim a busca parava ali e o slide se perdia. O teclado, que é o caso para o
 * qual o veto existe, dá cinquenta e nove linhas em oito faixas. A diferença
 * entre os dois não é ter faixas, é ter escrita bastante para se pronunciar.
 *
 * Então a opinião exige as duas coisas: faixas separadas e linhas o bastante
 * para o julgamento ser sobre a *qualidade* das marcas, e não sobre a falta
 * delas.
 */
const WIDE_SHOT_HAS_AN_OPINION = 2;

/**
 * Reads one frame, cropping in only when the wide shot had nothing to go on.
 *
 * Consulting every window and keeping the best reading was the obvious first
 * try and it let a laptop keyboard back in. Measured, the difference is plain:
 *
 *                        1x                    recortado
 *   teclado        59 linhas, 8 faixas   →  reprova por traços grossos … e passa
 *   slide a 50 %    4 linhas, 1 faixa    →  nada a julgar        … e passa
 *
 * The keyboard is not a case of the camera being too far away. At the wide shot
 * it sees the whole thing, finds plenty of structure, and turns it down because
 * the marks are bars and not strokes. Going and asking a crop for a second
 * opinion is looking for the answer you wanted: crop into any repeating texture
 * far enough and its rows start to look like lines of writing.
 *
 * So the wide shot keeps both the first and the last word whenever it could see
 * the surface at all. The crops exist for the other case — the slide across the
 * hall whose lines land under one per cent of the frame, where the wide shot
 * genuinely has nothing to judge.
 *
 * `samples` must be in the same order as ANALYSIS_SCALES, widest first.
 */
export function readBestScene(samples: (Uint8Array | null)[]): ScaledScene | null {
  const wideSample = samples[0];
  if (!wideSample) return null;

  const readings: SceneReading[] = [];
  const wideRead: SceneReading = {
    ...readScene(wideSample),
    scale: ANALYSIS_SCALES[0],
  };
  readings.push(wideRead);
  const wide: ScaledScene = { ...wideRead, readings, tooSmall: false };
  if (wide.looksLikeClass) return wide;
  // Dois jeitos de a vista aberta ter uma opinião. Ou ela achou escrita bastante
  // para julgar a qualidade das marcas, ou ela achou marcas *demais* — um quadro
  // em que quase toda fileira está marcada é uma cena, não uma superfície, e
  // recortar uma cena movimentada sempre encontra pedaços que parecem quadro.
  const opiniao =
    (wide.lines >= WIDE_SHOT_HAS_AN_OPINION &&
      wide.writtenRows >= SUGGEST_MIN_ROWS) ||
    wide.writtenRows > MAX_WRITTEN_ROWS;
  if (opiniao) return wide;

  // Nothing to judge out here. Widen the search — first the tighter windows at
  // the normal bar, then everything again at the rescue bar — and take the
  // first reading that finds a class. Failing that, the one that found the
  // most: the session gate is more forgiving than the suggestion, and a distant
  // board still deserves capturing.
  //
  // The order matters. The rescue bar comes last so a scene that reads as a
  // class at the normal bar is never described by the looser one, and the wide
  // shot's veto above still runs first — a keyboard never reaches any of this.
  let best = wide;
  let bestScore = evidence(wide);
  const tentativas: { index: number; delta?: number }[] = [];
  for (let i = 1; i < samples.length; i++) tentativas.push({ index: i });
  for (let i = 0; i < samples.length; i++)
    tentativas.push({ index: i, delta: RESCUE_DELTA });

  for (const { index, delta } of tentativas) {
    const sample = samples[index];
    if (!sample) continue;
    const read = readScene(sample, delta);
    // The ceiling is applied here, once, so a window that fails it can never
    // offer a class — not as the pick, and not as the fallback either. It can
    // still be captured inside a session the student chose to start, which is
    // the same asymmetry the two gates have everywhere else.
    const ampliada = index > 0 || delta !== undefined;
    const recusadaPorTrama =
      read.looksLikeClass &&
      ampliada &&
      read.thinShare > CROP_MAX_THIN &&
      read.lines >= WEAVE_MIN_LINES;
    const reading: SceneReading = {
      ...read,
      looksLikeClass: read.looksLikeClass && !recusadaPorTrama,
      verdict: recusadaPorTrama ? "trama-uniforme" : read.verdict,
      scale: ANALYSIS_SCALES[index],
    };
    readings.push(reading);
    if (reading.looksLikeClass) return { ...reading, readings, tooSmall: false };
    const score = evidence(reading);
    if (score > bestScore) {
      best = { ...reading, readings, tooSmall: false };
      bestScore = score;
    }
  }

  /*
   * "Tem escrita, só que pequena" é uma coisa; "isto não é escrita" é outra, e
   * a dica de zoom só serve à primeira. Um veredito de quadro cheio, de barras
   * ou de trama é o classificador tendo *decidido* — mandar o estudante dar
   * zoom numa parede rebocada porque o recorte dela ficou cheio de textura é
   * pedir que ele insista no erro. Os únicos vereditos que significam falta de
   * informação são os de escrita insuficiente.
   */
  const sinalRecortado = readings.some(
    (r) =>
      r.scale > 1 &&
      r.isStudy &&
      (r.verdict === "poucas-linhas" || r.verdict === "uma-faixa-so"),
  );
  return { ...best, readings, tooSmall: sinalRecortado && !best.looksLikeClass };
}

/**
 * Bounds read inside a cropped window, expressed against the preview instead.
 *
 * The outline is drawn over what the student is looking at, and the window the
 * session chose to read through is not that. Without this the frame lands on
 * the middle of the screen whatever it found, which is worse than drawing
 * nothing: it claims a position it does not have.
 */
export function boundsAtScale(
  bounds: ContentBounds | null,
  scale: number,
): ContentBounds | null {
  if (!bounds || scale <= 1) return bounds;
  return {
    x: 0.5 + (bounds.x - 0.5) / scale,
    y: 0.5 + (bounds.y - 0.5) / scale,
    width: bounds.width / scale,
    height: bounds.height / scale,
  };
}

/**
 * The box covering both, so a region that moved with its content is not
 * mistaken for the camera having moved.
 */
export function unionBounds(
  a: ContentBounds | null,
  b: ContentBounds | null,
): ContentBounds | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/**
 * How much content sits on the surface, as a share of the frame.
 *
 * Measured inside the content region, never over the whole frame: a laptop's
 * keyboard, bezel and the edge of its screen are all marks too, and counting
 * them made a slide's text 0.6 % of a 19 % total. Every ratio built on that
 * came out near zero, and a whole slide changing read as nothing happening.
 */
export function markArea(
  mask: Uint8Array,
  region?: ContentBounds | null,
): number {
  if (!region) {
    let marks = 0;
    for (const pixel of mask) marks += pixel;
    return marks / mask.length;
  }

  const x0 = Math.max(0, Math.round(region.x * SAMPLE_W));
  const x1 = Math.min(SAMPLE_W, Math.round((region.x + region.width) * SAMPLE_W));
  const y0 = Math.max(0, Math.round(region.y * SAMPLE_H));
  const y1 = Math.min(SAMPLE_H, Math.round((region.y + region.height) * SAMPLE_H));

  let marks = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) marks += mask[y * SAMPLE_W + x];
  }
  return marks / mask.length;
}

export interface ContentDelta {
  /** Share of the frame that gained marks — something was written or shown. */
  added: number;
  /** Share that lost them — erased, or the slide moved on. */
  removed: number;
}

/*
 * Measured across the reference sequence:
 *
 *   escreveu o título        +1.034%   −0.000%
 *   acrescentou a fórmula    +0.505%   −0.000%
 *   apagou uma parte         +0.000%   −1.383%
 *   ─────────────────────────────────────────
 *   luz mais fraca / forte   +0.000%   −0.000%   (a máscara é local)
 *   enquadramento deslocado  +2.295%   −2.189%   (grande, mas simétrico)
 *   ruído do sensor          +0.008%   −0.008%
 *
 * Writing is asymmetric and moving the camera is not. Testing the direction of
 * the change rather than its size is the whole trick.
 */
export function contentDelta(
  before: Uint8Array,
  after: Uint8Array,
  region?: ContentBounds | null,
  side: "inside" | "outside" = "inside",
): ContentDelta {
  if (before.length !== after.length) return { added: 1, removed: 1 };

  // Fractions stay relative to the whole frame whichever side is measured, so
  // one set of thresholds means the same thing everywhere.
  const total = before.length;
  const box = region && {
    x0: Math.round(region.x * SAMPLE_W),
    x1: Math.round((region.x + region.width) * SAMPLE_W),
    y0: Math.round(region.y * SAMPLE_H),
    y1: Math.round((region.y + region.height) * SAMPLE_H),
  };

  let added = 0;
  let removed = 0;
  for (let y = 0; y < SAMPLE_H; y++) {
    for (let x = 0; x < SAMPLE_W; x++) {
      if (box) {
        const within = x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1;
        if (within !== (side === "inside")) continue;
      } else if (side === "outside") {
        continue;
      }
      const i = y * SAMPLE_W + x;
      if (after[i] && !before[i]) added++;
      else if (before[i] && !after[i]) removed++;
    }
  }
  return { added: added / total, removed: removed / total };
}

/** Mean absolute difference between two samples, 0..1. Used to spot movement. */
export function frameDifference(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) return 1;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
  return diff / a.length / 255;
}

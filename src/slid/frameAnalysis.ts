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

/** Downscaled grayscale snapshot of the current frame. */
export function sampleFrame(video: HTMLVideoElement): Uint8Array | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const s = getSampler();
  if (!s) return null;

  s.ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
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

/**
 * How far a pixel must depart from the surface behind it to count as a mark.
 * Compared against a *local* background, never a global one: a vignette, a
 * shadow falling across the page or a lamp being switched on all move the
 * background and the pixel together, so the mask does not move at all.
 */
const MARK_DELTA = 22;

/** Below this share of a row's width, marks are a vertical object crossing the
 *  frame — a notebook spine, a table edge — and not a line of writing. */
const ROW_INKED = 0.06;

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
export function markMask(gray: Uint8Array): Uint8Array {
  const background = localBackground(gray, BACKGROUND_RADIUS);
  const mask = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    if (Math.abs(gray[i] - background[i]) > MARK_DELTA) mask[i] = 1;
  }
  return mask;
}

export interface SceneSignals {
  /** Share of the frame covered in marks. */
  markShare: number;
  /** Share of rows with no writing in them — the clean surface around it. */
  gapRatio: number;
  /** Whether this frame holds study material. */
  isStudy: boolean;
}

/*
 * Thresholds measured across the reference scenes at 128×96:
 *
 *                          marcas   vãos
 *   folha, só o título      0.010   0.96
 *   folha, título+fórmula   0.015   0.93
 *   folha A4 densa          0.056   0.72
 *   caderno aberto          0.066   0.81
 *   slide escuro            0.082   0.64
 *   lousa verde com giz     0.023   0.84
 *   lousa branca escrita    0.039   0.82
 *   ─────────────────────────────────────
 *   pessoa                  0.090   0.25
 *   ambiente movimentado    0.198   0.00
 *   folha vazia / parede    0.000   1.00
 *
 * The gap ratio is what does the work: study material leaves clean surface
 * between its lines, and a face or a room does not. The worst study case (0.64)
 * and the worst non-study case (0.25) sit either side of the threshold with
 * almost equal margin.
 */

/** Something has to be written; an empty page is not a class. */
const MIN_MARKS = 0.005;
/** Marks over this share of the frame are a scene, not writing on a surface. */
const MAX_MARKS = 0.14;
/** Clean surface between the lines — the signature of anything written down. */
const MIN_GAP = 0.45;

export function readScene(gray: Uint8Array): SceneSignals {
  const mask = markMask(gray);

  let marks = 0;
  for (const pixel of mask) marks += pixel;
  const markShare = marks / mask.length;

  let inkedRows = 0;
  for (let y = 0; y < SAMPLE_H; y++) {
    let count = 0;
    for (let x = 0; x < SAMPLE_W; x++) count += mask[y * SAMPLE_W + x];
    if (count / SAMPLE_W >= ROW_INKED) inkedRows++;
  }
  const gapRatio = 1 - inkedRows / SAMPLE_H;

  return {
    markShare,
    gapRatio,
    isStudy:
      markShare >= MIN_MARKS && markShare <= MAX_MARKS && gapRatio >= MIN_GAP,
  };
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
export function contentDelta(before: Uint8Array, after: Uint8Array): ContentDelta {
  if (before.length !== after.length) return { added: 1, removed: 1 };
  let added = 0;
  let removed = 0;
  for (let i = 0; i < before.length; i++) {
    if (after[i] && !before[i]) added++;
    else if (before[i] && !after[i]) removed++;
  }
  return { added: added / before.length, removed: removed / before.length };
}

/** Mean absolute difference between two samples, 0..1. Used to spot movement. */
export function frameDifference(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) return 1;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
  return diff / a.length / 255;
}

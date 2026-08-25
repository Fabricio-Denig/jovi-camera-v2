/**
 * Lightweight frame analysis for the contextual engine and for SliD's automatic
 * capture. Everything runs on a downscaled copy of the frame, keeping the cost
 * far away from the live preview.
 *
 * These are heuristics, not a trained classifier. That is deliberate: a
 * suggestion that occasionally stays quiet is fine, because every path it
 * offers is also reachable by hand. A heavy model that stutters the viewfinder
 * during a live demo is not.
 */

/**
 * 128×96 rather than something smaller: at 64×48 the downscale blurs thin
 * handwriting into the board itself — measured on a test board, the darkest
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

export interface FrameSignals {
  brightness: number;
  /** Local contrast energy: the fingerprint of writing on a flat surface. */
  edgeEnergy: number;
  /** Spread across the surface itself; low means one even panel. */
  surfaceSd: number;
}

export interface BoardSignals extends FrameSignals {
  /** 0..1 — how strongly this frame looks like a board or projected slide. */
  score: number;
}

/*
 * Thresholds below come from measuring the reference scenes at 128×96:
 *
 *   lecture board      brightness 0.86   edge 3.7 – 8.2   sd  2.9 – 4.7
 *   blank wall         brightness 0.84   edge 0.00        sd  0.0
 *   face, 60 s         brightness 0.45   edge 2.40        sd 30.2
 *   busy scene         brightness 0.49   edge 6.10        sd 36.8
 *
 * Each signal alone confuses at least one pair; together they separate cleanly.
 * Edge energy is what distinguishes a written board from a bare wall, and the
 * surface spread is what rules out a face: skin and background never settle
 * into one even panel, whatever the lighting does.
 */
const MIN_BRIGHTNESS = 0.62;
const BRIGHTNESS_RAMP = 0.12;
/** Below this there is nothing written; a bare wall is not worth suggesting. */
const MIN_EDGE = 0.8;
/** Above this the frame is a busy scene rather than a surface with writing. */
const MAX_EDGE = 6.5;
/** Spread across the surface; a real board stays close to uniform. */
const MAX_SURFACE_SD = 18;

/*
 * The capture gate is deliberately more forgiving than the suggestion. Offering
 * to follow a class uninvited should require confidence; deciding whether the
 * student who already opened SliD is pointing at study material should still
 * work on a notebook page in a badly lit room. Only the brightness floor and
 * the evenness tolerance move — the two signals that reject a face are exactly
 * the ones kept intact, and measured faces sit 37 % above the wider limit.
 */
const SCENE_MIN_BRIGHTNESS = 0.45;
const SCENE_BRIGHTNESS_RAMP = 0.15;
const SCENE_MAX_SURFACE_SD = 22;

/** The three raw signals, measured once and scored twice. */
export function measureFrame(gray: Uint8Array): FrameSignals {
  let sum = 0;
  for (const value of gray) sum += value;
  const mean = sum / gray.length;
  const brightness = mean / 255;

  // Local contrast energy — writing produces many short, sharp transitions.
  let edge = 0;
  for (let y = 1; y < SAMPLE_H; y++) {
    for (let x = 1; x < SAMPLE_W; x++) {
      const i = y * SAMPLE_W + x;
      edge +=
        Math.abs(gray[i] - gray[i - 1]) + Math.abs(gray[i] - gray[i - SAMPLE_W]);
    }
  }
  const edgeEnergy = edge / gray.length;

  // Evenness measured over the lit surface only, ignoring the writing itself.
  const cutoff = mean * 0.8;
  let brightSum = 0;
  let brightCount = 0;
  for (const value of gray) {
    if (value >= cutoff) {
      brightSum += value;
      brightCount++;
    }
  }
  const brightMean = brightCount ? brightSum / brightCount : 0;
  let variance = 0;
  for (const value of gray) {
    if (value >= cutoff) variance += (value - brightMean) ** 2;
  }
  const surfaceSd = brightCount ? Math.sqrt(variance / brightCount) : 999;

  return { brightness, edgeEnergy, surfaceSd };
}

function score(
  { brightness, edgeEnergy, surfaceSd }: FrameSignals,
  minBrightness: number,
  ramp: number,
  maxSd: number,
): number {
  const brightScore = clamp01((brightness - minBrightness) / ramp);
  const writingScore =
    edgeEnergy < MIN_EDGE
      ? 0
      : edgeEnergy > MAX_EDGE
        ? clamp01(1 - (edgeEnergy - MAX_EDGE) / MAX_EDGE)
        : 1;
  const evennessScore = clamp01(1 - surfaceSd / maxSd);
  return brightScore * writingScore * evennessScore;
}

/** Does this frame look enough like a board to offer following the class? */
export function analyzeBoard(gray: Uint8Array): BoardSignals {
  const signals = measureFrame(gray);
  return {
    ...signals,
    score: score(signals, MIN_BRIGHTNESS, BRIGHTNESS_RAMP, MAX_SURFACE_SD),
  };
}

/**
 * Is there study material in front of the camera at all?
 *
 * Every automatic capture passes through this. Without it the session is a
 * motion detector: pointed at a person for a minute it kept saving frames,
 * because pixels had moved. Pixels moving is not a reason to keep anything.
 */
export function studySceneScore(gray: Uint8Array): number {
  return score(
    measureFrame(gray),
    SCENE_MIN_BRIGHTNESS,
    SCENE_BRIGHTNESS_RAMP,
    SCENE_MAX_SURFACE_SD,
  );
}

/*
 * Content, not pixels.
 *
 * Ink is measured against the frame's own mean, so a light being switched on
 * moves every pixel and the mask not at all. Measured on the reference board,
 * each new line the lecturer writes adds 0.6 – 1.0 % of the frame in ink and
 * removes none; a person moving through a scene adds 1.3 % and removes 1.7 –
 * 4.7 %. That asymmetry — not the amount of change — is what tells writing
 * apart from movement.
 */
const INK_CUTOFF = 0.82;

/** Pixels meaningfully darker than the lit surface: the writing itself. */
export function inkMask(gray: Uint8Array): Uint8Array {
  let sum = 0;
  for (const value of gray) sum += value;
  const cutoff = (sum / gray.length) * INK_CUTOFF;
  const mask = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) mask[i] = gray[i] < cutoff ? 1 : 0;
  return mask;
}

export interface ContentDelta {
  /** Fraction of the frame that gained ink — something was written or shown. */
  added: number;
  /** Fraction that lost ink — the board was wiped or the slide moved on. */
  removed: number;
}

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

/** Mean absolute difference between two samples, 0..1. */
export function frameDifference(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) return 1;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
  return diff / a.length / 255;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

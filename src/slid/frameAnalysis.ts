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

export interface BoardSignals {
  /** 0..1 — how strongly this frame looks like a board or projected slide. */
  score: number;
  brightness: number;
  /** Local contrast energy: the fingerprint of writing on a flat surface. */
  edgeEnergy: number;
  /** Spread across the surface itself; low means one even panel. */
  surfaceSd: number;
}

/*
 * Thresholds below come from measuring four scenes at 128×96:
 *
 *   board (positive)   brightness 0.93   edge 3.81   sd  3.5
 *   blank wall         brightness 0.90   edge 0.00   sd  0.0
 *   busy scene         brightness 0.50   edge 7.12   sd 42.5
 *   colour test card   brightness 0.37   edge 3.37   sd 32.5
 *
 * Each signal alone confuses at least one pair; together they separate cleanly.
 * Edge energy is what distinguishes a written board from a bare wall, and it
 * survives downscaling far better than counting dark pixels does.
 */
const MIN_BRIGHTNESS = 0.62;
const BRIGHTNESS_RAMP = 0.12;
/** Below this there is nothing written; a bare wall is not worth suggesting. */
const MIN_EDGE = 0.8;
/** Above this the frame is a busy scene rather than a surface with writing. */
const MAX_EDGE = 6.5;
/** Spread across the surface; a real board stays close to uniform. */
const MAX_SURFACE_SD = 18;

export function analyzeBoard(gray: Uint8Array): BoardSignals {
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

  const brightScore = clamp01((brightness - MIN_BRIGHTNESS) / BRIGHTNESS_RAMP);
  const writingScore =
    edgeEnergy < MIN_EDGE
      ? 0
      : edgeEnergy > MAX_EDGE
        ? clamp01(1 - (edgeEnergy - MAX_EDGE) / MAX_EDGE)
        : 1;
  const evennessScore = clamp01(1 - surfaceSd / MAX_SURFACE_SD);

  return {
    score: brightScore * writingScore * evennessScore,
    brightness,
    edgeEnergy,
    surfaceSd,
  };
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

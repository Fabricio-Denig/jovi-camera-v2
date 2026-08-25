import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzeBoard,
  type ContentDelta,
  contentDelta,
  frameDifference,
  inkMask,
  sampleFrame,
  studySceneScore,
} from "./frameAnalysis";
import { capturePhotoFromVideo } from "../camera/capturePhoto";

export type SlidStatus = "idle" | "running" | "paused" | "finished";

/**
 * Why this moment was worth keeping. The reason is the product: a student
 * trusts the session when the camera can say what it noticed, not merely that
 * something changed.
 */
export type MomentReason = "novo-topico" | "novo-conteudo" | "manual";

export const REASON_LABELS: Record<MomentReason, string> = {
  "novo-topico": "Novo tópico no quadro",
  "novo-conteudo": "Conteúdo acrescentado",
  manual: "Você marcou este momento",
};

export interface SlidCapture {
  id: string;
  blob: Blob;
  /** Milliseconds into the session, which is how a student locates a moment later. */
  atMs: number;
  auto: boolean;
  reason: MomentReason;
}

/** What the session watched but chose not to keep — the curation made visible. */
export interface SlidStats {
  /** Frames inspected while the session ran. */
  analysed: number;
  /** Near-identical frames skipped so the session stays reviewable. */
  skippedDuplicates: number;
}

/** How often frames are inspected. Slow on purpose: a board changes over minutes. */
const TICK_MS = 1200;

/*
 * A moment is kept only when both questions answer yes:
 *
 *   1. Is there study material in front of the camera?   studySceneScore
 *   2. Did the content itself change?                    contentDelta
 *
 * Neither alone is enough. Question 2 on its own is a motion detector — that
 * is what shipped, and pointed at a person for a minute it produced moments.
 * Question 1 on its own would photograph a static board forever.
 */

/** Below this the camera is not looking at study material, so nothing is kept. */
const SCENE_THRESHOLD = 0.25;
/** Ticks of study material before capture arms — one lucky frame is not a class. */
const SCENE_ARM_TICKS = 2;
/** Ticks without it before capture disarms; a hand over the board is not a room change. */
const SCENE_LOST_TICKS = 3;

/** Frame-to-frame change that means something is moving — a hand, a person. */
const MOTION_THRESHOLD = 0.03;
/** Frames must settle before capturing, so a passing hand isn't photographed. */
const STABLE_TICKS = 2;

/*
 * Content thresholds, measured on the reference board sampled once a tick:
 * each line the lecturer adds gains 0.6 – 1.0 % of the frame in ink and loses
 * none. Movement, framing tremor and a person crossing the scene all gain and
 * lose in similar amounts — so it is the asymmetry that is tested, never the
 * size of the change.
 */
/** Ink gained that counts as something written or shown. */
const INK_ADDED_MIN = 0.002;
/** Ink lost that counts as the board being wiped or the slide moving on. */
const INK_REMOVED_MIN = 0.01;
/** How far one direction must outweigh the other before it means anything. */
const DIRECTION_DOMINANCE = 1.5;
/** Gained and lost together at this scale: the whole surface was replaced. */
const SURFACE_REPLACED = 0.02;

/** Consecutive positive readings before the board suggestion appears. */
const DETECTION_TICKS = 3;

interface UseSlidSessionOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Contextual detection only runs while the camera is live and SliD is not already active. */
  detectionEnabled: boolean;
}

export interface SlidSession {
  status: SlidStatus;
  captures: SlidCapture[];
  stats: SlidStats;
  /** Set briefly right after a capture, so the session can say what it just noticed. */
  lastMoment: SlidCapture | null;
  elapsedMs: number;
  /** True once the frame has looked like a board for long enough to suggest SliD. */
  boardDetected: boolean;
  /**
   * Whether the running session is actually looking at study material. The
   * session says so out loud rather than implying it is guarding a class while
   * the camera faces a wall.
   */
  sceneReady: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  reset: () => void;
  captureManually: () => Promise<void>;
  dismissSuggestion: () => void;
}

/**
 * SliD as a continuous session rather than a single photo of a board.
 *
 * The session owns its own loop and never touches the camera stream: it only
 * reads frames from the existing <video>. That keeps the validated capture
 * engine untouched no matter what happens here.
 */
export function useSlidSession({
  videoRef,
  detectionEnabled,
}: UseSlidSessionOptions): SlidSession {
  const [status, setStatus] = useState<SlidStatus>("idle");
  const [captures, setCaptures] = useState<SlidCapture[]>([]);
  const [stats, setStats] = useState<SlidStats>({
    analysed: 0,
    skippedDuplicates: 0,
  });
  const [lastMoment, setLastMoment] = useState<SlidCapture | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [boardDetected, setBoardDetected] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);

  const startedAtRef = useRef(0);
  const pausedTotalRef = useRef(0);
  const pausedAtRef = useRef(0);
  const lastCapturedInkRef = useRef<Uint8Array | null>(null);
  const lastSampleRef = useRef<Uint8Array | null>(null);
  const stableCountRef = useRef(0);
  const sceneArmedRef = useRef(false);
  const sceneOkRef = useRef(0);
  const sceneMissRef = useRef(0);
  const detectionCountRef = useRef(0);
  const suggestionDismissedRef = useRef(false);
  const capturingRef = useRef(false);

  const takeCapture = useCallback(
    async (reason: MomentReason, sample: Uint8Array | null) => {
      const video = videoRef.current;
      if (!video || capturingRef.current) return;
      capturingRef.current = true;
      try {
        const { blob } = await capturePhotoFromVideo(video);
        const reference = sample ?? sampleFrame(video);
        if (reference) lastCapturedInkRef.current = inkMask(reference);
        const moment: SlidCapture = {
          id: crypto.randomUUID(),
          blob,
          atMs: Date.now() - startedAtRef.current - pausedTotalRef.current,
          auto: reason !== "manual",
          reason,
        };
        setCaptures((prev) => [...prev, moment]);
        setLastMoment(moment);
      } catch {
        // A failed frame must never end the session — the next tick tries again.
      } finally {
        capturingRef.current = false;
      }
    },
    [videoRef],
  );

  // Contextual detection: looks for a board only when it could act on it.
  useEffect(() => {
    if (!detectionEnabled || suggestionDismissedRef.current) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      const sample = sampleFrame(video);
      if (!sample) return;

      const { score } = analyzeBoard(sample);
      if (score > 0.5) {
        detectionCountRef.current++;
        if (detectionCountRef.current >= DETECTION_TICKS) setBoardDetected(true);
      } else {
        detectionCountRef.current = 0;
        setBoardDetected(false);
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [detectionEnabled, videoRef]);

  // Session loop: two gates, in order — is this study material, and did the
  // content change? A frame that fails the first is never even compared.
  useEffect(() => {
    if (status !== "running") return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      setElapsedMs(Date.now() - startedAtRef.current - pausedTotalRef.current);

      const sample = sampleFrame(video);
      if (!sample) return;
      setStats((prev) => ({ ...prev, analysed: prev.analysed + 1 }));

      // Gate 1 — scene context. Hysteresis on both sides: a single good frame
      // does not arm the session, and a hand passing over the board does not
      // disarm it.
      if (studySceneScore(sample) >= SCENE_THRESHOLD) {
        sceneMissRef.current = 0;
        sceneOkRef.current++;
        if (sceneOkRef.current >= SCENE_ARM_TICKS && !sceneArmedRef.current) {
          sceneArmedRef.current = true;
          setSceneReady(true);
        }
      } else {
        sceneOkRef.current = 0;
        sceneMissRef.current++;
        if (sceneMissRef.current >= SCENE_LOST_TICKS && sceneArmedRef.current) {
          sceneArmedRef.current = false;
          setSceneReady(false);
        }
      }

      const previous = lastSampleRef.current;
      lastSampleRef.current = sample;

      if (!sceneArmedRef.current) {
        stableCountRef.current = 0;
        return;
      }
      if (!previous) return;

      // Wait for the scene to settle: a hand crossing the board is movement,
      // not new content.
      if (frameDifference(previous, sample) > MOTION_THRESHOLD) {
        stableCountRef.current = 0;
        return;
      }
      stableCountRef.current++;
      if (stableCountRef.current < STABLE_TICKS) return;

      // Gate 2 — content. The first steady frame of study material is the
      // starting state of the lesson and is always worth keeping.
      const ink = inkMask(sample);
      const reference = lastCapturedInkRef.current;
      if (!reference) {
        stableCountRef.current = 0;
        void takeCapture("novo-topico", sample);
        return;
      }

      const reason = classifyChange(contentDelta(reference, ink));
      if (!reason) {
        // Same content as the last moment: skip it and count the noise the
        // student was spared from reviewing later.
        setStats((prev) => ({
          ...prev,
          skippedDuplicates: prev.skippedDuplicates + 1,
        }));
        return;
      }

      stableCountRef.current = 0;
      void takeCapture(reason, sample);
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [status, videoRef, takeCapture]);

  const start = useCallback(() => {
    startedAtRef.current = Date.now();
    pausedTotalRef.current = 0;
    lastSampleRef.current = null;
    lastCapturedInkRef.current = null;
    stableCountRef.current = 0;
    sceneArmedRef.current = false;
    sceneOkRef.current = 0;
    sceneMissRef.current = 0;
    setSceneReady(false);
    setCaptures([]);
    setStats({ analysed: 0, skippedDuplicates: 0 });
    setLastMoment(null);
    setElapsedMs(0);
    setStatus("running");
    setBoardDetected(false);
  }, []);

  const pause = useCallback(() => {
    pausedAtRef.current = Date.now();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    pausedTotalRef.current += Date.now() - pausedAtRef.current;
    setStatus("running");
  }, []);

  const finish = useCallback(() => setStatus("finished"), []);

  const reset = useCallback(() => {
    setStatus("idle");
    setCaptures([]);
    setStats({ analysed: 0, skippedDuplicates: 0 });
    setLastMoment(null);
    setElapsedMs(0);
    suggestionDismissedRef.current = false;
    detectionCountRef.current = 0;
    sceneArmedRef.current = false;
    sceneOkRef.current = 0;
    sceneMissRef.current = 0;
    setSceneReady(false);
  }, []);

  const captureManually = useCallback(async () => {
    await takeCapture("manual", null);
  }, [takeCapture]);

  const dismissSuggestion = useCallback(() => {
    suggestionDismissedRef.current = true;
    setBoardDetected(false);
  }, []);

  return {
    status,
    captures,
    stats,
    lastMoment,
    elapsedMs,
    boardDetected,
    sceneReady,
    start,
    pause,
    resume,
    finish,
    reset,
    captureManually,
    dismissSuggestion,
  };
}

/**
 * What kind of change this is — or none, which is the answer most of the time.
 *
 * A lecturer writing adds ink and removes none. A person moving, a framing
 * tremor or a shifting shadow add and remove in comparable amounts. Testing the
 * direction of the change rather than its size is what separates the two.
 */
function classifyChange({ added, removed }: ContentDelta): MomentReason | null {
  if (
    added > INK_ADDED_MIN &&
    removed > INK_REMOVED_MIN &&
    added + removed > SURFACE_REPLACED
  ) {
    // Everything was replaced at once: the slide advanced.
    return "novo-topico";
  }
  if (removed > INK_REMOVED_MIN && removed > added * DIRECTION_DOMINANCE) {
    // The board was wiped to start something else.
    return "novo-topico";
  }
  if (added > INK_ADDED_MIN && added > removed * DIRECTION_DOMINANCE) {
    return "novo-conteudo";
  }
  return null;
}

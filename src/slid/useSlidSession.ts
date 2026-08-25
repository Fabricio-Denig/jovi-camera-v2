import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeBoard, frameDifference, sampleFrame } from "./frameAnalysis";
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
 * Thresholds measured against a lecture board, sampling once a second:
 *
 *   nothing happening        0
 *   a line added to the board  0.003 – 0.020
 *
 * A lecturer adding one line to a full board barely moves the frame, and that
 * is precisely the moment worth keeping. Earlier values were an order of
 * magnitude too coarse and discarded it as noise.
 */

/** Frame-to-frame change that means something is moving — a hand, a person. */
const MOTION_THRESHOLD = 0.03;
/** Change against the last kept frame that counts as new content on the board. */
const CONTENT_THRESHOLD = 0.004;
/** Below this the board is unchanged; keeping it would only pad the review. */
const DUPLICATE_THRESHOLD = 0.0015;
/** A change this large means the board was wiped or the slide moved on. */
const NEW_TOPIC_THRESHOLD = 0.05;
/** Frames must settle before capturing, so a passing hand isn't photographed. */
const STABLE_TICKS = 2;
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

  const startedAtRef = useRef(0);
  const pausedTotalRef = useRef(0);
  const pausedAtRef = useRef(0);
  const lastCapturedSampleRef = useRef<Uint8Array | null>(null);
  const lastSampleRef = useRef<Uint8Array | null>(null);
  const stableCountRef = useRef(0);
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
        lastCapturedSampleRef.current = sample ?? sampleFrame(video);
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

  // Session loop: automatic capture on meaningful change.
  useEffect(() => {
    if (status !== "running") return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      setElapsedMs(Date.now() - startedAtRef.current - pausedTotalRef.current);

      const sample = sampleFrame(video);
      if (!sample) return;
      setStats((prev) => ({ ...prev, analysed: prev.analysed + 1 }));

      const previous = lastSampleRef.current;
      lastSampleRef.current = sample;
      if (!previous) return;

      // Wait for the scene to settle: a hand crossing the board is movement,
      // not new content.
      if (frameDifference(previous, sample) > MOTION_THRESHOLD) {
        stableCountRef.current = 0;
        return;
      }
      stableCountRef.current++;
      if (stableCountRef.current < STABLE_TICKS) return;

      const reference = lastCapturedSampleRef.current;
      const sinceCapture = reference ? frameDifference(reference, sample) : 1;

      // Already have this content: skip it and count the noise we spared the
      // student from reviewing later.
      if (reference && sinceCapture < DUPLICATE_THRESHOLD) {
        setStats((prev) => ({
          ...prev,
          skippedDuplicates: prev.skippedDuplicates + 1,
        }));
        return;
      }

      if (sinceCapture > CONTENT_THRESHOLD) {
        stableCountRef.current = 0;
        // A wholesale change means the board was cleared or the slide advanced;
        // a smaller one means the lecturer added to what was already there.
        void takeCapture(
          sinceCapture > NEW_TOPIC_THRESHOLD ? "novo-topico" : "novo-conteudo",
          sample,
        );
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [status, videoRef, takeCapture]);

  const start = useCallback(() => {
    startedAtRef.current = Date.now();
    pausedTotalRef.current = 0;
    lastSampleRef.current = null;
    lastCapturedSampleRef.current = null;
    stableCountRef.current = 0;
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
    start,
    pause,
    resume,
    finish,
    reset,
    captureManually,
    dismissSuggestion,
  };
}

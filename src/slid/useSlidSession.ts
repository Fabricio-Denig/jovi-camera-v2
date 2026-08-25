import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeBoard, frameDifference, sampleFrame } from "./frameAnalysis";
import { capturePhotoFromVideo } from "../camera/capturePhoto";

export type SlidStatus = "idle" | "running" | "paused" | "finished";

export interface SlidCapture {
  id: string;
  blob: Blob;
  /** Milliseconds into the session, which is how a student locates a moment later. */
  atMs: number;
  auto: boolean;
}

/** How often frames are inspected. Slow on purpose: a board changes over minutes. */
const TICK_MS = 1200;
/** Mean pixel change that counts as "the board changed". */
const CHANGE_THRESHOLD = 0.055;
/** Below this, the frame is treated as the same content and skipped. */
const DUPLICATE_THRESHOLD = 0.02;
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
    async (auto: boolean, sample: Uint8Array | null) => {
      const video = videoRef.current;
      if (!video || capturingRef.current) return;
      capturingRef.current = true;
      try {
        const { blob } = await capturePhotoFromVideo(video);
        lastCapturedSampleRef.current = sample ?? sampleFrame(video);
        setCaptures((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            blob,
            atMs: Date.now() - startedAtRef.current - pausedTotalRef.current,
            auto,
          },
        ]);
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

      const previous = lastSampleRef.current;
      lastSampleRef.current = sample;
      if (!previous) return;

      // Wait for the scene to settle: a hand crossing the board is movement,
      // not new content.
      if (frameDifference(previous, sample) > CHANGE_THRESHOLD) {
        stableCountRef.current = 0;
        return;
      }
      stableCountRef.current++;
      if (stableCountRef.current < STABLE_TICKS) return;

      const reference = lastCapturedSampleRef.current;
      const changedSinceCapture =
        !reference || frameDifference(reference, sample) > CHANGE_THRESHOLD;
      const isDuplicate =
        reference && frameDifference(reference, sample) < DUPLICATE_THRESHOLD;

      if (changedSinceCapture && !isDuplicate) {
        stableCountRef.current = 0;
        void takeCapture(true, sample);
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
    setElapsedMs(0);
    suggestionDismissedRef.current = false;
    detectionCountRef.current = 0;
  }, []);

  const captureManually = useCallback(async () => {
    await takeCapture(false, null);
  }, [takeCapture]);

  const dismissSuggestion = useCallback(() => {
    suggestionDismissedRef.current = true;
    setBoardDetected(false);
  }, []);

  return {
    status,
    captures,
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

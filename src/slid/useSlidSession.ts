import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ContentBounds,
  type ContentDelta,
  contentDelta,
  frameDifference,
  markMask,
  readScene,
  sampleFrame,
} from "./frameAnalysis";
import { capturePhotoFromVideo } from "../camera/capturePhoto";

export type SlidStatus = "idle" | "running" | "paused" | "finished";

/**
 * Why this moment was worth keeping. The reason is the product: a student
 * trusts the session when the camera can say what it noticed, not merely that
 * something changed.
 */
export type MomentReason =
  | "novo-topico"
  | "novo-slide"
  | "novo-conteudo"
  | "manual";

export const REASON_LABELS: Record<MomentReason, string> = {
  "novo-topico": "Novo tópico no quadro",
  "novo-slide": "Novo slide",
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
  /** Share of the frame covered in marks, kept so a moment can say whether
   *  there was content even when nothing could be read from it. */
  marks: number;
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
 *   1. Is there study material in front of the camera?   readScene
 *   2. Did the content itself change?                    contentDelta
 *
 * Neither alone is enough. Question 2 on its own is a motion detector — that
 * is what shipped first, and pointed at a person for a minute it produced
 * moments. Question 1 on its own would photograph a static page forever.
 */

/** Ticks of study material before capture arms — one lucky frame is not a class. */
const SCENE_ARM_TICKS = 2;
/** Ticks without it before capture disarms; a hand over the page is not a room change. */
const SCENE_LOST_TICKS = 3;

/** Frame-to-frame change that means something is moving — a hand, a person. */
const MOTION_THRESHOLD = 0.03;
/** Frames must settle before capturing, so a passing hand isn't photographed. */
const STABLE_TICKS = 2;

/*
 * Content thresholds, measured across the reference sequence. The smallest
 * real change — one line of a formula added — moves 0.5 % of the frame; sensor
 * noise moves 0.008 %; a lamp switched on moves nothing at all, because the
 * mark mask is measured against a local background.
 */
/** Marks gained or lost that count as a change worth keeping. */
const MIN_CHANGE = 0.0025;
/** How far one direction must outweigh the other before it means anything.
 *  Writing measures ∞; nudging the camera measures 1.05. */
const DIRECTION_DOMINANCE = 2;
/** Change outside the content at this scale means the camera moved, not the class. */
const REFRAMED = 0.006;
/** Marks leaving and arriving together at this scale: the surface was replaced. */
const SURFACE_REPLACED = 0.008;

/** Consecutive positive readings before the class suggestion appears. */
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
  /** Where the recognised content sits in the frame, so it can be shown. */
  contentBounds: ContentBounds | null;
  /**
   * The camera has seen study material but not yet enough of it to offer
   * anything. Shown, because three and a half seconds of a plain viewfinder
   * before the suggestion arrives reads as a camera that did not notice.
   */
  weighing: boolean;
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
  const [contentBounds, setContentBounds] = useState<ContentBounds | null>(null);
  const [weighing, setWeighing] = useState(false);

  const startedAtRef = useRef(0);
  const pausedTotalRef = useRef(0);
  const pausedAtRef = useRef(0);
  const lastCapturedMarksRef = useRef<Uint8Array | null>(null);
  const lastSampleRef = useRef<Uint8Array | null>(null);
  const stableCountRef = useRef(0);
  const sceneArmedRef = useRef(false);
  const boundsRef = useRef<ContentBounds | null>(null);
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
        let marks = 0;
        if (reference) {
          const mask = markMask(reference);
          lastCapturedMarksRef.current = mask;
          for (const pixel of mask) marks += pixel;
          marks /= mask.length;
        }
        const moment: SlidCapture = {
          id: crypto.randomUUID(),
          blob,
          atMs: Date.now() - startedAtRef.current - pausedTotalRef.current,
          auto: reason !== "manual",
          reason,
          marks,
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

      const scene = readScene(sample);
      if (scene.isStudy) {
        detectionCountRef.current++;
        // The bounds go up from the first positive read: what the camera is
        // weighing is worth seeing, not only what it concluded.
        setContentBounds(scene.bounds);
        const confirmed = detectionCountRef.current >= DETECTION_TICKS;
        setBoardDetected(confirmed);
        setWeighing(!confirmed);
      } else {
        detectionCountRef.current = 0;
        setBoardDetected(false);
        setWeighing(false);
        setContentBounds(null);
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
      const scene = readScene(sample);
      if (scene.isStudy) {
        sceneMissRef.current = 0;
        sceneOkRef.current++;
        boundsRef.current = scene.bounds;
        setContentBounds(scene.bounds);
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
          setContentBounds(null);
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
      const marks = markMask(sample);
      const reference = lastCapturedMarksRef.current;
      if (!reference) {
        stableCountRef.current = 0;
        void takeCapture("novo-topico", sample);
        return;
      }

      // Where the change happened decides what it was. A slide advancing and a
      // camera being nudged look identical from the content alone — marks
      // leaving and arriving in equal measure. They differ everywhere else:
      // moving the camera also moves the bezel, the desk and the wall, and a
      // new slide leaves all of that exactly where it was.
      const region = boundsRef.current;
      const outside = contentDelta(reference, marks, region, "outside");
      if (outside.added + outside.removed > REFRAMED) {
        lastCapturedMarksRef.current = marks;
        return;
      }

      const reason = classifyChange(contentDelta(reference, marks, region));
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
    // Arriving from the suggestion means the scene was already confirmed three
    // ticks in a row. Making the session re-earn that from zero opens it with
    // "procurando o conteúdo" over the very content it just recognised — the
    // narrative breaks in the first second, exactly where it matters most.
    const alreadyConfirmed = detectionCountRef.current >= DETECTION_TICKS;
    startedAtRef.current = Date.now();
    pausedTotalRef.current = 0;
    lastSampleRef.current = null;
    lastCapturedMarksRef.current = null;
    stableCountRef.current = 0;
    sceneArmedRef.current = alreadyConfirmed;
    sceneOkRef.current = alreadyConfirmed ? SCENE_ARM_TICKS : 0;
    sceneMissRef.current = 0;
    setSceneReady(alreadyConfirmed);
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
    setWeighing(false);
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
    contentBounds,
    weighing,
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
 * Someone writing adds marks and removes none. Nudging the camera, a shifting
 * shadow or sensor noise add and remove in comparable amounts. Testing the
 * direction of the change rather than its size is what separates the two.
 */
function classifyChange({ added, removed }: ContentDelta): MomentReason | null {
  // Measured inside the content only, so marks leaving and arriving together
  // can mean what it usually means in a lecture: the surface was replaced.
  // This is the primary case — a student watching a projector — and it was
  // being discarded as camera shake.
  if (
    added >= MIN_CHANGE &&
    removed >= MIN_CHANGE &&
    added + removed >= SURFACE_REPLACED
  ) {
    return "novo-slide";
  }
  if (removed >= MIN_CHANGE && removed > added * DIRECTION_DOMINANCE) {
    return "novo-topico";
  }
  if (added >= MIN_CHANGE && added > removed * DIRECTION_DOMINANCE) {
    return "novo-conteudo";
  }
  return null;
}

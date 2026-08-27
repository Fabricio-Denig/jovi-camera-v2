import { useCallback, useEffect, useRef, useState } from "react";

export type ZoomLevel = 1 | 2 | 3;
export const ZOOM_LEVELS: ZoomLevel[] = [1, 2, 3];

export interface CameraZoom {
  level: ZoomLevel;
  setLevel: (level: ZoomLevel) => void;
  /**
   * How much the frames themselves are *not* zoomed — what is left for the
   * preview, the capture and the analysis to do by cropping. 1 when the camera
   * did the whole job in hardware.
   */
  digital: number;
  /** Whether the hardware is doing it. Reported so the demo can say which it is. */
  native: boolean;
}

/**
 * Zoom, by whichever of the two routes the device actually offers.
 *
 * A student at the back of a lecture hall is the case this product is for, and
 * at that distance a slide is a small bright rectangle in the middle of a wide
 * frame. Zoom is not a convenience here — it is what puts enough of the writing
 * in front of the classifier for it to have anything to read.
 *
 * Hardware zoom is asked for first: it moves the actual sensor readout, so the
 * preview, the photo and the frames the session analyses are all zoomed with
 * nothing else to do. Android Chrome usually has it. Safari does not expose it
 * at all, so a digital crop covers the rest — and it has to reach every one of
 * those three places, or the camera would show one thing and the session would
 * read another.
 *
 * The camera track is read from the stream and never re-acquired: the capture
 * engine owns the lifecycle, and a zoom control has no business restarting it.
 */
export function useZoom(stream: MediaStream | null): CameraZoom {
  const [level, setLevelState] = useState<ZoomLevel>(1);
  const [native, setNative] = useState(false);
  const appliedRef = useRef<number>(1);

  const apply = useCallback(
    (target: ZoomLevel, activeStream: MediaStream | null) => {
      const track = activeStream?.getVideoTracks()[0];
      if (!track) {
        setNative(false);
        return;
      }
      // getCapabilities is missing on some browsers, and zoom is missing from
      // it on most. Both mean the same thing here: crop instead.
      const caps = (
        track.getCapabilities as undefined | (() => MediaTrackCapabilities)
      )?.call(track) as (MediaTrackCapabilities & { zoom?: { min: number; max: number } }) | undefined;
      const range = caps?.zoom;
      if (!range || typeof range.max !== "number" || range.max <= 1) {
        setNative(false);
        return;
      }

      const value = Math.min(range.max, Math.max(range.min ?? 1, target));
      void track
        .applyConstraints({
          advanced: [{ zoom: value } as MediaTrackConstraintSet],
        })
        .then(() => {
          appliedRef.current = value;
          setNative(true);
        })
        .catch(() => {
          // Asked for and refused: fall back rather than leave the preview at
          // one zoom and the analysis at another.
          appliedRef.current = 1;
          setNative(false);
        });
    },
    [],
  );

  const setLevel = useCallback(
    (next: ZoomLevel) => {
      setLevelState(next);
      apply(next, stream);
    },
    [apply, stream],
  );

  // A new stream — the student flipped the camera — starts at whatever zoom was
  // showing. Silently dropping to 1x mid-session would change the framing of a
  // class under way.
  useEffect(() => {
    appliedRef.current = 1;
    setNative(false);
    if (stream) apply(level, stream);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, apply]);

  return {
    level,
    setLevel,
    digital: native ? Math.max(1, level / appliedRef.current) : level,
    native,
  };
}

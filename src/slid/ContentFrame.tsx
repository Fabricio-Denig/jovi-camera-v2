import { useEffect, useState } from "react";
import type { ContentBounds } from "./frameAnalysis";
import type { CameraFacing } from "../types/camera";

interface ContentFrameProps {
  bounds: ContentBounds | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  facing: CameraFacing;
  /** Shown beside the frame while the suggestion is on screen. */
  label?: string;
  /**
   * Changes each time a moment is kept. The frame acknowledges it, which is
   * what turns an automatic capture into something the student can see happen.
   */
  capturedKey?: string | null;
  /**
   * The camera is still making up its mind. Drawn fainter and without a label:
   * an outline settling into place is "I am looking at this", which is true,
   * while a spinner would be processing — the wrong word for a camera that is
   * simply paying attention.
   */
  tentative?: boolean;
}

/**
 * The frame drawn around what the camera recognised.
 *
 * This is the difference between claiming to understand the scene and showing
 * it. The rectangle comes from the actual extent of the marks the classifier
 * found, so when the recognition is wrong the frame is wrong too and the
 * student can see that — a decorative rectangle that always looks right would
 * teach them to trust a camera that had not earned it.
 *
 * Deliberately not a scanner: no corner brackets, no sweeping line, no grid.
 * A thin resting outline that settles into place is a camera confirming
 * something; the rest is a machine processing a document.
 */
export function ContentFrame({
  bounds,
  videoRef,
  facing,
  label,
  capturedKey,
  tentative,
}: ContentFrameProps) {
  const rect = useCoverRect(bounds, videoRef, facing);
  if (!rect) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[12] overflow-hidden"
    >
      <div
        className={
          tentative
            ? "absolute animate-[slid-settle_420ms_cubic-bezier(0.16,1,0.3,1)] rounded-xl border border-dashed border-accent/45 transition-all duration-300"
            : "absolute animate-[slid-settle_420ms_cubic-bezier(0.16,1,0.3,1)] rounded-xl border border-accent/80 transition-all duration-300"
        }
        style={{
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          boxShadow: tentative ? undefined : "0 0 0 9999px rgba(0,0,0,0.14)",
        }}
      >
        {/* Keyed by the moment, so each capture mounts its own flash and replays
            the animation instead of fighting a shared timer. */}
        {capturedKey && (
          <span
            key={capturedKey}
            className="pointer-events-none absolute -inset-px animate-[slid-confirm_700ms_ease-out] rounded-xl bg-accent/10 ring-2 ring-accent/90"
          />
        )}

        {/* Inside the frame, not above it: content that reaches the top of the
            view would push a label outside the screen. */}
        {label && (
          <span className="absolute left-1.5 top-1.5 whitespace-nowrap rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-accent-ink">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

/** Smallest visible frame worth drawing, in CSS pixels. */
const MIN_VISIBLE = 64;

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Maps frame coordinates onto the element.
 *
 * The preview is `object-cover`, so the video is scaled up until it fills the
 * element and the overflow is cropped — placing the box by percentage would
 * put it in the wrong place on every phone whose aspect ratio differs from the
 * camera's. The front camera is mirrored on screen, and the box has to mirror
 * with it or it lands on the opposite side of what it describes.
 */
function useCoverRect(
  bounds: ContentBounds | null,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  facing: CameraFacing,
): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!bounds || !video) {
      setRect(null);
      return;
    }

    const measure = () => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const cw = video.clientWidth;
      const ch = video.clientHeight;
      if (!vw || !vh || !cw || !ch) return;

      const scale = Math.max(cw / vw, ch / vh);
      const shownW = vw * scale;
      const shownH = vh * scale;
      const offsetX = (cw - shownW) / 2;
      const offsetY = (ch - shownH) / 2;

      const x = facing === "user" ? 1 - bounds.x - bounds.width : bounds.x;

      // `object-cover` crops the frame, so content near an edge is genuinely
      // off-screen. Clamping keeps the outline against the edge it runs past —
      // honest about the content continuing beyond the view — instead of
      // drawing most of a rectangle where nobody can see it.
      const left = Math.max(0, offsetX + x * shownW);
      const top = Math.max(0, offsetY + bounds.y * shownH);
      const right = Math.min(cw, offsetX + (x + bounds.width) * shownW);
      const bottom = Math.min(ch, offsetY + (bounds.y + bounds.height) * shownH);

      // A sliver clinging to one edge reads as a rendering fault, not as
      // recognition. Below this the frame says nothing worth saying.
      if (right - left < MIN_VISIBLE || bottom - top < MIN_VISIBLE) {
        setRect(null);
        return;
      }

      setRect({ left, top, width: right - left, height: bottom - top });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(video);
    return () => observer.disconnect();
  }, [bounds, videoRef, facing]);

  return rect;
}

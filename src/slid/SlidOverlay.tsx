import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import { formatClock } from "../shared/lib/time";
import type { SlidCapture, SlidStatus } from "./useSlidSession";

interface SlidOverlayProps {
  status: SlidStatus;
  captures: SlidCapture[];
  elapsedMs: number;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
}

/**
 * The live session: timer, capture stack and session controls.
 *
 * Captures land here as they happen so the student can see the session working
 * without interrupting it — the reassurance that replaces photographing the
 * board by hand.
 */
export function SlidOverlay({
  status,
  captures,
  elapsedMs,
  onPause,
  onResume,
  onFinish,
}: SlidOverlayProps) {
  const running = status === "running";

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-[max(70px,calc(env(safe-area-inset-top)+54px))]">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-canvas/90 px-3 py-1.5 backdrop-blur">
          <span
            className={
              running
                ? "size-2 rounded-full bg-accent animate-pulse"
                : "size-2 rounded-full bg-warn"
            }
          />
          <span className="text-[12px] font-semibold text-ink">SliD</span>
          <span className="font-mono text-[12px] tabular-nums text-ink-muted">
            {formatClock(elapsedMs)}
          </span>
          {!running && (
            <span className="text-[11px] text-warn">pausado</span>
          )}
        </div>
      </div>

      {/* Capture stack, mirroring the Figma v2 session frame. */}
      {captures.length > 0 && (
        <div className="pointer-events-none absolute right-3 top-[max(118px,calc(env(safe-area-inset-top)+102px))] z-20 flex max-h-[45%] flex-col gap-2 overflow-hidden">
          {captures
            .slice(-4)
            .reverse()
            .map((capture) => (
              <CaptureChip key={capture.id} capture={capture} />
            ))}
          {captures.length > 4 && (
            <span className="rounded-full bg-black/60 px-2 py-0.5 text-center font-mono text-[10px] text-white">
              +{captures.length - 4}
            </span>
          )}
        </div>
      )}

      <div className="pointer-events-auto absolute inset-x-0 bottom-[150px] z-20 flex items-center justify-center gap-3 px-6">
        <button
          type="button"
          onClick={running ? onPause : onResume}
          className="rounded-full bg-canvas/85 px-4 py-2 text-[13px] font-medium text-ink backdrop-blur active:opacity-70"
        >
          {running ? "Pausar" : "Continuar"}
        </button>
        <button
          type="button"
          onClick={onFinish}
          className="rounded-full bg-accent px-4 py-2 text-[13px] font-medium text-accent-ink active:opacity-80"
        >
          Encerrar sessão
        </button>
      </div>
    </>
  );
}

function CaptureChip({ capture }: { capture: SlidCapture }) {
  const url = useObjectUrl(capture.blob);
  return (
    <div className="relative size-16 overflow-hidden rounded-lg border border-accent/60">
      {url && <img src={url} alt="" className="size-full object-cover" />}
      <span className="absolute inset-x-0 bottom-0 bg-black/65 text-center font-mono text-[9px] text-white">
        {formatClock(capture.atMs)}
      </span>
      {capture.auto && (
        <span className="absolute left-1 top-1 rounded bg-accent px-1 text-[8px] font-semibold text-accent-ink">
          auto
        </span>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { REASON_LABELS, type SlidCapture, type SlidStatus } from "./useSlidSession";
import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import { formatClock } from "../shared/lib/time";

interface SlidOverlayProps {
  status: SlidStatus;
  captures: SlidCapture[];
  lastMoment: SlidCapture | null;
  elapsedMs: number;
  onMarkMoment: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
}

/**
 * The live session.
 *
 * This screen owns the whole viewfinder while a class is being followed: the
 * camera bar, the shutter and the thumbnail are all hidden behind it. A big
 * white shutter in the middle of the screen tells a first-time viewer they are
 * supposed to be taking pictures, which is the exact opposite of the promise.
 */
export function SlidOverlay({
  status,
  captures,
  lastMoment,
  elapsedMs,
  onMarkMoment,
  onPause,
  onResume,
  onFinish,
}: SlidOverlayProps) {
  const running = status === "running";

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-2 pt-[max(70px,calc(env(safe-area-inset-top)+54px))]">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-canvas/90 px-3.5 py-2 backdrop-blur">
          <span
            className={
              running
                ? "size-2 animate-pulse rounded-full bg-accent"
                : "size-2 rounded-full bg-warn"
            }
          />
          <span className="text-[12.5px] font-semibold text-ink">
            {running ? "Acompanhando a aula" : "Pausado"}
          </span>
          <span className="font-mono text-[12px] tabular-nums text-ink-muted">
            {formatClock(elapsedMs)}
          </span>
        </div>

        {running && lastMoment && (
          // Keyed by the moment so each new one mounts its own toast, instead
          // of resetting a timer inside an effect.
          <MomentToast key={lastMoment.id} moment={lastMoment} />
        )}
      </div>

      {captures.length > 0 && (
        <div className="pointer-events-none absolute right-3 top-[max(140px,calc(env(safe-area-inset-top)+124px))] z-20 flex max-h-[38%] flex-col gap-2 overflow-hidden">
          {captures
            .slice(-3)
            .reverse()
            .map((capture) => (
              <MomentChip key={capture.id} capture={capture} />
            ))}
        </div>
      )}

      {/* The camera chrome is hidden during a session, and its scrim went with
          it — white controls over a lit whiteboard are unreadable without one. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] h-48 bg-gradient-to-t from-black/75 via-black/40 to-transparent"
      />

      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-4 pb-7">
        {/* Says the quiet part out loud: nothing is expected of the student. */}
        <p className="mx-8 rounded-full bg-black/45 px-3.5 py-1.5 text-center text-[11.5px] leading-snug text-white/90 backdrop-blur">
          {captures.length === 0
            ? running
              ? "Pode apoiar o celular e assistir — o SliD guarda o que for importante"
              : "Sessão pausada. Nada está sendo guardado."
            : `${captures.length} ${captures.length === 1 ? "momento guardado" : "momentos guardados"} até agora`}
        </p>

        <div className="flex items-center gap-2.5 px-5">
          <button
            type="button"
            onClick={running ? onPause : onResume}
            className="min-h-11 rounded-full bg-canvas/85 px-4 py-2.5 text-[13px] font-medium text-ink backdrop-blur active:opacity-70"
          >
            {running ? "Pausar" : "Continuar"}
          </button>

          {/* Optional by design, and shaped like a note rather than a shutter:
              marking a moment is the exception, not the way the mode is used. */}
          <button
            type="button"
            onClick={onMarkMoment}
            disabled={!running}
            aria-label="Marcar este momento"
            className="min-h-11 rounded-full border border-white/40 bg-black/35 px-4 py-2.5 text-[13px] font-medium text-white backdrop-blur active:opacity-70 disabled:opacity-30"
          >
            Marcar momento
          </button>

          <button
            type="button"
            onClick={onFinish}
            className="min-h-11 rounded-full bg-accent px-4 py-2.5 text-[13px] font-medium text-accent-ink active:opacity-80"
          >
            Encerrar
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Announces what the camera just recognised, then gets out of the way.
 * This is the moment the product is arguing for — the student sees the camera
 * decide, without being asked to do anything.
 */
function MomentToast({ moment }: { moment: SlidCapture }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-auto flex animate-[slid-rise_240ms_ease-out] items-center gap-2 rounded-full bg-accent px-3.5 py-2 text-accent-ink">
      <CheckIcon />
      <span className="text-[12.5px] font-medium">
        {REASON_LABELS[moment.reason]}
      </span>
    </div>
  );
}

function MomentChip({ capture }: { capture: SlidCapture }) {
  const url = useObjectUrl(capture.blob);
  return (
    <div className="relative size-16 animate-[slid-rise_260ms_ease-out] overflow-hidden rounded-lg border border-white/40">
      {url && <img src={url} alt="" className="size-full object-cover" />}
      <span className="absolute inset-x-0 bottom-0 bg-black/65 text-center font-mono text-[9px] text-white">
        {formatClock(capture.atMs)}
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

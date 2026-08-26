import { useEffect, useState } from "react";
import { REASON_LABELS, type SlidCapture, type SlidStatus } from "./useSlidSession";
import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import { formatClock } from "../shared/lib/time";

interface SlidOverlayProps {
  status: SlidStatus;
  /** Whether study material is actually in front of the camera right now. */
  sceneReady: boolean;
  captures: SlidCapture[];
  lastMoment: SlidCapture | null;
  elapsedMs: number;
  canSwitchFacing: boolean;
  isSwitching: boolean;
  onSwitchFacing: () => void;
  onMarkMoment: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  /** The confirmation owns the whole screen, navigation included. */
  onConfirmingChange: (confirming: boolean) => void;
}

/** How long the controls stay up after a tap before the screen goes quiet again. */
const CONTROLS_MS = 5000;
/** How long the hint that explains the tap stays on screen at the start. */
const HINT_MS = 4200;

/**
 * The live session.
 *
 * At rest this screen has no controls at all — only what the camera is doing,
 * how long it has been doing it, and what it kept. That is the product's whole
 * claim: the student props up the phone and stops interacting. A row of
 * buttons under the words "pode apoiar o celular" argues the opposite, and the
 * interface wins that argument every time.
 *
 * The controls are one tap away, and a hint says so while the session settles.
 * Hiding a way out entirely would be worse than the contradiction it fixes.
 */
export function SlidOverlay({
  status,
  sceneReady,
  captures,
  lastMoment,
  elapsedMs,
  canSwitchFacing,
  isSwitching,
  onSwitchFacing,
  onMarkMoment,
  onPause,
  onResume,
  onFinish,
  onConfirmingChange,
}: SlidOverlayProps) {
  const running = status === "running";
  // Saying "acompanhando a aula" while the camera faces a wall is the kind of
  // small lie that costs the whole demo. The session says what it is doing.
  const searching = running && !sceneReady;

  const [controlsOpen, setControlsOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHintVisible(false), HINT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    onConfirmingChange(confirming);
  }, [confirming, onConfirmingChange]);

  // Confirming ends the session, which unmounts this overlay in the same
  // commit — the effect above never gets to report the dialog closing, and the
  // app's navigation stayed hidden for good. Releasing it on unmount is the
  // only place that always runs.
  useEffect(() => () => onConfirmingChange(false), [onConfirmingChange]);

  // The controls retire on their own, so the screen returns to the state the
  // product is arguing for without the student having to dismiss anything.
  useEffect(() => {
    if (!controlsOpen || confirming) return;
    const timer = setTimeout(() => setControlsOpen(false), CONTROLS_MS);
    return () => clearTimeout(timer);
  }, [controlsOpen, confirming]);

  // A paused session must never look like one that is quietly working. Keyed on
  // "paused" and not on "not running": the overlay mounts while the session is
  // still idle, and treating that as paused opened the controls on every
  // single session — the exact thing this screen exists to avoid.
  useEffect(() => {
    if (status === "paused") setControlsOpen(true);
  }, [status]);

  return (
    <>
      {/* The tap target is the viewfinder itself. */}
      <button
        type="button"
        aria-label={controlsOpen ? "Esconder controles" : "Mostrar controles"}
        onClick={() => setControlsOpen((open) => !open)}
        className="absolute inset-0 z-[14] cursor-default"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-2 pt-[max(70px,calc(env(safe-area-inset-top)+54px))]">
        <div className="flex items-center gap-2 rounded-full bg-canvas/90 px-3.5 py-2 backdrop-blur">
          <span
            className={
              !running
                ? "size-2 rounded-full bg-warn"
                : searching
                  ? "size-2 animate-pulse rounded-full bg-ink-muted"
                  : "size-2 animate-pulse rounded-full bg-accent"
            }
          />
          <span className="text-[12.5px] font-semibold text-ink">
            {!running
              ? "Pausado"
              : searching
                ? "Procurando o conteúdo"
                : "Acompanhando a aula"}
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

      {/* At rest: one line, and it is a reassurance rather than an instruction. */}
      {!controlsOpen && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 pb-8">
          <p className="mx-8 rounded-full bg-black/45 px-3.5 py-1.5 text-center text-[11.5px] leading-snug text-white/90 backdrop-blur">
            {searching
              ? "Aponte para o quadro, o slide ou o caderno"
              : captures.length === 0
                ? "Pode apoiar o celular e assistir"
                : `${captures.length} ${captures.length === 1 ? "momento guardado" : "momentos guardados"}`}
          </p>
          {hintVisible && (
            <p className="animate-[slid-rise_240ms_ease-out] text-[10.5px] text-white/55">
              toque na tela para ver os controles
            </p>
          )}
        </div>
      )}

      {controlsOpen && (
        <>
          {/* White controls over a lit page are unreadable without a scrim. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] h-48 bg-gradient-to-t from-black/75 via-black/40 to-transparent"
          />
          <div className="absolute inset-x-0 bottom-0 z-20 flex animate-[slid-rise_200ms_ease-out] flex-col items-center gap-3 pb-7">
            <div className="flex items-center gap-2.5 px-5">
              <button
                type="button"
                onClick={running ? onPause : onResume}
                className="min-h-11 rounded-full bg-canvas/85 px-4 py-2.5 text-[13px] font-medium text-ink backdrop-blur active:opacity-70"
              >
                {running ? "Pausar" : "Continuar"}
              </button>

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
                onClick={() => setConfirming(true)}
                className="min-h-11 rounded-full bg-accent px-4 py-2.5 text-[13px] font-medium text-accent-ink active:opacity-80"
              >
                Encerrar
              </button>
            </div>

            {canSwitchFacing && (
              <button
                type="button"
                onClick={onSwitchFacing}
                disabled={isSwitching}
                aria-label="Trocar câmera"
                className="flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[12px] text-white/75 active:opacity-60 disabled:opacity-30"
              >
                <span className={isSwitching ? "animate-spin" : undefined}>
                  <FlipIcon />
                </span>
                Trocar câmera
              </button>
            )}
          </div>
        </>
      )}

      {confirming && (
        <FinishConfirm
          count={captures.length}
          onKeep={() => setConfirming(false)}
          onFinish={() => {
            setConfirming(false);
            onFinish();
          }}
        />
      )}
    </>
  );
}

/**
 * Ending a class is not undoable, and during a live demonstration one stray tap
 * would take the whole session with it.
 */
function FinishConfirm({
  count,
  onKeep,
  onFinish,
}: {
  count: number;
  onKeep: () => void;
  onFinish: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Encerrar a aula"
      className="absolute inset-0 z-40 flex items-end justify-center bg-black/60 px-4 pb-8 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm animate-[slid-rise_220ms_ease-out] rounded-2xl bg-canvas p-5">
        <h2 className="text-[16px] font-semibold text-ink">
          {count === 0
            ? "Encerrar sem nenhum momento?"
            : `Salvar esta aula com ${count} ${count === 1 ? "momento" : "momentos"}?`}
        </h2>
        <p className="mt-1 text-[13px] leading-snug text-ink-muted">
          {count === 0
            ? "A câmera ainda não encontrou conteúdo de estudo. Continuando, ela segue procurando."
            : "Você revisa a aula antes de guardar."}
        </p>
        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={onKeep}
            className="min-h-11 flex-1 rounded-xl bg-surface-2 text-[13.5px] font-medium text-ink active:opacity-70"
          >
            Continuar aula
          </button>
          <button
            type="button"
            onClick={onFinish}
            className="min-h-11 flex-1 rounded-xl bg-accent text-[13.5px] font-medium text-accent-ink active:opacity-80"
          >
            {count === 0 ? "Encerrar" : "Salvar aula"}
          </button>
        </div>
      </div>
    </div>
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
    <div className="flex animate-[slid-rise_240ms_ease-out] items-center gap-2 rounded-full bg-accent px-3.5 py-2 text-accent-ink">
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

function FlipIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 2.1 21 6l-4 3.9" />
      <path d="M3 12v-1a4 4 0 0 1 4-4h14" />
      <path d="M7 21.9 3 18l4-3.9" />
      <path d="M21 12v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

import { ASPECT_RATIOS, type AspectRatio } from "./aspect";

export type TimerSeconds = 0 | 3 | 10;
export const TIMER_STEPS: TimerSeconds[] = [0, 3, 10];

interface TopBarProps {
  canSwitchFacing: boolean;
  onSwitchFacing: () => void;
  isRecording: boolean;
  elapsedMs: number;
  isSwitching: boolean;
  torchAvailable: boolean;
  torchOn: boolean;
  onToggleTorch: () => void;
  timer: TimerSeconds;
  onCycleTimer: () => void;
  aspect: AspectRatio;
  onCycleAspect: () => void;
  onOpenSettings: () => void;
  /**
   * A sugestão do SliD ocupa esta mesma fileira, como no Figma. Enquanto ela
   * está lá, o grupo do meio sai — antes disto os dois se sobrepunham e o
   * temporizador ficava inalcançável atrás da pílula.
   */
  suggesting: boolean;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/**
 * A barra de cima, na forma do Figma: a lanterna à esquerda, um grupo de
 * pastilhas no meio, os ajustes à direita.
 *
 * Cada pastilha do meio percorre seus valores no toque em vez de abrir um
 * menu. São três estados no temporizador e três na proporção; um menu para
 * escolher entre três coisas é uma tela a mais para uma decisão que cabe num
 * toque, e no meio de uma aula a tela a mais custa a aula.
 *
 * A lanterna só aparece onde existe. Um controle morto na barra é pior que a
 * ausência dele: quem toca e não vê nada acontecer conclui que o app quebrou.
 */
export function TopBar({
  canSwitchFacing,
  onSwitchFacing,
  isRecording,
  elapsedMs,
  isSwitching,
  torchAvailable,
  torchOn,
  onToggleTorch,
  timer,
  onCycleTimer,
  aspect,
  onCycleAspect,
  onOpenSettings,
  suggesting,
}: TopBarProps) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 bg-gradient-to-b from-black/55 to-transparent px-4 pb-8 pt-[max(16px,env(safe-area-inset-top))]">
      {torchAvailable ? (
        <button
          type="button"
          onClick={onToggleTorch}
          aria-pressed={torchOn}
          aria-label={torchOn ? "Apagar a lanterna" : "Acender a lanterna"}
          className={`flex size-11 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95 ${
            torchOn ? "bg-white text-black" : "bg-black/40 text-white"
          }`}
        >
          <BoltIcon />
        </button>
      ) : (
        <span className="size-11 shrink-0" />
      )}

      {isRecording ? (
        <span className="flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 font-mono text-xs text-white">
          <span className="size-2 animate-pulse rounded-full bg-danger" />
          {formatElapsed(elapsedMs)}
        </span>
      ) : suggesting ? (
        <span />
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCycleTimer}
            aria-label={
              timer === 0
                ? "Temporizador desligado, tocar para 3 segundos"
                : `Temporizador de ${timer} segundos`
            }
            className={`flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-3 text-[12px] font-semibold transition-colors active:scale-95 ${
              timer === 0 ? "bg-black/40 text-white" : "bg-white text-black"
            }`}
          >
            <ClockIcon />
            {timer > 0 && <span>{timer}s</span>}
          </button>

          <button
            type="button"
            onClick={onCycleAspect}
            aria-label={`Proporção ${aspect}`}
            className="flex h-11 items-center justify-center rounded-full bg-black/40 px-3 text-[12px] font-semibold text-white transition-colors active:scale-95"
          >
            {aspect}
          </button>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1.5">
        {canSwitchFacing && (
          <button
            type="button"
            onClick={onSwitchFacing}
            disabled={isRecording || isSwitching}
            aria-label="Trocar câmera"
            className="flex size-11 items-center justify-center rounded-full bg-black/40 text-white active:opacity-70 disabled:opacity-30"
          >
            <span className={isSwitching ? "animate-spin" : undefined}>
              <FlipIcon />
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          // "Ajustes" e não "Ajustes da câmera": o segundo contém o nome do botão
          // "Câmera" da navegação, e dois controles cujos nomes se contêm são
          // ambíguos para quem navega por leitor de tela — e para os testes.
          aria-label="Ajustes"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-black/40 text-white transition-transform active:scale-95"
        >
          <GearIcon />
        </button>
      </div>
    </div>
  );
}

export function nextTimer(current: TimerSeconds): TimerSeconds {
  return TIMER_STEPS[(TIMER_STEPS.indexOf(current) + 1) % TIMER_STEPS.length];
}

export function nextAspect(current: AspectRatio): AspectRatio {
  return ASPECT_RATIOS[(ASPECT_RATIOS.indexOf(current) + 1) % ASPECT_RATIOS.length];
}

function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2 4.5 13.2h6L11 22l8.5-11.2h-6L13 2Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9 2h6" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

function FlipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 2.1 21 6l-4 3.9" />
      <path d="M3 12.2V12a9 9 0 0 1 15-6.7l3 2.7" />
      <path d="M7 21.9 3 18l4-3.9" />
      <path d="M21 11.8v.2a9 9 0 0 1-15 6.7l-3-2.7" />
    </svg>
  );
}

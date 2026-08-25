interface TopBarProps {
  canSwitchFacing: boolean;
  onSwitchFacing: () => void;
  isRecording: boolean;
  elapsedMs: number;
  isSwitching: boolean;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function TopBar({
  canSwitchFacing,
  onSwitchFacing,
  isRecording,
  elapsedMs,
  isSwitching,
}: TopBarProps) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[max(16px,env(safe-area-inset-top))]">
      {isRecording ? (
        <span className="flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 font-mono text-xs text-white">
          <span className="size-2 rounded-full bg-danger animate-pulse" />
          {formatElapsed(elapsedMs)}
        </span>
      ) : (
        <span />
      )}

      {canSwitchFacing && (
        <button
          type="button"
          onClick={onSwitchFacing}
          disabled={isRecording || isSwitching}
          aria-label="Trocar câmera"
          className="flex size-10 items-center justify-center rounded-full bg-black/40 text-white active:opacity-70 disabled:opacity-30"
        >
          <span className={isSwitching ? "animate-spin" : undefined}>
            <FlipIcon />
          </span>
        </button>
      )}
    </div>
  );
}

function FlipIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 2.1 21 6l-4 3.9" />
      <path d="M3 12.2V12a9 9 0 0 1 15-6.7l3 2.7" />
      <path d="M7 21.9 3 18l4-3.9" />
      <path d="M21 11.8v.2a9 9 0 0 1-15 6.7l-3-2.7" />
    </svg>
  );
}

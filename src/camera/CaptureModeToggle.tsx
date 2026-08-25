import type { CaptureKind } from "../types/camera";

interface CaptureModeToggleProps {
  mode: CaptureKind;
  onChange: (mode: CaptureKind) => void;
  disabled: boolean;
}

/**
 * Minimal Foto/Vídeo switch for day 1. This is intentionally not the full
 * ModeTabs component from the blueprint (Retrato/Noite/SliD/…) — that comes
 * with the modes catalog in a later phase.
 */
export function CaptureModeToggle({
  mode,
  onChange,
  disabled,
}: CaptureModeToggleProps) {
  return (
    <div className="flex items-center gap-6 font-medium text-sm">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("photo")}
        className={
          mode === "photo" ? "text-white" : "text-white/50 disabled:opacity-40"
        }
      >
        Foto
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("video")}
        className={
          mode === "video" ? "text-white" : "text-white/50 disabled:opacity-40"
        }
      >
        Vídeo
      </button>
    </div>
  );
}

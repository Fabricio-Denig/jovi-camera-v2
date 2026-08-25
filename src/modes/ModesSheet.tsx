import { BottomSheet } from "../shared/ui/BottomSheet";
import { MODES, type CameraMode } from "./modes";

interface ModesSheetProps {
  open: boolean;
  activeModeId: string;
  onSelect: (modeId: string) => void;
  onClose: () => void;
}

/**
 * The full mode catalog. Every entry carries what it does and when to use it,
 * because a name alone is exactly what makes features undiscoverable today.
 *
 * Search and category sections arrive with the remaining thirteen modes.
 */
export function ModesSheet({
  open,
  activeModeId,
  onSelect,
  onClose,
}: ModesSheetProps) {
  return (
    <BottomSheet
      open={open}
      title="Modos"
      subtitle="Escolha como a câmera captura"
      onClose={onClose}
    >
      <ul className="flex flex-col gap-2 pb-2">
        {MODES.map((mode) => (
          <li key={mode.id}>
            <ModeRow
              mode={mode}
              active={mode.id === activeModeId}
              onSelect={() => onSelect(mode.id)}
            />
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}

function ModeRow({
  mode,
  active,
  onSelect,
}: {
  mode: CameraMode;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left active:opacity-80 ${
        active
          ? "border-accent bg-accent-soft"
          : "border-line bg-surface-2"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink">{mode.label}</span>
        {active && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-ink">
            ativo
          </span>
        )}
      </div>
      <p className="mt-1 text-[13px] text-ink-muted">{mode.summary}</p>
      <p className="mt-1.5 text-[12px] text-ink-muted/80">{mode.whenToUse}</p>
    </button>
  );
}

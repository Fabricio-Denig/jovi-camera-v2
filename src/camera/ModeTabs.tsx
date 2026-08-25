import { PINNED_MODES } from "../modes/modes";

interface ModeTabsProps {
  modeId: string;
  onSelect: (modeId: string) => void;
  onOpenCatalog: () => void;
  disabled: boolean;
}

/**
 * The mode bar over the shutter. Shows the pinned modes plus an always-present
 * entry into the full catalog, so no mode is ever more than two taps away —
 * the discovery problem this product exists to solve.
 */
export function ModeTabs({
  modeId,
  onSelect,
  onOpenCatalog,
  disabled,
}: ModeTabsProps) {
  return (
    <div className="flex items-center justify-center gap-6 text-sm font-medium">
      {PINNED_MODES.map((mode) => (
        <button
          key={mode.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(mode.id)}
          aria-current={modeId === mode.id ? "true" : undefined}
          className={
            modeId === mode.id
              ? "text-white disabled:opacity-40"
              : "text-white/50 disabled:opacity-40"
          }
        >
          {mode.label}
        </button>
      ))}

      <button
        type="button"
        disabled={disabled}
        onClick={onOpenCatalog}
        aria-label="Todos os modos"
        className="text-white/50 disabled:opacity-40"
      >
        •••
      </button>
    </div>
  );
}

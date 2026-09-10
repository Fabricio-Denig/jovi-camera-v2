import { PINNED_MODES, getMode } from "../modes/modes";

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
  // Generous padding rather than bare text: these are the most used controls in
  // the app and a label-sized tap target is a miss waiting to happen on a phone.
  const tapArea = "min-h-11 min-w-11 px-3 py-2.5 disabled:opacity-40";

  /*
   * O modo em uso pode não estar fixado na barra — Documento não está. Sem
   * isto, entrar em Documento deixava a barra com Foto, Vídeo e SliD todos
   * apagados e nenhum aceso: a câmera muda de comportamento e a interface não
   * diz qual. O nome do modo entra na barra enquanto ele estiver em uso.
   */
  const fixado = PINNED_MODES.some((mode) => mode.id === modeId);
  const atual = getMode(modeId);

  return (
    <div className="flex items-center justify-center gap-2 text-sm font-medium">
      {!fixado && (
        <button
          type="button"
          disabled={disabled}
          onClick={onOpenCatalog}
          aria-current="true"
          className={`${tapArea} whitespace-nowrap text-white`}
        >
          {atual.label}
        </button>
      )}
      {PINNED_MODES.map((mode) => (
        <button
          key={mode.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(mode.id)}
          aria-current={modeId === mode.id ? "true" : undefined}
          className={`${tapArea} ${
            modeId === mode.id ? "text-white" : "text-white/55"
          }`}
        >
          {mode.label}
        </button>
      ))}

      <button
        type="button"
        disabled={disabled}
        onClick={onOpenCatalog}
        aria-label="Todos os modos"
        className={`${tapArea} text-white/55`}
      >
        •••
      </button>
    </div>
  );
}

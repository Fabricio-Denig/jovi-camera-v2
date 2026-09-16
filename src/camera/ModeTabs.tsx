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

  /*
   * Antes todo rótulo tinha o mesmo peso — só a cor (branco vs. branco 55%)
   * dizia qual modo estava ativo. Uma câmera nativa faz o modo em uso ler
   * maior e mais pesado que os vizinhos, com um traço embaixo — o mesmo
   * carrossel que Foto/Vídeo/Retrato usam no sistema, mesmo sem o gesto de
   * arrastar. A régua fica só no modo escolhido, do mesmo jeito que as abas
   * da Aula salva (`ClassTabs.tsx`) já fazem.
   */
  return (
    <div className="flex items-center justify-center gap-2 text-[13px] font-medium">
      {!fixado && (
        <button
          type="button"
          disabled={disabled}
          onClick={onOpenCatalog}
          aria-current="true"
          className={`${tapArea} relative whitespace-nowrap text-[15px] font-semibold text-white`}
        >
          {atual.label}
          <span
            aria-hidden="true"
            className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-white"
          />
        </button>
      )}
      {PINNED_MODES.map((mode) => {
        const ativo = modeId === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(mode.id)}
            aria-current={ativo ? "true" : undefined}
            className={`${tapArea} relative transition-[font-size,color] duration-150 ${
              ativo ? "text-[15px] font-semibold text-white" : "text-white/55"
            }`}
          >
            {mode.label}
            {ativo && (
              <span
                aria-hidden="true"
                className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-white"
              />
            )}
          </button>
        );
      })}

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

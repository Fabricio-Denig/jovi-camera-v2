/**
 * Virar a câmera, na fileira do obturador.
 *
 * O Figma (`Camera inicial v2`) põe três coisas nessa fileira — miniatura,
 * obturador e virar câmera —, e o app tinha a terceira coluna vazia enquanto o
 * botão morava no topo. A posição importa: virar a câmera é um gesto de
 * captura, feito com o polegar junto do obturador, e não uma configuração
 * junto do relógio e da proporção.
 */
export function FlipButton({
  onSwitch,
  disabled,
  isSwitching,
}: {
  onSwitch: () => void;
  disabled: boolean;
  isSwitching: boolean;
}) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={onSwitch}
        disabled={disabled}
        aria-label="Trocar câmera"
        className="flex size-11 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur transition-transform active:scale-90 disabled:opacity-30"
      >
        <span className={isSwitching ? "block animate-spin" : "block"}>
          <FlipIcon />
        </span>
      </button>
    </div>
  );
}

function FlipIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 2.1 21 6l-4 3.9" />
      <path d="M3 12.2V12a9 9 0 0 1 15-6.7l3 2.7" />
      <path d="M7 21.9 3 18l4-3.9" />
      <path d="M21 11.8v.2a9 9 0 0 1-15 6.7l-3-2.7" />
    </svg>
  );
}

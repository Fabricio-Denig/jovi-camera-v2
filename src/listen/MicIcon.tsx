/**
 * O microfone, em SVG e não em emoji.
 *
 * Medido, e por isso desenhado: "🎙" não renderiza no Chromium sem fonte de
 * emoji — sai um retângulo vazio ou nada —, e a cobertura em navegador de
 * celular varia com o sistema. Um ícone que some é pior que ícone nenhum,
 * porque a linha ao lado dele fica órfã.
 *
 * `currentColor` de propósito: ele aparece sobre cartão claro e sobre pílula
 * escura, e herdar a cor é o que faz os dois funcionarem sem uma segunda
 * versão.
 */
export function MicIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
    </svg>
  );
}

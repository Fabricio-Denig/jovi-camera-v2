import { sunbeamCss } from "./effectPaint";

/**
 * A camada do efeito, desenhada sobre o visor.
 *
 * Ela é irmã do <video>, não um filtro dele, e essa distinção é o que mantém o
 * SliD intacto: `drawImage` a partir do <video> lê o quadro cru da câmera e
 * não enxerga nem esta camada nem o filtro de CSS. O estudante muda a tela; a
 * leitura da aula continua vendo o que a câmera entregou.
 *
 * O tremor não aparece aqui porque não é uma camada: é movimento do próprio
 * visor, e vive no `Viewfinder`.
 */
export function EffectLayer({ effectId }: { effectId: string | null }) {
  if (effectId !== "raio-de-sol") return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[2]"
      style={{ background: sunbeamCss(), mixBlendMode: "screen" }}
    />
  );
}

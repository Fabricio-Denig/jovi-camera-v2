import { useEffect, useRef, useState } from "react";
import type { ContentBounds } from "../slid/frameAnalysis";

/**
 * A moldura do Scanner — e ela é de propósito diferente da do SliD.
 *
 * O SliD desenha colchetes de canto e fala de aula, sessão e momentos: é
 * acompanhamento contínuo. Aqui a linguagem é de **página**: um retângulo
 * fechado com cantos de folha, e um texto que fala de documento e recorte. Se
 * as duas parecessem a mesma coisa, o estudante não saberia qual das duas está
 * acontecendo — e elas fazem coisas opostas.
 */
export function DocumentFrame({
  region,
  confidence,
  videoRef,
}: {
  region: ContentBounds | null;
  confidence: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  const rect = useCoverRect(region, videoRef);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {rect && (
        <div
          className="absolute rounded-lg border-2 border-white/90 transition-all duration-200 ease-out"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        >
          {/* Cantos de folha: quatro esquadros por dentro da borda. */}
          {CANTOS.map(([v, h]) => (
            <span
              key={`${v}${h}`}
              className="absolute size-5 border-white"
              style={{
                [v]: -2,
                [h]: -2,
                borderTopWidth: v === "top" ? 4 : 0,
                borderBottomWidth: v === "bottom" ? 4 : 0,
                borderLeftWidth: h === "left" ? 4 : 0,
                borderRightWidth: h === "right" ? 4 : 0,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      <p className="absolute inset-x-0 bottom-[168px] mx-auto w-fit rounded-full bg-black/60 px-3.5 py-1.5 text-center text-[11.5px] font-medium text-white/90 backdrop-blur">
        {region
          ? confidence >= 0.85
            ? "Documento enquadrado — pode capturar"
            : "Documento encontrado — dá para ajustar depois"
          : "Aponte para a folha, com a mesa aparecendo em volta"}
      </p>
    </div>
  );
}

const CANTOS = [
  ["top", "left"],
  ["top", "right"],
  ["bottom", "left"],
  ["bottom", "right"],
] as const;

/**
 * A caixa em frações do quadro vira pixels na tela.
 *
 * A mesma conta do `object-cover` que a moldura do SliD faz: o visor mostra
 * menos do que o sensor entrega, e desenhar em cima do vídeo exige desfazer
 * esse recorte primeiro.
 */
function useCoverRect(
  region: ContentBounds | null,
  videoRef: React.RefObject<HTMLVideoElement | null>,
) {
  const [rect, setRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const quadro = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!region || !video) {
      setRect(null);
      return;
    }
    const medir = () => {
      const cw = video.clientWidth;
      const ch = video.clientHeight;
      const fw = video.videoWidth;
      const fh = video.videoHeight;
      if (!cw || !ch || !fw || !fh) return;
      const escala = Math.max(cw / fw, ch / fh);
      const largura = fw * escala;
      const altura = fh * escala;
      const ox = (cw - largura) / 2;
      const oy = (ch - altura) / 2;
      const left = ox + region.x * largura;
      const top = oy + region.y * altura;
      setRect({
        left,
        top,
        width: region.width * largura,
        height: region.height * altura,
      });
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(video);
    quadro.current = video;
    return () => ro.disconnect();
  }, [region, videoRef]);

  return rect;
}

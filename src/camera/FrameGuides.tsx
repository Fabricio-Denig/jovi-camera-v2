import { useEffect, useRef, useState } from "react";
import { aspectWindow, type AspectRatio } from "./aspect";

/**
 * O que a foto vai pegar, e as linhas de terços.
 *
 * A máscara é escurecimento e não corte: o visor continua mostrando tudo o que
 * a câmera vê, e o que está fora da proporção fica apagado. Esconder de vez
 * daria uma tela menor sem dizer por quê; apagado, dá para enquadrar contando
 * com o que está prestes a sair.
 */
export function FrameGuides({
  aspect,
  grid,
}: {
  aspect: AspectRatio;
  grid: boolean;
}) {
  // Ela se mede sozinha em vez de receber o tamanho de fora: quem chama leria
  // o ref do vídeo durante o render, quando ele ainda é nulo, e a máscara
  // nasceria com zero sem nada que a fizesse renascer depois.
  const caixa = useRef<HTMLDivElement>(null);
  const [tamanho, setTamanho] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () =>
      setTamanho({ width: el.clientWidth, height: el.clientHeight });
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Nas dimensões do visor, e não nas do sensor: esta máscara cobre a tela, e
  // a tela já é o recorte que o object-cover deixou. A conta do que a foto pega
  // no sensor é outra, e vive em photoWindow.
  const janela = aspectWindow(aspect, tamanho.width, tamanho.height);
  const cheia = janela.width >= 0.999 && janela.height >= 0.999;

  return (
    <div ref={caixa} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[8]">
      {!cheia && (
        <>
          <div
            className="absolute inset-x-0 top-0 bg-black/55 transition-all duration-300"
            style={{ height: `${janela.y * 100}%` }}
          />
          <div
            className="absolute inset-x-0 bottom-0 bg-black/55 transition-all duration-300"
            style={{ height: `${(1 - janela.y - janela.height) * 100}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-black/55 transition-all duration-300"
            style={{ width: `${janela.x * 100}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 bg-black/55 transition-all duration-300"
            style={{ width: `${(1 - janela.x - janela.width) * 100}%` }}
          />
        </>
      )}

      {grid && (
        <div
          className="absolute transition-all duration-300"
          style={{
            left: `${janela.x * 100}%`,
            top: `${janela.y * 100}%`,
            width: `${janela.width * 100}%`,
            height: `${janela.height * 100}%`,
          }}
        >
          {[1, 2].map((n) => (
            <span
              key={`v${n}`}
              className="absolute inset-y-0 w-px bg-white/25"
              style={{ left: `${(n * 100) / 3}%` }}
            />
          ))}
          {[1, 2].map((n) => (
            <span
              key={`h${n}`}
              className="absolute inset-x-0 h-px bg-white/25"
              style={{ top: `${(n * 100) / 3}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

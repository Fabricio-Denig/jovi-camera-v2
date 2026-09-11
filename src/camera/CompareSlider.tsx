import { useRef, useState } from "react";

/**
 * `PREVIEW AO VIVO` do `Filtros v2` (`333:169`): a comparação partida, com o
 * divisor arrastável e a alça de 30 px.
 *
 * É a última peça do wireframe que faltava, e a razão de ela ter ficado por
 * último é honesta: com a intensidade contínua funcionando, dava para comparar
 * arrastando de 0 a 100. Mas as duas coisas respondem a perguntas diferentes.
 * A intensidade pergunta "quanto"; isto pergunta "vale a pena?" — e responder
 * essa exige ver as duas versões **ao mesmo tempo**, não uma depois da outra.
 *
 * Duas cópias da mesma amostra, uma sem filtro e outra com, e a de cima
 * recortada por `clip-path`. Nenhuma decodificação a mais, nenhum canvas a
 * mais: é a imagem que a tira e o painel já usam, desenhada duas vezes.
 */
export function CompareSlider({
  amostra,
  filtroCss,
  mirrored,
}: {
  amostra: string;
  filtroCss: string;
  mirrored: boolean;
}) {
  /** Onde o divisor está, em porcentagem da largura. */
  const [posicao, setPosicao] = useState(50);
  const caixaRef = useRef<HTMLDivElement>(null);

  const mover = (clientX: number) => {
    const caixa = caixaRef.current?.getBoundingClientRect();
    if (!caixa || caixa.width === 0) return;
    const bruto = ((clientX - caixa.left) / caixa.width) * 100;
    setPosicao(Math.max(0, Math.min(100, bruto)));
  };

  return (
    <div>
      <div
        ref={caixaRef}
        className="relative aspect-[5/4] w-full touch-none select-none overflow-hidden rounded-xl bg-surface-2"
        /*
         * Ponteiro e não toque: `onPointerMove` cobre dedo, caneta e mouse com
         * um caminho só, e `setPointerCapture` mantém o arraste vivo quando o
         * dedo sai da caixa — sem isso, arrastar até a borda soltava o
         * divisor no meio do gesto.
         */
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          mover(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) mover(e.clientX);
        }}
      >
        {/* Depois: a cena com o filtro, por baixo e inteira. */}
        <img
          src={amostra}
          alt=""
          className="absolute inset-0 size-full object-cover"
          style={{
            filter: filtroCss === "none" ? undefined : filtroCss,
            transform: mirrored ? "scaleX(-1)" : undefined,
          }}
        />

        {/* Antes: a cena crua, recortada até o divisor. */}
        <img
          src={amostra}
          alt=""
          className="absolute inset-0 size-full object-cover"
          style={{
            clipPath: `inset(0 ${100 - posicao}% 0 0)`,
            transform: mirrored ? "scaleX(-1)" : undefined,
          }}
        />

        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_6px_rgba(0,0,0,0.5)]"
          style={{ left: `${posicao}%` }}
        />
        {/* A alça de 30 px do wireframe. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 flex size-[30px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[11px] font-bold text-black shadow-lg"
          style={{ left: `${posicao}%` }}
        >
          ‹›
        </span>

        <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-white backdrop-blur">
          Antes
        </span>
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-white backdrop-blur">
          Depois
        </span>
      </div>

      {/*
       * O mesmo divisor como `range`, e não só como arraste.
       *
       * Arrastar é o gesto que o wireframe desenha, mas um divisor que só
       * existe como arraste é inalcançável por teclado e invisível para
       * leitor de tela. Este controle move o mesmo estado.
       */}
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(posicao)}
        onChange={(e) => setPosicao(Number(e.target.value))}
        aria-label="Posição da comparação entre antes e depois"
        className="mt-1 h-9 w-full accent-[var(--color-accent)]"
      />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { CAMERA_FILTERS, applyFilter } from "./filters";
import { useFilterFavorites } from "./useFilterFavorites";

/**
 * A tira de filtros do rodapé: acesso rápido, sem sair do enquadramento.
 *
 * Ela convive com o painel completo (`FiltersSheet`) de propósito, porque as
 * duas respondem a momentos diferentes. A tira é para trocar durante a
 * captura, com a cena na frente e o dedo já perto do disparador. O painel é
 * para ajustar: intensidade, favoritos, efeitos.
 *
 * Favoritos vêm primeiro na tira — depois de "Nenhum", que fica fixo por ser
 * o ponto de partida. Com onze filtros no catálogo, "os rápidos" só continuam
 * rápidos se o que a pessoa mais usa não estiver atrás de sete outros.
 *
 * "Leitura" fura a fila mesmo sem estar favoritado: é o filtro que este
 * produto existe para justificar — um estudante fotografando quadro e slide
 * — e enterrá-lo na décima posição do catálogo seria escondê-lo de quem mais
 * precisa. Uma vez favoritado, ele já vem na leva de favoritos e este caso
 * nem entra em jogo.
 *
 * As miniaturas são uma amostra só, redesenhada com filtros de CSS diferentes,
 * e a amostra vem de fora — é a mesma que o painel usa. Catálogo inteiro em
 * <video> ao vivo disputaria a linha principal com a análise da aula.
 * Mostradas no máximo (100%), não na intensidade padrão: numa miniatura de
 * 56 px a diferença entre os onze precisa bater o olho, e é o painel — não a
 * tira — o lugar de ver como cada um fica na intensidade em uso.
 */
export function FilterStrip({
  amostra,
  active,
  onSelect,
  onOpenPanel,
  mirrored,
}: {
  /** Um quadro cru do visor, vindo da câmera. */
  amostra: string | null;
  active: string;
  onSelect: (id: string) => void;
  /** O caminho para o painel completo, na ponta da própria tira. */
  onOpenPanel: () => void;
  mirrored: boolean;
}) {
  const trilhoRef = useRef<HTMLDivElement>(null);
  /*
   * Com sete filtros já nem todos cabiam numa tela de 390px — "Quente" nascia
   * cortado. Com onze, a fileira crua seria pior ainda. Sem nenhuma pista, ela
   * parece terminar ali: o mesmo problema que os chips da Galeria tinham. O
   * degradê aparece só quando há mais filtro para o lado, e some quando o
   * toque chega ao fim.
   */
  const [temMaisADireita, setTemMaisADireita] = useState(false);

  const { favoritos } = useFilterFavorites();
  const filtrosOrdenados = useMemo(() => {
    const [nenhum, ...resto] = CAMERA_FILTERS;
    const favoritados = resto.filter((f) => favoritos.includes(f.id));
    const leituraJaEntrou = favoritados.some((f) => f.id === "leitura");
    const leitura = !leituraJaEntrou
      ? resto.filter((f) => f.id === "leitura")
      : [];
    const outros = resto.filter(
      (f) => !favoritos.includes(f.id) && f.id !== "leitura",
    );
    return [nenhum, ...favoritados, ...leitura, ...outros];
  }, [favoritos]);

  useEffect(() => {
    const el = trilhoRef.current;
    if (!el) return;
    const medir = () => setTemMaisADireita(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", medir);
      ro.disconnect();
    };
  }, []);

  return (
    /*
     * A lista rola; a porta para o painel não.
     *
     * Ela já esteve dentro da rolagem, no fim da fila, e ali ficava fora da
     * tela: com sete filtros a 390 px, "Mais" nascia invisível, e uma porta que
     * só aparece depois de arrastar não é uma porta.
     */
    <div className="pointer-events-auto flex w-full items-start gap-2 pr-3">
      <div className="relative min-w-0 flex-1">
        <div
          ref={trilhoRef}
          className="flex items-start gap-2 overflow-x-auto py-0.5 pl-4 pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
        {filtrosOrdenados.map((filtro) => {
          const selecionado = filtro.id === active;
          return (
            <button
              key={filtro.id}
              type="button"
              onClick={() => onSelect(filtro.id)}
              aria-pressed={selecionado}
              aria-label={`Filtro ${filtro.label}`}
              className="shrink-0 transition-transform duration-150 active:scale-95"
            >
              <span
                /*
                 * 56×66, não 56×56: o Figma (`Camera inicial v2`, `298:136`)
                 * desenha a miniatura um pouco mais alta que larga — o
                 * mesmo card em pé que o painel completo usa (`FiltersSheet`,
                 * aspect-[80/96]). Quadrada, a tira lia como um teclado de
                 * ícones; a proporção vertical lê como carretel de filme.
                 */
                className={`block h-[66px] w-14 overflow-hidden rounded-xl border-2 bg-black/40 transition-colors ${
                  selecionado ? "border-white" : "border-white/25"
                }`}
              >
                {amostra && (
                  <img
                    src={amostra}
                    alt=""
                    className="size-full object-cover"
                    style={{
                      // A miniatura mostra o filtro no máximo: onze cards
                      // parecidos com nomes diferentes não ajudam ninguém a
                      // escolher antes de tocar.
                      filter: (() => {
                        const css = applyFilter(filtro.id, 100);
                        return css === "none" ? undefined : css;
                      })(),
                      transform: mirrored ? "scaleX(-1)" : undefined,
                    }}
                  />
                )}
              </span>
              <span
                className={`mt-1 block text-center text-[10px] font-medium ${
                  selecionado ? "text-white" : "text-white/65"
                }`}
              >
                {filtro.label}
              </span>
            </button>
          );
        })}
        </div>

        {/* Puramente visual — nunca intercepta o toque num filtro por baixo. */}
        {temMaisADireita && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/70 to-transparent"
          />
        )}
      </div>

      {/*
       * A porta do painel completo, encostada na tira e do tamanho de uma
       * miniatura. É onde a mão já está quando a tira não bastou — e é uma
       * interação que qualquer câmera tem, não uma inventada para justificar o
       * painel.
       */}
      <button
        type="button"
        onClick={onOpenPanel}
        aria-label="Abrir todos os filtros e efeitos"
        className="shrink-0 pt-0.5 transition-transform duration-150 active:scale-95"
      >
        <span className="flex h-[66px] w-14 items-center justify-center rounded-xl border-2 border-dashed border-white/35 bg-black/55 text-[19px] leading-none text-white/85 backdrop-blur">
          +
        </span>
        <span className="mt-1 block text-center text-[10px] font-medium text-white/65">
          Mais
        </span>
      </button>
    </div>
  );
}

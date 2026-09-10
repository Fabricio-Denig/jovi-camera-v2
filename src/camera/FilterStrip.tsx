import { CAMERA_FILTERS, DEFAULT_INTENSITY, applyFilter } from "./filters";

/**
 * A tira de filtros do rodapé: acesso rápido, sem sair do enquadramento.
 *
 * Ela convive com o painel completo (`FiltersSheet`) de propósito, porque as
 * duas respondem a momentos diferentes. A tira é para trocar durante a
 * captura, com a cena na frente e o dedo já perto do disparador. O painel é
 * para ajustar: intensidade, favoritos, efeitos.
 *
 * As miniaturas são uma amostra só, redesenhada com filtros de CSS diferentes,
 * e a amostra vem de fora — é a mesma que o painel usa. Sete <video> ao vivo
 * seriam sete decodificações disputando a linha principal com a análise da
 * aula.
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
  return (
    /*
     * A lista rola; a porta para o painel não.
     *
     * Ela já esteve dentro da rolagem, no fim da fila, e ali ficava fora da
     * tela: com sete filtros a 390 px, "Mais" nascia invisível, e uma porta que
     * só aparece depois de arrastar não é uma porta.
     */
    <div className="pointer-events-auto flex w-full items-start gap-2 pr-3">
      <div className="flex min-w-0 flex-1 items-start gap-2 overflow-x-auto py-0.5 pl-4 pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CAMERA_FILTERS.map((filtro) => {
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
                className={`block size-14 overflow-hidden rounded-xl border-2 bg-black/40 transition-colors ${
                  selecionado ? "border-white" : "border-white/25"
                }`}
              >
                {amostra && (
                  <img
                    src={amostra}
                    alt=""
                    className="size-full object-cover"
                    style={{
                      // A miniatura mostra o filtro na intensidade padrão:
                      // sete miniaturas iguais com nomes diferentes não
                      // ajudam ninguém a escolher antes de tocar.
                      filter: (() => {
                        const css = applyFilter(filtro.id, DEFAULT_INTENSITY);
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
        <span className="flex size-14 items-center justify-center rounded-xl border-2 border-dashed border-white/35 bg-black/55 text-[19px] leading-none text-white/85 backdrop-blur">
          +
        </span>
        <span className="mt-1 block text-center text-[10px] font-medium text-white/65">
          Mais
        </span>
      </button>
    </div>
  );
}

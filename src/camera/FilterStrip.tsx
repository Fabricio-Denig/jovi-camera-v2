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
    <div className="pointer-events-auto w-full">
      <div className="-mx-1 flex items-start gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        {/*
         * A porta do painel completo, no fim da tira e do tamanho de uma
         * miniatura. É onde a mão já está quando a tira não bastou — e é uma
         * interação que qualquer câmera tem, não uma inventada para justificar
         * o painel.
         */}
        <button
          type="button"
          onClick={onOpenPanel}
          aria-label="Abrir todos os filtros e efeitos"
          className="shrink-0 transition-transform duration-150 active:scale-95"
        >
          <span className="flex size-14 items-center justify-center rounded-xl border-2 border-dashed border-white/30 bg-black/40 text-[18px] leading-none text-white/80">
            +
          </span>
          <span className="mt-1 block text-center text-[10px] font-medium text-white/65">
            Mais
          </span>
        </button>
      </div>
    </div>
  );
}

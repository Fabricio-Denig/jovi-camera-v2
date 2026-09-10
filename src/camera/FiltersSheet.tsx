import { useMemo } from "react";
import {
  CAMERA_EFFECTS,
  CAMERA_FILTERS,
  applyFilter,
  findFilter,
} from "./filters";
import { useFilterFavorites } from "./useFilterFavorites";
import { BottomSheet } from "../shared/ui/BottomSheet";

/**
 * O painel completo de filtros, como no `Filtros v2` (`333:169`).
 *
 * Ele não substitui a tira do rodapé — os dois existem com funções
 * diferentes. A tira é acesso rápido durante a captura: não interrompe o
 * enquadramento e deixa comparar ao vivo. O painel é onde se ajusta:
 * intensidade, favoritos, efeitos, e a grade de cards que o Figma desenha.
 *
 * O que os une é o estado. Filtro e intensidade vivem na câmera, não aqui, e é
 * por isso que abrir e fechar o painel não perde nada — e que a foto sai com
 * exatamente a mesma aparência que o visor mostrava.
 */
export function FiltersSheet({
  open,
  filterId,
  intensity,
  effectId,
  amostra,
  onSelectFilter,
  onIntensity,
  onSelectEffect,
  onClose,
}: {
  open: boolean;
  filterId: string;
  intensity: number;
  effectId: string | null;
  /** Um quadro do visor, para os cards mostrarem a cena real. */
  amostra: string | null;
  onSelectFilter: (id: string) => void;
  onIntensity: (valor: number) => void;
  onSelectEffect: (id: string | null) => void;
  onClose: () => void;
}) {
  const { favoritos, alternar } = useFilterFavorites();
  const temIntensidade = filterId !== "nenhum";

  const cards = useMemo(
    () =>
      CAMERA_FILTERS.map((f) => ({
        filtro: f,
        // O card mostra o filtro na intensidade em uso quando é o escolhido, e
        // na cheia quando não é: comparar exige ver cada um no seu máximo.
        css: applyFilter(f.id, f.id === filterId ? intensity : 100),
      })),
    [filterId, intensity],
  );

  return (
    <BottomSheet open={open} title="Filtros" size="tall" onClose={onClose}>
      <p className="-mt-2 mb-4 text-[12px] text-ink-muted">
        Aplique ao vivo no visor
      </p>

      {/* Cards de 84×134 em 4 colunas, como no `333:169`. */}
      <ul className="mb-6 grid grid-cols-4 gap-2">
        {cards.map(({ filtro, css }) => {
          const escolhido = filtro.id === filterId;
          return (
            <li key={filtro.id} className="relative">
              <button
                type="button"
                aria-pressed={escolhido}
                onClick={() => onSelectFilter(filtro.id)}
                className={`w-full overflow-hidden rounded-xl border text-left transition-transform duration-150 active:scale-95 ${
                  escolhido ? "border-accent ring-1 ring-accent/60" : "border-line"
                }`}
              >
                <span className="block aspect-[80/96] w-full bg-surface-2">
                  {amostra && (
                    <img
                      src={amostra}
                      alt=""
                      className="size-full object-cover"
                      style={{ filter: css === "none" ? undefined : css }}
                    />
                  )}
                </span>
                <span className="block px-1.5 pb-1.5 pt-1">
                  <span className="block truncate text-[11.5px] font-medium text-ink">
                    {filtro.label}
                  </span>
                  <span className="block truncate text-[9.5px] text-ink-muted">
                    {filtro.hint}
                  </span>
                </span>
              </button>

              {/*
               * O selo do escolhido, como no `333:169`: um círculo de 20 px no
               * canto superior direito. A borda de destaque sozinha some numa
               * grade de quatro colunas vista de relance.
               */}
              {escolhido && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-1 top-1 flex size-5 animate-[slid-pop_260ms_ease-out] items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink"
                >
                  ✓
                </span>
              )}

              {/*
               * Favoritar sem escolher: a estrela não troca o filtro em uso.
               *
               * Ela fica embaixo, e não no canto de cima, porque lá mora o selo
               * do escolhido — dois círculos no mesmo canto viram um só, e o
               * dedo acertaria o errado.
               */}
              {filtro.id !== "nenhum" && (
                <button
                  type="button"
                  onClick={() => alternar(filtro.id)}
                  aria-label={
                    favoritos.includes(filtro.id)
                      ? `Desfavoritar ${filtro.label}`
                      : `Favoritar ${filtro.label}`
                  }
                  aria-pressed={favoritos.includes(filtro.id)}
                  className="absolute bottom-9 left-1 flex size-7 items-center justify-center rounded-full bg-black/55 text-[12px] text-white backdrop-blur transition-transform active:scale-90"
                >
                  <span
                    key={favoritos.includes(filtro.id) ? "on" : "off"}
                    className={
                      favoritos.includes(filtro.id) ? "animate-[slid-pop_300ms_ease-out]" : ""
                    }
                  >
                    {favoritos.includes(filtro.id) ? "★" : "☆"}
                  </span>
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/*
       * A intensidade, que é o que faltava para o filtro significar alguma
       * coisa. Ela some com "Nenhum" escolhido — intensidade de nada é zero
       * por definição, e um controle morto na tela é pior que nenhum.
       */}
      {temIntensidade && (
        <div className="mb-6">
          <label className="block">
            <span className="mb-2 flex items-center justify-between">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Intensidade
              </span>
              <span className="font-mono text-[13px] tabular-nums text-ink">
                {Math.round(intensity)}%
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={intensity}
              onChange={(e) => onIntensity(Number(e.target.value))}
              aria-label={`Intensidade do filtro ${findFilter(filterId).label}`}
              className="h-11 w-full accent-[var(--color-accent)]"
            />
          </label>
        </div>
      )}

      {/*
       * Efeitos numa seção própria, e não misturados com os filtros.
       *
       * Um filtro é uma escala contínua de cor; um efeito é uma camada. Pôr os
       * dois na mesma lista faria o controle de intensidade prometer, num
       * deles, algo que não significa nada.
       */}
      <h3 className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        Efeitos
      </h3>
      <p className="mb-2.5 -mt-1.5 text-[11.5px] leading-snug text-ink-muted/80">
        Não mudam a cor: acrescentam uma camada sobre a imagem.
      </p>
      <ul className="grid grid-cols-2 gap-2">
        {CAMERA_EFFECTS.map((efeito) => {
          const aceso = efeito.id === effectId;
          return (
            <li key={efeito.id}>
              <button
                type="button"
                aria-pressed={aceso}
                onClick={() => onSelectEffect(aceso ? null : efeito.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition-transform duration-150 active:scale-95 ${
                  aceso ? "border-accent bg-accent-soft" : "border-line bg-surface-2"
                }`}
              >
                <span className="block text-[12.5px] font-medium text-ink">
                  {efeito.label}
                </span>
                <span className="block text-[10px] text-ink-muted">
                  {efeito.hint}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {favoritos.length > 0 && (
        <>
          <h3 className="mb-2.5 mt-6 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Filtros favoritos
          </h3>
          <ul className="flex flex-wrap gap-2">
            {favoritos.map((id) => {
              const f = findFilter(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onSelectFilter(id)}
                    className={`min-h-10 rounded-full border px-3 text-[12px] font-medium transition-transform active:scale-95 ${
                      id === filterId
                        ? "border-accent bg-accent-soft text-ink"
                        : "border-line bg-surface-2 text-ink-muted"
                    }`}
                  >
                    ★ {f.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </BottomSheet>
  );
}

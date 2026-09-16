import { useMemo } from "react";
import {
  CAMERA_EFFECTS,
  CAMERA_FILTERS,
  FILTER_FAMILIES,
  applyFilter,
  findFilter,
} from "./filters";
import { CompareSlider } from "./CompareSlider";
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
  mirrored,
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
  /** A frontal é espelhada na tela; o card tem de mostrar o mesmo lado. */
  mirrored: boolean;
  onSelectFilter: (id: string) => void;
  onIntensity: (valor: number) => void;
  onSelectEffect: (id: string | null) => void;
  onClose: () => void;
}) {
  const { favoritos, alternar } = useFilterFavorites();
  const temIntensidade = filterId !== "nenhum";
  /*
   * Só favoritos que ainda existem. A lista vem do aparelho e pode ser de uma
   * versão anterior do app; sem esta peneira, um filtro que saiu da grade
   * voltaria como uma pílula "★ Nenhum" que troca o filtro em uso por nada.
   */
  const favoritosVivos = favoritos.filter((id) =>
    CAMERA_FILTERS.some((f) => f.id === id),
  );

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
  /*
   * Onze filtros numa grade só é uma parede; agrupados por família (a mesma
   * separação de qualquer câmera de verdade — Natural, Cinema, P&B, Estudo)
   * viram um catálogo que dá para varrer com os olhos.
   */
  const porFamilia = useMemo(
    () =>
      FILTER_FAMILIES.map((familia) => ({
        familia,
        cards: cards.filter((c) => c.filtro.family === familia.id),
      })).filter((grupo) => grupo.cards.length > 0),
    [cards],
  );

  return (
    <BottomSheet open={open} title="Filtros" size="tall" onClose={onClose}>
      <p className="-mt-2 mb-4 text-[12px] text-ink-muted">
        Aplique ao vivo no visor
      </p>

      {/*
       * Intensidade e comparação vêm ANTES da grade, não depois dela.
       *
       * Com onze filtros agrupados em quatro famílias, a grade sozinha já
       * passa da altura da tela — quem escolhia um filtro (na tira, antes de
       * abrir o painel) tinha de rolar por cima de duas ou três famílias
       * inteiras só para achar o controle que ajusta o que acabou de
       * escolher. Uma câmera de verdade não esconde o dial de intensidade
       * atrás do catálogo.
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
       * `PREVIEW AO VIVO` do wireframe: as duas versões ao mesmo tempo.
       *
       * Ele só aparece quando há filtro escolhido **e** amostra: comparar
       * "Nenhum" com "Nenhum" é uma tela que não responde nada, e sem amostra
       * seriam dois retângulos cinza. Sempre visível quando os dois existem —
       * nunca um gesto escondido (segurar, arrastar de canto) que ninguém
       * descobre sem alguém apontar.
       */}
      {temIntensidade && amostra && (
        <div className="mb-6">
          <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Antes e depois
          </h3>
          <CompareSlider
            amostra={amostra}
            filtroCss={applyFilter(filterId, intensity)}
            mirrored={mirrored}
          />
        </div>
      )}

      {/*
       * 3 colunas, não 4: o wireframe (`333:169`) desenha cards de 84×134 —
       * proporção alta, quase o dobro de altura da largura — porque tinha só
       * sete filtros a mostrar de uma vez. Com onze, 4 colunas espremia cada
       * miniatura a ~78px de largura numa tela de 390px: pequena demais para
       * comparar cor e contraste entre filtros parecidos ("Suave" vs.
       * "Quente"), que é a decisão que este painel existe para apoiar. Um
       * seletor de filtro nativo (Câmera do iOS, Instagram) sempre usa
       * miniaturas grandes o bastante para ver a cena nelas — 3 colunas dá
       * ~104px de largura, quase 35% maior, sem perder linhas de rolagem
       * extra (dois filtros a menos por fileira, é só isso).
       */}
      {porFamilia.map(({ familia, cards: cardsDaFamilia }, index) => (
        <div
          key={familia.id}
          // Régua fina entre famílias, a partir da segunda: com onze filtros em
          // quatro grupos, o rótulo em maiúsculas sozinho não bastava para o
          // olho notar a troca de família rolando rápido — a régua faz o
          // catálogo ler como catálogo, com seções, não como uma grade só.
          className={`mb-6 ${index > 0 ? "border-t border-line pt-5" : ""}`}
        >
          <h3 className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {familia.label}
          </h3>
          <ul className="grid grid-cols-3 gap-2.5">
            {cardsDaFamilia.map(({ filtro, css }) => {
          const escolhido = filtro.id === filterId;
          return (
            <li key={filtro.id} className="relative">
              <button
                type="button"
                aria-pressed={escolhido}
                onClick={() => onSelectFilter(filtro.id)}
                /*
                 * Um destaque fino no alto, por dentro da borda: sobre o fundo
                 * quase preto do app uma sombra escura não pinta nada (só a
                 * borda já existente aparecia), e este catálogo de onze cards
                 * precisa de alguma dimensão para não ler como uma grade plana
                 * de miniaturas iguais.
                 */
                className={`w-full overflow-hidden rounded-xl border text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] transition-transform duration-150 active:scale-95 ${
                  escolhido ? "border-accent ring-1 ring-accent/60" : "border-line"
                }`}
              >
                <span className="block aspect-[80/96] w-full bg-surface-2">
                  {amostra && (
                    <img
                      src={amostra}
                      alt=""
                      className="size-full object-cover"
                      style={{
                        filter: css === "none" ? undefined : css,
                        transform: mirrored ? "scaleX(-1)" : undefined,
                      }}
                    />
                  )}
                </span>
                <span className="block px-2 pb-2 pt-1.5">
                  <span className="block truncate text-[12.5px] font-medium text-ink">
                    {filtro.label}
                  </span>
                  <span className="block truncate text-[10.5px] text-ink-muted">
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
                  /*
                   * O alvo tem 36 px; o círculo visível continua com 28. Um
                   * botão de 28×28 é pequeno demais para um dedo — e crescer o
                   * círculo cobriria metade da miniatura, que é justamente o
                   * que o card existe para mostrar. O alvo cresce por fora.
                   */
                  className="absolute bottom-7 left-0 flex size-9 items-center justify-center transition-transform active:scale-90"
                >
                  <span
                    className="flex size-7 items-center justify-center rounded-full bg-black/55 text-[12px] text-white backdrop-blur"
                  >
                    <span
                      key={favoritos.includes(filtro.id) ? "on" : "off"}
                      className={
                        favoritos.includes(filtro.id)
                          ? "animate-[slid-pop_300ms_ease-out]"
                          : ""
                      }
                    >
                      {favoritos.includes(filtro.id) ? "★" : "☆"}
                    </span>
                  </span>
                </button>
              )}
            </li>
          );
            })}
          </ul>
        </div>
      ))}

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

      {favoritosVivos.length > 0 && (
        <>
          <h3 className="mb-2.5 mt-6 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Filtros favoritos
          </h3>
          <ul className="flex flex-wrap gap-2">
            {favoritosVivos.map((id) => {
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

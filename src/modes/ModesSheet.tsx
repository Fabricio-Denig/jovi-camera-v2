import { useMemo, useState } from "react";
import {
  SECTION_LABELS,
  SECTION_ORDER,
  getMode,
  searchModes,
  type CameraMode,
} from "./modes";
import { ModeIcon } from "./ModeIcon";
import { BottomSheet } from "../shared/ui/BottomSheet";

interface ModesSheetProps {
  open: boolean;
  activeModeId: string;
  /**
   * O modo que a câmera está recomendando agora, se houver.
   *
   * Vem do mesmo sinal que acende a pílula de sugestão no visor — não existe
   * detecção paralela para alimentar este painel. Quando é `null`, a seção de
   * sugestão simplesmente não existe: um painel que diz "lousa detectada"
   * apontado para uma parede é pior do que um painel calado.
   */
  suggestedModeId: string | null;
  onSelect: (modeId: string) => void;
  onClose: () => void;
}

/**
 * O catálogo de modos, na forma que o Figma (`Modos v2`, `337:443`) desenha:
 * um painel sobre a câmera com os modos em cards de grade, e não uma lista.
 *
 * A grade não é só estética. Numa lista, dezesseis modos são dezesseis linhas
 * de texto que se leem uma a uma; em cards com ícone, o olho varre a tela e
 * para no que reconhece. É a diferença entre procurar e encontrar.
 *
 * O trabalho de descoberta que a lista fazia continua: a busca casa com o jeito
 * que as pessoas nomeiam as coisas ("escuro", "documento"), e o card diz a que
 * ponto o modo é real. O que sai é o texto de "quando usar", que não cabe num
 * card de 105×113 — ele volta no cartão de prévia, ao escolher o modo.
 */
export function ModesSheet({
  open,
  activeModeId,
  suggestedModeId,
  onSelect,
  onClose,
}: ModesSheetProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchModes(query), [query]);
  const searching = query.trim().length > 0;
  const sugerido = suggestedModeId ? getMode(suggestedModeId) : null;

  return (
    <BottomSheet
      open={open}
      title="Todos os modos"
      onClose={onClose}
      size="tall"
    >
      {/* Campo de busca do Figma: 357×31 em x=27. */}
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Busque um modo da câmera…"
        aria-label="Buscar modo"
        className="mb-5 h-[38px] w-full rounded-xl border border-line bg-surface-2 px-3.5 text-[13.5px] text-ink placeholder:text-ink-muted/70 focus:border-accent focus:outline-none"
      />

      {searching ? (
        results.length > 0 ? (
          <ModeGrid modes={results} activeModeId={activeModeId} onSelect={onSelect} />
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-ink">Nenhum modo encontrado</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              Tente descrever a situação, como “pouca luz” ou “documento”.
            </p>
          </div>
        )
      ) : (
        <>
          {sugerido && (
            <section className="mb-6">
              <SectionTitle>Sugeridos agora</SectionTitle>
              <SuggestedCard
                mode={sugerido}
                active={sugerido.id === activeModeId}
                onSelect={() => onSelect(sugerido.id)}
              />
            </section>
          )}

          {SECTION_ORDER.map((section) => {
            // O modo já mostrado como sugestão não aparece duas vezes.
            const modes = results.filter(
              (mode) => mode.section === section && mode.id !== sugerido?.id,
            );
            if (modes.length === 0) return null;
            return (
              <section key={section} className="mb-6">
                <SectionTitle>{SECTION_LABELS[section]}</SectionTitle>
                <ModeGrid
                  modes={modes}
                  activeModeId={activeModeId}
                  onSelect={onSelect}
                />
              </section>
            );
          })}
        </>
      )}
    </BottomSheet>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
      {children}
    </h3>
  );
}

/**
 * O card grande da seção de sugestão — 163×134 contra 105×113 dos outros.
 *
 * O tamanho é o argumento: quando a câmera está olhando para uma aula, o SliD
 * não é mais um modo entre dezesseis, é *o* modo. E o selo diz por que ele
 * está ali, com a leitura que a câmera acabou de fazer.
 */
function SuggestedCard({
  mode,
  active,
  onSelect,
}: {
  mode: CameraMode;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${mode.label} — sugerido agora`}
      className={`flex aspect-[163/134] w-[46%] min-w-[150px] flex-col items-start overflow-hidden rounded-2xl border p-3 text-left transition-transform duration-150 active:scale-[0.97] ${
        active ? "border-accent bg-accent-soft" : "border-accent/50 bg-accent-soft/50"
      }`}
    >
      <div className="flex w-full items-center gap-2">
        <span className="text-accent">
          <ModeIcon id={mode.id} />
        </span>
        <span className="text-[14px] font-semibold text-ink">{mode.label}</span>
      </div>
      {/*
       * O Figma escreve "Lousa detectada". O app diz "Aula detectada", e essa
       * é a palavra certa: o mesmo sinal reconhece lousa, slide projetado,
       * caderno e folha. Chamar tudo de lousa seria estreitar o produto num
       * selo — e contradizer a pílula do visor, que vem do mesmo sinal.
       */}
      <span className="mt-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-ink">
        Aula detectada
      </span>
      <p className="mt-1.5 line-clamp-3 text-[10.5px] leading-snug text-ink-muted">
        {mode.summary}
      </p>
    </button>
  );
}

function ModeGrid({
  modes,
  activeModeId,
  onSelect,
}: {
  modes: CameraMode[];
  activeModeId: string;
  onSelect: (id: string) => void;
}) {
  // 3 colunas de 105×113 com folga, como no `337:443`.
  return (
    <ul className="grid grid-cols-3 gap-2.5">
      {modes.map((mode) => (
        <li key={mode.id}>
          <ModeCard
            mode={mode}
            active={mode.id === activeModeId}
            onSelect={() => onSelect(mode.id)}
          />
        </li>
      ))}
    </ul>
  );
}

function ModeCard({
  mode,
  active,
  onSelect,
}: {
  mode: CameraMode;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      /*
       * `overflow-hidden` não é detalhe: com a altura fixa pela proporção do
       * Figma, uma descrição de três linhas transbordava o card e cobria o
       * vizinho — o card de Microfilme roubava o toque do de Vídeo. Um texto
       * que escapa do próprio card não é só feio, ele quebra o painel.
       */
      className={`flex aspect-[105/113] w-full flex-col items-start overflow-hidden rounded-2xl border p-2.5 text-left transition-transform duration-150 active:scale-[0.95] ${
        active ? "border-accent bg-accent-soft" : "border-line bg-surface-2"
      }`}
    >
      <span className={active ? "text-accent" : "text-ink"}>
        <ModeIcon id={mode.id} />
      </span>
      <span className="mt-1 line-clamp-1 w-full text-[11.5px] font-medium text-ink">
        {mode.label}
      </span>
      {/* Duas linhas, como no Figma: a terceira não cabe em 113 px de altura. */}
      <p className="mt-0.5 line-clamp-2 text-[9.5px] leading-[1.3] text-ink-muted">
        {mode.summary}
      </p>
      {/*
       * O selo de fidelidade fica: um card que parece igual aos outros e abre
       * uma explicação em vez de capturar é o "botão morto" que este painel
       * não pode ter. Dizer antes é mais honesto que explicar depois.
       */}
      {mode.fidelity !== "real" && (
        <span className="mt-auto shrink-0 rounded-full bg-white/10 px-1.5 py-px text-[8.5px] font-medium uppercase tracking-wide text-ink-muted">
          {mode.fidelity === "partial" ? "parcial" : "prévia"}
        </span>
      )}
    </button>
  );
}

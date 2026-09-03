import { useState } from "react";

interface SlidSuggestionProps {
  onAccept: () => void;
  onDismiss: () => void;
}

/**
 * A sugestão contextual — o momento pelo qual o produto inteiro argumenta.
 *
 * A forma vem do Figma: uma pílula de uma linha no alto, e não um cartão sobre
 * o rodapé. A pílula inteira é o botão de ativar, e o ✕ dentro dela é o de
 * dispensar; dispensar fica lembrado pela sessão, porque uma sugestão que volta
 * sozinha deixa de ser sugestão.
 *
 * Abaixo dela, o cartão que o Figma coloca ali: o que o SliD faz, em duas
 * linhas. Ele existe porque um nome de recurso sozinho é o que faz as pessoas
 * ignorarem recursos que teriam querido.
 */
export function SlidSuggestion({ onAccept, onDismiss }: SlidSuggestionProps) {
  const [expandido, setExpandido] = useState(false);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[max(16px,env(safe-area-inset-top))] z-30 flex flex-col items-center gap-2.5 px-4">
      <div className="pointer-events-auto flex animate-[slid-rise_240ms_ease-out] items-center gap-1 rounded-full bg-accent pl-3.5 pr-1.5 text-accent-ink shadow-lg">
        <span
          aria-hidden="true"
          className="size-2 shrink-0 animate-pulse rounded-full bg-accent-ink/85"
        />
        <button
          type="button"
          onClick={onAccept}
          // 44px de alvo, ainda que a pílula do Figma seja mais fina: o dedo
          // decide isto, não o desenho.
          className="min-h-11 whitespace-nowrap px-1 text-[12.5px] font-semibold transition-transform active:scale-95"
        >
          Aula detectada · ativar SliD
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dispensar sugestão"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-accent-ink/75 transition-transform active:scale-90 active:text-accent-ink"
        >
          ✕
        </button>
      </div>

      <div className="pointer-events-auto flex w-full max-w-sm animate-[slid-enter_280ms_ease-out_120ms_both] items-start gap-3 rounded-2xl bg-canvas/92 p-3 shadow-lg backdrop-blur">
        <span
          aria-hidden="true"
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"
        >
          <BoardIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-ink">
            SliD · Captura inteligente das aulas
          </p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-ink-muted">
            Captura automaticamente enquanto você assiste. Organiza por matéria.
          </p>
          {/* "Saiba mais" abre aqui mesmo, e não leva a lugar nenhum: durante
              uma aula, tirar o estudante da câmera para explicar a câmera é
              perder a aula que estava começando. */}
          {expandido && (
            <p className="mt-1.5 animate-[slid-enter_200ms_ease-out] text-[11.5px] leading-snug text-ink-muted">
              Você apoia o celular e assiste. O SliD guarda cada momento em que o
              quadro muda, e no fim entrega a aula em ordem, com o que
              reconheceu — sem você tocar em nada.
            </p>
          )}
          <button
            type="button"
            onClick={() => setExpandido((aberto) => !aberto)}
            className="mt-0.5 min-h-10 pr-3 text-[11.5px] font-semibold text-accent transition-transform active:scale-95"
          >
            {expandido ? "Mostrar menos" : "Saiba mais"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BoardIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="13" rx="1.5" />
      <path d="M12 17v3M8 8h8M8 12h5" />
    </svg>
  );
}

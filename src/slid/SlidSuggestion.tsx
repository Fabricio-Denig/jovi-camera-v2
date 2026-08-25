interface SlidSuggestionProps {
  onAccept: () => void;
  onDismiss: () => void;
}

/**
 * The contextual suggestion — the moment the whole product argues for.
 *
 * It says what it saw, what it offers and why that helps, because a feature
 * name alone is what makes people ignore features they would have wanted.
 * Dismissing is always available and is remembered for the session: a
 * suggestion that keeps coming back stops being a suggestion.
 */
export function SlidSuggestion({ onAccept, onDismiss }: SlidSuggestionProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-4 pt-[max(72px,calc(env(safe-area-inset-top)+56px))]">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-accent/40 bg-canvas/95 p-4 shadow-lg backdrop-blur">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <BoardIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink">
              Parece uma aula
            </p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">
              Deixe o celular apoiado e assista. O SliD acompanha o quadro e
              salva sozinho só o que for importante.
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dispensar sugestão"
            className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted active:opacity-60"
          >
            ✕
          </button>
        </div>

        <button
          type="button"
          onClick={onAccept}
          className="mt-3 min-h-11 w-full rounded-xl bg-accent py-3 text-[13px] font-medium text-accent-ink active:opacity-80"
        >
          Acompanhar esta aula
        </button>
      </div>
    </div>
  );
}

function BoardIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M12 17v3M8 20h8" />
    </svg>
  );
}

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
    // Anchored above the camera controls rather than over the viewfinder: a
    // card that covers the board it just recognised argues against itself, and
    // now it would also hide the frame drawn around that board.
    <div className="pointer-events-none absolute inset-x-0 bottom-[max(178px,calc(env(safe-area-inset-bottom)+178px))] z-20 flex justify-center px-4">
      {/* Three things, each said once: the frame on the board says what was
          recognised, this line says what that is worth, the button acts. The
          card used to repeat the recognition and explain it in three lines,
          which is how a suggestion turns into a paragraph nobody reads. */}
      <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-accent/40 bg-canvas/95 p-3 pl-4 shadow-lg backdrop-blur">
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink">
          O SliD acompanha e salva os momentos importantes.
        </p>

        <button
          type="button"
          onClick={onAccept}
          className="min-h-11 shrink-0 rounded-xl bg-accent px-4 text-[13px] font-medium text-accent-ink active:opacity-80"
        >
          Ativar
        </button>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dispensar sugestão"
          className="-mr-1 flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted active:opacity-60"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

interface MicPermissionPromptProps {
  onAllow: () => void;
  onSkip: () => void;
}

/**
 * O porquê, antes da caixa do sistema.
 *
 * Até aqui, entrar no SliD abria a caixa de permissão do navegador sem
 * nenhuma palavra do app antes dela — a primeira coisa que a pessoa via era
 * uma pergunta do Chrome, sem saber por quê nem para quê. Este cartão é a
 * frase que faltava, e as duas escolhas pesam o mesmo: recusar não trava o
 * SliD, só desliga o áudio — "See" e "Identify" seguem de pé.
 */
export function MicPermissionPrompt({
  onAllow,
  onSkip,
}: MicPermissionPromptProps) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-end justify-center bg-black/45 px-4 pb-[max(20px,env(safe-area-inset-bottom))] sm:items-center sm:pb-4">
      <div className="w-full max-w-sm animate-[slid-enter_220ms_ease-out] rounded-2xl bg-canvas p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
          >
            <MicGlyph />
          </span>
          <p className="text-[13.5px] leading-snug text-ink">
            O SliD pode registrar a explicação da aula e sincronizá-la aos
            seus momentos.
          </p>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="min-h-11 flex-1 rounded-xl bg-surface-2 text-[13px] font-medium text-ink transition-transform duration-150 active:scale-[0.98] active:opacity-70"
          >
            Continuar sem áudio
          </button>
          <button
            type="button"
            onClick={onAllow}
            className="min-h-11 flex-1 rounded-xl bg-accent text-[13px] font-medium text-accent-ink transition-transform duration-150 active:scale-[0.98] active:opacity-80"
          >
            Permitir áudio
          </button>
        </div>
      </div>
    </div>
  );
}

function MicGlyph() {
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
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4M9 22h6" />
    </svg>
  );
}

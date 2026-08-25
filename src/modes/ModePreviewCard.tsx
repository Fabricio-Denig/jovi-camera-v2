import type { CameraMode } from "./modes";

interface ModePreviewCardProps {
  mode: CameraMode;
  onBack: () => void;
}

/**
 * Explanatory state for a mode whose processing belongs to the phone, not the
 * browser — proprietary pipelines, sensor modes, real multi-frame stacking.
 *
 * Selecting one still has to answer: it says what the mode does, when to use
 * it, which controls it owns on a real device, and offers a way back. Being
 * honest about the boundary costs nothing here, because discovery — knowing
 * the feature exists and what it is for — is the problem this product set out
 * to solve.
 */
export function ModePreviewCard({ mode, onBack }: ModePreviewCardProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-4 pt-[max(72px,calc(env(safe-area-inset-top)+56px))]">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-line bg-canvas/95 p-4 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-ink">{mode.label}</h2>
          <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-semibold text-warn">
            prévia
          </span>
        </div>

        <p className="mt-2 text-[13px] leading-snug text-ink">{mode.summary}</p>
        <p className="mt-1.5 text-[12.5px] leading-snug text-ink-muted">
          {mode.whenToUse}
        </p>

        {mode.controls && mode.controls.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Controles do modo
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {mode.controls.map((control) => (
                <li
                  key={control}
                  className="rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] text-ink-muted"
                >
                  {control}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-3 text-[11.5px] leading-snug text-ink-muted/80">
          O processamento deste modo é do próprio aparelho. Aqui ele está
          navegável para demonstrar como seria encontrado e usado.
        </p>

        <button
          type="button"
          onClick={onBack}
          className="mt-3 min-h-11 w-full rounded-xl bg-surface-2 py-3 text-[13px] font-medium text-ink active:opacity-70"
        >
          Voltar para Foto
        </button>
      </div>
    </div>
  );
}

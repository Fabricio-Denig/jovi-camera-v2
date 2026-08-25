import { useEffect, type ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Base for every panel that slides over the viewfinder (modes, filters,
 * settings). The camera keeps running underneath, so the sheet never unmounts
 * the preview — it only covers part of it.
 *
 * Dismissal is deliberately redundant: backdrop tap, an explicit close button
 * and Escape. A judge exploring the prototype should never feel trapped in a
 * panel, which was a real problem in the Figma flow.
 */
export function BottomSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 size-full bg-black/50"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[78%] overflow-y-auto rounded-t-3xl border-t border-line bg-surface pb-[max(20px,env(safe-area-inset-bottom))]"
      >
        <div className="sticky top-0 z-10 rounded-t-3xl bg-surface px-5 pb-3 pt-3">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/25" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
              {subtitle && (
                <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted active:opacity-70"
              aria-label="Fechar painel"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-5 pt-1">{children}</div>
      </div>
    </div>
  );
}

import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import { formatClock } from "../shared/lib/time";

interface MomentRowProps {
  atMs: number;
  label: string;
  detail: string | null;
  blob: Blob;
  onOpen?: () => void;
}

/**
 * One point on the class timeline.
 *
 * The same row serves the session that just ended and a class reopened weeks
 * later, so the two can never drift apart visually — what the student saw the
 * camera decide is what they find again.
 */
export function MomentRow({
  atMs,
  label,
  detail,
  blob,
  onOpen,
}: MomentRowProps) {
  const url = useObjectUrl(blob);

  const content = (
    <>
      <span
        aria-hidden="true"
        className="absolute left-0 top-2.5 size-[11px] rounded-full border-2 border-accent bg-canvas"
      />

      <div className="min-w-0 flex-1">
        <div className="font-mono text-[12px] tabular-nums text-accent">
          {formatClock(atMs)}
        </div>
        <h3 className="mt-0.5 text-[15px] font-medium text-ink">{label}</h3>
        {detail && (
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-muted">
            {detail}
          </p>
        )}
      </div>

      {/* The frame is evidence for the moment, not the subject of the row. */}
      <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
        {url && <img src={url} alt="" className="size-full object-cover" />}
      </div>
    </>
  );

  if (!onOpen) {
    return <article className="relative flex gap-3 pb-6 pl-6">{content}</article>;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir momento: ${label}`}
      className="relative flex w-full gap-3 pb-6 pl-6 text-left active:opacity-70"
    >
      {content}
    </button>
  );
}

import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import { formatClock } from "../shared/lib/time";

interface MomentRowProps {
  atMs: number;
  label: string;
  detail: string | null;
  /** The kind of content, in one word — the class's own vocabulary. */
  category?: string | null;
  /** Set when the topic kept growing after it was first kept. */
  spanMs?: number | null;
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
  category,
  spanMs,
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
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] tabular-nums text-accent">
            {formatClock(atMs)}
          </span>
          {category && (
            <span className="rounded bg-accent/12 px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-accent">
              {category}
            </span>
          )}
        </div>
        <h3 className="mt-0.5 text-[15px] font-medium text-ink">{label}</h3>
        {detail && (
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-muted">
            {detail}
          </p>
        )}
        {/* A topic that kept growing says so: the frame kept is its fullest
            state, not the instant it started. */}
        {spanMs != null && spanMs >= 20000 && (
          <p className="mt-1 text-[11.5px] text-ink-muted/70">
            desenvolvido ao longo de {Math.round(spanMs / 60000) || 1} min
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

import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import type { ClassRecord } from "../slid/classes";

/**
 * A class as it is remembered: what it was called, what it was about, and
 * enough of the summary to recognise it without opening it.
 *
 * The frame is a thumbnail and stays small on purpose. A large image would
 * make this a photograph with a caption; the class is the thing, and the
 * photograph is evidence for it.
 */
export function ClassCard({
  record,
  onOpen,
}: {
  record: ClassRecord;
  onOpen: () => void;
}) {
  const url = useObjectUrl(record.moments[0]?.media.blob);
  const minutes = Math.round(record.durationMs / 60000);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir a aula ${record.subject}`}
      className="flex w-full gap-3.5 rounded-2xl bg-surface-2 p-3 text-left active:opacity-70"
    >
      <div className="size-[68px] shrink-0 overflow-hidden rounded-xl bg-canvas">
        {url && <img src={url} alt="" className="size-full object-cover" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <h2 className="min-w-0 flex-1 truncate text-[15.5px] font-medium text-ink">
            {record.subject}
          </h2>
          {record.favorite && (
            <span aria-label="Favorita" className="shrink-0 text-[13px] text-accent">
              ★
            </span>
          )}
        </div>

        {/* Matéria first: it is the one fact the student put there themselves. */}
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-ink-muted">
          {record.discipline && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">
              {record.discipline}
            </span>
          )}
          <span>{formatDate(record.savedAt)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {record.moments.length}{" "}
            {record.moments.length === 1 ? "momento" : "momentos"}
          </span>
          {minutes >= 1 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{minutes} min</span>
            </>
          )}
        </p>

        {/* The class's own sentence, never a generated stand-in. */}
        {record.overview && (
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-ink-muted/80">
            {record.overview}
          </p>
        )}
      </div>
    </button>
  );
}

export function formatDate(at: number): string {
  return new Date(at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

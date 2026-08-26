import { useCallback, useEffect, useState } from "react";
import { MomentRow } from "./MomentRow";
import { ClassReview } from "./ClassReview";
import { getClassById, renameClass, type ClassRecord } from "./classes";
import { KIND_NAMES, type ContentKind } from "./readContent";
import { formatClock } from "../shared/lib/time";

interface ClassPageProps {
  classId: string;
  onClose: () => void;
}

/**
 * Sua aula — the class as something you keep, not a session that ended.
 *
 * This is the screen that has to answer "quais foram os momentos importantes?"
 * weeks after the lecture. Everything on it was decided while the class was
 * happening and stored then; nothing is recomputed, nothing is re-read, and no
 * extracted text, confidence or processing state ever reaches the student.
 */
export function ClassPage({ classId, onClose }: ClassPageProps) {
  const [record, setRecord] = useState<ClassRecord | null | undefined>(undefined);
  /** Index of the moment being reviewed, or null when the timeline is showing. */
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    let active = true;
    void getClassById(classId).then((found) => {
      if (!active) return;
      setRecord(found);
      setName(found?.subject ?? "");
    });
    return () => {
      active = false;
    };
  }, [classId]);

  // The name is committed when the student leaves the field, not on every
  // keystroke: renaming rewrites every moment of the class.
  const commitName = useCallback(() => {
    const trimmed = name.trim();
    if (!record || !trimmed || trimmed === record.subject) return;
    setRecord({ ...record, subject: trimmed });
    void renameClass(record.id, trimmed);
  }, [name, record]);

  if (record === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas">
        <p className="text-sm text-ink-muted">Abrindo a aula…</p>
      </div>
    );
  }

  if (record === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas px-8 text-center">
        <p className="text-sm text-ink-muted">Esta aula não está mais salva.</p>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-xl bg-surface-2 px-5 text-sm text-ink active:opacity-70"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-canvas">
      <header className="border-b border-line px-5 pb-4 pt-[max(18px,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={commitName}
              aria-label="Nome da aula"
              placeholder="Nomear esta aula"
              className="-ml-1 mt-0.5 w-full rounded-lg bg-transparent px-1 text-[22px] font-semibold text-ink placeholder:text-ink-muted/60 focus:bg-surface-2 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar aula"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted active:opacity-70"
          >
            ✕
          </button>
        </div>

        {/* One quiet line instead of a block: the curation is context for the
            class, not the headline above it. */}
        <p className="mt-1 px-1 text-[13px] text-ink-muted">
          {formatDate(record.savedAt)} · {formatClock(record.durationMs)} de aula
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {record.moments.length === 0 ? (
          <p className="pt-8 text-center text-sm text-ink-muted">
            Esta aula não guardou nenhum momento.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {record.kinds.length > 0 && (
              <section>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  Conteúdo reconhecido
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {record.kinds.map(([kind, count]) => (
                    <span
                      key={kind}
                      className="rounded-full bg-accent/12 px-3 py-1.5 text-[12.5px] font-medium text-accent"
                    >
                      {count} {nameKind(kind, count)}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {record.topics.length > 0 && (
              <section className="rounded-2xl bg-surface-2 px-4 py-4">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  Nesta aula
                </h2>
                <ul className="mt-2.5 flex flex-col gap-1.5">
                  {record.topics.map((topic) => (
                    <li
                      key={topic}
                      className="flex gap-2 text-[14.5px] leading-snug text-ink"
                    >
                      <span aria-hidden="true" className="text-accent">
                        •
                      </span>
                      <span className="min-w-0 flex-1">{topic}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                {record.moments.length === 1
                  ? "1 momento capturado"
                  : `${record.moments.length} momentos capturados`}
              </h2>
              <ol className="relative">
            <span
              aria-hidden="true"
              className="absolute bottom-4 left-[5px] top-3 w-px bg-line"
            />
            {record.moments.map((moment, index) => (
              <li key={moment.media.id}>
                <MomentRow
                  atMs={moment.atMs}
                  label={moment.label}
                  detail={moment.detail}
                  blob={moment.media.blob}
                  onOpen={() => setReviewing(index)}
                />
              </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </div>

      {record.moments.length > 0 && (
        <footer className="border-t border-line px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={() => setReviewing(0)}
            className="min-h-11 w-full rounded-xl bg-accent py-3 text-sm font-medium text-accent-ink active:opacity-80"
          >
            Revisar a aula
          </button>
        </footer>
      )}

      {reviewing !== null && (
        <ClassReview
          record={record}
          startAt={reviewing}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
}

/** Stored kinds come back as plain strings; anything unknown simply says nothing. */
function nameKind(kind: string, count: number): string {
  const names = KIND_NAMES[kind as ContentKind];
  return names ? names[count === 1 ? 0 : 1] : "";
}

function formatDate(at: number): string {
  return new Date(at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

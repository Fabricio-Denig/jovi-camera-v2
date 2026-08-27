import { useEffect, useMemo, useState } from "react";
import { ClassTitle } from "./ClassTitle";
import { DisciplinePicker } from "./DisciplinePicker";
import { MomentRow } from "./MomentRow";
import {
  KIND_NAMES,
  KIND_TAGS,
  describeMoment,
  suggestSubject,
  summariseClass,
  summariseTopics,
  type ContentKind,
} from "./readContent";
import { useOcr } from "./useOcr";
import type { SlidCapture, SlidStats } from "./useSlidSession";

/**
 * A class always has a usable name. An empty field waiting on a reading that
 * may never come is a screen that looks broken; this one looks finished and
 * invites a correction.
 */
const UNTITLED = "Aula sem título";

/** What the session understood, ready to be stored as the class itself. */
export interface SavedClass {
  subject: string;
  /** Null when the student did not file it under anything. */
  discipline: string | null;
  moments: {
    id: string;
    label: string;
    detail: string | null;
    category: string | null;
    spanMs: number;
  }[];
  topics: string[];
  kinds: [string, number][];
  overview: string;
}

interface SlidSummaryProps {
  captures: SlidCapture[];
  stats: SlidStats;
  elapsedMs: number;
  onSave: (aula: SavedClass) => void;
  onDiscard: () => void;
}

/**
 * Resumo da aula — the screen the whole product argues for.
 *
 * It has to answer one question: did my class become study material? So it
 * leads with what the class was about and what was in it, and only then shows
 * the moments. A grid of photographs answers a different question, and answers
 * it worse.
 *
 * Nothing here is invented. The topics are lines the lecturer actually wrote;
 * the counts are structures the camera actually recognised. When the reading
 * comes back empty the sections disappear rather than filling with plausible
 * text that was never on the page — a convincing summary of a class that did
 * not happen is the worst thing this screen could do.
 */
export function SlidSummary({
  captures,
  stats,
  elapsedMs,
  onSave,
  onDiscard,
}: SlidSummaryProps) {
  const [subject, setSubject] = useState(UNTITLED);
  const [discipline, setDiscipline] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const ocr = useOcr();

  // Reading starts on its own: what it produces is part of the result, not a
  // feature the student has to ask for.
  useEffect(() => {
    if (ocr.status === "idle" && captures.length > 0) void ocr.run(captures);
  }, [ocr, captures]);

  const readByCapture = useMemo(() => {
    const map = new Map<string, { text: string; confidence: number }>();
    for (const page of ocr.pages)
      map.set(page.captureId, { text: page.text, confidence: page.confidence });
    return map;
  }, [ocr.pages]);

  // The class opens with a name it can keep. A reading that lands later fills
  // it in, but only while the student has not written their own — a title that
  // rewrites itself under the cursor is worse than one that never arrives.
  const suggested = useMemo(() => suggestSubject(ocr.pages), [ocr.pages]);
  const subjectValue = edited ? subject : suggested || subject;
  const topics = useMemo(() => summariseTopics(ocr.pages), [ocr.pages]);

  // Described once, here, and then stored: reopening the class must never
  // depend on reading the page again.
  const described = useMemo(
    () =>
      captures.map((capture, index) => ({
        capture,
        ...describeMoment(capture.reason, {
          text: readByCapture.get(capture.id)?.text,
          previousText:
            index > 0 ? readByCapture.get(captures[index - 1].id)?.text : undefined,
          confidence: readByCapture.get(capture.id)?.confidence,
          // Where the moment sits and whether the surface kept filling up —
          // the only things known about a page that would not read.
          position: index,
          total: captures.length,
          refined: capture.refinements > 0,
        }),
      })),
    [captures, readByCapture],
  );

  const kinds = useMemo(() => {
    const counts = new Map<ContentKind, number>();
    for (const { kind } of described) {
      if (kind) counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [described]);

  const minutes = Math.round(elapsedMs / 60000);

  const overview = useMemo(
    () =>
      summariseClass({
        moments: captures.length,
        durationMs: elapsedMs,
        headings: described
          .map((moment) => moment.heading)
          .filter((heading): heading is string => Boolean(heading)),
        kinds,
        discipline,
      }),
    [captures.length, elapsedMs, described, kinds, discipline],
  );

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-canvas">
      <header className="border-b border-line px-5 pb-4 pt-[max(18px,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
              Resumo da aula
            </p>
            {/* The title is the class itself, not a form field waiting at the
                bottom of the screen. */}
            <ClassTitle
              value={subjectValue}
              placeholder="Nomear esta aula"
              onChange={(next) => {
                setEdited(true);
                setSubject(next);
              }}
            />
          </div>
          <button
            type="button"
            onClick={() =>
              captures.length > 0 ? setDiscarding(true) : onDiscard()
            }
            aria-label="Descartar aula"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted active:opacity-70"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {captures.length === 0 ? (
          <p className="pt-8 text-center text-sm text-ink-muted">
            A aula terminou sem momentos relevantes. Deixe o celular apoiado
            apontando para o quadro ou o caderno e o SliD registra sozinho o que
            mudar.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {/* A aula em uma frase, montada só do que foi capturado. */}
            {overview && (
              <p className="text-[15px] leading-relaxed text-ink">{overview}</p>
            )}

            {/* Os números por trás dela. */}
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              {stats.skippedDuplicates > 0
                ? `A câmera olhou ${stats.skippedDuplicates} vezes em que nada tinha mudado e deixou passar.`
                : minutes < 1
                  ? "Menos de um minuto acompanhado."
                  : `${minutes} ${minutes === 1 ? "minuto" : "minutos"} acompanhados.`}
            </p>

            {/* 2. Do que a aula tratou — linhas que o professor escreveu. */}
            {topics.length > 0 && (
              <section className="rounded-2xl bg-surface-2 px-4 py-4">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  Nesta aula
                </h2>
                <ul className="mt-2.5 flex flex-col gap-1.5">
                  {topics.map((topic) => (
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

            {/* 3. O que a câmera reconheceu, por estrutura. */}
            {kinds.length > 0 && (
              <section>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  Conteúdo reconhecido
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {kinds.map(([kind, count]) => (
                    <span
                      key={kind}
                      className="rounded-full bg-accent/12 px-3 py-1.5 text-[12.5px] font-medium text-accent"
                    >
                      {count} {KIND_NAMES[kind][count === 1 ? 0 : 1]}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* 4. Os momentos, na ordem em que a aula aconteceu. */}
            <section>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Momentos capturados
              </h2>
              <ol className="relative">
                {/* The spine is what turns a list into a lecture. */}
                <span
                  aria-hidden="true"
                  className="absolute bottom-4 left-[5px] top-3 w-px bg-line"
                />
                {described.map(({ capture, label, detail, kind }, index) => (
                  <li
                    key={capture.id}
                    className="animate-[slid-enter_300ms_ease-out_both]"
                    style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                  >
                    <MomentRow
                      atMs={capture.atMs}
                      label={label}
                      detail={detail}
                      category={kind ? KIND_TAGS[kind] : null}
                      spanMs={capture.completedAtMs - capture.atMs}
                      blob={capture.blob}
                    />
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </div>

      {discarding && (
        <DiscardConfirm
          count={captures.length}
          onKeep={() => setDiscarding(false)}
          onDiscard={onDiscard}
        />
      )}

      <footer className="border-t border-line px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        {/* The matéria sits with the save button, because filing the class is
            part of saving it — not a setting to go looking for afterwards. */}
        {captures.length > 0 && (
          <div className="pb-3">
            <DisciplinePicker value={discipline} onChange={setDiscipline} />
          </div>
        )}
        {captures.length === 0 ? (
          // Saving nothing announced a class that does not exist. The only
          // honest action here is going back to the camera.
          <button
            type="button"
            onClick={onDiscard}
            className="min-h-11 w-full rounded-xl bg-surface-2 py-3 text-sm font-medium text-ink transition-transform duration-150 active:scale-[0.98] active:opacity-70"
          >
            Voltar para a câmera
          </button>
        ) : (
        <button
          type="button"
          onClick={() =>
            onSave({
              subject: subjectValue.trim() || UNTITLED,
              discipline,
              moments: described.map(({ capture, label, detail, kind }) => ({
                id: capture.id,
                label,
                detail,
                category: kind ? KIND_TAGS[kind] : null,
                spanMs: capture.completedAtMs - capture.atMs,
              })),
              topics,
              kinds: kinds.map(([kind, count]) => [kind, count]),
              overview,
            })
          }
          className="min-h-11 w-full rounded-xl bg-accent py-3 text-sm font-medium text-accent-ink transition-transform duration-150 active:scale-[0.98] active:opacity-80"
        >
          Salvar aula
        </button>
        )}
      </footer>
    </div>
  );
}

/**
 * Throwing away a class has no undo, and the control that does it is a small ✕
 * in the corner of the screen the student just watched fill up. During a live
 * demonstration one stray tap took every moment of the lesson with it.
 */
function DiscardConfirm({
  count,
  onKeep,
  onDiscard,
}: {
  count: number;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Descartar a aula"
      className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-8 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm animate-[slid-rise_220ms_ease-out] rounded-2xl bg-canvas p-5">
        <h2 className="text-[16px] font-semibold text-ink">
          Descartar esta aula?
        </h2>
        <p className="mt-1 text-[13px] leading-snug text-ink-muted">
          {count === 1
            ? "O momento guardado será perdido."
            : `Os ${count} momentos guardados serão perdidos.`}{" "}
          Não dá para desfazer.
        </p>
        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={onKeep}
            className="min-h-11 flex-1 rounded-xl bg-accent text-[13.5px] font-medium text-accent-ink transition-transform duration-150 active:scale-[0.98] active:opacity-80"
          >
            Manter a aula
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="min-h-11 flex-1 rounded-xl bg-surface-2 text-[13.5px] font-medium text-danger transition-transform duration-150 active:scale-[0.98] active:opacity-70"
          >
            Descartar
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { suggestSubject, summariseMoment } from "./readContent";
import { useOcr } from "./useOcr";
import { REASON_LABELS, type SlidCapture, type SlidStats } from "./useSlidSession";
import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import { formatClock } from "../shared/lib/time";

interface SlidSummaryProps {
  captures: SlidCapture[];
  stats: SlidStats;
  elapsedMs: number;
  onSave: (subject: string) => void;
  onDiscard: () => void;
}

/**
 * The class, as the camera followed it.
 *
 * Deliberately not a text or OCR screen. Reading the board happens quietly in
 * the background and only earns its place by naming each moment; the student
 * sees the lecture in order, with what the camera noticed at each point. The
 * feeling to protect is "I didn't have to remember to save anything".
 */
export function SlidSummary({
  captures,
  stats,
  elapsedMs,
  onSave,
  onDiscard,
}: SlidSummaryProps) {
  const [subject, setSubject] = useState("");
  const [edited, setEdited] = useState(false);
  const ocr = useOcr();

  // Reading starts on its own: the labels it produces are part of the result,
  // not a feature the student has to ask for.
  useEffect(() => {
    if (ocr.status === "idle" && captures.length > 0) void ocr.run(captures);
  }, [ocr, captures]);

  const textByCapture = useMemo(() => {
    const map = new Map<string, string>();
    for (const page of ocr.pages) map.set(page.captureId, page.text);
    return map;
  }, [ocr.pages]);

  // The class names itself from what was on the board; the student only
  // corrects it if it got it wrong.
  const suggested = useMemo(
    () => suggestSubject(ocr.pages),
    [ocr.pages],
  );
  const subjectValue = edited ? subject : (subject || suggested);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-canvas">
      <header className="border-b border-line px-5 pb-4 pt-[max(20px,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-ink">Sua aula</h1>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              {formatClock(elapsedMs)} de aula ·{" "}
              {captures.length === 1
                ? "1 momento salvo"
                : `${captures.length} momentos salvos`}
            </p>
          </div>
          <button
            type="button"
            onClick={onDiscard}
            aria-label="Descartar aula"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted active:opacity-70"
          >
            ✕
          </button>
        </div>

        <CurationNote stats={stats} kept={captures.length} />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {captures.length === 0 ? (
          <p className="pt-8 text-center text-sm text-ink-muted">
            A aula terminou sem momentos relevantes. Deixe o celular apontado
            para o quadro e o SliD registra sozinho o que mudar.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {captures.map((capture, index) => (
              <li key={capture.id}>
                <MomentRow
                  capture={capture}
                  text={textByCapture.get(capture.id)}
                  previousText={
                    index > 0
                      ? textByCapture.get(captures[index - 1].id)
                      : undefined
                  }
                  reading={ocr.status === "running"}
                />
              </li>
            ))}
          </ol>
        )}
      </div>

      <footer className="border-t border-line px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <input
          value={subjectValue}
          onChange={(event) => {
            setEdited(true);
            setSubject(event.target.value);
          }}
          placeholder="Nome da aula"
          aria-label="Nome da aula"
          className="mb-2 min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-muted/70 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onSave(subjectValue.trim() || "Aula sem título")}
          className="min-h-11 w-full rounded-xl bg-accent py-3 text-sm font-medium text-accent-ink active:opacity-80"
        >
          Salvar aula
        </button>
      </footer>
    </div>
  );
}

/**
 * The curation, stated plainly. What makes the session valuable is not how much
 * it captured but how much it decided not to keep.
 */
function CurationNote({ stats, kept }: { stats: SlidStats; kept: number }) {
  if (stats.analysed === 0) return null;
  return (
    <div className="mt-3 rounded-xl bg-surface-2 px-3.5 py-2.5">
      <p className="text-[12.5px] leading-snug text-ink-muted">
        A câmera analisou{" "}
        <span className="text-ink">{stats.analysed} quadros</span> durante a
        aula e guardou <span className="text-ink">{kept}</span>.
        {stats.skippedDuplicates > 0 && (
          <>
            {" "}
            Descartou {stats.skippedDuplicates} repetidos para você não revisar
            a mesma coisa duas vezes.
          </>
        )}
      </p>
    </div>
  );
}

function MomentRow({
  capture,
  text,
  previousText,
  reading,
}: {
  capture: SlidCapture;
  text: string | undefined;
  previousText: string | undefined;
  reading: boolean;
}) {
  const url = useObjectUrl(capture.blob);
  const headline = text ? summariseMoment(text, previousText) : null;

  return (
    <article className="flex gap-3 rounded-2xl border border-line bg-surface-2 p-3">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-canvas">
        {url && <img src={url} alt="" className="size-full object-cover" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] text-accent">
            {formatClock(capture.atMs)}
          </span>
          <span className="text-[11.5px] text-ink-muted">
            {REASON_LABELS[capture.reason]}
          </span>
        </div>

        {headline ? (
          <p className="mt-1 line-clamp-3 text-[13.5px] leading-snug text-ink">
            {headline}
          </p>
        ) : reading ? (
          <p className="mt-1 text-[12.5px] text-ink-muted/70">lendo…</p>
        ) : null}
      </div>
    </article>
  );
}

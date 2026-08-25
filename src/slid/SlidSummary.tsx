import { useEffect, useMemo, useState } from "react";
import { describeMoment, suggestSubject } from "./readContent";
import { useOcr } from "./useOcr";
import type { SlidCapture, SlidStats } from "./useSlidSession";
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
 * A timeline, not a photo grid: what a student comes back for is the sequence
 * of the lecture, and each point on it says what the camera recognised. The
 * board is read quietly in the background and never shown as a transcript —
 * showing extracted text, OCR slips and all, is what makes a product read as a
 * scanner. The feeling to protect is "I didn't have to remember to save
 * anything".
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

  const suggested = useMemo(() => suggestSubject(ocr.pages), [ocr.pages]);
  const subjectValue = edited ? subject : subject || suggested;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-canvas">
      <header className="border-b border-line px-5 pb-4 pt-[max(18px,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
              Aula acompanhada
            </p>
            {/* The title is the class itself, not a form field waiting at the
                bottom of the screen. */}
            <input
              value={subjectValue}
              onChange={(event) => {
                setEdited(true);
                setSubject(event.target.value);
              }}
              placeholder={
                ocr.status === "running" ? "Identificando…" : "Nomear esta aula"
              }
              aria-label="Nome da aula"
              className="-ml-1 mt-0.5 w-full rounded-lg bg-transparent px-1 text-[22px] font-semibold text-ink placeholder:text-ink-muted/60 focus:bg-surface-2 focus:outline-none"
            />
            <p className="mt-1 px-1 text-[13px] text-ink-muted">
              {formatClock(elapsedMs)} de aula ·{" "}
              {captures.length === 1
                ? "1 momento importante"
                : `${captures.length} momentos importantes`}
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

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {captures.length === 0 ? (
          <p className="pt-8 text-center text-sm text-ink-muted">
            A aula terminou sem momentos relevantes. Deixe o celular apoiado
            apontando para o quadro e o SliD registra sozinho o que mudar.
          </p>
        ) : (
          <ol className="relative">
            {/* The spine is what turns a list into a lecture. */}
            <span
              aria-hidden="true"
              className="absolute bottom-4 left-[5px] top-3 w-px bg-line"
            />
            {captures.map((capture, index) => (
              <li key={capture.id}>
                <MomentEntry
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
    <p className="mt-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[12.5px] leading-snug text-ink-muted">
      A câmera acompanhou a aula inteira e guardou{" "}
      <span className="text-ink">{kept}</span>{" "}
      {kept === 1 ? "momento" : "momentos"}.
      {stats.skippedDuplicates > 0 && (
        <>
          {" "}
          Ignorou {stats.skippedDuplicates} vezes em que nada mudou, para você
          não revisar a mesma coisa duas vezes.
        </>
      )}
    </p>
  );
}

function MomentEntry({
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
  const { label, detail } = describeMoment(capture.reason, {
    text,
    previousText,
    ink: capture.ink,
  });

  return (
    <article className="relative flex gap-3 pb-6 pl-6">
      <span
        aria-hidden="true"
        className="absolute left-0 top-2.5 size-[11px] rounded-full border-2 border-accent bg-canvas"
      />

      <div className="min-w-0 flex-1">
        <div className="font-mono text-[12px] tabular-nums text-accent">
          {formatClock(capture.atMs)}
        </div>
        <h3 className="mt-0.5 text-[15px] font-medium text-ink">{label}</h3>
        {detail ? (
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-muted">
            {detail}
          </p>
        ) : reading ? (
          <p className="mt-0.5 text-[12.5px] text-ink-muted/60">
            identificando…
          </p>
        ) : null}
      </div>

      {/* The frame is evidence for the moment, not the subject of the row. */}
      <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
        {url && <img src={url} alt="" className="size-full object-cover" />}
      </div>
    </article>
  );
}

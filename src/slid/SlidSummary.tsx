import { useEffect, useMemo, useState } from "react";
import { buildReview } from "./buildReview";
import { useOcr } from "./useOcr";
import type { SlidCapture } from "./useSlidSession";
import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import { formatClock } from "../shared/lib/time";

interface SlidSummaryProps {
  captures: SlidCapture[];
  elapsedMs: number;
  onSave: (subject: string) => void;
  onDiscard: () => void;
}

type Tab = "capturas" | "texto" | "revisao";

const TAB_LABELS: Record<Tab, string> = {
  capturas: "Capturas",
  texto: "Texto",
  revisao: "Revisão",
};

/**
 * What the session produced — the half a single photo of a board never gives
 * you: captures in order, the text actually read off them, and a revision view
 * built from that text.
 */
export function SlidSummary({
  captures,
  elapsedMs,
  onSave,
  onDiscard,
}: SlidSummaryProps) {
  const [tab, setTab] = useState<Tab>("capturas");
  const [subject, setSubject] = useState("");
  const ocr = useOcr();

  const autoCount = captures.filter((capture) => capture.auto).length;
  const review = useMemo(() => buildReview(ocr.pages), [ocr.pages]);

  // Extraction starts when the user first asks to see the text, so a session
  // that is only being skimmed never pays for it.
  useEffect(() => {
    if ((tab === "texto" || tab === "revisao") && ocr.status === "idle") {
      void ocr.run(captures);
    }
  }, [tab, ocr, captures]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-canvas">
      <header className="border-b border-line px-5 pb-4 pt-[max(20px,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-ink">Sessão SliD</h1>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              {formatClock(elapsedMs)} · {captures.length}{" "}
              {captures.length === 1 ? "captura" : "capturas"}
              {autoCount > 0 && ` · ${autoCount} automáticas`}
            </p>
          </div>
          <button
            type="button"
            onClick={onDiscard}
            aria-label="Descartar sessão"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted active:opacity-70"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex gap-1 rounded-xl bg-surface-2 p-1">
          {(Object.keys(TAB_LABELS) as Tab[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`min-h-10 flex-1 rounded-lg py-2 text-[13px] ${
                tab === id
                  ? "bg-accent font-medium text-accent-ink"
                  : "text-ink-muted"
              }`}
            >
              {TAB_LABELS[id]}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {tab === "capturas" && <CapturesTab captures={captures} />}

        {(tab === "texto" || tab === "revisao") && ocr.status === "running" && (
          <ExtractionProgress progress={ocr.progress} />
        )}
        {(tab === "texto" || tab === "revisao") && ocr.status === "error" && (
          <ErrorState message={ocr.errorMessage} />
        )}

        {tab === "texto" && ocr.status === "done" && (
          <TextTab pages={ocr.pages} />
        )}
        {tab === "revisao" && ocr.status === "done" && (
          <ReviewTab review={review} />
        )}
      </div>

      <footer className="border-t border-line px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Nome da aula — Cálculo, Física…"
          aria-label="Nome da aula"
          className="mb-2 min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-muted/70 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onSave(subject.trim() || "Aula sem título")}
          className="min-h-11 w-full rounded-xl bg-accent py-3 text-sm font-medium text-accent-ink active:opacity-80"
        >
          Salvar na galeria
        </button>
      </footer>
    </div>
  );
}

function CapturesTab({ captures }: { captures: SlidCapture[] }) {
  if (captures.length === 0) {
    return (
      <p className="pt-8 text-center text-sm text-ink-muted">
        A sessão terminou sem capturas. Aponte para a lousa e o SliD registra
        cada mudança automaticamente.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2">
      {captures.map((capture) => (
        <li key={capture.id}>
          <CaptureThumb capture={capture} />
        </li>
      ))}
    </ul>
  );
}

function CaptureThumb({ capture }: { capture: SlidCapture }) {
  const url = useObjectUrl(capture.blob);
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-2">
      {url && <img src={url} alt="" className="size-full object-cover" />}
      <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1.5 font-mono text-[10px] text-white">
        {formatClock(capture.atMs)}
      </span>
      {capture.auto && (
        <span className="absolute right-1 top-1 rounded bg-accent px-1.5 text-[9px] font-semibold text-accent-ink">
          auto
        </span>
      )}
    </div>
  );
}

function ExtractionProgress({ progress }: { progress: number }) {
  return (
    <div className="pt-10 text-center">
      <div className="mx-auto h-1 w-40 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${Math.max(6, progress * 100)}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-ink">Lendo as capturas…</p>
      <p className="mt-1 text-[12.5px] text-ink-muted">
        O texto é extraído aqui no aparelho, sem enviar nada para fora.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string | null }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-5 text-center">
      <p className="text-sm text-ink">{message}</p>
    </div>
  );
}

function TextTab({ pages }: { pages: ReturnType<typeof useOcr>["pages"] }) {
  const withText = pages.filter((page) => page.text.length > 0);

  if (withText.length === 0) {
    return (
      <p className="pt-8 text-center text-sm text-ink-muted">
        Nenhum texto reconhecido nas capturas desta sessão.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {withText.map((page) => (
        <article
          key={page.captureId}
          className="rounded-2xl border border-line bg-surface-2 p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[11px] text-ink-muted">
              {formatClock(page.atMs)}
            </span>
            <span className="font-mono text-[11px] text-ink-muted">
              {Math.round(page.confidence)}% de confiança
            </span>
          </div>
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
            {page.text}
          </p>
        </article>
      ))}
      <button
        type="button"
        onClick={() =>
          void navigator.clipboard?.writeText(
            withText.map((page) => page.text).join("\n\n"),
          )
        }
        className="min-h-11 rounded-xl bg-surface-2 py-3 text-[13px] font-medium text-ink active:opacity-70"
      >
        Copiar todo o texto
      </button>
    </div>
  );
}

function ReviewTab({ review }: { review: ReturnType<typeof buildReview> }) {
  if (review.topics.length === 0) {
    return (
      <p className="pt-8 text-center text-sm text-ink-muted">
        Ainda não há texto suficiente para montar a revisão.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {review.keywords.length > 0 && (
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Termos recorrentes
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {review.keywords.map((keyword) => (
              <li
                key={keyword}
                className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] text-accent"
              >
                {keyword}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Linha do tempo da aula
        </h3>
        <ol className="flex flex-col gap-2">
          {review.topics.map((topic, index) => (
            <li
              key={index}
              className="rounded-2xl border border-line bg-surface-2 p-4"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] text-accent">
                  {formatClock(topic.atMs)}
                </span>
                <h4 className="min-w-0 flex-1 text-[14px] font-medium text-ink">
                  {topic.title}
                </h4>
              </div>
              {topic.points.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {topic.points.map((point, i) => (
                    <li key={i} className="text-[13px] text-ink-muted">
                      · {point}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </section>

      <p className="text-[11.5px] leading-snug text-ink-muted/80">
        Revisão montada no aparelho a partir do texto lido nas capturas —{" "}
        {review.lineCount} linhas, {Math.round(review.averageConfidence)}% de
        confiança média. Nada é inventado: tudo que aparece aqui foi lido da
        lousa.
      </p>
    </div>
  );
}

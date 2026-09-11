import { useState } from "react";
import type { ClassRecord } from "./classes";
import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import { formatClock } from "../shared/lib/time";
import { MicIcon } from "../listen/MicIcon";
import { legendaDaFala } from "../listen/speechInsights";
import type { TranscriptSegment } from "../shared/lib/mediaStore";

interface ClassReviewProps {
  record: ClassRecord;
  startAt: number;
  /** A fala da aula, para dizer o que estava sendo dito neste momento. */
  transcript?: TranscriptSegment[];
  onClose: () => void;
}

/**
 * Reviewing the class: one moment at a time, in the order the lecture happened.
 *
 * A grid asks the student to hunt; the class had a sequence and reviewing it
 * should follow that sequence. Each moment shows the frame and what the camera
 * recognised — the same label it decided during the class, never the raw OCR
 * output and never anything about how it was read.
 *
 * A linha de fala que entrou depois não é exceção a isso, e a diferença
 * importa: ela não é texto extraído de uma imagem, é uma frase que alguém
 * disse. Mostrar "o que estava sendo dito aqui" é contar a aula; mostrar o
 * despejo do reconhecimento de imagem seria mostrar o encanamento.
 */
export function ClassReview({
  record,
  startAt,
  transcript = [],
  onClose,
}: ClassReviewProps) {
  const [index, setIndex] = useState(
    Math.min(Math.max(startAt, 0), record.moments.length - 1),
  );
  const moment = record.moments[index];
  const url = useObjectUrl(moment.media.blob);
  /*
   * O que estava sendo dito quando este quadro foi guardado.
   *
   * Na revisão em tela cheia é onde a legenda vale mais: o estudante está
   * olhando uma imagem só, e a pergunta que ele tem é "o que estava
   * acontecendo aqui". A imagem responde metade; esta linha responde a outra
   * metade — e some quando não há resposta, em vez de inventar uma.
   */
  const legenda = legendaDaFala(transcript, moment.atMs);

  const atStart = index === 0;
  const atEnd = index === record.moments.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <header className="flex items-center justify-between gap-3 px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-white">
            {record.subject}
          </p>
          <p className="font-mono text-[11px] tabular-nums text-white/60">
            momento {index + 1} de {record.moments.length} ·{" "}
            {formatClock(moment.atMs)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar revisão"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white active:opacity-70"
        >
          ✕
        </button>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-3">
        {url && (
          <img
            src={url}
            alt={moment.label}
            className="max-h-full max-w-full rounded-xl object-contain"
          />
        )}
      </div>

      <footer className="px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-4">
        <h2 className="text-[17px] font-medium text-white">{moment.label}</h2>
        {moment.detail && (
          <p className="mt-1 text-[13.5px] leading-snug text-white/70">
            {moment.detail}
          </p>
        )}

        {legenda && (
          <p className="mt-2.5 flex gap-1.5 text-[12.5px] italic leading-snug text-white/55">
            <span className="mt-px text-accent">
              <MicIcon size={13} />
            </span>
            <span className="min-w-0 flex-1">{legenda}</span>
          </p>
        )}

        <div className="mt-4 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIndex((current) => current - 1)}
            disabled={atStart}
            className="min-h-11 flex-1 rounded-xl bg-white/10 text-sm font-medium text-white active:opacity-70 disabled:opacity-25"
          >
            Anterior
          </button>
          {atEnd ? (
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 flex-1 rounded-xl bg-accent text-sm font-medium text-accent-ink active:opacity-80"
            >
              Concluir revisão
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIndex((current) => current + 1)}
              className="min-h-11 flex-1 rounded-xl bg-accent text-sm font-medium text-accent-ink active:opacity-80"
            >
              Próximo
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

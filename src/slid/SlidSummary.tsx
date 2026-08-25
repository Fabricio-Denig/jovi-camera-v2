import { useState } from "react";
import { formatClock } from "../shared/lib/time";
import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import type { SlidCapture } from "./useSlidSession";

interface SlidSummaryProps {
  captures: SlidCapture[];
  elapsedMs: number;
  onSave: () => void;
  onDiscard: () => void;
}

type Tab = "imagens" | "texto" | "resumo";

/**
 * What the session produced. This is the half of SliD that a single photo of a
 * board never delivers: the captures stay tied to the session, in order, with
 * the moment each one happened.
 *
 * Text and summary are placeholders, and say so on screen. Running OCR and a
 * language model belongs to a later stage; claiming them now would be the one
 * thing that makes the whole demo untrustworthy.
 */
export function SlidSummary({
  captures,
  elapsedMs,
  onSave,
  onDiscard,
}: SlidSummaryProps) {
  const [tab, setTab] = useState<Tab>("imagens");
  const autoCount = captures.filter((c) => c.auto).length;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-canvas">
      <header className="border-b border-line px-5 pb-4 pt-[max(20px,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-3">
          <div>
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
          {(["imagens", "texto", "resumo"] as Tab[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`min-h-10 flex-1 rounded-lg py-2 text-[13px] capitalize ${
                tab === id
                  ? "bg-accent text-accent-ink font-medium"
                  : "text-ink-muted"
              }`}
            >
              {id === "resumo" ? "Resumo" : id}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {tab === "imagens" && <ImagesTab captures={captures} />}
        {tab === "texto" && <PlaceholderTab kind="texto" />}
        {tab === "resumo" && <PlaceholderTab kind="resumo" />}
      </div>

      <footer className="border-t border-line px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={onSave}
          className="w-full rounded-xl bg-accent py-3 text-sm font-medium text-accent-ink active:opacity-80"
        >
          Salvar na galeria
        </button>
      </footer>
    </div>
  );
}

function ImagesTab({ captures }: { captures: SlidCapture[] }) {
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
          <SummaryThumb capture={capture} />
        </li>
      ))}
    </ul>
  );
}

function SummaryThumb({ capture }: { capture: SlidCapture }) {
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

function PlaceholderTab({ kind }: { kind: "texto" | "resumo" }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-5">
      <span className="inline-block rounded-full bg-warn/15 px-2.5 py-1 text-[11px] font-semibold text-warn">
        ainda não implementado
      </span>
      <p className="mt-3 text-sm text-ink">
        {kind === "texto"
          ? "Extração de texto das capturas"
          : "Resumo da aula a partir do conteúdo capturado"}
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
        {kind === "texto"
          ? "O OCR roda no próprio dispositivo, sob demanda ao fim da sessão — nunca durante a aula, para não disputar processamento com a câmera."
          : "O resumo é gerado a partir do texto extraído, organizando as capturas em tópicos revisáveis."}
      </p>
    </div>
  );
}

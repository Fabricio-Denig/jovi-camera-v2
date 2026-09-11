import { useEffect, useState } from "react";
import { DOCUMENT_LOOKS, findLook } from "./appearance";
import { CROP_PADRAO, renderDocument } from "./renderDocument";
import { ExtractText } from "./ExtractText";
import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import type { ContentBounds } from "../slid/frameAnalysis";

/**
 * O documento recém-capturado, antes de virar arquivo.
 *
 * A tela existe por uma razão só: o recorte automático acerta a folha bem
 * enquadrada e erra o resto, e a resposta honesta a isso é deixar ajustar em
 * vez de fingir que acertou. Por isso a margem é um controle, e não um número
 * escondido — "detectei aproximadamente, confira" é uma promessa que dá para
 * cumprir; "recorte perfeito" não é.
 */
export function ScannerReview({
  foto,
  detectado,
  onSalvar,
  onRefazer,
}: {
  foto: Blob;
  /** A região que o detector achou, ou `null` quando não achou nada. */
  detectado: ContentBounds | null;
  onSalvar: (arquivo: Blob, aparencia: string, texto: string[]) => Promise<void>;
  onRefazer: () => void;
}) {
  const [lookId, setLookId] = useState("documento");
  const [margem, setMargem] = useState(0);
  const [salvando, setSalvando] = useState(false);
  /** O que o OCR leu, quando alguém pediu. Vai junto com o arquivo. */
  const [texto, setTexto] = useState<string[]>([]);
  const url = useObjectUrl(foto);
  const look = findLook(lookId);

  const base = detectado ?? CROP_PADRAO;
  const crop = comMargem(base, margem);

  // Escape volta para a câmera: nenhuma tela deste app prende ninguém.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onRefazer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onRefazer]);

  const salvar = async () => {
    if (salvando) return;
    setSalvando(true);
    try {
      const arquivo = await renderDocument(foto, crop, look.css);
      await onSalvar(arquivo, look.label, texto);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Revisar documento"
      className="absolute inset-0 z-50 flex flex-col bg-canvas"
    >
      <header className="flex items-center justify-between px-5 pb-2 pt-[max(16px,env(safe-area-inset-top))]">
        <h1 className="text-[17px] font-semibold text-ink">Documento</h1>
        <p className="text-[12px] text-ink-muted">
          {detectado ? "Recorte automático" : "Nenhuma folha detectada"}
        </p>
      </header>

      {/* O preview aplica a aparência por CSS: o arquivo só é gerado ao salvar. */}
      <div className="flex min-h-0 flex-1 items-center justify-center px-5">
        <div className="relative max-h-full overflow-hidden rounded-xl bg-surface-2">
          {url && (
            <img
              src={url}
              alt="Documento capturado"
              className="max-h-[52vh] w-auto"
              style={{
                filter: look.css === "none" ? undefined : look.css,
                clipPath: `inset(${crop.y * 100}% ${(1 - crop.x - crop.width) * 100}% ${
                  (1 - crop.y - crop.height) * 100
                }% ${crop.x * 100}%)`,
              }}
            />
          )}
        </div>
      </div>

      <div className="px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        {!detectado && (
          <p className="mb-3 rounded-xl bg-warn/15 px-3 py-2 text-[12px] leading-snug text-warn">
            Não consegui achar as bordas da folha. Recortei uma margem
            conservadora — ajuste abaixo se precisar.
          </p>
        )}

        <label className="mb-3 block">
          <span className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Margem do recorte
            <span className="font-mono text-[11px] normal-case tracking-normal">
              {margem > 0 ? `+${margem}` : margem}%
            </span>
          </span>
          <input
            type="range"
            min={-8}
            max={12}
            value={margem}
            onChange={(e) => setMargem(Number(e.target.value))}
            aria-label="Ajustar a margem do recorte"
            className="h-11 w-full accent-[var(--color-accent)]"
          />
        </label>

        <div role="radiogroup" aria-label="Aparência do documento" className="mb-4 flex gap-2">
          {DOCUMENT_LOOKS.map((opcao) => {
            const escolhido = opcao.id === lookId;
            return (
              <button
                key={opcao.id}
                type="button"
                role="radio"
                aria-checked={escolhido}
                onClick={() => setLookId(opcao.id)}
                className={`min-h-11 flex-1 rounded-xl border px-2 py-2 text-center transition-transform active:scale-95 ${
                  escolhido
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface-2"
                }`}
              >
                <span className="block text-[12.5px] font-medium text-ink">
                  {opcao.label}
                </span>
                <span className="mt-0.5 block text-[10px] leading-tight text-ink-muted">
                  {opcao.hint}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sob demanda e fora do caminho de salvar: quem só queria a foto da
            página não paga quatro megabytes de WASM por ela. */}
        <div className="mb-3">
          <ExtractText foto={foto} crop={crop} lookCss={look.css} onTexto={setTexto} />
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onRefazer}
            disabled={salvando}
            className="min-h-12 flex-1 rounded-xl bg-surface-2 text-[14px] font-medium text-ink active:opacity-70 disabled:opacity-40"
          >
            Refazer
          </button>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando}
            className="min-h-12 flex-1 rounded-xl bg-accent text-[14px] font-medium text-accent-ink active:opacity-80 disabled:opacity-60"
          >
            {salvando ? "Salvando…" : "Salvar na galeria"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A margem aperta ou afrouxa o recorte em torno do mesmo centro. */
function comMargem(base: ContentBounds, porcento: number): ContentBounds {
  const d = porcento / 100;
  const x = Math.max(0, Math.min(0.9, base.x - d));
  const y = Math.max(0, Math.min(0.9, base.y - d));
  return {
    x,
    y,
    width: Math.max(0.05, Math.min(1 - x, base.width + d * 2)),
    height: Math.max(0.05, Math.min(1 - y, base.height + d * 2)),
  };
}

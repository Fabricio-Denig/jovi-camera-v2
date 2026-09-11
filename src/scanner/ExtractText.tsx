import { useState } from "react";
import { lerImagem } from "../ocr/engine";
import { readableLines } from "../slid/readContent";
import { CopyButton } from "../slid/CopyButton";
import { renderDocument } from "./renderDocument";
import type { ContentBounds } from "../slid/frameAnalysis";

type Estado = "parado" | "lendo" | "leu" | "vazio" | "falhou";

/**
 * "Extrair texto" do Scanner — a fase 2 do modo Documento.
 *
 * **Sob demanda, e nunca antes.** São quatro megabytes de WASM e alguns
 * segundos de processador; puxar isso sozinho a cada folha capturada tornaria
 * o Scanner lento para quem só queria guardar uma foto da página. Quem precisa
 * do texto pede.
 *
 * **Não bloqueia salvar.** O documento pode ser guardado antes, durante ou
 * depois da leitura — ela é um extra sobre a captura, não uma etapa dela. Se
 * falhar, o documento continua salvo e a tela diz o que houve.
 *
 * **Lê a folha recortada e tratada, não o quadro cru.** A mesma imagem que
 * seria salva: o recorte tira a mesa de madeira em volta e a aparência
 * "Documento" levanta o contraste — as duas coisas que mais ajudam a leitura.
 * Ler o quadro inteiro devolveria as bordas da mesa como se fossem texto.
 */
export function ExtractText({
  foto,
  crop,
  lookCss,
}: {
  foto: Blob;
  crop: ContentBounds;
  lookCss: string;
}) {
  const [estado, setEstado] = useState<Estado>("parado");
  const [linhas, setLinhas] = useState<string[]>([]);
  const [progresso, setProgresso] = useState(0);

  const extrair = async () => {
    setEstado("lendo");
    setProgresso(0);
    try {
      const tratada = await renderDocument(foto, crop, lookCss);
      const { text, confidence } = await lerImagem(tratada, setProgresso);
      // A mesma peneira do SliD: o que não lê como língua nem como fórmula não
      // vira texto na tela. "ao do 20 grau LÁ" não ajuda ninguém a estudar.
      const lidas = readableLines(text, confidence, 40);
      setLinhas(lidas);
      setEstado(lidas.length > 0 ? "leu" : "vazio");
    } catch {
      setEstado("falhou");
    }
  };

  if (estado === "parado") {
    return (
      <button
        type="button"
        onClick={() => void extrair()}
        className="min-h-11 w-full rounded-xl border border-line bg-surface-2 text-[13.5px] font-medium text-ink transition-transform active:scale-[0.99]"
      >
        Extrair texto desta folha
      </button>
    );
  }

  if (estado === "lendo") {
    return (
      <div className="rounded-xl border border-line bg-surface-2 px-3 py-3">
        <p className="text-[13px] text-ink">Lendo a folha…</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${Math.round(progresso * 100)}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11.5px] text-ink-muted">
          O reconhecimento roda neste aparelho. Pode levar alguns segundos.
        </p>
      </div>
    );
  }

  if (estado === "vazio" || estado === "falhou") {
    return (
      <div className="rounded-xl border border-line bg-surface-2 px-3 py-3">
        <p className="text-[13px] leading-snug text-ink-muted">
          {estado === "vazio"
            ? "Não consegui ler texto nesta folha. Acontece com letra à mão, pouca luz e foco fora do papel."
            : "A leitura não terminou neste aparelho."}
        </p>
        {/* O documento não se perde por causa disto, e a tela diz. */}
        <p className="mt-1.5 text-[11.5px] text-ink-muted/75">
          A imagem continua inteira e pode ser salva normalmente.
        </p>
        <button
          type="button"
          onClick={() => void extrair()}
          className="mt-2.5 min-h-10 w-full rounded-lg bg-surface text-[12.5px] font-medium text-ink active:opacity-70"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3 py-3">
      <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        Texto da folha
      </h2>
      <ul className="mt-2 max-h-40 overflow-y-auto">
        {linhas.map((linha, i) => (
          <li
            key={`${i}-${linha}`}
            className="break-words py-0.5 text-[13px] leading-snug text-ink"
          >
            {linha}
          </li>
        ))}
      </ul>
      <div className="mt-2.5">
        <CopyButton texto={linhas.join("\n")} />
      </div>
    </div>
  );
}

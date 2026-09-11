import { useEffect, useState } from "react";
import { copyText } from "../shared/lib/clipboard";

type Estado = "parado" | "copiado" | "falhou";

/**
 * "Copiar texto" do `Resumo v2` (`339:649`, `340×39`).
 *
 * O botão diz o que aconteceu de verdade. A área de transferência falha em
 * contexto inseguro, por permissão negada e fora do gesto do usuário — e um
 * botão que diz "copiado" quando não copiou faz a pessoa colar o nada e
 * perceber depois, longe daqui.
 */
export function CopyButton({
  texto,
  rotulo = "Copiar texto",
}: {
  texto: string;
  rotulo?: string;
}) {
  const [estado, setEstado] = useState<Estado>("parado");

  useEffect(() => {
    if (estado === "parado") return;
    const t = setTimeout(() => setEstado("parado"), 2600);
    return () => clearTimeout(t);
  }, [estado]);

  const vazio = texto.trim().length === 0;

  return (
    <div>
      <button
        type="button"
        disabled={vazio}
        onClick={async () =>
          setEstado((await copyText(texto)) ? "copiado" : "falhou")
        }
        className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-medium transition-all duration-200 active:scale-[0.99] disabled:opacity-40 ${
          estado === "copiado"
            ? "bg-accent-soft text-accent"
            : "bg-surface-2 text-ink"
        }`}
      >
        <span aria-hidden="true">{estado === "copiado" ? "✓" : "⧉"}</span>
        {estado === "copiado" ? "Texto copiado" : rotulo}
      </button>
      {/* A falha é dita, e com o motivo mais provável — sem isso a pessoa toca
          de novo achando que errou o dedo. */}
      {estado === "falhou" && (
        <p role="status" className="mt-1.5 text-center text-[12px] text-warn">
          Não deu para copiar. Seu navegador pode estar bloqueando a área de
          transferência — o texto continua aqui para selecionar à mão.
        </p>
      )}
      {estado === "copiado" && (
        <p role="status" className="sr-only">
          Texto da aula copiado.
        </p>
      )}
    </div>
  );
}

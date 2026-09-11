import { useEffect, useState } from "react";
import { compartilharAula, podeCompartilhar, podeImprimir } from "./lessonSharing";
import type { ClassRecord } from "./classes";

/**
 * "Ações rápidas" do `Resumo v2` (`339:662`, `339:666`, `339:670`): três
 * cartões de `102×93`.
 *
 * A regra desta reta final está aplicada aqui literalmente: **cada cartão é
 * desenhado só se a ação existe neste navegador**. Compartilhar some onde não
 * há `navigator.share`; imprimir some onde não há `window.print`. Um cartão
 * bonito que responde com "não suportado" é pior que um espaço vazio — ele
 * promete na frente da banca e falha no aparelho.
 *
 * Sobre o terceiro cartão do wireframe, "Adicionar": ele não tem significado
 * definido no Figma, e inventar um seria criar um botão cenográfico. No lugar
 * dele vai a ação que a tela realmente precisa e que o wireframe não tem —
 * excluir a aula, que antes morava num ícone de lixeira sem rótulo.
 */
export function QuickActions({
  record,
  temAudio,
  onExcluir,
}: {
  record: ClassRecord;
  temAudio: boolean;
  onExcluir: () => void;
}) {
  const [compartilhando, setCompartilhando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3200);
    return () => clearTimeout(t);
  }, [aviso]);

  const temShare = podeCompartilhar();
  const temPrint = podeImprimir();

  return (
    <section>
      <h2 className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        Ações rápidas
      </h2>

      {/* Flex e não grade de três colunas fixas: onde o navegador não
          compartilha, sobrariam dois cartões encolhidos e uma coluna vazia. */}
      <div className="flex gap-2">
        {temPrint && (
          <Cartao
            icone="⇩"
            rotulo="Salvar PDF"
            onClick={() => {
              // A folha já está no documento, escondida. Imprimir a revela e
              // esconde o app — o PDF sai da aula, não da interface.
              window.print();
            }}
          />
        )}

        {temShare && (
          <Cartao
            icone="↗"
            rotulo="Compartilhar"
            ocupado={compartilhando}
            onClick={async () => {
              setCompartilhando(true);
              const r = await compartilharAula(record);
              setCompartilhando(false);
              // Cancelar é uma decisão normal, e não ganha aviso de erro.
              if (r === "falhou") setAviso("Não deu para compartilhar por aqui.");
            }}
          />
        )}

        <Cartao
          icone="🗑"
          rotulo="Excluir"
          suave
          onClick={onExcluir}
        />
      </div>

      {/* Onde nenhuma das duas existe, a tela diz o que dá para fazer em vez
          de simplesmente não ter nada. */}
      {!temShare && !temPrint && (
        <p className="mt-2 text-[12px] leading-snug text-ink-muted">
          Este navegador não oferece compartilhar nem imprimir. O texto da aula
          continua disponível no botão de copiar.
        </p>
      )}

      {temAudio && (
        <p className="mt-2 text-[11.5px] leading-snug text-ink-muted/75">
          A gravação não entra no PDF nem no compartilhamento — um documento não
          toca áudio. Ela continua guardada nesta aula.
        </p>
      )}

      {aviso && (
        <p role="status" className="mt-2 text-[12px] text-warn">
          {aviso}
        </p>
      )}
    </section>
  );
}

function Cartao({
  icone,
  rotulo,
  onClick,
  ocupado = false,
  suave = false,
}: {
  icone: string;
  rotulo: string;
  onClick: () => void;
  ocupado?: boolean;
  suave?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={ocupado}
      /* 102×93 no wireframe; aqui a largura vem da grade e a altura do
         conteúdo, para o cartão acompanhar a fonte do sistema. */
      className={`flex min-h-[84px] flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 transition-transform duration-150 active:scale-95 disabled:opacity-50 ${
        suave
          ? "border-line bg-surface-2 text-ink-muted"
          : "border-line bg-surface-2 text-ink"
      }`}
    >
      <span aria-hidden="true" className="text-[19px] leading-none">
        {ocupado ? "…" : icone}
      </span>
      <span className="text-[11.5px] font-medium">{rotulo}</span>
    </button>
  );
}

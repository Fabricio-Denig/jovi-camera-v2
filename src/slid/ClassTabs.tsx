/** As três abas do `Resumo v2` (`339:631-634`), em y=270 com trilho em y=294. */
export type ClassTab = "imagens" | "texto" | "resumo";

const ABAS: { id: ClassTab; label: string }[] = [
  { id: "imagens", label: "Imagens" },
  { id: "texto", label: "Texto" },
  /*
   * O wireframe chama esta aba de "Resumo IA". Aqui ela é "Resumo", e a
   * diferença não é estética.
   *
   * O app não chama nenhum modelo de linguagem: o que monta o resumo é OCR
   * local, classificação de estrutura pela forma da linha, e um título que
   * saiu de uma linha que o professor escreveu. Chamar isso de IA seria
   * prometer um processamento que não acontece — e a primeira pergunta de uma
   * banca sobre um rótulo desses é "qual modelo?".
   */
  { id: "resumo", label: "Resumo" },
];

export function ClassTabs({
  active,
  onSelect,
  counts,
}: {
  active: ClassTab;
  onSelect: (tab: ClassTab) => void;
  /** Quantos itens cada aba tem, para nenhuma abrir vazia sem avisar. */
  counts: Record<ClassTab, number>;
}) {
  return (
    <div
      role="tablist"
      aria-label="Conteúdo da aula"
      className="flex border-b border-line"
    >
      {ABAS.map((aba) => {
        const escolhida = aba.id === active;
        const vazia = counts[aba.id] === 0;
        return (
          <button
            key={aba.id}
            type="button"
            role="tab"
            id={`aba-${aba.id}`}
            aria-selected={escolhida}
            aria-controls={`painel-${aba.id}`}
            onClick={() => onSelect(aba.id)}
            className={`relative min-h-11 flex-1 px-2 pb-2.5 pt-1 text-[14px] font-medium transition-colors ${
              escolhida ? "text-ink" : vazia ? "text-ink-muted/45" : "text-ink-muted"
            }`}
          >
            {aba.label}
            {/* O indicador do `339:647`: 115 px sob a aba escolhida. */}
            <span
              aria-hidden="true"
              className={`absolute inset-x-3 -bottom-px h-0.5 rounded-full transition-opacity duration-200 ${
                escolhida ? "bg-accent opacity-100" : "opacity-0"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

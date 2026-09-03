export interface CameraFilter {
  id: string;
  label: string;
  /** O mesmo texto serve ao CSS do visor e ao `ctx.filter` da captura. */
  css: string;
}

/**
 * Os filtros da tira, como no Figma.
 *
 * São filtros de CSS e não processamento por quadro, e isso é a decisão inteira
 * deste recurso. Um laço de pixels sobre 30 quadros por segundo disputaria a
 * linha principal com a análise do SliD, que é a coisa que não pode perder. Um
 * `filter` de CSS é composto pela GPU e custa aproximadamente nada.
 *
 * E há uma consequência boa de graça: `drawImage` a partir de um <video> lê o
 * quadro cru, sem os filtros de CSS do elemento. Então o SliD continua
 * analisando exatamente o que a câmera entregou, mesmo com a tela em preto e
 * branco — a leitura da aula não muda porque o estudante gostou de um visual.
 */
export const CAMERA_FILTERS: CameraFilter[] = [
  { id: "nenhum", label: "Nenhum", css: "none" },
  { id: "vivid", label: "Vivid", css: "saturate(1.55) contrast(1.12)" },
  {
    id: "cinema",
    label: "Cinema",
    css: "contrast(1.22) saturate(0.82) sepia(0.16) brightness(0.95)",
  },
  { id: "suave", label: "Suave", css: "saturate(0.88) brightness(1.09) contrast(0.93)" },
  { id: "pb", label: "P&B", css: "grayscale(1) contrast(1.12)" },
  { id: "quente", label: "Quente", css: "sepia(0.34) saturate(1.25) brightness(1.04)" },
];

export const NO_FILTER = CAMERA_FILTERS[0];

export function findFilter(id: string): CameraFilter {
  return CAMERA_FILTERS.find((f) => f.id === id) ?? NO_FILTER;
}

/** Nem todo navegador desenha com filtro no canvas; a foto sai limpa se não der. */
export function canvasSupportsFilter(): boolean {
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return false;
    ctx.filter = "grayscale(1)";
    return ctx.filter === "grayscale(1)";
  } catch {
    return false;
  }
}

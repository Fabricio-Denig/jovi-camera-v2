/**
 * Filtros e efeitos da câmera.
 *
 * A distinção entre os dois é rígida de propósito, porque elas respondem a
 * perguntas diferentes:
 *
 * **Filtro** altera cor e aparência de forma contínua — Vivid, Cinema, Suave,
 * P&B, Quente, Leitura. Todo filtro tem intensidade, e a intensidade é o que
 * ele significa: metade de Vivid é meio caminho entre a cena crua e o Vivid
 * cheio.
 *
 * **Efeito** acrescenta uma transformação estilística que não é uma escala de
 * cor — Raio de sol, Tremor. Eles não moram na mesma lista nem se comportam
 * como filtros, e misturar os dois faria o controle de intensidade prometer
 * algo que não significa nada num deles.
 *
 * Toda a aparência sai de `applyFilter(id, intensity)`, e é essa string que
 * alimenta **tanto** o CSS do visor **quanto** o `ctx.filter` da captura. Um
 * caminho só: é o que impede o preview em 70 % e a foto salva em 100 %.
 *
 * São filtros de CSS e não processamento por quadro, e isso é a decisão
 * inteira deste recurso. Um laço de pixels sobre 30 quadros por segundo
 * disputaria a linha principal com a análise do SliD, que é a coisa que não
 * pode perder. Um `filter` de CSS é composto pela GPU e custa quase nada.
 *
 * E há uma consequência boa de graça: `drawImage` a partir de um <video> lê o
 * quadro cru, sem os filtros de CSS do elemento. Então o SliD continua
 * analisando exatamente o que a câmera entregou, mesmo com a tela em preto e
 * branco — a leitura da aula não muda porque o estudante gostou de um visual.
 */

/** Uma função de CSS e o valor que ela assume quando o filtro está cheio. */
interface FilterStep {
  fn: "saturate" | "contrast" | "brightness" | "sepia" | "grayscale" | "hue-rotate";
  /** O valor neutro da função — onde ela não faz nada. */
  from: number;
  /** O valor com o filtro em 100 %. */
  to: number;
  unit?: "deg";
}

export interface CameraFilter {
  id: string;
  label: string;
  /** A sublegenda do card, como no `Filtros v2`. */
  hint: string;
  steps: FilterStep[];
}

export const CAMERA_FILTERS: CameraFilter[] = [
  { id: "nenhum", label: "Nenhum", hint: "Original", steps: [] },
  {
    id: "vivid",
    label: "Vivid",
    hint: "Cores vivas",
    steps: [
      { fn: "saturate", from: 1, to: 1.55 },
      { fn: "contrast", from: 1, to: 1.12 },
    ],
  },
  {
    id: "cinema",
    label: "Cinema",
    hint: "Cores fortes",
    steps: [
      { fn: "contrast", from: 1, to: 1.22 },
      { fn: "saturate", from: 1, to: 0.82 },
      { fn: "sepia", from: 0, to: 0.16 },
      { fn: "brightness", from: 1, to: 0.95 },
    ],
  },
  {
    /*
     * O filtro que o `Filtros v2` tem e o app não tinha, e o que mais combina
     * com este produto: uma câmera de estudante apontada para texto.
     *
     * Ele tira a dominante de cor da luz ambiente — que é o que deixa toda
     * foto de folha amarelada — e levanta contraste, sem chegar a preto e
     * branco: um marcador amarelo continua sendo amarelo.
     *
     * A matemática é parente da aparência "Documento" do Scanner, e isso é de
     * propósito. Mas são coisas diferentes: Leitura é um filtro do visor, que
     * o estudante escolhe antes de capturar; Documento é o processamento de
     * uma captura já feita. Compartilham a conta, não a experiência.
     */
    id: "leitura",
    label: "Leitura",
    hint: "Clareza para texto",
    steps: [
      { fn: "saturate", from: 1, to: 0.55 },
      { fn: "contrast", from: 1, to: 1.42 },
      { fn: "brightness", from: 1, to: 1.12 },
    ],
  },
  {
    id: "suave",
    label: "Suave",
    hint: "Tom quente",
    steps: [
      { fn: "saturate", from: 1, to: 0.88 },
      { fn: "brightness", from: 1, to: 1.09 },
      { fn: "contrast", from: 1, to: 0.93 },
    ],
  },
  {
    id: "pb",
    label: "P&B",
    hint: "Sem cores",
    steps: [
      { fn: "grayscale", from: 0, to: 1 },
      { fn: "contrast", from: 1, to: 1.12 },
    ],
  },
  {
    id: "quente",
    label: "Quente",
    hint: "Luz dourada",
    steps: [
      { fn: "sepia", from: 0, to: 0.34 },
      { fn: "saturate", from: 1, to: 1.25 },
      { fn: "brightness", from: 1, to: 1.04 },
    ],
  },
];

export const NO_FILTER = CAMERA_FILTERS[0];
/** A intensidade com que um filtro entra quando é escolhido. */
export const DEFAULT_INTENSITY = 70;

export function findFilter(id: string): CameraFilter {
  return CAMERA_FILTERS.find((f) => f.id === id) ?? NO_FILTER;
}

/**
 * A aparência de um filtro numa intensidade, como texto de `filter` do CSS.
 *
 * Interpola cada função entre o seu valor neutro e o valor cheio. Em 0 % o
 * resultado é `none` — e é `none` mesmo, não uma lista de funções neutras,
 * porque o navegador atalha o caminho quando não há filtro nenhum.
 */
export function applyFilter(id: string, intensity: number): string {
  const filtro = findFilter(id);
  const t = Math.max(0, Math.min(100, intensity)) / 100;
  if (filtro.steps.length === 0 || t === 0) return "none";
  return filtro.steps
    .map((step) => {
      const valor = step.from + (step.to - step.from) * t;
      const n = step.unit === "deg" ? `${valor.toFixed(1)}deg` : valor.toFixed(3);
      return `${step.fn}(${n})`;
    })
    .join(" ");
}

/**
 * Os efeitos, que não são filtros.
 *
 * Eles vivem numa seção própria e não têm intensidade contínua no sentido dos
 * filtros — são camadas visuais sobre o visor. O `overlay` descreve o que
 * desenhar por cima; `motion` descreve um movimento do próprio elemento.
 *
 * Nenhum deles toca o quadro que o SliD analisa: `drawImage` a partir do
 * <video> lê o pixel cru, e um overlay é um irmão do vídeo, não um filtro
 * dele.
 */
export interface CameraEffect {
  id: string;
  label: string;
  hint: string;
  kind: "overlay" | "motion";
}

export const CAMERA_EFFECTS: CameraEffect[] = [
  {
    id: "raio-de-sol",
    label: "Raio de sol",
    hint: "Luz entrando de canto",
    kind: "overlay",
  },
  {
    id: "tremor",
    label: "Tremor",
    hint: "Câmera na mão",
    kind: "motion",
  },
];

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

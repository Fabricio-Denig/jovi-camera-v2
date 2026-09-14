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

/**
 * A família do filtro — como o catálogo se organiza no painel completo.
 *
 * Onze filtros numa grade só, sem seção nenhuma, é uma lista que ninguém
 * varre inteira. Agrupar por família é a diferença entre "um catálogo" e
 * "uma parede de cards parecidos" — a mesma razão por trás de qualquer
 * câmera de verdade separar Retrato de P&B de Cinema.
 */
export type CameraFilterFamily = "natural" | "cinema" | "pb" | "estudo";

export const FILTER_FAMILIES: { id: CameraFilterFamily; label: string }[] = [
  { id: "natural", label: "Natural" },
  { id: "cinema", label: "Cinema" },
  { id: "pb", label: "P&B" },
  { id: "estudo", label: "Estudo" },
];

export interface CameraFilter {
  id: string;
  label: string;
  /** A sublegenda do card, como no `Filtros v2`. */
  hint: string;
  family: CameraFilterFamily;
  steps: FilterStep[];
}

export const CAMERA_FILTERS: CameraFilter[] = [
  { id: "nenhum", label: "Nenhum", hint: "Original", family: "natural", steps: [] },
  {
    id: "vivid",
    label: "Vivid",
    hint: "Cores vivas",
    family: "natural",
    steps: [
      { fn: "saturate", from: 1, to: 1.55 },
      { fn: "contrast", from: 1, to: 1.12 },
    ],
  },
  {
    id: "suave",
    label: "Suave",
    hint: "Tom quente",
    family: "natural",
    steps: [
      { fn: "saturate", from: 1, to: 0.88 },
      { fn: "brightness", from: 1, to: 1.09 },
      { fn: "contrast", from: 1, to: 0.93 },
    ],
  },
  {
    id: "quente",
    label: "Quente",
    hint: "Luz dourada",
    family: "natural",
    steps: [
      { fn: "sepia", from: 0, to: 0.34 },
      { fn: "saturate", from: 1, to: 1.25 },
      { fn: "brightness", from: 1, to: 1.04 },
    ],
  },
  {
    // O oposto do Quente, na mesma família: onde um esquenta a luz ambiente,
    // o outro esfria — um `hue-rotate` pequeno em vez de um `sepia` negativo,
    // que não existe.
    id: "frio",
    label: "Frio",
    hint: "Tom azulado",
    family: "natural",
    steps: [
      { fn: "hue-rotate", from: 0, to: -9, unit: "deg" },
      { fn: "saturate", from: 1, to: 1.1 },
      { fn: "brightness", from: 1, to: 1.03 },
    ],
  },
  {
    id: "cinema",
    label: "Cinema",
    hint: "Cores fortes",
    family: "cinema",
    steps: [
      { fn: "contrast", from: 1, to: 1.22 },
      { fn: "saturate", from: 1, to: 0.82 },
      { fn: "sepia", from: 0, to: 0.16 },
      { fn: "brightness", from: 1, to: 0.95 },
    ],
  },
  {
    // Mais pesado que o Cinema: contraste alto e cor puxada para baixo, a
    // cara de trailer — não é o Cinema "mais forte", é outra decisão.
    id: "dramatico",
    label: "Dramático",
    hint: "Contraste alto",
    family: "cinema",
    steps: [
      { fn: "contrast", from: 1, to: 1.48 },
      { fn: "saturate", from: 1, to: 0.72 },
      { fn: "brightness", from: 1, to: 0.9 },
    ],
  },
  {
    // O contrário do Dramático: preto levantado, cor lavada — o visual de
    // filme vencido que "Fade" costuma significar em qualquer câmera.
    id: "desbotado",
    label: "Desbotado",
    hint: "Preto levantado",
    family: "cinema",
    steps: [
      { fn: "contrast", from: 1, to: 0.8 },
      { fn: "saturate", from: 1, to: 0.68 },
      { fn: "brightness", from: 1, to: 1.1 },
      { fn: "sepia", from: 0, to: 0.1 },
    ],
  },
  {
    id: "pb",
    label: "P&B",
    hint: "Sem cores",
    family: "pb",
    steps: [
      { fn: "grayscale", from: 0, to: 1 },
      { fn: "contrast", from: 1, to: 1.12 },
    ],
  },
  {
    // P&B com mais peso — sombra funda, o contrário do P&B plano de cima.
    id: "noir",
    label: "Noir",
    hint: "P&B dramático",
    family: "pb",
    steps: [
      { fn: "grayscale", from: 0, to: 1 },
      { fn: "contrast", from: 1, to: 1.6 },
      { fn: "brightness", from: 1, to: 0.9 },
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
    family: "estudo",
    /*
     * Ajustado depois de revisar contra slide, quadro, caderno e folha: o
     * contraste e o brilho de antes (1.42 / 1.12) estouravam qualquer fundo
     * já claro — um slide ou uma folha de papel já reflete perto do branco, e
     * empurrar os dois juntos apagava informação que ainda estava lá (uma
     * cor pastel de fundo, uma foto dentro do slide). Contraste mais contido
     * continua separando texto de fundo sem achatar tudo num branco só.
     */
    steps: [
      { fn: "saturate", from: 1, to: 0.55 },
      { fn: "contrast", from: 1, to: 1.28 },
      { fn: "brightness", from: 1, to: 1.05 },
    ],
  },
];

/**
 * A aparência do modo Comida, fora da lista de filtros de propósito.
 *
 * Ela não é uma oitava opção da tira: é o que **define** aquele modo, do mesmo
 * jeito que "nenhuma aparência" define o SliD. Pôr na tira faria o modo
 * Comida ser um modo que escolhe um filtro que já estava lá, e daria ao
 * `Filtros v2` uma opção que o wireframe não tem.
 *
 * A conta é a de qualquer modo de comida de celular, e não tem mistério: mais
 * saturação para a cor do prato, um empurrão de calor porque luz de
 * restaurante é amarela e a câmera compensa demais, e um pouco de contraste
 * para a textura aparecer. Nada aqui inventa pixel — é a mesma interpolação
 * dos outros filtros, aplicada ao visor e à foto pela mesma string.
 */
export const FOOD_LOOK: CameraFilter = {
  id: "comida",
  label: "Comida",
  hint: "Cor e textura do prato",
  // Nunca aparece na grade de filtros — a família aqui é só para o tipo
  // fechar; nada lê este campo fora da lista que o exclui de propósito.
  family: "natural",
  steps: [
    { fn: "saturate", from: 1, to: 1.42 },
    { fn: "contrast", from: 1, to: 1.14 },
    { fn: "sepia", from: 0, to: 0.12 },
    { fn: "brightness", from: 1, to: 1.05 },
  ],
};

export const NO_FILTER = CAMERA_FILTERS[0];
/** A intensidade com que um filtro entra quando é escolhido. */
export const DEFAULT_INTENSITY = 70;

export function findFilter(id: string): CameraFilter {
  if (id === FOOD_LOOK.id) return FOOD_LOOK;
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

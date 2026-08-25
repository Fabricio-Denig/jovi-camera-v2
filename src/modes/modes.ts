import type { CaptureKind } from "../types/camera";

/**
 * How faithfully a mode is reproduced in the browser.
 * Surfaced in the UI so a simulated mode never pretends to be the real thing —
 * the original Jovi camera already labels AI-processed shots, and inheriting
 * that honesty is cheaper than explaining it on stage.
 */
export type ModeFidelity = "real" | "partial" | "simulated";

export type ModeSection = "frequentes" | "criativos" | "avancados" | "ferramentas";

export interface CameraMode {
  id: string;
  label: string;
  /** One line on what it does — the "education in place" this product is built around. */
  summary: string;
  /** The situation that should make someone reach for it. */
  whenToUse: string;
  kind: CaptureKind;
  fidelity: ModeFidelity;
  section: ModeSection;
  /** Shown in the main mode bar rather than only inside the catalog. */
  pinned: boolean;
  /** Controls this mode owns on a real device, listed when it is only simulated. */
  controls?: string[];
  /** Extra terms that should match in search — how people actually name things. */
  aliases?: string[];
}

/**
 * The full mode inventory catalogued from the original Jovi camera, plus SliD.
 *
 * Every entry is reachable and answers to a tap. Modes we cannot genuinely
 * reproduce in a browser open an explanatory state instead of failing silently:
 * the point of the product is that a feature is discoverable and understood,
 * which does not require re-implementing proprietary processing.
 */
export const MODES: CameraMode[] = [
  {
    id: "photo",
    label: "Foto",
    summary: "Captura padrão, equilibrada para qualquer cena.",
    whenToUse: "O modo para o dia a dia, quando nada de especial é exigido.",
    kind: "photo",
    fidelity: "real",
    section: "frequentes",
    pinned: true,
  },
  {
    id: "video",
    label: "Vídeo",
    summary: "Grava vídeo com áudio no armazenamento do dispositivo.",
    whenToUse: "Para registrar movimento e som em vez de um instante.",
    kind: "video",
    fidelity: "real",
    section: "frequentes",
    pinned: true,
  },
  {
    id: "slid",
    label: "SliD",
    summary:
      "Acompanha a aula inteira e captura sozinho cada vez que a lousa muda.",
    whenToUse:
      "Em aula, palestra ou reunião com slides — você assiste, a câmera registra.",
    kind: "photo",
    fidelity: "partial",
    section: "frequentes",
    pinned: true,
    aliases: ["aula", "lousa", "quadro", "slide", "estudo", "see listen identify"],
  },
  {
    id: "portrait",
    label: "Retrato",
    summary: "Destaca a pessoa e suaviza o fundo.",
    whenToUse: "Fotos de pessoas, quando o fundo distrai mais do que ajuda.",
    kind: "photo",
    fidelity: "simulated",
    section: "frequentes",
    pinned: false,
    controls: ["Intensidade do desfoque", "Distância focal (23/35/50/85 mm)"],
    aliases: ["bokeh", "pessoa", "rosto", "desfoque"],
  },
  {
    id: "night",
    label: "Noite",
    summary: "Combina várias exposições para clarear cenas escuras.",
    whenToUse: "Ambientes com pouca luz, onde a foto normal sai escura ou tremida.",
    kind: "photo",
    fidelity: "simulated",
    section: "frequentes",
    pinned: false,
    controls: ["Tempo de exposição", "Azul no céu noturno"],
    aliases: ["escuro", "noturno", "pouca luz"],
  },
  {
    id: "food",
    label: "Comida",
    summary: "Realça cor e textura dos pratos.",
    whenToUse: "Fotografar comida sem que ela pareça sem graça.",
    kind: "photo",
    fidelity: "simulated",
    section: "criativos",
    pinned: false,
    controls: ["Intensidade do realce", "Temperatura de cor"],
    aliases: ["food", "prato", "restaurante", "comida"],
  },
  {
    id: "microfilm",
    label: "Microfilme",
    summary: "Clipes curtos com tratamento cinematográfico.",
    whenToUse: "Quando um vídeo comum não transmite a atmosfera que você quer.",
    kind: "video",
    fidelity: "simulated",
    section: "criativos",
    pinned: false,
    controls: ["Modelos (Fragmento, Projetor)", "Trilha", "Duração"],
    aliases: ["cinema", "filme", "clipe"],
  },
  {
    id: "slow-motion",
    label: "Câmera lenta",
    summary: "Grava em alta taxa de quadros e reproduz devagar.",
    whenToUse: "Movimentos rápidos que o olho não acompanha.",
    kind: "video",
    fidelity: "simulated",
    section: "criativos",
    pinned: false,
    controls: ["Velocidade (Ultralenta a Ultrarrápida)", "Trecho em câmera lenta"],
    aliases: ["slow", "lenta", "240fps", "slow motion"],
  },
  {
    id: "timelapse",
    label: "Intervalo",
    summary: "Captura a cada intervalo e junta tudo em um vídeo acelerado.",
    whenToUse: "Processos longos: um pôr do sol, uma obra, o céu mudando.",
    kind: "video",
    fidelity: "simulated",
    section: "criativos",
    pinned: false,
    controls: ["Intervalo entre capturas", "Duração total"],
    aliases: ["time lapse", "timelapse", "acelerado"],
  },
  {
    id: "panorama",
    label: "Panorâmica",
    summary: "Une vários quadros em uma imagem larga.",
    whenToUse: "Paisagens e ambientes que não cabem em um enquadramento.",
    kind: "photo",
    fidelity: "simulated",
    section: "criativos",
    pinned: false,
    controls: ["Direção da varredura", "Panorâmica noturna"],
    aliases: ["paisagem", "panorama", "wide"],
  },
  {
    id: "pro",
    label: "Profissional",
    summary: "Controle manual de ISO, obturador, foco e balanço de branco.",
    whenToUse: "Quando você sabe exatamente o ajuste que quer e o automático atrapalha.",
    kind: "photo",
    fidelity: "simulated",
    section: "avancados",
    pinned: false,
    controls: ["ISO", "Velocidade do obturador", "Foco manual", "Balanço de branco", "RAW"],
    aliases: ["pro", "manual", "iso", "raw"],
  },
  {
    id: "high-res",
    label: "Alta Resolução",
    summary: "Captura com a resolução máxima do sensor.",
    whenToUse: "Fotos que serão ampliadas ou recortadas depois.",
    kind: "photo",
    fidelity: "simulated",
    section: "avancados",
    pinned: false,
    controls: ["50 MP", "200 MP"],
    aliases: ["200mp", "50mp", "megapixel", "resolução"],
  },
  {
    id: "supermoon",
    label: "Superlua",
    summary: "Zoom e processamento dedicados para fotografar a lua.",
    whenToUse: "Céu limpo com lua visível — o modo normal só entrega um ponto branco.",
    kind: "photo",
    fidelity: "simulated",
    section: "avancados",
    pinned: false,
    controls: ["Zoom da lua", "Exposição do céu"],
    aliases: ["lua", "moon", "astro"],
  },
  {
    id: "dual-view",
    label: "Visualização dupla",
    summary: "Grava as câmeras frontal e traseira ao mesmo tempo.",
    whenToUse: "Registrar a cena e a sua reação a ela na mesma gravação.",
    kind: "video",
    fidelity: "simulated",
    section: "avancados",
    pinned: false,
    controls: ["Layout das janelas", "Câmera principal"],
    aliases: ["dupla", "dual", "frontal e traseira"],
  },
  {
    id: "snapshot",
    label: "Instantâneo",
    summary: "Dispara imediatamente, sem ajustes prévios.",
    whenToUse: "Cenas que não esperam: uma criança, um animal, um instante.",
    kind: "photo",
    fidelity: "real",
    section: "avancados",
    pinned: false,
    aliases: ["rápido", "instant", "snap"],
  },
  {
    id: "scanner",
    label: "Scanner",
    summary: "Digitaliza documentos, corrige a perspectiva e realça o texto.",
    whenToUse:
      "Uma folha, um comprovante, um quadro solto — captura pontual, não a aula inteira.",
    kind: "photo",
    fidelity: "simulated",
    section: "ferramentas",
    pinned: false,
    controls: ["Recorte automático", "Correção de perspectiva", "Extrair texto"],
    aliases: ["documento", "digitalizar", "ultra hd", "papel", "ocr"],
  },
];

export const SECTION_LABELS: Record<ModeSection, string> = {
  frequentes: "Frequentes",
  criativos: "Criativos",
  avancados: "Avançados",
  ferramentas: "Ferramentas",
};

export const SECTION_ORDER: ModeSection[] = [
  "frequentes",
  "criativos",
  "avancados",
  "ferramentas",
];

export function getMode(id: string): CameraMode {
  return MODES.find((mode) => mode.id === id) ?? MODES[0];
}

export const PINNED_MODES = MODES.filter((mode) => mode.pinned);

/** Matches label, description and colloquial aliases — people rarely search the official name. */
export function searchModes(query: string): CameraMode[] {
  const term = query.trim().toLowerCase();
  if (!term) return MODES;
  return MODES.filter((mode) =>
    [mode.label, mode.summary, mode.whenToUse, ...(mode.aliases ?? [])]
      .join(" ")
      .toLowerCase()
      .includes(term),
  );
}

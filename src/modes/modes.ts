import type { CaptureKind } from "../types/camera";

/**
 * How faithfully a mode is reproduced in the browser.
 * Surfaced in the UI so a simulated mode never pretends to be the real thing —
 * the original Jovi camera already labels AI-processed shots, and inheriting
 * that honesty is cheaper than explaining it on stage.
 */
export type ModeFidelity = "real" | "partial" | "simulated";

export interface CameraMode {
  id: string;
  label: string;
  /** One line explaining what it does — the "education in place" of the pitch. */
  summary: string;
  /** When it is worth reaching for. */
  whenToUse: string;
  kind: CaptureKind;
  fidelity: ModeFidelity;
  /** Shown in the main mode bar rather than only in the full catalog. */
  pinned: boolean;
}

/**
 * The mode registry. Day-1 scope covers only the two modes backed by a real
 * capture pipeline; the remaining thirteen from the original camera inventory
 * arrive with the full catalog, each with its own explanatory state.
 */
export const MODES: CameraMode[] = [
  {
    id: "photo",
    label: "Foto",
    summary: "Captura padrão, equilibrada para qualquer cena.",
    whenToUse: "O modo para o dia a dia, quando nada de especial é exigido.",
    kind: "photo",
    fidelity: "real",
    pinned: true,
  },
  {
    id: "video",
    label: "Vídeo",
    summary: "Grava vídeo com áudio no armazenamento do dispositivo.",
    whenToUse: "Para registrar movimento e som em vez de um instante.",
    kind: "video",
    fidelity: "real",
    pinned: true,
  },
];

export function getMode(id: string): CameraMode {
  return MODES.find((mode) => mode.id === id) ?? MODES[0];
}

export const PINNED_MODES = MODES.filter((mode) => mode.pinned);

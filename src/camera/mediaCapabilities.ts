/**
 * Ler `getCapabilities`/`getSettings`/`getConstraints` sem nunca lançar.
 *
 * As três existem em navegadores diferentes de jeitos diferentes: Safari não
 * tem `getCapabilities` em algumas versões; um `track` já encerrado pode
 * lançar ao ser perguntado. Cada leitura aqui devolve `undefined` em vez de
 * derrubar quem chamou — e "não sei responder" é um valor válido para um
 * relatório de diagnóstico, nunca um motivo para a tela quebrar.
 *
 * **A lição do spike de foco.** Medido nesta bancada, no `MediaStreamTrack` da
 * câmera falsa do Chromium:
 *
 * ```
 * caps.focusMode      → ["manual", "continuous"]
 * applyConstraints({ focusMode: "continuous" })  → resolve sem erro
 * getConstraints().focusMode                     → "continuous"
 * getSettings().focusMode                        → "manual"  (!)
 * ```
 *
 * A capacidade existe, o pedido é aceito, `getConstraints()` ecoa de volta
 * exatamente o que foi pedido — e `getSettings()`, que é o que o hardware
 * realmente fez, nunca muda. É a mesma forma do achado do
 * `SpeechRecognition`: uma API pode declarar suporte e não entregar nada.
 *
 * **A regra que isso impõe:** `getCapabilities()` diz o que pode ser tentado;
 * `getConstraints()` diz o que foi pedido; só `getSettings()`, lido de novo
 * depois do pedido, diz o que aconteceu. Este arquivo dá o vocabulário para
 * essa distinção — `useFocus.ts` é quem a aplica.
 */

/**
 * As capacidades de imagem (`ImageCapture`/`MediaTrackCapabilities` extra)
 * que este projeto usa. O TypeScript do DOM não declara a maioria delas —
 * `zoom`, `torch`, `focusMode`, `focusDistance` e `pointsOfInterest` são
 * extensões da mesma família ("ImageCapture") que a maioria dos navegadores
 * de mesa nunca implementou, e por isso o lib.dom.d.ts não as inclui.
 */
export interface CapacidadesDeImagem {
  zoom?: { min: number; max: number; step?: number };
  torch?: boolean;
  focusMode?: string[];
  focusDistance?: { min: number; max: number; step?: number };
  /**
   * A presença desta chave é a única prova de que o navegador aceita
   * controlar o ponto de foco. Na bancada desta sessão ela não existe —
   * `"pointsOfInterest" in capabilities` é `false` mesmo com `focusMode`
   * listando `"continuous"` e `"manual"`.
   */
  pointsOfInterest?: unknown;
  width?: { min: number; max: number };
  height?: { min: number; max: number };
  frameRate?: { min: number; max: number };
  facingMode?: string[];
  resizeMode?: string[];
  deviceId?: string;
  groupId?: string;
}

export type Capacidades = MediaTrackCapabilities & CapacidadesDeImagem;

export interface ConfiguracaoDeImagem {
  zoom?: number;
  torch?: boolean;
  focusMode?: string;
  focusDistance?: number;
  /**
   * Um ponto só, sempre — este app nunca pede foco em mais de um alvo ao
   * mesmo tempo. `getSettings()` não devolve isto de volta (o navegador não
   * relata qual ponto está em uso), então pedir é o máximo que dá para saber.
   */
  pointsOfInterest?: { x: number; y: number }[];
}

export type Configuracao = MediaTrackSettings & ConfiguracaoDeImagem;

/** `undefined` quando o navegador não tem `getCapabilities`, não quando falta uma capacidade específica. */
export function lerCapacidades(track: MediaStreamTrack | undefined | null): Capacidades | undefined {
  if (!track) return undefined;
  const fn = (track as unknown as { getCapabilities?: () => MediaTrackCapabilities }).getCapabilities;
  if (typeof fn !== "function") return undefined;
  try {
    return fn.call(track) as Capacidades;
  } catch {
    return undefined;
  }
}

export function lerConfiguracao(track: MediaStreamTrack | undefined | null): Configuracao | undefined {
  if (!track) return undefined;
  const fn = (track as unknown as { getSettings?: () => MediaTrackSettings }).getSettings;
  if (typeof fn !== "function") return undefined;
  try {
    return fn.call(track) as Configuracao;
  } catch {
    return undefined;
  }
}

export function lerRestricoes(
  track: MediaStreamTrack | undefined | null,
): (MediaTrackConstraints & ConfiguracaoDeImagem) | undefined {
  if (!track) return undefined;
  const fn = (track as unknown as { getConstraints?: () => MediaTrackConstraints }).getConstraints;
  if (typeof fn !== "function") return undefined;
  try {
    return fn.call(track) as MediaTrackConstraints & ConfiguracaoDeImagem;
  } catch {
    return undefined;
  }
}

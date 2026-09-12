/**
 * Onde um toque no visor cai dentro do quadro real da câmera.
 *
 * `pointsOfInterest` (a constraint que pede foco num ponto) espera um par
 * normalizado 0–1 dentro do **quadro entregue pela câmera** — `videoWidth` ×
 * `videoHeight` — e não dentro do retângulo que a tela desenha. As duas coisas
 * divergem por três motivos, todos presentes neste app ao mesmo tempo:
 *
 * 1. **`object-cover`.** O `<video>` preenche a caixa inteira cortando o que
 *    sobra de um dos lados; ele nunca mostra o quadro completo quando a
 *    proporção da caixa não bate com a do sensor.
 * 2. **O zoom digital.** `Viewfinder` aplica `transform: scale(zoom.digital)`
 *    no próprio `<video>` quando o hardware não zoom, então o que está na
 *    tela é maior que a caixa de layout.
 * 3. **O espelho da câmera frontal.** `transform: scaleX(-1)` inverte o que é
 *    mostrado sem inverter a caixa que o navegador mede.
 *
 * A função abaixo é pura de propósito — nenhum DOM, só números — para poder
 * ser testada sem abrir um navegador, e para o mesmo cálculo valer tanto para
 * o app quanto para o teste que o verifica.
 */

export interface RetanguloVisivel {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ParametrosDoToque {
  /** Coordenadas do toque, em pixels de viewport — o que um `PointerEvent` dá. */
  clientX: number;
  clientY: number;
  /**
   * `getBoundingClientRect()` do próprio `<video>`.
   *
   * De propósito o retângulo **já transformado**: `getBoundingClientRect`
   * devolve a caixa depois do CSS `transform`, e é isso que faz o cálculo
   * funcionar em qualquer nível de zoom digital sem precisar saber o fator —
   * a proporção largura/altura da caixa não muda com uma escala uniforme, só
   * o tamanho dela, e é a proporção que decide o corte do `object-cover`.
   */
  rect: RetanguloVisivel;
  /** `video.videoWidth` / `video.videoHeight` — o quadro real entregue pela câmera. */
  videoWidth: number;
  videoHeight: number;
  /** A câmera frontal é espelhada na tela (`scaleX(-1)`); a traseira, não. */
  espelhado: boolean;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Converte um toque na tela num ponto normalizado (0–1, 0–1) dentro do quadro
 * real da câmera — o que `pointsOfInterest` espera.
 *
 * Devolve `null` quando não há como calcular (caixa ou quadro com tamanho
 * zero, o que acontece antes de o vídeo carregar metadados).
 *
 * Duas garantias, e o teste cobra as duas: um toque no centro exato da caixa
 * cai sempre no centro exato do quadro, não importa o corte do
 * `object-cover`; um toque num canto visível cai no ponto do quadro que
 * está realmente ali — que não é o canto do quadro inteiro quando há corte.
 */
export function mapearToqueParaFrame(p: ParametrosDoToque): { x: number; y: number } | null {
  const { clientX, clientY, rect, videoWidth, videoHeight, espelhado } = p;
  if (rect.width <= 0 || rect.height <= 0) return null;
  if (!videoWidth || !videoHeight) return null;

  // 1. Onde o toque cai dentro da caixa renderizada, de 0 a 1. `rect` já é a
  //    caixa pós-transform, então o zoom digital (uma escala uniforme) não
  //    muda esta fração — só o tamanho da caixa, não a proporção do que caiu
  //    dentro dela.
  let localX = clamp01((clientX - rect.left) / rect.width);
  const localY = clamp01((clientY - rect.top) / rect.height);

  // 2. O espelho é invisível para `getBoundingClientRect` (ele muda a
  //    orientação do conteúdo dentro da mesma caixa, não a caixa em si), então
  //    é aplicado aqui à mão.
  if (espelhado) localX = 1 - localX;

  // 3. O corte do `object-cover`: a caixa e o quadro raramente têm a mesma
  //    proporção, e o lado que sobra é cortado, centralizado.
  const boxAspect = rect.width / rect.height;
  const videoAspect = videoWidth / videoHeight;

  let frameX: number;
  let frameY: number;

  if (videoAspect >= boxAspect) {
    // O quadro é relativamente mais largo que a caixa: a altura bate cheia,
    // e o corte é nas laterais.
    const larguraVisivelFrac = boxAspect / videoAspect;
    const deslocamentoX = (1 - larguraVisivelFrac) / 2;
    frameX = deslocamentoX + localX * larguraVisivelFrac;
    frameY = localY;
  } else {
    // O quadro é relativamente mais alto: a largura bate cheia, o corte é em
    // cima e embaixo.
    const alturaVisivelFrac = videoAspect / boxAspect;
    const deslocamentoY = (1 - alturaVisivelFrac) / 2;
    frameY = deslocamentoY + localY * alturaVisivelFrac;
    frameX = localX;
  }

  return { x: clamp01(frameX), y: clamp01(frameY) };
}

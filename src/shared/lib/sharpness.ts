/**
 * Um número que separa "nítido" de "borrado" — só para diagnóstico.
 *
 * Existe para responder a uma pergunta que o achado do teste real deixou em
 * aberto: quando o SliD não guarda um momento, é porque o **detector** não
 * reconheceu escrita, ou porque o **quadro chegou desfocado demais** para
 * qualquer detector trabalhar? As duas coisas produzem o mesmo sintoma —
 * "não virou momento" — e só uma delas é resolvida mexendo no foco da
 * câmera.
 *
 * **Isto não é o detector, e não fala com ele.** `frameAnalysis.ts` continua
 * exatamente como estava; este arquivo não importa nada de lá e nada de lá
 * importa daqui. A medida é energia de borda (gradiente de Sobel, variância
 * do resultado) sobre uma janela central — uma foto desfocada tem bordas
 * fracas em toda parte; uma nítida tem bordas fortes onde há contraste.
 *
 * **O número não vira regra de produto sozinho.** Ele precisa ser visto ao
 * lado de vários quadros — nítido, desfocado, parede lisa, projetor — antes
 * de alguém decidir o que "baixo" significa. Por isso mora só atrás de
 * `?debug=device`, com um botão que mede uma vez quando alguém pede.
 */

/** O tamanho da amostra. Pequeno o bastante para o cálculo ser instantâneo. */
const LADO = 160;

export interface MedidaDeNitidez {
  /** Energia de borda média na janela central — maior costuma ser mais nítido. */
  pontuacao: number;
  amostraW: number;
  amostraH: number;
}

/**
 * Mede a nitidez do quadro atual de um `<video>`, numa janela central.
 *
 * `drawImage` a partir do `<video>` lê o quadro cru — o mesmo caminho que o
 * SliD usa para amostrar o visor (`useFrameSample.ts`) e que o app já
 * documenta noutro lugar: filtros CSS não tocam o que é lido assim, então a
 * medida reflete a câmera, não o filtro escolhido na tela.
 *
 * Devolve `null` quando o vídeo ainda não tem quadro (`videoWidth === 0`).
 */
export function medirNitidezDoVideo(
  video: HTMLVideoElement,
): MedidaDeNitidez | null {
  if (!video.videoWidth || !video.videoHeight) return null;

  const canvas = document.createElement("canvas");
  canvas.width = LADO;
  canvas.height = LADO;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  // Recorte central quadrado, do próprio quadro — evita que a proporção do
  // vídeo distorça a amostra e que a borda do enquadramento (às vezes mais
  // escura) entre na conta.
  const menor = Math.min(video.videoWidth, video.videoHeight);
  const sx = (video.videoWidth - menor) / 2;
  const sy = (video.videoHeight - menor) / 2;
  ctx.drawImage(video, sx, sy, menor, menor, 0, 0, LADO, LADO);

  const { data } = ctx.getImageData(0, 0, LADO, LADO);
  const pontuacao = energiaDeBordaSobel(data, LADO, LADO);
  return { pontuacao, amostraW: LADO, amostraH: LADO };
}

/**
 * Sobel em tons de cinza, energia média absoluta do gradiente.
 *
 * Deliberadamente simples: não é o detector, é uma régua. Uma imagem toda
 * cinza-uniforme (uma parede sem textura, ou um desfoque total) dá um número
 * próximo de zero; bordas de texto nítido dão picos altos que a média puxa
 * para cima.
 */
function energiaDeBordaSobel(data: Uint8ClampedArray, w: number, h: number): number {
  const cinza = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    // Luminância padrão, não precisa de mais precisão que isso para uma régua.
    cinza[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }

  let soma = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -cinza[i - w - 1] + cinza[i - w + 1] -
        2 * cinza[i - 1] + 2 * cinza[i + 1] -
        cinza[i + w - 1] + cinza[i + w + 1];
      const gy =
        -cinza[i - w - 1] - 2 * cinza[i - w] - cinza[i - w + 1] +
        cinza[i + w - 1] + 2 * cinza[i + w] + cinza[i + w + 1];
      soma += Math.sqrt(gx * gx + gy * gy);
      n++;
    }
  }
  return n > 0 ? soma / n : 0;
}

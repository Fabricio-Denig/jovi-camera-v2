export type AspectRatio = "4:3" | "16:9" | "1:1";

export const ASPECT_RATIOS: AspectRatio[] = ["4:3", "16:9", "1:1"];

/** Altura dividida por largura, no retrato em que o celular é segurado. */
export function aspectHeightOverWidth(ratio: AspectRatio): number {
  switch (ratio) {
    case "1:1":
      return 1;
    case "16:9":
      return 16 / 9;
    default:
      return 4 / 3;
  }
}

/**
 * A janela da foto dentro do quadro que a câmera entrega, em frações.
 *
 * A proporção é um recorte, e não um pedido ao sensor: pedir uma resolução nova
 * ao `getUserMedia` reinicia o fluxo, e reiniciar o fluxo é exatamente o que
 * produziu o preview preto que custou uma correção inteira. Então o sensor
 * continua entregando o que entrega, e a proporção decide quanto disso vira
 * foto — que é o que a maioria das câmeras de celular faz de qualquer forma.
 */
export function aspectWindow(
  ratio: AspectRatio,
  frameWidth: number,
  frameHeight: number,
): { x: number; y: number; width: number; height: number } {
  if (!frameWidth || !frameHeight) return { x: 0, y: 0, width: 1, height: 1 };

  // O quadro chega deitado; a proporção é falada em pé.
  const alvo = 1 / aspectHeightOverWidth(ratio);
  const atual = frameWidth / frameHeight;

  if (atual > alvo) {
    const width = alvo / atual;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }
  const height = atual / alvo;
  return { x: 0, y: (1 - height) / 2, width: 1, height };
}

/**
 * A janela que a foto deve realmente pegar, em frações do quadro do sensor.
 *
 * São dois recortes encaixados. O visor usa `object-cover`: ele preenche a tela
 * e joga fora o que sobra, então já mostra menos que o sensor entrega. A
 * proporção escolhida recorta de novo, dentro disso.
 *
 * Compor os dois é o que faz a foto ser o que estava na tela. Sem isso a foto
 * saía com o quadro inteiro do sensor enquanto o visor mostrava um terço dele —
 * o estudante enquadrava uma coisa e guardava outra, mais larga, com o que ele
 * tinha deixado de fora de propósito.
 */
export function photoWindow(
  ratio: AspectRatio,
  frameWidth: number,
  frameHeight: number,
  viewWidth: number,
  viewHeight: number,
): { x: number; y: number; width: number; height: number } {
  if (!frameWidth || !frameHeight || !viewWidth || !viewHeight) {
    return aspectWindow(ratio, frameWidth, frameHeight);
  }

  const visivel = coverWindow(frameWidth, frameHeight, viewWidth, viewHeight);

  // E a proporção, dentro do que está visível.
  const dentro = aspectWindow(
    ratio,
    frameWidth * visivel.width,
    frameHeight * visivel.height,
  );

  const width = visivel.width * dentro.width;
  const height = visivel.height * dentro.height;
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

/**
 * O pedaço do quadro que o visor está de fato mostrando, em frações.
 *
 * O `object-cover` preenche a tela e descarta o resto: num celular em pé com
 * um sensor deitado, o que fica de fora chega a dois terços da largura. Quem
 * precisa disto é qualquer coisa que guarde uma imagem — a foto manual, que já
 * compõe isto com a proporção escolhida, e o momento do SliD, que não tem
 * proporção a escolher e para no recorte do visor.
 */
export function coverWindow(
  frameWidth: number,
  frameHeight: number,
  viewWidth: number,
  viewHeight: number,
): { x: number; y: number; width: number; height: number } {
  if (!frameWidth || !frameHeight || !viewWidth || !viewHeight) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  const escala = Math.max(viewWidth / frameWidth, viewHeight / frameHeight);
  const width = Math.min(1, viewWidth / (frameWidth * escala));
  const height = Math.min(1, viewHeight / (frameHeight * escala));
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

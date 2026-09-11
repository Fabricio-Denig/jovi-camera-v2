/**
 * A pintura dos efeitos, num lugar só.
 *
 * Mesma regra dos filtros: uma definição alimenta **duas** saídas — o CSS do
 * visor e o canvas da foto. Duas definições paralelas viram, na primeira
 * mudança, um visor com luz num canto e uma foto com luz no outro.
 *
 * Efeito não é filtro, e a diferença aparece aqui: filtro é uma função de cor
 * aplicada ao próprio pixel; efeito é uma camada desenhada por cima. Por isso
 * ele não entra em `applyFilter` nem responde à intensidade.
 */

/** O raio de sol: uma luz quente entrando pelo canto superior direito. */
const SOL = {
  /** Centro da luz, em frações do quadro. */
  cx: 0.86,
  cy: 0.08,
  /** Raio, em frações da largura e da altura. */
  raio: 0.95,
  paradas: [
    { pos: 0, cor: "rgba(255, 219, 158, 0.62)" },
    { pos: 0.34, cor: "rgba(255, 187, 104, 0.22)" },
    { pos: 0.72, cor: "rgba(255, 170, 90, 0)" },
  ],
};

/** O gradiente do raio de sol como `background` de CSS. */
export function sunbeamCss(): string {
  const paradas = SOL.paradas
    .map((p) => `${p.cor} ${(p.pos * 100).toFixed(0)}%`)
    .join(", ");
  return `radial-gradient(ellipse ${(SOL.raio * 100).toFixed(0)}% ${(
    SOL.raio * 100
  ).toFixed(0)}% at ${(SOL.cx * 100).toFixed(0)}% ${(SOL.cy * 100).toFixed(
    0,
  )}%, ${paradas})`;
}

/**
 * O mesmo raio de sol, desenhado sobre a foto já capturada.
 *
 * O `scale` reproduz a elipse do CSS: o gradiente do canvas é sempre circular,
 * então a altura é comprimida na mesma proporção da caixa. Sem isso a luz sai
 * redonda na foto e oval na tela.
 */
function paintSunbeam(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const r = SOL.raio * width;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.translate(SOL.cx * width, SOL.cy * height);
  ctx.scale(1, height / width);
  const gradiente = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  for (const p of SOL.paradas) gradiente.addColorStop(p.pos, p.cor);
  ctx.fillStyle = gradiente;
  // Um retângulo grande o bastante para cobrir o quadro depois do `scale`.
  ctx.fillRect(-width * 2, -height * 2, width * 4, height * 4);
  ctx.restore();
}

/**
 * Desenha o efeito escolhido sobre a foto, quando ele é da espécie que fica.
 *
 * `tremor` não passa por aqui de propósito: ele é movimento do visor, e uma
 * foto não treme. Fingir tremor com borrão seria inventar o que a câmera não
 * captou.
 */
export function paintEffect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  effectId: string | null,
) {
  if (effectId === "raio-de-sol") paintSunbeam(ctx, width, height);
}

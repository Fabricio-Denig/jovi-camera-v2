/* Uma cena COLORIDA, que as outras não são.
 *
 * Todas as cenas do SliD são cinza — `U` e `V` constantes em 128 — porque o
 * detector só olha luminância, e um plano de cor a mais seria peso morto. Mas
 * filtro é cor: num quadro sem cor, Vivid, P&B e Quente saem idênticos, e o
 * teste não distinguiria uma implementação certa de uma que não faz nada.
 *
 * Então esta cena existe só para os filtros: uma mesa de estudo com objetos de
 * cores fortes e separadas, que é o que uma câmera de estudante vê. */
import { writeFileSync } from "node:fs";
import { CENAS, ruido } from "./caminhos.mjs";

const W = 640;
const H = 480;
const FRAMES = 60;

const rnd = ruido(20260910);

/** Um retângulo de cor sólida, com uma variação suave para não ficar chapado. */
function retangulo(rgb, x0, y0, x1, y1, cor) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 3;
      // Um leve gradiente de iluminação, como luz de sala entrando de um lado.
      const luz = 0.88 + 0.24 * (1 - x / W);
      rgb[i] = Math.min(255, cor[0] * luz);
      rgb[i + 1] = Math.min(255, cor[1] * luz);
      rgb[i + 2] = Math.min(255, cor[2] * luz);
    }
  }
}

const rgb = new Float32Array(W * H * 3);
// A mesa de madeira, que é o fundo.
retangulo(rgb, 0, 0, W, H, [148, 104, 62]);
// Um caderno vermelho aberto à esquerda.
retangulo(rgb, 40, 90, 300, 420, [186, 48, 44]);
// A folha branca dentro dele.
retangulo(rgb, 62, 112, 278, 398, [238, 236, 228]);
// Linhas de escrita azuis na folha.
for (let n = 0; n < 9; n++) {
  retangulo(rgb, 80, 140 + n * 28, 250 - (n % 3) * 34, 144 + n * 28, [42, 58, 120]);
}
// Um marca-texto amarelo e uma caneta azul sobre a mesa.
retangulo(rgb, 340, 150, 560, 186, [232, 206, 54]);
retangulo(rgb, 340, 222, 590, 248, [38, 84, 176]);
// Um pedaço de tecido verde no canto, para haver um terceiro matiz forte.
retangulo(rgb, 380, 320, 620, 440, [56, 132, 88]);

const head = Buffer.from(`YUV4MPEG2 W${W} H${H} F15:1 Ip A1:1 C420mpeg2\n`);
const partes = [head];

for (let f = 0; f < FRAMES; f++) {
  const y = Buffer.alloc(W * H);
  const u = Buffer.alloc((W / 2) * (H / 2));
  const v = Buffer.alloc((W / 2) * (H / 2));
  const somaU = new Float32Array((W / 2) * (H / 2));
  const somaV = new Float32Array((W / 2) * (H / 2));

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 3;
      // O mesmo tremor de sensor das outras cenas: a cena está parada, o
      // celular não.
      const t = (rnd() - 0.5) * 3;
      const r = rgb[i] + t;
      const g = rgb[i + 1] + t;
      const b = rgb[i + 2] + t;
      y[py * W + px] = Math.max(0, Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b)));
      const c = (py >> 1) * (W / 2) + (px >> 1);
      somaU[c] += -0.169 * r - 0.331 * g + 0.5 * b + 128;
      somaV[c] += 0.5 * r - 0.419 * g - 0.081 * b + 128;
    }
  }
  for (let c = 0; c < u.length; c++) {
    u[c] = Math.max(0, Math.min(255, Math.round(somaU[c] / 4)));
    v[c] = Math.max(0, Math.min(255, Math.round(somaV[c] / 4)));
  }
  partes.push(Buffer.from("FRAME\n"), y, u, v);
}

writeFileSync(`${CENAS}/cor-mesa-de-estudo.y4m`, Buffer.concat(partes));
console.log("cor-mesa-de-estudo");

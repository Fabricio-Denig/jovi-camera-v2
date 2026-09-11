/* Uma cena escura e ruidosa, para medir se empilhar quadros ajuda de verdade.
 *
 * As outras cenas têm ruído de ±1,5 níveis, que é enfeite. Uma foto noturna de
 * celular tem ruído de sensor de verdade: grão grosso, que cresce quando o
 * ganho sobe porque há pouca luz. Sem uma cena assim, medir a média de quadros
 * diria que ela melhora 0,3 nível e a conclusão seria errada nos dois
 * sentidos possíveis. */
import { writeFileSync } from "node:fs";
import { CENAS, ruido } from "./caminhos.mjs";

const W = 640;
const H = 480;
const FRAMES = 60;

const rnd = ruido(20260912);
/** Gaussiana a partir de duas uniformes — ruído de sensor não é uniforme. */
function gauss() {
  const u = Math.max(1e-9, rnd());
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// A cena: um ambiente escuro com algumas formas de brilho diferente. O que
// importa para a medição são as áreas CHAPADAS — é nelas que o desvio padrão
// mede ruído e não detalhe.
const base = new Float32Array(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let v = 26; // fundo quase preto
    if (x > 80 && x < 300 && y > 90 && y < 300) v = 58; // um móvel
    if (x > 340 && x < 560 && y > 120 && y < 260) v = 96; // uma parede iluminada
    if (x > 380 && x < 520 && y > 300 && y < 400) v = 140; // um abajur
    base[y * W + x] = v;
  }
}

const head = Buffer.from(`YUV4MPEG2 W${W} H${H} F15:1 Ip A1:1 C420mpeg2\n`);
const uv = Buffer.alloc((W / 2) * (H / 2), 128);
const partes = [head];

/** Desvio do ruído, em níveis. Alto de propósito: é assim que o escuro é. */
const SIGMA = 11;

for (let f = 0; f < FRAMES; f++) {
  const y = Buffer.alloc(W * H);
  for (let i = 0; i < y.length; i++) {
    y[i] = Math.max(0, Math.min(255, Math.round(base[i] + gauss() * SIGMA)));
  }
  partes.push(Buffer.from("FRAME\n"), y, uv, uv);
}

writeFileSync(`${CENAS}/noite-quarto-escuro.y4m`, Buffer.concat(partes));
console.log(`noite-quarto-escuro (sigma ${SIGMA})`);

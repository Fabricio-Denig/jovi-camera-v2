/* O mesmo slide projetado em seis tamanhos e contrastes: é a bateria de
   distância do qa-slid-realworld, e sem ela os positivos não têm cena. */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { CENAS, ruido } from "./caminhos.mjs";
const W = 640, H = 480, FRAMES = 60;
const { slideAoLonge } = await import("./cenas-distancia.mjs");

/** Ruído de sensor com semente: a mesma cena sai igual em qualquer máquina. */
const rnd16 = ruido();
const cenas = [
  ["slide-perto", 0.7, 1],
  ["slide-medio", 0.5, 1],
  ["slide-distante", 0.32, 1],
  ["slide-muito-distante", 0.2, 1],
  ["slide-sala-clara", 0.5, 0.45],
  ["slide-distante-sala-clara", 0.32, 0.5],
];
for (const [nome, fracao, contraste] of cenas) {
  const g = slideAoLonge(fracao, { contraste });
  const head = Buffer.from(`YUV4MPEG2 W${W} H${H} F15:1 Ip A1:1 C420mpeg2\n`);
  const partes = [head];
  const uv = Buffer.alloc((W / 2) * (H / 2), 128);
  for (let f = 0; f < FRAMES; f++) {
    const y = Buffer.alloc(W * H);
    for (let i = 0; i < y.length; i++)
      y[i] = Math.max(0, Math.min(255, Math.round(g[i] + (rnd16() - 0.5) * 3)));
    partes.push(Buffer.from("FRAME\n"), y, uv, uv);
  }
  writeFileSync(join(CENAS, `fp-${nome}.y4m`), Buffer.concat(partes));
  console.log("gravado", nome, `(${Math.round(fracao*100)}% da largura, contraste ${Math.round(contraste*100)}%)`);
}

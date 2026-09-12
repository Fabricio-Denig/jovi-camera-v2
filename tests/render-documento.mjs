/* Grava as cenas de folha sobre mesa. */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { CENAS, ruido } from "./caminhos.mjs";
const { W, H, folhaSobreMesa } = await import("./cenas-documento.mjs");
const rnd16 = ruido(777);
const FPS = 30, SEGUNDOS = 8;

for (const [nome, opcoes] of [
  ["doc-folha-na-mesa", { fracao: 0.62 }],
  ["doc-folha-pequena", { fracao: 0.42 }],
  ["doc-folha-deslocada", { fracao: 0.58, desloca: -70 }],
  ["doc-folha-pouca-luz", { fracao: 0.62, mesa: 42, papel: 138 }],
  ["doc-mesa-vazia", { fracao: 0.62, papel: 82, linhas: 0 }],
  // Checklist J: folha ESCURA sobre mesa CLARA — o contraste borda/fundo
  // inverte (a folha é a região escura, não a clara), a condição que a
  // bancada nunca teve cena para medir.
  ["doc-folha-escura", { fracao: 0.62, mesa: 205, papel: 55 }],
  ["doc-folha-escura-pouca-luz", { fracao: 0.62, mesa: 150, papel: 40 }],
]) {
  const g = folhaSobreMesa(opcoes);
  const head = Buffer.from(`YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420mpeg2\n`);
  const uv = Buffer.alloc((W / 2) * (H / 2), 128);
  const parts = [head];
  for (let f = 0; f < FPS * SEGUNDOS; f++) {
    const y = Buffer.alloc(W * H);
    for (let i = 0; i < y.length; i++)
      y[i] = Math.max(0, Math.min(255, Math.round(g[i] + (rnd16() - 0.5) * 4)));
    parts.push(Buffer.from("FRAME\n"), y, uv, uv);
  }
  writeFileSync(join(CENAS, `${nome}.y4m`), Buffer.concat(parts));
  console.log(nome);
}

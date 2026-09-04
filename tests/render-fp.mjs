/* Grava cada cena adversária como y4m, para que o teste passe pela câmera de
   verdade do navegador em vez de chamar a função direto. */
import { writeFileSync } from "node:fs";
const W = 640, H = 480, FRAMES = 60;
const { raw, names } = await import("./cenas-fp.mjs");
import { CENAS, ruido } from "./caminhos.mjs";

/** Ruído de sensor com semente: a mesma cena sai igual em qualquer máquina. */
const rnd16 = ruido();
const slug = (n) => n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
for (const n of names) {
  const g = raw(n);
  const head = Buffer.from(`YUV4MPEG2 W${W} H${H} F15:1 Ip A1:1 C420mpeg2\n`);
  const parts = [head];
  const uv = Buffer.alloc((W / 2) * (H / 2), 128);
  for (let f = 0; f < FRAMES; f++) {
    const y = Buffer.alloc(W * H);
    // um tremor de sensor por quadro: a cena está parada, o celular não
    for (let i = 0; i < y.length; i++)
      y[i] = Math.max(0, Math.min(255, Math.round(g[i] + (rnd16() - 0.5) * 3)));
    parts.push(Buffer.from("FRAME\n"), y, uv, uv);
  }
  writeFileSync(`${CENAS}/fp-${slug(n)}.y4m`, Buffer.concat(parts));
}
console.log(names.map(slug).join("\n"));

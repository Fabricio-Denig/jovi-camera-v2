/* Um slide visto do fundo mesmo: 12 % da largura. Pequeno demais para a
   análise afirmar que é aula, grande o bastante para ela ver que há algo. */
import { writeFileSync } from "node:fs";
const W = 640, H = 480, FRAMES = 60;
const { slideAoLonge } = await import("./cenas-distancia.mjs");
import { join } from "node:path";
import { CENAS, ruido } from "./caminhos.mjs";

/** Ruído de sensor com semente: a mesma cena sai igual em qualquer máquina. */
const rnd16 = ruido();
for (const [fracao, nome] of [[0.12, "fp-slide-fundo-da-sala"], [0.16, "fp-slide-quase-longe"]]) {
  const g = slideAoLonge(fracao, { contraste: 0.85 });
  const head = Buffer.from(`YUV4MPEG2 W${W} H${H} F15:1 Ip A1:1 C420mpeg2\n`);
  const parts = [head];
  const uv = Buffer.alloc((W / 2) * (H / 2), 128);
  for (let f = 0; f < FRAMES; f++) {
    const y = Buffer.alloc(W * H);
    for (let i = 0; i < y.length; i++)
      y[i] = Math.max(0, Math.min(255, Math.round(g[i] + (rnd16() - 0.5) * 3)));
    parts.push(Buffer.from("FRAME\n"), y, uv, uv);
  }
  writeFileSync(join(CENAS, `${nome}.y4m`), Buffer.concat(parts));
  console.log(nome);
}

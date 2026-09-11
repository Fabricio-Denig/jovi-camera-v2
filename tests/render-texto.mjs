/* Uma folha com TEXTO DE VERDADE, para o OCR ter o que ler.
 *
 * As outras cenas desenham marcas — retângulos do tamanho de uma linha — e
 * isso basta para o detector, que olha densidade e bordas. O OCR não: ele
 * precisa de glifos. Sem uma cena assim, o teste do Scanner só conseguiria
 * provar que a leitura *termina*, nunca que ela *lê*.
 *
 * O texto é rasterizado pelo próprio Chromium, porque o Node não tem canvas e
 * uma fonte bitmap escrita à mão sairia pior do que o Tesseract consegue ler. */
import { writeFileSync } from "node:fs";
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { CENAS, CHROMIUM, ruido } from "./caminhos.mjs";

const W = 960;
const H = 720;
const FRAMES = 40;

const b = await chromium.launch({ executablePath: CHROMIUM });
const p = await b.newPage();

const cinza = await p.evaluate(
  ({ W, H }) => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const x = c.getContext("2d");

    // A mesa em volta: sem ela o detector não acha borda de folha nenhuma.
    x.fillStyle = "#6b5138";
    x.fillRect(0, 0, W, H);

    // A folha, com uma sombra leve para a borda existir de verdade.
    const fx = W * 0.1;
    const fy = H * 0.07;
    const fw = W * 0.8;
    const fh = H * 0.86;
    x.fillStyle = "rgba(0,0,0,0.25)";
    x.fillRect(fx + 6, fy + 8, fw, fh);
    x.fillStyle = "#f6f4ef";
    x.fillRect(fx, fy, fw, fh);

    x.fillStyle = "#16161d";
    x.textBaseline = "top";

    const linhas = [
      ["bold 46px Georgia, serif", "Funcao do Segundo Grau", 0],
      ["28px Georgia, serif", "", 0],
      ["30px Georgia, serif", "A forma geral da funcao quadratica", 0],
      ["30px Georgia, serif", "escreve-se como f(x) = ax2 + bx + c", 0],
      ["30px Georgia, serif", "", 0],
      ["bold 32px Georgia, serif", "Discriminante", 0],
      ["30px Georgia, serif", "O valor de delta determina quantas", 0],
      ["30px Georgia, serif", "raizes reais a equacao possui.", 0],
      ["30px Georgia, serif", "", 0],
      ["bold 32px Georgia, serif", "Exercicios", 0],
      ["30px Georgia, serif", "Resolver as equacoes do quadro", 0],
      ["30px Georgia, serif", "Entregar na proxima aula", 0],
    ];

    let y = fy + 46;
    for (const [fonte, texto] of linhas) {
      x.font = fonte;
      if (texto) x.fillText(texto, fx + 40, y);
      y += texto ? 48 : 20;
    }

    // Só a luminância interessa: a cena sai em cinza como todas as outras.
    const d = x.getImageData(0, 0, W, H).data;
    const y8 = new Array(W * H);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      y8[j] = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    }
    return y8;
  },
  { W, H },
);

await b.close();

const rnd = ruido(20260911);
const head = Buffer.from(`YUV4MPEG2 W${W} H${H} F15:1 Ip A1:1 C420mpeg2\n`);
const uv = Buffer.alloc((W / 2) * (H / 2), 128);
const partes = [head];
for (let f = 0; f < FRAMES; f++) {
  const y = Buffer.alloc(W * H);
  for (let i = 0; i < y.length; i++) {
    // O mesmo tremor de sensor das outras cenas, e fraco: ruído forte destrói
    // glifo, e a cena existe justamente para haver glifo.
    y[i] = Math.max(0, Math.min(255, Math.round(cinza[i] + (rnd() - 0.5) * 2)));
  }
  partes.push(Buffer.from("FRAME\n"), y, uv, uv);
}
writeFileSync(`${CENAS}/doc-folha-com-texto.y4m`, Buffer.concat(partes));
console.log("doc-folha-com-texto");

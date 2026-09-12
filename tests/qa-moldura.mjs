/* A moldura acerta o slide? Não "existe" — acerta.
   O slide é gerado centrado, com fração conhecida da largura, então dá para
   calcular onde ele cai na tela e comparar com o retângulo desenhado. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";
const D = CENAS;
const VW = 390, VH = 844, FW = 640, FH = 480;
let fail = 0;
const check = (ok, l, e = "") => { console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`); if (!ok) fail++; };

/** Onde o slide cai na tela, dado object-cover. */
function slideNaTela(fracao) {
  const escala = Math.max(VW / FW, VH / FH);
  const mostradoW = FW * escala, mostradoH = FH * escala;
  const ox = (VW - mostradoW) / 2, oy = (VH - mostradoH) / 2;
  const sw = fracao, sh = (fracao * FW * 9 / 16) / FH;
  return {
    x: ox + (0.5 - sw / 2) * mostradoW,
    y: oy + (0.5 - sh / 2) * mostradoH,
    w: sw * mostradoW,
    h: sh * mostradoH,
  };
}
/** Quanto dois retângulos se sobrepõem, em fração do menor. */
function sobreposicao(a, b) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return (x * y) / Math.min(a.w * a.h, b.w * b.h);
}

const medir = async (cena, zoomAlvo = 1) => {
  const b = await chromium.launch({ executablePath: CHROMIUM,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${D}/${cena}`] });
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, isMobile: true, hasTouch: true, permissions: ["camera"] })).newPage();
  await p.goto(APP + "/?debug=slid", { waitUntil: "networkidle" });
  await p.waitForTimeout(3000);
  if (zoomAlvo > 1) {
    await p.getByRole("button", { name: `Aproximar ${zoomAlvo} vezes` }).click();
    await p.waitForTimeout(1200);
  }
  await p.waitForTimeout(6000);
  // Depois da animação de assentar, para medir layout e não keyframe.
  // 8 amostras, não 4: o "tremor" antigo (distância da última amostra até a
  // mais longe) é derrubado por UM quadro fora de hora sob carga de máquina —
  // medido, a mesma cena variava de 59 a 93px entre execuções, sem nada mudar
  // no detector. Mais amostras dão à mediana (abaixo) o que fazer estatística.
  const caixas = [];
  for (let i = 0; i < 8; i++) {
    await p.waitForTimeout(1300);
    caixas.push(await p.evaluate(() => {
      const el = [...document.querySelectorAll("div")].find((d) => String(d.className).includes("slid-settle"));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }));
  }
  await b.close();
  return caixas;
};

console.log("cena                         moldura desenhada        esperada             sobrep.  tremor");
console.log("─".repeat(94));
for (const [cena, rot, fracao, zoom] of [
  ["fp-slide-perto.y4m", "slide 70%", 0.7, 1],
  ["fp-slide-medio.y4m", "slide 50%", 0.5, 1],
  ["fp-slide-distante.y4m", "slide 32%", 0.32, 1],
  ["fp-slide-muito-distante.y4m", "slide 20%", 0.2, 1],
  ["fp-slide-sala-clara.y4m", "slide 50% sala clara", 0.5, 1],
  ["fp-slide-distante.y4m", "slide 32% com 2x", 0.32, 2],
]) {
  const caixas = await medir(cena, zoom);
  const validas = caixas.filter(Boolean);
  if (validas.length === 0) {
    check(false, `${rot}: moldura desenhada`, "nenhuma");
    continue;
  }
  const c = validas[validas.length - 1];
  let esperada = slideNaTela(fracao);
  if (zoom > 1) {
    // O zoom digital amplia em torno do centro da tela.
    esperada = {
      x: VW / 2 + (esperada.x - VW / 2) * zoom,
      y: VH / 2 + (esperada.y - VH / 2) * zoom,
      w: esperada.w * zoom, h: esperada.h * zoom,
    };
  }
  const s = sobreposicao(c, esperada);
  /*
   * Quanto a moldura se mexe entre quadros parados — "dançando" é ruído.
   *
   * Antes: a maior distância entre a ÚLTIMA amostra e qualquer outra. Um
   * único quadro entregue tarde pela máquina (não pelo detector) virava
   * "tremor", e o mesmo cenário passava ou falhava entre execuções sem o
   * código mudar — medido, registrado em docs/spike-foco-camera.md como
   * problema pré-existente. Agora: a diferença entre quadros CONSECUTIVOS,
   * e a MEDIANA dessas diferenças — um outlier isolado não move a mediana
   * do jeito que move um máximo.
   */
  const deltasConsecutivos = [];
  for (let i = 1; i < validas.length; i++) {
    const a = validas[i - 1], b = validas[i];
    deltasConsecutivos.push(Math.abs(b.x - a.x) + Math.abs(b.y - a.y) + Math.abs(b.w - a.w) + Math.abs(b.h - a.h));
  }
  deltasConsecutivos.sort((x, y) => x - y);
  const tremor = deltasConsecutivos[Math.floor(deltasConsecutivos.length / 2)] ?? 0;
  const ok = s >= 0.6 && tremor <= 24;
  if (!ok) fail++;
  console.log(`${(ok ? "[ok]  " : "[FAIL]") + " " + rot.padEnd(22)} ` +
    `${`${c.x.toFixed(0)},${c.y.toFixed(0)} ${c.w.toFixed(0)}×${c.h.toFixed(0)}`.padEnd(22)} ` +
    `${`${esperada.x.toFixed(0)},${esperada.y.toFixed(0)} ${esperada.w.toFixed(0)}×${esperada.h.toFixed(0)}`.padEnd(20)} ` +
    `${(s * 100).toFixed(0)}%`.padStart(6) + `   ${tremor.toFixed(0)}px`);
}
console.log(fail ? `\n${fail} FALHA(S)` : "\nTUDO PASSOU");
process.exit(fail ? 1 : 0);

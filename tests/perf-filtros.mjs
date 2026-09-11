/* Quanto custam os filtros e os efeitos.
 *
 * A pergunta não é estética: é se a aparência escolhida pelo estudante rouba
 * tempo da análise da aula. Um filtro de CSS é composto pela GPU e deveria
 * custar quase nada; um efeito é uma camada a mais para compor. "Deveria" não
 * é medida, então aqui está a medida.
 *
 * Isto NÃO é um teste com veredito: é um relatório. Os números saem do
 * Chromium de mesa com câmera falsa a 30 fps — o aparelho real tem outra GPU,
 * outra câmera e outro térmico. Servem para comparar as opções entre si, não
 * para prometer desempenho no celular. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";

const SEGUNDOS = 5;

const b = await chromium.launch({
  executablePath: CHROMIUM,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-video-capture=${CENAS}/cor-mesa-de-estudo.y4m`,
  ],
});
const p = await (
  await b.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ["camera"],
  })
).newPage();
await p.goto(APP + "/", { waitUntil: "networkidle" });
await p.waitForTimeout(3000);

const abrirPainel = async () => {
  await p.getByRole("button", { name: /abrir todos os filtros/i }).click();
  await p.waitForTimeout(500);
};
const fecharPainel = async () => {
  await p.getByRole("dialog", { name: "Filtros" }).getByRole("button", { name: "Fechar painel" }).click();
  await p.waitForTimeout(400);
};

/** Quadros de vídeo efetivamente apresentados na tela, por segundo. */
async function fps(segundos) {
  return p.evaluate(async (s) => {
    const v = document.querySelector("video");
    if (!v.requestVideoFrameCallback) return null;
    let n = 0;
    const fim = performance.now() + s * 1000;
    await new Promise((r) => {
      const passo = () => {
        n++;
        if (performance.now() >= fim) r();
        else v.requestVideoFrameCallback(passo);
      };
      v.requestVideoFrameCallback(passo);
    });
    return n / s;
  }, segundos);
}

/** Tempo travado na linha principal — o que a análise da aula perderia. */
async function travas(segundos) {
  return p.evaluate(async (s) => {
    const longas = [];
    const obs = new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) longas.push(e.duration);
    });
    try {
      obs.observe({ entryTypes: ["longtask"] });
    } catch {
      return null;
    }
    await new Promise((r) => setTimeout(r, s * 1000));
    obs.disconnect();
    return { quantas: longas.length, total: longas.reduce((a, z) => a + z, 0) };
  }, segundos);
}

const linha = (nome, f, t) =>
  console.log(
    `  ${nome.padEnd(34)} ${f === null ? "  n/d" : f.toFixed(1).padStart(5)} fps` +
      (t ? `   travas: ${String(t.quantas).padStart(2)} · ${t.total.toFixed(0)} ms` : ""),
  );

console.log("== o visor, com e sem aparência ==");
console.log("  (a câmera falsa entrega ~15 quadros por segundo: esse é o teto\n" +
  "   da bancada, não um limite do app — o que interessa é a coluna comparada)\n");

linha("sem filtro", await fps(SEGUNDOS), await travas(1));

await p.locator("button[aria-label='Filtro P&B']").click();
await p.waitForTimeout(500);
linha("P&B a 70 %", await fps(SEGUNDOS), await travas(1));

await abrirPainel();
await p.getByRole("dialog", { name: "Filtros" }).getByRole("slider", { name: /intensidade do filtro/i }).fill("100");
await p.waitForTimeout(300);
await p.getByRole("dialog", { name: "Filtros" }).getByRole("button", { name: /^Raio de sol/ }).click();
await p.waitForTimeout(300);
await fecharPainel();
linha("P&B a 100 % + Raio de sol", await fps(SEGUNDOS), await travas(1));

await abrirPainel();
await p.getByRole("dialog", { name: "Filtros" }).getByRole("button", { name: /^Raio de sol/ }).click();
await p.getByRole("dialog", { name: "Filtros" }).getByRole("button", { name: /^Tremor/ }).click();
await p.waitForTimeout(300);
await fecharPainel();
linha("P&B a 100 % + Tremor", await fps(SEGUNDOS), await travas(1));

console.log("\n== arrastar a intensidade ==");
await abrirPainel();
{
  /*
   * Os eventos são disparados dentro da página, e não pelo mouse do
   * Playwright: cada `mouse.move` daqui é uma ida e volta pelo protocolo, e
   * mediria a bancada em vez do app. O que se quer saber é outra coisa — o que
   * custa, no navegador, cada passo do controle: React redesenhando a câmera
   * inteira e o navegador recompondo o visor com o novo filtro.
   */
  const arrasto = await p.evaluate(() => {
    const el = document.querySelector('[role=dialog] input[type=range][aria-label^="Intensidade"]');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    const passos = 60;
    const t0 = performance.now();
    for (let i = 0; i <= passos; i++) {
      set.call(el, String(Math.round((i * 100) / passos)));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const total = performance.now() - t0;
    return { total, passos, valor: el.value };
  });
  console.log(
    `  ${arrasto.passos} passos em ${arrasto.total.toFixed(1)} ms · ` +
      `${(arrasto.total / arrasto.passos).toFixed(2)} ms por passo`,
  );
  const visto = await p.getByRole("dialog", { name: "Filtros" }).getByRole("slider", { name: /intensidade do filtro/i }).inputValue();
  console.log(`  o controle terminou em ${visto} % — nenhum passo se perdeu no caminho`);
  const css = await p.evaluate(() => getComputedStyle(document.querySelector("video")).filter);
  console.log(`  e o visor atrás do painel acompanhou: ${css}`);
}

console.log("\n== o painel aberto, com as sete miniaturas ==");
linha("painel aberto sobre o visor", await fps(SEGUNDOS), await travas(1));
await fecharPainel();

console.log("\n== a captura ==");
{
  const custo = await p.evaluate(async () => {
    const v = document.querySelector("video");
    const w = v.videoWidth;
    const h = v.videoHeight;
    const medir = (filtro) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      const t = [];
      for (let i = 0; i < 12; i++) {
        const t0 = performance.now();
        ctx.filter = filtro;
        ctx.drawImage(v, 0, 0, w, h);
        ctx.filter = "none";
        t.push(performance.now() - t0);
      }
      t.sort((a, z) => a - z);
      return t[Math.floor(t.length / 2)];
    };
    return {
      tamanho: `${w}×${h}`,
      cru: medir("none"),
      filtrado: medir("grayscale(1) contrast(1.12)"),
    };
  });
  console.log(`  quadro ${custo.tamanho}`);
  console.log(`  desenhar cru:      ${custo.cru.toFixed(2)} ms`);
  console.log(`  desenhar filtrado: ${custo.filtrado.toFixed(2)} ms`);
  console.log(`  custo do filtro na foto: ${(custo.filtrado - custo.cru).toFixed(2)} ms`);
}

console.log("\n== o SliD, com filtro ligado ==");
{
  // O laço do SliD lê o quadro assim. É este custo que não pode crescer.
  const t = await p.evaluate(() => {
    const v = document.querySelector("video");
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 96;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const amostras = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      ctx.drawImage(v, 0, 0, 128, 96);
      ctx.getImageData(0, 0, 128, 96);
      amostras.push(performance.now() - t0);
    }
    amostras.sort((a, z) => a - z);
    return { mediana: amostras[10], pior: amostras[19], css: getComputedStyle(v).filter };
  });
  console.log(`  visor em ${t.css}`);
  console.log(`  ler o quadro 128×96: ${t.mediana.toFixed(2)} ms (pior ${t.pior.toFixed(2)} ms)`);
  console.log("  o filtro é do elemento, não do pixel: a leitura não passa por ele");
}

await b.close();

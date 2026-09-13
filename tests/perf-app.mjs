/* Quanto o app custa, inteiro.

   Relatório, não teste com veredito. Os números saem do Chromium de mesa com
   câmera falsa — o celular tem outra GPU, outra câmera e outro térmico. O que
   eles servem para responder é uma pergunta comparativa: o app ficou mais caro
   ao longo desta semana? */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";

const b = await chromium.launch({
  executablePath: CHROMIUM,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-video-capture=${CENAS}/fp-aula-slide-projetado.y4m`,
  ],
});
const p = await (
  await b.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ["camera", "microphone"],
  })
).newPage();

console.log("== abertura ==");
const t0 = Date.now();
await p.goto(APP + "/", { waitUntil: "networkidle" });
const carregou = Date.now() - t0;
await p.waitForTimeout(3000);

const rede = await p.evaluate(() => {
  const r = performance.getEntriesByType("resource");
  const soma = (f) =>
    r.filter(f).reduce((a, x) => a + (x.encodedBodySize || x.transferSize || 0), 0);
  const nav = performance.getEntriesByType("navigation")[0];
  return {
    arquivos: r.length,
    js: soma((x) => /\.js$/.test(x.name)),
    css: soma((x) => /\.css$/.test(x.name)),
    tesseract: soma((x) => /tesseract/.test(x.name)),
    total: soma(() => true),
    domPronto: nav ? Math.round(nav.domContentLoadedEventEnd) : 0,
    primeiroPinta:
      performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0,
  };
});

console.log(`  página pronta em ${carregou} ms (rede local)`);
console.log(`  primeiro pixel: ${Math.round(rede.primeiroPinta)} ms · DOM: ${rede.domPronto} ms`);
console.log(`  ${rede.arquivos} arquivos · JS ${(rede.js / 1024).toFixed(0)} kB · CSS ${(rede.css / 1024).toFixed(0)} kB`);
console.log(
  `  Tesseract baixado na abertura: ${(rede.tesseract / 1024).toFixed(0)} kB ` +
    `${rede.tesseract === 0 ? "— ele só entra quando alguém pede" : "(DEVIA SER ZERO)"}`,
);

console.log("\n== a câmera parada ==");
const medirFps = (segundos) =>
  p.evaluate(async (s) => {
    const v = document.querySelector("video");
    if (!v?.requestVideoFrameCallback) return null;
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

const travas = (segundos) =>
  p.evaluate(async (s) => {
    const longas = [];
    const obs = new PerformanceObserver((l) => {
      for (const e of l.getEntries()) longas.push(e.duration);
    });
    try {
      obs.observe({ entryTypes: ["longtask"] });
    } catch {
      return null;
    }
    await new Promise((r) => setTimeout(r, s * 1000));
    obs.disconnect();
    return { n: longas.length, ms: longas.reduce((a, z) => a + z, 0) };
  }, segundos);

const linha = async (nome) => {
  const f = await medirFps(4);
  const t = await travas(2);
  console.log(
    `  ${nome.padEnd(36)} ${f === null ? " n/d" : f.toFixed(1).padStart(5)} fps` +
      (t ? ` · travas ${String(t.n).padStart(2)} (${t.ms.toFixed(0)} ms)` : ""),
  );
};

await linha("Foto, com detecção do SliD rodando");

await p.getByRole("button", { name: "SliD", exact: true }).click();
await p.waitForTimeout(3500);
await linha("SliD ativo, com Listen gravando");

const memoria = await p.evaluate(() =>
  performance.memory
    ? Math.round(performance.memory.usedJSHeapSize / 1048576)
    : null,
);
console.log(`  memória JS em uso: ${memoria === null ? "n/d" : memoria + " MB"}`);

console.log("\n== a aula guardada ==");
const mostrar = p.getByRole("button", { name: "Mostrar controles" });
if (await mostrar.count()) await mostrar.click();
await p.waitForTimeout(700);
await p.getByRole("button", { name: /^Encerrar$/ }).first().click();
await p.waitForTimeout(700);
await p
  .getByRole("dialog", { name: "Encerrar a aula" })
  .getByRole("button", { name: /Salvar aula|^Encerrar$/ })
  .click();
await p.waitForTimeout(2500);

/* A leitura dos momentos não é medida aqui de propósito: ela roda em segundo
   plano no resumo e não tem um marcador na tela que dê para esperar sem
   inventar. O custo do OCR está medido onde ele é explícito — no Scanner,
   dentro do `qa-scanner`. */

await p.getByRole("button", { name: /salvar|guardar/i }).first().click();
await p.waitForTimeout(3000);

await p.getByRole("button", { name: "Galeria", exact: true }).click();
await p.waitForTimeout(1200);
await p
  .getByRole("tablist", { name: "Filtrar a galeria" })
  .getByRole("tab", { name: /^SliD/ })
  .click();
await p.waitForTimeout(700);

/* Só o toque e o desenho, sem as esperas do teste no meio — a primeira versão
   somava 1900 ms de `waitForTimeout` meus e reportava isso como custo do app. */
const tAbrir = Date.now();
await p.locator("article button").first().click();
await p.waitForFunction(() => /Voltar/.test(document.body.innerText), null, {
  timeout: 15000,
});
console.log(`  abrir a aula (toque → tela pronta): ${Date.now() - tAbrir} ms`);

const trocaDeAba = await p.evaluate(async () => {
  const abas = [
    ...document
      .querySelector('[role=tablist][aria-label="Conteúdo da aula"]')
      .querySelectorAll("[role=tab]"),
  ];
  const t = [];
  for (const aba of abas) {
    const t0 = performance.now();
    aba.click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    t.push(performance.now() - t0);
  }
  return t;
});
console.log(
  `  trocar de aba: ${trocaDeAba.map((x) => x.toFixed(1)).join(" · ")} ms`,
);

const depois = await p.evaluate(() =>
  performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
);
console.log(`  memória JS depois de tudo: ${depois === null ? "n/d" : depois + " MB"}`);

await b.close();

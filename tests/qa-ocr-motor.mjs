/* O motor de OCR do Scanner, reaproveitado entre uma folha e outra.
 *
 * Vídeo de teste real: "Lendo a folha…" terminando em "A leitura não
 * terminou neste aparelho" — numa imagem legível, sem razão óbvia para
 * falhar. Investigado: `lerImagem` criava e desligava um `createWorker()`
 * (carregar ~4 MB de WASM + dicionário) A CADA folha, inclusive a cada
 * "Tentar de novo". Esta suíte prova que isso mudou — um trabalhador só,
 * vivo entre leituras — e que a folha nunca vai a um motor de 12 MP quando
 * uma versão bem menor já basta para ler letra.
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

async function abrir(cena) {
  const b = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${CENAS}/${cena}`,
    ],
  });
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ["camera"],
  });
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  // Conta quantos Web Workers a página instancia — é assim que o
  // tesseract.js sobe o motor. Um número maior que 1 depois de duas leituras
  // é o worker sendo recriado.
  await p.addInitScript(() => {
    window.__workers = 0;
    const OriginalWorker = window.Worker;
    window.Worker = new Proxy(OriginalWorker, {
      construct(target, args) {
        window.__workers += 1;
        return new target(...args);
      },
    });
  });
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  return { b, p, erros };
}

async function entrarNoScanner(p) {
  await p.getByRole("button", { name: "Modos", exact: true }).click();
  await p.waitForTimeout(700);
  await p.getByRole("dialog").getByRole("button", { name: /^Scanner/ }).first().click();
  await p.waitForTimeout(2500);
}

async function capturarEExtrair(p) {
  await p
    .getByRole("button", { name: /Tirar foto|Capturar|obturador/i })
    .first()
    .click();
  await p.waitForTimeout(1200);
  const revisao = p.getByRole("dialog", { name: "Revisar documento" });
  await revisao.getByRole("button", { name: /Extrair texto/i }).click();
  // `innerText` seria maiúsculo aqui — o `<h2>` é uppercase por CSS, não por
  // conteúdo — então o regex de espera precisa ser insensível a caixa, e a
  // checagem de sucesso também.
  await revisao.getByText(/Texto da folha|A leitura não terminou|Não consegui ler/i).waitFor({
    timeout: 50000,
  });
  return revisao;
}

console.log("== o motor sobe uma vez só, e continua vivo na folha seguinte ==");
{
  const { b, p, erros } = await abrir("doc-folha-com-texto.y4m");
  await entrarNoScanner(p);

  const revisao1 = await capturarEExtrair(p);
  const trechoPos1 = /texto da folha/i.test(await revisao1.innerText());
  check(trechoPos1, "a primeira folha lê texto de verdade");
  const workersApos1 = await p.evaluate(() => window.__workers);
  check(workersApos1 >= 1, "o motor subiu para a primeira leitura", `${workersApos1} worker(s)`);

  // Refazer e capturar de novo: uma segunda folha, na mesma sessão do app.
  await revisao1.getByRole("button", { name: /Refazer/i }).click();
  await p.waitForTimeout(1000);
  const revisao2 = await capturarEExtrair(p);
  const trechoPos2 = /texto da folha/i.test(await revisao2.innerText());
  check(trechoPos2, "a segunda folha também lê texto");

  const workersApos2 = await p.evaluate(() => window.__workers);
  check(
    workersApos2 === workersApos1,
    "e o motor NÃO subiu de novo — foi reaproveitado",
    `${workersApos1} → ${workersApos2}`,
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== a imagem enviada ao motor é bem menor que a foto original ==");
{
  const { b, p, erros } = await abrir("doc-folha-com-texto.y4m");
  await entrarNoScanner(p);

  // Espiona o tamanho do Blob que chega no reconhecimento, sem depender de
  // decidir o pipeline inteiro de novo aqui.
  await p.evaluate(() => {
    window.__ultimoTamanhoOcr = null;
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb, tipo, qualidade) {
      original.call(this, (blob) => {
        window.__ultimoTamanhoOcr = { w: this.width, h: this.height };
        cb(blob);
      }, tipo, qualidade);
    };
  });

  await capturarEExtrair(p);
  const tamanho = await p.evaluate(() => window.__ultimoTamanhoOcr);
  check(
    tamanho !== null && Math.max(tamanho.w, tamanho.h) <= 1600,
    "o maior lado da imagem lida não passa de 1600px",
    tamanho ? `${tamanho.w}×${tamanho.h}` : "nenhum canvas capturado",
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);

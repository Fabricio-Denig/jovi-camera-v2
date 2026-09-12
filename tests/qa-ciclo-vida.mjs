/* Reload, segundo plano e orientação — prioridade 10 da lista de fechamento.
 *
 * Três coisas que um celular de verdade faz sem avisar: a pessoa recarrega a
 * página sem querer, troca de app e volta, ou gira o aparelho. Nenhuma das
 * três pode quebrar a tela nem perder o que já foi salvo. Não mexe em
 * frameAnalysis.ts, useSlidSession.ts, limiares, multiescala, curadoria ou
 * guarda de reenquadramento.
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";
import { AULA, abrirAula, semearAula } from "./semear-aula.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

async function abrir({ largura = 390, altura = 844 } = {}) {
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
      viewport: { width: largura, height: altura },
      isMobile: true,
      hasTouch: true,
      permissions: ["camera", "microphone"],
    })
  ).newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2600);
  return { b, p, erros };
}

const semOverflow = (p) =>
  p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

console.log("== reload no meio de uma sessão SliD: não quebra, não perde a aula salva ==");
{
  const { b, p, erros } = await abrir();
  await semearAula(p);
  await p.waitForTimeout(2500);

  // A câmera detecta e a sessão começa — não precisa terminar a aula, só
  // provar que o app está no meio de alguma coisa quando o reload acontece.
  const detectouAntes = /Aula detectada/.test(await p.locator("body").innerText());
  check(detectouAntes, "detectou o slide antes do reload (pré-condição)");

  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(2600);
  const corpo = await p.locator("body").innerText();
  check(!/undefined|NaN|\[object Object\]/.test(corpo), "sem lixo de estado quebrado na tela após reload");
  check(erros.length === 0, "sem erro de runtime no reload", erros[0] ?? "");

  // A aula semeada antes do reload continua na galeria — o reload não é
  // destrutivo para o que já estava salvo (IndexedDB sobrevive ao reload).
  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(800);
  await p.getByRole("tablist", { name: "Filtrar a galeria" }).getByRole("tab", { name: /^SliD/ }).click();
  await p.waitForTimeout(600);
  await abrirAula(p);
  const cabecalho = await p.locator("body").innerText();
  check(cabecalho.includes(AULA.subject), "a aula salva antes do reload continua acessível depois");
  await b.close();
}

console.log("\n== segundo plano e volta: a câmera se recupera, a tela não fica presa ==");
{
  const { b, p, erros } = await abrir();
  await p.waitForTimeout(1000);

  // Esconde a aba (troca de app) e volta — o mesmo gesto de responder uma
  // ligação ou checar outra coisa no meio da aula.
  await p.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await p.waitForTimeout(600);
  await p.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await p.waitForTimeout(2000);

  const corpo = await p.locator("body").innerText();
  check(!/undefined|NaN/.test(corpo), "sem lixo de estado ao voltar do segundo plano");
  check(erros.length === 0, "sem erro de runtime ao voltar do segundo plano", erros[0] ?? "");

  // A câmera continua respondendo: consegue trocar de modo depois de voltar.
  await p.getByRole("button", { name: "Modos", exact: true }).click();
  await p.waitForTimeout(500);
  const catalogoAbriu = (await p.getByRole("dialog").count()) === 1;
  check(catalogoAbriu, "o app continua interativo depois de voltar do segundo plano");
  await b.close();
}

console.log("\n== girar o aparelho: sem rolagem lateral, sem quebrar, em quatro telas ==");
{
  const { b, p, erros } = await abrir();
  // Câmera, em retrato normal.
  check(await semOverflow(p), "câmera em retrato: sem rolagem lateral");

  await p.setViewportSize({ width: 844, height: 390 });
  await p.waitForTimeout(1000);
  check(await semOverflow(p), "câmera em paisagem: sem rolagem lateral");
  check(erros.length === 0, "câmera em paisagem: sem erro de runtime", erros[0] ?? "");

  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(800);

  // Galeria com uma aula salva.
  await semearAula(p);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(800);
  check(await semOverflow(p), "galeria em retrato: sem rolagem lateral");
  await p.setViewportSize({ width: 844, height: 390 });
  await p.waitForTimeout(800);
  check(await semOverflow(p), "galeria em paisagem: sem rolagem lateral");
  check(erros.length === 0, "galeria em paisagem: sem erro de runtime", erros[0] ?? "");

  // A aula aberta (Resumo).
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(600);
  await p.getByRole("tablist", { name: "Filtrar a galeria" }).getByRole("tab", { name: /^SliD/ }).click();
  await p.waitForTimeout(600);
  await abrirAula(p);
  check(await semOverflow(p), "aula aberta em retrato: sem rolagem lateral");
  await p.setViewportSize({ width: 844, height: 390 });
  await p.waitForTimeout(800);
  check(await semOverflow(p), "aula aberta em paisagem: sem rolagem lateral");
  check(erros.length === 0, "aula aberta em paisagem: sem erro de runtime", erros[0] ?? "");

  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);

/* A aula que se mexe. Um quadro parado nunca testa o que quebra de verdade:
   o slide troca, o slide cresce, o cursor anda, a mão treme, o projetor
   reflete, a luz cai. Cada cena roda em tempo real pela câmera do navegador. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";
const D = CENAS;
let fail = 0;
const check = (ok, l, e = "") => { console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`); if (!ok) fail++; };

async function aula(cena, segundos, { zoomEm = null } = {}) {
  const b = await chromium.launch({ executablePath: CHROMIUM,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${D}/${cena}`] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["camera"] })).newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  await p.getByRole("button", { name: "SliD", exact: true }).click();

  // A trilha lateral conta os momentos ao vivo, sem encerrar a aula.
  const marcos = [];
  for (let s = 0; s < segundos; s++) {
    await p.waitForTimeout(1000);
    if (zoomEm === s) await p.getByRole("button", { name: "Aproximar 2 vezes" }).click().catch(() => {});
    const n = await p.evaluate(() => {
      const trilha = [...document.querySelectorAll("img")].filter((i) => i.closest("div.size-\\[58px\\]"));
      const mais = [...document.querySelectorAll("span")].find((x) => /^\+\d+$/.test(x.textContent ?? ""));
      return trilha.length + (mais ? Number(mais.textContent.slice(1)) : 0);
    });
    marcos.push(n);
  }
  const dica = await p.evaluate(() => {
    const el = [...document.querySelectorAll("[role=status]")].find((x) => /distante|pequeno/i.test(x.textContent ?? ""));
    return el ? el.textContent.trim() : null;
  });
  // Encerrar e ler o resumo: lá cada momento tem rótulo, e o rótulo é o que
  // separa "refinou o mesmo tópico" de "nunca percebeu que mudou".
  const revelar = p.locator('button[aria-label="Mostrar controles"]');
  if (await revelar.count()) { await revelar.click(); await p.waitForTimeout(400); }
  await p.getByRole("button", { name: "Encerrar", exact: true }).click().catch(() => {});
  await p.waitForTimeout(500);
  const dialogo = p.getByRole("dialog");
  if (await dialogo.count()) {
    const salvar = dialogo.getByRole("button", { name: "Salvar aula" });
    if (await salvar.count()) await salvar.click();
    else await dialogo.getByRole("button", { name: "Encerrar" }).click();
  }
  await p.waitForTimeout(2500);
  const rotulos = await p.evaluate(() =>
    [...document.querySelectorAll("ol article")].map((a) => (a.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60)));
  await b.close();
  return { momentos: rotulos.length || marcos[marcos.length - 1], serie: marcos, rotulos, dica, erros };
}

console.log("== O que TEM de virar momento ==");
// As cenas de troca têm slide a 50 % da largura. Medido fora do navegador,
// nesse tamanho a troca de slide vira refinamento a 1x e vira momento novo a
// 2x — por isso cada uma roda duas vezes, e por isso a dica de zoom existe.
{
  const r = await aula("din-troca-de-slide.y4m", 32);
  check(r.momentos >= 1, "troca de slide a 1x: guarda a aula", `${r.momentos} · ${r.rotulos.join(" | ")}`);
  check(r.momentos <= 6, "e sem rajada", `${r.momentos}`);
  check(r.momentos >= 2, "e a troca de slide entra, sem precisar de zoom", `${r.momentos} · ${r.rotulos.join(" | ")}`);
}
{
  const r = await aula("din-troca-de-slide.y4m", 32, { zoomEm: 6 });
  check(r.momentos >= 2, "troca de slide com 2x: o slide novo entra", `${r.momentos} · ${r.rotulos.join(" | ")}`);
  check(r.momentos <= 8, "e sem rajada", `${r.momentos}`);
}
{
  const r = await aula("din-build.y4m", 32, { zoomEm: 6 });
  check(r.momentos >= 1, "build: o slide que cresce é guardado", `${r.momentos} momento(s)`);
  check(r.momentos <= 3, "e o build refina em vez de empilhar", `${r.momentos} · ${r.rotulos.join(" | ")}`);
}
{
  const r = await aula("din-luz-baixa.y4m", 20);
  check(r.momentos >= 1, "luz baixa: ainda enxerga a aula", `${r.momentos} momento(s)`);
}
{
  const r = await aula("din-troca-com-professor.y4m", 32, { zoomEm: 6 });
  check(r.momentos >= 2, "troca de slide com o professor na frente", `${r.momentos} · ${r.rotulos.join(" | ")}`);
}

console.log("\n== O que NÃO pode virar momento ==");
for (const [cena, rot, segundos, teto] of [
  ["din-cursor.y4m", "cursor do professor sobre slide parado", 26, 2],
  ["din-tremor.y4m", "celular apoiado tremendo", 26, 2],
  ["din-reflexo.y4m", "reflexo do projetor atravessando", 26, 2],
  ["din-professor.y4m", "professor passando, slide igual", 26, 2],
]) {
  const r = await aula(cena, segundos);
  check(r.momentos <= teto, `${rot}: no máximo ${teto}`, `${r.momentos} momento(s) · ${r.serie.join(",")}`);
  check(r.erros.length === 0, `${rot}: sem erro de runtime`, r.erros[0] ?? "");
}

console.log("\n== E a guarda de reenquadramento continua segurando ==");
{
  const r = await aula("din-troca-na-sala.y4m", 32);
  check(r.momentos >= 2, "sala com porta e janela: a troca de slide entra", `${r.momentos} · ${r.rotulos.join(" | ")}`);
}
{
  const r = await aula("din-reenquadra.y4m", 32);
  check(r.momentos <= 2, "a sala inteira deslizando NÃO vira momento novo", `${r.momentos} · ${r.rotulos.join(" | ")}`);
}

console.log(fail ? `\n${fail} FALHA(S)` : "\nTUDO PASSOU");
process.exit(fail ? 1 : 0);

/* A bateria que o Fabricio pediu: slide a várias distâncias e contrastes,
   passando pela câmera do navegador. É o teste mais próximo de uma sala. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";
const D = CENAS;
let fail = 0;
const check = (ok, l, e = "") => { console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`); if (!ok) fail++; };

const olhar = async (cena, segundos = 8) => {
  const b = await chromium.launch({ executablePath: CHROMIUM,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${D}/${cena}`] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["camera"] })).newPage();
  await p.goto(APP + "/?debug=slid", { waitUntil: "networkidle" });
  const inicio = Date.now();
  let detectouEm = null;
  for (let i = 0; i < segundos * 2; i++) {
    await p.waitForTimeout(500);
    if (detectouEm === null && (await p.getByRole("button", { name: /ativar SliD/ }).count()) > 0)
      detectouEm = ((Date.now() - inicio) / 1000).toFixed(1);
  }
  const painel = await p.locator("[data-slid-debug]").innerText().catch(() => "");
  const moldura = await p.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) => String(d.className).includes("slid-settle"));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  await b.close();
  const veredito = painel.split("\n").find((l) => l.startsWith("veredito")) ?? "";
  const dica = /2x deve ajudar/.test(painel);
  return { detectouEm, veredito: veredito.replace("veredito ", ""), dica, moldura };
};

console.log("== POSITIVOS: slide a várias distâncias e contrastes ==");
for (const [cena, rotulo, deve] of [
  ["fp-slide-perto.y4m", "slide perto (70% da largura)", true],
  ["fp-slide-medio.y4m", "slide médio (50%)", true],
  ["fp-slide-distante.y4m", "slide distante (32%)", true],
  ["fp-slide-muito-distante.y4m", "slide muito distante (20%)", true],
  ["fp-slide-sala-clara.y4m", "slide 50% em sala clara", true],
  ["fp-slide-distante-sala-clara.y4m", "slide 32% em sala clara", true],
  ["fp-aula-lousa-branca-escrita.y4m", "lousa branca escrita", true],
  ["fp-aula-caderno-escrito.y4m", "caderno escrito", true],
]) {
  const r = await olhar(cena);
  const ok = deve === (r.detectouEm !== null);
  if (!ok) fail++;
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${rotulo.padEnd(32)} ${r.detectouEm ? `detectou em ${r.detectouEm}s` : "NÃO detectou"}` +
    `${r.moldura ? ` · moldura ${r.moldura.w}×${r.moldura.h} em ${r.moldura.x},${r.moldura.y}` : " · sem moldura"}` +
    `${r.dica ? " · pede 2x" : ""}  [${r.veredito}]`);
}

console.log("\n== NEGATIVOS: nada disso pode sugerir ==");
for (const [cena, rotulo] of [
  ["fp-parede-rebocada-textura-forte.y4m", "parede rebocada"],
  ["fp-mesa-de-madeira-veio-marcado.y4m", "mesa de madeira"],
  ["fp-teclado-do-notebook.y4m", "teclado"],
  ["fp-cortina-com-dobras.y4m", "cortina"],
  ["fp-tecido-carpete.y4m", "carpete"],
  ["fp-tela-ligada-sem-conteudo.y4m", "tela vazia"],
  ["fp-piso-de-ladrilho.y4m", "piso"],
]) {
  const r = await olhar(cena, 6);
  const ok = r.detectouEm === null;
  if (!ok) fail++;
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${rotulo.padEnd(32)} ${r.detectouEm ? `SUGERIU em ${r.detectouEm}s` : "não sugeriu"}` +
    `${r.dica ? " · PEDIU 2x (não devia)" : ""}  [${r.veredito}]`);
  if (r.dica) fail++;
}

console.log(fail ? `\n${fail} FALHA(S)` : "\nTUDO PASSOU");
process.exit(fail ? 1 : 0);

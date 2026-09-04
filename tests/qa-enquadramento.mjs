/* O momento guardado tem o enquadramento que estava na tela?
   O visor usa object-cover: num celular em pé com sensor deitado ele mostra
   ~35 % da largura do quadro. Guardar o quadro inteiro é guardar o que o
   estudante tirou de propósito da mira. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";
const D = CENAS;
const VW = 390, VH = 844;
let fail = 0;
const check = (ok, l, e = "") => { console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`); if (!ok) fail++; };

async function medir(cena, { zoom = 1 } = {}) {
  const b = await chromium.launch({ executablePath: CHROMIUM,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${D}/${cena}`] });
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, isMobile: true, hasTouch: true, permissions: ["camera"] })).newPage();
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  // O visor mostra isto agora, e é contra isto que o momento é comparado.
  const visor = await p.evaluate(() => {
    const v = document.querySelector("video");
    return { fw: v.videoWidth, fh: v.videoHeight, vw: v.clientWidth, vh: v.clientHeight };
  });
  await p.getByRole("button", { name: "SliD", exact: true }).click();
  if (zoom > 1) {
    await p.waitForTimeout(1200);
    await p.getByRole("button", { name: `Aproximar ${zoom} vezes` }).click();
  }
  await p.waitForTimeout(20000);
  const revelar = p.locator('button[aria-label="Mostrar controles"]');
  if (await revelar.count()) { await revelar.click(); await p.waitForTimeout(400); }
  await p.getByRole("button", { name: "Encerrar", exact: true }).click();
  await p.waitForTimeout(500);
  const dialogo = p.getByRole("dialog");
  if (await dialogo.count()) {
    const salvar = dialogo.getByRole("button", { name: "Salvar aula" });
    if (await salvar.count()) await salvar.click();
    else await dialogo.getByRole("button", { name: "Encerrar" }).click();
  }
  await p.waitForTimeout(2000);
  const imagem = await p.evaluate(async () => {
    const img = document.querySelector("ol article img");
    if (!img) return null;
    if (!img.complete) await img.decode().catch(() => {});
    return { w: img.naturalWidth, h: img.naturalHeight };
  });
  await b.close();
  return { visor, imagem };
}

// O que o object-cover deixa visível, calculado à parte do app.
function esperado({ fw, fh, vw, vh }, zoom) {
  const escala = Math.max(vw / fw, vh / fh);
  const w = Math.min(1, vw / (fw * escala)) * fw;
  const h = Math.min(1, vh / (fh * escala)) * fh;
  return { w: Math.round(w), h: Math.round(h), proporcao: w / h, zoom };
}

for (const [cena, rot, zoom] of [
  ["fp-slide-perto.y4m", "slide perto", 1],
  ["fp-aula-lousa-branca-escrita.y4m", "lousa escrita", 1],
  ["fp-slide-distante.y4m", "slide distante com 2x", 2],
]) {
  const { visor, imagem } = await medir(cena, { zoom });
  if (!imagem) { check(false, `${rot}: guardou algum momento`, "nenhum"); continue; }
  const alvo = esperado(visor, zoom);
  const prop = imagem.w / imagem.h;
  // O zoom recorta dentro da janela, não muda a proporção dela.
  const ok = Math.abs(prop - alvo.proporcao) / alvo.proporcao < 0.03;
  check(ok, `${rot}: o momento tem o enquadramento do visor`,
    `${imagem.w}×${imagem.h} (${prop.toFixed(3)}) vs visor ${alvo.w}×${alvo.h} (${alvo.proporcao.toFixed(3)})`);
  // E a tela é retrato: um momento mais largo que alto é o sensor vazando.
  check(prop < 1, `${rot}: o momento é retrato, como a tela`, prop.toFixed(3));
}

console.log(fail ? `\n${fail} FALHA(S)` : "\nTUDO PASSOU");
process.exit(fail ? 1 : 0);

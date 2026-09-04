/* A dica de enquadramento fala quando deve e cala quando não tem o que dizer.
   O risco desta funcionalidade não é ela faltar — é ela aparecer sobre uma
   parede e ensinar o estudante a ignorá-la. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";
const D = CENAS;
let fail = 0;
const check = (ok, l, e = "") => { console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`); if (!ok) fail++; };

async function dica(cena, { zoom = 1, segundos = 11 } = {}) {
  const b = await chromium.launch({ executablePath: CHROMIUM,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${D}/${cena}`] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["camera"] })).newPage();
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  if (zoom > 1) {
    await p.getByRole("button", { name: `Aproximar ${zoom} vezes` }).click();
  }
  let visto = null, sugeriu = false;
  for (let i = 0; i < segundos * 2; i++) {
    await p.waitForTimeout(500);
    const t = await p.evaluate(() => {
      const el = [...document.querySelectorAll("[role=status]")].find((x) => /distante/i.test(x.textContent ?? ""));
      return el ? el.textContent.trim() : null;
    });
    if (t) visto = t;
    if (await p.getByRole("button", { name: /ativar SliD/i }).count()) sugeriu = true;
  }
  await b.close();
  return { visto, sugeriu };
}

console.log("-- deve falar: conteúdo lá, pequeno demais para concluir --");
for (const [cena, rot] of [["fp-slide-fundo-da-sala.y4m", "slide no fundo da sala (12%)"],
                           ["fp-slide-quase-longe.y4m", "slide quase longe (16%)"]]) {
  const { visto, sugeriu } = await dica(cena);
  check(!!visto || sugeriu, `${rot}: dica ou detecção`, visto ?? (sugeriu ? "detectou direto" : "silêncio"));
  if (visto) check(/2x/.test(visto), `${rot}: aponta o 2x`, visto);
}

console.log("\n-- e o texto acompanha o zoom que já está em uso --");
{
  const { visto } = await dica("fp-slide-fundo-da-sala.y4m", { zoom: 2 });
  check(!visto || /3x|perto/.test(visto), "em 2x não manda tocar em 2x", visto ?? "sem dica");
}

console.log("\n-- deve calar: não há conteúdo de estudo nenhum --");
for (const [cena, rot] of [["fp-parede-rebocada-textura-forte.y4m", "parede"],
                           ["fp-tecido-carpete.y4m", "carpete"],
                           ["fp-teclado-do-notebook.y4m", "teclado"],
                           ["fp-tela-ligada-sem-conteudo.y4m", "tela vazia"]]) {
  const { visto } = await dica(cena, { segundos: 9 });
  check(!visto, `${rot}: sem dica`, visto ?? "silêncio");
}

console.log("\n-- e cala quando a aula foi reconhecida --");
for (const [cena, rot] of [["fp-slide-perto.y4m", "slide perto"],
                           ["fp-aula-lousa-branca-escrita.y4m", "lousa escrita"]]) {
  const { visto } = await dica(cena, { segundos: 9 });
  check(!visto, `${rot}: sem dica`, visto ?? "silêncio");
}

console.log(fail ? `\n${fail} FALHA(S)` : "\nTUDO PASSOU");
process.exit(fail ? 1 : 0);

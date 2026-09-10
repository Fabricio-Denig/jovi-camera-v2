/* O painel de modos: estrutura do Figma (`337:443`) e reação ao contexto real.
   O que mais importa aqui é o que ele NÃO faz — recomendar aula quando não há
   aula nenhuma na frente da câmera. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";
let fail = 0;
const check = (ok, l, e = "") => { console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`); if (!ok) fail++; };

async function abrir(cena, espera) {
  const b = await chromium.launch({ executablePath: CHROMIUM,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${CENAS}/${cena}`] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["camera"] })).newPage();
  const erros = []; p.on("pageerror", (e) => erros.push(String(e)));
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(espera);
  await p.getByRole("button", { name: "Modos", exact: true }).click();
  await p.waitForTimeout(800);
  return { b, p, erros };
}

console.log("== com aula na frente da câmera ==");
{
  const { b, p, erros } = await abrir("fp-aula-lousa-branca-escrita.y4m", 6000);
  const painel = p.getByRole("dialog", { name: "Todos os modos" });
  check((await painel.count()) === 1, "abre como painel sobre a câmera, não como página");

  const geo = await p.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    const r = d.getBoundingClientRect();
    return { topo: r.y, altura: r.height, tela: innerHeight };
  });
  check(geo.topo > 20, "a câmera continua visível acima do painel", `topo em ${geo.topo.toFixed(0)}px`);

  const sugerido = p.getByRole("button", { name: /sugerido agora/i });
  check((await sugerido.count()) === 1, "há uma seção de sugestão");
  check(/Aula detectada/.test(await sugerido.innerText()), "com selo do sinal real",
    (await sugerido.innerText()).replace(/\n/g, " · "));

  // O card sugerido é o maior — 163×134 contra 105×113 no Figma.
  const tamanhos = await p.evaluate(() => {
    const s = [...document.querySelectorAll('[role=dialog] button')]
      .filter((x) => /sugerido agora/i.test(x.getAttribute("aria-label") ?? ""));
    const comuns = [...document.querySelectorAll('[role=dialog] li button')];
    return { sug: s[0]?.getBoundingClientRect().width ?? 0,
             comum: comuns[0]?.getBoundingClientRect().width ?? 0 };
  });
  check(tamanhos.sug > tamanhos.comum * 1.2, "e é visivelmente maior que os comuns",
    `${tamanhos.sug.toFixed(0)}px vs ${tamanhos.comum.toFixed(0)}px`);

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== sem aula: não pode fingir recomendação ==");
{
  const { b, p, erros } = await abrir("fp-parede-rebocada-textura-forte.y4m", 4000);
  const texto = await p.getByRole("dialog").innerText();
  check(!/Aula detectada|Lousa detectada/i.test(texto), "nenhum selo de detecção");
  check(!/sugeridos agora/i.test(texto), "nenhuma seção de sugestão");
  check(/SliD/.test(texto), "mas o SliD continua disponível na lista");
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== os cards funcionam ==");
{
  const { b, p, erros } = await abrir("fp-parede-rebocada-textura-forte.y4m", 4000);
  // Grade de 3 colunas.
  const colunas = await p.evaluate(() => {
    const li = [...document.querySelectorAll('[role=dialog] ul li')].slice(0, 6);
    const xs = [...new Set(li.map((x) => Math.round(x.getBoundingClientRect().x)))];
    return xs.length;
  });
  check(colunas === 3, "grade de 3 colunas", `${colunas} colunas distintas`);

  // Nenhum card fica preso atrás da navegação inferior.
  await p.evaluate(() => document.querySelector("[role=dialog]").scrollTo(0, 99999));
  await p.waitForTimeout(600);
  const alcance = await p.evaluate(() => {
    const li = [...document.querySelectorAll('[role=dialog] ul li')];
    const ultimo = li[li.length - 1].getBoundingClientRect();
    const nav = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Galeria");
    return { fundo: ultimo.bottom, nav: nav ? nav.getBoundingClientRect().top : innerHeight };
  });
  check(alcance.fundo <= alcance.nav + 2, "o último card não fica atrás da navegação",
    `card termina em ${alcance.fundo.toFixed(0)}, nav começa em ${alcance.nav.toFixed(0)}`);

  // De volta ao topo: o teste anterior rolou até o fim, e um card fora de
  // vista não é o que se quer medir aqui.
  await p.evaluate(() => document.querySelector("[role=dialog]").scrollTo(0, 0));
  await p.waitForTimeout(500);
  // Um modo real seleciona e fecha o painel.
  await p.getByRole("dialog").getByRole("button", { name: /^Vídeo/ }).first().click();
  await p.waitForTimeout(900);
  check((await p.getByRole("dialog").count()) === 0, "escolher um modo real fecha o painel");
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== o modo em uso se anuncia, e continua anunciado ao reabrir ==");
{
  const { b, p, erros } = await abrir("fp-parede-rebocada-textura-forte.y4m", 4000);
  const ativo = async () => p.evaluate(() => {
    const cards = [...document.querySelectorAll("[role=dialog] li button")];
    const marcado = cards.find((x) => x.getAttribute("aria-pressed") === "true");
    return marcado
      ? { nome: marcado.innerText.split("\n")[0], diz: /Ativo/.test(marcado.innerText) }
      : null;
  });
  const inicial = await ativo();
  check(inicial?.nome === "Foto", "abre com Foto marcado", inicial?.nome ?? "nenhum");
  check(inicial?.diz === true, "e o card diz 'Ativo', não só uma borda azul");

  await p.getByRole("dialog").getByRole("button", { name: /^Vídeo/ }).first().click();
  await p.waitForTimeout(900);
  await p.getByRole("button", { name: "Modos", exact: true }).click();
  await p.waitForTimeout(800);
  const depois = await ativo();
  check(depois?.nome === "Vídeo", "ao reabrir, Vídeo está marcado", depois?.nome ?? "nenhum");
  check(depois?.diz === true, "e também diz 'Ativo'");

  // Um só de cada vez: dois cards marcados seria pior que nenhum.
  const quantos = await p.evaluate(() =>
    [...document.querySelectorAll("[role=dialog] li button")]
      .filter((x) => x.getAttribute("aria-pressed") === "true").length);
  check(quantos === 1, "e apenas um card marcado", `${quantos}`);
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== o vocabulário é do estudante, não do desenvolvedor ==");
{
  const { b, p } = await abrir("fp-parede-rebocada-textura-forte.y4m", 4000);
  const texto = await p.getByRole("dialog").innerText();
  check(!/\bparcial\b/i.test(texto), "nenhum card diz 'parcial'");
  check(/Prévia/.test(texto), "modos não reais dizem 'Prévia'");
  // O SliD foi validado em projetor real; não pode aparecer como prévia.
  const slid = await p.evaluate(() => {
    const c = [...document.querySelectorAll("[role=dialog] li button")].find((x) => /^SliD/.test(x.innerText));
    return c ? c.innerText : "";
  });
  check(!/Prévia/.test(slid), "o SliD não aparece como prévia", slid.replace(/\n/g, " · "));
  await b.close();
}

console.log("\n== um modo simulado não é botão morto ==");
{
  const { b, p, erros } = await abrir("fp-parede-rebocada-textura-forte.y4m", 4000);
  await p.getByRole("dialog").getByRole("button", { name: /^Panorâmica/ }).first().click();
  await p.waitForTimeout(1000);
  const corpo = await p.evaluate(() => document.body.innerText);
  check(/panor/i.test(corpo), "escolher um simulado leva a algum lugar que fala dele");
  check(!/undefined|NaN/.test(corpo), "e sem texto quebrado");
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log(fail ? `\n${fail} FALHA(S)` : "\nTUDO PASSOU");
process.exit(fail ? 1 : 0);

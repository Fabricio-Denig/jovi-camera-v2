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

console.log("\n== o Comida aplica uma aparência de verdade ==");
{
  const { b, p, erros } = await abrir("cor-mesa-de-estudo.y4m", 3000);
  await p.getByRole("dialog").getByRole("button", { name: /^Comida/ }).first().click();
  await p.waitForTimeout(2200);

  const corpo = await p.locator("body").innerText();
  check(!/Prévia/i.test(corpo), "sem selo de prévia");
  check(/Realce do prato/i.test(corpo), "com o controle de realce");

  const css = await p.evaluate(() => getComputedStyle(document.querySelector("video")).filter);
  check(css !== "none", "o visor recebe a aparência", css);
  check(/saturate/.test(css), "que realça a cor", css);

  /* A aparência é do modo, não da tira: uma oitava opção na tira daria ao
     `Filtros v2` algo que o wireframe não tem. */
  check(
    (await p.locator("button[aria-label^='Filtro ']").count()) === 0,
    "e a tira de filtros não aparece — a aparência é o modo",
  );

  // O realce mexe de verdade.
  const slider = p.getByRole("slider", { name: /realce do prato/i });
  await slider.fill("100");
  await p.waitForTimeout(400);
  const cheio = await p.evaluate(() => getComputedStyle(document.querySelector("video")).filter);
  await slider.fill("0");
  await p.waitForTimeout(400);
  const zero = await p.evaluate(() => getComputedStyle(document.querySelector("video")).filter);
  console.log(`        100% → ${cheio}\n        0%   → ${zero}`);
  check(cheio !== zero && zero === "none", "e o realce vai de nada ao cheio");

  // E a foto sai como o visor mostrava — a mesma regra dos filtros.
  await slider.fill("100");
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: /Tirar foto/i }).click();
  await p.waitForTimeout(1500);
  const comparacao = await p.evaluate(async () => {
    const sat = (ctx, w, h) => {
      const d = ctx.getImageData(0, 0, w, h).data;
      let s = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 31) {
        const mx = Math.max(d[i], d[i + 1], d[i + 2]);
        const mn = Math.min(d[i], d[i + 1], d[i + 2]);
        s += mx === 0 ? 0 : (mx - mn) / mx;
        n++;
      }
      return s / n;
    };
    const w = 160, h = 120;
    const v = document.querySelector("video");
    const cru = document.createElement("canvas");
    cru.width = w; cru.height = h;
    const cc = cru.getContext("2d", { willReadFrequently: true });
    cc.drawImage(v, 0, 0, w, h);

    const db = await new Promise((r) => {
      const q = indexedDB.open("jovi-camera-v2");
      q.onsuccess = () => r(q.result);
    });
    const all = await new Promise((r) => {
      const q = db.transaction("captures", "readonly").objectStore("captures").getAll();
      q.onsuccess = () => r(q.result);
    });
    db.close();
    const ultima = all.sort((a, z) => z.createdAt - a.createdAt)[0];
    const bmp = await createImageBitmap(ultima.blob);
    const f = document.createElement("canvas");
    f.width = w; f.height = h;
    const fc = f.getContext("2d", { willReadFrequently: true });
    fc.drawImage(bmp, 0, 0, w, h);
    return { cru: sat(cc, w, h), foto: sat(fc, w, h) };
  });
  console.log(
    `        saturação: cru ${comparacao.cru.toFixed(3)} · foto ${comparacao.foto.toFixed(3)}`,
  );
  check(
    comparacao.foto > comparacao.cru * 1.08,
    "e a foto salva sai realçada, como o visor mostrava",
    `${comparacao.cru.toFixed(3)} → ${comparacao.foto.toFixed(3)}`,
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== o Instantâneo faz o que o nome diz ==");
{
  const { b, p, erros } = await abrir("fp-parede-rebocada-textura-forte.y4m", 4000);
  await p.getByRole("dialog").getByRole("button", { name: /^Instantâneo/ }).first().click();
  await p.waitForTimeout(2200);

  /* O modo diz "dispara imediatamente, sem ajustes prévios" — e respeitava o
     temporizador, o que fazia a promessa ser falsa. Um modo que diz uma coisa
     e faz outra é pior que um modo a menos. */
  check(
    (await p.getByRole("button", { name: /temporizador/i }).count()) === 0,
    "sem controle de temporizador, que aqui não teria efeito",
  );

  const antes = await p.evaluate(async () => {
    const db = await new Promise((r) => {
      const q = indexedDB.open("jovi-camera-v2");
      q.onsuccess = () => r(q.result);
    });
    const n = await new Promise((r) => {
      const q = db.transaction("captures", "readonly").objectStore("captures").count();
      q.onsuccess = () => r(q.result);
    });
    db.close();
    return n;
  });

  await p.getByRole("button", { name: /Tirar foto/i }).click();
  // Um segundo e meio: se houvesse contagem de três segundos, nada teria sido
  // salvo ainda.
  await p.waitForTimeout(1500);
  const depois = await p.evaluate(async () => {
    const db = await new Promise((r) => {
      const q = indexedDB.open("jovi-camera-v2");
      q.onsuccess = () => r(q.result);
    });
    const n = await new Promise((r) => {
      const q = db.transaction("captures", "readonly").objectStore("captures").count();
      q.onsuccess = () => r(q.result);
    });
    db.close();
    return n;
  });
  check(depois === antes + 1, "e a foto sai na hora", `${antes} → ${depois}`);
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== os números dos modos, contra o que os docs dizem ==");
{
  const { b, p, erros } = await abrir("fp-parede-rebocada-textura-forte.y4m", 4000);
  /* Este bloco existe porque eu errei a conta: os docs diziam "6 de 16 são
     prévia" quando eram 9, e ninguém nota um número errado num documento. O
     app é a fonte, e o teste faz a contagem. */
  const contagem = await p.evaluate(() => {
    const cards = [...document.querySelectorAll("[role=dialog] li button")];
    const previa = cards.filter((c) => /Prévia/i.test(c.innerText)).length;
    return { total: cards.length, previa, reais: cards.length - previa };
  });
  console.log(
    `        ${contagem.total} modos · ${contagem.reais} reais · ${contagem.previa} prévia`,
  );
  check(contagem.total === 16, "dezesseis modos no catálogo", `${contagem.total}`);
  check(contagem.reais === 8, "oito reais", `${contagem.reais}`);
  check(contagem.previa === 8, "oito prévias, e cada uma diz que é", `${contagem.previa}`);
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log(fail ? `\n${fail} FALHA(S)` : "\nTUDO PASSOU");
process.exit(fail ? 1 : 0);

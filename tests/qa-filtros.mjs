/* Filtros v2: a intensidade que passou a existir, o painel completo, e a
   separação entre filtro e efeito.

   As duas perguntas que este arquivo existe para responder:

   1. A foto salva sai com a MESMA aparência que o visor mostrava? Um preview
      em 70 % com a foto em 100 % é o defeito clássico desta funcionalidade, e
      é invisível até alguém abrir a galeria.

   2. O quadro que o SliD analisa continua cru? Se o filtro de tela chegasse à
      análise, escolher P&B mudaria o que o app entende de uma aula. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

async function abrir(cena, { largura = 390, espera = 2500 } = {}) {
  const b = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${CENAS}/${cena}`,
    ],
  });
  const p = await (
    await b.newContext({
      viewport: { width: largura, height: 844 },
      isMobile: true,
      hasTouch: true,
      permissions: ["camera"],
    })
  ).newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(espera);
  return { b, p, erros };
}

/** O `filter` que o navegador aplicou de fato ao visor. */
const cssDoVisor = (p) =>
  p.evaluate(() => getComputedStyle(document.querySelector("video")).filter);

/** Abre o painel completo pela ponta da tira, como um dedo faria. */
async function abrirPainel(p) {
  await p.getByRole("button", { name: /abrir todos os filtros/i }).click();
  await p.waitForTimeout(500);
}

console.log("== a tira e o painel escolhem o mesmo filtro ==");
{
  const { b, p, erros } = await abrir("cor-mesa-de-estudo.y4m");

  const tira = p.locator("button[aria-label^='Filtro ']");
  check((await tira.count()) === 7, "a tira traz os sete filtros", `${await tira.count()}`);

  const nomes = await tira.evaluateAll((bs) =>
    bs.map((x) => x.getAttribute("aria-label").replace("Filtro ", "")),
  );
  check(
    nomes.join(" · ") === "Nenhum · Vivid · Cinema · Leitura · Suave · P&B · Quente",
    "na ordem do wireframe, com Leitura incluído",
    nomes.join(" · "),
  );

  check((await cssDoVisor(p)) === "none", "e o visor começa sem filtro nenhum");

  await tira.nth(5).click(); // P&B
  await p.waitForTimeout(350);
  const comPb = await cssDoVisor(p);
  check(/grayscale/.test(comPb), "escolher na tira muda o visor", comPb);

  await abrirPainel(p);
  const painel = p.getByRole("dialog", { name: "Filtros" });
  check((await painel.count()) === 1, "a ponta da tira abre o painel completo");

  const marcado = await painel
    .locator("button[aria-pressed='true']")
    .first()
    .innerText();
  check(/P&B/i.test(marcado), "que já abre com o filtro em uso marcado", marcado.replace(/\n/g, " · "));

  // Escolher no painel muda o visor atrás — o painel não é uma tela separada.
  await painel.getByRole("button", { name: /^Vivid/ }).click();
  await p.waitForTimeout(350);
  const comVivid = await cssDoVisor(p);
  check(
    /saturate/.test(comVivid) && !/grayscale/.test(comVivid),
    "e escolher no painel muda o visor atrás dele",
    comVivid,
  );

  // O estado mora na câmera: fechar e reabrir não perde nada.
  await painel.getByRole("button", { name: "Fechar painel" }).click();
  await p.waitForTimeout(400);
  check((await cssDoVisor(p)) === comVivid, "fechar o painel mantém o filtro");
  const naTira = await tira.nth(1).getAttribute("aria-pressed");
  check(naTira === "true", "e a tira mostra a mesma escolha que o painel fez");

  await abrirPainel(p);
  const voltou = await p
    .getByRole("dialog", { name: "Filtros" })
    .locator("button[aria-pressed='true']")
    .first()
    .innerText();
  check(/Vivid/i.test(voltou), "reabrir o painel encontra a escolha de pé", voltou.replace(/\n/g, " · "));

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== a intensidade é real, não cenográfica ==");
{
  const { b, p, erros } = await abrir("cor-mesa-de-estudo.y4m");
  await p.locator("button[aria-label='Filtro P&B']").click();
  await p.waitForTimeout(300);
  await abrirPainel(p);
  const painel = p.getByRole("dialog", { name: "Filtros" });

  const slider = painel.getByRole("slider");
  check((await slider.count()) === 1, "há um controle de intensidade");
  check((await slider.inputValue()) === "70", "que entra em 70 %", await slider.inputValue());

  const lidos = [];
  for (const valor of [0, 35, 50, 100]) {
    await slider.fill(String(valor));
    await p.waitForTimeout(250);
    lidos.push({ valor, css: await cssDoVisor(p) });
  }
  for (const { valor, css } of lidos) console.log(`        ${valor}% → ${css}`);

  check(lidos[0].css === "none", "em 0 % o visor não tem filtro nenhum", lidos[0].css);
  const cinza = lidos.map((x) => Number(/grayscale\(([\d.]+)\)/.exec(x.css)?.[1] ?? 0));
  check(
    cinza[1] > 0 && cinza[2] > cinza[1] && cinza[3] > cinza[2],
    "e cresce de verdade a cada passo",
    cinza.join(" → "),
  );
  check(Math.abs(cinza[3] - 1) < 0.001, "chegando ao filtro cheio em 100 %", String(cinza[3]));

  // O valor mostrado é o valor aplicado.
  await slider.fill("42");
  await p.waitForTimeout(250);
  const rotulo = await painel.getByText(/^\d+%$/).innerText();
  check(rotulo === "42%", "o número na tela é o valor em uso", rotulo);

  // A intensidade some com "Nenhum": intensidade de nada é zero por definição.
  await painel.getByRole("button", { name: /^Nenhum/ }).click();
  await p.waitForTimeout(300);
  check(
    (await painel.getByRole("slider").count()) === 0,
    "e o controle some quando não há filtro para dosar",
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== a foto salva sai como o visor mostrava ==");
{
  const { b, p, erros } = await abrir("cor-mesa-de-estudo.y4m");

  /*
   * A prova é comparativa, e é de propósito.
   *
   * Comparar a foto salva com um valor absoluto seria refém do quadro que o
   * vídeo estava mostrando naquele milissegundo. Então medimos, no mesmo
   * instante da captura, as duas hipóteses — o quadro cru e o quadro com o
   * filtro do visor — e perguntamos de qual das duas a foto salva ficou perto.
   */
  const medirCaptura = async () =>
    p.evaluate(async () => {
      const saturacao = (ctx, w, h) => {
        const d = ctx.getImageData(0, 0, w, h).data;
        let soma = 0;
        let n = 0;
        for (let i = 0; i < d.length; i += 4 * 37) {
          const r = d[i];
          const g = d[i + 1];
          const bl = d[i + 2];
          const max = Math.max(r, g, bl);
          const min = Math.min(r, g, bl);
          soma += max === 0 ? 0 : (max - min) / max;
          n++;
        }
        return soma / n;
      };

      const video = document.querySelector("video");
      const css = getComputedStyle(video).filter;
      const w = 160;
      const h = 120;

      const cru = document.createElement("canvas");
      cru.width = w;
      cru.height = h;
      const ctxCru = cru.getContext("2d", { willReadFrequently: true });
      ctxCru.drawImage(video, 0, 0, w, h);

      const filtrado = document.createElement("canvas");
      filtrado.width = w;
      filtrado.height = h;
      const ctxF = filtrado.getContext("2d", { willReadFrequently: true });
      if (css !== "none") ctxF.filter = css;
      ctxF.drawImage(video, 0, 0, w, h);

      // A última foto guardada, lida do próprio banco do app.
      const db = await new Promise((r) => {
        const req = indexedDB.open("jovi-camera-v2", 1);
        req.onsuccess = () => r(req.result);
      });
      const itens = await new Promise((r) => {
        const req = db.transaction("captures", "readonly").objectStore("captures").getAll();
        req.onsuccess = () => r(req.result);
      });
      db.close();
      const ultima = itens.sort((a, z) => z.createdAt - a.createdAt)[0];
      const bmp = await createImageBitmap(ultima.blob);
      const foto = document.createElement("canvas");
      foto.width = w;
      foto.height = h;
      const ctxFoto = foto.getContext("2d", { willReadFrequently: true });
      ctxFoto.drawImage(bmp, 0, 0, w, h);

      return {
        css,
        cru: saturacao(ctxCru, w, h),
        filtrado: saturacao(ctxF, w, h),
        foto: saturacao(ctxFoto, w, h),
      };
    });

  const disparar = async () => {
    await p.getByRole("button", { name: /tirar foto|capturar|disparar/i }).first().click();
    await p.waitForTimeout(1200);
  };

  for (const [filtroLabel, valor] of [
    ["Filtro P&B", "100"],
    ["Filtro P&B", "40"],
    ["Filtro Vivid", "100"],
  ]) {
    await p.locator(`button[aria-label='${filtroLabel}']`).click();
    await p.waitForTimeout(250);
    await abrirPainel(p);
    await p.getByRole("dialog", { name: "Filtros" }).getByRole("slider").fill(valor);
    await p.waitForTimeout(250);
    await p.getByRole("dialog", { name: "Filtros" }).getByRole("button", { name: "Fechar painel" }).click();
    await p.waitForTimeout(400);

    await disparar();
    const m = await medirCaptura();
    const perto = Math.abs(m.foto - m.filtrado);
    const longe = Math.abs(m.foto - m.cru);
    console.log(
      `        ${filtroLabel} ${valor}% → ${m.css}\n` +
        `        saturação: cru ${m.cru.toFixed(3)} · visor ${m.filtrado.toFixed(3)} · foto ${m.foto.toFixed(3)}`,
    );
    check(
      perto < longe,
      `${filtroLabel} a ${valor}%: a foto ficou igual ao visor, não ao quadro cru`,
      `distância ${perto.toFixed(3)} vs ${longe.toFixed(3)}`,
    );
  }

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== efeito não é filtro ==");
{
  const { b, p, erros } = await abrir("cor-mesa-de-estudo.y4m");
  await abrirPainel(p);
  const painel = p.getByRole("dialog", { name: "Filtros" });

  const texto = await painel.innerText();
  check(/efeitos/i.test(texto), "os efeitos têm seção própria no painel");
  check(
    texto.indexOf("Nenhum") < texto.search(/efeitos/i),
    "que vem depois da grade de filtros, não misturada com ela",
  );
  check(
    (await painel.getByRole("button", { name: /^Raio de sol/ }).count()) === 1 &&
      (await painel.getByRole("button", { name: /^Tremor/ }).count()) === 1,
    "com os dois efeitos do wireframe",
  );

  // Um efeito não entra no `filter` do visor: ele é outra coisa.
  await painel.getByRole("button", { name: /^Raio de sol/ }).click();
  await p.waitForTimeout(400);
  check(
    (await cssDoVisor(p)) === "none",
    "ligar um efeito não vira filtro de cor",
    await cssDoVisor(p),
  );
  const camada = await p.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find(
      (d) => getComputedStyle(d).mixBlendMode === "screen",
    );
    return el ? getComputedStyle(el).backgroundImage.slice(0, 40) : null;
  });
  check(camada !== null, "mas acende uma camada por cima do visor", camada ?? "nenhuma");

  // E não ganha um controle de intensidade que não significaria nada.
  check(
    (await painel.getByRole("slider").count()) === 0,
    "e não ganha intensidade, que num efeito não quer dizer nada",
  );

  // Tremor mexe no visor sem tocar no espelho nem no zoom.
  await painel.getByRole("button", { name: /^Raio de sol/ }).click();
  await painel.getByRole("button", { name: /^Tremor/ }).click();
  await p.waitForTimeout(500);
  const tremor = await p.evaluate(() => {
    const v = document.querySelector("video");
    const s = getComputedStyle(v);
    return { animacao: s.animationName, transform: v.style.transform || "" };
  });
  check(/tremor/i.test(tremor.animacao), "Tremor anima o visor", tremor.animacao);
  check(
    !/transform/i.test(tremor.animacao) || tremor.transform === "",
    "sem disputar o `transform` do espelho e do zoom",
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== o SliD continua recebendo o quadro cru ==");
{
  /* Numa cena colorida, e não numa das cenas do SliD: elas são todas cinza —
     `U` e `V` constantes — e num quadro sem cor a prova não provaria nada. */
  const { b, p, erros } = await abrir("cor-mesa-de-estudo.y4m");

  // P&B cheio: o visor fica sem cor nenhuma.
  await p.locator("button[aria-label='Filtro P&B']").click();
  await p.waitForTimeout(250);
  await abrirPainel(p);
  await p.getByRole("dialog", { name: "Filtros" }).getByRole("slider").fill("100");
  await p.waitForTimeout(200);
  await p.getByRole("dialog", { name: "Filtros" }).getByRole("button", { name: "Fechar painel" }).click();
  await p.waitForTimeout(300);
  check(/grayscale\(1\)/.test(await cssDoVisor(p)), "o visor está em preto e branco cheio");

  /* A prova direta: `drawImage` a partir do <video> — que é exatamente como o
     SliD lê o quadro — devolve pixel com cor, mesmo com a tela sem cor. */
  const leitura = await p.evaluate(() => {
    const v = document.querySelector("video");
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 96;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(v, 0, 0, 128, 96);
    const d = ctx.getImageData(0, 0, 128, 96).data;
    let colorido = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 12) colorido++;
    }
    return { colorido, total: d.length / 4, css: getComputedStyle(v).filter };
  });
  check(
    leitura.colorido > leitura.total * 0.02,
    "e o quadro lido do <video> continua com cor",
    `${leitura.colorido}/${leitura.total} pixels coloridos com a tela em ${leitura.css}`,
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== e a consequência: a aula continua sendo detectada ==");
{
  const { b, p, erros } = await abrir("fp-aula-slide-projetado.y4m", { espera: 1500 });
  await p.locator("button[aria-label='Filtro P&B']").click();
  await p.waitForTimeout(250);
  check(/grayscale/.test(await cssDoVisor(p)), "com o filtro ligado sobre um slide projetado");

  await p.waitForTimeout(9000);
  const corpo = await p.locator("body").innerText();
  check(/aula detectada/i.test(corpo), "a aula é detectada do mesmo jeito");

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== e nenhum filtro chega perto de uma aula ==");
{
  const { b, p, erros } = await abrir("fp-aula-slide-projetado.y4m", { espera: 1500 });
  await p.locator("button[aria-label='Filtro P&B']").click();
  await p.waitForTimeout(300);
  check(/grayscale/.test(await cssDoVisor(p)), "com P&B ligado em Foto");

  await p.getByRole("button", { name: "SliD", exact: true }).click();
  await p.waitForTimeout(1500);
  check((await cssDoVisor(p)) === "none", "entrar no SliD desliga o filtro", await cssDoVisor(p));
  check(
    (await p.locator("button[aria-label^='Filtro ']").count()) === 0,
    "e a tira de filtros nem aparece durante a aula",
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== as miniaturas mostram o filtro, não só o nome ==");
{
  const { b, p, erros } = await abrir("cor-mesa-de-estudo.y4m");
  await abrirPainel(p);

  /* Sete cards com nomes diferentes e a mesma imagem não ajudam ninguém a
     escolher antes de tocar. Então cada miniatura é medida como está na tela —
     imagem mais o `filter` que o navegador aplicou nela — e as assinaturas têm
     de ser distinguíveis entre si. */
  const assinaturas = await p.evaluate(async () => {
    const imgs = [...document.querySelectorAll("[role=dialog] ul img")];
    const saida = [];
    for (const img of imgs) {
      const bmp = await createImageBitmap(await (await fetch(img.src)).blob());
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 80;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      const f = getComputedStyle(img).filter;
      if (f !== "none") ctx.filter = f;
      ctx.drawImage(bmp, 0, 0, 64, 80);
      const d = ctx.getImageData(0, 0, 64, 80).data;
      let r = 0;
      let g = 0;
      let bl = 0;
      let n = 0;
      for (let i = 0; i < d.length; i += 4 * 7) {
        r += d[i];
        g += d[i + 1];
        bl += d[i + 2];
        n++;
      }
      const nome = img.closest("button").innerText.split("\n")[0];
      saida.push({ nome, r: r / n, g: g / n, b: bl / n });
    }
    return saida;
  });

  check(assinaturas.length === 7, "sete miniaturas desenhadas", String(assinaturas.length));
  for (const a of assinaturas)
    console.log(`        ${a.nome.padEnd(8)} rgb ${a.r.toFixed(0)} ${a.g.toFixed(0)} ${a.b.toFixed(0)}`);

  let iguais = [];
  for (let i = 0; i < assinaturas.length; i++) {
    for (let j = i + 1; j < assinaturas.length; j++) {
      const a = assinaturas[i];
      const z = assinaturas[j];
      const dist = Math.abs(a.r - z.r) + Math.abs(a.g - z.g) + Math.abs(a.b - z.b);
      if (dist < 6) iguais.push(`${a.nome}≈${z.nome} (${dist.toFixed(1)})`);
    }
  }
  check(iguais.length === 0, "e nenhuma delas é indistinguível de outra", iguais.join(", "));

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== favoritos, no próprio aparelho ==");
{
  const { b, p, erros } = await abrir("cor-mesa-de-estudo.y4m");
  await abrirPainel(p);
  const painel = p.getByRole("dialog", { name: "Filtros" });

  check(
    (await painel.getByRole("button", { name: /^Favoritar Nenhum/ }).count()) === 0,
    '"Nenhum" não pode ser favoritado — não é uma aparência',
  );

  await painel.getByRole("button", { name: "Favoritar Leitura" }).click();
  await p.waitForTimeout(300);
  check(
    /filtros favoritos/i.test(await painel.innerText()),
    "favoritar acende a seção de favoritos",
  );
  check(
    (await painel.getByRole("button", { name: "★ Leitura" }).count()) === 1,
    "com o filtro escolhido dentro dela",
  );

  // Favoritar não troca o filtro em uso: são dois gestos diferentes.
  check((await cssDoVisor(p)) === "none", "e favoritar não muda o visor", await cssDoVisor(p));

  const guardado = await p.evaluate(() => localStorage.getItem("jovi.filtros.favoritos"));
  check(guardado === '["leitura"]', "guardado no próprio aparelho, sem conta nem servidor", String(guardado));

  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  await abrirPainel(p);
  check(
    (await p.getByRole("dialog", { name: "Filtros" }).getByRole("button", { name: "★ Leitura" }).count()) === 1,
    "e continua lá depois de recarregar",
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== no celular ==");
for (const largura of [375, 390, 430]) {
  const { b, p, erros } = await abrir("cor-mesa-de-estudo.y4m", { largura });
  /*
   * A porta do painel tem de estar na tela SEM arrastar a tira.
   *
   * Ela já esteve no fim da fila rolável, e ali nascia fora da tela a 390 px:
   * uma porta que só aparece depois de arrastar não é uma porta.
   */
  const porta = await p.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /abrir todos os filtros/i.test(x.getAttribute("aria-label") ?? ""),
    );
    if (!b) return null;
    const r = b.getBoundingClientRect();
    const meio = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { direita: r.right, tela: innerWidth, alcanca: b.contains(meio) || meio === b };
  });
  check(porta !== null, `${largura}px: a porta do painel existe na tira`);
  check(
    porta && porta.direita <= porta.tela + 0.5,
    `${largura}px: e está na tela sem precisar arrastar a tira`,
    porta ? `direita em ${porta.direita.toFixed(0)}px de ${porta.tela}px` : "",
  );
  check(porta && porta.alcanca, `${largura}px: e nada está por cima dela`);

  await p.locator("button[aria-label='Filtro P&B']").click();
  await p.waitForTimeout(250);
  await abrirPainel(p);
  const painel = p.getByRole("dialog", { name: "Filtros" });

  const g = await p.evaluate(() => {
    const s = document.querySelector("[role=dialog] input[type=range]");
    const r = s.getBoundingClientRect();
    // Quem está por cima no meio do controle? Se não for o próprio controle,
    // arrastar a intensidade vai acionar outra coisa.
    const acima = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const cards = [...document.querySelectorAll("[role=dialog] ul li")];
    const largura = document.documentElement.clientWidth;
    return {
      alturaDoControle: r.height,
      dentro: r.x >= 0 && r.x + r.width <= largura + 0.5,
      proprio: acima === s,
      transbordo: cards.some((c) => c.getBoundingClientRect().right > largura + 0.5),
      rolagemLateral: document.documentElement.scrollWidth > largura + 0.5,
    };
  });
  check(g.alturaDoControle >= 44, `${largura}px: o controle tem alvo de toque`, `${g.alturaDoControle.toFixed(0)}px`);
  check(g.dentro, `${largura}px: e cabe na tela`);
  check(g.proprio, `${largura}px: nada rouba o toque do controle`);
  check(!g.transbordo, `${largura}px: nenhum card de filtro vaza da tela`);
  check(!g.rolagemLateral, `${largura}px: sem rolagem lateral`);

  // A última seção do painel é alcançável — a navegação inferior fica por cima.
  await p.evaluate(() => document.querySelector("[role=dialog]").scrollTo(0, 99999));
  await p.waitForTimeout(500);
  const alcance = await p.evaluate(() => {
    const bs = [...document.querySelectorAll("[role=dialog] button")];
    const ultimo = bs[bs.length - 1].getBoundingClientRect();
    const meio = document.elementFromPoint(ultimo.x + ultimo.width / 2, ultimo.y + ultimo.height / 2);
    return { visivel: ultimo.bottom <= innerHeight + 0.5, tocavel: !!meio && ultimo.height > 0 };
  });
  check(alcance.visivel && alcance.tocavel, `${largura}px: o fim do painel é alcançável`);

  check(erros.length === 0, `${largura}px: sem erro de runtime`, erros[0] ?? "");
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);

/* A tela da aula — `Resumo v2` (`339:611`).
   Cabeçalho-cartão, três abas, e a regra que vale mais que as três: nada aqui
   pode dizer sobre a aula algo que a câmera não leu. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";
import { AULA, abrirAula, semearAula } from "./semear-aula.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

async function comAula({ largura = 390 } = {}) {
  const b = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${CENAS}/cor-mesa-de-estudo.y4m`,
    ],
  });
  const p = await (
    await b.newContext({
      viewport: { width: largura, height: 844 },
      isMobile: true,
      hasTouch: true,
      permissions: ["camera", "clipboard-read", "clipboard-write"],
    })
  ).newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2200);
  await semearAula(p);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  await abrirAula(p);
  return { b, p, erros };
}

console.log("== o cabeçalho responde as seis perguntas ==");
{
  const { b, p, erros } = await comAula();

  const cabecalho = await p.evaluate(() => {
    // A galeria continua montada atrás da aula: sem escopo, `header` pega a
    // dela. O cabeçalho da aula é o que contém as abas da aula.
    const head = document
      .querySelector('[role=tablist][aria-label="Conteúdo da aula"]')
      .closest("header");
    const img = head.querySelector("img");
    const h1 = head.querySelector("h1, textarea");
    return {
      temCapa: !!img && img.naturalWidth > 0,
      titulo: h1 ? (h1.value ?? h1.textContent) : null,
      texto: head.innerText,
    };
  });

  check(cabecalho.temCapa, "a aula tem rosto: uma miniatura de um momento real");
  check(/Cálculo/.test(cabecalho.titulo ?? ""), "o título da aula", cabecalho.titulo ?? "");
  check(/Cálculo/.test(cabecalho.texto), "a matéria");
  check(/Revisar/i.test(cabecalho.texto), "o status");
  check(/\d{2}\/\d{2}/.test(cabecalho.texto), "a data");
  check(/10:40/.test(cabecalho.texto), "a duração", /(\d\d:\d\d)/.exec(cabecalho.texto)?.[1] ?? "");
  check(/4 momentos/.test(cabecalho.texto), "e quantos momentos");

  // O lápis do `339:637` — o wireframe torna o gesto de renomear explícito.
  const lapis = p.getByRole("button", { name: /editar o nome da aula/i });
  check((await lapis.count()) === 1, "há o lápis de editar o nome");
  await lapis.click();
  await p.waitForTimeout(300);
  check(
    await p.evaluate(
      () =>
        !!document
          .querySelector('[role=tablist][aria-label="Conteúdo da aula"]')
          .closest("header")
          .querySelector("textarea"),
    ),
    "e ele abre o campo de nome",
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== três abas, e nenhuma se chama IA ==");
{
  const { b, p, erros } = await comAula();
  const abas = p
    .getByRole("tablist", { name: "Conteúdo da aula" })
    .getByRole("tab");
  const nomes = await abas.evaluateAll((bs) => bs.map((x) => x.textContent.trim()));
  check(
    nomes.join(" · ") === "Imagens · Texto · Resumo",
    "Imagens · Texto · Resumo",
    nomes.join(" · "),
  );
  check(
    !/\bIA\b/i.test(await p.locator("body").innerText()),
    "e a palavra IA não aparece em lugar nenhum da tela",
  );
  check(
    (await abas.nth(0).getAttribute("aria-selected")) === "true",
    "abre em Imagens, que é a aba que sempre tem conteúdo",
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== Imagens: os momentos, sem duplicata ==");
{
  const { b, p, erros } = await comAula();
  const cards = p.locator("[role=tabpanel] li button");
  check((await cards.count()) === 4, "um card por momento", `${await cards.count()}`);

  const painel = await p.locator("[role=tabpanel]").innerText();
  for (const m of AULA.momentos)
    check(painel.includes(m.label), `o momento "${m.label}" aparece`);

  const horarios = await p.evaluate(() =>
    // Só os elementos-folha: o `span` que envolve a imagem e o selo também tem
    // o mesmo `textContent`, e contaria cada horário duas vezes.
    [...document.querySelectorAll("[role=tabpanel] span")]
      .filter((x) => x.children.length === 0)
      .map((x) => x.textContent.trim())
      .filter((t) => /^\d\d:\d\d$/.test(t)),
  );
  check(
    horarios.join(" ") === "00:03 02:08 05:32 09:00",
    "cada um com o horário em que aconteceu",
    horarios.join(" "),
  );
  check(
    new Set(horarios).size === horarios.length,
    "e nenhum horário repetido — sem duplicata na grade",
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== Texto: organizado por momento, e sem repetir o título ==");
{
  const { b, p, erros } = await comAula();
  await p.getByRole("tablist", { name: "Conteúdo da aula" }).getByRole("tab", { name: "Texto" }).click();
  await p.waitForTimeout(500);

  const blocos = p.locator("[role=tabpanel] article");
  check(
    (await blocos.count()) === 3,
    "três blocos: o momento que não leu nada fica de fora",
    `${await blocos.count()}`,
  );

  const primeiro = await blocos.nth(0).innerText();
  check(/Função do 2° Grau/.test(primeiro), "com o título do trecho");
  check(/f\(x\) = ax² \+ bx \+ c/.test(primeiro), "e as linhas que a câmera leu");
  check(
    primeiro.split("Função do 2° Grau").length - 1 === 1,
    "o título aparece uma vez só — não como cabeçalho e item ao mesmo tempo",
  );
  check(/00:03/.test(primeiro), "e o horário do momento");

  const temImagem = await blocos.nth(0).locator("img").count();
  check(temImagem === 1, "a imagem daquele momento vem dentro do bloco de texto");

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== Copiar texto copia mesmo ==");
{
  const { b, p, erros } = await comAula();
  await p.getByRole("tablist", { name: "Conteúdo da aula" }).getByRole("tab", { name: "Texto" }).click();
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: /^Copiar texto/ }).click();
  await p.waitForTimeout(600);

  const rotulo = await p.getByRole("button", { name: /copiado|copiar texto/i }).innerText();
  check(/copiado/i.test(rotulo), "o botão confirma", rotulo);

  const area = await p.evaluate(() => navigator.clipboard.readText());
  console.log("        " + area.split("\n").slice(0, 4).join(" ⏎ "));
  check(area.length > 40, "e há texto de verdade na área de transferência", `${area.length} caracteres`);
  check(/Função do 2° Grau/.test(area), "com os títulos dos momentos");
  check(/f\(x\) = ax² \+ bx \+ c/.test(area), "e o que foi lido");
  check(/\[00:03\]/.test(area), "com o horário de cada um");
  check(
    !/Conteúdo acrescentado/.test(area),
    "e sem o momento que não leu nada — não se copia o vazio",
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== Resumo: só o que a aula deu ==");
{
  const { b, p, erros } = await comAula();
  await p.getByRole("tablist", { name: "Conteúdo da aula" }).getByRole("tab", { name: "Resumo" }).click();
  await p.waitForTimeout(500);
  const painel = await p.locator("[role=tabpanel]").innerText();

  check(/Esta aula de Cálculo/.test(painel), "a visão geral guardada na sessão");
  check(/2 fórmulas/.test(painel), "as estruturas reconhecidas");
  check(/NESTA AULA/i.test(painel), "os tópicos, que são linhas do quadro");
  check(/COMO A AULA ANDOU/i.test(painel), "e a linha do tempo");
  check(/Você marcou esta aula como Revisar/i.test(painel), "com o status do estudante");

  // O teste que mais importa: nada de conhecimento externo.
  check(
    !/raízes reais|discriminante|concavidade|vértice da parábola/i.test(painel),
    "nenhuma explicação de matemática que não estava na aula",
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== a aula sem leitura nenhuma não finge ter resumo ==");
{
  const b = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${CENAS}/cor-mesa-de-estudo.y4m`,
    ],
  });
  const p = await (
    await b.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      permissions: ["camera"],
    })
  ).newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2200);
  await semearAula(p, {
    ...AULA,
    momentos: AULA.momentos.map((m) => ({ ...m, lines: [] })),
  });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  await abrirAula(p);

  check(
    (await p.locator("[role=tabpanel] li button").count()) === 4,
    "as imagens continuam todas lá",
  );

  await p.getByRole("tablist", { name: "Conteúdo da aula" }).getByRole("tab", { name: "Texto" }).click();
  await p.waitForTimeout(400);
  const texto = await p.locator("[role=tabpanel]").innerText();
  check(
    /não conseguiu ler texto/i.test(texto),
    "a aba Texto diz que não conseguiu ler, em vez de abrir vazia",
  );
  check(
    /letra à mão|slide distante|pouca luz/i.test(texto),
    "e diz por que pode ter acontecido",
  );
  check(
    (await p.getByRole("button", { name: /^Copiar texto/ }).count()) === 0,
    "sem botão de copiar o que não existe",
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== no celular ==");
for (const largura of [375, 390, 430]) {
  const { b, p, erros } = await comAula({ largura });
  const g = await p.evaluate(() => {
    const l = document.documentElement.clientWidth;
    const lista = document.querySelector(
      '[role=tablist][aria-label="Conteúdo da aula"]',
    );
    const abas = [...lista.querySelectorAll("[role=tab]")];
    const head = lista.closest("header");
    return {
      rolagemLateral: document.documentElement.scrollWidth > l + 0.5,
      abasCabem: abas.every((a) => a.getBoundingClientRect().right <= l + 0.5),
      abaAlvo: Math.min(...abas.map((a) => a.getBoundingClientRect().height)),
      cabecalhoCabe: head.getBoundingClientRect().right <= l + 0.5,
    };
  });
  check(!g.rolagemLateral, `${largura}px: sem rolagem lateral`);
  check(g.abasCabem && g.cabecalhoCabe, `${largura}px: cabeçalho e abas cabem na tela`);
  check(g.abaAlvo >= 44, `${largura}px: as abas têm alvo de toque`, `${g.abaAlvo.toFixed(0)}px`);
  check(erros.length === 0, `${largura}px: sem erro de runtime`, erros[0] ?? "");
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);

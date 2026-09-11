/* A galeria: onde as coisas guardadas têm de estar, e onde não podem estar.

   A tela tem uma regra que é fácil de quebrar sem ninguém notar: **um momento
   do SliD também é um JPEG**, mas o estudante não tirou aquela foto — a câmera
   tirou por ele, dentro de uma aula. Misturar as duas coisas faria "Fotos"
   virar um depósito, que é o problema que a separação existe para resolver. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";
import { AULA, semearAula } from "./semear-aula.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

async function abrir() {
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
  await p.waitForTimeout(2600);
  return { b, p, erros };
}

const chips = (p) => p.getByRole("tablist", { name: "Filtrar a galeria" });
const irPara = async (p, nome) => {
  await chips(p).getByRole("tab", { name: nome }).click();
  await p.waitForTimeout(900);
};

console.log("== uma aula não vira foto solta ==");
{
  const { b, p, erros } = await abrir();

  // Uma foto tirada à mão, e uma aula. As duas no mesmo banco.
  await p.getByRole("button", { name: /Tirar foto/i }).click();
  await p.waitForTimeout(1500);
  await semearAula(p);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(2000);

  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(1500);

  const rotulos = await chips(p).getByRole("tab").allInnerTexts();
  // Os cinco primeiros, em ordem. "Lixeira" é um sexto que só aparece quando
  // há algo nela, e por isso não entra na comparação de ordem.
  check(
    rotulos
      .slice(0, 5)
      .map((t) => t.split(/\s/)[0])
      .join(" · ") === "Fotos · SliD · Todas · Favoritos · Vídeos",
    "a ordem dos filtros é a decisão de produto, não a do wireframe",
    rotulos.join(" | ").replace(/\n/g, " "),
  );

  // Em Fotos: só a que o dedo tirou.
  const emFotos = await p.evaluate(() => document.querySelectorAll("ul li img").length);
  check(emFotos === 1, "Fotos mostra só a foto tirada à mão", `${emFotos}`);

  await irPara(p, /^SliD/);
  const aulas = await p.locator("article").count();
  check(aulas === 1, "SliD mostra a aula", `${aulas}`);
  check(
    /Cálculo/.test(await p.locator("body").innerText()),
    "com o nome que ela recebeu",
  );

  await irPara(p, /^Todas/);
  const todas = await p.evaluate(() => document.querySelectorAll("ul li img").length);
  check(
    todas === 1 + AULA.momentos.length,
    "Todas junta as duas coisas",
    `${todas} = 1 foto + ${AULA.momentos.length} momentos`,
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== o filtro por matéria ==");
{
  const { b, p, erros } = await abrir();
  await semearAula(p);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(1200);
  await irPara(p, /^SliD/);

  const corpo = await p.locator("body").innerText();
  check(/Cálculo/.test(corpo), "a matéria da aula aparece como filtro");
  check(/Revisar/i.test(corpo), "e o status também");

  // Filtrar por uma matéria que a aula tem devolve a aula.
  // Ele é um `tab`, como os chips de cima — e não um `button`.
  const filtroMateria = p.getByRole("tab", { name: /^Cálculo/ }).first();
  if ((await filtroMateria.count()) > 0) {
    await filtroMateria.click();
    await p.waitForTimeout(900);
    check(
      (await p.locator("article").count()) === 1,
      "filtrar por Cálculo devolve a aula",
    );
  } else {
    check(false, "há um filtro de matéria");
  }

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== a lixeira devolve inteiro ==");
{
  const { b, p, erros } = await abrir();
  await p.getByRole("button", { name: /Tirar foto/i }).click();
  await p.waitForTimeout(1500);
  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(1500);

  await p.locator("ul li img").first().click();
  await p.waitForTimeout(900);
  await p.getByRole("button", { name: /mover para a lixeira/i }).click();
  await p.waitForTimeout(1500);

  const sobrou = await p.evaluate(() => document.querySelectorAll("ul li img").length);
  check(sobrou === 0, "a foto sai de Fotos", `${sobrou}`);

  // A lixeira existe e devolve.
  const lixeira = chips(p).getByRole("tab", { name: /lixeira/i });
  check((await lixeira.count()) === 1, "e aparece um filtro de lixeira");
  await lixeira.click();
  await p.waitForTimeout(1000);
  check(
    (await p.evaluate(() => document.querySelectorAll("ul li img").length)) === 1,
    "com a foto dentro",
  );

  await p.getByRole("button", { name: /restaurar/i }).first().click();
  await p.waitForTimeout(1500);
  await irPara(p, /^Fotos/);
  check(
    (await p.evaluate(() => document.querySelectorAll("ul li img").length)) === 1,
    "restaurar devolve a foto para Fotos",
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== a galeria vazia diz o que fazer ==");
{
  const { b, p, erros } = await abrir();
  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(1500);
  const corpo = await p.locator("body").innerText();
  check(/aparecerão aqui|Nada guardado/i.test(corpo), "ela diz que está vazia");
  check(
    /Tire uma foto|câmera/i.test(corpo),
    "e diz o que fazer para deixar de estar",
    corpo.split("\n").filter((l) => l.length > 12).slice(0, 3).join(" · "),
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);

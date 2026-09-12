/* O Scanner nas condições em que uma folha de verdade aparece.
 *
 * O `qa-scanner` percorre o caminho feliz de ponta a ponta com três cenas. Esta
 * suíte faz a outra pergunta: em que condições ele acerta, em que condições ele
 * erra, e — o que mais importa — **ele sabe quando não sabe?**
 *
 * A regra que governa o veredito aqui não é "detectou sempre". Um scanner que
 * inventa um recorte sobre uma mesa de madeira é pior que um que diz "aponte
 * para a folha": o primeiro entrega um PDF torto que a pessoa só descobre
 * depois, longe daqui. Então as cenas se dividem em duas listas, e as
 * negativas valem tanto quanto as positivas.
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

/** Cenas em que existe folha: o Scanner deve enquadrar. */
const COM_FOLHA = [
  ["doc-folha-na-mesa.y4m", "folha clara sobre mesa"],
  ["doc-folha-com-texto.y4m", "folha com texto"],
  ["doc-folha-deslocada.y4m", "folha fora do centro"],
  ["doc-folha-pequena.y4m", "folha pequena no quadro"],
];

/**
 * Folha sem fundo à vista — ela **é** o quadro inteiro.
 *
 * Pus esta cena na lista de cima por engano e o teste reprovou o Scanner. Fui
 * olhar como ela é gerada: `g.fill(240)` e nove linhas de texto por cima. Não
 * há mesa, não há borda, não há sombra — a folha ocupa cada pixel.
 *
 * Um recorte de documento precisa da borda da folha contra o fundo. Sem fundo
 * não existe borda, e não existe recorte a fazer. Recusar é a resposta certa,
 * e "aponte para a folha" é o conselho certo: afastar o celular resolve.
 *
 * É a condição "pouco fundo" da lista de verificação, e ela pertence às
 * negativas, não às positivas. A cena foi feita para o detector do SliD — que
 * procura escrita, não bordas —, e usá-la aqui foi erro meu de leitura.
 */
const SEM_FUNDO = [
  ["fp-aula-folha-a4-escrita.y4m", "folha ocupando o quadro inteiro"],
];

/**
 * Cenas sem folha: o Scanner **não** pode afirmar que enquadrou.
 *
 * A mesa de madeira é a mais traiçoeira das seis: ela tem veios retos e
 * paralelos, que é exatamente o sinal que um detector de bordas procura.
 */
const SEM_FOLHA = [
  ["doc-mesa-vazia.y4m", "mesa vazia"],
  ["fp-mesa-de-madeira-veio-marcado.y4m", "mesa de madeira com veio"],
  ["fp-mesa-com-caneca-e-caneta.y4m", "mesa com objetos"],
];

/**
 * Cenas difíceis: aqui não exijo acerto, exijo **honestidade**.
 *
 * Pouca luz e papel amassado são condições em que um detector de bordas erra
 * com frequência, e forçá-lo a acertar seria pedir visão computacional pesada
 * — que este ciclo decidiu não ter. O que não se aceita é a terceira via:
 * dizer que enquadrou e entregar lixo.
 */
const DIFICEIS = [
  ["doc-folha-pouca-luz.y4m", "folha com pouca luz"],
  ["fp-papel-amassado.y4m", "papel amassado"],
];

/**
 * Checklist J: folha ESCURA sobre mesa CLARA — o contraste se inverte.
 *
 * O detector de bordas procura a transição folha/fundo; nas cenas de cima a
 * folha é sempre a região clara. Aqui é o oposto — sulfite colorida, papel
 * pardo, a contracapa de um caderno. Mesma regra das difíceis: acertar é
 * bônus, o que não se aceita é afirmar enquadramento e entregar um recorte
 * que não é a folha inteira, nem ficar mudo.
 */
const FOLHA_ESCURA = [
  ["doc-folha-escura.y4m", "folha escura sobre mesa clara"],
  ["doc-folha-escura-pouca-luz.y4m", "folha escura, pouca luz"],
];

async function abrir(cena) {
  const b = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${CENAS}/${cena}`,
    ],
  });
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ["camera"],
  });
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2200);
  await p.getByRole("button", { name: "Modos", exact: true }).click();
  await p.waitForTimeout(700);
  await p.getByRole("dialog").getByRole("button", { name: /^Scanner/ }).first().click();
  await p.waitForTimeout(3000);
  return { b, p, erros };
}

/** O que a tela afirma, e se há botão para capturar. */
const estado = (p) =>
  p.evaluate(() => {
    const t = document.body.innerText;
    return {
      enquadrou: /Documento enquadrado|Documento encontrado/.test(t),
      pedeFolha: /Aponte para a folha/.test(t),
      linha: (t.match(/Documento [^\n]+|Aponte para a folha[^\n]*/) ?? ["—"])[0],
    };
  });

console.log("== com folha: o Scanner enquadra ==");
{
  const resultados = [];
  for (const [cena, nome] of COM_FOLHA) {
    const { b, p, erros } = await abrir(cena);
    const e = await estado(p);
    resultados.push({ nome, ...e, erros: erros.length });
    await b.close();
  }
  for (const r of resultados) {
    check(r.enquadrou, `${r.nome}: enquadrou`, r.linha);
    check(r.erros === 0, `${r.nome}: sem erro de runtime`);
  }
}

console.log("\n== sem folha: NÃO inventa recorte ==");
{
  /*
   * Este bloco vale mais que o de cima. Um scanner que não detecta uma folha
   * difícil frustra; um que "detecta" uma mesa entrega um documento torto que
   * a pessoa só vai descobrir depois, e destrói a confiança em todos os
   * outros.
   */
  const resultados = [];
  for (const [cena, nome] of SEM_FOLHA) {
    const { b, p, erros } = await abrir(cena);
    const e = await estado(p);
    resultados.push({ nome, ...e, erros: erros.length });
    await b.close();
  }
  for (const r of resultados) {
    check(!r.enquadrou, `${r.nome}: não afirma ter enquadrado`, r.linha);
    check(r.pedeFolha, `${r.nome}: pede para apontar para a folha`);
    check(r.erros === 0, `${r.nome}: sem erro de runtime`);
  }
}

console.log("\n== folha sem fundo à vista: recusar é o certo ==");
{
  const resultados = [];
  for (const [cena, nome] of SEM_FUNDO) {
    const { b, p, erros } = await abrir(cena);
    const e = await estado(p);
    resultados.push({ nome, ...e, erros: erros.length });
    await b.close();
  }
  for (const r of resultados) {
    check(
      !r.enquadrou,
      `${r.nome}: não inventa um recorte sem ter borda para recortar`,
      r.linha,
    );
    check(r.pedeFolha, `${r.nome}: e diz o que fazer — afastar e enquadrar`);
    check(r.erros === 0, `${r.nome}: sem erro de runtime`);
  }
}

console.log("\n== condições difíceis: acertar é bônus, mentir é falha ==");
{
  const resultados = [];
  for (const [cena, nome] of DIFICEIS) {
    const { b, p, erros } = await abrir(cena);
    const e = await estado(p);
    resultados.push({ nome, ...e, erros: erros.length });
    await b.close();
  }
  for (const r of resultados) {
    // Qualquer um dos dois estados é aceitável; o que não se aceita é a tela
    // não dizer nada, ou quebrar.
    check(
      r.enquadrou || r.pedeFolha,
      `${r.nome}: a tela diz em que pé está (${r.enquadrou ? "enquadrou" : "pediu a folha"})`,
      r.linha,
    );
    check(r.erros === 0, `${r.nome}: sem erro de runtime`);
  }
  console.log(
    "\n  Registro, não veredito — o que estas duas cenas fizeram nesta execução:",
  );
  for (const r of resultados) {
    console.log(`    ${r.nome}: ${r.enquadrou ? "enquadrou" : "pediu a folha"}`);
  }
}

console.log("\n== folha escura sobre mesa clara: contraste invertido ==");
{
  const resultados = [];
  for (const [cena, nome] of FOLHA_ESCURA) {
    const { b, p, erros } = await abrir(cena);
    const e = await estado(p);
    resultados.push({ nome, ...e, erros: erros.length });
    await b.close();
  }
  for (const r of resultados) {
    check(
      r.enquadrou || r.pedeFolha,
      `${r.nome}: a tela diz em que pé está (${r.enquadrou ? "enquadrou" : "pediu a folha"})`,
      r.linha,
    );
    check(r.erros === 0, `${r.nome}: sem erro de runtime`);
  }
  console.log(
    "\n  Registro, não veredito — o que o contraste invertido fez nesta execução:",
  );
  for (const r of resultados) {
    console.log(`    ${r.nome}: ${r.enquadrou ? "enquadrou" : "pediu a folha"}`);
  }
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);

/* A transcrição de verdade, ponta a ponta — com um dublê do motor, porque
   baixar o modelo Whisper pela rede a cada execução não é viável nesta
   bancada (ver o comentário de `whisperEngine.ts`). O que se prova aqui é o
   cano inteiro: horário por trecho, estado "processando" visível, e o que a
   aba Texto/Resumo mostram quando a transcrição chega — usando a aula de
   POO exata do pedido de produto, com "prestem atenção" como marca. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";
import {
  ATRASO_MS,
  AULA_POO,
  instalarWhisperDeMentira,
  instalarWhisperFalho,
} from "./whisper-de-mentira.mjs";

let fail = 0;
let passo = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${String(++passo).padStart(2)}. ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

async function abrirApp({ cena, whisperArg, whisperFalho = false }) {
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
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      permissions: ["camera", "microphone"],
    })
  ).newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  if (whisperFalho) {
    await p.addInitScript(instalarWhisperFalho());
  } else if (whisperArg !== undefined) {
    await p.addInitScript(instalarWhisperDeMentira(), whisperArg);
  }
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  return { b, p, erros };
}

async function entrarNoSlid(p) {
  await p.getByRole("button", { name: "SliD", exact: true }).click();
  await p.waitForTimeout(600);
  const permitir = p.getByRole("button", { name: "Permitir áudio" });
  if ((await permitir.count()) > 0) await permitir.click();
}

async function encerrarESalvar(p) {
  const mostrar = p.getByRole("button", { name: "Mostrar controles" });
  if ((await mostrar.count()) > 0) await mostrar.click();
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: /^Encerrar$/ }).first().click();
  await p.waitForTimeout(700);
  await p
    .getByRole("dialog", { name: "Encerrar a aula" })
    .getByRole("button", { name: /Salvar aula|^Encerrar$/ })
    .click();
  await p.waitForTimeout(2000);
  await p.getByRole("button", { name: /salvar|guardar/i }).first().click();
  await p.waitForTimeout(2500);
}

async function abrirAulaNaGaleria(p) {
  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(1200);
  await p
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /^SliD/ })
    .click();
  await p.waitForTimeout(900);
  await p.locator("article button").first().click();
  await p.waitForTimeout(1200);
}

console.log("═══ a transcrição local organiza uma aula gravada ═══\n");
{
  const { b, p, erros } = await abrirApp({
    cena: "fp-aula-slide-projetado.y4m",
    whisperArg: { blocos: AULA_POO, atrasoMs: ATRASO_MS },
  });

  await entrarNoSlid(p);
  await p.waitForTimeout(12000); // tempo para pelo menos um momento nascer
  await encerrarESalvar(p);
  await abrirAulaNaGaleria(p);

  // Logo ao abrir, ainda dentro da janela do atraso do dublê: a tela deve
  // estar dizendo que está organizando, não fingindo que já tem tudo.
  const corpoCedo = await p.locator("body").innerText();
  check(
    /Organizando o que foi dito/i.test(corpoCedo),
    "a tela mostra que está processando, e não trava nada",
  );

  // Passa do atraso do dublê e confirma que o estado se resolve sozinho —
  // sem recarregar a página, só pelo intervalo de novo-leitura do ClassPage.
  await p.waitForTimeout(9000);
  const corpoDepois = await p.locator("body").innerText();
  check(
    !/Organizando o que foi dito/i.test(corpoDepois),
    "e o aviso some sozinho quando termina",
  );

  await p.getByRole("tab", { name: "Texto", exact: true }).click();
  await p.waitForTimeout(500);
  const chipFala = p.getByRole("tab", { name: "Transcrição da aula" });
  if ((await chipFala.count()) > 0) await chipFala.click();
  await p.waitForTimeout(400);
  const texto = await p.locator("[role=tabpanel]").innerText();
  check(
    /encapsulamento/i.test(texto) && /heran[cç]a/i.test(texto),
    "a aba Texto traz a fala reconhecida, com os conceitos certos",
    texto.slice(0, 90).replace(/\n/g, " · "),
  );
  check(
    /\d{2}:\d{2}/.test(texto),
    "organizada em blocos com horário, não um parágrafo só",
  );

  await p.getByRole("tab", { name: "Resumo", exact: true }).click();
  await p.waitForTimeout(500);
  const resumo = await p.locator("[role=tabpanel]").innerText();
  check(/Resumo da aula/i.test(resumo), "o Resumo tem a síntese global da aula");
  check(
    /classe/i.test(resumo) && /objeto/i.test(resumo),
    "com os conceitos que a aula realmente apresentou",
  );
  // "Prestem atenção" é o AVISO, não o conteúdo — desde a rodada P0 do
  // sanitizador, "Professor destacou" mostra o CONCEITO associado ("herança"),
  // não a expressão de ênfase em si. Ver lessonSummary.ts: fraseDeConceito.
  check(
    /Professor destacou/i.test(resumo) && /heran[cç]a/i.test(resumo),
    "e a ênfase vira um momento marcado, apontando para o conceito ('herança')",
  );
  check(
    !/prestem atenção/i.test(resumo.toLowerCase()),
    "sem mostrar a expressão de aviso em si, só o que ela destacou",
  );
  check(
    !/\bIA\b/.test(await p.locator("body").innerText()),
    "sem chamar a tecnologia de 'Resumo IA' em lugar nenhum",
  );

  check(erros.length === 0, "sem erro de runtime na jornada inteira", erros[0] ?? "");
  await b.close();
}

console.log("\n═══ falha e tentar de novo ═══\n");
{
  const { b, p, erros } = await abrirApp({
    cena: "fp-aula-slide-projetado.y4m",
    whisperFalho: true,
  });

  await entrarNoSlid(p);
  await p.waitForTimeout(10000);
  await encerrarESalvar(p);
  await abrirAulaNaGaleria(p);

  await p.waitForTimeout(1500);
  const corpoFalha = await p.locator("body").innerText();
  check(
    /Não foi possível organizar o que foi dito/i.test(corpoFalha),
    "uma falha real vira aviso honesto, não uma tela presa em 'processando'",
  );
  const tentar = p.getByRole("button", { name: "Tentar de novo" });
  check((await tentar.count()) > 0, "com um jeito de tentar de novo");

  // Troca o dublê para um que funciona, e tenta de novo pelo mesmo botão.
  await p.evaluate((blocos) => {
    window.__transcreverMock__ = (_blob) =>
      new Promise((resolve) => setTimeout(() => resolve(blocos), 200));
  }, AULA_POO);
  await tentar.click();
  await p.waitForTimeout(2000);
  const corpoRecuperado = await p.locator("body").innerText();
  check(
    !/Não foi possível organizar/i.test(corpoRecuperado),
    "e desta vez recupera",
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log(fail ? `\n${fail} FALHA(S)` : "\nTUDO PASSOU");
process.exit(fail ? 1 : 0);

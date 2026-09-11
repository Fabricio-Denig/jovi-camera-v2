/* O **Identify** aplicado à fala: o SliD entende o que ouviu?
 *
 * O ciclo anterior provou que o SliD escuta — grava, mostra "Ouvindo", guarda
 * um arquivo por aula. O teste no celular mostrou o limite disso: quadro
 * ilegível, resumo genérico, e quarenta minutos de áudio ali do lado sem
 * servir para nada. Esta suíte cobre o que veio depois — a fala virando texto
 * com hora, e o texto virando destaque, título e resumo.
 *
 * **Por que a transcrição é semeada e não falada.** Medido nesta bancada:
 *
 *   typeof SpeechRecognition  → "function"
 *   eventos de uma sessão     → start, error:audio-capture, end
 *
 * A API é declarada e não funciona; não há microfone e o serviço recusa antes
 * do primeiro resultado. Exercitar o reconhecimento aqui seria testar a
 * ausência dele. Então a transcrição entra pelo mesmo armazém em que o app a
 * grava, com horários fixos — e o que esta suíte verifica é tudo o que o
 * produto faz **com** ela. O reconhecimento em si é verificação de aparelho, e
 * está no checklist.
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";
import { semearAula } from "./semear-aula.mjs";
import {
  AULA_REACT,
  AULA_SO_FALA,
  comoSegmentos,
  semearAudio,
} from "./semear-fala.mjs";

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
      `--use-file-for-fake-video-capture=${CENAS}/fp-aula-slide-projetado.y4m`,
    ],
  });
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ["camera", "microphone"],
  });
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  return { b, p, erros };
}

/** Abre a aula semeada pelo nome dela na galeria. */
async function abrirAula(p, nome) {
  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(1000);
  await p
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /^SliD/ })
    .click();
  await p.waitForTimeout(800);
  await p
    .getByRole("button", { name: new RegExp(nome, "i") })
    .first()
    .click();
  await p.waitForTimeout(1500);
}

const irPara = async (p, aba) => {
  await p.getByRole("tab", { name: aba, exact: true }).click();
  await p.waitForTimeout(600);
};

console.log("== a fala reconhecida sobrevive ao fechar do app ==");
{
  const { b, p, erros } = await abrir();
  await semearAula(p, AULA_REACT);
  await semearAudio(p, { sessionId: AULA_REACT.id });
  // Recarregar de verdade: o que este bloco verifica é persistência, e ler de
  // volta da memória do mesmo carregamento não verificaria nada.
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  await abrirAula(p, "React");
  await irPara(p, "Texto");

  const corpo = await p.locator("[role=tabpanel]").innerText();
  check(
    /Transcrição da aula/i.test(corpo),
    "a aba Texto oferece as duas fontes",
  );
  check(/Texto do quadro/i.test(corpo), "e a do quadro continua lá");

  await p.getByRole("tab", { name: "Transcrição da aula" }).click();
  await p.waitForTimeout(500);
  const fala = await p.locator("[role=tabpanel]").innerText();
  check(
    /o useState é o jeito de um componente guardar um valor que muda/i.test(
      fala,
    ),
    "e a fala está inteira, palavra por palavra",
  );
  check(
    !/lorem|exemplo de transcrição/i.test(fala),
    "sem texto que ninguém disse",
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== os destaques saem da fala, e só dela ==");
{
  const { b, p, erros } = await abrir();
  await semearAula(p, AULA_REACT);
  await semearAudio(p, { sessionId: AULA_REACT.id });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  await abrirAula(p, "React");
  await irPara(p, "Texto");
  await p.getByRole("tab", { name: "Transcrição da aula" }).click();
  await p.waitForTimeout(500);

  const fala = await p.locator("[role=tabpanel]").innerText();
  check(/O professor marcou/i.test(fala), "a seção de destaques existe");
  check(
    /isso cai na prova o estado no React é imutável/i.test(fala),
    "e traz a frase em que alguém disse que aquilo cai na prova",
  );
  check(/prestem atenção nessa parte/i.test(fala), "e a em que pediu atenção");
  /*
   * Contagem exata, e não "existe pelo menos um".
   *
   * Três frases da aula semeada carregam marca de ênfase — "prestem atenção",
   * "isso cai na prova" e "resumindo" —, e nenhuma das outras nove carrega.
   * Um quarto destaque significaria uma frase comum promovida, que é o defeito
   * que destrói a confiança nos outros três; um a menos significaria uma
   * marcação perdida. Só o número certo passa.
   */
  const marcados = p
    .locator("section")
    .filter({ hasText: "O professor marcou" })
    .locator("li");
  check(
    (await marcados.count()) === 3,
    `exatamente os três que foram marcados (${await marcados.count()})`,
  );
  check(
    !/agora vamos ver o useEffect/i.test(
      await marcados.allInnerTexts().then((t) => t.join(" ")),
    ),
    "e nenhuma frase comum entre eles",
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== o horário da fala leva o áudio até ali ==");
{
  const { b, p, erros } = await abrir();
  await semearAula(p, AULA_REACT);
  await semearAudio(p, { sessionId: AULA_REACT.id, startedAtMs: 0 });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  await abrirAula(p, "React");
  await irPara(p, "Texto");
  await p.getByRole("tab", { name: "Transcrição da aula" }).click();
  await p.waitForTimeout(500);

  // 00:59 é o trecho do "isso cai na prova" — o horário que um estudante
  // procurando o que estudar realmente tocaria.
  const botao = p
    .getByRole("button", { name: "Ouvir a aula a partir de 00:59" })
    .first();
  check((await botao.count()) > 0, "o horário de um trecho é um botão");
  await botao.click();
  await p.waitForTimeout(900);
  const t = await p.locator("audio").evaluate((a) => a.currentTime);
  check(
    Math.abs(t - 59) < 2,
    `e o áudio pulou exatamente para lá (${t.toFixed(1)}s, esperado ~59s)`,
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== quadro ilegível: a fala assume o lugar dele ==");
{
  const { b, p, erros } = await abrir();
  await semearAula(p, AULA_SO_FALA);
  await semearAudio(p, { sessionId: AULA_SO_FALA.id });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  await abrirAula(p, "sem quadro");
  await irPara(p, "Texto");

  const corpo = await p.locator("[role=tabpanel]").innerText();
  check(
    !/A câmera não conseguiu ler texto nesta aula/i.test(corpo),
    "a aba não diz que a aula não tem texto",
  );
  check(
    /o useState é o jeito de um componente/i.test(corpo),
    "porque ela abre direto no que foi falado",
  );
  check(
    /não conseguiu ler o quadro/i.test(corpo),
    "e explica por que a fala está sozinha",
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== aula sem transcrição: nada muda, nada quebra ==");
{
  const { b, p, erros } = await abrir();
  await semearAula(p, AULA_REACT);
  await semearAudio(p, {
    sessionId: AULA_REACT.id,
    segments: [],
    transcriptStatus: "indisponivel",
  });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  await abrirAula(p, "React");
  await irPara(p, "Texto");

  const corpo = await p.locator("[role=tabpanel]").innerText();
  check(
    !/Transcrição da aula/i.test(corpo),
    "sem chip de uma fonte que não existe",
  );
  check(/useState/.test(corpo), "e o texto do quadro continua inteiro");
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);

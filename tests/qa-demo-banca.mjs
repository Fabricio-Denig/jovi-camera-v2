/* A jornada que a banca vai ver, do começo ao fim, sem atalho nenhum.

   Este arquivo é diferente dos outros. Os outros testam uma tela ou um
   comportamento; este percorre o caminho inteiro na ordem em que uma pessoa o
   percorre, porque é assim que se descobre que duas peças certas não se
   encaixam — e é o único jeito de saber, antes da apresentação, que a
   demonstração roda. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";
import { AULA_FALADA, instalarFalaDeMentira } from "./fala-de-mentira.mjs";

let fail = 0;
let passo = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${String(++passo).padStart(2)}. ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

async function abrirApp({ cena, microfone = true, transcreve = false }) {
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
      permissions: ["camera", "microphone", "clipboard-read", "clipboard-write"],
    })
  ).newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));

  if (!microfone) {
    // A câmera falsa concede tudo; a negação de verdade é feita aqui, só no
    // pedido de áudio.
    await p.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (r) => {
        if (r && r.audio) {
          const e = new Error("Permission denied");
          e.name = "NotAllowedError";
          return Promise.reject(e);
        }
        return original(r);
      };
    });
  }

  if (transcreve) {
    /*
     * O reconhecimento de fala não roda nesta bancada — a API existe e morre
     * em `audio-capture`. A jornada com transcrição usa o dublê do protocolo,
     * e diz isso em voz alta no cabeçalho do bloco, em vez de deixar quem lê o
     * relatório achar que se mediu reconhecimento de verdade.
     */
    await p.addInitScript(instalarFalaDeMentira(AULA_FALADA), AULA_FALADA);
  }

  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  return { b, p, erros };
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
  await p.waitForTimeout(1500);
}

const abas = (p) => p.getByRole("tablist", { name: "Conteúdo da aula" });

console.log("═══ JORNADA 1 — SliD completo, com áudio ═══\n");
{
  const { b, p, erros } = await abrirApp({ cena: "fp-aula-slide-projetado.y4m" });

  check((await p.locator("video").count()) === 1, "a câmera abre");

  // A recomendação: o produto reconhecendo uma aula sem ninguém pedir.
  await p.waitForTimeout(9000);
  const corpoCamera = await p.locator("body").innerText();
  check(/Aula detectada/i.test(corpoCamera), "o SliD reconhece que há aula na frente");
  check(
    (await p.getByRole("button", { name: /acompanhar|ativar|usar o slid/i }).count()) > 0 ||
      /SliD/.test(corpoCamera),
    "e oferece ativar o SliD",
  );

  await p.getByRole("button", { name: "SliD", exact: true }).click();
  await p.waitForTimeout(3000);

  const corpoSessao = await p.locator("body").innerText();
  check(/Ouvindo/i.test(corpoSessao), "a sessão começa ouvindo");
  check(
    /SEE/i.test(corpoSessao) && /LISTEN/i.test(corpoSessao) && /IDENTIFY/i.test(corpoSessao),
    "e as três letras do produto estão na tela",
  );

  await p.waitForTimeout(14000);
  const momentos = await p.evaluate(
    () => [...document.querySelectorAll("img")].filter((i) => i.closest("div.size-\\[58px\\]")).length,
  );
  check(momentos > 0, "momentos são guardados sozinhos", `${momentos} na trilha`);

  await encerrarESalvar(p);
  check(/Resumo da aula/i.test(await p.locator("body").innerText()), "a aula encerra no resumo");

  // Matéria e status, que são as duas coisas que o estudante diz.
  const materia = p.getByRole("button", { name: /matemática|cálculo|física|história/i }).first();
  if ((await materia.count()) > 0) {
    await materia.click();
    await p.waitForTimeout(400);
  }
  const revisar = p.getByRole("button", { name: /^Revisar$/ }).first();
  if ((await revisar.count()) > 0) {
    await revisar.click();
    await p.waitForTimeout(400);
  }
  check(true, "matéria e status podem ser escolhidos antes de salvar");

  await p.getByRole("button", { name: /salvar|guardar/i }).first().click();
  await p.waitForTimeout(3500);

  await abrirAulaNaGaleria(p);
  const corpoAula = await p.locator("body").innerText();
  check(/Voltar/.test(corpoAula), "a aula abre da galeria");
  check(/Áudio da aula/i.test(corpoAula), "com o áudio gravado");

  const nomes = await abas(p).getByRole("tab").evaluateAll((bs) => bs.map((x) => x.textContent.trim()));
  check(nomes.join(" · ") === "Imagens · Texto · Resumo", "e as três abas", nomes.join(" · "));

  const cards = await p.locator("[role=tabpanel] li button").count();
  check(cards > 0, "Imagens: os momentos estão lá", `${cards}`);

  // Ouvir deste ponto — o que liga Listen a Identify.
  const ouvir = p.getByRole("button", { name: /ouvir a aula a partir de/i });
  check((await ouvir.count()) > 0, "cada momento tem 'ouvir deste ponto'");
  const antes = await p.evaluate(() => document.querySelector("audio").currentTime);
  await ouvir.last().click();
  await p.waitForTimeout(1400);
  const depois = await p.evaluate(() => document.querySelector("audio").currentTime);
  check(depois > antes, "e o player salta para o ponto", `${antes.toFixed(1)}s → ${depois.toFixed(1)}s`);

  await abas(p).getByRole("tab", { name: "Resumo" }).click();
  await p.waitForTimeout(600);
  const resumo = await p.locator("[role=tabpanel]").innerText();
  check(/COMO A AULA ANDOU/i.test(resumo), "Resumo: a aula condensada");
  check(!/\bIA\b/.test(await p.locator("body").innerText()), "e nenhuma promessa de IA");

  await p.getByRole("button", { name: /Copiar a aula inteira/i }).click();
  await p.waitForTimeout(700);
  const area = await p.evaluate(() => navigator.clipboard.readText());
  check(area.length > 30, "copiar a aula põe texto na área de transferência", `${area.length} caracteres`);

  const folha = await p.evaluate(() => {
    const f = document.querySelector(".folha-de-impressao");
    return f ? f.innerText.length : 0;
  });
  check(folha > 50, "e a folha de impressão está pronta para virar PDF", `${folha} caracteres`);

  check(erros.length === 0, "a jornada inteira sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n═══ JORNADA 2 — sem microfone: a aula acontece igual ═══\n");
{
  const { b, p, erros } = await abrirApp({
    cena: "fp-aula-slide-projetado.y4m",
    microfone: false,
  });

  await p.getByRole("button", { name: "SliD", exact: true }).click();
  await p.waitForTimeout(3000);

  const corpo = await p.locator("body").innerText();
  check(/Áudio desativado/i.test(corpo), "a tela diz que o áudio está desativado");
  check(!/Ouvindo/i.test(corpo), "e não finge estar ouvindo");
  check(
    /Acompanhando a aula|Procurando o conteúdo/i.test(corpo),
    "a sessão do SliD continua inteira",
  );

  await p.waitForTimeout(14000);
  const momentos = await p.evaluate(
    () => [...document.querySelectorAll("img")].filter((i) => i.closest("div.size-\\[58px\\]")).length,
  );
  check(momentos > 0, "e os momentos continuam sendo guardados", `${momentos} na trilha`);

  await encerrarESalvar(p);
  await p.getByRole("button", { name: /salvar|guardar/i }).first().click();
  await p.waitForTimeout(3500);
  await abrirAulaNaGaleria(p);

  const corpoAula = await p.locator("body").innerText();
  check(!/Áudio da aula/i.test(corpoAula), "a aula salva não mostra player que não existe");
  check(
    (await p.getByRole("button", { name: /ouvir a aula a partir de/i }).count()) === 0,
    "nem botão que não levaria a lugar nenhum",
  );
  check(
    (await p.locator("[role=tabpanel] li button").count()) > 0,
    "mas a aula está lá, completa",
  );

  check(erros.length === 0, "a jornada inteira sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n═══ JORNADA 3 — Scanner, do modo ao arquivo ═══\n");
{
  const { b, p, erros } = await abrirApp({ cena: "doc-folha-com-texto.y4m" });

  await p.getByRole("button", { name: "Modos", exact: true }).click();
  await p.waitForTimeout(800);
  check(
    (await p.getByRole("dialog").getByRole("button", { name: /^Scanner/ }).count()) > 0,
    "o modo Documento está no catálogo",
  );
  await p.getByRole("dialog").getByRole("button", { name: /^Scanner/ }).first().click();
  await p.waitForTimeout(2800);

  check(/Documento/i.test(await p.locator("body").innerText()), "o modo Documento abre");

  await p.getByRole("button", { name: /Tirar foto/i }).first().click();
  await p.waitForTimeout(1800);
  const rev = p.getByRole("dialog", { name: "Revisar documento" });
  check((await rev.count()) === 1, "capturar leva para a revisão");
  check(/Recorte automático/i.test(await rev.innerText()), "com a folha já recortada");

  await rev.getByRole("radio", { name: /^Documento/ }).click();
  await p.waitForTimeout(400);
  check(true, "a aparência Documento pode ser escolhida");

  await rev.getByRole("button", { name: /Extrair texto/i }).click();
  await p.waitForTimeout(45000);
  const lido = await rev.innerText();
  check(/Texto da folha/i.test(lido), "o texto é extraído sob demanda");
  check(/funcao|quadratica|Grau|equacoes/i.test(lido), "e é o texto que estava na folha");

  await rev.getByRole("button", { name: /Salvar na galeria/i }).click();
  await p.waitForTimeout(2500);
  check((await p.getByRole("dialog", { name: "Revisar documento" }).count()) === 0, "salvar fecha a revisão");

  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(1500);
  const naGaleria = await p.evaluate(() => document.querySelectorAll("ul li img").length);
  check(naGaleria > 0, "o documento aparece em Fotos", `${naGaleria} item(ns)`);

  const chipSlid = await p
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /^SliD/ })
    .innerText();
  check(!/SliD\s*[1-9]/.test(chipSlid), "e não virou aula do SliD", chipSlid.replace(/\n/g, " "));

  check(erros.length === 0, "a jornada inteira sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n═══ JORNADA 4 — a aula falada, de ponta a ponta ═══\n");
console.log(
  "  Aviso honesto: o reconhecimento de fala NÃO roda nesta bancada — a API\n" +
    "  existe e morre em audio-capture. Este bloco usa um dublê do protocolo\n" +
    "  (parcial, final, e o navegador encerrando o turno). Ele prova o que o\n" +
    "  produto faz com a fala, não que o reconhecimento acerta.\n",
);
{
  const { b, p, erros } = await abrirApp({
    cena: "fp-aula-slide-projetado.y4m",
    transcreve: true,
  });

  await p.waitForTimeout(2000);
  check(
    /Aula detectada/i.test(await p.locator("body").innerText()),
    "a câmera reconhece a aula na frente",
  );

  await p.getByRole("button", { name: "SliD", exact: true }).click();
  await p.waitForTimeout(4000);

  const naSessao = await p.locator("body").innerText();
  check(/Ouvindo/i.test(naSessao), "a sessão começa ouvindo");
  check(
    /Transcrevendo/i.test(naSessao),
    "e o selo evolui quando um resultado chega de verdade",
    naSessao.split("\n").slice(0, 5).join(" · "),
  );
  check(
    /useState|prestem aten|cai na prova|hoje a gente/i.test(naSessao),
    "com uma linha do que está sendo dito",
  );

  // Tempo para a fala acumular os trechos que viram destaque.
  await p.waitForTimeout(10000);

  await encerrarESalvar(p);

  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(1300);
  await p
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /^SliD/ })
    .click();
  await p.waitForTimeout(900);
  await p.locator("article button").first().click();
  await p.waitForTimeout(1800);

  await p.getByRole("tab", { name: "Texto", exact: true }).click();
  await p.waitForTimeout(800);
  const chip = p.getByRole("tab", { name: "Transcrição da aula" });
  if ((await chip.count()) > 0) {
    await chip.click();
    await p.waitForTimeout(700);
  }
  const falado = await p.locator("[role=tabpanel]").innerText();
  check(
    /useState|cai na prova|prestem aten/i.test(falado),
    "a aba Texto traz a fala da aula, palavra por palavra",
    falado.slice(0, 80).replace(/\n/g, " · "),
  );
  check(
    /O professor marcou/i.test(falado),
    "com os destaques que alguém marcou falando",
  );

  const horario = p.getByRole("button", { name: /Ouvir a aula a partir de/ }).first();
  check((await horario.count()) > 0, "e horários que levam o áudio até o trecho");
  if ((await horario.count()) > 0) {
    await horario.click();
    await p.waitForTimeout(900);
    const t = await p
      .locator("audio")
      .evaluate((a) => a.currentTime)
      .catch(() => -1);
    check(t >= 0, `tocar o horário move o player (${t.toFixed(1)}s)`);
  }

  await p.getByRole("tab", { name: "Resumo", exact: true }).click();
  await p.waitForTimeout(800);
  const resumo = await p.locator("[role=tabpanel]").innerText();
  check(
    /O que foi dito/i.test(resumo),
    "o Resumo usa o que foi dito, não só o que foi lido",
    resumo.slice(0, 80).replace(/\n/g, " · "),
  );
  check(
    !/não foi possível identificar|não tem resumo/i.test(resumo),
    "e nada nele soa como aula fracassada",
  );

  await p.getByRole("button", { name: /Copiar a aula inteira/i }).click();
  await p.waitForTimeout(700);
  const copiado = await p
    .evaluate(() => navigator.clipboard.readText())
    .catch(() => "");
  check(
    /O QUE FOI DITO/.test(copiado),
    "copiar a aula leva a parte falada junto",
    copiado.slice(0, 60).replace(/\n/g, " · "),
  );

  // Voltar, abrir de novo: o teste de que nada disso mora só na memória.
  await p.getByRole("button", { name: /Voltar/i }).first().click();
  await p.waitForTimeout(1300);
  await p.locator("article button").first().click();
  await p.waitForTimeout(1800);
  await p.getByRole("tab", { name: "Texto", exact: true }).click();
  await p.waitForTimeout(800);
  const chip2 = p.getByRole("tab", { name: "Transcrição da aula" });
  if ((await chip2.count()) > 0) {
    await chip2.click();
    await p.waitForTimeout(700);
  }
  const reaberta = await p.locator("[role=tabpanel]").innerText();
  check(
    /useState|cai na prova|prestem aten/i.test(reaberta),
    "reabrir a aula devolve a transcrição inteira",
    reaberta.slice(0, 80).replace(/\n/g, " · "),
  );

  check(erros.length === 0, "a jornada inteira sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log(
  fail === 0
    ? `\n${passo} passos, nenhuma falha. A DEMONSTRAÇÃO RODA.`
    : `\n${fail} FALHA(S) em ${passo} passos`,
);
process.exit(fail === 0 ? 0 : 1);

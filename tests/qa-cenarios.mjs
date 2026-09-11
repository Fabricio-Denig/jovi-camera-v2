/* O Resumo multimodal, nos quatro estados em que uma aula real chega.
 *
 * O produto tem duas fontes de conteúdo — o que a câmera leu do quadro e o que
 * foi falado — e elas falham de forma independente. Quatro combinações, e cada
 * uma exige uma resposta diferente. O defeito que esta suíte persegue não é
 * "a tela quebrou": é a tela **soar como fracasso** quando o app tem material,
 * ou **soar como sucesso** quando não tem.
 *
 * O caso B é o que motivou o ciclo inteiro: no teste em celular, o quadro deu
 * OCR insuficiente, o resumo saiu genérico, e havia quarenta minutos de fala
 * guardados ali do lado sem servir para nada.
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";
import { semearAula } from "./semear-aula.mjs";
import { AULA_REACT, AULA_SO_FALA, semearAudio } from "./semear-fala.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

/**
 * As frases que fazem uma aula parecer ter dado errado.
 *
 * Nenhuma delas pode aparecer quando o app tem conteúdo para mostrar — e duas
 * delas são texto que eu mesmo escrevi para o caso legítimo de não ter nada.
 * A diferença entre "honesto" e "derrotista" é só onde a frase aparece.
 */
const SOA_COMO_FRACASSO = [
  /não foi possível identificar/i,
  /não conseguiu ler o suficiente/i,
  /esta aula não tem resumo/i,
  /não conseguiu ler texto nesta aula/i,
];

const fracassos = (texto) =>
  SOA_COMO_FRACASSO.filter((r) => r.test(texto)).map((r) => String(r));

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

async function abrirAula(p, nome) {
  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(1100);
  await p
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /^SliD/ })
    .click();
  await p.waitForTimeout(900);
  await p.getByRole("button", { name: new RegExp(nome, "i") }).first().click();
  await p.waitForTimeout(1600);
  await p.getByRole("tab", { name: "Resumo", exact: true }).click();
  await p.waitForTimeout(800);
  return p.locator("[role=tabpanel]").innerText();
}

/**
 * Uma aula cujo quadro não leu nada E que não tem fala nenhuma.
 *
 * `overview: ""` importa: sem ele o seeder escreveria uma visão geral, e o
 * estado verdadeiramente vazio — o único em que a frase derrotista é a
 * resposta certa — nunca seria exercitado.
 */
const AULA_MUDA = {
  ...AULA_REACT,
  id: "aula-muda",
  subject: "Aula sem quadro e sem fala",
  overview: "",
  momentos: AULA_REACT.momentos.map((m) => ({ ...m, lines: [], cat: null })),
};

console.log("== CENÁRIO A — quadro bom + fala boa ==");
{
  const { b, p, erros } = await abrir();
  await semearAula(p, AULA_REACT);
  await semearAudio(p, { sessionId: AULA_REACT.id });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  const resumo = await abrirAula(p, "React");

  check(/Nesta aula/i.test(resumo), "o resumo traz os tópicos do quadro");
  check(/O que foi dito/i.test(resumo), "e a seção da fala");
  check(/O professor marcou/i.test(resumo), "e os destaques falados");
  check(
    fracassos(resumo).length === 0,
    "e nada que soe como aula fracassada",
    fracassos(resumo).join(", "),
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== CENÁRIO B — quadro ruim + fala boa (o caso do celular) ==");
{
  const { b, p, erros } = await abrir();
  await semearAula(p, AULA_SO_FALA);
  await semearAudio(p, { sessionId: AULA_SO_FALA.id });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  const resumo = await abrirAula(p, "sem quadro");

  /*
   * A verificação que define o ciclo. Com o quadro ilegível e a fala inteira,
   * o resumo NÃO pode dizer que não identificou o conteúdo: ele tem doze
   * trechos de fala guardados, com hora, e três marcados como importantes.
   */
  check(
    fracassos(resumo).length === 0,
    "o resumo NÃO diz que não identificou o conteúdo",
    fracassos(resumo).join(", "),
  );
  check(/O que foi dito/i.test(resumo), "porque a fala carrega o resumo");
  check(
    /useState|useEffect|estado/i.test(resumo),
    "e ela traz o assunto de verdade da aula",
  );
  check(/O professor marcou/i.test(resumo), "com os destaques no lugar");
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== CENÁRIO C — quadro bom + sem transcrição ==");
{
  const { b, p, erros } = await abrir();
  await semearAula(p, AULA_REACT);
  // Áudio existe, transcrição não — o caso do navegador sem reconhecimento.
  await semearAudio(p, {
    sessionId: AULA_REACT.id,
    segments: [],
    transcriptStatus: "indisponivel",
  });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  const resumo = await abrirAula(p, "React");

  check(/Nesta aula/i.test(resumo), "o See/Identify sustenta o resumo sozinho");
  check(!/O que foi dito/i.test(resumo), "sem seção de fala que não existe");
  check(
    fracassos(resumo).length === 0,
    "e nada faz a aula parecer que falhou",
    fracassos(resumo).join(", "),
  );
  /* Dizer que a transcrição não veio é informação, não lamento — e só cabe
     porque houve áudio e a tentativa existiu. */
  check(
    /transcrição.*não funcionou|Transcrição não disponível/i.test(resumo),
    "mas ela diz, uma vez, que a transcrição não funcionou neste navegador",
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== CENÁRIO D — os dois ruins: o produto não inventa ==");
{
  const { b, p, erros } = await abrir();
  await semearAula(p, AULA_MUDA);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  const resumo = await abrirAula(p, "sem quadro e sem fala");

  /*
   * Aqui a frase derrotista é a resposta CERTA — é o único estado em que ela
   * é verdade. O que não pode acontecer é o inverso do resto da suíte: um
   * resumo convincente de uma aula sobre a qual não se sabe nada.
   */
  check(
    /não tem resumo|não conseguiu ler o suficiente/i.test(resumo),
    "a tela diz a verdade: não deu para montar um resumo",
  );
  check(
    !/O que foi dito/i.test(resumo),
    "sem fala, porque não houve fala",
  );
  check(
    !/useState|useEffect|derivada|função/i.test(resumo),
    "e sem assunto nenhum inventado",
    resumo.slice(0, 120).replace(/\n/g, " · "),
  );
  // Os momentos continuam lá: a aula existiu, e as imagens são dela.
  await p.getByRole("tab", { name: "Imagens", exact: true }).click();
  await p.waitForTimeout(700);
  const imagens = await p.locator("[role=tabpanel]").innerText();
  check(
    /00:/.test(imagens),
    "mas os momentos guardados continuam inteiros",
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);

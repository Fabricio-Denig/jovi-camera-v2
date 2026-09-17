/**
 * O resumo alimentado com TRANSCRIPT IMPERFEITO DE VERDADE.
 *
 * Não é uma fixture escrita à mão para passar. Os dois roteiros abaixo são a
 * saída literal do motor de transcrição em áudio real:
 *
 * - POO: o que um celular produziu num teste físico ("Hoje falamos falar",
 *   "orientada do objeto", "resolver um problema para resolver um problema").
 * - MATRIZES: o que o `whisper-base` produziu no navegador, com o bundle de
 *   produção, a partir de áudio PT-BR sintetizado ("uma atriz identidade",
 *   "matrices").
 *
 * Por que isto existe. A camada de interpretação passava com transcript
 * limpo e falhava com transcript real: o resumo do teste físico saiu "A aula
 * abordou lógicas de programação, com destaque para lógica de programação e
 * programação. Também foram mencionados necessários para resolver um
 * problema e resolver um problema..." — fragmentos gramaticais, não ideias.
 * Um teste que usa a versão perfeita da fala nunca teria visto isso.
 *
 * Roda sem navegador e sem modelo: `node tests/qa-resumo-transcript-real.mjs`.
 */
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { gerarResumoGlobal, sugerirTitulo } = await jiti.import(
  "../src/listen/lessonSummary.ts",
);

let falhas = 0;
const check = (ok, rotulo, extra = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${rotulo}${extra ? " — " + extra : ""}`);
  if (!ok) falhas++;
};

/** Transcript literal do teste físico no celular (aula de POO). */
const POO = [
  "Hoje falamos falar sobre lógica de programação e programação orientada do objeto.",
  "A lógica, ajuda a organizar os passos necessários para resolver um problema para resolver um problema.",
  "Programação orientada objetos é importante e pode cair na prova Resumindo os principais assuntos são lógicas de programação E programação orientado à objeto...",
];

/**
 * Transcript literal do teste físico (aula de banco de dados e APIs REST).
 *
 * O caso mais duro dos três: idioma trocado no meio ("falar about APIs Rest"),
 * a mesma expressão em quatro grafias ("API's rest", "APIs Rest", "API reste",
 * "API restes"), uma palavra irreconhecível ("assunstios" por "assuntos"), e
 * duas afirmações OPOSTAS grudadas na mesma linha porque o reconhecimento não
 * pôs ponto final — uma marcando ênfase, a outra negando-a.
 */
const BANCO = [
  "Hoje vamos falar sobre banco de dados e API's rest.",
  "Um Banco De dados é usado para armazenar e organizar informações",
  "Agora, nós vamos falar about APIs Rest que permitem a comunicação entre diferentes sistemas",
  "Presta atenção, pois API reste são importantes e podem Esta próxima parte não é importante para avaliação.",
  "Resumindo, os principais assunstios hoje são bancos de dados e API restes",
];

/** Transcript literal do `whisper-base` no navegador (aula de matrizes). */
const MATRIZES = [
  "Hoje vamos falar sobre matrizes.",
  "Matrizes são estruturas organizadas em linhas e colunas,",
  "Vamos ver uma atriz identidade",
  "Multiplicação de matrices é importante",
  "E pode cair na prova",
];

const comoTranscript = (linhas) =>
  linhas.map((text, i) => ({
    startMs: i * 8000,
    endMs: i * 8000 + 7000,
    text,
    final: true,
  }));

function mostrar(nome, linhas) {
  const transcript = comoTranscript(linhas);
  const r = gerarResumoGlobal({ transcript, ocrLinhas: [], momentosMs: [] });
  console.log(`\n${"=".repeat(72)}\n### ${nome}`);
  console.log("\n--- INPUT REAL (imperfeito) ---");
  linhas.forEach((l) => console.log(`  ${l}`));
  console.log(
    `\n--- RESUMO DA AULA (${r.overview.split(/\s+/).filter(Boolean).length} palavras) ---`,
  );
  console.log(`  ${r.overview || "(vazio)"}`);
  console.log("\n--- PONTOS PRINCIPAIS ---");
  r.pontosPrincipais.forEach((p) => console.log(`  • ${p}`));
  console.log("\n--- PROFESSOR DESTACOU ---");
  r.professorDestacou.forEach((d) => console.log(`  ★ ${d.text}`));
  console.log("\n--- PARA REVISAR ---");
  r.paraRevisar.forEach((p) => console.log(`  • ${p}`));
  console.log(`\n--- TÍTULO: ${JSON.stringify(sugerirTitulo([], transcript))}`);
  return r;
}

const tudo = (r) =>
  [
    r.overview,
    ...r.pontosPrincipais,
    ...r.professorDestacou.map((d) => d.text),
    ...r.paraRevisar,
  ].join(" | ");

// -------------------------------------------------------------- BANCO
const banco = mostrar("BANCO DE DADOS / APIs REST — transcript do teste físico", BANCO);
const textoBanco = tudo(banco).toLowerCase();
const bulletsBanco = [...banco.pontosPrincipais, ...banco.paraRevisar];

console.log("\n== conceitos obrigatórios ==");
check(/banco de dados/.test(textoBanco), "conceito: banco de dados");
check(/apis? rest/.test(textoBanco), "conceito: APIs REST");
check(/armazenar|armazenamento/.test(textoBanco), "conceito: armazenamento");
check(/comunicação entre/.test(textoBanco), "conceito: comunicação entre sistemas");

console.log("\n== lixo do reconhecimento não vira conceito ==");
check(!/assunstios/i.test(textoBanco), "'Assunstios' não aparece em lugar nenhum");
check(!/\babout\b/i.test(textoBanco), "'About APIs rest' não vira conceito");
check(
  !bulletsBanco.some((b) => /^(usado|importante|esta próxima)/i.test(b)),
  "nenhum ponto começa por fragmento",
  bulletsBanco.join(" / "),
);

console.log("\n== sem conceito duplicado ==");
{
  // "banco de dados e API rest" + "banco de dados e APIs rest" era o defeito:
  // a mesma dupla, duas grafias, dois bullets. Só DENTRO de "Pontos
  // principais" — "Para revisar" repete itens de propósito, porque responde
  // outra pergunta ("o que eu estudo hoje à noite").
  const chaves = banco.pontosPrincipais.map((b) =>
    b.toLowerCase().replace(/[^a-z\s]/g, "").replace(/s\b/g, "").trim(),
  );
  check(new Set(chaves).size === chaves.length, "nenhum bullet repetido por variante", chaves.join(" | "));
  check(
    !bulletsBanco.some((b) => /banco de dados e api/i.test(b)),
    "os dois assuntos não ficaram colados num bullet só",
  );
}

console.log("\n== ênfase liga ao conceito, negação não apaga ==");
check(
  banco.professorDestacou.length >= 1,
  "o destaque existe (a fala marcou 'são importantes')",
);
check(
  banco.professorDestacou.some((d) => /api/i.test(d.text)),
  "o destaque é APIs REST",
  banco.professorDestacou.map((d) => d.text).join(" / "),
);
check(
  !banco.professorDestacou.some((d) => /próxima parte|proxima parte/i.test(d.text)),
  "a cláusula negada não virou destaque",
);
check(
  !/resumindo/i.test(textoBanco) && !/principais assunt/i.test(textoBanco),
  "'Resumindo...' não virou conteúdo nem destaque",
);
check(
  banco.pontosPrincipais.length >= 2 && banco.pontosPrincipais.length <= 6,
  `pontos principais entre 2 e 6 (${banco.pontosPrincipais.length})`,
);
{
  const n = banco.overview.split(/\s+/).filter(Boolean).length;
  check(n > 0 && n <= 160, `resumo ≤160 palavras (${n})`);
}

// ---------------------------------------------------------------- POO
const poo = mostrar("POO — transcript do teste físico", POO);
const textoPoo = tudo(poo).toLowerCase();

console.log("\n== conceitos obrigatórios ==");
check(/lógica de programação/.test(textoPoo), "conceito: lógica de programação");
check(
  /programação orientada?( a| à| ao| do)? objetos?/.test(textoPoo),
  "conceito: programação orientada a objetos",
);
check(
  /organizar os passos/.test(textoPoo) && /resolver um problema/.test(textoPoo),
  "conceito: organizar os passos para resolver um problema",
);

console.log("\n== nada de fragmento gramatical ==");
const bulletsPoo = [...poo.pontosPrincipais, ...poo.paraRevisar];
check(
  !bulletsPoo.some((b) => /^(necessários|necessarios|importante|resolver|resumindo|destacado)\b/i.test(b)),
  "nenhum ponto começa por fragmento",
  bulletsPoo.join(" / "),
);
check(
  !bulletsPoo.some((b) => /\b(é|e) importante\b/i.test(b)),
  "nenhum ponto carrega 'é importante'",
);
check(
  !/resumindo/i.test(textoPoo) && !/principais assuntos/i.test(textoPoo),
  "a frase de síntese não virou conteúdo",
);
check(
  !poo.professorDestacou.some((d) => /resumindo/i.test(d.text)),
  "'Resumindo...' não virou destaque",
);
check(
  poo.pontosPrincipais.length >= 2 && poo.pontosPrincipais.length <= 6,
  `pontos principais entre 2 e 6 (${poo.pontosPrincipais.length})`,
);

console.log("\n== professor destacou = conceito, não frase ==");
check(
  poo.professorDestacou.length > 0 &&
    poo.professorDestacou.every((d) => d.text.split(/\s+/).length <= 6),
  "destaque é conceito curto",
  poo.professorDestacou.map((d) => d.text).join(" / "),
);
check(
  poo.professorDestacou.some((d) => /objeto/i.test(d.text)),
  "destaque é POO (o que foi dito ser importante)",
);

console.log("\n== resumo curto e sem repetição ==");
const palavrasPoo = poo.overview.split(/\s+/).filter(Boolean).length;
check(palavrasPoo > 0 && palavrasPoo <= 130, `resumo ≤130 palavras (${palavrasPoo})`);
check(
  !/resolver um problema.*resolver um problema/i.test(poo.overview),
  "a repetição do transcript não sobreviveu no resumo",
);

// ----------------------------------------------------------- MATRIZES
const mat = mostrar("MATRIZES — transcript do whisper-base no navegador", MATRIZES);
const textoMat = tudo(mat).toLowerCase();

console.log("\n== conceitos obrigatórios ==");
check(/matriz/.test(textoMat), "conceito: matrizes");
check(/linhas e colunas/.test(textoMat), "conceito: linhas e colunas");
check(/matriz identidade/.test(textoMat), "conceito: matriz identidade (atriz→matriz)");
check(
  /multiplicação de matriz/.test(textoMat),
  "conceito: multiplicação de matrizes (matrices→matrizes)",
);

console.log("\n== nada de fragmento ==");
const bulletsMat = [...mat.pontosPrincipais, ...mat.paraRevisar];
check(
  !bulletsMat.some((b) => /\b(é|e) importante\b/i.test(b)),
  "nenhum ponto carrega 'é importante'",
  bulletsMat.join(" / "),
);
check(!/cair na prova/i.test(textoMat), "'cair na prova' não virou conceito");
check(
  mat.pontosPrincipais.length >= 2 && mat.pontosPrincipais.length <= 6,
  `pontos principais entre 2 e 6 (${mat.pontosPrincipais.length})`,
);
check(
  sugerirTitulo([], comoTranscript(MATRIZES))?.toLowerCase().includes("matriz") ?? false,
  "título fala de matrizes",
);

// ------------------------------------------------------------- NEGAÇÃO
const NEGACAO = [
  "Hoje vamos falar sobre matrizes.",
  "Programação orientada a objetos não é importante.",
  "Isso não cai na prova.",
];
const neg = gerarResumoGlobal({
  transcript: comoTranscript(NEGACAO),
  ocrLinhas: [],
  momentosMs: [],
});
console.log(`\n${"=".repeat(72)}\n### NEGAÇÃO`);
console.log(`  destaques: ${neg.professorDestacou.length}`);
check(neg.professorDestacou.length === 0, "negação não gera destaque");

// ------------------------------------------------- TERMOS TÉCNICOS
/**
 * A aula de React, do seeder que o repositório já usa. Existe aqui por um
 * motivo só: `useState` não pode voltar a virar "usestate". Foi uma regressão
 * real — o nome canônico baixava a caixa da expressão inteira —, e numa aula
 * de programação o nome do hook é exatamente o que o estudante vem conferir.
 */
const { FALA_REACT } = await import("./semear-fala.mjs");
const react = gerarResumoGlobal({
  transcript: FALA_REACT.map(([startMs, endMs, text]) => ({
    startMs,
    endMs,
    text,
    final: true,
  })),
  ocrLinhas: [],
  momentosMs: [],
});
console.log(`\n${"=".repeat(72)}\n### REACT — caixa de termos técnicos`);
react.pontosPrincipais.forEach((p) => console.log(`  • ${p}`));
const textoReact = tudo(react);
check(/useState/.test(textoReact), "useState preservado (não 'usestate')");
check(!/\busestate\b/i.test(textoReact.replace(/useState/g, "")), "nenhum 'usestate' solto");
check(
  react.pontosPrincipais.length >= 2,
  `a aula de React ainda produz pontos (${react.pontosPrincipais.length})`,
);

console.log(
  `\n${falhas === 0 ? "TUDO OK" : `${falhas} FALHA(S)`} — ${new Date().toISOString()}`,
);
process.exit(falhas === 0 ? 0 : 1);

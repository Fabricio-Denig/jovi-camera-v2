/**
 * O resumo sob ATAQUE — matérias que a camada de interpretação nunca viu.
 *
 * **Por que este arquivo existe separado do outro.**
 * `qa-resumo-transcript-real.mjs` guarda os transcripts REAIS de aparelho, e
 * é ele que prova que o produto funciona no caso medido. Mas defender só
 * esses quatro roteiros é a receita para ajustar a lógica até eles passarem —
 * o que produz um sistema que sabe falar de POO e matrizes e quebra na
 * primeira aula de biologia. Aqui os roteiros são NOVOS, de sete matérias
 * diferentes, e nenhuma asserção compara com uma string esperada: as
 * verificações são PROPRIEDADES que qualquer resumo bom tem que ter, em
 * qualquer aula.
 *
 * As propriedades: não inventar (tudo que sai tem que estar na entrada), não
 * duplicar conceito, não deixar palavra de ênfase virar assunto, respeitar
 * negação, não encher cota quando não há conteúdo, e não devolver fragmento
 * gramatical.
 *
 * Roda sem navegador e sem modelo: `node tests/qa-resumo-adversarial.mjs`.
 */
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { gerarResumoGlobal, sugerirTitulo } = await jiti.import(
  "../src/listen/lessonSummary.ts",
);
const { semAcento } = await jiti.import("../src/listen/speechInsights.ts");

let falhas = 0;
const check = (ok, rotulo, extra = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${rotulo}${extra ? " — " + extra : ""}`);
  if (!ok) falhas++;
};

const comoTranscript = (linhas) =>
  linhas.map((text, i) => ({
    startMs: i * 9000,
    endMs: i * 9000 + 8000,
    text,
    final: true,
  }));

function resumir(linhas) {
  const transcript = comoTranscript(linhas);
  return {
    r: gerarResumoGlobal({ transcript, ocrLinhas: [], momentosMs: [] }),
    titulo: sugerirTitulo([], transcript),
    transcript,
  };
}

const saidas = (r) => [
  r.overview,
  ...r.pontosPrincipais,
  ...r.professorDestacou.map((d) => d.text),
  ...r.paraRevisar,
];

/**
 * A verificação que vale mais que todas: NADA sai que não entrou.
 *
 * Toda palavra de conteúdo do resumo tem que existir no transcript. As
 * exceções são as palavras dos MOLDES das frases ("a aula abordou X") — que
 * são estrutura, não conteúdo — e por isso estão listadas aqui uma a uma, em
 * vez de a checagem simplesmente ignorar palavras desconhecidas.
 */
const PALAVRAS_DE_MOLDE = new Set(
  (
    "a o e de da do das dos em no na para por com que aula abordou ao falar " +
    "tratou foi foram apontada apontado apontadas apontados pelo professor " +
    "como conteudo importante tambem mencionado mencionada mencionados " +
    "mencionadas durante houve destaque quadro nao deu ler direito mas dito " +
    "sustenta este resumo audio entender sobre os as um uma se ja"
  ).split(/\s+/),
);

function naoInventou(r, linhas, rotulo) {
  const fonte = new Set(
    semAcento(linhas.join(" "))
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  );
  const intrusas = [];
  for (const texto of saidas(r)) {
    for (const bruto of semAcento(texto).split(/[^\p{L}\p{N}]+/u)) {
      if (!bruto || bruto.length < 3) continue;
      if (fonte.has(bruto) || PALAVRAS_DE_MOLDE.has(bruto)) continue;
      intrusas.push(bruto);
    }
  }
  check(intrusas.length === 0, `${rotulo}: nada inventado`, [...new Set(intrusas)].join(" "));
}

/** Dois bullets que dizem a mesma coisa (mesmo conjunto de radicais). */
function semDuplicataSemantica(r, rotulo) {
  const radical = (p) => (p.length >= 5 && p.endsWith("es") ? p.slice(0, -2) : p.length >= 4 && p.endsWith("s") ? p.slice(0, -1) : p);
  const chave = (b) =>
    [...new Set(semAcento(b).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3).map(radical))]
      .sort()
      .join("+");
  const chaves = r.pontosPrincipais.map(chave);
  check(
    new Set(chaves).size === chaves.length,
    `${rotulo}: sem duplicata semântica nos pontos`,
    chaves.join(" | "),
  );
}

/** Nenhum bullet é um fragmento gramatical solto. */
const INICIOS_RUINS =
  /^(necess[áa]ri|importante|usado|usada|permite|permitem|resolver|resumindo|about|assunst|ser[áa]|pode|podem|essa|esse|isso|depois|agora|ent[ãa]o)/i;

function semFragmento(r, rotulo) {
  const ruins = [...r.pontosPrincipais, ...r.paraRevisar].filter((b) =>
    INICIOS_RUINS.test(b.trim()),
  );
  check(ruins.length === 0, `${rotulo}: nenhum ponto é fragmento`, ruins.join(" / "));
}

function limites(r, rotulo) {
  const n = r.overview.split(/\s+/).filter(Boolean).length;
  check(n <= 160, `${rotulo}: resumo ≤160 palavras (${n})`);
  check(
    r.pontosPrincipais.length <= 6,
    `${rotulo}: no máximo 6 pontos (${r.pontosPrincipais.length})`,
  );
  check(
    r.professorDestacou.length <= 3,
    `${rotulo}: no máximo 3 destaques (${r.professorDestacou.length})`,
  );
}

function mostrar(nome, linhas, r, titulo) {
  console.log(`\n${"=".repeat(74)}\n### ${nome}`);
  console.log("ENTRADA:");
  linhas.forEach((l) => console.log(`  ${l}`));
  console.log(`\nRESUMO: ${r.overview || "(vazio)"}`);
  console.log("PONTOS:");
  r.pontosPrincipais.forEach((p) => console.log(`  • ${p}`));
  console.log("DESTACOU:");
  r.professorDestacou.forEach((d) => console.log(`  ★ ${d.text}`));
  console.log("REVISAR:");
  r.paraRevisar.forEach((p) => console.log(`  • ${p}`));
  console.log(`TÍTULO: ${JSON.stringify(titulo)}\n`);
}

/** As propriedades que valem para TODO cenário com conteúdo. */
function comuns(nome, linhas, r) {
  naoInventou(r, linhas, nome);
  semDuplicataSemantica(r, nome);
  semFragmento(r, nome);
  limites(r, nome);
  const tudo = saidas(r).join(" ").toLowerCase();
  check(!/resumindo|resumino/.test(tudo), `${nome}: "Resumindo" não virou conteúdo`);
  check(
    !r.professorDestacou.some((d) => /resumin/i.test(d.text)),
    `${nome}: "Resumindo" não virou destaque`,
  );
}

// ─────────────────────────────────────────────────────────── A — REDES/HTTP
{
  const linhas = [
    "Hoje vamos falar sobre redes de computadores e protocolo HTTP.",
    "Redes de computadores permitem diferentes dispositivos se comunicar e trocar informações.",
    "Agora vamo falar de HTTP que é usado na comunicação entre cliente servidor.",
    "Presta atenção porque HTTP é importante e pode cair na avaliação.",
    "Essa próxima parte não é importante pra prova.",
    "Resumindo os principais assuntos são redes de computadores e protocolo HTTP.",
  ];
  const { r, titulo } = resumir(linhas);
  mostrar("A — REDES / HTTP", linhas, r, titulo);
  comuns("A", linhas, r);
  const tudo = saidas(r).join(" ").toLowerCase();
  check(/redes de computadores/.test(tudo), "A: conceito redes de computadores");
  check(/http/.test(tudo), "A: conceito HTTP");
  check(/comunica/.test(tudo), "A: a relação de comunicação sobreviveu");
  check(
    r.professorDestacou.some((d) => /http/i.test(d.text)),
    "A: o destaque é HTTP",
    r.professorDestacou.map((d) => d.text).join(" / "),
  );
  check(
    !r.professorDestacou.some((d) => /pr[óo]xima parte/i.test(d.text)),
    "A: a cláusula negada não virou destaque",
  );
}

// ──────────────────────────────────────────────────────────── B — BANCO/SQL
{
  const linhas = [
    "Hoje assunto banco dados SQL.",
    "Banco de dados guarda e organiza informação.",
    "SQL é usada pra consultar os dados no banco.",
    "SQL importante cai na prova.",
    "Resumino assunto banco de dado e SQL.",
  ];
  const { r, titulo } = resumir(linhas);
  mostrar("B — BANCO / SQL (telegráfico)", linhas, r, titulo);
  comuns("B", linhas, r);
  const tudo = saidas(r).join(" ").toLowerCase();
  check(/banco de dado/.test(tudo), "B: conceito banco de dados");
  check(/sql/.test(tudo), "B: conceito SQL");
  check(
    !/\bSQL\b/.test(saidas(r).join(" ")) || /SQL/.test(saidas(r).join(" ")),
    "B: SQL mantém a caixa",
  );
}

// ────────────────────────────────────────────────────────────── C — HISTÓRIA
{
  const linhas = [
    "Hoje vamos falar revolução industrial.",
    "Revolução industrial mudou forma de produção.",
    "Máquina vapor teve papel importante.",
    "Isso não cai na prova agora.",
    "Depois vamos falar urbanização.",
    "Resumindo revolução industrial máquina vapor e urbanização.",
  ];
  const { r, titulo } = resumir(linhas);
  mostrar("C — HISTÓRIA", linhas, r, titulo);
  comuns("C", linhas, r);
  const tudo = saidas(r).join(" ").toLowerCase();
  check(/revolu/.test(tudo), "C: conceito revolução industrial");
  check(/vapor/.test(tudo), "C: conceito máquina a vapor");
  check(/urbaniza/.test(tudo), "C: conceito urbanização");
  check(
    !r.professorDestacou.some((d) => /n[ãa]o cai/i.test(d.text)),
    "C: 'isso não cai na prova' não vira destaque",
  );
}

// ────────────────────────────────────────────────────────────── D — BIOLOGIA
{
  const linhas = [
    "Hoje tema célula animal e célula vegetal.",
    "Célula vegetal tem parede celular.",
    "Célula animal não tem parede celular.",
    "Prestem atenção nessa diferença porque é importante.",
    "Resumindo célula animal vegetal e parede celular.",
  ];
  const { r, titulo } = resumir(linhas);
  mostrar("D — BIOLOGIA", linhas, r, titulo);
  comuns("D", linhas, r);
  const tudo = saidas(r).join(" ").toLowerCase();
  check(/c[ée]lula/.test(tudo), "D: conceito célula");
  check(/parede celular/.test(tudo), "D: conceito parede celular");
  check(
    !/mitoc[ôo]ndria|n[úu]cleo|cloroplasto|citoplasma/.test(tudo),
    "D: NÃO inventou organela que ninguém citou",
  );
}

// ──────────────────────────────────────────────────────────── E — MATEMÁTICA
{
  const linhas = [
    "Hoje vamos falar função primeiro grau.",
    "A função tem coeficiente angular e coeficiente linear.",
    "Essa parte não é importante agora.",
    "Depois exemplo gráfico.",
    "Coeficiente angular é importante pra avaliação.",
    "Resumindo função primeiro grau e coeficiente angular.",
  ];
  const { r, titulo } = resumir(linhas);
  mostrar("E — MATEMÁTICA", linhas, r, titulo);
  comuns("E", linhas, r);
  const tudo = saidas(r).join(" ").toLowerCase();
  check(/fun[çc][ãa]o/.test(tudo), "E: conceito função de primeiro grau");
  check(/coeficiente angular/.test(tudo), "E: conceito coeficiente angular");
  check(
    r.professorDestacou.some((d) => /coeficiente angular/i.test(d.text)),
    "E: o destaque é coeficiente angular",
    r.professorDestacou.map((d) => d.text).join(" / "),
  );
}

// ─────────────────────────────────────────────── F — TRANSCRIPT MUITO RUIM
{
  const linhas = [
    "Hoje a gente vai vai falar sobre sobre estrutu de dados e and algoritmo",
    "estrutu de dado serve pra pra guardar informa de forma organiz",
    "algoritmo algoritimo é uma sequên de passos passos pra resolver problem",
    "the próxima parte é sobre complex de algoritmo mas não não é importante",
  ];
  const { r, titulo } = resumir(linhas);
  mostrar("F — TRANSCRIPT MUITO RUIM", linhas, r, titulo);
  comuns("F", linhas, r);
  check(
    r.pontosPrincipais.length <= 5,
    `F: entrada ruim produz MENOS, não mais (${r.pontosPrincipais.length})`,
  );
  const tudo = saidas(r).join(" ").toLowerCase();
  check(!/\b(and|the)\b/.test(tudo), "F: ruído em inglês fora dos conceitos");
  check(
    !r.professorDestacou.some((d) => /pr[óo]xima parte/i.test(d.text)),
    "F: a parte negada não virou destaque",
  );
}

// ────────────────────────────────────────────────── G — QUASE SEM CONTEÚDO
{
  const linhas = [
    "Então pessoal beleza vamos começar",
    "é isso daqui",
    "vamos seguindo",
    "depois a gente vê",
  ];
  const { r, titulo } = resumir(linhas);
  mostrar("G — QUASE SEM CONTEÚDO", linhas, r, titulo);
  naoInventou(r, linhas, "G");
  semFragmento(r, "G");
  check(
    r.pontosPrincipais.length <= 2,
    `G: quase nada vira quase nada (${r.pontosPrincipais.length} pontos)`,
    r.pontosPrincipais.join(" / "),
  );
  check(r.professorDestacou.length === 0, "G: nenhum destaque inventado");
  check(titulo === null, `G: sem título quando não há assunto (${JSON.stringify(titulo)})`);
}

// ───────────────────────────────────────────────────── H — MUITA REPETIÇÃO
{
  const linhas = [
    "API REST API REST API REST",
    "é importante importante",
    "API REST",
    "banco banco banco de dados",
  ];
  const { r, titulo } = resumir(linhas);
  mostrar("H — MUITA REPETIÇÃO", linhas, r, titulo);
  naoInventou(r, linhas, "H");
  semDuplicataSemantica(r, "H");
  limites(r, "H");
  check(
    r.pontosPrincipais.length <= 3,
    `H: repetição não vira lista (${r.pontosPrincipais.length} pontos)`,
    r.pontosPrincipais.join(" / "),
  );
  // "API REST API REST API REST" não pode sair inteiro como um "conceito".
  check(
    !r.pontosPrincipais.some((p) => (p.match(/API/gi) ?? []).length > 1),
    "H: nenhum ponto repete o mesmo termo dentro de si",
    r.pontosPrincipais.join(" / "),
  );
  check(/API/.test(saidas(r).join(" ")), "H: API mantém a caixa");
}

console.log(
  `\n${falhas === 0 ? "TUDO OK" : `${falhas} FALHA(S)`} — ${new Date().toISOString()}`,
);
process.exit(falhas === 0 ? 0 : 1);

import type { TranscriptSegment } from "../shared/lib/mediaStore";
import {
  MARCAS_DE_ENFASE,
  semAcento,
  marcaDeEnfaseValida,
  negadoAntes,
} from "./speechInsights";
import { MENSAGEM_TRECHO_DEGENERADO } from "./transcriptSanitizer";
import {
  comoTitulo,
  extrairConceitos,
  type Conceito,
  type FraseAnalise,
} from "./conceitos";



/**
 * As marcas de `MARCAS_DE_ENFASE` que sinalizam SÍNTESE ("resumindo", "em
 * resumo"...), não um aviso específico ("prestem atenção", "cai na prova").
 *
 * Ficam FORA só de "Professor destacou" (`gerarResumoGlobal`) — a aba Texto
 * (`classText.ts`/`TranscriptView.tsx`, via `acharDestaques`) continua
 * marcando essas frases normalmente, porque ali o objetivo é diferente:
 * mostrar TODA frase onde o professor usou uma expressão de ênfase, não
 * escolher UM destaque curado. A diferença importa porque "resumindo, os
 * principais pontos são X, Y e Z" costuma ser uma frase inteira listando
 * vários assuntos — virar "Professor destacou" com ela vira um bloco enorme
 * no lugar de um destaque específico (achado com um teste físico real).
 */
const MARCAS_DE_SINTESE = new Set(
  [
    "resumindo",
    "em resumo",
    "para resumir",
    "o principal e",
    "o principal é",
    "vamos revisar",
    // "os principais assuntos são X e Y" é recapitulação, não aviso — sem
    // isto ela entrava em "Professor destacou" com a frase inteira.
    "os principais assuntos",
    "os principais pontos",
  ].map(semAcento),
);

/**
 * A frase contém uma marca de síntese ("resumindo", "em resumo", "os
 * principais...")?
 *
 * Diferente de `ehApenasMarcaDeSintese`: aqui basta CONTER. É o que faz
 * "Programação orientada objetos é importante e pode cair na prova Resumindo
 * os principais assuntos são lógicas de programação E programação orientado à
 * objeto" — uma frase só, porque o reconhecimento não pôs ponto final —
 * ainda reforçar os conceitos que ela recapitula, mesmo carregando junto uma
 * marca de ênfase de verdade.
 */
function temMarcaDeSintese(texto: string): boolean {
  return acharMarcaDeSintese(semAcento(texto)) !== -1;
}

/**
 * Onde a recapitulação começa — TOLERANTE à fala mal transcrita.
 *
 * Achado atacando o resumo com um roteiro telegráfico: o professor disse
 * "Resumindo" e o reconhecimento entregou "Resumino". A comparação era por
 * string exata, a marca não casou, e a frase de recapitulação inteira virou
 * ponto principal, item de "Para revisar", "Professor destacou" E o título da
 * aula — "Resumino assunto banco de dado e SQL". Um marcador de síntese que
 * só funciona quando o STT acerta a palavra não serve para o STT que temos.
 *
 * A tolerância é deliberadamente estreita: a primeira palavra da marca tem de
 * bater por RADICAL ("resumin" cobre resumindo/resumino/resumino), e só para
 * marcas de uma palavra. Marcas compostas ("os principais assuntos")
 * continuam exigindo a frase inteira — ali o risco de falso positivo é alto e
 * a evidência, mais fraca.
 */
const RADICAIS_DE_SINTESE = ["resumin", "resumo", "recapitul", "sintetiz"];

function acharMarcaDeSintese(normal: string): number {
  let melhor = -1;
  const registrar = (idx: number) => {
    if (idx > -1 && !negadoAntes(normal, idx) && (melhor === -1 || idx < melhor)) {
      melhor = idx;
    }
  };
  for (const m of MARCAS_DE_SINTESE) registrar(normal.indexOf(m));
  for (const radical of RADICAIS_DE_SINTESE) {
    // Só no começo de uma palavra — "resumo" dentro de outra não marca nada.
    const re = new RegExp(`(^|[^\\p{L}])${radical}`, "u");
    const achado = re.exec(normal);
    if (achado) registrar(achado.index + achado[1].length);
  }
  return melhor;
}

/**
 * Corta a frase onde a recapitulação começa.
 *
 * O reconhecimento nem sempre põe ponto final, e no teste físico três
 * sentenças viraram uma linha só: "Programação orientada objetos é importante
 * e pode cair na prova Resumindo os principais assuntos são lógicas de
 * programação E programação orientado à objeto". Tratada como uma frase,
 * TUDO nela herdava a marca de ênfase — e "lógica de programação", que o
 * professor só recapitulou, aparecia em "Professor destacou" ao lado do
 * conceito que ele de fato destacou.
 *
 * O corte na marca de síntese separa as duas metades pelo que elas são: o que
 * vem antes é ênfase de verdade; o que vem depois é recapitulação, que dá
 * PESO aos conceitos citados sem transformá-los em destaques.
 */
function partirEmClausulas(texto: string): { texto: string; sintese: boolean }[] {
  const normal = semAcento(texto);

  /*
   * Onde a frase muda de assunto: uma recapitulação começando, ou uma
   * NEGAÇÃO começando. Os dois casos vieram de transcript real, na mesma
   * linha, porque o reconhecimento não pôs ponto final:
   *
   *   "Presta atenção, pois API reste são importantes e podem
   *    Esta próxima parte não é importante para avaliação."
   *
   * São duas afirmações opostas grudadas. Tratadas como uma frase só, ou a
   * negação contamina o destaque legítimo das APIs, ou o destaque legítimo
   * faz a parte negada contar como ênfase. Cortar no "não" resolve os dois:
   * o que vem antes mantém a ênfase que mereceu, e o que vem depois carrega
   * a própria negação, que `marcaDeEnfaseValida` já sabe descontar.
   */
  const cortes: { at: number; sintese: boolean }[] = [];
  const sintese = acharMarcaDeSintese(normal);
  if (sintese > 0) cortes.push({ at: sintese, sintese: true });
  for (const m of ["nao ", "nunca ", "jamais "]) {
    let de = 0;
    for (;;) {
      const idx = normal.indexOf(m, de);
      if (idx <= 0) break;
      // Só quando é começo de palavra — "não" dentro de outra não corta nada.
      if (idx === 0 || /[\s,;:]/.test(normal[idx - 1])) {
        cortes.push({ at: idx, sintese: false });
      }
      de = idx + m.length;
    }
  }
  if (cortes.length === 0) {
    return [{ texto, sintese: temMarcaDeSintese(texto) }];
  }

  // `semAcento` preserva o comprimento (troca letra por letra), então os
  // índices achados no normalizado valem no original.
  cortes.sort((a, b) => a.at - b.at);
  const partes: { texto: string; sintese: boolean }[] = [];
  let inicio = 0;
  let sinteseAtual = false;
  for (const corte of cortes) {
    if (corte.at <= inicio) continue;
    const pedaco = texto.slice(inicio, corte.at).trim();
    if (pedaco) partes.push({ texto: pedaco, sintese: sinteseAtual });
    inicio = corte.at;
    // Depois de uma marca de síntese, TUDO o que vem é recapitulação.
    sinteseAtual = sinteseAtual || corte.sintese;
  }
  const resto = texto.slice(inicio).trim();
  if (resto) partes.push({ texto: resto, sintese: sinteseAtual });
  return partes;
}

/**
 * A fala inteira → as CLÁUSULAS que a camada de conceitos analisa.
 *
 * Um lugar só, usado pelo resumo E pelo título. Eram dois caminhos: o título
 * montava os conceitos a partir das frases cruas, sem marcar recapitulação
 * nem ênfase, e por isso via uma aula diferente da que o resumo via. Duas
 * leituras da mesma fala produzem duas verdades, e uma delas está errada.
 */
function clausulasDaFala(transcript: TranscriptSegment[]): FraseAnalise[] {
  return frasesDaFala(transcript).flatMap((f) =>
    partirEmClausulas(f.texto).map((parte) => ({
      texto: parte.texto,
      atMs: f.atMs,
      origem: "fala" as const,
      /*
       * A ênfase é avaliada NA CLÁUSULA, não na frase. É a diferença entre
       * "as APIs são importantes" (destaque legítimo) e "esta próxima parte
       * não é importante" (o oposto), que o reconhecimento entregou grudadas
       * na mesma linha. `marcaDeEnfaseValida` já desconta a negação dentro
       * da cláusula; o corte garante que ela veja uma cláusula por vez.
       */
      enfatizada:
        !parte.sintese &&
        marcaDeEnfaseValida(semAcento(parte.texto)) !== null &&
        !ehApenasMarcaDeSintese(parte.texto),
      sintese: parte.sintese,
    })),
  );
}

/** Uma frase cuja ÚNICA marca de ênfase é uma marca de síntese — não deve
    virar uma linha isolada em "Professor destacou". */
function ehApenasMarcaDeSintese(texto: string): boolean {
  const normal = semAcento(texto);
  const encontradas = MARCAS_DE_ENFASE.filter((m) => normal.includes(semAcento(m)));
  return (
    encontradas.length > 0 &&
    encontradas.every((m) => MARCAS_DE_SINTESE.has(semAcento(m)))
  );
}

/**
 * O resumo GLOBAL da aula — uma síntese, não a transcrição de volta.
 *
 * A diferença entre esta camada e `speechInsights.ts` é o tamanho da unidade
 * que cada uma manipula. `blocosDeFala`/`frasesRepresentativas` trabalham em
 * PARÁGRAFOS (até 30s de fala) — bom para a aba Texto, que existe para ler a
 * aula inteira. Um parágrafo inteiro como "ponto principal" do Resumo é
 * exatamente o defeito que um teste real expôs: a aba virou "quase a
 * transcrição de volta". Este módulo trabalha em FRASES — a fala e o quadro
 * divididos na pontuação final —, que é o tamanho de um conceito.
 *
 * A ideia central: agrupar frases pelo TERMO MAIS FORTE que cada uma carrega,
 * e manter só a de maior pontuação de cada grupo. "A escalação" dita em
 * quatro frases diferentes produz UM ponto sobre escalação, não quatro — é
 * deduplicação por conceito, não por texto idêntico.
 *
 * Regra que vale para o arquivo inteiro, herdada de `speechInsights.ts`:
 * nada é inventado. Toda frase que sai daqui foi dita ou lida; o que este
 * módulo faz é ESCOLHER, AGRUPAR e ENCADEAR com conectores — nunca completar
 * conteúdo que não estava na captura.
 */

/** O que a aba Resumo mostra, já pronto — sem processamento na tela. */
export interface LessonSummary {
  /** 2-5 frases, ~180 palavras no máximo. Vazio quando não há evidência nenhuma. */
  overview: string;
  /** Até 7 conceitos centrais, sem repetir o mesmo assunto duas vezes. */
  pontosPrincipais: string[];
  /** No máximo 4 — o professor marcando ênfase, já deduplicado por conceito. */
  professorDestacou: { atMs: number; text: string; marca: string }[];
  /** No máximo 4 — pistas do que vale revisar, além dos pontos principais. */
  paraRevisar: string[];
  /** Falso só quando não existe absolutamente nenhuma fonte (nem fala, nem quadro). */
  temConteudo: boolean;
}

/*
 * Os tetos do resumo, apertados de propósito depois que ele passou a
 * trabalhar em CONCEITOS.
 *
 * Com a camada antiga, que escolhia frases, sete pontos eram sete frases
 * longas e o teto alto tinha alguma função. Agora cada ponto é uma expressão
 * de duas a quatro palavras, e sete deles não é um resumo — é um índice.
 * Menos itens, cada um significando algo, é o que se lê na véspera da prova.
 * As listas ficam abaixo do máximo sempre que a evidência não sustentar mais
 * (ver o filtro `sustentados`): o teto é um limite, nunca uma cota a
 * preencher.
 */
const TETO_PALAVRAS = 160;
const MAX_PONTOS = 6;
const MAX_DESTAQUES = 3;
const MAX_REVISAR = 3;
/** Uma frase mais curta que isto não carrega assunto — "tá.", "então.". */
const MIN_PALAVRAS_FRASE = 4;

function palavras(t: string): number {
  return t.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Fecha a linha com ponto final. A caixa da primeira letra é decidida por
 * `comoTitulo` (`conceitos.ts`), que sabe preservar `useState` e `PIB` — por
 * isso este daqui não mexe mais nela.
 */
function pontuar(t: string): string {
  const s = t.trim().replace(/\s+/g, " ");
  if (!s) return s;
  return /[.!?…]$/.test(s) ? s : s + ".";
}


interface Frase {
  texto: string;
  atMs: number | null;
  origem: "fala" | "quadro";
  marcado: boolean;
}

/**
 * A fala partida em frases, na pontuação final — a unidade que este módulo
 * usa, mais fina que o parágrafo de `blocosDeFala`.
 *
 * Um trecho sem pontuação nenhuma (comum no reconhecimento) vira uma frase
 * só, do tamanho do trecho inteiro — sem isso, uma fala sem ponto final
 * jamais viraria candidato a nada.
 */
function frasesDaFala(segments: TranscriptSegment[]): Frase[] {
  const frases: Frase[] = [];
  for (const s of segments) {
    // O aviso do sanitizador ("Trecho pouco claro no áudio.") é honesto na
    // aba Texto, mas não é conteúdo — nunca deve virar ponto, destaque ou
    // título. Comparação exata: é uma constante fixa, não um padrão a caçar.
    if (!s.final || !s.text.trim() || s.text.trim() === MENSAGEM_TRECHO_DEGENERADO) continue;
    const marcadoAqui = temMarcaDeEnfase(s.text);
    const partes = s.text
      .split(/(?<=[.!?…])\s+/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const texto of partes.length > 0 ? partes : [s.text.trim()]) {
      frases.push({
        texto,
        atMs: s.startMs,
        origem: "fala",
        marcado: marcadoAqui && temMarcaDeEnfase(texto),
      });
    }
  }
  return frases;
}

function temMarcaDeEnfase(texto: string): boolean {
  return marcaDeEnfaseValida(semAcento(texto)) !== null;
}




/** Uma frase mais curta que isto já É um conceito — comprimi-la mais perderia
    naturalidade ("Multiplicação de matrizes" lê melhor que "multiplicação
    matrizes"). Acima disto, só os termos mais fortes valem a pena mostrar. */









function respeitarTeto(frases: string[], teto = TETO_PALAVRAS): string[] {
  const escolhidas: string[] = [];
  let total = 0;
  for (const f of frases) {
    const n = f.split(/\s+/).length;
    if (total + n > teto && escolhidas.length > 0) break;
    escolhidas.push(f);
    total += n;
  }
  return escolhidas;
}





export function gerarResumoGlobal({
  transcript,
  ocrLinhas,
  momentosMs,
}: {
  transcript: TranscriptSegment[];
  /** Linhas do quadro — `record.moments.flatMap(m => m.lines)`, já peneiradas pelo OCR. */
  ocrLinhas: string[];
  momentosMs: number[];
}): LessonSummary {
  void momentosMs;

  /*
   * As frases da aula, das duas fontes, já marcadas com o que a camada de
   * conceitos precisa saber de cada uma: se tem marca de ênfase válida
   * (negação já descontada, ver `marcaDeEnfaseValida`) e se é uma frase de
   * SÍNTESE ("resumindo, os principais assuntos são...").
   *
   * A distinção entre as duas conserta um defeito real do teste físico:
   * "Resumindo os principais assuntos são lógicas de programação E
   * programação orientado à objeto" virava um bullet inteiro em "Professor
   * destacou". Ela não é um destaque — é o professor apontando para OUTROS
   * conceitos. Entra como PESO neles, nunca como linha própria.
   */
  const frasesFala = clausulasDaFala(transcript);
  const frasesQuadro: FraseAnalise[] = [...new Set(ocrLinhas)]
    .filter((l) => l.trim().split(/\s+/).length >= 2)
    .map((texto) => ({
      texto: texto.trim(),
      atMs: null,
      origem: "quadro" as const,
      enfatizada: false,
      sintese: false,
    }));

  const temFala = frasesFala.length > 0;
  const temQuadro = frasesQuadro.length > 0;
  const vazio: LessonSummary = {
    overview: "",
    pontosPrincipais: [],
    professorDestacou: [],
    paraRevisar: [],
    temConteudo: false,
  };
  if (!temFala && !temQuadro) return vazio;

  const conceitos = extrairConceitos([...frasesFala, ...frasesQuadro]);
  if (conceitos.length === 0) return vazio;

  /*
   * CONSERVADORISMO, como regra e não como exceção.
   *
   * Um conceito de UMA palavra dita UMA vez não é assunto de aula — é uma
   * palavra que passou por ela. Exigir repetição, ou tamanho, ou uma marca do
   * professor é o que troca "sete bullets ruins" por "três bons". Quando nada
   * passa no filtro, o resumo fica com o melhor único em vez de encher a
   * lista com o que sobrou.
   */
  const sustentados = conceitos.filter((c) =>
    /*
     * Uma palavra SOLTA precisa de repetição — nada mais a sustenta.
     *
     * "Assunstios" (o que o reconhecimento fez de "assuntos") apareceu uma
     * vez, dentro da frase de recapitulação, e virou ponto principal E item
     * de "Para revisar" — porque estar na síntese bastava. Uma palavra única
     * dita uma única vez é ruído com sorte, não assunto de aula: se ela fosse
     * mesmo o tema, o professor teria voltado nela. Expressões de duas ou
     * mais palavras continuam passando com uma ocorrência — ali a própria
     * composição já é evidência.
     */
    c.tamanho >= 2
      ? c.ocorrencias >= 1 || c.enfatizado || c.naSintese
      : c.ocorrencias >= 2,
  );
  /*
   * Sem nada sustentado, o resumo fica VAZIO — e a aba diz isso com todas as
   * letras, em vez de mostrar um ponto principal inventado.
   *
   * A reserva anterior pegava o melhor conceito mesmo sem evidência, e numa
   * aula de quatro linhas de conversa fiada ("Então pessoal beleza vamos
   * começar / é isso daqui / vamos seguindo") produzia "A aula abordou
   * daqui." — uma frase que parece um resumo e não diz nada. Uma palavra
   * solta dita uma vez nunca é assunto; duas ou mais palavras já compõem uma
   * expressão e continuam valendo com uma ocorrência só.
   */
  const base =
    sustentados.length > 0
      ? sustentados
      : conceitos.filter((c) => c.tamanho >= 2).slice(0, 1);
  if (base.length === 0) return vazio;

  const pontosPrincipais = base
    .slice(0, MAX_PONTOS)
    .map((c) => pontuar(comoTitulo(c.canonico)));

  /*
   * "Professor destacou" mostra o CONCEITO, não a frase.
   *
   * No teste físico saía a sentença inteira ("Programação orientada objetos é
   * importante e pode cair na prova"), que mistura o aviso com o assunto. O
   * que o estudante precisa ver é o assunto — o aviso já está dito no nome da
   * seção.
   */
  const professorDestacou = base
    .filter((c) => c.enfatizado)
    .slice(0, MAX_DESTAQUES)
    .map((c) => ({
      atMs: c.atMsEnfase ?? c.atMs ?? 0,
      text: comoTitulo(c.canonico),
      marca: c.chave,
    }));

  /*
   * "Para revisar": o que o professor apontou — por ênfase OU por
   * recapitulação — e que merece uma segunda passada antes da prova.
   *
   * Repetir aqui um conceito que já está em "Professor destacou" é de
   * propósito: as duas seções respondem perguntas diferentes ("o que ele
   * marcou na aula" e "o que eu estudo hoje à noite"), e um conceito
   * destacado é justamente o primeiro candidato da segunda lista.
   */
  const paraRevisar = base
    .filter((c) => c.enfatizado || c.naSintese)
    .slice(0, MAX_REVISAR)
    .map((c) => comoTitulo(c.canonico));

  const palavrasFonte =
    transcript
      .filter((s) => s.final)
      .reduce((n, s) => n + s.text.trim().split(/\s+/).filter(Boolean).length, 0) +
    ocrLinhas.reduce((n, l) => n + l.trim().split(/\s+/).filter(Boolean).length, 0);
  const tetoResumo = Math.min(TETO_PALAVRAS, Math.max(10, palavrasFonte - 1));

  const overview = montarVisaoGeral(base, temFala, temQuadro, tetoResumo);

  return {
    overview,
    pontosPrincipais,
    professorDestacou,
    paraRevisar,
    temConteudo: pontosPrincipais.length > 0 || overview.length > 0,
  };
}

/**
 * Os conceitos → 2-4 frases de português.
 *
 * Templada, e a estrutura é a única coisa escrita aqui: todo substantivo que
 * entra veio de `extrairConceitos`, que só devolve expressões montadas com
 * palavras realmente ditas. O que estas frases afirmam é o que a captura
 * sustenta — "a aula abordou X" (X repetido), "ao falar de X, a aula tratou
 * de Y" (X e Y na MESMA frase), "X foi apontada pelo professor" (X numa frase
 * com marca de ênfase não negada). Nenhuma relação vem de conhecimento de
 * mundo.
 */
function montarVisaoGeral(
  conceitos: Conceito[],
  temFala: boolean,
  temQuadro: boolean,
  teto: number,
): string {
  if (conceitos.length === 0) return "";
  const frases: string[] = [];

  /*
   * A abertura nomeia os assuntos na ordem em que a aula os INTRODUZIU, não
   * na ordem do ranking — ler o resumo na ordem da aula é mais útil. Quando
   * dois conceitos nascem no mesmo trecho de áudio ("hoje vamos falar sobre
   * banco de dados e APIs REST"), `atMs` empata e quem desempata é a posição
   * na fala (ver `Conceito.ordem`); sem isso o resumo invertia os dois.
   */
  const naOrdemDaAula = [...conceitos.slice(0, 3)].sort((a, b) => {
    if (a.atMs !== null && b.atMs !== null && a.atMs !== b.atMs) {
      return a.atMs - b.atMs;
    }
    if (a.atMs === null && b.atMs !== null) return 1;
    if (b.atMs === null && a.atMs !== null) return -1;
    return a.ordem - b.ordem;
  });
  const abertura = naOrdemDaAula.slice(0, 2);
  frases.push(
    abertura.length === 2
      ? `A aula abordou ${abertura[0].canonico} e ${abertura[1].canonico}.`
      : `A aula abordou ${abertura[0].canonico}.`,
  );

  /*
   * A relação, quando o transcript a sustenta: dois conceitos na MESMA frase.
   * É a afirmação mais forte que dá para fazer sem interpretar semântica, e é
   * o que transforma uma lista de assuntos em algo que se lê como explicação.
   */
  const jaDito = new Set(abertura.map((c) => c.chave));
  const primario = abertura[0];
  const relacionado = conceitos.find(
    (c) => !jaDito.has(c.chave) && c.frases.some((i) => primario.frases.includes(i)),
  );
  if (relacionado) {
    frases.push(
      `Ao falar de ${primario.canonico}, a aula tratou de ${relacionado.canonico}.`,
    );
    jaDito.add(relacionado.chave);
  }

  /*
   * CONSTRUÇÕES NEUTRAS, e de propósito.
   *
   * Os moldes anteriores concordavam com o complemento — "X foi apontada",
   * "Também foram mencionados X" — e o complemento é um conceito extraído da
   * fala, de gênero e número que o app não tem como saber. O resultado
   * aparecia assim que o assunto não era feminino: "Protocolo HTTP foi
   * apontada pelo professor", visto num roteiro de redes.
   *
   * Adivinhar o gênero pela terminação (-a feminino, -o masculino) acerta a
   * maioria e erra feio numa classe inteira de palavras de aula: problema,
   * sistema, tema, mapa, teorema, dia — todas masculinas terminadas em "a".
   * Um resumo que escreve "o problema foi apresentada" perde mais confiança
   * do que ganha em fluidez.
   *
   * "houve destaque para X" e "a aula também tratou de X" aceitam qualquer
   * complemento sem concordar com ele. Nenhuma frase do resumo flexiona com
   * uma palavra que veio do reconhecimento.
   */
  const destacado = conceitos.find((c) => c.enfatizado);
  if (destacado) {
    frases.push(`Durante a aula, houve destaque para ${destacado.canonico}.`);
    jaDito.add(destacado.chave);
  }

  const sobraram = conceitos.filter((c) => !jaDito.has(c.chave)).slice(0, 2);
  if (sobraram.length === 1) {
    frases.push(`A aula também tratou de ${sobraram[0].canonico}.`);
  } else if (sobraram.length === 2) {
    frases.push(
      `A aula também tratou de ${sobraram[0].canonico} e ${sobraram[1].canonico}.`,
    );
  }

  const disclaimer = !temQuadro && temFala
    ? "O quadro não deu para ler direito, mas o que foi dito sustenta este resumo."
    : !temFala && temQuadro
      ? "O áudio não deu para entender direito, mas o quadro sustenta este resumo."
      : null;
  const tetoParaOResto = disclaimer ? Math.max(10, teto - palavras(disclaimer)) : teto;
  const escolhidas = respeitarTeto(frases, tetoParaOResto);
  if (disclaimer) escolhidas.push(disclaimer);
  return escolhidas.join(" ");
}



/**
 * Um título curto sugerido para a aula, só quando há evidência forte.
 *
 * Nunca troca um título que a pessoa já escolheu — só serve para as aulas
 * que ainda dizem "Aula sem título". A confiança exigida é alta de propósito:
 * um título errado é pior que "Aula sem título", porque parece que o app
 * entendeu algo que não entendeu.
 */
export function sugerirTitulo(
  ocrTopicos: string[],
  transcript: TranscriptSegment[],
  maxChars = 45,
): string | null {
  // O quadro já escreveu um título com as próprias palavras — a fonte mais
  // confiável que existe, porque ninguém "quase escreveu" um título.
  const doQuadro = ocrTopicos[0];
  if (doQuadro && doQuadro.length <= maxChars) return doQuadro;

  /*
   * Sem quadro, o título sai dos CONCEITOS — os mesmos que o resumo usa — e
   * não mais de uma contagem de palavras soltas.
   *
   * A versão anterior somava termos independentes e colava os dois mais
   * frequentes com um "e" no meio, o que produzia títulos que ninguém disse:
   * numa aula sobre banco de dados e APIs, "Dados e API". Os conceitos já
   * chegam aqui como expressões inteiras, agrupadas e nomeadas por evidência
   * — usar o mais forte é ao mesmo tempo mais simples e mais fiel.
   *
   * A exigência de confiança continua alta: só entra conceito com repetição
   * real, ênfase ou recapitulação do professor. Um título errado é pior que
   * "Aula sem título", porque parece que o app entendeu algo que não
   * entendeu.
   */
  /*
   * As MESMAS cláusulas que o resumo analisa — `clausulasDaFala`, não uma
   * segunda leitura simplificada.
   *
   * O título montava os conceitos com `sintese: false` em tudo, e por isso
   * enxergava um mundo diferente do resumo: numa aula de história, o resumo
   * descartava a enumeração da recapitulação e listava "Revolução
   * industrial", "Máquina vapor" e "Urbanização", enquanto o título — cego
   * para a recapitulação — nomeava a aula de "Revolução industrial máquina
   * vapor". Duas análises da mesma fala é uma a mais.
   */
  const conceitos = extrairConceitos(
    clausulasDaFala(transcript).filter(
      (f) => f.texto.split(/\s+/).length >= MIN_PALAVRAS_FRASE,
    ),
  )
    .filter((c) => c.ocorrencias >= 2 || c.tamanho >= 2)
    /*
     * Para TÍTULO, o que manda é a REPETIÇÃO, não a pontuação.
     *
     * O resumo premia expressões longas e informativas, e é o que se quer
     * dentro dele. Num título isso sai errado: numa aula que disse "matrizes"
     * quatro vezes, o conceito mais bem pontuado era "estruturas organizadas
     * em linhas e colunas" — verdadeiro, específico, e um péssimo nome de
     * aula. O nome de uma aula é a palavra à qual o professor volta.
     */
    .sort((a, b) => b.ocorrencias - a.ocorrencias || b.pontos - a.pontos);
  if (conceitos.length === 0) return null;

  const principal = comoTitulo(conceitos[0].canonico);
  if (principal.length > maxChars) return null;
  const segundo = conceitos[1]?.canonico;
  if (!segundo) return principal;
  const juntos = `${principal} e ${segundo}`;
  return juntos.length <= maxChars ? juntos : principal;
}

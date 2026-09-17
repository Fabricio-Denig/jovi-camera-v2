import type { TranscriptSegment } from "../shared/lib/mediaStore";
import {
  MARCAS_DE_ENFASE,
  PALAVRAS_DE_MARCA,
  semAcento,
  VAZIAS,
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
 * Palavras genéricas demais para virar assunto ou título — mesmo sendo
 * "conteúdo" no sentido gramatical (substantivos, adjetivos), não carregam
 * assunto nenhum sozinhas.
 *
 * Diferente de `VAZIAS` (artigos, pronomes, verbos de ligação — a gramática
 * do português), esta lista é sobre o CONCEITO: "conteúdo", "assunto" e
 * "importante" são palavras reais, com sentido, mas um resumo que usa
 * qualquer uma delas como o tema da aula está mentindo por vagueza. Achada
 * com um teste físico real: "Aula sem título" virou "Último" porque a
 * palavra "último" (comum no jeito de falar de um professor, mas sem
 * assunto nenhum) tinha peso suficiente para vencer a disputa por título.
 *
 * Fica FORA da contagem de termos (`contarTermosLocal`), então o efeito é
 * automático em toda parte que lê o mapa de pesos: pontuação de frases
 * (`pontuarFrase`), agrupamento (`termosFortes`), assunto amplo
 * (`topicoAmplo`) e título (`sugerirTitulo`) — todos herdam o corte de um
 * lugar só.
 */
const PALAVRAS_GENERICAS_DEMAIS = new Set(
  (
    "ultimo ultima primeiro primeira conteudo assunto momento teste " +
    "importante proximo proxima preparar possibilidade necessario " +
    "interessante geral outro outra outros outras mesmo mesma mesmos " +
    "mesmas varios varias diferente diferentes tudo algo alguma algum " +
    "alguns algumas coisa coisas coisinha jeito modo maneira coitado " +
    "coitada tal tais coisarada " +
    // Verbos genéricos demais para virar tópico sozinhos — achado com um
    // segundo teste físico real: "Ficar" apareceu em "Para revisar" (de
    // "...pode ficar na prova", um erro do reconhecimento por "cair").
    "ficar fica ficam fazer faz fazem hoje"
  ).split(/\s+/),
);


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
  ["resumindo", "em resumo", "o principal e", "o principal é", "vamos revisar"].map(
    semAcento,
  ),
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
  const normal = semAcento(texto);
  for (const m of MARCAS_DE_SINTESE) {
    const idx = normal.indexOf(m);
    if (idx !== -1 && !negadoAntes(normal, idx)) return true;
  }
  return false;
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
function partirNaSintese(texto: string): { texto: string; sintese: boolean }[] {
  const normal = semAcento(texto);
  let corte = -1;
  for (const m of MARCAS_DE_SINTESE) {
    const idx = normal.indexOf(m);
    if (idx > 0 && !negadoAntes(normal, idx) && (corte === -1 || idx < corte)) {
      corte = idx;
    }
  }
  if (corte === -1) {
    return [{ texto, sintese: temMarcaDeSintese(texto) }];
  }
  // `semAcento` preserva o comprimento (troca letra por letra), então o
  // índice achado no normalizado vale no original.
  const antes = texto.slice(0, corte).trim();
  const depois = texto.slice(corte).trim();
  const partes: { texto: string; sintese: boolean }[] = [];
  if (antes) partes.push({ texto: antes, sintese: false });
  if (depois) partes.push({ texto: depois, sintese: true });
  return partes;
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

const TETO_PALAVRAS = 180;
const MAX_PONTOS = 7;
const MAX_DESTAQUES = 4;
const MAX_REVISAR = 4;
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

/**
 * Quantas vezes cada termo aparece — sem piso de repetição: numa aula curta,
 * um conceito dito uma vez só ainda é o assunto da aula.
 *
 * A chave é normalizada (sem acento, minúscula) para agrupar "Função"/"função"
 * como o mesmo termo, mas `forma` guarda a grafia ORIGINAL da primeira vez
 * que apareceu — sem isso, todo termo mostrado na tela (título sugerido,
 * "Para revisar") sairia sem acento e sem maiúscula de nome próprio
 * ("corinthians" em vez de "Corinthians", achado com um teste real).
 */
function contarTermosLocal(
  textos: string[],
): Map<string, { forma: string; n: number }> {
  const contagem = new Map<string, { forma: string; n: number }>();
  for (const texto of textos) {
    const vistos = new Set<string>();
    for (const bruto of texto.split(/[^\p{L}\p{N}]+/u)) {
      const palavraOriginal = bruto.trim();
      const chave = semAcento(palavraOriginal);
      if (
        chave.length < 3 ||
        VAZIAS.has(chave) ||
        PALAVRAS_GENERICAS_DEMAIS.has(chave) ||
        // "prova", "cair", "atenção", "anotem"... avisam que algo importa —
        // não SÃO o algo. Ver o comentário de `PALAVRAS_DE_MARCA`.
        PALAVRAS_DE_MARCA.has(chave) ||
        /^\d+$/.test(chave)
      )
        continue;
      // Uma vez por frase: uma palavra repetida três vezes na MESMA frase não
      // deve pesar como se tivesse aparecido em três frases diferentes.
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const atual = contagem.get(chave);
      if (atual) atual.n += 1;
      else contagem.set(chave, { forma: palavraOriginal, n: 1 });
    }
  }
  return contagem;
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
  const frasesFala: FraseAnalise[] = frasesDaFala(transcript).flatMap((f) =>
    partirNaSintese(f.texto).map((parte) => ({
      texto: parte.texto,
      atMs: f.atMs,
      origem: "fala" as const,
      // A ênfase da frase só vale para o pedaço ANTES da recapitulação — ver
      // `partirNaSintese`.
      enfatizada:
        !parte.sintese && f.marcado && !ehApenasMarcaDeSintese(parte.texto),
      sintese: parte.sintese,
    })),
  );
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
  const sustentados = conceitos.filter(
    (c) => c.ocorrencias >= 2 || c.tamanho >= 2 || c.enfatizado || c.naSintese,
  );
  const base = sustentados.length > 0 ? sustentados : conceitos.slice(0, 1);

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

  // A abertura nomeia os assuntos na ordem em que a aula os introduziu — ler
  // o resumo na ordem da aula é mais útil que na ordem do ranking.
  const naOrdemDaAula = [...conceitos.slice(0, 3)].sort((a, b) => {
    if (a.atMs === null && b.atMs === null) return 0;
    if (a.atMs === null) return 1;
    if (b.atMs === null) return -1;
    return a.atMs - b.atMs;
  });
  const abertura = naOrdemDaAula.slice(0, 2);
  frases.push(
    abertura.length === 2
      ? `A aula abordou ${abertura[0].canonico} e ${abertura[1].canonico}.`
      : `A aula abordou ${abertura[0].canonico}.`,
  );

  /*
   * A relação, quando o transcript a sustenta: dois conceitos na MESMA frase.
   * É uma afirmação de co-ocorrência — a mais forte que dá para fazer sem
   * interpretar semântica — e é o que transforma uma lista de assuntos em
   * algo que se lê como explicação.
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

  const destacado = conceitos.find((c) => c.enfatizado);
  if (destacado) {
    frases.push(
      `${comoTitulo(destacado.canonico)} foi apontada pelo professor como conteúdo importante.`,
    );
    jaDito.add(destacado.chave);
  }

  const sobraram = conceitos.filter((c) => !jaDito.has(c.chave)).slice(0, 2);
  if (sobraram.length === 1) {
    frases.push(`Também foi mencionado ${sobraram[0].canonico}.`);
  } else if (sobraram.length === 2) {
    frases.push(
      `Também foram mencionados ${sobraram[0].canonico} e ${sobraram[1].canonico}.`,
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

function maiuscula(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
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

  // Sem isso, só resta a fala: exige repetição real (um termo dito 1 vez não
  // é assunto da aula, é uma palavra que passou por ela). Só frases com
  // conteúdo de verdade contam — sem isto, "Muito boa tarde." (curta demais
  // para ser um ponto do resumo, mas ainda assim contada aqui antes) inflava
  // termos de saudação o bastante para competir com o assunto real.
  const frases = frasesDaFala(transcript).filter(
    (f) => f.texto.split(/\s+/).length >= MIN_PALAVRAS_FRASE,
  );
  const termos = [...contarTermosLocal(frases.map((f) => f.texto)).values()]
    .filter(({ n }) => n >= 2)
    .sort((a, b) => b.n - a.n);
  if (termos.length === 0) return null;
  const principal = maiuscula(termos[0].forma);
  const segundo = termos[1]?.forma;
  const titulo = segundo ? `${principal} e ${segundo}` : principal;
  return titulo.length <= maxChars ? titulo : principal.slice(0, maxChars);
}

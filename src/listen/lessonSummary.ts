import type { TranscriptSegment } from "../shared/lib/mediaStore";
import { MARCAS_DE_ENFASE, semAcento, VAZIAS, JANELA_DEPOIS_MS } from "./speechInsights";
import { MENSAGEM_TRECHO_DEGENERADO } from "./transcriptSanitizer";

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
 * As palavras que compõem as próprias expressões de ênfase (`MARCAS_DE_ENFASE`)
 * — "prestem", "atenção", "prova", "importante", "anotem"... — derivadas
 * automaticamente da lista, não escritas à mão.
 *
 * Servem só para UMA pergunta: uma frase marcada como destaque ("Prestem
 * atenção porque isso cai na prova.") tem ALGUM assunto próprio, além de
 * avisar que algo importa? Sem excluir estas palavras, "prova" sozinha conta
 * como conteúdo e a frase parece ter assunto — quando na verdade ela só
 * aponta para um assunto que está em outra frase (achado com um teste real:
 * "Professor destacou" mostrava a frase de aviso em vez do que foi avisado).
 */
const PALAVRAS_DE_MARCA = new Set(
  MARCAS_DE_ENFASE.flatMap((m) => semAcento(m).split(/[^\p{L}\p{N}]+/u)).filter(
    (w) => w.length >= 3,
  ),
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

function pontuar(t: string): string {
  let s = t.trim().replace(/\s+/g, " ");
  if (!s) return s;
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!/[.!?…]$/.test(s)) s += ".";
  return s;
}

/** Uma frase, curta o bastante para entrar dentro de outra oração. */
function comoTopico(texto: string, maxPalavras = 14): string {
  const t = texto.trim().replace(/[.!?…]+$/, "");
  const palavras = t.split(/\s+/);
  const curta = palavras.length > maxPalavras
    ? palavras.slice(0, maxPalavras).join(" ") + "…"
    : t;
  return curta.charAt(0).toLowerCase() + curta.slice(1);
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
  const normal = semAcento(texto);
  return MARCAS_DE_ENFASE.some((m) => normal.includes(semAcento(m)));
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

/**
 * Os termos com peso real numa frase, do mais forte ao mais fraco — mas
 * primeiro descartando os que aparecem em METADE OU MAIS das frases
 * candidatas.
 *
 * `peso` aqui já é, na prática, uma contagem por-frase (cada candidata soma
 * no máximo 1 a cada termo — ver `contarTermosLocal`), então um termo com
 * peso alto não é "muito repetido dentro de uma frase", é "aparece em muitas
 * frases diferentes" — o assunto da AULA INTEIRA, não de um ponto específico
 * dela. Numa aula curta sobre futebol, "Corinthians" e "time" aparecem em
 * quase toda frase; sem este corte, TODA frase tem esses dois como os mais
 * fortes, e a deduplicação por conceito colapsa a saudação inicial com a
 * notícia real da escalação só porque as duas mencionam o time. Cortar o que
 * é comum demais deixa emergir o que cada frase tem de ESPECÍFICO.
 *
 * Cai para a lista sem corte quando o corte zeraria tudo — uma frase que só
 * fala do assunto geral da aula ainda precisa de uma assinatura.
 */
function termosFortes(
  texto: string,
  peso: Map<string, number>,
  totalCandidatos: number,
  extraExcluir?: Set<string>,
): string[] {
  const vistos = new Map<string, number>();
  for (const bruto of semAcento(texto).split(/[^\p{L}\p{N}]+/u)) {
    if (
      bruto.length < 3 ||
      VAZIAS.has(bruto) ||
      (extraExcluir && extraExcluir.has(bruto)) ||
      vistos.has(bruto)
    )
      continue;
    const w = peso.get(bruto) ?? 0;
    if (w > 0) vistos.set(bruto, w);
  }
  const todos = [...vistos.entries()].sort((a, b) => b[1] - a[1]);
  const limite = totalCandidatos * 0.5;
  const especificos = todos.filter(([, w]) => w < limite || totalCandidatos <= 2);
  return (especificos.length > 0 ? especificos : todos).map(([t]) => t);
}

function termoDominante(
  texto: string,
  peso: Map<string, number>,
  totalCandidatos: number,
  extraExcluir?: Set<string>,
): string | null {
  return termosFortes(texto, peso, totalCandidatos, extraExcluir)[0] ?? null;
}

/** Uma frase mais curta que isto já É um conceito — comprimi-la mais perderia
    naturalidade ("Multiplicação de matrizes" lê melhor que "multiplicação
    matrizes"). Acima disto, só os termos mais fortes valem a pena mostrar. */
const MAX_PALAVRAS_CONCEITO_CURTO = 6;

/**
 * O CONCEITO de uma frase — não a frase inteira.
 *
 * Achado com um teste físico real: o resumo estava embutindo frases INTEIRAS
 * (às vezes quebradas pelo reconhecimento — "Matriz são estruturas
 * organizadas em igrejas e colunas") direto no texto final. Um resumo lido
 * como estudo precisa de CONCEITOS ("Organização em linhas e colunas"), não
 * da transcrição bruta reaproveitada.
 *
 * Duas saídas, conforme o tamanho: uma frase já curta (<=6 palavras, como
 * "Multiplicação de matrizes.") é o próprio conceito — mostrar como está
 * lê melhor que picar em termos soltos. Uma frase mais longa vira os DOIS
 * termos mais fortes que ela carrega, na ordem em que aparecem no texto
 * (não por peso) — "matriz identidade" lê melhor que "identidade matriz". Os
 * pesos já favorecem termos repetidos em VÁRIAS frases da aula (`peso` é uma
 * contagem por-frase agregada), então um erro isolado do reconhecimento
 * ("igrejas" por "linhas", dito uma vez só) tende a perder para o termo
 * certo, dito várias vezes — sem precisar de um corretor ortográfico.
 */
/** A janela, em palavras, ao redor da palavra mais forte de uma frase longa —
    menor que `MAX_PALAVRAS_CONCEITO_CURTO` de propósito: uma janela grande
    o bastante para alcançar um erro do reconhecimento perto da palavra forte
    ("Matrizes são estruturas organizadas em IGREJAS e colunas" — o erro é a
    sexta palavra) reintroduziria exatamente o problema que isto existe para
    evitar. */
const LARGURA_JANELA_CONCEITO = 5;

/**
 * O CONCEITO de uma frase — um TRECHO LITERAL dela, nunca palavras soltas
 * remontadas.
 *
 * Achado com um teste real (`qa-fala.mjs`, a verificação anti-alucinação já
 * existente): uma primeira versão desta função pegava as duas palavras mais
 * fortes da frase e as juntava por conta própria ("React" de uma frase,
 * "componente" de outra) — o resultado não existia em lugar nenhum da
 * transcrição. Este produto inteiro existe para nunca inventar uma frase
 * plausível que ninguém disse (`gerarResumoGlobal`, no topo do arquivo); um
 * "conceito" mais legível que viola essa regra é pior que a frase quebrada
 * que substituiu.
 *
 * Duas saídas, sempre um TRECHO CONTÍGUO da frase original: já curta e
 * majoritariamente conteúdo real (<=6 palavras, densidade >= 0.6, como
 * "Multiplicação de matrizes.") sai como está — picar mais só pioraria a
 * leitura. Mais longa, ou rala (uma saudação como "Hoje falaremos sobre
 * matrizes."), vira uma JANELA de até `LARGURA_JANELA_CONCEITO` palavras
 * começando na palavra mais forte da frase — sem o corte de "comum demais"
 * de `termosFortes` (aqui o objetivo é o oposto: o termo mais repetido na
 * aula, "matrizes" numa aula sobre matrizes, é exatamente o que deve
 * aparecer), e sem olhar para trás — a palavra forte quase sempre abre o que
 * vale a pena mostrar, e olhar para trás só arriscaria pegar um preenchimento
 * ("hoje", "então") sem necessidade.
 */
function fraseDeConceito(
  texto: string,
  peso: Map<string, number>,
  _totalCandidatos: number,
  extraExcluir?: Set<string>,
): string | null {
  const semPontuacao = texto.trim().replace(/[.!?…]+$/, "");
  const palavras = semPontuacao.split(/\s+/);
  const curta = palavras.length <= MAX_PALAVRAS_CONCEITO_CURTO;
  if (curta && densidadeDeConteudo(texto, peso) >= 0.6) {
    return semPontuacao;
  }

  const normalizadas = palavras.map(semAcento);
  let melhorIndice = -1;
  let melhorPeso = 0;
  for (let i = 0; i < normalizadas.length; i++) {
    const p = normalizadas[i];
    if (p.length < 3 || VAZIAS.has(p) || (extraExcluir && extraExcluir.has(p))) continue;
    const w = peso.get(p) ?? 0;
    if (w > melhorPeso) {
      melhorPeso = w;
      melhorIndice = i;
    }
  }
  // Nenhuma palavra com peso real. Com `extraExcluir` (o caso de uma frase
  // de destaque): a frase inteira é só a marca de ênfase e preenchimento —
  // não sobra conceito nenhum, e mostrar um prefixo cheio de "prestem
  // atenção..." seria o mesmo defeito que `extraExcluir` existe para evitar.
  // Sem `extraExcluir` (o caso geral): mantém o prefixo curto — o mesmo
  // corte que `comoTopico` já usa em outro lugar do arquivo.
  if (melhorIndice === -1) {
    if (extraExcluir) return null;
    return curta
      ? semPontuacao
      : palavras.slice(0, MAX_PALAVRAS_CONCEITO_CURTO).join(" ") + "…";
  }

  /*
   * A janela pode olhar até DUAS palavras para TRÁS do âncora — o bastante
   * para recuperar um modificador logo antes dele ("multiplicação DE
   * matrizes", com "matrizes" como âncora) sem arriscar puxar a saudação
   * inteira. Em qualquer direção, uma palavra de `extraExcluir` (a própria
   * expressão de ênfase, nos destaques) para a janela ali — o que vem depois
   * dela normalmente já não é sobre o conceito, é o resto do aviso.
   */
  let inicio = melhorIndice;
  while (inicio > 0 && melhorIndice - inicio < 2) {
    if (extraExcluir && extraExcluir.has(normalizadas[inicio - 1])) break;
    inicio--;
  }
  let fim = melhorIndice + 1;
  while (fim < palavras.length && fim - inicio < LARGURA_JANELA_CONCEITO) {
    if (extraExcluir && extraExcluir.has(normalizadas[fim])) break;
    fim++;
  }

  const janela = [...palavras.slice(inicio, fim)];
  // Não começa nem termina numa palavra vazia solta ("de matrizes são" /
  // "organizados em") — apara as pontas até sobrar conteúdo de verdade, sem
  // nunca adicionar nada que não estivesse lá.
  while (janela.length > 1 && VAZIAS.has(semAcento(janela[0]))) {
    janela.shift();
  }
  while (janela.length > 1 && VAZIAS.has(semAcento(janela[janela.length - 1]))) {
    janela.pop();
  }
  return janela.join(" ");
}

/** Abaixo disto, uma frase falada tem palavra(s) reais demais espalhadas em
 * ruído demais para valer como ponto principal por conta própria. */
const DENSIDADE_MINIMA_FALA = 0.4;

/**
 * Quanto da frase é palavra com peso real — não só "tem alguma palavra
 * forte" (`termoDominante`), mas "a MAIORIA da frase é sobre isso".
 *
 * Existe para o caso do reconhecimento quebrado que ainda acerta uma ou duas
 * palavras reais no meio do ruído — "Carregar na prova e necessário do
 * Tudo." tem "prova" (uma palavra real), mas é ruído demais em volta para
 * merecer virar um ponto principal com essas palavras exatas. Achado com um
 * teste físico real: essa frase quebrada sobreviveu ao corte de
 * `termoDominante` sozinho e virou ponto principal.
 */
function densidadeDeConteudo(texto: string, peso: Map<string, number>): number {
  const tokens = semAcento(texto).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (tokens.length === 0) return 0;
  const vistas = new Set<string>();
  let reais = 0;
  for (const t of tokens) {
    if (t.length < 3 || VAZIAS.has(t) || vistas.has(t)) continue;
    vistas.add(t);
    if ((peso.get(t) ?? 0) > 0) reais += 1;
  }
  return reais / tokens.length;
}

/**
 * Uma frase de conteúdo perto o bastante de um destaque para explicar o que
 * foi destacado — a frase marcada em si não conta ("Prestem atenção porque
 * isso cai na prova." não é conteúdo, é um aviso), nem outra frase também
 * marcada (dois avisos seguidos não se explicam um ao outro).
 *
 * A mais PRÓXIMA no tempo vence, dentro da mesma janela usada para associar
 * fala a um momento visual (`JANELA_DEPOIS_MS`) — perto o bastante para ser
 * "sobre a mesma coisa", longe o bastante para cobrir "o professor fala do
 * assunto e só depois avisa que cai na prova".
 */
function vizinhoDeConteudo(
  destaque: Candidato,
  candidatos: Candidato[],
  janelaMs: number,
  peso: Map<string, number>,
): Candidato | null {
  if (destaque.atMs === null) return null;
  let melhor: Candidato | null = null;
  let melhorDist = Infinity;
  for (const c of candidatos) {
    const ehOMesmo = c.atMs === destaque.atMs && c.texto === destaque.texto;
    if (ehOMesmo || c.origem !== "fala" || c.marcado || c.termo === null) continue;
    if (densidadeDeConteudo(c.texto, peso) < DENSIDADE_MINIMA_FALA) continue;
    if (c.atMs === null) continue;
    const dist = Math.abs(c.atMs - destaque.atMs);
    if (dist > janelaMs || dist >= melhorDist) continue;
    melhorDist = dist;
    melhor = c;
  }
  return melhor;
}

/**
 * A chave de agrupamento para deduplicação — os DOIS termos mais fortes (e
 * mais específicos, ver `termosFortes`), não só um.
 *
 * Um único termo agrupa demais: mesmo já descartando os termos comuns
 * demais, uma segunda frase com o mesmo termo específico isolado ainda
 * colidiria à toa. Com dois termos, a chave vira um PAR
 * (`escalacao+time` vs `carregar+prova`), e só frases realmente equivalentes
 * colidem.
 */
function assinaturaDoGrupo(
  texto: string,
  peso: Map<string, number>,
  totalCandidatos: number,
): string | null {
  const fortes = termosFortes(texto, peso, totalCandidatos).slice(0, 2);
  if (fortes.length === 0) return null;
  return [...fortes].sort().join("+");
}

/**
 * O assunto AMPLO da frase — o termo de maior peso SEM o corte de "comum
 * demais" que `termosFortes` aplica.
 *
 * `termo`/`grupo` (acima) existem para não FUNDIR frases diferentes que só
 * compartilham o nome do assunto geral da aula — e para isso, precisam
 * ignorar esse nome. Mas por causa disso, eles não servem para perguntar "de
 * que assunto amplo esta frase é?": numa aula sobre fotossíntese,
 * "fotossíntese" é excluído de `termo` por aparecer demais, e cada frase
 * sobre fotossíntese acaba com um `termo` diferente (a palavra secundária
 * de cada uma) — nenhum sinal de que elas são todas do MESMO assunto amplo.
 * `topicoAmplo` é esse sinal, usado só para diversidade (`diversificarPorTermo`),
 * nunca para deduplicar.
 */
function topicoAmplo(texto: string, peso: Map<string, number>): string | null {
  const vistos = new Map<string, number>();
  for (const bruto of semAcento(texto).split(/[^\p{L}\p{N}]+/u)) {
    if (bruto.length < 3 || VAZIAS.has(bruto) || vistos.has(bruto)) continue;
    const w = peso.get(bruto) ?? 0;
    if (w > 0) vistos.set(bruto, w);
  }
  if (vistos.size === 0) return null;
  const maiorPeso = Math.max(...vistos.values());
  /*
   * Empate resolvido em ordem alfabética, não pela ordem em que a palavra
   * aparece na frase. Numa aula sobre uma coisa só ("escalação do time"),
   * "escalação" e "time" repetem quase igualmente — um empate genuíno.
   * Escolher "quem apareceu primeiro NA FRASE" faz o vencedor alternar
   * conforme a ordem das palavras em cada paráfrase diferente, e "escalação"
   * e "time" viravam DOIS assuntos amplos em vez de um — cada frase
   * escapando do teto de diversidade por sua conta. Ordem alfabética é
   * arbitrária, mas é a MESMA em toda frase, o que é o único requisito aqui.
   */
  return [...vistos.entries()]
    .filter(([, w]) => w === maiorPeso)
    .map(([t]) => t)
    .sort()[0];
}

interface Candidato extends Frase {
  pontos: number;
  /** O termo mais forte sozinho — usado para "isto já apareceu nos pontos?". */
  termo: string | null;
  /** O par de termos mais fortes — usado para agrupar/deduplicar (mais preciso). */
  grupo: string | null;
  /** O assunto amplo, sem o corte de "comum demais" — usado só para diversidade. */
  amplo: string | null;
}

function pontuarFrase(
  f: Frase,
  peso: Map<string, number>,
  momentosMs: number[],
): number {
  const palavras = semAcento(f.texto).split(/[^\p{L}\p{N}]+/u);
  let pontos = 0;
  const vistas = new Set<string>();
  for (const p of palavras) {
    if (p.length < 3 || vistas.has(p)) continue;
    vistas.add(p);
    pontos += peso.get(p) ?? 0;
  }
  pontos = pontos / Math.sqrt(Math.max(4, palavras.length));
  if (f.atMs !== null && momentosMs.some((m) => Math.abs(m - f.atMs!) <= JANELA_DEPOIS_MS)) {
    pontos *= 1.35;
  }
  if (f.marcado) pontos *= 1.6;
  return pontos;
}

/** Agrupa pelo par de termos mais fortes, mantém só a de maior pontuação por grupo. */
function deduplicarPorConceito(candidatos: Candidato[]): Candidato[] {
  const porGrupo = new Map<string, Candidato>();
  const semGrupo: Candidato[] = [];
  for (const c of candidatos) {
    if (!c.grupo) {
      semGrupo.push(c);
      continue;
    }
    const atual = porGrupo.get(c.grupo);
    if (!atual || c.pontos > atual.pontos) porGrupo.set(c.grupo, c);
  }
  return [...porGrupo.values(), ...semGrupo];
}

/**
 * Limita quantos pontos podem vir do MESMO assunto amplo — proporção, não
 * só pontuação.
 *
 * Sem isto, o assunto que a aula mais repetiu (o que tem mais frases DIFERENTES
 * falando dele) preenche sozinho todos os sete espaços, e um assunto tratado
 * em só duas ou três frases nunca aparece — mesmo sendo um assunto genuíno
 * da aula, só que mais compacto. Uma aula sobre fotossíntese, respiração
 * celular e ciclo do carbono não pode virar um resumo só sobre fotossíntese
 * porque o professor falou mais tempo sobre ela. Usa `amplo` (não `termo`,
 * que já ignora o assunto comum demais de propósito — ver `topicoAmplo`),
 * porque aqui o objetivo é o oposto: reconhecer que várias frases são do
 * MESMO assunto amplo, não fingir que não são.
 */
function diversificarPorTermo(candidatos: Candidato[], max: number): Candidato[] {
  const maxPorTermo = Math.max(2, Math.ceil(max * 0.4));
  const porTermo = new Map<string, number>();
  const selecionados: Candidato[] = [];
  for (const c of candidatos) {
    if (selecionados.length >= max) break;
    // Sem chave (nenhuma palavra com peso real): não compete por espaço nenhum
    // — cada uma destas é seu próprio caso, e sempre passa se houver vaga.
    const chave = c.amplo;
    const usados = chave ? (porTermo.get(chave) ?? 0) : 0;
    if (chave && usados >= maxPorTermo) continue;
    selecionados.push(c);
    if (chave) porTermo.set(chave, usados + 1);
  }
  /*
   * De propósito, SEM completar as vagas que sobrarem com mais frases do
   * mesmo assunto que já bateu o teto: uma aula sobre uma coisa só (o teste
   * de repetição — quinze frases, todas "escalação") tem 7 vagas mas só 3
   * usadas, e é isso mesmo — o assunto foi dito uma vez, não precisa de sete
   * variações da mesma frase para preencher uma lista. Menos pontos, mas
   * cada um significando algo, é melhor que uma lista cheia por número.
   */
  return selecionados;
}

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

/**
 * Reordena os pontos principais para servir de ABERTURA do resumo,
 * preferindo os mais curtos entre os bem pontuados.
 *
 * `pontosPrincipais` (a lista de bullets) usa a ordem por pontuação direto —
 * ali uma frase mais longa não é um problema, cada uma é sua própria linha.
 * Mas encaixada DENTRO de uma frase-modelo ("A aula abordou X, com destaque
 * para Y"), uma frase de vinte e quatro palavras (uma saudação cheia de
 * substantivos, por exemplo) lê mal — mesmo pontuando bem. Entre os quatro
 * primeiros por pontuação, prioriza os que cabem inteiros numa oração.
 */
function ordenarParaAbertura(principais: Candidato[], maxPalavras = 14): Candidato[] {
  const pool = principais.slice(0, 4);
  const curtos = pool.filter((c) => c.texto.split(/\s+/).length <= maxPalavras);
  if (curtos.length < 2) return principais;
  const restoDoPool = pool.filter((c) => !curtos.includes(c));
  const restoDaLista = principais.slice(4);
  return [...curtos, ...restoDoPool, ...restoDaLista];
}

/**
 * A síntese da aula em 2-5 frases — o que a aula FOI, não fatos sobre o
 * sistema que a guardou. Templada: a estrutura da frase é escrita aqui, mas
 * todo substantivo dentro dela veio de uma frase real, dita ou lida.
 */
/**
 * Palavras que só aparecem em português como verbo conjugado — nunca como
 * substantivo, pronome ou preposição comuns. `semAcento` embaralharia "é"
 * (verbo) com "e" (conjunção "e"), então "é" é comparado à parte, sem tirar
 * o acento.
 */
const VERBOS_SEM_AMBIGUIDADE = new Set(
  ["sao", "foi", "era", "eram", "seria", "seriam", "sera", "serao"].map(semAcento),
);

/**
 * Um conceito com VERBO PRÓPRIO — "matrizes são estruturas organizadas",
 * "falaremos sobre matrizes" — em vez de uma frase nominal — "multiplicação
 * de matrizes", "matriz identidade".
 *
 * Existe só para `montarVisaoGeral`: um conceito com verbo próprio QUEBRA a
 * gramática quando colado como complemento de outro verbo — "com destaque
 * para matrizes são estruturas organizadas" tem dois verbos disputando a
 * mesma oração. Achado com um teste real: `fraseDeConceito` (a janela em
 * torno do termo mais forte, ver o comentário lá) pode incluir um verbo que
 * estava no meio do caminho — ela nunca INVENTA palavra nenhuma, mas nem
 * toda janela literal vira uma frase nominal limpa. `pontosPrincipais` e
 * "Para revisar" não têm este problema (cada linha é a própria sentença,
 * nunca o complemento de outra), então não usam este corte.
 */
function pareceClausula(texto: string): boolean {
  for (const bruto of texto.split(/\s+/)) {
    const semPontuacao = bruto.replace(/[.,!?;:…]+$/, "");
    if (semPontuacao === "é" || semPontuacao === "É") return true;
    const normal = semAcento(semPontuacao);
    if (VERBOS_SEM_AMBIGUIDADE.has(normal)) return true;
    // "-mos" é quase sempre 1ª pessoa do plural conjugada (falaremos,
    // veremos, abordamos) — substantivo português raramente termina assim.
    if (normal.length >= 5 && normal.endsWith("mos")) return true;
  }
  return false;
}

function montarVisaoGeral(
  principaisPorPontos: Candidato[],
  destaques: Candidato[],
  temFala: boolean,
  temQuadro: boolean,
  teto: number,
  peso: Map<string, number>,
  totalCandidatos: number,
): string {
  if (principaisPorPontos.length === 0) return "";
  const principais = ordenarParaAbertura(principaisPorPontos);
  // O CONCEITO da frase, não a frase inteira — ver `fraseDeConceito`. Cai
  // para a frase original só se nada sobrar (não deveria acontecer, já que
  // estes candidatos exigem `termo !== null` — ver `candidatosComConteudo`).
  const conceito = (c: Candidato) =>
    comoTopico(fraseDeConceito(c.texto, peso, totalCandidatos) ?? c.texto);

  const frases: string[] = [];

  /*
   * Só conceitos SEM verbo próprio entram nos conectores da abertura ("A
   * aula abordou X, com destaque para Y" / "Também foi mencionado Z") — os
   * dois esperam X/Y/Z como complemento nominal, e um conceito com verbo
   * próprio quebra a frase ao ser colado ali (ver `pareceClausula`). Menos
   * texto correto vale mais que mais texto quebrado.
   */
  const comConceito = principais.map((c) => ({ texto: conceito(c) }));
  const paraConectores = comConceito.filter(({ texto }) => !pareceClausula(texto));
  const [primeiro, segundo, ...resto] = paraConectores;

  if (primeiro) {
    frases.push(
      segundo
        ? `A aula abordou ${primeiro.texto}, com destaque para ${segundo.texto}.`
        : `A aula abordou ${primeiro.texto}.`,
    );

    const maisDois = resto.slice(0, 2);
    if (maisDois.length === 1) {
      frases.push(`Também foi mencionado ${maisDois[0].texto}.`);
    } else if (maisDois.length === 2) {
      frases.push(
        `Também foram mencionados ${maisDois[0].texto} e ${maisDois[1].texto}.`,
      );
    }
  } else {
    // Nenhum conceito sem verbo próprio sobrou — a única evidência que
    // existe tem verbo próprio, então vira UMA sentença curta por conta
    // própria, nunca o complemento de outra: "Matrizes são estruturas
    // organizadas.", não "A aula abordou matrizes são estruturas
    // organizadas.".
    frases.push(pontuar(comConceito[0].texto));
  }

  if (destaques.length > 0) {
    const falaDeProva = destaques.some((d) => /prova|avalia|teste/.test(semAcento(d.texto)));
    frases.push(
      falaDeProva
        ? "Durante a explicação, o professor reforçou que parte do conteúdo pode ser cobrada em avaliação."
        : destaques.length === 1
          ? "O professor marcou um trecho como especialmente importante."
          : `O professor marcou ${destaques.length} trechos como especialmente importantes.`,
    );
  }

  // Reservado à parte, e SEMPRE incluído: é a frase mais honesta do resumo —
  // dizer que uma das duas fontes falhou — e não pode ser a primeira coisa
  // cortada só porque o teto de palavras já estava cheio com outras frases.
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
  const frasesFalaTodas = frasesDaFala(transcript);
  const frasesFala = frasesFalaTodas.filter(
    (f) => f.texto.split(/\s+/).length >= MIN_PALAVRAS_FRASE,
  );
  const frasesOcr: Frase[] = [...new Set(ocrLinhas)]
    .filter((l) => l.trim().split(/\s+/).length >= 2)
    .map((texto) => ({ texto: texto.trim(), atMs: null, origem: "quadro" as const, marcado: false }));

  const temFala = frasesFala.length > 0;
  const temQuadro = frasesOcr.length > 0;

  /*
   * O teto do resumo nunca pode passar do tamanho da FONTE — o resumo tem
   * que ser mais curto que a transcrição, sempre, mesmo numa aula de menos
   * de um minuto onde não sobra muito para comprimir. `TETO_PALAVRAS` (180)
   * é o teto ABSOLUTO; para aulas curtas, o teto de verdade é o que garante
   * compressão real.
   */
  const palavrasFonte =
    transcript
      .filter((s) => s.final)
      .reduce((n, s) => n + s.text.trim().split(/\s+/).filter(Boolean).length, 0) +
    ocrLinhas.reduce((n, l) => n + l.trim().split(/\s+/).filter(Boolean).length, 0);
  const tetoResumo = Math.min(TETO_PALAVRAS, Math.max(10, palavrasFonte - 1));

  if (!temFala && !temQuadro) {
    return {
      overview: "",
      pontosPrincipais: [],
      professorDestacou: [],
      paraRevisar: [],
      temConteudo: false,
    };
  }

  // Todas as frases da fala contam para o peso das palavras, mesmo as curtas
  // demais para virar ponto principal sozinhas ("Multiplicação de matrizes.",
  // três palavras) — elas ainda são conteúdo real, só não têm corpo bastante
  // para carregar um resumo por conta própria (ver `MIN_PALAVRAS_FRASE`).
  const termosFala = contarTermosLocal(frasesFalaTodas.map((f) => f.texto));
  const termosOcr = contarTermosLocal(frasesOcr.map((f) => f.texto));
  const peso = new Map<string, number>();
  const formas = new Map<string, string>();
  for (const [chave, { forma, n }] of termosFala) {
    peso.set(chave, (peso.get(chave) ?? 0) + n);
    formas.set(chave, forma);
  }
  // O quadro já passou por um filtro de qualidade antes de chegar aqui
  // (`summariseTopics`) — cada linha tende a ser mais informativa que uma
  // frase falada solta, então pesa um pouco mais por ocorrência.
  for (const [chave, { forma, n }] of termosOcr) {
    peso.set(chave, (peso.get(chave) ?? 0) + n * 1.3);
    if (!formas.has(chave)) formas.set(chave, forma);
  }

  const totalCandidatos = frasesFala.length + frasesOcr.length;
  const candidatos: Candidato[] = [...frasesFala, ...frasesOcr].map((f) => ({
    ...f,
    pontos: pontuarFrase(f, peso, momentosMs),
    termo: termoDominante(f.texto, peso, totalCandidatos),
    grupo: assinaturaDoGrupo(f.texto, peso, totalCandidatos),
    amplo: topicoAmplo(f.texto, peso),
  }));

  // O mesmo cálculo, mas para TODA frase da fala, sem o corte de tamanho —
  // usado só para achar o conteúdo vizinho de um destaque (`vizinhoDeConteudo`).
  // Uma frase curta demais para ser um ponto principal ainda pode ser
  // exatamente o que um destaque próximo estava apontando.
  const candidatosVizinhos: Candidato[] = frasesFalaTodas.map((f) => ({
    ...f,
    pontos: pontuarFrase(f, peso, momentosMs),
    termo: termoDominante(f.texto, peso, totalCandidatos),
    grupo: assinaturaDoGrupo(f.texto, peso, totalCandidatos),
    amplo: topicoAmplo(f.texto, peso),
  }));

  /*
   * Só frases com termo real disputam vaga de ponto principal / visão geral —
   * uma frase sem NENHUMA palavra específica (saudação, transição, fragmento
   * quebrado do reconhecimento) não é um conceito, é ruído. Sem este corte, ela
   * ainda concorre e vence quando sobra vaga — foi assim que um teste real
   * produziu "Agora eu vou preparar um pouco sobre o último." como "ponto
   * principal": a frase não tinha assunto nenhum, só não tinha concorrência.
   * `professorDestacou`, abaixo, usa `candidatos` sem este corte de propósito —
   * uma frase de ênfase sem termo próprio ainda pode ser útil ali (herda o
   * termo de uma frase vizinha, quando essa associação existir).
   */
  const candidatosComConteudo = candidatos.filter(
    (c) =>
      c.termo !== null &&
      (c.origem !== "fala" || densidadeDeConteudo(c.texto, peso) >= DENSIDADE_MINIMA_FALA),
  );

  const deduplicados = deduplicarPorConceito(candidatosComConteudo).sort(
    (a, b) => b.pontos - a.pontos,
  );
  const principais = diversificarPorTermo(deduplicados, MAX_PONTOS);
  const principaisOrdenados = [...principais].sort((a, b) => {
    if (a.atMs === null && b.atMs === null) return 0;
    if (a.atMs === null) return 1;
    if (b.atMs === null) return -1;
    return a.atMs - b.atMs;
  });
  // O CONCEITO de cada ponto, não a frase inteira — ver `fraseDeConceito`.
  const pontosPrincipais = principaisOrdenados.map((c) =>
    pontuar(fraseDeConceito(c.texto, peso, totalCandidatos) ?? c.texto),
  );

  // "Professor destacou": frases marcadas por expressão de ênfase, também
  // deduplicadas por conceito — quatro avisos sobre a MESMA prova não viram
  // quatro linhas.
  const destaquesCandidatos = candidatos.filter(
    (c) => c.marcado && c.atMs !== null && !ehApenasMarcaDeSintese(c.texto),
  );
  const destaquesDedup = deduplicarPorConceito(destaquesCandidatos)
    .sort((a, b) => a.atMs! - b.atMs!)
    .slice(0, MAX_DESTAQUES);
  /*
   * O CONCEITO de cada destaque, resolvido UMA VEZ — "Professor destacou" e
   * "Para revisar" precisam do MESMO conceito para a MESMA frase, não dois
   * cálculos que podem discordar. A frase de aviso só vale como conteúdo se,
   * TIRANDO as palavras da própria expressão de ênfase, ainda sobrar algo —
   * "prova" não conta, "matrizes" conta. Sem conteúdo próprio (nem depois de
   * tentar uma janela ao redor de alguma palavra real — ver
   * `fraseDeConceito`), procura na frase de fala mais próxima o que foi de
   * fato destacado; sem vizinho nenhum, o destaque não tem o que mostrar.
   */
  const conceitosDosDestaques = destaquesDedup.map((d) => {
    const proprio = fraseDeConceito(d.texto, peso, totalCandidatos, PALAVRAS_DE_MARCA);
    if (proprio) return { d, conceito: proprio };
    const vizinho = vizinhoDeConteudo(d, candidatosVizinhos, JANELA_DEPOIS_MS, peso);
    const doVizinho = vizinho ? fraseDeConceito(vizinho.texto, peso, totalCandidatos) : null;
    return { d, conceito: doVizinho ?? vizinho?.texto ?? null };
  });
  const professorDestacou = conceitosDosDestaques
    .filter((c): c is { d: Candidato; conceito: string } => c.conceito !== null)
    .map(({ d, conceito }) => ({
      atMs: d.atMs!,
      text: pontuar(conceito),
      marca: MARCAS_DE_ENFASE.find((m) => semAcento(d.texto).includes(semAcento(m))) ?? "",
    }));

  // "Para revisar": os termos do que o professor marcou, mas que ainda não
  // apareceram como ponto principal — pista extra, não repetição.
  const termosNosPontos = new Set(
    principaisOrdenados.map((c) => c.termo).filter((t): t is string => !!t),
  );
  const paraRevisar: string[] = [];
  const vistoRevisar = new Set<string>();
  for (const { d, conceito } of conceitosDosDestaques) {
    if (!conceito) continue;
    if (!d.termo || termosNosPontos.has(d.termo) || vistoRevisar.has(d.termo)) continue;
    vistoRevisar.add(d.termo);
    paraRevisar.push(maiuscula(conceito));
    if (paraRevisar.length >= MAX_REVISAR) break;
  }

  const overview = montarVisaoGeral(
    principais,
    destaquesDedup,
    temFala,
    temQuadro,
    tetoResumo,
    peso,
    totalCandidatos,
  );

  return {
    overview,
    pontosPrincipais,
    professorDestacou,
    paraRevisar,
    temConteudo: pontosPrincipais.length > 0 || overview.length > 0,
  };
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

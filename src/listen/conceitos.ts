import { PALAVRAS_DE_MARCA, semAcento, VAZIAS } from "./speechInsights";
import { MENSAGEM_TRECHO_DEGENERADO } from "./transcriptSanitizer";

/**
 * Transcript imperfeito → CONCEITOS da aula.
 *
 * **O defeito que este arquivo existe para corrigir.** A camada anterior
 * montava o resumo escolhendo FRASES por frequência de palavra e recortando
 * uma janela de palavras ao redor do termo mais forte. Com um transcript
 * perfeito isso passa; com o transcript real de um celular, não. Este foi o
 * resumo que um teste físico produziu:
 *
 *   "A aula abordou lógicas de programação, com destaque para lógica de
 *    programação e programação. Também foram mencionados necessários para
 *    resolver um problema e resolver um problema..."
 *
 * Os "pontos principais" eram "Necessários para resolver um problema.",
 * "Resolver um problema.", "Lógica de programação e programação." — pedaços
 * gramaticais da transcrição, não ideias. A causa não é o Whisper: o
 * transcript daquele teste continha "lógica de programação", "programação
 * orientada a objetos" e "organizar os passos necessários para resolver um
 * problema" com todas as letras. O que faltava era uma etapa que enxergasse
 * EXPRESSÕES INTEIRAS em vez de palavras soltas.
 *
 * **O cano, em cinco passos.** Cada um existe por um defeito medido:
 *
 * 1. `normalizarFrase` — o mesmo trecho repetido ("resolver um problema para
 *    resolver um problema") vira uma cópia só. Sem isso, "resolver um
 *    problema" tinha peso dobrado e ganhava de conceitos de verdade.
 * 2. `extrairSintagmas` — a frase vira EXPRESSÕES ("lógica de programação"),
 *    não palavras. É o passo que impede "programação" e "lógica" de virarem
 *    dois assuntos quando a aula falou de um.
 * 3. `absorverVariantes` — uma palavra dita UMA vez, a um erro de distância
 *    de outra dita VÁRIAS, é a mesma palavra mal ouvida: "matrices" e
 *    "atriz" viram "matrizes". Evidência do próprio transcript, nunca
 *    dicionário externo.
 * 4. `agruparConceitos` — "programação orientada do objeto", "programação
 *    orientada objetos" e "programação orientado à objeto" são UM conceito,
 *    com um nome canônico escolhido por votação entre as formas observadas.
 * 5. Pontuação — frequência, menção numa frase de síntese ("resumindo, os
 *    principais assuntos são...") e ênfase ("cai na prova").
 *
 * **A regra que vale para o arquivo inteiro: nada é inventado.** Todo nome
 * canônico é montado com palavras que foram ditas, escolhidas por votação
 * entre variantes realmente observadas. Não há dicionário de conceitos, não
 * há correção ortográfica por conhecimento externo, e nenhum conceito existe
 * sem pelo menos uma ocorrência literal no transcript ou no quadro.
 */

/**
 * Palavras que LIGAM duas partes de um conceito sem serem conceito.
 *
 * Preposições e artigos. Elas não contam como "conteúdo" do sintagma, mas
 * também não o interrompem — é o que deixa "organizar os passos necessários
 * para resolver um problema" sobreviver inteiro em vez de virar "organizar
 * os passos" e "resolver um problema", dois fragmentos da mesma ideia
 * (exatamente o defeito visto no teste físico).
 */
const LIGACOES = new Set(
  (
    "de da do das dos a à ao aos as os o um uma uns umas em no na nos nas " +
    "para por com entre sobre e"
  ).split(/\s+/),
);

/**
 * "e" liga, mas também SEPARA — e a diferença decide dois casos reais.
 *
 * "linhas e colunas" é um conceito só; "lógica de programação E programação
 * orientada a objetos" são dois. Não dá para escolher pela palavra: os dois
 * usam o mesmo "e". O que separa é o TAMANHO — quando um sintagma passa do
 * teto de conteúdo, ele é quebrado nos "e", e não no meio de uma expressão.
 * Abaixo do teto, o "e" é só mais uma ligação e "linhas e colunas" continua
 * inteiro.
 */
const MAX_CONTEUDO_SINTAGMA = 4;

/**
 * Verbos de ligação e formas de "ser/estar" — estes QUEBRAM o sintagma.
 *
 * "Matrizes são estruturas organizadas em linhas e colunas" é sujeito +
 * predicado: duas coisas, não uma expressão de cinco palavras. Cortar aqui é
 * o que produz "matrizes" e "estruturas organizadas em linhas e colunas" em
 * vez de um amontoado. Também é o que impede "programação orientada objetos
 * é importante" de virar um "conceito" — o corte acontece no "é", e
 * "importante" (palavra de marca) nunca entra.
 */
const COPULAS = new Set(
  ["e", "sao", "foi", "eram", "era", "ser", "esta", "estao", "fica", "ficam"].map(
    (p) => p,
  ),
);

/** `é` precisa ser comparado COM acento: sem ele vira a conjunção "e", que
    tem papel oposto (liga em vez de cortar). */
function ehCopula(palavraOriginal: string, normal: string): boolean {
  if (palavraOriginal === "é" || palavraOriginal === "É") return true;
  // "e" sem acento é conjunção, nunca cópula — e já está em LIGACOES.
  if (normal === "e") return false;
  return COPULAS.has(normal);
}

/**
 * Palavras que são conteúdo pela gramática mas não nomeiam assunto nenhum.
 *
 * Verbos de aula ("vamos ver", "falamos sobre") e adjetivos de preenchimento
 * ("necessários", "principais"). Elas não interrompem um sintagma — no meio
 * dele são texto legítimo ("os passos NECESSÁRIOS para resolver") — mas não
 * contam como conteúdo e nunca podem ser a primeira nem a última palavra de
 * um conceito. É o que evita bullets como "Necessários para resolver um
 * problema." (achado no teste físico) sem precisar apagar a palavra do meio
 * da frase.
 */
const FRACAS = new Set(
  (
    "hoje falar falamos falaremos vamos vou ver vendo veremos visto ficar " +
    "fica ficam fazer faz fazem ajuda ajudam ajudar serve servem servir usa " +
    "usam usar usando chama chamam chamado chamada dar dando tem ter temos " +
    "assunto assuntos conteudo materia aula aulas parte partes ponto pontos " +
    "necessario necessaria necessarios necessarias principal principais " +
    "ultimo ultima primeiro primeira proximo proxima outro outra outros " +
    "outras mesmo mesma varios varias diferente diferentes tudo algo alguma " +
    "algum alguns algumas coisa coisas jeito modo maneira geral gente " +
    "pessoal bom boa agora entao depois antes aqui ali"
  ).split(/\s+/),
);

/** Uma palavra pode ancorar um conceito? (não é vazia, marca, fraca ou número) */
function ehConteudo(normal: string): boolean {
  return (
    normal.length >= 3 &&
    !VAZIAS.has(normal) &&
    !LIGACOES.has(normal) &&
    !FRACAS.has(normal) &&
    !PALAVRAS_DE_MARCA.has(normal) &&
    !/^\d+$/.test(normal)
  );
}

/** Uma palavra pode aparecer DENTRO de um conceito sem ancorá-lo? */
function ehPassavel(normal: string): boolean {
  return LIGACOES.has(normal) || FRACAS.has(normal) || VAZIAS.has(normal);
}

function distancia(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  let anterior = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const atual = [i];
    for (let j = 1; j <= n; j++) {
      atual[j] = Math.min(
        anterior[j] + 1,
        atual[j - 1] + 1,
        anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    anterior = atual;
  }
  return anterior[n];
}

/**
 * Duas grafias são a MESMA palavra?
 *
 * Flexão (singular/plural, masculino/feminino) e erro de reconhecimento a uma
 * letra de distância. Os limiares crescem com o tamanho porque uma letra num
 * radical de quatro letras muda a palavra ("passo"/"posso"), e num de nove
 * quase nunca ("orientada"/"orientado").
 */
export function mesmaPalavra(a: string, b: string): boolean {
  if (a === b) return true;
  const menor = Math.min(a.length, b.length);
  // Flexão: uma é prefixo da outra ("objeto"/"objetos", "logica"/"logicas").
  if (menor >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  /*
   * Comparar pelos RADICAIS, não pelas formas cheias — sem isso "atriz" e
   * "matrizes" ficam a três edições de distância (um "m" na frente, um "es"
   * atrás) e nunca se encontram. Com o plural fora, "atriz" e "matriz" ficam
   * a uma, que é o que elas de fato são: a mesma palavra, uma delas mal
   * ouvida. O mesmo vale para "matrices"/"matriz".
   */
  const ra = radical(a);
  const rb = radical(b);
  if (ra === rb) return true;
  const menorRadical = Math.min(ra.length, rb.length);
  if (menorRadical >= 5 && distancia(ra, rb) <= 1) return true;
  if (menorRadical >= 8 && distancia(ra, rb) <= 2) return true;
  return false;
}

/** Tira só o plural — a flexão mais comum e a mais segura de desfazer. */
function radical(p: string): string {
  if (p.length > 5 && p.endsWith("es")) return p.slice(0, -2);
  if (p.length > 4 && p.endsWith("s")) return p.slice(0, -1);
  return p;
}

export interface Conceito {
  /** O nome como a tela mostra — montado por votação entre as formas ditas. */
  canonico: string;
  /** Radicais normalizados, a identidade do conceito para deduplicar. */
  chave: string;
  /** Quantas vezes alguma variante dele foi dita ou lida. */
  ocorrencias: number;
  /** Primeira menção, no relógio da sessão. `null` quando veio do quadro. */
  atMs: number | null;
  /** Foi citado numa frase com marca de ênfase ("cai na prova"). */
  enfatizado: boolean;
  /** Quando foi enfatizado — para "Professor destacou" poder ter horário. */
  atMsEnfase: number | null;
  /** Foi citado numa frase de síntese ("resumindo, os principais são..."). */
  naSintese: boolean;
  /** Quantas palavras de conteúdo — um conceito de 3 diz mais que um de 1. */
  tamanho: number;
  /** Índices das frases em que apareceu — usado para achar co-ocorrência. */
  frases: number[];
  pontos: number;
}

/** Uma frase já preparada para análise. */
export interface FraseAnalise {
  texto: string;
  atMs: number | null;
  origem: "fala" | "quadro";
  enfatizada: boolean;
  sintese: boolean;
}

/**
 * Colapsa repetições quase-adjacentes dentro de uma frase.
 *
 * "resolver um problema para resolver um problema" → "resolver um problema".
 * Diferente do `transcriptSanitizer`, que corta LOOPS degenerados (a mesma
 * coisa dezenas de vezes, texto que deixou de ser fala): aqui o alvo é a
 * duplicata única, normal num reconhecimento com sobreposição de janelas —
 * texto perfeitamente legível, que só não pode contar DUAS vezes na hora de
 * decidir o que a aula foi sobre.
 *
 * Só para análise. A aba Texto continua mostrando o que o modelo devolveu.
 */
export function normalizarFrase(texto: string): string {
  const palavras = texto.trim().split(/\s+/).filter(Boolean);
  if (palavras.length < 4) return texto.trim();
  const normal = palavras.map((p) => semAcento(p.replace(/[^\p{L}\p{N}]/gu, "")));

  // N-gramas grandes primeiro: colapsar "resolver um problema" inteiro é
  // melhor que colapsar só "um problema" e deixar um "resolver" solto.
  for (let n = Math.min(8, Math.floor(palavras.length / 2)); n >= 2; n--) {
    for (let i = 0; i + n * 2 <= palavras.length; i++) {
      const alvo = normal.slice(i, i + n).join(" ");
      if (!alvo.trim()) continue;
      // Até duas palavras de ligação entre as duas cópias ("... problema PARA
      // resolver um problema") — mais que isso já é outra oração, não eco.
      for (let lacuna = 0; lacuna <= 2; lacuna++) {
        const j = i + n + lacuna;
        if (j + n > palavras.length) break;
        const meio = normal.slice(i + n, j);
        if (meio.some((p) => p && !ehPassavel(p))) break;
        if (normal.slice(j, j + n).join(" ") !== alvo) continue;
        // Mantém a PRIMEIRA cópia e o que vem depois da segunda.
        const restante = [...palavras.slice(0, i + n), ...palavras.slice(j + n)];
        return normalizarFrase(restante.join(" "));
      }
    }
  }
  return palavras.join(" ");
}

interface Sintagma {
  /** O texto literal, como foi dito. */
  texto: string;
  /** Só as palavras de conteúdo, normalizadas. */
  conteudo: string[];
  frase: number;
}

/**
 * Uma frase → as EXPRESSÕES que ela contém.
 *
 * O coração da correção. Uma sequência de palavras de conteúdo ligadas por
 * preposições e artigos é UM conceito: "lógica de programação", "organizar os
 * passos necessários para resolver um problema", "estruturas organizadas em
 * linhas e colunas". Cópulas (`é`, `são`) cortam — separam sujeito de
 * predicado. Palavras fracas e de marca não ancoram nada, então um sintagma
 * nunca começa nem termina nelas: é o que impede "Necessários para resolver
 * um problema." e "Programação orientada objetos é importante." de existirem.
 */
export function extrairSintagmas(texto: string, indiceFrase: number): Sintagma[] {
  const achados: Sintagma[] = [];
  // Vírgula, ponto e travessão fecham um sintagma tanto quanto uma cópula.
  for (const parte of texto.split(/[,;:.!?…—–(){}[\]"]+/)) {
    const palavras = parte.trim().split(/\s+/).filter(Boolean);
    if (palavras.length === 0) continue;
    const normal = palavras.map((p) => semAcento(p.replace(/[^\p{L}\p{N}]/gu, "")));

    let inicio = 0;
    const fechar = (fim: number) => {
      // Apara as pontas: um conceito não começa nem acaba em ligação, palavra
      // fraca ou marca de ênfase.
      let a = inicio;
      let b = fim;
      while (a < b && !ehConteudo(normal[a])) a++;
      while (b > a && !ehConteudo(normal[b - 1])) b--;
      if (b - a === 0) return;
      const conteudo = normal.slice(a, b).filter(ehConteudo);
      if (conteudo.length === 0) return;
      achados.push({ texto: palavras.slice(a, b).join(" "), conteudo, frase: indiceFrase });
    };

    for (let i = 0; i < palavras.length; i++) {
      if (ehCopula(palavras[i], normal[i])) {
        fechar(i);
        inicio = i + 1;
      }
    }
    fechar(palavras.length);
  }

  // Um sintagma grande demais é, quase sempre, DOIS conceitos coordenados por
  // "e" ("lógica de programação e programação orientada a objetos"). Quebrar
  // no "e" só quando passa do teto preserva "linhas e colunas", que cabe.
  const finais: Sintagma[] = [];
  for (const s of achados) {
    if (s.conteudo.length <= MAX_CONTEUDO_SINTAGMA) {
      finais.push(s);
      continue;
    }
    const pedacos = s.texto.split(/\s+(?:e|E)\s+/);
    if (pedacos.length < 2) {
      finais.push(s);
      continue;
    }
    for (const pedaco of pedacos) {
      finais.push(...extrairSintagmas(pedaco, indiceFrase));
    }
  }
  return finais;
}

/**
 * Uma palavra dita uma vez, a um erro de distância de outra dita várias, é a
 * mesma palavra mal ouvida.
 *
 * "matrices" e "atriz" numa aula que diz "matrizes" três vezes; "lógicas"
 * numa aula que diz "lógica". A evidência é do PRÓPRIO transcript — a forma
 * dominante existe e foi contada —, nunca um dicionário externo. Por isso a
 * exigência é assimétrica: só uma forma RARA (uma ocorrência) é absorvida, e
 * só por uma forma claramente mais comum. Sem isso "matriz identidade" nunca
 * se juntaria a "matrizes", e a aula teria dois assuntos onde tem um.
 */
function absorverVariantes(sintagmas: Sintagma[]): Map<string, string> {
  const contagem = new Map<string, number>();
  for (const s of sintagmas) {
    for (const p of s.conteudo) contagem.set(p, (contagem.get(p) ?? 0) + 1);
  }
  const porFrequencia = [...contagem.entries()].sort((a, b) => b[1] - a[1]);
  const destino = new Map<string, string>();
  for (const [raro, nRaro] of porFrequencia) {
    if (nRaro > 1) continue;
    for (const [comum, nComum] of porFrequencia) {
      if (comum === raro || nComum < 2) continue;
      if (mesmaPalavra(raro, comum)) {
        destino.set(raro, comum);
        break;
      }
    }
  }
  return destino;
}

/**
 * A melhor GRAFIA de cada palavra normalizada — a mais repetida no transcript.
 *
 * `absorverVariantes` trabalha em formas sem acento e em minúsculas, que não
 * servem para mostrar na tela. Este mapa é o caminho de volta: dado
 * "matrizes" (normalizado), devolve "matrizes" exatamente como o professor
 * disse, com acento e tudo. Sem ele, absorver "atriz" em "matrizes"
 * consertaria o AGRUPAMENTO e deixaria o nome exibido em "atriz identidade" —
 * o conceito certo com a palavra errada na etiqueta.
 */
function melhoresGrafias(sintagmas: Sintagma[]): Map<string, string> {
  const votos = new Map<string, Map<string, number>>();
  for (const s of sintagmas) {
    const palavras = s.texto.split(/\s+/);
    for (const bruta of palavras) {
      const limpa = bruta.replace(/[^\p{L}\p{N}-]/gu, "");
      if (!limpa) continue;
      const chave = semAcento(limpa);
      if (!ehConteudo(chave)) continue;
      const porGrafia = votos.get(chave) ?? new Map<string, number>();
      // A grafia EXATA, sem baixar a caixa: `useState` e `PIB` são o nome da
      // coisa, e "usestate" não é o mesmo nome. Quem decide a caixa da
      // primeira letra é `nomeCanonico`, e só dela.
      porGrafia.set(limpa, (porGrafia.get(limpa) ?? 0) + 1);
      votos.set(chave, porGrafia);
    }
  }
  const melhor = new Map<string, string>();
  for (const [chave, porGrafia] of votos) {
    // Estável: empate fica com a primeira grafia vista, que é a mais antiga
    // na aula — a mesma regra de desempate de `nomeCanonico`.
    melhor.set(chave, [...porGrafia.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  }
  return melhor;
}

/** A identidade de um conceito: radicais, em ordem, já absorvidos. */
function chaveDe(conteudo: string[], absorcao: Map<string, string>): string {
  return conteudo.map((p) => absorcao.get(p) ?? p).join("+");
}

/**
 * Escolhe o nome do conceito por VOTAÇÃO entre as formas realmente ditas.
 *
 * Todas as variantes de um grupo têm as mesmas posições de conteúdo (é o que
 * as agrupou). Para cada posição, vence a forma mais repetida; empate, a mais
 * longa — "objetos" carrega mais informação que "objeto". As ligações vêm da
 * variante que tiver a mais completa, porque é ela que lê como português
 * ("orientada A objetos", não "orientada objetos").
 *
 * Nenhuma palavra nova entra: toda forma candidata foi dita em alguma das
 * ocorrências. A votação escolhe entre evidências, não inventa uma terceira.
 */
function nomeCanonico(
  variantes: Sintagma[],
  absorcao: Map<string, string>,
  grafias: Map<string, string>,
): string {
  /**
   * A forma eleita, já corrigida pela evidência do resto do transcript — e no
   * MESMO número em que foi dita.
   *
   * "atriz" (singular) é absorvida por "matrizes" (a grafia dominante, no
   * plural), e trocar uma pela outra ao pé da letra produziria "matrizes
   * identidade". Só o plural é desfeito, e só quando a palavra substituída
   * estava no singular: o radical é observado, a flexão é do original.
   * Nenhuma palavra nova entra — a operação é ortográfica, não semântica.
   */
  const consertar = (palavra: string): string => {
    const limpa = palavra.replace(/[^\p{L}\p{N}-]/gu, "");
    const norma = semAcento(limpa);
    const alvo = absorcao.get(norma);
    if (!alvo) return grafias.get(norma) ?? palavra;
    const grafia = grafias.get(alvo) ?? palavra;
    const eraPlural = /s$/i.test(limpa);
    if (eraPlural || !/s$/i.test(grafia)) return grafia;
    return grafia.length > 5 && /es$/i.test(grafia)
      ? grafia.slice(0, -2)
      : grafia.slice(0, -1);
  };

  const slots = variantes[0].conteudo.length;
  const escolhidas: string[] = [];
  for (let i = 0; i < slots; i++) {
    const votos = new Map<string, number>();
    for (const v of variantes) {
      // A forma ORIGINAL daquela posição, não a normalizada.
      const palavras = v.texto.split(/\s+/);
      const normal = palavras.map((p) => semAcento(p.replace(/[^\p{L}\p{N}]/gu, "")));
      let vistos = -1;
      for (let k = 0; k < palavras.length; k++) {
        if (!ehConteudo(normal[k])) continue;
        vistos++;
        if (vistos === i) {
          votos.set(palavras[k], (votos.get(palavras[k]) ?? 0) + 1);
          break;
        }
      }
    }
    /*
     * Empate resolvido pela PRIMEIRA forma dita, não pela mais longa.
     * `Array.sort` é estável e o Map preserva a ordem de inserção, que aqui é
     * a ordem da aula — então o desempate sai de graça. Importa: "lógica de
     * programação" (na abertura da aula) e "lógicas de programação" (na
     * recapitulação) empatam em uma ocorrência cada, e o desempate por
     * comprimento escolhia o plural da recapitulação. A introdução do
     * professor é a versão mais cuidadosa; é ela que nomeia o conceito.
     */
    const melhor = [...votos.entries()].sort((a, b) => b[1] - a[1])[0];
    if (melhor) escolhidas.push(consertar(melhor[0]));
  }
  if (escolhidas.length === 0) return variantes[0].texto;

  // A variante mais completa (mais palavras no total para o mesmo número de
  // conteúdos) empresta as ligações — é a que tem preposição onde as outras
  // comeram. As palavras de conteúdo vêm da votação, não dela.
  const modelo = [...variantes].sort(
    (a, b) => b.texto.split(/\s+/).length - a.texto.split(/\s+/).length,
  )[0];
  const palavrasModelo = modelo.texto.split(/\s+/);
  const normalModelo = palavrasModelo.map((p) =>
    semAcento(p.replace(/[^\p{L}\p{N}]/gu, "")),
  );
  const saida: string[] = [];
  let slot = 0;
  for (let k = 0; k < palavrasModelo.length; k++) {
    if (ehConteudo(normalModelo[k])) {
      saida.push(escolhidas[slot] ?? palavrasModelo[k]);
      slot++;
    } else {
      saida.push(palavrasModelo[k]);
    }
  }
  return minusculaInicial(saida.join(" "));
}

/**
 * Baixa a caixa da PRIMEIRA letra, e só dela — nunca da palavra inteira.
 *
 * O conceito é encaixado dentro de uma frase ("a aula abordou X"), então ele
 * começa em minúscula. Mas baixar a caixa da expressão inteira, que era o que
 * este arquivo fazia, destrói exatamente os nomes que mais importam numa aula
 * técnica: `useState` virava "usestate" e `PIB` virava "pib". Uma palavra com
 * maiúscula NO MEIO, ou toda em maiúsculas, é um nome próprio da matéria e
 * fica como foi dita.
 */
function minusculaInicial(texto: string): string {
  const palavras = texto.split(" ");
  if (palavras.length === 0) return texto;
  const primeira = palavras[0];
  const temCaixaPropria =
    /[A-ZÀ-Þ]/.test(primeira.slice(1)) || primeira === primeira.toUpperCase();
  palavras[0] = temCaixaPropria
    ? primeira
    : primeira.charAt(0).toLowerCase() + primeira.slice(1);
  return palavras
    .map((p, i) => {
      if (i === 0) return p;
      const propria = /[A-ZÀ-Þ]/.test(p.slice(1)) || p === p.toUpperCase();
      return propria ? p : p.toLowerCase();
    })
    .join(" ");
}

const PESO_SINTESE = 4;
const PESO_ENFASE = 2;

/**
 * As frases da aula → os conceitos dela, ordenados por importância.
 */
export function extrairConceitos(frases: FraseAnalise[]): Conceito[] {
  const sintagmas: Sintagma[] = [];
  frases.forEach((f, i) => {
    if (!f.texto.trim() || f.texto.trim() === MENSAGEM_TRECHO_DEGENERADO) return;
    sintagmas.push(...extrairSintagmas(normalizarFrase(f.texto), i));
  });
  if (sintagmas.length === 0) return [];

  const absorcao = absorverVariantes(sintagmas);
  const grafias = melhoresGrafias(sintagmas);

  const grupos = new Map<string, Sintagma[]>();
  for (const s of sintagmas) {
    const chave = chaveDe(s.conteudo, absorcao);
    const atual = grupos.get(chave);
    if (atual) atual.push(s);
    else grupos.set(chave, [s]);
  }

  const conceitos: Conceito[] = [];
  for (const [chave, variantes] of grupos) {
    const indices = [...new Set(variantes.map((v) => v.frase))];
    const comEnfase = indices.filter((i) => frases[i].enfatizada);
    const naSintese = indices.some((i) => frases[i].sintese);
    const tempos = indices
      .map((i) => frases[i].atMs)
      .filter((t): t is number => t !== null);
    conceitos.push({
      canonico: nomeCanonico(variantes, absorcao, grafias),
      chave,
      ocorrencias: variantes.length,
      atMs: tempos.length > 0 ? Math.min(...tempos) : null,
      enfatizado: comEnfase.length > 0,
      atMsEnfase:
        comEnfase.length > 0 ? (frases[comEnfase[0]].atMs ?? null) : null,
      naSintese,
      tamanho: variantes[0].conteudo.length,
      frases: indices,
      pontos: 0,
    });
  }

  /*
   * Um conceito CONTIDO em outro não é um segundo assunto.
   *
   * "resolver um problema" dentro de "organizar os passos necessários para
   * resolver um problema" é a mesma ideia dita menor — no teste físico as
   * duas viraram dois bullets ("Resolver um problema." e "Necessários para
   * resolver um problema."), que é a cara de um resumo picotado. O maior
   * absorve o menor e herda suas ocorrências; o menor some.
   */
  const porTamanho = [...conceitos].sort((a, b) => b.tamanho - a.tamanho);
  const absorvidos = new Set<string>();
  for (const grande of porTamanho) {
    if (absorvidos.has(grande.chave)) continue;
    const partesGrande = grande.chave.split("+");
    for (const pequeno of porTamanho) {
      if (pequeno === grande || absorvidos.has(pequeno.chave)) continue;
      if (pequeno.tamanho >= grande.tamanho) continue;
      /*
       * O assunto da aula não pode ser engolido por um detalhe dela.
       *
       * "Matrizes", dito duas vezes, é subsequência de "multiplicação de
       * matrizes", dito uma — e sem esta guarda o tema da aula sumia dentro
       * de um de seus tópicos, deixando a abertura do resumo sem a palavra
       * mais repetida da aula. Só absorve quem aparece no MÁXIMO tanto quanto
       * o container: aí é mesmo a versão curta da mesma ideia, não o
       * guarda-chuva dela.
       */
      if (pequeno.ocorrencias > grande.ocorrencias) continue;
      const partesPequeno = pequeno.chave.split("+");
      // Subsequência contígua: "resolver+problema" dentro de
      // "organizar+passos+resolver+problema".
      const dentro = partesGrande
        .join(" ")
        .includes(partesPequeno.join(" "));
      if (!dentro) continue;
      grande.ocorrencias += pequeno.ocorrencias;
      grande.enfatizado = grande.enfatizado || pequeno.enfatizado;
      grande.atMsEnfase = grande.atMsEnfase ?? pequeno.atMsEnfase;
      grande.naSintese = grande.naSintese || pequeno.naSintese;
      grande.frases = [...new Set([...grande.frases, ...pequeno.frases])];
      absorvidos.add(pequeno.chave);
    }
  }

  const vivos = conceitos.filter((c) => !absorvidos.has(c.chave));
  for (const c of vivos) {
    /*
     * Uma frase de síntese ("resumindo, os principais assuntos são X e Y") é
     * o professor dizendo com todas as letras o que importa — a evidência
     * mais forte que a fala oferece, e por isso o maior peso. Ela REFORÇA os
     * conceitos citados; nunca vira um destaque por si mesma (ver
     * `gerarResumoGlobal`).
     */
    c.pontos =
      c.ocorrencias +
      (c.naSintese ? PESO_SINTESE : 0) +
      (c.enfatizado ? PESO_ENFASE : 0) +
      // Uma expressão de três palavras diz mais que uma de uma — mas só um
      // empurrão, para não deixar uma frase longa e rara vencer o assunto.
      (c.tamanho - 1) * 0.5;
  }

  return vivos.sort((a, b) => b.pontos - a.pontos);
}

/**
 * Primeira letra maiúscula — como a tela mostra um conceito.
 *
 * Menos uma exceção que importa numa aula de programação: uma palavra que já
 * tem caixa própria (`useState`, `PIB`) fica como está. "UseState devolve
 * sempre um par" é o nome do hook escrito errado, e num resumo de aula de
 * React isso é justamente o detalhe que o estudante veio conferir.
 */
export function comoTitulo(texto: string): string {
  const t = texto.trim();
  if (!t) return t;
  const primeira = t.split(" ")[0];
  const temCaixaPropria =
    /[A-ZÀ-Þ]/.test(primeira.slice(1)) || primeira === primeira.toUpperCase();
  return temCaixaPropria ? t : t.charAt(0).toUpperCase() + t.slice(1);
}

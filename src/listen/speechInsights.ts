import type { TranscriptSegment } from "../shared/lib/mediaStore";
import { formatClock } from "../shared/lib/time";

/**
 * O que dá para entender da fala sem chamar modelo nenhum.
 *
 * Tudo aqui é determinístico e roda no aparelho: marcação de ênfase por
 * expressão, contagem de termos, e ranking de frases. Nada disso é IA
 * generativa, e o produto não vai chamar de IA — o que ele faz é reconhecer
 * padrões que um professor usa quando quer que alguém anote.
 *
 * A regra que governa o arquivo inteiro: **nada é inventado**. Um destaque só
 * existe se a frase foi realmente reconhecida; um tópico só existe se a
 * palavra foi realmente dita; um título só troca o genérico se houver texto
 * que o sustente.
 */

/**
 * As expressões com que se avisa que algo importa.
 *
 * Não são palavras-chave de assunto — são marcadores de ênfase, e por isso
 * funcionam em qualquer matéria. Um professor de Direito e um de Cálculo
 * dizem "isso cai na prova" do mesmo jeito.
 *
 * A lista é conservadora de propósito: cada entrada aqui vira uma estrela na
 * tela do estudante, e uma estrela em cima de uma frase comum destrói a
 * confiança nas outras.
 */
const MARCAS_DE_ENFASE = [
  "isso é importante",
  "isso e importante",
  "é importante",
  "e importante saber",
  "muito importante",
  "prestem atenção",
  "prestem atencao",
  "preste atenção",
  "preste atencao",
  "atenção nessa parte",
  "atencao nessa parte",
  "cai na prova",
  "cai muito na prova",
  "costuma cair",
  "pode cair na prova",
  "vai cair na prova",
  "lembrem disso",
  "lembre disso",
  "não esqueçam",
  "nao esquecam",
  "não esqueça",
  "nao esqueca",
  "anotem",
  "anotem isso",
  "anota isso",
  "vamos revisar",
  "o principal é",
  "o principal e",
  "o mais importante",
  "resumindo",
  "em resumo",
  "guardem isso",
  "isso é fundamental",
  "isso e fundamental",
];

/** Um trecho que o professor marcou como importante, pela própria fala. */
export interface SpeechHighlight {
  atMs: number;
  text: string;
  /** A expressão que disparou a marcação — a evidência, guardada. */
  marca: string;
}

const semAcento = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Os trechos em que alguém disse, com todas as letras, que aquilo importa.
 *
 * Só trechos finais: um parcial ainda pode virar outra frase, e marcar uma
 * estrela em algo que o reconhecimento vai reescrever é pior que não marcar.
 */
export function acharDestaques(
  segments: TranscriptSegment[],
  limite = 8,
): SpeechHighlight[] {
  const achados: SpeechHighlight[] = [];
  for (const s of segments) {
    if (!s.final) continue;
    const normal = semAcento(s.text);
    const marca = MARCAS_DE_ENFASE.find((m) => normal.includes(semAcento(m)));
    if (!marca) continue;
    // Uma frase que só tem a marca e mais nada — "isso é importante." — não
    // diz o que é importante, e vira ruído na lista. Precisa de conteúdo em
    // volta para valer como destaque.
    if (s.text.trim().split(/\s+/).length < 5) continue;
    achados.push({ atMs: s.startMs, text: s.text.trim(), marca });
    if (achados.length >= limite) break;
  }
  return achados;
}

/**
 * Palavras vazias do português, mais as que uma aula usa o tempo todo.
 *
 * Sem esta lista, os "tópicos" de qualquer aula seriam "que", "de" e "a".
 */
const VAZIAS = new Set(
  (
    "a o e de da do das dos em no na nos nas um uma uns umas para por com sem " +
    "que se ao aos à às ou mas como quando onde qual quais quem cujo este esta " +
    "isso isto esse essa aquele aquela ele ela eles elas eu tu nos vos voce voces " +
    "meu minha seu sua nosso nossa é sao foi era ser estar tem tenho temos vai vamos " +
    "vou pode podem deve devem aqui ali la agora entao depois antes mais menos muito " +
    "pouco bem tambem ja ainda so apenas todo toda todos todas cada outro outra " +
    "sobre entre ate desde assim porque pois logo entao gente pessoal turma aula " +
    "hoje ontem amanha professor aluno alunos coisa coisas jeito forma parte partes " +
    "ver vendo vamos falar falando fala olha olhem certo ta ok beleza tipo ne"
  ).split(/\s+/),
);

/** Quantas vezes cada termo aparece na fala, sem as palavras vazias. */
export function contarTermos(
  segments: TranscriptSegment[],
): [string, number][] {
  const contagem = new Map<string, { forma: string; n: number }>();
  for (const s of segments) {
    if (!s.final) continue;
    for (const bruto of s.text.split(/[^\p{L}\p{N}]+/u)) {
      const palavra = bruto.trim();
      // Três letras porque "useState" e "PIB" precisam entrar, e "de" não.
      if (palavra.length < 3) continue;
      const chave = semAcento(palavra);
      if (VAZIAS.has(chave)) continue;
      if (/^\d+$/.test(chave)) continue;
      const atual = contagem.get(chave);
      if (atual) atual.n += 1;
      else contagem.set(chave, { forma: palavra, n: 1 });
    }
  }
  return [...contagem.values()]
    .filter((x) => x.n >= 2)
    .sort((a, b) => b.n - a.n)
    .map((x) => [x.forma, x.n] as [string, number]);
}

/**
 * A fala que aconteceu perto de um momento visual.
 *
 * A janela é assimétrica de propósito: quem explica um slide costuma começar
 * a falar dele **antes** de ele estar pronto na tela, e continuar depois. Doze
 * segundos para trás e vinte para a frente foi o que melhor casou explicação
 * com captura nas sessões de bancada — e é um número para ajustar com aula de
 * verdade, não uma constante sagrada.
 */
export const JANELA_ANTES_MS = 12000;
export const JANELA_DEPOIS_MS = 20000;

export function falaPertoDe(
  segments: TranscriptSegment[],
  atMs: number,
  { antes = JANELA_ANTES_MS, depois = JANELA_DEPOIS_MS } = {},
): TranscriptSegment[] {
  return segments.filter(
    (s) => s.final && s.endMs >= atMs - antes && s.startMs <= atMs + depois,
  );
}

/**
 * Uma frase que valha como legenda de um momento.
 *
 * Prefere a frase mais informativa da janela: a mais longa que ainda caiba
 * numa linha, descartando as que são só marcação ("agora vamos ver", "então
 * tá"). Devolve null quando nada na janela sustenta uma legenda — e null aqui
 * é a resposta certa muitas vezes.
 */
export function legendaDaFala(
  segments: TranscriptSegment[],
  atMs: number,
): string | null {
  const perto = falaPertoDe(segments, atMs);
  const candidatas = perto
    .map((s) => s.text.trim())
    .filter((t) => {
      const palavras = t.split(/\s+/);
      if (palavras.length < 5) return false;
      // Pelo menos metade das palavras com conteúdo: uma frase inteira de
      // muleta não diz nada sobre a aula.
      const comConteudo = palavras.filter(
        (p) =>
          p.length >= 3 &&
          !VAZIAS.has(semAcento(p.replace(/[^\p{L}\p{N}]/gu, ""))),
      );
      return (
        comConteudo.length >= Math.max(2, Math.floor(palavras.length * 0.35))
      );
    })
    .sort((a, b) => b.length - a.length);

  const escolhida = candidatas[0];
  if (!escolhida) return null;
  return escolhida.length > 120 ? `${escolhida.slice(0, 117)}…` : escolhida;
}

/**
 * Um título para o momento, tirado da fala — quando a fala sustenta um.
 *
 * "Agora vamos ver useState" vira **useState**. A regra é achar o termo mais
 * significativo da janela: o que mais se repete na aula inteira e também
 * aparece perto deste momento. Sem isso, dois momentos seguidos ganhariam o
 * mesmo título por acaso.
 *
 * Devolve null com facilidade, e isso é o recurso funcionando: um título
 * inventado é pior que "Início da aula".
 */
export function tituloDaFala(
  segments: TranscriptSegment[],
  atMs: number,
  termosDaAula: [string, number][],
): string | null {
  const perto = falaPertoDe(segments, atMs);
  if (perto.length === 0) return null;
  const textoPerto = semAcento(perto.map((s) => s.text).join(" "));

  // Os termos fortes da aula que também foram ditos aqui perto.
  const candidatos = termosDaAula
    .filter(([termo, n]) => n >= 2 && textoPerto.includes(semAcento(termo)))
    .slice(0, 3);
  if (candidatos.length === 0) return null;

  const principal = candidatos[0][0];
  // Um termo de uma palavra sozinho é um título magro; dois termos fortes na
  // mesma janela viram um título que diz mais.
  if (candidatos.length >= 2) {
    const segundo = candidatos[1][0];
    if (semAcento(segundo) !== semAcento(principal)) {
      return `${maiuscula(principal)} e ${segundo}`;
    }
  }
  return maiuscula(principal);
}

function maiuscula(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * As frases que melhor representam a aula falada.
 *
 * Extrativo, e só: as frases devolvidas **foram ditas**, palavra por palavra.
 * O ranking soma três coisas — quanto a frase usa os termos recorrentes da
 * aula, se ela está perto de um momento que a câmera guardou, e se alguém a
 * marcou como importante. Nenhuma delas inventa texto; todas escolhem entre o
 * que existe.
 */
export function frasesRepresentativas(
  segments: TranscriptSegment[],
  momentosMs: number[],
  limite = 4,
): string[] {
  const termos = contarTermos(segments);
  if (termos.length === 0) return [];
  const peso = new Map(termos.map(([t, n]) => [semAcento(t), n]));
  const destaques = new Set(acharDestaques(segments, 20).map((d) => d.text));

  const pontuadas = segments
    .filter((s) => s.final && s.text.trim().split(/\s+/).length >= 6)
    .map((s) => {
      const palavras = semAcento(s.text).split(/[^\p{L}\p{N}]+/u);
      let pontos = 0;
      const vistas = new Set<string>();
      for (const p of palavras) {
        if (p.length < 3 || vistas.has(p)) continue;
        vistas.add(p);
        pontos += peso.get(p) ?? 0;
      }
      // Normaliza pelo tamanho: sem isto a frase mais longa vence sempre, e
      // "frase mais longa" não é o mesmo que "frase que diz mais".
      pontos = pontos / Math.sqrt(Math.max(6, palavras.length));
      // Perto de um momento guardado: a câmera achou que aquilo importava.
      if (momentosMs.some((m) => Math.abs(m - s.startMs) <= JANELA_DEPOIS_MS)) {
        pontos *= 1.35;
      }
      // Marcada pelo próprio professor.
      if (destaques.has(s.text.trim())) pontos *= 1.6;
      return { texto: s.text.trim(), pontos, startMs: s.startMs };
    })
    .sort((a, b) => b.pontos - a.pontos);

  // Sem repetir o que já foi dito: o reconhecimento devolve a mesma frase
  // duas vezes com frequência, e duas linhas iguais num resumo são um defeito
  // visível.
  const escolhidas: { texto: string; startMs: number }[] = [];
  for (const c of pontuadas) {
    const chave = semAcento(c.texto).replace(/[^a-z0-9]/g, "");
    if (
      escolhidas.some((e) => {
        const outra = semAcento(e.texto).replace(/[^a-z0-9]/g, "");
        return outra.includes(chave) || chave.includes(outra);
      })
    )
      continue;
    escolhidas.push({ texto: c.texto, startMs: c.startMs });
    if (escolhidas.length >= limite) break;
  }

  // Na ordem em que foram ditas: um resumo que pula no tempo confunde.
  return escolhidas.sort((a, b) => a.startMs - b.startMs).map((e) => e.texto);
}

/** Os tópicos da aula segundo a fala — termos, não frases. */
export function topicosDaFala(
  segments: TranscriptSegment[],
  limite = 6,
): string[] {
  return contarTermos(segments)
    .filter(([, n]) => n >= 3)
    .slice(0, limite)
    .map(([t]) => maiuscula(t));
}

/** Um parágrafo da aula falada: trechos vizinhos costurados, com uma hora só. */
export interface BlocoDeFala {
  atMs: number;
  text: string;
  /** Os destaques que caíram dentro deste bloco. */
  marcado: boolean;
}

/**
 * A fala em parágrafos, e não em trechos soltos.
 *
 * O reconhecimento devolve pedaços do tamanho que o navegador decide — às
 * vezes três palavras, às vezes duas frases —, e uma tela com sessenta linhas
 * de três palavras e sessenta horários é ilegível. Aqui eles são costurados
 * até fechar meio minuto ou até a frase acabar, que é o tamanho em que a
 * pessoa consegue reler a aula.
 *
 * Nada é reescrito: o texto de saída é a concatenação do texto de entrada.
 */
export function blocosDeFala(
  segments: TranscriptSegment[],
  maxMs = 30000,
): BlocoDeFala[] {
  const finais = segments.filter((s) => s.final && s.text.trim());
  if (finais.length === 0) return [];
  const marcas = new Set(acharDestaques(finais, 40).map((d) => d.atMs));

  const blocos: BlocoDeFala[] = [];
  let atual: { atMs: number; partes: string[]; marcado: boolean } | null = null;

  const fechar = () => {
    if (!atual) return;
    blocos.push({
      atMs: atual.atMs,
      text: atual.partes.join(" "),
      marcado: atual.marcado,
    });
    atual = null;
  };

  for (const s of finais) {
    // Fecha **antes** de acrescentar, e não depois: fechando depois, o trecho
    // que estourou o limite ainda entrava, e um bloco de meio minuto virava um
    // de setenta segundos — que é de novo a parede de texto que este
    // agrupamento existe para evitar.
    if (atual && s.endMs - atual.atMs > maxMs) fechar();
    if (!atual) atual = { atMs: s.startMs, partes: [], marcado: false };
    atual.partes.push(s.text.trim());
    if (marcas.has(s.startMs)) atual.marcado = true;

    // Ponto final passado o terço do limite: respeitar a frase produz um
    // parágrafo melhor que respeitar o cronômetro.
    if (/[.!?…]$/.test(s.text.trim()) && s.endMs - atual.atMs >= maxMs / 3) {
      fechar();
    }
  }
  fechar();
  return blocos;
}

/** A transcrição inteira como texto, com horários — para copiar e colar. */
export function transcricaoComoTexto(segments: TranscriptSegment[]): string {
  return blocosDeFala(segments)
    .map((b) => `[${formatClock(b.atMs)}] ${b.text}`)
    .join("\n\n");
}

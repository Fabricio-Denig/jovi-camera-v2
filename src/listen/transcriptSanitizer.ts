import { semAcento, VAZIAS } from "./speechInsights";

/**
 * A camada entre o Whisper e qualquer coisa que a pessoa vê.
 *
 * **Por que existe.** Um teste físico real (aula sobre matrizes) mostrou o
 * motor local entrando num loop de repetição — "Eu vou fazer um pouco de um
 * pouco de um pouco de um pouco..." por dezenas de palavras — e esse texto
 * bruto chegando direto à aba Texto, ao resumo, ao título e a "Professor
 * destacou". Isso não é um bug de UI: é o modelo (`whisper-tiny`, rodando
 * sem `repetition_penalty`/`no_repeat_ngram_size` — ver `whisperEngine.ts`)
 * decodificando mal um trecho pouco claro. Reduzir a CHANCE disso acontecer
 * é uma correção; garantir que NUNCA chega à tela, mesmo quando acontece, é
 * outra — esta é a segunda, e é a que não pode falhar.
 *
 * **O que não faz.** Não tenta consertar a transcrição (não troca "igrejas"
 * por "linhas"); só detecta quando o texto parou de ser fala e virou ruído
 * mecânico, e decide o que mostrar no lugar.
 */

export type QualidadeTrecho = "boa" | "aproveitavel" | "baixa_confianca" | "degenerado";

export interface TrechoSanitizado {
  /** O texto que pode ser mostrado/usado — vazio só quando nada sobrou. */
  text: string;
  qualidade: QualidadeTrecho;
  /** Um loop de repetição foi cortado deste trecho. */
  loopDetectado: boolean;
  /** O texto exatamente como o modelo devolveu — só para `?debug=listen`. */
  bruto: string;
}

/** Uma frase mais curta que isto, depois de cortar um loop, não sobra
    conteúdo nenhum — melhor descartar que mostrar um fragmento de duas
    palavras soltas. */
const MIN_PALAVRAS_APROVEITAVEL = 3;

/** N-gramas de 2 a 6 palavras — cobre desde "um pouco" até frases curtas
    inteiras se repetindo. */
const NGRAM_MIN = 2;
const NGRAM_MAX = 6;

/**
 * Quantas vezes SEGUIDAS o mesmo n-grama precisa repetir para contar como
 * degeneração, e não repetição humana normal.
 *
 * O professor repetir "isso é importante" DUAS vezes é normal — é ênfase.
 * Três ou mais vezes SEGUIDAS, sem nada entre elas, não é como ninguém fala:
 * é o padrão de um modelo pequeno travado tentando "continuar" um trecho
 * pouco claro. O limiar é intencionalmente o mesmo da instrução desta
 * rodada ("substring repetida >= 3 vezes consecutivas").
 */
const REPETICOES_DEGENERADAS = 3;

/**
 * Acha onde uma repetição degenerada COMEÇA A SE REPETIR — não onde a frase
 * repetida começa (essa primeira ocorrência é conteúdo legítimo), mas onde a
 * SEGUNDA cópia consecutiva começa. Genérico de propósito: tenta todo
 * tamanho de n-grama e toda posição, sem supor onde o loop vai estar.
 *
 * Devolve o índice (em palavras) de onde cortar, ou `null` quando não há
 * repetição degenerada.
 */
function acharInicioDoLoop(palavrasNormalizadas: string[]): number | null {
  for (let n = NGRAM_MIN; n <= NGRAM_MAX; n++) {
    for (let i = 0; i + n * REPETICOES_DEGENERADAS <= palavrasNormalizadas.length; i++) {
      const gram = palavrasNormalizadas.slice(i, i + n).join(" ");
      let repeticoes = 1;
      let j = i + n;
      while (j + n <= palavrasNormalizadas.length) {
        const proximo = palavrasNormalizadas.slice(j, j + n).join(" ");
        if (proximo !== gram) break;
        repeticoes++;
        j += n;
      }
      if (repeticoes >= REPETICOES_DEGENERADAS) {
        // Mantém a PRIMEIRA ocorrência (conteúdo real) — corta a partir da
        // segunda cópia, que é onde a degeneração de fato começa.
        return i + n;
      }
    }
  }
  return null;
}

function diversidadeLexical(palavrasNormalizadas: string[]): number {
  if (palavrasNormalizadas.length === 0) return 0;
  return new Set(palavrasNormalizadas).size / palavrasNormalizadas.length;
}

function temPalavraInformativa(palavrasNormalizadas: string[]): boolean {
  return palavrasNormalizadas.some(
    (p) => p.length >= 3 && !VAZIAS.has(p) && !/^\d+$/.test(p),
  );
}

/** O que a aba Texto mostra quando um trecho inteiro não sobrou nada
    aproveitável — curto, honesto, e nunca lixo repetido. Exportado para
    `lessonSummary.ts` poder reconhecer e nunca tratar como conteúdo. */
export const MENSAGEM_TRECHO_DEGENERADO = "Trecho pouco claro no áudio.";

/**
 * RAW MODEL OUTPUT → texto utilizável, com uma classificação de confiança.
 *
 * Nunca lança — um trecho ruim vira `qualidade: "degenerado"` e
 * `text: ""`, nunca um erro que derrubaria a transcrição inteira por causa
 * de UM trecho.
 */
export function sanitizarTrecho(bruto: string): TrechoSanitizado {
  const texto = bruto.trim().replace(/\s+/g, " ");
  if (!texto) {
    return { text: "", qualidade: "degenerado", loopDetectado: false, bruto };
  }

  const palavras = texto.split(" ");
  const palavrasNormalizadas = palavras.map(semAcento);
  const inicioLoop = acharInicioDoLoop(palavrasNormalizadas);
  const loopDetectado = inicioLoop !== null;
  const cortado = loopDetectado ? palavras.slice(0, inicioLoop).join(" ").trim() : texto;

  const palavrasCortadas = cortado.split(/\s+/).filter(Boolean);
  if (cortado.length === 0 || palavrasCortadas.length < MIN_PALAVRAS_APROVEITAVEL) {
    return { text: "", qualidade: "degenerado", loopDetectado, bruto };
  }

  const normalizadasCortadas = palavrasCortadas.map(semAcento);
  const informativa = temPalavraInformativa(normalizadasCortadas);
  const diversidade = diversidadeLexical(normalizadasCortadas);

  let qualidade: QualidadeTrecho;
  if (!informativa) {
    // Só palavra vazia sobrando ("de um para o") — nada para mostrar.
    qualidade = "degenerado";
  } else if (loopDetectado) {
    // Sobrou conteúdo real antes do loop começar, mas o corte em si já é
    // sinal de um trecho difícil — nunca "boa" qualidade.
    qualidade = "aproveitavel";
  } else if (diversidade < 0.4) {
    qualidade = "baixa_confianca";
  } else if (diversidade < 0.6) {
    qualidade = "aproveitavel";
  } else {
    qualidade = "boa";
  }

  if (qualidade === "degenerado") {
    return { text: "", qualidade, loopDetectado, bruto };
  }
  return { text: cortado, qualidade, loopDetectado, bruto };
}

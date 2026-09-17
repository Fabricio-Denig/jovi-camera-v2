import {
  getLessonAudio,
  saveLessonAudio,
  segmentosDe,
  type TranscriptSegment,
} from "../shared/lib/mediaStore";
import { descartarMotor, transcreverTrecho } from "./whisperEngine";
import {
  fecharTentativa,
  iniciarTentativa,
  limparAudioReproduzivel,
  medirFase,
  registrarErro,
} from "./listenDiag";

/**
 * O reprocessamento da aula depois de salva: lê o áudio inteiro com o motor
 * local e substitui `transcript` pelo resultado.
 *
 * **Quando roda.** Duas entradas, de propósito. `CameraShell` chama isto
 * assim que a aula é salva — "salva os dados importantes, depois processa",
 * como pedido — sem esperar o resultado: salvar a aula nunca fica mais lento
 * por causa da transcrição. `ClassPage` chama de novo ao abrir uma aula cujo
 * job ficou "processando" travado (aba fechada no meio, por exemplo) ou cujo
 * job falhou e a pessoa pediu para tentar de novo. As duas chamam a mesma
 * função, e ela decide sozinha se há trabalho a fazer.
 *
 * **Por que não trava a câmera.** A sessão do SliD já terminou antes deste
 * ponto — `slid.status === "finished"` é o que libera o microfone e abre o
 * resumo — então não há visor concorrendo pelo mesmo processador. O trabalho
 * roda depois, nunca durante.
 *
 * **Por que substitui em vez de somar.** O reconhecimento ao vivo (se deu
 * algum resultado) e o motor local descrevem a MESMA fala, só que o segundo
 * ouviu o áudio inteiro e o primeiro só o que o navegador conseguiu pegar ao
 * vivo. Somar os dois duplicaria trechos; o motor local, quando termina bem,
 * é estritamente mais completo — e é ele quem fica.
 */
const emAndamento = new Set<string>();

/**
 * Espera a interface respirar antes de começar o trabalho pesado.
 *
 * **Por que existe.** `CameraShell` chama `transcreverAula` no MESMO gesto
 * que navega para a Galeria: a aula é salva, o job começa, e a Galeria monta
 * — que é quando ela lê todas as capturas e cria uma miniatura por arquivo.
 * No teste físico, essa sobreposição foi o momento em que o site travou e
 * chegou a fechar sozinho no celular. As duas cargas são pesadas por motivos
 * diferentes, e nada obrigava as duas a acontecerem no mesmo instante.
 *
 * Um `requestIdleCallback` não torna nada mais leve — ele só deixa a tela
 * que a pessoa está OLHANDO terminar de aparecer primeiro. O `timeout`
 * garante que o trabalho começa de qualquer jeito num aparelho que nunca
 * fica realmente ocioso, e o `setTimeout` cobre o Safari, que não tem
 * `requestIdleCallback`.
 *
 * Isto NÃO é a explicação do travamento nem a correção dele — a inferência
 * continua rodando na thread principal (ver o comentário sobre `wasm.proxy`
 * em `whisperEngine.ts`). É só deixar de empilhar as duas coisas no mesmo
 * quadro enquanto a causa de fundo é medida.
 */
function esperarOcioso(limiteMs = 2000): Promise<void> {
  return new Promise((resolve) => {
    const ric = (window as Window & {
      requestIdleCallback?: (cb: () => void, opcoes?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (typeof ric === "function") ric(() => resolve(), { timeout: limiteMs });
    else window.setTimeout(resolve, 300);
  });
}

/**
 * O sinal de vida de um trabalho em curso — e por que ele não mora no banco.
 *
 * O trabalho precisa dizer "ainda estou aqui" de tempos em tempos, e quem
 * lê isso pode ser outro carregamento da página (a aba morreu no meio, a
 * pessoa voltou). `localStorage` é exatamente do tamanho do problema:
 * sobrevive a recarregar, é lido de forma síncrona e barata, e o dado não
 * vale nada depois que o trabalho acaba — o oposto do registro do áudio,
 * que carrega a gravação inteira e não deve ser reescrito a cada batida.
 */
const CHAVE_BATIMENTO = "slid:transcript-job:";
/** De quanto em quanto tempo o trabalho bate. */
const INTERVALO_BATIMENTO_MS = 15_000;

interface Batimento {
  startedAt: number;
  heartbeatAt: number;
}

function lerBatimento(sessionId: string): Batimento | null {
  try {
    const bruto = localStorage.getItem(CHAVE_BATIMENTO + sessionId);
    return bruto ? (JSON.parse(bruto) as Batimento) : null;
  } catch {
    return null;
  }
}

function escreverBatimento(sessionId: string, b: Batimento) {
  try {
    localStorage.setItem(CHAVE_BATIMENTO + sessionId, JSON.stringify(b));
  } catch {
    // Cota cheia ou modo privado: sem batimento, a regra antiga (tempo desde
    // o começo) continua valendo. Nunca é motivo para o trabalho não rodar.
  }
}

function apagarBatimento(sessionId: string) {
  try {
    localStorage.removeItem(CHAVE_BATIMENTO + sessionId);
  } catch {
    // Idem.
  }
}

export async function transcreverAula(sessionId: string): Promise<void> {
  // Duas entradas podendo chegar quase juntas (o salvamento e uma reabertura
  // rápida da galeria) não devem rodar o motor duas vezes ao mesmo tempo — o
  // resultado seria o mesmo, mas o trabalho seria dobrado à toa.
  if (emAndamento.has(sessionId)) return;

  const audio = await getLessonAudio(sessionId);
  if (!audio) return;
  // Já terminou bem: não retranscrever a mesma aula toda vez que ela é
  // reaberta. Só "pronto" impede — "falhou" e "processando travado" (o teto
  // de tempo abaixo) continuam permitindo tentar de novo.
  if (audio.transcriptJobStatus === "pronto") return;

  const segmentos = segmentosDe(audio);
  if (segmentos.length === 0) return; // Nada para transcrever.

  emAndamento.add(sessionId);
  // Uma nova tentativa de verdade começa aqui — `?debug=listen` mostra o
  // número dela, e é o que prova que "Tentar de novo" não está só reciclando
  // o estado (e o erro) da tentativa anterior.
  iniciarTentativa();
  const comecou = Date.now();
  await saveLessonAudio({
    ...audio,
    transcriptJobStatus: "processando",
    transcriptJobStartedAt: comecou,
  }).catch(() => {});

  /*
   * O trabalho bate a cada quinze segundos enquanto vive.
   *
   * O temporizador dispara entre as passagens do gerador (a biblioteca
   * devolve o controle entre um token e o outro), então um trabalho vivo
   * nunca fica calado por muito tempo — mesmo quando demora. E se ele
   * DEIXAR de bater por minutos a fio, isso também é um dado: significa que
   * a thread principal está presa de verdade, que é uma das hipóteses em
   * aberto para o travamento medido no aparelho.
   */
  escreverBatimento(sessionId, { startedAt: comecou, heartbeatAt: comecou });
  const batida = window.setInterval(() => {
    escreverBatimento(sessionId, { startedAt: comecou, heartbeatAt: Date.now() });
  }, INTERVALO_BATIMENTO_MS);

  // A tela para onde a pessoa acabou de navegar termina de aparecer antes de
  // o trabalho pesado começar. Ver `esperarOcioso`.
  await esperarOcioso();

  try {
    const blocos: TranscriptSegment[] = [];
    let indice = 0;
    for (const segmento of segmentos) {
      const trechos = await transcreverTrecho(segmento.blob, indice++);
      for (const t of trechos) {
        blocos.push({
          // O relógio do arquivo vira o relógio da sessão somando onde este
          // trecho começou a gravar — a mesma conta que o player já faz em
          // `LessonAudioPlayer.resolverPosicao`, na direção contrária.
          startMs: segmento.startMs + t.startMs,
          endMs: segmento.startMs + t.endMs,
          text: t.text,
          final: true,
        });
      }
    }

    // Relê antes de escrever: a pessoa pode ter renomeado a aula, mudado a
    // matéria, ou (mais raro) a própria aula pode ter sido excluída enquanto
    // o motor rodava. Escrever em cima do registro mais recente evita
    // apagar uma mudança feita nesses minutos.
    const atual = (await getLessonAudio(sessionId)) ?? audio;
    await medirFase("persistence", "final", () =>
      saveLessonAudio({
      ...atual,
      transcript: blocos,
      transcriptStatus: blocos.length > 0 ? "ok" : atual.transcriptStatus,
      transcriptJobStatus: "pronto",
      /*
       * O motor rodou inteiro sem lançar. Zero blocos aqui só pode ser uma
       * coisa: não havia fala reconhecível no áudio (silêncio, microfone
       * abafado, ruído). É um final DIFERENTE de uma falha técnica, e a
       * distinção é o que impede a tela de dizer "não havia conteúdo" quando
       * na verdade o modelo nem chegou a carregar — ver `transcriptOutcome`
       * em `mediaStore.ts`.
       */
      transcriptOutcome: blocos.length > 0 ? "texto" : "sem_fala",
      // Uma tentativa que terminou bem apaga a falha da anterior: manter o
      // erro antigo faria a tela avisar sobre um problema já resolvido.
      transcriptFailure: undefined,
      }),
      () => `${blocos.length} blocos`,
    );
  } catch (erro) {
    // O erro de verdade — não só "falhou" — fica registrado para
    // `?debug=listen` (ver `listenDiag.ts`). Antes este `catch` descartava
    // `erro` por completo; era impossível saber, depois de uma falha real em
    // aparelho, se a causa foi rede, decodificação, memória ou outra coisa.
    registrarErro("job", erro);
    const atual = (await getLessonAudio(sessionId)) ?? audio;
    await saveLessonAudio({
      ...atual,
      transcriptJobStatus: "falhou",
      transcriptOutcome: "falhou",
      /*
       * A mensagem real, guardada junto da aula — não só no `localStorage` do
       * diagnóstico, que some e é de uma tentativa só. Um erro técnico que
       * vira "não havia conteúdo" na tela é o defeito que esta rodada
       * encontrou: a transcrição falhava porque os pesos do modelo
       * respondiam 404, e a aba Texto falava sobre a câmera não ter lido o
       * quadro. `stage` diz em que etapa parou (engine, decode, inference,
       * job) — a primeira pergunta de qualquer investigação.
       */
      transcriptFailure: {
        stage: erro instanceof Error ? erro.name : "job",
        message: erro instanceof Error ? erro.message : String(erro),
        at: Date.now(),
      },
    }).catch(() => {});
    // Uma falha real (rede fora do ar, WASM sem memória) não deixa o motor
    // confiável para a próxima aula — mesma lógica do Scanner.
    descartarMotor();
  } finally {
    window.clearInterval(batida);
    apagarBatimento(sessionId);
    emAndamento.delete(sessionId);
    // O PCM guardado para ouvir em `?debug=listen` não tem por que
    // sobreviver ao trabalho que o produziu.
    limparAudioReproduzivel();
    // E o que foi medido vai para o disco agora, sem esperar a janela de
    // escrita: quem abre `?debug=listen` depois de um teste em aparelho
    // precisa encontrar a última etapa, não a penúltima.
    fecharTentativa();
  }
}

/**
 * Quanto tempo SEM BATER basta para dar um trabalho por morto.
 *
 * **O defeito que isto corrige, medido em aparelho real.** A regra anterior
 * era "processando há mais de dez minutos = abandonado", contada desde o
 * começo. Ela confunde duas coisas opostas: um trabalho que morreu junto
 * com a aba, e um trabalho que está demorando. No teste físico as duas
 * coincidiram — a transcrição levou cerca de dez minutos e a tela anunciou
 * "não foi possível organizar o que foi dito" enquanto o motor ainda
 * rodava, desmentida pouco depois pelo próprio trabalho terminando bem.
 *
 * A pergunta certa não é "faz quanto tempo que começou" — é "faz quanto
 * tempo que dá notícia". Três minutos é folgado para um trabalho que bate a
 * cada quinze segundos, e muito mais rápido que os dez minutos anteriores
 * para perceber uma aba que de fato morreu.
 */
export const SEM_SINAL_DE_VIDA_MS = 3 * 60_000;

/**
 * O teto antigo, mantido para trabalhos de antes do batimento existir.
 *
 * Um job iniciado pela versão anterior do app não bate nunca — julgá-lo
 * pela regra nova o daria por morto em três minutos, mesmo trabalhando.
 */
export const JOB_ABANDONADO_MS = 10 * 60_000;

/**
 * Este trabalho está rodando NESTA aba, agora?
 *
 * Onde existe conhecimento exato, ele vale mais que qualquer heurística de
 * tempo: se o laço ainda está no ar aqui dentro, não há nada a adivinhar.
 * O batimento existe para o outro caso — julgar um trabalho começado por um
 * carregamento anterior da página, que esta aba não tem como ver.
 */
export function jobRodandoAqui(sessionId: string): boolean {
  return emAndamento.has(sessionId);
}

export function jobParecaTravado(
  audio: {
    transcriptJobStatus?: "processando" | "pronto" | "falhou";
    transcriptJobStartedAt?: number;
  },
  sessionId?: string,
): boolean {
  if (audio.transcriptJobStatus !== "processando") return false;
  if (sessionId && jobRodandoAqui(sessionId)) return false;

  const batimento = sessionId ? lerBatimento(sessionId) : null;
  if (batimento?.heartbeatAt) {
    return Date.now() - batimento.heartbeatAt > SEM_SINAL_DE_VIDA_MS;
  }
  return (
    Boolean(audio.transcriptJobStartedAt) &&
    Date.now() - audio.transcriptJobStartedAt! > JOB_ABANDONADO_MS
  );
}

import {
  getLessonAudio,
  saveLessonAudio,
  segmentosDe,
  type TranscriptSegment,
} from "../shared/lib/mediaStore";
import { descartarMotor, transcreverTrecho } from "./whisperEngine";
import { iniciarTentativa, registrarErro } from "./listenDiag";

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
  await saveLessonAudio({
    ...audio,
    transcriptJobStatus: "processando",
    transcriptJobStartedAt: Date.now(),
  }).catch(() => {});

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
    await saveLessonAudio({
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
    });
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
    emAndamento.delete(sessionId);
  }
}

/** Um job "processando" há mais que isto quase certamente foi abandonado —
    a aba fechou, ou a pessoa saiu no meio. Depois deste teto, a tela oferece
    tentar de novo em vez de esperar para sempre por um trabalho que morreu
    junto com a página que o começou. */
export const JOB_ABANDONADO_MS = 10 * 60_000;

export function jobParecaTravado(audio: {
  transcriptJobStatus?: "processando" | "pronto" | "falhou";
  transcriptJobStartedAt?: number;
}): boolean {
  return (
    audio.transcriptJobStatus === "processando" &&
    Boolean(audio.transcriptJobStartedAt) &&
    Date.now() - audio.transcriptJobStartedAt! > JOB_ABANDONADO_MS
  );
}

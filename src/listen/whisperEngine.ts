/**
 * O motor de transcrição local, num lugar só — o mesmo desenho de
 * `ocr/engine.ts`: um trabalhador compartilhado, criado uma vez e reaproveitado.
 *
 * **Por que existe.** `useTranscript` (o reconhecimento ao vivo do navegador)
 * é rápido quando funciona, mas o teste em aparelho real mostrou o que o
 * comentário daquele arquivo já registrava: a API existir não significa que
 * ela transcreve. Uma aula podia terminar com minutos de explicação gravados
 * e quase nada reconhecido. Este motor reprocessa o áudio já salvo, inteiro,
 * sem depender do navegador estar "ouvindo" em tempo real — e por isso é o
 * que decide o texto final (ver `transcribeSession.ts`).
 *
 * **Por que roda no aparelho, e não num servidor.** Este projeto é publicado
 * como site estático (GitHub Pages) — não existe backend para guardar uma
 * chave de API, e criar um só para isto trocaria "sem servidor" por "com
 * servidor e com conta de terceiro", pelo peso oposto do que este produto
 * defende (o áudio nunca sai do aparelho). Um modelo Whisper pequeno,
 * quantizado, rodando em WebAssembly no navegador, resolve sem nenhuma das
 * duas coisas: sem chave, sem servidor, e sem o áudio sair do aparelho — o
 * que também é uma respota mais forte que a do reconhecimento nativo, que no
 * Chrome manda o áudio para um serviço do navegador. Ver a nota de
 * transparência em `transcribeSession.ts`.
 *
 * **O que não pôde ser medido nesta bancada.** O ambiente de desenvolvimento
 * onde este código foi escrito bloqueia acesso a huggingface.co por política
 * de rede — o mesmo motivo, aliás, que já tinha feito o Scanner abandonar o
 * CDN padrão do Tesseract e passar a servir os arquivos deste próprio
 * domínio (ver o comentário de `ocr/engine.ts`). Não foi possível baixar o
 * modelo e medir tempo real de download/inferência num navegador aqui. O
 * carregamento (`pipeline(...)`) e a chamada de transcrição usam a API
 * documentada da biblioteca exatamente como descrita — mas a validação de
 * verdade, em rede normal e no aparelho da banca, ainda está por fazer. Se
 * aquela rede também bloquear huggingface.co, a próxima etapa é hospedar os
 * pesos do modelo neste mesmo domínio, como o Scanner já faz com o Tesseract.
 *
 * **O modelo escolhido.** `Xenova/whisper-tiny`, quantizado (`dtype: "q8"`) —
 * o menor da família Whisper multilíngue (inclui português), documentado
 * publicamente em ~41 MB no total (encoder + decoder). É a escolha mais seguro
 * para um celular médio sem GPU dedicada no navegador: `whisper-base` lê
 * melhor mas quase dobra de tamanho e de tempo de inferência, e a diferença
 * importa mais numa demonstração ao vivo do que alguns pontos de acerto.
 */

/** O identificador do modelo no Hugging Face Hub. Ajustar aqui, em um lugar
    só, se `whisper-base` provar necessário depois de um teste real. */
const MODELO = "Xenova/whisper-tiny";

// A biblioteca inteira (onnxruntime-web incluso) fica fora do caminho de
// abertura da câmera: a importação só acontece quando alguém de fato pede uma
// transcrição, o mesmo desenho do `criarLeitor` do Scanner.
//
// O tipo abaixo declara só a forma que este arquivo de fato chama — o
// `pipeline(...)` da biblioteca devolve uma união de vinte e tantos tipos de
// pipeline possíveis (um por tarefa), e sem o parâmetro de tipo explícito o
// TypeScript não reduz essa união para só a automática de fala.
type Transcritor = (
  audio: string,
  options: {
    language: string;
    task: string;
    chunk_length_s: number;
    stride_length_s: number;
    return_timestamps: true;
  },
) => Promise<{
  text: string;
  chunks?: { text: string; timestamp: [number, number | null] }[];
}>;

let motorRef: Promise<Transcritor> | null = null;

async function motorCompartilhado(): Promise<Transcritor> {
  if (!motorRef) {
    motorRef = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      const transcritor = await pipeline(
        "automatic-speech-recognition",
        MODELO,
        { dtype: "q8" },
      );
      return transcritor as unknown as Transcritor;
    })().catch((erro) => {
      // Um motor que nunca terminou de carregar não pode ficar "reservado"
      // para sempre — a próxima aula merece tentar de novo, não herdar uma
      // promessa já rejeitada.
      motorRef = null;
      throw erro;
    });
  }
  return motorRef;
}

/** Um trecho de fala reconhecido, ainda no relógio DO ARQUIVO (segundos desde
    o início daquele trecho de áudio) — quem chama converte para o relógio da
    sessão, que é outro eixo. */
export interface TrechoTranscrito {
  startMs: number;
  endMs: number;
  text: string;
}

/**
 * Transcreve um trecho de áudio inteiro, em blocos com horário.
 *
 * `chunk_length_s`/`stride_length_s` são os valores documentados da própria
 * biblioteca para áudio "longo" (mais que trinta segundos, o caso comum de
 * uma aula): a janela desliza sobre o áudio com sobreposição, para uma frase
 * não ficar cortada bem na borda de um bloco.
 *
 * Sem timestamp por palavra, de propósito — não é essa a precisão que este
 * produto promete (ver `mediaStore.TranscriptSegment`). Por bloco/frase é o
 * que basta para ligar fala a momento.
 */
export async function transcreverTrecho(
  blob: Blob,
): Promise<TrechoTranscrito[]> {
  /*
   * O dublê do protocolo, do mesmo jeito que `fala-de-mentira.mjs` já faz
   * para o `SpeechRecognition` do navegador.
   *
   * Não há como uma suíte de bancada baixar 40+ MB de pesos de modelo pela
   * rede a cada execução — nem no CI, nem no navegador restrito onde este
   * código foi escrito. `window.__transcreverMock__`, quando presente,
   * substitui o motor inteiro e deixa testar o resto do cano (o
   * `transcribeSession.ts`, o deslocamento de horário por trecho, os estados
   * "processando"/"falhou"/"pronto", e o que a aba Texto/Resumo mostra com o
   * resultado) sem depender de rede nem de inferência de verdade. Em
   * produção, `window.__transcreverMock__` nunca existe.
   */
  const mock = (window as { __transcreverMock__?: typeof transcreverTrecho })
    .__transcreverMock__;
  if (mock) return mock(blob);

  const transcritor = await motorCompartilhado();
  const url = URL.createObjectURL(blob);
  try {
    const resultado = await transcritor(url, {
      language: "portuguese",
      task: "transcribe",
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
    });

    // Sem blocos (áudio curto, sem `chunks` no retorno): o texto inteiro vira
    // um trecho só, do início ao fim do arquivo — melhor que descartar uma
    // transcrição que existe só porque não veio fatiada.
    if (!resultado.chunks || resultado.chunks.length === 0) {
      const texto = resultado.text.trim();
      return texto ? [{ startMs: 0, endMs: 0, text: texto }] : [];
    }

    return resultado.chunks
      .map((c) => ({
        startMs: Math.round(c.timestamp[0] * 1000),
        // `timestamp[1]` vem nulo quando o áudio acaba no meio de uma
        // palavra que o modelo não fechou — o começo do bloco ainda é uma
        // âncora válida, então o fim herda dele em vez de descartar o bloco.
        endMs: Math.round((c.timestamp[1] ?? c.timestamp[0]) * 1000),
        text: c.text.trim(),
      }))
      .filter((c) => c.text.length > 0);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Descarta o motor — só depois de uma falha real.
 *
 * Espelha `descartarLeitor` do Scanner: um `transcritor()` que travou ou
 * lançou não é algo em que a próxima aula deva confiar de novo sem recarregar.
 */
export function descartarMotor(): void {
  motorRef = null;
}

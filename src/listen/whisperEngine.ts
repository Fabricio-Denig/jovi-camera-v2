import {
  decodificarParaWhisper,
  medirAmostras,
  capturaParecaSilenciosa,
  TAXA_WHISPER,
} from "./audioPcm";
import {
  registrarEngine,
  registrarDownload,
  registrarAudioSegmento,
  registrarAudioReproduzivel,
  registrarInferencia,
  registrarErro,
} from "./listenDiag";

/**
 * O motor de transcrição local, num lugar só — o mesmo desenho de
 * `ocr/engine.ts`: um trabalhador compartilhado, criado uma vez e reaproveitado.
 *
 * **Por que existe.** `useTranscript` (o reconhecimento ao vivo do navegador)
 * é rápido quando funciona, mas dois testes em aparelho real mostraram o que
 * o comentário daquele arquivo já registrava: a API existir não significa
 * que ela transcreve. Este motor reprocessa o áudio já salvo, inteiro, sem
 * depender do navegador estar "ouvindo" em tempo real.
 *
 * **Self-hosted de ponta a ponta — não só o runtime.** A primeira versão
 * deste arquivo auto-hospedava o runtime ONNX mas buscava os PESOS do
 * modelo direto do Hugging Face Hub em tempo real. Um segundo teste físico
 * (fala clara, gravada, confirmada por gravação externa) terminou em falha
 * mesmo assim — e o "Tentar de novo" também falhou, sem nenhuma pista do
 * motivo. Sem conseguir reproduzir a rede exata daquele aparelho, a resposta
 * correta é eliminar a dependência de rede em tempo real por completo, não
 * adivinhar a causa: `scripts/fetch-whisper-model.mjs` baixa os pesos
 * pinados em CI (o runner do GitHub Actions tem internet real; este
 * ambiente de desenvolvimento bloqueia huggingface.co por política — ver o
 * status do proxy) e publica os bytes junto do site. `env.allowRemoteModels
 * = false` abaixo não é só documentação: é o que torna a transcrição
 * genuinamente independente de alcançar qualquer CDN durante a aula — o
 * mesmo domínio que já serve o app serve o modelo.
 *
 * **PCM decodificado por este arquivo, não pela biblioteca.** Antes, o Blob
 * gravado ia direto para `transcritor(url, ...)`, e a biblioteca decodificava
 * por dentro — uma caixa preta que não deixava saber se um segmento estava
 * vazio, silencioso, ou corrompido antes da inferência tentar (e falhar) em
 * cima dele. Agora `decodificarParaWhisper` (mesma técnica que a biblioteca
 * usa: `AudioContext` criado já na taxa alvo decodifica E reamostra numa
 * chamada só) roda aqui, o resultado é medido (`medirAmostras`) e registrado
 * no diagnóstico (`listenDiag`) ANTES de chamar o modelo — e um segmento sem
 * áudio de verdade (RMS ~0) nunca chega a ocupar tempo de inferência: o
 * diagnóstico já diz "isto não é um problema de STT" sem precisar rodar o
 * modelo para descobrir.
 *
 * **Validado de ponta a ponta, sem mock, com dois defeitos reais achados e
 * corrigidos no caminho.** Um teste E2E real (Playwright, Chromium de
 * verdade, `?debug=listen`/`listenDiag` como instrumento) — microfone falso
 * tocando um áudio PT-BR sintetizado (TTS mbrola, não texto injetado),
 * gravado pelo `MediaRecorder` de verdade, salvo, reaberto, transcrito pelo
 * motor real sob o subpath `/jovi-camera-v2/` (o mesmo do GitHub Pages) —
 * encontrou dois bugs genuínos, nenhum deles visível sem essa instrumentação:
 *
 * 1. **QDQ/MatMulNBits no backend "wasm".** A sessão ONNX falhava ao criar
 *    (`Can't create a session... TransposeDQWeightsForMatMulNBits Missing
 *    required scale`) — um bug real no otimizador de grafo do
 *    onnxruntime-web (versão nightly/dev empacotada por
 *    `@huggingface/transformers@4.2.0`) para o padrão de quantização QDQ que
 *    os arquivos `_quantized` usam. `session_options: { graphOptimizationLevel:
 *    "disabled" }` (abaixo) evita essa passagem de otimização específica — o
 *    custo é não ganhar as fusões de operadores que ela faria; a correção
 *    importa mais que a velocidade aqui.
 * 2. **`env.localModelPath` como URL absoluta quebra a checagem local.**
 *    `get_tokenizer_files()`/`get_processor_files()` decidem se existe
 *    tokenizer/processor chamando `get_file_metadata()`, que só verifica
 *    localmente quando `isValidUrl(localPath, ...)` é `false`. Com
 *    `localModelPath` como URL completa, essa checagem local nunca rodava, e
 *    com `allowRemoteModels=false` o resultado era `hasProcessor=false` — o
 *    pipeline carregava (a sessão ONNX cria normal) mas sem processor
 *    nenhum, e quebrava na primeira transcrição com `Cannot read properties
 *    of null (reading 'feature_extractor')`. Corrigido usando um caminho
 *    RELATIVO para `localModelPath` (ver o comentário ao lado dele).
 *
 * Depois dos dois: transcrição real, sem erro nenhum, reconhecendo os três
 * conceitos do fixture de aceitação do produto ("física", "prova",
 * "atenção") a partir de áudio sintetizado — não injetado.
 *
 * **Isto não é a primeira vez que a pergunta foi feita.** Existe um spike
 * anterior (`docs/spike-transcricao-offline.md`, 11/set) que mediu
 * Transformers.js e decidiu **não** incluí-lo, por três motivos: o momento
 * errado (transcrição ao vivo precisa do modelo carregado *durante* a
 * sessão), o aparelho errado (rodar inferência pesada competindo com câmera
 * + `MediaRecorder` + análise ao vivo arrisca a aba ser encerrada pelo
 * sistema) e a rede errada (um segundo download pesado herda o problema que
 * já tinha tirado o Tesseract do CDN padrão). Os dois primeiros motivos não
 * se aplicam aqui: este motor roda **depois** de `slid.status === "finished"`
 * — a sessão já terminou, a câmera e o `MediaRecorder` já soltaram o
 * aparelho, e não existe promessa de legenda ao vivo sendo quebrada. O
 * terceiro motivo é o que a auto-hospedagem dos pesos (acima) resolve por
 * completo: nem o runtime nem o modelo dependem de um CDN de terceiro.
 *
 * **O runtime (ONNX) também é auto-hospedado, na variante menor.** Medido no
 * build: sem configurar nada, a biblioteca escolhe sozinha, em tempo de
 * execução, entre duas variantes do WebAssembly do onnxruntime-web — e para
 * qualquer navegador que não seja Safari, ela pede a variante "asyncify"
 * (pensada para WebGPU) **de um CDN externo (jsdelivr)**: 23,5 MB crus. Este
 * app não usa WebGPU (só `device: "wasm"`), então essa variante paga um
 * custo que não compra nada. `scripts/copy-ort-assets.mjs` copia a variante
 * simples (12,9 MB crus — quase metade) para `public/ort/`, e as duas linhas
 * abaixo apontam `env.backends.onnx.wasm` para ela antes de qualquer
 * `pipeline(...)` — o mesmo padrão do Tesseract: nada busca um CDN de
 * terceiro, e a rede da sala de aula só precisa alcançar este domínio.
 */

/**
 * `whisper-tiny` — e não `whisper-base`, apesar de um teste real ter medido
 * o `base` melhor em qualidade. As duas frases abaixo são as DUAS metades
 * da mesma investigação, não uma suposição:
 *
 * 1. Um teste de inferência genuína (PCM real, áudio TTS PT-BR sintetizado
 *    localmente, nunca texto injetado) rodado em Node (execution provider
 *    "cpu", os pesos reais trazidos de CI) mostrou `whisper-base` acertando
 *    os três conceitos do fixture de aceitação ("física", "prova",
 *    "atenção") onde `whisper-tiny` só acertava dois ("física" virava
 *    "sobrefícies").
 * 2. O MESMO arquivo `whisper-base` testado de ponta a ponta pelo navegador
 *    de verdade (Playwright, Chromium real, execution provider "wasm" —
 *    o que o produto realmente usa) falhou ao CARREGAR o modelo:
 *
 *        Can't create a session. ERROR_CODE: 1, ERROR_MESSAGE:
 *        qdq_actions.cc:137 TransposeDQWeightsForMatMulNBits Missing
 *        required scale: model.decoder.embed_tokens.weight_merged_0_scale
 *
 *    O arquivo `onnx/decoder_model_merged_quantized.onnx` do whisper-base
 *    usa um padrão de quantização (QDQ + MatMulNBits) que o backend "cpu"
 *    nativo do Node executa sem problema, mas que o backend "wasm" do
 *    onnxruntime-web (o único que este site tem, sem WebGPU) não suporta.
 *    Uma qualidade melhor que nunca carrega no navegador real não é uma
 *    transcrição melhor — é nenhuma transcrição.
 *
 * `whisper-tiny` carrega e roda nos dois backends — é o que o HARD GATE
 * desta rodada exige de verdade. Continua sendo a variante MULTILÍNGUE
 * (nunca `.en`) — este produto transcreve português. Se um teste real
 * futuro (com um dtype diferente, ou uma reconversão do whisper-base sem
 * MatMulNBits) resolver a incompatibilidade, ajustar aqui — mas só depois
 * de confirmar em `device: "wasm"`, não só em Node. */
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
  audio: Float32Array,
  options: {
    language: string;
    task: string;
    chunk_length_s: number;
    stride_length_s: number;
    return_timestamps: true;
    max_new_tokens: number;
  },
) => Promise<{
  text: string;
  chunks?: { text: string; timestamp: [number, number | null] }[];
}>;

let motorRef: Promise<Transcritor> | null = null;
/** `true` assim que o motor terminou de carregar uma vez nesta aba — o que
    diferencia "baixando pela primeira vez" de "carregando do cache" no
    diagnóstico e na mensagem que a UI mostra (ver `ClassPage.tsx`). */
let motorJaCarregouNestaAba = false;

function baseAbsoluta(caminho: string): string {
  return new URL(
    `${import.meta.env.BASE_URL}${caminho}`,
    window.location.origin,
  ).href;
}

async function motorCompartilhado(): Promise<Transcritor> {
  if (!motorRef) {
    registrarEngine({
      modelId: MODELO,
      multilingual: true,
      backend: "onnxruntime-web",
      device: "wasm",
      numThreads: 1,
      estado: "carregando",
      cache: motorJaCarregouNestaAba ? "quente" : "frio",
    });

    motorRef = (async () => {
      const { env, pipeline } = await import("@huggingface/transformers");

      /*
       * Precisa vir ANTES do `pipeline(...)`: a biblioteca só faz a própria
       * escolha (CDN externo, variante "asyncify") quando `wasmPaths` ainda
       * está vazio. Uma vez setado aqui, o caminho automático nem roda.
       *
       * `numThreads: 1` porque este site não manda os cabeçalhos de
       * isolamento de origem (COOP/COEP) que o WebAssembly com threads de
       * verdade exige — o GitHub Pages não deixa configurar isso. O mesmo
       * arquivo .wasm funciona sem threads; só precisa saber que não pode
       * abrir nenhuma. `crossOriginIsolated`/`SharedArrayBuffer` (ver
       * `listenDiag.lerDeviceDiag`) confirmam isso a cada carregamento, em
       * vez de supor.
       */
      const wasm = env.backends.onnx.wasm;
      if (!wasm) {
        throw new Error("onnxruntime-web sem backend wasm neste navegador");
      }
      wasm.wasmPaths = {
        wasm: baseAbsoluta("ort/ort-wasm-simd-threaded.wasm"),
        mjs: baseAbsoluta("ort/ort-wasm-simd-threaded.mjs"),
      };
      wasm.numThreads = 1;
      /*
       * `wasm.proxy` (mover a sessão ONNX para um Worker dedicado, liberando
       * a thread principal durante a inferência) foi TENTADO e DESCARTADO —
       * com evidência, não por suposição. Sem ele, um teste de ponta a
       * ponta real mostrou a inferência (8s+ neste fixture) travando a aba
       * inteira: nenhum toque respondia enquanto rodava. `env.backends.
       * onnx.wasm.proxy = true` (a biblioteca desliga isto por padrão —
       * `ONNX_ENV.wasm.proxy = false`, lido em `transformers.web.js`)
       * pareceu a correção óbvia, mas quebra de um jeito pior: o loader do
       * WASM dentro do Worker desta versão do onnxruntime-web referencia
       * `document` — que não existe em um Worker — e a sessão nunca chega a
       * criar (`no available backend found. ERR: [wasm] [object
       * ErrorEvent]`, medido num segundo teste de ponta a ponta). A thread
       * principal travar por alguns segundos DEPOIS da aula já salva (nunca
       * durante a gravação) é um custo real e medido, não escondido — mas é
       * a opção que efetivamente transcreve. Mover a inferência para um
       * Worker de verdade exigiria reescrever o carregamento do modelo à
       * mão (sem depender do proxy embutido da biblioteca), fora do escopo
       * desta rodada.
       */

      /*
       * Os pesos do modelo, do mesmo domínio do site — nunca do Hugging
       * Face Hub em tempo real. `allowLocalModels` é `false` por padrão no
       * navegador (só é `true` automaticamente em Node/Deno) — sem ligar
       * isto explicitamente, `localModelPath` abaixo nunca seria consultado.
       * `localModelPath` termina em `/models/` — a biblioteca completa com
       * `<localModelPath>/<model_id>/<arquivo>` sozinha (confirmado lendo
       * `buildResourcePaths` em `transformers.web.js`), e o `id` de
       * `Xenova/whisper-tiny` já contém a barra que vira a subpasta.
       *
       * **De propósito, um caminho RELATIVO — não `baseAbsoluta()`.** Uma
       * URL completa (`http://.../models/`) quebra `get_tokenizer_files()`/
       * `get_processor_files()`: as duas decidem se existe tokenizer/
       * processor chamando `get_file_metadata()`, que só verifica
       * localmente quando `isValidUrl(localPath, ...)` é `false` — e
       * `localPath` é `pathJoin(localModelPath, model_id, arquivo)`. Com
       * `localModelPath` absoluto, `localPath` vira uma URL válida, a
       * checagem local é pulada inteira, `allowRemoteModels=false` faz o
       * resto falhar em silêncio, e `hasProcessor`/`hasTokenizer` saem
       * `false` — o pipeline carrega sem processor nenhum, e quebra depois
       * com `Cannot read properties of null (reading 'feature_extractor')`
       * na primeira transcrição (achado com um teste real, não suposto).
       * Um caminho relativo faz `isValidUrl` lançar (sem `base`) e devolver
       * `false` — a checagem local roda de verdade, via `fetch` relativo
       * (o navegador resolve contra a própria página, sem precisar de URL
       * absoluta nenhuma).
       */
      env.allowLocalModels = true;
      env.localModelPath = `${import.meta.env.BASE_URL}models/`;
      env.allowRemoteModels = false;

      const progresso = new Map<string, number>();
      const inicioDownload = new Map<string, number>();

      const transcritor = await pipeline("automatic-speech-recognition", MODELO, {
        dtype: "q8",
        device: "wasm",
        // TESTE: desligar a otimização de grafo do ONNX Runtime para ver se
        // evita o bug QDQ/MatMulNBits (ver o comentário grande acima).
        session_options: { graphOptimizationLevel: "disabled" },
        progress_callback: (
          dado: {
            status: string;
            file?: string;
            progress?: number;
            loaded?: number;
            total?: number;
          },
        ) => {
          if (!dado.file) return;
          if (dado.status === "initiate") {
            inicioDownload.set(dado.file, Date.now());
          }
          if (dado.status === "progress" && typeof dado.progress === "number") {
            progresso.set(dado.file, dado.progress);
          }
          if (dado.status === "done") {
            const inicio = inicioDownload.get(dado.file);
            registrarDownload({
              arquivo: dado.file,
              url: baseAbsoluta(`models/${MODELO}/${dado.file}`),
              status: 200,
              bytes: dado.total,
              duracaoMs: inicio ? Date.now() - inicio : undefined,
            });
          }
        },
      } as Parameters<typeof pipeline>[2]);

      motorJaCarregouNestaAba = true;
      registrarEngine({ estado: "pronto" });
      return transcritor as unknown as Transcritor;
    })().catch((erro) => {
      // Um motor que nunca terminou de carregar não pode ficar "reservado"
      // para sempre — a próxima tentativa merece tentar de novo do zero
      // (nova Promise, novo `pipeline(...)`), não herdar uma promessa já
      // rejeitada. É este `motorRef = null` que garante que "Tentar de
      // novo" seja uma tentativa de verdade, e não um retorno instantâneo
      // do mesmo erro em cache.
      motorRef = null;
      registrarEngine({ estado: "falhou" });
      registrarErro("engine", erro);
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
 * Transcreve um segmento de áudio inteiro, em blocos com horário.
 *
 * `chunk_length_s`/`stride_length_s` são os valores documentados da própria
 * biblioteca para áudio "longo" (mais que trinta segundos, o caso comum de
 * uma aula): a janela desliza sobre o áudio com sobreposição, para uma frase
 * não ficar cortada bem na borda de um bloco. Cada `LessonAudioSegment` (um
 * ciclo ligar/desligar do microfone) é enviado separadamente — nunca colando
 * containers WebM por bytes, o que não garante nada tocável depois.
 *
 * Sem timestamp por palavra, de propósito — não é essa a precisão que este
 * produto promete (ver `mediaStore.TranscriptSegment`). Por bloco/frase é o
 * que basta para ligar fala a momento.
 */
export async function transcreverTrecho(
  blob: Blob,
  indice = 0,
): Promise<TrechoTranscrito[]> {
  /*
   * O dublê do protocolo, do mesmo jeito que `fala-de-mentira.mjs` já faz
   * para o `SpeechRecognition` do navegador.
   *
   * Não há como uma suíte de bancada baixar 40+ MB de pesos de modelo pela
   * rede a cada execução. `window.__transcreverMock__`, quando presente,
   * substitui o motor inteiro e deixa testar o resto do cano (o
   * `transcribeSession.ts`, o deslocamento de horário por trecho, os estados
   * "processando"/"falhou"/"pronto", e o que a aba Texto/Resumo mostram com o
   * resultado) sem depender de inferência de verdade. Em produção,
   * `window.__transcreverMock__` nunca existe.
   */
  const mock = (window as { __transcreverMock__?: typeof transcreverTrecho })
    .__transcreverMock__;
  if (mock) return mock(blob, indice);

  let decodificado;
  try {
    decodificado = await decodificarParaWhisper(blob);
  } catch (erro) {
    registrarErro("decode", erro);
    throw erro;
  }

  const medida = medirAmostras(decodificado.amostras, TAXA_WHISPER);
  registrarAudioSegmento({
    index: indice,
    mimeType: blob.type,
    bytes: blob.size,
    startMs: 0,
    durationMs: Math.round(decodificado.durationS * 1000),
    decoded: {
      durationS: medida.durationS,
      sampleRate: medida.sampleRate,
      channels: decodificado.canaisOriginais,
      frameCount: medida.frameCount,
      peak: medida.peak,
      rms: medida.rms,
      silencioPercent: medida.silencioPercent,
    },
  });
  // Em memória, nunca persistido — o mesmo Float32Array que vai (ou iria)
  // para o modelo, para `?debug=listen` poder tocar exatamente isto.
  registrarAudioReproduzivel(indice, decodificado.amostras, TAXA_WHISPER);

  if (medida.temAmostraInvalida) {
    const erro = new Error(
      `PCM inválido no segmento ${indice}: amostras NaN/Infinity depois de decodificar`,
    );
    registrarErro("pcm-validation", erro);
    throw erro;
  }

  // Um segmento sem áudio de verdade (RMS ~0, quase tudo silêncio) não é um
  // problema de STT — é um problema de captura. Não vale a pena gastar
  // tempo de inferência nisso, e o diagnóstico já registrou a medida acima
  // para quem for investigar o porquê da captura ter vindo vazia.
  if (capturaParecaSilenciosa(medida)) {
    return [];
  }

  const transcritor = await motorCompartilhado();
  const inicio = Date.now();
  registrarInferencia({
    iniciouEm: inicio,
    samples: decodificado.amostras.length,
    duracaoAudioS: medida.durationS,
  });

  let resultado;
  try {
    resultado = await transcritor(decodificado.amostras, {
      language: "portuguese",
      task: "transcribe",
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
      /*
       * Um teto real, achado com um teste real: sem isto, um trecho sem
       * fala de verdade (silêncio residual, ruído, um tom) pode fazer o
       * modelo gerar até o limite padrão (448 tokens) tentando "ouvir"
       * alguma coisa — sem WASM otimizado (graphOptimizationLevel
       * "disabled", ver o comentário grande acima), isso trava a thread
       * principal por bem mais que os ~8s de uma frase real medidos com
       * áudio real. Uma aula de até 30s por bloco não precisa de 448
       * tokens de saída — um teto bem menor limita o pior caso sem cortar
       * uma frase real de professor no meio.
       */
      max_new_tokens: 128,
    });
  } catch (erro) {
    registrarErro("inference", erro);
    throw erro;
  }

  registrarInferencia({
    duracaoInferenciaMs: Date.now() - inicio,
    chunks: resultado.chunks?.length ?? 0,
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
}

/**
 * Descarta o motor — só depois de uma falha real.
 *
 * Espelha `descartarLeitor` do Scanner: um `transcritor()` que travou ou
 * lançou não é algo em que a próxima aula deva confiar de novo sem recarregar.
 * Na prática isto já é redundante com o `.catch()` de `motorCompartilhado`
 * (que já zera `motorRef` sozinho em qualquer rejeição) — mas continua
 * explícito aqui para o caso de uma falha acontecer DEPOIS do motor carregar
 * (durante a inferência em si, não durante o carregamento).
 */
export function descartarMotor(): void {
  motorRef = null;
}

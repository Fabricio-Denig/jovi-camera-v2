import {
  decodificarParaWhisper,
  medirAmostras,
  megabytesDePcm,
  capturaParecaSilenciosa,
  TAXA_WHISPER,
} from "./audioPcm";
import {
  medirFase,
  medirFaseSync,
  registrarEngine,
  registrarDownload,
  registrarAudioSegmento,
  registrarAudioReproduzivel,
  registrarInferencia,
  registrarTranscricaoChunk,
  registrarErro,
} from "./listenDiag";
import { sanitizarTrecho, MENSAGEM_TRECHO_DEGENERADO } from "./transcriptSanitizer";
// A fonte única de QUAIS pesos existem — o mesmo arquivo que
// `scripts/fetch-whisper-model.mjs` lê para decidir o que baixar em CI. Ver o
// comentário de `MODELO_PRIMARIO` para o defeito real que isto corrige.
import MODELOS from "./whisperModels.json";

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
 * em CI e publica os bytes junto do site. `env.allowRemoteModels
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
 * `whisper-base`, não mais `whisper-tiny` — mudança feita numa rodada de
 * confiança motivada por um teste físico real: um professor disse "Falaremos
 * sobre lógica de programação e programação orientada a objetos" e o app
 * guardou o título como "Não e sei". A causa raiz é qualidade de STT, e o
 * benchmark abaixo mediu a diferença com áudio real (TTS PT-BR sintetizado
 * localmente com espeak-ng+mbrola, nunca texto injetado — os mesmos dois
 * roteiros de aceitação desta rodada, "matrizes" e "POO", em
 * `.claude/p0-audio/`, gitignored mas reproduzível pelo script ali):
 *
 * - POO, `whisper-tiny`: "Falaremos sobre a nossa operação e programação."
 *   — os dois conceitos obrigatórios (lógica de programação, programação
 *   orientada a objetos) desaparecem por completo. É a reprodução exata do
 *   defeito do teste físico.
 * - POO, `whisper-base`: "Falaríamos sobre lógica de programação e
 *   programação oriental da objetos." — os dois conceitos sobrevivem
 *   (uma flexão errada, "oriental" por "orientada", é o tipo de ruído que a
 *   camada de interpretação — `speechInsights.ts`/`lessonSummary.ts` —
 *   já precisa tolerar de qualquer STT, não uma frase perdida).
 * - Matrizes: `tiny` produz "matricista da cidade", "sanatriz matriblia de
 *   inútil" — irreconhecível. `base` produz "matarizidade" (reconhecível
 *   como "identidade"), preserva "linhas e colunas", "multiplicação... pode
 *   cair na prova" e a estrutura de lista depois de "resumindo".
 *
 * A ÚNICA razão histórica para não usar `base` era um bug real:
 * `onnx/decoder_model_merged_quantized.onnx` falhava ao criar sessão no
 * backend "wasm" do navegador (`TransposeDQWeightsForMatMulNBits Missing
 * required scale`) — mesmo arquivo, mesmo teste, rodando sem erro no
 * backend "cpu" do Node. Essa investigação aconteceu ANTES de
 * `session_options: { graphOptimizationLevel: "disabled" }` (abaixo) entrar
 * no código para outro motivo (um bug de repetição do `tiny`). Um novo teste
 * de ponta a ponta — Playwright, Chromium real, microfone falso, backend
 * "wasm" de verdade, com essa opção já em vigor — mostra a sessão ONNX
 * criando normalmente e a transcrição terminando sem o erro QDQ/MatMulNBits.
 * O bloqueio documentado não existe mais nas condições atuais do código.
 *
 * Custo aceito conscientemente: ~77MB em disco contra ~42MB do `tiny`
 * (`onnx/encoder_model_quantized.onnx` + `decoder_model_merged_quantized.
 * onnx`), e inferência mais lenta (~9s medidos para 7,5s de áudio no teste
 * de ponta a ponta, contra ~3s do `tiny` na mesma duração em Node). O
 * download é único e cacheado pelo navegador; a inferência roda depois que
 * a aula já terminou, sem concorrer com câmera nem `MediaRecorder`. Continua
 * a variante MULTILÍNGUE (nunca `.en`) — este produto transcreve português.
 *
 * Sobre a estratégia remota que esta mesma rodada cogitou como plano B: não
 * chegou a ser necessária. Este projeto não tem backend nem credenciais de
 * nenhum serviço de STT pago, e este achado (local já funciona bem, sem
 * precisar de rede durante a aula) tornou desnecessário inventar uma
 * infraestrutura nova só para a demonstração.
 *
 * ---
 *
 * **O que a troca para `base` quebrou, e por que este arquivo não escolhe
 * mais o modelo sozinho.** A troca acima foi publicada mudando a constante
 * DAQUI e só daqui. Quem BAIXA os pesos é outro arquivo
 * (`scripts/fetch-whisper-model.mjs`, rodando em CI), e ele continuou com a
 * própria constante apontando para `whisper-tiny`. O site publicado passou a
 * ter `models/Xenova/whisper-tiny/*` e nada em `models/Xenova/whisper-base/*`
 * — confirmado com HTTP contra o site de produção: `whisper-tiny/config.json`
 * responde 200, `whisper-base/config.json` responde 404. Com
 * `allowRemoteModels = false` (abaixo, de propósito: nada de CDN durante a
 * aula), não existe plano B dentro da biblioteca — todo arquivo do modelo
 * falha, o `pipeline(...)` rejeita, o job vira "falhou", e o celular mostra
 * zero transcrição. Foi exatamente o que dois testes físicos mostraram.
 *
 * Duas correções, porque uma só não bastaria:
 *
 * 1. `src/listen/whisperModels.json` é a FONTE ÚNICA — este arquivo e o
 *    script de download leem o mesmo JSON. Divergir virou impossível, não
 *    "improvável".
 * 2. `conferirPesos()` (abaixo) pergunta ao servidor se os pesos existem
 *    ANTES de mandar a biblioteca carregá-los, e o motor cai para o modelo
 *    de reserva quando não existem — ou quando o primário falha por qualquer
 *    outro motivo (memória do aparelho, sessão ONNX que não cria). Um
 *    `tiny` transcrevendo mal vale mais, na banca, que um `base` ausente
 *    transcrevendo nada. */
const MODELO_PRIMARIO: string = MODELOS.primario;
/** O reserva: só carrega se o primário não carregar. Ver `motorCompartilhado`. */
const MODELO_RESERVA: string = MODELOS.fallback;

/**
 * `?listen-model=tiny` força o reserva — um instrumento de medição, não uma
 * opção de produto.
 *
 * **Por que existe.** A escolha entre `base` e `tiny` foi feita com um
 * benchmark de QUALIDADE (ver o comentário acima: `tiny` some com os
 * conceitos da aula, `base` os preserva) medido em máquina de bancada. O
 * teste físico seguinte levantou a outra metade da pergunta, que aquele
 * benchmark não respondia: **quanto cada um custa de TEMPO no celular de
 * verdade?** Sem um jeito de rodar o mesmo áudio com os dois no MESMO
 * aparelho, a comparação continuaria sendo qualidade medida contra latência
 * suposta — e trocar de modelo por suposição foi exatamente o erro que esta
 * rodada não quer repetir.
 *
 * Com isto, a evidência sai de dois carregamentos da mesma aula:
 * `?debug=listen` mostra `model_load` e `inference` de cada um, lado a lado,
 * no aparelho que importa. Nenhum caminho da interface leva aqui, e sem o
 * parâmetro nada muda.
 */
function modeloPedido(): string {
  try {
    const pedido = new URLSearchParams(window.location.search).get("listen-model");
    if (pedido === "tiny") return MODELO_RESERVA;
    if (pedido === "base") return MODELO_PRIMARIO;
  } catch {
    // Sem `location` (contexto sem janela): segue o padrão.
  }
  return MODELO_PRIMARIO;
}

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
    repetition_penalty: number;
    no_repeat_ngram_size: number;
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
/** Qual modelo de fato carregou — pode ser o reserva. Só o diagnóstico lê:
    numa banca, "o texto veio do `tiny` porque o `base` não carregou" é a
    primeira coisa a saber, e supor que foi o primário seria supor errado. */
let modeloEmUso: string | null = null;

/** Para `?debug=listen`: o modelo que está de fato servindo, não o pedido. */
export function modeloAtivo(): string | null {
  return modeloEmUso;
}

function baseAbsoluta(caminho: string): string {
  return new URL(
    `${import.meta.env.BASE_URL}${caminho}`,
    window.location.origin,
  ).href;
}

function mensagemDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

/**
 * Os pesos deste modelo estão MESMO no servidor?
 *
 * Duas requisições pequenas, antes de mandar a biblioteca carregar 77MB. Não
 * é otimização — é a diferença entre um diagnóstico que diz
 * "`whisper-base/config.json` respondeu HTTP 404" e o que acontecia antes:
 * a biblioteca tentava, falhava por dentro em algum arquivo, e o erro que
 * sobrava não dizia nem qual modelo nem qual arquivo. Com
 * `allowRemoteModels = false`, um peso ausente não tem plano B DENTRO da
 * biblioteca — então o plano B tem que ser aqui fora, e para escolhê-lo é
 * preciso saber, de fato, que o peso não está lá.
 *
 * `config.json` vai por GET e é conferido como JSON de verdade: um servidor
 * que responde a arquivo inexistente com a página do app (200 + HTML)
 * passaria por um HEAD e quebraria depois, lá dentro, sem pista. O arquivo
 * grande vai por HEAD — só a existência e o tamanho interessam, baixá-lo é
 * trabalho do `pipeline(...)`.
 */
async function conferirPesos(modelo: string): Promise<void> {
  const urlConfig = baseAbsoluta(`models/${modelo}/config.json`);
  let resposta: Response;
  try {
    resposta = await fetch(urlConfig, { cache: "no-store" });
  } catch (erro) {
    registrarDownload({ arquivo: `${modelo}/config.json`, url: urlConfig, erro: mensagemDe(erro) });
    throw new Error(
      `Não foi possível alcançar os pesos de ${modelo}: ${mensagemDe(erro)}`,
    );
  }
  registrarDownload({
    arquivo: `${modelo}/config.json`,
    url: urlConfig,
    status: resposta.status,
  });
  if (!resposta.ok) {
    throw new Error(
      `Pesos de ${modelo} não estão publicados: config.json respondeu HTTP ${resposta.status}`,
    );
  }
  try {
    const config = (await resposta.json()) as { model_type?: string };
    if (!config.model_type) throw new Error("sem `model_type`");
  } catch (erro) {
    throw new Error(
      `Pesos de ${modelo}: config.json não é o JSON do modelo (${mensagemDe(erro)})`,
    );
  }

  const arquivoGrande = `onnx/encoder_model_quantized.onnx`;
  const urlPeso = baseAbsoluta(`models/${modelo}/${arquivoGrande}`);
  let cabecalho: Response;
  try {
    cabecalho = await fetch(urlPeso, { method: "HEAD", cache: "no-store" });
  } catch (erro) {
    registrarDownload({ arquivo: `${modelo}/${arquivoGrande}`, url: urlPeso, erro: mensagemDe(erro) });
    throw new Error(
      `Não foi possível alcançar ${arquivoGrande} de ${modelo}: ${mensagemDe(erro)}`,
    );
  }
  const bytes = Number(cabecalho.headers.get("content-length")) || undefined;
  registrarDownload({
    arquivo: `${modelo}/${arquivoGrande}`,
    url: urlPeso,
    status: cabecalho.status,
    bytes,
  });
  if (!cabecalho.ok) {
    throw new Error(
      `Pesos de ${modelo} incompletos: ${arquivoGrande} respondeu HTTP ${cabecalho.status}`,
    );
  }
}

/**
 * Carrega UM modelo, do começo ao fim. Quem decide qual (e o que fazer quando
 * este não carrega) é `motorCompartilhado`.
 */
async function carregarModelo(modelo: string): Promise<Transcritor> {
  registrarEngine({
    modelId: modelo,
    multilingual: true,
    backend: "onnxruntime-web",
    device: "wasm",
    numThreads: 1,
    estado: "carregando",
    cache: motorJaCarregouNestaAba ? "quente" : "frio",
  });

  await conferirPesos(modelo);
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

  const transcritor = await pipeline("automatic-speech-recognition", modelo, {
    dtype: "q8",
    device: "wasm",
    // Desliga a otimização de grafo do ONNX Runtime — não é experimento: é o
    // que evita o bug QDQ/MatMulNBits que impedia a sessão de sequer criar
    // (ver o comentário grande acima). Sem isto o modelo não carrega.
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
          url: baseAbsoluta(`models/${modelo}/${dado.file}`),
          status: 200,
          bytes: dado.total,
          duracaoMs: inicio ? Date.now() - inicio : undefined,
        });
      }
    },
  } as Parameters<typeof pipeline>[2]);

  motorJaCarregouNestaAba = true;
  return transcritor as unknown as Transcritor;
}

/**
 * O motor, um por aba — agora com um plano B de verdade.
 *
 * **Por que a cadeia existe.** O modelo primário pode não carregar por
 * motivos que esta bancada não consegue reproduzir: os pesos não publicados
 * (o defeito real que motivou esta rodada), o aparelho sem memória para
 * 77MB, uma versão de WebAssembly que recusa a sessão ONNX. Nenhum desses é
 * consertável na hora da apresentação. O que é consertável AGORA é a
 * consequência: em vez de a aula terminar sem texto nenhum, o motor tenta o
 * `tiny` — pior de qualidade, medido, mas já rodou em aparelho real. A
 * decisão é deliberada e tem ordem: qualidade primeiro, alguma transcrição
 * sempre.
 *
 * **Cada falha fica registrada, nenhuma é engolida.** `?debug=listen` mostra
 * a lista inteira de tentativas (`registrarErro("engine:<modelo>")`), e se
 * NENHUM modelo carregar, o erro que sobe carrega os dois motivos no texto —
 * o oposto do que acontecia antes, quando um erro de dentro da biblioteca
 * não dizia nem qual modelo tinha falhado.
 */
async function motorCompartilhado(): Promise<Transcritor> {
  if (!motorRef) {
    motorRef = (async () => {
      // `filter` remove a duplicata se algum dia primário e reserva forem o
      // mesmo — tentar duas vezes o mesmo modelo só faria a pessoa esperar o
      // dobro pelo mesmo erro.
      // `modeloPedido()` é o primário, exceto quando `?listen-model=` pede
      // outro para uma medição — a cadeia de reserva continua igual.
      const candidatos = [modeloPedido(), MODELO_RESERVA].filter(
        (m, i, todos) => todos.indexOf(m) === i,
      );
      const falhas: string[] = [];

      for (const modelo of candidatos) {
        try {
          const transcritor = await carregarModelo(modelo);
          modeloEmUso = modelo;
          registrarEngine({ modelId: modelo, estado: "pronto" });
          return transcritor;
        } catch (erro) {
          // O estágio nomeia o modelo: numa cadeia de duas tentativas, "qual
          // delas falhou, e por quê" é a única pergunta que importa depois.
          registrarErro(`engine:${modelo}`, erro);
          falhas.push(`${modelo} → ${mensagemDe(erro)}`);
        }
      }

      throw new Error(
        `Nenhum modelo de transcrição carregou neste aparelho. ${falhas.join(" | ")}`,
      );
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
    /*
     * **Decodificação E reamostragem, numa medida só — porque são uma
     * chamada só.** `decodeAudioData` num `AudioContext` criado já a 16 kHz
     * faz as duas coisas por dentro do navegador, e não existe um gancho
     * entre elas para cronometrar. Separá-las exigiria decodificar na taxa
     * nativa e reamostrar à mão — mais lento, e mediria um caminho que o
     * produto não usa. A medida honesta é esta: `decode` inclui o resample,
     * e o rótulo diz de que taxa para qual.
     */
    decodificado = await medirFase(
      "decode",
      `segmento ${indice}`,
      () => decodificarParaWhisper(blob),
      (d) =>
        `${d.durationS.toFixed(1)}s · ${d.sampleRateOriginal}Hz→${TAXA_WHISPER}Hz` +
        ` · ${d.canaisOriginais}ch · ${megabytesDePcm(d.durationS)}MB de PCM`,
    );
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

  /*
   * Carregar o modelo é uma ETAPA, não o começo da inferência.
   *
   * Medida separada de propósito: na primeira transcrição de uma aba ela
   * inclui ler (ou baixar) os pesos e criar a sessão ONNX; na segunda ela é
   * quase nada, porque `motorCompartilhado()` memoiza a promessa. Somadas
   * num número só — como estavam — não há como responder a pergunta que o
   * teste físico deixou: **68 segundos de áudio levaram cerca de dez
   * minutos; foram no carregamento ou na inferência?** São causas
   * diferentes com correções diferentes.
   */
  const transcritor = await medirFase(
    "model_load",
    modeloEmUso ?? modeloPedido(),
    () => motorCompartilhado(),
    () => `cache ${motorJaCarregouNestaAba ? "quente" : "frio"} · modelo ${modeloEmUso}`,
  );

  const inicio = Date.now();
  registrarInferencia({
    iniciouEm: inicio,
    samples: decodificado.amostras.length,
    duracaoAudioS: medida.durationS,
  });

  let resultado;
  try {
    resultado = await medirFase(
      "inference",
      `segmento ${indice}`,
      () =>
    transcritor(decodificado.amostras, {
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
      /*
       * Achado com um teste físico real: um trecho pouco claro ("Eu vou
       * fazer um pouco de...") fez o modelo entrar num loop de repetição —
       * "um pouco de um pouco de um pouco..." — dezenas de vezes, até bater
       * no teto de `max_new_tokens`. Confirmado lendo o código-fonte da
       * versão instalada (`node_modules/@huggingface/transformers`, 4.2.0):
       * `repetition_penalty` e `no_repeat_ngram_size` são parâmetros REAIS de
       * `GenerationConfig`, aplicados de forma genérica a qualquer modelo —
       * Whisper incluso — via `_get_logits_processor`
       * (`src/models/modeling_utils.js`). Outros mecanismos do Whisper em
       * Python (`condition_on_prev_tokens`, `compression_ratio_threshold`,
       * `no_speech_threshold`, `temperature`/fallback) NÃO existem nesta
       * versão da biblioteca — confirmado por busca no código-fonte inteiro,
       * zero ocorrências — por isso não estão aqui: seria inventar uma opção
       * que a biblioteca instalada não lê.
       *
       * Isto REDUZ a chance de um loop, não a elimina — por isso
       * `transcriptSanitizer.ts` (abaixo) continua sendo a garantia de
       * verdade: mesmo que o modelo repita, o texto sanitizado é o único que
       * chega a qualquer tela.
       */
      repetition_penalty: 1.3,
      no_repeat_ngram_size: 3,
    }),
      (r) =>
        `${medida.durationS.toFixed(1)}s de áudio → ${r.chunks?.length ?? 0} blocos` +
        ` · ${(medida.durationS * 1000).toFixed(0)}ms de fala`,
    );
  } catch (erro) {
    registrarErro("inference", erro);
    throw erro;
  }

  registrarInferencia({
    duracaoInferenciaMs: Date.now() - inicio,
    chunks: resultado.chunks?.length ?? 0,
  });

  /*
   * RAW MODEL OUTPUT → sanitizado, antes de qualquer outra coisa ver este
   * texto. `sanitizeTranscript` (`transcriptSanitizer.ts`) corta loops de
   * repetição ("um pouco de um pouco de..." — achado com um teste físico
   * real) e classifica o que sobra. O bruto nunca é devolvido — só existe
   * para `?debug=listen` (`registrarTranscricaoChunk`), nunca persistido com
   * a aula.
   */
  const sanitizarELograr = (chunkIndex: number, bruto: string): string => {
    const r = sanitizarTrecho(bruto);
    registrarTranscricaoChunk({
      segmentoIndex: indice,
      chunkIndex,
      bruto,
      sanitizado: r.text,
      qualidade: r.qualidade,
      loopDetectado: r.loopDetectado,
    });
    // Nada sobrou (trecho inteiro degenerado): um aviso curto e honesto no
    // lugar do texto — nunca um buraco silencioso, nunca o texto quebrado.
    return r.text || MENSAGEM_TRECHO_DEGENERADO;
  };

  /*
   * A sanitização é medida à parte — e é, das etapas, a que mais se espera
   * que seja barata.
   *
   * Está aqui justamente para isso: numa investigação de "por que 68
   * segundos de áudio levaram dez minutos", uma etapa medida e desprezível
   * é uma suspeita ELIMINADA, e eliminar suspeitas é metade do trabalho.
   * Se algum dia ela aparecer com peso, a busca de repetição
   * (`transcriptSanitizer`) passa a ser candidata em vez de inocente por
   * suposição.
   */
  return medirFaseSync(
    "sanitizer",
    `segmento ${indice}`,
    () => {
      // Sem blocos (áudio curto, sem `chunks` no retorno): o texto inteiro vira
      // um trecho só, do início ao fim do arquivo — melhor que descartar uma
      // transcrição que existe só porque não veio fatiada.
      if (!resultado.chunks || resultado.chunks.length === 0) {
        const bruto = resultado.text.trim();
        if (!bruto) return [];
        const texto = sanitizarELograr(0, bruto);
        return [{ startMs: 0, endMs: 0, text: texto }];
      }

      return resultado.chunks
        .map((c, i) => ({
          startMs: Math.round(c.timestamp[0] * 1000),
          // `timestamp[1]` vem nulo quando o áudio acaba no meio de uma
          // palavra que o modelo não fechou — o começo do bloco ainda é uma
          // âncora válida, então o fim herda dele em vez de descartar o bloco.
          endMs: Math.round((c.timestamp[1] ?? c.timestamp[0]) * 1000),
          text: c.text.trim() ? sanitizarELograr(i, c.text.trim()) : "",
        }))
        .filter((c) => c.text.length > 0);
    },
  );
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

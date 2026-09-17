/**
 * O diagnóstico do Listen — tudo que `?debug=listen` mostra, e a única coisa
 * capaz de responder "onde exatamente isso quebrou?" depois de uma falha real
 * em aparelho, sem o cabo do celular na mão.
 *
 * **Por que existe.** Um teste físico mostrou a transcrição falhando — e o
 * "Tentar de novo" também — sem nenhuma pista de qual das dezenas de coisas
 * que podem dar errado (rede, modelo, decodificação, WASM, memória) foi a
 * causa. `transcribeSession.ts` capturava o erro só para jogar fora
 * (`catch { ... }`, sem ler `erro`). Este módulo é a correção disso: cada
 * etapa do caminho grava o que fez, e a última falha real fica persistida —
 * sobrevive a um recarregamento da página, porque é exatamente depois de
 * fechar e reabrir o app que alguém abre `?debug=listen` para investigar.
 *
 * **Por que não aparece para quem não pediu.** A pessoa comum continua vendo
 * só "Não foi possível processar o áudio." / "Tentar de novo" — stack trace
 * não ajuda ninguém numa demonstração. Este arquivo não decide UI nenhuma;
 * `ListenDebugReport.tsx` é quem lê isto e mostra, e só quando `?debug=listen`
 * está na URL.
 */

const CHAVE = "slid:listen-diag:v1";

export interface AudioSegmentDiag {
  index: number;
  mimeType: string;
  bytes: number;
  startMs: number;
  durationMs: number;
  decoded?: {
    durationS: number;
    sampleRate: number;
    channels: number;
    frameCount: number;
    peak: number;
    rms: number;
    silencioPercent: number;
  };
  decodeError?: string;
}

export interface DeviceDiag {
  userAgent: string;
  deviceMemory: number | null;
  hardwareConcurrency: number | null;
  crossOriginIsolated: boolean;
  sharedArrayBuffer: boolean;
  webgpu: boolean;
  webassembly: boolean;
  onLine: boolean;
}

export interface EngineDiag {
  modelId: string | null;
  multilingual: boolean | null;
  backend: string | null;
  device: string | null;
  numThreads: number | null;
  /** O nível de otimização de grafo do ONNX Runtime que ESTA sessão usou.
      Registrado porque é a suspeita principal para a lentidão medida em
      aparelho, e porque `?listen-graph=` pode trocá-lo num benchmark — sem
      isto no relatório, não haveria como saber qual dos dois produziu o
      número que se está lendo. */
  graphOptimizationLevel: string | null;
  estado: "ocioso" | "carregando" | "pronto" | "falhou";
  cache: "desconhecido" | "frio" | "quente";
}

export interface DownloadFileDiag {
  arquivo: string;
  url: string;
  status?: number;
  bytes?: number;
  duracaoMs?: number;
  erro?: string;
}

export interface InferenceDiag {
  iniciouEm: number | null;
  samples: number | null;
  duracaoAudioS: number | null;
  duracaoInferenciaMs: number | null;
  chunks: number | null;
}

/**
 * O que o modelo devolveu para um trecho, e o que sobrou depois do
 * `sanitizeTranscript` (`transcriptSanitizer.ts`) — lado a lado, só para
 * `?debug=listen`.
 *
 * Existe porque um teste físico real mostrou o motor entrando num loop de
 * repetição ("um pouco de um pouco de...") sem nenhum jeito de confirmar,
 * depois, se a causa foi a decodificação em si ou uma etapa posterior
 * (concatenação, merge de segmentos). Com RAW e SANITIZED lado a lado por
 * trecho, a próxima vez que isso acontecer em aparelho real, a resposta está
 * aqui — não precisa supor de novo.
 */
export interface TranscriptChunkDiag {
  segmentoIndex: number;
  chunkIndex: number;
  bruto: string;
  sanitizado: string;
  qualidade: string;
  loopDetectado: boolean;
}

/**
 * As etapas do trabalho, cronometradas UMA A UMA.
 *
 * **A pergunta que isto existe para responder.** Um teste físico real:
 * `01:08` de gravação — **68 segundos**, não 68 minutos — levou cerca de
 * **dez minutos** para terminar no celular, com a tela travando ao navegar
 * para a Galeria no meio. Isso é aproximadamente nove vezes a duração do
 * próprio áudio, e a instrumentação que existia (duração dos downloads
 * mais uma duração agregada de inferência) não distinguia nenhuma das
 * causas possíveis.
 *
 * A primeira versão desta medição foi escrita interpretando aquele `01:08`
 * como uma hora e oito minutos, e daí saíram contas de centenas de
 * megabytes que NÃO descrevem o caso real: 68 segundos de PCM a 16 kHz são
 * ~4,3 MB. O registro fica aqui de propósito — a mesma instrumentação que
 * teria evitado o engano é a que agora precisa medir sem ele.
 *
 * As etapas são as que podem dominar o tempo por motivos independentes, e
 * cada uma aponta para uma correção diferente:
 *
 * - `model_load`: criar o `pipeline` — ler os pesos (do cache ou da rede) e
 *   criar a sessão ONNX. Se dominar, o problema é rede/cache/tamanho do
 *   modelo, e a comparação `base` × `tiny` (ver `?listen-model=` em
 *   `whisperEngine.ts`) decide.
 * - `decode`: Blob gravado → PCM, reamostragem inclusa (o navegador faz as
 *   duas numa chamada só — ver `decodificarParaWhisper`).
 * - `inference`: o modelo gerando texto, token a token, na thread
 *   principal e sem otimização de grafo (`graphOptimizationLevel:
 *   "disabled"`, posto ali para contornar um bug de criação de sessão). É a
 *   suspeita principal para os dez minutos, e medi-la é o que confirma ou
 *   derruba isso.
 * - `sanitizer`: `transcriptSanitizer` sobre o texto bruto.
 * - `summary`: `gerarResumoGlobal` sobre a transcrição pronta.
 * - `persistence`: escrever no IndexedDB.
 *
 * `heapMb` é lido no FIM de cada etapa, quando o navegador informa
 * (`performance.memory`, Chrome/Android — exatamente o aparelho do teste).
 * Com 68 segundos de áudio a expectativa é que ele seja pequeno em todas as
 * etapas; se for, memória deixa de ser hipótese para o travamento e sobra
 * a thread principal (ver `LongTaskDiag`).
 */
export type FaseNome =
  | "job"
  | "model_load"
  | "decode"
  | "inference"
  | "sanitizer"
  | "summary"
  | "persistence";

export interface FaseDiag {
  fase: FaseNome;
  /** Qual pedaço do trabalho — "segmento 0", o nome do modelo. Vazio quando
      a etapa acontece uma vez só por tentativa. */
  rotulo?: string;
  inicio: number;
  duracaoMs: number;
  /** Heap JS no fim desta etapa, em MB — `null` num navegador que não conta. */
  heapMb: number | null;
  /** Uma medida da própria etapa, para relacionar tempo com tamanho:
      segundos de áudio decodificados, amostras enviadas, blocos escritos. */
  detalhe?: string;
}

/**
 * Quanto tempo a thread principal passou PRESA — a medida que separa as
 * duas explicações possíveis para o travamento visto no aparelho.
 *
 * O teste físico deixou dois sintomas juntos: o processamento demorou muito
 * E a interface travou ao abrir a Galeria no meio. Eles têm causas
 * diferentes e correções diferentes:
 *
 * - **Memória**: alocação demais, o sistema encerra a aba. Seria visível em
 *   `heapMb` subindo etapa a etapa.
 * - **Thread principal presa**: a inferência roda em WebAssembly na MESMA
 *   thread que desenha a tela (`wasm.proxy` foi tentado e descartado — ver
 *   `whisperEngine.ts`). Nada responde enquanto ela corre, e um navegador
 *   móvel pode dar a página por não-responsiva.
 *
 * Uma "long task" é qualquer bloco acima de 50ms em que o navegador não
 * conseguiu fazer mais nada. Somadas ao longo de um trabalho, elas dizem
 * quanto do tempo total foi de UI congelada — e um `maiorMs` na casa dos
 * segundos é prova direta da segunda hipótese, não suposição.
 *
 * `disponivel` é `false` onde a API não existe (Safari, por exemplo): um
 * zero ali significaria "não travou", que é diferente de "não dá para
 * saber".
 */
export interface LongTaskDiag {
  disponivel: boolean;
  total: number;
  somaMs: number;
  maiorMs: number;
}

export interface ErrorDiag {
  stage: string;
  name: string;
  message: string;
  stack?: string;
  attempt: number;
  timestamp: number;
}

export interface ListenDiagSnapshot {
  attempt: number;
  engine: EngineDiag;
  downloads: DownloadFileDiag[];
  audio: AudioSegmentDiag[];
  inference: InferenceDiag;
  fases: FaseDiag[];
  longTasks: LongTaskDiag;
  transcricao: TranscriptChunkDiag[];
  error: ErrorDiag | null;
}

function vazio(): ListenDiagSnapshot {
  return {
    attempt: 0,
    engine: {
      modelId: null,
      multilingual: null,
      backend: null,
      device: null,
      numThreads: null,
      graphOptimizationLevel: null,
      estado: "ocioso",
      cache: "desconhecido",
    },
    downloads: [],
    audio: [],
    inference: {
      iniciouEm: null,
      samples: null,
      duracaoAudioS: null,
      duracaoInferenciaMs: null,
      chunks: null,
    },
    fases: [],
    longTasks: { disponivel: false, total: 0, somaMs: 0, maiorMs: 0 },
    transcricao: [],
    error: null,
  };
}

let estado: ListenDiagSnapshot = ler();

function ler(): ListenDiagSnapshot {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return vazio();
    return { ...vazio(), ...JSON.parse(bruto) };
  } catch {
    return vazio();
  }
}

/**
 * Escreve o diagnóstico no `localStorage` — mas nunca mais que uma vez por
 * `INTERVALO_ESCRITA_MS`.
 *
 * **Por que a espera existe.** `localStorage.setItem` é SÍNCRONO: ele trava
 * a thread principal enquanto serializa e grava. Cada `registrar*` fazia um
 * `JSON.stringify` do snapshot INTEIRO, e o snapshot cresce — um trecho de
 * transcrição entra na lista a cada bloco reconhecido, e cada `stringify`
 * fica maior que o anterior. É trabalho quadrático na mesma thread que
 * roda a inferência e desenha a interface.
 *
 * Numa aula de um minuto são poucos blocos, e isto não explica nada do que
 * foi medido em aparelho — é uma correção de higiene, não a causa. Mas ela
 * também não pode ser confundida com a causa depois: com esta espera, o
 * próprio instrumento deixa de aparecer nas medidas que ele produz.
 *
 * O diagnóstico é auxiliar por definição — perder os últimos 400ms dele
 * num fechamento abrupto não custa nada, e `persistirAgora()` existe para
 * os dois momentos em que custaria: uma falha real e o fim do trabalho.
 */
const INTERVALO_ESCRITA_MS = 400;
// `ReturnType<typeof setTimeout>` e não `number`: o timer global (em vez de
// `window.setTimeout`) é o que deixa este módulo carregar fora do navegador —
// é assim que `tests/qa-transcricao-longa.mjs` consegue exercitar a regra de
// ciclo de vida sem subir um Chromium.
let escritaAgendada: ReturnType<typeof setTimeout> | null = null;
let ultimaEscrita = 0;

function escrever() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
    ultimaEscrita = Date.now();
  } catch {
    // Cota cheia ou modo privado: o diagnóstico é auxiliar, nunca crítico.
  }
}

function persistir() {
  if (escritaAgendada !== null) return;
  const desde = Date.now() - ultimaEscrita;
  if (desde >= INTERVALO_ESCRITA_MS) {
    escrever();
    return;
  }
  escritaAgendada = setTimeout(() => {
    escritaAgendada = null;
    escrever();
  }, INTERVALO_ESCRITA_MS - desde);
}

/** Grava já, sem esperar a janela — para o que não pode se perder: uma falha
    real, e o fim do trabalho. */
function persistirAgora() {
  if (escritaAgendada !== null) {
    clearTimeout(escritaAgendada);
    escritaAgendada = null;
  }
  escrever();
}

/** Uma nova tentativa começa — limpa erro/áudio/inferência anteriores, mas
    mantém o histórico de downloads (o modelo, se já baixado, continua). */
export function iniciarTentativa(): number {
  estado = {
    ...vazio(),
    attempt: estado.attempt + 1,
    downloads: estado.downloads,
    /*
     * O motor também sobrevive à tentativa, e por um motivo medido: quando
     * ele já está carregado, `carregarModelo` não roda de novo (a promessa é
     * memoizada) e nada reescreve estas informações. Zerá-las fazia um
     * relatório de segunda execução dizer "modelo: —", justamente na
     * execução em que a pergunta é "qual modelo produziu este tempo".
     */
    engine: estado.engine,
  };
  // O PCM guardado para tocar é da tentativa anterior — e é a maior coisa
  // que este módulo segura. Uma tentativa nova não pode herdar o que a
  // anterior reteve (ver `registrarAudioReproduzivel`).
  amostrasReproduziveis.clear();
  // A contagem de travas é por tentativa, como todo o resto: somar as de
  // uma tentativa anterior responderia outra pergunta.
  ligarObservadorDeTravas();
  persistir();
  return estado.attempt;
}

export function registrarEngine(patch: Partial<EngineDiag>) {
  estado = { ...estado, engine: { ...estado.engine, ...patch } };
  persistir();
}

export function registrarDownload(diag: DownloadFileDiag) {
  const outros = estado.downloads.filter((d) => d.arquivo !== diag.arquivo);
  estado = { ...estado, downloads: [...outros, diag] };
  persistir();
}

export function registrarAudioSegmento(diag: AudioSegmentDiag) {
  const outros = estado.audio.filter((a) => a.index !== diag.index);
  estado = { ...estado, audio: [...outros, diag].sort((a, b) => a.index - b.index) };
  persistir();
}

/**
 * O PCM de verdade de cada segmento, só em memória — nunca em
 * `localStorage`: um Float32Array de uma aula de minutos pesa megabytes, e
 * persistir isso a cada trecho estouraria a cota rápido para um dado que só
 * importa enquanto a aba está aberta.
 *
 * Existe para uma coisa só: `?debug=listen` poder tocar "exatamente o que
 * foi enviado ao modelo" (Fase 1) — não uma segunda decodificação por conta
 * própria, o MESMO Float32Array que `transcreverTrecho` mediu e enviou.
 *
 * ---
 *
 * **Por que isto agora tem porteiro e teto.** A versão anterior guardava o
 * Float32Array INTEIRO, de TODO segmento, em TODA execução — sem nunca
 * limpar o mapa e sem perguntar se alguém ia ouvir aquilo. Para a aula do
 * teste físico (68 segundos) isso são ~4,3 MB: pouco, e **não** a causa de
 * travamento nenhum — a primeira versão deste comentário afirmava centenas
 * de megabytes porque lia `01:08` como uma hora e oito minutos, o que era
 * falso.
 *
 * O que continua verdade sem aquele número é mais simples: um recurso de
 * depuração não deve custar memória a quem não pediu depuração, e um mapa
 * que ninguém limpa cresce com o uso do app, não com o tamanho de uma aula.
 * Duas regras, nenhuma delas tirando a capacidade de investigar:
 *
 * 1. **Só guarda quando alguém vai ouvir.** Sem `?debug=listen` na URL,
 *    nada é retido.
 * 2. **Um teto, mesmo em depuração.** `SEGUNDOS_REPRODUZIVEIS` do começo de
 *    cada segmento bastam para a pergunta que este recurso existe para
 *    responder ("o microfone captou fala de verdade?"), e as medidas
 *    (`medirAmostras`) cobrem o segmento todo de qualquer jeito.
 */
const amostrasReproduziveis = new Map<
  number,
  { amostras: Float32Array; sampleRate: number; truncado: boolean }
>();

/** Quanto do começo de cada segmento fica disponível para ouvir em
    `?debug=listen`. 60s a 16 kHz são ~3,8 MB, e cobrem inteira uma aula do
    tamanho da que foi testada em aparelho. */
const SEGUNDOS_REPRODUZIVEIS = 60;
/** E quantos segmentos, no máximo: uma aula com muitos ciclos liga/desliga
    não pode somar dezenas de cópias. */
const MAX_SEGMENTOS_REPRODUZIVEIS = 4;

function depuracaoLigada(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("debug") === "listen";
  } catch {
    return false;
  }
}

export function registrarAudioReproduzivel(
  index: number,
  amostras: Float32Array,
  sampleRate: number,
) {
  if (!depuracaoLigada()) return;
  if (
    amostrasReproduziveis.size >= MAX_SEGMENTOS_REPRODUZIVEIS &&
    !amostrasReproduziveis.has(index)
  ) {
    return;
  }
  const teto = SEGUNDOS_REPRODUZIVEIS * sampleRate;
  const truncado = amostras.length > teto;
  amostrasReproduziveis.set(index, {
    // `.slice()`, não `subarray`: uma view manteria o Float32Array inteiro
    // vivo pelo buffer, que é exatamente o que este teto existe para evitar.
    amostras: truncado ? amostras.slice(0, teto) : amostras,
    sampleRate,
    truncado,
  });
}

/** Solta o PCM guardado — o trabalho terminou e ninguém mais vai ouvir
    aquilo nesta execução. */
export function limparAudioReproduzivel() {
  amostrasReproduziveis.clear();
}

export function obterAudioReproduzivel(
  index: number,
): { amostras: Float32Array; sampleRate: number; truncado: boolean } | undefined {
  return amostrasReproduziveis.get(index);
}

export function registrarInferencia(patch: Partial<InferenceDiag>) {
  estado = { ...estado, inference: { ...estado.inference, ...patch } };
  persistir();
}

/**
 * Quanto do heap JS está em uso agora, em MB — ou `null`.
 *
 * `performance.memory` é uma extensão só do Chrome (e do Chrome no Android,
 * que é o aparelho onde o site fechou sozinho). Não é padrão, não existe em
 * Safari/Firefox, e por isso o tipo é `null`-ável em vez de um número
 * inventado: um zero aqui seria lido como "não usou memória", que é o
 * oposto do que "não dá para saber" significa.
 */
export function heapMb(): number | null {
  const mem = (performance as Performance & {
    memory?: { usedJSHeapSize?: number };
  }).memory;
  const bytes = mem?.usedJSHeapSize;
  if (typeof bytes !== "number") return null;
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

/** Um teto para a lista de etapas: uma aula com muitos trechos de gravação
    gera uma etapa por trecho, e o instrumento não pode virar ele mesmo um
    custo. As mais antigas saem primeiro — as últimas são as que interessam
    numa investigação. */
const MAX_FASES = 200;

export function registrarFase(diag: FaseDiag) {
  const fases = [...estado.fases, diag];
  estado = {
    ...estado,
    fases: fases.length > MAX_FASES ? fases.slice(fases.length - MAX_FASES) : fases,
  };
  persistir();
}

/**
 * Cronometra uma etapa e registra quanto ela levou — o jeito normal de
 * medir qualquer coisa neste cano.
 *
 * Mede tanto o caminho bom quanto o ruim de propósito: uma etapa que falhou
 * depois de oito minutos é um dado tão importante quanto uma que terminou
 * bem, e um `try/finally` por chamada no código do motor esconderia a
 * medição no meio da lógica.
 */
export async function medirFase<T>(
  fase: FaseNome,
  rotulo: string | undefined,
  fn: () => Promise<T>,
  detalhe?: (resultado: T) => string,
): Promise<T> {
  const inicio = Date.now();
  try {
    const resultado = await fn();
    registrarFase({
      fase,
      rotulo,
      inicio,
      duracaoMs: Date.now() - inicio,
      heapMb: heapMb(),
      detalhe: detalhe?.(resultado),
    });
    return resultado;
  } catch (erro) {
    registrarFase({
      fase,
      rotulo,
      inicio,
      duracaoMs: Date.now() - inicio,
      heapMb: heapMb(),
      detalhe: `falhou: ${erro instanceof Error ? erro.message : String(erro)}`,
    });
    throw erro;
  }
}

/**
 * A mesma medição, para o que é síncrono.
 *
 * O resumo (`gerarResumoGlobal`) não é uma promessa — ele roda de uma vez
 * só, bloqueando a thread, e é exatamente por isso que interessa medi-lo:
 * um resumo caro acontecendo no meio de uma transcrição é jank que ninguém
 * consegue atribuir olhando só para o tempo total do job.
 */
export function medirFaseSync<T>(
  fase: FaseNome,
  rotulo: string | undefined,
  fn: () => T,
): T {
  const inicio = Date.now();
  const resultado = fn();
  registrarFase({
    fase,
    rotulo,
    inicio,
    duracaoMs: Date.now() - inicio,
    heapMb: heapMb(),
  });
  return resultado;
}

/**
 * O tempo somado por etapa — a leitura de uma linha que responde "onde
 * foram os dez minutos".
 */
export function totaisPorFase(
  snapshot: ListenDiagSnapshot = estado,
): { fase: FaseNome; totalMs: number; vezes: number }[] {
  const mapa = new Map<FaseNome, { totalMs: number; vezes: number }>();
  for (const f of snapshot.fases) {
    const atual = mapa.get(f.fase) ?? { totalMs: 0, vezes: 0 };
    mapa.set(f.fase, { totalMs: atual.totalMs + f.duracaoMs, vezes: atual.vezes + 1 });
  }
  return [...mapa.entries()]
    .map(([fase, v]) => ({ fase, ...v }))
    .sort((a, b) => b.totalMs - a.totalMs);
}

/**
 * O observador de long tasks — ligado enquanto um trabalho corre.
 *
 * Só existe durante a transcrição de propósito: observar o tempo todo
 * mediria o app inteiro (rolar a Galeria, abrir uma aula) e misturaria isso
 * com o que se quer responder, que é quanto a transcrição sozinha prende a
 * thread principal. Ver `LongTaskDiag`.
 */
let observador: PerformanceObserver | null = null;

function ligarObservadorDeTravas() {
  if (observador) return;
  if (typeof PerformanceObserver === "undefined") return;
  try {
    observador = new PerformanceObserver((lista) => {
      let total = estado.longTasks.total;
      let somaMs = estado.longTasks.somaMs;
      let maiorMs = estado.longTasks.maiorMs;
      for (const entrada of lista.getEntries()) {
        total += 1;
        somaMs += entrada.duration;
        if (entrada.duration > maiorMs) maiorMs = entrada.duration;
      }
      estado = {
        ...estado,
        longTasks: {
          disponivel: true,
          total,
          somaMs: Math.round(somaMs),
          maiorMs: Math.round(maiorMs),
        },
      };
      persistir();
    });
    observador.observe({ entryTypes: ["longtask"] });
    estado = { ...estado, longTasks: { ...estado.longTasks, disponivel: true } };
  } catch {
    // `longtask` não é suportado (Safari, Firefox): `disponivel` fica
    // `false`, que é honesto — zero travas seria mentira.
    observador = null;
  }
}

function desligarObservadorDeTravas() {
  try {
    observador?.disconnect();
  } catch {
    // Já desconectado: nada a fazer.
  }
  observador = null;
}

/** Grava o diagnóstico inteiro já — chamado quando o trabalho termina, para
    o que foi medido sobreviver a fechar o app logo depois. */
export function fecharTentativa() {
  desligarObservadorDeTravas();
  persistirAgora();
}

export function registrarTranscricaoChunk(diag: TranscriptChunkDiag) {
  estado = { ...estado, transcricao: [...estado.transcricao, diag] };
  persistir();
}

export function registrarErro(stage: string, erro: unknown) {
  const e = erro instanceof Error ? erro : new Error(String(erro));
  estado = {
    ...estado,
    error: {
      stage,
      name: e.name,
      message: e.message,
      stack: e.stack,
      attempt: estado.attempt,
      timestamp: Date.now(),
    },
  };
  // Sem esperar a janela de escrita: uma falha real costuma ser seguida de
  // a aba morrer (memória) ou de a pessoa fechar o app — e o erro perdido
  // é justamente o que a investigação ia procurar depois.
  persistirAgora();
}

export function limparErro() {
  estado = { ...estado, error: null };
  persistir();
}

export function lerDeviceDiag(): DeviceDiag {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    gpu?: unknown;
  };
  return {
    userAgent: navigator.userAgent,
    deviceMemory: nav.deviceMemory ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    crossOriginIsolated: Boolean(window.crossOriginIsolated),
    sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    webgpu: Boolean(nav.gpu),
    webassembly: typeof WebAssembly !== "undefined",
    onLine: navigator.onLine,
  };
}

export function lerSnapshot(): ListenDiagSnapshot {
  return estado;
}

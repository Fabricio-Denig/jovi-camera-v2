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

function persistir() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    // Cota cheia ou modo privado: o diagnóstico é auxiliar, nunca crítico.
  }
}

/** Uma nova tentativa começa — limpa erro/áudio/inferência anteriores, mas
    mantém o histórico de downloads (o modelo, se já baixado, continua). */
export function iniciarTentativa(): number {
  estado = {
    ...vazio(),
    attempt: estado.attempt + 1,
    downloads: estado.downloads,
  };
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
 */
const amostrasReproduziveis = new Map<
  number,
  { amostras: Float32Array; sampleRate: number }
>();

export function registrarAudioReproduzivel(
  index: number,
  amostras: Float32Array,
  sampleRate: number,
) {
  amostrasReproduziveis.set(index, { amostras, sampleRate });
}

export function obterAudioReproduzivel(
  index: number,
): { amostras: Float32Array; sampleRate: number } | undefined {
  return amostrasReproduziveis.get(index);
}

export function registrarInferencia(patch: Partial<InferenceDiag>) {
  estado = { ...estado, inference: { ...estado.inference, ...patch } };
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
  persistir();
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

/**
 * Blob gravado → PCM que o modelo realmente recebe, num lugar só — e a
 * medição que prova (ou descarta) que a captura em si está com problema
 * antes de culpar o Whisper.
 *
 * **Por que existe.** Um teste físico mostrou a transcrição falhando sem
 * nenhuma prova de que o `MediaRecorder` capturou fala de verdade. Se um
 * segmento tem 15s e RMS quase zero, o defeito é a captura — trocar de motor
 * de STT não resolveria nada. Decodificar o Blob de verdade (não só olhar o
 * tamanho em bytes) é a única forma de distinguir os dois casos.
 *
 * **Por que reaproveitar a técnica da própria biblioteca.** `@huggingface/
 * transformers` decodifica áudio com `new AudioContext({ sampleRate:
 * 16000 }).decodeAudioData(...)` (lido em `load_audio`, dentro de
 * `transformers.web.js`) — o próprio `AudioContext`, quando criado já com a
 * taxa alvo, decodifica E reamostra numa chamada só; não é preciso
 * reimplementar reamostragem à mão. `whisperEngine.ts` usa exatamente a
 * mesma função abaixo para produzir o PCM que envia ao modelo — então o que
 * `?debug=listen` toca e mede é, literalmente, o mesmo Float32Array que a
 * inferência recebe, não uma segunda decodificação por conta própria que
 * poderia divergir.
 */

/** A taxa que o extrator de features do Whisper espera. */
export const TAXA_WHISPER = 16000;

export interface AudioDecodificado {
  amostras: Float32Array;
  sampleRateOriginal: number;
  canaisOriginais: number;
  durationS: number;
}

/**
 * Decodifica um Blob gravado para PCM mono na taxa que o Whisper espera.
 *
 * Lança se o navegador não conseguir decodificar o container (arquivo
 * corrompido, MIME não suportado) — quem chama decide se isso vira
 * `transcriptJobStatus: "falhou"` ou só um aviso no diagnóstico.
 */
export async function decodificarParaWhisper(
  blob: Blob,
): Promise<AudioDecodificado> {
  const buffer = await blob.arrayBuffer();
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) throw new Error("AudioContext indisponível neste navegador");

  // Criar o contexto já na taxa alvo faz o próprio `decodeAudioData`
  // reamostrar — a mesma técnica que a biblioteca usa internamente.
  const ctx = new Ctx({ sampleRate: TAXA_WHISPER });
  let decodificado: AudioBuffer;
  try {
    // Safari mais antigo só aceita a forma com callbacks; a Promise cobre o
    // resto. `decodeAudioData` consome o buffer, então nada aqui pode
    // reaproveitá-lo depois.
    decodificado = await ctx.decodeAudioData(buffer);
  } finally {
    void ctx.close().catch(() => {});
  }

  const sampleRateOriginal = decodificado.sampleRate;
  const canaisOriginais = decodificado.numberOfChannels;
  let amostras: Float32Array;
  if (canaisOriginais === 2) {
    // Mesma fórmula de downmix que `load_audio` usa — mantém a mesma
    // sonoridade percebida entre um segmento mono e um estéreo.
    const ESCALA = Math.SQRT2;
    const esq = decodificado.getChannelData(0);
    const dir = decodificado.getChannelData(1);
    amostras = new Float32Array(esq.length);
    for (let i = 0; i < decodificado.length; i++) {
      amostras[i] = (ESCALA * (esq[i] + dir[i])) / 2;
    }
  } else {
    amostras = decodificado.getChannelData(0).slice();
  }

  return {
    amostras,
    sampleRateOriginal,
    canaisOriginais,
    durationS: decodificado.duration,
  };
}

export interface MedidaAudio {
  durationS: number;
  sampleRate: number;
  frameCount: number;
  peak: number;
  rms: number;
  /** Fração de janelas de 20ms cujo pico fica abaixo do limiar de silêncio. */
  silencioPercent: number;
  /** `true` se alguma amostra for NaN/Infinity — PCM inválido, nunca deve
      seguir para o modelo sem alguém saber. */
  temAmostraInvalida: boolean;
}

const LIMIAR_SILENCIO = 0.01; // ~ -40 dBFS, uma sala silenciosa real bate isso.
const JANELA_MS = 20;

/** Mede um Float32Array já normalizado — o mesmo que vai (ou iria) para o
    modelo. Nunca lança: uma medição malformada é ela mesma um diagnóstico. */
export function medirAmostras(
  amostras: Float32Array,
  sampleRate: number,
): MedidaAudio {
  let peak = 0;
  let somaQuadrados = 0;
  let temInvalida = false;
  for (let i = 0; i < amostras.length; i++) {
    const v = amostras[i];
    if (!Number.isFinite(v)) {
      temInvalida = true;
      continue;
    }
    const abs = Math.abs(v);
    if (abs > peak) peak = abs;
    somaQuadrados += v * v;
  }
  const rms = amostras.length > 0 ? Math.sqrt(somaQuadrados / amostras.length) : 0;

  const janelaAmostras = Math.max(1, Math.round((JANELA_MS / 1000) * sampleRate));
  let janelasSilenciosas = 0;
  let totalJanelas = 0;
  for (let i = 0; i < amostras.length; i += janelaAmostras) {
    totalJanelas++;
    let picoJanela = 0;
    const fim = Math.min(i + janelaAmostras, amostras.length);
    for (let j = i; j < fim; j++) {
      const abs = Math.abs(amostras[j]);
      if (Number.isFinite(abs) && abs > picoJanela) picoJanela = abs;
    }
    if (picoJanela < LIMIAR_SILENCIO) janelasSilenciosas++;
  }

  return {
    durationS: sampleRate > 0 ? amostras.length / sampleRate : 0,
    sampleRate,
    frameCount: amostras.length,
    peak,
    rms,
    silencioPercent: totalJanelas > 0 ? (janelasSilenciosas / totalJanelas) * 100 : 100,
    temAmostraInvalida: temInvalida,
  };
}

/** Um veredito de uma linha, direto do que a medida diz — usado tanto no
    diagnóstico quanto para decidir se vale a pena nem tentar o modelo. */
export function capturaParecaSilenciosa(medida: MedidaAudio): boolean {
  return medida.frameCount === 0 || medida.silencioPercent > 97 || medida.peak < LIMIAR_SILENCIO;
}

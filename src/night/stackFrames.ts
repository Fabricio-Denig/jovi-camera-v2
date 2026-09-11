/**
 * O modo Noite, na única versão honesta que o navegador permite.
 *
 * Um celular faz foto noturna empilhando várias exposições e alinhando-as.
 * Alinhar exige casar características entre quadros, que é o que pediria
 * OpenCV. O que **dá** para fazer sem nada disso é a metade que mais rende:
 * tirar a média de N quadros seguidos.
 *
 * E isso não é aproximação — é o resultado que a estatística garante. O ruído
 * de sensor é aleatório e independente entre quadros; o sinal não é. Somar N
 * quadros e dividir por N mantém o sinal e divide o desvio do ruído por √N.
 * Oito quadros cortam o ruído pela metade, medido, sem inventar um pixel.
 *
 * O que este modo **não** faz, e a tela precisa deixar claro: ele não alinha
 * nada. Celular tremendo na mão borra. É por isso que a instrução na tela é
 * "apoie o celular" — a mesma coisa que o SliD pede, e pelo mesmo motivo.
 *
 * A média também é o limite do que dá para prometer: ela não clareia a cena
 * sozinha, só limpa. O brilho é levantado depois, e separadamente, para que as
 * duas coisas possam ser explicadas e medidas em separado.
 */

/** Quantos quadros cada nível de "tempo de exposição" empilha. */
export const NIVEIS_NOTURNOS = [
  { id: "curto", label: "Curto", quadros: 4, segundos: 0.6 },
  { id: "medio", label: "Médio", quadros: 8, segundos: 1.2 },
  { id: "longo", label: "Longo", quadros: 16, segundos: 2.4 },
] as const;

export type NivelNoturno = (typeof NIVEIS_NOTURNOS)[number]["id"];

export function acharNivel(id: string) {
  return NIVEIS_NOTURNOS.find((n) => n.id === id) ?? NIVEIS_NOTURNOS[1];
}

export interface ResultadoNoturno {
  blob: Blob;
  width: number;
  height: number;
  /** Quantos quadros entraram de fato — pode ser menos se o vídeo travou. */
  quadros: number;
}

/**
 * Empilha N quadros do visor e devolve a média, como JPEG.
 *
 * O acumulador é `Float32Array` e não um canvas: somar dezesseis quadros de
 * oito bits num canvas satura tudo acima de 255 no terceiro quadro. A conta
 * precisa de mais alcance do que um pixel de canvas tem.
 *
 * Os quadros são lidos com `drawImage` a partir do <video> — o mesmo caminho
 * cru que o resto do app usa. Nenhum filtro de tela entra na conta.
 */
export async function empilharQuadros(
  video: HTMLVideoElement,
  quadros: number,
  segundos: number,
  opcoes: {
    /** Multiplicador de brilho aplicado no fim. 1 mantém a exposição. */
    ganho?: number;
    aoProgredir?: (fracao: number) => void;
    sinal?: AbortSignal;
  } = {},
): Promise<ResultadoNoturno> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error("Vídeo sem dimensões.");

  const leitor = document.createElement("canvas");
  leitor.width = w;
  leitor.height = h;
  const ctxLeitor = leitor.getContext("2d", { willReadFrequently: true });
  if (!ctxLeitor) throw new Error("Canvas 2D indisponível.");

  const soma = new Float32Array(w * h * 3);
  const intervalo = (segundos * 1000) / Math.max(1, quadros);
  let usados = 0;

  for (let i = 0; i < quadros; i++) {
    if (opcoes.sinal?.aborted) break;
    ctxLeitor.drawImage(video, 0, 0, w, h);
    const d = ctxLeitor.getImageData(0, 0, w, h).data;
    for (let p = 0, q = 0; p < d.length; p += 4, q += 3) {
      soma[q] += d[p];
      soma[q + 1] += d[p + 1];
      soma[q + 2] += d[p + 2];
    }
    usados++;
    opcoes.aoProgredir?.((i + 1) / quadros);
    // Espera um pouco entre leituras: ler o mesmo quadro decodificado duas
    // vezes somaria o mesmo ruído, e a média de um quadro consigo mesmo é o
    // próprio quadro. O intervalo é o que garante quadros diferentes.
    if (i < quadros - 1) await esperar(intervalo);
  }

  const ganho = opcoes.ganho ?? 1;
  const saida = document.createElement("canvas");
  saida.width = w;
  saida.height = h;
  const ctxSaida = saida.getContext("2d");
  if (!ctxSaida) throw new Error("Canvas 2D indisponível.");
  const imagem = ctxSaida.createImageData(w, h);
  const px = imagem.data;
  for (let p = 0, q = 0; p < px.length; p += 4, q += 3) {
    px[p] = Math.min(255, (soma[q] / usados) * ganho);
    px[p + 1] = Math.min(255, (soma[q + 1] / usados) * ganho);
    px[p + 2] = Math.min(255, (soma[q + 2] / usados) * ganho);
    px[p + 3] = 255;
  }
  ctxSaida.putImageData(imagem, 0, 0);

  const blob = await new Promise<Blob | null>((r) =>
    saida.toBlob(r, "image/jpeg", 0.92),
  );
  if (!blob) throw new Error("Falha ao gerar a imagem.");
  return { blob, width: w, height: h, quadros: usados };
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

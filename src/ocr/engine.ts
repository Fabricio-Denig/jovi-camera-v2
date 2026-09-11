/**
 * O motor de leitura, num lugar só.
 *
 * Dois recursos precisam ler texto de uma imagem — o SliD, que lê os momentos
 * de uma aula quando ela termina, e o Scanner, que lê uma folha quando alguém
 * pede. Antes da camada compartilhada, a configuração do Tesseract estava
 * escrita num lugar; duplicá-la seria garantir que um dia os dois carregariam
 * versões diferentes do mesmo WASM.
 *
 * Os caminhos são todos desta origem, e isso é decisão de produto, não
 * detalhe: o CDN padrão do Tesseract foi medido inalcançável atrás de uma rede
 * restrita, e a leitura é o clímax da demonstração. Ela não pode depender do
 * wi-fi do lugar.
 */

/** Uma página lida, com o quanto o motor confia no que leu. */
export interface LeituraDeImagem {
  text: string;
  confidence: number;
}

/**
 * Cria o trabalhador do Tesseract.
 *
 * A importação é dinâmica de propósito: são cerca de quatro megabytes de
 * runtime, e nenhum deles pode entrar no caminho de abertura da câmera.
 */
export async function criarLeitor() {
  const { createWorker } = await import("tesseract.js");
  return createWorker("por", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/",
    langPath: "/tesseract/",
    gzip: true,
  });
}

/**
 * Lê uma imagem só, do começo ao fim, e desliga o motor.
 *
 * Para o Scanner, que lê uma folha por vez e sob demanda. O SliD não usa esta
 * função porque lê várias imagens de uma vez e um trabalhador por imagem
 * custaria o carregamento do WASM em cada uma.
 */
export async function lerImagem(
  imagem: Blob,
  aoProgredir?: (fracao: number) => void,
): Promise<LeituraDeImagem> {
  let leitor: Awaited<ReturnType<typeof criarLeitor>> | null = null;
  try {
    aoProgredir?.(0.1);
    leitor = await criarLeitor();
    aoProgredir?.(0.4);
    const { data } = await leitor.recognize(imagem);
    aoProgredir?.(1);
    return { text: data.text.trim(), confidence: data.confidence ?? 0 };
  } finally {
    await leitor?.terminate().catch(() => {});
  }
}

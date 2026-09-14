import type { ContentBounds } from "../slid/frameAnalysis";
import { canvasSupportsFilter } from "../camera/filters";

/**
 * O arquivo final do documento: a captura recortada na região e com a
 * aparência escolhida queimada dentro.
 *
 * A aparência é aplicada aqui e não só no CSS do preview porque o que vai para
 * a galeria precisa ser o que a pessoa viu. Onde o navegador não souber
 * desenhar com filtro no canvas, o recorte é feito assim mesmo e a imagem sai
 * sem tratamento — documento recortado sem filtro ainda é útil; falhar em
 * salvar não é.
 */
export async function renderDocument(
  origem: Blob,
  crop: ContentBounds,
  filtroCss: string,
  /**
   * O maior lado, em pixels, quando quem chama não precisa da resolução
   * cheia — a leitura de texto, não o arquivo salvo. Uma foto de 12 MP
   * recortada ainda tem milhões de pixels, e o Tesseract não lê melhor com
   * eles: a letra de uma folha já está nítida bem abaixo disso, e cada pixel
   * a mais é só mais tempo de reconhecimento no processador do celular.
   * Omitido, a imagem sai na resolução do recorte — o que `ScannerReview`
   * precisa para salvar o documento sem perder qualidade.
   */
  opcoes?: { maxLado?: number },
): Promise<Blob> {
  const bitmap = await createImageBitmap(origem);
  const sx = Math.round(crop.x * bitmap.width);
  const sy = Math.round(crop.y * bitmap.height);
  const sw = Math.max(1, Math.round(crop.width * bitmap.width));
  const sh = Math.max(1, Math.round(crop.height * bitmap.height));

  const maxLado = opcoes?.maxLado;
  const maiorLado = Math.max(sw, sh);
  const escala = maxLado && maiorLado > maxLado ? maxLado / maiorLado : 1;
  const dw = Math.max(1, Math.round(sw * escala));
  const dh = Math.max(1, Math.round(sh * escala));

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return origem;
  }
  if (filtroCss !== "none" && canvasSupportsFilter()) ctx.filter = filtroCss;
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh);
  ctx.filter = "none";
  bitmap.close();

  return new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob && blob.size > 0 ? blob : origem),
      "image/jpeg",
      0.92,
    );
  });
}

/** O recorte padrão quando não houve detecção: uma margem conservadora. */
export const CROP_PADRAO: ContentBounds = {
  x: 0.06,
  y: 0.06,
  width: 0.88,
  height: 0.88,
};

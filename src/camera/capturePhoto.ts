/**
 * Draws the current video frame onto an offscreen canvas and exports it as a JPEG blob.
 *
 * The dimension guard is not defensive noise: if the preview never attached, the
 * element reports 0×0 and canvas.toBlob would hand back an unusable image with no
 * error of its own. Failing loudly here surfaces the real problem instead.
 */
export function capturePhotoFromVideo(
  video: HTMLVideoElement,
  options: {
    mirrored?: boolean;
    zoom?: number;
    /** A janela da proporção escolhida, em frações do quadro. */
    window?: { x: number; y: number; width: number; height: number };
  } = {},
): Promise<{ blob: Blob; width: number; height: number }> {
  const frameWidth = video.videoWidth;
  const frameHeight = video.videoHeight;
  const janela = options.window ?? { x: 0, y: 0, width: 1, height: 1 };
  const width = Math.round(frameWidth * janela.width);
  const height = Math.round(frameHeight * janela.height);

  if (!frameWidth || !frameHeight || !width || !height) {
    return Promise.reject(
      new Error(
        `Vídeo sem dimensões (${frameWidth}×${frameHeight}) — o preview ainda não está ativo.`,
      ),
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new Error("Canvas 2D context indisponível."));
  }

  // The front camera preview is mirrored on screen, so the saved photo is
  // mirrored too — otherwise the picture doesn't match what the user just saw.
  if (options.mirrored) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  // Digital zoom crops the middle and fills the frame with it, so the saved
  // photo holds what the viewfinder was showing. At 1x — and whenever the
  // hardware did the zooming itself — this is the whole frame, unchanged.
  // Recorte digital e proporção são o mesmo gesto: uma janela dentro do quadro.
  // A do zoom é sempre central; a da proporção vem de fora.
  const zoom = Math.max(1, options.zoom ?? 1);
  const sw = (frameWidth * janela.width) / zoom;
  const sh = (frameHeight * janela.height) / zoom;
  const sx = frameWidth * janela.x + (frameWidth * janela.width - sw) / 2;
  const sy = frameHeight * janela.y + (frameHeight * janela.height - sh) / 2;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob && blob.size > 0) resolve({ blob, width, height });
        else reject(new Error("Falha ao gerar a imagem."));
      },
      "image/jpeg",
      0.92,
    );
  });
}

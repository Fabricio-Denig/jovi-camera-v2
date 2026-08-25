/**
 * Draws the current video frame onto an offscreen canvas and exports it as a JPEG blob.
 *
 * The dimension guard is not defensive noise: if the preview never attached, the
 * element reports 0×0 and canvas.toBlob would hand back an unusable image with no
 * error of its own. Failing loudly here surfaces the real problem instead.
 */
export function capturePhotoFromVideo(
  video: HTMLVideoElement,
  options: { mirrored?: boolean } = {},
): Promise<{ blob: Blob; width: number; height: number }> {
  const width = video.videoWidth;
  const height = video.videoHeight;

  if (!width || !height) {
    return Promise.reject(
      new Error(
        `Vídeo sem dimensões (${width}×${height}) — o preview ainda não está ativo.`,
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
  ctx.drawImage(video, 0, 0, width, height);

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

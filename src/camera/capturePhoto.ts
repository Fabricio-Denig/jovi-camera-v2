/** Draws the current video frame onto an offscreen canvas and exports it as a JPEG blob. */
export function capturePhotoFromVideo(
  video: HTMLVideoElement,
): Promise<{ blob: Blob; width: number; height: number }> {
  const width = video.videoWidth;
  const height = video.videoHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new Error("Canvas 2D context indisponível."));
  }
  ctx.drawImage(video, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve({ blob, width, height });
        else reject(new Error("Falha ao gerar a imagem."));
      },
      "image/jpeg",
      0.92,
    );
  });
}

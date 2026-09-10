import type { RefObject } from "react";
import type { CameraFacing } from "../types/camera";

interface ViewfinderProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  facing: CameraFacing;
  /** The crop the preview applies itself, when the hardware could not. */
  zoom?: number;
  /** O filtro escolhido, em CSS. Não toca no que o SliD analisa. */
  filter?: string;
  /**
   * O efeito "Tremor": um balanço leve do próprio visor.
   *
   * Ele anima `translate`, `rotate` e `scale` — propriedades independentes do
   * `transform` — porque o espelho e o zoom já ocupam o `transform`, e uma
   * animação vence o estilo em linha. Animar as duas coisas na mesma
   * propriedade apagaria o espelho da câmera frontal a cada quadro.
   */
  shaking?: boolean;
}

/** The live camera preview. Mirrored on the front camera, matching the convention every phone camera follows. */
export function Viewfinder({
  videoRef,
  facing,
  zoom = 1,
  filter,
  shaking = false,
}: ViewfinderProps) {
  const parts = [
    facing === "user" ? "scaleX(-1)" : "",
    zoom > 1 ? `scale(${zoom})` : "",
  ].filter(Boolean);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={`absolute inset-0 size-full object-cover transition-transform duration-300 ease-out${
        shaking ? " animate-[slid-tremor_1400ms_ease-in-out_infinite]" : ""
      }`}
      style={{
        transform: parts.length ? parts.join(" ") : undefined,
        filter: filter && filter !== "none" ? filter : undefined,
      }}
    />
  );
}

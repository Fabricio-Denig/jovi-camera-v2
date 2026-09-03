import type { RefObject } from "react";
import type { CameraFacing } from "../types/camera";

interface ViewfinderProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  facing: CameraFacing;
  /** The crop the preview applies itself, when the hardware could not. */
  zoom?: number;
  /** O filtro escolhido, em CSS. Não toca no que o SliD analisa. */
  filter?: string;
}

/** The live camera preview. Mirrored on the front camera, matching the convention every phone camera follows. */
export function Viewfinder({ videoRef, facing, zoom = 1, filter }: ViewfinderProps) {
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
      className="absolute inset-0 size-full object-cover transition-transform duration-300 ease-out"
      style={{
        transform: parts.length ? parts.join(" ") : undefined,
        filter: filter && filter !== "none" ? filter : undefined,
      }}
    />
  );
}

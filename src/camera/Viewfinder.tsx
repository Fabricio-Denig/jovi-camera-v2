import type { RefObject } from "react";
import type { CameraFacing } from "../types/camera";

interface ViewfinderProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  facing: CameraFacing;
}

/** The live camera preview. Mirrored on the front camera, matching the convention every phone camera follows. */
export function Viewfinder({ videoRef, facing }: ViewfinderProps) {
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="absolute inset-0 size-full object-cover"
      style={facing === "user" ? { transform: "scaleX(-1)" } : undefined}
    />
  );
}

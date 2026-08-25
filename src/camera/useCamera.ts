import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraFacing, CameraStatus } from "../types/camera";

interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  facing: CameraFacing;
  errorMessage: string | null;
  stream: MediaStream | null;
  requestCamera: () => void;
  switchFacing: () => void;
  canSwitchFacing: boolean;
}

/**
 * Owns the getUserMedia lifecycle: requesting permission, attaching the
 * stream to a <video>, and switching between front/back camera by fully
 * re-acquiring the stream (facingMode can't be changed on a live track on
 * most mobile browsers, so swap = stop old tracks + getUserMedia again).
 */
export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [facing, setFacing] = useState<CameraFacing>("environment");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [canSwitchFacing, setCanSwitchFacing] = useState(true);

  const stopCurrentStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const acquireStream = useCallback(async (targetFacing: CameraFacing) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setErrorMessage("Este navegador não suporta acesso à câmera.");
      return;
    }

    setStatus("requesting");
    setErrorMessage(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: targetFacing },
        audio: true,
      });

      stopCurrentStream();
      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setFacing(targetFacing);
      setStatus("ready");

      // Devices with a single camera (most laptops/desktops) shouldn't offer a flip control.
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setCanSwitchFacing(videoInputs.length > 1);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "Unknown";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setStatus("denied");
        setErrorMessage("Permissão de câmera negada.");
      } else if (name === "NotFoundError") {
        setStatus("unsupported");
        setErrorMessage("Nenhuma câmera encontrada neste dispositivo.");
      } else {
        setStatus("error");
        setErrorMessage("Não foi possível acessar a câmera.");
      }
    }
  }, [stopCurrentStream]);

  const requestCamera = useCallback(() => {
    void acquireStream(facing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acquireStream]);

  const switchFacing = useCallback(() => {
    if (status !== "ready") return;
    void acquireStream(facing === "environment" ? "user" : "environment");
  }, [acquireStream, facing, status]);

  useEffect(() => stopCurrentStream, [stopCurrentStream]);

  return {
    videoRef,
    status,
    facing,
    errorMessage,
    stream,
    requestCamera,
    switchFacing,
    canSwitchFacing,
  };
}

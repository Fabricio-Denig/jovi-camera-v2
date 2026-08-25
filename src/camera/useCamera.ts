import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraFacing, CameraStatus } from "../types/camera";

export interface CameraDiagnostics {
  log: string[];
  trackCount: number;
  trackState: string;
  trackLabel: string;
  appliedFacing: string;
  videoSize: string;
  readyState: number;
  paused: boolean;
  hasAudio: boolean;
}

interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  facing: CameraFacing;
  errorMessage: string | null;
  stream: MediaStream | null;
  requestCamera: () => void;
  switchFacing: () => void;
  canSwitchFacing: boolean;
  isSwitching: boolean;
  diagnostics: CameraDiagnostics;
}

const MAX_LOG_LINES = 14;

/**
 * Owns the getUserMedia lifecycle.
 *
 * Two rules here exist because breaking either one produces a black preview on
 * a real device:
 *
 * 1. The stream is attached to the <video> from an effect, never from inside
 *    the async getUserMedia callback. When the promise resolves the element may
 *    not be mounted yet, and assigning srcObject to a null ref is a silent no-op.
 * 2. The caller must keep the <video> mounted across every status change.
 *    Unmounting it while switching cameras drops the ref and loses the stream.
 */
export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const acquiringRef = useRef(false);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [facing, setFacing] = useState<CameraFacing>("environment");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [canSwitchFacing, setCanSwitchFacing] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);

  const [log, setLog] = useState<string[]>([]);
  const [videoSize, setVideoSize] = useState("—");
  const [readyState, setReadyState] = useState(0);
  const [paused, setPaused] = useState(true);

  const addLog = useCallback((line: string) => {
    const stamp = new Date().toLocaleTimeString("pt-BR", { hour12: false });
    setLog((prev) => [...prev.slice(-(MAX_LOG_LINES - 1)), `${stamp} ${line}`]);
  }, []);

  const stopCurrentStream = useCallback(() => {
    const current = streamRef.current;
    if (!current) return;
    current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const acquireStream = useCallback(
    async (targetFacing: CameraFacing) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        setErrorMessage(
          "Este navegador não expõe a API de câmera. Em iOS, use o Safari; a câmera também exige HTTPS.",
        );
        addLog("ERRO: mediaDevices.getUserMedia indisponível");
        return;
      }

      // StrictMode fires effects twice in development, and a double tap on the
      // flip control can also land here twice. Two concurrent getUserMedia calls
      // fight over the same hardware, so only one runs at a time.
      if (acquiringRef.current) {
        addLog("ignorado: aquisição já em andamento");
        return;
      }
      acquiringRef.current = true;

      setStatus("requesting");
      setErrorMessage(null);
      addLog(`solicitando câmera (${targetFacing})`);

      // Release the current camera before asking for the other one: many Android
      // devices cannot hold the front and back cameras open at the same time.
      stopCurrentStream();

      // Audio is requested separately from video. Asking for both at once means a
      // denied microphone (or a busy audio device) fails the whole call and kills
      // the preview — video must never depend on audio being available.
      let mediaStream: MediaStream | null = null;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: targetFacing } },
          audio: false,
        });
        addLog("stream de vídeo obtido");
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "Erro";
        addLog(`FALHA getUserMedia: ${name}`);
        acquiringRef.current = false;

        if (name === "NotAllowedError" || name === "SecurityError") {
          setStatus("denied");
          setErrorMessage(
            "Permissão de câmera negada. Autorize o acesso nas configurações do site e tente novamente.",
          );
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setStatus("unsupported");
          setErrorMessage("Nenhuma câmera encontrada neste dispositivo.");
        } else if (name === "NotReadableError") {
          setStatus("error");
          setErrorMessage(
            "A câmera está em uso por outro aplicativo. Feche-o e tente novamente.",
          );
        } else {
          setStatus("error");
          setErrorMessage(`Não foi possível acessar a câmera (${name}).`);
        }
        return;
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setFacing(targetFacing);
      setStatus("ready");
      acquiringRef.current = false;

      const [videoTrack] = mediaStream.getVideoTracks();
      if (videoTrack) {
        addLog(`track: ${videoTrack.label || "sem rótulo"}`);
      }

      // enumerateDevices only returns real labels once permission is granted,
      // so this runs after the stream is live.
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        setCanSwitchFacing(videoInputs.length > 1);
        addLog(`câmeras detectadas: ${videoInputs.length}`);
      } catch {
        // If enumeration fails, keep the flip control available rather than
        // hiding a feature that probably works.
        setCanSwitchFacing(true);
      }
    },
    [addLog, stopCurrentStream],
  );

  const requestCamera = useCallback(() => {
    void acquireStream(facing);
  }, [acquireStream, facing]);

  const switchFacing = useCallback(async () => {
    if (acquiringRef.current) return;
    setIsSwitching(true);
    await acquireStream(facing === "environment" ? "user" : "environment");
    setIsSwitching(false);
  }, [acquireStream, facing]);

  // Attaching the stream from an effect is what makes the preview work: it runs
  // after render, so the <video> is guaranteed to be in the DOM.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;

    const handleLoadedMetadata = () => {
      setVideoSize(`${video.videoWidth}×${video.videoHeight}`);
      setReadyState(video.readyState);
      addLog(`loadedmetadata ${video.videoWidth}×${video.videoHeight}`);
    };
    const handlePlaying = () => {
      setPaused(false);
      setReadyState(video.readyState);
      addLog("playing");
    };
    const handleCanPlay = () => {
      setReadyState(video.readyState);
      addLog("canplay");
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("playing", handlePlaying);

    // iOS Safari does not reliably honour the autoplay attribute for a live
    // stream; calling play() explicitly is what actually starts the preview.
    video.play().catch((error: unknown) => {
      const name = error instanceof DOMException ? error.name : "Erro";
      addLog(`play() rejeitado: ${name}`);
      setPaused(true);
    });

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("playing", handlePlaying);
    };
  }, [stream, addLog]);

  useEffect(() => stopCurrentStream, [stopCurrentStream]);

  const videoTrack = stream?.getVideoTracks()[0];

  return {
    videoRef,
    status,
    facing,
    errorMessage,
    stream,
    requestCamera,
    switchFacing,
    canSwitchFacing,
    isSwitching,
    diagnostics: {
      log,
      trackCount: stream?.getTracks().length ?? 0,
      trackState: videoTrack?.readyState ?? "—",
      trackLabel: videoTrack?.label || "—",
      appliedFacing:
        (videoTrack?.getSettings().facingMode as string | undefined) ?? "—",
      videoSize,
      readyState,
      paused,
      hasAudio: (stream?.getAudioTracks().length ?? 0) > 0,
    },
  };
}

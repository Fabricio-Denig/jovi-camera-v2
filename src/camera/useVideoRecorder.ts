import { useCallback, useRef, useState } from "react";

const CANDIDATE_MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

function pickSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return (
    CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ??
    null
  );
}

interface UseVideoRecorderResult {
  isRecording: boolean;
  isSupported: boolean;
  elapsedMs: number;
  start: () => void;
  stop: () => Promise<{ blob: Blob; mimeType: string } | null>;
}

/**
 * Thin wrapper around MediaRecorder: feature-detects a supported mimeType
 * (codec support differs across Android Chrome / iOS Safari), buffers chunks
 * in memory, and resolves a single Blob when recording stops.
 */
export function useVideoRecorder(
  stream: MediaStream | null,
): UseVideoRecorderResult {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeTypeRef = useRef<string>("video/webm");
  const startedAtRef = useRef<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isSupported =
    typeof MediaRecorder !== "undefined" && pickSupportedMimeType() !== null;

  const start = useCallback(() => {
    if (!stream || !isSupported || isRecording) return;
    const mimeType = pickSupportedMimeType();
    if (!mimeType) return;

    mimeTypeRef.current = mimeType;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.start();
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setIsRecording(true);

    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 250);
  }, [stream, isSupported, isRecording]);

  const stop = useCallback((): Promise<{
    blob: Blob;
    mimeType: string;
  } | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setIsRecording(false);
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      recorder.onstop = () => {
        if (tickRef.current) clearInterval(tickRef.current);
        setIsRecording(false);
        const blob = new Blob(chunksRef.current, {
          type: mimeTypeRef.current,
        });
        chunksRef.current = [];
        resolve({ blob, mimeType: mimeTypeRef.current });
      };
      recorder.stop();
    });
  }, []);

  return { isRecording, isSupported, elapsedMs, start, stop };
}

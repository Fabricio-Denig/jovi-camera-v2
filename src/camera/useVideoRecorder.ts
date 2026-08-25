import { useCallback, useRef, useState } from "react";

const CANDIDATE_MIME_TYPES = [
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
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
  start: () => Promise<void>;
  stop: () => Promise<{ blob: Blob; mimeType: string } | null>;
}

/**
 * Wraps MediaRecorder around the live camera stream.
 *
 * Audio is acquired here rather than with the preview stream: requesting the
 * microphone up front means a denied mic permission would take the whole camera
 * down with it. Recording without sound is a far better failure than no preview.
 */
export function useVideoRecorder(
  stream: MediaStream | null,
  onLog?: (line: string) => void,
): UseVideoRecorderResult {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeTypeRef = useRef<string>("video/webm");
  const audioTracksRef = useRef<MediaStreamTrack[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const isSupported =
    typeof MediaRecorder !== "undefined" && pickSupportedMimeType() !== null;

  const stopAudioTracks = useCallback(() => {
    audioTracksRef.current.forEach((track) => track.stop());
    audioTracksRef.current = [];
  }, []);

  const start = useCallback(async () => {
    if (!stream || !isSupported || isRecording) return;
    const mimeType = pickSupportedMimeType();
    if (!mimeType) return;

    const tracks: MediaStreamTrack[] = [...stream.getVideoTracks()];

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      audioTracksRef.current = audioStream.getAudioTracks();
      tracks.push(...audioTracksRef.current);
      onLog?.("áudio capturado para a gravação");
    } catch {
      onLog?.("sem áudio — gravando somente vídeo");
    }

    const recordingStream = new MediaStream(tracks);
    mimeTypeRef.current = mimeType;
    chunksRef.current = [];

    const recorder = new MediaRecorder(recordingStream, { mimeType });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    // Without a timeslice some browsers only flush at stop(); asking for periodic
    // chunks keeps data flowing and avoids losing a long take.
    recorder.start(1000);
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setIsRecording(true);
    onLog?.(`gravando (${mimeType})`);

    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 250);
  }, [stream, isSupported, isRecording, onLog]);

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
        stopAudioTracks();
        setIsRecording(false);
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        chunksRef.current = [];
        onLog?.(`gravação finalizada: ${Math.round(blob.size / 1024)} KB`);
        resolve({ blob, mimeType: mimeTypeRef.current });
      };
      recorder.stop();
    });
  }, [onLog, stopAudioTracks]);

  return { isRecording, isSupported, elapsedMs, start, stop };
}

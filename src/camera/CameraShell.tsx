import { useEffect, useState } from "react";
import { capturePhotoFromVideo } from "./capturePhoto";
import { CaptureModeToggle } from "./CaptureModeToggle";
import { CaptureThumb } from "./CaptureThumb";
import { CaptureViewer } from "./CaptureViewer";
import { PermissionGate } from "./PermissionGate";
import { ShutterButton } from "./ShutterButton";
import { TopBar } from "./TopBar";
import { useCamera } from "./useCamera";
import { useVideoRecorder } from "./useVideoRecorder";
import { Viewfinder } from "./Viewfinder";
import { getLatestCapture, saveCapture } from "../shared/lib/mediaStore";
import type { CaptureKind, CapturedMedia } from "../types/camera";

/** Top-level camera screen: wires permission, preview, capture and local persistence together. */
export function CameraShell() {
  const {
    videoRef,
    status,
    facing,
    errorMessage,
    stream,
    requestCamera,
    switchFacing,
    canSwitchFacing,
  } = useCamera();
  const recorder = useVideoRecorder(stream);

  const [mode, setMode] = useState<CaptureKind>("photo");
  const [lastCapture, setLastCapture] = useState<CapturedMedia | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Request the camera as soon as the screen mounts — the explanation lives
  // in PermissionGate, this just starts the flow immediately.
  useEffect(() => {
    requestCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Proves persistence works across reloads: the last capture made in a
  // previous session is already visible as soon as the app opens.
  useEffect(() => {
    void getLatestCapture().then((media) => {
      if (media) setLastCapture(media);
    });
  }, []);

  async function persist(media: CapturedMedia) {
    setIsSaving(true);
    await saveCapture(media);
    setLastCapture(media);
    setIsSaving(false);
  }

  async function handleShutterPress() {
    if (mode === "photo") {
      if (!videoRef.current) return;
      const { blob, width, height } = await capturePhotoFromVideo(
        videoRef.current,
      );
      await persist({
        id: crypto.randomUUID(),
        kind: "photo",
        blob,
        mimeType: blob.type,
        createdAt: Date.now(),
        width,
        height,
      });
      return;
    }

    if (!recorder.isRecording) {
      recorder.start();
      return;
    }

    const result = await recorder.stop();
    if (result) {
      await persist({
        id: crypto.randomUUID(),
        kind: "video",
        blob: result.blob,
        mimeType: result.mimeType,
        createdAt: Date.now(),
        width: videoRef.current?.videoWidth ?? 0,
        height: videoRef.current?.videoHeight ?? 0,
      });
    }
  }

  if (status !== "ready") {
    return (
      <PermissionGate
        status={status}
        errorMessage={errorMessage}
        onRequest={requestCamera}
      />
    );
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-black">
      <Viewfinder videoRef={videoRef} facing={facing} />

      <TopBar
        canSwitchFacing={canSwitchFacing}
        onSwitchFacing={switchFacing}
        isRecording={recorder.isRecording}
        elapsedMs={recorder.elapsedMs}
      />

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-5 pb-[max(28px,env(safe-area-inset-bottom))]">
        <CaptureModeToggle
          mode={mode}
          onChange={setMode}
          disabled={recorder.isRecording}
        />

        <div className="grid w-full grid-cols-3 items-center px-8">
          <CaptureThumb
            media={lastCapture}
            onOpen={() => setViewerOpen(true)}
          />
          <div className="flex justify-center">
            <ShutterButton
              mode={mode}
              isRecording={recorder.isRecording}
              onPress={handleShutterPress}
            />
          </div>
          <div />
        </div>

        {isSaving && (
          <span className="font-mono text-[11px] text-white/60">
            salvando…
          </span>
        )}
        {mode === "video" && !recorder.isSupported && (
          <span className="max-w-[80%] text-center font-mono text-[11px] text-warn">
            Gravação de vídeo não é suportada neste navegador.
          </span>
        )}
      </div>

      {viewerOpen && lastCapture && (
        <CaptureViewer
          media={lastCapture}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}

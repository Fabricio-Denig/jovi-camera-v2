import { useEffect, useState } from "react";
import { capturePhotoFromVideo } from "./capturePhoto";
import { CaptureThumb } from "./CaptureThumb";
import { CaptureViewer } from "./CaptureViewer";
import { DebugPanel } from "./DebugPanel";
import { ModeTabs } from "./ModeTabs";
import { PermissionGate } from "./PermissionGate";
import { ShutterButton } from "./ShutterButton";
import { TopBar } from "./TopBar";
import { useCamera } from "./useCamera";
import { useVideoRecorder } from "./useVideoRecorder";
import { Viewfinder } from "./Viewfinder";
import { getMode } from "../modes/modes";
import { getLatestCapture, saveCapture } from "../shared/lib/mediaStore";
import type { CapturedMedia } from "../types/camera";

/** Diagnostics stay out of the demo but remain one query param away if the camera misbehaves on stage. */
const debugEnabled = new URLSearchParams(window.location.search).has("debug");

interface CameraShellProps {
  modeId: string;
  onSelectMode: (modeId: string) => void;
  onOpenModes: () => void;
  onCaptureSaved: () => void;
}

/** The camera screen: permission, preview, capture and local persistence. */
export function CameraShell({
  modeId,
  onSelectMode,
  onOpenModes,
  onCaptureSaved,
}: CameraShellProps) {
  const {
    videoRef,
    status,
    facing,
    errorMessage,
    stream,
    requestCamera,
    switchFacing,
    canSwitchFacing,
    isSwitching,
    diagnostics,
  } = useCamera();
  const recorder = useVideoRecorder(stream);

  const mode = getMode(modeId);
  const [lastCapture, setLastCapture] = useState<CapturedMedia | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  useEffect(() => {
    requestCamera();
    // Runs once on mount. requestCamera is stable enough for this purpose and
    // re-running on its identity would re-acquire the camera on every render.
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
    try {
      await saveCapture(media);
      setLastCapture(media);
      onCaptureSaved();
    } catch {
      setCaptureError("Não foi possível salvar a captura no dispositivo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleShutterPress() {
    setCaptureError(null);
    try {
      if (mode.kind === "photo") {
        if (!videoRef.current) return;
        const { blob, width, height } = await capturePhotoFromVideo(
          videoRef.current,
          { mirrored: facing === "user" },
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
        await recorder.start();
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
    } catch (error) {
      setCaptureError(
        error instanceof Error ? error.message : "Falha ao capturar.",
      );
    }
  }

  const isReady = status === "ready";

  return (
    <div className="relative size-full overflow-hidden bg-black">
      {/* Mounted unconditionally: the stream is attached to this element from an
          effect, so unmounting it on a status change would silently drop the
          preview and leave a black screen. */}
      <Viewfinder videoRef={videoRef} facing={facing} />

      {!isReady && (
        <PermissionGate
          status={status}
          errorMessage={errorMessage}
          onRequest={requestCamera}
        />
      )}

      {debugEnabled && (
        <DebugPanel
          status={status}
          facing={facing}
          diagnostics={diagnostics}
          lastError={captureError ?? errorMessage}
        />
      )}

      {isReady && (
        <>
          <TopBar
            canSwitchFacing={canSwitchFacing}
            onSwitchFacing={switchFacing}
            isRecording={recorder.isRecording}
            elapsedMs={recorder.elapsedMs}
            isSwitching={isSwitching}
          />

          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-5 pb-6">
            <ModeTabs
              modeId={modeId}
              onSelect={onSelectMode}
              onOpenCatalog={onOpenModes}
              disabled={recorder.isRecording}
            />

            <div className="grid w-full grid-cols-3 items-center px-8">
              <CaptureThumb
                media={lastCapture}
                onOpen={() => setViewerOpen(true)}
              />
              <div className="flex justify-center">
                <ShutterButton
                  mode={mode.kind}
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
            {captureError && (
              <span className="max-w-[85%] text-center font-mono text-[11px] text-danger">
                {captureError}
              </span>
            )}
            {mode.kind === "video" && !recorder.isSupported && (
              <span className="max-w-[80%] text-center font-mono text-[11px] text-warn">
                Gravação de vídeo não é suportada neste navegador.
              </span>
            )}
          </div>
        </>
      )}

      {viewerOpen && lastCapture && (
        <CaptureViewer
          media={lastCapture}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}

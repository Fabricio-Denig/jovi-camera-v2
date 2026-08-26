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
import { ModePreviewCard } from "../modes/ModePreviewCard";
import { getMode } from "../modes/modes";
import { ContentFrame } from "../slid/ContentFrame";
import { SlidOverlay } from "../slid/SlidOverlay";
import { SlidSuggestion } from "../slid/SlidSuggestion";
import { SlidSummary } from "../slid/SlidSummary";
import { useSlidSession } from "../slid/useSlidSession";
import { getLatestCapture, saveCapture } from "../shared/lib/mediaStore";
import type { CapturedMedia } from "../types/camera";

/** Diagnostics stay out of the demo but remain one query param away if the camera misbehaves on stage. */
const debugEnabled = new URLSearchParams(window.location.search).has("debug");

interface CameraShellProps {
  modeId: string;
  onSelectMode: (modeId: string) => void;
  onOpenModes: () => void;
  onCaptureSaved: () => void;
  /** Lets the shell surface the same suggestion inside the mode catalog. */
  onBoardDetected: (detected: boolean) => void;
  onOpenClass: (classId: string) => void;
  onOpenGallery: () => void;
}

/** The camera screen: permission, preview, capture and local persistence. */
export function CameraShell({
  modeId,
  onSelectMode,
  onOpenModes,
  onCaptureSaved,
  onBoardDetected,
  onOpenClass,
  onOpenGallery,
}: CameraShellProps) {
  const {
    videoRef,
    status,
    facing,
    errorMessage,
    stream,
    requestCamera,
    switchFacing,
    selectFacing,
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
  const [savedClass, setSavedClass] = useState<{
    id: string;
    subject: string;
  } | null>(null);

  const isSlid = mode.id === "slid";
  const slid = useSlidSession({
    videoRef,
    // Only look for a board when the suggestion could actually be acted on.
    detectionEnabled: status === "ready" && !isSlid && mode.fidelity === "real",
  });

  useEffect(() => {
    onBoardDetected(slid.boardDetected);
  }, [slid.boardDetected, onBoardDetected]);

  // Entering SliD from the mode bar starts the session directly, so the mode
  // and the session never disagree about what is happening.
  useEffect(() => {
    if (isSlid && slid.status === "idle") {
      // SliD is used with the phone propped up facing the class. Inheriting the
      // selfie camera from whichever mode came before points it at the student,
      // which is the one thing this mode must never do.
      selectFacing("environment");
      slid.start();
    }
    if (!isSlid && slid.status !== "idle" && slid.status !== "finished") {
      slid.finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSlid]);

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
      // Inside a session the shutter forces a capture — the student decides
      // something matters even when the board hasn't changed.
      if (isSlid) {
        await slid.captureManually();
        return;
      }

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

      {/* The detection is drawn on the thing it detected, so the claim can be
          checked instead of believed. */}
      {isReady && slid.boardDetected && !isSlid && (
        <ContentFrame
          bounds={slid.contentBounds}
          videoRef={videoRef}
          facing={facing}
          label="Conteúdo identificado"
        />
      )}

      {isReady && isSlid && slid.status === "running" && (
        <ContentFrame
          bounds={slid.contentBounds}
          videoRef={videoRef}
          facing={facing}
        />
      )}

      {isReady && slid.boardDetected && !isSlid && (
        <SlidSuggestion
          onAccept={() => onSelectMode("slid")}
          onDismiss={slid.dismissSuggestion}
        />
      )}

      {isReady && !isSlid && mode.fidelity === "simulated" && (
        <ModePreviewCard mode={mode} onBack={() => onSelectMode("photo")} />
      )}

      {isReady && isSlid && slid.status !== "finished" && (
        <SlidOverlay
          status={slid.status}
          sceneReady={slid.sceneReady}
          captures={slid.captures}
          lastMoment={slid.lastMoment}
          elapsedMs={slid.elapsedMs}
          canSwitchFacing={canSwitchFacing}
          isSwitching={isSwitching}
          onSwitchFacing={switchFacing}
          onMarkMoment={() => void slid.captureManually()}
          onPause={slid.pause}
          onResume={slid.resume}
          onFinish={slid.finish}
        />
      )}

      {isSlid && slid.status === "finished" && (
        <SlidSummary
          captures={slid.captures}
          stats={slid.stats}
          elapsedMs={slid.elapsedMs}
          onSave={async ({ subject, moments, topics }) => {
            const sessionId = crypto.randomUUID();
            const savedAt = Date.now();
            const described = new Map(moments.map((m) => [m.id, m]));
            for (const capture of slid.captures) {
              await saveCapture({
                id: capture.id,
                kind: "photo",
                blob: capture.blob,
                mimeType: capture.blob.type,
                createdAt: savedAt,
                width: videoRef.current?.videoWidth ?? 0,
                height: videoRef.current?.videoHeight ?? 0,
                session: {
                  id: sessionId,
                  subject,
                  atMs: capture.atMs,
                  // Stored so the class reads the same months later, without
                  // ever going back to the images.
                  label: described.get(capture.id)?.label,
                  detail: described.get(capture.id)?.detail ?? null,
                  durationMs: slid.elapsedMs,
                  skippedDuplicates: slid.stats.skippedDuplicates,
                  savedAt,
                  topics,
                },
              });
            }
            onCaptureSaved();
            slid.reset();
            onSelectMode("photo");
            // Saving a class ends in the place classes live. The confirmation
            // still points at this one, so it is never lost in the grid.
            onOpenGallery();
            setSavedClass({ id: sessionId, subject });
            setTimeout(() => setSavedClass(null), 5000);
          }}
          onDiscard={() => {
            slid.reset();
            onSelectMode("photo");
          }}
        />
      )}

      {isReady && !isSlid && (
        <>
          <TopBar
            canSwitchFacing={canSwitchFacing}
            onSwitchFacing={switchFacing}
            isRecording={recorder.isRecording}
            elapsedMs={recorder.elapsedMs}
            isSwitching={isSwitching}
          />

          {/* Scrim behind the controls: white text over a bright scene — a
              whiteboard, a sunlit wall — is otherwise unreadable, and the
              whiteboard is exactly where SliD is used. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-56 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />

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
                  disabled={mode.fidelity === "simulated"}
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

      {savedClass && (
        <div className="absolute inset-x-0 top-0 z-40 flex justify-center pt-[max(70px,calc(env(safe-area-inset-top)+54px))]">
          {/* Saving a class and then hiding it is the moment a student decides
              the app forgot. The way in is the confirmation itself. */}
          <button
            type="button"
            onClick={() => {
              onOpenClass(savedClass.id);
              setSavedClass(null);
            }}
            className="flex min-h-11 animate-[slid-rise_240ms_ease-out] items-center gap-2 rounded-full bg-accent px-4 py-2 text-[12.5px] font-medium text-accent-ink active:opacity-80"
          >
            <span>{savedClass.subject} guardada</span>
            <span className="opacity-70">Ver aula</span>
          </button>
        </div>
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

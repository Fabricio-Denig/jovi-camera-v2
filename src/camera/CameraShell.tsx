import { useEffect, useState } from "react";
import { capturePhotoFromVideo } from "./capturePhoto";
import { CaptureThumb } from "./CaptureThumb";
import { CaptureViewer } from "./CaptureViewer";
import { DebugPanel } from "./DebugPanel";
import { ModeTabs } from "./ModeTabs";
import { PermissionGate } from "./PermissionGate";
import { ShutterButton } from "./ShutterButton";
import { TopBar, nextAspect, nextTimer, type TimerSeconds } from "./TopBar";
import { photoWindow, type AspectRatio } from "./aspect";
import { FrameGuides } from "./FrameGuides";
import { FilterStrip } from "./FilterStrip";
import { findFilter } from "./filters";
import { SettingsSheet, DEFAULT_SETTINGS, type CameraSettings } from "./SettingsSheet";
import { useTorch } from "./useTorch";
import { useCamera } from "./useCamera";
import { useZoom } from "./useZoom";
import { ZoomControl } from "./ZoomControl";
import { FramingHint } from "../slid/FramingHint";
import { useVideoRecorder } from "./useVideoRecorder";
import { Viewfinder } from "./Viewfinder";
import { ModePreviewCard } from "../modes/ModePreviewCard";
import { getMode } from "../modes/modes";
import { ContentFrame } from "../slid/ContentFrame";
import { SlidOverlay } from "../slid/SlidOverlay";
import { SlidSuggestion } from "../slid/SlidSuggestion";
import { SlidDebugPanel } from "../slid/SlidDebugPanel";
import { SlidSummary } from "../slid/SlidSummary";
import { useSlidSession } from "../slid/useSlidSession";
import { getLatestCapture, saveCapture } from "../shared/lib/mediaStore";
import type { CapturedMedia } from "../types/camera";

/** Diagnostics stay out of the demo but remain one query param away if the camera misbehaves on stage. */
const params = new URLSearchParams(window.location.search);
const debugEnabled = params.has("debug");
/** `?debug=slid` liga o painel do SliD — o que se leva para a sala de aula. */
const slidDebug = params.get("debug") === "slid";

interface CameraShellProps {
  modeId: string;
  onSelectMode: (modeId: string) => void;
  onOpenModes: () => void;
  onCaptureSaved: () => void;
  /** Lets the shell surface the same suggestion inside the mode catalog. */
  onBoardDetected: (detected: boolean) => void;
  onOpenClass: (classId: string) => void;
  onOpenGallery: () => void;
  /** The summary takes over the screen, navigation included. */
  onReviewOpenChange: (open: boolean) => void;
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
  onReviewOpenChange,
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
  const zoom = useZoom(stream);
  const torch = useTorch(stream);
  const [timer, setTimer] = useState<TimerSeconds>(0);
  const [aspect, setAspect] = useState<AspectRatio>("4:3");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<CameraSettings>(DEFAULT_SETTINGS);
  const [filterId, setFilterId] = useState("nenhum");
  const [filtersOpen, setFiltersOpen] = useState(true);
  /** Segundos restantes da contagem, ou null quando não há contagem. */
  const [countdown, setCountdown] = useState<number | null>(null);

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
  /*
   * Nenhum filtro sobre uma aula. Um momento em P&B ou com sépia é a câmera
   * mudando o que ela guardou de uma lousa, e o material de estudo não pode
   * carregar uma escolha estética feita antes da aula começar.
   */
  const filtro = isSlid ? findFilter("nenhum") : findFilter(filterId);
  const slid = useSlidSession({
    videoRef,
    // Only look for a board when the suggestion could actually be acted on.
    detectionEnabled: status === "ready" && !isSlid && mode.fidelity === "real",
    zoom: zoom.digital,
    diagnosing: slidDebug,
  });

  useEffect(() => {
    onBoardDetected(slid.boardDetected);
  }, [slid.boardDetected, onBoardDetected]);

  const [confirmingFinish, setConfirmingFinish] = useState(false);
  // Two ways out, two answers. Ending the class on purpose always earns its
  // review, even an empty one — landing back on the viewfinder with no word
  // reads as a bug. Wandering off to another mode only interrupts the student
  // when there is something to lose; before this, it dropped the whole class
  // in silence.
  const summaryOpen =
    slid.status === "finished" && (isSlid || slid.captures.length > 0);
  useEffect(() => {
    onReviewOpenChange(summaryOpen || confirmingFinish);
  }, [summaryOpen, confirmingFinish, onReviewOpenChange]);

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

  // O temporizador conta aqui e não dentro do disparo: assim o cancelamento é
  // só limpar o estado, e sair da tela no meio da contagem não deixa um
  // disparo pendente atrás.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      void dispararFoto();
      return;
    }
    const timeout = setTimeout(() => setCountdown((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  async function dispararFoto() {
    if (!videoRef.current) return;
    const { blob, width, height } = await capturePhotoFromVideo(videoRef.current, {
      mirrored: facing === "user" && settings.mirrorSelfie,
      zoom: zoom.digital,
      filter: filtro.css,
      window: photoWindow(
        aspect,
        videoRef.current.videoWidth,
        videoRef.current.videoHeight,
        videoRef.current.clientWidth,
        videoRef.current.clientHeight,
      ),
    });
    await persist({
      id: crypto.randomUUID(),
      kind: "photo",
      blob,
      mimeType: blob.type,
      createdAt: Date.now(),
      width,
      height,
    });
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
        // Tocar durante a contagem cancela: é o gesto que qualquer câmera tem,
        // e sem ele o temporizador vira uma armadilha de dez segundos.
        if (countdown !== null) {
          setCountdown(null);
          return;
        }
        if (timer > 0) {
          setCountdown(timer);
          return;
        }
        await dispararFoto();
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
      <Viewfinder
        videoRef={videoRef}
        facing={facing}
        zoom={zoom.digital}
        filter={filtro.css}
      />

      {isReady && !isSlid && mode.kind === "photo" && (
        <FrameGuides aspect={aspect} grid={settings.grid} />
      )}

      {countdown !== null && countdown > 0 && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <span
            key={countdown}
            className="animate-[slid-settle_420ms_ease-out] font-mono text-[86px] font-bold text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.65)]"
          >
            {countdown}
          </span>
        </div>
      )}

      {!isReady && (
        <PermissionGate
          status={status}
          errorMessage={errorMessage}
          onRequest={requestCamera}
        />
      )}

      {slidDebug && isReady && (
        <SlidDebugPanel
          diagnostics={slid.diagnostics}
          zoomLevel={zoom.level}
          zoomNative={zoom.native}
          suggesting={slid.boardDetected}
          running={slid.status === "running"}
        />
      )}

      {debugEnabled && !slidDebug && (
        <DebugPanel
          status={status}
          facing={facing}
          diagnostics={diagnostics}
          lastError={captureError ?? errorMessage}
        />
      )}

      {/* The camera showing its work before it has anything to offer: without
          it, the first seconds of the demo are an ordinary viewfinder. */}
      {isReady && slid.weighing && !isSlid && (
        <ContentFrame
          bounds={slid.contentBounds}
          videoRef={videoRef}
          facing={facing}
          zoom={zoom.digital}
          tentative
        />
      )}

      {/* The detection is drawn on the thing it detected, so the claim can be
          checked instead of believed. */}
      {isReady && slid.boardDetected && !isSlid && (
        <ContentFrame
          bounds={slid.contentBounds}
          videoRef={videoRef}
          facing={facing}
          zoom={zoom.digital}
          label="Aula detectada"
        />
      )}

      {isReady && isSlid && slid.status === "running" && (
        <ContentFrame
          bounds={slid.contentBounds}
          videoRef={videoRef}
          facing={facing}
          zoom={zoom.digital}
          capturedKey={slid.lastMoment?.id ?? null}
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

      {/* Sempre à mão durante a sessão, ao contrário dos outros controles:
          enquadrar o slide é a única coisa que o estudante realmente precisa
          fazer com as mãos, e é a primeira, antes de apoiar o celular. */}
      {isReady && isSlid && slid.status !== "finished" && (
        <div className="pointer-events-auto absolute bottom-28 left-4 z-30 flex flex-col items-start gap-2">
          {slid.framingHint === "distante" && <FramingHint zoomLevel={zoom.level} />}
          <ZoomControl level={zoom.level} onSelect={zoom.setLevel} />
        </div>
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
          onConfirmingChange={setConfirmingFinish}
        />
      )}

      {summaryOpen && (
        <SlidSummary
          captures={slid.captures}
          stats={slid.stats}
          elapsedMs={slid.elapsedMs}
          onSave={async ({ subject, discipline, status, moments, topics, kinds, overview }) => {
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
                  // Only written when the student chose one — an absent matéria
                  // stays absent rather than becoming a guess.
                  ...(discipline ? { discipline } : {}),
                  // Mesma regra da matéria: ausente é ausente, nunca um palpite.
                  ...(status ? { status } : {}),
                  atMs: capture.atMs,
                  // Stored so the class reads the same months later, without
                  // ever going back to the images.
                  label: described.get(capture.id)?.label,
                  detail: described.get(capture.id)?.detail ?? null,
                  category: described.get(capture.id)?.category ?? null,
                  spanMs: described.get(capture.id)?.spanMs,
                  durationMs: slid.elapsedMs,
                  skippedDuplicates: slid.stats.skippedDuplicates,
                  savedAt,
                  topics,
                  kinds,
                  overview,
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
            torchAvailable={torch.available}
            torchOn={torch.on}
            onToggleTorch={torch.toggle}
            timer={timer}
            onCycleTimer={() => setTimer(nextTimer)}
            aspect={aspect}
            onCycleAspect={() => setAspect(nextAspect)}
            onOpenSettings={() => setSettingsOpen(true)}
            suggesting={slid.boardDetected}
          />

          {/* Scrim behind the controls: white text over a bright scene — a
              whiteboard, a sunlit wall — is otherwise unreadable, and the
              whiteboard is exactly where SliD is used. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-64 bg-gradient-to-t from-black/80 via-black/55 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-5 pb-6">
            {mode.kind === "photo" && (
              <>
                {slid.framingHint === "distante" && !slid.boardDetected && (
                  <FramingHint zoomLevel={zoom.level} />
                )}
                <ZoomControl level={zoom.level} onSelect={zoom.setLevel} />
              </>
            )}

            {mode.kind === "photo" && (
              <div className="flex w-full flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((aberto) => !aberto)}
                  aria-expanded={filtersOpen}
                  className="min-h-10 rounded-full bg-black/40 px-4 text-[11.5px] font-medium text-white/85 transition-transform active:scale-95"
                >
                  Filtros {filtersOpen ? "⌄" : "⌃"}
                </button>
                {filtersOpen && (
                  <div className="w-full animate-[slid-enter_220ms_ease-out]">
                    <FilterStrip
                      videoRef={videoRef}
                      active={filterId}
                      onSelect={setFilterId}
                      mirrored={facing === "user"}
                    />
                  </div>
                )}
              </div>
            )}
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
        // Anchored to the bottom: at the top it landed on the first class card
        // in the library and covered the very thing it was confirming.
        <div className="absolute inset-x-0 bottom-4 z-40 flex justify-center px-4">
          {/* Saving a class and then hiding it is the moment a student decides
              the app forgot. The way in is the confirmation itself. */}
          <button
            type="button"
            onClick={() => {
              onOpenClass(savedClass.id);
              setSavedClass(null);
            }}
            className="flex min-h-11 max-w-full animate-[slid-flash_5000ms_ease-out_both] items-center gap-2 rounded-full bg-accent px-4 py-2 text-[12.5px] font-medium text-accent-ink transition-transform duration-150 active:scale-95 active:opacity-80"
          >
            {/* The name is confirmation, not the message: a real class title
                ran to three lines and turned a toast into a paragraph. */}
            <span className="truncate">{savedClass.subject}</span>
            <span className="shrink-0 opacity-70">guardada · Ver aula</span>
          </button>
        </div>
      )}

      <SettingsSheet
        open={settingsOpen}
        settings={settings}
        onChange={setSettings}
        onClose={() => setSettingsOpen(false)}
      />

      {viewerOpen && lastCapture && (
        <CaptureViewer
          media={lastCapture}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}
